

## Plano: Edge Function `daily-closing` (Fechamento Diário Completo + Webhook n8n)

### Fase 1: Nova Edge Function `daily-closing`

**Arquivo:** `supabase/functions/daily-closing/index.ts`

Recebe `{ profileId }`. Lógica sequencial:

1. **Buscar contexto** via `fetchMasterContext(profileId)` — obtém perfil + métricas Meta 7d
2. **Buscar métricas detalhadas do dia** — `meta-ads-sync` style fetch com `date_preset=today` no `ad_account_id` do perfil (spend, purchases, ROAS, CPA, top campaigns)
3. **Gerar Resumo Executivo via IA** — Chamada não-streaming ao Lovable AI Gateway (`google/gemini-2.5-flash`) com tool calling para extrair JSON estruturado:
   ```json
   {
     "resumo": "Texto do resumo executivo...",
     "destaques": ["ponto 1", "ponto 2"],
     "alertas": ["alerta 1"]
   }
   ```
4. **Gerar HTML do relatório** — Template HTML inline (dark mode, DM Sans) com: header com nome do perfil + data, KPIs em cards (Spend, CPA, ROAS, Purchases), tabela de campanhas, resumo executivo da IA
5. **Converter HTML para PDF** — Usar o serviço gratuito `https://pdf.lovable.dev` ou alternativa via `jspdf` no Deno. **Decisão pragmática:** como Deno não tem puppeteer, gerar o relatório como **HTML salvo como .html** no bucket (renderizável pelo n8n/WhatsApp como link), OU usar uma API externa de HTML→PDF
6. **Upload ao bucket** — Salvar no bucket `creative-assets` (público) com path `reports/{profileId}/{date}.html`
7. **Disparar Webhook n8n** — `POST https://nervousanaconda-n8n.cloudfy.live/webhook/mtx-fechamento-diario` com `{ mediaUrl, caption }` dentro de try/catch isolado

### Fase 2: Config

**Arquivo:** `supabase/config.toml` — Adicionar `[functions.daily-closing] verify_jwt = false`

### Decisão sobre PDF

Como edge functions Deno não suportam puppeteer/chromium para renderização HTML→PDF nativa, proponho duas alternativas:

- **Opção A (Recomendada):** Gerar o relatório como arquivo `.html` público no bucket. O link é enviado no webhook e o n8n/WhatsApp pode renderizar como preview de link.
- **Opção B:** Usar uma API externa de conversão HTML→PDF (ex: `html2pdf.app` ou similar). Requer API key adicional.

Vou seguir com **Opção A** (HTML público no bucket) por ser zero-dependência.

### Arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/functions/daily-closing/index.ts` | Novo | Função completa: métricas → IA → HTML → upload → webhook |
| `supabase/config.toml` | Editar | Adicionar entry `daily-closing` |

