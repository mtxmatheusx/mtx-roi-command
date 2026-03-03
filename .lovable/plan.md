

## Analysis

The user wants to integrate the external Meta Ads wrapper API (26 endpoints) into the Dashboard page, adding tabs for Campaign creation, Audience creation, and Ad creation. The pasted code has the right UI structure but contains critical issues that must be addressed before implementation.

### Critical Issues Found

1. **Hardcoded credentials in frontend code**: `META_TOKEN` and `API_BASE_URL` are exposed as plain constants in the component. The token is a live Meta access token visible in the browser source code. This is a severe security vulnerability.

2. **No authentication headers**: The API calls don't send the Meta token in headers -- the external API expects `POST /config` to set the token server-side, but there's no initialization call.

3. **`alert()` instead of Toast**: The code uses browser `alert()` for feedback, violating the established error-handling strategy (destructive Toast with technical messages).

4. **Missing JSX wrapper**: The pasted code has bare text fragments where JSX tags were stripped (the `<AppLayout>`, `<div>`, etc. are missing from the paste), suggesting incomplete JSX.

### Implementation Plan

**Task 1: Create typed API client (`src/lib/metaApiClient.ts`)**
- Typed functions for all 26 endpoints grouped by category (campaigns, adsets, audiences, ads, insights)
- Each function accepts `apiBaseUrl` as parameter (from `activeProfile.api_base_url`)
- Token sent via `Authorization: Bearer` header on every request (dual-auth strategy)
- Proper error extraction and typed responses

**Task 2: Update Dashboard (`src/pages/Index.tsx`) with tabbed interface**
- Add Tabs component with 4 tabs: Dashboard, Criar Campanha, Públicos, Anúncios
- Remove hardcoded `API_BASE_URL` and `META_TOKEN` constants -- use `activeProfile.api_base_url` and `metaAccessToken` from `useClientProfiles()`
- Replace all `alert()` calls with `toast()` using `variant: "destructive"` for errors
- Add loading states on all submit buttons
- Keep existing dashboard content intact in the first tab
- Add `api_base_url` field to Configuracoes page so users can set their server URL per profile

**Task 3: Add API URL config to Configuracoes page**
- Add input field for "URL da API Externa" in the credentials section
- Add "Configurar Token no Servidor" button that calls `POST /config` on the external API
- Save `api_base_url` to `client_profiles` via `updateProfile()`

**Task 4: Initialize API connection**
- On Dashboard load, if `api_base_url` is set, call `POST /config` with the stored Meta token to ensure server-side auth is active
- Show connection status indicator

### Security Architecture
```text
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│  Frontend    │────>│  External API    │────>│ Meta API │
│ (Lovable)    │     │  (Permanent VPS) │     │          │
│              │     │                  │     │          │
│ Token from   │     │ Token from       │     │          │
│ profile DB   │     │ POST /config     │     │          │
└─────────────┘     └──────────────────┘     └──────────┘
  Bearer header       Server-side stored
  (per request)       (redundant auth)
```

### Files to Create/Modify
- **Create**: `src/lib/metaApiClient.ts` (typed API client)
- **Modify**: `src/pages/Index.tsx` (add tabs + API integration)
- **Modify**: `src/pages/Configuracoes.tsx` (add API URL field)
- **Modify**: `src/hooks/useClientProfiles.ts` (expose `apiBaseUrl`)

