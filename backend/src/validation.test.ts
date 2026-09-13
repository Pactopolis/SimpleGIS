import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AREAS_OF_INTEREST, POINTS_OF_INTEREST, TRAIL_ROUTES } from "./catalog.ts";
import { ApiError } from "./errors.ts";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PAGE_SIZE,
  MAX_PATH_POSITIONS,
  parseRfc3339,
  readFeatureBody,
  readListQuery,
  toRfc3339,
} from "./validation.ts";

function assertApiError(fn: () => unknown, status: number, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

const validPoi = {
  name: "Saddle Creek Overlook",
  poiCategory: "Observation",
  geometry: { type: "Point", coordinates: [-106.4453, 39.6403, 3421.5] },
};

const validAoi = {
  name: "North Basin Search Sector",
  areaCategory: "Search",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-106.46, 39.64, 3200],
        [-106.44, 39.64, 3210],
        [-106.44, 39.66, 3260],
        [-106.46, 39.66, 3240],
        [-106.46, 39.64, 3200],
      ],
    ],
  },
};

const validTrail = {
  name: "Saddle Creek Approach",
  difficulty: "Moderate",
  geometry: {
    type: "LineString",
    coordinates: [
      [-106.4501, 39.635, 3105],
      [-106.4478, 39.6371, 3188],
    ],
  },
};

describe("readFeatureBody: shared body rules", () => {
  it("accepts a well-formed body for each collection", () => {
    assert.equal(readFeatureBody(POINTS_OF_INTEREST, validPoi).name, "Saddle Creek Overlook");
    assert.equal(readFeatureBody(AREAS_OF_INTEREST, validAoi).category, "Search");
    assert.equal(readFeatureBody(TRAIL_ROUTES, validTrail).category, "Moderate");
  });

  it("rejects an array body as array_body_not_supported", () => {
    assertApiError(() => readFeatureBody(POINTS_OF_INTEREST, [validPoi]), 400, "array_body_not_supported");
  });

  it("rejects a non-object body as malformed_body", () => {
    assertApiError(() => readFeatureBody(POINTS_OF_INTEREST, "nope"), 400, "malformed_body");
    assertApiError(() => readFeatureBody(POINTS_OF_INTEREST, null), 400, "malformed_body");
  });

  it("rejects an unknown property", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, colour: "red" }),
      400,
      "unknown_property",
    );
  });

  it("rejects a missing name", () => {
    const { name: _name, ...rest } = validPoi;
    assertApiError(() => readFeatureBody(POINTS_OF_INTEREST, rest), 400, "malformed_body");
  });

  it("rejects a blank name", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, name: "   " }),
      400,
      "malformed_body",
    );
  });

  it("rejects a name over the maximum length", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, name: "x".repeat(MAX_NAME_LENGTH + 1) }),
      400,
      "malformed_body",
    );
  });

  it("accepts a name at exactly the maximum length", () => {
    const body = readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, name: "x".repeat(MAX_NAME_LENGTH) });
    assert.equal(body.name.length, MAX_NAME_LENGTH);
  });

  it("treats a missing description as null", () => {
    assert.equal(readFeatureBody(POINTS_OF_INTEREST, validPoi).description, null);
  });

  it("rejects a description with markup", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, description: "<b>hi</b>" }),
      400,
      "malformed_body",
    );
  });

  it("rejects a description over the maximum length", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a category outside the collection's enum", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, poiCategory: "Unspecified" }),
      400,
      "malformed_body",
    );
  });

  it("rejects a missing category", () => {
    const { poiCategory: _category, ...rest } = validPoi;
    assertApiError(() => readFeatureBody(POINTS_OF_INTEREST, rest), 400, "malformed_body");
  });

  it("requires startTime and endTime together", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, startTime: "2026-01-01T00:00:00Z" }),
      400,
      "malformed_body",
    );
  });

  it("rejects endTime before startTime", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          startTime: "2026-01-02T00:00:00Z",
          endTime: "2026-01-01T00:00:00Z",
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a bare local date-time without an offset", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          startTime: "2026-01-01T00:00:00",
          endTime: "2026-01-01T00:00:00",
        }),
      400,
      "malformed_body",
    );
  });

  it("accepts an instant where startTime equals endTime", () => {
    const body = readFeatureBody(POINTS_OF_INTEREST, {
      ...validPoi,
      startTime: "2026-01-01T00:00:00Z",
      endTime: "2026-01-01T00:00:00Z",
    });
    assert.equal(body.startTime?.getTime(), body.endTime?.getTime());
  });
});

