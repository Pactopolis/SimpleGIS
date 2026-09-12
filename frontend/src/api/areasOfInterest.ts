import type {
  AreaOfInterest,
  AreaOfInterestQuery,
  NewAreaOfInterest,
} from "../types/features.ts";
import type { Page } from "../types/paging.ts";
import { request } from "./client.ts";
import {
  toAreaOfInterest,
  toAreaOfInterestPage,
  toAreaOfInterestQuery,
  toAreaOfInterestWriteDto,
  type AreaOfInterestPageDto,
  type AreaOfInterestReadDto,
} from "./dtos/areaOfInterest.ts";
import { resourcePath, type CallOptions } from "./resources.ts";

const COLLECTION = "/areas-of-interest";

export async function listAreasOfInterest(
  query: AreaOfInterestQuery = {},
  options: CallOptions = {},
): Promise<Page<AreaOfInterest>> {
  const dto = await request<AreaOfInterestPageDto>(COLLECTION, {
    ...options,
    query: toAreaOfInterestQuery(query),
  });

  return toAreaOfInterestPage(dto);
}

export async function getAreaOfInterest(
  id: string,
  options: CallOptions = {},
): Promise<AreaOfInterest> {
  const dto = await request<AreaOfInterestReadDto>(
    resourcePath(COLLECTION, id),
    options,
  );

  return toAreaOfInterest(dto);
}

export async function createAreaOfInterest(
  input: NewAreaOfInterest,
  options: CallOptions = {},
): Promise<AreaOfInterest> {
  const dto = await request<AreaOfInterestReadDto>(COLLECTION, {
    ...options,
    method: "POST",
    body: toAreaOfInterestWriteDto(input),
  });

  return toAreaOfInterest(dto);
}

export async function replaceAreaOfInterest(
  id: string,
  input: NewAreaOfInterest,
  options: CallOptions = {},
): Promise<AreaOfInterest> {
  const dto = await request<AreaOfInterestReadDto>(resourcePath(COLLECTION, id), {
    ...options,
    method: "PUT",
    body: toAreaOfInterestWriteDto(input),
  });

  return toAreaOfInterest(dto);
}

export async function deleteAreaOfInterest(
  id: string,
  options: CallOptions = {},
): Promise<null> {
  return request<null>(resourcePath(COLLECTION, id), {
    ...options,
    method: "DELETE",
  });
}
