import { motion } from "framer-motion";
import {
    Sparkles,
    Instagram,
    Wand2,
    CheckCircle2,
    Play,
    Layout,
    Palette,
    ChevronRight,
    TrendingUp,
    Zap,
    Globe,
    Clock,
    ShieldCheck,
    MessageCircle,
    Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function LegacyLanding() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white overflow-hidden font-sans">
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
                        <span className="font-bold text-lg tracking-tight uppercase">Legacy <span className="text-primary italic">Combo™</span></span>
                    </div>
                    <Button
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex"
                        onClick={() => navigate("/auth")}
                    >
                        Sign In <ChevronRight className="ml-2 w-4 h-4" />
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
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase font-bold tracking-widest text-primary mb-8"
                    >
                        <Zap className="w-3 h-3" /> New Release: The AI Content Machine
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent"
                    >
                        Create Viral <br /> <span className="text-primary italic">Carousels</span> with AI.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="max-w-2xl mx-auto text-lg md:text-xl text-white/50 mb-12 leading-relaxed"
                    >
                        Stop guessing and start Growing. Master content creation, Instagram strategies, and AI automation for any niche in less than 10 minutes a day.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Button
                            className="h-16 px-10 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-black shadow-[0_20px_40px_rgba(var(--primary),0.3)] transition-all active:scale-95 flex items-center gap-3 uppercase tracking-tight"
                            onClick={() => window.open('https://pay.hotmart.com/V101063550Y?off=m0mpg7wy&checkoutMode=10', '_blank')}
                        >
                            Get Lifetime Access Now <Wand2 className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-4 text-white/40 text-xs font-medium uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Worldwide Support</span>
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Immediate Delivery</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Feature Grid - The 8-in-1 Combo */}
            <section className="relative pb-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-black mb-4">The <span className="text-primary italic">Legacy Combo™</span></h2>
                        <p className="text-white/40 font-medium">8 Premium Products in 1 Unified System</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <ComboCard
                            icon={<TrendingUp className="text-emerald-400" />}
                            title="Growth Strategy"
                            desc="Validated systems used across 25+ different market niches."
                        />
                        <ComboCard
                            icon={<Zap className="text-primary" />}
                            title="AI Prompt Engine"
                            desc="Optimized commands for GPT-4, Midjourney, and DALL-E."
                        />
                        <ComboCard
                            icon={<Layout className="text-purple-400" />}
                            title="Premium Templates"
                            desc="High-converting visual layouts ready for immediate use."
                        />
                        <ComboCard
                            icon={<MessageCircle className="text-blue-400" />}
                            title="Copywriting Frameworks"
                            desc="Psychological triggers that turn viewers into loyal clients."
                        />
                        <ComboCard
                            icon={<Users className="text-pink-400" />}
                            title="Niche Adaptation"
                            desc="How to apply these systems whether you are a creator or a brand."
                        />
                        <ComboCard
                            icon={<Instagram className="text-orange-400" />}
                            title="Visual DNA Analysis"
                            desc="Deconstruct the aesthetic of top-tier accounts instantly."
                        />
                        <ComboCard
                            icon={<Clock className="text-cyan-400" />}
                            title="Workflow Mastery"
                            desc="Slash your content production time from hours to minutes."
                        />
                        <ComboCard
                            icon={<ShieldCheck className="text-primary" />}
                            title="Live Sessions"
                            desc="Weekly live deep-dives into the latest AI and platform trends."
                        />
                    </div>
                </div>
            </section>

            {/* Comparison Section */}
            <section className="bg-white/5 border-y border-white/10 py-32 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <h2 className="text-4xl md:text-6xl font-black mb-10 leading-tight">
                            From Amateur to <br /> <span className="text-primary italic">Authority.</span>
                        </h2>
                        <div className="space-y-8">
                            <ComparisonItem
                                isPositive={false}
                                text="Posting in the dark without a clear content strategy"
                            />
                            <ComparisonItem
                                isPositive={false}
                                text="Hours spent on complicated design tools"
                            />
                            <ComparisonItem
                                isPositive={true}
                                text="Consistent publishing using ready-made systems"
                            />
                            <ComparisonItem
                                isPositive={true}
                                text="Premium aesthetics and lethal copywriting"
                            />
                        </div>
                        <Button
                            className="mt-12 h-14 px-10 border border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary rounded-2xl font-bold transition-all"
                            onClick={() => window.open('https://pay.hotmart.com/V101063550Y?off=m0mpg7wy&checkoutMode=10', '_blank')}
                        >
                            Stop Guessing, Start Dominating
                        </Button>
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
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-6 w-full bg-white/10 rounded-lg animate-pulse" />
                                        <div className="h-6 w-[70%] bg-white/10 rounded-lg animate-pulse" />
                                        <div className="aspect-square w-full bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center">
                                            <Sparkles className="w-12 h-12 text-white/10" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Social Proof / Case Studies */}
            <section className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-black mb-4 uppercase">Proven Success <span className="text-primary italic">Stories</span></h2>
                        <p className="text-white/40 max-w-2xl mx-auto font-medium">Join 20,000+ creators and brands who have transformed their digital presence.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <CaseStudy
                            handle="@makemusicnow"
                            niche="Music Production"
                            desc="Used our frameworks to create provocative carousels that blend premium aesthetics with sharp copy, building fast authority in a non-obvious market."
                        />
                        <CaseStudy
                            handle="@felipeclave"
                            niche="Marketing & Culture"
                            desc="Combines provocative copy with premium visual DNA to generate millions of views and viral growth in the highly competitive marketing niche."
                        />
                        <CaseStudy
                            handle="@startseoficial"
                            niche="Tech & Innovation"
                            desc="Transforms complex news into high-impact carousels using our system, strengthening brand leadership and authority through irresistible headlines."
                        />
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-32 px-6 bg-white/2">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black mb-16 text-center uppercase tracking-tight">Common <span className="text-primary italic">Questions</span></h2>
                    <Accordion type="single" collapsible className="space-y-4">
                        <AccordionItem value="item-1" className="border-white/10 bg-white/5 px-6 rounded-2xl">
                            <AccordionTrigger className="text-left font-bold text-lg hover:no-underline py-6">How long do I have access to the Legacy Combo™?</AccordionTrigger>
                            <AccordionContent className="text-white/50 pb-6">Lifetime access. You can watch and apply the content whenever you want, with no expiration date.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2" className="border-white/10 bg-white/5 px-6 rounded-2xl">
                            <AccordionTrigger className="text-left font-bold text-lg hover:no-underline py-6">Do I need previous marketing or design experience?</AccordionTrigger>
                            <AccordionContent className="text-white/50 pb-6">No! The Legacy Combo™ was built for beginners and advanced users alike. You get ready-made templates, scripts, and diagnostics.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="border-white/10 bg-white/5 px-6 rounded-2xl">
                            <AccordionTrigger className="text-left font-bold text-lg hover:no-underline py-6">Does it work for any niche?</AccordionTrigger>
                            <AccordionContent className="text-white/50 pb-6">Yes. Our systems are applied by digital businesses, physical stores, agencies, professionals, and individual creators. The method adapts to your positioning.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4" className="border-white/10 bg-white/5 px-6 rounded-2xl">
                            <AccordionTrigger className="text-left font-bold text-lg hover:no-underline py-6">Is there a guarantee?</AccordionTrigger>
                            <AccordionContent className="text-white/50 pb-6">Yes. You have a 7-day unconditional guarantee. If it's not for you, we refund 100% of your investment.</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </section>

            {/* Final CTA */}
            <footer className="py-32 px-6 text-center border-t border-white/5 relative bg-black">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="max-w-4xl mx-auto">
                    <h3 className="text-4xl md:text-6xl font-black mb-6 uppercase leading-tight">Ready to Own Your <br /> <span className="text-primary italic">Legacy?</span></h3>
                    <p className="text-white/50 mb-12 text-lg">One-time payment of <span className="text-white font-bold">$297</span> for lifetime access.</p>
                    <Button
                        className="h-20 px-16 bg-primary hover:bg-primary/90 text-white rounded-3xl text-2xl font-black shadow-[0_30px_60px_rgba(var(--primary),0.3)] transition-all active:scale-95 uppercase tracking-tight"
                        onClick={() => window.open('https://pay.hotmart.com/V101063550Y?off=m0mpg7wy&checkoutMode=10', '_blank')}
                    >
                        Start Your Transformation Now
                    </Button>
                    <div className="mt-20 flex flex-col md:flex-row items-center justify-center gap-8 text-white/20 text-xs font-bold uppercase tracking-widest">
                        <span>© 2026 MTX STRATEGIES</span>
                        <span className="hidden md:block w-1 h-1 bg-white/10 rounded-full" />
                        <span>COMMAND CENTER VISUAL LABS</span>
                        <span className="hidden md:block w-1 h-1 bg-white/10 rounded-full" />
                        <span>LEGACY COMBO™</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function ComboCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm transition-all hover:bg-white/10 hover:translate-y-[-8px] hover:border-primary/50 group cursor-default">
            <CardContent className="p-8">
                <div className="mb-6 p-4 rounded-2xl bg-black/50 border border-white/5 w-fit group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(var(--primary),0.2)] transition-all duration-500">
                    <div className="w-6 h-6">{icon}</div>
                </div>
                <h3 className="text-xl font-bold mb-3">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
            </CardContent>
        </Card>
    );
}

function ComparisonItem({ isPositive, text }: { isPositive: boolean; text: string }) {
    return (
        <div className="flex items-center gap-5 group">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isPositive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'}`}>
                {isPositive ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
            </div>
            <span className={`text-lg font-medium ${isPositive ? 'text-white/90' : 'text-white/30 italic strike-through'}`}>{text}</span>
        </div>
    );
}

function CaseStudy({ handle, niche, desc }: { handle: string; niche: string; desc: string }) {
    return (
        <Card className="bg-white/2 border-white/5 hover:border-white/10 transition-colors">
            <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="font-bold text-lg">{handle}</div>
                        <div className="text-primary text-[10px] uppercase font-black tracking-widest leading-none">{niche}</div>
                    </div>
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </CardContent>
        </Card>
    );
}
