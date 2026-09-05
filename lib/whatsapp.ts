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

export type CRMContext = {
  contactName: string;
  phoneNumber: string | null;
  lead: Record<string, unknown> | null;
  properties: Record<string, unknown>[];
  deals: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  recentMessages: { from: string; text: string; time: string }[];
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

async function upsertConversation(conv: Omit<WhatsAppConversation, 'id' | 'lead_id' | 'archived' | 'pinned'> & { archived?: boolean; pinned?: boolean; lead_id?: string | null }): Promise<string> {
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('remote_jid', conv.remote_jid)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        push_name: conv.push_name,
        last_message: conv.last_message,
        last_message_type: conv.last_message_type,
        last_message_timestamp: conv.last_message_timestamp,
        unread_count: conv.unread_count,
        profile_pic: conv.profile_pic,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      remote_jid: conv.remote_jid,
      push_name: conv.push_name,
      profile_pic: conv.profile_pic,
      unread_count: conv.unread_count,
      last_message: conv.last_message,
      last_message_type: conv.last_message_type,
      last_message_timestamp: conv.last_message_timestamp,
      archived: conv.archived ?? false,
      pinned: conv.pinned ?? false,
      lead_id: conv.lead_id ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

let conversationSyncLock: Promise<void> | null = null;

export async function fetchEvolutionConversations(userId: string): Promise<WhatsAppConversation[]> {
  // Prevent duplicate concurrent syncs across mounts/tabs
  if (conversationSyncLock) {
    await conversationSyncLock;
    return fetchCachedConversations();
  }

  const instanceName = getInstanceName(userId);
  let syncedConversations: WhatsAppConversation[] = [];
  conversationSyncLock = (async () => {
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

      const conversations = rawChats
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

      const convRows = conversations.map((c: WhatsAppConversation) => ({
        remote_jid: c.remote_jid,
        push_name: c.push_name,
        phone_number: c.phone_number,
        profile_pic: c.profile_pic,
        unread_count: c.unread_count,
        last_message: c.last_message,
        last_message_type: c.last_message_type,
        last_message_timestamp: c.last_message_timestamp,
        archived: false,
        pinned: false,
        lead_id: null,
      }));
      try { await batchUpsertConversations(convRows); } catch {}

      syncedConversations = conversations;
    } catch {
      // Sync failed — return cached conversations instead
    } finally {
      conversationSyncLock = null;
    }
  })();

  await conversationSyncLock;
  // Return Evolution conversations if sync succeeded, otherwise fall back to cache
  if (syncedConversations.length > 0) return syncedConversations;
  return fetchCachedConversations();
}

async function upsertMessage(convId: string, msg: Omit<WhatsAppMessage, 'id' | 'conversation_id'>, messageId: string): Promise<WhatsAppMessage> {
  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .update({ status: msg.status })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapDbMessage(data);
  }

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: convId,
      message_id: messageId,
      remote_jid: msg.remote_jid,
      from_me: msg.from_me,
      sender_name: msg.sender_name,
      message_type: msg.message_type,
      text: msg.text,
      media_url: msg.media_url,
      timestamp: msg.timestamp,
      status: msg.status,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapDbMessage(data);
}

function mapDbMessage(row: Record<string, unknown>): WhatsAppMessage {
  return {
    id: String(row.id ?? row.message_id ?? Date.now()),
    conversation_id: (row.conversation_id as string) ?? null,
    remote_jid: (row.remote_jid as string) ?? null,
    from_me: Boolean(row.from_me),
    sender_name: (row.sender_name as string) ?? null,
    message_type: (row.message_type as string) ?? 'text',
    text: (row.text as string) ?? null,
    media_url: (row.media_url as string) ?? null,
    timestamp: (row.timestamp as string) ?? null,
    status: (row.status as string) ?? 'sent',
  };
}

