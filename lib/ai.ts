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
