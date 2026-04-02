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

  useEffect(() => {
    setData(campaigns);
  }, [campaigns]);

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
      className="liquid-glass"
    >
      <div className="lg-distortion" />
      <div className="lg-overlay" />
      <div className="lg-specular" />
      <div className="lg-content !p-0">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Campanhas Ativas</h2>
            <p className="text-sm text-muted-foreground">Monitoramento em tempo real</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active-only" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
            <Label htmlFor="active-only" className="text-xs text-muted-foreground cursor-pointer">Apenas ativas</Label>
          </div>
        </div>
      <div className="overflow-x-auto -mx-px">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-white/10 text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium text-xs">Campanha</th>
              <th className="text-left px-4 py-3 font-medium text-xs">Status</th>
              <th className="text-left px-4 py-3 font-medium text-xs">Alerta</th>
              <th className="text-right px-4 py-3 font-medium text-xs">Investido</th>
              <th className="text-right px-4 py-3 font-medium text-xs">CPA</th>
              <th className="text-right px-4 py-3 font-medium text-xs">ROAS</th>
              <th className="text-right px-4 py-3 font-medium text-xs">Lucro</th>
              <th className="text-right px-4 py-3 font-medium text-xs">Compras</th>
              <th className="text-center px-4 py-3 font-medium text-xs">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((c) => {
              const alert = getCampaignAlert(c);
              const cpaAboveMeta = c.purchases > 0 && c.costPerPurchase > c.cpaMeta * 1.2;
              const isActive = c.status === 'active' || c.status === 'scaling';
              return (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-medium max-w-[250px] truncate">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      isActive
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {isActive ? "ATIVO" : "PAUSADO"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={alert} /></td>
                  <td className="text-right px-4 py-3 text-muted-foreground">{formatCurrency(c.spend)}</td>
                  <td className={`text-right px-4 py-3 font-medium ${cpaAboveMeta ? 'text-destructive' : 'text-foreground'}`}>
                    {c.purchases > 0 ? formatCurrency(c.costPerPurchase) : '—'}
                    {cpaAboveMeta && <span className="text-xs ml-1">⚠</span>}
                  </td>
                  <td className={`text-right px-4 py-3 font-semibold ${c.roi > 3 ? 'text-success' : c.roi > 1 ? 'text-foreground' : 'text-destructive'}`}>
                    {c.roi > 0 ? `${c.roi.toFixed(2)}x` : '—'}
                  </td>
                  <td className={`text-right px-4 py-3 font-semibold ${c.profit > 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(c.profit)}
                  </td>
                  <td className="text-right px-4 py-3">{c.purchases}</td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handlePause(c.id)}
                        disabled={c.status === 'paused'}
                        className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30"
                        title="Pausar"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleScale(c.id)}
                        disabled={disableScale || (alert !== 'escalando' && alert !== 'lucrativa')}
                        className="p-1.5 rounded-md hover:bg-success/10 hover:text-success transition-colors disabled:opacity-30"
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
      </div>
    </motion.div>
  );
}
