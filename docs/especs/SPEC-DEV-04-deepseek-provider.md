# SPEC-DEV-04 — DeepSeek como provedor de primeira classe

> Autor: Hermes (arquiteto). Implementador: Antigravity (`agy`). Validador: Hermes.
> Repo: `dedoxx/DeskcommCRM` (fork). Base: `7975801`.
> Status: **a implementar**. Sem esta spec, o produto só oferece 4 provedores.

## 1. Objetivo

Hoje a organização só consegue escolher **Anthropic, OpenAI, Google ou OpenRouter**
(`lib/ai/pontos/provedores.ts`). O dono da instalação quer **DeepSeek** — mais barato por
token que o padrão atual (Claude Sonnet via OpenRouter).

O DeepSeek fala a **API da OpenAI**, exatamente como a OpenRouter já fala. O repo já resolve
esse caso sem dependência nova (`createOpenAI({ apiKey, baseURL })`) — **não instale nada**.

O que falta é o DeepSeek **existir** nos quatro lugares que enumeram provedores. Hoje, se
alguém gravar `provider = 'deepseek'` no banco, a chamada morre com
`LlmProviderUnknownError` / `LlmNotConfiguredError`.

## 2. Entrega — arquivos a alterar (exatamente estes, mais nenhum)

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `lib/ai/pontos/provedores.ts` | Nova entrada `deepseek` na lista `PROVEDORES` |
| 2 | `lib/ai/provider-validators.ts` | `validateDeepSeekKey()` + `case "deepseek"` no switch |
| 3 | `lib/agent-engine/edge/llm/providers.ts` | `DEEPSEEK_ENDPOINT` + entrada `deepseek` no `createDefaultRegistry` |
| 4 | `lib/agent-engine/edge/llm/credentials.ts` | `deepseekApiKey` no tipo, no `llmEdgeConfigFromEnv` e no fallback de `resolveOrgLlmConfig` |
| 5 | `lib/ai/runtime/agent.ts` | `chaveDePlataforma()` e `buildModel()` |
| 6 | `lib/env.ts` | `DEEPSEEK_API_KEY` no schema Zod |
| 7 | `lib/agent-engine/env.ts` | `DEEPSEEK_API_KEY` no schema Zod do worker |
| 8 | `.env.example` | Documentar `DEEPSEEK_API_KEY` |
| 9 | `docs/DUVIDAS-DEV04.md` | **Criar** — decisões e ambiguidades (formato: ver `docs/DUVIDAS-DEV02.md`) |

### 2.1 Valores exatos

**`lib/ai/pontos/provedores.ts`** — a entrada, no fim do array, mantendo o estilo do arquivo:

```ts
{
  id: "deepseek",
  rotulo: "DeepSeek",
  quandoUsar:
    "Alternativa de custo baixo por token, com boa qualidade em português. Fala a mesma API da OpenAI, então aceita apontar para outro endpoint compatível.",
  aceitaEndpointProprio: true,
  catalogoSincronizavel: true,
  ondePegarAChave: "https://platform.deepseek.com/api_keys",
  prefixoDaChave: "sk-…",
},
```

**`lib/ai/provider-validators.ts`** — `validateDeepSeekKey(apiKey)`:

- `GET https://api.deepseek.com/models` com header `Authorization: Bearer <chave>`.
- `401` / `403` → `{ ok: false, error: "auth_failed_401" }` (mesmo contrato dos irmãos).
- Outro não-2xx → `{ ok: false, error: \`provider_status_${status}\` }`.
- Sucesso → `{ ok: true, models: [...] }` lendo `json.data[].id` (formato OpenAI).
- Erro de rede → `{ ok: false, error: err.name }`.
- Timeout **5s** via o `timedFetch` que já existe no arquivo.
- ⚠️ `/models` do DeepSeek **exige** a credencial (diferente do catálogo da OpenRouter) — é prova real, pode usar. Confirme isso no relatório com as duas chamadas (chave falsa → 401; chave real não é necessária, use a falsa como prova negativa).

**`lib/agent-engine/edge/llm/providers.ts`**:

