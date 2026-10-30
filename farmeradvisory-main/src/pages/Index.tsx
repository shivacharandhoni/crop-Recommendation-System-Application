import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { WelcomeHero } from "@/components/WelcomeHero";
import { LanguageSelector, LANGUAGE_CONFIG } from "@/components/LanguageSelector";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { OfflineIndicator, OfflineBadge } from "@/components/OfflineIndicator";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";
import { useAIChat } from "@/hooks/useAIChat";
import { useChatHistory } from "@/hooks/useChatHistory";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, History } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
}

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputLanguage, setInputLanguage] = useState("auto");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageVoice = useRef(false);
  const lastSentRef = useRef<string>("");
  const pendingVoiceRef = useRef<string | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: voiceSupported,
    setLanguage: setSpeechLanguage,
  } = useSpeechRecognition();

  const { speak, stop: stopSpeaking, isSpeaking, isLoading: ttsLoading, selectedVoice, setSelectedVoice } = useTTS();
  const { sendMessage: sendAIMessage } = useAIChat();
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    isOnline,
    isSyncing,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    saveMessage,
    loadMessages,
  } = useChatHistory();

  // Update speech recognition language when input language changes
  useEffect(() => {
    const langConfig = LANGUAGE_CONFIG[inputLanguage];
    setSpeechLanguage(langConfig?.speechCode || "");
  }, [inputLanguage, setSpeechLanguage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle voice transcript with debouncing to prevent duplicate sends
  useEffect(() => {
    if (transcript && !isListening) {
      pendingVoiceRef.current = transcript;
      
      const timer = setTimeout(() => {
        const pending = pendingVoiceRef.current;
        if (pending && pending !== lastSentRef.current && !isProcessing) {
          lastSentRef.current = pending;
          handleSendMessage(pending, true);
        }
        pendingVoiceRef.current = null;
        resetTranscript();
      }, 800); // Longer debounce for better Indian language capture

      return () => clearTimeout(timer);
    }
  }, [transcript, isListening, isProcessing]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId).then((loadedMessages) => {
        setMessages(
          loadedMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            isVoice: m.is_voice,
          }))
        );
      });
    } else {
      setMessages([]);
    }
  }, [currentConversationId, loadMessages]);

  const handleSendMessage = useCallback(async (content: string, isVoice = false) => {
    if (!content.trim() || isProcessing) return;

    lastMessageVoice.current = isVoice;

    // Ensure we have a conversation
    let conversationId = currentConversationId;
    if (!conversationId) {
      // Create conversation with first message as title
      const title = content.trim().slice(0, 50) + (content.length > 50 ? "..." : "");
      conversationId = await createConversation(title);
      if (!conversationId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create conversation",
        });
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      isVoice,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    // Save user message to database
    await saveMessage(conversationId, "user", content.trim(), isVoice);

    // Build conversation history for AI
    const conversationHistory = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let assistantContent = "";
    const assistantId = (Date.now() + 1).toString();

    try {
      await sendAIMessage({
        messages: conversationHistory,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === assistantId) {
              return prev.map((m) =>
                m.id === assistantId ? { ...m, content: assistantContent } : m
              );
            }
            return [
              ...prev,
              { id: assistantId, role: "assistant", content: assistantContent },
            ];
          });
        },
        onDone: async () => {
          setIsProcessing(false);
          // Save assistant message to database
          if (assistantContent && conversationId) {
            await saveMessage(conversationId, "assistant", assistantContent);
          }
          // If user spoke, respond with voice
          if (isVoice && assistantContent) {
            speak(assistantContent);
          }
        },
      });
    } catch (error) {
      console.error("Error:", error);
      setIsProcessing(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response. Please try again.",
      });
    }
  }, [messages, sendAIMessage, speak, toast, currentConversationId, createConversation, saveMessage]);

  const handleVoiceStart = () => {
    if (!voiceSupported) {
      toast({
        variant: "destructive",
        title: "Voice not supported",
        description: "Your browser doesn't support voice input.",
      });
      return;
    }
    startListening();
  };

  const handleSpeak = (content: string) => {
    speak(content);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen sky-gradient">
      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 shadow-card sticky top-0 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </Button>

              <div className="relative">
                <div className="w-11 h-11 rounded-xl hero-gradient flex items-center justify-center shadow-elevated transform hover:scale-105 transition-transform">
                  <span className="text-xl">🌾</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center shadow-soft border-2 border-card">
                  <Sparkles className="w-3 h-3 text-secondary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-foreground text-lg tracking-tight">Farmer Advisory</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-leaf rounded-full animate-pulse"></span>
                    AI Agricultural Advisor
                  </p>
                  <OfflineBadge isOnline={isOnline} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* History button for desktop */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                History
              </Button>

              <LanguageSelector 
                selectedVoice={selectedVoice} 
                onVoiceChange={setSelectedVoice}
                selectedInputLang={inputLanguage}
                onInputLangChange={setInputLanguage}
                isSpeaking={isSpeaking}
                onStopSpeaking={stopSpeaking}
              />
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="max-w-4xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              <WelcomeHero onQuickQuestion={(q) => handleSendMessage(q, false)} />
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    onSpeak={
                      message.role === "assistant"
                        ? () => handleSpeak(message.content)
                        : undefined
                    }
                    isSpeaking={isSpeaking}
                  />
                ))}

                {isProcessing && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="w-10 h-10 rounded-full hero-gradient flex items-center justify-center shadow-soft">
                      <span className="text-lg">🌾</span>
                    </div>
                    <div className="chat-bubble-assistant">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <ChatInput
          onSend={handleSendMessage}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={stopListening}
          isListening={isListening}
          isProcessing={isProcessing}
          disabled={isProcessing || !isOnline}
          interimTranscript={interimTranscript}
        />
        
        {/* Offline Indicator */}
        <OfflineIndicator isOnline={isOnline} isSyncing={isSyncing} />
      </div>
    </div>
  );
}
