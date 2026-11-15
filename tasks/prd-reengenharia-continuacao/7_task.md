# Tarefa 7.0 — A pergunta do Tutor que espera mais de 20 s termina com "Tentar de novo", e o operador é avisado (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 6.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

A `interativa` mais de 20 s `pendente` termina `falhou IA_INDISPONIVEL` sem modelo, cortada por quem chega primeiro (o
processador ou o `GET`). A troca não conta, o aluno vê "Tentar de novo", e o operador recebe alerta. A `ferramenta` não tem corte.

## Contexto necessário

- `techspec.md` §4 (o `GET`), §5 ("Os estados", linha `pendente`), §7b, §7c (métrica e alerta)
- `prd.md` RF5; §7; §8b; regras 10, 40, 50, 70, 80
- Código: `apps/api/src/ia/execucoes.service.ts` (`ler`); `apps/web/src/areas/aluno/Tutor.tsx` (l.108–122)

## Subtarefas

- [ ] 7.1 — No processador: o `pendente → rodando` ganha, na `interativa`, `criada_em >= now() - 20 s`; com zero linhas, o
  corte (`where estado = 'pendente' and criada_em < now() - 20 s`)
- [ ] 7.2 — No `GET`: depois de ler no escopo de quem pediu, só a `interativa` `pendente` vencida, com as mesmas cláusulas
- [ ] 7.3 — `ia.espera_estourada{escola_id}`, só quando o corte devolve a linha; o alerta e o runbook (uma escola: a vaga
  dela; várias: capacidade)
- [ ] 7.4 — A mensagem fixa acima do "Tentar de novo" quando chegam juntas; `docs/interface.md`, Parte A da conversa
- [ ] 7.5 — `docs/aia/tutor.md`: o turno sem modelo pela espera como limitação, só com a regra da D36
- [ ] 7.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`, `apps/api/src/ia/corte-da-espera.int.test.ts` | novo |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/execucoes.service.ts`, `apps/web/src/areas/aluno/Tutor.tsx`, `apps/web/src/areas/aluno/tutor.test.ts`, `e2e/aluno-tutor.spec.ts`, `infra/test/alertas.test.ts`, `docs/runbook.md`, `docs/aia/tutor.md`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| processador corta | I | aos 21 s sem `GET`: `falhou`, métrica +1, sem modelo. Mutação: sem o corte | |
| `GET` corta | I | Redis fora, `GET` aos 21 s: `falhou` antes da volta. Mutação: sem o corte | |
| `GET` aos 15 s | I | nenhuma escrita | |
| `GET` sobre `concluida`, `rodando` | I | nenhuma escrita nem métrica. Mutação: sem o estado | |
| `ferramenta` com 21 s | I | não corta, e roda. Mutação: sem a fila | |
| corrida, processador primeiro | P | ele corta; o `GET`, com barreira entre leitura e `update`, recebe zero linhas e não soma. Mutações: sem a idade no `pendente → rodando`; sem `estado = 'pendente'` no `GET` | |
| corrida, `GET` primeiro | P | um corte, métrica +1, sem modelo | |
| Redis fora e de volta | I | em 15 s roda; em 25 s o `GET` cortou e o job sai sem modelo; a ferramenta roda | |
| a troca | I | a cortada não conta; a reenviada (chave nova) conta | |
| isolamento | I | `GET` de usuário da B, e de outro da mesma escola, sobre `pendente` de 21 s: 404 do inexistente, sem escrita. Mutação: cortar antes da leitura | |
| isolamento, job | I | job da A com o `execucaoId` da B, vencida: nada muda na B | |
| métrica | U | só `escola_id`; nenhum usuário | |
| alerta | U | separa uma escola de várias; tem runbook. Mutação: o limiar | |
| tela, cortada | U | "Tentar de novo", sem erro cru | |
| tela, D36 junto | U | a mensagem fixa visível, acima do botão | |
| tela, 1366 e 360 px | E | mensagem fixa e "Tentar de novo": `paginaNaoRola`; 44 px, sem rolagem horizontal, axe; `VOCABULARIO_DE_NOTA`; corte por `page.route` | |
| log | I | o corte só com ids e código | |

## Como testar

- Corrida: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); idade recuando `criada_em`
- Redis fora: `apps/despachante/test/redis-down.int.test.ts` › "parado: 50 POSTs dão 202…"
- `GET` e isolamento: `apps/api/src/ia/ia.int.test.ts` › "de outra pessoa, de outra escola, inexistente… respondem igual"
- Tela: `e2e/aluno-tutor.spec.ts` › "em avaliação: o aviso com o título dela… a mensagem de assunto delicado recebe o
  encaminhamento com o 188"; `e2e/support/coordenacao.ts` (`paginaNaoRola`)
- Comandos: `npx vitest run --project integracao apps/api/src/ia/corte-da-espera.int.test.ts`;
  `node tools/ci/e2e.ts --manter-ambiente e2e/aluno-tutor.spec.ts`
- **Telas:** `aluno`, `/tutor/:atividadeAplicadaId`, pergunta com a execução cortada; e com a mensagem fixa junto

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: cada termo dos três `update` é um bloco. Na 2: `grep -rln 'Tentar de novo' e2e/`.

## Fora do escopo desta tarefa

"N perguntas que o Tutor não respondeu hoje" (9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
