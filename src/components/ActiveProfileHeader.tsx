import { useState } from "react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useMetaAds } from "@/hooks/useMetaAds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OctagonAlert, Loader2, ShieldAlert } from "lucide-react";

export default function ActiveProfileHeader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profiles, activeProfile, setActiveProfile, adAccountId, metaAccessToken } = useClientProfiles();
  const { campaigns } = useMetaAds();

  const [killOpen, setKillOpen] = useState(false);
  const [killConfirm, setKillConfirm] = useState("");
  const [isKilling, setIsKilling] = useState(false);

  const hasActiveCampaigns = campaigns.some((c) => c.status === "active");

  const handleKillSwitch = async () => {
    if (!activeProfile || !user?.id) return;
    setIsKilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("kill-switch", {
        body: { profileId: activeProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Kill Switch Ativado", description: `${data.paused_count || 0} campanhas pausadas.` });
      setKillOpen(false);
      setKillConfirm("");
    } catch (err) {
      toast({ title: "Erro no Kill Switch", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsKilling(false);
    }
  };

  if (!profiles.length) return null;

  return (
    <div className="mb-6 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <Select
          value={activeProfile?.id || ""}
          onValueChange={(id) => setActiveProfile(id)}
        >
          <SelectTrigger className="h-9 text-sm font-medium">
            <SelectValue placeholder="Selecione um perfil" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeProfile && (
        <span className="text-xs text-muted-foreground hidden md:inline font-mono">
          {activeProfile.ad_account_id}
        </span>
      )}

      {hasActiveCampaigns && (
        <Button
          variant="destructive"
          size="sm"
          className="gap-2 ml-auto"
          onClick={() => setKillOpen(true)}
        >
          <OctagonAlert className="w-4 h-4" />
          Pausar Operação
        </Button>
      )}

      <AlertDialog open={killOpen} onOpenChange={setKillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              Kill Switch — {activeProfile?.name}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a pausar <strong>todas</strong> as campanhas ativas de{" "}
                <strong>{activeProfile?.name}</strong>.
              </p>
              <p className="text-sm">
                Digite <strong>PAUSAR</strong> para confirmar:
              </p>
              <Input
                value={killConfirm}
                onChange={(e) => setKillConfirm(e.target.value.toUpperCase())}
                placeholder="Digite PAUSAR"
                className="font-mono"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setKillConfirm(""); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKillSwitch}
              disabled={killConfirm !== "PAUSAR" || isKilling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isKilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <OctagonAlert className="w-4 h-4" />}
              Executar Kill Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
