/*
# Secure calendar ownership and server-only Google credentials

1. Purpose
- Make internal meetings and tasks belong to the authenticated user's agency.
- Keep Google OAuth credentials inaccessible to browser clients.
- Replace broad calendar table policies with separate agency-scoped CRUD policies.

2. Modified tables
- `meetings.agency_id`: defaults to the authenticated user's agency and is required for new rows.
- `tasks.agency_id`: defaults to the authenticated user's agency and is required for new rows.
- `integrations.config`: remains available to the server-side calendar routes, but is no longer readable or writable by browser roles because it contains OAuth tokens.

3. Security
- Authenticated users can access only rows whose `agency_id` equals `current_agency_id()`.
- Anonymous users receive no calendar or integration access.
- Four separate policies are defined for each calendar-related CRUD operation.

4. Important notes
- Existing agency-owned rows are preserved.
- Existing meetings or tasks without an agency are not reassigned to another agency. They remain inaccessible until an administrator assigns ownership through a trusted server-side operation.
- The application will stop sending integration secrets through browser queries.
*/

ALTER TABLE meetings
  ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE meetings
  ALTER COLUMN agency_id SET NOT NULL;

ALTER TABLE tasks
  ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE tasks
  ALTER COLUMN agency_id SET NOT NULL;

REVOKE ALL ON meetings FROM anon;
REVOKE ALL ON tasks FROM anon;
REVOKE ALL ON integrations FROM anon;
REVOKE SELECT (config), INSERT (config), UPDATE (config) ON integrations FROM authenticated;
REVOKE SELECT (config), INSERT (config), UPDATE (config) ON integrations FROM anon;

DROP POLICY IF EXISTS "agency_scoped_meetings" ON meetings;
DROP POLICY IF EXISTS "select_own_meetings" ON meetings;
DROP POLICY IF EXISTS "insert_own_meetings" ON meetings;
DROP POLICY IF EXISTS "update_own_meetings" ON meetings;
DROP POLICY IF EXISTS "delete_own_meetings" ON meetings;

CREATE POLICY "select_own_meetings" ON meetings FOR SELECT
  TO authenticated USING (agency_id = public.current_agency_id());
CREATE POLICY "insert_own_meetings" ON meetings FOR INSERT
  TO authenticated WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "update_own_meetings" ON meetings FOR UPDATE
  TO authenticated USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "delete_own_meetings" ON meetings FOR DELETE
  TO authenticated USING (agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "agency_scoped_tasks" ON tasks;
DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;

CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (agency_id = public.current_agency_id());
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (agency_id = public.current_agency_id());