import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserPlus, Image, RefreshCw, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Heart, MessageCircle, Activity, Link,
  Check, Instagram, BarChart3, Clock, Eye
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";

// --- Types ---
interface Snapshot {
  snapshot_date: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  likes_count: number;
  comments_count: number;
  engagement_rate: number;
  created_at?: string;
}

interface CurrentData {
  username?: string;
  profile_picture_url?: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  likes_count: number;
  comments_count: number;
  engagement_rate: number;
}

interface Alert {
  id: string;
  alert_type: string;
  previous_count: number;
  current_count: number;
  change_pct: number;
  snapshot_date: string;
  acknowledged: boolean;
  created_at: string;
}

// --- Helpers ---
function extractUsername(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  const urlMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/([A-Za-z0-9_.]+)/i);
  if (urlMatch) return urlMatch[1];
  const plain = trimmed.replace(/^@/, "");
  if (/^[A-Za-z0-9_.]{1,30}$/.test(plain)) return plain;
  return null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function getRatioLabel(followers: number, following: number): { label: string; color: string } {
  if (following === 0) return { label: "—", color: "text-muted-foreground" };
  const ratio = followers / following;
  if (ratio >= 10) return { label: `${ratio.toFixed(1)}:1 🔥`, color: "text-success" };
  if (ratio >= 2) return { label: `${ratio.toFixed(1)}:1`, color: "text-primary" };
  return { label: `${ratio.toFixed(1)}:1`, color: "text-warning" };
}

