'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, DateInput, LoadingButton, Modal } from '@/components/forms';
import { createDeal, fetchLeads, fetchContacts, fetchProperties } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import type { DealStage, Lead, Contact, Property } from '@/lib/types';

const stages: { value: DealStage; label: string }[] = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'visit_scheduled', label: 'Visit Scheduled' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export function DealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState({
    title: '', leadId: '', contactId: '', propertyId: '', value: '', closeDate: '', stage: 'new_lead' as DealStage, probability: '20', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      fetchLeads().then(setLeads).catch(() => {});
      fetchContacts().then(setContacts).catch(() => {});
      fetchProperties().then(setProperties).catch(() => {});
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const result = await createDeal({
        title: form.title,
        lead_id: form.leadId || undefined,
        contact_id: form.contactId || undefined,
        property_id: form.propertyId || undefined,
        value: Number(form.value) || 0,
        expected_close_date: form.closeDate || undefined,
        stage: form.stage,
        probability: Number(form.probability) || 0,
        notes: form.notes || undefined,
      });
      if (result) {
        toast.success(`Deal "${form.title}" created`);
        triggerRefresh();
        onClose();
        setForm({ title: '', leadId: '', contactId: '', propertyId: '', value: '', closeDate: '', stage: 'new_lead', probability: '20', notes: '' });
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
      title="New Deal"
      description="Create a deal by connecting a lead, contact, and property."
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">Save Deal</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Deal Title" required>
            <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Skyline Penthouse — James Wilson" />
          </Field>
        </div>
        <Field label="Connect Lead">
          <Select
            value={form.leadId}
            onChange={(v) => set('leadId', v)}
            options={leads.map((l) => ({ value: l.id, label: `${l.first_name} ${l.last_name}`.trim() }))}
            placeholder="Select lead..."
          />
        </Field>
        <Field label="Connect Contact">
          <Select
            value={form.contactId}
            onChange={(v) => set('contactId', v)}
            options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`.trim() }))}
            placeholder="Select contact..."
          />
        </Field>
        <Field label="Connect Property">
          <Select
            value={form.propertyId}
            onChange={(v) => set('propertyId', v)}
            options={properties.map((p) => ({ value: p.id, label: p.title }))}
            placeholder="Select property..."
          />
        </Field>
        <Field label="Deal Value">
          <TextInput value={form.value} onChange={(v) => set('value', v)} placeholder="4,200,000" type="number" />
        </Field>
        <Field label="Expected Close Date">
          <DateInput value={form.closeDate} onChange={(v) => set('closeDate', v)} />
        </Field>
        <Field label="Pipeline Stage">
          <Select value={form.stage} onChange={(v) => set('stage', v as DealStage)} options={stages} />
        </Field>
        <Field label="Probability (%)" hint="0–100, based on stage">
          <TextInput value={form.probability} onChange={(v) => set('probability', v)} placeholder="20" type="number" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Cash buyer, ready to close quickly." rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
