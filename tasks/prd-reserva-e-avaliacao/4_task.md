# Tarefa 4.0 — Com o principal caído, a chamada vai à reserva elegível, e cada chamada leva o seu destino

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

No gateway: na queda do principal (disjuntor, 5xx, conexão, prazo com o sinal vivo), a chamada vai à reserva elegível, uma vez.
Cada chamada carrega o seu destino, e a linha de consumo que o gateway entrega ao registro traz provedor, modelo, preço e
`peloProvedorDeReserva` de quem a recebeu. Gravar a coluna no banco e o compartilhamento do aluno são da 5.0.

## Contexto necessário

- `techspec.md` §3 (`pelo_provedor_de_reserva`), §5 ("A chamada" (2) e (4), "O destino por chamada"), §7 (log)
- `prd.md` RF2 a RF5, §7
- `cenarios.md` §1: as linhas RF1 a RF5 da tabela abaixo (o principal **fora**)
- Código: `llm-gateway.ts` (`ChamadaEnviada`, `Gasto`, `medir`, `linhasDeConsumo`, `chamadaFeita`, `descer`, `DEGRAUS`),
  `consumo.ts` (`ConsumoDeIa`, `InMemoryConsumo`), `fake-adapter.ts`, `resilient-adapter.ts` (o rótulo do disjuntor)

## Subtarefas

- [ ] 4.1 — O destino em `ChamadaEnviada` e no `Gasto` (origem, envio, identidade, `peloProvedorDeReserva`); preço, rótulo, linha e
  `medicao` leem o da chamada; `ConsumoDeIa.peloProvedorDeReserva` no tipo e no `InMemoryConsumo`
- [ ] 4.2 — O ramo da queda, depois da suspensão e da regra fixa da D36, com a elegibilidade da 1.0; a `rejeitada` não é queda; a
  reserva que falha termina como hoje (interativo indisponível, lote `JobAdiadoError(provedor)`); a inválida da reserva repete nela
- [ ] 4.3 — `provedor_de_reserva` em `DEGRAUS` (nasce em 0); log `ia.geracao.provedor_de_reserva` só com ids e `provedorId`; o
  disjuntor de cada adaptador no seu `provedor`
- [ ] 4.4 — `IA_FALHA_FALSA=<principal|reserva>:<5xx|prazo|conexao|429>` no `FakeAdapter`; a subida em produção a recusa
- [ ] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/tasks/turno-do-tutor.test.ts` | alterado |
| `packages/core/src/ia/consumo.ts` | alterado |
| `packages/core/src/ia/fake-adapter.ts`, `packages/core/src/ia/fake-adapter.test.ts`, `packages/core/src/ia/resilient-adapter.test.ts` | alterado |
| `infra/test/alertas.test.ts` | alterado |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| disjuntor aberto: a saída e a única linha são da reserva; degrau +1, nascido em 0 | U | a queda | o principal sem linha | |
| 5xx, e conexão: à reserva | U | o que é queda | um por causa | |
| prazo com o sinal vivo: à reserva; abortado: não | U | o prazo | só o sinal muda | |
| `rejeitada` com reserva elegível: não vai | U | não é queda | reserva elegível | |
| suspensa e principal fora: nenhuma chamada | U | a suspensão antes | contador nos dois | |
| aprovação só da geração: a geração vai, o Tutor não, a D36 sai pela regra fixa | U | por tarefa | as duas no mesmo gateway | |
| Tutor aprovado no `rapido` da reserva: atende; linha com `aluno_id`, a identidade dela, `true`, conteúdo nulo | U | RF4 positivo | reserva conferida com `conversa_do_aluno`; `aluno_id` não nulo | |
| modelo do `rapido` trocado; o mesmo na classificação; outro `provedorId`: indisponível sem chamar | U | provedor e modelo | um campo por caso | |
| os dois fora: uma chamada à reserva; o interativo termina indisponível (o lote é da 5.0) | U | sem laço | chamadas contadas nos dois | |
| a reserva falha depois de sair: estimativa, o provedor dela, `true`; o principal `false` | U | a coluna | as duas linhas | |
| a inválida da reserva repete na reserva | U | quem respondeu | o `provedorId` da 2ª | |
| prazo no principal, reserva atende: cada linha com o preço, o provedor, o modelo e a coluna dela; `medicao` da reserva | U | RF5 | preços, `provedorId` e modelos diferentes nos dois | |
| os dois fora: `ia.disjuntor.aberto` com 1 em duas séries, uma por `provedor` | U | a X6 | dois `provedorId`, cada série lida pelo rótulo | |
| os dois fora: o "Provedor de IA fora" (`ia-provedor-fora.yaml`, por `provedor`) dispara para cada um | U | §7c | a `expressao` agrupa por `provedor` | |
| `IA_FALHA_FALSA` só no falso; em produção recusa a subida | U | fora de produção | `openai_compat` sem efeito | |
| log novo: `ia.geracao.provedor_de_reserva` | U | só ids e `provedorId` (regra 20.9) | texto reconhecível na entrada e a chave da reserva reconhecível | |

## Como testar

- `llm-gateway.test.ts` › "disjuntor aberto fora do lote: uma linha da falha…", › "disjuntor aberto no lote: nenhuma linha, e o job
  adia", › "o provedor que falhou depois de a chamada sair não é `semEnvio`…" e › "o log de cada degrau leva só o evento…"
- D36: `turno-do-tutor.test.ts`, bloco "assunto pessoal delicado: mensagem fixa, sem modelo (D36)"
- Disjuntor: `resilient-adapter.test.ts` › "`ia.disjuntor.aberto{provedor,modelo,perfil}`: 0 com o disjuntor fechado…"
- Dois adaptadores: `__fixtures__/scripted-adapter.ts` com `provedorId` por instância (1.0)
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`

## Fora do escopo desta tarefa

O banco, a bancada e o compartilhamento (5.0); a repetição e o prazo das quatro (6.0); o sem vaga (7.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisão da spec, rodada 2 | `rejeitada` (401) com contador por motivo | `ia.chamada.erros` já tem o código; se faltar, `TODO.md` |
