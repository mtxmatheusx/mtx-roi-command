import { useState, useRef } from "react";
import { Brain, Loader2, RefreshCw, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useToast } from "@/hooks/use-toast";

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const VSL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-vsl`;

export default function Diagnostico() {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo, adAccountId, metaAccessToken } = useClientProfiles();
  const { campaigns, daily, previous, isUsingMock } = useMetaAds(undefined, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  // VSL state
  const [vslAngle, setVslAngle] = useState("");
  const [vslDuration, setVslDuration] = useState("30 segundos para Meta Ads");
  const [vslTone, setVslTone] = useState("Agressivo e Direto");
  const [vslScript, setVslScript] = useState("");
  const [vslLoading, setVslLoading] = useState(false);

  // Clear report when profile changes
  const profileId = activeProfile?.id;
  const prevProfileRef = useRef(profileId);
  if (prevProfileRef.current !== profileId) {
    prevProfileRef.current = profileId;
    if (report) setReport("");
    if (vslScript) setVslScript("");
  }

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
      // Check for blocked response on 200
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
    setVslScript("");

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

      if (!resp.body) { setVslLoading(false); return; }

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
            if (c) { full += c; setVslScript(full); }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao conectar com a IA", variant: "destructive" });
    }
    setVslLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <ActiveProfileHeader />

        <Tabs defaultValue="diagnostico">
          <TabsList>
            <TabsTrigger value="diagnostico" className="gap-2">
              <Brain className="w-4 h-4" />
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger value="vsl" className="gap-2">
              <Clapperboard className="w-4 h-4" />
              🎬 Fábrica de VSL & Copy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="h-6 w-6 text-neon-red" />
                  Diagnóstico da IA
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Análise profunda das suas campanhas com frameworks Hormozi & StoryBrand
                </p>
              </div>
              <Button onClick={generateDiagnostic} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? "Analisando..." : report ? "Regenerar" : "Gerar Diagnóstico"}
              </Button>
            </div>

            {isUsingMock && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                ⚠️ Dados mock detectados. Conecte sua conta Meta Ads em Configurações para análise real.
              </div>
            )}

            {!report && !loading && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <h3 className="text-lg font-medium text-muted-foreground">Nenhum diagnóstico gerado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em "Gerar Diagnóstico" para a IA analisar suas campanhas
                  </p>
                </CardContent>
              </Card>
            )}

            {(report || loading) && (
              <Card ref={reportRef}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-neon-red" />
                    Relatório de Diagnóstico
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

          <TabsContent value="vsl" className="space-y-6 mt-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Clapperboard className="h-6 w-6 text-primary" />
                Fábrica de VSL & Copy
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gere roteiros de alta conversão com Storybrand + Hormozi
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Direção Criativa</CardTitle>
                <CardDescription>Configure os parâmetros para guiar a IA na geração do roteiro.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ângulo da Oferta</Label>
                    <Input
                      value={vslAngle}
                      onChange={(e) => setVslAngle(e.target.value)}
                      placeholder="Ex: Medo de perder, Oportunidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo Desejado</Label>
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
                    <Label>Tom de Voz</Label>
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
                  {vslLoading ? "Gerando roteiro..." : "Gerar Script de Alta Conversão"}
                </Button>
              </CardContent>
            </Card>

            {!vslScript && !vslLoading && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Clapperboard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <h3 className="text-lg font-medium text-muted-foreground">Nenhum roteiro gerado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure a direção criativa e clique em "Gerar Script"
                  </p>
                </CardContent>
              </Card>
            )}

            {(vslScript || vslLoading) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clapperboard className="h-5 w-5 text-primary" />
                    Roteiro de Produção
                    {vslLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm prose-invert max-w-none [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:bg-secondary [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_strong]:text-foreground">
                    <ReactMarkdown>{vslScript}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
