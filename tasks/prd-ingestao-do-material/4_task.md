# Tarefa 4.0 — Os capítulos lidos do PDF chegam no `GET /v1/materiais/:id`

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`
**Porte:** pequeno

## Objetivo

A extração grava o capítulo (número, título, páginas) de cada parte do PDF, lido do marcador de primeiro nível ou da
linha "Capítulo N" no topo da página, e o `GET /v1/materiais/:id` os devolve; sem capítulo, o material fica `pronto`.

## Contexto necessário

- `techspec.md` §3 (`capitulo_do_material`), §4 (`GET /:id` com `capitulos`), §5 "Capítulos", §12 (a premissa do `getOutline()`)
- `prd.md` RF4
- `cenarios.md` "Extração no worker e capítulos": as linhas do `ChapterReader` e da amostra fixa
- `.claude/rules/`: 10, 40, 60
- Código: o processador `apps/worker/src/processors/extrair-pdf.ts` e o `PdfExtractor` em `packages/core/src/material/`
  (da 1.0); `tools/demonstracao` (onde nascem os PDFs sintéticos)

## Subtarefas

- [x] 4.1 — Migration: `capitulo_do_material`, com a FK composta em cascata e os checks da §3; `docs/modelo-de-dados.md`
- [x] 4.2 — `ChapterReader` em `packages/core/src/material/`: o marcador de primeiro nível pelo `getOutline()`, um por página; sem marcador, a linha `^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)` no topo quando o número muda, fora do sumário; erro dá zero capítulos
- [x] 4.3 — Gravar na transação da extração, depois da transição; a amostra sintética em `tools/demonstracao`
- [x] 4.4 — `capitulos` no contrato de `GET /v1/materiais/:id` (`packages/shared/src/material/material.ts`), DTO explícito
- [x] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0051_*.sql`, `packages/core/src/db/schema/material.ts`, `packages/core/src/material/chapter-reader.ts`, `packages/core/src/material/chapter-reader.test.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts` | novo e alterado |
| `apps/worker/src/processors/extrair-pdf.ts`, `packages/shared/src/material/material.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material.service.ts`, `docs/modelo-de-dados.md` | alterado |
| `tools/demonstracao/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz com marcador | I | capítulos gravados e devolvidos em `GET /:id` | `apps/worker/test/extrair-pdf.int.test.ts › [I] caminho feliz com marcador`; `apps/api/test/material.int.test.ts › o PDF com marcador termina `pronto` e devolve os capítulos em `GET /:id`…` |
| PDF sem capítulo | I | `pronto`, com zero capítulos | `apps/worker/test/extrair-pdf.int.test.ts › [I] PDF sem capítulo…`; `apps/api/test/material.int.test.ts › PDF sem capítulo termina `pronto`, com zero capítulos…` |
| marcador de primeiro nível | U | vira capítulo; o de segundo nível não | `packages/core/src/material/chapter-reader.test.ts › cada marcador de primeiro nível vira um capítulo…`; `… › o marcador de segundo nível não vira capítulo…` |
| dois marcadores na mesma página | U | fica o primeiro | `packages/core/src/material/chapter-reader.test.ts › dois marcadores na mesma página: fica o primeiro…` |
| marcadores fora de ordem | U | ordenados | `packages/core/src/material/chapter-reader.test.ts › marcadores fora de ordem saem ordenados…` |
| título vazio | U | "Capítulo N" | `packages/core/src/material/chapter-reader.test.ts › título vazio vira "Capítulo N"…` |
| título de 300 caracteres | U | cortado em 200 | `packages/core/src/material/chapter-reader.test.ts › título de 300 caracteres é cortado em 200…` |
| número acima de int | U | nulo | `packages/core/src/material/chapter-reader.test.ts › o número do capítulo é o que o título escreve; acima do maior `int` fica nulo…`; `… › o número acima de `int` na linha fica nulo…` |
| linha "Capítulo 3" | U | só cria capítulo quando o número muda (cabeçalho corrido não cria um por página) | `packages/core/src/material/chapter-reader.test.ts › o cabeçalho corrido ("Capítulo 3" em toda página do capítulo) cria um capítulo só…` |
| sumário com três casamentos | U | a página é ignorada | `packages/core/src/material/chapter-reader.test.ts › a página com 3 linhas que casam… é sumário…`; `… › o sumário não muda o capítulo em curso…` |
| erro do leitor | U | zero capítulos, sem falhar | `packages/core/src/material/chapter-reader.test.ts › o erro do leitor (getOutline, getDestination, getPageIndex) dá zero capítulos…` |
| amostra fixa com o pdfjs de verdade | U | marcador, destino nomeado, linha, cabeçalho corrido, sumário e nada: 100% das páginas no capítulo certo | `packages/core/src/material/chapter-reader.test.ts › a amostra fixa, com o pdfjs de verdade…` (as seis, uma a uma) |
| [P] dois jobs da mesma extração | P | capítulos uma vez. Mutação: gravar antes da transição | `apps/worker/test/extrair-pdf.int.test.ts › [P] dois jobs da mesma extração em `Promise.all`…` |
| expurgo | I | o material expurgado leva os capítulos (cascata) | `apps/worker/test/extrair-pdf.int.test.ts › o material expurgado leva os capítulos dele em cascata…` (sobre a migration e sobre o banco migrado) |
| isolamento | I | `GET /:id` da B no contexto A: `NAO_ENCONTRADO`, sem capítulo | `apps/api/test/material.int.test.ts › isolamento: o material da B…`; `apps/worker/test/extrair-pdf.int.test.ts › o repository: `gravarCapitulos` … com o id da B no contexto da A…`; `… › a FK composta com a escola…` |
| permissão: aluno | I | recusado | `apps/api/test/material.int.test.ts › permissão: o aluno, o professor sem vínculo e o de outra disciplina…` |
| `contracts.test` | U | `capitulos` sem campo proibido | `apps/api/test/contracts.test.ts › ingestao-do-material 4.0…` |

## Como testar

- Extrator: `apps/api/src/material/pdf-extraction.test.ts` › "o material de demonstração vira seis trechos, um por página…" (já movido na 1.0): o mesmo arranjo com o pdfjs de verdade
- Leitor: unidade pura, com o `getOutline()` falso para as bordas e o PDF sintético para a amostra
- Rota: `apps/api/test/material.int.test.ts`, os casos de `GET /:id`
- Comandos: `npx vitest run --project unidade packages/core/src/material/chapter-reader.test.ts`; `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: o regex e o "quando o número muda" são cláusulas, cada uma com bloco; a premissa da §12 só se prova com a amostra

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 3: o cabeçalho
corrido é o segundo dado da linha "Capítulo N". Na 9: o `PdfExtractor` já lê o documento; o leitor reaproveita a
abertura.

