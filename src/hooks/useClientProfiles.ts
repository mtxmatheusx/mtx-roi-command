import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ClientProfile {
  id: string;
  user_id: string;
  name: string;
  ad_account_id: string;
  pixel_id: string;
  page_id: string | null;
  catalog_id: string | null;
  cpa_meta: number;
  ticket_medio: number;
  limite_escala: number;
  budget_maximo: number;
  budget_frequency: string;
  cpa_max_toleravel: number;
  roas_min_escala: number;
  teto_diario_escala: number;
  meta_access_token: string | null;
  gemini_api_key: string | null;
  api_base_url: string | null;
  avatar_dossier: string | null;
  product_context: string | null;
  product_urls: string[];
  vertical_scale_enabled: boolean;
  rollback_enabled: boolean;
  rollback_roas_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateProfileInput = {
  name: string;
  ad_account_id?: string;
  pixel_id?: string;
  cpa_meta?: number;
  ticket_medio?: number;
  limite_escala?: number;
};

export type UpdateProfileInput = Partial<CreateProfileInput & {
  budget_maximo?: number;
  budget_frequency?: string;
  meta_access_token?: string | null;
  gemini_api_key?: string | null;
}> & { id: string };

export function useClientProfiles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["client_profiles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ClientProfile[];
    },
    enabled: !!user?.id,
  });

  const activeProfile = profiles.find((p) => p.is_active) || profiles[0] || null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["client_profiles", user?.id] });

  const setActiveProfile = useCallback(async (profileId: string) => {
    if (!user?.id) return;
    await supabase
      .from("client_profiles")
      .update({ is_active: false })
      .eq("user_id", user.id);
    await supabase
      .from("client_profiles")
      .update({ is_active: true })
      .eq("id", profileId);
    // Clear all localStorage Meta Ads caches
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("meta_ads_cache_")) localStorage.removeItem(key);
    });
    // Invalidate all relevant React Query caches
    queryClient.invalidateQueries({ queryKey: ["client_profiles"] });
    queryClient.invalidateQueries({ queryKey: ["meta-ads"] });
    queryClient.invalidateQueries({ queryKey: ["creative_assets"] });
    queryClient.invalidateQueries({ queryKey: ["campaign_drafts"] });
    queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
  }, [user?.id, queryClient]);

  const createProfile = useCallback(async (input: CreateProfileInput) => {
    if (!user?.id) return;
    const isFirst = profiles.length === 0;
    const { error } = await supabase
      .from("client_profiles")
      .insert({
        user_id: user.id,
        name: input.name,
        ad_account_id: input.ad_account_id || "act_",
        pixel_id: input.pixel_id || "",
        cpa_meta: input.cpa_meta ?? 45,
        ticket_medio: input.ticket_medio ?? 697,
        limite_escala: input.limite_escala ?? 15,
        is_active: isFirst,
      });
    if (error) throw error;
    invalidate();
  }, [user?.id, profiles.length]);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const { id, ...fields } = input;
    const { error } = await supabase
      .from("client_profiles")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
    invalidate();
  }, []);

  const deleteProfile = useCallback(async (profileId: string) => {
    const { error } = await supabase
      .from("client_profiles")
      .delete()
      .eq("id", profileId);
    if (error) throw error;
    invalidate();
  }, []);

  return {
    profiles,
    activeProfile,
    isLoading,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    adAccountId: activeProfile?.ad_account_id || "act_",
    cpaMeta: activeProfile?.cpa_meta ?? 45,
    ticketMedio: activeProfile?.ticket_medio ?? 697,
    limiteEscala: activeProfile?.limite_escala ?? 15,
    budgetMaximo: activeProfile?.budget_maximo ?? 0,
    budgetFrequency: activeProfile?.budget_frequency ?? "monthly",
    metaAccessToken: activeProfile?.meta_access_token ?? null,
    geminiApiKey: activeProfile?.gemini_api_key ?? null,
    productContext: activeProfile?.product_context ?? null,
    productUrls: activeProfile?.product_urls ?? [],
    apiBaseUrl: (activeProfile as any)?.api_base_url ?? "https://thor-backend.mtxestrategia.com.br",
    catalogId: (activeProfile as any)?.catalog_id ?? null,
  };
}
