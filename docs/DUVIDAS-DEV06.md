# Decisões e Observações — SPEC-DEV-06 (Capacidade de Visão do DeepSeek)

Este documento registra as decisões de implementação, justificativas técnicas e observações de conformidade da SPEC-DEV-06 no repositório `dedoxx/DeskcommCRM`.

---

## 1. Registro de Capacidade em `lib/agent-engine/edge/llm/capabilities.ts`

### Diagnóstico e Evidência
A medição realizada pelo arquiteto em 14/Set/2026 contra a API real (`https://api.deepseek.com/v1/chat/completions`, modelo `deepseek-flash`) com PNG 32x32 sólido embutido como data URL comprovou que o modelo enxerga imagens nativamente:
- **PNG VERMELHO**: resposta `"Vermelho"`
- **PNG PRETO**: resposta `"Preta"` (caso de controle que descarta alucinação por viés indutivo da pergunta)

Antes desta alteração, a ausência de `deepseek` em `PROVIDER_DEFAULT` fazia com que `modelCapabilities('deepseek', ...)` caísse no fallback `{ image: false, pdf: false }` e `capacidadeEhConhecida` retornasse `false`. Como consequência, `visaoEmVigor` em `workers/media-derive-worker.ts` gerava avisos falsos ao operador de que o modelo não suportava imagens.

### Decisão
Foi adicionada a entrada `deepseek` no dicionário `PROVIDER_DEFAULT`:
```ts
deepseek: { image: true, pdf: false },
```

1. **Objeto Literal vs `NATIVE`**:
   - `NATIVE` equivale a `{ image: true, pdf: true }`.
   - Como a medição cobriu exclusivamente imagens, e PDFs são trafegados via content part `file` (caminho de ingestão e parse distinto), afirmar `pdf: true` sem verificação prévia violaria o princípio conservador do registro ("só afirma nativo para o que sabemos que funciona").
   - Por essa razão, `pdf: false` foi mantido de forma explícita.

2. **Não inclusão em `ROTEADORES`**:
   - O conjunto `ROTEADORES` destina-se a provedores multi-fabricante (como a OpenRouter), cuja resolução de capacidades depende de extrair o fabricante a partir do prefixo do ID do modelo (`fabricante/modelo`).
   - O DeepSeek fornece infraestrutura própria e serve seus próprios modelos diretamente; portanto, não constitui um roteador.

---

## 2. Impacto em Testes Existentes

Nenhum teste existente fixava rigidamente o conjunto exato de chaves de `PROVIDER_DEFAULT` de modo a quebrar com a inclusão de `deepseek`. Portanto:
- Nenhum teste unitário precisou ser modificado, relaxado ou ignorado (`.skip`/`.only`).
- A suíte completa rodou íntegra: **791 arquivos de teste aprovados**, totalizando **8.365 testes** (8.364 aprovados, 1 falha esperada / baseline).

---

## 3. Conformidade com as Regras de Ouro

- **Arquivos alterados no produto**: Exatamente 1 (`lib/agent-engine/edge/llm/capabilities.ts`).
- **Nenhuma dependência instalada**.
- **Nenhum serviço, contêiner ou processo externo foi tocado** (nada de `docker`, `systemctl` ou `/opt`).
- **Nenhum `git commit` ou `git push` executado**, mantendo as alterações isoladas no working tree.
- **Mudanças anteriores das specs DEV-04 e DEV-05 preservadas integralmente**.
