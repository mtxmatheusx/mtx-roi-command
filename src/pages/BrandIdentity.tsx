import { useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Palette, Type, Mic, Eye, Sparkles, Loader2, Download, RefreshCw } from "lucide-react";

interface VisualDNA {
  colors?: { primary?: string; secondary?: string; accent?: string; background?: string };
  typography?: { headline?: string; body?: string };
  tone?: string;
  aesthetic?: string;
  summary?: string;
}

export default function BrandIdentity() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const [instagramUrl, setInstagramUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [visualDNA, setVisualDNA] = useState<VisualDNA | null>(null);

  const { data: savedManual } = useQuery({
    queryKey: ["brand_manual", activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return null;
      const { data } = await supabase
        .from("brand_manuals")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!activeProfile?.id,
  });

  const analyzeProfile = async () => {
    if (!instagramUrl.trim()) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram", {
        body: { url: instagramUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dna = data?.visualDNA || data;
      setVisualDNA(dna);

      // Save to database
      if (user?.id && activeProfile?.id) {
        await supabase.from("brand_manuals").insert({
          user_id: user.id,
          profile_id: activeProfile.id,
          visual_dna: dna,
          instagram_username: instagramUrl,
        });
      }

      toast({ title: "Análise concluída!", description: "DNA Visual extraído com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentDNA: VisualDNA | null = visualDNA || (savedManual?.visual_dna as VisualDNA) || null;

  const ColorSwatch = ({ color, label }: { color?: string; label: string }) => (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg border border-border shadow-sm" style={{ backgroundColor: color || "#ccc" }} />
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{color || "N/A"}</p>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analista de Briefing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manual de identidade visual gerado por IA a partir do Instagram</p>
        </div>

        {/* Analyzer Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="URL do perfil do Instagram (ex: https://instagram.com/perfil)"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={analyzeProfile} disabled={isAnalyzing || !instagramUrl.trim()} className="gap-2 shrink-0">
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isAnalyzing ? "Analisando..." : "Analisar Perfil"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {currentDNA ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Colors */}
            <Card className="glass-card-interactive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Paleta de Cores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ColorSwatch color={currentDNA.colors?.primary} label="Primária" />
                <ColorSwatch color={currentDNA.colors?.secondary} label="Secundária" />
                <ColorSwatch color={currentDNA.colors?.accent} label="Acento" />
                <ColorSwatch color={currentDNA.colors?.background} label="Fundo" />
              </CardContent>
            </Card>

            {/* Typography */}
            <Card className="glass-card-interactive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Type className="w-4 h-4 text-primary" /> Tipografia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Headline</p>
                  <p className="text-lg font-bold" style={{ fontFamily: currentDNA.typography?.headline }}>
                    {currentDNA.typography?.headline || "Sem dados"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Body</p>
                  <p className="text-sm" style={{ fontFamily: currentDNA.typography?.body }}>
                    {currentDNA.typography?.body || "Sem dados"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tone of Voice */}
            <Card className="glass-card-interactive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Mic className="w-4 h-4 text-primary" /> Tom de Voz</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{currentDNA.tone || "Sem dados"}</p>
              </CardContent>
            </Card>

            {/* Aesthetic */}
            <Card className="glass-card-interactive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Estética</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{currentDNA.aesthetic || "Sem dados"}</p>
              </CardContent>
            </Card>

            {/* Summary */}
            {currentDNA.summary && (
              <Card className="md:col-span-2 glass-card-interactive">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Resumo da Marca</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{currentDNA.summary}</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Palette className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma análise realizada</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                Insira a URL do Instagram do cliente e clique em "Analisar Perfil" para gerar o manual de identidade visual automaticamente.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AppLayout>
  );
}
