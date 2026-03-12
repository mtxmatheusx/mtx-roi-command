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
import { Bot, Play, Pause, TrendingUp, ShieldCheck, Activity, AlertTriangle, Clock, Zap, RefreshCw, Loader2, Copy, Timer, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import AgentRulesEditor from "@/components/AgentRulesEditor";

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
  const [isHourlyRunning, setIsHourlyRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [hourlyResult, setHourlyResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hourlyEnabled, setHourlyEnabled] = useState(false);
  const [businessStart, setBusinessStart] = useState(8);
  const [businessEnd, setBusinessEnd] = useState(23);

  useEffect(() => {
    if (!user?.id || !activeProfile?.id) return;
    loadLogs();
    // Load hourly optimizer settings from profile
    setHourlyEnabled(!!(activeProfile as any)?.hourly_optimizer_enabled);
    setBusinessStart((activeProfile as any)?.business_hours_start ?? 8);
    setBusinessEnd((activeProfile as any)?.business_hours_end ?? 23);
  }, [user?.id, activeProfile?.id]);

  const loadLogs = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("emergency_logs")
      .select("*")
      .eq("user_id", user!.id)
      .eq("profile_id", activeProfile!.id)
      .in("action_type", ["agent_pause", "agent_scale", "agent_duplicate", "guardian", "auto_scale", "kill_switch", "hourly_pause", "hourly_resume", "hourly_scale", "hourly_reduce"])
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

  const handleHourlyRun = async () => {
    setIsHourlyRunning(true);
    setHourlyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("hourly-campaign-optimizer", {
        body: { profile_id: activeProfile?.id },
      });
      if (error) throw error;
      setHourlyResult(data);
      const result = data?.results?.[0];
      toast({ title: "⏱ Otimizador Horário executado", description: result?.ai_summary || `${result?.campaigns_analyzed || 0} campanhas analisadas.` });
      loadLogs();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsHourlyRunning(false);
    }
  };

  const handleToggleHourly = async (enabled: boolean) => {
    setHourlyEnabled(enabled);
    if (!activeProfile?.id) return;
    await supabase
      .from("client_profiles")
      .update({
        hourly_optimizer_enabled: enabled,
        business_hours_start: businessStart,
        business_hours_end: businessEnd,
      } as any)
      .eq("id", activeProfile.id);
    toast({ title: enabled ? "⏱ Otimizador Horário ativado" : "Otimizador Horário desativado" });
  };

  const handleSaveBusinessHours = async () => {
    if (!activeProfile?.id) return;
    await supabase
      .from("client_profiles")
      .update({ business_hours_start: businessStart, business_hours_end: businessEnd } as any)
      .eq("id", activeProfile.id);
    toast({ title: "Horário comercial atualizado" });
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "agent_pause":
      case "guardian":
      case "hourly_pause": return <Pause className="w-4 h-4 text-destructive" />;
      case "agent_scale":
      case "auto_scale":
      case "hourly_scale": return <TrendingUp className="w-4 h-4 text-success" />;
      case "agent_duplicate": return <Zap className="w-4 h-4 text-primary" />;
      case "kill_switch": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "hourly_resume": return <Play className="w-4 h-4 text-success" />;
      case "hourly_reduce": return <TrendingUp className="w-4 h-4 text-warning" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case "agent_pause":
      case "guardian":
      case "hourly_pause": return <Badge className="bg-destructive/15 text-destructive border-destructive/30">PAUSADO</Badge>;
      case "agent_scale":
      case "auto_scale":
      case "hourly_scale": return <Badge className="bg-success/15 text-success border-success/30">ESCALADO</Badge>;
      case "agent_duplicate": return <Badge className="bg-primary/15 text-primary border-primary/30">DUPLICADO</Badge>;
      case "kill_switch": return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">KILL SWITCH</Badge>;
      case "hourly_resume": return <Badge className="bg-success/15 text-success border-success/30">REATIVADO</Badge>;
      case "hourly_reduce": return <Badge className="bg-warning/15 text-warning border-warning/30">REDUZIDO</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const hasGuardianEnabled = (activeProfile?.cpa_max_toleravel || 0) > 0;
  const hasScaleEnabled = (activeProfile?.roas_min_escala || 0) > 0;
  const duplicateCount = logs.filter(l => l.action_type === "agent_duplicate").length;
  const scaleCount = logs.filter(l => l.action_type === "agent_scale" || l.action_type === "auto_scale").length;
  const pauseCount = logs.filter(l => l.action_type === "agent_pause" || l.action_type === "guardian" || l.action_type === "hourly_pause").length;
  const hourlyActionCount = logs.filter(l => l.action_type.startsWith("hourly_")).length;

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-2xl font-bold mt-2 text-destructive">{pauseCount}</p>
                <p className="text-[10px] text-muted-foreground">pausas executadas</p>
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
                <p className="text-2xl font-bold mt-2 text-success">{scaleCount}</p>
                <p className="text-[10px] text-muted-foreground">escalas horizontais</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className={duplicateCount > 0 ? "border-primary/30 bg-primary/5" : "border-border"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Copy className="w-4 h-4 text-primary" />
                  MTX Vertical Scale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Duplicação de adsets</span>
                  {hasScaleEnabled ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Duplica adsets quando budget ≥ 80% do teto
                </p>
                <p className="text-2xl font-bold mt-2 text-primary">{duplicateCount}</p>
                <p className="text-[10px] text-muted-foreground">duplicações realizadas</p>
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
                  Agente 3h (automático) + Horário (1h)
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ─── Hourly Optimizer Section ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className={hourlyEnabled ? "border-primary/30 bg-primary/5" : "border-border"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  MTX Hourly Optimizer
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline" size="sm"
                    onClick={handleHourlyRun}
                    disabled={isHourlyRunning || !activeProfile}
                    className="gap-2"
                  >
                    {isHourlyRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Executar Agora
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="hourly-toggle" className="text-xs">Ativar</Label>
                    <Switch
                      id="hourly-toggle"
                      checked={hourlyEnabled}
                      onCheckedChange={handleToggleHourly}
                    />
                  </div>
                </div>
              </div>
              <CardDescription>
                Otimização hora a hora para negócios com horários específicos. Analisa performance por slot horário, compara com o dia anterior e ajusta campanhas em tempo real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Business Hours Config */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-warning" />
                  <Label className="text-xs whitespace-nowrap">Horário Comercial</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={23}
                    value={businessStart}
                    onChange={(e) => setBusinessStart(parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">h às</span>
                  <Input
                    type="number" min={0} max={23}
                    value={businessEnd}
                    onChange={(e) => setBusinessEnd(parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">h</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSaveBusinessHours} className="h-8 text-xs">
                  Salvar
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {businessEnd > businessStart
                    ? `Operação diurna (${businessEnd - businessStart}h)`
                    : `Operação noturna (${24 - businessStart + businessEnd}h)`}
                </span>
              </div>

              {/* Hourly stats */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">Ações horárias registradas:</span>
                <span className="font-bold text-primary">{hourlyActionCount}</span>
                {hourlyEnabled && <Badge className="bg-success/15 text-success border-success/30 text-[10px]">CRON ATIVO (1h)</Badge>}
              </div>

              {/* Hourly AI Result */}
              {hourlyResult?.results?.[0] && (
                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <p className="text-sm font-medium">{hourlyResult.results[0].ai_summary}</p>
                  {hourlyResult.results[0].actions?.map((action: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50 border">
                      {action.action === "pause" ? <Pause className="w-3 h-3 text-destructive" /> : action.action === "resume" ? <Play className="w-3 h-3 text-success" /> : action.action === "reduce" ? <TrendingUp className="w-3 h-3 text-warning" /> : <TrendingUp className="w-3 h-3 text-success" />}
                      <span className="font-medium uppercase">{action.action}</span>
                      <span className="text-muted-foreground flex-1">{action.campaign_name}: {action.reason}</span>
                      {action.old_budget != null && <span className="font-mono text-primary">R${action.old_budget?.toFixed(0)} → R${action.new_budget?.toFixed(0)}</span>}
                      <Badge variant="outline" className="text-[10px]">{action.status}</Badge>
                    </div>
                  ))}
                  {hourlyResult.results[0].actions?.length === 0 && (
                    <p className="text-xs text-muted-foreground">✅ Nenhuma ação necessária nesta hora.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

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
                          {action.action === "pause" ? <Pause className="w-3 h-3 text-destructive" /> : action.action === "duplicate_scale" ? <Zap className="w-3 h-3 text-primary" /> : <TrendingUp className="w-3 h-3 text-success" />}
                          <span className="font-medium">{action.action === "pause" ? "PAUSOU" : action.action === "duplicate_scale" ? "DUPLICOU" : "ESCALOU"}</span>
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

        {/* Inline Rules Editor */}
        <AgentRulesEditor />

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
                      {(log.action_type === "agent_scale" || log.action_type === "auto_scale") && (
                        <p className="text-xs text-success mt-0.5">
                          Budget: R$ {log.details?.old_budget?.toFixed(2)} → R$ {log.details?.new_budget?.toFixed(2)}
                        </p>
                      )}
                      {log.action_type === "agent_duplicate" && (
                        <p className="text-xs text-primary mt-0.5">
                          Adset duplicado: {log.details?.original_adset_name} → {log.details?.new_adset_id ? `ID ${log.details.new_adset_id}` : "Falhou"}
                        </p>
                      )}
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
