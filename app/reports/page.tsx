'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from '@/components/charts';
import { FileText, Download, TrendingUp, DollarSign, Target, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, Badge } from '@/components/shared';
import { fetchDeals, fetchLeads, fetchProperties, fetchRevenueData, fetchFunnelData } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useRefresh } from '@/components/refresh-provider';
import type { Deal, Lead, Property } from '@/lib/types';
import { toast } from 'sonner';
import { getAIReport } from '@/lib/ai';
import { downloadCSV } from '@/lib/csv';
import { useLanguage } from '@/components/language-provider';

const tooltipStyle = {
  background: '#0E0E10',
  border: '1px solid #1A1A1E',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#F5F5F0',
};

const reports = [
  { id: 'r1', name: 'Q3 Revenue Report', type: 'Revenue', date: 'Aug 2026', status: 'Ready' },
  { id: 'r2', name: 'Lead Performance Analysis', type: 'Leads', date: 'Aug 2026', status: 'Ready' },
  { id: 'r3', name: 'Property Portfolio Summary', type: 'Properties', date: 'Aug 2026', status: 'Ready' },
  { id: 'r4', name: 'Team Performance Report', type: 'Team', date: 'Aug 2026', status: 'Generating' },
  { id: 'r5', name: 'Pipeline Health Check', type: 'Pipeline', date: 'Jul 2026', status: 'Ready' },
  { id: 'r6', name: 'Customer Acquisition Cost', type: 'Analytics', date: 'Jul 2026', status: 'Ready' },
];

