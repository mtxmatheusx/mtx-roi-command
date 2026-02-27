

## Plan: Creative Thumbnails from Meta API + Date Filter on Criativos Page

### 1. Fetch Ad Thumbnails from Meta API

**File: `supabase/functions/meta-ads-sync/index.ts`**

- Add `ad_id` to `adFields` and include a second fetch at the ad level to get creative details: `GET /{ad_id}?fields=creative{thumbnail_url,image_url,object_story_spec}`
- Simpler approach: add `adcreatives{thumbnail_url,image_url}` to the ad-level insights query, or do a batch call after getting ad IDs
- Actually the cleanest approach: after fetching ad-level insights, collect all `ad_id`s, then fetch `GET /{adAccountId}/ads?fields=id,name,creative{thumbnail_url,image_url}&limit=50` and merge `thumbnail_url` into the creatives array
- Return `thumbnailUrl` field in each creative object

### 2. Add Date Filter to Criativos Page

**File: `src/pages/Criativos.tsx`**

- Import `DateRangePicker` component (already exists)
- Add `dateRange` state initialized to `defaultRange`
- Pass `dateRange` to `useMetaAds` instead of the static `defaultRange`
- Render `<DateRangePicker>` in the header area next to the refresh button

### 3. Display Real Thumbnails

**File: `src/pages/Criativos.tsx`**

- Update `MetaCreative` type in `useMetaAds.ts` to include optional `thumbnailUrl` field
- In the creative card, replace the placeholder icon div with an `<img>` tag when `thumbnailUrl` exists, falling back to the icon placeholder when absent

### 4. Creative Fatigue Detection

**File: `src/pages/Criativos.tsx`**

- Add logic: if a creative has `roas < previousRoas * 0.75` (25% drop), show a "⚠️ POSSÍVEL FADIGA" badge
- This requires comparing current period ROAS against a baseline — use the `previous` period data from `useMetaAds`

---

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/meta-ads-sync/index.ts` | Fetch ad creative thumbnails, return `thumbnailUrl` per creative |
| `src/hooks/useMetaAds.ts` | Add `thumbnailUrl` to `MetaCreative` interface |
| `src/pages/Criativos.tsx` | Add DateRangePicker, display real thumbnails, fatigue badge |

### Not Included
- WhatsApp notifications (requires webhook endpoint setup — separate task)
- Deep commerce scraper (already implemented with Firecrawl in `absorb-product-context`)
- Campaign publishing fix (already addressed in previous iteration with pixel_id injection)

