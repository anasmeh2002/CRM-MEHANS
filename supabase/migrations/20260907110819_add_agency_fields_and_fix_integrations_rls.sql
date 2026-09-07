/*
# Add agency profile fields and fix integrations RLS isolation

## 1. Agencies table — new columns
- `description` (text, nullable) — optional company description
- `address` (text, nullable) — street address
These allow the Organization settings page to store a complete company profile.

## 2. Integrations — remove orphaned NULL agency_id rows
The integrations table had seeded rows with `agency_id = NULL` (Gmail,
Google Calendar, n8n, OpenAI, Slack, WhatsApp Business, Zapier). These are
default seed data, not real user integrations. Agency-owned rows already
exist for the services that matter (n8n, whatsapp). Deleting the NULL rows
is safe — they contain no user data and no real OAuth tokens.

## 3. Integrations — enforce agency_id NOT NULL
After cleaning up NULL rows, add NOT NULL constraint so every future
integration is agency-scoped.

## 4. Integrations RLS — strict agency scoping
Replace the permissive policy (which allowed `agency_id IS NULL` reads
for all authenticated users) with strict `agency_id = current_agency_id()`
policies for all CRUD verbs. Remove the anon write policy.

## Security
- RLS remains enabled on all tables.
- Integrations now strictly scoped to owning agency.
- No global/shared integration rows possible after NOT NULL constraint.
*/

-- 1. Add agency profile columns
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS address text;

-- 2. Delete orphaned NULL agency_id integration rows (seed data only)
DELETE FROM integrations WHERE agency_id IS NULL;

-- 3. Add NOT NULL constraint on integrations.agency_id
ALTER TABLE integrations ALTER COLUMN agency_id SET NOT NULL;

-- 4. Drop old permissive policies
DROP POLICY IF EXISTS "agency_scoped_integrations" ON integrations;
DROP POLICY IF EXISTS "anon_write_shared_integrations" ON integrations;
DROP POLICY IF EXISTS "shared_integrations_read" ON integrations;
DROP POLICY IF EXISTS "anon_read_shared_integrations" ON integrations;

-- 5. Create strict agency-scoped policies
CREATE POLICY "select_own_integrations"
ON integrations FOR SELECT
TO authenticated
USING (agency_id = current_agency_id());

CREATE POLICY "insert_own_integrations"
ON integrations FOR INSERT
TO authenticated
WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "update_own_integrations"
ON integrations FOR UPDATE
TO authenticated
USING (agency_id = current_agency_id())
WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "delete_own_integrations"
ON integrations FOR DELETE
TO authenticated
USING (agency_id = current_agency_id());
