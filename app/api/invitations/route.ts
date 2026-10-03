import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function serverSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false } });
}

async function getUserFromRequest(): Promise<{ id: string; email: string } | null> {
  const headerList = await headers();
  const authHeader = headerList.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

async function getUserAgencyId(userId: string): Promise<string | null> {
  const sb = serverSupabase();
  const { data } = await sb
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return data?.workspace_id ?? null;
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
    const body = await request.json();
    const { name, email, role } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders });
    }
    if (!role || !['owner', 'admin', 'manager', 'agent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400, headers: corsHeaders });
    }

    const currentUser = await getUserFromRequest();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const agencyId = await getUserAgencyId(currentUser.id);
    if (!agencyId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 403, headers: corsHeaders });
    }

    const sb = serverSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing workspace_members with same email in this workspace
    const { data: existingMember } = await sb
      .from('workspace_members')
      .select('id, status, user_id')
      .eq('workspace_id', agencyId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return NextResponse.json({ error: 'already_active', message: 'This user is already an active member.' }, { status: 409, headers: corsHeaders });
      }
      if (existingMember.status === 'invited') {
        return NextResponse.json({ error: 'already_invited', message: 'This user has already been invited.' }, { status: 409, headers: corsHeaders });
      }
    }

    // Send Supabase Auth invitation email
    const { data: inviteData, error: inviteError } = await sb.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || (typeof request.url === 'string' ? new URL(request.url).origin : 'http://localhost:3000')}/auth/callback`,
        data: {
          full_name: name.trim(),
          workspace_id: agencyId,
          role,
        },
      }
    );

    // Handle common errors
    if (inviteError) {
      const msg = inviteError.message.toLowerCase();
      if (msg.includes('already') && msg.includes('registered')) {
        // User already has an auth account — link them directly
        const { data: existingAuth } = await sb.auth.admin.listUsers();
        const authUser = existingAuth?.users?.find((u) => u.email === normalizedEmail);
        if (authUser) {
          const memberRow = {
            workspace_id: agencyId,
            user_id: authUser.id,
            name: name.trim(),
            email: normalizedEmail,
            role,
            status: 'invited' as const,
            invited_by: currentUser.id,
            invited_at: new Date().toISOString(),
          };
          if (existingMember) {
            const { error: updateErr } = await sb
              .from('workspace_members')
              .update(memberRow)
              .eq('id', existingMember.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await sb.from('workspace_members').insert(memberRow);
            if (insertErr) throw insertErr;
          }
          return NextResponse.json({ success: true, mode: 'existing_user_linked' }, { headers: corsHeaders });
        }
      }
      throw inviteError;
    }

    // Create / update workspace_members record
    const memberRow = {
      workspace_id: agencyId,
      user_id: inviteData.user?.id ?? null,
      name: name.trim(),
      email: normalizedEmail,
      role,
      status: 'invited' as const,
      invited_by: currentUser.id,
      invited_at: new Date().toISOString(),
    };

    if (existingMember) {
      const { error: updateErr } = await sb
        .from('workspace_members')
        .update(memberRow)
        .eq('id', existingMember.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await sb.from('workspace_members').insert(memberRow);
      if (insertErr) throw insertErr;
    }

    // Create a notification for workspace owners/admins
    const { data: admins } = await sb
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', agencyId)
      .in('role', ['owner', 'admin'])
      .eq('status', 'active')
      .not('user_id', 'is', null);

    if (admins) {
      const notifInserts = admins
        .filter((a) => a.user_id)
        .map((a) => ({
          user_id: a.user_id,
          agency_id: agencyId,
          title: 'New Team Member Invited',
          description: `${name.trim()} was invited as ${role}.`,
          type: 'team',
          record_type: 'member',
          record_id: null,
          read: false,
        }));
      if (notifInserts.length > 0) {
        await sb.from('notifications').insert(notifInserts);
      }
    }

    return NextResponse.json({ success: true, mode: 'invitation_sent' }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
