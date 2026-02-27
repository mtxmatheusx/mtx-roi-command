

## Plan: Fix Campaign Publishing + Deep Scraper + Pixel Injection

### Summary
Three focused improvements: (1) fix the `create-meta-campaign` edge function to inject `pixel_id` and surface real Meta errors, (2) add Firecrawl-powered deep crawling for e-commerce sites, (3) add the Gemini API Key field as requested.

---

### 1. Fix `create-meta-campaign` — Pixel Injection + Error Detail

**File: `supabase/functions/create-meta-campaign/index.ts`**

- Add `promoted_object: { pixel_id: profile.pixel_id }` to the AdSet creation body when objective is `OUTCOME_SALES` or `OUTCOME_LEADS`
- Surface `error_user_msg` from Meta API responses (Meta returns both `error.message` and `error.error_user_msg` — the latter is human-readable)
- Add token scope validation: before creating, call `GET /me?access_token=...&fields=id` to verify token is valid; if it fails, return a clear "Token inválido ou sem permissão ads_management"

### 2. Gemini API Key Field in Settings

**Database migration**: Add `gemini_api_key TEXT` column to `client_profiles`

**File: `src/pages/Configuracoes.tsx`**
- Add new Card section "🧠 Inteligência Artificial (Gemini)" between Meta Credentials and Product Context
- Password input for "Gemini API Key" with save behavior identical to `meta_access_token`
- Green neon brain icon when key is present, gray when empty
- Note: The system already works via Lovable AI Gateway without this key. When present, the key will be used as an alternative for the `absorb-product-context` function

**File: `src/hooks/useClientProfiles.ts`**
- Add `gemini_api_key` to `ClientProfile` interface and `UpdateProfileInput`
- Expose `geminiApiKey` from hook

### 3. Deep Commerce Scraper with Firecrawl

**Prerequisite**: Connect Firecrawl connector for deep crawling capability

**File: `supabase/functions/absorb-product-context/index.ts`**
- Check for `FIRECRAWL_API_KEY` env var
- If present and URL is an e-commerce root/home page, use Firecrawl `/v1/crawl` endpoint with `maxDepth: 2`, `limit: 20` to recursively scrape category pages and product pages
- If Firecrawl is not configured, fall back to current simple fetch behavior
- Extract best-seller indicators: parse for keywords like "Mais Vendido", "Promoção", "Best Seller", star ratings
- Send all crawled text to AI for consolidated "Dossiê de Produto"

**File: `src/pages/Configuracoes.tsx`**
- When `geminiApiKey` is empty, disable the "Absorver Contexto" button with message: "Conecte a chave IA para ativar o Scraper"
- Actually: since Lovable AI works without external keys, this gate will check if the system has AI available (it always does via Lovable AI), so the button stays enabled. The Gemini key field is optional.

### 4. Wire Pixel ID into Campaign UI

**File: `src/pages/LancarCampanha.tsx`**
- Show a warning if `activeProfile.pixel_id` is empty when objective is Sales/Leads: "Pixel ID não configurado. Campanhas de conversão requerem um Pixel."

---

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Inject pixel_id in promoted_object, surface error_user_msg |
| `supabase/functions/absorb-product-context/index.ts` | Add Firecrawl deep crawl when available |
| `src/pages/Configuracoes.tsx` | Add Gemini API Key section |
| `src/pages/LancarCampanha.tsx` | Pixel warning for conversion campaigns |
| `src/hooks/useClientProfiles.ts` | Add gemini_api_key field |
| DB migration | Add gemini_api_key to client_profiles |

### Prerequisites
- Firecrawl connector setup (optional — falls back to simple fetch if not configured)

