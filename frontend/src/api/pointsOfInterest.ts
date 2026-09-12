import type {
  NewPointOfInterest,
  PointOfInterest,
  PointOfInterestQuery,
} from "../types/features.ts";
import type { Page } from "../types/paging.ts";
import { request } from "./client.ts";
import {
  toPointOfInterest,
  toPointOfInterestPage,
  toPointOfInterestQuery,
  toPointOfInterestWriteDto,
  type PointOfInterestPageDto,
  type PointOfInterestReadDto,
} from "./dtos/pointOfInterest.ts";
import { resourcePath, type CallOptions } from "./resources.ts";

const COLLECTION = "/points-of-interest";

export async function listPointsOfInterest(
  query: PointOfInterestQuery = {},
  options: CallOptions = {},
): Promise<Page<PointOfInterest>> {
  const dto = await request<PointOfInterestPageDto>(COLLECTION, {
    ...options,
    query: toPointOfInterestQuery(query),
  });

  return toPointOfInterestPage(dto);
}

export async function getPointOfInterest(
  id: string,
  options: CallOptions = {},
): Promise<PointOfInterest> {
  const dto = await request<PointOfInterestReadDto>(
    resourcePath(COLLECTION, id),
    options,
  );

  return toPointOfInterest(dto);
}

export async function createPointOfInterest(
  input: NewPointOfInterest,
  options: CallOptions = {},
): Promise<PointOfInterest> {
  const dto = await request<PointOfInterestReadDto>(COLLECTION, {
    ...options,
    method: "POST",
    body: toPointOfInterestWriteDto(input),
  });

  return toPointOfInterest(dto);
}

export async function replacePointOfInterest(
  id: string,
  input: NewPointOfInterest,
  options: CallOptions = {},
): Promise<PointOfInterest> {
  const dto = await request<PointOfInterestReadDto>(resourcePath(COLLECTION, id), {
    ...options,
    method: "PUT",
    body: toPointOfInterestWriteDto(input),
  });

  return toPointOfInterest(dto);
}

export async function deletePointOfInterest(
  id: string,
  options: CallOptions = {},
): Promise<null> {
  return request<null>(resourcePath(COLLECTION, id), {
    ...options,
    method: "DELETE",
  });
}
