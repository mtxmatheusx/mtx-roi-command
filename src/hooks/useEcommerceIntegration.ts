import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EcommerceConnection {
  id: string;
  user_id: string;
  profile_id: string;
  platform: string;
  store_id: string | null;
  store_name: string | null;
  store_url: string | null;
  access_token: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  orders_synced: number;
  created_at: string;
  updated_at: string;
}

export interface UTMSale {
  id: string;
  external_order_id: string;
  order_number: string | null;
  order_status: string | null;
  total_amount: number;
  currency: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ordered_at: string;
}

export function useEcommerceConnection(profileId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const connectionQuery = useQuery({
    queryKey: ["ecommerce_connection", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("ecommerce_connections" as any) as any)
        .select("*")
        .eq("profile_id", profileId!)
        .eq("platform", "nuvemshop")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EcommerceConnection | null;
    },
  });

  const saveConnection = useMutation({
    mutationFn: async (input: {
      store_id: string;
      access_token: string;
      store_name?: string;
      store_url?: string;
    }) => {
      if (!profileId) throw new Error("Perfil ativo necessário");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const payload = {
        user_id: userId,
        profile_id: profileId,
        platform: "nuvemshop",
        store_id: input.store_id,
        access_token: input.access_token,
        store_name: input.store_name ?? null,
        store_url: input.store_url ?? null,
        is_active: true,
      };

      const { data, error } = await (supabase
        .from("ecommerce_connections" as any) as any)
        .upsert(payload, { onConflict: "profile_id,platform" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecommerce_connection", profileId] });
      toast({ title: "Loja conectada", description: "Sua loja Nuvemshop foi vinculada com sucesso." });
    },
    onError: (e: any) => toast({
      title: "Erro ao salvar conexão",
      description: e.message,
      variant: "destructive",
    }),
  });

  const disconnectStore = useMutation({
    mutationFn: async () => {
      if (!connectionQuery.data?.id) return;
      const { error } = await (supabase
        .from("ecommerce_connections" as any) as any)
        .delete()
        .eq("id", connectionQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecommerce_connection", profileId] });
      qc.invalidateQueries({ queryKey: ["utm_sales", profileId] });
      toast({ title: "Loja desconectada" });
    },
  });

  const syncOrders = useMutation<any, Error, number | undefined>({
    mutationFn: async (daysBack) => {
      const days = daysBack ?? 30;
      if (!connectionQuery.data?.id) throw new Error("Nenhuma loja conectada");
      const { data, error } = await supabase.functions.invoke(
        "nuvemshop-sync-orders",
        { body: { connection_id: connectionQuery.data.id, days_back: days } },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao sincronizar");
      return data;
    },
    onSuccess: (data) => {
      const total = data?.results?.[0]?.total ?? 0;
      qc.invalidateQueries({ queryKey: ["ecommerce_connection", profileId] });
      qc.invalidateQueries({ queryKey: ["utm_sales", profileId] });
      toast({
        title: "Sincronização concluída",
        description: `${total} pedido${total === 1 ? "" : "s"} atualizado${total === 1 ? "" : "s"}.`,
      });
    },
    onError: (e: any) => toast({
      title: "Erro ao sincronizar",
      description: e.message,
      variant: "destructive",
    }),
  });

  return { connection: connectionQuery.data, isLoading: connectionQuery.isLoading, saveConnection, disconnectStore, syncOrders };
}

export function useUTMSales(profileId: string | undefined, since?: string, until?: string) {
  return useQuery({
    queryKey: ["utm_sales", profileId, since, until],
    enabled: !!profileId,
    queryFn: async () => {
      let q = supabase
        .from("utm_sales" as any)
        .select("id, external_order_id, order_number, order_status, total_amount, currency, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ordered_at")
        .eq("profile_id", profileId!)
        .order("ordered_at", { ascending: false })
        .limit(5000);
      if (since) q = q.gte("ordered_at", `${since}T00:00:00`);
      if (until) q = q.lte("ordered_at", `${until}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as UTMSale[];
    },
  });
}
