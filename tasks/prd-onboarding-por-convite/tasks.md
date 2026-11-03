# Tarefas — A escola inteira entra de uma vez (F2, `onboarding-por-convite`)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

Corte de 03/11/2026 (Joaquim): e-mail, senha e conta da escola foram para a F2c (`tasks/prd-acesso-e-convites/`). Os
cenários foram distribuídos pelo `test-engineer`; cada linha do `cenarios.md` está em uma tarefa.

## Lista

- [x] **1.0 — A estrutura, a decisão e o cadastro do professor moram no core, sem mudar comportamento**
  - [x] 1.1 Commit de caracterização: mover sem mudar teste
  - [x] 1.2 `cadastro-de-professor.ts`; `contaParaConvite` no `ContaGlobalRepository`
  - [x] 1.3 Cerca por arquivo nas duas guardas, com fixture
  - [x] 1.4 Busca pelos caminhos antigos; `docs/arquitetura.md`, `docs/modelo-de-dados.md`
  - [x] 1.5 Testes: caracterização, cerca, quem contorna, alvo que some

- [x] **2.0 — O banco do F2 existe, e a turma ganha a chave que casa "8ºA" com "8A"**
  - [x] 2.1 Migration: `importacao_planilha`, `alocacao`, `evento_calendario`, `turma.chave`, `vinculo.origem`
  - [x] 2.2 `packages/shared/src/importacao/`: normalizador, cabeçalhos, contratos, `resumo` estrito (a definição do job foi para a 4.4)
  - [x] 2.3 `turma.chave` na criação e na renomeação, `CONFLITO`
  - [x] 2.4 Classificação das tabelas; modelo de dados, glossário, runbook
  - [x] 2.5 Testes: checks no banco, chave, corrida da criação

- [x] **3.0 — Desativar encerra os vínculos e revoga o convite, na ordem global**
  - [ ] 3.1 Vínculos encerrados pelo `encerrar`, turmas por id num comando
  - [ ] 3.2 Convite aberto revogado
  - [ ] 3.3 Ordem global no `desativar` e no `eliminar`
  - [ ] 3.4 `docs/lgpd.md` "Acesso da turma"
  - [ ] 3.5 Testes: ordem pelo espião, corridas com `virarSala` e `virarAno`, isolamento

- [x] **4.0 — O motor da planilha grava o calendário: prévia, gravar e job em três passos**
  - [ ] 4.1 O motor e o tipo calendário
  - [ ] 4.2 `ImportacaoRepository`; gravar refaz a prévia e fecha a `na_fila` velha
  - [ ] 4.3 Rotas de prévia e gravar, com o filtro do ano
  - [ ] 4.4 Definição do job `estrutura.gravar-planilha` e processor `gravar-planilha.ts`, tempos e métricas
  - [ ] 4.5 Auditoria `planilha.gravada`
  - [ ] 4.6 Testes: estados, job duas vezes, falha no lote, trava, isolamento, ano

- [ ] **5.0 — A importação tem limites, expira parada, e o calendário se lê**
  - [ ] 5.1 Limites (20/min, prévias simultâneas, tamanho)
  - [ ] 5.2 Expurgos de 1 h e de 90 dias
  - [ ] 5.3 `GET /v1/importacoes/:id`
  - [ ] 5.4 `GET /v1/calendario`
  - [ ] 5.5 Alertas e runbook
  - [ ] 5.6 Testes

- [ ] **6.0 — A planilha de professores cadastra a equipe e desliga só o marcado**
  - [ ] 6.1 Tipo professores
  - [ ] 6.2 Passo (1) das contas
  - [ ] 6.3 `convidar` da A1; desligar pelo `desativar`
  - [ ] 6.4 Cadastrado `pendente` e "Copiar link" na lista
  - [ ] 6.5 Testes: duas escolas, desligamento, expurgo entre o (1) e o (3)

- [ ] **7.0 — A planilha de alunos acha a turma pelo nome sujo e cria a que falta**
  - [ ] 7.1 Tipo alunos: entrada
  - [ ] 7.2 Turma e série novas, `lista_nome` nova
  - [ ] 7.3 Releitura e único violado no passo (3)
  - [ ] 7.4 Consultas constantes
  - [ ] 7.5 Testes: corridas da turma e da matrícula, teto, isolamento

- [ ] **8.0 — Reimportar a planilha de alunos atualiza sem duplicar, e a lista da turma segue a mesma regra**
  - [ ] 8.1 Já existe, nome corrigido, candidatos à marca
  - [ ] 8.2 Nome corrigido gravado e auditado; pedidos relidos
  - [ ] 8.3 A lista por turma da A1 no contrato da importação
  - [ ] 8.4 `lista.int.test.ts` reescrito onde a regra muda
  - [ ] 8.5 Testes: corridas com a aprovação

- [ ] **9.0 — A coordenação transfere o aluno pela planilha, e o pedido pendente se encerra**
  - [ ] 9.1 Transferência pelo `encerrar`
  - [ ] 9.2 `fechar('encerrada')`, também no `virarSala`
  - [ ] 9.3 Escrita condicional e `desatualizada`
  - [ ] 9.4 Auditoria
  - [ ] 9.5 Testes: corridas com a decisão e a reivindicação

