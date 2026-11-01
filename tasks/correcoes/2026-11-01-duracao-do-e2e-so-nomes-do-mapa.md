# Correção — a régua de duração do e2e conta como alterado o caso que a onda só renomeou pelo mapa

**Origem:** 2ª divergência de portão da 11.0 de `nomes-de-mercado` (`.processo/divergencia-11-duracao.md`, triagem do Arquiteto, 01/11), com a regra na Tech Spec §13 (`254f6b7e`) e as duas ampliações da divergência da própria correção (`3fa0b644`, `spec/nomes-de-mercado`). Levada da L1 para a L3 (`.processo/correcao-duracao-so-nomes-na-l3.md`): lá a árvore tem a onda da 11.0 sem commit.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `privacy-guardian`, `infra-guardian`
<!-- Os dois primeiros vieram no PEDIDO do Orquestrador (`revisor-geral` porque a correção toca `tools/ci/` e `tools/processo/`). Os dois guardiões vêm do caminho (`guardioes-por-caminho.ts`, código de processo) e foram acrescentados a pedido da Mesa 3 na DEVOLUÇÃO. -->

## Sintoma

O portão da 11.0 reprovou a duração do e2e: "55 caso(s) de e2e alterado(s) acima da metade do prazo" (15 a 68 s), todos com identificador de fixture ou helper renomeado pelo mapa (`PerfilDeMaquina` → `MachineProfile`, `violacoesGraves` → `seriousViolations`…). Nenhum caso cresceu: a onda não encurta nem divide caso (RF7).

## Fora desta correção

nada

## Causa

`casosAlterados` decide "alterado" pelas **linhas** que o diff tocou, e a exceção de só comentário (`casosSoComComentarioAlterado`) compara o trecho do caso byte a byte. Renomear um identificador pelo mapa muda o trecho sem fazer o caso crescer, e nada na régua sabe o que é "o nome que o mapa da onda troca".

## Teste que reproduz

Em `tools/ci/duracao-do-e2e.test.ts`, bloco "no repositório: o diff do git decide qual caso é alterado", ao lado de "só o comentário do caso lento muda":
- `só os nomes do mapa da onda mudam: o caso não conta como alterado e a régua passa` (vermelho antes: o portão reprovava o caso com 19,0 s);
- o mesmo com a quebra de linha e a vírgula final que o prettier refaz;
- as reprovações: nome trocado fora do mapa; nome do mapa mais uma linha de código; nome antigo trocado dentro de um texto; o mesmo rename com o mapa já no HEAD; entrada que não é `simbolo`;
- `casosIsentosPorSoRename` lista o isento que estava acima do limite, e o portão a imprime;
- ampliação (a): o `de` com dois `para` isenta o caso que usa qualquer um deles; o nome local homônimo de um `de` com `arquivo` fica como está e o caso continua isento; o token da árvore que não é o do HEAD nem um `para` daquele `de` reprova;
- ampliação (b): o título de modelo só com nomes do mapa é isento e listado; reprovam o de parte literal mudada, o de expressão fora do mapa, o repetido no HEAD e o copiado na árvore; o comentário de bloco de várias linhas antes do caso não desloca a linha; vale também para a exceção do comentário (e a do comentário não usa o mapa no título). O teste antigo "título de modelo: o HEAD não diz como o caso se chama" afirmava o contrário da ampliação (b) e foi reescrito para ela, com o irmão que mantém medido o título que mudou.
- rodada 1 e 2 da Mesa, pelo nome exato de cada `it(`: `o objeto dentro de um modelo de texto não fecha o modelo: o nome do mapa depois dele continua lido como código`; `a barra que divide não abre expressão regular: o nome do mapa depois dela é trocado`; `a expressão regular que começa com = é uma só: o nome do mapa dentro dela não é identificador`; os três de `mapa que não se lê: a régua só perde a isenção, e não quebra` (`JSON quebrado`, `entradas que é objeto, e não lista`, `entrada que não é objeto é ignorada, e a boa ao lado dela vale`); `cópia do título de modelo com o nome do mapa trocado num dos dois: o caso novo continua medido`; `o comentário de bloco comprido depois do início do caso de modelo não desloca a linha dele`; `o caso de título literal e o de título de modelo no mesmo spec acham cada um o seu par`; `o título literal que só troca de aspas, com o corpo igual, acha o par pelo título literal e sai da régua`.

