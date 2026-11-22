# Tarefa 11.0 — A ferramenta de avaliação roda as amostras, julga cada resposta crua e escreve o relatório

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0, 10.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

`tools/ia/avaliar-modelos.ts`, rodado à mão com a chave de um finalista, passa cada amostra de `avaliacao-1.json` pela tarefa
real, no gateway real, envolve o adaptador para julgar **cada resposta crua**, e grava em `docs/avaliacao/<finalista>/<data>/`
`saidas.jsonl`, `julgamento.jsonl`, `resultado.json` e `relatorio.md`. As medidas por linha são da 12.0; os lotes retidos, da 13.0.
Nenhum teste chama a ferramenta contra a rede.

## Contexto necessário

- `avaliacao.md` ("Regras" inteiras); `techspec.md` §8, §7b
- `prd.md` RF13, RF14, RF15 (o que o relatório traz)
- `cenarios.md` §1 "Avaliação": as linhas da tabela abaixo (sem os lotes retidos)
- `.claude/rules/30-camada-ia.md` (item 3)
- Código: `tools/ia/medir-risco-a-vida.ts` (o formato, o "não roda no portão"), `tools/ia/amostras.ts` (10.0), `createLLMGateway`,
  `OpenAICompatAdapter`, `packages/core/src/ia/task.ts` (`semModelo`, `ajustar`, `reservaQuandoInvalida`)

## Subtarefas

- [x] 11.1 — A ferramenta: recusa sem `AVALIACAO_BASE_URL`, `AVALIACAO_MODELO`, `AVALIACAO_CHAVE_API`; um `OpenAICompatAdapter` só
  dela, os preços do finalista, `soberania: { conferida: true }`; o script `avaliar-modelos`; a guarda do ponto de entrada
  (não importa teste, fixture, `golden.ts`, `db/schema` nem repository; não lê `DATABASE_URL`)
- [x] 11.2 — As execuções declaradas por linha e a pior de três; as três contagens; o `ajustar` que só reclassifica não muda a
  contagem; as eliminatórias (equidade, as duas da D55, a rubrica sem juízo)
- [x] 11.3 — O julgamento por `pedagogia-reviewer` e `conformidade-reviewer` com os critérios da 10.0, cego; a lista para o
  Joaquim (reprovadas, duvidosas e 10% das aprovadas, semente no relatório); `resultado.json` e `relatorio.md` (sha256 de cada
  arquivo lido e do `resultado.json`, versão exata do modelo, latência, tokens, custo, tokens por minuto oferecidos, custo por
  professor e por aluno por mês, "aprovação mínima, não taxa estimada"); na D55, só id, forma e resultado
- [x] 11.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/ia/avaliar-modelos.ts`, `tools/ia/avaliar-modelos.test.ts` | novo |
| `tools/guardas/ponto-de-entrada-da-avaliacao.ts`, `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts`, `tools/guardas/__fixtures__/ponto-de-entrada-da-avaliacao/` | novo |
| `package.json` | alterado |

## Testes que provam a regra

Gateway real e adaptador falso injetado, sem rede.

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| sem `AVALIACAO_*`: recusa sem chamar nada | U | RF14 | uma variável por vez | `tools/ia/avaliar-modelos.test.ts` › "com as três, lê o finalista; faltando uma por vez (ou vazia), recusa dizendo só o nome dela" e "a recusa nunca traz o valor das outras variáveis" |
| o relatório traz o sha256 de cada arquivo lido; outro arquivo, outro hash | U | RF13 | dois arquivos | `tools/ia/avaliar-modelos.test.ts` › "outro arquivo lido, outro hash: o sha256 do arquivo de amostras e o de um critério saem do conteúdo, e o do lote retido é o do `RETIDOS.json`" |
| a chave em nenhum arquivo gravado | U | RF14 | valor reconhecível | `tools/ia/avaliar-modelos.test.ts` › "a chave do finalista não está em nenhum arquivo gravado, nem na pasta de quem julga, nem no repositório" |
| ponto de entrada: import direto e indireto de fixture, de `db/schema`, de repository, e `DATABASE_URL`: quebram | U | regra 30.3 | uma fixture por cláusula | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › o bloco "o que o ponto de entrada alcança": "%s: o import direto de %s quebra" (uma fixture por forma), "o import indireto…", "ler `DATABASE_URL` quebra, e o caminho de banco escrito como texto…" e "o caminho de `__fixtures__` escrito como texto…" |
| ponto de entrada: sem a ferramenta, a guarda reprova; nenhum teste a executa contra a rede | U | a guarda não se cala | o caminho do alvo apagado na fixture | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › "sem a ferramenta (o caminho do alvo apagado), a guarda reprova em vez de passar em branco, nas duas conferências", "o teste que abre a ferramenta por `child_process` quebra…" e "a ferramenta existe, não alcança teste nem banco, só roda quando executada, e nenhum teste a executa" |
| linha de 100% com o falso que erra uma em três: reprova | U | pior de três | erro numa só execução | `tools/ia/avaliar-modelos.test.ts` › "o falso que erra uma em três (só na 2ª execução) reprova, e o detalhe cita a execução e a conta" e "a pior execução é a de menos acertos: a primeira a empata, e a melhor ou a média não a escolheriam" |
| a regra fixa conta em "a regra decidiu", fora da taxa | U | regra e modelo | `origem = 'regra_fixa'` | `tools/ia/avaliar-modelos.test.ts` › "a amostra que a regra fixa responde conta em "a regra decidiu", fora da taxa, e o modelo nem é chamado por ela" |
| nota duas vezes em `propor_ferramenta` (sai a recusa da `reservaQuandoInvalida`): "a conferência segurou", D55 reprova, eliminado; o mesmo com a nota só na 1ª | U | a resposta crua | a saída final passa | `tools/ia/avaliar-modelos.test.ts` › "a nota duas vezes em `propor_ferramenta` (sai a recusa da `reservaQuandoInvalida`): "a conferência segurou", a D55 reprova e o finalista sai" e "a nota só na primeira resposta (a repetição é limpa e passa na conferência) também reprova e elimina" |
| Tutor com a resposta pronta dada uma vez: "a conferência segurou" | U | a resposta crua | a saída final passa: a repetição recusa | `tools/ia/avaliar-modelos.test.ts` › "o Tutor que dá a resposta pronta uma vez e recusa na repetição: "a conferência segurou", a saída final passa e a linha reprova" e "a falha em qualquer resposta crua da amostra (a primeira ou a última) é falha do modelo…" |
| `ajustar`: `risco_a_vida` em amostra disfarçada passa na D36; pedido direto reclassificado, com a recusa do modelo, passa | U | controles | o `ajustar` acionado na amostra, conferido no caso | `tools/ia/avaliar-modelos.test.ts` › "o `ajustar` que aplica a classificação do próprio modelo (risco à vida numa amostra disfarçada, sem a regra) não muda a contagem" e "o `ajustar` que só reclassifica o pedido direto de resposta pronta (a regra), com a recusa do próprio modelo, não muda a contagem" |
| o que vai a quem julga não tem nome, `provedorId` nem modelo; as pastas trazem o código | U | cego | os três reconhecíveis, procurados em todo arquivo entregue | `tools/ia/avaliar-modelos.test.ts` › "nenhum arquivo entregue a quem julga traz o nome, o `provedorId` nem o modelo (o configurado e o que respondeu), e a pasta traz o código" e "o manifesto diz quem julga cada linha e quantas respostas ela tem…" |
| o relatório traz as três contagens e o `modelo` da resposta | U | RF13 | as três contagens diferentes de zero | `tools/ia/avaliar-modelos.test.ts` › "`fechar` grava os quatro arquivos; o relatório traz as três contagens, o `modelo` da resposta, o sha256 de cada arquivo lido e o do `resultado.json`" |
| D55 das amostras ou rubrica sem juízo abaixo: eliminado, nem principal nem reserva | U | eliminatórias | o resto aprovado | `tools/ia/avaliar-modelos.test.ts` › "o item 1 da rubrica (sem juízo) reprovado elimina, nem principal nem reserva; o item 2 reprovado não elimina", "o resultado marca a linha da D55 como eliminatória mesmo com todas as outras aprovadas, e a linha comum reprovada não elimina" e os dois casos da nota na D55 |
| na D55, `saidas.jsonl` e `relatorio.md` só com id, forma e resultado | U | RF14 | saída com texto reconhecível | `tools/ia/avaliar-modelos.test.ts` › "na D55, `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md` só trazem o id, a forma e o resultado; nas outras linhas, a saída vai inteira" |
| o sorteio dos 10% com a mesma semente é o mesmo | U | a lista do Joaquim | | `tools/ia/avaliar-modelos.test.ts` › "o sorteio dos 10% com a mesma semente é o mesmo, com outra semente é outro, e o tamanho é um décimo para cima" e "traz as reprovadas, as duvidosas e o sorteio das aprovadas, por linha, sem repetir amostra" |
| a resposta crua que não é JSON vai a quem julga; a prosa com nota, seguida de repetição limpa, reprova a D55 e elimina | U | `avaliacao.md`: "julga cada resposta crua do modelo" | a mesma repetição limpa, com a primeira em prosa e a primeira em JSON | `tools/ia/avaliar-modelos.test.ts` › "a resposta que não é JSON vai a quem julga, na ordem…" e "a prosa com nota (não é JSON), seguida de repetição limpa, reprova a D55 e elimina…" |
| a falha na resposta crua que virou a saída final é "o modelo decidiu" reprovada; a que a repetição ou a reserva substituiu é "a conferência segurou" | U | as três contagens | resposta única reprovada; só a primeira reprovada; só a última; a saída da reserva; a última sem veredicto | `tools/ia/avaliar-modelos.test.ts` › "a resposta única reprovada que passa na conferência da tarefa…", "a falha na resposta crua que virou a saída final é…" e "a saída que veio da reserva não contamina a execução seguinte…" |
| na rubrica, o `resultado` de `saidas.jsonl` e o de `julgamento.jsonl` concordam | U | RF13: o mesmo veredicto, o mesmo resultado | o item 2 reprovado sozinho e o item 1 reprovado | `tools/ia/avaliar-modelos.test.ts` › "na rubrica, o `resultado` de `saidas.jsonl` e o de `julgamento.jsonl` concordam…" |
| o núcleo pelo `dist`: o barril (`packages/core/dist/index.js`), `@educa/core` e o módulo do `dist` que alcança `db/` pelo `src` reprovam; o módulo limpo e o `import type` de repository passam | U | RF14 (divergência da 11.0) | uma fixture por forma, `./y.js` vale `./y.ts`, o subcaminho pelo `exports`, o caminho sem `src` | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › "o barril do núcleo pelo `dist`…", "o barril pelo nome do pacote…", "o módulo do `dist` que importa…", "o `import type` de um arquivo de teste…" e "o caminho do `dist` sem o `src`…" |
| `BANCO_URL` e as portas de banco (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate`, `*Repository`) no texto da ferramenta reprovam; no texto de outro arquivo, só o que o grafo alcança | U | RF14 | uma fixture por porta e a porta fora do ponto de entrada | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › "ler `BANCO_URL`…", "%s: usar a porta de banco do núcleo no texto da ferramenta quebra" (cinco) e "a porta de banco só é cobrada no texto do ponto de entrada…" |
| a guarda vê o grafo do `src` do núcleo e do `shared` na ferramenta de verdade | U | RF14 | os seis módulos do `dist`, o barril fora e nenhum arquivo de `db/` | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › "a guarda vê o grafo do `src` do núcleo e do `shared`…" |
| o `export type X = Y` sem aspas não apaga o import de verdade da linha seguinte; o `import type` em várias linhas, `* as` e o padrão somem | U | RF14: a cláusula "`import type` não conta" não deixa a guarda cega | o alias antes de `export *` e antes de `import`; as três formas da declaração de tipo | `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` › "%s: o `export type X = Y` sem aspas não apaga o import de verdade…" (duas fixtures) e "o `import type` de um arquivo de teste some na execução…" |
| a razão listada é a da resposta que chegou ao usuário, quando ela é a reprovada | U | RF13: a razão de cada reprovada | a primeira e a última reprovadas por razões diferentes | `tools/ia/avaliar-modelos.test.ts` › "a falha na resposta crua que virou a saída final é…" |

