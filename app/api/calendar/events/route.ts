import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

type GoogleConfig = {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  calendar_id: string;
  timezone?: string;
};

type CalendarContext = {
  agencyId: string;
  supabase: SupabaseClient;
};

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getCalendarContext(request: NextRequest): Promise<CalendarContext | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabase = getServerSupabase();
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabase || !anonUrl || !anonKey) return null;

  const authClient = createClient(anonUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile?.agency_id) return null;

  return { agencyId: profile.agency_id, supabase };
}

async function getGoogleConfig(context: CalendarContext): Promise<GoogleConfig | null> {
  const { data, error } = await context.supabase
    .from('integrations')
    .select('config, connected')
    .eq('service', 'Google Calendar')
    .eq('agency_id', context.agencyId)
    .maybeSingle();
  if (error || !data?.connected) return null;
  const config = data.config as Partial<GoogleConfig> | null;
  if (!config?.access_token || !config.calendar_id) return null;
  return config as GoogleConfig;
}

async function refreshConfig(context: CalendarContext, config: GoogleConfig): Promise<GoogleConfig | null> {
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;
  if (!clientId || !clientSecret || !config.refresh_token) return null;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) return null;
  const tokens = await response.json() as Record<string, unknown>;
  if (typeof tokens.access_token !== 'string') return null;

  const nextConfig: GoogleConfig = {
    ...config,
    access_token: tokens.access_token,
    refresh_token: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : config.refresh_token,
    expires_at: typeof tokens.expires_in === 'number' ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : config.expires_at,
  };
  const { error } = await context.supabase
    .from('integrations')
    .update({ config: nextConfig, updated_at: new Date().toISOString() })
    .eq('service', 'Google Calendar')
    .eq('agency_id', context.agencyId);
  if (error) return null;
  return nextConfig;
}

async function getValidConfig(context: CalendarContext): Promise<GoogleConfig | null> {
  const config = await getGoogleConfig(context);
  if (!config) return null;
  if (config.expires_at && new Date(config.expires_at).getTime() <= Date.now() + 60_000) {
    return refreshConfig(context, config);
  }
  return config;
}

function googleEventKey(calendarId: string, eventId: string): string {
  return `google:${calendarId}:${eventId}`;
}

function toMeetingPayload(event: Record<string, unknown>, agencyId: string, calendarId: string): Record<string, unknown> | null {
  const id = typeof event.id === 'string' ? event.id : null;
  if (!id) return null;
  const start = event.start as { dateTime?: string; date?: string } | undefined;
  const end = event.end as { dateTime?: string; date?: string } | undefined;
  const startsAt = start?.dateTime || (start?.date ? `${start.date}T12:00:00.000Z` : null);
  const endsAt = end?.dateTime || (end?.date ? `${end.date}T12:00:00.000Z` : null);
  if (!startsAt) return null;
  const duration = endsAt && start?.dateTime
    ? Math.max(1, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000))
    : 1440;
  const attendees = Array.isArray(event.attendees) ? event.attendees as Array<{ displayName?: string; email?: string }> : [];
  const conference = event.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
  const meetLink = conference?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
  return {
    agency_id: agencyId,
    title: typeof event.summary === 'string' && event.summary.trim() ? event.summary : 'Untitled event',
    starts_at: startsAt,
    duration_minutes: duration,
    meeting_type: meetLink ? 'google_meet' : 'in-person',
    location: typeof event.location === 'string' ? event.location : meetLink || null,
    calendar_sync: googleEventKey(calendarId, id),
    attendee_name: attendees[0]?.displayName || attendees[0]?.email || null,
    attendee_email: attendees[0]?.email || null,
    status: event.status === 'cancelled' ? 'cancelled' : 'upcoming',
    notes: typeof event.description === 'string' ? event.description : null,
    updated_at: new Date().toISOString(),
  };
}

