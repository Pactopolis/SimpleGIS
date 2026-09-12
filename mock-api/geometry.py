"""Planar geometry helpers.

Positions are GeoJSON order — longitude, latitude, elevation. Measurements use
an equirectangular projection about the shape's mean latitude, which is close
enough over a single feature and keeps the server dependency-free.
"""

import math

METRES_PER_DEGREE = 111_320.0

Position = list[float]


def positions_of(geometry: dict) -> list[Position]:
    coordinates = geometry["coordinates"]

    if geometry["type"] == "Point":
        return [coordinates]

    if geometry["type"] == "LineString":
        return list(coordinates)

    return [position for ring in coordinates for position in ring]


def bounds(geometry: dict) -> tuple[float, float, float, float]:
    positions = positions_of(geometry)
    longitudes = [position[0] for position in positions]
    latitudes = [position[1] for position in positions]

    return (min(longitudes), min(latitudes), max(longitudes), max(latitudes))


def measure(geometry: dict) -> float | None:
    if geometry["type"] == "LineString":
        return _length_metres(geometry["coordinates"])

    if geometry["type"] == "Polygon":
        return _area_square_metres(geometry["coordinates"])

    return None


def _length_metres(positions: list[Position]) -> float:
    plane = _project(positions)
    segments = zip(plane, plane[1:])

    return sum(math.dist(start, end) for start, end in segments)


def _area_square_metres(rings: list[list[Position]]) -> float:
    exterior, *interiors = rings
    area = _shoelace(exterior) - sum(_shoelace(ring) for ring in interiors)

    return max(area, 0.0)


def _shoelace(ring: list[Position]) -> float:
    plane = _project(ring)
    closed = plane if plane[0] == plane[-1] else [*plane, plane[0]]
    total = sum(
        start[0] * end[1] - end[0] * start[1]
        for start, end in zip(closed, closed[1:])
    )

    return abs(total) / 2


def _project(positions: list[Position]) -> list[tuple[float, float]]:
    reference = sum(position[1] for position in positions) / len(positions)
    scale = math.cos(math.radians(reference))

    return [
        (position[0] * scale * METRES_PER_DEGREE, position[1] * METRES_PER_DEGREE)
        for position in positions
    ]
