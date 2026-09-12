import {
  closeRing,
  type BoundingBox,
  type Coordinate,
  type Path,
  type Polygon,
  type Ring,
} from "../../types/geometry.ts";
import type { TimeWindow } from "../../types/features.ts";

export const ERROR_CODES = [
  "malformed_body",
  "array_body_not_supported",
  "unknown_property",
  "invalid_query_parameter",
  "not_found",
  "name_conflict",
  "payload_too_large",
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDto {
  code: ApiErrorCode;
  message: string;
  traceId?: string | null;
}

export interface PageEnvelopeDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type PositionDto = [
  longitude: number,
  latitude: number,
  elevationMetres: number,
];

export type RingDto = PositionDto[];

export interface PointGeometryDto {
  type: "Point";
  coordinates: PositionDto;
}

export interface PolygonGeometryDto {
  type: "Polygon";
  coordinates: [exteriorRing: RingDto, ...interiorRings: RingDto[]];
}

export interface TimeWindowDto {
  startTime: string | null;
  endTime: string | null;
}

export type ReadWindowDto = Partial<TimeWindowDto>;

export function toPositionDto(coordinate: Coordinate): PositionDto {
  return [coordinate.longitude, coordinate.latitude, coordinate.elevationMetres];
}

export function toCoordinate(position: PositionDto): Coordinate {
  const [longitude, latitude, elevationMetres] = position;
  return { longitude, latitude, elevationMetres };
}

export function toPointGeometryDto(position: Coordinate): PointGeometryDto {
  return { type: "Point", coordinates: toPositionDto(position) };
}

function toRingDto(ring: Ring): RingDto {
  return closeRing(ring).map(toPositionDto);
}

export function toPolygonGeometryDto(shape: Polygon): PolygonGeometryDto {
  return {
    type: "Polygon",
    coordinates: [
      toRingDto(shape.exteriorRing),
      ...shape.interiorRings.map(toRingDto),
    ],
  };
}

export function toPolygon(geometry: PolygonGeometryDto): Polygon {
  const [exteriorRing, ...interiorRings] = geometry.coordinates;
  return {
    exteriorRing: exteriorRing.map(toCoordinate),
    interiorRings: interiorRings.map((ring) => ring.map(toCoordinate)),
  };
}

export function toBboxParam(box: BoundingBox): string {
  return [box.minLongitude, box.minLatitude, box.maxLongitude, box.maxLatitude].join(
    ",",
  );
}

export function toTimestamp(value: Date): string {
  return value.toISOString();
}

export function toTimeWindowDto(
  window: TimeWindow | null | undefined,
): TimeWindowDto {
  return window
    ? { startTime: toTimestamp(window.startTime), endTime: toTimestamp(window.endTime) }
    : { startTime: null, endTime: null };
}

export function toTimeWindow(dto: ReadWindowDto): TimeWindow | null {
  return dto.startTime && dto.endTime
    ? { startTime: new Date(dto.startTime), endTime: new Date(dto.endTime) }
    : null;
}

export interface LineStringGeometryDto {
  type: "LineString";
  coordinates: PositionDto[];
}

export function toLineStringGeometryDto(path: Path): LineStringGeometryDto {
  return { type: "LineString", coordinates: path.map(toPositionDto) };
}

export function toPath(geometry: LineStringGeometryDto): Path {
  return geometry.coordinates.map(toCoordinate);
}
