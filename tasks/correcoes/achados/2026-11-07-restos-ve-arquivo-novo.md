# Achados das revisões — `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 13:03:41 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica na ferramenta interna de renomeação (`tools/renomear/`) e na lista de prazos dos testes (`tools/ci/`). Nenhuma migration, entidade, DTO, rota, log de aplicação nem envio para IA mudou.

Fora da tabela de dados do docs/lgpd.md: nada, porque a tarefa não traz campo pessoal novo.

Autorização por objeto: não se aplica. A tarefa não cria nem altera rota.

Logs: limpos. O `restos` imprime no terminal ou no CI o caminho, a linha, o nome antigo do mapa da X8 e um trecho da linha (`tools/renomear/restos.ts:146`). Isso já existia; a novidade é que agora ele também lê os arquivos ainda não adicionados ao git.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem aprovação de IA.

Envio externo: nenhum.

Seed/fixture: sintético. Os testes de `tools/renomear/restos.test.ts:304-328` usam só um repositório de teste com conteúdo como `export const b = 'Banco'`.

Bloqueantes: nenhum.

Recomendações:
- Agora o `restos` lê qualquer arquivo de código ou documento que esteja na pasta e não esteja no `.gitignore` (`tools/renomear/arvore.ts:37-45`, chamado por `tools/renomear/restos.ts:152`). Hoje o `.gitignore` já cobre `.env` e `.env.*`. Um arquivo largado na pasta sem estar no índice, como a cópia de um caso para depurar, só aparece na saída se uma linha dele tiver um nome antigo do mapa. Mesmo assim, a regra 20 item 17 proíbe ter esse tipo de arquivo na máquina. Vale uma linha no comentário de `OpcoesDaCarga` dizendo que a soma dos não adicionados depende do `.gitignore` estar completo.
- A carga padrão continua só com os arquivos versionados. Só o `restos` pede os ainda não adicionados, e o `aplicar` e o `reaplicar` não mudaram. Isso está certo para o meu escopo, porque quem grava com `git mv` não alcança arquivo fora do índice.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-07 13:04:26 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. A correção faz o que o item "(F2, retro, M1)" do `TODO.md` pede e para aí. Só o `restos` passa a ver os arquivos não adicionados; o `aplicar`, o `reaplicar` e o `conferir` continuam lendo só os versionados.

**Aderência à Tech Spec:** ok. Uma ressalva vai nas recomendações: a frase da Tech Spec da X8 sobre o índice ficou incompleta. Não é divergência.

**Portão local:** carimbo válido para a árvore atual (typecheck, lint, segredo, dependencias, unidade, alvo).

**Bloqueantes:**

