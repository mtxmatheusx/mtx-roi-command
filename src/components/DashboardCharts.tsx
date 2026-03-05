import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DailyDataPoint } from "@/hooks/useMetaAds";

interface DashboardChartsProps {
  daily: DailyDataPoint[];
  cpaMeta?: number;
}

function formatLabel(dateStr: string) {
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

const chartData = (daily: DailyDataPoint[]) =>
  daily.map((d) => ({ ...d, label: formatLabel(d.date) }));

const tooltipStyle = {
  contentStyle: {
    background: "hsl(0 0% 100%)",
    border: "1px solid hsl(220 13% 91%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(224 71% 4%)",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
};

export default function DashboardCharts({ daily, cpaMeta = 200 }: DashboardChartsProps) {
  const data = chartData(daily);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"
    >
      {/* CPA Chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground mb-4">CPA ao longo do tempo</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "CPA"]} />
            <ReferenceLine y={cpaMeta} stroke="hsl(0 84% 60%)" strokeDasharray="5 5" label={{ value: "Meta", fill: "hsl(0 84% 60%)", fontSize: 10 }} />
            <Line type="monotone" dataKey="cpa" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ROAS Chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground mb-4">ROAS ao longo do tempo</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}x`, "ROAS"]} />
            <ReferenceLine y={3} stroke="hsl(142 71% 45%)" strokeDasharray="5 5" label={{ value: "3x", fill: "hsl(142 71% 45%)", fontSize: 10 }} />
            <Line type="monotone" dataKey="roas" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground mb-4">Lucro acumulado</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(0)}`, "Lucro"]} />
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="profit" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#profitGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
