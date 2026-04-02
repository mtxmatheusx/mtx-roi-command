import { useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import { Zap } from "lucide-react";

interface ScaleSimulatorProps {
  initialCpa?: number;
  initialTicket?: number;
}

export default function ScaleSimulator({ initialCpa = 200, initialTicket = 697 }: ScaleSimulatorProps) {
  const [budget, setBudget] = useState(5000);
  const [cpa, setCpa] = useState(initialCpa);
  const ticket = initialTicket;

  const purchases = Math.floor(budget / cpa);
  const revenue = purchases * ticket;
  const profit = revenue - budget;
  const roi = budget > 0 ? revenue / budget : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="liquid-glass"
    >
      <div className="lg-distortion" />
      <div className="lg-overlay" />
      <div className="lg-specular" />
      <div className="lg-content">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Simulador de Escala</h2>
            <p className="text-sm text-muted-foreground">Projeção baseada no ticket de {formatCurrency(ticket)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Orçamento Diário</label>
            <input type="range" min={500} max={50000} step={500} value={budget}
              onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-primary" />
            <p className="text-2xl font-semibold mt-2">{formatCurrency(budget)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">CPA Estimado</label>
            <input type="range" min={50} max={500} step={10} value={cpa}
              onChange={(e) => setCpa(Number(e.target.value))} className="w-full accent-primary" />
            <p className="text-2xl font-semibold mt-2">{formatCurrency(cpa)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="liquid-glass">
            <div className="lg-overlay" />
            <div className="lg-specular" />
            <div className="lg-content">
              <p className="text-xs text-muted-foreground mb-1">Vendas Previstas</p>
              <p className="text-2xl font-semibold">{purchases}</p>
            </div>
          </div>
          <div className="liquid-glass">
            <div className="lg-overlay" />
            <div className="lg-specular" />
            <div className="lg-content">
              <p className="text-xs text-muted-foreground mb-1">Receita</p>
              <p className="text-2xl font-semibold">{formatCurrency(revenue)}</p>
            </div>
          </div>
          <div className={`liquid-glass ${profit > 0 ? '' : ''}`}>
            <div className="lg-overlay" />
            <div className="lg-specular" />
            <div className="lg-content">
              <p className="text-xs text-muted-foreground mb-1">Lucro Líquido</p>
              <p className={`text-2xl font-semibold ${profit > 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(profit)}</p>
            </div>
          </div>
          <div className="liquid-glass">
            <div className="lg-overlay" />
            <div className="lg-specular" />
            <div className="lg-content">
              <p className="text-xs text-muted-foreground mb-1">ROAS</p>
              <p className={`text-2xl font-semibold ${roi > 3 ? 'text-success' : roi > 1 ? 'text-foreground' : 'text-destructive'}`}>{roi.toFixed(2)}x</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
