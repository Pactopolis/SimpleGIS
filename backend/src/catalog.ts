// The feature collections the spec (../openapi.yaml) defines.

export type FeatureTypeName =
  | "PointOfInterest"
  | "AreaOfInterest"
  | "TrailRoute"
  | "CameraCone";
export type GeometryType = "Point" | "LineString" | "Polygon";

export interface CameraTierSpec {
  typicalSpec: string;
  hfovDegrees: number;
  halfAngleDegrees: number;
  distanceFromVertexMetres: number;
  baseRadiusMetres: number;
}

export const CAMERA_TIERS = ["Low", "Mid", "High"] as const;
export type CameraTier = (typeof CAMERA_TIERS)[number];

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

export interface Collection {
  path: string;
  featureType: FeatureTypeName;
  categoryField: string;
  categories: readonly string[];
  geometryType: GeometryType;
  measurementField: string | null;
}

export const POINTS_OF_INTEREST: Collection = {
  path: "points-of-interest",
  featureType: "PointOfInterest",
  categoryField: "poiCategory",
  categories: ["Landmark", "Hazard", "Waypoint", "Facility", "Observation"],
  geometryType: "Point",
  measurementField: null,
};

export const AREAS_OF_INTEREST: Collection = {
  path: "areas-of-interest",
  featureType: "AreaOfInterest",
  categoryField: "areaCategory",
  categories: ["Restricted", "Search", "Staging", "Hazard", "Coverage"],
  geometryType: "Polygon",
  measurementField: "areaSquareMetres",
};

export const TRAIL_ROUTES: Collection = {
  path: "trail-routes",
  featureType: "TrailRoute",
  categoryField: "difficulty",
  categories: ["Easy", "Moderate", "Difficult", "Expert"],
  geometryType: "LineString",
  measurementField: "lengthMetres",
};

export const CAMERA_CONES: Collection = {
  path: "camera-cones",
  featureType: "CameraCone",
  categoryField: "cameraTier",
  categories: CAMERA_TIERS,
  geometryType: "Point",
  measurementField: null,
};

export const COLLECTIONS: Readonly<Record<string, Collection>> = {
  [POINTS_OF_INTEREST.path]: POINTS_OF_INTEREST,
  [AREAS_OF_INTEREST.path]: AREAS_OF_INTEREST,
  [TRAIL_ROUTES.path]: TRAIL_ROUTES,
  [CAMERA_CONES.path]: CAMERA_CONES,
};
