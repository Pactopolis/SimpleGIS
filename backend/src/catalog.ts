// The three feature collections the spec (../openapi.yaml) defines.

export type FeatureTypeName = "PointOfInterest" | "AreaOfInterest" | "TrailRoute";
export type GeometryType = "Point" | "LineString" | "Polygon";

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

export const COLLECTIONS: Readonly<Record<string, Collection>> = {
  [POINTS_OF_INTEREST.path]: POINTS_OF_INTEREST,
  [AREAS_OF_INTEREST.path]: AREAS_OF_INTEREST,
  [TRAIL_ROUTES.path]: TRAIL_ROUTES,
};
