# Tarefa 2.0 — O banco do F2 existe, e a turma ganha a chave que casa "8ºA" com "8A"

**Funcionalidade:** onboarding-por-convite · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

As tabelas e colunas do F2 existem, com os checks provados direto no banco; a turma criada ou renomeada grava a
`chave` normalizada, e a chave repetida no ano responde `CONFLITO`; os contratos das planilhas moram em
`packages/shared/src/importacao/`.

## Contexto necessário

- `techspec.md` §3 (o bloco inteiro), §2 (linha `packages/shared/src/importacao/`), §5 "Planilha" (o normalizador)
- `prd.md` RF3, RF16, RF17
- `.claude/rules/80-infra-e-carga.md` itens 8 e 9; regra 10 itens 1 e 2; regra 20 item 1
- `cenarios.md` RF3 (a parte da chave) e "Auditoria e dado"
- Código: `packages/core/src/db/schema/turma.ts`, `vinculo.ts`; migrations em `packages/core/drizzle/`;
  `packages/core/src/estrutura/turma.repository.ts` (da 1.0); `packages/shared/src/privacidade/classificacao.ts`;
  `packages/shared/src/system/job-definitions.ts`

## Subtarefas

- [ ] 2.1 — Migration: `importacao_planilha`, `alocacao`, `evento_calendario` (FK composta com o ano, índices e checks da §3), `turma.chave` com o único parcial (preenchida só onde é única no ano), `vinculo.origem`
- [ ] 2.2 — `packages/shared/src/importacao/`: normalizador de turma e de disciplina, cabeçalhos dos quatro modelos, contratos de prévia, gravar e estado, `resumo` estrito (só contagens), erros de lista fechada; `estrutura.gravar-planilha` em `job-definitions.ts`
- [ ] 2.3 — `turma.chave` na criação e na renomeação, no mesmo `update`; único violado: `CONFLITO`
- [ ] 2.4 — Classificação das três tabelas novas; `docs/modelo-de-dados.md` (`alocacao` substitui as três tabelas da grade; id estável), glossário ("Grade horária"); `docs/runbook.md` (voltar a versão recalcula a `chave`)
- [ ] 2.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/00NN_f2_planilhas.sql` e `meta/` | novo |
| `packages/core/src/db/schema/importacao-planilha.ts`, `alocacao.ts`, `evento-calendario.ts` | novo |
| `packages/core/src/db/schema/turma.ts`, `vinculo.ts` | alterado |
| `packages/core/src/estrutura/turma.repository.ts` | alterado |
| `packages/shared/src/importacao/*.ts`, `packages/shared/src/index.ts` | novo; alterado |
| `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/privacidade/classificacao.ts` | alterado |
| `docs/modelo-de-dados.md`, `docs/glossario.md`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A migration roda sobre dado da A1 e só expande | integração | nada apagado; o padrão vale nas linhas antigas | |
| "8ºA", "8º A", "8A", "8a" e "8º ano A" dão a mesma chave | unidade | RF3 | |
| "Turma Azul" e "10A" dão chave nula | unidade | RF3, fora do padrão | |
| Criar "8º A" grava `chave = 8a` | integração | a chave nasce na criação | |
| Renomear para "Turma Azul" deixa a `chave` nula | integração | recalcula no mesmo `update` | |
| Renomear para chave que já existe no ano: `CONFLITO` | integração | único violado vira `CONFLITO` | |
| Mesma chave em outro ano, ou na escola B: aceita | integração | o único é por escola e ano | |
| [P] "8º A" e "8A" criadas à mão ao mesmo tempo: uma turma, a outra `CONFLITO` | [P] | barra o único parcial, não uma leitura anterior | |
| Migration com duas turmas de mesma chave no ano: as duas com `chave` nula | integração | preenche só onde é única | |
| `alocacao` com `inicio >= fim` ou `diaSemana` 8: recusada | integração | checks | |
| `alocacao` com o ano de outra escola: a FK composta recusa | integração | isolamento no banco | |
| Segunda importação `na_fila` da mesma escola recusada; na outra escola, aceita | integração | único parcial | |
| `anoLetivoId` nulo fora do tipo professores, ou `erro` fora da lista: recusado | integração | checks | |
| Eliminar o professor que gravou planilha e tem alocação: passa | integração | `set null` e cascata (RF17) | |
| `contracts.test.ts`: a grade sai sem e-mail | unidade | DTO | |
| `resumo` com chave que não é contagem (`nome`): recusado | unidade | contrato estrito | |

## Como testar

- Check e FK composta no banco: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts › turma, disciplina, usuário, material, artefato, execução e atividade aplicada de outra escola são recusados pela FK composta ou pelo gatilho`
- `CONFLITO` na renomeação: `apps/api/test/estrutura.int.test.ts › renomear: a resposta e a listagem trazem o nome novo, …, dá CONFLITO sem o valor`; o [P]: `› concorrência: duas turmas renomeadas para o mesmo nome em paralelo, …: uma fica com ele, a outra recebe CONFLITO`, trocando o nome igual pela chave igual ("8º A" e "8A")
- Comandos: `npx vitest run --project unidade packages/shared/src/importacao`; `npx vitest run --project integracao apps/api/test/estrutura.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a chave repetida precisa de duas turmas no mesmo ano **e** uma em outro ano.

## Fora do escopo desta tarefa

Quem grava `alocacao`, `evento_calendario` e `importacao_planilha` (4.0 em diante).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
