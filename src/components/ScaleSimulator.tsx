import { useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import { Zap, TrendingUp, DollarSign } from "lucide-react";

export default function ScaleSimulator() {
  const [budget, setBudget] = useState(5000);
  const [cpa, setCpa] = useState(200);
  const ticket = 697;

  const purchases = Math.floor(budget / cpa);
  const revenue = purchases * ticket;
  const profit = revenue - budget;
  const roi = budget > 0 ? revenue / budget : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Zap className="w-5 h-5 text-neon-red" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Simulador de Escala</h2>
          <p className="text-sm text-muted-foreground">Projeção baseada no ticket de {formatCurrency(ticket)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Orçamento Diário</label>
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-neon-red"
          />
          <p className="text-2xl font-bold mt-2">{formatCurrency(budget)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">CPA Estimado</label>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={cpa}
            onChange={(e) => setCpa(Number(e.target.value))}
            className="w-full accent-neon-red"
          />
          <p className="text-2xl font-bold mt-2">{formatCurrency(cpa)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-secondary rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vendas Previstas</p>
          <p className="text-2xl font-bold">{purchases}</p>
        </div>
        <div className="bg-secondary rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Receita</p>
          <p className="text-2xl font-bold">{formatCurrency(revenue)}</p>
        </div>
        <div className={`rounded-lg p-4 ${profit > 0 ? 'bg-accent/10 glow-green' : 'bg-destructive/10 glow-red'}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Lucro Líquido</p>
          <p className={`text-2xl font-bold ${profit > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{formatCurrency(profit)}</p>
        </div>
        <div className="bg-secondary rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ROAS</p>
          <p className={`text-2xl font-bold ${roi > 3 ? 'text-neon-green' : roi > 1 ? 'text-foreground' : 'text-neon-red'}`}>{roi.toFixed(2)}x</p>
        </div>
      </div>
    </motion.div>
  );
}
