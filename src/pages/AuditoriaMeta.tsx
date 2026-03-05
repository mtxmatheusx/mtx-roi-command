import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type MetaRecommendation = {
  title: string;
  message: string;
  importance: string;
  recommendation_type: string;
  code: string;
};

type AuditVerdict = {
  verdict: "APROVADO" | "COM_RESSALVAS" | "REJEITADO";
  justification: string;
  risk_level: "low" | "medium" | "high";
  cost_impact: string;
};

type AuditedRecommendation = {
  recommendation: MetaRecommendation;
  verdict: AuditVerdict | null;
  isAuditing: boolean;
};

const verdictConfig = {
  APROVADO: { icon: CheckCircle2, className: "bg-success/10 text-success border-success/20", label: "✅ APROVADO PELA MTX" },
  COM_RESSALVAS: { icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20", label: "⚠️ APLICAR COM RESSALVAS" },
  REJEITADO: { icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20", label: "❌ REJEITADO: RISCO DE ROI" },
};

export default function AuditoriaMeta() {
  const { toast } = useToast();
  const { activeProfile, productContext } = useClientProfiles();
  const [recommendations, setRecommendations] = useState<AuditedRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profileSummary, setProfileSummary] = useState<any>(null);

  const fetchRecommendations = async () => {
    if (!activeProfile?.id) {
      toast({ title: "Selecione um perfil", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-recommendations", {
        body: { profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        setRecommendations([]);
        return;
      }
      setProfileSummary(data.profile_summary);
      const recs: AuditedRecommendation[] = (data.recommendations || []).map((r: MetaRecommendation) => ({
        recommendation: r,
        verdict: null,
        isAuditing: false,
      }));
      setRecommendations(recs);
      if (recs.length === 0) {
        toast({ title: "Nenhuma recomendação", description: "A Meta não tem sugestões no momento." });
      } else {
        toast({ title: `${recs.length} recomendações encontradas` });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const auditRecommendation = async (index: number) => {
    const rec = recommendations[index];
    setRecommendations((prev) => prev.map((r, i) => i === index ? { ...r, isAuditing: true } : r));

    try {
      const { data, error } = await supabase.functions.invoke("audit-recommendation", {
        body: {
          recommendation: rec.recommendation,
          profileSummary,
          profileId: activeProfile?.id,
        },
      });
      if (data?.blocked) {
        toast({ title: "⚠️ IA Bloqueada", description: data.error || "Preencha o Dossiê do Avatar nas Configurações.", variant: "destructive" });
        setRecommendations((prev) => prev.map((r, idx) => idx === index ? { ...r, isAuditing: false } : r));
        return;
      }
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setRecommendations((prev) => prev.map((r, i) => i === index ? { ...r, verdict: data, isAuditing: false } : r));
    } catch (e: any) {
      toast({ title: "Erro na auditoria", description: e.message, variant: "destructive" });
      setRecommendations((prev) => prev.map((r, i) => i === index ? { ...r, isAuditing: false } : r));
    }
  };

  const auditAll = async () => {
    for (let i = 0; i < recommendations.length; i++) {
      if (!recommendations[i].verdict) {
        await auditRecommendation(i);
      }
    }
  };

  return (
    <AppLayout>
      <ActiveProfileHeader />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Auditoria Meta AI
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              O Gestor IA analisa as sugestões automáticas da Meta e protege seu ROI
            </p>
          </div>
          <div className="flex gap-2">
            {recommendations.length > 0 && recommendations.some((r) => !r.verdict) && (
              <Button variant="outline" size="sm" onClick={auditAll} className="gap-2">
                <Shield className="w-4 h-4" />
                Auditar Todas
              </Button>
            )}
            <Button onClick={fetchRecommendations} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isLoading ? "Buscando..." : "Buscar Recomendações"}
            </Button>
          </div>
        </div>

        {!activeProfile && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Selecione um perfil de cliente para buscar recomendações da Meta.
          </div>
        )}

        {recommendations.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                Clique em "Buscar Recomendações" para capturar as sugestões automáticas da Meta e submetê-las ao tribunal de auditoria da IA.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {recommendations.map((item, i) => {
            const vConfig = item.verdict ? verdictConfig[item.verdict.verdict] : null;
            const VerdictIcon = vConfig?.icon || Shield;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={item.verdict ? "border-l-4" : ""} style={item.verdict ? { borderLeftColor: item.verdict.verdict === "APROVADO" ? "hsl(142 71% 45%)" : item.verdict.verdict === "REJEITADO" ? "hsl(0 84% 60%)" : "hsl(38 92% 50%)" } : undefined}>
                  <CardContent className="p-5 space-y-4">
                    {/* What Meta wants */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">O que a Meta sugere</p>
                      <h3 className="font-semibold text-sm">{item.recommendation.title || "Recomendação"}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{item.recommendation.message}</p>
                      <div className="flex gap-2 mt-2">
                        {item.recommendation.importance && (
                          <Badge variant="secondary" className="text-xs">{item.recommendation.importance}</Badge>
                        )}
                        {item.recommendation.recommendation_type && (
                          <Badge variant="outline" className="text-xs">{item.recommendation.recommendation_type}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Verdict */}
                    {item.verdict && vConfig && (
                      <div className={`p-3 rounded-lg border ${vConfig.className}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <VerdictIcon className="w-4 h-4" />
                          <span className="font-bold text-sm">{vConfig.label}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            Impacto: {item.verdict.cost_impact}
                          </Badge>
                        </div>
                        <p className="text-sm">{item.verdict.justification}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!item.verdict && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => auditRecommendation(i)}
                          disabled={item.isAuditing}
                          className="gap-2"
                        >
                          {item.isAuditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                          {item.isAuditing ? "Auditando..." : "Auditar com IA"}
                        </Button>
                      )}
                      {item.verdict?.verdict === "APROVADO" && (
                        <Button size="sm" variant="default" className="gap-2 bg-success/10 text-success hover:bg-success/20 border border-success/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Aplicar na Meta
                        </Button>
                      )}
                      {item.verdict?.verdict === "COM_RESSALVAS" && (
                        <Button size="sm" variant="outline" className="gap-2 border-warning/20 text-warning hover:bg-warning/10">
                          <AlertTriangle className="w-3 h-3" />
                          Aplicar com Cuidado
                        </Button>
                      )}
                      {item.verdict && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground">
                          Ignorar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
