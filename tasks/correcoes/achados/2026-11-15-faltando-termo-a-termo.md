# Achados das revisões — `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-15 12:58:19 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no nome renomeado fora do mapa 4 (`LinhaNova`)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Bloqueantes:**

1. **Renomeação fora do mapa, contornada no próprio commit em vez de levada como `DIVERGÊNCIA`.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts:886`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.test.ts:44`, e o documento da correção, linhas 58 a 60.
   - O que está errado: o tipo `LinhaNova` virou `LinhaAcrescentada`. O mapa 4 da X8 classifica como `fica` o `LinhaNova` de `tools/processo/mutacoes.ts` e de `mutacoes.test.ts` (`tools/renomear/mapas/4.json`, entradas a partir da linha 4101). Ou seja, a onda decidiu que esse nome fica.
   - Por que bloqueia: o `restos` acusou as linhas novas com o nome, e a correção trocou o nome para fazer o teste passar. O `corrigir`, no passo 4, proíbe exatamente isso: renomear o que o mapa, uma adenda aprovada ou a "Origem" não nomeiam é `DIVERGÊNCIA` de desenho, não colisão resolvida no commit. O caso que deu origem a essa regra é o `ProcessadorContado` (`docs/processo-licoes.md`, 02/11). O registro só no documento da correção não vale como escalada.
   - Efeito colateral: o mapa 4 ficou com entradas `fica` cujo `trecho` não existe mais (`export function linhasAcrescentadas(diff: string): LinhaNova[] {`, `const linhas: LinhaNova[] = []` e outras).
   - Correção exigida: desfazer a troca de nome e enviar `/seguir DIVERGÊNCIA de Implementador` com `Motivo: desenho`. As saídas possíveis são novas entradas `fica` no mapa 4 (ou uma adenda) para as linhas novas, ou uma correção do `restos` para que o `de` de um mapa com `arquivo` deixe de valer na árvore inteira. Se a renomeação for aprovada, registrar a aprovação e tirar as entradas mortas do mapa 4.

2. **Qualquer trecho entre crases fora dos blocos tira o termo da lista, não só o motivo escrito em "Mutações".**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts:1355`, `:1415` e `:1419`.
   - O que está errado: `prosaSemBlocos` entrega o documento inteiro sem os blocos (Sintoma, Causa, Correção). `cobertoPorMotivo` aceita qualquer crase que contenha o termo como substring.
   - O que confirmei rodando: com a linha `.where(and(eq(t.escolaId, escolaId), eq(t.turmaId, turmaId)))`, uma frase da seção "Correção" que só descreve a mudança (`O repository passa a filtrar por \`and(eq(t.escolaId, escolaId), eq(t.turmaId, turmaId))\``) faz o `linhasSemBloco` cair de 2 itens para 0. Não há bloco nem motivo.
   - Por que bloqueia: o documento de tarefa cita a linha que mudou o tempo todo. A ferramenta volta a esconder exatamente a cláusula sem prova que motivou a M1 (8 reprovações na F2c). E o `executar-task`, no passo 2, diz que o motivo mora em "Mutações", não na prosa toda.
   - Correção exigida: ler o motivo só na seção "Mutações", fora dos blocos, e exigir a crase igual ao termo, não apenas contendo-o. Acrescentar o caso em que a linha citada na "Correção" continua listando os dois termos, com bloco `mutacao` para cada uma das duas restrições.

