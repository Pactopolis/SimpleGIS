import type {
  CameraCone,
  CameraConeQuery,
  NewCameraCone,
} from "../types/features.ts";
import type { Page } from "../types/paging.ts";
import { request } from "./client.ts";
import {
  toCameraCone,
  toCameraConePage,
  toCameraConeQuery,
  toCameraConeWriteDto,
  type CameraConePageDto,
  type CameraConeReadDto,
} from "./dtos/cameraCone.ts";
import { resourcePath, type CallOptions } from "./resources.ts";

const COLLECTION = "/camera-cones";

export async function listCameraCones(
  query: CameraConeQuery = {},
  options: CallOptions = {},
): Promise<Page<CameraCone>> {
  const dto = await request<CameraConePageDto>(COLLECTION, {
    ...options,
    query: toCameraConeQuery(query),
  });
  return toCameraConePage(dto);
}

export async function getCameraCone(
  id: string,
  options: CallOptions = {},
): Promise<CameraCone> {
  const dto = await request<CameraConeReadDto>(
    resourcePath(COLLECTION, id),
    options,
  );
  return toCameraCone(dto);
}

export async function createCameraCone(
  input: NewCameraCone,
  options: CallOptions = {},
): Promise<CameraCone> {
  const dto = await request<CameraConeReadDto>(COLLECTION, {
    ...options,
    method: "POST",
    body: toCameraConeWriteDto(input),
  });
  return toCameraCone(dto);
}

export async function replaceCameraCone(
  id: string,
  input: NewCameraCone,
  options: CallOptions = {},
): Promise<CameraCone> {
  const dto = await request<CameraConeReadDto>(resourcePath(COLLECTION, id), {
    ...options,
    method: "PUT",
    body: toCameraConeWriteDto(input),
  });
  return toCameraCone(dto);
}

export async function deleteCameraCone(
  id: string,
  options: CallOptions = {},
): Promise<null> {
  return request<null>(resourcePath(COLLECTION, id), {
    ...options,
    method: "DELETE",
  });
}
