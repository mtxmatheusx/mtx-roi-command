

## Plano: Limite de Orçamento com Frequência + Barra de Progresso + Sincronização de Criativos

### 1. Migração SQL — adicionar colunas de frequência do limite

```sql
ALTER TABLE public.client_profiles 
  ADD COLUMN budget_frequency TEXT NOT NULL DEFAULT 'monthly';
-- budget_frequency: 'daily', 'weekly', 'monthly'
-- budget_maximo já existe (valor do limite)
```

### 2. `useClientProfiles.ts` — expor `budgetFrequency`
- Adicionar `budgetFrequency` ao retorno do hook
- Incluir no `updateProfile`

### 3. `Configuracoes.tsx` — UI do Limite de Orçamento
- Substituir campo simples de "Budget Máximo" por um grupo com:
  - Input "Valor do Limite (R$)" (já existe como `budgetMaximo`)
  - Select dropdown "Frequência" com opções: Diário, Semanal, Mensal
- Incluir `budgetFrequency` no schema Zod e no `handleSave`

### 4. `Index.tsx` — Lógica de cálculo por período + barra de progresso
- Calcular `totalSpend` baseado no período que corresponde à frequência:
  - **Diário**: spend do dia atual (filtrar `daily` pelo dia de hoje)
  - **Semanal**: spend dos últimos 7 dias (soma de `daily`)
  - **Mensal**: spend do mês atual (soma de `daily` filtrado pelo mês)
- Comparar com `budgetMaximo`; se atingido, exibir alerta com texto dinâmico: "Limite [Diário/Semanal/Mensal] de R$ X atingido"
- Adicionar `Progress` bar abaixo do alerta mostrando `(spendNoPeriodo / budgetMaximo) * 100`%
- Passar `budgetExceeded` para `CampaignsTable`

### 5. `meta-ads-sync/index.ts` — Buscar dados por Ad (criativos reais)
- Adicionar novo fetch com `level=ad` incluindo campos extras: `ad_name`, `adcreatives{thumbnail_url}`
- Retornar array `creatives` no response com: nome, thumbnail, spend, purchases, roas, ctr
- Manter fetches existentes (campaign, daily, previous) inalterados

### 6. `useMetaAds.ts` — Expor `creatives` do response
- Mapear `data.creatives` para um tipo `MetaCreative`
- Retornar no hook junto com campaigns/daily

### 7. `Criativos.tsx` — Renderizar criativos reais
- Consumir `useMetaAds` + `useClientProfiles` em vez de `mockCreatives`
- Exibir thumbnail real do criativo (se disponível)
- Mostrar ROI individual, spend, CTR por criativo
- Fallback para mock se `isUsingMock`

### Arquivos modificados
- **Migração SQL**: coluna `budget_frequency`
- `src/hooks/useClientProfiles.ts` — expor budgetFrequency
- `src/pages/Configuracoes.tsx` — dropdown de frequência
- `src/pages/Index.tsx` — lógica por período + Progress bar
- `supabase/functions/meta-ads-sync/index.ts` — fetch level=ad
- `src/hooks/useMetaAds.ts` — expor creatives
- `src/pages/Criativos.tsx` — renderizar criativos reais

### Fluxo de dados

```text
client_profiles.budget_frequency + budget_maximo
  ↓
Index.tsx → calcula spend no período (daily/weekly/monthly)
  ↓
  spend >= limite? → alerta vermelho + Progress bar + disableScale
  
meta-ads-sync (level=ad) → creatives[]
  ↓
useMetaAds → { creatives }
  ↓
Criativos.tsx → cards com thumbnail + ROI individual
```