1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts:304-311`, o caso novo "o nome antigo num arquivo criado e não adicionado deixa o comando vermelho" chama `spawnSync('node', [.../restos.ts])` na linha 310. Antes disso, na linha 308, ele já roda o `restos` no próprio processo, por `sobras(repo)`. Só que o `describe` dele, "restos: arquivo ainda não adicionado", não declara `{ timeout }` e fica nos 5 s padrão da unidade.
   - **O defeito:** o próprio documento da correção, na seção "Correção", diz que cada caso que sobe o `restos.ts` passava de 5 s com a máquina carregada. Esse caso faz isso e ainda roda o `restos` antes.
   - **Por que o portão não pegou:** `tools/ci/unidade-sob-carga.test.ts` só confere os describes que estão na lista `QUEM_SOBE_PROCESSO`, então nada acusa o novo.
   - **O efeito:** volta o "Test timed out" intermitente que a correção `2026-11-07-unidade-independente-da-carga` (`19dcb663`) acabou de tirar.
   - **Correção exigida:** escolha um dos dois caminhos.
     - Mover a parte da linha de comando (linhas 310-311) para dentro de `describe('restos: a linha de comando', { timeout: 60_000 }, ...)`, deixando o caso novo só com `sobras`.
     - Ou dar `{ timeout: 60_000 }` ao `describe` "restos: arquivo ainda não adicionado" e incluir o par em `QUEM_SOBE_PROCESSO` (`tools/ci/unidade-sob-carga.test.ts:48-57`).

     Em qualquer dos dois, a primeira mutação do documento continua citando um caso que existe com o mesmo título.

**Recomendações:**

- **Pasta e link entre os não adicionados** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts:67-71`). Com `--others`, o `git ls-files` lista um repositório git aninhado e não adicionado como `sub/`. Também lista um link simbólico não adicionado que aponta para uma pasta. Conferi os dois num repositório de teste. Nos dois casos o `readFileSync` falha com EISDIR, o `restos` sai com código 2 e "restos na árvore" fica vermelho na máquina de quem tiver um deles. Hoje a árvore não tem nenhum dos dois casos. Sugestão: pular o que não for arquivo (`statSync(...).isFile()`), como o `existsSync` já faz com o arquivo apagado.
- **Frase da Tech Spec da X8** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-nomes-de-mercado/techspec.md:208`). Ela diz "rodado depois do `git add` (a `Arvore` lê o índice)", e agora o `restos` lê também o que não está no índice. Atualizar o parêntese evita que alguém leia a frase como regra que ainda vale.
- **Comentário do topo de `arvore.ts`.** A linha 9 passou da largura das vizinhas. Quebrar em duas, como o resto do bloco.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 13:04:53 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica (é ferramenta de desenvolvimento, `tools/renomear/` e `tools/ci/`, e não entra em request)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (é execução local e só lê arquivos; o `restos` não grava nada)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica)
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts:310`: o caso "o nome antigo num arquivo criado e não adicionado deixa o comando vermelho" roda o `restos.ts` como processo à parte (`spawnSync`), e o `describe` dele não declara prazo. Fica com os 5 s padrão. A própria tarefa diz que esse processo passava de 5 s com a máquina carregada. Isolado, o caso levou 483 ms, com carga 8,8. Dois jeitos de resolver: mover a parte do processo para o `describe` "restos: a linha de comando", que já tem `{ timeout: 60_000 }`, ou dar prazo ao `describe` novo e incluí-lo em `QUEM_SOBE_PROCESSO`. Não bloqueia porque a convenção ainda não é universal: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/aplicar.test.ts:470` também roda processo sem prazo.
2. O texto diz que o `conferir` fica só com os arquivos versionados, mas ele nunca usou o `Arvore.carregar`. O `lerDaArvore`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/conferir.ts:85`, já lista também os não adicionados (`--others --exclude-standard`). Isso aparece em três lugares:
   - o comentário de `OpcoesDaCarga` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts`;
   - o título do terceiro caso, "o aplicar e o conferir não leem o que não foi adicionado";
   - a seção "Correção" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`.

   O certo é citar só o `aplicar` e o `reaplicar`, os dois que chamam `Arvore.carregar` sem a opção.

Rodei `tools/renomear/restos.test.ts` e `tools/ci/unidade-sob-carga.test.ts`: 58 de 58 passaram, em 51,6 s, com carga perto de 11.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 13:05:08 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

**VEREDITO: REPROVADO**

Há um bloqueante: o caso novo sobe o `restos.ts` com o prazo padrão de 5 s. A lógica da correção está certa e os três cenários estão provados. Rodei os dois arquivos de teste: 58 de 58 passam.

**Cenários exigidos**
1. **Caminho feliz:** um nome antigo num arquivo criado e ainda não adicionado deixa o `restos` vermelho, tanto pela função quanto pela linha de comando.
2. **Borda:** o que o `.gitignore` exclui não conta, seja pasta (`node_modules/`) ou arquivo avulso.
3. **Borda:** a carga padrão da árvore continua só com os versionados, que é a que o `aplicar`, o `reaplicar` e o `conferir` usam.
4. **Borda:** um caminho não adicionado que é pasta (repositório aninhado) ou link simbólico para pasta. Está sem teste e vai em recomendação.
5. **Prazo:** quem sobe processo declara o próprio prazo e está na lista `QUEM_SOBE_PROCESSO`.
6. **Permissão e isolamento entre escolas:** não se aplicam, é ferramenta de `tools/` sem dado de escola. Concorrência também não se aplica.

