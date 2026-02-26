import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Campaign, getCampaignAlert, formatCurrency, formatPercent } from "@/lib/mockData";
import StatusBadge from "./StatusBadge";
import { Pause, TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CampaignsTableProps {
  campaigns: Campaign[];
  disableScale?: boolean;
}

export default function CampaignsTable({ campaigns, disableScale }: CampaignsTableProps) {
  const [data, setData] = useState(campaigns);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const filteredData = showActiveOnly ? data.filter(c => c.status === 'active' || c.status === 'scaling') : data;

  const handlePause = (id: string) => {
    setData(prev => prev.map(c => c.id === id ? { ...c, status: 'paused' as const } : c));
  };

  const handleScale = (id: string) => {
    setData(prev => prev.map(c => c.id === id ? { ...c, status: 'scaling' as const, spend: c.spend * 1.15 } : c));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Campanhas Ativas</h2>
          <p className="text-sm text-muted-foreground">Monitoramento em tempo real com motor de decisão MTX</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="active-only" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
          <Label htmlFor="active-only" className="text-xs text-muted-foreground cursor-pointer">Apenas ativas</Label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-6 py-4 font-medium">Campanha</th>
              <th className="text-left px-4 py-4 font-medium">Status API</th>
              <th className="text-left px-4 py-4 font-medium">Alerta</th>
              <th className="text-right px-4 py-4 font-medium">Investido</th>
              <th className="text-right px-4 py-4 font-medium">CPA</th>
              <th className="text-right px-4 py-4 font-medium">ROAS</th>
              <th className="text-right px-4 py-4 font-medium">Lucro</th>
              <th className="text-right px-4 py-4 font-medium">Compras</th>
              <th className="text-center px-4 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((c) => {
              const alert = getCampaignAlert(c);
              const cpaAboveMeta = c.purchases > 0 && c.costPerPurchase > c.cpaMeta * 1.2;
              const isActive = c.status === 'active' || c.status === 'scaling';
              return (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 font-medium max-w-[250px] truncate">{c.name}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                      isActive
                        ? "bg-neon-green/15 text-neon-green border-neon-green/30"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {isActive ? "ATIVO" : "PAUSADO"}
                    </span>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={alert} /></td>
                  <td className="text-right px-4 py-4 text-muted-foreground">{formatCurrency(c.spend)}</td>
                  <td className={`text-right px-4 py-4 font-semibold ${cpaAboveMeta ? 'text-neon-red' : 'text-foreground'}`}>
                    {c.purchases > 0 ? formatCurrency(c.costPerPurchase) : '—'}
                    {cpaAboveMeta && <span className="text-xs ml-1">⚠</span>}
                  </td>
                  <td className={`text-right px-4 py-4 font-bold ${c.roi > 3 ? 'text-neon-green' : c.roi > 1 ? 'text-foreground' : 'text-neon-red'}`}>
                    {c.roi > 0 ? `${c.roi.toFixed(2)}x` : '—'}
                  </td>
                  <td className={`text-right px-4 py-4 font-bold ${c.profit > 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                    {formatCurrency(c.profit)}
                  </td>
                  <td className="text-right px-4 py-4">{c.purchases}</td>
                  <td className="text-center px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handlePause(c.id)}
                        disabled={c.status === 'paused'}
                        className="p-2 rounded-lg bg-secondary hover:bg-destructive/20 hover:text-neon-red transition-colors disabled:opacity-30"
                        title="Pausar"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleScale(c.id)}
                        disabled={disableScale || (alert !== 'escalando' && alert !== 'lucrativa')}
                        className="p-2 rounded-lg bg-secondary hover:bg-accent/20 hover:text-neon-green transition-colors disabled:opacity-30"
                        title={disableScale ? "Budget máximo atingido" : "Escalar +15%"}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
