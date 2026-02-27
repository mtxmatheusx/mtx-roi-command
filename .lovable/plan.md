

## Plan: Multi-Link Context, Manual Fallback, Delete Profile, and Error Improvements

### Core Issues from Logs
The `absorb-product-context` edge function is failing with HTTP 429 when fetching URLs (the target website is rate-limiting the scraper). The `create-meta-campaign` function shows no actual errors in logs, suggesting the issue is the client not surfacing the Meta API error details properly.

---

### 1. Improve URL Scraping Resilience

**File: `supabase/functions/absorb-product-context/index.ts`**

- Add retry with backoff for 429 responses from target URLs
- Add custom `User-Agent` rotation
- If fetch still fails after retries, return a specific error code (`scrape_failed`) so the UI can show the manual input fallback
- Handle social media URLs (Instagram, etc.) gracefully with a message that they require manual context

### 2. Manual Context Input Fallback

**File: `src/pages/Configuracoes.tsx`**

- When absorption fails, show a textarea "Inserção Manual de Contexto" where the user can paste raw text
- Add a "Salvar Contexto Manual" button that saves directly to `client_profiles.product_context` without calling the edge function
- The manual context still gets AI-processed via a separate call to extract structured data (main_promise, avatar_pains, etc.)

### 3. Multi-Link Cumulative Context

**File: `supabase/functions/absorb-product-context/index.ts`**

- Instead of replacing `product_context`, append new context to existing
- When 2+ URLs are absorbed, consolidate all into a unified "Dossiê do Cliente" with: Promessa Central, Dores/Objeções Negligenciadas, and 3 Ângulos de Conversão
- The AI prompt already receives all previous context; update it to instruct consolidation

### 4. Delete Profile Button

**File: `src/pages/Configuracoes.tsx`**

- Add a "Excluir Perfil" button at the bottom of the settings page with an AlertDialog confirmation
- Calls `deleteProfile(activeProfile.id)` from `useClientProfiles`
- On success, navigates to dashboard or selects next profile

### 5. Better Error Display for Campaign Publishing

**File: `src/pages/LancarCampanha.tsx`**

- When `create-meta-campaign` returns an error, display the full Meta API error message (already returned by the edge function as `result.error`)
- Show which step failed (campaign/adset/ad) using `result.step`
- Show partial success info (e.g., "Campaign created but ad set failed")

### 6. Fix `create-meta-campaign` Auth

**File: `supabase/functions/create-meta-campaign/index.ts`**

- The function uses `supabase.auth.getClaims()` which may not exist on older supabase-js versions. Replace with `supabase.auth.getUser()` as a fallback
- Ensure the function is registered in `config.toml` with `verify_jwt = false`

---

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/absorb-product-context/index.ts` | Retry logic, cumulative context, better error codes |
| `src/pages/Configuracoes.tsx` | Manual context textarea fallback, delete profile button, AI status indicator |
| `src/pages/LancarCampanha.tsx` | Better error display with step info |
| `supabase/functions/create-meta-campaign/index.ts` | Fix auth method compatibility |

### Not Included
- **Gemini API Key field**: The project uses Lovable AI Gateway which provides Gemini models without needing a separate key. Adding a custom Gemini key would require rewriting the entire AI pipeline. The current setup already works.
- **Monthly auto-report with cron**: Requires `pg_cron` + `pg_net` extensions setup. Planned for a future phase.
- **AI status badge "IA Ativa"**: Since no external API key is needed (Lovable AI is always available), the badge will show "IA Ativa" by default as long as the workspace has credits.

