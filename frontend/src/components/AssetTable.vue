<script setup lang="ts">
import { computed } from "vue";

import DataTable from "./DataTable.vue";

import {
  formatArea,
  formatFeatureClass,
  formatFeatureType,
  formatLength,
  formatMoment,
} from "../formatting.ts";
import { isClosed } from "../types/geometry.ts";

import type { TableColumn, TableRow } from "../types/display.ts";
import type { Feature } from "../types/features.ts";

const EMPTY = "—";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Name", wide: true },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "vertices", label: "Vertices", numeric: true },
  { key: "extent", label: "Extent", numeric: true },
  { key: "created", label: "Created" },
];

const props = defineProps<{ features: Feature[] }>();

const rows = computed<TableRow[]>(() => props.features.map(toRow));

function toRow(feature: Feature): TableRow {
  return {
    id: feature.id,
    cells: {
      name: feature.name,
      type: formatFeatureType(feature),
      category: formatFeatureClass(feature),
      vertices: String(vertexCount(feature)),
      extent: extentOf(feature),
      created: formatMoment(feature.createdAt),
    },
  };
}

function vertexCount(feature: Feature): number {
  if (feature.featureType === "PointOfInterest") {
    return 1;
  }

  if (feature.featureType === "TrailRoute") {
    return feature.path.length;
  }

  const ring = feature.shape.exteriorRing;

  return isClosed(ring) ? ring.length - 1 : ring.length;
}

function extentOf(feature: Feature): string {
  if (feature.featureType === "TrailRoute") {
    return feature.lengthMetres === null ? EMPTY : formatLength(feature.lengthMetres);
  }

  if (feature.featureType === "AreaOfInterest") {
    return feature.areaSquareMetres === null
      ? EMPTY
      : formatArea(feature.areaSquareMetres);
  }

  return EMPTY;
}
</script>

<template>
  <DataTable :columns="COLUMNS" :rows="rows" empty="No assets on the map." />
</template>
