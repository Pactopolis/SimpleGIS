<script setup lang="ts">
import type { DetailRow } from "../types/display.ts";

defineProps<{ rows: DetailRow[] }>();
</script>

<template>
  <dl class="rows">
    <template v-for="row in rows" :key="row.label">
      <dt>{{ row.label }}</dt>
      <dd>{{ row.value }}</dd>
    </template>
  </dl>
</template>

<style scoped>
.rows {
  display: grid;
  grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr);
  gap: 0.35rem 0.6rem;
  margin: 0;
  font-size: 0.75rem;
}

dt {
  font-weight: 600;
  color: #333;
}

dd {
  margin: 0;
  color: #111;
  overflow-wrap: anywhere;
}
</style>
