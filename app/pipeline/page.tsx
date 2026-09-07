'use client';


import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, GripVertical } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Avatar, Badge, Card, Skeleton } from '@/components/shared';
import { fetchDeals, updateDeal } from '@/lib/data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Deal, DealStage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

const columns: { stage: DealStage; label: string; color: string }[] = [
  { stage: 'new_lead', label: 'New Lead', color: '#4A90D9' },
  { stage: 'qualified', label: 'Qualified', color: '#D4AF37' },
  { stage: 'visit_scheduled', label: 'Visit Scheduled', color: '#D4823A' },
  { stage: 'negotiation', label: 'Negotiation', color: '#9B6FBF' },
  { stage: 'won', label: 'Won', color: '#5BAA6F' },
  { stage: 'lost', label: 'Lost', color: '#C75555' },
];

function mapDealForDisplay(deal: Deal): Deal {
  const leadName =
    deal.leadName ||
    deal.lead?.name ||
    `${deal.lead?.first_name ?? ''} ${deal.lead?.last_name ?? ''}`.trim() ||
    'N/A';
  const propertyName = deal.propertyName || deal.property?.title || 'N/A';
  const ownerName = deal.ownerName || deal.owner?.name || 'Unassigned';
  const closeDate = deal.closeDate || deal.expected_close_date || 'N/A';
  return { ...deal, leadName, propertyName, ownerName, closeDate };
}

export default function PipelinePage() {
  const { t } = useLanguage();
  const { data, loading, error, setData } = useSupabaseQuery(fetchDeals);
  const deals = (data ?? []).map(mapDealForDisplay);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);

  const handleDrop = async (stage: DealStage) => {
    if (!draggedId) return;
    const draggedDeal = deals.find((d) => d.id === draggedId);
    if (!draggedDeal) {
      setDraggedId(null);
      setDragOver(null);
      return;
    }

    // Optimistic update
    const previousStage = draggedDeal.stage;
    setData((prev) => (prev ?? []).map((d) => (d.id === draggedId ? { ...d, stage } : d)));
    setDraggedId(null);
    setDragOver(null);

    const updated = await updateDeal(draggedId, { stage });
    if (updated) {
      toast.success(`"${draggedDeal.title}" moved to ${stage.replace('_', ' ')}`);
    } else {
      // Revert on failure
      setData((prev) => (prev ?? []).map((d) => (d.id === draggedId ? { ...d, stage: previousStage } : d)));
      toast.error('Failed to update deal stage. Please try again.');
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('page.pipeline')} description={t('page.pipelineDescription')}>
        <button onClick={() => toast.success('New deal form opened')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New Deal
        </button>
      </PageHeader>

      {error ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-error">Something went wrong</p>
            <p className="mt-2 text-sm text-text-secondary">{error}</p>
          </div>
        </Card>
      ) : loading ? (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory md:snap-none">
          {columns.map((col) => (
            <div key={col.stage} className="w-[85vw] shrink-0 snap-center md:w-80 rounded-2xl border border-border bg-bg-secondary/50">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="flex flex-col gap-2 p-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-bg-secondary p-3.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="mt-2.5 h-5 w-1/2" />
                    <Skeleton className="mt-2 h-1 w-full" />
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-text-primary">No deals yet</p>
            <p className="mt-2 text-sm text-text-secondary">Create your first deal to start tracking it through the pipeline.</p>
          </div>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory md:snap-none">
          {columns.map((col) => {
            const colDeals = deals.filter((d) => d.stage === col.stage);
            const colValue = colDeals.reduce((sum, d) => sum + d.value, 0);
            return (
              <div
                key={col.stage}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.stage)}
                className={cn(
                  'flex w-[85vw] shrink-0 snap-center flex-col md:w-80 rounded-2xl border bg-bg-secondary/50 transition-colors duration-200',
                  dragOver === col.stage ? 'border-gold-border bg-gold-bg' : 'border-border'
                )}
              >
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-medium text-text-primary">{col.label}</span>
                    <Badge variant="neutral">{colDeals.length}</Badge>
                  </div>
                  <span className="text-xs font-medium text-gold">${(colValue / 1000000).toFixed(1)}M</span>
                </div>
                <div className="scrollbar-thin flex max-h-[calc(100vh-240px)] flex-col gap-2 overflow-y-auto p-2.5">
                  {colDeals.map((deal) => (
                    <motion.div
                      key={deal.id}
                      layout
                      draggable
                      onDragStart={() => setDraggedId(deal.id)}
                      onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                      className={cn(
                        'group cursor-grab rounded-xl border border-border bg-bg-secondary p-3.5 transition-all duration-200 active:cursor-grabbing hover:border-border-strong hover:shadow-soft',
                        draggedId === deal.id && 'opacity-40'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-text-primary">{deal.title}</p>
                        <GripVertical className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="font-serif text-lg font-medium text-gold">${(deal.value / 1000000).toFixed(1)}M</span>
                        <span className="text-xs text-text-muted">{deal.probability}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-elevated">
                        <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: col.color }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={deal.ownerName || 'Unassigned'} size="sm" color="#D4AF37" />
                          <span className="text-xs text-text-muted">{(deal.ownerName || 'Unassigned').split(' ')[0]}</span>
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {deal.closeDate && deal.closeDate !== 'N/A'
                            ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'N/A'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {colDeals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-xs text-text-muted">Drop deals here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
