-- Ridgeline Operational Picture -- database schema.
--
-- Mirrors backend/openapi.yaml: the three feature collections (points of
-- interest, areas of interest, trail routes) share one table, discriminated
-- by feature_type, with a check constraint tying each type to its required
-- category column and a foreign key tying it to its required geometry type.
--
-- Source of truth: ../database-schema.pdf. PostgreSQL 16 / PostGIS 3.4.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE feature_types (
    code          text PRIMARY KEY,
    geometry_type text NOT NULL,

    CONSTRAINT feature_types_code_geometry_type_key
        UNIQUE (code, geometry_type)
);

INSERT INTO feature_types (code, geometry_type) VALUES
    ('PointOfInterest', 'POINT'),
    ('AreaOfInterest',  'POLYGON'),
    ('TrailRoute',      'LINESTRING');

CREATE TABLE features (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_type  text NOT NULL,
    name          varchar(120) NOT NULL,
    description   varchar(512),
    poi_category  text,
    area_category text,
    difficulty    text,
    geom          geometry(GeometryZ, 4326) NOT NULL,
    geom_type     text GENERATED ALWAYS AS (GeometryType(geom)) STORED,
    start_time    timestamptz,
    end_time      timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz,

    CONSTRAINT features_type_geometry_fkey
        FOREIGN KEY (feature_type, geom_type)
        REFERENCES feature_types (code, geometry_type),

    CONSTRAINT features_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT features_name_unique_per_type
        UNIQUE (feature_type, name),

    CONSTRAINT features_category_matches_type CHECK (
        (feature_type = 'PointOfInterest'
            AND poi_category IS NOT NULL
            AND area_category IS NULL AND difficulty IS NULL)
        OR (feature_type = 'AreaOfInterest'
            AND area_category IS NOT NULL
            AND poi_category IS NULL AND difficulty IS NULL)
        OR (feature_type = 'TrailRoute'
            AND difficulty IS NOT NULL
            AND poi_category IS NULL AND area_category IS NULL)
    ),

    CONSTRAINT features_window_paired
        CHECK ((start_time IS NULL) = (end_time IS NULL)),

    CONSTRAINT features_window_ordered
        CHECK (end_time >= start_time)
);

CREATE INDEX features_geom_gist   ON features USING gist (geom);
CREATE INDEX features_type_idx    ON features (feature_type);
CREATE INDEX features_window_idx  ON features (start_time, end_time)
    WHERE start_time IS NOT NULL;
