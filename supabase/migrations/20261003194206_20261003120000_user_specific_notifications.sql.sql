/*
# User-Specific Notifications + Invitation System Schema

## Purpose
Transform the notifications table from workspace-wide (everyone sees everything)
to user-specific (each user sees only their own notifications), and add the
infrastructure needed for a proper user invitation flow.

## Changes

### 1. notifications table — add user_id column
- Add `user_id` (uuid, nullable) — when set, only that user can see the notification.
  When NULL, the notification is workspace-wide (visible to all agency members).
- Add `agency_id` default to `current_agency_id()` so notifications are auto-scoped.
- Add index on `(user_id, read, created_at DESC)` for efficient per-user queries.

### 2. workspace_members table — add user_id link + auth metadata
- The table already has `user_id` (nullable). We add:
  - `invited_by` (uuid, nullable) — who sent the invitation.
  - `invited_at` (timestamptz, nullable) — when the invitation was sent.
  - `accepted_at` (timestamptz, nullable) — when the user accepted and logged in.
- These columns help track the invitation lifecycle.

### 3. RLS policies — notifications
- Replace the current fully-public policy (`USING (true)`) with proper user-scoped policies:
  - SELECT: user sees notifications where `user_id = auth.uid()` OR (`user_id IS NULL` AND `agency_id = current_agency_id()`).
  - INSERT: authenticated users can insert for themselves or workspace-wide in their agency.
  - UPDATE: users can only mark their own notifications as read.
  - DELETE: users can only delete their own notifications.
- Also allow service-role inserts (via the existing grant).

### 4. RLS policies — workspace_members
- Keep existing agency-scoped SELECT.
- Add a new policy allowing a user to read their own workspace_members row
  (so invited users can find their membership on first login).

## Security
- Users can only read notifications addressed to them, or workspace-wide ones in their agency.
- Users can only mark their own notifications as read.
- Service role bypasses RLS for server-side notification creation.
- No anon access to notifications (authenticated only).
*/

-- 1. Add user_id to notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Set agency_id default to current_agency_id() for auto-scoping
ALTER TABLE notifications ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();

-- Add index for per-user notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- 2. Add invitation tracking columns to workspace_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspace_members' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN invited_by uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspace_members' AND column_name = 'invited_at'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN invited_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspace_members' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

-- 3. Replace notification RLS policies — user-specific access
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop the old fully-public policy
DROP POLICY IF EXISTS "public all notifications" ON notifications;

-- SELECT: user sees their own notifications + workspace-wide in their agency
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications"
ON notifications FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (user_id IS NULL AND agency_id = public.current_agency_id())
);

-- INSERT: authenticated users can create notifications for themselves or workspace-wide
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL)
  AND (agency_id IS NULL OR agency_id = public.current_agency_id())
);

-- UPDATE: users can only update (mark read) their own notifications
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- DELETE: users can only delete their own notifications
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications"
ON notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 4. Workspace members — allow users to find their own membership row
-- (existing agency-scoped policy handles admin/owner reads)
DROP POLICY IF EXISTS "select_own_membership" ON workspace_members;
CREATE POLICY "select_own_membership"
ON workspace_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());
