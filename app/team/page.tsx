'use client';


import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, Award, MoreHorizontal, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar, StatCard } from '@/components/shared';
import { fetchTeamMembers } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { TeamMember } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: 'text-success', dot: 'bg-success' },
  away: { label: 'Away', color: 'text-warning', dot: 'bg-warning' },
  offline: { label: 'Offline', color: 'text-text-muted', dot: 'bg-text-muted' },
};

export default function TeamPage() {
  const [search, setSearch] = useState('');
  const { data, loading, error } = useSupabaseQuery<TeamMember[]>(fetchTeamMembers, []);

  const teamMembers = data ?? [];
  const filtered = teamMembers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const totalRevenue = teamMembers.reduce((sum, m) => sum + m.revenue, 0);
  const totalDeals = teamMembers.reduce((sum, m) => sum + m.deals, 0);
  const maxRev = teamMembers.length > 0 ? teamMembers.reduce((max, m) => Math.max(max, m.revenue), 0) : 0;

  return (
    <AppShell>
      <PageHeader title="Team" description={`${teamMembers.length} members on your team`}>
        <button onClick={() => toast.success('Invite member form opened')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Invite Member
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Team Members" value={String(teamMembers.length)} icon={Award} delay={0} />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} change="+35%" icon={TrendingUp} delay={0.05} />
        <StatCard label="Total Deals" value={String(totalDeals)} change="+22%" icon={Award} delay={0.1} />
        <StatCard
          label="Avg Revenue"
          value={teamMembers.length > 0 ? formatCurrency(totalRevenue / teamMembers.length) : '$0'}
          change="+12%"
          icon={TrendingUp}
          delay={0.15}
        />
      </div>

      <div className="mb-6 mt-8 flex items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3.5 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team members..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {loading ? (
        <Card padding={false} className="overflow-hidden" delay={0.2}>
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 px-5 py-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-bg-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-bg-elevated" />
                  <div className="h-2 w-48 animate-pulse rounded bg-bg-elevated" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-bg-elevated" />
              </div>
            ))}
          </div>
        </Card>
      ) : error ? (
        <Card delay={0.2}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card delay={0.2}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">
              {teamMembers.length === 0 ? 'No team members found.' : 'No members match your search.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding={false} className="overflow-hidden" delay={0.2}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-5 py-3.5 font-medium">Member</th>
                  <th className="px-5 py-3.5 font-medium">Role</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="hidden px-5 py-3.5 font-medium sm:table-cell">Deals</th>
                  <th className="hidden px-5 py-3.5 font-medium sm:table-cell">Revenue</th>
                  <th className="hidden px-5 py-3.5 font-medium lg:table-cell">Performance</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member, i) => {
                  const status = safeConfig(statusConfig, member.status, { label: 'Offline', color: 'text-text-muted', dot: 'bg-text-muted' });
                  return (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 transition-colors hover:bg-bg-elevated"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={member.name} color={member.avatarColor} size="md" />
                            <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary', status.dot)} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{member.name}</p>
                            <p className="text-xs text-text-muted">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-text-secondary">{member.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium', status.color)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                          {status.label}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        <span className="text-sm font-medium text-text-primary">{member.deals}</span>
                      </td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        <span className="text-sm font-semibold text-gold">{formatCurrency(member.revenue)}</span>
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-elevated">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${maxRev > 0 ? (member.revenue / maxRev) * 100 : 0}%` }}
                              transition={{ duration: 0.6, delay: i * 0.05 }}
                              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                            />
                          </div>
                          <span className="text-xs text-text-muted">{maxRev > 0 ? Math.round((member.revenue / maxRev) * 100) : 0}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
