import { supabase } from '@/lib/supabase';

export type WhatsAppConversation = {
  id: string;
  remote_jid: string;
  push_name: string | null;
  display_name: string;
  phone_number: string | null;
  profile_pic: string | null;
  unread_count: number;
  last_message: string | null;
  last_message_type: string;
  last_message_timestamp: string | null;
  archived: boolean;
  pinned: boolean;
  lead_id: string | null;
};

export type WhatsAppMessage = {
  id: string;
  conversation_id: string | null;
  remote_jid: string | null;
  from_me: boolean;
  sender_name: string | null;
  message_type: string;
  text: string | null;
  media_url: string | null;
  timestamp: string | null;
  status: string;
};

export type WhatsAppConnection = {
  connected: boolean;
  phoneNumber: string;
  provider: string;
  instanceName: string;
};

function getInstanceName(userId: string): string {
  return `instance_${userId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getContactIdentifier(contact: Record<string, unknown>): string | null {
  return safeString(contact.remoteJid) ?? safeString(contact.id) ?? safeString(contact.jid);
}

function getContactName(contact?: Record<string, unknown> | null): string | null {
  return safeString(contact?.pushName) ?? safeString(contact?.name) ?? safeString(contact?.notify) ?? safeString(contact?.verifiedName);
}

function getPhoneNumber(jid: string, contact?: Record<string, unknown> | null): string | null {
  const contactNumber = safeString(contact?.number) ?? safeString(contact?.phoneNumber);
  if (contactNumber) return contactNumber.replace(/[^0-9+]/g, '');
  const [localPart, suffix] = jid.split('@');
  if (suffix === 'c.us' || suffix === 's.whatsapp.net') return localPart;
  return null;
}

function displayNameFor(jid: string, contact?: Record<string, unknown> | null, pushName?: unknown, name?: unknown): string {
  const resolved = safeString(pushName) ?? safeString(name) ?? getContactName(contact);
  if (resolved) return resolved;
  return getPhoneNumber(jid, contact) ?? 'WhatsApp Contact';
}

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  return null;
}

function safeTimestamp(value: unknown): string | null {
  const num = safeNumber(value);
  if (num !== null && num > 0) {
    const ms = num < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function extractMessageText(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return safeString(message);
  }
  const msg = message as Record<string, unknown>;
  if (typeof msg.conversation === 'string') return msg.conversation;
  const ext = msg.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  const img = msg.imageMessage as Record<string, unknown> | undefined;
  if (img) return typeof img.caption === 'string' ? img.caption : 'Photo';
  const vid = msg.videoMessage as Record<string, unknown> | undefined;
  if (vid) return typeof vid.caption === 'string' ? vid.caption : 'Video';
  if (msg.audioMessage) return 'Audio message';
  if (msg.stickerMessage) return 'Sticker';
  if (msg.documentMessage) return 'Document';
  if (msg.contactsArrayMessage) return 'Contact';
  if (msg.locationMessage) return 'Location';
  if (msg.reactionMessage) return 'Reaction';
  return null;
}

function extractLastMessageText(lastMessage: unknown): string | null {
  if (!lastMessage) return null;
  if (typeof lastMessage === 'string') return lastMessage;
  if (typeof lastMessage !== 'object') return null;
  const lm = lastMessage as Record<string, unknown>;
  const text = extractMessageText(lm.message);
  if (text) return text;
  return safeString(lm.message) ?? safeString(lm.text) ?? safeString(lm.body);
}

async function edgeFetch(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
    body,
  });

  if (data && data.success === false) {
    throw new Error(data.error ?? 'Failed to connect to Evolution API');
  }

  if (error) {
    throw new Error(error.message || 'Failed to connect to Evolution API');
  }

  return data ?? {};
}

export async function createEvolutionInstance(userId: string): Promise<{ instanceName: string; qrCode: string | null }> {
  const data = await edgeFetch({ action: 'create-instance', userId });
  return { instanceName: data.instanceName, qrCode: data.qrCode ?? null };
}

export async function fetchEvolutionQR(instanceName: string): Promise<string | null> {
  try {
    const data = await edgeFetch({ action: 'get-qr', instanceName });
    return data.qrCode ?? null;
  } catch {
    return null;
  }
}

export async function checkEvolutionInstanceStatus(instanceName: string): Promise<{ state: 'open' | 'close' | null; instanceName: string }> {
  try {
    const data = await edgeFetch({ action: 'check-status', instanceName });
    return { state: data.status ?? null, instanceName: data.instanceName ?? instanceName };
  } catch {
    return { state: null, instanceName };
  }
}

export async function checkEvolutionStatusByUserId(userId: string): Promise<{ state: 'open' | 'close' | null; instanceName: string }> {
  try {
    const data = await edgeFetch({ action: 'check-status', userId });
    return { state: data.status ?? null, instanceName: data.instanceName ?? `instance_${userId}` };
  } catch {
    return { state: null, instanceName: `instance_${userId}` };
  }
}

export async function fetchEvolutionConversations(userId: string): Promise<WhatsAppConversation[]> {
  const instanceName = getInstanceName(userId);
  try {
    const [chatData, contactData] = await Promise.all([
      edgeFetch({ action: 'find-chats', instanceName }),
      edgeFetch({ action: 'find-contacts', instanceName }).catch(() => ({ contacts: [] })),
    ]);
    const rawChats = Array.isArray(chatData.conversations) ? chatData.conversations : [];
    const rawContacts = Array.isArray(contactData.contacts) ? contactData.contacts : [];
    const contacts = new Map<string, Record<string, unknown>>();
    rawContacts.forEach((value: unknown) => {
      const contact = asRecord(value);
      const identifier = contact ? getContactIdentifier(contact) : null;
      if (contact && identifier) {
        contacts.set(identifier, contact);
        contacts.set(identifier.split('@')[0], contact);
      }
    });

    return rawChats
      .filter((chat: unknown): chat is Record<string, unknown> => chat !== null && typeof chat === 'object')
      .map((chat: Record<string, unknown>): WhatsAppConversation => {
        const remoteJid = safeString(chat.remoteJid) ?? safeString(chat.id) ?? '';
        const contact = contacts.get(remoteJid) ?? contacts.get(remoteJid.split('@')[0]) ?? null;
        const lastMessage = asRecord(chat.lastMessage);
        const pushName = safeString(chat.pushName) ?? safeString(chat.name) ?? getContactName(contact);
        return {
          id: remoteJid,
          remote_jid: remoteJid,
          push_name: pushName,
          display_name: displayNameFor(remoteJid, contact, pushName),
          phone_number: getPhoneNumber(remoteJid, contact),
          profile_pic: safeString(chat.profilePicUrl) ?? safeString(contact?.profilePictureUrl) ?? null,
          unread_count: safeNumber(chat.unreadCount) ?? 0,
          last_message: extractLastMessageText(lastMessage),
          last_message_type: safeString(lastMessage?.messageType) ?? 'text',
          last_message_timestamp: safeTimestamp(lastMessage?.messageTimestamp),
          archived: false,
          pinned: false,
          lead_id: null,
        };
      })
      .filter((conversation: WhatsAppConversation) => conversation.remote_jid.length > 0);
  } catch {
    return [];
  }
}

export async function fetchEvolutionMessages(userId: string, remoteJid: string): Promise<WhatsAppMessage[]> {
  const instanceName = getInstanceName(userId);
  try {
    const data = await edgeFetch({ action: 'find-messages', instanceName, remoteJid });
    const messageContainer = asRecord(data.messages);
    const rawMessages = Array.isArray(data.messages)
      ? data.messages
      : messageContainer && Array.isArray(messageContainer.records)
        ? messageContainer.records
        : messageContainer && Array.isArray(messageContainer.messages)
          ? messageContainer.messages
          : Array.isArray(data)
            ? data
            : [];
    return rawMessages
      .filter((msg: unknown): msg is Record<string, unknown> => msg !== null && typeof msg === 'object')
      .map((msg: Record<string, unknown>): WhatsAppMessage => {
        const key = msg.key as Record<string, unknown> | undefined;
        const message = msg.message as Record<string, unknown> | undefined;
        return {
          id: String(key?.id ?? msg.id ?? Date.now()),
          conversation_id: null,
          remote_jid: safeString(key?.remoteJid) ?? remoteJid,
          from_me: Boolean(key?.fromMe ?? false),
          sender_name: key?.fromMe ? 'You' : (safeString(msg.pushName) ?? 'Contact'),
          message_type: message?.conversation ? 'text' : (safeString(msg.messageType) ?? 'text'),
          text: extractMessageText(message) ?? '',
          media_url: null,
          timestamp: safeTimestamp(msg.messageTimestamp),
          status: safeString(msg.status) ?? 'sent',
        };
      });
  } catch (error) {
    throw error;
  }
}

export async function sendEvolutionMessage(userId: string, remoteJid: string, text: string, phoneNumber?: string | null): Promise<WhatsAppMessage> {
  const instanceName = getInstanceName(userId);
  const data = await edgeFetch({ action: 'send-text', instanceName, remoteJid, phoneNumber, text });
  return {
    id: String(data?.key?.id ?? Date.now()),
    conversation_id: null,
    remote_jid: remoteJid,
    from_me: true,
    sender_name: 'You',
    message_type: 'text',
    text,
    media_url: null,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };
}

export async function sendEvolutionMedia(
  userId: string,
  remoteJid: string,
  mediatype: 'image' | 'document',
  mimetype: string,
  media: string,
  fileName: string,
  caption: string,
  phoneNumber?: string | null,
): Promise<WhatsAppMessage> {
  const instanceName = getInstanceName(userId);
  const data = await edgeFetch({ action: 'send-media', instanceName, remoteJid, phoneNumber, mediatype, mimetype, media, fileName, caption });
  return {
    id: String(data?.key?.id ?? Date.now()),
    conversation_id: null,
    remote_jid: remoteJid,
    from_me: true,
    sender_name: 'You',
    message_type: mediatype,
    text: caption || (mediatype === 'image' ? 'Photo' : 'Document'),
    media_url: null,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };
}

export async function logoutEvolutionInstance(userId: string, instanceName?: string): Promise<void> {
  const name = instanceName || getInstanceName(userId);
  await edgeFetch({ action: 'logout', instanceName: name });
}

export async function fetchWhatsAppConnection(): Promise<WhatsAppConnection> {
  const { data, error } = await supabase.from('integrations').select('connected, config').eq('service', 'whatsapp').maybeSingle();
  if (error) throw error;
  const config = (data?.config ?? {}) as Record<string, unknown>;
  return {
    connected: data?.connected ?? false,
    phoneNumber: typeof config.phone_number === 'string' ? config.phone_number : '',
    provider: typeof config.provider === 'string' ? config.provider : 'Evolution API',
    instanceName: typeof config.instance_name === 'string' ? config.instance_name : '',
  };
}

export async function updateWhatsAppConnection(connection: WhatsAppConnection): Promise<void> {
  const { error } = await supabase.from('integrations').upsert({
    service: 'whatsapp',
    connected: connection.connected,
    config: {
      provider: connection.provider,
      phone_number: connection.phoneNumber,
      instance_name: connection.instanceName,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'service' });
  if (error) throw error;
}

export async function fetchWhatsAppConversations(userId: string): Promise<WhatsAppConversation[]> {
  return fetchEvolutionConversations(userId);
}

export async function fetchWhatsAppMessages(userId: string, remoteJid: string): Promise<WhatsAppMessage[]> {
  return fetchEvolutionMessages(userId, remoteJid);
}

export async function sendWhatsAppMessage(userId: string, remoteJid: string, text: string, phoneNumber?: string | null): Promise<WhatsAppMessage> {
  return sendEvolutionMessage(userId, remoteJid, text, phoneNumber);
}
