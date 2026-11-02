# Correção — o `reaplicar` troca o símbolo na árvore inteira, sem o filtro do `arquivo`, e o passo 5 corromperia documento

**Origem:** `tasks/prd-nomes-de-mercado/13_task.md` ("Divergências resolvidas" e "Recomendações sem aplicar", privacy-guardian 1ª e 2ª, revisor-geral 1ª) e `.processo/divergencia-13-onca.md`, achado 1.
**Subagentes obrigatórios:** `test-engineer`, `privacy-guardian`, `revisor-geral`
<!-- O `privacy-guardian` veio no PEDIDO do Orquestrador. O `test-engineer` é de toda correção. O `revisor-geral` entra porque a correção altera mais de 5 arquivos fora de `tasks/` (passo 5 de `corrigir`). -->

## Sintoma

`node tools/renomear/reaplicar.ts`, rodado com o `13.json` na árvore da 13.0, reescreveu 182 arquivos de código. A entrada `portao` →
`gate` da 11.0 (declarada em `e2e/support/…`) trocou o `portao` de `tools/processo/hook-revisoes.ts` (`import { gate } from './revisoes.ts'`,
que exporta `portao`) e derrubou o hook do Bash. Nos documentos, o passo 5 trocaria `portao` em `` `portao-local.ts` `` e `com` em
`` `example.com` ``, por estarem entre crases. A 13.0 desfez tudo com `git checkout` e aplicou o passo 5 nos documentos com um script
fora do repositório.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Três falhas do `reaplicar` (tarefas 3.0 a 11.0 da X8, achadas na 13.0), todas por ele ser uma busca de identificador e de texto sem
saber onde cada nome vive:

1. **`renomearPelaSintaxe` ignorava o `arquivo` da entrada.** Trocava todo identificador com o nome antigo na árvore inteira (o
   comentário do arquivo até dizia que o `arquivo` não filtra). O `portao` de `e2e/` e o `portao` de `tools/processo/` são homônimos; o
   mesmo vale para o `Aparencia` do tema e o do componente. O serviço de linguagem (`aplicar`) resolve isso pelo símbolo; sem ele, o
   `reaplicar` precisa de um filtro por arquivo.
2. **O `reaplicar` não conhecia o que as ondas decidiram manter.** O `fica` do mapa (o nome que a onda deixou, como o `Estado` do
   `Governanca.test.tsx`) e a troca à mão registrada no `<N>.relatorio.md` valem para o `restos`, mas o `reaplicar` os trocava de novo.
   Rodado na árvore real, depois do filtro por arquivo, ainda mudava 49 arquivos.
3. **O passo 5 trocava a palavra comum entre crases mesmo quando ela era parte de outro nome:** `portao-local.ts`, `portao.ts`,
   `example.com`; e a forma do caminho sem extensão (`apps/web/src/estilos`, de `estilos.css`) pegava `estilos.test.ts`. O pareamento
   das crases por linha também erra quando um comentário abre a crase numa linha e a fecha na seguinte: limite que ficou (ver
   "Recomendações"), porque o `fica` e a troca à mão cobrem o caso real.

E o `ehDocumentoVivo` não incluía os README de `packages/` e `apps/` (privacy-guardian, 2ª rodada da 13.0). Ao incluí-los, o `restos`
achou o serviço `migrar` do compose citado no `README.md` da raiz, que é nome que fica (classificado no `13.json`).

## Teste que reproduz

`tools/renomear/reaplicar.test.ts` (o `restos.test.ts` leva o do README). Vermelho antes, verde depois:

- `o filtro do arquivo da entrada › o homônimo de outra pasta, que não importa da entrada, fica: o portao de tools/processo não vira gate`
  (o caso do incidente: `e2e/` contra `tools/processo/`);
- `… › no pacote da entrada, o homônimo declarado em outro arquivo e quem o importa ficam; o barrel que reexporta a entrada e quem o usa mudam`;
- `… › o homônimo de um arquivo que importa de outro lugar do mesmo pacote de uso fica, e o que importa da entrada muda` e
  `… › no pacote da entrada, o arquivo vizinho que usa o nome antigo muda; o import relativo de fora do pacote também` (o segundo é guarda:
  já passava);
