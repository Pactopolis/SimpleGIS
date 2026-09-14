// Runs the frontend's real API client (unmodified, unmocked fetch) against
// this backend to verify the two actually agree on the wire contract — not
// just that both separately claim to implement openapi.yaml.
//
// If the frontend's api/ module changes its request or response shapes, this
// file starts failing before the browser does.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { AddressInfo } from "node:net";

import { createApp } from "../src/app.ts";
import { FeatureStore } from "../src/store.ts";

import { ApiError } from "../../frontend/src/api/client.ts";
import {
  createAreaOfInterest,
  deleteAreaOfInterest,
  getAreaOfInterest,
  listAreasOfInterest,
  replaceAreaOfInterest,
} from "../../frontend/src/api/areasOfInterest.ts";
import {
  createPointOfInterest,
  deletePointOfInterest,
  getPointOfInterest,
  listPointsOfInterest,
  replacePointOfInterest,
} from "../../frontend/src/api/pointsOfInterest.ts";
import {
  createTrailRoute,
  deleteTrailRoute,
  getTrailRoute,
  listTrailRoutes,
  replaceTrailRoute,
} from "../../frontend/src/api/trailRoutes.ts";
import {
  createCameraCone,
  deleteCameraCone,
  getCameraCone,
  listCameraCones,
  replaceCameraCone,
} from "../../frontend/src/api/cameraCones.ts";
import { polygon } from "../../frontend/src/types/geometry.ts";

import type { CallOptions } from "../../frontend/src/api/resources.ts";
import type { Coordinate, Ring } from "../../frontend/src/types/geometry.ts";

let options: CallOptions;
const server = createApp(new FeatureStore());

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  options = { baseUrl: `http://127.0.0.1:${port}/v1` };
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function at(longitude: number, latitude: number, elevationMetres: number): Coordinate {
  return { longitude, latitude, elevationMetres };
}

describe("points of interest, through the frontend client", () => {
  it("round-trips a create, read, list, replace and delete", async () => {
    const created = await createPointOfInterest(
      {
        name: "Contract Test Overlook",
        description: "Created by the backend contract test.",
        category: "Observation",
        position: at(-106.4453, 39.6403, 3421.5),
      },
      options,
    );

    assert.equal(created.featureType, "PointOfInterest");
    assert.equal(created.name, "Contract Test Overlook");
    assert.equal(created.category, "Observation");
    assert.deepEqual(created.position, at(-106.4453, 39.6403, 3421.5));
    assert.ok(created.createdAt instanceof Date);
    assert.equal(created.updatedAt, null);
    assert.equal(created.window, null);

    const fetched = await getPointOfInterest(created.id, options);
    assert.deepEqual(fetched, created);

    const page = await listPointsOfInterest({ nameContains: "Contract Test" }, options);
    assert.equal(page.totalItems, 1);
    assert.deepEqual(page.items[0], created);

    const byCategory = await listPointsOfInterest({ category: "Hazard" }, options);
    assert.equal(byCategory.items.some((item) => item.id === created.id), false);

    const replaced = await replacePointOfInterest(
      created.id,
      {
        name: "Contract Test Overlook",
        category: "Hazard",
        position: at(-106.4453, 39.6403, 3421.5),
        window: {
          startTime: new Date("2026-06-01T14:00:00Z"),
          endTime: new Date("2026-06-01T18:00:00Z"),
        },
      },
      options,
    );

    assert.equal(replaced.category, "Hazard");
    assert.deepEqual(replaced.window, {
      startTime: new Date("2026-06-01T14:00:00Z"),
      endTime: new Date("2026-06-01T18:00:00Z"),
    });
    assert.ok(replaced.updatedAt instanceof Date);

    await deletePointOfInterest(created.id, options);

    await assert.rejects(
      () => getPointOfInterest(created.id, options),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        return true;
      },
    );
  });

  it("surfaces a 409 as an ApiError with code name_conflict", async () => {
    await createPointOfInterest(
      {
        name: "Duplicate Name",
        category: "Landmark",
        position: at(0, 0, 0),
      },
      options,
    );

    await assert.rejects(
      () =>
        createPointOfInterest(
          { name: "Duplicate Name", category: "Landmark", position: at(1, 1, 0) },
          options,
        ),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "name_conflict");
        return true;
      },
    );
  });

  it("finds features inside a bounding box filter", async () => {
    const inside = await createPointOfInterest(
      { name: "Inside Bbox", category: "Waypoint", position: at(-106.4, 39.6, 0) },
      options,
    );
    await createPointOfInterest(
      { name: "Outside Bbox", category: "Waypoint", position: at(50, 50, 0) },
      options,
    );

    const page = await listPointsOfInterest(
      {
        bbox: { minLongitude: -107, minLatitude: 39, maxLongitude: -106, maxLatitude: 40 },
      },
      options,
    );

    assert.ok(page.items.some((item) => item.id === inside.id));
    assert.equal(
      page.items.some((item) => item.name === "Outside Bbox"),
      false,
    );
  });
});

