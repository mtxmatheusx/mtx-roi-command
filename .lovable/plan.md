

## Plan: Fix Meta API Connection + Budget Configuration

### Problem
The edge function requests `effective_status` in the `/insights` endpoint fields (line 138), which Meta API rejects with error `(#100) effective_status is not valid for fields param`. This breaks ALL data fetching -- campaigns, creatives, and dashboard are empty.

### 1. Edge Function Fix (`supabase/functions/meta-ads-sync/index.ts`)

**Remove `effective_status` from insights fields** (line 138) and add a **separate fetch** to the `/campaigns` endpoint:

```
GET /{adAccountId}/campaigns?fields=id,name,effective_status&limit=100&access_token=...
```

After fetching both insights and campaigns list:
- Build a status map: `{ campaign_id → effective_status }`
- Merge into each campaign row from insights using `campaign_id` as key
- If no match found, default to `undefined` (existing fallback logic handles it)

### 2. Test Connection Fix (`Configuracoes.tsx`)

The test connection calls `meta-ads-sync` which currently fails. The edge function fix above resolves this. No additional changes needed to the test logic -- it already checks for `data.error` and `data.total`.

### 3. Budget Configuration

Budget fields (`budget_maximo`, `budget_frequency`) already exist in the database and are already wired in `Configuracoes.tsx`. The user just needs to save values via the existing UI. The budget progress bar in `Index.tsx` already reads these values and renders correctly.

No code changes needed for budget -- it works once the edge function is fixed and real data flows.

### Files Modified
- `supabase/functions/meta-ads-sync/index.ts` -- remove `effective_status` from insights fields, add separate `/campaigns` fetch, merge status data

