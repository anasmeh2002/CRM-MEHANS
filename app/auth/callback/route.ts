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
  const next = requestUrl.searchParams.get('next') ?? '/';
  const appUrl = getAppUrl(request);

  if (code) {
    const response = NextResponse.redirect(appUrl + next);
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
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    return response;
  }

  return NextResponse.redirect(`${appUrl}/login`);
}
