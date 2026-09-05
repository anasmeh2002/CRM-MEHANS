import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_KEY = SERVICE_KEY || ANON_KEY;

function serverSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

interface EventPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

async function getN8nWebhookConfig(): Promise<{ url: string; secret: string } | null> {
  const sb = serverSupabase();
  const { data, error } = await sb
    .from('integrations')
    .select('config, connected')
    .eq('service', 'n8n')
    .maybeSingle();
  if (error || !data || !data.connected) return null;
  const config = (data.config ?? {}) as Record<string, unknown>;
  const url = typeof config.webhook_url === 'string' ? config.webhook_url : '';
  const secret = typeof config.webhook_secret === 'string' ? config.webhook_secret : '';
  if (!url) return null;
  return { url, secret };
}

async function dispatchToN8n(
  webhookUrl: string,
  secret: string,
  payload: EventPayload,
): Promise<{ ok: boolean; executionId?: string; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['x-webhook-secret'] = secret;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: 'mehans-crm', ...payload }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, error: `n8n returned ${res.status}` };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: true, executionId: typeof body.executionId === 'string' ? body.executionId : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}

export async function POST(request: NextRequest) {
  let body: EventPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.event || typeof body.event !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing event name' }, { status: 400 });
  }

  const sb = serverSupabase();

  // Find enabled automations matching this trigger event
  const { data: automations, error: autoError } = await sb
    .from('automations')
    .select('id, name, action_type, action_config')
    .eq('trigger_event', body.event)
    .eq('enabled', true);

  if (autoError) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  const n8nConfig = await getN8nWebhookConfig();

  if (!automations || automations.length === 0) {
    return NextResponse.json({ success: true, dispatched: 0, message: 'No matching automations' });
  }

  const results: Array<{ automation_id: string; status: string; error?: string }> = [];

  for (const auto of automations) {
    // Insert execution record
    const { data: execRow } = await sb
      .from('automation_executions')
      .insert({
        automation_id: auto.id,
        event_type: body.event,
        payload: body.data,
        status: 'pending',
      })
      .select('id')
      .single();

    const executionId = execRow?.id ?? '';

    if (!n8nConfig) {
      await sb.from('automation_executions').update({
        status: 'skipped',
        error_message: 'n8n not configured',
        completed_at: new Date().toISOString(),
      }).eq('id', executionId);
      results.push({ automation_id: auto.id, status: 'skipped' });
      continue;
    }

    const dispatchResult = await dispatchToN8n(n8nConfig.url, n8nConfig.secret, {
      event: body.event,
      data: {
        ...body.data,
        automation_id: auto.id,
        execution_id: executionId,
        action_type: auto.action_type,
        action_config: auto.action_config,
      },
      timestamp: body.timestamp ?? new Date().toISOString(),
    });

    if (dispatchResult.ok) {
      await sb.from('automation_executions').update({
        status: 'success',
        n8n_execution_id: dispatchResult.executionId ?? null,
        completed_at: new Date().toISOString(),
      }).eq('id', executionId);

      await sb.from('automations').update({
        execution_count: (auto as Record<string, unknown>).execution_count as number + 1,
        last_execution_at: new Date().toISOString(),
        last_execution_status: 'success',
      }).eq('id', auto.id);

      results.push({ automation_id: auto.id, status: 'success' });
    } else {
      await sb.from('automation_executions').update({
        status: 'error',
        error_message: dispatchResult.error ?? 'Unknown error',
        completed_at: new Date().toISOString(),
      }).eq('id', executionId);

      await sb.from('automations').update({
        last_execution_at: new Date().toISOString(),
        last_execution_status: 'error',
      }).eq('id', auto.id);

      results.push({ automation_id: auto.id, status: 'error', error: dispatchResult.error });
    }
  }

  return NextResponse.json({ success: true, dispatched: results.length, results });
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'Automation events endpoint. Use POST to dispatch events.' });
}
