<script setup lang="ts">
import { ref, useId } from "vue";

import type { TimeWindow } from "../types/features.ts";

const emit = defineEmits<{ change: [range: TimeWindow | null] }>();

const startId = useId();
const endId = useId();

const start = ref("");
const end = ref("");

function announce(): void {
  const startTime = dayStart(start.value);
  const endTime = dayEnd(end.value);

  const range =
    startTime === null || endTime === null ? null : { startTime, endTime };

  emit("change", range);
}

function dayStart(value: string): Date | null {
  const parsed = parse(value);
  parsed?.setHours(0, 0, 0, 0);

  return parsed;
}

function dayEnd(value: string): Date | null {
  const parsed = parse(value);
  parsed?.setHours(23, 59, 59, 999);

  return parsed;
}

function parse(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }

  return new Date(year, month - 1, day);
}
</script>

<template>
  <div class="range">
    <label :for="startId">From</label>
    <input :id="startId" v-model="start" type="date" @change="announce" />

    <label :for="endId">To</label>
    <input :id="endId" v-model="end" type="date" :min="start" @change="announce" />
  </div>
</template>

<style scoped>
.range {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #333;
}

input {
  padding: 0.2rem 0.35rem;
  font: inherit;
  font-size: 0.75rem;
  color: #111;
  background: #ffffff;
  border: 1px solid #9a9a9a;
  border-radius: 0.3rem;
}

input:focus-visible {
  outline: 2px solid #111;
  outline-offset: 1px;
}
</style>
