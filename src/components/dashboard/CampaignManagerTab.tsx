import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  Plus, Loader2, AlertTriangle, Users, Zap, Target, DollarSign,
  MessageSquare, Send, Bot, User, Sparkles, Upload, X, Image as ImageIcon,
  Globe, BarChart3, Settings2, Megaphone, ChevronRight, Trash2, ShieldMinus
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

interface AudienceEntry {
  id: string;
  name: string;
  type: "include" | "exclude";
}

const PIXEL_EVENTS = [
  "PageView", "ViewContent", "ViewCategory", "AddToCart",
  "Search", "InitiateCheckout", "Purchase", "AddPaymentInfo",
];

const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Vendas", icon: "💰" },
  { value: "OUTCOME_LEADS", label: "Geração de Leads", icon: "📋" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego", icon: "🌐" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento", icon: "👁️" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento", icon: "💬" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App", icon: "📱" },
];

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Saiba Mais" },
  { value: "SHOP_NOW", label: "Comprar Agora" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "SUBSCRIBE", label: "Assinar" },
  { value: "CONTACT_US", label: "Fale Conosco" },
  { value: "GET_OFFER", label: "Obter Oferta" },
  { value: "BOOK_TRAVEL", label: "Reservar" },
  { value: "DOWNLOAD", label: "Baixar" },
  { value: "WATCH_MORE", label: "Assistir Mais" },
];

interface Props {
  campaigns: any[];
  isLoading: boolean;
}

