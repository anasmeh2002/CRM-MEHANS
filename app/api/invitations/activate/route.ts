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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const invitationId =
      typeof body?.invitation_id === 'string' ? body.invitation_id.trim() : '';

    if (!invitationId) {
      return NextResponse.json(
        { error: 'invitation_id_required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const authenticatedUserId = authData.user.id;
    const authenticatedEmail = (authData.user.email ?? '').trim().toLowerCase();

    if (!authenticatedEmail) {
      return NextResponse.json(
        { error: 'Authenticated user has no email' },
        { status: 400, headers: corsHeaders }
      );
    }

    const sb = serverSupabase();

    const { data: invitation, error: invitationError } = await sb
      .from('workspace_members')
      .select('id, workspace_id, user_id, name, email, role, status')
      .eq('id', invitationId)
      .eq('status', 'invited')
      .maybeSingle();

    if (invitationError) throw invitationError;

    if (!invitation) {
      return NextResponse.json(
        { error: 'invitation_not_found_or_already_accepted' },
        { status: 404, headers: corsHeaders }
      );
    }

    const invitedEmail = (invitation.email ?? '').trim().toLowerCase();
    if (invitedEmail !== authenticatedEmail) {
      return NextResponse.json(
        { error: 'invitation_email_mismatch' },
        { status: 403, headers: corsHeaders }
      );
    }

    if (invitation.user_id && invitation.user_id !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'invitation_user_mismatch' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { data: updatedInvitation, error: updateError } = await sb
      .from('workspace_members')
      .update({
        user_id: authenticatedUserId,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .eq('status', 'invited')
      .select('id, workspace_id, name, role')
      .single();

    if (updateError || !updatedInvitation) {
      throw updateError ?? new Error('Invitation activation failed');
    }

    const { data: admins, error: adminsError } = await sb
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', updatedInvitation.workspace_id)
      .in('role', ['owner', 'admin'])
      .eq('status', 'active')
      .not('user_id', 'is', null);

    if (adminsError) throw adminsError;

    const notifInserts = (admins ?? [])
      .filter((admin) => admin.user_id && admin.user_id !== authenticatedUserId)
      .map((admin) => ({
        user_id: admin.user_id,
        agency_id: updatedInvitation.workspace_id,
        title: 'Team Member Joined',
        description: updatedInvitation.name + ' has accepted the invitation and is now active.',
        type: 'team',
        record_type: 'member',
        record_id: updatedInvitation.id,
        read: false,
      }));

    if (notifInserts.length > 0) {
      const { error: notificationError } = await sb
        .from('notifications')
        .insert(notifInserts);

      if (notificationError) throw notificationError;
    }

    return NextResponse.json(
      {
        success: true,
        invitation_id: updatedInvitation.id,
        workspace_id: updatedInvitation.workspace_id,
        role: updatedInvitation.role,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
