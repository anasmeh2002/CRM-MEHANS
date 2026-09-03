'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, LoadingButton, TagInput } from '@/components/forms';
import { Modal } from '@/components/forms';
import { createLead, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import type { LeadSource, LeadStatus, TeamMember } from '@/lib/types';

const sources: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social Media' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'portal', label: 'Portal' },
  { value: 'cold-call', label: 'Cold Call' },
];

const statuses: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'visit_scheduled', label: 'Visit Scheduled' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const languages = ['English', 'Spanish', 'French', 'Arabic', 'Mandarin', 'Hindi', 'Portuguese'];

export function LeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const handleSave = async () => {
    if (!form.firstName.trim()) { toast.error('First name is required'); return; }
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
        toast.success(`Lead ${form.firstName} ${form.lastName} created`);
        triggerRefresh();
        onClose();
        setForm({ firstName: '', lastName: '', phone: '', whatsapp: '', email: '', source: 'website', propertyInterest: '', budget: '', language: 'English', agentId: '', status: 'new', score: '50', notes: '', tags: [] });
      } else {
        toast.error('Failed to save. Check your database connection and try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Lead"
      description="Capture a new prospect entering the pipeline."
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">Save Lead</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First Name" required>
          <TextInput value={form.firstName} onChange={(v) => set('firstName', v)} placeholder="James" />
        </Field>
        <Field label="Last Name">
          <TextInput value={form.lastName} onChange={(v) => set('lastName', v)} placeholder="Wilson" />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label="WhatsApp">
          <TextInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label="Email">
          <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="james@email.com" type="email" />
        </Field>
        <Field label="Lead Source">
          <Select value={form.source} onChange={(v) => set('source', v as LeadSource)} options={sources} />
        </Field>
        <Field label="Property Interest">
          <TextInput value={form.propertyInterest} onChange={(v) => set('propertyInterest', v)} placeholder="3BHK Penthouse" />
        </Field>
        <Field label="Budget">
          <TextInput value={form.budget} onChange={(v) => set('budget', v)} placeholder="2,500,000" type="number" />
        </Field>
        <Field label="Language">
          <Select value={form.language} onChange={(v) => set('language', v)} options={languages.map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label="Assigned Agent">
          <Select value={form.agentId} onChange={(v) => set('agentId', v)} options={agents.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select agent..." />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set('status', v as LeadStatus)} options={statuses} />
        </Field>
        <Field label="Lead Score" hint="0–100, based on qualification">
          <TextInput value={form.score} onChange={(v) => set('score', v)} placeholder="72" type="number" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tags">
            <TagInput value={form.tags} onChange={(v) => set('tags', v)} placeholder="Add tags..." suggestions={['VIP', 'Cash Buyer', 'Hot Lead', 'Investor', 'First-Time Buyer']} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Looking for a 3BHK penthouse in downtown. Cash buyer, ready to move quickly." rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
