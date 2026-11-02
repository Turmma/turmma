# Correção — o `tipo` do log mudou em 20 classes de erro e o runbook não acompanhou; três citações do caminho velho `infra/test/metrics.int.test.ts`

**Origem:** `tasks/prd-nomes-de-mercado/13_task.md`, "Recomendações sem aplicar" (infra-guardian 1ª e 2ª rodadas, revisor-geral 1ª), e `tools/renomear/mapas/13.relatorio.md:79`.
**Subagentes obrigatórios:** `infra-guardian` · `revisor-geral` · `tenancy-guardian` · `privacy-guardian` · `conformidade-reviewer`
<!-- O PEDIDO do Orquestrador ditou `infra-guardian`. O `revisor-geral` entra pelo limite do passo 5: a correção toca
     `tools/processo/` (dois testes com a citação do caminho velho). A Mesa conferiu a linha contra os arquivos alterados
     (`guardioes-por-caminho.ts`): `metrics.test.ts` e `runbook-tipo-do-log.test.ts` pedem os quatro guardiões, e entraram
     `tenancy-guardian`, `privacy-guardian` e `conformidade-reviewer` (DEVOLUÇÃO da Mesa 3). `test-engineer` é obrigatório em toda correção. -->

## Sintoma

`summarizeError` (`packages/core/src/error/summarize-error.ts`) grava `erro.name` no campo `tipo` do log. As ondas 3.0 a 8.0 da
X8 renomearam 20 classes de erro do servidor, e com elas o `tipo` do log (`FalhaDeJob` virou `JobFailureError`, `ErroParaAFila`
virou `QueueFacingError`…). Busca de log salva pelo operador com o nome antigo deixa de casar, sem erro nenhum, e o
`docs/runbook.md` não diz que o nome mudou nem qual é o novo. Separado: três arquivos citam `infra/test/metrics.int.test.ts`,
que se chama `infra/test/metricas.int.test.ts`.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A 13.0 era a tarefa de documento da X8, e o `13_task.md` não tinha item de runbook; o aviso de pouso do infra-guardian (7.0 e 8.0)
ficou no `estado.md` e a 13.0 não o recebeu como item. Nenhuma regra de alerta em `infra/grafana/alertas/` busca pelo `tipo`
antigo (conferido: nenhum dos 20 nomes antigos aparece em `infra/` nem em `docs/`), então o que falta é o aviso ao operador.
As três citações do caminho velho estão em código, fora do escopo de uma onda de documento
(`tools/renomear/mapas/13.relatorio.md:79`).

## Teste que reproduz

`tools/guardas/runbook-tipo-do-log.test.ts`:
- › "o runbook diz, para cada classe de erro renomeada, o `tipo` antigo e o novo" (vermelho: a seção não existe);
- › "o `tipo` novo de cada linha é o `name` de uma classe do código, e o antigo não é mais de nenhuma" (verde já no HEAD: guarda a tabela contra o desvio);
- › "nenhuma regra de alerta busca pelo `tipo` antigo" (verde já no HEAD: prova a "Causa");
- › "nenhum arquivo do repositório cita um arquivo de `infra/test/` que não existe" (vermelho: as três citações; o histórico de `tasks/` e dos
  mapas de renomeação fica de fora, e o nome de uma letra é entrada sintética de teste).

## Correção

Seção "Buscar um erro no log pelo `tipo`" no `docs/runbook.md`, com a tabela do `tipo` antigo para o novo, e as três citações
trocadas para `metricas.int.test.ts`. O `restos` (`tools/renomear/restos.test.ts`) lê o runbook como documento vivo e acusava os 20 nomes
antigos da tabela e o `ErroDoPostgres` (valor de `tipo` que o código mantém): entram na tabela "Troca à mão" de
`tools/renomear/mapas/13.relatorio.md`, que é como a ferramenta aceita um nome antigo citado de propósito (linhas do runbook conferidas).