## Fora do escopo desta tarefa

A tela do painel (12.0); habilidade por capítulo (F4b).

## Divergências resolvidas nesta tarefa

Nenhuma contradiz a Tech Spec: são decisões de detalhe que a §5 deixava abertas, já escritas na §5 "Capítulos" (e no `cenarios.md`, "Extração no worker e capítulos") antes dos revisores.

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| "Topo da página" são as 2 primeiras linhas, lidas antes de `tirarLinhasRepetidas`; sumário é a página com 3 casamentos ou mais em qualquer linha | a spec diz "no topo" e "fora do sumário" sem número; o cabeçalho corrido é o dado da linha, e a limpeza o tiraria | `techspec.md` §5, "Capítulos" (`LINHAS_DO_TOPO_DA_PAGINA`, `CASAMENTOS_QUE_FAZEM_UM_SUMARIO`); `cenarios.md`, "Extração no worker e capítulos" |
| O número do marcador é o do começo do título (a mesma regex da linha), nulo se não há; título vazio vira `Capítulo <ordem>` | a spec não diz de onde vem o número do marcador, e "Capítulo N" com título vazio não tem N | `techspec.md` §5, "Capítulos" |
| Marcador sem destino de página, ou fora do PDF, é pulado; sem nenhum que resolva, o leitor cai na linha | "sem marcador" precisa de definição quando o marcador existe e não aponta página | `techspec.md` §5, "Capítulos" |
| Mais de 2.000 capítulos dá zero capítulos (`MAXIMO_DE_CAPITULOS_POR_MATERIAL`) | um marcador por página de um PDF grande estouraria a coluna `ordem` (`smallint`) e faria a transação da extração falhar | `techspec.md` §5, "Capítulos"; `cenarios.md`, "Extração no worker e capítulos" |
| `GET /:id` ganha o esquema `materialComCapitulosResponseSchema`; `materialResponseSchema` segue sendo o do `POST` e o da lista | a §4 diz "o de cima + `capitulos`" só na rota `:id`, e o esquema é estrito | `techspec.md` §4 (tabela de rotas, `GET /:id`) |
| `tools/guardas/tabelas-do-nucleo.mjs` ganha `capituloDoMaterial` | a guarda `tabela-so-no-repository` lê essa lista, e o teste dela exige toda tabela que o núcleo exporta; o arquivo não estava nos previstos | `techspec.md` §3 (a tabela `capitulo_do_material`) |

