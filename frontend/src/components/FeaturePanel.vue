<script setup lang="ts">
defineProps<{ title: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <section class="panel" role="region" :aria-label="title">
    <header class="head">
      <h2>{{ title }}</h2>
      <button type="button" class="close" aria-label="Close" @click="$emit('close')">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M6 6 18 18M18 6 6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>

    <div class="body">
      <slot />
    </div>

    <footer v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </footer>
  </section>
</template>

<style scoped>
.panel {
  width: 18rem;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  color: #111;
  background: #f7f7f7;
  border: 1px solid #8c8c8c;
  border-radius: 0.5rem;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  background: linear-gradient(#f0f0f0, #cfcfcf);
  border-bottom: 1px solid #8c8c8c;
}

h2 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  color: #111;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  cursor: pointer;
}

.close:hover {
  background: rgb(255 255 255 / 0.7);
  border-color: #8c8c8c;
}

.close:focus-visible {
  outline: 2px solid #111;
  outline-offset: 1px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  overflow-y: auto;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: #ececec;
  border-top: 1px solid #c4c4c4;
}

.actions :slotted(button) {
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.78rem;
  color: #111;
  background: #ffffff;
  border: 1px solid #9a9a9a;
  border-radius: 0.3rem;
  cursor: pointer;
}

.actions :slotted(button:hover) {
  background: #f0f0f0;
}

.actions :slotted(button.primary) {
  color: #ffffff;
  background: #2f6fd0;
  border-color: #24559f;
}

.actions :slotted(button.primary:hover:not(:disabled)) {
  background: #2a63b9;
}

.actions :slotted(button:disabled) {
  cursor: not-allowed;
  opacity: 0.5;
}

.actions :slotted(button:focus-visible) {
  outline: 2px solid #111;
  outline-offset: 1px;
}
</style>
