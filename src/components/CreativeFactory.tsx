import { useState, useCallback, useRef, useEffect } from "react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Rocket, Trophy, ImageOff, Brain, Upload, X, Users } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";

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

interface UGCCharacter {
  id: string;
  name: string;
  fixed_description: string;
  image_references: string[];
}

export default function CreativeFactory({ winners }: CreativeFactoryProps) {
  const { activeProfile } = useClientProfiles();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stage 1: Art Direction
  const [rawIdea, setRawIdea] = useState("");
  const [isElaborating, setIsElaborating] = useState(false);
  const [generationStyle, setGenerationStyle] = useState<"photorealistic" | "stylized">("photorealistic");

  // Reference image
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Stage 2: Generation
  const [masterPrompt, setMasterPrompt] = useState("");
  const [quantity, setQuantity] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState<GeneratedAsset[]>([]);

  // UGC Characters
  const [ugcCharacters, setUgcCharacters] = useState<UGCCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  useEffect(() => {
    if (activeProfile?.id && user?.id) {
      supabase
        .from("ugc_characters")
        .select("id, name, fixed_description, image_references")
        .eq("profile_id", activeProfile.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (data) setUgcCharacters(data as UGCCharacter[]);
        });
    }
  }, [activeProfile?.id, user?.id]);

  const selectedCharacter = ugcCharacters.find(c => c.id === selectedCharacterId) || null;

  const uploadReferenceImage = useCallback(async (file: File) => {
    if (!activeProfile?.id || !user?.id) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `references/${activeProfile.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("creative-assets").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("creative-assets").getPublicUrl(path);
      setReferenceImageUrl(publicUrl);
      setReferencePreview(URL.createObjectURL(file));
    } catch (err) {
      toast({ title: "Erro no upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [activeProfile, user, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadReferenceImage(file);
  }, [uploadReferenceImage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadReferenceImage(file);
  }, [uploadReferenceImage]);

  const removeReference = () => {
    setReferenceImageUrl(null);
    setReferencePreview(null);
  };

  // Stage 1: Elaborate Art Direction
  const handleElaborate = async () => {
    if (!activeProfile?.id || !rawIdea.trim()) return;
    setIsElaborating(true);
    setMasterPrompt("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-master-prompt", {
        body: { profileId: activeProfile.id, rawIdea: rawIdea.trim(), referenceImageUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      let prompt = data.masterPrompt || "";
      // Prepend UGC character description if selected
      if (selectedCharacter) {
        prompt = `[PERSONAGEM UGC — Descrição Física Fixa]\n${selectedCharacter.fixed_description}\n\n${prompt}`;
      }
      setMasterPrompt(prompt);
    } catch (err) {
      toast({ title: "Erro na direção de arte", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsElaborating(false);
    }
  };

  // Stage 2: Forge Creative
  const handleForge = async () => {
    if (!activeProfile?.id || !user?.id || !masterPrompt.trim()) return;
    setIsGenerating(true);
    setProgress(10);
    setGenerated([]);
    try {
      const progressInterval = setInterval(() => setProgress((p) => Math.min(p + 6, 88)), 2500);

      // Use character's first image reference if available
      const refImage = selectedCharacter?.image_references?.[0] || referenceImageUrl;

      const { data, error } = await supabase.functions.invoke("generate-hyper-creative", {
        body: { profileId: activeProfile.id, quantity, masterPrompt: masterPrompt.trim(), referenceImageUrl: refImage },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGenerated(data.generated || []);
      toast({ title: `🎨 ${data.total} criativo(s) forjado(s)!` });
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
            <Trophy className="w-5 h-5 text-success" />
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
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-success border-success/20">
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

      {/* Right: Visual Forge */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            ⚒️ Visual Forge
            <span className="text-sm font-normal text-muted-foreground">(Diretor de Arte IA)</span>
          </CardTitle>
          <CardDescription>Fluxo de 2 etapas com human-in-the-loop para criativos de alta conversão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* UGC Character Selector */}
          {ugcCharacters.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">👤 Selecionar Personagem UGC</label>
              <Select
                value={selectedCharacterId || "none"}
                onValueChange={(v) => setSelectedCharacterId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum personagem selecionado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {ugcCharacters.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <Users className="w-3 h-3" /> {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCharacter && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-primary/15 text-primary text-xs gap-1">
                    <Users className="w-3 h-3" /> Modo Consistência Ativado
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">{selectedCharacter.fixed_description.slice(0, 60)}...</span>
                </div>
              )}
            </div>
          )}

          {/* Drop Zone */}
          <div>
            <label className="text-sm font-medium mb-2 block">Imagem de referência (opcional)</label>
            {referencePreview ? (
              <div className="relative inline-block">
                <img src={referencePreview} alt="Referência" className="h-24 rounded-lg border border-border object-cover" />
                <button
                  onClick={removeReference}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                  ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/10"}
                  hover:border-muted-foreground/40`}
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-xs text-muted-foreground">Arraste uma imagem JPG/PNG/WEBP ou clique</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Stage 1: Raw Idea */}
          <div>
            <label className="text-sm font-medium mb-2 block">Qual é a ideia da campanha?</label>
            <Input
              placeholder="Ex: Mulher usando blazer preto, coleção de inverno, transmitindo poder"
              value={rawIdea}
              onChange={(e) => setRawIdea(e.target.value)}
            />
          </div>

          <Button
            onClick={handleElaborate}
            disabled={isElaborating || !rawIdea.trim() || !activeProfile?.id}
            className="w-full gap-2"
            variant="secondary"
          >
            {isElaborating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            🧠 Elaborar Direção de Arte
          </Button>

          {/* Skeleton loader while elaborating */}
          {isElaborating && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          )}

          {/* Stage 2: Master Prompt */}
          {masterPrompt && !isElaborating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Prompt Mestre (editável)</label>
                <Textarea
                  value={masterPrompt}
                  onChange={(e) => setMasterPrompt(e.target.value)}
                  className="min-h-[200px] bg-[hsl(var(--card))] border-border font-mono text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Quantidade: {quantity} imagem(ns)</label>
                <Slider value={[quantity]} onValueChange={(v) => setQuantity(v[0])} min={1} max={4} step={1} />
              </div>

              <Button
                onClick={handleForge}
                disabled={isGenerating || !masterPrompt.trim() || !activeProfile?.id}
                className="w-full gap-2 h-12 text-base"
                size="lg"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isGenerating ? "Forjando..." : `🎨 Forjar Criativo (Gerar ${quantity} Imagem)`}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {progress < 30
                      ? "Analisando referência visual..."
                      : progress < 60
                        ? "Renderizando fotorrealismo e aplicando paleta de alta conversão..."
                        : progress < 88
                          ? "Gerando imagens com IA..."
                          : "Salvando na biblioteca..."}
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
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
