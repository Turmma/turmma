# Correção — o `--faltando` lista cada termo de uma linha com vários e a linha nova de SQL ou Lua em template string

**Origem:** retro da F2c (acesso-e-convites, 11/11/2026), item "(F2c, retro, M1)" do `TODO.md`
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `privacy-guardian`, `tenancy-guardian`

## Sintoma

Na F2c o `test-engineer` reprovou 8 vezes (2.0, 4.0, 5.0, 9.0, 10.0, 14.0, 15.0, 16.0) por cláusula que o
`node tools/processo/mutacoes.ts --faltando` não listava, e o modelo da tarefa já dizia "cada termo". Duas formas
ficavam invisíveis: (a) a linha com vários termos (`and(eq(a), eq(b))`, `a && b`, `a || b`) saía da lista inteira
quando um bloco a citava, ainda que só um dos termos tivesse prova; (b) a linha nova de SQL ou de Lua dentro de
template string (a etiqueta `sql`, o script de `eval`) não tem `if`, `&&` nem `??` de TypeScript, e a ferramenta não a via.

## Fora desta correção

O que o `--faltando` continua sem ver, e fica à mão do `test-engineer` (escrito no comentário de `termosDaLinha`, no passo 2 do
`executar-task`, na autoconferência 1 do `criar-tasks` e no item do `TODO.md`):

- o `and(` ou o `or(` com **um argumento por linha** (`.where(`, depois `and(`, depois `eq(t.escolaId, escolaId),`, cada um na sua, como em
  `conta-externa.repository.ts:74-76`): a ferramenta lê uma linha por vez, e a linha `eq(...)` sozinha não tem termo nem condição, que é
  justamente a cláusula de escopo da regra 10;
- o `&&` dentro de um `and(`, que vira mais um termo dele, e não um grupo próprio;
- o ternário: `return x ? a && b : c` devolve `x ? a` e `b : c` (o corte tira o `? ...` do fim, não o `x ?` do começo);
- o `and` e o `or` valem pelo nome, e uma função sua com esse nome também é lida como tal;
- o SQL em template sem etiqueta e fora de `execute(` e `query(`, e a linha sem condição que protege.

E a duplicação de `#comum`, `#aspas` e `#barra` entre `LeitorDeTermos` e `LeitorDeTemplates` (uma base comum tiraria uns 100 linhas): vai para o
`TODO.md`, porque é refatoração de um arquivo que já leva mais de cem blocos de mutação e anularia as provas desta correção.

## Causa

`linhasSemBloco` (`tools/processo/mutacoes.ts`) trata a linha como uma unidade: ela some da lista se **qualquer**
bloco do mesmo arquivo citar o texto dela, inclusive como contexto, e só olha os operadores de TypeScript
(`condicoesDaLinha`). Não há noção de termo, e `linhasNovasDaArvore` entrega as linhas sem dizer se estão dentro de
um template string, que é informação do arquivo inteiro, e não da linha.

## Teste que reproduz

`tools/processo/mutacoes.test.ts`, nos `describe` "o --faltando termo a termo (M1 da retro da F2c)" (`termosDaLinha`, o item por
termo em `linhasSemBloco`, o bloco que tira só um termo, o motivo que cita o termo), "o --faltando e o SQL ou o Lua em template
string (M1 da retro da F2c)" (`linhasDeTemplateComScript`, a linha mista, a linha de template na lista) e, na árvore de verdade, o
motivo lido do documento e o SQL e o Lua de arquivo novo e de versionado.

