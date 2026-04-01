import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, Trash2, Loader2, Copy, ExternalLink } from "lucide-react";
import { useClientAccess } from "@/hooks/useClientAccess";
import { useToast } from "@/hooks/use-toast";

export default function ClientAccessSection() {
  const { clients, isLoading, creating, createClient, removeClient } = useClientAccess();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!email || !password) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    try {
      const result = await createClient(email, password);
      toast({ title: "Cliente adicionado", description: result.message });
      setEmail("");
      setPassword("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await removeClient(id);
      toast({ title: "Acesso removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setRemoving(null);
  };

  const reportUrl = "https://mtx-roi-command.lovable.app/relatorio";

  const copyUrl = () => {
    navigator.clipboard.writeText(reportUrl);
    toast({ title: "URL copiada!" });
  };

  return (
    <>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Acesso do Cliente ao Relatório
          </CardTitle>
          <CardDescription>
            Crie contas para seus clientes acessarem o relatório de performance.
            Eles fazem login e veem apenas os dados deste perfil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report URL */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-xs text-muted-foreground flex-1 truncate">{reportUrl}</span>
            <Button variant="ghost" size="sm" onClick={copyUrl} className="shrink-0 gap-1.5 h-7">
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </Button>
          </div>

          {/* Add client form */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Adicionar novo cliente</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                type="email"
                placeholder="email@cliente.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Senha (min. 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* Client list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum cliente com acesso ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{c.email}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(c.id)}
                    disabled={removing === c.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7"
                  >
                    {removing === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
