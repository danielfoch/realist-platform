-- Additive open-data schema; existing Realist tables are preserved.
CREATE TABLE IF NOT EXISTS data_layers (
      key              text PRIMARY KEY,
      name             text NOT NULL,
      source_url       text,
      licence          text,
      attribution      text,
      geography        text,
      refresh_cadence  text,
      last_imported_at timestamp,
      row_count        integer,
      notes            text
    );
CREATE TABLE IF NOT EXISTS census_da_boundaries (
      dauid         text PRIMARY KEY,
      province_code text,
      land_area_km2 real,
      geojson       jsonb NOT NULL,
      min_lng       double precision NOT NULL,
      min_lat       double precision NOT NULL,
      max_lng       double precision NOT NULL,
      max_lat       double precision NOT NULL,
      imported_at   timestamp NOT NULL DEFAULT now()
    );
CREATE INDEX IF NOT EXISTS census_da_bbox_idx
    ON census_da_boundaries (min_lat, max_lat, min_lng, max_lng);
CREATE TABLE IF NOT EXISTS census_da_profiles (
      dauid                 text PRIMARY KEY,
      census_year           integer NOT NULL,
      profile               jsonb NOT NULL,
      imported_at           timestamp NOT NULL DEFAULT now()
    );
CREATE TABLE IF NOT EXISTS assessment_units (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source             text NOT NULL,
      municipality_code  text NOT NULL,
      municipality_name  text,
      roll_year          integer,
      matricule          text,
      address            text,
      loose_address_key  text,
      lot_number         text,
      cubf               text,
      frontage_m         real,
      lot_area_m2        double precision,
      storeys            real,
      year_built         integer,
      year_built_estimated boolean,
      floor_area_m2      real,
      dwellings          integer,
      market_ref_date    text,
      land_value         bigint,
      building_value     bigint,
      total_value        bigint,
      previous_roll_value bigint,
      imported_at        timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, municipality_code, matricule)
    );
CREATE INDEX IF NOT EXISTS assessment_units_loose_key_idx
    ON assessment_units (loose_address_key);
CREATE INDEX IF NOT EXISTS assessment_units_muni_idx
    ON assessment_units (municipality_code);
CREATE TABLE IF NOT EXISTS building_permits (
      id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source            text NOT NULL,
      permit_number     text NOT NULL,
      city              text,
      province          text,
      address           text,
      loose_address_key text,
      permit_type       text,
      work_type         text,
      status            text,
      description       text,
      units             integer,
      estimated_value   double precision,
      issued_date       date,
      lat               double precision,
      lng               double precision,
      imported_at       timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, permit_number)
    );
CREATE INDEX IF NOT EXISTS building_permits_loose_key_idx
    ON building_permits (loose_address_key);
CREATE INDEX IF NOT EXISTS building_permits_latlng_idx
    ON building_permits (lat, lng);
CREATE TABLE IF NOT EXISTS development_applications (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source             text NOT NULL,
      application_number text NOT NULL,
      application_type   text,
      status             text,
      address            text,
      description        text,
      date_submitted     date,
      ward_number        text,
      ward_name          text,
      application_url    text,
      lat                double precision,
      lng                double precision,
      imported_at        timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, application_number)
    );
CREATE INDEX IF NOT EXISTS development_applications_latlng_idx
    ON development_applications (lat, lng);
CREATE TABLE IF NOT EXISTS toronto_parcels (
      parcel_id   text PRIMARY KEY,
      lot_area_m2 double precision,
      geojson     jsonb NOT NULL,
      min_lng     double precision NOT NULL,
      min_lat     double precision NOT NULL,
      max_lng     double precision NOT NULL,
      max_lat     double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    );
CREATE INDEX IF NOT EXISTS toronto_parcels_bbox_idx
    ON toronto_parcels (min_lat, max_lat, min_lng, max_lng);
CREATE TABLE IF NOT EXISTS municipal_wards (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      city        text NOT NULL,
      ward_code   text NOT NULL,
      ward_name   text,
      geojson     jsonb NOT NULL,
      min_lng     double precision NOT NULL,
      min_lat     double precision NOT NULL,
      max_lng     double precision NOT NULL,
      max_lat     double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (city, ward_code)
    );
CREATE INDEX IF NOT EXISTS municipal_wards_bbox_idx
    ON municipal_wards (city, min_lat, max_lat, min_lng, max_lng);
