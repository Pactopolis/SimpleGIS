import { ref } from "vue";

import { API_BASE_URL, aborted, describeFailure } from "../api/index.ts";

import type { Ref } from "vue";
import type { CallOptions } from "../api/index.ts";

export type Submit<T> = (options: CallOptions) => Promise<T>;

export interface FeatureSave<T> {
  pending: Ref<boolean>;
  failure: Ref<string | null>;
  run: (submit: Submit<T>) => Promise<T | null>;
  abort: () => void;
  reset: () => void;
}

export function useFeatureSave<T>(fallback: string): FeatureSave<T> {
  const pending = ref(false);
  const failure = ref<string | null>(null);

  let request: AbortController | null = null;

  async function run(submit: Submit<T>): Promise<T | null> {
    if (pending.value) {
      return null;
    }

    request = new AbortController();
    pending.value = true;
    failure.value = null;

    try {
      return await submit({ baseUrl: API_BASE_URL, signal: request.signal });
    } catch (cause) {
      if (!aborted(cause)) {
        failure.value = describeFailure(cause, fallback);
      }

      return null;
    } finally {
      pending.value = false;
      request = null;
    }
  }

  function abort(): void {
    request?.abort();
    request = null;
  }

  function reset(): void {
    abort();
    pending.value = false;
    failure.value = null;
  }

  return { pending, failure, run, abort, reset };
}
