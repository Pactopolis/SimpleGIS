<script setup lang="ts">
import { computed } from "vue";

import DetailRows from "./DetailRows.vue";
import FeaturePanel from "./FeaturePanel.vue";

import { formatCoordinate, formatMoment } from "../formatting.ts";

import type { DetailRow } from "../types/display.ts";
import type { PointOfInterest } from "../types/features.ts";

const EMPTY = "—";

const props = defineProps<{ feature: PointOfInterest }>();
defineEmits<{ close: [] }>();

const rows = computed<DetailRow[]>(() => {
  const feature = props.feature;
  const window = feature.window;

  const rows: DetailRow[] = [
    { label: "Name", value: feature.name },
    { label: "Category", value: feature.category },
    { label: "Coordinates", value: formatCoordinate(feature.position) },
    { label: "Description", value: feature.description ?? EMPTY },
    { label: "Created", value: formatMoment(feature.createdAt) },
  ];

  if (feature.updatedAt !== null) {
    rows.push({ label: "Updated", value: formatMoment(feature.updatedAt) });
  }

  if (window !== null) {
    rows.push(
      { label: "Start", value: formatMoment(window.startTime) },
      { label: "End", value: formatMoment(window.endTime) },
    );
  }

  return rows;
});
</script>

<template>
  <FeaturePanel title="Point of interest" @close="$emit('close')">
    <DetailRows :rows="rows" />
  </FeaturePanel>
</template>