export async function fetchEvolutionMessages(userId: string, remoteJid: string): Promise<WhatsAppMessage[]> {
  const instanceName = getInstanceName(userId);
  try {
    const convId = await upsertConversation({
      remote_jid: remoteJid,
      push_name: null,
      display_name: remoteJid.split('@')[0],
      phone_number: getPhoneNumber(remoteJid),
      profile_pic: null,
      unread_count: 0,
      last_message: null,
      last_message_type: 'text',
      last_message_timestamp: null,
    });

    // Always fetch from Evolution API to get new messages — batch upsert handles dedup
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

    const messageRows: Array<{ conversation_id: string; message_id: string; remote_jid: string | null; from_me: boolean; sender_name: string | null; message_type: string; text: string | null; media_url: string | null; timestamp: string | null; status: string }> = [];
    const messageIds: string[] = [];
    for (const raw of rawMessages) {
      const msg = asRecord(raw);
      if (!msg) continue;
      const key = msg.key as Record<string, unknown> | undefined;
      const message = msg.message as Record<string, unknown> | undefined;
      const messageId = String(key?.id ?? msg.id ?? Date.now());
      messageIds.push(messageId);
      messageRows.push({
        conversation_id: convId,
        message_id: messageId,
        remote_jid: safeString(key?.remoteJid) ?? remoteJid,
        from_me: Boolean(key?.fromMe ?? false),
        sender_name: key?.fromMe ? 'You' : (safeString(msg.pushName) ?? 'Contact'),
        message_type: message?.conversation ? 'text' : (safeString(msg.messageType) ?? 'text'),
        text: extractMessageText(message) ?? '',
        media_url: null,
        timestamp: safeTimestamp(msg.messageTimestamp) ?? new Date().toISOString(),
        status: safeString(msg.status) ?? 'sent',
      });
    }

    // Batch check existing messages, then batch insert new ones
    if (messageIds.length > 0) {
      const { data: existingMsgs } = await supabase
        .from('whatsapp_messages')
        .select('id, message_id')
        .in('message_id', messageIds);
      const existingIds = new Set((existingMsgs ?? []).map((r: Record<string, unknown>) => r.message_id as string));
      const newMsgs = messageRows.filter(r => !existingIds.has(r.message_id));
      if (newMsgs.length > 0) {
        await supabase.from('whatsapp_messages').insert(newMsgs);
      }
    }

    const { data: dbMessages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('timestamp', { ascending: true })
      .limit(50);

    if (error) throw error;
    return (dbMessages ?? []).map(mapDbMessage);
  } catch (error) {
    throw error;
  }
}

export async function sendEvolutionMessage(userId: string, remoteJid: string, text: string, phoneNumber?: string | null): Promise<WhatsAppMessage> {
  const instanceName = getInstanceName(userId);
  const data = await edgeFetch({ action: 'send-text', instanceName, remoteJid, phoneNumber, text });
  const evolutionMessageId = String(data?.key?.id ?? `local_${Date.now()}`);
  const timestamp = new Date().toISOString();

  const convId = await upsertConversation({
    remote_jid: remoteJid,
    push_name: null,
    display_name: phoneNumber ?? remoteJid.split('@')[0],
    phone_number: phoneNumber ?? null,
    profile_pic: null,
    unread_count: 0,
    last_message: text,
    last_message_type: 'text',
    last_message_timestamp: timestamp,
  });

  const saved = await upsertMessage(convId, {
    remote_jid: remoteJid,
    from_me: true,
    sender_name: 'You',
    message_type: 'text',
    text,
    media_url: null,
    timestamp,
    status: 'sent',
  }, evolutionMessageId);

  return saved;
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
  const evolutionMessageId = String(data?.key?.id ?? `local_${Date.now()}`);
  const timestamp = new Date().toISOString();

  const convId = await upsertConversation({
    remote_jid: remoteJid,
    push_name: null,
    display_name: phoneNumber ?? remoteJid.split('@')[0],
    phone_number: phoneNumber ?? null,
    profile_pic: null,
    unread_count: 0,
    last_message: caption || (mediatype === 'image' ? 'Photo' : 'Document'),
    last_message_type: mediatype,
    last_message_timestamp: timestamp,
  });

  const saved = await upsertMessage(convId, {
    remote_jid: remoteJid,
    from_me: true,
    sender_name: 'You',
    message_type: mediatype,
    text: caption || (mediatype === 'image' ? 'Photo' : 'Document'),
    media_url: null,
    timestamp,
    status: 'sent',
  }, evolutionMessageId);

  return saved;
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
  }, { onConflict: 'agency_id,service' });
  if (error) throw error;
}

