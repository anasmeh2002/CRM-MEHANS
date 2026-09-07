'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, DateInput, LoadingButton, Modal } from '@/components/forms';
import { createTask, fetchTeamMembers } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import type { Priority, TeamMember } from '@/lib/types';

const priorities: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({ title: '', priority: 'medium' as Priority, dueDate: '', assigneeId: '', description: '' });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) fetchTeamMembers().then(setMembers).catch(() => {});
  }, [open]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
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
        toast.success(`Task "${form.title}" created`);
        triggerRefresh();
        onClose();
        setForm({ title: '', priority: 'medium', dueDate: '', assigneeId: '', description: '' });
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
      title="New Task"
      description="Assign a task to yourself or a team member."
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">Save Task</LoadingButton>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Title" required>
          <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="e.g. Follow up with lead" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Priority">
            <Select value={form.priority} onChange={(v) => set('priority', v as Priority)} options={priorities} />
          </Field>
          <Field label="Due Date">
            <DateInput value={form.dueDate} onChange={(v) => set('dueDate', v)} />
          </Field>
        </div>
        <Field label="Assigned To">
          <Select
            value={form.assigneeId}
            onChange={(v) => set('assigneeId', v)}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
            placeholder="Select team member..."
          />
        </Field>
        <Field label="Description">
          <TextArea value={form.description} onChange={(v) => set('description', v)} placeholder="Send additional photos and schedule a viewing." rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
