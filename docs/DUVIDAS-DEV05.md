# Decisões e Observações — SPEC-DEV-05 (Corrente do Provedor DeepSeek)

Este documento registra as decisões de implementação, justificativas técnicas e observações de conformidade da SPEC-DEV-05 no repositório `dedoxx/DeskcommCRM`.

---

## 1. Definição Local de `DEEPSEEK_BASE_URL` em `lib/ai/gateway-binding.ts`

### Diagnóstico
A SPEC-DEV-05 instruiu:
> "Leia o TOPO do arquivo primeiro. Se ele IMPORTA a constante de `@/lib/agent-engine/edge/llm/providers`, importe `DEEPSEEK_ENDPOINT` de lá. Se ele DEFINE localmente, defina localmente no mesmo estilo. Não misture os dois padrões."

Ao inspecionar o topo de `lib/ai/gateway-binding.ts`:
- O arquivo importa `OPENROUTER_BASE_URL` de `./gateway` (`lib/ai/gateway.ts`).
- Ele não importa nenhuma constante de `@/lib/agent-engine/edge/llm/providers`.
- `lib/ai/gateway.ts` não define `DEEPSEEK_BASE_URL` e está fora do escopo estrito dos 4 arquivos permitidos para alteração nesta spec (§2 e §3).

### Decisão
Definir `const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";` localmente no corpo de `lib/ai/gateway-binding.ts`, mantendo a assinatura em `instanciar`:
```ts
case "deepseek":
  return createOpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL })(modelId);
```
Isso respeita o isolamento de escopo (não toca em `gateway.ts`) e cumpre a regra de não misturar padrões de importação.

---

## 2. Padrão de Geração na Prova de Crédito (`lib/instalacao/prova-de-credito.ts`)

### Diagnóstico
O teste `lib/instalacao/prova-de-credito.test.ts` asserta que todo provedor oferecido em `IDS_DE_PROVEDOR`:
1. Possui requisição montada em `montarRequisicaoDeProva`.
2. A URL de prova **não** bate em `/models` (catálogo), exigindo um endpoint de cobrança/geração.
3. Utiliza a carga mínima (`max_tokens: 1`).

### Decisão
O ramo adicionado:
```ts
case "deepseek":
  return {
    url: `${DEEPSEEK_ENDPOINT}/chat/completions`,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: { model: modelo, max_tokens: 1, messages: msg },
  };
```
utiliza `DEEPSEEK_ENDPOINT` importado de `@/lib/agent-engine/edge/llm/providers` (mesma origem de `OPENROUTER_ENDPOINT`), aponta para `/chat/completions` (geração real que atravessa cobrança) e usa `max_tokens: 1`.

---

## 3. Observações de Pontos Fora de Escopo (Potenciais 5ºs Lugares)

Conforme a seção §3 da SPEC-DEV-05, os seguintes pontos foram identificados e intencionalmente mantidos inalterados:

1. **`lib/agent-engine/edge/llm/capabilities.ts`**:
   - `PROVIDER_DEFAULT` ainda não enumera `deepseek`. Conforme antecipado pela especificação e confirmado pelo arquivo presente `docs/especs/SPEC-DEV-06-capacidade-deepseek.md`, esta definição pertence à SPEC-DEV-06.
2. **`lib/ai/gateway.ts`**:
   - As funções legadas `isAiGatewayConfigured()` e `resolveLanguageModel()` não conhecem `DEEPSEEK_API_KEY` nem o provedor `deepseek`. Alterações neste arquivo estão expressamente fora do escopo desta rodada.
3. **`lib/ai/classifier-models.ts`**:
   - `PlatformKeys` restringe-se a `anthropic` e `openai` por design. Nenhuma alteração foi realizada.
