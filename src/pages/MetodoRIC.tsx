import { motion } from "framer-motion";
import {
    Sparkles,
    CheckCircle2,
    ChevronRight,
    Zap,
    Globe,
    Clock,
    ShieldCheck,
    Target,
    ArrowRight,
    Settings,
    XCircle,
    Brain,
    Navigation,
    Award,
    Star,
    MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

/* ───────────────────────── MAIN COMPONENT ───────────────────────── */
export default function MetodoRIC() {
    const navigate = useNavigate();
    const kiwifyUrl = "https://pay.kiwify.com.br/vfjLBSg";

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#F26129]/30 selection:text-white overflow-hidden font-sans">
            {/* ── Background ambient glow ── */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#F26129]/15 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-700/10 rounded-full blur-[120px]" />
            </div>

            {/* ═══════════════════ NAV ═══════════════════ */}
            <nav className="relative z-50 border-b border-white/5 bg-black/50 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#F26129] flex items-center justify-center shadow-[0_0_24px_rgba(242,97,41,0.5)]">
                            <Zap className="text-white w-6 h-6 fill-white" />
                        </div>
                        <span className="font-black text-xl tracking-tighter uppercase">
                            MÉTODO <span className="text-[#F26129] italic">RIC®</span>
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-white/5 hidden sm:flex font-bold"
                        onClick={() => navigate("/auth")}
                    >
                        Área de Alunos <ChevronRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </nav>

            {/* ═══════════════════ HERO ═══════════════════ */}
            <section className="relative pt-24 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase font-black tracking-[0.2em] text-[#F26129] mb-10"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> O Primeiro Sistema de Autoria
                        do Brasil
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl md:text-7xl lg:text-[7rem] font-black mb-8 leading-[0.95] tracking-tighter"
                    >
                        Pare de tentar ser <br />
                        <span className="text-[#F26129] italic">"produtivo"</span>
                    </motion.h1>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-2xl md:text-5xl font-black mb-10 text-white/95 leading-tight tracking-tight px-4"
                    >
                        Comece a ser o{" "}
                        <span className="underline decoration-[#F26129] decoration-[6px] underline-offset-8">
                            Autor
                        </span>{" "}
                        da sua própria vida.
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="max-w-3xl mx-auto text-lg md:text-xl text-white/80 mb-14 leading-relaxed font-medium"
                    >
                        A Tríade RIC ataca os 3 pilares da Autoria: Rota, Ignição e
                        Calibragem — para quem está cansado de começar e parar no meio do
                        caminho.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col items-center justify-center gap-8"
                    >
                        <Button
                            className="h-20 px-14 bg-[#F26129] hover:bg-[#F26129]/90 text-white rounded-[32px] text-xl font-black shadow-[0_20px_50px_rgba(242,97,41,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-tight"
                            onClick={() => window.open(kiwifyUrl, "_blank")}
                        >
                            Quero me tornar AUTOR agora <ArrowRight className="w-7 h-7" />
                        </Button>

                        <div className="flex flex-wrap items-center justify-center gap-6 text-white/70 text-[10px] font-black uppercase tracking-widest">
                            <span className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-[#F26129]" /> Acesso Vitalício
                            </span>
                            <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#F26129]" /> Entrega Automática
                            </span>
                            <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#F26129]" /> 7 Dias de
                                Garantia
                            </span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════ PAIN POINTS ═══════════════════ */}
            <section className="relative py-28 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white/[0.04] border border-white/10 rounded-[40px] p-10 md:p-20 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F26129]/10 blur-[100px] rounded-full -mr-48 -mt-48" />

                        <div className="relative z-10 max-w-4xl">
                            <motion.h2
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6 }}
                                className="text-3xl md:text-5xl font-black mb-12 uppercase leading-[0.95] tracking-tight"
                            >
                                Se você se identifica com isso, o{" "}
                                <span className="text-[#F26129]">RIC foi feito para você</span>
                            </motion.h2>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-8"
                            >
                                <PainPoint text="Sente que corre o dia todo, mas não sai do lugar?" />
                                <PainPoint text="Começa projetos com sede, mas abandona na 2ª semana?" />
                                <PainPoint text="O improviso é a sua única estratégia de produtividade?" />
                                <PainPoint text="Vive sobrecarregado pela culpa de não estar fazendo o suficiente?" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════ CICLO IMPOSSÍVEL ═══════════════════ */}
            <section className="py-28 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <motion.h2
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4"
                        >
                            E você está preso em um{" "}
                            <span className="text-[#F26129] italic">ciclo impossível</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                            className="text-white/80 max-w-3xl mx-auto text-lg font-medium"
                        >
                            Quando percebe que precisa mudar, geralmente procura uma dessas 3
                            opções. Mas nenhuma funciona de verdade:
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
                    >
                        <CycleOption
                            title="Conteúdo Grátis"
                            problems={[
                                "Informação desconexa e genérica",
                                "Sem acompanhamento",
                                "Sensação eterna de 'tá faltando algo'",
                            ]}
                        />
                        <CycleOption
                            title="Cursos Tradicionais"
                            problems={[
                                "Teoria demais, prática de menos",
                                "Não se adapta à SUA rotina",
                                "Você assiste, anota... e esquece",
                            ]}
                        />
                        <CycleOption
                            title="Mentoria Cara"
                            problems={[
                                "Investimento de R$3.000+",
                                "Nem sempre é personalizada de verdade",
                                "Depende da agenda de outra pessoa",
                            ]}
                        />
                    </motion.div>

                    <div className="bg-white/[0.04] border border-white/10 rounded-[32px] p-10 md:p-16 text-center">
                        <h3 className="text-2xl md:text-3xl font-black mb-4 uppercase">
                            Enquanto isso acontece...
                        </h3>
                        <p className="text-white/80 text-lg font-medium mb-2">
                            Pessoas que implementaram o RIC estão:
                        </p>
                        <p className="text-white/90 text-xl font-black leading-relaxed">
                            Você fica para trás. Não por falta de talento.{" "}
                            <span className="text-[#F26129]">Por falta de SISTEMA.</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* ═══════════════════ AUTHORITY / QUEM CRIOU ═══════════════════ */}
            <section className="py-28 px-6 bg-white/[0.02] border-y border-white/5">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <span className="text-[#F26129] text-xs font-black uppercase tracking-[0.3em] mb-4 block">
                            Quem criou o Método RIC
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black mb-8 leading-tight">
                            Foi estudando comportamento humano e gestão de tempo que eu
                            desenvolvi a{" "}
                            <span className="text-[#F26129] italic">Tríade RIC</span>
                        </h2>
                        <p className="text-white/85 text-lg leading-relaxed mb-10 font-medium">
                            O problema da maioria dos métodos é que eles focam só na execução.
                            Mas execução sem direção é apenas velocidade em direção ao abismo.
                        </p>

                        <div className="space-y-4">
                            <AuthorityItem text="Formado em Análise de Perfil Comportamental" />
                            <AuthorityItem text="Certificação pela FEBRACIS em Gestão de Pessoas com foco em Perfil Comportamental" />
                            <AuthorityItem text="Especialista em Comportamento Humano" />
                            <AuthorityItem text="Anos de estudo em neuroplasticidade, hábitos e gestão de tempo aplicados à vida real" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-[#F26129]/10 blur-[80px] rounded-full" />
                        <Card className="relative z-10 bg-black/60 border-white/10 backdrop-blur-xl rounded-[40px] overflow-hidden">
                            <CardContent className="p-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26129] to-orange-700 flex items-center justify-center shadow-lg">
                                        <Award className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-black text-lg">Criador do RIC</div>
                                        <div className="text-[#F26129] text-[10px] font-black uppercase tracking-widest">
                                            Especialista em Comportamento
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-white/80 text-base italic leading-relaxed">
                                    "Eu criei o RIC porque cansei de ver gente talentosa
                                    patinando. Não faltava motivação — faltava um sistema que
                                    respeitasse a realidade imperfeita de cada um."
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════ TRÍADE RIC ═══════════════════ */}
            <section className="relative py-28 px-6 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#F26129]/5 blur-[150px] rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-20"
                    >
                        <span className="text-[#F26129] font-black uppercase tracking-[0.3em] text-xs">
                            O SISTEMA DEFINITIVO
                        </span>
                        <h2 className="text-4xl md:text-7xl font-black mt-4 uppercase leading-none">
                            O RIC funciona porque ataca os{" "}
                            <span className="text-[#F26129] italic">
                                3 pilares da Autoria
                            </span>
                        </h2>
                        <p className="text-white/80 max-w-3xl mx-auto mt-6 text-lg font-medium">
                            Não é mais um curso de produtividade. É o sistema que te coloca no
                            comando da sua própria história.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <RICSystemCard
                            number="01"
                            title="ROTA"
                            subtitle="O GPS da Vida"
                            icon={<Navigation className="w-10 h-10" />}
                            desc="Defina a sua 'Única Coisa' — a meta principal que torna as outras irrelevantes. Clareza mata ansiedade."
                            highlight="Sem rota, você é apenas um passageiro."
                            color="#10B981"
                        />
                        <RICSystemCard
                            number="02"
                            title="IGNIÇÃO"
                            subtitle="O Motor que te Move"
                            icon={<Zap className="w-10 h-10" />}
                            desc="Rituais que 'hackeiam' seu cérebro para entrar em estado de fluxo rápido — independente da 'vontade' ou dos 'dias ruins'."
                            highlight="Vença a inércia do começo."
                            color="#F26129"
                        />
                        <RICSystemCard
                            number="03"
                            title="CALIBRAGEM"
                            subtitle="O Volante que te Corrige"
                            icon={<Settings className="w-10 h-10" />}
                            desc="Protocolo para te recolocar nos trilhos depois de falhar — sem culpa, sem drama. A maioria dos cursos ignora essa parte."
                            highlight="Nunca mais recomece do zero."
                            color="#A855F7"
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════ BÔNUS EXCLUSIVOS ═══════════════════ */}
            <section className="py-28 px-6 bg-white/[0.02] border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <span className="text-[#F26129] text-xs font-black uppercase tracking-[0.3em]">
                            Bônus Exclusivos
                        </span>
                        <h2 className="text-3xl md:text-5xl font-black mt-4 uppercase tracking-tight">
                            Você ainda leva R$164 em bônus —{" "}
                            <span className="text-[#F26129] italic">de graça</span>
                        </h2>
                        <p className="text-white/80 max-w-2xl mx-auto mt-4 text-lg font-medium">
                            Materiais complementares que aceleram seus resultados e atacam
                            problemas específicos.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                        <BonusCard
                            tag="Bônus #1"
                            title="As Duas Mentalidades + A Ciência da Neuroplasticidade"
                            description="Entenda por que seu cérebro sabota suas metas — e como reprogramá-lo usando ciência real."
                            highlight="Valor: R$67"
                            icon={<Brain className="w-8 h-8" />}
                        />
                        <BonusCard
                            tag="Bônus #2"
                            title="O Botão Desligar (Workshop)"
                            description="Aprenda a descansar de verdade — e voltar com mais energia do que quando parou."
                            highlight="Valor: R$47"
                            icon={<Star className="w-8 h-8" />}
                        />
                        <BonusCard
                            tag="Bônus #3"
                            title="O Mapa das Prioridades Reais"
                            description="Ferramenta prática para eliminar as tarefas irrelevantes e focar no que realmente move a agulha."
                            highlight="Valor: R$50"
                            icon={<MapPin className="w-8 h-8" />}
                        />
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════ CURRÍCULO ═══════════════════ */}
            <section className="py-28 px-6 relative">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
                            Veja o{" "}
                            <span className="text-[#F26129] italic">
                                currículo completo
                            </span>
                        </h2>
                    </motion.div>

                    <Accordion type="single" collapsible className="space-y-4">
                        <CurriculumModule
                            num="01"
                            title="Fundamentos da Autoria"
                            bullets={[
                                "Por que a produtividade tradicional não funciona",
                                "O que é ser Autor vs ser Espectador",
                                "A Tríade RIC explicada",
                            ]}
                        />
                        <CurriculumModule
                            num="02"
                            title="ROTA — Definindo seu Norte"
                            bullets={[
                                "A técnica da Única Coisa",
                                "Como eliminar metas parasitas",
                                "Criando o seu mapa de 90 dias",
                            ]}
                        />
                        <CurriculumModule
                            num="03"
                            title="IGNIÇÃO — Saindo do Papel"
                            bullets={[
                                "Rituais de ativação diária",
                                "Estado de fluxo sob demanda",
                                "O protocolo dos 15 minutos",
                            ]}
                        />
                        <CurriculumModule
                            num="04"
                            title="CALIBRAGEM — Ajuste Contínuo"
                            bullets={[
                                "O que fazer quando você falha",
                                "Protocolo de recalibração semanal",
                                "Eliminando a culpa que trava",
                            ]}
                        />
                        <CurriculumModule
                            num="05"
                            title="Integração e Vida Real"
                            bullets={[
                                "Adaptando o sistema à SUA rotina",
                                "Como manter o ritmo em semanas ruins",
                                "O ciclo de melhoria contínua do Autor",
                            ]}
                        />
                    </Accordion>
                </div>
            </section>

            {/* ═══════════════════ COMPARAÇÃO DE PREÇO ═══════════════════ */}
            <section className="py-28 px-6 bg-white/[0.02] border-y border-white/5">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
                            Por que R$109 é um{" "}
                            <span className="text-[#F26129] italic">
                                investimento ridículo
                            </span>
                        </h2>
                        <p className="text-white/80 max-w-2xl mx-auto text-lg font-medium">
                            Compare com o que você pagaria por alternativas que entregam muito
                            menos:
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        <ComparisonItem
                            name="Sessão de Coaching"
                            detail="R$300 - R$500 por sessão"
                        />
                        <ComparisonItem
                            name="Curso de Produtividade"
                            detail="R$497 a R$997 (sem suporte)"
                        />
                        <ComparisonItem
                            name="Mentoria Individual"
                            detail="R$2.000 a R$5.000 por mês"
                        />
                        <ComparisonItem
                            name="Terapia Comportamental"
                            detail="R$250 - R$400 por sessão"
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="mt-12 text-center"
                    >
                        <p className="text-white/90 text-2xl font-black">
                            O RIC entrega um sistema completo por{" "}
                            <span className="text-[#F26129] text-4xl">R$ 109</span>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════ PRICING ═══════════════════ */}
            <section className="py-28 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-20"
                    >
                        <h2 className="text-4xl md:text-7xl font-black mb-6 uppercase tracking-tight italic">
                            Sua Chance de <span className="text-[#F26129]">Decidir.</span>
                        </h2>
                        <p className="text-white/80 max-w-2xl mx-auto text-xl font-medium">
                            Condição exclusiva de lançamento. O preço sobe automaticamente
                            conforme as vagas acabam.
                        </p>
                    </motion.div>

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
                        whileHover={{ y: -4 }}
                        className="max-w-4xl mx-auto bg-gradient-to-br from-white/10 to-white/[0.04] border border-white/10 rounded-[40px] p-10 md:p-16 text-center relative overflow-hidden backdrop-blur-xl"
                    >
                        <div className="absolute top-0 left-0 bg-[#F26129] px-6 py-2 text-xs font-black uppercase text-white rounded-br-2xl tracking-widest shadow-lg">
                            Lote 01 Ativado
                        </div>

                        <div className="text-sm font-black text-[#F26129] uppercase tracking-[0.4em] mb-6 mt-4">
                            INVESTIMENTO RIDÍCULO
                        </div>
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <span className="text-white/20 text-2xl font-black line-through">
                                R$ 197
                            </span>
                            <div className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter">
                                R$ 109
                            </div>
                        </div>
                        <p className="text-white/80 text-base mb-10 italic uppercase font-bold tracking-tight">
                            Ou 12x de R$ 10,90 — Menos de R$ 0,40 por dia.
                        </p>

                        <Button
                            className="h-20 w-full bg-[#F26129] hover:bg-[#F26129]/90 text-white rounded-[28px] text-xl md:text-2xl font-black shadow-[0_30px_60px_rgba(242,97,41,0.3)] transition-all active:scale-95 uppercase tracking-tight flex items-center justify-center gap-4"
                            onClick={() => window.open(kiwifyUrl, "_blank")}
                        >
                            GARANTIR MINHA VAGA NO LOTE 1{" "}
                            <ArrowRight className="w-8 h-8" />
                        </Button>

                        <p className="mt-8 text-[10px] text-white/50 font-black uppercase tracking-[0.3em]">
                            Ambiente 100% Seguro • Acesso Imediato
                        </p>
                    </motion.div>
                </div>
            </section >

            {/* ═══════════════════ GARANTIA ═══════════════════ */}
            < section className="py-20 px-6" >
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="max-w-3xl mx-auto text-center bg-white/[0.04] border border-white/10 rounded-[40px] p-10 md:p-16"
                >
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-3xl font-black uppercase mb-4">
                        Garantia Incondicional de{" "}
                        <span className="text-emerald-400">7 Dias</span>
                    </h3>
                    <p className="text-white/85 text-lg leading-relaxed font-medium">
                        Se dentro de 7 dias você sentir que o RIC não é para você, basta
                        pedir o reembolso com um clique na plataforma. Sem perguntas, sem
                        burocracia, sem ressentimento. 100% do seu dinheiro de volta.
                    </p>
                </motion.div>
            </section >

            {/* ═══════════════════ FAQ COMPLETO ═══════════════════ */}
            < section className="py-28 px-6 border-t border-white/5" >
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <span className="text-[#F26129] text-xs font-black uppercase tracking-[0.3em]">
                            Ainda tem dúvida?
                        </span>
                        <h2 className="text-3xl md:text-5xl font-black mt-4 uppercase leading-none">
                            Talvez você esteja{" "}
                            <span className="text-[#F26129] italic">pensando...</span>
                        </h2>
                    </motion.div>

                    <Accordion type="single" collapsible className="space-y-4">
                        <FAQItem
                            value="faq-1"
                            q="Vou receber o acesso na hora?"
                            a="Sim. O envio é automático e imediato. Assim que o pagamento for confirmado, você recebe as senhas no seu e-mail."
                        />
                        <FAQItem
                            value="faq-2"
                            q="Não tenho muita disciplina, o RIC serve para mim?"
                            a='Exatamente para você. O RIC não é sobre "disciplina militar", é sobre ter um SISTEMA que te puxa de volta para a rota quando você falha.'
                        />
                        <FAQItem
                            value="faq-3"
                            q="Como funciona a garantia?"
                            a="Risco zero. Você tem 7 dias para testar o sistema. Se sentir que não é para você, basta um clique dentro da plataforma para receber 100% do reembolso."
                        />
                        <FAQItem
                            value="faq-4"
                            q="É um curso de produtividade?"
                            a="Não. O RIC é um sistema de Autoria. Produtividade é sobre fazer mais. Autoria é sobre fazer o que importa, do seu jeito, com consistência."
                        />
                        <FAQItem
                            value="faq-5"
                            q="Funciona para qualquer área da vida?"
                            a="Sim. O RIC foi testado por empreendedores, estudantes, profissionais CLT e freelancers. O sistema se adapta à sua realidade, não o contrário."
                        />
                        <FAQItem
                            value="faq-6"
                            q="E se eu já fiz outros cursos e não deu certo?"
                            a="Provavelmente porque faltava o pilar da Calibragem. A maioria dos cursos te ensina a começar, mas não te ensina a voltar depois de falhar. O RIC resolve isso."
                        />
                    </Accordion>
                </div>
            </section >

            {/* ═══════════════════ FINAL CTA ═══════════════════ */}
            < footer className="py-32 px-6 text-center border-t border-white/10 relative bg-black overflow-hidden" >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-[#F26129]/50 to-transparent" />

                <div className="max-w-5xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        className="mb-12 inline-block"
                    >
                        <div className="w-20 h-20 rounded-3xl bg-[#F26129] flex items-center justify-center shadow-2xl shadow-orange-500/30 mx-auto">
                            <Zap className="text-white w-10 h-10 fill-white" />
                        </div>
                    </motion.div>

                    <h3 className="text-4xl md:text-7xl font-black mb-8 uppercase italic leading-[0.9] tracking-tighter">
                        Chega de ser <br /> um{" "}
                        <span className="text-[#F26129]">Espectador.</span>
                    </h3>
                    <p className="text-white/80 mb-14 text-xl md:text-2xl font-medium">
                        Assuma o controle. Torne-se o Autor da sua própria história hoje.
                    </p>

                    <Button
                        className="h-24 px-16 bg-white text-black hover:bg-white/90 rounded-[36px] text-2xl font-black shadow-[0_40px_80px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 uppercase tracking-tight"
                        onClick={() => window.open(kiwifyUrl, "_blank")}
                    >
                        QUERO O SISTEMA COMPLETO
                    </Button>

                    <div className="mt-16 text-white/50 text-xs leading-relaxed max-w-xl mx-auto font-medium">
                        © {new Date().getFullYear()} Método RIC · Todos os direitos
                        reservados
                        <br />
                        Este produto não garante a obtenção de resultados. Qualquer
                        referência ao desempenho é apenas ilustrativa.
                    </div>

                    <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-8 text-white/20 text-[11px] font-black uppercase tracking-[0.4em] leading-none">
                        <span>MÉTODO RIC® 2026</span>
                        <div className="hidden md:block w-1.5 h-1.5 bg-white/10 rounded-full" />
                        <span>SISTEMA DE AUTORIA DE ALTO IMPACTO</span>
                        <div className="hidden md:block w-1.5 h-1.5 bg-white/10 rounded-full" />
                        <span>MTX ESTRATÉGIAS DIGITAIS</span>
                    </div>
                </div>
            </footer >
        </div >
    );
}

