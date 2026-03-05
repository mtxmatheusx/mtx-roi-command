import { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { mockCreatives, Creative, formatCurrency } from "@/lib/mockData";
import { useMetaAds, DateRange, MetaCreative } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { Star, Video, Image, LayoutGrid, Loader2, AlertTriangle, RefreshCw, Upload, Trash2, FileText, ScanSearch, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DateRangePicker from "@/components/DateRangePicker";
import CreativeFactory from "@/components/CreativeFactory";

const typeIcon = { video: Video, image: Image, carousel: LayoutGrid };
const statusConfig = {
  winner: { label: "Winner", className: "bg-success/10 text-success" },
  testing: { label: "Testando", className: "bg-warning/10 text-warning" },
  saturated: { label: "Saturado", className: "bg-destructive/10 text-destructive" },
};

function getCreativeStatus(roas: number, spend: number): Creative["status"] {
  if (roas >= 3 && spend > 100) return "winner";
  if (roas < 1 && spend > 50) return "saturated";
  return "testing";
}

type CreativeAsset = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
};

export default function CriativosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { adAccountId, cpaMeta, ticketMedio, metaAccessToken, activeProfile } = useClientProfiles();

  const [dateRange, setDateRange] = useState<DateRange>({
    since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
    until: format(new Date(), "yyyy-MM-dd"),
  });

  const { creatives, isLoading, isUsingMock, forceRefetch, fetchedAt, previous } = useMetaAds(dateRange, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [assetDescription, setAssetDescription] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ total_found: number; total_saved: number } | null>(null);

  // Fetch creative assets from DB
  const { data: assets = [] } = useQuery({
    queryKey: ["creative_assets", activeProfile?.id],
    queryFn: async () => {
      if (!user?.id || !activeProfile?.id) return [];
      const { data, error } = await supabase
        .from("creative_assets")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CreativeAsset[];
    },
    enabled: !!user?.id && !!activeProfile?.id,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !activeProfile?.id) return;

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 20MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("creative-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("creative-assets")
        .getPublicUrl(filePath);

      const fileType = file.type.startsWith("video") ? "video" : "image";

      const { error: dbError } = await supabase.from("creative_assets").insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileType,
        description: assetDescription || null,
      });

      if (dbError) throw dbError;

      toast({ title: "✅ Arquivo enviado!", description: file.name });
      setAssetDescription("");
      queryClient.invalidateQueries({ queryKey: ["creative_assets", activeProfile.id] });
    } catch (err) {
      toast({ title: "Erro no upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAsset = async (asset: CreativeAsset) => {
    try {
      const urlParts = asset.file_url.split("/creative-assets/");
      if (urlParts[1]) {
        await supabase.storage.from("creative-assets").remove([urlParts[1]]);
      }
      await supabase.from("creative_assets").delete().eq("id", asset.id);
      queryClient.invalidateQueries({ queryKey: ["creative_assets", activeProfile?.id] });
      toast({ title: "Arquivo removido" });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleScrapeMedia = async () => {
    if (!scrapeUrl || !user?.id || !activeProfile?.id) return;
    setIsScraping(true);
    setScrapeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-media", {
        body: { url: scrapeUrl, profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setScrapeResult({ total_found: data.total_found, total_saved: data.total_saved });
      toast({ title: `✅ ${data.total_saved} mídias extraídas!`, description: `${data.total_found} encontradas, ${data.total_saved} salvas.` });
      queryClient.invalidateQueries({ queryKey: ["creative_assets", activeProfile.id] });
      setScrapeUrl("");
    } catch (err) {
      toast({ title: "Erro na extração", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsScraping(false);
    }
  };

  // Compute average ROAS from previous period for fatigue detection
  const prevAvgRoas = previous && previous.roas ? previous.roas : null;

  const displayCreatives: Array<{
    id: string; name: string; type: "video" | "image" | "carousel";
    status: Creative["status"]; spend: number; roas: number; ctr: number;
    purchases: number; purchaseValue: number; thumbnailUrl?: string | null;
    isFatigued: boolean;
  }> = creatives.length > 0
    ? creatives.map((c, i) => ({
        id: String(i + 1), name: c.adName, type: "video" as const,
        status: getCreativeStatus(c.roas, c.spend), spend: c.spend, roas: c.roas,
        ctr: c.ctr, purchases: c.purchases, purchaseValue: c.purchaseValue,
        thumbnailUrl: c.thumbnailUrl,
        isFatigued: prevAvgRoas !== null && prevAvgRoas > 0 && c.roas < prevAvgRoas * 0.75 && c.spend > 50,
      }))
    : mockCreatives.map((c) => ({
        id: c.id, name: c.name, type: c.type, status: c.status,
        spend: 0, roas: 0, ctr: c.ctr, purchases: c.conversions, purchaseValue: 0,
        thumbnailUrl: null, isFatigued: false,
      }));

  const [winners, setWinners] = useState<Set<string>>(new Set());
  const toggleWinner = (id: string) => {
    setWinners((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  return (
    <AppLayout>
      <ActiveProfileHeader />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
            Criativos
          </motion.h1>
          <p className="text-muted-foreground mt-1">
            {isUsingMock ? "Dados de demonstração" : "Performance real por anúncio"} · Analise e identifique os melhores performers
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          {fetchedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Última atualização: {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => forceRefetch()} disabled={isLoading} className="gap-2 h-8">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Forçar Atualização
          </Button>
        </div>
      </div>

      {/* Asset Library */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />Biblioteca de Criativos</CardTitle>
          <CardDescription>Envie imagens e vídeos para a IA analisar e sugerir copies alinhadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Descrição do criativo (opcional)"
              value={assetDescription}
              onChange={(e) => setAssetDescription(e.target.value)}
              className="flex-1"
            />
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>

          {assets.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {assets.map((asset) => (
                <div key={asset.id} className="group relative bg-secondary rounded-lg overflow-hidden border border-border">
                  {asset.file_type === "image" ? (
                    <img src={asset.file_url} alt={asset.description || asset.file_name} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-secondary">
                      <Video className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs truncate font-medium">{asset.file_name}</p>
                    {asset.description && <p className="text-xs text-muted-foreground truncate">{asset.description}</p>}
                    <Badge variant="outline" className="text-[10px] mt-1 px-1 py-0">
                      {(asset as any).source_tag?.startsWith("scraped:") ? "🌐 Scraped" : "📤 Upload"}
                    </Badge>
                  </div>
                  <button
                    onClick={() => handleDeleteAsset(asset)}
                    className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visual Scraper */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><ScanSearch className="w-5 h-5 text-primary" />Extrator Visual Rápido</CardTitle>
          <CardDescription>Cole o link de um e-commerce, landing page ou Instagram para extrair imagens e vídeos automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://loja.com.br/produto ou Instagram URL"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleScrapeMedia} disabled={isScraping || !scrapeUrl} className="gap-2">
              {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              {isScraping ? "Extraindo..." : "Capturar Mídias"}
            </Button>
          </div>
          {isScraping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanner da IA extraindo ativos visuais...
            </div>
          )}
          {scrapeResult && (
            <div className="flex items-center gap-2 text-sm text-success">
              ✅ {scrapeResult.total_found} mídias encontradas, {scrapeResult.total_saved} salvas na biblioteca.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Creative Factory */}
      <CreativeFactory
        winners={displayCreatives
          .filter((c) => c.status === "winner" && c.roas >= 3 && c.spend > 100)
          .map((c) => ({ id: c.id, name: c.name, roas: c.roas, spend: c.spend, thumbnailUrl: c.thumbnailUrl }))}
      />

      {isUsingMock && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong>.
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sincronizando criativos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayCreatives.map((creative, i) => {
            const isWinner = winners.has(creative.id) || creative.status === "winner";
            const sConfig = statusConfig[creative.status];
            const Icon = typeIcon[creative.type] || Video;
            return (
              <motion.div key={creative.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-card rounded-lg border overflow-hidden ${isWinner ? "border-success/30" : "border-border"}`}>
                {/* Thumbnail or placeholder */}
                {creative.thumbnailUrl ? (
                  <div className="h-40 bg-secondary overflow-hidden relative">
                    <img src={creative.thumbnailUrl} alt={creative.name} className="w-full h-full object-cover" />
                    {creative.isFatigued && (
                      <Badge variant="destructive" className="absolute top-2 left-2 text-xs gap-1">
                        ⚠️ POSSÍVEL FADIGA
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="h-40 bg-secondary flex items-center justify-center relative">
                    <Icon className="w-12 h-12 text-muted-foreground/30" />
                    {creative.isFatigued && (
                      <Badge variant="destructive" className="absolute top-2 left-2 text-xs gap-1">
                        ⚠️ POSSÍVEL FADIGA
                      </Badge>
                    )}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1 mr-2"><h3 className="font-semibold text-sm truncate">{creative.name}</h3></div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${sConfig.className}`}>{sConfig.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                      <p className={`text-lg font-bold ${creative.roas > 3 ? "text-neon-green" : creative.roas > 1 ? "text-neon-yellow" : "text-neon-red"}`}>{creative.roas.toFixed(2)}x</p>
                    </div>
                    <div><p className="text-xs text-muted-foreground">CTR</p><p className="text-lg font-bold">{creative.ctr.toFixed(1)}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Compras</p><p className="text-lg font-bold">{creative.purchases}</p></div>
                  </div>
                  {creative.spend > 0 && (
                    <p className="text-xs text-muted-foreground mb-3">Invest: {formatCurrency(creative.spend)} · Receita: {formatCurrency(creative.purchaseValue)}</p>
                  )}
                  <button onClick={() => toggleWinner(creative.id)}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isWinner ? "bg-accent/20 text-neon-green border border-glow-green" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    <Star className={`w-4 h-4 ${isWinner ? "fill-current" : ""}`} />
                    {isWinner ? "Winner" : "Marcar Winner"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
