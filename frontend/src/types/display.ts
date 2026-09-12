export interface DetailRow {
  label: string;
  value: string;
}

export const DRAWER_VIEWS = [
  { id: "assets", label: "Assets" },
  { id: "events", label: "Events" },
] as const;

export type DrawerView = (typeof DRAWER_VIEWS)[number]["id"];

export interface TableColumn {
  key: string;
  label: string;
  numeric?: boolean;
  wide?: boolean;
}

export interface TableRow {
  id: string;
  cells: Record<string, string>;
}
