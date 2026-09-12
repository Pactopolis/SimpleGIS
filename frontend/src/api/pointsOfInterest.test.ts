import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, DEFAULT_BASE_URL } from "./client.ts";
import {
  createPointOfInterest,
  deletePointOfInterest,
  getPointOfInterest,
  listPointsOfInterest,
  replacePointOfInterest,
} from "./pointsOfInterest.ts";
import { json, pageOf, stubFetch } from "./testSupport.ts";
import { instant, MAX_PAGE_SIZE, POI_CATEGORIES } from "../types/index.ts";
import type { NewPointOfInterest } from "../types/features.ts";

const readPoi = {
  id: "3f2b1c",
  featureType: "PointOfInterest" as const,
  name: "Hanging Lake Overlook",
  description: "Shelf above the lake.",
  poiCategory: "Landmark" as const,
  geometry: {
    type: "Point" as const,
    coordinates: [-107.1926, 39.6011, 2231.4] as [number, number, number],
  },
  createdAt: "2026-04-11T16:20:05Z",
  updatedAt: null,
  startTime: null,
  endTime: null,
};

const newPoi: NewPointOfInterest = {
  name: "Hanging Lake Overlook",
  description: "Shelf above the lake.",
  category: "Landmark",
  position: { longitude: -107.1926, latitude: 39.6011, elevationMetres: 2231.4 },
};

