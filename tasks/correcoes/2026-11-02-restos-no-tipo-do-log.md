# Correção — o teste do `tipo` do log cita 21 nomes antigos como texto e deixa o `restos` vermelho na esteira

**Origem:** esteira run 41384620297 (`5d6c2e0`), `tools/renomear/restos.test.ts:344` (caso "a árvore não tem resto dos mapas aplicados").
**Subagentes obrigatórios:** `test-engineer` · `infra-guardian` · `revisor-geral` · `tenancy-guardian` · `privacy-guardian` · `conformidade-reviewer`
<!-- O PEDIDO do Orquestrador ditou `infra-guardian`. `test-engineer` é obrigatório em toda correção. A Mesa conferiu a linha contra os
     arquivos alterados (DEVOLUÇÃO da Mesa 3): `tools/guardas/` pede os quatro guardiões (`guardioes-por-caminho.ts`) e a correção
     com código de processo pede `revisor-geral` (`portao.ts:337`). -->

## Sintoma

`node tools/renomear/restos.ts` acusa 21 nomes antigos em `tools/guardas/runbook-tipo-do-log.test.ts`: os 20 `tipo` antigos da tabela
`TIPOS_RENOMEADOS` (linhas 13 a 32, cada um como string) e `ErroDaApi`, citado no comentário da linha 7. O arquivo nasceu na correção
`2026-11-02-runbook-tipos-de-erro`, depois da última onda, e o `restos` cobra o nome antigo em string e em comentário de qualquer
arquivo fora de `tools/renomear/`, `docs/`, `tasks/` e do protótipo.

## Fora desta correção

Nada: a árvore estava limpa. A L1 corre `reaplicar-filtra-arquivo` em `tools/renomear/restos.ts`, `restos.test.ts` e `mapas/13.json`; esta
correção não toca nenhum deles.

## Causa

A correção `2026-11-02-runbook-tipos-de-erro` escreveu a lista dos nomes antigos à mão no teste. O `restos` olha o `de` de todos os
mapas aplicados e o teste, que fica em `tools/guardas/`, não está entre as pastas isentas. A correção anterior liberou a mesma citação no
runbook pela tabela "Troca à mão" (`13.relatorio.md`), que libera por número de linha; o teste ficou de fora e a esteira pegou.

## Teste que reproduz

`tools/renomear/restos.test.ts` › "restos na árvore" › "a árvore não tem resto dos mapas aplicados" (vermelho no HEAD: 21 restos; é o
teste que a esteira reprovou, e não se edita). Também `node tools/renomear/restos.ts` (sai 1 com os 21). O próprio
`runbook-tipo-do-log.test.ts` ganha um caso: "cada `tipo` novo tem um único nome antigo nos mapas da renomeação".

## Correção

O teste deixa de repetir o nome antigo: a lista passa a ser só dos 20 nomes novos, e o antigo de cada um vem dos mapas da renomeação
(`tools/renomear/mapas/*.json`, entrada `simbolo` com `para` igual ao nome novo), que é a fonte onde o `de` já mora e onde o `restos`
o libera. Assim um 21º nome renomeado não precisa de edição em dois lugares, e não há nome antigo a liberar. O comentário do `ErroDaApi`
passa a dizer "o erro do cliente web". Um caso novo prova que cada nome novo tem exatamente um antigo nos mapas (se um mapa mudar e
a derivação ficar ambígua ou vazia, o teste acusa em vez de passar em branco).

**Sem mutação:** a correção só altera teste e este documento; nenhum código de produção.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | "`expect(tiposRenomeados()).toHaveLength(TIPOS_NOVOS.length)` dentro de cada caso" que usa `tiposRenomeados()` | Recusada: o caso "cada `tipo` novo tem um único nome antigo nos mapas da renomeação" já falha se algum dos 20 ficar sem antigo, e o JSDoc de `tiposRenomeados` deixa essa dependência escrita. O revisor mesmo diz que "hoje o caso novo impede isso". |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 10:59:36 | 2026-11-02 10:59:45 | `tenancy-guardian` | 1 | APROVADO | a6302c6b769caf32a |
| 2026-11-02 10:59:34 | 2026-11-02 11:00:16 | `infra-guardian` | 1 | APROVADO | a8fff65f6c21ba182 |
| 2026-11-02 10:59:37 | 2026-11-02 11:00:23 | `privacy-guardian` | 1 | APROVADO | aa535cbe7b6556a9b |
| 2026-11-02 10:59:38 | 2026-11-02 11:00:26 | `conformidade-reviewer` | 1 | APROVADO | ac372ce3c1d0ae616 |
| 2026-11-02 10:59:35 | 2026-11-02 11:00:36 | `revisor-geral` | 1 | APROVADO | a991809201ea21bcd |
| 2026-11-02 10:59:33 | 2026-11-02 11:00:44 | `test-engineer` | 1 | APROVADO | a6f4ebf97cccc7119 |
| 2026-11-02 11:07:35 | 2026-11-02 11:07:50 | `revisor-geral` | 2 | APROVADO | ad43a4f96938db21a |
| 2026-11-02 11:07:28 | 2026-11-02 11:07:57 | `test-engineer` | 2 | APROVADO | a86e0387744c560f2 |
