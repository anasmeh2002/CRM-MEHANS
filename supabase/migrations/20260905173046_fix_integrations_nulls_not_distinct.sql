/*
# Fix integrations unique constraint with NULLS NOT DISTINCT

## Problem
The previous migration created partial unique indexes, but PostgreSQL's
ON CONFLICT requires the exact partial index WHERE clause to match, which
the Supabase JS client's `onConflict` parameter doesn't support.

## Fix
Drop the partial indexes. Create a single UNIQUE constraint on
(agency_id, service) with NULLS NOT DISTINCT (PostgreSQL 15+ feature,
server is 17.6). This treats NULL agency_id values as equal, so
ON CONFLICT (agency_id, service) matches correctly for both NULL and
non-NULL agency_id rows.

## Security
No RLS changes. No data changes.
*/

-- Drop the partial indexes from the previous attempt
DROP INDEX IF EXISTS integrations_service_null_agency_key;
DROP INDEX IF EXISTS integrations_agency_service_key;

-- Create a single unique constraint with NULLS NOT DISTINCT
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_agency_service_key;
CREATE UNIQUE INDEX integrations_agency_service_key
  ON integrations (agency_id, service)
  NULLS NOT DISTINCT;