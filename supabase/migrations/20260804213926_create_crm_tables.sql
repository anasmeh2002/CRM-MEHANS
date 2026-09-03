-- Create missing CRM tables in the existing database

-- contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  whatsapp text,
  company text,
  role text,
  language text DEFAULT 'English',
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  value numeric NOT NULL DEFAULT 0,
  expected_close_date date,
  stage text NOT NULL DEFAULT 'new_lead',
  probability int NOT NULL DEFAULT 20,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  related_type text,
  related_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes int NOT NULL DEFAULT 30,
  meeting_type text NOT NULL DEFAULT 'in-person',
  location text,
  calendar_sync text,
  attendee_name text,
  attendee_email text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'upcoming',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- property_images table
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget numeric NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score int NOT NULL DEFAULT 50;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';

-- Add missing columns to existing properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS country text;

-- Add missing columns to existing activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS record_type text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS record_id uuid;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_type text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_name text;

-- Add missing columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT '#D4AF37';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deals int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenue numeric NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_assigned_to ON properties(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_property_id ON deals(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_meetings_starts_at ON meetings(starts_at);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_notes_record ON notes(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id);

-- Enable RLS on new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: anon+authenticated full CRUD (single-tenant, no auth)
CREATE POLICY "public all contacts" ON contacts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all deals" ON deals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all tasks" ON tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all meetings" ON meetings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all property_images" ON property_images FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all notes" ON notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all attachments" ON attachments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Storage bucket for property images
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "public all property images storage" ON storage.objects;
CREATE POLICY "public all property images storage" ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = 'property-images') WITH CHECK (bucket_id = 'property-images');