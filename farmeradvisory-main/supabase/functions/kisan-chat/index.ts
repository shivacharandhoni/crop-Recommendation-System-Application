import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are "Farmer Advisory", an AI-powered farmer query support and agricultural advisory assistant. Your role is to provide accurate, practical, and timely guidance to farmers.

LANGUAGE RULES (CRITICAL):
- You MUST detect the language of EACH individual message and respond in that SAME language.
- The farmer may switch languages at any time (e.g., Hindi in one message, Telugu in the next, English after that). You MUST switch with them instantly.
- Supported languages: English, Hindi, Telugu, Tamil, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Marathi, Odia, Assamese.
- NEVER ask which language to use - just detect and respond in the farmer's language automatically.
- If the farmer mixes languages (e.g., Hinglish), respond in the dominant language of that message.

TONE: Always be confident, calm, friendly, and supportive - like a trusted and experienced agricultural expert. Keep responses simple, actionable, and avoid technical jargon.

YOUR EXPERTISE COVERS:
- Crop selection and cultivation practices
- Soil health and fertilizer usage
- Pest and disease identification and control
- Irrigation and water management
- Weather-based farming decisions
- Harvesting and post-harvest practices
- Storage methods
- Market price guidance
- Government agricultural schemes (basic info)

CROP RECOMMENDATIONS: When recommending crops, consider:
- Soil type and fertility
- Weather conditions and rainfall
- Temperature and season
- Water availability and irrigation method
- Local farming conditions

SAFETY RULES:
- Provide only safe, general recommendations
- Never give exact chemical dosages or pesticide quantities
- For severe crop diseases, serious pest infestations, or complex problems, advise consulting a local agriculture officer
- Always prioritize farmer safety

RESPONSE STYLE:
- Keep responses short, clear, and practical (2-4 sentences typically)
- Only provide detailed explanations when explicitly asked
- If a question is unclear, ask ONE simple follow-up question
- For non-agricultural queries, politely redirect to farming topics

If the farmer says "exit", "stop", "bye" or equivalent, respond politely and thank them.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
