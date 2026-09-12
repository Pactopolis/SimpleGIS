export {
  ERROR_CODES,
  toBboxParam,
  toCoordinate,
  toLineStringGeometryDto,
  toPath,
  toPointGeometryDto,
  toPolygon,
  toPolygonGeometryDto,
  toPositionDto,
  toTimestamp,
  toTimeWindow,
  toTimeWindowDto,
} from "./common.ts";
export type {
  ApiErrorCode,
  ErrorDto,
  LineStringGeometryDto,
  PageEnvelopeDto,
  PointGeometryDto,
  PolygonGeometryDto,
  PositionDto,
  ReadWindowDto,
  RingDto,
  TimeWindowDto,
} from "./common.ts";

export {
  toPointOfInterest,
  toPointOfInterestPage,
  toPointOfInterestQuery,
  toPointOfInterestWriteDto,
} from "./pointOfInterest.ts";
export type {
  PointOfInterestPageDto,
  PointOfInterestReadDto,
  PointOfInterestWriteDto,
} from "./pointOfInterest.ts";

export {
  toAreaOfInterest,
  toAreaOfInterestPage,
  toAreaOfInterestQuery,
  toAreaOfInterestWriteDto,
} from "./areaOfInterest.ts";
export type {
  AreaOfInterestPageDto,
  AreaOfInterestReadDto,
  AreaOfInterestWriteDto,
} from "./areaOfInterest.ts";

export {
  toTrailRoute,
  toTrailRoutePage,
  toTrailRouteQuery,
  toTrailRouteWriteDto,
} from "./trailRoute.ts";
export type {
  TrailRoutePageDto,
  TrailRouteReadDto,
  TrailRouteWriteDto,
} from "./trailRoute.ts";
