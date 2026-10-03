import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function serverSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret, X-Client-Info, Apikey',
};

interface WebhookAction {
  action: string;
  data: Record<string, unknown>;
  execution_id?: string;
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

async function validateWebhookSecret(request: NextRequest): Promise<boolean> {
  const provided = request.headers.get('x-webhook-secret');
  if (!provided) return false;
  const sb = serverSupabase();
  const { data } = await sb
    .from('integrations')
    .select('config')
    .eq('service', 'n8n')
    .maybeSingle();
  if (!data) return false;
  const config = (data.config ?? {}) as Record<string, unknown>;
  const expected = typeof config.webhook_secret === 'string' ? config.webhook_secret : '';
  if (!expected) return false;
  return provided === expected;
}

export async function POST(request: NextRequest) {
  const isValid = await validateWebhookSecret(request);
  if (!isValid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  let body: WebhookAction;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  if (!body.action || typeof body.action !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400, headers: corsHeaders });
  }

  const sb = serverSupabase();

  try {
    switch (body.action) {
      case 'create_lead': {
        const { first_name, last_name, phone, whatsapp, source, notes } = body.data;
        if (!phone && !whatsapp) {
          return NextResponse.json({ success: false, error: 'phone or whatsapp required' }, { status: 400, headers: corsHeaders });
        }
        const phoneStr = typeof phone === 'string' ? phone : '';
        const whatsappStr = typeof whatsapp === 'string' ? whatsapp : '';
        const existing = await sb
          .from('leads')
          .select('id')
          .or(`phone.ilike.%${phoneStr}%,whatsapp.ilike.%${whatsappStr}%`)
          .limit(1);
        if (existing.data && existing.data.length > 0) {
          return NextResponse.json({ success: true, lead_id: existing.data[0].id, message: 'Lead already exists' }, { headers: corsHeaders });
        }
        const { data, error } = await sb.from('leads').insert({
          first_name: typeof first_name === 'string' ? first_name : '',
          last_name: typeof last_name === 'string' ? last_name : '',
          phone: phoneStr,
          whatsapp: whatsappStr,
          source: typeof source === 'string' ? source : 'whatsapp',
          status: 'new',
          notes: typeof notes === 'string' ? notes : null,
        }).select('id').single();
        if (error) throw error;
        const leadSource = typeof source === 'string' ? source : 'whatsapp';
        await sb.from('notifications').insert({
          title: 'New Lead',
          description: `A new lead was added from ${leadSource}.`,
          type: 'lead',
          record_type: 'lead',
          record_id: data.id,
          read: false,
        });
        return NextResponse.json({ success: true, lead_id: data.id }, { headers: corsHeaders });
      }

      case 'create_task': {
        const { title, description, due_date, priority, related_type, related_id } = body.data;
        if (!title) {
          return NextResponse.json({ success: false, error: 'title required' }, { status: 400, headers: corsHeaders });
        }
        const { data, error } = await sb.from('tasks').insert({
          title: typeof title === 'string' ? title : '',
          description: typeof description === 'string' ? description : null,
          due_date: typeof due_date === 'string' ? due_date : null,
          priority: typeof priority === 'string' ? priority : 'medium',
          status: 'todo',
          related_type: typeof related_type === 'string' ? related_type : null,
          related_id: typeof related_id === 'string' ? related_id : null,
        }).select('id').single();
        if (error) throw error;
        return NextResponse.json({ success: true, task_id: data.id }, { headers: corsHeaders });
      }

      case 'send_notification': {
        const { title, description, record_type, record_id, user_id } = body.data;
        if (!title) {
          return NextResponse.json({ success: false, error: 'title required' }, { status: 400, headers: corsHeaders });
        }
        const { data, error } = await sb.from('notifications').insert({
          title: typeof title === 'string' ? title : '',
          description: typeof description === 'string' ? description : null,
          type: 'automation',
          record_type: typeof record_type === 'string' ? record_type : null,
          record_id: typeof record_id === 'string' ? record_id : null,
          user_id: typeof user_id === 'string' ? user_id : null,
          read: false,
        }).select('id').single();
        if (error) throw error;
        return NextResponse.json({ success: true, notification_id: data.id }, { headers: corsHeaders });
      }

      case 'update_execution': {
        const { execution_id, status, error_message, n8n_execution_id } = body.data;
        if (!execution_id) {
          return NextResponse.json({ success: false, error: 'execution_id required' }, { status: 400, headers: corsHeaders });
        }
        const update: Record<string, unknown> = { completed_at: new Date().toISOString() };
        if (typeof status === 'string') update.status = status;
        if (typeof error_message === 'string') update.error_message = error_message;
        if (typeof n8n_execution_id === 'string') update.n8n_execution_id = n8n_execution_id;
        const { error } = await sb.from('automation_executions').update(update).eq('id', execution_id as string);
        if (error) throw error;
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }

      case 'ai_summarize':
      case 'ai_qualify_lead':
      case 'ai_follow_up': {
        const { conversation_id, lead_id } = body.data;
        const { data: aiResult, error: aiError } = await sb.functions.invoke('openrouter-ai', {
          body: {
            messages: [{ role: 'user', content: JSON.stringify(body.data) }],
            system: `You are the MEHANS CRM AI. Action: ${body.action}. Conversation: ${conversation_id ?? 'N/A'}. Lead: ${lead_id ?? 'N/A'}. Respond with actionable JSON.`,
          },
        });
        if (aiError) throw aiError;
        return NextResponse.json({ success: true, ai_response: aiResult }, { headers: corsHeaders });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'n8n webhook receiver. POST actions here.' }, { headers: corsHeaders });
}
