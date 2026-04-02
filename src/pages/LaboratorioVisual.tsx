import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Search, Palette, MessageSquare, Sparkles } from "lucide-react";
import InstagramAnalyzer from "@/components/InstagramAnalyzer";
import CarouselPreview from "@/components/CarouselPreview";
import ColorEditor from "@/components/ColorEditor";
import { motion, AnimatePresence } from "framer-motion";

export type VisualDNA = {
    palette: string[];
    typography: string;
    tone: string;
    aesthetic: string;
    summary: string;
    image_prompt_style: string;
};

export default function LaboratorioVisual() {
    const [visualDNA, setVisualDNA] = useState<VisualDNA | null>(null);
    const [activeTab, setActiveTab] = useState("analise");

    const handleAnalysisComplete = (dna: VisualDNA) => {
        setVisualDNA(dna);
        setActiveTab("criacao");
    };

    const handleColorChange = useCallback((index: number, newColor: string) => {
        if (!visualDNA) return;
        setVisualDNA({
            ...visualDNA,
            palette: visualDNA.palette.map((c, i) => (i === index ? newColor : c)),
        });
    }, [visualDNA]);

    const handleColorRemove = useCallback((index: number) => {
        if (!visualDNA || visualDNA.palette.length <= 1) return;
        setVisualDNA({
            ...visualDNA,
            palette: visualDNA.palette.filter((_, i) => i !== index),
        });
    }, [visualDNA]);

    return (
        <AppLayout>
            <ActiveProfileHeader />
            <div className="mb-6">
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl font-bold tracking-tight flex items-center gap-3"
                >
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    Laboratório Visual
                </motion.h1>
                <p className="text-muted-foreground mt-2">
                    Decodifique a identidade visual de qualquer perfil e gere conteúdos magnéticos em segundos.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="liquid-glass !rounded-xl p-1 h-12">
                    <TabsTrigger value="analise" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Search className="w-4 h-4" />
                        1. Análise de Perfil
                    </TabsTrigger>
                    <TabsTrigger
                        value="criacao"
                        disabled={!visualDNA}
                        className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                        <Wand2 className="w-4 h-4" />
                        2. Criação de Conteúdo
                    </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                    <TabsContent value="analise">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <InstagramAnalyzer onComplete={handleAnalysisComplete} />
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="criacao">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {visualDNA ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Visual DNA Sidebar */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <Card className="bg-gradient-to-br from-card to-accent/5 overflow-hidden border-primary/20">
                                            <CardHeader className="border-b bg-primary/5">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Palette className="w-4 h-4 text-primary" />
                                                    DNA Visual Extraído
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Paleta de Cores</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {visualDNA.palette.map((color, i) => (
                                                            <ColorEditor
                                                                key={`${i}-${color}`}
                                                                color={color}
                                                                index={i}
                                                                onChange={handleColorChange}
                                                                onRemove={handleColorRemove}
                                                                canRemove={visualDNA.palette.length > 1}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-2 rounded-lg bg-background/50 border">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Estética</p>
                                                        <p className="text-xs font-semibold">{visualDNA.aesthetic}</p>
                                                    </div>
                                                    <div className="p-2 rounded-lg bg-background/50 border">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Tipografia</p>
                                                        <p className="text-xs font-semibold">{visualDNA.typography}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Tom de Voz</p>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <MessageSquare className="w-3 h-3 text-primary" />
                                                        <span className="font-medium italic">"{visualDNA.tone}"</span>
                                                    </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        {visualDNA.summary}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Carousel Editor/Generator */}
                                    <div className="lg:col-span-2">
                                        <CarouselPreview visualDNA={visualDNA} />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20">
                                    <p className="text-muted-foreground">Analise um perfil primeiro para começar a criar.</p>
                                </div>
                            )}
                        </motion.div>
                    </TabsContent>
                </AnimatePresence>
            </Tabs>
        </AppLayout>
    );
}
