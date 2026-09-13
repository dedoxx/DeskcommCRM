# SPEC-DEV-02 — Tema DR. TECHNO (a "pele" do Wellington sobre o motor)

> **Para a equipe do `agy` (Antigravity).** Implemente só o que está abaixo. O Hermes
> (arquiteto) valida do zero. Leia `CLAUDE.md` e `AGENTS.md` antes de tocar em código.

## Contexto

O Wellington decidiu (**13/Set/2026**) que existe **um único sistema**. O motor é este repo
(fork do DeskcommCRM); a **identidade visual é a dele**, extraída por engenharia reversa do
sistema próprio que ele aprovou como "bonito e intuitivo". A consolidação já foi feita:
`https://crm.dedoxx.com.br` serve este app.

O tema do repo está na direção visual do **upstream** (paleta esverdeada "sage", tipografia e
raios dele). O objetivo é trocar isso pela identidade do Wellington, **pelo mecanismo de marca
que já existe** — sem hardcode e sem quebrar o white-label.

## Tokens de destino (medidos no sistema do Wellington, por frequência de uso)

| Token | Valor | Evidência |
|---|---|---|
| **Neutros** | família **slate** | `text-slate-600` (32×), `text-slate-500` (15×), `border-slate-200` (13×), `text-slate-900` (12×), `bg-slate-100`, `border-slate-300` |
| **Superfícies escuras** | **slate-800 / slate-900** | `bg-slate-800` (8×), `bg-slate-900` (6×) — barras laterais/topbar |
| **Fundo claro** | **slate-50 / white** | `bg-slate-50` |
| **Accent** | **emerald** | anel de foco `ring-emerald-500` (11×), `bg-emerald-600` (8×), `text-emerald-700` (6×), `bg-emerald-50` (soft) |
| **Accent principal (hex)** | **`#059669`** (emerald-600) | cor de ação/botão primário |
| **Tipografia** | **Inter**, com `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` como fallback | medido no CSS dele |
| **Raios** | **`rounded-md`** dominante (20×), `rounded-lg` (12×), `rounded-xl` para cards (9×) | cantos contidos, nada de pílula |
| **Sombras** | **`shadow-sm`** dominante (11×), `shadow-md`/`xl` só em sobreposição | visual plano e discreto |
| **Densidade** | alta — tabelas e resumos, sem exagero visual | preferência declarada do dono |

Referência de estilo: **"Apple Pro Mid-Grey"** — limpo, moderno, cinza-claro, hierarquia por peso
e espaçamento, não por cor.

## O que implementar

1. **Alinhar os neutros do app à família `slate`.** Os arquivos canônicos do tema são
   `app/globals.css` e o que `lib/branding/css.ts` emite (`--color-brand` e a rampa
   `--color-accent-{50..950}`, `-fg`, `-hover`, `-soft`). Troque a base neutra vigente pela
   família slate **nas variáveis de tema** — não saia caçando classe Tailwind por componente.
2. **Tipografia Inter**, carregada pelo caminho que o Next 16 já usa no projeto (não invente
   CDN externo se já houver `next/font`).
3. **Raios e sombras** conforme os tokens acima, pelas variáveis/utilitários do tema.
4. **Accent = esmeralda.** O caminho é `platform_branding.accent_hex` (a rampa é derivada
   automaticamente por `lib/branding/rampa.ts`). **O arquiteto já gravou `#059669` no banco** —
   sua tarefa é garantir que ela se propague corretamente a **botões, links, anéis de foco,
   estados ativos e badges**, e que **não haja cor hardcoded** sobrepondo a variável.
5. **Contraste:** `lib/branding/contraste.ts` tem gate de contraste — **ele precisa continuar
   verde**. Se o accent novo reprovar em algum par, ajuste o par, **não** enfraqueça o gate.

## Regras de ouro (violar = rodada reprovada)

- **NÃO** escreva "Deskcomm"/"DeskcommCRM" em nada visível ao usuário —
  `tests/unit/branding.test.ts` reprova, e a allowlist só encolhe.
- **A marca resolve do BANCO** (`platform_branding`, `organizations.settings.branding`).
  `.env` é semente/piso de rollback, **não** fonte. Não "melhore" isso.
- O resolvedor de marca **nunca pode lançar** (roda em `app/layout.tsx`: um throw ali é 500 em
  todas as telas).
- **NÃO pare, reinicie ou altere nenhum serviço/container/processo fora deste repositório.**
- **NÃO faça push e NÃO commite** — deixe no working tree; o arquiteto revisa e commita.
- **Não instale dependência nova.**
- Comentários em **PT-BR**. `console.log` proibido (`lib/logger.ts`).
- Escopo: **tema**. Não mexa em rota, schema, RLS, agente de IA, workers ou textos de produto.
- Ambiguidade: implemente o mínimo razoável e registre em `docs/DUVIDAS-DEV02.md`.

## Validação obrigatória (rode e cole a SAÍDA REAL)

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:unit -- lib/branding          # o gate de marca/contraste
```

E prove, com comando, **uma** coisa que não é prosa:

- que **não sobrou cor hardcoded** de accent fora da variável — ex.: um grep que liste os
  arquivos onde ainda há hex/`emerald`/`green`/`sage` literal em `app|components` e mostre que
  a lista está vazia (ou justifique cada sobra);
- e que `tests/unit/branding.test.ts` passa.

## Definição de pronto

- [ ] `pnpm gov:verify` verde, saída colada
- [ ] gate de contraste do branding verde
- [ ] nenhuma cor de accent hardcoded em código que alcança o usuário (com o grep no relatório)
- [ ] Inter aplicada, raios/sombras conforme os tokens
- [ ] nenhum arquivo tocado fora do tema (`app/globals.css`, `lib/branding/*`, layout/fontes)
- [ ] `docs/DUVIDAS-DEV02.md` com as decisões ambíguas
