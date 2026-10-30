# Tarefa 2.0 — O `conferir` prova "só nome", o `restos` prova que nada sobrou, e nenhum filtro casa vazio

**Funcionalidade:** nomes-de-mercado · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As três provas de toda onda: o `conferir.ts` compara a foto do `HEAD` com a árvore, o `restos.ts` busca o nome antigo
de todos os mapas, e a trava contra filtro vazio acusa o glob, o caminho e o `path` que não casam com nada.

## Contexto necessário

- `techspec.md` §5: "O `conferir`", "O `restos`" e "A trava contra filtro vazio"; §10
- `casos.md`: "`conferir`", "`restos`" e "Trava contra filtro vazio"
- `prd.md` RF3, RF7 e RF11
- `travas.md`, "A forma da prova" (a forma C cita os casos de árvore da 2.3 e da 2.4)
- `tools/guardas/index.mjs`: `configuracaoDasGuardas` e `EXCECOES_DAS_GUARDAS`

## Subtarefas

- [x] 2.1 — O `conferir`: a foto do `HEAD` (por `git show`) e a da árvore, o mapa na foto de antes, as exceções
- [x] 2.2 — O `restos`, com as liberações do §5, sobre todos os mapas. O mapa com `"linha": true` não olha documento
  enquanto não existir `mapas/13.json`. Com o `13.json`, todos olham, e o ouro deixa de ser isento
- [x] 2.3 — `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`: roda sobre a árvore real com
  os mapas de `tools/renomear/mapas/`. É o caso que a forma C das ondas cita
- [x] 2.4 — `tools/guardas/filtros-casam.test.ts`: a base dividida do §5, as fontes de `casos.md` com o mínimo de hoje
  gravado, e a exceção nominal com o motivo. Um caso por fonte, sobre a árvore real
