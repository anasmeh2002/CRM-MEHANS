'use client';


import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Phone, Video, MapPin, Users, Clock, CheckCircle2, XCircle, Bell, MessageCircle, CalendarClock } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge } from '@/components/shared';
import { useGlobalModal } from '@/components/modal-provider';
import { fetchMeetings, updateMeeting } from '@/lib/data';
import { dispatchAutomationEvent } from '@/lib/automations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Meeting } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

const meetingTypeIcons: Record<string, React.ElementType> = {
  call: Phone,
  visit: MapPin,
  video: Video,
  'in-person': Users,
};

const meetingColors: Record<string, string> = {
  call: 'border-info/40 text-info bg-info-bg',
  visit: 'border-gold-border text-gold bg-gold-bg',
  video: 'border-[#9B6FBF]/40 text-[#9B6FBF] bg-[#9B6FBF]/10',
  'in-person': 'border-success/40 text-success bg-success-bg',
};

function mapMeeting(m: Meeting, locale: string) {
  const startsAt = m.starts_at ? new Date(m.starts_at) : null;
  return {
    id: m.id,
    title: m.title,
    date: startsAt ? startsAt.toISOString().slice(0, 10) : '',
    time: startsAt ? startsAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    duration: m.duration_minutes ?? m.duration ?? 0,
    type: m.meeting_type ?? m.type ?? '',
    attendee: m.attendee_name ?? m.attendee ?? 'TBD',
    location: m.location ?? '',
    status: m.status ?? 'upcoming',
  };
}

function MeetingSkeleton() {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl border border-border bg-bg-elevated" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-border" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
        </div>
      </div>
    </Card>
  );
}

