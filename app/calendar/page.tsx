'use client';


import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Phone, Video, MapPin, Users, Clock, CalendarX, AlertCircle, RefreshCw, CalendarCheck, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Skeleton, EmptyState } from '@/components/shared';
import { useGlobalModal } from '@/components/modal-provider';
import { fetchMeetings } from '@/lib/data';
import { dispatchAutomationEvent } from '@/lib/automations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Meeting } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const meetingTypeIcons: Record<string, React.ElementType> = {
  call: Phone,
  visit: MapPin,
  video: Video,
  'in-person': Users,
  google_meet: Video,
  zoom: Video,
};

const meetingColors: Record<string, string> = {
  call: 'border-info/40 text-info bg-info-bg',
  visit: 'border-gold-border text-gold bg-gold-bg',
  video: 'border-[#9B6FBF]/40 text-[#9B6FBF] bg-[#9B6FBF]/10',
  'in-person': 'border-success/40 text-success bg-success-bg',
  google_meet: 'border-[#9B6FBF]/40 text-[#9B6FBF] bg-[#9B6FBF]/10',
  zoom: 'border-[#9B6FBF]/40 text-[#9B6FBF] bg-[#9B6FBF]/10',
};

/** Map a raw DB Meeting row to the display shape the calendar UI expects. */
function toDisplayMeeting(m: Meeting) {
  const startsAt = m.starts_at ? new Date(m.starts_at) : null;
  const date = startsAt ? `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}` : '';
  const time = startsAt
    ? `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`
    : '';
  const duration = m.duration_minutes ?? m.duration ?? 0;
  const type = m.meeting_type ?? m.type ?? '';
  const attendee = m.attendee_name ?? m.attendee ?? 'TBD';
  const location = m.location ?? '';
  const status = m.status ?? 'upcoming';
  return { ...m, date, time, duration, type, attendee, location, status };
}

