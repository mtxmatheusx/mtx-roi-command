import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Rocket, Brain, ChevronDown, CheckCircle2, XCircle, Clock, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type CopyOption = { copy_type?: "direct_response" | "storytelling" | "social_proof"; headline: string; primary_text: string; cta: string };
type TargetingSuggestion = { audience_type?: string; age_range?: string; interests?: string[]; lookalike_source?: string; placements?: string };

interface DraftData {
  campaign_name: string;
  copy_options: CopyOption[];
  targeting_suggestion: TargetingSuggestion;
  daily_budget: number;
  ai_reasoning: string;
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
  error_message: string | null;
  created_at: string;
};

const objectiveLabels: Record<string, string> = {
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Leads",
  OUTCOME_ENGAGEMENT: "Engajamento",
};

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Rascunho", className: "bg-secondary text-muted-foreground", icon: Clock },
  approved: { label: "Aprovado", className: "bg-neon-yellow/15 text-neon-yellow", icon: Clock },
  published: { label: "Publicado", className: "bg-neon-green/15 text-neon-green", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive", icon: XCircle },
  rejected: { label: "Rejeitado", className: "bg-secondary text-muted-foreground", icon: XCircle },
};

export default function LancarCampanha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeProfile, budgetMaximo, cpaMeta, ticketMedio, limiteEscala, budgetFrequency, productContext } = useClientProfiles();
  const { campaigns } = useMetaAds();

  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState("OUTCOME_SALES");
  const [dailyBudget, setDailyBudget] = useState(50);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [selectedCopyIdx, setSelectedCopyIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState("");
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishResult, setPublishResult] = useState<{ success: boolean; meta_campaign_id?: string; ads_manager_url?: string; error?: string; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string; step?: string; steps?: string[] } | null>(null);
  const [publishLogs, setPublishLogs] = useState<{ time: string; message: string; status: "done" | "pending" | "error" }[]>([]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Load draft history
  useEffect(() => {
    if (!user?.id) return;
    loadDrafts();
  }, [user?.id]);

  const loadDrafts = async () => {
    const { data } = await supabase
      .from("campaign_drafts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setDrafts(data as unknown as DraftRecord[]);
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-campaign-draft", {
        body: {
          objective,
          profileConfig: {
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

      setDraft({
        campaign_name: data.campaign_name,
        copy_options: data.copy_options || [],
        targeting_suggestion: data.targeting_suggestion || {},
        daily_budget: data.daily_budget || dailyBudget,
        ai_reasoning: data.ai_reasoning || "",
      });
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

    try {
      // Save draft first
      setPublishStep("Salvando rascunho...");
      setPublishProgress(10);

      const { data: inserted, error: insertErr } = await supabase.from("campaign_drafts").insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        status: "approved",
        objective,
        campaign_name: draft.campaign_name,
        daily_budget: dailyBudget,
        copy_options: [draft.copy_options[selectedCopyIdx]] as any,
        targeting_suggestion: draft.targeting_suggestion as any,
        ai_reasoning: draft.ai_reasoning,
      }).select("id").single();

      if (insertErr || !inserted) throw new Error(insertErr?.message || "Erro ao salvar");

      setPublishStep("Criando Campanha na Meta...");
      setPublishProgress(30);

      const { data: result, error: publishError } = await supabase.functions.invoke("create-meta-campaign", {
        body: { draftId: inserted.id },
      });

      if (publishError) {
        let detailedError = publishError.message;
        try {
          if ((publishError as any).context) {
            const errBody = await (publishError as any).context.json();
            detailedError = errBody?.error || detailedError;
          }
        } catch {}
        throw new Error(detailedError);
      }

      if (result?.error) {
        const stepLabels: Record<string, string> = { campaign: "Criação da Campanha", adset: "Criação do Conjunto de Anúncios", ad: "Criação do Anúncio" };
        const failedStep = result.step ? stepLabels[result.step] || result.step : "";
        const partialInfo = result.steps?.length ? `\nEtapas concluídas: ${result.steps.join(", ")}` : "";
        setPublishStep(`Falha em: ${failedStep || "Meta API"}`);
        setPublishProgress(100);
        setPublishResult({ success: false, error: `${result.error}${partialInfo}`, meta_campaign_id: result.meta_campaign_id });
      } else {
        setPublishStep("Campanha publicada com sucesso!");
        setPublishProgress(100);
        setPublishResult({
          success: true,
          meta_campaign_id: result.meta_campaign_id,
          ads_manager_url: result.ads_manager_url,
        });
      }

      loadDrafts();
    } catch (e: any) {
      setPublishStep(`Erro: ${e.message}`);
      setPublishProgress(100);
      setPublishResult({ success: false, error: e.message });
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
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-neon-red" />
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
            <AlertTriangle className="w-4 h-4 text-neon-yellow" />
            Budget máximo {budgetFrequency}: R$ {budgetMaximo.toLocaleString("pt-BR")}
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                step >= s ? "bg-primary/20 text-primary border-primary/50" : "bg-secondary text-muted-foreground border-border"
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
              <CardDescription>Defina o objetivo e orçamento, ou deixe a IA sugerir tudo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opções de Copy</CardTitle>
                <CardDescription>Selecione a melhor copy para seu anúncio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.copy_options.map((copy, i) => {
                  const copyTypeConfig: Record<string, { label: string; desc: string; className: string }> = {
                    direct_response: { label: "Direct Response", desc: "Foco na dor e oferta", className: "bg-destructive/15 text-destructive border-destructive/30" },
                    storytelling: { label: "Storytelling", desc: "Narrativa de transformação", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
                    social_proof: { label: "Social Proof", desc: "Resultados e autoridade", className: "bg-neon-green/15 text-neon-green border-neon-green/30" },
                  };
                  const ct = copy.copy_type ? copyTypeConfig[copy.copy_type] : null;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedCopyIdx(i)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedCopyIdx === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
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
                        <span className="text-xs text-muted-foreground">{copy.cta}</span>
                      </div>
                      <p className="font-semibold text-sm">{copy.headline}</p>
                      <p className="text-sm text-muted-foreground mt-1">{copy.primary_text}</p>
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
                    <CardContent className="pt-4 prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{draft.ai_reasoning}</ReactMarkdown>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(3)}>Revisar e Aprovar</Button>
              <Button variant="outline" onClick={handleSaveDraft}>Salvar como Rascunho</Button>
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && draft && (
          <div className="space-y-4">
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-neon-green" />
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
                </div>

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
                  <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4 space-y-2">
                    <p className="text-neon-green font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Campanha publicada com sucesso!
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {publishResult.meta_campaign_id}</p>
                    {publishResult.ads_manager_url && (
                      <a href={publishResult.ads_manager_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline">
                        Abrir no Gerenciador de Anúncios <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {publishResult && !publishResult.success && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
                    <p className="text-destructive font-semibold flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Erro na publicação
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{publishResult.error}</p>
                    {publishResult.meta_campaign_id && (
                      <p className="text-xs text-amber-400">⚠️ Campanha parcialmente criada (ID: {publishResult.meta_campaign_id}). Verifique no Gerenciador de Anúncios.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!publishResult && (
              <div className="flex gap-3">
                <Button onClick={handlePublish} disabled={isPublishing} className="gap-2 bg-neon-green/90 hover:bg-neon-green text-background font-bold">
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Aprovar Execução
                </Button>
                <Button variant="outline" onClick={handleSaveDraft}>Salvar como Rascunho</Button>
                <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              </div>
            )}

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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