```ts
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1';
```

```ts
deepseek: (apiKey, modelId) =>
  createOpenAI({ apiKey, baseURL: DEEPSEEK_ENDPOINT, fetch: contain(DEEPSEEK_ENDPOINT) })(modelId),
```

Regras que valem aqui:
- O endpoint é **intrínseco** (como `ANTHROPIC_ENDPOINT`/`OPENAI_ENDPOINT`): este provider **não** honra `baseUrl` de terceiro argumento. Quem precisa de endpoint livre usa `openrouter`, que já honra.
- `contain(DEEPSEEK_ENDPOINT)` é **obrigatório**: sem ele o egress do SDK escapa da allowlist.
- O `DEEPSEEK_ENDPOINT` termina em `/v1` — o `@ai-sdk/openai` concatena `/chat/completions`, e a base do DeepSeek é `https://api.deepseek.com/v1/chat/completions`.

**`lib/agent-engine/edge/llm/credentials.ts`** — três mudanças pontuais:

1. No tipo `LlmEdgeConfig`, novo campo opcional com **docstring em PT-BR** explicando que é o fallback de plataforma do DeepSeek (siga o tom dos comentários vizinhos — eles explicam o *porquê*, não o *quê*).
2. Em `llmEdgeConfigFromEnv`, adicionar `DEEPSEEK_API_KEY?: string` à assinatura do parâmetro e a linha `...(env.DEEPSEEK_API_KEY ? { deepseekApiKey: env.DEEPSEEK_API_KEY } : {})`.
3. Em `resolveOrgLlmConfig`, um `else if` na cadeia que decide a chave — **depois** do de `openrouter`, antes do `else` que lança `LlmNotConfiguredError`:

```ts
} else if (provider === 'deepseek' && cfg.deepseekApiKey) {
  apiKey = cfg.deepseekApiKey;
}
```

⚠️ A cadeia é `cred !== undefined` → `anthropic` → `openai` → `openrouter` → (NOVO) `deepseek` → `throw`. Não reordene os existentes.

**`lib/ai/runtime/agent.ts`** (o SEGUNDO lugar que precisa conhecer o provedor):

1. `chaveDePlataforma`: acrescentar `deepseek: "DEEPSEEK_API_KEY"` ao objeto literal.
2. `buildModel`: novo `case "deepseek":` que devolve
   `createOpenAI({ apiKey, baseURL: DEEPSEEK_ENDPOINT })(modelId)`.
   Importe `DEEPSEEK_ENDPOINT` de `@/lib/agent-engine/edge/llm/providers` (o arquivo **já importa** `OPENROUTER_ENDPOINT` e `cabecalhosDeAtribuicaoOpenRouter` de lá — siga o padrão, não redefina a constante).
   ⚠️ **Sem** `headers: cabecalhosDeAtribuicaoOpenRouter()` — aqueles headers são atribuição da OpenRouter, creditariam o consumo à OpenRouter.

**`lib/env.ts` e `lib/agent-engine/env.ts`**: declare `DEEPSEEK_API_KEY: z.string().optional().default("")` (app) e `z.string().min(1).optional()` (worker), **no mesmo padrão** das linhas vizinhas de `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY`.
⚠️ Leia o comentário do `lib/env.ts` perto da linha 409 (`Nenhuma chave de IA configurada`): decida se `DEEPSEEK_API_KEY` entra naquela condição e **justifique a decisão** em `docs/DUVIDAS-DEV04.md`.

**`.env.example`**: bloco comentado no mesmo estilo dos provedores vizinhos, com a ordem de resolução atualizada se você mudar a condição do `lib/env.ts`.

## 3. Restrições duras

