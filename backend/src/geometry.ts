// Planar geometry helpers.
//
// Positions are GeoJSON order — longitude, latitude, elevation. Measurements
// use an equirectangular projection about the shape's mean latitude, which is
// close enough over a single feature and keeps the server dependency-free.

import type { Geometry, Position } from "./types.ts";

const METRES_PER_DEGREE = 111_320.0;

type Plane = [number, number];

export function positionsOf(geometry: Geometry): Position[] {
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "LineString") return geometry.coordinates;
  return geometry.coordinates.flat();
}

export function bounds(
  geometry: Geometry,
): [minLon: number, minLat: number, maxLon: number, maxLat: number] {
  const positions = positionsOf(geometry);
  const longitudes = positions.map((position) => position[0]);
  const latitudes = positions.map((position) => position[1]);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function measure(geometry: Geometry): number | null {
  if (geometry.type === "LineString") return lengthMetres(geometry.coordinates);
  if (geometry.type === "Polygon") return areaSquareMetres(geometry.coordinates);
  return null;
}

function lengthMetres(positions: Position[]): number {
  const plane = project(positions);
  let total = 0;

  for (let index = 0; index < plane.length - 1; index += 1) {
    total += distance(plane[index]!, plane[index + 1]!);
  }

  return total;
}

function areaSquareMetres(rings: Position[][]): number {
  const [exterior, ...interiors] = rings;
  const area = shoelace(exterior!) - interiors.reduce((sum, ring) => sum + shoelace(ring), 0);

  return Math.max(area, 0);
}

function shoelace(ring: Position[]): number {
  const plane = project(ring);
  const first = plane[0]!;
  const last = plane[plane.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1] ? plane : [...plane, first];

  let total = 0;
  for (let index = 0; index < closed.length - 1; index += 1) {
    const start = closed[index]!;
    const end = closed[index + 1]!;
    total += start[0] * end[1] - end[0] * start[1];
  }

  return Math.abs(total) / 2;
}

function distance(a: Plane, b: Plane): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function project(positions: Position[]): Plane[] {
  const reference =
    positions.reduce((sum, position) => sum + position[1], 0) / positions.length;
  const scale = Math.cos((reference * Math.PI) / 180);

  return positions.map(
    (position): Plane => [
      position[0] * scale * METRES_PER_DEGREE,
      position[1] * METRES_PER_DEGREE,
    ],
  );
}