- `… › o pacote já renomeado por uma onda seguinte: o import do nome antigo do pacote ainda leva o símbolo` (guarda do filtro por nome);
- `o que a onda classificou fica não se troca…`, `a troca à mão que o relatório da onda registrou fica no documento…`,
  `o passo 5 nos documentos: o nome de arquivo e o domínio entre crases ficam…`, `o caminho sem extensão não leva o nome de outro arquivo…`
  e `o README de código entra como documento vivo`;
- (rodada 1, `test-engineer`) `… › o arquivo que importa outro nome do módulo da entrada e tem um homônimo local fica…`,
  `… › o arquivo da própria entrada, com o nome antigo que o merge trouxe, muda mesmo sem importar nada`,
  `… › o que a onda classificou fica não se troca no comentário de código…` e `… › a troca à mão que o relatório registrou fica no comentário de código…`;
- `restos.test.ts › o README fora de docs/ é documento vivo, e o nome de arquivo com a palavra comum não é resto`.

Além do teste: o `reaplicar` rodado numa cópia da árvore real (as 11 ondas aplicadas) mudava 182 arquivos antes e **0** depois (49 só
com o filtro por arquivo). O caso entrou no `casos.md`, seção `reaplicar (1.0)`.

## Correção

- `tools/renomear/sintaxe.ts`: `alcanceDaEntrada` calcula, para a entrada com `arquivo`, as pastas de pacote (onde a onda a viu e onde as
  ondas seguintes a deixaram), os nomes do pacote (o de hoje e os `de` das entradas `pacote` que levam a ele) e os arquivos declarantes.
  `renomearPelaSintaxe` só entra no arquivo da entrada e no que importa o nome de lá (o arquivo, um barrel do pacote que não declara o
  nome antigo, ou o nome do pacote); o homônimo declarado em outro arquivo fica, e quem o importa também. Recebe o `ficaEm` e não troca
  o que a onda classificou `fica`. Entrada sem `arquivo` (o membro `com`) continua sem filtro.
- `tools/renomear/reaplicar.ts`: calcula o alcance e o `ficaEm` por entrada e passa ao passo 5 também a troca à mão registrada
  (`registradasDasOndas`, movida do `restos`); `tools/renomear/registradas.ts` guarda a leitura do relatório, e o `restos` a reexporta.
- `tools/renomear/texto.ts`: o passo 5 ignora a palavra comum que é pedaço de outro nome (hífen, extensão de arquivo, fim de domínio) e
  respeita o `fica` e a troca à mão por linha e por comentário; a forma sem extensão do caminho não leva `estilos.test.ts`; o
  `README.md` de qualquer pasta (menos o protótipo, o ouro e `tasks/`) é documento vivo.
- `tools/renomear/mapas/13.json`: o `README.md` cita o serviço `migrar` do compose (nome que fica, `inventario-core-shared.md:228`).
- `tasks/prd-nomes-de-mercado/casos.md`: os casos novos da seção `reaplicar (1.0)`.
- `tasks/prd-nomes-de-mercado/techspec.md` (rodada 2, `revisor-geral`): a §5 passa a registrar o que a correção mudou: o `README.md` de
  qualquer pasta como documento vivo; a palavra comum que é pedaço de outro nome entre crases, com o limite declarado (a regra é a
  forma, não o sentido: `` `x.Palavra` `` sem `(` é lido como fim de domínio); o alcance por `arquivo`, o `fica` e a troca à mão
  registrada no parágrafo do `reaplicar`; o parágrafo da 13.0 deixa de dizer que o `reaplicar` troca na árvore inteira; e a exceção ao
  "o mapa de onda feita não se reescreve" para o `13.json`, com o motivo (o `README.md` só entrou no `restos` nesta correção). O
  `migrar` fica classificado no `13.json`, o mapa da onda que leva os documentos.
- Limpezas pedidas pelo `revisor-geral`: a reexportação de `trocaAMaoRegistrada` sai do `restos.ts` (o teste importa de `registradas.ts`),
  `usosNoTexto` parte o arquivo em linhas uma vez, a linha em branco dupla e o comentário de bloco duplicado saem.

## Mutações

