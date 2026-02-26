

## Plano: Gráficos + Filtro de Data + Deltas de Comparação

### 1. Atualizar Edge Function `meta-ads-sync`
- Aceitar parâmetros `since` e `until` (datas) além do `datePreset`
- Quando `since`/`until` forem passados, usar `time_range` da Meta API em vez de `date_preset`
- Adicionar campo `date_start` nos dados retornados para permitir gráficos por dia
- Fazer segunda chamada com período anterior (mesmo intervalo) para calcular deltas

### 2. Atualizar hook `useMetaAds`
- Aceitar parâmetros de data (`dateRange: { since, until } | preset`)
- Passar datas para a Edge Function
- Retornar dados do período atual E do período anterior para cálculo de deltas
- Query key incluir datas para reatividade automática

### 3. Criar componente `DateRangePicker` (`src/components/DateRangePicker.tsx`)
- Botões de atalho: "Hoje", "Ontem", "Últimos 7 dias", "Últimos 30 dias", "Mês Atual"
- Popover com Calendar em modo `range` para seleção personalizada
- Estilo dark com bordas zinc-800, período selecionado em vermelho neon
- Emitir `onChange` com `{ since, until }`

### 4. Atualizar `MetricCard` com delta
- Adicionar prop `delta?: number` (percentual de variação)
- Exibir seta para cima/baixo com cor verde/vermelho e texto "vs período anterior"

### 5. Criar componente `DashboardCharts` (`src/components/DashboardCharts.tsx`)
- 3 gráficos em grid usando Recharts (`LineChart` ou `AreaChart`):
  - **CPA** ao longo do tempo (com linha de meta em vermelho tracejado)
  - **ROAS** ao longo do tempo
  - **Lucro** acumulado (AreaChart verde)
- Estilo: cards com bordas zinc-800, labels em DM Sans, cores neon

### 6. Atualizar `Index.tsx` (Dashboard)
- Adicionar `DateRangePicker` no header ao lado do botão Atualizar
- Estado de data controlado no Dashboard, passado ao `useMetaAds`
- Calcular deltas comparando período atual vs anterior
- Renderizar `DashboardCharts` entre os MetricCards e a tabela
- Passar deltas aos MetricCards

### Arquivos modificados/criados:
- `supabase/functions/meta-ads-sync/index.ts` — suporte a time_range + período anterior
- `src/hooks/useMetaAds.ts` — aceitar datas, retornar dados de comparação
- `src/components/DateRangePicker.tsx` — novo
- `src/components/DashboardCharts.tsx` — novo
- `src/components/MetricCard.tsx` — adicionar delta
- `src/pages/Index.tsx` — integrar tudo