## Mutações

--faltando: 21 linhas (69 blocos, 7 motivos)

Um bloco por cláusula do leitor (cada termo da regex e das condições), da gravação, da leitura e do contrato, mais as restrições da migration `0051`, que o teste do worker aplica num esquema de teste (o banco de teste já está migrado, e mutar o `.sql` só muda o que o teste lê).

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › qualquer caixa
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número só conta no começo
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número só conta no começo
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s*(\d+)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › qualquer caixa
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(capítulo|unidade|m[óo]dulo)\s+(\d+)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › qualquer caixa
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|módulo)\s+(\d+)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › qualquer caixa
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(cap[ií]tulo|m[óo]dulo)\s+(\d+)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número do capítulo é o que o título escreve
-const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i
+const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d)/i
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › sem marcador e sem linha
-return digitos === undefined ? undefined : BigInt(digitos)
+return digitos === undefined ? 0n : BigInt(digitos)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número do capítulo é o que o título escreve
-const digitos = LINHA_DE_CAPITULO.exec(linha)?.[2]
+const digitos = LINHA_DE_CAPITULO.exec(linha)?.[1]
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número do capítulo é o que o título escreve
-return numero === undefined || numero > MAIOR_INTEIRO ? null : Number(numero)
+return numero === undefined || numero >= MAIOR_INTEIRO ? null : Number(numero)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o número do capítulo é o que o título escreve
-return numero === undefined || numero > MAIOR_INTEIRO ? null : Number(numero)
+return numero > MAIOR_INTEIRO ? null : Number(numero)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › com marcador, a linha do topo não é lida
-const inicios = doMarcador.length > 0 ? doMarcador : this.#daLinha(linhasPorPagina)
+const inicios = this.#daLinha(linhasPorPagina)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › cai na linha do topo
-const inicios = doMarcador.length > 0 ? doMarcador : this.#daLinha(linhasPorPagina)
+const inicios = doMarcador
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › pela linha do topo, mais de 2000 capítulos também dão zero
-if (inicios.length > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return []
+if (inicios.length >= MAXIMO_DE_CAPITULOS_POR_MATERIAL) return []
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › mais de 2000 capítulos
-if (inicios.length > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return []
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › a última página do PDF ainda é página de capítulo
-return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
+return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total) - 1))
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › cada marcador de primeiro nível vira um capítulo
-return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
+return inicios.map((inicio, indice) => this.#capitulo(inicio, indice, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › cada marcador de primeiro nível vira um capítulo
-return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
+return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1)))
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o erro do leitor
 return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
