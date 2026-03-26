/**
 * Typed client for the external Meta Ads wrapper API.
 * All endpoints accept apiBaseUrl (from profile.api_base_url) and token (from profile.meta_access_token).
 */

// ── Types ──────────────────────────────────────────────

export interface MetaApiError {
  error: string;
  details?: unknown;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  created_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: number;
  targeting?: Record<string, unknown>;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  creative?: Record<string, unknown>;
}

export interface MetaAudience {
  id: string;
  name: string;
  subtype: string;
  approximate_count?: number;
}

export interface MetaInsights {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions?: number;
  cost_per_conversion?: number;
  roas?: number;
  date_start?: string;
  date_stop?: string;
}

export interface CreateCampaignInput {
  name: string;
  objective: string;
  daily_budget: number;
  status?: string;
  ad_account_id: string;
}

export interface CreateAdSetInput {
  name: string;
  campaign_id: string;
  daily_budget: number;
  targeting: Record<string, unknown>;
  status?: string;
  ad_account_id: string;
}

export interface CreateAdInput {
  name: string;
  adset_id: string;
  creative: Record<string, unknown>;
  status?: string;
  ad_account_id: string;
}

export interface CreateAudienceInput {
  name: string;
  subtype: string;
  description?: string;
  ad_account_id: string;
}

export interface CreateLookalikeInput {
  name: string;
  source_audience_id: string;
  country: string;
  ratio?: number;
  ad_account_id: string;
}

export interface ScaleBudgetInput {
  campaign_id: string;
  percentage: number;
  ad_account_id: string;
}

export interface DuplicateCampaignInput {
  campaign_id: string;
  new_name?: string;
  ad_account_id: string;
}

export interface ConfigInput {
  meta_token: string;
  ad_account_id?: string;
}

export interface OptimizeInput {
  ad_account_id: string;
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────

const API_TIMEOUT = 30_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF = [1000, 3000];

async function apiCall<T>(
  baseUrl: string,
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF[attempt - 1] || 3000));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error_user_msg || data?.error?.message || data?.error || data?.detail || `API Error ${res.status}`;
        const error = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));

        // Don't retry on auth/permission errors
        if (res.status === 401 || res.status === 403 || res.status === 400) {
          throw error;
        }

        // Retry on 429 (rate limit) and 5xx
        if (res.status === 429 || res.status >= 500) {
          lastError = error;
          continue;
        }

        throw error;
      }

      return data as T;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        lastError = new Error(`Request timeout after ${API_TIMEOUT / 1000}s`);
        continue;
      }
      if (e instanceof TypeError && e.message.includes("fetch")) {
        lastError = new Error("Falha de conexão com a API");
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Request failed after retries");
}

