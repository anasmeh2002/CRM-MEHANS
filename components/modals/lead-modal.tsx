'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Mail, Phone, DollarSign, Home, Globe, Tag } from 'lucide-react';
import { Field, TextInput, TextArea, Select, LoadingButton, TagInput } from '@/components/forms';
import { Modal } from '@/components/forms';
import { createLead, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';
import type { LeadSource, LeadStatus, TeamMember } from '@/lib/types';

const sourceKeys: Record<LeadSource, string> = {
  website: 'source.website', referral: 'source.referral', social: 'source.socialMedia',
  'walk-in': 'source.walkIn', portal: 'source.portal', 'cold-call': 'source.coldCall',
};

const statusKeys: Record<LeadStatus, string> = {
  new: 'leadStatus.new', qualified: 'leadStatus.qualified', visit_scheduled: 'leadStatus.visitScheduled',
  negotiation: 'leadStatus.negotiation', won: 'leadStatus.won', lost: 'leadStatus.lost',
};

const languageKeys: Record<string, string> = {
  English: 'lang.english', Spanish: 'lang.spanish', French: 'lang.french',
  Arabic: 'lang.arabic', Mandarin: 'lang.mandarin', Hindi: 'lang.hindi', Portuguese: 'lang.portuguese',
};

const tagKeys: Record<string, string> = {
  VIP: 'tag.vip', 'Cash Buyer': 'tag.cashBuyer', 'Hot Lead': 'tag.hotLead',
  Investor: 'tag.investor', 'First-Time Buyer': 'tag.firstTimeBuyer',
};

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: string }) {
  return (
    <div className="col-span-full flex items-center gap-2 border-b border-border pb-2 mb-1">
      <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
      <span className="text-[13px] font-medium text-text-primary">{children}</span>
    </div>
  );
}

export function LeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', whatsapp: '', email: '',
    source: 'website' as LeadSource, propertyInterest: '', budget: '',
    language: 'English', agentId: '', status: 'new' as LeadStatus, score: '50', notes: '',
    tags: [] as string[],
  });

  useEffect(() => {
    if (open) {
      fetchTeamMembers().then(setAgents).catch(() => {});
    }
  }, [open]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const sources = (Object.keys(sourceKeys) as LeadSource[]).map((v) => ({ value: v, label: t(sourceKeys[v]) }));
  const statuses = (Object.keys(statusKeys) as LeadStatus[]).map((v) => ({ value: v, label: t(statusKeys[v]) }));
  const languages = Object.keys(languageKeys);
  const languageOptions = languages.map((l) => ({ value: l, label: t(languageKeys[l]) }));
  const tagSuggestions = Object.keys(tagKeys);

  const handleSave = async () => {
    if (!form.firstName.trim()) { toast.error(t('leadModal.firstNameRequired')); return; }
    setSaving(true);
    try {
      const result = await createLead({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        source: form.source,
        property_interest: form.propertyInterest || undefined,
        budget: Number(form.budget) || 0,
        language: form.language,
        assigned_agent_id: form.agentId || undefined,
        status: form.status,
        score: Number(form.score) || 0,
        notes: form.notes || undefined,
        tags: form.tags,
      });
      if (result) {
        toast.success(t('leadModal.leadCreated', { name: `${form.firstName} ${form.lastName}`.trim() }));
        triggerRefresh();
        onClose();
        setForm({ firstName: '', lastName: '', phone: '', whatsapp: '', email: '', source: 'website', propertyInterest: '', budget: '', language: 'English', agentId: '', status: 'new', score: '50', notes: '', tags: [] });
      } else {
        toast.error(t('modal.failedToSaveDb'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('modal.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('leadModal.title')}
      description={t('leadModal.description')}
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">{t('leadModal.saveLead')}</LoadingButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <SectionTitle icon={User}>{t('leadModal.contactInfo')}</SectionTitle>
        <Field label={t('leads.firstName')} required>
          <TextInput value={form.firstName} onChange={(v) => set('firstName', v)} placeholder="James" icon={<User className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('leads.lastName')}>
          <TextInput value={form.lastName} onChange={(v) => set('lastName', v)} placeholder="Wilson" icon={<User className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('common.phone')}>
          <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 415 555 0192" type="tel" icon={<Phone className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('leadModal.whatsapp')}>
          <TextInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+1 415 555 0192" type="tel" icon={<Phone className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('common.email')}>
          <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="james@email.com" type="email" icon={<Mail className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('leads.language')}>
          <Select value={form.language} onChange={(v) => set('language', v)} options={languageOptions} />
        </Field>

        <SectionTitle icon={DollarSign}>{t('leadModal.dealInfo')}</SectionTitle>
        <Field label={t('leadModal.leadSource')}>
          <Select value={form.source} onChange={(v) => set('source', v as LeadSource)} options={sources} />
        </Field>
        <Field label={t('leadModal.leadStatus')}>
          <Select value={form.status} onChange={(v) => set('status', v as LeadStatus)} options={statuses} />
        </Field>
        <Field label={t('leads.propertyInterest')}>
          <TextInput value={form.propertyInterest} onChange={(v) => set('propertyInterest', v)} placeholder={t('leadModal.propertyInterestPlaceholder')} icon={<Home className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('leads.budget')}>
          <TextInput value={form.budget} onChange={(v) => set('budget', v)} placeholder={t('leadModal.budgetPlaceholder')} type="number" icon={<DollarSign className="h-4 w-4" strokeWidth={1.5} />} />
        </Field>
        <Field label={t('leadModal.assignedAgent')}>
          <Select value={form.agentId} onChange={(v) => set('agentId', v)} options={agents.map((a) => ({ value: a.id, label: a.name }))} placeholder={t('leadModal.selectAgent')} />
        </Field>
        <Field label={t('leadModal.leadScore')} hint={t('leadModal.scorePlaceholder')}>
          <TextInput value={form.score} onChange={(v) => set('score', v)} placeholder="72" type="number" />
        </Field>

        <SectionTitle icon={Tag}>{t('leadModal.additional')}</SectionTitle>
        <div className="col-span-full">
          <Field label={t('leads.tags')}>
            <TagInput value={form.tags} onChange={(v) => set('tags', v)} placeholder={t('leadModal.tagsPlaceholder')} suggestions={tagSuggestions} />
          </Field>
        </div>
        <div className="col-span-full">
          <Field label={t('leads.notes')}>
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder={t('leadModal.notesPlaceholder')} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
