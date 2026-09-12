export { API_BASE_URL } from "./baseUrl.ts";
export { ApiError, DEFAULT_BASE_URL, ERROR_CODES, request } from "./client.ts";
export type {
  ApiErrorCode,
  FetchLike,
  QueryParams,
  RequestOptions,
} from "./client.ts";

export { aborted, describeFailure } from "./failures.ts";
export { eachPage } from "./pages.ts";

export type { CallOptions } from "./resources.ts";

export {
  createPointOfInterest,
  deletePointOfInterest,
  getPointOfInterest,
  listPointsOfInterest,
  replacePointOfInterest,
} from "./pointsOfInterest.ts";

export {
  createAreaOfInterest,
  deleteAreaOfInterest,
  getAreaOfInterest,
  listAreasOfInterest,
  replaceAreaOfInterest,
} from "./areasOfInterest.ts";

export {
  createTrailRoute,
  deleteTrailRoute,
  getTrailRoute,
  listTrailRoutes,
  replaceTrailRoute,
} from "./trailRoutes.ts";
