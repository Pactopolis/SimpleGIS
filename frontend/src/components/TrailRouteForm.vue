<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from "vue";

import EventWindowFields from "./EventWindowFields.vue";
import FeaturePanel from "./FeaturePanel.vue";
import FormAlert from "./FormAlert.vue";
import FormField from "./FormField.vue";

import { createTrailRoute } from "../api/index.ts";
import { useFeatureSave } from "../composables/featureSave.ts";
import { formatCoordinate } from "../formatting.ts";
import { TRAIL_DIFFICULTIES } from "../types/enums.ts";
import { MIN_PATH_POSITIONS } from "../types/geometry.ts";

import type { TrailDifficulty } from "../types/enums.ts";
import type { TimeWindow, TrailRoute } from "../types/features.ts";
import type { Path } from "../types/geometry.ts";

const DEFAULT_DIFFICULTY: TrailDifficulty = "Moderate";

interface Draft {
  name: string;
  description: string;
  difficulty: TrailDifficulty;
  isEvent: boolean;
  startTime: string;
  endTime: string;
}

const props = defineProps<{ path: Path; complete: boolean }>();
const emit = defineEmits<{ saved: [feature: TrailRoute]; cancel: [] }>();

const draft = reactive<Draft>(emptyDraft());
const { pending, failure, run, abort, reset } = useFeatureSave<TrailRoute>(
  "The trail could not be saved.",
);

onBeforeUnmount(abort);

const vertices = computed(() => props.path.map(formatCoordinate).join("\n"));
const drawn = computed(
  () => props.complete && props.path.length >= MIN_PATH_POSITIONS,
);

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    difficulty: DEFAULT_DIFFICULTY,
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
    createTrailRoute(
      {
        name: draft.name,
        description: draft.description === "" ? null : draft.description,
        difficulty: draft.difficulty,
        path: [...props.path],
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
  <FeaturePanel title="Trail route" @close="cancel">
    <FormField
      :label="`Vertices (${props.path.length})`"
      :hint="
        props.complete
          ? 'The trail is complete.'
          : 'Click the map to add a vertex, right-click to finish the trail.'
      "
    >
      <textarea
        class="vertices"
        readonly
        :value="vertices"
        placeholder="Click the map to start the trail."
      ></textarea>
    </FormField>

    <FormField label="Name">
      <input v-model="draft.name" type="text" placeholder="Gore Creek Trail" />
    </FormField>

    <FormField label="Description">
      <textarea v-model="draft.description" placeholder="Plain text only"></textarea>
    </FormField>

    <FormField label="Difficulty">
      <select v-model="draft.difficulty">
        <option
          v-for="difficulty in TRAIL_DIFFICULTIES"
          :key="difficulty"
          :value="difficulty"
        >
          {{ difficulty }}
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
