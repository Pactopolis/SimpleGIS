import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AREAS_OF_INTEREST, POINTS_OF_INTEREST, TRAIL_ROUTES } from "./catalog.ts";
import { ApiError } from "./errors.ts";
import { FeatureStore } from "./store.ts";
import type { FeatureBody, ListQuery } from "./types.ts";

function poiBody(overrides: Partial<FeatureBody> = {}): FeatureBody {
  return {
    name: "Saddle Creek Overlook",
    description: null,
    category: "Observation",
    geometry: { type: "Point", coordinates: [-106.4453, 39.6403, 3421.5] },
    startTime: null,
    endTime: null,
    ...overrides,
  };
}

function aoiBody(overrides: Partial<FeatureBody> = {}): FeatureBody {
  return {
    name: "North Basin Search Sector",
    description: null,
    category: "Search",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
          [0, 0, 0],
        ],
      ],
    },
    startTime: null,
    endTime: null,
    ...overrides,
  };
}

function noFilters(): ListQuery {
  return { page: 1, pageSize: 50, nameContains: null, bbox: null, window: null, category: null };
}

describe("FeatureStore.create", () => {
  it("assigns an id and createdAt, and leaves updatedAt null", () => {
    const store = new FeatureStore();
    const feature = store.create(POINTS_OF_INTEREST, poiBody());

    assert.match(feature.id, /^[0-9a-f-]{36}$/);
    assert.ok(!Number.isNaN(Date.parse(feature.createdAt)));
    assert.equal(feature.updatedAt, null);
  });

  it("computes areaSquareMetres for an area of interest but not a point", () => {
    const store = new FeatureStore();
    const poi = store.create(POINTS_OF_INTEREST, poiBody());
    const aoi = store.create(AREAS_OF_INTEREST, aoiBody());

    assert.equal("areaSquareMetres" in poi, false);
    assert.equal(typeof aoi.areaSquareMetres, "number");
    assert.ok((aoi.areaSquareMetres as number) > 0);
  });

  it("rejects a duplicate name within the same collection", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody());

    assert.throws(
      () => store.create(POINTS_OF_INTEREST, poiBody()),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "name_conflict");
        return true;
      },
    );
  });

  it("allows the same name across different collections", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Shared Name" }));

    assert.doesNotThrow(() => store.create(AREAS_OF_INTEREST, aoiBody({ name: "Shared Name" })));
  });
});

describe("FeatureStore.get / delete", () => {
  it("throws not_found for a missing feature", () => {
    const store = new FeatureStore();

    assert.throws(
      () => store.get(POINTS_OF_INTEREST, "missing"),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        return true;
      },
    );
  });

  it("removes the feature so a subsequent get fails", () => {
    const store = new FeatureStore();
    const feature = store.create(POINTS_OF_INTEREST, poiBody());

    store.delete(POINTS_OF_INTEREST, feature.id);

    assert.throws(() => store.get(POINTS_OF_INTEREST, feature.id), ApiError);
  });

  it("throws not_found when deleting a missing feature", () => {
    const store = new FeatureStore();
    assert.throws(() => store.delete(POINTS_OF_INTEREST, "missing"), ApiError);
  });
});

describe("FeatureStore.replace", () => {
  it("preserves id and createdAt but sets a new updatedAt", () => {
    const store = new FeatureStore();
    const created = store.create(POINTS_OF_INTEREST, poiBody());

    const replaced = store.replace(POINTS_OF_INTEREST, created.id, poiBody({ category: "Hazard" }));

    assert.equal(replaced.id, created.id);
    assert.equal(replaced.createdAt, created.createdAt);
    assert.ok(replaced.updatedAt !== null);
    assert.equal(replaced.poiCategory, "Hazard");
  });

  it("allows replacing a feature with its own unchanged name", () => {
    const store = new FeatureStore();
    const created = store.create(POINTS_OF_INTEREST, poiBody());

    assert.doesNotThrow(() => store.replace(POINTS_OF_INTEREST, created.id, poiBody()));
  });

  it("rejects renaming onto another feature's name", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Taken" }));
    const other = store.create(POINTS_OF_INTEREST, poiBody({ name: "Other" }));

    assert.throws(
      () => store.replace(POINTS_OF_INTEREST, other.id, poiBody({ name: "Taken" })),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "name_conflict");
        return true;
      },
    );
  });

  it("throws not_found for a missing feature", () => {
    const store = new FeatureStore();
    assert.throws(() => store.replace(POINTS_OF_INTEREST, "missing", poiBody()), ApiError);
  });
});

