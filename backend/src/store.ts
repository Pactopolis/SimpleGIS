// In-memory feature storage. Nothing survives the process.

import { randomUUID } from "node:crypto";

import type { Collection } from "./catalog.ts";
import { COLLECTIONS } from "./catalog.ts";
import { ApiError } from "./errors.ts";
import * as geometry from "./geometry.ts";
import { parseRfc3339, toRfc3339 } from "./validation.ts";
import type { FeatureBody, ListQuery } from "./types.ts";

export type FeatureRecord = Record<string, unknown> & {
  id: string;
  featureType: string;
  name: string;
  description: string | null;
  geometry: FeatureBody["geometry"];
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export class FeatureStore {
  private readonly features = new Map<string, Map<string, FeatureRecord>>(
    Object.keys(COLLECTIONS).map((path) => [path, new Map<string, FeatureRecord>()]),
  );

  list(collection: Collection, query: ListQuery): [FeatureRecord[], number] {
    // Map iteration follows insertion order, and Array#sort is stable, so
    // sorting by createdAt alone still breaks ties by creation order — no id
    // comparison needed (createdAt has only millisecond resolution, so ties
    // are common when features are created in a tight loop, as in tests).
    const all = [...this.byPath(collection).values()];
    const matches = all.filter((feature) => matches_(feature, collection, query));

    matches.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

    const start = (query.page - 1) * query.pageSize;

    return [matches.slice(start, start + query.pageSize), matches.length];
  }

  get(collection: Collection, featureId: string): FeatureRecord {
    const feature = this.byPath(collection).get(featureId);

    if (feature === undefined) {
      throw new ApiError(404, "not_found", "No such feature.");
    }

    return feature;
  }

  create(collection: Collection, body: FeatureBody): FeatureRecord {
    this.rejectDuplicateName(collection, body.name, null);

    const feature = build(collection, body);
    feature.id = randomUUID();
    feature.createdAt = toRfc3339(new Date());
    feature.updatedAt = null;
    this.byPath(collection).set(feature.id, feature);

    return feature;
  }

  replace(collection: Collection, featureId: string, body: FeatureBody): FeatureRecord {
    const existing = this.get(collection, featureId);
    this.rejectDuplicateName(collection, body.name, featureId);

    const feature = build(collection, body);
    feature.id = existing.id;
    feature.createdAt = existing.createdAt;
    feature.updatedAt = toRfc3339(new Date());
    this.byPath(collection).set(featureId, feature);

    return feature;
  }

  delete(collection: Collection, featureId: string): void {
    this.get(collection, featureId);
    this.byPath(collection).delete(featureId);
  }

  private byPath(collection: Collection): Map<string, FeatureRecord> {
    return this.features.get(collection.path)!;
  }

  private rejectDuplicateName(
    collection: Collection,
    name: string,
    featureId: string | null,
  ): void {
    const taken = [...this.byPath(collection).values()].some(
      (feature) => feature.name === name && feature.id !== featureId,
    );

    if (taken) {
      throw new ApiError(
        409,
        "name_conflict",
        `Another ${collection.featureType} already uses that name.`,
      );
    }
  }
}

function build(collection: Collection, body: FeatureBody): FeatureRecord {
  const feature: FeatureRecord = {
    id: "",
    featureType: collection.featureType,
    name: body.name,
    description: body.description,
    [collection.categoryField]: body.category,
    geometry: body.geometry,
    startTime: body.startTime ? toRfc3339(body.startTime) : null,
    endTime: body.endTime ? toRfc3339(body.endTime) : null,
    createdAt: "",
    updatedAt: null,
  };

  if (collection.measurementField !== null) {
    feature[collection.measurementField] = geometry.measure(body.geometry);
  }

  return feature;
}

function matches_(feature: FeatureRecord, collection: Collection, query: ListQuery): boolean {
  return (
    matchesName(feature, query.nameContains) &&
    matchesCategory(feature, collection, query.category) &&
    matchesBbox(feature, query.bbox) &&
    matchesWindow(feature, query.window)
  );
}

function matchesName(feature: FeatureRecord, nameContains: string | null): boolean {
  return nameContains === null || feature.name.toLowerCase().includes(nameContains.toLowerCase());
}

function matchesCategory(
  feature: FeatureRecord,
  collection: Collection,
  category: string | null,
): boolean {
  return category === null || feature[collection.categoryField] === category;
}

function matchesBbox(feature: FeatureRecord, bbox: ListQuery["bbox"]): boolean {
  if (bbox === null) return true;

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [west, south, east, north] = geometry.bounds(feature.geometry);

  return west <= maxLon && east >= minLon && south <= maxLat && north >= minLat;
}

function matchesWindow(feature: FeatureRecord, window: ListQuery["window"]): boolean {
  if (window === null) return true;
  if (feature.startTime === null || feature.endTime === null) return false;

  const start = parseRfc3339(feature.startTime);
  const end = parseRfc3339(feature.endTime);

  if (start === null || end === null) return false;

  const [requestedStart, requestedEnd] = window;

  return start.getTime() <= requestedEnd.getTime() && end.getTime() >= requestedStart.getTime();
}
