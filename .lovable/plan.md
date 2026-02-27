

## Análise do Estado Atual

Após revisão do código:

1. **Page ID** — Já implementado. O campo existe em Configurações (linha 311-315), persiste no banco, e a edge function `create-meta-campaign` já valida e injeta o `page_id` no `object_story_spec` (linhas 189-216). Basta preencher o campo e salvar.

2. **Gemini API Key** — Já funcional. O campo existe (linhas 344-382), com botão "Adicionar/Alterar", persiste via `updateProfile` com `gemini_api_key`. Clique em "Adicionar", cole a chave, e clique "Salvar Configurações".

3. **Criação de Anúncios** — Já implementada. O fluxo completo Campaign → AdSet → Ad está na edge function com copy, CTA mapping, e link do produto.

---

## Plano: Módulo "Cérebro de Criativos"

Nova feature que usa IA para analisar criativos e recomendar o melhor para cada campanha.

### 1. Nova edge function `ai-creative-brain/index.ts`

Recebe o `profileId` e contexto da campanha, consulta múltiplas fontes e retorna recomendação:

- **Supabase Storage**: Lista `creative_assets` do perfil com descrições
- **Contexto do Produto**: Lê `product_context` do perfil
- **Performance histórica**: Consulta `campaign_drafts` publicados para cruzar dados
- Envia tudo ao Lovable AI (Gemini) com prompt de "Diretor de Arte Sênior"
- Retorna: criativo recomendado + justificativa + score de confiança

### 2. Integração na página Lançar Campanha (`LancarCampanha.tsx`)

- No Step 2 (revisão do draft), adicionar botão "🧠 Escolher Criativo com IA"
- Chama `ai-creative-brain` e exibe o resultado: thumbnail do criativo recomendado, justificativa da IA, e opção de trocar

### 3. Dashboard de Criativos (`Criativos.tsx`)

- Substituir placeholders cinzas por thumbnails reais dos `creative_assets` (URL do Storage)
- Adicionar badge "🧠 Recomendado pela IA" nos criativos selecionados pelo módulo
- Filtro de datas passa contexto temporal para a IA: "Baseado nos últimos X dias"

### 4. Tooltip no Page ID

Adicionar tooltip explicativo no campo Page ID em Configurações: "Obrigatório para vincular anúncios ao perfil do Instagram e Página do Facebook."

### Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-creative-brain/index.ts` | Nova edge function — motor de decisão de criativos |
| `src/pages/LancarCampanha.tsx` | Botão "Escolher Criativo com IA" no Step 2 |
| `src/pages/Criativos.tsx` | Thumbnails reais + badge IA + contexto temporal |
| `src/pages/Configuracoes.tsx` | Tooltip no campo Page ID |

