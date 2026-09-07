'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Target, Calendar, CheckSquare, Home,
  Sparkles, Clock, ArrowUpRight, Phone, Mail, MessageCircle, FileText,
  Building, Users, ChevronDown, CalendarDays,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from '@/components/charts';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, Badge, Avatar, SkeletonCard } from '@/components/shared';
import {
  fetchActivities, fetchMeetings, fetchTeamMembers, fetchDeals, fetchLeads,
  fetchRevenueData, fetchPipelineData, fetchLeadSourceData, fetchFunnelData,
  fetchDashboardStats, type DateRange,
} from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { getAIInsights } from '@/lib/ai';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useRefresh } from '@/components/refresh-provider';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const activityIcons: Record<string, React.ElementType> = {
  deal_won: DollarSign, lead_created: Users, property_listed: Building,
  meeting_scheduled: Calendar, task_completed: CheckSquare,
  whatsapp_sent: MessageCircle, email_sent: Mail,
};

const meetingTypeIcons: Record<string, React.ElementType> = {
  call: Phone, visit: Building, video: MessageCircle, 'in-person': Users,
  google_meet: MessageCircle, zoom: MessageCircle,
};

const insightIcons: Record<string, React.ElementType> = {
  opportunity: TrendingUp, trend: ArrowUpRight, alert: Clock,
};

const tooltipStyle = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
  borderRadius: '12px', fontSize: '12px', color: 'var(--text-primary)',
};

const dateRangeLabels: Record<DateRange, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  all: 'All Time',
};

