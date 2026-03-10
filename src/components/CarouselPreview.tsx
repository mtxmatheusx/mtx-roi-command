import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Share2, Download, Copy, Play, ImageIcon, Wand2, FileText, Users, FolderOpen, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VisualDNA } from "@/pages/LaboratorioVisual";
import { motion, AnimatePresence } from "framer-motion";
import ContentPlatformSelector, { Platform, ContentType } from "@/components/ContentPlatformSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CreativeAsset {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    description: string | null;
}

interface UGCCharacter {
    id: string;
    name: string;
    fixed_description: string;
    image_references: string[] | null;
}

interface CarouselPreviewProps {
    visualDNA: VisualDNA;
}

type CarouselSlide = {
    headline: string;
    body: string;
    image_prompt: string;
    type: "hook" | "value" | "solution" | "cta";
};

type CarouselData = {
    title: string;
    slides: CarouselSlide[];
    captions?: Record<string, string>;
};

const slideTypeConfig: Record<string, { label: string; color: string }> = {
    hook: { label: "HOOK", color: "bg-red-500/90" },
    value: { label: "VALOR", color: "bg-blue-500/90" },
    solution: { label: "SOLUÇÃO", color: "bg-emerald-500/90" },
    cta: { label: "CTA", color: "bg-amber-500/90" },
};

