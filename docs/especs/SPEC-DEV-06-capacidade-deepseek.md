# SPEC-DEV-06 — DeepSeek no registro de CAPACIDADES (visão)

> Autor: Hermes (arquiteto). Implementador: agy. Validador: Hermes.
> Repo: `dedoxx/DeskcommCRM` (fork). Depende de: DEV-04 (já no working tree).
> Status: **a implementar**. Última ponta da corrente do provedor novo.

## 1. Objetivo — e a PROVA que motiva esta spec

O registro de capacidades (`lib/agent-engine/edge/llm/capabilities.ts`) decide se a mídia do
turno vai como **parte nativa** (imagem) ou não. O `PROVIDER_DEFAULT` de lá tem `anthropic`,
`openai` e `google`. **O DeepSeek não está**, então:

```ts
modelCapabilities('deepseek', 'deepseek-flash')  // → { image: false, pdf: false }
capacidadeEhConhecida('deepseek', 'deepseek-flash') // → false
```

Consequência medida no código (`workers/media-derive-worker.ts:236-262`): `visaoEmVigor()`
devolve `{ enxerga: false, sabemos: false }`, a imagem **não vai nativa**, e o operador recebe
o aviso *"não sei se o modelo deepseek-flash enxerga imagens"*.

**Isso é FALSO, e eu medi.** Em 14/Set/2026, contra `https://api.deepseek.com/v1/chat/completions`,
modelo `deepseek-flash`, com PNG 32×32 sólido embutido como `data:` URL:

```
PNG VERMELHO  →  resposta: "Vermelho"
PNG PRETO     →  resposta: "Preta"    ← controle: descarta alucinação por viés da pergunta
```

O modelo **enxerga imagem**. O código não sabe. Esta spec corrige o código para refletir a
medição.

## 2. Entrega — 1 arquivo, mais nenhum

### `lib/agent-engine/edge/llm/capabilities.ts`

Acrescentar a entrada `deepseek` no `PROVIDER_DEFAULT`:

```ts
deepseek: { image: true, pdf: false },
```

**Por que `pdf: false` e não `NATIVE` (que é `{image:true, pdf:true}`):** foi medido **imagem**,
não PDF. PDF chega ao provedor como content part `file`, que é um caminho diferente; afirmar
`pdf: true` sem ter medido seria repetir exatamente o defeito que o comentário do topo deste
arquivo denuncia — "só afirma nativo para o que sabemos que funciona". Deixe `image: true` com
a prova no comentário e `pdf: false` como estado não verificado.

**Comentário obrigatório** (em PT-BR, no tom do arquivo): registre a MEDIÇÃO com a data, os dois
casos (vermelho/preto) e que o controle do preto foi o que descartou alucinação. Sem a data e o
método, a próxima pessoa não consegue re-verificar nem sabe quando isso foi verdade.

⚠️ **NÃO use `NATIVE`** para o DeepSeek. Use o objeto literal, e justifique em comentário.

## 3. Fora de escopo — NÃO mexa

- `lib/ai/pontos/capacidade-em-vigor.ts` — a regra dele já está certa; ele só consome
  `modelCapabilities` e `capacidadeEhConhecida`.
- `lib/ai/classifier-models.ts` (`PlatformKeys`) — por design só declara anthropic/openai.
- `ROTEADORES` em `capabilities.ts` — o DeepSeek **não** é roteador (serve os modelos dele
  próprio). Não acrescente ele lá; a lógica de prefixo de fabricante não se aplica.
- Os 4 arquivos da SPEC-DEV-05 e os 8 da DEV-04. Já estão corretos e auditados.
- O catálogo `ai_models` (banco) — **isso é dado, não código**; o arquiteto aplica por SQL.

## 4. Restrições duras (as mesmas — continuam valendo)

- **NÃO instale** dependência nenhuma.
- **NÃO altere** schema, RLS, migrations, `supabase/`, `lib/channels/`, `workers/`, `app/`,
  `components/`.
- **NÃO pare, reinicie, altere nem derrube nenhum serviço, container ou processo.** Nada de
  `docker`, `systemctl` ou `/opt`. Máquina compartilhada com produção de cliente.
- **NÃO faça `git commit` nem `git push`.**
- **NÃO toque** nas mudanças da DEV-04 e da DEV-05.
- Comentários em **PT-BR**, no tom do arquivo.

## 5. 🚫 PROIBIDO BURLAR AS GUARDAS

❌ editar/afrouxar/`.skip`/`.only` em teste · ❌ `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/
`as any` · ❌ plantar string em comentário para satisfazer asserção · ❌ remover entrada de lista
para evitar quebra.

✅ Se existir um teste que fixa o conteúdo de `PROVIDER_DEFAULT` e ele quebrar porque a lista
cresceu, **atualize a expectativa honestamente** e registre em `docs/DUVIDAS-DEV06.md` qual
teste mudou e por quê.

## 6. Validação obrigatória (execute e COLE A SAÍDA REAL)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/dedoxx/projetos/zapfrete-dev

# 1. prova de que a capacidade nova é lida pela regra de vigor
corepack pnpm vitest run tests/unit/ -t "visao" 2>&1 | tail -15 || true
grep -rn "deepseek" lib/agent-engine/edge/llm/capabilities.ts

# 2. tipos
corepack pnpm typecheck

# 3. lint
corepack pnpm lint

# 4. SUÍTE COMPLETA — tem de passar (baseline: 791 arquivos / 8.365 testes)
corepack pnpm test:unit 2>&1 | tail -20
```

## 7. Relatório final

1. O arquivo alterado + o diff (cole).
2. A saída REAL dos comandos.
3. Contagem final da suíte (Test Files / Tests). Se algo falhar, diga QUAL e por quê.
4. `docs/DUVIDAS-DEV06.md` criado (se um teste precisou mudar, é aqui que se explica).
5. Confirmação de que nenhum serviço/container/processo fora do repo foi tocado.
