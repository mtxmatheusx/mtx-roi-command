import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { metaApi } from "@/lib/metaApiClient";
import { Users, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  apiBaseUrl: string | null;
  metaAccessToken: string | null;
  adAccountId: string;
}

export default function CreateAudienceTab({ apiBaseUrl, metaAccessToken, adAccountId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subtype: "CUSTOM",
  });

  const canUseApi = !!apiBaseUrl && !!metaAccessToken;

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Nome do público é obrigatório.", variant: "destructive" });
      return;
    }
    if (!canUseApi) {
      toast({ title: "API não configurada", description: "Configure a URL da API Externa em Configurações.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await metaApi.createCustomAudience(apiBaseUrl!, metaAccessToken!, {
        name: form.name,
        subtype: form.subtype,
        ad_account_id: adAccountId,
      });
      toast({ title: "✅ Público criado", description: `"${result.name || form.name}" criado com sucesso.` });
      setForm({ ...form, name: "" });
    } catch (err) {
      toast({ title: "❌ Erro ao criar público", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" />
          Criar Público Personalizado
        </CardTitle>
        <CardDescription>Configure um novo público para segmentação</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canUseApi && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Configure a URL da API Externa e o Token em <strong className="mx-1">Configurações</strong> para criar públicos.
          </div>
        )}

        <div className="space-y-2">
          <Label>Nome do Público</Label>
          <Input
            placeholder="Ex: Lookalike 1% Compradores"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Tipo de Público</Label>
          <Select value={form.subtype} onValueChange={(v) => setForm({ ...form, subtype: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CUSTOM">Personalizado</SelectItem>
              <SelectItem value="WEBSITE">Website</SelectItem>
              <SelectItem value="LOOKALIKE">Lookalike</SelectItem>
              <SelectItem value="ENGAGEMENT">Engajamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleCreate} disabled={loading || !canUseApi} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          {loading ? "Criando..." : "Criar Público"}
        </Button>
      </CardContent>
    </Card>
  );
}
