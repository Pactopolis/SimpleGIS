// Request validation, expressed against the spec's error envelope.
//
// Every rejection throws ApiError, which the server renders as the uniform
// error body. The spec's code enum has no member for field-level failures, so
// anything wrong inside an otherwise parseable object body is malformed_body.

import type { Collection } from "./catalog.ts";
import { ApiError } from "./errors.ts";
import type {
  FeatureBody,
  Geometry,
  ListQuery,
  Position,
} from "./types.ts";

export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 512;
export const MAX_PATH_POSITIONS = 10_000;
export const MIN_RING_POSITIONS = 4;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
const POSITION_LENGTH = 3;

const MARKUP = /<[^<>]*>/;
const BBOX = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

const BODY_FIELDS = ["name", "description", "geometry", "startTime", "endTime"];
const QUERY_FIELDS = ["page", "pageSize", "nameContains", "bbox", "from", "to"];

export type { Geometry, FeatureBody, ListQuery };

export function readFeatureBody(collection: Collection, payload: unknown): FeatureBody {
  if (Array.isArray(payload)) {
    throw new ApiError(
      400,
      "array_body_not_supported",
      "The request body must be a single object, not an array.",
    );
  }

  if (typeof payload !== "object" || payload === null) {
    throw new ApiError(400, "malformed_body", "The request body must be an object.");
  }

  const body = payload as Record<string, unknown>;
  const allowed = new Set([...BODY_FIELDS, collection.categoryField]);
  const unknown = Object.keys(body)
    .filter((key) => !allowed.has(key))
    .sort();

  if (unknown.length > 0) {
    throw new ApiError(400, "unknown_property", `Unknown property '${unknown[0]}'.`);
  }

  const [startTime, endTime] = readWindow(body);

  return {
    name: readName(body),
    description: readDescription(body),
    category: readCategory(collection, body),
    geometry: readGeometry(collection, body),
    startTime,
    endTime,
  };
}

export function readListQuery(
  collection: Collection,
  params: URLSearchParams,
): ListQuery {
  const raw = new Map<string, string[]>();
  for (const key of params.keys()) {
    if (!raw.has(key)) raw.set(key, params.getAll(key));
  }

  const allowed = new Set([...QUERY_FIELDS, collection.categoryField]);
  const unknown = [...raw.keys()].filter((key) => !allowed.has(key)).sort();

  if (unknown.length > 0) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      `Unknown query parameter '${unknown[0]}'.`,
    );
  }

  const repeated = [...raw.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([name]) => name)
    .sort();

  if (repeated.length > 0) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      `Query parameter '${repeated[0]}' was supplied more than once.`,
    );
  }

  const query = new Map<string, string>();
  for (const [name, values] of raw) query.set(name, values[0]!);

  return {
    page: readBoundedInteger(query, "page", 1, null, 1),
    pageSize: readBoundedInteger(query, "pageSize", 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    nameContains: readNameContains(query),
    bbox: readBbox(query),
    window: readQueryWindow(query),
    category: readQueryCategory(collection, query),
  };
}

export function toRfc3339(moment: Date): string {
  return moment.toISOString().replace(".000Z", "Z");
}

export function parseRfc3339(value: string): Date | null {
  const match = RFC3339.exec(value);
  if (match === null) return null;

  const [, year, month, day, hour, minute, second, fraction, offset] = match;
  const millis = Math.min(Math.round(Number(fraction ?? 0) * 1000), 999);
  const offsetMinutes = parseOffset(offset!);

  const utcMillis =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      millis,
    ) -
    offsetMinutes * 60_000;

  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOffset(offset: string): number {
  if (offset.toUpperCase() === "Z") return 0;

  const sign = offset[0] === "-" ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));

  return sign * (hours * 60 + minutes);
}

