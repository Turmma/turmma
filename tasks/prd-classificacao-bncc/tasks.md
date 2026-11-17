# Tarefas — classificacao-bncc (F4b)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — A tabela da BNCC existe, carregada do `bncc-dados`, e a disciplina tem o componente**
  - [x] 1.1 Migration de `habilidade_bncc`, com o check do código e a carga versionada, sem Computação
  - [x] 1.2 A conferência de 30 habilidades e das contagens contra o PDF homologado, com o hash
  - [x] 1.3 `COMPONENTES_BNCC` e as candidatas por série e componente em `packages/shared`
  - [x] 1.4 `disciplina.componente_bncc`, casado pelo nome na migration e no `criar`
  - [x] 1.5 `PATCH /v1/disciplinas/:id` com `componenteBncc` e `disciplina.componente_alterado`
  - [x] 1.6 A Estrutura mostra e define o componente; a Parte A no `docs/interface.md`
  - [x] 1.7 `docs/modelo-de-dados.md` (tabela pública), a D65 no `TODO.md`
  - [x] 1.8 Testes: carga idempotente, check, candidatas, casamento, `PATCH`, isolamento, estados da tela

- [x] **2.0 — O material ganha seções na extração, os prontos de antes também, e a edição nova herda a correção**
  - [x] 2.1 Migration de `secao_do_material` e `habilidade_da_secao`, o `unique` do capítulo e os índices da §7c
  - [x] 2.2 As seções na transação da extração (capítulo, ou bloco de 10 páginas)
  - [x] 2.3 A migration (2): seções dos `pronto`, em lotes de 1.000, sem execução
  - [x] 2.4 A herança da correção na edição nova, com `material.classificacao_herdada`
  - [x] 2.5 `docs/lgpd.md` e `docs/modelo-de-dados.md`; `corrigida_por` em `fora` no arquivo do titular
  - [x] 2.6 Testes: seções, reentrega, backfill, herança, eliminação do titular, isolamento

- [ ] **3.0 — A função `classificacao_do_material` existe e é suspensível, e a tarefa `classificar_secoes` tem prompt, saída e medidor**
  - [ ] 3.1 A tarefa e a função em `packages/shared`, com `fazSozinha` e `esperaAprovacao`
  - [ ] 3.2 Os checks de `execucao_agente` com `NOT VALID` e `VALIDATE`, e o ano nulo só nesta tarefa
  - [ ] 3.3 A tarefa no `packages/core`: prompt versionado, saída estrita, `levaTextoDeAluno: false`, o `falso`
  - [ ] 3.4 `tools/ia/medir-classificacao.ts`, provado com fixture própria
  - [ ] 3.5 A AIA revista; a conferência do lote retido pelo professor no `TODO.md`
  - [ ] 3.6 Testes: sondas de saída (c1), prompt, checks, governança, medidor

- [ ] **4.0 — A classificação roda no worker, fora da janela letiva, e grava as habilidades da seção**
  - [ ] 4.1 O job `ia.executar-lote` na fila `lote`, com a vaga por escola
  - [ ] 4.2 O processador com `quemPediu` ausente só em `daRotina`, a janela e a suspensão
  - [ ] 4.3 O comando: `preparar` só com seções vivas, `concluir` com as releituras
  - [ ] 4.4 A degradação do lote e `falhas_seguidas`
  - [ ] 4.5 Consumo, métrica e log
  - [ ] 4.6 Testes: caminho feliz, janela, balde e disjuntor, reentrega, P1a, P4, P4b

- [ ] **5.0 — A classificação é agendada na extração e às 19h, e o atraso vira alerta**
  - [ ] 5.1 As execuções e os jobs na extração
  - [ ] 5.2 O job `material.agendar-classificacao` e a rotina das 19h
  - [ ] 5.3 A seção com falha numa execução só dela; o laço em lotes de 500
  - [ ] 5.4 O alerta `classificacao-atrasada` e o runbook
  - [ ] 5.5 A carga das 300 apostilas, rodada
  - [ ] 5.6 Testes: rotina, o teto de 3, laço, P9 (rotina × rotina), alerta, carga

- [ ] **6.0 — A mudança de recorte limpa e agenda de novo**
  - [ ] 6.1 Os dois `PATCH` (componente e séries) só enfileiram o job
  - [ ] 6.2 O job decide pelo recorte atual e limpa; a corrigida fica
  - [ ] 6.3 O `preparar` sem candidatas limpa só a própria seção
  - [ ] 6.4 Testes: recorte, componente apagado, suspensa, P9 (rotina × `PATCH`), P10a, P10b, P11

