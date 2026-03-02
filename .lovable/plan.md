

## Diagnóstico Final + Plano: Fix Definitivo do Pipeline Meta + Publicação em Lote

### Problemas Reais Identificados (Database Evidence)

Consultei os logs reais do banco de dados e encontrei **2 falhas distintas e rastreáveis**:

**Falha 1 — AdSet (age_min > 25 com Advantage+):**
```
"Com conjuntos de anúncios que usam o público Advantage+, o controle de público de idade mínima 
não pode ser configurado para mais de 25 anos."
```
O código atual injeta `age_min` do Andromeda (ex: 30, 35) no targeting. A Meta **rejeita age_min > 25** quando `advantage_audience: 1` está ativo.

**Falha 2 — Upload de Imagem (permissão do app):**
```
"❌ Falha no Upload de Imagem: (#3) Application does not have the capability to make this API call."
```
O endpoint `POST /adimages` requer Advanced Access para `ads_management` no Facebook App. Seu app provavelmente tem Standard Access, que permite criar campanhas/adsets/ads mas **não permite upload direto de imagens via API**. Isso é uma limitação do nível de acesso do app, não do código.

**Solução:** Usar o campo `picture` (URL direta) no `link_data` ao invés de fazer upload para `/adimages`. A Meta aceita URLs públicas de imagem diretamente no creative spec — sem precisar de `image_hash`.

---

### Task 1: Fix Definitivo do AdSet (age_min)

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts` (linhas 158-171)

- Quando Advantage+ está ativo: **remover `age_min`** se > 25, ou **fixar em 18** (mínimo padrão)
- Manter `genders` e `flexible_spec` como seeds
- Já temos `targeting_automation.advantage_audience: 1` correto

### Task 2: Fix Definitivo do Ad Creative (bypass /adimages)

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts` (linhas 228-349)

- **Eliminar** a chamada a `POST /adimages` completamente
- Para imagens: usar `picture: injectedUrl` dentro de `link_data` no `object_story_spec`
- Para vídeos: manter `POST /advideos` (esse endpoint funciona com Standard Access)
- Resultado: o anúncio é criado com a imagem inline, sem precisar do `image_hash`

### Task 3: Publicação em Lote — Múltiplas Campanhas

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts`

- Aceitar um novo campo `creativeUrls: string[]` no body (além do `draftId`)
- Se `creativeUrls` tiver múltiplos itens, criar **N anúncios** dentro do mesmo AdSet (1 por URL)
- Renomear cada anúncio: `"Campanha - Anúncio 01"`, `"Campanha - Anúncio 02"`, etc.
- Retornar array de `meta_ad_ids` no response
- Limite: até 50 URLs

### Task 4: UI para Lote — Seleção Múltipla de Criativos

**Arquivo:** `src/pages/LancarCampanha.tsx`

- No grid de "Ativos Recentes", permitir **seleção múltipla** (checkbox em cada thumbnail)
- Exibir badge com contagem: "3 criativos selecionados"
- No `handlePublish`, passar o array `creativeUrls` para a edge function
- Se nenhum criativo selecionado, usar `injectedCreativeUrl` do localStorage como fallback
- Ao publicar, salvar todos os URLs selecionados no draft

### Task 5: UI para Múltiplas Campanhas Independentes

**Arquivo:** `src/pages/LancarCampanha.tsx`

- Adicionar campo "Quantidade de Campanhas" (1-5) no Step 1
- Ao publicar com N > 1, invocar a edge function N vezes em paralelo (cada uma cria campanha + adset + ads)
- Cada campanha recebe sufixo `[1/3]`, `[2/3]`, `[3/3]` no nome
- Log de publicação mostra progresso por campanha

### Task 6: Campo `creative_urls` na tabela `campaign_drafts`

**Migration SQL:**
```sql
ALTER TABLE public.campaign_drafts ADD COLUMN IF NOT EXISTS creative_urls text[] DEFAULT '{}';
```

---

### Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Editar (bypass /adimages, fix age_min, suporte a múltiplos ads) |
| `src/pages/LancarCampanha.tsx` | Editar (seleção múltipla de criativos, N campanhas) |
| Migration SQL | Novo (campo creative_urls) |

