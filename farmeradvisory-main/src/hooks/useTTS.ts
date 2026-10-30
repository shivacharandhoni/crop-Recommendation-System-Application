import { useState, useCallback, useRef, useEffect } from "react";

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
  selectedVoice: string;
  setSelectedVoice: (voiceUri: string) => void;
  outputVoiceMode: string;
  setOutputVoiceMode: (mode: string) => void;
}

// Language detection patterns with Unicode ranges for Indian languages
const languagePatterns: { lang: string; pattern: RegExp; priority: number }[] = [
  { lang: "te-IN", pattern: /[\u0C00-\u0C7F]/, priority: 1 },
  { lang: "kn-IN", pattern: /[\u0C80-\u0CFF]/, priority: 1 },
  { lang: "ml-IN", pattern: /[\u0D00-\u0D7F]/, priority: 1 },
  { lang: "ta-IN", pattern: /[\u0B80-\u0BFF]/, priority: 1 },
  { lang: "bn-IN", pattern: /[\u0980-\u09FF]/, priority: 1 },
  { lang: "as-IN", pattern: /[\u0980-\u09FF]/, priority: 2 },
  { lang: "pa-IN", pattern: /[\u0A00-\u0A7F]/, priority: 1 },
  { lang: "gu-IN", pattern: /[\u0A80-\u0AFF]/, priority: 1 },
  { lang: "or-IN", pattern: /[\u0B00-\u0B7F]/, priority: 1 },
  { lang: "mr-IN", pattern: /[\u0900-\u097F]/, priority: 2 },
  { lang: "hi-IN", pattern: /[\u0900-\u097F]/, priority: 3 },
];

const languageKeywords: Record<string, RegExp> = {
  "mr-IN": /\b(आहे|आहेत|करा|होतो|आणि|तुम्ही|तुमच|हे|ते|मी|माझ|काय|कसे|कोण|केव्हा|कुठे)\b/,
  "bn-IN": /\b(করুন|হয়|আছে|আমি|তুমি|আপনি|এই|সেই|কি|কেন|কোথায়|কখন)\b/,
  "as-IN": /\b(কৰক|হয়|আছে|মই|তুমি|আপুনি|এই|সেই|কি|কিয়|ক'ত|কেতিয়া)\b/,
};

function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "en-US";
  
  for (const [lang, pattern] of Object.entries(languageKeywords)) {
    if (pattern.test(text)) return lang;
  }
  
  const matches: { lang: string; count: number; priority: number }[] = [];
  for (const { lang, pattern, priority } of languagePatterns) {
    const matchCount = (text.match(new RegExp(pattern.source, 'g')) || []).length;
    if (matchCount > 0) matches.push({ lang, count: matchCount, priority });
  }
  
  if (matches.length === 0) {
    return /[a-zA-Z]/.test(text) ? "en-IN" : "en-US";
  }
  
  matches.sort((a, b) => b.count !== a.count ? b.count - a.count : a.priority - b.priority);
  return matches[0].lang;
}

// Preferred voice name patterns ranked by quality
const PREFERRED_VOICE_PATTERNS = [
  "Google", "Microsoft", "Samantha", "Karen", "Daniel", "Moira",
  "Rishi", "Lekha", "Veena", "Premium", "Enhanced", "Natural",
];

function getBestVoice(
  voices: SpeechSynthesisVoice[],
  langCode: string,
  preferredUri?: string
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (preferredUri) {
    const preferred = voices.find((v) => v.voiceURI === preferredUri);
    if (preferred) return preferred;
  }

  const baseLang = langCode.split("-")[0].toLowerCase();
  
  // Get all voices matching this language
  const exactMatches = voices.filter(v => v.lang.toLowerCase() === langCode.toLowerCase());
  const baseMatches = voices.filter(v => v.lang.toLowerCase().startsWith(baseLang));
  const candidates = exactMatches.length > 0 ? exactMatches : baseMatches;

  if (candidates.length > 0) {
    // Score each candidate voice by quality
    for (const pattern of PREFERRED_VOICE_PATTERNS) {
      const match = candidates.find(v => v.name.includes(pattern));
      if (match) return match;
    }
    // Prefer non-local (network) voices as they sound better
    const networkVoice = candidates.find(v => !v.localService);
    if (networkVoice) return networkVoice;
    return candidates[0];
  }

  // Fallback to English
  const english = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"));
  return english || voices[0];
}

// Split text into natural chunks for smoother speech
function splitTextIntoChunks(text: string, maxLen = 200): string[] {
  if (text.length <= maxLen) return [text];
  
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?।\n])\s+/);
  let current = "";
  
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [outputVoiceMode, setOutputVoiceMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("farmer-advisory-output-voice-mode") || "auto";
    }
    return "auto";
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakingCheckRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      console.log("TTS voices loaded:", availableVoices.length);
      if (availableVoices.length > 0) setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
      if (speakingCheckRef.current) clearInterval(speakingCheckRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (speakingCheckRef.current) {
      clearInterval(speakingCheckRef.current);
      speakingCheckRef.current = null;
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speakChunk = useCallback(
    (text: string, voice: SpeechSynthesisVoice | null, lang: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (cancelledRef.current) { resolve(); return; }

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = lang;
        }

        // Tuned for natural-sounding speech
        utterance.rate = 0.92;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;

        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          if (event.error === "interrupted" || event.error === "canceled") {
            resolve();
          } else {
            reject(new Error(event.error));
          }
        };

        window.speechSynthesis.speak(utterance);

        // Chrome workaround
        setTimeout(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 100);
      });
    },
    []
  );

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        throw new Error("Speech synthesis not supported");
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      if (speakingCheckRef.current) clearInterval(speakingCheckRef.current);
      cancelledRef.current = false;

      setIsLoading(true);
      setIsSpeaking(false);

      const currentVoices = window.speechSynthesis.getVoices();
      const voicesToUse = currentVoices.length > 0 ? currentVoices : voices;
      
      const lang = detectLanguage(text);
      const voiceToUse = outputVoiceMode === "auto" ? undefined : selectedVoice;
      const voice = getBestVoice(voicesToUse, lang, voiceToUse);

      console.log("TTS speaking:", { lang, voice: voice?.name, textLength: text.length, mode: outputVoiceMode });

      // Split into chunks for smoother playback (avoids browser cutting off long text)
      const chunks = splitTextIntoChunks(text);

      setIsLoading(false);
      setIsSpeaking(true);

      // Monitor speaking state
      speakingCheckRef.current = window.setInterval(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          if (speakingCheckRef.current) {
            clearInterval(speakingCheckRef.current);
            speakingCheckRef.current = null;
          }
          setIsSpeaking(false);
        }
      }, 500);

      try {
        // Small delay to ensure cancel completed
        await new Promise(r => setTimeout(r, 50));

        for (const chunk of chunks) {
          if (cancelledRef.current) break;
          await speakChunk(chunk, voice, lang);
        }
      } catch (err) {
        console.error("TTS error:", err);
      } finally {
        if (speakingCheckRef.current) {
          clearInterval(speakingCheckRef.current);
          speakingCheckRef.current = null;
        }
        setIsSpeaking(false);
        setIsLoading(false);
      }
    },
    [selectedVoice, voices, outputVoiceMode, speakChunk]
  );

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    selectedVoice,
    setSelectedVoice,
    outputVoiceMode,
    setOutputVoiceMode,
  };
}