- [x] 2.5 — Fixture real: o `knip.json` e o `paths:` de uma regra, copiados como estão; o `eslint.config.mjs` é lido do arquivo real
  (a configuração exportada, como o §5 pede). Os comandos já estão no procedimento de onda do `tasks.md`
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/renomear/conferir.ts`, `foto.ts`, `casos.ts`, `restos.ts` e os testes `conferir.test.ts`, `restos.test.ts` | novo |
| `tools/renomear/especificadores.ts`, `reaplicar.ts`, `texto.ts` | alterado: só passam a exportar o que o `conferir` e o `restos` reusam (`destinoDoCaminho`, `literalDoNo`, `MAPA_DOS_DOCUMENTOS`, `lerTodosOsMapas`, `foraDoPasso5`) |
| `tools/guardas/filtros-casam.test.ts` | novo |
| `tools/guardas/__fixtures__/filtros/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir`, "Vermelho quando" | unidade | um caso por item | tools/renomear/conferir.test.ts › conferir: vermelho quando (12 casos: a chave de aspas, o nome passado para template ou chave, o caso que entra e o que some, o describe, infra/test e infra/scripts, o nome exportado e o especificador fora do mapa, o pacote sem o mapa de pacote, a exceção que não cobre o especificador, a exceção que vale só no arquivo dela, o arquivo novo); tools/renomear/conferir.test.ts › conferir: o que a foto conta e o que não conta (15 casos, entre eles o JSX só reindentado, o título que não é texto, o template com duas substituições, a chave numérica e o buraco na desestruturação) |
| `conferir`, um caso que entra | unidade | vermelho (RF7) | tools/renomear/conferir.test.ts › conferir: vermelho quando › um caso de teste entra (RF7); tools/renomear/conferir.test.ts › conferir: vermelho quando › um caso de teste some |
| `conferir`, `describe` mudado | unidade | vermelho (RF6) | tools/renomear/conferir.test.ts › conferir: vermelho quando › o texto de um describe muda (RF6), e a exceção não o salva |
| `conferir`, string em `infra/test/` | unidade | vermelho | tools/renomear/conferir.test.ts › conferir: vermelho quando › uma string em infra/test/ e uma em infra/scripts/ |
| `conferir`, string em `tools/renomear/` | unidade | verde: fora da foto | tools/renomear/conferir.test.ts › conferir: verde quando › tools/renomear/ fica fora da foto: uma string nova lá não conta |
| `conferir`, "Verde quando" | unidade | um caso por item | tools/renomear/conferir.test.ts › conferir: verde quando (9 casos: a árvore do HEAD, o especificador e o nome exportado renomeados, o pacote com subcaminho, a exceção nos dois lados, o teste movido com e sem o mapa, o arquivo importador movido para outra profundidade, o nome que muda de arquivo no mesmo pacote, tools/renomear/) |
| `restos`, "Vermelho" | unidade | um caso por item | tools/renomear/restos.test.ts › restos: vermelho (15 casos: a chave do passo 2, o membro e o tipo que não contam e a variável local que conta, o tipo, os dois usos na mesma linha, a troca à mão que não libera, string, regex, template e array, crases, composto e caminho, o .js de dist, o -w, o mapa anterior, a trava, o fica de outro arquivo, o ouro na 13.0 e o JSON do ouro, o mapa de linha com o 13.json) |
| `restos`, "Verde" | unidade | um caso por liberação | tools/renomear/restos.test.ts › restos: verde (12 casos: a prosa, a palavra comum em string e variável, o texto de describe, de it e de test, o fica de arquivo e de pasta, docs/decisoes.md, tasks/ e o protótipo, a própria ferramenta, o Markdown fora de docs/, a troca à mão registrada, a onda de linha sem o 13.json, o ouro numa onda que não é a 13.0, a árvore limpa) |
| `restos`, `de` de um mapa anterior | unidade | vermelho | tools/renomear/restos.test.ts › restos: vermelho › o de de um mapa anterior, com um mapa mais novo na pasta |
| `restos`, mapa de linha sem `13.json` | unidade | documento com nome antigo passa | tools/renomear/restos.test.ts › restos: verde › um documento com o nome antigo numa onda de linha, sem o 13.json |
| `restos`, mapa de linha com `13.json` | unidade | o mesmo documento fica vermelho | tools/renomear/restos.test.ts › restos: vermelho › com o 13.json, o mapa de linha vale também nos documentos |
| `restos` na árvore | unidade | zero com os mapas aplicados | tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados |
| filtro vazio, "Verde" | unidade | um caso por item | tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › verde (6 casos: o glob que casa um arquivo, o prefixo, a regex, a pasta e o dist com fonte; __fixtures__/ na base inteira; **/dist/** pela exceção nominal; o protótipo; o glob sem barra e o negado; o $1 do camadas.cjs) |
| filtro vazio, "Vermelho" | unidade | um caso por item | tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › vermelho (10 casos: o glob que não casa, o array de um item vazio, o path em regex do camadas.cjs, o files e o ignores do eslint, o workspace e o project do knip, o paths de uma regra, a fonte abaixo do mínimo, o glob só da fixture, o glob só do protótipo ou do dist, o caminho de dist sem fonte) |
| filtro vazio na árvore | unidade | cada fonte rende o mínimo gravado | tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › a árvore real › %s: cada item casa com um arquivo, e a fonte rende o mínimo (um por fonte); tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › a árvore real › o mínimo gravado é o número de hoje, e não um piso frouxo |
| quem contorna é acusado | unidade | o nome antigo passado para template ou chave (`conferir`); em crase, regex ou `dist` (`restos`); o glob que só casa na fixture (filtro): um caso cada | tools/renomear/conferir.test.ts › conferir: vermelho quando › o nome antigo passado para um template ou para uma chave é acusado, também na forma curta; tools/renomear/restos.test.ts › restos: vermelho › `Fila` entre crases num documento; tools/renomear/restos.test.ts › restos: vermelho › o nome antigo em uma string, em uma regex, em um template e em um array; tools/renomear/restos.test.ts › restos: vermelho › um .js de dist com o nome antigo em infra/; tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › vermelho › um glob que só casa com arquivo dentro de __fixtures__/, sem nomear a pasta |
| o alvo não existe | unidade | o `conferir` com foto vazia ou pasta inexistente, o comando `restos` sem mapa e a fonte que não carrega falham alto, um caso cada | tools/renomear/conferir.test.ts › conferir: o alvo não existe (5 casos: a foto do HEAD vazia, a pasta que o HEAD não tem, a raiz, o mapa e o mapa sem a linha do anexo); tools/renomear/restos.test.ts › restos: o alvo não existe › sem mapa na pasta, falha alto; tools/guardas/filtros-casam.test.ts › nenhum filtro casa vazio (X8) › o alvo não existe › a fonte que não carrega falha alto, com o nome dela |

## Como testar

- O mínimo por fonte e a árvore real: `tools/processo/harness/caminhos.test.ts › o repositório de hoje passa, com contagem
  mínima e ao menos um caminho em cada pasta da raiz`.
- A base: `arquivosDoRepositorio()` de `tools/guardas/guardas.test.ts`; a configuração do ESLint, por
  `eslint.calculateConfigForFile` (`guardas.test.ts › a guarda de erro tipado fica…`).
- O AST da foto: siga `tools/guardas/escopo-dos-repositories.ts`. O repositório temporário vem da 1.0.
- Comandos: `npx vitest run --project unidade tools/renomear/ tools/guardas/filtros-casam.test.ts`.

## Autoconferência

As 12 perguntas, respondidas no plano. Na 3, o mínimo fica vermelho com uma fonte pulada (as entries do `knip.json`).

1. **Mutação de cada cláusula.** Ver "Mutações": 114 blocos. Cada categoria da foto (string, template, regex, JSX, chave, caso, exportado,
   especificador), o mapa aplicado à foto de antes (símbolo, arquivo, pacote, subcaminho), a exceção (categoria, arquivo, texto), a
   contagem por diferença, o texto e o código de saída do `conferir`; cada liberação do `restos` (`fica`, título de caso, chave do passo 2,
   troca à mão, o que o passo 5 deixa fora), a `trava` que não libera, o mapa de linha com e sem o `13.json`, o ouro e a deduplicação; a
   base dividida do filtro, a exceção nominal, cada tipo de item e o mínimo de cada fonte. Cada um foi aplicado, rodou o teste citado e
   ficou vermelho (114 de 114) antes de eu pedir a rodada. Onze não ficavam na primeira passada: seis eram teste fraco (corrigi o
   teste: `codigo` do caso que entra, três cópias da mesma string, o `default` de uma expressão, o JSX com filho e linha quebrada, o `describe`
   que não é texto com um caso novo ao lado, o título em template com um nome que o `restos` enxerga), um era nome de caso mal escrito, e um era
   mutação equivalente (o `ehCodigo` do título de caso: o trecho de um documento é a linha inteira e nunca coincide com o texto do título),
   que tirei. `--faltando` ainda lista 32 linhas de `tools/`, todas de varredura da árvore ou de ramo defensivo (`?? new Map()`,
   `import.meta.filename`); o RF17 só exige a pasta `apps/*/src` e `packages/*/src`.
2. **Texto na tela.** Não se aplica: a tarefa não toca `apps/`, só `tools/`.
3. **Segundo dado.** Cada caso do `conferir` tem o lado que passa (o mesmo nome em outro arquivo, a exceção em outro arquivo, o pacote
   igual) e o que falha; o `restos` tem o nome em arquivo classificado e em outro que não; o filtro tem o glob que casa e o que não; o mínimo
   de cada fonte fica vermelho com uma fonte pulada.
4. **Checagem anterior que responde antes.** O `conferir` recusa a foto vazia e a pasta sem arquivo antes de comparar; o `restos` sem mapa
   lança antes de varrer. Cada caso de alvo ausente confere a mensagem, não só o código.
5. **A asserção olha o resultado.** Todos os casos comparam a lista de diferenças ou de restos (`arquivo:linha onde de`), o código de saída
   ou a mensagem; nenhum compara a forma do código. O caso da árvore real compara a lista vazia dos mapas aplicados.
6. **Guarda nova com fixture de quem a contorna.** O `conferir` acusa o nome passado para template ou chave; o `restos`, para crase,
   regex, `dist` e `-w`; o filtro, o glob que só casa dentro de `__fixtures__/` ou do protótipo. A fixture é cópia do `knip.json` e da
   regra `30-camada-ia.md` reais, e o `eslint.config.mjs` é lido de verdade.
7. **Comentário que afirma o que o código não faz.** Reli os docblocks de `conferir.ts`, `foto.ts`, `casos.ts` e `restos.ts`: o que a
   foto não conta (nome local, método, chave de string que a chave sustenta) e o que o `restos` libera estão ditos, e batem com os casos.
8. **Divergência que cria regra.** Nenhuma. A tarefa não diverge da Tech Spec §5.
9. **Peça que já existe.** `analisar`, `ehCodigo`, `linhaDe` (`ast.ts`), `acharReferencias` e `estaClassificada` (`referencias.ts`),
   `trocarTrecho` e `comentariosDe` (`texto.ts`), `lerTodosOsMapas` (`reaplicar.ts`), `destinoDoCaminho` (`especificadores.ts`) e o
   repositório de brinquedo da 1.0 são importados; só passaram a exportar o que faltava. O filtro lê a `configuracaoDasGuardas` e as constantes de `tools/guardas/index.mjs`, e a base é o `git ls-files`, como a de `guardas.test.ts`.
10. **Operação simultânea.** Não se aplica: ferramenta de linha de comando e teste, sem banco, fila nem tela.
11. **Isolamento e coluna "Caso".** A tarefa não toca dado de escola nem repository; a coluna "Caso" está preenchida, um caso por coisa
    que a linha diz.
12. **"O que verificar" dos guardiões e o índice.** `tenancy-guardian` e `privacy-guardian`: a ferramenta só lê a árvore do git, não
    abre dado de escola nem de pessoa; `conformidade-reviewer` e `infra-guardian`: não tocam agente, nota nem infra de produção; o
    `test-engineer` está atendido pelas respostas 1, 3, 4 e 5, e o `revisor-geral` pela 7.

## Fora do escopo desta tarefa

O `aplicar` (1.0), os mapas de onda e qualquer rename.

## Divergências resolvidas nesta tarefa

Nenhuma.

## Mutações

Um bloco por cláusula do §5: cada categoria da foto, o mapa na foto de antes, as exceções, cada liberação do `restos`,
o mapa de linha e o `13.json`, a base dividida, a exceção nominal e o mínimo de cada fonte.

O mapa aplicado à foto de antes: o caminho, o especificador e o nome exportado.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  entradas.filter((entrada) => entrada.tipo === 'arquivo' || entrada.tipo === 'pasta').map((entrada) => ({ de: entrada.de, para: entrada.para, pasta: entrada.tipo === 'pasta' }))
+  entradas.filter((entrada) => entrada.tipo === 'arquivo').map((entrada) => ({ de: entrada.de, para: entrada.para, pasta: entrada.tipo === 'pasta' }))
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  entradas.filter((entrada) => entrada.tipo === 'arquivo' || entrada.tipo === 'pasta').map((entrada) => ({ de: entrada.de, para: entrada.para, pasta: entrada.tipo === 'pasta' }))
+  entradas.filter((entrada) => entrada.tipo === 'arquivo' || entrada.tipo === 'pasta').map((entrada) => ({ de: entrada.de, para: entrada.para, pasta: false }))
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  if (valor === de) return para
+  if (false) return para
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o pacote com subcaminho: o subcaminho muda antes do nome
-  return valor.startsWith(`${de}/`) ? para + valor.slice(de.length) : undefined
+  return undefined
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o pacote com subcaminho: o subcaminho muda antes do nome
-  for (const entrada of [...pacotes].sort((a, b) => b.de.length - a.de.length)) atual = substituirPrefixo(atual, entrada.de, entrada.para) ?? atual
+  for (const entrada of [...pacotes].sort((a, b) => a.de.length - b.de.length)) atual = substituirPrefixo(atual, entrada.de, entrada.para) ?? atual
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  if (tipo === 'pacote') return `pacote|${pacoteMapeado(alvo, pacotes)}`
+  if (false) return `pacote|${pacoteMapeado(alvo, pacotes)}`
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-    if (item.categoria === 'especificador') return { ...item, arquivo, valor: especificadorMapeado(item.valor, movimentos, pacotes) }
+    if (item.categoria === 'especificador') return { ...item, arquivo }
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-    if (item.categoria === 'exportado') return { ...item, arquivo, valor: simbolos.get(item.valor) ?? item.valor }
+    if (item.categoria === 'exportado') return { ...item, arquivo, valor: item.valor }
```


