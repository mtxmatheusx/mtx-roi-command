

## Fix: "promoted_object com combinação inválida de parâmetros"

O erro na screenshot mostra que a Meta rejeita o AdSet porque o `promoted_object` com apenas `pixel_id` é insuficiente. Para objetivos de conversão, a Meta exige `pixel_id` + `custom_event_type`.

### Correção em `supabase/functions/create-meta-campaign/index.ts`

**Linha 145**: Ajustar `optimization_goal` para não-conversão (ex: OUTCOME_TRAFFIC → LINK_CLICKS).

**Linhas 152-155**: Expandir o `promoted_object` com `custom_event_type`:
- `OUTCOME_SALES` → `{ pixel_id, custom_event_type: "PURCHASE" }`
- `OUTCOME_LEADS` → `{ pixel_id, custom_event_type: "LEAD" }`

```typescript
// Linha 145 — optimization_goal dinâmico
optimization_goal: draft.objective === "OUTCOME_LEADS"
  ? "LEAD_GENERATION"
  : draft.objective === "OUTCOME_SALES"
    ? "OFFSITE_CONVERSIONS"
    : "LINK_CLICKS",

// Linhas 152-155 — promoted_object com custom_event_type
if (isConversion && pixelId && pixelId.trim() !== "") {
  adSetBody.promoted_object = {
    pixel_id: pixelId,
    custom_event_type: draft.objective === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
  };
}
```

Se o pixel não estiver configurado para campanhas de conversão, retornar erro claro em vez de enviar payload incompleto.

### Arquivo Modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-meta-campaign/index.ts` | Adicionar `custom_event_type` ao `promoted_object` e ajustar `optimization_goal` |

