import { ERROR_CODES, type ApiErrorCode, type ErrorDto } from "./dtos/common.ts";

export { ERROR_CODES };
export type { ApiErrorCode };

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions {
  method?: string;
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  baseUrl?: string;
  fetch?: FetchLike;
}

export const DEFAULT_BASE_URL = "https://api.ridgeline.trailblazers.com/v1";

const NO_CONTENT = 204;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | null;
  readonly traceId: string | null;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    const envelope = payload as Partial<ErrorDto> | null;
    super(envelope?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = envelope?.code ?? null;
    this.traceId = envelope?.traceId ?? null;
    this.payload = payload;
  }
}

function isEmpty(value: QueryValue): boolean {
  return value === undefined || value === null || value === "";
}

function toSearchParams(query: QueryParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (isEmpty(value)) continue;
    params.set(key, String(value));
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    query,
    body,
    signal,
    baseUrl = DEFAULT_BASE_URL,
    fetch: fetchImpl = globalThis.fetch,
  } = options;

  const url = `${baseUrl}${path}${query ? toSearchParams(query) : ""}`;
  const hasBody = body !== undefined;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (hasBody) headers["Content-Type"] = "application/json";

  const response = await fetchImpl(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === NO_CONTENT) return null as T;

  const payload = await readJson(response);

  if (!response.ok) throw new ApiError(response.status, payload);

  return payload as T;
}