## Correção

O trecho do HEAD de um caso que o diff tocou, com cada `de` → `para` das entradas `simbolo` do mapa da onda aplicado só a token identificador, dá a mesma sequência de tokens que o da árvore: o caso sai da régua, como o de só comentário. `tools/ci/duracao-do-e2e.ts`:
- `nomesDoMapaDaOnda`: os mapas de `tools/renomear/mapas/*.json` novos na árvore ou diferentes do HEAD (mapa commitado não isenta); só `tipo: "simbolo"`; o mesmo `de` com dois `para` fica de fora;
- `tokensDoTrecho`: o escâner do TypeScript (não o parser, que descarta o que não fecha num pedaço de arquivo), com a pilha de `${` para a `}` de um modelo e a regra de `/` que abre regex; ignora espaço, quebra de linha e comentário; tira a vírgula antes de `)`, `]` ou `}`;
- `casosComParNoHead` generaliza a antiga `casosSoComComentarioAlterado` (mesmo par por título único dos dois lados) e recebe o critério de igualdade; `analisarOsCasos` aplica primeiro o de só comentário e depois o de só nomes;
- `casosIsentosPorSoRename` lista os isentos que estavam acima do limite, e `tools/processo/portao-local.ts` os imprime ("Só rename na régua de duração"), para o `11.relatorio.md` copiá-los (marca da 11.5).

Ampliações da Tech Spec §13 (divergência da própria correção, `3fa0b644`):
- (a) por posição, o token da árvore vale se for o do HEAD ou, sendo os dois identificadores, um `para` que o mapa dá ao `de` do HEAD (`mesmosTokensComOsNomesDoMapa`); o número de tokens continua o mesmo. `nomesDoMapaDaOnda` passa a devolver o conjunto de `para` de cada `de` (o `de` com dois `para` não é mais ambíguo). `tokensDoTrecho` devolve o texto e se é identificador, sem aplicar mapa;
- (b) o caso de título de modelo (`${}`) tem par pela linha: `casosDeTituloDeModelo` lê esses casos com a linha do `test(` no texto original (`linhaNoOriginal` desfaz o deslocamento dos comentários de bloco), e `parDoCasoDeModelo` acha o do HEAD como o único cujo título, lido como tokens, é o da árvore. O título repetido no HEAD, repetido na árvore (a cópia) ou que não bate fica sem par e medido. `casosComParNoHead` se parte em `parDoCasoLiteral` e `parDoCasoDeModelo`; a exceção do comentário usa o título sem nome nenhum trocado.
- Rodada 1 da Mesa (`.processo/ordens/2026-11-01-duracao-do-e2e-so-nomes-do-mapa-r1.md`): o par do caso de modelo é um para um (o caso do HEAD achado também tem de ligar, pela regra dos nomes, a um único caso da árvore; a cópia com o nome do mapa trocado deixa de herdar a isenção); testes e blocos para a `{` dentro de `${}`, o `break` de `linhaNoOriginal`, a barra que divide e o `/=`, e o mapa malformado (`entradas` que não é lista, entrada que não é objeto: ignorada, em vez de quebrar a régua); o conjunto `ANTES_DE_DIVISAO` montado uma vez; o critério de só nomes numa constante (`soOsNomesDoMapa`); o comentário de `tituloLiteral` aponta para `casosDeTituloDeModelo`.
- `tools/processo/portao-local.ts` imprime "Só rename na régua de duração" (o mesmo trecho da L1).

Conferência no relatório real da 11.0, sem e2e (`motivoDaDuracaoDoE2e` e `casosIsentosPorSoRename` com a raiz na L1, só leitura, e o `.processo/e2e-duracao.json` dela): `motivo: null` e `isentos: 55`, 14 a 68 s. Entre eles `e2e/lista-da-turma.spec.ts:214` (o `secao` homônimo) e os 6 de `e2e/incidentes.spec.ts:756` (título de modelo). A lista dos 55 está em `.processo/conferencia-duracao-l3.txt` (fora do git).

