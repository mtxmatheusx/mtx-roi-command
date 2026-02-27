

## Plan: Enhanced Copy Framework + Product Knowledge Base + Creative Library

### Summary

Three major enhancements: (1) upgrade the AI copy generation to produce 3 labeled variations (Direct Response, Storytelling, Social Proof), (2) add a "Product Context" system where URLs are scraped and stored per profile to feed the AI, (3) create a media library for creative assets.

---

### 1. Upgrade AI Copy System Prompt

**File: `supabase/functions/ai-campaign-draft/index.ts`**

- Update `SYSTEM_PROMPT` to explicitly instruct the AI to generate exactly 3 copy variations:
  - Copy 1: **Direct Response (Agressiva)** — focus on pain + immediate offer
  - Copy 2: **Storytelling (Conexao)** — transformation narrative
  - Copy 3: **Social Proof (Autoridade)** — results + undeniable logic
- Add `copy_type` field to each copy option in the tool schema (`"direct_response" | "storytelling" | "social_proof"`)
- Include `product_context` from request body in the user prompt so the AI uses scraped product info
- Instruct AI to adjust copy sophistication based on Ticket Medio and CPA Meta
- Instruct AI to match tone to objective (Vendas = urgency, Leads = curiosity)

### 2. Update Campaign UI Copy Display

**File: `src/pages/LancarCampanha.tsx`**

- Add `copy_type` to the `CopyOption` type
- Display copy type labels with colored badges: "Direct Response" (red), "Storytelling" (blue), "Social Proof" (green)
- Show copy type description below each badge

### 3. Product Knowledge Base — Database

**Migration**: Add columns to `client_profiles`:
- `product_context TEXT` — stores scraped/processed product content
- `product_urls TEXT[]` — stores the URLs that were scraped

### 4. Product Knowledge Base — UI

**File: `src/pages/Configuracoes.tsx`**

Add a new Card section "Contexto do Produto" with:
- Input field for URL
- "Absorver Contexto" button that calls a new edge function
- Display of AI-interpreted summary after absorption
- Stored URLs list with delete option

### 5. Edge Function: `absorb-product-context`

**File: `supabase/functions/absorb-product-context/index.ts`**

- Accepts `{ url, profileId }`
- Fetches the URL content (simple HTML fetch + text extraction — no external scraping service needed for MVP)
- Sends extracted text to Lovable AI with prompt: "Extract: Main Promise, Avatar Pains, Objections, Offer (Hormozi style)"
- Returns structured summary
- Updates `client_profiles.product_context` and `product_urls` in DB

### 6. Creative Asset Library — Database + Storage

**Migration**: Create `creative_assets` table:
```text
id UUID PK
user_id UUID NOT NULL
profile_id UUID FK -> client_profiles
file_name TEXT
file_url TEXT
file_type TEXT (image/video)
description TEXT (user-provided or AI-generated)
created_at TIMESTAMPTZ
```

**Storage**: Create `creative-assets` bucket (public).

### 7. Creative Asset Library — UI

**File: `src/pages/Criativos.tsx`** — Add upload section at top:
- File upload dropzone (images/videos)
- Description input per asset
- Grid display of uploaded assets
- AI can reference these when generating copy suggestions

### 8. Wire Product Context into Campaign Generation

**File: `src/pages/LancarCampanha.tsx`**

- Read `activeProfile.product_context` from `useClientProfiles`
- Pass it to `ai-campaign-draft` edge function call
- AI uses product context to maintain brand consistency

### 9. Config Updates

**File: `supabase/config.toml`** — Add missing entries for `ai-campaign-draft`, `create-meta-campaign`, and new `absorb-product-context`.

---

### Files Created
| File | Purpose |
|---|---|
| `supabase/functions/absorb-product-context/index.ts` | URL scraping + AI extraction |

### Files Modified
| File | Change |
|---|---|
| `supabase/functions/ai-campaign-draft/index.ts` | Enhanced prompt with 3 copy types + product context |
| `src/pages/LancarCampanha.tsx` | Copy type badges + product context pass-through |
| `src/pages/Configuracoes.tsx` | Product context section with URL input |
| `src/pages/Criativos.tsx` | Asset upload + library grid |
| `src/hooks/useClientProfiles.ts` | Add product_context, product_urls fields |
| DB migration | Add columns to client_profiles + create creative_assets table + storage bucket |
| `supabase/config.toml` | Register new function |

### Not included (requires external setup)
- Gemini API Key field: The project already uses Lovable AI (Gemini 3 Flash) without needing a separate key. Adding a custom key field would require switching the entire AI pipeline. Skipped unless explicitly requested again.

