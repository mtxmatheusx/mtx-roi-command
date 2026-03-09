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
    return format(new Date(dateStr + "T00:00:00"), "dd MMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

const chartData = (daily: DailyDataPoint[]) =>
  daily.map((d) => ({ ...d, label: formatLabel(d.date) }));

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-card border border-border px-4 py-3 text-xs"
         style={{ boxShadow: "var(--shadow-elevated)" }}>
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
          <span className="text-muted-foreground">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const axisStyle = {
  fontSize: 11,
  fill: "hsl(0 0% 45%)",
  fontFamily: "Inter, system-ui, sans-serif",
};

const gridStyle = "hsl(0 0% 93%)";

export default function DashboardCharts({ daily, cpaMeta = 200 }: DashboardChartsProps) {
  const data = chartData(daily);

  const charts = [
    {
      title: "CPA",
      subtitle: "Custo por aquisição",
      content: (
        <LineChart data={data}>
          <defs>
            <linearGradient id="cpaGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(36 100% 50%)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(36 100% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStyle} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-4} />
          <Tooltip content={<CustomTooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />} />
          <ReferenceLine y={cpaMeta} stroke="hsl(0 72% 51%)" strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: `Meta R$ ${cpaMeta}`, fill: "hsl(0 72% 51%)", fontSize: 10, position: "right" }} />
          <Line type="monotone" dataKey="cpa" stroke="hsl(36 100% 50%)" strokeWidth={2.5}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(0 0% 100%)", stroke: "hsl(36 100% 50%)" }} />
        </LineChart>
      ),
    },
    {
      title: "ROAS",
      subtitle: "Retorno sobre investimento",
      content: (
        <LineChart data={data}>
          <CartesianGrid stroke={gridStyle} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-4} />
          <Tooltip content={<CustomTooltip formatter={(v: number) => `${v.toFixed(2)}x`} />} />
          <ReferenceLine y={3} stroke="hsl(152 69% 41%)" strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: "3x", fill: "hsl(152 69% 41%)", fontSize: 10, position: "right" }} />
          <Line type="monotone" dataKey="roas" stroke="hsl(152 69% 41%)" strokeWidth={2.5}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(0 0% 100%)", stroke: "hsl(152 69% 41%)" }} />
        </LineChart>
      ),
    },
    {
      title: "Lucro",
      subtitle: "Evolução acumulada",
      content: (
        <AreaChart data={data}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(211 100% 50%)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="hsl(211 100% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStyle} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-4} />
          <Tooltip content={<CustomTooltip formatter={(v: number) => `R$ ${v.toFixed(0)}`} />} />
          <Area type="monotone" dataKey="profit" stroke="hsl(211 100% 50%)" strokeWidth={2.5}
            fill="url(#profitFill)"
            activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(0 0% 100%)", stroke: "hsl(211 100% 50%)" }} />
        </AreaChart>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8"
    >
      {charts.map((chart, i) => (
        <motion.div
          key={chart.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="chart-container group"
        >
          <div className="mb-5">
            <p className="text-sm font-semibold text-foreground tracking-tight">{chart.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{chart.subtitle}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {chart.content}
          </ResponsiveContainer>
        </motion.div>
      ))}
    </motion.div>
  );
}
