# Tarefa 1.0 — O Assistente, as ferramentas, o artefato e o Analista rodam por comando registrado, ainda no processo (42.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

Cada tarefa de IA que não é o Tutor deixa a closure e ganha um comando registrado, que relê do banco, pelo id da execução,
o que precisa (`preparar`) e grava o que produz (`concluir`). Ainda no processo da API; a 5.0 a leva ao worker. O que a
professora e a coordenação veem não muda.

## Contexto necessário

- `techspec.md` §1, §2 (linhas `apps/api/src/ia/` e `apps/api/src/{tutor,assistente,artefato,governanca}/`), §5 "O comando" e "O contexto no worker"
- `prd.md` RF1; §6; regras 00, 10, 30 (4, 6, 7), 40, 70 (2a, 3)
- `tasks/prd-reengenharia/onda-3a.md` "T9 — o Command por tarefa (42.0)" e "O contexto no worker"
- Código: `apps/api/src/ia/execucao.scheduler.ts` (o `ExecucaoRequest` e o `agendar`, com `entrada` e `aoConcluir` por closure);
  os chamadores `apps/api/src/assistente/assistente.service.ts:97`, `apps/api/src/artefato/ferramentas.service.ts:89` e `:100`,
  `apps/api/src/artefato/artefato.service.ts:162`, `apps/api/src/governanca/analista.service.ts:64`;
  `packages/core/src/ia/tasks/index.ts`; `packages/core/src/ia/prompts/`

## Subtarefas

- [ ] 1.1 — **Caracterização, num commit antes** (hash anotado na seção "Divergências"): um teste fixa as mensagens e o hash
  de cada `PROMPT_*` contra a `versao` da tarefa; outro fixa que a entrega do assistente e a do artefato adaptado nascem
  `pendente`, sem autor de decisão
- [ ] 1.2 — `ExecucaoCommand<E, S>` (`tarefa`, `fila`, `preparar(execucao)` → `{ entrada, lido, alunoId?, turmaId? }`,
  `concluir(saida, lido, tx, execucaoId)`) e o registro, em `apps/api/src/ia/`; o `agendar` aceita o comando e o `aoGravar`
- [ ] 1.3 — Comandos no módulo dono: as duas ferramentas e a adaptação (`artefato/`), `propor_ferramenta` (`assistente/`),
  o Analista (`governanca/`). O `preparar` relê a execução no escopo e repete o alcance do `POST` e a suspensão; `lido` tipado
- [ ] 1.4 — O `aoGravar` fica na requisição (a mensagem de quem pediu, na mesma transação do `pendente`)
- [ ] 1.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/execucao-command.ts`, `apps/api/src/ia/registro-de-comandos.ts`, `apps/api/src/artefato/ferramentas.command.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/assistente/proposta.command.ts`, `apps/api/src/governanca/analista.command.ts`, `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` | novo |
| `apps/api/src/ia/execucao.scheduler.ts`, `apps/api/src/ia/ia.module.ts`, `apps/api/src/artefato/ferramentas.service.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/artefato.module.ts`, `apps/api/src/assistente/assistente.service.ts`, `apps/api/src/assistente/assistente.module.ts`, `apps/api/src/governanca/analista.service.ts`, `apps/api/src/governanca/governanca.module.ts`, `apps/api/src/ia/ia.int.test.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/api/src/assistente/assistente.int.test.ts`, `apps/api/src/governanca/analista.int.test.ts`, `apps/api/src/entrega/entrega.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| hash de cada prompt | U | mensagens e hash batem com a `versao`, antes e depois da troca. Mutação: mudar um prompt sem mudar a `versao` | |
| entrega `pendente` | I | a do assistente e a do artefato adaptado nascem `pendente`, sem autor, antes e depois | |
| caminho feliz, um por comando | I | a atividade, o plano, a adaptação, a proposta e o resumo do Analista saem como hoje, pela rota | |
| `preparar` relê pelo id | I | a execução gravada com parâmetros diferentes dos da rota produz pelos gravados | |
| sem alcance no `preparar` | I | artefato, turma ou material fora do alcance, vínculo encerrado, função suspensa depois do `202`: `NAO_ENCONTRADO` (ou `FUNCAO_SUSPENSA`), sem modelo nem `consumo_ia`. Mutação: sem a conferência | |
| isolamento | I | entrada gravada que cita turma ou material da B, lida no contexto da A: `NAO_ENCONTRADO`, nada da B é lido | |
| D55 na proposta | I | `propor_ferramenta` com nota na saída continua recusada (`assistente.int.test.ts`) | |
| log novo | I | a linha do comando leva ids, tarefa e código; nunca entrada nem texto (regra 20, item 9) | |

## Como testar

- Precedente da rota: `apps/api/src/artefato/artefato.int.test.ts` › "a professora pede no chat, aceita a proposta, gera a
  atividade…" (fim a fim pelo agendador de hoje); a entrega `pendente`: `apps/api/src/entrega/entrega.int.test.ts` › "a versão
  adaptada nasce pendente, sem autor de decisão…"
- O executor do processo é trocado nas suítes por `EXECUTOR_DE_AGENTE` (`ia.module.ts`); mantenha: a bancada da fila é da 5.0
- Hash: `createHash('sha256')`, como `packages/core/src/ia/golden-seal.test.ts` › "a pasta real confere com o SELO.json"
- Isolamento: `apps/api/test/escola-assistente.fixture.ts` para as duas escolas
- Comando: `npx vitest run --project integracao apps/api/src/artefato/artefato.int.test.ts`
- Armadilha (retro da F4): o teste cria a condição — a função suspensa entre o `202` e o `preparar` se faz pelo
  repository de suspensão, e não herdada de outro caso

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada cláusula do
`preparar` (alcance, suspensão, escopo) é um bloco. Na 9: o `AgenteExecutor` e o `runInContext` já existem; não reescreva.

## Fora do escopo desta tarefa

O Tutor e a trava "toda tarefa tem comando" (2.0); o job, o worker e a fila (3.0, 5.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
