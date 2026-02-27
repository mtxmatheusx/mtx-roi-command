

## Plano: Módulos de Auditoria Meta AI, Asset Vault com Scraper Visual, e Públicos Dinâmicos

Este é um conjunto grande de features. Vou dividir em fases implementáveis.

---

### FASE 1: Auditoria Meta AI + Scraper Visual (prioridade)

#### 1. Nova página "Auditoria Meta AI" (`src/pages/AuditoriaMeta.tsx`)
- Sub-aba no sidebar: "Auditoria Meta AI" com ícone `Shield`
- Cards de recomendações com 3 seções: o que a Meta quer, veredito do Gemini, botões de ação
- Rota `/auditoria-meta` no `App.tsx` e item no `AppSidebar.tsx`

#### 2. Edge function `meta-recommendations` 
- Fetch `GET /{act_id}/recommendations` da Meta API com o access token do perfil
- Retorna JSON cru das sugestões

#### 3. Edge function `audit-recommendation`
- Recebe a recomendação + perfil (CPA, budget, dossiê)
- Envia ao Lovable AI (Gemini) com prompt de "Auditor de Tráfego Sênior"
- Retorna veredito: `✅ APROVADO`, `⚠️ COM RESSALVAS`, ou `❌ REJEITADO`
- Inclui justificativa de 1 linha

#### 4. Scraper Visual na aba Criativos (`Criativos.tsx`)
- Nova seção "Extrator Visual Rápido" no topo com input de URL + botão "Capturar Mídias"
- Loader durante extração

#### 5. Edge function `scrape-media`
- Recebe URL, usa Firecrawl (já conectado) para scrape com formato `html`
- Parseia `<img>` e `<video>` tags, filtra por resolução (ignora ícones/banners)
- Faz download das mídias válidas e salva no bucket `creative-assets`
- Insere registros em `creative_assets` com tag `source: "scraped:URL"`
- Retorna lista de mídias salvas

#### 6. Coluna `source_tag` em `creative_assets`
- Migration: `ALTER TABLE creative_assets ADD COLUMN source_tag text DEFAULT 'uploaded';`
- Tags automáticas: `uploaded`, `scraped:https://...`

---

### FASE 2: Vision-to-Copy + Galeria no Lançar Campanha

#### 7. Galeria de ativos no Step 2 (`LancarCampanha.tsx`)
- Grid visual dos `creative_assets` do perfil para seleção com clique
- Estado `selectedAssetId` que será enviado na publicação

#### 8. Atualizar `ai-campaign-draft` para Vision-to-Copy
- Se um asset (imagem) estiver selecionado, enviar URL da imagem ao Gemini com prompt StoryBrand/Brunson
- Chain-of-Thought: análise visual → cruzamento com dossiê → geração de copy com Hook/Story/CTA

#### 9. Enviar `image_url` na criação do anúncio
- Atualizar `create-meta-campaign` para incluir `image_url` ou `picture` no `link_data` do `object_story_spec`

---

### FASE 3: Públicos Dinâmicos (Custom Audiences)

#### 10. Edge function `create-custom-audience`
- POST `/{act_id}/customaudiences` na Meta API
- Suporta: Custom Audience (pixel-based), Lookalike
- Retorna `audience_id`

#### 11. Injeção no AdSet
- Atualizar `create-meta-campaign` para aceitar `audience_id` opcional no targeting
- Injetar em `targeting.custom_audiences`

#### 12. Log visual de audiência no Step 3
- Feedback em tempo real: "⚙️ IA criando público..." → "✅ Público criado (ID: xxx)"

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | `source_tag` em `creative_assets` |
| `src/pages/AuditoriaMeta.tsx` | Nova página — dashboard de auditoria |
| `src/App.tsx` | Rota `/auditoria-meta` |
| `src/components/AppSidebar.tsx` | Item "Auditoria Meta AI" |
| `supabase/functions/meta-recommendations/index.ts` | Fetch recomendações da Meta |
| `supabase/functions/audit-recommendation/index.ts` | Gemini audita recomendação |
| `supabase/functions/scrape-media/index.ts` | Scraper visual com Firecrawl |
| `src/pages/Criativos.tsx` | Seção "Extrator Visual Rápido" + tags |
| `src/pages/LancarCampanha.tsx` | Galeria de ativos + seleção + image_url |
| `supabase/functions/create-meta-campaign/index.ts` | Injetar image_url + audience_id |
| `supabase/functions/ai-campaign-draft/index.ts` | Vision-to-Copy com imagem |
| `supabase/functions/create-custom-audience/index.ts` | Criação de públicos na Meta |

---

### Nota sobre WhatsApp
A integração WhatsApp (alerta de custo +15%) requer um webhook externo (Make/Evolution API). Será planejada separadamente após configuração do endpoint.

### Nota sobre Instagram Graph API
O fetch de posts orgânicos do Instagram requer permissões adicionais (`instagram_basic`, `instagram_manage_insights`) no token. Será adicionado como extensão futura do Cérebro de Criativos.

Recomendo implementar a **Fase 1** primeiro (Auditoria + Scraper), validar, e seguir para as Fases 2 e 3.

