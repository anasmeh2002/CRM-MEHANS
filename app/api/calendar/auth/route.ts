import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://crm.mehans.space';
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
  const clientId = process.env.ID_client;
  const clientSecret = process.env.Code_secret_du_client;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google Calendar OAuth credentials are not configured.' },
      { status: 500 },
    );
  }

  // Extract the user's Supabase access token from the Authorization header
  // so we can identify which agency this connection belongs to.
  const authHeader = request.headers.get('authorization') || '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();

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

  // Pass the user token through the OAuth state param so the callback
  // can associate the tokens with the correct agency.
  if (userToken) {
    params.set('state', userToken);
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // If the client sent an Authorization header, return the URL as JSON
  // so the token never appears in the browser's URL bar.
  if (userToken) {
    return NextResponse.json({ url: authUrl });
  }

  // Fallback: direct redirect (shared/no-agency connection)
  return NextResponse.redirect(authUrl);
}

export { GOOGLE_TOKEN_URL };
