

## Plano: Adicionar Page ID + Corrigir Criação de Anúncios na Meta API

### Problema
O erro mais recente no banco é: **"Selecione uma Página do Facebook para representar sua empresa"**. A Meta API exige um `page_id` no `object_story_spec` para criar anúncios. Atualmente esse campo não existe no sistema.

### Implementações

#### 1. Adicionar coluna `page_id` na tabela `client_profiles`
- Migration SQL: `ALTER TABLE client_profiles ADD COLUMN page_id text;`

#### 2. Adicionar campo "Page ID" em Configurações (`src/pages/Configuracoes.tsx`)
- Novo input no formulário para `page_id` (ex: "ID da Página do Facebook")
- Persistir junto com os outros campos no `updateProfile`

#### 3. Corrigir criação do anúncio (`supabase/functions/create-meta-campaign/index.ts`)
- Ler `page_id` do perfil do cliente
- Incluir `page_id` no `object_story_spec`:
```typescript
creative: {
  object_story_spec: {
    page_id: pageId,
    link_data: {
      message: selectedCopy?.primary_text || "...",
      link: profile?.product_urls?.[0] || "https://example.com",
      name: selectedCopy?.headline || draft.campaign_name,
      call_to_action: { type: "LEARN_MORE", value: { link: "..." } },
    },
  },
}
```
- Validar: se `page_id` não estiver configurado, retornar erro claro antes de tentar criar o anúncio
- Mapear CTAs corretamente: "Compre Agora" → `SHOP_NOW`, "Saiba Mais" → `LEARN_MORE`, "Conhecer" → `LEARN_MORE`, etc.

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `page_id` em `client_profiles` |
| `src/pages/Configuracoes.tsx` | Campo de input para Page ID |
| `src/hooks/useClientProfiles.ts` | Incluir `page_id` no update |
| `supabase/functions/create-meta-campaign/index.ts` | Injetar `page_id` no `object_story_spec` + validação |

