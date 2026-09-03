-- Add phone_number column to whatsapp_conversations
ALTER TABLE whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Backfill phone_number from remote_jid for existing rows
UPDATE whatsapp_conversations
SET phone_number = split_part(remote_jid, '@', 1)
WHERE phone_number IS NULL
  AND (remote_jid LIKE '%@c.us' OR remote_jid LIKE '%@s.whatsapp.net');

-- Add index for phone-based lead matching
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_number 
  ON whatsapp_conversations(phone_number);