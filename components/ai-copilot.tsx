'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, Check, AlertTriangle, User, Home, CheckSquare, Calendar, Search, TrendingUp, MessageCircle } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { askAI, localeInstruction } from '@/lib/ai';
import { fetchLeads, fetchProperties, fetchTasks, fetchMeetings, fetchDeals, createLead, createTask, createMeeting } from '@/lib/data';
import { fetchCachedConversations, fetchCachedMessages } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/language-provider';
import type { Locale } from '@/lib/i18n';

type AIMessage = { role: 'user' | 'assistant'; content: string };
type AIAction = {
  type: 'create_lead' | 'create_task' | 'create_meeting' | 'find_leads' | 'find_properties' | 'summarize';
  label: string;
  data: Record<string, unknown>;
  description: string;
};

const pageContextMap: Record<string, { labelKey: string; icon: typeof User; fetchContext: () => Promise<string> }> = {
  '/': { labelKey: 'aiCopilot.contextDashboard', icon: TrendingUp, fetchContext: fetchDashboardContext },
  '/leads': { labelKey: 'aiCopilot.contextLeads', icon: User, fetchContext: fetchLeadsContext },
  '/properties': { labelKey: 'aiCopilot.contextProperties', icon: Home, fetchContext: fetchPropertiesContext },
  '/tasks': { labelKey: 'aiCopilot.contextTasks', icon: CheckSquare, fetchContext: fetchTasksContext },
  '/calendar': { labelKey: 'aiCopilot.contextCalendar', icon: Calendar, fetchContext: fetchCalendarContext },
  '/meetings': { labelKey: 'aiCopilot.contextMeetings', icon: Calendar, fetchContext: fetchCalendarContext },
  '/deals': { labelKey: 'aiCopilot.contextDeals', icon: TrendingUp, fetchContext: fetchDealsContext },
  '/pipeline': { labelKey: 'aiCopilot.contextPipeline', icon: TrendingUp, fetchContext: fetchDealsContext },
  '/contacts': { labelKey: 'aiCopilot.contextContacts', icon: User, fetchContext: fetchContactsContext },
  '/whatsapp': { labelKey: 'aiCopilot.contextWhatsApp', icon: MessageCircle, fetchContext: async () => 'WhatsApp conversations page. Use CRM data for context.' },
};

async function fetchLeadsContext(): Promise<string> {
  const [leads, properties, meetings, tasks] = await Promise.all([fetchLeads(), fetchProperties(), fetchMeetings(), fetchTasks()]);
  return `Current page: Leads. ${leads.length} leads in CRM.\nLEADS:\n${leads.slice(0, 15).map(l =>
    `- ${l.name} | id=${l.id} | status=${l.status} | source=${l.source} | budget=${l.budget} | score=${l.score} | phone=${l.phone ?? 'N/A'} | interest=${l.property_interest ?? 'N/A'} | notes=${l.notes ?? 'N/A'} | lastActivity=${l.lastActivity}`
  ).join('\n')}\nAVAILABLE PROPERTIES:\n${properties.filter(p => p.status === 'available').slice(0, 20).map(p =>
    `- ${p.title} | id=${p.id} | city=${p.city} | price=${p.price} | type=${p.type} | beds=${p.bedrooms} | baths=${p.bathrooms} | area=${p.area}m² | amenities=${p.amenities?.join(', ') ?? 'N/A'}`
  ).join('\n')}\nMEETINGS:\n${meetings.slice(0, 15).map(m => `- ${m.title} | lead=${m.lead_id ?? 'N/A'} | date=${m.date} ${m.time} | status=${m.status}`).join('\n')}\nTASKS:\n${tasks.slice(0, 15).map(t => `- ${t.title} | status=${t.status} | due=${t.dueDate} | related=${t.related_id ?? 'N/A'}`).join('\n')}`;
}

async function fetchPropertiesContext(): Promise<string> {
  const props = await fetchProperties();
  return `Current page: Properties. ${props.length} properties.\n` + props.slice(0, 15).map(p =>
    `- ${p.title} | type=${p.type} | city=${p.city} | price=${p.price} | beds=${p.bedrooms} | baths=${p.bathrooms} | area=${p.area}m² | status=${p.status}`
  ).join('\n');
}

async function fetchTasksContext(): Promise<string> {
  const tasks = await fetchTasks();
  return `Current page: Tasks. ${tasks.length} tasks.\n` + tasks.slice(0, 15).map(t =>
    `- ${t.title} | status=${t.status} | priority=${t.priority} | due=${t.dueDate} | assignee=${t.assignee?.name ?? 'Unassigned'}`
  ).join('\n');
}

