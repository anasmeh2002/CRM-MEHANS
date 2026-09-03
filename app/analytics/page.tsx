'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { fetchTeamMembers, fetchDeals, fetchLeads, fetchRevenueData, fetchLeadSourceData } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useRefresh } from '@/components/refresh-provider';
import type { TeamMember, Deal, Lead } from '@/lib/types';
import { cn } from '@/lib/utils';

const monthlyDeals = [
  { month: 'Jan', deals: 8, won: 3 },
  { month: 'Feb', deals: 12, won: 5 },
  { month: 'Mar', deals: 15, won: 7 },
  { month: 'Apr', deals: 10, won: 4 },
  { month: 'May', deals: 18, won: 9 },
  { month: 'Jun', deals: 22, won: 11 },
  { month: 'Jul', deals: 20, won: 10 },
  { month: 'Aug', deals: 26, won: 14 },
];

const responseTime = [
  { day: 'Mon', time: 3.2 },
  { day: 'Tue', time: 4.5 },
  { day: 'Wed', time: 2.8 },
  { day: 'Thu', time: 5.1 },
  { day: 'Fri', time: 4.2 },
  { day: 'Sat', time: 6.8 },
  { day: 'Sun', time: 8.2 },
];

const propertyTypeData = [
  { name: 'Apartments', value: 35, color: '#4A90D9' },
  { name: 'Villas', value: 28, color: '#D4AF37' },
  { name: 'Penthouses', value: 18, color: '#5BAA6F' },
  { name: 'Townhouses', value: 12, color: '#9B6FBF' },
  { name: 'Commercial', value: 7, color: '#D4823A' },
];

const conversionData = [{ name: 'Conversion', value: 7.5, fill: '#D4AF37' }];

const tooltipStyle = {
  background: '#0E0E10',
  border: '1px solid #1A1A1E',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#F5F5F0',
};

export default function AnalyticsPage() {
  const { refreshKey } = useRefresh();
  const { data: teamData, loading: teamLoading, error: teamError } = useSupabaseQuery<TeamMember[]>(fetchTeamMembers, [], refreshKey);
  const { data: dealsData, loading: dealsLoading, error: dealsError } = useSupabaseQuery<Deal[]>(fetchDeals, [], refreshKey);
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useSupabaseQuery<Lead[]>(fetchLeads, [], refreshKey);
  const { data: revData } = useSupabaseQuery(fetchRevenueData, [], refreshKey);
  const { data: srcData } = useSupabaseQuery(fetchLeadSourceData, [], refreshKey);

  const teamMembers = teamData ?? [];
  const deals = dealsData ?? [];
  const leads = leadsData ?? [];
  const revenueData = revData ?? [];
  const leadSourceData = srcData ?? [];

  const loading = teamLoading || dealsLoading || leadsLoading;
  const error = teamError ?? dealsError ?? leadsError;

  const sortedTeam = [...teamMembers].sort((a, b) => b.revenue - a.revenue);
  const maxRev = sortedTeam.length > 0 ? sortedTeam[0].revenue : 0;

  return (
    <AppShell>
      <PageHeader title="Analytics" description="Deep insights into your business performance">
        <Badge variant="gold">Last 8 months</Badge>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value="$18.4M" change="+42%" icon={DollarSign} delay={0} />
        <StatCard label="Deals Closed" value="63" change="+28%" icon={Award} delay={0.05} />
        <StatCard label="Avg Deal Size" value="$2.9M" change="+12%" icon={TrendingUp} delay={0.1} />
        <StatCard label="Win Rate" value="7.5%" change="+1.2%" icon={Target} delay={0.15} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card delay={0.2}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Revenue Trend</h3>
            <p className="mt-1 text-xs text-text-muted">Monthly revenue over time</p>
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
              <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v / 1000000}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${(v / 1000000).toFixed(1)}M`, '']} />
              <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#revGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay={0.25}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Deals: Created vs Won</h3>
            <p className="mt-1 text-xs text-text-muted">Monthly deal flow</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyDeals} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1E" vertical={false} />
              <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="deals" fill="#4A90D9" radius={[6, 6, 0, 0]} barSize={18} />
              <Bar dataKey="won" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card delay={0.3}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Lead Sources</h3>
            <p className="mt-1 text-xs text-text-muted">Distribution by channel</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {leadSourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {leadSourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: source.color }} />
                <span className="text-text-secondary">{source.name}</span>
                <span className="ml-auto font-medium text-text-primary">{source.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.35}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Property Types</h3>
            <p className="mt-1 text-xs text-text-muted">Listings by category</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={propertyTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {propertyTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {propertyTypeData.map((type) => (
              <div key={type.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: type.color }} />
                <span className="text-text-secondary">{type.name}</span>
                <span className="ml-auto font-medium text-text-primary">{type.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.4}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Conversion Rate</h3>
            <p className="mt-1 text-xs text-text-muted">Lead to close</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={conversionData} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill: '#121215' }} dataKey="value" cornerRadius={10} fill="#D4AF37" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="-mt-32 text-center">
            <p className="font-serif text-3xl font-medium text-gold">7.5%</p>
            <p className="text-xs text-text-muted">Conversion Rate</p>
          </div>
          <div className="mt-20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Industry Avg</span>
              <span className="font-medium text-text-primary">5.2%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Your Rate</span>
              <span className="font-medium text-success">7.5% (+2.3%)</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card delay={0.45}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Response Time</h3>
            <p className="mt-1 text-xs text-text-muted">Avg first response (hours) by day</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={responseTime} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1E" vertical={false} />
              <XAxis dataKey="day" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}h`, '']} />
              <Line type="monotone" dataKey="time" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card delay={0.5}>
          <div className="mb-6">
            <h3 className="font-serif text-lg font-medium text-text-primary">Team Leaderboard</h3>
            <p className="mt-1 text-xs text-text-muted">Revenue by agent this quarter</p>
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
              <p className="text-sm text-text-muted">No team members found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTeam.map((member, i) => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className={cn('text-sm font-bold', i === 0 ? 'text-gold' : 'text-text-muted')}>#{i + 1}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{member.name}</span>
                      <span className="text-xs font-medium text-gold">{formatCurrency(member.revenue)}</span>
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
