<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import DataTable from "./DataTable.vue";
import FormAlert from "./FormAlert.vue";

import {
  API_BASE_URL,
  aborted,
  describeFailure,
  eachPage,
  listAreasOfInterest,
  listPointsOfInterest,
  listTrailRoutes,
} from "../api/index.ts";
import {
  formatDuration,
  formatFeatureClass,
  formatFeatureType,
  formatMoment,
} from "../formatting.ts";
import { MAX_PAGE_SIZE } from "../types/paging.ts";

import type { CallOptions } from "../api/index.ts";
import type { TableColumn, TableRow } from "../types/display.ts";
import type { Feature, TimeWindow } from "../types/features.ts";
import type { Page } from "../types/paging.ts";

type EventFeature = Feature & { window: TimeWindow };

interface EventQuery {
  page: number;
  pageSize: number;
  overlapping?: TimeWindow;
}

const FAILURE = "The events could not be loaded.";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Name", wide: true },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "duration", label: "Duration", numeric: true },
];

const props = defineProps<{ range: TimeWindow | null }>();

const events = ref<EventFeature[]>([]);
const pending = ref(false);
const failure = ref<string | null>(null);

const rows = computed<TableRow[]>(() => events.value.map(toRow));

let request: AbortController | null = null;
let latest = 0;

onMounted(load);
onBeforeUnmount(abort);

watch(() => props.range, load);

async function load(): Promise<void> {
  request?.abort();

  const controller = new AbortController();
  const token = (latest += 1);
  const found: EventFeature[] = [];

  request = controller;
  pending.value = true;
  failure.value = null;

  function pageThrough<T extends Feature>(
    list: (page: number, options: CallOptions) => Promise<Page<T>>,
  ): Promise<void> {
    const options = { baseUrl: API_BASE_URL, signal: controller.signal };

    return eachPage(
      (page) => list(page, options),
      (feature) => {
        if (isEvent(feature)) {
          found.push(feature);
        }
      },
    );
  }

  try {
    await Promise.all([
      pageThrough((page, options) => listPointsOfInterest(query(page), options)),
      pageThrough((page, options) => listTrailRoutes(query(page), options)),
      pageThrough((page, options) => listAreasOfInterest(query(page), options)),
    ]);

    if (token === latest) {
      events.value = found.sort(byStart);
    }
  } catch (cause) {
    if (token === latest && !aborted(cause)) {
      events.value = [];
      failure.value = describeFailure(cause, FAILURE);
    }
  } finally {
    if (token === latest) {
      pending.value = false;
      request = null;
    }
  }
}

function query(page: number): EventQuery {
  const range = props.range;

  return range === null
    ? { page, pageSize: MAX_PAGE_SIZE }
    : { page, pageSize: MAX_PAGE_SIZE, overlapping: range };
}

function isEvent(feature: Feature): feature is EventFeature {
  return feature.window !== null;
}

function byStart(left: EventFeature, right: EventFeature): number {
  return left.window.startTime.getTime() - right.window.startTime.getTime();
}

function toRow(feature: EventFeature): TableRow {
  return {
    id: feature.id,
    cells: {
      name: feature.name,
      type: formatFeatureType(feature),
      category: formatFeatureClass(feature),
      start: formatMoment(feature.window.startTime),
      end: formatMoment(feature.window.endTime),
      duration: formatDuration(feature.window),
    },
  };
}

function abort(): void {
  request?.abort();
  request = null;
}
</script>

<template>
  <div class="events">
    <p v-if="pending" class="status">Loading events…</p>
    <FormAlert v-else-if="failure !== null">{{ failure }}</FormAlert>

    <DataTable
      v-else
      :columns="COLUMNS"
      :rows="rows"
      empty="No events in this range."
    />
  </div>
</template>

<style scoped>
.status {
  margin: 0;
  padding: 0.75rem;
  font-size: 0.78rem;
  color: #666;
}

.events :deep(.alert) {
  margin: 0.75rem;
}
</style>