A comparação: o grupo, a contagem e o lado.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o nome exportado que passa de um pacote para outro é acusado
-  return partes.slice(0, partes[0] === 'apps' || partes[0] === 'packages' ? 2 : 1).join('/')
+  return partes.slice(0, 1).join('/')
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a mesma string que passa de uma vez para duas é acusada
-    grupo.set(item.valor, (grupo.get(item.valor) ?? 0) + 1)
+    grupo.set(item.valor, 1)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › um caso de teste entra
-    const lado = delta > 0 ? 'entrou' : 'saiu'
+    const lado = delta > 0 ? 'saiu' : 'entrou'
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a mesma string que passa de uma vez para duas é acusada
-    return Array.from({ length: Math.abs(delta) }, (): Divergencia => ({ categoria: categoria as Categoria, arquivo, valor, lado }))
+    return Array.from({ length: Math.min(1, Math.abs(delta)) }, (): Divergencia => ({ categoria: categoria as Categoria, arquivo, valor, lado }))
```


As exceções.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o texto de um describe muda
-  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo && excecao.texto === divergencia.valor)
+  return excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo && excecao.texto === divergencia.valor)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a exceção vale só no arquivo dela
-  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo && excecao.texto === divergencia.valor)
+  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.texto === divergencia.valor)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a string mudada está declarada como exceção, nos dois lados
-  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo && excecao.texto === divergencia.valor)
+  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a exceção de uma string não cobre o especificador nem o nome exportado
-const CATEGORIAS_COM_EXCECAO: ReadonlySet<Categoria> = new Set(['string', 'template', 'regex', 'jsx', 'chave'])
+const CATEGORIAS_COM_EXCECAO: ReadonlySet<Categoria> = new Set(['string', 'template', 'regex', 'jsx', 'chave', 'exportado'])
```