async function syncGoogleEvents(context: CalendarContext, config: GoogleConfig, timeMin: string, timeMax: string) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendar_id)}/events?${new URLSearchParams({ timeMin, timeMax, maxResults: '2500', singleEvents: 'true', showDeleted: 'true', orderBy: 'startTime' })}`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!response.ok) throw new Error(`Google Calendar request failed (${response.status})`);
  const result = await response.json() as { items?: Array<Record<string, unknown>> };
  const events = result.items ?? [];

  for (const event of events) {
    const payload = toMeetingPayload(event, context.agencyId, config.calendar_id);
    if (!payload) continue;
    const { data: existing, error: lookupError } = await context.supabase
      .from('meetings')
      .select('id')
      .eq('agency_id', context.agencyId)
      .eq('calendar_sync', payload.calendar_sync)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { error } = await context.supabase.from('meetings').update(payload).eq('id', existing.id).eq('agency_id', context.agencyId);
      if (error) throw error;
    } else if (payload.status !== 'cancelled') {
      const { error } = await context.supabase.from('meetings').insert(payload);
      if (error) throw error;
    }
  }

  return events;
}

type ContextAndConfigResult =
  | { error: NextResponse }
  | { context: CalendarContext; config: GoogleConfig };

async function getContextAndConfig(request: NextRequest): Promise<ContextAndConfigResult> {
  const context = await getCalendarContext(request);
  if (!context) return { error: json({ error: 'You must be signed in.' }, 401) };
  const config = await getValidConfig(context);
  if (!config) return { error: json({ error: 'Google Calendar is not connected.' }, 409) };
  return { context, config };
}

export async function GET(request: NextRequest) {
  const result = await getContextAndConfig(request);
  if ('error' in result) return result.error;
  const { context, config } = result;
  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get('timeMin') || new Date(Date.now() - 90 * 86400000).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 365 * 86400000).toISOString();
  try {
    const events = await syncGoogleEvents(context, config, timeMin, timeMax);
    return json({ synced: events.length });
  } catch (error) {
    console.error('[calendar/events] sync failed', error);
    return json({ error: 'Google Calendar sync failed.' }, 502);
  }
}

export async function POST(request: NextRequest) {
  const result = await getContextAndConfig(request);
  if ('error' in result) return result.error;
  const { config } = result;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: 'Invalid request.' }, 400); }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const startsAt = typeof body.starts_at === 'string' ? new Date(body.starts_at) : null;
  const duration = typeof body.duration_minutes === 'number' && body.duration_minutes > 0 ? body.duration_minutes : 30;
  if (!title || !startsAt || Number.isNaN(startsAt.getTime())) return json({ error: 'Title and start time are required.' }, 400);
  const event: Record<string, unknown> = {
    summary: title,
    start: { dateTime: startsAt.toISOString(), timeZone: config.timezone || 'UTC' },
    end: { dateTime: new Date(startsAt.getTime() + duration * 60000).toISOString(), timeZone: config.timezone || 'UTC' },
  };
  if (typeof body.location === 'string' && body.location) event.location = body.location;
  if (typeof body.notes === 'string' && body.notes) event.description = body.notes;
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendar_id)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!response.ok) return json({ error: 'Google Calendar event creation failed.' }, 502);
    const created = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string };
    return json({ google_event_id: created.id, calendar_sync: created.id ? googleEventKey(config.calendar_id, created.id) : null, html_link: created.htmlLink || null, hangout_link: created.hangoutLink || null });
  } catch (error) {
    console.error('[calendar/events] create failed', error);
    return json({ error: 'Google Calendar event creation failed.' }, 502);
  }
}

export async function PUT(request: NextRequest) {
  const result = await getContextAndConfig(request);
  if ('error' in result) return result.error;
  const { config } = result;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) return json({ error: 'Event ID is required.' }, 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: 'Invalid request.' }, 400); }
  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string') patch.summary = body.title.trim();
  if (typeof body.starts_at === 'string') {
    const start = new Date(body.starts_at);
    const duration = typeof body.duration_minutes === 'number' && body.duration_minutes > 0 ? body.duration_minutes : 30;
    patch.start = { dateTime: start.toISOString(), timeZone: config.timezone || 'UTC' };
    patch.end = { dateTime: new Date(start.getTime() + duration * 60000).toISOString(), timeZone: config.timezone || 'UTC' };
  }
  if (typeof body.location === 'string') patch.location = body.location;
  if (typeof body.notes === 'string') patch.description = body.notes;
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    if (!response.ok) return json({ error: 'Google Calendar event update failed.' }, 502);
    return json({ success: true });
  } catch (error) {
    console.error('[calendar/events] update failed', error);
    return json({ error: 'Google Calendar event update failed.' }, 502);
  }
}

export async function DELETE(request: NextRequest) {
  const result = await getContextAndConfig(request);
  if ('error' in result) return result.error;
  const { config } = result;
  const eventId = new URL(request.url).searchParams.get('eventId');
  if (!eventId) return json({ error: 'Event ID is required.' }, 400);
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${config.access_token}` },
    });
    if (!response.ok && response.status !== 410) return json({ error: 'Google Calendar event deletion failed.' }, 502);
    return json({ success: true });
  } catch (error) {
    console.error('[calendar/events] delete failed', error);
    return json({ error: 'Google Calendar event deletion failed.' }, 502);
  }
}
