import { supabase } from '@/lib/supabase';

export type AIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface AIInsight {
  title: string;
  description: string;
  action: string;
  type: 'opportunity' | 'trend' | 'alert';
}

/**
 * Central AI gateway.
 *
 * The OpenRouter API key never reaches the browser.
 * The browser only calls the Supabase Edge Function.
 */
export async function askAI(
  messages: AIMessage[],
  system?: string,
  model?: string,
): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('AI message is required.');
  }

  const cleanedMessages: AIMessage[] = messages
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim(),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (cleanedMessages.length === 0) {
    throw new Error('AI message is required.');
  }

  const { data, error } = await supabase.functions.invoke('openrouter-ai', {
    body: {
      messages: cleanedMessages,
      system,
      model,
    },
  });

  if (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to reach the AI service.',
    );
  }

  if (!data || typeof data.content !== 'string') {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'The AI service returned an invalid response.',
    );
  }

  const content = data.content.trim();

  if (!content) {
    throw new Error('The AI service returned an empty response.');
  }

  return content;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function cleanText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const text = String(value).trim();

  return text || undefined;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find(
    (value) => value !== null && value !== undefined && value !== '',
  );
}

function numberValue(...values: unknown[]): number | undefined {
  const value = firstDefined(...values);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function stripMarkdownJson(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Prevent unnecessarily huge CRM prompts.
 */
function limitText(value: unknown, max = 1000): string | undefined {
  const text = cleanText(value);

  if (!text) return undefined;

  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* -------------------------------------------------------------------------- */
/* CRM Insights                                                               */
/* -------------------------------------------------------------------------- */

export async function getAIInsights(
  context: string,
): Promise<AIInsight[]> {
  const system = `
You are the MEHANS CRM Sales Intelligence engine.

Your job is to analyze ONLY the CRM data supplied by the application.

Never invent:
- leads
- customers
- properties
- prices
- deals
- appointments
- tasks
- conversations
- revenue
- sales activity

Find useful patterns such as:
- high-value opportunities
- neglected leads
- overdue work
- strong buying signals
- pipeline risks
- property/lead mismatches
- follow-up opportunities

Return ONLY a JSON array with exactly 3 objects.

Each object must contain:
{
  "title": "short title",
  "description": "one factual sentence",
  "action": "short concrete next step",
  "type": "opportunity" | "trend" | "alert"
}

If the supplied CRM data does not support a conclusion, do not invent one.
`.trim();

  const raw = await askAI(
    [
      {
        role: 'user',
        content: `CRM DATA:\n${context}\n\nGenerate 3 actionable CRM insights.`,
      },
    ],
    system,
  );

  try {
    const parsed = JSON.parse(stripMarkdownJson(raw));

    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item: any) => ({
        title: cleanText(item?.title) || 'CRM Insight',
        description: cleanText(item?.description) || 'Review the available CRM data.',
        action: cleanText(item?.action) || 'Review',
        type: ['opportunity', 'trend', 'alert'].includes(item?.type)
          ? item.type
          : 'trend',
      }));
    }
  } catch {
    // Fall through to a safe text-based insight.
  }

  return [
    {
      title: 'AI Insight',
      description: raw.slice(0, 280),
      action: 'Review',
      type: 'trend',
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Lead Summary                                                               */
/* -------------------------------------------------------------------------- */

export async function getLeadSummary(
  lead: Record<string, unknown>,
): Promise<string> {
  const normalizedLead = normalizeLead(lead);

  const system = `
You are the MEHANS CRM lead analyst.

Summarize ONE real-estate lead using ONLY the supplied CRM data.

Cover:
1. Lead quality
2. Budget fit
3. Buying/renting objective
4. Important risks or missing information
5. Recommended next action

Do not invent information.

If something is unknown, explicitly say that it is unknown.

Keep the answer concise: 3-5 sentences.
`.trim();

  return askAI(
    [
      {
        role: 'user',
        content: `LEAD DATA:\n${JSON.stringify(normalizedLead, null, 2)}`,
      },
    ],
    system,
  );
}

/* -------------------------------------------------------------------------- */
/* AI Reports                                                                 */
/* -------------------------------------------------------------------------- */

export async function getAIReport(
  context: string,
  topic: string,
): Promise<string> {
  const safeTopic = cleanText(topic) || 'CRM performance';

  const system = `
You are the MEHANS CRM reporting engine.

Use ONLY the CRM data supplied by the application.

Create a structured ${safeTopic} report.

Include:
- Key observations
- Relevant metrics that are actually present
- Risks or gaps
- Three actionable recommendations

Do not invent numbers.

If a metric is unavailable, say "Unknown".

Keep the report under 500 words.
Use clear headings.
`.trim();

  return askAI(
    [
      {
        role: 'user',
        content: `CRM DATA:\n${context}\n\nREPORT TOPIC:\n${safeTopic}`,
      },
    ],
    system,
  );
}

/* -------------------------------------------------------------------------- */
/* Lead Analysis                                                              */
/* -------------------------------------------------------------------------- */

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

/**
 * Normalizes the different lead field names currently used in the CRM.
 *
 * This is important because the Leads UI can expose:
 *   budget
 *   property_interest
 *
 * while older database logic may use:
 *   budget_min
 *   budget_max
 *   interested_in
 */
function normalizeLead(lead: Record<string, unknown>) {
  const budget = firstDefined(
    lead.budget,
    lead.budget_range,
    lead.budget_min,
    lead.budget_max,
  );

  const budgetMin = numberValue(
    lead.budget_min,
    lead.min_budget,
  );

  const budgetMax = numberValue(
    lead.budget_max,
    lead.max_budget,
  );

  const propertyInterest = firstDefined(
    lead.property_interest,
    lead.interested_in,
    lead.property_type,
    lead.interest,
  );

  const score = numberValue(
    lead.ai_score,
    lead.score,
  );

  const name = firstDefined(
    lead.name,
    lead.full_name,
    [lead.first_name, lead.last_name]
      .filter(Boolean)
      .join(' '),
  );

  return {
    id: cleanText(lead.id),
    name: cleanText(name),
    email: cleanText(lead.email),
    phone: cleanText(lead.phone),
    whatsapp: cleanText(lead.whatsapp),
    status: cleanText(lead.status),
    source: cleanText(lead.source),

    budget: budget !== undefined ? budget : undefined,
    budget_min: budgetMin,
    budget_max: budgetMax,

    property_interest: cleanText(propertyInterest),

    notes: limitText(lead.notes, 2000),
    score,

    created_at: cleanText(lead.created_at),
    updated_at: cleanText(lead.updated_at),
  };
}

export async function analyzeLead(
  leadId: string,
): Promise<LeadAnalysis> {
  if (!leadId?.trim()) {
    throw new Error('Lead ID is required.');
  }

  /* ---------------------------------------------------------------------- */
  /* Lead + Contact                                                         */
  /* ---------------------------------------------------------------------- */

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*, contact:contacts(*)')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error('Lead not found.');
  }

  /* ---------------------------------------------------------------------- */
  /* Deal                                                                   */
  /* ---------------------------------------------------------------------- */

  const { data: deals } = await supabase
    .from('deals')
    .select('*, property:properties(*)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  const deal = deals?.[0] ?? null;

  /* ---------------------------------------------------------------------- */
  /* Activities                                                             */
  /* ---------------------------------------------------------------------- */

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(15);

  /* ---------------------------------------------------------------------- */
  /* Tasks                                                                  */
  /* ---------------------------------------------------------------------- */

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('related_type', 'lead')
    .eq('related_id', leadId)
    .order('due_date', { ascending: true })
    .limit(20);

  /* ---------------------------------------------------------------------- */
  /* Meetings                                                               */
  /* ---------------------------------------------------------------------- */

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('lead_id', leadId)
    .order('starts_at', { ascending: false })
    .limit(10);

  /* ---------------------------------------------------------------------- */
  /* WhatsApp                                                               */
  /* ---------------------------------------------------------------------- */

  const { data: waConv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();

  let waMessages: any[] = [];

  if (waConv?.id) {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', waConv.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    waMessages = data ?? [];
  }

  /* ---------------------------------------------------------------------- */
  /* Instagram                                                              */
  /* ---------------------------------------------------------------------- */

  const { data: igConv } = await supabase
    .from('instagram_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();

  let igMessages: any[] = [];

  if (igConv?.id) {
    const { data } = await supabase
      .from('instagram_messages')
      .select('*')
      .eq('conversation_id', igConv.id)
      .order('created_at', { ascending: false })
      .limit(20);

    igMessages = data ?? [];
  }

  /* ---------------------------------------------------------------------- */
  /* Normalize CRM data                                                     */
  /* ---------------------------------------------------------------------- */

  const normalizedLead = normalizeLead(lead);

  const contact = lead.contact
    ? {
        id: cleanText(lead.contact.id),
        name:
          cleanText(
            [
              lead.contact.first_name,
              lead.contact.last_name,
            ]
              .filter(Boolean)
              .join(' '),
          ) || cleanText(lead.contact.name),
        company: cleanText(lead.contact.company),
        role: cleanText(lead.contact.role),
        email: cleanText(lead.contact.email),
        phone: cleanText(lead.contact.phone),
      }
    : null;

  const normalizedDeal = deal
    ? {
        id: cleanText(deal.id),
        title: cleanText(deal.title),
        stage: cleanText(deal.stage),
        value: numberValue(deal.value),
        probability: numberValue(deal.probability),
        expected_close_date: cleanText(deal.expected_close_date),
      }
    : null;

  const normalizedProperty = deal?.property
    ? {
        id: cleanText(deal.property.id),
        title: cleanText(deal.property.title),
        city: cleanText(deal.property.city),
        price: numberValue(deal.property.price),
        type: cleanText(deal.property.type),
        status: cleanText(deal.property.status),
        bedrooms: numberValue(deal.property.bedrooms),
        bathrooms: numberValue(deal.property.bathrooms),
        area: numberValue(deal.property.area),
      }
    : null;

  const context = {
    lead: normalizedLead,

    contact,

    deal: normalizedDeal,

    matched_property: normalizedProperty,

    recent_activities: safeArray<any>(activities).map((activity) => ({
      type: cleanText(activity.type),
      title: cleanText(activity.title),
      description: limitText(activity.description, 500),
      date: cleanText(activity.created_at),
    })),

    open_tasks: safeArray<any>(tasks)
      .filter((task) => task.status !== 'done')
      .map((task) => ({
        title: cleanText(task.title),
        status: cleanText(task.status),
        priority: cleanText(task.priority),
        due_date: cleanText(task.due_date),
      })),

    meetings: safeArray<any>(meetings).map((meeting) => ({
      title: cleanText(meeting.title),
      status: cleanText(meeting.status),
      starts_at: cleanText(meeting.starts_at),
      type: cleanText(meeting.meeting_type),
      location: cleanText(meeting.location),
    })),

    whatsapp_history: waMessages
      .slice()
      .reverse()
      .map((message: any) => ({
        from: message.from_me ? 'agent' : 'lead',
        text: limitText(message.text, 1000),
        date: cleanText(message.timestamp),
      })),

    instagram_history: igMessages
      .slice()
      .reverse()
      .map((message: any) => ({
        from:
          message.direction === 'outbound'
            ? 'agent'
            : 'lead',
        text: limitText(message.body, 1000),
        date: cleanText(message.created_at),
      })),
  };

  /* ---------------------------------------------------------------------- */
  /* AI prompt                                                              */
  /* ---------------------------------------------------------------------- */

  const system = `
You are the MEHANS CRM Sales Intelligence Engine.

You are analyzing exactly ONE real-estate lead.

Your output MUST be valid JSON only.

Return exactly this structure:

{
  "summary": "2-3 sentence factual summary",
  "intent": "High" | "Medium" | "Low" | "Unknown",
  "objective": "what the lead appears to want",
  "budgetFit": "budget comparison or Unknown",
  "propertyFit": "property fit or Unknown",
  "keySignals": [],
  "objections": [],
  "nextAction": "one concrete action",
  "followUpTiming": "recommended timing or Unknown",
  "suggestedProperty": "property title or Unknown",
  "suggestedWhatsappReply": "message draft or Unknown"
}

RULES:

1. Use ONLY information present in CRM DATA.

2. NEVER invent:
   - names
   - prices
   - properties
   - budgets
   - locations
   - conversations
   - appointments
   - customer intentions
   - deal information

3. Do not treat missing data as negative data.

4. If the CRM does not contain enough information, use:
   "Unknown"

5. "High", "Medium", or "Low" intent must be supported by actual CRM signals.
   Otherwise use "Unknown".

6. The suggested property MUST come from the supplied CRM data.

7. Do not invent property matches.

8. The WhatsApp draft must:
   - be based only on supplied information
   - match the language of the lead's conversation when conversation data exists
   - remain natural and concise
   - never claim an appointment or action happened unless CRM data confirms it

9. "nextAction" is a recommendation for the human agent.
   Never claim that the action was executed.

10. Return RAW JSON.
   No markdown.
   No ```json fences.
`.trim();

  const raw = await askAI(
    [
      {
        role: 'user',
        content:
          `CRM DATA:\n${JSON.stringify(context, null, 2)}\n\n` +
          `Analyze this lead now.`,
      },
    ],
    system,
  );

  /* ---------------------------------------------------------------------- */
  /* Parse + validate                                                       */
  /* ---------------------------------------------------------------------- */

  try {
    const parsed = JSON.parse(stripMarkdownJson(raw));

    const intent =
      parsed?.intent === 'High' ||
      parsed?.intent === 'Medium' ||
      parsed?.intent === 'Low'
        ? parsed.intent
        : 'Unknown';

    return {
      summary:
        cleanText(parsed?.summary) || 'Unknown',

      intent,

      objective:
        cleanText(parsed?.objective) || 'Unknown',

      budgetFit:
        cleanText(parsed?.budgetFit) || 'Unknown',

      propertyFit:
        cleanText(parsed?.propertyFit) || 'Unknown',

      keySignals: Array.isArray(parsed?.keySignals)
        ? parsed.keySignals
            .map((item: unknown) => cleanText(item))
            .filter(Boolean)
            .slice(0, 8) as string[]
        : [],

      objections: Array.isArray(parsed?.objections)
        ? parsed.objections
            .map((item: unknown) => cleanText(item))
            .filter(Boolean)
            .slice(0, 8) as string[]
        : [],

      nextAction:
        cleanText(parsed?.nextAction) || 'Unknown',

      followUpTiming:
        cleanText(parsed?.followUpTiming) || 'Unknown',

      suggestedProperty:
        cleanText(parsed?.suggestedProperty) || 'Unknown',

      suggestedWhatsappReply:
        cleanText(parsed?.suggestedWhatsappReply) || 'Unknown',
    };
  } catch {
    throw new Error(
      'The AI returned an unexpected format. Please try again.',
    );
  }
}
