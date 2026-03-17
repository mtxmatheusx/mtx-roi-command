export type AdPlatform = "meta" | "google" | "tiktok" | "linkedin" | "pinterest";

export interface PlatformConnection {
  id: string;
  user_id: string;
  profile_id: string;
  platform: AdPlatform;
  display_name: string;
  credentials: Record<string, unknown>;
  platform_account_id: string | null;
  status: string;
  token_expires_at: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnifiedMetric {
  id: string;
  user_id: string;
  profile_id: string;
  connection_id: string;
  platform: AdPlatform;
  campaign_id: string | null;
  campaign_name: string | null;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  extra_metrics: Record<string, unknown>;
  synced_at: string;
}

export const PLATFORM_CONFIG: Record<AdPlatform, {
  label: string;
  color: string;
  icon: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}> = {
  meta: {
    label: "Meta Ads",
    color: "hsl(214, 89%, 52%)",
    icon: "📘",
    description: "Facebook & Instagram Ads",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Token de acesso da Meta", type: "password" },
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "act_123456789" },
      { key: "pixel_id", label: "Pixel ID", placeholder: "123456789012345" },
      { key: "page_id", label: "Page ID", placeholder: "123456789012345" },
    ],
  },
  google: {
    label: "Google Ads",
    color: "hsl(45, 93%, 47%)",
    icon: "🔍",
    description: "Search, Display, YouTube & Shopping",
    fields: [
      { key: "developer_token", label: "Developer Token", placeholder: "Token de desenvolvedor Google", type: "password" },
      { key: "client_id", label: "OAuth Client ID", placeholder: "xxx.apps.googleusercontent.com" },
      { key: "client_secret", label: "OAuth Client Secret", placeholder: "Client secret", type: "password" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "Refresh token OAuth2", type: "password" },
      { key: "customer_id", label: "Customer ID", placeholder: "123-456-7890" },
      { key: "manager_id", label: "Manager Account ID (opcional)", placeholder: "123-456-7890" },
    ],
  },
  tiktok: {
    label: "TikTok Ads",
    color: "hsl(340, 82%, 52%)",
    icon: "🎵",
    description: "TikTok For Business",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Token de acesso TikTok", type: "password" },
      { key: "advertiser_id", label: "Advertiser ID", placeholder: "ID do anunciante" },
      { key: "app_id", label: "App ID", placeholder: "ID do app TikTok" },
      { key: "secret", label: "App Secret", placeholder: "Secret do app", type: "password" },
    ],
  },
  linkedin: {
    label: "LinkedIn Ads",
    color: "hsl(210, 83%, 45%)",
    icon: "💼",
    description: "LinkedIn Marketing Solutions",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Token de acesso LinkedIn", type: "password" },
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "ID da conta de anúncios" },
      { key: "organization_id", label: "Organization ID", placeholder: "ID da organização" },
    ],
  },
  pinterest: {
    label: "Pinterest Ads",
    color: "hsl(0, 78%, 50%)",
    icon: "📌",
    description: "Pinterest Business",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Token de acesso Pinterest", type: "password" },
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "ID da conta de anúncios" },
    ],
  },
};

export const ALL_PLATFORMS: AdPlatform[] = ["meta", "google", "tiktok", "linkedin", "pinterest"];