function readName(payload: Record<string, unknown>): string {
  if (!("name" in payload)) {
    throw new ApiError(400, "malformed_body", "'name' is required.");
  }

  const name = payload.name;

  if (typeof name !== "string") {
    throw new ApiError(400, "malformed_body", "'name' must be a string.");
  }

  if (name.trim() === "") {
    throw new ApiError(400, "malformed_body", "'name' must not be blank.");
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError(
      400,
      "malformed_body",
      `'name' must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }

  return name;
}

function readDescription(payload: Record<string, unknown>): string | null {
  const description = payload.description ?? null;

  if (description === null) return null;

  if (typeof description !== "string") {
    throw new ApiError(400, "malformed_body", "'description' must be a string.");
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ApiError(
      400,
      "malformed_body",
      `'description' must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }

  if (MARKUP.test(description)) {
    throw new ApiError(400, "malformed_body", "'description' must be plain text.");
  }

  return description;
}

function readCategory(collection: Collection, payload: Record<string, unknown>): string {
  const field = collection.categoryField;

  if (!(field in payload)) {
    throw new ApiError(400, "malformed_body", `'${field}' is required.`);
  }

  const category = payload[field];

  if (typeof category !== "string" || !collection.categories.includes(category)) {
    const allowed = collection.categories.join(", ");
    throw new ApiError(400, "malformed_body", `'${field}' must be one of: ${allowed}.`);
  }

  return category;
}

function readWindow(payload: Record<string, unknown>): [Date | null, Date | null] {
  const start = payload.startTime ?? null;
  const end = payload.endTime ?? null;

  if ((start === null) !== (end === null)) {
    throw new ApiError(
      400,
      "malformed_body",
      "'startTime' and 'endTime' must be supplied together.",
    );
  }

  if (start === null) return [null, null];

  const startTime = readTimestamp(start, "startTime");
  const endTime = readTimestamp(end, "endTime");

  if (endTime.getTime() < startTime.getTime()) {
    throw new ApiError(400, "malformed_body", "'endTime' must be at or after 'startTime'.");
  }

  return [startTime, endTime];
}

function readTimestamp(value: unknown, field: string): Date {
  const moment = typeof value === "string" ? parseRfc3339(value) : null;

  if (moment === null) {
    throw new ApiError(
      400,
      "malformed_body",
      `'${field}' must be an RFC 3339 timestamp with a UTC offset.`,
    );
  }

  return moment;
}

function readGeometry(collection: Collection, payload: Record<string, unknown>): Geometry {
  if (!("geometry" in payload)) {
    throw new ApiError(400, "malformed_body", "'geometry' is required.");
  }

  const geometry = payload.geometry;

  if (typeof geometry !== "object" || geometry === null || Array.isArray(geometry)) {
    throw new ApiError(400, "malformed_body", "'geometry' must be an object.");
  }

  const geometryRecord = geometry as Record<string, unknown>;
  const unknown = Object.keys(geometryRecord)
    .filter((key) => key !== "type" && key !== "coordinates")
    .sort();

  if (unknown.length > 0) {
    throw new ApiError(400, "unknown_property", `Unknown property 'geometry.${unknown[0]}'.`);
  }

  if (geometryRecord.type !== collection.geometryType) {
    throw new ApiError(
      400,
      "malformed_body",
      `'geometry.type' must be '${collection.geometryType}'.`,
    );
  }

  if (!("coordinates" in geometryRecord)) {
    throw new ApiError(400, "malformed_body", "'geometry.coordinates' is required.");
  }

  const coordinates = geometryRecord.coordinates;

  if (collection.geometryType === "Point") {
    return {
      type: "Point",
      coordinates: readPosition(coordinates, "geometry.coordinates"),
    };
  }

  if (collection.geometryType === "LineString") {
    return { type: "LineString", coordinates: readPath(coordinates) };
  }

  return { type: "Polygon", coordinates: readRings(coordinates) };
}

function readPath(coordinates: unknown): Position[] {
  if (!Array.isArray(coordinates)) {
    throw new ApiError(400, "malformed_body", "'geometry.coordinates' must be an array.");
  }

  if (coordinates.length < 2 || coordinates.length > MAX_PATH_POSITIONS) {
    throw new ApiError(
      400,
      "malformed_body",
      `A LineString needs between 2 and ${MAX_PATH_POSITIONS} positions.`,
    );
  }

  return coordinates.map((position, index) =>
    readPosition(position, `geometry.coordinates[${index}]`),
  );
}

function readRings(coordinates: unknown): Position[][] {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new ApiError(400, "malformed_body", "A Polygon needs at least an exterior ring.");
  }

  return coordinates.map((ring, index) => readRing(ring, index));
}

