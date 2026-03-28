import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfiles } from "./useClientProfiles";

interface TokenAlert {
  profileName: string;
  daysLeft: number;
  status: "expiring" | "expired" | "invalid";
}

export function useTokenHealth() {
  const { profiles } = useClientProfiles();
  const [alerts, setAlerts] = useState<TokenAlert[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (profiles.length === 0) return;

    const profilesWithToken = profiles.filter((p) => p.meta_access_token);
    if (profilesWithToken.length === 0) return;

    let cancelled = false;
    setIsChecking(true);

    const checkTokens = async () => {
      const newAlerts: TokenAlert[] = [];

      for (const profile of profilesWithToken) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${profile.meta_access_token}&access_token=${profile.meta_access_token}`
          );
          const json = await res.json();
          const data = json?.data;

          // debug_token can fail for System User tokens when self-debugging.
          // Instead of marking as invalid, verify the token works by calling /me.
          if (!data || !data.is_valid) {
            // Fallback: try a simple /me call to verify if the token actually works
            const meRes = await fetch(
              `https://graph.facebook.com/v21.0/me?access_token=${profile.meta_access_token}`
            );
            const meJson = await meRes.json();
            if (meJson.id && !meJson.error) {
              // Token works — it's a System User or app token that can't self-debug
              continue;
            }
            newAlerts.push({ profileName: profile.name, daysLeft: 0, status: "invalid" });
            continue;
          }

          // System User tokens have expires_at = 0 — they never expire
          const isSystemUser = data.type === "SYSTEM_USER" || data.type === "system_user";
          if (isSystemUser || !data.expires_at || data.expires_at === 0) {
            // Permanent token — no alert needed
            continue;
          }

          if (data.expires_at > 0) {
            const expiresMs = data.expires_at * 1000;
            const daysLeft = Math.floor((expiresMs - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 5) {
              newAlerts.push({
                profileName: profile.name,
                daysLeft: Math.max(daysLeft, 0),
                status: daysLeft <= 0 ? "expired" : "expiring",
              });
            }
          }
        } catch {
          // silently skip network errors — don't flag as invalid
        }
      }

      if (!cancelled) {
        setAlerts(newAlerts);
        setIsChecking(false);
      }
    };

    checkTokens();
    return () => { cancelled = true; };
  }, [profiles]);

  return { alerts, isChecking };
}
