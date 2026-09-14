# Decisões e Resoluções — SPEC-DEV-04 (Provedor DeepSeek)

Este documento registra as decisões tomadas, justificativas técnicas e resoluções de ambiguidades durante a implementação da SPEC-DEV-04 (integração de primeira classe do provedor DeepSeek no DeskcommCRM).

---

## 1. Condição de Aviso de Boot em `lib/env.ts` (Linha 409)

### Diagnóstico
O bloco de aviso em `lib/env.ts` (linha 409) emite o alerta:
`[env] Nenhuma chave de IA configurada (AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY ou OPENROUTER_API_KEY) — o agente vai pular toda resposta com reason='ai_gateway_key_missing'.`

O comentário explica que `OPENROUTER_API_KEY` entrou nessa condição porque tanto `isAiGatewayConfigured()` quanto `resolveLanguageModel()` em `lib/ai/gateway.ts` a tratam como configuração válida para o despachador legado (`ai-response-worker`).

### Decisão e Justificativa
`DEEPSEEK_API_KEY` **não** foi adicionada à condição `!env.AI_GATEWAY_API_KEY && !env.ANTHROPIC_API_KEY && !env.OPENROUTER_API_KEY`.
- `lib/ai/gateway.ts` é o gateway legado de IA e está fora da lista estrita de arquivos alteráveis pela spec (§2). Ele não possui ramo de resolução para `deepseek`.
- Se `DEEPSEEK_API_KEY` fosse inserida no `if` de `lib/env.ts` sem que `lib/ai/gateway.ts` saiba resolvê-la, uma instalação configurada apenas com `DEEPSEEK_API_KEY` silenciaria o aviso de boot, mas o `ai-response-worker` continuaria pulando mensagens com `ai_gateway_key_missing`.
- O DeepSeek é suportado de ponta a ponta no motor moderno `agent-engine` (`lib/agent-engine/edge/llm/`) e no runtime de ensaio (`lib/ai/runtime/agent.ts`), onde o fallback de plataforma `DEEPSEEK_API_KEY` é respeitado com fidelidade através de `llmEdgeConfigFromEnv` e `resolveOrgLlmConfig`.

---

## 2. Atualização de Expectativa em Teste Unitário (`tests/unit/agent-providers-registry.test.ts`)

### Diagnóstico
O teste `tests/unit/agent-providers-registry.test.ts` continha a asserção exata:
`expect(Object.keys(reg).sort()).toEqual(["anthropic", "google", "openai", "openrouter"]);`
prevendo 4 provedores.

### Resolução Honesta
Conforme autorizado explicitamente pela spec (§4) e pelas regras de ouro:
- A expectativa foi honestamente atualizada para refletir a nova lista de 5 provedores:
  `["anthropic", "deepseek", "google", "openai", "openrouter"]`.
- Foi adicionada a asserção `expect(() => reg.deepseek!("k", "deepseek-chat")).not.toThrow();` no teste subsequente de instanciação de modelos para garantir cobertura equivalente à dos outros provedores.
- Em contrapartida, `tests/unit/provedores-x-registry.test.ts` cobriu o `deepseek` automaticamente sem qualquer modificação em suas asserções, validando o invariante completo (lista da tela × registry de produção × pontos de escrita × runtime de ensaio).

---

## 3. Exportação da Constante `DEEPSEEK_ENDPOINT`

### Diagnóstico
A tabela de entrega do §2.1 mencionava `const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1';` em `lib/agent-engine/edge/llm/providers.ts`. Contudo, para `lib/ai/runtime/agent.ts`, a spec instruiu:
*"Importe `DEEPSEEK_ENDPOINT` de `@/lib/agent-engine/edge/llm/providers` (o arquivo já importa `OPENROUTER_ENDPOINT` e `cabecalhosDeAtribuicaoOpenRouter` de lá — siga o padrão, não redefina a constante)."*

### Resolução
A constante foi exportada (`export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1';`) em `lib/agent-engine/edge/llm/providers.ts`, preservando o princípio de fonte única da verdade e evitando duplicidade de endpoints espalhados pelo código.

---

## 4. Tratamento do Endpoint como Intrínseco

### Diagnóstico
Ao contrário do provider `openrouter`, que aceita um terceiro argumento `baseUrl` para gateways arbitrários, o DeepSeek foi modelado com endpoint intrínseco.

### Resolução
A fábrica em `createDefaultRegistry` ignora `baseUrl` customizada e utiliza `DEEPSEEK_ENDPOINT` com `fetch: contain(DEEPSEEK_ENDPOINT)`, mantendo o tráfego do SDK contido dentro da allowlist do egress.

---

## 5. Validação de Credencial via `validateDeepSeekKey`

### Diagnóstico
Diferente da OpenRouter (cujo catálogo de modelos `/models` é público e responde 200 mesmo sem autenticação), o endpoint `https://api.deepseek.com/models` do DeepSeek exige autenticação Bearer e responde com status 401 para credenciais inválidas ou inexistentes.

### Resolução
A função `validateDeepSeekKey` bate diretamente em `https://api.deepseek.com/models` com timeout de 5 segundos via `timedFetch`. Respostas 401 e 403 retornam `{ ok: false, error: "auth_failed_401" }`, outros status não-2xx retornam `provider_status_${status}`, e respostas 200 retornam os ids dos modelos extraídos de `json.data[].id`.
