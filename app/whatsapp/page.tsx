'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, Link2, Loader2, MoreVertical, Paperclip, Plus, Search, Send, Settings2, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X, FileText, Image as ImageIcon, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Avatar, PageHeader } from '@/components/shared';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useAuth } from '@/components/auth-provider';
import {
  fetchWhatsAppConnection,
  fetchWhatsAppConversations,
  fetchWhatsAppMessages,
  fetchCachedMessages,
  subscribeToMessages,
  sendWhatsAppMessage,
  sendEvolutionMedia,
  updateWhatsAppConnection,
  createEvolutionInstance,
  fetchEvolutionQR,
  checkEvolutionInstanceStatus,
  checkEvolutionStatusByUserId,
  logoutEvolutionInstance,
  fetchCRMContext,
  type WhatsAppConnection,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type CRMContext,
} from '@/lib/whatsapp';
import { askAI } from '@/lib/ai';
import { cn } from '@/lib/utils';

function formatTime(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ACCEPTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PAGE_SIZE = 20;

type Attachment = {
  file: File;
  base64: string;
  mediatype: 'image' | 'document';
  mimetype: string;
  preview: string | null;
};

type MessageCache = Map<string, { messages: WhatsAppMessage[]; hasMore: boolean }>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function dedupMessages(msgs: WhatsAppMessage[]): WhatsAppMessage[] {
  const seen = new Set<string>();
  return msgs.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const connectionQuery = useSupabaseQuery(fetchWhatsAppConnection);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connection, setConnection] = useState<WhatsAppConnection>({ connected: false, phoneNumber: '', provider: 'Evolution API', instanceName: '' });
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrStage, setQrStage] = useState<'idle' | 'creating' | 'ready' | 'checking' | 'linked' | 'error'>('idle');
  const [qrError, setQrError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [crmContext, setCrmContext] = useState<CRMContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Message cache: keyed by remote_jid
  const cacheRef = useRef<MessageCache>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const stopStatusPolling = () => {
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; }
  };

  const syncConnectionFromEvolution = async (knownInstanceName?: string) => {
    if (!userId) return;
    const { state, instanceName } = knownInstanceName
      ? await checkEvolutionInstanceStatus(knownInstanceName)
      : await checkEvolutionStatusByUserId(userId);
    const isOpen = state === 'open';
    setConnection((prev) => {
      const next = { ...prev, connected: isOpen, instanceName: instanceName || prev.instanceName };
      if (isOpen && (!prev.connected || prev.instanceName !== instanceName)) {
        updateWhatsAppConnection(next).catch(() => {});
      }
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return;
    let active = true;
    syncConnectionFromEvolution().then(() => {
      if (!active) return;
      statusPollRef.current = setInterval(() => { syncConnectionFromEvolution(); }, 10000);
    });
    return () => { active = false; stopStatusPolling(); };
  }, [userId]);

  useEffect(() => {
    if (!connectionQuery.data) return;
    setConnection(connectionQuery.data);
  }, [connectionQuery.data]);

  useEffect(() => {
    if (!userId || !connection.connected) return;
    let active = true;
    setConversationsLoading(true);
    fetchWhatsAppConversations(userId)
      .then((data) => { if (active) setConversations(data); })
      .catch(() => { if (active) toast.error('Unable to load conversations'); })
      .finally(() => { if (active) setConversationsLoading(false); });
    const refreshRef = setInterval(() => {
      fetchWhatsAppConversations(userId)
        .then((data) => { if (active) setConversations(data); })
        .catch(() => {});
    }, 10000);
    return () => { active = false; clearInterval(refreshRef); };
  }, [userId, connection.connected]);

  // Load messages: cached first, then background fetch + realtime
  useEffect(() => {
    if (!selectedJid || !userId) { setMessages([]); setMessagesError(null); setHasMore(false); return; }
    let active = true;

    // 1. Immediately show cached messages if available
    const cached = cacheRef.current.get(selectedJid);
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
    } else {
      setMessages([]);
    }

    // 2. Fetch from DB (fast) — then sync with Evolution API in background
    const loadInitial = async () => {
      setLoadingMessages(true);
      setMessagesError(null);
      try {
        const { messages: dbMsgs, hasMore: more } = await fetchCachedMessages(selectedJid, PAGE_SIZE);
        if (!active) return;
        setMessages(dbMsgs);
        setHasMore(more);
        cacheRef.current.set(selectedJid, { messages: dbMsgs, hasMore: more });
      } catch {
        // DB might not have conversation yet — try full fetch
      } finally {
        if (active) setLoadingMessages(false);
      }

      // 3. Background sync from Evolution API (non-blocking)
      try {
        await fetchWhatsAppMessages(userId, selectedJid);
        if (!active) return;
        const { messages: synced, hasMore: more } = await fetchCachedMessages(selectedJid, PAGE_SIZE);
        if (active) {
          setMessages(synced);
          setHasMore(more);
          cacheRef.current.set(selectedJid, { messages: synced, hasMore: more });
        }
      } catch (error) {
        if (active && !cached) {
          setMessagesError(error instanceof Error ? error.message : 'Unable to load messages');
        }
      }
    };

    loadInitial();

    // 4. Realtime subscription for new messages
    const unsubscribe = subscribeToMessages(selectedJid, (newMsg) => {
      if (!active) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const updated = [...prev, newMsg];
        const cached = cacheRef.current.get(selectedJid);
        if (cached) {
          cacheRef.current.set(selectedJid, { messages: updated, hasMore: cached.hasMore });
        }
        return updated;
      });
    });

    return () => { active = false; unsubscribe(); };
  }, [userId, selectedJid]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!selectedJid || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0]?.timestamp;
      const { messages: older, hasMore: more } = await fetchCachedMessages(selectedJid, PAGE_SIZE, oldest ?? undefined);
      setMessages((prev) => dedupMessages([...older, ...prev]));
      setHasMore(more);
      const cached = cacheRef.current.get(selectedJid);
      if (cached) {
        cacheRef.current.set(selectedJid, { messages: dedupMessages([...older, ...cached.messages]), hasMore: more });
      }
    } catch {
      toast.error('Unable to load older messages');
    } finally {
      setLoadingMore(false);
    }
  }, [selectedJid, loadingMore, hasMore, messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Fetch CRM context when conversation changes
  useEffect(() => {
    if (!selectedJid || !messages.length) { setCrmContext(null); return; }
    const selected = conversations.find((c) => c.remote_jid === selectedJid);
    if (!selected) return;
    fetchCRMContext(selectedJid, selected.phone_number, messages)
      .then(setCrmContext)
      .catch(() => {});
  }, [selectedJid, messages.length, conversations]);

  // AI auto-analysis when conversation is selected
  const buildAISystemPrompt = useCallback((): string => {
    let context = `You are the MEHANS CRM WhatsApp assistant for a real estate business.\n\n`;
    if (crmContext) {
      context += `CONVERSATION CONTEXT:\n`;
      context += `Contact: ${crmContext.contactName}\n`;
      context += `Phone: ${crmContext.phoneNumber ?? 'Unknown'}\n\n`;
      if (crmContext.recentMessages.length > 0) {
        context += `RECENT MESSAGES:\n`;
        crmContext.recentMessages.forEach((m) => {
          context += `[${m.time}] ${m.from}: ${m.text}\n`;
        });
        context += `\n`;
      }
      if (crmContext.lead) {
        const lead = crmContext.lead;
        context += `LEAD INFO:\n`;
        context += `- Name: ${lead.first_name ?? ''} ${lead.last_name ?? ''}\n`;
        context += `- Status: ${lead.status ?? 'unknown'}\n`;
        context += `- Source: ${lead.source ?? 'unknown'}\n`;
        context += `- Budget: ${lead.budget_min ?? '?'} - ${lead.budget_max ?? '?'}\n`;
        context += `- Property interest: ${lead.property_type ?? lead.interested_in ?? 'unknown'}\n`;
        context += `- City: ${lead.city ?? 'unknown'}\n`;
        context += `- Notes: ${lead.notes ?? 'none'}\n\n`;
      }
      if (crmContext.properties.length > 0) {
        context += `RELEVANT PROPERTIES:\n`;
        crmContext.properties.forEach((p) => {
          context += `- ${p.title} (${p.type}, ${p.city}): ${p.price} MAD, ${p.bedrooms} bed, ${p.bathrooms} bath, ${p.area}m²\n`;
        });
        context += `\n`;
      }
      if (crmContext.deals.length > 0) {
        context += `DEALS:\n`;
        crmContext.deals.forEach((d) => {
          context += `- ${d.title}: stage=${d.stage}, value=${d.value}\n`;
        });
        context += `\n`;
      }
      if (crmContext.tasks.length > 0) {
        context += `UPCOMING TASKS:\n`;
        crmContext.tasks.forEach((t) => {
          context += `- ${t.title} (due: ${t.due_date ?? 'no date'})\n`;
        });
        context += `\n`;
      }
    }
    context += `Rules:\n- If the user asks you to write a reply, generate ONLY the reply text, ready to send. No preamble.\n- If the user asks for analysis (summary, report, lead qualification), provide a concise structured response.\n- Never send messages yourself. The user will review and send.\n- Keep replies under 200 words unless asked for detail.\n- For CRM reports, use this format: CLIENT SUMMARY, NEED, BUDGET, LOCATION, PROPERTY TYPE, INTENT, LEAD QUALITY, CURRENT STAGE, OBJECTIONS, NEXT ACTION, SUGGESTED FOLLOW-UP. Only include sections where information is available.`;
    return context;
  }, [crmContext]);

  const aiSend = useCallback(async (text: string) => {
    if (!text.trim() || aiLoading) return;
    setAiInput('');
    setAiLoading(true);
    setAiSuggestion(null);
    const userMsg = { role: 'user' as const, content: text };
    setAiHistory((prev) => [...prev, userMsg]);
    try {
      const response = await askAI([...aiHistory, userMsg], buildAISystemPrompt());
      setAiHistory((prev) => [...prev, { role: 'assistant', content: response }]);
      setAiSuggestion(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reach the AI service');
    } finally { setAiLoading(false); }
  }, [aiLoading, aiHistory, buildAISystemPrompt]);

  // Auto-trigger AI summary when a conversation is selected and AI panel is open
  const autoSummaryTriggered = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedJid || !aiOpen || !crmContext) return;
    if (autoSummaryTriggered.current === selectedJid) return;
    if (crmContext.recentMessages.length === 0) return;
    autoSummaryTriggered.current = selectedJid;
    setAiHistory([]);
    setAiSuggestion(null);
    aiSend('Provide a brief summary of this conversation and the lead\'s needs. Include any key details from the CRM context.');
  }, [selectedJid, aiOpen, crmContext, aiSend]);

  const aiQuickActions = useMemo(() => [
    'Summarize Lead Needs',
    'Draft Follow-up Reply',
    'Suggest Property Match',
    'Write a professional reply',
    'Generate a CRM report',
    'Reply in French',
  ], []);

  const selected = conversations.find((c) => c.remote_jid === selectedJid) ?? null;
  const filtered = useMemo(() => conversations.filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase())), [conversations, search]);

  const handleSend = async () => {
    if (!selected || sending || !userId) return;
    if (attachment) {
      setSending(true);
      try {
        const saved = await sendEvolutionMedia(
          userId,
          selected.remote_jid,
          attachment.mediatype,
          attachment.mimetype,
          attachment.base64,
          attachment.file.name,
          message.trim(),
          selected.phone_number,
        );
        setMessages((current) => dedupMessages([...current, saved]));
        setAttachment(null);
        setMessage('');
        setConversations((current) =>
          current.map((c) => c.remote_jid === selected.remote_jid ? { ...c, last_message: attachment.mediatype === 'image' ? 'Photo' : attachment.file.name, last_message_timestamp: new Date().toISOString() } : c)
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to send media');
      } finally { setSending(false); }
      return;
    }
    if (!message.trim()) return;
    setSending(true);
    try {
      const saved = await sendWhatsAppMessage(userId, selected.remote_jid, message.trim(), selected.phone_number);
      setMessages((current) => dedupMessages([...current, saved]));
      setMessage('');
      setConversations((current) =>
        current.map((c) => c.remote_jid === selected.remote_jid ? { ...c, last_message: message.trim(), last_message_timestamp: new Date().toISOString() } : c)
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send message');
    } finally { setSending(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 10 MB.');
      return;
    }
    if (!ACCEPTED_MEDIA.includes(file.type)) {
      toast.error('Unsupported file type. Please select an image (JPEG, PNG, WebP, GIF) or document (PDF, Word, TXT).');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? `data:${file.type};base64,${base64}` : null;
      setAttachment({ file, base64, mediatype: isImage ? 'image' : 'document', mimetype: file.type, preview });
    } catch {
      toast.error('Failed to read the selected file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startConnect = async () => {
    if (!userId) { toast.error('You must be signed in to connect WhatsApp'); return; }
    setQrStage('creating');
    setQrError('');
    setQrData(null);
    try {
      const { instanceName, qrCode } = await createEvolutionInstance(userId);
      if (!qrCode) {
        setQrStage('error');
        setQrError('No QR code returned from Evolution API');
        toast.error('No QR code returned from Evolution API');
        return;
      }
      setQrData(qrCode);
      setQrStage('ready');
      setConnection((c) => ({ ...c, instanceName }));
      stopPolling();
      pollRef.current = setInterval(async () => {
        const { state } = await checkEvolutionInstanceStatus(instanceName);
        if (state === 'open') {
          stopPolling();
          setQrStage('linked');
          const next = { ...connection, connected: true, instanceName, provider: 'Evolution API' };
          await updateWhatsAppConnection(next);
          setConnection(next);
          connectionQuery.refetch();
          toast.success('WhatsApp connected successfully');
        }
      }, 3000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to connect to Evolution API';
      setQrStage('error');
      setQrError(msg);
      toast.error(msg);
    }
  };

  const refreshQr = async () => {
    if (!connection.instanceName && !userId) return;
    const instanceName = connection.instanceName || `instance_${userId}`;
    setQrStage('creating');
    setQrError('');
    try {
      const qr = await fetchEvolutionQR(instanceName);
      if (qr) { setQrData(qr); setQrStage('ready'); }
      else {
        setQrStage('error');
        setQrError('No QR code returned from Evolution API');
        toast.error('No QR code returned from Evolution API');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to connect to Evolution API';
      setQrStage('error');
      setQrError(msg);
      toast.error(msg);
    }
  };

  const closeConnectModal = () => {
    stopPolling();
    setConnectOpen(false);
    setQrStage('idle');
    setQrData(null);
    setQrError('');
  };

  useEffect(() => {
    return () => { stopPolling(); stopStatusPolling(); };
  }, []);

  const renderQrContent = () => {
    if (qrStage === 'creating') {
      return <div className="flex flex-col items-center gap-2 text-text-muted"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-xs">Creating instance & generating QR…</span></div>;
    }
    if (qrStage === 'ready' && qrData) {
      return (
        <>
          <img src={qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`} alt="WhatsApp QR Code" className="h-48 w-48 rounded-lg" />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
            <Loader2 className="h-3 w-3 animate-spin" /> Waiting for scan…
          </div>
        </>
      );
    }
    if (qrStage === 'checking') {
      return <div className="flex flex-col items-center gap-2 text-text-muted"><Link2 className="h-8 w-8 text-gold" /><span className="text-xs">Linking device…</span></div>;
    }
    if (qrStage === 'linked') {
      return <div className="flex flex-col items-center gap-2 text-success"><CheckCircle2 className="h-12 w-12" /><span className="text-xs">Device linked!</span></div>;
    }
    if (qrStage === 'error') {
      return <div className="flex flex-col items-center gap-2 text-error"><AlertCircle className="h-8 w-8" /><span className="text-xs text-center px-4">{qrError || 'Failed to connect to Evolution API'}</span></div>;
    }
    return <div className="flex flex-col items-center gap-2 text-text-muted"><RefreshCw className="h-8 w-8" /><span className="text-xs">Click to generate QR code</span></div>;
  };

  const showConversationOnMobile = Boolean(selectedJid);

  return (
    <AppShell>
      <PageHeader title="WhatsApp" description="Manage conversations from your connected business number">
        <button onClick={() => setConnectOpen(true)} className="btn btn-outline btn-md"><Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">{connection.connected ? 'Settings' : 'Connect'}</span></button>
      </PageHeader>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn('h-2.5 w-2.5 rounded-full', connection.connected ? 'bg-success' : 'bg-warning')} />
          <div>
            <p className="text-sm font-medium text-text-primary">{connection.connected ? 'Connected' : 'Not connected'}</p>
            <p className="hidden text-xs text-text-muted sm:block">{connection.connected ? `${connection.provider} · ${connection.instanceName}` : 'Connect a business number to manage WhatsApp conversations'}</p>
          </div>
        </div>
        {!connection.connected && <button onClick={() => setConnectOpen(true)} className="text-xs font-medium text-gold hover:text-gold-soft">Set up <Link2 className="ml-1 inline h-3.5 w-3.5" /></button>}
      </div>

      <div className="flex h-[calc(100vh-270px)] min-h-[520px] gap-4 overflow-hidden">
        {/* Conversation list */}
        <aside className={cn(
          'flex shrink-0 flex-col rounded-2xl border border-border bg-bg-secondary',
          'w-full md:w-80',
          showConversationOnMobile ? 'hidden md:flex' : 'flex'
        )}>
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversationsLoading ? <div className="flex justify-center py-10 text-text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : filtered.length === 0 ? <div className="p-6 text-center text-xs text-text-muted"><Plus className="mx-auto mb-2 h-5 w-5" />No WhatsApp conversations yet.</div>
              : filtered.map((conversation) => (
                <button key={conversation.id} onClick={() => { setSelectedJid(conversation.remote_jid); setAiOpen(false); }} className={cn('flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors', selectedJid === conversation.remote_jid ? 'bg-gold-bg' : 'hover:bg-bg-elevated')}>
                  <Avatar name={conversation.display_name} color="#4A90D9" size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-text-primary">{conversation.display_name}</p>
                      <span className="shrink-0 text-[10px] text-text-muted">{formatDate(conversation.last_message_timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-text-secondary">{conversation.last_message ?? 'No messages yet'}</p>
                      {conversation.unread_count > 0 && <span className="shrink-0 rounded-full bg-gold px-1.5 text-[10px] font-bold text-[#0D0D0F]">{conversation.unread_count}</span>}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </aside>

        {/* Conversation view */}
        <section className={cn(
          'flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-bg-secondary',
          showConversationOnMobile ? 'flex' : 'hidden md:flex'
        )}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-2xl bg-gold-bg p-4 text-gold"><Send className="h-6 w-6" /></div>
              <h2 className="font-serif text-xl text-text-primary">Your conversations will appear here</h2>
              <p className="mt-2 max-w-sm text-sm text-text-muted">Connect WhatsApp and store incoming conversations in this shared inbox.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-border p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setSelectedJid(null)} className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated md:hidden">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar name={selected.display_name} color="#4A90D9" size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{selected.display_name}</p>
                    <p className="text-xs text-success">WhatsApp conversation</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => { setAiOpen(!aiOpen); if (!aiOpen) setAiSuggestion(null); }} className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors', aiOpen ? 'bg-gold-bg text-gold' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary')}>
                    <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">AI Assistant</span>
                  </button>
                  <button className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"><MoreVertical className="h-4 w-4" /></button>
                </div>
              </header>
              <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-bg-primary/40 p-3 sm:p-5">
                    {/* Load more button */}
                    {hasMore && (
                      <div className="mb-3 flex justify-center">
                        <button onClick={loadMore} disabled={loadingMore} className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary hover:border-gold-border hover:text-gold disabled:opacity-50">
                          {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronUp className="h-3.5 w-3.5" />}
                          {loadingMore ? 'Loading…' : 'Load older messages'}
                        </button>
                      </div>
                    )}
                    <div className="mx-auto mb-5 max-w-xs rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-center text-[11px] text-text-muted">Messages are delivered via Evolution API</div>
                    {loadingMessages && messages.length === 0 ? <div className="flex justify-center py-10 text-text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      : messagesError ? <p className="px-5 py-10 text-center text-xs text-error">{messagesError}</p>
                      : messages.length === 0 ? <p className="py-10 text-center text-xs text-text-muted">No messages in this conversation yet.</p>
                      : <div className="space-y-2">{dedupMessages(messages).map((item) => (
                        <div key={item.id} className={cn('flex', item.from_me ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[72%]', item.from_me ? 'rounded-br-sm bg-gold-bg text-text-primary' : 'rounded-bl-sm bg-bg-elevated text-text-primary')}>
                            {item.message_type === 'image' && <p className="mb-1 italic text-text-muted">[Image]</p>}
                            {item.message_type === 'document' && <p className="mb-1 italic text-text-muted">[Document]</p>}
                            <p className="whitespace-pre-wrap break-words">{item.text || ''}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-text-muted">{formatTime(item.timestamp)}{item.from_me && <CheckCheck className="h-3 w-3 text-info" />}</div>
                          </div>
                        </div>
                      ))}</div>}
                    <div ref={messagesEndRef} />
                  </div>
                  {attachment && (
                    <div className="flex items-center gap-3 border-t border-border bg-bg-elevated px-4 py-2.5">
                      {attachment.preview ? (
                        <img src={attachment.preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-bg-secondary">
                          {attachment.mediatype === 'image' ? <ImageIcon className="h-5 w-5 text-text-muted" /> : <FileText className="h-5 w-5 text-text-muted" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{attachment.file.name}</p>
                        <p className="text-[10px] text-text-muted">{(attachment.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={() => setAttachment(null)} className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-bg-secondary hover:text-error">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <footer className="border-t border-border p-2 sm:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <input ref={fileInputRef} type="file" onChange={handleFileSelect} accept={ACCEPTED_MEDIA.join(',')} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-bg-elevated disabled:opacity-50" title="Attach image or document">
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={attachment ? 'Add a caption...' : 'Type a message...'} className="min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-gold-border" />
                      <button disabled={sending || (!message.trim() && !attachment)} onClick={handleSend} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-[#0D0D0F] hover:bg-gold-soft disabled:opacity-60">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                    </div>
                  </footer>
                </div>
                {/* AI Assistant panel */}
                {aiOpen && (
                  <div className="flex w-80 shrink-0 flex-col border-l border-border bg-bg-elevated max-md:fixed max-md:inset-0 max-md:z-50 max-md:w-full max-md:border-l-0">
                    <div className="flex items-center justify-between border-b border-border p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-gold" />
                        <span className="text-sm font-medium text-text-primary">AI Assistant</span>
                      </div>
                      <button onClick={() => setAiOpen(false)} className="rounded-lg p-1 text-text-muted hover:bg-bg-secondary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      {/* Context indicator */}
                      {crmContext && (
                        <div className="mb-3 rounded-lg border border-border bg-bg-secondary px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gold">Active Context</p>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            {crmContext.contactName} · {crmContext.phoneNumber ?? 'Unknown'}
                            {crmContext.lead ? ` · Lead: ${crmContext.lead.status ?? 'new'}` : ' · No lead found'}
                          </p>
                        </div>
                      )}
                      {/* Quick actions - contextual */}
                      {aiHistory.length === 0 && !aiSuggestion && !aiLoading && (
                        <div className="space-y-2">
                          <p className="text-xs text-text-muted">Quick actions:</p>
                          {aiQuickActions.map((action) => (
                            <button key={action} onClick={() => aiSend(action)} disabled={aiLoading} className="block w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-gold-border hover:text-gold disabled:opacity-50">
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                      {aiHistory.map((msg, i) => (
                        <div key={i} className={cn('mb-2 rounded-xl px-3 py-2 text-xs', msg.role === 'user' ? 'bg-gold-bg text-text-primary' : 'bg-bg-secondary text-text-secondary')}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}
                      {aiLoading && (
                        <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                        </div>
                      )}
                      {aiSuggestion && (
                        <div className="mt-3 rounded-xl border border-gold-border bg-gold-bg p-3">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gold">AI Suggestion</p>
                          <p className="whitespace-pre-wrap text-xs text-text-primary">{aiSuggestion}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => { setMessage(aiSuggestion); setAiSuggestion(null); toast.success('Added to composer'); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-elevated">
                              Use message
                            </button>
                            <button onClick={async () => {
                              if (!selected || sending) return;
                              setSending(true);
                              try {
                                const saved = await sendWhatsAppMessage(userId, selected.remote_jid, aiSuggestion, selected.phone_number);
                                setMessages((current) => dedupMessages([...current, saved]));
                                setConversations((current) =>
                                  current.map((c) => c.remote_jid === selected.remote_jid ? { ...c, last_message: aiSuggestion, last_message_timestamp: new Date().toISOString() } : c)
                                );
                                setAiSuggestion(null);
                                toast.success('Message sent');
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : 'Unable to send message');
                              } finally { setSending(false); }
                            }} disabled={sending} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-[#0D0D0F] hover:bg-gold-soft disabled:opacity-60">
                              Send
                            </button>
                            <button onClick={() => aiSend(aiHistory.filter(m => m.role === 'user').slice(-1)[0]?.content || 'Write a professional reply')} disabled={aiLoading} className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-elevated disabled:opacity-50">
                              Regenerate
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border p-3">
                      <div className="flex items-center gap-2">
                        <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(aiInput); } }} placeholder="Ask AI…" className="min-w-0 flex-1 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-xs text-text-primary outline-none focus:border-gold-border" />
                        <button onClick={() => aiSend(aiInput)} disabled={aiLoading || !aiInput.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold text-[#0D0D0F] hover:bg-gold-soft disabled:opacity-50">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {connectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5" onClick={closeConnectModal}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg-elevated p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-xl text-text-primary">{connection.connected ? 'Connection settings' : 'Connect WhatsApp'}</h2>
                <p className="mt-1 text-xs text-text-muted">{connection.connected ? 'Your instance is connected. Reconnect if needed.' : 'Scan the QR code with WhatsApp on your phone to link this workspace.'}</p>
              </div>
              <button onClick={closeConnectModal} className="text-text-muted">×</button>
            </div>

            {!connection.connected && (
              <div className="mb-5 flex flex-col items-center">
                <div className="relative flex h-56 w-56 items-center justify-center rounded-2xl border border-border bg-bg-secondary">
                  {renderQrContent()}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {qrStage === 'idle' || qrStage === 'error' ? (
                    <button onClick={startConnect} className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-soft">
                      <RefreshCw className="h-3.5 w-3.5" /> Generate QR Code
                    </button>
                  ) : (
                    <button onClick={refreshQr} disabled={qrStage === 'creating'} className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-soft disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh QR
                    </button>
                  )}
                  <span className="text-[10px] text-text-muted">Open WhatsApp → Settings → Linked Devices → Link a Device</span>
                </div>
              </div>
            )}

            {connection.connected && (
              <div className="mb-5 flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <p className="text-sm font-medium text-text-primary">WhatsApp Connected</p>
                <p className="text-xs text-text-muted">Instance: {connection.instanceName}</p>
                <button onClick={async () => {
                  if (disconnecting) return;
                  setDisconnecting(true);
                  try {
                    await logoutEvolutionInstance(userId, connection.instanceName);
                    const next = { ...connection, connected: false };
                    await updateWhatsAppConnection(next);
                    setConnection(next);
                    setConversations([]);
                    setSelectedJid(null);
                    setMessages([]);
                    connectionQuery.refetch();
                    toast.success('WhatsApp disconnected');
                    closeConnectModal();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to disconnect from Evolution API');
                  } finally {
                    setDisconnecting(false);
                  }
                }} disabled={disconnecting} className="text-xs font-medium text-error hover:text-red-400 disabled:opacity-50">
                  {disconnecting ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Disconnecting…</span> : 'Disconnect'}
                </button>
              </div>
            )}

            <label className="block text-xs font-medium text-text-secondary">
              Business phone number
              <input value={connection.phoneNumber} onChange={(e) => setConnection((c) => ({ ...c, phoneNumber: e.target.value }))} placeholder="+1 305 555 0100" className="mt-2 w-full rounded-xl border border-border bg-bg-secondary px-3 py-3 text-sm text-text-primary outline-none focus:border-gold-border" />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeConnectModal} className="btn btn-outline btn-md">Close</button>
              {connection.connected && <button onClick={async () => { await updateWhatsAppConnection(connection); toast.success('Settings saved'); closeConnectModal(); }} className="btn btn-gold btn-md">Save changes</button>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