export default function ReportsPage() {
  const { t } = useLanguage();
  const { refreshKey } = useRefresh();
  const { data: dealsData, loading: dealsLoading, error: dealsError } = useSupabaseQuery<Deal[]>(fetchDeals, [], refreshKey);
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useSupabaseQuery<Lead[]>(fetchLeads, [], refreshKey);
  const { data: revData } = useSupabaseQuery(fetchRevenueData, [], refreshKey);
  const { data: funData } = useSupabaseQuery(fetchFunnelData, [], refreshKey);
  const { data: propertiesData, loading: propertiesLoading } = useSupabaseQuery<Property[]>(fetchProperties, [], refreshKey);

  const deals = dealsData ?? [];
  const leads = leadsData ?? [];
  const properties = propertiesData ?? [];
  const revenueData = revData ?? [];
  const funnelData = funData ?? [];

  const loading = dealsLoading || leadsLoading || propertiesLoading;
  const error = dealsError ?? leadsError;

  const wonDeals = deals.filter((d) => d.stage === 'won');
  const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const avgDealSize = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;
  const conversionRate = leads.length > 0 ? (wonDeals.length / leads.length) * 100 : 0;

  const [reportLoading, setReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState('');

  const downloadLeadsCSV = () => {
    downloadCSV('leads-report.csv',
      ['Name', 'Email', 'Phone', 'Source', 'Status', 'Budget', 'Score', 'Owner', 'Tags', 'Created'],
      leads.map((l) => [l.name, l.email ?? '', l.phone ?? '', l.source, l.status, l.budget, l.score, l.owner, l.tags.join('; '), l.createdAt ?? ''])
    );
    toast.success('Leads report downloaded');
  };

  const downloadDealsCSV = () => {
    downloadCSV('deals-report.csv',
      ['Title', 'Stage', 'Value', 'Lead Name', 'Property Name', 'Owner', 'Expected Close', 'Created'],
      deals.map((d) => [d.title, d.stage, d.value, d.leadName, d.propertyName, d.ownerName, d.closeDate ?? '', d.createdAt ?? ''])
    );
    toast.success('Deals report downloaded');
  };

  const downloadPropertiesCSV = () => {
    downloadCSV('properties-report.csv',
      ['Title', 'Type', 'Price', 'Status', 'Bedrooms', 'Bathrooms', 'Area', 'City', 'Country'],
      properties.map((p) => [p.title, p.type, p.price, p.status, p.bedrooms, p.bathrooms, p.area, p.city, p.country ?? ''])
    );
    toast.success('Properties report downloaded');
  };

  const downloadRevenueCSV = () => {
    downloadCSV('revenue-report.csv',
      ['Month', 'Revenue', 'Target'],
      revenueData.map((r) => [r.month, r.revenue, r.target])
    );
    toast.success('Revenue report downloaded');
  };

  const downloadFunnelCSV = () => {
    downloadCSV('pipeline-funnel-report.csv',
      ['Stage', 'Count', 'Value'],
      funnelData.map((f) => [f.stage, f.count, f.value])
    );
    toast.success('Pipeline report downloaded');
  };

  const reportActions: Record<string, () => void> = {
    r1: downloadRevenueCSV,
    r2: downloadLeadsCSV,
    r3: downloadPropertiesCSV,
    r5: downloadFunnelCSV,
    r6: downloadDealsCSV,
  };

  const generateAIReport = async () => {
    if (loading) return;
    setReportLoading(true);
    try {
      const context = JSON.stringify({
        totalRevenue,
        leadsCount: leads.length,
        dealsCount: deals.length,
        wonDeals: wonDeals.length,
        conversionRate: conversionRate.toFixed(1),
        avgDealSize,
        pipeline: deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length,
      });
      const report = await getAIReport(context, 'Business Performance');
      setAiReport(report);
      toast.success('AI report generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate AI report');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('page.reports')} description={t('page.reportsDescription')}>
        <button onClick={generateAIReport} disabled={reportLoading || loading} className="btn btn-gold btn-md disabled:opacity-60">
          <FileText className="h-4 w-4" strokeWidth={1.5} /> {reportLoading ? 'Generating…' : 'Generate Report'}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={loading ? '—' : formatCurrency(totalRevenue)}
          change="+42%"
          icon={DollarSign}
          delay={0}
        />
        <StatCard
          label="Leads Generated"
          value={loading ? '—' : String(leads.length)}
          change="+28%"
          icon={Users}
          delay={0.05}
        />
        <StatCard
          label="Conversion Rate"
          value={loading ? '—' : `${conversionRate.toFixed(1)}%`}
          change="+1.2%"
          icon={Target}
          delay={0.1}
        />
        <StatCard
          label="Avg Deal Size"
          value={loading ? '—' : formatCurrency(avgDealSize)}
          change="+12%"
          icon={TrendingUp}
          delay={0.15}
        />
      </div>

      {error ? (
        <Card className="mt-8" delay={0.2}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card delay={0.2}>
              <div className="mb-6">
                <h3 className="font-serif text-lg font-medium text-text-primary">Revenue vs Target</h3>
                <p className="mt-1 text-xs text-text-muted">Monthly comparison</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1E" vertical={false} />
                  <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6B6B66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v / 1000000}M`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${(v / 1000000).toFixed(1)}M`, '']} />
                  <Bar dataKey="revenue" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="target" fill="#4A90D9" radius={[6, 6, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card delay={0.25}>
              <div className="mb-6">
                <h3 className="font-serif text-lg font-medium text-text-primary">Funnel Performance</h3>
                <p className="mt-1 text-xs text-text-muted">Stage-by-stage conversion</p>
              </div>
              <div className="space-y-3">
                {funnelData.length > 0 && funnelData.map((stage, i) => {
                  const maxCount = funnelData[0].count || 1;
                  const width = (stage.count / maxCount) * 100;
                  const conversion = i > 0 && funnelData[i - 1].count > 0 ? ((stage.count / funnelData[i - 1].count) * 100).toFixed(0) : '100';
                  return (
                    <div key={stage.stage}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-text-primary">{stage.stage}</span>
                        <span className="text-text-muted">{stage.count} · {formatCurrency(stage.value)} · {conversion}%</span>
                      </div>
                      <div className="h-7 overflow-hidden rounded-lg bg-bg-elevated">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="flex h-full items-center justify-end rounded-lg bg-gold px-3 text-xs font-medium text-[#0D0D0F]"
                        >
                          {stage.count}
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {aiReport && <Card className="mt-4" delay={0.25}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-serif text-lg font-medium text-text-primary">Latest AI Report</h3><Badge variant="gold">OpenRouter AI</Badge></div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">{aiReport}</div>
          </Card>}

          <Card className="mt-4" delay={0.3}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-text-primary">Generated Reports</h3>
              <Badge variant="gold">{reports.length} reports</Badge>
            </div>
            <div className="space-y-2">
              {reports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-bg text-gold">
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{report.name}</p>
                    <p className="text-xs text-text-muted">{report.type} · {report.date}</p>
                  </div>
                  <Badge variant={report.status === 'Ready' ? 'success' : 'warning'}>{report.status}</Badge>
                  {report.status === 'Ready' && (
                    <button
                      onClick={() => { const fn = reportActions[report.id]; if (fn) fn(); else toast.error('Report data not available'); }}
                      className="rounded-lg border border-border bg-bg-secondary p-2 text-text-secondary transition-colors hover:border-gold-border hover:text-gold"
                    >
                      <Download className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
