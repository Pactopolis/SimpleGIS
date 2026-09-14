<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from "vue";

import EventWindowFields from "./EventWindowFields.vue";
import FeaturePanel from "./FeaturePanel.vue";
import FormAlert from "./FormAlert.vue";
import FormField from "./FormField.vue";

import { createCameraCone } from "../api/index.ts";
import { useFeatureSave } from "../composables/featureSave.ts";
import { formatCoordinate, formatLength } from "../formatting.ts";
import { CAMERA_TIERS, CAMERA_TIER_SPECS } from "../types/enums.ts";

import type { CameraTier } from "../types/enums.ts";
import type { CameraCone, TimeWindow } from "../types/features.ts";
import type { Coordinate } from "../types/geometry.ts";

interface Draft {
  name: string;
  description: string;
  tier: CameraTier;
  headingDegrees: number;
  pitchDegrees: number;
  isEvent: boolean;
  startTime: string;
  endTime: string;
}

const props = defineProps<{ position: Coordinate | null }>();
const emit = defineEmits<{ saved: [feature: CameraCone]; cancel: [] }>();

const draft = reactive<Draft>(emptyDraft());
const { pending, failure, run, abort, reset } = useFeatureSave<CameraCone>(
  "The camera cone could not be saved.",
);

onBeforeUnmount(abort);

const positionSummary = computed(() =>
  props.position === null ? null : formatCoordinate(props.position),
);
const tierSpec = computed(() => CAMERA_TIER_SPECS[draft.tier]);
const orientationValid = computed(
  () =>
    Number.isFinite(draft.headingDegrees) &&
    draft.headingDegrees >= 0 &&
    draft.headingDegrees < 360 &&
    Number.isFinite(draft.pitchDegrees) &&
    draft.pitchDegrees >= -90 &&
    draft.pitchDegrees <= 90,
);

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    tier: "Low",
    headingDegrees: 0,
    pitchDegrees: 0,
    isEvent: false,
    startTime: "",
    endTime: "",
  };
}

function windowOf(values: Draft): TimeWindow | null {
  if (!values.isEvent || values.startTime === "" || values.endTime === "") {
    return null;
  }
  return {
    startTime: new Date(values.startTime),
    endTime: new Date(values.endTime),
  };
}

async function save(): Promise<void> {
  const position = props.position;
  if (position === null || !orientationValid.value) return;

  const feature = await run((options) =>
    createCameraCone(
      {
        name: draft.name,
        description: draft.description === "" ? null : draft.description,
        tier: draft.tier,
        position,
        headingDegrees: draft.headingDegrees,
        pitchDegrees: draft.pitchDegrees,
        window: windowOf(draft),
      },
      options,
    ),
  );

  if (feature === null) return;
  Object.assign(draft, emptyDraft());
  emit("saved", feature);
}

function cancel(): void {
  reset();
  Object.assign(draft, emptyDraft());
  emit("cancel");
}
</script>

<template>
  <FeaturePanel title="Camera cone" @close="cancel">
    <FormField label="Tree location">
      <input
        class="coordinates"
        type="text"
        readonly
        :value="positionSummary ?? ''"
        placeholder="Click the map to place the camera."
      />
    </FormField>

    <FormField label="Name">
      <input v-model="draft.name" type="text" placeholder="North Ridge Camera" />
    </FormField>

    <FormField label="Description">
      <textarea v-model="draft.description" placeholder="Plain text only"></textarea>
    </FormField>

    <FormField label="Camera tier">
      <select v-model="draft.tier">
        <option v-for="tier in CAMERA_TIERS" :key="tier" :value="tier">
          {{ tier }} — {{ CAMERA_TIER_SPECS[tier].typicalSpec }}
        </option>
      </select>
    </FormField>

    <p class="spec">
      {{ tierSpec.hfovDegrees }}° HFOV · {{ formatLength(tierSpec.distanceFromVertexMetres) }}
      range · {{ formatLength(tierSpec.baseRadiusMetres) }} base radius
    </p>

    <div class="orientation">
      <FormField label="Heading" hint="0–359.9°, clockwise from north">
        <input v-model.number="draft.headingDegrees" type="number" min="0" max="359.9" step="0.1" />
      </FormField>
      <FormField label="Pitch" hint="−90–90°, positive is up">
        <input v-model.number="draft.pitchDegrees" type="number" min="-90" max="90" step="0.1" />
      </FormField>
    </div>

    <EventWindowFields
      v-model:enabled="draft.isEvent"
      v-model:start="draft.startTime"
      v-model:end="draft.endTime"
    />

    <FormAlert v-if="failure !== null">{{ failure }}</FormAlert>

    <template #actions>
      <button type="button" @click="cancel">Cancel</button>
      <button
        type="button"
        class="primary"
        :disabled="position === null || !orientationValid || pending"
        @click="save"
      >
        {{ pending ? "Saving…" : "Save" }}
      </button>
    </template>
  </FeaturePanel>
</template>

<style scoped>
.coordinates {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: #ededed;
  cursor: default;
}

.coordinates::placeholder {
  color: #666;
}

.spec {
  margin: 0;
  padding: 0.45rem;
  font-size: 0.72rem;
  line-height: 1.4;
  color: #555;
  background: #eef3f8;
  border-radius: 0.25rem;
}

.orientation {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
</style>
