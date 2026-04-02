import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, BarChart3, Mail, ShoppingCart, Bot, MessageSquare, Building2,
  CheckCircle2, Clock, Loader2, Brain
} from "lucide-react";

interface Skill {
  id: string;
  name: string;
  platform: string | null;
  active: boolean | null;
  content: string;
}

interface SkillCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  skills: { name: string; displayName: string; installed: boolean }[];
}

const CATEGORIES: SkillCategory[] = [
  {
    id: "ads",
    label: "Ads & Tráfego",
    icon: Target,
    color: "text-red-500",
    skills: [
      { name: "paid-ads-meta", displayName: "Meta Ads — Core", installed: false },
      { name: "ad-creative", displayName: "Criativos de Anúncio", installed: false },
      { name: "copywriting", displayName: "Copywriting", installed: false },
      { name: "copy-editing", displayName: "Revisão de Copy", installed: false },
      { name: "marketing-psychology", displayName: "Psicologia de Marketing", installed: false },
      { name: "launch-strategy", displayName: "Estratégia de Lançamento", installed: false },
      { name: "pricing-strategy", displayName: "Estratégia de Preço", installed: false },
      { name: "competitor-alternatives", displayName: "Análise Competitiva", installed: false },
      { name: "marketing-ideas", displayName: "Ideias de Marketing", installed: false },
      { name: "social-content", displayName: "Conteúdo Orgânico", installed: false },
      { name: "popup-cro", displayName: "Popup CRO", installed: false },
      { name: "referral-program", displayName: "Programa de Indicação", installed: false },
      { name: "email-sequence", displayName: "Sequência de Email", installed: false },
      { name: "churn-prevention", displayName: "Prevenção de Churn", installed: false },
      { name: "google-ads", displayName: "Google Ads", installed: false },
      { name: "tiktok-ads", displayName: "TikTok Ads", installed: false },
      { name: "linkedin-ads", displayName: "LinkedIn Ads", installed: false },
    ],
  },
  {
    id: "analytics",
    label: "Analytics & CRO",
    icon: BarChart3,
    color: "text-blue-500",
    skills: [
      { name: "google-analytics-4", displayName: "Google Analytics 4", installed: false },
      { name: "google-search-console", displayName: "Google Search Console", installed: false },
      { name: "analytics-tracking", displayName: "Tracking & Eventos", installed: false },
      { name: "hotjar", displayName: "Hotjar", installed: false },
      { name: "optimizely", displayName: "Optimizely", installed: false },
      { name: "ab-test-setup", displayName: "Testes A/B", installed: false },
      { name: "page-cro", displayName: "CRO de Página", installed: false },
      { name: "signup-flow-cro", displayName: "CRO de Checkout", installed: false },
      { name: "onboarding-cro", displayName: "Onboarding CRO", installed: false },
      { name: "paywall-upgrade-cro", displayName: "Upsell & Cross-sell", installed: false },
      { name: "seo-audit", displayName: "Auditoria SEO", installed: false },
      { name: "seo-landing-page-audit", displayName: "Auditoria de Landing Page", installed: false },
      { name: "programmatic-seo", displayName: "SEO Programático", installed: false },
      { name: "schema-markup", displayName: "Schema Markup", installed: false },
    ],
  },
  {
    id: "crm",
    label: "CRM & Email",
    icon: Mail,
    color: "text-green-500",
    skills: [
      { name: "activecampaign", displayName: "ActiveCampaign", installed: false },
      { name: "klaviyo", displayName: "Klaviyo", installed: false },
      { name: "resend", displayName: "Resend", installed: false },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: ShoppingCart,
    color: "text-orange-500",
    skills: [
      { name: "shopify-integration", displayName: "Shopify", installed: false },
      { name: "stripe-payments", displayName: "Stripe", installed: false },
    ],
  },
  {
    id: "automation",
    label: "Automação",
    icon: Bot,
    color: "text-purple-500",
    skills: [
      { name: "n8n-automation", displayName: "N8N", installed: false },
      { name: "make-zapier", displayName: "Make / Zapier", installed: false },
      { name: "typeform", displayName: "Typeform", installed: false },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-500",
    skills: [
      { name: "evolution-api", displayName: "Evolution API", installed: false },
    ],
  },
  {
    id: "agency",
    label: "Agência",
    icon: Building2,
    color: "text-amber-500",
    skills: [
      { name: "cold-email", displayName: "Cold Email", installed: false },
      { name: "sales-enablement", displayName: "Materiais de Vendas", installed: false },
      { name: "free-tool-strategy", displayName: "Ferramentas Gratuitas", installed: false },
      { name: "product-marketing-context", displayName: "Contexto de Produto", installed: false },
    ],
  },
];

export default function SkillsHub() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("agent_skills")
      .select("id, name, platform, active, content")
      .then(({ data }) => {
        if (data) setSkills(data);
        setLoading(false);
      });
  }, []);

  const activeNames = new Set(skills.filter((s) => s.active).map((s) => s.name));

  const enriched = CATEGORIES.map((cat) => ({
    ...cat,
    skills: cat.skills.map((s) => ({ ...s, installed: activeNames.has(s.name) })),
  }));

  const totalSkills = enriched.reduce((a, c) => a + c.skills.length, 0);
  const installedSkills = enriched.reduce(
    (a, c) => a + c.skills.filter((s) => s.installed).length,
    0
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Skills Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Base de conhecimento do agente MTX — {installedSkills}/{totalSkills} skills ativas
            </p>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {installedSkills} ativas
          </Badge>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {enriched.map((cat) => {
            const Icon = cat.icon;
            const installed = cat.skills.filter((s) => s.installed).length;
            return (
              <Card key={cat.id} className="border-border/60">
                <CardContent className="p-3 text-center space-y-1">
                  <Icon className={`w-5 h-5 mx-auto ${cat.color}`} />
                  <p className="text-xs font-medium text-foreground truncate">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {installed}/{cat.skills.length}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ads" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {enriched.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {enriched.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.skills.map((skill) => (
                  <Card
                    key={skill.name}
                    className={`border-border/60 transition-colors ${
                      skill.installed ? "bg-primary/5" : "opacity-60"
                    }`}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {skill.installed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {skill.displayName}
                        </span>
                      </div>
                      <Badge
                        variant={skill.installed ? "default" : "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {skill.installed ? "Ativa" : "Pendente"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