// --- Main Component ---
export default function FollowerGrowthTab() {
  const { activeProfile } = useClientProfiles();
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [current, setCurrent] = useState<CurrentData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [igInput, setIgInput] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  const fetchHistory = async () => {
    if (!activeProfile?.id || !user?.id) return;
    const [snapRes, alertRes] = await Promise.all([
      supabase
        .from("follower_snapshots")
        .select("snapshot_date, followers_count, following_count, media_count, likes_count, comments_count, engagement_rate, created_at")
        .eq("profile_id", activeProfile.id)
        .order("snapshot_date", { ascending: true })
        .limit(90),
      supabase
        .from("follower_alerts")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (!snapRes.error && snapRes.data) setSnapshots(snapRes.data as Snapshot[]);
    if (!alertRes.error && alertRes.data) setAlerts(alertRes.data as Alert[]);
  };

  const syncNow = async () => {
    if (!activeProfile?.id) return;
    setIsSyncing(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("fetch-instagram-followers", {
        body: { profile_id: activeProfile.id },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (data?.data) setCurrent(data.data);
      await fetchHistory();
      if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Dados sincronizados com sucesso!");
      }
    } catch (e: any) {
      // Don't show error if we already have data from DB
      await fetchHistory();
      if (snapshots.length > 0) {
        toast.warning("APIs temporariamente indisponíveis. Exibindo dados salvos.");
      } else {
        setError(e.message);
        toast.error("Erro ao sincronizar");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    await supabase.from("follower_alerts").update({ acknowledged: true }).eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);
      await fetchHistory();
      setIsLoading(false);
    };
    init();
  }, [activeProfile?.id, user?.id]);

  useEffect(() => {
    if (activeProfile?.instagram_username) {
      setIgInput(activeProfile.instagram_username);
    }
  }, [activeProfile?.instagram_username]);

  const saveUsername = async () => {
    if (!activeProfile?.id) return;
    const username = extractUsername(igInput);
    if (!username) {
      toast.error("Username inválido. Cole o link do perfil ou digite o @username.");
      return;
    }
    setIsSavingUsername(true);
    const { error: upErr } = await supabase
      .from("client_profiles")
      .update({ instagram_username: username })
      .eq("id", activeProfile.id);
    setIsSavingUsername(false);
    if (upErr) {
      toast.error("Erro ao salvar username");
    } else {
      toast.success(`Username @${username} salvo!`);
      setIgInput(username);
    }
  };

  // Computed values
  const latestSnapshot = snapshots[snapshots.length - 1];
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const followers = current?.followers_count ?? latestSnapshot?.followers_count ?? 0;
  const following = current?.following_count ?? latestSnapshot?.following_count ?? 0;
  const media = current?.media_count ?? latestSnapshot?.media_count ?? 0;
  const engRate = current?.engagement_rate ?? latestSnapshot?.engagement_rate ?? 0;
  const likes = current?.likes_count ?? latestSnapshot?.likes_count ?? 0;
  const comments = current?.comments_count ?? latestSnapshot?.comments_count ?? 0;

  const followersDelta = prevSnapshot ? followers - prevSnapshot.followers_count : null;
  const ratio = getRatioLabel(followers, following);

  const lastSyncTime = latestSnapshot?.created_at
    ? formatDistanceToNow(parseISO(latestSnapshot.created_at), { addSuffix: true, locale: ptBR })
    : null;

  const chartData = snapshots.map((s) => ({
    date: format(parseISO(s.snapshot_date), "dd MMM", { locale: ptBR }),
    seguidores: s.followers_count,
    engagement: s.engagement_rate,
    likes: s.likes_count,
    comments: s.comments_count,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const hasData = followers > 0 || snapshots.length > 0;
  const isConnected = !!activeProfile?.instagram_username;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

      {/* Profile Header Card */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
            {/* Avatar & Username */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="relative shrink-0">
                {current?.profile_picture_url ? (
                  <img src={current.profile_picture_url} alt="Profile" className="w-14 h-14 rounded-full border-2 border-primary/20 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                    <Instagram className="w-6 h-6 text-primary" />
                  </div>
                )}
                {isConnected && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full border-2 border-card" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight truncate">
                    {current?.username ? `@${current.username}` : isConnected ? `@${activeProfile.instagram_username}` : "Instagram"}
                  </h2>
                  {isConnected && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success">Conectado</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="tabular-nums">{snapshots.length} registros</span>
                  {lastSyncTime && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Sync {lastSyncTime}</span>
                    </>
                  )}
                  {hasData && (
                    <>
                      <span className="text-border">·</span>
                      <span className={ratio.color}>Ratio {ratio.label}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={syncNow} disabled={isSyncing} className="gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                Sincronizar
              </Button>
            </div>
          </div>

          {/* Connection Bar */}
          {!isConnected && (
            <div className="border-t border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Conectar Perfil do Instagram</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Cole o link do perfil ou digite o @username para começar o monitoramento.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://instagram.com/seuperfil ou @seuperfil"
                  value={igInput}
                  onChange={(e) => setIgInput(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={saveUsername} disabled={isSavingUsername || !igInput.trim()} className="gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </Button>
                <Button size="sm" onClick={async () => {
                  const username = extractUsername(igInput);
                  if (username && username !== activeProfile?.instagram_username) await saveUsername();
                  syncNow();
                }} disabled={isSyncing || !igInput.trim()} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  Scraper
                </Button>
              </div>
            </div>
          )}

          {/* Connected username edit */}
          {isConnected && (
            <div className="border-t border-border/60 bg-muted/20 px-5 py-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="@username"
                  value={igInput}
                  onChange={(e) => setIgInput(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Button size="sm" variant="ghost" onClick={saveUsername} disabled={isSavingUsername || !igInput.trim()} className="h-8 text-xs gap-1">
                  <Check className="w-3 h-3" /> Atualizar
                </Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  const username = extractUsername(igInput);
                  if (username && username !== activeProfile?.instagram_username) await saveUsername();
                  syncNow();
                }} disabled={isSyncing || !igInput.trim()} className="h-8 text-xs gap-1">
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} /> Scraper
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Drop Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <motion.div key={alert.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-destructive/8 border border-destructive/15 text-sm">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-destructive font-medium tabular-nums">
                  Queda de {Math.abs(alert.change_pct).toFixed(1)}% — {alert.previous_count.toLocaleString("pt-BR")} → {alert.current_count.toLocaleString("pt-BR")} ({alert.snapshot_date})
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)} className="text-xs shrink-0">
                Dispensar
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Seguidores"
            value={formatNumber(followers)}
            rawValue={followers.toLocaleString("pt-BR")}
            icon={<Users className="w-4 h-4" />}
            iconBg="bg-primary/10 text-primary"
            delta={followersDelta}
            delay={0.05}
          />
          <KpiCard
            label="Seguindo"
            value={formatNumber(following)}
            rawValue={following.toLocaleString("pt-BR")}
            icon={<UserPlus className="w-4 h-4" />}
            iconBg="bg-info/10 text-info"
            delay={0.1}
          />
          <KpiCard
            label="Publicações"
            value={formatNumber(media)}
            rawValue={media.toLocaleString("pt-BR")}
            icon={<Image className="w-4 h-4" />}
            iconBg="bg-chart-purple/10 text-[hsl(var(--chart-purple))]"
            delay={0.15}
          />
          <KpiCard
            label="Curtidas"
            value={formatNumber(likes)}
            rawValue={`${likes.toLocaleString("pt-BR")} (últimos 25 posts)`}
            icon={<Heart className="w-4 h-4" />}
            iconBg="bg-chart-pink/10 text-[hsl(var(--chart-pink))]"
            delay={0.2}
          />
          <KpiCard
            label="Comentários"
            value={formatNumber(comments)}
            rawValue={`${comments.toLocaleString("pt-BR")} (últimos 25 posts)`}
            icon={<MessageCircle className="w-4 h-4" />}
            iconBg="bg-chart-orange/10 text-[hsl(var(--chart-orange))]"
            delay={0.25}
          />
          <KpiCard
            label="Engagement"
            value={`${engRate.toFixed(2)}%`}
            rawValue={engRate >= 3 ? "Excelente" : engRate >= 1 ? "Bom" : "Baixo"}
            icon={<Activity className="w-4 h-4" />}
            iconBg="bg-success/10 text-success"
            engLevel={engRate >= 3 ? "high" : engRate >= 1 ? "mid" : "low"}
            delay={0.3}
          />
        </div>
      )}

      {/* Charts */}
      {chartData.length > 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Evolução de Seguidores" icon={<BarChart3 className="w-4 h-4 text-primary" />} delay={0.2}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#followerGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Engagement Rate (%)" icon={<Activity className="w-4 h-4 text-success" />} delay={0.3}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <Line type="monotone" dataKey="engagement" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--success))" }} activeDot={{ r: 5, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : hasData ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Gráficos disponíveis após 2+ dias de dados</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
              Continue sincronizando diariamente para ver a evolução do perfil nos gráficos.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* History Table */}
      {snapshots.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Histórico de Sincronizações</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{snapshots.length} registros</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Data", "Seguidores", "Seguindo", "Posts", "Curtidas", "Comentários", "Eng. Rate", "Δ Seg."].map((h) => (
                        <th key={h} className={`py-2.5 px-3 font-medium text-muted-foreground ${h === "Data" ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map((s, i, arr) => {
                      const prev = arr[i + 1];
                      const delta = prev ? s.followers_count - prev.followers_count : null;
                      return (
                        <tr key={s.snapshot_date} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{format(parseISO(s.snapshot_date), "dd/MM/yyyy", { locale: ptBR })}</td>
                          <td className="text-right py-2.5 px-3 font-semibold tabular-nums">{s.followers_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">{s.following_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">{s.media_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">{s.likes_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">{s.comments_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">{s.engagement_rate.toFixed(2)}%</td>
                          <td className={`text-right py-2.5 px-3 font-semibold tabular-nums ${
                            delta === null ? "text-muted-foreground" : delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {delta === null ? "—" : (
                              <span className="inline-flex items-center gap-0.5">
                                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                {delta > 0 ? "+" : ""}{delta.toLocaleString("pt-BR")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!hasData && !isConnected && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Instagram className="w-8 h-8 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">Monitore seu Instagram</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
              Conecte seu perfil acima para acompanhar seguidores, engagement e crescimento ao longo do tempo.
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// --- Sub-components ---

function KpiCard({ label, value, rawValue, icon, iconBg, delta, engLevel, delay = 0 }: {
  label: string; value: string; rawValue?: string; icon: React.ReactNode;
  iconBg: string; delta?: number | null; engLevel?: "high" | "mid" | "low"; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="group hover:shadow-[var(--shadow-card)] transition-shadow duration-200 border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
              {icon}
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 text-[11px] mt-1.5 font-medium tabular-nums ${delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {delta > 0 ? "+" : ""}{delta.toLocaleString("pt-BR")} vs anterior
            </div>
          )}
          {engLevel && (
            <div className={`text-[11px] mt-1.5 font-medium ${engLevel === "high" ? "text-success" : engLevel === "mid" ? "text-primary" : "text-warning"}`}>
              {rawValue}
            </div>
          )}
          {!delta && !engLevel && rawValue && (
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{rawValue}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ChartCard({ title, icon, delay, children }: { title: string; icon: React.ReactNode; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60">{children}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold tabular-nums">{typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}