export default function CampaignManagerTab({ campaigns, isLoading }: Props) {
  const { toast } = useToast();
  const { activeProfile, adAccountId, metaAccessToken } = useClientProfiles();
  const profileId = activeProfile?.id;

  // Campaign form state
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_SALES",
    dailyBudget: "50",
    targetingNotes: "",
    destinationUrl: "",
    headline: "",
    ctaType: "LEARN_MORE",
    isRemarketing: false,
    remarketingType: "website_visitors",
    retentionDays: "30",
    pixelEvent: "PageView",
    newAudienceId: "",
  });
  const [audiences, setAudiences] = useState<AudienceEntry[]>([]);
  const [creativeUrls, setCreativeUrls] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [innerTab, setInnerTab] = useState("create");

  // Chat state
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Creative Upload ──
  const handleCreativeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !profileId) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${profileId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("creative-assets").upload(path, file);
      if (error) {
        toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from("creative-assets").getPublicUrl(path);
      setCreativeUrls(prev => [...prev, data.publicUrl]);
    }
    toast({ title: "✅ Upload concluído" });
  };

  // ── Publish Campaign ──
  const handlePublish = async () => {
    if (!profileId) return;
    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setPublishing(true);
    setPublishLogs(["🚀 Iniciando publicação..."]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      setPublishLogs(prev => [...prev, "📡 Enviando para Meta Ads..."]);

      const { data, error } = await supabase.functions.invoke("auto-publish-campaign", {
        body: {
          profileId,
          campaign_name: form.name,
          objective: form.objective,
          daily_budget: parseFloat(form.dailyBudget),
          targeting_notes: form.targetingNotes || undefined,
          destination_url: form.destinationUrl || undefined,
          creative_url: creativeUrls[0] || undefined,
          headline: form.headline || undefined,
          primary_text: form.targetingNotes || undefined,
          cta_type: form.ctaType,
          remarketing: form.isRemarketing || undefined,
          audience_ids: form.isRemarketing ? audiences.filter(a => a.type === "include").map(a => a.id) : undefined,
          excluded_audience_ids: form.isRemarketing ? audiences.filter(a => a.type === "exclude").map(a => a.id) : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        setPublishLogs(prev => [...prev, `❌ ${data.error}`]);
        toast({ title: "Erro na publicação", description: data.error, variant: "destructive" });
      } else {
        const steps = data?.steps || [];
        steps.forEach((s: string) => setPublishLogs(prev => [...prev, s]));
        setPublishLogs(prev => [...prev, "🎉 Campanha publicada com sucesso!"]);
        if (data?.ads_manager_url) {
          setPublishLogs(prev => [...prev, `🔗 ${data.ads_manager_url}`]);
        }
        toast({ title: "✅ Campanha publicada!", description: `ID: ${data?.meta_campaign_id}` });
        setForm({ ...form, name: "" });
      }
    } catch (err) {
      const msg = (err as Error).message;
      setPublishLogs(prev => [...prev, `❌ ${msg}`]);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  // ── Create Audience ──
  const handleCreateAudience = async () => {
    if (!profileId) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-audiences", {
        body: {
          profileId,
          audienceType: form.remarketingType,
          name: `${activeProfile?.name || "Perfil"} | ${form.remarketingType === "website_visitors" ? "Visitantes" : "Engajamento"} ${form.retentionDays}d`,
          rule: { retention_seconds: parseInt(form.retentionDays) * 86400 },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        const newId = data?.id || data?.audience_id;
        const audienceName = `${form.remarketingType === "website_visitors" ? "Visitantes" : "Engajamento"} ${form.retentionDays}d`;
        if (newId) {
          setAudiences(prev => [...prev, { id: newId, name: audienceName, type: "include" }]);
        }
        toast({ title: "✅ Público criado!", description: `ID: ${newId}` });
      }
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  // ── Inline Chat ──
  const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

  const sendChat = useCallback(async (input: string) => {
    if (!input.trim() || chatLoading) return;
    const userMsg: Msg = { role: "user", content: input };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    let assistantSoFar = "";
    const allMessages = [...chatMessages, userMsg];

    try {
      const resp = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          profileId,
          mode: "chat",
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Falha na conexão");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${(err as Error).message}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, chatLoading, profileId]);

  const quickActions = [
    { label: "Otimizar campanha", msg: "Analise minhas campanhas atuais e sugira otimizações imediatas para melhorar o ROAS" },
    { label: "Criar remarketing", msg: "Me ajude a criar uma campanha de remarketing para visitantes do site" },
    { label: "Sugerir copy", msg: "Gere 3 variações de copy usando o framework StoryBrand para minha próxima campanha de vendas" },
    { label: "Diagnóstico rápido", msg: "Faça um diagnóstico rápido da performance das minhas campanhas nos últimos 7 dias" },
  ];

  const activeCampaigns = campaigns.filter(c => c.status === "ACTIVE").length;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const avgRoas = totalSpend > 0 ? campaigns.reduce((s, c) => s + c.revenue, 0) / totalSpend : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left: Campaign Management */}
      <div className="xl:col-span-2 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Megaphone className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">R$ {totalSpend.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Investimento Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><BarChart3 className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{avgRoas.toFixed(2)}x</p>
                <p className="text-xs text-muted-foreground">ROAS Médio</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inner Tabs */}
        <Tabs value={innerTab} onValueChange={setInnerTab}>
          <TabsList className="bg-card border border-border w-full justify-start">
            <TabsTrigger value="create" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Criar</TabsTrigger>
            <TabsTrigger value="targeting" className="gap-1.5"><Target className="w-3.5 h-3.5" />Segmentação</TabsTrigger>
            <TabsTrigger value="creatives" className="gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Criativos</TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Orçamento</TabsTrigger>
          </TabsList>

          {/* CREATE */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />Nova Campanha
                </CardTitle>
                <CardDescription>Configure e publique diretamente na Meta Ads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Campanha</Label>
                    <Input placeholder="[VENDAS] Produto X - TOF" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Objetivo</Label>
                    <Select value={form.objective} onValueChange={v => setForm({ ...form, objective: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OBJECTIVES.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Headline</Label>
                    <Input placeholder="Título do anúncio" value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA</Label>
                    <Select value={form.ctaType} onValueChange={v => setForm({ ...form, ctaType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CTA_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Link de Destino</Label>
                  <Input placeholder="https://seusite.com.br/oferta" value={form.destinationUrl} onChange={e => setForm({ ...form, destinationUrl: e.target.value })} className="font-mono text-sm" />
                </div>

                <div className="space-y-2">
                  <Label>Notas de Segmentação</Label>
                  <Textarea placeholder="Descreva o público-alvo, interesses, faixa etária..." value={form.targetingNotes} onChange={e => setForm({ ...form, targetingNotes: e.target.value })} rows={2} />
                </div>

                {/* Publish Logs */}
                {publishLogs.length > 0 && (
                  <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1 max-h-40 overflow-y-auto text-xs font-mono">
                    {publishLogs.map((log, i) => <p key={i}>{log}</p>)}
                  </div>
                )}

                <Button onClick={handlePublish} disabled={publishing || !form.name.trim()} className="w-full gap-2" size="lg">
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {publishing ? "Publicando..." : "Publicar Campanha"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TARGETING */}
          <TabsContent value="targeting">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />Segmentação & Remarketing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Campanha de Remarketing</span>
                  </div>
                  <Switch checked={form.isRemarketing} onCheckedChange={v => setForm({ ...form, isRemarketing: v })} />
                </div>

                {form.isRemarketing && (
                  <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    {/* Audience Creator */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Público</Label>
                        <Select value={form.remarketingType} onValueChange={v => setForm({ ...form, remarketingType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="website_visitors"><Globe className="w-3 h-3 inline mr-1" />Visitantes do Site</SelectItem>
                            <SelectItem value="engagement"><MessageSquare className="w-3 h-3 inline mr-1" />Engajamento (Página)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Retenção (dias)</Label>
                        <Select value={form.retentionDays} onValueChange={v => setForm({ ...form, retentionDays: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["7", "14", "30", "60", "90", "180"].map(d => (
                              <SelectItem key={d} value={d}>{d} dias</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Pixel Event Selector (for website_visitors) */}
                    {form.remarketingType === "website_visitors" && (
                      <div className="space-y-2">
                        <Label>Eventos do Pixel</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {PIXEL_EVENTS.map(evt => (
                            <label key={evt} className="flex items-center gap-2 text-xs p-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={form.pixelEvent === evt}
                                onCheckedChange={() => setForm(prev => ({ ...prev, pixelEvent: evt }))}
                              />
                              {evt}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button onClick={handleCreateAudience} disabled={publishing} variant="outline" className="gap-2">
                      {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                      Criar Público & Adicionar
                    </Button>

                    {/* Manual Add */}
                    <div className="space-y-2">
                      <Label>Adicionar Público Existente (ID)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: 120243487645360596"
                          value={form.newAudienceId}
                          onChange={e => setForm({ ...form, newAudienceId: e.target.value })}
                          className="font-mono text-sm flex-1"
                        />
                        <Button
                          variant="outline" size="sm"
                          disabled={!form.newAudienceId.trim()}
                          onClick={() => {
                            setAudiences(prev => [...prev, { id: form.newAudienceId.trim(), name: `Público ${form.newAudienceId.slice(-6)}`, type: "include" }]);
                            setForm(prev => ({ ...prev, newAudienceId: "" }));
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />Incluir
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          disabled={!form.newAudienceId.trim()}
                          onClick={() => {
                            setAudiences(prev => [...prev, { id: form.newAudienceId.trim(), name: `Público ${form.newAudienceId.slice(-6)}`, type: "exclude" }]);
                            setForm(prev => ({ ...prev, newAudienceId: "" }));
                          }}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <ShieldMinus className="w-3 h-3 mr-1" />Excluir
                        </Button>
                      </div>
                    </div>

                    {/* Audience List */}
                    {audiences.length > 0 && (
                      <div className="space-y-2">
                        <Label>Públicos no Conjunto ({audiences.length})</Label>
                        <div className="space-y-1.5">
                          {audiences.map((a, i) => (
                            <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${a.type === "exclude" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant={a.type === "exclude" ? "destructive" : "secondary"} className="text-[10px]">
                                  {a.type === "include" ? "INCLUIR" : "EXCLUIR"}
                                </Badge>
                                <span className="text-xs">{a.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{a.id}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => setAudiences(prev => prev.map((au, idx) => idx === i ? { ...au, type: au.type === "include" ? "exclude" : "include" } : au))}
                                >
                                  <ShieldMinus className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                  onClick={() => setAudiences(prev => prev.filter((_, idx) => idx !== i))}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notas de Segmentação</Label>
                  <Textarea placeholder="Descreva interesses, comportamentos, faixa etária..." value={form.targetingNotes} onChange={e => setForm({ ...form, targetingNotes: e.target.value })} rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREATIVES */}
          <TabsContent value="creatives">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />Criativos
                </CardTitle>
                <CardDescription>Upload de imagens e vídeos para o anúncio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique ou arraste imagens/vídeos</span>
                  <span className="text-xs text-muted-foreground mt-1">PNG, JPG, MP4 · Max 10MB</span>
                  <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleCreativeUpload} />
                </label>

                {creativeUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {creativeUrls.map((url, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Criativo ${i + 1}`} className="w-full h-32 object-cover" />
                        <button
                          onClick={() => setCreativeUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {i === 0 && (
                          <Badge className="absolute bottom-1 left-1 text-[10px]" variant="secondary">Principal</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUDGET */}
          <TabsContent value="budget">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />Orçamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Orçamento Diário (R$)</Label>
                  <Input type="number" placeholder="50.00" value={form.dailyBudget} onChange={e => setForm({ ...form, dailyBudget: e.target.value })} min="5" step="0.01" />
                  <p className="text-xs text-muted-foreground">Mínimo: R$ 5,00 · O orçamento será enviado em centavos para a Meta API.</p>
                </div>

                {activeProfile && (
                  <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 className="w-4 h-4" />Configurações do Perfil</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Teto: R$ {activeProfile.budget_maximo}</span>
                      <span>CPA Meta: R$ {activeProfile.cpa_meta}</span>
                      <span>Ticket Médio: R$ {activeProfile.ticket_medio}</span>
                      <span>Frequência: {activeProfile.budget_frequency}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: Inline AI Chat */}
      <div className="xl:col-span-1">
        <Card className="h-[calc(100vh-320px)] flex flex-col sticky top-24">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Assistente de Campanhas
            </CardTitle>
            <CardDescription className="text-xs">IA especialista em Meta Ads integrada</CardDescription>
          </CardHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Como posso ajudar com suas campanhas?</p>
                </div>
                <div className="space-y-2">
                  {quickActions.map((qa, i) => (
                    <button
                      key={i}
                      onClick={() => sendChat(qa.msg)}
                      className="w-full text-left text-xs p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors flex items-center gap-2"
                    >
                      <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />}
                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>h3]:text-sm [&>h3]:font-semibold">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && <User className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />}
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />Pensando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form onSubmit={e => { e.preventDefault(); sendChat(chatInput); }} className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Pergunte sobre campanhas..."
                className="text-sm"
                disabled={chatLoading}
              />
              <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
