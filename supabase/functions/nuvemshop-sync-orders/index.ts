// Nuvemshop — Sincroniza pedidos com extração de UTMs
// Pode ser invocada manualmente ou via pg_cron.
// Aceita: { connection_id?: string, profile_id?: string, days_back?: number }
// Se nenhum filtro vier, sincroniza TODAS as conexões ativas (modo cron).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NUVEMSHOP_API_BASE = "https://api.nuvemshop.com.br/v1";

interface NuvemshopOrder {
  id: number;
  number: number;
  status: string;
  payment_status?: string;
  total: string;
  currency?: string;
  created_at: string;
  contact_email?: string;
  landing_page?: string;
  client_details?: { browser_ip?: string; user_agent?: string };
  attributes?: Array<{ name: string; value: string }>;
  note?: string;
}

function extractUTMs(order: NuvemshopOrder): Record<string, string | null> {
  const utms: Record<string, string | null> = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };

  // 1) Try landing_page query string (Nuvemshop's primary location)
  if (order.landing_page) {
    try {
      const url = new URL(
        order.landing_page.startsWith("http")
          ? order.landing_page
          : `https://x.com${order.landing_page.startsWith("/") ? "" : "/"}${order.landing_page}`
      );
      for (const key of Object.keys(utms)) {
        const v = url.searchParams.get(key);
        if (v) utms[key] = v;
      }
    } catch {
      // ignore parse errors
    }
  }

  // 2) Fallback: order.attributes (custom checkout fields)
  if (Array.isArray(order.attributes)) {
    for (const attr of order.attributes) {
      const name = (attr.name || "").toLowerCase();
      if (name in utms && !utms[name]) utms[name] = attr.value;
    }
  }

  return utms;
}

async function fetchOrdersPage(
  storeId: string,
  accessToken: string,
  page: number,
  perPage: number,
  createdAtMin: string,
): Promise<NuvemshopOrder[]> {
  const url = new URL(`${NUVEMSHOP_API_BASE}/${storeId}/orders`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("created_at_min", createdAtMin);
  url.searchParams.set("fields",
    "id,number,status,payment_status,total,currency,created_at,contact_email,landing_page,attributes,note");

  const res = await fetch(url.toString(), {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "MTX Command Center (contato@mtx.com)",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Nuvemshop API ${res.status}: ${txt}`);
  }
  return await res.json();
}

async function syncConnection(
  supabase: ReturnType<typeof createClient>,
  connection: any,
  daysBack: number,
): Promise<{ inserted: number; updated: number; total: number }> {
  // Mark as running
  await supabase
    .from("ecommerce_connections")
    .update({ last_sync_status: "running", last_sync_error: null })
    .eq("id", connection.id);

  const createdAtMin = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000,
  ).toISOString();

  let page = 1;
  const perPage = 200;
  let totalProcessed = 0;
  let inserted = 0;
  let updated = 0;

  try {
    while (true) {
      const orders = await fetchOrdersPage(
        connection.store_id,
        connection.access_token,
        page,
        perPage,
        createdAtMin,
      );
      if (!orders.length) break;

      const rows = orders.map((o) => {
        const utms = extractUTMs(o);
        return {
          user_id: connection.user_id,
          profile_id: connection.profile_id,
          connection_id: connection.id,
          platform: "nuvemshop",
          external_order_id: String(o.id),
          order_number: o.number ? String(o.number) : null,
          order_status: o.payment_status || o.status || null,
          total_amount: parseFloat(o.total || "0") || 0,
          currency: o.currency || "BRL",
          customer_email: o.contact_email || null,
          utm_source: utms.utm_source,
          utm_medium: utms.utm_medium,
          utm_campaign: utms.utm_campaign,
          utm_content: utms.utm_content,
          utm_term: utms.utm_term,
          landing_page: o.landing_page || null,
          referrer: null,
          ordered_at: o.created_at,
          raw_payload: o,
        };
      });

      // Upsert by (connection_id, external_order_id)
      const { error: upErr, count } = await supabase
        .from("utm_sales")
        .upsert(rows, {
          onConflict: "connection_id,external_order_id",
          count: "exact",
        });
      if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);

      inserted += count || rows.length;
      totalProcessed += rows.length;

      if (orders.length < perPage) break;
      page++;
      if (page > 50) break; // hard safety: max 10k orders/sync
    }

    await supabase
      .from("ecommerce_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
        orders_synced: (connection.orders_synced || 0) + totalProcessed,
      })
      .eq("id", connection.id);

    return { inserted, updated, total: totalProcessed };
  } catch (err: any) {
    await supabase
      .from("ecommerce_connections")
      .update({
        last_sync_status: "error",
        last_sync_error: String(err?.message || err),
      })
      .eq("id", connection.id);
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok for cron */ }
    const { connection_id, profile_id, days_back = 30 } = body;

    let q = supabase
      .from("ecommerce_connections")
      .select("*")
      .eq("is_active", true)
      .eq("platform", "nuvemshop")
      .not("access_token", "is", null);

    if (connection_id) q = q.eq("id", connection_id);
    else if (profile_id) q = q.eq("profile_id", profile_id);

    const { data: connections, error } = await q;
    if (error) throw error;
    if (!connections?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma conexão ativa para sincronizar", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = [];
    for (const conn of connections) {
      try {
        const r = await syncConnection(supabase, conn, days_back);
        results.push({ connection_id: conn.id, store_name: conn.store_name, ...r });
      } catch (err: any) {
        results.push({
          connection_id: conn.id,
          store_name: conn.store_name,
          error: String(err?.message || err),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[nuvemshop-sync-orders]", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
