# Tarefa 1.0 — O `aplicar` renomeia uma onda pelo mapa, e o `reaplicar` leva o merge ao nome novo

**Funcionalidade:** nomes-de-mercado · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

O `aplicar.ts` renomeia a onda pelo mapa e grava o relatório; o mapa errado é recusado sem tocar a árvore. O
`reaplicar.ts` leva ao nome novo o que o merge da `develop` traz.

## Contexto necessário

- `techspec.md` §5 e §12
- `casos.md`, "`aplicar`" e "`reaplicar`"
- `prd.md` RF7 e §7
- `tools/guardas/escopo-dos-repositories.ts`: a API do `typescript` no repositório
- `tools/processo/linhas.ts`, `lerArquivosPrevistos`: lê o `--escopo`; hoje não lê `apps/` nem `package.json`

## Subtarefas

- [x] 1.1 — O mapa, o `comum` calculado, as seis recusas e a gravação só depois de calcular tudo
- [x] 1.2 — Os passos 1 a 5; o mapa com `"linha": true` não toca documento
- [x] 1.3 — O passo 6 e o `<N>.relatorio.md`
- [x] 1.4 — O `reaplicar`, sobre todos os mapas; com `mapas/13.json`, os de linha valem também nos documentos
- [x] 1.5 — O `reaplicar` no merge da `develop` (`8-validacao-e-pouso.md`, enquanto existir `tools/renomear/mapas/`),
  com o termo em `seguir.test.ts`
