import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function VoiceButton({ isListening, isProcessing, onClick, disabled }: VoiceButtonProps) {
  return (
    <div className="relative">
      {isListening && (
        <>
          <span className="pulse-ring w-16 h-16 -top-1 -left-1" style={{ animationDelay: "0s" }} />
          <span className="pulse-ring w-16 h-16 -top-1 -left-1" style={{ animationDelay: "0.5s" }} />
          <span className="pulse-ring w-16 h-16 -top-1 -left-1" style={{ animationDelay: "1s" }} />
        </>
      )}
      
      <Button
        onClick={onClick}
        disabled={disabled || isProcessing}
        className={`voice-button w-14 h-14 rounded-full shadow-elevated transition-all duration-300 hover:scale-105 active:scale-95 ${
          isListening 
            ? "animate-glow ring-4 ring-primary/30" 
            : ""
        }`}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
        ) : isListening ? (
          <MicOff className="w-6 h-6 text-primary-foreground" />
        ) : (
          <Mic className="w-6 h-6 text-primary-foreground" />
        )}
      </Button>
    </div>
  );
}
