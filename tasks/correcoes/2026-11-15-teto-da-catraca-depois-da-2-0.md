# Correção — o TETO da catraca ficou um acima da linha de base depois do merge da 2.0 com a 12.0

**Origem:** esteira run 43758821119, na spec em `025fbf92`: `tools/guardas/catraca.test.ts`, 2 casos vermelhos.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `test-engineer` e `revisor-geral` vieram no PEDIDO do Orquestrador. A Mesa conferiu a linha contra os arquivos alterados: o
     caminho `tools/guardas/` pede os quatro guardiões do PADRAO de `guardioes-por-caminho.ts`, e eles entram aqui. A correção leva
     1 arquivo fora de tasks/ e não toca o código de produção. -->

## Sintoma

`catraca.test.ts` › `cita só as quatro regras de tamanho, e a soma por regra é o TETO` e › `nenhum arquivo ganhou supressão
desde o HEAD` caem com `complexity: 233 supressões, o TETO é 234`.

## Fora desta correção

Nada: a árvore estava limpa e o pedido não traz arquivos de tarefa em curso.

## Causa

Falha de duas linhas somadas, vista só no encontro. A tarefa 2.0 (linha 3, `2e1f5fbd`) deixou a base com `complexity: 234` e o
`TETO` com 234; a 12.0 (linha 1, `58b683bf`) já tinha baixado a dela de 238 para 236 (soma e `TETO` em 236). Cada linha estava
verde no portão dela. No merge `7fcbb591`, a 12.0 trouxe a baixa de `apps/web/src/api/client.ts` (`complexity` de 2 para 1), e a
soma ficou em 233, enquanto o `TETO` do arquivo de teste, em conflito textual resolvido para o lado da 2.0, ficou em 234. A
catraca exige `TETO` igual à soma ("quem corta baixa os dois, no mesmo commit"), e o `TETO` ficou um acima.

## Teste que reproduz

`tools/guardas/catraca.test.ts` › `a linha de base do repositório (eslint-suppressions.json)` › os dois casos acima: vermelhos no
HEAD `025fbf92` (`npx vitest run --project unidade tools/guardas/catraca.test.ts -t "linha de base do repositório"`, "2 failed"),
verdes depois da correção.

## Correção

`TETO.complexity` de 234 para 233 em `tools/guardas/catraca.test.ts`, igual à soma de `eslint-suppressions.json`. A base não
muda: o merge já a deixou certa, e o caso `npm run lint está verde com a linha de base` do mesmo arquivo confere que nenhuma
supressão ficou órfã.

## Mutações

Nenhuma cláusula nova: o diff só baixa o número do `TETO`. A prova é a própria catraca, que fica vermelha com o `TETO` em 234
(o estado de antes) e verde com 233.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 19:13:24 | 2026-11-15 19:13:31 | `tenancy-guardian` | 1 | APROVADO | a73f034f6e0732022 |
| 2026-11-15 19:13:23 | 2026-11-15 19:13:33 | `revisor-geral` | 1 | APROVADO | afaca873e9b7b3c36 |
| 2026-11-15 19:13:25 | 2026-11-15 19:13:36 | `privacy-guardian` | 1 | APROVADO | a737de5dcfddb6725 |
| 2026-11-15 19:13:26 | 2026-11-15 19:13:37 | `conformidade-reviewer` | 1 | APROVADO | a410fea2454f313f5 |
| 2026-11-15 19:13:27 | 2026-11-15 19:13:38 | `infra-guardian` | 1 | APROVADO | a99c963340950ea9e |
| 2026-11-15 19:13:22 | 2026-11-15 19:14:51 | `test-engineer` | 1 | APROVADO | a852baeaaf9f878c3 |