describe("areas of interest, through the frontend client", () => {
  const ring: Ring = [
    at(-106.46, 39.64, 3200),
    at(-106.44, 39.64, 3210),
    at(-106.44, 39.66, 3260),
    at(-106.46, 39.66, 3240),
  ];

  it("closes an open ring client-side and computes area server-side", async () => {
    const created = await createAreaOfInterest(
      {
        name: "Contract Test Sector",
        category: "Search",
        shape: polygon(ring),
      },
      options,
    );

    assert.equal(created.shape.exteriorRing.length, ring.length + 1);
    assert.deepEqual(created.shape.exteriorRing.at(0), created.shape.exteriorRing.at(-1));
    assert.equal(typeof created.areaSquareMetres, "number");
    assert.ok((created.areaSquareMetres ?? 0) > 0);

    const fetched = await getAreaOfInterest(created.id, options);
    assert.deepEqual(fetched.shape, created.shape);

    await deleteAreaOfInterest(created.id, options);
  });

  it("splits interior rings (holes) from the exterior ring on read", async () => {
    const hole: Ring = [
      at(-106.455, 39.645, 3205),
      at(-106.45, 39.645, 3208),
      at(-106.45, 39.65, 3212),
    ];

    const created = await createAreaOfInterest(
      { name: "Sector With Hole", category: "Coverage", shape: polygon(ring, [hole]) },
      options,
    );

    assert.equal(created.shape.interiorRings.length, 1);
    assert.equal(created.shape.interiorRings[0]!.length, hole.length + 1);

    const replaced = await replaceAreaOfInterest(
      created.id,
      { name: "Sector With Hole", category: "Restricted", shape: polygon(ring) },
      options,
    );

    assert.equal(replaced.shape.interiorRings.length, 0);
    assert.equal(replaced.category, "Restricted");
  });
});

describe("trail routes, through the frontend client", () => {
  const path = [
    at(-106.4501, 39.635, 3105),
    at(-106.4478, 39.6371, 3188),
    at(-106.4453, 39.6403, 3421.5),
  ];

  it("does not close the path and computes length server-side", async () => {
    const created = await createTrailRoute(
      { name: "Contract Test Trail", difficulty: "Moderate", path },
      options,
    );

    assert.deepEqual(created.path, path);
    assert.equal(typeof created.lengthMetres, "number");
    assert.ok((created.lengthMetres ?? 0) > 0);

    const filtered = await listTrailRoutes({ difficulty: "Expert" }, options);
    assert.equal(
      filtered.items.some((item) => item.id === created.id),
      false,
    );

    const replaced = await replaceTrailRoute(
      created.id,
      { name: "Contract Test Trail", difficulty: "Expert", path },
      options,
    );
    assert.equal(replaced.difficulty, "Expert");

    await deleteTrailRoute(created.id, options);

    await assert.rejects(() => getTrailRoute(created.id, options), ApiError);
  });
});

describe("camera cones, through the frontend client", () => {
  it("round-trips the camera tier, orientation and canonical cone dimensions", async () => {
    const position = at(-106.447, 39.641, 3410);
    const created = await createCameraCone(
      {
        name: "Contract Test Camera",
        description: "Tree-mounted camera.",
        tier: "Low",
        position,
        headingDegrees: 24,
        pitchDegrees: -6,
      },
      options,
    );

    assert.equal(created.featureType, "CameraCone");
    assert.equal(created.tier, "Low");
    assert.deepEqual(created.position, position);
    assert.equal(created.headingDegrees, 24);
    assert.equal(created.pitchDegrees, -6);
    assert.equal(created.typicalSpec, "1080p fixed wide lens");
    assert.equal(created.hfovDegrees, 90);
    assert.equal(created.halfAngleDegrees, 45);
    assert.equal(created.distanceFromVertexMetres, 50);
    assert.equal(created.baseRadiusMetres, 50);

    assert.deepEqual(await getCameraCone(created.id, options), created);

    const filtered = await listCameraCones({ tier: "High" }, options);
    assert.equal(filtered.items.some((camera) => camera.id === created.id), false);

    const replaced = await replaceCameraCone(
      created.id,
      { name: "Contract Test Camera", tier: "High", position },
      options,
    );
    assert.equal(replaced.tier, "High");
    assert.equal(replaced.headingDegrees, 0);
    assert.equal(replaced.pitchDegrees, 0);
    assert.equal(replaced.distanceFromVertexMetres, 1000);
    assert.equal(replaced.baseRadiusMetres, 131.7);

    await deleteCameraCone(created.id, options);
    await assert.rejects(() => getCameraCone(created.id, options), ApiError);
  });
});
