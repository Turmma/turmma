# Achados das revisões — `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 00:06:38 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe na ferramenta de processo `--faltando` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts` e o teste dela) e em três textos: `task-template.md`, `executar-task/SKILL.md` e `TODO.md`. Não há migration, schema, repository, endpoint, DTO nem tela.
Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo.
Autorização por objeto: não se aplica, porque não há rota nova nem rota alterada.
Logs: limpos. O diff de `mutacoes.ts` não acrescenta `console`, `fetch`, `http` nem leitura de `process.env`. A ferramenta só lista linhas de código-fonte do próprio repositório.
Auditoria: não se aplica. Nenhuma ação da regra 20, item 10, foi tocada.
Envio externo: nenhum. Não há chamada de rede nem de provedor de IA.
Seed/fixture: sintético. Os casos do teste usam fontes inventadas como `eq(a, 1)`, `eq(t.escolaId, escolaId)` e `brand(`. Os dois `writeFileSync` do teste de árvore de verdade gravam as constantes `REPO` e `VELHO`, que são código TypeScript fictício, num diretório temporário. Nenhum nome, matrícula ou dado de pessoa aparece ali.
Bloqueantes: nenhum.
Recomendações:
- Para a regra 20 a correção ajuda indiretamente. Agora o `--faltando` lista cada argumento de um `and(`/`or(` de várias linhas, e a cláusula `eq(t.escolaId, escolaId),` sozinha numa linha deixa de sumir da lista. Fica menos provável passar despercebido um escopo de repository sem teste que o prove, o que reduz o risco de vazamento entre escolas.
- O próprio arquivo da tarefa registra que não houve rodada vermelha contra o código antigo, porque o `import` de `argumentosDeVariasLinhas` não existia no `HEAD`. Isso é assunto do `test-engineer`, não da regra 20. Deixo anotado só para a validação.

