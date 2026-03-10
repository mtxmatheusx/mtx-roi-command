import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Share2, Download, Copy, Play, ImageIcon, Wand2, FileText, Users, FolderOpen, Maximize2, GripVertical, PackageOpen, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VisualDNA } from "@/pages/LaboratorioVisual";
import { motion, AnimatePresence } from "framer-motion";
import ContentPlatformSelector, { Platform, ContentType } from "@/components/ContentPlatformSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toPng } from "html-to-image";

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

const slideTypeConfig: Record<string, { label: string; dotClass: string }> = {
    hook: { label: "HOOK", dotClass: "bg-destructive" },
    value: { label: "VALOR", dotClass: "bg-primary" },
    solution: { label: "SOLUÇÃO", dotClass: "bg-success" },
    cta: { label: "CTA", dotClass: "bg-warning" },
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
    const [exporting, setExporting] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [slideReferenceImages, setSlideReferenceImages] = useState<Record<number, string>>({});
    const [uploadingRef, setUploadingRef] = useState(false);
    const exportRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const slideRefInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { activeProfile } = useClientProfiles();
    const { user } = useAuth();

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
            toast({ title: "✨ Carrossel Gerado!", description: "Clique em 'Gerar Imagens' para criar visuais com IA." });
        } catch (err) {
            toast({ title: "Erro na geração", description: (err as Error).message, variant: "destructive" });
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
                ? ugcCharacters.find(c => c.id === selectedCharacterId) : null;
            let fullPrompt = `${slide.image_prompt}. ${visualDNA.image_prompt_style}`;
            if (selectedChar) fullPrompt += `. The person in the image: ${selectedChar.fixed_description}`;
            const { data, error } = await supabase.functions.invoke("generate-carousel-image", {
                body: {
                    prompt: fullPrompt, visualDNA,
                    ...(selectedChar?.image_references?.[0] ? { referenceImageUrl: selectedChar.image_references[0] } : {}),
                },
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            setSlideImages((prev) => ({ ...prev, [slideIndex]: data.image_url }));
        } catch (err) {
            toast({ title: `Erro no slide ${slideIndex + 1}`, description: (err as Error).message, variant: "destructive" });
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
                if (i < carousel.slides.length - 1) await new Promise((r) => setTimeout(r, 1500));
            }
        }
        setGeneratingAll(false);
        toast({ title: "🎨 Imagens Geradas!", description: "Todas as imagens do carrossel foram criadas com IA." });
    };

    const nextSlide = () => { if (carousel && currentSlide < carousel.slides.length - 1) setCurrentSlide(currentSlide + 1); };
    const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };

    // ─── Export all slides as PNG ───
    const exportAllSlides = useCallback(async () => {
        if (!carousel) return;
        setExporting(true);
        toast({ title: "📦 Exportando...", description: "Preparando slides para download." });

        try {
            for (let i = 0; i < carousel.slides.length; i++) {
                const node = exportRefs.current[i];
                if (!node) continue;

                // Make the export node visible temporarily
                node.style.position = "fixed";
                node.style.left = "-9999px";
                node.style.top = "0";
                node.style.display = "flex";
                document.body.appendChild(node);

                // Wait for images to load
                await new Promise(r => setTimeout(r, 300));

                const dataUrl = await toPng(node, {
                    width: 1080,
                    height: 1350,
                    pixelRatio: 1,
                    cacheBust: true,
                });

                document.body.removeChild(node);
                node.style.display = "none";

                // Trigger download
                const link = document.createElement("a");
                link.download = `slide_${i + 1}_${carousel.slides[i].type}.png`;
                link.href = dataUrl;
                link.click();

                await new Promise(r => setTimeout(r, 200));
            }
            toast({ title: "✅ Exportação Concluída!", description: `${carousel.slides.length} slides prontos para publicação.` });
        } catch (err) {
            console.error("Export error:", err);
            toast({ title: "Erro na exportação", description: (err as Error).message, variant: "destructive" });
        } finally {
            setExporting(false);
        }
    }, [carousel, slideImages, toast]);

    // ─── Drag and drop handlers ───
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex || !carousel) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newSlides = [...carousel.slides];
        const [movedSlide] = newSlides.splice(draggedIndex, 1);
        newSlides.splice(dragOverIndex, 0, movedSlide);

        // Remap images
        const newImages: Record<number, string> = {};
        const oldImages = { ...slideImages };
        const oldOrder = carousel.slides.map((_, i) => i);
        const newOrder = [...oldOrder];
        const [movedIdx] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dragOverIndex, 0, movedIdx);
        newOrder.forEach((oldIdx, newIdx) => {
            if (oldImages[oldIdx]) newImages[newIdx] = oldImages[oldIdx];
        });

        setCarousel({ ...carousel, slides: newSlides });
        setSlideImages(newImages);
        setCurrentSlide(dragOverIndex);
        setDraggedIndex(null);
        setDragOverIndex(null);
        toast({ title: "🔄 Slides reordenados" });
    };

    const generatedCount = Object.keys(slideImages).length;
    const totalSlides = carousel?.slides.length || 0;
    const currentSlideData = carousel?.slides[currentSlide];
    const currentTypeConfig = currentSlideData ? slideTypeConfig[currentSlideData.type] || slideTypeConfig.value : null;
    const hasImage = !!slideImages[currentSlide];

    // ─── Render export slide (offscreen, used by html-to-image) ───
    const renderExportSlide = (slide: CarouselSlide, index: number) => {
        const hasImg = !!slideImages[index];
        return (
            <div
                key={`export-${index}`}
                ref={(el) => { exportRefs.current[index] = el; }}
                style={{
                    width: 1080,
                    height: 1350,
                    display: "none",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: visualDNA.typography.includes("Serif") ? "Georgia, serif" : "'DM Sans', sans-serif",
                }}
            >
                {/* Background */}
                {hasImg ? (
                    <img
                        src={slideImages[index]}
                        crossOrigin="anonymous"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        alt=""
                    />
                ) : (
                    <div style={{
                        position: "absolute", inset: 0,
                        background: `linear-gradient(145deg, ${visualDNA.palette[0] || "#1a1a2e"}, ${visualDNA.palette[1] || "#16213e"})`,
                    }} />
                )}
                {/* Gradient overlay */}
                <div style={{
                    position: "absolute", inset: 0,
                    background: hasImg
                        ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)"
                        : "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)",
                }} />
                {/* Text content */}
                <div style={{
                    position: "relative", zIndex: 10,
                    padding: "60px 56px",
                    display: "flex", flexDirection: "column", gap: "16px",
                }}>
                    <span style={{
                        display: "inline-block",
                        fontSize: "14px",
                        fontWeight: 800,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: slide.type === "hook" ? "#ef4444" : slide.type === "cta" ? "#f59e0b" : slide.type === "solution" ? "#10b981" : "#6366f1",
                        marginBottom: "4px",
                    }}>
                        {(slideTypeConfig[slide.type] || slideTypeConfig.value).label}
                    </span>
                    <h3 style={{
                        fontSize: "52px",
                        fontWeight: 800,
                        color: "#ffffff",
                        lineHeight: 1.15,
                        textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                    }}>
                        {slide.headline}
                    </h3>
                    <p style={{
                        fontSize: "26px",
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.85)",
                        lineHeight: 1.5,
                    }}>
                        {slide.body}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Creator Card */}
            <Card className="glass-card">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Criador de Conteúdo Estratégico
                    </CardTitle>
                    <CardDescription className="text-xs">
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
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

            {carousel && currentSlideData && (
                <>
                    {/* Image Generation Bar */}
                    <Card className="glass-card">
                        <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <Wand2 className="w-4 h-4 text-primary" />
                                <div>
                                    <p className="text-sm font-medium">Gerador de Imagens IA</p>
                                    <p className="text-[11px] text-muted-foreground">{generatedCount}/{totalSlides} imagens geradas</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                <Button variant="outline" size="sm" onClick={() => generateImageForSlide(currentSlide)}
                                    disabled={generatingImages[currentSlide] || generatingAll} className="gap-1.5 text-xs h-8">
                                    {generatingImages[currentSlide] ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                    Slide Atual
                                </Button>
                                <Button size="sm" onClick={generateAllImages}
                                    disabled={generatingAll || generatedCount === totalSlides} className="gap-1.5 text-xs h-8">
                                    {generatingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    {generatingAll ? "Gerando..." : "Gerar Todas"}
                                </Button>
                                {creativeAssets.length > 0 && (
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                                        onClick={() => { setLibraryTarget(currentSlide); setShowLibrary(true); }}>
                                        <FolderOpen className="w-3 h-3" /> Biblioteca
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-xs h-8"
                                    onClick={exportAllSlides}
                                    disabled={exporting || generatedCount === 0}
                                >
                                    {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
                                    {exporting ? "Exportando..." : "Exportar PNGs"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Left: Post Preview */}
                        <div className="space-y-4">
                            {/* Instagram-style post card */}
                            <Card className="glass-card overflow-hidden">
                                {/* Post header */}
                                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground"
                                        style={{ backgroundColor: visualDNA.palette[0] || "hsl(var(--primary))" }}>
                                        {(activeProfile?.name?.[0] || "P").toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{activeProfile?.name || "Perfil"}</p>
                                        <p className="text-[10px] text-muted-foreground">Patrocinado</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {currentTypeConfig && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                <span className={`w-1.5 h-1.5 rounded-full ${currentTypeConfig.dotClass}`} />
                                                {currentTypeConfig.label}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground ml-1">{currentSlide + 1}/{carousel.slides.length}</span>
                                    </div>
                                </div>

                                {/* Post image area — 4:5 ratio */}
                                <div className="relative aspect-[4/5] bg-muted">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentSlide}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="absolute inset-0"
                                        >
                                            {hasImage ? (
                                                <>
                                                    <img
                                                        src={slideImages[currentSlide]}
                                                        alt={currentSlideData.headline}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                                                    <div className="absolute inset-x-0 bottom-0 p-5 space-y-2">
                                                        <h3 className="text-lg font-bold text-white leading-tight drop-shadow-sm"
                                                            style={{ fontFamily: visualDNA.typography.includes("Serif") ? "Georgia, serif" : "inherit" }}>
                                                            {currentSlideData.headline}
                                                        </h3>
                                                        <p className="text-xs text-white/80 leading-relaxed line-clamp-3">{currentSlideData.body}</p>
                                                    </div>
                                                    <button onClick={() => setExpandedPreview(true)}
                                                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer">
                                                        <Maximize2 className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
                                                    style={{
                                                        background: `linear-gradient(145deg, ${visualDNA.palette[0] || "#1a1a2e"}, ${visualDNA.palette[1] || "#16213e"})`,
                                                    }}>
                                                    <div className="max-w-[280px] space-y-4">
                                                        <h3 className="text-xl font-bold text-white leading-tight"
                                                            style={{ fontFamily: visualDNA.typography.includes("Serif") ? "Georgia, serif" : "inherit" }}>
                                                            {currentSlideData.headline}
                                                        </h3>
                                                        <p className="text-sm text-white/70 leading-relaxed">{currentSlideData.body}</p>
                                                    </div>
                                                    {!generatingImages[currentSlide] ? (
                                                        <button onClick={() => generateImageForSlide(currentSlide)}
                                                            className="mt-6 px-4 py-2 rounded-lg border border-white/20 text-white/50 text-[11px] font-medium hover:text-white/80 hover:border-white/40 transition-all cursor-pointer flex items-center gap-2">
                                                            <ImageIcon className="w-3.5 h-3.5" /> Gerar imagem IA
                                                        </button>
                                                    ) : (
                                                        <div className="mt-6 flex items-center gap-2 text-white/40 text-[11px]">
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Gerando...
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>

                                    {/* Navigation arrows inside */}
                                    {currentSlide > 0 && (
                                        <button onClick={prevSlide}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-foreground hover:bg-white transition-colors cursor-pointer z-20">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                    )}
                                    {currentSlide < carousel.slides.length - 1 && (
                                        <button onClick={nextSlide}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-foreground hover:bg-white transition-colors cursor-pointer z-20">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Dots + actions bar */}
                                <div className="px-4 py-3 border-t border-border">
                                    <div className="flex items-center justify-center gap-1">
                                        {carousel.slides.map((_, i) => (
                                            <button key={i} onClick={() => setCurrentSlide(i)}
                                                className={`rounded-full transition-all duration-200 cursor-pointer ${
                                                    i === currentSlide
                                                        ? "w-5 h-1.5 bg-primary"
                                                        : slideImages[i]
                                                            ? "w-1.5 h-1.5 bg-primary/40"
                                                            : "w-1.5 h-1.5 bg-border"
                                                }`} />
                                        ))}
                                    </div>
                                </div>
                            </Card>

                            {/* Thumbnail strip with drag-and-drop */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                                {carousel.slides.map((slide, i) => {
                                    const tc = slideTypeConfig[slide.type] || slideTypeConfig.value;
                                    const isDragging = draggedIndex === i;
                                    const isDragOver = dragOverIndex === i && draggedIndex !== i;
                                    return (
                                        <div
                                            key={`thumb-${i}`}
                                            draggable
                                            onDragStart={() => handleDragStart(i)}
                                            onDragOver={(e) => handleDragOver(e, i)}
                                            onDragEnd={handleDragEnd}
                                            onDragLeave={() => setDragOverIndex(null)}
                                            onClick={() => setCurrentSlide(i)}
                                            className={`group relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                                                isDragging ? "opacity-40 scale-90" : ""
                                            } ${isDragOver ? "border-primary ring-2 ring-primary/30 scale-105" : ""} ${
                                                !isDragging && !isDragOver
                                                    ? i === currentSlide
                                                        ? "border-primary ring-2 ring-primary/20"
                                                        : "border-border opacity-60 hover:opacity-100"
                                                    : ""
                                            }`}
                                        >
                                            {slideImages[i] ? (
                                                <img src={slideImages[i]} className="w-full h-full object-cover pointer-events-none" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground bg-muted">
                                                    {i + 1}
                                                </div>
                                            )}
                                            <div className={`absolute bottom-0 inset-x-0 h-0.5 ${tc.dotClass}`} />
                                            {/* Drag grip indicator */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <GripVertical className="w-3 h-3 text-white/0 group-hover:text-white/80 transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center -mt-2">
                                Arraste os slides para reordenar
                            </p>
                        </div>

                        {/* Right: Roteiro & Prompts */}
                        <div className="space-y-4">
                            <Card className="glass-card">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Roteiro & Prompts</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Copy */}
                                    <div className="p-3.5 rounded-lg bg-secondary/50 border border-border space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                                                {currentTypeConfig && <span className={`w-1.5 h-1.5 rounded-full ${currentTypeConfig.dotClass}`} />}
                                                Copy do Slide {currentSlide + 1}
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${currentSlideData.headline}\n\n${currentSlideData.body}`);
                                                    toast({ title: "Copiado!" });
                                                }}>
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground leading-snug">{currentSlideData.headline}</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{currentSlideData.body}</p>
                                    </div>

                                    {/* Prompt */}
                                    <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/10 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                                                <Play className="w-3 h-3 text-primary" /> Prompt para Imagem IA
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${currentSlideData.image_prompt}. ${visualDNA.image_prompt_style}. Professional photography, 4k.`);
                                                    toast({ title: "Copiado!" });
                                                }}>
                                                <Download className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="bg-background p-2.5 rounded border border-border text-[11px] font-mono leading-relaxed text-muted-foreground">
                                            {currentSlideData.image_prompt}. {visualDNA.image_prompt_style}. Professional photography, 4k.
                                        </div>
                                    </div>

                                    {/* Generated preview */}
                                    {hasImage && (
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Imagem Gerada</p>
                                            <img src={slideImages[currentSlide]} alt={`Slide ${currentSlide + 1}`}
                                                className="w-full rounded-lg border border-border" />
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 gap-1.5 text-xs h-8"
                                            onClick={exportAllSlides} disabled={exporting || generatedCount === 0}>
                                            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                                            {exporting ? "Exportando..." : "Exportar Todos"}
                                        </Button>
                                        <Button variant="outline" className="flex-1 gap-1.5 text-xs h-8"
                                            onClick={() => {
                                                if (!slideImages[currentSlide]) return;
                                                const link = document.createElement("a");
                                                link.download = `slide_${currentSlide + 1}.png`;
                                                link.href = slideImages[currentSlide];
                                                link.click();
                                            }}
                                            disabled={!hasImage}>
                                            <Download className="w-3 h-3" /> Baixar Slide
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Captions */}
                            {carousel.captions && Object.keys(carousel.captions).length > 0 && (
                                <Card className="glass-card">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-primary" />
                                                Legendas Prontas
                                            </CardTitle>
                                            <Button variant="ghost" size="sm" onClick={() => setShowCaptions(!showCaptions)} className="text-xs h-7">
                                                {showCaptions ? "Ocultar" : "Mostrar"}
                                            </Button>
                                        </div>
                                        <CardDescription className="text-[11px]">Personalizadas com base no Dossiê do perfil</CardDescription>
                                    </CardHeader>
                                    {showCaptions && (
                                        <CardContent className="space-y-3">
                                            {Object.entries(carousel.captions).map(([platform, caption]) => (
                                                <div key={platform} className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-semibold uppercase text-primary">
                                                            {platform === "instagram" ? "📸 Instagram" :
                                                             platform === "tiktok" ? "🎵 TikTok" :
                                                             platform === "linkedin" ? "💼 LinkedIn" :
                                                             platform === "blog" ? "📝 Blog" : platform}
                                                        </span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6"
                                                            onClick={() => { navigator.clipboard.writeText(caption); toast({ title: "Copiado!", description: `Legenda ${platform} copiada.` }); }}>
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs whitespace-pre-wrap leading-relaxed">
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
                <Card className="glass-card py-16">
                    <CardContent className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="text-sm font-semibold">Criando Estratégia...</p>
                            <p className="text-xs text-muted-foreground italic mt-1">"O segredo do carrossel é o gancho no primeiro slide..."</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Hidden export nodes */}
            {carousel && carousel.slides.map((slide, i) => renderExportSlide(slide, i))}

            {/* Library Dialog */}
            <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
                <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm">
                            <FolderOpen className="w-4 h-4 text-primary" />
                            Biblioteca de Criativos — Slide {libraryTarget + 1}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                        {creativeAssets.map((asset) => (
                            <button key={asset.id} onClick={() => useLibraryImage(libraryTarget, asset.file_url)}
                                className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer">
                                <img src={asset.file_url} alt={asset.file_name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <span className="text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Usar</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {creativeAssets.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-8">Nenhum criativo na biblioteca.</p>
                    )}
                </DialogContent>
            </Dialog>

            {/* Expanded Preview */}
            <Dialog open={expandedPreview} onOpenChange={setExpandedPreview}>
                <DialogContent className="max-w-lg p-1 bg-black border-none rounded-xl overflow-hidden">
                    {slideImages[currentSlide] && (
                        <img src={slideImages[currentSlide]} alt="Preview" className="w-full rounded-lg" />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
