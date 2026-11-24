# Tarefas — Avaliação e correção (prova online)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md` · **Revisão da spec:** `revisao-spec.md` (aprovada, rodada 4)
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — Migration da prova online; aplicar com janela, duração, embaralhar e tempo adicional; mudar a janela**
  - [x] 1.1 Migration `0068_prova_online` e schema Drizzle (techspec §3)
  - [x] 1.2 Contratos de todas as rotas da §4 e a matriz de permissão
  - [x] 1.3 Classificação, expurgo e as exceções do `architecture.test.ts`
  - [x] 1.4 Aplicar com janela, duração, embaralhar e tempo adicional
  - [x] 1.5 PATCH parcial da janela
  - [x] 1.6 Testes: RF1 a RF3 do professor, corridas (b) e (k), isolamento, schema, expurgo, titular

- [x] **2.0 — Pulso da API, indisponibilidade, `limiteDaTentativa` e o 503 das rotas de prova**
  - [x] 2.1 `limiteDaTentativa` pura, com a lacuna aberta
  - [x] 2.2 O pulso numa instrução, com conexão própria, antes do `listen`
  - [x] 2.3 A recusa das rotas de prova com o pulso parado
  - [x] 2.4 Pulso e indisponibilidades lidos numa consulta
  - [x] 2.5 Expurgo da indisponibilidade aos 13 meses; alerta e runbook
  - [x] 2.6 Testes: RF6 do pulso, corrida (g)

- [ ] **3.0 — O aluno começa e responde dentro do limite**
  - [ ] 3.1 Alcance, janela e limite, nessa ordem
  - [ ] 3.2 `comecar`; `prova` sem gravar; `tempo`
  - [ ] 3.3 PUT e envio no limite; `minhas-atividades` com janela
  - [ ] 3.4 A tela de atividade de hoje chama `comecar`
  - [ ] 3.5 Testes: RF1, RF5, RF6 por chamador, RF7 (API), corridas (a) e (b), §1b do aluno

- [ ] **4.0 — Embaralhamento por aluno, mantido na retomada, corrigido pela ordem original**
  - [ ] 4.1 Sorteador injetável; `ordem` gravada no começo; a prova na ordem do aluno
  - [ ] 4.2 Testes: RF8

- [ ] **5.0 — O professor estende o tempo e acompanha quem está fazendo**
  - [ ] 5.1 `extensoes` com chave; `acompanhamento` numa consulta
  - [ ] 5.2 Testes: RF4, corrida (d), §1b do professor

- [ ] **6.0 — A rotina encerra a prova vencida no fim efetivo, e não durante uma queda**
  - [ ] 6.1 `sistema.encerrar-provas-vencidas` e `atividade.encerrar-vencidas`
  - [ ] 6.2 `encerrarPeloLimite`
  - [ ] 6.3 Alertas (prova aberta além do fim efetivo; p95 do PUT) e runbook
  - [ ] 6.4 Etapa 1 da AIA
  - [ ] 6.5 Carga `prova-online.js`
  - [ ] 6.6 Testes: §2 da rotina, corridas (c), (e), (f), (j), (l)

- [ ] **7.0 — Tutor travado por aluno até o fim da janela ou o limite dele**
  - [ ] 7.1 `avaliativaAberta` por aluno, com `limiteDaTentativa`, e o convocado
  - [ ] 7.2 Testes: §2 do Tutor, RF6 do Tutor

- [ ] **8.0 — Saída da aba registrada sem contar duas vezes, e mostrada só no lote**
  - [ ] 8.1 `saidas-da-aba`; `saidasDaAba` na correção; a marca na validação
  - [ ] 8.2 Coluna "Saiu da aba" no Aprovar, com o aviso fixo; `docs/interface.md` §1.6
  - [ ] 8.3 Testes: RF9, corrida (i)

- [ ] **9.0 — Segunda chamada para quem não enviou, com lote próprio**
  - [ ] 9.1 `segunda-chamada`; convocados; `minhas-atividades` e alcance pelo convocado
  - [ ] 9.2 Testes: RF10, corrida (h)

