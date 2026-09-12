export const FEATURE_TYPES = [
  "PointOfInterest",
  "AreaOfInterest",
  "TrailRoute",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

export const POI_CATEGORIES = [
  "Landmark",
  "Hazard",
  "Waypoint",
  "Facility",
  "Observation",
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

export const AREA_CATEGORIES = [
  "Restricted",
  "Search",
  "Staging",
  "Hazard",
  "Coverage",
] as const;

export type AreaCategory = (typeof AREA_CATEGORIES)[number];

export const TRAIL_DIFFICULTIES = [
  "Easy",
  "Moderate",
  "Difficult",
  "Expert",
] as const;

export type TrailDifficulty = (typeof TRAIL_DIFFICULTIES)[number];
