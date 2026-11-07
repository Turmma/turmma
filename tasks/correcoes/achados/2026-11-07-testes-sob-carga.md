# Achados das revisões — `tasks/correcoes/2026-11-07-testes-sob-carga.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 16:03:03 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A correção não cria nem altera migration nem schema.
Queries verificadas: nenhuma. A correção não toca repository, query, endpoint nem `@Unscoped()`.
Teste de isolamento: não se aplica. Não há módulo novo, só três arquivos de teste. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/chunk-names.test.ts`, o caso B2 e o caso das áreas por papel continuam com as mesmas asserções. O B2 prova que a entrada da escola não leva nada de `src/operacao/`. A única mudança ali é o prazo do `describe`, que passou para 60 s. Nenhuma asserção foi removida ou afrouxada.
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md`, as seções "Sem mutação" e "Correção" citam só `tamanho-web.test.ts` e `revisoes.test.ts`. Falta incluir `chunk-names.test.ts`, que entrou depois na mesma correção.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 16:03:10 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO

A correção mexe só em três arquivos de teste de build, de tamanho do bundle e de processo, e em um documento de correção. Nenhum deles toca dado de pessoa, log, armazenamento de arquivo, exportação ou envio externo, então não há nada que a regra 20 bloqueie.

Campos pessoais tocados: nenhum. As mudanças são de prazo e de relógio: `{ timeout: 60_000 }` no describe de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/chunk-names.test.ts:338` e no de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/ci/tamanho-web.test.ts:95`, e um `utimesSync` que fixa o `mtime` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/processo/revisoes.test.ts:758-762`. O `utimesSync` já estava importado na linha 2.
Fora da tabela de dados do docs/lgpd.md: nada, porque não há campo novo.
Autorização por objeto: não se aplica, porque não há rota nem repository alterado.
Logs: limpos. Não há log novo; o único texto escrito é `// comentário novo, e só ele\nexport const a = 1\n`, que é sintético.
Auditoria: não se aplica, porque nenhuma ação da regra 20, item 10, foi tocada.
Envio externo: nenhum. Os processos filhos (`npx size-limit`, o build do Vite e `node revisoes`) rodam na máquina local, sobre repositório temporário ou sobre o build.
Seed/fixture: sintético. Os textos dos testes alterados são código e comentário inventados, sem nome, matrícula, nota ou conversa.
Bloqueantes: nenhum.
Recomendações:
- O documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md` cita um caminho em `/tmp/claude-1000/...` de outra sessão para a lista "Fora desta correção". Esse caminho não sobrevive à sessão e o repositório é público. Não é dado pessoal, mas vale trocar pela lista dos arquivos ou por uma referência estável.
- A seção "Correção" do documento cita só dois arquivos na frase de "Sem mutação". A frase deveria incluir também o `chunk-names.test.ts`, para ficar coerente com o "Sintoma".

Pergunta de fechamento: esta correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua sendo a dos caminhos já existentes (arquivo do titular e `ExecucaoAgente`), sem efeito desta correção.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 16:03:14 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. Os três arquivos alterados são testes de `tools/` e do build da web, e nenhum deles grava `Nota`, `Correcao` ou dado de aluno. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A correção não cria nem altera fluxo de saída de IA.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nada mudou no que a governança declara nem na tela que mostra a autonomia ao coordenador.

Bloqueantes: nenhum.

O diff faz só três coisas:
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/chunk-names.test.ts:338`**: o prazo do describe "o build de verdade da web" sobe para 60 s. Os 14 casos continuam com as mesmas asserções.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/ci/tamanho-web.test.ts:95`**: o prazo do describe também sobe para 60 s. Os tetos do `.size-limit.json` e as asserções ficam iguais.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/processo/revisoes.test.ts:761-762`**: a hora de modificação do arquivo escrito passa a ser fixada uma hora no futuro, com `utimesSync`, que já estava importado na linha 2. O caso continua provando que um comentário novo invalida o carimbo (`status` 1 e "mudou em"). O código de produção do `avaliarCarimbo` não mudou.

Nenhuma dessas mudanças afrouxa um teste que guarda a regra 70: não toca Nota, D55, D57, tutor, governança nem indicador de professor. Também não há tela nesta correção, então não havia fotos a conferir. Os demais arquivos modificados na árvore são da tarefa 1.0 e ficaram fora desta auditoria, como o documento declara.

