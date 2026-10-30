import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice IDs for different languages (ElevenLabs multilingual voices)
const VOICE_MAP: Record<string, string> = {
  "hi": "pFZP5JQG7iQjIQuC4Bku", // Lily - works well for Hindi
  "te": "pFZP5JQG7iQjIQuC4Bku", // Lily
  "en": "JBFqnCBsd6RMkjVDRZzb", // George - clear English
  "default": "JBFqnCBsd6RMkjVDRZzb",
};

// Language detection patterns
const languagePatterns: { lang: string; pattern: RegExp }[] = [
  { lang: "hi", pattern: /[\u0900-\u097F]/ }, // Hindi (Devanagari)
  { lang: "te", pattern: /[\u0C00-\u0C7F]/ }, // Telugu
  { lang: "ta", pattern: /[\u0B80-\u0BFF]/ }, // Tamil
  { lang: "bn", pattern: /[\u0980-\u09FF]/ }, // Bengali
  { lang: "pa", pattern: /[\u0A00-\u0A7F]/ }, // Punjabi
  { lang: "gu", pattern: /[\u0A80-\u0AFF]/ }, // Gujarati
  { lang: "kn", pattern: /[\u0C80-\u0CFF]/ }, // Kannada
  { lang: "ml", pattern: /[\u0D00-\u0D7F]/ }, // Malayalam
];

function detectLanguage(text: string): string {
  for (const { lang, pattern } of languagePatterns) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  return "en";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      // Fallback: Return empty response so browser TTS can be used
      console.log("No ElevenLabs API key, client should use browser TTS");
      return new Response(
        JSON.stringify({ useBrowserTTS: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect language and select appropriate voice
    const lang = detectLanguage(text);
    const voiceId = VOICE_MAP[lang] || VOICE_MAP["default"];
    
    console.log(`Generating TTS for language: ${lang}, voice: ${voiceId}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.substring(0, 5000), // Limit text length
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", errorText);
      return new Response(
        JSON.stringify({ useBrowserTTS: true, error: errorText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS Error:", error);
    return new Response(
      JSON.stringify({ useBrowserTTS: true, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
