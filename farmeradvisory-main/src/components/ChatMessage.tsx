import { Leaf, User, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onSpeak?: () => void;
  isSpeaking?: boolean;
}

export function ChatMessage({ role, content, onSpeak, isSpeaking }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        isAssistant ? "justify-start" : "justify-end"
      }`}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-10 h-10 rounded-xl hero-gradient flex items-center justify-center shadow-soft">
          <Leaf className="w-5 h-5 text-primary-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <div className={isAssistant ? "chat-bubble-assistant" : "chat-bubble-farmer"}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>

        {isAssistant && onSpeak && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSpeak}
            className={`self-start gap-1.5 h-7 px-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-lg ${
              isSpeaking ? "text-primary bg-primary/10" : ""
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Listen</span>
              </>
            )}
          </Button>
        )}
      </div>

      {!isAssistant && (
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shadow-soft">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
