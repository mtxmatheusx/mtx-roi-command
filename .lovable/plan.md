

## Plano: Middleware Global de IA (`fetch_master_context`) + Auditoria de Sistema

Este plano é grande e será dividido em fases claras.

---

### Fase 1: Criar o Middleware `fetch_master_context`

**Arquivo:** `supabase/functions/_shared/fetch_master_context.ts`

Criar um módulo compartilhado (importável por todas as edge functions) com a função:

```typescript
export async function fetchMasterContext(profileId: string, supabaseClient, metaAccessToken?: string)
```

**Lógica:**
1. `Promise.all` com duas cargas:
   - **Carga 1 (Supabase):** `client_profiles` (name, avatar_dossier, product_context, cpa_meta, ticket_medio, limite_escala, budget_maximo, budget_frequency, cpa_max_toleravel, roas_min_escala, teto_diario_escala)
   - **Carga 2 (Meta API):** Fetch `/{act_id}/insights?date_preset=last_7d&fields=spend,actions,action_values,purchase_roas&level=account` para obter gasto total, CPA médio, ROAS médio dos últimos 7 dias
2. Retorna um objeto `{ profile, metaMetrics, systemPromptBlock }` onde `systemPromptBlock` é o bloco de texto formatado para injeção no system prompt
3. **Anti-alucinação:** Se `avatar_dossier` estiver vazio E `product_context` estiver vazio, retorna `{ error: "missing_dossier" }`. Se Meta API falhar, retorna `{ error: "meta_api_failed", metaError: "..." }`

**Bloco de system prompt gerado:**
```
🛑 DIRETRIZ MESTRA: Você é o Estrategista Sênior da MTX...
[JSON Carga 1]
[JSON Carga 2]
```

---

### Fase 2: Integrar o Middleware em 5 Edge Functions de IA

Cada function que chama o Lovable AI Gateway será atualizada para:
1. Importar `fetchMasterContext` do módulo compartilhado
2. Chamar antes de montar o prompt
3. Se retornar erro, abortar com resposta clara (HTTP 200 com `{ error, blocked: true }`)
4. Concatenar `systemPromptBlock` no início do system prompt

| Edge Function | Mudança |
|---|---|
| `ai-campaign-draft` | Substituir fetch manual do profile por `fetchMasterContext`. Injetar bloco no prompt |
| `ai-chat` | Receber `profileId` do frontend, chamar middleware, injetar contexto |
| `generate-vsl` | Substituir fetch manual por middleware |
| `audit-recommendation` | Receber `profileId`, chamar middleware, injetar dossiê real |
| `ai-creative-brain` | Substituir fetch manual por middleware |
| `agency-alerts` | Manter sem middleware (opera sobre múltiplos perfis agregados, não faz chamada AI per-profile-context) |
| `digest-company-context` | Manter sem middleware (é quem GERA o dossiê, não consome) |

---

### Fase 3: Frontend - Anti-alucinação (Toast Vermelho)

Atualizar os componentes que chamam edge functions de IA para tratar o novo campo `blocked: true`:

| Página | Mudança |
|---|---|
| `LancarCampanha.tsx` | No `handleGenerateAI`, verificar `data.blocked` e exibir toast destrutivo |
| `Diagnostico.tsx` | Enviar `profileId` no body para `ai-chat`. Tratar bloqueio |
| `AuditoriaMeta.tsx` | Enviar `profileId` no `audit-recommendation`. Tratar bloqueio |
| `Criativos.tsx` | Se chama `ai-creative-brain`, tratar bloqueio |

Toast padrão: `"⚠️ IA Bloqueada: Faltam dados no Dossiê ou falha de conexão com a Meta Ads. Preencha as configurações do perfil antes de usar a inteligência."`

---

### Fase 4: Auditoria Multi-Tenant e Hardening

#### 4a. Varredura de `profileId` nulo
Revisar todas as chamadas frontend → edge functions. Garantir que NENHUMA requisição é disparada sem `activeProfile?.id` validado. Adicionar early return com toast se `!activeProfile`.

Páginas a auditar: `Diagnostico.tsx` (atualmente NÃO envia profileId para ai-chat), `AuditoriaMeta.tsx`, `LancarCampanha.tsx`, `AgencyView.tsx`.

#### 4b. Profile switch isolation
Já implementado via `setActiveProfile` que invalida caches + `ProfileTransitionGuard`. Confirmar que `ai-chat` no `Diagnostico.tsx` limpa o relatório ao trocar perfil (já faz via `prevProfileRef`).

#### 4c. Tratamento de exceções
Revisar todos os `catch` blocks nas edge functions. Garantir que NENHUM retorna apenas "Internal Server Error" sem detalhes. Atual estado: todos já retornam `e.message` — OK.

#### 4d. Storage bucket
O bucket é `creative-assets` (público) e `knowledge-docs` (privado). Não existe `mtx_assets` — sem ação necessária.

---

### Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/functions/_shared/fetch_master_context.ts` | Novo | Middleware central |
| `supabase/functions/ai-campaign-draft/index.ts` | Editar | Integrar middleware |
| `supabase/functions/ai-chat/index.ts` | Editar | Receber profileId + integrar middleware |
| `supabase/functions/generate-vsl/index.ts` | Editar | Integrar middleware |
| `supabase/functions/audit-recommendation/index.ts` | Editar | Receber profileId + integrar middleware |
| `supabase/functions/ai-creative-brain/index.ts` | Editar | Integrar middleware |
| `src/pages/Diagnostico.tsx` | Editar | Enviar profileId, tratar bloqueio |
| `src/pages/LancarCampanha.tsx` | Editar | Tratar bloqueio |
| `src/pages/AuditoriaMeta.tsx` | Editar | Enviar profileId na auditoria, tratar bloqueio |

---

### Nota sobre Dry-Run
O script de simulação de fluxo seco (dry-run) será implementado como uma edge function `dry-run-validation` que executa os passos 1-4 sem POST real para a Meta, retornando um relatório de validação. Será invocável via botão oculto no painel de configurações (visível apenas em modo dev).

