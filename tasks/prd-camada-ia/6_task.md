# Tarefa 6.0 — A coordenação vê "IA do mês: N% do previsto" no Painel e na Governança, sem reais nem tokens

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

`GET /v1/governanca/consumo` passa a devolver o orçamento do mês (`situacao`, `porcentagem`, `aviso`) e, por função, a
`parte` e as execuções, sem tokens nem custo. O Painel mostra "IA do mês: N% do previsto" com o aviso, e a Governança
troca os tokens pela `parte`.

## Contexto necessário

- `techspec.md` §4 (`governanca/consumo`, `situacao`, `aviso`), §7c ("Volta do código"), §9 ("Coordenação")
- `prd.md` RF9, RF12, §4, §6
- `cenarios.md` §1 RF9 (a linha da API), RF12, §2 ("Soma do mês"), §4 (coordenação, erro, celular e acessibilidade)
- Código: `packages/shared/src/governanca/governanca.ts`, `apps/api/src/governanca/governanca.service.ts`,
  `textos-da-governanca.ts` (`textoDoConsumo`), `Governanca.tsx`, `Painel.tsx` (`OConsumoDoMes`)

## Subtarefas

- [ ] 6.1 — Contrato estrito em `packages/shared`: `orcamento`, `porFuncao [{ funcao, parte, execucoes }]`, `tutor`
- [ ] 6.2 — O serviço lê o `OrcamentoDoMesRepository` (2.0); o mês fechado, o retrato
- [ ] 6.3 — A auditoria de orçamento fora da leitura da coordenação
- [ ] 6.4 — Governança: a `parte`, a porcentagem e o aviso; sai a frase do custo não medido
- [ ] 6.5 — Painel: a linha "IA do mês", com os estados e o aviso
- [ ] 6.6 — `docs/interface.md` §3 com os textos da `cenarios.md` §4; o passo da Governança no roteiro da demonstração e no seu e2e
- [ ] 6.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/governanca/governanca.ts`, `packages/shared/src/governanca/governanca.test.ts` | alterado |
| `apps/api/src/governanca/governanca.service.ts`, `apps/api/src/governanca/governanca.repository.ts`, `apps/api/src/governanca/governanca.int.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/governanca/` (textos, tela, `api/governanca.ts` e os testes) | alterado |
| `apps/web/src/areas/coordenacao/painel/Painel.tsx`, `apps/web/src/areas/coordenacao/painel/Painel.test.tsx` | alterado |
| `e2e/governanca.spec.ts`, `e2e/painel-da-coordenacao.spec.ts`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/interface.md`, `docs/roteiro-da-demonstracao.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| o schema estrito recusa `tokens*` e `custoMicros` | U, I | RF12 | |
| a 79% `aviso = null`; a 80% exatos `80`; a 100% `100`; no mês seguinte e no `?mes=` fechado a 120%, `null` | I | `>=` e o mês corrente | |
| `parte` soma 100 (± arredondamento); zero token: `parte = 0` em todas | I | sem divisão por zero | |
| sem ano em curso e sem orçamento: sem porcentagem e sem aviso | I | `situacao` | |
| coordenação de A lê 20% e a de B 111% (`cenarios.md` §2) | I | escopo | |
| professor e aluno: 404; a auditoria de orçamento fora da leitura da coordenação | I | o papel; RF12 | |
| `EXPLAIN (ANALYZE, BUFFERS)` do `porFuncao`, num ano da maior escola | I | o índice | |
| os textos do Painel e da Governança sem "R$", "token" nem "crédito" | U | RF12, D40 | |
| Painel e Governança, o texto exato da `cenarios.md` §4 por estado: `definido`, aviso 80, aviso 100, `sem_orcamento`, `sem_aluno_ativo`; carregando; erro "…Tentar de novo" | U | §4 | |
| Governança: "Assistente de ensino: 41% do que a IA trabalhou no mês · 128 execuções"; carregando, erro, mês sem execução | U | o texto e os estados | |
| resposta fora do contrato: "Atualize a página" | U | a volta do código | |
| Painel e Governança a 360 px sem rolagem; alvo de 24 px; nada só por hover; aviso e porcentagem com texto | E2E | §4 | |

## Como testar

- API: `governanca.int.test.ts` › "o mês sem consumo responde zerado…"
- Painel: `Painel.test.tsx` › "o consumo do mês: carregando, erro que relê só o consumo…"
- Governança: `Governanca.test.tsx` › "o consumo do mês por função fica depois da tabela…"
- E2E: `e2e/painel-da-coordenacao.spec.ts` › "a escola com entregas…"; `e2e/governanca.spec.ts` › "a página não rola, a tabela
  vira lista no celular…"; `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- `npx vitest run --project integracao apps/api/src/governanca/governanca.int.test.ts`; `npx playwright test e2e/governanca.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/painel` (a linha "IA do mês", ao abrir) e `/coordenacao/governanca` (o
  consumo por função, ao abrir), de `COORDENACAO_ROUTES` em `apps/web/src/paths.ts`; sem mockup

## Fora do escopo desta tarefa

A Operação (7.0, 8.0); o sino (F13).

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
| `test-engineer`, tarefas | o `?mes=` de antes da F5 dá `sem_retrato`, sem texto na `cenarios.md` §4 | 6.6: fixar o texto em `docs/interface.md` e testá-lo |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 23:21:34 | 2026-11-20 23:23:32 | `test-engineer` | 1 | REPROVADO | a7d1dfc28dbf55c92 |
