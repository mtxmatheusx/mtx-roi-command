import { useState } from "react";
import { motion } from "framer-motion";
import { Link2, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";

interface UTMEntry {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  conversions: number;
  revenue: number;
  cost: number;
}

interface UTMAnalysisProps {
  data?: UTMEntry[];
}

// Placeholder component — will be connected to real UTM data via ecommerce integration
export default function UTMAnalysis({ data }: UTMAnalysisProps) {
  const [sortBy, setSortBy] = useState<"revenue" | "conversions" | "cost">("revenue");

  const entries = data || [];
  const sorted = [...entries].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Análise UTM</h3>
            <p className="text-xs text-muted-foreground">Rastreamento de vendas por fonte/mídia/campanha</p>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
            <Link2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Análise UTM em breve</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Integre com Shopify, Yampi ou Nuvemshop para cruzar dados UTM com vendas reais e descobrir quais campanhas geram mais receita.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-md bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Fonte</th>
                <th className="text-left px-3 py-2 font-medium">Mídia</th>
                <th className="text-left px-3 py-2 font-medium">Campanha</th>
                <th className="text-right px-3 py-2 font-medium">Sessões</th>
                <th className="text-right px-3 py-2 font-medium cursor-pointer" onClick={() => setSortBy("conversions")}>
                  <span className="inline-flex items-center gap-1">Conv. <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-right px-3 py-2 font-medium cursor-pointer" onClick={() => setSortBy("revenue")}>
                  <span className="inline-flex items-center gap-1">Receita <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-right px-3 py-2 font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{entry.source}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.medium}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{entry.campaign}</td>
                  <td className="text-right px-3 py-2">{entry.sessions.toLocaleString()}</td>
                  <td className="text-right px-3 py-2 font-semibold">{entry.conversions}</td>
                  <td className="text-right px-3 py-2">{formatCurrency(entry.revenue)}</td>
                  <td className={`text-right px-3 py-2 font-semibold ${
                    entry.cost > 0 && entry.revenue / entry.cost >= 3 ? "text-success" :
                    entry.cost > 0 && entry.revenue / entry.cost >= 1.5 ? "text-foreground" : "text-destructive"
                  }`}>
                    {entry.cost > 0 ? `${(entry.revenue / entry.cost).toFixed(2)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
