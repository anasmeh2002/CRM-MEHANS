import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function serverSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false } });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { title, description, type, record_type, record_id, user_id } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400, headers: corsHeaders });
    }

    const sb = serverSupabase();

    // Resolve the target user's agency_id from their workspace membership
    let agencyId: string | null = null;
    if (user_id && typeof user_id === 'string') {
      const { data: member } = await sb
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .maybeSingle();
      agencyId = member?.workspace_id ?? null;
    }

    const { data, error } = await sb.from('notifications').insert({
      title,
      description: typeof description === 'string' ? description : null,
      type: typeof type === 'string' ? type : 'info',
      record_type: typeof record_type === 'string' ? record_type : null,
      record_id: typeof record_id === 'string' ? record_id : null,
      user_id: typeof user_id === 'string' ? user_id : null,
      agency_id,
      read: false,
    }).select('id').maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data?.id ?? null }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
