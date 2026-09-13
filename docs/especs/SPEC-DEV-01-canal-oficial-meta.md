# SPEC-DEV-01 — Canal oficial da Meta como canal de primeira classe

> **Para a equipe do `agy` (Antigravity).** Não implemente nada fora do escopo abaixo.
> O Hermes (arquiteto) valida do zero depois. Leia `CLAUDE.md` e `AGENTS.md` antes de tocar em código.

## Por que esta spec existe

A instalação do ZapFrete em produção **não usa WAHA** — por decisão do dono, o canal é
**exclusivamente a WhatsApp Cloud API OFICIAL da Meta** (o WAHA usa caminho não-oficial e pode
banir o número do cliente sem recurso). O canal oficial **já existe** no código em
`lib/channels/meta/` (`validate-credentials`, `envelope`, `send-template`, `template-sync`).

O problema é que a rota de saúde trata o WAHA como dependência obrigatória:

- `app/api/v1/health/route.ts` chama `checkWaha()` incondicionalmente (~linha 265)
  e soma o resultado em `checks.waha`.
- Qualquer WAHA ausente → `status: "unhealthy"` → **HTTP 503**.

Medido em produção (13/Set/2026): com Supabase e Redis `ok`, o endpoint devolve **503** só
porque não existe container de WAHA. Um monitor externo leria "sistema fora do ar" com o
produto funcionando. Hoje o painel está 100% operacional e o health mente.

## Objetivo

Tornar o canal oficial da Meta **um canal de primeira classe**: uma instalação que declara
usar a Meta não pode ter o status de saúde derrubado por um WAHA que ela deliberadamente
não subiu. **Sem quebrar nenhuma instalação que já usa WAHA hoje.**

## Contrato

Introduzir a variável de ambiente **`WHATSAPP_CHANNEL`**:

| Valor | Significado |
|---|---|
| `waha` | **default** quando a variável está ausente/vazia — comportamento idêntico ao de hoje |
| `meta` | canal oficial da Meta; o check de WAHA **não** entra no cálculo de saúde |

Regras:

1. `WHATSAPP_CHANNEL` entra em `lib/env.ts` como **`z.string().optional().default("waha")`** e
   **JAMÉS `z.enum`**. Motivo já registrado no próprio arquivo (linha ~209): um `z.enum` sobre
   valor que o operador digita transforma a alavanca num derrubador de instalação — um `.env`
   com valor inesperado deixaria o app `healthy` com 100% das requisições em 500. Valor
   desconhecido → cai no default, sem lançar.
2. Em `whatsapp_channel: "meta"`, a resposta de `GET /api/v1/health` **omite a chave `waha`**
   de `checks` (não devolver `waha: {status:"ok"}` falso) e **acrescenta**
   `checks.canal: { status: "ok", canal: "meta" }`.
3. Com `whatsapp_channel: "waha"` (ou variável ausente), a resposta é **byte a byte** a de
   hoje: `checks` com `supabase`, `redis` e `waha`, e a mesma semântica de
   `healthy` / `degraded` / `unhealthy` e de HTTP 200 / 503.
4. A redação de alvo/erro continua valendo: a nova chave passa pelo mesmo filtro
   (`semAlvo` / `verbose=1`) — **não** publicar endereço nem `error` cru.

## Arquivos que podem ser tocados

- `lib/env.ts` — só a linha nova da variável (com o comentário do porquê)
- `app/api/v1/health/route.ts` — o cálculo de `checks` e `status`
- `app/api/v1/health/route.test.ts` — os testes novos
- `.env.example` e `.env.hostgator.example` — documentar a variável
- `docs/` — uma linha no runbook de self-host, se houver lugar óbvio

**Nada mais.** Não renomeie rota, não mexa em `lib/waha/`, não altere o contrato dos outros
checks, não mude o formato de `data`.

## Validação obrigatória (provar, não afirmar)

Rodar e colar a saída real na resposta:

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test:unit    # gov:verify tem de ficar verde
pnpm test:unit -- app/api/v1/health               # os testes da rota, isolados
```

Testes que **precisam** existir (mínimo):

1. `WHATSAPP_CHANNEL` ausente → `checks` tem exatamente `supabase`, `redis`, `waha`
   (**prova de não-regressão** — é o teste que protege o parque instalado).
2. `WHATSAPP_CHANNEL=meta` + WAHA inalcançável → `status !== "unhealthy"` e **HTTP 200**,
   e `checks` **não** contém a chave `waha`.
3. `WHATSAPP_CHANNEL=meta` + Supabase caído → continua `unhealthy` e **HTTP 503**
   (o canal oficial não pode mascarar banco fora do ar — é o ponto da spec, não um efeito
   colateral que passou batido).
4. `WHATSAPP_CHANNEL=meta` + `verbose=1` → a chave nova sai completa; sem o segredo interno,
   sai redigida.
5. `WHATSAPP_CHANNEL=xpto` (valor inválido) → **não lança**, cai no comportamento de `waha`
   (prova do item 1 do contrato).

## Pitfalls que já custaram tempo nesta casa (não re-descobrir)

- **Não** use `z.enum` para variável que o operador digita — ver `lib/env.ts` (~linha 209).
- `WAHA_API_BASE_URL` é `required()` em produção, sem validação de forma: um `.env` só com
  essa variável vazia **derruba o app** antes de qualquer código desta spec rodar. Não tente
  "resolver" isso aqui — está fora do escopo e é decisão do arquiteto.
- `console.log` é proibido em código merged; use `lib/logger.ts`.
- Comentários em **PT-BR**, mantendo o idioma do arquivo.
- Testes ao lado do código (`route.test.ts` já existe — estenda-o, não crie outro).
- A versão do produto **não** sai do `package.json`; não a escreva em lugar nenhum.

## Definição de pronto

- [ ] `pnpm gov:verify` verde, saída colada
- [ ] os 5 casos de teste acima existindo e passando, com a saída colada
- [ ] `checks.waha` **ausente** quando o canal é `meta` (mostrado, não descrito)
- [ ] nenhum arquivo tocado fora da lista
- [ ] commit na branch `dev/canal-oficial-meta` do fork `dedoxx/DeskcommCRM`, **sem push para `main`**
