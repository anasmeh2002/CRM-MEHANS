import { supabase } from './supabase';

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  enabled: boolean;
  execution_count: number;
  last_execution_at: string | null;
  last_execution_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecution {
  id: string;
  automation_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'error' | 'skipped';
  error_message: string | null;
  n8n_execution_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface N8nConfig {
  webhookUrl: string;
  apiUrl: string;
  webhookSecret: string;
  connected: boolean;
}

export const TRIGGER_EVENTS = [
  { value: 'whatsapp.new_message', label: 'New WhatsApp Message' },
  { value: 'whatsapp.outgoing_message', label: 'Outgoing WhatsApp Message' },
  { value: 'whatsapp.new_conversation', label: 'New WhatsApp Conversation' },
  { value: 'whatsapp.connection_change', label: 'WhatsApp Connection Changed' },
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.inactive', label: 'Lead Inactive (48h)' },
  { value: 'lead.qualified', label: 'Lead Qualified' },
  { value: 'deal.won', label: 'Deal Won' },
  { value: 'deal.lost', label: 'Deal Lost' },
  { value: 'meeting.created', label: 'Appointment Created' },
  { value: 'meeting.updated', label: 'Appointment Updated' },
  { value: 'meeting.cancelled', label: 'Appointment Cancelled' },
  { value: 'meeting.completed', label: 'Appointment Completed' },
  { value: 'property.match', label: 'Property Matches Lead' },
  { value: 'schedule.weekly', label: 'Weekly Schedule' },
] as const;

export const ACTION_TYPES = [
  { value: 'create_lead', label: 'Create/Update Lead' },
  { value: 'create_task', label: 'Create Follow-up Task' },
  { value: 'send_whatsapp', label: 'Send WhatsApp Message' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'send_email_report', label: 'Send Email Report' },
  { value: 'ai_summarize', label: 'AI Summarize Conversation' },
  { value: 'ai_qualify_lead', label: 'AI Qualify Lead' },
  { value: 'ai_follow_up', label: 'AI Generate Follow-up' },
] as const;

export async function fetchAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Automation[];
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('automations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function createAutomation(input: {
  name: string;
  description?: string;
  trigger_event: string;
  action_type: string;
  trigger_config?: Record<string, unknown>;
  action_config?: Record<string, unknown>;
}): Promise<Automation | null> {
  const { data, error } = await supabase
    .from('automations')
    .insert({
      name: input.name,
      description: input.description ?? '',
      trigger_event: input.trigger_event,
      trigger_config: input.trigger_config ?? {},
      action_type: input.action_type,
      action_config: input.action_config ?? {},
      enabled: true,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Automation | null;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchExecutions(limit = 20): Promise<AutomationExecution[]> {
  const { data, error } = await supabase
    .from('automation_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AutomationExecution[];
}

export async function fetchN8nConfig(): Promise<N8nConfig> {
  const { data, error } = await supabase
    .from('integrations')
    .select('connected, config')
    .eq('service', 'n8n')
    .maybeSingle();
  if (error || !data) {
    return { webhookUrl: '', apiUrl: '', webhookSecret: '', connected: false };
  }
  const config = (data.config ?? {}) as Record<string, unknown>;
  return {
    webhookUrl: typeof config.webhook_url === 'string' ? config.webhook_url : '',
    apiUrl: typeof config.api_url === 'string' ? config.api_url : '',
    webhookSecret: typeof config.webhook_secret === 'string' ? config.webhook_secret : '',
    connected: data.connected ?? false,
  };
}

export async function saveN8nConfig(cfg: N8nConfig): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .upsert({
      service: 'n8n',
      connected: cfg.connected,
      config: {
        webhook_url: cfg.webhookUrl,
        api_url: cfg.apiUrl,
        webhook_secret: cfg.webhookSecret,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agency_id,service' });
  if (error) throw error;
}

export async function testN8nConnection(): Promise<{ ok: boolean; message: string }> {
  const config = await fetchN8nConfig();
  if (!config.webhookUrl) {
    return { ok: false, message: 'No n8n webhook URL configured' };
  }
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.webhookSecret) headers['x-webhook-secret'] = config.webhookSecret;
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: true, source: 'mehans-crm', timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, message: `n8n responded with status ${res.status}` };
    return { ok: true, message: 'n8n connection successful' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
  }
}
