

## Plan: Gestor IA — Chat Lateral + Aba Diagnóstico

This is a large request spanning 4 major systems. To deliver with quality, I'll implement it in phases. **Phase 1** covers the two most impactful features that can be built immediately with existing infrastructure.

---

### Phase 1 (this implementation)

#### 1. Edge Function: `ai-chat` — Backend for AI conversations
- New edge function `supabase/functions/ai-chat/index.ts`
- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) via `LOVABLE_API_KEY` (already configured)
- Accepts `{ messages, campaignData?, mode }` where mode is `"chat"` or `"diagnostico"`
- For `"diagnostico"` mode: injects a system prompt with Alex Hormozi/Storybrand frameworks, Meta Ads best practices, and the user's actual campaign metrics (CPA, CTR, CPM, ROI, spend, purchases)
- For `"chat"` mode: system prompt as "Gestor de Trafego IA da MTX Estrategias" with context about the user's campaigns
- Streams responses via SSE for real-time token rendering
- Handles 429/402 errors with user-friendly messages
- Update `supabase/config.toml` to register the function with `verify_jwt = false`

#### 2. Chat Lateral — "Conversar com o Gestor IA"
- New component `src/components/AIChatPanel.tsx`
- Floating button (bottom-right) that opens a slide-over panel
- Message history with user/assistant bubbles, markdown rendering via simple formatting
- Sends current campaign summary (total spend, ROI, CPA, top campaigns) as context with each request
- Streams AI responses token-by-token
- Persists conversation in component state (resets on page refresh)
- Dark mode styling consistent with existing DM Sans / neon theme

#### 3. Aba "Diagnóstico da IA" — New page `/diagnostico`
- New page `src/pages/Diagnostico.tsx`
- Sends current metrics (CPA, CTR, CPM, ROI, spend, purchases per campaign) to the `ai-chat` edge function in `"diagnostico"` mode
- Displays AI-generated diagnostic report with sections: Resumo Executivo, Alertas Imediatos, Recomendacoes de Otimizacao, Estrategia de Criativos
- "Gerar Diagnostico" button triggers the analysis
- Shows loading state during generation, renders result with markdown formatting
- Add route `/diagnostico` and sidebar nav item with Brain icon

#### 4. Sidebar + Router updates
- Add "Diagnóstico IA" nav item to `AppSidebar.tsx` (Brain icon)
- Add route in `App.tsx`
- Add `AIChatPanel` to `AppLayout.tsx` so it appears on all pages

### Files Created
| File | Purpose |
|---|---|
| `supabase/functions/ai-chat/index.ts` | AI edge function (streaming) |
| `src/components/AIChatPanel.tsx` | Floating chat panel |
| `src/pages/Diagnostico.tsx` | AI diagnostics page |

### Files Modified
| File | Change |
|---|---|
| `supabase/config.toml` | Register `ai-chat` function |
| `src/App.tsx` | Add `/diagnostico` route |
| `src/components/AppSidebar.tsx` | Add Diagnostico nav item |
| `src/components/AppLayout.tsx` | Add AIChatPanel |

### Technical Details
- AI model: `google/gemini-3-flash-preview` (fast, good reasoning, no extra API key needed)
- Streaming: SSE with line-by-line parsing, token-by-token rendering
- System prompt includes Hormozi/Storybrand frameworks for creative suggestions
- Campaign data injected as structured context (not stored in DB, sent per-request)
- No database changes needed for Phase 1

### Future Phases (separate messages)
- **Phase 2**: Monthly Review page with charts + AI analysis (cron job on day 1)
- **Phase 3**: Campaign creation via Meta API (write permissions)
- **Phase 4**: Weekly knowledge update cron + asset library analysis

