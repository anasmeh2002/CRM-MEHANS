'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal } from '@/components/forms';
import { createContact } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';

const languageKeys: Record<string, string> = {
  English: 'lang.english', Spanish: 'lang.spanish', French: 'lang.french',
  Arabic: 'lang.arabic', Mandarin: 'lang.mandarin', Hindi: 'lang.hindi', Portuguese: 'lang.portuguese',
};

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', whatsapp: '', company: '', role: '', language: 'English', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const languages = Object.keys(languageKeys);
  const languageOptions = languages.map((l) => ({ value: l, label: t(languageKeys[l]) }));

  const handleSave = async () => {
    if (!form.firstName.trim()) { toast.error(t('contactModal.firstNameRequired')); return; }
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
        toast.success(t('contactModal.contactCreated', { name: `${form.firstName} ${form.lastName}`.trim() }));
        triggerRefresh();
        onClose();
        setForm({ firstName: '', lastName: '', email: '', phone: '', whatsapp: '', company: '', role: '', language: 'English', notes: '' });
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
      title={t('contactModal.title')}
      description={t('contactModal.description')}
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">{t('contactModal.saveContact')}</LoadingButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('leads.firstName')} required>
          <TextInput value={form.firstName} onChange={(v) => set('firstName', v)} placeholder="James" />
        </Field>
        <Field label={t('leads.lastName')}>
          <TextInput value={form.lastName} onChange={(v) => set('lastName', v)} placeholder="Wilson" />
        </Field>
        <Field label={t('common.email')}>
          <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="james@email.com" type="email" />
        </Field>
        <Field label={t('common.phone')}>
          <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label={t('contactModal.whatsapp')}>
          <TextInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+1 415 555 0192" type="tel" />
        </Field>
        <Field label={t('leads.language')}>
          <Select value={form.language} onChange={(v) => set('language', v)} options={languageOptions} />
        </Field>
        <Field label={t('contactModal.company')}>
          <TextInput value={form.company} onChange={(v) => set('company', v)} placeholder="Wilson Holdings" />
        </Field>
        <Field label={t('common.role')}>
          <TextInput value={form.role} onChange={(v) => set('role', v)} placeholder="CEO" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('leads.notes')}>
            <TextArea value={form.notes} onChange={(v) => set('notes', v)} placeholder={t('contactModal.notesPlaceholder')} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