- [ ] **7.0 — A coordenação lê, corrige e manda reclassificar pela API, e a operação reclassifica uma escola (D76)**
  - [ ] 7.1 `GET /v1/materiais/:id` com `secoes[]` e `classificacaoSuspensa`
  - [ ] 7.2 `GET /v1/habilidades-bncc`
  - [ ] 7.3 `PUT …/secoes/:secaoId/habilidades`; o `for update` na seção no `concluir`
  - [ ] 7.4 `POST …/reclassificar` e o comando `reclassificar-escola`, com chamado
  - [ ] 7.5 Os tetos e as ações de auditoria
  - [ ] 7.6 Testes: correção, recusas, tetos, isolamento, P1b, P2, P3, P5, P9 (rotina × reclassificar)

- [ ] **8.0 — O painel do material mostra a classificação por capítulo, corrige com o seletor e pede a reclassificação**
  - [ ] 8.1 As habilidades no painel: rótulos, origem, avisos
  - [ ] 8.2 O seletor de habilidades (peça que a 11.0 reaproveita)
  - [ ] 8.3 Corrigir e reclassificar, com a confirmação
  - [ ] 8.4 A Parte A do painel no `docs/interface.md`
  - [ ] 8.5 Testes: estados, rótulos, avisos, teclado, 360 px, recomeço

- [ ] **9.0 — A contração da F4: o check titularidade e licença vale, e os checks e o código de `material.licenciante` saem**
  - [ ] 9.1 O backfill de séries e licenças de novo, idempotente
  - [ ] 9.2 O check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com `NOT VALID` e `VALIDATE`
  - [ ] 9.3 Saem os checks de `licenciante`; o código não lê nem grava a coluna
  - [ ] 9.4 O `DROP COLUMN` no `TODO.md`; `docs/modelo-de-dados.md`
  - [ ] 9.5 Testes

- [ ] **10.0 — A geração usa a BNCC da seção citada, e o catálogo próprio sai**
  - [ ] 10.1 A busca devolve, com cada trecho, as habilidades da seção da página, pelo recorte atual
  - [ ] 10.2 Atividade, plano, adaptação e chat escolhem uma da página ou nenhuma; a de fora é anulada
  - [ ] 10.3 O Tutor não recebe; sai o catálogo; `null` no diagnóstico; a leitura aceita o código antigo (D82)
  - [ ] 10.4 O passo 1 do roteiro ganha a correção do capítulo pelo painel
  - [ ] 10.5 Testes

- [ ] **11.0 — O professor troca a habilidade da questão no artefato, com a trava que aplicar e adaptar também tomam**
  - [ ] 11.1 `PATCH /v1/artefatos/:id/questoes/:indice/habilidade`
  - [ ] 11.2 Aplicar e adaptar tomam o `for update` no artefato
  - [ ] 11.3 A tela do artefato: a habilidade com o capítulo e "Trocar"; a Parte A no `docs/interface.md`
  - [ ] 11.4 Testes: recusas, P6a, P6b, P7, P8, isolamento, estados, recomeço

- [ ] **12.0 — "Sem habilidade" em Turmas, no aluno e no Analista, e o fluxo inteiro passa no e2e**
  - [ ] 12.1 A linha "Sem habilidade", com a explicação, nas três leituras
  - [ ] 12.2 A Parte A das três telas no `docs/interface.md`
  - [ ] 12.3 O e2e do fluxo: a coordenação corrige, o professor gera, troca e aplica, e Turmas mostra a trocada
  - [ ] 12.4 O roteiro conferido de novo
  - [ ] 12.5 Testes

- [ ] **13.0 — A coordenação vê, por série, as habilidades sem material**
  - [ ] 13.1 `GET /v1/materiais/cobertura`, antes de `:id`
  - [ ] 13.2 A aba Cobertura em Material; a Parte A no `docs/interface.md`
  - [ ] 13.3 Testes: filtro da F4, ano do bloco, área, suspensão, isolamento, `EXPLAIN`

## Dependências e paralelismo

