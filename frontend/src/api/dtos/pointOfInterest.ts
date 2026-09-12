import type { PoiCategory } from "../../types/enums.ts";
import type {
  NewPointOfInterest,
  PointOfInterest,
  PointOfInterestQuery,
} from "../../types/features.ts";
import type { Page } from "../../types/paging.ts";
import type { QueryParams } from "../client.ts";
import {
  toBboxParam,
  toCoordinate,
  toPointGeometryDto,
  toTimestamp,
  toTimeWindow,
  toTimeWindowDto,
  type PageEnvelopeDto,
  type PointGeometryDto,
  type ReadWindowDto,
  type TimeWindowDto,
} from "./common.ts";

export interface PointOfInterestWriteDto extends TimeWindowDto {
  name: string;
  description: string | null;
  poiCategory: PoiCategory;
  geometry: PointGeometryDto;
}

export interface PointOfInterestReadDto extends ReadWindowDto {
  id: string;
  featureType: "PointOfInterest";
  name: string;
  description?: string | null;
  poiCategory: PoiCategory;
  geometry: PointGeometryDto;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PointOfInterestPageDto extends PageEnvelopeDto {
  items: PointOfInterestReadDto[];
}

export function toPointOfInterestWriteDto(
  input: NewPointOfInterest,
): PointOfInterestWriteDto {
  return {
    name: input.name,
    description: input.description ?? null,
    poiCategory: input.category,
    geometry: toPointGeometryDto(input.position),
    ...toTimeWindowDto(input.window),
  };
}

export function toPointOfInterest(dto: PointOfInterestReadDto): PointOfInterest {
  return {
    id: dto.id,
    featureType: "PointOfInterest",
    name: dto.name,
    description: dto.description ?? null,
    category: dto.poiCategory,
    position: toCoordinate(dto.geometry.coordinates),
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
    window: toTimeWindow(dto),
  };
}

export function toPointOfInterestPage(
  dto: PointOfInterestPageDto,
): Page<PointOfInterest> {
  return {
    page: dto.page,
    pageSize: dto.pageSize,
    totalItems: dto.totalItems,
    totalPages: dto.totalPages,
    items: dto.items.map(toPointOfInterest),
  };
}

export function toPointOfInterestQuery(query: PointOfInterestQuery): QueryParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    nameContains: query.nameContains,
    bbox: query.bbox ? toBboxParam(query.bbox) : undefined,
    from: query.overlapping ? toTimestamp(query.overlapping.startTime) : undefined,
    to: query.overlapping ? toTimestamp(query.overlapping.endTime) : undefined,
    poiCategory: query.category,
  };
}