**Recomendações:**
- `termosDaLinha('return x ? a && b : c')` devolve `['x ? a', 'b : c']`. O corte do ternário só tira o `? ...` do fim, não o `x ?` do começo. Vale cortar também a condição do ternário antes do primeiro operando, ou escrever o limite ao lado dos outros dois.
- `LeitorDeTermos` e `LeitorDeTemplates` repetem `#comum`, `#aspas` e o grosso de `#barra`. O próprio documento admite "linhas iguais" e precisou de motivo duplicado para o `?? ''`. Uma base comum pequena tiraria a duplicação.
- O documento lista em "Docs:" só `executar-task` e `40-testes.md`, mas `.claude/skills/criar-tasks/task-template.md` também mudou. Falta acrescentá-lo.
- `faltandoDoDocumento` resolve a fiação, mas o comentário entre parênteses na seção "Correção" do documento ("o portão local não se testa por importar...") pede um caso que prove que o `portao-local.ts` imprime o mesmo texto que o `--faltando`. Fica com o `test-engineer`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 12:59:28 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: REPROVADO

**Cenários exigidos** (ferramenta de processo: não há dado de escola nem permissão, e isolamento e concorrência não se aplicam):
- caminho feliz: a linha com vários termos sai como um item por termo, e o SQL ou Lua em template string é listado.
- o bloco que tira um termo e deixa os outros alcança só esse termo.
- trocar a linha inteira, ou citá-la como contexto, não alcança termo nenhum.
- o motivo cobre só o termo que ele cita, e não os outros termos da mesma linha. É o centro do M1: na F2c, quem implementou confiou na lista da ferramenta.
- casos de borda reais do repositório:
  - condição de várias linhas (o `and(` com um termo por linha, que aparece em uns 30 repositories, e `&&` seguido de uma chamada aberta);
  - texto entre aspas duplas;
  - expressão regular depois de `(` e de `,` (`replace(/…/`, `split(/…/`);
  - interpolação no template;
  - arquivo novo e arquivo versionado.
- a ligação do comando e do portão à mesma função.

**Cobertos:** os 30 casos de termos e os 20 sem termos; o item por termo; o bloco que tira um termo; o bloco que troca a linha ou só a cita como contexto; o termo de dentro e o de fora; a palavra inteira (`ab` e `x.b`); o bloco de outro arquivo; o motivo com termo curto; o texto de dentro de bloco, que não vale como motivo; o relatório; os leitores de SQL e de Lua (etiqueta, `execute(`, `query(`, `eval(`, `evalsha(`, `defineCommand`, `lua:`, as marcas, a linha mista, a interpolação, os comentários, as crases escapadas); e, na árvore de verdade, o motivo e o SQL e o Lua de arquivo novo e de versionado. `npx vitest run tools/processo/mutacoes.test.ts` passou: 278 de 278. O `--faltando` lista 3 linhas, as de `?? ''`, e a seção "Mutações" traz o motivo delas. Não há `.skip`, nem mock, nem provedor de IA.

**Bloqueantes:**

1. **`tools/processo/mutacoes.ts:1419`: um motivo cobre termos que não cita.** O `cobertoPorMotivo` usa `trecho.includes(termo)`. Qualquer crase da prosa que contenha a condição inteira cobre todos os termos dela. Conferi rodando a função, sem alterar arquivo nenhum:
   - a prosa "cada termo de `linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha)` tem o seu" leva os 3 itens a 0. É a frase literal de `tasks/prd-acesso-e-convites/15_task.md:85`, um dos casos que originaram o M1.
   - a crase `` `podeEditarTudo` `` cobre o termo `podeEditar`.

   Os documentos da casa citam a condição entre crases na seção "Correção" e na autoconferência, e por isso a lista volta a passar por completa: é o defeito que o M1 veio corrigir. O teste "o motivo que cita outro termo não" não pega isso, porque a crase dele não contém o outro termo.
   - Correção exigida: o motivo cobre o termo só se a crase o contiver por palavra inteira (`contemOTermo`) e não contiver nenhum outro termo da mesma linha.
   - Casos exigidos: a crase com a linha inteira não cobre termo nenhum; `` `podeEditarTudo` `` não cobre `podeEditar`.

