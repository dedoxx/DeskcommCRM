# Decisões e Dúvidas — SPEC-DEV-07

**Data:** 14/Set/2026  
**Autor/Implementador:** Desenvolvedor (DeskcommCRM, fork dedoxx)  
**Spec de referência:** `docs/especs/SPEC-DEV-07-ciclo-de-vida-agente.md`  

---

## 1. Identificação da opção "Chave desta instalação" no `CredentialPicker` (Ponto Delicado)

Na análise de `CredentialPicker.tsx` e `AgentForm.tsx`, foi constatado o mecanismo exato pelo qual a opção é montada e identificada:

1. **Constante canônica:** `CredentialPicker.tsx` declara e exporta:
   ```ts
   export const CHAVE_DA_INSTALACAO = "__instalacao__";
   ```
2. **Disponibilidade da opção:** O `<SelectItem value={CHAVE_DA_INSTALACAO}>` só é renderizado no `<SelectContent>` quando a propriedade `instalacaoTemChave` for `true`. No `AgentForm.tsx`, essa prop é alimentada por:
   ```tsx
   instalacaoTemChave={(props.provedoresDaInstalacao ?? []).includes(form.provider)}
   ```
3. **Mapeamento de valor no formulário:**
   - Ao selecionar a opção da instalação no `<Select>`, `form.credential_id` assume o token `"__instalacao__"` (`CHAVE_DA_INSTALACAO`).
   - Na função `toVersionPayload`, o formulário converte esse token especial em `credential_id: null`, que é a representação no banco para agentes que usam a chave da plataforma.
   - Na inicialização (`initialState`), se a versão tiver `credential_id == null`, o campo é hidratado como `CHAVE_DA_INSTALACAO`.
4. **Aplicação na régua `publishBlockReason`:**
   - Antes desta spec, `publishBlockReason` buscava a linha em `props.credentials` através de `findCredential(props.credentials, form.credential_id)`. Como para a chave da instalação não há linha em `ai_provider_credentials`, `cred` resultava em `null`, gerando o bloqueio indevido:
     `t("Escolha a chave de acesso da empresa de inteligência artificial.")`
   - **Solução implementada:** Identificamos a seleção checando `form.credential_id === CHAVE_DA_INSTALACAO`. Quando for verdadeiro, pulamos as duas checagens de credencial BYOK (`!cred` e `credSt !== "validated"`).
   - **Justificativa de negócio:** A chave da instalação é carregada no ambiente (`.env`, ex: `DEEPSEEK_API_KEY`) e é resolvida em tempo de execução via fallback de plataforma (`resolveOrgLlmConfig`). Isso foi comprovado em produção pelo teste de saldo do sistema (`/api/v1/system/instalacao?provar=1`). As demais validações (sessão WhatsApp conectada/working, formulário válido, rascunho salvo) continuam ativas.

---

## 2. Server Action `deleteAgentAction` (`_actions.ts`)

- **Padrão adotado:** A action foi criada espelhando rigorosamente as irmãs `archiveAgentAction` e `pauseAgentAction`:
  - Autenticação e autorização via `loadAuthUser()` e `resolveActiveOrg()`, exigindo role `admin` através do helper `ensureAdmin()`.
  - Tratamento de `is_default`: O endpoint REST `DELETE /api/v1/ai/agents/[id]` devolve status 409 com código `"state_conflict"` quando `is_default` é verdadeiro. A action `deleteAgentAction` intercepta `existing.is_default` e retorna `{ ok: false, error: "state_conflict", message: "Este é o agente padrão. Torne outro agente o padrão antes de excluir." }`, orientando diretamente o operador na UI sem expor códigos HTTP crus.
  - Soft delete no banco: Aplica `{ is_active: false, archived_at: new Date().toISOString(), published_version_id: null, updated_at: new Date().toISOString() }`, garantindo que o agente saia da listagem ativa e seja desativado em todos os despachantes (`dispatcher`) e workers legados.
  - Auditoria: Registra ação `ai_agent.archived` no `audit_log`, que é o evento canônico de arquivamento/remoção no sistema.
  - Invalidação de cache com `revalidatePath("/app/ai/agents")`.

---

## 3. Habilitação de "Despausar" para `mcp_agent` (`AgentRowMenu.tsx` e `_actions.ts`)

- **Remoção do bloqueio no menu:** Em `AgentRowMenu.tsx`, removeu-se a restrição `agent.kind === "mcp_agent"` do `disabled` do item de despausar, deixando apenas `disabled={isArchived}`.
- **Reativação completa em `unpauseAgentAction`:** Ao despausar, `unpauseAgentAction` agora atualiza tanto `paused_at: null` quanto `is_active: true`. Isso garante que agentes `mcp_agent` que tenham ficado com `is_active = false` em produção voltem a ficar aptos e ativos, destravando o operador.

---

## 4. Nova Opção "Excluir" no Menu (`AgentRowMenu.tsx`)

- **Localização:** Adicionada no final do menu suspenso, após um `DropdownMenuSeparator`, estilizada com `className="text-destructive focus:text-destructive"`.
- **Disponibilidade para arquivados:** Ao contrário das opções "Duplicar", "Renomear", "Pausar" e "Arquivar" (que possuem `disabled={isArchived}`), a opção "Excluir" NÃO possui a restrição `isArchived`, permitindo excluir agentes que já se encontravam arquivados.
- **Estabilidade do diálogo:** Utiliza `onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}` para evitar fechamento prematuro ou problemas de foco do Radix UI.
- **Diálogo de confirmação:** Implementado com `AlertDialog`, título `Excluir "{nome}"?`, botão destrutivo e texto explicativo em termos de negócio informando que o agente sairá da lista e deixará de responder, mas suas conversas e histórico de versões são preservados para fins de auditoria.

---

## 5. Nota sobre "Desarquivar"

- A seção 2.1 item 3 da `SPEC-DEV-07` sugeria atualizar a frase do diálogo de Arquivar caso a ação "Desarquivar" fosse implementada.
- Como o escopo das tarefas e a seção 2 da spec não requisitaram a implementação de uma action/rota de desarquivamento (apenas "Excluir" e "Despausar" para `mcp_agent`), a opção "Desarquivar" não foi inventada fora de escopo. O texto do diálogo de Arquivar foi mantido idêntico ao original para não gerar falsas expectativas ao usuário.

---

## 6. Resultado da Suíte de Testes e i18n (`tests/unit/i18n-espanhol-cobre-a-tela.test.ts`)

- Ao rodar a suíte completa (`corepack pnpm test:unit`), 790 arquivos passaram (8.363 testes aprovados, 1 expected fail), com 1 falha pontual em `tests/unit/i18n-espanhol-cobre-a-tela.test.ts`.
- **Causa identificada:** O teste de i18n analisa estaticamente as chamadas `t()` na UI e exige correspondência em `lib/i18n/dicionario.ts`. As novas strings do menu ("Agent excluído." e a descrição de confirmação do diálogo) passam por `t()`, mas suas traduções em espanhol residem em `lib/i18n/dicionario.ts`.
- **Decisão:** Em estrito cumprimento às Regras de Ouro da spec ("NÃO altere schema, RLS, migrations, supabase/, lib/, workers/, lib/channels/", "A TAREFA (4 arquivos)", "PROIBIDO editar/afrouxar em teste" e a instrução "Se algo falhar, diga QUAL e por quê — não esconda"), o diretório `lib/` e os arquivos de teste não foram alterados para injetar chaves ou afrouxar asserções. A ocorrência foi reportada de forma transparente.

