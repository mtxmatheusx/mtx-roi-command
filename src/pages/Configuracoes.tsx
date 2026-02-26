import { useState } from "react";
import { Eye, EyeOff, Shield, Save, Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const configSchema = z.object({
  adAccountId: z.string().min(1, "ID da conta é obrigatório").regex(/^act_/, "Deve começar com act_"),
  pixelId: z.string().optional(),
  cpaMeta: z.number().min(0.01, "CPA Meta deve ser maior que 0"),
  ticketMedio: z.number().min(0.01, "Ticket Médio deve ser maior que 0"),
  limiteEscala: z.number().min(1).max(100, "Limite deve ser entre 1% e 100%"),
});

export default function Configuracoes() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    adAccountId: "act_",
    pixelId: "",
    cpaMeta: "45",
    ticketMedio: "697",
    limiteEscala: "15",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = () => {
    const parsed = configSchema.safeParse({
      ...form,
      cpaMeta: Number(form.cpaMeta),
      ticketMedio: Number(form.ticketMedio),
      limiteEscala: Number(form.limiteEscala),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        if (e.path[0]) fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Save to localStorage for now (config params, not secrets)
    localStorage.setItem("mtx_config", JSON.stringify(parsed.data));
    toast({ title: "✅ Configurações salvas", description: "Parâmetros de automação atualizados." });
  };

  const handleTestConnection = async () => {
    if (!form.adAccountId || form.adAccountId === "act_") {
      toast({ title: "Erro", description: "Preencha o Ad Account ID.", variant: "destructive" });
      return;
    }
    setTestResult("loading");
    try {
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { adAccountId: form.adAccountId, datePreset: "last_7d" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult("success");
      toast({
        title: "✅ Conexão OK",
        description: `${data.total} campanhas encontradas.`,
      });
    } catch (err) {
      setTestResult("error");
      toast({
        title: "❌ Falha na conexão",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações de API</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure a conexão com a Meta Ads e as regras de automação.
          </p>
        </div>

        {/* API Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-neon-red" />
              Credenciais Meta Ads
            </CardTitle>
            <CardDescription>
              O token de acesso está armazenado como secret seguro no Cloud. Configure abaixo o Ad Account ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm text-emerald-400">Access Token configurado como secret seguro no Cloud</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adAccountId">Ad Account ID</Label>
                <Input
                  id="adAccountId"
                  placeholder="act_123456789"
                  value={form.adAccountId}
                  onChange={(e) => handleChange("adAccountId", e.target.value)}
                  className="font-mono text-sm"
                />
                {errors.adAccountId && <p className="text-xs text-destructive">{errors.adAccountId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixelId">Pixel ID (opcional)</Label>
                <Input
                  id="pixelId"
                  placeholder="123456789012345"
                  value={form.pixelId}
                  onChange={(e) => handleChange("pixelId", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testResult === "loading"}
                className="gap-2"
              >
                {testResult === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Testar Conexão
              </Button>
              {testResult === "success" && <span className="text-sm text-emerald-400">✓ Conectado</span>}
              {testResult === "error" && <span className="text-sm text-destructive">✗ Falha</span>}
            </div>

            <p className="text-xs text-muted-foreground">
              Campos mapeados: <code className="text-neon-red/80">spend, cpc, cpm, ctr, actions:purchase, actions:initiate_checkout, actions:add_to_cart</code>
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Automation Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de Automação</CardTitle>
            <CardDescription>
              Defina os limites para pausa inteligente, escala automática e alertas do Agente MTX.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpaMeta">CPA Meta (R$)</Label>
                <Input id="cpaMeta" type="number" min="0.01" step="0.01" value={form.cpaMeta} onChange={(e) => handleChange("cpaMeta", e.target.value)} />
                {errors.cpaMeta && <p className="text-xs text-destructive">{errors.cpaMeta}</p>}
                <p className="text-xs text-muted-foreground">Pausa se CPA &gt; 2× este valor sem vendas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketMedio">Ticket Médio (R$)</Label>
                <Input id="ticketMedio" type="number" min="0.01" step="0.01" value={form.ticketMedio} onChange={(e) => handleChange("ticketMedio", e.target.value)} />
                {errors.ticketMedio && <p className="text-xs text-destructive">{errors.ticketMedio}</p>}
                <p className="text-xs text-muted-foreground">Base para cálculo de lucro e simulações</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limiteEscala">Limite de Escala (%)</Label>
                <Input id="limiteEscala" type="number" min="1" max="100" value={form.limiteEscala} onChange={(e) => handleChange("limiteEscala", e.target.value)} />
                {errors.limiteEscala && <p className="text-xs text-destructive">{errors.limiteEscala}</p>}
                <p className="text-xs text-muted-foreground">Incremento de orçamento por ciclo de 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-md">
            🔒 O token está armazenado como secret seguro no Cloud e é acessado apenas pela Edge Function server-side.
          </p>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
