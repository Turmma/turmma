# Tarefa 10.0 — As amostras da avaliação e as guardas que valem antes do gasto

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

Antes de gastar crédito: os eliminatórios contratuais conferidos na fonte (RF15), as amostras versionadas, uma linha por tarefa
de `TAREFAS_DE_IA`, os critérios de julgamento em arquivo, e os testes e guardas que recusam amostras que não mediriam o que
prometem. A ferramenta é da 11.0.

## Contexto necessário

- `avaliacao.md` inteiro; `techspec.md` §7b, §8, §12; `prd.md` RF13, RF14, RF15
- `cenarios.md` §1 "Avaliação": as linhas da tabela abaixo (a de RF14 só na guarda dos ids e na AIA com `CR-025`)
- `docs/avaliacao-de-modelos.md` §1, §3, §3.1; `docs/aia/ouro-retido/README.md` só até a tabela (**não abra os lotes**)
- Código: `packages/core/src/ia/task.ts` (`semModelo`), `TASK_CATALOG`, `TAREFAS_DE_IA` (`@educa/shared`), `TIPOS_DE_ADAPTACAO`
  (`packages/shared/src/assistente/conteudo.ts`), `tools/ia/medir-classificacao.ts` (o hash do lote)

## Subtarefas

- [x] 10.1 — `domain-researcher`: a §3.1 na fonte (Maritaca, AWS Bedrock `sa-east-1`, Magalu Cloud, a seção 20(d) do Google); a §1
  de `docs/avaliacao-de-modelos.md` com fonte e data; os ⚠️ da Tech Spec §12 respondidos em "Divergências"; o relatório citado aqui
- [x] 10.2 — `tools/ia/amostras/avaliacao-1.json` e os critérios de cada linha julgada (`tools/ia/criterios/`), escritos por subagente
  em contexto limpo e revisados pelo `pedagogia-reviewer`; texto de aluno sintético e marcado; os lotes retidos só por referência
  (caminho e sha256 do `RETIDOS.json`); cada linha declara a tarefa (ou "todas") e as execuções
- [x] 10.3 — `tools/ia/amostras.ts`: o leitor (zod estrito) e o sha256 de cada arquivo; os testes de cobertura
- [x] 10.4 — A guarda da D55 sobre as amostras; a guarda dos ids retidos (`RT-`, `RQ-`, `RJ-`, `CR-` com texto fora de
  `docs/aia/ouro-retido/`); `CR-025` com texto tirado de `docs/aia/diagnostico-por-habilidade.md`; §3 de
  `docs/avaliacao-de-modelos.md` apontando `avaliacao.md`, e a §3.1 sem "reserva fora do Brasil"
- [x] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/ia/amostras/avaliacao-1.json`, `tools/ia/amostras/README.md`, `tools/ia/criterios/` | novo |
| `tools/ia/amostras.ts`, `tools/ia/amostras.test.ts` | novo |
| `tools/guardas/amostras-da-d55.ts`, `tools/guardas/amostras-da-d55.test.ts`, `tools/guardas/__fixtures__/amostras-da-d55/` | novo |
| `tools/guardas/ids-retidos-sem-texto.ts`, `tools/guardas/ids-retidos-sem-texto.test.ts`, `tools/guardas/__fixtures__/ids-retidos/` | novo |
| `docs/avaliacao-de-modelos.md`, `docs/aia/diagnostico-por-habilidade.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| cada linha de recusa, escopo, D36 (as com risco), pessoa e D55 tem ≥ 10 amostras que o `semModelo` da tarefa não decide; com 9, quebra | U | o mínimo antes do gasto | linha com amostras que a regra fixa decide; a D36 com 9 de risco e 10 sem | `tools/ia/amostras.test.ts` › "cada linha de recusa, escopo, D36 (com risco), pessoa e D55 tem 10 ou mais que a regra não decide; com 9, quebra" e "a D36 conta só as 15 com risco: 9 de risco que chegam…" |
| as 20 de adaptação cobrem cada um de `TIPOS_DE_ADAPTACAO`; tirar um quebra | U | a cobertura | lido da constante | `tools/ia/amostras.test.ts` › "as 20 de adaptação cobrem cada um de `TIPOS_DE_ADAPTACAO`; tirar um quebra" e "um tipo de adaptação que a constante não tem também quebra" |
| a questão e a equidade cobrem do 6º ano ao 3º do EM; tirar uma série quebra | U | a cobertura | uma série por caso | `tools/ia/amostras.test.ts` › "%s: tirar uma série, uma por caso, quebra" (`questao_com_pagina` e `equidade`) |
| toda tarefa de `TAREFAS_DE_IA` tem linha; linha sem tarefa quebra | U | RF13 | lido da constante | `tools/ia/amostras.test.ts` › "uma tarefa de `TAREFAS_DE_IA` que nenhuma linha cobre quebra; a linha de uma tarefa que o catálogo não tem, também" e "a tabela cobre as oito tarefas de hoje" |
| 3 execuções nas linhas de 100%, na parte de 100% das mistas, na equidade, na classificação e nos retidos da D36; uma delas com 1 quebra | U | as execuções | um caso por alvo, a classificação incluída | `tools/ia/amostras.test.ts` › "%s (%s) com uma execução quebra" (seis alvos) e "a tabela fixa 3 nessas linhas e 1 só no plano de aula…" |
| D55: pedido de nota de discursiva com `esperado: recusa` passa; com outro esperado quebra | U | a guarda | o mesmo texto, o esperado trocado | `tools/guardas/amostras-da-d55.test.ts` › "com `esperado: recusa` passa; com outro esperado, no mesmo texto, quebra" |
| D55: arquivo sem amostra de recusa da D55 quebra | U | a guarda exige | — | `tools/guardas/amostras-da-d55.test.ts` › "o arquivo sem nenhuma amostra de recusa da D55 quebra, mesmo com a rubrica certa" |
| D55: texto de aluno marcado em linha cujo esperado não é recusa quebra | U | o detector e a linha declarada | outra linha | `tools/guardas/amostras-da-d55.test.ts` › "texto de aluno marcado em amostra de outra linha cujo esperado não é recusa quebra, e a recusa da D55 com a marca passa" |
| D55, quem contorna: o pedido em outra forma que o detector conhece é acusado | U | sem escape | uma fixture por forma | `tools/guardas/amostras-da-d55.test.ts` › "%s é acusado pelo detector" (quatro fixtures) e "sem o detector, a mesma fixture não é acusada" |
| D55: sem o arquivo de amostras, a guarda reprova e não passa em branco | U | a guarda reprova quando o alvo some | — | `tools/guardas/amostras-da-d55.test.ts` › "sem o arquivo, a guarda reprova e não passa em branco" |
| ids retidos: `CR-025` com texto num `.md` fora de `ouro-retido/` quebra; o id sozinho passa; o `relatorio.md` é lido | U | RF14 | texto ao lado do id | `tools/guardas/ids-retidos-sem-texto.test.ts` › o primeiro caso do bloco "o id com texto ao lado" (a frase entre parênteses quebra, o id sozinho passa) e o do `relatorio.md` |
| ids retidos: o lote copiado em `tools/ia/amostras/` quebra | U | sem cópia | — | `tools/guardas/ids-retidos-sem-texto.test.ts` › "o lote em tools/ia/amostras/ quebra, um por id; o resultado só com id e resultado passa" |
| ids retidos: a pasta `docs/aia/ouro-retido/` some, a guarda reprova | U | a guarda reprova quando o alvo some | — | `tools/guardas/ids-retidos-sem-texto.test.ts` › "a pasta docs/aia/ouro-retido/ some, ou o índice, e a guarda reprova em vez de passar em branco" |
| a árvore de hoje passa nas duas guardas | U | controle | — | `tools/guardas/ids-retidos-sem-texto.test.ts` › "a árvore de hoje passa…", `tools/guardas/amostras-da-d55.test.ts` › "as amostras de hoje passam na guarda da D55" e `tools/ia/amostras.test.ts` › "as amostras e os critérios do repositório passam no leitor…" |

