CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'manager', 'agent')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_email_key ON public.workspace_members(workspace_id, lower(email));
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
CREATE POLICY workspace_members_select ON public.workspace_members FOR SELECT TO authenticated USING (workspace_id = current_agency_id());
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
CREATE POLICY workspace_members_insert ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (workspace_id = current_agency_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND agency_id = workspace_id AND role IN ('admin', 'owner')));
DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
CREATE POLICY workspace_members_update ON public.workspace_members FOR UPDATE TO authenticated USING (workspace_id = current_agency_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND agency_id = workspace_id AND role IN ('admin', 'owner'))) WITH CHECK (workspace_id = current_agency_id());
DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;
CREATE POLICY workspace_members_delete ON public.workspace_members FOR DELETE TO authenticated USING (workspace_id = current_agency_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND agency_id = workspace_id AND role IN ('admin', 'owner')));
INSERT INTO public.workspace_members (workspace_id, user_id, name, email, role, status)
SELECT p.agency_id, CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id) THEN p.id ELSE NULL END, COALESCE(NULLIF(p.full_name, ''), p.email, 'Member'), COALESCE(p.email, concat(p.id::text, '@member.invalid')), CASE WHEN p.role = 'admin' THEN 'admin' ELSE 'agent' END, CASE WHEN p.status IN ('active', 'inactive') THEN p.status ELSE 'active' END
FROM public.profiles p
WHERE p.agency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p.agency_id AND wm.email = COALESCE(p.email, concat(p.id::text, '@member.invalid')));
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_module_key;
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_agency_role_module_key ON public.role_permissions(agency_id, role, module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_agency ON public.role_permissions(agency_id);
INSERT INTO public.role_permissions (agency_id, role, module, can_view, can_create, can_edit, can_delete)
SELECT a.id, rp.role, rp.module, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
FROM public.agencies a CROSS JOIN public.role_permissions rp
WHERE rp.agency_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.role_permissions existing WHERE existing.agency_id = a.id AND existing.role = rp.role AND existing.module = rp.module);
DROP POLICY IF EXISTS "public all role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (agency_id = current_agency_id());
DROP POLICY IF EXISTS role_permissions_update ON public.role_permissions;
CREATE POLICY role_permissions_update ON public.role_permissions FOR UPDATE TO authenticated USING (agency_id = current_agency_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND agency_id = current_agency_id() AND role IN ('admin', 'owner'))) WITH CHECK (agency_id = current_agency_id());
CREATE OR REPLACE FUNCTION public.set_workspace_member_role(p_member uuid, p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
  IF p_role NOT IN ('owner', 'admin', 'manager', 'agent') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND agency_id = current_agency_id() AND role IN ('admin', 'owner')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE workspace_members SET role = p_role, updated_at = now() WHERE id = p_member AND workspace_id = current_agency_id();
  IF p_role <> 'owner' THEN UPDATE profiles p SET role = p_role, updated_at = now() FROM workspace_members wm WHERE wm.id = p_member AND p.id = wm.user_id AND p.agency_id = current_agency_id(); END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_workspace_member_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_role(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_workspace_member_status(p_member uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
  IF p_status NOT IN ('active', 'inactive', 'invited') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND agency_id = current_agency_id() AND role IN ('admin', 'owner')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE workspace_members SET status = p_status, updated_at = now() WHERE id = p_member AND workspace_id = current_agency_id();
  IF p_status = 'inactive' THEN UPDATE profiles p SET status = 'inactive', updated_at = now() FROM workspace_members wm WHERE wm.id = p_member AND p.id = wm.user_id AND p.agency_id = current_agency_id(); END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_workspace_member_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_status(uuid, text) TO authenticated;