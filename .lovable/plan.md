

## Plano: Visual Forge + Advantage+ Fix + Image Hash Pipeline

### 7 tarefas independentes

---

### Task 1: Fix Advantage+ targeting no `create-meta-campaign`

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts` (linhas 186-190)

- Remover `adSetBody.targeting_optimization` e `adSetBody.targeting_automation` (top-level)
- Mover para dentro de `targetingObj`: `targetingObj.targeting_automation = { advantage_audience: Number(1) }`
- Garantir integer estrito, não string

### Task 2: Image Hash upload + injected creative no `create-meta-campaign`

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts`

- Adicionar migration: coluna `injected_creative_url TEXT` na tabela `campaign_drafts`
- Entre Step 2 (AdSet) e Step 3 (Ad), verificar `draft.injected_creative_url`
- Se presente: `POST /{adAccountId}/adimages` com `{ image_url, access_token }` → capturar `image_hash`
- Usar `image_hash` no `link_data.image_hash` do `object_story_spec`
- Adicionar `degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { status: "OPT_IN" } } }` no creative

### Task 3: Nova Edge Function `generate-master-prompt`

**Arquivo:** `supabase/functions/generate-master-prompt/index.ts`

- Recebe `{ profileId, rawIdea, referenceImageUrl? }`
- `fetchMasterContext(profileId)` para dossiê do avatar
- Se `referenceImageUrl` presente: modo multimodal (envia imagem + texto ao Gemini)
- System prompt: Diretor de Arte Sênior com regras imutáveis (4:5, dark background, hyper-realistic, neon accents, cinematic lighting)
- Retorna APENAS texto do prompt em inglês, sem markdown/aspas

### Task 4: Refatorar `generate-hyper-creative`

**Arquivo:** `supabase/functions/generate-hyper-creative/index.ts`

- Aceitar `masterPrompt` como alternativa a `context`
- Aceitar `referenceImageUrl` opcional para enviar como referência visual na geração de imagem
- Se `masterPrompt` presente, pular Step 2 (prompt engineering interno) e usar direto
- Se `referenceImageUrl` presente, incluir como content multimodal na chamada de geração

### Task 5: Refatorar `CreativeFactory.tsx` → Visual Forge

**Arquivo:** `src/components/CreativeFactory.tsx`

Rebrand + fluxo de 2 etapas + drop zone:

- Título: "⚒️ Visual Forge (Diretor de Arte IA)"
- **Drop Zone**: Área drag & drop para imagem de referência (JPG/PNG/WEBP), borda `border-gray-700`, bg `bg-gray-900/30`, brilho neon ao arrastar. Upload ao bucket `creative-assets`, guarda URL no state.
- **Campo 1**: Input "Qual é a ideia da campanha?"
- **Botão 1**: "🧠 Elaborar Direção de Arte" → chama `generate-master-prompt` (com `referenceImageUrl` se existir)
- **Campo 2**: Textarea editável (`bg-gray-900`, `min-h-[200px]`), prompt mestre em inglês. Skeleton loader pulsante enquanto elabora.
- **Slider quantidade** mantido
- **Botão 2**: "🎨 Forjar Criativo (Gerar Imagem)" → envia Campo 2 como `masterPrompt` + `referenceImageUrl` para `generate-hyper-creative`
- Progress bar com "Renderizando fotorrealismo e aplicando paleta de alta conversão..."

### Task 6: Frontend `LancarCampanha.tsx` — Ler criativo injetado

**Arquivo:** `src/pages/LancarCampanha.tsx` (no `handlePublish`, linhas 217-228)

- Antes do insert, ler `localStorage` key `mtx_injected_creative_{profileId}`
- Se existir, extrair `url` e passar como `injected_creative_url` no insert do draft
- Limpar localStorage após uso

### Task 7: Config

**Arquivo:** `supabase/config.toml` — Adicionar:
```toml
[functions.generate-master-prompt]
verify_jwt = false

[functions.generate-hyper-creative]
verify_jwt = false
```

---

### Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/generate-master-prompt/index.ts` | Novo |
| `supabase/functions/generate-hyper-creative/index.ts` | Editar |
| `supabase/functions/create-meta-campaign/index.ts` | Editar |
| `src/components/CreativeFactory.tsx` | Editar (rewrite) |
| `src/pages/LancarCampanha.tsx` | Editar |
| `supabase/config.toml` | Editar |
| Migration SQL | Novo (`injected_creative_url` column) |

