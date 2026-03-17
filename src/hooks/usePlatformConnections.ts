import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import type { AdPlatform, PlatformConnection } from "@/types/platforms";

export function usePlatformConnections() {
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading, refetch } = useQuery({
    queryKey: ["platform_connections", activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data, error } = await supabase
        .from("platform_connections")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PlatformConnection[];
    },
    enabled: !!activeProfile?.id && !!user,
  });

  const createConnection = async (input: {
    platform: AdPlatform;
    display_name: string;
    credentials: Record<string, unknown>;
    platform_account_id?: string;
  }) => {
    if (!user || !activeProfile) throw new Error("Perfil ativo necessário");
    const { data, error } = await supabase
      .from("platform_connections")
      .insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        platform: input.platform,
        display_name: input.display_name,
        credentials: input.credentials,
        platform_account_id: input.platform_account_id || null,
        status: "active",
      } as any)
      .select()
      .single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["platform_connections"] });
    return data as unknown as PlatformConnection;
  };

  const updateConnection = async (id: string, updates: Partial<{
    display_name: string;
    credentials: Record<string, unknown>;
    platform_account_id: string;
    is_active: boolean;
    status: string;
  }>) => {
    const { error } = await supabase
      .from("platform_connections")
      .update(updates as any)
      .eq("id", id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["platform_connections"] });
  };

  const deleteConnection = async (id: string) => {
    const { error } = await supabase
      .from("platform_connections")
      .delete()
      .eq("id", id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["platform_connections"] });
  };

  const getConnectionsByPlatform = (platform: AdPlatform) =>
    connections.filter((c) => c.platform === platform);

  const hasActivePlatform = (platform: AdPlatform) =>
    connections.some((c) => c.platform === platform && c.is_active);

  return {
    connections,
    isLoading,
    refetch,
    createConnection,
    updateConnection,
    deleteConnection,
    getConnectionsByPlatform,
    hasActivePlatform,
  };
}
