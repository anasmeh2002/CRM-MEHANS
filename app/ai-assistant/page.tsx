'use client';

import { useState, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  TrendingUp,
  Target,
  Mail,
  MessageCircle,
  Lightbulb,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Copy,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar } from '@/components/shared';
import { fetchLeads, fetchProperties, fetchDeals } from '@/lib/data';
import { getAIInsights } from '@/lib/ai';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Lead, Property, Deal } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { askAI } from '@/lib/ai';
import { useLanguage } from '@/components/language-provider';

const suggestions = [
  'Analyze my pipeline health',
  'What needs my attention today?',
  'Suggest next best actions for my top leads',
  'Generate a follow-up email for my highest-value lead',
];

export default function AIAssistantPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useSupabaseQuery<Lead[]>(fetchLeads);
  const { data: propertiesData } = useSupabaseQuery<Property[]>(fetchProperties);
  const { data: dealsData } = useSupabaseQuery<Deal[]>(fetchDeals);
  const leads: Lead[] = leadsData ?? [];
  const properties: Property[] = propertiesData ?? [];
  const deals: Deal[] = dealsData ?? [];

  const crmContext = JSON.stringify({
    leads: leads.slice(0, 20).map((l) => ({ name: l.name, status: l.status, source: l.source, budget: l.budget, score: l.score, tags: l.tags, owner: l.owner })),
    properties: properties.slice(0, 20).map((p) => ({ title: p.title, city: p.city, price: p.price, status: p.status, type: p.type, bedrooms: p.bedrooms, bathrooms: p.bathrooms, area: p.area })),
    deals: deals.slice(0, 20).map((d) => ({ title: d.title, stage: d.stage, value: d.value, leadName: d.leadName, propertyName: d.propertyName, ownerName: d.ownerName })),
  });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'I\'m your MEHANS AI assistant. I can help you qualify leads, generate emails and WhatsApp messages, analyze your pipeline, and suggest next best actions. How can I help you today?' },
  ]);
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'generate'>('chat');
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('Select a generation action to create content with your CRM data.');
  const [insights, setInsights] = useState<{ id: string; type: string; title: string; description: string; action: string }[]>([]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || generating) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setGenerating(true);
    try {
      const response = await askAI([{ role: 'user', content: text }], `You are the MEHANS CRM assistant. Here is current CRM data (leads, properties, deals): ${crmContext}`);
      setMessages((prev) => [...prev, { role: 'ai', content: response }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reach the AI service');
    } finally { setGenerating(false); }
  };

  const loadInsights = async () => {
    setGenerating(true);
    try {
      const nextInsights = await getAIInsights(crmContext);
      setInsights(nextInsights.map((insight, i) => ({ ...insight, id: `ai-${i}` })));
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load AI insights'); }
    finally { setGenerating(false); }
  };

  const generateContent = async (instruction: string) => {
    setGenerating(true);
    try {
      const content = await askAI([{ role: 'user', content: instruction }], `Generate useful CRM content using this CRM data (leads, properties, deals): ${crmContext}`);
      setGeneratedText(content);
      toast.success('AI content generated');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to generate content'); }
    finally { setGenerating(false); }
  };

  const insightIcons: Record<string, ElementType> = {
    opportunity: TrendingUp,
    trend: ArrowUpRight,
    alert: AlertTriangle,
  };

  return (
    <AppShell>
      <PageHeader title={t('page.aiAssistant')} description={t('page.aiAssistantDescription')}>
        <Badge variant="gold"><Sparkles className="h-3 w-3" strokeWidth={1.5} /> MEHANS AI</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex h-[calc(100vh-240px)] flex-col lg:col-span-2" padding={false} delay={0.1}>
          <div className="flex items-center gap-1 border-b border-border p-2">
            {(['chat', 'insights', 'generate'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab === 'insights') void loadInsights(); }}
                className={cn('rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors', activeTab === tab ? 'bg-gold-bg text-gold' : 'text-text-secondary hover:text-text-primary')}
              >
                {tab === 'chat' ? 'Chat' : tab === 'insights' ? 'Insights' : 'Generate'}
              </button>
            ))}
          </div>

          {activeTab === 'chat' && (
            <>
              <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
                  >
                    {msg.role === 'ai' ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-bg text-gold">
                        <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                    ) : (
                      <Avatar name="You" size="sm" color="#D4AF37" />
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        msg.role === 'user' ? 'rounded-tr-sm bg-gold-bg text-text-primary' : 'rounded-tl-sm bg-bg-elevated text-text-primary'
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {generating && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-bg text-gold">
                      <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={1.5} />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-bg-elevated px-4 py-3">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gold" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gold" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gold" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-border p-4">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-gold-border hover:text-gold"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                    placeholder="Ask AI anything..."
                    className="flex-1 rounded-xl border border-border bg-bg-elevated px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-gold-border focus:outline-none"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-[#0D0D0F] transition-all duration-200 hover:bg-gold-soft hover:shadow-gold"
                  >
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'insights' && (
            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {insights.length === 0 && !generating ? <p className="py-8 text-center text-sm text-text-muted">Select Insights to analyze your current CRM data.</p> : insights.map((insight) => {
                  const Icon = insightIcons[insight.type] || Lightbulb;
                  return (
                    <div key={insight.id} className="rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:border-border-strong">
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', insight.type === 'alert' ? 'bg-warning-bg text-warning' : insight.type === 'opportunity' ? 'bg-success-bg text-success' : 'bg-gold-bg text-gold')}>
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">{insight.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{insight.description}</p>
                          <button onClick={() => toast.success(`Action: ${insight.action}`)} className="mt-2.5 text-xs font-medium text-gold transition-colors hover:text-gold-soft">
                            {insight.action} →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => generateContent('Write a concise personalized follow-up email for a high-value real estate lead. Include a subject line and clear next step.')} className="rounded-xl border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-gold-border">
                  <Mail className="h-6 w-6 text-gold" strokeWidth={1.5} />
                  <p className="mt-2 text-sm font-medium text-text-primary">Follow-up Email</p>
                  <p className="text-xs text-text-secondary">Generate a personalized follow-up email for your top lead</p>
                </button>
                <button onClick={() => generateContent('Write a concise, warm WhatsApp follow-up message for a real estate lead. Keep it under 80 words.')} className="rounded-xl border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-gold-border">
                  <MessageCircle className="h-6 w-6 text-gold" strokeWidth={1.5} />
                  <p className="mt-2 text-sm font-medium text-text-primary">WhatsApp Message</p>
                  <p className="text-xs text-text-secondary">Generate a WhatsApp message for your most active lead</p>
                </button>
                <button onClick={() => generateContent('Create a lead qualification summary with score rationale, risks, and recommended next action.')} className="rounded-xl border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-gold-border">
                  <Target className="h-6 w-6 text-gold" strokeWidth={1.5} />
                  <p className="mt-2 text-sm font-medium text-text-primary">Lead Summary</p>
                  <p className="text-xs text-text-secondary">AI-powered lead qualification summary</p>
                </button>
                <button onClick={() => generateContent('Analyze the current CRM leads and provide three actionable sales insights.')} className="rounded-xl border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-gold-border">
                  <TrendingUp className="h-6 w-6 text-gold" strokeWidth={1.5} />
                  <p className="mt-2 text-sm font-medium text-text-primary">Sales Insights</p>
                  <p className="text-xs text-text-secondary">Get actionable sales performance insights</p>
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">Preview: Follow-up Email</span>
                  <div className="flex gap-1">
                    <button onClick={() => { navigator.clipboard?.writeText(generatedText); toast.success('Copied to clipboard'); }} className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary"><Copy className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                    <button onClick={() => generateContent('Regenerate the previous follow-up content with a more polished and confident tone.')} className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary"><RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{generatedText}</pre>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="border-gold-border bg-gradient-to-b from-gold-bg to-transparent" delay={0.15}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-bg text-gold">
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-medium text-text-primary">AI Lead Scoring</h3>
            </div>
            <div className="space-y-2">
              {leadsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  Loading scores…
                </div>
              ) : leadsError ? (
                <div className="rounded-xl border border-border bg-bg-elevated p-3 text-xs text-text-muted">
                  Unable to load lead scores.
                </div>
              ) : leads.length === 0 ? (
                <div className="rounded-xl border border-border bg-bg-elevated p-3 text-xs text-text-muted">
                  No leads scored yet.
                </div>
              ) : (
                leads.slice(0, 5).sort((a, b) => b.score - a.score).map((lead) => (
                  <div key={lead.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-2.5">
                    <Avatar name={lead.name} color={lead.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{lead.name}</p>
                      <p className="text-xs text-text-muted">{lead.tags[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-bold', lead.score >= 80 ? 'text-success' : lead.score >= 50 ? 'text-gold' : 'text-error')}>{lead.score}</p>
                      <p className="text-[10px] text-text-muted">AI Score</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card delay={0.2}>
            <div className="mb-4 flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-text-primary">Suggested Actions</h3>
            </div>
            <div className="space-y-2">
              {leadsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> Loading...
                </div>
              ) : leadsError ? (
                <p className="py-4 text-center text-xs text-text-muted">Unable to load actions.</p>
              ) : leads.length === 0 ? (
                <p className="py-4 text-center text-xs text-text-muted">Add leads to get suggested actions.</p>
              ) : (() => {
                const hotLeads = leads.filter((l) => l.score >= 50).sort((a, b) => b.score - a.score).slice(0, 4);
                if (hotLeads.length === 0) {
                  return <p className="py-4 text-center text-xs text-text-muted">No high-priority leads yet.</p>;
                }
                const priorityMap: Record<string, 'urgent' | 'high' | 'medium'> = { negotiation: 'urgent', new: 'medium', qualified: 'high', visit_scheduled: 'high', won: 'medium', lost: 'medium' };
                return hotLeads.map((lead, i) => {
                  const priority = priorityMap[lead.status] ?? 'medium';
                  const action = lead.status === 'negotiation' ? `Call ${lead.name} (negotiation)`
                    : lead.status === 'new' ? `Email ${lead.name} (new lead)`
                    : lead.status === 'visit_scheduled' ? `WhatsApp ${lead.name}`
                    : `Follow up with ${lead.name}`;
                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        if (lead.phone) router.push(`/whatsapp?phone=${encodeURIComponent(lead.phone)}`);
                        else router.push('/leads');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-bg-elevated p-2.5 text-left transition-colors hover:border-gold-border"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', priority === 'urgent' ? 'bg-error' : priority === 'high' ? 'bg-gold' : 'bg-info')} />
                      <span className="flex-1 text-xs text-text-primary">{action}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
                    </button>
                  );
                });
              })()}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
