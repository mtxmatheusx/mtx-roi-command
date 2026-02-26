

## Plano: Auditoria de Dados + Novos KPIs + Selo de Verificacao

### 1. Edge Function `meta-ads-sync/index.ts`
- Adicionar campos `cost_per_action_type` e `purchase_roas` ao request da Meta API para auditoria
- No `parseCampaignRow`, extrair `cost_per_action_type:purchase` e `purchase_roas` da Meta e comparar com calculo interno
- Se divergencia > 1%, usar os valores da Meta como fonte de verdade
- Retornar flag `dataVerified: boolean` na resposta (true quando calculos internos batem com Meta)
- Incluir `cpm` e `ctr` nos previous period totals para deltas dos novos KPIs

### 2. Hook `useMetaAds.ts`
- Retornar `dataVerified` flag vinda da Edge Function
- Adicionar `cpm`, `ctr`, `impressions` aos totais e previous period
- Calcular `ticketMedio` (AOV) = purchaseValue / purchases
- Ao mudar dateRange, forcar `staleTime: 0` para "Hoje"/"Ontem" (cache bypass automatico)

### 3. Dashboard `Index.tsx` - Novos KPIs
- Expandir grid de 4 para 7 cards (2 linhas: 4 + 3):
  - **CPM** com delta vs anterior
  - **CTR** com `variant="danger"` se < 1%
  - **Ticket Medio (AOV)** calculado dinamicamente
- Manter hierarquia: Lucro Liquido hero > ROAS > demais metricas
- Adicionar selo "Dados Verificados com Meta Ads" (icone ShieldCheck verde) no rodape quando `dataVerified === true`

### 4. Arquivos modificados
- `supabase/functions/meta-ads-sync/index.ts` - auditoria com campos nativos da Meta, flag verified
- `src/hooks/useMetaAds.ts` - expor dataVerified, AOV, CPM/CTR totais, cache bypass para hoje/ontem
- `src/pages/Index.tsx` - 3 novos MetricCards (CPM, CTR, AOV), selo de verificacao no rodape

### Detalhes tecnicos

**Campos adicionais na API Meta:**
```
cost_per_action_type, purchase_roas
```

**Logica de auditoria** (no parseCampaignRow):
- `metaCpa = cost_per_action_type.find(purchase).value`
- `metaRoas = purchase_roas[0].value`
- Se `|calculado - meta| / meta > 0.01`, usar valor da Meta

**Cache bypass** para filtros curtos:
- Quando `since === until` (Hoje/Ontem), setar `staleTime: 0` na query