**Cobertos**
- **1:** `restos.test.ts › o nome antigo num arquivo criado e não adicionado deixa o comando vermelho`. O teste confere antes que o arquivo está fora do índice (`git ls-files` vazio), cobre a função e o processo (saída 1 com `novo.ts:1`) e é alcançado pelo bloco de mutação 1.
- **2:** `› o arquivo que o .gitignore exclui não conta`. O bloco 2 fica vermelho pelo motivo certo: mesmo que o `restos` filtrasse `node_modules/` por conta própria, `apps/api/src/ignorado.ts` cai na mutação.
- **3:** `› a carga padrão da árvore segue só com os versionados…`. Prova os dois sentidos (sem a opção dá `false`, com a opção dá `true`) e é alcançado pelo bloco 3.
- **5, para o `describe` antigo:** `restos: a linha de comando` ganhou `{ timeout: 60_000 }` e entrou em `QUEM_SOBE_PROCESSO` (`tools/ci/unidade-sob-carga.test.ts:55`).
- Os três casos do "Teste que reproduz" têm teste citado pelo nome. A seção "Mutações" bate com o diff: `--faltando: 0`, e a única condição nova (`incluirNaoVersionados !== true`) e as duas listagens têm bloco. Não há `.skip`, mock nem IA.

**Bloqueantes**
1. **`tools/renomear/restos.test.ts:310`:** o caso novo roda `spawnSync('node', [.../restos.ts])` dentro do `describe` `restos: arquivo ainda não adicionado`, que não tem `{ timeout }` e não está em `QUEM_SOBE_PROCESSO`.
   - **O problema:** é o mesmo padrão que esta correção conserta duas linhas abaixo. O próprio documento diz que subir o `restos.ts` passava dos 5 s com a máquina carregada. Medi 450 ms com a máquina folgada (o caso de três subidas leva 1478 ms). O caso fica dependendo da folga da máquina, e a guarda de `unidade-sob-carga.test.ts` não o vê, porque ela só confere os `describe` da lista.
   - **Correção exigida, uma das duas:**
     - mover a parte da linha de comando (o `spawnSync` e o `expect([comando.status, comando.stdout])…`) para o `describe` `restos: a linha de comando`, que já tem prazo e guarda, deixando no caso novo só a asserção por `sobras(repo)`;
     - ou dar `{ timeout: 60_000 }` ao `describe` novo e acrescentar `['tools/renomear/restos.test.ts', 'restos: arquivo ainda não adicionado']` a `QUEM_SOBE_PROCESSO`.

     No primeiro caminho, o bloco de mutação 1 continua alcançado pela asserção de `sobras`.

**Recomendações**
- **`tools/renomear/arvore.ts:71`:** com a opção ligada, uma pasta não adicionada que é outro repositório git aparece no `git ls-files --others` como `pasta/`, e um link simbólico não adicionado pode apontar para uma pasta. O `existsSync` deixa os dois passar, e o `readFileSync` lança `EISDIR`, derrubando o `restos` inteiro. Não esconde resto nenhum, porque a falha é alta e não um verde falso. Mesmo assim, vale pular o que não é arquivo (`statSync(absoluto).isFile()`) e escrever um caso de teste com uma pasta não adicionada que tem `.git` dentro.
- O teste `restos na árvore` passa a ler também o que não foi adicionado na cópia de trabalho de quem roda. É o efeito desejado, mas vale uma linha no comentário do teste dizendo que um rascunho solto na árvore deixa o teste vermelho.
- **`tools/renomear/arvore.ts:9`:** o comentário do topo passou de 130 colunas. Vale quebrar a linha.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 13:30:43 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita pelo primeiro dos dois caminhos:
- O `spawnSync` saiu do caso em `restos: arquivo ainda não adicionado`. Esse caso agora só chama `sobras`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts:305-310`.
- A parte da linha de comando virou um caso próprio dentro de `restos: a linha de comando`, que tem `{ timeout: 60_000 }` (linhas 360-365).
- O par `restos.test.ts` / `restos: a linha de comando` entrou em `QUEM_SOBE_PROCESSO`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts:55`.
- A primeira mutação do documento cita um título que existe igual na linha 305.

