import { useState } from "react";
import { Check, ChevronDown, Plus, User, Trash2 } from "lucide-react";
import { useClientProfiles, CreateProfileInput } from "@/hooks/useClientProfiles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ProfileSelector() {
  const { profiles, activeProfile, setActiveProfile, createProfile, deleteProfile, isLoading } = useClientProfiles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAdAccount, setNewAdAccount] = useState("act_");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createProfile({ name: newName.trim(), ad_account_id: newAdAccount || "act_" });
      toast({ title: "✅ Perfil criado", description: `${newName} adicionado com sucesso.` });
      setNewName("");
      setNewAdAccount("act_");
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="h-10 rounded-lg bg-secondary animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors text-left">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {activeProfile?.name || "Nenhum perfil"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeProfile?.ad_account_id || "Selecione um perfil"}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[232px]">
            {profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActiveProfile(p.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.ad_account_id}</p>
                </div>
                {p.is_active && <Check className="w-4 h-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
            {profiles.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setDialogOpen(true)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Novo Perfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Perfil de Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome do Cliente</Label>
              <Input
                id="profile-name"
                placeholder="Ex: Método RIC"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-ad-account">Ad Account ID</Label>
              <Input
                id="profile-ad-account"
                placeholder="act_123456789"
                value={newAdAccount}
                onChange={(e) => setNewAdAccount(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()} className="w-full">
              {saving ? "Criando..." : "Criar Perfil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
