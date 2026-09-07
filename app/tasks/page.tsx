'use client';


import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, CheckCircle2, Circle, Clock, Flag, Calendar } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar } from '@/components/shared';
import { useGlobalModal } from '@/components/modal-provider';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { fetchTasks, updateTask } from '@/lib/data';
import type { Task, TaskStatus, Priority } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  todo: { label: 'To Do', icon: Circle, color: 'text-text-muted' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-gold' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-success' },
};

const priorityConfig: Record<Priority, { label: string; variant: 'error' | 'warning' | 'info' | 'neutral' }> = {
  urgent: { label: 'Urgent', variant: 'error' },
  high: { label: 'High', variant: 'warning' },
  medium: { label: 'Medium', variant: 'info' },
  low: { label: 'Low', variant: 'neutral' },
};

/** Map a raw DB task (snake_case + nested relations) into the display shape the UI expects. */
function toDisplayTask(t: Task): Task {
  return {
    ...t,
    dueDate: t.due_date ?? 'N/A',
    assignee: t.assignee?.name ?? 'Unassigned',
    relatedType: t.related_type ?? '',
    description: t.description ?? '',
  };
}

function TaskSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-border" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-border" />
          <div className="h-3 w-full animate-pulse rounded bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-14 animate-pulse rounded bg-border" />
            <div className="h-3 w-16 animate-pulse rounded bg-border" />
          </div>
          <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
            <div className="h-5 w-5 animate-pulse rounded-full bg-border" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-border" />
            <div className="ml-auto h-2.5 w-12 animate-pulse rounded bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { t } = useLanguage();
  const { openModal } = useGlobalModal();
  const { data, loading, error, refetch } = useSupabaseQuery<Task[]>(fetchTasks);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  // Refetch when the window regains focus so newly-created tasks (e.g. from the modal) appear.
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const tasks = (data ?? []).map(toDisplayTask);

  const toggleStatus = async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const next: TaskStatus =
      current.status === 'done' ? 'todo' : current.status === 'todo' ? 'in_progress' : 'done';

    const updated = await updateTask(id, {
      status: next,
      completed_at: next === 'done' ? new Date().toISOString() : null,
    });

    if (!updated) {
      toast.error('Failed to update task. Please try again.');
      return;
    }

    if (next === 'done') toast.success(`Task "${current.title}" completed`);
    refetch();
  };

  const columns: TaskStatus[] = ['todo', 'in_progress', 'done'];

  return (
    <AppShell>
      <PageHeader title={t('page.tasks')} description={t('page.tasksDescription')}>
        <button onClick={() => openModal('task')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('navbar.newTask')}
        </button>
      </PageHeader>

      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200', filter === 'all' ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary')}
        >
          All Tasks
        </button>
        {columns.map((col) => (
          <button
            key={col}
            onClick={() => setFilter(col)}
            className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200', filter === col ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary')}
          >
            {safeConfig(statusConfig, col, { label: col, icon: Circle, color: 'text-text-muted' }).label}
          </button>
        ))}
      </div>

      {error ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
              <Circle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-text-primary">Couldn&apos;t load tasks</p>
            <p className="max-w-sm text-xs text-text-secondary">{error}</p>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm mt-1">
              Try again
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((col) => {
            const colTasks = filter === 'all' || filter === col ? tasks.filter((t) => t.status === col) : [];
            const config = safeConfig(statusConfig, col, { label: col, icon: Circle, color: 'text-text-muted' });
            const Icon = config.icon;
            return (
              <Card key={col} className="p-5" delay={columns.indexOf(col) * 0.05}>
                <div className="mb-4 flex items-center gap-2.5">
                  <Icon className={cn('h-4 w-4', config.color)} strokeWidth={1.5} />
                  <span className="text-sm font-medium text-text-primary">{config.label}</span>
                  <Badge variant="neutral">{loading ? '…' : colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                  ) : colTasks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-text-muted">No tasks</p>
                  ) : (
                    colTasks.map((task, i) => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-xl border border-border bg-bg-secondary p-3.5 transition-colors hover:border-border-strong"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => toggleStatus(task.id)}
                            className={cn('mt-0.5 shrink-0 transition-colors', task.status === 'done' ? 'text-success' : 'text-text-muted hover:text-gold')}
                          >
                            {task.status === 'done' ? <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} /> : <Circle className="h-5 w-5" strokeWidth={1.5} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium text-text-primary', task.status === 'done' && 'line-through opacity-50')}>{task.title}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{task.description}</p>
                            <div className="mt-2.5 flex items-center gap-2">
                              <Badge variant={safeConfig(priorityConfig, task.priority, { label: 'Medium', variant: 'neutral' as const }).variant}>
                                <Flag className="h-2.5 w-2.5" /> {safeConfig(priorityConfig, task.priority, { label: 'Medium', variant: 'neutral' as const }).label}
                              </Badge>
                              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                                <Calendar className="h-3 w-3" strokeWidth={1.5} /> {task.dueDate !== 'N/A' ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
                              <Avatar name={task.assignee} size="sm" color="#D4AF37" />
                              <span className="text-[11px] text-text-muted">{task.assignee.split(' ')[0]}</span>
                              <span className="ml-auto text-[11px] text-gold">{task.relatedType}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
