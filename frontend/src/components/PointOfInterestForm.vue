<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from "vue";

import EventWindowFields from "./EventWindowFields.vue";
import FeaturePanel from "./FeaturePanel.vue";
import FormAlert from "./FormAlert.vue";
import FormField from "./FormField.vue";

import { createPointOfInterest } from "../api/index.ts";
import { useFeatureSave } from "../composables/featureSave.ts";
import { formatCoordinate } from "../formatting.ts";
import { POI_CATEGORIES } from "../types/enums.ts";

import type { PoiCategory } from "../types/enums.ts";
import type { PointOfInterest, TimeWindow } from "../types/features.ts";
import type { Coordinate } from "../types/geometry.ts";

const DEFAULT_CATEGORY: PoiCategory = "Landmark";

interface Draft {
  name: string;
  description: string;
  category: PoiCategory;
  isEvent: boolean;
  startTime: string;
  endTime: string;
}

const props = defineProps<{ position: Coordinate | null }>();
const emit = defineEmits<{ saved: [feature: PointOfInterest]; cancel: [] }>();

const draft = reactive<Draft>(emptyDraft());
const { pending, failure, run, abort, reset } = useFeatureSave<PointOfInterest>(
  "The point could not be saved.",
);

onBeforeUnmount(abort);

const summary = computed(() =>
  props.position === null ? null : formatCoordinate(props.position),
);

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    category: DEFAULT_CATEGORY,
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

  if (position === null) {
    return;
  }

  const feature = await run((options) =>
    createPointOfInterest(
      {
        name: draft.name,
        description: draft.description === "" ? null : draft.description,
        category: draft.category,
        position,
        window: windowOf(draft),
      },
      options,
    ),
  );

  if (feature === null) {
    return;
  }

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
  <FeaturePanel title="Point of interest" @close="cancel">
    <FormField label="Coordinates">
      <input
        class="coordinates"
        type="text"
        readonly
        :value="summary ?? ''"
        placeholder="Click the map to place the marker."
      />
    </FormField>

    <FormField label="Name">
      <input v-model="draft.name" type="text" placeholder="Saddle Creek Overlook" />
    </FormField>

    <FormField label="Description">
      <textarea v-model="draft.description" placeholder="Plain text only"></textarea>
    </FormField>

    <FormField label="Category">
      <select v-model="draft.category">
        <option v-for="category in POI_CATEGORIES" :key="category" :value="category">
          {{ category }}
        </option>
      </select>
    </FormField>

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
        :disabled="position === null || pending"
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
</style>
