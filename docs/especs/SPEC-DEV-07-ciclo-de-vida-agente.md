# SPEC-DEV-07 — Ciclo de vida do agente: excluir, reativar e destravar a publicação

> Autor: Hermes (arquiteto). Implementador: agy. Validador: Hermes.
> Repo: `dedoxx/DeskcommCRM` (fork). Base: `1bfca10`.
> Status: **a implementar**. Três defeitos medidos em produção (14/Set/2026), com o dono travado.

## 1. Objetivo

O dono da instalação relatou, textualmente: **"eu nao consigo colocar o agente publicado"** e
**"quero o botão de remover o agente que nao quero"**. Investigando em produção, os três
defeitos abaixo foram **medidos em tela e em banco** — não são hipóteses.

### Defeito A — não existe como EXCLUIR um agente
`AgentRowMenu.tsx` oferece: Editar, Duplicar, Renomear, Pausar/Despausar e **Arquivar**.
Não há "Excluir". E o próprio diálogo de arquivar afirma:
*"Não é possível desarquivar pela UI nesta versão."* ⇒ **não há saída**: o agente indesejado
fica para sempre na lista. A rota `DELETE /api/v1/ai/agents/[id]` **já existe** (linha 216) e
faz o soft delete — o que falta é a superfície.

### Defeito B — "Despausar" está DESABILITADO para `mcp_agent`, que é o tipo do agente real
`AgentRowMenu.tsx:105`:
```tsx
<DropdownMenuItem disabled={isArchived || agent.kind === "mcp_agent"} ...>
```
Medido em produção: o agente `mcp_agent` do dono ficou com `is_active=false` e **não havia
caminho na UI para reativar** — foi exatamente isso que o travou. (`is_active` é `true` na
criação e vira `false` no soft delete; sem despausar, não volta.)

### Defeito C — a publicação trava quando a chave escolhida é a DA INSTALAÇÃO
`AgentForm.tsx:383-395`, `publishBlockReason`:
```ts
if (!cred) return t("Escolha a chave de acesso da empresa de inteligência artificial.");
```
Medido em produção: o seletor **"Chave de acesso"** oferece e pré-seleciona
**"A chave desta instalação (deepseek)"**, mas essa opção **não preenche `credential_id`**
⇒ `findCredential` devolve `undefined` ⇒ `!cred` ⇒ **o botão "Publicar" fica desabilitado para
sempre**, e o motivo só aparece no `title` (tooltip) do botão. O dono não tinha como saber.
A instalação TEM a chave de plataforma (`DEEPSEEK_API_KEY` no `.env`) e ela **funciona**
(provado: `GET /api/v1/system/instalacao?provar=1` → `prova:{feita:true, ok:true}`).

## 2. Entrega — 4 arquivos

### 2.1 `app/app/ai/agents/_components/AgentRowMenu.tsx`

1. **Nova opção "Excluir"**, no fim, depois de um `DropdownMenuSeparator`, com
   `className="text-destructive focus:text-destructive"`, com diálogo de confirmação
   (mesmo padrão do `AlertDialog` de arquivar):
   - Título: `Excluir "{nome}"?`
   - Descrição: **consequência em linguagem de negócio**, no estilo do repo. Diga que as
     conversas e o histórico de versões são preservados e que o agente sai da lista.
   - ⚠️ **O botão de confirmar NÃO pode fechar o diálogo antes da action resolver** — use
     `onSelect={(e) => e.preventDefault()}` no item e mantenha o padrão do vizinho.
   - Deve existir para **agente arquivado também** (é justamente o que o dono quer remover).
2. **Habilitar "Despausar" para `mcp_agent`** — remover o `|| agent.kind === "mcp_agent"` do
   `disabled`. Justificativa: o gate existia para um caminho que hoje não é o único; medido em
   produção, ele deixa o dono sem saída. Se houver razão real para o gate, ela precisa ser
   escrita em comentário e a UI precisa oferecer **outra** forma de reativar — hoje não oferece.
3. **Ajustar o texto do diálogo de Arquivar**: ele promete irreversibilidade que passará a ser
   falsa se houver desarquivar. Se você implementar "Desarquivar" (item 4), corrija a frase.

### 2.2 `app/app/ai/agents/_actions.ts`

Adicionar a server action que chama a rota/uso existente de exclusão, seguindo **exatamente** o
padrão das irmãs (`archiveAgentAction`, `pauseAgentAction`): mesma assinatura de retorno
(`{ok, error?, message?}`), mesmo tratamento de erro. Nome: `deleteAgentAction`.