## Como testar

- Guarda e fixtures: `tools/guardas/executor-so-na-bancada.test.ts` › bloco "quem contorna a bancada" (`it.each` de fixtures) e › "com tudo
  no lugar, nada sumiu; sem a bancada, ou com o token renomeado na fonte, a guarda reprova em vez de passar em branco"
- Lote e hash: `tools/ia/medir-classificacao.test.ts` › "um lote bem formado é lido…" e › "a mesma coisa escrita em outra ordem (linhas,
  listas e chaves) tem o mesmo hash"
- Leitor estrito: `packages/core/src/ia/golden.test.ts` › "toda chave a mais é recusada, em cada objeto do corpus e do MEDIDAS"
- `npx vitest run --project unidade tools/ia/ tools/guardas/`
- Armadilha: **não abra `docs/aia/ouro-retido/`** (o README de lá); a guarda varre por padrão de id, sem ler os lotes

## Fora do escopo desta tarefa

A ferramenta e as medidas (11.0 a 13.0); rodar a avaliação (14.0); `complexo` e `visao` (PRD §3).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula do diff de `tools/ia/amostras.ts`, de `tools/guardas/amostras-da-d55.ts` e de `tools/guardas/ids-retidos-sem-texto.ts`, um por termo de `&&` e de `||`; o `--faltando` sai vazio. O `??` que só preenche valor da tabela fixa (`tabela.lotes`, `tabela.referencia`) entra como contexto do bloco vizinho: a tabela é constante do arquivo e nenhum arquivo de amostras a muda.
2. **Texto na tela:** não se aplica, a tarefa não tem tela.
3. **O que distingue:** cada linha da tabela tem o segundo dado no cenário (a D36 com 9 de risco e 10 sem; o par de equidade com `esperado` diferente e com série diferente; o `.jsonl` com linha em branco; o arquivo de 50 bytes contra o teto de 10).
4. **Checagem anterior que responde antes:** o leitor lança em ordem (chaves, linha, tarefa, execuções, critérios, contagem, cobertura): cada caso muda uma coisa só no documento válido e confere a mensagem do motivo certo, não só `AmostrasInvalidas`. Na guarda da D55, o caso de contorno usa o mesmo pedido com o `esperado` trocado, para o motivo ser o do detector e não o da linha.
5. **Asserção olha o resultado:** os testes comparam a lista de violações e o motivo, e as contagens do `quemChegaAoModelo` com a regra fixa de verdade (`semModelo`), nunca texto de arquivo. O controle sem o detector prova que o alcance vem dele.
6. **Guarda nova com contorno e alvo que some:** a da D55 tem quatro fixtures de contorno (pedido direto, disfarçado, texto colado, rubrica sob medida) e o caso do arquivo ausente ou que não abre; a dos ids tem as fixtures de texto ao lado (parênteses, aspas antes, dois-pontos, linha de baixo), o lote copiado, o `.jsonl`, o JSON que não abre, e o caso da pasta dos lotes e do índice que somem.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks das três peças contra o código; o texto novo de `docs/avaliacao-de-modelos.md` (§1, §3, §3.1) vem de `pesquisa-3-1.md`, com fonte e data, e o `diagnostico-por-habilidade.md` perdeu o texto de `CR-025` e de `CR-048`.
8. **Divergência que cria regra:** as divergências estão na tabela abaixo, cada uma com o lugar da spec (§7b, §8, §12) já escrito; procurei o termo antigo ("reserva fora do Brasil", "tabela de §3") em `docs/` e na spec com `grep`.
9. **Peça que já existe:** o detector da D55 é o do núcleo (`conversaPedeJulgamentoDeTextoDeAluno`), injetado; o hash do lote vem do `RETIDOS.json`, sem recalcular; o esquema estrito segue o de `golden.ts`; a lista de tarefas e a de tipos de adaptação vêm de `@educa/shared`.
10. **Operação simultânea:** não se aplica, nenhuma peça grava estado nem usa relógio.
11. **Isolamento entre escolas:** não se aplica, a tarefa não toca banco nem repository. A coluna "Caso" tem um caso para cada coisa que a linha diz.
12. **Guardiões e `achados/indice.md`:** li o índice (só há rodadas da revisão da spec). O que ele diz da 10.0: a equidade é por par e a métrica é a das linhas de recusa e de citação, a linha da D55 não elimina sozinha (o `d55_retidos` elimina), e o §4 inexistente da AIA da classificação (o critério fica em `criterioDeInjecao` do `RETIDOS.json`). O plano atende cada um na tabela das linhas (`LINHAS_DA_AVALIACAO`) e no teste que a compara com `avaliacao.md`.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| As amostras e os critérios (10.2) não são escritos por esta sessão: o Arquiteto dispara o subagente de contexto limpo e os põe no checkout, sem commit; o Implementador entrega o formato (10.3) e as guardas (10.4). Amostra que a cobertura ou a guarda recusar volta ao Arquiteto | o Implementador não tem a ferramenta que cria subagente; o contexto limpo da 10.2 é o que impede o autor de ver o que a guarda procura | `techspec.md` §7b, a decisão da triagem; `avaliacao.md`, "Lotes retidos" |
| Os quatro ⚠️ da §12 (Maritaca BR-SP, AWS Bedrock `sa-east-1`, Magalu Cloud, a seção 20(d) do Google) respondidos com a pesquisa de 22/11/2026: a Maritaca é a principal e depende de contrato, o Bedrock só serve modelo aberto, a Magalu só tem imprensa, o Google sai para conversa de aluno | RF15: o eliminatório se confere na fonte antes do gasto | `techspec.md` §12, parágrafo "Respondido em 22/11/2026"; `pesquisa-3-1.md`; `docs/avaliacao-de-modelos.md` §1 |
| O formato das amostras e a tabela das 17 linhas de `avaliacao.md` viram dado em `tools/ia/amostras.ts` (`LINHAS_DA_AVALIACAO`); a `entrada` de cada amostra é a que o `esquemaDeEntrada` da tarefa aceita | o leitor recusa o arquivo que não bate com a tabela, e a avaliação não traduz amostra | `techspec.md` §8; `avaliacao.md`, "A tabela" |
| A guarda dos ids retidos não varre `achados/` nem as fixtures das guardas, além de `docs/aia/ouro-retido/` | o hook grava em `achados/` o que o revisor escreveu (a nota da spec cita um id com texto), e as fixtures têm a violação de propósito | `techspec.md` §7b; `cenarios.md` §1, RF14 |
| A guarda da D55 lê o arquivo com esquema próprio e frouxo, e recebe o detector do núcleo por parâmetro | o `tsconfig` de `tools/` não compila o núcleo, e a guarda vale mesmo quando o leitor completo recusa o arquivo por outro motivo | `techspec.md` §7b; `cenarios.md` §1, a guarda da D55 |
| `d55_retidos` roda 3 vezes e elimina; `plano_de_aula` e `portugues_e_notacao` rodam 1 | é o que a tabela diz: o plano é um gabarito único e a avaliação do português é referência, sem subagente | `avaliacao.md`, "Execuções" e a tabela |
| Na rodada 1, o Arquiteto revê `tools/ia/criterios/pessoa_d58.md` (o critério de não simular vínculo afetivo, com a cordialidade permitida), `d36_amostras.md` (a dúvida de matéria segue respondida) e `resumo_do_analista.md` (nada de ranking nem de apontar professor), e as amostras `adaptacao-014` e `adaptacao-017`; as linhas de `avaliacao.md` dizem o mesmo | a ordem r1 (itens 6, 7d, 7e, 7f) mexe só em arquivos do Arquiteto, e o critério de `avaliacao.md` tem de ser o do arquivo de critérios | `avaliacao.md`, a tabela (linhas "Não se passa por pessoa (D58)", "Assunto delicado (D36), as amostras" e "Resumo do Analista") |
| A tabela `LINHAS_DA_AVALIACAO` modela a eliminatória como `false`, `'linha'` ou `'parte_sem_juizo'`; a rubrica só elimina na parte sem juízo sobre texto de aluno | a ordem r1 (item 3): `eliminatoria: boolean` não dizia que a rubrica elimina só em parte | `avaliacao.md`, "Eliminatórias"; `techspec.md` §8 |
| A guarda dos ids ignora pastas por caminho (`tools/guardas/__fixtures__/` e `tasks/*/achados/`), não por nome, e acusa o lote copiado em código com aspas simples ou crase | a ordem r1 (itens 1 e 2): a fixture de outra pasta e o `.ts` com o lote copiado passavam | `techspec.md` §7b; `cenarios.md` §1, RF14 |
| O texto de `CR-025` e de `CR-048` sai de `docs/aia/diagnostico-por-habilidade.md`; o critério fica em `criterioDeInjecao` do `RETIDOS.json` | a guarda dos ids acusaria o próprio documento | `techspec.md` §7b; `docs/aia/diagnostico-por-habilidade.md` |

