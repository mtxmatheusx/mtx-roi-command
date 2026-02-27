import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCopy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Cena {
  tempo: string;
  visual: string;
  audio: string;
}

interface VSLScriptBoardProps {
  titulo: string;
  cenas: Cena[];
}

export default function VSLScriptBoard({ titulo, cenas }: VSLScriptBoardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const formatPlainText = () => {
    return cenas
      .map((c) => `[${c.tempo}] VISUAL: ${c.visual} | ÁUDIO: ${c.audio}`)
      .join("\n\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatPlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "📋 Copiado!", description: "Roteiro copiado para a área de transferência." });
    } catch {
      toast({ title: "Erro", description: "Falha ao copiar.", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([`${titulo}\n${"=".repeat(titulo.length)}\n\n${formatPlainText()}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground">{titulo}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
            {copied ? "Copiado!" : "Copiar Roteiro"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Baixar TXT
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {cenas.map((cena, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="rounded-lg border border-border bg-card/50 overflow-hidden"
          >
            <div className="px-4 py-2 border-b border-border bg-secondary/30">
              <Badge variant="outline" className="text-xs font-mono">⏱️ {cena.tempo}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-4 bg-secondary/10">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">🎥 VISUAL</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{cena.visual}</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">🎙️ ÁUDIO</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-medium">{cena.audio}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
