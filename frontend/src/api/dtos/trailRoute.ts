import type { TrailDifficulty } from "../../types/enums.ts";
import type {
  NewTrailRoute,
  TrailRoute,
  TrailRouteQuery,
} from "../../types/features.ts";
import type { Page } from "../../types/paging.ts";
import type { QueryParams } from "../client.ts";
import {
  toBboxParam,
  toLineStringGeometryDto,
  toPath,
  toTimestamp,
  toTimeWindow,
  toTimeWindowDto,
  type LineStringGeometryDto,
  type PageEnvelopeDto,
  type ReadWindowDto,
  type TimeWindowDto,
} from "./common.ts";

export interface TrailRouteWriteDto extends TimeWindowDto {
  name: string;
  description: string | null;
  difficulty: TrailDifficulty;
  geometry: LineStringGeometryDto;
}

export interface TrailRouteReadDto extends ReadWindowDto {
  id: string;
  featureType: "TrailRoute";
  name: string;
  description?: string | null;
  difficulty: TrailDifficulty;
  geometry: LineStringGeometryDto;
  lengthMetres?: number | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface TrailRoutePageDto extends PageEnvelopeDto {
  items: TrailRouteReadDto[];
}

export function toTrailRouteWriteDto(input: NewTrailRoute): TrailRouteWriteDto {
  return {
    name: input.name,
    description: input.description ?? null,
    difficulty: input.difficulty,
    geometry: toLineStringGeometryDto(input.path),
    ...toTimeWindowDto(input.window),
  };
}

export function toTrailRoute(dto: TrailRouteReadDto): TrailRoute {
  return {
    id: dto.id,
    featureType: "TrailRoute",
    name: dto.name,
    description: dto.description ?? null,
    difficulty: dto.difficulty,
    path: toPath(dto.geometry),
    lengthMetres: dto.lengthMetres ?? null,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
    window: toTimeWindow(dto),
  };
}

export function toTrailRoutePage(dto: TrailRoutePageDto): Page<TrailRoute> {
  return {
    page: dto.page,
    pageSize: dto.pageSize,
    totalItems: dto.totalItems,
    totalPages: dto.totalPages,
    items: dto.items.map(toTrailRoute),
  };
}

export function toTrailRouteQuery(query: TrailRouteQuery): QueryParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    nameContains: query.nameContains,
    bbox: query.bbox ? toBboxParam(query.bbox) : undefined,
    from: query.overlapping ? toTimestamp(query.overlapping.startTime) : undefined,
    to: query.overlapping ? toTimestamp(query.overlapping.endTime) : undefined,
    difficulty: query.difficulty,
  };
}
