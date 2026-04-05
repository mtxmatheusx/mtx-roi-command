import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Users } from "lucide-react";

interface DemoEntry {
  range?: string;
  label?: string;
  name?: string;
  spend: number;
  impressions?: number;
  purchases: number;
  revenue?: number;
}

interface DemographicData {
  age: DemoEntry[];
  gender: DemoEntry[];
  region: DemoEntry[];
}

interface DemographicsChartProps {
  data: DemographicData | null;
}

const AGE_COLORS = ["hsl(187, 100%, 42%)", "hsl(210, 80%, 50%)", "hsl(240, 60%, 55%)", "hsl(270, 67%, 55%)", "hsl(300, 50%, 50%)", "hsl(340, 82%, 59%)"];
const GENDER_COLORS = ["hsl(187, 100%, 42%)", "hsl(270, 67%, 55%)", "hsl(var(--muted-foreground))"];

export default function DemographicsChart({ data }: DemographicsChartProps) {
  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Dados Demograficos</h3>
            <p className="text-xs text-muted-foreground">Idade, genero e regiao dos ultimos 7 dias</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center py-6">
          Dados demograficos serao carregados quando disponiveis na API.
        </p>
      </motion.div>
    );
  }

  const hasAge = data.age.length > 0;
  const hasGender = data.gender.length > 0;
  const hasRegion = data.region.length > 0;

  if (!hasAge && !hasGender && !hasRegion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold">Dados Demograficos</h3>
          <p className="text-xs text-muted-foreground">Idade, genero e regiao</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age Distribution */}
        {hasAge && (
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
        {hasGender && (
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Por Genero</h4>
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
        {hasRegion && (
          <div className="md:col-span-2">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Top Regioes</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {data.region.slice(0, 8).map((r) => (
                <div key={String(r.name)} className="p-2 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs font-medium truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    R$ {r.spend.toFixed(0)} | {r.purchases} vendas
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
