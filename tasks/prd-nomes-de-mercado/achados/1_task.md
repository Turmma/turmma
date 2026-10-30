# Achados das revisões — `tasks/prd-nomes-de-mercado/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 03:31:35 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (a tarefa não cria rota nem endpoint)
Fila e prioridade: ok (a tarefa não cria job nem fila)
Concorrência: protegida (é uma ferramenta de linha de comando que roda local no repositório, sem request e sem banco. O `reaplicar` rodado duas vezes não muda nada na segunda vez, e o `aplicar` repetido é recusado; os dois casos têm teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts`)
Índice e paginação: ok (a tarefa não tem query)
Degradação de IA: não se aplica (nenhum teste chama provedor)
Migration: não se aplica
Métrica e alerta: ok (nada novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/skills/seguir/passos/8-validacao-e-pouso.md:69`: o passo manda rodar `node tools/renomear/conferir.ts` e `node tools/renomear/restos.ts`, mas esses dois arquivos ainda não existem. Se eles chegam numa tarefa seguinte, é preciso que existam antes do primeiro merge da `develop` nesta spec. Se não chegarem a tempo, o texto do passo deve dizer que esses comandos só valem depois que existirem.
- Quando as ondas renomearem código de `apps/` e `packages/` (rotas, fila, gateway de IA, sala, prova), cada onda que mexer no caminho quente precisa passar pela auditoria de carga. Vale olhar com mais atenção os nomes de fila e job do BullMQ e as chaves de Redis do limitador: um nome de chave que muda no deploy pode zerar os contadores ou deixar jobs órfãos na fila antiga.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-30 03:31:37 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não cria nem altera migration nem schema.
Queries verificadas: nenhuma. Não há repository, query nem endpoint novos. `tools/renomear/` e a mudança em `tools/processo/linhas.ts` só leem e editam a árvore do git. Não abrem banco e não leem dado de escola.
Teste de isolamento: ausente, e aqui não se exige. A tarefa não toca dado de escola, então não há escopo cuja remoção derrubaria um teste.
Bloqueantes: nenhum.

A fixture `tools/renomear/__fixtures__/esquema-real/` é cópia de código, sem dado pessoal. Os arquivos levam `.ts.txt`, e a guarda de escopo (`tools/guardas/escopo-dos-repositories.ts`) só varre o `src` de `apps/` e `packages/`. Por isso as strings `SemEscopo` e `x.repository` dos testes da ferramenta não entram na contagem de `@SemEscopo`. Rodei `tools/renomear/` e `repositories-com-escopo.test.ts`: os 126 testes passaram.

Recomendações:
- Nas ondas que vão usar esta ferramenta, um mapa que renomeie nome do isolamento entre escolas deve chamar o `tenancy-guardian` na própria onda. Isso vale para `escolaId`, `anoLetivoId`, `SemEscopo`, `justificativaSemEscopo`, `PROVAS_DE_ESCOPO`, `REPOSITORIES_SEM_ESCOPO` e para o sufixo `.repository`. O motivo: as guardas casam esses nomes como texto, por exemplo `exportado === 'SemEscopo'` em `tools/guardas/escopo-dos-repositories.ts:272` e a regex `/^painel do operador: /` em `apps/api/test/arquitetura.test.ts:182`. O passo 6 só lista essas ocorrências para a troca à mão. Hoje uma troca esquecida faz a guarda falhar em vermelho, mas vale conferir isso a cada onda.
- O `travas.md` poderia dizer que a guarda de escopo não varre `tools/`. Assim ninguém tenta mais tarde levar a fixture para um caminho que ela lê.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 03:31:46 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só traz uma ferramenta de linha de comando que renomeia código (`tools/renomear/`), um ajuste no leitor de `--escopo` (`tools/processo/linhas.ts`) e um texto novo no passo 8 do `/seguir`. Não cria migration, tabela, coluna, DTO nem endpoint.

Fora da tabela de dados do docs/lgpd.md: nada, porque não há campo novo.

Autorização por objeto: ok. Não há rota nova. A ferramenta só lê arquivos que estão no git (`git ls-files --cached`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/arvore.ts:28-31`) e não abre banco, fila nem storage.

Logs: limpos. Só há duas saídas, e as duas vão para o terminal de quem roda a ferramenta:
- `aplicar.ts:140-145` mostra o uso, um resumo e o relatório.
- `reaplicar.ts:98-100` mostra o resumo e a mensagem de erro.

Nada disso traz dado de pessoa. O relatório (`relatorio.ts`) lista caminho, linha, nome do símbolo e o trecho da linha de código-fonte versionado.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno, exportação, alteração de nota, alteração de permissão nem aprovação de saída de IA.

Envio externo: nenhum. Não há chamada a provedor de IA nem a serviço de rede. O único comando que a ferramenta roda é `git`, mais o `npm` local pelo `Executor`, que o teste substitui.

Seed/fixture: sintético. Conferi os cinco `.txt` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/__fixtures__/esquema-real/`. São cópia do código dos avisos do sistema (`esquemaRespostaAvisos`): rota anônima, texto fixo de manutenção, sem escola e sem pessoa. Nos testes, o único texto com cara de e-mail é `teste@exemplo.com`, em `referencias.test.ts:57`. Usa o domínio reservado `exemplo.com` e só serve de caso de string. Não achei nome, matrícula, CPF, telefone nem nota.

Pergunta de fechamento: a tarefa não muda onde dado de aluno é guardado nem para onde ele é enviado, então a resposta que o código dá à secretaria continua a mesma.

Bloqueantes: nenhum.

Recomendações:
- A seção "Sem classificação" do relatório copia a linha do código-fonte (`relatorio.ts`, coluna `Trecho`). Hoje é inofensivo, porque só lê arquivo versionado e o seed é sintético. Ainda assim, vale dizer no docblock que o relatório nunca deve ser gerado sobre uma árvore com dado real, já que o repositório é público e o relatório pode ser versionado.
- Nas ondas que vão usar a ferramenta, a revisão precisa conferir que a regra "a string igual ao nome fica" segue valendo para três tipos de string. Nome de tabela e coluna do Drizzle, código de ação de auditoria e chave de `ExecucaoAgente` são strings: se mudarem, quebram a consulta histórica da auditoria e do registro de envio, que é exatamente o que responde à pergunta de fechamento.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 03:32:22 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só mexe em `tools/renomear/`, `tools/processo/` e uma página do processo. Procurei `nota`, `lancadaPor`, `correcao`, `tutor`, `aprova`, `autonomia`, `auditoria` e `governanca` nos `.ts` da ferramenta e nas fixtures, e nada apareceu. Todos com autor humano? Não se aplica: a tarefa não cria escrita em Nota.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não gera nenhuma saída de IA.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. Nada mudou ali, e a tarefa não cria agente nem tela.
Bloqueantes: nenhum

O que conferi, pelo que esta tarefa pode afetar na regra 70:
- **Arquivos fora da troca nos documentos.** `tools/renomear/texto.ts:19` deixa `docs/decisoes.md`, `docs/aia/ouro/`, `docs/aia/ouro-retido/` e `tasks/` sem troca automática nos documentos. É o que a revisão da spec pediu: o selo do ouro não quebra. O caso "decisões, ouro, tasks/ e o protótipo: intactos" prova isso.
- **Ponteiros da regra.** `.claude/rules/` e `CLAUDE.md` contam como documento vivo (`texto.ts:23-24`). Quando uma onda mover um arquivo de teste, o caminho citado na "Checagem" da regra 70 é trocado junto, e a regra não perde o teste que a prova.
- **Caminho de teste dentro de string ou regex.** Nas travas da regra 70 (`entrega.int.test.ts`, `correcao.int.test.ts`, `assistente.int.test.ts`, `Mensagem.test.tsx`, `avatar-so-nas-duas-pecas.test.ts`), uma ocorrência que o mapa não classifica faz o `aplicar` recusar a onda, e a árvore sai intacta. Há um caso de teste por forma: string, regex, JSON, YAML e `-w`. Isso responde ao bloqueante de conformidade da rodada 1 da spec.
- **Testes.** Rodei `npx vitest run --project unidade tools/renomear/ tools/processo/linhas.test.ts`: 4 arquivos e 145 testes passaram.

Recomendações:
- Na 2.0, o `conferir` precisa comparar, antes e depois de cada onda, a string do prompt e a da ação auditada (techspec §7b). É o que mantém de pé a regra 70 itens 6 e 4a. Vale citar a regra 70 na tabela "Testes que provam a regra" daquela tarefa.
- `.claude/skills/seguir/passos/8-validacao-e-pouso.md:67-70` já manda rodar `conferir.ts` e `restos.ts`, que só nascem na 2.0. Enquanto a 2.0 não pousar, uma correção vinda de merge cairia num comando que não existe. Ou o passo espera a 2.0, ou diz que esses dois comandos são da 2.0.
- Antes das ondas 6.0 e 9.0, conferir que cada linha de `tasks/prd-nomes-de-mercado/travas.md:69-73` tem a sua ocorrência classificada no mapa daquela onda. A ferramenta recusa a onda se faltar, mas a prova vermelha com o nome novo continua manual.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/skills/seguir/passos/8-validacao-e-pouso.md`

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-30 03:33:25 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no §5, passo 2 (`providePrefixAndSuffixTextForRename`)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. **A Tech Spec mudou sem registro.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/simbolos.ts:97` e no docblock das linhas 9 a 12.
   - O §5, passo 2, da `techspec.md` manda chamar o `findRenameLocations` **com** `providePrefixAndSuffixTextForRename`.
   - O código chama com `{ providePrefixAndSuffixTextForRename: false }` e refaz a forma curta `{ esquemaTurma }` à mão. O docblock admite a escolha ("Duas diferenças do rename do editor, de propósito").
   - Mesmo assim, o `1_task.md` diz "Divergências resolvidas nesta tarefa: nenhuma", a resposta 8 da autoconferência diz "Nenhuma", e a `techspec.md` continua dizendo "com".
   - O motivo técnico se sustenta: com a opção ligada, o rename para no `import { x }` e cria `x as y`. O problema é a decisão ter ficado só no código.
   - **Correção exigida:** registrar a divergência no §5, passo 2, da `techspec.md`: sem a opção, para o rename atravessar import e export, com a forma curta refeita pela ferramenta. Registrar também na seção "Divergências resolvidas nesta tarefa" do `1_task.md`, e no `casos.md` se ele citar o mecanismo. Outro caminho é parar e levar a decisão ao Arquiteto.

2. **A guarda do protótipo foi contornada.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/ast.ts:11`: `export const PASTA_DO_PROTOTIPO = ['mock', 'ups'].join('')`. O mesmo valor é usado em `projetos.ts:18`, `sintaxe.ts:16`, `texto.ts:19` e `aplicar.test.ts:4,227,257`.
   - O teste "nada fora de mockups/ aponta para o protótipo" (`tools/guardas/guardas.test.ts:713-724`) busca a palavra de propósito. A exceção legítima tem lugar próprio: a lista `CITAM_O_PROTOTIPO`, linha 717.
   - Montar a palavra em pedaços deixa a ferramenta invisível para a guarda, e o docblock diz que foi para isso. É um segundo jeito de abrir exceção que o projeto já resolve de um jeito, e mostra a quem vier depois como passar pela guarda.
   - **Correção exigida:** escrever `'mockups'` por extenso em `ast.ts` e acrescentar `tools/renomear/ast.ts` (e `tools/renomear/aplicar.test.ts`, se ele continuar citando a pasta) à `CITAM_O_PROTOTIPO`.
   - Para isso, `tools/guardas/guardas.test.ts` entra nos "Arquivos previstos" do `1_task.md`.
   - Se o Arquiteto não aceitar mexer na guarda nesta tarefa, a alternativa é parar e reportar, e não manter a montagem da palavra.

Recomendações:
- O `--escopo` é opcional no `aplicar` (`aplicar.ts:21`, `aplicar.ts:109`). Pelo §5, a edição fora dos previstos é uma das seis recusas, então sem o argumento a recusa 5 simplesmente não acontece. Valeria tornar o `--escopo` obrigatório na linha de comando (o `tasks.md` já o passa sempre), deixando-o opcional só para o teste.
- O §12 da `techspec.md` ainda marca como "NÃO VERIFICADO" que o rename alcança outro projeto pela condição `source`. O caso "símbolo do shared em dois projetos" já prova isso, e a premissa pode ser marcada como verificada pela 1.0.
- A autoconferência diz "48 blocos", e o documento tem cerca de 45. Vale acertar o número.
- `aplicar.test.ts:45` repete o `apps/api/package.json`, que o `mundo()` já cria. Linha morta.
- O `trocarEspecificadoresDoPacote` (`especificadores.ts:354`) e o `pacotesDaArvore` (`pacotes.ts:367`) também alcançam `tools/guardas/__fixtures__/camadas/`, inclusive o `package.json` de lá chamado `@educa/nucleo`. Na 5.0 isso provavelmente é o que se quer, mas o relatório deveria deixar explícito que essas fixtures mudam.
- Fora desta tarefa: os previstos da 7.0 (linha back) e da 11.0 (linha web) já se sobrepõem hoje (`e2e/**` e `tools/ci/codigo-do-autenticador.test.ts`). A mudança da 1.7 não introduz nem agrava isso, mas vale o Orquestrador ver antes de abrir as linhas.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 03:35:09 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: símbolo, move de arquivo e de pasta, pacote, passo 5, passo 6 e relatório.
- As seis recusas, e a árvore intacta quando há recusa.
- `reaplicar` sobre o merge: o `de` já renomeado, a ocorrência nova, a ordem das ondas, o `13.json`, e rodar duas vezes.
- O equivalente a "job executado duas vezes" aqui: `aplicar` duas vezes e `reaplicar` duas vezes.
- Os casos do mapa real: o `static com(` → `forRoot` (inventario-back.md:39, 30 arquivos), e o pacote com subcaminho trazido pelo merge.
- Permissão, isolamento e concorrência não se aplicam: é uma ferramenta de linha de comando, de um processo só, que não abre dado de escola.

**Cobertos:** cada linha da tabela tem o seu caso, citado pelo nome. Rodei `tools/renomear/` (75 casos verdes, 2,6 s) e `linhas.test.ts` com `seguir.test.ts` (175 casos verdes). Os 48 blocos declarados batem com o código.

O `mutacoes.ts --faltando` lista 260 linhas sem bloco. A seção "Mutações" trata todas como "rota". Abaixo estão as que não são rota: ou são a própria regra que uma linha da tabela diz provar, ou são regra que não tem caso nenhum.

**Bloqueantes:**

1. **A ocorrência sem linha no formato certo não tem caso.** Fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapa.ts:172-178`.
   - O documento diz que a recusa 4 cobre "a entrada ou a ocorrência sem a linha do anexo" (1_task.md:189). Mas `aplicar.test.ts:339` só testa a `linhaDoAnexo` da entrada, e trocar o `if (!formato.test(ocorrencia.linha))` por `if (false)` deixa tudo verde.
   - Correção: casos com uma `fica` de linha `travas.md:1`, uma `trava` de linha `inventario-x.md:1` e uma linha vazia, todos esperando `['sem-linha-do-anexo']` com a árvore intacta. Mais blocos na linha 174 e no ternário da 173.

2. **Nenhum caso confere o texto do relatório.** Fica em `relatorio.ts:43`, `:54` e `:56-59`.
   - O casos.md:22 pede "a ocorrência não classificada, que deixa o relatório vermelho". O caso de `aplicar.test.ts:358` só confere o código da recusa.
   - Nada confere o `**Estado:** vermelho`, a seção "Sem classificação" nem a tabela "Ocorrências por texto" (o fica/trava com a linha do anexo, que é o que o revisor da onda lê).
   - O título de `aplicar.test.ts:175` promete "o -w do script fica para a troca à mão", mas o caso não lê o relatório.
   - Correção: conferir no `resultado.relatorio` o estado vermelho e a linha sem classificação; no caso verde, conferir a linha `apps/api/package.json | … | @educa/nucleo | trava | travas.md:80`. Blocos em `relatorio.ts:43` e `:56`.

3. **Bug no `reaplicar`: a ordem dos pacotes.** Fica em `reaplicar.ts:72-76`.
   - O `reaplicar` aplica as entradas de pacote na ordem do mapa. O `aplicar` as ordena pelo comprimento (`aplicar.ts:79-82`) justamente porque `@educa/nucleo` aplicado antes de `@educa/nucleo/armazem-s3` engole o subcaminho (`especificadores.ts:74` casa `startsWith(de + '/')`).
   - Com o mapa na ordem que o próprio `aplicar.test.ts:189-190` usa, um `import '@educa/nucleo/armazem-s3'` trazido pelo merge vira `'@educa/core/armazem-s3'`, que não existe.
   - Nenhum caso do `reaplicar` tem pacote, nem o `npm install` de `reaplicar.ts:91`.
   - Correção: ordenar como o `aplicar` (ou reaproveitar `aplicarPacotes`). Um caso de `reaplicar` com as duas entradas nessa ordem, código novo importando o pacote e o subcaminho, e um `package.json` novo com a dependência antiga; esperar os especificadores certos e `comandos` igual a `['npm install --package-lock-only']`. Um bloco na ordenação.

4. **O símbolo membro sem `arquivo` (`static com(` → `forRoot`) não tem caso nem bloco.**
   - Os pontos sem caso são `simbolos.ts:19-22`, `:54-56`, `:68` e `:138` (o `colideNoTipo`, uma forma da recusa 2) e `sintaxe.ts:25-28` e `:47`.
   - É o maior rename de membro da spec.
   - Correção, com um bloco em `simbolos.ts:55` ou `:138` e outro em `sintaxe.ts:47`:
     - no `aplicar`: dois módulos com `static com(` e uma chamada `X.com(`, todos virando `forRoot`, com `com` em string e em comentário intactos;
     - também no `aplicar`: um membro `forRoot` que já existe, esperando `['colisao']`;
     - no `reaplicar`: um `Modulo.com(` novo.

5. **A exclusão de pastas do `reaplicar` não tem caso.** Fica em `sintaxe.ts:16` e `:74`.
   - O `reaplicar` não deve renomear `__fixtures__/`, `fixtures/`, o protótipo, `tasks/`, `docs/` nem `tools/renomear/`. Nenhum caso põe código com nome antigo nessas pastas.
   - Há 558 arquivos `.ts`, `.tsx` e `.jsx` versionados em `tools/guardas/__fixtures__/` e `mockups/`. Sem a exclusão tudo fica verde, e o `reaplicar` reescreveria a fixture que prova a guarda e o protótipo.
   - Correção: um caso em `reaplicar.test.ts` com `tools/guardas/__fixtures__/x.ts` e um `.tsx` sob `PASTA_DO_PROTOTIPO`, ambos citando `Banco` e saindo intactos. Um bloco tirando `FORA_DA_SINTAXE.test(caminho)` da linha 74.

6. **Seis linhas da tabela cuja regra nomeada não tem bloco.** A seção "Mutações" chama de "rota", mas é exatamente o que a linha diz provar. Precisa de um bloco por item, cada um apontando o caso que já existe:
   - **"dois tsconfig: editado uma vez":** falta bloco para a deduplicação em `movimentos.ts:38` (`!doArquivo.has(chave)` → `true`). O bloco declarado para esse caso muta outra coisa, o filtro do tsconfig.
   - **"{ esquemaTurma }: a chave fica":** faltam blocos em `simbolos.ts:163-164` e `:178`, e em `sintaxe.ts:39-40` para o `reaplicar`.
   - **"símbolo do shared em dois projetos" (§12):** falta bloco em `simbolos.ts:94-96`, por exemplo `enxergam.slice(0, 1)`.
   - **"move de pasta":** falta bloco em `movimentos.ts:55`.
   - **"documento vivo, o composto":** falta bloco em `texto.ts:274` (`!entrada.comum || dentro` → `dentro`).
   - **"reaplicar, ocorrência nova":** faltam blocos em `sintaxe.ts:48` e `:52` (o membro e a declaração local ficam); os casos já existem em `reaplicar.test.ts:42` e `:56`.

**Recomendações:**
- `referencias.test.ts:62`: o caso "arquivo não versionado da raiz" do `it.each` não escreve arquivo não versionado nenhum e passa por vacuidade. O caso real é o da linha 71; tirar este ou torná-lo real.
- `reaplicar.ts:46` (mapa inválido lança erro) e `reaplicar.ts:52-54` (o arquivo, e não a pasta, que ficou no lugar antigo) não têm caso.
- O §5, passo 6, lista template e `.mjs` entre as formas varridas; o `referencias.test.ts` não tem caso de nenhum dos dois.
- O casos.md:18 cita "com" num comentário e "Banco público" num `.md`. O caso usa `Fila`, que é equivalente; vale citar a troca ou acrescentar os dois.
- `linhas.ts:79`: a terceira regex aceita `1.0` ou `v1.2` entre crases como arquivo da raiz. Não faz mal hoje, mas um caso negativo ajudaria.

Os arquivos principais estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/`: `aplicar.test.ts`, `reaplicar.test.ts`, `reaplicar.ts`, `sintaxe.ts`, `simbolos.ts`, `mapa.ts`, `relatorio.ts` e `movimentos.ts`. O documento da tarefa é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/1_task.md`.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-30 03:53:14 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff da rodada 2 não traz migration nem schema do Drizzle. A tarefa mexe só em ferramenta de linha de comando (`tools/renomear/`, `tools/processo/linhas.ts`), na lista `CITAM_O_PROTOTIPO` de `tools/guardas/guardas.test.ts` e em documentos de processo.

Queries verificadas: nenhuma. Não há repository, query nem endpoint no diff. O `aplicar.ts` e o `reaplicar.ts` reescrevem arquivos do repositório e não acessam o banco. A nova regra de membro sem `arquivo` (`static com(` vira `forRoot`) só roda quando um mapa de onda a declarar, e nenhum mapa é aplicado ao código do produto nesta tarefa.

Teste de isolamento: não se aplica. A tarefa não cria módulo de domínio nem caminho de dado de escola.

Correções exigidas na rodada anterior: nenhuma.

Bloqueantes: nenhum.

Recomendações:
- As duas recomendações da 1ª rodada estão registradas em "Recomendações sem aplicar" do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/1_task.md`. A primeira: a onda que renomear nome do isolamento chama o `tenancy-guardian`. A segunda: o `travas.md` dizer que a guarda de escopo não varre `tools/`, anotada no `TODO.md`. Continuam valendo para as ondas 3.0 em diante.
- A regra nova de membro sem `arquivo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/simbolos.ts`) troca todo `X.de(` e todo `static de(` do código. Na onda em que um mapa usar entrada de membro sem `arquivo`, o `tenancy-guardian` precisa conferir no relatório que nenhum método de repository, de contexto de escopo ou da guarda de escopo (`tools/guardas/escopo-dos-repositories.ts`) foi pego por coincidência de nome.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 03:53:26 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo, para o código atual)

Bloqueantes: nenhum

As duas correções da 1ª rodada foram feitas:

1. **A divergência do rename está registrada.** O §5, passo 2, de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md` foi reescrito: o rename roda sem `providePrefixAndSuffixTextForRename`, porque com a opção ligada ele pára no re-export, e a ferramenta refaz a forma curta. O §12 marca a premissa como verificada. `1_task.md` tem a linha em "Divergências resolvidas nesta tarefa" e a resposta 8 da autoconferência acertada. `casos.md` não cita o mecanismo, só o resultado, e a tarefa diz isso. O código bate com o que está escrito: `tools/renomear/simbolos.ts:97` passa `{ providePrefixAndSuffixTextForRename: false }`.
2. **A guarda do protótipo deixou de ser contornada.** `tools/renomear/ast.ts:11` escreve `'mockups'` por extenso, e `tools/guardas/guardas.test.ts:717` põe `tools/renomear/ast.ts` em `CITAM_O_PROTOTIPO`. `guardas.test.ts` entrou nos "Arquivos previstos". O `reaplicar.test.ts` importa `PASTA_DO_PROTOTIPO` em vez de escrever o nome da pasta, e nenhum outro `.ts` da ferramenta fora das fixtures o escreve.

O resto do diff está dentro do que a tarefa prevê:
- **Correções de bug:** o `reaplicar` passou a aplicar os pacotes na ordem do subcaminho, com a função `renomearPacotes` compartilhada em `pacotes.ts`, e não mais na ordem do mapa. O `--escopo` agora é obrigatório na linha de comando.
- **Regex do leitor de previstos:** a versão (`1.0`, `v1.2`) deixou de ser lida como arquivo.
- **Passo 8:** `8-validacao-e-pouso.md` não manda mais rodar `conferir.ts` e `restos.ts`, que só existem a partir da 2.0.
- **Teste removido:** o caso "arquivo não versionado da raiz" saiu de `referencias.test.ts:62`, mas era duplicado; a regra continua provada pelo `it` dedicado em `referencias.test.ts:73`.

Recomendações:
- **`techspec.md` §12, linha 183:** a premissa agora diz "✅ VERIFICADO", mas a linha seguinte ainda traz "senão, `getReferencesAtPosition` projeto a projeto. A 1.0 prova com dois projetos", texto que era da premissa em aberto. Vale apagar.
- **`casos.md:18`:** a frase ainda diz que "com" e "Banco público" ficam intactos e emenda "O caso usa `Fila`". As duas partes se contradizem. Reescreva com a palavra que o caso de fato usa.
- **"Recomendações sem aplicar" do `1_task.md`:** a do `tenancy-guardian` tem `TODO.md` como destino, mas `TODO.md` não mudou e ainda não tem o item ("a guarda de escopo não varre `tools/`"). Quem fecha a tarefa precisa garantir que o item chegue lá, senão a recomendação se perde.

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-30 03:53:27 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a minha aprovação (árvore `50c0b5d6` → `7ad5f661`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/1_task-diff-r2.patch`) e o que ele afeta.

Campos pessoais tocados: nenhum. A mudança é só na ferramenta de rename (`tools/renomear/`), no leitor de previstos (`tools/processo/linhas.ts`), nos testes e na documentação da spec. Não há migration, entidade, DTO, rota, log de execução nem storage.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, nenhuma rota foi criada ou mudada.

Logs: limpos. O único texto que sai é o `stderr` de uso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.ts:623-624`, e ele não carrega dado.

Auditoria: não se aplica, nenhuma ação desta tarefa está entre as que a regra 20, item 10, exige auditar.

Envio externo: nenhum. O único comando externo é `npm install --package-lock-only`, sem dado de pessoa.

Seed/fixture: sintético.
- Os casos novos de `aplicar.test.ts` e `reaplicar.test.ts` usam só identificadores de código: `Banco`, `esquemaTurma`, `ModuloA/B/C`, `Modulo.com(`, `@educa/nucleo`.
- Nenhuma fixture em `tools/renomear/__fixtures__/` mudou nesta rodada.
- Os novos `inventario-back.md:39` e `travas.md:80` são apontadores de linha, não dado.

Correção exigida na rodada anterior: nenhuma.

Recomendação aplicada pela ordem: feita. O docblock em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/relatorio.ts:7-9` agora diz que a tabela "Sem classificação" copia a linha do código-fonte (coluna `Trecho`). Diz também que o relatório só se gera sobre a árvore versionada, nunca sobre árvore com dado real, e cita a regra 20, item 17, e o repositório público.

A minha recomendação da 1ª rodada está registrada em "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/1_task.md` com destino certo: conferir nas ondas que a string igual ao nome fica, em nome de tabela e coluna do Drizzle, em código de ação de auditoria e em chave de `ExecucaoAgente`. Os destinos são as tarefas das ondas e o `conferir` da 2.0.

Pontos do diff que tocam a regra, conferidos:
- **`reaplicar` não toca fixture, protótipo, `tasks/` nem `docs/`.** O caso novo em `reaplicar.test.ts:729-736` prova isso, e há mutação para cada cláusula da exclusão (`FORA_DA_SINTAXE`, `FORA_DA_FERRAMENTA`). Isso ajuda a regra 20: o rename automático não reescreve material fora do código do produto.
- **`--escopo` agora é obrigatório na linha de comando** (`aplicar.ts:623`), com teste que prova que sem ele a árvore não muda. Isso estreita o que uma onda pode alterar.
- **`PASTA_DO_PROTOTIPO` passou a ser literal** e `tools/renomear/ast.ts` entrou em `CITAM_O_PROTOTIPO` (`tools/guardas/guardas.test.ts:717`). A exceção agora está declarada, sem contorno, e não tem efeito sobre dado pessoal.

Pergunta de fechamento: a tarefa não cria dado guardado nem destino de envio. O que o sistema responde sobre um aluno continua igual.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. A da 1ª rodada (strings do Drizzle, ações de auditoria e chaves de `ExecucaoAgente` mantidas nas ondas) continua valendo para as tarefas 3.0 em diante e para o `conferir` da 2.0.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 03:53:27 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (este diff não cria nem altera endpoint)
Fila e prioridade: ok (este diff não cria nem altera job)
Concorrência: protegida. É uma ferramenta de linha de comando que roda em um processo só, sem banco, fila nem estado compartilhado. A linha de comando agora exige `--escopo`, e quando ele falta o comando sai antes de tocar a árvore. O teste disso está em `tools/renomear/aplicar.test.ts`, no caso "a linha de comando exige o --escopo".
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nada novo no caminho quente)
Bloqueantes: nenhum. A rodada anterior não exigiu correção. A recomendação aplicada está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/skills/seguir/passos/8-validacao-e-pouso.md`, linhas 69 e 70: o texto diz que `conferir.ts` e `restos.ts` só rodam "quando existirem (são da tarefa 2.0 da X8)".
Recomendações:
- Nas ondas seguintes (2.0 em diante), quando o mapa for aplicado em `packages/nucleo/drizzle`, em schema ou em nome de fila do BullMQ, a revisão da onda deve conferir duas coisas. Um rename de símbolo não pode virar rename de tabela, coluna ou nome de fila persistido no Redis. E o `npm install --package-lock-only` não pode mudar versão, o que já é premissa da 5.0 na Tech Spec, §12. Rename direto de coluna ou de fila com job pendente reprova pela regra 80. Este diff ainda não toca nada disso.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-30 03:53:29 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff só muda a ferramenta de renomeação (`tools/renomear/`), o leitor de `--escopo` em `tools/processo/linhas.ts`, uma lista em `tools/guardas/guardas.test.ts` e documentos de processo e spec. Nada nessa área grava ou lê `Nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nem a declaração nem a tela da governança mudaram.
Bloqueantes: nenhum
Recomendações:
- A minha recomendação da 1ª rodada ficou registrada em "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/1_task.md`, com destino na tarefa 2.0. A recomendação é que o `conferir` compare o texto do prompt e o código da ação de auditoria antes e depois de cada onda, e que a regra 70 entre na tabela "Testes que provam a regra" da 2.0. Isso precisa estar feito quando a 2.0 chegar à Mesa. Se o rename trocar a string de uma ação de auditoria, a consulta "o que a IA gerou, quem aprovou, quando" (regra 70, item 6) deixa de achar os registros antigos.
- Antes das ondas 6.0 e 9.0, conferir que cada linha de `travas.md:69-73` tem a ocorrência classificada no mapa daquela onda. Isso também já está registrado na tarefa.

Escopo desta rodada: li o diff inteiro (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/1_task-diff-r2.patch`). Procurei em `tools/renomear/` por `lancadaPor`, nota, tutor, autonomia e prompt e não achei nada. `docs/regulacao.md` e a regra 70 não mudaram. A ferramenta continua deixando intactas a string igual ao nome (teste "o com em string e em comentário fica") e a pasta `docs/` no `reaplicar` (teste "não toca fixture, protótipo, tasks/, docs/…"). É isso que protege, nesta tarefa, os códigos de ação auditada e os textos de prompt. A rodada anterior não pediu correções.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 03:55:00 · `tasks/prd-nomes-de-mercado/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: as seis correções da 1ª rodada, e as linhas novas da tabela de testes de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/1_task.md`, cada uma com o seu teste citado pelo nome e o seu bloco em "Mutações".

Rodei os testes nesta árvore e passaram todos: os 87 de `tools/renomear/` (os 36 do `aplicar.test.ts` conferidos um a um) e os 379 de `tools/processo/linhas.test.ts`, `tools/processo/harness/seguir.test.ts` e `tools/guardas/guardas.test.ts`. Não alterei arquivo nenhum.

Cobertos:
1. **Ocorrência sem a linha no formato certo.** O caso de mesmo nome em `tools/renomear/aplicar.test.ts` cobre a `fica` com `travas.md:1`, a `trava` com `inventario-x.md:1` e a linha vazia nas duas classes. Todos dão `['sem-linha-do-anexo']`, e o `recusado()` confere que a árvore sai igual. O caso confere também a mensagem com o formato certo e que as duas linhas válidas passam. Há blocos no `if`, no ternário do formato e no ternário da mensagem.
2. **Texto do relatório.**
   - O `em %s` confere `**Estado:** vermelho`, a seção `## Sem classificação` e a linha do arquivo.
   - O "pacote no mapa" confere `**Estado:** verde`, a linha `apps/api/package.json | … | @educa/nucleo | trava | travas.md:80` e que não há a seção.
   - Há quatro blocos em `relatorio.ts`: o estado, o ternário, o `if` da seção e a coluna da linha do anexo.
3. **Ordem dos pacotes no `reaplicar`.** O bug foi corrigido: `renomearPacotes` está em `pacotes.ts` e o `aplicar` e o `reaplicar` usam a mesma função. O caso "o pacote e o subcaminho na ordem do mapa" tem as duas entradas, o import do pacote e o do subcaminho, a dependência antiga num `package.json` e `comandos` igual a `['npm install --package-lock-only']`. Há blocos na ordenação e no `mudouPacote`.
4. **Membro sem `arquivo` (`static com(` para `forRoot`).**
   - No `aplicar`, os dois módulos e a chamada mudam, e o `com` em string e em comentário fica. O `forRoot` que já existe dá `['colisao']` com a árvore igual.
   - No `reaplicar`, o caso tem `Modulo.com(`, `static com(` e a variável `com` intacta.
   - Há blocos em `simbolos.ts` (o `colide` e o `colideNoTipo`) e em `sintaxe.ts` (o desvio sem `arquivo` e os dois lados do `||` em `textoDoMembro`).
5. **Exclusão de pastas do `reaplicar`.** O caso cobre `tools/guardas/__fixtures__/x.ts`, `apps/web/fixtures/y.ts`, um `.tsx` sob a pasta do protótipo, `tasks/`, `docs/` e `tools/renomear/`, todos intactos, e o código do produto muda. Há blocos tirando o `FORA_DA_SINTAXE` e tirando o `FORA_DA_FERRAMENTA`.
6. **As seis regras da tabela sem bloco.** Todas ganharam bloco:
   - dois `tsconfig`: a chave com `Math.random`. O destino agora é `yy`, mais comprido, e por isso a troca aplicada duas vezes corrompe o arquivo e o teste fica vermelho pelo motivo certo;
   - forma curta: três blocos em `simbolos.ts` e dois em `sintaxe.ts`, com o caso novo do desestruturado de namespace nos dois lados;
   - `enxergam`: o `.slice(0, 1)`;
   - move de pasta: o `if (false)`;
   - o composto em documento vivo: o `!entrada.comum` tirado;
   - a ocorrência nova no `reaplicar`: o `ehNomeDeMembro` e a declaração local.

Linhas novas da tabela, conferidas:
- **Mapa inválido no `reaplicar`.** O caso confere que lança e que a árvore sai igual.
- **O arquivo que o merge deixou no lugar antigo.** O caso cobre os quatro estados: só a origem, os dois, só o destino e nenhum. Os dois blocos chegam à cláusula: um sobrescreve o destino e o outro faz o `mover` num arquivo que não existe.
- **A linha de comando.** O caso roda de verdade, com `spawnSync`: sem `--escopo` sai 2 com o uso e não toca a árvore; com ele, aplica. Tem bloco.
- **Versão entre crases nos previstos.** `1.0`, `v1.2` e `2.3.4` estão em `linhas.test.ts`, com bloco.
- **Template e `.mjs` no passo 6.** Estão em `referencias.test.ts`. O caso vacuoso de lá ("arquivo não versionado da raiz") saiu.

Não há `.skip`, teste comentado, mock que esconda a regra nem provedor de IA. Concorrência não se aplica: é uma ferramenta de linha de comando de um processo só.

Bloqueantes: nenhum.

Recomendações:
- `tools/renomear/simbolos.ts:68` (`entrada.arquivo === undefined ? arvore.caminhos().filter(ehCodigo) : [entrada.arquivo]`) e `tools/renomear/simbolos.ts:178` (o `!membro` antes de `ehFormaCurta`): o membro sem `arquivo` no `aplicar` passa por aqui, e nenhuma das duas cláusulas tem bloco próprio. O caso positivo "os dois módulos e a chamada viram forRoot" pegaria as duas mutações. Não bloqueia, porque são cláusulas da 1ª rodada que eu não exigi e a correção 4 pedia blocos nos dois arquivos, que existem.
- O `mutacoes.ts --faltando` ainda lista linhas com condição sem bloco em `sintaxe.ts`, `texto.ts` e `simbolos.ts`, entre elas o `if (curta !== undefined)` e o regex `FORA_DO_PASSO_5`. É só informativo, porque em `tools/` não há exigência. Fica para a validação decidir se alguma é regra declarada.
- A asserção `` `| ${Object.keys(arquivos)[0] ?? ''} | ` `` em `aplicar.test.ts:571` passaria com string vazia se a forma não tivesse arquivo. Hoje todas têm, mas o nome do arquivo escrito por extenso seria mais firme.
