<script setup lang="ts">
import { computed, useId } from "vue";

import { DRAWER_VIEWS } from "../types/display.ts";

import type { DrawerView } from "../types/display.ts";

const open = defineModel<boolean>("open", { default: false });
const view = defineModel<DrawerView>("view", { default: "assets" });

const panelId = useId();

const active = computed(
  () =>
    DRAWER_VIEWS.find((candidate) => candidate.id === view.value) ??
    DRAWER_VIEWS[0],
);
</script>

<template>
  <div class="drawer" :class="{ open }">
    <div class="sheet">
      <div class="handle">
        <button
          type="button"
          class="tab"
          :aria-expanded="open"
          :aria-controls="panelId"
          :title="open ? 'Collapse the table' : 'Expand the table'"
          @click="open = !open"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="m6 15 6-6 6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ active.label }}</span>
        </button>
      </div>

      <section :id="panelId" class="panel" role="region" aria-label="Feature tables">
        <header class="head">
          <div class="segmented" role="group" aria-label="Table">
            <button
              v-for="candidate in DRAWER_VIEWS"
              :key="candidate.id"
              type="button"
              :class="{ active: candidate.id === view }"
              :aria-pressed="candidate.id === view"
              @click="view = candidate.id"
            >
              {{ candidate.label }}
            </button>
          </div>

          <div v-if="$slots.controls" class="controls">
            <slot name="controls" />
          </div>
        </header>

        <div class="body">
          <slot :name="view">
            <p class="placeholder">
              The {{ active.label.toLowerCase() }} table goes here.
            </p>
          </slot>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  --panel-height: var(--drawer-panel-height, 16rem);
  --handle-height: var(--drawer-handle-height, 2rem);

  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  height: calc(var(--panel-height) + var(--handle-height));
  overflow: hidden;
  pointer-events: none;
}

.sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  transform: translateY(var(--panel-height));
  transition: transform 220ms ease;
}

.drawer.open .sheet {
  transform: translateY(0);
}

.handle {
  height: var(--handle-height);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.9rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #111;
  background: linear-gradient(#f0f0f0, #cfcfcf);
  border: 1px solid #8c8c8c;
  border-bottom: none;
  border-radius: 0.5rem 0.5rem 0 0;
  box-shadow: 0 -2px 6px rgb(0 0 0 / 0.35);
  cursor: pointer;
  pointer-events: auto;
}

.tab:hover {
  background: linear-gradient(#fafafa, #dcdcdc);
}

.tab:focus-visible {
  outline: 2px solid #111;
  outline-offset: 2px;
}

.tab svg {
  transition: transform 220ms ease;
}

.drawer.open .tab svg {
  transform: rotate(180deg);
}

.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: #111;
  background: #f7f7f7;
  border-top: 1px solid #8c8c8c;
  box-shadow: 0 -4px 14px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(#f0f0f0, #cfcfcf);
  border-bottom: 1px solid #8c8c8c;
}

.segmented {
  display: flex;
}

.controls {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.segmented button {
  padding: 0.28rem 0.85rem;
  font: inherit;
  font-size: 0.78rem;
  color: #111;
  background: #ffffff;
  border: 1px solid #9a9a9a;
  cursor: pointer;
}

.segmented button:first-child {
  border-radius: 0.3rem 0 0 0.3rem;
}

.segmented button:last-child {
  border-radius: 0 0.3rem 0.3rem 0;
  border-left-width: 0;
}

.segmented button:hover:not(.active) {
  background: #f0f0f0;
}

.segmented button.active {
  color: #ffffff;
  background: #2f6fd0;
  border-color: #24559f;
}

.segmented button:focus-visible {
  outline: 2px solid #111;
  outline-offset: 1px;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.placeholder {
  margin: 0;
  padding: 0.75rem;
  font-size: 0.78rem;
  color: #666;
}

@media (prefers-reduced-motion: reduce) {
  .sheet,
  .tab svg {
    transition: none;
  }
}
</style>
