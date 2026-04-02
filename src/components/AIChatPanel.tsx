import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Send, Brain, Loader2, Rocket, Plus, MessageSquare, Trash2,
  Users, Zap, Paperclip, Image, CheckCircle2, XCircle, Clock,
  Target, BarChart3, Palette, Settings, TrendingUp, Eye, Volume2, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useChatHistory, Msg } from "@/hooks/useChatHistory";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CampaignAction {
  action: string;
  campaign_name?: string;
  objective?: string;
  daily_budget?: number;
  targeting_notes?: string;
  reasoning?: string;
  use_catalog?: boolean;
  destination_url?: string;
  audience_type?: string;
  audience_name?: string;
  retention_days?: number;
  url_filter?: string;
  source_audience_id?: string;
  ratio?: number;
  creative_url?: string;
  headline?: string;
  primary_text?: string;
  cta?: string;
  remarketing?: boolean;
  remarketing_days?: number;
}

interface PublishStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
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
  messages, campaignData, mode, profileId, scrapedContext, onDelta, onDone, onError,
}: {
  messages: Msg[]; campaignData?: unknown; mode: string; profileId?: string;
  scrapedContext?: string;
  onDelta: (t: string) => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const resp = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, campaignData, mode, profileId, scrapedContext }),
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
  const [publishSteps, setPublishSteps] = useState<PublishStep[] | null>(null);
  const [uploadedCreatives, setUploadedCreatives] = useState<string[]>([]);
  const [ttsPlaying, setTtsPlaying] = useState<number | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo, catalogId } = useClientProfiles();
  const { toast } = useToast();

  const {
    conversations, activeConversationId, messages, setMessages,
    loadingHistory, loadMessages, createConversation, saveMessage,
    startNewChat, deleteConversation,
  } = useChatHistory();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, publishSteps]);

  const campaignContext = activeProfile
    ? {
        perfil: activeProfile.name,
        cpa_meta: cpaMeta,
        ticket_medio: ticketMedio,
        limite_escala: limiteEscala,
        budget_maximo: budgetMaximo,
        catalog_id: catalogId || null,
        pixel_id: activeProfile.pixel_id || null,
        page_id: activeProfile.page_id || null,
        has_token: !!activeProfile.meta_access_token,
        uploaded_creatives: uploadedCreatives,
      }
    : undefined;

  // ── Validations ──
  const validateProfileRequirements = (action: CampaignAction): string[] => {
    const missing: string[] = [];
    if (!activeProfile) { missing.push("Perfil ativo não selecionado"); return missing; }
    const token = activeProfile.meta_access_token;
    if (!token || token.trim() === "") missing.push("Meta Access Token");
    const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(action.objective || "OUTCOME_SALES");
    const needsPixel = action.action === "create_campaign" && isConversion;
    const needsPixelAudience = action.action === "create_audience" && action.audience_type === "website_visitors";
    if ((needsPixel || needsPixelAudience) && (!activeProfile.pixel_id || activeProfile.pixel_id.trim() === "")) {
      missing.push("Pixel ID");
    }
    if (action.action === "create_campaign" && (!activeProfile.page_id || activeProfile.page_id.trim() === "")) {
      missing.push("Page ID");
    }
    if (action.action === "create_audience" && action.audience_type === "engagement" && (!activeProfile.page_id || activeProfile.page_id.trim() === "")) {
      missing.push("Page ID");
    }
    return missing;
  };

  const showMissingFieldsError = (missing: string[]) => {
    const msg = `⚠️ **Configuração incompleta**\n\nOs seguintes campos são obrigatórios:\n\n${missing.map(f => `- ❌ **${f}**`).join("\n")}\n\nAcesse **Configurações** para preencher.`;
    toast({ title: "Configuração incompleta", description: `Faltando: ${missing.join(", ")}`, variant: "destructive" });
    setMessages((p) => [...p, { role: "assistant", content: msg }]);
  };

  // ── Creative Upload ──
  const handleCreativeUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id || !activeProfile?.id) return;

    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${activeProfile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("creative-assets").upload(path, file);
      if (uploadErr) {
        toast({ title: "Erro ao enviar", description: uploadErr.message, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("creative-assets").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      uploadedUrls.push(fileUrl);

      await supabase.from("creative_assets").insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type.startsWith("video") ? "video" : "image",
        source_tag: "chat-upload",
      });
    }

    if (uploadedUrls.length > 0) {
      setUploadedCreatives(prev => [...prev, ...uploadedUrls]);
      const names = Array.from(files).map(f => f.name).join(", ");
      const previewHtml = uploadedUrls.map(u => `![criativo](${u})`).join("\n");
      setMessages(p => [...p, {
        role: "user",
        content: `📎 Enviei ${uploadedUrls.length} criativo(s): ${names}`
      }, {
        role: "assistant",
        content: `✅ **${uploadedUrls.length} criativo(s) recebido(s)!**\n\n${previewHtml}\n\nEles serão usados automaticamente ao publicar a campanha. Continue configurando ou peça para eu criar a campanha com esses criativos.`
      }]);
      toast({ title: "Criativos enviados", description: `${uploadedUrls.length} arquivo(s) prontos para uso.` });
    }
  }, [user?.id, activeProfile?.id, toast, setMessages]);

  // ── Execute Actions ──
  const handleExecuteAction = async (action: CampaignAction) => {
    if (action.action === "create_audience") {
      const missing = validateProfileRequirements(action);
      if (missing.length > 0) { showMissingFieldsError(missing); return; }
      await handleCreateAudience(action);
      return;
    }
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
        body.rule = { retention_seconds: (action.retention_days || 180) * 86400, url_filter: action.url_filter || "" };
      } else if (action.audience_type === "engagement") {
        body.rule = { retention_seconds: (action.retention_days || 365) * 86400 };
      } else if (action.audience_type === "lookalike") {
        body.lookalikeSpec = { source_audience_id: action.source_audience_id, ratio: action.ratio || 0.01 };
      }
      const { data, error } = await supabase.functions.invoke("manage-audiences", { body });
      if (error) {
        let errMsg = error.message || "Erro desconhecido";
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) errMsg = ctx.error; } catch {}
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: "✅ Público criado!", description: `${data.name} (ID: ${data.audience_id})` });
      setMessages((p) => [...p, {
        role: "assistant",
        content: `✅ **Público criado com sucesso!**\n\n- **Nome:** ${data.name}\n- **ID:** \`${data.audience_id}\`\n- **Tipo:** ${data.type}\n\nPronto para uso nas campanhas de remarketing.`,
      }]);
    } catch (e: any) {
      toast({ title: "Erro ao criar público", description: e.message, variant: "destructive" });
      setMessages((p) => [...p, {
        role: "assistant",
        content: `❌ **Erro ao criar público:** ${e.message}\n\nVerifique Pixel ID e Page ID nas Configurações.`,
      }]);
    } finally {
      setExecutingAction(false);
    }
  };

  const handleAutoPublish = async (action: CampaignAction) => {
    if (!activeProfile?.id) {
      toast({ title: "Erro", description: "Selecione um perfil ativo.", variant: "destructive" });
      return;
    }
    const missing = validateProfileRequirements(action);
    if (missing.length > 0) { showMissingFieldsError(missing); return; }

    setExecutingAction(true);
    setPublishSteps([
      { label: "Criando Campanha", status: "running" },
      { label: "Configurando Conjunto de Anúncios", status: "pending" },
      { label: "Criando Anúncio", status: "pending" },
      { label: "Finalizando", status: "pending" },
    ]);

    try {
      // Step 1: running
      await new Promise(r => setTimeout(r, 500));
      
      const { data, error } = await supabase.functions.invoke("auto-publish-campaign", {
        body: {
          profileId: activeProfile.id,
          campaign_name: action.campaign_name,
          objective: action.objective || "OUTCOME_SALES",
          daily_budget: action.daily_budget || 50,
          targeting_notes: action.targeting_notes || undefined,
          use_catalog: action.use_catalog || false,
          destination_url: action.destination_url || undefined,
          creative_url: uploadedCreatives.length > 0 ? uploadedCreatives[0] : (action.creative_url || undefined),
          headline: action.headline || undefined,
          primary_text: action.primary_text || undefined,
          cta: action.cta || "LEARN_MORE",
          remarketing: action.remarketing || undefined,
          remarketing_days: action.remarketing_days || undefined,
        },
      });

      if (error) {
        let errMsg = error.message || "Erro desconhecido";
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) errMsg = ctx.error; } catch {}
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      setPublishSteps([
        { label: "Campanha Criada", status: "done", detail: data.meta_campaign_id },
        { label: "Conjunto Criado", status: "done", detail: data.meta_adset_id },
        { label: "Anúncio Criado", status: "done", detail: data.meta_ad_id },
        { label: "Publicação Completa", status: "done" },
      ]);

      toast({ title: "⚡ Campanha publicada!", description: `ID: ${data.meta_campaign_id}` });
      setMessages((p) => [...p, {
        role: "assistant",
        content: `⚡ **Campanha publicada com sucesso!**\n\n${(data.steps || []).map((s: string) => `- ✅ ${s}`).join("\n")}\n\n🔗 [Abrir no Ads Manager](${data.ads_manager_url})\n\n> ⚠️ Campanha criada em modo **PAUSADO**. Ative manualmente quando estiver pronto.`,
      }]);
      setUploadedCreatives([]);
    } catch (e: any) {
      setPublishSteps(prev => prev?.map((s, i) =>
        s.status === "running" ? { ...s, status: "error", detail: e.message } :
        s.status === "pending" ? { ...s, status: "error" } : s
      ) || null);
      toast({ title: "Erro no deploy", description: e.message, variant: "destructive" });
      setMessages((p) => [...p, {
        role: "assistant",
        content: `❌ **Erro no deploy:** ${e.message}\n\nVerifique Token, Pixel ID e Page ID nas Configurações.`,
      }]);
    } finally {
      setExecutingAction(false);
      setTimeout(() => setPublishSteps(null), 8000);
    }
  };

  // ── URL Detection & Scraping ──
  const extractUrl = (text: string): string | null => {
    const match = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
    return match ? match[0] : null;
  };

  const scrapeUrl = async (url: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("scrape-media", {
        body: { url, mode: "text-only" },
      });
      if (error || !data?.text) return null;
      return data.text.slice(0, 3000); // Limit context size
    } catch {
      // Fallback: just send the URL without scraping
      return null;
    }
  };

  // ── Send message ──
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

    // Detect URL and try to scrape context
    let scrapedContext: string | undefined;
    const detectedUrl = extractUrl(text);
    if (detectedUrl) {
      const scraped = await scrapeUrl(detectedUrl);
      if (scraped) {
        scrapedContext = `URL: ${detectedUrl}\n\nConteúdo extraído:\n${scraped}`;
      }
    }

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
      scrapedContext,
      onDelta: upsert,
      onDone: async () => {
        setLoading(false);
        if (assistantSoFar) await saveMessage(finalConvId, "assistant", assistantSoFar);
      },
      onError: (msg) => {
        setLoading(false);
        toast({ title: "Erro na IA", description: msg, variant: "destructive" });
      },
    });
  };

  // ── Quick Actions ──
  const quickActions = [
    { icon: <Rocket className="h-3.5 w-3.5" />, label: "🧭 Publicação guiada", prompt: "Me guie passo a passo para publicar uma campanha completa. Verifique meu perfil, me ajude a definir objetivo, orçamento, segmentação, copy e criativo. Quero fazer tudo pelo chat." },
    { icon: <Target className="h-3.5 w-3.5" />, label: "🎯 Campanha de vendas", prompt: "Crie uma campanha de vendas otimizada para conversão. Sugira o melhor objetivo, orçamento e segmentação com base no meu perfil." },
    { icon: <Users className="h-3.5 w-3.5" />, label: "🔄 Remarketing", prompt: "Quero criar uma campanha de remarketing completa. Primeiro crie o público personalizado e depois a campanha direcionada a ele." },
    { icon: <Eye className="h-3.5 w-3.5" />, label: "👁️ Tráfego", prompt: "Crie uma campanha de tráfego para direcionar visitantes ao meu site. Sugira segmentação e orçamento ideais." },
    { icon: <Palette className="h-3.5 w-3.5" />, label: "🛍️ Catálogo (DPA)", prompt: "Crie uma campanha de vendas com catálogo de produtos (DPA). Configure remarketing dinâmico para visitantes do meu site." },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "📊 Diagnóstico", prompt: "Faça um diagnóstico completo das minhas campanhas ativas. Analise CPA, CTR, CPM e ROAS e me dê recomendações de otimização." },
    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "🚀 Escalar", prompt: "Analise minhas campanhas e identifique qual tem melhor desempenho para escalar. Sugira a estratégia de escala ideal." },
    { icon: <Users className="h-3.5 w-3.5" />, label: "👥 Criar público", prompt: "Crie um público personalizado de visitantes do meu site nos últimos 30 dias para usar em campanhas de remarketing." },
  ];

  // ── Profile status badge ──
  const getProfileStatus = () => {
    if (!activeProfile) return { color: "bg-destructive", text: "Sem perfil" };
    const hasToken = !!activeProfile.meta_access_token;
    const hasPixel = !!activeProfile.pixel_id?.trim();
    const hasPage = !!activeProfile.page_id?.trim();
    if (hasToken && hasPixel && hasPage) return { color: "bg-green-500", text: "Pronto" };
    return { color: "bg-yellow-500", text: "Incompleto" };
  };
  const profileStatus = getProfileStatus();

  // ── TTS ──
  const handleTTS = async (text: string, msgIndex: number) => {
    // If already playing this message, stop
    if (ttsPlaying === msgIndex) {
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
      setTtsPlaying(null);
      return;
    }
    // Stop any previous
    ttsAudioRef.current?.pause();
    setTtsPlaying(msgIndex);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro TTS" }));
        toast({ title: "Erro TTS", description: err.error || `Status ${response.status}`, variant: "destructive" });
        setTtsPlaying(null);
        return;
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => { setTtsPlaying(null); ttsAudioRef.current = null; };
      audio.onerror = () => { setTtsPlaying(null); ttsAudioRef.current = null; };
      await audio.play();
    } catch {
      setTtsPlaying(null);
      toast({ title: "Erro TTS", description: "Falha ao reproduzir áudio", variant: "destructive" });
    }
  };

  // ── Render ──
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
              <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_img]:rounded-md [&_img]:max-h-40">
                <ReactMarkdown>{cleanContent}</ReactMarkdown>
              </div>
              <button
                onClick={() => handleTTS(cleanContent, i)}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                title={ttsPlaying === i ? "Parar áudio" : "Ouvir mensagem"}
              >
                {ttsPlaying === i ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                {ttsPlaying === i ? "Parar" : "Ouvir"}
              </button>
            </div>
          )}
          {action && action.action === "create_audience" && (
            <Button onClick={() => handleExecuteAction(action)} disabled={executingAction} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" size="sm">
              {executingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              👥 Criar Público: {action.audience_name?.slice(0, 30)}
            </Button>
          )}
          {action && action.action === "create_campaign" && (
            <div className="space-y-1.5 w-full">
              {/* Campaign summary card */}
              <div className="rounded-md border border-border bg-card/50 p-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Target className="h-3 w-3 text-primary" />
                  {action.campaign_name?.slice(0, 40)}
                </div>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  <span>📋 {action.objective?.replace("OUTCOME_", "")}</span>
                  <span>💰 R${action.daily_budget}/dia</span>
                  {action.use_catalog && <span>🛍️ Catálogo</span>}
                  {uploadedCreatives.length > 0 && <span>🖼️ {uploadedCreatives.length} criativo(s)</span>}
                </div>
              </div>
              <Button onClick={() => handleAutoPublish(action)} disabled={executingAction} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
                {executingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                ⚡ Publicar Direto no Meta Ads
              </Button>
              <Button onClick={() => handleExecuteAction(action)} variant="outline" className="w-full gap-2" size="sm">
                <Rocket className="h-4 w-4" />
                🚀 Abrir no Wizard
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPublishProgress = () => {
    if (!publishSteps) return null;
    return (
      <div className="mx-4 mb-2 rounded-lg border border-border bg-card/80 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> Deploy em andamento
        </p>
        {publishSteps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {step.status === "pending" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            {step.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {step.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            {step.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            <span className={step.status === "done" ? "text-foreground" : step.status === "error" ? "text-destructive" : "text-muted-foreground"}>
              {step.label}
            </span>
            {step.detail && <span className="text-muted-foreground truncate ml-auto text-[10px] max-w-[100px]">{step.detail}</span>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
        >
          <Brain className="h-6 w-6 text-primary-foreground" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[420px] h-[600px] sm:h-[680px] sm:bottom-6 sm:right-6 liquid-glass rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="lg-overlay" />
          <div className="lg-specular" />
          <div className="lg-content !p-0 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-sm text-foreground">Gestor IA</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${profileStatus.color}`} />
                  <p className="text-[10px] text-muted-foreground">
                    {activeProfile?.name || "Nenhum perfil"} · {profileStatus.text}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Histórico">
                <MessageSquare className="h-4 w-4" />
              </button>
              <button onClick={() => { startNewChat(); setShowHistory(false); setUploadedCreatives([]); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Nova conversa">
                <Plus className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/configuracoes")} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Configurações">
                <Settings className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Uploaded creatives strip */}
          {uploadedCreatives.length > 0 && !showHistory && (
            <div className="px-3 py-1.5 border-b border-border bg-muted/30 flex items-center gap-2 overflow-x-auto">
              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground shrink-0">{uploadedCreatives.length} criativo(s)</span>
              {uploadedCreatives.map((url, i) => (
                <img key={i} src={url} alt="criativo" className="h-6 w-6 rounded object-cover shrink-0 border border-border" />
              ))}
              <button onClick={() => setUploadedCreatives([])} className="text-[10px] text-destructive hover:underline shrink-0 ml-auto">Limpar</button>
            </div>
          )}

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
                  <span className="truncate flex-1" onClick={() => { loadMessages(c.id); setShowHistory(false); }}>
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
                  <div className="text-center text-muted-foreground text-sm mt-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground">Central de Comando</p>
                    <p className="mt-1 text-xs">Crie campanhas completas do início ao fim pelo chat.</p>
                    <div className="mt-4 space-y-1.5">
                      {quickActions.map((qa, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setInput(qa.prompt); }}
                          className={`block w-full text-left text-xs px-3 py-2 rounded-md transition-colors ${
                            idx === 0
                              ? "bg-primary/10 border border-primary/20 hover:bg-primary/20 font-medium text-primary"
                              : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {qa.label}
                        </button>
                      ))}
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

              {/* Publish progress */}
              {renderPublishProgress()}

              {/* Input */}
              <div className="p-3 border-t border-border flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => handleCreativeUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  title="Enviar criativo (imagem/vídeo)"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Cole uma URL ou peça para criar campanhas..."
                  className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                  disabled={loading}
                />
                <Button size="icon" onClick={send} disabled={loading || !input.trim()} className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </>
  );
}
