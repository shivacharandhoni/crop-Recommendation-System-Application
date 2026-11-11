import { useState, useCallback, useRef, useEffect } from "react";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
  setLanguage: (langCode: string) => void;
  currentLanguage: string;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState("");
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isActiveRef = useRef(false);
  const finalTranscriptRef = useRef("");

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* Browser may already have stopped recognition. */ }
    }
    
    // Set final transcript
    if (finalTranscriptRef.current) {
      setTranscript(finalTranscriptRef.current.trim());
    }
    setInterimTranscript("");
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    // Clean up any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // Reset state
    isActiveRef.current = true;
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setIsListening(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configuration - use continuous mode for better capture
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentLanguage || ""; // Empty for auto-detect

    recognition.onstart = () => undefined;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        const confidence = result[0].confidence;
        
        if (result.isFinal) {
          // Only accept results with reasonable confidence (> 0.3)
          // This filters out garbage recognition for Indian languages
          if (confidence > 0.3 || confidence === 0) {
            final += text + " ";
          }
        } else {
          interim += text;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current.trim());
      }
      
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // No speech detected, restart if still active
        if (isActiveRef.current) {
          setTimeout(() => {
            if (isActiveRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch { /* Wait for the browser's next recognition event. */ }
            }
          }, 100);
        }
        return;
      }

      if (event.error === "aborted") {
        return;
      }

      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access.");
        isActiveRef.current = false;
        setIsListening(false);
        return;
      }

      if (event.error === "network") {
        setError("Network error. Please check your connection.");
        isActiveRef.current = false;
        setIsListening(false);
        return;
      }

      setError(`Speech error: ${event.error}`);
      isActiveRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isActiveRef.current) {
        setTimeout(() => {
          if (isActiveRef.current) {
            try {
              recognition.start();
            } catch {
              // Create new instance and start
              startListening();
            }
          }
        }, 50);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Failed to start voice recognition");
      setIsListening(false);
      isActiveRef.current = false;
    }
  }, [isSupported, currentLanguage]);

  const setLanguage = useCallback((langCode: string) => {
    // Stop current recognition if running
    if (isActiveRef.current) {
      stopListening();
    }
    setCurrentLanguage(langCode);
  }, [stopListening]);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
    setLanguage,
    currentLanguage,
  };
}