export default function DashboardPage() {
  const { refreshKey } = useRefresh();
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [aiInsightsVisible, setAiInsightsVisible] = useState(true);
  const [aiInsights, setAiInsights] = useState<{ id: string; type: string; title: string; description: string; action: string }[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const aiInsightsRef = useRef<HTMLDivElement>(null);

  const statsQuery = useSupabaseQuery(() => fetchDashboardStats(dateRange), [dateRange], refreshKey);
  const activitiesQuery = useSupabaseQuery(fetchActivities, [], refreshKey);
  const meetingsQuery = useSupabaseQuery(fetchMeetings, [], refreshKey);
  const teamMembersQuery = useSupabaseQuery(fetchTeamMembers, [], refreshKey);
  const dealsQuery = useSupabaseQuery(fetchDeals, [], refreshKey);
  const leadsQuery = useSupabaseQuery(fetchLeads, [], refreshKey);
  const revenueQuery = useSupabaseQuery(fetchRevenueData, [], refreshKey);
  const pipelineQuery = useSupabaseQuery(fetchPipelineData, [], refreshKey);
  const leadSourceQuery = useSupabaseQuery(fetchLeadSourceData, [], refreshKey);
  const funnelQuery = useSupabaseQuery(fetchFunnelData, [], refreshKey);

  const loading =
    statsQuery.loading || activitiesQuery.loading || meetingsQuery.loading || teamMembersQuery.loading ||
    dealsQuery.loading || leadsQuery.loading || revenueQuery.loading ||
    pipelineQuery.loading || leadSourceQuery.loading || funnelQuery.loading;

  const stats = statsQuery.data;
  const activities = activitiesQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];
  const teamMembers = teamMembersQuery.data ?? [];
  const deals = dealsQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const revenueData = revenueQuery.data ?? [];
  const pipelineData = pipelineQuery.data ?? [];
  const leadSourceData = leadSourceQuery.data ?? [];
  const funnelData = funnelQuery.data ?? [];

  // Use stats from the date-range-aware query when available, fall back to local calc
  const wonDeals = deals.filter((d) => d.stage === 'won');
  const revenue = stats?.revenue ?? wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const openDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const pipelineValue = stats?.pipelineValue ?? openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const conversionRate = stats?.conversionRate ?? (leads.length > 0 ? (wonDeals.length / leads.length) * 100 : 0);
  const appointmentsCount = stats?.appointmentsCount ?? meetings.filter((m) => m.status === 'upcoming').length;
  const tasksCount = stats?.tasksCount ?? activities.filter((a) => a.type === 'task_completed').length;
  const propertiesCount = stats?.propertiesCount ?? new Set(deals.map((d) => d.property_id).filter(Boolean)).size;
  const leadsCount = stats?.leadsCount ?? leads.length;

  // Close date filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setDateFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInsightAction = (action: string) => {
    if (action.toLowerCase().includes('contact') || action.toLowerCase().includes('lead')) {
      const lead = leads.find((l) => l.phone || l.whatsapp);
      if (lead?.phone) {
        router.push(`/whatsapp?phone=${encodeURIComponent(lead.phone)}`);
      } else {
        router.push('/leads');
      }
    } else if (action.toLowerCase().includes('analytic') || action.toLowerCase().includes('pipeline')) {
      router.push('/pipeline');
    } else if (action.toLowerCase().includes('schedule') || action.toLowerCase().includes('calendar') || action.toLowerCase().includes('task')) {
      router.push('/calendar');
    } else {
      router.push('/leads');
    }
  };

  useEffect(() => {
    if (!loading && leads.length > 0 && aiInsights.length === 0 && !insightsLoading) {
      setInsightsLoading(true);
      const crmContext = JSON.stringify({
        leads: leads.slice(0, 20).map((l) => ({ name: l.name, status: l.status, score: l.score, budget: l.budget, lastActivity: l.updatedAt })),
        deals: deals.slice(0, 20).map((d) => ({ title: d.title, stage: d.stage, value: d.value })),
        tasks: activities.filter((a) => a.type === 'task_completed').length,
      });
      getAIInsights(crmContext)
        .then((result) => setInsights(result.map((insight, i) => ({ ...insight, id: `ai-${i}` }))))
        .catch(() => {})
        .finally(() => setInsightsLoading(false));
    }
  }, [loading, leads, deals, activities, aiInsights.length, insightsLoading]);

  const scrollToAIInsights = () => {
    aiInsightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const toggleAIInsights = () => {
    if (aiInsightsVisible) {
      setAiInsightsVisible(false);
    } else {
      setAiInsightsVisible(true);
      setTimeout(scrollToAIInsights, 100);
    }
  };

  const dateRangeOptions: DateRange[] = ['today', 'week', 'month', 'quarter', 'all'];

  return (
    <AppShell>
      <PageHeader title="Overview" description="Here's what's happening in your agency today.">
        {/* Date range dropdown */}
        <div ref={dateFilterRef} className="relative">
          <button
            onClick={() => setDateFilterOpen(!dateFilterOpen)}
            className={cn('btn btn-outline btn-md', dateFilterOpen && 'border-gold-border')}
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
            {dateRangeLabels[dateRange]}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', dateFilterOpen && 'rotate-180')} />
          </button>
          {dateFilterOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-modal">
              {dateRangeOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => { setDateRange(option); setDateFilterOpen(false); }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    dateRange === option ? 'bg-gold-bg text-gold' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  )}
                >
                  {dateRangeLabels[option]}
                  {dateRange === option && <span className="h-2 w-2 rounded-full bg-gold" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* AI Insights toggle */}
        <button
          onClick={toggleAIInsights}
          className={cn('btn btn-md transition-all', aiInsightsVisible ? 'btn-gold' : 'btn-outline')}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          AI Insights
        </button>
      </PageHeader>

      {loading && !stats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Revenue" value={formatCurrency(revenue)} icon={DollarSign} delay={0} />
          <StatCard label="Pipeline" value={formatCurrency(pipelineValue)} icon={TrendingUp} delay={0.04} />
          <StatCard label="Conversion" value={`${conversionRate.toFixed(1)}%`} icon={Target} delay={0.08} />
          <StatCard label="Appointments" value={String(appointmentsCount)} icon={Calendar} delay={0.12} />
          <StatCard label="Tasks" value={String(tasksCount)} icon={CheckSquare} delay={0.16} />
          <StatCard label="Properties" value={String(propertiesCount)} icon={Home} delay={0.2} />
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" delay={0.1}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-text-primary">Revenue Overview</h3>
              <p className="mt-1 text-[12px] text-text-muted">Monthly revenue vs target</p>
            </div>
            <div className="flex items-center gap-4 text-[12px]">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-gold" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-info" /> Target
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tgtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4080B8" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#4080B8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v / 1000000}M`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-primary)' }} formatter={(v: number) => [`$${(v / 1000000).toFixed(1)}M`, '']} />
              <Area type="monotone" dataKey="target" stroke="var(--info)" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#tgtGrad)" />
              <Area type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay={0.15}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Lead Sources</h3>
            <p className="mt-1 text-[12px] text-text-muted">Where leads come from</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {leadSourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {leadSourceData.slice(0, 4).map((source) => (
              <div key={source.name} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ background: source.color }} /> {source.name}
                </span>
                <span className="font-medium text-text-primary">{source.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" delay={0.2}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Pipeline Value</h3>
            <p className="mt-1 text-[12px] text-text-muted">Total pipeline value over time ($M)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={pipelineData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v}M`, '']} />
              <Area type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} fill="url(#pipeGrad)" />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-8">
            <h4 className="mb-4 text-[13px] font-medium text-text-primary">Sales Funnel</h4>
            <div className="space-y-3">
              {funnelData.length > 0 && funnelData.map((stage, i) => {
                const maxCount = funnelData[0].count || 1;
                const width = (stage.count / maxCount) * 100;
                const conversion = i > 0 && funnelData[i - 1].count > 0
                  ? ((stage.count / funnelData[i - 1].count) * 100).toFixed(0)
                  : '100';
                return (
                  <div key={stage.stage}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-text-primary">{stage.stage}</span>
                      <span className="text-text-muted">{stage.count} · {formatCurrency(stage.value)} · {conversion}%</span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-lg bg-bg-elevated">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${Math.max(width, stage.count > 0 ? 8 : 0)}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          'flex h-full items-center justify-end rounded-lg px-3 text-[11px] font-medium text-[#0D0D0F]',
                          i === 0 && 'bg-gold', i === 1 && 'bg-gold-soft',
                          i === 2 && 'bg-info', i === 3 && 'bg-[#9B6FBF]', i === 4 && 'bg-success'
                        )}
                      >
                        {stage.count}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* AI Insights card - toggleable */}
        {aiInsightsVisible && (
          <Card className="card-gold" delay={0.25} >
            <div ref={aiInsightsRef}>
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-bg text-gold">
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-text-primary">AI Insights</h3>
                  <p className="text-[12px] text-text-muted">Powered by MEHANS AI</p>
                </div>
              </div>
              <div className="space-y-3">
                {insightsLoading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
                    <Sparkles className="h-4 w-4 animate-pulse" /> Analyzing your CRM data...
                  </div>
                )}
                {!insightsLoading && aiInsights.length === 0 && (
                  <p className="py-6 text-center text-xs text-text-muted">Add leads and deals to get AI insights.</p>
                )}
                {aiInsights.slice(0, 3).map((insight) => {
                  const Icon = insightIcons[insight.type] || Sparkles;
                  return (
                    <div key={insight.id} className="rounded-xl border border-border bg-bg-secondary p-4 transition-colors hover:border-border-strong">
                      <div className="flex items-start gap-2.5">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', insight.type === 'alert' ? 'text-warning' : 'text-gold')} strokeWidth={1.5} />
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-text-primary">{insight.title}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{insight.description}</p>
                          <button
                            onClick={() => handleInsightAction(insight.action)}
                            className="mt-2.5 text-[12px] font-medium text-gold transition-colors hover:text-gold-soft"
                          >
                            {insight.action} →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card delay={0.3}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-serif text-lg font-medium text-text-primary">Recent Activity</h3>
            <button className="text-[12px] font-medium text-gold transition-colors hover:text-gold-soft">View all</button>
          </div>
          <div className="space-y-1">
            {activities.slice(0, 6).map((activity, i) => {
              const Icon = activityIcons[activity.type] || FileText;
              return (
                <motion.div
                  key={activity.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg-elevated"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated text-gold">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-text-primary">{activity.title}</p>
                    <p className="text-[12px] text-text-secondary">{activity.description}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">{activity.user} · {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card delay={0.35}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-serif text-lg font-medium text-text-primary">Upcoming Meetings</h3>
            <button onClick={() => router.push('/calendar')} className="text-[12px] font-medium text-gold transition-colors hover:text-gold-soft">View calendar</button>
          </div>
          <div className="space-y-2">
            {meetings.filter((m) => m.status === 'upcoming').slice(0, 5).map((meeting, i) => {
              const Icon = meetingTypeIcons[meeting.type] || Calendar;
              return (
                <motion.div
                  key={meeting.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-border-strong"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg-elevated">
                    <span className="text-[9px] font-medium text-text-muted">{new Date(meeting.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                    <span className="text-sm font-bold text-text-primary">{new Date(meeting.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium text-text-primary">{meeting.title}</p>
                    <p className="text-[12px] text-text-muted">{meeting.time} · {meeting.duration}min · {meeting.location}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-bg text-gold">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4" delay={0.4}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-lg font-medium text-text-primary">Team Performance</h3>
          <Badge variant="gold">This Quarter</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {teamMembers.map((member, i) => (
            <motion.div
              key={member.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
              className="rounded-xl border border-border p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-3">
                <Avatar name={member.name} color={member.avatarColor} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-text-primary">{member.name}</p>
                  <p className="truncate text-[11px] text-text-muted">{member.role}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div>
                  <p className="text-[11px] text-text-muted">Deals</p>
                  <p className="text-[13px] font-semibold text-text-primary">{member.deals}</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">Revenue</p>
                  <p className="text-[13px] font-semibold text-gold">{formatCurrency(member.revenue)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
