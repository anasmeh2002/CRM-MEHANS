import { supabase } from '@/lib/supabase';

export type AIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function askAI(
  messages: AIMessage[],
  system?: string,
  model?: string,
  locale?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('openrouter-ai', {
    body: {
      messages,
      system,
      model,
      locale,
    },
  });

  if (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to reach the AI service';

    throw new Error(message);
  }

  if (!data || typeof data.content !== 'string') {
    const msg =
      data?.error || 'The AI service returned an invalid response';

    throw new Error(msg);
  }

  return data.content;
}

// ─────────────────────────────────────────────────────────────
// AI INSIGHTS
// ─────────────────────────────────────────────────────────────

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  fr: 'The user\'s interface language is French. Respond in professional French.',
  ar: 'The user\'s interface language is Arabic. Respond in professional Modern Standard Arabic.',
  en: 'Respond in professional English.',
};

export function localeInstruction(locale?: string): string {
  return LOCALE_INSTRUCTIONS[locale ?? 'en'] ?? LOCALE_INSTRUCTIONS.en;
}

export async function getAIInsights(
  context: string,
  locale?: string,
): Promise<
  {
    title: string;
    description: string;
    action: string;
    type: string;
  }[]
> {
  const langInstruction = localeInstruction(locale);
  const system = `
You are the MEHANS CRM sales analyst.

${langInstruction}

Use ONLY the CRM data provided by the user.

Generate exactly 3 actionable sales insights.

Each insight must have:
{
  "title": "short title",
  "description": "one concise sentence",
  "action": "one concrete next step",
  "type": "opportunity" | "trend" | "alert"
}

Rules:
- Never invent leads.
- Never invent properties.
- Never invent prices.
- Never invent deals.
- Never invent appointments.
- Never invent sales numbers.
- If something is unknown, say it is unknown.
- Return ONLY a JSON array.
- Do not use markdown.
`;

  const raw = await askAI(
    [
      {
        role: 'user',
        content: `CRM DATA:\n${context}\n\nGenerate the 3 insights now.`,
      },
    ],
    system,
    undefined,
    locale,
  );

  try {
    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item: any) => ({
        title: String(item?.title ?? 'Insight'),
        description: String(item?.description ?? ''),
        action: String(item?.action ?? 'Review'),
        type: ['opportunity', 'trend', 'alert'].includes(item?.type)
          ? item.type
          : 'trend',
      }));
    }
  } catch {
    // Return fallback below.
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

// ─────────────────────────────────────────────────────────────
// LEAD SUMMARY
// ─────────────────────────────────────────────────────────────

export async function getLeadSummary(
  lead: Record<string, unknown>,
  locale?: string,
): Promise<string> {
  const langInstruction = localeInstruction(locale);
  const system = `
You are the MEHANS CRM assistant.

${langInstruction}

Summarize this real estate lead in 3-4 concise sentences.

Cover:
- Lead quality
- Budget
- Property requirements
- Risks or missing information
- Recommended next action

Use ONLY the supplied lead data.
Never invent missing information.
`;

  return askAI(
    [
      {
        role: 'user',
        content: `LEAD DATA:\n${JSON.stringify(lead, null, 2)}`,
      },
    ],
    system,
    undefined,
    locale,
  );
}

// ─────────────────────────────────────────────────────────────
// AI REPORT
// ─────────────────────────────────────────────────────────────

export async function getAIReport(
  context: string,
  topic: string,
  locale?: string,
): Promise<string> {
  const safeTopic = String(topic || 'CRM performance');
  const langInstruction = localeInstruction(locale);

  const system = `
You are the MEHANS CRM reporting engine.

${langInstruction}

Create a structured ${safeTopic} report using ONLY the supplied CRM data.

Include:
- Key metrics
- Important observations
- Risks
- 3 actionable recommendations

Do not invent information.

Keep the report under 400 words.
`;

  return askAI(
    [
      {
        role: 'user',
        content: `CRM DATA:\n${context}\n\nCreate the report.`,
      },
    ],
    system,
    undefined,
    locale,
  );
}

// ─────────────────────────────────────────────────────────────
// LEAD ANALYSIS
// ─────────────────────────────────────────────────────────────

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

type PropertyRecord = Record<string, any>;

function cleanJsonResponse(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const number = Number(cleaned);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function getLeadBudget(lead: any): {
  min: number | null;
  max: number | null;
} {
  const directBudget = toNumber(lead?.budget);

  const min =
    toNumber(lead?.budget_min) ??
    (directBudget !== null ? directBudget : null);

  const max =
    toNumber(lead?.budget_max) ??
    (directBudget !== null ? directBudget : null);

  return {
    min,
    max,
  };
}

function getLeadInterest(lead: any): string {
  return (
    normalizeText(lead?.property_interest) ||
    normalizeText(lead?.interested_in) ||
    normalizeText(lead?.property_type) ||
    'Unknown'
  );
}

function getPropertyPrice(property: PropertyRecord): number | null {
  return (
    toNumber(property?.price) ??
    toNumber(property?.selling_price) ??
    toNumber(property?.sale_price) ??
    null
  );
}

function getPropertyCity(property: PropertyRecord): string {
  return (
    normalizeText(property?.city) ||
    normalizeText(property?.location) ||
    normalizeText(property?.address) ||
    ''
  );
}

function getPropertyType(property: PropertyRecord): string {
  return (
    normalizeText(property?.type) ||
    normalizeText(property?.property_type) ||
    ''
  );
}

function isPropertyAvailable(property: PropertyRecord): boolean {
  const status = normalizeText(property?.status).toLowerCase();

  if (!status) {
    return true;
  }

  return [
    'available',
    'active',
    'published',
    'for_sale',
    'for rent',
    'for_rent',
    'new',
  ].includes(status);
}

function propertyMatchesBudget(
  property: PropertyRecord,
  budget: { min: number | null; max: number | null },
): boolean {
  const price = getPropertyPrice(property);

  if (price === null) {
    return false;
  }

  if (budget.max !== null && price > budget.max) {
    return false;
  }

  if (budget.min !== null && price < budget.min) {
    return true;
  }

  return true;
}

function propertyMatchesType(
  property: PropertyRecord,
  interest: string,
): boolean {
  if (!interest || interest === 'Unknown') {
    return true;
  }

  const propertyType = getPropertyType(property).toLowerCase();
  const requested = interest.toLowerCase();

  if (!propertyType) {
    return false;
  }

  return (
    propertyType.includes(requested) ||
    requested.includes(propertyType)
  );
}

function calculatePropertyMatchScore(
  property: PropertyRecord,
  lead: any,
): number {
  const budget = getLeadBudget(lead);
  const interest = getLeadInterest(lead);

  const leadCity =
    normalizeText(lead?.city) ||
    normalizeText(lead?.location) ||
    normalizeText(lead?.preferred_city) ||
    normalizeText(lead?.preferred_location);

  const propertyCity = getPropertyCity(property);

  let score = 0;

  if (isPropertyAvailable(property)) {
    score += 20;
  }

  if (propertyMatchesBudget(property, budget)) {
    score += 30;
  }

  if (propertyMatchesType(property, interest)) {
    score += 25;
  }

  if (
    leadCity &&
    propertyCity &&
    propertyCity.toLowerCase() === leadCity.toLowerCase()
  ) {
    score += 25;
  }

  return score;
}

export async function analyzeLead(
  leadId: string,
  locale?: string,
): Promise<LeadAnalysis> {
  // ───────────────────────────────────────────────────────────
  // 1. LEAD
  // ───────────────────────────────────────────────────────────

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*, contact:contacts(*)')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error('Lead not found');
  }

  // ───────────────────────────────────────────────────────────
  // 2. DEAL
  // ───────────────────────────────────────────────────────────

  const { data: deals } = await supabase
    .from('deals')
    .select('*, property:properties(*)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  const deal = deals?.[0] ?? null;

  // ───────────────────────────────────────────────────────────
  // 3. ACTIVITIES
  // ───────────────────────────────────────────────────────────

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);

  // ───────────────────────────────────────────────────────────
  // 4. TASKS
  // ───────────────────────────────────────────────────────────

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('related_type', 'lead')
    .eq('related_id', leadId)
    .order('due_date', { ascending: true });

  // ───────────────────────────────────────────────────────────
  // 5. MEETINGS
  // ───────────────────────────────────────────────────────────

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('lead_id', leadId)
    .order('starts_at', { ascending: false })
    .limit(5);

  // ───────────────────────────────────────────────────────────
  // 6. WHATSAPP
  // ───────────────────────────────────────────────────────────

  const { data: waConversations } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('lead_id', leadId);

  let waMessages: any[] = [];

  if (waConversations && waConversations.length > 0) {
    const conversationIds = waConversations.map((item) => item.id);

    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('timestamp', { ascending: false })
      .limit(20);

    waMessages = data ?? [];
  }

  // ───────────────────────────────────────────────────────────
  // 7. INSTAGRAM
  // ───────────────────────────────────────────────────────────

  const { data: igConversations } = await supabase
    .from('instagram_conversations')
    .select('id')
    .eq('lead_id', leadId);

  let igMessages: any[] = [];

  if (igConversations && igConversations.length > 0) {
    const conversationIds = igConversations.map((item) => item.id);

    const { data } = await supabase
      .from('instagram_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(20);

    igMessages = data ?? [];
  }

  // ───────────────────────────────────────────────────────────
  // 8. AVAILABLE PROPERTIES
  // ───────────────────────────────────────────────────────────

  const { data: allProperties, error: propertiesError } =
    await supabase
      .from('properties')
      .select('*')
      .limit(100);

  if (propertiesError) {
    console.warn(
      'Unable to load properties for AI analysis:',
      propertiesError.message,
    );
  }

  const availableProperties: PropertyRecord[] = (
    allProperties ?? []
  ).filter(isPropertyAvailable);

  // ───────────────────────────────────────────────────────────
  // 9. CALCULATE BEST PROPERTY CANDIDATES
  // ───────────────────────────────────────────────────────────

  const scoredProperties = availableProperties
    .map((property) => ({
      property,
      score: calculatePropertyMatchScore(property, lead),
    }))
    .sort((a, b) => b.score - a.score);

  const topProperties = scoredProperties
    .slice(0, 15)
    .map(({ property, score }) => ({
      id: property.id,
      title: property.title,
      city: getPropertyCity(property),
      price: getPropertyPrice(property),
      type: getPropertyType(property),
      bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null,
      area: property.area ?? null,
      status: property.status ?? null,
      matchScore: score,
    }));

  // ───────────────────────────────────────────────────────────
  // 10. LEAD BUDGET / REQUIREMENTS
  // ───────────────────────────────────────────────────────────

  const budget = getLeadBudget(lead);
  const interest = getLeadInterest(lead);

  const leadCity =
    normalizeText(lead?.city) ||
    normalizeText(lead?.location) ||
    normalizeText(lead?.preferred_city) ||
    normalizeText(lead?.preferred_location) ||
    'Unknown';

  // ───────────────────────────────────────────────────────────
  // 11. STRUCTURED CRM CONTEXT
  // ───────────────────────────────────────────────────────────

  const context = {
    lead: {
      id: lead.id,
      name:
        [lead.first_name, lead.last_name]
          .filter(Boolean)
          .join(' ') ||
        lead.full_name ||
        lead.name ||
        'Unknown',

      email: lead.email ?? null,
      phone: lead.phone ?? null,

      status: lead.status ?? 'Unknown',
      source: lead.source ?? 'Unknown',

      budget: lead.budget ?? null,
      budget_min: budget.min,
      budget_max: budget.max,

      interested_in: interest,
      preferred_city: leadCity,

      notes: lead.notes ?? null,

      score: lead.ai_score ?? lead.score ?? null,

      created_at: lead.created_at ?? null,
    },

    contact: lead.contact
      ? {
          name:
            [lead.contact.first_name, lead.contact.last_name]
              .filter(Boolean)
              .join(' ') || 'Unknown',

          company: lead.contact.company ?? null,
          role: lead.contact.role ?? null,
        }
      : null,

    current_deal: deal
      ? {
          title: deal.title ?? null,
          stage: deal.stage ?? null,
          value: deal.value ?? null,
          probability: deal.probability ?? null,
          expected_close_date:
            deal.expected_close_date ?? null,
        }
      : null,

    matched_deal_property: deal?.property
      ? {
          id: deal.property.id,
          title: deal.property.title,
          city: deal.property.city,
          price: deal.property.price,
          bedrooms: deal.property.bedrooms,
          bathrooms: deal.property.bathrooms,
          area: deal.property.area,
          type: deal.property.type,
          status: deal.property.status,
        }
      : null,

    available_properties: topProperties,

    recent_activities: (activities ?? []).map((activity: any) => ({
      type: activity.type ?? null,
      title: activity.title ?? null,
      date: activity.created_at ?? null,
    })),

    open_tasks: (tasks ?? [])
      .filter((task: any) => task.status !== 'done')
      .map((task: any) => ({
        title: task.title ?? null,
        due_date: task.due_date ?? null,
        priority: task.priority ?? null,
        status: task.status ?? null,
      })),

    upcoming_meetings: (meetings ?? [])
      .filter(
        (meeting: any) =>
          meeting.status === 'upcoming' ||
          meeting.status === 'scheduled',
      )
      .map((meeting: any) => ({
        title: meeting.title ?? null,
        starts_at: meeting.starts_at ?? null,
        type: meeting.meeting_type ?? null,
      })),

    whatsapp_history: waMessages
      .slice()
      .reverse()
      .map((message: any) => ({
        from: message.from_me ? 'agent' : 'lead',
        text: message.text ?? '',
        date: message.timestamp ?? null,
      })),

    instagram_history: igMessages
      .slice()
      .reverse()
      .map((message: any) => ({
        from:
          message.direction === 'outbound'
            ? 'agent'
            : 'lead',
        text: message.body ?? '',
        date: message.created_at ?? null,
      })),
  };

  // ───────────────────────────────────────────────────────────
  // 12. AI SYSTEM
  // ───────────────────────────────────────────────────────────

  const langInstruction = localeInstruction(locale);
  const system = `
You are MEHANS AI, a CRM sales operating system for a real estate agency.

${langInstruction}

You are analyzing ONE real lead.

Your job is to help the human sales agent make better decisions using ONLY the CRM information provided.

Return ONLY valid JSON.
Do not return markdown.
Do not use code fences.
Do not add explanations outside the JSON.

The JSON must contain EXACTLY these keys:

{
  "summary": "2-3 sentence summary",
  "intent": "High" | "Medium" | "Low" | "Unknown",
  "objective": "one sentence",
  "budgetFit": "one sentence",
  "propertyFit": "one sentence",
  "keySignals": [],
  "objections": [],
  "nextAction": "one concrete action",
  "followUpTiming": "specific timing",
  "suggestedProperty": "exact property title from available_properties OR Unknown",
  "suggestedWhatsappReply": "short WhatsApp message"
}

IMPORTANT PROPERTY MATCHING RULES:

1. You may ONLY recommend a property whose title appears in available_properties.

2. Never invent a property.

3. Never modify a property title.

4. If there is no suitable property, use:
"Unknown"

5. Budget alone does NOT mean a property is a perfect match.

6. City/location matters.

7. Property type matters.

8. Bedrooms, bathrooms and area matter when those requirements exist.

9. If the lead wants Temara and a property is in Rabat, DO NOT describe it as a perfect location match.

10. If a property is within budget but in a different city, describe the match as partial.

11. If the lead's preferred city is unknown, do not assume a city.

12. If the lead's property type is unknown, do not assume a property type.

13. If there is a current deal property, mention it as the current deal property, but only recommend another property if it exists in available_properties.

INTENT RULES:

High:
- negotiation / qualified / visit scheduled
- strong score
- clear budget and requirement
- strong recent activity

Medium:
- some qualification but missing important information

Low:
- weak engagement
- low score
- unclear requirement

Unknown:
- insufficient information

WHATSAPP RULES:

- Draft only.
- Never claim the message was sent.
- Match the lead's communication language when message history exists.
- If no message history exists, use concise professional English.
- Do not invent personal details.
- Do not invent property information.
- If recommending a property, use the EXACT title, city and price from the CRM.
- Keep it natural and short.

DATA INTEGRITY:

Never invent:
- names
- prices
- properties
- cities
- budgets
- appointments
- conversations
- scores
- deal information

If information is missing, say "Unknown".
`;

  // ───────────────────────────────────────────────────────────
  // 13. CALL AI
  // ───────────────────────────────────────────────────────────

  const raw = await askAI(
    [
      {
        role: 'user',
        content:
          `CRM DATA:\n${JSON.stringify(
            context,
            null,
            2,
          )}\n\nAnalyze this lead now.`,
      },
    ],
    system,
    undefined,
    locale,
  );

  // ───────────────────────────────────────────────────────────
  // 14. PARSE RESPONSE
  // ───────────────────────────────────────────────────────────

  try {
    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    const validSuggestedProperty =
      typeof parsed.suggestedProperty === 'string' &&
      topProperties.some(
        (property) =>
          property.title === parsed.suggestedProperty,
      )
        ? parsed.suggestedProperty
        : deal?.property?.title &&
            topProperties.some(
              (property) =>
                property.title === deal.property.title,
            )
          ? deal.property.title
          : 'Unknown';

    return {
      summary: String(
        parsed.summary ?? 'Unknown',
      ),

      intent: [
        'High',
        'Medium',
        'Low',
      ].includes(parsed.intent)
        ? parsed.intent
        : 'Unknown',

      objective: String(
        parsed.objective ?? 'Unknown',
      ),

      budgetFit: String(
        parsed.budgetFit ?? 'Unknown',
      ),

      propertyFit: String(
        parsed.propertyFit ?? 'Unknown',
      ),

      keySignals: Array.isArray(parsed.keySignals)
        ? parsed.keySignals
            .slice(0, 6)
            .map(String)
        : [],

      objections: Array.isArray(parsed.objections)
        ? parsed.objections
            .slice(0, 6)
            .map(String)
        : [],

      nextAction: String(
        parsed.nextAction ?? 'Unknown',
      ),

      followUpTiming: String(
        parsed.followUpTiming ?? 'Unknown',
      ),

      suggestedProperty: validSuggestedProperty,

      suggestedWhatsappReply: String(
        parsed.suggestedWhatsappReply ??
          'Unknown',
      ),
    };
  } catch {
    throw new Error(
      'The AI returned an unexpected format. Please try again.',
    );
  }
}
