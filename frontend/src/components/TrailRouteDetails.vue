<script setup lang="ts">
import { computed } from "vue";

import DetailRows from "./DetailRows.vue";
import FeaturePanel from "./FeaturePanel.vue";

import { formatCoordinate, formatLength, formatMoment } from "../formatting.ts";

import type { DetailRow } from "../types/display.ts";
import type { TrailRoute } from "../types/features.ts";

const EMPTY = "—";

const props = defineProps<{ feature: TrailRoute }>();
defineEmits<{ close: [] }>();

const rows = computed<DetailRow[]>(() => {
  const feature = props.feature;
  const window = feature.window;

  const rows: DetailRow[] = [
    { label: "Name", value: feature.name },
    { label: "Difficulty", value: feature.difficulty },
    { label: "Vertices", value: String(feature.path.length) },
    {
      label: "Length",
      value: feature.lengthMetres === null ? EMPTY : formatLength(feature.lengthMetres),
    },
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

const coordinates = computed(() => props.feature.path.map(formatCoordinate));
</script>

<template>
  <FeaturePanel title="Trail route" @close="$emit('close')">
    <DetailRows :rows="rows" />

    <section class="path">
      <h3>Coordinates</h3>
      <ol>
        <li v-for="(coordinate, index) in coordinates" :key="index">{{ coordinate }}</li>
      </ol>
    </section>
  </FeaturePanel>
</template>

<style scoped>
.path {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

h3 {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
}

ol {
  max-height: 8rem;
  margin: 0;
  padding: 0.35rem 0.5rem;
  overflow-y: auto;
  list-style: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  color: #111;
  background: #ffffff;
  border: 1px solid #d6d6d6;
  border-radius: 0.3rem;
}
</style>
