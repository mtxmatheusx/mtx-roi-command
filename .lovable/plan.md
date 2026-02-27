

## Correção: Schema JSON inválido no `ai-campaign-draft`

### Problema
O campo `andromeda_targeting` está definido **fora** do objeto `properties` (linha 209), mas é referenciado no array `required` (linha 222). Isso causa o erro `parameters.required[5]: property is not defined` na API do Gemini.

A estrutura atual está assim:
```
properties: {
  campaign_name, copy_options, targeting_suggestion, daily_budget, ai_reasoning
},  // <-- properties fecha aqui na linha 208
  andromeda_targeting: { ... },  // <-- fora de properties!
required: ["...", "andromeda_targeting"]  // <-- referencia algo que não existe em properties
```

### Correção
Mover `andromeda_targeting` para **dentro** do objeto `properties`, antes do fechamento da chave na linha 208.

### Arquivo
| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-campaign-draft/index.ts` | Mover `andromeda_targeting` para dentro de `properties` (linhas 208-221) |

