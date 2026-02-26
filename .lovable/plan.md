

## Plano: Ajuste de Precisao - Meta Ads API

### 1. Atualizar Edge Function `meta-ads-sync/index.ts`
- Adicionar `action_attribution_windows=["7d_click","1d_view"]` em todas as chamadas da API
- Adicionar `time_zone=America/Sao_Paulo` (GMT-3) no `buildUrl`
- Garantir mapeamento correto: `actions:purchase`, `action_values:purchase`, `actions:add_to_cart`, `actions:initiate_checkout`, `actions:landing_page_view`
- Retornar campo `fetched_at` (timestamp ISO) na resposta para controle de latencia

### 2. Atualizar hook `useMetaAds.ts`
- Adicionar suporte a `forceRefresh` flag que bypassa o cache do React Query (`refetchType: 'all'` + timestamp na query key)
- Retornar `fetchedAt` do response da Edge Function
- Expor funcao `forceRefetch` que limpa cache e refaz a chamada

### 3. Atualizar Dashboard `Index.tsx`
- Trocar botao "Atualizar" por "Forcar Atualizacao" que chama `forceRefetch`
- Adicionar label "Ultima atualizacao: HH:mm" discreto ao lado do botao
- Melhorar mensagem de erro/loading: "Sincronizando dados com Meta Ads..."

### 4. Arquivos modificados
- `supabase/functions/meta-ads-sync/index.ts` - attribution windows, timezone, fetched_at
- `src/hooks/useMetaAds.ts` - forceRefetch, fetchedAt
- `src/pages/Index.tsx` - UI de ultima atualizacao e forca refresh

### Detalhes tecnicos

**Attribution windows** - parametro `action_attribution_windows` na URL da Meta API:
```
&action_attribution_windows=["7d_click","1d_view"]
```

**Timezone** - parametro na URL:
```
&time_zone=America/Sao_Paulo
```

**Mapeamentos de eventos** - ja estao corretos no `parseCampaignRow` atual (purchase, add_to_cart, initiate_checkout, landing_page_view). Sera validado e mantido.

