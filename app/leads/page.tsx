'use client';


import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Phone, Mail, MessageCircle, Star, X, TrendingUp, MoreHorizontal, CalendarPlus,
  Users, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Columns3, Trash2, CheckSquare, Square, Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar, EmptyState, ScoreBar, SkeletonCard } from '@/components/shared';
import { Field, TextInput, TextArea, Select, TagInput, LoadingButton, Modal, SearchInput, DateInput } from '@/components/forms';
import { fetchLeads, createLead, updateLead, deleteLead, fetchTeamMembers } from '@/lib/data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Lead, LeadStatus, LeadSource, TeamMember } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import { useGlobalModal } from '@/components/modal-provider';

const statusConfig: Record<LeadStatus, { label: string; variant: 'gold' | 'info' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  new: { label: 'New', variant: 'info' },
  qualified: { label: 'Qualified', variant: 'gold' },
  visit_scheduled: { label: 'Visit Scheduled', variant: 'warning' },
  negotiation: { label: 'Negotiation', variant: 'gold' },
  won: { label: 'Won', variant: 'success' },
  lost: { label: 'Lost', variant: 'error' },
};

const statusFilters: { status: LeadStatus | 'all'; label: string }[] = [
  { status: 'all', label: 'All' },
  { status: 'new', label: 'New' },
  { status: 'qualified', label: 'Qualified' },
  { status: 'visit_scheduled', label: 'Visit' },
  { status: 'negotiation', label: 'Negotiation' },
  { status: 'won', label: 'Won' },
  { status: 'lost', label: 'Lost' },
];

type SortKey = 'name' | 'score' | 'budget' | 'lastActivity';
type SortDir = 'asc' | 'desc';

const columns = [
  { key: 'name', label: 'Name', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'score', label: 'Score', visible: true },
  { key: 'source', label: 'Source', visible: true },
  { key: 'budget', label: 'Budget', visible: true },
  { key: 'owner', label: 'Owner', visible: true },
  { key: 'tags', label: 'Tags', visible: true },
  { key: 'lastActivity', label: 'Activity', visible: true },
];

const tagSuggestions = ['Luxury', 'VIP', 'Cash Buyer', 'Investor', 'Hot', 'Pre-Approved', 'First-Time Buyer', 'Negotiating', 'Closed', 'Browsing'];

const PAGE_SIZE = 8;

function getNextBestActionKey(lead: Lead): string {
  if (lead.status === 'negotiation') return 'leads.actionNegotiation';
  if (lead.status === 'new') return 'leads.actionNew';
  if (lead.status === 'visit_scheduled') return 'leads.actionVisit';
  if (lead.status === 'qualified') return 'leads.actionQualified';
  return 'leads.actionGeneric';
}