Pergunta de fechamento: a resposta não muda com esta tarefa. Ela não altera o que o sistema guarda sobre um aluno nem para onde isso é enviado, e o arquivo do titular continua como estava.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 00:07:22 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não mexe em migration, schema, `apps/` nem `packages/`. Os arquivos alterados são só de processo: `tools/processo/mutacoes.ts`, `tools/processo/mutacoes.test.ts`, as duas skills e o `TODO.md`.
Queries verificadas: nenhuma query de domínio. Conferi a mudança na ferramenta `--faltando`, que antes deixava sair da lista justamente a cláusula de escopo da regra 10 (`eq(t.escolaId, escolaId),` sozinha numa linha de um `and(` de várias linhas).
- `itensDaLinha` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts:1617`): agora toda linha que é argumento de um `and(` ou `or(` de várias linhas vira um item.
- `blocoTiraOArgumento` (`mutacoes.ts:915`): só aceita o bloco de mutação que tira o argumento e não tira nenhum irmão que cite. O bloco que cita a linha só como contexto, o que tira o escopo junto com outro argumento e o de outro arquivo não tiram o argumento da lista.
- `linhasNovasDaArvore`: liga os argumentos às linhas novas tanto em arquivo novo quanto em arquivo já versionado.
A detecção da cláusula de escopo ficou mais estrita, não mais frouxa.
Teste de isolamento: não se aplica, porque não há módulo de domínio novo. O teste da ferramenta é efetivo para o caso de escopo:
- A árvore de verdade (`mutacoes.test.ts:656`) exige que `repo.ts:3 eq(t.escolaId, escolaId)` apareça na lista e saia só com o bloco que tira exatamente essa linha.
- Sem `argumentosDeVariasLinhas`, ou sem a ligação dos argumentos em `linhasNovasDaArvore`, esse teste quebra. O bloco `return comTemplate` do documento prova isso.
- Rodei `tools/processo/mutacoes.test.ts`: 330 testes passaram.
Bloqueantes: nenhum
Recomendações:
- Hoje o motivo entre crases igual ao termo (`cobertoPorMotivo`) também tira da lista um argumento de escopo, como `` `eq(t.escolaId, escolaId)` ``. O documento da tarefa deixa isso de fora de propósito, como item (a) do `TODO.md`. Esse item deveria ser fechado logo: é o caminho que resta para a cláusula de escopo da regra 10 sair da lista sem um bloco que a prove.
- Os limites que continuam, `&&` e `||` com os operandos em linhas diferentes e o `&&` dentro de um `and(`, também alcançam cláusula de escopo (`t.escolaId === escolaId &&` quebrado em linhas). Vale um exemplo com `escolaId` no texto de `executar-task/SKILL.md` para quem confere à mão.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-21 00:07:57 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (correção de ferramenta de processo; não toca a `techspec.md`)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts:1625` faz o `--faltando` deixar de listar uma condição que hoje ele lista. A correção existia para pôr linhas na lista e acabou tirando outras.

   A linha é `if (nova.argumentos !== undefined) return itensDosArgumentos(nova, condicoes, contexto)`. Ela troca o item da condição da própria linha pelo item do argumento. Isso quebra no argumento de várias linhas: ele vira um item só, na primeira linha nova dele, e o `argumentosVistos` faz `itensDosArgumentos` devolver `[]` para as linhas seguintes. Com isso, qualquer linha seguinte que tenha uma condição só (`??`, `?:`, `.where(`, regex) some da lista.

   Reproduzi em `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--speccamada-ia--l2/f0010d75-0c8e-4839-befa-28b481bc5194/scratchpad/t2.ts`:
   ```ts
   const r = and(
     eq(t.escolaId, escolaId),
     inArray(
       t.id,
       ids ?? [],      // linha 5
     ),
     eq(t.ano, ano ?? atual),
   )
   ```
   - Com o código antigo, a linha 5 sai como `5: [??]`.
   - Com o novo, ela não aparece. Só sai `3: inArray(`, que um bloco tirando o argumento inteiro resolve, e o `??` nunca é cobrado.

   O formato é comum em repository Drizzle: um `inArray(` ou `sql` com os argumentos quebrados dentro de um `.where(and(`.

   Correção exigida:
   - Em `itensDaLinha`, manter o item da condição da linha (`condicoes.length > 0 && !alcancada`) junto dos itens dos argumentos, quando a linha não for a do próprio argumento de uma linha só. O critério mais simples é a linha ser continuação de um argumento de várias linhas (`argumento.de !== nova.linha`). Sem esse cuidado, o mesmo argumento seria listado duas vezes.
   - Acrescentar ao `describe` "o --faltando junta as linhas de um and/or de várias linhas" o caso acima: a linha `ids ?? [],` continua listada com `[??]`, e um bloco que a muta a tira da lista.
   - Acrescentar o bloco de mutação correspondente na seção "Mutações" do documento.

Recomendações:
- `mutacoes.ts`, em `#abrir`: `this.#texto.slice(0, this.#i)` com regex ancorada no `$` copia e varre o arquivo inteiro a cada `(`, o que fica quadrático em arquivo grande. Basta olhar os últimos 4 caracteres (`slice(Math.max(0, this.#i - 4), this.#i)`).
- `fimDoModeloDeTexto` não trata crase aninhada dentro de `${}` (`` `a ${x ? `b` : `c`} z` ``). No teste que fiz ele se recuperou por acaso. Vale escrever isso entre os limites no comentário de `termosDaLinha`, ou tratar o `${` com contagem de chaves.
- `#emitir`: quando o `or(` de dentro tem o primeiro argumento na mesma linha da abertura (`or(eq(a),` / `eq(b))`), as linhas do argumento `or(...)` do `and(` de fora ficam todas ocupadas pelo grupo de dentro. Esse argumento nunca é listado como item do `and(`. É caso raro; vale um teste, ou registrar como limite.
- O documento diz que "não houve rodada vermelha contra o código antigo". Está declarado e justificado. Fica registrado para a retro.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 00:09:45 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: um `and(` com um argumento por linha, e cada argumento sai como item próprio.
- Bordas reais: o primeiro argumento na linha do `and(`; o último sem vírgula; `or(` dentro de `and(`; argumento de várias linhas; vírgula ou parêntese dentro de texto, modelo de texto, expressão regular e comentário; comentário no fim da primeira linha de um argumento; `and(` de uma linha só, ou com um argumento só; nomes parecidos (`brand(`, `and[`).
- Cobertura pelo bloco: o bloco que tira só o argumento; o que tira o argumento junto com um irmão; o que cita a linha só como contexto; o bloco de outro arquivo; o motivo de crase igual ao termo.
- Isolamento (o caso da regra 10 no repository): duas queries do mesmo arquivo com o mesmo `eq(t.escolaId, escolaId),`, cada uma listada à parte.
- A árvore de verdade, com um arquivo novo e um versionado.
- Permissão e concorrência não se aplicam a esta ferramenta.

**Cobertos:** todos os acima, menos as duas queries com o mesmo argumento no mesmo arquivo. Os quatro itens de "Teste que reproduz" têm teste com o nome citado. Não há `.skip`, mock nem provedor. Rodei `npx vitest run tools/processo/mutacoes.test.ts` e deu 330 verdes. O `--faltando` sobre o documento lista só a linha do `?? ''`, como o documento diz.

**Bloqueantes:**

1. `tools/processo/mutacoes.ts:1316`: o `if (quadro.inicio !== null)` do `#fechar` não tem bloco que tire a guarda.
   - O bloco desta linha (`if (false) ...push({ de: 0, ate: 0 })`) prova que o push é necessário, mas não prova a guarda.
   - O motivo de `quadro.inicio !== null` foi escrito para o `#virgula`, onde a troca não muda nada. Aqui muda: no `and(` cujo último argumento tem vírgula, `if (true)` empurra `{ de: null }`, e a linha 1 entra com o texto dela.
   - Exigido: um bloco `+ if (true) quadro.argumentos.push({ de: quadro.inicio, ate: quadro.fim })`, apontando para o describe do `and`/`or` de várias linhas.

2. `tools/processo/mutacoes.ts:1328`: o `.trimEnd()` antes de `.replace(/\s\/\/.*$/, '')` não tem bloco.
   - O próprio documento diz que ele corrigiu um defeito: sem ele, o `\n` do fim impede o `$` de casar, e o comentário fica no termo.
   - O bloco que existe tira o `replace` e mantém o `trimEnd`, então não alcança esta correção.
   - Exigido: um bloco que tire só o `.trimEnd()`. O caso "comentário no fim da primeira linha de um argumento de várias linhas" deve ficar vermelho.

3. `tools/processo/mutacoes.ts:1343`: o `filter((outro) => outro !== termo)` dos irmãos não tem bloco nem motivo.
   - Sem ele, o argumento vira irmão de si mesmo, e `blocoTiraOArgumento` nunca o alcança.
   - O `--faltando` não vê condição dentro de lambda, então a conferência tinha de ser à mão.
   - Exigido: um bloco `.filter(() => true)`.

4. `tools/processo/mutacoes.ts:1344`: o `linha <= ultima` do laço do `#emitir` é uma fronteira sem bloco.
   - Com `<`, a última linha de cada argumento sai do mapa. O argumento de uma linha só perde tudo.
   - Exigido: um bloco `<=` → `<`.

5. `tools/processo/mutacoes.ts:1590`: o `de` na chave de `argumentosVistos` não tem teste que o prove.
   - A interface diz que ele "separa dois argumentos de texto igual", mas nenhum teste passa por `linhasSemBloco` com dois grupos de texto igual no mesmo arquivo.
   - O mutante `` `${nova.arquivo}:${argumento.termo}` `` sobrevive. É justamente o caso comum do repository: várias queries, todas com `eq(t.escolaId, escolaId),`. A segunda some da lista.
   - Exigido:
     - um teste com duas queries de `and(` de várias linhas e o mesmo `eq(t.escolaId, escolaId),`, sem bloco, que liste as duas linhas;
     - o bloco que tira o `${String(argumento.de)}` da chave.

**Recomendações:**
- `tools/processo/mutacoes.ts:1571`: `blocoTiraOArgumento` casa pelo texto, então um bloco que tira o `eq(t.escolaId, escolaId),` de uma query cobre o argumento igual de todas as outras do arquivo. O `blocoTiraOTermo` já tinha esse limite, mas aqui ele cai bem no caso da regra 10. Vale escrevê-lo entre os limites do comentário de `termosDaLinha` e do `executar-task`, ou casar o bloco pela linha.
- Escrever o motivo das condições que ficaram sem bloco nem motivo, todas equivalentes ou de estouro de prazo:
  - o `this.#i < this.#texto.length` do `ler()` (linha 1222);
  - o `de < ate` do `#linhaDe` (linha 1234);
  - o `?? 0` (linha 1236) e o `?? this.#texto.length` (linha 1328), que só estreitam o tipo, como o `?? ''`.
- Linha 1313 (`length > 1` → `true`) e linha 1588 (`?? []` → `as`): os dois mutantes ficam vermelhos por TypeError, e não pela asserção. Aqui a queda é o efeito real da guarda faltar, então aceito, mas vale dizer isso no documento.
- O `[...new Set(...)]` dos irmãos, na linha 1343, é afirmado pelo teste "sem repetir o que é igual" e não tem bloco.
- Linha 1306: `this.#texto.slice(0, this.#i)` a cada `(` custa O(n²) num arquivo grande. O `#recente` ou um corte dos últimos caracteres basta.
- `fimDoModeloDeTexto` não trata crase aninhada dentro de `${}`. É um limite a escrever.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 00:24:21 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff só mexe na ferramenta de processo `--faltando` (em `tools/processo/mutacoes.ts`), no teste dela, no texto do passo 2 do `executar-task` e no documento da correção. Não há migration, schema, DTO, rota nem campo de pessoa.

Fora da tabela de dados do `docs/lgpd.md`: nada.

Autorização por objeto: ok. Nenhuma rota nem repository mudou.

Logs: limpos. O código novo (`itensDaLinhaDeArgumento`, a janela de 4 caracteres em `#abrir`, comentários) não grava log. O que a ferramenta mostra são linhas do código-fonte do próprio repositório, nunca dado de titular.

Auditoria: nenhuma ação da lista da regra 20 (leitura por coordenação ou rede, exportação, nota, permissão, aprovação de IA) foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. Os dois casos novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.test.ts` (perto da linha 1235) usam só código TypeScript de mentira (`inArray(`, `ids ?? []`, `eq(t.escolaId, escolaId)`, funções `a` e `b`), sem nome, matrícula ou conteúdo de aluno.

Bloqueantes: nenhum.

Recomendações:
- Esta rodada acerta o efeito indireto sobre a regra 20. Ela devolve a condição da linha que só continua um argumento de várias linhas, que antes ficava escondida. E duas consultas com o mesmo `eq(t.escolaId, escolaId),` passam a sair as duas na lista, porque a chave agora leva a posição do argumento. Isso diminui o risco de uma cláusula de escopo ficar sem teste que prove que ela existe.
- Continua em aberto o limite que o próprio documento registra: o bloco casa o argumento pelo texto, então um único bloco tira da lista o mesmo argumento de todas as consultas do arquivo. Ficou escrito no comentário de `argumentosDeVariasLinhas`, no passo 2 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.claude/skills/executar-task/SKILL.md` e no item (a) do `TODO.md`. Vale fechar junto com esse item, porque é por aí que o teste que prova a regra 10 pode faltar em uma consulta e ninguém ver.
- A falta de uma rodada vermelha contra o código antigo continua declarada e justificada no documento. Fica para a retro e para o Validador, como na 1ª rodada.

Pergunta de fechamento: não se aplica. A tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então o arquivo do titular e a lista de compartilhamento continuam respondendo como antes.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-21 00:24:36 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff só mexe na ferramenta de processo (`tools/processo/mutacoes.ts`, `tools/processo/mutacoes.test.ts`), na skill `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.claude/skills/executar-task/SKILL.md` e no documento da correção. Não há migration nem schema.

Queries verificadas: nenhuma query de produção. Não há repository, endpoint, `escolaId` vindo do cliente, consulta de rede nem `@Unscoped()` no diff. Conferi o que muda a detecção da cláusula de escopo pela ferramenta:
- `#abrir` agora lê só os 4 caracteres antes do `(`. Isso dá o mesmo resultado que ler o texto inteiro. O `^` só casa quando o `and`/`or` está no início real do arquivo. `xand(`, `$or(`, `major(` e `_and(` continuam fora.
- `itensDaLinhaDeArgumento` volta a listar a condição de uma linha que só continua um argumento (`ids ?? [],`). Ela não some da lista quando é juntada ao argumento.
- O caso novo de duas consultas com o mesmo `eq(t.escolaId, escolaId),` prova que, sem bloco, as duas aparecem na lista.

Teste de isolamento: não se aplica. Não há módulo de domínio nesta tarefa. Os dois casos novos de `mutacoes.test.ts` são efetivos para o que testam: sem `itensDaLinhaDeArgumento`, o item `5 -` com `['??']` some e o primeiro caso quebra.

Bloqueantes: nenhum.

Recomendações:
- Limite (3) de `argumentosDeVariasLinhas`, comentado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts` por volta da linha 1363. A ferramenta casa o argumento pelo texto. Um bloco de mutação que tira `eq(t.escolaId, escolaId),` de uma consulta tira da lista o argumento igual de todas as outras consultas do arquivo. A cláusula de escopo da regra 10 é justamente a que mais se repete com texto igual, então hoje só a conferência à mão garante um bloco por consulta. Sugiro registrar no `TODO.md` uma correção futura: casar pela linha mais o texto quando o argumento tiver `escolaId` ou `anoLetivoId`.
- Limite (c) do `SKILL.md`: um `t.escolaId === escolaId &&` partido em duas linhas também escapa da ferramenta. Vale o mesmo item no `TODO.md`, para essa conferência deixar de ser à mão.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 00:24:51 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de ferramenta do processo, sem seção de Tech Spec. O documento registra o que mudou na rodada 1 e as recomendações que ficaram sem aplicar.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo). A árvore de trabalho é igual ao commit auditado `7bad4355` nos quatro arquivos de código e documento.

**A correção exigida na 1ª rodada foi feita.**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts:1624` `itensDaLinhaDeArgumento` volta a listar a condição da linha que só continua um argumento de várias linhas, junto dos itens do argumento. O critério é o que a ordem pediu (`argumento.de !== nova.linha`), com `condicoes.length > 0 && !alcancada`.
- O mesmo argumento não sai duas vezes: a chave de `argumentosVistos` leva a primeira linha do argumento (linha 1599).
- O caso `ids ?? [],` dentro de um `inArray(` quebrado está no `describe` pedido (`mutacoes.test.ts:1235`). Ele prova que a linha continua listada com `['??']` e que um bloco que a muta a tira da lista.
- A seção "Mutações" ganhou um bloco para cada termo da nova condição: `continuacao`, `condicoes.length > 0` e `!alcancada`. O documento declara 61 blocos, e são 61 mesmo.

**As duas recomendações que a ordem mandou aplicar também foram feitas.**
- `#abrir` agora olha só os 4 caracteres antes do `(`, sem copiar o arquivo a cada abertura. Conferi que a janela de 4 continua recusando `brand(`, `xor(` e `band(` e aceitando `and(` e `or(` no começo do arquivo.
- Os limites estão escritos no comentário de `argumentosDeVariasLinhas` (linhas 1360 a 1365), no de `fimDoModeloDeTexto` e no de `#emitir`, e no passo 2 do `executar-task/SKILL.md`.

Bloqueantes: nenhum

Recomendações:
- O template não acompanhou os limites novos. Os comentários em `mutacoes.ts:1360` e `:1170` dizem que esses limites são "os que a autoconferência 1 do `criar-tasks` manda conferir à mão". Mas `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.claude/skills/criar-tasks/task-template.md:103` não cita nenhum deles: o `or(` de dentro com o primeiro argumento na linha da abertura, a crase aninhada dentro de `${}`, e o bloco que casa o argumento pelo texto. Por causa deste último, a cláusula de escopo da regra 10 pede um bloco por consulta. Até agora só o `executar-task/SKILL.md` os lista. Quem escreve a tarefa lê o template, então vale levar a mesma frase para lá.
- Em `mutacoes.ts:1624`, `itensDaLinhaDeArgumento` recebe `argumentos` à parte, e ele é o mesmo valor de `nova.argumentos`. O parâmetro só existe para estreitar o tipo, e `itensDosArgumentos` continua lendo `nova.argumentos ?? []`. Usar uma fonte só nas duas funções deixaria o código mais legível.
- Quando a linha é a primeira de um argumento de várias linhas e tem condição (`inArray(t.id, ids ?? [`), a condição só sai da lista com um bloco que tire o argumento inteiro. Um bloco que mute só o `??` não basta. A ferramenta fica mais exigente e não deixa de listar nada, mas vale uma frase no comentário de `itensDaLinhaDeArgumento`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 00:25:35 · `tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- As cinco correções da 1ª rodada.
- A cláusula nova desta rodada, `itensDaLinhaDeArgumento`, nas suas três partes: `continuacao`, `condicoes.length > 0` e `!alcancada`.
- A troca da janela do `#abrir`.
- As recomendações que a ordem mandou aplicar.

**Cobertos:**
1. A guarda `if (quadro.inicio !== null)` do `#fechar` tem o bloco `if (true)` exigido, apontando para o describe do `and`/`or` de várias linhas.
2. O `.trimEnd()` tem bloco que tira só ele. Sem ele, o trecho termina em `\n`, e o `/\s\/\/.*$/` sem a flag `m` deixa de casar com o comentário. O caso "comentário no fim da primeira linha de um argumento de várias linhas" (`mutacoes.test.ts:1145`) fica vermelho por asserção, e não por erro de carga.
3. O `filter` dos irmãos tem o bloco `filter(() => true)`.
4. O laço do `#emitir` tem o bloco `<=` → `<`.
5. A chave de `argumentosVistos` tem o teste novo "o argumento de texto igual em duas consultas do mesmo arquivo é listado nas duas", que espera as linhas 3, 4, 9 e 10. O bloco tira o `${String(argumento.de)}`. Sem o `de`, a linha 9 e a 10 saem como repetidas e o teste cai.
6. `itensDaLinhaDeArgumento` (`mutacoes.ts:1624-1628`) tem um bloco por termo, e o teste novo de `inArray(` quebrado prova cada um pelo motivo certo:
   - Sem `continuacao`, a linha 7 sai duas vezes.
   - Sem `condicoes.length > 0`, as linhas 4 e 6 passam a ser listadas.
   - Sem `!alcancada`, a linha 5 continua listada com o `bloco2(['ids ?? [],'], ...)`.
   - O teste também confere `condicoes` igual a `['??']`, e não só que a linha apareceu.
7. Os dois blocos antigos da linha do `#abrir` e o do `if (false)` de `itensDaLinha` foram reescritos com o texto novo.
8. As recomendações da ordem foram aplicadas:
   - O `[...new Set(...)]` dos irmãos ganhou bloco.
   - O documento agora explica as condições sem bloco: o limite do laço de `ler()`, o `de < ate`, os `?? 0` e `?? this.#texto.length`, e os dois casos que caem por TypeError.
   - Os limites estão escritos no comentário de `argumentosDeVariasLinhas`, no de `termosDaLinha` e no `fimDoModeloDeTexto`: o bloco que casa pelo texto e a crase aninhada.
9. Rodei o `npx vitest run tools/processo/mutacoes.test.ts`: 332 de 332 passaram. O `--faltando` lista uma linha só, `mutacoes.ts:1244` (`?? ''`), que é a que o documento justifica.
10. Não há `.skip`, teste comentado nem mock. Também não há IA nem concorrência a provar nesta correção.

**Bloqueantes:** nenhum.

**Recomendações:**
- A janela de 4 caracteres do `#abrir` (`Math.max(0, this.#i - 4)`, `mutacoes.ts:1307`) não tem bloco próprio, mas os testes que já existem a cobrem:
  - Os casos que começam o texto com `and(`, como os de `:1121` a `:1143`, ficam vermelhos sem o `Math.max`, porque o `slice(-1, 3)` sai vazio.
  - O `brand(` de `:1158` fica vermelho com uma janela de 3 caracteres.
  - Vale escrever isso no documento, ou pôr os dois blocos (`- 4` → `- 3`, e tirar o `Math.max`), para que fique registrado.
- A troca de `every` por `some` em `continuacao` (`:1626`) não muda nada nos testes, porque cada linha deles tem um argumento só. Um caso com a linha de um grupo de dentro, com vários argumentos, deixaria isso explícito. É cobertura extra, não regra sem prova.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tools/processo/mutacoes.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/correcoes/2026-11-20-faltando-junta-and-de-varias-linhas.md`
