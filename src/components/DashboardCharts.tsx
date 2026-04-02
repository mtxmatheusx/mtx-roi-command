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
    <div className="rounded-xl bg-card border border-border px-4 py-3 text-xs shadow-[var(--shadow-elevated)]">
      <p className="font-semibold text-foreground mb-1.5 text-[11px] tracking-wide uppercase">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
          <span className="text-foreground font-medium">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const axisStyle = {
  fontSize: 11,
  fill: "hsl(220 8% 46%)",
  fontFamily: "Inter, system-ui, sans-serif",
};

const gridStyle = "hsl(220 13% 93%)";

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
              <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStyle} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-4} />
          <Tooltip content={<CustomTooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />} />
          <ReferenceLine y={cpaMeta} stroke="hsl(0 72% 51%)" strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: `Meta R$ ${cpaMeta}`, fill: "hsl(0 72% 51%)", fontSize: 10, position: "right" }} />
          <Line type="monotone" dataKey="cpa" stroke="hsl(38 92% 50%)" strokeWidth={2.5}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(0 0% 100%)", stroke: "hsl(38 92% 50%)" }} />
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
              <stop offset="0%" stopColor="hsl(211 100% 50%)" stopOpacity={0.1} />
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {charts.map((chart, i) => (
        <motion.div
          key={chart.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="chart-container group"
        >
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground tracking-tight">{chart.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{chart.subtitle}</p>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            {chart.content}
          </ResponsiveContainer>
        </motion.div>
      ))}
    </div>
  );
}