async function fetchCalendarContext(): Promise<string> {
  const meetings = await fetchMeetings();
  return `Current page: Calendar. ${meetings.length} meetings.\n` + meetings.slice(0, 15).map(m =>
    `- ${m.title} | date=${m.date} | time=${m.time} | type=${m.type} | attendee=${m.attendee} | status=${m.status}`
  ).join('\n');
}

async function fetchDealsContext(): Promise<string> {
  const deals = await fetchDeals();
  return `Current page: Deals/Pipeline. ${deals.length} deals.\n` + deals.slice(0, 15).map(d =>
    `- ${d.title} | stage=${d.stage} | value=${d.value} | lead=${d.leadName} | property=${d.propertyName} | owner=${d.ownerName}`
  ).join('\n');
}

async function fetchContactsContext(): Promise<string> {
  const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(15);
  if (error || !data) return 'Current page: Contacts. Unable to load.';
  return `Current page: Contacts. ${data.length} contacts.\n` + data.map(c =>
    `- ${c.first_name ?? ''} ${c.last_name ?? ''} | phone=${c.phone ?? 'N/A'} | email=${c.email ?? 'N/A'} | company=${c.company ?? 'N/A'}`
  ).join('\n');
}

async function fetchDashboardContext(): Promise<string> {
  const [leads, properties, tasks, deals, meetings] = await Promise.all([fetchLeads(), fetchProperties(), fetchTasks(), fetchDeals(), fetchMeetings()]);
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate !== 'N/A' && new Date(t.dueDate) < new Date());
  const hotLeads = leads.filter(l => l.score >= 70).slice(0, 5);
  return `Current page: Dashboard.\nLeads: ${leads.length} (${hotLeads.length} hot)\nProperties: ${properties.length} (${properties.filter(p => p.status === 'available').length} available)\nTasks: ${tasks.length} (${overdueTasks.length} overdue)\nMeetings: ${meetings.length}\nDeals: ${deals.length}\n\nHot leads:\n${hotLeads.map(l => `- ${l.name} (id=${l.id}, score=${l.score}, status=${l.status}, lastActivity=${l.lastActivity})`).join('\n')}\n\nOverdue tasks:\n${overdueTasks.slice(0, 5).map(t => `- ${t.title} (due=${t.dueDate}, related=${t.related_id ?? 'N/A'})`).join('\n')}`;
}

function buildSystemPrompt(pageLabel: string, crmContext: string, locale: Locale): string {
  const langInstruction = localeInstruction(locale);
  return `You are the MEHANS AI Sales Operating System for a real-estate agency. You are an accountable sales employee, not a generic chatbot. The user is currently on the "${pageLabel}" page.

${langInstruction}

CRM DATA (real, from Supabase):
${crmContext}

You can help with:
- Lead qualification: separate known facts from missing information and recommend the next question.
- Property matching: use only AVAILABLE PROPERTIES and explain each match against the lead's known requirements.
- WhatsApp sales support: draft a reply from the real conversation context; never send it.
- Follow-up and priority: identify who is waiting for the agency, overdue work, meeting follow-up, and HOT/WARM/COLD reasons.
- Creating tasks or meetings only after explicit confirmation.

RULES:
1. When the user asks to CREATE or UPDATE something, respond with a JSON action block on its own, wrapped in <action>...</action> tags. Format:
<action>
{"type":"create_lead","label":"Create Lead","description":"Create a new lead","data":{"first_name":"","phone":"","property_interest":"","budget":0,"source":"manual","status":"new"}}
</action>
2. For create_task: data should have title, priority (low|medium|high|urgent), due_date (YYYY-MM-DD), description.
3. For create_meeting: data should have title, starts_at (ISO), duration_minutes, meeting_type, attendee_name, location.
4. For find_leads or find_properties: respond with a summary of matching results from the CRM data and include record ids when useful.
5. For WhatsApp drafts, clearly label the draft and never claim it was sent.
6. For missing values, say "Not recorded" and ask for the missing information; never infer or invent it.
7. Base HOT/WARM/COLD only on recorded score, status, timing, tasks, meetings, and conversation signals.
8. Keep responses concise and actionable. No preamble.
9. Never claim to have performed an action — always propose it for confirmation.
10. All natural-language responses must be in the user's interface language. Never respond in English when the user's language is French or Arabic.`;
}

