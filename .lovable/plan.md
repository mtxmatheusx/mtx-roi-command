

## Plan: Autenticação + Lovable Cloud + Edge Function Meta Ads

### Pre-requisito: Ativar Lovable Cloud
Antes de implementar, você precisa ativar o **Lovable Cloud** clicando na aba "Cloud" no painel superior do editor. Isso habilita banco de dados, autenticação e Edge Functions.

### Nota de Segurança
A senha compartilhada no chat **não será hardcoded** no código. Usaremos Supabase Auth — você criará sua conta (mtxagenciacriativa@gmail.com) pela tela de signup ou diretamente no painel do Cloud.

---

### Passo 1: Criar tela de Login (`src/pages/Auth.tsx`)
- Card centralizado com fundo escuro, logo "MTX" em destaque
- Inputs de email e senha com estilo neon (bordas vermelhas)
- Botão "Entrar" preto com hover vermelho neon
- Link "Esqueci minha senha" que dispara reset via Supabase Auth
- Criar também `/reset-password` page para completar o fluxo

### Passo 2: Criar hook de autenticação (`src/hooks/useAuth.tsx`)
- Context provider com `onAuthStateChange` + `getSession`
- Expor `user`, `signIn`, `signOut`, `loading`

### Passo 3: Proteger rotas (`src/components/ProtectedRoute.tsx`)
- Wrapper que redireciona para `/auth` se não autenticado
- Envolver todas as rotas (/, /campanhas, /simulador, /criativos, /configuracoes) com este componente

### Passo 4: Atualizar `App.tsx`
- Adicionar rotas `/auth` e `/reset-password` como públicas
- Envolver rotas existentes com `ProtectedRoute`
- Adicionar `AuthProvider` no tree

### Passo 5: Botão de Logout no sidebar
- Adicionar botão "Sair" no `AppSidebar.tsx`

### Passo 6: Edge Function `meta-ads-sync`
- Criar `supabase/functions/meta-ads-sync/index.ts`
- Lê o secret `META_ACCESS_TOKEN` do ambiente
- Chama Meta Marketing API (`/act_{id}/insights`) com campos: spend, cpm, ctr, cpc, actions
- Retorna dados processados (CPA, ROAS, ATC, IC, compras, taxa de conversão)
- CORS headers incluídos

### Passo 7: Atualizar página de Configurações
- Conectar botão "Salvar" para armazenar token via Edge Function
- Remover alerta de "Cloud necessário" após ativação

