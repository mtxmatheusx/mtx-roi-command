import { useState, useRef, useEffect } from "react";
import { X, Send, Brain, Loader2, Rocket, Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useChatHistory, Msg } from "@/hooks/useChatHistory";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface CampaignAction {
  action: string;
  campaign_name: string;
  objective: string;
  daily_budget: number;
  targeting_notes?: string;
  reasoning?: string;
}

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

function parseMtxAction(content: string): CampaignAction | null {
  const match = content.match(/```mtx-action\s*([\s\S]*?)```/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

function stripMtxAction(content: string): string {
  return content.replace(/```mtx-action\s*[\s\S]*?```/g, "").trim();
}

async function streamChat({
  messages, campaignData, mode, profileId, onDelta, onDone, onError,
}: {
  messages: Msg[]; campaignData?: unknown; mode: string; profileId?: string;
  onDelta: (t: string) => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const resp = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, campaignData, mode, profileId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
    onError(err.error || `Erro ${resp.status}`);
    return;
  }
  if (!resp.body) { onError("Sem resposta do servidor"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo } = useClientProfiles();
  const { toast } = useToast();

  const {
    conversations, activeConversationId, messages, setMessages,
    loadingHistory, loadMessages, createConversation, saveMessage,
    startNewChat, deleteConversation,
  } = useChatHistory();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const campaignContext = activeProfile
    ? { perfil: activeProfile.name, cpa_meta: cpaMeta, ticket_medio: ticketMedio, limite_escala: limiteEscala, budget_maximo: budgetMaximo }
    : undefined;

  const handleExecuteAction = (action: CampaignAction) => {
    navigate("/lancar-campanha", {
      state: {
        prefill: {
          campaign_name: action.campaign_name,
          objective: action.objective,
          daily_budget: action.daily_budget,
          targeting_notes: action.targeting_notes || "",
        },
        reasoning: action.reasoning || "",
      },
    });
    setOpen(false);
    toast({ title: "🚀 Campanha carregada", description: "Revise os detalhes e clique em Publicar." });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };

    // Determine conversation ID
    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(text);
      if (!convId) {
        toast({ title: "Erro", description: "Não foi possível criar conversa.", variant: "destructive" });
        return;
      }
    }

    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    // Save user message
    await saveMessage(convId, "user", text);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") {
          return p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...p, { role: "assistant", content: assistantSoFar }];
      });
    };

    const finalConvId = convId;
    await streamChat({
      messages: [...messages, userMsg],
      campaignData: campaignContext,
      mode: "chat",
      profileId: activeProfile?.id,
      onDelta: upsert,
      onDone: async () => {
        setLoading(false);
        if (assistantSoFar) {
          await saveMessage(finalConvId, "assistant", assistantSoFar);
        }
      },
      onError: (msg) => {
        setLoading(false);
        toast({ title: "Erro na IA", description: msg, variant: "destructive" });
      },
    });
  };

  const renderMessage = (m: Msg, i: number) => {
    if (m.role === "user") {
      return (
        <div key={i} className="flex justify-end">
          <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground">
            {m.content}
          </div>
        </div>
      );
    }
    const action = parseMtxAction(m.content);
    const cleanContent = stripMtxAction(m.content);
    return (
      <div key={i} className="flex justify-start">
        <div className="max-w-[85%] space-y-2">
          {cleanContent && (
            <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
              <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                <ReactMarkdown>{cleanContent}</ReactMarkdown>
              </div>
            </div>
          )}
          {action && (
            <Button onClick={() => handleExecuteAction(action)} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" size="sm">
              <Rocket className="h-4 w-4" />
              🚀 Executar: {action.campaign_name?.slice(0, 30)}...
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <Brain className="h-5 w-5 text-primary-foreground" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[400px] h-[560px] sm:h-[640px] sm:bottom-6 sm:right-6 bg-card border border-border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-medium text-sm text-foreground">Gestor IA</span>
                <p className="text-[11px] text-muted-foreground">MTX Estratégias</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Histórico">
                <MessageSquare className="h-4 w-4" />
              </button>
              <button onClick={() => { startNewChat(); setShowHistory(false); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Nova conversa">
                <Plus className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* History sidebar */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Conversas recentes</p>
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-4">Nenhuma conversa ainda.</p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                    c.id === activeConversationId ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className="truncate flex-1"
                    onClick={() => { loadMessages(c.id); setShowHistory(false); }}
                  >
                    {c.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingHistory ? (
                  <div className="flex justify-center mt-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm mt-8">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium text-foreground">Olá! Sou seu Gestor de Tráfego IA.</p>
                    <p className="mt-1 text-xs">Pergunte sobre campanhas, peça para criar ou otimizar. Posso executar no Meta Ads!</p>
                  </div>
                ) : (
                  messages.map((m, i) => renderMessage(m, i))
                )}
                {loading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Ex: Crie uma campanha de vendas com R$100/dia..."
                  className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={loading}
                />
                <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
