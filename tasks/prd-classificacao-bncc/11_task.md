# Tarefa 11.0 — O professor troca a habilidade da questão no artefato, com a trava que aplicar e adaptar também tomam

**Funcionalidade:** classificacao-bncc · **Depende de:** 10.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No artefato dele, antes de aplicar, o professor vê a habilidade de cada questão com o capítulo e a troca por outra do
recorte (ou por nenhuma); a base da classificação não muda; aplicar e adaptar tomam a mesma trava, e a troca depois disso
recebe `CONFLITO`.

## Contexto necessário

- `techspec.md` §4 (o `PATCH` da questão, `artefatoId`, a ordem, os tetos), §5 "Troca" e "Suspensão", §9
- `prd.md` RF9
- `cenarios.md` "Troca pelo professor", "Telas" (artefato); P6a, P6b, P7, P8
- `docs/interface.md` §1 (o artefato aberto)
- `.claude/rules/`: 10, 50, 70, 80
- Código: `apps/api/src/artefato/artefato.repository.ts` (`porId`, sem trava hoje), `artefato.service.ts`,
  `adaptacao.command.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
  (`artefatoParaAplicar`, sem trava no artefato); `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx` (a
  habilidade, linhas 71-72); o seletor da 8.0 em `apps/web/src/components/habilidades/`

## Subtarefas

- [ ] 11.1 — O `PATCH`, como a §5 "Troca"; `artefato.habilidade_trocada`; teto 100/300
- [ ] 11.2 — Aplicar e adaptar tomam o `for update` no artefato primeiro
- [ ] 11.3 — A tela: a habilidade com o capítulo, "Sem habilidade", "Trocar" com o seletor (as do capítulo primeiro; com a função suspensa, sem a prioridade das `origem: 'ia'`), desabilitado depois da aplicação com o motivo; a Parte A no `docs/interface.md`
- [ ] 11.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/test/troca-de-habilidade.int.test.ts`, `apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx`, `apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx`, `e2e/professor-troca-de-habilidade.spec.ts` | novo |
| `packages/shared/src/assistente/artefato.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/artefato/artefato.controller.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`, `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx`, `apps/web/src/areas/professor/artefatos/api/artefatos.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| troca | I | o diagnóstico usa a trocada; `habilidade_da_secao` intacta; `artefato.habilidade_trocada`, sem título | |
| sem componente | I | só `null` aceito | |
| coordenação no `PATCH` | I | recusada | |
| aplicado; com versão adaptada | I | `CONFLITO`, um caso cada | |
| de outro professor da escola | I | `NAO_ENCONTRADO`, nunca `CONFLITO` | |
| artefato da B | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` | |
| código de outra disciplina do mesmo professor na mesma turma | I | `ENTRADA_INVALIDA` | |
| índice de questão inexistente | I | recusado sem gravar | |
| 101º da pessoa; 301º da escola | I | 429 | |
| função suspensa | I | as `origem: 'ia'` não valem na troca | |
| P6a | P | aplicar espera e aplica com a trocada. Mutação: tirar a trava da aplicação | |
| P6b | P | a troca espera e recebe `CONFLITO`. Mutação: tirar a trava da troca | |
| P7 | P | as duas trocas ficam. Mutação: tirar o `for update` | |
| P8 | P | a troca espera e recebe `CONFLITO`. Mutação: tirar a trava da adaptação | |
| tela: carregando; erro da troca; habilidade com o capítulo; "Sem habilidade"; depois da aplicação | U | um caso cada; "Trocar" desabilitado, com o motivo | |
| tela: `CONFLITO`; 429; sem componente no seletor | U | os textos | |
| lista da troca; com a função suspensa | U | as do capítulo primeiro; sem prioridade às `origem: 'ia'` | |
| artefato | E | `soOPainelDaAbaRola`, uma ação cheia, `VOCABULARIO_DE_NOTA` | |
| 360 px; alvo de 24 px; 44 px na ação principal | E | `chromebook` e `celular`, axe | |
| teclado | E | o seletor abre, filtra e fecha; foco devolvido | |
| recomeço: segunda pessoa; mesmo artefato reaberto; `PATCH` segurado e troca de questão; falha com o seletor aberto | E | um caso cada | |

## Como testar

- Aplicar em paralelo: `apps/api/src/atividade/atividade.int.test.ts` › "a mesma atividade aberta duas vezes na mesma turma é CONFLITO, e dois cliques ao mesmo tempo gravam uma aplicação e uma auditoria"
- Adaptar: `apps/api/src/artefato/artefato.int.test.ts` › "a saída que muda o gabarito é recusada…"
- Ordem forçada: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), esperando o processo certo (autoconferência 10, b)
- Tela: `Artefato.test.tsx` › "com dado: o título, a linha de dados, a assinatura da IA e a folha…"
- e2e: `gerarAtividade` e `montarEscolaEEntrar` (`e2e/support/professor-flow.ts`); `soOPainelDaAbaRola` (`e2e/support/professor/scenario.ts`)
- `npx vitest run --project integracao apps/api/test/troca-de-habilidade.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/professor-troca-de-habilidade.spec.ts`
- Telas: `professora`, `/professor/artefatos/<id>`, a questão com "Trocar" aberto

## Autoconferência

As 12 perguntas do modelo, no plano. Na 9: o seletor é o da 8.0, importado.

## Fora do escopo desta tarefa

As outras leituras e o e2e do fluxo (12.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

