import type { AreaCategory } from "../../types/enums.ts";
import type {
  AreaOfInterest,
  AreaOfInterestQuery,
  NewAreaOfInterest,
} from "../../types/features.ts";
import type { Page } from "../../types/paging.ts";
import type { QueryParams } from "../client.ts";
import {
  toBboxParam,
  toPolygon,
  toPolygonGeometryDto,
  toTimestamp,
  toTimeWindow,
  toTimeWindowDto,
  type PageEnvelopeDto,
  type PolygonGeometryDto,
  type ReadWindowDto,
  type TimeWindowDto,
} from "./common.ts";

export interface AreaOfInterestWriteDto extends TimeWindowDto {
  name: string;
  description: string | null;
  areaCategory: AreaCategory;
  geometry: PolygonGeometryDto;
}

export interface AreaOfInterestReadDto extends ReadWindowDto {
  id: string;
  featureType: "AreaOfInterest";
  name: string;
  description?: string | null;
  areaCategory: AreaCategory;
  geometry: PolygonGeometryDto;
  areaSquareMetres?: number | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AreaOfInterestPageDto extends PageEnvelopeDto {
  items: AreaOfInterestReadDto[];
}

export function toAreaOfInterestWriteDto(
  input: NewAreaOfInterest,
): AreaOfInterestWriteDto {
  return {
    name: input.name,
    description: input.description ?? null,
    areaCategory: input.category,
    geometry: toPolygonGeometryDto(input.shape),
    ...toTimeWindowDto(input.window),
  };
}

export function toAreaOfInterest(dto: AreaOfInterestReadDto): AreaOfInterest {
  return {
    id: dto.id,
    featureType: "AreaOfInterest",
    name: dto.name,
    description: dto.description ?? null,
    category: dto.areaCategory,
    shape: toPolygon(dto.geometry),
    areaSquareMetres: dto.areaSquareMetres ?? null,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
    window: toTimeWindow(dto),
  };
}

export function toAreaOfInterestPage(
  dto: AreaOfInterestPageDto,
): Page<AreaOfInterest> {
  return {
    page: dto.page,
    pageSize: dto.pageSize,
    totalItems: dto.totalItems,
    totalPages: dto.totalPages,
    items: dto.items.map(toAreaOfInterest),
  };
}

export function toAreaOfInterestQuery(query: AreaOfInterestQuery): QueryParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    nameContains: query.nameContains,
    bbox: query.bbox ? toBboxParam(query.bbox) : undefined,
    from: query.overlapping ? toTimestamp(query.overlapping.startTime) : undefined,
    to: query.overlapping ? toTimestamp(query.overlapping.endTime) : undefined,
    areaCategory: query.category,
  };
}
