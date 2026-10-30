import { useState, useCallback, useRef, useEffect } from "react";

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

// Language detection patterns
const languagePatterns: { lang: string; pattern: RegExp }[] = [
  { lang: "hi-IN", pattern: /[\u0900-\u097F]/ }, // Hindi (Devanagari)
  { lang: "pa-IN", pattern: /[\u0A00-\u0A7F]/ }, // Punjabi (Gurmukhi)
  { lang: "bn-IN", pattern: /[\u0980-\u09FF]/ }, // Bengali
  { lang: "ta-IN", pattern: /[\u0B80-\u0BFF]/ }, // Tamil
  { lang: "te-IN", pattern: /[\u0C00-\u0C7F]/ }, // Telugu
  { lang: "mr-IN", pattern: /[\u0900-\u097F]/ }, // Marathi (also Devanagari)
  { lang: "gu-IN", pattern: /[\u0A80-\u0AFF]/ }, // Gujarati
  { lang: "kn-IN", pattern: /[\u0C80-\u0CFF]/ }, // Kannada
  { lang: "ml-IN", pattern: /[\u0D00-\u0D7F]/ }, // Malayalam
  { lang: "or-IN", pattern: /[\u0B00-\u0B7F]/ }, // Odia
  { lang: "ar", pattern: /[\u0600-\u06FF]/ }, // Arabic
  { lang: "zh-CN", pattern: /[\u4E00-\u9FFF]/ }, // Chinese
  { lang: "ja-JP", pattern: /[\u3040-\u309F\u30A0-\u30FF]/ }, // Japanese
  { lang: "ko-KR", pattern: /[\uAC00-\uD7AF]/ }, // Korean
];

function detectLanguage(text: string): string {
  // Check for Indian and other scripts
  for (const { lang, pattern } of languagePatterns) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  // Default to English
  return "en-US";
}

function getBestVoice(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Get the base language code (e.g., "hi" from "hi-IN")
  const baseLang = langCode.split("-")[0].toLowerCase();

  // Priority 1: Exact match with high quality voices
  const exactMatch = voices.find(
    (v) => v.lang.toLowerCase() === langCode.toLowerCase() && 
    (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Premium") || v.localService === false)
  );
  if (exactMatch) return exactMatch;

  // Priority 2: Any exact match
  const anyExact = voices.find((v) => v.lang.toLowerCase() === langCode.toLowerCase());
  if (anyExact) return anyExact;

  // Priority 3: Same base language with quality preference
  const baseLangMatch = voices.find(
    (v) => v.lang.toLowerCase().startsWith(baseLang) &&
    (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Premium") || v.localService === false)
  );
  if (baseLangMatch) return baseLangMatch;

  // Priority 4: Any same base language
  const anyBaseLang = voices.find((v) => v.lang.toLowerCase().startsWith(baseLang));
  if (anyBaseLang) return anyBaseLang;

  // Priority 5: English fallback (for mixed content)
  const englishVoice = voices.find(
    (v) => v.lang.startsWith("en") && 
    (v.name.includes("Google") || v.name.includes("Microsoft") || v.localService === false)
  );
  if (englishVoice) return englishVoice;

  // Last resort: first available voice
  return voices[0];
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        console.log("Available TTS voices:", availableVoices.map(v => `${v.name} (${v.lang})`));
      }
    };

    // Load immediately if available
    loadVoices();

    // Also listen for voices changed event (needed for some browsers)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Detect language from text
    const detectedLang = detectLanguage(text);
    console.log("Detected language:", detectedLang);

    // Get the best voice for this language
    const selectedVoice = getBestVoice(voices, detectedLang);
    console.log("Selected voice:", selectedVoice?.name, selectedVoice?.lang);

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set the voice if we found one
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = detectedLang;
    }

    // Optimize settings for clarity - slower rate for Indian languages
    const isIndianLang = detectedLang.endsWith("-IN") || ["hi", "te", "ta", "mr", "gu", "kn", "ml", "bn", "pa", "or"].some(l => detectedLang.startsWith(l));
    utterance.rate = isIndianLang ? 0.75 : 0.85; // Even slower for Indian languages for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, voices]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
  };
}
