import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Play, Pause, TrendingUp, ShieldCheck, Activity, AlertTriangle, Clock, Zap, RefreshCw, Loader2 } from "lucide-react";

interface AgentLog {
  id: string;
  action_type: string;
  details: any;
  created_at: string;
  profile_id: string;
}

export default function AgenteAutonomo() {
  const { user } = useAuth();
  const { activeProfile, cpaMeta } = useClientProfiles();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !activeProfile?.id) return;
    loadLogs();
  }, [user?.id, activeProfile?.id]);

  const loadLogs = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("emergency_logs")
      .select("*")
      .eq("user_id", user!.id)
      .eq("profile_id", activeProfile!.id)
      .in("action_type", ["agent_pause", "agent_scale", "guardian", "auto_scale", "kill_switch"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setLogs(data as AgentLog[]);
      if (data.length > 0) setLastRun(data[0].created_at);
    }
    setIsLoading(false);
  };

  const handleManualRun = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("autonomous-traffic-manager", {
        body: {},
      });
      if (error) throw error;
      setRunResult(data);
      const activeResult = data?.results?.find((r: any) => r.profile_id === activeProfile?.id) || data?.results?.[0];
      toast({ title: "✅ Agente executado", description: activeResult?.ai_summary || `${data?.results?.length || 0} perfis analisados.` });
      loadLogs();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "agent_pause":
      case "guardian": return <Pause className="w-4 h-4 text-destructive" />;
      case "agent_scale":
      case "auto_scale": return <TrendingUp className="w-4 h-4 text-success" />;
      case "agent_duplicate": return <Zap className="w-4 h-4 text-primary" />;
      case "kill_switch": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case "agent_pause":
      case "guardian": return <Badge className="bg-destructive/15 text-destructive border-destructive/30">PAUSADO</Badge>;
      case "agent_scale":
      case "auto_scale": return <Badge className="bg-success/15 text-success border-success/30">ESCALADO</Badge>;
      case "agent_duplicate": return <Badge className="bg-primary/15 text-primary border-primary/30">DUPLICADO</Badge>;
      case "kill_switch": return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">KILL SWITCH</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const hasGuardianEnabled = (activeProfile?.cpa_max_toleravel || 0) > 0;
  const hasScaleEnabled = (activeProfile?.roas_min_escala || 0) > 0;

  return (
    <AppLayout>
      <ActiveProfileHeader />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              Agente Autônomo
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              IA que monitora, otimiza e protege suas campanhas 24/7
            </p>
          </div>
          <Button onClick={handleManualRun} disabled={isRunning || !activeProfile} className="gap-2">
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Executando..." : "Executar Agora"}
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className={hasGuardianEnabled ? "border-success/30" : "border-border"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  MTX Guardian
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pausa CPA alto</span>
                  {hasGuardianEnabled ? (
                    <Badge className="bg-success/15 text-success border-success/30">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </div>
                {hasGuardianEnabled && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Limite: R$ {activeProfile?.cpa_max_toleravel?.toFixed(2)} (+15% tolerância)
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className={hasScaleEnabled ? "border-primary/30" : "border-border"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  MTX Auto-Scale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Escala ROAS alto</span>
                  {hasScaleEnabled ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </div>
                {hasScaleEnabled && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ROAS min: {activeProfile?.roas_min_escala} | Teto: R$ {activeProfile?.teto_diario_escala}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Última Execução
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono">
                  {lastRun ? new Date(lastRun).toLocaleString("pt-BR") : "Nunca executado"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Agendamento: A cada 30 min (automático)
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* AI Summary from last run */}
        {runResult?.results && (() => {
          const activeResult = runResult.results.find((r: any) => r.profile_id === activeProfile?.id) || runResult.results[0];
          if (!activeResult?.ai_summary) return null;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Relatório da IA — {activeResult.profile}
                  </CardTitle>
                  <CardDescription className="text-xs">{activeResult.campaigns_analyzed} campanhas analisadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{activeResult.ai_summary}</p>
                  {activeResult.actions?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {activeResult.actions.map((action: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-background border">
                          {action.action === "pause" ? <Pause className="w-3 h-3 text-destructive" /> : <TrendingUp className="w-3 h-3 text-success" />}
                          <span className="font-medium">{action.action === "pause" ? "PAUSOU" : "ESCALOU"}</span>
                          <span className="text-muted-foreground flex-1">{action.reason}</span>
                          {action.old_budget != null && action.new_budget != null && (
                            <span className="text-success font-mono">R$ {action.old_budget.toFixed(2)} → R$ {action.new_budget.toFixed(2)}</span>
                          )}
                          <Badge variant="outline" className="ml-auto text-[10px]">{action.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeResult.actions?.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">✅ Nenhuma ação necessária. Todas as campanhas estão dentro dos parâmetros.</p>
                  )}

                  {/* Show other profiles summary */}
                  {runResult.results.filter((r: any) => r.profile_id !== activeResult.profile_id).length > 0 && (
                    <div className="mt-4 pt-3 border-t space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Outros perfis:</p>
                      {runResult.results.filter((r: any) => r.profile_id !== activeResult.profile_id).map((r: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-medium">{r.profile}</span>
                          <span>— {r.campaigns_analyzed} campanhas, {r.actions?.length || 0} ações</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        {/* Configuration hint */}
        {!hasGuardianEnabled && !hasScaleEnabled && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Agente Inativo</p>
                <p className="text-xs text-muted-foreground">
                  Configure o <strong>CPA Máximo Tolerável</strong> e/ou <strong>ROAS Mínimo para Escala</strong> nas Configurações para ativar o agente autônomo.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historical Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Histórico de Ações
                </CardTitle>
                <CardDescription>Registro de todas as intervenções autônomas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadLogs} className="gap-1">
                <RefreshCw className="w-3 h-3" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma ação registrada ainda.</p>
                <p className="text-xs mt-1">Execute o agente manualmente ou aguarde a execução automática.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {logs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <div className="mt-0.5">{getActionIcon(log.action_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(log.action_type)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                        {log.details?.ai_driven && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Zap className="w-2 h-2" /> IA
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1">
                        {log.details?.campaign_name || log.details?.adset_name || "Ação do sistema"}
                      </p>
                      {log.details?.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{log.details.reason}</p>
                      )}
                      {log.action_type === "agent_scale" || log.action_type === "auto_scale" ? (
                        <p className="text-xs text-success mt-0.5">
                          Budget: R$ {log.details?.old_budget?.toFixed(2)} → R$ {log.details?.new_budget?.toFixed(2)}
                        </p>
                      ) : null}
                      {log.details?.cpa_real && (
                        <p className="text-xs text-destructive mt-0.5">
                          CPA: R$ {log.details.cpa_real.toFixed(2)} (limite: R$ {log.details.cpa_max?.toFixed(2)})
                        </p>
                      )}
                    </div>
                    <Badge variant={log.details?.success ? "default" : "destructive"} className="text-[10px] shrink-0">
                      {log.details?.success ? "OK" : "FALHA"}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
