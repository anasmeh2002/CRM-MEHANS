'use client';


import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, TrendingUp, Calendar, User, Building, X, Trash2, Pencil,
  Phone, Mail, MessageCircle, Sparkles, DollarSign,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar, EmptyState } from '@/components/shared';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal, DateInput } from '@/components/forms';
import { fetchDeals, createDeal, updateDeal, deleteDeal, fetchLeads, fetchProperties, fetchTeamMembers } from '@/lib/data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Deal, DealStage, Lead, Property, TeamMember } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import { useAgency } from '@/components/agency-provider';
import { formatCurrency } from '@/lib/format';

const stageConfig: Record<DealStage, { label: string; color: string }> = {
  new_lead: { label: 'stage.newLead', color: '#4A90D9' },
  qualified: { label: 'stage.qualified', color: '#D4AF37' },
  visit_scheduled: { label: 'stage.visitScheduled', color: '#D4823A' },
  negotiation: { label: 'stage.negotiation', color: '#9B6FBF' },
  won: { label: 'stage.won', color: '#5BAA6F' },
  lost: { label: 'stage.lost', color: '#C75555' },
};

function getLeadName(lead: Deal['lead']): string {
  if (!lead) return 'N/A';
  if (lead.name) return lead.name;
  const full = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim();
  return full || 'N/A';
}

function getPropertyName(property: Deal['property']): string {
  return property?.title || 'N/A';
}

function getOwnerName(owner: Deal['owner']): string {
  return owner?.name || 'Unassigned';
}

function getCloseDate(deal: Deal): string {
  return deal.expected_close_date || deal.closeDate || 'N/A';
}

function getCreatedAt(deal: Deal): string {
  return deal.created_at || deal.createdAt || 'N/A';
}

function mapDealForDisplay(deal: Deal): Deal {
  return {
    ...deal,
    leadName: getLeadName(deal.lead),
    propertyName: getPropertyName(deal.property),
    ownerName: getOwnerName(deal.owner),
    closeDate: getCloseDate(deal),
    createdAt: getCreatedAt(deal),
  };
}

