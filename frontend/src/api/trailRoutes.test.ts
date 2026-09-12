import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, DEFAULT_BASE_URL } from "./client.ts";
import { json, pageOf, stubFetch } from "./testSupport.ts";
import {
  createTrailRoute,
  deleteTrailRoute,
  getTrailRoute,
  listTrailRoutes,
  replaceTrailRoute,
} from "./trailRoutes.ts";
import { instant, MIN_PATH_POSITIONS, TRAIL_DIFFICULTIES } from "../types/index.ts";
import type { NewTrailRoute } from "../types/features.ts";
import type { Coordinate, Path } from "../types/geometry.ts";

function at(longitude: number, latitude: number, elevationMetres: number): Coordinate {
  return { longitude, latitude, elevationMetres };
}

const path: Path = [
  at(-106.4501, 39.635, 3105),
  at(-106.4478, 39.6371, 3188),
  at(-106.4453, 39.6403, 3421.5),
];

const pathDto = [
  [-106.4501, 39.635, 3105],
  [-106.4478, 39.6371, 3188],
  [-106.4453, 39.6403, 3421.5],
];

const readTrail = {
  id: "5e8a71",
  featureType: "TrailRoute" as const,
  name: "Saddle Creek Approach",
  description: "Switchbacks above the creek crossing.",
  difficulty: "Moderate" as const,
  geometry: { type: "LineString" as const, coordinates: pathDto },
  lengthMetres: 4812.5,
  createdAt: "2026-02-08T11:02:44Z",
  updatedAt: null,
  startTime: null,
  endTime: null,
};

const newTrail: NewTrailRoute = {
  name: "Saddle Creek Approach",
  description: "Switchbacks above the creek crossing.",
  difficulty: "Moderate",
  path,
};

