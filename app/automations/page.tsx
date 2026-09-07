'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap, Mail, MessageCircle, Calendar, Bell, Clock, Loader2, Activity, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge } from '@/components/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import {
  fetchAutomations, toggleAutomation, createAutomation, deleteAutomation,
  fetchExecutions, type Automation, type AutomationExecution,
} from '@/lib/automations';

const actionIcons: Record<string, React.ElementType> = {
  create_lead: Zap,
  create_task: Bell,
  send_whatsapp: MessageCircle,
  send_notification: Bell,
  send_email_report: Mail,
  ai_summarize: Activity,
  ai_qualify_lead: Activity,
  ai_follow_up: Activity,
};

const actionColors: Record<string, string> = {
  create_lead: '#5BAA6F',
  create_task: '#D4823A',
  send_whatsapp: '#25D366',
  send_notification: '#4080B8',
  send_email_report: '#B84848',
  ai_summarize: '#D4AF37',
  ai_qualify_lead: '#D4AF37',
  ai_follow_up: '#D4AF37',
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-success', label: 'Success' },
  error: { icon: XCircle, color: 'text-error', label: 'Error' },
  pending: { icon: Loader2, color: 'text-info', label: 'Pending' },
  skipped: { icon: AlertCircle, color: 'text-text-muted', label: 'Skipped' },
};

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AutomationsPage() {
  const { t } = useLanguage();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [autos, execs] = await Promise.all([fetchAutomations(), fetchExecutions(10)]);
      setAutomations(autos);
      setExecutions(execs);
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (auto: Automation) => {
    setToggling(auto.id);
    try {
      await toggleAutomation(auto.id, !auto.enabled);
      setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, enabled: !a.enabled } : a));
      toast.success(`${auto.name} ${auto.enabled ? 'paused' : 'activated'}`);
    } catch {
      toast.error('Failed to update automation');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast.success('Automation deleted');
    } catch {
      toast.error('Failed to delete automation');
    }
  };

  const activeCount = automations.filter((a) => a.enabled).length;
  const totalRuns = automations.reduce((sum, a) => sum + (a.execution_count ?? 0), 0);

  return (
    <AppShell>
      <PageHeader title={t('page.automations')} description={t('page.automationsDescription')}>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New Automation
        </button>
      </PageHeader>

      <AnimatePresence>
        {showCreate && (
          <CreateAutomationCard
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); loadData(); }}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <Card><div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {automations.map((auto, i) => {
            const Icon = actionIcons[auto.action_type] ?? Zap;
            const color = actionColors[auto.action_type] ?? '#D4AF37';
            return (
              <motion.div
                key={auto.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className={cn('transition-all', auto.enabled ? 'border-gold-border' : 'opacity-60')}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15`, color }}>
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-text-primary">{auto.name}</p>
                        <p className="text-[12px] text-text-secondary">{auto.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(auto)}
                      disabled={toggling === auto.id}
                      className={cn('relative h-6 w-11 rounded-full transition-colors duration-200', auto.enabled ? 'bg-gold' : 'bg-bg-active border border-border')}
                    >
                      <motion.div
                        layout
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                        animate={{ left: auto.enabled ? 22 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                    <Badge variant="neutral">Trigger: {auto.trigger_event}</Badge>
                    <Badge variant="gold">Action: {auto.action_type}</Badge>
                    <span className="ml-auto text-[12px] text-text-muted">{auto.execution_count ?? 0} runs</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">
                      Last: {formatTimeAgo(auto.last_execution_at)}
                      {auto.last_execution_status && (
                        <span className={cn('ml-1.5 font-medium', auto.last_execution_status === 'success' ? 'text-success' : auto.last_execution_status === 'error' ? 'text-error' : 'text-text-muted')}>
                          {auto.last_execution_status}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleDelete(auto.id)}
                      className="text-[11px] text-text-muted transition-colors hover:text-error"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {executions.length > 0 && (
        <Card className="mt-4" delay={0.2}>
          <div className="mb-5 flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-gold" strokeWidth={1.5} />
            <h3 className="font-serif text-lg font-medium text-text-primary">Recent Executions</h3>
          </div>
          <div className="space-y-2">
            {executions.map((exec) => {
              const cfg = statusConfig[exec.status] ?? statusConfig.pending;
              const StatusIcon = cfg.icon;
              const auto = automations.find((a) => a.id === exec.automation_id);
              return (
                <div key={exec.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3">
                  <StatusIcon className={cn('h-4 w-4 shrink-0', cfg.color, exec.status === 'pending' && 'animate-spin')} strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-text-primary">{auto?.name ?? exec.event_type}</p>
                    <p className="text-[11px] text-text-muted">{formatTimeAgo(exec.started_at)}</p>
                  </div>
                  <Badge variant={exec.status === 'success' ? 'success' : exec.status === 'error' ? 'error' : 'neutral'}>
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </AppShell>
  );
}

function CreateAutomationCard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('whatsapp.new_conversation');
  const [action, setAction] = useState('create_lead');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Please enter a name'); return; }
    setSaving(true);
    try {
      await createAutomation({ name, trigger_event: trigger, action_type: action });
      toast.success('Automation created');
      onCreated();
    } catch {
      toast.error('Failed to create automation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <Card className="mb-4">
        <h3 className="mb-4 font-serif text-lg font-medium text-text-primary">New Automation</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Name</label>
            <input className="input w-full" placeholder="e.g. New Lead WhatsApp Alert" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">When (Trigger)</label>
              <select className="input w-full" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {[
                  { value: 'whatsapp.new_message', label: 'New WhatsApp Message' },
                  { value: 'whatsapp.new_conversation', label: 'New WhatsApp Conversation' },
                  { value: 'lead.created', label: 'Lead Created' },
                  { value: 'lead.inactive', label: 'Lead Inactive (48h)' },
                  { value: 'deal.won', label: 'Deal Won' },
                  { value: 'meeting.created', label: 'Appointment Created' },
                  { value: 'property.match', label: 'Property Matches Lead' },
                ].map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Then (Action)</label>
              <select className="input w-full" value={action} onChange={(e) => setAction(e.target.value)}>
                {[
                  { value: 'create_lead', label: 'Create/Update Lead' },
                  { value: 'create_task', label: 'Create Follow-up Task' },
                  { value: 'send_whatsapp', label: 'Send WhatsApp Message' },
                  { value: 'send_notification', label: 'Send Notification' },
                  { value: 'ai_summarize', label: 'AI Summarize Conversation' },
                  { value: 'ai_qualify_lead', label: 'AI Qualify Lead' },
                ].map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn btn-gold btn-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
