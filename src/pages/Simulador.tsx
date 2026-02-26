import AppLayout from "@/components/AppLayout";
import ScaleSimulator from "@/components/ScaleSimulator";
import { motion } from "framer-motion";

export default function SimuladorPage() {
  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
          Simulador de Escala
        </motion.h1>
        <p className="text-muted-foreground mt-1">Projete resultados antes de investir</p>
      </div>
      <ScaleSimulator />
    </AppLayout>
  );
}