- [x] 1.6 — Fixture real: um `esquema…` do `shared` e quem o importa, copiados da árvore, e um mapa do anexo
- [x] 1.7 — `lerArquivosPrevistos` passa a ler a pasta de primeiro nível e o arquivo da raiz
- [x] 1.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/renomear/` | novo |
| `.claude/skills/seguir/passos/8-validacao-e-pouso.md`, `tools/processo/harness/seguir.test.ts` | alterado |
| `tools/processo/linhas.ts`, `tools/processo/linhas.test.ts` | alterado |
| `tools/guardas/guardas.test.ts` | alterado (a lista `CITAM_O_PROTOTIPO` ganha `tools/renomear/ast.ts`) |
| `tasks/prd-nomes-de-mercado/techspec.md`, `tasks/prd-nomes-de-mercado/casos.md` | alterado (divergência da 1.0, §12) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| símbolo do `shared` em dois projetos | unidade | renomeia nos dois (§12); o comentário composto muda, a string fica | tools/renomear/aplicar.test.ts › símbolo do shared em dois projetos: renomeia nos dois, o comentário composto muda e a string igual ao nome fica |
| dois `tsconfig` | unidade | editado uma vez | tools/renomear/aplicar.test.ts › dois tsconfig: cada um é editado uma vez, e o import que três projetos enxergam também |
| `{ esquemaTurma }` | unidade | a chave fica | tools/renomear/aplicar.test.ts › { esquemaTurma }: a chave fica |
| move de arquivo | unidade | o import relativo, o de pacote e o `vi.mock` mudam | tools/renomear/aplicar.test.ts › move de arquivo: o import relativo, o de pacote e o vi.mock mudam |
| move de pasta | unidade | o passo 3 vale para pasta | tools/renomear/aplicar.test.ts › move de pasta: o passo 3 vale para pasta |
| rename só de caixa | unidade | passa pelo nome intermediário | tools/renomear/aplicar.test.ts › rename só de caixa: passa pelo nome intermediário |
| pacote no mapa | unidade | `name`, `exports`, dependências e lock mudam | tools/renomear/aplicar.test.ts › pacote no mapa: name, exports, dependências e lock mudam, e o -w do script fica para a troca à mão |
| palavra comum em comentário | unidade | fica, e vai para a troca à mão | tools/renomear/aplicar.test.ts › palavra comum em comentário: fica, e vai para a troca à mão do relatório |
| documento vivo | unidade | composto, crases, `{@link}` e caminho: um caso cada | tools/renomear/aplicar.test.ts › documento vivo, o composto: troca sozinho; tools/renomear/aplicar.test.ts › documento vivo, entre crases e em {@link}: a palavra comum troca; em prosa, não; tools/renomear/aplicar.test.ts › documento vivo, o caminho: troca sozinho |
| decisões, ouro, `tasks/`, `mockups/` | unidade | intactos | tools/renomear/aplicar.test.ts › decisões, ouro, tasks/ e o protótipo: intactos |
| mapa de linha | unidade | nenhum documento tocado | tools/renomear/aplicar.test.ts › mapa de linha: nenhum documento tocado, e o comentário do código muda |
| as seis recusas | unidade | um caso por recusa | tools/renomear/aplicar.test.ts › o de não existe no arquivo; tools/renomear/aplicar.test.ts › o destino de arquivo ou de pasta já existe: colisão; tools/renomear/aplicar.test.ts › o de se repete; tools/renomear/aplicar.test.ts › falta a linha do anexo; tools/renomear/aplicar.test.ts › a edição cai fora do --escopo; tools/renomear/aplicar.test.ts › sobra ocorrência sem classificação |
| colisão com `alias` | unidade | aceita, com o alias no import | tools/renomear/aplicar.test.ts › o para colide, com alias: aceita, com o alias no import; tools/renomear/aplicar.test.ts › o para colide no escopo de um arquivo que importa o nome, sem alias; tools/renomear/aplicar.test.ts › o para colide no próprio arquivo onde o nome é declarado: o alias não salva |
| recusa | unidade | a árvore sai byte a byte igual | tools/renomear/aplicar.test.ts › sobra ocorrência sem classificação (a árvore sai igual: `git status` vazio, em todo caso de recusa) |
| "Listados" de `casos.md` | unidade | um caso por forma, mais `*.Dockerfile` e `.cjs` | tools/renomear/referencias.test.ts › o que o passo 6 lista › cada forma da tabela (`%s`: regex, `x\.repository`, `startsWith`, `endsWith`, array, `migrar(`, `@Banco`, segmento de caminho, pasta, arquivo, pacote, membro, `String.raw`, `-w`, `knip.json`, `.github/`, `*.Dockerfile`, `.cjs`) |
| "Não listados" de `casos.md` | unidade | um caso por forma | tools/renomear/referencias.test.ts › o que o passo 6 deixa de fora › cada forma da tabela (`%s`); tools/renomear/referencias.test.ts › um arquivo não versionado da raiz não é varrido |
| `reaplicar`, `de` já renomeado | unidade | não é erro | tools/renomear/reaplicar.test.ts › o de já renomeado não é erro |
| `reaplicar`, ocorrência nova | unidade | renomeada | tools/renomear/reaplicar.test.ts › a ocorrência nova é renomeada, e a chave da forma curta fica |
| `reaplicar` com dois mapas | unidade | aplica os dois | tools/renomear/reaplicar.test.ts › com dois mapas: aplica os dois, na ordem das ondas; tools/renomear/reaplicar.test.ts › com dois mapas encadeados: a onda 4 vem antes da 10, e não pela ordem do texto |
| `reaplicar` com `13.json` | unidade | o mapa de linha passa a valer nos documentos | tools/renomear/reaplicar.test.ts › com o mapas/13.json, o mapa de linha passa a valer também nos documentos |
| `reaplicar` duas vezes | unidade | a segunda não muda nada | tools/renomear/reaplicar.test.ts › duas vezes: a segunda não muda nada |
| `aplicar` duas vezes | unidade | a segunda é recusada | tools/renomear/aplicar.test.ts › aplicar duas vezes: a segunda é recusada |
| quem contorna é acusado | unidade | a ocorrência sem classificação em string, regex, JSON, YAML e `-w`: um caso cada | tools/renomear/aplicar.test.ts › quem contorna é acusado: a ocorrência sem classificação › em string, em regex, em JSON, em YAML e em -w do package.json da raiz (um caso cada) |
| o alvo não existe | unidade | `arquivo` inexistente recusado; `reaplicar` sem mapa falha alto | tools/renomear/aplicar.test.ts › o alvo não existe: arquivo, pasta e pacote inexistentes são recusados; tools/renomear/reaplicar.test.ts › sem mapa, falha alto |
| o passo do `/seguir` | unidade | `8-validacao-e-pouso.md` cita `reaplicar` | tools/processo/harness/seguir.test.ts › o passo 8 leva o merge da develop ao nome novo com o reaplicar, enquanto existir a pasta dos mapas |
| `apps/` e `package.json` nos previstos | unidade | lidos; a prosa, não | tools/processo/linhas.test.ts › lê a pasta de primeiro nível (`apps/`) e o arquivo da raiz (`package.json`), e continua sem ler a prosa |
| ocorrência sem a linha no formato | unidade | `fica` com `travas.md`, `trava` com `inventario`, e a vazia: recusa 4, árvore igual | tools/renomear/aplicar.test.ts › a ocorrência sem a linha no formato certo: fica com travas.md, trava com inventario, e vazia |
| texto do relatório | unidade | `**Estado:**`, a seção "Sem classificação" e a tabela das ocorrências com a linha do anexo | tools/renomear/aplicar.test.ts › quem contorna é acusado (vermelho e sem classificação); tools/renomear/aplicar.test.ts › pacote no mapa: name, exports, dependências e lock mudam, e o -w do script fica para a troca à mão (verde e `travas.md:80`) |
| membro sem `arquivo` (`static com(` → `forRoot`) | unidade | os dois módulos e a chamada mudam, a string e o comentário ficam; o `forRoot` que já existe é colisão; no `reaplicar`, o `Modulo.com(` novo | tools/renomear/aplicar.test.ts › o membro sem arquivo: static com( vira forRoot › os dois módulos e a chamada viram forRoot, e o com em string e em comentário fica; tools/renomear/aplicar.test.ts › o membro sem arquivo: static com( vira forRoot › o membro forRoot que já existe no mesmo tipo: colisão, e a árvore sai igual; tools/renomear/reaplicar.test.ts › o membro sem arquivo: Modulo.com( e static com( do merge viram forRoot, e a variável com fica |
| desestruturado e forma curta | unidade | `const { x } = ns` e `{ x }` mantêm a chave, no `aplicar` e no `reaplicar` | tools/renomear/aplicar.test.ts › { esquemaTurma }: a chave fica; tools/renomear/reaplicar.test.ts › o desestruturado de namespace: a chave fica e o local passa a ter o nome novo |
| `reaplicar` com pacote e subcaminho | unidade | o subcaminho muda antes do nome, as dependências também, e o lock é refeito | tools/renomear/reaplicar.test.ts › o pacote e o subcaminho na ordem do mapa: o subcaminho muda antes, e o lock é refeito |
| `reaplicar` não toca fixture, protótipo, `tasks/`, `docs/`, a ferramenta | unidade | saem intactos; o código do produto muda | tools/renomear/reaplicar.test.ts › não toca fixture, protótipo, tasks/, docs/ nem a própria ferramenta, e toca o código do produto |
| `reaplicar`, mapa inválido e arquivo que ficou | unidade | o mapa inválido lança sem tocar a árvore; o arquivo no lugar antigo vai para o novo, sem sobrescrever | tools/renomear/reaplicar.test.ts › o mapa inválido lança, e a árvore sai igual; tools/renomear/reaplicar.test.ts › o arquivo que o merge deixou no lugar antigo vai para o novo, e o que já tem destino não é sobrescrito |
| destino de arquivo ou de pasta que existe | unidade | colisão | tools/renomear/aplicar.test.ts › o destino de arquivo ou de pasta já existe: colisão |
| linha de comando sem `--escopo` | unidade | sai 2 com o uso, sem tocar a árvore; com `--escopo`, aplica | tools/renomear/aplicar.test.ts › a linha de comando exige o --escopo, e com ele aplica |
| versão entre crases nos previstos | unidade | `1.0`, `v1.2` e `2.3.4` não são arquivo | tools/processo/linhas.test.ts › lê a pasta de primeiro nível (`apps/`) e o arquivo da raiz (`package.json`), e continua sem ler a prosa |
| template e `.mjs` no passo 6 | unidade | listados | tools/renomear/referencias.test.ts › o que o passo 6 lista › template sem substituição; template com substituição, na cabeça; .mjs |

## Como testar

- Repositório temporário: copie `andares()` de `tools/processo/linhas.test.ts` (`mkdtempSync`, `git init`), com a
  fixture da 1.6 e um `tsconfig` por projeto.
- `ts.createLanguageService` com um `LanguageServiceHost` sobre ele.
- Comando: `npx vitest run --project unidade tools/renomear/`.
- A recusa se prova pelo efeito: `git status --porcelain` vazio.

## Autoconferência

As 12 perguntas, respondidas no plano. Na 1, cada recusa e cada regra do passo 6 é cláusula, e cada uma tem o seu bloco.

1. **Mutação de cada cláusula.** Ver "Mutações": 80 blocos, um por recusa (as seis, e a colisão em três lugares), pelo filtro do
   `.` e a regra do `tsconfig` no move, pela caixa, pelo `npm install` do pacote, por cada regra do passo 5 e do passo 6, pelo
   `reaplicar` (13.json, mapa ausente, ordem das ondas, arquivo que ficou, referência nova) e pelo leitor do `--escopo`. Cada um foi
   aplicado, rodou o teste citado e ficou vermelho antes de eu pedir a rodada.
2. **Texto na tela.** Não se aplica: a tarefa não toca `apps/`, só `tools/` e uma página do processo.
3. **Segundo dado.** A colisão tem o arquivo que colide e o que não colide; a classificação tem o outro nome, o outro arquivo, a outra
   pasta e o trecho que não bate; o `reaplicar` tem a onda 10 antes da 4 no texto; o mapa de linha tem com e sem `13.json`.
4. **Checagem anterior que responde antes.** A recusa do `de` que não existe sai antes da colisão e do escopo; cada caso de
   recusa tem um mapa que só falha na sua regra, e o caso confere o código que veio (`toEqual([código])`), não só o `1`.
5. **A asserção olha o resultado.** Todos os casos comparam o texto do arquivo depois da onda, `git status` ou o código da recusa;
   nenhum compara a forma do código.
6. **Guarda nova com fixture de quem a contorna.** O passo 6 é a guarda: string, regex, JSON, YAML e `-w` têm um caso cada, e o
   alvo que some (`de` inexistente) é recusa, não silêncio. Os limites que ela não pega estão no docblock de `sintaxe.ts`
   (variável local com o nome do símbolo) e no `travas.md`.
7. **Comentário que afirma o que o código não faz.** Reli os docblocks de `aplicar.ts`, `reaplicar.ts`, `sintaxe.ts` e `texto.ts`:
   o que `reaplicar` não faz (serviço de linguagem, relatório) está dito no docblock.
8. **Divergência que cria regra.** Uma, registrada: o rename roda sem `providePrefixAndSuffixTextForRename` (ver a seção abaixo, e a Tech Spec §5 passo 2). Ela cria uma regra, a da forma curta refeita pela ferramenta, e tem a sua linha na tabela (`{ esquemaTurma }`) e os blocos em `simbolos.ts` e `sintaxe.ts`.
9. **Peça que já existe.** `lerArquivosPrevistos` e `seSobrepoem` de `tools/processo/linhas.ts` são importados, e a leitura do
   `--escopo` ganhou o formato novo ali, não uma cópia. O `typescript` já era dependência (`tools/guardas/escopo-dos-repositories.ts`).
10. **Operação simultânea.** Não se aplica: ferramenta de linha de comando de um processo só, sem banco, fila nem tela.
11. **Isolamento e coluna "Caso".** A tarefa não toca dado de escola nem repository; a coluna "Caso" está preenchida, um caso por
    coisa que a linha diz.
12. **"O que verificar" dos guardiões e o índice.** `achados/indice.md` só tem as rodadas da revisão da spec (nenhuma de tarefa); o
    `tenancy-guardian` aqui confere que a ferramenta não abre dado de escola (ela só lê a árvore do git), o `test-engineer` está
    atendido pelas respostas 1, 3, 4 e 5, e o `revisor-geral` pela 7.

## Fora do escopo desta tarefa

O `conferir`, o `restos` e o filtro vazio (2.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| O `findRenameLocations` roda com `providePrefixAndSuffixTextForRename: false`, e a ferramenta refaz a forma curta (`{ esquemaTurma }` vira `{ esquemaTurma: turmaSchema }`, o `import { x as y }` troca o lado certo) | Com a opção ligada o serviço de linguagem pára no `export { x } from` e deixa `apps/api` e `apps/web` com o nome antigo: foi medido na 1.0 com o `esquemaRespostaAvisos` real (fixture `esquema-real`) | `techspec.md` §5, passo 2 (reescrito), e §12 (a premissa do `source` agora é "VERIFICADO na 1.0"); `casos.md` não cita o mecanismo, só o resultado (`{ esquemaTurma }`) |

## Mutações

Um bloco por cláusula do §5 e por regra do passo 6, e um para o leitor novo do `--escopo`.

Os blocos abaixo cobrem as cláusulas que a Tech Spec nomeia (§5 e §12) e a regra de cada passo. O que o
`mutacoes.ts --faltando` ainda lista de `tools/renomear/` (a maior parte: ramos de percurso da árvore do `typescript`, o `?:` que
escolhe entre arquivo, pasta e pacote, a casca da linha de comando) não tem bloco próprio: cada um desses ramos é a rota
por onde passa um caso da tabela, e o caso confere o texto do arquivo depois da onda, de modo que o ramo trocado muda o
resultado. A exigência do RF17 (`apps/*/src`, `packages/*/src`) não alcança `tools/`.

Recusa 1, o `de` que não existe: o símbolo sem declaração, o pacote que nenhum `package.json` tem, e o arquivo ou a pasta ausentes.

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › o de não existe no arquivo
  if (entrada.tipo === 'simbolo') {
-   if (declaracoes.length > 0) return undefined
+   return undefined
    return entrada.arquivo === undefined ? 'em nenhum arquivo' : `em ${entrada.arquivo}`
```

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › o alvo não existe: arquivo, pasta e pacote inexistentes são recusados
-   if (entrada.tipo === 'pacote') return pacoteExiste(arvore, entrada.de) ? undefined : 'em nenhum package.json'
+   if (entrada.tipo === 'pacote') return undefined
```

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › o alvo não existe: arquivo, pasta e pacote inexistentes são recusados
-   return existe ? undefined : ''
+   return undefined
```

Recusa 2, a colisão: o destino de arquivo e de pasta que já existe, e o `para` de símbolo que já é nome no escopo, sem alias ou com o alias que não salva.

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › o destino de arquivo ou de pasta já existe: colisão
-   if (entrada.tipo === 'arquivo') return arvore.existe(entrada.para)
+   if (entrada.tipo === 'arquivo') return false
```

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › o destino de arquivo ou de pasta já existe: colisão
-   return entrada.tipo === 'pasta' && arvore.temPasta(entrada.para)
+   return false
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › o para colide no escopo de um arquivo que importa o nome, sem alias
-   if (semAlias.length > 0) {
+   if (semAlias.length > 1000) {
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › o para colide no próprio arquivo onde o nome é declarado: o alias não salva
-   const semAlias = [...colidem].filter((arquivo) => entrada.alias === undefined || declaracoes.some((declaracao) => declaracao.arquivo === arquivo))
+   const semAlias = [...colidem].filter((arquivo) => entrada.alias === undefined)
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › o para colide, com alias: aceita, com o alias no import
-   if (ts.isImportSpecifier(pai) && pai.propertyName === undefined && pai.name === no) return `${entrada.para} as ${alias}`
+   if (ts.isImportSpecifier(pai) && pai.propertyName === undefined && pai.name === no) return alias
```

Recusa 3, o `de` repetido, e a recusa 4, a entrada ou a ocorrência sem a linha do anexo.

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › o de se repete
-   if (vistos.has(entrada.de)) recusas.push({ codigo: 'de-repetido', detalhe: `o "${entrada.de}" aparece mais de uma vez no mapa` })
+   if (vistos.has(entrada.de) && entrada.para === '') recusas.push({ codigo: 'de-repetido', detalhe: `o "${entrada.de}" aparece mais de uma vez no mapa` })
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › falta a linha do anexo
-   if (!FORMATO_DA_LINHA_DO_ANEXO.test(entrada.linhaDoAnexo)) {
+   if (entrada.linhaDoAnexo === 'nunca') {
```

Recusa 5, a edição fora dos "Arquivos previstos" do `--escopo`.

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › a edição cai fora do --escopo
-   const fora = [...tocados].filter((arquivo) => !previstos.some((previsto) => seSobrepoem(arquivo, previsto))).sort()
+   const fora = [...tocados].filter(() => false).sort()
```

Recusa 6, a ocorrência por texto sem classificação, e a árvore que sai intacta quando há recusa.

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › sobra ocorrência sem classificação
-   if (classificacao === undefined) semClassificacao.push(referencia)
+   if (classificacao === undefined) continue
```

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › sobra ocorrência sem classificação
-   if (recusas.length > 0) return { codigo: 1, recusas, texto: textoDaRecusa(recusas), relatorio }
+   if (recusas.length > 100) return { codigo: 1, recusas, texto: textoDaRecusa(recusas), relatorio }
```

O passo 3, o move: só o especificador relativo é do serviço de linguagem, o `tsconfig` sempre, e a caixa passa pelo nome intermediário.

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › move de arquivo: o import relativo, o de pacote e o vi.mock mudam
-   return ehConfiguracaoDoTypescript(caminho) || (ehCodigo(caminho) && antigo.startsWith('.'))
+   return ehConfiguracaoDoTypescript(caminho) || ehCodigo(caminho)
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › dois tsconfig: cada um é editado uma vez, e o import que três projetos enxergam também
-   return ehConfiguracaoDoTypescript(caminho) || (ehCodigo(caminho) && antigo.startsWith('.'))
+   return ehCodigo(caminho) && antigo.startsWith('.')
```

```mutacao
arquivo: tools/renomear/arvore.ts
teste: tools/renomear/aplicar.test.ts › rename só de caixa: passa pelo nome intermediário
-     if (de.toLowerCase() === para.toLowerCase()) {
+     if (de === 'nunca') {
```

O passo 4, o pacote: o `npm install --package-lock-only` roda só quando o nome mudou.

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › pacote no mapa: name, exports, dependências e lock mudam, e o -w do script fica para a troca à mão
-   if (mudouPacote) executar('npm', ['install', '--package-lock-only'], raiz)
+   if (!mudouPacote) executar('npm', ['install', '--package-lock-only'], raiz)
```

O passo 5: o documento vivo só quando a onda não é de linha, a palavra comum só entre crases ou em `{@link}`, o caminho troca sozinho, e o histórico fica.

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › mapa de linha: nenhum documento tocado, e o comentário do código muda
-   else if (opcoes.documentos && ehDocumentoVivo(caminho)) arvore.escrever(caminho, trocarNoDocumento(caminho, texto, entradas, simbolos, aMao))
+   else if (ehDocumentoVivo(caminho)) arvore.escrever(caminho, trocarNoDocumento(caminho, texto, entradas, simbolos, aMao))
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › palavra comum em comentário: fica, e vai para a troca à mão do relatório
-   if (!entrada.comum || dentro) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
+   if (true) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › documento vivo, entre crases e em {@link}: a palavra comum troca; em prosa, não
-   if (!entrada.comum || dentro) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
+   if (!entrada.comum) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › documento vivo, o caminho: troca sozinho
-   if (texto.includes(de)) texto = texto.replace(regexDeCaminho(de), () => para)
+   if (texto.includes(de)) texto = texto.replace(regexDeCaminho(de), () => de)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › decisões, ouro, tasks/ e o protótipo: intactos
- const foraDoPasso5 = (caminho: string): boolean => FORA_DO_PASSO_5.some((fora) => caminho === fora || (fora.endsWith('/') && caminho.startsWith(fora)))
+ const foraDoPasso5 = (caminho: string): boolean => FORA_DO_PASSO_5.some((fora) => caminho === fora)
```

O passo 6, as regras da palavra comum e o que ele lista: o `startsWith` e o `endsWith`, o prefixo curto, a referência repetida na linha, as pastas varridas e as excluídas.

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'teste@exemplo.com', e-mail
-   if (ehEmailOuUrl(texto)) return false
+   if (texto === '') return false
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'https://github.com/x', URL
-   if (ehEmailOuUrl(texto)) return false
+   if (texto === '') return false
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'schema.Banco' como acesso a membro
-   return acessoAMembro(texto, indice, palavra)
+   return false
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › '@Banco' que não é e-mail
- const ANTES_DA_PALAVRA: ReadonlySet<string> = new Set(['@', BORDA, '/'])
+ const ANTES_DA_PALAVRA: ReadonlySet<string> = new Set([BORDA, '/'])
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › migrar
- const DEPOIS_DA_PALAVRA: ReadonlySet<string> = new Set(['(', BORDA, '/'])
+ const DEPOIS_DA_PALAVRA: ReadonlySet<string> = new Set([BORDA, '/'])
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'Banco' num array
-   if (texto === palavra || (antes !== undefined && ANTES_DA_PALAVRA.has(antes)) || (depois !== undefined && DEPOIS_DA_PALAVRA.has(depois))) return true
+   if ((antes !== undefined && ANTES_DA_PALAVRA.has(antes)) || (depois !== undefined && DEPOIS_DA_PALAVRA.has(depois))) return true
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › "com" numa string de tela, em prosa
-   if (entrada !== undefined && (!entrada.comum || comumListada(texto, achado.index, achado[0]))) achados.add(entrada.de)
+   if (entrada !== undefined) achados.add(entrada.de)
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › prefixo curto demais
-       if ((metodo === 'startsWith' || metodo === 'endsWith') && literal !== undefined && ts.isStringLiteralLike(literal) && literal.text.length >= MENOR_PREFIXO) {
+       if ((metodo === 'startsWith' || metodo === 'endsWith') && literal !== undefined && ts.isStringLiteralLike(literal)) {
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › endsWith com o sufixo da gramática
-         const confere = (de: string) => (metodo === 'startsWith' ? de.startsWith(literal.text) : de.endsWith(literal.text))
+         const confere = (de: string) => de.startsWith(literal.text)
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › endsWith com o sufixo da gramática
-   return /\.(?:startsWith|endsWith)\(/.test(limpo) || nomes.some((nome) => limpo.includes(nome.slice(0, MENOR_PREFIXO)))
+   return nomes.some((nome) => limpo.includes(nome.slice(0, MENOR_PREFIXO)))
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'Banco' duas vezes na mesma linha: uma referência só
-     return !vistas.has(chave) && vistas.add(chave)
+     return true
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › a pasta do mapa de ondas, tools/renomear/
- const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json']
+ const SEM_VARREDURA = ['package-lock.json']
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › do package.json da raiz
-   return partes.length === 1 || PASTAS_VARRIDAS.has(partes[0] ?? '')
+   return PASTAS_VARRIDAS.has(partes[0] ?? '')
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › caminho em .github/
- const PASTAS_VARRIDAS = new Set(['apps', 'packages', 'e2e', 'tools', 'infra', '.github'])
+ const PASTAS_VARRIDAS = new Set(['apps', 'packages', 'e2e', 'tools', 'infra'])
```

A classificação: o arquivo, a pasta e o trecho precisam bater.

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/aplicar.test.ts › a classificação vale só para o arquivo, o nome e o trecho que ela cita
-       o.de === referencia.de &&
+       true &&
```

O `reaplicar`: o `de` já renomeado não é erro, o arquivo que sobrou vai para o lugar novo, o mapa de linha só vale nos documentos com o `13.json`, e sem mapa falha alto.

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › com o mapas/13.json, o mapa de linha passa a valer também nos documentos
-   const documentosDosMapasDeLinha = arvore.existe(MAPA_DOS_DOCUMENTOS)
+   const documentosDosMapasDeLinha = false
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › com o mapas/13.json, o mapa de linha passa a valer também nos documentos
-   const mudouPacote = mapas.map((mapa) => reaplicarMapa(arvore, mapa, !mapa.linha || documentosDosMapasDeLinha)).some(Boolean)
+   const mudouPacote = mapas.map((mapa) => reaplicarMapa(arvore, mapa, true)).some(Boolean)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › sem mapa, falha alto
-   if (nomes.length === 0) throw new Error(`não há mapa em ${PASTA_DOS_MAPAS}/: o reaplicar não tem o que aplicar`)
+   if (nomes.length === 0) return []
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › com dois mapas encadeados: a onda 4 vem antes da 10, e não pela ordem do texto
-   const mapas = nomes.map((nome) => lerMapa(join(raiz, PASTA_DOS_MAPAS, nome))).sort((a, b) => ordemDaOnda(a.nome) - ordemDaOnda(b.nome))
+   const mapas = nomes.map((nome) => lerMapa(join(raiz, PASTA_DOS_MAPAS, nome))).sort((a, b) => ordemDaOnda(b.nome) - ordemDaOnda(a.nome))
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o import relativo do código novo que cita a pasta antiga vai para a pasta nova
-     if (!arvore.existe(destino)) arvore.mover(caminho, destino)
+     if (arvore.existe(destino)) arvore.mover(caminho, destino)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › lista a referência por texto que nenhum mapa classifica
-     .filter((referencia) => estaClassificada(referencia, mapas.flatMap((mapa) => mapa.ocorrencias)) === undefined)
+     .filter(() => false)
```

O leitor novo do `--escopo` em `lerArquivosPrevistos`: a pasta de primeiro nível com a barra, o arquivo da raiz com extensão, e a palavra solta que continua prosa.

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › lê a pasta de primeiro nível
-   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*$/.test(candidato)
+   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]+$/.test(candidato)
```

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › lê a pasta de primeiro nível
-   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*$/.test(candidato)
+   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato)
```

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › lê a pasta de primeiro nível
-       if (ehCaminhoPrevisto(candidato)) caminhos.add(candidato)
+       caminhos.add(candidato)
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/aplicar.test.ts › a classificação vale só para o arquivo, o nome e o trecho que ela cita
-       (o.arquivo === referencia.arquivo || (o.arquivo.endsWith('/') && referencia.arquivo.startsWith(o.arquivo))) &&
+       true &&
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/aplicar.test.ts › a classificação vale só para o arquivo, o nome e o trecho que ela cita
-       (o.trecho === undefined || referencia.trecho.includes(o.trecho)),
+       true,
```

Rodada 1 da Mesa. A recusa 4 da ocorrência: o formato da linha é o da classe, e a mensagem diz o certo.

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › sem a linha no formato certo
-     if (!formato.test(ocorrencia.linha)) {
+     if (false) {
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › sem a linha no formato certo
-     const formato = ocorrencia.classe === 'fica' ? FORMATO_DA_LINHA_DO_ANEXO : FORMATO_DA_LINHA_DA_TRAVA
+     const formato = FORMATO_DA_LINHA_DO_ANEXO
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › sem a linha no formato certo
-       const esperado = ocorrencia.classe === 'fica' ? 'inventario-<x>.md:<linha>' : 'travas.md:<linha>'
+       const esperado = 'inventario-<x>.md:<linha>'
```

O relatório: o estado, a seção "Sem classificação" e a tabela das ocorrências com a linha do anexo.

```mutacao
arquivo: tools/renomear/relatorio.ts
teste: tools/renomear/aplicar.test.ts › em string
-   const vermelho = dados.recusas.length > 0 || dados.semClassificacao.length > 0
+   const vermelho = false
```

```mutacao
arquivo: tools/renomear/relatorio.ts
teste: tools/renomear/aplicar.test.ts › pacote no mapa
-     `**Estado:** ${vermelho ? 'vermelho' : 'verde'}`,
+     `**Estado:** ${vermelho ? 'verde' : 'vermelho'}`,
```

```mutacao
arquivo: tools/renomear/relatorio.ts
teste: tools/renomear/aplicar.test.ts › em regex
-   if (dados.semClassificacao.length > 0) {
+   if (false) {
```

```mutacao
arquivo: tools/renomear/relatorio.ts
teste: tools/renomear/aplicar.test.ts › pacote no mapa
-   linhas.push(...tabela(['Arquivo', 'Linha', 'Nome', 'Classe', 'Linha do anexo'], dados.ocorrencias.map(({ referencia, classificacao }) => [referencia.arquivo, String(referencia.linha), referencia.de, classificacao.classe, classificacao.linha])), '')
+   linhas.push(...tabela(['Arquivo', 'Linha', 'Nome', 'Classe', 'Linha do anexo'], dados.ocorrencias.map(({ referencia, classificacao }) => [referencia.arquivo, String(referencia.linha), referencia.de, classificacao.classe, ''])), '')
```

O `reaplicar` aplica os pacotes pelo comprimento do nome (o subcaminho antes) e refaz o lock.

```mutacao
arquivo: tools/renomear/pacotes.ts
teste: tools/renomear/reaplicar.test.ts › o pacote e o subcaminho na ordem do mapa
-   const pacotes = entradas.filter((entrada) => entrada.tipo === 'pacote').sort((a, b) => b.de.length - a.de.length)
+   const pacotes = entradas.filter((entrada) => entrada.tipo === 'pacote').sort((a, b) => a.de.length - b.de.length)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o pacote e o subcaminho na ordem do mapa
-   const mudouPacote = renomearPacotes(arvore, mapa.entradas)
+   const mudouPacote = (renomearPacotes(arvore, mapa.entradas), false)
```

O membro sem `arquivo` (`static com(` para `forRoot`): a colisão com o membro do mesmo tipo, e o uso que a sintaxe troca.

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › o membro forRoot que já existe
-   const colide = membros.some((membro) => membro.name !== undefined && ts.isIdentifier(membro.name) && membro.name.text === para)
+   const colide = false
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › o membro forRoot que já existe
-   if (local.declaracao.membro) return local.declaracao.colideNoTipo
+   if (local.declaracao.membro) return false
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o membro sem arquivo
-   if (entrada.arquivo === undefined) return textoDoMembro(no, entrada)
+   if (entrada.arquivo === undefined) return undefined
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o membro sem arquivo
-   return (ts.isPropertyAccessExpression(pai) || ts.isMethodDeclaration(pai)) && pai.name === no ? entrada.para : undefined
+   return ts.isPropertyAccessExpression(pai) && pai.name === no ? entrada.para : undefined
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o membro sem arquivo
-   return (ts.isPropertyAccessExpression(pai) || ts.isMethodDeclaration(pai)) && pai.name === no ? entrada.para : undefined
+   return ts.isMethodDeclaration(pai) && pai.name === no ? entrada.para : undefined
```

A exclusão de pastas do `reaplicar`: fixture, protótipo, `tasks/`, `docs/` e a própria ferramenta.

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › não toca fixture
-     if (!ehCodigo(caminho) || texto === undefined || caminho.startsWith(FORA_DA_FERRAMENTA) || FORA_DA_SINTAXE.test(caminho) || !texto.includes(entrada.de)) continue
+     if (!ehCodigo(caminho) || texto === undefined || caminho.startsWith(FORA_DA_FERRAMENTA) || !texto.includes(entrada.de)) continue
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › não toca fixture
-     if (!ehCodigo(caminho) || texto === undefined || caminho.startsWith(FORA_DA_FERRAMENTA) || FORA_DA_SINTAXE.test(caminho) || !texto.includes(entrada.de)) continue
+     if (!ehCodigo(caminho) || texto === undefined || FORA_DA_SINTAXE.test(caminho) || !texto.includes(entrada.de)) continue
```

O mapa inválido do `reaplicar` e o arquivo que o merge deixou no lugar antigo.

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o mapa inválido lança
-   if (invalidos.length > 0) throw new Error(`mapa inválido:\n${invalidos.join('\n')}`)
+   if (invalidos.length > 100) throw new Error(`mapa inválido:\n${invalidos.join('\n')}`)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o arquivo que o merge deixou no lugar antigo
-     if (arvore.existe(entrada.de) && !arvore.existe(entrada.para)) arvore.mover(entrada.de, entrada.para)
+     if (arvore.existe(entrada.de)) arvore.mover(entrada.de, entrada.para)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o arquivo que o merge deixou no lugar antigo
-     if (arvore.existe(entrada.de) && !arvore.existe(entrada.para)) arvore.mover(entrada.de, entrada.para)
+     if (!arvore.existe(entrada.para)) arvore.mover(entrada.de, entrada.para)
```

O leitor do `--escopo` não aceita versão (`1.0`, `v1.2`) como arquivo da raiz, e a linha de comando exige o `--escopo`.

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › lê a pasta de primeiro nível
-   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*$/.test(candidato)
+   return /^[\w.@-]+(\/[\w.@*[\]-]+)+\/?$/.test(candidato) || /^[\w.@-]+\/$/.test(candidato) || /^[\w@-][\w.@-]*\.[A-Za-z0-9]+$/.test(candidato)
```

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › a linha de comando exige o --escopo
-   if (values.mapa === undefined || values.escopo === undefined) {
+   if (values.mapa === undefined) {
```

As regras que a tabela declara e que ainda não tinham bloco: a deduplicação das edições do serviço (dois `tsconfig`), a forma curta, os projetos que enxergam o arquivo, o move de pasta, o composto no documento, o membro e a declaração local no `reaplicar`.

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › dois tsconfig
-         const chave = `${String(troca.span.start)}:${String(troca.span.length)}`
+         const chave = `${String(troca.span.start)}:${String(troca.span.length)}:${String(Math.random())}`
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › move de pasta
-   if (pasta) arvore.moverPasta(entrada.de, entrada.para)
+   if (false) arvore.moverPasta(entrada.de, entrada.para)
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › a chave fica
-   if (ts.isShorthandPropertyAssignment(pai)) return pai.name === no
+   if (ts.isShorthandPropertyAssignment(pai)) return false
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › a chave fica
-   return ts.isBindingElement(pai) && pai.name === no && pai.propertyName === undefined && ts.isObjectBindingPattern(pai.parent)
+   return false
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › a chave fica
-   if (!membro && ehFormaCurta(no)) return `${entrada.de}: ${nome}`
+   if (false) return `${entrada.de}: ${nome}`
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › a ocorrência nova é renomeada
-   return curta && pai.name === no ? `${entrada.de}: ${entrada.para}` : undefined
+   return undefined
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o desestruturado de namespace
-   const curta = ts.isShorthandPropertyAssignment(pai) || (ts.isBindingElement(pai) && pai.propertyName === undefined && ts.isObjectBindingPattern(pai.parent))
+   const curta = ts.isShorthandPropertyAssignment(pai)
```

```mutacao
arquivo: tools/renomear/simbolos.ts
teste: tools/renomear/aplicar.test.ts › símbolo do shared em dois projetos
-   const enxergam = projetos.filter((projeto) => projeto.servico.getProgram()?.getSourceFile(absoluto) !== undefined)
+   const enxergam = projetos.filter((projeto) => projeto.servico.getProgram()?.getSourceFile(absoluto) !== undefined).slice(0, 1)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › documento vivo, o composto
-   if (!entrada.comum || dentro) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
+   if (dentro) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › a ocorrência nova é renomeada
-   if (ehNomeDeMembro(no)) return undefined
+   if (false) return undefined
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o apelido do import e a declaração local
-   return ehNomeDeDeclaracaoLocal(no) ? undefined : entrada.para
+   return entrada.para
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Onda que renomeie nome do isolamento (`escolaId`, `anoLetivoId`, `SemEscopo`, `justificativaSemEscopo`, `PROVAS_DE_ESCOPO`, `REPOSITORIES_SEM_ESCOPO`, sufixo `.repository`) chama o `tenancy-guardian` | Tarefas das ondas (3.0 em diante): a linha "Subagentes obrigatórios" delas já o tem, e o passo 6 lista essas ocorrências para a troca à mão. Sem mudança nesta tarefa |
| tenancy-guardian (1ª) | O `travas.md` dizer que a guarda de escopo não varre `tools/` | `TODO.md`: `travas.md` não é arquivo desta tarefa |
| infra-guardian (1ª) | Ondas que mexam em fila, job do BullMQ e chave de Redis do limitador passam pela auditoria de carga; nome que muda no deploy zera contador ou deixa job órfão | Tarefas das ondas que tocam `apps/` e `packages/`: a Mesa chama o `infra-guardian` em cada uma. Sem mudança nesta tarefa |
| privacy-guardian (1ª) | Nas ondas, conferir que "a string igual ao nome fica" vale para nome de tabela e coluna do Drizzle, código de ação de auditoria e chave de `ExecucaoAgente` | Tarefas das ondas e `conferir` da 2.0 (compara as strings antes e depois). Sem mudança nesta tarefa |
| conformidade-reviewer (1ª) | O `conferir` comparar o prompt e a ação auditada (`techspec.md` §7b), com a regra 70 citada na tabela "Testes que provam a regra" | Tarefa 2.0 (`2_task.md`): acrescentar a regra 70 à tabela de lá |
| conformidade-reviewer (1ª) | Antes das ondas 6.0 e 9.0, conferir que cada linha de `travas.md:69-73` tem a ocorrência classificada no mapa daquela onda | Tarefas 6.0 e 9.0 |
| revisor-geral (1ª) | O relatório deixar explícito que `tools/guardas/__fixtures__/camadas/` (inclusive o `package.json` de lá chamado `@educa/nucleo`) muda pela 5.0 | Tarefa 5.0 |
| revisor-geral (1ª) | Os previstos da 7.0 (linha back) e da 11.0 (linha web) já se sobrepõem hoje (`e2e/**` e `tools/ci/codigo-do-autenticador.test.ts`) | Orquestrador, antes de abrir as linhas; o Implementador repete isso no relatório da tarefa |
| revisor-geral (2ª) | `techspec.md` §12, premissa agora "✅ VERIFICADO": a linha seguinte ainda traz "senão, `getReferencesAtPosition` projeto a projeto. A 1.0 prova com dois projetos", texto da premissa em aberto | **Implementador, antes do commit:** apagar a frase. Só `.md`, não caduca nada |
| revisor-geral (2ª) | `casos.md:18` diz que "com" e "Banco público" ficam intactos e emenda "O caso usa `Fila`"; as duas partes se contradizem | **Implementador, antes do commit:** reescrever com a palavra que o caso de fato usa. Só `.md`, não caduca nada |
| revisor-geral (2ª) | A recomendação do `tenancy-guardian` da 1ª rodada tem `TODO.md` como destino, mas o `TODO.md` não mudou | **Implementador, antes do commit:** acrescentar ao `TODO.md` o item "`travas.md` dizer que a guarda de escopo não varre `tools/`" (origem: `tenancy-guardian`, 1ª rodada da 1.0 da X8) |
| tenancy-guardian (2ª) | Na onda em que um mapa tiver entrada de membro sem `arquivo` (o `com`), conferir no relatório que nenhum método de repository, de contexto de escopo ou da guarda `tools/guardas/escopo-dos-repositories.ts` foi pego por coincidência de nome | Tarefa da onda cujo mapa tem o `com` (`inventario-back.md:39`); a Mesa chama o `tenancy-guardian` nela |
| infra-guardian (2ª) | Nas ondas em que o mapa tocar `packages/nucleo/drizzle`, schema ou nome de fila do BullMQ: rename de símbolo não pode virar rename de tabela, coluna ou fila persistida; o `npm install --package-lock-only` não muda versão | Tarefas das ondas que tocam esses caminhos (a Mesa chama o `infra-guardian`); a premissa do lock é da 5.0, `techspec.md` §12 |
| conformidade-reviewer (2ª) | Repete as duas da 1ª rodada: o `conferir` compara prompt e ação auditada (regra 70 na tabela da 2.0); `travas.md:69-73` classificadas antes das ondas 6.0 e 9.0 | Já registradas em "Recomendações sem aplicar" do documento, com destino 2.0, 6.0 e 9.0 |
| privacy-guardian (2ª) | Nenhuma nova; a da 1ª (a string igual ao nome fica nas ondas) continua valendo | Já registrada: tarefas das ondas e `conferir` da 2.0 |
| test-engineer (2ª) | Blocos próprios em `simbolos.ts:68` (`entrada.arquivo === undefined ? … : [entrada.arquivo]`) e `simbolos.ts:178` (`!membro` antes de `ehFormaCurta`) | Recusada: o próprio revisor diz que o caso positivo "os dois módulos e a chamada viram forRoot" pega as duas mutações, e "Mutações" do documento registra que o RF17 não alcança `tools/` |
| test-engineer (2ª) | `mutacoes.ts --faltando` ainda lista linhas com condição sem bloco em `sintaxe.ts`, `texto.ts` e `simbolos.ts` | Recusada: informativo; o documento já diz que a exigência do RF17 (`apps/*/src`, `packages/*/src`) não alcança `tools/`. O Validador decide se alguma é regra declarada |
| test-engineer (2ª) | `aplicar.test.ts:571`, a asserção `` `| ${Object.keys(arquivos)[0] ?? ''} | ` `` passaria com string vazia; escrever o nome do arquivo por extenso | `TODO.md`: hoje toda forma tem arquivo, e mexer em arquivo de teste caduca `test-engineer` e `revisor-geral` por uma asserção que hoje é verdadeira. O Implementador anota no `TODO.md` junto com o item acima |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 03:31:19 | 2026-10-30 03:31:35 | `infra-guardian` | 1 | APROVADO | ab41e8e045290fc7b |
| 2026-10-30 03:31:05 | 2026-10-30 03:31:37 | `tenancy-guardian` | 1 | APROVADO | a47dba6d728312c88 |
| 2026-10-30 03:31:13 | 2026-10-30 03:31:46 | `privacy-guardian` | 1 | APROVADO | a165d549fd2cb9550 |
| 2026-10-30 03:31:16 | 2026-10-30 03:32:22 | `conformidade-reviewer` | 1 | APROVADO | a10ea3d8d76565914 |
| 2026-10-30 03:31:10 | 2026-10-30 03:33:25 | `revisor-geral` | 1 | REPROVADO | a7a1cb40f44292687 |
| 2026-10-30 03:31:08 | 2026-10-30 03:35:09 | `test-engineer` | 1 | REPROVADO | aa96d6c91bd0d2ca0 |
| 2026-10-30 03:52:56 | 2026-10-30 03:53:14 | `tenancy-guardian` | 2 | APROVADO | a59433d233b2d1ac6 |
| 2026-10-30 03:52:40 | 2026-10-30 03:53:26 | `revisor-geral` | 2 | APROVADO | ae0a1edb4e4f3433f |
| 2026-10-30 03:53:02 | 2026-10-30 03:53:27 | `privacy-guardian` | 2 | APROVADO | a8965007471ad3c3d |
| 2026-10-30 03:53:13 | 2026-10-30 03:53:27 | `infra-guardian` | 2 | APROVADO | a2ffe9cd1c149fa61 |
| 2026-10-30 03:53:07 | 2026-10-30 03:53:29 | `conformidade-reviewer` | 2 | APROVADO | a73479c28464d66de |
| 2026-10-30 03:52:51 | 2026-10-30 03:55:00 | `test-engineer` | 2 | APROVADO | a88c9895f976abbd9 |
