import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_BASE_URL } from "./client.ts";
import {
  createCameraCone,
  deleteCameraCone,
  getCameraCone,
  listCameraCones,
  replaceCameraCone,
} from "./cameraCones.ts";
import { json, pageOf, stubFetch } from "./testSupport.ts";
import { CAMERA_TIER_SPECS } from "../types/enums.ts";

import type { NewCameraCone } from "../types/features.ts";

const readCamera = {
  id: "cam-17",
  featureType: "CameraCone" as const,
  name: "North Ridge Camera",
  description: "Tree-mounted camera.",
  cameraTier: "Mid" as const,
  headingDegrees: 12,
  pitchDegrees: -8,
  geometry: {
    type: "Point" as const,
    coordinates: [-106.447, 39.641, 3410] as [number, number, number],
  },
  typicalSpec: "4MP varifocal",
  hfovDegrees: 60,
  halfAngleDegrees: 30,
  distanceFromVertexMetres: 200,
  baseRadiusMetres: 115.5,
  createdAt: "2026-09-14T08:00:00Z",
  updatedAt: null,
  startTime: null,
  endTime: null,
};

const newCamera: NewCameraCone = {
  name: "North Ridge Camera",
  description: "Tree-mounted camera.",
  tier: "Mid",
  headingDegrees: 12,
  pitchDegrees: -8,
  position: { longitude: -106.447, latitude: 39.641, elevationMetres: 3410 },
};

describe("camera cones API", () => {
  it("keeps the supplied Low, Mid and High tier dimensions", () => {
    assert.deepEqual(CAMERA_TIER_SPECS, {
      Low: {
        typicalSpec: "1080p fixed wide lens",
        hfovDegrees: 90,
        halfAngleDegrees: 45,
        distanceFromVertexMetres: 50,
        baseRadiusMetres: 50,
      },
      Mid: {
        typicalSpec: "4MP varifocal",
        hfovDegrees: 60,
        halfAngleDegrees: 30,
        distanceFromVertexMetres: 200,
        baseRadiusMetres: 115.5,
      },
      High: {
        typicalSpec: "4K PTZ / long-range thermal",
        hfovDegrees: 15,
        halfAngleDegrees: 7.5,
        distanceFromVertexMetres: 1000,
        baseRadiusMetres: 131.7,
      },
    });
  });

  it("serializes the tier filter", async () => {
    const stub = stubFetch(json(200, pageOf([])));
    await listCameraCones({ tier: "High" }, { fetch: stub.fetch });

    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/camera-cones?cameraTier=High`);
  });

  it("maps the full tier specification into the domain feature", async () => {
    const stub = stubFetch(json(200, readCamera));
    const feature = await getCameraCone("cam-17", { fetch: stub.fetch });

    assert.equal(feature.tier, "Mid");
    assert.deepEqual(feature.position, {
      longitude: -106.447,
      latitude: 39.641,
      elevationMetres: 3410,
    });
    assert.equal(feature.typicalSpec, "4MP varifocal");
    assert.equal(feature.distanceFromVertexMetres, 200);
    assert.equal(feature.baseRadiusMetres, 115.5);
    assert.ok(feature.createdAt instanceof Date);
  });

  it("POSTs the point vertex, tier and orientation", async () => {
    const stub = stubFetch(json(201, readCamera));
    await createCameraCone(newCamera, { fetch: stub.fetch });

    assert.equal(stub.last.init.method, "POST");
    assert.deepEqual(stub.body(), {
      name: "North Ridge Camera",
      description: "Tree-mounted camera.",
      cameraTier: "Mid",
      headingDegrees: 12,
      pitchDegrees: -8,
      geometry: { type: "Point", coordinates: [-106.447, 39.641, 3410] },
      startTime: null,
      endTime: null,
    });
  });

  it("defaults omitted orientation angles to zero", async () => {
    const stub = stubFetch(json(201, readCamera));
    const { headingDegrees: _heading, pitchDegrees: _pitch, ...withoutAngles } = newCamera;
    await createCameraCone(withoutAngles, { fetch: stub.fetch });

    const body = stub.body() as { headingDegrees: number; pitchDegrees: number };
    assert.equal(body.headingDegrees, 0);
    assert.equal(body.pitchDegrees, 0);
  });

  it("uses PUT for replacement", async () => {
    const stub = stubFetch(json(200, readCamera));
    await replaceCameraCone("cam-17", newCamera, { fetch: stub.fetch });
    assert.equal(stub.last.init.method, "PUT");
    assert.equal(stub.last.url, `${DEFAULT_BASE_URL}/camera-cones/cam-17`);
  });

  it("uses DELETE for removal", async () => {
    const stub = stubFetch(json(204));
    assert.equal(await deleteCameraCone("cam-17", { fetch: stub.fetch }), null);
    assert.equal(stub.last.init.method, "DELETE");
  });
});
