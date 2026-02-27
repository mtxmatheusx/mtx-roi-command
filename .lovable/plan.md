

## Plano: Fábrica de Criativos com Geração de Imagens IA

### Fase 1: Edge Function `generate-hyper-creative`

**Arquivo:** `supabase/functions/generate-hyper-creative/index.ts`

Pipeline em 3 passos:

1. **Leitura de Contexto**: `fetchMasterContext(profileId)` → avatar_dossier + product_context. Buscar `creative_assets` com maior ROAS tags do perfil.

2. **Engenharia de Prompt Visual**: Chamar `google/gemini-2.5-flash` (texto) para gerar um prompt de imagem em inglês, injetando regras de Direção de Arte:
   - Aspect ratio 4:5 (1080x1350)
   - Dark textured background, minimalist, subtle red/neon accents
   - Hyper-realistic photography, facial consistency
   - Produto físico → textura do tecido, iluminação dramática de estúdio
   - Serviço/infoproduto → figura de autoridade (Hormozi/Brunson style), dor/solução
   - Contexto do usuário (ex: "Black Friday") integrado

3. **Geração de Imagem**: Chamar `google/gemini-2.5-flash-image` com o prompt gerado + `modalities: ["image", "text"]`. Capturar base64.

4. **Upload Automático**: Salvar cada imagem no bucket `creative-assets` como `generated/{profileId}/{timestamp}.png`, inserir na tabela `creative_assets` com `source_tag = "ai-generated"`.

5. **Retorno**: Array de `{ url, file_name, asset_id }` para renderização imediata.

Recebe: `{ profileId, quantity (1-4), context (string) }`

---

### Fase 2: Config

**Arquivo:** `supabase/config.toml` — Adicionar `[functions.generate-hyper-creative] verify_jwt = false`

---

### Fase 3: UI — Refatorar `Criativos.tsx`

Layout dividido em 2 colunas dentro de um novo bloco após a Biblioteca e o Extrator:

**Coluna Esquerda — Biblioteca Vencedora (40%)**:
- Grid de criativos filtrados por `status === "winner"` (ROAS >= 3 && spend > 100) dos `displayCreatives` existentes
- Cards compactos com thumbnail, nome, ROAS badge
- Se não há winners, mostrar mensagem "Nenhum criativo vencedor identificado ainda"

**Coluna Direita — Gerador Autônomo (60%)**:
- Input: slider/select para quantidade (1-4)
- Input: campo de texto para contexto ("Coleção de Inverno", "Black Friday")
- Botão "🎨 Gerar [X] Criativos de Alta Conversão"
- Loading state com progress indicator
- Grid de resultados: cards com imagem gerada, botão "🚀 Injetar no Meta Ads" (salva o `asset_id` no state para uso no `LancarCampanha`)

**Botão "Injetar no Meta Ads"**: Armazena o `asset_id` selecionado em `localStorage` key `mtx_injected_creative_{profileId}` para ser lido pelo wizard de campanha.

---

### Fase 4: Isolamento Multi-Tenant

Já garantido pela arquitetura existente:
- `fetchMasterContext` filtra por `profileId`
- `creative_assets` tem `profile_id` + RLS por `user_id`
- O prompt visual é construído a partir do dossier específico do perfil ativo
- Nenhum dado cruza entre perfis

---

### Arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/functions/generate-hyper-creative/index.ts` | Novo | Prompt visual → geração imagem → upload bucket → insert DB |
| `supabase/config.toml` | Editar | Adicionar entry `generate-hyper-creative` |
| `src/pages/Criativos.tsx` | Editar | Layout dividido: Biblioteca Vencedora + Gerador Autônomo |