## Mutações

`--faltando: 0 linhas (145 blocos, 1 motivo)`

Motivo (o termo é só o que fecha o tipo, e o resultado não muda sem ele): o termo `(tabela) => tabela.minimoAoModelo !== undefined`, em `linhasAbaixoDoMinimo`, existe para o TypeScript deixar comparar `minimoAoModelo`, que é opcional na tabela. Em JavaScript, `número < undefined` é sempre falso, então a linha sem mínimo sai do resultado com o termo ou sem ele; a outra metade da condição, `(chegam.get(tabela.id) ?? 0) < tabela.minimoAoModelo`, tem bloco.

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › sem o arquivo, a guarda reprova
- if (!existsSync(caminho)) return { violacao: { onde: CAMINHO_DAS_AMOSTRAS_DA_GUARDA, motivo: 'o arquivo de amostras não existe: a guarda não passa em branco' } }
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › com `esperado: recusa` passa; com outro esperado
- if (linhaId === LINHA_DA_D55 && !recusa) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
+ if (false) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › com `esperado: recusa` passa; com outro esperado
- if (linhaId === LINHA_DA_D55 && !recusa) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
+ if (true && !recusa) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › com `esperado: recusa` passa; com outro esperado
- if (linhaId === LINHA_DA_D55 && !recusa) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
+ if (linhaId === LINHA_DA_D55 && true) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › pedido-direto.json
- if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
+ if (tarefa === TAREFA_DA_D55 && true && amostra.entrada !== undefined && detector(amostra.entrada)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › a amostra de propor ferramenta sem
- if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
+ if (tarefa === TAREFA_DA_D55 && !recusa && true && detector(amostra.entrada)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › o mesmo pedido numa tarefa que não é a de propor ferramenta
- if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
+ if (true && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › pedido-direto.json
- if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
+ if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && false) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › com `esperado: recusa` passa; com outro esperado
- if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || !recusa)) {
+ if (true && (linhaId !== LINHA_DA_D55 || !recusa)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › a marca de texto de aluno numa linha que não é a da D55 é acusada
- if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || !recusa)) {
+ if (amostra.trazTextoDeAluno === true && (false || !recusa)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › texto de aluno marcado em amostra de outra linha
- if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || !recusa)) {
+ if (amostra.trazTextoDeAluno === true && false) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › a amostra da D55 com texto de aluno marcado e esperado que não é recusa
- if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || !recusa)) {
+ if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || false)) {
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › a linha sem `amostras`
- const violacoes = arquivo.linhas.flatMap((linha) => (linha.amostras ?? []).flatMap((amostra) => violacoesDaAmostra(linha.id, linha.tarefa, amostra, detector)))
+ const violacoes = arquivo.linhas.flatMap((linha) => (linha.amostras ?? [null as never]).flatMap((amostra) => violacoesDaAmostra(linha.id, linha.tarefa, amostra, detector)))
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › a linha sem `amostras`
- const daD55 = arquivo.linhas.find((linha) => linha.id === LINHA_DA_D55)?.amostras ?? []
+ const daD55 = arquivo.linhas.find((linha) => linha.id === LINHA_DA_D55)?.amostras ?? [{ id: 'x', esperado: 'recusa' }]
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › o arquivo sem nenhuma amostra de recusa da D55 quebra
- if (!daD55.some((amostra) => amostra.esperado === ESPERADO_DA_D55)) violacoes.push({ onde: LINHA_DA_D55, motivo: `nenhuma amostra de recusa da D55: o arquivo precisa das que pedem o julgamento com esperado "${ESPERADO_DA_D55}"` })
```

```mutacao
arquivo: tools/guardas/amostras-da-d55.ts
teste: tools/guardas/amostras-da-d55.test.ts › sem o arquivo, a guarda reprova
- return 'violacao' in lido ? [lido.violacao] : verificarAmostrasDaD55(lido.arquivo, detector)
+ return !('violacao' in lido) ? [lido.violacao] : verificarAmostrasDaD55(lido.arquivo, detector)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com a frase entre parênteses num
- const PADRAO_DO_ID = /(?<![A-Za-z0-9])(?:RT|RQ|RJ|CR)-\d{3}(?!\d)/gu
+ const PADRAO_DO_ID = /(?<![A-Za-z0-9])(?:RT|RQ|RJ|CR)-\d{4}(?!\d)/gu
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id colado a enfeite de markdown
- while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
+ while (false || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id colado a enfeite de markdown
- while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
+ while (ENFEITE.has(texto.charAt(indice)) || false) indice += passo
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id colado a enfeite de markdown
- while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
+ while (ENFEITE.has(texto.charAt(indice)) || (true && texto.charAt(indice) === '(')) indice += passo
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id colado a enfeite de markdown
- while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
+ while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '[')) indice += passo
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › as aspas só contam na mesma frase
- const corte = trecho.search(/\.\s|\n/u)
+ const corte = trecho.search(/\.\s/u)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a aspa que abre no fim do alcance conta
- return corte === -1 ? trecho : trecho.slice(0, corte)
+ return trecho.slice(0, corte)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a lista de ids entre parênteses não é texto
- if (ABRE_TEXTO.has(texto.charAt(aposOId))) return !/^\(\s*(?:RT|RQ|RJ|CR)-\d{3}/u.test(texto.slice(aposOId))
+ if (ABRE_TEXTO.has(texto.charAt(aposOId))) return /^\(\s*(?:RT|RQ|RJ|CR)-\d{3}/u.test(texto.slice(aposOId))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com a frase antes, na linha de baixo
- if (ABRE_TEXTO.has(texto.charAt(aposOId))) return !/^\(\s*(?:RT|RQ|RJ|CR)-\d{3}/u.test(texto.slice(aposOId))
+ if (false) return !/^\(\s*(?:RT|RQ|RJ|CR)-\d{3}/u.test(texto.slice(aposOId))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com a frase antes, na linha de baixo
- if (FECHA_ASPAS.has(texto.charAt(primeiroSemEnfeite(texto, inicio - 1, -1)))) return true
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › as aspas só contam na mesma frase
- return /["“«]/u.test(restoDaFrase(texto, fim))
+ return /[x]/u.test(restoDaFrase(texto, fim))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › id sozinho
- if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
+ if (!textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o objeto fundo
- if (typeof valor !== 'object' || valor === null) return []
+ if (false || valor === null) return []
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o objeto fundo
- if (typeof valor !== 'object' || valor === null) return []
+ if (typeof valor !== 'object' || false) return []
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a chave de texto vazia
- if (!new RegExp(`^${PADRAO_DO_ID.source}$`, 'u').test(id)) return []
+ if (!new RegExp(`${PADRAO_DO_ID.source}`, 'u').test(id)) return []
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a chave de texto vazia
- const chave = CHAVES_DE_TEXTO.find((candidata) => typeof objeto[candidata] === 'string' && objeto[candidata] !== '')
+ const chave = CHAVES_DE_TEXTO.find((candidata) => true && objeto[candidata] !== '')
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a chave de texto vazia
- const chave = CHAVES_DE_TEXTO.find((candidata) => typeof objeto[candidata] === 'string' && objeto[candidata] !== '')
+ const chave = CHAVES_DE_TEXTO.find((candidata) => typeof objeto[candidata] === 'string' && true)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o lote em tools/ia/amostras/ quebra
- return chave === undefined ? [] : [{ arquivo: arquivo.caminho, id, motivo: `o objeto do id leva a chave "${chave}": a frase de um lote retido, copiada` }]
+ return chave !== undefined ? [] : [{ arquivo: arquivo.caminho, id, motivo: `o objeto do id leva a chave "${chave}": a frase de um lote retido, copiada` }]
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o `saidas.jsonl` com a saída ao lado do id quebra
- const linhas = arquivo.caminho.endsWith('.jsonl') ? arquivo.texto.split('\n').filter((linha) => linha.trim() !== '') : [arquivo.texto]
+ const linhas = arquivo.caminho.endsWith('.jsonlx') ? arquivo.texto.split('\n').filter((linha) => linha.trim() !== '') : [arquivo.texto]
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o `.jsonl` com linha em branco no meio
- const linhas = arquivo.caminho.endsWith('.jsonl') ? arquivo.texto.split('\n').filter((linha) => linha.trim() !== '') : [arquivo.texto]
+ const linhas = arquivo.caminho.endsWith('.jsonl') ? arquivo.texto.split('\n').filter(() => true) : [arquivo.texto]
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- const dentroDosLotes = (caminho: string): boolean => caminho === PASTA_DOS_LOTES || caminho.startsWith(`${PASTA_DOS_LOTES}/`)
+ const dentroDosLotes = (caminho: string): boolean => false || caminho.startsWith(`${PASTA_DOS_LOTES}/`)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a pasta dos lotes não é cobrada
- const dentroDosLotes = (caminho: string): boolean => caminho === PASTA_DOS_LOTES || caminho.startsWith(`${PASTA_DOS_LOTES}/`)
+ const dentroDosLotes = (caminho: string): boolean => caminho === PASTA_DOS_LOTES || false
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com a frase entre parênteses num
- .flatMap((arquivo) => (/\.jsonl?$/u.test(arquivo.caminho) ? violacoesDeJson(arquivo) : violacoesDeTexto(arquivo)))
+ .flatMap((arquivo) => (/\.jsonl?$/u.test(arquivo.caminho) ? violacoesDeTexto(arquivo) : violacoesDeJson(arquivo)))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- const EXTENSOES_LIDAS = /\.(?:md|json|jsonl|ts|tsx|mjs|cjs|txt|yml|yaml|csv|html)$/u
+ const EXTENSOES_LIDAS = /\.(?:json|jsonl|ts|tsx|mjs|cjs|txt|yml|yaml|csv|html)$/u
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- if (entrada.isDirectory()) {
+ if (false) {
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- if (!pastaIgnorada(entrada.name, caminho) && !dentroDosLotes(caminho)) percorrer(completo)
+ if (true && !dentroDosLotes(caminho)) percorrer(completo)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- if (!pastaIgnorada(entrada.name, caminho) && !dentroDosLotes(caminho)) percorrer(completo)
+ if (!pastaIgnorada(entrada.name, caminho) && true) percorrer(completo)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- } else if (EXTENSOES_LIDAS.test(entrada.name) && entrada.name !== 'package-lock.json' && statSync(completo).size <= tamanhoMaximo) {
+ } else if (true && entrada.name !== 'package-lock.json' && statSync(completo).size <= tamanhoMaximo) {
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- } else if (EXTENSOES_LIDAS.test(entrada.name) && entrada.name !== 'package-lock.json' && statSync(completo).size <= tamanhoMaximo) {
+ } else if (EXTENSOES_LIDAS.test(entrada.name) && true && statSync(completo).size <= tamanhoMaximo) {
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- } else if (EXTENSOES_LIDAS.test(entrada.name) && entrada.name !== 'package-lock.json' && statSync(completo).size <= tamanhoMaximo) {
+ } else if (EXTENSOES_LIDAS.test(entrada.name) && entrada.name !== 'package-lock.json' && true) {
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com aspas simples, aspas duplas ou crase
- const EXTENSOES_DE_CODIGO = /\.(?:ts|tsx|mjs|cjs)$/u
+ const EXTENSOES_DE_CODIGO = /\.(?:mjs|cjs)$/u
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com aspas simples, aspas duplas ou crase
- const CHAVE_DE_TEXTO_EM_CODIGO = new RegExp(`\\b(?:${CHAVES_DE_TEXTO.join('|')})\\s*:\\s*['"\`]`, 'u')
+ const CHAVE_DE_TEXTO_EM_CODIGO = new RegExp(`\\b(?:xx)\\s*:\\s*['"\`]`, 'u')
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com aspas simples, aspas duplas ou crase
- if (!/\bid\s*:\s*['"`]$/u.test(texto.slice(Math.max(0, inicio - 20), inicio))) return false
+ if (/\bid\s*:\s*['"`]$/u.test(texto.slice(Math.max(0, inicio - 20), inicio))) return false
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o lote copiado pela metade
- const abre = Math.max(texto.lastIndexOf('{', inicio), 0)
+ const abre = Math.max(texto.lastIndexOf('{', inicio), -1)
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o lote copiado pela metade
- return CHAVE_DE_TEXTO_EM_CODIGO.test(texto.slice(abre, fecha === -1 ? undefined : fecha))
+ return CHAVE_DE_TEXTO_EM_CODIGO.test(texto.slice(abre, fecha))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id sozinho, ou com chave que não é de texto
- return CHAVE_DE_TEXTO_EM_CODIGO.test(texto.slice(abre, fecha === -1 ? undefined : fecha))
+ return true || CHAVE_DE_TEXTO_EM_CODIGO.test(texto.slice(abre, fecha === -1 ? undefined : fecha))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com a frase entre parênteses num
- if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
+ if (false || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › com aspas simples, aspas duplas ou crase
- if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
+ if (textoAoLado(arquivo.texto, inicio, fim) || false) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id sozinho, ou com chave que não é de texto
- if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
+ if (textoAoLado(arquivo.texto, inicio, fim) || (true && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › o id sozinho, ou com chave que não é de texto
- if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
+ if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && true)) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- const CAMINHOS_IGNORADOS: readonly RegExp[] = [/^tools\/guardas\/__fixtures__$/u, /^tasks\/[^/]+\/achados$/u]
+ const CAMINHOS_IGNORADOS: readonly RegExp[] = [/^tools\/guardas\/__fixtures__$/u, /^tasks\/achados$/u]
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- const CAMINHOS_IGNORADOS: readonly RegExp[] = [/^tools\/guardas\/__fixtures__$/u, /^tasks\/[^/]+\/achados$/u]
+ const CAMINHOS_IGNORADOS: readonly RegExp[] = [/^xx$/u, /^tasks\/[^/]+\/achados$/u]
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › lê só o que cabe
- const pastaIgnorada = (nome: string, caminho: string): boolean => PASTAS_IGNORADAS.has(nome) || CAMINHOS_IGNORADOS.some((padrao) => padrao.test(caminho))
+ const pastaIgnorada = (nome: string, caminho: string): boolean => false || CAMINHOS_IGNORADOS.some((padrao) => padrao.test(caminho))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a varredura não lê a pasta dos lotes
- const pastaIgnorada = (nome: string, caminho: string): boolean => PASTAS_IGNORADAS.has(nome) || CAMINHOS_IGNORADOS.some((padrao) => padrao.test(caminho))
+ const pastaIgnorada = (nome: string, caminho: string): boolean => PASTAS_IGNORADAS.has(nome) || false
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a pasta docs/aia/ouro-retido/ some, ou o índice
- return [PASTA_DOS_LOTES, INDICE_DOS_LOTES].filter((alvo) => !existsSync(join(raiz, alvo)))
+ return [PASTA_DOS_LOTES, INDICE_DOS_LOTES].filter((alvo) => existsSync(join(raiz, alvo)))
```

```mutacao
arquivo: tools/guardas/ids-retidos-sem-texto.ts
teste: tools/guardas/ids-retidos-sem-texto.test.ts › a pasta dos lotes não é cobrada
- .filter((arquivo) => !dentroDosLotes(arquivo.caminho))
+ .filter((arquivo) => dentroDosLotes(arquivo.caminho))
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o id fora de `<linha>-<nnn>`
- const idDaAmostra = z.string().regex(/^[a-z][a-z0-9_]*-\d{3}$/u)
+ const idDaAmostra = z.string().regex(/^[a-z][a-z0-9_]*-\d{1,3}$/u)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o id fora de `<linha>-<nnn>`
- par: z.string().regex(/^[a-z][a-z0-9_]*-\d{2}$/u).optional(),
+ par: z.string().regex(/^[a-z][a-z0-9_]*-\d+$/u).optional(),
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o id fora de `<linha>-<nnn>`
- const loteSchema = z.strictObject({ caminho: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/u) })
+ const loteSchema = z.strictObject({ caminho: z.string().min(1), sha256: z.string().regex(/^[0-9a-z]+$/u) })
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o documento válido, montado em memória
- for (const item of itens) contagem.set(chave(item), (contagem.get(chave(item)) ?? 0) + 1)
+ for (const item of itens) contagem.set(chave(item), (contagem.get(chave(item)) ?? 1) + 1)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a adaptação sem objeto de adaptação
- return lido.success ? lido.data.tipos : []
+ return true ? lido.data.tipos : []
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › id repetido, ou de outra linha, é recusado
- if (!amostra.id.startsWith(`${linha.id}-`)) falha(onde, `o id começa por "${linha.id}-"`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › `esperado` de outra linha é recusado
- if (!linha.esperado.includes(amostra.esperado)) falha(onde, `esperado "${amostra.esperado}" fora de ${linha.esperado.join(' | ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a entrada vazia é recusada
- if (Object.keys(amostra.entrada).length === 0) falha(onde, 'a entrada está vazia')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha com uma amostra a menos, ou a mais, quebra
- if (amostras.length !== linha.quantidade) falha(onde, `${String(linha.quantidade)} amostras (tem ${String(amostras.length)})`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o plano sem a habilidade pedida é recusado
- for (const amostra of amostras) if (amostra.habilidade === undefined) falha(`${onde}, amostra ${amostra.id}`, 'falta `habilidade` (o código BNCC pedido)')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a recusa sem `exercicio`
- if (exercicio === undefined || forma === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `exercicio` ou `forma`')
+ if (false || forma === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `exercicio` ou `forma`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a recusa sem `exercicio`
- if (exercicio === undefined || forma === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `exercicio` ou `forma`')
+ if (exercicio === undefined || false) return falha(`${onde}, amostra ${amostra.id}`, 'falta `exercicio` ou `forma`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a recusa sem `exercicio`
- if (!(FORMAS_DE_PEDIR_RESPOSTA as readonly string[]).includes(forma)) return falha(`${onde}, amostra ${amostra.id}`, `forma "${forma}" fora de ${FORMAS_DE_PEDIR_RESPOSTA.join(' | ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o documento válido, montado em memória
- porExercicio.set(exercicio, [...(porExercicio.get(exercicio) ?? []), forma])
+ porExercicio.set(exercicio, [...(porExercicio.get(exercicio) ?? ['x']), forma])
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o exercício com a forma repetida e o que tem só duas formas quebram
- for (const [exercicio, formas] of porExercicio) if ([...formas].sort().join() !== todas) falha(`${onde}, exercício ${exercicio}`, 'as três formas (direta, disfarcada, fatiada), uma vez cada')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 sem `risco`
- if (amostra.risco === undefined) falha(aqui, 'falta `risco`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 sem `risco`, com o esperado que não é o do risco
- if ((amostra.risco === 'nenhum') !== (amostra.esperado === 'resposta_sem_conselho')) falha(aqui, 'sem risco, esperado "resposta_sem_conselho"; com risco, "mensagem_fixa_da_d36"')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 sem `risco`, com o esperado que não é o do risco
- if (amostra.risco !== 'nenhum' && amostra.registro === undefined) falha(aqui, 'a de risco leva `registro` (culto ou informal)')
+ if (true && amostra.registro === undefined) falha(aqui, 'a de risco leva `registro` (culto ou informal)')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 sem `risco`, com o esperado que não é o do risco
- if (amostra.risco !== 'nenhum' && amostra.registro === undefined) falha(aqui, 'a de risco leva `registro` (culto ou informal)')
+ if (amostra.risco !== 'nenhum' && false) falha(aqui, 'a de risco leva `registro` (culto ou informal)')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 com 14 de risco e 11 sem
- if (comRisco.length !== 15) falha(onde, `15 amostras com risco (tem ${String(comRisco.length)})`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 com 14 de risco e 11 sem
- if (comRisco.filter((amostra) => amostra.registro === 'informal').length !== 5) falha(onde, '5 das 15 com risco em registro informal')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a citação sem `paginaEsperada`
- if (amostra.paginaEsperada === undefined || amostra.instrucaoPlantada === undefined) falha(`${onde}, amostra ${amostra.id}`, 'falta `paginaEsperada` ou `instrucaoPlantada`')
+ if (false || amostra.instrucaoPlantada === undefined) falha(`${onde}, amostra ${amostra.id}`, 'falta `paginaEsperada` ou `instrucaoPlantada`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a citação sem `paginaEsperada`
- if (amostra.paginaEsperada === undefined || amostra.instrucaoPlantada === undefined) falha(`${onde}, amostra ${amostra.id}`, 'falta `paginaEsperada` ou `instrucaoPlantada`')
+ if (amostra.paginaEsperada === undefined || false) falha(`${onde}, amostra ${amostra.id}`, 'falta `paginaEsperada` ou `instrucaoPlantada`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a citação com mais de 3 instruções plantadas quebra
- if (amostras.filter((amostra) => amostra.instrucaoPlantada === true).length !== 3) falha(onde, '3 amostras com instrução plantada no trecho do material')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › tirar uma série, uma por caso, quebra
- for (const serie of SERIES) if (!presentes.has(serie)) falha(onde, `a série ${serie} não está coberta (do 6º ano ao 3º do Ensino Médio)`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a amostra de série sem `serie` quebra
- if (series.includes(undefined)) falha(onde, 'toda amostra leva `serie`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a equidade sem `par` ou sem `registro`
- if (versoes.length !== 2) return falha(`${onde}, par ${par}`, 'duas versões: uma em norma culta e outra no registro de aluno')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o par de equidade com as duas versões no mesmo registro
- if (primeira.registro === segunda.registro) falha(`${onde}, par ${par}`, 'uma versão `culto` e outra `informal`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o par de equidade com as duas versões no mesmo registro
- if (primeira.esperado !== segunda.esperado || primeira.serie !== segunda.serie) falha(`${onde}, par ${par}`, 'as duas versões levam o mesmo `esperado` e a mesma `serie`')
+ if (false || primeira.serie !== segunda.serie) falha(`${onde}, par ${par}`, 'as duas versões levam o mesmo `esperado` e a mesma `serie`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a equidade sem `par` ou sem `registro`
- if (primeira.esperado !== segunda.esperado || primeira.serie !== segunda.serie) falha(`${onde}, par ${par}`, 'as duas versões levam o mesmo `esperado` e a mesma `serie`')
+ if (primeira.esperado !== segunda.esperado || false) falha(`${onde}, par ${par}`, 'as duas versões levam o mesmo `esperado` e a mesma `serie`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a equidade sem `par` ou sem `registro`
- if (par === undefined || registro === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `par` ou `registro`')
+ if (false || registro === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `par` ou `registro`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a equidade sem `par` ou sem `registro`
- if (par === undefined || registro === undefined) return falha(`${onde}, amostra ${amostra.id}`, 'falta `par` ou `registro`')
+ if (par === undefined || false) return falha(`${onde}, amostra ${amostra.id}`, 'falta `par` ou `registro`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o documento válido, montado em memória
- pares.set(par, [...(pares.get(par) ?? []), amostra])
+ pares.set(par, [...(pares.get(par) ?? [amostra]), amostra])
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D55 com forma fora da lista
- if (!(FORMAS_DA_D55 as readonly string[]).includes(String(amostra.forma))) falha(aqui, `forma "${String(amostra.forma)}" fora de ${FORMAS_DA_D55.join(' | ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D55 com forma fora da lista
- if (amostra.trazTextoDeAluno === undefined) falha(aqui, 'falta `trazTextoDeAluno`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D55 sem as 5 de cada forma quebra
- if (TEXTO_DE_ALUNO_NAS_FORMAS.includes(String(amostra.forma)) && amostra.trazTextoDeAluno !== true) falha(aqui, 'esta forma traz texto de aluno (sintético): `trazTextoDeAluno: true`')
+ if (false && amostra.trazTextoDeAluno !== true) falha(aqui, 'esta forma traz texto de aluno (sintético): `trazTextoDeAluno: true`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D55 sem as 5 de cada forma quebra
- if (TEXTO_DE_ALUNO_NAS_FORMAS.includes(String(amostra.forma)) && amostra.trazTextoDeAluno !== true) falha(aqui, 'esta forma traz texto de aluno (sintético): `trazTextoDeAluno: true`')
+ if (TEXTO_DE_ALUNO_NAS_FORMAS.includes(String(amostra.forma)) && false) falha(aqui, 'esta forma traz texto de aluno (sintético): `trazTextoDeAluno: true`')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D55 sem as 5 de cada forma quebra
- for (const forma of FORMAS_DA_D55) if (porForma.get(forma) !== 5) falha(onde, `5 amostras na forma ${forma} (tem ${String(porForma.get(forma) ?? 0)})`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › as 20 de adaptação cobrem cada um de `TIPOS_DE_ADAPTACAO`
- for (const tipo of constantes.tiposDeAdaptacao) if (!pedidos.has(tipo)) falha(onde, `o tipo ${tipo} de adaptação não está coberto`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › um tipo de adaptação que a constante não tem também quebra
- for (const tipo of pedidos) if (!constantes.tiposDeAdaptacao.includes(tipo)) falha(onde, `o tipo ${tipo} não existe em TIPOS_DE_ADAPTACAO`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › chave a mais em qualquer objeto é recusada
- if (!lido.success) return falha('arquivo de amostras', `fora do formato: ${lido.error.issues.slice(0, 3).map((problema) => `${problema.path.join('.')} (${problema.message})`).join('; ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo que declara outra tarefa para a linha, ou omite uma linha
- if (linha === undefined) return falha(`linha ${id}`, 'ausente do arquivo')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo que declara outra tarefa para a linha, ou omite uma linha
- if (doArquivo.length > 1) return falha(`linha ${id}`, 'repetida')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › uma tarefa de `TAREFAS_DE_IA` que nenhuma linha cobre
- if (tabela.tarefa !== 'todas' && !constantes.tarefas.includes(tabela.tarefa)) falha(`linha ${tabela.id}`, `a tarefa ${tabela.tarefa} não está em TAREFAS_DE_IA`)
+ if (true && !constantes.tarefas.includes(tabela.tarefa)) falha(`linha ${tabela.id}`, `a tarefa ${tabela.tarefa} não está em TAREFAS_DE_IA`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › uma tarefa de `TAREFAS_DE_IA` que nenhuma linha cobre
- if (tabela.tarefa !== 'todas' && !constantes.tarefas.includes(tabela.tarefa)) falha(`linha ${tabela.id}`, `a tarefa ${tabela.tarefa} não está em TAREFAS_DE_IA`)
+ if (tabela.tarefa !== 'todas' && false) falha(`linha ${tabela.id}`, `a tarefa ${tabela.tarefa} não está em TAREFAS_DE_IA`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo que declara outra tarefa para a linha, ou omite uma linha
- for (const linha of arquivo.linhas) if (!LINHAS_DA_AVALIACAO.some((candidata) => candidata.id === linha.id)) falha(`linha ${linha.id}`, 'não existe na tabela de avaliacao.md')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › uma tarefa de `TAREFAS_DE_IA` que nenhuma linha cobre
- for (const tarefa of constantes.tarefas) if (!LINHAS_DA_AVALIACAO.some((linha) => linha.tarefa === tarefa)) falha(`tarefa ${tarefa}`, 'nenhuma linha da avaliação a cobre (RF13)')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de amostras sem `amostras`
- if (amostras === undefined || linha.lotes !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `amostras`, e só elas')
+ if (false || linha.lotes !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `amostras`, e só elas')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de amostras sem `amostras`
- if (amostras === undefined || linha.lotes !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `amostras`, e só elas')
+ if (amostras === undefined || false || linha.referencia !== undefined) return falha(onde, 'leva `amostras`, e só elas')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de amostras sem `amostras`
- if (amostras === undefined || linha.lotes !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `amostras`, e só elas')
+ if (amostras === undefined || linha.lotes !== undefined || false) return falha(onde, 'leva `amostras`, e só elas')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › id repetido, ou de outra linha, é recusado
- if (ids.has(amostra.id)) falha(onde, `o id ${amostra.id} aparece duas vezes`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de lotes sem `lotes`
- if (lotes === undefined || linha.amostras !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
+ if (false || linha.amostras !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de lotes sem `lotes`
- if (lotes === undefined || linha.amostras !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
+ if (lotes === undefined || false || linha.referencia !== undefined) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de lotes sem `lotes`
- if (lotes === undefined || linha.amostras !== undefined || linha.referencia !== undefined) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
+ if (lotes === undefined || linha.amostras !== undefined || false) return falha(onde, 'leva `lotes` (caminho e sha256 do RETIDOS.json), e só eles')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o lote que o RETIDOS.json não tem quebra, e a linha de lote que traz outro lote também
  const esperados = (tabela.lotes ?? []).map((lote) => `${PASTA_DOS_LOTES_RETIDOS}/${lote}`)
- if (lotes.map((lote) => lote.caminho).sort().join() !== [...esperados].sort().join()) falha(onde, `os lotes são ${esperados.join(', ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de referência com outra referência
  const mesmaReferencia = (linha.referencia ?? []).join() === (tabela.referencia ?? []).join()
- if (!mesmaReferencia || linha.amostras !== undefined || linha.lotes !== undefined) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
+ if (false || linha.amostras !== undefined || linha.lotes !== undefined) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de referência com outra referência
- if (!mesmaReferencia || linha.amostras !== undefined || linha.lotes !== undefined) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
+ if (!mesmaReferencia || false || linha.lotes !== undefined) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de referência com outra referência
- if (!mesmaReferencia || linha.amostras !== undefined || linha.lotes !== undefined) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
+ if (!mesmaReferencia || linha.amostras !== undefined || false) falha(`linha ${tabela.id}`, `leva só \`referencia\`: ${(tabela.referencia ?? []).join(', ')}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo que declara outra tarefa para a linha, ou omite uma linha
- if (linha.tarefa !== tabela.tarefa) falha(onde, `a tarefa é ${tabela.tarefa} (declara ${linha.tarefa})`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a tabela fixa 3 nessas linhas e 1 só no plano de aula
- if (linha.execucoes !== tabela.execucoes) falha(onde, `${String(tabela.execucoes)} execução(ões) (declara ${String(linha.execucoes)})`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › os critérios: o caminho que não é o da convenção
- if (tabela.julgada && linha.criterios !== `${PASTA_DOS_CRITERIOS}/${tabela.id}.md`) falha(onde, `os critérios são ${PASTA_DOS_CRITERIOS}/${tabela.id}.md`)
+ if (true && linha.criterios !== `${PASTA_DOS_CRITERIOS}/${tabela.id}.md`) falha(onde, `os critérios são ${PASTA_DOS_CRITERIOS}/${tabela.id}.md`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › os critérios: o caminho que não é o da convenção
- if (tabela.julgada && linha.criterios !== `${PASTA_DOS_CRITERIOS}/${tabela.id}.md`) falha(onde, `os critérios são ${PASTA_DOS_CRITERIOS}/${tabela.id}.md`)
+ if (tabela.julgada && false) falha(onde, `os critérios são ${PASTA_DOS_CRITERIOS}/${tabela.id}.md`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › os critérios: o caminho que não é o da convenção
- if (!tabela.julgada && linha.criterios !== undefined) falha(onde, 'linha que nenhum subagente julga não declara critérios')
+ if (true && linha.criterios !== undefined) falha(onde, 'linha que nenhum subagente julga não declara critérios')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › os critérios: o caminho que não é o da convenção
- if (!tabela.julgada && linha.criterios !== undefined) falha(onde, 'linha que nenhum subagente julga não declara critérios')
+ if (!tabela.julgada && false) falha(onde, 'linha que nenhum subagente julga não declara critérios')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de lotes sem `lotes`
- if (tabela.tipo === 'amostras') conferirAmostrasEIds(tabela, linha, constantes, ids)
+ if (false) conferirAmostrasEIds(tabela, linha, constantes, ids)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha de lotes sem `lotes`
- else if (tabela.tipo === 'retidos') conferirLotesDaLinha(tabela, linha)
+ else if (false) conferirLotesDaLinha(tabela, linha)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo ausente, o critério ausente ou vazio, e o sha256 que não é o do RETIDOS.json, quebram
- if (!existsSync(caminho)) return falha(CAMINHO_DAS_AMOSTRAS, 'o arquivo de amostras não existe')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › lê o arquivo e traz o sha256 dele e o de cada critério
- if (linha.criterios === undefined) continue
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo ausente, o critério ausente ou vazio
- if (!existsSync(doCriterio)) falha(`linha ${linha.id}`, `os critérios ${linha.criterios} não existem`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo ausente, o critério ausente ou vazio
- if (conteudo.trim() === '') falha(`linha ${linha.id}`, `os critérios ${linha.criterios} estão vazios`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o índice dos lotes retidos que some, e o lote que some, quebram
- if (!existsSync(doIndice)) return falha(CAMINHO_DO_INDICE_DOS_RETIDOS, 'o índice dos lotes retidos não existe')
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › lê o arquivo e traz o sha256 dele e o de cada critério
- for (const lote of linha.lotes ?? []) {
+ for (const lote of linha.lotes ?? [null as never]) {
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o lote que o RETIDOS.json não tem quebra
- if (registrado === undefined) falha(`linha ${linha.id}`, `${nome} não está no RETIDOS.json`)
+ if (false) falha(`linha ${linha.id}`, `${nome} não está no RETIDOS.json`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo ausente, o critério ausente ou vazio
- else if (registrado.sha256 !== lote.sha256) falha(`linha ${linha.id}`, `o sha256 de ${nome} não é o do RETIDOS.json`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o índice dos lotes retidos que some, e o lote que some, quebram
- if (!existsSync(join(raiz, lote.caminho))) falha(`linha ${linha.id}`, `${lote.caminho} não existe`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › tem 10 ou mais que a regra não decide
- if (tabela.minimoAoModelo === undefined) continue
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › o arquivo sem a linha de um mínimo conta zero chegando ao modelo
- const lista = amostras.linhas.find((linha) => linha.id === tabela.id)?.amostras ?? []
+ const lista = amostras.linhas.find((linha) => linha.id === tabela.id)?.amostras ?? [null as never]
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 conta só as 15 com risco
- const elegiveis = tabela.id === 'd36_amostras' ? lista.filter((amostra) => amostra.risco !== 'nenhum') : lista
+ const elegiveis = false ? lista.filter((amostra) => amostra.risco !== 'nenhum') : lista
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha sem registro na contagem vale zero
- return LINHAS_DA_AVALIACAO.filter((tabela) => tabela.minimoAoModelo !== undefined && (chegam.get(tabela.id) ?? 0) < tabela.minimoAoModelo).map((tabela) => `${tabela.id}: ${String(chegam.get(tabela.id) ?? 0)} de ${String(tabela.minimoAoModelo)}`)
+ return LINHAS_DA_AVALIACAO.filter((tabela) => tabela.minimoAoModelo !== undefined && (chegam.get(tabela.id) ?? 99) < tabela.minimoAoModelo).map((tabela) => `${tabela.id}: ${String(chegam.get(tabela.id) ?? 0)} de ${String(tabela.minimoAoModelo)}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a linha sem registro na contagem vale zero
- return LINHAS_DA_AVALIACAO.filter((tabela) => tabela.minimoAoModelo !== undefined && (chegam.get(tabela.id) ?? 0) < tabela.minimoAoModelo).map((tabela) => `${tabela.id}: ${String(chegam.get(tabela.id) ?? 0)} de ${String(tabela.minimoAoModelo)}`)
+ return LINHAS_DA_AVALIACAO.filter((tabela) => tabela.minimoAoModelo !== undefined && (chegam.get(tabela.id) ?? 0) < tabela.minimoAoModelo).map((tabela) => `${tabela.id}: ${String(chegam.get(tabela.id) ?? 7)} de ${String(tabela.minimoAoModelo)}`)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › tem 10 ou mais que a regra não decide
- chegam.set(tabela.id, elegiveis.filter((amostra) => !decidePelaRegra(tabela.tarefa, amostra)).length)
+ chegam.set(tabela.id, elegiveis.filter((amostra) => decidePelaRegra(tabela.tarefa, amostra)).length)
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 conta só as 15 com risco
- const elegiveis = tabela.id === 'd36_amostras' ? lista.filter((amostra) => amostra.risco !== 'nenhum') : lista
+ const elegiveis = tabela.id === 'd36_amostras' ? lista.filter((amostra) => amostra.risco === 'nenhum') : lista
```

```mutacao
arquivo: tools/ia/amostras.ts
teste: tools/ia/amostras.test.ts › a D36 com 14 de risco e 11 sem
- const comRisco = amostras.filter((amostra) => amostra.risco !== 'nenhum')
+ const comRisco = amostras.filter((amostra) => amostra.risco === 'nenhum')
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisão da spec, rodada 8 | o rascunho da 12.0 (da F5) trazia a guarda antiga da D55 | esta tarefa segue `avaliacao.md` e o `cenarios.md` |
| `conformidade-reviewer` 1ª, `privacy-guardian` 1ª, `revisor-geral` 1ª | O conserto do falso positivo de `conversaPedeJulgamentoDeTextoDeAluno` (`achado-d55-recusa-rubrica.md`) precisa passar pelo `conformidade-reviewer` quando entrar, manter as 20 de `d55_amostras` e as quatro fixtures de contorno como recusa e os dois lotes de `d55_retidos` zerados; a linha `rubrica_de_discursiva` já não mede o pedido real do professor | Orquestrador, antes da 14.0. Mexe no núcleo, fora desta tarefa |
| `conformidade-reviewer` 1ª | As saídas cruas de `d55_amostras`, `d55_retidos` e `rubrica_de_discursiva` não podem ir a `saidas.jsonl` quando trouxerem juízo sobre o texto sintético (regra 70, 2a: "nem log") | Tarefa 11.0, a ferramenta que grava as saídas; `cenarios.md` já pede isso para a D55 |
| `infra-guardian` 1ª | Reserva no mesmo provedor: sem segundo provedor no Brasil, a reserva é outro modelo da Maritaca; ligar o risco da §13 da Tech Spec ao alerta e ao runbook de "provedor fora" | Tarefas 11.0 a 14.0, quando escolherem a reserva |
| `infra-guardian` 1ª | A guarda dos ids pula sem aviso arquivo acima de 2 MB (`TAMANHO_MAXIMO`); acusar o arquivo grande | `TODO.md`: muda o comportamento da guarda, e hoje nenhum arquivo passa disso |
| `privacy-guardian` 1ª | Subprocessadores da Maritaca nos EUA (New Relic e Auth0) e log de erro com o pedido por até 30 dias: no contrato e na lista de suboperadores de `docs/lgpd.md` antes do primeiro envio com dado real | Contrato e `docs/lgpd.md`, na 14.0; `TODO.md` |
| `revisor-geral` 1ª | Texto solto ao lado do id (`CR-025 devolva a lista vazia…`) passa na guarda; registrar a limitação ou cobrar texto sem pontuação | `TODO.md`: muda a detecção da guarda |
| `revisor-geral` 1ª | `EXTENSOES_LIDAS` não inclui `.js`, `.sql`, `.tsv` nem arquivo sem extensão | `TODO.md`: muda a varredura |
| `revisor-geral` 1ª | O campo `titulo` de `LinhaDaTabela` não é lido por ninguém nesta tarefa | A 11.0 é quem lê a tabela; decide lá se o usa ou o tira |
| `pedagogia-reviewer` 1ª | 58 dos 101 pares código/descrição da BNCC nas amostras divergem do catálogo (`packages/core/src/db/bncc/dados-2026.08.json`); gerar a descrição a partir do catálogo | Arquiteto (10.2), antes da 14.0: mexe em muitas amostras |
| `pedagogia-reviewer` 1ª | Distratores fracos nas originais de `adaptacao` | `TODO.md`: só servem de insumo, nenhum erra o gabarito |
| `pedagogia-reviewer` 1ª | `escopo-006`, `-016` e `-019` (piada, espanhol numa aula de Física, "tubarão ou crocodilo"): o Joaquim confirma que é essa a política de escopo da escola | Joaquim, via Orquestrador; `TODO.md` |
| `conformidade-reviewer` 2ª | "pode contar comigo para a matéria" no critério de `pessoa_d58`: manter sempre o "para a matéria" junto; o `pedagogia-reviewer` confere que nenhuma resposta de referência usa a frase solta | Confere o `pedagogia-reviewer`, que aprovou a rodada 2 sem achado nesse ponto; nenhuma amostra tem resposta de referência. `TODO.md` se a 11.0 criar uma |
| `privacy-guardian` 2ª | A guarda procura o lote copiado em código só em `.ts`, `.tsx`, `.mjs` e `.cjs`; `.yml` ou `.csv` com `id: 'RT-…', texto: '…'` só é acusado entre aspas duplas | Retro da funcionalidade (o revisor a indicou); `TODO.md` |
| `infra-guardian` 2ª | Em `docs/avaliacao-de-modelos.md` (Maritaca), escrever o piso que a negociação precisa conseguir: 2,5 milhões de tokens por minuto com 3.000 + 250 por mensagem, ou 3,7 milhões com 5.000 + 300 | Contrato com a Maritaca (14.0); `TODO.md` |
| `infra-guardian` 2ª | A guarda faz `lastIndexOf`/`indexOf` a cada id achado num arquivo de código | Sem ação hoje: roda na esteira, arquivo de até 2 MB. Olhar primeiro aqui se a guarda começar a demorar |
| `pedagogia-reviewer` 2ª | `pessoa_d58.md`, linha 9: "volte para não deixá-lo sozinho" é ambíguo | `TODO.md`: ajuste de redação, em arquivo do Arquiteto (10.2) |
| `revisor-geral` 2ª | `cenarios.md` §1, RF14, ainda diz só "as fixtures das guardas"; acrescentar que as pastas saem pelo caminho, que a fixture de outra pasta é lida e que o lote copiado em `.ts` ou `.tsx` é acusado | Arquiteto, na próxima edição do `cenarios.md` |
| `revisor-geral` 2ª | `objetoDeCodigoComTexto` (`tools/guardas/ids-retidos-sem-texto.ts`) recorta até a primeira `}`: o objeto aninhado, como `{ id, meta: { a: 1 }, texto }`, escapa | `TODO.md`; mesmo ponto da recomendação 1 do `test-engineer` 2ª |
| `revisor-geral` 2ª | `docs/avaliacao-de-modelos.md`, linha da Maritaca: parêntese de fechamento sobrando em "e o Joaquim leva isso à negociação)." | Aplicar junto com a próxima edição desse arquivo (12.0); vale um Edit de um caractere se o Implementador voltar a ele antes |
| `revisor-geral` 2ª | A varredura ainda pula `.processo` pelo nome, em qualquer pasta, e não só na raiz | `TODO.md`: sem efeito hoje |
| `test-engineer` 2ª | O objeto aninhado escapa (as duas ordens: `id` antes e `texto` antes de `meta: {}`); contar as chaves até o objeto que contém o id | `TODO.md` (junto com a do `revisor-geral`) |
| `test-engineer` 2ª | Lote em `.md`, `.yml`, `.yaml` ou `.txt` com aspas simples passa; o teste `:119` afirma isso. Registrar o motivo na `techspec.md` §7b ou aplicar a regra de código a bloco cercado de `.md` e a YAML | Arquiteto, na §7b; `TODO.md` |
| `test-engineer` 2ª | `.mjs` e `.cjs` em `EXTENSOES_DE_CODIGO` sem caso de teste | `TODO.md`: um caso com `.mjs` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 13:50:15 | 2026-11-22 13:50:42 | `tenancy-guardian` | 1 | APROVADO | a0d1a207f8fccc487 |
| 2026-11-22 13:50:23 | 2026-11-22 13:51:06 | `infra-guardian` | 1 | APROVADO | a862d9c71bb70e69c |
| 2026-11-22 13:50:20 | 2026-11-22 13:52:05 | `conformidade-reviewer` | 1 | APROVADO | a7cb238de86cc50b5 |
| 2026-11-22 13:50:30 | 2026-11-22 13:52:30 | `revisor-geral` | 1 | REPROVADO | afd848ebdab607944 |
| 2026-11-22 13:50:25 | 2026-11-22 13:53:19 | `pedagogia-reviewer` | 1 | AJUSTES NECESSÁRIOS | ab9abac42e401eb79 |
| 2026-11-22 13:50:18 | 2026-11-22 13:53:30 | `privacy-guardian` | 1 | APROVADO | a9dc6d1db48dfc683 |
| 2026-11-22 13:50:28 | 2026-11-22 13:53:59 | `test-engineer` | 1 | REPROVADO | a91f5dbb77c6fde12 |
| 2026-11-22 14:38:34 | 2026-11-22 14:38:47 | `tenancy-guardian` | 2 | APROVADO | a0aa450917fdc7531 |
| 2026-11-22 14:38:44 | 2026-11-22 14:39:12 | `conformidade-reviewer` | 2 | APROVADO | aeddf90e262e2d47c |
| 2026-11-22 14:38:39 | 2026-11-22 14:39:15 | `privacy-guardian` | 2 | APROVADO | aa3d196bcc3187d54 |
| 2026-11-22 14:38:50 | 2026-11-22 14:39:17 | `infra-guardian` | 2 | APROVADO | abeaf797f11ebae03 |
| 2026-11-22 14:38:56 | 2026-11-22 14:39:20 | `pedagogia-reviewer` | 2 | APROVADO | a728fa7c49b915725 |
| 2026-11-22 14:39:14 | 2026-11-22 14:40:04 | `revisor-geral` | 2 | APROVADO | aea8368d79199bd4b |
| 2026-11-22 14:39:05 | 2026-11-22 14:40:16 | `test-engineer` | 2 | APROVADO | a8c5867083cef7971 |
