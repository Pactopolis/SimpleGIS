import type { AreaCategory, PoiCategory, TrailDifficulty } from "./enums.ts";
import type { BoundingBox, Coordinate, Path, Polygon } from "./geometry.ts";

export interface TimeWindow {
  startTime: Date;
  endTime: Date;
}

export function instant(at: Date): TimeWindow {
  return { startTime: at, endTime: at };
}

export function isInstant(window: TimeWindow): boolean {
  return window.startTime.getTime() === window.endTime.getTime();
}

interface FeatureMetadata {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  window: TimeWindow | null;
}

export interface PointOfInterest extends FeatureMetadata {
  featureType: "PointOfInterest";
  category: PoiCategory;
  position: Coordinate;
}

export interface AreaOfInterest extends FeatureMetadata {
  featureType: "AreaOfInterest";
  category: AreaCategory;
  shape: Polygon;
  areaSquareMetres: number | null;
}

export interface NewPointOfInterest {
  name: string;
  description?: string | null;
  category: PoiCategory;
  position: Coordinate;
  window?: TimeWindow | null;
}

export interface NewAreaOfInterest {
  name: string;
  description?: string | null;
  category: AreaCategory;
  shape: Polygon;
  window?: TimeWindow | null;
}

interface FeatureQuery {
  page?: number;
  pageSize?: number;
  nameContains?: string;
  bbox?: BoundingBox;
  overlapping?: TimeWindow;
}

export interface PointOfInterestQuery extends FeatureQuery {
  category?: PoiCategory;
}

export interface AreaOfInterestQuery extends FeatureQuery {
  category?: AreaCategory;
}

export interface TrailRoute extends FeatureMetadata {
  featureType: "TrailRoute";
  difficulty: TrailDifficulty;
  path: Path;
  lengthMetres: number | null;
}

export interface NewTrailRoute {
  name: string;
  description?: string | null;
  difficulty: TrailDifficulty;
  path: Path;
  window?: TimeWindow | null;
}

export interface TrailRouteQuery extends FeatureQuery {
  difficulty?: TrailDifficulty;
}

export type Feature = PointOfInterest | AreaOfInterest | TrailRoute;
