import { useState, useEffect } from "react";
import { Shield, Save, Loader2, CheckCircle, KeyRound, Globe, Brain, X, ExternalLink, Trash2 } from "lucide-react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
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

export default function Configuracoes() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeProfile, updateProfile, deleteProfile, profiles, isLoading: profilesLoading, productContext, productUrls, geminiApiKey } = useClientProfiles();
  const [form, setForm] = useState({
    name: "", adAccountId: "act_", pixelId: "",
    cpaMeta: "45", ticketMedio: "697", limiteEscala: "15",
    budgetMaximo: "0", budgetFrequency: "monthly" as "daily" | "weekly" | "monthly",
    metaAccessToken: "",
    geminiApiKey: "",
  });
  const [tokenEditing, setTokenEditing] = useState(false);
  const [geminiEditing, setGeminiEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Product context state
  const [productUrl, setProductUrl] = useState("");
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [absorbResult, setAbsorbResult] = useState<any>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (activeProfile) {
      setForm({
        name: activeProfile.name || "",
        adAccountId: activeProfile.ad_account_id || "act_",
        pixelId: activeProfile.pixel_id || "",
        cpaMeta: String(activeProfile.cpa_meta ?? 45),
        ticketMedio: String(activeProfile.ticket_medio ?? 697),
        limiteEscala: String(activeProfile.limite_escala ?? 15),
        budgetMaximo: String(activeProfile.budget_maximo ?? 0),
        budgetFrequency: (activeProfile.budget_frequency ?? "monthly") as "daily" | "weekly" | "monthly",
        metaAccessToken: "",
        geminiApiKey: "",
      });
      setTokenEditing(false);
      setGeminiEditing(false);
      setAbsorbResult(null);
      setShowManualInput(false);
      setManualText("");
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
      parsed.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors); return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        id: activeProfile.id, name: parsed.data.name, ad_account_id: parsed.data.adAccountId,
        pixel_id: parsed.data.pixelId || "", cpa_meta: parsed.data.cpaMeta, ticket_medio: parsed.data.ticketMedio,
        limite_escala: parsed.data.limiteEscala, budget_maximo: parsed.data.budgetMaximo, budget_frequency: parsed.data.budgetFrequency,
      };
      if (tokenEditing && form.metaAccessToken) {
        updateData.meta_access_token = form.metaAccessToken;
      } else if (tokenEditing && !form.metaAccessToken) {
        updateData.meta_access_token = null;
      }
      if (geminiEditing && form.geminiApiKey) {
        updateData.gemini_api_key = form.geminiApiKey;
      } else if (geminiEditing && !form.geminiApiKey) {
        updateData.gemini_api_key = null;
      }
      await updateProfile(updateData as any);
      toast({ title: "✅ Configurações salvas", description: "Parâmetros atualizados com sucesso." });
      setTokenEditing(false);
      setGeminiEditing(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
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
      toast({ title: "✅ Conexão OK", description: `${data.total} campanhas encontradas.` });
    } catch (err) {
      setTestResult("error");
      toast({ title: "❌ Falha na conexão", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleAbsorbContext = async () => {
    if (!productUrl || !activeProfile) return;
    try {
      new URL(productUrl);
    } catch {
      toast({ title: "URL inválida", description: "Insira uma URL válida.", variant: "destructive" });
      return;
    }
    setIsAbsorbing(true);
    setAbsorbResult(null);
    setShowManualInput(false);
    try {
      const { data, error } = await supabase.functions.invoke("absorb-product-context", {
        body: { url: productUrl, profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data?.scrape_failed) {
        setShowManualInput(true);
        toast({ title: "⚠️ Scraping falhou", description: data.error || "Use a inserção manual abaixo.", variant: "destructive" });
        return;
      }
      if (data?.error) throw new Error(data.error);
      setAbsorbResult(data);
      setProductUrl("");
      toast({ title: "✅ Contexto absorvido!", description: "A IA analisou o conteúdo com sucesso." });
    } catch (err) {
      setShowManualInput(true);
      toast({ title: "Erro ao absorver contexto", description: (err as Error).message + ". Use a inserção manual.", variant: "destructive" });
    } finally {
      setIsAbsorbing(false);
    }
  };

  const handleManualAbsorb = async () => {
    if (!manualText.trim() || !activeProfile) return;
    setIsAbsorbing(true);
    setAbsorbResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("absorb-product-context", {
        body: { manualText: manualText.trim(), profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAbsorbResult(data);
      setManualText("");
      setShowManualInput(false);
      toast({ title: "✅ Contexto absorvido!", description: "A IA processou o texto colado." });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsAbsorbing(false);
    }
  };

  const handleRemoveUrl = async (urlToRemove: string) => {
    if (!activeProfile) return;
    const updatedUrls = (productUrls || []).filter((u) => u !== urlToRemove);
    try {
      await updateProfile({ id: activeProfile.id, product_urls: updatedUrls } as any);
      toast({ title: "URL removida" });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteProfile = async () => {
    if (!activeProfile) return;
    setIsDeleting(true);
    try {
      await deleteProfile(activeProfile.id);
      toast({ title: "Perfil excluído", description: `"${activeProfile.name}" foi removido permanentemente.` });
      navigate("/");
    } catch (err) {
      toast({ title: "Erro ao excluir", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (profilesLoading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!activeProfile) return <AppLayout><div className="space-y-4 text-center py-20"><h2 className="text-xl font-bold">Nenhum perfil encontrado</h2><p className="text-muted-foreground text-sm">Use o seletor no sidebar para criar seu primeiro perfil.</p></div></AppLayout>;

  const hasProfileToken = !!activeProfile.meta_access_token;
  const hasGeminiKey = !!activeProfile.gemini_api_key;

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5 text-primary" />Credenciais Meta Ads</CardTitle>
            <CardDescription>Token global ou individual por perfil para suportar múltiplas contas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${hasProfileToken ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
              {hasProfileToken ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-emerald-400">Token individual configurado para este perfil ({maskToken(activeProfile.meta_access_token)})</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-400">Usando token global do Cloud. Adicione um token individual abaixo para esta conta.</span>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="metaAccessToken">Access Token (opcional — individual por perfil)</Label>
              {!tokenEditing ? (
                <div className="flex items-center gap-2">
                  <Input id="metaAccessToken" value={hasProfileToken ? maskToken(activeProfile.meta_access_token) : ""} placeholder="Usando token global" disabled className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => setTokenEditing(true)}>{hasProfileToken ? "Alterar" : "Adicionar"}</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input id="metaAccessToken" type="password" value={form.metaAccessToken} onChange={(e) => handleChange("metaAccessToken", e.target.value)} placeholder="Cole aqui o Access Token da Meta" className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Deixe vazio e salve para usar o token global. O token é salvo criptografado no banco.</p>
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
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={testResult === "loading"} className="gap-2">
                {testResult === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Testar Conexão
              </Button>
              {testResult === "success" && <span className="text-sm text-emerald-400">✓ Conectado</span>}
              {testResult === "error" && <span className="text-sm text-destructive">✗ Falha</span>}
            </div>
          </CardContent>
        </Card>

        {/* Product Context Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className="w-5 h-5 text-primary" />Contexto do Produto</CardTitle>
            <CardDescription>Insira URLs ou cole texto manualmente para a IA absorver o contexto e gerar copies alinhadas. Múltiplos links são consolidados automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="https://seusite.com.br"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleAbsorbContext} disabled={isAbsorbing || !productUrl} className="gap-2">
                {isAbsorbing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {isAbsorbing ? "Absorvendo..." : "Absorver Contexto"}
              </Button>
            </div>

            {/* Manual input toggle */}
            {!showManualInput && (
              <button
                onClick={() => setShowManualInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Ou cole o texto manualmente →
              </button>
            )}

            {/* Manual text fallback */}
            {showManualInput && (
              <div className="space-y-2 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <p className="text-xs text-amber-400 font-medium">📋 Inserção Manual de Contexto</p>
                <p className="text-xs text-muted-foreground">Cole aqui o texto do site, landing page, VSL ou perfil do Instagram que não conseguiu ser acessado automaticamente.</p>
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Cole aqui todo o conteúdo textual do site, incluindo headlines, descrições de produto, depoimentos, etc..."
                  rows={6}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handleManualAbsorb} disabled={isAbsorbing || !manualText.trim()} size="sm" className="gap-2">
                    {isAbsorbing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    Processar Texto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowManualInput(false); setManualText(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Stored URLs */}
            {productUrls && productUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">URLs absorvidas ({productUrls.length})</p>
                <div className="flex flex-wrap gap-2">
                  {productUrls.map((u) => (
                    <span key={u} className="inline-flex items-center gap-1.5 text-xs bg-secondary px-3 py-1.5 rounded-full">
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      <span className="max-w-[200px] truncate">{u}</span>
                      <button onClick={() => handleRemoveUrl(u)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Absorption Result */}
            {absorbResult && !absorbResult.error && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  O que a IA entendeu sobre o produto:
                </p>
                <div className="grid gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Promessa Principal</p>
                    <p>{absorbResult.main_promise}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Dores do Avatar</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {absorbResult.avatar_pains?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Objeções</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {absorbResult.objections?.map((o: string, i: number) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Estrutura da Oferta</p>
                    <p className="text-muted-foreground">{absorbResult.offer_structure}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Tom de Marca</p>
                    <p className="text-muted-foreground">{absorbResult.brand_tone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Existing product context */}
            {productContext && !absorbResult && (
              <div className="bg-secondary/50 border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Contexto atual do produto</p>
                <div className="prose prose-sm prose-invert max-w-none text-sm">
                  <ReactMarkdown>{productContext}</ReactMarkdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

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
                <p className="text-xs text-muted-foreground">Pausa se CPA &gt; 2× este valor sem vendas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketMedio">Ticket Médio (R$)</Label>
                <Input id="ticketMedio" type="number" min="0.01" step="0.01" value={form.ticketMedio} onChange={(e) => handleChange("ticketMedio", e.target.value)} />
                {errors.ticketMedio && <p className="text-xs text-destructive">{errors.ticketMedio}</p>}
                <p className="text-xs text-muted-foreground">Base para cálculo de lucro e simulações</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limiteEscala">Limite de Escala (%)</Label>
                <Input id="limiteEscala" type="number" min="1" max="100" value={form.limiteEscala} onChange={(e) => handleChange("limiteEscala", e.target.value)} />
                {errors.limiteEscala && <p className="text-xs text-destructive">{errors.limiteEscala}</p>}
                <p className="text-xs text-muted-foreground">Incremento de orçamento por ciclo de 24h</p>
              </div>
            </div>

            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Controle de Teto Financeiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgetMaximo">Valor do Limite (R$)</Label>
                <Input id="budgetMaximo" type="number" min="0" step="1" value={form.budgetMaximo} onChange={(e) => handleChange("budgetMaximo", e.target.value)} />
                {errors.budgetMaximo && <p className="text-xs text-destructive">{errors.budgetMaximo}</p>}
                <p className="text-xs text-muted-foreground">0 = sem limite. Trava escala ao atingir</p>
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
                <p className="text-xs text-muted-foreground">Período de acumulação do teto</p>
              </div>
            </div>
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
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Zona de Perigo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Excluir permanentemente o perfil "{activeProfile.name}" e todos os dados associados (rascunhos, criativos, contexto). Esta ação é irreversível.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Excluir Perfil
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir perfil "{activeProfile.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os dados deste perfil serão excluídos permanentemente, incluindo rascunhos de campanha, criativos e contexto do produto. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir Permanentemente
                      </AlertDialogAction>
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
