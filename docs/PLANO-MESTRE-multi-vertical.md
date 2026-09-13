# PLANO MESTRE — CRM multi-vertical com prospecção e agentes de IA

> Redigido em 13/Set/2026 a partir da visão do Wellington (textual): *"um sistema que tem
> como falar com cliente o meio WhatsApp, mas tenha as linhas de frente de prospecção de
> clientes — podendo ser de qualquer frente de linha —, que tenha os agentes pra conquistar
> clientes e atendimento automatizado pra conquistar e manter cliente; mas quero que atenda
> empresa de transporte, uma gráfica, uma empresa de atendimento de TI, empresa de
> atendimento de segurança eletrônica. Tipo, quero um CRM também pra cada área, e que seja
> definido o setup. Aí você fez o meu, que achei bonito e intuitivo, e tem esse deles que
> pode ser funcional mas feio. Agora queria, com esse outro, uma engenharia reversa pra
> fazer o meu — isso sim."*

## A visão, destrinchada

| # | O que ele quer | Tradução técnica |
|---|---|---|
| 1 | Falar com o cliente pelo WhatsApp | canal (hoje: **Cloud API oficial da Meta**, já nativo) |
| 2 | **Linhas de frente de prospecção**, de qualquer frente | motor de prospecção com **conectores por fonte** (licitação, diretório, mapa, CNAE) |
| 3 | **Agentes para conquistar** clientes | agente de **outbound** (SDR) com abordagem, follow-up e qualificação |
| 4 | **Atendimento automatizado** para conquistar e **manter** | agente de **inbound** + pós-venda/retenção, com handoff humano |
| 5 | Atender **transporte, gráfica, TI, segurança eletrônica** | **multi-vertical de verdade** — não um produto que "serve pra tudo" na promessa |
| 6 | **Um CRM por área, com o setup definido** | **pacotes de vertical**: funil, vocabulário, campos, agentes, templates, fontes de prospecção |
| 7 | O meu é **bonito e intuitivo**; o deles é **funcional mas feio** | **a pele é dele, o cérebro é do fork** |
| 8 | Fazer o meu **por engenharia reversa** do outro | extrair os **mecanismos** do fork e dirigi-los — **não** reler 487k linhas à mão |

## 🔑 O achado que muda o prazo: a engenharia reversa já está meio feita

Auditei o fork procurando o que a visão dele exige. **Os mecanismos já existem** — o que
falta é conteúdo e pele, não arquitetura:

| O que ele pediu | O que o fork já tem | Onde |
|---|---|---|
| **Setup definido por área** | ✅ **`PacoteDeFunil`** — interface + array `PACOTES` com pacotes prontos (`clinica`, `imobiliaria`, `servicos`…) e **48 entradas** no arquivo. Cada pacote traz o nome do funil **e o mapeamento de cada etapa** para o passo canônico (`new → contacted → qualifying → qualified → negotiating → won/lost`) | `lib/onboarding/pacotes-de-funil.ts` |
| **CRM diferente por área** | ✅ **`vocabulary` por pipeline** (jsonb no banco): renomeia *lead/deal/won/lost/etapa* por funil — é o que permite o mesmo core servir clínica, imobiliária e e-commerce sem refactor | `supabase/baseline.sql:1486`, `lib/schemas/settings.ts:161` |
| **Bonito, com a minha cara** | ✅ **Tema resolvido do BANCO em runtime**: `platform_branding` guarda `app_name, logo_url, logo_path, **accent_hex**, show_powered_by`. O CSS emite `--color-brand` e a rampa `--color-accent-{50..950}`, `-fg`, `-hover`, `-soft` | `lib/branding/{instalacao,css,contraste}.ts`, `app/globals.css` |
| **Prospecção** | ✅ rota de UI **`/app/radar`** já existe (ponto de entrada para o motor) | `app/app/radar/` |
| **Agentes de IA** | ✅ runtime de agente, RAG (pgvector), guardrails, MCP, RAG por tenant, sentimento→handoff | `lib/agent-engine/`, `lib/ai/`, `lib/mcp/` |
| **Atender e manter** | ✅ inbox multi-atendente, funil/kanban, follow-up, agenda, tarefas, pós-venda | `app/app/{inbox,crm,kanban,pipeline,agenda,tasks}` |