2. **`tools/processo/mutacoes.ts:1044`: no fim da linha, `ler()` fecha só o grupo do topo, e os termos dos grupos de fora se perdem.** `termosDaLinha('if (a && b && lista.some((x) =>')` devolve `[]`. A linha então cai no comportamento antigo: um item só, que qualquer bloco que a cite como contexto tira da lista. É a forma comum de condição que continua na linha de baixo.
   - Correção exigida: no fim, fechar todos os grupos abertos, de dentro para fora.
   - Caso exigido: essa linha devolve `a`, `b` e o terceiro operando.

3. **Limite sem registro, e documentos que dizem o contrário: o `and(` de várias linhas.** O `and(` com um argumento por linha (`.where(`, depois `and(`, depois `eq(t.escolaId, escolaId),`, um por linha, como em `conta-externa.repository.ts:74-76`) continua invisível. A linha `eq(...)`, sozinha, não tem termo nem condição. É justamente a cláusula de escopo da regra 10.
   - Mesmo assim, `.claude/skills/executar-task/SKILL.md:93-98` lista só (a) o SQL sem etiqueta, (b) o `&&` dentro de `and(` e (c) a linha sem condição, e diz que "a maioria … agora sai da ferramenta". `task-template.md:104` diz "a maioria já coberta"; o comentário em `mutacoes.ts:1154`, o item marcado no `TODO.md` e a seção "Fora desta correção: Nada" também calam esse limite.
   - Correção exigida: escrever esse limite nos cinco lugares, como item da autoconferência 1 a conferir à mão, ou fazer a ferramenta ler o `and(`/`or(` aberto entre linhas.

4. **Linhas novas sem condição e sem teste que caia sem elas.** Nenhuma delas tem bloco, e conferi que nenhum caso do teste as alcança:
   - `mutacoes.ts:1024` e `:1210`, a entrada `'"'` nos dois leitores. Nenhum caso usa aspas duplas. Sem a entrada, `const a = "x && y" && z` vira três termos, e `const a = "`"` abre um template falso.
     - Casos exigidos: os dois.
   - `mutacoes.ts:966`, o `(` e a `,` de `ANTES_DE_REGEX`, e o `this.#recente += c` de `#abrir` e de `#virgula`, de que eles dependem. Nenhum caso tem expressão regular depois de `(` ou de `,`.
     - Casos exigidos: `if (x.replace(/a||b/, '') && c)` nos termos, e `f(/`/)` antes de um `sql``…`` no leitor de templates.
   - `mutacoes.ts:997`, o terceiro `replace(ANTES_DO_PRIMEIRO_TERMO)` de `soOTermo`. Nenhum caso depende dele. Ele só aparece no vermelho do bloco 4.
     - Caso exigido: `const f = (x) => y = a && b` → `['a', 'b']`. Ou então tirar a linha.

**Recomendações:**
- O `if (this.#recente.length > 64)` só é alcançado como contexto de outro bloco. O mutante é equivalente, e vale escrever o motivo.
- A ligação do `portao-local.ts:168` a `faltandoDoDocumento` só se prova por inspeção. Registrar isso na seção "Mutações".
- O `new Set` de `itensDaLinha`, que tira o termo repetido (`a && a`), não tem caso.
- A seção "Fora desta correção: Nada" contradiz os limites que a própria seção "Correção" lista. Trocar pela lista desses limites.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.claude/skills/executar-task/SKILL.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.claude/skills/criar-tasks/task-template.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 13:28:04 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada 2 mexe só em ferramenta de processo (o modo `--faltando` de `tools/processo/mutacoes.ts` e o teste dele) e em documentos de processo (`task-template.md`, `executar-task/SKILL.md`, `TODO.md`, `tasks/prd-nomes-de-mercado/techspec.md`). Não muda schema, migration, endpoint, DTO nem storage.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não cria campo pessoal.

Autorização por objeto: não se aplica, porque a tarefa não cria nem altera rota.

Logs: limpos. O `mutacoes.ts` não ganhou `console` nem `logger`. A saída da ferramenta é a lista de linhas de código e termos, sem dado de pessoa.

