export const FEATURE_TYPES = [
  "PointOfInterest",
  "AreaOfInterest",
  "TrailRoute",
  "CameraCone",
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

export const CAMERA_TIERS = ["Low", "Mid", "High"] as const;

export type CameraTier = (typeof CAMERA_TIERS)[number];

export interface CameraTierSpec {
  typicalSpec: string;
  hfovDegrees: number;
  halfAngleDegrees: number;
  distanceFromVertexMetres: number;
  baseRadiusMetres: number;
}

export const CAMERA_TIER_SPECS: Readonly<Record<CameraTier, CameraTierSpec>> = {
  Low: {
    typicalSpec: "1080p fixed wide lens",
    hfovDegrees: 90,
    halfAngleDegrees: 45,
    distanceFromVertexMetres: 50,
    baseRadiusMetres: 50.0,
  },
  Mid: {
    typicalSpec: "4MP varifocal",
    hfovDegrees: 60,
    halfAngleDegrees: 30,
    distanceFromVertexMetres: 200,
    baseRadiusMetres: 115.5,
  },
  High: {
    typicalSpec: "4K PTZ / long-range thermal",
    hfovDegrees: 15,
    halfAngleDegrees: 7.5,
    distanceFromVertexMetres: 1000,
    baseRadiusMetres: 131.7,
  },
};
