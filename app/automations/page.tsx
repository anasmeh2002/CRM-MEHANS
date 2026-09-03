'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Mail, MessageCircle, Calendar, Bell, Clock } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge } from '@/components/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const automations = [
  { id: 'a1', name: 'New Lead Auto-Response', description: 'Send WhatsApp message within 5 minutes of lead creation', trigger: 'Lead Created', action: 'Send WhatsApp', active: true, runs: 142, icon: MessageCircle, color: '#5BAA6F' },
  { id: 'a2', name: 'Lead Score Update', description: 'AI recalculates lead score every 24h based on activity', trigger: 'Daily', action: 'AI Score Update', active: true, runs: 1240, icon: Zap, color: '#D4AF37' },
  { id: 'a3', name: 'Follow-up Reminder', description: 'Notify agent if no contact with lead for 48h', trigger: 'No Activity 48h', action: 'Send Notification', active: true, runs: 86, icon: Bell, color: '#D4823A' },
  { id: 'a4', name: 'Deal Won Celebration', description: 'Send congratulatory email and request referral on deal won', trigger: 'Deal Won', action: 'Send Email', active: true, runs: 18, icon: Mail, color: '#4080B8' },
  { id: 'a5', name: 'Property Visit Reminder', description: 'Send calendar invite and property details 24h before visit', trigger: 'Visit Scheduled', action: 'Send Calendar Invite', active: false, runs: 34, icon: Calendar, color: '#9B6FBF' },
  { id: 'a6', name: 'Weekly Pipeline Report', description: 'Email weekly pipeline summary to team every Monday at 9 AM', trigger: 'Weekly Monday', action: 'Send Email Report', active: true, runs: 32, icon: Clock, color: '#B84848' },
];

const templates = [
  { id: 't1', name: 'Welcome New Lead', category: 'Onboarding', steps: 3 },
  { id: 't2', name: 'Nurture Sequence', category: 'Engagement', steps: 5 },
  { id: 't3', name: 'Re-engagement Campaign', category: 'Retention', steps: 4 },
  { id: 't4', name: 'Post-Close Follow-up', category: 'Retention', steps: 3 },
];

export default function AutomationsPage() {
  const [autoState, setAutoState] = useState(automations);

  const toggleAutomation = (id: string) => {
    setAutoState((prev) => prev.map((a) => a.id === id ? { ...a, active: !a.active } : a));
    const auto = automations.find((a) => a.id === id);
    toast.success(`${auto?.name} ${autoState.find((a) => a.id === id)?.active ? 'paused' : 'activated'}`);
  };

  return (
    <AppShell>
      <PageHeader title="Automations" description={`${autoState.filter((a) => a.active).length} active automations · ${autoState.reduce((sum, a) => sum + a.runs, 0)} total runs`}>
        <button onClick={() => toast.success('Automation builder opened')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New Automation
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        {autoState.map((auto, i) => {
          const Icon = auto.icon;
          return (
            <motion.div
              key={auto.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className={cn('transition-all', auto.active ? 'border-gold-border' : 'opacity-60')}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${auto.color}15`, color: auto.color }}>
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-text-primary">{auto.name}</p>
                      <p className="text-[12px] text-text-secondary">{auto.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAutomation(auto.id)}
                    className={cn('relative h-6 w-11 rounded-full transition-colors duration-200', auto.active ? 'bg-gold' : 'bg-bg-active border border-border')}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                      animate={{ left: auto.active ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                  <Badge variant="neutral">Trigger: {auto.trigger}</Badge>
                  <Badge variant="gold">Action: {auto.action}</Badge>
                  <span className="ml-auto text-[12px] text-text-muted">{auto.runs} runs</span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="mt-4" delay={0.2}>
        <div className="mb-5 flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <h3 className="font-serif text-lg font-medium text-text-primary">Automation Templates</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => toast.success(`Template "${template.name}" selected`)}
              className="cursor-pointer rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:border-gold-border"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-bg text-gold">
                <Zap className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-text-primary">{template.name}</p>
              <p className="text-[12px] text-text-muted">{template.category}</p>
              <p className="mt-1 text-[11px] text-gold">{template.steps} steps</p>
            </motion.div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
