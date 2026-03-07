import { motion } from "framer-motion";
import {
    Sparkles,
    Wand2,
    CheckCircle2,
    Layout,
    ChevronRight,
    Zap,
    Globe,
    Clock,
    ShieldCheck,
    MessageCircle,
    Users,
    Target,
    ArrowRight,
    Split,
    TrendingUp,
    XCircle,
    Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function MetodoRIC() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#F26129]/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Header/Nav */}
            <nav className="relative z-50 border-b border-white/5 bg-black/40 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#F26129] flex items-center justify-center shadow-[0_0_20px_rgba(242,97,41,0.4)]">
                            <Zap className="text-white w-6 h-6 fill-white" />
                        </div>
                        <span className="font-black text-xl tracking-tighter uppercase font-sans">MÉTODO <span className="text-[#F26129] italic">RIC®</span></span>
                    </div>
                    <Button
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex font-bold"
                        onClick={() => navigate("/auth")}
                    >
                        Área de Alunos <ChevronRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-24 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase font-black tracking-[0.2em] text-[#F26129] mb-10"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> O Primeiro Sistema de Autoria do Brasil
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-6xl md:text-8xl lg:text-9xl font-black mb-10 leading-[0.95] tracking-tighter bg-gradient-to-b from-white via-white to-white/30 bg-clip-text text-transparent"
                    >
                        Pare de tentar ser <br /> <span className="text-[#F26129] italic leading-none">"produtivo"</span>
                    </motion.h1>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-3xl md:text-5xl font-black mb-10 text-white leading-tight tracking-tight px-4"
                    >
                        Comece a ser o <span className="underline decoration-[#F26129] decoration-8 underline-offset-8">Autor</span> da sua própria vida.
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="max-w-3xl mx-auto text-lg md:text-2xl text-white/50 mb-14 leading-relaxed font-medium"
                    >
                        A Tríade RIC ataca os 3 pilares da Autoria: Rota, Ignição e Calibragem — para quem está cansado de começar e parar no meio do caminho.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col items-center justify-center gap-8"
                    >
                        <Button
                            className="h-24 px-14 bg-[#F26129] hover:bg-[#F26129]/90 text-white rounded-[32px] text-2xl font-black shadow-[0_20px_50px_rgba(242,97,41,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-tighter"
                            onClick={() => window.open('https://pay.kiwify.com.br/vfjLBSg', '_blank')}
                        >
                            Quero me tornar AUTOR agora <ArrowRight className="w-8 h-8" />
                        </Button>

                        <div className="flex flex-wrap items-center justify-center gap-6 text-white/40 text-[10px] font-black uppercase tracking-widest leading-none">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#F26129]" /> Acesso Vitalício</span>
                            <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#F26129]" /> Entrega Automática</span>
                            <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#F26129]" /> 7 Dias de Garantia</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Pain Points Section - Modernized */}
            <section className="relative py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white/5 border border-white/10 rounded-[48px] p-12 md:p-24 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F26129]/10 blur-[100px] rounded-full -mr-48 -mt-48" />

                        <div className="relative z-10 max-w-4xl">
                            <h2 className="text-4xl md:text-6xl font-black mb-12 uppercase leading-[0.9] tracking-tighter">
                                Se você se identifica <br /> com isso, o <span className="text-[#F26129]">RIC foi feito para você</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <PainPoint text="Sente que corre o dia todo, mas não sai do lugar?" />
                                <PainPoint text="Começa projetos com sede, mas abandona na 2ª semana?" />
                                <PainPoint text="O improviso é a sua única estratégia de produtividade?" />
                                <PainPoint text="Vive sobrecarregado pela culpa de não estar fazendo o suficiente?" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Tríade RIC - The Core "ID" */}
            <section className="relative py-32 px-6 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#F26129]/5 blur-[150px] rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-24">
                        <span className="text-[#F26129] font-black uppercase tracking-[0.3em] text-xs">O SISTEMA DEFINITIVO</span>
                        <h2 className="text-5xl md:text-8xl font-black mt-4 uppercase leading-none italic">A Tríade <span className="text-[#F26129]">RIC®</span></h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <RICSystemCard
                            number="01"
                            title="ROTA"
                            subtitle="Direção Estratégica"
                            icon={<Target className="w-10 h-10" />}
                            desc="Sem rota, você é apenas um passageiro. Aqui você define o seu norte real e elimina as distrações que te impedem de avançar."
                            color="#10B981"
                        />
                        <RICSystemCard
                            number="02"
                            title="IGNIÇÃO"
                            subtitle="Energia & Ação"
                            icon={<Zap className="w-10 h-10" />}
                            desc="Vença a inércia do começo. O sistema de ignição garante que você saia do papel com força e mantenha o ritmo constante."
                            color="#F26129"
                        />
                        <RICSystemCard
                            number="03"
                            title="CALIBRAGEM"
                            subtitle="Ajuste & Foco"
                            icon={<Split className="w-10 h-10" />}
                            desc="A vida real acontece. A calibragem te ensina a ajustar as velas em plena tempestade para nunca mais precisar recomeçar do zero."
                            color="#A855F7"
                        />
                    </div>
                </div>
            </section>

            {/* Comparison Section - Brands Decoded Style */}
            <section className="bg-white/5 border-y border-white/10 py-32 px-6 relative">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <h2 className="text-4xl md:text-7xl font-black mb-12 uppercase italic leading-none">
                            RIC vs <br /> <span className="text-white/20">Produtividade Tóxica.</span>
                        </h2>
                        <div className="space-y-6">
                            <ComparisonRow isRIC={false} text="Seguir rotinas inflexíveis de 'gurus' da internet" />
                            <ComparisonRow isRIC={false} text="Depender de picos de motivação passageira" />
                            <ComparisonRow isRIC={true} text="Sistema adaptável à sua rotina real e imperfeita" />
                            <ComparisonRow isRIC={true} text="Autopiloto de ação baseado na Tríade RIC" />
                        </div>
                        <Button
                            className="mt-14 h-16 px-12 border-2 border-[#F26129]/30 bg-[#F26129]/5 hover:bg-[#F26129]/10 text-[#F26129] rounded-2xl font-black uppercase text-sm tracking-widest transition-all"
                            onClick={() => window.open('https://pay.kiwify.com.br/vfjLBSg', '_blank')}
                        >
                            Escolher ser o AUTOR
                        </Button>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-0 bg-[#F26129]/20 blur-[100px] rounded-full group-hover:bg-[#F26129]/30 transition-all duration-700" />
                        <Card className="relative z-10 bg-black/80 border-white/10 backdrop-blur-3xl overflow-hidden rounded-[50px] shadow-2xl p-2 border-t-white/20">
                            <div className="p-12 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-[#F26129] flex items-center justify-center shadow-lg shadow-orange-500/20">
                                            <Zap className="w-8 h-8 text-white fill-white" />
                                        </div>
                                        <div>
                                            <div className="font-black text-xl leading-none mb-1">AUTORIA</div>
                                            <div className="text-[#F26129] text-[10px] font-black uppercase tracking-widest">Ativado</div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
                                        <Play className="w-4 h-4 text-white/40 fill-white/40" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            whileInView={{ width: '85%' }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-orange-400 to-[#F26129]"
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-tighter">
                                        <span>Progresso do Sistema</span>
                                        <span className="text-[#F26129]">85% TRAÇÃO</span>
                                    </div>
                                </div>

                                <div className="p-8 rounded-[32px] bg-white/5 border border-white/5 italic text-lg text-white/60 text-center leading-relaxed">
                                    "O RIC não faz o trabalho por você. Mas garante que o seu trabalho gere **resultado real**."
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Pricing Section - Modern Lotes */}
            <section className="py-32 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-5xl md:text-8xl font-black mb-6 uppercase tracking-tight italic">Sua Chance de <span className="text-[#F26129]">Decidir.</span></h2>
                        <p className="text-white/40 max-w-2xl mx-auto text-xl font-medium">Condição exclusiva de lançamento. O preço sobe automaticamente conforme as vagas acabam.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                        <LoteCard
                            num="1"
                            price="R$ 109"
                            label="100 Primeiras Vagas"
                            active={true}
                            desc="45% de Desconto Real"
                        />
                        <LoteCard
                            num="2"
                            price="R$ 147"
                            label="Próximas Vagas"
                            active={false}
                            desc="Preço de Lançamento"
                        />
                        <LoteCard
                            num="3"
                            price="R$ 197"
                            label="Vagas Finais"
                            active={false}
                            desc="Preço Oficial Pós-Lançamento"
                        />
                    </div>

                    <motion.div
                        whileHover={{ y: -5 }}
                        className="max-w-4xl mx-auto bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[48px] p-12 md:p-20 text-center relative overflow-hidden backdrop-blur-xl"
                    >
                        <div className="absolute top-0 left-0 bg-[#F26129] px-8 py-2 text-xs font-black uppercase text-white rounded-br-2xl tracking-widest shadow-lg">Lote 01 Ativado</div>

                        <div className="text-base font-black text-[#F26129] uppercase tracking-[0.4em] mb-6">INVESTIMENTO RIDÍCULO</div>
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <span className="text-white/20 text-2xl font-black line-through">R$ 197</span>
                            <div className="text-7xl md:text-9xl font-black text-white leading-none tracking-tighter">R$ 109</div>
                        </div>
                        <p className="text-white/40 text-lg mb-12 italic uppercase font-bold tracking-tight">Ou 12x de R$ 10,90 — Menos de R$ 0,40 por dia.</p>

                        <Button
                            className="h-24 w-full bg-[#F26129] hover:bg-[#F26129]/90 text-white rounded-[32px] text-2xl md:text-3xl font-black shadow-[0_30px_60px_rgba(242,97,41,0.3)] transition-all active:scale-95 uppercase tracking-tighter flex items-center justify-center gap-4"
                            onClick={() => window.open('https://pay.kiwify.com.br/vfjLBSg', '_blank')}
                        >
                            GARANTIR MINHA VAGA NO LOTE 1 <ArrowRight className="w-10 h-10" />
                        </Button>

                        <p className="mt-10 text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">Ambiente 100% Seguro • Acesso Imediato</p>
                    </motion.div>
                </div>
            </section>

            {/* FAQ Accordion - Clean & Modern */}
            <section className="py-32 px-6 border-t border-white/5 bg-white/[0.01]">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-6xl font-black mb-4 uppercase leading-none">Ainda tem <br /> <span className="text-[#F26129] italic">Dúvidas?</span></h2>
                    </div>

                    <Accordion type="single" collapsible className="space-y-4">
                        <AccordionItem value="item-1" className="bg-white/5 border-white/10 px-8 rounded-[32px] overflow-hidden">
                            <AccordionTrigger className="text-left font-black text-xl hover:no-underline py-8">Vou receber o acesso na hora?</AccordionTrigger>
                            <AccordionContent className="text-white/50 text-lg pb-8 leading-relaxed">Sim. O envio é automático e imediato. Assim que o pagamento for confirmado, você recebe as senhas no seu e-mail.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2" className="bg-white/5 border-white/10 px-8 rounded-[32px] overflow-hidden">
                            <AccordionTrigger className="text-left font-black text-xl hover:no-underline py-8">Não tenho muita disciplina, o RIC serve para mim?</AccordionTrigger>
                            <AccordionContent className="text-white/50 text-lg pb-8 leading-relaxed">Exatamente para você. O RIC não é sobre "disciplina militar", é sobre ter um SISTEMA que te puxa de volta para a rota quando você falha.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="bg-white/5 border-white/10 px-8 rounded-[32px] overflow-hidden">
                            <AccordionTrigger className="text-left font-black text-xl hover:no-underline py-8">Como funciona a garantia?</AccordionTrigger>
                            <AccordionContent className="text-white/50 text-lg pb-8 leading-relaxed">Risco zero. Você tem 7 dias para testar o sistema. Se sentir que não é para você, basta um clique dentro da plataforma para receber 100% do reembolso.</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </section>

            {/* Final Footer / Final CTA */}
            <footer className="py-40 px-6 text-center border-t border-white/10 relative bg-black overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-[#F26129]/50 to-transparent" />

                <div className="max-w-5xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        className="mb-14 inline-block"
                    >
                        <div className="w-20 h-20 rounded-3xl bg-[#F26129] flex items-center justify-center shadow-2xl shadow-orange-500/30 mx-auto">
                            <Zap className="text-white w-10 h-10 fill-white" />
                        </div>
                    </motion.div>

                    <h3 className="text-5xl md:text-8xl font-black mb-10 uppercase italic leading-[0.9] tracking-tighter">Chega de ser <br /> um <span className="text-[#F26129]">Espectador.</span></h3>
                    <p className="text-white/40 mb-16 text-xl md:text-2xl font-medium">Assuma o controle. Torne-se o Autor da sua própria história hoje.</p>

                    <Button
                        className="h-28 px-20 bg-white text-black hover:bg-white/90 rounded-[40px] text-3xl font-black shadow-[0_40px_80px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 uppercase tracking-tighter"
                        onClick={() => window.open('https://pay.kiwify.com.br/vfjLBSg', '_blank')}
                    >
                        QUERO O SISTEMA COMPLETO
                    </Button>

                    <div className="mt-32 flex flex-col md:flex-row items-center justify-center gap-10 text-white/20 text-[11px] font-black uppercase tracking-[0.4em] leading-none">
                        <span>MÉTODO RIC® 2026</span>
                        <div className="hidden md:block w-1.5 h-1.5 bg-white/10 rounded-full" />
                        <span>SISTEMA DE AUTORIA DE ALTO IMPACTO</span>
                        <div className="hidden md:block w-1.5 h-1.5 bg-white/10 rounded-full" />
                        <span>MTX ESTRATÉGIAS DIGITAIS</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Sub-components for cleaner structure
function PainPoint({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-5 group border-b border-white/5 pb-6">
            <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#F26129]/10 group-hover:border-[#F26129]/30 transition-all duration-300">
                <XCircle className="w-4 h-4 text-white/20 group-hover:text-[#F26129] transition-colors" />
            </div>
            <span className="text-lg md:text-xl font-bold text-white/60 leading-tight group-hover:text-white transition-colors">{text}</span>
        </div>
    );
}

function RICSystemCard({ number, title, subtitle, icon, desc, color }: { number: string; title: string; subtitle: string; icon: React.ReactNode; desc: string; color: string }) {
    return (
        <motion.div
            whileHover={{ y: -10 }}
            className="relative group h-full"
        >
            <Card className="bg-white/5 border-white/10 h-full backdrop-blur-xl rounded-[40px] overflow-hidden group-hover:bg-white/[0.08] transition-all duration-500 border-t-white/20">
                <CardContent className="p-12 flex flex-col items-center text-center">
                    <div className="absolute top-8 right-8 text-4xl font-black text-white/[0.03] leading-none select-none tracking-tighter font-sans">{number}</div>
                    <div className="mb-8 p-6 rounded-3xl bg-black/40 border border-white/5 shadow-2xl group-hover:shadow-[0_0_40px_rgba(var(--primary),0.2)] transition-all duration-500" style={{ color: color }}>
                        {icon}
                    </div>
                    <div className="mb-6">
                        <h4 className="text-[12px] font-black tracking-[0.4em] uppercase mb-2 font-sans" style={{ color: color }}>{subtitle}</h4>
                        <h3 className="text-5xl font-black italic font-sans">{title}</h3>
                    </div>
                    <p className="text-white/40 text-lg leading-relaxed font-medium">{desc}</p>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function ComparisonRow({ isRIC, text }: { isRIC: boolean; text: string }) {
    return (
        <div className="flex items-center gap-6 group">
            <div className={`flex-shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center transition-all duration-500 ${isRIC ? 'bg-[#F26129] text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-white/20'}`}>
                {isRIC ? <CheckCircle2 className="w-5 h-5 fill-white/20" /> : <div className="w-2.5 h-2.5 rounded-full bg-current" />}
            </div>
            <span className={`text-xl font-bold transition-all duration-300 ${isRIC ? 'text-white' : 'text-white/20 italic group-hover:text-white/40'}`}>{text}</span>
        </div>
    );
}

function LoteCard({ num, price, label, active, desc }: { num: string; price: string; label: string; active: boolean; desc: string }) {
    return (
        <Card className={`relative overflow-hidden transition-all duration-500 border-white/10 rounded-[32px] h-full ${active ? 'bg-white/5 p-[1px] shadow-2xl shadow-orange-500/10' : 'bg-white/2 opacity-30 grayscale hover:opacity-50 transition-opacity'}`}>
            {active && <div className="absolute inset-0 bg-gradient-to-br from-[#F26129]/20 to-transparent pointer-events-none" />}
            <CardContent className="p-10 relative z-10">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-8 items-center flex gap-2 font-sans">
                    <span>LOTE {num}</span>
                    <div className="h-[1px] flex-1 bg-white/10" />
                </div>
                <div className="text-4xl font-black mb-2 tracking-tighter font-sans">{price}</div>
                <div className={`text-[11px] font-black uppercase tracking-widest mb-6 font-sans ${active ? 'text-[#F26129]' : 'text-white/40'}`}>{label}</div>
                <div className="text-white/30 text-xs font-bold leading-relaxed">{desc}</div>
            </CardContent>
        </Card>
    );
}