function readRing(ring: unknown, index: number): Position[] {
  const label = `geometry.coordinates[${index}]`;

  if (!Array.isArray(ring) || ring.length < MIN_RING_POSITIONS) {
    throw new ApiError(
      400,
      "malformed_body",
      `Ring ${label} needs at least ${MIN_RING_POSITIONS} positions.`,
    );
  }

  const positions = ring.map((position, offset) =>
    readPosition(position, `${label}[${offset}]`),
  );

  const first = positions[0]!;
  const last = positions[positions.length - 1]!;

  if (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2]) {
    throw new ApiError(
      400,
      "malformed_body",
      `Ring ${label} must close — the first and last positions must match.`,
    );
  }

  return positions;
}

function readPosition(position: unknown, label: string): Position {
  if (!Array.isArray(position) || position.length !== POSITION_LENGTH) {
    throw new ApiError(
      400,
      "malformed_body",
      `${label} must be a position of longitude, latitude and elevation.`,
    );
  }

  if (position.some((value) => typeof value !== "number" || Number.isNaN(value))) {
    throw new ApiError(400, "malformed_body", `${label} must hold three numbers.`);
  }

  return [position[0], position[1], position[2]];
}

function readBoundedInteger(
  query: Map<string, string>,
  field: string,
  minimum: number,
  maximum: number | null,
  fallback: number,
): number {
  if (!query.has(field)) return fallback;

  const raw = query.get(field)!;

  if (!/^-?\d+$/.test(raw)) {
    throw new ApiError(400, "invalid_query_parameter", `'${field}' must be an integer.`);
  }

  const value = Number(raw);

  if (value < minimum || (maximum !== null && value > maximum)) {
    const limit = maximum === null ? `at least ${minimum}` : `between ${minimum} and ${maximum}`;
    throw new ApiError(400, "invalid_query_parameter", `'${field}' must be ${limit}.`);
  }

  return value;
}

function readNameContains(query: Map<string, string>): string | null {
  if (!query.has("nameContains")) return null;

  const value = query.get("nameContains")!;

  if (value.length < 1 || value.length > MAX_NAME_LENGTH) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      `'nameContains' must be 1 to ${MAX_NAME_LENGTH} characters.`,
    );
  }

  return value;
}

function readBbox(
  query: Map<string, string>,
): [number, number, number, number] | null {
  if (!query.has("bbox")) return null;

  const value = query.get("bbox")!;

  if (!BBOX.test(value)) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      "'bbox' must be minLon,minLat,maxLon,maxLat in decimal degrees.",
    );
  }

  const [minLon, minLat, maxLon, maxLat] = value.split(",").map(Number) as [
    number,
    number,
    number,
    number,
  ];

  if (minLon > maxLon || minLat > maxLat) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      "'bbox' minimums must not exceed its maximums.",
    );
  }

  return [minLon, minLat, maxLon, maxLat];
}

function readQueryWindow(query: Map<string, string>): [Date, Date] | null {
  const hasFrom = query.has("from");
  const hasTo = query.has("to");

  if (hasFrom !== hasTo) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      "'from' and 'to' must be supplied together.",
    );
  }

  if (!hasFrom) return null;

  const start = readQueryTimestamp(query.get("from")!, "from");
  const end = readQueryTimestamp(query.get("to")!, "to");

  if (end.getTime() < start.getTime()) {
    throw new ApiError(400, "invalid_query_parameter", "'to' must be at or after 'from'.");
  }

  return [start, end];
}

function readQueryTimestamp(value: string, field: string): Date {
  const moment = parseRfc3339(value);

  if (moment === null) {
    throw new ApiError(
      400,
      "invalid_query_parameter",
      `'${field}' must be an RFC 3339 timestamp with a UTC offset.`,
    );
  }

  return moment;
}

function readQueryCategory(collection: Collection, query: Map<string, string>): string | null {
  const field = collection.categoryField;

  if (!query.has(field)) return null;

  const category = query.get(field)!;

  if (!collection.categories.includes(category)) {
    const allowed = collection.categories.join(", ");
    throw new ApiError(400, "invalid_query_parameter", `'${field}' must be one of: ${allowed}.`);
  }

  return category;
}
