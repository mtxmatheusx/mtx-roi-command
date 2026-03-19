import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Image, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Snapshot {
  snapshot_date: string;
  followers_count: number;
  following_count: number;
  media_count: number;
}

interface CurrentData {
  username?: string;
  profile_picture_url?: string;
  followers_count: number;
  following_count: number;
  media_count: number;
}

export default function FollowerGrowthTab() {
  const { activeProfile } = useClientProfiles();
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [current, setCurrent] = useState<CurrentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!activeProfile?.id || !user?.id) return;
    const { data, error: dbErr } = await supabase
      .from("follower_snapshots")
      .select("snapshot_date, followers_count, following_count, media_count")
      .eq("profile_id", activeProfile.id)
      .order("snapshot_date", { ascending: true })
      .limit(90);

    if (!dbErr && data) {
      setSnapshots(data as Snapshot[]);
    }
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
      if (data?.data) {
        setCurrent(data.data);
      }
      await fetchHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSyncing(false);
    }
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

  const latestSnapshot = snapshots[snapshots.length - 1];
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const followers = current?.followers_count ?? latestSnapshot?.followers_count ?? 0;
  const following = current?.following_count ?? latestSnapshot?.following_count ?? 0;
  const media = current?.media_count ?? latestSnapshot?.media_count ?? 0;

  const followersDelta = prevSnapshot ? followers - prevSnapshot.followers_count : null;

  const chartData = snapshots.map((s) => ({
    date: format(parseISO(s.snapshot_date), "dd MMM", { locale: ptBR }),
    seguidores: s.followers_count,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {current?.profile_picture_url && (
            <img
              src={current.profile_picture_url}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-primary/20"
            />
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
        <Button
          variant="outline"
          size="sm"
          onClick={syncNow}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          Sincronizar Agora
        </Button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-card-interactive">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Seguidores</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{followers.toLocaleString("pt-BR")}</p>
              {followersDelta !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${followersDelta > 0 ? "text-success" : followersDelta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {followersDelta > 0 ? <TrendingUp className="w-3 h-3" /> : followersDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {followersDelta > 0 ? "+" : ""}{followersDelta.toLocaleString("pt-BR")} vs dia anterior
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card-interactive">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Seguindo</span>
                <UserPlus className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{following.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-card-interactive">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Publicações</span>
                <Image className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{media.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Chart */}
      {chartData.length > 1 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Evolução de Seguidores</CardTitle>
            </CardHeader>
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
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="seguidores"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#followerGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
    </motion.div>
  );
}
