import type { RequestOptions } from "./client.ts";

export type CallOptions = Pick<RequestOptions, "signal" | "baseUrl" | "fetch">;

export function resourcePath(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}
