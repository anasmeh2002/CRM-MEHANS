/*
# Close public and cross-organization policies

- WhatsApp rows are visible only to the authenticated current agency.
- Integration rows with no agency are no longer readable by authenticated clients.
- Role permissions are no longer publicly readable or writable. Existing global permission rows remain available only to authenticated users; CRM data remains agency-scoped.
- Agency logos use private, agency-prefixed storage paths.
*/

DROP POLICY IF EXISTS "public all whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "wa_conv_service" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "public all whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "wa_msg_service" ON public.whatsapp_messages;

DROP POLICY IF EXISTS "authenticated_read_integrations" ON public.integrations;

DROP POLICY IF EXISTS "public all role_permissions" ON public.role_permissions;
CREATE POLICY "authenticated read role_permissions" ON public.role_permissions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated update role_permissions" ON public.role_permissions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

UPDATE storage.buckets SET public = false WHERE id = 'agency-logos';
DROP POLICY IF EXISTS "allow_agency_logo_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_agency_logo_reads" ON storage.objects;
DROP POLICY IF EXISTS "allow_agency_logo_updates" ON storage.objects;
DROP POLICY IF EXISTS "allow_agency_logo_deletes" ON storage.objects;
CREATE POLICY "agency_logo_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = public.current_agency_id()::text);
CREATE POLICY "agency_logo_read_own_folder" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = public.current_agency_id()::text);
CREATE POLICY "agency_logo_update_own_folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = public.current_agency_id()::text)
  WITH CHECK (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = public.current_agency_id()::text);
CREATE POLICY "agency_logo_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = public.current_agency_id()::text);