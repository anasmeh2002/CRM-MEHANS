import { supabase } from '@/lib/supabase';

export type AIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function askAI(
  messages: AIMessage[],
  system?: string,
  model?: string,
): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('AI message is required.');
  }

  const cleanMessages = messages
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (cleanMessages.length === 0) {
    throw new Error('AI message is required.');
  }

  const { data, error } = await supabase.functions.invoke(
    'openrouter-ai',
    {
      body: {
        messages: cleanMessages,
        system,
        model,
      },
    },
  );

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
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : undefined;
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      return value;
    }
  }

  return undefined;
}

function numberValue(...values: unknown[]): number | undefined {
  const value = firstDefined(...values);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(
      value.replace(/[^\d.-]/g, ''),
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function limitText(
  value: unknown,
  maxLength = 1000,
): string | undefined {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function stripJsonMarkdown(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* AI INSIGHTS                                                                */
/* -------------------------------------------------------------------------- */

export async function getAIInsights(
  context: string,
): Promise<
  {
    title: string;
    description: string;
    action: string;
    type: string;
  }[]
> {
  const system = `
You are the MEHANS CRM Sales Intelligence engine.

Use ONLY the CRM data supplied by the application.

Never invent leads, customers, properties, prices, deals,
appointments, tasks, conversations, revenue, or sales activity.

Identify useful patterns such as:
- high-value opportunities
- neglected leads
- follow-up opportunities
- pipeline risks
- strong buying signals
- property and lead mismatches
- overdue work

Return ONLY a JSON array containing exactly 3 objects.

Each object must contain:
title
description
action
type

The type must be one of:
opportunity
trend
alert

If the CRM data does not support a conclusion,
do not invent one.
`.trim();

  const raw = await askAI(
    [
      {
        role: 'user',
        content:
          `CRM DATA:\n${context}\n\n` +
          `Generate 3 actionable CRM insights.`,
      },
    ],
    system,
  );

  try {
    const parsed = JSON.parse(
      stripJsonMarkdown(raw),
    );

    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item: any) => ({
        title:
          cleanText(item?.title) ||
          'CRM Insight',

        description:
          cleanText(item?.description) ||
          'Review the available CRM data.',

        action:
          cleanText(item?.action) ||
          'Review',

        type:
          ['opportunity', 'trend', 'alert'].includes(
            item?.type,
          )
            ? item.type
            : 'trend',
      }));
    }
  } catch {
    // Return a safe text insight below.
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
/* LEAD SUMMARY                                                               */
/* -------------------------------------------------------------------------- */

export async function getLeadSummary(
  lead: Record<string, unknown>,
): Promise<string> {
  const normalizedLead = normalizeLead(lead);

  const system = `
You are the MEHANS CRM Lead Analyst.

Analyze ONE real-estate lead using ONLY the supplied CRM data.

Cover:
1. Lead quality
2. Budget fit
3. Buying or renting objective
4. Risks or missing information
5. Recommended next action

Never invent information.

If information is unavailable, say Unknown.

Keep the answer concise and practical.
`.trim();

  return askAI(
    [
      {
        role: 'user',
        content:
          `LEAD DATA:\n${JSON.stringify(
            normalizedLead,
            null,
            2,
          )}`,
      },
    ],
    system,
  );
}

/* -------------------------------------------------------------------------- */
/* AI REPORT                                                                  */
/* -------------------------------------------------------------------------- */

export async function getAIReport(
  context: string,
  topic: string,
): Promise<string> {
  const safeTopic =
    cleanText(topic) || 'CRM performance';

  const system = `
You are the MEHANS CRM Reporting Engine.

Use ONLY the CRM data supplied by the application.

Create a structured report about:
${safeTopic}

Include:
- Key observations
- Relevant metrics available in the data
- Risks or gaps
- Three actionable recommendations

Never invent numbers.

If a metric is unavailable, say Unknown.

Keep the report under 500 words.
Use clear headings.
`.trim();

  return askAI(
    [
      {
        role: 'user',
        content:
          `CRM DATA:\n${context}\n\n` +
          `REPORT TOPIC:\n${safeTopic}`,
      },
    ],
    system,
  );
}

/* -------------------------------------------------------------------------- */
/* LEAD ANALYSIS                                                              */
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

/* -------------------------------------------------------------------------- */
/* NORMALIZE LEAD                                                             */
/* -------------------------------------------------------------------------- */

function normalizeLead(
  lead: Record<string, any>,
) {
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

    budget:
      budget !== undefined
        ? budget
        : undefined,

    budget_min: budgetMin,
    budget_max: budgetMax,

    property_interest:
      cleanText(propertyInterest),

    notes: limitText(lead.notes, 2000),

    score,

    created_at:
      cleanText(lead.created_at),

    updated_at:
      cleanText(lead.updated_at),
  };
}

/* -------------------------------------------------------------------------- */
/* ANALYZE LEAD                                                               */
/* -------------------------------------------------------------------------- */

export async function analyzeLead(
  leadId: string,
): Promise<LeadAnalysis> {
  if (!leadId || !leadId.trim()) {
    throw new Error('Lead ID is required.');
  }

  /* Lead */

  const {
    data: lead,
    error: leadError,
  } = await supabase
    .from('leads')
    .select('*, contact:contacts(*)')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error('Lead not found.');
  }

  /* Deals */

  const { data: deals } = await supabase
    .from('deals')
    .select('*, property:properties(*)')
    .eq('lead_id', leadId)
    .order('created_at', {
      ascending: false,
    });

  const deal = deals?.[0] ?? null;

  /* Activities */

  const { data: activities } =
    await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', {
        ascending: false,
      })
      .limit(15);

  /* Tasks */

  const { data: tasks } =
    await supabase
      .from('tasks')
      .select('*')
      .eq('related_type', 'lead')
      .eq('related_id', leadId)
      .order('due_date', {
        ascending: true,
      })
      .limit(20);

  /* Meetings */

  const { data: meetings } =
    await supabase
      .from('meetings')
      .select('*')
      .eq('lead_id', leadId)
      .order('starts_at', {
        ascending: false,
      })
      .limit(10);

  /* WhatsApp */

  const { data: waConv } =
    await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();

  let waMessages: any[] = [];

  if (waConv?.id) {
    const { data } =
      await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq(
          'conversation_id',
          waConv.id,
        )
        .order('timestamp', {
          ascending: false,
        })
        .limit(20);

    waMessages = data ?? [];
  }

  /* Instagram */

  const { data: igConv } =
    await supabase
      .from('instagram_conversations')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();

  let igMessages: any[] = [];

  if (igConv?.id) {
    const { data } =
      await supabase
        .from('instagram_messages')
        .select('*')
        .eq(
          'conversation_id',
          igConv.id,
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(20);

    igMessages = data ?? [];
  }

  /* ---------------------------------------------------------------------- */
  /* Build CRM context                                                      */
  /* ---------------------------------------------------------------------- */

  const normalizedLead =
    normalizeLead(lead);

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
          ) ||
          cleanText(
            lead.contact.name,
          ),

        company:
          cleanText(
            lead.contact.company,
          ),

        role:
          cleanText(
            lead.contact.role,
          ),

        email:
          cleanText(
            lead.contact.email,
          ),

        phone:
          cleanText(
            lead.contact.phone,
          ),
      }
    : null;

  const normalizedDeal = deal
    ? {
        id: cleanText(deal.id),

        title:
          cleanText(deal.title),

        stage:
          cleanText(deal.stage),

        value:
          numberValue(deal.value),

        probability:
          numberValue(
            deal.probability,
          ),

        expected_close_date:
          cleanText(
            deal.expected_close_date,
          ),
      }
    : null;

  const normalizedProperty =
    deal?.property
      ? {
          id: cleanText(
            deal.property.id,
          ),

          title:
            cleanText(
              deal.property.title,
            ),

          city:
            cleanText(
              deal.property.city,
            ),

          price:
            numberValue(
              deal.property.price,
            ),

          type:
            cleanText(
              deal.property.type,
            ),

          status:
            cleanText(
              deal.property.status,
            ),

          bedrooms:
            numberValue(
              deal.property.bedrooms,
            ),

          bathrooms:
            numberValue(
              deal.property.bathrooms,
            ),

          area:
            numberValue(
              deal.property.area,
            ),
        }
      : null;

  const context = {
    lead: normalizedLead,

    contact,

    deal: normalizedDeal,

    matched_property:
      normalizedProperty,

    recent_activities:
      (activities ?? []).map(
        (activity: any) => ({
          type:
            cleanText(activity.type),

          title:
            cleanText(activity.title),

          description:
            limitText(
              activity.description,
              500,
            ),

          date:
            cleanText(
              activity.created_at,
            ),
        }),
      ),

    open_tasks:
      (tasks ?? [])
        .filter(
          (task: any) =>
            task.status !== 'done',
        )
        .map((task: any) => ({
          title:
            cleanText(task.title),

          status:
            cleanText(task.status),

          priority:
            cleanText(task.priority),

          due_date:
            cleanText(
              task.due_date,
            ),
        })),

    meetings:
      (meetings ?? []).map(
        (meeting: any) => ({
          title:
            cleanText(
              meeting.title,
            ),

          status:
            cleanText(
              meeting.status,
            ),

          starts_at:
            cleanText(
              meeting.starts_at,
            ),

          type:
            cleanText(
              meeting.meeting_type,
            ),

          location:
            cleanText(
              meeting.location,
            ),
        }),
      ),

    whatsapp_history:
      waMessages
        .slice()
        .reverse()
        .map((message: any) => ({
          from:
            message.from_me
              ? 'agent'
              : 'lead',

          text:
            limitText(
              message.text,
              1000,
            ),

          date:
            cleanText(
              message.timestamp,
            ),
        })),

    instagram_history:
      igMessages
        .slice()
        .reverse()
        .map((message: any) => ({
          from:
            message.direction ===
            'outbound'
              ? 'agent'
              : 'lead',

          text:
            limitText(
              message.body,
              1000,
            ),

          date:
            cleanText(
              message.created_at,
            ),
        })),
  };

  /* ---------------------------------------------------------------------- */
  /* AI instructions                                                        */
  /* ---------------------------------------------------------------------- */

  const system = `
You are the MEHANS CRM Sales Intelligence Engine.

You are analyzing exactly ONE real-estate lead.

Return ONLY valid JSON.

The JSON must contain exactly these fields:

summary
intent
objective
budgetFit
propertyFit
keySignals
objections
nextAction
followUpTiming
suggestedProperty
suggestedWhatsappReply

Intent must be:
High
Medium
Low
Unknown

Rules:

Use ONLY information contained in CRM DATA.

Never invent names, prices, properties, budgets, locations,
appointments, conversations, deals, or customer intentions.

If information is missing, use Unknown.

Intent must be supported by actual CRM signals.

The suggested property must exist in the supplied CRM data.

Do not invent property matches.

The WhatsApp draft must be based only on CRM information.

If conversation history exists, match the language used by the lead.

The WhatsApp draft is only a draft.
Never claim that a message was sent.

The nextAction is only a recommendation.
Never claim that the action was executed.

Return raw JSON only.
`.trim();

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
  );

  /* ---------------------------------------------------------------------- */
  /* Parse response                                                         */
  /* ---------------------------------------------------------------------- */

  try {
    const parsed = JSON.parse(
      stripJsonMarkdown(raw),
    );

    const validIntent =
      parsed?.intent === 'High' ||
      parsed?.intent === 'Medium' ||
      parsed?.intent === 'Low'
        ? parsed.intent
        : 'Unknown';

    const keySignals =
      Array.isArray(
        parsed?.keySignals,
      )
        ? parsed.keySignals
            .map((item: unknown) =>
              cleanText(item),
            )
            .filter(
              (
                item,
              ): item is string =>
                Boolean(item),
            )
            .slice(0, 8)
        : [];

    const objections =
      Array.isArray(
        parsed?.objections,
      )
        ? parsed.objections
            .map((item: unknown) =>
              cleanText(item),
            )
            .filter(
              (
                item,
              ): item is string =>
                Boolean(item),
            )
            .slice(0, 8)
        : [];

    return {
      summary:
        cleanText(
          parsed?.summary,
        ) || 'Unknown',

      intent: validIntent,

      objective:
        cleanText(
          parsed?.objective,
        ) || 'Unknown',

      budgetFit:
        cleanText(
          parsed?.budgetFit,
        ) || 'Unknown',

      propertyFit:
        cleanText(
          parsed?.propertyFit,
        ) || 'Unknown',

      keySignals,

      objections,

      nextAction:
        cleanText(
          parsed?.nextAction,
        ) || 'Unknown',

      followUpTiming:
        cleanText(
          parsed?.followUpTiming,
        ) || 'Unknown',

      suggestedProperty:
        cleanText(
          parsed?.suggestedProperty,
        ) || 'Unknown',

      suggestedWhatsappReply:
        cleanText(
          parsed?.suggestedWhatsappReply,
        ) || 'Unknown',
    };
  } catch {
    throw new Error(
      'The AI returned an unexpected format. Please try again.',
    );
  }
}
