import { useState, useEffect, useCallback, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Shield, Save, Loader2, CheckCircle, KeyRound, Globe, Brain, X, ExternalLink, Trash2, Upload, FileText, Target } from "lucide-react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";

const configSchema = z.object({
  name: z.string().min(1, "Nome do cliente é obrigatório"),
  adAccountId: z.string().min(1, "ID da conta é obrigatória").regex(/^act_/, "Deve começar com act_"),
  pixelId: z.string().optional(),
  cpaMeta: z.number().min(0.01, "CPA Meta deve ser maior que 0"),
  ticketMedio: z.number().min(0.01, "Ticket Médio deve ser maior que 0"),
  limiteEscala: z.number().min(1).max(100, "Limite deve ser entre 1% e 100%"),
  budgetMaximo: z.number().min(0, "Budget Máximo deve ser >= 0"),
  budgetFrequency: z.enum(["daily", "weekly", "monthly"]),
});

function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 10) return "••••••";
  return "••••••" + token.slice(-6);
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.csv";
const ACCEPTED_MIME = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/csv"];

export default function Configuracoes() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile, updateProfile, deleteProfile, profiles, isLoading: profilesLoading, productContext, productUrls, geminiApiKey } = useClientProfiles();

  // --- Existing form state ---
  const [form, setForm] = useState({
    name: "", adAccountId: "act_", pixelId: "", pageId: "",
    cpaMeta: "45", ticketMedio: "697", limiteEscala: "15",
    budgetMaximo: "0", budgetFrequency: "monthly" as "daily" | "weekly" | "monthly",
    metaAccessToken: "", geminiApiKey: "", apiBaseUrl: "",
  });
  const [tokenEditing, setTokenEditing] = useState(false);
  const [geminiEditing, setGeminiEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tokenPermissions, setTokenPermissions] = useState<string[] | null>(null);

  // Product context state
  const [productUrl, setProductUrl] = useState("");
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [absorbResult, setAbsorbResult] = useState<any>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Cérebro da Empresa state ---
  const [brainFields, setBrainFields] = useState({ what_we_sell: "", our_story: "", main_trigger: "" });
  const [brainSaving, setBrainSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dossier state
  const [dossier, setDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierSaving, setDossierSaving] = useState(false);

  // Catalog state
  const [catalogId, setCatalogId] = useState("");
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [availableCatalogs, setAvailableCatalogs] = useState<any[]>([]);

  // Fetch knowledge_base entries
  const { data: kbEntries = [], refetch: refetchKb } = useQuery({
    queryKey: ["knowledge_base", activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile?.id,
  });

  // Load brain fields from KB
  useEffect(() => {
    const textEntries = kbEntries.filter((e: any) => e.doc_type === "text_field");
    const newFields = { what_we_sell: "", our_story: "", main_trigger: "" };
    for (const entry of textEntries) {
      if (entry.field_key && entry.field_key in newFields) {
        (newFields as any)[entry.field_key] = entry.extracted_text || "";
      }
    }
    setBrainFields(newFields);
  }, [kbEntries]);

  // Load existing dossier
  useEffect(() => {
    if (activeProfile && (activeProfile as any).avatar_dossier) {
      try {
        setDossier(JSON.parse((activeProfile as any).avatar_dossier));
      } catch {
        setDossier(null);
      }
    } else {
      setDossier(null);
    }
  }, [activeProfile?.id]);

  useEffect(() => {
    if (activeProfile) {
      setForm({
        name: activeProfile.name || "",
        adAccountId: activeProfile.ad_account_id || "act_",
        pixelId: activeProfile.pixel_id || "",
        pageId: (activeProfile as any).page_id || "",
        cpaMeta: String(activeProfile.cpa_meta ?? 45),
        ticketMedio: String(activeProfile.ticket_medio ?? 697),
        limiteEscala: String(activeProfile.limite_escala ?? 15),
        budgetMaximo: String(activeProfile.budget_maximo ?? 0),
        budgetFrequency: (activeProfile.budget_frequency ?? "monthly") as "daily" | "weekly" | "monthly",
        metaAccessToken: "", geminiApiKey: "",
        apiBaseUrl: (activeProfile as any).api_base_url || "",
      });
      setTokenEditing(false);
      setGeminiEditing(false);
      setAbsorbResult(null);
      setShowManualInput(false);
      setManualText("");
      setCatalogId((activeProfile as any).catalog_id || "");
    }
  }, [activeProfile?.id]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = async () => {
    if (!activeProfile) { toast({ title: "Erro", description: "Crie um perfil primeiro.", variant: "destructive" }); return; }
    const parsed = configSchema.safeParse({
      ...form, cpaMeta: Number(form.cpaMeta), ticketMedio: Number(form.ticketMedio),
      limiteEscala: Number(form.limiteEscala), budgetMaximo: Number(form.budgetMaximo), budgetFrequency: form.budgetFrequency,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((e: any) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors); return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        id: activeProfile.id, name: parsed.data.name, ad_account_id: parsed.data.adAccountId,
        pixel_id: parsed.data.pixelId || "", page_id: form.pageId || null, cpa_meta: parsed.data.cpaMeta, ticket_medio: parsed.data.ticketMedio,
        limite_escala: parsed.data.limiteEscala, budget_maximo: parsed.data.budgetMaximo, budget_frequency: parsed.data.budgetFrequency,
        api_base_url: form.apiBaseUrl.trim() || null,
        catalog_id: catalogId.trim() || null,
      };
      if (tokenEditing && form.metaAccessToken) updateData.meta_access_token = form.metaAccessToken;
      else if (tokenEditing && !form.metaAccessToken) updateData.meta_access_token = null;
      if (geminiEditing && form.geminiApiKey) updateData.gemini_api_key = form.geminiApiKey;
      else if (geminiEditing && !form.geminiApiKey) updateData.gemini_api_key = null;
      await updateProfile(updateData as any);
      toast({ title: "✅ Configurações salvas", description: "Parâmetros atualizados com sucesso." });
      setTokenEditing(false); setGeminiEditing(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleFetchCatalogs = async () => {
    if (!activeProfile?.id) return;
    setCatalogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-catalogs", {
        body: { profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvailableCatalogs(data.catalogs || []);
      if (data.catalogs?.length === 0) {
        toast({ title: "Nenhum catálogo encontrado", description: "Nenhum catálogo de produtos foi encontrado nesta conta." });
      } else {
        toast({ title: `${data.catalogs.length} catálogo(s) encontrado(s)`, description: "Selecione um para vincular." });
      }
    } catch (err) {
      toast({ title: "Erro ao buscar catálogos", description: (err as Error).message, variant: "destructive" });
    } finally {
      setCatalogsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.adAccountId || form.adAccountId === "act_") { toast({ title: "Erro", description: "Preencha o Ad Account ID.", variant: "destructive" }); return; }
    setTestResult("loading");
    try {
      const body: Record<string, unknown> = { adAccountId: form.adAccountId, testConnection: true };
      const tokenToTest = tokenEditing ? form.metaAccessToken : activeProfile?.meta_access_token;
      if (tokenToTest) body.accessToken = tokenToTest;
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult("success");
      setTokenPermissions(data.permissions || []);
      const hasAdsMgmt = (data.permissions || []).includes("ads_management");
      const permMsg = !hasAdsMgmt ? " ⚠️ Sem permissão ads_management (publicação bloqueada)." : "";
      toast({ title: "✅ Conexão OK", description: `${data.total} campanhas encontradas.${permMsg}` });
    } catch (err) {
      setTestResult("error"); setTokenPermissions(null);
      toast({ title: "❌ Falha na conexão", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleAbsorbContext = async () => {
    if (!productUrl || !activeProfile) return;
    try { new URL(productUrl); } catch { toast({ title: "URL inválida", description: "Insira uma URL válida.", variant: "destructive" }); return; }
    setIsAbsorbing(true); setAbsorbResult(null); setShowManualInput(false);
    try {
      const { data, error } = await supabase.functions.invoke("absorb-product-context", { body: { url: productUrl, profileId: activeProfile.id } });
      if (error) throw error;
      if (data?.scrape_failed) { setShowManualInput(true); toast({ title: "⚠️ Scraping falhou", description: data.error || "Use a inserção manual abaixo.", variant: "destructive" }); return; }
      if (data?.error) throw new Error(data.error);
      setAbsorbResult(data); setProductUrl("");
      toast({ title: "✅ Contexto absorvido!", description: "A IA analisou o conteúdo com sucesso." });
    } catch (err) {
      setShowManualInput(true);
      toast({ title: "Erro ao absorver contexto", description: (err as Error).message + ". Use a inserção manual.", variant: "destructive" });
    } finally { setIsAbsorbing(false); }
  };

  const handleManualAbsorb = async () => {
    if (!manualText.trim() || !activeProfile) return;
    setIsAbsorbing(true); setAbsorbResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("absorb-product-context", { body: { manualText: manualText.trim(), profileId: activeProfile.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAbsorbResult(data); setManualText(""); setShowManualInput(false);
      toast({ title: "✅ Contexto absorvido!", description: "A IA processou o texto colado." });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally { setIsAbsorbing(false); }
  };

  const handleRemoveUrl = async (urlToRemove: string) => {
    if (!activeProfile) return;
    const updatedUrls = (productUrls || []).filter((u) => u !== urlToRemove);
    try {
      await updateProfile({ id: activeProfile.id, product_urls: updatedUrls } as any);
      toast({ title: "URL removida" });
    } catch (err) { toast({ title: "Erro", description: (err as Error).message, variant: "destructive" }); }
  };

  const handleDeleteProfile = async () => {
    if (!activeProfile) return;
    setIsDeleting(true);
    try {
      await deleteProfile(activeProfile.id);
      toast({ title: "Perfil excluído", description: `"${activeProfile.name}" foi removido permanentemente.` });
      navigate("/");
    } catch (err) { toast({ title: "Erro ao excluir", description: (err as Error).message, variant: "destructive" }); }
    finally { setIsDeleting(false); }
  };

  // --- Cérebro da Empresa handlers ---
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !activeProfile || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!ACCEPTED_MIME.includes(file.type) && !file.name.match(/\.(pdf|docx|txt|csv)$/i)) {
          toast({ title: "Tipo não suportado", description: `${file.name} — aceitos: PDF, DOCX, TXT, CSV`, variant: "destructive" });
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast({ title: "Arquivo muito grande", description: `${file.name} excede 20MB`, variant: "destructive" });
          continue;
        }
        const path = `${user.id}/${activeProfile.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("knowledge-docs").upload(path, file);
        if (uploadError) throw uploadError;

        // Extract text for txt/csv immediately, mark pdf/docx as pending
        let extractedText: string | null = null;
        let status = "pending";
        if (file.type === "text/plain" || file.type === "text/csv" || file.name.match(/\.(txt|csv)$/i)) {
          extractedText = await file.text();
          status = "processed";
        }

        const { error: insertError } = await supabase.from("knowledge_base").insert({
          profile_id: activeProfile.id,
          user_id: user.id,
          doc_type: "file",
          file_name: file.name,
          file_url: path,
          extracted_text: extractedText,
          status,
        } as any);
        if (insertError) throw insertError;
      }
      refetchKb();
      toast({ title: "✅ Upload concluído" });
    } catch (err) {
      toast({ title: "Erro no upload", description: (err as Error).message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [activeProfile, user]);

  const handleSaveBrainFields = async () => {
    if (!activeProfile || !user) return;
    setBrainSaving(true);
    try {
      for (const [key, value] of Object.entries(brainFields)) {
        const existing = kbEntries.find((e: any) => e.doc_type === "text_field" && e.field_key === key);
        if (existing) {
          await supabase.from("knowledge_base").update({ extracted_text: value, status: "processed" } as any).eq("id", existing.id);
        } else if (value.trim()) {
          await supabase.from("knowledge_base").insert({
            profile_id: activeProfile.id, user_id: user.id,
            doc_type: "text_field", field_key: key,
            extracted_text: value, status: "processed",
          } as any);
        }
      }
      refetchKb();
      toast({ title: "✅ Base de conhecimento salva" });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally { setBrainSaving(false); }
  };

  const handleDeleteKbEntry = async (id: string) => {
    try {
      await supabase.from("knowledge_base").delete().eq("id", id);
      refetchKb();
      toast({ title: "Documento removido" });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleGenerateDossier = async () => {
    if (!activeProfile) return;
    setDossierLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("digest-company-context", {
        body: { profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDossier(data);
      toast({ title: "🎯 Dossiê gerado!", description: "Revise e salve como Verdade Absoluta." });
    } catch (err) {
      toast({ title: "Erro ao gerar dossiê", description: (err as Error).message, variant: "destructive" });
    } finally { setDossierLoading(false); }
  };

  const handleSaveDossier = async () => {
    if (!activeProfile || !dossier) return;
    setDossierSaving(true);
    try {
      await updateProfile({ id: activeProfile.id, avatar_dossier: JSON.stringify(dossier) } as any);
      toast({ title: "✅ Dossiê salvo como Verdade Absoluta", description: "A IA usará este dossiê em todas as campanhas." });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally { setDossierSaving(false); }
  };

  if (profilesLoading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!activeProfile) return <AppLayout><div className="space-y-4 text-center py-20"><h2 className="text-xl font-bold">Nenhum perfil encontrado</h2><p className="text-muted-foreground text-sm">Use o seletor no sidebar para criar seu primeiro perfil.</p></div></AppLayout>;

  const hasProfileToken = !!activeProfile.meta_access_token;
  const hasGeminiKey = !!activeProfile.gemini_api_key;
  const fileEntries = kbEntries.filter((e: any) => e.doc_type === "file");
  const hasDossierSaved = !!(activeProfile as any).avatar_dossier;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Configurações — {activeProfile.name}</h2>
            <p className="text-muted-foreground text-sm mt-1">Configure a conexão com a Meta Ads e as regras de automação.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">IA Ativa</span>
            </div>
          </div>
        </div>

        {/* Profile Name */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Perfil do Cliente</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label htmlFor="name">Nome do Cliente</Label>
              <Input id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Ex: Método RIC" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Meta Ads Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5 text-primary" />Credenciais Meta Ads</CardTitle>
            <CardDescription>Token global ou individual por perfil para suportar múltiplas contas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${hasProfileToken ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
              {hasProfileToken ? (
                <><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /><span className="text-sm text-emerald-400">Token individual configurado ({maskToken(activeProfile.meta_access_token)})</span></>
              ) : (
                <><KeyRound className="w-4 h-4 text-amber-400 shrink-0" /><span className="text-sm text-amber-400">Usando token global do Cloud.</span></>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaAccessToken">Access Token (opcional)</Label>
              {!tokenEditing ? (
                <div className="flex items-center gap-2">
                  <Input value={hasProfileToken ? maskToken(activeProfile.meta_access_token) : ""} placeholder="Usando token global" disabled className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => setTokenEditing(true)}>{hasProfileToken ? "Alterar" : "Adicionar"}</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input type="password" value={form.metaAccessToken} onChange={(e) => handleChange("metaAccessToken", e.target.value)} placeholder="Cole aqui o Access Token" className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Deixe vazio e salve para usar o token global.</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adAccountId">Ad Account ID</Label>
                <Input id="adAccountId" placeholder="act_123456789" value={form.adAccountId} onChange={(e) => handleChange("adAccountId", e.target.value)} className="font-mono text-sm" />
                {errors.adAccountId && <p className="text-xs text-destructive">{errors.adAccountId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixelId">Pixel ID (opcional)</Label>
                <Input id="pixelId" placeholder="123456789012345" value={form.pixelId} onChange={(e) => handleChange("pixelId", e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2 max-w-md">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageId">Facebook Page ID</Label>
                <span className="relative group">
                  <span className="text-muted-foreground cursor-help text-xs border border-border rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-md w-64 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Obrigatório para vincular anúncios ao Instagram e Página do Facebook.
                  </span>
                </span>
              </div>
              <Input id="pageId" placeholder="123456789012345" value={form.pageId} onChange={(e) => handleChange("pageId", e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={testResult === "loading"} className="gap-2">
                {testResult === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Testar Conexão
              </Button>
              {testResult === "success" && <span className="text-sm text-emerald-400">✓ Conectado</span>}
              {testResult === "error" && <span className="text-sm text-destructive">✗ Falha</span>}
            </div>
            {tokenPermissions !== null && testResult === "success" && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {["ads_read", "ads_management"].map((perm) => {
                  const granted = tokenPermissions.includes(perm);
                  return (
                    <span key={perm} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${granted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
                      {granted ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}{perm}
                    </span>
                  );
                })}
                {!tokenPermissions.includes("ads_management") && (
                  <span className="text-xs text-amber-400 ml-1">⚠️ Sem ads_management — publicação bloqueada.</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Externa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Globe className="w-5 h-5 text-primary" />API Externa (Meta Ads Wrapper)</CardTitle>
            <CardDescription>URL do servidor permanente para gestão avançada de campanhas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiBaseUrl">URL da API</Label>
              <Input
                id="apiBaseUrl"
                placeholder="https://seu-servidor.com"
                value={form.apiBaseUrl}
                onChange={(e) => handleChange("apiBaseUrl", e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Endereço do servidor que hospeda a API wrapper do Meta Ads. Salve as configurações para aplicar.</p>
            </div>
            {form.apiBaseUrl && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${form.apiBaseUrl ? "bg-emerald-500/10 border-emerald-500/20" : "bg-secondary border-border"}`}>
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-400">API configurada: {form.apiBaseUrl}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Catálogo de Produtos Meta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              Catálogo de Produtos (Meta)
            </CardTitle>
            <CardDescription>Vincule um catálogo de produtos para campanhas DPA (Advantage+ Catalog).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalogId">Catalog ID</Label>
              <div className="flex gap-2">
                <Input
                  id="catalogId"
                  placeholder="Ex: 123456789"
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                  className="font-mono text-sm flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchCatalogs}
                  disabled={catalogsLoading}
                  className="gap-2"
                >
                  {catalogsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  Buscar Catálogos
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ID do catálogo no Facebook Commerce Manager. Clique em "Buscar Catálogos" para listar os disponíveis.
              </p>
            </div>
            {availableCatalogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Catálogos Encontrados</p>
                <div className="space-y-1">
                  {availableCatalogs.map((cat: any) => (
                    <div
                      key={cat.id}
                      onClick={() => setCatalogId(cat.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all text-sm ${catalogId === cat.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                    >
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{cat.product_count || 0} produtos · {cat.vertical || "commerce"}</p>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{cat.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {catalogId && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
                <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-400 font-medium">Catálogo vinculado: {catalogId}</span>
              </div>
            )}
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className={`w-5 h-5 ${hasGeminiKey ? "text-emerald-400" : "text-muted-foreground"}`} />🧠 Inteligência Artificial (Gemini)</CardTitle>
            <CardDescription>Opcional — o sistema já funciona com a IA integrada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${hasGeminiKey ? "bg-emerald-500/10 border-emerald-500/20" : "bg-secondary border-border"}`}>
              {hasGeminiKey ? (
                <><Brain className="w-4 h-4 text-emerald-400 shrink-0" /><span className="text-sm text-emerald-400 font-semibold">IA Conectada ({maskToken(activeProfile.gemini_api_key)})</span></>
              ) : (
                <><Brain className="w-4 h-4 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground">Usando IA integrada do sistema.</span></>
              )}
            </div>
            <div className="space-y-2">
              <Label>Gemini API Key (opcional)</Label>
              {!geminiEditing ? (
                <div className="flex items-center gap-2">
                  <Input value={hasGeminiKey ? maskToken(activeProfile.gemini_api_key) : ""} placeholder="Não configurada" disabled className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => setGeminiEditing(true)}>{hasGeminiKey ? "Alterar" : "Adicionar"}</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input type="password" value={form.geminiApiKey} onChange={(e) => handleChange("geminiApiKey", e.target.value)} placeholder="Cole aqui sua API Key" className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Obtenha em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aistudio.google.com/apikey</a></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Context */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className="w-5 h-5 text-primary" />Contexto do Produto</CardTitle>
            <CardDescription>URLs ou texto manual para a IA absorver o contexto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1"><Input placeholder="https://seusite.com.br" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} className="font-mono text-sm" /></div>
              <Button onClick={handleAbsorbContext} disabled={isAbsorbing || !productUrl} className="gap-2">
                {isAbsorbing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}{isAbsorbing ? "Absorvendo..." : "Absorver Contexto"}
              </Button>
            </div>
            {!showManualInput && <button onClick={() => setShowManualInput(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">Ou cole o texto manualmente →</button>}
            {showManualInput && (
              <div className="space-y-2 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <p className="text-xs text-amber-400 font-medium">📋 Inserção Manual</p>
                <Textarea value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Cole aqui todo o conteúdo textual..." rows={6} className="text-sm" />
                <div className="flex gap-2">
                  <Button onClick={handleManualAbsorb} disabled={isAbsorbing || !manualText.trim()} size="sm" className="gap-2">{isAbsorbing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Processar Texto</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowManualInput(false); setManualText(""); }}>Cancelar</Button>
                </div>
              </div>
            )}
            {productUrls && productUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">URLs absorvidas ({productUrls.length})</p>
                <div className="flex flex-wrap gap-2">
                  {productUrls.map((u) => (
                    <span key={u} className="inline-flex items-center gap-1.5 text-xs bg-secondary px-3 py-1.5 rounded-full">
                      <ExternalLink className="w-3 h-3 text-muted-foreground" /><span className="max-w-[200px] truncate">{u}</span>
                      <button onClick={() => handleRemoveUrl(u)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {absorbResult && !absorbResult.error && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />O que a IA entendeu:</p>
                <div className="grid gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground font-medium uppercase">Promessa Principal</p><p>{absorbResult.main_promise}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium uppercase">Dores do Avatar</p><ul className="list-disc list-inside text-muted-foreground">{absorbResult.avatar_pains?.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                  <div><p className="text-xs text-muted-foreground font-medium uppercase">Objeções</p><ul className="list-disc list-inside text-muted-foreground">{absorbResult.objections?.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul></div>
                </div>
              </div>
            )}
            {productContext && !absorbResult && (
              <div className="bg-secondary/50 border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Contexto atual</p>
                <div className="prose prose-sm max-w-none text-sm"><ReactMarkdown>{productContext}</ReactMarkdown></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============ 🧠 CÉREBRO DA EMPRESA ============ */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">🧠 Cérebro da Empresa (Base de Conhecimento)</CardTitle>
            <CardDescription>Alimente a IA com documentos e informações estratégicas do perfil "{activeProfile.name}". Tudo é isolado por perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag & Drop Upload */}
            <div>
              <Label className="mb-2 block">Upload de Documentos</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Enviando...</span></div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, CSV — Máx 20MB</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
            </div>

            {/* Uploaded Files List */}
            {fileEntries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Documentos absorvidos ({fileEntries.length})</p>
                <div className="space-y-1.5">
                  {fileEntries.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{entry.file_name}</span>
                        {entry.status === "processed" ? (
                          <span className="text-xs text-emerald-400 font-semibold">Absorvido ✅</span>
                        ) : entry.status === "error" ? (
                          <span className="text-xs text-destructive font-semibold">Erro ❌</span>
                        ) : (
                          <span className="text-xs text-amber-400 font-semibold">Processando...</span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteKbEntry(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Text Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>O que vendemos? (Produto ou Serviço)</Label>
                <Textarea value={brainFields.what_we_sell} onChange={(e) => setBrainFields(prev => ({ ...prev, what_we_sell: e.target.value }))} placeholder="Descreva seu produto ou serviço principal..." rows={3} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Qual a nossa História/Narrativa?</Label>
                <Textarea value={brainFields.our_story} onChange={(e) => setBrainFields(prev => ({ ...prev, our_story: e.target.value }))} placeholder="Conte a história da marca, do fundador ou do produto..." rows={3} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Qual o nosso Diferencial/Gatilho Principal?</Label>
                <Textarea value={brainFields.main_trigger} onChange={(e) => setBrainFields(prev => ({ ...prev, main_trigger: e.target.value }))} placeholder="O que diferencia seu produto da concorrência?" rows={3} className="text-sm" />
              </div>
              <Button onClick={handleSaveBrainFields} disabled={brainSaving} variant="outline" className="gap-2">
                {brainSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar Textos
              </Button>
            </div>

            <Separator />

            {/* Generate Dossier Button */}
            <div className="flex items-center gap-3">
              <Button onClick={handleGenerateDossier} disabled={dossierLoading} className="gap-2">
                {dossierLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                🧠 Gerar Dossiê do Avatar
              </Button>
              <span className="text-xs text-muted-foreground">A IA analisa todos os documentos e textos deste perfil</span>
            </div>

            {/* Dossier Card */}
            {dossier && (
              <div className="bg-primary/5 border border-primary/30 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">🎯 Dossiê do Avatar (Gerado por IA)</h4>
                  {hasDossierSaved && <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded">Salvo ✅</span>}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">🩸 Dor Sangrenta</Label>
                    <Textarea value={dossier.bleeding_pain || ""} onChange={(e) => setDossier((d: any) => ({ ...d, bleeding_pain: e.target.value }))} rows={2} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">🌟 Desejo Final</Label>
                    <Textarea value={dossier.dream_outcome || ""} onChange={(e) => setDossier((d: any) => ({ ...d, dream_outcome: e.target.value }))} rows={2} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">⚙️ Mecanismo Único</Label>
                    <Textarea value={dossier.unique_mechanism || ""} onChange={(e) => setDossier((d: any) => ({ ...d, unique_mechanism: e.target.value }))} rows={2} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">🚧 Objeções Principais</Label>
                    {(dossier.main_objections || []).map((obj: string, i: number) => (
                      <Input key={i} value={obj} onChange={(e) => {
                        const updated = [...(dossier.main_objections || [])];
                        updated[i] = e.target.value;
                        setDossier((d: any) => ({ ...d, main_objections: updated }));
                      }} className="text-sm mb-1" />
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">🎙️ Tom de Voz</Label>
                    <Input value={dossier.brand_voice || ""} onChange={(e) => setDossier((d: any) => ({ ...d, brand_voice: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">📋 Resumo Executivo</Label>
                    <Textarea value={dossier.executive_summary || ""} onChange={(e) => setDossier((d: any) => ({ ...d, executive_summary: e.target.value }))} rows={3} className="text-sm" />
                  </div>
                </div>

                <Button onClick={handleSaveDossier} disabled={dossierSaving} className="gap-2 w-full">
                  {dossierSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  ✅ Salvar como Verdade Absoluta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Automation Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de Automação</CardTitle>
            <CardDescription>Defina os limites para pausa inteligente, escala automática e alertas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="cpaMeta">CPA Meta (R$)</Label>
                <Input id="cpaMeta" type="number" min="0.01" step="0.01" value={form.cpaMeta} onChange={(e) => handleChange("cpaMeta", e.target.value)} />
                {errors.cpaMeta && <p className="text-xs text-destructive">{errors.cpaMeta}</p>}
                <p className="text-xs text-muted-foreground">Pausa se CPA &gt; 2× sem vendas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketMedio">Ticket Médio (R$)</Label>
                <Input id="ticketMedio" type="number" min="0.01" step="0.01" value={form.ticketMedio} onChange={(e) => handleChange("ticketMedio", e.target.value)} />
                {errors.ticketMedio && <p className="text-xs text-destructive">{errors.ticketMedio}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="limiteEscala">Limite de Escala (%)</Label>
                <Input id="limiteEscala" type="number" min="1" max="100" value={form.limiteEscala} onChange={(e) => handleChange("limiteEscala", e.target.value)} />
                {errors.limiteEscala && <p className="text-xs text-destructive">{errors.limiteEscala}</p>}
              </div>
            </div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Controle de Teto Financeiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="budgetMaximo">Valor do Limite (R$)</Label>
                <Input id="budgetMaximo" type="number" min="0" step="1" value={form.budgetMaximo} onChange={(e) => handleChange("budgetMaximo", e.target.value)} />
                {errors.budgetMaximo && <p className="text-xs text-destructive">{errors.budgetMaximo}</p>}
                <p className="text-xs text-muted-foreground">0 = sem limite</p>
              </div>
              <div className="space-y-2">
                <Label>Frequência do Limite</Label>
                <Select value={form.budgetFrequency} onValueChange={(v) => setForm(prev => ({ ...prev, budgetFrequency: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator className="my-4" />
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Guardião Autônomo & Auto-Scale</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CPA Máximo Tolerável (R$)</Label>
                <Input type="number" min="0" step="1" value={(activeProfile as any)?.cpa_max_toleravel ?? 0} onChange={async (e) => { if (!activeProfile) return; await updateProfile({ id: activeProfile.id, cpa_max_toleravel: Number(e.target.value) } as any); }} />
                <p className="text-xs text-muted-foreground">0 = desativado</p>
              </div>
              <div className="space-y-2">
                <Label>ROAS Mínimo para Escala</Label>
                <Input type="number" min="0" step="0.1" value={(activeProfile as any)?.roas_min_escala ?? 0} onChange={async (e) => { if (!activeProfile) return; await updateProfile({ id: activeProfile.id, roas_min_escala: Number(e.target.value) } as any); }} />
                <p className="text-xs text-muted-foreground">0 = desativado</p>
              </div>
              <div className="space-y-2">
                <Label>Teto Máximo Diário (R$)</Label>
                <Input type="number" min="0" step="1" value={(activeProfile as any)?.teto_diario_escala ?? 0} onChange={async (e) => { if (!activeProfile) return; await updateProfile({ id: activeProfile.id, teto_diario_escala: Number(e.target.value) } as any); }} />
              </div>
            </div>
            <Separator className="my-4" />
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Regra de Rollback de Escala</h4>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border mb-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">🔄 Rollback Automático de Escala</Label>
                <p className="text-xs text-muted-foreground">Se o ROAS atingir o limiar configurado, mas não houver vendas no DIA, reverte o orçamento ao valor anterior para estabilizar.</p>
              </div>
              <Switch
                checked={(activeProfile as any)?.rollback_enabled ?? true}
                onCheckedChange={async (checked) => {
                  if (!activeProfile) return;
                  await updateProfile({ id: activeProfile.id, rollback_enabled: checked } as any);
                }}
              />
            </div>
            {(activeProfile as any)?.rollback_enabled !== false && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pl-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label>ROAS Limiar para Rollback (x)</Label>
                  <Input type="number" min="1" step="0.5" value={(activeProfile as any)?.rollback_roas_threshold ?? 10} onChange={async (e) => { if (!activeProfile) return; await updateProfile({ id: activeProfile.id, rollback_roas_threshold: Number(e.target.value) } as any); }} />
                  <p className="text-xs text-muted-foreground">Se ROAS ≥ este valor e 0 vendas no dia → rollback. Padrão: 10x</p>
                </div>
                <div className="space-y-2 flex flex-col justify-center">
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">📋 Condições para Rollback:</p>
                    <p>• Campanha foi escalada</p>
                    <p>• ROAS do dia ≥ {(activeProfile as any)?.rollback_roas_threshold ?? 10}x</p>
                    <p>• 0 vendas no dia atual</p>
                    <p>• Aumento do investimento &gt; aumento do ROAS</p>
                    <p className="text-primary font-medium mt-1">⚡ Ação: Reverte ao orçamento anterior</p>
                  </div>
                </div>
              </div>
            )}
            <Separator className="my-4" />
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">🚀 Escala Vertical (Duplicação)</Label>
                <p className="text-xs text-muted-foreground">Duplica adsets automaticamente quando o budget atinge ≥80% do teto diário. Independente da escala horizontal.</p>
              </div>
              <Switch
                checked={(activeProfile as any)?.vertical_scale_enabled ?? false}
                onCheckedChange={async (checked) => {
                  if (!activeProfile) return;
                  await updateProfile({ id: activeProfile.id, vertical_scale_enabled: checked } as any);
                }}
              />
            </div>
            {(activeProfile as any)?.last_autonomous_run && (
              <div className="mt-6 flex items-center justify-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-xs text-emerald-400">
                  <span className="font-semibold uppercase mr-2">Status do Gestor IA:</span>
                  Última execução em {new Date((activeProfile as any).last_autonomous_run).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-md">🔒 Dados salvos com segurança no Cloud.</p>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar Configurações
          </Button>
        </div>

        {/* Delete Profile */}
        {profiles.length > 1 && (
          <>
            <Separator />
            <Card className="border-destructive/30">
              <CardHeader><CardTitle className="text-lg text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" />Zona de Perigo</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Excluir permanentemente "{activeProfile.name}" e todos os dados associados.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir Perfil
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir perfil "{activeProfile.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os dados serão excluídos permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir Permanentemente</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
