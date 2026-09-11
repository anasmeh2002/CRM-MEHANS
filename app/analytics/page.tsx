'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from '@/components/charts';
import { TrendingUp, DollarSign, Target, Award } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, Badge } from '@/components/shared';
import { fetchTeamMembers, fetchDeals, fetchLeads, fetchProperties } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useRefresh } from '@/components/refresh-provider';
import type { TeamMember, Deal, Lead, Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/language-provider';
import { useAgency } from '@/components/agency-provider';

const chartColors = ['#4A90D9', '#D4AF37', '#5BAA6F', '#D4823A', '#9B6FBF', '#8B8B85'];

const tooltipStyle = {
  background: '#0E0E10',
  border: '1px solid #1A1A1E',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#F5F5F0',
};

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const { currency } = useAgency();
  const localizeMonth = (value: string) => value.startsWith('month.') ? t(value) : t(`month.${value.toLowerCase().slice(0, 3)}`);
  const { refreshKey } = useRefresh();
  const { data: teamData, loading: teamLoading, error: teamError } = useSupabaseQuery<TeamMember[]>(fetchTeamMembers, [], refreshKey);
  const { data: dealsData, loading: dealsLoading, error: dealsError } = useSupabaseQuery<Deal[]>(fetchDeals, [], refreshKey);
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useSupabaseQuery<Lead[]>(fetchLeads, [], refreshKey);
  const { data: propertiesData, loading: propertiesLoading, error: propertiesError } = useSupabaseQuery<Property[]>(fetchProperties, [], refreshKey);

  const teamMembers = teamData ?? [];
  const deals = dealsData ?? [];
  const leads = leadsData ?? [];
  const properties = propertiesData ?? [];
  const wonDeals = deals.filter((deal) => ['won', 'closed_won'].includes(String(deal.stage)));
  const lostDeals = deals.filter((deal) => ['lost', 'closed_lost'].includes(String(deal.stage)));
  const closedDeals = wonDeals.length + lostDeals.length;
  const totalRevenue = wonDeals.reduce((sum, deal) => sum + deal.value, 0);
  const averageDeal = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;
  const winRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : 0;
  const monthKeys = Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (7 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const monthlyDealData = monthKeys.map((month) => {
    const monthDeals = deals.filter((deal) => String(deal.created_at ?? '').startsWith(month));
    return { month: `month.${month.slice(5)}`, deals: monthDeals.length, won: monthDeals.filter((deal) => ['won', 'closed_won'].includes(String(deal.stage))).length };
  });
  const revenueData = monthKeys.map((month) => ({
    month: `month.${month.slice(5)}`,
    revenue: wonDeals.filter((deal) => String(deal.created_at ?? '').startsWith(month)).reduce((sum, deal) => sum + deal.value, 0),
  }));
  const leadSourceData = Object.entries(leads.reduce<Record<string, number>>((counts, lead) => {
    const source = lead.source || 'manual';
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {})).map(([name, value], index) => ({ name, value, color: chartColors[index % chartColors.length] }));
  const propertyTypeData = Object.entries(properties.reduce<Record<string, number>>((counts, property) => {
    const type = property.type || 'commercial';
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {})).map(([name, value], index) => ({ name: `property.${name === 'apartment' ? 'apartments' : `${name}s`}`, value, color: chartColors[index % chartColors.length] }));
  const conversionData = [{ name: 'Conversion', value: winRate, fill: '#D4AF37' }];

  const loading = teamLoading || dealsLoading || leadsLoading || propertiesLoading;
  const error = teamError ?? dealsError ?? leadsError ?? propertiesError;

  const sortedTeam = [...teamMembers].sort((a, b) => b.revenue - a.revenue);
  const maxRev = sortedTeam.length > 0 ? sortedTeam[0].revenue : 0;

  return (
    <AppShell>
      <PageHeader title={t('page.analytics')} description={t('page.analyticsDescription')}>
        <Badge variant="gold">{t('analytics.last8Months')}</Badge>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('analytics.totalRevenue')} value={formatCurrency(totalRevenue, currency)} icon={DollarSign} delay={0} />
        <StatCard label={t('analytics.dealsClosed')} value={String(closedDeals)} icon={Award} delay={0.05} />
        <StatCard label={t('analytics.avgDealSize')} value={formatCurrency(averageDeal, currency)} icon={TrendingUp} delay={0.1} />
        <StatCard label={t('analytics.winRate')} value={`${winRate.toFixed(1)}%`} icon={Target} delay={0.15} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card delay={0.2}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.revenueTrend')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.monthlyRevenue')}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1E" vertical={false} />
              <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={localizeMonth} />
              <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v / 1000000}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v / 1000000, currency) + 'M', t('dashboard.revenueLabel')]} />
              <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#revGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay={0.25}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.dealsCreatedVsWon')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.monthlyDealFlow')}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyDealData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1E" vertical={false} />
              <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={localizeMonth} />
              <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar name={t('analytics.dealsClosed')} dataKey="deals" fill="#4A90D9" radius={[6, 6, 0, 0]} barSize={18} />
              <Bar name={t('analytics.winRate')} dataKey="won" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card delay={0.3}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.leadSources')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.distributionChannel')}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {leadSourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [String(v), t('analytics.records')]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {leadSourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: source.color }} />
                <span className="text-text-secondary">{source.name}</span>
                <span className="ms-auto font-medium text-text-primary">{source.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.35}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.propertyTypes')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.listingsByCategory')}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={propertyTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {propertyTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [String(v), t('analytics.records')]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {propertyTypeData.map((type) => (
              <div key={type.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: type.color }} />
                <span className="text-text-secondary">{t(type.name)}</span>
                <span className="ms-auto font-medium text-text-primary">{type.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.4}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.conversionRate')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.leadToClose')}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={conversionData} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill: '#121215' }} dataKey="value" cornerRadius={10} fill="#D4AF37" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="-mt-32 text-center">
            <p className="font-serif text-3xl font-medium text-gold">{winRate.toFixed(1)}%</p>
            <p className="text-xs text-text-muted">{t('analytics.conversionRate')}</p>
          </div>
          <div className="mt-20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{t('analytics.closedDeals')}</span>
              <span className="font-medium text-text-primary">{closedDeals}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{t('analytics.wonDeals')}</span>
              <span className="font-medium text-success">{wonDeals.length}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-1">
        <Card delay={0.5}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('analytics.teamLeaderboard')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('analytics.revenueByAgent')}</p>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-6 animate-pulse rounded bg-bg-elevated" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-24 animate-pulse rounded bg-bg-elevated" />
                      <div className="h-3 w-12 animate-pulse rounded bg-bg-elevated" />
                    </div>
                    <div className="h-2 w-full animate-pulse rounded-full bg-bg-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-text-muted">{error}</p>
            </div>
          ) : sortedTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-text-muted">{t('analytics.noTeamMembers')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTeam.map((member, i) => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className={cn('text-sm font-bold', i === 0 ? 'text-gold' : 'text-text-muted')}>#{i + 1}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{member.name}</span>
                      <span className="text-xs font-medium text-gold">{formatCurrency(member.revenue, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${maxRev > 0 ? (member.revenue / maxRev) * 100 : 0}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
