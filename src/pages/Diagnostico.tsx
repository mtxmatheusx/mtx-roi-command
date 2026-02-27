import { useState, useRef } from "react";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import ReactMarkdown from "react-markdown";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useToast } from "@/hooks/use-toast";

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export default function Diagnostico() {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const { activeProfile, cpaMeta, ticketMedio, limiteEscala, budgetMaximo, adAccountId, metaAccessToken } = useClientProfiles();
  const { campaigns, daily, previous, isUsingMock } = useMetaAds(undefined, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

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
        nome: c.name,
        status: c.status,
        gasto: c.spend,
        receita: c.revenue,
        cpa: c.cpa,
        roas: c.roas,
        ctr: c.ctr,
        cpm: c.cpm,
        impressoes: c.impressions,
        cliques: c.clicks,
        compras: c.purchases,
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
        body: JSON.stringify({
          messages: [{ role: "user", content: userMessage }],
          campaignData,
          mode: "diagnostico",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast({ title: "Erro no Diagnóstico", description: err.error || `Erro ${resp.status}`, variant: "destructive" });
        setLoading(false);
        return;
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
            if (c) {
              full += c;
              setReport(full);
            }
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
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
      </div>
    </AppLayout>
  );
}
