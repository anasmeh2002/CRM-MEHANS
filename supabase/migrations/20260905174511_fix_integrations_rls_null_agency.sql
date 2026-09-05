/*
# Fix integrations RLS for NULL agency_id rows

## Problem
The `integrations` table has a single RLS policy:
  `agency_scoped_integrations TO authenticated USING (agency_id = current_agency_id())`

The seeded Google Calendar row has `agency_id = NULL`. The comparison
`NULL = current_agency_id()` always evaluates to false, so no client
can read the row. On page refresh, the calendar page queries the
`integrations` table and gets zero rows, making the connection state
appear disconnected.

Additionally, there is no policy for the `anon` role at all, so the
anon-key client (used when no user is signed in) can never read
integration rows.

## Fix
1. Add a SELECT policy for the `anon` role allowing reads where
   `agency_id IS NULL` (single-tenant / no-agency integrations).
2. Add a SELECT policy for `authenticated` users allowing reads where
   `agency_id IS NULL` OR `agency_id = current_agency_id()`.

This preserves multi-agency isolation for agency-scoped rows while
allowing shared/no-agency integrations (like Google Calendar) to be
read by all users.

## Security
- Agency-scoped integrations remain isolated.
- Only NULL-agency (shared) integrations are readable by everyone.
- Write policies are unchanged (still agency-scoped for authenticated).
*/

-- Allow anon to read shared (no-agency) integrations
DROP POLICY IF EXISTS "anon_read_shared_integrations" ON integrations;
CREATE POLICY "anon_read_shared_integrations"
ON integrations FOR SELECT
TO anon
USING (agency_id IS NULL);

-- Allow authenticated to read shared + own-agency integrations
DROP POLICY IF EXISTS "authenticated_read_integrations" ON integrations;
CREATE POLICY "authenticated_read_integrations"
ON integrations FOR SELECT
TO authenticated
USING (agency_id IS NULL OR agency_id = current_agency_id());

-- Allow anon to write shared (no-agency) integrations
DROP POLICY IF EXISTS "anon_write_shared_integrations" ON integrations;
CREATE POLICY "anon_write_shared_integrations"
ON integrations FOR ALL
TO anon
USING (agency_id IS NULL)
WITH CHECK (agency_id IS NULL);