export default function DealsPage() {
  const { t } = useLanguage();
  const { currency } = useAgency();
  const {
    data: dealsData,
    loading: dealsLoading,
    error: dealsError,
    setData: setDealsData,
  } = useSupabaseQuery(fetchDeals);
  const { data: leadsData } = useSupabaseQuery(fetchLeads);
  const { data: propertiesData } = useSupabaseQuery(fetchProperties);
  const { data: teamMembersData } = useSupabaseQuery(fetchTeamMembers);

  const deals = useMemo<Deal[]>(
    () => (dealsData ?? []).map(mapDealForDisplay),
    [dealsData],
  );
  const leads = useMemo<Lead[]>(() => leadsData ?? [], [leadsData]);
  const properties = useMemo<Property[]>(() => propertiesData ?? [], [propertiesData]);
  const teamMembers = useMemo<TeamMember[]>(() => teamMembersData ?? [], [teamMembersData]);

  const [stageFilter, setStageFilter] = useState<DealStage | 'all'>('all');
  const [selected, setSelected] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    leadId: '',
    contactId: '',
    propertyId: '',
    ownerId: '',
    value: '',
    stage: 'new_lead' as DealStage,
    probability: '20',
    closeDate: '2026-09-15',
    notes: '',
  });

  const filtered = useMemo(
    () => (stageFilter === 'all' ? deals : deals.filter((d) => d.stage === stageFilter)),
    [deals, stageFilter],
  );

  const totalValue = filtered.reduce((sum, d) => sum + d.value, 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload: Partial<Deal> = {
        title: form.title || `${properties.find((p) => p.id === form.propertyId)?.title ?? 'Deal'} — ${leads.find((l) => l.id === form.leadId)?.name ?? 'Lead'}`,
        lead_id: form.leadId || undefined,
        contact_id: form.contactId || undefined,
        property_id: form.propertyId || undefined,
        owner_id: form.ownerId || undefined,
        value: parseInt(form.value) || 0,
        expected_close_date: form.closeDate || undefined,
        stage: form.stage,
        probability: parseInt(form.probability) || 0,
        notes: form.notes || undefined,
      };
      const created = await createDeal(payload);
      if (!created) {
        toast.error(t('deals.createFailed'));
        return;
      }
      const mapped = mapDealForDisplay(created);
      setDealsData((prev) => [mapped, ...(prev ?? [])]);
      setShowCreate(false);
      setForm({
        title: '', leadId: '', contactId: '', propertyId: '', ownerId: '',
        value: '', stage: 'new_lead', probability: '20', closeDate: '2026-09-15', notes: '',
      });
      toast.success(t('deals.created', { title: mapped.title }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDeal) return;
    setSaving(true);
    try {
      const patch: Partial<Deal> = {
        title: editDeal.title,
        lead_id: editDeal.lead_id || undefined,
        contact_id: editDeal.contact_id || undefined,
        property_id: editDeal.property_id || undefined,
        owner_id: editDeal.owner_id || undefined,
        value: editDeal.value,
        expected_close_date: editDeal.expected_close_date || editDeal.closeDate || undefined,
        stage: editDeal.stage,
        probability: editDeal.probability,
        notes: editDeal.notes || undefined,
      };
      const updated = await updateDeal(editDeal.id, patch);
      if (!updated) {
        toast.error(t('deals.updateFailed'));
        return;
      }
      const mapped = mapDealForDisplay(updated);
      setDealsData((prev) => (prev ?? []).map((d) => (d.id === editDeal.id ? mapped : d)));
      setEditDeal(null);
      toast.success(t('deals.updated', { title: mapped.title }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update deal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteDeal(id);
    if (!ok) {
      toast.error(t('deals.deleteFailed'));
      return;
    }
    setDealsData((prev) => (prev ?? []).filter((d) => d.id !== id));
    setSelected(null);
    toast.success(t('deals.deleted'));
  };

  return (
    <AppShell>
      <PageHeader title={t('page.deals')} description={t('page.dealsDescription')}>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('navbar.newDeal')}
        </button>
      </PageHeader>

      <div className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setStageFilter('all')}
          className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 whitespace-nowrap', stageFilter === 'all' ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary')}
        >
          {t('common.all')} {t('nav.deals')}
        </button>
        {Object.entries(stageConfig).map(([stage, config]) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage as DealStage)}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 whitespace-nowrap', stageFilter === stage ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary')}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: config.color }} />
            {t(config.label)}
          </button>
        ))}
      </div>

      {dealsLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 h-5 w-20 animate-pulse rounded bg-bg-elevated" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-bg-elevated" />
                </div>
                <div className="h-7 w-16 animate-pulse rounded bg-bg-elevated" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-bg-elevated" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-bg-elevated" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-bg-elevated" />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-24 animate-pulse rounded-full bg-bg-elevated" />
                  <div className="h-3 w-10 animate-pulse rounded bg-bg-elevated" />
                </div>
                <div className="mt-2 h-1 w-full animate-pulse rounded-full bg-bg-elevated" />
              </div>
            </Card>
          ))}
        </div>
      ) : dealsError ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[14px] font-medium text-text-primary">{t('deals.couldntLoad')}</p>
            <p className="mt-1 text-[12px] text-text-secondary">{dealsError}</p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={TrendingUp} title={t('deals.noDeals')} description={t('deals.createFirst')} action={<button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md"><Plus className="h-4 w-4" strokeWidth={1.5} /> {t('navbar.newDeal')}</button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((deal, i) => {
            const config = safeConfig(stageConfig, deal.stage, { label: deal.stage || 'Unknown', color: '#8A8A82' });
            return (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setSelected(deal)}
              >
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge variant="neutral" className="mb-2" style={{ color: config.color, borderColor: `${config.color}40` }}>{config.label}</Badge>
                      <p className="text-[13px] font-medium text-text-primary">{deal.title}</p>
                    </div>
                    <p className="font-serif text-xl font-medium text-gold">{formatCurrency(deal.value, currency)}</p>
                  </div>
                  <div className="mt-4 space-y-2 text-[12px] text-text-secondary">
                    <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" strokeWidth={1.5} /> {deal.leadName}</div>
                    <div className="flex items-center gap-2"><Building className="h-3.5 w-3.5" strokeWidth={1.5} /> {deal.propertyName}</div>
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" strokeWidth={1.5} /> Close by {deal.closeDate !== 'N/A' ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</div>
                  </div>
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={deal.ownerName} size="sm" color="#D4AF37" />
                        <span className="text-[12px] text-text-muted">{deal.ownerName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                        <span className="text-[12px] font-medium text-text-primary">{deal.probability}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-elevated">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${deal.probability}%` }} transition={{ duration: 0.6, delay: i * 0.04 }} className="h-full rounded-full" style={{ background: `linear-gradient(to right, ${config.color}, ${config.color}80)` }} />
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('dealModal.title')}
        description={t('dealModal.description')}
        size="lg"
        footer={<>
          <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-md">{t('common.cancel')}</button>
          <LoadingButton onClick={handleCreate} loading={saving} disabled={!form.value}>{t('dealModal.saveDeal')}</LoadingButton>
        </>}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Deal Title"><TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="e.g. Apartment Sale — Downtown" /></Field>
          </div>
          <Field label="Lead">
            <Select value={form.leadId} onChange={(v) => setForm({ ...form, leadId: v })} options={leads.map((l) => ({ value: l.id, label: l.name }))} />
          </Field>
          <Field label="Property">
            <Select value={form.propertyId} onChange={(v) => setForm({ ...form, propertyId: v })} options={properties.map((p) => ({ value: p.id, label: p.title }))} />
          </Field>
          <Field label={t('deals.value')} required>
            <TextInput type="number" value={form.value} onChange={(v) => setForm({ ...form, value: v })} placeholder="0" />
          </Field>
          <Field label="Stage">
            <Select value={form.stage} onChange={(v) => setForm({ ...form, stage: v as DealStage })} options={Object.entries(stageConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Field>
          <Field label="Probability (%)">
            <TextInput type="number" value={form.probability} onChange={(v) => setForm({ ...form, probability: v })} />
          </Field>
          <Field label="Deal Owner">
            <Select value={form.ownerId} onChange={(v) => setForm({ ...form, ownerId: v })} options={teamMembers.map((m) => ({ value: m.id, label: `${m.name} — ${m.role}` }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Expected Close Date"><DateInput value={form.closeDate} onChange={(v) => setForm({ ...form, closeDate: v })} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes"><TextArea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Additional context about this deal…" /></Field>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editDeal}
        onClose={() => setEditDeal(null)}
        title={t('common.edit')}
        description={editDeal?.title}
        size="lg"
        footer={<>
          <button onClick={() => setEditDeal(null)} className="btn btn-ghost btn-md">{t('common.cancel')}</button>
          <LoadingButton onClick={handleSaveEdit} loading={saving}>{t('common.save')}</LoadingButton>
        </>}
      >
        {editDeal && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Deal Title"><TextInput value={editDeal.title} onChange={(v) => setEditDeal({ ...editDeal, title: v })} /></Field></div>
            <Field label="Lead"><Select value={editDeal.lead_id ?? ''} onChange={(v) => setEditDeal({ ...editDeal, lead_id: v })} options={leads.map((l) => ({ value: l.id, label: l.name }))} /></Field>
            <Field label="Property"><Select value={editDeal.property_id ?? ''} onChange={(v) => setEditDeal({ ...editDeal, property_id: v })} options={properties.map((p) => ({ value: p.id, label: p.title }))} /></Field>
            <Field label={t('deals.value')}><TextInput type="number" value={String(editDeal.value)} onChange={(v) => setEditDeal({ ...editDeal, value: parseInt(v) || 0 })} /></Field>
            <Field label="Stage"><Select value={editDeal.stage} onChange={(v) => setEditDeal({ ...editDeal, stage: v as DealStage })} options={Object.entries(stageConfig).map(([k, v]) => ({ value: k, label: v.label }))} /></Field>
            <Field label="Probability (%)"><TextInput type="number" value={String(editDeal.probability)} onChange={(v) => setEditDeal({ ...editDeal, probability: parseInt(v) || 0 })} /></Field>
            <Field label="Deal Owner"><Select value={editDeal.owner_id ?? ''} onChange={(v) => setEditDeal({ ...editDeal, owner_id: v })} options={teamMembers.map((m) => ({ value: m.id, label: `${m.name} — ${m.role}` }))} /></Field>
            <div className="sm:col-span-2"><Field label="Expected Close Date"><DateInput value={editDeal.expected_close_date ?? editDeal.closeDate ?? ''} onChange={(v) => setEditDeal({ ...editDeal, expected_close_date: v, closeDate: v })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notes"><TextArea value={editDeal.notes ?? ''} onChange={(v) => setEditDeal({ ...editDeal, notes: v })} placeholder="Additional context about this deal…" /></Field></div>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-bg-secondary shadow-modal"
            >
              <div className="flex items-center justify-between border-b border-border p-6">
                <div>
                  <Badge variant="neutral" style={{ color: safeConfig(stageConfig, selected.stage, { label: 'Unknown', color: '#8A8A82' }).color, borderColor: `${safeConfig(stageConfig, selected.stage, { label: 'Unknown', color: '#8A8A82' }).color}40` }}>{safeConfig(stageConfig, selected.stage, { label: 'Unknown', color: '#8A8A82' }).label}</Badge>
                  <h2 className="mt-2 font-serif text-xl font-medium text-text-primary">{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-bg-elevated p-4">
                    <p className="text-[11px] text-text-muted">{t('deals.value')}</p>
                    <p className="mt-1 font-serif text-2xl font-medium text-gold">{formatCurrency(selected.value, currency)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-bg-elevated p-4">
                    <p className="text-[11px] text-text-muted">{t('dealModal.probability')}</p>
                    <p className="mt-1 font-serif text-2xl font-medium text-text-primary">{selected.probability}%</p>
                  </div>
                </div>
                <div className="mb-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3">
                    <User className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <div><p className="text-[11px] text-text-muted">{t('dealModal.connectLead')}</p><p className="text-[13px] font-medium text-text-primary">{selected.leadName}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3">
                    <Building className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <div><p className="text-[11px] text-text-muted">{t('dealModal.connectProperty')}</p><p className="text-[13px] font-medium text-text-primary">{selected.propertyName}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3">
                    <Calendar className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <div><p className="text-[11px] text-text-muted">{t('dealModal.expectedCloseDate')}</p><p className="text-[13px] font-medium text-text-primary">{selected.closeDate !== 'N/A' ? new Date(selected.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3">
                    <DollarSign className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <div><p className="text-[11px] text-text-muted">{t('dealModal.dealOwner')}</p><p className="text-[13px] font-medium text-text-primary">{selected.ownerName}</p></div>
                  </div>
                </div>

                {/* AI Summary */}
                <div className="mb-5 rounded-xl border border-gold-border bg-gold-bg p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <p className="text-[12px] font-semibold text-gold">AI Summary</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">
                    This deal is in the {safeConfig(stageConfig, selected.stage, { label: 'Unknown', color: '#8A8A82' }).label} stage with {selected.probability}% probability of closing. The deal value is ${(selected.value / 1000000).toFixed(1)}M, expected to close by {selected.closeDate !== 'N/A' ? new Date(selected.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}. {selected.probability >= 70 ? 'High priority — recommend immediate follow-up to push toward closing.' : 'Recommend scheduling a property visit to advance the deal.'}
                  </p>
                </div>

                <div className="mb-5 flex gap-2">
                  <button className="btn btn-outline btn-sm flex-1"><Phone className="h-4 w-4" strokeWidth={1.5} /> Call</button>
                  <button className="btn btn-outline btn-sm flex-1"><Mail className="h-4 w-4" strokeWidth={1.5} /> Email</button>
                  <button className="btn btn-outline btn-sm flex-1"><MessageCircle className="h-4 w-4" strokeWidth={1.5} /> WhatsApp</button>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-4">
                <button onClick={() => { setEditDeal(selected); setSelected(null); }} className="btn btn-outline btn-sm flex-1"><Pencil className="h-4 w-4" strokeWidth={1.5} /> {t('common.edit')}</button>
                <button onClick={() => handleDelete(selected.id)} className="btn btn-danger btn-sm"><Trash2 className="h-4 w-4" strokeWidth={1.5} /> {t('common.delete')}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