Os dois vermelhos foram vistos antes da correção (2 falhas em 4 casos) e os quatro ficaram verdes depois. Esta correção só mexe em
documento e em teste: nenhuma linha de `apps/*/src` nem `packages/*/src` mudou (o `metrics.test.ts` é teste), então não há bloco de mutação.

**Sem mutação:** a correção só altera `docs/runbook.md`, teste e este documento; nenhum código de produção.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª) | `TIPOS_RENOMEADOS` é escrita à mão; "um 21º nome renomeado depois não seria cobrado por ninguém" / "Um caso a mais pode exigir que todo `name = '<X>'` do servidor seja um nome novo da lista ou esteja numa lista curta de exceções" | Recusada: a lista é a das 20 classes que a X8 renomeou, fato fechado; o 2º caso do teste já a segura contra o código nos dois sentidos e o test-engineer conferiu que hoje são exatamente os 20. Classe nova nasce com nome de mercado, e quem a pega é a guarda `guardas/nome-de-mercado` (tarefa 12.0). Nenhum RF trata disto. |
| infra-guardian (1ª), test-engineer (1ª) | "essa tabela libera o nome antigo pelo número da linha do runbook. Qualquer edição acima da linha 977 desloca a seção e faz o `restos` acusar os 21 nomes de novo" (`13.relatorio.md:74-94`) | Retro da X8: é defeito de como a ferramenta `restos` libera o nome antigo, não desta correção; o infra-guardian pediu o registro lá. |
| infra-guardian (1ª) | O caso de citação de `infra/test/` só pega arquivo `.ts`: "Uma citação quebrada a `infra/k6/` ou a outra pasta de `infra/` passaria" | Recusada: fora da Origem desta correção (as três citações de `infra/test/`); a recomendação do infra-guardian é condicional ("Se a guarda é para ficar"), sem defeito conhecido a corrigir. Nenhum RF trata disto. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 00:28:55 | 2026-11-02 00:29:07 | `tenancy-guardian` | 1 | APROVADO | a9cd0bec1388d1c8d |
| 2026-11-02 00:28:56 | 2026-11-02 00:29:19 | `privacy-guardian` | 1 | APROVADO | ac908a875dd7ebb9f |
| 2026-11-02 00:28:58 | 2026-11-02 00:29:20 | `conformidade-reviewer` | 1 | APROVADO | a77d05124abf9bb4b |
| 2026-11-02 00:28:53 | 2026-11-02 00:29:47 | `revisor-geral` | 1 | APROVADO | acbc9625e6e3947b5 |
| 2026-11-02 00:28:52 | 2026-11-02 00:30:34 | `infra-guardian` | 1 | APROVADO | ae001b4d941e3db22 |
| 2026-11-02 00:28:59 | 2026-11-02 00:30:59 | `test-engineer` | 1 | APROVADO | a2b5d2b39a02cea73 |
| 2026-11-02 00:37:17 | 2026-11-02 00:37:31 | `infra-guardian` | 2 | APROVADO | af3aeb8b14c9c857d |
| 2026-11-02 00:37:28 | 2026-11-02 00:37:39 | `tenancy-guardian` | 2 | APROVADO | ac95dfc055ac53eb7 |
| 2026-11-02 00:37:33 | 2026-11-02 00:37:48 | `privacy-guardian` | 2 | APROVADO | a88713f224d57ad05 |
| 2026-11-02 00:37:23 | 2026-11-02 00:37:52 | `revisor-geral` | 2 | APROVADO | a962c738255278725 |
| 2026-11-02 00:37:39 | 2026-11-02 00:37:53 | `conformidade-reviewer` | 2 | APROVADO | ad9edfe26c4523e2b |
| 2026-11-02 00:37:44 | 2026-11-02 00:38:58 | `test-engineer` | 2 | APROVADO | a0b7eb73efa8247c2 |