export async function fetchWhatsAppConversations(userId: string): Promise<WhatsAppConversation[]> {
  return fetchEvolutionConversations(userId);
}

export async function fetchCachedConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id, remote_jid, push_name, phone_number, profile_pic, unread_count, last_message, last_message_type, last_message_timestamp, archived, pinned, lead_id')
    .eq('archived', false)
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((row): WhatsAppConversation => {
    const r = row as Record<string, unknown>;
    const jid = (r.remote_jid as string) ?? '';
    const pushName = (r.push_name as string) ?? null;
    const phone = (r.phone_number as string) ?? null;
    return {
      id: (r.id as string) ?? jid,
      remote_jid: jid,
      push_name: pushName,
      display_name: pushName ?? phone ?? jid.split('@')[0] ?? 'WhatsApp Contact',
      phone_number: phone,
      profile_pic: (r.profile_pic as string) ?? null,
      unread_count: (r.unread_count as number) ?? 0,
      last_message: (r.last_message as string) ?? null,
      last_message_type: (r.last_message_type as string) ?? 'text',
      last_message_timestamp: (r.last_message_timestamp as string) ?? null,
      archived: (r.archived as boolean) ?? false,
      pinned: (r.pinned as boolean) ?? false,
      lead_id: (r.lead_id as string) ?? null,
    };
  });
}

async function batchUpsertConversations(conversations: Array<Record<string, unknown>>): Promise<void> {
  if (conversations.length === 0) return;
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id, remote_jid, push_name, last_message, last_message_type, last_message_timestamp, unread_count, profile_pic')
    .in('remote_jid', conversations.map((c: Record<string, unknown>) => c.remote_jid));

  const existingMap = new Map<string, Record<string, unknown>>();
  (existing ?? []).forEach((row: Record<string, unknown>) => {
    existingMap.set((row.remote_jid as string) ?? '', row);
  });

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const conv of conversations) {
    const existingRow = existingMap.get(conv.remote_jid as string);
    if (existingRow) {
      // Skip update if nothing changed
      const existingId = (existingRow.id as string) ?? '';
      const changed =
        (existingRow.push_name as string) !== (conv.push_name as string) ||
        (existingRow.last_message as string) !== (conv.last_message as string) ||
        (existingRow.last_message_type as string) !== (conv.last_message_type as string) ||
        (existingRow.last_message_timestamp as string) !== (conv.last_message_timestamp as string) ||
        (existingRow.unread_count as number) !== (conv.unread_count as number) ||
        (existingRow.profile_pic as string) !== (conv.profile_pic as string);
      if (changed) {
        toUpdate.push({
          id: existingId,
          data: {
            push_name: conv.push_name,
            last_message: conv.last_message,
            last_message_type: conv.last_message_type,
            last_message_timestamp: conv.last_message_timestamp,
            unread_count: conv.unread_count,
            profile_pic: conv.profile_pic,
            updated_at: new Date().toISOString(),
          },
        });
      }
    } else {
      toInsert.push(conv);
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('whatsapp_conversations').insert(toInsert);
  }

  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(u =>
      supabase.from('whatsapp_conversations').update(u.data).eq('id', u.id)
    ));
  }
}

