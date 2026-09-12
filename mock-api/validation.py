"""Request validation, expressed against the spec's error envelope.

Every rejection raises ApiError, which the server renders as the uniform
error body. The spec's code enum has no member for field-level failures, so
anything wrong inside an otherwise parseable object body is malformed_body.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from catalog import Collection

MAX_NAME_LENGTH = 120
MAX_DESCRIPTION_LENGTH = 512
MAX_PATH_POSITIONS = 10_000
MIN_RING_POSITIONS = 4
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
POSITION_LENGTH = 3

MARKUP = re.compile(r"<[^<>]*>")
BBOX = re.compile(r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$")
RFC3339 = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?"
    r"(Z|[+-]\d{2}:\d{2})$",
    re.IGNORECASE,
)

BODY_FIELDS = ("name", "description", "geometry", "startTime", "endTime")
QUERY_FIELDS = ("page", "pageSize", "nameContains", "bbox", "from", "to")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True)
class FeatureBody:
    name: str
    description: str | None
    category: str
    geometry: dict
    start_time: datetime | None
    end_time: datetime | None


@dataclass(frozen=True)
class ListQuery:
    page: int
    page_size: int
    name_contains: str | None
    bbox: tuple[float, float, float, float] | None
    window: tuple[datetime, datetime] | None
    category: str | None


def read_feature_body(collection: Collection, payload: object) -> FeatureBody:
    if isinstance(payload, list):
        raise ApiError(
            400,
            "array_body_not_supported",
            "The request body must be a single object, not an array.",
        )

    if not isinstance(payload, dict):
        raise ApiError(400, "malformed_body", "The request body must be an object.")

    allowed = {*BODY_FIELDS, collection.category_field}
    unknown = sorted(set(payload) - allowed)

    if unknown:
        raise ApiError(
            400, "unknown_property", f"Unknown property '{unknown[0]}'."
        )

    start_time, end_time = _read_window(payload)

    return FeatureBody(
        name=_read_name(payload),
        description=_read_description(payload),
        category=_read_category(collection, payload),
        geometry=_read_geometry(collection, payload),
        start_time=start_time,
        end_time=end_time,
    )


def read_list_query(collection: Collection, raw: dict[str, list[str]]) -> ListQuery:
    allowed = {*QUERY_FIELDS, collection.category_field}
    unknown = sorted(set(raw) - allowed)

    if unknown:
        raise ApiError(
            400,
            "invalid_query_parameter",
            f"Unknown query parameter '{unknown[0]}'.",
        )

    repeated = sorted(name for name, values in raw.items() if len(values) > 1)

    if repeated:
        raise ApiError(
            400,
            "invalid_query_parameter",
            f"Query parameter '{repeated[0]}' was supplied more than once.",
        )

    query = {name: values[0] for name, values in raw.items()}

    return ListQuery(
        page=_read_bounded_integer(query, "page", 1, None, 1),
        page_size=_read_bounded_integer(
            query, "pageSize", 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE
        ),
        name_contains=_read_name_contains(query),
        bbox=_read_bbox(query),
        window=_read_query_window(query),
        category=_read_query_category(collection, query),
    )


def to_rfc3339(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_rfc3339(value: str) -> datetime | None:
    """Parse an RFC 3339 timestamp. An offset is part of the grammar, so a bare
    local date-time fails here rather than in a separate check."""
    match = RFC3339.match(value)

    if match is None:
        return None

    year, month, day, hour, minute, second, fraction, offset = match.groups()
    microsecond = min(int(float(fraction or 0) * 1_000_000), 999_999)

    try:
        return datetime(
            int(year),
            int(month),
            int(day),
            int(hour),
            int(minute),
            int(second),
            microsecond,
            _offset(offset),
        )
    except ValueError:
        return None


def _offset(offset: str) -> timezone:
    if offset.upper() == "Z":
        return timezone.utc

    sign = -1 if offset[0] == "-" else 1
    hours, minutes = int(offset[1:3]), int(offset[4:6])

    return timezone(sign * timedelta(hours=hours, minutes=minutes))


def _read_name(payload: dict) -> str:
    if "name" not in payload:
        raise ApiError(400, "malformed_body", "'name' is required.")

    name = payload["name"]

    if not isinstance(name, str):
        raise ApiError(400, "malformed_body", "'name' must be a string.")

    if not name.strip():
        raise ApiError(400, "malformed_body", "'name' must not be blank.")

    if len(name) > MAX_NAME_LENGTH:
        raise ApiError(
            400,
            "malformed_body",
            f"'name' must be at most {MAX_NAME_LENGTH} characters.",
        )

    return name


def _read_description(payload: dict) -> str | None:
    description = payload.get("description")

    if description is None:
        return None

    if not isinstance(description, str):
        raise ApiError(400, "malformed_body", "'description' must be a string.")

    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise ApiError(
            400,
            "malformed_body",
            f"'description' must be at most {MAX_DESCRIPTION_LENGTH} characters.",
        )

    if MARKUP.search(description):
        raise ApiError(400, "malformed_body", "'description' must be plain text.")

    return description


def _read_category(collection: Collection, payload: dict) -> str:
    field = collection.category_field

    if field not in payload:
        raise ApiError(400, "malformed_body", f"'{field}' is required.")

    category = payload[field]

    if category not in collection.categories:
        allowed = ", ".join(collection.categories)
        raise ApiError(400, "malformed_body", f"'{field}' must be one of: {allowed}.")

    return category


def _read_window(payload: dict) -> tuple[datetime | None, datetime | None]:
    start = payload.get("startTime")
    end = payload.get("endTime")

    if (start is None) != (end is None):
        raise ApiError(
            400,
            "malformed_body",
            "'startTime' and 'endTime' must be supplied together.",
        )

    if start is None:
        return (None, None)

    start_time = _read_timestamp(start, "startTime")
    end_time = _read_timestamp(end, "endTime")

    if end_time < start_time:
        raise ApiError(
            400, "malformed_body", "'endTime' must be at or after 'startTime'."
        )

    return (start_time, end_time)


def _read_timestamp(value: object, field: str) -> datetime:
    moment = parse_rfc3339(value) if isinstance(value, str) else None

    if moment is None:
        raise ApiError(
            400,
            "malformed_body",
            f"'{field}' must be an RFC 3339 timestamp with a UTC offset.",
        )

    return moment


def _read_geometry(collection: Collection, payload: dict) -> dict:
    if "geometry" not in payload:
        raise ApiError(400, "malformed_body", "'geometry' is required.")

    geometry = payload["geometry"]

    if not isinstance(geometry, dict):
        raise ApiError(400, "malformed_body", "'geometry' must be an object.")

    unknown = sorted(set(geometry) - {"type", "coordinates"})

    if unknown:
        raise ApiError(
            400,
            "unknown_property",
            f"Unknown property 'geometry.{unknown[0]}'.",
        )

    if geometry.get("type") != collection.geometry_type:
        raise ApiError(
            400,
            "malformed_body",
            f"'geometry.type' must be '{collection.geometry_type}'.",
        )

    if "coordinates" not in geometry:
        raise ApiError(400, "malformed_body", "'geometry.coordinates' is required.")

    coordinates = geometry["coordinates"]

    if collection.geometry_type == "Point":
        return {
            "type": "Point",
            "coordinates": _read_position(coordinates, "geometry.coordinates"),
        }

    if collection.geometry_type == "LineString":
        return {"type": "LineString", "coordinates": _read_path(coordinates)}

    return {"type": "Polygon", "coordinates": _read_rings(coordinates)}


def _read_path(coordinates: object) -> list[list[float]]:
    if not isinstance(coordinates, list):
        raise ApiError(400, "malformed_body", "'geometry.coordinates' must be an array.")

    if not 2 <= len(coordinates) <= MAX_PATH_POSITIONS:
        raise ApiError(
            400,
            "malformed_body",
            "A LineString needs between 2 and "
            f"{MAX_PATH_POSITIONS} positions.",
        )

    return [
        _read_position(position, f"geometry.coordinates[{index}]")
        for index, position in enumerate(coordinates)
    ]


def _read_rings(coordinates: object) -> list[list[list[float]]]:
    if not isinstance(coordinates, list) or not coordinates:
        raise ApiError(
            400,
            "malformed_body",
            "A Polygon needs at least an exterior ring.",
        )

    return [_read_ring(ring, index) for index, ring in enumerate(coordinates)]


def _read_ring(ring: object, index: int) -> list[list[float]]:
    label = f"geometry.coordinates[{index}]"

    if not isinstance(ring, list) or len(ring) < MIN_RING_POSITIONS:
        raise ApiError(
            400,
            "malformed_body",
            f"Ring {label} needs at least {MIN_RING_POSITIONS} positions.",
        )

    positions = [
        _read_position(position, f"{label}[{offset}]")
        for offset, position in enumerate(ring)
    ]

    if positions[0] != positions[-1]:
        raise ApiError(
            400,
            "malformed_body",
            f"Ring {label} must close — the first and last positions must match.",
        )

    return positions


def _read_position(position: object, label: str) -> list[float]:
    if not isinstance(position, list) or len(position) != POSITION_LENGTH:
        raise ApiError(
            400,
            "malformed_body",
            f"{label} must be a position of longitude, latitude and elevation.",
        )

    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in position):
        raise ApiError(400, "malformed_body", f"{label} must hold three numbers.")

    return [float(value) for value in position]


def _read_bounded_integer(
    query: dict[str, str],
    field: str,
    minimum: int,
    maximum: int | None,
    default: int,
) -> int:
    if field not in query:
        return default

    try:
        value = int(query[field])
    except ValueError as error:
        raise ApiError(
            400, "invalid_query_parameter", f"'{field}' must be an integer."
        ) from error

    if value < minimum or (maximum is not None and value > maximum):
        limit = f"at least {minimum}" if maximum is None else f"between {minimum} and {maximum}"
        raise ApiError(400, "invalid_query_parameter", f"'{field}' must be {limit}.")

    return value


def _read_name_contains(query: dict[str, str]) -> str | None:
    if "nameContains" not in query:
        return None

    value = query["nameContains"]

    if not 1 <= len(value) <= MAX_NAME_LENGTH:
        raise ApiError(
            400,
            "invalid_query_parameter",
            f"'nameContains' must be 1 to {MAX_NAME_LENGTH} characters.",
        )

    return value


def _read_bbox(query: dict[str, str]) -> tuple[float, float, float, float] | None:
    if "bbox" not in query:
        return None

    value = query["bbox"]

    if not BBOX.match(value):
        raise ApiError(
            400,
            "invalid_query_parameter",
            "'bbox' must be minLon,minLat,maxLon,maxLat in decimal degrees.",
        )

    min_lon, min_lat, max_lon, max_lat = (float(part) for part in value.split(","))

    if min_lon > max_lon or min_lat > max_lat:
        raise ApiError(
            400,
            "invalid_query_parameter",
            "'bbox' minimums must not exceed its maximums.",
        )

    return (min_lon, min_lat, max_lon, max_lat)


def _read_query_window(query: dict[str, str]) -> tuple[datetime, datetime] | None:
    has_from = "from" in query
    has_to = "to" in query

    if has_from != has_to:
        raise ApiError(
            400,
            "invalid_query_parameter",
            "'from' and 'to' must be supplied together.",
        )

    if not has_from:
        return None

    start = _read_query_timestamp(query["from"], "from")
    end = _read_query_timestamp(query["to"], "to")

    if end < start:
        raise ApiError(
            400, "invalid_query_parameter", "'to' must be at or after 'from'."
        )

    return (start, end)


def _read_query_timestamp(value: str, field: str) -> datetime:
    moment = parse_rfc3339(value)

    if moment is None:
        raise ApiError(
            400,
            "invalid_query_parameter",
            f"'{field}' must be an RFC 3339 timestamp with a UTC offset.",
        )

    return moment


def _read_query_category(collection: Collection, query: dict[str, str]) -> str | None:
    field = collection.category_field

    if field not in query:
        return None

    category = query[field]

    if category not in collection.categories:
        allowed = ", ".join(collection.categories)
        raise ApiError(
            400, "invalid_query_parameter", f"'{field}' must be one of: {allowed}."
        )

    return category