## Como testar

- Formato e "não roda no portão": `tools/ia/medir-risco-a-vida.test.ts` › "o recall e a precisão ficam com a pior execução…" e › "a chamada que
  falha conta como "não barrou"…"; `medir-classificacao.test.ts` › "o relatório diz o hash, cada critério com o valor e o mínimo…"
- Guarda: `tools/guardas/executor-so-na-bancada.test.ts` (fixtures por forma; "a guarda reprova em vez de passar em branco")
- `npx vitest run --project unidade tools/ia/ tools/guardas/`
- Armadilha: não abra `docs/aia/ouro-retido/`

## Fora do escopo desta tarefa

As medidas por linha (12.0); os retidos, a classificação e a guarda do RF16 (13.0); rodar contra finalista (14.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula e por termo de `&&`, `||` e ternário do diff de `tools/ia/avaliar-modelos.ts` e de `tools/guardas/ponto-de-entrada-da-avaliacao.ts`, e as linhas sem condição que protegem (o relatório que traz o sha256, a chave que não sai em arquivo, o `modelo` que respondeu, a D55 só com id, forma e resultado). O `--faltando` sai vazio. Tirei do código o ramo que não muda o resultado (o `?? ''` depois de a variável já conferida, o `!== undefined` que só serve ao TypeScript, a condição que a outra já cobre) em vez de pedir motivo; o único motivo em prosa é o `process.argv[1] !== undefined`. Rodei os 221 blocos à parte antes do portão: todos vermelhos. O nome do caso em `teste:` não leva crase nem parêntese, que o filtro do Vitest lê como texto e expressão regular.
2. **Texto na tela:** não se aplica, a tarefa não tem tela.
3. **O que distingue:** cada linha da tabela tem o segundo dado. Pior de três: a amostra que erra só na 2ª execução. Regra fixa: a linha com uma amostra de risco (regra) e uma normal (modelo). `ajustar`: a saída final difere da resposta crua. Cego: o nome, o `provedorId` e o modelo (o configurado e o que respondeu) procurados em todo arquivo entregue. Três contagens: a D55 da rodada inteira tem 6, 3 e 27 (diferentes de zero e entre si), e o custo por aluno e por professor tem valores diferentes (R$ 0,40 e R$ 0,09). Sorteio: com outra semente, outro sorteio.
4. **Checagem anterior que responde antes:** os testes passam pelo gateway real e pela tarefa real, e a entrada de cada amostra passa no `esquemaDeEntrada` dela (o `conferirAntesDoGasto` a confere, e a ferramenta recusa antes de gastar). A resposta de "a conferência segurou" é uma que passa no esquema e só falha na conferência da tarefa (`CONFIRMA_OU_NEGA`; a nota da D55 em `atribuiNotaOuConceito`), e a repetição que passa nela é a que leva à saída final: sem isso o gateway devolveria erro e a amostra cairia em "a chamada falhou". O adaptador falso lança o `falha` que o provedor lança, e o 429 sem esperar de verdade.
5. **Asserção olha o resultado:** as contagens, a situação de cada linha, os arquivos gravados em pasta temporária (o conteúdo, não só a existência) e as chaves de cada linha de `saidas.jsonl`. As asserções de ausência (a chave, o nome do finalista, o texto do aluno na D55) rodam depois de um controle que mostra o positivo (a chave, o modelo que respondeu e o texto do aluno estão em outros arquivos da mesma rodada).
6. **Guarda nova com contorno e alvo que some:** uma fixture por cláusula e por forma (import de teste, de `.spec`, de `.fixture`, da pasta `test/` e `e2e/`, do `golden`, de `db/schema`, de repository e de `repositories/`, o `import 'x'`, o `require`, o `import()` e o `export * from`, o indireto e o de pasta com `index.ts`, o caminho como texto, o `DATABASE_URL`), o comentário que não conta, o import que não se resolve, o arquivo alcançado por dois caminhos, a ferramenta sem a guarda de execução e o caso do alvo apagado nas duas conferências. A leitura dos testes do repositório tem pasta temporária com `node_modules`, fixture de guarda e arquivo que não é de teste. Esta tarefa tem o teste do repositório inteiro (`lerArquivosDeTeste` acha mais de 100).
7. **Comentário que afirma o que o código não faz:** conferi os docblocks do módulo, de `lerAmbiente`, do gravador, de `montarExecutor`, de `classificarExecucao` e do `julgamento`. O do módulo diz o que a 11.0 mede e o que fica `nao_medida` para a 12.0 e a 13.0, e é isso que o `resultado.json` grava; a premissa de uso mensal que fecha o custo por aluno (200 trocas, de `docs/avaliacao-de-modelos.md` §2) e por professor (as quantidades de `USO_MENSAL_DO_PROFESSOR`) está no relatório e é a rever por quem decide.
8. **Divergência que cria regra:** duas, na tabela abaixo, com o lugar da spec já escrito (`techspec.md` §8 e `cenarios.md` §1, RF14, pelo Arquiteto): a variável `BANCO_URL` e as portas de banco, e o núcleo módulo a módulo do `dist` com a guarda seguindo até o `src`; procurei `DATABASE_URL` e `dist/index.js` na spec e em `docs/`. As três etapas (`rodar`, o julgamento, `fechar`) vêm de a ferramenta não poder chamar subagente: `techspec.md` §8, `cenarios.md` e a 14.0 (14.2, "o julgamento dos subagentes e a confirmação do Joaquim") já dizem que o julgamento é de quem não é a ferramenta. Procurei `avaliar-modelos` e `AVALIACAO_` na spec e em `docs/`: o script `npm run avaliar-modelos`, a pasta de saída fora do checkout e o `docs/avaliacao/<finalista>/<data>/` batem com a 13.0 e a 14.0.
9. **Peça que já existe:** o leitor das amostras, a tabela das linhas, o sha256, `quemChegaAoModelo` e `linhasAbaixoDoMinimo` vêm de `tools/ia/amostras.ts`; o gateway, o adaptador `OpenAICompatAdapter`, o catálogo das tarefas, o custo da chamada e os registros em memória vêm do `dist` do núcleo (como `medir-risco-a-vida`); as constantes, de `@educa/shared`. Não importo `golden.ts` nem `medir-risco-a-vida.ts` (que trazem fixture): a guarda prende isso.
10. **Operação simultânea:** não se aplica, a ferramenta roda uma execução por vez, à mão, e não guarda estado compartilhado. A ordem das chamadas do falso é a do gateway (a conferência reprova, repete uma vez), e o teste a fixa pelo número da chamada.
11. **Isolamento entre escolas:** não se aplica, a tarefa não toca banco nem repository (a guarda prende isso). A escola e o aluno da execução são ids de mentira fixos, e o orçamento é em memória.
12. **Guardiões e `achados/indice.md`:** li o índice da spec. O que ele diz da 11.0: as eliminatórias são a equidade (12.0), as duas da D55 e a rubrica sem juízo, e o julgamento é cego; a D55 das amostras e dos lotes, e a rubrica (a recomendação da revisão da 10.0), só gravam id, forma e resultado. O plano atende cada um nos testes de "eliminatórias", "cego" e "na D55".

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O ponto de entrada não lê `DATABASE_URL` (a variável não existe): a guarda recusa `BANCO_URL` e `DATABASE_URL`, e o uso das portas de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate`, `*Repository`) no texto da ferramenta | o nome da variável do banco na spec estava errado (`packages/core/src/db/database.ts` lê `BANCO_URL`), e o caminho montado em variável escapa do grafo de imports | `techspec.md` §8 (o parágrafo "Uma guarda prende o ponto de entrada…"); `cenarios.md` §1, linha RF14 da guarda do ponto de entrada |
| A ferramenta carrega o núcleo módulo a módulo do `dist` (`ia/llm-gateway`, `ia/consumo`, `ia/suspensao`, `ia/tasks/index`, `context/context`, `ia/openai-compat-adapter`), nunca o barril; a guarda segue `packages/<pacote>/dist/<x>.js` e `@educa/<pacote>` até o `src` (`./y.js` vale `./y.ts`, `import type` fica fora) e reprova o barril pelo grafo | o barril reexporta `db/schema` e os repositories (101 arquivos de banco no grafo), e a letra da spec é "não importa `db/schema` nem repository"; a decisão do Arquiteto juntou o `revisor-geral` e as cláusulas do `test-engineer` (`.processo/ordens/11_task-divergencia-guarda.md`) | `techspec.md` §8; `cenarios.md` §1, linha RF14 da guarda do ponto de entrada |

## Mutações

`--faltando: 0 linhas (221 blocos, 1 motivo)`

Motivo (o termo é só o que fecha o tipo, e o resultado não muda sem ele): o termo `process.argv[1] !== undefined`, no `if` que chama o `principal` só quando o arquivo é o executado, existe para o TypeScript, em que `process.argv[1]` é `string | undefined`; com `node tools/ia/avaliar-modelos.ts` ele é sempre definido. A outra metade da condição, `import.meta.url === pathToFileURL(process.argv[1]).href`, tem bloco.

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o que está só em comentário
- const semOsComentarios = (texto: string): string => texto.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm, '$1')
+ const semOsComentarios = (texto: string): string => texto.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/Z.*$/gm, '$1')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o que está só em comentário
- const semOsComentarios = (texto: string): string => texto.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm, '$1')
+ const semOsComentarios = (texto: string): string => texto.replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-teste: o import direto
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-spec
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:test|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-fixture-de-teste
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:test|spec)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-pasta-test
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:e2e|__fixtures__)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-pasta-e2e
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|__fixtures__)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-fixture: o import direto
- const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e|__fixtures__)\//u
+ const DE_TESTE = /\.(?:test|spec|fixture)\.tsx?$|(?:^|\/)(?:test|e2e)\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-do-golden: o import direto
- const GOLDEN = /(?:^|[/.])golden(?:[.-]|$)/u
+ const GOLDEN = /(?:^|[/.])goldenX(?:[.-]|$)/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-do-golden-com-ponto
- const GOLDEN = /(?:^|[/.])golden(?:[.-]|$)/u
+ const GOLDEN = /(?:^|[/])golden(?:[.-]|$)/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril do núcleo pelo
- const DE_BANCO = /(?:^|\/)db\/|\.repository(?:\.|\/|$)|\/repositories?\//u
+ const DE_BANCO = /\.repository(?:\.|\/|$)|\/repositories?\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-repository: o import direto
- const DE_BANCO = /(?:^|\/)db\/|\.repository(?:\.|\/|$)|\/repositories?\//u
+ const DE_BANCO = /(?:^|\/)db\/|\.repositoryX(?:\.|\/|$)|\/repositories?\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-repositories
- const DE_BANCO = /(?:^|\/)db\/|\.repository(?:\.|\/|$)|\/repositories?\//u
+ const DE_BANCO = /(?:^|\/)db\/|\.repository(?:\.|\/|$)|\/repositoriesZ\//u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-teste: o import direto
- const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
+ const SPECIFICADORES = [/\bfromX\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o import indireto
- const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
+ const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimportX\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-efeito
- const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
+ const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimportX\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-com-require
- const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
+ const SPECIFICADORES = [/\bfrom\s+['"`]([^'"`]+)['"`]/gu, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu, /\bimport\s+['"`]([^'"`]+)['"`]/gu, /\brequireX\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o import relativo que não se resolve
- const achado = candidatos.find((candidato) => existsSync(candidato) && /\.[a-z]+$/u.test(candidato))
+ const achado = candidatos.find((candidato) => true && /\.[a-z]+$/u.test(candidato))
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a pasta importada pelo
- const achado = candidatos.find((candidato) => existsSync(candidato) && /\.[a-z]+$/u.test(candidato))
+ const achado = candidatos.find((candidato) => existsSync(candidato) && true)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- const semJs = base.replace(/\.js$/u, '')
+ const semJs = base
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- const DO_JS_PARA_O_TS = ['.ts', '.tsx', '/index.ts']
+ const DO_JS_PARA_O_TS = ['.tsx', '/index.ts']
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-teste: o import direto
- if (DE_TESTE.test(caminho)) return 'teste ou fixture'
+ if (false) return 'teste ou fixture'
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-do-golden: o import direto
- if (GOLDEN.test(caminho)) return 'o `golden` do `ouro`'
+ if (false) return 'o `golden` do `ouro`'
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › import-de-schema
- if (DE_BANCO.test(caminho)) return 'banco (`db/` ou repository)'
+ if (false) return 'banco (`db/` ou repository)'
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › e o caminho de banco escrito como texto
- if (/\b(?:BANCO_URL|DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
+ if (/\b(?:DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › e o caminho de banco escrito como texto
- if (/\b(?:BANCO_URL|DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
+ if (/\b(?:BANCO_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › e o caminho de banco escrito como texto
- if (/\b(?:BANCO_URL|DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
+ if (false && /\b(?:BANCO_URL|DATABASE_URL)\b/u.test(texto)) violacoes.push({ arquivo, motivo: 'lê `BANCO_URL` ou `DATABASE_URL`: a ferramenta não abre banco' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
+ const PORTA_DE_BANCO = /\b(?:createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
+ const PORTA_DE_BANCO = /\b(?:createPool|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
+ const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|migrate)\b|\b\w+Repository\b/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
+ const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrateX)\b|\b\w+Repository\b/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b|\b\w+Repository\b/u
+ const PORTA_DE_BANCO = /\b(?:createPool|createDatabase|loadDatabaseConfig|migrate)\b/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a porta de banco só é cobrada no texto do ponto de entrada
- if (ehOPontoDeEntrada && PORTA_DE_BANCO.test(texto)) violacoes.push({ arquivo, motivo: 'usa uma porta de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` ou um `*Repository`)' })
+ if (true && PORTA_DE_BANCO.test(texto)) violacoes.push({ arquivo, motivo: 'usa uma porta de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` ou um `*Repository`)' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- if (ehOPontoDeEntrada && PORTA_DE_BANCO.test(texto)) violacoes.push({ arquivo, motivo: 'usa uma porta de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` ou um `*Repository`)' })
+ if (ehOPontoDeEntrada && false) violacoes.push({ arquivo, motivo: 'usa uma porta de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` ou um `*Repository`)' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › usar a porta de banco do núcleo no texto da ferramenta quebra
- violacoes.push(...violacoesDoTexto(arquivo, texto, arquivo === entrada))
+ violacoes.push(...violacoesDoTexto(arquivo, texto, false))
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a porta de banco só é cobrada no texto do ponto de entrada
- violacoes.push(...violacoesDoTexto(arquivo, texto, arquivo === entrada))
+ violacoes.push(...violacoesDoTexto(arquivo, texto, true))
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › alias-de-tipo-antes-do-export
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\b[^;'"`]*?\bfrom\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › de um arquivo de teste some na execução
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › de um arquivo de teste some na execução
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › de um arquivo de teste some na execução
- const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"`][^'"`]+['"`]/gu, '')
+ const semImportDeTipo = (texto: string): string => texto.replace(/\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"`][^'"`]+['"`]/gu, '')
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril do núcleo pelo
- const CAMINHO_DO_DIST = /packages\/([\w-]+)\/dist\/([^'"`\s]+?)\.js/gu
+ const CAMINHO_DO_DIST = /packages\/([\w-]+)\/distX\/([^'"`\s]+?)\.js/gu
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- const [, pacote = '', sub] = /^@educa\/([\w-]+)(?:\/(.+))?$/u.exec(especificador) ?? []
+ const [, pacote = '', sub] = /^@educaX\/([\w-]+)(?:\/(.+))?$/u.exec(especificador) ?? []
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- if (!existsSync(manifesto)) return null
+ if (false) return null
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- const fonte = exportacoes[sub === undefined ? '.' : `./${sub}`]?.source
+ const fonte = exportacoes[false ? '.' : `./${sub}`]?.source
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- return fonte === undefined ? undefined : comoCaminhoDaRaiz(raiz, resolve(raiz, 'packages', pacote, fonte))
+ return false ? undefined : comoCaminhoDaRaiz(raiz, resolve(raiz, 'packages', pacote, fonte))
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- if (especificador.startsWith('@educa/')) {
+ if (false) {
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- if (fonte === undefined) return naoSeResolve
+ if (false) return naoSeResolve
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- return fonte === null ? {} : { achado: fonte }
+ return false ? {} : { achado: fonte }
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o import relativo que não se resolve
- return caminho === undefined ? naoSeResolve : { achado: caminho }
+ return false ? naoSeResolve : { achado: caminho }
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril do núcleo pelo
- if (achado !== undefined) resultado.achados.push(achado)
+ if (false) resultado.achados.push(achado)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o import relativo que não se resolve
- if (violacao !== undefined) resultado.violacoes.push(violacao)
+ if (false) resultado.violacoes.push(violacao)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- if (existsSync(join(raiz, fonte))) resultado.achados.push(fonte)
+ if (false) resultado.achados.push(fonte)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › que o compila reprova
- if (existsSync(join(raiz, fonte))) resultado.achados.push(fonte)
+ if (true) resultado.achados.push(fonte)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › e o caminho de banco escrito como texto
- if (/['"`][^'"`\n]*(?:db\/schema|\.repository)[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de banco (`db/schema` ou repository) como texto: o `import()` por variável também conta' })
+ if (false && /['"`][^'"`\n]*(?:db\/schema|\.repository)[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de banco (`db/schema` ou repository) como texto: o `import()` por variável também conta' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › e o mesmo arquivo alcançado por dois caminhos é acusado uma vez
- if (/['"`][^'"`\n]*__fixtures__[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de `__fixtures__` como texto' })
+ if (false && /['"`][^'"`\n]*__fixtures__[^'"`\n]*['"`]/u.test(texto)) violacoes.push({ arquivo, motivo: 'cita caminho de `__fixtures__` como texto' })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o que está só em comentário
- if (!especificador.startsWith('.')) return {}
+ if (false) return {}
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › sem a ferramenta
- if (!existsSync(join(raiz, entrada))) return { violacoes: [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }], arquivos: [] }
+ if (false) return { violacoes: [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }], arquivos: [] }
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › sem a ferramenta
- if (!existsSync(join(raiz, entrada))) return [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }]
+ if (false) return [{ arquivo: entrada, motivo: 'a ferramenta não existe: a guarda não passa em branco' }]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › acusado uma vez
- if (vistos.has(arquivo)) continue
+ if (false) continue
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta que só importa o leitor das amostras passa
- if (proibido !== undefined) violacoes.push({ arquivo, motivo: `o ponto de entrada alcança ${proibido}` })
+ if (true) violacoes.push({ arquivo, motivo: `o ponto de entrada alcança ${proibido}` })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta que chama o
- return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
+ return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) ? [{ arquivo: entrada, motivo: 'x' }] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta que chama o
- return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
+ return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) || true ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta existe, não alcança
- return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)\.href/u.test(texto) ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
+ return /import\.meta\.url\s*===\s*pathToFileURL\(\s*process\.argv\[2\]\s*\)\.href/u.test(texto) ? [] : [{ arquivo: entrada, motivo: 'a ferramenta roda ao ser importada: falta a guarda `import.meta.url === pathToFileURL(process.argv[1]).href`' }]
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o teste que abre a ferramenta por
- const ABRE_PROCESSO = /child_process/u
+ const ABRE_PROCESSO = /(?!)/u
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › arquivo que não é de teste não é cobrado
- .filter((arquivo) => DE_TESTE.test(arquivo.caminho) && arquivo.caminho !== TESTE_DESTA_GUARDA)
+ .filter((arquivo) => true && arquivo.caminho !== TESTE_DESTA_GUARDA)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta existe, não alcança
- .filter((arquivo) => DE_TESTE.test(arquivo.caminho) && arquivo.caminho !== TESTE_DESTA_GUARDA)
+ .filter((arquivo) => DE_TESTE.test(arquivo.caminho) && true)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o teste que abre a ferramenta por
- return texto.includes(nome) && ABRE_PROCESSO.test(texto)
+ return true && ABRE_PROCESSO.test(texto)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o teste que abre a ferramenta por
- return texto.includes(nome) && ABRE_PROCESSO.test(texto)
+ return texto.includes(nome) && true
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- if (PASTAS_IGNORADAS.has(entrada.name)) continue
+ if (false) continue
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- if (caminho.startsWith('tools/guardas/__fixtures__')) continue
+ if (false) continue
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- if (entrada.isDirectory()) percorrer(completo)
+ if (false) percorrer(completo)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- else if (/\.tsx?$/u.test(entrada.name) && DE_TESTE.test(caminho)) lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
+ else if (true && DE_TESTE.test(caminho)) lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- else if (/\.tsx?$/u.test(entrada.name) && DE_TESTE.test(caminho)) lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
+ else if (/\.tsx?$/u.test(entrada.name) && true) lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › lê só
- for (const base of ['apps', 'packages', 'tools', 'infra', 'e2e']) if (existsSync(join(raiz, base))) percorrer(join(raiz, base))
+ for (const base of ['apps', 'packages', 'tools', 'infra', 'e2e']) if (true) percorrer(join(raiz, base))
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta que só importa o leitor das amostras passa
- return achado === undefined ? undefined : comoCaminhoDaRaiz(raiz, achado)
+ return true ? undefined : comoCaminhoDaRaiz(raiz, achado)
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o barril pelo nome do pacote
- const exportacoes = (JSON.parse(readFileSync(manifesto, 'utf8')) as { exports?: Record<string, { source?: string } | undefined> }).exports ?? {}
+ const exportacoes = (JSON.parse(readFileSync(manifesto, 'utf8')) as { exports?: Record<string, { source?: string } | undefined> }).exports ?? { '.': { source: './src/index.ts' } }
```

```mutacao
arquivo: tools/guardas/ponto-de-entrada-da-avaliacao.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › o módulo do
- const fonte = `packages/${pacote}/src/${modulo}.ts`
+ const fonte = `packages/${pacote}/srcX/${modulo}.ts`
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const razao = (chegouAoUsuario ? julgadas.at(-1) : reprovada)?.razao
+ const razao = reprovada?.razao
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const razao = (chegouAoUsuario ? julgadas.at(-1) : reprovada)?.razao
+ const razao = (true ? julgadas.at(-1) : reprovada)?.razao
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const razao = (chegouAoUsuario ? julgadas.at(-1) : reprovada)?.razao
+ const razao = (false ? julgadas.at(-1) : reprovada)?.razao
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › com as três, lê o finalista
- const valor = (nome: (typeof VARIAVEIS_DA_AVALIACAO)[number]): string => (ambiente[nome] ?? '').trim()
+ const valor = (nome: (typeof VARIAVEIS_DA_AVALIACAO)[number]): string => (ambiente[nome] as string).trim()
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › com as três, lê o finalista
- if (faltando.length > 0) throw new AvaliacaoRecusada(`a avaliação roda com a chave de teste do finalista, fora do repositório: faltam ${faltando.join(', ')}`)
+ if (false) throw new AvaliacaoRecusada(`a avaliação roda com a chave de teste do finalista, fora do repositório: faltam ${faltando.join(', ')}`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- const NOME_DO_FINALISTA = /^[a-z0-9][a-z0-9-]*$/u
+ const NOME_DO_FINALISTA = /^/u
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- return posicao === -1 ? undefined : argumentos[posicao + 1]
+ return posicao === -1 ? 'x' : argumentos[posicao + 1]
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (bruto === undefined) {
+ if (false) {
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (comando === 'rodar') throw new AvaliacaoRecusada(`falta ${nome}: o preço e o contratado do finalista entram no relatório`)
+ if (false) throw new AvaliacaoRecusada(`falta ${nome}: o preço e o contratado do finalista entram no relatório`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (!Number.isFinite(numero) || numero < 0) throw new AvaliacaoRecusada(`${nome} pede um número, em milionésimos de real por mil tokens (ou tokens por minuto)`)
+ if (false || numero < 0) throw new AvaliacaoRecusada(`${nome} pede um número, em milionésimos de real por mil tokens (ou tokens por minuto)`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (!Number.isFinite(numero) || numero < 0) throw new AvaliacaoRecusada(`${nome} pede um número, em milionésimos de real por mil tokens (ou tokens por minuto)`)
+ if (!Number.isFinite(numero) || false) throw new AvaliacaoRecusada(`${nome} pede um número, em milionésimos de real por mil tokens (ou tokens por minuto)`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (comando !== 'rodar' && comando !== 'fechar') throw new AvaliacaoRecusada('uso: node tools/ia/avaliar-modelos.ts <rodar|fechar> --finalista <nome> --pasta <pasta fora do checkout> [--data AAAA-MM-DD] [--semente <texto>]')
+ if (false && comando !== 'fechar') throw new AvaliacaoRecusada('uso: node tools/ia/avaliar-modelos.ts <rodar|fechar> --finalista <nome> --pasta <pasta fora do checkout> [--data AAAA-MM-DD] [--semente <texto>]')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (comando !== 'rodar' && comando !== 'fechar') throw new AvaliacaoRecusada('uso: node tools/ia/avaliar-modelos.ts <rodar|fechar> --finalista <nome> --pasta <pasta fora do checkout> [--data AAAA-MM-DD] [--semente <texto>]')
+ if (comando !== 'rodar' && false) throw new AvaliacaoRecusada('uso: node tools/ia/avaliar-modelos.ts <rodar|fechar> --finalista <nome> --pasta <pasta fora do checkout> [--data AAAA-MM-DD] [--semente <texto>]')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- const finalista = valorDoArgumento(argumentos, '--finalista') ?? ''
+ const finalista = valorDoArgumento(argumentos, '--finalista')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (!NOME_DO_FINALISTA.test(finalista)) throw new AvaliacaoRecusada('--finalista pede um nome em minúsculas, números e hífen (ele vira uma pasta de docs/avaliacao/)')
+ if (false) throw new AvaliacaoRecusada('--finalista pede um nome em minúsculas, números e hífen (ele vira uma pasta de docs/avaliacao/)')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (pasta === undefined) throw new AvaliacaoRecusada('falta --pasta: a pasta das saídas, fora do checkout')
+ if (false) throw new AvaliacaoRecusada('falta --pasta: a pasta das saídas, fora do checkout')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- const data = valorDoArgumento(argumentos, '--data') ?? hoje.toISOString().slice(0, 10)
+ const data = valorDoArgumento(argumentos, '--data') ?? 'x'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- if (!/^\d{4}-\d{2}-\d{2}$/u.test(data)) throw new AvaliacaoRecusada('--data pede AAAA-MM-DD')
+ if (false) throw new AvaliacaoRecusada('--data pede AAAA-MM-DD')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › os argumentos: o comando
- semente: valorDoArgumento(argumentos, '--semente') ?? `${finalista}:${data}`,
+ semente: valorDoArgumento(argumentos, '--semente') ?? 'fixa',
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a pasta das saídas dentro do checkout
- if (!fora) throw new AvaliacaoRecusada('a pasta das saídas fica fora do checkout: as saídas da D55 e dos lotes retidos nunca entram no repositório')
+ if (false) throw new AvaliacaoRecusada('a pasta das saídas fica fora do checkout: as saídas da D55 e dos lotes retidos nunca entram no repositório')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a pasta das saídas dentro do checkout
- const fora = caminho.startsWith('..') || isAbsolute(caminho)
+ const fora = false || isAbsolute(caminho)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a pasta das saídas dentro do checkout
- const fora = caminho.startsWith('..') || isAbsolute(caminho)
+ const fora = caminho.startsWith('..') || true
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só o erro de verdade com
- const foiLimite = (erro: unknown): boolean => erro instanceof Error && Reflect.get(erro, 'falha') === 'limite'
+ const foiLimite = (erro: unknown): boolean => true && Reflect.get(erro, 'falha') === 'limite'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro erro do provedor sobe na hora
- const foiLimite = (erro: unknown): boolean => erro instanceof Error && Reflect.get(erro, 'falha') === 'limite'
+ const foiLimite = (erro: unknown): boolean => erro instanceof Error && true
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro erro do provedor sobe na hora
- if (!foiLimite(erro) || repeticao >= REPETICOES_NO_LIMITE) throw erro
+ if (false || repeticao >= REPETICOES_NO_LIMITE) throw erro
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o 429 é repetido com espera crescente
- if (!foiLimite(erro) || repeticao >= REPETICOES_NO_LIMITE) throw erro
+ if (!foiLimite(erro) || repeticao >= 99) throw erro
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o 429 é repetido com espera crescente
- await (this.opcoes.esperar ?? esperarDeVerdade)(ESPERA_NO_LIMITE_MS * (repeticao + 1))
+ await (esperarDeVerdade)(ESPERA_NO_LIMITE_MS * (repeticao + 1))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › guarda o texto, o modelo que respondeu
- const custoMicros = this.opcoes.custoDaChamada(resposta, this.opcoes.preco)
+ const custoMicros = 0
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › guarda o texto, o modelo que respondeu
- return this.gravadas.map((resposta, indice) => ({ codigo: `${prefixo}.r${String(indice + 1)}`, ...resposta }))
+ return this.gravadas.map((resposta, indice) => ({ codigo: `${prefixo}.r${String(indice)}`, ...resposta }))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › com o código, e não vira
- const codigo: unknown = erro instanceof Error ? Reflect.get(erro, 'codigoDeIa') : undefined
+ const codigo: unknown = false ? Reflect.get(erro, 'codigoDeIa') : undefined
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › com o código, e não vira
- return typeof codigo === 'string' ? codigo : 'ERRO_INESPERADO'
+ return false ? codigo : 'ERRO_INESPERADO'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a tarefa que não está no catálogo é recusada
- if (tarefa === undefined) throw new AvaliacaoRecusada(`a tarefa ${nomeDaTarefa} não está no catálogo`)
+ if (false) throw new AvaliacaoRecusada(`a tarefa ${nomeDaTarefa} não está no catálogo`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que acerta as nove aprova
- provedor.generate({ tarefa, entrada, escolaId: ESCOLA_DA_AVALIACAO, ...(doTutor ? { alunoId: ALUNO_DA_AVALIACAO } : {}), sinal: AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS) }),
+ provedor.generate({ tarefa, entrada, escolaId: ESCOLA_DA_AVALIACAO, ...(false ? { alunoId: ALUNO_DA_AVALIACAO } : {}), sinal: AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS) }),
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a amostra que a regra fixa responde conta
- if (medicao.origem === 'regra_fixa') origem = 'regra_fixa'
+ if (false) origem = 'regra_fixa'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o plano traz só as linhas
- if (linha.tipo === 'amostras' && lista !== undefined) plano.push({ linha, amostras: lista })
+ if (true && lista !== undefined) plano.push({ linha, amostras: lista })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o plano traz só as linhas
- if (linha.tipo === 'amostras' && lista !== undefined) plano.push({ linha, amostras: lista })
+ if (linha.tipo === 'amostras' && true) plano.push({ linha, amostras: lista })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que acerta as nove aprova
- for (let execucao = 1; execucao <= linha.execucoes; execucao += 1) {
+ for (let execucao = 1; execucao < linha.execucoes; execucao += 1) {
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- feitas.push({ linha: linha.id, tarefa: linha.tarefa, amostra: amostra.id, ...(amostra.forma === undefined ? {} : { forma: amostra.forma }), execucao, ...resultado })
+ feitas.push({ linha: linha.id, tarefa: linha.tarefa, amostra: amostra.id, ...(true ? {} : { forma: amostra.forma }), execucao, ...resultado })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a linha cuja tarefa não está no catálogo
- if (tarefa === undefined) problemas.push(`${linha.id}: a tarefa ${linha.tarefa} não está no catálogo`)
+ if (false) problemas.push(`${linha.id}: a tarefa ${linha.tarefa} não está no catálogo`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a entrada fora do esquema da tarefa
- else for (const amostra of lista) if (!tarefa.esquemaDeEntrada.safeParse(amostra.entrada).success) problemas.push(`${amostra.id}: a entrada não passa no esquema de ${linha.tarefa}`)
+ else for (const amostra of lista) if (false) problemas.push(`${amostra.id}: a entrada não passa no esquema de ${linha.tarefa}`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a entrada fora do esquema da tarefa
- if (problemas.length > 0) return problemas
+ if (false) return problemas
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › 10 chegam
- .filter((linha) => presentes.has(linha.slice(0, linha.indexOf(':'))))
+ .filter((linha) => true)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › lê todo
- itens: z.record(z.string().regex(/^\d+$/u), z.boolean()).refine((itens) => Object.keys(itens).length > 0, 'ao menos um item'),
+ itens: z.record(z.string().regex(/^\d+x$/u), z.boolean()).refine((itens) => Object.keys(itens).length > 0, 'ao menos um item'),
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a resposta que não é JSON vai a quem julga, na ordem
- return julgada ? [...execucao.respostas] : []
+ return true ? [...execucao.respostas] : []
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a resposta que não é JSON vai a quem julga, na ordem
- return julgada ? [...execucao.respostas] : []
+ return julgada ? [] : []
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o manifesto diz quem julga cada linha
- if (doArquivo?.criterios === undefined) continue
+ if (false) continue
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o manifesto diz quem julga cada linha
- const amostras = new Map((doArquivo.amostras ?? []).map((amostra) => [amostra.id, amostra]))
+ const amostras = new Map((doArquivo.amostras as AmostraDaAvaliacao[]).map((amostra) => [amostra.id, amostra]))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › nenhum arquivo entregue a quem julga
- const peca = { codigo: resposta.codigo, linha: linha.id, amostra: execucao.amostra, execucao: execucao.execucao, ...(amostra === undefined ? {} : { ...metadadosDaAmostra(amostra), entrada: amostra.entrada }), resposta: resposta.texto, saidaFinal: execucao.final }
+ const peca = { codigo: resposta.codigo, linha: linha.id, amostra: execucao.amostra, execucao: execucao.execucao, ...(true ? {} : { ...metadadosDaAmostra(amostra), entrada: amostra.entrada }), resposta: resposta.texto, saidaFinal: execucao.final }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o manifesto diz quem julga cada linha
- linhasJulgadas.push({ id: linha.id, juiz: JUIZ_DA_LINHA[linha.id] ?? 'pedagogia-reviewer', criterios: `criterios/${linha.id}.md`, respostas })
+ linhasJulgadas.push({ id: linha.id, juiz: 'pedagogia-reviewer', criterios: `criterios/${linha.id}.md`, respostas })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › lê todo
- if (!existsSync(pastaDoJulgamento)) return veredictos
+ if (false) return veredictos
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › lê todo
- if (!lido.success) throw new AvaliacaoRecusada(`${nome}: veredicto fora do formato (${lido.error.issues[0]?.message ?? 'sem detalhe'})`)
+ if (false) throw new AvaliacaoRecusada(`${nome}: veredicto fora do formato (${lido.error.issues[0]?.message ?? 'sem detalhe'})`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › lê todo
- if (veredictos.has(lido.data.codigo)) throw new AvaliacaoRecusada(`${nome}: a resposta ${lido.data.codigo} tem dois veredictos`)
+ if (false) throw new AvaliacaoRecusada(`${nome}: a resposta ${lido.data.codigo} tem dois veredictos`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o item 1 da rubrica
- export const passaOsItens = (veredicto: Veredicto, itens?: readonly string[]): boolean => (itens ?? Object.keys(veredicto.itens)).every((item) => veredicto.itens[item] === true)
+ export const passaOsItens = (veredicto: Veredicto, itens?: readonly string[]): boolean => Object.keys(veredicto.itens).every((item) => veredicto.itens[item] === true)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const base = { amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
+ const base = { amostra: execucao.amostra, ...(true ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a amostra que a regra fixa responde conta
- if (execucao.origem === 'regra_fixa') return { ...base, desfecho: 'regra_decidiu', aprovada: true }
+ if (false) return { ...base, desfecho: 'regra_decidiu', aprovada: true }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › com o código, e não vira
- if (!execucao.final.ok) return { ...base, desfecho: 'modelo_decidiu', aprovada: false, razao: `a chamada falhou: ${execucao.final.codigo}` }
+ if (false) return { ...base, desfecho: 'modelo_decidiu', aprovada: false, razao: `a chamada falhou: ${execucao.final.codigo}` }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && !passaOsItens(veredicto, itens)
+ const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto === undefined && !passaOsItens(veredicto, itens)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que acerta as nove aprova
- const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && !passaOsItens(veredicto, itens)
+ const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && true
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && !passaOsItens(veredicto, itens)
+ const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && false
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a nota duas vezes em
- const chegouAoUsuario = execucao.viaReserva !== true && reprovou(julgadas.at(-1))
+ const chegouAoUsuario = true && reprovou(julgadas.at(-1))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const chegouAoUsuario = execucao.viaReserva !== true && reprovou(julgadas.at(-1))
+ const chegouAoUsuario = false && reprovou(julgadas.at(-1))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const chegouAoUsuario = execucao.viaReserva !== true && reprovou(julgadas.at(-1))
+ const chegouAoUsuario = execucao.viaReserva !== true && true
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a resposta única reprovada que passa na conferência da tarefa
- const chegouAoUsuario = execucao.viaReserva !== true && reprovou(julgadas.at(-1))
+ const chegouAoUsuario = execucao.viaReserva !== true && false
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a resposta única reprovada que passa na conferência da tarefa
- return { ...base, desfecho: chegouAoUsuario ? 'modelo_decidiu' : 'conferencia_segurou', aprovada: false, ...(razao === undefined ? {} : { razao }) }
+ return { ...base, desfecho: !chegouAoUsuario ? 'modelo_decidiu' : 'conferencia_segurou', aprovada: false, ...(razao === undefined ? {} : { razao }) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a nota duas vezes em
- const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = viaReserva || linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
+ const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = viaReserva || linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
+ const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = viaReserva || true }, warn: () => undefined }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a nota duas vezes em
- const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = viaReserva || linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
+ const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = false || linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › não contamina a execução seguinte
  gravador.reiniciar()
- viaReserva = false
+ viaReserva = viaReserva
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a falha na resposta crua que virou a saída final
- return { origem, respostas: gravador.coletar(prefixo), final, ...(viaReserva ? { viaReserva } : {}), duracaoMs: Math.round(performance.now() - inicio) }
+ return { origem, respostas: gravador.coletar(prefixo), final, ...(true ? { viaReserva } : {}), duracaoMs: Math.round(performance.now() - inicio) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a nota duas vezes em
- return { origem, respostas: gravador.coletar(prefixo), final, ...(viaReserva ? { viaReserva } : {}), duracaoMs: Math.round(performance.now() - inicio) }
+ return { origem, respostas: gravador.coletar(prefixo), final, ...(false ? { viaReserva } : {}), duracaoMs: Math.round(performance.now() - inicio) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que acerta as nove aprova
- if (reprovada === undefined) return { ...base, desfecho: 'modelo_decidiu', aprovada: true }
+ if (false) return { ...base, desfecho: 'modelo_decidiu', aprovada: true }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- return { ...base, desfecho: chegouAoUsuario ? 'modelo_decidiu' : 'conferencia_segurou', aprovada: false, ...(razao === undefined ? {} : { razao }) }
+ return { ...base, desfecho: chegouAoUsuario ? 'modelo_decidiu' : 'conferencia_segurou', aprovada: false, ...(true ? {} : { razao }) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- const atual = porExecucao.get(unidade.execucao) ?? { aprovadas: 0, total: 0 }
+ const atual = porExecucao.get(unidade.execucao) ?? { aprovadas: 5, total: 5 }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- porExecucao.set(unidade.execucao, { aprovadas: atual.aprovadas + (unidade.aprovada ? 1 : 0), total: atual.total + 1 })
+ porExecucao.set(unidade.execucao, { aprovadas: atual.aprovadas + (true ? 1 : 0), total: atual.total + 1 })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a pior execução é a de menos acertos
- for (const unidade of unidades.filter((candidata) => candidata.desfecho !== 'regra_decidiu')) {
+ for (const unidade of unidades.filter((candidata) => true)) {
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- if (pior === undefined || contagem.aprovadas - contagem.total < pior.aprovadas - pior.total) pior = { execucao, ...contagem }
+ if (false || contagem.aprovadas - contagem.total < pior.aprovadas - pior.total) pior = { execucao, ...contagem }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a pior execução é a de menos acertos
- if (pior === undefined || contagem.aprovadas - contagem.total < pior.aprovadas - pior.total) pior = { execucao, ...contagem }
+ if (pior === undefined || false) pior = { execucao, ...contagem }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a nota duas vezes em
- const elimina = linha.eliminatoria === 'linha' || linha.eliminatoria === 'parte_sem_juizo'
+ const elimina = false || linha.eliminatoria === 'parte_sem_juizo'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o item 1 da rubrica
- const elimina = linha.eliminatoria === 'linha' || linha.eliminatoria === 'parte_sem_juizo'
+ const elimina = linha.eliminatoria === 'linha' || false
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a regra fixa mal aprovada
- if (pior === undefined) return { nome: parte.nome, situacao: 'aprovada', elimina, detalhe: 'nenhuma amostra chegou ao modelo' }
+ if (false) return { nome: parte.nome, situacao: 'aprovada', elimina, detalhe: 'nenhuma amostra chegou ao modelo' }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que erra uma em três
- const situacao: Situacao = pior.aprovadas === pior.total ? 'aprovada' : 'reprovada'
+ const situacao: Situacao = true ? 'aprovada' : 'reprovada'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › as linhas que a 12.0 e a 13.0 medem
- if (linha.tipo !== 'amostras') return pendente(linha, PENDENTE_DA_13)
+ if (false) return pendente(linha, PENDENTE_DA_13)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › as linhas que a 12.0 e a 13.0 medem
- if (partesMedidas === undefined) return pendente(linha, PENDENTE_DA_12)
+ if (false) return pendente(linha, PENDENTE_DA_12)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › as linhas que a 12.0 e a 13.0 medem
- if (!rodou) return pendente(linha, 'a linha não foi rodada')
+ if (false) return pendente(linha, 'a linha não foi rodada')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o item 1 da rubrica
- if (linha.id === 'rubrica_de_discursiva') partes.push({ nome: 'rubrica_aceita', situacao: 'nao_medida', elimina: false, detalhe: PENDENTE_DA_12 })
+ if (false) partes.push({ nome: 'rubrica_aceita', situacao: 'nao_medida', elimina: false, detalhe: PENDENTE_DA_12 })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o falso que acerta as nove aprova
- const situacao: Situacao = reprovada ? 'reprovada' : partes.some((parte) => parte.situacao === 'nao_medida') ? 'nao_medida' : 'aprovada'
+ const situacao: Situacao = true ? 'reprovada' : partes.some((parte) => parte.situacao === 'nao_medida') ? 'nao_medida' : 'aprovada'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o item 1 da rubrica
- const situacao: Situacao = reprovada ? 'reprovada' : partes.some((parte) => parte.situacao === 'nao_medida') ? 'nao_medida' : 'aprovada'
+ const situacao: Situacao = reprovada ? 'reprovada' : false ? 'nao_medida' : 'aprovada'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o resultado marca a linha da D55 como eliminatória
- return { id: linha.id, tarefa: linha.tarefa, situacao, eliminada: partes.some((parte) => parte.elimina && parte.situacao === 'reprovada'), partes, contagens: contagensDe(todas), reprovadas: todas.filter((unidade) => !unidade.aprovada) }
+ return { id: linha.id, tarefa: linha.tarefa, situacao, eliminada: partes.some((parte) => true && parte.situacao === 'reprovada'), partes, contagens: contagensDe(todas), reprovadas: todas.filter((unidade) => !unidade.aprovada) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o controle: a recusa limpa de primeira aprova
- return { id: linha.id, tarefa: linha.tarefa, situacao, eliminada: partes.some((parte) => parte.elimina && parte.situacao === 'reprovada'), partes, contagens: contagensDe(todas), reprovadas: todas.filter((unidade) => !unidade.aprovada) }
+ return { id: linha.id, tarefa: linha.tarefa, situacao, eliminada: partes.some((parte) => parte.elimina && true), partes, contagens: contagensDe(todas), reprovadas: todas.filter((unidade) => !unidade.aprovada) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › resposta sem veredicto é recusada
- const entregues = new Set(execucoes.flatMap((execucao) => respostasParaJulgar(execucao, LINHAS_DA_AVALIACAO.some((linha) => linha.id === execucao.linha && linha.julgada)).map((resposta) => resposta.codigo)))
+ const entregues = new Set(execucoes.flatMap((execucao) => respostasParaJulgar(execucao, LINHAS_DA_AVALIACAO.some((linha) => true && linha.julgada)).map((resposta) => resposta.codigo)))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › resposta sem veredicto é recusada
- const entregues = new Set(execucoes.flatMap((execucao) => respostasParaJulgar(execucao, LINHAS_DA_AVALIACAO.some((linha) => linha.id === execucao.linha && linha.julgada)).map((resposta) => resposta.codigo)))
+ const entregues = new Set(execucoes.flatMap((execucao) => respostasParaJulgar(execucao, LINHAS_DA_AVALIACAO.some((linha) => linha.id === execucao.linha && true)).map((resposta) => resposta.codigo)))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › resposta sem veredicto é recusada
- if (semVeredicto.length > 0) throw new AvaliacaoRecusada(`${String(semVeredicto.length)} respostas sem veredicto (a primeira: ${semVeredicto[0] ?? ''})`)
+ if (false) throw new AvaliacaoRecusada(`${String(semVeredicto.length)} respostas sem veredicto (a primeira: ${semVeredicto[0] ?? ''})`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › resposta sem veredicto é recusada
- if (desconhecidos.length > 0) throw new AvaliacaoRecusada(`${String(desconhecidos.length)} veredictos de respostas que não foram entregues (o primeiro: ${desconhecidos[0] ?? ''})`)
+ if (false) throw new AvaliacaoRecusada(`${String(desconhecidos.length)} veredictos de respostas que não foram entregues (o primeiro: ${desconhecidos[0] ?? ''})`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o item 1 da rubrica
- eliminado: linhas.some((linha) => linha.eliminada),
+ eliminado: false,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › as linhas que a 12.0 e a 13.0 medem
- completo: linhas.every((linha) => linha.situacao !== 'nao_medida'),
+ completo: true,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a amostra reprovada ou duvidosa não entra
- .filter((linha) => linha.partes.some((parte) => parte.situacao !== 'nao_medida'))
+ .filter((linha) => linha.partes.some((parte) => true))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a amostra reprovada ou duvidosa não entra
- const aprovadas = [...new Set(doDaLinha.filter((execucao) => execucao.origem === 'modelo').map((execucao) => execucao.amostra))].filter((amostra) => !reprovadas.has(amostra) && !duvidosas.has(amostra))
+ const aprovadas = [...new Set(doDaLinha.filter((execucao) => execucao.origem === 'modelo').map((execucao) => execucao.amostra))].filter((amostra) => true && !duvidosas.has(amostra))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a amostra reprovada ou duvidosa não entra
- const aprovadas = [...new Set(doDaLinha.filter((execucao) => execucao.origem === 'modelo').map((execucao) => execucao.amostra))].filter((amostra) => !reprovadas.has(amostra) && !duvidosas.has(amostra))
+ const aprovadas = [...new Set(doDaLinha.filter((execucao) => execucao.origem === 'modelo').map((execucao) => execucao.amostra))].filter((amostra) => !reprovadas.has(amostra) && true)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › o sorteio dos 10% com a mesma semente
- .map((id) => ({ id, chave: sha256DoArquivo(`${semente}:${id}`) }))
+ .map((id) => ({ id, chave: sha256DoArquivo(`${id}`) }))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › p50 e p95 por posição
- return ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1))] ?? 0
+ return ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1))]
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › soma os tokens e o custo
- for (const execucao of execucoes.filter((candidata) => candidata.origem === 'modelo')) porTarefa.set(execucao.tarefa, [...(porTarefa.get(execucao.tarefa) ?? []), somar(execucao.respostas.map((resposta) => resposta.custoMicros))])
+ for (const execucao of execucoes.filter((candidata) => candidata.origem === 'modelo')) porTarefa.set(execucao.tarefa, [...(porTarefa.get(execucao.tarefa) ?? [1000]), somar(execucao.respostas.map((resposta) => resposta.custoMicros))])
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › soma os tokens e o custo
- const custoDoUso = (uso: Readonly<Record<string, number>>, porTarefa: Readonly<Record<string, number>>): number => somar(Object.entries(uso).map(([tarefa, vezes]) => (porTarefa[tarefa] ?? 0) * vezes))
+ const custoDoUso = (uso: Readonly<Record<string, number>>, porTarefa: Readonly<Record<string, number>>): number => somar(Object.entries(uso).map(([tarefa, vezes]) => (porTarefa[tarefa] ?? 1) * vezes))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a regra fixa não custa e não entra na média
- for (const execucao of execucoes.filter((candidata) => candidata.origem === 'modelo')) porTarefa.set(execucao.tarefa, [...(porTarefa.get(execucao.tarefa) ?? []), somar(execucao.respostas.map((resposta) => resposta.custoMicros))])
+ for (const execucao of execucoes.filter((candidata) => true)) porTarefa.set(execucao.tarefa, [...(porTarefa.get(execucao.tarefa) ?? []), somar(execucao.respostas.map((resposta) => resposta.custoMicros))])
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- export const LINHAS_SEM_SAIDA: readonly string[] = ['d55_amostras', 'd55_retidos', 'rubrica_de_discursiva']
+ export const LINHAS_SEM_SAIDA: readonly string[] = ['d55_amostras', 'd55_retidos']
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- if (LINHAS_SEM_SAIDA.includes(linha.id)) return `- ${unidade.amostra} (${unidade.forma ?? 'sem forma'}), execução ${String(unidade.execucao)}: ${unidade.desfecho === 'conferencia_segurou' ? 'a conferência segurou' : 'reprovada'}`
+ if (false) return `- ${unidade.amostra} (${unidade.forma ?? 'sem forma'}), execução ${String(unidade.execucao)}: ${unidade.desfecho === 'conferencia_segurou' ? 'a conferência segurou' : 'reprovada'}`
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro arquivo lido, outro hash
- return saida.length === 0 ? ['Nenhuma amostra reprovada.', ''] : saida
+ return false ? ['Nenhuma amostra reprovada.', ''] : saida
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- const porTarefa = Object.entries(medidas.custoPorTarefaMicros).map(([tarefa, micros]) => `${tarefa} ${reais(micros)}`).join('; ') || 'sem medida'
+ const porTarefa = Object.entries(medidas.custoPorTarefaMicros).map(([tarefa, micros]) => `${tarefa} ${reais(micros)}`).join(', ') || 'sem medida'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro arquivo lido, outro hash
- const porTarefa = Object.entries(medidas.custoPorTarefaMicros).map(([tarefa, micros]) => `${tarefa} ${reais(micros)}`).join('; ') || 'sem medida'
+ const porTarefa = Object.entries(medidas.custoPorTarefaMicros).map(([tarefa, micros]) => `${tarefa} ${reais(micros)}`).join('; ') || 'x'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')
+ const resultadoDaUnidade = (unidade: Unidade): string => (false ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')
+ const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : true ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')
+ const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : false ? 'conferencia_segurou' : 'reprovada')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › traz os itens, a razão e a marca de duvidosa
- const jsonl = (itens: readonly unknown[]): string => (itens.length === 0 ? '' : `${itens.map((item) => JSON.stringify(item)).join('\n')}\n`)
+ const jsonl = (itens: readonly unknown[]): string => (false ? '' : `${itens.map((item) => JSON.stringify(item)).join('\n')}\n`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- if (LINHAS_SEM_SAIDA.includes(execucao.linha)) return { ...base, resultado }
+ if (false) return { ...base, resultado }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
falha: expect(Object.keys(saida).sort()).toEqual(['amostra'
- if (LINHAS_SEM_SAIDA.includes(execucao.linha)) return { ...base, resultado }
+ if (LINHAS_SEM_SAIDA.includes(execucao.linha)) return { ...base, resultado, respostas: execucao.respostas }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const base = { linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
+ const base = { linha: execucao.linha, amostra: execucao.amostra, ...(true ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › traz os itens, a razão e a marca de duvidosa
- if (veredicto === undefined) continue
+ if (false) continue
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › concordam: o item 2 reprovado, sozinho
- const resultado = passaOsItens(veredicto, itensMedidosDaLinha(execucao.linha)) ? 'aprovada' : 'reprovada'
+ const resultado = passaOsItens(veredicto) ? 'aprovada' : 'reprovada'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- const resultado = passaOsItens(veredicto, itensMedidosDaLinha(execucao.linha)) ? 'aprovada' : 'reprovada'
+ const resultado = true ? 'aprovada' : 'reprovada'
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- if (LINHAS_SEM_SAIDA.includes(execucao.linha)) itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao, resultado })
+ if (false) itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao, resultado })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › só trazem o id, a forma e o resultado
- if (LINHAS_SEM_SAIDA.includes(execucao.linha)) itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao, resultado })
+ if (LINHAS_SEM_SAIDA.includes(execucao.linha)) itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, ...(true ? {} : { forma: execucao.forma }), execucao: execucao.execucao, resultado })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › traz os itens, a razão e a marca de duvidosa
- else itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, execucao: execucao.execucao, resultado, itens: veredicto.itens, ...(veredicto.razao === undefined ? {} : { razao: veredicto.razao }), ...(veredicto.duvidosa === true ? { duvidosa: true } : {}) })
+ else itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, execucao: execucao.execucao, resultado, itens: veredicto.itens, ...(true ? {} : { razao: veredicto.razao }), ...(veredicto.duvidosa === true ? { duvidosa: true } : {}) })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › traz os itens, a razão e a marca de duvidosa
- else itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, execucao: execucao.execucao, resultado, itens: veredicto.itens, ...(veredicto.razao === undefined ? {} : { razao: veredicto.razao }), ...(veredicto.duvidosa === true ? { duvidosa: true } : {}) })
+ else itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, execucao: execucao.execucao, resultado, itens: veredicto.itens, ...(veredicto.razao === undefined ? {} : { razao: veredicto.razao }), ...(false ? { duvidosa: true } : {}) })
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro arquivo lido, outro hash
- const lotes = amostras.linhas.flatMap((linha) => linha.lotes ?? []).map((lote) => ({ caminho: lote.caminho, sha256: lote.sha256 }))
+ const lotes = amostras.linhas.flatMap((linha) => (linha.lotes as { caminho: string; sha256: string }[])).map((lote) => ({ caminho: lote.caminho, sha256: lote.sha256 }))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › outro arquivo lido, outro hash
- return [...lidos, ...lotes]
+ return [...lidos]
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › recusa a pasta dentro do checkout e a amostra que não chega ao modelo
- if (problemas.length > 0) throw new AvaliacaoRecusada(`antes do gasto: ${problemas.slice(0, 5).join('; ')}`)
+ if (false) throw new AvaliacaoRecusada(`antes do gasto: ${problemas.slice(0, 5).join('; ')}`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › recusa resposta sem veredicto, e o arquivo que mudou
- if (mudaram.length > 0) throw new AvaliacaoRecusada(`o arquivo mudou depois da rodada: ${mudaram.join(', ')}`)
+ if (false) throw new AvaliacaoRecusada(`o arquivo mudou depois da rodada: ${mudaram.join(', ')}`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › a chave do finalista não está em nenhum arquivo gravado
falha: expect(arquivo.texto, arquivo.caminho).not.toContain(CHAVE_DE_MENTIRA)
- const meta: MetaDaRodada = { versao: 1, finalista: argumentos.finalista, modelo: dados.finalista.modelo, data: argumentos.data, codigo, semente: argumentos.semente, tokensPorMinuto: argumentos.tokensPorMinuto, arquivos: arquivosDaRodada(amostras, arquivos) }
+ const meta: MetaDaRodada = { versao: 1, finalista: argumentos.finalista, modelo: dados.finalista.modelo + dados.finalista.chaveApi, data: argumentos.data, codigo, semente: argumentos.semente, tokensPorMinuto: argumentos.tokensPorMinuto, arquivos: arquivosDaRodada(amostras, arquivos) }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › nenhum arquivo entregue a quem julga
falha: .not.toContain(reconhecivel)
- const peca = { codigo: resposta.codigo, linha: linha.id, amostra: execucao.amostra, execucao: execucao.execucao, ...(amostra === undefined ? {} : { ...metadadosDaAmostra(amostra), entrada: amostra.entrada }), resposta: resposta.texto, saidaFinal: execucao.final }
+ const peca = { codigo: resposta.codigo, linha: linha.id, amostra: execucao.amostra, execucao: execucao.execucao, ...(amostra === undefined ? {} : { ...metadadosDaAmostra(amostra), entrada: amostra.entrada }), resposta: resposta.texto, modelo: resposta.modelo, saidaFinal: execucao.final }
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- ...dados.arquivos.map((arquivo) => `| ${arquivo.caminho} | ${arquivo.sha256} |`),
+ ...dados.arquivos.map((arquivo) => `| ${arquivo.caminho} | ${arquivo.sha256.replace(/./gu, '0')} |`),
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- `sha256 do \`resultado.json\`: \`${dados.sha256DoResultado}\``,
+ `sha256 do \`resultado.json\`: \`${dados.sha256DoResultado.replace(/./gu, '0')}\``,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- `Modelo (a versão exata que respondeu): ${dados.medidas.modelos.join(', ') || dados.modelo}. Configurado: ${dados.modelo}.`,
+ `Modelo (a versão exata que respondeu): ${dados.modelo}. Configurado: ${dados.modelo}.`,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- tabela.push(`| ${linha.id}${linha.eliminada ? ' (eliminatória)' : ''} | ${sim(linha.situacao)} | ${String(regraDecidiu)} | ${String(conferenciaSegurou)} | ${String(modeloDecidiu)} | ${detalhe} |`)
+ tabela.push(`| ${linha.id}${linha.eliminada ? ' (eliminatória)' : ''} | ${sim(linha.situacao)} | ${String(conferenciaSegurou)} | ${String(regraDecidiu)} | ${String(modeloDecidiu)} | ${detalhe} |`)
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- `- Custo por aluno por mês: ${reais(medidas.custoPorAlunoPorMesMicros)} (premissa: ${uso(USO_MENSAL_DO_ALUNO)} por mês).`,
+ `- Custo por aluno por mês: ${reais(medidas.custoPorProfessorPorMesMicros)} (premissa: ${uso(USO_MENSAL_DO_ALUNO)} por mês).`,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- `- Tokens por minuto oferecidos pelo contrato: ${String(tokensPorMinuto)}.`,
+ `- Tokens por minuto oferecidos pelo contrato: 0.`,
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- '**Aprovação mínima, não taxa estimada:** cada linha passa ou não passa contra o limiar de `avaliacao.md`; os números abaixo são contagens desta rodada e não valem como taxa esperada em produção. A contagem é por amostra × execução.',
+ '**Taxa estimada:** cada linha passa ou não passa contra o limiar de `avaliacao.md`; os números abaixo são contagens desta rodada e não valem como taxa esperada em produção. A contagem é por amostra × execução.',
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › confere antes do gasto, chama o finalista
- const execucoes = await executarAvaliacao(planoDasLinhas(amostras), executor, dados.aoTerminar)
+ const execucoes = await Promise.resolve([] as ExecucaoDaAmostra[])
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › confere antes do gasto, chama o finalista
- escrever(join(pasta, 'execucoes.jsonl'), jsonl(execucoes))
+ escrever(join(pasta, 'execucoes.jsonl'), jsonl(execucoes.slice(1)))
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › grava os quatro arquivos
- const destino = join(dados.raiz, 'docs', 'avaliacao', meta.finalista, meta.data)
+ const destino = join(dados.raiz, 'docs', 'avaliacao', meta.finalista, 'x')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › não chama o provedor
- return comando === 'fechar' ? comandos.fechar() : await comandos.rodar()
+ return false ? comandos.fechar() : await comandos.rodar()
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › avisa na execução 25
- export const textoDoAndamento = (feitas: number, total: number): string => (feitas % 25 === 0 || feitas === total ? `${String(feitas)} de ${String(total)} execuções\n` : '')
+ export const textoDoAndamento = (feitas: number, total: number): string => (false || feitas === total ? `${String(feitas)} de ${String(total)} execuções\n` : '')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/ia/avaliar-modelos.test.ts › avisa na execução 25
- export const textoDoAndamento = (feitas: number, total: number): string => (feitas % 25 === 0 || feitas === total ? `${String(feitas)} de ${String(total)} execuções\n` : '')
+ export const textoDoAndamento = (feitas: number, total: number): string => (feitas % 25 === 0 || false ? `${String(feitas)} de ${String(total)} execuções\n` : '')
```

```mutacao
arquivo: tools/ia/avaliar-modelos.ts
teste: tools/guardas/ponto-de-entrada-da-avaliacao.test.ts › a ferramenta existe, não alcança
- if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
+ if (process.argv[1] !== undefined && import.meta.url !== pathToFileURL(process.argv[1]).href) {
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Dizer no docblock da guarda que ela confere o código-fonte de `tools/`, não o `dist` | Aplicada: o docblock da guarda diz que lê o código-fonte e segue o `dist` até o `src` (divergência da 11.0) |
| infra-guardian (1ª) | Parar a espera do 429 quando `chamada.sinal` aborta (`chamarRepetindoNoLimite`) | `TODO.md`: muda o comportamento da chamada e a ferramenta roda à mão, uma chamada por vez, fora do horário de aula |
| privacy-guardian (1ª) | Gravar o host do `AVALIACAO_BASE_URL` e a região declarada no `meta.json` e no `relatorio.md` | 14.0 (14.2 escreve o dossiê da rodada, D61 e D62); muda o formato do `meta.json` |
| privacy-guardian (1ª) | `exigirPastaForaDoCheckout` com `realpath` | `TODO.md`: risco baixo, ferramenta rodada à mão |
| llm-integrator (1ª) | Fonte das premissas de uso mensal (`USO_MENSAL_DO_PROFESSOR`) e estimativa de custo da rodada no relatório da 14.0 | 14.0: a premissa já está sinalizada no relatório como a rever por quem decide |
| revisor-geral (1ª) | O `principal` imprimir `name` e código do erro em vez do texto genérico | `TODO.md`: muda o que a ferramenta imprime; precisa de conferência de que o `name` não traz chave |
| revisor-geral (1ª) | `JUIZ_DA_LINHA[linha.id] ?? 'pedagogia-reviewer'` recusar a linha sem juiz declarado | `TODO.md`: muda comportamento; a tabela `JUIZ_DA_LINHA` cobre hoje todas as linhas julgadas |
| test-engineer (1ª) | Teste do prazo `AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS)` com prazo injetável | `TODO.md`: exige tornar o prazo injetável no código |
| pedagogia-reviewer (1ª) | Linha no relatório explicando que "a conferência segurou" conta como falha do modelo | 14.0 (texto do relatório que o Joaquim lê na confirmação) |
| test-engineer (2ª) | Estender a cláusula das portas de banco (`createPool` etc.) a todo arquivo do grafo fora de `packages/*/src`, hoje só no texto do ponto de entrada | `TODO.md`: o contorno exige um arquivo de `tools/` que a ferramenta importe, e hoje ela não importa nenhum |
| test-engineer (2ª) | A última resposta sem veredicto conta como "a conferência segurou" | Recusada: `conferirOsVeredictos` exige um veredicto por resposta antes de `decidir` |
| tenancy-guardian (2ª) | Uma linha no docblock dizendo que `PORTA_DE_BANCO` acompanha o que `packages/core/src/db/` exporta | `TODO.md` |
| infra-guardian (2ª), revisor-geral (2ª) | O núcleo exportar o nome do evento `ia.geracao.reserva` como constante (o `viaReserva` depende do texto do log) | `TODO.md`: toca `packages/core/src/ia/llm-gateway.ts`, fora desta tarefa; o teste `viaReserva` roda o gateway real e pega a troca |
| infra-guardian (2ª) | `viaReserva` por execução (`execucaoId`) ou teste que falhe se o laço virar `Promise.all` | `TODO.md`: o docblock já diz que a ferramenta roda uma execução por vez |
| privacy-guardian (2ª) | Registrar o host do `AVALIACAO_BASE_URL` e a região no `meta.json` e no `relatorio.md` | 14.0 (14.2, dossiê da rodada, D61 e D62), como na 1ª rodada |
| privacy-guardian (2ª), conformidade-reviewer (2ª) | O `fechar` apagar a pasta de trabalho, ou o docblock dizer "deve ser apagada à mão"; a exceção do item 2a no `techspec.md` §8; registrar no dossiê como foi a entrega a quem julgou | 14.0 (14.2) |
| pedagogia-reviewer (2ª), llm-integrator (2ª) | Frase em `tools/ia/criterios/*.md` sobre julgar resposta que não é JSON; `avaliacao.md` com a regra do `viaReserva` | 14.0 (o `avaliacao.md` e os critérios são lidos pelo Joaquim na confirmação) |
| revisor-geral (2ª) | A última sem veredicto cair em `modelo_decidiu` | Recusada, pelo mesmo motivo de `conferirOsVeredictos` acima |
| revisor-geral (3ª) | Uma linha na `techspec.md` §8 (e no `cenarios.md`) dizendo que o `import type` não entra no grafo da guarda; hoje só está no docblock da guarda e na ordem do Arquiteto (`.processo/ordens/11_task-divergencia-guarda.md`) | `TODO.md`: é texto da spec, não muda comportamento nem teste |
| revisor-geral (3ª) | O comentário de `tools/ia/avaliar-modelos.ts:549` repete o ternário da linha seguinte e pode sair | Recusada: é só comentário, sem efeito no comportamento |
| test-engineer (3ª) | Bloco de mutação para o trecho opcional `(?:\s+as\s+\w+)?` da regex de `semImportDeTipo` | `TODO.md`: a cobertura já existe pela fixture `import-de-tipo` (`import type * as Tudo`); falta só o bloco declarado |
| test-engineer (3ª) | Uma linha no docblock da guarda dizendo que `import { type X } from '…'` entra no grafo de propósito (erra para o lado seguro) | `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 16:24:11 | 2026-11-22 16:24:36 | `tenancy-guardian` | 1 | APROVADO | a24ec851230c8c18f |
| 2026-11-22 16:24:16 | 2026-11-22 16:24:47 | `infra-guardian` | 1 | APROVADO | ad3c14a4754302a72 |
| 2026-11-22 16:24:14 | 2026-11-22 16:25:06 | `conformidade-reviewer` | 1 | APROVADO | ad749a633b73deb0d |
| 2026-11-22 16:24:19 | 2026-11-22 16:25:22 | `pedagogia-reviewer` | 1 | AJUSTES NECESSÁRIOS | a50c4430ac23c4e99 |
| 2026-11-22 16:24:13 | 2026-11-22 16:25:26 | `privacy-guardian` | 1 | APROVADO | a48dffbb1b9f4e14b |
| 2026-11-22 16:24:17 | 2026-11-22 16:25:30 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | af07348ecf9688a56 |
| 2026-11-22 16:24:21 | 2026-11-22 16:26:39 | `revisor-geral` | 1 | REPROVADO | a4fcd9d85bd0882d1 |
| 2026-11-22 16:24:20 | 2026-11-22 16:27:00 | `test-engineer` | 1 | REPROVADO | a98eeff6b19a8c9b8 |
| 2026-11-22 17:09:27 | 2026-11-22 17:09:54 | `llm-integrator` | 2 | APROVADO | a4d21e2b115158d08 |
| 2026-11-22 17:09:31 | 2026-11-22 17:09:58 | `pedagogia-reviewer` | 2 | APROVADO | af48ef4465cd2986b |
| 2026-11-22 17:09:14 | 2026-11-22 17:09:59 | `tenancy-guardian` | 2 | APROVADO | a5a8356c71606402e |
| 2026-11-22 17:09:22 | 2026-11-22 17:10:05 | `infra-guardian` | 2 | APROVADO | a74d8c40c62683d04 |
| 2026-11-22 17:09:16 | 2026-11-22 17:10:05 | `privacy-guardian` | 2 | APROVADO | aa4719daa2b8eb8be |
| 2026-11-22 17:09:19 | 2026-11-22 17:10:14 | `conformidade-reviewer` | 2 | APROVADO | aa4b79a445bba71d0 |
| 2026-11-22 17:09:43 | 2026-11-22 17:10:57 | `revisor-geral` | 2 | APROVADO | a27f75486e0f921d7 |
| 2026-11-22 17:09:38 | 2026-11-22 17:12:10 | `test-engineer` | 2 | REPROVADO | aa332a27b8033cf4e |
| 2026-11-22 17:38:27 | 2026-11-22 17:38:48 | `tenancy-guardian` | 3 | APROVADO | ac142fb2ab10f7849 |
| 2026-11-22 17:38:37 | 2026-11-22 17:38:51 | `infra-guardian` | 3 | APROVADO | a231f19079f9fe5fd |
| 2026-11-22 17:38:30 | 2026-11-22 17:38:56 | `privacy-guardian` | 3 | APROVADO | a26b2233d6a524ae2 |
| 2026-11-22 17:38:33 | 2026-11-22 17:38:58 | `conformidade-reviewer` | 3 | APROVADO | a44411414a7bf1502 |
| 2026-11-22 17:38:40 | 2026-11-22 17:39:03 | `llm-integrator` | 3 | APROVADO | acf610eb1a50f1309 |
| 2026-11-22 17:38:43 | 2026-11-22 17:39:03 | `pedagogia-reviewer` | 3 | APROVADO | a704253aa48c24a4b |
| 2026-11-22 17:38:51 | 2026-11-22 17:39:22 | `revisor-geral` | 3 | APROVADO | a9b230bba45246622 |
| 2026-11-22 17:38:48 | 2026-11-22 17:39:36 | `test-engineer` | 3 | APROVADO | ae22480b88b68709f |