export default function CalendarPage() {
  const { openModal } = useGlobalModal();
  const { session } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1));
  const [syncing, setSyncing] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data, loading, error, refetch } = useSupabaseQuery(fetchMeetings);

  // Check Google Calendar connection status (RLS filters by agency automatically)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: row } = await supabase
          .from('integrations')
          .select('connected')
          .eq('service', 'Google Calendar')
          .maybeSingle();
        if (active) setCalendarConnected(row?.connected ?? false);
      } catch {
        if (active) setCalendarConnected(false);
      }
    })();
    return () => { active = false; };
  }, [session?.user?.id]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch Google Calendar events when connected
  const fetchGoogleEvents = async () => {
    if (!calendarConnected) return;
    setGoogleLoading(true);
    try {
      const timeMin = new Date(year, 0, 1).toISOString();
      const timeMax = new Date(year, 11, 31).toISOString();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGoogleEvents(data.events ?? []);
      } else {
        setGoogleEvents([]);
      }
    } catch {
      setGoogleEvents([]);
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (calendarConnected) fetchGoogleEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarConnected, year, session?.access_token]);

  // Check URL params for sync result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sync_success') === 'true') {
      toast.success('Google Calendar connected successfully!');
      setCalendarConnected(true);
      window.history.replaceState({}, '', '/calendar');
    }
    const syncError = params.get('sync_error');
    if (syncError) {
      const errorMsg = decodeURIComponent(syncError);
      console.error('[calendar] sync error from callback:', errorMsg);
      toast.error(`Calendar sync failed: ${errorMsg}`);
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  // Refetch when the window regains focus so stale meetings don't linger.
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  // Default to [] while loading/null and map DB rows to the display shape.
  const dbMeetings = useMemo(
    () => (data ?? []).map(toDisplayMeeting),
    [data],
  );

  // Map Google Calendar events to the same display shape
  const googleMeetings = useMemo(
    () => googleEvents.map((e) => {
      const startsAt = e.starts_at ? new Date(e.starts_at) : null;
      return {
        id: e.id,
        title: e.title,
        date: startsAt ? `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}` : '',
        time: startsAt ? `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}` : '',
        duration: e.ends_at ? Math.round((new Date(e.ends_at).getTime() - startsAt!.getTime()) / 60000) : 30,
        type: 'google_meet',
        attendee: e.attendee || 'TBD',
        location: e.location || '',
        status: 'upcoming',
        source: 'google',
      };
    }),
    [googleEvents],
  );

  // Merge DB meetings with Google events, deduplicating by title+date
  const meetings = useMemo(() => {
    const merged = [...dbMeetings, ...googleMeetings];
    const seen = new Set<string>();
    return merged.filter((m) => {
      const key = `${m.title}-${m.date}-${m.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')).getTime() - new Date(b.date + 'T' + (b.time || '00:00')).getTime());
  }, [dbMeetings, googleMeetings]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; current: boolean; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, current: true, date: new Date(year, month, i) });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false, date: new Date(year, month + 1, i) });
  }

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getMeetingsForDay = (date: Date) => {
    const key = dateKey(date);
    return meetings.filter((m) => m.date === key);
  };

  const today = new Date();
  const todayKey = dateKey(today);
  const isToday = (date: Date) => dateKey(date) === todayKey;
  const upcomingMeetings = meetings
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <AppShell>
      <PageHeader title="Calendar" description="Schedule and manage your meetings">
        <div className="flex items-center gap-2">
          {calendarConnected ? (
            <button
              onClick={async () => {
                setSyncing(true);
                try {
                  await dispatchAutomationEvent('calendar.sync_requested', { timestamp: new Date().toISOString() });
                  await fetchGoogleEvents();
                  toast.success('Calendar synced with Google Calendar events.');
                } catch {
                  toast.error('Failed to trigger sync.');
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
              className="btn btn-md border border-success/40 bg-success-bg text-success hover:bg-success/10"
            >
              {syncing ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <CalendarCheck className="h-4 w-4" strokeWidth={1.5} />}
              {syncing ? 'Syncing...' : 'Calendar Connected'}
            </button>
          ) : (
            <button
              onClick={async () => {
                const headers: Record<string, string> = {};
                if (session?.access_token) {
                  headers['Authorization'] = `Bearer ${session.access_token}`;
                }
                // Fetch the auth URL from the server with the user token,
                // then redirect. This keeps the token out of the URL bar.
                try {
                  const res = await fetch('/api/calendar/auth', { headers });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                      return;
                    }
                  }
                  // Fallback: direct redirect (tokenless, shared connection)
                  window.location.href = '/api/calendar/auth';
                } catch {
                  window.location.href = '/api/calendar/auth';
                }
              }}
              className="btn btn-outline btn-md"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
              Sync with Google Calendar
            </button>
          )}
          <button onClick={() => openModal('meeting')} className="btn btn-gold btn-md">
            <Plus className="h-4 w-4" strokeWidth={1.5} /> New Meeting
          </button>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-3 sm:p-5" delay={0.1}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-serif text-base sm:text-xl font-medium text-text-primary">{monthNames[month]} {year}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold-bg">
                Today
              </button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="min-h-[60px] sm:min-h-[80px] rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-error/30 bg-error/10 text-error">
                <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-serif text-lg font-medium text-text-primary">Couldn't load meetings</p>
                <p className="mt-1 text-sm text-text-muted">{error}</p>
              </div>
              <button onClick={() => refetch()} className="btn btn-ghost btn-sm mt-1">Try again</button>
            </div>
          ) : (
            <>
              {/* Day headers - short on mobile, full on desktop */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => (
                  <div key={day} className="pb-2 text-center text-[10px] sm:text-xs font-medium text-text-muted">
                    <span className="sm:hidden">{daysShort[i]}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  const dayMeetings = getMeetingsForDay(cell.date);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(cell.date)}
                      className={cn(
                        'min-h-[56px] sm:min-h-[80px] rounded-xl border p-1 sm:p-1.5 transition-colors text-left',
                        cell.current ? 'border-border bg-bg-secondary' : 'border-transparent bg-bg-elevated/30',
                        isToday(cell.date) && 'border-gold-border bg-gold-bg',
                        selectedDay && dateKey(selectedDay) === dateKey(cell.date) && 'ring-1 ring-gold'
                      )}
                    >
                      <span className={cn('text-[10px] sm:text-xs font-medium', cell.current ? 'text-text-primary' : 'text-text-muted/50', isToday(cell.date) && 'text-gold')}>
                        {cell.day}
                      </span>
                      <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                        {/* Desktop: show event chips */}
                        <div className="hidden sm:block space-y-1">
                          {dayMeetings.slice(0, 2).map((m) => {
                            const Icon = meetingTypeIcons[m.type] || Clock;
                            return (
                              <div key={m.id} className={cn('flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium', safeConfig(meetingColors, m.type, 'border-border text-text-muted bg-bg-elevated'))}>
                                <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
                                <span className="truncate">{m.time} {m.attendee.split(' ')[0]}</span>
                              </div>
                            );
                          })}
                          {dayMeetings.length > 2 && <p className="text-[10px] text-text-muted">+{dayMeetings.length - 2} more</p>}
                        </div>
                        {/* Mobile: show dots only */}
                        <div className="flex sm:hidden flex-wrap gap-0.5">
                          {dayMeetings.slice(0, 3).map((m) => (
                            <span key={m.id} className={cn('h-1.5 w-1.5 rounded-full', safeConfig(meetingColors, m.type, 'bg-text-muted').replace(/border-\S+/, '').replace(/text-\S+/, '').replace(/bg-\S+/, '') || 'bg-gold')} />
                          ))}
                          {dayMeetings.length > 3 && <span className="text-[8px] text-text-muted">+{dayMeetings.length - 3}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card delay={0.15}>
          <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">Upcoming Meetings</h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-text-muted">Unable to load upcoming meetings.</div>
          ) : upcomingMeetings.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="No upcoming meetings"
              description="Schedule a new meeting to see it here."
            />
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map((meeting, i) => {
                const Icon = meetingTypeIcons[meeting.type] || Clock;
                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border p-3 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg-elevated">
                        <span className="text-[9px] font-medium text-text-muted">
                          {new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-text-primary">{parseInt(meeting.date.slice(8), 10)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{meeting.title}</p>
                        <p className="text-xs text-text-muted">{meeting.time} · {meeting.duration}min</p>
                        <p className="mt-1 truncate text-[11px] text-text-muted">{meeting.location}</p>
                      </div>
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', safeConfig(meetingColors, meeting.type, 'border-border text-text-muted bg-bg-elevated'))}>
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Mobile day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-5 lg:hidden" onClick={() => setSelectedDay(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-bg-elevated p-5 shadow-modal max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-text-primary">
                {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const dayMeetings = getMeetingsForDay(selectedDay);
              if (dayMeetings.length === 0) {
                return <p className="py-6 text-center text-sm text-text-muted">No meetings on this day.</p>;
              }
              return (
                <div className="space-y-2">
                  {dayMeetings.map((m) => {
                    const Icon = meetingTypeIcons[m.type] || Clock;
                    return (
                      <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', safeConfig(meetingColors, m.type, 'border-border text-text-muted bg-bg-elevated'))}>
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary">{m.title}</p>
                          <p className="text-xs text-text-muted">{m.time} · {m.duration}min</p>
                          {m.location && <p className="mt-0.5 truncate text-[11px] text-text-muted">{m.location}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </AppShell>
  );
}