O alvo que não existe: a foto vazia, a raiz e o mapa.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a pasta da foto que o HEAD não tem lança, mesmo com as outras cheias
-    if (![...arquivos.keys()].some((caminho) => caminho.startsWith(raiz))) throw new Error(`a foto do HEAD não tem arquivo em ${raiz}: o conferir não tem o que comparar`)
+    if (false) throw new Error(`a foto do HEAD não tem arquivo em ${raiz}: o conferir não tem o que comparar`)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a raiz que não existe lança
-  if (!existsSync(raiz)) throw new Error(`${raiz} não existe`)
+  if (false) throw new Error(`${raiz} não existe`)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o mapa sem a linha do anexo lança, sem conferir
-  if (invalidas.length > 0) throw new Error(`mapa inválido:\n${invalidas.map((recusa) => `- ${recusa.detalhe}`).join('\n')}`)
+  if (false) throw new Error(`mapa inválido:\n${invalidas.map((recusa) => `- ${recusa.detalhe}`).join('\n')}`)
```


A foto do HEAD e a da árvore.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a árvore é a do HEAD
-  return execFileSync('git', argumentos, { cwd: raiz, maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...(entrada === undefined ? {} : { input: entrada }) })
+  return execFileSync('git', argumentos, { cwd: raiz, maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],  })
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › tools/renomear/ fica fora da foto: uma string nova lá não conta
-  const caminhos = git(raiz, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']).toString('utf8').split('\0').filter((caminho) => caminho !== '' && naFoto(caminho))
+  const caminhos = git(raiz, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']).toString('utf8').split('\0').filter((caminho) => caminho !== '')
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › tools/renomear/ fica fora da foto: uma string nova lá não conta
-    if (caminho !== '' && naFoto(caminho) && existsSync(join(raiz, caminho))) arquivos.set(caminho, readFileSync(join(raiz, caminho), 'utf8'))
+    if (caminho !== '' && existsSync(join(raiz, caminho))) arquivos.set(caminho, readFileSync(join(raiz, caminho), 'utf8'))
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o arquivo apagado do disco e ainda no índice: tudo o que ele tinha sai
-    if (caminho !== '' && naFoto(caminho) && existsSync(join(raiz, caminho))) arquivos.set(caminho, readFileSync(join(raiz, caminho), 'utf8'))
+    if (caminho !== '' && naFoto(caminho)) arquivos.set(caminho, readFileSync(join(raiz, caminho), 'utf8'))
```


O texto e o código de saída.
```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a árvore é a do HEAD
-  if (divergencias.length === 0) return `conferir: verde. ${String(itens)} itens na foto de antes, nenhuma diferença que o mapa não explique.`
+  if (false) return `conferir: verde. ${String(itens)} itens na foto de antes, nenhuma diferença que o mapa não explique.`
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › mais de 200 diferenças: o texto lista as primeiras e diz quantas faltam
-  return [`conferir: VERMELHO. ${String(divergencias.length)} diferenças que o mapa não explica:`, ...linhas, ...(resto > 0 ? [`… e mais ${String(resto)}`] : [])].join('\n')
+  return [`conferir: VERMELHO. ${String(divergencias.length)} diferenças que o mapa não explica:`, ...linhas, ...[]].join('\n')
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › um caso de teste entra
-  return { codigo: divergencias.length === 0 ? 0 : 1, divergencias, texto: textoDoResultado(divergencias, antes.length) }
+  return { codigo: 0, divergencias, texto: textoDoResultado(divergencias, antes.length) }
```


A foto de um arquivo: o que entra e o que fica de fora.
```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o que não é código fica fora, e a raiz do repositório também
-export const naFoto = (caminho: string): boolean => ehCodigo(caminho) && !caminho.startsWith(FORA_DA_FOTO) && RAIZES_DA_FOTO.some((raiz) => caminho.startsWith(raiz))
+export const naFoto = (caminho: string): boolean => !caminho.startsWith(FORA_DA_FOTO) && RAIZES_DA_FOTO.some((raiz) => caminho.startsWith(raiz))
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o que não é código fica fora, e a raiz do repositório também
-export const naFoto = (caminho: string): boolean => ehCodigo(caminho) && !caminho.startsWith(FORA_DA_FOTO) && RAIZES_DA_FOTO.some((raiz) => caminho.startsWith(raiz))
+export const naFoto = (caminho: string): boolean => ehCodigo(caminho) && !caminho.startsWith(FORA_DA_FOTO) 
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  if (!valor.startsWith('.')) return `pacote|${valor}`
+  if (false) return `pacote|${valor}`
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-  const extensao = EXTENSAO_DE_CODIGO.exec(valor)?.[0] ?? ''
+  const extensao = ''
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o nome antigo passado para um template ou para uma chave é acusado, também na forma curta
-  if (!(ts.isPropertyAssignment(no) || ts.isShorthandPropertyAssignment(no) || ts.isMethodDeclaration(no) || ts.isAccessor(no))) return undefined
+  if (!(ts.isPropertyAssignment(no) || ts.isMethodDeclaration(no) || ts.isAccessor(no))) return undefined
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave de método e de acessor de um objeto literal, e a exportação por padrão e por desestruturação
-  if (!(ts.isPropertyAssignment(no) || ts.isShorthandPropertyAssignment(no) || ts.isMethodDeclaration(no) || ts.isAccessor(no))) return undefined
+  if (!(ts.isPropertyAssignment(no) || ts.isShorthandPropertyAssignment(no) || ts.isMethodDeclaration(no))) return undefined
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o método de classe e o nome que não é exportado mudam de nome sem ser diferença
-  if (!ts.isObjectLiteralExpression(no.parent)) return undefined
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave de aspas é chave: a string que a sustenta não conta duas vezes
-  return ts.isStringLiteralLike(no.name) ? { nome, literal: no.name } : { nome }
+  return { nome }
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a árvore é a do HEAD
-  if (clausula === undefined) return []
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave de método e de acessor de um objeto literal, e a exportação por padrão e por desestruturação
-  if (ts.isNamespaceExport(clausula)) return [clausula.name.text]
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a exportação por padrão de uma expressão é o nome default
-  if (ts.isExportAssignment(declaracao)) return ['default']
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o método de classe e o nome que não é exportado mudam de nome sem ser diferença
-  if (!exportado(declaracao)) return []
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a classe exportada por padrão muda de nome sem ser diferença: o nome exportado é default
-  if (porPadrao(declaracao)) return ['default']
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave de método e de acessor de um objeto literal, e a exportação por padrão e por desestruturação
-  if (ts.isVariableStatement(declaracao)) return declaracao.declarationList.declarations.flatMap((variavel) => nomesDoPadrao(variavel.name))
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › um caso de teste entra
-  (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ignorados.has(no)
+  (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no))
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o meio de um template com duas substituições, e o JSX reindentado
-  (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) && !ignorados.has(no)
+  (ts.isTemplateHead(no) || ts.isTemplateTail(no)) && !ignorados.has(no)
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o título em template: o texto fixo é o do caso
-  (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) && !ignorados.has(no)
+  (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no))
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › muda uma regex
-  if (ts.isRegularExpressionLiteral(no)) return { categoria: 'regex', valor: no.text }
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o JSX só reindentado não é diferença
-  return ts.isJsxText(no) && aparar(no.text) !== '' ? { categoria: 'jsx', valor: aparar(no.text) } : undefined
+  return ts.isJsxText(no) ? { categoria: 'jsx', valor: aparar(no.text) } : undefined
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o JSX só reindentado não é diferença
-const aparar = (texto: string): string => texto.replace(/\s+/g, ' ').trim()
+const aparar = (texto: string): string => texto.trim()
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote
-      ignorados.add(especificador.literal)
+      
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o título em template: o texto fixo é o do caso
-    if (ts.isTemplateExpression(caso.no)) for (const parte of [caso.no.head, ...caso.no.templateSpans.map((trecho) => trecho.literal)]) ignorados.add(parte)
+    if (false) for (const parte of [caso.no.head, ...caso.no.templateSpans.map((trecho) => trecho.literal)]) ignorados.add(parte)
```


