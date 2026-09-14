<script setup lang="ts">
import { computed } from "vue";

import DetailRows from "./DetailRows.vue";
import FeaturePanel from "./FeaturePanel.vue";

import { formatCoordinate, formatLength, formatMoment } from "../formatting.ts";

import type { DetailRow } from "../types/display.ts";
import type { CameraCone } from "../types/features.ts";

const EMPTY = "—";
const props = defineProps<{ feature: CameraCone }>();
defineEmits<{ close: [] }>();

const rows = computed<DetailRow[]>(() => {
  const feature = props.feature;
  const rows: DetailRow[] = [
    { label: "Name", value: feature.name },
    { label: "Tier", value: feature.tier },
    { label: "Typical specification", value: feature.typicalSpec },
    { label: "Tree location", value: formatCoordinate(feature.position) },
    { label: "Heading", value: `${feature.headingDegrees}°` },
    { label: "Pitch", value: `${feature.pitchDegrees}°` },
    { label: "Horizontal FOV", value: `${feature.hfovDegrees}°` },
    { label: "Half angle", value: `${feature.halfAngleDegrees}°` },
    { label: "Range", value: formatLength(feature.distanceFromVertexMetres) },
    { label: "Base radius", value: formatLength(feature.baseRadiusMetres) },
    { label: "Description", value: feature.description ?? EMPTY },
    { label: "Created", value: formatMoment(feature.createdAt) },
  ];

  if (feature.updatedAt !== null) {
    rows.push({ label: "Updated", value: formatMoment(feature.updatedAt) });
  }
  if (feature.window !== null) {
    rows.push(
      { label: "Start", value: formatMoment(feature.window.startTime) },
      { label: "End", value: formatMoment(feature.window.endTime) },
    );
  }
  return rows;
});
</script>

<template>
  <FeaturePanel title="Camera cone" @close="$emit('close')">
    <DetailRows :rows="rows" />
  </FeaturePanel>
</template>
