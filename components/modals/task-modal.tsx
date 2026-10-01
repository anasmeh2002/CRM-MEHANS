'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, DateInput, LoadingButton, Modal } from '@/components/forms';
import { createTask, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';
import type { Priority, TeamMember } from '@/lib/types';

const priorityKeys: Record<Priority, string> = {
  low: 'taskPriority.low', medium: 'taskPriority.medium', high: 'taskPriority.high', urgent: 'taskPriority.urgent',
};

export function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({ title: '', priority: 'medium' as Priority, dueDate: '', assigneeId: '', description: '' });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) fetchTeamMembers().then(setMembers).catch(() => {});
  }, [open]);

  const priorities = (Object.keys(priorityKeys) as Priority[]).map((v) => ({ value: v, label: t(priorityKeys[v]) }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('taskModal.titleRequired')); return; }
    setSaving(true);
    try {
      const result = await createTask({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        due_date: form.dueDate || undefined,
        assignee_id: form.assigneeId || undefined,
        status: 'todo',
      });
      if (result) {
        toast.success(t('taskModal.taskCreated', { title: form.title }));
        triggerRefresh();
        onClose();
        setForm({ title: '', priority: 'medium', dueDate: '', assigneeId: '', description: '' });
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
      title={t('taskModal.title')}
      description={t('taskModal.description')}
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">{t('taskModal.saveTask')}</LoadingButton>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t('common.name')} required>
          <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder={t('taskModal.taskTitlePlaceholder')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('common.priority')}>
            <Select value={form.priority} onChange={(v) => set('priority', v as Priority)} options={priorities} />
          </Field>
          <Field label={t('taskModal.dueDate')}>
            <DateInput value={form.dueDate} onChange={(v) => set('dueDate', v)} />
          </Field>
        </div>
        <Field label={t('taskModal.assignedTo')}>
          <Select
            value={form.assigneeId}
            onChange={(v) => set('assigneeId', v)}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
            placeholder={t('taskModal.selectTeamMember')}
          />
        </Field>
        <Field label={t('propertyModal.description')}>
          <TextArea value={form.description} onChange={(v) => set('description', v)} placeholder={t('taskModal.descriptionPlaceholder')} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
