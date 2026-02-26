

## Plan: Fix Runtime Errors + Resilient Error Handling

### Root Cause
The edge function fires 5 parallel fetches but only checks the first (`campaignData`) for errors. If `statusData`, `dailyData`, or `adData` returns a rate limit or permission error, the code tries to access `.data` on an error response, causing undefined property access and crashes. The frontend also doesn't gracefully handle 429 responses -- React Query treats them as thrown errors but the UI crashes instead of falling back to mock data.

### 1. Edge Function (`supabase/functions/meta-ads-sync/index.ts`)

**Check ALL responses for errors before processing:**
- After `Promise.all`, iterate through all results and check for `.error`
- If any response has a rate limit error, return 429 immediately
- If any non-critical response (status, daily, prev, ads) has an error, continue with partial data instead of crashing
- Add optional chaining (`?.`) on all data access: `results[idx]?.data || []`

**Specific changes:**
- After line 209, add a loop checking each result for rate limit errors
- Wrap statusData, daily, previous, and creatives processing in null-safe blocks
- Default to empty arrays/objects when individual fetches fail

### 2. Frontend Error Handling (`src/hooks/useMetaAds.ts`)

**Handle 429 gracefully:**
- In `queryFn`, check if the edge function error message contains "rate limit" or "Limite de requisições"
- When rate-limited, return the last cached data or mock data instead of throwing
- Set `retry: false` for 429 errors to stop hammering the API

**Profile switch cache invalidation:**
- The `queryKey` already includes `adAccountId`, so switching profiles automatically triggers a new fetch. No change needed here.

### 3. Frontend Rate Limit Banner (`src/pages/Index.tsx`)

- Show a specific amber banner when the error is a rate limit (similar to the mock data banner), telling the user to wait a few minutes
- Don't show "the app encountered an error" -- show the friendly message instead

### Files Modified
- `supabase/functions/meta-ads-sync/index.ts` -- null-safe processing of all parallel fetch results
- `src/hooks/useMetaAds.ts` -- graceful 429 handling, return mock data on rate limit instead of throwing
- `src/pages/Index.tsx` -- rate limit banner UI