As recomendações da rodada anterior também foram aplicadas:
- A carga agora pula o que não é arquivo: `ehArquivo` com `statSync(...).isFile()`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts:48-55`, usado na linha 81. Isso vem com um caso de teste e uma mutação para ele.
- O texto sobre o `conferir` foi corrigido no comentário de `OpcoesDaCarga`, no título do quarto caso e no documento.
- A linha 9 de `arvore.ts` foi quebrada.
- Entraram o comentário sobre o `.gitignore` e o do teste `restos na árvore`.

Recomendações:
- **Título do caso da linha 305:** `restos.test.ts:305` ainda diz "deixa o comando vermelho", mas o caso não roda mais o comando, só confere `sobras`. O documento já descreve esse caso como "o resto num arquivo criado e não adicionado aparece". Renomeie o caso nesses termos e atualize a primeira mutação de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md` (linha 49). Hoje esse título também é o começo do título do caso da linha de comando (linha 360). Se o filtro da mutação procura o título por trecho, roda os dois casos; isso não muda o resultado, mas é ambíguo.
- **Linha `falha:` nas mutações:** a primeira e a terceira mutação do documento não têm a linha `falha:`, e as outras duas têm. Vale uniformizar.
- **Mudança para `aplicar` e `reaplicar`:** `ehArquivo` também muda o que eles fazem com um link versionado que aponta para uma pasta. Antes a carga parava com `EISDIR`; agora o link fica fora da árvore e não acompanha um `git mv`. Para esta árvore não faz diferença, mas vale uma frase no documento.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 13:30:43 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada mexe só em ferramenta de desenvolvimento (`tools/renomear/`, `tools/ci/`) e na ficha da tarefa. Não há migration, DTO, rota ou dado de titular.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: não se aplica, porque não há rota nova nem alterada.
Logs: limpos. A saída do `restos` continua sendo `arquivo:linha` com o termo antigo (`apps/api/src/novo.ts:1 texto Banco`), sem o conteúdo da linha. Esse formato não mudou nesta rodada.
Auditoria: não se aplica, porque nenhuma ação da regra 20, item 10, foi tocada.
Envio externo: nenhum. A leitura é local e nada sai da máquina.
Seed/fixture: sintético. Os testes criam repositórios temporários com conteúdo inventado (`export const b = 'Banco'`), um `git init` aninhado e um link para a pasta `apps` do próprio repositório de teste.

Conferência da rodada:
- Na 1ª rodada eu não exigi nenhuma correção. O comentário que eu tinha sugerido sobre o `.gitignore` entrou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts:30-31`. Ele avisa que a soma dos arquivos não adicionados só é tão boa quanto o `.gitignore`.
- `ehArquivo` (`arvore.ts:48-55`), usado em `arvore.ts:79-81`, pula pasta, link para pasta, link quebrado e arquivo apagado. Com isso a carga deixa de cair com `EISDIR`. Ninguém passa a ler mais do que antes: só some uma queda.
- O caso de linha de comando foi para o `describe` com prazo (`restos.test.ts:360-365`). O texto agora diz que o `conferir` não passa por `Arvore.carregar`. Nada disso muda dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts:50`: `statSync` segue o link. Um link não adicionado que aponte para um arquivo fora do repositório (um CSV de dados no diretório pessoal, por exemplo) passa a ser lido pelo `restos`. O efeito fica local e a saída mostra só o termo, então isto não bloqueia. Mesmo assim, `lstatSync(...).isFile()` não segue o link, deixa a carga limitada ao que de fato está na árvore e também resolve o caso do link para pasta.
- O comentário em `restos.test.ts:376-377` avisa que um rascunho solto deixa o teste da árvore vermelho. Vale lembrar no mesmo lugar que esse rascunho nunca deve ser um dump ou export real (regra 20, item 17), já que o teste vai lê-lo.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 13:30:53 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança fica toda na ferramenta de renomeação (`tools/renomear/`), que não roda em nenhum request, job ou migration.
Rate limit: não se aplica
Fila e prioridade: não se aplica
Concorrência: não se aplica. É uma ferramenta de linha de comando, rodada por uma pessoa num checkout local.
Índice e paginação: não se aplica
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: não se aplica
Bloqueantes: nenhum

