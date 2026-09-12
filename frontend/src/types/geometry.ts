export interface Coordinate {
  longitude: number;
  latitude: number;
  elevationMetres: number;
}

export interface BoundingBox {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

export type Ring = Coordinate[];

export interface Polygon {
  exteriorRing: Ring;
  interiorRings: Ring[];
}

export const MIN_RING_POSITIONS = 4;

export function polygon(exteriorRing: Ring, interiorRings: Ring[] = []): Polygon {
  return { exteriorRing, interiorRings };
}

export function allRings(shape: Polygon): Ring[] {
  return [shape.exteriorRing, ...shape.interiorRings];
}

export function isSamePosition(a: Coordinate, b: Coordinate): boolean {
  return (
    a.longitude === b.longitude &&
    a.latitude === b.latitude &&
    a.elevationMetres === b.elevationMetres
  );
}

export function isClosed(ring: Ring): boolean {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first !== undefined && last !== undefined && isSamePosition(first, last);
}

export function closeRing(ring: Ring): Ring {
  const first = ring[0];
  if (first === undefined || isClosed(ring)) return ring;
  return [...ring, first];
}

export type Path = Coordinate[];

export const MIN_PATH_POSITIONS = 2;
export const MAX_PATH_POSITIONS = 10000;
