import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Share2, Download, Copy, Play, ImageIcon, Wand2, FileText, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VisualDNA } from "@/pages/LaboratorioVisual";
import { motion, AnimatePresence } from "framer-motion";
import ContentPlatformSelector, { Platform, ContentType } from "@/components/ContentPlatformSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
            // Build prompt with UGC character context if selected
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
                // Small delay to avoid rate limiting
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

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Criador de Conteúdo Estratégico
                    </CardTitle>
                    <CardDescription>
                        Escolha plataformas, tipo de conteúdo e a IA criará alinhado ao seu DNA Visual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <Button onClick={handleGenerate} disabled={loading || !theme} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {loading ? "Gerando..." : "Gerar"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {carousel && (
                <>
                    {/* Image Generation Controls */}
                    <Card className="border-dashed">
                        <CardContent className="py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Wand2 className="w-5 h-5 text-primary" />
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
                                    className="gap-2"
                                >
                                    {generatingImages[currentSlide] ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <ImageIcon className="w-3 h-3" />
                                    )}
                                    Slide Atual
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={generateAllImages}
                                    disabled={generatingAll || generatedCount === totalSlides}
                                    className="gap-2"
                                >
                                    {generatingAll ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-3 h-3" />
                                    )}
                                    {generatingAll ? "Gerando..." : "Gerar Todas"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Mobile Preview Style Carousel */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-[320px] h-[400px] bg-background rounded-[40px] border-[8px] border-secondary shadow-2xl overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-8 flex justify-center pt-2 z-10">
                                    <div className="w-16 h-1 rounded-full bg-secondary/30" />
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentSlide}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                        className="w-full h-full p-6 flex flex-col justify-between relative overflow-hidden"
                                        style={{
                                            backgroundColor: visualDNA.palette[0] || "#000",
                                            color: "#fff",
                                        }}
                                    >
                                        {/* Background decorative element */}
                                        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white/5 blur-3xl" />

                                        <div className="space-y-4 pt-4">
                                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
                                                {carousel.slides[currentSlide].type} · {currentSlide + 1}/{carousel.slides.length}
                                            </span>
                                            <h2
                                                className="text-2xl font-black leading-tight"
                                                style={{
                                                    fontFamily: visualDNA.typography.includes("Serif") ? "serif" : "sans-serif",
                                                }}
                                            >
                                                {carousel.slides[currentSlide].headline}
                                            </h2>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-sm opacity-90 leading-relaxed font-medium">
                                                {carousel.slides[currentSlide].body}
                                            </p>

                                            {/* Image area */}
                                            <div className="w-full h-24 rounded-lg overflow-hidden border border-white/20 flex items-center justify-center relative">
                                                {generatingImages[currentSlide] ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="w-5 h-5 animate-spin opacity-40" />
                                                        <span className="text-[10px] opacity-40">Gerando...</span>
                                                    </div>
                                                ) : slideImages[currentSlide] ? (
                                                    <img
                                                        src={slideImages[currentSlide]}
                                                        alt={carousel.slides[currentSlide].headline}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => generateImageForSlide(currentSlide)}
                                                        className="flex flex-col items-center gap-1 opacity-30 hover:opacity-60 transition-opacity cursor-pointer"
                                                    >
                                                        <ImageIcon className="w-6 h-6" />
                                                        <span className="text-[9px]">Clique para gerar</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] py-2">
                                            <span className="font-bold opacity-70">@seu-perfil</span>
                                            <div className="flex gap-1">
                                                {carousel.slides.map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                                            i === currentSlide ? "bg-white" : slideImages[i] ? "bg-white/60" : "bg-white/30"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full h-12 w-12"
                                    onClick={prevSlide}
                                    disabled={currentSlide === 0}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full h-12 w-12"
                                    onClick={nextSlide}
                                    disabled={currentSlide === carousel.slides.length - 1}
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </Button>
                            </div>
                        </div>

                        {/* Prompt Side / Copy Side */}
                        <Card className="h-fit">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Roteiro & Prompts</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 rounded-lg bg-secondary/50 border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase text-primary">Copy do Slide {currentSlide + 1}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <p className="text-sm italic">"{carousel.slides[currentSlide].body}"</p>
                                </div>

                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Play className="w-3 h-3 text-primary" />
                                            <span className="text-xs font-bold uppercase">Prompt para Imagem IA</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <Download className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="bg-background/80 p-3 rounded border text-[11px] font-mono leading-relaxed">
                                        {carousel.slides[currentSlide].image_prompt}. {visualDNA.image_prompt_style}. Professional photography, 4k.
                                    </div>
                                </div>

                                {/* Generated image preview */}
                                {slideImages[currentSlide] && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Imagem Gerada</p>
                                        <img
                                            src={slideImages[currentSlide]}
                                            alt={`Slide ${currentSlide + 1}`}
                                            className="w-full rounded-lg border shadow-sm"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 gap-2 text-xs h-9">
                                        <Share2 className="w-3 h-3" /> Exportar
                                    </Button>
                                    <Button variant="outline" className="flex-1 gap-2 text-xs h-9">
                                        <Download className="w-3 h-3" /> Baixar Assets
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Captions Section */}
                        {carousel.captions && Object.keys(carousel.captions).length > 0 && (
                            <Card className="md:col-span-2 h-fit">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            Legendas Prontas para Publicação
                                        </CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowCaptions(!showCaptions)}
                                            className="text-xs"
                                        >
                                            {showCaptions ? "Ocultar" : "Mostrar"}
                                        </Button>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Legendas personalizadas com base no Dossiê do perfil
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
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(caption);
                                                            toast({ title: "Copiado!", description: `Legenda ${platform} copiada.` });
                                                        }}
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                                <div className="p-3 rounded-lg bg-secondary/50 border text-sm whitespace-pre-wrap leading-relaxed">
                                                    {caption}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                )}
                            </Card>
                        )}
                    </div>
                </>
            )}

            {loading && (
                <Card className="border-dashed py-20">
                    <CardContent className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="font-semibold">Criando Estratégia...</p>
                            <p className="text-xs text-muted-foreground italic">"O segredo do carrossel é o gancho no primeiro slide..."</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
