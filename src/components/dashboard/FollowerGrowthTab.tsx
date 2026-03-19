import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Image, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Heart, MessageCircle, Activity, Link, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

interface Snapshot {
  snapshot_date: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  likes_count: number;
  comments_count: number;
  engagement_rate: number;
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

function extractUsername(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  // Match instagram.com/username patterns
  const urlMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/([A-Za-z0-9_.]+)/i);
  if (urlMatch) return urlMatch[1];
  // Plain @username or username
  const plain = trimmed.replace(/^@/, "");
  if (/^[A-Za-z0-9_.]{1,30}$/.test(plain)) return plain;
  return null;
}

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
        .select("snapshot_date, followers_count, following_count, media_count, likes_count, comments_count, engagement_rate")
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
    } catch (e: any) {
      setError(e.message);
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
      toast.success(`Username @${username} salvo! Clique em Sincronizar para buscar dados.`);
      setIgInput(username);
    }
  };

  const latestSnapshot = snapshots[snapshots.length - 1];
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const followers = current?.followers_count ?? latestSnapshot?.followers_count ?? 0;
  const following = current?.following_count ?? latestSnapshot?.following_count ?? 0;
  const media = current?.media_count ?? latestSnapshot?.media_count ?? 0;
  const engRate = current?.engagement_rate ?? latestSnapshot?.engagement_rate ?? 0;
  const likes = current?.likes_count ?? latestSnapshot?.likes_count ?? 0;
  const comments = current?.comments_count ?? latestSnapshot?.comments_count ?? 0;

  const followersDelta = prevSnapshot ? followers - prevSnapshot.followers_count : null;

  const chartData = snapshots.map((s) => ({
    date: format(parseISO(s.snapshot_date), "dd MMM", { locale: ptBR }),
    seguidores: s.followers_count,
    engagement: s.engagement_rate,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {current?.profile_picture_url && (
            <img src={current.profile_picture_url} alt="Profile" className="w-10 h-10 rounded-full border-2 border-primary/20" />
          )}
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {current?.username ? `@${current.username}` : "Instagram Followers"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhamento de crescimento · {snapshots.length} registros
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={syncNow} disabled={isSyncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          Sincronizar Agora
        </Button>
      </div>

      {/* Instagram Profile Bar — always visible */}
      <Card className="border-primary/20 bg-card/80">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {activeProfile?.instagram_username
                ? `Conectado: @${activeProfile.instagram_username}`
                : "Conectar Instagram"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Cole o link do perfil (ex: https://instagram.com/seuperfil) ou digite o @username e clique em Scraper
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://instagram.com/seuperfil ou @seuperfil"
              value={igInput}
              onChange={(e) => setIgInput(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={saveUsername}
              disabled={isSavingUsername || !igInput.trim()}
              className="gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                // Save first if changed, then sync
                const username = extractUsername(igInput);
                if (username && username !== activeProfile?.instagram_username) {
                  await saveUsername();
                }
                syncNow();
              }}
              disabled={isSyncing || !igInput.trim()}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              Scraper
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Drop Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <motion.div key={alert.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-destructive font-medium">
                  Queda de {Math.abs(alert.change_pct).toFixed(1)}% — {alert.previous_count.toLocaleString("pt-BR")} → {alert.current_count.toLocaleString("pt-BR")} seguidores ({alert.snapshot_date})
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)} className="text-xs shrink-0">
                Dispensar
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Seguidores" value={followers.toLocaleString("pt-BR")} icon={<Users className="w-4 h-4 text-primary" />} delta={followersDelta} delay={0.05} />
        <KpiCard label="Seguindo" value={following.toLocaleString("pt-BR")} icon={<UserPlus className="w-4 h-4 text-primary" />} delay={0.1} />
        <KpiCard label="Publicações" value={media.toLocaleString("pt-BR")} icon={<Image className="w-4 h-4 text-primary" />} delay={0.15} />
        <KpiCard label="Curtidas (25 posts)" value={likes.toLocaleString("pt-BR")} icon={<Heart className="w-4 h-4 text-primary" />} delay={0.2} />
        <KpiCard label="Comentários (25 posts)" value={comments.toLocaleString("pt-BR")} icon={<MessageCircle className="w-4 h-4 text-primary" />} delay={0.25} />
        <KpiCard label="Engagement Rate" value={`${engRate.toFixed(2)}%`} icon={<Activity className="w-4 h-4 text-primary" />} delay={0.3} />
      </div>

      {/* Charts */}
      {chartData.length > 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Evolução de Seguidores</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#followerGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Engagement Rate (%)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Line type="monotone" dataKey="engagement" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Sem dados históricos</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
              Clique em "Sincronizar Agora" para buscar os dados do Instagram. O histórico será construído automaticamente ao longo dos dias.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sync History Table */}
      {snapshots.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Histórico de Sincronizações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Data</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Seguidores</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Seguindo</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Posts</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Curtidas</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Comentários</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Eng. Rate</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Δ Seg.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map((s, i, arr) => {
                      const prev = arr[i + 1];
                      const delta = prev ? s.followers_count - prev.followers_count : null;
                      return (
                        <tr key={s.snapshot_date} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3">{format(parseISO(s.snapshot_date), "dd/MM/yyyy", { locale: ptBR })}</td>
                          <td className="text-right py-2 px-3 font-medium">{s.followers_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2 px-3">{s.following_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2 px-3">{s.media_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2 px-3">{s.likes_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2 px-3">{s.comments_count.toLocaleString("pt-BR")}</td>
                          <td className="text-right py-2 px-3">{s.engagement_rate.toFixed(2)}%</td>
                          <td className={`text-right py-2 px-3 font-medium ${delta === null ? "text-muted-foreground" : delta > 0 ? "text-green-500" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR")}`}
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
    </motion.div>
  );
}

function KpiCard({ label, value, icon, delta, delay = 0 }: { label: string; value: string; icon: React.ReactNode; delta?: number | null; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="glass-card-interactive">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            {icon}
          </div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {delta > 0 ? "+" : ""}{delta.toLocaleString("pt-BR")} vs dia anterior
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
