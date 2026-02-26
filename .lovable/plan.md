

## Plano: Persistencia em Banco + Sistema Multiperfis de Clientes

### 1. Criar tabela `client_profiles` (migração SQL)

```sql
CREATE TABLE public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ad_account_id TEXT NOT NULL DEFAULT 'act_',
  pixel_id TEXT DEFAULT '',
  cpa_meta NUMERIC NOT NULL DEFAULT 45,
  ticket_medio NUMERIC NOT NULL DEFAULT 697,
  limite_escala NUMERIC NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Somente o dono pode CRUD nos seus perfis
CREATE POLICY "Users manage own profiles" ON public.client_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2. Criar hook `useClientProfiles` (`src/hooks/useClientProfiles.ts`)
- CRUD completo via Supabase SDK (`client_profiles` table)
- `activeProfile`: perfil com `is_active = true`
- `setActiveProfile(id)`: desativa todos, ativa o selecionado
- `createProfile`, `updateProfile`, `deleteProfile`
- Retornar `adAccountId`, `cpaMeta`, `ticketMedio`, `limiteEscala` do perfil ativo

### 3. Criar componente `ProfileSelector` (`src/components/ProfileSelector.tsx`)
- Dropdown elegante no topo do sidebar (abaixo do logo)
- Mostra nome do cliente ativo + badge com ROAS atual
- Lista todos os perfis do usuario com indicador visual do ativo
- Botao "Adicionar Novo Perfil" abre dialog com formulario
- Estilo: dark, bordas zinc-800, DM Sans

### 4. Atualizar `useMetaAds.ts`
- Remover `getConfig()` do localStorage
- Receber `adAccountId`, `cpaMeta`, `ticketMedio` como parametros (vindos do perfil ativo)
- Hook continua funcionando igual, so muda a fonte dos dados de config

### 5. Atualizar `Configuracoes.tsx`
- Carregar dados do perfil ativo do banco ao montar
- Salvar no banco via `updateProfile` em vez de localStorage
- Manter validacao com Zod
- Adicionar campo "Nome do Cliente" editavel

### 6. Atualizar `Index.tsx`
- Obter config do perfil ativo via `useClientProfiles`
- Passar `adAccountId`, `cpaMeta`, `ticketMedio` para `useMetaAds`

### 7. Atualizar `AppSidebar.tsx`
- Adicionar `ProfileSelector` abaixo do header do sidebar

### Arquivos criados/modificados
- **Migração SQL**: tabela `client_profiles` com RLS
- `src/hooks/useClientProfiles.ts` — novo
- `src/components/ProfileSelector.tsx` — novo
- `src/hooks/useMetaAds.ts` — receber config como params
- `src/pages/Configuracoes.tsx` — persistir no banco
- `src/pages/Index.tsx` — integrar perfil ativo
- `src/components/AppSidebar.tsx` — adicionar seletor

### Detalhes tecnicos

**Fluxo de dados:**
```text
client_profiles (DB) → useClientProfiles → activeProfile
  ↓
  AppSidebar (ProfileSelector dropdown)
  ↓
  Index.tsx → useMetaAds(adAccountId, cpaMeta, ticketMedio)
  ↓
  Configuracoes.tsx → updateProfile(...)
```

**Garantia de perfil ativo unico:** ao ativar um perfil, primeiro `UPDATE SET is_active = false WHERE user_id = X`, depois `UPDATE SET is_active = true WHERE id = Y`.