describe("readFeatureBody: geometry", () => {
  it("rejects a geometry of the wrong type", () => {
    assertApiError(
      () => readFeatureBody(POINTS_OF_INTEREST, { ...validPoi, geometry: { ...validAoi.geometry } }),
      400,
      "malformed_body",
    );
  });

  it("rejects an unknown geometry property", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          geometry: { ...validPoi.geometry, crs: "EPSG:4326" },
        }),
      400,
      "unknown_property",
    );
  });

  it("rejects a position that is not exactly [lon, lat, elevation]", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          geometry: { type: "Point", coordinates: [-106.4453, 39.6403] },
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a position holding a non-number", () => {
    assertApiError(
      () =>
        readFeatureBody(POINTS_OF_INTEREST, {
          ...validPoi,
          geometry: { type: "Point", coordinates: [-106.4453, "north", 3421.5] },
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a LineString with fewer than two positions", () => {
    assertApiError(
      () =>
        readFeatureBody(TRAIL_ROUTES, {
          ...validTrail,
          geometry: { type: "LineString", coordinates: [[-106.4501, 39.635, 3105]] },
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a LineString beyond the maximum position count", () => {
    const coordinates = Array.from({ length: MAX_PATH_POSITIONS + 1 }, (_, index) => [
      -106 + index * 0.0001,
      39,
      0,
    ]);
    assertApiError(
      () => readFeatureBody(TRAIL_ROUTES, { ...validTrail, geometry: { type: "LineString", coordinates } }),
      400,
      "malformed_body",
    );
  });

  it("rejects a Polygon with no rings", () => {
    assertApiError(
      () => readFeatureBody(AREAS_OF_INTEREST, { ...validAoi, geometry: { type: "Polygon", coordinates: [] } }),
      400,
      "malformed_body",
    );
  });

  it("rejects a ring with fewer than four positions", () => {
    assertApiError(
      () =>
        readFeatureBody(AREAS_OF_INTEREST, {
          ...validAoi,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0, 0],
                [1, 0, 0],
                [0, 0, 0],
              ],
            ],
          },
        }),
      400,
      "malformed_body",
    );
  });

  it("rejects a ring whose first and last positions do not match", () => {
    assertApiError(
      () =>
        readFeatureBody(AREAS_OF_INTEREST, {
          ...validAoi,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0, 0],
                [1, 0, 0],
                [1, 1, 0],
                [0, 1, 0],
              ],
            ],
          },
        }),
      400,
      "malformed_body",
    );
  });

  it("accepts a Polygon with a closed interior ring (hole)", () => {
    const body = readFeatureBody(AREAS_OF_INTEREST, {
      ...validAoi,
      geometry: {
        type: "Polygon",
        coordinates: [
          validAoi.geometry.coordinates[0],
          [
            [-106.455, 39.645, 0],
            [-106.45, 39.645, 0],
            [-106.45, 39.65, 0],
            [-106.455, 39.645, 0],
          ],
        ],
      },
    });

    assert.equal(body.geometry.type, "Polygon");
    if (body.geometry.type === "Polygon") {
      assert.equal(body.geometry.coordinates.length, 2);
    }
  });
});

