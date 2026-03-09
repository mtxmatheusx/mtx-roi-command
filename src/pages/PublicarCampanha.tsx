import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Rocket, ShoppingBag, Eye, Send, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Plus, Upload, Trash2, ExternalLink, RefreshCw, Image as ImageIcon, FileText,
  Target, DollarSign, Users, Globe, Sparkles, Clock, Video, X
} from "lucide-react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

/* ─── Types ─── */
interface CampaignForm {
  name: string;
  objective: string;
  dailyBudget: string;
  destinationUrl: string;
  primaryText: string;
  headline: string;
  cta: string;
  useCatalog: boolean;
  isRemarketing: boolean;
  remarketingType: string;
  retentionDays: string;
  audienceId: string;
}

interface CatalogItem {
  id: string;
  name: string;
  product_count?: number;
}

interface PublishLog {
  step: string;
  status: "pending" | "done" | "error";
  detail?: string;
}

const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "🛒 Vendas" },
  { value: "OUTCOME_LEADS", label: "📋 Geração de Leads" },
  { value: "OUTCOME_TRAFFIC", label: "🌐 Tráfego" },
  { value: "OUTCOME_AWARENESS", label: "📢 Reconhecimento" },
  { value: "OUTCOME_ENGAGEMENT", label: "💬 Engajamento" },
];

const CTA_OPTIONS = [
  "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "CONTACT_US",
  "APPLY_NOW", "BOOK_NOW", "DOWNLOAD", "GET_OFFER", "ORDER_NOW",
];

const defaultForm: CampaignForm = {
  name: "", objective: "OUTCOME_SALES", dailyBudget: "50",
  destinationUrl: "", primaryText: "", headline: "", cta: "LEARN_MORE",
  useCatalog: false, isRemarketing: false, remarketingType: "website_visitors",
  retentionDays: "30", audienceId: "",
};