Código de `tools/` não exige o bloco (RF17 é de `apps/*/src` e `packages/*/src`); os blocos cobrem as cláusulas que a correção acrescenta.

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o homônimo de outra pasta, que não importa da entrada, fica: o portao de tools/processo não vira gate
-  return alcance === undefined || alcance.arquivos.has(caminho) || importaDoAlcance(arvore, caminho, texto, entrada, alcance)
+  return true
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › no pacote da entrada, o homônimo declarado em outro arquivo e quem o importa ficam; o barrel que reexporta a entrada e quem o usa mudam
-  return texto !== undefined && declaracoesDeTopo(analisar(alvo, texto).statements, entrada.de, entrada.para).length === 0
+  return texto !== undefined
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o pacote já renomeado por uma onda seguinte: o import do nome antigo do pacote ainda leva o símbolo
-  for (const outra of dePacote) if (nomes.has(nomeDoPacote(outra.para))) nomes.add(nomeDoPacote(outra.de))
+  for (const outra of dePacote) if (nomes.has(nomeDoPacote(outra.para))) nomes.add(nomeDoPacote(outra.para))
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o que a onda classificou fica não se troca: nem no identificador do arquivo, nem na linha do documento
-  if (novo !== undefined && !(ficaEm?.(caminho, entrada.de, aparar(linhas[linhaDe(fonte, no.getStart(fonte)) - 1] ?? '')) ?? false)) trocas.push({ inicio: no.getStart(fonte), comprimento: no.getWidth(fonte), novo })
+  if (novo !== undefined) trocas.push({ inicio: no.getStart(fonte), comprimento: no.getWidth(fonte), novo })
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › a troca à mão que o relatório da onda registrou fica no documento, e o resto do arquivo muda
-  const deixaNoTexto: FicaEm = (arquivo, de, trecho) => ficaEm(arquivo, de, trecho) || registradas.has(`${arquivo}\u0000${de}`)
+  const deixaNoTexto: FicaEm = (arquivo, de, trecho) => ficaEm(arquivo, de, trecho)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/reaplicar.test.ts › o passo 5 nos documentos: o nome de arquivo e o domínio entre crases ficam, o identificador e o membro mudam
-  if (entrada.comum && dentro && ehPedacoDeOutroNome(texto, achado.index, achado[0].length)) continue
+  if (entrada.comum && dentro && false) continue
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/reaplicar.test.ts › o README de código entra como documento vivo
-  caminho.endsWith('.md') && !foraDoPasso5(caminho) && (caminho === 'CLAUDE.md' || caminho.startsWith('.claude/') || caminho.startsWith('docs/') || caminho.split('/').at(-1) === 'README.md')
+  caminho.endsWith('.md') && !foraDoPasso5(caminho) && (caminho === 'CLAUDE.md' || caminho.startsWith('.claude/') || caminho.startsWith('docs/'))
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/reaplicar.test.ts › o caminho sem extensão não leva o nome de outro arquivo: estilos.css vira index.css e estilos.test.ts fica
-  new RegExp(`(?<![\\w@.-])${escaparRegex(forma)}(?![\\w-]${semOutraExtensao ? '|\\.\\w' : ''})`, 'g')
+  new RegExp(`(?<![\\w@.-])${escaparRegex(forma)}(?![\\w-])`, 'g')
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o arquivo que importa outro nome do módulo da entrada e tem um homônimo local fica: o import de FakeAdapter não traz o Banco
-    return ts.isNamespaceImport(ligacoes) || ligacoes.elements.some((elemento) => (elemento.propertyName ?? elemento.name).text === de)
+    return true
```

```mutacao
arquivo: tools/renomear/sintaxe.ts
teste: tools/renomear/reaplicar.test.ts › o arquivo da própria entrada, com o nome antigo que o merge trouxe, muda mesmo sem importar nada
-  return alcance === undefined || alcance.arquivos.has(caminho) || importaDoAlcance(arvore, caminho, texto, entrada, alcance)
+  return alcance === undefined || importaDoAlcance(arvore, caminho, texto, entrada, alcance)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/reaplicar.test.ts › o que a onda classificou fica não se troca no comentário de código: o comentário vizinho do mesmo arquivo muda
-    const vale = semOsQueFicam(ficaEm, caminho, texto.slice(inicio, fim), entradas, simbolos)
+    const vale = semOsQueFicam(undefined, caminho, texto.slice(inicio, fim), entradas, simbolos)
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › a troca à mão que o relatório registrou fica no comentário de código, e o outro nome, no comentário vizinho, muda
-  const deixaNoTexto: FicaEm = (arquivo, de, trecho) => ficaEm(arquivo, de, trecho) || registradas.has(`${arquivo}\u0000${de}`)
+  const deixaNoTexto: FicaEm = (arquivo, de, trecho) => ficaEm(arquivo, de, trecho)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| (própria) | O pareamento das crases por linha erra quando um comentário abre a crase numa linha e a fecha na seguinte | Limite declarado (item 3 da Causa): o `fica` e a troca à mão cobrem os casos da árvore, e consertar o pareamento mexe no `aplicar` de todas as ondas. Fica para a retro |
| `test-engineer` 1ª | `semOsQueFicam` tira a entrada da unidade inteira: num JSDoc de várias linhas, uma ocorrência `fica` segura todas as outras do mesmo nome no comentário | Limite declarado: o `fica` é por comentário (e por linha no documento), não por ocorrência. Os comentários da árvore real são de uma ou poucas linhas, e o `restos` cobra o que sobrar |
| `test-engineer` 1ª | O `fica` de identificador com `trecho` (duas linhas no mesmo arquivo), o barrel por `index.ts` e o especificador `.js`, e o `mockups/README.md` continuando fora | Guardas sem cláusula nova que dependa delas: ficam para a retro |
| `test-engineer` 1ª | A segunda metade do teste do `restos` (`tools/Fila-local.ts` e `example.com` não são resto) pode já passar antes | É guarda, como a do filtro por nome da primeira lista do "Teste que reproduz" |
| (própria) | `Arvore` só enxerga arquivo no índice do git (achado 2 de `.processo/divergencia-13-onca.md`) | Fora desta correção; o `restos` e o `reaplicar` só valem depois do `git add` |
| `revisor-geral` 2ª | Na `techspec.md`, o passo 5 lista como exceção do `README.md` o do protótipo, o do ouro e os de `tasks/`; o `foraDoPasso5` tira também `tools/renomear/` e `.claude/worktrees/` | Retro da X8: a lista da Tech Spec fica incompleta, mas o código (`foraDoPasso5`) é quem decide e está testado |
| `revisor-geral` 2ª | O `casos.md` não registra o limite declarado: o membro citado sem chamada (`` `Modulo.membro` ``, `{@link Modulo.membro}`) fica sem troca e sem aviso | Retro da X8: o limite já está declarado na §5 da Tech Spec; o caso entra se a retro pedir |
| `test-engineer` 2ª | A troca à mão ignora a linha: `deixaNoTexto` (`reaplicar.ts`) usa `registradas.has(arquivo + nome)` e não lê a coluna "Linhas"; um segundo comentário com o mesmo `Banco` no mesmo arquivo também ficaria | Limite declarado, mesma natureza do JSDoc de várias linhas (a troca à mão é por arquivo e nome, não por linha). Fica para a retro; o `restos` cobra o que sobrar. Escrito na §5 da Tech Spec |
| `test-engineer` 2ª | `casos.md`: a conferência da árvore real está marcada como "manual, sem teste"; fica para a validação confirmar o número (0 arquivos mudados) | Sem ação nesta correção: o Validador confere o 0 na árvore real |
| `privacy-guardian` 1ª | Sempre que um nome citado no `docs/lgpd.md` ou num README mudar (campo, tabela, guarda), confirmar que o mapa de dados continua apontando para o nome que existe no código; hoje só a revisão garante | Para a próxima onda e para a retro: não é código desta correção |
| `privacy-guardian` 1ª | O limite das crases abertas numa linha e fechadas na seguinte pode deixar ou trocar errado uma referência a guarda ou teste de privacidade; levar à retro | Já está na tabela do documento como limite declarado ("Fica para a retro") |

## Revisões
| 2026-11-02 00:42:03 | 2026-11-02 00:43:50 | `privacy-guardian` | 1 | APROVADO | a02a8634bfe9484d5 |
| 2026-11-02 00:42:00 | 2026-11-02 00:45:26 | `test-engineer` | 1 | REPROVADO | abb1e047036670c93 |
| 2026-11-02 10:52:33 | 2026-11-02 10:53:27 | `test-engineer` | 2 | APROVADO | a0c097c3bf5e0ae46 |
| 2026-11-02 10:52:37 | 2026-11-02 10:56:47 | `revisor-geral` | 1 | REPROVADO | a58090570fa8c16ae |
| 2026-11-02 11:11:21 | 2026-11-02 11:11:39 | `privacy-guardian` | 2 | APROVADO | adadb2f25eda33259 |
| 2026-11-02 11:11:31 | 2026-11-02 11:11:53 | `revisor-geral` | 2 | APROVADO | ab17eb0f189334d1b |
| 2026-11-02 11:11:15 | 2026-11-02 11:12:20 | `test-engineer` | 3 | APROVADO | ab97b6b4f92d9b06d |
