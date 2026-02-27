

## Plano: Fix Advantage+ Final + Upload Multimodal no Cérebro de Criativos

### Contexto
O fix do Advantage+ já está aplicado (age_max=65, targeting_automation inside targeting), mas precisa de uma limpeza extra: remover `age_max` completamente (ao invés de forçar 65) para evitar conflitos com Advantage+. A Meta prefere que não haja `age_max` quando Advantage+ está ativo. Além disso, precisamos adicionar upload de ativos no Cérebro de Criativos com indexação IA.

---

### Task 1: Fix final Advantage+ no `create-meta-campaign`

**Arquivo:** `supabase/functions/create-meta-campaign/index.ts` (linhas 158-190)

- Remover `age_max` completamente quando Advantage+ está ativo (linha 162) — não enviar o campo
- Manter `age_min` como seed signal
- Garantir que `targeting_automation` está DENTRO do `targetingObj` ANTES de construir `adSetBody` (mover linhas 188-190 para antes da linha 171)
- Remover qualquer campo legacy (`smart_audience_status`, `targeting_optimization`)
- Adicionar log de debug do payload final do targeting

### Task 2: Mensagem de status no publish log

**Arquivo:** `src/pages/LancarCampanha.tsx` (linha 286)

- Trocar `"Campanha criada com sucesso!"` por `"🚀 Campanha Destravada: Público Advantage+ configurado e limites de idade ajustados."`

### Task 3: Upload multimodal no Cérebro de Criativos

**Arquivo:** `src/pages/LancarCampanha.tsx` (após linha 696)

- Adicionar botão "📤 Subir Novo Ativo" ao lado de "Escolher Criativo com IA"
- Ao clicar, abrir um Dialog com zona de Drag & Drop (JPG, PNG, MP4, MOV)
- Upload para bucket `creative-assets` no Supabase Storage
- Após upload, invocar nova edge function `index-creative-asset` para gerar descrição IA
- Salvar na tabela `creative_assets` com descrição gerada
- Exibir grid de "Ativos Recentes" com thumbnails dentro do card do Cérebro de Criativos
- Permitir seleção manual de ativo do grid

### Task 4: Nova Edge Function `index-creative-asset`

**Arquivo:** `supabase/functions/index-creative-asset/index.ts`

- Recebe `{ assetId, profileId, fileUrl, fileType, fileName }`
- Usa Lovable AI (Gemini 2.5 Flash) para analisar a imagem/vídeo via URL
- System prompt: "Analise este ativo visual e gere uma descrição técnica rica em metadados para matching com campanhas de performance. Inclua: tipo de conteúdo, iluminação, cores, emoção, cenário, público-alvo implícito."
- Atualiza `creative_assets.description` com a descrição gerada
- Retorna a descrição

### Task 5: Upgrade do `ai-creative-brain`

**Arquivo:** `supabase/functions/ai-creative-brain/index.ts`

- Atualizar system prompt para dar peso extra a ativos com descrições ricas (indexados por IA)
- Cruzar descrições técnicas dos ativos com o Dossiê do Avatar
- Se descrição menciona elementos alinhados à copy selecionada (dor, transformação), boostar confiança

### Task 6: Config

**Arquivo:** `supabase/config.toml`

- Adicionar `[functions.index-creative-asset] verify_jwt = false`

---

### Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Editar (targeting fix) |
| `src/pages/LancarCampanha.tsx` | Editar (upload modal + grid + status msg) |
| `supabase/functions/index-creative-asset/index.ts` | Novo |
| `supabase/functions/ai-creative-brain/index.ts` | Editar |
| `supabase/config.toml` | Editar |

