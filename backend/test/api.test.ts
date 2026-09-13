// End-to-end HTTP tests against the real server (no mocked transport), one
// level below the frontend contract tests in contract.test.ts.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { AddressInfo } from "node:net";

import { createApp } from "../src/app.ts";
import { FeatureStore } from "../src/store.ts";
import type { Collection } from "../src/catalog.ts";
import { AREAS_OF_INTEREST, POINTS_OF_INTEREST, TRAIL_ROUTES } from "../src/catalog.ts";

let baseUrl: string;
const server = createApp(new FeatureStore());

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/v1`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface JsonResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

async function call(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<JsonResponse> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body: BodyInit | undefined;

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const response = await fetch(`${baseUrl}${path}`, { ...rest, headers, body });
  const text = await response.text();

  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

const fixtures: Record<
  string,
  { collection: Collection; write: Record<string, unknown>; secondWrite: Record<string, unknown> }
> = {
  "points-of-interest": {
    collection: POINTS_OF_INTEREST,
    write: {
      name: "Saddle Creek Overlook",
      poiCategory: "Observation",
      geometry: { type: "Point", coordinates: [-106.4453, 39.6403, 3421.5] },
    },
    secondWrite: {
      name: "Saddle Creek Overlook",
      poiCategory: "Hazard",
      geometry: { type: "Point", coordinates: [-106.4453, 39.6403, 3421.5] },
    },
  },
  "areas-of-interest": {
    collection: AREAS_OF_INTEREST,
    write: {
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
    },
    secondWrite: {
      name: "North Basin Search Sector",
      areaCategory: "Coverage",
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
    },
  },
  "trail-routes": {
    collection: TRAIL_ROUTES,
    write: {
      name: "Saddle Creek Approach",
      difficulty: "Moderate",
      geometry: {
        type: "LineString",
        coordinates: [
          [-106.4501, 39.635, 3105],
          [-106.4478, 39.6371, 3188],
          [-106.4453, 39.6403, 3421.5],
        ],
      },
    },
    secondWrite: {
      name: "Saddle Creek Approach",
      difficulty: "Expert",
      geometry: {
        type: "LineString",
        coordinates: [
          [-106.4501, 39.635, 3105],
          [-106.4478, 39.6371, 3188],
        ],
      },
    },
  },
};

for (const [path, fixture] of Object.entries(fixtures)) {
  describe(`/${path}`, () => {
    it("supports the full create/read/update/delete lifecycle", async () => {
      const created = await call(`/${path}`, { method: "POST", json: fixture.write });

      assert.equal(created.status, 201);
      assert.match(created.headers.get("location") ?? "", new RegExp(`/v1/${path}/`));
      const body = created.body as { id: string; createdAt: string; updatedAt: unknown };
      assert.ok(body.id);
      assert.equal(body.updatedAt, null);

      const fetched = await call(`/${path}/${body.id}`);
      assert.equal(fetched.status, 200);
      assert.deepEqual(fetched.body, created.body);

      const replaced = await call(`/${path}/${body.id}`, { method: "PUT", json: fixture.secondWrite });
      assert.equal(replaced.status, 200);
      const replacedBody = replaced.body as { id: string; createdAt: string; updatedAt: string | null };
      assert.equal(replacedBody.id, body.id);
      assert.equal(replacedBody.createdAt, body.createdAt);
      assert.ok(replacedBody.updatedAt !== null);

      const listed = await call(`/${path}`);
      assert.equal(listed.status, 200);
      const page = listed.body as { items: Array<{ id: string }>; totalItems: number };
      assert.equal(page.totalItems, 1);
      assert.equal(page.items[0]!.id, body.id);

      const deleted = await call(`/${path}/${body.id}`, { method: "DELETE" });
      assert.equal(deleted.status, 204);
      assert.equal(deleted.body, null);

      const afterDelete = await call(`/${path}/${body.id}`);
      assert.equal(afterDelete.status, 404);
      assert.equal((afterDelete.body as { code: string }).code, "not_found");
    });

    it("returns 409 name_conflict for a duplicate name", async () => {
      const first = await call(`/${path}`, { method: "POST", json: fixture.write });
      assert.equal(first.status, 201);

      const duplicate = await call(`/${path}`, { method: "POST", json: fixture.write });
      assert.equal(duplicate.status, 409);
      assert.equal((duplicate.body as { code: string }).code, "name_conflict");

      await call(`/${path}/${(first.body as { id: string }).id}`, { method: "DELETE" });
    });

    it("returns 400 array_body_not_supported for an array body", async () => {
      const response = await call(`/${path}`, { method: "POST", json: [fixture.write] });
      assert.equal(response.status, 400);
      assert.equal((response.body as { code: string }).code, "array_body_not_supported");
    });

    it("returns 400 unknown_property for an unexpected field", async () => {
      const response = await call(`/${path}`, {
        method: "POST",
        json: { ...fixture.write, extra: true },
      });
      assert.equal(response.status, 400);
      assert.equal((response.body as { code: string }).code, "unknown_property");
    });

    it("returns 400 invalid_query_parameter for a bad filter", async () => {
      const response = await call(`/${path}?pageSize=0`);
      assert.equal(response.status, 400);
      assert.equal((response.body as { code: string }).code, "invalid_query_parameter");
    });

    it("returns 404 not_found for a missing feature", async () => {
      const response = await call(`/${path}/00000000-0000-0000-0000-000000000000`);
      assert.equal(response.status, 404);
      assert.equal((response.body as { code: string }).code, "not_found");
    });

    it("computes the server-assigned measurement field", async () => {
      const created = await call(`/${path}`, { method: "POST", json: fixture.write });
      const measurementField = fixture.collection.measurementField;

      if (measurementField === null) {
        assert.equal(measurementField in (created.body as object), false);
      } else {
        assert.equal(typeof (created.body as Record<string, unknown>)[measurementField], "number");
      }
    });
  });
}

describe("routing", () => {
  it("returns 404 for an unknown collection", async () => {
    const response = await call("/unknown-things");
    assert.equal(response.status, 404);
  });

  it("returns 404 for a path nested beyond a feature id", async () => {
    const response = await call("/points-of-interest/abc/extra");
    assert.equal(response.status, 404);
  });

  it("returns 405 with an Allow header for an unsupported method on a collection", async () => {
    const response = await call("/points-of-interest", { method: "PATCH" });
    assert.equal(response.status, 405);
    assert.ok(response.headers.get("allow")?.includes("GET"));
  });

  it("returns 405 with an Allow header for an unsupported method on a feature", async () => {
    const response = await call("/points-of-interest/some-id", { method: "PATCH" });
    assert.equal(response.status, 405);
    assert.ok(response.headers.get("allow")?.includes("DELETE"));
  });
});

describe("request body handling", () => {
  it("returns 400 malformed_body for invalid JSON", async () => {
    const response = await fetch(`${baseUrl}/points-of-interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const body = (await response.json()) as { code: string };

    assert.equal(response.status, 400);
    assert.equal(body.code, "malformed_body");
  });

  it("returns 400 malformed_body for an empty POST body", async () => {
    const response = await fetch(`${baseUrl}/points-of-interest`, { method: "POST" });
    const body = (await response.json()) as { code: string };

    assert.equal(response.status, 400);
    assert.equal(body.code, "malformed_body");
  });

  it("returns 413 payload_too_large for a body over 1 MB", async () => {
    const oversized = "x".repeat(1_048_577);
    const response = await fetch(`${baseUrl}/points-of-interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Oversized",
        poiCategory: "Landmark",
        description: oversized,
        geometry: { type: "Point", coordinates: [0, 0, 0] },
      }),
    });
    const body = (await response.json()) as { code: string };

    assert.equal(response.status, 413);
    assert.equal(body.code, "payload_too_large");
  });
});

describe("CORS", () => {
  it("echoes the Origin header and exposes Location on every response", async () => {
    const response = await call("/points-of-interest", { headers: { Origin: "https://example.test" } });

    assert.equal(response.headers.get("access-control-allow-origin"), "https://example.test");
    assert.equal(response.headers.get("access-control-expose-headers"), "Location");
  });

  it("answers an OPTIONS preflight for a collection", async () => {
    const response = await fetch(`${baseUrl}/points-of-interest`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.test",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    const allowed = response.headers.get("access-control-allow-methods") ?? "";
    assert.ok(allowed.includes("GET"));
    assert.ok(allowed.includes("POST"));
    assert.ok(!allowed.includes("DELETE"));
  });

  it("answers an OPTIONS preflight for a feature", async () => {
    const response = await fetch(`${baseUrl}/points-of-interest/some-id`, { method: "OPTIONS" });

    assert.equal(response.status, 204);
    const allowed = response.headers.get("access-control-allow-methods") ?? "";
    assert.ok(allowed.includes("PUT"));
    assert.ok(allowed.includes("DELETE"));
    assert.ok(!allowed.includes("POST"));
  });
});
