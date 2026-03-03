import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { metaApi } from "@/lib/metaApiClient";
import { Plus, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  apiBaseUrl: string | null;
  metaAccessToken: string | null;
  adAccountId: string;
}

export default function CreateCampaignTab({ apiBaseUrl, metaAccessToken, adAccountId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_SALES",
    dailyBudget: "50",
  });

  const canUseApi = !!apiBaseUrl && !!metaAccessToken;

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Nome da campanha é obrigatório.", variant: "destructive" });
      return;
    }
    if (!canUseApi) {
      toast({ title: "API não configurada", description: "Configure a URL da API Externa em Configurações.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await metaApi.createCampaign(apiBaseUrl!, metaAccessToken!, {
        name: form.name,
        objective: form.objective,
        daily_budget: Math.round(parseFloat(form.dailyBudget) * 100),
        status: "PAUSED",
        ad_account_id: adAccountId,
      });
      toast({ title: "✅ Campanha criada", description: `"${result.name || form.name}" criada com sucesso (ID: ${result.id}).` });
      setForm({ ...form, name: "" });
    } catch (err) {
      toast({ title: "❌ Erro ao criar campanha", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="w-5 h-5 text-primary" />
          Criar Nova Campanha
        </CardTitle>
        <CardDescription>Configure uma nova campanha de tráfego no Meta Ads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canUseApi && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Configure a URL da API Externa e o Token em <strong className="mx-1">Configurações</strong> para criar campanhas.
          </div>
        )}

        <div className="space-y-2">
          <Label>Nome da Campanha</Label>
          <Input
            placeholder="Ex: [VENDAS] Método RIC - TOF"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Objetivo</Label>
          <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTCOME_SALES">Vendas</SelectItem>
              <SelectItem value="OUTCOME_LEADS">Geração de Leads</SelectItem>
              <SelectItem value="OUTCOME_TRAFFIC">Tráfego</SelectItem>
              <SelectItem value="OUTCOME_AWARENESS">Reconhecimento de Marca</SelectItem>
              <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento</SelectItem>
              <SelectItem value="OUTCOME_APP_PROMOTION">Promoção de App</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Orçamento Diário (R$)</Label>
          <Input
            type="number"
            placeholder="50.00"
            value={form.dailyBudget}
            onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })}
            min="5"
            step="0.01"
          />
          <p className="text-xs text-muted-foreground">Mínimo: R$ 5,00</p>
        </div>

        <Button onClick={handleCreate} disabled={loading || !canUseApi} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? "Criando..." : "Criar Campanha"}
        </Button>
      </CardContent>
    </Card>
  );
}
