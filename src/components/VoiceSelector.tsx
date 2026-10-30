import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Volume2 } from "lucide-react";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceUri: string) => void;
}

interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
}

export function VoiceSelector({ selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }
    
    setIsSupported(true);
    
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      // Filter to show Indian languages + English voices
      const relevantVoices = availableVoices
        .filter((v) => {
          const lang = v.lang.toLowerCase();
          return (
            lang.includes("hi") || // Hindi
            lang.includes("te") || // Telugu
            lang.includes("ta") || // Tamil
            lang.includes("bn") || // Bengali
            lang.includes("pa") || // Punjabi
            lang.includes("gu") || // Gujarati
            lang.includes("kn") || // Kannada
            lang.includes("ml") || // Malayalam
            lang.includes("mr") || // Marathi
            lang.startsWith("en")  // English
          );
        })
        .map((v) => ({
          uri: v.voiceURI,
          name: v.name.replace(/Microsoft|Google|Apple/gi, "").trim(),
          lang: v.lang,
        }))
        .sort((a, b) => {
          // Prioritize Indian languages
          const aIndian = !a.lang.startsWith("en");
          const bIndian = !b.lang.startsWith("en");
          if (aIndian && !bIndian) return -1;
          if (!aIndian && bIndian) return 1;
          return a.name.localeCompare(b.name);
        });

      setVoices(relevantVoices);

      // Auto-select first voice if none selected
      if (!selectedVoice && relevantVoices.length > 0) {
        onVoiceChange(relevantVoices[0].uri);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice, onVoiceChange]);

  if (!isSupported || voices.length === 0) {
    return null;
  }

  const getLangLabel = (lang: string): string => {
    const langMap: Record<string, string> = {
      "hi": "हिंदी",
      "te": "తెలుగు",
      "ta": "தமிழ்",
      "bn": "বাংলা",
      "pa": "ਪੰਜਾਬੀ",
      "gu": "ગુજરાતી",
      "kn": "ಕನ್ನಡ",
      "ml": "മലയാളം",
      "mr": "मराठी",
      "en": "English",
    };
    const base = lang.split("-")[0].toLowerCase();
    return langMap[base] || lang;
  };

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="w-4 h-4 text-muted-foreground" />
      <Select value={selectedVoice} onValueChange={onVoiceChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs bg-background border-border">
          <SelectValue placeholder="Select voice" />
        </SelectTrigger>
        <SelectContent className="max-h-60 bg-popover border-border">
          {voices.map((voice) => (
            <SelectItem key={voice.uri} value={voice.uri} className="text-xs">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{getLangLabel(voice.lang)}</span>
                <span className="truncate">{voice.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
