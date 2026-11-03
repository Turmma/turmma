# Tarefa 7.0 — A planilha de alunos acha a turma pelo nome sujo e cria a que falta

**Funcionalidade:** onboarding-por-convite · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de alunos casa "8ºA", "8 A" e "8a" com a mesma turma pela `chave`, cria a turma nova na série certa, e grava
a `lista_nome` de quem entra; com erro na linha, nada grava.

## Contexto necessário

- `techspec.md` §3 (`turma.chave`), §5 "Planilha", "O job" passo (3), "Gravar" ("Alunos")
- `prd.md` RF2, RF3, RF15, RF16
- `cenarios.md` RF2 e RF3; Corridas ("Turma à mão, ou renomeada, contra turma do job")
- Regra 60 itens 5 e 6; regra 20 item 2
- Código: o motor da 4.0; `packages/core/src/estrutura/turma.repository.ts`, `serie.repository.ts`, `lista.repository.ts`;
  `packages/shared/src/estrutura/documento-na-matricula.ts`

## Subtarefas

- [ ] 7.1 — Tipo alunos, classificação de entrada: turma pela `chave` (ou pelo nome, se nula), turma nova com série, os erros de linha da tabela abaixo
- [ ] 7.2 — Gravar: turma e série novas (`turma.criada`, com a série), `lista_nome` nova
- [ ] 7.3 — Passo (3): turma relida; único violado (`chave`, matrícula na `lista_nome` ou na `credencial_matricula`): `desatualizada` na mesma execução
- [ ] 7.4 — Consultas da prévia em lote, constantes entre 30 e 3.000 linhas
- [ ] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `packages/core/src/estrutura/turma.repository.ts`, `serie.repository.ts` | alterado |
| `apps/worker/test/gravar-planilha-alunos.int.test.ts`, `apps/api/test/importacao-alunos.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Planilha com a turma escrita de três jeitos casa com uma turma só | integração | caminho feliz (RF3) | |
| Duas turmas existentes com a mesma chave: erro na linha | integração | RF3 | |
| Turmas que a migration deixou com chave nula: a prévia dá erro | integração | RF3 | |
| "8A" renomeada para "9B": a planilha com "8A" vira turma nova | integração | RF3 | |
| "8A" renomeada para "9B": a planilha com "9B" casa | integração | RF3 | |
| "Turma Azul" e "10A": erro na linha | integração | RF3 | |
| Turma nova nasce na série certa, e a série é criada se faltar | integração | | |
| [P] "8º A" à mão contra "8A" do job: uma turma; a criação à mão que perde recebe `CONFLITO` | [P] | | |
| [P] O mesmo, com o job perdendo: `desatualizada` na mesma execução | [P] | tentativa 1 | |
| [P] "8B" renomeada para "8A" contra o job criando "8A": uma turma | [P] | | |
| [P] Turma tocada renomeada entre o (2) e o (3): `desatualizada`; nenhum aluno vai para a "9B" | [P] | releitura | |
| Matrícula repetida na planilha: erro nas duas linhas | integração | | |
| Matrícula em notação científica no CSV: erro na linha | integração | RF2 | |
| [P] Nome avulso com a matrícula M lançado entre o (2) e o (3): `desatualizada`, a avulsa intacta, zero `lista_nome` da planilha | [P] | tentativa 1 | |
| [P] Aprovado com a matrícula M lançado entre o (2) e o (3): `desatualizada` | [P] | único da `credencial_matricula` | |
| Homônimos com matrículas diferentes: dois alunos | integração | borda | |
| Matrícula da B na planilha da A: "entra" | integração | isolamento | |
| Turma "8A" da B não casa com a planilha da A | integração | isolamento | |
| 3.001 linhas ou mais de 512 KB: recusado; 3.000 entram | integração | RF2 | |
| Consultas da prévia iguais entre 30 e 3.000 linhas, contadas | integração | RF2 | |
| [P] Duas execuções com barreira: um efeito só nas contagens de turma e `lista_nome` | [P] | job duas vezes | |
| Turma travada por mais de 1 s: nada parcial; a nova tentativa conclui | integração | | |
| [P] Passo (3) contra o gerar acesso e o `virarSala` na mesma turma: zero `40P01` e zero 503 | [P] | `FOR NO KEY UPDATE` | |
| Auditoria `turma.criada` com a série | integração | RF17 | |
| Escola sem ano em curso: com o filtro do planejado, a turma nova nasce no planejado | integração | ano | |

## Como testar

- Lista da A1: `apps/api/test/lista.int.test.ts` (`escolaComTurmas()`), `› a prévia aponta cada linha ruim com o código, entre as boas; …`
- Corrida do gerar: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › o gerar parado depois do insert: o encerrar espera a turma e revoga o acesso que acabou de nascer`
- Contagem de consultas: **sem precedente**; o espião no `query` do pool, como na 3.0
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-alunos.int.test.ts`
- Armadilha (rodada 8): no único violado, chame o processor uma vez e confira `desatualizada` na tentativa 1; pelo BullMQ a mutação passaria

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, duas turmas de mesma chave em anos diferentes.

## Fora do escopo desta tarefa

"Já existe", nome corrigido e a lista da A1 (8.0); transferência e desligamento (9.0, 10.0); a tela (13.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
