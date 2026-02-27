

## Plano: Injetar Data Atual nos Prompts da IA

### Problema
Os system prompts das edge functions `ai-campaign-draft` e `ai-chat` não informam a data atual à IA. Sem isso, a IA pode gerar datas desatualizadas (ex: "2024-03") nos nomes de campanhas e raciocínios.

### Correção

#### 1. `supabase/functions/ai-campaign-draft/index.ts`
- Mover o `SYSTEM_PROMPT` para ser gerado dinamicamente dentro do handler (ou concatenar a data no momento da chamada)
- Adicionar no início do prompt: `**Data de hoje: ${new Date().toISOString().slice(0,10)}**` (executado no servidor Deno, sempre atualizado)
- Isso garante que o nome da campanha use `2026-02` e não `2024-03`

#### 2. `supabase/functions/ai-chat/index.ts`
- Adicionar a data atual dinamicamente nos system prompts `CHAT_SYSTEM_PROMPT` e `DIAGNOSTICO_SYSTEM_PROMPT` no momento da requisição
- Concatenar antes de enviar: `systemPrompt + "\n\n**Data de hoje:** " + new Date().toISOString().slice(0,10)`

### Como funciona a renovação diária
- A data é calculada com `new Date()` no runtime Deno **a cada requisição**, então é sempre a data real do servidor — não é hardcoded. Renova automaticamente todos os dias.

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-campaign-draft/index.ts` | Injetar data atual no system prompt |
| `supabase/functions/ai-chat/index.ts` | Injetar data atual nos dois system prompts |

