INSERT INTO public.role_permissions (agency_id, role, module, can_view, can_create, can_edit, can_delete)
SELECT a.id, 'owner', rp.module, true, true, true, true
FROM public.agencies a
CROSS JOIN (SELECT DISTINCT module FROM public.role_permissions WHERE role = 'admin') rp
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.agency_id = a.id AND existing.role = 'owner' AND existing.module = rp.module
);