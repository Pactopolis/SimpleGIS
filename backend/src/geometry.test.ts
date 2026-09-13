import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bounds, measure } from "./geometry.ts";
import type { LineStringGeometry, PointGeometry, PolygonGeometry } from "./types.ts";

const METRES_PER_DEGREE = 111_320.0;

describe("measure", () => {
  it("returns null for a Point", () => {
    const geometry: PointGeometry = { type: "Point", coordinates: [-106, 39, 3000] };
    assert.equal(measure(geometry), null);
  });

  it("computes the length of a LineString along a meridian exactly", () => {
    // Longitude is constant, so the equirectangular projection's east/west
    // term cancels regardless of the cosine scale — the length is exactly
    // one degree of latitude in metres.
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [
        [10, 0, 0],
        [10, 1, 0],
      ],
    };

    assert.ok(Math.abs(measure(geometry)! - METRES_PER_DEGREE) < 1e-6);
  });

  it("sums the length of a multi-segment LineString", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [
        [10, 0, 0],
        [10, 1, 0],
        [10, 3, 0],
      ],
    };

    assert.ok(Math.abs(measure(geometry)! - 3 * METRES_PER_DEGREE) < 1e-6);
  });

  it("computes the area of a polygon centred on the equator exactly", () => {
    // A diamond whose ring (including the closing duplicate) averages to
    // latitude 0 keeps the projection's cosine scale exactly 1, so the area
    // reduces to plain planar geometry: a diamond with both diagonals 2
    // degrees long has area 2 square degrees.
    const geometry: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-1, 0, 0],
          [0, -1, 0],
          [1, 0, 0],
          [0, 1, 0],
          [-1, 0, 0],
        ],
      ],
    };

    const expected = 2 * METRES_PER_DEGREE ** 2;
    assert.ok(Math.abs(measure(geometry)! - expected) / expected < 1e-9);
  });

  it("subtracts interior rings (holes) from the exterior area", () => {
    const exterior: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0, 0],
          [4, 0, 0],
          [4, 4, 0],
          [0, 4, 0],
          [0, 0, 0],
        ],
      ],
    };

    const withHole: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        exterior.coordinates[0]!,
        [
          [1, 1, 0],
          [2, 1, 0],
          [2, 2, 0],
          [1, 2, 0],
          [1, 1, 0],
        ],
      ],
    };

    assert.ok(measure(withHole)! < measure(exterior)!);
  });

  it("never returns a negative area regardless of ring winding order", () => {
    const clockwise: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0, 0],
          [0, 1, 0],
          [1, 1, 0],
          [1, 0, 0],
          [0, 0, 0],
        ],
      ],
    };
    const counterClockwise: PolygonGeometry = {
      type: "Polygon",
      coordinates: [[...clockwise.coordinates[0]!].reverse() as PolygonGeometry["coordinates"][0]],
    };

    assert.ok(measure(clockwise)! > 0);
    assert.equal(measure(clockwise), measure(counterClockwise));
  });
});

describe("bounds", () => {
  it("reports the envelope of a Point as a single-point box", () => {
    const geometry: PointGeometry = { type: "Point", coordinates: [-106, 39, 3000] };
    assert.deepEqual(bounds(geometry), [-106, 39, -106, 39]);
  });

  it("reports the envelope of a LineString", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [
        [-107, 39, 0],
        [-106, 40, 0],
      ],
    };
    assert.deepEqual(bounds(geometry), [-107, 39, -106, 40]);
  });

  it("reports the envelope of a Polygon including any holes", () => {
    const geometry: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-106.46, 39.64, 0],
          [-106.44, 39.64, 0],
          [-106.44, 39.66, 0],
          [-106.46, 39.66, 0],
          [-106.46, 39.64, 0],
        ],
      ],
    };
    assert.deepEqual(bounds(geometry), [-106.46, 39.64, -106.44, 39.66]);
  });
});
