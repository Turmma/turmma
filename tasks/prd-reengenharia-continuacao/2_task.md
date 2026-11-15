# Tarefa 2.0 — O Tutor roda por comando: a D36 grava em transação própria e a S12 se confere no `preparar` e no `concluir` (42.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O turno do Tutor ganha comando registrado. O `assunto_delicado` do modelo grava a mensagem fixa e o `atencao_humana` numa
transação própria, mesmo com a execução encerrada; a avaliação aberta se confere no `preparar` e no `concluir`. Toda
`TarefaDeIa` passa a ter comando, e o `ExecucaoRequest` perde as closures.

## Contexto necessário

- `techspec.md` §5 "O comando", "O contexto no worker" e "A D36 e a S12"
- `prd.md` RF1, RF4; §6
- `tasks/prd-reengenharia/onda-3a.md` "T9 — o Command por tarefa"; regras 10, 30 (10, 11), 40, 70 (3, 4), 80
- Código: `apps/api/src/tutor/tutor.service.ts`: `agendar` (l.200), `entrada` (l.215), `aoConcluir` (l.241; avaliação
  aberta, l.247), assunto delicado do modelo (l.344), `#encaminhar` (l.370)

## Subtarefas

- [ ] 2.1 — Confira que a caracterização da 1.0 cobre o prompt do turno
- [ ] 2.2 — `turno.command.ts`: o `preparar` relê a pergunta pelo id, com o alcance e a avaliação aberta; `lido` tipado
- [ ] 2.3 — O `concluir`: o `assunto_delicado` numa transação própria, antes da conclusão condicional; a avaliação de novo
- [ ] 2.4 — O `#encaminhar` continua na requisição, sem comando nem execução nova
- [ ] 2.5 — `ExecucaoRequest` só com `aoGravar` além dos dados; o `agendar` busca o comando no registro
- [ ] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/turno.command.ts`, `apps/api/src/ia/registro-de-comandos.test.ts` | novo |
| `apps/api/src/tutor/tutor.service.ts`, `apps/api/src/tutor/tutor.module.ts`, `apps/api/src/tutor/tutor.repository.ts`, `apps/api/src/ia/execucao.scheduler.ts`, `apps/api/src/ia/registro-de-comandos.ts`, `apps/api/src/tutor/tutor.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| toda tarefa tem comando | U | o registro tem um comando por `TarefaDeIa`, salvo `relatorio_da_correcao`. Mutação: tirar um registro | |
| trava, alvo some | U | registro vazio, ou a lista de tarefas vazia: vermelho | |
| trava, quem contorna | U | comando com tarefa fora de `TarefaDeIa`; nome registrado duas vezes | |
| a exceção | U | `relatorio_da_correcao` com chamador reprova | |
| `ExecucaoRequest` sem closure | U | `aoConcluir` ou `entrada` no pedido não compila (`@ts-expect-error`) | |
| turno pelo comando | I | resposta, uma troca, consumo sem texto | |
| D36 com a execução encerrada | I | mensagem fixa e sinal ficam. Mutação: o sinal dentro da conclusão condicional | |
| D36 repetida | I | o `concluir` duas vezes: um sinal só | |
| "quero sumir" sem modelo | I | mensagem e sinal na requisição, sem o adaptador. Mutação: a conferência no comando | |
| S12 entre o `POST` e o `preparar` | I | sem resposta, sem troca | |
| S12 entre o `preparar` e o `concluir` | I | sem resposta, sem troca; o `assunto_delicado` ainda grava | |
| avaliação de outra turma abre no meio | I | o turno conclui, com troca contada | |
| contexto no `preparar` | I | transferido, vínculo encerrado, eliminado, virada do ano, função suspensa: `NAO_ENCONTRADO` (ou `FUNCAO_SUSPENSA`), sem modelo nem `consumo_ia` | |
| isolamento | I | pergunta da B lida pelo comando no contexto da A: nada lido nem gravado | |
| recusa testada | I | as três formas de arrancar a resposta continuam recusadas | |

## Como testar

- D36: `apps/api/src/tutor/tutor.int.test.ts` › "recebe a mensagem fixa na hora, e o professor recebe o sinal sem referência e
  sem conteúdo" (l.310); para o "já encerrada", encerre a execução por SQL antes do `concluir` e chame o comando direto
- S12: › "abre entre o 202 e a execução: a execução falha com o código da pausa…" (l.523) e "a avaliação de outra turma da
  escola abre no meio…" (l.574); o caso entre o `preparar` e o `concluir` segura o adaptador falso numa barreira
- Contexto: › "o aluno transferido depois do 202 e antes de a execução rodar…" (l.932)
- Recusa: › "pedido direto, palpite a confirmar e pedido fatiado em dois turnos…" (l.279)
- Peças: `apps/api/test/escola-tutor.fixture.ts`; `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/src/tutor/tutor.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: o caso da D36 do modelo usa um texto que o `ehAssuntoDelicado` deixa passar.

## Fora do escopo desta tarefa

O job e o worker (5.0); a mensagem fixa acima do "Tentar de novo" na tela (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
