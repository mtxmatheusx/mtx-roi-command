import { motion } from "framer-motion";
import { Sparkles, Instagram, Wand2, Target, BarChart3, ChevronRight, CheckCircle2, Play, Layout, Palette, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function LaboratorioVisualLanding() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white overflow-hidden">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* Header/Nav */}
            <nav className="relative z-50 border-b border-white/5 bg-black/40 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.4)]">
                            <Sparkles className="text-white w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">MTX <span className="text-primary">Visual Lab</span></span>
                    </div>
                    <Button
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        onClick={() => navigate("/laboratorio-visual")}
                    >
                        Acessar Plataforma <ChevronRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </nav>

            {/* Hero Section - StoryBrand: The Problem & The Solution */}
            <section className="relative pt-24 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-wide text-primary mb-8"
                    >
                        <Sparkles className="w-3 h-3" /> NOVO LANÇAMENTO: O COMBO LEGACY IA
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black mb-8 leading-[1.1] tracking-tight bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent"
                    >
                        Sua Identidade Visual <br /> <span className="text-primary italic">Decodificada</span> por IA.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 mb-12 leading-relaxed"
                    >
                        Pare de postar no escuro. O Laboratório Visual analisa o DNA da sua marca e gera carrosséis de alta conversão alinhados à sua estética premium em segundos.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Button
                            className="h-14 px-10 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold shadow-[0_20px_40px_rgba(var(--primary),0.3)] transition-all active:scale-95 flex items-center gap-3"
                            onClick={() => navigate("/laboratorio-visual")}
                        >
                            Começar Agora GRÁTIS <Wand2 className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" className="h-14 px-8 text-white/50 hover:text-white hover:bg-white/5 rounded-2xl font-medium transition-all flex items-center gap-2">
                            <Play className="fill-current w-4 h-4" /> Ver Vídeo Demonstrativo
                        </Button>
                    </motion.div>
                </div>
            </section>

            {/* Feature Showcase - Premium UI Feel */}
            <section className="relative pb-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Instagram className="w-6 h-6 text-pink-500" />}
                            title="Escaneamento Visual"
                            desc="Analisamos bio, posts e cores para entender quem sua marca realmente é."
                        />
                        <FeatureCard
                            icon={<Palette className="w-6 h-6 text-primary" />}
                            title="DNA de Branding"
                            desc="Extração instantânea de paleta de cores, tipografia e tom de voz estratégico."
                        />
                        <FeatureCard
                            icon={<Layout className="w-6 h-6 text-purple-500" />}
                            title="Carousel Engine"
                            desc="8-10 slides gerados com framework StoryBrand e prompts de imagem IA."
                        />
                    </div>
                </div>
            </section>

            {/* The "Mirror" Section - Social Proof / Example */}
            <section className="bg-white/5 border-y border-white/10 py-32 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                            Transforme um Link em <br /> uma <span className="text-primary">Máquina de Conteúdo.</span>
                        </h2>
                        <div className="space-y-6">
                            <Point icon={<CheckCircle2 className="text-primary w-5 h-5" />} text="Sem depender de designers caros" />
                            <Point icon={<CheckCircle2 className="text-primary w-5 h-5" />} text="Estética Premium garantida pela IA" />
                            <Point icon={<CheckCircle2 className="text-primary w-5 h-5" />} text="Copies que convertem seguidores em clientes" />
                            <Point icon={<CheckCircle2 className="text-primary w-5 h-5" />} text="Prompts prontos para Midjourney e DALL-E" />
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                        <Card className="relative z-10 bg-black/80 border-white/10 backdrop-blur-xl overflow-hidden rounded-[40px] shadow-2xl">
                            <CardContent className="p-0">
                                <div className="h-12 border-b border-white/5 flex items-center px-6 gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                                </div>
                                <div className="p-10 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-purple-500" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 w-24 bg-white/20 rounded-full" />
                                            <div className="h-2 w-16 bg-white/10 rounded-full" />
                                            <div className="h-2 w-16 bg-white/10 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-6 w-full bg-white/10 rounded-lg animate-pulse" />
                                        <div className="h-6 w-[80%] bg-white/10 rounded-lg animate-pulse" />
                                        <div className="h-32 w-full bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                                            <Sparkles className="w-10 h-10 text-white/10" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Footer / CTA Final */}
            <footer className="py-24 px-6 text-center border-t border-white/5">
                <div className="max-w-4xl mx-auto">
                    <h3 className="text-3xl font-bold mb-8">Pronto para dominar o Visual do seu Instagram?</h3>
                    <Button
                        className="h-14 px-12 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold shadow-[0_20px_40px_rgba(var(--primary),0.3)] transition-all active:scale-95"
                        onClick={() => navigate("/laboratorio-visual")}
                    >
                        Começar Grátis Agora
                    </Button>
                    <p className="mt-12 text-white/30 text-sm">
                        © 2026 MTX Estratégias · Command Center Visual Labs
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm transition-all hover:bg-white/10 hover:translate-y-[-5px] hover:border-primary/50 group cursor-default">
            <CardContent className="p-8 pt-10">
                <div className="mb-6 p-4 rounded-xl bg-black/40 border border-white/5 w-fit group-hover:shadow-[0_0_20px_rgba(var(--primary),0.2)] transition-all">
                    {icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </CardContent>
        </Card>
    );
}

function Point({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="p-1 rounded-full bg-primary/10">
                {icon}
            </div>
            <span className="text-white/80 font-medium">{text}</span>
        </div>
    );
}
