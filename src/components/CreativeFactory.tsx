import { useState } from "react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Rocket, Trophy, ImageOff } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import type { Creative } from "@/lib/mockData";

type GeneratedAsset = { url: string; file_name: string; asset_id: string };

interface WinnerCreative {
  id: string;
  name: string;
  roas: number;
  spend: number;
  thumbnailUrl?: string | null;
}

interface CreativeFactoryProps {
  winners: WinnerCreative[];
}

export default function CreativeFactory({ winners }: CreativeFactoryProps) {
  const { activeProfile } = useClientProfiles();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(2);
  const [context, setContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState<GeneratedAsset[]>([]);

  const handleGenerate = async () => {
    if (!activeProfile?.id || !user?.id) return;
    setIsGenerating(true);
    setProgress(10);
    setGenerated([]);

    try {
      // Simulate progress while waiting
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 8, 85));
      }, 2000);

      const { data, error } = await supabase.functions.invoke("generate-hyper-creative", {
        body: { profileId: activeProfile.id, quantity, context },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGenerated(data.generated || []);
      toast({ title: `🎨 ${data.total} criativo(s) gerado(s)!`, description: data.prompt_used?.substring(0, 100) + "..." });
      queryClient.invalidateQueries({ queryKey: ["creative_assets", activeProfile.id] });
    } catch (err) {
      toast({ title: "Erro na geração", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const handleInject = (asset: GeneratedAsset) => {
    if (!activeProfile?.id) return;
    localStorage.setItem(`mtx_injected_creative_${activeProfile.id}`, JSON.stringify(asset));
    toast({ title: "🚀 Criativo injetado!", description: "Será usado na próxima campanha criada." });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
      {/* Left: Winning Library */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-neon-green" />
            Biblioteca Vencedora
          </CardTitle>
          <CardDescription>Criativos com ROAS ≥ 3x e investimento relevante</CardDescription>
        </CardHeader>
        <CardContent>
          {winners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageOff className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum criativo vencedor identificado ainda.</p>
              <p className="text-xs mt-1">Anúncios com ROAS ≥ 3x aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {winners.map((w) => (
                <div key={w.id} className="bg-secondary rounded-lg overflow-hidden border border-border">
                  {w.thumbnailUrl ? (
                    <img src={w.thumbnailUrl} alt={w.name} className="w-full h-20 object-cover" />
                  ) : (
                    <div className="w-full h-20 bg-muted flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{w.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-neon-green border-neon-green/30">
                        {w.roas.toFixed(1)}x
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatCurrency(w.spend)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Autonomous Generator */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerador Autônomo
          </CardTitle>
          <CardDescription>IA gera criativos baseados no dossiê do avatar e direção de arte profissional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">Quantidade: {quantity} imagem(ns)</label>
            <Slider value={[quantity]} onValueChange={(v) => setQuantity(v[0])} min={1} max={4} step={1} className="w-full" />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Contexto da campanha</label>
            <Input
              placeholder="Ex: Black Friday, Coleção de Inverno, Lançamento..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !activeProfile?.id}
            className="w-full gap-2 h-12 text-base"
            size="lg"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {isGenerating ? "Gerando..." : `🎨 Gerar ${quantity} Criativo(s) de Alta Conversão`}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress < 30 ? "Analisando dossiê do avatar..." : progress < 60 ? "Engenharia de prompt visual..." : progress < 85 ? "Gerando imagens com IA..." : "Salvando na biblioteca..."}
              </p>
            </div>
          )}

          {generated.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {generated.map((asset, i) => (
                <motion.div
                  key={asset.asset_id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-secondary rounded-xl overflow-hidden border border-border"
                >
                  <img src={asset.url} alt={asset.file_name} className="w-full aspect-[4/5] object-cover" />
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium truncate">{asset.file_name}</p>
                    <Badge variant="outline" className="text-[10px]">🤖 AI Generated</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1 text-xs"
                      onClick={() => handleInject(asset)}
                    >
                      <Rocket className="w-3 h-3" />
                      Injetar no Meta Ads
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
