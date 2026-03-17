import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenDebugInfo {
  type: string;
  expires_at?: number;
  is_valid: boolean;
  scopes?: string[];
  app_id?: string;
  data_access_expires_at?: number;
}

async function debugToken(accessToken: string): Promise<TokenDebugInfo> {
  const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.error) {
    return { type: "unknown", is_valid: false };
  }

  const data = json.data || {};
  return {
    type: data.type || "unknown",
    expires_at: data.expires_at || undefined,
    is_valid: data.is_valid ?? false,
    scopes: data.scopes || [],
    app_id: data.app_id || undefined,
    data_access_expires_at: data.data_access_expires_at || undefined,
  };
}

async function exchangeForLongLived(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; token_type: string; expires_in: number } | null> {
  const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.error) {
    console.error("Token exchange error:", json.error);
    return null;
  }

  return {
    access_token: json.access_token,
    token_type: json.token_type || "bearer",
    expires_in: json.expires_in || 5184000, // 60 days default
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { profileId, action } = body;
    // action: "debug" | "exchange" | "auto"

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "profileId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claims.claims.sub;

    // Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("client_profiles")
      .select("id, meta_access_token, ad_account_id, name")
      .eq("id", profileId)
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Nenhum token configurado para este perfil." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debug token
    const debugInfo = await debugToken(accessToken);

    if (action === "debug") {
      const now = Math.floor(Date.now() / 1000);
      let expiryLabel = "Permanente (System User)";
      let daysRemaining: number | null = null;
      let isExpired = false;

      if (debugInfo.expires_at && debugInfo.expires_at > 0) {
        daysRemaining = Math.floor((debugInfo.expires_at - now) / 86400);
        isExpired = debugInfo.expires_at < now;
        if (isExpired) {
          expiryLabel = "Expirado";
        } else if (daysRemaining <= 0) {
          expiryLabel = "Expira hoje";
        } else if (daysRemaining <= 7) {
          expiryLabel = `Expira em ${daysRemaining} dia(s)`;
        } else {
          expiryLabel = `Expira em ${daysRemaining} dias`;
        }
      }

      const isSystemUser = debugInfo.type === "SYSTEM_USER" || debugInfo.type === "system_user";
      const isLongLived = !debugInfo.expires_at || debugInfo.expires_at === 0 || (daysRemaining !== null && daysRemaining > 30);

      return new Response(
        JSON.stringify({
          type: debugInfo.type,
          is_valid: debugInfo.is_valid,
          expires_at: debugInfo.expires_at,
          expiry_label: expiryLabel,
          days_remaining: daysRemaining,
          is_expired: isExpired,
          is_system_user: isSystemUser,
          is_long_lived: isLongLived,
          scopes: debugInfo.scopes,
          can_exchange: !isSystemUser && !isLongLived && debugInfo.is_valid,
          data_access_expires_at: debugInfo.data_access_expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange" || action === "auto") {
      const appId = Deno.env.get("META_APP_ID");
      const appSecret = Deno.env.get("META_APP_SECRET");

      if (!appId || !appSecret) {
        return new Response(
          JSON.stringify({
            error: "META_APP_ID e META_APP_SECRET não configurados. Configure nas variáveis de ambiente para habilitar a renovação automática.",
            needs_secrets: true,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if token is already long-lived or system user
      const isSystemUser = debugInfo.type === "SYSTEM_USER" || debugInfo.type === "system_user";
      if (isSystemUser) {
        return new Response(
          JSON.stringify({
            message: "Token é de System User (permanente). Não precisa de renovação.",
            type: debugInfo.type,
            is_valid: debugInfo.is_valid,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const exchangeResult = await exchangeForLongLived(accessToken, appId, appSecret);
      if (!exchangeResult) {
        return new Response(
          JSON.stringify({ error: "Falha ao trocar o token. Verifique se o token é válido e as credenciais do App estão corretas." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile with new long-lived token
      if (profile.meta_access_token) {
        const { error: updateErr } = await supabase
          .from("client_profiles")
          .update({ meta_access_token: exchangeResult.access_token })
          .eq("id", profileId);

        if (updateErr) {
          console.error("Failed to update profile token:", updateErr);
          return new Response(
            JSON.stringify({ error: "Token renovado mas falha ao salvar no perfil.", new_token_preview: exchangeResult.access_token.slice(-6) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const expiresInDays = Math.floor(exchangeResult.expires_in / 86400);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Token renovado com sucesso! Válido por ${expiresInDays} dias.`,
          expires_in_days: expiresInDays,
          token_preview: "••••••" + exchangeResult.access_token.slice(-6),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "action inválida. Use 'debug', 'exchange' ou 'auto'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("refresh-meta-token error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
