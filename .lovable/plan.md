

## Plan: Per-Profile Access Token + localStorage Cache

### 1. Database Migration — Add `meta_access_token` column
Add a nullable `meta_access_token` text column to `client_profiles` (default `NULL`). When NULL, the edge function falls back to the global `META_ACCESS_TOKEN` secret.

### 2. Update `ClientProfile` type and hook (`src/hooks/useClientProfiles.ts`)
- Add `meta_access_token` to the `ClientProfile` interface
- Expose it in convenience getters
- Remove `as any` casts now that `budget_maximo`/`budget_frequency` exist in the DB types

### 3. Add Token field in Configurações (`src/pages/Configuracoes.tsx`)
- Add a password-type input for "Access Token (opcional)" in the Credenciais Meta Ads card
- Replace the static green "Access Token configurado" badge with dynamic logic: show green if profile has a token OR if the global secret exists, show amber if neither
- Include the token in `handleSave` and `handleTestConnection`
- Mask the stored token in the input (show last 6 chars only)

### 4. Pass token to edge function (`src/hooks/useMetaAds.ts`)
- Accept `accessToken` in `profileConfig`
- Send it in the request body as `accessToken`

### 5. Update edge function (`supabase/functions/meta-ads-sync/index.ts`)
- Accept optional `accessToken` from request body
- Use it if provided, otherwise fall back to `Deno.env.get("META_ACCESS_TOKEN")`

### 6. localStorage cache (`src/hooks/useMetaAds.ts`)
- On successful API response, save `{ campaigns, daily, previous, creatives, fetchedAt }` to `localStorage` keyed by `meta-ads-cache-${adAccountId}`
- On rate limit or permission error, attempt to load cached data instead of returning mock data
- Show a different banner message: "Exibindo dados do cache local" with the cached timestamp
- Add `isCached` boolean to the return value

### 7. Cache banner in Dashboard (`src/pages/Index.tsx`)
- When `isCached` is true, show: "Exibindo dados reais do cache (última sync: HH:MM). Aguarde para sincronizar novamente."

### Files Modified
| File | Change |
|---|---|
| DB migration | Add `meta_access_token TEXT DEFAULT NULL` |
| `src/hooks/useClientProfiles.ts` | Add field + getter |
| `src/pages/Configuracoes.tsx` | Token input field |
| `src/hooks/useMetaAds.ts` | Pass token, localStorage cache |
| `supabase/functions/meta-ads-sync/index.ts` | Accept per-profile token |
| `src/pages/Index.tsx` | Cache banner |

