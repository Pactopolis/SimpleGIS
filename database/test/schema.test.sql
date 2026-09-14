-- Schema constraint tests for init/001-schema.sql.
--
-- Run against a scratch database that has already had init/001-schema.sql
-- applied, e.g.:
--
--   createdb schema_test
--   psql -v ON_ERROR_STOP=1 -d schema_test -f init/001-schema.sql
--   psql -v ON_ERROR_STOP=1 -d schema_test -f test/schema.test.sql
--
-- Every statement runs with ON_ERROR_STOP, so an unexpected error (a check
-- that should have rejected a row but didn't, or a valid row that got
-- rejected) fails the whole script with a non-zero exit code. There is no
-- test framework here — pgTAP would be one more thing to install — just
-- plain assertions and PL/pgSQL exception handlers for the negative cases.

\set ON_ERROR_STOP on

-- The four collections openapi.yaml defines must be seeded.
DO $$
DECLARE
  seeded int;
BEGIN
  SELECT count(*) INTO seeded FROM feature_types;
  IF seeded <> 4 THEN
    RAISE EXCEPTION 'expected 4 seeded feature_types, found %', seeded;
  END IF;
END $$;

-- A valid feature of each type inserts, and geom_type is derived correctly.
INSERT INTO features (feature_type, name, poi_category, geom) VALUES (
  'PointOfInterest', 'Schema Test Overlook', 'Observation',
  ST_GeomFromText('POINT Z (-106.4453 39.6403 3421.5)', 4326)
);

INSERT INTO features (feature_type, name, area_category, geom) VALUES (
  'AreaOfInterest', 'Schema Test Sector', 'Search',
  ST_GeomFromText(
    'POLYGON Z ((-106.46 39.64 3200, -106.44 39.64 3210, -106.44 39.66 3260, -106.46 39.66 3240, -106.46 39.64 3200))',
    4326
  )
);

INSERT INTO features (feature_type, name, difficulty, geom) VALUES (
  'TrailRoute', 'Schema Test Approach', 'Moderate',
  ST_GeomFromText(
    'LINESTRING Z (-106.4501 39.635 3105, -106.4478 39.6371 3188, -106.4453 39.6403 3421.5)',
    4326
  )
);

INSERT INTO features (
  feature_type, name, camera_tier, heading_degrees, pitch_degrees, geom
) VALUES (
  'CameraCone', 'Schema Test North Ridge Camera', 'Mid', 12, -8,
  ST_GeomFromText('POINT Z (-106.447 39.641 3410)', 4326)
);

DO $$
DECLARE
  mismatched int;
BEGIN
  SELECT count(*) INTO mismatched
  FROM features
  WHERE name LIKE 'Schema Test %'
    AND (
      (feature_type = 'PointOfInterest' AND geom_type <> 'POINT')
      OR (feature_type = 'AreaOfInterest' AND geom_type <> 'POLYGON')
      OR (feature_type = 'TrailRoute' AND geom_type <> 'LINESTRING')
      OR (feature_type = 'CameraCone' AND geom_type <> 'POINT')
    );
  IF mismatched <> 0 THEN
    RAISE EXCEPTION 'generated geom_type did not match feature_type for % row(s)', mismatched;
  END IF;
END $$;

-- Tier rows carry the customer-supplied canonical cone dimensions.
DO $$
DECLARE
  matching int;
BEGIN
  SELECT count(*) INTO matching
  FROM camera_tiers
  WHERE (tier = 'Low' AND typical_spec = '1080p fixed wide lens'
          AND hfov_degrees = 90 AND half_angle_degrees = 45
          AND distance_from_vertex_m = 50 AND base_radius_m = 50.0)
     OR (tier = 'Mid' AND typical_spec = '4MP varifocal'
          AND hfov_degrees = 60 AND half_angle_degrees = 30
          AND distance_from_vertex_m = 200 AND base_radius_m = 115.5)
     OR (tier = 'High' AND typical_spec = '4K PTZ / long-range thermal'
          AND hfov_degrees = 15 AND half_angle_degrees = 7.5
          AND distance_from_vertex_m = 1000 AND base_radius_m = 131.7);
  IF matching <> 3 THEN
    RAISE EXCEPTION 'camera tier specifications were not seeded correctly';
  END IF;
END $$;

