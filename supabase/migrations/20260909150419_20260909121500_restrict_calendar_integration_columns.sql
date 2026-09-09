/*
# Restrict browser access to calendar integration columns

1. Purpose
- Prevent authenticated browser clients from reading or writing the JSON configuration that contains Google OAuth access and refresh tokens.

2. Modified table
- `integrations`: authenticated users retain access only to connection metadata and the safe connection toggle fields.
- `integrations.config`: server-side calendar routes retain access through the service role; browser roles cannot select, insert, or update it.

3. Security
- Revoke table-wide SELECT, INSERT, and UPDATE privileges from authenticated users.
- Grant only the safe metadata columns required by the settings and calendar screens.
- RLS policies remain agency-scoped.

4. Important notes
- The OAuth callback and token refresh routes use the service role and continue to function.
- No existing integration rows or tokens are changed.
*/

REVOKE SELECT, INSERT, UPDATE ON integrations FROM authenticated;
GRANT SELECT (id, agency_id, service, connected, created_at, updated_at) ON integrations TO authenticated;
GRANT INSERT (agency_id, service, connected) ON integrations TO authenticated;
GRANT UPDATE (connected, updated_at) ON integrations TO authenticated;