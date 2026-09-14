<script setup lang="ts">
import type { FeatureType } from "../types/enums.ts";

defineProps<{
  active: FeatureType | null;
}>();

defineEmits<{
  select: [featureType: FeatureType];
}>();
</script>

<template>
  <div class="toolbar">
    <button
      type="button"
      class="tool"
      :class="{ armed: active === 'PointOfInterest' }"
      :aria-pressed="active === 'PointOfInterest'"
      title="Point of interest"
      aria-label="Point of interest"
      @click="$emit('select', 'PointOfInterest')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5A6.5 6.5 0 0 0 12 2.5Zm0 4.1a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z"
          fill="currentColor"
          fill-rule="evenodd"
        />
      </svg>
    </button>

    <button
      type="button"
      class="tool"
      :class="{ armed: active === 'TrailRoute' }"
      :aria-pressed="active === 'TrailRoute'"
      title="Trail route"
      aria-label="Trail route"
      @click="$emit('select', 'TrailRoute')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.5 18 10 9.5l4.5 5L19.5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="4.5" cy="18" r="2.1" fill="currentColor" />
        <circle cx="10" cy="9.5" r="2.1" fill="currentColor" />
        <circle cx="14.5" cy="14.5" r="2.1" fill="currentColor" />
        <circle cx="19.5" cy="5" r="2.1" fill="currentColor" />
      </svg>
    </button>

    <button
      type="button"
      class="tool"
      :class="{ armed: active === 'AreaOfInterest' }"
      :aria-pressed="active === 'AreaOfInterest'"
      title="Area of interest"
      aria-label="Area of interest"
      @click="$emit('select', 'AreaOfInterest')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.5 8.5 12 3.5l7.5 5.5-2.8 10h-9Z"
          fill="currentColor"
          fill-opacity="0.22"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <circle cx="4.5" cy="8.5" r="2.1" fill="currentColor" />
        <circle cx="12" cy="3.5" r="2.1" fill="currentColor" />
        <circle cx="19.5" cy="9" r="2.1" fill="currentColor" />
        <circle cx="16.7" cy="19" r="2.1" fill="currentColor" />
        <circle cx="7.7" cy="19" r="2.1" fill="currentColor" />
      </svg>
    </button>

    <button
      type="button"
      class="tool"
      :class="{ armed: active === 'CameraCone' }"
      :aria-pressed="active === 'CameraCone'"
      title="Camera cone"
      aria-label="Camera cone"
      @click="$emit('select', 'CameraCone')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 7.5h11.5v9H3z"
          fill="currentColor"
          fill-opacity="0.25"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path
          d="m14.5 10 6-3v10l-6-3z"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <circle cx="8.7" cy="12" r="2.25" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool {
  width: 2.75rem;
  height: 2.75rem;
  padding: 0.5rem;
  display: grid;
  place-items: center;
  color: #111;
  background: linear-gradient(#f0f0f0, #cfcfcf);
  border: 1px solid #8c8c8c;
  border-radius: 0.5rem;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.85),
    0 2px 5px rgb(0 0 0 / 0.45);
  cursor: pointer;
}

.tool:hover {
  background: linear-gradient(#fafafa, #dcdcdc);
}

.tool:active,
.tool.armed {
  background: linear-gradient(#c8c8c8, #dcdcdc);
  box-shadow: inset 0 2px 4px rgb(0 0 0 / 0.35);
}

.tool.armed {
  border-color: #111;
}

.tool:focus-visible {
  outline: 2px solid #111;
  outline-offset: 2px;
}

.tool svg {
  width: 100%;
  height: 100%;
}
</style>
