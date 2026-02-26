import { useState } from "react";
import { Eye, EyeOff, Shield, CloudOff, Save } from "lucide-react";
import { z } from "zod";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const configSchema = z.object({
  accessToken: z.string().min(1, "Token de acesso é obrigatório"),
  adAccountId: z.string().min(1, "ID da conta é obrigatório").regex(/^act_/, "Deve começar com act_"),
  pixelId: z.string().optional(),
  cpaMeta: z.number().min(0.01, "CPA Meta deve ser maior que 0"),
  ticketMedio: z.number().min(0.01, "Ticket Médio deve ser maior que 0"),
  limiteEscala: z.number().min(1).max(100, "Limite deve ser entre 1% e 100%"),
});

export default function Configuracoes() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    accessToken: "",
    adAccountId: "act_",
    pixelId: "",
    cpaMeta: "45",
    ticketMedio: "697",
    limiteEscala: "15",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    toast({
      title: "⚠️ Lovable Cloud necessário",
      description: "Ative o Lovable Cloud para salvar as configurações de forma segura.",
    });
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

        <Alert className="border-amber-500/30 bg-amber-500/5">
          <CloudOff className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Backend necessário</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Para conectar à Meta Ads API de forma segura, o <strong>Lovable Cloud</strong> precisa ser ativado.
            O token será armazenado como secret criptografado e as chamadas à API serão feitas via Edge Functions no servidor.
          </AlertDescription>
        </Alert>

        {/* API Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-neon-red" />
              Credenciais Meta Ads
            </CardTitle>
            <CardDescription>
              Insira suas credenciais da Meta Marketing API. O token nunca será exposto no código-fonte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token (Longa Duração)</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showToken ? "text" : "password"}
                  placeholder="EAAxxxxxxx..."
                  value={form.accessToken}
                  onChange={(e) => handleChange("accessToken", e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.accessToken && <p className="text-xs text-destructive">{errors.accessToken}</p>}
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
                <Input
                  id="cpaMeta"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.cpaMeta}
                  onChange={(e) => handleChange("cpaMeta", e.target.value)}
                />
                {errors.cpaMeta && <p className="text-xs text-destructive">{errors.cpaMeta}</p>}
                <p className="text-xs text-muted-foreground">Pausa se CPA &gt; 2× este valor sem vendas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketMedio">Ticket Médio (R$)</Label>
                <Input
                  id="ticketMedio"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.ticketMedio}
                  onChange={(e) => handleChange("ticketMedio", e.target.value)}
                />
                {errors.ticketMedio && <p className="text-xs text-destructive">{errors.ticketMedio}</p>}
                <p className="text-xs text-muted-foreground">Base para cálculo de lucro e simulações</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limiteEscala">Limite de Escala (%)</Label>
                <Input
                  id="limiteEscala"
                  type="number"
                  min="1"
                  max="100"
                  value={form.limiteEscala}
                  onChange={(e) => handleChange("limiteEscala", e.target.value)}
                />
                {errors.limiteEscala && <p className="text-xs text-destructive">{errors.limiteEscala}</p>}
                <p className="text-xs text-muted-foreground">Incremento de orçamento por ciclo de 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-md">
            🔒 O token será armazenado como secret seguro via Lovable Cloud e acessado apenas por Edge Functions server-side.
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
