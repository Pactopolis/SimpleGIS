import { ApiError } from "./client.ts";

export function aborted(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

export function describeFailure(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    return cause.code === null ? cause.message : `${cause.message} (${cause.code})`;
  }

  return cause instanceof Error ? cause.message : fallback;
}
