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
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } },
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

async function getUserRole(userId: string): Promise<string | null> {
  const sb = serverSupabase();
  const { data } = await sb
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return data?.role ?? null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const callerRole = await getUserRole(currentUser.id);
    if (!callerRole || !['owner', 'admin'].includes(callerRole)) {
      return NextResponse.json({ error: 'permission_denied' }, { status: 403, headers: corsHeaders });
    }

    if (role === 'owner' && callerRole !== 'owner') {
      return NextResponse.json({ error: 'permission_denied' }, { status: 403, headers: corsHeaders });
    }

    const sb = serverSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingMember } = await sb
      .from('workspace_members')
      .select('id, status, user_id')
      .eq('workspace_id', agencyId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingMember?.status === 'active') {
      return NextResponse.json(
        { error: 'already_active', message: 'This user is already an active member.' },
        { status: 409, headers: corsHeaders }
      );
    }

    if (existingMember?.status === 'invited') {
      return NextResponse.json(
        { error: 'already_invited', message: 'This user has already been invited.' },
        { status: 409, headers: corsHeaders }
      );
    }

    let invitationId: string;

    if (existingMember) {
      const { data: resetMember, error: resetError } = await sb
        .from('workspace_members')
        .update({
          user_id: null,
          name: name.trim(),
          email: normalizedEmail,
          role,
          status: 'invited',
          invited_by: currentUser.id,
          invited_at: new Date().toISOString(),
          accepted_at: null,
        })
        .eq('id', existingMember.id)
        .select('id')
        .single();

      if (resetError || !resetMember) throw resetError ?? new Error('Could not prepare invitation');
      invitationId = resetMember.id;
    } else {
      const { data: newMember, error: insertError } = await sb
        .from('workspace_members')
        .insert({
          workspace_id: agencyId,
          user_id: null,
          name: name.trim(),
          email: normalizedEmail,
          role,
          status: 'invited',
          invited_by: currentUser.id,
          invited_at: new Date().toISOString(),
          accepted_at: null,
        })
        .select('id')
        .single();

      if (insertError || !newMember) throw insertError ?? new Error('Could not create invitation');
      invitationId = newMember.id;
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof request.url === 'string' ? new URL(request.url).origin : 'http://localhost:3000');

    const redirectTo =
      siteUrl +
      '/auth/callback?invitation_id=' +
      encodeURIComponent(invitationId) +
      '&next=/';

    const { data: inviteData, error: inviteError } = await sb.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: {
          full_name: name.trim(),
          workspace_id: agencyId,
          invitation_id: invitationId,
          role,
        },
      }
    );

    if (inviteError) {
      const msg = inviteError.message.toLowerCase();

      if (msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))) {
        const { data: existingAuth } = await sb.auth.admin.listUsers();
        const authUser = existingAuth?.users?.find(
          (u) => (u.email ?? '').trim().toLowerCase() === normalizedEmail
        );

        if (authUser) {
          const { error: linkError } = await sb
            .from('workspace_members')
            .update({
              user_id: authUser.id,
              status: 'invited',
            })
            .eq('id', invitationId);

          if (linkError) throw linkError;

          return NextResponse.json(
            { success: true, mode: 'existing_user_linked', invitation_id: invitationId },
            { headers: corsHeaders }
          );
        }
      }

      await sb
        .from('workspace_members')
        .delete()
        .eq('id', invitationId)
        .eq('status', 'invited');

      throw inviteError;
    }

    if (!inviteData.user?.id) {
      await sb.from('workspace_members').delete().eq('id', invitationId);
      throw new Error('Supabase Auth did not return an invited user');
    }

    const { error: linkError } = await sb
      .from('workspace_members')
      .update({
        user_id: inviteData.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .eq('status', 'invited');

    if (linkError) throw linkError;

    const { data: admins, error: adminsError } = await sb
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', agencyId)
      .in('role', ['owner', 'admin'])
      .eq('status', 'active')
      .not('user_id', 'is', null);

    if (adminsError) throw adminsError;

    const notifInserts = (admins ?? [])
      .filter((admin) => admin.user_id)
      .map((admin) => ({
        user_id: admin.user_id,
        agency_id: agencyId,
        title: 'New Team Member Invited',
        description: name.trim() + ' was invited as ' + role + '.',
        type: 'team',
        record_type: 'member',
        record_id: invitationId,
        read: false,
      }));

    if (notifInserts.length > 0) {
      const { error: notificationError } = await sb.from('notifications').insert(notifInserts);
      if (notificationError) throw notificationError;
    }

    return NextResponse.json(
      { success: true, mode: 'invitation_sent', invitation_id: invitationId },
      { headers: corsHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
