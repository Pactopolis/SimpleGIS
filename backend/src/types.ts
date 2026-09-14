// Wire-shaped geometry types shared by validation and measurement code.

export type Position = [longitude: number, latitude: number, elevationMetres: number];

export interface PointGeometry {
  type: "Point";
  coordinates: Position;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Position[];
}

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry;

export interface FeatureBody {
  name: string;
  description: string | null;
  category: string;
  geometry: Geometry;
  startTime: Date | null;
  endTime: Date | null;
  headingDegrees?: number;
  pitchDegrees?: number;
}

export interface ListQuery {
  page: number;
  pageSize: number;
  nameContains: string | null;
  bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number] | null;
  window: [start: Date, end: Date] | null;
  category: string | null;
}
