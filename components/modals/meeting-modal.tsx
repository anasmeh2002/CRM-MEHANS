'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal } from '@/components/forms';
import { createMeeting, fetchLeads, fetchContacts, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import type { MeetingType, Lead, Contact, TeamMember } from '@/lib/types';

const meetingTypes: { value: MeetingType; label: string }[] = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'in-person', label: 'In Person' },
  { value: 'call', label: 'Phone Call' },
  { value: 'visit', label: 'Property Visit' },
];

const calendarSyncs = ['Google Calendar', 'Outlook', 'Apple Calendar', 'None'];

export function MeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({
    title: '', date: '', time: '10:00', duration: '30', type: 'in-person' as MeetingType,
    location: '', attendeeName: '', leadId: '', contactId: '', agentId: '', calendarSync: 'Google Calendar', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      fetchLeads().then(setLeads).catch(() => {});
      fetchContacts().then(setContacts).catch(() => {});
      fetchTeamMembers().then(setMembers).catch(() => {});
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    setSaving(true);
    try {
      const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const result = await createMeeting({
        title: form.title,
        starts_at: startsAt,
        duration_minutes: Number(form.duration) || 30,
        meeting_type: form.type,
        location: form.location || undefined,
        calendar_sync: form.calendarSync,
        attendee_name: form.attendeeName || undefined,
        lead_id: form.leadId || undefined,
        contact_id: form.contactId || undefined,
        assigned_agent_id: form.agentId || undefined,
        status: 'upcoming',
        notes: form.notes || undefined,
      });
      if (result) {
        toast.success(`Meeting "${form.title}" scheduled`);
        triggerRefresh();
        onClose();
        setForm({ title: '', date: '', time: '10:00', duration: '30', type: 'in-person', location: '', attendeeName: '', leadId: '', contactId: '', agentId: '', calendarSync: 'Google Calendar', notes: '' });
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
      title="Schedule Meeting"
      description="Create a meeting and sync it to your calendar."
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">Schedule</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Penthouse Viewing — James Wilson" />
          </Field>
        </div>
        <Field label="Date" required>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" />
        </Field>
        <Field label="Time">
          <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className="input" />
        </Field>
        <Field label="Duration (minutes)">
          <TextInput value={form.duration} onChange={(v) => set('duration', v)} placeholder="30" type="number" />
        </Field>
        <Field label="Meeting Type">
          <Select value={form.type} onChange={(v) => set('type', v as MeetingType)} options={meetingTypes} />
        </Field>
        <Field label="Location">
          <TextInput value={form.location} onChange={(v) => set('location', v)} placeholder="Skyline Penthouse, Miami" />
        </Field>
        <Field label="Calendar Sync">
          <Select value={form.calendarSync} onChange={(v) => set('calendarSync', v)} options={calendarSyncs.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Attendee Name">
          <TextInput value={form.attendeeName} onChange={(v) => set('attendeeName', v)} placeholder="James Wilson" />
        </Field>
        <Field label="Connect Lead">
          <Select value={form.leadId} onChange={(v) => set('leadId', v)} options={leads.map((l) => ({ value: l.id, label: `${l.first_name} ${l.last_name}`.trim() }))} placeholder="Select lead..." />
        </Field>
        <Field label="Connect Contact">
          <Select value={form.contactId} onChange={(v) => set('contactId', v)} options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`.trim() }))} placeholder="Select contact..." />
        </Field>
        <Field label="Assigned Agent">
          <Select value={form.agentId} onChange={(v) => set('agentId', v)} options={members.map((m) => ({ value: m.id, label: m.name }))} placeholder="Select agent..." />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Confirm parking arrangements with building concierge." rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
