

## Plano: Fix Andromeda + Rollback + Limpeza + Clone & Scale

### Fase 1: Fix do Payload Andromeda + Auto-Rollback (`create-meta-campaign`)

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts`

1. **Injetar `targeting_automation`** no payload do AdSet quando Andromeda estiver ativo:
   ```json
   "targeting_automation": { "advantage_audience": 1 }
   ```
   Colocar dentro de `adSetBody` ao lado de `targeting_optimization`.

2. **Rollback automático** — Se o Step 2 (AdSet) ou Step 3 (Ad) falhar, fazer `DELETE /{metaCampaignId}?access_token=...` para apagar a campanha órfã. Atualizar o `error_message` para incluir `"Campanha parcial apagada."`.

3. **Revalidação**: Confirmar que `is_adset_budget_sharing_enabled: false` (linha 117) e `page_id` (linha 243) continuam injetados — já estão corretos.

---

### Fase 2: Edge Function `delete-meta-campaign` (Nova)

**Arquivo:** `supabase/functions/delete-meta-campaign/index.ts`

Recebe `{ draftId }`. Lógica:
1. Buscar draft do Supabase (validar `user_id`)
2. Se `meta_campaign_id` presente, fazer `DELETE /{meta_campaign_id}?access_token=...` na Meta API
3. Deletar registro do `campaign_drafts` no Supabase
4. Retornar sucesso ou erro detalhado

---

### Fase 3: Edge Function `clone-scale-campaign` (Nova)

**Arquivo:** `supabase/functions/clone-scale-campaign/index.ts`

Recebe `{ draftId }`. Lógica:
1. Buscar draft + profile (validar `user_id`, status `published`)
2. Ler campanha original via `GET /{meta_campaign_id}?fields=name,objective,status`
3. Ler AdSet via `GET /{meta_adset_id}?fields=name,daily_budget,targeting,optimization_goal,billing_event,bid_strategy,promoted_object`
4. Ler Ad via `GET /{meta_ad_id}?fields=name,creative`
5. Recriar campanha com nome `[SCALED 🚀] - {nome_original}`
6. Recriar AdSet com `daily_budget * 1.20`
7. Recriar Ad com mesmo creative
8. Salvar novo registro em `campaign_drafts` com status `published` e IDs da Meta

---

### Fase 4: Frontend (`LancarCampanha.tsx`)

#### 4a. Botão de Limpeza (Lixeira) no Histórico
- Adicionar coluna "Ações" na tabela de histórico
- Para drafts com status `failed`: ícone `Trash2` com hover vermelho
- Ao clicar: abrir `AlertDialog` de confirmação com ID da campanha
- Ao confirmar: chamar `delete-meta-campaign`, mostrar spinner, remover linha reativamente, toast verde

#### 4b. Botão Clone & Scale no Histórico
- Para drafts com status `published`: ícone `Copy` em verde neon
- Ao clicar: abrir `AlertDialog` com nome, orçamento atual e projetado (+20%)
- Ao confirmar: chamar `clone-scale-campaign`, mostrar spinner, adicionar nova linha reativamente, toast verde

#### 4c. Atualizar DraftRecord
- Adicionar `meta_adset_id` e `meta_ad_id` ao tipo para suportar clone

---

### Arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Editar | `targeting_automation` + rollback automático |
| `supabase/functions/delete-meta-campaign/index.ts` | Novo | Deleção dupla Meta + Supabase |
| `supabase/functions/clone-scale-campaign/index.ts` | Novo | Leitura + duplicação + escala +20% |
| `src/pages/LancarCampanha.tsx` | Editar | Coluna Ações com Lixeira + Clone, modais, feedback |

