import type { CameraTier } from "../../types/enums.ts";
import type {
  CameraCone,
  CameraConeQuery,
  NewCameraCone,
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

export interface CameraConeWriteDto extends TimeWindowDto {
  name: string;
  description: string | null;
  cameraTier: CameraTier;
  headingDegrees: number;
  pitchDegrees: number;
  geometry: PointGeometryDto;
}

export interface CameraConeReadDto extends ReadWindowDto {
  id: string;
  featureType: "CameraCone";
  name: string;
  description?: string | null;
  cameraTier: CameraTier;
  headingDegrees: number;
  pitchDegrees: number;
  geometry: PointGeometryDto;
  typicalSpec: string;
  hfovDegrees: number;
  halfAngleDegrees: number;
  distanceFromVertexMetres: number;
  baseRadiusMetres: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CameraConePageDto extends PageEnvelopeDto {
  items: CameraConeReadDto[];
}

export function toCameraConeWriteDto(input: NewCameraCone): CameraConeWriteDto {
  return {
    name: input.name,
    description: input.description ?? null,
    cameraTier: input.tier,
    headingDegrees: input.headingDegrees ?? 0,
    pitchDegrees: input.pitchDegrees ?? 0,
    geometry: toPointGeometryDto(input.position),
    ...toTimeWindowDto(input.window),
  };
}

export function toCameraCone(dto: CameraConeReadDto): CameraCone {
  return {
    id: dto.id,
    featureType: "CameraCone",
    name: dto.name,
    description: dto.description ?? null,
    tier: dto.cameraTier,
    position: toCoordinate(dto.geometry.coordinates),
    headingDegrees: dto.headingDegrees,
    pitchDegrees: dto.pitchDegrees,
    typicalSpec: dto.typicalSpec,
    hfovDegrees: dto.hfovDegrees,
    halfAngleDegrees: dto.halfAngleDegrees,
    distanceFromVertexMetres: dto.distanceFromVertexMetres,
    baseRadiusMetres: dto.baseRadiusMetres,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
    window: toTimeWindow(dto),
  };
}

export function toCameraConePage(dto: CameraConePageDto): Page<CameraCone> {
  return {
    page: dto.page,
    pageSize: dto.pageSize,
    totalItems: dto.totalItems,
    totalPages: dto.totalPages,
    items: dto.items.map(toCameraCone),
  };
}

export function toCameraConeQuery(query: CameraConeQuery): QueryParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    nameContains: query.nameContains,
    bbox: query.bbox ? toBboxParam(query.bbox) : undefined,
    from: query.overlapping ? toTimestamp(query.overlapping.startTime) : undefined,
    to: query.overlapping ? toTimestamp(query.overlapping.endTime) : undefined,
    cameraTier: query.tier,
  };
}
