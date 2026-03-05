

## Plan: Connect to External API Backend

The current `metaApiClient.ts` uses paths like `/campaigns`, `/audiences/custom`, `/ads` — but the real API uses `/api/campaigns`, `/api/audiences/custom`, etc. The `apiBaseUrl` defaults to `null` when no profile config exists. Two changes are needed:

### 1. Set default `apiBaseUrl` in `useClientProfiles.ts` (line 144)

Change the fallback from `null` to `"https://ghz-thomas-volt-database.trycloudflare.com"` so the API is always available even without explicit configuration.

### 2. Update `metaApiClient.ts` endpoint paths

Prefix all API paths with `/api` to match the real server endpoints:
- `/campaigns` → `/api/campaigns`
- `/adsets` → `/api/adsets`  
- `/audiences/custom` → `/api/audiences/custom`
- `/ads` → `/api/ads`
- `/insights` → `/api/metrics` (renamed endpoint)
- `/scale/budget` → `/api/scale/budget`
- `/scale/duplicate` → `/api/scale/duplicate`
- `/config` → `/api/config` (if applicable)
- `/health` → `/api/health` (if applicable)

Also update the `CreateAdTab` to match the real API structure — the real endpoints are:
- `POST /api/ads/adset` — create ad set
- `POST /api/ads/creative` — create creative
- `POST /api/ads/ad` — create ad

And add `POST /api/ai/optimize` as a new method.

### 3. Files to modify
- `src/hooks/useClientProfiles.ts` — default apiBaseUrl
- `src/lib/metaApiClient.ts` — prefix all paths with `/api`, add ai/optimize endpoint
- `src/components/dashboard/CreateAdTab.tsx` — update to use correct `/api/ads/ad` path
- `src/components/dashboard/CreateAudienceTab.tsx` — already correct structure, just path update via client
- `src/components/dashboard/CreateCampaignTab.tsx` — already correct structure, just path update via client

