

## Plano: Gemini API Key Editável + Diagnóstico de Permissões Meta + Melhoria de Erros de Publicação

### Contexto
O campo Gemini API Key já funciona corretamente — o botão "Adicionar" ativa o modo de edição e o "Salvar" persiste no banco. O fluxo é: clicar "Adicionar" → colar a chave → clicar "Salvar Configurações". Não há bug de read-only.

O erro de publicação de campanhas já foi corrigido na iteração anterior (status 200 + extração de erro detalhado). Os erros reais da Meta agora aparecem no frontend.

### Implementações

#### 1. Diagnóstico de Permissões do Token Meta (`src/pages/Configuracoes.tsx`)
- Após o "Testar Conexão" retornar sucesso, fazer uma segunda chamada para `GET /me/permissions` na edge function `meta-ads-sync` (modo `testConnection`)
- Retornar a lista de permissões concedidas no response
- Exibir badges visuais na UI:
  - `✅ ads_read` / `❌ ads_read`  
  - `✅ ads_management` / `❌ ads_management`
- Se `ads_management` estiver ausente, mostrar alerta amarelo e bloquear publicação

#### 2. Atualizar Edge Function `meta-ads-sync` para retornar permissões (`supabase/functions/meta-ads-sync/index.ts`)
- No modo `testConnection`, adicionar fetch a `GET /me/permissions?access_token=...`
- Incluir array `permissions` no response: `{ total: N, permissions: ["ads_read", "ads_management", ...] }`

#### 3. Log de Etapas na Publicação (`src/pages/LancarCampanha.tsx`)
- Mostrar um log visual com as etapas durante a publicação:
  - `✓ Token e act_ID validados`
  - `⏳ Enviando payload para /campaigns...`
  - `✓ Campanha criada: 12345`
  - etc.
- Em caso de erro, mostrar card vermelho com `error_user_title`, `error_user_msg` e `fbtrace_id` (já parcialmente implementado)

#### 4. Card de Erro Detalhado (`src/pages/LancarCampanha.tsx`)
- Atualizar o `publishResult` de erro para exibir um card estruturado com:
  - Etapa que falhou (já existe `result.step`)
  - Etapas concluídas (já existe `result.steps`)
  - Mensagem da Meta formatada
  - Sugestão de ação baseada no tipo de erro

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/meta-ads-sync/index.ts` | Retornar permissões do token no modo testConnection |
| `src/pages/Configuracoes.tsx` | Exibir badges de permissões após teste de conexão |
| `src/pages/LancarCampanha.tsx` | Log visual de etapas + card de erro detalhado |

