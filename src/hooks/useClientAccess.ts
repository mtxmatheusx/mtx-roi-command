import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientProfiles } from "@/hooks/useClientProfiles";

interface ClientAccessRecord {
  id: string;
  user_id: string;
  profile_id: string;
  email: string;
  role: string;
  created_at: string;
}

export function useClientAccess() {
  const { user } = useAuth();
  const { activeProfile } = useClientProfiles();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const profileId = activeProfile?.id;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["client_access_list", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("client_access")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientAccessRecord[];
    },
    enabled: !!profileId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["client_access_list", profileId] });

  const createClient = useCallback(
    async (email: string, password: string) => {
      if (!profileId) throw new Error("Nenhum perfil ativo");
      setCreating(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-client-user", {
          body: { email, password, profileId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        invalidate();
        return data;
      } finally {
        setCreating(false);
      }
    },
    [profileId]
  );

  const removeClient = useCallback(
    async (accessId: string) => {
      const { error } = await (supabase as any)
        .from("client_access")
        .delete()
        .eq("id", accessId);
      if (error) throw error;
      invalidate();
    },
    [profileId]
  );

  return {
    clients,
    isLoading,
    creating,
    createClient,
    removeClient,
  };
}
