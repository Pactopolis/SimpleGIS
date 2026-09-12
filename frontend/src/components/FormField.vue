<script setup lang="ts">
defineProps<{ label: string; hint?: string }>();
</script>

<template>
  <label class="field">
    <span class="name">{{ label }}</span>
    <slot />
    <span v-if="hint" class="hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.name {
  font-weight: 600;
  color: #333;
}

.hint {
  color: #666;
  line-height: 1.35;
}

.field :slotted(input),
.field :slotted(select),
.field :slotted(textarea) {
  width: 100%;
  padding: 0.3rem 0.4rem;
  font: inherit;
  font-size: 0.8rem;
  color: #111;
  background: #ffffff;
  border: 1px solid #9a9a9a;
  border-radius: 0.25rem;
}

.field :slotted(textarea) {
  min-height: 3.5rem;
  resize: vertical;
}

.field :slotted(input:focus-visible),
.field :slotted(select:focus-visible),
.field :slotted(textarea:focus-visible) {
  outline: 2px solid #2f6fd0;
  outline-offset: -1px;
}
</style>
