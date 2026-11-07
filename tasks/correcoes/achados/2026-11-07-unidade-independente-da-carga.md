# Achados das revisões — `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 12:34:14 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A correção não cria nem altera migration, schema ou tabela de domínio.
Queries verificadas: nenhuma. Não há repository, query, endpoint, `@Unscoped()` nem consulta da camada de rede no diff. A tarefa só mexe em configuração do Vitest (`maxWorkers` do projeto `unidade`) e em prazos de `describe` e de `it` em testes de ferramentas.
Teste de isolamento: não se aplica. A correção não toca escopo de tenant, então não há cláusula de escopo que um teste de isolamento precisasse provar. O teste novo, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts`, prova o limite de trabalhadores e os prazos, sem relação com o isolamento entre escolas.
Bloqueantes: nenhum.
Recomendações:
- O comentário igual repetido nos `describe` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/guardas/guardas.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/revisoes.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/renomear/conferir.test.ts` diz "o caso leva uns 3 s livre". Esse número foi medido para `chunk-names` e `tamanho-web`. O documento da tarefa registra `conferir` em cerca de 7 s por arquivo. Vale ajustar o texto de cada um (fora do meu escopo; fica para o `revisor-geral`).

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 12:34:19 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO

Esta correção não toca em dado de pessoa. Ela só muda quantos trabalhadores o Vitest usa e quanto tempo os testes que sobem processo podem levar. Nenhum caminho por onde um dado de aluno poderia vazar foi alterado.

Campos pessoais tocados: nenhum. O diff mexe em `vitest.config.ts` (o `maxWorkers` do projeto `unidade`), no `{ timeout }` de sete `describe` e nos prazos já existentes de `catraca` (de 240 s para 600 s) e de `esteira` (de 60 s para 180 s). Nenhuma asserção mudou.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration, schema nem campo novo.

Autorização por objeto: não se aplica. Nenhuma rota, repository ou DTO foi alterado.

Logs: limpos. O teste novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts` só lê a configuração do Vitest e o código-fonte de sete arquivos de teste. As mensagens de falha dele mostram apenas o caminho do arquivo e o título do `describe`.

Auditoria: não se aplica. Nenhuma das ações que a regra 20, item 10, manda auditar foi tocada.

Envio externo: nenhum. Nada foi enviado a provedor de IA nem a qualquer serviço externo.

Seed/fixture: sintético. Nenhuma fixture ou seed foi alterada.

Pergunta de fechamento: esta correção não muda a resposta. O código que guarda o arquivo do titular e a lista de para onde o dado foi enviado continua igual.

Bloqueantes: nenhum.

Recomendações: nenhuma da minha regra. O prazo de 60 s que o `describe` "restos: a linha de comando" ainda precisa receber fica registrado no documento da tarefa e vai na correção do `restos`, que é quem edita esse arquivo.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 12:34:27 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção só mexe na configuração do Vitest e no prazo dos testes de ferramenta. Não toca no schema, no repository, em job, seed, importação nem webhook. Todos com autor humano? sim (nenhum caminho novo, e os que já existiam não mudaram).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de saída de IA foi alterado)
Supervisão do tutor: ok (nenhum código do tutor nem teste dele foi alterado)
Autonomia declarada e visível: sim (não muda: `governanca` e `docs/agentes.md` ficaram de fora do diff)
Bloqueantes: nenhum

Recomendações:
- O comentário igual nos sete `describe` ("o caso leva uns 3 s livre e passava de 5 s com ela carregada") não vale para todos. `conferir` leva 7 s o arquivo, e `revisoes` sobe 100 hooks. Um número por arquivo, ou nenhum, evita uma afirmação errada no código. É só texto, não afeta a regra 70.
- A regex de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts` só reconhece `describe('…', { timeout: N }`, com aspas simples e `timeout` como única chave. Se alguém formatar de outro jeito, o teste falha mesmo com o prazo declarado. Isso é do `test-engineer`, não desta regra.