**Conclusão honesta:** o fork **não é um concorrente do "meu"** — é o **motor** dele. Ele já
resolve *multi-nicho por design* (está escrito na doutrina: *"o mesmo core serve e-commerce,
clínica, imobiliária, infoproduto"*, e o roadmap deles promete *"templates prontos por nicho"*).
O que eles **não** têm é: as **nossas 4 verticais**, a **nossa pele**, as **nossas fontes de
prospecção** e o **nosso domínio de frete**.

## 🎯 A decisão de arquitetura (minha recomendação como sócio)

**Não reler 487 mil linhas para reescrever em Express+SQLite.** Isso custaria meses e
devolveria um produto *menos* capaz — o nosso F1 tem 4 tabelas; o fork tem 130, com RLS,
LGPD, RAG e fila.

**O caminho que entrega a visão dele:**

```
   CÉREBRO (fork, Java/TS)                 PELE (a dele, bonita)
   ┌──────────────────────────┐            ┌─────────────────────┐
   │ agente + RAG + RLS       │            │ design system       │
   │ inbox + funil + LGPD     │  ◄── API ──│ "Apple Pro Mid-Grey"│
   │ workers + fila + MCP     │            │ + os 4 verticais    │
   └──────────────────────────┘            └─────────────────────┘
        já existe, testado                   é o que falta fazer
```

Em outras palavras: a **engenharia reversa** se faz **nos mecanismos** — `PacoteDeFunil`,
`vocabulary`, `platform_branding`, `radar` —, e a partir deles a gente **dirige** o produto
para as 4 verticais e aplica a nossa cara. Reescrever o core seria refazer o trabalho de 2.133
estrelas para chegar no mesmo lugar, mais feio por dentro.

> Se ele preferir o caminho do rewrite mesmo assim, é decisão dele e eu executo — mas
> registro aqui, por escrito, que o custo estimado é **meses** de desenvolvimento do agy contra
> **semanas** deste caminho, com menos capacidade no fim. Isso é o que um sócio deve dizer.

## 🧩 As 4 verticais — o "setup definido" de cada uma

Cada vertical = **1 pacote de funil + vocabulário + campos + agentes + fontes de prospecção +
templates**. A tabela abaixo é a especificação do conteúdo:

### 1. 🚛 Transporte / logística

| Item | Definição |
|---|---|
| **Funil** | "Cargas e contratos": Novo contato · Já respondi · Levantando carga x veículo · Cotação enviada · Negociando valor/prazo · **Frete fechado** · Perdido |
| **Vocabulário** | lead = *Embarcador* / deal = *Frete* / won = *Fechado* |
| **Campos** | CNPJ, origem→destino, tipo de carga (seca/refrigerada/granel), peso, veículo (truck/carreta/bitrem), valor do frete, RNTRC, seguro, prazo de pagamento |
| **Agentes** | inbound (cotação 24/7), outbound (retomar embarcador parado), documento (CIOT **fora** — homologação adiada) |
| **Prospecção** | **PNCP** (licitação de frete) · **ANTT RNTRC** (transportadoras por cidade) · Fretebras · SETCESP |
| **Diferencial** | é a única vertical onde já temos domínio e sistema (FreteRodovar) |

### 2. 🖨️ Gráfica / impressão

| Item | Definição |
|---|---|
| **Funil** | "Orçamentos gráficos": Pedido novo · Já respondi · Levantando especificação · Orçamento enviado · Aprovando arte/prova · **Produção iniciada** · Perdido |
| **Vocabulário** | lead = *Cliente* / deal = *Orçamento* / won = *Aprovado* |
| **Campos** | material (offset/digital/laser), tiragem, formato, cores (4x0/4x4), papel, acabamento (laminação, dobra, corte), prazo, arte enviada (arquivo no Storage) |
| **Agentes** | inbound (recebe PDF/arte e faz a pré-triagem), orçamento assistido, retomada de orçamento frio |
| **Prospecção** | **PNCP** — *material gráfico é item constante em licitação* · sindicatos gráficos · Google Maps por cidade · CNAE 18xx (impressão) |
| **Gancho** | casa com a impressão 3D dele — mesma lógica de produção sob demanda |

### 3. 💻 TI / suporte e sistemas

| Item | Definição |
|---|---|
| **Funil** | "Negócios de TI": Novo contato · Já respondi · Diagnóstico/escopo · Proposta enviada · Negociando SLA · **Contrato/serviço fechado** · Perdido |
| **Vocabulário** | lead = *Empresa* / deal = *Serviço* ou *Contrato* / won = *Fechado* |
| **Campos** | nº de máquinas/usuários, servidores, nuvem, sistemas usados, tipo (suporte mensal / projeto / licenciamento), SLA, valor/hora, contrato recorrente |
| **Agentes** | inbound (triagem de chamado → chamado no Nexus), outbound (renovação de contrato, upsell), proposta |
| **Prospecção** | **PNCP** (licença de software e equipamento TIC — *já achamos um de R$ 4,3 mi*) · CNAE 62xx · Google Maps · diretórios · **e a própria prospecção PNCP que já está rodando** |
| **Gancho** | é a área da DR. TECHNO hoje — vira o **caso de uso nº 1** |

### 4. 📹 Segurança eletrônica

| Item | Definição |
|---|---|
| **Funil** | "Projetos de segurança": Contato novo · Já respondi · Levantamento no local · Projeto/orçamento enviado · Aprovando escopo · **Instalação agendada** · Perdido |
| **Vocabulário** | lead = *Condomínio/Empresa* / deal = *Projeto* / won = *Instalado* |
| **Campos** | tipo (CFTV, alarme, controle de acesso, cerca elétrica), nº de câmeras, pontos, IP/analógico, gravador (NVR/DVR), storage, manutenção mensal |
| **Agentes** | inbound (orçamento por tipo de imóvel), pós-venda (manutenção preventiva), outbound (condomínios novos, obras) |
| **Prospecção** | **PNCP** (*já achamos "rastreamento/telemetria" e equipamentos*) · **ABESE** (associação do setor) · CNAE 80xx · Google Maps · construtoras/condomínios |
| **Gancho** | casa com CFTV que ele já tem no .152 |

### 🌐 O que é comum às 4 (e é o pulo do gato)

**PNCP serve as QUATRO verticais** — muda só o filtro (palavra-chave + CNAE + UF). Ou seja: o
motor de prospecção é **um só**, com **perfis por vertical**. Isso evita construir 4 robôs.
O script de prospecção já validado (`~/.hermes/scripts/prospeccao-pncp.py`, cron semanal,
trata HTTP 429) vira a **primeira fonte plugada no `/app/radar`**.

## 🗺️ Mapa de engenharia reversa (o que fazer com cada módulo)

| Módulo do fork | Veredito | Ação |
|---|---|---|
| agente de IA + RAG + guardrails + MCP | **APROVEITAR** | fica; viram agentes das verticais |
| multi-tenant + RLS + LGPD | **APROVEITAR** | fica; é o que permite vender pra várias empresas |
| inbox, funil, kanban, contatos, agenda, tarefas | **APROVEITAR** | fica; recebe o vocabulário da vertical |
| `PacoteDeFunil` + `vocabulary` | **ESTENDER** | **+4 pacotes** (transporte, gráfica, TI, segurança) |
| `platform_branding` (accent/logo/nome) | **DIRIGIR** | aplicar a identidade DR. TECHNO + a paleta dele |
| UI (Next + Tailwind + shadcn) | **RE-TEMATIZAR** | CSS variables + componentes shadcn: mesma base, pele nova |
| `/app/radar` | **IMPLEMENTAR** | plugar as fontes de prospecção (PNCP primeiro) |
| `lib/waha/` + adaptador WAHA | **DESCARTAR** | canal não-oficial; usamos `lib/channels/meta` |
| wacalls (voz) | **DESCARTAR** | risco de bloqueio do número; fora do escopo |
| billing (era stub) | **REESCREVER** | plugar no `ai-controller` do .152 (mede consumo real) |
| Nuvemshop / e-commerce | **NEUTRO** | manter como vertical de origem, não é prioridade nossa |

## 📋 Plano de execução (dev → agy, spec → validação → commit)

| Fase | Entrega | Depende de |
|---|---|---|
| **DEV-01** ✅ | canal oficial da Meta como canal de primeira classe (spec escrita e despachada ao agy) | — |
| **DEV-02** | **tema DR. TECHNO** — aplicar paleta/identidade via `platform_branding`, sem tocar no core | agy |
| **DEV-03** | **4 pacotes de vertical** em `pacotes-de-funil.ts` + vocabulários + campos por vertical | DEV-02 |
| **DEV-04** | **`/app/radar`** com o primeiro conector: **PNCP** (perfis por vertical, CNAE + palavra-chave + UF) | DEV-03 |
| **DEV-05** | agentes por vertical (prompt/objetivo/base de conhecimento por pacote) | DEV-03 |
| **DEV-06** | **billing** ligado ao `ai-controller` (consumo de IA por tenant) | DEV-04 |
| **DEV-07** | conector **RNTRC/ANTT** + CNAE/Receita para enriquecer e achar o decisor | DEV-04 |
| **DEV-08** | piloto real: **TI/DR. TECHNO** (é a área dele) → depois transporte (Rodovar) | DEV-05 |

## Decisões que dependem do Wellington

1. **Nome do produto** (D3) — hoje há dois sistemas com o mesmo nome "ZapFrete"
2. **O caminho**: cérebro do fork + pele dele (**recomendado**) × rewrite do zero (meses)
3. **Qual vertical vira piloto** (sugiro **TI/DR. TECHNO** — é a operação dele, ciclo curto)
4. **Domínio**: unificar em `crm.dedoxx.com.br` (ou manter um por vertical?)
