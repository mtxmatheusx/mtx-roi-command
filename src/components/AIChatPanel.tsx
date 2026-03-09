import { useState, useRef, useEffect } from "react";
import { X, Send, Brain, Loader2, Rocket, Plus, MessageSquare, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useChatHistory, Msg } from "@/hooks/useChatHistory";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CampaignAction {
  action: string; // "create_campaign" | "create_audience"
  campaign_name?: string;
  objective?: string;
  daily_budget?: number;
  targeting_notes?: string;
  reasoning?: string;
  use_catalog?: boolean;
  destination_url?: string;
  // Audience fields
  audience_type?: string;
  audience_name?: string;
  retention_days?: number;
  url_filter?: string;
  source_audience_id?: string;
  ratio?: number;
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
  const [executingAction, setExecutingAction] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo, catalogId } = useClientProfiles();
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
    ? {
        perfil: activeProfile.name,
        cpa_meta: cpaMeta,
        ticket_medio: ticketMedio,
        limite_escala: limiteEscala,
        budget_maximo: budgetMaximo,
        catalog_id: catalogId || null,
      }
    : undefined;

  const handleExecuteAction = async (action: CampaignAction) => {
    if (action.action === "create_audience") {
      await handleCreateAudience(action);
      return;
    }

    // Default: navigate to campaign launcher
    navigate("/lancar-campanha", {
      state: {
        prefill: {
          campaign_name: action.campaign_name,
          objective: action.objective,
          daily_budget: action.daily_budget,
          targeting_notes: action.targeting_notes || "",
          use_catalog: action.use_catalog || false,
          destination_url: action.destination_url || "",
        },
        reasoning: action.reasoning || "",
      },
    });
    setOpen(false);
    toast({ title: "🚀 Campanha carregada", description: "Revise os detalhes e clique em Publicar." });
  };

  const handleCreateAudience = async (action: CampaignAction) => {
    if (!activeProfile?.id) {
      toast({ title: "Erro", description: "Selecione um perfil ativo.", variant: "destructive" });
      return;
    }

    setExecutingAction(true);
    try {
      const body: Record<string, unknown> = {
        profileId: activeProfile.id,
        audienceType: action.audience_type,
        name: action.audience_name,
      };

      if (action.audience_type === "website_visitors") {
        body.rule = {
          retention_seconds: (action.retention_days || 180) * 86400,
          url_filter: action.url_filter || "",
        };
      } else if (action.audience_type === "engagement") {
        body.rule = {
          retention_seconds: (action.retention_days || 365) * 86400,
        };
      } else if (action.audience_type === "lookalike") {
        body.lookalikeSpec = {
          source_audience_id: action.source_audience_id,
          ratio: action.ratio || 0.01,
        };
      }

      const { data, error } = await supabase.functions.invoke("manage-audiences", { body });

      if (error) {
        // Extract meaningful message from FunctionsHttpError
        let errMsg = error.message || "Erro desconhecido";
        try {
          const ctx = await (error as any).context?.json?.();
          if (ctx?.error) errMsg = ctx.error;
        } catch {}
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Público criado com sucesso!",
        description: `${data.name} (ID: ${data.audience_id})`,
      });

      // Add success message to chat
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: `✅ **Público criado com sucesso!**\n\n- **Nome:** ${data.name}\n- **ID:** \`${data.audience_id}\`\n- **Tipo:** ${data.type}\n\nEste público já está disponível para uso nas suas campanhas de remarketing.`,
        },
      ]);
    } catch (e: any) {
      toast({ title: "Erro ao criar público", description: e.message, variant: "destructive" });
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: `❌ **Erro ao criar público:** ${e.message}\n\nVerifique as configurações do perfil (Pixel ID, Page ID) e tente novamente.`,
        },
      ]);
    } finally {
      setExecutingAction(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };

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
          {action && action.action === "create_audience" && (
            <Button
              onClick={() => handleExecuteAction(action)}
              disabled={executingAction}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {executingAction ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              👥 Criar Público: {action.audience_name?.slice(0, 30)}...
            </Button>
          )}
          {action && action.action === "create_campaign" && (
            <Button
              onClick={() => handleExecuteAction(action)}
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
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
                    <div className="mt-3 space-y-1">
                      <button
                        onClick={() => setInput("Crie uma campanha de remarketing para visitantes do meu site")}
                        className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-accent transition-colors"
                      >
                        🔄 Criar campanha de remarketing
                      </button>
                      <button
                        onClick={() => setInput("Crie um público personalizado de visitantes do site nos últimos 30 dias")}
                        className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-accent transition-colors"
                      >
                        👥 Criar público personalizado
                      </button>
                      <button
                        onClick={() => setInput("Crie uma campanha de vendas com catálogo de produtos e orçamento de R$100/dia")}
                        className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-accent transition-colors"
                      >
                        🛍️ Campanha com catálogo (DPA)
                      </button>
                    </div>
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
                  placeholder="Ex: Crie uma campanha de remarketing..."
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
