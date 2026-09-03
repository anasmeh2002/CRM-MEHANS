'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal } from '@/components/forms';
import { createContact } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';

const languages = ['English', 'Spanish', 'French', 'Arabic', 'Mandarin', 'Hindi', 'Portuguese'];

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', whatsapp: '', company: '', role: '', language: 'English', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const result = await createContact({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        company: form.company || undefined,
        role: form.role || undefined,
        language: form.language,
        notes: form.notes || undefined,
      });
      if (result) {
        toast.success(`Contact ${form.firstName} ${form.lastName} created`);
        triggerRefresh();
        onClose();
        setForm({ firstName: '', lastName: '', email: '', phone: '', whatsapp: '', company: '', role: '', language: 'English', notes: '' });
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
      title="New Contact"
      description="Add a person or client to your CRM."
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">Save Contact</LoadingButton>
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
        <Field label="Email">
          <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="james@email.com" type="email" />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label="WhatsApp">
          <TextInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label="Language">
          <Select value={form.language} onChange={(v) => set('language', v)} options={languages.map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label="Company">
          <TextInput value={form.company} onChange={(v) => set('company', v)} placeholder="Wilson Holdings" />
        </Field>
        <Field label="Role">
          <TextInput value={form.role} onChange={(v) => set('role', v)} placeholder="CEO" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Key decision maker for luxury acquisitions." rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
