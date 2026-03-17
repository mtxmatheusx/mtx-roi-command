import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALERT_EMAIL = "mtxagenciacriativa@gmail.com";
const DAYS_THRESHOLD = 5;

interface TokenStatus {
  profileName: string;
  profileId: string;
  tokenType: string;
  isValid: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  expiryLabel: string;
}

async function debugToken(accessToken: string): Promise<{
  type: string; expires_at?: number; is_valid: boolean;
}> {
  try {
    const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) return { type: "unknown", is_valid: false };
    const data = json.data || {};
    return {
      type: data.type || "unknown",
      expires_at: data.expires_at || undefined,
      is_valid: data.is_valid ?? false,
    };
  } catch {
    return { type: "error", is_valid: false };
  }
}

function buildAlertHtml(alerts: TokenStatus[]): string {
  const rows = alerts.map((a) => {
    const statusColor = a.isExpired ? "#ef4444" : a.daysRemaining !== null && a.daysRemaining <= 2 ? "#f97316" : "#eab308";
    const statusText = a.isExpired ? "EXPIRADO" : `${a.daysRemaining} dia(s)`;
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600">${a.profileName}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px">${a.tokenType}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">
          <span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${statusText}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">${a.expiryLabel}</td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:620px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 30px;color:#fff">
      <h1 style="margin:0;font-size:20px;font-weight:700">⚠️ Alerta de Token — MTX Command Center</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.8">${alerts.length} token(s) requerem atenção</p>
    </div>
    <div style="padding:24px 30px">
      <p style="font-size:14px;color:#374151;margin:0 0 16px">Os seguintes tokens da Meta estão próximos da expiração ou já expiraram:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb">Perfil</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb">Tipo</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb">Expira</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px;padding:14px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b">
        <p style="margin:0;font-size:13px;color:#92400e">
          <strong>Recomendação:</strong> Gere um System User Token permanente no 
          <a href="https://business.facebook.com/settings/system-users" style="color:#d97706">Meta Business Suite</a> 
          para evitar expirações futuras.
        </p>
      </div>
    </div>
    <div style="padding:16px 30px;background:#f9fafb;text-align:center;font-size:11px;color:#9ca3af">
      MTX Command Center • Verificação automática diária
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all profiles with tokens
    const { data: profiles, error: profilesErr } = await supabase
      .from("client_profiles")
      .select("id, name, meta_access_token, ad_account_id, user_id")
      .not("meta_access_token", "is", null);

    if (profilesErr) throw profilesErr;

    const globalToken = Deno.env.get("META_ACCESS_TOKEN");
    const allStatuses: TokenStatus[] = [];
    const alerts: TokenStatus[] = [];

    // Check each profile token
    for (const profile of (profiles || [])) {
      const token = profile.meta_access_token || globalToken;
      if (!token) continue;

      const debug = await debugToken(token);
      const now = Math.floor(Date.now() / 1000);
      let daysRemaining: number | null = null;
      let isExpired = false;
      let expiryLabel = "Permanente (System User)";

      if (debug.expires_at && debug.expires_at > 0) {
        daysRemaining = Math.floor((debug.expires_at - now) / 86400);
        isExpired = debug.expires_at < now;
        if (isExpired) {
          expiryLabel = "Expirado";
        } else if (daysRemaining <= 0) {
          expiryLabel = "Expira hoje";
        } else {
          expiryLabel = `Expira em ${daysRemaining} dia(s)`;
        }
      }

      const status: TokenStatus = {
        profileName: profile.name,
        profileId: profile.id,
        tokenType: debug.type,
        isValid: debug.is_valid,
        isExpired,
        daysRemaining,
        expiryLabel,
      };

      allStatuses.push(status);

      // Alert if expired or expiring within threshold
      if (isExpired || (daysRemaining !== null && daysRemaining <= DAYS_THRESHOLD)) {
        alerts.push(status);
      }
    }

    // Also check global token
    if (globalToken) {
      const debug = await debugToken(globalToken);
      const now = Math.floor(Date.now() / 1000);
      if (debug.expires_at && debug.expires_at > 0) {
        const daysRemaining = Math.floor((debug.expires_at - now) / 86400);
        const isExpired = debug.expires_at < now;
        if (isExpired || daysRemaining <= DAYS_THRESHOLD) {
          const existing = alerts.find((a) => a.profileName === "Token Global");
          if (!existing) {
            alerts.push({
              profileName: "🔑 Token Global",
              profileId: "global",
              tokenType: debug.type,
              isValid: debug.is_valid,
              isExpired,
              daysRemaining,
              expiryLabel: isExpired ? "Expirado" : `Expira em ${daysRemaining} dia(s)`,
            });
          }
        }
      }
    }

    let emailSent = false;

    // Send email alert if there are expiring tokens
    if (alerts.length > 0) {
      const htmlContent = buildAlertHtml(alerts);

      // Try sending via Lovable AI gateway (using a simple email approach)
      try {
        const emailPayload = {
          to: ALERT_EMAIL,
          subject: `⚠️ MTX Alert: ${alerts.length} token(s) expirando — ação necessária`,
          html: htmlContent,
        };

        // Use the agency-alerts function pattern
        const { error: alertErr } = await supabase.functions.invoke("agency-alerts", {
          body: {
            type: "token_expiry",
            email: ALERT_EMAIL,
            subject: emailPayload.subject,
            html: htmlContent,
            alerts: alerts.map((a) => ({
              profile: a.profileName,
              status: a.expiryLabel,
              type: a.tokenType,
            })),
          },
        });

        if (alertErr) {
          console.error("Failed to send via agency-alerts:", alertErr);
        } else {
          emailSent = true;
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }

      // Log the alert
      for (const alert of alerts) {
        if (alert.profileId !== "global") {
          try {
            // Find user_id for this profile
            const profile = (profiles || []).find((p) => p.id === alert.profileId);
            if (profile) {
              await supabase.from("emergency_logs").insert({
                user_id: profile.user_id,
                profile_id: alert.profileId,
                action_type: alert.isExpired ? "TOKEN_EXPIRED" : "TOKEN_EXPIRING",
                details: {
                  token_type: alert.tokenType,
                  days_remaining: alert.daysRemaining,
                  expiry_label: alert.expiryLabel,
                  alert_sent: emailSent,
                },
              });
            }
          } catch {
            // Log insert failed — continue
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked: allStatuses.length,
        alerts: alerts.length,
        emailSent,
        details: allStatuses.map((s) => ({
          profile: s.profileName,
          type: s.tokenType,
          valid: s.isValid,
          expiry: s.expiryLabel,
          needsAction: s.isExpired || (s.daysRemaining !== null && s.daysRemaining <= DAYS_THRESHOLD),
        })),
        checkedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("token-health-check error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
