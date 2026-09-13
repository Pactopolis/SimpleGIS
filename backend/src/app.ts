// Ridgeline Operational Picture API — Node implementation of ../openapi.yaml.
//
// Mirrors the behaviour of ../../mock-api (the project's Python reference
// server) closely enough that either can sit behind the frontend unchanged.

import * as http from "node:http";

import { COLLECTIONS, type Collection } from "./catalog.ts";
import { ApiError } from "./errors.ts";
import { FeatureStore } from "./store.ts";
import { readFeatureBody, readListQuery } from "./validation.ts";

export const BASE_PATH = "/v1";
export const MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 8080;

const COLLECTION_METHODS = ["GET", "POST", "OPTIONS"];
const FEATURE_METHODS = ["GET", "PUT", "DELETE", "OPTIONS"];

export function createApp(store: FeatureStore = new FeatureStore()): http.Server {
  return http.createServer((req, res) => {
    route(req, res, store).catch((error: unknown) => {
      if (error instanceof ApiError) {
        sendError(req, res, error);
        return;
      }

      console.error("unhandled error", error);
      sendError(req, res, new ApiError(500, "internal_error", "The server failed."));
    });
  });
}

async function route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: FeatureStore,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://internal");
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const base = BASE_PATH.split("/").filter(Boolean);

  if (base.some((part, index) => segments[index] !== part)) {
    throw new ApiError(404, "not_found", "No such resource.");
  }

  const rest = segments.slice(base.length);

  if (rest.length === 0 || !(rest[0]! in COLLECTIONS)) {
    throw new ApiError(404, "not_found", "No such resource.");
  }

  const collection = COLLECTIONS[rest[0]!]!;

  if (rest.length === 1) {
    await handleCollection(req, res, store, collection, url.searchParams);
    return;
  }

  if (rest.length === 2) {
    await handleFeature(req, res, store, collection, rest[1]!);
    return;
  }

  throw new ApiError(404, "not_found", "No such resource.");
}

async function handleCollection(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: FeatureStore,
  collection: Collection,
  searchParams: URLSearchParams,
): Promise<void> {
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    sendPreflight(req, res, COLLECTION_METHODS);
    return;
  }

  if (method === "GET") {
    const query = readListQuery(collection, searchParams);
    const [items, total] = store.list(collection, query);
    const totalPages = Math.ceil(total / query.pageSize);

    sendJson(req, res, 200, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: total,
      totalPages,
      items,
    });
    return;
  }

  if (method === "POST") {
    const payload = await readJsonBody(req);
    const body = readFeatureBody(collection, payload);
    const feature = store.create(collection, body);

    sendJson(req, res, 201, feature, {
      Location: locationOf(req, collection, feature.id as string),
    });
    return;
  }

  sendNotAllowed(req, res, COLLECTION_METHODS);
}

async function handleFeature(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: FeatureStore,
  collection: Collection,
  featureId: string,
): Promise<void> {
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    sendPreflight(req, res, FEATURE_METHODS);
    return;
  }

  if (method === "GET") {
    sendJson(req, res, 200, store.get(collection, featureId));
    return;
  }

  if (method === "PUT") {
    const payload = await readJsonBody(req);
    const body = readFeatureBody(collection, payload);
    sendJson(req, res, 200, store.replace(collection, featureId, body));
    return;
  }

  if (method === "DELETE") {
    store.delete(collection, featureId);
    sendJson(req, res, 204, null);
    return;
  }

  sendNotAllowed(req, res, FEATURE_METHODS);
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const declared = req.headers["content-length"];

    if (declared !== undefined && Number(declared) > MAX_BODY_BYTES) {
      req.resume();
      reject(new ApiError(413, "payload_too_large", "The request body exceeds 1 MB."));
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    let settled = false;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        exceeded = true;
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;

      if (exceeded) {
        reject(new ApiError(413, "payload_too_large", "The request body exceeds 1 MB."));
        return;
      }

      if (chunks.length === 0) {
        reject(new ApiError(400, "malformed_body", "A request body is required."));
        return;
      }

      const raw = Buffer.concat(chunks).toString("utf-8");

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ApiError(400, "malformed_body", "The body is not valid JSON."));
      }
    });

    req.on("error", () => {
      if (settled) return;
      settled = true;
      reject(new ApiError(400, "malformed_body", "Failed to read the request body."));
    });
  });
}

function locationOf(req: http.IncomingMessage, collection: Collection, id: string): string {
  const host = req.headers.host ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return `http://${host}${BASE_PATH}/${collection.path}/${id}`;
}

function sendJson(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): void {
  const body = payload === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), "utf-8");

  res.statusCode = status;

  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }

  if (body.length > 0) {
    res.setHeader("Content-Type", "application/json");
  }

  if (status !== 204) {
    res.setHeader("Content-Length", String(body.length));
  }

  applyCors(req, res);
  res.end(body);
}

function sendError(req: http.IncomingMessage, res: http.ServerResponse, error: ApiError): void {
  sendJson(req, res, error.status, { code: error.code, message: error.message, traceId: null });
}

function sendPreflight(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  methods: string[],
): void {
  const requested = req.headers["access-control-request-headers"] ?? "Content-Type";

  res.statusCode = 204;
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", requested);
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Content-Length", "0");
  applyCors(req, res);
  res.end();
}

function sendNotAllowed(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  methods: string[],
): void {
  sendJson(
    req,
    res,
    405,
    { code: "not_found", message: `Allowed methods: ${methods.join(", ")}.`, traceId: null },
    { Allow: methods.join(", ") },
  );
}

function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Expose-Headers", "Location");
  res.setHeader("Vary", "Origin");
}
