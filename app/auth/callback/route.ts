import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getAppUrl(request: NextRequest): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://crm.mehans.space';
  }
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const invitationId = requestUrl.searchParams.get('invitation_id');
  const nextParam = requestUrl.searchParams.get('next') ?? '/';
  const appUrl = getAppUrl(request);

  const nextPath =
    nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/';

  if (code) {
    const responseUrl = new URL(nextPath, appUrl);
    if (invitationId) {
      responseUrl.searchParams.set('invitation_id', invitationId);
    }

    const response = NextResponse.redirect(responseUrl.toString());
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        appUrl + '/login?error=' + encodeURIComponent(error.message)
      );
    }

    return response;
  }

  return NextResponse.redirect(appUrl + '/login');
}
