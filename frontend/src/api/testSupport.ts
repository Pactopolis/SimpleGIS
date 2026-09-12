interface Call {
  url: string;
  init: RequestInit;
}

export interface Stub {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  calls: Call[];
  readonly last: Call;
  body(): unknown;
  url(): URL;
  params(): URLSearchParams;
  headers(): Record<string, string>;
}

export function json(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status });

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubFetch(...responses: Response[]): Stub {
  const queue = [...responses];
  const calls: Call[] = [];

  return {
    calls,
    fetch(url, init = {}) {
      calls.push({ url, init });
      return Promise.resolve(queue.shift() ?? json(200, {}));
    },
    get last() {
      return calls[calls.length - 1]!;
    },
    body() {
      return JSON.parse(String(this.last.init.body));
    },
    url() {
      return new URL(this.last.url);
    },
    params() {
      return this.url().searchParams;
    },
    headers() {
      return (this.last.init.headers ?? {}) as Record<string, string>;
    },
  };
}

export function pageOf(items: unknown[]) {
  return {
    page: 1,
    pageSize: 50,
    totalItems: items.length,
    totalPages: 1,
    items,
  };
}
