'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal } from '@/components/forms';
import { createMeeting, fetchLeads, fetchContacts, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';
import type { MeetingType, Lead, Contact, TeamMember } from '@/lib/types';
import type { MeetingPrefill } from '@/components/modal-provider';

const typeKeys: Record<MeetingType, string> = {
  google_meet: 'meetingType.videoCall', zoom: 'meetingType.zoom', 'in-person': 'meetingType.inPerson',
  call: 'meetingType.phoneCall', visit: 'meetingType.propertyVisit',
};

export function MeetingModal({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: MeetingPrefill | null }) {
  const { t } = useLanguage();
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({
    title: '', date: '', time: '10:00', duration: '30', type: 'in-person' as MeetingType,
    location: '', attendeeName: '', leadId: '', contactId: '', agentId: '', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      fetchLeads().then(setLeads).catch(() => {});
      fetchContacts().then(setContacts).catch(() => {});
      fetchTeamMembers().then(setMembers).catch(() => {});
      setForm((previous) => ({
        ...previous,
        title: prefill?.title ?? previous.title,
        attendeeName: prefill?.leadName ?? previous.attendeeName,
        leadId: prefill?.leadId ?? previous.leadId,
        contactId: prefill?.contactId ?? previous.contactId,
      }));
    }
  }, [open, prefill]);

  const meetingTypes = (Object.keys(typeKeys) as MeetingType[]).map((v) => ({ value: v, label: t(typeKeys[v]) }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('meetingModal.titleRequired')); return; }
    if (!form.date) { toast.error(t('meetingModal.dateRequired')); return; }
    setSaving(true);
    try {
      const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const result = await createMeeting({
        title: form.title,
        starts_at: startsAt,
        duration_minutes: Number(form.duration) || 30,
        meeting_type: form.type,
        location: form.location || undefined,
        attendee_name: form.attendeeName || undefined,
        lead_id: form.leadId || undefined,
        contact_id: form.contactId || undefined,
        assigned_agent_id: form.agentId || undefined,
        status: 'upcoming',
        notes: form.notes || undefined,
      });
      if (result) {
        toast.success(t('meetingModal.meetingCreated', { title: form.title }));
        triggerRefresh();
        onClose();
        setForm({ title: '', date: '', time: '10:00', duration: '30', type: 'in-person', location: '', attendeeName: '', leadId: '', contactId: '', agentId: '', notes: '' });
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
      title={t('meetingModal.title')}
      description={t('meetingModal.description')}
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">{t('meetingModal.schedule')}</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('common.name')} required>
            <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder={t('meetingModal.meetingTitlePlaceholder')} />
          </Field>
        </div>
        <Field label={t('common.date')} required>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" />
        </Field>
        <Field label={t('common.time')}>
          <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className="input" />
        </Field>
        <Field label={t('meetingModal.duration')}>
          <TextInput value={form.duration} onChange={(v) => set('duration', v)} placeholder={t('meetingModal.durationPlaceholder')} type="number" />
        </Field>
        <Field label={t('meetingModal.meetingType')}>
          <Select value={form.type} onChange={(v) => set('type', v as MeetingType)} options={meetingTypes} />
        </Field>
        <Field label={t('meetingModal.location')}>
          <TextInput value={form.location} onChange={(v) => set('location', v)} placeholder={t('meetingModal.locationPlaceholder')} />
        </Field>
        <Field label={t('meetingModal.attendeeName')}>
          <TextInput value={form.attendeeName} onChange={(v) => set('attendeeName', v)} placeholder={t('meetingModal.attendeePlaceholder')} />
        </Field>
        <Field label={t('meetingModal.connectLead')}>
          <Select value={form.leadId} onChange={(v) => set('leadId', v)} options={leads.map((l) => ({ value: l.id, label: `${l.first_name} ${l.last_name}`.trim() }))} placeholder={t('meetingModal.selectLead')} />
        </Field>
        <Field label={t('meetingModal.connectContact')}>
          <Select value={form.contactId} onChange={(v) => set('contactId', v)} options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`.trim() }))} placeholder={t('meetingModal.selectContact')} />
        </Field>
        <Field label={t('meetingModal.assignedAgent')}>
          <Select value={form.agentId} onChange={(v) => set('agentId', v)} options={members.map((m) => ({ value: m.id, label: m.name }))} placeholder={t('meetingModal.selectAgent')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('leads.notes')}>
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder={t('meetingModal.notesPlaceholder')} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
