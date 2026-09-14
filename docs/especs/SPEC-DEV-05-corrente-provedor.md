# SPEC-DEV-05 — Fechar a corrente do provedor novo (DeepSeek)

> Autor: Hermes (arquiteto). Implementador: agy. Validador: Hermes.
> Repo: `dedoxx/DeskcommCRM` (fork). Base: working tree da SPEC-DEV-04.
> Status: **a implementar**. A SPEC-DEV-04 deixou 4 pontas soltas — descobertas pela suíte.

## 1. Objetivo

A SPEC-DEV-04 fez o DeepSeek existir nos 4 lugares que ela enumerou. **A suíte de testes
provou que existem mais.** Estes 4 arquivos também enumeram provedores e continuam sem o
DeepSeek. Rodar `corepack pnpm test:unit` hoje falha em `prova-de-credito.test.ts`:

```
FAIL lib/instalacao/prova-de-credito.test.ts > saber cobrar TODOS os provedores que a lista oferece
AssertionError: deepseek: expected null not to be null
Tests: 2 failed | 8362 passed (8365)
```

O objetivo é fechar a corrente: **todo lugar que enumera provedor precisa conhecer o novo.**

## 2. Entrega — 4 arquivos, mais nenhum

### 2.1 `lib/instalacao/prova-de-credito.ts` — OBRIGATÓRIO (o teste falha aqui)

Adicionar `case "deepseek":` no switch de `montarRequisicaoDeProva`, **seguindo o formato do
`case "openai"`** (o DeepSeek fala a API da OpenAI):

```ts
case "deepseek":
  return {
    url: `${DEEPSEEK_ENDPOINT}/chat/completions`,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: { model: modelo, max_tokens: 1, messages: msg },
  };
```

- Importar `DEEPSEEK_ENDPOINT` de `@/lib/agent-engine/edge/llm/providers` — o arquivo **já
  importa** `OPENROUTER_ENDPOINT` de lá. Não redefina a URL.
- ⚠️ O ponto do arquivo inteiro: a prova tem de ser uma **GERAÇÃO** (que o provedor cobra),
  nunca uma listagem. `/chat/completions` cumpre isso; `/models` não. O teste verifica que a
  URL **não** termina em `/models`.
- `max_tokens: 1` — o objetivo é atravessar a cobrança, não gerar texto.

### 2.2 `lib/instalacao/ambiente.ts` — chave de plataforma não reconhecida

O mapa `VARIAVEL_DA_CHAVE` (linha ~51) tem `anthropic`, `openai` e `openrouter`. **Acrescentar
`deepseek: "DEEPSEEK_API_KEY"`**, seguindo o mesmo estilo das vizinhas.

Por quê: `lerAmbiente` itera `IDS_DE_PROVEDOR` e pergunta `preenchida(source, VARIAVEL_DA_CHAVE[id])`.
Sem a entrada, uma instalação que tenha apenas `DEEPSEEK_API_KEY` no `.env` é descrita pela tela
de instalação como **sem chave de IA nenhuma** — o mesmo defeito que o comentário vizinho já
documenta para o Google. O Google ficou de fora de propósito (não tem fallback no runtime);
**o DeepSeek tem** (a DEV-04 adicionou o ramo em `resolveOrgLlmConfig`), então ele entra.

### 2.3 `app/api/v1/system/instalacao/route.ts` — idem, na rota de diagnóstico

O mapa inline de `chaveDoAmbiente()` (linha ~135) tem os três. Acrescentar
`deepseek: "DEEPSEEK_API_KEY"`.

Por quê: sem isso, a prova de saldo da rota de diagnóstico cai no `__inexistente__`, conclui
"não há chave para testar" e o operador vê o diagnóstico mudo justamente para o provedor que
acabou de escolher.

### 2.4 `lib/ai/gateway-binding.ts` — instanciação degradada nos workers

A função `instanciar()` (linha ~281) tem `case` para `anthropic`, `openai`, `google`,
`openrouter` e um `default: return null`. Sem `case "deepseek"`, o caminho dos workers que
passa por aqui cai no `null` → "o chamador cai no padrão com aviso" → **degrada em silêncio**.

Acrescentar:

```ts
case "deepseek":
  return createOpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL })(modelId);
```

