-- Create a public storage bucket for agency logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "allow_agency_logo_uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agency-logos');

-- Allow anyone to read (public bucket)
CREATE POLICY "allow_agency_logo_reads"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'agency-logos');

-- Allow authenticated users to update/replace their logos
CREATE POLICY "allow_agency_logo_updates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agency-logos')
  WITH CHECK (bucket_id = 'agency-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "allow_agency_logo_deletes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agency-logos');
