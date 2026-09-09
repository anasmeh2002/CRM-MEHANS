import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCalendarOAuthState } from '@/lib/calendar-auth';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') return 'https://crm.mehans.space';
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;
  const supabase = getSupabaseClient();
  const authHeader = request.headers.get('authorization') || '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!clientId || !clientSecret || !supabase || !userToken) {
    return NextResponse.json({ error: 'Google Calendar connection is unavailable.' }, { status: 401 });
  }

  const { data, error } = await supabase.auth.getUser(userToken);
  if (error || !data.user) {
    return NextResponse.json({ error: 'You must be signed in to connect Google Calendar.' }, { status: 401 });
  }

  const redirectUri = `${getBaseUrl()}/api/calendar/callback`;
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');
  const state = createCalendarOAuthState(data.user.id, clientSecret);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}
