"""The three feature collections the spec defines."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Collection:
    path: str
    feature_type: str
    category_field: str
    categories: tuple[str, ...]
    geometry_type: str
    measurement_field: str | None


POINTS_OF_INTEREST = Collection(
    path="points-of-interest",
    feature_type="PointOfInterest",
    category_field="poiCategory",
    categories=("Landmark", "Hazard", "Waypoint", "Facility", "Observation"),
    geometry_type="Point",
    measurement_field=None,
)

AREAS_OF_INTEREST = Collection(
    path="areas-of-interest",
    feature_type="AreaOfInterest",
    category_field="areaCategory",
    categories=("Restricted", "Search", "Staging", "Hazard", "Coverage"),
    geometry_type="Polygon",
    measurement_field="areaSquareMetres",
)

TRAIL_ROUTES = Collection(
    path="trail-routes",
    feature_type="TrailRoute",
    category_field="difficulty",
    categories=("Easy", "Moderate", "Difficult", "Expert"),
    geometry_type="LineString",
    measurement_field="lengthMetres",
)

COLLECTIONS: dict[str, Collection] = {
    collection.path: collection
    for collection in (POINTS_OF_INTEREST, AREAS_OF_INTEREST, TRAIL_ROUTES)
}
