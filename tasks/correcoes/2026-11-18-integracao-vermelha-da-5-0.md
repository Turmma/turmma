# Correção — a integração da esteira cai em 19 testes do Assistente, do Tutor e do artefato, com o adaptador chamado a mais

**Origem:** esteira run 44262036782 em `0b70fde8` (`gh run view 44262036782 --log-failed`): o job `integração`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `llm-integrator`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os quatro primeiros vieram no PEDIDO do Orquestrador. Os três últimos entram pela DEVOLUÇÃO da Mesa: os arquivos alterados são de `apps/api/test/`, que pede os guardiões de `guardioes-por-caminho.ts`. -->


## Sintoma

O job `integração` caiu em 19 casos de quatro arquivos: `apps/api/test/leitura-por-serie.int.test.ts` (10),
`apps/api/src/assistente/assistente.int.test.ts` (5), `apps/api/src/tutor/tutor-modelo.int.test.ts` (3) e
`apps/api/src/artefato/artefato.int.test.ts` (1). As mensagens são `expected "chamar" to not be called at all, but
actually been called 1 times`, `expected "chamar" to be called 1 times, but got 2 times`, `expected [ 1, 1, +0, +0 ] to
deeply equal [ 1, +0, +0, +0 ]` (execução, consumo, mensagens) e `pergunta removida: expected [ { candidatas: … } ] to
deeply equal []`. A integração passara em `d89816f5`, um commit antes da tarefa 5.0 (`792c2e6b`).

(O job `verificar` do mesmo run caiu em `ci:conferir-entregas`, por um commit do Joaquim sem a marca, `3209137c`, que não é
desta correção.)

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da **tarefa 5.0** (`792c2e6b`), vista só na esteira. A extração do PDF passou a agendar a classificação das seções
que gravou: `criarExtracaoDoPdf` cria as execuções e o job `ia.executar-lote` de cada uma, na transação da extração,
quando a função está ativa e a disciplina tem componente da BNCC (`agendarAClassificacao`). "Química" nasce com o componente
(`componenteDoNomeDaDisciplina`), e é a disciplina de toda escola de teste do Assistente, do Tutor e do artefato.

Esses testes não rodam a extração pelo worker: `esperarExtracao` e `extrairMaterial` (`apps/api/test/material.fixture.ts`)
montam `criarExtracaoDoPdf` com o banco da API do teste, e o `enfileirador` padrão grava o job de verdade em `job_registro`.
A API de teste do Assistente sobe com a fila de IA (`FilaDeIa`), que despacha e executa `ia.executar-lote` com o
`FakeAdapter`. O job da classificação, que ninguém pediu, chamava o modelo, gravava consumo e uma execução, e somava uma
chamada ao espião `chamar` de cada caso (`vi.spyOn(FakeAdapter.prototype, 'chamar')`) e uma linha às contagens de
`gastos`. O portão da 5.0 só rodou os arquivos que a tarefa alterou, e nenhum deles usa esse fixture com a fila de IA: é o
caso de "Quem usa o que mudou" do `executar-task`, que o documento da 5.0 não percorreu.

## Teste que reproduz

`apps/api/test/material.int.test.ts` › `envio com licença` › `a extração do teste não enfileira a classificação: o material
de Química fica `pronto` sem job `ia.executar-lote`…`. Envia o PDF de demonstração para a disciplina Química, roda a extração
do fixture e confere que o material ficou `pronto` e que não há job `ia.executar-lote` da escola. Vermelho antes
(`expected 1 to be +0`, o job da classificação), verde depois. Os 19 casos da esteira são a prova de ponta a ponta, rodados
isolados com o compose de teste.

## Correção

Só no fixture de teste, `apps/api/test/material.fixture.ts`: a extração do teste recebe um `enfileirador` que não enfileira
(`SEM_JOB_DA_CLASSIFICACAO`), nos dois pontos que a montam (`esperarExtracao` e `extrairMaterial`). A execução da seção ainda
nasce, `pendente`, sem job: o que o Assistente, o Tutor e o artefato contam (chamada ao modelo, consumo, mensagem) volta ao
que era. Nenhuma mudança em código de produção: a extração agenda a classificação como a 5.0 decidiu, e os testes dela
(`apps/worker/test/extrair-pdf.int.test.ts`, `classificacao-agendada.int.test.ts`, `agendamento.int.test.ts`) a cobrem.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

O mesmo enfileirador em `extrairMaterial` é só por consistência com `esperarExtracao`: os dois arquivos que o usam sobem a API sem a fila de IA, e a correção não depende dessa troca. Por isso não tem bloco de mutação nem caso próprio.