/* ════════════════════════════════════════ SUB-COMPONENTS ════════════════════════════════════════ */

function PainPoint({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-4 group border-b border-white/5 pb-6">
            <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#F26129]/10 group-hover:border-[#F26129]/30 transition-all duration-300">
                <XCircle className="w-4 h-4 text-white/30 group-hover:text-[#F26129] transition-colors" />
            </div>
            <span className="text-base md:text-lg font-bold text-white/80 leading-snug group-hover:text-white transition-colors">
                {text}
            </span>
        </div>
    );
}

function CycleOption({
    title,
    problems,
}: {
    title: string;
    problems: string[];
}) {
    return (
        <Card className="bg-white/[0.04] border-white/10 rounded-[28px] overflow-hidden hover:bg-white/[0.06] transition-colors">
            <CardContent className="p-8">
                <h4 className="text-xl font-black mb-6 text-white/90">{title}</h4>
                <div className="space-y-3">
                    {problems.map((p, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <XCircle className="w-4 h-4 text-red-400/70 mt-0.5 flex-shrink-0" />
                            <span className="text-white/80 text-sm font-medium leading-snug">
                                {p}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function AuthorityItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-4">
            <CheckCircle2 className="w-5 h-5 text-[#F26129] flex-shrink-0" />
            <span className="text-white/80 font-medium text-base">{text}</span>
        </div>
    );
}

function RICSystemCard({
    number,
    title,
    subtitle,
    icon,
    desc,
    highlight,
    color,
}: {
    number: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    desc: string;
    highlight: string;
    color: string;
}) {
    return (
        <motion.div whileHover={{ y: -8 }} className="relative group h-full">
            <Card className="bg-white/[0.04] border-white/10 h-full backdrop-blur-xl rounded-[36px] overflow-hidden group-hover:bg-white/[0.07] transition-all duration-500">
                <CardContent className="p-10 flex flex-col items-center text-center">
                    <div className="absolute top-6 right-8 text-4xl font-black text-white/[0.04] leading-none select-none tracking-tighter">
                        {number}
                    </div>
                    <div
                        className="mb-6 p-5 rounded-2xl bg-black/40 border border-white/5 shadow-xl group-hover:shadow-[0_0_40px_rgba(242,97,41,0.15)] transition-all duration-500"
                        style={{ color }}
                    >
                        {icon}
                    </div>
                    <div className="mb-4">
                        <h4
                            className="text-[11px] font-black tracking-[0.3em] uppercase mb-2"
                            style={{ color }}
                        >
                            {subtitle}
                        </h4>
                        <h3 className="text-4xl font-black italic">{title}</h3>
                    </div>
                    <p className="text-white/80 text-base leading-relaxed font-medium mb-4">
                        {desc}
                    </p>
                    <p
                        className="text-sm font-black italic"
                        style={{ color }}
                    >
                        {highlight}
                    </p>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function BonusCard({
    tag,
    title,
    description,
    highlight,
    icon,
}: {
    tag: string;
    title: string;
    description: string;
    highlight: string;
    icon: React.ReactNode;
}) {
    return (
        <Card className="bg-white/[0.04] border-white/10 rounded-[28px] overflow-hidden hover:bg-white/[0.07] transition-all duration-300 group">
            <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-[#F26129]/10 text-[#F26129] group-hover:bg-[#F26129]/20 transition-colors">
                        {icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#F26129]">
                        {tag}
                    </span>
                </div>
                <h4 className="text-lg font-black mb-3 text-white/90 leading-snug">
                    {title}
                </h4>
                <p className="text-white/80 text-sm leading-relaxed font-medium mb-4">
                    {description}
                </p>
                <span className="text-[#F26129] text-sm font-black italic">
                    {highlight}
                </span>
            </CardContent>
        </Card>
    );
}

function CurriculumModule({
    num,
    title,
    bullets,
}: {
    num: string;
    title: string;
    bullets: string[];
}) {
    return (
        <AccordionItem
            value={`mod-${num}`}
            className="bg-white/[0.04] border-white/10 px-6 rounded-[24px] overflow-hidden"
        >
            <AccordionTrigger className="text-left font-black text-lg hover:no-underline py-6">
                <span className="flex items-center gap-4">
                    <span className="text-[#F26129] text-sm font-black tracking-widest">
                        {num}
                    </span>
                    <span className="text-white/90">{title}</span>
                </span>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
                <ul className="space-y-2 pl-12">
                    {bullets.map((b, i) => (
                        <li key={i} className="flex items-center gap-2 text-white/80 text-sm font-medium">
                            <span className="text-[#F26129]">•</span> {b}
                        </li>
                    ))}
                </ul>
            </AccordionContent>
        </AccordionItem>
    );
}

function ComparisonItem({ name, detail }: { name: string; detail: string }) {
    return (
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.06] transition-colors">
            <span className="text-white/80 font-bold text-base">{name}</span>
            <span className="text-white/70 text-sm font-medium">{detail}</span>
        </div>
    );
}

function LoteCard({
    num,
    price,
    label,
    active,
    desc,
}: {
    num: string;
    price: string;
    label: string;
    active: boolean;
    desc: string;
}) {
    return (
        <Card
            className={`relative overflow-hidden transition-all duration-500 border-white/10 rounded-[28px] h-full ${active
                ? "bg-white/[0.06] shadow-2xl shadow-orange-500/10"
                : "bg-white/[0.02] opacity-40 grayscale hover:opacity-60"
                }`}
        >
            {active && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#F26129]/15 to-transparent pointer-events-none" />
            )}
            <CardContent className="p-8 relative z-10">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-6 flex items-center gap-2">
                    <span>LOTE {num}</span>
                    <div className="h-[1px] flex-1 bg-white/10" />
                </div>
                <div className="text-4xl font-black mb-2 tracking-tighter text-white/95">
                    {price}
                </div>
                <div
                    className={`text-[11px] font-black uppercase tracking-widest mb-4 ${active ? "text-[#F26129]" : "text-white/40"
                        }`}
                >
                    {label}
                </div>
                <div className="text-white/60 text-xs font-bold leading-relaxed">
                    {desc}
                </div>
            </CardContent>
        </Card>
    );
}

function FAQItem({ value, q, a }: { value: string; q: string; a: string }) {
    return (
        <AccordionItem
            value={value}
            className="bg-white/[0.04] border-white/10 px-8 rounded-[24px] overflow-hidden"
        >
            <AccordionTrigger className="text-left font-black text-lg hover:no-underline py-7 text-white/90">
                {q}
            </AccordionTrigger>
            <AccordionContent className="text-white/80 text-base pb-7 leading-relaxed font-medium">
                {a}
            </AccordionContent>
        </AccordionItem>
    );
}
