

## Plano: Budget Máximo + Alertas + Badges de Status nos Perfis

### 1. Migração SQL — adicionar coluna `budget_maximo`
```sql
ALTER TABLE public.client_profiles ADD COLUMN budget_maximo NUMERIC NOT NULL DEFAULT 0;
```
Valor 0 = sem limite (desativado).

### 2. `useClientProfiles.ts`
- Expor `budgetMaximo` do perfil ativo
- Incluir `budget_maximo` nos types e no `updateProfile`

### 3. `Configuracoes.tsx`
- Adicionar campo "Budget Máximo (R$)" na seção Parâmetros de Automação (grid 3→4 colunas)
- Incluir no schema Zod e no `handleSave`

### 4. `Index.tsx` — Alerta de teto de gastos
- Comparar `totalSpend >= budgetMaximo` (quando `budgetMaximo > 0`)
- Exibir banner vermelho "TETO DE GASTOS ATINGIDO" acima do grid de métricas
- Passar flag `budgetExceeded` para `CampaignsTable`

### 5. `CampaignsTable.tsx` — Desabilitar escala
- Receber prop `disableScale?: boolean`
- Quando `true`, desabilitar botão "Escalar" com tooltip explicativo

### 6. `ProfileSelector.tsx` — Badges de status por perfil
- Para cada perfil no dropdown, mostrar badge colorido:
  - Verde: perfil com `is_active` (indica selecionado)
  - Sem badge extra por enquanto (ROAS real requer fetch por perfil, complexidade alta)
- Manter design atual com indicador de check no ativo

### Arquivos modificados
- **Migração SQL**: `budget_maximo` column
- `src/hooks/useClientProfiles.ts` — expor budgetMaximo
- `src/pages/Configuracoes.tsx` — campo Budget Máximo
- `src/pages/Index.tsx` — alerta teto de gastos
- `src/components/CampaignsTable.tsx` — desabilitar escala quando budget excedido

