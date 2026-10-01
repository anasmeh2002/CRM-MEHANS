'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, DateInput, LoadingButton, Modal } from '@/components/forms';
import { createDeal, fetchLeads, fetchContacts, fetchProperties } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';
import type { DealStage, Lead, Contact, Property } from '@/lib/types';

const stageKeys: Record<DealStage, string> = {
  new_lead: 'stage.newLead', qualified: 'stage.qualified', visit_scheduled: 'stage.visitScheduled',
  negotiation: 'stage.negotiation', won: 'stage.won', lost: 'stage.lost',
};

export function DealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
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

  const stages = (Object.keys(stageKeys) as DealStage[]).map((v) => ({ value: v, label: t(stageKeys[v]) }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('dealModal.titleRequired')); return; }
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
        toast.success(t('dealModal.dealCreated', { title: form.title }));
        triggerRefresh();
        onClose();
        setForm({ title: '', leadId: '', contactId: '', propertyId: '', value: '', closeDate: '', stage: 'new_lead', probability: '20', notes: '' });
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
      title={t('dealModal.title')}
      description={t('dealModal.description')}
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">{t('dealModal.saveDeal')}</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('dealModal.dealTitle')} required>
            <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder={t('dealModal.dealTitlePlaceholder')} />
          </Field>
        </div>
        <Field label={t('dealModal.connectLead')}>
          <Select
            value={form.leadId}
            onChange={(v) => set('leadId', v)}
            options={leads.map((l) => ({ value: l.id, label: `${l.first_name} ${l.last_name}`.trim() }))}
            placeholder={t('dealModal.selectLead')}
          />
        </Field>
        <Field label={t('dealModal.connectContact')}>
          <Select
            value={form.contactId}
            onChange={(v) => set('contactId', v)}
            options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`.trim() }))}
            placeholder={t('dealModal.selectContact')}
          />
        </Field>
        <Field label={t('dealModal.connectProperty')}>
          <Select
            value={form.propertyId}
            onChange={(v) => set('propertyId', v)}
            options={properties.map((p) => ({ value: p.id, label: p.title }))}
            placeholder={t('dealModal.selectProperty')}
          />
        </Field>
        <Field label={t('dealModal.dealValue')}>
          <TextInput value={form.value} onChange={(v) => set('value', v)} placeholder={t('dealModal.dealValuePlaceholder')} type="number" />
        </Field>
        <Field label={t('dealModal.expectedCloseDate')}>
          <DateInput value={form.closeDate} onChange={(v) => set('closeDate', v)} />
        </Field>
        <Field label={t('dealModal.pipelineStage')}>
          <Select value={form.stage} onChange={(v) => set('stage', v as DealStage)} options={stages} />
        </Field>
        <Field label={t('dealModal.probability')} hint={t('dealModal.probabilityPlaceholder')}>
          <TextInput value={form.probability} onChange={(v) => set('probability', v)} placeholder="20" type="number" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('leads.notes')}>
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder={t('dealModal.notesPlaceholder')} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
