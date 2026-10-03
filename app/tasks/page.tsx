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

const statusKeys: Record<TaskStatus, string> = {
  todo: 'taskStatus.todo', in_progress: 'taskStatus.inProgress', done: 'taskStatus.done',
};
const statusIcons: Record<TaskStatus, React.ElementType> = {
  todo: Circle, in_progress: Clock, done: CheckCircle2,
};
const statusColors: Record<TaskStatus, string> = {
  todo: 'text-text-muted', in_progress: 'text-gold', done: 'text-success',
};

const priorityKeys: Record<Priority, string> = {
  urgent: 'taskPriority.urgent', high: 'taskPriority.high', medium: 'taskPriority.medium', low: 'taskPriority.low',
};
const priorityVariants: Record<Priority, 'error' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'error', high: 'warning', medium: 'info', low: 'neutral',
};

/** Map a raw DB task (snake_case + nested relations) into the display shape the UI expects. */
function toDisplayTask(task: Task, unassigned: string): Task {
  return {
    ...task,
    dueDate: task.due_date ?? null,
    assignee: task.assignee?.name ?? unassigned,
    relatedType: task.related_type ?? '',
    description: task.description ?? '',
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
  const { t, locale } = useLanguage();
  const { openModal } = useGlobalModal();
  const { data, loading, error, refetch } = useSupabaseQuery<Task[]>(fetchTasks);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  // Refetch when the window regains focus so newly-created tasks (e.g. from the modal) appear.
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const tasks = (data ?? []).map((task) => toDisplayTask(task, t('common.unassigned')));

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
      toast.error(t('taskStatus.updateFailed'));
      return;
    }

    if (next === 'done') toast.success(t('taskStatus.completed', { title: current.title }));
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
          {t('taskStatus.allTasks')}
        </button>
        {columns.map((col) => (
          <button
            key={col}
            onClick={() => setFilter(col)}
            className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200', filter === col ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary')}
          >
            {t(statusKeys[col])}
          </button>
        ))}
      </div>

      {error ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
              <Circle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-text-primary">{t('taskStatus.couldntLoad')}</p>
            <p className="max-w-sm text-xs text-text-secondary">{error}</p>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm mt-1">
              {t('common.tryAgain')}
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((col) => {
            const colTasks = filter === 'all' || filter === col ? tasks.filter((t) => t.status === col) : [];
            const Icon = statusIcons[col] ?? Circle;
            const color = statusColors[col] ?? 'text-text-muted';
            return (
              <Card key={col} className="p-5" delay={columns.indexOf(col) * 0.05}>
                <div className="mb-4 flex items-center gap-2.5">
                  <Icon className={cn('h-4 w-4', color)} strokeWidth={1.5} />
                  <span className="text-sm font-medium text-text-primary">{t(statusKeys[col])}</span>
                  <Badge variant="neutral">{loading ? '…' : colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                  ) : colTasks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-text-muted">{t('taskStatus.noTasks')}</p>
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
                              <Badge variant={priorityVariants[task.priority] ?? 'neutral'}>
                                <Flag className="h-2.5 w-2.5" /> {t(priorityKeys[task.priority])}
                              </Badge>
                              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                                <Calendar className="h-3 w-3" strokeWidth={1.5} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : t('common.na')}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
                              <Avatar name={task.assignee} size="sm" color="#D4AF37" />
                              <span className="text-[11px] text-text-muted">{task.assignee.split(' ')[0]}</span>
                              <span className="ms-auto text-[11px] text-gold">{task.relatedType}</span>
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
