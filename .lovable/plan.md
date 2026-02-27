

## Diagnóstico do Erro "Edge Function returned a non-2xx status code"

O problema é claro: a edge function `create-meta-campaign` retorna status HTTP 400 quando a Meta API rejeita a requisição. O SDK do Supabase (`supabase.functions.invoke()`) trata qualquer resposta non-2xx como erro, descartando o body JSON com os detalhes reais. O frontend só vê a mensagem genérica "Edge Function returned a non-2xx status code" em vez do erro real da Meta (ex: "O orçamento mínimo é R$ 6,00", "Token expirado", etc.).

## Correção

### 1. Edge Function: retornar sempre HTTP 200

**File: `supabase/functions/create-meta-campaign/index.ts`**

Alterar todas as respostas de erro da Meta API (token inválido, falha na campanha, falha no adset, falha no ad) de `status: 400` para `status: 200`, mantendo `{ error: "...", step: "..." }` no body. Assim o SDK não descarta o body e o frontend consegue ler `result.error` e `result.step`.

Respostas que mudam de 400 → 200:
- Token inválido (line 97-99)
- Token não configurado (line 78-80)
- Ad Account não configurado (line 86-88)
- Erro ao criar campanha (line 125-127)
- Erro ao criar adset (line 166-168)
- Erro ao criar ad (line 205-207)

Manter `status: 401` apenas para autenticação do usuário (JWT) e `status: 500` para erros inesperados.

### 2. Frontend: melhorar exibição do erro

**File: `src/pages/LancarCampanha.tsx`**

Na linha 191, em vez de `throw publishError`, tentar extrair o body JSON do erro para exibir a mensagem real da Meta:

```typescript
if (publishError) {
  // Try to parse the error context for detailed Meta error
  let detailedError = publishError.message;
  try {
    if (publishError.context) {
      const errBody = await publishError.context.json();
      detailedError = errBody?.error || detailedError;
    }
  } catch {}
  throw new Error(detailedError);
}
```

### Resultado Esperado

Em vez de ver "Edge Function returned a non-2xx status code", o usuário verá o erro real da Meta como:
- "Token inválido ou sem permissão ads_management"
- "O orçamento mínimo é R$ 6,00"
- "O criativo precisa de uma imagem"

Com a etapa exata que falhou (Campanha, Conjunto ou Anúncio).

---

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Retornar HTTP 200 para erros de negócio da Meta API |
| `src/pages/LancarCampanha.tsx` | Extrair erro detalhado do context do FunctionsHttpError |

