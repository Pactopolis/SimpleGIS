#!/usr/bin/env python3
"""Mock Ridgeline Operational Picture API.

Serves the openapi.yaml contract from memory. Stop the process and the data
is gone. Standard library only.

    python3 server.py --port 8080
"""

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

from catalog import COLLECTIONS, Collection
from store import FeatureStore
from validation import ApiError, read_feature_body, read_list_query

BASE_PATH = "/v1"
MAX_BODY_BYTES = 1_048_576
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8080

COLLECTION_METHODS = ("GET", "POST", "OPTIONS")
FEATURE_METHODS = ("GET", "PUT", "DELETE", "OPTIONS")

STORE = FeatureStore()


class RidgelineHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ridgeline-mock"
    sys_version = ""

    def version_string(self) -> str:
        return self.server_version

    def do_GET(self) -> None:
        self._handle("GET")

    def do_POST(self) -> None:
        self._handle("POST")

    def do_PUT(self) -> None:
        self._handle("PUT")

    def do_PATCH(self) -> None:
        self._handle("PATCH")

    def do_DELETE(self) -> None:
        self._handle("DELETE")

    def do_OPTIONS(self) -> None:
        self._handle("OPTIONS")

    def _handle(self, method: str) -> None:
        try:
            self._route(method)
        except ApiError as error:
            self._send_error(error)
        except Exception as error:  # noqa: BLE001 - a mock should not die on a bug
            self.log_error("unhandled: %s", error)
            self._send_error(
                ApiError(500, "internal_error", "The mock server failed.")
            )

    def _route(self, method: str) -> None:
        url = urlsplit(self.path)
        segments = [unquote(part) for part in url.path.split("/") if part]
        base = [part for part in BASE_PATH.split("/") if part]

        if segments[: len(base)] != base:
            raise ApiError(404, "not_found", "No such resource.")

        rest = segments[len(base) :]

        if not rest or rest[0] not in COLLECTIONS:
            raise ApiError(404, "not_found", "No such resource.")

        collection = COLLECTIONS[rest[0]]

        if len(rest) == 1:
            self._collection(method, collection, url.query)
            return

        if len(rest) == 2:
            self._feature(method, collection, rest[1])
            return

        raise ApiError(404, "not_found", "No such resource.")

    def _collection(self, method: str, collection: Collection, query: str) -> None:
        if method == "OPTIONS":
            self._send_preflight(COLLECTION_METHODS)
            return

        if method == "GET":
            self._send_page(collection, query)
            return

        if method == "POST":
            body = read_feature_body(collection, self._read_json())
            feature = STORE.create(collection, body)
            self._send_json(
                201, feature, {"Location": self._location(collection, feature["id"])}
            )
            return

        self._send_not_allowed(COLLECTION_METHODS)

    def _feature(self, method: str, collection: Collection, feature_id: str) -> None:
        if method == "OPTIONS":
            self._send_preflight(FEATURE_METHODS)
            return

        if method == "GET":
            self._send_json(200, STORE.get(collection, feature_id))
            return

        if method == "PUT":
            body = read_feature_body(collection, self._read_json())
            self._send_json(200, STORE.replace(collection, feature_id, body))
            return

        if method == "DELETE":
            STORE.delete(collection, feature_id)
            self._send_json(204, None)
            return

        self._send_not_allowed(FEATURE_METHODS)

    def _send_page(self, collection: Collection, query: str) -> None:
        parsed = read_list_query(collection, parse_qs(query, keep_blank_values=True))
        items, total = STORE.list(collection, parsed)
        total_pages = -(-total // parsed.page_size)

        self._send_json(
            200,
            {
                "page": parsed.page,
                "pageSize": parsed.page_size,
                "totalItems": total,
                "totalPages": total_pages,
                "items": items,
            },
        )

    def _read_json(self) -> object:
        header = self.headers.get("Content-Length")

        if header is None:
            raise ApiError(400, "malformed_body", "A request body is required.")

        try:
            length = int(header)
        except ValueError as error:
            raise ApiError(
                400, "malformed_body", "'Content-Length' must be an integer."
            ) from error

        if length > MAX_BODY_BYTES:
            self.close_connection = True
            raise ApiError(413, "payload_too_large", "The request body exceeds 1 MB.")

        raw = self.rfile.read(length)

        try:
            return json.loads(raw)
        except ValueError as error:
            raise ApiError(400, "malformed_body", "The body is not valid JSON.") from error

    def _location(self, collection: Collection, feature_id: str) -> str:
        host = self.headers.get("Host") or f"{DEFAULT_HOST}:{DEFAULT_PORT}"

        return f"http://{host}{BASE_PATH}/{collection.path}/{feature_id}"

    def _send_json(
        self, status: int, payload: object, headers: dict[str, str] | None = None
    ) -> None:
        body = (
            b""
            if payload is None
            else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        )

        self.send_response(status)

        for name, value in (headers or {}).items():
            self.send_header(name, value)

        if body:
            self.send_header("Content-Type", "application/json")

        if status != 204:
            self.send_header("Content-Length", str(len(body)))
        self._send_cors()
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, error: ApiError) -> None:
        self._send_json(
            error.status,
            {"code": error.code, "message": error.message, "traceId": None},
        )

    def _send_preflight(self, methods: tuple[str, ...]) -> None:
        requested = self.headers.get("Access-Control-Request-Headers", "Content-Type")

        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", ", ".join(methods))
        self.send_header("Access-Control-Allow-Headers", requested)
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self._send_cors()
        self.end_headers()

    def _send_not_allowed(self, methods: tuple[str, ...]) -> None:
        self._send_json(
            405,
            {
                "code": "not_found",
                "message": f"Allowed methods: {', '.join(methods)}.",
                "traceId": None,
            },
            {"Allow": ", ".join(methods)},
        )

    def _send_cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Expose-Headers", "Location")
        self.send_header("Vary", "Origin")

    def log_message(self, format: str, *args: object) -> None:
        sys.stderr.write(f"{self.log_date_time_string()} {format % args}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.environ.get("HOST", DEFAULT_HOST))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("PORT", DEFAULT_PORT))
    )
    options = parser.parse_args()

    server = ThreadingHTTPServer((options.host, options.port), RidgelineHandler)
    print(f"ridgeline mock api on http://{options.host}:{options.port}{BASE_PATH}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
