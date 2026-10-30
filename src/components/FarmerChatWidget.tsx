import { FormEvent, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export default function FarmerChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sendMessage, isLoading } = useAIChat();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    const history = [...messages, userMessage];
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setError(null);

    try {
      await sendMessage({
        messages: history.map(({ role, content: message }) => ({ role, content: message })),
        onDelta: (chunk) => {
          setMessages((current) => current.map((item) =>
            item.id === assistantId ? { ...item, content: item.content + chunk } : item,
          ));
          requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        },
        onDone: () => undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get a reply. Please try again.");
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {open && (
        <section className="mb-3 flex h-[min(520px,calc(100dvh-110px))] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-emerald-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"><Bot className="h-5 w-5" /></span>
              <div><p className="font-semibold">Crop Assistant</p><p className="text-xs text-emerald-100">Ask about crops, soil, or schemes</p></div>
            </div>
            <button aria-label="Close chat" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/15"><X className="h-4 w-4" /></button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7faf6] p-4">
            {messages.length === 0 && (
              <div className="rounded-2xl rounded-tl-md bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">
                Namaste! I can help with crop choices, soil conditions, disease questions, and farming schemes.
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === "user" ? "ml-auto rounded-tr-md bg-emerald-700 text-white" : "rounded-tl-md bg-white text-slate-700 shadow-sm"}`}>
                {message.content || (isLoading && message.role === "assistant" ? "Thinking…" : "")}
              </div>
            ))}
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask a crop question…" aria-label="Message the crop assistant" className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm outline-none ring-emerald-600 placeholder:text-slate-400 focus:ring-2" />
            <button type="submit" disabled={!draft.trim() || isLoading} aria-label="Send message" className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </section>
      )}
      <button onClick={() => setOpen((value) => !value)} aria-label={open ? "Close farmer chat" : "Open farmer chat"} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl transition hover:scale-105 hover:bg-emerald-800">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