## Mutações

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › só os nomes do mapa da onda mudam: o caso não conta como alterado e a régua passa
-return { alterados: restantes.filter((caso) => !soNomes.has(caso)), isentosPorNome: restantes.filter((caso) => soNomes.has(caso)) }
+return { alterados: restantes, isentosPorNome: restantes.filter((caso) => soNomes.has(caso)) }
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome mais longo quebra a chamada em linhas e põe a vírgula final, como o prettier: o caso continua isento
-return tokens.filter((token, i) => token.texto !== ',' || ![')', ']', '}'].includes(tokens[i + 1]?.texto ?? ''))
+return tokens
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › palavra-chave do mapa não é identificador: o caso continua medido
-tokens.push({ texto: escaner.getTokenText(), identificador: tipo === ts.SyntaxKind.Identifier })
+tokens.push({ texto: escaner.getTokenText(), identificador: true })
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome do mapa dentro de um modelo de texto troca só na expressão, e o que vem depois do modelo continua lido
-else if (tipo === K.CloseBraceToken && abertos.at(-1) === 'modelo') tipo = escaner.reScanTemplateToken(false)
+else if (tipo === K.CloseBraceToken && abertos.at(-1) === 'nunca') tipo = escaner.reScanTemplateToken(false)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome do mapa dentro de um modelo de texto troca só na expressão, e o que vem depois do modelo continua lido
-else if (tipo === K.TemplateTail) abertos.pop()
+else if (tipo === K.TemplateTail) void abertos
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › a expressão regular literal com aspa não engole o nome do mapa que vem depois dela na linha
-else if ((tipo === K.SlashToken || tipo === K.SlashEqualsToken) && !ANTES_DE_DIVISAO(K).has(anterior)) tipo = escaner.reScanSlashToken()
+else if ((tipo === K.SlashToken || tipo === K.SlashEqualsToken) && ANTES_DE_DIVISAO(K).has(anterior)) tipo = escaner.reScanSlashToken()
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome do mapa e uma linha a mais no fim do caso: o caso cresceu e continua medido
-esperado.length === atual.length &&
+true &&
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome trocado não está no mapa: o caso continua medido
-const soOsNomesDoMapa = ({ doHead, daArvore }: Par) => mesmosTokensComOsNomesDoMapa(doHead.trecho, daArvore.trecho, nomes)
+const soOsNomesDoMapa = ({ doHead, daArvore }: Par) => true
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › sem mapa da onda, mudar só o espaço do caso também não o tira da régua
-const soNomes = nomes.size === 0 ? new Set<CasoMedido>() : casosComParNoHead(raiz, restantes, soOsNomesDoMapa, nomes)
+const soNomes = false ? new Set<CasoMedido>() : casosComParNoHead(raiz, restantes, soOsNomesDoMapa, nomes)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › só os nomes do mapa da onda mudam: o caso não conta como alterado e a régua passa
-const nomes = [...git('ls-files', '--others', '--exclude-standard', '--', PASTA_DOS_MAPAS).split('\n'), ...git('diff', '--name-only', 'HEAD', '--', PASTA_DOS_MAPAS).split('\n')]
+const nomes = [...git('diff', '--name-only', 'HEAD', '--', PASTA_DOS_MAPAS).split('\n')]
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o mapa do HEAD que a onda alterou na árvore vale como o da onda em curso
-const nomes = [...git('ls-files', '--others', '--exclude-standard', '--', PASTA_DOS_MAPAS).split('\n'), ...git('diff', '--name-only', 'HEAD', '--', PASTA_DOS_MAPAS).split('\n')]
+const nomes = [...git('ls-files', '--others', '--exclude-standard', '--', PASTA_DOS_MAPAS).split('\n')]
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o mesmo rename com o mapa já no HEAD não isenta nada: é de uma onda que passou
-const nomes = [...git('ls-files', '--others', '--exclude-standard', '--', PASTA_DOS_MAPAS).split('\n'), ...git('diff', '--name-only', 'HEAD', '--', PASTA_DOS_MAPAS).split('\n')]
+const nomes = [...git('ls-files', '--others', '--exclude-standard', '--', PASTA_DOS_MAPAS).split('\n'), ...git('ls-files', '--', PASTA_DOS_MAPAS).split('\n')]
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › entrada que não é símbolo não isenta: arquivo, pasta e pacote renomeiam caminho, não o identificador do caso
-if (tipo !== 'simbolo' || typeof de !== 'string' || typeof para !== 'string') continue
+if (typeof de !== 'string' || typeof para !== 'string') continue
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o mapa que dá dois nomes novos ao mesmo nome antigo isenta o caso que usa qualquer um deles
-nomes.set(de, (nomes.get(de) ?? new Set<string>()).add(para))
+nomes.set(de, new Set<string>([para]))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › casosIsentosPorSoRename lista o caso isento que estava acima do limite, e só ele
-return 'motivo' in analise ? [] : casosLentos(analise.isentosPorNome, limiteDosCasos(raiz, analise.isentosPorNome))
+return 'motivo' in analise ? [] : analise.isentosPorNome
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o comentário e uma linha de código do caso lento mudam: reprova
-if (par !== undefined && igual(par)) iguais.add(medido)
+if (par !== undefined) iguais.add(medido)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome do mapa dentro de um modelo de texto troca só na expressão, e o que vem depois do modelo continua lido
-if (tipo === K.TemplateHead) abertos.push('modelo')
+if (tipo === K.TemplateHead) void abertos
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o nome local homônimo de um nome que o mapa troca só noutro arquivo fica como está: o caso continua isento
-return novo !== undefined && (novo.texto === token.texto || (token.identificador && novo.identificador && nomes.get(token.texto)?.has(novo.texto) === true))
+return novo !== undefined && (false || (token.identificador && novo.identificador && nomes.get(token.texto)?.has(novo.texto) === true))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o token da árvore que não é o do HEAD nem um nome que o mapa dá àquele nome continua medido
-return novo !== undefined && (novo.texto === token.texto || (token.identificador && novo.identificador && nomes.get(token.texto)?.has(novo.texto) === true))
+return novo !== undefined && (novo.texto === token.texto || (token.identificador && novo.identificador && nomes.has(token.texto)))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o comentário de bloco de várias linhas antes do caso não desloca a linha que o relatório dá
-removido += ate - de
+removido += 0
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título de modelo e corpo só com nomes do mapa: o caso é isento e o portão o lista
-const doHead = unico(textos.modeloDoHead.filter((c) => mesmosTokensComOsNomesDoMapa(c.titulo, daArvore.titulo, nomes)))
+const doHead = unico(textos.modeloDoHead.filter((c) => mesmosTokensComOsNomesDoMapa(c.titulo, daArvore.titulo, new Map())))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título de modelo copiado na árvore não tem par: os dois continuam medidos
-return ligadosAoDoHead.length === 1 ? { doHead, daArvore } : undefined
+return ligadosAoDoHead.length >= 1 ? { doHead, daArvore } : undefined
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título de modelo repetido no HEAD não tem par: o caso continua medido
-const unico = <T>(itens: readonly T[]): T | undefined => (itens.length === 1 ? itens[0] : undefined)
+const unico = <T>(itens: readonly T[]): T | undefined => itens[0]
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título de modelo e comentário do corpo mudam, mas o título trocou um nome do mapa: o caso sai pela exceção dos nomes e não pela do comentário
-const soComentario = casosComParNoHead(raiz, tocados, ({ doHead, daArvore }) => doHead.trecho === daArvore.trecho, new Map())
+const soComentario = casosComParNoHead(raiz, tocados, ({ doHead, daArvore }) => doHead.trecho === daArvore.trecho, nomesDoMapaDaOnda(raiz))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título de modelo e só o comentário do corpo mudam, sem mapa nenhum: o caso sai da régua pela exceção do comentário
-const deModelo = textos.modeloDaArvore.find((c) => c.linha === medido.linha)
+const deModelo = textos.modeloDaArvore.find((c) => c.linha === -1)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › cópia do título de modelo com o nome do mapa trocado num dos dois: o caso novo continua medido
-const ligadosAoDoHead = textos.modeloDaArvore.filter((c) => mesmosTokensComOsNomesDoMapa(doHead.titulo, c.titulo, nomes))
+const ligadosAoDoHead = textos.modeloDaArvore.filter((c) => mesmosTokensComOsNomesDoMapa(doHead.titulo, c.titulo, new Map()))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o objeto dentro de um modelo de texto não fecha o modelo: o nome do mapa depois dele continua lido como código
-if (tipo === K.OpenBraceToken) abertos.push('chave')
+if (tipo === K.OpenBraceToken) void abertos
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o objeto dentro de um modelo de texto não fecha o modelo: o nome do mapa depois dele continua lido como código
-else if (tipo === K.CloseBraceToken) abertos.pop()
+else if (tipo === K.CloseBraceToken) void abertos
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o comentário de bloco comprido depois do início do caso de modelo não desloca a linha dele
-if (de - removido > deslocamento) break
+if (false) break
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › a barra que divide não abre expressão regular: o nome do mapa depois dela é trocado
-K.Identifier, K.NumericLiteral, K.BigIntLiteral, K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateTail, K.RegularExpressionLiteral,
+K.NumericLiteral, K.BigIntLiteral, K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateTail, K.RegularExpressionLiteral,
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › a expressão regular que começa com = é uma só: o nome do mapa dentro dela não é identificador
-else if ((tipo === K.SlashToken || tipo === K.SlashEqualsToken) && !ANTES_DE_DIVISAO(K).has(anterior)) tipo = escaner.reScanSlashToken()
+else if (tipo === K.SlashToken && !ANTES_DE_DIVISAO(K).has(anterior)) tipo = escaner.reScanSlashToken()
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › entrada que não é objeto é ignorada, e a boa ao lado dela vale
-return Array.isArray(entradas) ? (entradas as unknown[]).filter((entrada): entrada is EntradaLida => typeof entrada === 'object' && entrada !== null) : []
+return Array.isArray(entradas) ? (entradas as EntradaLida[]) : []
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o título literal que só troca de aspas, com o corpo igual, acha o par pelo título literal e sai da régua
-if (tituloLiteral(corpo) !== null) return []
+if (false) return []
```

Sem bloco, com o motivo:
- `Array.isArray(entradas)` de `entradasDoMapa`: a mutação é equivalente, porque o `try` em volta devolve `[]` quando `entradas` não é lista (o `.filter` lança e o `catch` o pega). O teste "entradas que é objeto, e não lista" prova o resultado, não a guarda.
- `ANTES_DE_DIVISAO` montado uma vez (`conjuntoAntesDeDivisao ??=`): só evita refazer o conjunto a cada barra; o comportamento é o mesmo.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | `techspec.md:264-267`: registrar na §13, ampliação (b), o par um para um ("a cópia, com ou sem nome do mapa trocado, fica sem par e medida") | Arquiteto, na Tech Spec §13 (ele registrou as duas ampliações anteriores); a correção não edita a Tech Spec |
| revisor-geral (2ª) e infra-guardian (2ª) | `duracao-do-e2e.ts:595-602`: o cache `let` no módulo com a função que ignora `K` a partir da segunda chamada; montar o conjunto onde o `ts` é carregado ou uma `antesDeDivisao(K)` com `??=` explícito | Não aplicar agora: o item 4 da ordem 1 pediu "montá-lo uma vez" e foi feito; o desenho melhor mexe em `proximoToken` e nos blocos de mutação da regex sem mudar comportamento. Fica para a próxima tarefa que tocar `duracao-do-e2e.ts` |
| privacy-guardian (2ª) | Se a conferência dos 55 isentos um dia copiar saída do e2e (tela, trace), conferir que só há dado sintético | Sem ação: observação; hoje o arquivo guarda só título e linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-01 13:50:48 | 2026-11-01 13:51:16 | `privacy-guardian` | 2 | APROVADO | a0c29b3c7b55de693 |
| 2026-11-01 13:50:51 | 2026-11-01 13:51:23 | `infra-guardian` | 2 | APROVADO | a3f9dd0a3b951b740 |
| 2026-11-01 13:50:45 | 2026-11-01 13:51:53 | `revisor-geral` | 2 | APROVADO | aff3f3b789538f20b |
| 2026-11-01 13:50:40 | 2026-11-01 13:53:08 | `test-engineer` | 2 | REPROVADO | ab6526faed198c6df |
| 2026-11-01 14:02:03 | 2026-11-01 14:02:33 | `revisor-geral` | 3 | APROVADO | addea07fce804bbd7 |
| 2026-11-01 14:01:57 | 2026-11-01 14:02:41 | `test-engineer` | 3 | APROVADO | ad130039d06933d2e |