-- A point cannot carry an area's geometry type.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, poi_category, geom) VALUES (
      'PointOfInterest', 'Schema Test: wrong geometry', 'Hazard',
      ST_GeomFromText('LINESTRING Z (-106.45 39.63 3100, -106.44 39.64 3200)', 4326)
    );
    RAISE EXCEPTION 'expected features_type_geometry_fkey to reject a LineString PointOfInterest';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL; -- expected
  END;
END $$;

-- Populating the wrong category column for a feature_type is rejected.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, area_category, geom) VALUES (
      'PointOfInterest', 'Schema Test: wrong category column', 'Search',
      ST_GeomFromText('POINT Z (-106.4 39.6 3000)', 4326)
    );
    RAISE EXCEPTION 'expected features_category_matches_type to reject areaCategory on a PointOfInterest';
  EXCEPTION
    WHEN check_violation THEN NULL; -- expected
  END;
END $$;

-- Camera cones require a known tier and a valid heading/pitch pair.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (
      feature_type, name, camera_tier, heading_degrees, pitch_degrees, geom
    ) VALUES (
      'CameraCone', 'Schema Test: unknown camera tier', 'Ultra', 0, 0,
      ST_GeomFromText('POINT Z (-106.4 39.6 3000)', 4326)
    );
    RAISE EXCEPTION 'expected features_camera_tier_fkey to reject an unknown camera tier';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL; -- expected
  END;

  BEGIN
    INSERT INTO features (
      feature_type, name, camera_tier, heading_degrees, pitch_degrees, geom
    ) VALUES (
      'CameraCone', 'Schema Test: bad camera heading', 'Low', 360, 0,
      ST_GeomFromText('POINT Z (-106.4 39.6 3000)', 4326)
    );
    RAISE EXCEPTION 'expected features_camera_orientation_valid to reject heading 360';
  EXCEPTION
    WHEN check_violation THEN NULL; -- expected
  END;
END $$;

-- Names are unique per feature type.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, poi_category, geom) VALUES (
      'PointOfInterest', 'Schema Test Overlook', 'Hazard',
      ST_GeomFromText('POINT Z (-106.5 39.5 3000)', 4326)
    );
    RAISE EXCEPTION 'expected features_name_unique_per_type to reject a duplicate name';
  EXCEPTION
    WHEN unique_violation THEN NULL; -- expected
  END;
END $$;

-- ...but the same name is fine on a different feature type.
INSERT INTO features (feature_type, name, difficulty, geom) VALUES (
  'TrailRoute', 'Schema Test Overlook', 'Easy',
  ST_GeomFromText('LINESTRING Z (-106.5 39.5 3000, -106.49 39.51 3010)', 4326)
);

-- A blank (or all-whitespace) name is rejected.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, poi_category, geom) VALUES (
      'PointOfInterest', '   ', 'Hazard',
      ST_GeomFromText('POINT Z (-106.5 39.5 3000)', 4326)
    );
    RAISE EXCEPTION 'expected features_name_not_blank to reject a blank name';
  EXCEPTION
    WHEN check_violation THEN NULL; -- expected
  END;
END $$;

-- startTime and endTime must be supplied together.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, poi_category, geom, start_time) VALUES (
      'PointOfInterest', 'Schema Test: unpaired window', 'Hazard',
      ST_GeomFromText('POINT Z (-106.5 39.5 3000)', 4326),
      '2026-01-01T00:00:00Z'
    );
    RAISE EXCEPTION 'expected features_window_paired to reject startTime without endTime';
  EXCEPTION
    WHEN check_violation THEN NULL; -- expected
  END;
END $$;

-- endTime must not precede startTime.
DO $$
BEGIN
  BEGIN
    INSERT INTO features (feature_type, name, poi_category, geom, start_time, end_time) VALUES (
      'PointOfInterest', 'Schema Test: inverted window', 'Hazard',
      ST_GeomFromText('POINT Z (-106.5 39.5 3000)', 4326),
      '2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'
    );
    RAISE EXCEPTION 'expected features_window_ordered to reject endTime before startTime';
  EXCEPTION
    WHEN check_violation THEN NULL; -- expected
  END;
END $$;

-- An instantaneous feature (startTime = endTime) is fine.
INSERT INTO features (feature_type, name, poi_category, geom, start_time, end_time) VALUES (
  'PointOfInterest', 'Schema Test: instant', 'Observation',
  ST_GeomFromText('POINT Z (-106.5 39.5 3000)', 4326),
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
);

\echo 'database schema tests: OK'