As duas recomendações da 1ª rodada foram feitas.
- O caso de linha de comando agora está no `describe` com prazo de 60 s: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts:360`.
- O texto sobre o `conferir` está correto: ele não passa por `Arvore.carregar`.

A troca de `existsSync` por `ehArquivo` (`statSync(...).isFile()` dentro de try/catch) em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/arvore.ts:49-55` e `:81` só muda o que é lido no disco. Não guarda estado entre execuções nem põe nada novo no caminho quente. Rodei os 6 casos afetados ("não adicionado" e "linha de comando") e todos passaram, em 4,7 s.

Recomendações:
1. O título do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts:320` diz que o comando "não cai", mas ele só verifica `sobras()`, sem rodar o processo nem conferir o código de saída. Uma das duas: mudar o título para "não derrubam a carga" ou repetir o cenário em `restos: a linha de comando`, conferindo que o comando sai com código 0.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 13:32:24 · `tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: um nome antigo num arquivo criado e ainda não adicionado aparece no `restos`, e a linha de comando sai com código 1, com o arquivo e a linha na saída.
- Borda 1: o arquivo que o `.gitignore` exclui (pasta inteira e arquivo solto) não conta.
- Borda 2: uma pasta não adicionada que é outro repositório (`git ls-files --others` a lista como `aninhado/`) e um link para pasta não derrubam a carga com `EISDIR`.
- Borda 3: a carga padrão, a do `aplicar` e do `reaplicar`, continua só com os versionados.
- Permissão e isolamento entre escolas: não se aplicam, porque é ferramenta de repositório e não toca dado de escola. Concorrência também não se aplica.

**Cobertos:** todos os cenários, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/restos.test.ts`:
- O caminho feliz por `sobras` está em `:305`.
- A linha de comando está em `:360`, dentro de `restos: a linha de comando` (`{ timeout: 60_000 }`).
- O `.gitignore` está em `:312`.
- A pasta-repositório e o link para pasta estão em `:320`.
- A carga padrão está em `:328`.

**Correção exigida na rodada anterior:** feita pelo primeiro caminho.
- O `spawnSync` saiu do `describe` sem prazo e foi para `:360`, no `describe` que tem prazo.
- O par `['tools/renomear/restos.test.ts', 'restos: a linha de comando']` está em `QUEM_SOBE_PROCESSO`, em `tools/ci/unidade-sob-carga.test.ts:55`.
- O bloco de mutação 1 continua alcançado. O nome citado nele é substring dos títulos de `:305` e de `:360`, e os dois ficam vermelhos sem o `--others`.

**Mutações:** o documento tem 4 blocos e as linhas novas de `arvore.ts` que têm condição estão todas cobertas. `mutacoes.ts --faltando` responde "Nenhuma linha nova de produção com condição fica sem bloco".
- O bloco novo tira `if (!ehArquivo(absoluto)) continue`. Com isso o `readFileSync` lança `EISDIR` em `aninhado/` ou em `ligacao` dentro de `sobras`, e o caso de `:320` fica vermelho porque falhou, não por erro de carga.
- O bloco da carga padrão agora cita o título renomeado, e esse título existe.

**Execução:** `npx vitest run tools/renomear/restos.test.ts tools/ci/unidade-sob-carga.test.ts` passou, com 60 testes verdes em 2 arquivos (85 s). Não há `.skip`, teste comentado nem mock.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `restos.test.ts:305`: o título ainda diz "deixa o comando vermelho", mas o caso agora só confere `sobras`. Trocar por "aparece", como o documento já descreve, e pôr o mesmo nome no bloco de mutação 1. Hoje o bloco casa com os dois casos por substring: funciona, mas é ambíguo.
2. `restos.test.ts:320`: o título diz "não derrubam o comando", mas o caso confere a função e não o processo. Algo como "não derrubam a carga" seria mais fiel.
3. `restos.test.ts:324`: o link aponta para `apps`, que não tem nome antigo. Por isso o caso não prova que o conteúdo atrás do link não é lido. Isso só importa se um dia alguém quiser garantir que o link para arquivo também fica fora.
4. Trocar `statSync` por `lstatSync` passaria a pular também o link para arquivo, e nenhum caso pega essa diferença. É cobertura extra, não bloqueia.
