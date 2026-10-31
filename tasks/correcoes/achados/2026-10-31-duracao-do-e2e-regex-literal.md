# Achados das revisões — `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 14:46:21 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só na régua de duração do e2e (`tools/ci/`), no teto da catraca do ESLint e no `TODO.md`. Não há migration, schema, repository, endpoint, DTO nem tela nessa mudança.

Fora da tabela de dados do docs/lgpd.md: nenhum, porque não entra campo novo.

Autorização por objeto: ok. Nenhuma rota é criada ou alterada.

Logs: limpos. Não há `console`, `logger` nem nada que vá para a saída em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`. O módulo só lê o código dos specs de `e2e/` e o diff do git. Não lê dado de pessoa.

Auditoria: não se aplica. Nenhuma ação da lista da regra 20, item 10, passa por esse código.

Envio externo: nenhum. O `typescript` é carregado localmente com `createRequire`, para ler o código. Não há rede nem provedor de IA no caminho.

Seed/fixture: sintético. Os dois testes novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts` usam só código de exemplo (`/```css\n.../g`, `/["']?escuro["']?/`, `/^otpauth:\/\/totp\//`, `a / b`) e casos com nome genérico (`'segundo'`). Não aparece nome, matrícula, nota nem conversa.

Pergunta de fechamento: a correção não muda nada do que o sistema guarda sobre um aluno nem do que é enviado para fora. A resposta à secretaria continua a mesma de antes desta tarefa.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 20. O `typescript` é resolvido pelo diretório de onde o comando roda (`process.cwd()`), e não pelo caminho do próprio arquivo. Isso é questão de portabilidade e fica com o `infra-guardian` e o `revisor-geral`, não com esta revisão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 14:46:25 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: a mudança fica toda no ferramental de CI em `tools/ci/` e `tools/guardas/`, sem endpoint, fila, sessão ou sala)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica: nada é gravado, a função lê texto e devolve texto; o cache do módulo `typescript` é só o carregamento do pacote, sem estado de domínio)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: nenhum código novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts` (`carregarTypescript`): o `createRequire(join(process.cwd(), 'package.json'))` só acha o `typescript` se o Playwright ou o portão rodarem a partir da raiz do repositório. A premissa está escrita no comentário, mas, se alguém rodar de outra pasta, o erro será um "Cannot find module 'typescript'" sem contexto. Vale embrulhar a chamada para que o erro diga de onde o pacote deve ser resolvido.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/TODO.md:1041`: o item (1) da mesma linha (`INICIO_DE_CASO` casa com o `.test('literal')` de um `RegExp`) continua aberto. Pode virar uma correção própria, agora que o leitor de comentários usa o parser.

