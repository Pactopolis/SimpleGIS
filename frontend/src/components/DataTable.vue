<script setup lang="ts">
import { computed } from "vue";

import type { TableColumn, TableRow } from "../types/display.ts";

const props = defineProps<{
  columns: TableColumn[];
  rows: TableRow[];
  empty: string;
}>();

const units = computed(
  () => props.columns.length + props.columns.filter((column) => column.wide).length,
);

function cell(row: TableRow, column: TableColumn): string {
  return row.cells[column.key] ?? "";
}
</script>

<template>
  <table class="data" :style="{ '--column': `calc(100% / ${units})` }">
    <colgroup>
      <col v-for="column in columns" :key="column.key" :class="{ wide: column.wide }" />
    </colgroup>

    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.key"
          scope="col"
          :class="{ numeric: column.numeric }"
        >
          {{ column.label }}
        </th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td
          v-for="column in columns"
          :key="column.key"
          :class="{ numeric: column.numeric }"
          :title="column.wide ? cell(row, column) : undefined"
        >
          {{ cell(row, column) }}
        </td>
      </tr>

      <tr v-if="rows.length === 0">
        <td class="empty" :colspan="columns.length">{{ empty }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.data {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.78rem;
  color: #111;
}

col {
  width: var(--column);
}

col.wide {
  width: calc(var(--column) * 2);
}

th,
td {
  padding: 0.3rem 0.75rem;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid #dcdcdc;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: #ececec;
  border-bottom: 1px solid #9a9a9a;
}

td:first-child {
  font-weight: 600;
}

.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

tbody tr:nth-child(even) td {
  background: #f1f1f1;
}

td.empty {
  color: #666;
  font-weight: 400;
  text-align: center;
}
</style>