Como cheguei ao veredito:
- Os oito arquivos de teste alterados e o teste novo só ganham `{ timeout }` no `describe`, ou um prazo maior no `it` (`catraca` 600 s, `esteira` 180 s). Nenhuma asserção mudou, então nenhuma guarda ficou mais fraca, inclusive as de SDK de IA, que estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/guardas/guardas.test.ts`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts` só acrescenta `maxWorkers` ao projeto `unidade`. O `include` e o `exclude` continuam iguais, então nenhum teste que prova a regra 70 sai da suíte. Os da integração (`mvp-tables.int.test.ts`, `entrega.int.test.ts`, `tutor.int.test.ts`, `governanca.int.test.ts`) estão em outro projeto e não foram tocados. Os de unidade (`turno-do-tutor.test.ts`, `governanca.test.ts`, `textos-da-governanca.test.ts`, `tutor.test.ts`) continuam incluídos.
- `docs/regulacao.md` não mudou nesta tarefa, e não há tela, então não havia fotos para conferir.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 12:34:36 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção do ferramental de teste: não cita seção da `techspec.md` nem toca contrato, arquitetura ou cenário de produto. O que o documento descreve em "Correção" bate com o diff, arquivo por arquivo. Os arquivos do `restos` (`arvore.ts`, `restos.ts`, `restos.test.ts`) ficaram de fora, como "Fora desta correção" declara.
Portão local: carimbo válido (`conferir` diz "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferi que o Vitest 5.0.0 instalado aplica o `maxWorkers` declarado no projeto. `resolveMaxWorkers` lê `project.config.maxWorkers` antes do valor global, em `node_modules/vitest/dist/chunks/index.B89dZ0-N.js:11781`. Então o limite em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts` vale só para o projeto `unidade`. Integração, infra e processo não mudam.

Recomendações:
- O mesmo comentário foi colado nos 7 `describe`: "Sobe um build de verdade, processo ou CLI … o caso leva uns 3 s livre e passava de 5 s com ela carregada". Ele não é verdade para todos:
  - `tools/guardas/guardas.test.ts:917` (`configuração das guardas`) usa o ESLint dentro do próprio processo, com `calculateConfigForFile`.
  - `tools/processo/revisoes.test.ts:1174` sobe `git init` e hooks.
  - Os tempos medidos são outros, como "conferir 7 s o arquivo".
  Melhor escrever o motivo uma vez, em `tools/ci/unidade-sob-carga.test.ts`, que já explica, ou trazer em cada arquivo o dado daquele caso.
- `tools/ci/unidade-sob-carga.test.ts:28` refaz a fórmula do config em vez de afirmar o teto. Isso é aceitável, mas tem um ponto cego: numa máquina de 2 núcleos o piso de 3 fica acima de `availableParallelism()`, e a mutação `maxWorkers: availableParallelism()` não fica vermelha. Na máquina do portão (12 núcleos) a mutação funciona.
- A regex de `tools/ci/unidade-sob-carga.test.ts:46` depende da formatação exata (`describe('…', { timeout: N }`). Aspas duplas ou um prazo extraído para uma constante quebram o teste sem que o prazo tenha mudado. Se o Prettier ou o lint mexer nisso um dia, troque por uma checagem menos presa ao texto.
- O comentário de `vitest.config.ts` cita "o CLI do `restos`" entre os casos que sobem processo, mas o `restos.test.ts` não ganhou prazo nesta correção (ficou para a outra, como o documento registra). Confira que a correção do `restos` põe `{ timeout: 60_000 }` em `restos: a linha de comando` e inclui o par na lista `QUEM_SOBE_PROCESSO`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 12:34:38 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

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

O que conferi:
- A mudança só mexe na configuração e nos testes. Não toca login, tutor, sala, prova, fila, IA, migration nem deploy.
- O Vitest 5.0.0 respeita o `maxWorkers` dentro de um projeto, e não só na raiz. Em `node_modules/vitest/dist/chunks/index.B89dZ0-N.js`, a função `resolveMaxWorkers` lê primeiro `project.config.maxWorkers`, e cada grupo de tarefas chama `pool.setMaxWorkers(group.maxWorkers)`. Então o limite posto no projeto `unidade` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts` vale de fato.
- Os scripts `test` e `test:unidade` do `package.json` rodam com `--project unidade`, e é aí que o limite entra.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts` passou aqui (8 casos). As duas mutações do `vitest.config.ts` (tirar o `maxWorkers` ou pôr `availableParallelism()`) quebram esse teste em qualquer máquina com 4 núcleos ou mais.
- Nenhum teste chama provedor pago.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts`: a lista `QUEM_SOBE_PROCESSO` não cobre os dois prazos que subiram no próprio caso: `tools/guardas/catraca.test.ts:206` (600 s) e `tools/ci/esteira.test.ts:489` (180 s). Se alguém voltar esses números, nenhum teste quebra. Dá para incluir os dois, com uma checagem do prazo no `it`.
2. O mesmo comentário foi copiado nos sete `describe` e diz que "o caso leva uns 3 s livre". Isso não vale para `tools/renomear/conferir.test.ts:524` (7 s o arquivo), `tools/guardas/guardas.test.ts` e `tools/processo/revisoes.test.ts:1174`. Melhor trocar por um texto sem número, ou com o número de cada um.
3. O teto do teste (`toBeLessThanOrEqual(Math.max(3, …))`) repete a fórmula da configuração. Se a fórmula mudar nos dois lugares, o teste segue verde. Fixar o valor esperado para uma contagem de núcleos conhecida (com `availableParallelism` simulado) prova a regra sem copiá-la.
4. O `{ timeout: 60_000 }` do `describe` "restos: a linha de comando" em `tools/renomear/restos.test.ts` ficou para a correção do `restos`. Tem de ser cobrado lá.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 12:35:58 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- O projeto `unidade` limita os trabalhadores: metade dos núcleos, com piso de 3.
- Os describes que sobem build, processo ou CLI declaram o próprio prazo (pelo menos 30 s).
- Os prazos que estouraram sob carga sobem: `catraca` vai a 600 s e `esteira` a 180 s.
- A correção não quebra as outras formas de rodar a suíte: `npm run test`, que junta unidade, integração e processo, e o portão completo (`portao-local.ts --e2e --infra`), que roda no lugar da esteira.
- Na esteira, o piso de 3 vale.

**Cobertos:**
- `tools/ci/unidade-sob-carga.test.ts` passa (8 casos, rodei aqui).
- O limite existe e é numérico. As mutações 1 e 2 deixam o teste vermelho nesta máquina de 12 núcleos.
- Os 7 describes da lista têm `{ timeout }` de pelo menos 30 s. O `it.each` fica vermelho se qualquer um deles perder o prazo, então a mutação 3 vale por todos.
- Não há `.skip`, mock nem provedor de IA.

**Bloqueantes:**

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts:67`: com a correção, `npm run test` nem começa.**
   - No Vitest 5, projetos com `maxWorkers` diferentes e o mesmo `sequence.groupOrder` derrubam a execução (`groupSpecs`, `node_modules/vitest/dist/chunks/index.B89dZ0-N.js:11839`).
   - O projeto `processo` fica no padrão de núcleos menos um, que dá 11 aqui, e o `unidade` passa a ter 6.
   - Reproduzi com `npx vitest run --project unidade --project processo tools/ci/unidade-sob-carga.test.ts tools/processo/hook-git.int.test.ts`. Saiu `Error: Projects "processo" and "unidade" have different 'maxWorkers' but same 'sequence.groupOrder'`, com "no tests".
   - `npm run test` (`package.json:17`) junta os dois projetos, e é o comando da suíte `test` do portão completo (`tools/processo/sequencia-do-portao.ts:60`). Esse portão é o que vale no lugar da esteira quando o GitHub não responde, e ele quebra em qualquer máquina onde os dois números não coincidam (2, 8 ou 12 núcleos).
   - A esteira escapa porque roda `test:unidade` e `test:processo` em separado (`tools/ci/verificar.ts`). O portão desta tarefa só roda a unidade, e por isso também não viu o erro.
   - **Correção exigida:**
     - Dar `sequence: { groupOrder }` próprio a quem tiver `maxWorkers` diferente (por exemplo, `processo` com 1). A outra saída é declarar o mesmo limite no `processo`.
     - Escrever o teste que fica vermelho sem isso, rodando `vitest run --project unidade --project processo` sobre um filtro pequeno e exigindo que os casos rodem. Uma alternativa é afirmar, lendo a configuração, que projetos com `maxWorkers` diferentes têm `groupOrder` diferente.
     - Pôr esse teste em um bloco de mutação.

2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts:6` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts:27-28`: o piso de 3 é cláusula nova sem bloco e sem teste.**
   - O título do caso promete "com piso de 3", mas o teste só afirma `>= 1` e `<=` a mesma fórmula da configuração, copiada.
   - Trocar `Math.max(3, Math.floor(n / 2))` por `Math.floor(n / 2)` deixa o caso verde em qualquer máquina com 6 núcleos ou mais, e esta tem 12.
   - **Correção exigida:**
     - Extrair a fórmula para uma função exportada, `limiteDeTrabalhadores(nucleos)`.
     - Testar 2 → 3, 4 → 3 e 12 → 6.
     - Afirmar igualdade com `limiteDeTrabalhadores(availableParallelism())`, e não `<=`.
     - Declarar o bloco ` ```mutacao ` que remove o `Math.max`.

**Recomendações:**
- **Núcleos da esteira.** O documento diz que a esteira tem 4 núcleos e que o piso de 3 é "o que o Vitest já usava lá", mas `.github/workflows/ci.yml:59` e `:105` falam em runner de 2 núcleos (2 trabalhadores). Se forem 2, o piso sobe a unidade da esteira de 1 trabalhador para 3, o contrário do que a correção quer. Confirmar o número e acertar o texto ou o piso.
- **Comentário copiado.** O mesmo comentário ("leva uns 3 s livre e passava de 5 s") foi colado nos 7 describes. Ele não confere em todos: o `conferir` leva 7 s no arquivo, e no `revisoes` são os hooks. Melhor um comentário curto e certo por arquivo.
- **Lista fixa.** O teste de prazo cobre só os 7 describes da lista. Um describe novo que suba processo fica sem guarda. Vale registrar isso como limite conhecido no próprio teste.
- **`catraca` e `esteira`.** Os prazos subiram (600 s e 180 s) sem afirmação nenhuma: voltar a 240 s ou 60 s não deixa nada vermelho. Aceitável por ser calibração, mas pelo menos esses dois casos poderiam entrar na lista com o piso de 30 s.
- **`restos`.** `restos: a linha de comando` continua no prazo de 5 s e já caiu sob carga. Conferir que a correção do `restos` traz o `{ timeout: 60_000 }` prometido em "Correção".

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 12:52:43 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts`: o caso do mesmo `maxWorkers` por `groupOrder` deixa de fora quem tem `fileParallelism: false` (`integracao` e `infra`). Se um projeto desses um dia ganhar `maxWorkers` próprio, o caso não vê. Vale anotar no comentário que esses projetos não podem declarar `maxWorkers`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts`: o caso dos prazos de `catraca` e `esteira` lê o arquivo-fonte com regex que depende do recuo de dois espaços. Se o formatador mudar o recuo, o caso quebra sem que nada de errado tenha acontecido. É aceitável como trava de texto, mas é frágil.

Esta rodada só mexe no ambiente de teste (`vitest.config.ts` e `tools/`). Nada toca código de produção nem a carga das 10h. Conferi a correção pedida pelo test-engineer:
- **Limite em função própria:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/testes/limite-de-trabalhadores.ts`, sem o piso de 3.
- **Mesmo `maxWorkers` em `unidade` e `processo`:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts`.
- **Os testes novos:** os dois arquivos passam (14 casos).
- **O `npm test`:** rodei com os três projetos juntos (`--project unidade --project integracao --project processo`). Ele começou e passou sem o erro de `maxWorkers` diferentes.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 12:52:45 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO

Escopo: respeitado. Pôr o mesmo `maxWorkers` no projeto `processo` vai além do texto da 1ª rodada, mas é necessário. Na linha 11838 de `node_modules/vitest/dist/chunks/index.B89dZ0-N.js`, o Vitest 5 lança erro quando dois projetos do mesmo `groupOrder` têm `maxWorkers` diferentes. Sem o mesmo limite no `processo`, o `npm test` nem começaria. A mudança está registrada no documento da correção, em "Correção" e "Mutações".

Aderência à Tech Spec: ok. É uma correção do processo e não toca a `techspec.md`.

Portão local: carimbo válido. O `conferir` devolveu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

Conferi cada item da ordem do `test-engineer`:
- **Limite em função própria:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/testes/limite-de-trabalhadores.ts`, com teste próprio e a mutação do `Math.max` declarada.
- **Mesmo limite no `processo`:** feito em `vitest.config.ts:99`. O teste do `groupOrder` deixa de fora os projetos com `fileParallelism: false`, que é o mesmo que o Vitest faz: projeto sem paralelismo vai para a fila sequencial antes da comparação.
- **Comentário por arquivo:** feito em `chunk-names`, `tamanho-web`, `conferir`, `revisoes` e `guardas`.
- **Prazos de `catraca` e `esteira` na guarda:** feito em `tools/ci/unidade-sob-carga.test.ts:241-254`. O recorte pelo próximo `it(` ou `describe(` de dois espaços funciona nos dois arquivos: o caso da `catraca` é o último do arquivo, e o da `esteira` é seguido por outro `it(` no mesmo nível.
- **Piso de 3 retirado:** feito. Com 2 núcleos o limite dá 1, e nesse caso o Vitest manda cada arquivo para a fila sequencial, como já fazia antes.

Recomendações:
- **Comentário longe dos `describe` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/guardas/guardas.test.ts:65`:** o comentário fala dos "três `describe` com prazo próprio", mas está só no primeiro. Os outros dois, nas linhas 743 e 916, ficaram sem comentário, a centenas de linhas dele. Uma linha curta em cada um seria mais fácil de ler.
- **Número de núcleos da esteira:** o documento e `limite-de-trabalhadores.ts:6` dizem que a esteira tem 2 núcleos, como o comentário de `.github/workflows/ci.yml:59`. Mas o runner `ubuntu-24.04` de repositório público costuma ter 4 vCPUs. Se for o caso, o limite dá 2 contra os 3 que o Vitest usava. Isso deixa a esteira um pouco mais lenta, não quebra nada. Vale conferir com `nproc` numa corrida e corrigir o texto se for o caso.
- **Ordem na catraca:** a pendência do `describe` de `restos.test.ts` ficou com a correção do `restos`, e essa correção também precisa incluir o par em `QUEM_SOBE_PROCESSO`. Vale conferir na revisão dela.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 12:53:34 · `tasks/correcoes/2026-11-07-unidade-independente-da-carga.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- O projeto `unidade` usa exatamente `limiteDeTrabalhadores(availableParallelism())`.
- A fórmula do limite: metade dos núcleos, arredondada para baixo. O piso está nos casos de borda 1 e 2 núcleos (ambos dão 1), sem zerar.
- `unidade` e `processo` rodam juntos sem o Vitest 5 recusar `maxWorkers` diferentes no mesmo `groupOrder`. Esse é o `npm test` começando.
- Os sete `describe` que sobem processo ou build declaram prazo próprio de pelo menos 30 s.
- Os prazos de `catraca` (600 s) e `esteira` (180 s) subiram e estão afirmados.

**Cobertos:**
- **Correção 1 feita.**
  - `vitest.config.ts:99` dá ao `processo` o mesmo `LIMITE_DE_TRABALHADORES`.
  - `tools/ci/unidade-sob-carga.test.ts` › `projetos que rodam em paralelo no mesmo groupOrder declaram o mesmo maxWorkers…` lê a configuração e agrupa por `sequence.groupOrder`. Na configuração anterior fica vermelho (6 contra `undefined`), e o bloco de mutação que remove a linha do `processo` cai pelo motivo certo.
  - Conferi a regra no próprio Vitest (`node_modules/vitest/dist/chunks/index.B89dZ0-N.js:11832-11841`). Ele só pula a checagem quando `isolate`, `groupOrder 0` e `maxWorkers === 1`. O filtro `fileParallelism !== false` do teste é mais estrito que isso, e está correto.
  - Rodei `vitest run --project unidade --project processo` sobre `limite-de-trabalhadores.test.ts` e `hook-git.int.test.ts`. Começa e roda os 55 casos, como o documento diz.
- **Correção 2 feita na forma que vale agora.** Como o piso de 3 saiu, o item se aplica a esta fórmula.
  - A fórmula foi extraída para `limiteDeTrabalhadores` em `tools/testes/limite-de-trabalhadores.ts`.
  - Os casos testados: 4 → 2, 12 → 6, 16 → 8; 5 → 2, 7 → 3; 1 → 1, 2 → 1.
  - O teste do projeto `unidade` compara com `toBe(limiteDeTrabalhadores(availableParallelism()))`, e não mais com `<=`.
  - O bloco que remove o `Math.max` cai em 1 → 0. Os dois blocos do `maxWorkers` da unidade (sem a linha, e com `availableParallelism()`) também caem, inclusive numa máquina de 2 núcleos.
- **Recomendações da rodada 1 resolvidas.**
  - O comentário copiado foi trocado por um comentário próprio em cada `describe`.
  - Os prazos de `catraca` e `esteira` agora são afirmados por `CASOS_COM_PRAZO_PROPRIO`, cada um com seu bloco.
  - O documento passou a dizer 2 núcleos para a esteira (ver a recomendação 1).
- **Os testes passam:** `npx vitest run tools/ci/unidade-sob-carga.test.ts tools/testes/limite-de-trabalhadores.test.ts` dá 14 de 14.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Os núcleos da esteira podem não ser 2.** O `.github/workflows/ci.yml` usa `runs-on: ubuntu-24.04`, a máquina hospedada do GitHub. Em repositório público ela costuma ter 4 vCPU, e o 2 só aparece num comentário em `ci.yml:59`. Se forem 4, o limite dá 2 contra os 3 do padrão do Vitest. Aí a frase "o mesmo que o Vitest já dava lá, sem ficar mais lenta" fica errada em dois lugares: `tools/testes/limite-de-trabalhadores.ts:6` e as linhas 58-59 do documento. Também pode encostar no teto de 20 min. Vale confirmar com um `availableParallelism()` no log da esteira antes de afirmar.
2. **Só um dos sete prazos tem bloco de mutação próprio.** Os outros seis prazos de `describe` (`tamanho-web`, os três de `guardas`, `conferir` e `revisoes`) têm o caso no `it.each`, mas não têm bloco. O `--faltando` não os acusa porque são arquivos de teste. Um bloco por arquivo deixaria isso provado, e não só suposto.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/vitest.config.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/testes/limite-de-trabalhadores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/testes/limite-de-trabalhadores.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/unidade-sob-carga.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-unidade-independente-da-carga.md
