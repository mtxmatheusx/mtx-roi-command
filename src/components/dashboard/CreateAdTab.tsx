import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { metaApi } from "@/lib/metaApiClient";
import { Zap, Loader2, AlertTriangle, Lightbulb } from "lucide-react";

interface Props {
  apiBaseUrl: string | null;
  metaAccessToken: string | null;
  adAccountId: string;
}

export default function CreateAdTab({ apiBaseUrl, metaAccessToken, adAccountId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    adsetId: "",
    message: "",
    link: "",
  });

  const canUseApi = !!apiBaseUrl && !!metaAccessToken;

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Nome do anúncio é obrigatório.", variant: "destructive" });
      return;
    }
    if (!form.adsetId.trim()) {
      toast({ title: "Erro", description: "ID do Ad Set é obrigatório.", variant: "destructive" });
      return;
    }
    if (!canUseApi) {
      toast({ title: "API não configurada", description: "Configure a URL da API Externa em Configurações.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await metaApi.createAd(apiBaseUrl!, metaAccessToken!, {
        name: form.name,
        adset_id: form.adsetId,
        creative: {
          object_story_spec: {
            link_data: {
              message: form.message,
              link: form.link,
            },
          },
        },
        status: "PAUSED",
        ad_account_id: adAccountId,
      });
      toast({ title: "✅ Anúncio criado", description: `"${result.name || form.name}" criado com sucesso.` });
      setForm({ ...form, name: "", adsetId: "", message: "", link: "" });
    } catch (err) {
      toast({ title: "❌ Erro ao criar anúncio", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-primary" />
          Criar Anúncio
        </CardTitle>
        <CardDescription>Configure um novo anúncio para sua campanha</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canUseApi && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Configure a URL da API Externa e o Token em <strong className="mx-1">Configurações</strong> para criar anúncios.
          </div>
        )}

        <div className="space-y-2">
          <Label>Nome do Anúncio</Label>
          <Input
            placeholder="Ex: [VENDAS] Criativo A - Copy 1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Ad Set ID</Label>
          <Input
            placeholder="ID do conjunto de anúncios"
            value={form.adsetId}
            onChange={(e) => setForm({ ...form, adsetId: e.target.value })}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Mensagem do Anúncio</Label>
          <Input
            placeholder="Texto principal do anúncio"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Link de Destino</Label>
          <Input
            placeholder="https://seusite.com.br/oferta"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="font-mono text-sm"
          />
        </div>

        <Button onClick={handleCreate} disabled={loading || !canUseApi} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? "Criando..." : "Criar Anúncio"}
        </Button>

        <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Dica:</strong> Você pode criar anúncios com imagens, vídeos e CTAs personalizadas.
              Após criar a campanha e o público, volte aqui para adicionar os anúncios.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