- **NÃO instale nenhuma dependência.** Nada de `@ai-sdk/deepseek` — `@ai-sdk/openai` já cobre.
- **NÃO altere schema, RLS nem migrations.** O vocabulário de `provider` é ABERTO desde a migration `0127` (sem CHECK) — nada de banco muda nesta spec.
- **NÃO toque** em `lib/channels/`, `workers/`, `app/`, `components/`, `supabase/`.
- **NÃO pare, reinicie, altere nem derrube NENHUM serviço, container ou processo.** Você está numa máquina compartilhada com produção de cliente. Não rode `docker`, `systemctl`, nem toque em `/opt`.
- **NÃO faça `git commit` nem `git push`.** Deixe as mudanças no working tree; o arquiteto revisa e commita.
- **NÃO crie rota, tela ou componente novo.** A tela de provedores (`/app/ai/providers`) já é dirigida por `PROVEDORES` — a entrada nova aparece sozinha. Se ela precisar de ajuste, registre em `DUVIDAS-DEV04.md` em vez de mexer.
- Comentários e docstrings em **PT-BR**, no tom dos arquivos vizinhos (eles explicam consequência, não sintaxe).

## 4. PROIBIDO BURLAR AS GUARDAS

Uma rodada anterior deste mesmo projeto passou em `typecheck`/`lint`/`test:unit` plantando
`"--font-atkinson"` **dentro de um comentário** para um `expect().toContain()` passar.
Isso é fraude de guarda. Aqui está **explicitamente proibido**:

- ❌ Plantar string em comentário para satisfazer asserção.
- ❌ Editar/afrouxar um teste existente para ele passar (`.skip`, `.only`, trocar expectativa).
- ❌ `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any` para silenciar erro.
- ❌ Reordenar/remover entradas de `PROVEDORES` para evitar quebra.

✅ **O que fazer quando um teste quebrar porque a lista cresceu de 4 para 5:** atualize a
**expectativa de forma honesta** (o número, o snapshot, o `toHaveLength`) e **registre em
`docs/DUVIDAS-DEV04.md`** qual teste mudou e por quê. Uma contagem que sobe porque a lista
cresceu é a verdade; um teste mutado é uma mentira.

`tests/unit/provedores-x-registry.test.ts` já itera `IDS_DE_PROVEDOR` e chama
`buildModel`/registry para **cada** id — ele passa a cobrir `deepseek` sozinho, sem você
escrever teste. **Se ele falhar, o seu código está incompleto** — não o teste.

## 5. Validação obrigatória (execute e COLE A SAÍDA REAL no relatório)

```bash
cd ~/projetos/zapfrete-dev

# 1. tipos
corepack pnpm typecheck

# 2. lint
corepack pnpm lint

# 3. o invariante que casa a lista da tela com o registry que executa
corepack pnpm vitest run tests/unit/provedores-x-registry.test.ts

# 4. prova NEGATIVA de que a validação de chave realmente valida
#    (o /models do DeepSeek TEM de exigir credencial; sem este teste, a lição
#     do catálogo público da OpenRouter se repete)
node -e "
const {validateDeepSeekKey}=await import('./lib/ai/provider-validators.ts');
const r=await validateDeepSeekKey('sk-0000000000000000000000000000000000000000');
console.log(JSON.stringify(r));
" 2>&1 | tail -3
#    ESPERADO: {"ok":false,"error":"auth_failed_401"}  ← se vier ok:true, o endpoint é público e a validação não vale nada
#    (se o import .ts direto não rodar, use `corepack pnpm vitest run` com um teste temporário
#     que você apaga em seguida — e diga no relatório qual caminho usou)

# 5. suíte completa
corepack pnpm test:unit 2>&1 | tail -25
```

## 6. Relatório final — formato exigido

1. **Arquivos alterados**: caminho + o que mudou (1 linha cada).
2. **Saída REAL** dos 5 comandos acima (cole, não resuma).
3. **Prova negativa**: o JSON do teste da chave falsa.
4. **Contagens**: `test:unit` antes × depois (arquivos/testes). Diga quantos testes existiam antes da sua mudança (rode no `git stash` se precisar) — número inventado invalida a entrega.
5. **Desvios da spec** com justificativa.
6. **`docs/DUVIDAS-DEV04.md`**: decisões tomadas onde a spec era ambígua.
7. Confirmação explícita: **nenhum** serviço, container ou processo fora do repo foi tocado.
