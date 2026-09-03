-- Automations + n8n integration tables
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  trigger_event text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  action_type text NOT NULL,
  action_config jsonb DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT true,
  execution_count integer DEFAULT 0,
  last_execution_at timestamptz,
  last_execution_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  n8n_execution_id text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id
  ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status
  ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_event
  ON automations(trigger_event);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_automations" ON automations FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_automations" ON automations FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_automations" ON automations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_automations" ON automations FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "select_executions" ON automation_executions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_executions" ON automation_executions FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_executions" ON automation_executions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_executions" ON automation_executions FOR DELETE
  TO authenticated USING (true);

-- Seed default automations
INSERT INTO automations (name, description, trigger_event, action_type, enabled, action_config) VALUES
  ('New WhatsApp Lead', 'Create/update lead when a new WhatsApp conversation starts', 'whatsapp.new_conversation', 'create_lead', true, '{"auto_assign": true}'::jsonb),
  ('Lead Inactive Follow-up', 'Create follow-up task when lead has no activity for 48h', 'lead.inactive', 'create_task', true, '{"delay_hours": 48}'::jsonb),
  ('Deal Won Notification', 'Notify team and trigger workflow when deal is won', 'deal.won', 'send_notification', true, '{}'::jsonb),
  ('Appointment Reminder', 'Send WhatsApp reminder before scheduled meeting', 'meeting.created', 'send_whatsapp', true, '{"reminder_hours": 24}'::jsonb),
  ('Property Match Alert', 'Notify when a new property matches a lead''s interest', 'property.match', 'send_notification', false, '{}'::jsonb),
  ('Weekly Pipeline Report', 'Email weekly pipeline summary every Monday', 'schedule.weekly', 'send_email_report', true, '{"day": "monday", "hour": 9}'::jsonb)
ON CONFLICT DO NOTHING;

-- Add n8n to integrations table if not present
INSERT INTO integrations (service, connected, config)
SELECT 'n8n', false, '{"webhook_url": "", "api_url": "", "webhook_secret": ""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE service = 'n8n');