export default function PublicarCampanha() {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    activeProfile, adAccountId, metaAccessToken, cpaMeta,
  } = useClientProfiles();

  const [activeTab, setActiveTab] = useState("campaign");
  const [form, setForm] = useState<CampaignForm>(defaultForm);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<PublishLog[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);
  const [creatingAudience, setCreatingAudience] = useState(false);
  const profileId = activeProfile?.id;
  const pageId = activeProfile?.page_id;
  const pixelId = activeProfile?.pixel_id;
  const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(form.objective);

  const updateField = (field: keyof CampaignForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  /* ─── Load catalogs ─── */
  const loadCatalogs = useCallback(async () => {
    if (!profileId) return;
    setCatalogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-catalogs", {
        body: { profileId },
      });
      if (error) throw error;
      setCatalogs(data?.catalogs || []);
      if (activeProfile?.catalog_id) setSelectedCatalog(activeProfile.catalog_id);
    } catch (e) {
      console.error("Catalog fetch error:", e);
    } finally {
      setCatalogsLoading(false);
    }
  }, [profileId, activeProfile?.catalog_id]);

  useEffect(() => { loadCatalogs(); }, [loadCatalogs]);

  /* ─── Load recent drafts ─── */
  const loadDrafts = useCallback(async () => {
    if (!user || !profileId) return;
    const { data } = await supabase
      .from("campaign_drafts")
      .select("*")
      .eq("user_id", user.id)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentDrafts(data || []);
  }, [user, profileId]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  /* ─── AI Copy Generation ─── */
  const handleGenerateAI = async () => {
    if (!profileId) return;
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-campaign-draft", {
        body: {
          objective: form.objective,
          profileId,
          profileConfig: {
            cpa_meta: cpaMeta,
            ticket_medio: activeProfile?.ticket_medio,
            budget_maximo: activeProfile?.budget_maximo,
          },
        },
      });
      if (error) throw error;
      if (data?.suggestion) {
        const s = data.suggestion;
        updateField("name", s.campaign_name || form.name);
        updateField("primaryText", s.copy_options?.[0]?.primary_text || "");
        updateField("headline", s.copy_options?.[0]?.headline || "");
        updateField("dailyBudget", String(s.daily_budget || form.dailyBudget));
        toast({ title: "✨ Copy gerada pela IA", description: "Campos preenchidos com sugestão inteligente." });
      }
    } catch (e) {
      toast({ title: "Erro na IA", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  /* ─── Create Remarketing Audience ─── */
  const handleCreateAudience = async () => {
    if (!profileId) return;
    if (form.remarketingType === "website_visitors" && (!pixelId || pixelId.trim() === "")) {
      toast({ title: "Pixel ID obrigatório", description: "Configure o Pixel ID em Configurações para criar público de visitantes.", variant: "destructive" });
      return;
    }
    if (form.remarketingType === "engagement" && (!pageId || pageId.trim() === "")) {
      toast({ title: "Page ID obrigatório", description: "Configure o Page ID em Configurações.", variant: "destructive" });
      return;
    }
    setCreatingAudience(true);
    try {
      const body: Record<string, unknown> = {
        profileId,
        audienceType: form.remarketingType,
        name: `${activeProfile?.name} | ${form.remarketingType === "website_visitors" ? "Visitantes" : "Engajamento"} - ${form.retentionDays}d`,
      };
      if (form.remarketingType === "website_visitors") {
        body.rule = { retention_seconds: parseInt(form.retentionDays) * 86400, url_filter: "" };
      } else if (form.remarketingType === "engagement") {
        body.rule = { retention_seconds: parseInt(form.retentionDays) * 86400 };
      }
      const { data, error } = await supabase.functions.invoke("manage-audiences", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "✅ Público criado!", description: `${data.name} (ID: ${data.audience_id})` });
    } catch (e) {
      toast({ title: "Erro ao criar público", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreatingAudience(false);
    }
  };

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push("Nome da campanha é obrigatório");
    if (!adAccountId || adAccountId === "act_") errors.push("Ad Account ID não configurado");
    if (!pageId) errors.push("Page ID não configurado");
    if (isConversion && !pixelId) errors.push("Pixel ID obrigatório para campanhas de conversão");
    if (!metaAccessToken) errors.push("Token Meta não configurado");
    if (parseFloat(form.dailyBudget) < 5) errors.push("Orçamento mínimo: R$ 5,00");
    if (!form.destinationUrl && !form.useCatalog) errors.push("URL de destino obrigatória");
    return errors;
  };

  const validationErrors = getValidationErrors();
  const canPublish = validationErrors.length === 0;

  /* ─── Publish ─── */
  const handlePublish = async () => {
    setShowConfirm(false);
    setPublishing(true);
    setPublishLogs([
      { step: "Criando campanha...", status: "pending" },
      { step: "Criando conjunto de anúncios...", status: "pending" },
      { step: "Criando anúncio...", status: "pending" },
    ]);
    setActiveTab("publish");

    try {
      const { data, error } = await supabase.functions.invoke("auto-publish-campaign", {
        body: {
          profileId,
          campaign_name: form.name,
          objective: form.objective,
          daily_budget: parseFloat(form.dailyBudget),
          targeting_notes: form.primaryText,
          use_catalog: form.useCatalog,
          destination_url: form.destinationUrl,
        },
      });

      if (error) throw error;

      if (data?.error) {
        setPublishLogs((l) => l.map((s, i) =>
          i === 0 ? { ...s, status: "error", detail: data.error } : s
        ));
        toast({ title: "❌ Falha na publicação", description: data.error, variant: "destructive" });
        return;
      }

      const steps = data?.steps || [];
      setPublishLogs([
        { step: "Campanha criada", status: "done", detail: data?.meta_campaign_id },
        { step: "Conjunto criado", status: "done", detail: data?.meta_adset_id },
        { step: "Anúncio criado", status: "done", detail: data?.meta_ad_id },
      ]);

      toast({
        title: "✅ Campanha publicada!",
        description: `ID: ${data?.meta_campaign_id}`,
      });

      loadDrafts();
    } catch (e) {
      setPublishLogs((l) => l.map((s) =>
        s.status === "pending" ? { ...s, status: "error", detail: (e as Error).message } : s
      ));
      toast({ title: "❌ Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  /* ─── Status helpers ─── */
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
      approved: { label: "Aprovado", cls: "bg-warning/10 text-warning" },
      published: { label: "Publicado", cls: "bg-success/10 text-success" },
      failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive" },
    };
    const c = map[status] || map.draft;
    return <Badge className={c.cls}>{c.label}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <ActiveProfileHeader />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Send className="w-6 h-6 text-primary" />
              Central de Publicação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie, revise e publique campanhas e catálogos diretamente no Meta Ads
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="campaign" className="gap-1.5">
              <Rocket className="w-4 h-4" /> Campanha
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1.5">
              <ShoppingBag className="w-4 h-4" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-1.5">
              <Send className="w-4 h-4" /> Publicar
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: CAMPAIGN ═══════ */}
          <TabsContent value="campaign" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main form */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="w-5 h-5 text-primary" />
                      Configuração da Campanha
                    </CardTitle>
                    <CardDescription>Defina objetivo, orçamento e conteúdo do anúncio</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Campanha *</Label>
                        <Input
                          placeholder="Ex: [VENDAS] Método RIC - TOF"
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Objetivo *</Label>
                        <Select value={form.objective} onValueChange={(v) => updateField("objective", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OBJECTIVES.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Orçamento Diário (R$) *</Label>
                        <Input
                          type="number"
                          min="5"
                          step="0.01"
                          value={form.dailyBudget}
                          onChange={(e) => updateField("dailyBudget", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Mínimo: R$ 5,00</p>
                      </div>
                      <div className="space-y-2">
                        <Label>CTA (Call to Action)</Label>
                        <Select value={form.cta} onValueChange={(v) => updateField("cta", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CTA_OPTIONS.map((c) => (
                              <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>URL de Destino {!form.useCatalog && "*"}</Label>
                      <Input
                        placeholder="https://seu-produto.com/oferta"
                        value={form.destinationUrl}
                        onChange={(e) => updateField("destinationUrl", e.target.value)}
                        disabled={form.useCatalog}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Texto Principal</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateAI}
                          disabled={aiGenerating || !profileId}
                          className="gap-1.5"
                        >
                          {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Gerar com IA
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Copy do anúncio..."
                        value={form.primaryText}
                        onChange={(e) => updateField("primaryText", e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Headline</Label>
                      <Input
                        placeholder="Título chamativo do anúncio"
                        value={form.headline}
                        onChange={(e) => updateField("headline", e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <Switch
                        checked={form.useCatalog}
                        onCheckedChange={(v) => updateField("useCatalog", v)}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">Usar Catálogo de Produtos (DPA)</p>
                        <p className="text-xs text-muted-foreground">Anúncios dinâmicos com seu catálogo de produtos</p>
                      </div>
                    </div>

                    {/* ─── Remarketing Section ─── */}
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <Switch
                          checked={form.isRemarketing}
                          onCheckedChange={(v) => updateField("isRemarketing", v)}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-primary" />
                            Campanha de Remarketing
                          </p>
                          <p className="text-xs text-muted-foreground">Alcance pessoas que já interagiram com seu negócio</p>
                        </div>
                      </div>

                      {form.isRemarketing && (
                        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Tipo de Público</Label>
                              <Select value={form.remarketingType} onValueChange={(v) => updateField("remarketingType", v)}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="website_visitors">🌐 Visitantes do Site</SelectItem>
                                  <SelectItem value="engagement">💬 Engajamento (Página)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Retenção (dias)</Label>
                              <Select value={form.retentionDays} onValueChange={(v) => updateField("retentionDays", v)}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="7">7 dias</SelectItem>
                                  <SelectItem value="14">14 dias</SelectItem>
                                  <SelectItem value="30">30 dias</SelectItem>
                                  <SelectItem value="60">60 dias</SelectItem>
                                  <SelectItem value="90">90 dias</SelectItem>
                                  <SelectItem value="180">180 dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateAudience}
                            disabled={creatingAudience}
                            className="gap-1.5 w-full"
                          >
                            {creatingAudience ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                            {creatingAudience ? "Criando público..." : "Criar Público de Remarketing"}
                          </Button>

                          <p className="text-[11px] text-muted-foreground">
                            💡 O público será criado na sua conta Meta e poderá ser usado imediatamente nesta e em futuras campanhas.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar: validations + recent */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Checklist de Publicação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { ok: !!form.name.trim(), label: "Nome da campanha" },
                      { ok: !!adAccountId && adAccountId !== "act_", label: "Ad Account ID" },
                      { ok: !!pageId, label: "Page ID" },
                      { ok: !isConversion || !!pixelId, label: "Pixel ID (conversão)" },
                      { ok: !!metaAccessToken, label: "Token Meta" },
                      { ok: parseFloat(form.dailyBudget) >= 5, label: "Orçamento ≥ R$5" },
                      { ok: !!form.destinationUrl || form.useCatalog, label: "URL ou Catálogo" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {item.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Publicações Recentes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                    {recentDrafts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma publicação ainda</p>
                    ) : (
                      recentDrafts.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0">
                          <div className="truncate max-w-[140px]">
                            <p className="font-medium text-foreground truncate">{d.campaign_name}</p>
                            <p className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                          {statusBadge(d.status)}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══════ TAB 2: CATALOG ═══════ */}
          <TabsContent value="catalog" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                      Catálogos de Produtos
                    </CardTitle>
                    <CardDescription>Gerencie catálogos para anúncios dinâmicos (DPA)</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadCatalogs} disabled={catalogsLoading} className="gap-1.5">
                    {catalogsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {catalogsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : catalogs.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Nenhum catálogo encontrado</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Crie um catálogo no Meta Business Suite e ele aparecerá aqui automaticamente.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer" className="gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Meta Commerce Manager
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catalogs.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCatalog(cat.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedCatalog === cat.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-foreground">{cat.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">ID: {cat.id}</p>
                          </div>
                          {selectedCatalog === cat.id && (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        {cat.product_count !== undefined && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {cat.product_count} produtos
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedCatalog && (
                  <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-sm text-success font-medium">
                      ✅ Catálogo selecionado: {catalogs.find((c) => c.id === selectedCatalog)?.name || selectedCatalog}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ative "Usar Catálogo (DPA)" na aba Campanha para utilizar este catálogo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ TAB 3: PREVIEW ═══════ */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Preview card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5 text-primary" />
                    Pré-visualização do Anúncio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border bg-card overflow-hidden max-w-sm mx-auto">
                    {/* Mock Facebook Ad Preview */}
                    <div className="p-3 flex items-center gap-2 border-b border-border">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">M</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{activeProfile?.name || "Seu Negócio"}</p>
                        <p className="text-[10px] text-muted-foreground">Patrocinado · 🌍</p>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {form.primaryText || "Seu texto principal aparecerá aqui..."}
                      </p>
                    </div>
                    <div className="bg-muted/50 h-48 flex items-center justify-center border-y border-border">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-xs">Imagem / Vídeo do anúncio</p>
                      </div>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase truncate">
                          {form.destinationUrl || "seu-site.com"}
                        </p>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {form.headline || "Headline do anúncio"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 ml-2 text-xs">
                        {form.cta.replace(/_/g, " ")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-primary" />
                    Resumo da Campanha
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Nome", value: form.name || "—", icon: Target },
                    { label: "Objetivo", value: OBJECTIVES.find((o) => o.value === form.objective)?.label || form.objective, icon: Rocket },
                    { label: "Orçamento Diário", value: `R$ ${form.dailyBudget}`, icon: DollarSign },
                    { label: "Destino", value: form.useCatalog ? "Catálogo DPA" : (form.destinationUrl || "—"), icon: Globe },
                    { label: "CTA", value: form.cta.replace(/_/g, " "), icon: Send },
                    { label: "Perfil", value: activeProfile?.name || "—", icon: Users },
                    { label: "Conta", value: adAccountId || "—", icon: Target },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground w-32 shrink-0">{item.label}</span>
                      <span className="text-sm font-medium text-foreground truncate">{item.value}</span>
                    </div>
                  ))}

                  <Separator />

                  {validationErrors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Pendências
                      </p>
                      {validationErrors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive/80 ml-5.5">• {err}</p>
                      ))}
                    </div>
                  )}

                  <Button
                    className="w-full gap-2"
                    disabled={!canPublish || publishing}
                    onClick={() => setShowConfirm(true)}
                  >
                    <Send className="w-4 h-4" />
                    Publicar Campanha
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════ TAB 4: PUBLISH ═══════ */}
          <TabsContent value="publish" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="w-5 h-5 text-primary" />
                  Status da Publicação
                </CardTitle>
                <CardDescription>
                  Acompanhe o progresso em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                {publishLogs.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Rocket className="w-10 h-10 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma publicação em andamento. Configure sua campanha e clique em Publicar.
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab("campaign")}>
                      Ir para Campanha
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {publishLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {log.status === "done" && <CheckCircle2 className="w-5 h-5 text-success" />}
                          {log.status === "error" && <XCircle className="w-5 h-5 text-destructive" />}
                          {log.status === "pending" && (
                            publishing ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Clock className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            log.status === "done" ? "text-success" : log.status === "error" ? "text-destructive" : "text-foreground"
                          }`}>
                            {log.step}
                          </p>
                          {log.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{log.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {!publishing && publishLogs.some((l) => l.status === "done") && (
                      <div className="mt-6 p-4 rounded-lg bg-success/5 border border-success/20 text-center space-y-3">
                        <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                        <p className="text-sm font-semibold text-success">Campanha publicada com sucesso!</p>
                        <p className="text-xs text-muted-foreground">
                          A campanha foi criada com status PAUSADO. Ative-a no Gerenciador de Anúncios quando estiver pronto.
                        </p>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId?.replace("act_", "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir Gerenciador de Anúncios
                          </a>
                        </Button>
                      </div>
                    )}

                    {!publishing && publishLogs.some((l) => l.status === "error") && (
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" onClick={() => setActiveTab("campaign")}>
                          Corrigir e Tentar Novamente
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Confirmation Dialog ─── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Publicação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está prestes a publicar esta campanha no Meta Ads:</p>
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <p><strong>Cliente:</strong> {activeProfile?.name}</p>
                  <p><strong>Conta:</strong> {adAccountId}</p>
                  <p><strong>Campanha:</strong> {form.name}</p>
                  <p><strong>Orçamento:</strong> R$ {form.dailyBudget}/dia</p>
                  <p><strong>Objetivo:</strong> {OBJECTIVES.find((o) => o.value === form.objective)?.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A campanha será criada com status <strong>PAUSADO</strong>.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} className="gap-1.5">
              <Rocket className="w-4 h-4" /> Publicar Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
