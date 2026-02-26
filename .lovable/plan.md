

## Plan: Página de Configurações de API + Preparação para Integração Meta Ads

### Contexto
O projeto usa dados mock. Para conectar à Meta Ads API real, precisamos de backend (Lovable Cloud) para armazenar o token com segurança e fazer chamadas à API. A interface pode ser criada agora.

### Passo 1: Criar página de Configurações (`src/pages/Configuracoes.tsx`)
- Formulário com campos mascarados para:
  - Meta Access Token (input type password, com botão show/hide)
  - Ad Account ID (com prefixo `act_`)
  - Pixel ID (opcional)
- Campos de configuração de automação:
  - CPA Meta (R$)
  - Ticket Médio (R$)
  - Limite de escala automática (%)
- Botão "Salvar Configurações" (desabilitado com mensagem informando que Lovable Cloud é necessário)
- Aviso visual de que o backend precisa ser ativado para salvar de forma segura

### Passo 2: Adicionar rota `/configuracoes` em `src/App.tsx`

### Passo 3: Atualizar navegação em `src/components/AppSidebar.tsx`
- Transformar o botão "Configurações" em um NavLink funcional para `/configuracoes`

### Passo 4 (Futuro - requer Lovable Cloud):
- Criar Edge Function `meta-ads-sync` para chamadas à Marketing API
- Armazenar token como secret seguro
- Implementar regras de automação server-side

### Nota técnica
- O token NÃO será armazenado no código-fonte
- A interface mostrará claramente que o Cloud precisa ser ativado
- Validação de input com zod para os campos de configuração