function parseAction(text: string, t: (key: string, vars?: Record<string, string | number>) => string): { action: AIAction | null; display: string } {
  const match = text.match(/<action>([\s\S]*?)<\/action>/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const action: AIAction = {
        type: parsed.type,
        label: parsed.label ?? t('aiCopilot.confirmAction'),
        data: parsed.data ?? {},
        description: parsed.description ?? '',
      };
      const display = text.replace(match[0], '').trim();
      return { action, display };
    } catch {}
  }
  return { action: null, display: text };
}

async function executeAction(action: AIAction, t: (key: string, vars?: Record<string, string | number>) => string): Promise<string> {
  switch (action.type) {
    case 'create_lead': {
      const result = await createLead(action.data);
      if (!result) throw new Error(t('aiCopilot.actionFailed'));
      return t('aiCopilot.leadCreated', { name: result.name });
    }
    case 'create_task': {
      const result = await createTask(action.data);
      if (!result) throw new Error(t('aiCopilot.actionFailed'));
      return t('aiCopilot.taskCreated', { title: result.title });
    }
    case 'create_meeting': {
      const result = await createMeeting(action.data);
      if (!result) throw new Error(t('aiCopilot.actionFailed'));
      return t('aiCopilot.meetingCreated', { title: result.title });
    }
    default:
      return t('aiCopilot.actionCompleted');
  }
}

