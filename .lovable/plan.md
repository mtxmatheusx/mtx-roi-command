

## Plano: VSL JSON + Notion Board + Script Vault + i18n

Este plano cobre as 3 solicitações: reestruturação do VSL para JSON, Script Vault com auto-save, e internacionalização.

---

### Fase 1: DB Migration - Adicionar colunas ao `vsl_scripts`

Adicionar `title` (text, default '') e `content_json` (jsonb, nullable) à tabela existente `vsl_scripts`.

---

### Fase 2: Edge Function `generate-vsl` - Output JSON

**Arquivo:** `supabase/functions/generate-vsl/index.ts`

- Substituir as regras de formato Markdown por instrução JSON estrita:
  ```
  Retorne EXCLUSIVAMENTE um JSON: { "titulo": "...", "cenas": [{ "tempo": "0-5s", "visual": "...", "audio": "..." }] }
  ```
- Desabilitar streaming (não faz sentido para JSON) — usar resposta não-streaming para garantir JSON válido
- Salvar no DB com `title` = titulo do JSON e `content_json` = JSON completo, além do `script_content` como fallback texto

**Decisão de design:** Manter streaming mas acumular o JSON completo. Após stream completo, parsear o JSON e salvar `content_json` + `title`. O frontend parseia o JSON final após streaming terminar.

---

### Fase 3: Componente `VSLScriptBoard`

**Arquivo novo:** `src/components/VSLScriptBoard.tsx`

- Recebe `{ cenas: Array<{tempo, visual, audio}>, titulo: string }` como props
- Renderiza lista vertical de cards de cena:
  - Badge `tempo` no topo
  - Grid 2 colunas: VISUAL (bg mais escuro, cinza claro) | AUDIO (branco, fonte maior)
  - `whitespace-pre-wrap` para quebras de linha
- Botões de ação no topo:
  - "Copiar Roteiro Completo" — clipboard API, formato `[tempo] VISUAL: ... | AUDIO: ...`
  - "Baixar como TXT" — gera blob e download
- Animação fade-in nos cards com framer-motion

---

### Fase 4: Script Vault (Barra Lateral)

**Arquivo:** `src/pages/Diagnostico.tsx` (aba VSL)

- Layout grid 2 colunas na aba VSL: sidebar 25% + área principal 75%
- Sidebar "Banco de Roteiros":
  - Fetch `vsl_scripts` filtrado por `profile_id` com React Query
  - Lista rolável com cards compactos (título + data)
  - Clique carrega `content_json` diretamente no `VSLScriptBoard` (zero API call)
  - Hover mostra ícone lixeira vermelha para deletar
- Auto-save: após streaming completar e JSON ser parseado, INSERT automático + toast "Roteiro salvo no cofre" + invalidate query
- Estado `selectedVaultId` para highlight do item selecionado

---

### Fase 5: i18n com `react-i18next`

**Instalar:** `react-i18next`, `i18next`

**Arquivos novos:**
- `src/i18n/index.ts` — config i18next com `lng` do localStorage, fallback `pt-BR`
- `src/i18n/locales/pt-BR.json` — dicionário PT
- `src/i18n/locales/en-US.json` — dicionário EN

**Cobertura inicial (navegação + botões principais):**
- `AppSidebar.tsx` — labels do menu
- Botões: "Publicar Campanha", "Sugestão da IA", "Kill Switch", "Gerar Diagnóstico", "Gerar Script"
- Cabeçalhos de tabelas

**Seletor de idioma:**
- Novo componente `LanguageSelector.tsx` — dropdown `PT ▾` / `EN ▾`, estilo dark mode
- Inserido no `AppLayout.tsx` como header fixo no canto direito

**Isolamento:** O idioma da UI NÃO afeta os prompts da IA. Os prompts continuam em PT-BR, ditados pelo dossiê do perfil.

---

### Arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| Migration SQL | DB | Adicionar `title`, `content_json` ao `vsl_scripts` |
| `supabase/functions/generate-vsl/index.ts` | Editar | Prompt JSON, salvar `content_json` + `title` |
| `src/components/VSLScriptBoard.tsx` | Novo | Cards Notion-style para cenas |
| `src/components/LanguageSelector.tsx` | Novo | Dropdown PT/EN |
| `src/pages/Diagnostico.tsx` | Editar | Grid layout, vault sidebar, auto-save, usar VSLScriptBoard |
| `src/i18n/index.ts` | Novo | Config i18next |
| `src/i18n/locales/pt-BR.json` | Novo | Dicionário PT |
| `src/i18n/locales/en-US.json` | Novo | Dicionário EN |
| `src/components/AppSidebar.tsx` | Editar | Traduzir labels |
| `src/components/AppLayout.tsx` | Editar | Inserir LanguageSelector |
| `src/main.tsx` | Editar | Importar i18n config |

