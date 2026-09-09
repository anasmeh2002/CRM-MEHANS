'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Phone, Video, MapPin, Users, Clock, CalendarX, AlertCircle, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Skeleton, EmptyState } from '@/components/shared';
import { useGlobalModal } from '@/components/modal-provider';
import { fetchMeetings } from '@/lib/data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Meeting } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';

import { useLanguage } from '@/components/language-provider';


type CalendarView = 'month' | 'week' | 'day';
type CalendarMeeting = Meeting & { date: string; time: string; duration: number; type: string; attendee: string; location: string };

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const meetingTypeIcons: Record<string, React.ElementType> = { call: Phone, visit: MapPin, video: Video, 'in-person': Users, google_meet: Video, zoom: Video };
const meetingColors: Record<string, string> = {
  call: 'border-info/40 text-info bg-info-bg', visit: 'border-gold-border text-gold bg-gold-bg', video: 'border-success/40 text-success bg-success-bg',
  'in-person': 'border-success/40 text-success bg-success-bg', google_meet: 'border-success/40 text-success bg-success-bg', zoom: 'border-success/40 text-success bg-success-bg',
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDisplayMeeting(meeting: Meeting): CalendarMeeting {
  const startsAt = meeting.starts_at ? new Date(meeting.starts_at) : null;
  return {
    ...meeting,
    date: startsAt && !Number.isNaN(startsAt.getTime()) ? dateKey(startsAt) : '',
    time: startsAt && !Number.isNaN(startsAt.getTime()) ? `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}` : '',
    duration: meeting.duration_minutes ?? meeting.duration ?? 30,
    type: meeting.meeting_type ?? meeting.type ?? 'in-person',
    attendee: meeting.attendee_name ?? meeting.attendee ?? 'TBD',
    location: meeting.location ?? '',
  };
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function MeetingChip({ meeting, compact = false }: { meeting: CalendarMeeting; compact?: boolean }) {
  const Icon = meetingTypeIcons[meeting.type] || Clock;
  return (
    <div className={cn('flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium', safeConfig(meetingColors, meeting.type, 'border-border text-text-muted bg-bg-elevated'))}>
      <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
      <span className="truncate">{compact ? meeting.title : `${meeting.time} ${meeting.attendee.split(' ')[0]}`}</span>
    </div>
  );
}

export default function CalendarPage() {
  const { openModal } = useGlobalModal();
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>('month');

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { data, loading, error, refetch } = useSupabaseQuery(fetchMeetings);

  const meetings = useMemo(() => (data ?? []).map(toDisplayMeeting).filter((meeting) => meeting.date), [data]);
  const todayKey = dateKey(new Date());
  const meetingsForDay = useCallback((date: Date) => meetings.filter((meeting) => meeting.date === dateKey(date)), [meetings]);
  const rangeStart = view === 'day' ? new Date(currentDate) : startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => { const day = new Date(rangeStart); day.setDate(rangeStart.getDate() + index); return day; });
  const monthCells = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const cells: Date[] = [];
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let index = 0; index < 42; index += 1) { const cell = new Date(start); cell.setDate(start.getDate() + index); cells.push(cell); }
    return cells;
  }, [currentDate]);
  const upcomingMeetings = useMemo(() => meetings.filter((meeting) => meeting.status === 'upcoming' && meeting.date >= todayKey).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [meetings, todayKey]);

  const moveDate = (amount: number) => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + amount);
    else if (view === 'week') next.setDate(next.getDate() + amount * 7);
    else next.setMonth(next.getMonth() + amount);
    setCurrentDate(next);
  };

  const renderDay = (day: Date, index?: number) => {
    const dayMeetings = meetingsForDay(day);
    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
    return (
      <button key={dateKey(day)} onClick={() => setSelectedDay(day)} className={cn('min-h-[92px] rounded-xl border p-1.5 text-left transition-colors sm:min-h-[112px]', isCurrentMonth ? 'border-border bg-bg-secondary' : 'border-transparent bg-bg-elevated/30', dateKey(day) === todayKey && 'border-gold-border bg-gold-bg')}>
        <div className="flex items-center justify-between"><span className={cn('text-xs font-medium', isCurrentMonth ? 'text-text-primary' : 'text-text-muted/50', dateKey(day) === todayKey && 'text-gold')}>{day.getDate()}</span>{dayMeetings.length > 0 && <span className="text-[10px] text-text-muted">{dayMeetings.length}</span>}</div>
        <div className="mt-1 hidden space-y-1 sm:block">{dayMeetings.slice(0, 3).map((meeting) => <MeetingChip key={meeting.id} meeting={meeting} />)}</div>
        <div className="mt-2 flex flex-wrap gap-1 sm:hidden">{dayMeetings.slice(0, 4).map((meeting) => <span key={meeting.id} className="h-1.5 w-1.5 rounded-full bg-gold" />)}</div>
        {index !== undefined && dayMeetings.length > 3 && <p className="mt-1 hidden text-[10px] text-text-muted sm:block">+{dayMeetings.length - 3} more</p>}
      </button>
    );
  };

  return (
    <AppShell>
      <PageHeader title={t('calendar.title')} description={t('calendar.description')}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => openModal('meeting')} className="btn btn-gold btn-md"><Plus className="h-4 w-4" strokeWidth={1.5} />{t('calendar.newMeeting')}</button>
        </div>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-3 sm:p-5" delay={0.1}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><button onClick={() => moveDate(-1)} className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"><ChevronLeft className="h-4 w-4" /></button><h3 className="min-w-[170px] text-center font-serif text-base font-medium text-text-primary sm:text-xl">{view === 'day' ? currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : formatMonth(currentDate)}</h3><button onClick={() => moveDate(1)} className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"><ChevronRight className="h-4 w-4" /></button><button onClick={() => setCurrentDate(new Date())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold-bg">{t('calendar.today')}</button></div>
            <div className="flex rounded-lg border border-border bg-bg-elevated p-1">{(['month', 'week', 'day'] as CalendarView[]).map((option) => <button key={option} onClick={() => setView(option)} className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors', view === option ? 'bg-gold text-bg-primary' : 'text-text-muted hover:text-text-primary')}>{t(`calendar.${option}`)}</button>)}</div>
          </div>
          {loading ? <div className="grid grid-cols-7 gap-1">{Array.from({ length: view === 'day' ? 1 : 42 }).map((_, index) => <Skeleton key={index} className="min-h-[80px] rounded-xl" />)}</div> : error ? <div className="flex flex-col items-center gap-3 py-16 text-center"><AlertCircle className="h-8 w-8 text-error" /><p className="text-sm text-text-muted">{t('calendar.loadFailed')}</p><button onClick={() => void refetch()} className="btn btn-ghost btn-sm">{t('common.tryAgain')}</button></div> : view === 'month' ? <><div className="grid grid-cols-7 gap-1">{days.map((day, index) => <div key={day} className="pb-2 text-center text-[10px] font-medium text-text-muted sm:text-xs"><span className="sm:hidden">{daysShort[index]}</span><span className="hidden sm:inline">{day}</span></div>)}</div><div className="grid grid-cols-7 gap-1">{monthCells.map((day, index) => renderDay(day, index))}</div></> : view === 'week' ? <><div className="grid grid-cols-7 gap-1">{weekDays.map((day, index) => <div key={dateKey(day)} className="pb-2 text-center text-[10px] font-medium text-text-muted sm:text-xs"><span className="sm:hidden">{daysShort[index]}</span><span className="hidden sm:inline">{days[index]} {day.getDate()}</span></div>)}</div><div className="grid grid-cols-7 gap-1">{weekDays.map((day) => renderDay(day))}</div></> : <div className="space-y-2">{meetingsForDay(currentDate).map((meeting) => <MeetingChip key={meeting.id} meeting={meeting} compact />)}{meetingsForDay(currentDate).length === 0 && <EmptyState icon={CalendarX} title={t('calendar.noMeetingsDay')} description={t('calendar.schedulePrompt')} />}</div>}
        </Card>
        <Card delay={0.15}>
          <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">{t('calendar.upcoming')}</h3>
          {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[88px] rounded-xl" />)}</div> : upcomingMeetings.length === 0 ? <EmptyState icon={CalendarX} title={t('calendar.noUpcoming')} description={t('calendar.schedulePrompt')} /> : <div className="space-y-2">{upcomingMeetings.map((meeting, index) => <motion.div key={meeting.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="rounded-xl border border-border p-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg-elevated"><span className="text-[9px] font-medium text-text-muted">{new Date(`${meeting.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span><span className="text-sm font-bold text-text-primary">{parseInt(meeting.date.slice(8), 10)}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-primary">{meeting.title}</p><p className="text-xs text-text-muted">{meeting.time} · {meeting.duration}min</p><p className="mt-1 truncate text-[11px] text-text-muted">{meeting.location}</p></div><Badge variant={meeting.status === 'cancelled' ? 'neutral' : 'gold'}>{meeting.status}</Badge></div></motion.div>)}</div>}
        </Card>
      </div>
      {selectedDay && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5 lg:hidden" onClick={() => setSelectedDay(null)}><div className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-bg-elevated p-5 sm:max-w-md sm:rounded-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="font-serif text-lg font-medium text-text-primary">{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3><button onClick={() => setSelectedDay(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-secondary"><X className="h-5 w-5" /></button></div>{meetingsForDay(selectedDay).map((meeting) => <div key={meeting.id} className="mb-2 rounded-xl border border-border p-3"><p className="text-sm font-medium text-text-primary">{meeting.title}</p><p className="text-xs text-text-muted">{meeting.time} · {meeting.duration}min</p></div>)}{meetingsForDay(selectedDay).length === 0 && <p className="py-6 text-center text-sm text-text-muted">{t('calendar.noMeetingsDay')}</p>}</div></div>}
    </AppShell>
  );
}
