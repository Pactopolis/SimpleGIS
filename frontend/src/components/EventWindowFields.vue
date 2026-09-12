<script setup lang="ts">
import FormField from "./FormField.vue";

const enabled = defineModel<boolean>("enabled", { required: true });
const start = defineModel<string>("start", { required: true });
const end = defineModel<string>("end", { required: true });
</script>

<template>
  <label class="toggle">
    <input v-model="enabled" type="checkbox" />
    <span>Make this feature an event</span>
  </label>

  <div v-if="enabled" class="window">
    <p class="note">Start and end times are required.</p>

    <FormField label="Start">
      <input v-model="start" type="datetime-local" />
    </FormField>

    <FormField label="End">
      <input v-model="end" type="datetime-local" />
    </FormField>
  </div>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
}

.toggle input {
  width: 0.9rem;
  height: 0.9rem;
  margin: 0;
  accent-color: #2f6fd0;
  cursor: pointer;
}

.window {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem;
  background: #ffffff;
  border: 1px solid #d6d6d6;
  border-radius: 0.3rem;
}

.note {
  margin: 0;
  font-size: 0.72rem;
  color: #666;
}
</style>