O teste foi escrito antes do código, mas **não houve rodada vermelha contra o código antigo**: o `import` de `termosDaLinha` e de
`linhasDeTemplateComScript` não existia no `HEAD`, e o arquivo todo cairia por erro de carga, que não prova cláusula. A prova do
vermelho é a de cada bloco da seção "Mutações": 111 mutações, cada uma deixa um caso vermelho. As três que ficaram verdes na primeira
corrida (o `'*'` do comentário de bloco, que a expressão regular comia sozinha; a crase de comentário e a de `return /`/.test(x)`, que a
paridade das crases escondia) ganharam caso próprio. Uma aspa solta que engolia a quebra de linha (`fimDoTextoEntreAspas` devolvia
`j + 1` também quando parava na quebra, e a linha do template saía uma a menos) foi achada pelo caso do apóstrofo em JSX e corrigida.

## Correção

`tools/processo/mutacoes.ts`:

- `termosDaLinha` (`LeitorDeTermos`): os termos de uma linha com vários, um grupo por parêntese, colchete ou chave. Os argumentos de
  `and(...)` e de `or(...)` (a vírgula corta) e os dois lados de `&&` e de `||` (`||=` e `&&=` não). Fora: texto entre aspas, modelo de
  texto, expressão regular e comentário. O primeiro termo da linha perde o que vem antes dele (`const x =`, `return`, `if (x) return`, `(x) => y =`). A linha que acaba com grupo aberto
  (`if (a && b && lista.some((x) =>`, a condição segue na de baixo) fecha todos eles no fim, de dentro para fora.
- `linhasSemBloco` lista a linha com vários termos **um item por termo** (`LinhaSemBloco.termo`; sem operador de TypeScript, a condição é
  `termos`). O termo só sai com um bloco do mesmo arquivo que o **tire e deixe os outros** (`blocoTiraOTermo`; trocar a linha inteira ou
  citá-la como contexto não alcança termo nenhum; os termos de dentro de um ramo saem com ele), ou com um motivo na seção "Mutações" do documento (`prosaSemBlocos`:
  só ali, fora dos blocos, e até a próxima seção) cuja crase seja **igual** ao termo: a crase com a linha inteira, ou com um nome maior
  (`podeEditarTudo` não cobre `podeEditar`), não cobre termo nenhum, e a "Correção" que cita a linha não é motivo (termo de menos de três
  caracteres não se cobre assim). A linha de um termo só segue como era.
- `linhasDeTemplateComScript` (`LeitorDeTemplates`): as linhas de um arquivo dentro de template string de SQL (a etiqueta `sql`, também `sql.raw`,
  `execute(`, `query(`) ou de Lua (`eval(`, `evalsha(`, `defineCommand(`, `lua:`, ou `redis.call(`, `KEYS[`, `ARGV[` no corpo). `linhasNovasDaArvore`
  põe o `modelo` na linha nova que cai ali, e `linhasSemBloco` a lista sem condição de TypeScript. A de dentro de um template de várias
  linhas entra sempre (menos comentário, fecho solto e `end`); a que abre, a que fecha e a de template de uma linha só (`mista`) é lida
  também como TypeScript e entra quando o Lua tem texto nela ou o SQL tem uma palavra de condição ou um operador (`now()` não tem).
- `faltandoDoDocumento`: o comando e o portão da tarefa passam pela mesma função, e a prosa do documento chega nos dois. O `portao-local.ts` não
  se testa por importar, e por isso a fiação ficou num lugar só, que o teste da árvore de verdade cobre pelo comando; a chamada do portão a
  essa função só se prova por inspeção (motivo na seção "Mutações").

- `LinhaNova` virou `LinhaAcrescentada` (o tipo de `linhasAcrescentadas`, em `mutacoes.ts` e no teste, com o comentário de `LinhaAcrescentada.modelo`). O mapa 4 da X8 classificou o `LinhaNova` como `fica` só pelo trecho exato das linhas de antes, e o código novo que o usava deixava `tools/renomear/restos.test.ts` vermelho (nove linhas). **Triagem do Arquiteto** (divergência de desenho desta correção, 15/11/2026): detalhe, e a saída é renomear o código novo; o mapa 4 não muda (onda feita não se reescreve, e a entrada `fica` sem ocorrência não pesa), e não entra entrada nova no mapa nem se solta o `de` com `arquivo` no `restos`. O parágrafo do `restos` em `tasks/prd-nomes-de-mercado/techspec.md` (§5) registra a regra e vai no mesmo commit. Sem mudança de comportamento.

Limites que ficam escritos no código e nos docs (seção "Fora desta correção"): o `and(` e o `or(` valem pelo nome; o `&&` dentro de um `and(` vira
mais um termo dele; o `and(` com um argumento por linha não é lido; o ternário deixa o `x ?` no primeiro termo; o SQL em template sem etiqueta e fora
de `execute(` e `query(` não é visto; a crase em expressão regular só é lida certa depois de `(,=:[!&|?{};` ou `return`.

Docs: `executar-task` (passo 2), `.claude/skills/criar-tasks/task-template.md` (autoconferência 1) e `.claude/rules/40-testes.md` deixam de dizer que (a) e (b)
ficam à mão, e passam a dizer o que fica (o `and(` de várias linhas, o `&&` dentro de `and(`, o ternário); o item do `TODO.md` é marcado.

## Mutações

--faltando: 2 linhas (127 blocos, 10 motivos). Cada bloco foi aplicado e rodado antes do pedido (o mesmo `conferirMutacoesDoDocumento` do portão, sobre o `comandoDoTeste`): todos ficaram vermelhos num caso que rodou e falhou, e o `falha:` de cada negativa caiu na linha dela. As 2 linhas que a ferramenta ainda lista são as de `?? ''` do motivo do `?? ''` na lista abaixo; o resto dos motivos é de termo, e a ferramenta já os tira da lista pela crase igual ao termo. Os dois últimos motivos não são de linha nem de termo da lista: são o que a Mesa pediu para ficar escrito (o mutante equivalente e a ligação do portão).

Motivos das linhas e dos termos sem bloco (cada um entre crases, que é o que o `--faltando` lê):

- Limite dos laços: `j < texto.length` (`fimDoTextoEntreAspas` e `fimDaExpressaoRegular`), `j < this.#texto.length` (modelo de texto do leitor de termos) e `this.#i < this.#fonte.length` (comentário de linha e modelo do leitor de templates). Só impedem ler depois do fim do texto. Sem eles o laço de um texto que acaba sem fechar não termina (`undefined` não é a aspa, nem a quebra, nem a crase), e o teste que o provaria cai no prazo da corrida, que o portão recusa como estouro, e não como vermelho. O outro termo de cada laço tem bloco.
- `this.#i === 0`, em `depoisDeEspaco`: a linha de comentário inteira sai antes, em `termosDaLinha`, e `//` na coluna 0 de uma linha que passou dali não existe. O `?? ''` do mesmo termo, sobre `this.#texto[this.#i - 1]`, só serve ao tipo (`i` é maior que zero ali). O outro termo tem bloco.
- `proximo !== '/'`, em `#barra` do leitor de termos: o `//` colado ao texto chega a esse ramo, e sem o termo só muda para `=//` (duas barras logo depois de `=`), que nenhum código escreve. O outro termo tem bloco.
- `c === '('`, em `chamada`: `and[` e `or{` não são chamada de função; o outro termo (o nome `and` ou `or` antes do parêntese) tem bloco, e é ele que separa `eq(a, b)` de `and(a, b)`.
- `indice === 0`, em `#termo`: só o primeiro operando da linha tem o que tirar antes do termo (`const x =`, `return`); os de depois não começam por atribuição nem por `return` em TypeScript válido. O outro termo (`ehTopo`) tem bloco.
- `ehTopo` e `indice === ultimo`, na linha do `replace(/[\s,;{]+$/, '')`: só o último operando do topo da linha acaba em `;`. O último de um grupo de dentro acaba antes do `)`, e o primeiro operando termina antes do operador, sem nada a cortar; tirar um dos dois termos não muda resultado. O bloco da linha tira a expressão regular inteira e o caso `x = a && b;` cai.
- `?? ''`, em `const c = this.#fonte[this.#i] ?? ''` (nos dois leitores de template, linhas iguais, e no leitor de termos): o índice está sempre dentro do texto (`i < length`), e o valor padrão só existe para o `noUncheckedIndexedAccess`. O `?? ''` de `achado[1]` (`emCrases`) é o mesmo: o grupo 1 da expressão regular sempre casa.
- `(outro) => outro !== termo`, nos dois `filter` de `blocoTiraOTermo` (`deDentro` e `outros`): o termo é igual a si mesmo, e as duas linhas já o excluem por outro caminho. Em `deDentro`, a linha de cima já devolveu `false` se o termo estivesse em `depois`; em `outros`, `!contemOTermo(termo, outro)` é falso para `outro === termo`. Tirá-lo não muda resultado; o termo de cada uma das duas linhas que tem efeito tem bloco.
- `if (this.#recente.length > 64) this.#recente = this.#recente.slice(-16)`, em `#comum` do leitor de templates: o mutante é equivalente. `ANTES_DE_REGEX` só olha `slice(-8)` do `#recente`, e o `if` só impede que ele cresça sem teto; sem o `if`, ou com outro limite, nenhum resultado muda, e a linha só é alcançada como contexto de outro bloco.
- `faltandoDoDocumento(raiz, textoDoDocumento, documento)`, na chamada do `--faltando` dentro de `portao-local.ts`: o portão não se testa por importar, e a ligação só se prova por inspeção (o `git diff` do arquivo mostra a chamada, no lugar das três linhas que montavam o relatório). O que a função devolve, com a prosa do documento, é o que o teste da árvore de verdade prova pelo comando `--faltando`, que passa pela mesma função.

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
+const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
+const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
+const ANTES_DO_PRIMEIRO_TERMO = /^(?:return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
+const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)\s*)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=>])\s*)/
+const ANTES_DO_PRIMEIRO_TERMO = /^(?:(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=]+?)?\s*=(?![=>])\s*|return\s+|[\w$.[\]]+\s*(?:[|&?]{2}=|=)(?![=])\s*)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO_DEPOIS_DE_PARENTESES = /^.*?\)\s+(?:=>\s*|return\s+)/
+const ANTES_DO_PRIMEIRO_TERMO_DEPOIS_DE_PARENTESES = /^.*?\)\s+(?:=>\s*)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DO_PRIMEIRO_TERMO_DEPOIS_DE_PARENTESES = /^.*?\)\s+(?:=>\s*|return\s+)/
+const ANTES_DO_PRIMEIRO_TERMO_DEPOIS_DE_PARENTESES = /^.*?\)\s+(?:return\s+)/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};]|\breturn)$/
+const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};])$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};]|\breturn)$/
+const ANTES_DE_REGEX = /(?:[(,=:[!&|?{};]|\breturn)$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};]|\breturn)$/
+const ANTES_DE_REGEX = /(?:^|[(,:[!&|?{};]|\breturn)$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < texto.length && texto[j] !== aspa && texto[j] !== '\n') j += texto[j] === '\\' ? 2 : 1
+while (j < texto.length && texto[j] !== '\n') j += texto[j] === '\\' ? 2 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < texto.length && texto[j] !== aspa && texto[j] !== '\n') j += texto[j] === '\\' ? 2 : 1
+while (j < texto.length && texto[j] !== aspa) j += texto[j] === '\\' ? 2 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < texto.length && texto[j] !== aspa && texto[j] !== '\n') j += texto[j] === '\\' ? 2 : 1
+while (j < texto.length && texto[j] !== aspa && texto[j] !== '\n') j += texto[j] === '\\' ? 1 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < texto.length && texto[j] !== '\n') {
+while (j < texto.length) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (c === '\\') j += 2
+if (c === '\\') j += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (c === '[') naClasse = true
+if (c === '[') naClasse = false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-else if (c === ']') naClasse = false
+else if (c === ']') naClasse = true
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-else if (c === '/' && !naClasse) return j + 1
+else if (!naClasse) return j + 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-else if (c === '/' && !naClasse) return j + 1
+else if (c === '/') return j + 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 const c = this.#texto[this.#i] ?? ''
-const tratar = this.#tratadores[c] ?? ((outro: string) => this.#comum(outro))
+const tratar = this.#tratadores[c] ?? ((outro: string) => { this.#i += 1 })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (!/\s/.test(c)) this.#recente += c
+this.#recente += c
 this.#i += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < this.#texto.length && this.#texto[j] !== '`') j += this.#texto[j] === '\\' ? 2 : 1
+while (j < this.#texto.length) j += this.#texto[j] === '\\' ? 2 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (j < this.#texto.length && this.#texto[j] !== '`') j += this.#texto[j] === '\\' ? 2 : 1
+while (j < this.#texto.length && this.#texto[j] !== '`') j += this.#texto[j] === '\\' ? 1 : 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-const depoisDeEspaco = this.#i === 0 || /\s/.test(this.#texto[this.#i - 1] ?? '')
+const depoisDeEspaco = this.#i === 0
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (proximo === '/' && depoisDeEspaco) {
+if (proximo === '/') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (proximo === '/' && depoisDeEspaco) {
+if (depoisDeEspaco) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (proximo === '*') {
+} else if (proximo === '+') {
 const fim = this.#texto.indexOf('*/', this.#i + 2)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-this.#i = fim === -1 ? this.#texto.length : fim + 2
+this.#i = fim === -1 ? this.#i + 2 : fim + 2
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-this.#i = fim === -1 ? this.#texto.length : fim + 2
+this.#i = fim === -1 ? this.#texto.length : fim + 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (proximo !== '/' && ANTES_DE_REGEX.test(this.#recente.slice(-8))) {
+} else if (proximo !== '/') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (this.#texto[this.#i + 1] !== c) return this.#comum(c)
+if (false) return this.#comum(c)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (this.#texto[this.#i + 2] === '=') this.#i += 3
+if (this.#texto[this.#i + 2] === '¬') this.#i += 3
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-const chamada = c === '(' && /(?:^|[^\w$])(?:and|or)$/.test(this.#texto.slice(0, this.#i))
+const chamada = c === '('
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (this.#grupos.length > 1) {
+if (true) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (grupo.chamada) this.#cortar(grupo, this.#i, this.#i + 1)
+if (false) this.#cortar(grupo, this.#i, this.#i + 1)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: termosDaLinha(linha)).toEqual([])
-if (termos.length >= 2) this.#achados.push(...termos)
+if (termos.length >= 1) this.#achados.push(...termos)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (ehTopo && indice === 0) termo = soOTermo(termo)
+if (indice === 0) termo = soOTermo(termo)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (ehTopo && indice === ultimo) termo = termo.replace(/[\s,;{]+$/, '')
+if (ehTopo && indice === ultimo) termo = termo.replace(/$^/, '')
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (grupo.logico && indice === ultimo) termo = termo.replace(/\s\?\s[\s\S]*$/, '')
+if (indice === ultimo) termo = termo.replace(/\s\?\s[\s\S]*$/, '')
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (grupo.logico && indice === ultimo) termo = termo.replace(/\s\?\s[\s\S]*$/, '')
+if (grupo.logico) termo = termo.replace(/\s\?\s[\s\S]*$/, '')
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return /^(?:\/\/|\/\*|\*)/.test(aparada) ? [] : new LeitorDeTermos(aparada).ler()
+return false ? [] : new LeitorDeTermos(aparada).ler()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const MARCAS_DE_LUA = /\bredis\.p?call\s*\(|\b(?:KEYS|ARGV)\s*\[/
+const MARCAS_DE_LUA = /\b(?:KEYS|ARGV)\s*\[/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const MARCAS_DE_LUA = /\bredis\.p?call\s*\(|\b(?:KEYS|ARGV)\s*\[/
+const MARCAS_DE_LUA = /\bredis\.p?call\s*\(/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(|\blua\s*:\s*$/i
+const ANTES_DE_LUA = /\b(?:eval|defineCommand)\s*\(|\blua\s*:\s*$/i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(|\blua\s*:\s*$/i
+const ANTES_DE_LUA = /\b(?:eval|evalsha)\s*\(|\blua\s*:\s*$/i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(|\blua\s*:\s*$/i
+const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(/i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(|\blua\s*:\s*$/i
+const ANTES_DE_LUA = /\b(?:eval|evalsha|defineCommand)\s*\(|\blua\s*:\s*$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_SQL = /\b(?:execute|query)\s*\(\s*$/
+const ANTES_DE_SQL = /\b(?:query)\s*\(\s*$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_SQL = /\b(?:execute|query)\s*\(\s*$/
+const ANTES_DE_SQL = /\b(?:execute)\s*\(\s*$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (/(?:^|[^\w$])sql(?:\.\w+)?$/.test(antes)) return 'sql'
+if (/(?:^|[^\w$])sql$/.test(antes)) return 'sql'
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: const q = mysql
-if (/(?:^|[^\w$])sql(?:\.\w+)?$/.test(antes)) return 'sql'
+if (/sql(?:\.\w+)?$/.test(antes)) return 'sql'
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (ANTES_DE_LUA.test(naLinha) || MARCAS_DE_LUA.test(corpo)) return 'lua'
+if (MARCAS_DE_LUA.test(corpo)) return 'lua'
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (ANTES_DE_LUA.test(naLinha) || MARCAS_DE_LUA.test(corpo)) return 'lua'
+if (ANTES_DE_LUA.test(naLinha)) return 'lua'
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
falha: toEqual(['3 sql'])
-return ANTES_DE_SQL.test(naLinha) ? 'sql' : null
+return ANTES_DE_SQL.test(naLinha) ? 'sql' : 'sql'
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const CONDICAO_DE_SQL = /\b(?:where|and|or|on|case|when|having|exists|not|is|in|between|like|limit|join|union)\b|[=<>]/i
+const CONDICAO_DE_SQL = /\b(?:where|and|or|on|case|when|having|exists|not|is|in|between|like|limit|join|union)\b/i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const CONDICAO_DE_SQL = /\b(?:where|and|or|on|case|when|having|exists|not|is|in|between|like|limit|join|union)\b|[=<>]/i
+const CONDICAO_DE_SQL = /[=<>]/i
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (deInterpolacao && c === '}' && chaves === 0) {
+if (c === '}' && chaves === 0) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (deInterpolacao && c === '}' && chaves === 0) {
+if (deInterpolacao && chaves === 0) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (deInterpolacao && c === '}' && chaves === 0) {
+if (deInterpolacao && c === '}') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (deInterpolacao) chaves += saldoDeChaves(c)
+if (deInterpolacao) chaves += 0
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 if (deInterpolacao) chaves += saldoDeChaves(c)
-const tratar = this.#tratadores[c] ?? ((outro: string) => this.#comum(outro))
+const tratar = this.#tratadores[c] ?? ((outro: string) => { this.#i += 1 })
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (!/\s/.test(c)) this.#recente += c
+this.#recente += c
 if (this.#recente.length > 64) this.#recente = this.#recente.slice(-16)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (proximo === '/') {
+if (proximo === '¬') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (this.#i < this.#fonte.length && this.#fonte[this.#i] !== '\n') this.#i += 1
+while (this.#i < this.#fonte.length) this.#i += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (proximo === '*') {
+} else if (proximo === '+') {
 const fim = this.#fonte.indexOf('*/', this.#i + 2)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const fechado = fim === -1 ? this.#fonte.length : fim + 2
+const fechado = fim === -1 ? this.#fonte.length : fim + 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (ANTES_DE_REGEX.test(this.#recente.slice(-8))) {
+} else if (true) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (this.#i < this.#fonte.length && this.#fonte[this.#i] !== '`') this.#passoDoModelo(modelo)
+while (this.#i < this.#fonte.length) this.#passoDoModelo(modelo)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (c === '\\') {
+if (c === '¬') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (this.#fonte[this.#i + 1] === '\n') this.#linha += 1
+if (this.#fonte[this.#i + 1] === '¬') this.#linha += 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (c === '$' && this.#fonte[this.#i + 1] === '{') {
+} else if (this.#fonte[this.#i + 1] === '{') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-} else if (c === '$' && this.#fonte[this.#i + 1] === '{') {
+} else if (c === '$') {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (c === '\n') this.#linha += 1
+if (c === '\n') this.#linha += 0
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (dele === null) return
+if (false) return
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (texto.trim() === '') continue
+if (texto.trim() === '¬') continue
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const mista = numero === modelo.abre || numero === this.#linha
+const mista = numero === this.#linha
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const mista = numero === modelo.abre || numero === this.#linha
+const mista = numero === modelo.abre
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (mista && dele === 'sql' && !CONDICAO_DE_SQL.test(texto)) continue
+if (dele === 'sql' && !CONDICAO_DE_SQL.test(texto)) continue
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (mista && dele === 'sql' && !CONDICAO_DE_SQL.test(texto)) continue
+if (mista && !CONDICAO_DE_SQL.test(texto)) continue
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (mista && dele === 'sql' && !CONDICAO_DE_SQL.test(texto)) continue
+if (mista && dele === 'sql') continue
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (c === '{') return 1
+if (c === '{') return 0
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return c === '}' ? -1 : 0
+return c === '}' ? 0 : 0
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const comeco = /^[\w$]/.test(termo) ? '(?<![\\w$.])' : ''
+const comeco = /^[\w$]/.test(termo) ? '' : ''
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const fim = /[\w$]$/.test(termo) ? '(?![\\w$])' : ''
+const fim = /[\w$]$/.test(termo) ? '' : ''
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return new RegExp(`${comeco}${escapar(termo)}${fim}`).test(linha)
+return new RegExp(`${comeco}${termo}${fim}`).test(linha)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (!mutacao.antes.some((linha) => contemOTermo(linha, termo))) return false
+if (false) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (mutacao.depois.some((linha) => contemOTermo(linha, termo))) return false
+if (false) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const deDentro = termos.filter((outro) => outro !== termo && contemOTermo(termo, outro))
+const deDentro = termos.filter((outro) => outro !== termo)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (deDentro.some((outro) => mutacao.depois.some((linha) => contemOTermo(linha, outro)))) return false
+if (false) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const outros = termos.filter((outro) => outro !== termo && !contemOTermo(termo, outro) && !contemOTermo(outro, termo))
+const outros = termos.filter((outro) => outro !== termo && !contemOTermo(outro, termo))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const outros = termos.filter((outro) => outro !== termo && !contemOTermo(termo, outro) && !contemOTermo(outro, termo))
+const outros = termos.filter((outro) => outro !== termo && !contemOTermo(termo, outro))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (/^(?:--|\/\/)/.test(aparada) || !/[\p{L}\d]/u.test(aparada)) return false
+if (!/[\p{L}\d]/u.test(aparada)) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (/^(?:--|\/\/)/.test(aparada) || !/[\p{L}\d]/u.test(aparada)) return false
+if (/^(?:--|\/\/)/.test(aparada)) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return !/^(?:end|else|then|do)[\s,;)]*$/i.test(aparada)
+return !/^(?:xend)[\s,;)]*$/i.test(aparada)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-.filter((termo) => !contexto.cobertoPorMotivo(termo) && !doArquivo.some((mutacao) => blocoTiraOTermo(mutacao, termo, termos)))
+.filter((termo) => !doArquivo.some((mutacao) => blocoTiraOTermo(mutacao, termo, termos)))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-.filter((termo) => !contexto.cobertoPorMotivo(termo) && !doArquivo.some((mutacao) => blocoTiraOTermo(mutacao, termo, termos)))
+.filter((termo) => !contexto.cobertoPorMotivo(termo))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return [...condicoesDaLinha(nova.texto), ...(nova.modelo === undefined ? [] : [nova.modelo])]
+return [...condicoesDaLinha(nova.texto), ...(nova.modelo === undefined ? [] : [])]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (nova.modelo !== undefined && nova.mista !== true) {
+if (nova.mista !== true) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (nova.modelo !== undefined && nova.mista !== true) {
+if (nova.modelo !== undefined) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return ehCodigoDoTemplate(nova.texto) && !alcancada ? [{ ...nova, condicoes: [nova.modelo] }] : []
+return !alcancada ? [{ ...nova, condicoes: [nova.modelo] }] : []
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return ehCodigoDoTemplate(nova.texto) && !alcancada ? [{ ...nova, condicoes: [nova.modelo] }] : []
+return ehCodigoDoTemplate(nova.texto) ? [{ ...nova, condicoes: [nova.modelo] }] : []
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (termos.length >= 2) return itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)
+if (termos.length >= 3) return itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-if (termos.length >= 2) return itensPorTermo(nova, condicoes.length > 0 ? condicoes : ['termos'], termos, contexto)
+if (termos.length >= 2) return itensPorTermo(nova, condicoes, termos, contexto)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return condicoes.length > 0 && !alcancada ? [{ ...nova, condicoes }] : []
+return !alcancada ? [{ ...nova, condicoes }] : []
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return condicoes.length > 0 && !alcancada ? [{ ...nova, condicoes }] : []
+return condicoes.length > 0 ? [{ ...nova, condicoes }] : []
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › sobre uma árvore de verdade
-return doTemplate === undefined ? nova : { ...nova, modelo: doTemplate.modelo, mista: doTemplate.mista }
+return doTemplate === undefined ? nova : nova || { ...nova, modelo: doTemplate.modelo, mista: doTemplate.mista }
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-(nova) => `  ${nova.arquivo}:${String(nova.linha)}  [${nova.condicoes.join(' ')}]  ${nova.texto.trim()}${nova.termo === undefined ? '' : `  (termo \`${nova.termo}\`)`}`,
+(nova) => `  ${nova.arquivo}:${String(nova.linha)}  [${nova.condicoes.join(' ')}]  ${nova.texto.trim()}${true ? '' : `  (termo \`${nova.termo}\`)`}`,
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return texto[j] === aspa ? j + 1 : j
+return texto[j] === aspa ? j + 1 : j + 1
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-modelo.textoPorLinha.set(this.#linha, (modelo.textoPorLinha.get(this.#linha) ?? '') + texto)
+modelo.textoPorLinha.set(this.#linha, (modelo.textoPorLinha.get(this.#linha) ?? 'x') + texto)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-cobertoPorMotivo: (termo) => termo.length >= MENOR_TERMO_COM_MOTIVO && emCrases.has(termo),
+cobertoPorMotivo: (termo) => emCrases.has(termo),
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-cobertoPorMotivo: (termo) => termo.length >= MENOR_TERMO_COM_MOTIVO && emCrases.has(termo),
+cobertoPorMotivo: (termo) => termo.length >= MENOR_TERMO_COM_MOTIVO,
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-cobertoPorMotivo: (termo) => termo.length >= MENOR_TERMO_COM_MOTIVO && emCrases.has(termo),
+cobertoPorMotivo: (termo) => termo.length >= MENOR_TERMO_COM_MOTIVO && [...emCrases].some((trecho) => trecho.includes(termo)),
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const emCrases = new Set([...prosa.matchAll(/`([^`\n]+)`/g)].map((achado) => (achado[1] ?? '').trim()))
+const emCrases = new Set([...prosa.matchAll(/`([^`\n]+)`/g)].map((achado) => (achado[1] ?? '')))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const secao = /^## Mutações[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(documento)
+const secao = [documento, documento]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const secao = /^## Mutações[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(documento)
+const secao = /^## Mutações[^\n]*\n([\s\S]*?)(?![\s\S])/m.exec(documento)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const secao = /^## Mutações[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(documento)
+const secao = /^## Mutações[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/.exec(documento)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return (secao?.[1] ?? '').replace(BLOCO, '')
+return (secao?.[1] ?? documento).replace(BLOCO, '')
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-while (this.#grupos.length > 0) {
+while (this.#grupos.length > 1) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-this.#fechar(this.#topo(), this.#fim, this.#grupos.length === 1)
+this.#fechar(this.#topo(), this.#fim, true)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 readonly #tratadores: Record<string, (c: string) => void> = {
 "'": () => this.#aspas(),
-'"': () => this.#aspas(),
+'"': () => this.#comum('"'),
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 },
 "'": () => this.#aspas(),
-'"': () => this.#aspas(),
+'"': () => this.#comum('"'),
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};]|\breturn)$/
+const ANTES_DE_REGEX = /(?:^|[,=:[!&|?{};]|\breturn)$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const ANTES_DE_REGEX = /(?:^|[(,=:[!&|?{};]|\breturn)$/
+const ANTES_DE_REGEX = /(?:^|[(=:[!&|?{};]|\breturn)$/
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 this.#grupos.push({ de: this.#i + 1, chamada, logico: false, operandos: [] })
 this.#i += 1
-this.#recente += c
+void c
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
 grupo.de = this.#i + 1
 }
 this.#i += 1
-this.#recente += c
+void c
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-return termo.replace(ANTES_DO_PRIMEIRO_TERMO, '').trim()
+return termo.trim()
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o --faltando|as linhas novas de produção com condição que nenhum bloco alcança
-const termos = [...new Set(termosDaLinha(nova.texto))]
+const termos = termosDaLinha(nova.texto)
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `LeitorDeTermos` e `LeitorDeTemplates` repetem `#comum`, `#aspas` e o grosso de `#barra`; uma base comum tiraria a duplicação | `TODO.md`: é refatoração de ~100 linhas num arquivo que já leva mais de cem blocos de mutação e anularia as provas desta correção |
| privacy-guardian (2ª) e tenancy-guardian (1ª) | Item aberto no `TODO.md` para a ferramenta juntar as linhas de um `and(`/`or(` de várias linhas antes de partir em termos (a `eq(t.escolaId, escolaId),` sozinha é a cláusula de escopo da regra 10 e fica fora da lista); guardiões `test-engineer` e `tenancy-guardian` | `TODO.md`: item novo (hoje o limite só aparece no item fechado `[x]` da M1). Muda código de processo, entra por correção própria |
| tenancy-guardian (1ª) | Escrever no `executar-task` ou na regra 40 que termo de escopo de tenant (`escolaId`) não se cobre por motivo na seção "Mutações", só por bloco | `TODO.md`, no mesmo item acima: muda a regra do `--faltando` ou o texto de duas skills, e a decisão sobre a ferramenta recusar o motivo para `escolaId` é de correção própria |
| revisor-geral (2ª) e test-engineer (2ª) | A linha "Docs:" diz que `.claude/rules/40-testes.md` "passa a dizer o que fica", mas o trecho alterado só acrescenta o que a ferramenta passou a ver; ou acrescentar os limites à regra 40, ou corrigir a frase | `TODO.md`, no mesmo item: os limites ficam escritos nos cinco lugares que o test-engineer exigiu na r1; a frase do documento acompanha quando o item for feito |
| revisor-geral (2ª) | `prosaSemBlocos` reconhece só o título `## Mutações` de nível 2; uma linha no comentário da função | `TODO.md`, no mesmo item: o erro é para o lado seguro (a lista sai maior) |
| test-engineer (2ª) | O `this.#grupos.pop()` do laço novo de `ler()` não tem bloco: meia linha de motivo na seção "Mutações" (sem ele o laço é infinito e o portão o recusa como estouro de prazo) | `TODO.md`, no mesmo item: o limite dos laços já tem motivo escrito na seção, e esta linha entra junto quando ela for reaberta |
| test-engineer (2ª) | `prosaSemBlocos`: a seção "Mutações" termina na primeira linha que começa com `## `, mesmo dentro de um bloco cercado dela; um caso ou uma linha no comentário | `TODO.md`, no mesmo item: caso raro, o erro também é para o lado seguro |
| test-engineer (2ª) | Os casos do ternário e do `and(` de uma linha só fixam como teste o que o código chama de limite: dizer isso no nome dos casos ou no `TODO.md` | `TODO.md`, no mesmo item: o item sobre o limite do `and(` e do ternário diz que esses casos ficam vermelhos quando o limite for corrigido |
| test-engineer (2ª) | O documento dizia "11 motivos" e a lista tem 10 itens | Acertado: o cabeçalho de "Mutações" diz agora "10 motivos" (a ferramenta não imprime a contagem, o número é escrito à mão) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 12:56:05 | 2026-11-15 12:56:33 | `privacy-guardian` | 1 | APROVADO | aaccb7f6fe2eee590 |
| 2026-11-15 12:56:03 | 2026-11-15 12:58:19 | `revisor-geral` | 1 | REPROVADO | abef5efe6e8682e0c |
| 2026-11-15 12:56:02 | 2026-11-15 12:59:28 | `test-engineer` | 1 | REPROVADO | a615a2371db69f2dd |
| 2026-11-15 13:27:45 | 2026-11-15 13:28:04 | `privacy-guardian` | 2 | APROVADO | a5d4a8316bf717bad |
| 2026-11-15 13:27:46 | 2026-11-15 13:28:11 | `tenancy-guardian` | 1 | APROVADO | abaaa1f4803936e94 |
| 2026-11-15 13:27:41 | 2026-11-15 13:28:48 | `revisor-geral` | 2 | APROVADO | a427677da5af72bf6 |
| 2026-11-15 13:27:32 | 2026-11-15 13:29:37 | `test-engineer` | 2 | APROVADO | a14a9b8685a7f891b |
