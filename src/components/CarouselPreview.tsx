import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Share2, Download, Copy, Play, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VisualDNA } from "@/pages/LaboratorioVisual";
import { motion, AnimatePresence } from "framer-motion";

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
};

export default function CarouselPreview({ visualDNA }: CarouselPreviewProps) {
    const [theme, setTheme] = useState("");
    const [loading, setLoading] = useState(false);
    const [carousel, setCarousel] = useState<CarouselData | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (!theme) return;
        setLoading(true);
        setCarousel(null);

        try {
            const { data, error } = await supabase.functions.invoke("generate-carousel", {
                body: { visualDNA, theme },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setCarousel(data.data as CarouselData);
            setCurrentSlide(0);
            toast({
                title: "✨ Carrossel Gerado!",
                description: "Seu conteúdo estratégico está pronto.",
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

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Criador de Carrossel Estratégico
                    </CardTitle>
                    <CardDescription>
                        Defina um tema e a IA criará um carrossel alinhado ao seu DNA Visual.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Mobile Preview Style Carousel */}
                    <div className="flex flex-col items-center">
                        <div className="relative w-[320px] h-[400px] bg-background rounded-[40px] border-[8px] border-secondary shadow-2xl overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-8 flex justify-center pt-2">
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
                                        color: "#fff" // Simplification for preview
                                    }}
                                >
                                    {/* Decorative background element based on aesthetic */}
                                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white/5 blur-3xl" />

                                    <div className="space-y-4 pt-4">
                                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
                                            {carousel.slides[currentSlide].type} · {currentSlide + 1}/{carousel.slides.length}
                                        </span>
                                        <h2
                                            className="text-2xl font-black leading-tight"
                                            style={{
                                                fontFamily: visualDNA.typography.includes("Serif") ? "serif" : "sans-serif"
                                            }}
                                        >
                                            {carousel.slides[currentSlide].headline}
                                        </h2>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-sm opacity-90 leading-relaxed font-medium">
                                            {carousel.slides[currentSlide].body}
                                        </p>
                                        <div className="w-full h-24 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 opacity-20" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] py-2">
                                        <span className="font-bold opacity-70">@seu-perfil</span>
                                        <div className="flex gap-1">
                                            {carousel.slides.map((_, i) => (
                                                <div key={i} className={`w-1 h-1 rounded-full ${i === currentSlide ? "bg-white" : "bg-white/30"}`} />
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
                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Copy className="w-3 h-3" /></Button>
                                </div>
                                <p className="text-sm italic">"{carousel.slides[currentSlide].body}"</p>
                            </div>

                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Play className="w-3 h-3 text-primary" />
                                        <span className="text-xs font-bold uppercase">Prompt para Imagem IA</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="w-3 h-3" /></Button>
                                </div>
                                <div className="bg-background/80 p-3 rounded border text-[11px] font-mono leading-relaxed">
                                    {carousel.slides[currentSlide].image_prompt}. {visualDNA.image_prompt_style}. Professional photography, 4k.
                                </div>
                            </div>

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
                </div>
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
