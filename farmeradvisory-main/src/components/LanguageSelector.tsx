import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Play, Mic, Check, ChevronDown, Languages, Square } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

interface LanguageSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceUri: string) => void;
  selectedInputLang?: string;
  onInputLangChange?: (langCode: string) => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
}

interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
  isLocal: boolean;
}

interface LanguageGroup {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  voices: VoiceOption[];
}

export const LANGUAGE_CONFIG: Record<string, { label: string; nativeLabel: string; flag: string; speechCode: string }> = {
  "hi": { label: "Hindi", nativeLabel: "हिंदी", flag: "🇮🇳", speechCode: "hi-IN" },
  "te": { label: "Telugu", nativeLabel: "తెలుగు", flag: "🇮🇳", speechCode: "te-IN" },
  "ta": { label: "Tamil", nativeLabel: "தமிழ்", flag: "🇮🇳", speechCode: "ta-IN" },
  "bn": { label: "Bengali", nativeLabel: "বাংলা", flag: "🇮🇳", speechCode: "bn-IN" },
  "pa": { label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", flag: "🇮🇳", speechCode: "pa-IN" },
  "gu": { label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳", speechCode: "gu-IN" },
  "kn": { label: "Kannada", nativeLabel: "ಕನ್ನಡ", flag: "🇮🇳", speechCode: "kn-IN" },
  "ml": { label: "Malayalam", nativeLabel: "മലയാളം", flag: "🇮🇳", speechCode: "ml-IN" },
  "mr": { label: "Marathi", nativeLabel: "मराठी", flag: "🇮🇳", speechCode: "mr-IN" },
  "or": { label: "Odia", nativeLabel: "ଓଡ଼ିଆ", flag: "🇮🇳", speechCode: "or-IN" },
  "as": { label: "Assamese", nativeLabel: "অসমীয়া", flag: "🇮🇳", speechCode: "as-IN" },
  "en": { label: "English", nativeLabel: "English", flag: "🌐", speechCode: "en-IN" },
  "auto": { label: "Auto Detect", nativeLabel: "Auto", flag: "🔄", speechCode: "" },
};

const LANGUAGE_ORDER = ["hi", "te", "ta", "bn", "pa", "gu", "kn", "ml", "mr", "or", "as", "en"];
const OUTPUT_VOICE_STORAGE_KEY = "farmer-advisory-output-voice-mode";

const STORAGE_KEY = "farmer-advisory-voice";
const INPUT_LANG_KEY = "farmer-advisory-input-lang";

export function LanguageSelector({ 
  selectedVoice, 
  onVoiceChange,
  selectedInputLang = "auto",
  onInputLangChange,
  isSpeaking = false,
  onStopSpeaking
}: LanguageSelectorProps) {
  const [languageGroups, setLanguageGroups] = useState<LanguageGroup[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>("");
  const [outputVoiceMode, setOutputVoiceMode] = useState<string>("auto");
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load saved preferences on mount
  useEffect(() => {
    const savedVoice = localStorage.getItem(STORAGE_KEY);
    if (savedVoice && !selectedVoice) {
      onVoiceChange(savedVoice);
    }
    
    const savedInputLang = localStorage.getItem(INPUT_LANG_KEY);
    if (savedInputLang && onInputLangChange) {
      onInputLangChange(savedInputLang);
    }

    const savedOutputMode = localStorage.getItem(OUTPUT_VOICE_STORAGE_KEY);
    if (savedOutputMode) {
      setOutputVoiceMode(savedOutputMode);
    }
  }, []);

  // Save voice preference when changed
  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem(STORAGE_KEY, selectedVoice);
    }
  }, [selectedVoice]);

  // Save input language preference when changed
  useEffect(() => {
    if (selectedInputLang) {
      localStorage.setItem(INPUT_LANG_KEY, selectedInputLang);
    }
  }, [selectedInputLang]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setAllVoices(availableVoices);
      
      const groups: Record<string, LanguageGroup> = {};

      availableVoices.forEach((voice) => {
        const langCode = voice.lang.split("-")[0].toLowerCase();
        const config = LANGUAGE_CONFIG[langCode];

        if (!config || langCode === "auto") return;

        if (!groups[langCode]) {
          groups[langCode] = {
            code: langCode,
            label: config.label,
            nativeLabel: config.nativeLabel,
            flag: config.flag,
            voices: [],
          };
        }

        groups[langCode].voices.push({
          uri: voice.voiceURI,
          name: voice.name
            .replace(/Microsoft|Google|Apple/gi, "")
            .replace(/Online|Natural/gi, "")
            .trim(),
          lang: voice.lang,
          isLocal: voice.localService,
        });
      });

      // Sort voices - prioritize non-local (HD) voices
      Object.values(groups).forEach((group) => {
        group.voices.sort((a, b) => {
          if (!a.isLocal && b.isLocal) return -1;
          if (a.isLocal && !b.isLocal) return 1;
          return a.name.localeCompare(b.name);
        });
      });

      // Use fixed order
      const sortedGroups = LANGUAGE_ORDER
        .filter(code => groups[code])
        .map(code => groups[code]);

      setLanguageGroups(sortedGroups);

      // Auto-select first voice if none selected and not in auto mode
      if (!selectedVoice && sortedGroups.length > 0 && sortedGroups[0].voices.length > 0 && outputVoiceMode !== "auto") {
        onVoiceChange(sortedGroups[0].voices[0].uri);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Chrome needs multiple attempts
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice, onVoiceChange, outputVoiceMode]);

  // Update current language when voice changes
  useEffect(() => {
    for (const group of languageGroups) {
      if (group.voices.some(v => v.uri === selectedVoice)) {
        setCurrentLang(group.code);
        break;
      }
    }
  }, [selectedVoice, languageGroups]);

  const testVoice = useCallback(() => {
    if (isTesting || isSpeaking) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      setIsTesting(false);
      if (onStopSpeaking) onStopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    let voice: SpeechSynthesisVoice | undefined;

    if (outputVoiceMode === "auto" || !selectedVoice) {
      // In auto mode, pick the first Hindi voice or fallback to first available
      voice = voices.find(v => v.lang.startsWith("hi")) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    } else {
      voice = voices.find((v) => v.voiceURI === selectedVoice);
    }

    if (!voice) return;

    setIsTesting(true);

    const langCode = voice.lang.split("-")[0].toLowerCase();
    const testPhrases: Record<string, string> = {
      hi: "नमस्ते, मैं आपका कृषि सलाहकार हूं।",
      te: "నమస్కారం, నేను మీ వ్యవసాయ సలహాదారుడిని.",
      ta: "வணக்கம், நான் உங்கள் வேளாண் ஆலோசகர்.",
      bn: "নমস্কার, আমি আপনার কৃষি উপদেষ্টা।",
      pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਤੁਹਾਡਾ ਖੇਤੀ ਸਲਾਹਕਾਰ ਹਾਂ।",
      gu: "નમસ્તે, હું તમારો કૃષિ સલાહકાર છું.",
      kn: "ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಕೃಷಿ ಸಲಹೆಗಾರ.",
      ml: "നമസ്കാരം, ഞാൻ നിങ്ങളുടെ കാർഷിക ഉപദേഷ്ടാവാണ്.",
      mr: "नमस्कार, मी तुमचा कृषी सल्लागार आहे.",
      en: "Hello, I am your agricultural advisor.",
    };

    const utterance = new SpeechSynthesisUtterance(testPhrases[langCode] || testPhrases.en);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;

    utterance.onend = () => setIsTesting(false);
    utterance.onerror = () => setIsTesting(false);

    window.speechSynthesis.speak(utterance);
  }, [selectedVoice, isTesting, isSpeaking, onStopSpeaking, outputVoiceMode]);

  const handleInputLangChange = useCallback((langCode: string) => {
    if (onInputLangChange) {
      onInputLangChange(langCode);
    }
  }, [onInputLangChange]);

  const handleOutputModeChange = useCallback((mode: string) => {
    setOutputVoiceMode(mode);
    localStorage.setItem(OUTPUT_VOICE_STORAGE_KEY, mode);
  }, []);

  const handleVoiceSelect = useCallback((voiceUri: string, langCode: string) => {
    handleOutputModeChange(langCode);
    onVoiceChange(voiceUri);
  }, [onVoiceChange, handleOutputModeChange]);

  const getOutputModeLabel = () => {
    if (outputVoiceMode === "auto") {
      return { label: "Auto", flag: "🔄" };
    }
    const group = languageGroups.find(g => g.code === outputVoiceMode);
    return group ? { label: group.label, flag: group.flag } : { label: "Voice", flag: "🔊" };
  };

  const outputLabel = getOutputModeLabel();

  // Show a loading state instead of hiding completely when voices are loading
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled className="h-9 px-3 gap-1.5">
          <Volume2 className="w-4 h-4" />
          <span className="text-xs">Loading...</span>
        </Button>
      </div>
    );
  }

  const currentGroup = languageGroups.find(g => g.code === currentLang);
  const currentInputLangConfig = LANGUAGE_CONFIG[selectedInputLang];

  return (
    <div className="flex items-center gap-2">
      {/* Status Display */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
        <Volume2 className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium">
          {outputLabel.flag} {outputLabel.label}
        </span>
        <span className="text-muted-foreground">|</span>
        <Mic className="w-4 h-4 text-secondary-foreground" />
        <span className="text-xs font-medium">
          {currentInputLangConfig?.flag} {currentInputLangConfig?.nativeLabel || "Auto"}
        </span>
      </div>

      {/* Voice Output Selector - Flat list without submenus for better mobile support */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 px-3 gap-1.5 border-border hover:bg-primary/10"
          >
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline text-xs max-w-[80px] truncate">
              {outputLabel.flag} {outputLabel.label}
            </span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-h-[70vh] overflow-y-auto bg-popover border border-border shadow-lg z-[100]" align="end" sideOffset={5}>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
            <Volume2 className="w-4 h-4" />
            Select Output Voice
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Auto Detect Option */}
          <DropdownMenuItem 
            onClick={() => handleOutputModeChange("auto")}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>🔄</span>
              <span>Auto Detect</span>
              <span className="text-muted-foreground text-xs">(matches response language)</span>
            </span>
            {outputVoiceMode === "auto" && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Language groups with their voices as flat list */}
          {languageGroups.map((group) => (
            <div key={group.code}>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-1.5 flex items-center gap-2">
                <span>{group.flag}</span>
                <span>{group.label}</span>
                <span>({group.nativeLabel})</span>
              </DropdownMenuLabel>
              {group.voices.slice(0, 3).map((voice) => (
                <DropdownMenuItem 
                  key={voice.uri}
                  onClick={() => handleVoiceSelect(voice.uri, group.code)}
                  className="flex items-center justify-between cursor-pointer pl-6"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate max-w-[140px]">{voice.name || "Default"}</span>
                    {!voice.isLocal && (
                      <span className="text-[10px] px-1 py-0.5 bg-primary/20 text-primary rounded">HD</span>
                    )}
                  </span>
                  {selectedVoice === voice.uri && outputVoiceMode !== "auto" && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Speech Input Language Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 px-3 gap-1.5 border-border hover:bg-secondary/10"
          >
            <Mic className="w-4 h-4 text-secondary-foreground" />
            <span className="text-xs max-w-[100px] truncate">
              {currentInputLangConfig?.flag} {currentInputLangConfig?.nativeLabel || "Auto"}
            </span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto bg-popover border border-border shadow-lg z-[100]" align="end" sideOffset={5}>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
            <Languages className="w-4 h-4" />
            Speech Input Language
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => handleInputLangChange("auto")}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>🔄</span>
              <span>Auto Detect</span>
            </span>
            {selectedInputLang === "auto" && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {LANGUAGE_ORDER.map((code) => {
            const config = LANGUAGE_CONFIG[code];
            if (!config) return null;
            return (
              <DropdownMenuItem 
                key={code}
                onClick={() => handleInputLangChange(code)}
                className="flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>{config.flag}</span>
                  <span>{config.label}</span>
                  <span className="text-muted-foreground text-xs">({config.nativeLabel})</span>
                </span>
                {selectedInputLang === code && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Test / Stop Voice Button */}
      <Button
        variant="outline"
        size="icon"
        className={`h-9 w-9 ${isTesting || isSpeaking ? "bg-destructive/10 hover:bg-destructive/20 border-destructive/30" : "hover:bg-primary/10"}`}
        onClick={testVoice}
        title={isTesting || isSpeaking ? "Stop speaking" : "Test selected voice"}
      >
        {isTesting || isSpeaking ? (
          <Square className="w-4 h-4 text-destructive" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}