Auditoria: não se aplica. Nenhuma das ações que a regra 20 item 10 lista foi tocada.

Envio externo: nenhum, e nada vai para provedor de IA.

Seed/fixture: sintético. As fixtures novas de `tools/processo/mutacoes.test.ts` são trechos de código fictícios (`eq(a.escolaId, escolaId)`, `podeEditar && podeVer`, `"x && y" && z`, `` sql`select 1` ``), sem nome, matrícula, nota nem conteúdo de aluno. O documento da correção (`tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`) traz só nomes de símbolos e linhas de código.

Rodada nova: a 1ª rodada não exigiu correção, então não havia o que conferir. O diff da r2 (que o motivo só vale na seção "Mutações" e com a crase igual ao termo, os grupos que ficam abertos no fim da linha e a troca do nome `LinhaNova` por `LinhaAcrescentada`) não afeta nenhum ponto da regra 20.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso foi enviado. A resposta continua a mesma de antes.

Bloqueantes: nenhum.

Recomendações:
- O limite (3) agora escrito em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts` (docstring de `termosDaLinha`) e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.claude/skills/executar-task/SKILL.md` é o que mais pesa para dado de aluno. O `and(` com um argumento por linha deixa a cláusula `eq(t.escolaId, escolaId),` fora do `--faltando`. Essa cláusula é exatamente a de escopo, que impede uma escola de ver o dado de outra (regra 10), e a de filtro por turma ou aluno, que decide se o aluno de outra turma aparece (regra 20 item 5). É o formato mais comum nos repositories do Drizzle. Hoje ele fica para conferência à mão (pergunta 1 da autoconferência). Vale abrir item no `TODO.md` para a ferramenta juntar as linhas de um `and(`/`or(` de várias linhas antes de partir em termos, com os guardiões `test-engineer` e `tenancy-guardian`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-15 13:28:11 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não cria nem altera migration nem schema.
Queries verificadas: nenhuma de domínio. Mudaram só a ferramenta de processo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/portao-local.ts`), o teste dela e os documentos. A ferramenta só lê o git e arquivos locais. Não há repository, endpoint, `escolaId` vindo do cliente, consulta da camada de rede nem `@Unscoped()` novo.
Teste de isolamento: não se aplica. Não há módulo de domínio novo, então a regra 10.5 não pede teste de isolamento.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts:1163`: o `--faltando` continua sem ver o `and(` com um argumento por linha. É a forma mais comum da cláusula de escopo (`eq(t.escolaId, escolaId),` sozinha na linha), e a ferramenta não a lista. Esse limite aparece no `TODO.md` só dentro do item fechado (`[x]`). Ele merece um item aberto próprio, com `tenancy-guardian` e `test-engineer` como guardiões, para não sumir de vista. Até lá, essa cláusula se confere à mão a cada tarefa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts:1434`: agora um termo pode sair da lista quando a seção "Mutações" o cita entre crases como motivo. Com isso, uma cláusula `eq(x.escolaId, escolaId)` pode sumir do `--faltando` só por um texto escrito, sem nenhum bloco de mutação. Convém escrever no `executar-task` ou na regra 40 que termo de escopo de tenant não se cobre por motivo, só por bloco.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 13:28:48 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

As duas correções exigidas na 1ª rodada foram cumpridas.

**Correção 1 (a renomeação):** a triagem do Arquiteto se sustenta, e a parte que não seguiu o que eu pedi tem motivo válido.
- A divergência foi pelo processo. A decisão está registrada no documento (seção "Correção", linha 74) e em `tasks/prd-nomes-de-mercado/techspec.md` §5, no mesmo commit.
- Conferi que a entrada `fica` sem ocorrência realmente não pesa. O `restos` só usa as entradas `fica` para tirar itens da lista (`tools/renomear/restos.ts:155-164`), e o `reaplicar` só as usa para consulta (`reaplicar.ts:93-94`). Nenhum dos dois cobra que o `fica` tenha ocorrência.
- A árvore não tem mais nenhum `LinhaNova` solto. O único resultado da busca é `condicoesDaLinhaNova`, um nome diferente, que só contém `LinhaNova` dentro dele.
- Eu tinha exigido tirar as entradas mortas do mapa 4. Isso esbarrava numa regra que a Tech Spec já tinha: "o mapa e o relatório de onda feita não se reescrevem". Nesse ponto vale a Tech Spec, não a minha exigência.
- A alternativa de soltar o `de` com `arquivo` deixaria passar o nome antigo trazido de volta por merge, como o novo parágrafo da Tech Spec explica. Não houve mudança de comportamento do `restos`, então não falta cenário.

**Correção 2 (o motivo só na seção "Mutações"):**
- `prosaSemBlocos` (`tools/processo/mutacoes.ts:1368-1371`) agora lê só a seção "Mutações", até a próxima seção, fora dos blocos. O documento sem essa seção não tem motivo nenhum.
- `cobertoPorMotivo` (`mutacoes.ts:1430-1434`) agora exige a crase igual ao termo, com `emCrases.has(termo)`.
- O caso pedido existe em `mutacoes.test.ts`: "o motivo só vale na seção "Mutações": a linha citada na "Correção" continua listando os dois termos". Também ganharam caso a crase com a linha inteira, o nome maior (`podeEditarTudo`) e a seção "Revisões".
- Há bloco `mutacao` para cada uma das duas restrições (linhas 888-939 do documento), incluindo a volta para o `includes` e para o documento inteiro.
- Rodei o `--faltando` e ele confere com o cabeçalho do documento: 2 linhas, ambas do motivo do `?? ''`, e 127 blocos.

As recomendações da rodada anterior também foram tratadas:
- O ternário ficou escrito como limite e tem caso.
- A base comum dos dois leitores foi para o `TODO.md`.
- O `task-template.md` entrou na linha "Docs:".
- O portão e o `--faltando` agora passam pela mesma função, `faltandoDoDocumento` (`tools/processo/portao-local.ts:168`).

Recomendações:
- A linha "Docs:" do documento diz que `.claude/rules/40-testes.md` "passa a dizer o que fica". Mas o trecho alterado ali (linhas 136-137) só acrescenta o que a ferramenta passou a ver. Não cita o `and(` com um argumento por linha, o `&&` dentro de `and(` nem o ternário. Ou se acrescenta esse trecho à regra 40, ou se corrige a frase do documento.
- `prosaSemBlocos` reconhece só o título `## Mutações`, exatamente de nível 2. O documento que usar outro nível perde os motivos sem aviso. O erro é para o lado seguro, porque a lista sai maior, mas vale uma linha no comentário da função.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-faltando-termo-a-termo.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.claude/rules/40-testes.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 13:29:37 · `tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`

VEREDITO: APROVADO

**Cenários exigidos** (são as quatro correções da 1ª rodada, conferidas contra `.processo/ordens/diff-r2.patch`):
1. Um motivo só cobre o termo que cita: a crase com a linha inteira não cobre nenhum termo, e `podeEditarTudo` não cobre `podeEditar`.
2. Os grupos que ficam abertos no fim da linha fecham todos, de dentro para fora.
3. O limite do `and(` com um argumento por linha está escrito nos cinco lugares.
4. As linhas novas do `'"'`, do `(` e da `,` em `ANTES_DE_REGEX`, do `#recente += c` e do terceiro `replace` de `soOTermo` têm caso e bloco.

**Cobertos:**
1. A correção foi além do pedido. Em `mutacoes.ts:1430` e `:1434`, `cobertoPorMotivo` agora exige que a crase seja igual ao termo (`emCrases.has(termo)`, com `trim`). E `prosaSemBlocos` (`:1366-1371`) só lê a seção "## Mutações", até a próxima `## `. Cada ponto tem teste em `mutacoes.test.ts:111-135` e foi mutado nos blocos do documento, nas linhas 888-939: `includes` volta, sem `trim`, sem limite de tamanho, sem a seção, sem a flag `m`, sem o fim no `## `, e `?? documento`.
2. O laço de `mutacoes.ts:1045-1048` está feito. Três casos cobrem (`mutacoes.test.ts:82-84`), entre eles `if (a && b && lista.some((x) =>`, que agora devolve `a`, `b` e `lista.some((x) =>`. Os blocos `> 1` e `ehTopo` sempre `true` (documento, linhas 944-953) derrubam esses casos.
3. O limite está escrito nos cinco lugares:
   - comentário de `termosDaLinha`, `mutacoes.ts:1161-1165`
   - `executar-task/SKILL.md`, item (c)
   - `task-template.md`, autoconferência 1
   - item do `TODO.md`
   - seção "Fora desta correção", que lista os limites em vez de dizer "Nada"
   
   Dois casos fixam o limite: `eq(t.escolaId, escolaId),` e `.where(and(` devolvem `[]`.
4. Cada linha nova tem caso e bloco:
   - `'"'` nos dois leitores: casos `const a = "x && y" && z` e `const a = "`"` seguido de `sql`. Os blocos (linhas 958 e 966) têm contexto que só casa com um leitor cada: `#tratadores = {` seguido de `"'"` só existe no `LeitorDeTermos`, e `},` seguido de `"'"` só no `LeitorDeTemplates`.
   - `(` e `,` de `ANTES_DE_REGEX`: casos nos termos (`x.replace(/a||b/, '')` e `f(a, /x||y/)`) e nos templates (`f(/`/)` e `g(a, /`/)`), com blocos nas linhas 976 e 983.
   - `#recente += c` em `#abrir` e em `#virgula`: blocos `void c` nas linhas 990 e 999. Os mesmos casos de expressão regular os derrubam.
   - terceiro `replace` de `soOTermo`: caso `const f = (x) => y = a && b` → `['a', 'b']`, bloco na linha 1009.
   - Também entraram o caso `a && a && b` e o bloco do `new Set` (linha 1016).

Rodei `npx vitest run tools/processo/mutacoes.test.ts`: 296 testes passando. Rodei `--faltando` sobre o documento: sobram 2 linhas, os dois `?? ''` de `this.#fonte[this.#i]`. São as que o documento declara, com motivo escrito na seção "Mutações". Não há `.skip`, mock nem teste comentado.

**Bloqueantes:** nenhum.

**Recomendações:**
- `mutacoes.ts:1047`: o `this.#grupos.pop()` do laço novo não tem bloco. Tirá-lo deixa o laço infinito, e o portão recusaria isso como estouro de prazo. É uma linha sem condição; vale uma meia linha de motivo na seção "Mutações", como já existe para os limites dos laços.
- `prosaSemBlocos` (`mutacoes.ts:1370`): a seção termina na primeira linha que começa com `## `, mesmo se ela estiver dentro de um bloco de código cercado da seção "Mutações". É raro, mas um caso ou uma linha no comentário deixariam isso registrado.
- O caso do ternário (`return x ? a && b : c` → `['x ? a', 'b : c']`) e os dois casos de `[]` do `and(` com um argumento por linha fixam como teste uma saída que o próprio código chama de limite. Quem corrigir o limite vai ver esses casos ficarem vermelhos. Vale dizer isso no nome dos casos ou no `TODO.md`, para que ninguém ache que é regressão.
- O documento diz "11 motivos" e a lista tem 10 itens. Confira se a contagem vem da ferramenta ou se é erro de texto.
- `.claude/rules/40-testes.md` agora diz o que o `--faltando` lista, mas não o que ele deixa de ver. Não é exigência, porque os cinco lugares pedidos têm o texto. Um "limites no `executar-task`, passo 2" na regra fecharia a lacuna.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/processo/mutacoes.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-faltando-termo-a-termo.md`
