import { supabase } from '@/lib/supabase';

export type AIMessage = { role: 'user' | 'assistant'; content: string };

export async function askAI(messages: AIMessage[], system?: string, model?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('openrouter-ai', { body: { messages, system, model } });
  if (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach the AI service';
    throw new Error(message);
  }
  if (!data || typeof data.content !== 'string') {
    const msg = data?.error || 'The AI service returned an invalid response';
    throw new Error(msg);
  }
  return data.content;
}

export async function getAIInsights(context: string): Promise<{ title: string; description: string; action: string; type: string }[]> {
  const system = `You are the MEHANS CRM analyst. Using ONLY the supplied CRM data, produce 3 actionable sales insights as JSON. Each insight: { "title": short string, "description": one sentence, "action": short next step, "type": "opportunity" | "trend" | "alert" }. Return ONLY a JSON array, no prose.`;
  const raw = await askAI([{ role: 'user', content: `CRM data:\n${context}\n\nGenerate 3 insights as a JSON array.` }], system);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item: any, i: number) => ({
        title: String(item.title ?? 'Insight'),
        description: String(item.description ?? ''),
        action: String(item.action ?? 'Review'),
        type: ['opportunity', 'trend', 'alert'].includes(item.type) ? item.type : 'trend',
      }));
    }
  } catch {
    // fall through to text-based single insight
  }
  return [{ title: 'AI Insight', description: raw.slice(0, 280), action: 'Review', type: 'trend' }];
}

export async function getLeadSummary(lead: Record<string, unknown>): Promise<string> {
  const system = `You are the MEHANS CRM assistant. Summarize this real estate lead in 3-4 sentences: quality, budget fit, risks, and the recommended next action. Be specific and concise.`;
  return askAI([{ role: 'user', content: `Lead data:\n${JSON.stringify(lead)}` }], system);
}

export async function getAIReport(context: string, topic: string): Promise<string> {
  const system = `You are the MEHANS CRM reporting engine. Using ONLY the supplied CRM data, write a structured ${topic} report with clear sections (headings as bold lines), key metrics, and 3 actionable recommendations. Keep it under 400 words.`;
  return askAI([{ role: 'user', content: `CRM data:\n${context}\n\nWrite the ${topic} report.` }], system);
}

// ─── Lead Analysis ──────────────────────────────────────────────────────────

export interface LeadAnalysis {
  summary: string;
  intent: 'High' | 'Medium' | 'Low' | 'Unknown';
  objective: string;
  budgetFit: string;
  propertyFit: string;
  keySignals: string[];
  objections: string[];
  nextAction: string;
  followUpTiming: string;
  suggestedProperty: string;
  suggestedWhatsappReply: string;
}