describe("listPointsOfInterest", () => {
  it("sends no query string when no filters are supplied", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest({}, { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/points-of-interest`);
    assert.equal(stub.last.init.method, "GET");
  });

  it("serializes paging and name filters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest(
      { page: 3, pageSize: 200, nameContains: "lake" },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("page"), "3");
    assert.equal(stub.params().get("pageSize"), "200");
    assert.equal(stub.params().get("nameContains"), "lake");
  });

  it("flattens a bounding box to minLon,minLat,maxLon,maxLat", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest(
      {
        bbox: {
          minLongitude: -107.5,
          minLatitude: 39.5,
          maxLongitude: -107,
          maxLatitude: 39.8,
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("bbox"), "-107.5,39.5,-107,39.8");
  });

  it("maps the domain category field onto the poiCategory parameter", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest({ category: "Hazard" }, { fetch: stub.fetch });

    assert.equal(stub.params().get("poiCategory"), "Hazard");
    assert.equal(stub.params().get("category"), null);
  });

  it("sends an overlapping window as paired from and to parameters", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest(
      {
        overlapping: {
          startTime: new Date("2026-06-01T00:00:00Z"),
          endTime: new Date("2026-06-02T00:00:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.params().get("from"), "2026-06-01T00:00:00.000Z");
    assert.equal(stub.params().get("to"), "2026-06-02T00:00:00.000Z");
  });

  it("sends neither bound when no window filter is supplied", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest({ category: "Hazard" }, { fetch: stub.fetch });

    assert.equal(stub.params().get("from"), null);
    assert.equal(stub.params().get("to"), null);
  });

  it("passes the paging envelope through unchanged", async () => {
    const stub = stubFetch(
      json(200, { page: 2, pageSize: 25, totalItems: 61, totalPages: 3, items: [] }),
    );

    const result = await listPointsOfInterest({}, { fetch: stub.fetch });

    assert.deepEqual(result, {
      page: 2,
      pageSize: 25,
      totalItems: 61,
      totalPages: 3,
      items: [],
    });
  });

  it("maps items into domain objects", async () => {
    const stub = stubFetch(json(200, pageOf([readPoi])));

    const result = await listPointsOfInterest({}, { fetch: stub.fetch });

    assert.deepEqual(result.items[0], {
      id: "3f2b1c",
      featureType: "PointOfInterest",
      name: "Hanging Lake Overlook",
      description: "Shelf above the lake.",
      category: "Landmark",
      position: { longitude: -107.1926, latitude: 39.6011, elevationMetres: 2231.4 },
      createdAt: new Date("2026-04-11T16:20:05Z"),
      updatedAt: null,
      window: null,
    });
  });
});

describe("getPointOfInterest", () => {
  it("requests the resource path", async () => {
    const stub = stubFetch(json(200, readPoi));

    await getPointOfInterest("3f2b1c", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/points-of-interest/3f2b1c`);
  });

  it("percent-encodes the identifier", async () => {
    const stub = stubFetch(json(200, readPoi));

    await getPointOfInterest("a/b c", { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/points-of-interest/a%2Fb%20c`);
  });

  it("normalizes a missing description to null", async () => {
    const { description: _omitted, ...withoutDescription } = readPoi;
    const stub = stubFetch(json(200, withoutDescription));

    const result = await getPointOfInterest("3f2b1c", { fetch: stub.fetch });

    assert.equal(result.description, null);
  });

  it("maps the time bounds into a window of Date objects", async () => {
    const stub = stubFetch(
      json(200, {
        ...readPoi,
        updatedAt: "2026-05-02T09:00:00Z",
        startTime: "2026-06-01T14:00:00Z",
        endTime: "2026-06-01T18:30:00Z",
      }),
    );

    const result = await getPointOfInterest("3f2b1c", { fetch: stub.fetch });

    assert.deepEqual(result.updatedAt, new Date("2026-05-02T09:00:00Z"));
    assert.deepEqual(result.window, {
      startTime: new Date("2026-06-01T14:00:00Z"),
      endTime: new Date("2026-06-01T18:30:00Z"),
    });
  });

  it("reports an untimed feature as a null window", async () => {
    const stub = stubFetch(json(200, readPoi));

    const result = await getPointOfInterest("3f2b1c", { fetch: stub.fetch });

    assert.equal(result.window, null);
  });

  it("throws ApiError with code not_found on 404", async () => {
    const stub = stubFetch(
      json(404, { code: "not_found", message: "No such feature.", traceId: "t-1" }),
    );

    await assert.rejects(
      () => getPointOfInterest("missing", { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        assert.equal(error.traceId, "t-1");
        assert.equal(error.message, "No such feature.");
        return true;
      },
    );
  });
});

describe("createPointOfInterest", () => {
  it("POSTs a write DTO with wire field names", async () => {
    const stub = stubFetch(json(201, readPoi));

    await createPointOfInterest(newPoi, { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "POST");
    assert.deepEqual(stub.body(), {
      name: "Hanging Lake Overlook",
      description: "Shelf above the lake.",
      poiCategory: "Landmark",
      geometry: { type: "Point", coordinates: [-107.1926, 39.6011, 2231.4] },
      startTime: null,
      endTime: null,
    });
  });

  it("orders coordinates longitude, latitude, elevation", async () => {
    const stub = stubFetch(json(201, readPoi));

    await createPointOfInterest(
      { ...newPoi, position: { longitude: -1, latitude: 2, elevationMetres: 3 } },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { geometry: { coordinates: number[] } };
    assert.deepEqual(body.geometry.coordinates, [-1, 2, 3]);
  });

  it("sends description as null when the caller omits it", async () => {
    const stub = stubFetch(json(201, readPoi));
    const { description: _omitted, ...withoutDescription } = newPoi;

    await createPointOfInterest(withoutDescription, { fetch: stub.fetch });

    assert.equal((stub.body() as { description: unknown }).description, null);
  });

  it("sends both bounds as null when no window is supplied", async () => {
    const stub = stubFetch(json(201, readPoi));

    await createPointOfInterest(newPoi, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("serializes a window as RFC 3339 timestamps", async () => {
    const stub = stubFetch(json(201, readPoi));

    await createPointOfInterest(
      {
        ...newPoi,
        window: {
          startTime: new Date("2026-06-01T14:00:00Z"),
          endTime: new Date("2026-06-01T18:30:00Z"),
        },
      },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, "2026-06-01T14:00:00.000Z");
    assert.equal(body.endTime, "2026-06-01T18:30:00.000Z");
  });

  it("expresses an instant as equal start and end times", async () => {
    const stub = stubFetch(json(201, readPoi));

    await createPointOfInterest(
      { ...newPoi, window: instant(new Date("2026-06-01T14:00:00Z")) },
      { fetch: stub.fetch },
    );

    const body = stub.body() as { startTime: string; endTime: string };
    assert.equal(body.startTime, body.endTime);
  });

  it("sets Content-Type only when there is a body", async () => {
    const stub = stubFetch(json(201, readPoi), json(200, pageOf([])));

    await createPointOfInterest(newPoi, { fetch: stub.fetch });
    const posted = stub.headers();

    await listPointsOfInterest({}, { fetch: stub.fetch });
    const listed = stub.headers();

    assert.equal(posted["Content-Type"], "application/json");
    assert.equal(posted["Accept"], "application/json");
    assert.equal(listed["Content-Type"], undefined);
    assert.equal(listed["Accept"], "application/json");
  });

  it("throws name_conflict on 409", async () => {
    const stub = stubFetch(
      json(409, {
        code: "name_conflict",
        message: "Names are unique per feature type.",
      }),
    );

    await assert.rejects(
      () => createPointOfInterest(newPoi, { fetch: stub.fetch }),
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
      () => createPointOfInterest(newPoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 413);
        assert.equal(error.code, "payload_too_large");
        return true;
      },
    );
  });

  it("surfaces unknown_property on 400", async () => {
    const stub = stubFetch(
      json(400, { code: "unknown_property", message: "Unknown property 'colour'." }),
    );

    await assert.rejects(
      () => createPointOfInterest(newPoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "unknown_property");
        return true;
      },
    );
  });
});

describe("replacePointOfInterest", () => {
  it("PUTs a replace DTO", async () => {
    const stub = stubFetch(json(200, readPoi));

    await replacePointOfInterest(
      "3f2b1c",
      {
        name: "Hanging Lake Overlook",
        description: null,
        category: "Waypoint",
        position: { longitude: -107.19, latitude: 39.6, elevationMetres: 2230 },
        window: instant(new Date("2026-06-01T14:00:00Z")),
      },
      { fetch: stub.fetch },
    );

    assert.equal(stub.last.init.method, "PUT");
    assert.deepEqual(stub.body(), {
      name: "Hanging Lake Overlook",
      description: null,
      poiCategory: "Waypoint",
      geometry: { type: "Point", coordinates: [-107.19, 39.6, 2230] },
      startTime: "2026-06-01T14:00:00.000Z",
      endTime: "2026-06-01T14:00:00.000Z",
    });
  });

  it("clears the window when the replacement omits it", async () => {
    const stub = stubFetch(json(200, readPoi));

    await replacePointOfInterest("3f2b1c", newPoi, { fetch: stub.fetch });

    const body = stub.body() as { startTime: unknown; endTime: unknown };
    assert.equal(body.startTime, null);
    assert.equal(body.endTime, null);
  });

  it("throws not_found when the feature is missing", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => replacePointOfInterest("3f2b1c", newPoi, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        return true;
      },
    );
  });
});

describe("deletePointOfInterest", () => {
  it("returns null on 204", async () => {
    const stub = stubFetch(json(204));

    const result = await deletePointOfInterest("3f2b1c", { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "DELETE");
    assert.equal(result, null);
  });

  it("throws on 404", async () => {
    const stub = stubFetch(json(404, { code: "not_found", message: "No such feature." }));

    await assert.rejects(
      () => deletePointOfInterest("3f2b1c", { fetch: stub.fetch }),
      ApiError,
    );
  });
});

describe("transport", () => {
  it("honours a base URL override", async () => {
    const stub = stubFetch(json(200, pageOf([])));

    await listPointsOfInterest(
      {},
      { fetch: stub.fetch, baseUrl: "https://api.staging.ridgeline.trailblazers.com/v1" },
    );

    assert.equal(
      stub.last.url,
      "https://api.staging.ridgeline.trailblazers.com/v1/points-of-interest",
    );
  });

  it("forwards an abort signal", async () => {
    const stub = stubFetch(json(200, pageOf([])));
    const controller = new AbortController();

    await listPointsOfInterest({}, { fetch: stub.fetch, signal: controller.signal });

    assert.equal(stub.last.init.signal, controller.signal);
  });

  it("keeps a non-JSON error body as the payload", async () => {
    const stub = stubFetch(new Response("<html>502</html>", { status: 502 }));

    await assert.rejects(
      () => listPointsOfInterest({}, { fetch: stub.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, null);
        assert.equal(error.payload, "<html>502</html>");
        assert.equal(error.message, "Request failed with status 502");
        return true;
      },
    );
  });
});

describe("spec constants", () => {
  it("has no unspecified or other poi category member", () => {
    assert.deepEqual(POI_CATEGORIES, [
      "Landmark",
      "Hazard",
      "Waypoint",
      "Facility",
      "Observation",
    ]);
  });

  it("caps pageSize at 200", () => {
    assert.equal(MAX_PAGE_SIZE, 200);
  });
});