- [x] **10.0 — Tela de aplicar a prova; a API passa a exigir a janela**
  - [x] 10.1 `AplicacaoDoArtefato.tsx` com janela, duração, embaralhar, tempo adicional e resumo; "Mudar janela"
  - [x] 10.2 A janela obrigatória na avaliativa nova; roteiro da demonstração
  - [x] 10.3 Testes: §4 Aplicar e Mudar janela

- [ ] **11.0 — Painel "Acompanhar" e o e2e do professor**
  - [ ] 11.1 Acompanhar, Estender, Segunda chamada e Encerrar com quantos fazem
  - [ ] 11.2 Testes: §4 Acompanhar, Estender, Segunda chamada, Encerrar; `professor-prova.spec.ts`

- [ ] **12.0 — Tela do aluno: "Antes de começar" e a prova em foco**
  - [ ] 12.1 Atividades e "Antes de começar"
  - [ ] 12.2 `/aluno/prova/:id` fora da casca; relógio do servidor
  - [ ] 12.3 Fila de respostas no app
  - [ ] 12.4 Fila de saídas em série
  - [ ] 12.5 Acessibilidade e os textos de erro
  - [ ] 12.6 Roteiro da demonstração; `docs/interface.md` §2
  - [ ] 12.7 Testes: RF6 e RF7 da tela, §4 do aluno; `aluno-prova.spec.ts`

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | 10.0 |
| 3.0 | 2.0 | 5.0, 7.0, 10.0 |
| 4.0 | 3.0 | 5.0, 7.0, 10.0 |
| 5.0 | 2.0 | 3.0, 4.0, 7.0, 10.0 |
| 6.0 | 3.0, 5.0 | 7.0, 8.0, 10.0 |
| 7.0 | 2.0 | 3.0, 4.0, 5.0, 6.0, 8.0, 9.0, 10.0 |
| 8.0 | 4.0 | 6.0, 7.0, 10.0 |
| 9.0 | 5.0, 8.0 | 6.0, 7.0, 10.0 |
| 10.0 | 1.0 | 2.0 a 9.0 |
| 11.0 | 5.0, 8.0, 9.0, 10.0 | 12.0 |
| 12.0 | 3.0, 4.0, 8.0 | 11.0 |

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` |
| 2.0 | `infra-guardian`, `tenancy-guardian` |
| 3.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` |
| 4.0 | `tenancy-guardian`, `conformidade-reviewer` |
| 5.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` |
| 6.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian` |
| 7.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian` |
| 8.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer` |
| 9.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian` |
| 10.0 | `privacy-guardian`, `frontend-reviewer` |
| 11.0 | `privacy-guardian`, `frontend-reviewer` |
| 12.0 | `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer` |

`test-engineer` e `revisor-geral` em todas.

## Critério de pronto da funcionalidade

Do `ROADMAP.md` (F6), detalhado:

- A prova online tem janela e duração no relógio do servidor; quem começa tarde tem só o que sobra (RF1, RF2)
- O tempo adicional por aluno vale só para quem foi marcado, sem motivo, e é dado sensível tratado como adaptação (RF3)
- O professor estende o tempo de um aluno ou da turma, inclusive além da janela (RF4)
- No limite a tentativa é enviada com o que foi salvo; a prova vencida encerra sozinha e o lote nasce pendente (RF5)
- Nenhuma resposta se perde com a rede da escola caindo; a queda do nosso sistema devolve o tempo e não encerra
  prova (RF6; regra 80, item 6), medido na carga `prova-online.js`
- A prova abre na tela de foco, sem navegação nem Tutor, com o aviso antes e a saída de um clique (RF7)
- Questões e alternativas embaralhadas por aluno, corrigidas pela ordem original (RF8)
- A saída da aba conta por tentativa, aparece só no lote, com o aviso fixo aprovado pelo Joaquim (RF9)
- A segunda chamada reabre para quem não enviou, com lote próprio (RF10)
- O Tutor fica travado para cada aluno até o fim da prova dele
- O roteiro da demonstração (aplicar como avaliativa; o aluno fazendo a prova) conferido contra
  `e2e/roteiro-da-demonstracao.spec.ts` na 10.0 e na 12.0
- A etapa 1 da AIA de correção de objetiva atualizada (6.0)
