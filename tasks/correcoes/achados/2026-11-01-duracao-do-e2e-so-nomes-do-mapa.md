# Achados das revisões — `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-01 13:34:22 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica; a mudança fica em `tools/ci/` e `tools/processo/`, fora de `apps/` e `packages/`)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica; é um script de portão que roda uma vez, sem estado compartilhado nem gravação)
Índice e paginação: ok (não se aplica; nenhuma query nem tabela)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica; nenhum código no caminho quente e nenhum alerta novo)
Bloqueantes: nenhum
Recomendações:
- Hoje, alterar qualquer arquivo em `tools/renomear/mapas/*.json` na árvore libera da régua de duração todo caso cujos nomes batam com as entradas `simbolo` desse mapa (`nomesDoMapaDaOnda` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`). O risco é pequeno, porque a comparação é token a token e a contagem de tokens não pode mudar. Mesmo assim, vale registrar no `11.relatorio.md` que a isenção vale só enquanto a onda não for commitada, para que um mapa editado fora de uma onda não passe despercebido.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/portao-local.ts:195`, a lista "Só rename na régua de duração" só sai no stdout. Se o relatório da onda depende dela (a marca da 11.5), gravá-la também num arquivo em `.processo/` evita copiar à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-01 13:34:31 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em ferramenta de processo: a régua que mede quanto tempo cada caso de e2e leva (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`), o teste dela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts`) e a saída do portão (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/portao-local.ts`). Não há migration, schema, DTO, repository nem endpoint.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Não há rota nova nem leitura de objeto de domínio.

Logs: limpos. A linha nova em `tools/processo/portao-local.ts:893-896` imprime caminho do spec, linha, projeto do Playwright, duração e título do caso de e2e. É o mesmo tipo de dado que `avisoDosCasosLentos` já imprimia. Os títulos são nomes de teste sobre fixture sintética, não dado de titular. Nada vai a serviço externo.

Auditoria: não se aplica. Nenhuma das ações que a regra 20, item 10, manda auditar é tocada.

Envio externo: nenhum. A ferramenta só lê o git local (`git show HEAD:<arquivo>`, `git ls-files`, `git diff --name-only`), os mapas de `tools/renomear/mapas/*.json` e o relatório JSON do Playwright. Não chama provedor de IA nem serviço de terceiro.

Seed/fixture: sintético. Os testes montam repositórios temporários com specs inventados (`test('segundo', ...)`, `await a()`, `b` → `bb`) e relatórios com durações fabricadas. Não há nome, matrícula, nota nem conteúdo de aluno.

Bloqueantes: nenhum.

Recomendações:
- Os `catch` vazios em `mapasDaOnda` e `entradasDoMapa` (`tools/ci/duracao-do-e2e.ts:704-709` e `719-726`) fazem um mapa que não se lê ser tratado como "sem isenção", o que é o lado seguro. Não vaza nada, mas o portão poderia avisar quando um mapa da onda existe e não se lê, para o caso não parecer lento sem explicação. Isso é questão de régua, não de privacidade, e cabe ao `revisor-geral`.
- A lista dos 55 casos isentos fica em `.processo/conferencia-duracao-l3.txt`, fora do git. Ela só tem caminho, linha e título de e2e, então não há risco LGPD. Vale só manter esse padrão: o que o portão grava em `.processo/` continua sendo dado de teste, nunca saída de banco de desenvolvimento.

Pergunta de fechamento: esta tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então a resposta continua a mesma de antes dela.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-01 13:35:53 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. A correção faz a régua de duração do e2e deixar de cobrar o caso que só teve nomes trocados pelo mapa da onda, com as duas ampliações. O portão só imprime a lista; copiá-la no `11.relatorio.md` fica para a 11.5.

**Aderência à Tech Spec:** ok. As ampliações (a) e (b) estão escritas na §13 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/prd-nomes-de-mercado/techspec.md`, e o código segue o que ela descreve.

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:521-522` (`parDoCasoDeModelo`)
   - **O que está errado:** no caso de título de modelo (`${}`), a cópia é procurada na árvore por igualdade exata, sem o mapa (`new Map()`). Já o par no HEAD é procurado com o mapa (`nomes`). Resultado: dois casos da árvore cujos títulos diferem só por um nome do mapa ficam ambos com o mesmo caso do HEAD como par. Um caso novo escapa da régua.
   - **Reprodução:** montei um repositório de teste.
     - HEAD: um único caso, `` test(`modelo ${b}`, … await b()) ``, com o mapa `b` → `bb` fora do git.
     - Árvore: um caso novo, `` test(`modelo ${bb}`, … await bb()) ``, entrou acima dele. O original ficou intacto, com o nome velho, o que é válido: é o homônimo local da própria ampliação (a).
     - Resultado: o caso novo, a 19 s, sai isento (`motivo: null`, `isentos: [2]`).
   - **Por que é bug:** contradiz o que o próprio código documenta ("Título repetido na árvore (o caso copiado) … sem par") e o princípio do módulo de cobrar mais, nunca menos. O teste "título de modelo copiado na árvore não tem par" só cobre a cópia idêntica byte a byte.
   - **Correção exigida:**
     - O par tem de ser um para um: o caso do HEAD achado só vale se for também o único caso de modelo do HEAD que a regra (a) liga a um único caso de modelo da árvore. Na prática, contar na árvore os casos de modelo cujo título bate com o do candidato do HEAD usando `nomes`, e não `new Map()`, e exigir exatamente 1.
     - Acrescentar o teste "cópia com o nome do mapa trocado num dos dois: o caso novo continua medido".
     - Acrescentar a mutação correspondente no documento da correção.

**Recomendações:**

- `duracao-do-e2e.ts:592-597`: `ANTES_DE_DIVISAO(K)` monta um `Set` novo a cada `/` lida. Basta montá-lo uma vez, ao carregar o `typescript`.
- `tools/processo/portao-local.ts:195`: `casosIsentosPorSoRename` refaz a análise inteira que `motivoDaDuracaoDoE2e` acabou de fazer (o `git show` e a leitura de cada spec tocado). Uma função que devolva as duas respostas de uma vez evita o trabalho dobrado.
- `duracao-do-e2e.ts:197-200`: o comentário de `tituloLiteral` ainda diz que "o HEAD não o diz". Desde a ampliação (b), o caso de modelo tem par por `casosDeTituloDeModelo`. Vale apontar para lá.
- `duracao-do-e2e.ts:677`: a linha é longa demais para ler a regra de uma vez. Extrair o critério para uma constante nomeada antes da chamada ajudaria.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-01 13:36:26 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: o caso só renomeado pelo mapa da onda sai da régua.
- Bordas: a quebra de linha e a vírgula que o prettier refaz; um `de` com dois `para`; um nome local homônimo; uma palavra-chave no mapa; o nome dentro de um texto, de um modelo de texto ou de uma regex; o caso que cresceu depois do `})`; o título de modelo (`${}`) com par pela linha, repetido no HEAD ou copiado na árvore; o comentário de bloco que desloca a linha; um objeto `{}` dentro de `${}`; um comentário depois do `test(` que passa do fim da linha.
- "Permissão": o mapa já commitado não isenta, a entrada que não é `simbolo` não isenta, e sem mapa não há isenção.
- Isolamento e concorrência não se aplicam: é ferramenta de processo, só leitura, sem dado de escola.

Cobertos:
- Rodei `npx vitest run tools/ci/duracao-do-e2e.test.ts`: 91 de 91 passaram, sem `.skip`, sem `.only` e sem mock.
- Cada linha de "Teste que reproduz" tem o seu teste com o nome citado, inclusive os itens juntados por ponto e vírgula nas ampliações (a) e (b) e o teste antigo reescrito com o irmão.
- As 24 mutações citam testes que existem e, pelo que li, cada uma chega à cláusula pelo motivo certo.
- Não há chamada a provedor de IA.

Bloqueantes:

1. **`tools/ci/duracao-do-e2e.ts:603` e `:605`: o rastreio de `chave` na pilha de `proximoToken` é cláusula nova sem bloco e sem cenário que a prove.** São as linhas `if (tipo === K.OpenBraceToken) abertos.push('chave')` e `else if (tipo === K.CloseBraceToken) abertos.pop()`.
   - O teste da linha 875 diz provar que "o `}` do `if`, aberto antes do modelo, não pode ser tomado por continuação dele". Só que o `{` do `if` vem antes do `${`, e o `at(-1)` olha o topo da pilha, que é `modelo` de qualquer jeito. Tirando qualquer uma das duas linhas, o teste continua verde (verifiquei pelo raciocínio, sem mutar arquivo).
   - O que essas linhas guardam é o `{` dentro de `${}`, como em ``a(`x ${f({ k: b })} y`)``. Sem elas, o `}` do objeto é relido como continuação do modelo, e o código vira texto.
   - Correção exigida: um teste com objeto ou bloco dentro de `${}`, com o nome do mapa depois do modelo. Mais um bloco `mutacao` para cada uma das duas linhas citando esse teste.

2. **`tools/ci/duracao-do-e2e.ts:363`: o `if (de - removido > deslocamento) break` de `linhaNoOriginal` não tem bloco e nenhum teste o derruba.**
   - Os testes da linha 1032 e da 1039, e o reescrito com `repositorioComNotaNoSegundo`, só têm comentário antes do `test(` ou comentário curto depois dele. Os de depois têm 14 a 28 caracteres, menos que o resto da linha do `test(`, então sem o `break` a linha calculada sai igual e tudo passa.
   - O risco é real e cobra menos. Sem o `break`, um comentário longo ou de várias linhas no corpo, ou num caso mais abaixo, empurra a linha do caso de modelo. Ela pode cair na de outro caso medido, que então pega o par errado e sai da régua indevidamente.
   - Correção exigida: um teste de título de modelo com comentário de bloco de várias linhas depois do `test(`, no corpo ou num caso seguinte, que confira a linha (isento e listado na linha certa, ou o outro caso continuando medido). Mais o bloco `mutacao` do `break`.

Recomendações:
- `:379`, o `if (tituloLiteral(corpo) !== null) return []` de `casosDeTituloDeModelo`, não tem bloco. Pode ser mutação equivalente para os casos de hoje. Se for, registrar o motivo no documento; se não for, um teste em que caso literal e caso de modelo dividem o arquivo.
- `:568`: se `entradas` vier como objeto que não é array, o `Array.isArray` devolve `[]` e está certo. Mas qualquer outro formato que passe e não seja iterável quebra o `for...of` de `nomesDoMapaDaOnda` fora de `try`. Vale um teste de mapa malformado (JSON quebrado, `entradas` objeto) que prove que a régua só perde a isenção.
- `:552`: o filtro `endsWith('.json') && existsSync(...)` não tem teste, e o `catch` de `entradasDoMapa` deixa o `existsSync` provavelmente equivalente. Fica registrado.
- `ANTES_DE_DIVISAO`: nenhum caso cobre a divisão de verdade (`a / b` seguido de nome do mapa), nem o `SlashEqualsToken`. Um caso com `x / b` no corpo protege os membros do conjunto.
- `tools/processo/portao-local.ts:195-196`: só o texto é provado, que é o padrão aceito para o portão, que não tem teste de unidade. A condição `daTarefa && alvos.e2e.length > 0` fica sem teste.
- Os outros itens que `node tools/processo/mutacoes.ts --faltando` lista são código movido sem mudança de comportamento (`parDoCasoLiteral`, `limiteDosCasos`, `motivo in analise`), já cobertos pelos testes antigos, ou `??` defensivos.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/portao-local.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-01 13:51:16 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff desde a 1ª rodada só mexe na régua de duração do e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`), no teste dela e no texto da tarefa. É código de CI que lê spec do Playwright, o mapa de rename e o relatório de duração. Não lê nem grava dado de pessoa. A árvore de trabalho é igual a `b8b81ada` nesses caminhos, então o que auditei é o que está no disco.
Fora da tabela de dados do docs/lgpd.md: nada; nenhum campo novo.
Autorização por objeto: não se aplica (não há rota, repository nem endpoint).
Logs: limpos. Não há `console`, logger nem chamada de rede no arquivo alterado. O "http" que aparece é só um exemplo dentro de um comentário (linha 207).
Auditoria: não se aplica (nenhuma ação da lista da regra 20, item 10).
Envio externo: nenhum.
Seed/fixture: sintético. Os casos novos do teste usam só identificadores fictícios (`a`, `b`, `bb`, `c`, `k`, `modelo ${b}`, `literal`) e mapas montados no teste, um deles com JSON quebrado de propósito.
Bloqueantes: nenhum.

O que mudou desde a rodada aprovada não atinge nenhuma superfície da regra 20:
- **Par de um para um no caso de título de modelo** (`parDoCasoDeModelo`). Agora a cópia de um caso não herda a isenção do original. Isso só deixa a régua mais rígida.
- **Mapa malformado**: um item da lista que não é objeto é descartado, e um mapa que não se lê deixa a régua sem isenção em vez de quebrá-la (`entradasDoMapa`).
- **Leitura do código mais precisa**: a `{` dentro de um `${}`, a barra que divide versus a que abre expressão regular, e a expressão regular que começa com `=`.
- **Ajustes pequenos**: o conjunto de tokens antes da barra que divide é montado uma vez só, o critério de só nomes ficou numa constante, e comentários e blocos de mutação foram atualizados.

Recomendações:
- O texto da tarefa cita `.processo/conferencia-duracao-l3.txt`, que fica fora do git, com 55 casos de e2e. Hoje esse arquivo guarda só título e linha de spec, sem dado pessoal. Vale continuar assim: se um dia a conferência copiar saída do e2e (tela, trace), confira antes que só há dado sintético.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-01 13:51:23 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:596`: a variável `conjuntoAntesDeDivisao` fica no módulo e é preenchida pelo primeiro `K` que chega. Hoje todas as chamadas passam o mesmo `TS.SyntaxKind`, então o resultado não muda, e é ferramenta de CI, sem efeito em produção. Fica mais simples montar o conjunto uma vez a partir do `TS` importado, sem receber `K` como parâmetro.

Nesta rodada li só o diff de `3919b83d` a `b8b81ada` em `tools/` e na tarefa. A árvore de trabalho é igual à árvore auditada, e `tools/processo/portao-local.ts` não mudou desde a rodada aprovada. As duas correções que os reprovadores exigiram estão feitas:
- **Par um para um no caso de título de modelo:** `parDoCasoDeModelo` passou a pedir `ligadosAoDoHead.length === 1`, e há teste da cópia com o nome do mapa trocado.
- **Leitura do arquivo e do mapa malformado:** há testes para a `{` dentro de `${}`, o `break` de `linhaNoOriginal`, a barra que divide, o `/=` e o mapa malformado (`entradas` que não é lista, entrada que não é objeto).

A mudança mexe só na régua de duração do e2e, ferramenta de CI. Não toca request, fila, IA, banco nem estado compartilhado entre instâncias. Nenhum teste chama provedor pago. `tools/ci/duracao-do-e2e.test.ts` passou: 100 de 100.

Durante a verificação rodei um `git add -N` na tarefa, que mexeu no índice, e desfiz com `git reset` em seguida. O `git status` voltou a ser o do início.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-01 13:51:53 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A regra "um para um" do par de título de modelo deixa a ampliação (b) da §13 mais estrita, mas a §13 ainda não a registra. Detalhe na recomendação 1.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

A correção exigida na rodada 1 foi feita:
- **Par um para um:** em `tools/ci/duracao-do-e2e.ts:523-528`, `parDoCasoDeModelo` acha primeiro o único caso do HEAD que liga ao caso da árvore. Depois exige que esse caso do HEAD ligue a um único caso da árvore, agora com `nomes` e não mais com `new Map()`. Assim o par é único dos dois lados. No cenário da reprodução (HEAD com `modelo ${b}`, árvore com `modelo ${bb}` novo e `modelo ${b}` intacto), o caso do HEAD liga aos dois casos da árvore e os dois ficam sem par, portanto medidos.
- **Teste:** "cópia do título de modelo com o nome do mapa trocado num dos dois: o caso novo continua medido" está em `tools/ci/duracao-do-e2e.test.ts:1083-1089`.
- **Mutação:** o bloco que troca `nomes` por `new Map()` em `ligadosAoDoHead` está no documento. O bloco antigo do teste "copiado na árvore" foi refeito para `ligadosAoDoHead.length >= 1`.
- **Teste "repetido no HEAD" reescrito (`duracao-do-e2e.test.ts:1061-1067`):** a árvore ficou com um caso só, e a mudança se justifica. Com a árvore antiga, a guarda nova cobriria a mutação de `unico`, que sobreviveria. Com um caso só, a mutação `itens[0]` passa a dar par e o teste a mata.
- **As três recomendações da ordem foram aplicadas:**
  - `ANTES_DE_DIVISAO` é montado uma vez.
  - O comentário de `tituloLiteral` aponta para `casosDeTituloDeModelo`.
  - O critério de só nomes virou a constante `soOsNomesDoMapa`, e os blocos de mutação acompanharam a mudança.

Os acréscimos fora da ordem (a `{` dentro de `${}`, o `break` de `linhaNoOriginal`, a barra que divide, o `/=` e o mapa malformado) são testes e endurecimento da própria régua, cada um com o seu bloco de mutação. Não invadem outra tarefa.

A árvore atual é igual a `b8b81ada` em `tools/` e no documento da tarefa. A única diferença é a seção "Revisões", que o hook preenche.

Recomendações:
1. `tasks/prd-nomes-de-mercado/techspec.md:264-267`: a ampliação (b) diz só que o caso do HEAD é "o único caso do HEAD cujo título bate". Ela não menciona a cópia na árvore nem o par um para um que o documento da tarefa (linha 40) e o código agora aplicam. Vale registrar na §13 uma frase como "e esse caso do HEAD liga a um único caso da árvore; a cópia, com ou sem nome do mapa trocado, fica sem par e medida", para a regra não existir só no documento da tarefa.
2. `tools/ci/duracao-do-e2e.ts:595-602`: o cache em `let` no nível do módulo, com uma função que recebe `K` e o ignora a partir da segunda chamada, é um jeito torto de montar o conjunto uma vez. Seria mais claro uma função `antesDeDivisao(K)` com o `??=` explícito, ou montar o conjunto onde o `ts` é carregado.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/prd-nomes-de-mercado/techspec.md

## test-engineer · 2ª rodada · REPROVADO · 2026-11-01 13:53:08 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: REPROVADO

Cenários exigidos (rodada 2: diff `3919b83d..b8b81ada` e as correções exigidas na 1ª):
1. Uma `{` dentro de `${}` que se fecha antes de um nome do mapa, com o nome do mapa depois do modelo, e um bloco para o `push('chave')` e outro para o `pop()`.
2. O `break` de `linhaNoOriginal`, com um comentário de bloco de várias linhas depois do `test(`.
3. As recomendações que a ordem tornou obrigatórias: a barra que divide (`x / b`), o `/=`, o mapa malformado, e um bloco ou o motivo da equivalência para `if (tituloLiteral(corpo) !== null) return []`.
4. A regra nova desta rodada: o par do caso de modelo é um para um, e a cópia com o nome do mapa trocado continua medida.

Cobertos (a árvore de `tools/` é igual à `b8b81ada`; `npx vitest run tools/ci/duracao-do-e2e.test.ts` deu 100 de 100):
- **Correção 1:** feita. O teste é "o objeto dentro de um modelo de texto não fecha o modelo...". Sem o `push('chave')`, a `}` do objeto vira o fim do modelo e o texto engole o `b` de dentro da expressão. Sem o `pop()`, a crase do fim abre um modelo novo que engole o `await bb()`. Nos dois casos, o nome do mapa deixa de ser identificador e o caso volta à régua. As duas mutações deixam o teste vermelho pelo motivo certo.
- **Correção 2:** feita. O teste é "o comentário de bloco comprido depois do início do caso de modelo não desloca a linha dele". Sem o `break`, o comentário que vem depois entra no deslocamento, a linha calculada desce, nenhum caso bate com a linha 2 e o caso fica medido. O motivo é o certo.
- **Barra que divide:** tirar `Identifier` de `ANTES_DE_DIVISAO` faz `/ b)` virar expressão regular, e o caso continua medido.
- **`/=`:** sem o `SlashEqualsToken`, o `b` dentro de `/=b/` vira identificador e o caso sai isento por engano. O motivo é o certo.
- **Mapa malformado:** são três testes. Sem o filtro, o `null` quebra a desestruturação, e o teste falha pelo que ele afirma (a régua não pode quebrar).
- **Par um para um:** com `new Map()`, a cópia com `${bb}` herdaria a isenção. O teste "título de modelo repetido no HEAD" foi reescrito com um caso só na árvore. Com isso a mutação `unico => itens[0]` volta a ficar vermelha pelo caminho do HEAD repetido, e não pelo par um para um. A mudança está certa.
- **Equivalências corretas:** a de `Array.isArray` vale, porque o `.filter` de um objeto lança e o `catch` devolve `[]`. A de `conjuntoAntesDeDivisao ??=` também vale.

Bloqueantes:
1. **`tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md:272`**, que cobre o código em **`tools/ci/duracao-do-e2e.ts:380`**: o motivo registrado para não ter bloco está errado.
   - **O que o documento diz:** a mutação que tira `if (tituloLiteral(corpo) !== null) return []` de `casosDeTituloDeModelo` seria equivalente.
   - **Por que não é:** sem o `return`, o caso de título literal entra em `modeloDaArvore`. O `casosComParNoHead` (linha 541) procura primeiro pela linha, então esse caso passa a ir por `parDoCasoDeModelo`. Esse caminho compara o título como tokens, com `getTokenText`, que guarda as aspas. Já o `parDoCasoLiteral` compara o conteúdo sem as aspas e sem as barras de escape.
   - **Contraexemplo:** HEAD com `test('x', async () => {`, árvore com `test("x", async () => {`, e o corpo igual (também `'a\'b'` → `"a'b"`, que o prettier faz). Com a cláusula, o par sai pelo título literal, o trecho é igual e o caso é isento pela exceção do comentário. Sem ela, `'x'` e `"x"` são tokens diferentes, o caso fica sem par e continua medido. O resultado muda, então a mutação não é equivalente.
   - **Teste citado:** "o caso de título literal e o de título de modelo no mesmo spec acham cada um o seu par" passa com e sem a cláusula, e por isso não a prova.
   - **Correção exigida:** um teste com um título literal que só troca de aspas (ou de escape), com o corpo igual, que espera o caso isento (`toBeNull`). Mais um bloco `mutacao` da linha 380 citando esse teste. Por fim, apagar a frase de equivalência do documento.

Recomendações:
- A lista "Teste que reproduz" do documento (linhas 21 a 28) não cita os testes novos desta rodada: objeto em `${}`, barra, `/=`, mapa malformado, cópia com nome trocado, comentário comprido depois do `test(` e a convivência do literal com o de modelo. Vale acrescentá-los para a validação.
- O teste "entradas que é objeto, e não lista" só prova o resultado. Ele passaria também se o mapa nunca fosse lido. Hoje é o vizinho, "entrada que não é objeto é ignorada...", que mostra que o mapa é lido. Um comentário no teste deixaria essa dependência visível.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md

## revisor-geral · 3ª rodada · APROVADO · 2026-11-01 14:02:33 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção de ferramenta de processo, sem seção da techspec. Nesta rodada só mudaram o teste e o documento; o código de `tools/ci/duracao-do-e2e.ts` é o mesmo da 2ª rodada.

Portão local: carimbo válido. O `conferir` responde "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum

O que conferi do diff desde a 2ª rodada:
- **A mutação nova pega o teste.** O bloco troca `if (tituloLiteral(corpo) !== null) return []`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:380`, por `if (false) return []`. Com a troca, o caso de título literal entra em `modeloDaArvore` na linha 2. Aí `casosComParNoHead` (linha 541) passa a usar `parDoCasoDeModelo`, que compara `"literal"` com `'literal'` como tokens diferentes. O caso fica sem par e continua medido, e o `toBeNull()` do teste novo (linhas 1119 a 1127 de `tools/ci/duracao-do-e2e.test.ts`) fica vermelho.
- **A frase apagada estava errada.** O documento dizia que essa mutação não mudava nada ("equivalente"). Não era verdade: o teste novo mostra que o resultado muda quando só as aspas mudam. Tirar a frase e pôr o bloco no lugar está certo.
- **A lista "Teste que reproduz" bate com o arquivo.** Os nomes dos `it(` listados no documento são os que estão no teste.

Recomendações:
- O comentário novo de `tools/ci/duracao-do-e2e.test.ts:937` diz o que o caso não prova. Isso só serve porque a mutação de `Array.isArray(entradas)` continua listada sem bloco, como equivalente. Se um dia essa guarda ganhar efeito próprio, apague o comentário junto, para ele não ficar desatualizado.

## test-engineer · 3ª rodada · APROVADO · 2026-11-01 14:02:41 · `tasks/correcoes/2026-11-01-duracao-do-e2e-so-nomes-do-mapa.md`

VEREDITO: APROVADO

Cenários exigidos (desta rodada):
- Um título literal que só troca de aspas, com o corpo igual, sai isento (`toBeNull`).
- Um bloco `mutacao` da linha 380 de `tools/ci/duracao-do-e2e.ts` que cita esse teste.
- A frase de equivalência apagada do documento.
- As duas recomendações aplicadas: a lista "Teste que reproduz" completa e o comentário no teste "entradas que é objeto, e não lista".

Cobertos:
- Teste novo: "o título literal que só troca de aspas, com o corpo igual, acha o par pelo título literal e sai da régua", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:1119`. O HEAD tem `test('literal', …)` e a árvore `test("literal", …)`, com o mesmo corpo. O caso dura 19 s, acima da metade do prazo de 30 s, e o teste espera `toBeNull`.
  - Com a cláusula da linha 380, o caso fica fora de `modeloDaArvore`. `casosComParNoHead` então usa `parDoCasoLiteral` e acha o par pelo título "literal", igual dos dois lados.
  - Com a mutação `if (false)`, o caso entra em `modeloDaArvore` na linha 2 e vai para `parDoCasoDeModelo`. Lá `'literal'` e `"literal"` são tokens diferentes, o caso fica sem par e medido, e o motivo deixa de ser nulo.
  - O teste falha, então, pelo motivo certo: o cenário chega à cláusula.
- Bloco `mutacao` novo no documento, citando esse teste pelo nome exato. A frase de equivalência saiu.
- "Teste que reproduz" agora lista pelo nome os testes das rodadas 1 e 2. Conferi que os dez nomes existem no arquivo de teste (linhas 902 a 1119).
- O comentário em `tools/ci/duracao-do-e2e.test.ts:937` diz que o teste prova só o resultado e que o vizinho "entrada que não é objeto é ignorada, e a boa ao lado dela vale" é quem prova a leitura do mapa.
- O código de produção não mudou: o diff da árvore contra `50cd1b3d` em `tools/` está vazio. A suíte passa: 101 de 101 testes.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. Continua registrado para a validação que o `Array.isArray` de `entradasDoMapa` fica sem bloco, porque a mutação é equivalente: o `try`/`catch` em volta já devolve `[]` quando `entradas` não é lista. O motivo está escrito no documento e confere com o código, em `tools/ci/duracao-do-e2e.ts:569-576`.
