import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://crm.mehans.space';
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const key = serviceKey || anonKey;
  if (!url || !key) {
    console.error('[calendar/callback] Missing Supabase credentials. SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!anonKey, 'URL:', !!url);
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=no_code`);
  }

  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=missing_credentials`);
  }

  const redirectUri = `${getBaseUrl()}/api/calendar/callback`;

  try {
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

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[calendar/callback] token exchange failed:', errBody);
      return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=${encodeURIComponent('token_exchange_failed:' + errBody.slice(0, 200))}`);
    }

    const tokens = await tokenRes.json();

    const sb = serverSupabase();
    const config = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      connected_at: new Date().toISOString(),
    };

    const { error: upsertError } = await sb
      .from('integrations')
      .upsert(
        { service: 'Google Calendar', connected: true, config },
        { onConflict: 'service' },
      );

    if (upsertError) {
      console.error('[calendar/callback] failed to store tokens:', upsertError.message);
      return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=${encodeURIComponent('storage_failed:' + upsertError.message.slice(0, 200))}`);
    }

    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_success=true`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected';
    console.error('[calendar/callback] unexpected error:', msg);
    return NextResponse.redirect(`${getBaseUrl()}/calendar?sync_error=${encodeURIComponent('unexpected:' + msg.slice(0, 200))}`);
  }
}
