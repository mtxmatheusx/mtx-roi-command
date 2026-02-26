

## Plan: Fix Connection Test + Rate Limit Handling

### Problem
The "Testar Conexão" button invokes the full `meta-ads-sync` function which fires 4-5 parallel Meta API requests. This triggers Meta's rate limit (`Application request limit reached`), returning a 400 that the frontend shows as "Falha na conexão".

### 1. Edge Function — Add test mode (`meta-ads-sync/index.ts`)

At the top of the handler, check for a `testConnection: true` flag in the request body. If present:
- Only call `GET /{adAccountId}/campaigns?fields=id,name&limit=1`
- If it returns data, respond `{ success: true, total: data.length }`
- If it errors, return the Meta error message
- Skip all insights/daily/previous/creatives fetches

This avoids hitting rate limits for a simple connectivity check.

### 2. Configuracoes — Use test mode

Update `handleTestConnection` to send `{ adAccountId, testConnection: true }` instead of `{ adAccountId, datePreset: "last_7d" }`.

### 3. Edge Function — Better rate limit error handling

When any Meta API response returns `Application request limit reached`, return a user-friendly error message: `"Limite de requisições da Meta atingido. Aguarde alguns minutos."` with status 429 instead of 400.

### Files Modified
- `supabase/functions/meta-ads-sync/index.ts` — add test mode + rate limit handling
- `src/pages/Configuracoes.tsx` — send `testConnection: true`