export async function fetchWhatsAppMessages(userId: string, remoteJid: string): Promise<WhatsAppMessage[]> {
  return fetchEvolutionMessages(userId, remoteJid);
}

export async function fetchCachedMessages(remoteJid: string, limit = 20, beforeTimestamp?: string): Promise<{ messages: WhatsAppMessage[]; hasMore: boolean }> {
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('remote_jid', remoteJid)
    .maybeSingle();

  if (!conv) return { messages: [], hasMore: false };

  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('timestamp', { ascending: false })
    .limit(limit + 1);

  if (beforeTimestamp) {
    query = query.lt('timestamp', beforeTimestamp);
  }

  const { data, error } = await query;
  if (error) return { messages: [], hasMore: false };

  const hasMore = (data?.length ?? 0) > limit;
  const rows = (data ?? []).slice(0, limit);
  return { messages: rows.reverse().map(mapDbMessage), hasMore };
}

export function subscribeToMessages(remoteJid: string, onInsert: (msg: WhatsAppMessage) => void): () => void {
  let subscription: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  (async () => {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (cancelled || !conv) return;

    subscription = supabase
      .channel(`whatsapp_messages:${conv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conv.id}`,
      }, (payload) => {
        onInsert(mapDbMessage(payload.new as Record<string, unknown>));
      })
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (subscription) supabase.removeChannel(subscription);
  };
}

export async function sendWhatsAppMessage(userId: string, remoteJid: string, text: string, phoneNumber?: string | null): Promise<WhatsAppMessage> {
  return sendEvolutionMessage(userId, remoteJid, text, phoneNumber);
}

export async function fetchCRMContext(remoteJid: string, phoneNumber: string | null, recentMessages: WhatsAppMessage[]): Promise<CRMContext> {
  const phone = phoneNumber ?? getPhoneNumber(remoteJid) ?? remoteJid.split('@')[0];
  const phoneDigits = phone.replace(/[^0-9]/g, '');

  const leadQuery = supabase
    .from('leads')
    .select('*')
    .or(`phone.ilike.%${phoneDigits}%,whatsapp.ilike.%${phoneDigits}%`)
    .limit(1);

  const [leadResult, dealsResult, tasksResult] = await Promise.all([
    leadQuery,
    phoneDigits
      ? supabase.from('deals').select('*, lead:leads(*), property:properties(*)').or(`lead.phone.ilike.%${phoneDigits}%,lead.whatsapp.ilike.%${phoneDigits}%`).limit(5)
      : Promise.resolve({ data: [], error: null }),
    phoneDigits
      ? supabase.from('tasks').select('*').eq('status', 'todo').limit(5)
      : Promise.resolve({ data: [], error: null }),
  ]);

  let properties: Record<string, unknown>[] = [];
  if (leadResult.data && leadResult.data.length > 0) {
    const lead = leadResult.data[0] as Record<string, unknown>;
    const interest = (lead.property_type as string) ?? (lead.interested_in as string);
    if (interest) {
      const propResult = await supabase
        .from('properties')
        .select('*')
        .ilike('type', `%${interest}%`)
        .limit(3);
      properties = (propResult.data ?? []) as Record<string, unknown>[];
    }
  }

  return {
    contactName: recentMessages.length > 0 ? (recentMessages[recentMessages.length - 1].sender_name ?? 'Contact') : 'Contact',
    phoneNumber: phone,
    lead: (leadResult.data?.[0] as Record<string, unknown>) ?? null,
    properties,
    deals: (dealsResult.data ?? []) as Record<string, unknown>[],
    tasks: (tasksResult.data ?? []) as Record<string, unknown>[],
    recentMessages: recentMessages.slice(-15).map((m) => ({
      from: m.from_me ? 'Me' : (m.sender_name ?? 'Contact'),
      text: m.text ?? '',
      time: m.timestamp ?? '',
    })),
  };
}
