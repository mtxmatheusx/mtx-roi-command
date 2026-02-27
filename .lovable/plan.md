

## Plano: Fix Advantage+ age_max constraint

The Meta API error is explicit: when using Advantage+ audience (`targeting_automation.advantage_audience: 1`), `age_max` cannot be less than 65.

### Single Fix in `create-meta-campaign/index.ts`

**Lines 159-168**: When `andromedaTargeting` is present and Advantage+ will be enabled:
- Remove `age_max` from targeting if it's less than 65 (or force it to 65)
- Remove `age_min` as well since Advantage+ handles audience expansion automatically
- Remove `genders` restriction (same reason — Advantage+ expands beyond these)
- Keep `flexible_spec` (interests) as seed signals for Advantage+ algorithm

Essentially: when Advantage+ is ON, strip demographic restrictions that conflict with it. The targeting object should only contain `geo_locations`, optional `flexible_spec` (interests as seeds), and `targeting_automation`.

**Alternative approach**: Keep age_min but force `age_max = 65` when Advantage+ is enabled, since Meta allows age_max=65 specifically.

### Recommended: Hybrid approach
- Keep `age_min` (allowed with Advantage+)
- Force `age_max = 65` when Advantage+ is on (Meta's required minimum for max age)
- Keep `genders` (allowed as suggestion)
- Keep `flexible_spec` (interests as seeds)

### File
| File | Change |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Force age_max=65 when Advantage+ targeting is active |