export function AICopilot() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t, rtl } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [crmContext, setCrmContext] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [proactiveLoaded, setProactiveLoaded] = useState(false);
  const [proactiveLocale, setProactiveLocale] = useState<Locale | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageCtx = useMemo(() => {
    const matchPath = Object.keys(pageContextMap).find(key => pathname.startsWith(key));
    return matchPath ? pageContextMap[matchPath] : { labelKey: 'aiCopilot.contextCRM', icon: Sparkles, fetchContext: async () => 'No specific page context available.' };
  }, [pathname]);

  const pageLabel = t(pageCtx.labelKey);

  const selectedContext = useMemo(() => {
    const leadId = searchParams.get('lead') ?? searchParams.get('lead_id');
    const phone = searchParams.get('phone');
    if (!leadId && !phone) return '';
    return `Selected CRM context: ${leadId ? `lead id=${leadId}` : `WhatsApp phone=${phone}`}. Use this record as the primary focus.`;
  }, [searchParams]);

  useEffect(() => {
    if (open && !crmContext) {
      pageCtx.fetchContext().then(setCrmContext).catch(() => setCrmContext('Unable to load CRM context.'));
    }
  }, [open, pageCtx, crmContext]);

  // Load proactive suggestions when modal opens or locale changes
  useEffect(() => {
    if (open && crmContext && (proactiveLocale !== locale || !proactiveLoaded)) {
      setProactiveLoaded(true);
      setProactiveLocale(locale);
      loadProactiveSuggestions();
    }
  }, [open, crmContext, locale]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading, pendingAction]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-copilot', handler);
    return () => window.removeEventListener('open-ai-copilot', handler);
  }, []);

  const loadProactiveSuggestions = async () => {
    try {
      const systemPrompt = buildSystemPrompt(pageLabel, crmContext || 'No context loaded yet.', locale);
      const raw = await askAI(
        [{ role: 'user', content: t('aiCopilot.proactivePrompt') }],
        systemPrompt,
        undefined,
        locale,
      );
      const lines = raw.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 3);
      setSuggestions(lines);
    } catch {}
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingAction(null);
    try {
      const systemPrompt = buildSystemPrompt(pageLabel, `${selectedContext}\n${crmContext}`, locale);
      const response = await askAI([...messages, userMsg], systemPrompt, undefined, locale);
      const { action, display } = parseAction(response, t);
      const assistantMsg: AIMessage = { role: 'assistant', content: display || response };
      setMessages(prev => [...prev, assistantMsg]);
      if (action) setPendingAction(action);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('ai.unableReachAI');
      setMessages(prev => [...prev, { role: 'assistant', content: `${t('aiCopilot.error')}: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, pageLabel, crmContext, selectedContext, locale, t]);

  const confirmAction = async () => {
    if (!pendingAction) return;
    setExecuting(true);
    try {
      const result = await executeAction(pendingAction, t);
      toast.success(result);
      setMessages(prev => [...prev, { role: 'assistant', content: t('aiCopilot.done', { result }) }]);
      setPendingAction(null);
      setCrmContext('');
      setProactiveLoaded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiCopilot.actionFailed'));
    } finally {
      setExecuting(false);
    }
  };

  const quickActions = useMemo(() => {
    const base = [
      { label: t('aiCopilot.attentionToday'), icon: AlertTriangle },
      { label: t('aiCopilot.uncontactedLeads'), icon: Search },
    ];
    if (pageCtx.labelKey === 'aiCopilot.contextLeads') base.push({ label: t('aiCopilot.createLead'), icon: User });
    if (pageCtx.labelKey === 'aiCopilot.contextProperties') base.push({ label: t('aiCopilot.showProperties'), icon: Home });
    if (pageCtx.labelKey === 'aiCopilot.contextTasks') base.push({ label: t('aiCopilot.createFollowUpTask'), icon: CheckSquare });
    if (pageCtx.labelKey === 'aiCopilot.contextCalendar' || pageCtx.labelKey === 'aiCopilot.contextMeetings') base.push({ label: t('aiCopilot.scheduleMeeting'), icon: Calendar });
    return base;
  }, [pageCtx.labelKey, t]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[44] flex h-12 w-12 items-center justify-center sm:bottom-5 rounded-full bg-gold text-[#0D0D0F] shadow-lg shadow-gold/20 transition-all hover:scale-105 hover:bg-gold-soft',
          rtl ? 'left-4 sm:left-5' : 'right-4 sm:right-5'
        )}
        title={t('aiCopilot.title')}
      >
        <Sparkles className="h-5 w-5" strokeWidth={1.5} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[70] bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[71] flex h-[min(600px,calc(100dvh-7rem))] max-h-[80vh] w-[calc(100vw-1rem)] max-w-[400px] flex-col sm:bottom-5 overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-modal',
                rtl ? 'left-2 sm:left-5' : 'right-2 sm:right-5'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-bg text-gold">
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{t('aiCopilot.title')}</p>
                    <p className="text-[10px] text-text-muted">{t('aiCopilot.context')}: {pageLabel}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 && !loading && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-gold-border bg-gold-bg p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gold">{t('aiCopilot.proactiveInsights')}</p>
                      {suggestions.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {suggestions.map((s, i) => (
                            <p key={i} className="text-xs text-text-primary">{s}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-text-muted">{t('aiCopilot.analyzing')}</p>
                      )}
                    </div>
                    <p className="px-1 text-xs text-text-muted">{t('aiCopilot.quickActions')}</p>
                    {quickActions.map((qa) => (
                      <button
                        key={qa.label}
                        onClick={() => sendMessage(qa.label)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-gold-border hover:text-gold"
                      >
                        <qa.icon className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.5} />
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'mb-2 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                      msg.role === 'user' ? 'rounded-br-sm bg-gold-bg text-text-primary' : 'rounded-bl-sm bg-bg-secondary text-text-secondary',
                      rtl ? (msg.role === 'user' ? 'mr-auto' : 'ml-auto') : (msg.role === 'user' ? 'ml-auto' : 'mr-auto')
                    )}
                  >
                    <p className="whitespace-pre-wrap" style={{ textAlign: rtl ? 'right' : 'left' }}>{msg.content}</p>
                  </div>
                ))}
                {loading && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('aiCopilot.analyzingShort')}
                  </div>
                )}
                {pendingAction && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-xl border border-gold-border bg-gold-bg/50 p-3"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-gold" />
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gold">{pendingAction.label}</p>
                    </div>
                    <p className="mb-2 text-xs text-text-secondary">{pendingAction.description}</p>
                    <div className="mb-3 rounded-lg border border-border bg-bg-secondary p-2">
                      {Object.entries(pendingAction.data).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 py-0.5 text-[11px]">
                          <span className="text-text-muted capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="text-right text-text-primary" style={{ textAlign: rtl ? 'left' : 'right' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmAction}
                        disabled={executing}
                        className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-[#0D0D0F] transition-colors hover:bg-gold-soft disabled:opacity-50"
                      >
                        {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t('aiCopilot.confirm')}
                      </button>
                      <button
                        onClick={() => setPendingAction(null)}
                        disabled={executing}
                        className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
                      >
                        {t('aiCopilot.cancel')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder={t('aiCopilot.placeholder')}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-base text-text-primary outline-none focus:border-gold-border"
                    style={{ textAlign: rtl ? 'right' : 'left' }}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={loading || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold text-[#0D0D0F] transition-colors hover:bg-gold-soft disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