Os casos de teste: a cadeia `.each(…)(título)`, o título que é texto e o `expect` que não é caso.
```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › o texto de um describe muda
-    if (ts.isPropertyAccessExpression(alvo) || ts.isCallExpression(alvo)) alvo = alvo.expression
+    if (ts.isPropertyAccessExpression(alvo)) alvo = alvo.expression
```

```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › o título que não é texto não entra no caminho, e o expect com texto não é caso
-  return ts.isIdentifier(alvo) && CHAMADAS_DE_CASO.has(alvo.text) ? alvo.text : undefined
+  return ts.isIdentifier(alvo) ? alvo.text : undefined
```

```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › o título em template: o texto fixo é o do caso
-  if (!ts.isTemplateExpression(no)) return undefined
+  return undefined
```

```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › o título que não é texto não entra no caminho, e o expect com texto não é caso
-      if (tipo !== undefined && titulo !== undefined && no.arguments[0] !== undefined) {
+      if (tipo !== undefined && no.arguments[0] !== undefined) {
```

```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › o texto de um describe muda
-        dentro = [...pilha, titulo]
+        dentro = [titulo]
```


O `restos`: o que é liberado e o que não é.
```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a própria ferramenta: o identificador e o comentário em tools/renomear/
-const foraDoIdentificador = (caminho: string): boolean => caminho.startsWith('tools/renomear/') || new RegExp(`(^|/)(node_modules|${PASTA_DO_PROTOTIPO}|tasks|docs)/`).test(caminho)
+const foraDoIdentificador = (caminho: string): boolean =>  new RegExp(`(^|/)(node_modules|${PASTA_DO_PROTOTIPO}|tasks|docs)/`).test(caminho)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › md, tasks/ e o protótipo
-const foraDoIdentificador = (caminho: string): boolean => caminho.startsWith('tools/renomear/') || new RegExp(`(^|/)(node_modules|${PASTA_DO_PROTOTIPO}|tasks|docs)/`).test(caminho)
+const foraDoIdentificador = (caminho: string): boolean => caminho.startsWith('tools/renomear/') || false
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › 0, o JSON do ouro também, e o JSON de outra pasta de docs/ não
-const ehDoOuro = (caminho: string): boolean => PASTAS_DO_OURO.some((pasta) => caminho.startsWith(pasta)) && /\.(md|json)$/.test(caminho)
+const ehDoOuro = (caminho: string): boolean => /\.(md|json)$/.test(caminho)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › 0, o JSON do ouro também, e o JSON de outra pasta de docs/ não
-const ehDoOuro = (caminho: string): boolean => PASTAS_DO_OURO.some((pasta) => caminho.startsWith(pasta)) && /\.(md|json)$/.test(caminho)
+const ehDoOuro = (caminho: string): boolean => PASTAS_DO_OURO.some((pasta) => caminho.startsWith(pasta))
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › lê o arquivo e o nome de cada linha, e para na próxima seção
-  if (inicio < 0) return registrada
+  
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › lê o arquivo e o nome de cada linha, e para na próxima seção
-    if (linha.startsWith('## ')) break
+    
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › lê o arquivo e o nome de cada linha, e para na próxima seção
-    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
+    if (arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › lê o arquivo e o nome de cada linha, e para na próxima seção
-    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
+    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › lê o arquivo e o nome de cada linha, e para na próxima seção
-    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
+    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && true) registrada.add(`${arquivo}\u0000${nome}`)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o texto de describe, de it e de test
-      guardar(no.head, no.head.text)
+      
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o texto de describe, de it e de test
-      for (const trecho of no.templateSpans) guardar(trecho.literal, trecho.literal.text)
+      
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o que não é código não é lido como código: um Markdown fora de docs/ com o nome em prosa
-    if (texto === undefined || !ehCodigo(caminho) || foraDoIdentificador(caminho) || ![...simbolos.keys()].some((de) => texto.includes(de))) continue
+    if (texto === undefined || foraDoIdentificador(caminho) || ![...simbolos.keys()].some((de) => texto.includes(de))) continue
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a chave do passo 2, o membro e o tipo não contam, mas o uso de uma variável local com o nome antigo é resto
-      if (entrada !== undefined && ts.isIdentifier(no) && textoDoUso(no, entrada) !== undefined) {
+      if (entrada !== undefined && ts.isIdentifier(no) && true) {
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a própria ferramenta: o identificador e o comentário em tools/renomear/
-    if (texto === undefined || !ehCodigo(caminho) || foraDoPasso5(caminho) || !entradas.some((entrada) => texto.includes(entrada.de))) continue
+    if (texto === undefined || !ehCodigo(caminho) || !entradas.some((entrada) => texto.includes(entrada.de))) continue
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o README do ouro numa onda que não é a 13
-    if (texto === undefined || !(ehDocumentoVivo(caminho) || (comOuro && ehDoOuro(caminho)))) continue
+    if (texto === undefined || !(ehDocumentoVivo(caminho) || ehDoOuro(caminho))) continue
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › 0, o caminho antigo num README do ouro
-    if (texto === undefined || !(ehDocumentoVivo(caminho) || (comOuro && ehDoOuro(caminho)))) continue
+    if (texto === undefined || !(ehDocumentoVivo(caminho))) continue
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › um documento com o nome antigo numa onda de linha, sem o 13
-  const dosDocumentos = mapas.filter((mapa) => !mapa.linha || existe13).flatMap((mapa) => mapa.entradas)
+  const dosDocumentos = mapas.filter(() => true).flatMap((mapa) => mapa.entradas)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › json, o mapa de linha vale também nos documentos
-  const dosDocumentos = mapas.filter((mapa) => !mapa.linha || existe13).flatMap((mapa) => mapa.entradas)
+  const dosDocumentos = mapas.filter((mapa) => !mapa.linha).flatMap((mapa) => mapa.entradas)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a troca à mão registrada não libera o texto nem o identificador
-    .filter((resto) => resto.onde === 'texto' || resto.onde === 'identificador' || !registrada.has(`${resto.arquivo}\u0000${resto.de}`))
+    .filter((resto) =>  !registrada.has(`${resto.arquivo}\u0000${resto.de}`))
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o fica: a string de fora
-    .filter((resto) => estaClassificada(resto, fica) === undefined)
+    
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › dois usos na mesma linha: um resto só
-    return !vistos.has(chave) && vistos.add(chave)
+    return true
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › sai 0 limpa, 1 com resto e 2 sem mapa
-  return { codigo: unicos.length === 0 ? 0 : 1, restos: unicos, texto: textoDoResultado(unicos, mapas.length) }
+  return { codigo: 0, restos: unicos, texto: textoDoResultado(unicos, mapas.length) }
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › sai 0 limpa, 1 com resto e 2 sem mapa
-  if (restos.length === 0) return `restos: limpo. ${String(mapas)} mapas, nenhum nome antigo sobrou.`
+  if (false) return `restos: limpo. ${String(mapas)} mapas, nenhum nome antigo sobrou.`
```