function mapLeadForDisplay(l: Lead): Lead {
  const name = l.name && l.name.trim() ? l.name : `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Unnamed';
  const avatarColor = l.avatarColor || '#D4AF37';
  const owner = l.owner || l.assigned_agent?.name || 'Unassigned';
  const tags = l.tags || [];
  const lastActivity = l.lastActivity || (l.updated_at ? new Date(l.updated_at).toLocaleString() : 'N/A');
  const timeline = l.timeline || [];
  const createdAt = l.createdAt || (l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  return { ...l, name, avatarColor, owner, tags, lastActivity, timeline, createdAt };
}

export default function LeadsPage() {
  const { t } = useLanguage();
  const { openModal } = useGlobalModal();
  const { data: rawLeads, loading, error, refetch, setData } = useSupabaseQuery(fetchLeads);
  const leads = useMemo<Lead[]>(() => (rawLeads ?? []).map(mapLeadForDisplay), [rawLeads]);

  const { data: rawTeamMembers } = useSupabaseQuery(fetchTeamMembers);
  const teamMembers: TeamMember[] = rawTeamMembers ?? [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colVis, setColVis] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  const [showColMenu, setShowColMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: '', email: '', phone: '', whatsapp: '', source: 'website', status: 'new' as LeadStatus,
    budget: '', score: '50', language: 'English', propertyInterest: '',
    tags: [] as string[], notes: '', owner: 'Unassigned',
  });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchSearch && matchStatus;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'score') cmp = a.score - b.score;
      else if (sortKey === 'budget') cmp = a.budget - b.budget;
      else if (sortKey === 'lastActivity') cmp = (a.lastActivity || '').localeCompare(b.lastActivity || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleCol = (key: string) => {
    const next = new Set(colVis);
    if (next.has(key)) next.delete(key); else next.add(key);
    setColVis(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map((l) => l.id)));
  };

  const splitName = (name: string): { first_name: string; last_name: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { first_name: '', last_name: '' };
    const parts = trimmed.split(/\s+/);
    const first_name = parts[0] || '';
    const last_name = parts.slice(1).join(' ');
    return { first_name, last_name };
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { first_name, last_name } = splitName(form.name);
      const assignedAgent = teamMembers.find((m) => m.name === form.owner);
      const payload: Partial<Lead> = {
        first_name,
        last_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        source: form.source as LeadSource,
        status: form.status,
        budget: parseInt(form.budget) || 0,
        score: parseInt(form.score) || 50,
        language: form.language,
        property_interest: form.propertyInterest || undefined,
        tags: form.tags,
        notes: form.notes || undefined,
        assigned_agent_id: assignedAgent?.id ?? undefined,
      };
      const created = await createLead(payload);
      if (!created) {
        toast.error('Failed to create lead. Please try again.');
        return;
      }
      const displayLead = mapLeadForDisplay(created);
      setData([created, ...(rawLeads ?? [])]);
      toast.success(`Lead "${displayLead.name}" created successfully`);
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', whatsapp: '', source: 'website', status: 'new', budget: '', score: '50', language: 'English', propertyInterest: '', tags: [], notes: '', owner: 'Unassigned' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create lead.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editLead) return;
    setSaving(true);
    try {
      const { first_name, last_name } = splitName(editLead.name);
      const assignedAgent = teamMembers.find((m) => m.name === editLead.owner);
      const patch: Partial<Lead> = {
        first_name,
        last_name,
        email: editLead.email || undefined,
        phone: editLead.phone || undefined,
        whatsapp: editLead.whatsapp || undefined,
        source: editLead.source as LeadSource,
        status: editLead.status,
        budget: editLead.budget,
        score: editLead.score,
        language: editLead.language,
        property_interest: editLead.property_interest || undefined,
        tags: editLead.tags,
        notes: editLead.notes || undefined,
        assigned_agent_id: assignedAgent?.id ?? undefined,
      };
      const updated = await updateLead(editLead.id, patch);
      if (!updated) {
        toast.error('Failed to update lead. Please try again.');
        return;
      }
      const displayUpdated = mapLeadForDisplay(updated);
      setData((rawLeads ?? []).map((l) => (l.id === editLead.id ? updated : l)));
      toast.success(`Lead "${displayUpdated.name}" updated successfully`);
      setEditLead(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update lead.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteLead(id);
    if (!ok) {
      toast.error('Failed to delete lead. Please try again.');
      return;
    }
    setData((rawLeads ?? []).filter((l) => l.id !== id));
    setDetailLead(null);
    toast.success('Lead deleted');
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" strokeWidth={1.5} />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gold" strokeWidth={1.5} /> : <ArrowDown className="h-3 w-3 text-gold" strokeWidth={1.5} />;
  };

  return (
    <AppShell>
      <PageHeader title={t('leads.title')} description={t('leads.description')}>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('leads.newLead')}
        </button>
      </PageHeader>

      {/* Filters Bar */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search leads by name or email..." className="flex-1 max-w-md" />
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {statusFilters.map((f) => (
            <button
              key={f.status}
              onClick={() => { setStatusFilter(f.status); setPage(1); }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 whitespace-nowrap',
                statusFilter === f.status ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <Columns3 className="h-3.5 w-3.5" strokeWidth={1.5} /> Columns
          </button>
          <AnimatePresence>
            {showColMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-modal z-30"
              >
                {columns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleCol(col.key)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
                  >
                    {colVis.has(col.key) ? <CheckSquare className="h-4 w-4 text-gold" strokeWidth={1.5} /> : <Square className="h-4 w-4 text-text-muted" strokeWidth={1.5} />}
                    {col.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 48 }} exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex items-center gap-3 overflow-hidden rounded-xl border border-gold-border bg-gold-bg px-4"
          >
            <span className="text-[13px] font-medium text-gold">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            <button onClick={() => { toast.success(`Exported ${selected.size} leads`); setSelected(new Set()); }} className="text-[12px] font-medium text-text-primary hover:text-gold">Export</button>
            <button onClick={() => { toast.success(`Assigned ${selected.size} leads`); setSelected(new Set()); }} className="text-[12px] font-medium text-text-primary hover:text-gold">Assign</button>
            <button onClick={async () => {
              const ids = Array.from(selected);
              const results = await Promise.all(ids.map((id) => deleteLead(id)));
              const failed = results.filter((r) => !r).length;
              if (failed > 0) toast.error(`${failed} lead(s) failed to delete`);
              else toast.success(`${ids.length} lead(s) deleted`);
              setData((rawLeads ?? []).filter((l) => !selected.has(l.id)));
              setSelected(new Set());
            }} className="text-[12px] font-medium text-error hover:opacity-80">Delete</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content: Loading / Error / Empty / Table */}
      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
              <X className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-text-primary">Failed to load leads</p>
              <p className="mt-1 text-[13px] text-text-secondary">{error}</p>
            </div>
            <button onClick={() => refetch()} className="btn btn-outline btn-md mt-2">Retry</button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Users} title="No leads found" description="Try adjusting your filters or search query." action={<button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md"><Plus className="h-4 w-4" strokeWidth={1.5} /> New Lead</button>} /></Card>
      ) : (
        <Card padding={false} delay={0.1} className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-bg-secondary text-left text-[11px] text-text-muted">
                  <th className="px-4 py-3.5 w-10">
                    <button onClick={toggleSelectAll}>
                      {selected.size === paged.length && paged.length > 0 ? <CheckSquare className="h-4 w-4 text-gold" strokeWidth={1.5} /> : <Square className="h-4 w-4 text-text-muted" strokeWidth={1.5} />}
                    </button>
                  </th>
                  {colVis.has('name') && <th className="px-4 py-3.5 font-medium"><button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 hover:text-text-primary">Name <SortIcon k="name" /></button></th>}
                  {colVis.has('status') && <th className="px-4 py-3.5 font-medium">Status</th>}
                  {colVis.has('score') && <th className="px-4 py-3.5 font-medium"><button onClick={() => toggleSort('score')} className="flex items-center gap-1.5 hover:text-text-primary">Score <SortIcon k="score" /></button></th>}
                  {colVis.has('source') && <th className="px-4 py-3.5 font-medium">Source</th>}
                  {colVis.has('budget') && <th className="px-4 py-3.5 font-medium"><button onClick={() => toggleSort('budget')} className="flex items-center gap-1.5 hover:text-text-primary">Budget <SortIcon k="budget" /></button></th>}
                  {colVis.has('owner') && <th className="px-4 py-3.5 font-medium">Owner</th>}
                  {colVis.has('tags') && <th className="px-4 py-3.5 font-medium">Tags</th>}
                  {colVis.has('lastActivity') && <th className="px-4 py-3.5 font-medium"><button onClick={() => toggleSort('lastActivity')} className="flex items-center gap-1.5 hover:text-text-primary">Activity <SortIcon k="lastActivity" /></button></th>}
                  <th className="px-4 py-3.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    onClick={() => setDetailLead(lead)}
                    className={cn(
                      'cursor-pointer border-b border-border-subtle transition-colors hover:bg-bg-elevated',
                      selected.has(lead.id) && 'bg-gold-bg'
                    )}
                  >
                    <td className="px-4 py-3.5" onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}>
                      {selected.has(lead.id) ? <CheckSquare className="h-4 w-4 text-gold" strokeWidth={1.5} /> : <Square className="h-4 w-4 text-text-muted" strokeWidth={1.5} />}
                    </td>
                    {colVis.has('name') && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} color={lead.avatarColor} size="sm" />
                          <div>
                            <p className="text-[13px] font-medium text-text-primary">{lead.name}</p>
                            <p className="text-[11px] text-text-muted">{lead.email}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    {colVis.has('status') && <td className="px-4 py-3.5"><Badge variant={safeConfig(statusConfig, lead.status, { label: 'Unknown', variant: 'neutral' as const }).variant}>{safeConfig(statusConfig, lead.status, { label: 'Unknown', variant: 'neutral' as const }).label}</Badge></td>}
                    {colVis.has('score') && <td className="px-4 py-3.5"><ScoreBar score={lead.score} /></td>}
                    {colVis.has('source') && <td className="px-4 py-3.5"><span className="text-[13px] capitalize text-text-secondary">{lead.source.replace('-', ' ')}</span></td>}
                    {colVis.has('budget') && <td className="px-4 py-3.5"><span className="text-[13px] font-medium text-text-primary">${(lead.budget / 1000000).toFixed(1)}M</span></td>}
                    {colVis.has('owner') && <td className="px-4 py-3.5"><span className="text-[13px] text-text-secondary">{lead.owner}</span></td>}
                    {colVis.has('tags') && (
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-md border border-border bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">{tag}</span>)}
                        </div>
                      </td>
                    )}
                    {colVis.has('lastActivity') && <td className="px-4 py-3.5"><span className="text-[12px] text-text-muted">{lead.lastActivity}</span></td>}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditLead(lead)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"><MoreHorizontal className="h-4 w-4" strokeWidth={1.5} /></button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-[12px] text-text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12px] font-medium transition-colors',
                    page === i + 1 ? 'border-gold-border bg-gold-bg text-gold' : 'border-border text-text-secondary hover:bg-bg-elevated'
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Lead"
        description="Add a new lead to your pipeline"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-md">Cancel</button>
            <LoadingButton onClick={handleCreate} loading={saving} disabled={!form.name || !form.email}>
              Create Lead
            </LoadingButton>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full Name" required>
            <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Lead name" />
          </Field>
          <Field label="Email" required>
            <TextInput type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="john@example.com" />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="WhatsApp">
            <TextInput value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Budget">
            <TextInput type="number" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} placeholder="1000000" />
          </Field>
          <Field label="Lead Score" hint="0–100">
            <TextInput type="number" value={form.score} onChange={(v) => setForm({ ...form, score: v })} placeholder="50" />
          </Field>
          <Field label="Property Interest">
            <TextInput value={form.propertyInterest} onChange={(v) => setForm({ ...form, propertyInterest: v })} placeholder="3BHK Penthouse" />
          </Field>
          <Field label="Language">
            <Select value={form.language} onChange={(v) => setForm({ ...form, language: v })} options={[{ value: 'English', label: 'English' }, { value: 'Spanish', label: 'Spanish' }, { value: 'French', label: 'French' }, { value: 'Arabic', label: 'Arabic' }, { value: 'Mandarin', label: 'Mandarin' }, { value: 'Hindi', label: 'Hindi' }, { value: 'Portuguese', label: 'Portuguese' }]} />
          </Field>
          <Field label="Source">
            <Select
              value={form.source}
              onChange={(v) => setForm({ ...form, source: v })}
              options={[
                { value: 'website', label: 'Website' }, { value: 'referral', label: 'Referral' },
                { value: 'social', label: 'Social Media' }, { value: 'walk-in', label: 'Walk-in' },
                { value: 'portal', label: 'Portal' }, { value: 'cold-call', label: 'Cold Call' },
              ]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v as LeadStatus })}
              options={[
                { value: 'new', label: 'New' }, { value: 'qualified', label: 'Qualified' },
                { value: 'visit_scheduled', label: 'Visit Scheduled' }, { value: 'negotiation', label: 'Negotiation' },
                { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' },
              ]}
            />
          </Field>
          <Field label="Assigned Agent">
            <Select
              value={form.owner}
              onChange={(v) => setForm({ ...form, owner: v })}
              options={teamMembers.map((m) => ({ value: m.name, label: `${m.name} — ${m.role}` }))}
            />
          </Field>
          <Field label="Tags">
            <TagInput value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} suggestions={tagSuggestions} placeholder="Add tags..." />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Add any notes about this lead..." rows={3} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editLead}
        onClose={() => setEditLead(null)}
        title="Edit Lead"
        description={editLead?.name}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditLead(null)} className="btn btn-ghost btn-md">Cancel</button>
            <LoadingButton onClick={handleSaveEdit} loading={saving}>Save Changes</LoadingButton>
          </>
        }
      >
        {editLead && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full Name" required>
              <TextInput value={editLead.name} onChange={(v) => setEditLead({ ...editLead, name: v })} />
            </Field>
            <Field label="Email" required>
              <TextInput type="email" value={editLead.email} onChange={(v) => setEditLead({ ...editLead, email: v })} />
            </Field>
            <Field label="Phone">
              <TextInput value={editLead.phone} onChange={(v) => setEditLead({ ...editLead, phone: v })} />
            </Field>
            <Field label="WhatsApp">
              <TextInput value={editLead.whatsapp} onChange={(v) => setEditLead({ ...editLead, whatsapp: v })} />
            </Field>
            <Field label="Budget">
              <TextInput type="number" value={String(editLead.budget)} onChange={(v) => setEditLead({ ...editLead, budget: parseInt(v) || 0 })} />
            </Field>
            <Field label="Lead Score" hint="0–100">
              <TextInput type="number" value={String(editLead.score)} onChange={(v) => setEditLead({ ...editLead, score: parseInt(v) || 0 })} />
            </Field>
            <Field label="Property Interest">
              <TextInput value={editLead.property_interest} onChange={(v) => setEditLead({ ...editLead, property_interest: v })} />
            </Field>
            <Field label="Language">
              <Select value={editLead.language} onChange={(v) => setEditLead({ ...editLead, language: v })} options={[{ value: 'English', label: 'English' }, { value: 'Spanish', label: 'Spanish' }, { value: 'French', label: 'French' }, { value: 'Arabic', label: 'Arabic' }, { value: 'Mandarin', label: 'Mandarin' }, { value: 'Hindi', label: 'Hindi' }, { value: 'Portuguese', label: 'Portuguese' }]} />
            </Field>
            <Field label="Source">
              <Select value={editLead.source} onChange={(v) => setEditLead({ ...editLead, source: v as any })} options={[
                { value: 'website', label: 'Website' }, { value: 'referral', label: 'Referral' },
                { value: 'social', label: 'Social Media' }, { value: 'walk-in', label: 'Walk-in' },
                { value: 'portal', label: 'Portal' }, { value: 'cold-call', label: 'Cold Call' },
              ]} />
            </Field>
            <Field label="Status">
              <Select value={editLead.status} onChange={(v) => setEditLead({ ...editLead, status: v as LeadStatus })} options={[
                { value: 'new', label: 'New' }, { value: 'qualified', label: 'Qualified' },
                { value: 'visit_scheduled', label: 'Visit Scheduled' }, { value: 'negotiation', label: 'Negotiation' },
                { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' },
              ]} />
            </Field>
            <Field label="Assigned Agent">
              <Select value={editLead.owner} onChange={(v) => setEditLead({ ...editLead, owner: v })} options={teamMembers.map((m) => ({ value: m.name, label: `${m.name} — ${m.role}` }))} />
            </Field>
            <Field label="Tags">
              <TagInput value={editLead.tags} onChange={(v) => setEditLead({ ...editLead, tags: v })} suggestions={tagSuggestions} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <TextArea value={editLead.notes} onChange={(v) => setEditLead({ ...editLead, notes: v })} rows={3} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <AnimatePresence>
        {detailLead && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailLead(null)} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-bg-secondary shadow-modal"
            >
              <div className="flex items-center justify-between border-b border-border p-6">
                <div className="flex items-center gap-3">
                  <Avatar name={detailLead.name} color={detailLead.avatarColor} size="lg" />
                  <div>
                    <h2 className="font-serif text-xl font-medium text-text-primary">{detailLead.name}</h2>
                    <p className="text-[13px] text-text-muted">{detailLead.email}</p>
                  </div>
                </div>
                <button onClick={() => setDetailLead(null)} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge variant={safeConfig(statusConfig, detailLead.status, { label: 'Unknown', variant: 'neutral' as const }).variant}>{safeConfig(statusConfig, detailLead.status, { label: 'Unknown', variant: 'neutral' as const }).label}</Badge>
                  {detailLead.tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>)}
                </div>
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-bg-elevated p-4">
                    <p className="text-[11px] text-text-muted">Lead Score</p>
                    <p className="mt-1 font-serif text-2xl font-medium text-gold">{detailLead.score}<span className="text-sm text-text-muted">/100</span></p>
                  </div>
                  <div className="rounded-xl border border-border bg-bg-elevated p-4">
                    <p className="text-[11px] text-text-muted">Budget</p>
                    <p className="mt-1 font-serif text-2xl font-medium text-text-primary">${(detailLead.budget / 1000000).toFixed(1)}M</p>
                  </div>
                </div>
                <div className="mb-5 grid grid-cols-2 gap-2">
                  <button onClick={() => openModal('meeting', { leadId: detailLead.id, leadName: detailLead.name, title: `Meeting with ${detailLead.name}` })} className="btn btn-gold btn-sm col-span-2"><CalendarPlus className="h-4 w-4" strokeWidth={1.5} /> Schedule Meeting</button>
                  <button className="btn btn-outline btn-sm"><Phone className="h-4 w-4" strokeWidth={1.5} /> Call</button>
                  <button className="btn btn-outline btn-sm"><Mail className="h-4 w-4" strokeWidth={1.5} /> Email</button>
                  <button className="btn btn-outline btn-sm col-span-2"><MessageCircle className="h-4 w-4" strokeWidth={1.5} /> WhatsApp</button>
                </div>
                <div className="mb-5 rounded-xl border border-border bg-bg-elevated p-4">
                  <p className="mb-1.5 text-[11px] font-medium text-text-muted">Notes</p>
                  <p className="text-[13px] leading-relaxed text-text-primary">{detailLead.notes}</p>
                </div>

                <div className="mb-5 rounded-xl border border-info/30 bg-info-bg p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-info" strokeWidth={1.5} />
                    <p className="text-[12px] font-semibold text-info">{t('leads.nextBestAction')}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">{t(getNextBestActionKey(detailLead), { name: detailLead.name })}</p>
                </div>

                {/* AI Summary */}
                <div className="mb-5 rounded-xl border border-gold-border bg-gold-bg p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    <p className="text-[12px] font-semibold text-gold">AI Summary</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">
                    {detailLead.name} is a {detailLead.score >= 80 ? 'high-value' : detailLead.score >= 50 ? 'moderate' : 'low'} priority lead with a budget of ${(detailLead.budget / 1000000).toFixed(1)}M. Sourced via {detailLead.source.replace('-', ' ')}. {detailLead.status === 'negotiation' ? 'Currently in active negotiation — recommend immediate follow-up.' : detailLead.status === 'won' ? 'Successfully closed. Consider referral outreach.' : 'Recommend scheduling a property visit to advance the pipeline.'}
                  </p>
                </div>

                <div>
                  <p className="mb-3 text-[13px] font-medium text-text-primary">Timeline</p>
                  <div className="space-y-3">
                    {detailLead.timeline.map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated text-gold">
                          {entry.type === 'call' && <Phone className="h-4 w-4" strokeWidth={1.5} />}
                          {entry.type === 'email' && <Mail className="h-4 w-4" strokeWidth={1.5} />}
                          {entry.type === 'whatsapp' && <MessageCircle className="h-4 w-4" strokeWidth={1.5} />}
                          {entry.type === 'meeting' && <Star className="h-4 w-4" strokeWidth={1.5} />}
                          {entry.type === 'note' && <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />}
                          {entry.type === 'status_change' && <TrendingUp className="h-4 w-4" strokeWidth={1.5} />}
                        </div>
                        <div className="flex-1 rounded-xl border border-border bg-bg-elevated p-3">
                          <p className="text-[13px] font-medium text-text-primary">{entry.title}</p>
                          <p className="text-[12px] text-text-secondary">{entry.description}</p>
                          <p className="mt-1 text-[11px] text-text-muted">{entry.author} · {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {detailLead.timeline.length === 0 && <p className="text-[13px] text-text-muted">No activity yet.</p>}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-2 border-t border-border p-4">
                <button onClick={() => { setEditLead(detailLead); setDetailLead(null); }} className="btn btn-outline btn-sm flex-1">Edit</button>
                <button onClick={() => handleDelete(detailLead.id)} className="btn btn-danger btn-sm"><Trash2 className="h-4 w-4" strokeWidth={1.5} /> Delete</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
