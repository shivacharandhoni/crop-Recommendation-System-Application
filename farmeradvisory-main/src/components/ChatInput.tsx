import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceButton } from "./VoiceButton";

interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
  isProcessing: boolean;
  disabled?: boolean;
  interimTranscript?: string;
}

export function ChatInput({
  onSend,
  onVoiceStart,
  onVoiceStop,
  isListening,
  isProcessing,
  disabled,
  interimTranscript,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceClick = () => {
    if (isListening) {
      onVoiceStop();
    } else {
      onVoiceStart();
    }
  };

  return (
    <div className="bg-card/95 backdrop-blur-md border-t border-border p-4 shadow-card">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question about farming..."
            className="min-h-[52px] max-h-32 resize-none pr-12 bg-background border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/40 rounded-xl transition-all"
            disabled={disabled || isListening}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            size="icon"
            className="absolute right-2 bottom-2 w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 shadow-soft hover:shadow-card transition-all"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <VoiceButton
          isListening={isListening}
          isProcessing={isProcessing}
          onClick={handleVoiceClick}
          disabled={disabled}
        />
      </div>

      {isListening && (
        <div className="flex flex-col items-center gap-2 mt-3 py-3 px-4 bg-primary/10 rounded-xl max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm text-primary font-medium">
              Listening... Speak now
            </p>
          </div>
          {interimTranscript && (
            <p className="text-sm text-muted-foreground italic text-center">
              "{interimTranscript}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
