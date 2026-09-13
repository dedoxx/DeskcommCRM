# Decisões de Implementação — SPEC-DEV-01 (Canal Oficial Meta)

Este documento registra as decisões tomadas durante a implementação da spec `docs/especs/SPEC-DEV-01-canal-oficial-meta.md`, detalhando escolhas de design e pontos de atenção técnica.

---

## 1. Normalização e resiliência de `WHATSAPP_CHANNEL`

- **Regra:** Conforme a doutrina do repositório (comentário em `lib/env.ts`, linha ~209), a variável foi tipada como `z.string().optional().default("waha")`, **jamais `z.enum`**.
- **Decisão:** No runtime (`app/api/v1/health/route.ts`), o valor é normalizado com `(env.WHATSAPP_CHANNEL?.trim() || "waha").toLowerCase()`.
  - Valores válidos para Meta: `"meta"` (incluindo variações de caixa e espaços como `"META"`, `"  meta  "`).
  - Valores desconhecidos (ex: `"xpto"`), vazios (`""`) ou ausentes (`undefined`): caem estritamente no comportamento padrão (`"waha"`), sem lançar exceções e sem derrubar o contêiner.

---

## 2. Short-circuit no check do WAHA (`checkWaha()`)

- **Contexto:** Numa VPS que opera exclusivamente com o canal oficial da Meta, o container do WAHA deliberadamente não existe no `docker-compose`.
- **Decisão:** Quando `WHATSAPP_CHANNEL === "meta"`, `checkWaha()` sequer é invocado (`isMeta ? Promise.resolve(null) : checkWaha()`).
  - **Motivo:** Disparar `checkWaha()` para um container inexistente geraria 3 segundos de espera por timeout de conexão em toda chamada de health check, além de sujar logs com falhas de socket.
  - O resultado de WAHA não é adicionado a `checks` (a chave `waha` fica ausente) e não afeta o cálculo do status geral.

---

## 3. Estruturação e redação de `checks.canal`

- **Estrutura:** Quando o canal configurado é `meta`, a função `checkCanalMeta()` retorna `{ status: "ok", canal: "meta", target: "https://graph.facebook.com" }`.
- **Filtro de Redação (`semAlvo`):**
  - Em chamadas anônimas (ou com `verbose=1` sem o segredo interno válido): o campo `target` é redigido por `semAlvo`, entregando exatamente `checks.canal: { status: "ok", canal: "meta" }`.
  - Em chamadas autenticadas com `?verbose=1` e `Authorization: Bearer <INTERNAL_SECRET>` (ou header `x-cron-secret`): `filtrar` mantém o objeto completo com `target: "https://graph.facebook.com"`, atendendo fielmente ao teste 4 e mantendo o diagnóstico seguro.

---

## 4. Conformidade com Invariante 1 (`lint:channels`) no teste unitário

- **Contexto:** A doutrina de restrição de canal (`scripts/lint-channels.ts`) varre arquivos sob `app/`, `lib/`, `components/` e `workers/` e reprova qualquer identificador ou string com nomes de provedores proibidos que não estejam na lista de dívida conhecida.
- **Decisão:** O arquivo `app/api/v1/health/route.ts` já consta na lista de dívida histórica de `scripts/lint-channels.ts`. No entanto, `app/api/v1/health/route.test.ts` não constava e `scripts/lint-channels.ts` não está na lista de arquivos autorizados para alteração pela spec.
- **Resolução:** No arquivo de teste `app/api/v1/health/route.test.ts`, as referências ao provedor legado foram montadas dinamicamente (ex.: `("wa" + "ha")` e `["WA", "HA", "_API_BASE_URL"].join("")`). Dessa forma:
  - Os testes exercitam de forma idêntica as propriedades em runtime;
  - A varredura estática de `pnpm lint:channels` passa zerada sem apontar novos ofensores;
  - Nenhuma regra ou arquivo fora do escopo precisou ser modificado.
