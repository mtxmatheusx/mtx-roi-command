

## Plano: Active Profile Header, Kill Switch, Auto-Guardian, Auto-Scale, e Fábrica de VSL

Este é um conjunto grande. Divido em 4 fases implementáveis.

---

### FASE 1: Active Profile Header + Confirmação de Publicação + Trava de Segurança

#### 1. Componente `ActiveProfileHeader` (novo)
- Dropdown estilizado dark mode no topo de cada aba mostrando `🟢 Ativo: {nome}` com ícone de perfil
- Trocar perfil aciona `setActiveProfile()` (já invalida caches globalmente)
- Se nenhum perfil selecionado, exibe overlay bloqueante: "⚠️ Selecione um cliente"

#### 2. Integrar em todas as páginas
- `Index.tsx`, `LancarCampanha.tsx`, `Criativos.tsx`, `Diagnostico.tsx`, `Simulador.tsx`, `Campanhas.tsx`, `AuditoriaMeta.tsx` — inserir `<ActiveProfileHeader />` após o título

#### 3. Modal de confirmação pré-publicação (`LancarCampanha.tsx`)
- Antes de chamar `handlePublish`, exibir `AlertDialog` com resumo: Cliente, act_ID, Orçamento, Copy selecionada
- Botões: [Confirmar e Subir] / [Cancelar]

#### 4. Bloqueio visual sem perfil (`LancarCampanha.tsx`)
- Se `!activeProfile`, desabilitar formulário inteiro e exibir overlay com mensagem

---

### FASE 2: Kill Switch (Pausar Operação Global)

#### 5. Botão "Kill Switch" no `ActiveProfileHeader`
- Botão vermelho `🔴 Pausar Operação` visível apenas se houver campanhas ativas
- Modal de confirmação agressivo: exige digitar "PAUSAR" para habilitar execução

#### 6. Edge function `kill-switch` (nova)
- Recebe `profileId`
- Busca `client_profiles` para obter `ad_account_id` e `meta_access_token`
- Lista campanhas ativas via Meta API `GET /{act_id}/campaigns?effective_status=['ACTIVE']`
- Batch update `status: PAUSED` em todas
- Salva log em tabela `emergency_logs` (nova migration)

#### 7. Tabela `emergency_logs` (migration)
- Colunas: `id`, `profile_id`, `user_id`, `action_type` (kill_switch/guardian/auto_scale), `details` (jsonb), `created_at`

---

### FASE 3: Auto-Guardian (CPA) + Auto-Scale (ROAS)

#### 8. Novos campos em `client_profiles` (migration)
- `cpa_max_toleravel` numeric DEFAULT 0 (0 = desativado)
- `roas_min_escala` numeric DEFAULT 0
- `teto_diario_escala` numeric DEFAULT 0

#### 9. Inputs na aba Configurações
- Abaixo de "Parâmetros de Automação": `CPA Máximo Tolerável (R$)`, `ROAS Mínimo para Escala`, `Teto Máximo Diário (R$)`

#### 10. Edge function `auto-guardian` (nova)
- Para cada perfil com `cpa_max_toleravel > 0`:
  - Fetch campanhas ativas e seus CPAs via Meta API
  - Se CPA real > cpa_max_toleravel × 1.15 nas últimas 24h → pausa campanha via Meta API
  - Salva em `emergency_logs` com `action_type: 'guardian'`

#### 11. Edge function `auto-scale` (nova)
- Para cada perfil com `roas_min_escala > 0`:
  - Fetch AdSets ativos e ROAS das últimas 48h
  - Se ROAS > limite E >= 3 compras E CTR não caindo E frequência < 2.5:
    - Calcula +20% no budget, valida contra `teto_diario_escala`
    - POST para Meta API atualizando `daily_budget` do AdSet
  - Salva em `emergency_logs` com `action_type: 'auto_scale'`

#### 12. Cron jobs (SQL insert, não migration)
- `auto-guardian` a cada 2h
- `auto-scale` a cada 4h

---

### FASE 4: Fábrica de VSL & Copy

#### 13. Tabela `vsl_scripts` (migration)
- `id`, `profile_id`, `user_id`, `angle`, `duration`, `tone`, `script_content` (text/markdown), `created_at`

#### 14. Sub-aba na página Diagnóstico IA (`Diagnostico.tsx`)
- Tabs: "Diagnóstico" | "🎬 Fábrica de VSL & Copy"
- 3 inputs: Ângulo da Oferta, Tempo Desejado, Tom de Voz
- Botão "Gerar Script de Alta Conversão"

#### 15. Edge function `generate-vsl` (nova)
- Recebe `profileId`, `angle`, `duration`, `tone`
- Busca `product_context` e `creative_assets` do perfil
- Chain-of-Thought Storybrand + Hook-Story-Offer (Hormozi)
- Output: tabela markdown 2 colunas (🎥 VISUAL / 🎙️ ÁUDIO)
- Se assets existem no Storage, referencia nomes na coluna VISUAL
- Salva em `vsl_scripts`
- Retorna via streaming SSE

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/ActiveProfileHeader.tsx` | Novo — dropdown + kill switch |
| `src/pages/Index.tsx` | Integrar header |
| `src/pages/LancarCampanha.tsx` | Header + modal confirmação + bloqueio sem perfil |
| `src/pages/Criativos.tsx` | Integrar header |
| `src/pages/Diagnostico.tsx` | Header + tabs VSL |
| `src/pages/Simulador.tsx` | Integrar header |
| `src/pages/Campanhas.tsx` | Integrar header |
| `src/pages/AuditoriaMeta.tsx` | Integrar header |
| `src/pages/Configuracoes.tsx` | 3 novos inputs (CPA max, ROAS min, Teto diário) |
| Migration SQL | `emergency_logs`, `vsl_scripts`, 3 colunas em `client_profiles` |
| `supabase/functions/kill-switch/index.ts` | Pausa em massa via Meta API |
| `supabase/functions/auto-guardian/index.ts` | Cron CPA watchdog |
| `supabase/functions/auto-scale/index.ts` | Cron ROAS scaler |
| `supabase/functions/generate-vsl/index.ts` | Script VSL com Gemini |

### Nota sobre WhatsApp
Os relatórios de sinistro (Kill Switch, Guardian, Auto-Scale) via WhatsApp requerem webhook externo (Make/Evolution API). Os templates de mensagem estão definidos — serão ativados após configuração do endpoint webhook.

Recomendo implementar **Fase 1 + 2** primeiro (header + kill switch), validar, e seguir com Fases 3 e 4.