export default function CarouselPreview({ visualDNA }: CarouselPreviewProps) {
    const [theme, setTheme] = useState("");
    const [loading, setLoading] = useState(false);
    const [carousel, setCarousel] = useState<CarouselData | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slideImages, setSlideImages] = useState<Record<number, string>>({});
    const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
    const [generatingAll, setGeneratingAll] = useState(false);
    const [platforms, setPlatforms] = useState<Platform[]>(["instagram"]);
    const [contentType, setContentType] = useState<ContentType>("carousel");
    const [showCaptions, setShowCaptions] = useState(false);
    const [ugcCharacters, setUgcCharacters] = useState<UGCCharacter[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
    const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [libraryTarget, setLibraryTarget] = useState<number>(0);
    const [expandedPreview, setExpandedPreview] = useState(false);
    const { toast } = useToast();
    const { activeProfile } = useClientProfiles();
    const { user } = useAuth();

    // Load UGC characters
    useEffect(() => {
        if (!user?.id || !activeProfile?.id) return;
        const load = async () => {
            const { data } = await supabase
                .from("ugc_characters")
                .select("id, name, fixed_description, image_references")
                .eq("user_id", user.id)
                .eq("profile_id", activeProfile.id);
            if (data) setUgcCharacters(data);
        };
        load();
    }, [user?.id, activeProfile?.id]);

    // Load creative assets from library
    useEffect(() => {
        if (!user?.id || !activeProfile?.id) return;
        const load = async () => {
            const { data } = await supabase
                .from("creative_assets")
                .select("id, file_url, file_name, file_type, description")
                .eq("user_id", user.id)
                .eq("profile_id", activeProfile.id)
                .order("created_at", { ascending: false });
            if (data) setCreativeAssets(data.filter(a => a.file_type.startsWith("image")));
        };
        load();
    }, [user?.id, activeProfile?.id]);

    const useLibraryImage = (slideIndex: number, url: string) => {
        setSlideImages((prev) => ({ ...prev, [slideIndex]: url }));
        setShowLibrary(false);
        toast({ title: "✅ Imagem aplicada", description: `Imagem da biblioteca aplicada ao slide ${slideIndex + 1}.` });
    };

    const handleGenerate = async () => {
        if (!theme) return;
        setLoading(true);
        setCarousel(null);
        setSlideImages({});
        setGeneratingImages({});

        try {
            const { data, error } = await supabase.functions.invoke("generate-carousel", {
                body: { visualDNA, theme, platforms, contentType, profileId: activeProfile?.id },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setCarousel(data.data as CarouselData);
            setCurrentSlide(0);
            toast({
                title: "✨ Carrossel Gerado!",
                description: "Clique em 'Gerar Imagens' para criar visuais com IA.",
            });
        } catch (err) {
            toast({
                title: "Erro na geração",
                description: (err as Error).message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const generateImageForSlide = async (slideIndex: number) => {
        if (!carousel) return;
        const slide = carousel.slides[slideIndex];

        setGeneratingImages((prev) => ({ ...prev, [slideIndex]: true }));

        try {
            const selectedChar = selectedCharacterId && selectedCharacterId !== "none"
                ? ugcCharacters.find(c => c.id === selectedCharacterId)
                : null;
            
            let fullPrompt = `${slide.image_prompt}. ${visualDNA.image_prompt_style}`;
            if (selectedChar) {
                fullPrompt += `. The person in the image: ${selectedChar.fixed_description}`;
            }

            const { data, error } = await supabase.functions.invoke("generate-carousel-image", {
                body: {
                    prompt: fullPrompt,
                    visualDNA,
                    ...(selectedChar?.image_references?.[0] ? { referenceImageUrl: selectedChar.image_references[0] } : {}),
                },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setSlideImages((prev) => ({ ...prev, [slideIndex]: data.image_url }));
        } catch (err) {
            toast({
                title: `Erro no slide ${slideIndex + 1}`,
                description: (err as Error).message,
                variant: "destructive",
            });
        } finally {
            setGeneratingImages((prev) => ({ ...prev, [slideIndex]: false }));
        }
    };

    const generateAllImages = async () => {
        if (!carousel) return;
        setGeneratingAll(true);

        for (let i = 0; i < carousel.slides.length; i++) {
            if (!slideImages[i]) {
                await generateImageForSlide(i);
                if (i < carousel.slides.length - 1) {
                    await new Promise((r) => setTimeout(r, 1500));
                }
            }
        }

        setGeneratingAll(false);
        toast({
            title: "🎨 Imagens Geradas!",
            description: "Todas as imagens do carrossel foram criadas com IA.",
        });
    };

    const nextSlide = () => {
        if (carousel && currentSlide < carousel.slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const generatedCount = Object.keys(slideImages).length;
    const totalSlides = carousel?.slides.length || 0;
    const currentSlideData = carousel?.slides[currentSlide];
    const currentTypeConfig = currentSlideData ? slideTypeConfig[currentSlideData.type] || slideTypeConfig.value : null;
    const hasImage = !!slideImages[currentSlide];

    return (
        <div className="space-y-6">
            {/* Creator Header */}
            <Card className="glass-card border-primary/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
                <CardHeader className="pb-4 relative">
                    <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                        Criador de Conteúdo Estratégico
                    </CardTitle>
                    <CardDescription>
                        Escolha plataformas, tipo de conteúdo e a IA criará alinhado ao seu DNA Visual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 relative">
                    <ContentPlatformSelector
                        platforms={platforms}
                        onPlatformsChange={setPlatforms}
                        contentType={contentType}
                        onContentTypeChange={setContentType}
                    />
                    {ugcCharacters.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
                                <SelectTrigger className="flex-1 h-9 text-xs">
                                    <SelectValue placeholder="Personagem UGC (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum personagem</SelectItem>
                                    {ugcCharacters.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Ex: 5 erros comuns no tráfego pago..."
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="flex-1"
                            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                        />
                        <Button onClick={handleGenerate} disabled={loading || !theme} className="gap-2 shadow-md">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {loading ? "Gerando..." : "Gerar"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {carousel && currentSlideData && (
                <>
                    {/* Image Generation Controls */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Wand2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Gerador de Imagens IA</p>
                                <p className="text-xs text-muted-foreground">
                                    {generatedCount}/{totalSlides} imagens geradas
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateImageForSlide(currentSlide)}
                                disabled={generatingImages[currentSlide] || generatingAll}
                                className="gap-2 rounded-xl"
                            >
                                {generatingImages[currentSlide] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ImageIcon className="w-3.5 h-3.5" />
                                )}
                                Slide Atual
                            </Button>
                            <Button
                                size="sm"
                                onClick={generateAllImages}
                                disabled={generatingAll || generatedCount === totalSlides}
                                className="gap-2 rounded-xl shadow-md"
                            >
                                {generatingAll ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Wand2 className="w-3.5 h-3.5" />
                                )}
                                {generatingAll ? "Gerando..." : "Gerar Todas"}
                            </Button>
                            {creativeAssets.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setLibraryTarget(currentSlide); setShowLibrary(true); }}
                                    className="gap-2 rounded-xl"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    Biblioteca
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                        {/* Premium Mobile Preview */}
                        <div className="lg:col-span-3 flex flex-col items-center">
                            <div className="relative w-full max-w-[380px]">
                                {/* Phone Frame */}
                                <div className="relative bg-foreground/5 rounded-[3rem] p-[10px] shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] ring-1 ring-border/30">
                                    {/* Inner Screen */}
                                    <div className="relative rounded-[2.2rem] overflow-hidden aspect-[9/16] bg-black">
                                        {/* Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-30" />
                                        
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={currentSlide}
                                                initial={{ opacity: 0, scale: 1.02 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                                className="w-full h-full relative"
                                            >
                                                {/* Full Background Image */}
                                                {hasImage && (
                                                    <img
                                                        src={slideImages[currentSlide]}
                                                        alt={currentSlideData.headline}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                    />
                                                )}

                                                {/* Gradient Overlay for text readability */}
                                                <div 
                                                    className="absolute inset-0 z-10"
                                                    style={{
                                                        background: hasImage
                                                            ? "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)"
                                                            : `linear-gradient(160deg, ${visualDNA.palette[0] || "#1a1a2e"} 0%, ${visualDNA.palette[1] || "#16213e"} 50%, ${visualDNA.palette[2] || "#0f3460"} 100%)`,
                                                    }}
                                                />

                                                {/* No-image decorative elements */}
                                                {!hasImage && (
                                                    <>
                                                        <div className="absolute top-1/4 right-0 w-64 h-64 rounded-full blur-[80px] z-[5]" style={{ backgroundColor: `${visualDNA.palette[1] || "#e94560"}30` }} />
                                                        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] z-[5]" style={{ backgroundColor: `${visualDNA.palette[2] || "#533483"}20` }} />
                                                    </>
                                                )}

                                                {/* Content Layer */}
                                                <div className="relative z-20 w-full h-full flex flex-col justify-between p-6 pt-12">
                                                    {/* Top: Badge + Headline */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            {currentTypeConfig && (
                                                                <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full text-white ${currentTypeConfig.color} backdrop-blur-sm`}>
                                                                    {currentTypeConfig.label}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-white/50 font-medium">
                                                                {currentSlide + 1}/{carousel.slides.length}
                                                            </span>
                                                        </div>
                                                        <h2
                                                            className="text-[1.65rem] font-black leading-[1.15] text-white drop-shadow-lg"
                                                            style={{
                                                                fontFamily: visualDNA.typography.includes("Serif") ? "'Playfair Display', serif" : "'DM Sans', sans-serif",
                                                            }}
                                                        >
                                                            {currentSlideData.headline}
                                                        </h2>
                                                    </div>

                                                    {/* Bottom: Body + Navigation */}
                                                    <div className="space-y-5">
                                                        <p className="text-[13px] text-white/85 leading-relaxed font-medium tracking-wide">
                                                            {currentSlideData.body}
                                                        </p>

                                                        {/* Image generation placeholder */}
                                                        {!hasImage && !generatingImages[currentSlide] && (
                                                            <button
                                                                onClick={() => generateImageForSlide(currentSlide)}
                                                                className="w-full py-4 rounded-2xl border border-dashed border-white/20 flex flex-col items-center gap-2 text-white/30 hover:text-white/60 hover:border-white/40 transition-all duration-300 cursor-pointer backdrop-blur-sm bg-white/5"
                                                            >
                                                                <ImageIcon className="w-6 h-6" />
                                                                <span className="text-[10px] font-medium tracking-wide">GERAR IMAGEM COM IA</span>
                                                            </button>
                                                        )}

                                                        {generatingImages[currentSlide] && (
                                                            <div className="w-full py-5 rounded-2xl border border-white/10 flex items-center justify-center gap-3 backdrop-blur-sm bg-white/5">
                                                                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                                                                <span className="text-[11px] text-white/40 font-medium">Gerando imagem...</span>
                                                            </div>
                                                        )}

                                                        {/* Bottom bar */}
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-[10px] font-bold text-white/40 tracking-wider">@{activeProfile?.name?.toLowerCase().replace(/\s/g, '') || "perfil"}</span>
                                                            <div className="flex gap-[5px]">
                                                                {carousel.slides.map((_, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => setCurrentSlide(i)}
                                                                        className={`rounded-full transition-all duration-300 cursor-pointer ${
                                                                            i === currentSlide 
                                                                                ? "w-5 h-[5px] bg-white" 
                                                                                : slideImages[i] 
                                                                                    ? "w-[5px] h-[5px] bg-white/50" 
                                                                                    : "w-[5px] h-[5px] bg-white/20"
                                                                        }`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Expand button */}
                                {hasImage && (
                                    <button 
                                        onClick={() => setExpandedPreview(true)}
                                        className="absolute top-5 right-5 z-30 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
                                    >
                                        <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center gap-6 mt-8">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full h-11 w-11 border-border/50 shadow-sm hover:shadow-md transition-shadow"
                                    onClick={prevSlide}
                                    disabled={currentSlide === 0}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                                    {currentSlide + 1} / {carousel.slides.length}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full h-11 w-11 border-border/50 shadow-sm hover:shadow-md transition-shadow"
                                    onClick={nextSlide}
                                    disabled={currentSlide === carousel.slides.length - 1}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Slide Thumbnails Strip */}
                            <div className="flex gap-2 mt-5 overflow-x-auto pb-2 max-w-[380px]">
                                {carousel.slides.map((slide, i) => {
                                    const typeConf = slideTypeConfig[slide.type] || slideTypeConfig.value;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentSlide(i)}
                                            className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                                                i === currentSlide 
                                                    ? "border-primary shadow-lg scale-105" 
                                                    : "border-border/30 opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            {slideImages[i] ? (
                                                <img src={slideImages[i]} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div 
                                                    className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white/70"
                                                    style={{ backgroundColor: visualDNA.palette[0] || "#1a1a2e" }}
                                                >
                                                    {i + 1}
                                                </div>
                                            )}
                                            <div className={`absolute bottom-0 left-0 right-0 h-1 ${typeConf.color}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Panel: Roteiro & Prompts */}
                        <div className="lg:col-span-2 space-y-5">
                            <Card className="border-border/50 shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold">Roteiro & Prompts</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {/* Copy Section */}
                                    <div className="p-4 rounded-xl bg-secondary/40 border border-border/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {currentTypeConfig && (
                                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md text-white ${currentTypeConfig.color}`}>
                                                        {currentTypeConfig.label}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-primary">COPY SLIDE {currentSlide + 1}</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${currentSlideData.headline}\n\n${currentSlideData.body}`);
                                                    toast({ title: "Copiado!", description: "Copy do slide copiada." });
                                                }}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <p className="text-sm font-semibold leading-snug">{currentSlideData.headline}</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{currentSlideData.body}</p>
                                    </div>

                                    {/* Image Prompt */}
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Play className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-xs font-bold uppercase">Prompt para Imagem IA</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${currentSlideData.image_prompt}. ${visualDNA.image_prompt_style}. Professional photography, 4k.`);
                                                    toast({ title: "Copiado!", description: "Prompt copiado." });
                                                }}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="bg-background/80 p-3 rounded-lg border border-border/30 text-[11px] font-mono leading-relaxed text-muted-foreground">
                                            {currentSlideData.image_prompt}. {visualDNA.image_prompt_style}. Professional photography, 4k.
                                        </div>
                                    </div>

                                    {/* Generated image preview */}
                                    {hasImage && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold uppercase text-muted-foreground">Imagem Gerada</p>
                                            <img
                                                src={slideImages[currentSlide]}
                                                alt={`Slide ${currentSlide + 1}`}
                                                className="w-full rounded-xl border border-border/30 shadow-sm"
                                            />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 gap-2 text-xs h-9 rounded-xl">
                                            <Share2 className="w-3.5 h-3.5" /> Exportar
                                        </Button>
                                        <Button variant="outline" className="flex-1 gap-2 text-xs h-9 rounded-xl">
                                            <Download className="w-3.5 h-3.5" /> Baixar Assets
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Captions Section */}
                            {carousel.captions && Object.keys(carousel.captions).length > 0 && (
                                <Card className="border-border/50 shadow-sm">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-primary" />
                                                Legendas Prontas
                                            </CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowCaptions(!showCaptions)}
                                                className="text-xs rounded-lg"
                                            >
                                                {showCaptions ? "Ocultar" : "Mostrar"}
                                            </Button>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Legendas personalizadas com base no Dossiê
                                        </CardDescription>
                                    </CardHeader>
                                    {showCaptions && (
                                        <CardContent className="space-y-4">
                                            {Object.entries(carousel.captions).map(([platform, caption]) => (
                                                <div key={platform} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold uppercase text-primary">
                                                            {platform === "instagram" ? "📸 Instagram" :
                                                             platform === "tiktok" ? "🎵 TikTok" :
                                                             platform === "linkedin" ? "💼 LinkedIn" :
                                                             platform === "blog" ? "📝 Blog" : platform}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-lg"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(caption);
                                                                toast({ title: "Copiado!", description: `Legenda ${platform} copiada.` });
                                                            }}
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-secondary/40 border border-border/30 text-sm whitespace-pre-wrap leading-relaxed">
                                                        {caption}
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>
                </>
            )}

            {loading && (
                <Card className="border-dashed py-20">
                    <CardContent className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                            <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-semibold">Criando Estratégia...</p>
                            <p className="text-xs text-muted-foreground italic">"O segredo do carrossel é o gancho no primeiro slide..."</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Creative Library Picker Dialog */}
            <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
                <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-primary" />
                            Biblioteca de Criativos — Slide {libraryTarget + 1}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
                        {creativeAssets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => useLibraryImage(libraryTarget, asset.file_url)}
                                className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                            >
                                <img
                                    src={asset.file_url}
                                    alt={asset.file_name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Usar</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {creativeAssets.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">Nenhum criativo na biblioteca.</p>
                    )}
                </DialogContent>
            </Dialog>

            {/* Expanded Image Preview */}
            <Dialog open={expandedPreview} onOpenChange={setExpandedPreview}>
                <DialogContent className="max-w-lg p-2 bg-black border-none">
                    {slideImages[currentSlide] && (
                        <img 
                            src={slideImages[currentSlide]} 
                            alt="Preview ampliado" 
                            className="w-full rounded-lg"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
