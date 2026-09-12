import type {
  NewTrailRoute,
  TrailRoute,
  TrailRouteQuery,
} from "../types/features.ts";
import type { Page } from "../types/paging.ts";
import { request } from "./client.ts";
import {
  toTrailRoute,
  toTrailRoutePage,
  toTrailRouteQuery,
  toTrailRouteWriteDto,
  type TrailRoutePageDto,
  type TrailRouteReadDto,
} from "./dtos/trailRoute.ts";
import { resourcePath, type CallOptions } from "./resources.ts";

const COLLECTION = "/trail-routes";

export async function listTrailRoutes(
  query: TrailRouteQuery = {},
  options: CallOptions = {},
): Promise<Page<TrailRoute>> {
  const dto = await request<TrailRoutePageDto>(COLLECTION, {
    ...options,
    query: toTrailRouteQuery(query),
  });

  return toTrailRoutePage(dto);
}

export async function getTrailRoute(
  id: string,
  options: CallOptions = {},
): Promise<TrailRoute> {
  const dto = await request<TrailRouteReadDto>(resourcePath(COLLECTION, id), options);
  return toTrailRoute(dto);
}

export async function createTrailRoute(
  input: NewTrailRoute,
  options: CallOptions = {},
): Promise<TrailRoute> {
  const dto = await request<TrailRouteReadDto>(COLLECTION, {
    ...options,
    method: "POST",
    body: toTrailRouteWriteDto(input),
  });

  return toTrailRoute(dto);
}

export async function replaceTrailRoute(
  id: string,
  input: NewTrailRoute,
  options: CallOptions = {},
): Promise<TrailRoute> {
  const dto = await request<TrailRouteReadDto>(resourcePath(COLLECTION, id), {
    ...options,
    method: "PUT",
    body: toTrailRouteWriteDto(input),
  });

  return toTrailRoute(dto);
}

export async function deleteTrailRoute(
  id: string,
  options: CallOptions = {},
): Promise<null> {
  return request<null>(resourcePath(COLLECTION, id), {
    ...options,
    method: "DELETE",
  });
}