export async function analyzeLead(leadId: string): Promise<LeadAnalysis> {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*, contact:contacts(*)')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) throw new Error('Lead not found');

  const { data: deals } = await supabase
    .from('deals')
    .select('*, property:properties(*)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  const deal = deals?.[0] ?? null;

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);

  // NOTE: assumes tasks linked to a lead use related_type = 'lead'.
  // Adjust this string if your task-creation code uses a different convention.
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('related_type', 'lead')
    .eq('related_id', leadId)
    .order('due_date', { ascending: true });

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('lead_id', leadId)
    .order('starts_at', { ascending: false })
    .limit(5);

  const { data: waConv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();
  let waMessages: any[] = [];
  if (waConv) {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', waConv.id)
      .order('timestamp', { ascending: false })
      .limit(15);
    waMessages = data ?? [];
  }

  const { data: igConv } = await supabase
    .from('instagram_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();
  let igMessages: any[] = [];
  if (igConv) {
    const { data } = await supabase
      .from('instagram_messages')
      .select('*')
      .eq('conversation_id', igConv.id)
      .order('created_at', { ascending: false })
      .limit(15);
    igMessages = data ?? [];
  }

  // Structured CRM-facts-only context — nothing invented here.
  const context = {
    lead: {
      name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.full_name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      budget_min: lead.budget_min,
      budget_max: lead.budget_max,
      interested_in: lead.interested_in,
      notes: lead.notes,
      score: lead.ai_score ?? lead.score,
      created_at: lead.created_at,
    },
    contact: lead.contact
      ? {
          name: [lead.contact.first_name, lead.contact.last_name].filter(Boolean).join(' '),
          company: lead.contact.company,
          role: lead.contact.role,
        }
      : null,
    deal: deal
      ? {
          title: deal.title,
          stage: deal.stage,
          value: deal.value,
          probability: deal.probability,
          expected_close_date: deal.expected_close_date,
        }
      : null,
    property: deal?.property
      ? {
          title: deal.property.title,
          city: deal.property.city,
          price: deal.property.price,
          bedrooms: deal.property.bedrooms,
          type: deal.property.type,
          status: deal.property.status,
        }
      : null,
    recent_activities: (activities ?? []).map((a: any) => ({ type: a.type, title: a.title, date: a.created_at })),
    open_tasks: (tasks ?? [])
      .filter((t: any) => t.status !== 'done')
      .map((t: any) => ({ title: t.title, due_date: t.due_date, priority: t.priority })),
    upcoming_meetings: (meetings ?? [])
      .filter((m: any) => m.status === 'upcoming')
      .map((m: any) => ({ title: m.title, starts_at: m.starts_at, type: m.meeting_type })),
    whatsapp_history: waMessages.reverse().map((m: any) => ({
      from: m.from_me ? 'agent' : 'lead',
      text: m.text,
      date: m.timestamp,
    })),
    instagram_history: igMessages.reverse().map((m: any) => ({
      from: m.direction === 'outbound' ? 'agent' : 'lead',
      text: m.body,
      date: m.created_at,
    })),
  };

  const system = `You are the MEHANS CRM sales-analysis engine for a real estate agency. You will be given real CRM data about ONE lead as JSON. Analyze it and return ONLY a JSON object (no prose, no markdown fences) with EXACTLY these keys:

{
  "summary": "2-3 sentence summary of who this lead is and where they stand",
  "intent": "High" | "Medium" | "Low",
  "objective": "buying or renting, and what they're looking for, in one sentence",
  "budgetFit": "one sentence comparing their budget to the matched/interested property, or 'Unknown' if no property/budget data",
  "propertyFit": "one sentence on how well the interested/matched property fits their stated needs, or 'Unknown'",
  "keySignals": ["short signal 1", "short signal 2"],
  "objections": ["short objection or concern 1"],
  "nextAction": "one concrete recommended next action for the agent",
  "followUpTiming": "e.g. 'Within 24 hours', 'This week', 'Unknown'",
  "suggestedProperty": "name/title of a property to suggest from the data given, or 'Unknown' if none available",
  "suggestedWhatsappReply": "a short, natural WhatsApp message draft in the lead's own language (match Darija/French/Arabic/English to how they've been communicating), ready to send"
}

CRITICAL RULES:
- Base every field STRICTLY on the JSON data provided below. Never invent a price, property, name, or fact not present in the data.
- If information needed for a field is missing or absent from the data, write exactly "Unknown" for that field (or an empty array for keySignals/objections).
- Do not wrap the JSON in markdown code fences. Return raw JSON only.`;

  const raw = await askAI(
    [{ role: 'user', content: `CRM DATA:\n${JSON.stringify(context, null, 2)}\n\nAnalyze this lead now.` }],
    system,
  );

  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? 'Unknown'),
      intent: ['High', 'Medium', 'Low'].includes(parsed.intent) ? parsed.intent : 'Unknown',
      objective: String(parsed.objective ?? 'Unknown'),
      budgetFit: String(parsed.budgetFit ?? 'Unknown'),
      propertyFit: String(parsed.propertyFit ?? 'Unknown'),
      keySignals: Array.isArray(parsed.keySignals) ? parsed.keySignals.map(String) : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections.map(String) : [],
      nextAction: String(parsed.nextAction ?? 'Unknown'),
      followUpTiming: String(parsed.followUpTiming ?? 'Unknown'),
      suggestedProperty: String(parsed.suggestedProperty ?? 'Unknown'),
      suggestedWhatsappReply: String(parsed.suggestedWhatsappReply ?? 'Unknown'),
    };
  } catch {
    throw new Error('The AI returned an unexpected format. Please try again.');
  }
}
