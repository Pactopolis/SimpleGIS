export const ERROR_CODES = [
  "malformed_body",
  "array_body_not_supported",
  "unknown_property",
  "invalid_query_parameter",
  "not_found",
  "name_conflict",
  "payload_too_large",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

// "internal_error" is not part of the spec's documented enum — it only ever
// appears if a bug lets an unexpected exception escape request handling.
export type ResponseCode = ErrorCode | "internal_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ResponseCode;

  constructor(status: number, code: ResponseCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
