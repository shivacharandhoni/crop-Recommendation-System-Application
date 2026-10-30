import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert agricultural plant pathologist AI. A farmer has uploaded an image of their crop. Analyze the image carefully and provide:

1. **Disease Identified**: Name the disease (or say "Healthy" if no disease detected)
2. **Confidence**: Your confidence level (High/Medium/Low)
3. **Symptoms Observed**: What visible symptoms you see in the image
4. **Cause**: What causes this disease (fungus, bacteria, virus, nutrient deficiency, etc.)
5. **Recommended Treatment**: Safe, general treatment suggestions
6. **Prevention Tips**: How to prevent this in the future
7. **When to Seek Help**: When the farmer should consult a local agriculture officer

LANGUAGE RULES:
- Detect the language of the farmer's message and respond in that SAME language.
- Supported: English, Hindi, Telugu, Tamil, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Marathi, Odia, Assamese.

SAFETY RULES (CRITICAL):
- NEVER give exact chemical dosages or specific pesticide quantities
- Only recommend general categories of treatment (e.g., "use a copper-based fungicide as recommended on the label")
- Always advise reading product labels for dosage
- For severe infections, ALWAYS recommend consulting a local agriculture officer or Krishi Vigyan Kendra
- Prioritize organic/IPM solutions when possible

Format your response clearly with headers and bullet points for easy reading.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, message, language } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = message || (language === "hi" ? "इस फसल की बीमारी पहचानें और उपचार बताएं" : "Identify the disease in this crop image and suggest treatment");

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
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
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
        JSON.stringify({ error: "Failed to analyze image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "Unable to analyze the image.";

    return new Response(
      JSON.stringify({ success: true, analysis: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Disease detection error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