export default function MeetingsPage() {
  const { t, locale } = useLanguage();
  const { openModal } = useGlobalModal();
  const { data, loading, error, refetch } = useSupabaseQuery<Meeting[]>(fetchMeetings);

  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const meetings = (data ?? []).map((m) => mapMeeting(m, locale));
  const upcoming = meetings.filter((m) => ['pending', 'confirmed', 'upcoming', 'rescheduled'].includes(m.status)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completed = meetings.filter((m) => m.status === 'completed');

  const handleComplete = async (id: string, title: string) => {
    const updated = await updateMeeting(id, { status: 'completed' });
    if (updated) {
      toast.success(t('toast.meetingCompleted', { title }));
      refetch();
    } else {
      toast.error(t('toast.meetingStatusFailed'));
    }
  };

  const handleConfirm = async (id: string, title: string) => {
    const updated = await updateMeeting(id, { status: 'confirmed' });
    if (updated) {
      toast.success(t('toast.meetingConfirmed', { title }));
      refetch();
    } else toast.error(t('toast.meetingConfirmFailed'));
  };

  const handleReschedule = async (meeting: typeof upcoming[number]) => {
    const nextDate = window.prompt(t('calendar.reschedulePrompt'));
    if (!nextDate) return;
    const parsed = new Date(nextDate.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) {
      toast.error(t('toast.meetingInvalidDateTime'));
      return;
    }
    const updated = await updateMeeting(meeting.id, { starts_at: parsed.toISOString(), status: 'rescheduled' });
    if (updated) {
      toast.success(t('toast.meetingRescheduled', { title: meeting.title }));
      refetch();
    } else toast.error(t('toast.meetingRescheduleFailed'));
  };

  const handleCancel = async (id: string, title: string) => {
    const updated = await updateMeeting(id, { status: 'cancelled' });
    if (updated) {
      toast.success(t('toast.meetingCancelled', { title }));
      refetch();
    } else {
      toast.error(t('toast.meetingCancelFailed'));
    }
  };

  const handleReminder = async (meeting: typeof upcoming[number]) => {
    try {
      await dispatchAutomationEvent('meeting.reminder', {
        meeting_id: meeting.id,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        attendee: meeting.attendee,
      });
      toast.success(t('toast.meetingReminderSent', { title: meeting.title }));
    } catch {
      toast.error(t('toast.meetingReminderFailed'));
    }
  };

  const handleWhatsAppAlert = async (meeting: typeof upcoming[number]) => {
    try {
      await dispatchAutomationEvent('meeting.whatsapp_alert', {
        meeting_id: meeting.id,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        attendee: meeting.attendee,
      });
      toast.success(t('toast.meetingWhatsappSent', { title: meeting.title }));
    } catch {
      toast.error(t('toast.meetingWhatsappFailed'));
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('page.meetings')} description={t('page.meetingsDescription')}>
        <button onClick={() => openModal('meeting')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('calendar.newMeeting')}
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-serif text-lg font-medium text-text-primary">{t('calendar.upcoming')}</h3>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <MeetingSkeleton key={i} />)}
            </div>
          ) : error ? (
            <Card>
              <p className="text-sm text-danger">{error}</p>
            </Card>
          ) : upcoming.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted">{t('calendar.noUpcoming')}</p>
            </Card>
          ) : (
            upcoming.map((meeting, i) => {
              const Icon = meetingTypeIcons[meeting.type] || Clock;
              const colorClass = safeConfig(meetingColors, meeting.type, 'border-border text-text-muted bg-bg-elevated');
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card hover>
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg-elevated">
                        <span className="text-[10px] font-medium text-text-muted">
                          {meeting.date ? new Date(meeting.date).toLocaleDateString(locale, { month: 'short' }).toUpperCase() : '—'}
                        </span>
                        <span className="font-serif text-xl font-medium text-text-primary">{meeting.date ? new Date(meeting.date).getDate() : '—'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{meeting.title}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{meeting.time} · {meeting.duration}min</p>
                          </div>
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', colorClass)}>
                            <Icon className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-text-secondary">
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> {meeting.location}</span>
                          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" strokeWidth={1.5} /> {meeting.attendee}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                          {meeting.status !== 'confirmed' && <button
                            onClick={() => handleConfirm(meeting.id, meeting.title)}
                            className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success-bg px-2.5 py-1.5 text-[11px] font-medium text-success transition-colors hover:border-success/50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('calendar.confirm')}
                          </button>}
                          <button
                            onClick={() => handleReschedule(meeting)}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-gold-border hover:text-gold"
                          >
                            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('calendar.reschedule')}
                          </button>
                          <button
                            onClick={() => handleReminder(meeting)}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-gold-border hover:text-gold"
                          >
                            <Bell className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('calendar.remind')}
                          </button>
                          <button
                            onClick={() => handleWhatsAppAlert(meeting)}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-success/40 hover:text-success"
                          >
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('page.whatsapp')}
                          </button>
                          <button
                            onClick={() => handleComplete(meeting.id, meeting.title)}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-success/40 hover:text-success"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('calendar.complete')}
                          </button>
                          <button
                            onClick={() => handleCancel(meeting.id, meeting.title)}
                            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-error/40 hover:text-error"
                          >
                            <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('calendar.cancel')}
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={meeting.status === 'confirmed' ? 'success' : meeting.status === 'rescheduled' ? 'gold' : 'neutral'}>{t(`meeting.status.${meeting.status}`)}</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-serif text-lg font-medium text-text-primary">{t('calendar.completed')}</h3>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => <MeetingSkeleton key={i} />)}
            </div>
          ) : error ? (
            <Card>
              <p className="text-sm text-danger">{error}</p>
            </Card>
          ) : completed.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted">{t('calendar.noCompleted')}</p>
            </Card>
          ) : (
            completed.map((meeting, i) => {
              const Icon = meetingTypeIcons[meeting.type] || Clock;
              const colorClass = safeConfig(meetingColors, meeting.type, 'border-border text-text-muted bg-bg-elevated');
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg-elevated">
                        <span className="text-[9px] font-medium text-text-muted">
                          {meeting.date ? new Date(meeting.date).toLocaleDateString(locale, { month: 'short' }).toUpperCase() : '—'}
                        </span>
                        <span className="text-sm font-bold text-text-primary">{meeting.date ? new Date(meeting.date).getDate() : '—'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{meeting.title}</p>
                        <p className="text-xs text-text-muted">{meeting.time} · {meeting.duration}min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="success">{t('calendar.completedBadge')}</Badge>
                        <button
                          onClick={() => handleWhatsAppAlert(meeting)}
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-secondary hover:border-gold-border hover:text-gold"
                        >
                          <MessageCircle className="h-3 w-3" strokeWidth={1.5} /> {t('calendar.followUp')}
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
