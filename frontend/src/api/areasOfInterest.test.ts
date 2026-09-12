import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAreaOfInterest,
  deleteAreaOfInterest,
  getAreaOfInterest,
  listAreasOfInterest,
  replaceAreaOfInterest,
} from "./areasOfInterest.ts";
import { ApiError, DEFAULT_BASE_URL } from "./client.ts";
import { json, pageOf, stubFetch } from "./testSupport.ts";
import { AREA_CATEGORIES, instant, MIN_RING_POSITIONS, polygon } from "../types/index.ts";
import type { NewAreaOfInterest } from "../types/features.ts";
import type { Coordinate, Ring } from "../types/geometry.ts";

function at(longitude: number, latitude: number, elevationMetres: number): Coordinate {
  return { longitude, latitude, elevationMetres };
}

const closedRing: Ring = [
  at(-106.46, 39.64, 3200),
  at(-106.44, 39.64, 3210),
  at(-106.44, 39.66, 3260),
  at(-106.46, 39.66, 3240),
  at(-106.46, 39.64, 3200),
];

const openRing: Ring = closedRing.slice(0, -1);

const exteriorRingDto = [
  [-106.46, 39.64, 3200],
  [-106.44, 39.64, 3210],
  [-106.44, 39.66, 3260],
  [-106.46, 39.66, 3240],
  [-106.46, 39.64, 3200],
];

const readAoi = {
  id: "9c4d2a",
  featureType: "AreaOfInterest" as const,
  name: "North Basin Search Sector",
  description: "Sector 3 of the grid.",
  areaCategory: "Search" as const,
  geometry: { type: "Polygon" as const, coordinates: [exteriorRingDto] },
  areaSquareMetres: 1893442.75,
  createdAt: "2026-03-14T12:55:10Z",
  updatedAt: null,
  startTime: null,
  endTime: null,
};

const newAoi: NewAreaOfInterest = {
  name: "North Basin Search Sector",
  description: "Sector 3 of the grid.",
  category: "Search",
  shape: polygon(closedRing),
};

