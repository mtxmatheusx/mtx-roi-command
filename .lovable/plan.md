

## Plano: Status de Campanhas + Log de Automação + Sync Global + Correções

### 1. Edge Function — Adicionar `campaign_id`, `effective_status` ao fetch

**`supabase/functions/meta-ads-sync/index.ts`**
- Adicionar `campaign_id` e `effective_status` aos fields do fetch de campanhas
- Retornar esses campos no response para cada campaign row
- O campo `effective_status` da Meta API retorna: `ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`, etc.

### 2. `useMetaAds.ts` — Expor status real + invalidar cache ao trocar perfil

- Adicionar `effectiveStatus` ao `MetaAdsCampaign` e mapear para `Campaign.status` baseado no valor da API:
  - `ACTIVE` → `active`
  - `PAUSED` → `paused`
  - Outros → `paused`
- Remover lógica atual que infere status a partir de spend/ROAS
- `queryKey` já inclui `adAccountId`, portanto trocar perfil já invalida cache automaticamente

### 3. `mockData.ts` — Adicionar campo `effectiveStatus` ao Campaign type

- Adicionar `effectiveStatus?: string` ao type `Campaign`

### 4. `CampaignsTable.tsx` — Coluna Status com badges + Toggle de filtro

- Adicionar coluna "Status" com badges: `[ATIVO]` verde neon, `[PAUSADO]` cinza
- Adicionar `Switch` toggle "Mostrar apenas ativas" acima da tabela
- Filtrar campanhas com base no toggle

### 5. Campanhas, Criativos, Simulador — Botão "Forçar Atualização" replicado

- **`Campanhas.tsx`**: Adicionar `useClientProfiles` + `DateRangePicker` + botão Refresh com `forceRefetch()` e timestamp independente
- **`Criativos.tsx`**: Adicionar botão Refresh com `forceRefetch()` e timestamp independente
- **`Simulador.tsx`**: Consumir `useMetaAds` para pegar CPA e Ticket Médio reais; adicionar botão Refresh

### 6. `Configuracoes.tsx` — Limpar campos duplicados

- A seção "Controle de Teto Financeiro" tem campos CPA Meta, Ticket Médio e Limite Escala duplicados. Remover a duplicação, mantendo apenas Budget Máximo + Frequência nessa seção.

### 7. `Index.tsx` — Indicador "Monitoramento Ativo" + Log de Automação

- Adicionar pill pulsante no topo: `"● Monitoramento Ativo em Tempo Real"` com animação pulse neon
- Criar seção "Log de Automação" abaixo das campanhas com entries geradas client-side:
  - A cada renderização/refetch, gerar entry: `"Check realizado às HH:MM — ROI atual: X.XX — Nenhuma ação necessária"`
  - Se alguma campanha tiver CPA > 2× meta com 0 vendas: `"AÇÃO: Campanha [Nome] sinalizada por CPA alto"`
  - Armazenar últimos 20 logs em state local

### 8. Não necessita migração SQL

Budget frequency e budget_maximo já existem no schema. Nenhuma alteração de banco necessária.

### Arquivos modificados
- `supabase/functions/meta-ads-sync/index.ts` — campos effective_status
- `src/lib/mockData.ts` — type Campaign atualizado  
- `src/hooks/useMetaAds.ts` — mapear status real
- `src/components/CampaignsTable.tsx` — badges status + toggle filtro
- `src/pages/Campanhas.tsx` — botão refresh + profiles
- `src/pages/Criativos.tsx` — botão refresh
- `src/pages/Simulador.tsx` — dados reais + botão refresh
- `src/pages/Index.tsx` — indicador pulse + log de automação
- `src/pages/Configuracoes.tsx` — remover campos duplicados

