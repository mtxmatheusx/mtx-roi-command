import { useState, useEffect } from "react";
import { Shield, Save, Loader2, CheckCircle, KeyRound } from "lucide-react";
import { z } from "zod";
import AppLayout from "@/components/AppLayout";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const configSchema = z.object({
  name: z.string().min(1, "Nome do cliente é obrigatório"),
  adAccountId: z.string().min(1, "ID da conta é obrigatório").regex(/^act_/, "Deve começar com act_"),
  pixelId: z.string().optional(),
  cpaMeta: z.number().min(0.01, "CPA Meta deve ser maior que 0"),
  ticketMedio: z.number().min(0.01, "Ticket Médio deve ser maior que 0"),
  limiteEscala: z.number().min(1).max(100, "Limite deve ser entre 1% e 100%"),
  budgetMaximo: z.number().min(0, "Budget Máximo deve ser >= 0"),
  budgetFrequency: z.enum(["daily", "weekly", "monthly"]),
});

function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 10) return "••••••";
  return "••••••" + token.slice(-6);
}

export default function Configuracoes() {
  const { toast } = useToast();
  const { activeProfile, updateProfile, isLoading: profilesLoading } = useClientProfiles();
  const [form, setForm] = useState({
    name: "", adAccountId: "act_", pixelId: "",
    cpaMeta: "45", ticketMedio: "697", limiteEscala: "15",
    budgetMaximo: "0", budgetFrequency: "monthly" as "daily" | "weekly" | "monthly",
    metaAccessToken: "",
  });
  const [tokenEditing, setTokenEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (activeProfile) {
      setForm({
        name: activeProfile.name || "",
        adAccountId: activeProfile.ad_account_id || "act_",
        pixelId: activeProfile.pixel_id || "",
        cpaMeta: String(activeProfile.cpa_meta ?? 45),
        ticketMedio: String(activeProfile.ticket_medio ?? 697),
        limiteEscala: String(activeProfile.limite_escala ?? 15),
        budgetMaximo: String(activeProfile.budget_maximo ?? 0),
        budgetFrequency: (activeProfile.budget_frequency ?? "monthly") as "daily" | "weekly" | "monthly",
        metaAccessToken: "",
      });
      setTokenEditing(false);
    }
  }, [activeProfile?.id]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = async () => {
    if (!activeProfile) { toast({ title: "Erro", description: "Crie um perfil primeiro.", variant: "destructive" }); return; }
    const parsed = configSchema.safeParse({
      ...form, cpaMeta: Number(form.cpaMeta), ticketMedio: Number(form.ticketMedio),
      limiteEscala: Number(form.limiteEscala), budgetMaximo: Number(form.budgetMaximo), budgetFrequency: form.budgetFrequency,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors); return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        id: activeProfile.id, name: parsed.data.name, ad_account_id: parsed.data.adAccountId,
        pixel_id: parsed.data.pixelId || "", cpa_meta: parsed.data.cpaMeta, ticket_medio: parsed.data.ticketMedio,
        limite_escala: parsed.data.limiteEscala, budget_maximo: parsed.data.budgetMaximo, budget_frequency: parsed.data.budgetFrequency,
      };
      // Only update token if user explicitly edited it
      if (tokenEditing && form.metaAccessToken) {
        updateData.meta_access_token = form.metaAccessToken;
      } else if (tokenEditing && !form.metaAccessToken) {
        // User cleared the token field — remove per-profile token
        updateData.meta_access_token = null;
      }
      await updateProfile(updateData as any);
      toast({ title: "✅ Configurações salvas", description: "Parâmetros atualizados com sucesso." });
      setTokenEditing(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    if (!form.adAccountId || form.adAccountId === "act_") { toast({ title: "Erro", description: "Preencha o Ad Account ID.", variant: "destructive" }); return; }
    setTestResult("loading");
    try {
      const body: Record<string, unknown> = { adAccountId: form.adAccountId, testConnection: true };
      // Use per-profile token if being edited, or existing profile token
      const tokenToTest = tokenEditing ? form.metaAccessToken : activeProfile?.meta_access_token;
      if (tokenToTest) body.accessToken = tokenToTest;

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult("success");
      toast({ title: "✅ Conexão OK", description: `${data.total} campanhas encontradas.` });
    } catch (err) {
      setTestResult("error");
      toast({ title: "❌ Falha na conexão", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (profilesLoading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!activeProfile) return <AppLayout><div className="space-y-4 text-center py-20"><h2 className="text-xl font-bold">Nenhum perfil encontrado</h2><p className="text-muted-foreground text-sm">Use o seletor no sidebar para criar seu primeiro perfil.</p></div></AppLayout>;

  const hasProfileToken = !!activeProfile.meta_access_token;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações — {activeProfile.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure a conexão com a Meta Ads e as regras de automação.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Perfil do Cliente</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label htmlFor="name">Nome do Cliente</Label>
              <Input id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Ex: Método RIC" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5 text-primary" />Credenciais Meta Ads</CardTitle>
            <CardDescription>Token global ou individual por perfil para suportar múltiplas contas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token status badge */}
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${hasProfileToken ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
              {hasProfileToken ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-emerald-400">Token individual configurado para este perfil ({maskToken(activeProfile.meta_access_token)})</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-400">Usando token global do Cloud. Adicione um token individual abaixo para esta conta.</span>
                </>
              )}
            </div>

            {/* Access Token input */}
            <div className="space-y-2">
              <Label htmlFor="metaAccessToken">Access Token (opcional — individual por perfil)</Label>
              {!tokenEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="metaAccessToken"
                    value={hasProfileToken ? maskToken(activeProfile.meta_access_token) : ""}
                    placeholder="Usando token global"
                    disabled
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={() => setTokenEditing(true)}>
                    {hasProfileToken ? "Alterar" : "Adicionar"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    id="metaAccessToken"
                    type="password"
                    value={form.metaAccessToken}
                    onChange={(e) => handleChange("metaAccessToken", e.target.value)}
                    placeholder="Cole aqui o Access Token da Meta"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio e salve para usar o token global. O token é salvo criptografado no banco.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adAccountId">Ad Account ID</Label>
                <Input id="adAccountId" placeholder="act_123456789" value={form.adAccountId} onChange={(e) => handleChange("adAccountId", e.target.value)} className="font-mono text-sm" />
                {errors.adAccountId && <p className="text-xs text-destructive">{errors.adAccountId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixelId">Pixel ID (opcional)</Label>
                <Input id="pixelId" placeholder="123456789012345" value={form.pixelId} onChange={(e) => handleChange("pixelId", e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={testResult === "loading"} className="gap-2">
                {testResult === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Testar Conexão
              </Button>
              {testResult === "success" && <span className="text-sm text-emerald-400">✓ Conectado</span>}
              {testResult === "error" && <span className="text-sm text-destructive">✗ Falha</span>}
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de Automação</CardTitle>
            <CardDescription>Defina os limites para pausa inteligente, escala automática e alertas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Controle de Teto Financeiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgetMaximo">Valor do Limite (R$)</Label>
                <Input id="budgetMaximo" type="number" min="0" step="1" value={form.budgetMaximo} onChange={(e) => handleChange("budgetMaximo", e.target.value)} />
                {errors.budgetMaximo && <p className="text-xs text-destructive">{errors.budgetMaximo}</p>}
                <p className="text-xs text-muted-foreground">0 = sem limite. Trava escala ao atingir</p>
              </div>
              <div className="space-y-2">
                <Label>Frequência do Limite</Label>
                <Select value={form.budgetFrequency} onValueChange={(v) => setForm(prev => ({ ...prev, budgetFrequency: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Período de acumulação do teto</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-md">🔒 Dados salvos com segurança no Cloud.</p>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
