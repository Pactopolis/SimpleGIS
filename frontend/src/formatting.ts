import type { FeatureType } from "./types/enums.ts";
import type { Feature, TimeWindow } from "./types/features.ts";
import type { Coordinate } from "./types/geometry.ts";

const MOMENT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const MINUTE = 60_000;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

export const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  PointOfInterest: "Point of interest",
  TrailRoute: "Trail route",
  AreaOfInterest: "Area of interest",
  CameraCone: "Camera cone",
};

export function formatFeatureType(feature: Feature): string {
  return FEATURE_TYPE_LABELS[feature.featureType];
}

export function formatFeatureClass(feature: Feature): string {
  if (feature.featureType === "TrailRoute") return feature.difficulty;
  if (feature.featureType === "CameraCone") return feature.tier;
  return feature.category;
}

export function formatDuration(window: TimeWindow): string {
  const span = window.endTime.getTime() - window.startTime.getTime();

  if (span <= 0) {
    return "Instant";
  }

  if (span < HOUR) {
    return `${Math.round(span / MINUTE)} min`;
  }

  return span < DAY * 2
    ? `${(span / HOUR).toFixed(1)} h`
    : `${(span / DAY).toFixed(1)} d`;
}

export function formatCoordinate(position: Coordinate): string {
  return `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)} · ${Math.round(
    position.elevationMetres,
  )} m`;
}

export function formatMoment(value: Date): string {
  return MOMENT.format(value);
}

export function formatLength(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

export function formatArea(squareMetres: number): string {
  return squareMetres >= 1e6
    ? `${(squareMetres / 1e6).toFixed(2)} km²`
    : `${Math.round(squareMetres)} m²`;
}
