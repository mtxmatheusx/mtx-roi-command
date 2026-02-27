

## Plano: Motor de Segmentação Andromeda

### 1. Atualizar Edge Function `ai-campaign-draft`

Expandir o tool schema `suggest_campaign` para incluir novo campo `andromeda_targeting`:

```json
{
  "age_min": number,
  "age_max": number, 
  "genders": [number],
  "semantic_seeds": [string] (max 3),
  "andromeda_exclusion": [string]
}
```

Adicionar instrução no system prompt após os frameworks existentes: "Traduza o Dossiê do Avatar para parâmetros Andromeda da Meta Ads..."

### 2. Atualizar tipos no frontend (`LancarCampanha.tsx`)

- Novo tipo `AndromedaTargeting` com `age_min`, `age_max`, `genders`, `semantic_seeds`, `andromeda_exclusion`
- Extender `DraftData` para incluir `andromeda_targeting`

### 3. UI: Card "🌌 Segmentação Andromeda Sugerida" (Step 2)

Novo card após "Segmentação Sugerida" mostrando:
- 🎯 Idade: [min] a [max]
- 🚻 Gênero: Feminino/Masculino/Todos
- 🌱 Sementes Semânticas: tags visuais
- 🚫 Exclusões Andromeda: lista
- Botão "Injetar no Conjunto de Anúncios" que ativa flag `useAndromeda`

### 4. Atualizar `create-meta-campaign` Edge Function

Quando `andromeda_targeting` presente no draft:
1. Resolver `semantic_seeds` via Meta `/search?type=adinterest` para obter IDs reais
2. Construir `targeting` do AdSet com `age_min`, `age_max`, `genders`, `flexible_spec: [{ interests: [IDs] }]`
3. Ativar `targeting_optimization: "expansion_all"` para Andromeda/Advantage+

### 5. Persistência

Adicionar campo `andromeda_targeting` (jsonb, nullable) à tabela `campaign_drafts` via migration.

Salvar dados Andromeda junto com o draft no `handleSaveDraft` e `handlePublish`.

### 6. Isolamento Multi-Tenant

Já garantido: `ai-campaign-draft` busca `avatar_dossier` estritamente por `profileId`. O `setActiveProfile` invalida cache de `campaign_drafts`. Nenhuma mudança extra necessária.

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | `andromeda_targeting` jsonb em `campaign_drafts` |
| `supabase/functions/ai-campaign-draft/index.ts` | Prompt Andromeda + campo no tool schema |
| `supabase/functions/create-meta-campaign/index.ts` | Resolver interests via `/search`, montar targeting, expansion |
| `src/pages/LancarCampanha.tsx` | Tipo AndromedaTargeting + card visual + botão injetar |