function post<T>(baseUrl: string, path: string, token: string, body: unknown): Promise<T> {
  return apiCall<T>(baseUrl, path, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function get<T>(baseUrl: string, path: string, token: string): Promise<T> {
  return apiCall<T>(baseUrl, path, token, { method: "GET" });
}

function put<T>(baseUrl: string, path: string, token: string, body: unknown): Promise<T> {
  return apiCall<T>(baseUrl, path, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function patch<T>(baseUrl: string, path: string, token: string, body: unknown): Promise<T> {
  return apiCall<T>(baseUrl, path, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function del<T>(baseUrl: string, path: string, token: string): Promise<T> {
  return apiCall<T>(baseUrl, path, token, { method: "DELETE" });
}

// ── API Client ─────────────────────────────────────────

export const metaApi = {
  // ─── Config ───
  configure: (baseUrl: string, token: string, input: ConfigInput) =>
    post<{ status: string }>(baseUrl, "/api/config", token, input),

  healthCheck: (baseUrl: string, token: string) =>
    get<{ status: string }>(baseUrl, "/api/health", token),

  // ─── Campaigns ───
  listCampaigns: (baseUrl: string, token: string, adAccountId: string) =>
    get<MetaCampaign[]>(baseUrl, `/api/campaigns?ad_account_id=${adAccountId}`, token),

  getCampaign: (baseUrl: string, token: string, campaignId: string) =>
    get<MetaCampaign>(baseUrl, `/api/campaigns/${campaignId}`, token),

  createCampaign: (baseUrl: string, token: string, input: CreateCampaignInput) =>
    post<MetaCampaign>(baseUrl, "/api/campaigns", token, input),

  updateCampaign: (baseUrl: string, token: string, campaignId: string, data: Partial<CreateCampaignInput>) =>
    patch<MetaCampaign>(baseUrl, `/api/campaigns/${campaignId}`, token, data),

  deleteCampaign: (baseUrl: string, token: string, campaignId: string) =>
    del<{ success: boolean }>(baseUrl, `/api/campaigns/${campaignId}`, token),

  pauseCampaign: (baseUrl: string, token: string, campaignId: string) =>
    patch<MetaCampaign>(baseUrl, `/api/campaigns/${campaignId}`, token, { status: "PAUSED" }),

  activateCampaign: (baseUrl: string, token: string, campaignId: string) =>
    patch<MetaCampaign>(baseUrl, `/api/campaigns/${campaignId}`, token, { status: "ACTIVE" }),

  // ─── Ad Sets ───
  listAdSets: (baseUrl: string, token: string, campaignId: string) =>
    get<MetaAdSet[]>(baseUrl, `/api/adsets?campaign_id=${campaignId}`, token),

  createAdSet: (baseUrl: string, token: string, input: CreateAdSetInput) =>
    post<MetaAdSet>(baseUrl, "/api/ads/adset", token, input),

  updateAdSet: (baseUrl: string, token: string, adsetId: string, data: Partial<CreateAdSetInput>) =>
    patch<MetaAdSet>(baseUrl, `/api/adsets/${adsetId}`, token, data),

  deleteAdSet: (baseUrl: string, token: string, adsetId: string) =>
    del<{ success: boolean }>(baseUrl, `/api/adsets/${adsetId}`, token),

  // ─── Ads ───
  listAds: (baseUrl: string, token: string, adsetId: string) =>
    get<MetaAd[]>(baseUrl, `/api/ads?adset_id=${adsetId}`, token),

  createAd: (baseUrl: string, token: string, input: CreateAdInput) =>
    post<MetaAd>(baseUrl, "/api/ads/ad", token, input),

  createCreative: (baseUrl: string, token: string, input: Record<string, unknown>) =>
    post<Record<string, unknown>>(baseUrl, "/api/ads/creative", token, input),

  updateAd: (baseUrl: string, token: string, adId: string, data: Partial<CreateAdInput>) =>
    patch<MetaAd>(baseUrl, `/api/ads/${adId}`, token, data),

  deleteAd: (baseUrl: string, token: string, adId: string) =>
    del<{ success: boolean }>(baseUrl, `/api/ads/${adId}`, token),

  // ─── Audiences ───
  listAudiences: (baseUrl: string, token: string, adAccountId: string) =>
    get<MetaAudience[]>(baseUrl, `/api/audiences?ad_account_id=${adAccountId}`, token),

  createCustomAudience: (baseUrl: string, token: string, input: CreateAudienceInput) =>
    post<MetaAudience>(baseUrl, "/api/audiences/custom", token, input),

  createLookalikeAudience: (baseUrl: string, token: string, input: CreateLookalikeInput) =>
    post<MetaAudience>(baseUrl, "/api/audiences/lookalike", token, input),

  deleteAudience: (baseUrl: string, token: string, audienceId: string) =>
    del<{ success: boolean }>(baseUrl, `/api/audiences/${audienceId}`, token),

  // ─── Scaling ───
  scaleBudget: (baseUrl: string, token: string, input: ScaleBudgetInput) =>
    post<{ success: boolean; new_budget: number }>(baseUrl, "/api/scale/budget", token, input),

  duplicateCampaign: (baseUrl: string, token: string, input: DuplicateCampaignInput) =>
    post<MetaCampaign>(baseUrl, "/api/scale/duplicate", token, input),

  // ─── Insights / Metrics ───
  getMetrics: (baseUrl: string, token: string, adAccountId: string) =>
    get<MetaInsights[]>(baseUrl, `/api/metrics?ad_account_id=${adAccountId}`, token),

  getInsights: (baseUrl: string, token: string, adAccountId: string, since: string, until: string) =>
    get<MetaInsights[]>(baseUrl, `/api/metrics?ad_account_id=${adAccountId}&since=${since}&until=${until}`, token),

  getCampaignInsights: (baseUrl: string, token: string, campaignId: string, since: string, until: string) =>
    get<MetaInsights[]>(baseUrl, `/api/metrics/campaign/${campaignId}?since=${since}&until=${until}`, token),

  // ─── AI Optimize ───
  optimize: (baseUrl: string, token: string, input: OptimizeInput) =>
    post<Record<string, unknown>>(baseUrl, "/api/ai/optimize", token, input),
};
