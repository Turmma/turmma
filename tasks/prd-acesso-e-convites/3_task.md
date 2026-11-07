# Tarefa 3.0 — A coordenação envia os convites por e-mail (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/professores/convites/enviar` refaz o convite de cada pendente ou vencido (todos, ou os selecionados) com canal `email`, enfileira o envio, grava `convite.enviado` com a coordenação como autora, respeita a cota de 300/h por escola, e `GET /v1/professores` mostra o `envio`.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Enviar", "Auditoria") e 7; `prd.md` RF11, RF16, RF17; `cenarios.md` RF11, RF16, "Auditoria"
- `.claude/rules/10` itens 3 e 6; `.claude/rules/80` itens 1 e 7
- `convite-de-professor.service.ts` (`refazerConviteDeProfessor`); `professores.service.ts`

## Subtarefas

- [ ] 3.1 — Contrato em `packages/shared` e a rota
- [ ] 3.2 — O filtro (pendente e vencido), o refazer em lote e o enfileiramento; "Copiar link" e "Reenviar" cancelam o envio antigo
- [ ] 3.3 — A cota de 300/h: limitador novo no Redis de fila, N pontos atômicos, devolvidos no 429 e no rollback; Redis fora, 300 ÷ instâncias em memória
- [ ] 3.4 — `convite.enviado`, gravado no pedido
- [ ] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/professores/professores.ts` | alterado |
| `apps/api/src/professores/professores.controller.ts` | alterado |
| `apps/api/src/professores/professores.service.ts` | alterado |
| `apps/api/src/professores/professores.repository.ts` | alterado |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts` | alterado |
| `packages/core/src/rate-limit/cota-por-hora.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/convites-enviar.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| "Enviar" sem seleção | integração | exclui quem aceitou, inclui o vencido e o da planilha ou da grade | |
| seleção mista (pendente, vencido, revogado, aceito, ativo, desativado) | integração | só pendente e vencido, a contagem diz quantos, nunca 409 | |
| 2 pontos restantes, seleção de 6 com 2 que entram | integração | passa; um "Enviar" de 1 logo depois dá 429 | |
| cota esgotada, relógio falso | integração | 429 com 59 min, passa com 61 | |
| lote maior que a cota; 40 com 30 restantes | integração | 429 inteiro, nada na fila nem na auditoria; um de 30 depois passa | |
| transação desfeita depois do consumo | integração | a cota volta | |
| Redis de fila fora | integração | seguro de 300 ÷ instâncias | |
| 40 pendentes, falso na barreira | integração | 40 na fila, resposta antes da barreira | |
| isolamento: cota | integração | a A recebe 429, a B segue | |
| isolamento: `usuarioIds` da B | integração | igual a inexistente, nada na fila | |
| escola sem ano em curso | integração | funciona | |
| permissão: professor chama "Enviar" | integração | recusado | |
| "Copiar link" com envio `na_fila` e `enviando` | integração | `cancelado`, link antigo recusado | |
| "Enviar" ou "Reenviar" sobre convite copiado de 2 dias | integração | id novo, token copiado recusado; `falhou` só 24 h depois do novo `criadoEm` | |
| `convite.enviado` | integração | um registro, autora a coordenação, canal, sem nome; nenhum do job | |
| GET depois de 5xx e de 4xx esgotado | integração | `envio = falhou` | |
| `contracts.test.ts` | integração | nenhuma saída com cifrado | |
| [P] dois lotes de 200 com 300 restantes | paralelo | um passa, o outro 429; cai com conferir e consumir em dois passos | |
| [P] dois "Enviar", o 1º preso no insert | paralelo | um convite aberto e um e-mail por professor; cai sem o `catch` | |

## Como testar

- Precedente: `apps/api/test/professores.int.test.ts` › "E8: cadastrar devolve o link uma vez…"; apoio `SessaoFixtures.escolaComSessao('coordenador')` e `equipeComEmail` (`apps/api/test/sessao.fixture.ts`)
- 429 por escola: `apps/api/test/rate-limit.int.test.ts` › "um usuário acima do próprio limite recebe 429, e os outros da mesma escola seguem"
- Auditoria: `apps/api/test/ciclo-de-vida.int.test.ts` › "concorrência: dois cliques em desativar…"; barreira com `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/api/test/convites-enviar.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 3: a seleção precisa misturar estados, senão a cota pela seleção passa. Na 4: o `requireAnoEmCurso` não pode responder antes (escola sem ano).

## Fora do escopo desta tarefa

A tela (4.0); o envio pelo worker (1.0, 2.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
