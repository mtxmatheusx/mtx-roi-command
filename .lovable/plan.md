

## Plano: Cérebro da Empresa + Dossiê do Avatar + Injeção em Campanhas

### 1. Migration: Tabela `knowledge_base`

Nova tabela para armazenar documentos e textos do cérebro da empresa:

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `profile_id` | uuid NOT NULL | Isolamento por perfil |
| `user_id` | uuid NOT NULL | RLS |
| `doc_type` | text | 'file' ou 'text_field' |
| `field_key` | text | 'what_we_sell', 'our_story', 'main_trigger', ou null (para files) |
| `file_name` | text | Nome do arquivo original |
| `file_url` | text | URL no Storage |
| `extracted_text` | text | Texto extraído do documento ou texto digitado |
| `status` | text | 'pending', 'processed', 'error' |
| `created_at` | timestamptz | now() |

Adicionar coluna `avatar_dossier` (text, nullable) em `client_profiles` para armazenar o dossiê aprovado.

RLS: `auth.uid() = user_id` para ALL.

Storage bucket: `knowledge-docs` (privado) com RLS para upload/download pelo owner.

### 2. Edge Function: `absorb-product-context` (atualizar)

Não criar nova — reaproveitar a existente adicionando lógica para processar documentos da `knowledge_base`.

### 3. Edge Function: `digest-company-context` (nova)

- Recebe `profileId`
- Busca todos os registros de `knowledge_base` + campos de texto daquele perfil
- Busca `product_context` existente
- Envia ao Gemini com o system prompt de "Estrategista Senior (Russell Brunson + Hormozi)"
- Retorna JSON estruturado via tool calling:
  - `bleeding_pain` (Dor Sangrenta)
  - `dream_outcome` (Desejo Final)
  - `unique_mechanism` (Mecanismo Único)
  - `main_objections` (array de 3 objeções)
  - `brand_voice` (Tom de Voz)
  - `executive_summary` (Resumo Executivo)
- **Não salva automaticamente** — retorna para UI para human-in-the-loop

### 4. UI: Seção "Cérebro da Empresa" em `Configuracoes.tsx`

Nova seção entre "Contexto do Produto" e "Parâmetros de Automação":

- **Drag & Drop** para `.pdf`, `.docx`, `.txt`, `.csv` → upload para bucket `knowledge-docs` → salva referência em `knowledge_base` → dispara extração de texto via edge function
- **3 campos de texto livre:** "O que vendemos?", "Qual a nossa História/Narrativa?", "Qual o nosso Diferencial/Gatilho Principal?" → salvos em `knowledge_base` com `doc_type: 'text_field'`
- **Lista de documentos absorvidos:** Query `knowledge_base` por `profile_id`, mostra `file_name - Absorvido ✅` ou `Processando...`
- **Botão "🧠 Gerar Dossiê do Avatar"** → chama `digest-company-context`
- **Card "🎯 Dossiê do Avatar (Gerado por IA)"** com campos editáveis para cada seção do dossiê
- **Botão "✅ Salvar como Verdade Absoluta"** → salva JSON em `client_profiles.avatar_dossier`

### 5. Atualizar `ai-campaign-draft` (System Prompt)

- Passo 1 (Bloqueio): "Você é o Gestor de Tráfego Sênior EXCLUSIVO da empresa [Nome]. Esqueça qualquer outro nicho."
- Passo 2 (Injeção): Se `avatar_dossier` existir, injeta APENAS o dossiê aprovado (não o PDF inteiro). Se não existir, usa `product_context` como fallback.
- Passo 3 (Geração): "Baseado ESTRITAMENTE no Dossiê acima..."

### 6. Cache Invalidation

Adicionar `knowledge_base` ao `queryClient.invalidateQueries()` no `setActiveProfile` do `useClientProfiles.ts`.

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | Tabela `knowledge_base`, coluna `avatar_dossier`, bucket `knowledge-docs` |
| `src/pages/Configuracoes.tsx` | Seção Cérebro da Empresa + Dossiê do Avatar |
| `supabase/functions/digest-company-context/index.ts` | Nova — digestão IA do contexto |
| `supabase/functions/ai-campaign-draft/index.ts` | System prompt com bloqueio + injeção de dossiê |
| `src/hooks/useClientProfiles.ts` | Invalidar `knowledge_base` no cache |

