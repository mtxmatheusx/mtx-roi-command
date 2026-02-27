

## Plan: Campaign Creation with AI Assistance + Human Approval

This plan covers a realistic, high-impact subset of the request. Features like WhatsApp webhook integration, automatic monthly reports with cron jobs, and direct Meta API write access require significant external setup (Meta App Review for `ads_management` permission, WhatsApp Business API) that cannot be automated here. Those are noted as future phases.

---

### What gets built now

A **"Lançar Campanha"** page where the AI drafts campaign strategies, the user reviews and approves, and the system attempts to create them via Meta API. All drafts are persisted for learning.

---

### 1. Database: `campaign_drafts` table

New table to persist all AI-generated campaign drafts and their approval status.

```sql
CREATE TABLE public.campaign_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, approved, published, failed, rejected
  objective TEXT NOT NULL, -- OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_ENGAGEMENT
  campaign_name TEXT NOT NULL,
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  copy_options JSONB DEFAULT '[]',
  targeting_suggestion JSONB DEFAULT '{}',
  ai_reasoning TEXT, -- AI's chain-of-thought explanation
  meta_campaign_id TEXT, -- filled after publish
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts" ON public.campaign_drafts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_campaign_drafts_updated_at
  BEFORE UPDATE ON public.campaign_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2. Edge Function: `create-meta-campaign`

New edge function that:
- Accepts a draft ID + approval flag
- Reads the draft from the DB
- Calls Meta API endpoints: `POST /{adAccountId}/campaigns`, then `/adsets`, then `/ads`
- Updates the draft with Meta IDs or error
- Requires the user's access token (per-profile or global)
- Returns progress status for each step

**Important**: Meta API write access requires `ads_management` permission on the token. The function will validate this and return a clear error if missing.

### 3. Edge Function: `ai-campaign-draft`

New edge function that uses Lovable AI to generate campaign strategies:
- Accepts: objective, profile config (CPA meta, ticket medio), current campaign performance data
- System prompt instructs Gemini to act as "Estrategista Senior MTX" using Hormozi Value Equation + StoryBrand
- Returns structured output via tool calling: campaign name (MTX pattern), 3 copy options, targeting suggestion, daily budget recommendation, AI reasoning
- Considers budget_maximo constraint

### 4. New Page: `/lancar-campanha`

**File: `src/pages/LancarCampanha.tsx`**

Three-step wizard:

**Step 1 — Objective & Config**
- Dropdown: Vendas, Leads, Engajamento
- Daily budget input (with budget_maximo validation)
- "Sugestao da IA" button that auto-fills everything

**Step 2 — AI Draft Review**
- Shows AI-generated campaign name, 3 copy options (selectable), targeting suggestion, budget breakdown
- AI reasoning section (collapsible) showing chain-of-thought
- Edit any field manually

**Step 3 — Approval & Publish**
- Full summary card with all parameters
- "Aprovar Execucao" button (primary, prominent)
- "Salvar como Rascunho" button (secondary)
- Progress bar on publish: "Criando Campanha..." → "Configurando Conjunto..." → "Subindo Criativo..."
- On success: show Meta campaign ID + link to Ads Manager
- On failure: show error + save to drafts with `failed` status

### 5. Campaign History Section

Below the wizard, show a table of all past drafts with status badges (draft/approved/published/failed/rejected), dates, and the ability to re-use a draft.

### 6. Optimization Rules (Hormozi Rules)

Add to the AI system prompt and as automation alerts in the dashboard:
- **Auto-pause suggestion**: If spend > 2x CPA Meta with 0 conversions, flag the adset
- **Scale suggestion**: If ROI > 1.3x target (30% above), suggest +15% daily budget, capped at budget_maximo
- These are **suggestions only** — displayed as actionable cards, not auto-executed

### 7. Navigation Update

Add "Lancar Campanha" to sidebar with `Rocket` icon, between Diagnostico and Simulador.

---

### Files Created
| File | Purpose |
|---|---|
| `src/pages/LancarCampanha.tsx` | Campaign creation wizard |
| `supabase/functions/ai-campaign-draft/index.ts` | AI strategy generation |
| `supabase/functions/create-meta-campaign/index.ts` | Meta API campaign creation |

### Files Modified
| File | Change |
|---|---|
| DB migration | `campaign_drafts` table |
| `src/App.tsx` | Add `/lancar-campanha` route |
| `src/components/AppSidebar.tsx` | Add nav item |
| `supabase/config.toml` | Register 2 new functions |
| `src/integrations/supabase/types.ts` | Auto-updated |

### Limitations & Future Phases
- **Meta `ads_management` permission**: Your Meta access token must have this scope. If it doesn't, the publish step will fail with a clear error message explaining what to request in Meta Business Settings.
- **WhatsApp webhook**: Requires Evolution API or Make.com setup — out of scope for this phase but the draft system supports it (webhook on status change).
- **Monthly auto-report**: Requires cron job — planned for Phase 2.
- **Media library browsing**: Requires `pages_read_engagement` + `business_creative_insights` permissions — added as future enhancement.