CREATE TABLE IF NOT EXISTS coa_applications (
      id                     varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source                 text NOT NULL,
      reference_file         text NOT NULL,
      sys_id                 text,
      application_type       text,
      sub_type               text,
      work_type              text,
      status                 text,
      decision               text,
      omb_decision           text,
      address                text,
      loose_address_key      text,
      ward_number            text,
      ward_name              text,
      zoning_review          text,
      zoning_designation     text,
      description            text,
      in_date                text,
      hearing_date           text,
      final_date             text,
      number_of_lots_created integer,
      application_url        text,
      imported_at            timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, reference_file)
    );
CREATE INDEX IF NOT EXISTS coa_applications_loose_key_idx
    ON coa_applications (loose_address_key);
CREATE TABLE IF NOT EXISTS toronto_zoning_polygons (id bigserial PRIMARY KEY, zone_code text NOT NULL, zone_category text, geojson jsonb NOT NULL, min_lng double precision NOT NULL,min_lat double precision NOT NULL,max_lng double precision NOT NULL,max_lat double precision NOT NULL,imported_at timestamp NOT NULL DEFAULT now(), feature_id text UNIQUE);
CREATE INDEX IF NOT EXISTS toronto_zoning_bbox_idx ON toronto_zoning_polygons(min_lat,max_lat,min_lng,max_lng);
CREATE TABLE IF NOT EXISTS property_import_runs(key text PRIMARY KEY, status text NOT NULL, expected_rows bigint, processed_rows bigint NOT NULL DEFAULT 0, rejected_rows bigint NOT NULL DEFAULT 0,cursor jsonb NOT NULL DEFAULT '{}'::jsonb, started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,source_updated_at timestamptz,error text);
CREATE TABLE IF NOT EXISTS property_import_files(dataset_key text NOT NULL,file_key text NOT NULL,status text NOT NULL,row_count bigint,sha256 text,error text,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(dataset_key,file_key));
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS bedrooms real;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS bathrooms real;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS land_use text;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
CREATE INDEX IF NOT EXISTS assessment_units_source_idx ON assessment_units(source);
CREATE TABLE IF NOT EXISTS assessment_history (source text NOT NULL, account_number text NOT NULL, roll_year integer NOT NULL, address text, city text, province text, land_value bigint, building_value bigint, total_value bigint, taxable_value bigint, imported_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY(source,account_number,roll_year));
CREATE TABLE IF NOT EXISTS ns_property_land(account_number text PRIMARY KEY, lot_area_m2 double precision,lat double precision,lng double precision,imported_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS national_addresses(address_id uuid PRIMARY KEY,location_id uuid,civic_number text,unit text,address text,mailing_address text,street_key text,mailing_street_key text,city text,city_fr text,mailing_city text,city_key text,city_fr_key text,mailing_city_key text,province text,postal_code text,latitude double precision,longitude double precision,coordinate_kind text,csduid text,building_usage text,reference_date date NOT NULL DEFAULT '2026-06-26',imported_at timestamp NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS national_addresses_official_idx ON national_addresses(street_key,province,city_key);
CREATE INDEX IF NOT EXISTS national_addresses_mailing_idx ON national_addresses(mailing_street_key,province,mailing_city_key);
CREATE INDEX IF NOT EXISTS census_da_gist_idx ON census_da_boundaries USING gist (box(point(min_lng,min_lat),point(max_lng,max_lat)));
CREATE INDEX IF NOT EXISTS toronto_parcels_gist_idx ON toronto_parcels USING gist (box(point(min_lng,min_lat),point(max_lng,max_lat)));
CREATE TABLE IF NOT EXISTS national_locations(location_id uuid PRIMARY KEY,latitude double precision,longitude double precision,blockface_latitude double precision,blockface_longitude double precision,csduid text,eruid text,feduid text,imported_at timestamp NOT NULL DEFAULT now());
ALTER TABLE census_da_boundaries ADD COLUMN IF NOT EXISTS simplification_m double precision NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS development_application_sites (
 source text NOT NULL, source_record_id text NOT NULL, application_number text NOT NULL,
 application_type text, status text, address text, description text, date_submitted date,
 ward_number text, ward_name text, application_url text, lat double precision, lng double precision,
 imported_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY(source,source_record_id)
);
CREATE INDEX IF NOT EXISTS development_sites_latlng_idx ON development_application_sites(lat,lng);
CREATE INDEX IF NOT EXISTS toronto_zoning_gist_idx ON toronto_zoning_polygons USING gist (box(point(min_lng,min_lat),point(max_lng,max_lat)));
ALTER TABLE assessment_units ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