describe("readListQuery", () => {
  function params(query: string): URLSearchParams {
    return new URLSearchParams(query);
  }

  it("defaults page, pageSize and every filter", () => {
    const query = readListQuery(POINTS_OF_INTEREST, params(""));
    assert.equal(query.page, 1);
    assert.equal(query.pageSize, 50);
    assert.equal(query.nameContains, null);
    assert.equal(query.bbox, null);
    assert.equal(query.window, null);
    assert.equal(query.category, null);
  });

  it("rejects an unknown query parameter", () => {
    assertApiError(() => readListQuery(POINTS_OF_INTEREST, params("colour=red")), 400, "invalid_query_parameter");
  });

  it("rejects a repeated query parameter", () => {
    assertApiError(() => readListQuery(POINTS_OF_INTEREST, params("page=1&page=2")), 400, "invalid_query_parameter");
  });

  it("rejects a non-integer page", () => {
    assertApiError(() => readListQuery(POINTS_OF_INTEREST, params("page=abc")), 400, "invalid_query_parameter");
  });

  it("rejects pageSize above the maximum rather than clamping it", () => {
    assertApiError(
      () => readListQuery(POINTS_OF_INTEREST, params(`pageSize=${MAX_PAGE_SIZE + 1}`)),
      400,
      "invalid_query_parameter",
    );
  });

  it("accepts pageSize at exactly the maximum", () => {
    assert.equal(readListQuery(POINTS_OF_INTEREST, params(`pageSize=${MAX_PAGE_SIZE}`)).pageSize, MAX_PAGE_SIZE);
  });

  it("rejects an empty nameContains", () => {
    assertApiError(() => readListQuery(POINTS_OF_INTEREST, params("nameContains=")), 400, "invalid_query_parameter");
  });

  it("parses a valid bbox", () => {
    const query = readListQuery(POINTS_OF_INTEREST, params("bbox=-106.55,39.55,-106.35,39.75"));
    assert.deepEqual(query.bbox, [-106.55, 39.55, -106.35, 39.75]);
  });

  it("rejects a malformed bbox", () => {
    assertApiError(() => readListQuery(POINTS_OF_INTEREST, params("bbox=1,2,3")), 400, "invalid_query_parameter");
  });

  it("rejects a bbox whose minimums exceed its maximums", () => {
    assertApiError(
      () => readListQuery(POINTS_OF_INTEREST, params("bbox=10,10,-10,-10")),
      400,
      "invalid_query_parameter",
    );
  });

  it("requires from and to together", () => {
    assertApiError(
      () => readListQuery(POINTS_OF_INTEREST, params("from=2026-01-01T00:00:00Z")),
      400,
      "invalid_query_parameter",
    );
  });

  it("rejects to before from", () => {
    assertApiError(
      () =>
        readListQuery(
          POINTS_OF_INTEREST,
          params("from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z"),
        ),
      400,
      "invalid_query_parameter",
    );
  });

  it("reads the collection-specific category parameter", () => {
    assert.equal(readListQuery(POINTS_OF_INTEREST, params("poiCategory=Hazard")).category, "Hazard");
    assert.equal(readListQuery(AREAS_OF_INTEREST, params("areaCategory=Restricted")).category, "Restricted");
    assert.equal(readListQuery(TRAIL_ROUTES, params("difficulty=Expert")).category, "Expert");
  });

  it("rejects a category outside the collection's enum", () => {
    assertApiError(
      () => readListQuery(POINTS_OF_INTEREST, params("poiCategory=Unspecified")),
      400,
      "invalid_query_parameter",
    );
  });

  it("does not accept another collection's category parameter", () => {
    assertApiError(
      () => readListQuery(POINTS_OF_INTEREST, params("areaCategory=Restricted")),
      400,
      "invalid_query_parameter",
    );
  });
});

describe("RFC 3339 timestamps", () => {
  it("round-trips through parse and format", () => {
    const original = "2026-03-14T13:05:00Z";
    const parsed = parseRfc3339(original);
    assert.ok(parsed !== null);
    assert.equal(toRfc3339(parsed!), original);
  });

  it("normalizes a non-Z offset to the equivalent instant", () => {
    const parsed = parseRfc3339("2026-03-14T13:05:00-07:00");
    assert.ok(parsed !== null);
    assert.equal(parsed!.toISOString(), "2026-03-14T20:05:00.000Z");
  });

  it("rejects a value without an offset", () => {
    assert.equal(parseRfc3339("2026-03-14T13:05:00"), null);
  });

  it("rejects a non-timestamp string", () => {
    assert.equal(parseRfc3339("not a date"), null);
  });
});
