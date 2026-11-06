# Correção — `tools/renomear/restos.test.ts` vermelho: comentário de `migracao-f2.int.test.ts` usa o símbolo `migrar` do mapa de nomes

**Origem:** portão da tarefa 4.0 de onboarding-por-convite (`tools/renomear/restos.test.ts` › "a árvore não tem resto dos mapas aplicados").
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. test-engineer é obrigatório em toda correção. A correção leva 1 arquivo de código e o
     documento; o `revisor-geral` foi ditado pelo pedido. -->

## Sintoma

O portão da 4.0 falha em `tools/renomear/restos.test.ts` com `packages/core/src/db/migracao-f2.int.test.ts:12 migrar`.

## Fora desta correção

Os arquivos da tarefa 4.0 em curso (tudo o que o `git status --short` lista fora deste documento e de `migracao-f2.int.test.ts`):
ficam na árvore, não entram na revisão nem no commit.

## Causa

O comentário do cabeçalho de `migracao-f2.int.test.ts` (tarefa 2.0) cita o serviço do compose como `` `migrar` ``. `migrar` é símbolo
do mapa de nomes-de-mercado (`tools/renomear/mapa.ts`), e `restos.test.ts` varre a árvore atrás de palavra do mapa. Falha da tarefa
2.0, só vista agora porque o teste de restos entra no portão da 4.0.

## Teste que reproduz

`tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados` (vermelho antes: aponta
`migracao-f2.int.test.ts:12 migrar`; verde depois).

## Correção

Só o comentário: "do serviço `migrar`" virou "do serviço de migração". Nenhum código mudou.

## Mutações

**Sem mutação:** esta correção troca só uma palavra de um comentário de teste; não há cláusula a provar. O código de produto que a árvore altera é da tarefa 4.0, em curso, e não entra nesta correção.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 20:07:01 | 2026-11-03 20:07:11 | `revisor-geral` | 1 | APROVADO | a61ac4060443403e5 |
| 2026-11-03 20:07:04 | 2026-11-03 20:07:17 | `tenancy-guardian` | 1 | APROVADO | ab3d2bfa5ef73155f |
| 2026-11-03 20:07:07 | 2026-11-03 20:07:17 | `privacy-guardian` | 1 | APROVADO | ad4279713fd8539ae |
| 2026-11-03 20:07:10 | 2026-11-03 20:07:20 | `conformidade-reviewer` | 1 | APROVADO | a4ed5fe0d043e0023 |
| 2026-11-03 20:07:13 | 2026-11-03 20:07:21 | `infra-guardian` | 1 | APROVADO | a2e4fb6079be505c9 |
| 2026-11-03 20:06:58 | 2026-11-03 20:07:50 | `test-engineer` | 1 | APROVADO | a128b80568fdd187f |
