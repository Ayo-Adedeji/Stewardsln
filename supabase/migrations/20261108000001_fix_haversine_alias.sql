-- ============================================================================
-- MIGRATION: 20261108000001_fix_haversine_alias.sql
-- PURPOSE: Migration 20261103000002 changed GPS function calls to use
--          public.haversine_distance_m but never created that function.
--          The original was created as public.ln_distance_m in 20261103000001.
--          This migration creates haversine_distance_m with the same body,
--          fixing the "function does not exist" error on GPS attendance submit.
-- ============================================================================

-- Create haversine_distance_m (same haversine formula as ln_distance_m).
-- Using CREATE OR REPLACE so this is safe to re-run.
create or replace function public.haversine_distance_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = public
as $$
  select 2 * 6371008.8 * asin(least(1.0, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )));
$$;

-- Keep ln_distance_m as well (older code paths may reference it).
-- No action needed — it already exists from migration 20261103000001.
