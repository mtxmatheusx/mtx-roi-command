import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Instagram, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VisualDNA } from "@/pages/LaboratorioVisual";
import { motion, AnimatePresence } from "framer-motion";

interface InstagramAnalyzerProps {
    onComplete: (dna: VisualDNA) => void;
}

export default function InstagramAnalyzer({ onComplete }: InstagramAnalyzerProps) {
    const [url, setUrl] = useState("");
    const [manualContent, setManualContent] = useState("");
    const [isManual, setIsManual] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleAnalyze = async () => {
        if (!isManual && !url) return;
        if (isManual && !manualContent) return;

        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke("analyze-instagram", {
                body: {
                    url: isManual ? undefined : url,
                    manualContent: isManual ? manualContent : undefined
                },
            });

            if (error) throw error;
            if (data.error) {
                const customError = new Error(data.error) as any;
                customError.tip = data.tip;
                throw customError;
            }

            toast({
                title: "✅ Análise concluída!",
                description: "DNA Visual extraído com sucesso.",
            });

            onComplete(data.data as VisualDNA);
        } catch (err: any) {
            console.error("Analysis Error:", err);
            toast({
                title: "Erro na análise",
                description: err.tip || err.message || "Erro desconhecido ao chamar a função.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-10 px-4">
            <Card className="border-2 border-primary/10 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Instagram className="w-6 h-6 text-pink-500" />
                                Analisar Perfil
                            </CardTitle>
                            <CardDescription>
                                Decodifique a marca através do conteúdo do Instagram.
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsManual(!isManual)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            {isManual ? "Usar Link" : "Colar Texto"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <AnimatePresence mode="wait">
                        {!isManual ? (
                            <motion.div
                                key="url-input"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex gap-2"
                            >
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="https://instagram.com/perfil"
                                        className="pl-10 h-12 text-lg"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                                    />
                                </div>
                                <Button
                                    className="h-12 px-8 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                                    onClick={handleAnalyze}
                                    disabled={loading || !url}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analisar"}
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="manual-input"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-4"
                            >
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Textarea
                                        placeholder="Cole aqui a Bio do Instagram ou legendas de posts recentes..."
                                        className="pl-10 min-h-[150px] text-base resize-none"
                                        value={manualContent}
                                        onChange={(e) => setManualContent(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full h-12 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                                    onClick={handleAnalyze}
                                    disabled={loading || !manualContent}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        "Analisar Texto Manualmente"
                                    )}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Extração de Cores</p>
                                <p className="text-xs text-muted-foreground leading-tight">Identificamos as cores dominantes da marca.</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Identificação de Tom</p>
                                <p className="text-xs text-muted-foreground leading-tight">Analisamos a linguagem para entender como a marca fala.</p>
                            </div>
                        </div>
                    </div>

                    {!loading && !url && !manualContent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-lg bg-accent/5 border border-dashed flex items-center gap-3 text-muted-foreground"
                        >
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-xs italic">Dica: Perfis com posts recentes trazem resultados muito mais precisos.</p>
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
