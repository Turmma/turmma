# Correção — `mensagemDoAssistente` não filtra a mensagem pelo ano letivo em curso

**Origem:** `tasks/prd-nomes-de-mercado/13_task.md`, "Recomendações sem aplicar" (tenancy-guardian, 2ª rodada).
**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou três guardiões; a Mesa devolveu a rodada porque `portao-local.ts revisores` lista os cinco para
     arquivo de apps/, e o `infra-guardian` entrou por isso. A correção leva 2 arquivos fora de tasks/ (o repository e o teste) e não toca
     `.github/`, `tools/ci/` nem `tools/processo/`, então o `revisor-geral` não é obrigatório pelo limite do passo 5. -->

## Sintoma

`ExecucaoDaSessaoRepository.mensagemDoAssistente` (`apps/api/src/ia/execucao.repository.ts`) filtra a mensagem por escola, id, autor e
dono da thread, mas não por `mensagemAgente.anoLetivoId`. O `innerJoin` com `thread_agente` só iguala o ano da mensagem ao da
thread. Com o contexto no ano em curso, a resposta do Assistente de um ano anterior da mesma pessoa é achada pelo id. As outras
leituras da classe (`daChave`, `deQuemPediu`) já filtram por `requireAnoEmCurso()`.

## Fora desta correção

A árvore estava limpa. `mensagemDoTutor` (`execucao.repository.ts`) tem a mesma lacuna: `mensagem_tutor` tem `anoLetivoId` e a consulta
não filtra por `requireAnoEmCurso()`. Fica para uma correção irmã, aberta pelo Orquestrador, com teste do mesmo formato do caso novo
(ver "Recomendações sem aplicar").

## Causa

A cláusula de ano letivo nunca entrou nesta consulta (regra 10, item 2). O teste de isolamento vizinho só trocava a escola, e a
mensagem de B continuava fora do alcance sem ela; nenhum caso punha uma mensagem de outro ano da mesma escola e da mesma pessoa.
Pré-existente à X8; achada pelo tenancy-guardian na 2ª rodada da 13.0.

## Teste que reproduz

`apps/api/src/ia/ia.int.test.ts` › `GET /v1/execucoes/:id` › `a resposta do Assistente é do ano letivo em que foi dada: no ano em curso, a de um ano anterior da mesma pessoa não é achada`.
Vermelho antes da cláusula (a mensagem de 2025 é achada no contexto de 2026), verde depois; no contexto do ano dela, é achada.

## Correção

O `where` de `mensagemDoAssistente` ganhou `eq(mensagemAgente.anoLetivoId, requireAnoEmCurso())`, ao lado da cláusula de escola. Sem
ano em curso no contexto o método lança `NAO_ENCONTRADO` antes de ler, como `daChave` e `deQuemPediu`. O caso vizinho de isolamento
por escola (`a cláusula de escola das mensagens vale por si`) passou a pôr o ano letivo no contexto, porque o método agora o exige.
Rota `GET /v1/execucoes/:id` não muda: a sessão sempre traz o ano em curso.

O caso de isolamento por escola passou a pôr no contexto a escola A com a pessoa **e o ano** de B (e `naEscola` recebe o ano, sempre),
para que só a cláusula de escola o segure; sem isso a cláusula nova de ano a esconderia. O caso novo também prova o
`NAO_ENCONTRADO` sem ano em curso.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), conformidade-reviewer (1ª), infra-guardian (1ª) | `mensagemDoTutor` tem a mesma lacuna de ano letivo; pedem correção irmã com teste do mesmo formato do caso novo | Correção irmã própria: muda comportamento do repository e pede teste e mutação novos. Pré-existente, e a rota já passa por `deQuemPediu`, que filtra o ano. Abrir a correção é do Orquestrador |
| privacy-guardian (1ª) | A resposta do Assistente de um ano anterior continua no banco, na retenção e no arquivo do titular; a correção só a tira da leitura no ano em curso | Sem ação: nota informativa |
| infra-guardian (1ª) | Sem ano no contexto a rota já respondia `NAO_ENCONTRADO` por `deQuemPediu`: a correção não abre caminho novo de erro | Sem ação: confirmação |
| tenancy-guardian (2ª), test-engineer (2ª) | `mensagemDoTutor` não filtra por `requireAnoEmCurso()`; correção irmã com caso de ano anterior e o bloco `mutacao` dele | Já em "Fora desta correção" e na 1ª linha desta tabela: correção irmã, aberta pelo Orquestrador |
| tenancy-guardian (2ª) | O caso de escola passa `b.anoLetivoId` a `mensagemDoTutor`, que ainda não o lê | Sem ação: o contexto já fica pronto para a correção irmã |
| test-engineer (2ª) | As consultas que pegam os ids do caso de escola usam `limit 1` sem filtrar por ano; `ano_letivo_id = b.anoLetivoId` firmaria o caso se B ganhasse mensagens de outro ano | Correção irmã de `mensagemDoTutor`, que toca as mesmas linhas do mesmo caso: o filtro de ano das consultas entra junto com o teste do Tutor. Hoje B só tem mensagens do próprio ano, então o caso vale |

## Mutações

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › a resposta do Assistente é do ano letivo em que foi dada: no ano em curso, a de um ano anterior da mesma pessoa não é achada
-      .where(and(eq(mensagemAgente.escolaId, escolaId), eq(mensagemAgente.anoLetivoId, requireAnoEmCurso()), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, requireUsuarioId())))
+      .where(and(eq(mensagemAgente.escolaId, escolaId), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, requireUsuarioId())))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › a cláusula de escola das mensagens vale por si: com a pessoa de B e a escola A no contexto, a mensagem de B não é achada
-      .where(and(eq(mensagemAgente.escolaId, escolaId), eq(mensagemAgente.anoLetivoId, requireAnoEmCurso()), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, requireUsuarioId())))
+      .where(and(eq(mensagemAgente.anoLetivoId, requireAnoEmCurso()), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, requireUsuarioId())))
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 00:16:26 | 2026-11-02 00:16:43 | `infra-guardian` | 1 | APROVADO | a8e702e4452618160 |
| 2026-11-02 00:16:24 | 2026-11-02 00:16:48 | `privacy-guardian` | 1 | APROVADO | a21e78e752e3d568a |
| 2026-11-02 00:16:25 | 2026-11-02 00:16:51 | `conformidade-reviewer` | 1 | APROVADO | af96c9d1a450bf3e5 |
| 2026-11-02 00:16:22 | 2026-11-02 00:17:12 | `test-engineer` | 1 | REPROVADO | ae1b12e41fd74fa07 |
| 2026-11-02 00:16:24 | 2026-11-02 00:17:13 | `tenancy-guardian` | 1 | REPROVADO | ad3370327b371f07d |
| 2026-11-02 00:33:02 | 2026-11-02 00:33:27 | `tenancy-guardian` | 2 | APROVADO | a6ccf31c1c7bf50ea |
| 2026-11-02 00:32:56 | 2026-11-02 00:33:30 | `test-engineer` | 2 | APROVADO | af49bd5a7c7f91a19 |
