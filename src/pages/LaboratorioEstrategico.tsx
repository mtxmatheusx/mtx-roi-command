import { useState } from "react";
import { Beaker, Loader2, Sparkles, Rocket, ArrowRight, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface StrategicPlay {
    title: string;
    type: "scale" | "refresh" | "pivot";
    rationale: string;
    suggestion: string;
    confidence: number;
    impact: "high" | "medium" | "low";
    draft_prefill: {
        campaign_name: string;
        objective: string;
        daily_budget: number;
        targeting_notes: string;
    };
}

export default function LaboratorioEstrategico() {
    const [loading, setLoading] = useState(false);
    const [plays, setPlays] = useState<StrategicPlay[]>([]);
    const { activeProfile } = useClientProfiles();
    const { toast } = useToast();
    const navigate = useNavigate();

    const runAnalysis = async () => {
        if (!activeProfile?.id) {
            toast({ title: "Erro", description: "Selecione um cliente primeiro.", variant: "destructive" });
            return;
        }

        setLoading(true);
        setPlays([]);

        try {
            const { data, error } = await supabase.functions.invoke("ai-strategic-advisor", {
                body: { profileId: activeProfile.id },
            });

            if (error) throw error;

            if (data?.plays) {
                setPlays(data.plays);
                toast({ title: "Análise Concluída", description: `Identificamos ${data.plays.length} jogadas estratégicas.` });
            } else {
                toast({ title: "Aviso", description: "A IA não encontrou jogadas específicas no momento. Tente novamente mais tarde.", variant: "destructive" });
            }
        } catch (e: any) {
            console.error(e);
            toast({ title: "Erro na IA", description: e.message || "Falha ao processar análise estratégica.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLaunch = (play: StrategicPlay) => {
        // Navigate to LancarCampanha with state
        navigate("/lancar-campanha", {
            state: {
                prefill: play.draft_prefill,
                reasoning: play.rationale
            }
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case "scale": return <Badge className="bg-success/20 text-success border-success/30">ESCALA</Badge>;
            case "refresh": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">REFRESH</Badge>;
            case "pivot": return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">PIVOT</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case "high": return "text-success";
            case "medium": return "text-amber-500";
            case "low": return "text-muted-foreground";
            default: return "";
        }
    };

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                <ActiveProfileHeader />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Beaker className="h-6 w-6 text-primary" />
                            Laboratório Estratégico
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Onde a IA analisa o campo de batalha para sugerir sua próxima jogada vencedora.
                        </p>
                    </div>
                    <Button onClick={runAnalysis} disabled={loading || !activeProfile} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {loading ? "Processando Inteligência..." : plays.length > 0 ? "Refazer Análise" : "Iniciar Análise Estratégica"}
                    </Button>
                </div>

                {!loading && plays.length === 0 && (
                    <Card className="border-dashed bg-secondary/20">
                        <CardContent className="py-20 text-center">
                            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border shadow-sm">
                                <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium">Pronto para a próxima vitória?</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                Clique no botão acima para que a nossa IA examine seus dados de performance e encontre brechas de escala ou correções urgentes.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {plays.map((play, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <Card className="h-full flex flex-col border-primary/20 hover:border-primary/50 transition-colors shadow-sm bg-card overflow-hidden">
                                    <CardHeader className="pb-3 border-b border-border/50 bg-secondary/10">
                                        <div className="flex items-center justify-between mb-2">
                                            {getTypeBadge(play.type)}
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                Confiança: {play.confidence}%
                                            </span>
                                        </div>
                                        <CardTitle className="text-lg leading-tight">{play.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 flex-1 flex flex-col space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 uppercase">
                                                <ArrowRight className="w-3 h-3" /> Racional dos Dados
                                            </p>
                                            <p className="text-sm border-l-2 border-primary/30 pl-3 py-1 italic text-foreground/80">
                                                {play.rationale}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 uppercase">
                                                <Sparkles className="w-3 h-3 text-primary" /> Sugestão da IA
                                            </p>
                                            <p className="text-sm text-foreground font-medium">
                                                {play.suggestion}
                                            </p>
                                        </div>

                                        <div className="pt-4 mt-auto border-t border-border flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Impacto Esperado</span>
                                                <span className={`text-sm font-bold uppercase ${getImpactColor(play.impact)}`}>
                                                    {play.impact === 'high' ? 'Alto ROI' : play.impact === 'medium' ? 'Médio' : 'Estabilidade'}
                                                </span>
                                            </div>
                                            <Button size="sm" onClick={() => handleQuickLaunch(play)} className="gap-2 group">
                                                Lançar <Rocket className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse border-border shadow-none">
                                <CardHeader className="h-24 bg-secondary/20" />
                                <CardContent className="h-40 space-y-4 pt-4">
                                    <div className="h-4 bg-secondary/20 rounded w-3/4" />
                                    <div className="h-4 bg-secondary/20 rounded w-1/2" />
                                    <div className="h-20 bg-secondary/20 rounded w-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