- [ ] **10.0 — A coordenação desliga o aluno pela planilha, e o aprovado volta na virada do ano**
  - [ ] 10.1 Desligar o aprovado pelo `desativar`
  - [ ] 10.2 Retirar o não aprovado
  - [ ] 10.3 A volta na virada
  - [ ] 10.4 Testes: ordem global contra `desativar` e `eliminar`

- [ ] **11.0 — Gravar a grade gera a alocação e os vínculos que o professor confirma**
  - [ ] 11.1 Tipo grade: erros e avisos
  - [ ] 11.2 Alocação e vínculos pendentes
  - [ ] 11.3 O planejado só confirma em curso
  - [ ] 11.4 Releitura no passo (3)
  - [ ] 11.5 Testes

- [ ] **12.0 — Reimportar a grade a substitui sem perder o id, e a grade se lê por turma**
  - [ ] 12.1 Reimportação com id estável e "sai da grade"
  - [ ] 12.2 `GET /v1/grade`
  - [ ] 12.3 `docs/modelo-de-dados.md`
  - [ ] 12.4 Testes

- [ ] **13.0 — A coordenação sobe a planilha de alunos com prévia, na aba Turmas**
  - [ ] 13.1 Leitor CSV e XLSX no navegador
  - [ ] 13.2 `ImportarPlanilha`
  - [ ] 13.3 Na aba Turmas e na lista da turma
  - [ ] 13.4 `docs/interface.md` §3; busca pelos nomes antigos
  - [ ] 13.5 Testes

- [ ] **14.0 — Escola ganha a aba Grade e calendário**
  - [ ] 14.1 Rota e aba
  - [ ] 14.2 Modelos para baixar
  - [ ] 14.3 Importar grade e calendário
  - [ ] 14.4 Grade por turma e calendário
  - [ ] 14.5 `docs/interface.md` §3; roteiro da demonstração
  - [ ] 14.6 Testes

- [ ] **15.0 — Professores importa a planilha da equipe**
  - [ ] 15.1 "Importar professores" com marca
  - [ ] 15.2 Cadastrado `pendente` com "Copiar link"
  - [ ] 15.3 `docs/interface.md` §3
  - [ ] 15.4 Testes

- [ ] **16.0 — A escola inteira entra de uma vez, provada de ponta a ponta e sob carga**
  - [ ] 16.1 E2E do RF18
  - [ ] 16.2 O modelo servido entra sem erro
  - [ ] 16.3 Cenário k6
  - [ ] 16.4 Roteiro da demonstração conferido
  - [ ] 16.5 Testes

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | 3.0 |
| 3.0 | 1.0 | 2.0, 4.0 |
| 4.0 | 2.0 | 3.0 |
| 5.0 | 4.0 | 6.0, 7.0, 8.0 |
| 6.0 | 3.0, 4.0 | 5.0, 8.0, 9.0 |
| 7.0 | 4.0 | 5.0 |
| 8.0 | 7.0 | 5.0, 6.0 |
| 9.0 | 8.0 | 6.0 |
| 10.0 | 3.0, 9.0 | 11.0 |
| 11.0 | 6.0, 7.0 | 10.0, 13.0 |
| 12.0 | 5.0, 11.0 | 13.0, 15.0 |
| 13.0 | 10.0 | 11.0, 12.0 |
| 14.0 | 12.0, 13.0 | 15.0 |
| 15.0 | 6.0, 13.0 | 12.0, 14.0 |
| 16.0 | 14.0, 15.0 | — |

## Subagentes por tarefa

`test-engineer` e `revisor-geral` em todas, implícitos.

| Tarefa | Subagentes obrigatórios | Porte |
|---|---|---|
| 1.0 | `tenancy-guardian` | grande |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 3.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 4.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 5.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 6.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 7.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 8.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 9.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 10.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 11.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 12.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 13.0 | `privacy-guardian`, `frontend-reviewer` | grande |
| 14.0 | `frontend-reviewer` | grande |
| 15.0 | `frontend-reviewer` | pequeno |
| 16.0 | `infra-guardian`, `frontend-reviewer` | grande |

## Critério de pronto da funcionalidade

Do `ROADMAP.md`, F2: uma escola inteira entra sem ninguém ser cadastrado individualmente, professor incluído; a grade e o
calendário importados geram a alocação; e a reimportação não duplica nem tira ninguém sozinha. Em detalhe:

- RF1 a RF10 e RF15 a RF18 do `prd.md`, cada um com o teste da coluna "Como se prova", RF a RF na validação
- Todo cenário do `cenarios.md` com caso na coluna "Caso" de alguma tarefa
- O [C] do RF2 verde: p95 até 2 s na prévia e no gravar; zero 503 no login, no gerar acesso e na decisão com o job
  rodando; passo (3) abaixo de 1 s. Falhando, a spec volta à revisão (`techspec.md` §13)
- `docs/interface.md` §3, `docs/modelo-de-dados.md`, o glossário, o `docs/lgpd.md` e o `docs/runbook.md` dizem o que o
  código faz; o `docs/roteiro-da-demonstracao.md` conferido contra o spec dele (14.0, 16.0)
- A esteira verde no último commit que alterou código
