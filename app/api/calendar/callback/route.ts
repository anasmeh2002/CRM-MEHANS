import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCalendarOAuthState } from '@/lib/calendar-auth';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') return 'https://crm.mehans.space';
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const state = searchParams.get('state') || '';
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;
  const stateUserId = clientSecret ? verifyCalendarOAuthState(state, clientSecret) : null;

  if (oauthError) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=google_denied`);
  if (!code || !stateUserId) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=invalid_oauth_state`);
  if (!clientId || !clientSecret) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=missing_credentials`);

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=server_unavailable`);

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', stateUserId)
      .maybeSingle();
    if (profileError || !profile?.agency_id) {
      return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=agency_not_found`);
    }

    const redirectUri = `${getBaseUrl()}/api/calendar/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=token_exchange_failed`);

    const tokens = await tokenRes.json() as Record<string, unknown>;
    if (typeof tokens.access_token !== 'string') {
      return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=missing_access_token`);
    }

    const calendarRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!calendarRes.ok) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=calendar_lookup_failed`);
    const calendar = await calendarRes.json() as { id?: string; timeZone?: string };
    if (!calendar.id) return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=missing_calendar_id`);

    const config = {
      access_token: tokens.access_token,
      refresh_token: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : null,
      scope: typeof tokens.scope === 'string' ? tokens.scope : null,
      token_type: typeof tokens.token_type === 'string' ? tokens.token_type : null,
      expires_at: typeof tokens.expires_in === 'number' ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      calendar_id: calendar.id,
      timezone: calendar.timeZone || 'UTC',
      connected_user_id: stateUserId,
      connected_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert(
        { service: 'Google Calendar', connected: true, config, agency_id: profile.agency_id },
        { onConflict: 'agency_id,service' },
      );
    if (upsertError) {
      console.error('[calendar/callback] failed to store integration', upsertError);
      return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=storage_failed`);
    }

    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_success=true`);
  } catch (error) {
    console.error('[calendar/callback] unexpected error', error);
    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=unexpected`);
  }
}