⚠️ A rota devolve **409 quando `is_default = true`**. A mensagem ao usuário tem de dizer o que
fazer, não o código HTTP: algo como *"Este é o agente padrão. Torne outro agente o padrão antes
de excluir."* Verifique o corpo do 409 em `app/api/v1/ai/agents/[id]/route.ts` e traduza a
intenção — **não** invente um código novo.

### 2.3 `app/app/ai/agents/[id]/_components/AgentForm.tsx` — Defeito C

Fazer a régua aceitar a **chave da instalação** como credencial utilizável.

`publishBlockReason` hoje exige `cred` (linha de `ai_provider_credentials`) e
`credSt === "validated"`. Quando o operador escolhe a chave da plataforma, não há linha — mas
**há chave, e ela funciona**. O bloqueio é falso.

Implemente: quando a seleção for a chave da instalação (identifique pela mesma fonte que o
`CredentialPicker` usa para montar essa opção — leia `CredentialPicker.tsx` e `useCredentials.ts`
antes de codar), **pule as duas checagens de credencial** e mantenha as demais (número conectado,
formulário válido, rascunho salvo). Registre em comentário **por que** essa opção é válida: ela
resolve pelo fallback de plataforma (`resolveOrgLlmConfig`), provado em produção.

⚠️ **NÃO conseguimos publicar o agente do dono por causa disso** — a publicação dele só passou
depois de eu gravar uma credencial BYOK por fora. O caminho da tela tem de funcionar sozinho.

### 2.4 `docs/DUVIDAS-DEV07.md` — criar

Decisões tomadas onde esta spec for ambígua. Obrigatório.

## 3. Fora de escopo — NÃO mexa
- Schema, RLS, migrations, `supabase/` — **a rota DELETE já existe**, nada de banco muda.
- `lib/`, `workers/`, `lib/channels/` — nenhum.
- O `CredentialPicker.tsx` (só leia, para entender a opção "chave desta instalação").
- Corrigir/alterar o `kind === "mcp_agent"` em qualquer outro lugar que não seja o menu.

## 4. Restrições duras (as mesmas das DEV-04/05/06)

- **NÃO instale** dependência nenhuma.
- **NÃO pare, reinicie, altere nem derrube nenhum serviço, container ou processo.** Nada de
  `docker`, `systemctl` ou `/opt`. **Máquina compartilhada com produção de cliente** — e o CRM
  do dono está NO AR neste exato momento, com agente publicado e número conectado.
- **NÃO faça `git commit` nem `git push`.** Deixe no working tree.
- **NÃO toque** nas mudanças das DEV-04/05/06 (já auditadas e em produção). Sua tarefa é
  **aditiva**.
- Comentários em **PT-BR**, no tom do arquivo editado (eles explicam consequência, não sintaxe).

## 5. 🚫 PROIBIDO BURLAR AS GUARDAS

❌ editar/afrouxar/`.skip`/`.only` em teste · ❌ `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/
`as any` · ❌ plantar string em comentário para satisfazer asserção · ❌ remover entrada de lista
para evitar quebra.

✅ Se um teste fixar a lista de itens do menu ou o texto do diálogo e quebrar porque você
acrescentou algo, **atualize a expectativa honestamente** e registre em `DUVIDAS-DEV07.md`.

## 6. Validação obrigatória (execute e COLE A SAÍDA REAL)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/dedoxx/projetos/zapfrete-dev

# 1. tipos
corepack pnpm typecheck

# 2. lint
corepack pnpm lint

# 3. prova de que o gate do mcp_agent saiu e o item novo entrou (o diff é a prova)
git diff app/app/ai/agents/_components/AgentRowMenu.tsx

# 4. testes que tocam agentes
corepack pnpm vitest run tests/unit/agent-providers-registry.test.ts tests/unit/provedores-x-registry.test.ts 2>&1 | tail -8

# 5. SUÍTE COMPLETA — tem de passar (baseline: 791 arquivos / 8.365 testes)
corepack pnpm test:unit 2>&1 | tail -20
```

## 7. Relatório final

1. Os arquivos alterados + 1 linha do que mudou em cada (inclua o diff do menu).
2. A saída REAL dos 5 comandos (cole).
3. Contagem final da suíte. Se algo falhar, diga QUAL e por quê — não esconda.
4. `docs/DUVIDAS-DEV07.md` criado, dizendo explicitamente **como você identificou a opção
   "chave da instalação"** no `CredentialPicker` (é o ponto mais delicado da spec).
5. Confirmação de que nenhum serviço/container/processo fora do repo foi tocado.