O `typescript` está nas dependências da raiz (`package.json:77`). Rodei `tools/ci/duracao-do-e2e.test.ts` e os 61 testes passaram em 1,5 s.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 14:46:59 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É correção de ferramenta de processo (`tools/ci/`) e não depende de seção da `techspec.md`. A troca do leitor feito à mão pelo parser do TypeScript é a saída que o próprio módulo e o `TODO.md` já apontavam.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:240`: `createRequire(join(process.cwd(), 'package.json'))` faz `semComentarios` depender da pasta onde o processo foi chamado. Fora da raiz, ou numa pasta sem `node_modules/typescript` ao alcance, a chamada lança erro e derruba a régua inteira, em vez de errar para o lado de cobrar mais, como o resto do módulo faz. Hoje o portão e a esteira rodam na raiz, então não há bug. Mesmo assim, vale um teste ou uma frase no comentário que deixe claro o que acontece fora dela. Outra saída é o mesmo `try`/`null` que `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/caducidade.ts:96-103` usa, com o caso tratado como alterado quando o `typescript` não carrega.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:243`: o `let typescript` vem depois da função que o usa. Funciona, porque a função só roda depois que o módulo carrega, mas `caducidade.ts` declara a variável antes da função. Seguir a mesma ordem deixa os dois módulos com a mesma cara.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:508`: a regex com aspa do teste no repositório temporário deixa de fora o `\[` e o `\s*` da linha 80 real de `e2e/tokens.spec.ts`. O teste de unidade cobre essas formas, então isso é só fidelidade ao caso de origem.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 14:47:30 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: um spec com regex literal em que só o comentário do caso lento muda sai da régua.
- Borda 1: regex literal com crase (`/```css\n([\s\S]*?)```/g`, a linha 61 de `tokens.spec.ts`).
- Borda 2: regex literal com aspa opcional solta (`/["']?escuro["']?/`, a linha 80).
- Borda 3: `\/` antes do fecho da regex (`/^otpauth:\/\/totp\//`).
- Borda 4: uma `/` que é divisão e não regex.
- Borda 5: os casos antigos de `semComentarios` sem mudança (aspas, comentário sem fim, `/*/`).
- Borda 6: as duas regex no mesmo spec, antes do caso, como em `tokens.spec.ts`. Esse é o sintoma da origem.
- Permissão, isolamento e concorrência não se aplicam: é ferramenta de processo, sem dado de escola, sem IA e sem operação que roda duas vezes.

Cobertos:
- Bordas 1 a 4 em `semComentarios entende a expressão regular literal…` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:275-282`).
- Borda 5 nos testes antigos, nas linhas 266-273.
- As sete mutações do documento batem com as cláusulas novas do diff: `getStart` contra `no.end`, os dois fins de faixa, `desde = fim`, `filhos.length > 0` e os dois ramos de `//` e `/*`.
- Nenhuma cláusula de comportamento ficou sem bloco. `carregarTypescript` e `jsDocParsingMode` só mexem em desempenho e carga, não em resultado.
- Os 61 testes do arquivo passam. Não há `.skip`, nem mock, nem provedor de IA.

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:510`: a primeira troca nunca acontece, então a regex com crase não entra no spec do teste.
  - **O que está errado:** a troca procura `'  await b()\n  await c()\n})\n\ntest(\'segundo\''`. No spec de `repositorioComSpec` (linhas 422-424), o `})` do primeiro caso vem colado ao `test('segundo'`, sem linha vazia entre eles. `String.replace` sem casamento não faz nada, e `repositorioComNotaNoSegundo` (linha 485) não acusa a troca que não casou.
  - **Consequência:** o teste roda só com a regex de aspa. Ele continua vermelho antes da correção, mas só por causa da aspa, e passa à toa na metade que diz provar. Isso contradiz o nome do teste ("aspa e crase no mesmo spec") e a linha 25 do documento ("as duas regex de `tokens.spec.ts` antes do caso"). A combinação que reproduz o sintoma de `tokens.spec.ts` não é montada.
  - **Correção exigida:**
    - tirar o `\n` a mais do padrão (`'  await b()\n  await c()\n})\ntest(\'segundo\''`, e o mesmo no texto que entra no lugar), ou trocar só a linha `'  await b()'` do primeiro caso, sem mudar o número de linhas;
    - acrescentar uma asserção de que o spec commitado contém `comCrase` e `comAspa` (`readFileSync(join(raiz, ESPEC))`), para que uma troca que não casa não volte a passar em silêncio.

Recomendações:
- Fazer `repositorioComNotaNoSegundo` e `trocarANota` (linhas 485 e 494) lançarem erro quando uma troca não casar. Assim o mesmo defeito não se repete em outro teste.
- O comportamento em erro de sintaxe ("o que o parser deixa fora da árvore fica como está, comentário e tudo", docblock de `tools/ci/duracao-do-e2e.ts`) não tem teste. Um caso curto, com um spec quebrado em que o comentário fica e o caso conta como alterado, prenderia essa promessa.
- Não há caso com comentário `/** … */` antes de uma declaração. Pela minha leitura do `createChildren` do TypeScript o resultado não muda sem `JSDocParsingMode.ParseNone`, mas um caso de unidade deixaria isso preso.
- O `createRequire(join(process.cwd(), 'package.json'))` só funciona se o processo roda na raiz do repositório. O docblock diz isso, mas nenhum teste falha se alguém rodar de uma subpasta. Basta registrar o limite no `TODO.md`, junto com o item (1), que segue aberto.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 14:54:56 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `tools/ci/duracao-do-e2e.test.ts:494`: `trocarOuFalhar` repassa `para` como texto ao `replace`, e o `replace` entende `$&` e `$1` nesse texto. As trocas de hoje não têm `$`, então nada quebra. Mas uma troca futura com `$` (por exemplo uma linha de spec com template `${...}`) sairia diferente do que o teste descreve, sem acusar erro. Usar `texto.replace(de, () => para)` evita isso.

O que conferi nesta rodada:
- **Minha recomendação da 1ª rodada foi feita.** As duas regex do teste no repositório temporário agora batem com `e2e/tokens.spec.ts`. A da linha 80 está igual. A da linha 61 está igual até o `)]`, sem o `.map(...)` do fim, que não influi no leitor. As duas trocas caem no caso `primeiro`, linhas 431 e 432 do repositório montado pelo teste, e o spec continua com o mesmo número de linhas, como o comentário diz.
- **Os testes novos de `semComentarios` estão certos.** As saídas esperadas para o JSDoc e para o erro de sintaxe batem com o que o parser do TypeScript produz. Quem decide se elas bastam é o `test-engineer`.
- **As recomendações sem aplicar têm destino escrito.** O `TODO.md:1041` registra o `typescript` que não carrega, com o caminho de correção (`carregarTypescript` de `tools/processo/caducidade.ts`). A tabela no documento dá um destino ou motivo para cada uma.
- **`tools/ci/duracao-do-e2e.ts` não mudou** desde a 1ª rodada.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 14:55:44 · `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md`

VEREDITO: APROVADO

Cenários exigidos (correção de ferramenta de processo, sem dado de escola, então não há caso de permissão nem de isolamento):
- caminho feliz: um spec com regex literal que tem aspa e crase, em que só um comentário do caso lento muda, e a régua passa;
- borda: `\/` antes do fecho da regex, e uma divisão que não é regex;
- borda: comentário JSDoc antes de uma declaração;
- borda: spec com erro de sintaxe, ou com texto sem fecho;
- a troca do teste que não casa não pode passar em silêncio.

Cobertos: todos. Conferi as duas correções exigidas na 1ª rodada e as quatro recomendações.

- **Correção 1 (a troca da crase não casava): feita.** `tools/ci/duracao-do-e2e.test.ts:524-526` agora troca só a linha `'  await b()'` por `comCrase` e só `'  await a()'` por `comAspa`. As duas trocas pegam a primeira ocorrência, que fica no primeiro caso (linhas 3 e 4 do spec de `repositorioComSpec`). Cada uma vira uma linha só, então o `test('segundo'` continua na linha 7, a que `relatorioComOSegundo` usa.
- **Correção 2 (o spec commitado tem as duas regex): feita.** As linhas 527-529 conferem que o spec commitado contém `comCrase` e `comAspa`. O ajudante `trocarOuFalhar` (488-491) também lança erro quando uma troca não casa, em `repositorioComNotaNoSegundo` e em `trocarANota`.
- **O teste do repositório falha sem a regra.** Segui o leitor antigo (o do HEAD) sobre o spec novo. Ele abre um texto na `'` solta de `comAspa` e só fecha no `test('segundo'`. Depois abre outro texto ali, que engole o `// nota antiga` até o `'terceiro'`. O comentário fica no trecho, o caso volta à régua, e 19 s passa de 15 s. A mutação `desde = inicio` cita esse teste e foi provada pelo portão.
- **As recomendações foram todas aplicadas:**
  - o JSDoc (linhas 284-287) passa também com o leitor antigo, e o documento declara isso;
  - o caso de erro de sintaxe (289-293) é vermelho com o leitor antigo, porque o `'abc // c` engolia o `// d`;
  - `trocarOuFalhar` está feito;
  - o limite do `createRequire(process.cwd())` está registrado no `TODO.md`.
- **O resto da checagem está limpo.** Não há `.skip`, teste comentado nem mock no arquivo, e não há IA nem concorrência na correção. `npx vitest run tools/ci/duracao-do-e2e.test.ts` passou: 63 de 63.

Bloqueantes: nenhum.

Recomendações:
- `tools/ci/duracao-do-e2e.test.ts:525`: no teste do repositório, a crase não pesa para o leitor antigo. As seis crases ficam em pares, e a linha dela cai dentro do texto que a aspa de `comAspa`, uma linha acima, deixou aberto. O vermelho antes da correção vem só da aspa. A ordem também é a inversa da de `e2e/tokens.spec.ts`, onde a crase está na 61 e a aspa na 80. Para a crase contar sozinha, ela deveria vir na linha de cima, ou ter um caso próprio com número ímpar de crases.
- `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md:17`: a "Causa" diz que a regex com seis crases também troca a paridade das aspas. Com seis crases a conta fecha, e quem desalinha o leitor é só a linha 80. Vale corrigir o texto para a retro.
- `tools/ci/duracao-do-e2e.test.ts:527`: a variável `commitado` lê a árvore, não o commit. Hoje os dois são iguais, porque a leitura vem logo depois do `git commit`. Um `git show HEAD:e2e/material.spec.ts` prenderia o que o nome promete.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/.processo/ordens/diff-regex-r2.patch
