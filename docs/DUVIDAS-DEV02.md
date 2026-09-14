# Decisões e Resoluções — SPEC-DEV-02 (Tema DR. TECHNO)

Este documento registra as decisões tomadas, justificativas técnicas e resoluções de ambiguidades durante a implementação da SPEC-DEV-02 (aplicação da identidade visual DR. TECHNO do Wellington sobre o motor DeskcommCRM).

---

## 1. Alinhamento dos Neutros à Família Slate

### Diagnóstico
A identidade visual do sistema do Wellington utiliza predominantemente a família **Slate** do Tailwind (`slate-50` a `slate-950`). O tema original do upstream utilizava uma paleta "greige" com fundo amarelado/esverdeado (`#faf9f6` / `#161510`).

### Implementação
- **Superfícies Claras (`:root` e `[data-theme="light"]`)**:
  - Fundo da página (`--color-bg`): `#f8fafc` (`slate-50`).
  - Superfície dos cartões (`--color-surface`): `#ffffff` (`white`).
  - Superfície elevada (`--color-surface-elevated`): `#f1f5f9` (`slate-100`).
  - Overlay modal (`--color-overlay`): `rgba(15, 23, 42, 0.42)` (baseado em `slate-900`).
- **Superfícies Escuras (`[data-theme="dark"]`)**:
  - Fundo da página (`--color-bg`): `#0f172a` (`slate-900`).
  - Superfície dos cartões (`--color-surface`): `#1e293b` (`slate-800`).
  - Superfície elevada (`--color-surface-elevated`): `#334155` (`slate-700`).
- **Textos e Bordas**:
  - Claro: texto principal `#0f172a` (`slate-900`), secundário `#475569` (`slate-600`), sutil `#64748b` (`slate-500`), bordas `#e2e8f0` (`slate-200`) e `#cbd5e1` (`slate-300`).
  - Escuro: texto principal `#f8fafc` (`slate-50`), secundário `#94a3b8` (`slate-400`), sutil `#64748b` (`slate-500`), bordas `#334155` (`slate-700`) e `#475569` (`slate-600`).
- **Sombras**:
  - Atualizadas para o matiz desaturado baseado em `slate-900` (`rgba(15, 23, 42, ...)`), garantindo visual limpo no tema claro e contraste adequado no escuro.

---

## 2. Ajuste Fino de `--color-accent-soft` no Tema Escuro

### Ambiguidade Encontrada
No tema escuro original, a variável `--color-accent-soft` estava definida como `rgba(130, 160, 119, 0.16)`. Com a superfície elevada em `slate-700` (`#334155`), a composição de 16% de accent sobre essa superfície gerava uma cor de fundo com razão de contraste de **2.88:1** contra o anel de foco/accent (`#82a077`), caindo abaixo do piso WCAG 1.4.11 de **3.0:1** (par `--color-accent` sobre `--color-accent-soft@--color-surface-elevated`).

### Resolução
- A opacidade foi ajustada para **0.12** (`rgba(130, 160, 119, 0.12)`).
- Com 12%, a razão de contraste sobe para **3.056:1**, superando com folga o piso de 3.0:1 em todos os pares escuros medidos.
- A semente de controle positivo (Sage `#506d48`) permanece com deslocamento 0 em ambos os temas.

---

## 3. Tipografia Inter e Guardas de Token

### Implementação
- Substituída a fonte `Atkinson_Hyperlegible` por `Inter` via `next/font/google` em `app/layout.tsx`.
- Configurado `variable: "--font-inter"` e fallbacks de sistema: `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- Injetada a variável no elemento raiz `<html>` através de `className={`${inter.variable} ${plexMono.variable}`}`.
- Adicionada a declaração `--font-inter: var(--font-inter)` em `:root` e no `@theme inline` de `app/globals.css`.
- Preservada a compatibilidade com a guarda de integridade do Tailwind 4 (`tests/unit/tailwind-tokens.test.ts`), garantindo zero tokens órfãos e passando 100% dos testes.

---

## 4. Accent Esmeralda (`#059669`) e Ausência de Cores Hardcoded

### Verificação
- A cor de marca `#059669` configurada na tabela `platform_branding` se propaga dinamicamente através de `lib/branding/rampa.ts` e `lib/branding/css.ts`, populando `--color-accent-{50..950}`, `--color-primary`, `--color-ring`, `--color-accent-soft` e `--color-accent-fg`.
- Varredura via `git grep` em `app/` e `components/` confirmou que:
  - **Nenhum** botão primário, link de navegação, anel de foco ou controle interativo utiliza classes hardcoded de accent.
  - As ocorrências existentes de `emerald-*` e `green-*` são restritas a **indicadores semânticos de estado**:
    1. Barras de SLA e marcos concluídos de solicitações LGPD.
    2. Status de campanhas ativas no Meta Ads (`ACTIVE`).
    3. Status de conexão ativa do WhatsApp e banners de saúde do sistema.
    4. Diferenciação visual de adições em diffs de prompt de agentes (estilo git diff verde/vermelho).
    5. Badges de status de MFA/2FA ativo e aprovação de templates WhatsApp.

---

## 5. Régua do Produto e Testes de Regressão

### Atualização da Régua
- `lib/branding/regua-do-produto.ts` foi regenerada executando `extrairRegua(CSS)` com o `app/globals.css` atualizado.
- `tests/unit/branding-regua-do-produto.test.ts` passou com 100% de conformidade.

### Ajuste de Asserções Literais nos Testes
- Os arquivos `tests/unit/branding-contraste.test.ts` e `tests/unit/branding-pares-pintados.test.ts` possuíam asserções fixas dos valores exatos medidos sobre a paleta greige anterior (ex: `#161510`, `5.51`, `3.79`, separação `0.0681`).
- Os valores foram atualizados para refletir as medidas exatas obtidas sobre a família Slate (ex: `#0f172a`, `5.54`, `3.82`, separação `0.1063`), mantendo todos os pares aprovados nos pisos WCAG (AA para texto 4.5:1 e componentes 3.0:1).
