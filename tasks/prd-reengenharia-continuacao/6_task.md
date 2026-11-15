# Tarefa 6.0 — Execução duplicada ou interrompida não chama o modelo de novo, e o consumo estimado fica no rastro (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 5.0
**Subagentes obrigatórios:** `privacy-guardian`, `tenancy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A reentrega em `rodando` encerra a execução com `EXECUCAO_INTERROMPIDA`, sem modelo nem troca; a varredura a cada 60 s
encerra a `rodando` velha e a `pendente` sem job vivo. Toda `rodando` encerrada grava a linha estimada em `consumo_ia`, no
rastro do aluno: o custo a mais, nunca a menos (D14).

## Contexto necessário

- `techspec.md` §5 ("Os estados", linha `rodando`; "A varredura"), §7, §8 (a linha estimada)
- `prd.md` RF3; §8; regras 10 (9), 20 (9, 19), 30 (4), 40, 80
- Código: `execucao.repository.ts` (`falharInterrompidas`); `consumo.repository.ts`;
  `packages/core/src/titular/compartilhamento.repository.ts` (`rastroDoAluno`); `packages/core/src/db/schema/job-registro.ts:44`

## Subtarefas

- [ ] 6.1 — No processador: `rodando` na entrega → `EXECUCAO_INTERROMPIDA`, com a linha estimada (§8) na mesma transação
- [ ] 6.2 — A varredura da §5, `@Unscoped` com motivo; o `EXPLAIN` pelo `job_registro_pendentes_idx` na seção "Divergências"
- [ ] 6.3 — A conta do laço (Tech Spec §7c, "Laços e ritmo"): lote × duração × passadas cabe nos 60 s, e o laço para no sinal
- [ ] 6.4 — `docs/lgpd.md`: a linha `job_registro` cita `ia.executar`; a de `consumo_ia` diz que a linha estimada leva o
  provedor sem saber se o envio saiu
- [ ] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/ia/execucao-interrompida.int.test.ts` | novo |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/main-worker.ts`, `packages/core/src/ia/consumo.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `docs/lgpd.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| duplicada em corrida | P | a 2.ª acha `rodando`, encerra; a conclusão da 1.ª não muda a linha; uma chamada no máximo. Mutação: concluir sem `where estado = 'rodando'` | |
| as duas leem `pendente` | P | barreira entre a leitura e o `update`: uma só vira `rodando`, uma chamada | |
| worker morto | I | reentrega: `EXECUCAO_INTERROMPIDA`, sem modelo nem troca, uma linha estimada | |
| D36 na reentrega | I | o `assunto_delicado` gravado e o job reentregue: um sinal só | |
| linha estimada, externo | I | `envio_externo`, `provedor`, os tetos, o resto nulo; no `rastroDoAluno`. Mutação: sem `envio_externo` | |
| linha estimada, falso ou local | I | não conta como envio externo | |
| fora do freio | I | a linha não entra no freio do dia. Mutação: gravar com `aluno_id` | |
| o original vivo | I | duas linhas, nunca zero | |
| a gravação falha | I | o encerramento desfaz. Mutação: fora da transação | |
| varredura, limiar | I | a `rodando` de 301 s é encerrada, a de 299 s fica. Mutação: limiar fixo antigo | |
| varredura, `pendente` | I | com job vivo fica, mesmo com Redis fora; sem, encerrada sem linha. Mutação: não ler `job_registro` | |
| varredura, escola | I | job vivo de outra escola com o mesmo `execucaoId` não segura a `pendente`. Mutação: não igualar a escola | |
| varredura, duas réplicas | P | barreira entre o `update … returning` e o `commit`: um encerramento, uma linha. Mutação: tirar a condição de estado | |
| varredura, duas escolas | I | cada linha na escola da execução | |
| isolamento, reentrega | I | job da A com o `execucaoId` da B, já `rodando`: nada muda na B, sem linha | |
| rastro de outro aluno | I | X não vê a de Y, na mesma escola | |
| arquivo do titular | I | `arquivo-do-titular.int.test.ts` continua cobrindo o `consumo_ia` (rode à mão) | |
| log | I | só ids, tarefa, código e contagem | |

## Como testar

- Corrida: `apps/api/src/ia/ia.int.test.ts` › "a passagem é uma só: a segunda instância que tenta pegar a mesma execução não
  pega…"; barreira com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Varredura: › "execução presa em \"rodando\" ou \"pendente\" vira \"falhou\" com EXECUCAO_INTERROMPIDA quando a API sobe…"; a
  idade pelo banco, recuando `iniciada_em` e `criada_em`
- Consumo: › "grava o provedor de quem recebeu o conteúdo, e nulo onde nada saiu…"
- Bancada: `apps/api/test/fila-de-ia.fixture.ts` (5.0)
- Comando: `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: cada termo do `not exists` e do `update` da varredura, dentro da template
string, é um bloco. Na 10: as duas direções da corrida são dois casos.

## Fora do escopo desta tarefa

O corte dos 20 s (7.0); a contagem no uso do Tutor (9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
