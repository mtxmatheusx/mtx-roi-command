import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Trash2, CheckCircle, XCircle, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformConnections } from "@/hooks/usePlatformConnections";
import { PLATFORM_CONFIG, ALL_PLATFORMS, type AdPlatform, type PlatformConnection } from "@/types/platforms";

export default function PlatformConnectionsManager() {
  const { toast } = useToast();
  const { connections, isLoading, createConnection, updateConnection, deleteConnection } = usePlatformConnections();
  const [addDialog, setAddDialog] = useState<AdPlatform | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = (platform: AdPlatform) => {
    setAddDialog(platform);
    setFormValues({});
    setDisplayName("");
  };

  const handleSaveConnection = async () => {
    if (!addDialog) return;
    const config = PLATFORM_CONFIG[addDialog];

    // Validate required fields
    const missingFields = config.fields
      .filter((f) => !f.label.includes("opcional"))
      .filter((f) => !formValues[f.key]?.trim());

    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Preencha: ${missingFields.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const accountIdKey = config.fields.find((f) =>
        f.key.includes("account_id") || f.key === "customer_id" || f.key === "advertiser_id"
      )?.key;

      await createConnection({
        platform: addDialog,
        display_name: displayName || `${config.label} Account`,
        credentials: formValues,
        platform_account_id: accountIdKey ? formValues[accountIdKey] : undefined,
      });

      toast({ title: "✅ Plataforma conectada", description: `${config.label} adicionado com sucesso.` });
      setAddDialog(null);
    } catch (err) {
      toast({ title: "Erro ao conectar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (conn: PlatformConnection) => {
    try {
      await updateConnection(conn.id, { is_active: !conn.is_active });
      toast({ title: conn.is_active ? "Desativado" : "Ativado", description: `${conn.display_name} ${conn.is_active ? "desativado" : "ativado"}.` });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (conn: PlatformConnection) => {
    try {
      await deleteConnection(conn.id);
      toast({ title: "Removido", description: `${conn.display_name} removido.` });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    }
  };

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wifi className="w-5 h-5 text-primary" />
          Plataformas de Anúncios
        </CardTitle>
        <CardDescription>
          Conecte suas contas de anúncios para um dashboard unificado cross-platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connected platforms */}
        {connections.length > 0 && (
          <div className="space-y-3">
            {connections.map((conn) => {
              const config = PLATFORM_CONFIG[conn.platform as AdPlatform];
              if (!config) return null;
              return (
                <div
                  key={conn.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    conn.is_active
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-muted/30 border-border opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{config.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{conn.display_name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {config.label}
                        </Badge>
                        {conn.status === "active" ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : conn.status === "expired" ? (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {conn.platform_account_id && (
                          <span className="font-mono">{conn.platform_account_id}</span>
                        )}
                        {conn.last_synced_at && (
                          <span>• Último sync: {new Date(conn.last_synced_at).toLocaleDateString("pt-BR")}</span>
                        )}
                        {conn.sync_error && (
                          <span className="text-destructive">• {conn.sync_error}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={conn.is_active}
                      onCheckedChange={() => handleToggleActive(conn)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover {conn.display_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá a conexão e todos os dados sincronizados desta plataforma.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(conn)} className="bg-destructive text-destructive-foreground">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {connections.length > 0 && <Separator />}

        {/* Add platform buttons */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Adicionar Plataforma</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {ALL_PLATFORMS.map((platform) => {
              const config = PLATFORM_CONFIG[platform];
              const isConnected = connectedPlatforms.has(platform);
              return (
                <button
                  key={platform}
                  onClick={() => handleOpenAdd(platform)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all hover:border-primary/50 hover:bg-primary/5 ${
                    isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"
                  }`}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-xs font-semibold">{config.label}</span>
                  {isConnected && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      Conectado
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Connection Dialog */}
        <Dialog open={!!addDialog} onOpenChange={(open) => !open && setAddDialog(null)}>
          <DialogContent className="sm:max-w-lg">
            {addDialog && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-xl">{PLATFORM_CONFIG[addDialog].icon}</span>
                    Conectar {PLATFORM_CONFIG[addDialog].label}
                  </DialogTitle>
                  <DialogDescription>
                    {PLATFORM_CONFIG[addDialog].description}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Nome de exibição</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={`Ex: Minha conta ${PLATFORM_CONFIG[addDialog].label}`}
                    />
                  </div>
                  {PLATFORM_CONFIG[addDialog].fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <Input
                        type={field.type || "text"}
                        value={formValues[field.key] || ""}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialog(null)}>Cancelar</Button>
                  <Button onClick={handleSaveConnection} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Conectar
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
