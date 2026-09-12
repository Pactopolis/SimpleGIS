<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from "vue";

import EventWindowFields from "./EventWindowFields.vue";
import FeaturePanel from "./FeaturePanel.vue";
import FormAlert from "./FormAlert.vue";
import FormField from "./FormField.vue";

import { createAreaOfInterest } from "../api/index.ts";
import { useFeatureSave } from "../composables/featureSave.ts";
import { formatCoordinate } from "../formatting.ts";
import { AREA_CATEGORIES } from "../types/enums.ts";
import { MIN_RING_POSITIONS, polygon } from "../types/geometry.ts";

import type { AreaCategory } from "../types/enums.ts";
import type { AreaOfInterest, TimeWindow } from "../types/features.ts";
import type { Ring } from "../types/geometry.ts";

const DEFAULT_CATEGORY: AreaCategory = "Search";

const MIN_VERTICES = MIN_RING_POSITIONS - 1;

interface Draft {
  name: string;
  description: string;
  category: AreaCategory;
  isEvent: boolean;
  startTime: string;
  endTime: string;
}

const props = defineProps<{ ring: Ring; closed: boolean }>();
const emit = defineEmits<{ saved: [feature: AreaOfInterest]; cancel: [] }>();

const draft = reactive<Draft>(emptyDraft());
const { pending, failure, run, abort, reset } = useFeatureSave<AreaOfInterest>(
  "The area could not be saved.",
);

onBeforeUnmount(abort);

const vertices = computed(() => props.ring.map(formatCoordinate).join("\n"));
const drawn = computed(() => props.closed && props.ring.length >= MIN_VERTICES);

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
  if (!drawn.value) {
    return;
  }

  const feature = await run((options) =>
    createAreaOfInterest(
      {
        name: draft.name,
        description: draft.description === "" ? null : draft.description,
        category: draft.category,
        shape: polygon([...props.ring]),
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
  <FeaturePanel title="Area of interest" @close="cancel">
    <FormField
      :label="`Vertices (${props.ring.length})`"
      :hint="
        props.closed
          ? 'The ring is closed.'
          : 'Click the map to add a vertex, right-click to close the ring.'
      "
    >
      <textarea
        class="vertices"
        readonly
        :value="vertices"
        placeholder="Click the map to start the boundary."
      ></textarea>
    </FormField>

    <FormField label="Name">
      <input v-model="draft.name" type="text" placeholder="Bighorn Basin Sector" />
    </FormField>

    <FormField label="Description">
      <textarea v-model="draft.description" placeholder="Plain text only"></textarea>
    </FormField>

    <FormField label="Category">
      <select v-model="draft.category">
        <option v-for="category in AREA_CATEGORIES" :key="category" :value="category">
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
      <button type="button" class="primary" :disabled="!drawn || pending" @click="save">
        {{ pending ? "Saving…" : "Save" }}
      </button>
    </template>
  </FeaturePanel>
</template>

<style scoped>
.vertices {
  max-height: 7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  background: #ededed;
  cursor: default;
  resize: none;
}

.vertices::placeholder {
  color: #666;
}
</style>
