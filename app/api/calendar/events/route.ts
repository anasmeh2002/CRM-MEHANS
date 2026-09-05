import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const key = serviceKey || anonKey;
  if (!url || !key) {
    console.error('[calendar/events] Missing Supabase credentials. SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!anonKey, 'URL:', !!url);
  }
  return createClient(url, key);
}

interface CalendarTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: string | null;
  scope?: string;
  token_type?: string;
}

async function getGoogleTokens(): Promise<CalendarTokens | null> {
  const sb = serverSupabase();
  const { data, error } = await sb
    .from('integrations')
    .select('connected, config')
    .eq('service', 'Google Calendar')
    .maybeSingle();

  if (error || !data || !data.connected) return null;
  const config = data.config as Record<string, unknown>;
  if (!config?.access_token) return null;

  return {
    access_token: config.access_token as string,
    refresh_token: config.refresh_token as string | undefined,
    expires_at: config.expires_at as string | null,
    scope: config.scope as string | undefined,
    token_type: config.token_type as string | undefined,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<CalendarTokens | null> {
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) return null;
  const tokens = await res.json();
  if (!tokens.access_token) {
    console.error('[calendar/events] refresh returned no access_token:', JSON.stringify(tokens).slice(0, 500));
    return null;
  }

  const sb = serverSupabase();
  const newConfig = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? refreshToken,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    connected_at: new Date().toISOString(),
  };
  await sb.from('integrations').upsert(
    { service: 'Google Calendar', connected: true, config: newConfig },
    { onConflict: 'agency_id,service' },
  );

  return newConfig as unknown as CalendarTokens;
}

async function getValidTokens(): Promise<CalendarTokens | null> {
  const tokens = await getGoogleTokens();
  if (!tokens) return null;

  if (tokens.expires_at && new Date(tokens.expires_at) <= new Date(Date.now() + 60000)) {
    if (tokens.refresh_token) {
      return refreshAccessToken(tokens.refresh_token);
    }
    return null;
  }

  return tokens;
}

// GET — fetch events from Google Calendar
export async function GET(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get('timeMin') || new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 90 * 86400000).toISOString();
  const maxResults = searchParams.get('maxResults') || '250';

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
        timeMin,
        timeMax,
        maxResults,
        singleEvents: 'true',
        orderBy: 'startTime',
      })}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[calendar/events] Google API error:', res.status, err);
      return NextResponse.json({ error: `Google API ${res.status}: ${err.slice(0, 300)}` }, { status: 502 });
    }

    const data = await res.json();
    const events = (data.items ?? []).map((e: any) => ({
      id: e.id,
      title: e.summary || 'Untitled',
      starts_at: e.start?.dateTime || e.start?.date || null,
      ends_at: e.end?.dateTime || e.end?.date || null,
      location: e.location || null,
      meeting_type: 'google_meet',
      attendee: e.attendees?.[0]?.displayName || e.attendees?.[0]?.email || 'TBD',
      status: 'upcoming',
      source: 'google',
      html_link: e.htmlLink || null,
      google_event_id: e.id,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error('[calendar/events] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error fetching events' }, { status: 500 });
  }
}

// POST — create event in Google Calendar
export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, starts_at, duration_minutes, location, attendee_name, attendee_email, notes, meeting_type } = body;

  if (!title || !starts_at) {
    return NextResponse.json({ error: 'Title and start time are required' }, { status: 400 });
  }

  const start = new Date(starts_at);
  const end = new Date(start.getTime() + (duration_minutes || 30) * 60000);

  const event: Record<string, unknown> = {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: 'UTC' },
    end: { dateTime: end.toISOString(), timeZone: 'UTC' },
  };

  if (location) event.location = location;
  if (notes) event.description = notes;

  const attendees: { email: string; displayName?: string }[] = [];
  if (attendee_email) attendees.push({ email: attendee_email, displayName: attendee_name });
  if (attendees.length > 0) event.attendees = attendees;

  if (meeting_type === 'google_meet') {
    event.conferenceData = {
      createRequest: { requestId: `crm-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    };
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[calendar/events] create failed:', res.status, err);
      return NextResponse.json({ error: `Google API ${res.status}: ${err.slice(0, 300)}` }, { status: 502 });
    }

    const created = await res.json();
    return NextResponse.json({
      google_event_id: created.id,
      html_link: created.htmlLink,
      hangout_link: created.hangoutLink || null,
    });
  } catch (err) {
    console.error('[calendar/events] create unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error creating event' }, { status: 500 });
  }
}

// DELETE — delete event from Google Calendar
export async function DELETE(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    if (!res.ok && res.status !== 410) {
      const err = await res.text();
      console.error('[calendar/events] delete failed:', res.status, err);
      return NextResponse.json({ error: `Google API ${res.status}: ${err.slice(0, 300)}` }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[calendar/events] delete unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error deleting event' }, { status: 500 });
  }
}