Recomendações:
- Corrigir o texto de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md`, que ficou para trás depois que o `chunk-names` entrou na correção:
  - A seção "Mutações" fala em "as duas mudanças desta correção", mas são três.
  - Em "Sem mutação", a lista nomeia só `tamanho-web.test.ts` e `revisoes.test.ts`; falta `apps/web/chunk-names.test.ts`.
  - Em "Estabilidade", não há uma linha para o `chunk-names` rodado de novo sob carga depois da correção.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 16:03:16 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica (a correção só mexe em três arquivos de teste)
Fila e prioridade: ok (não se aplica, a correção não toca fila nem job)
Concorrência: protegida (nenhuma operação de produção muda)
Índice e paginação: ok (não se aplica, a correção não traz query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica, não há código novo no caminho quente)
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/chunk-names.test.ts:338` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/ci/tamanho-web.test.ts:95`: o prazo de 60 s cobre o build e o `size-limit` sob carga, mas também esconde uma regressão de tempo do build. O tempo do portão local precisa continuar à vista na retro. Se o portão passar a demorar, a saída é rodar esses describes fora do paralelismo, não subir o prazo de novo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/processo/revisoes.test.ts:762`: o `mtime` agora fica uma hora no futuro. Se o `conferir` vier a rejeitar `mtime` no futuro como sinal de relógio errado, o caso quebra por um motivo que não é o que ele prova. Vale um caso próprio no teste do `avaliarCarimbo` para essa borda.
- O documento da correção diz que o `mtime` do kernel fica até 1,5 s atrás do `Date.now()` no WSL2 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md`). No uso real esse atraso pode deixar passar uma edição feita logo depois do portão. O próprio documento já deixa isso fora do escopo; o item fica para a retro, não para esta correção.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 16:03:19 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Esta correção não tem Tech Spec, e nenhuma linha de produção muda.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferi três pontos:
- **Escopo:** as três mudanças ficam só em arquivos de teste. Duas aumentam o prazo de um `describe` para 60 s e a terceira fixa o `mtime` com `utimesSync`, que já estava importado. Nada da tarefa 1.0 entrou no diff.
- **O teste de `revisoes` continua provando a regra:** o `avaliarCarimbo` (`tools/processo/portao.ts:153`) primeiro olha se o `mtime` é posterior ao `inicio` e depois compara o conteúdo com o instantâneo (`mudouDeVerdade`). Com o `mtime` no futuro, o caso ainda só fica vermelho porque o comentário mudou o conteúdo. O caso não ficou trivial, só deixou de depender do relógio.
- **Prazo:** 60 s é o mesmo que os outros testes de `tools/processo/revisoes.test.ts` que sobem processo já usam. Nenhum caso fica sem prazo.

Recomendações (não bloqueiam):
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md:75-79`: as seções "Mutações" e "Sem mutação" falam em "as duas mudanças desta correção" e listam só `tamanho-web.test.ts` e `revisoes.test.ts`. Elas ficaram para trás quando `apps/web/chunk-names.test.ts` entrou. O texto deveria citar os três arquivos.
2. Mesmo documento, linha 61: o bloco "Estabilidade" não traz nenhuma corrida repetida do `chunk-names` sob os 36 laços de CPU depois da correção. Para ele só há o "verde depois" da linha 51. Vale registrar quantas vezes rodou sob carga e quantas ficaram verdes, como foi feito para o `tamanho-web`.
3. Mesmo documento, linhas 50-53: sobrou uma linha em branco no meio da lista de "Teste que reproduz".
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/processo/revisoes.test.ts:758-760`: o comentário diz "nesta máquina (WSL2)". Isso vale para a máquina de hoje, e o motivo continua certo em qualquer máquina. Sugiro tirar o nome da máquina e deixar só "o relógio grosso do kernel pode ficar atrás do `Date.now()`".

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 16:04:19 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO

Cenários exigidos (correção de teste intermitente, sem regra de produto nova):
- Os 14 casos do describe "o build de verdade da web" (`chunk-names`) não caem por prazo quando a unidade roda em paralelo.
- Os 19 casos de `tamanho-web` não caem por prazo sob a mesma carga.
- O caso de `revisoes` chega à cláusula que quer provar (comentário depois do portão conta como alteração) sem depender de o `mtime` do kernel ficar à frente do `Date.now()`.
- Nenhum dos três ajustes enfraquece a asserção que já existia.

Cobertos:
- **Prazo dos dois describes.** No vitest 5.0.0 instalado, o `{ timeout: 60_000 }` do `describe` chega a cada caso: `createSuiteCollector` junta `collectorContext.currentSuite?.options` às opções do teste e só depois lê `options.timeout ?? runner.config.testTimeout` (`node_modules/vitest/dist/chunks/run.CQOUYP-x.js:2623-2628`). Nenhum dos dois describes tem `beforeAll` ou `beforeEach`, e o prazo do describe não vale para eles, então não sobra hook com 5 s. As asserções ficaram como estavam. O prazo novo não esconde regra nenhuma: o que os testes provam é teto de bundle e nome de chunk, não duração.
- **O caso de `revisoes`.** O `utimesSync` põe o `mtime` uma hora à frente. Assim a alteração passa pelo filtro `alteracao.quando >= inicio` (`tools/processo/portao.ts:164`) e chega ao `mudouDeVerdade`, que compara o conteúdo com o instantâneo. O arquivo do fixture era `export const a = 1\n` (`tools/processo/revisoes.test.ts:373`) e o novo só acrescenta o comentário. Se alguém criasse uma exceção para comentário no `avaliarCarimbo`, o `conferir` devolveria 0 e o `expect(soComentario.status).toBe(1)` (`revisoes.test.ts:764`) ficaria vermelho. Antes, com o relógio atrasado, o caso nem chegava a essa cláusula. A correção faz o teste voltar a provar o que diz.
- **Rodados isolados, um comando por vez, sem pôr a máquina sob carga.**
  - `revisoes.test.ts -t "não carimba o que a suíte editou"`: 1 verde.
  - `tools/ci/tamanho-web.test.ts`: 19 verdes.
  - `apps/web/chunk-names.test.ts`: 31 verdes.
- **Sem `.skip`, sem teste comentado, sem mock novo, sem provedor de IA.** O diff só toca arquivos de teste, então não há cláusula de produção sem bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
1. O documento está defasado em relação à terceira mudança (`tasks/correcoes/2026-11-07-testes-sob-carga.md`):
   - A linha 75 diz "as duas mudanças desta correção são em arquivo de teste".
   - A linha 77 diz "a correção só altera `tools/ci/tamanho-web.test.ts` (…) e `tools/processo/revisoes.test.ts`".
   - As duas deixam de fora `apps/web/chunk-names.test.ts`, que entrou depois. Basta acertar o texto para três.
2. O prazo de 60 s é paliativo. A causa de fundo continua: o portão roda a unidade inteira em paralelo e alguns casos sobem processo (Vite e `size-limit`). Vale registrar para a retro a ideia de separar os testes que sobem processo num projeto do vitest com paralelismo limitado, antes que o quarto teste dessa família apareça.
3. Também para a retro: a correção mediu o `mtime` até 1,5 s atrás do `Date.now()` nesta máquina (WSL2). Hoje isso só afeta testes, porque o portão real leva minutos, mas a premissa `quando >= inicio` do `avaliarCarimbo` fica registrada como frágil se um dia o portão encurtar.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 18:49:06 · `tasks/correcoes/2026-11-07-testes-sob-carga.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de teste, sem Tech Spec própria, e nenhuma linha de produção mudou.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As quatro recomendações que fiz na 1ª rodada foram aplicadas:
- **"Mutações" e "Sem mutação":** "Mutações" agora fala em três mudanças, e "Sem mutação" cita os três arquivos.
- **"Estabilidade":** traz o `chunk-names` sob 36 laços de CPU, com 5 de 5 verdes depois da correção e 2 de 2 vermelhas no HEAD.
- **"Teste que reproduz":** a linha em branco saiu.
- **Comentário de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/processo/revisoes.test.ts:758`:** "nesta máquina (WSL2)" saiu, e nenhuma linha de código mudou.

Os destinos novos estão em ordem. A seção "Recomendações sem aplicar" e as duas linhas novas do `TODO.md` não mexem em código. A recusa da borda do `mtime` no futuro tem motivo verificável: `tools/processo/portao.ts:164` só compara `quando >= inicio`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/TODO.md:1115` diz que a correção subiu o prazo de "três describes", mas só dois tiveram o prazo levantado: `tools/ci/tamanho-web.test.ts:95` e `apps/web/chunk-names.test.ts:338`. A terceira mudança, em `revisoes.test.ts`, fixa o `mtime` e não mexe em prazo. Trocar por "dois describes".
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-07-testes-sob-carga.md:77` diz que nenhuma das 47 linhas listadas "é de `tools/`". A frase é verdadeira, mas uma das três mudanças desta correção está em `apps/web/`. Vale dizer que nenhuma das 47 linhas é de arquivo tocado por esta correção, para a leitura não depender de saber que `chunk-names.test.ts` fica fora de `src`.
