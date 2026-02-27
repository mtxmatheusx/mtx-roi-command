import { useState, useRef, useEffect } from "react";
import { Brain, Loader2, RefreshCw, Clapperboard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import VSLScriptBoard from "@/components/VSLScriptBoard";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const VSL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-vsl`;

interface VslCena {
  tempo: string;
  visual: string;
  audio: string;
}

interface ParsedVSL {
  titulo: string;
  cenas: VslCena[];
}

export default function Diagnostico() {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo, adAccountId, metaAccessToken } = useClientProfiles();
  const { campaigns, daily, previous, isUsingMock } = useMetaAds(undefined, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });
  const { toast } = useToast();
  const { t } = useTranslation();
  const reportRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // VSL state
  const [vslAngle, setVslAngle] = useState("");
  const [vslDuration, setVslDuration] = useState("30 segundos para Meta Ads");
  const [vslTone, setVslTone] = useState("Agressivo e Direto");
  const [vslLoading, setVslLoading] = useState(false);
  const [parsedVSL, setParsedVSL] = useState<ParsedVSL | null>(null);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  const profileId = activeProfile?.id;
  const prevProfileRef = useRef(profileId);
  if (prevProfileRef.current !== profileId) {
    prevProfileRef.current = profileId;
    if (report) setReport("");
    setParsedVSL(null);
    setSelectedVaultId(null);
  }

  // Vault query
  const { data: vaultScripts = [], isLoading: vaultLoading } = useQuery({
    queryKey: ["vsl-vault", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("vsl_scripts")
        .select("id, title, content_json, created_at, angle, duration, tone")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
  });

  const generateDiagnostic = async () => {
    setLoading(true);
    setReport("");

    const campaignData = {
      perfil: activeProfile?.name || "N/A",
      cpa_meta: cpaMeta,
      ticket_medio: ticketMedio,
      limite_escala: limiteEscala,
      budget_maximo: budgetMaximo,
      usando_dados_mock: isUsingMock,
      campanhas: campaigns.map((c: any) => ({
        nome: c.name, status: c.status, gasto: c.spend, receita: c.revenue,
        cpa: c.cpa, roas: c.roas, ctr: c.ctr, cpm: c.cpm,
        impressoes: c.impressions, cliques: c.clicks, compras: c.purchases,
      })),
      resumo_periodo_anterior: previous
        ? { gasto: previous.spend, receita: previous.purchaseValue, cpa: previous.cpa, roas: previous.roas }
        : null,
      dados_diarios_recentes: daily?.slice(-7) || [],
    };

    const userMessage = isUsingMock
      ? "Gere um diagnóstico de exemplo baseado nos dados mock disponíveis. Indique claramente que são dados simulados."
      : "Analise as métricas atuais das minhas campanhas e gere um diagnóstico completo com recomendações acionáveis.";

    try {
      const resp = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: userMessage }], campaignData, mode: "diagnostico", profileId: activeProfile?.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (err.blocked) {
          toast({ title: "⚠️ IA Bloqueada", description: err.error || "Faltam dados no Dossiê ou falha de conexão com a Meta Ads. Preencha as configurações do perfil.", variant: "destructive" });
        } else {
          toast({ title: "Erro no Diagnóstico", description: err.error || `Erro ${resp.status}`, variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const jsonResp = await resp.json();
        if (jsonResp.blocked) {
          toast({ title: "⚠️ IA Bloqueada", description: jsonResp.error || "Preencha o Dossiê do Avatar nas Configurações.", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      if (!resp.body) { setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

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
          if (json === "[DONE]") break;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { full += c; setReport(full); }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao conectar com a IA", variant: "destructive" });
    }
    setLoading(false);
  };

  const generateVSL = async () => {
    if (!activeProfile) return;
    setVslLoading(true);
    setParsedVSL(null);
    setSelectedVaultId(null);

    try {
      const resp = await fetch(VSL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          profileId: activeProfile.id,
          angle: vslAngle,
          duration: vslDuration,
          tone: vslTone,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        if (err.blocked) {
          toast({ title: "⚠️ IA Bloqueada", description: err.error || "Preencha o Dossiê do Avatar nas Configurações.", variant: "destructive" });
        } else {
          toast({ title: "Erro ao gerar VSL", description: err.error || `Erro ${resp.status}`, variant: "destructive" });
        }
        setVslLoading(false);
        return;
      }

      const result = await resp.json();
      if (result.parsed) {
        setParsedVSL(result.parsed);
        toast({ title: t("vsl.savedToast") });
        queryClient.invalidateQueries({ queryKey: ["vsl-vault", profileId] });
      } else {
        // Fallback: show raw content
        setParsedVSL({ titulo: "Roteiro", cenas: [{ tempo: "—", visual: result.content || "", audio: "" }] });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao conectar com a IA", variant: "destructive" });
    }
    setVslLoading(false);
  };

  const loadFromVault = (script: any) => {
    setSelectedVaultId(script.id);
    if (script.content_json) {
      setParsedVSL(script.content_json as ParsedVSL);
    } else {
      // Legacy fallback
      setParsedVSL({ titulo: script.title || "Roteiro", cenas: [{ tempo: "—", visual: script.script_content || "", audio: "" }] });
    }
  };

  const deleteFromVault = async (id: string) => {
    const { error } = await supabase.from("vsl_scripts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir roteiro.", variant: "destructive" });
      return;
    }
    toast({ title: t("vsl.deletedToast") });
    queryClient.invalidateQueries({ queryKey: ["vsl-vault", profileId] });
    if (selectedVaultId === id) {
      setSelectedVaultId(null);
      setParsedVSL(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <ActiveProfileHeader />

        <Tabs defaultValue="diagnostico">
          <TabsList>
            <TabsTrigger value="diagnostico" className="gap-2">
              <Brain className="w-4 h-4" />
              {t("diagnostic.title")}
            </TabsTrigger>
            <TabsTrigger value="vsl" className="gap-2">
              <Clapperboard className="w-4 h-4" />
              🎬 {t("vsl.title")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="h-6 w-6 text-neon-red" />
                  {t("diagnostic.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">{t("diagnostic.subtitle")}</p>
              </div>
              <Button onClick={generateDiagnostic} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? t("diagnostic.analyzing") : report ? t("common.regenerate") : t("diagnostic.generateBtn")}
              </Button>
            </div>

            {isUsingMock && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                ⚠️ {t("diagnostic.mockWarning")}
              </div>
            )}

            {!report && !loading && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <h3 className="text-lg font-medium text-muted-foreground">{t("diagnostic.noReport")}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t("diagnostic.noReportHint")}</p>
                </CardContent>
              </Card>
            )}

            {(report || loading) && (
              <Card ref={reportRef}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-neon-red" />
                    {t("diagnostic.reportTitle")}
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm prose-invert max-w-none [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5 [&_strong]:text-foreground">
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="vsl" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Vault Sidebar */}
              <div className="lg:col-span-1">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("vsl.vaultTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {vaultLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : vaultScripts.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">{t("vsl.vaultEmpty")}</p>
                      ) : (
                        <div className="space-y-1 px-3 pb-3">
                          {vaultScripts.map((script: any) => (
                            <div
                              key={script.id}
                              onClick={() => loadFromVault(script)}
                              className={`group cursor-pointer rounded-md px-3 py-2.5 text-xs transition-colors relative ${
                                selectedVaultId === script.id
                                  ? "bg-primary/10 border border-primary/30"
                                  : "hover:bg-secondary/50"
                              }`}
                            >
                              <p className="font-medium text-foreground truncate pr-6">
                                {(script.content_json as any)?.titulo || script.title || "Sem título"}
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                {new Date(script.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                {script.angle ? ` · ${script.angle}` : ""}
                              </p>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteFromVault(script.id); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Main Area */}
              <div className="lg:col-span-3 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clapperboard className="h-6 w-6 text-primary" />
                    {t("vsl.title")}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">{t("vsl.subtitle")}</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t("vsl.directionTitle")}</CardTitle>
                    <CardDescription>{t("vsl.directionDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("vsl.angle")}</Label>
                        <Input value={vslAngle} onChange={(e) => setVslAngle(e.target.value)} placeholder={t("vsl.anglePlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("vsl.duration")}</Label>
                        <Select value={vslDuration} onValueChange={setVslDuration}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15 segundos para Stories">15s Stories</SelectItem>
                            <SelectItem value="30 segundos para Meta Ads">30s Meta Ads</SelectItem>
                            <SelectItem value="1 minuto para YouTube">1min YouTube</SelectItem>
                            <SelectItem value="5 minutos para Página de Vendas">5min Página de Vendas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("vsl.tone")}</Label>
                        <Select value={vslTone} onValueChange={setVslTone}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agressivo e Direto">Agressivo e Direto</SelectItem>
                            <SelectItem value="Elegante e Sofisticado">Elegante e Sofisticado</SelectItem>
                            <SelectItem value="Amigável e Empático">Amigável e Empático</SelectItem>
                            <SelectItem value="Científico e Autoritário">Científico e Autoritário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={generateVSL} disabled={vslLoading || !activeProfile} className="gap-2">
                      {vslLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
                      {vslLoading ? t("vsl.generating") : t("vsl.generateBtn")}
                    </Button>
                  </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                  {!parsedVSL && !vslLoading && (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card className="border-dashed">
                        <CardContent className="py-16 text-center">
                          <Clapperboard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                          <h3 className="text-lg font-medium text-muted-foreground">{t("vsl.noScript")}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{t("vsl.noScriptHint")}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {vslLoading && (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card>
                        <CardContent className="py-16 text-center">
                          <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">{t("vsl.generating")}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {parsedVSL && !vslLoading && (
                    <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Clapperboard className="h-5 w-5 text-primary" />
                            {t("vsl.scriptTitle")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <VSLScriptBoard titulo={parsedVSL.titulo} cenas={parsedVSL.cenas} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
