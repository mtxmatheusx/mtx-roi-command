

## Plano: Estado Global de Perfil + Master Dashboard da Agência

### Parte 1: Estado Global com Invalidação de Cache

**Problema atual:** `useClientProfiles` já fornece `activeProfile`, mas ao trocar de perfil, os caches do React Query das outras abas não são limpos — dados do cliente anterior permanecem visíveis até navegação manual.

**Solução:**

#### 1. Invalidação global no `setActiveProfile` (`useClientProfiles.ts`)
- Após trocar perfil no banco, chamar `queryClient.invalidateQueries()` para limpar **todos** os caches relevantes: `meta-ads`, `creative_assets`, `campaign_drafts`, `client_profiles`
- Limpar localStorage de cache Meta Ads (`meta_ads_cache_*`)

#### 2. Skeleton Loading durante transição
- Criar componente `ProfileTransitionGuard` que envolve o conteúdo de `AppLayout`
- Detecta mudança de `activeProfile?.id` e exibe skeleton por ~500ms durante re-fetch
- Skeleton com layout genérico (cards + tabela) usando componente `Skeleton` existente

#### 3. Garantir `profile_id` em todas as queries
- `Diagnostico.tsx`: Limpar `report` state quando `activeProfile?.id` mudar (useEffect)
- `LancarCampanha.tsx`: Filtrar `campaign_drafts` por `profile_id` (atualmente filtra só por `user_id`)
- `Criativos.tsx`: Já filtra por `profile_id` — OK
- `useMetaAds`: Já usa `adAccountId` como query key — OK (muda automaticamente)

---

### Parte 2: Master Dashboard — Visão da Agência

#### 4. Nova página `src/pages/AgencyView.tsx`
- Rota `/agencia` no `App.tsx`
- Item "Visão da Agência" no topo do sidebar com ícone `Building2`, acima do `ProfileSelector`
- **Não** filtra por `activeProfileId` — agrega dados de todos os perfis

#### 5. Métricas Agregadas (4 cards executivos)
- Busca todos os perfis do usuário
- Para cada perfil com `ad_account_id` válido, chama `meta-ads-sync` em paralelo
- Calcula:
  - Gasto Total MTX (mês atual)
  - Faturamento Estimado (soma receita)
  - ROAS Global (média ponderada)
  - Saúde da Operação (contas ativas vs com erro)

#### 6. Ranking de Performance (Client Leaderboard)
- Tabela ordenada por ROAS ou compras nos últimos 7 dias
- Colunas: Cliente, Gasto, Receita, ROAS, Compras, Status
- Botão "Gerenciar" → seta `setActiveProfile(id)` e redireciona para `/`

#### 7. Radar do Gestor IA (Alertas Globais)
- Edge function `agency-alerts` que:
  - Recebe array de perfis com seus dados agregados
  - Envia ao Lovable AI (Gemini Flash) com prompt de "Gestor de Agência"
  - Retorna array de alertas: `{ profile_name, level: "success"|"warning"|"danger", message }`
- Exibido como lista de cards com cores de status (verde neon para sucesso, vermelho para alertas)

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/hooks/useClientProfiles.ts` | Invalidação global de cache no `setActiveProfile` |
| `src/components/AppLayout.tsx` | Skeleton loading durante transição de perfil |
| `src/pages/Diagnostico.tsx` | Limpar report ao trocar perfil |
| `src/pages/LancarCampanha.tsx` | Filtrar drafts por `profile_id` |
| `src/pages/AgencyView.tsx` | Nova página — Master Dashboard |
| `src/components/AppSidebar.tsx` | Item "Visão da Agência" no topo |
| `src/App.tsx` | Rota `/agencia` |
| `supabase/functions/agency-alerts/index.ts` | Edge function — alertas IA globais |

