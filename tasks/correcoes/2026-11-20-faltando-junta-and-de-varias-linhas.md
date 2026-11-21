# Correção — o `--faltando` junta as linhas de um `and(`/`or(` de várias linhas antes de partir em termos

**Origem:** retro da F4b (classificacao-bncc, 20/11/2026), item "(X6, retro, M4)" do `TODO.md`; reprovou a 9.0 da X6 (`this.#semResposta(),`) e a 13.0 da F4b
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`

## Sintoma

`node tools/processo/mutacoes.ts --faltando` lê uma linha por vez. No `and(` ou no `or(` com um argumento por linha

```ts
.where(and(
  eq(t.escolaId, escolaId),
  this.#semResposta(),
))
```

cada linha de argumento (`eq(t.escolaId, escolaId),`, `this.#semResposta(),`) não tem termo nem operador de condição, e **sai da lista**: é justamente a
cláusula de escopo da regra 10. O limite estava escrito (comentário de `termosDaLinha`, `executar-task`, `task-template.md`) e a mesma forma reprovou a 9.0 da X6
e a 13.0 da F4b.

## Fora desta correção

nada

## Causa

`linhasSemBloco` (`tools/processo/mutacoes.ts`) recebe as linhas acrescentadas soltas, e `termosDaLinha` parte cada uma sozinha. O `and(` que abre numa linha e fecha em outra
só tem os argumentos inteiros olhando o arquivo, e `linhasNovasDaArvore` não entrega essa informação (como já faz com o `modelo` dos templates de SQL e de Lua).

## Teste que reproduz

`tools/processo/mutacoes.test.ts`, no `describe` "o --faltando junta as linhas de um and/or de várias linhas (M4 da retro da X6)": `argumentosDeVariasLinhas` (os grupos de um arquivo), o item por
argumento em `linhasSemBloco`, o bloco que tira só um argumento e a árvore de verdade (`--faltando, sobre uma árvore de verdade › o and de várias linhas de um arquivo novo e de um versionado`).

O teste foi escrito antes do código, mas **não houve rodada vermelha contra o código antigo**: o `import` de `argumentosDeVariasLinhas` não existia no `HEAD`, e o arquivo todo cairia por erro de
carga, que não prova cláusula. A prova do vermelho é a de cada bloco da seção "Mutações" (61, todos conferidos antes do pedido). Um caso (o comentário no fim da primeira linha de um argumento
de várias linhas) ficou vermelho contra o código recém-escrito e achou um defeito dele, corrigido.

## Correção

`tools/processo/mutacoes.ts`:

- `argumentosDeVariasLinhas(fonte)` (`LeitorDeArgumentos`): lê o arquivo inteiro e, para cada `and(` ou `or(` que abre e fecha em linhas diferentes e tem dois argumentos ou mais,
  devolve, por linha, os argumentos que ela toca (`ArgumentoDeGrupo`: `de` é a primeira linha do argumento, `termo` o texto dele, `irmaos` os outros argumentos do mesmo grupo). O
  argumento de várias linhas leva o texto da primeira linha (sem o comentário do fim) e todas as linhas dele; a linha de um grupo de dentro fica com os argumentos do grupo mais
  interno. Texto entre aspas, modelo de texto, expressão regular e comentário não cortam nem fecham nada; o `and` e o `or` valem pelo nome, como em `termosDaLinha`.
- `linhasNovasDaArvore` lê cada arquivo uma vez e põe `argumentos` na linha nova que cai dentro de um grupo (como já faz com o `modelo` dos templates).
- `linhasSemBloco` lista um item por argumento (`itensDosArgumentos`; o de várias linhas é um item só, na primeira linha nova dele). O argumento só sai da lista com um bloco do mesmo
  arquivo que o **tire e não tire nenhum irmão que cite** (`blocoTiraOArgumento`: os irmãos moram em outras linhas, e o bloco não precisa repeti-los), ou com o motivo de crase igual
  ao argumento. A linha com vários termos dentro de um argumento (`ok && eq(b, 2),`) lista o argumento e os termos.
- `fimDoModeloDeTexto`: o fim do modelo de texto, para o leitor novo não repetir o laço de `LeitorDeTermos.#modelo` (a linha igual deixaria dois trechos iguais no arquivo, e o bloco de
  mutação não acharia um só).
- `itensDeVariosTermos` e a divisão de `#passo` em `#simbolo` e `#agrupador` existem só para as funções ficarem sob o teto de complexidade do lint (10), sem mudar as linhas que os blocos citam.
- Da rodada 1 (`.processo/ordens/2026-11-20-faltando-junta-and-de-varias-linhas-r1.md`): a linha que só **continua** um argumento de várias linhas (`ids ?? [],` dentro de um `inArray(` quebrado) volta a listar a
  condição dela, além do argumento (`itensDaLinhaDeArgumento`: `continuacao && condicoes.length > 0 && !alcancada`), porque o item do argumento, que sai uma vez só, a escondia; a chave de `argumentosVistos` leva a
  primeira linha do argumento (duas consultas com o mesmo `eq(t.escolaId, escolaId),` listam as duas); o `#abrir` olha os 4 últimos caracteres antes do `(`, e não o arquivo inteiro a cada abertura; os blocos que faltavam
  (a guarda de `#fechar`, o `trimEnd()`, o `filter` e o `Set` dos irmãos, o `<=` do laço de `#emitir`, a chave) entraram, e os motivos que faltavam.
- O comentário de `termosDaLinha` (limite 3), o de `argumentosDeVariasLinhas` (os limites dele: o `or(` de dentro com o primeiro argumento na linha da abertura, o modelo de texto com crase aninhada, o bloco que casa
  pelo texto) e o de `linhasSemBloco` dizem o que mudou; o passo 2 do `executar-task` ganha os mesmos limites e o exemplo com `escolaId` (`t.escolaId === escolaId &&` quebrado em duas linhas).
- **Os outros limites do `--faltando` seguem como estão** (escritos no comentário de `termosDaLinha`): o `and` e o `or` valem pelo nome, o `&&` dentro de um `and(` vira mais um termo dele, o
  ternário deixa o `x ?` no primeiro termo, o SQL em template sem etiqueta e fora de `execute(` e `query(`, e o `&&`/`||` com os operandos em linhas diferentes. A decisão de recusar o motivo
  para termo de escopo (`escolaId`) é a (a) do outro item do `TODO.md` e não entra aqui.

Um caso do teste pegou, no meio, o comentário do fim da primeira linha de um argumento de várias linhas ficando no termo (`trimEnd()` antes de tirar `// ...`).

Docs: `.claude/skills/executar-task/SKILL.md` (passo 2) e `.claude/skills/criar-tasks/task-template.md` (autoconferência 1) deixam de dizer que o `and(`/`or(` com um argumento por linha fica
à mão, e passam a dizer que o `&&` e o `||` com os operandos em linhas diferentes ficam; o item do `TODO.md` é marcado.

## Recomendações sem aplicar

Copiado da seção "Sem aplicar" de `.processo/ordens/2026-11-20-faltando-junta-and-de-varias-linhas-r1.md`:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O motivo de crase igual ao termo (`cobertoPorMotivo`) também tira da lista um argumento de escopo; "esse item deveria ser fechado logo" | Já é o item (a) do outro item do `TODO.md`, que o documento deixa fora de propósito; muda comportamento e contrato do `--faltando` |
| privacy-guardian (1ª) | A correção ajuda indiretamente a regra 20 | Sem ação: é constatação, não pede mudança |
| privacy-guardian (1ª), revisor-geral (1ª) | Não houve rodada vermelha contra o código antigo | O documento já declara e justifica; fica para a retro e para o Validador |

Copiado da seção "Sem aplicar" de `.processo/ordens/2026-11-20-faltando-junta-and-de-varias-linhas-r2.md` (os destinos de `TODO.md` entraram na seção "Da retrospectiva da F4b", logo depois do item da M4 da X6):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (2ª), privacy-guardian (2ª) | O bloco casa o argumento pelo texto: um bloco que tira `eq(t.escolaId, escolaId),` de uma consulta cobre o igual de todas as outras do arquivo; registrar correção futura que case pela linha mais o texto quando o argumento tiver `escolaId` ou `anoLetivoId` | `TODO.md`, junto do item (a) que o documento já deixa fora; muda comportamento e contrato do `--faltando`. O limite já está escrito (comentário de `argumentosDeVariasLinhas`, passo 2 do `executar-task`) |
| tenancy-guardian (2ª) | O `t.escolaId === escolaId &&` partido em duas linhas escapa da ferramenta; mesmo item no `TODO.md` | `TODO.md`: é o limite (c), que a correção declara e não resolve |
| revisor-geral (2ª) | O `task-template.md` (linha 103) não cita os limites novos (`or(` de dentro com o primeiro argumento na linha da abertura, crase aninhada em `${}`, bloco que casa pelo texto) | `TODO.md`, ao lado do item acima: o template já diz que o `&&`/`||` em linhas diferentes fica à mão, e a lista completa está no `executar-task`; o comentário de `mutacoes.ts` que diz "autoconferência 1 do `criar-tasks`" precisa do mesmo ajuste quando o template ganhar a frase |
| revisor-geral (2ª) | `itensDaLinhaDeArgumento` recebe `argumentos` à parte, igual a `nova.argumentos`; usar uma fonte só | Recusada por ora: é limpeza sem efeito, e mexer nela caduca os quatro revisores; entra na próxima correção que tocar `mutacoes.ts` (`TODO.md`) |
| revisor-geral (2ª) | Frase no comentário de `itensDaLinhaDeArgumento`: na primeira linha de um argumento de várias linhas com condição, a condição só sai com um bloco que tire o argumento inteiro | Mesmo destino da linha acima (comentário em arquivo de código; `TODO.md`) |
| test-engineer (2ª) | A janela de 4 caracteres do `#abrir` não tem bloco próprio, mas os testes existentes a cobrem (`:1121` a `:1143`, `brand(` de `:1158`); pôr os blocos `- 4` → `- 3` e sem o `Math.max`, ou escrever no documento | `TODO.md`: cobertura já provada por teste, só falta o registro por bloco |
| test-engineer (2ª) | `every` → `some` em `continuacao` não muda nada nos testes (cada linha tem um argumento só); um caso com a linha de um grupo de dentro com vários argumentos | `TODO.md`: cobertura extra, não regra sem prova |
| privacy-guardian (2ª), revisor-geral (1ª) | Falta de rodada vermelha contra o código antigo (declarada e justificada no documento) | Retro da correção e Validador |
| privacy-guardian (1ª) | A correção ajuda indiretamente a regra 20 | Sem ação: constatação |

## Mutações

--faltando: 1 linhas (61 blocos, 10 motivos). Cada bloco foi aplicado e rodado antes do pedido (o mesmo `conferirMutacoesDoDocumento` do portão): todos ficaram vermelhos num caso que rodou e falhou. A linha que a ferramenta ainda lista é a do `?? ''` do motivo do `?? ''` abaixo; o resto dos motivos é de termo, e a ferramenta já os tira da lista pela crase igual ao termo. Os blocos do `and(` e do `or(` que provam o que **não** é grupo (`brand(`, `eq(`, `and[`, o `and(` de uma linha só, o de um argumento só) usam `falha: toEqual([])` e o teste `não há argumentos em`.

Motivos das linhas e dos termos sem bloco (cada um entre crases, que é o que o `--faltando` lê):

- `j < texto.length`, em `fimDoModeloDeTexto`: só impede ler depois do fim do texto. Sem ele o laço de um modelo que acaba sem fechar não termina (`undefined` não é a crase), e o teste que o provaria cai no prazo da corrida, que o portão recusa como estouro, e não como vermelho. O outro termo do laço tem bloco.
- `c !== ']'` e `c !== '}'`, na guarda do `quadro.inicio ??=`: o fecho que importa ali é o do `and(`/`or(`, e esse é `)`; um `]` ou `}` fecha um quadro de colchete ou de chave, que nunca é chamada e cujo `inicio` ninguém lê. Tirar um dos dois não muda resultado em código válido; o termo `c !== ')'` tem bloco.
- `quadro.chamada`, em `#virgula`: a vírgula de um quadro que não é chamada só guardaria um argumento que `#fechar` nunca emite (o `if (quadro.chamada)` de lá tem bloco), então tirar o termo não muda resultado.
- `quadro.inicio !== null`, em `#virgula`: só estreita o tipo; a vírgula sem argumento antes (`and(a,, b)`) não é TypeScript válido.
- `this.#texto[this.#i] ?? ''`, em `#passo`: o índice está sempre dentro do texto (`i < length`), e o valor padrão só existe para o `noUncheckedIndexedAccess`.
- O ramo `-1` de `#fimDaLinha` e de `#fimDoComentario` (comentário que acaba o arquivo sem quebra de linha, e `/*` sem `*/`): sem ele o `i` ficaria em `-1` (ou voltaria ao começo) e o laço de `ler()` não terminaria, o portão o recusaria como estouro de prazo, e não como vermelho. O outro ramo de cada um tem bloco.
- `this.#i < this.#texto.length`, em `ler()` do leitor de argumentos: o limite do laço, que só impede ler depois do fim do texto; sem ele o laço não termina, e o teste cai no prazo da corrida, que o portão recusa como estouro, e não como vermelho.
- `de < ate`, em `#linhaDe`: o limite da busca binária; com `<=` o laço não termina quando `de === ate` e o `indice` está depois do começo da linha (estouro de prazo, e não vermelho). O `<=` de `this.#inicioDeLinha[meio] ?? 0` tem bloco.
- `this.#inicioDeLinha[meio] ?? 0` e `this.#inicioDeLinha[primeira] ?? this.#texto.length`: o índice está sempre dentro da lista (`meio` entre `de` e `ate`, `primeira` é uma linha do texto), e o valor padrão só existe para o `noUncheckedIndexedAccess`; o `?? ''` de cima é o mesmo caso.
- Dois blocos ficam vermelhos por exceção, e não por asserção, e é o efeito real da cláusula faltar: o `if (this.#quadros.length > 1)` trocado por `if (true)` lança `TypeError` no fecho sem abertura (o quadro de base sai da pilha), e o `(nova.argumentos ?? [])` trocado por `(nova.argumentos as ArgumentoDeGrupo[])` lança no `.filter` de `undefined` na linha de um `and(` de uma linha só. O portão aceita a queda de um caso que rodou e lançou.

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- for (let j = 0; j < texto.length; j += 1) if (texto[j] === '\n') this.#inicioDeLinha.push(j + 1)
+ for (let j = 0; j < texto.length; j += 1) if (texto[j] === '\r') this.#inicioDeLinha.push(j + 1)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if ((this.#inicioDeLinha[meio] ?? 0) <= indice) de = meio
+ if ((this.#inicioDeLinha[meio] ?? 0) < indice) de = meio
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (/\s/.test(c)) this.#i += 1
+ if (false) this.#i += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === '/' && proximo === '/') this.#i = this.#fimDaLinha()
+ else if (proximo === '/') this.#i = this.#fimDaLinha()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === '/' && proximo === '/') this.#i = this.#fimDaLinha()
+ else if (c === '/') this.#i = this.#fimDaLinha()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === '/' && proximo === '*') this.#i = this.#fimDoComentario()
+ else if (proximo === '*') this.#i = this.#fimDoComentario()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === '/' && proximo === '*') this.#i = this.#fimDoComentario()
+ else if (c === '/') this.#i = this.#fimDoComentario()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c !== ')' && c !== ']' && c !== '}') quadro.inicio ??= this.#i
+ if (c !== ']' && c !== '}') quadro.inicio ??= this.#i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === ',') this.#virgula(quadro)
+ if (false) this.#virgula(quadro)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === '(' || c === '[' || c === '{') this.#abrir(c)
+ if (c === '[' || c === '{') this.#abrir(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === '(' || c === '[' || c === '{') this.#abrir(c)
+ if (c === '(' || c === '{') this.#abrir(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === '(' || c === '[' || c === '{') this.#abrir(c)
+ if (c === '(' || c === '[') this.#abrir(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === ')' || c === ']' || c === '}') this.#fechar(c)
+ else if (c === ']' || c === '}') this.#fechar(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === ')' || c === ']' || c === '}') this.#fechar(c)
+ else if (c === ')' || c === '}') this.#fechar(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- else if (c === ')' || c === ']' || c === '}') this.#fechar(c)
+ else if (c === ')' || c === ']') this.#fechar(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return quebra === -1 ? this.#texto.length : quebra
+ return this.#texto.length
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return fim === -1 ? this.#texto.length : fim + 2
+ return this.#texto.length
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === "'" || c === '"') {
+ if (c === '"') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (c === "'" || c === '"') {
+ if (c === "'") {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- } else if (c === '`') {
+ } else if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- while (j < texto.length && texto[j] !== '`') j += texto[j] === '\\' ? 2 : 1
+ while (j < texto.length) j += texto[j] === '\\' ? 2 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- while (j < texto.length && texto[j] !== '`') j += texto[j] === '\\' ? 2 : 1
+ while (j < texto.length && texto[j] !== '`') j += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- } else if (c === '/' && ANTES_DE_REGEX.test(this.#recente.slice(-8))) {
+ } else if (ANTES_DE_REGEX.test(this.#recente.slice(-8))) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- } else if (c === '/' && ANTES_DE_REGEX.test(this.#recente.slice(-8))) {
+ } else if (c === '/') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › não há argumentos em
falha: toEqual([])
- const chamada = c === '(' && /(?:^|[^\w$])(?:and|or)$/.test(this.#texto.slice(Math.max(0, this.#i - 4), this.#i))
+ const chamada = /(?:^|[^\w$])(?:and|or)$/.test(this.#texto.slice(Math.max(0, this.#i - 4), this.#i))
 this.#quadros.push({ chamada, linhaDaAbertura: this.#linhaDe(this.#i), inicio: null, fim: this.#i + 1, argumentos: [] })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › não há argumentos em
falha: toEqual([])
- const chamada = c === '(' && /(?:^|[^\w$])(?:and|or)$/.test(this.#texto.slice(Math.max(0, this.#i - 4), this.#i))
+ const chamada = c === '('
 this.#quadros.push({ chamada, linhaDaAbertura: this.#linhaDe(this.#i), inicio: null, fim: this.#i + 1, argumentos: [] })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (this.#quadros.length > 1) {
+ if (true) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (quadro.chamada) {
+ if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (quadro.inicio !== null) quadro.argumentos.push({ de: quadro.inicio, ate: quadro.fim })
+ if (false) quadro.argumentos.push({ de: 0, ate: 0 })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › não há argumentos em
falha: toEqual([])
- if (quadro.argumentos.length >= 2 && this.#linhaDe(this.#i) !== quadro.linhaDaAbertura) this.#emitir(quadro.argumentos)
+ if (this.#linhaDe(this.#i) !== quadro.linhaDaAbertura) this.#emitir(quadro.argumentos)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › não há argumentos em
falha: toEqual([])
- if (quadro.argumentos.length >= 2 && this.#linhaDe(this.#i) !== quadro.linhaDaAbertura) this.#emitir(quadro.argumentos)
+ if (quadro.argumentos.length >= 2) this.#emitir(quadro.argumentos)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (primeira === ultima) return this.#texto.slice(argumento.de, argumento.ate).replace(/\s+/g, ' ').trim()
+ if (false) return this.#texto.slice(argumento.de, argumento.ate).replace(/\s+/g, ' ').trim()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (primeira === ultima) return this.#texto.slice(argumento.de, argumento.ate).replace(/\s+/g, ' ').trim()
+ if (primeira === ultima) return this.#texto.slice(argumento.de, argumento.ate).trim()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return this.#texto.slice(argumento.de, this.#inicioDeLinha[primeira] ?? this.#texto.length).trimEnd().replace(/\s\/\/.*$/, '').trim()
+ return this.#texto.slice(argumento.de, this.#inicioDeLinha[primeira] ?? this.#texto.length).trimEnd().trim()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (!ocupadas.has(linha)) this.#mapa.set(linha, [...(this.#mapa.get(linha) ?? []), { de: primeira, termo, irmaos }])
+ if (true) this.#mapa.set(linha, [...(this.#mapa.get(linha) ?? []), { de: primeira, termo, irmaos }])
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (!ocupadas.has(linha)) this.#mapa.set(linha, [...(this.#mapa.get(linha) ?? []), { de: primeira, termo, irmaos }])
+ if (!ocupadas.has(linha)) this.#mapa.set(linha, [...(this.#mapa.get(linha) ?? [{ de: 0, termo: 'x', irmaos: [] }]), { de: primeira, termo, irmaos }])
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (!cita(mutacao.antes, argumento.termo) || cita(mutacao.depois, argumento.termo)) return false
+ if (cita(mutacao.depois, argumento.termo)) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (!cita(mutacao.antes, argumento.termo) || cita(mutacao.depois, argumento.termo)) return false
+ if (!cita(mutacao.antes, argumento.termo)) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return argumento.irmaos.every((irmao) => !cita(mutacao.antes, irmao) || cita(mutacao.depois, irmao))
+ return argumento.irmaos.every((irmao) => cita(mutacao.depois, irmao))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return argumento.irmaos.every((irmao) => !cita(mutacao.antes, irmao) || cita(mutacao.depois, irmao))
+ return argumento.irmaos.every((irmao) => !cita(mutacao.antes, irmao))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando termo a termo|o --faltando junta as linhas de um and/or de várias linhas
- return (nova.argumentos ?? [])
+ return (nova.argumentos as ArgumentoDeGrupo[])
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return novo && !contexto.cobertoPorMotivo(argumento.termo) && !doArquivo.some((mutacao) => blocoTiraOArgumento(mutacao, argumento))
+ return !contexto.cobertoPorMotivo(argumento.termo) && !doArquivo.some((mutacao) => blocoTiraOArgumento(mutacao, argumento))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return novo && !contexto.cobertoPorMotivo(argumento.termo) && !doArquivo.some((mutacao) => blocoTiraOArgumento(mutacao, argumento))
+ return novo && !doArquivo.some((mutacao) => blocoTiraOArgumento(mutacao, argumento))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return novo && !contexto.cobertoPorMotivo(argumento.termo) && !doArquivo.some((mutacao) => blocoTiraOArgumento(mutacao, argumento))
+ return novo && !contexto.cobertoPorMotivo(argumento.termo)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- .map((argumento) => ({ ...nova, condicoes: condicoes.length > 0 ? condicoes : ['termos'], termo: argumento.termo }))
+ .map((argumento) => ({ ...nova, condicoes, termo: argumento.termo }))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- .map((argumento) => ({ ...nova, condicoes: condicoes.length > 0 ? condicoes : ['termos'], termo: argumento.termo }))
+ .map((argumento) => ({ ...nova, condicoes: ['termos'], termo: argumento.termo }))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando termo a termo|o --faltando junta as linhas de um and/or de várias linhas
- if (termos.length >= 2) return itensDeVariosTermos(nova, condicoes, termos, contexto)
+ if (false) return itensDeVariosTermos(nova, condicoes, termos, contexto)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando termo a termo|o --faltando junta as linhas de um and/or de várias linhas
- return [...itensDosArgumentos(nova, condicoes, contexto), ...itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)]
+ return [...itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando termo a termo|o --faltando junta as linhas de um and/or de várias linhas
- return [...itensDosArgumentos(nova, condicoes, contexto), ...itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)]
+ return [...itensDosArgumentos(nova, condicoes, contexto), ...itensPorTermo(nova, condicoes, termos, contexto)]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (nova.argumentos !== undefined) return itensDaLinhaDeArgumento(nova, nova.argumentos, condicoes, alcancada, contexto)
+ if (false) return itensDaLinhaDeArgumento(nova, nova.argumentos, condicoes, alcancada, contexto)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a linha nova de SQL e de Lua em template string é listada
- const comTemplate = doTemplate === undefined ? nova : { ...nova, modelo: doTemplate.modelo, mista: doTemplate.mista }
+ const comTemplate = nova
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o and de várias linhas de um arquivo novo e de um versionado
- return argumentos === undefined ? comTemplate : { ...comTemplate, argumentos }
+ return comTemplate
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return continuacao && condicoes.length > 0 && !alcancada ? [...doArgumento, { ...nova, condicoes }] : doArgumento
+ return condicoes.length > 0 && !alcancada ? [...doArgumento, { ...nova, condicoes }] : doArgumento
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return continuacao && condicoes.length > 0 && !alcancada ? [...doArgumento, { ...nova, condicoes }] : doArgumento
+ return continuacao && !alcancada ? [...doArgumento, { ...nova, condicoes }] : doArgumento
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return continuacao && condicoes.length > 0 && !alcancada ? [...doArgumento, { ...nova, condicoes }] : doArgumento
+ return continuacao && condicoes.length > 0 ? [...doArgumento, { ...nova, condicoes }] : doArgumento
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- if (quadro.inicio !== null) quadro.argumentos.push({ de: quadro.inicio, ate: quadro.fim })
+ if (true) quadro.argumentos.push({ de: quadro.inicio, ate: quadro.fim })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- return this.#texto.slice(argumento.de, this.#inicioDeLinha[primeira] ?? this.#texto.length).trimEnd().replace(/\s\/\/.*$/, '').trim()
+ return this.#texto.slice(argumento.de, this.#inicioDeLinha[primeira] ?? this.#texto.length).replace(/\s\/\/.*$/, '').trim()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- const irmaos = [...new Set(vistos.map((outro) => outro.termo).filter((outro) => outro !== termo))]
+ const irmaos = [...new Set(vistos.map((outro) => outro.termo).filter(() => true))]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- const irmaos = [...new Set(vistos.map((outro) => outro.termo).filter((outro) => outro !== termo))]
+ const irmaos = vistos.map((outro) => outro.termo).filter((outro) => outro !== termo)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- for (let linha = primeira; linha <= ultima; linha += 1) {
+ for (let linha = primeira; linha < ultima; linha += 1) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando junta as linhas de um and/or de várias linhas
- const chave = `${nova.arquivo}:${String(argumento.de)}:${argumento.termo}`
+ const chave = `${nova.arquivo}:${argumento.termo}`
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 00:06:16 | 2026-11-21 00:06:38 | `privacy-guardian` | 1 | APROVADO | a44b51da0be1f3f91 |
| 2026-11-21 00:06:15 | 2026-11-21 00:07:22 | `tenancy-guardian` | 1 | APROVADO | a55a2984e458135b1 |
| 2026-11-21 00:06:13 | 2026-11-21 00:07:57 | `revisor-geral` | 1 | REPROVADO | a009f8888b0dfc223 |
| 2026-11-21 00:06:12 | 2026-11-21 00:09:45 | `test-engineer` | 1 | REPROVADO | a173f5216877b22dd |
| 2026-11-21 00:24:03 | 2026-11-21 00:24:21 | `privacy-guardian` | 2 | APROVADO | abeddff5fb902e772 |
| 2026-11-21 00:23:59 | 2026-11-21 00:24:36 | `tenancy-guardian` | 2 | APROVADO | a32ef994b24d269f7 |
| 2026-11-21 00:23:53 | 2026-11-21 00:24:51 | `revisor-geral` | 2 | APROVADO | a1eab3f67b68f2ef0 |
| 2026-11-21 00:23:42 | 2026-11-21 00:25:35 | `test-engineer` | 2 | APROVADO | a8996f41db667ff82 |
