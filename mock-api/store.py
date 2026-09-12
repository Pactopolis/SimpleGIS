"""In-memory feature storage. Nothing survives the process."""

import uuid
from datetime import datetime, timezone
from threading import RLock

import geometry
from catalog import COLLECTIONS, Collection
from validation import ApiError, FeatureBody, ListQuery, parse_rfc3339, to_rfc3339


class FeatureStore:
    def __init__(self) -> None:
        self._features: dict[str, dict[str, dict]] = {
            path: {} for path in COLLECTIONS
        }
        self._lock = RLock()

    def list(
        self, collection: Collection, query: ListQuery
    ) -> tuple[list[dict], int]:
        with self._lock:
            features = list(self._features[collection.path].values())

        matches = [
            feature for feature in features if _matches(feature, collection, query)
        ]
        matches.sort(key=lambda feature: (feature["createdAt"], feature["id"]))
        start = (query.page - 1) * query.page_size

        return (matches[start : start + query.page_size], len(matches))

    def get(self, collection: Collection, feature_id: str) -> dict:
        with self._lock:
            feature = self._features[collection.path].get(feature_id)

        if feature is None:
            raise ApiError(404, "not_found", "No such feature.")

        return feature

    def create(self, collection: Collection, body: FeatureBody) -> dict:
        with self._lock:
            self._reject_duplicate_name(collection, body.name, None)

            feature = _build(collection, body)
            feature["id"] = str(uuid.uuid4())
            feature["createdAt"] = to_rfc3339(datetime.now(timezone.utc))
            feature["updatedAt"] = None
            self._features[collection.path][feature["id"]] = feature

        return feature

    def replace(
        self, collection: Collection, feature_id: str, body: FeatureBody
    ) -> dict:
        with self._lock:
            existing = self.get(collection, feature_id)
            self._reject_duplicate_name(collection, body.name, feature_id)

            feature = _build(collection, body)
            feature["id"] = existing["id"]
            feature["createdAt"] = existing["createdAt"]
            feature["updatedAt"] = to_rfc3339(datetime.now(timezone.utc))
            self._features[collection.path][feature_id] = feature

        return feature

    def delete(self, collection: Collection, feature_id: str) -> None:
        with self._lock:
            self.get(collection, feature_id)
            del self._features[collection.path][feature_id]

    def _reject_duplicate_name(
        self, collection: Collection, name: str, feature_id: str | None
    ) -> None:
        taken = any(
            feature["name"] == name and feature["id"] != feature_id
            for feature in self._features[collection.path].values()
        )

        if taken:
            raise ApiError(
                409,
                "name_conflict",
                f"Another {collection.feature_type} already uses that name.",
            )


def _build(collection: Collection, body: FeatureBody) -> dict:
    feature = {
        "id": "",
        "featureType": collection.feature_type,
        "name": body.name,
        "description": body.description,
        collection.category_field: body.category,
        "geometry": body.geometry,
        "startTime": to_rfc3339(body.start_time) if body.start_time else None,
        "endTime": to_rfc3339(body.end_time) if body.end_time else None,
        "createdAt": "",
        "updatedAt": None,
    }

    if collection.measurement_field is not None:
        feature[collection.measurement_field] = geometry.measure(body.geometry)

    return feature


def _matches(feature: dict, collection: Collection, query: ListQuery) -> bool:
    return (
        _matches_name(feature, query.name_contains)
        and _matches_category(feature, collection, query.category)
        and _matches_bbox(feature, query.bbox)
        and _matches_window(feature, query.window)
    )


def _matches_name(feature: dict, name_contains: str | None) -> bool:
    return name_contains is None or name_contains.lower() in feature["name"].lower()


def _matches_category(
    feature: dict, collection: Collection, category: str | None
) -> bool:
    return category is None or feature[collection.category_field] == category


def _matches_bbox(
    feature: dict, bbox: tuple[float, float, float, float] | None
) -> bool:
    if bbox is None:
        return True

    min_lon, min_lat, max_lon, max_lat = bbox
    west, south, east, north = geometry.bounds(feature["geometry"])

    return west <= max_lon and east >= min_lon and south <= max_lat and north >= min_lat


def _matches_window(feature: dict, window: tuple[datetime, datetime] | None) -> bool:
    if window is None:
        return True

    if feature["startTime"] is None:
        return False

    start = parse_rfc3339(feature["startTime"])
    end = parse_rfc3339(feature["endTime"])

    if start is None or end is None:
        return False

    requested_start, requested_end = window

    return start <= requested_end and end >= requested_start
