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
  daily_budget: number; // in cents
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

// ── Helpers ────────────────────────────────────────────

async function apiCall<T>(
  baseUrl: string,
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
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
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data as T;
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

function del<T>(baseUrl: string, path: string, token: string): Promise<T> {
  return apiCall<T>(baseUrl, path, token, { method: "DELETE" });
}

// ── API Client ─────────────────────────────────────────

export const metaApi = {
  // ─── Config ───
  configure: (baseUrl: string, token: string, input: ConfigInput) =>
    post<{ status: string }>(baseUrl, "/config", token, input),

  healthCheck: (baseUrl: string, token: string) =>
    get<{ status: string }>(baseUrl, "/health", token),

  // ─── Campaigns ───
  listCampaigns: (baseUrl: string, token: string, adAccountId: string) =>
    get<MetaCampaign[]>(baseUrl, `/campaigns?ad_account_id=${adAccountId}`, token),

  getCampaign: (baseUrl: string, token: string, campaignId: string) =>
    get<MetaCampaign>(baseUrl, `/campaigns/${campaignId}`, token),

  createCampaign: (baseUrl: string, token: string, input: CreateCampaignInput) =>
    post<MetaCampaign>(baseUrl, "/campaigns", token, input),

  updateCampaign: (baseUrl: string, token: string, campaignId: string, data: Partial<CreateCampaignInput>) =>
    put<MetaCampaign>(baseUrl, `/campaigns/${campaignId}`, token, data),

  deleteCampaign: (baseUrl: string, token: string, campaignId: string) =>
    del<{ success: boolean }>(baseUrl, `/campaigns/${campaignId}`, token),

  pauseCampaign: (baseUrl: string, token: string, campaignId: string) =>
    put<MetaCampaign>(baseUrl, `/campaigns/${campaignId}`, token, { status: "PAUSED" }),

  activateCampaign: (baseUrl: string, token: string, campaignId: string) =>
    put<MetaCampaign>(baseUrl, `/campaigns/${campaignId}`, token, { status: "ACTIVE" }),

  // ─── Ad Sets ───
  listAdSets: (baseUrl: string, token: string, campaignId: string) =>
    get<MetaAdSet[]>(baseUrl, `/adsets?campaign_id=${campaignId}`, token),

  createAdSet: (baseUrl: string, token: string, input: CreateAdSetInput) =>
    post<MetaAdSet>(baseUrl, "/adsets", token, input),

  updateAdSet: (baseUrl: string, token: string, adsetId: string, data: Partial<CreateAdSetInput>) =>
    put<MetaAdSet>(baseUrl, `/adsets/${adsetId}`, token, data),

  deleteAdSet: (baseUrl: string, token: string, adsetId: string) =>
    del<{ success: boolean }>(baseUrl, `/adsets/${adsetId}`, token),

  // ─── Ads ───
  listAds: (baseUrl: string, token: string, adsetId: string) =>
    get<MetaAd[]>(baseUrl, `/ads?adset_id=${adsetId}`, token),

  createAd: (baseUrl: string, token: string, input: CreateAdInput) =>
    post<MetaAd>(baseUrl, "/ads", token, input),

  updateAd: (baseUrl: string, token: string, adId: string, data: Partial<CreateAdInput>) =>
    put<MetaAd>(baseUrl, `/ads/${adId}`, token, data),

  deleteAd: (baseUrl: string, token: string, adId: string) =>
    del<{ success: boolean }>(baseUrl, `/ads/${adId}`, token),

  // ─── Audiences ───
  listAudiences: (baseUrl: string, token: string, adAccountId: string) =>
    get<MetaAudience[]>(baseUrl, `/audiences?ad_account_id=${adAccountId}`, token),

  createCustomAudience: (baseUrl: string, token: string, input: CreateAudienceInput) =>
    post<MetaAudience>(baseUrl, "/audiences/custom", token, input),

  deleteAudience: (baseUrl: string, token: string, audienceId: string) =>
    del<{ success: boolean }>(baseUrl, `/audiences/${audienceId}`, token),

  // ─── Scaling ───
  scaleBudget: (baseUrl: string, token: string, input: ScaleBudgetInput) =>
    post<{ success: boolean; new_budget: number }>(baseUrl, "/scale/budget", token, input),

  duplicateCampaign: (baseUrl: string, token: string, input: DuplicateCampaignInput) =>
    post<MetaCampaign>(baseUrl, "/scale/duplicate", token, input),

  // ─── Insights ───
  getInsights: (baseUrl: string, token: string, adAccountId: string, since: string, until: string) =>
    get<MetaInsights[]>(baseUrl, `/insights?ad_account_id=${adAccountId}&since=${since}&until=${until}`, token),

  getCampaignInsights: (baseUrl: string, token: string, campaignId: string, since: string, until: string) =>
    get<MetaInsights[]>(baseUrl, `/insights/campaign/${campaignId}?since=${since}&until=${until}`, token),
};
