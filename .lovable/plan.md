

## Plan: Update Token, Permission Handling, Delete Profiles, Budget R$4000

### 1. Update META_ACCESS_TOKEN Secret
- Use the `add_secret` tool to update `META_ACCESS_TOKEN` with the new long-lived token provided by the user.

### 2. Friendly Permission Error Banner (`src/hooks/useMetaAds.ts`)
- Add `ads_read` permission error detection to the existing rate limit check (look for `"(#10)" `, `"ads_read"`, `"permission"`, `"Unsupported get request"`)
- Set a new `permissionError` state when detected
- Return mock data gracefully instead of crashing

### 3. Permission Banner UI (`src/pages/Index.tsx`)
- Add a specific banner for permission errors: "Conecte seu Token com permissão ads_read na Meta para visualizar dados reais"
- Show above the existing rate limit and mock data banners

### 4. Delete Profile Button (`src/components/ProfileSelector.tsx`)
- Add a delete button (Trash icon) next to each profile in the dropdown
- Call `deleteProfile` from `useClientProfiles` (already implemented)
- Prevent deleting the last remaining profile
- Show confirmation via toast

### 5. Set Budget R$4000 for Active Profile
- Use the database insert tool to update the active profile's `budget_maximo` to `4000` and `budget_frequency` to `'monthly'`

### Files Modified
- `src/hooks/useMetaAds.ts` — add `permissionError` state and detection
- `src/pages/Index.tsx` — permission error banner
- `src/components/ProfileSelector.tsx` — delete profile button

### Database Operations
- Update `META_ACCESS_TOKEN` secret with user's new token
- Update active profile budget to R$4000 monthly

