

## Plano: Fix `is_adset_budget_sharing_enabled` + Melhorias

### 1. Fix do parâmetro na criação de campanha

**Arquivo: `supabase/functions/create-meta-campaign/index.ts`**

Na criação da campanha (Step 1), adicionar `is_adset_budget_sharing_enabled: false` ao body do POST para `/campaigns`. Isso informa à Meta que o orçamento será definido no nível do AdSet, não da campanha — resolvendo o erro reportado.

```typescript
body: JSON.stringify({
  name: draft.campaign_name,
  objective: draft.objective,
  status: "PAUSED",
  special_ad_categories: [],
  is_adset_budget_sharing_enabled: false, // ← NOVO
  access_token: accessToken,
}),
```

### 2. Gemini API Key — já funciona

O campo já é editável: clicar "Adicionar" → colar a chave → "Salvar Configurações". Não há bug. O fluxo atual persiste no banco corretamente.

### 3. Thumbnails de criativos — já implementado

A edge function `meta-ads-sync` já busca `creative{thumbnail_url,image_url}` e o frontend já renderiza `<img>` quando `thumbnailUrl` existe. Se as thumbnails não aparecem, é porque o token pode não ter permissão ou os criativos não têm imagens associadas na Meta.

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Adicionar `is_adset_budget_sharing_enabled: false` no payload de criação da campanha |