describe("FeatureStore.list", () => {
  it("sorts results by creation order", () => {
    const store = new FeatureStore();
    const first = store.create(POINTS_OF_INTEREST, poiBody({ name: "First" }));
    const second = store.create(POINTS_OF_INTEREST, poiBody({ name: "Second" }));

    const [items] = store.list(POINTS_OF_INTEREST, noFilters());

    assert.deepEqual(
      items.map((item) => item.id),
      [first.id, second.id],
    );
  });

  it("paginates using page and pageSize", () => {
    const store = new FeatureStore();
    for (let index = 0; index < 5; index += 1) {
      store.create(POINTS_OF_INTEREST, poiBody({ name: `Point ${index}` }));
    }

    const [page1, total1] = store.list(POINTS_OF_INTEREST, { ...noFilters(), pageSize: 2 });
    const [page2] = store.list(POINTS_OF_INTEREST, { ...noFilters(), pageSize: 2, page: 2 });
    const [page3] = store.list(POINTS_OF_INTEREST, { ...noFilters(), pageSize: 2, page: 3 });

    assert.equal(total1, 5);
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
    assert.equal(page3.length, 1);
  });

  it("filters by case-insensitive nameContains", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Hanging Lake Overlook" }));
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Saddle Creek" }));

    const [items] = store.list(POINTS_OF_INTEREST, { ...noFilters(), nameContains: "lake" });

    assert.equal(items.length, 1);
    assert.equal(items[0]!.name, "Hanging Lake Overlook");
  });

  it("filters by category", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody({ category: "Hazard" }));
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Other", category: "Landmark" }));

    const [items] = store.list(POINTS_OF_INTEREST, { ...noFilters(), category: "Hazard" });

    assert.equal(items.length, 1);
    assert.equal(items[0]!.poiCategory, "Hazard");
  });

  it("filters by bounding-box intersection", () => {
    const store = new FeatureStore();
    const inside = store.create(
      POINTS_OF_INTEREST,
      poiBody({ name: "Inside", geometry: { type: "Point", coordinates: [-106.4, 39.6, 0] } }),
    );
    store.create(
      POINTS_OF_INTEREST,
      poiBody({ name: "Outside", geometry: { type: "Point", coordinates: [10, 10, 0] } }),
    );

    const [items] = store.list(POINTS_OF_INTEREST, {
      ...noFilters(),
      bbox: [-106.5, 39.5, -106.3, 39.7],
    });

    assert.deepEqual(
      items.map((item) => item.id),
      [inside.id],
    );
  });

  it("excludes untimed features when a window filter is supplied", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody({ name: "Untimed" }));
    store.create(
      POINTS_OF_INTEREST,
      poiBody({
        name: "Timed",
        startTime: new Date("2026-06-01T00:00:00Z"),
        endTime: new Date("2026-06-02T00:00:00Z"),
      }),
    );

    const [items] = store.list(POINTS_OF_INTEREST, {
      ...noFilters(),
      window: [new Date("2026-06-01T12:00:00Z"), new Date("2026-06-01T18:00:00Z")],
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]!.name, "Timed");
  });

  it("matches a timed feature whose window merely overlaps the query window", () => {
    const store = new FeatureStore();
    store.create(
      POINTS_OF_INTEREST,
      poiBody({
        startTime: new Date("2026-06-01T00:00:00Z"),
        endTime: new Date("2026-06-03T00:00:00Z"),
      }),
    );

    const [items] = store.list(POINTS_OF_INTEREST, {
      ...noFilters(),
      window: [new Date("2026-06-02T00:00:00Z"), new Date("2026-06-05T00:00:00Z")],
    });

    assert.equal(items.length, 1);
  });

  it("is scoped to a single collection", () => {
    const store = new FeatureStore();
    store.create(POINTS_OF_INTEREST, poiBody());
    store.create(AREAS_OF_INTEREST, aoiBody());

    const [poiItems] = store.list(POINTS_OF_INTEREST, noFilters());
    const [aoiItems] = store.list(TRAIL_ROUTES, noFilters());

    assert.equal(poiItems.length, 1);
    assert.equal(aoiItems.length, 0);
  });
});
