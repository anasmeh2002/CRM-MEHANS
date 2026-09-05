/*
# Fix integrations ON CONFLICT for NULL agency_id rows

## Problem
The `integrations` table has a `UNIQUE (agency_id, service)` constraint.
When `agency_id` is NULL (single-tenant / no agency assigned), PostgreSQL
treats each NULL as distinct, so `ON CONFLICT (agency_id, service)` never
matches — every upsert inserts a new row instead of updating.

This causes the Google Calendar sync to fail with:
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
when using `ON CONFLICT (service)`, and silently duplicates rows when using
`ON CONFLICT (agency_id, service)` with NULL agency_id.

## Fix
1. Drop the existing `UNIQUE (agency_id, service)` constraint.
2. Create two partial unique indexes:
   - One for rows where `agency_id IS NULL` — unique on `service` alone.
   - One for rows where `agency_id IS NOT NULL` — unique on `(agency_id, service)`.
3. This allows `ON CONFLICT (agency_id, service)` to work correctly for both
   NULL and non-NULL agency_id values.

## Security
No RLS changes. No data changes. Existing rows preserved.
*/

-- Drop the existing unique constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_agency_service_key;

-- Create partial unique index for NULL agency_id rows (single-tenant)
CREATE UNIQUE INDEX IF NOT EXISTS integrations_service_null_agency_key
  ON integrations (service)
  WHERE agency_id IS NULL;

-- Create partial unique index for non-NULL agency_id rows (multi-tenant)
CREATE UNIQUE INDEX IF NOT EXISTS integrations_agency_service_key
  ON integrations (agency_id, service)
  WHERE agency_id IS NOT NULL;