```mutacao
arquivo: apps/api/test/material.fixture.ts
teste: apps/api/test/material.int.test.ts › a extração do teste não enfileira a classificação
falha: toBe(0)
-  const processador = criarExtracaoDoPdf({ banco, armazem, extrator: extratorDe(api), logger, enfileirador: SEM_JOB_DA_CLASSIFICACAO })
+  const processador = criarExtracaoDoPdf({ banco, armazem, extrator: extratorDe(api), logger })
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | O falso do fixture não guarda o que recebeu; expor uma lista dos tipos pedidos para o caso novo confirmar que a extração pediu o job e o falso o descartou | Recusada: muda o desenho do fixture. Que a extração agenda a classificação já é provado por `apps/worker/test/extrair-pdf.int.test.ts`, `apps/worker/test/classificacao-agendada.int.test.ts` e `apps/worker/test/agendamento.int.test.ts` (citados na "Correção" do documento); o caso novo prova só a ausência do job, que é o que a correção muda |
| test-engineer (1ª) | O nome do caso em `apps/api/test/material-edicao.int.test.ts:887` ("a seção da edição vai à classificação") promete mais do que prova, com o job desligado no fixture | `TODO.md`: arquivo que esta correção não toca; trocar o nome ou acrescentar a asserção da execução criada para a seção na próxima tarefa que tocar `material-edicao.int.test.ts` |
| conformidade-reviewer (1ª) | Quando a classificação BNCC alimentar o diagnóstico por habilidade (AIA, regra 70 item 6a), a cobertura vem dos testes do worker, não destes; lembrar na revisão da spec | Fica para a retro da classificacao-bncc e para a revisão da AIA; nada a mudar no código desta correção |
| revisor-geral (1ª), test-engineer (1ª) | Lição para a retro: tarefa que muda o comportamento padrão de algo que um fixture compartilhado monta deve listar, em "Quem usa o que mudou", os arquivos que usam o fixture, e o portão local deveria rodá-los | Retro da classificacao-bncc (Arquiteto): é mudança de processo (`executar-task`, portão), fora do escopo desta correção |
| conformidade-reviewer (1ª), test-engineer (1ª) | Falta caso próprio para a troca em `extrairMaterial` | Já tratada no item 3 (documento diz que é consistência); caso novo recusado, porque os dois arquivos que usam `extrairMaterial` sobem a API sem a fila de IA, e a RF17 não se aplica a `apps/api/test/` |
| revisor-geral (2ª), test-engineer (2ª) | `apps/api/test/material.int.test.ts:164-165`: `select estado from execucao_agente where escola_id = $1` sem `order by`, com igualdade exata `[{ estado: 'pendente' }]`, só se mantém enquanto o PDF de demonstração der uma seção; trocar por "toda linha `pendente` e pelo menos uma" (ou filtrar por `material_id`) | Recusada: a igualdade exata é o que prova que só a execução da seção nasceu, e só quebra se `tools/demonstracao/conteudo-estequiometria.ts` ganhar seções, caso em que o `toEqual` mostra as linhas a mais; quem mudar o PDF afrouxa a asserção |
| test-engineer (2ª) | O nome do caso (`material.int.test.ts:153`) não cita a segunda metade, que a execução da seção continua nascendo `pendente` | Recusada: o comentário da asserção diz o que ela prova; o nome já diz o que a correção muda |
| revisor-geral (2ª) | `material.fixture.ts:171`: "`ja_enfileirado` é só o tipo que cabe" fica falso se `agendar` passar a ler `situacao`; um teste de unidade ou um tipo mais estreito no lugar do comentário | A tarefa que tocar `agendar` (`packages/core/src/material/agendamento-da-classificacao.repository.ts`) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 05:52:05 | 2026-11-18 05:52:22 | `llm-integrator` | 1 | APROVADO | a1e3f83b325e28e7d |
| 2026-11-18 05:52:07 | 2026-11-18 05:52:25 | `tenancy-guardian` | 1 | APROVADO | a8eb6ebe631c93dde |
| 2026-11-18 05:52:04 | 2026-11-18 05:52:25 | `revisor-geral` | 1 | APROVADO | a8e9f72e4a767e8c1 |
| 2026-11-18 05:52:09 | 2026-11-18 05:52:27 | `conformidade-reviewer` | 1 | APROVADO | a70e5b1c6f7349d8c |
| 2026-11-18 05:52:08 | 2026-11-18 05:52:28 | `privacy-guardian` | 1 | APROVADO | a466f1786ffd68d7c |
| 2026-11-18 05:52:06 | 2026-11-18 05:52:30 | `infra-guardian` | 1 | APROVADO | ab7b4716f05f87fc0 |
| 2026-11-18 05:52:03 | 2026-11-18 05:54:34 | `test-engineer` | 1 | APROVADO | adf9a490d948b2e10 |
| 2026-11-18 06:02:21 | 2026-11-18 06:02:49 | `revisor-geral` | 2 | APROVADO | a0060161cbf671e96 |
| 2026-11-18 06:02:16 | 2026-11-18 06:02:53 | `test-engineer` | 2 | APROVADO | a22df97dd0e3cc850 |
