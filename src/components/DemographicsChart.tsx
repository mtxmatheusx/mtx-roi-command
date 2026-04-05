import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Users, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemographicData {
  age: Array<{ range: string; spend: number; purchases: number; impressions: number }>;
  gender: Array<{ label: string; spend: number; purchases: number; impressions: number }>;
  region: Array<{ name: string; spend: number; purchases: number }>;
}

const GENDER_LABELS: Record<string, string> = {
  "1": "Masculino",
  "2": "Feminino",
  unknown: "Desconhecido",
};

const AGE_COLORS = ["hsl(187, 100%, 42%)", "hsl(210, 80%, 50%)", "hsl(240, 60%, 55%)", "hsl(270, 67%, 55%)", "hsl(300, 50%, 50%)", "hsl(340, 82%, 59%)"];
const GENDER_COLORS = ["hsl(187, 100%, 42%)", "hsl(270, 67%, 55%)", "hsl(var(--muted-foreground))"];

export default function DemographicsChart() {
  const { adAccountId, metaAccessToken } = useClientProfiles();
  const [data, setData] = useState<DemographicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDemographics = async () => {
    if (!adAccountId || adAccountId === "act_" || !metaAccessToken) return;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("meta-ads-sync", {
        body: {
          adAccountId,
          accessToken: metaAccessToken,
          demographicsOnly: true,
          datePreset: "last_7d",
        },
      });

      if (fnError) throw fnError;

      if (result?.demographics) {
        setData(result.demographics);
      } else {
        // Fallback: parse from breakdowns if available
        setData(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDemographics();
  }, [adAccountId, metaAccessToken]);

  if (!adAccountId || adAccountId === "act_") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Dados Demográficos</h3>
            <p className="text-xs text-muted-foreground">Idade, gênero e região dos últimos 7 dias</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDemographics} disabled={loading} className="h-7">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Dados demográficos indisponíveis. Verifique se o token tem permissão ads_read.
        </p>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Age Distribution */}
          {data.age.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Por Idade</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.age} barSize={24}>
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Investimento"]}
                  />
                  <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                    {data.age.map((_, i) => (
                      <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gender Distribution */}
          {data.gender.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Por Gênero</h4>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.gender}
                      dataKey="spend"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {data.gender.map((_, i) => (
                        <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Investimento"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data.gender.map((g, i) => (
                    <div key={g.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: GENDER_COLORS[i % GENDER_COLORS.length] }}
                      />
                      <span className="text-xs text-foreground">{g.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({g.purchases} vendas)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Region */}
          {data.region.length > 0 && (
            <div className="md:col-span-2">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Top Regiões</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {data.region.slice(0, 8).map((r) => (
                  <div key={r.name} className="p-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs font-medium truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      R$ {r.spend.toFixed(0)} · {r.purchases} vendas
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !data && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Dados demográficos serão carregados quando disponíveis na API.
        </p>
      )}
    </motion.div>
  );
}
