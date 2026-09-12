export {
  allRings,
  closeRing,
  isClosed,
  isSamePosition,
  MAX_PATH_POSITIONS,
  MIN_PATH_POSITIONS,
  MIN_RING_POSITIONS,
  polygon,
} from "./geometry.ts";
export type { BoundingBox, Coordinate, Path, Polygon, Ring } from "./geometry.ts";

export { MAX_PAGE_SIZE } from "./paging.ts";
export type { Page } from "./paging.ts";

export {
  AREA_CATEGORIES,
  FEATURE_TYPES,
  POI_CATEGORIES,
  TRAIL_DIFFICULTIES,
} from "./enums.ts";
export type {
  AreaCategory,
  FeatureType,
  PoiCategory,
  TrailDifficulty,
} from "./enums.ts";

export { instant, isInstant } from "./features.ts";
export type {
  AreaOfInterest,
  AreaOfInterestQuery,
  NewAreaOfInterest,
  NewPointOfInterest,
  NewTrailRoute,
  PointOfInterest,
  PointOfInterestQuery,
  TimeWindow,
  TrailRoute,
  TrailRouteQuery,
} from "./features.ts";
