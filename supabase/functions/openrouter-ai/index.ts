// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { messages, system, model, locale } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service is not configured. Set OPENROUTER_API_KEY in project secrets." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mehans-crm.local",
        "X-Title": "MEHANS CRM",
      },
      body: JSON.stringify({
        model: model ?? "openai/gpt-4o-mini",
        messages: [{ role: "system", content: system ?? "You are the MEHANS real estate CRM assistant. Give concise, practical answers based only on the supplied CRM context." }, ...messages],
        temperature: 0.4,
        response_format: locale ? { type: "text" } : undefined,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "The AI service is busy. Please wait a moment and try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = result?.error?.message || `AI provider request failed (${response.status})`;
      return new Response(JSON.stringify({ error: msg }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "The AI service returned an empty response. Try rephrasing your request." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to complete AI request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
