# Tarefa 4.0 — A classificação roda no worker, fora da janela letiva, e grava as habilidades da seção

**Funcionalidade:** classificacao-bncc · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A execução `classificar_secoes` `pendente` roda no `main-worker` pela fila `lote`, fora da janela letiva, sem pessoa nem
ano, e grava os códigos `origem: 'ia'` só nas seções vivas, com a degradação do lote.

## Contexto necessário

- `techspec.md` §5 "Classificação" e "Degradação do lote", §6, §7 (`consumo_ia`, log), §7c (fila, vazão, estados)
- `prd.md` RF5, RF15
- `cenarios.md` "Classificação no worker"; corridas P1a, P4, P4b
- `.claude/rules/`: 10, 20, 30, 80
- Código: `apps/api/src/ia/` (`execucao.processor.ts`, `execucao.repository.ts`, `montar-comandos.ts`, `worker-de-ia.ts`),
  `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/queue/janela-letiva.ts`, `packages/core/src/jobs/job-adiado.error.ts`

## Subtarefas

- [ ] 4.1 — `ia.executar-lote` e a fila `lote` em `FILAS_DA_IA` (§5 "Seções", §7c "Fila" e "Limite por escola"); a varredura inclui a `lote`
- [ ] 4.2 — O processador: `quemPediu` ausente só em `daRotina`; a janela e a suspensão antes de `rodando`
- [ ] 4.3 — O comando: `preparar` e `concluir` como a §5 "Classificação", sem o `for update` na seção (vai na 7.0, com P1b)
- [ ] 4.4 — A degradação e `falhas_seguidas` (§5 "Degradação do lote")
- [ ] 4.5 — Consumo, métrica do envio à classificação e log (§7, §7c)
- [ ] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/system/job-definitions.test.ts` | alterado |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/execucao-command.ts`, `apps/api/src/ia/montar-comandos.ts`, `apps/api/src/ia/worker-de-ia.ts`, `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/worker-config.ts`, `apps/api/src/worker.module.ts` | alterado |
| `apps/api/src/material/classificar-secoes.command.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/material.module.ts`, `apps/api/src/material/classificacao.int.test.ts` | novo e alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `.env.example`, `compose.yaml` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `origem: 'ia'` e `classificada_em` | |
| consumo | I | a função, sem pessoa, entrada só ids e versão | |
| pacote do Tutor | I | não muda. Mutação: somar ao pacote | |
| `quemPediu` ausente fora de `daRotina`; em `daRotina` | I | `NAO_ENCONTRADO`; roda. Mutação: tirar a conferência | |
| worker real | I | consome a `lote`. Mutação: tirar a `lote` | |
| duas da A e uma da B | I | a segunda da A espera. Mutação: sem limite por escola | |
| `preparar`: corrigidas; outra execução; excluído; não `pronto` | I | sem modelo nem consumo; um caso e uma mutação por termo | |
| função suspensa | I | sem chamada, `nao_classificada` | |
| degradação: balde cheio, disjuntor, menor, provedor depois da chamada, Tutor da B, soberania | I | as linhas "Balde `lote` cheio…" e "Recusa de soberania" do `cenarios.md`, um caso e a mutação de cada | |
| janela: 7h05; janela da escola diferente; `pendente` às 10h | I | a linha "Janela" do `cenarios.md`, um caso cada. Mutação: tirar a conferência | |
| worker morto | I | `EXECUCAO_INTERROMPIDA` em até 300 s | |
| `falhas_seguidas` no worker: inválida soma nas 12; sucesso zera; interrompida e suspensa não somam | I | um caso cada. Mutação: somar em qualquer `falhou` | |
| entregue duas vezes, inválida | P | soma 1 | |
| entregue duas vezes (D49) | P | uma chamada, um consumo, uma gravação | |
| P1a | P | não grava. Mutação: tirar `corrigida_em is null` | |
| `execucao_id` trocado por SQL antes | P | sem efeito. Mutação: tirar `execucao_id = :esta` | |
| P4: edição nova; exclusão | P | sem efeito. Mutação: tirar a releitura | |
| P4b | P | a exclusão espera. Mutação: tirar o `for share` | |
| execução da A com seções da B | I | nada. Mutação: tirar `escola_id` | |
| log; métrica por escola | U | sem título, texto nem código | |

## Como testar

- Vaga: `apps/api/src/ia/fila-de-ia.int.test.ts` › "cinco ferramentas da A juntas: a quinta espera, o Tutor da A responde, e a ferramenta da B segue"
- Duas entregas e morto: `execucao-interrompida.int.test.ts` › "as duas leem `pendente`: uma só vira `rodando`…" e "worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA…"
- Adiamento: `apps/worker/test/enviar-email-adiamento.int.test.ts` › "estourado, o job é adiado mais vezes que as tentativas…"
- Menor: `llm-gateway.test.ts` › "o turno do Tutor pula o modelo menor…"
- Ordem forçada: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/src/material/classificacao.int.test.ts`
- Armadilha: o dublê lança `LLMError`, o erro tipado do adaptador, e não `new Error`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: o relógio injetado.

## Fora do escopo desta tarefa

Criar execuções (5.0, o teste as semeia); o recorte (6.0); o `for update` do `concluir` (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
