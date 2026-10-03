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

    const body = await request.json();
    const { user_id, email } = body;

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400, headers: corsHeaders });
    }

    const sb = serverSupabase();
    const normalizedEmail = (email ?? '').trim().toLowerCase();

    // Find any invited workspace_members matching this user's email
    const { data: invitedMembers } = await sb
      .from('workspace_members')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('status', 'invited');

    if (invitedMembers && invitedMembers.length > 0) {
      for (const member of invitedMembers) {
        await sb
          .from('workspace_members')
          .update({
            user_id,
            status: 'active',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', member.id);
      }

      // Notify workspace owners/admins
      if (invitedMembers.length > 0) {
        const workspaceId = invitedMembers[0].workspace_id;
        const { data: admins } = await sb
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', workspaceId)
          .in('role', ['owner', 'admin'])
          .eq('status', 'active')
          .not('user_id', 'is', null);

        if (admins) {
          const notifInserts = admins
            .filter((a) => a.user_id)
            .map((a) => ({
              user_id: a.user_id,
              agency_id: workspaceId,
              title: 'Team Member Joined',
              description: `${invitedMembers[0].name} has accepted the invitation and is now active.`,
              type: 'team',
              read: false,
            }));
          if (notifInserts.length > 0) {
            await sb.from('notifications').insert(notifInserts);
          }
        }
      }
    } else {
      // No invitation found — check if this user already has an active membership
      const { data: activeMember } = await sb
        .from('workspace_members')
        .select('id, workspace_id')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!activeMember) {
        // New user with no invitation — create a default membership
        // Get the first agency (or the one in their user_metadata)
        const { data: authUser } = await sb.auth.admin.getUserById(user_id);
        const workspaceId = authUser?.user?.user_metadata?.workspace_id;

        if (workspaceId) {
          await sb.from('workspace_members').upsert({
            workspace_id: workspaceId,
            user_id,
            name: authUser?.user?.user_metadata?.full_name ?? normalizedEmail,
            email: normalizedEmail,
            role: authUser?.user?.user_metadata?.role ?? 'agent',
            status: 'active',
            accepted_at: new Date().toISOString(),
          }, { onConflict: 'workspace_id,email' });
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
