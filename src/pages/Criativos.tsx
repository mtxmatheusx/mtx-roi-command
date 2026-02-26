import AppLayout from "@/components/AppLayout";
import { mockCreatives, Creative } from "@/lib/mockData";
import { motion } from "framer-motion";
import { useState } from "react";
import { Star, Video, Image, LayoutGrid } from "lucide-react";

const typeIcon = {
  video: Video,
  image: Image,
  carousel: LayoutGrid,
};

const statusConfig = {
  winner: { label: "Winner", className: "bg-neon-green/15 text-neon-green" },
  testing: { label: "Testando", className: "bg-neon-yellow/15 text-neon-yellow" },
  saturated: { label: "Saturado", className: "bg-neon-red/15 text-neon-red" },
};

export default function CriativosPage() {
  const [creatives, setCreatives] = useState(mockCreatives);

  const toggleWinner = (id: string) => {
    setCreatives(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, status: c.status === 'winner' ? 'testing' : 'winner' as Creative['status'] }
          : c
      )
    );
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
          Criativos
        </motion.h1>
        <p className="text-muted-foreground mt-1">Analise hooks e identifique os melhores performers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creatives.map((creative, i) => {
          const Icon = typeIcon[creative.type];
          const sConfig = statusConfig[creative.status];
          return (
            <motion.div
              key={creative.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-card rounded-xl border overflow-hidden ${
                creative.status === 'winner' ? 'border-glow-green glow-green' : 'border-border'
              }`}
            >
              {/* Thumbnail placeholder */}
              <div className="h-40 bg-secondary flex items-center justify-center">
                <Icon className="w-12 h-12 text-muted-foreground/30" />
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{creative.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 italic">{creative.hookText}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${sConfig.className}`}>
                    {sConfig.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Hook Score</p>
                    <p className={`text-lg font-bold ${creative.hookScore > 80 ? 'text-neon-green' : creative.hookScore > 60 ? 'text-neon-yellow' : 'text-neon-red'}`}>
                      {creative.hookScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="text-lg font-bold">{creative.ctr}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Conv.</p>
                    <p className="text-lg font-bold">{creative.conversions}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleWinner(creative.id)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    creative.status === 'winner'
                      ? 'bg-accent/20 text-neon-green border border-glow-green'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Star className={`w-4 h-4 ${creative.status === 'winner' ? 'fill-current' : ''}`} />
                  {creative.status === 'winner' ? 'Winner' : 'Marcar Winner'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </AppLayout>
  );
}