A trava contra filtro vazio: a base dividida, a exceção nominal e cada forma de item.
```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que só casa no protótipo, ou dentro de dist/, sem nomear a pasta
-  const fora = (arquivo: string) => /(^|\/)(__fixtures__|dist)\//.test(arquivo) || arquivo.startsWith(`${PASTA_DO_PROTOTIPO}/`)
+  const fora = (arquivo: string) => /(^|\/)(__fixtures__|dist)\//.test(arquivo) 
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que só casa no protótipo, ou dentro de dist/, sem nomear a pasta
-  const fora = (arquivo: string) => /(^|\/)(__fixtures__|dist)\//.test(arquivo) || arquivo.startsWith(`${PASTA_DO_PROTOTIPO}/`)
+  const fora = (arquivo: string) => /(^|\/)(__fixtures__)\//.test(arquivo) || arquivo.startsWith(`${PASTA_DO_PROTOTIPO}/`)
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que nomeia __fixtures__/ casa na base inteira
-  const alvo = nomeiaFixtureOuProtótipo(item.valor) ? base.inteira : base.comum
+  const alvo = base.comum
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › um glob que só casa com arquivo dentro de __fixtures__/, sem nomear a pasta
-  const alvo = nomeiaFixtureOuProtótipo(item.valor) ? base.inteira : base.comum
+  const alvo = base.inteira
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que nomeia o protótipo casa na base inteira
-const nomeiaFixtureOuProtótipo = (valor: string): boolean => valor.includes('__fixtures__') || valor.includes(`${PASTA_DO_PROTOTIPO}/`)
+const nomeiaFixtureOuProtótipo = (valor: string): boolean => valor.includes('__fixtures__') || false
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › não casa nada e passa só pela exceção nominal, que tem o motivo
-  if (EXCECOES_NOMINAIS.has(item.valor)) return undefined
+  
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › um array com um só item vazio
-  if (item.valor === '') return 'item vazio'
+  
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que casa um arquivo, o prefixo, a regex, a pasta e o dist com fonte passam
-      return base.some((arquivo) => arquivo.startsWith(item.valor))
+      return false
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que casa um arquivo, o prefixo, a regex, a pasta e o dist com fonte passam
-      return base.some((arquivo) => regexDoItem(item.valor).test(arquivo))
+      return false
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob que casa um arquivo, o prefixo, a regex, a pasta e o dist com fonte passam
-      return item.valor === '.' || base.some((arquivo) => globCasa(`${item.valor}/**`, arquivo))
+      return false
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › um caminho de dist cuja fonte em src/ não existe
-      return fonteDoDist(item.valor).some((fonte) => base.includes(fonte))
+      return true
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob sem barra vale para o nome do arquivo em qualquer pasta, e o negado é conferido sem o !
-  return matchesGlob(limpo.includes('/') ? arquivo : basename(arquivo), limpo)
+  return matchesGlob(arquivo, limpo)
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o glob sem barra vale para o nome do arquivo em qualquer pasta, e o negado é conferido sem o !
-  const limpo = glob.startsWith('!') ? glob.slice(1) : glob
+  const limpo = glob
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › cjs casa qualquer nome de pasta
-const regexDoItem = (valor: string): RegExp => new RegExp(valor.replaceAll('$1', '[^/]+'))
+const regexDoItem = (valor: string): RegExp => new RegExp(valor)
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › uma fonte que rende menos itens que o mínimo dela: as entries do knip
-  const doMinimo = fonte.itens.length < fonte.minimo ? [`${fonte.nome}: rendeu ${String(fonte.itens.length)} itens e o mínimo é ${String(fonte.minimo)}: o extrator deixou de ler`] : []
+  const doMinimo = false ? [`${fonte.nome}: rendeu ${String(fonte.itens.length)} itens e o mínimo é ${String(fonte.minimo)}: o extrator deixou de ler`] : []
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › a fonte que não carrega falha alto, com o nome dela
-    return { nome, minimo, itens: ler() }
+    return { nome, minimo, itens: (() => { try { return ler() } catch { return [] } })() }
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › mjs, files: cada item casa com um arquivo, e a fonte rende o mínimo
-const dosNossos = (configuracao: readonly Configuracao[]): Configuracao[] => configuracao.filter((bloco) => !(bloco.name ?? '').startsWith('typescript-eslint/'))
+const dosNossos = (configuracao: readonly Configuracao[]): Configuracao[] => configuracao.filter((bloco) => true)
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › json, entries: cada item casa com um arquivo, e a fonte rende o mínimo
-  return globs(Object.entries(knip.workspaces ?? {}).flatMap(([pasta, area]) => (area.entry ?? []).map((glob) => noWorkspace(pasta, glob))))
+  return globs(Object.entries(knip.workspaces ?? {}).flatMap(([pasta, area]) => [].map((glob) => noWorkspace(pasta, String(glob)))))
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › json, entries: cada item casa com um arquivo, e a fonte rende o mínimo
-const noWorkspace = (pasta: string, glob: string): string => (pasta === '.' ? glob : `${pasta}/${glob}`)
+const noWorkspace = (pasta: string, glob: string): string => `${pasta}/${glob}`
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › cjs: cada item casa com um arquivo, e a fonte rende o mínimo
-  const filtros = [...camadas.forbidden.flatMap((regra) => [regra.from, regra.to]), camadas.options?.doNotFollow, camadas.options?.exclude]
+  const filtros = [...camadas.forbidden.flatMap((regra) => [regra.from, regra.to]), ]
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › cjs: cada item casa com um arquivo, e a fonte rende o mínimo
-  const filtros = [...camadas.forbidden.flatMap((regra) => [regra.from, regra.to]), camadas.options?.doNotFollow, camadas.options?.exclude]
+  const filtros = [ camadas.options?.doNotFollow, camadas.options?.exclude]
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › cjs: cada item casa com um arquivo, e a fonte rende o mínimo
-  return unicos(filtros.flatMap((filtro) => [...listaDe(filtro?.path), ...listaDe(filtro?.pathNot)]).map((valor) => ({ valor, tipo: 'regex' as const })))
+  return unicos(filtros.flatMap((filtro) => [...listaDe(filtro?.path)]).map((valor) => ({ valor, tipo: 'regex' as const })))
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › dist de infra/scripts e de medir-risco-a-vida: cada item casa com um arquivo, e a fonte rende o mínimo
-  return unicos([...texto.matchAll(/'((?:apps|packages)\/[^'\s]+\/dist\/[^'\s]+\.js)'/g)].map((achado) => ({ valor: achado[1] ?? '', tipo: 'dist' as const })))
+  return unicos([...texto.matchAll(/'(apps\/[^'\s]+\/dist\/[^'\s]+\.js)'/g)].map((achado) => ({ valor: achado[1] ?? '', tipo: 'dist' as const })))
```

```mutacao
arquivo: tools/guardas/filtros-casam.test.ts
teste: tools/guardas/filtros-casam.test.ts › o mínimo gravado é o número de hoje, e não um piso frouxo
-    carregarFonte('configuracaoDasGuardas', 13, () => globs(configuracaoDasGuardas.flatMap((bloco) => textos(bloco.files)))),
+    carregarFonte('configuracaoDasGuardas', 5, () => globs(configuracaoDasGuardas.flatMap((bloco) => textos(bloco.files)))),
```

Rodada 1 (ordem `.processo/ordens/2_task-r1.md`): as cláusulas que tinham teste e não tinham bloco, e o template sem substituição, a chave numérica e o buraco da desestruturação, que ganharam caso.

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › um template sem substituição
-  (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ignorados.has(no)
+  ts.isStringLiteral(no) && !ignorados.has(no)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › um arquivo de teste foi movido e tem os mesmos casos
-    const arquivo = movimentos.reduce((atual, movimento) => destinoDoArquivo(atual, movimento), item.arquivo)
+    const arquivo = item.arquivo
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o arquivo importador movido para outra profundidade: o import relativo muda de texto e o alvo é o mesmo
-    const arquivo = movimentos.reduce((atual, movimento) => destinoDoArquivo(atual, movimento), item.arquivo)
+    const arquivo = item.arquivo
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › muda uma string
-  if (ehTexto(no, ignorados)) return { categoria: 'string', valor: no.text }
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › aparece um especificador fora do mapa
-      guardar('especificador', formaDoEspecificador(caminho, especificador.literal.text))
+      
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave de método e de acessor de um objeto literal, e a exportação por padrão e por desestruturação
-  if (ts.isExportDeclaration(declaracao)) return nomesDaExportacao(declaracao)
+  
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › aparece um nome exportado fora do mapa
-  return nome !== undefined && ts.isIdentifier(nome) ? [nome.text] : []
+  return []
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › muda uma chave de objeto
-  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) return nome.text
+  if (ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) return nome.text
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › a chave numérica é chave: o número que a sustenta não conta como string
-  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) return nome.text
+  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome)) return nome.text
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o buraco numa desestruturação exportada não é nome, e o outro elemento é
-  return nome.elements.flatMap((elemento) => (ts.isOmittedExpression(elemento) ? [] : nomesDoPadrao(elemento.name)))
+  return nome.elements.flatMap((elemento) => nomesDoPadrao((elemento as ts.BindingElement).name))
```

```mutacao
arquivo: tools/renomear/casos.ts
teste: tools/renomear/conferir.test.ts › um caso de teste entra
-  if (ts.isStringLiteralLike(no)) return no.text
+  
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o texto de describe, de it e de test
-    if (ts.isStringLiteralLike(no)) guardar(no, no.text)
+    if (false) guardar(no, no.text)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o de de um mapa anterior, com um mapa mais novo na pasta
-  const todas = mapas.flatMap((mapa) => mapa.entradas)
+  const todas = mapas.slice(-1).flatMap((mapa) => mapa.entradas)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a ocorrência classificada como trava não libera: a onda a troca, e o que sobra é resto
-  const fica = mapas.flatMap((mapa) => mapa.ocorrencias).filter((ocorrencia) => ocorrencia.classe === 'fica')
+  const fica = mapas.flatMap((mapa) => mapa.ocorrencias).filter((ocorrencia) => ocorrencia.classe === 'fica' || ocorrencia.classe === 'trava')
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | `conferir.test.ts:382`: `/ENOENT.*mapas\/9\.json/` depende do texto do erro do Node; exigir só o caminho do mapa na mensagem | A rodada 2 não teve reprovação, então a recomendação não entra em ordem (D79). `TODO.md` |
| test-engineer (2ª) | O bloco de `foto.ts:58` (buraco na desestruturação) deixa o teste vermelho porque o código lança ao ler `.name` de `undefined`, não por divergência errada | Recusada: o próprio revisor diz que é o efeito real de tirar a cláusula e que "vale". Não há o que mudar |
| revisor-geral (2ª) | Dizer na seção das mutações que o `ignorados.add(especificador.literal)` já tinha bloco na rodada 1, para não parecer que falta um | Recusada: nada fica descoberto, como o revisor mesmo conclui; é só leitura do documento |
| revisor-geral (2ª) | O `TODO.md` não tem as recomendações que a ordem mandou para lá, e não está alterado; registrar antes do commit | Já é item da ordem da rodada 1 (tabela abaixo): fica como pendência do Implementador, registrada na mensagem desta rodada |
| tenancy-guardian (1ª) | `filtros-casam.test.ts:47`: `EXCECOES_NOMINAIS` isenta `**/dist/**` e `**/node_modules/**`; se uma exceção nominal for parar no `files` de `guardas/tabela-so-no-repository` ou nas listas de `repositories-com-escopo.test.ts`, passa pela auditoria antes | Condicional: hoje nenhuma exceção nominal alcança guarda de tenant. Vale como cuidado de quem acrescentar exceção; a Mesa leva ao prompt do `tenancy-guardian` da rodada que mexer na lista |
| tenancy-guardian (1ª) | Nas próximas ondas, auditar o mapa que renomeie `escolaId`, `anoLetivoId`, `*.repository.ts`, `@SemEscopo` ou `REGRAS_DE_TENANT`: o `conferir` prova "só nome", e o `filtros-casam` rodando na onda prova que a guarda alcança os arquivos | Não é código desta tarefa. A Mesa leva ao prompt do `tenancy-guardian` em cada tarefa de onda que renomeie esses nomes |
| infra-guardian (1ª) | `restos.test.ts:244`: `timeout: 180_000` muito acima do tempo real (3,2 s); baixar para algo como 30 s | `mapas/` está vazia: o tempo da varredura com mapas aplicados ainda não existe. `TODO.md`, para ajustar na primeira onda que popular `tools/renomear/mapas/` |
| infra-guardian (1ª) | `conferir.ts:45`: `maxBuffer` de 1 GiB no `execFileSync('git', …)` folgado demais | Muda código de produção da ferramenta e o limite certo depende do tamanho da foto do repositório real. `TODO.md` |
| privacy-guardian (1ª) | Deixar dito na retro que o `filtros-casam.test.ts` protege a regra 20 (filtro de `log-sem-dado-pessoal`, `ESCOPO_DO_ERRO_TIPADO`, `paths:` de uma regra) | Retro da X8: é conteúdo da retrospectiva, não de código |
| conformidade-reviewer (1ª) | Dizer no procedimento de onda do `tasks.md` que a tarefa que renomear `Nota`, `lancadaPor`, `Correcao` ou teste citado em `Checagem:` da regra 70 atualiza no mesmo commit a regra 70 e `docs/regulacao.md` | `tasks.md` é documento do Arquiteto, fora desta tarefa. `TODO.md`, para o Arquiteto antes da primeira onda |
| conformidade-reviewer (1ª) | Nas ondas que renomearem `Nota`, `lancadaPor` ou `Nota.aprovar`, chamar o `conformidade-reviewer` de forma explícita | A Mesa confere a linha "Subagentes obrigatórios" de cada tarefa de onda e leva o assunto ao prompt dele; também vai para a retro |
| revisor-geral (1ª) | Pôr no `casos.md` as duas fontes a mais que a lista do §5 (`ARQUIVOS_DE_TESTE` e os `workspaces` do `package.json`) | `casos.md` é documento do Arquiteto, fora desta tarefa. `TODO.md` |
| revisor-geral (1ª) | `PADRAO` de `tools/processo/guardioes-por-caminho.ts:37` não é exportado e a trava não o confere | O próprio revisor: "Fica para quando alguém mexer nesse arquivo". `TODO.md` |
| revisor-geral (1ª) | `filtros-casam.test.ts:62` reimplementa `arquivosDoRepositorio()` de `guardas.test.ts`; mover a função para um módulo comum | Mexe em `guardas.test.ts`, que a tarefa não toca, e cria módulo novo. `TODO.md` |
| revisor-geral (1ª) | Sem mapa na pasta, o `restos` mostra "o reaplicar não tem o que aplicar" (vem de `lerTodosOsMapas`, em `reaplicar.ts:43`); trocar por mensagem neutra | Muda a mensagem de uma função que o `reaplicar` da 1.0 usa e já tem teste: é comportamento, não ajuste de comentário. `TODO.md` |
| revisor-geral (1ª) | `conferir.ts:112-116` troca o nome exportado só pelo `de` e ignora o `arquivo` da entrada; vermelho falso se dois pacotes exportam o mesmo nome e só um é renomeado | Muda o comportamento do `conferir` e só aparece numa onda real com nome homônimo. `TODO.md`, para a primeira onda que renomear um símbolo exportado por dois pacotes |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 05:45:09 | 2026-10-30 05:45:32 | `tenancy-guardian` | 1 | APROVADO | aae04c2be1e0b4aa8 |
| 2026-10-30 05:45:13 | 2026-10-30 05:45:39 | `infra-guardian` | 1 | APROVADO | aaee50bcf6054b4d8 |
| 2026-10-30 05:45:10 | 2026-10-30 05:45:49 | `privacy-guardian` | 1 | APROVADO | acdf0ee9f556c3229 |
| 2026-10-30 05:45:12 | 2026-10-30 05:45:52 | `conformidade-reviewer` | 1 | APROVADO | a2a849c9beaf69b07 |
| 2026-10-30 05:45:16 | 2026-10-30 05:47:16 | `revisor-geral` | 1 | APROVADO | a6b7499bf65cfab7d |
| 2026-10-30 05:45:15 | 2026-10-30 05:48:04 | `test-engineer` | 1 | REPROVADO | aaf2abc64d3c53212 |
| 2026-10-30 06:06:43 | 2026-10-30 06:07:14 | `revisor-geral` | 2 | APROVADO | a4897bf595dbc605e |
| 2026-10-30 06:06:39 | 2026-10-30 06:07:40 | `test-engineer` | 2 | APROVADO | a54bac05011bca62b |
