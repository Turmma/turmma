# Tarefa 9.0 — Segunda chamada para quem não enviou, com lote próprio

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 5.0, 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

Com a prova original encerrada, o professor reabre para quem não a enviou, com janela nova; só o convocado vê e faz, e
as tentativas formam um lote próprio, sem mudar o da original.

## Contexto necessário

- `techspec.md` §3 (`segunda_chamada_de`, `convocado_da_segunda_chamada`, os índices), §4, §5.1, §5.9, §6
- `prd.md` RF10; §7 (aluno faltou)
- `cenarios.md` §1 RF10, §1b (convocado transferido), §3 (h)
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`: as checagens do `aplicar` (objetiva, versão
  adaptada aprovada)

## Subtarefas

- [ ] 9.1 — `POST …/:id/segunda-chamada`: original encerrada; alunos da turma atual sem tentativa enviada nem vencida;
  segunda chamada de segunda chamada recusada; as checagens do aplicar; janela, duração, tempo adicional que cabe;
  auditoria `atividade.segunda_chamada_aplicada`
- [ ] 9.2 — `minhas-atividades` e o alcance da 3.0 pelos convocados
- [ ] 9.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts` | alterado |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/segunda-chamada.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Original aberta | integração | `ENTRADA_INVALIDA` | encerrada passa | |
| Janela de 50 min, duração 40, convocado com +50% | integração | `ENTRADA_INVALIDA` | 60 min passa | |
| Aluno que enviou; que venceu sem enviar | integração | `ENTRADA_INVALIDA` | o que faltou passa | |
| Segunda chamada de segunda chamada | integração | `ENTRADA_INVALIDA` | | |
| Artefato que não é objetiva; versão adaptada não aprovada | integração | as recusas do aplicar | | |
| Aluno de outra turma, de outra escola, inexistente | integração | a mesma resposta, nada gravado | | |
| Convocado vê e começa | integração | aparece em `minhas-atividades` e `comecar` cria a tentativa | | |
| Não convocado | integração | não vê; `NAO_ENCONTRADO` em `comecar`, `prova`, `tempo`, PUT e saídas; fora da janela, nunca `PROVA_FORA_DA_JANELA` | o convocado recebe `PROVA_FORA_DA_JANELA` | |
| Convocado transferido antes | integração | não começa | vínculo encerrado | |
| Lote próprio com a original **aprovada** | integração | a segunda chamada encerra com lote pendente próprio; o da original não muda | | |
| Corrida (h) | integração | `CONFLITO` na segunda | `WriteBlockTrigger` na aplicação | |
| Professor de B; sem vínculo; outra disciplina; vínculo encerrado em X; aluno pela matriz | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A; o repository de convocados vazio | |
| Auditoria | integração | sem percentual por aluno | | |

## Como testar

- Aplicar e encerrar: `aplicarAtividade`, `encerrarAtividade`, `aprovarOLote` (`apps/api/test/atividade.fixture.ts`)
- Recusas do aplicar: `apps/api/src/atividade/atividade.int.test.ts › a versão adaptada pendente e a rejeitada não
  chegam à turma…`
- `npx vitest run --project integracao apps/api/src/atividade/segunda-chamada.int.test.ts`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

A tela (11.0); a trava do Tutor do convocado (7.0); o encerramento sozinho (6.0, sem mudança).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
