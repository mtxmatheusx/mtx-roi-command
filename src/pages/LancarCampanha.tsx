import { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Rocket, Brain, ChevronDown, CheckCircle2, XCircle, Clock, Loader2, ExternalLink, AlertTriangle, Sparkles, Image as ImageIcon, Video, Trash2, Copy, Upload, X, ShoppingBag, MessageSquarePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";

type CopyOption = { copy_type?: "direct_response" | "storytelling" | "social_proof"; headline: string; primary_text: string; cta: string };
type TargetingSuggestion = { audience_type?: string; age_range?: string; interests?: string[]; lookalike_source?: string; placements?: string; notes?: string };

interface AndromedaTargeting {
  age_min: number;
  age_max: number;
  genders: number[];
  semantic_seeds: string[];
  andromeda_exclusion: string[];
}

interface DraftData {
  campaign_name: string;
  copy_options: CopyOption[];
  targeting_suggestion: TargetingSuggestion;
  daily_budget: number;
  ai_reasoning: string;
  andromeda_targeting?: AndromedaTargeting;
}

type DraftRecord = {
  id: string;
  status: string;
  objective: string;
  campaign_name: string;
  daily_budget: number;
  copy_options: CopyOption[];
  targeting_suggestion: TargetingSuggestion;
  ai_reasoning: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_ad_id: string | null;
  error_message: string | null;
  created_at: string;
};

interface CatalogItem {
  id: string;
  name: string;
  product_count?: number;
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

const objectiveLabels: Record<string, string> = {
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Leads",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
};

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground", icon: Clock },
  approved: { label: "Aprovado", className: "bg-warning/10 text-warning", icon: Clock },
  published: { label: "Publicado", className: "bg-success/10 text-success", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive", icon: XCircle },
  rejected: { label: "Rejeitado", className: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function LancarCampanha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const { activeProfile, budgetMaximo, cpaMeta, ticketMedio, limiteEscala, budgetFrequency, productContext, catalogId: profileCatalogId } = useClientProfiles();
  const { campaigns } = useMetaAds();

  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState("OUTCOME_SALES");
  const [dailyBudget, setDailyBudget] = useState(50);
  const [campaignCount, setCampaignCount] = useState(1);
  const [draft, setDraft] = useState<DraftData | null>(null);

  // Handle Strategic Pre-fill
  useEffect(() => {
    if (location.state?.prefill) {
      const { prefill, reasoning } = location.state;
      setObjective(prefill.objective || "OUTCOME_SALES");
      setDailyBudget(prefill.daily_budget || 50);
      if (prefill.use_catalog) {
        setUseCatalog(true);
      }
      setDraft({
        campaign_name: prefill.campaign_name,
        copy_options: [{ headline: "Aguardando sugestão...", primary_text: prefill.destination_url ? `Link: ${prefill.destination_url}\n\nAguardando sugestão...` : "Aguardando sugestão...", cta: "Saiba Mais" }],
        targeting_suggestion: { notes: prefill.targeting_notes },
        daily_budget: prefill.daily_budget || 50,
        ai_reasoning: reasoning || ""
      });
      setStep(2); // Jump to review step
      toast({ title: "Estratégia Carregada", description: "A IA já preencheu os detalhes básicos. Agora, gere a sugestão de copy." });

      // Clear state to avoid re-triggering on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, toast]);
  const [selectedCopyIdx, setSelectedCopyIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState("");
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishResult, setPublishResult] = useState<{ success: boolean; meta_campaign_id?: string; ads_manager_url?: string; error?: string; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string; step?: string; steps?: string[]; rollback?: boolean; total_ads?: number; failed_ads?: number; campaign_results?: any[] } | null>(null);
  const [publishLogs, setPublishLogs] = useState<{ time: string; message: string; status: "done" | "pending" | "error" }[]>([]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [creativeBrain, setCreativeBrain] = useState<{ recommendation: any; total_assets: number; total_campaigns_analyzed?: number } | null>(null);
  const [isChoosingCreative, setIsChoosingCreative] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [useAndromeda, setUseAndromeda] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DraftRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scaleTarget, setScaleTarget] = useState<DraftRecord | null>(null);
  const [isScaling, setIsScaling] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recentAssets, setRecentAssets] = useState<{ id: string; file_name: string; file_url: string; file_type: string; description: string | null }[]>([]);
  const [selectedAssetUrls, setSelectedAssetUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [useCatalog, setUseCatalog] = useState(false);
  const [feedbackIdx, setFeedbackIdx] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [isRemarketing, setIsRemarketing] = useState(false);
  const [remarketingType, setRemarketingType] = useState("website_visitors");
  const [retentionDays, setRetentionDays] = useState("30");
  const [audienceId, setAudienceId] = useState("");
  const [creatingAudience, setCreatingAudience] = useState(false);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState("");

  const handleSendFeedback = async (copyIdx: number) => {
    if (!user?.id || !draft || !feedbackText.trim()) return;
    setIsSendingFeedback(true);
    try {
      const copy = draft.copy_options[copyIdx];
      await supabase.from("copy_feedback" as any).insert({
        user_id: user.id,
        profile_id: activeProfile?.id || null,
        copy_type: copy.copy_type || null,
        original_copy: `${copy.headline}\n\n${copy.primary_text}`,
        suggested_correction: feedbackText.trim(),
      } as any);
      toast({ title: "Feedback enviado!", description: "Sua sugestão será analisada para melhorar as próximas gerações." });
      setFeedbackIdx(null);
      setFeedbackText("");
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // Load draft history filtered by profile
  useEffect(() => {
    if (!user?.id) return;
    loadDrafts();
  }, [user?.id, activeProfile?.id]);

  // Load recent assets
  useEffect(() => {
    if (!user?.id || !activeProfile?.id) return;
    loadRecentAssets();
  }, [user?.id, activeProfile?.id]);

  const loadDrafts = async () => {
    let query = supabase
      .from("campaign_drafts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (activeProfile?.id) {
      query = query.eq("profile_id", activeProfile.id);
    }
    const { data } = await query;
    if (data) setDrafts(data as unknown as DraftRecord[]);
  };

  const loadRecentAssets = async () => {
    const { data } = await supabase
      .from("creative_assets")
      .select("id, file_name, file_url, file_type, description")
      .eq("user_id", user!.id)
      .eq("profile_id", activeProfile!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRecentAssets(data);
  };

  const loadCatalogs = async () => {
    if (!activeProfile?.id) return;
    setCatalogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-catalogs", {
        body: { profileId: activeProfile.id },
      });
      if (error) throw error;
      setCatalogs(data?.catalogs || []);
      if (activeProfile?.catalog_id) setSelectedCatalog(activeProfile.catalog_id);
    } catch (e) {
      console.error("Catalog fetch error:", e);
    } finally {
      setCatalogsLoading(false);
    }
  };

  const handleCreateAudience = async () => {
    if (!activeProfile?.id) return;
    if (remarketingType === "website_visitors" && (!activeProfile?.pixel_id || activeProfile.pixel_id.trim() === "")) {
      toast({ title: "Pixel ID obrigatório", description: "Configure o Pixel ID em Configurações para criar público de visitantes.", variant: "destructive" });
      return;
    }
    if (remarketingType === "engagement" && (!activeProfile?.page_id || activeProfile.page_id.trim() === "")) {
      toast({ title: "Page ID obrigatório", description: "Configure o Page ID em Configurações.", variant: "destructive" });
      return;
    }
    setCreatingAudience(true);
    try {
      const body: Record<string, unknown> = {
        profileId: activeProfile.id,
        audienceType: remarketingType,
        name: `${activeProfile.name} | ${remarketingType === "website_visitors" ? "Visitantes" : "Engajamento"} - ${retentionDays}d`,
      };
      if (remarketingType === "website_visitors") {
        body.rule = { retention_seconds: parseInt(retentionDays) * 86400, url_filter: "" };
      } else if (remarketingType === "engagement") {
        body.rule = { retention_seconds: parseInt(retentionDays) * 86400 };
      }
      const { data, error } = await supabase.functions.invoke("manage-audiences", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.audience_id) setAudienceId(data.audience_id);
      toast({ title: "✅ Público criado!", description: `${data.name} (ID: ${data.audience_id})` });
    } catch (e: any) {
      toast({ title: "Erro ao criar público", description: e.message, variant: "destructive" });
    } finally {
      setCreatingAudience(false);
    }
  };

  const toggleAssetUrl = (url: string) => {
    setSelectedAssetUrls(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : prev.length < 50 ? [...prev, url] : prev
    );
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!user?.id || !activeProfile?.id) return;
    const fileArray = Array.from(files);
    const allowed = ["image/jpeg", "image/png", "video/mp4", "video/quicktime"];
    const valid = fileArray.filter(f => allowed.includes(f.type));
    if (valid.length === 0) {
      toast({ title: "Formato inválido", description: "Aceitos: JPG, PNG, MP4, MOV", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${activeProfile.id}/${crypto.randomUUID()}.${ext}`;

      setUploadProgress(Math.round(((i) / valid.length) * 100));

      const { error: uploadErr } = await supabase.storage.from("creative-assets").upload(path, file);
      if (uploadErr) {
        toast({ title: "Erro no upload", description: uploadErr.message, variant: "destructive" });
        continue;
      }

      const { data: publicUrl } = supabase.storage.from("creative-assets").getPublicUrl(path);
      const fileType = file.type.startsWith("video") ? "video" : "image";

      const { data: inserted, error: insertErr } = await supabase.from("creative_assets").insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        file_name: file.name,
        file_url: publicUrl.publicUrl,
        file_type: fileType,
        source_tag: "uploaded",
      }).select("id").single();

      if (insertErr || !inserted) continue;

      // Trigger AI indexing
      supabase.functions.invoke("index-creative-asset", {
        body: {
          assetId: inserted.id,
          profileId: activeProfile.id,
          fileUrl: publicUrl.publicUrl,
          fileType,
          fileName: file.name,
        },
      }).then(({ data }) => {
        if (data?.description) {
          setRecentAssets(prev => prev.map(a => a.id === inserted.id ? { ...a, description: data.description } : a));
        }
      }).catch(() => { });
    }

    setUploadProgress(100);
    toast({ title: "✅ Upload concluído!", description: `${valid.length} ativo(s) enviado(s) e indexação IA iniciada.` });
    setIsUploading(false);
    setUploadOpen(false);
    loadRecentAssets();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  }, [user?.id, activeProfile?.id]);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-campaign-draft", {
        body: {
          objective,
          profileId: activeProfile?.id,
          profileConfig: {
            name: activeProfile?.name,
            cpa_meta: cpaMeta,
            ticket_medio: ticketMedio,
            budget_maximo: budgetMaximo,
            budget_frequency: budgetFrequency,
            limite_escala: limiteEscala,
          },
          campaignData: campaigns?.slice(0, 5).map((c: any) => ({
            name: c.name,
            spend: c.spend,
            revenue: c.revenue,
            cpa: c.cpa,
            roas: c.roas,
            status: c.status,
          })),
          productContext: productContext || undefined,
        },
      });

      if (error) throw error;

      if (data?.blocked) {
        toast({ title: "⚠️ IA Bloqueada", description: data.error || "Faltam dados no Dossiê ou falha de conexão com a Meta Ads. Preencha as configurações do perfil.", variant: "destructive" });
        setIsGenerating(false);
        return;
      }

      setDraft({
        campaign_name: data.campaign_name,
        copy_options: data.copy_options || [],
        targeting_suggestion: data.targeting_suggestion || {},
        daily_budget: data.daily_budget || dailyBudget,
        ai_reasoning: data.ai_reasoning || "",
        andromeda_targeting: data.andromeda_targeting || undefined,
      });
      setUseAndromeda(!!data.andromeda_targeting);
      setDailyBudget(data.daily_budget || dailyBudget);
      setSelectedCopyIdx(0);
      setStep(2);
      toast({ title: "Sugestão gerada!", description: "Revise os detalhes antes de aprovar." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar sugestão", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id || !activeProfile || !draft) return;
    const { error } = await supabase.from("campaign_drafts").insert({
      user_id: user.id,
      profile_id: activeProfile.id,
      status: "draft",
      objective,
      campaign_name: draft.campaign_name,
      daily_budget: dailyBudget,
      copy_options: draft.copy_options as any,
      targeting_suggestion: draft.targeting_suggestion as any,
      ai_reasoning: draft.ai_reasoning,
      andromeda_targeting: useAndromeda && draft.andromeda_targeting ? draft.andromeda_targeting as any : null,
    });
    if (error) {
      toast({ title: "Erro ao salvar rascunho", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rascunho salvo!" });
      loadDrafts();
    }
  };

  const handlePublish = async () => {
    if (!user?.id || !activeProfile || !draft) return;
    setIsPublishing(true);
    setPublishResult(null);
    setPublishLogs([]);

    const addLog = (message: string, status: "done" | "pending" | "error" = "pending") => {
      const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setPublishLogs((prev) => [...prev, { time, message, status }]);
    };

    const totalCampaigns = campaignCount;
    const campaignResults: any[] = [];

    try {
      for (let ci = 0; ci < totalCampaigns; ci++) {
        const suffix = totalCampaigns > 1 ? ` [${ci + 1}/${totalCampaigns}]` : "";
        const campaignName = `${draft.campaign_name}${suffix}`;

        addLog(`${totalCampaigns > 1 ? `Campanha ${ci + 1}/${totalCampaigns}: ` : ""}Salvando rascunho...`, "pending");
        setPublishStep(`Campanha ${ci + 1}/${totalCampaigns} — Salvando...`);
        setPublishProgress(Math.round(((ci) / totalCampaigns) * 100));

        const { data: inserted, error: insertErr } = await supabase.from("campaign_drafts").insert({
          user_id: user.id,
          profile_id: activeProfile.id,
          status: "approved",
          objective,
          campaign_name: campaignName,
          daily_budget: dailyBudget,
          copy_options: [draft.copy_options[selectedCopyIdx]] as any,
          targeting_suggestion: draft.targeting_suggestion as any,
          ai_reasoning: draft.ai_reasoning,
          andromeda_targeting: useAndromeda && draft.andromeda_targeting ? draft.andromeda_targeting as any : null,
          injected_creative_url: selectedAssetUrls.length === 1 ? selectedAssetUrls[0] : null,
          creative_urls: selectedAssetUrls.length > 0 ? selectedAssetUrls : [],
        } as any).select("id").single();

        if (insertErr || !inserted) {
          const errMsg = insertErr?.message || "Erro desconhecido ao inserir rascunho";
          addLog(`Erro ao salvar rascunho${suffix}: ${errMsg}`, "error");
          toast({ title: "❌ Falha no banco de dados", description: errMsg, variant: "destructive" });
          campaignResults.push({ success: false, error: errMsg, name: campaignName });
          continue;
        }

        addLog(`Rascunho salvo${suffix}`, "done");
        addLog(`Enviando para Meta API${suffix}...`, "pending");
        setPublishStep(`Campanha ${ci + 1}/${totalCampaigns} — Criando na Meta...`);

        const { data: result, error: publishError } = await supabase.functions.invoke("create-meta-campaign", {
          body: {
            draftId: inserted.id,
            creativeUrls: selectedAssetUrls.length > 0 ? selectedAssetUrls : undefined,
          },
        });

        if (publishError) {
          addLog(`Erro de rede${suffix}: ${publishError.message}`, "error");
          toast({ title: "❌ Erro de conexão", description: publishError.message, variant: "destructive" });
          campaignResults.push({ success: false, error: publishError.message, name: campaignName });
          continue;
        }

        if (result?.error) {
          const stepLabels: Record<string, string> = { campaign: "Campanha", adset: "Conjunto", ad: "Anúncio", media_upload: "Upload", ad_validation: "Validação", token_validation: "Token" };
          const failedStep = result.step ? stepLabels[result.step] || result.step : "";
          addLog(`Falha${suffix}: ${failedStep} — ${result.error}`, "error");
          if (result.rollback) addLog(`Rollback executado${suffix}`, "done");
          campaignResults.push({ success: false, error: result.error, step: result.step, name: campaignName });
        } else {
          const adCount = result.total_ads || 1;
          addLog(`✅ Campanha${suffix} publicada! ${adCount} anúncio(s) criados`, "done");
          if (result.failed_ads > 0) addLog(`⚠️ ${result.failed_ads} anúncio(s) falharam`, "error");
          campaignResults.push({
            success: true,
            meta_campaign_id: result.meta_campaign_id,
            ads_manager_url: result.ads_manager_url,
            total_ads: adCount,
            failed_ads: result.failed_ads || 0,
            name: campaignName,
          });
        }

        setPublishProgress(Math.round(((ci + 1) / totalCampaigns) * 100));
      }

      // Aggregate results
      const successes = campaignResults.filter(r => r.success);
      const failures = campaignResults.filter(r => !r.success);

      if (successes.length > 0) {
        setPublishStep(`${successes.length}/${totalCampaigns} campanha(s) publicadas!`);
        setPublishResult({
          success: true,
          meta_campaign_id: successes[0].meta_campaign_id,
          ads_manager_url: successes[0].ads_manager_url,
          total_ads: successes.reduce((sum: number, r: any) => sum + (r.total_ads || 0), 0),
          failed_ads: failures.length,
          campaign_results: campaignResults,
        });
      } else {
        setPublishStep("Todas as campanhas falharam");
        setPublishResult({
          success: false,
          error: failures.map((f: any) => f.error).join(" | "),
          campaign_results: campaignResults,
        });
      }

      loadDrafts();
    } catch (e: any) {
      const errMsg = e?.message || "Erro desconhecido";
      addLog(`Erro crítico: ${errMsg}`, "error");
      setPublishStep(`Erro: ${errMsg}`);
      setPublishProgress(100);
      setPublishResult({ success: false, error: errMsg });
      toast({ title: "❌ Erro crítico na publicação", description: errMsg, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setDraft(null);
    setPublishResult(null);
    setPublishProgress(0);
    setPublishStep("");
    setSelectedAssetUrls([]);
    setCampaignCount(1);
  };

  const handleDeleteDraft = async (d: DraftRecord) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-meta-campaign", {
        body: { draftId: d.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro ao apagar", description: data.error, variant: "destructive" });
      } else {
        setDrafts((prev) => prev.filter((x) => x.id !== d.id));
        toast({ title: "✅ Sujeira apagada com sucesso do Meta Ads e do painel." });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCloneScale = async (d: DraftRecord) => {
    setIsScaling(true);
    try {
      const { data, error } = await supabase.functions.invoke("clone-scale-campaign", {
        body: { draftId: d.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro ao clonar", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "💸 Campanha clonada com sucesso! Orçamento escalado em 20% e injetado na Meta Ads." });
        loadDrafts();
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsScaling(false);
      setScaleTarget(null);
    }
  };

  return (
    <AppLayout>
      <ActiveProfileHeader />
      <div className="space-y-6">
        {/* Block if no profile */}
        {!activeProfile && (
          <div className="relative">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center p-8">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <p className="text-lg font-semibold">⚠️ Selecione um cliente</p>
                <p className="text-sm text-muted-foreground mt-1">Selecione um cliente no topo da página para carregar o contexto e as credenciais.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Lançar Campanha
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Crie campanhas com assistência da IA e publique na Meta</p>
          </div>
          {step > 1 && (
            <Button variant="ghost" onClick={resetWizard}>Nova Campanha</Button>
          )}
        </div>

        {/* Pixel warning for conversion objectives */}
        {(objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS") && (!activeProfile?.pixel_id || activeProfile.pixel_id.trim() === "") && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Pixel ID não configurado. Campanhas de conversão requerem um Pixel. Configure em Configurações.
          </div>
        )}

        {/* Budget warning */}
        {budgetMaximo > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-4 py-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Budget máximo {budgetFrequency === "daily" ? "diário" : budgetFrequency === "weekly" ? "semanal" : "mensal"}: R$ {budgetMaximo.toLocaleString("pt-BR")}
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${step >= s ? "bg-primary/20 text-primary border-primary/50" : "bg-secondary text-muted-foreground border-border"
                }`}>
                {s}
              </div>
              <span className={`text-xs ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Objetivo" : s === 2 ? "Revisão IA" : "Aprovar"}
              </span>
              {s < 3 && <div className={`w-12 h-px ${step > s ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuração da Campanha</CardTitle>
              <CardDescription>Defina o objetivo, orçamento e quantidade de campanhas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUTCOME_SALES">Vendas</SelectItem>
                      <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                      <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orçamento Diário (R$)</Label>
                  <Input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Campanhas (1-5)</Label>
                  <Input type="number" value={campaignCount} onChange={(e) => setCampaignCount(Math.max(1, Math.min(5, Number(e.target.value))))} min={1} max={5} />
                </div>
              </div>
              {campaignCount > 1 && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                  <Rocket className="w-4 h-4 shrink-0" />
                  {campaignCount} campanhas independentes serão criadas em paralelo, cada uma com seu próprio conjunto e anúncios.
                </div>
              )}
              {profileCatalogId && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/50">
                  <Checkbox id="useCatalog" checked={useCatalog} onCheckedChange={(v) => setUseCatalog(!!v)} />
                  <label htmlFor="useCatalog" className="text-sm cursor-pointer flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    Usar Catálogo de Produtos (DPA / Advantage+ Catalog)
                    <span className="text-xs text-muted-foreground">ID: {profileCatalogId}</span>
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleGenerateAI} disabled={isGenerating} className="gap-2">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  {isGenerating ? "Gerando sugestão..." : "Sugestão da IA"}
                </Button>
                <Button variant="outline" onClick={() => {
                  setDraft({
                    campaign_name: `${objectiveLabels[objective]} | Campanha Manual | ${new Date().toISOString().slice(0, 7)}`,
                    copy_options: [{ headline: "", primary_text: "", cta: "Saiba Mais" }],
                    targeting_suggestion: { audience_type: "broad", placements: "advantage_plus" },
                    daily_budget: dailyBudget,
                    ai_reasoning: "",
                  });
                  setStep(2);
                }}>
                  Configurar manualmente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && draft && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nome da Campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={draft.campaign_name}
                  onChange={(e) => setDraft({ ...draft, campaign_name: e.target.value })}
                />
                {campaignCount > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">Cada campanha receberá sufixo [1/{campaignCount}], [2/{campaignCount}], etc.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Opções de Copy</CardTitle>
                    <CardDescription>Selecione a melhor copy para seu anúncio</CardDescription>
                  </div>
                  {draft.copy_options.length === 1 && draft.copy_options[0].headline === "Aguardando sugestão..." && (
                    <Button onClick={handleGenerateAI} disabled={isGenerating} size="sm" className="gap-2">
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      {isGenerating ? "Gerando..." : "Gerar Copy com IA"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.copy_options.map((copy, i) => {
                  const copyTypeConfig: Record<string, { label: string; desc: string; className: string }> = {
                    direct_response: { label: "Direct Response", desc: "Foco na dor e oferta", className: "bg-destructive/15 text-destructive border-destructive/30" },
                    storytelling: { label: "Storytelling", desc: "Narrativa de transformação", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
                    social_proof: { label: "Social Proof", desc: "Resultados e autoridade", className: "bg-success/10 text-success border-success/20" },
                  };
                  const ct = copy.copy_type ? copyTypeConfig[copy.copy_type] : null;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedCopyIdx(i)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedCopyIdx === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {ct ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${ct.className}`}>
                              {ct.label}
                            </span>
                          ) : (
                            <Badge variant={selectedCopyIdx === i ? "default" : "secondary"}>
                              Opção {i + 1}
                            </Badge>
                          )}
                          {ct && <span className="text-xs text-muted-foreground">{ct.desc}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); setFeedbackIdx(feedbackIdx === i ? null : i); setFeedbackText(""); }}
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            Corrigir
                          </Button>
                          <span className="text-xs text-muted-foreground">{copy.cta}</span>
                        </div>
                      </div>
                      <p className="font-semibold text-sm">{copy.headline}</p>
                      <p className="text-sm text-muted-foreground mt-1">{copy.primary_text}</p>

                      {feedbackIdx === i && (
                        <div className="mt-3 p-3 rounded-md border border-primary/20 bg-primary/5 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-medium text-primary">Sugerir correção para esta copy:</p>
                          <Textarea
                            placeholder="Descreva o que está errado ou como deveria ser..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            className="text-sm min-h-[70px]"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setFeedbackIdx(null); setFeedbackText(""); }}>Cancelar</Button>
                            <Button size="sm" disabled={!feedbackText.trim() || isSendingFeedback} onClick={() => handleSendFeedback(i)} className="gap-1">
                              {isSendingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquarePlus className="w-3 h-3" />}
                              Enviar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Segmentação Sugerida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tipo de Público:</span>
                    <p className="font-medium">{draft.targeting_suggestion.audience_type || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Faixa Etária:</span>
                    <p className="font-medium">{draft.targeting_suggestion.age_range || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Posicionamentos:</span>
                    <p className="font-medium">{draft.targeting_suggestion.placements || "—"}</p>
                  </div>
                  {draft.targeting_suggestion.interests && (
                    <div>
                      <span className="text-muted-foreground">Interesses:</span>
                      <p className="font-medium">{draft.targeting_suggestion.interests.join(", ")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Andromeda Targeting Card */}
            {draft.andromeda_targeting && (
              <Card className={`border-dashed ${useAndromeda ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      🌌 Segmentação Andromeda Sugerida
                    </CardTitle>
                    <Badge className={useAndromeda ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}>
                      {useAndromeda ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <CardDescription>Parâmetros gerados pela IA para o algoritmo Andromeda da Meta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <div>
                        <span className="text-muted-foreground">Idade:</span>
                        <p className="font-medium">{draft.andromeda_targeting.age_min} a {draft.andromeda_targeting.age_max} anos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚻</span>
                      <div>
                        <span className="text-muted-foreground">Gênero:</span>
                        <p className="font-medium">
                          {draft.andromeda_targeting.genders.includes(0) ? "Todos" :
                            draft.andromeda_targeting.genders.includes(2) ? "Feminino" :
                              draft.andromeda_targeting.genders.includes(1) ? "Masculino" : "Todos"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🌱</span>
                      <span className="text-sm text-muted-foreground">Sementes Semânticas:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.andromeda_targeting.semantic_seeds.map((seed, i) => (
                        <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {seed}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {draft.andromeda_targeting.andromeda_exclusion.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">🚫</span>
                        <span className="text-sm text-muted-foreground">Exclusões Andromeda:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {draft.andromeda_targeting.andromeda_exclusion.map((exc, i) => (
                          <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            {exc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant={useAndromeda ? "secondary" : "default"}
                    className="gap-2 w-full"
                    onClick={() => setUseAndromeda(!useAndromeda)}
                  >
                    {useAndromeda ? "✅ Injetado no Conjunto de Anúncios" : "🌌 Injetar no Conjunto de Anúncios"}
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Diário (R$)</Label>
                <Input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} min={1} />
              </div>
            </div>

            {draft.ai_reasoning && (
              <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-muted-foreground">
                    <Brain className="w-4 h-4" />
                    Raciocínio da IA
                    <ChevronDown className={`w-4 h-4 transition-transform ${reasoningOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="mt-2">
                    <CardContent className="pt-4 prose prose-sm max-w-none">
                      <ReactMarkdown>{draft.ai_reasoning}</ReactMarkdown>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Creative Brain + Multi-select */}
            <Card className="border-dashed border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  🧠 Cérebro de Criativos
                </CardTitle>
                <CardDescription>Selecione até 50 criativos para criar 1 anúncio por ativo no mesmo conjunto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={async () => {
                      if (!activeProfile) return;
                      setIsChoosingCreative(true);
                      setCreativeBrain(null);
                      try {
                        const { data, error } = await supabase.functions.invoke("ai-creative-brain", {
                          body: {
                            profileId: activeProfile.id,
                            objective,
                            campaignContext: draft?.campaign_name,
                          },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        setCreativeBrain(data);
                        if (data.recommendation?.recommended_asset_url) {
                          const url = data.recommendation.recommended_asset_url;
                          if (!selectedAssetUrls.includes(url)) {
                            setSelectedAssetUrls(prev => [...prev, url]);
                          }
                        }
                        toast({ title: "🧠 Criativo recomendado!", description: data.recommendation?.recommended_asset_name });
                      } catch (e: any) {
                        toast({ title: "Erro no Cérebro de Criativos", description: e.message, variant: "destructive" });
                      } finally {
                        setIsChoosingCreative(false);
                      }
                    }}
                    disabled={isChoosingCreative}
                    variant="outline"
                    className="gap-2"
                  >
                    {isChoosingCreative ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {isChoosingCreative ? "Analisando criativos..." : "Escolher Criativo com IA"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setUploadOpen(true)}>
                    <Upload className="w-4 h-4" />
                    📤 Subir Novo Ativo
                  </Button>
                  {selectedAssetUrls.length > 0 && (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-sm px-3 py-1">
                      {selectedAssetUrls.length} criativo(s) selecionado(s)
                    </Badge>
                  )}
                  {selectedAssetUrls.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSelectedAssetUrls([])}>
                      <X className="w-3 h-3 mr-1" /> Limpar seleção
                    </Button>
                  )}
                </div>

                {creativeBrain?.recommendation && (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {creativeBrain.recommendation.recommended_asset_url ? (
                        creativeBrain.recommendation.recommended_asset_type === "video" ? (
                          <div className="w-20 h-20 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Video className="w-8 h-8 text-muted-foreground/50" />
                          </div>
                        ) : (
                          <img
                            src={creativeBrain.recommendation.recommended_asset_url}
                            alt="Criativo recomendado"
                            className="w-20 h-20 rounded-lg object-cover shrink-0"
                          />
                        )
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{creativeBrain.recommendation.recommended_asset_name}</p>
                          <Badge className="bg-primary/15 text-primary shrink-0">
                            {creativeBrain.recommendation.confidence_score}% confiança
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{creativeBrain.recommendation.justification}</p>
                        {creativeBrain.recommendation.creative_angle && (
                          <p className="text-xs text-primary mt-1">💡 Ângulo: {creativeBrain.recommendation.creative_angle}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Analisados: {creativeBrain.total_assets} ativos · {creativeBrain.total_campaigns_analyzed || 0} campanhas
                    </p>
                  </div>
                )}

                {/* Recent Assets Grid — Multi-select */}
                {recentAssets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Ativos Recentes ({recentAssets.length})</p>
                      {recentAssets.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            if (selectedAssetUrls.length === recentAssets.length) {
                              setSelectedAssetUrls([]);
                            } else {
                              setSelectedAssetUrls(recentAssets.slice(0, 50).map(a => a.file_url));
                            }
                          }}
                        >
                          {selectedAssetUrls.length === recentAssets.length ? "Desmarcar todos" : "Selecionar todos"}
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {recentAssets.map((asset) => {
                        const isSelected = selectedAssetUrls.includes(asset.file_url);
                        return (
                          <button
                            key={asset.id}
                            onClick={() => toggleAssetUrl(asset.file_url)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-80 ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                              }`}
                            title={asset.description || asset.file_name}
                          >
                            {asset.file_type === "video" ? (
                              <div className="w-full h-full bg-secondary flex items-center justify-center">
                                <Video className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                            ) : (
                              <img src={asset.file_url} alt={asset.file_name} className="w-full h-full object-cover" />
                            )}
                            {/* Checkbox overlay */}
                            <div className="absolute top-1 left-1">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background/70 border-border"
                                }`}>
                                {isSelected && "✓"}
                              </div>
                            </div>
                            {asset.description && (
                              <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5">
                                <span className="text-[10px] text-primary">✨ IA</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => setStep(3)}>Revisar e Aprovar</Button>
              <Button variant="outline" onClick={handleSaveDraft}>Salvar como Rascunho</Button>
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>📤 Subir Novo Ativo</DialogTitle>
              <DialogDescription>Arraste ou selecione fotos e vídeos para o Cérebro de Criativos.</DialogDescription>
            </DialogHeader>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Arraste arquivos aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, MP4, MOV — máx. 20MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.mp4,.mov"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFileUpload(e.target.files);
                }}
              />
            </div>
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{uploadProgress}% — Enviando e indexando com IA...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Step 3 */}
        {step === 3 && draft && (
          <div className="space-y-4">
            {/* Page ID warning */}
            {(!activeProfile?.page_id || activeProfile.page_id.trim() === "") && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                ⚠️ Vincule uma Página do Facebook nas Configurações para publicar. O botão "Aprovar Execução" está desabilitado.
              </div>
            )}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Resumo para Aprovação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Campanha:</span>
                    <p className="font-semibold">{draft.campaign_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Objetivo:</span>
                    <p className="font-semibold">{objectiveLabels[objective]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Budget Diário:</span>
                    <p className="font-semibold">R$ {dailyBudget.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Perfil:</span>
                    <p className="font-semibold">{activeProfile?.name || "—"}</p>
                  </div>
                  {campaignCount > 1 && (
                    <div>
                      <span className="text-muted-foreground">Campanhas:</span>
                      <p className="font-semibold">{campaignCount} independentes</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Criativos:</span>
                    <p className="font-semibold">{selectedAssetUrls.length || 0} selecionado(s)</p>
                  </div>
                </div>

                {selectedAssetUrls.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Criativos selecionados ({selectedAssetUrls.length}):</p>
                    <div className="flex gap-1 flex-wrap">
                      {selectedAssetUrls.slice(0, 10).map((url, i) => (
                        <div key={i} className="w-10 h-10 rounded border border-border overflow-hidden">
                          {/\.(mp4|mov|webm)/i.test(url) ? (
                            <div className="w-full h-full bg-secondary flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground/50" /></div>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                      {selectedAssetUrls.length > 10 && (
                        <div className="w-10 h-10 rounded border border-border bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                          +{selectedAssetUrls.length - 10}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Copy selecionada:</p>
                  <p className="font-semibold text-sm">{draft.copy_options[selectedCopyIdx]?.headline}</p>
                  <p className="text-sm text-muted-foreground">{draft.copy_options[selectedCopyIdx]?.primary_text}</p>
                </div>

                {/* Publish progress */}
                {(isPublishing || publishResult) && (
                  <div className="space-y-2 pt-2">
                    <Progress value={publishProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      {isPublishing && <Loader2 className="w-3 h-3 animate-spin" />}
                      {publishStep}
                    </p>
                  </div>
                )}

                {publishResult?.success && (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-2">
                    <p className="text-success font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {publishResult.total_ads || 1} anúncio(s) publicados com sucesso!
                    </p>
                    {publishResult.failed_ads && publishResult.failed_ads > 0 && (
                      <p className="text-xs text-amber-400">⚠️ {publishResult.failed_ads} campanha(s) falharam</p>
                    )}
                    {publishResult.campaign_results?.filter((r: any) => r.success).map((r: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">{r.name}</span> — ID: {r.meta_campaign_id}
                        {r.ads_manager_url && (
                          <a href={r.ads_manager_url} target="_blank" rel="noopener noreferrer" className="text-primary ml-2 hover:underline">
                            Abrir <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        )}
                      </div>
                    ))}
                    {!publishResult.campaign_results && publishResult.ads_manager_url && (
                      <a href={publishResult.ads_manager_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline">
                        Abrir no Gerenciador de Anúncios <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {publishResult && !publishResult.success && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3">
                    <p className="text-destructive font-semibold flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> {publishResult.error_user_title || "Erro na publicação"}
                    </p>
                    {publishResult.error_user_msg && (
                      <p className="text-sm text-muted-foreground">{publishResult.error_user_msg}</p>
                    )}
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{publishResult.error}</p>
                    {publishResult.step && (
                      <p className="text-xs text-amber-400">Etapa com falha: {publishResult.step === "campaign" ? "Campanha" : publishResult.step === "adset" ? "Conjunto de Anúncios" : publishResult.step === "ad" ? "Anúncio" : publishResult.step === "media_upload" ? "Upload de Mídia" : publishResult.step === "ad_validation" ? "Validação do Anúncio" : publishResult.step}</p>
                    )}
                    {publishResult.rollback && (
                      <p className="text-xs text-muted-foreground">🧹 Campanha parcial apagada automaticamente para manter o gerenciador limpo.</p>
                    )}
                    {publishResult.fbtrace_id && (
                      <p className="text-xs text-muted-foreground/60 font-mono">fbtrace_id: {publishResult.fbtrace_id}</p>
                    )}
                  </div>
                )}

                {/* Publish step log */}
                {publishLogs.length > 0 && (
                  <div className="border border-border rounded-lg p-3 space-y-1 bg-secondary/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Log de Publicação</p>
                    {publishLogs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground/60 font-mono w-16 shrink-0">{log.time}</span>
                        {log.status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                        {log.status === "pending" && <Loader2 className="w-3 h-3 text-muted-foreground animate-spin shrink-0" />}
                        {log.status === "error" && <XCircle className="w-3 h-3 text-destructive shrink-0" />}
                        <span className={log.status === "error" ? "text-destructive" : "text-muted-foreground"}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {!publishResult && (
              <div className="flex gap-3">
                <Button onClick={() => setConfirmPublishOpen(true)} disabled={isPublishing || !activeProfile || !activeProfile?.page_id || activeProfile?.page_id?.trim() === ""} className="gap-2 font-bold">
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Aprovar Execução
                </Button>
                <Button variant="outline" onClick={handleSaveDraft}>Salvar como Rascunho</Button>
                <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              </div>
            )}

            {/* Confirmation Modal */}
            <AlertDialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-primary" />
                    🚀 Resumo da Execução
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 text-left">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Cliente</p>
                        <p className="font-semibold text-foreground">{activeProfile?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Conta Meta</p>
                        <p className="font-semibold text-foreground font-mono">{activeProfile?.ad_account_id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Orçamento Diário</p>
                        <p className="font-semibold text-foreground">R$ {dailyBudget.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Objetivo</p>
                        <p className="font-semibold text-foreground">{objectiveLabels[objective]}</p>
                      </div>
                      {campaignCount > 1 && (
                        <div>
                          <p className="text-muted-foreground text-xs">Campanhas</p>
                          <p className="font-semibold text-foreground">{campaignCount} independentes</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs">Criativos</p>
                        <p className="font-semibold text-foreground">{selectedAssetUrls.length || "Nenhum"} ativo(s)</p>
                      </div>
                    </div>
                    {draft && (
                      <div className="border-t border-border pt-3">
                        <p className="text-muted-foreground text-xs mb-1">Copy Selecionada</p>
                        <p className="text-sm font-semibold text-foreground">{draft.copy_options[selectedCopyIdx]?.headline}</p>
                      </div>
                    )}
                    {selectedAssetUrls.length > 0 && campaignCount > 0 && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total de anúncios a criar</p>
                        <p className="text-xl font-bold text-primary">{selectedAssetUrls.length * campaignCount}</p>
                        <p className="text-xs text-muted-foreground">{campaignCount} campanha(s) × {selectedAssetUrls.length} criativo(s)</p>
                      </div>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setConfirmPublishOpen(false); handlePublish(); }} className="gap-2 bg-success hover:bg-success/90 text-white font-bold">
                    <Rocket className="w-4 h-4" />
                    Confirmar e Subir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {publishResult && (
              <Button onClick={resetWizard} variant="outline">Criar Nova Campanha</Button>
            )}
          </div>
        )}

        {/* Draft History */}
        {drafts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Objetivo</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((d) => {
                    const sc = statusConfig[d.status] || statusConfig.draft;
                    const Icon = sc.icon;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{d.campaign_name}</TableCell>
                        <TableCell className="text-sm">{objectiveLabels[d.objective] || d.objective}</TableCell>
                        <TableCell className="text-sm">R$ {Number(d.daily_budget).toLocaleString("pt-BR")}/dia</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${sc.className}`}>
                            <Icon className="w-3 h-3" /> {sc.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {d.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                                onClick={() => setDeleteTarget(d)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            {d.status === "published" && d.meta_campaign_id && d.meta_adset_id && d.meta_ad_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                                onClick={() => setScaleTarget(d)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Delete Confirmation Modal */}
              <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-destructive" />
                      🗑️ Limpar Rastro no Meta Ads?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-left space-y-2">
                      <p>Isso vai deletar a campanha base permanentemente do seu gerenciador do Facebook e remover este registro do painel.</p>
                      {deleteTarget?.meta_campaign_id && (
                        <p className="font-mono text-xs text-muted-foreground">ID: {deleteTarget.meta_campaign_id}</p>
                      )}
                      <p className="font-medium">{deleteTarget?.campaign_name}</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteTarget && handleDeleteDraft(deleteTarget)}
                      disabled={isDeleting}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Apagar Definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Clone & Scale Modal */}
              <AlertDialog open={!!scaleTarget} onOpenChange={(open) => !open && setScaleTarget(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-primary" />
                      🚀 Escalar Campanha Vencedora
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-left space-y-3">
                      <p><strong>Campanha Original:</strong> {scaleTarget?.campaign_name}</p>
                      <p><strong>Orçamento Atual:</strong> R$ {Number(scaleTarget?.daily_budget || 0).toLocaleString("pt-BR")}/dia</p>
                      <p>A IA aplicará a regra de escala segura (+20% de orçamento) para não resetar o algoritmo da Meta.</p>
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Novo Orçamento Projetado</p>
                        <p className="text-xl font-bold text-primary">
                          R$ {(Number(scaleTarget?.daily_budget || 0) * 1.20).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/dia
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isScaling}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => scaleTarget && handleCloneScale(scaleTarget)}
                      disabled={isScaling}
                      className="gap-2"
                    >
                      {isScaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                      Clonar e Injetar Verba
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
