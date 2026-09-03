import { NextResponse } from 'next/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://crm.mehans.space';
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function GET() {
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google Calendar OAuth credentials are not configured. Set ID_client and Code_secret_du_client in your environment variables.' },
      { status: 500 },
    );
  }

  const redirectUri = `${getBaseUrl()}/api/calendar/callback`;
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

export { GOOGLE_TOKEN_URL };
