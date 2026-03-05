import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, DollarSign, TrendingUp, Activity, AlertTriangle, Loader2, ArrowRight, RefreshCw, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AppLayout from "@/components/AppLayout";
import { useClientProfiles, ClientProfile } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/mockData";
import { motion } from "framer-motion";
import { format, startOfMonth } from "date-fns";

const META_ADS_SYNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-sync`;

interface ProfileMetrics {
  profileId: string;
  profileName: string;
  adAccountId: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
  status: "active" | "error" | "no_data";
  error?: string;
  activeCampaigns: number;
}

interface AIAlert {
  profile_name: string;
  level: "success" | "warning" | "danger";
  message: string;
}

export default function AgencyView() {
  const { user } = useAuth();
  const { profiles, setActiveProfile, isLoading: profilesLoading } = useClientProfiles();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<ProfileMetrics[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const fetchAllMetrics = async () => {
    if (!profiles.length) return;
    setLoadingMetrics(true);

    const since = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const until = format(new Date(), "yyyy-MM-dd");

    const results = await Promise.allSettled(
      profiles.map(async (p): Promise<ProfileMetrics> => {
        if (!p.ad_account_id || p.ad_account_id === "act_") {
          return { profileId: p.id, profileName: p.name, adAccountId: p.ad_account_id, spend: 0, revenue: 0, roas: 0, purchases: 0, status: "no_data", activeCampaigns: 0 };
        }
        try {
          const resp = await fetch(META_ADS_SYNC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              adAccountId: p.ad_account_id,
              datePreset: "this_month",
              since, until,
              cpaMeta: p.cpa_meta,
              ticketMedio: p.ticket_medio,
              accessToken: p.meta_access_token || undefined,
            }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          const campaigns = data.campaigns || [];
          const totalSpend = campaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
          const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.purchaseValue || 0), 0);
          const totalPurchases = campaigns.reduce((s: number, c: any) => s + (c.purchases || 0), 0);
          const activeCampaigns = campaigns.filter((c: any) => c.effective_status === "ACTIVE" || c.status === "ACTIVE").length;
          return {
            profileId: p.id, profileName: p.name, adAccountId: p.ad_account_id,
            spend: totalSpend, revenue: totalRevenue,
            roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            purchases: totalPurchases, status: "active", activeCampaigns,
          };
        } catch (e) {
          return { profileId: p.id, profileName: p.name, adAccountId: p.ad_account_id, spend: 0, revenue: 0, roas: 0, purchases: 0, status: "error", error: (e as Error).message, activeCampaigns: 0 };
        }
      })
    );

    const resolved = results.map((r) => r.status === "fulfilled" ? r.value : { profileId: "", profileName: "Erro", adAccountId: "", spend: 0, revenue: 0, roas: 0, purchases: 0, status: "error" as const, activeCampaigns: 0 });
    setMetrics(resolved);
    setLoadingMetrics(false);
  };

  const fetchAIAlerts = async () => {
    if (!metrics.length) return;
    setLoadingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke("agency-alerts", {
        body: { profiles: metrics.map((m) => ({ name: m.profileName, spend: m.spend, revenue: m.revenue, roas: m.roas, purchases: m.purchases, status: m.status, activeCampaigns: m.activeCampaigns })) },
      });
      if (error) throw error;
      setAlerts(data?.alerts || []);
    } catch (e) {
      toast({ title: "Erro nos alertas IA", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => { if (profiles.length > 0 && !profilesLoading) fetchAllMetrics(); }, [profiles.length, profilesLoading]);
  useEffect(() => { if (metrics.length > 0 && !loadingMetrics) fetchAIAlerts(); }, [metrics, loadingMetrics]);

  const handleManage = async (profileId: string) => {
    await setActiveProfile(profileId);
    navigate("/");
  };

  // Aggregated metrics
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const globalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const activeAccounts = metrics.filter((m) => m.status === "active" && m.activeCampaigns > 0).length;
  const errorAccounts = metrics.filter((m) => m.status === "error").length;

  const sortedMetrics = [...metrics].sort((a, b) => b.roas - a.roas);

  const alertColors = { success: "border-success/30 bg-success/5 text-success", warning: "border-warning/30 bg-warning/5 text-warning", danger: "border-destructive/30 bg-destructive/5 text-destructive" };
  const alertIcons = { success: "✅", warning: "⚠️", danger: "🚨" };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Visão da Agência
            </motion.h1>
            <p className="text-muted-foreground text-sm mt-1">Métricas agregadas de todos os clientes · Mês atual</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllMetrics} disabled={loadingMetrics} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loadingMetrics ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Executive Cards */}
        {loadingMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground font-medium">Gasto Total MTX</p><p className="text-2xl font-bold mt-1">{formatCurrency(totalSpend)}</p></div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent></Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground font-medium">Faturamento Estimado</p><p className="text-2xl font-bold mt-1 text-neon-green">{formatCurrency(totalRevenue)}</p></div>
                  <TrendingUp className="h-8 w-8 text-neon-green/30" />
                </div>
              </CardContent></Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground font-medium">ROAS Global</p><p className={`text-2xl font-bold mt-1 ${globalRoas >= 2 ? "text-neon-green" : globalRoas >= 1 ? "text-neon-yellow" : "text-neon-red"}`}>{globalRoas.toFixed(2)}x</p></div>
                  <Activity className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent></Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Saúde da Operação</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-neon-green border-neon-green/40">{activeAccounts} Ativas</Badge>
                      {errorAccounts > 0 && <Badge variant="destructive">{errorAccounts} Erro</Badge>}
                    </div>
                  </div>
                  <AlertTriangle className={`h-8 w-8 ${errorAccounts > 0 ? "text-neon-red/50" : "text-neon-green/30"}`} />
                </div>
              </CardContent></Card>
            </motion.div>
          </div>
        )}

        {/* Client Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performance</CardTitle>
            <CardDescription>Ranking dos clientes por ROAS nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : sortedMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum perfil cadastrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMetrics.map((m, i) => (
                    <TableRow key={m.profileId}>
                      <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{m.profileName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.spend)}</TableCell>
                      <TableCell className="text-right text-neon-green">{formatCurrency(m.revenue)}</TableCell>
                      <TableCell className={`text-right font-bold ${m.roas >= 2 ? "text-neon-green" : m.roas >= 1 ? "text-neon-yellow" : "text-neon-red"}`}>{m.roas.toFixed(2)}x</TableCell>
                      <TableCell className="text-right">{m.purchases}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === "active" ? "outline" : "destructive"} className={m.status === "active" ? "text-neon-green border-neon-green/40" : ""}>
                          {m.status === "active" ? "Ativo" : m.status === "error" ? "Erro" : "Sem dados"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleManage(m.profileId)} className="gap-1 text-xs">
                          Gerenciar <ArrowRight className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* AI Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Radar do Gestor IA
            </CardTitle>
            <CardDescription>Alertas automáticos gerados pela IA para todas as contas</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> IA analisando todas as contas...
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum alerta disponível. Atualize os dados para gerar insights.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <div key={i} className={`border rounded-lg px-4 py-3 text-sm ${alertColors[alert.level]}`}>
                    <span className="mr-2">{alertIcons[alert.level]}</span>
                    <span className="font-semibold">{alert.profile_name}:</span>{" "}
                    {alert.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
