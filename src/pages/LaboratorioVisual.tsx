import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, Wand2, Search, Palette, Type, MessageSquare, Sparkles } from "lucide-react";
import InstagramAnalyzer from "@/components/InstagramAnalyzer";
import CarouselPreview from "@/components/CarouselPreview";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

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
                <TabsList className="bg-card border p-1 h-12">
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
                        2. Criação de Carrossel
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
                                                    <div className="flex gap-2">
                                                        {visualDNA.palette.map((color, i) => {
                                                            const rgb = hexToRgb(color);
                                                            return (
                                                                <Popover key={i}>
                                                                    <PopoverTrigger asChild>
                                                                        <button
                                                                            className="w-8 h-8 rounded-full border border-border shadow-sm cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                                                            style={{ backgroundColor: color }}
                                                                            title={`Editar ${color}`}
                                                                        />
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64 space-y-3" side="bottom" align="start">
                                                                        <p className="text-xs font-semibold text-muted-foreground">Editar Cor</p>
                                                                        <div
                                                                            className="w-full h-10 rounded-md border"
                                                                            style={{ backgroundColor: color }}
                                                                        />
                                                                        <div className="space-y-2">
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[10px] text-destructive font-bold">R: {rgb.r}</Label>
                                                                                <Slider min={0} max={255} step={1} value={[rgb.r]} onValueChange={([v]) => handleColorChange(i, rgbToHex(v, rgb.g, rgb.b))} className="[&_[role=slider]]:bg-destructive [&_.bg-primary]:bg-destructive" />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[10px] text-green-600 font-bold">G: {rgb.g}</Label>
                                                                                <Slider min={0} max={255} step={1} value={[rgb.g]} onValueChange={([v]) => handleColorChange(i, rgbToHex(rgb.r, v, rgb.b))} className="[&_[role=slider]]:bg-green-600 [&_.bg-primary]:bg-green-600" />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[10px] text-blue-600 font-bold">B: {rgb.b}</Label>
                                                                                <Slider min={0} max={255} step={1} value={[rgb.b]} onValueChange={([v]) => handleColorChange(i, rgbToHex(rgb.r, rgb.g, v))} className="[&_[role=slider]]:bg-blue-600 [&_.bg-primary]:bg-blue-600" />
                                                                            </div>
                                                                        </div>
                                                                        <Input
                                                                            value={color}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (/^#[0-9a-fA-F]{6}$/.test(val)) handleColorChange(i, val);
                                                                            }}
                                                                            className="text-xs font-mono h-8"
                                                                            maxLength={7}
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            );
                                                        })}
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