Quase toda tarefa tem migration ou mexe em `packages/shared`, e essas vão uma de cada vez, nesta ordem. Correm ao lado:
a 8.0 com a 9.0 (a 8.0 só mexe em `apps/web`, `e2e/` e `docs/interface.md`); a 12.0 com a 13.0 (a 12.0 não tem
`packages/shared` nem migration).

**Entre a 3.0 e a 10.0, o Arquiteto** escreve o lote retido (`docs/aia/ouro-retido/classificacao-retido-1.json`, por
subagente em contexto limpo, revisto pelo `pedagogia-reviewer` e pelo `conformidade-reviewer`, num commit só de documento no
andar). Depois mede com `tools/ia/medir-classificacao.ts`, com o modelo local e o da produção (Tech Spec §7b), e registra no
`RETIDOS.json`. A 10.0 só parte com a medida registrada; se a taxa não estiver no `padrao`, a decisão é do Joaquim. Quem
implementa da 3.0 em diante não abre `docs/aia/ouro-retido/`.

O `for update` na seção, no `concluir` da 4.0, entra na 7.0, junto com o `PUT` que o disputa (P1b).

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | — |
| 3.0 | 2.0 | — |
| 4.0 | 3.0 | — |
| 5.0 | 4.0 | — |
| 6.0 | 5.0 | — |
| 7.0 | 6.0 | — |
| 8.0 | 7.0 | 9.0 |
| 9.0 | 7.0 | 8.0 |
| 10.0 | 8.0, 9.0, a medida do Arquiteto | — |
| 11.0 | 10.0 | — |
| 12.0 | 11.0 | 13.0 |
| 13.0 | 11.0 | 12.0 |

## Subagentes por tarefa

`test-engineer` e `revisor-geral` em todas.

| Tarefa | Subagentes obrigatórios | Porte |
|---|---|---|
| 1.0 | `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`, `domain-researcher` | grande |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 3.0 | `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer` | grande |
| 4.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `llm-integrator` | grande |
| 5.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian` | grande |
| 6.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian` | grande |
| 7.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 8.0 | `frontend-reviewer`, `conformidade-reviewer` | grande |
| 9.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 10.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer` | grande |
| 11.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer` | grande |
| 12.0 | `conformidade-reviewer`, `privacy-guardian`, `frontend-reviewer` | grande |
| 13.0 | `tenancy-guardian`, `infra-guardian`, `frontend-reviewer` | grande |

## Critério de pronto da funcionalidade

Do `ROADMAP.md`, F4b: o material é classificado por habilidade da BNCC e a geração usa isso; a coordenação corrige e a
correção vence; e a coordenação vê as habilidades da série sem material. Em detalhe:

- A tabela pública da BNCC carregada, conferida contra o PDF homologado, e o catálogo próprio fora do código e do seed
  (RF1, RF2)
- Cada capítulo (ou bloco de 10 páginas) classificado à noite, no worker, fora da janela letiva. Valem o teto de três
  noites, a degradação do lote e o alerta `classificacao-atrasada` com runbook. As 300 apostilas cabem numa noite, com a
  corrida da carga registrada (RF5, RF15)
- A mudança de recorte limpa a classificação da IA e agenda de novo; a corrigida fica (RF5, RF19)
- A correção da coordenação vence a IA, inclusive na edição nova; reclassificar e o comando D76 não a tocam (RF6, RF12)
- A questão gerada tem uma habilidade da seção da página citada, ou nenhuma; o professor a troca antes de aplicar; o
  Tutor não recebe a habilidade da seção (RF7, RF9)
- A cobertura por série e componente (área, no EM), com o filtro de material da F4 (RF19)
- A função `classificacao_do_material` em "Como cada IA trabalha", suspensível, com a AIA revista e a taxa medida no lote
  retido antes da 10.0 (regra 70, itens 5 e 6a)
- Nada de uma escola aparece para outra, com teste de isolamento efetivo por endpoint e repository (RF20)
- A contração da F4 feita (9.0), com o `DROP COLUMN` de `material.licenciante` no `TODO.md`
- `docs/modelo-de-dados.md`, `docs/lgpd.md`, `docs/runbook.md`, `docs/interface.md` e a AIA atualizados nas tarefas que
  os mudam
- O passo 1 do `docs/roteiro-da-demonstracao.md` (a correção do capítulo) conferido contra
  `e2e/roteiro-da-demonstracao.spec.ts` na 10.0, que muda a geração, e de novo na 12.0, que fecha o fluxo