-} catch {
-return []
-}
+} catch (erro) {
+throw erro
+}
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › título vazio vira
-titulo: titulo === '' ? `Capítulo ${String(ordem)}` : titulo,
+titulo,
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › título de 300 caracteres
-const titulo = limparLinha(inicio.titulo).slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO).trimEnd()
+const titulo = limparLinha(inicio.titulo).slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › título de 300 caracteres
-const titulo = limparLinha(inicio.titulo).slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO).trimEnd()
+const titulo = limparLinha(inicio.titulo).trimEnd()
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o título sai limpo
-const titulo = limparLinha(inicio.titulo).slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO).trimEnd()
+const titulo = inicio.titulo.slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO).trimEnd()
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › marcador que não resolve nenhuma página, ou outline nulo
-if (arvore === null) return []
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › destino que não é página
-if (pagina === undefined || pagina < 1 || pagina > total) continue
+if (pagina < 1 || pagina > total) continue
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › a página fora do PDF não vira capítulo
-if (pagina === undefined || pagina < 1 || pagina > total) continue
+if (pagina === undefined || pagina > total) continue
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › a página fora do PDF não vira capítulo
-if (pagina === undefined || pagina < 1 || pagina > total) continue
+if (pagina === undefined || pagina < 1) continue
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › marcadores fora de ordem
-achados.sort((a, b) => a.pagina - b.pagina)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › dois marcadores na mesma página
-return achados.filter((achado, indice) => achado.pagina !== achados[indice - 1]?.pagina)
+return achados
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o destino nomeado é resolvido pelo documento
-const resolvido = typeof destino === 'string' ? await documento.getDestination(destino) : destino
+const resolvido = destino
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › destino que não é página
-if (!Array.isArray(resolvido)) return undefined
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › destino que não é página
-if (typeof referencia !== 'object' || referencia === null) return undefined
+if (referencia === null) return undefined
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › destino que não é página
-if (typeof referencia !== 'object' || referencia === null) return undefined
+if (typeof referencia !== 'object') return undefined
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › cada marcador de primeiro nível vira um capítulo
-return (await documento.getPageIndex(referencia as never)) + 1
+return await documento.getPageIndex(referencia as never)
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › é sumário e não começa capítulo
-if (linhas.filter((linha) => numeroDaLinha(linha) !== undefined).length >= CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
+if (linhas.filter((linha) => numeroDaLinha(linha) !== undefined).length > CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › é sumário e não começa capítulo
-if (linhas.filter((linha) => numeroDaLinha(linha) !== undefined).length >= CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › é sumário e não começa capítulo
-if (linhas.filter((linha) => numeroDaLinha(linha) !== undefined).length >= CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
+if (linhas.slice(0, LINHAS_DO_TOPO_DA_PAGINA).filter((linha) => numeroDaLinha(linha) !== undefined).length >= CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › primeiras linhas contam como topo
 const achada = linhas
-.slice(0, LINHAS_DO_TOPO_DA_PAGINA)
+.slice(0, LINHAS_DO_TOPO_DA_PAGINA + 1)
 .map((linha) => ({ linha, numero: numeroDaLinha(linha) }))
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › primeiras linhas contam como topo
 const achada = linhas
-.slice(0, LINHAS_DO_TOPO_DA_PAGINA)
 .map((linha) => ({ linha, numero: numeroDaLinha(linha) }))
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › cria um capítulo só
-if (achada?.numero === undefined || achada.numero === ultimo) return
+if (achada?.numero === undefined) return
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › primeiras linhas contam como topo
 .map((linha) => ({ linha, numero: numeroDaLinha(linha) }))
-.find(({ numero }) => numero !== undefined)
+.find(() => true)
 if (achada?.numero === undefined || achada.numero === ultimo) return
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › acima do teto, o leitor para
-if (paginasDistintas.size > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
+
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › acima do teto, o leitor para
-paginasDistintas.add(pagina)
+
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › no teto, ficam todos
-if (paginasDistintas.size > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
+if (paginasDistintas.size >= MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › o teto conta páginas distintas
-if (paginasDistintas.size > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
+if (achados.length > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
```

```mutacao
arquivo: packages/core/src/material/chapter-reader.ts
teste: packages/core/src/material/chapter-reader.test.ts › acima do teto de marcadores, o leitor não cai na linha
-if (doMarcador === ACIMA_DO_TETO) return []
+
```

```mutacao
arquivo: packages/core/src/material/limpar-linha.ts
teste: packages/core/src/material/chapter-reader.test.ts › o título sai limpo
-const CONTROLE = /[\u0000-\u0008\u000B-\u001F\u007F]/g
+const CONTROLE = /[\u0001-\u0008\u000B-\u001F\u007F]/g
```

```mutacao
arquivo: packages/core/src/material/limpar-linha.ts
teste: packages/core/src/material/chapter-reader.test.ts › o título sai limpo
-export const limparLinha = (linha: string): string => linha.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim()
+export const limparLinha = (linha: string): string => linha.replace(CONTROLE, ' ').trim()
```

```mutacao
arquivo: packages/core/src/material/limpar-linha.ts
teste: packages/core/src/material/chapter-reader.test.ts › o título sai limpo
-export const limparLinha = (linha: string): string => linha.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim()
+export const limparLinha = (linha: string): string => linha.replace(CONTROLE, ' ').replace(/\s+/g, ' ')
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/chapter-reader.test.ts › 100% das páginas no capítulo certo
-return { falha: null, paginas: linhasPorPagina.length, trechos, capitulos: await this.#capitulos.ler(pdf, linhasPorPagina) }
+return { falha: null, paginas: linhasPorPagina.length, trechos, capitulos: [] }
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/chapter-reader.test.ts › o cabeçalho corrido some do trecho
-return { falha: null, paginas: linhasPorPagina.length, trechos, capitulos: await this.#capitulos.ler(pdf, linhasPorPagina) }
+return { falha: null, paginas: linhasPorPagina.length, trechos, capitulos: await this.#capitulos.ler(pdf, tirarLinhasRepetidas(linhasPorPagina)) }
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › PDF sem capítulo
-if (capitulos.length === 0) return
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › caminho feliz com marcador
-await this.banco.insert(capituloDoMaterial).values(capitulos.map(({ ordem, numero, titulo, paginaInicial, paginaFinal }) => ({ escolaId, materialId, ordem, numero, titulo, paginaInicial, paginaFinal })))
+await this.banco.insert(capituloDoMaterial).values(capitulos.map(({ ordem, numero, titulo, paginaInicial, paginaFinal }) => ({ materialId, ordem, numero, titulo, paginaInicial, paginaFinal })))
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › caminho feliz com marcador
 await materiais.gravarTrechos(materialId, disciplinaId, resultado.trechos)
-await materiais.gravarCapitulos(materialId, resultado.capitulos)
 return true
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › dois jobs da mesma extração
 const materiais = new ExtracaoDoMaterialRepository(tx)
+await materiais.gravarCapitulos(materialId, resultado.capitulos)
 const disciplinaId = await materiais.marcarPronto(materialId, resultado.paginas)
 // Excluído, ou já extraído por outro job, enquanto era lido: nenhum trecho entra, e o objeto é de quem mudou a linha.
 if (disciplinaId === undefined) return false
 await materiais.gravarTrechos(materialId, disciplinaId, resultado.trechos)
-await materiais.gravarCapitulos(materialId, resultado.capitulos)
 return true
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts › isolamento: o material da B
-.where(and(eq(capituloDoMaterial.escolaId, requireEscolaId()), eq(capituloDoMaterial.materialId, materialId)))
+.where(eq(capituloDoMaterial.materialId, materialId))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts › e devolve os capítulos em
-.where(and(eq(capituloDoMaterial.escolaId, requireEscolaId()), eq(capituloDoMaterial.materialId, materialId)))
+.where(eq(capituloDoMaterial.escolaId, requireEscolaId()))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts › e devolve os capítulos em
-.orderBy(asc(capituloDoMaterial.ordem))
+.orderBy(desc(capituloDoMaterial.ordem))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › e devolve os capítulos em
-return materialComCapitulosResponseSchema.parse({ ...daLinhaParaOContrato(lido, alcance), capitulos: await materiais.capitulos(id) })
+return materialComCapitulosResponseSchema.parse({ ...daLinhaParaOContrato(lido, alcance), capitulos: [] })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o licenciante é da coordenação
-return { ...lido, licenciante: alcance === 'unidade' ? lido.licenciante : null, enviadoEm: lido.enviadoEm.toISOString() }
+return { ...lido, licenciante: lido.licenciante, enviadoEm: lido.enviadoEm.toISOString() }
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: apps/api/test/contracts.test.ts › ingestao-do-material 4.0
-export const capituloDoMaterialSchema = z.strictObject({
+export const capituloDoMaterialSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: apps/api/test/contracts.test.ts › ingestao-do-material 4.0
-titulo: z.string().min(1).max(TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO),
+titulo: z.string().min(1),
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › a ordem é única por material
-CONSTRAINT "capitulo_do_material_ordem_unica" UNIQUE("escola_id","material_id","ordem"),
+CONSTRAINT "capitulo_do_material_ordem_unica" UNIQUE("escola_id","ordem"),
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › o título vazio e o de 201
-CONSTRAINT "capitulo_do_material_titulo_preenchido" CHECK (char_length("capitulo_do_material"."titulo") between 1 and 200),
+CONSTRAINT "capitulo_do_material_titulo_preenchido" CHECK (char_length("capitulo_do_material"."titulo") between 0 and 200),
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › o título vazio e o de 201
-CONSTRAINT "capitulo_do_material_titulo_preenchido" CHECK (char_length("capitulo_do_material"."titulo") between 1 and 200),
+CONSTRAINT "capitulo_do_material_titulo_preenchido" CHECK (char_length("capitulo_do_material"."titulo") between 1 and 201),
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › guarda o capítulo sem número
-CONSTRAINT "capitulo_do_material_paginas_validas" CHECK ("capitulo_do_material"."pagina_final" >= "capitulo_do_material"."pagina_inicial")
+CONSTRAINT "capitulo_do_material_paginas_validas" CHECK ("capitulo_do_material"."pagina_final" > "capitulo_do_material"."pagina_inicial")
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › a página final antes da inicial
-CONSTRAINT "capitulo_do_material_paginas_validas" CHECK ("capitulo_do_material"."pagina_final" >= "capitulo_do_material"."pagina_inicial")
+CONSTRAINT "capitulo_do_material_paginas_validas" CHECK (true)
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › a FK composta com a escola
-ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;
+ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_da_escola_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE cascade ON UPDATE no action;
```

```mutacao
arquivo: packages/core/drizzle/0051_capitulo_do_material.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › o material expurgado leva os capítulos
-ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;
+ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE no action ON UPDATE no action;
```

**Sem bloco, com o motivo:**

- `tools/demonstracao/amostra-de-capitulos.ts` (todas as linhas): gerador dos PDFs de teste; cada ramo (marcador direto e nomeado, filho de segundo nível, `/Prev` e `/Next`) é exercido pelas seis amostras, e o resultado errado derruba o "100% das páginas no capítulo certo" (`chapter-reader.test.ts`); mutar o gerador é mutar o teste.
- O marcador de segundo nível não vira capítulo: é ausência de código (`#doMarcador` lê só a lista de primeiro nível); a amostra real tem um filho na página 2, que criaria um capítulo se fosse lido, e o caso com `items` o prova com o falso.
- `packages/core/src/db/schema/material.ts` (`capituloDoMaterial`: o `unique`, os `check`, a FK): descreve o que a migration `0051` cria; mutar o TypeScript não muda o banco de teste, e as restrições são provadas pelos blocos sobre o `.sql`.
- A FK `capitulo_do_material_escola_id_escola_id_fk` (`.sql`): redundante com a FK composta, que já recusa escola sem material dela; a regra 10, item 1, a pede e o schema a declara por `references()`.
- `packages/shared/src/material/material.ts`, `ordem`, `numero`, `paginaInicial` e `paginaFinal` (`min`, `nonnegative`): espelham as colunas, e o dado sai do banco; nenhum caso as alcança sem inventar linha que o banco recusa.
- `apps/worker/src/processors/extrair-pdf.ts` (`capitulosTotal` no log): é uma contagem sem condição; o caso de log da rota continua provando que a linha só leva ids e contagens.
- `extracao.repository.ts` (`const escolaId = requireEscolaId()`): sem escola no contexto a chamada lança antes de gravar, como as outras do repository (caso "sem escola no contexto" da 1.0).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Tornar `MaterialRepository.capitulos(materialId)` privado ao fluxo de `ler`, ou fazê-lo receber o resultado de `porId` | Recusada. Muda a assinatura de um método do repository (contrato interno), e o escopo da escola já vem do contexto e tem teste de isolamento que quebra sem a cláusula; o recorte por disciplina está no `porId` que `ler` chama antes, com o aviso no comentário do método. Se um segundo chamador aparecer, a tarefa dele decide |
| conformidade-reviewer (1ª) | Escrever no PRD da F4b que a ligação habilidade-capítulo, se feita por IA, nasce pendente com aprovação registrada (regra 70, item 3) e entra na auditoria (item 6) | `TODO.md`, para o Arquiteto levar ao PRD da F4b. Não é desta tarefa |
| revisor-geral (1ª) | O `db:gerar` precisa de dono antes da próxima migration (glob pega um `.test.ts`; a `0051` saiu de uma configuração temporária) | `TODO.md`, onde a pendência já está registrada (item "`npm run db:gerar` quebra", 4.0). Dono: a decisão é do Orquestrador, antes da tarefa 5.0, que traz a próxima migration |
| test-engineer (1ª) | Um caso em `apps/worker/test/expurgo.int.test.ts` com material excluído que tenha capítulos (a cascata hoje é provada por `delete from material` direto) | `TODO.md`. O arquivo não é da tarefa, e a cascata no banco está provada; o caso entra com a tarefa que mexer no expurgo do material |
| tenancy-guardian (2ª) | Um comentário em `apps/api/test/material.int.test.ts:115-117` dizendo que só o teste de isolamento chama `MaterialRepository.capitulos` direto, para não virar padrão | `TODO.md`, baixa prioridade; é comentário de teste e não muda nada do que o revisor aprovou |
| revisor-geral (2ª) | Tirar a terceira linha do comentário de `material.service.ts:251-253` ("validada uma vez só"), que repete o código | Recusada: não muda comportamento nem contrato, e mexer no arquivo de produção de novo caduca os seis revisores por uma linha de comentário. Sai com a próxima tarefa que tocar o `ler` |
| revisor-geral (2ª) | Renomear `daLinhaParaOContrato` (não diz que o resultado ainda não foi validado) | `TODO.md`; o JSDoc já diz, e renomear é mudança em produção sem ganho de comportamento |
| privacy-guardian (2ª) | Um caso em `apps/api/test/contracts.test.ts` que recuse campo a mais no nível do material (`materialComCapitulosResponseSchema.safeParse({ ...valido, sha256: 'x' })` dá `false`), para uma troca de versão do zod não abrir o contrato | `TODO.md`, para quem mexer em `contracts.test.ts` na próxima tarefa do material (5.0 traz licença e contrato novo) |
| privacy-guardian (2ª) | O caso de expurgo com capítulos | Já está no `TODO.md` (rodada 1) |
| test-engineer (2ª) | Um caso pequeno em `packages/core/src/material/chapter-reader.test.ts` que prenda o limite documentado: "Unidade 2" corrido na linha 1 e "Capítulo 5" na linha 2 perdem os capítulos | `TODO.md`; o limite está escrito em `techspec.md` e `cenarios.md` e o comportamento não mudou na tarefa. O caso entra com quem decidir mudar a leitura do topo |
| test-engineer (2ª) | Listar na tabela "Testes que provam a regra" do `4_task.md` as linhas "mais de 2.000 capítulos dá zero" e "só as 2 primeiras linhas são o topo", com os casos `:176`, `:183`, `:189`, `:205`, `:212`, `:273` | Fica para o Validador: os testes existem e os blocos de mutação os citam; é ajuste do documento, e o Validador confere RF a RF pelo código, não pela tabela |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-12 20:36:56 | 2026-11-12 20:37:24 | `tenancy-guardian` | 1 | APROVADO | abce32268633580c3 |
| 2026-11-12 20:37:11 | 2026-11-12 20:37:38 | `conformidade-reviewer` | 1 | APROVADO | a234c2dbeb34fdd2f |
| 2026-11-12 20:37:08 | 2026-11-12 20:38:05 | `privacy-guardian` | 1 | APROVADO | aab6a7b69af07cf61 |
| 2026-11-12 20:37:12 | 2026-11-12 20:38:07 | `infra-guardian` | 1 | APROVADO | a52ff117540ab6769 |
| 2026-11-12 20:37:04 | 2026-11-12 20:38:32 | `revisor-geral` | 1 | APROVADO | a3ff80c0936339c93 |
| 2026-11-12 20:37:00 | 2026-11-12 20:39:31 | `test-engineer` | 1 | APROVADO | a9926317f2362c7ef |
| 2026-11-12 21:02:49 | 2026-11-12 21:03:11 | `tenancy-guardian` | 2 | APROVADO | a52e46708eed3573e |
| 2026-11-12 21:03:06 | 2026-11-12 21:03:30 | `revisor-geral` | 2 | APROVADO | a5294a13858f7d1a9 |
| 2026-11-12 21:03:23 | 2026-11-12 21:03:44 | `conformidade-reviewer` | 2 | APROVADO | aa7636174aedebe3e |
| 2026-11-12 21:03:15 | 2026-11-12 21:03:47 | `privacy-guardian` | 2 | APROVADO | a9b02009219df6fd5 |
| 2026-11-12 21:03:32 | 2026-11-12 21:03:55 | `infra-guardian` | 2 | APROVADO | ac55ac23fa52ecdd0 |
| 2026-11-12 21:02:59 | 2026-11-12 21:04:41 | `test-engineer` | 2 | APROVADO | ae377713254ec74ec |