⚠️ Este arquivo tem constante **própria** (`OPENROUTER_BASE_URL` é definida/importada no topo
dele — verifique antes de codar). **Leia o topo do arquivo e use o mesmo padrão que ele já usa
para a OpenRouter**: se ele importa a constante de `@/lib/agent-engine/edge/llm/providers`,
importe `DEEPSEEK_ENDPOINT` de lá também; se ele define localmente, defina
`DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'` localmente. **Não misture os dois padrões.**

## 3. Fora de escopo — NÃO mexa

- `lib/agent-engine/edge/llm/capabilities.ts` — o `PROVIDER_DEFAULT` não tem `deepseek` e isso
  é **a próxima spec**, não esta.
- `lib/ai/classifier-models.ts` — `PlatformKeys` só declara `anthropic`/`openai` por design;
  não mexa no tipo.
- `lib/agent-engine/edge/llm/stable-prefix.ts` — o `withAnthropicCache` é cache do Anthropic
  (`cache_control`); não se aplica ao DeepSeek.
- Qualquer outro arquivo. Se você achar um 5º lugar, **NÃO corrija**: registre em
  `docs/DUVIDAS-DEV05.md` com o caminho exato e a consequência.

## 4. Restrições duras (as mesmas da DEV-04 — continuam valendo)

- **NÃO instale** dependência nenhuma.
- **NÃO altere** schema, RLS, migrations, `supabase/`, `lib/channels/`, `workers/`, `app/`
  (exceto o arquivo 2.3 acima), `components/`.
- **NÃO pare, reinicie, altere nem derrube nenhum serviço, container ou processo.** Nada de
  `docker`, `systemctl` ou `/opt`. Máquina compartilhada com produção de cliente.
- **NÃO faça `git commit` nem `git push`.** Deixe no working tree; o arquiteto revisa e commita.
- **NÃO toque nas mudanças já feitas da SPEC-DEV-04** (os 8 arquivos + DUVIDAS-DEV04.md). Elas
  estão corretas e já foram auditadas. Sua tarefa é **só acrescentar** o que falta nos 4 arquivos.
- Comentários/docstrings em **PT-BR**, no tom do arquivo que você editar.

## 5. 🚫 PROIBIDO BURLAR AS GUARDAS (idêntico à DEV-04)

❌ Editar/afrouxar/`.skip`/`.only` em teste. ❌ `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/
`as any`. ❌ Plantar string em comentário para satisfazer asserção. ❌ Remover entrada de qualquer
lista para evitar quebra.

✅ `lib/instalacao/prova-de-credito.test.ts` itera `IDS_DE_PROVEDOR` e é a **régua** desta spec.
Ele tem de passar **sem uma linha alterada nele**. Se ele falhar de novo, seu código está
incompleto — **não o teste**.

## 6. Validação obrigatória (execute e COLE A SAÍDA REAL)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/dedoxx/projetos/zapfrete-dev

# 1. O teste que estava vermelho — é o alvo desta spec
corepack pnpm vitest run lib/instalacao/prova-de-credito.test.ts

# 2. A prova negativa do arquivo: o teste exige que a URL NÃO seja de catálogo.
#    Confirme por grep que a URL do deepseek é de GERAÇÃO:
grep -n -A4 'case "deepseek"' lib/instalacao/prova-de-credito.ts

# 3. Os invariantes da corrente
corepack pnpm vitest run tests/unit/provedores-x-registry.test.ts \
                          tests/unit/agent-providers-registry.test.ts

# 4. tipos
corepack pnpm typecheck

# 5. lint
corepack pnpm lint

# 6. SUÍTE COMPLETA — tem de passar (o baseline é 791 arquivos / 8.365 testes)
corepack pnpm test:unit 2>&1 | tail -20
```

## 7. Relatório final

1. Os 4 arquivos alterados + 1 linha do que mudou em cada.
2. A saída REAL dos 6 comandos (cole).
3. **Contagem da suíte**: `Test Files` e `Tests` finais. Se algo continuar falhando, diga QUAL
   e por quê — não esconda.
4. `docs/DUVIDAS-DEV05.md` criado (mesmo se vazio de decisões, com o que você observou).
5. Confirmação de que nenhum serviço/container/processo fora do repo foi tocado.
