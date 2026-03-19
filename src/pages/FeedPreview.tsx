import { useState, useRef } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Grid3X3, Download, Loader2, Image as ImageIcon, Plus } from "lucide-react";
import { toPng } from "html-to-image";

export default function FeedPreview() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const gridRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["creative_assets_feed", activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data } = await supabase
        .from("creative_assets")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .in("file_type", ["image", "image/png", "image/jpeg", "image/jpg", "image/webp"])
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!activeProfile?.id,
  });

  const exportGrid = async () => {
    if (!gridRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(gridRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#000",
      });
      const link = document.createElement("a");
      link.download = `feed-preview-${activeProfile?.name || "grid"}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Grid exportado!", description: "Imagem PNG salva com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Use up to 9 or 12 images for a clean grid
  const gridImages = assets.slice(0, 12);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Preview do Feed</h1>
            <p className="text-sm text-muted-foreground mt-1">Visualize o grid do Instagram e exporte para Notion</p>
          </div>
          <Button onClick={exportGrid} disabled={isExporting || gridImages.length === 0} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PNG
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-1 max-w-lg mx-auto">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-sm" />
            ))}
          </div>
        ) : gridImages.length > 0 ? (
          <div className="flex flex-col items-center">
            {/* Instagram-style grid */}
            <div
              ref={gridRef}
              className="grid grid-cols-3 gap-[2px] max-w-lg w-full bg-black rounded-lg overflow-hidden"
            >
              {gridImages.map((asset, i) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="aspect-square overflow-hidden group relative"
                >
                  <img
                    src={asset.file_url}
                    alt={asset.file_name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{gridImages.length} imagens · Grid 3 colunas estilo Instagram</p>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Grid3X3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Sem imagens</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                Faça upload de criativos na seção "Criativos" para visualizar o grid do feed aqui.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AppLayout>
  );
}