describe("listAreasOfInterest", () => {
  it("sends no query string when no filters are supplied", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listAreasOfInterest({}, { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/areas-of-interest`);
    assert.equal(stub.last.init.method, "GET");
  });

  it("serializes paging and name filters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listAreasOfInterest(
      { page: 2, pageSize: 200, nameContains: "basin" },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("page"), "2");
    assert.equal(stub.params().get("pageSize"), "200");
    assert.equal(stub.params().get("nameContains"), "basin");
  });

  it("flattens a bounding box to minLon,minLat,maxLon,maxLat", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listAreasOfInterest(
      {
        bbox: {
          minLongitude: -106.55,
          minLatitude: 39.55,
          maxLongitude: -106.35,
          maxLatitude: 39.75,
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("bbox"), "-106.55,39.55,-106.35,39.75");
  });

  it("maps the domain category field onto the areaCategory parameter", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listAreasOfInterest({ category: "Restricted" }, { fetch: stub.fetch });

    assert.equal(stub.params().get("areaCategory"), "Restricted");
    assert.equal(stub.params().get("category"), null);
    assert.equal(stub.params().get("poiCategory"), null);
  });

  it("sends an overlapping window as paired from and to parameters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listAreasOfInterest(
      {
        overlapping: {
          startTime: new Date("2026-03-14T00:00:00Z"),
          endTime: new Date("2026-03-15T00:00:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("from"), "2026-03-14T00:00:00.000Z");
    assert.equal(stub.params().get("to"), "2026-03-15T00:00:00.000Z");
  });

  it("passes the paging envelope through unchanged", async () => {
    const stub = stubFetch(
      json(200, { page: 4, pageSize: 10, totalItems: 37, totalPages: 4, items: [] }),
    );

    const result = await listAreasOfInterest({}, { fetch: stub.fetch });

    assert.deepEqual(result, {
      page: 4,
      pageSize: 10,
      totalItems: 37,
      totalPages: 4,
      items: [],
    });
  });

  it("maps items into domain objects", async () => {
    const stub = stubFetch(json(200, pageOf([readAoi])));

    const result = await listAreasOfInterest({}, { fetch: stub.fetch });

    assert.deepEqual(result.items[0], {
      id: "9c4d2a",
      featureType: "AreaOfInterest",
      name: "North Basin Search Sector",
      description: "Sector 3 of the grid.",
      category: "Search",
      shape: { exteriorRing: closedRing, interiorRings: [] },
      areaSquareMetres: 1893442.75,
      createdAt: new Date("2026-03-14T12:55:10Z"),
      updatedAt: null,
      window: null,
    });
  });
});

describe("getAreaOfInterest", () => {
  it("requests the resource path", async () => {
    const stub = stubFetch(json(200, readAoi));

    await getAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/areas-of-interest/9c4d2a`);
  });

  it("percent-encodes the identifier", async () => {
    const stub = stubFetch(json(200, readAoi));

    await getAreaOfInterest("a/b c", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/areas-of-interest/a%2Fb%20c`);
  });

  it("splits the first ring from the interior rings", async () => {
    const hole = [
      [-106.455, 39.645, 3205],
      [-106.45, 39.645, 3208],
      [-106.45, 39.65, 3212],
      [-106.455, 39.645, 3205],
    ];
    const stub = stubFetch(
      json(200, {
        ...readAoi,
        geometry: { type: "Polygon", coordinates: [exteriorRingDto, hole] },
      }),
    );

    const result = await getAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.deepEqual(result.shape.exteriorRing, closedRing);
    assert.equal(result.shape.interiorRings.length, 1);
    assert.deepEqual(result.shape.interiorRings[0], [
      at(-106.455, 39.645, 3205),
      at(-106.45, 39.645, 3208),
      at(-106.45, 39.65, 3212),
      at(-106.455, 39.645, 3205),
    ]);
  });

  it("normalizes a missing description and area to null", async () => {
    const {
      description: _description,
      areaSquareMetres: _area,
      ...sparse
    } = readAoi;
    const stub = stubFetch(json(200, sparse));

    const result = await getAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.equal(result.description, null);
    assert.equal(result.areaSquareMetres, null);
  });

  it("maps the time bounds into a window of Date objects", async () => {
    const stub = stubFetch(
      json(200, {
        ...readAoi,
        updatedAt: "2026-03-20T08:15:00Z",
        startTime: "2026-03-14T13:05:00Z",
        endTime: "2026-03-14T17:40:00Z",
      }),
    );

    const result = await getAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.deepEqual(result.updatedAt, new Date("2026-03-20T08:15:00Z"));
    assert.deepEqual(result.window, {
      startTime: new Date("2026-03-14T13:05:00Z"),
      endTime: new Date("2026-03-14T17:40:00Z"),
    });
  });

  it("reports an untimed feature as a null window", async () => {
    const stub = stubFetch(json(200, readAoi));

    const result = await getAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.equal(result.window, null);
  });

  it("throws ApiError with code not_found on 404", async () => {
    const stub = stubFetch(
      json(404, { code: "not_found", message: "No such feature.", traceId: "t-9" }),
    );

    await assert.rejects(
      () => getAreaOfInterest("missing", { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        assert.equal(error.traceId, "t-9");
        return true;
      },
    );
  });
});

describe("createAreaOfInterest", () => {
  it("POSTs a write DTO with wire field names", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(newAoi, { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "POST");
    assert.deepEqual(stub.body(), {
      name: "North Basin Search Sector",
      description: "Sector 3 of the grid.",
      areaCategory: "Search",
      geometry: { type: "Polygon", coordinates: [exteriorRingDto] },
      startTime: null,
      endTime: null,
    });
  });

  it("nests rings one level deeper than a point geometry", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(newAoi, { fetch: stub.fetch });

    const body = stub.body() as { geometry: { coordinates: number[][][] } };
    assert.deepEqual(body.geometry.coordinates[0]?.[0], [-106.46, 39.64, 3200]);
  });

  it("closes an open exterior ring", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(
      { ...newAoi, shape: polygon(openRing) },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { geometry: { coordinates: number[][][] } };
    const ring = body.geometry.coordinates[0]!;
    assert.equal(ring.length, openRing.length + 1);
    assert.deepEqual(ring.at(0), ring.at(-1));
    assert.ok(ring.length >= MIN_RING_POSITIONS);
  });

  it("closes interior rings too", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(
      { ...newAoi, shape: polygon(closedRing, [openRing]) },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { geometry: { coordinates: number[][][] } };
    const hole = body.geometry.coordinates[1]!;
    assert.deepEqual(hole.at(0), hole.at(-1));
  });

  it("sends description as null when the caller omits it", async () => {
    const stub = stubFetch(json(201, readAoi));
    const { description: _omitted, ...withoutDescription } = newAoi;

    await createAreaOfInterest(withoutDescription, { fetch: stub.fetch });

    assert.equal((stub.body() as { description: unknown }).description, null);
  });

  it("sends both bounds as null when no window is supplied", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(newAoi, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("serializes a window as RFC 3339 timestamps", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(
      {
        ...newAoi,
        window: {
          startTime: new Date("2026-03-14T13:05:00Z"),
          endTime: new Date("2026-03-14T17:40:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, "2026-03-14T13:05:00.000Z");
    assert.equal(body.endTime, "2026-03-14T17:40:00.000Z");
  });

  it("expresses an instant as equal start and end times", async () => {
    const stub = stubFetch(json(201, readAoi));

    await createAreaOfInterest(
      { ...newAoi, window: instant(new Date("2026-03-14T13:05:00Z")) },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, body.endTime);
  });

  it("throws name_conflict on 409", async () => {
    const stub = stubFetch(
      json(409, {
        code: "name_conflict",
        message: "Names are unique per feature type.",
      }),
    );

    await assert.rejects(
      () => createAreaOfInterest(newAoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "name_conflict");
        return true;
      },
    );
  });

  it("throws payload_too_large on 413", async () => {
    const stub = stubFetch(
      json(413, { code: "payload_too_large", message: "Request body exceeded 1 MB." }),
    );

    await assert.rejects(
      () => createAreaOfInterest(newAoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 413);
        assert.equal(error.code, "payload_too_large");
        return true;
      },
    );
  });
});

describe("replaceAreaOfInterest", () => {
  it("PUTs a replace DTO", async () => {
    const stub = stubFetch(json(200, readAoi));

    await replaceAreaOfInterest(
      "9c4d2a",
      {
        name: "North Basin Search Sector",
        description: null,
        category: "Coverage",
        shape: polygon(closedRing),
        window: instant(new Date("2026-03-14T13:05:00Z")),
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.last.init.method, "PUT");
    assert.deepEqual(stub.body(), {
      name: "North Basin Search Sector",
      description: null,
      areaCategory: "Coverage",
      geometry: { type: "Polygon", coordinates: [exteriorRingDto] },
      startTime: "2026-03-14T13:05:00.000Z",
      endTime: "2026-03-14T13:05:00.000Z",
    });
  });

  it("clears the window when the replacement omits it", async () => {
    const stub = stubFetch(json(200, readAoi));

    await replaceAreaOfInterest("9c4d2a", newAoi, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("throws not_found when the feature is missing", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => replaceAreaOfInterest("9c4d2a", newAoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        return true;
      },
    );
  });
});

describe("deleteAreaOfInterest", () => {
  it("returns null on 204", async () => {
    const stub = stubFetch(json(204));

    const result = await deleteAreaOfInterest("9c4d2a", { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "DELETE");
    assert.equal(result, null);
  });

  it("throws on 404", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => deleteAreaOfInterest("9c4d2a", { fetch: stub.fetch }),
      ApiError,
    );
  });
});

describe("area category", () => {
  it("has no unspecified or other member", () => {
    assert.deepEqual(AREA_CATEGORIES, [
      "Restricted",
      "Search",
      "Staging",
      "Hazard",
      "Coverage",
    ]);
  });
});
