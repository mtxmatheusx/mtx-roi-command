import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, ExternalLink, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useEcommerceConnection } from "@/hooks/useEcommerceIntegration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function NuvemshopConnectionCard() {
  const { activeProfile } = useClientProfiles();
  const profileId = activeProfile?.id;
  const { connection, isLoading, saveConnection, disconnectStore, syncOrders } = useEcommerceConnection(profileId);

  const [storeId, setStoreId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");

  useEffect(() => {
    if (connection) {
      setStoreId(connection.store_id || "");
      setAccessToken(""); // never prefill secret
      setStoreName(connection.store_name || "");
      setStoreUrl(connection.store_url || "");
    }
  }, [connection]);

  const handleSave = () => {
    if (!storeId.trim() || !accessToken.trim()) return;
    saveConnection.mutate({
      store_id: storeId.trim(),
      access_token: accessToken.trim(),
      store_name: storeName.trim() || undefined,
      store_url: storeUrl.trim() || undefined,
    });
  };

  const isConnected = !!connection?.access_token;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold flex items-center gap-2 flex-wrap">
              Nuvemshop
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Conectada
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Sincroniza pedidos com UTMs para análise de fonte de tráfego.
            </p>
          </div>
        </div>
      </div>

      {!profileId && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/5 border border-warning/15 rounded-lg p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Selecione um perfil ativo antes de conectar.
        </div>
      )}

      {/* Status panel when connected */}
      {isConnected && (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Loja" value={connection?.store_name || `#${connection?.store_id}`} />
            <Stat label="Pedidos sincronizados" value={String(connection?.orders_synced || 0)} />
            <Stat
              label="Última sync"
              value={connection?.last_synced_at ? new Date(connection.last_synced_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
            />
            <Stat
              label="Status"
              value={connection?.last_sync_status || "—"}
              accent={connection?.last_sync_status === "success" ? "success" : connection?.last_sync_status === "error" ? "destructive" : undefined}
            />
          </div>
          {connection?.last_sync_status === "error" && connection?.last_sync_error && (
            <div className="text-[11px] text-destructive bg-destructive/5 border border-destructive/15 rounded-lg p-2 break-words">
              <strong>Erro:</strong> {connection.last_sync_error}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => syncOrders.mutate(30)}
              disabled={syncOrders.isPending}
              className="gap-2 h-8"
            >
              {syncOrders.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sincronizar últimos 30 dias
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncOrders.mutate(90)}
              disabled={syncOrders.isPending}
              className="gap-2 h-8 text-xs"
            >
              90 dias
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => disconnectStore.mutate()}
              disabled={disconnectStore.isPending}
              className="gap-2 h-8 text-xs text-destructive hover:text-destructive ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Desconectar
            </Button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">Como obter o Store ID e Access Token:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Acesse o <a href="https://partners.nuvemshop.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">painel de parceiros Nuvemshop <ExternalLink className="w-3 h-3" /></a> e crie um App.</li>
            <li>No app, gere o token de uma loja com escopo <code className="px-1 py-0.5 bg-muted rounded">read_orders</code>.</li>
            <li>Copie o <strong>Store ID (user_id)</strong> e o <strong>Access Token</strong> retornados pelo OAuth e cole abaixo.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ns-store-id" className="text-xs">Store ID *</Label>
            <Input
              id="ns-store-id"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="ex: 1234567"
              className="h-9 text-sm"
              disabled={!profileId}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-store-name" className="text-xs">Nome da loja</Label>
            <Input
              id="ns-store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="ex: Minha Loja"
              className="h-9 text-sm"
              disabled={!profileId}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-store-url" className="text-xs">URL da loja</Label>
            <Input
              id="ns-store-url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://minhaloja.com.br"
              className="h-9 text-sm"
              disabled={!profileId}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-token" className="text-xs">
              Access Token * {isConnected && <span className="text-muted-foreground/70">(deixe vazio para manter)</span>}
            </Label>
            <Input
              id="ns-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="cole o token aqui"
              className="h-9 text-sm font-mono"
              disabled={!profileId}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!profileId || !storeId.trim() || (!accessToken.trim() && !isConnected) || saveConnection.isPending}
          className="w-full sm:w-auto gap-2"
        >
          {saveConnection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isConnected ? "Atualizar conexão" : "Conectar loja"}
        </Button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums truncate mt-0.5",
          accent === "success" && "text-success",
          accent === "destructive" && "text-destructive",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