describe("listTrailRoutes", () => {
  it("sends no query string when no filters are supplied", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listTrailRoutes({}, { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/trail-routes`);
    assert.equal(stub.last.init.method, "GET");
  });

  it("serializes paging and name filters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listTrailRoutes(
      { page: 5, pageSize: 20, nameContains: "saddle" },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("page"), "5");
    assert.equal(stub.params().get("pageSize"), "20");
    assert.equal(stub.params().get("nameContains"), "saddle");
  });

  it("flattens a bounding box to minLon,minLat,maxLon,maxLat", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listTrailRoutes(
      {
        bbox: {
          minLongitude: -106.5,
          minLatitude: 39.6,
          maxLongitude: -106.4,
          maxLatitude: 39.7,
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("bbox"), "-106.5,39.6,-106.4,39.7");
  });

  it("filters on difficulty rather than a category parameter", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listTrailRoutes({ difficulty: "Expert" }, { fetch: stub.fetch });

    assert.equal(stub.params().get("difficulty"), "Expert");
    assert.equal(stub.params().get("category"), null);
    assert.equal(stub.params().get("trailDifficulty"), null);
  });

  it("sends an overlapping window as paired from and to parameters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listTrailRoutes(
      {
        overlapping: {
          startTime: new Date("2026-02-21T00:00:00Z"),
          endTime: new Date("2026-02-22T00:00:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("from"), "2026-02-21T00:00:00.000Z");
    assert.equal(stub.params().get("to"), "2026-02-22T00:00:00.000Z");
  });

  it("passes the paging envelope through unchanged", async () => {
    const stub = stubFetch(
      json(200, { page: 1, pageSize: 100, totalItems: 8, totalPages: 1, items: [] }),
    );

    const result = await listTrailRoutes({}, { fetch: stub.fetch });

    assert.deepEqual(result, {
      page: 1,
      pageSize: 100,
      totalItems: 8,
      totalPages: 1,
      items: [],
    });
  });

  it("maps items into domain objects", async () => {
    const stub = stubFetch(json(200, pageOf([readTrail])));

    const result = await listTrailRoutes({}, { fetch: stub.fetch });

    assert.deepEqual(result.items[0], {
      id: "5e8a71",
      featureType: "TrailRoute",
      name: "Saddle Creek Approach",
      description: "Switchbacks above the creek crossing.",
      difficulty: "Moderate",
      path,
      lengthMetres: 4812.5,
      createdAt: new Date("2026-02-08T11:02:44Z"),
      updatedAt: null,
      window: null,
    });
  });
});

describe("getTrailRoute", () => {
  it("requests the resource path", async () => {
    const stub = stubFetch(json(200, readTrail));

    await getTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/trail-routes/5e8a71`);
  });

  it("percent-encodes the identifier", async () => {
    const stub = stubFetch(json(200, readTrail));

    await getTrailRoute("a/b c", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/trail-routes/a%2Fb%20c`);
  });

  it("keeps positions in document order", async () => {
    const stub = stubFetch(json(200, readTrail));

    const result = await getTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.deepEqual(result.path.at(0), at(-106.4501, 39.635, 3105));
    assert.deepEqual(result.path.at(-1), at(-106.4453, 39.6403, 3421.5));
    assert.ok(result.path.length >= MIN_PATH_POSITIONS);
  });

  it("normalizes a missing description and length to null", async () => {
    const { description: _description, lengthMetres: _length, ...sparse } = readTrail;
    const stub = stubFetch(json(200, sparse));

    const result = await getTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.equal(result.description, null);
    assert.equal(result.lengthMetres, null);
  });

  it("maps the time bounds into a window of Date objects", async () => {
    const stub = stubFetch(
      json(200, {
        ...readTrail,
        updatedAt: "2026-02-19T07:30:00Z",
        startTime: "2026-02-21T15:00:00Z",
        endTime: "2026-02-21T21:45:00Z",
      }),
    );

    const result = await getTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.deepEqual(result.updatedAt, new Date("2026-02-19T07:30:00Z"));
    assert.deepEqual(result.window, {
      startTime: new Date("2026-02-21T15:00:00Z"),
      endTime: new Date("2026-02-21T21:45:00Z"),
    });
  });

  it("reports an untimed feature as a null window", async () => {
    const stub = stubFetch(json(200, readTrail));

    const result = await getTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.equal(result.window, null);
  });

  it("throws ApiError with code not_found on 404", async () => {
    const stub = stubFetch(
      json(404, { code: "not_found", message: "No such feature.", traceId: "t-4" }),
    );

    await assert.rejects(
      () => getTrailRoute("missing", { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        assert.equal(error.traceId, "t-4");
        return true;
      },
    );
  });
});

describe("createTrailRoute", () => {
  it("POSTs a write DTO with wire field names", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(newTrail, { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "POST");
    assert.deepEqual(stub.body(), {
      name: "Saddle Creek Approach",
      description: "Switchbacks above the creek crossing.",
      difficulty: "Moderate",
      geometry: { type: "LineString", coordinates: pathDto },
      startTime: null,
      endTime: null,
    });
  });

  it("sends a flat position array, not a ring array", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(newTrail, { fetch: stub.fetch });

    const body = stub.body() as { geometry: { coordinates: number[][] } };
    assert.deepEqual(body.geometry.coordinates[0], [-106.4501, 39.635, 3105]);
  });

  it("does not close the path", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(newTrail, { fetch: stub.fetch });

    const body = stub.body() as { geometry: { coordinates: number[][] } };
    assert.equal(body.geometry.coordinates.length, path.length);
    assert.notDeepEqual(
      body.geometry.coordinates.at(0),
      body.geometry.coordinates.at(-1),
    );
  });

  it("sends description as null when the caller omits it", async () => {
    const stub = stubFetch(json(201, readTrail));
    const { description: _omitted, ...withoutDescription } = newTrail;

    await createTrailRoute(withoutDescription, { fetch: stub.fetch });

    assert.equal((stub.body() as { description: unknown }).description, null);
  });

  it("sends both bounds as null when no window is supplied", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(newTrail, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("serializes a window as RFC 3339 timestamps", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(
      {
        ...newTrail,
        window: {
          startTime: new Date("2026-02-21T15:00:00Z"),
          endTime: new Date("2026-02-21T21:45:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, "2026-02-21T15:00:00.000Z");
    assert.equal(body.endTime, "2026-02-21T21:45:00.000Z");
  });

  it("expresses an instant as equal start and end times", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(
      { ...newTrail, window: instant(new Date("2026-02-21T15:00:00Z")) },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, body.endTime);
  });

  it("does not send the server-computed length", async () => {
    const stub = stubFetch(json(201, readTrail));

    await createTrailRoute(newTrail, { fetch: stub.fetch });

    assert.ok(!("lengthMetres" in (stub.body() as object)));
  });

  it("throws name_conflict on 409", async () => {
    const stub = stubFetch(
      json(409, {
        code: "name_conflict",
        message: "Names are unique per feature type.",
      }),
    );

    await assert.rejects(
      () => createTrailRoute(newTrail, { fetch: stub.fetch }),
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
      () => createTrailRoute(newTrail, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 413);
        assert.equal(error.code, "payload_too_large");
        return true;
      },
    );
  });
});

describe("replaceTrailRoute", () => {
  it("PUTs a replace DTO", async () => {
    const stub = stubFetch(json(200, readTrail));

    await replaceTrailRoute(
      "5e8a71",
      {
        name: "Saddle Creek Approach",
        description: null,
        difficulty: "Difficult",
        path,
        window: instant(new Date("2026-02-21T15:00:00Z")),
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.last.init.method, "PUT");
    assert.deepEqual(stub.body(), {
      name: "Saddle Creek Approach",
      description: null,
      difficulty: "Difficult",
      geometry: { type: "LineString", coordinates: pathDto },
      startTime: "2026-02-21T15:00:00.000Z",
      endTime: "2026-02-21T15:00:00.000Z",
    });
  });

  it("clears the window when the replacement omits it", async () => {
    const stub = stubFetch(json(200, readTrail));

    await replaceTrailRoute("5e8a71", newTrail, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("throws not_found when the feature is missing", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => replaceTrailRoute("5e8a71", newTrail, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        return true;
      },
    );
  });
});

describe("deleteTrailRoute", () => {
  it("returns null on 204", async () => {
    const stub = stubFetch(json(204));

    const result = await deleteTrailRoute("5e8a71", { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "DELETE");
    assert.equal(result, null);
  });

  it("throws on 404", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => deleteTrailRoute("5e8a71", { fetch: stub.fetch }),
      ApiError,
    );
  });
});

describe("trail difficulty", () => {
  it("has no unspecified or other member", () => {
    assert.deepEqual(TRAIL_DIFFICULTIES, ["Easy", "Moderate", "Difficult", "Expert"]);
  });
});
