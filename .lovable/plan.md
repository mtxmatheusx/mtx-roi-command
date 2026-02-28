

## Plano: Fix Ad Creation + Video Upload + Page ID Validation + UGC Characters

O problema principal: a Meta rejeita o anúncio porque o `page_id` não chega, ou o upload de mídia (imagem/vídeo) falha silenciosamente. Além disso, não há suporte a vídeo no pipeline de upload para Meta.

---

### Task 1: Fix robustez do Ad Creation no `create-meta-campaign`

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts`

**Problemas identificados:**
- O upload de imagem usa `{ url: injectedUrl }` mas a Meta API espera o campo como `url` — isso pode funcionar para imagens mas precisa de logging detalhado
- Não há suporte a vídeo (`advideos` endpoint)
- Sem fallback: se não houver `injected_creative_url`, o anúncio é criado sem mídia visual — a Meta pode rejeitar

**Correções:**
1. **Detectar tipo de mídia** (imagem vs vídeo) pelo URL/extensão
2. **Upload de imagem**: `POST /{adAccountId}/adimages` com `{ url: "...", access_token }` — manter, mas adicionar log detalhado do response
3. **Upload de vídeo**: `POST /{adAccountId}/advideos` com `{ file_url: "...", name: "...", access_token }` — capturar `video_id`
4. **Construção dinâmica do creative**: Se `image_hash` → usar `link_data.image_hash`. Se `video_id` → usar `video_data` com `video_id` + `image_url` (thumbnail) dentro de `object_story_spec`
5. **Retry para vídeo**: Se ad creation falha com "video still processing", aguardar 5s e tentar novamente (1 retry)
6. **Log detalhado**: Logar o payload completo do ad body antes de enviar, e o response completo em caso de erro

### Task 2: Validação de Page ID no frontend

**Arquivo:** `src/pages/LancarCampanha.tsx`

- No Step 3 (Resumo para Aprovação), verificar se `activeProfile?.page_id` existe e não está vazio
- Se ausente: desabilitar botão "Publicar" e exibir `AlertTriangle` com "⚠️ Vincule uma Página do Facebook nas Configurações para publicar"
- Exibir o `page_id` mascarado no resumo para confirmação visual

### Task 3: Feedback de erro detalhado no publish log

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts` + `src/pages/LancarCampanha.tsx`

- Na edge function, retornar `step: "media_upload"` quando o upload de mídia falhar
- No frontend, adicionar label para o step `media_upload`: "Upload de Mídia"
- Mensagens específicas: "❌ Falha no Upload: O Facebook não aceitou o formato do arquivo." ou "❌ Falha de Vínculo: Página não autorizada."

### Task 4: Tabela `ugc_characters` + Migration

**Migration SQL:**
```sql
CREATE TABLE public.ugc_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID,
  name TEXT NOT NULL,
  fixed_description TEXT NOT NULL DEFAULT '',
  image_references TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ugc characters" ON public.ugc_characters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ugc_characters_updated_at BEFORE UPDATE ON public.ugc_characters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Task 5: Página "Personagens UGC" — sidebar + UI

**Arquivos:** `src/pages/PersonagensUGC.tsx` (novo), `src/components/AppSidebar.tsx`, `src/App.tsx`

- Nova rota `/personagens-ugc` com link "👥 Personagens UGC" na sidebar
- Grid de cards com nome, descrição curta, preview de referências
- Modal de criação: campos Nome, Galeria de Referência (upload múltiplo de fotos), Dossiê Físico (textarea)
- Upload para bucket `creative-assets`, salvar URLs no array `image_references`
- Delete: remover da tabela + remover arquivos do Storage

### Task 6: Vínculo com Visual Forge

**Arquivo:** `src/components/CreativeFactory.tsx`

- Dropdown "👤 Selecionar Personagem UGC" — lista personagens do perfil ativo
- Quando selecionado: concatenar `fixed_description` ao início do prompt mestre
- Enviar `image_references` como `referenceImageUrl` (primeira imagem) para `generate-hyper-creative`
- Badge "Modo Consistência Ativado" quando um personagem está selecionado

---

### Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Editar (video upload + logging + retry) |
| `src/pages/LancarCampanha.tsx` | Editar (page_id validation + error labels) |
| `src/pages/PersonagensUGC.tsx` | Novo |
| `src/components/AppSidebar.tsx` | Editar (novo link) |
| `src/App.tsx` | Editar (nova rota) |
| `src/components/CreativeFactory.tsx` | Editar (dropdown UGC) |
| Migration SQL | Novo (tabela `ugc_characters`) |

