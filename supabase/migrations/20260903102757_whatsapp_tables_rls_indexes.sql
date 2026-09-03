-- Enable RLS on whatsapp tables (in case not already enabled)
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "public all whatsapp_conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "public all whatsapp_messages" ON whatsapp_messages;

-- Single-tenant app: anon + authenticated full CRUD
CREATE POLICY "public all whatsapp_conversations" ON whatsapp_conversations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all whatsapp_messages" ON whatsapp_messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_remote_jid ON whatsapp_conversations(remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_remote_jid ON whatsapp_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
