# Achados das revisões — `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 08:25:29 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só mexe na esteira (`.github/workflows/ci.yml`, `tools/ci/`), em documentação e nos testes de `tools/ci/`. Não toca schema, migration, DTO, repository, rota nem fixture.

Fora da tabela de dados do docs/lgpd.md: nenhum, porque não entra campo novo.

Autorização por objeto: não se aplica. Não há rota nem endpoint novo.

Logs: limpos. O caminho do log é o mesmo de antes. Quando uma fatia falha, os logs dos serviços do compose são despejados (o despejo aparece em `tools/ci/scripts.test.ts:102` e `:217`). Esse despejo já existia no job único, agora pode acontecer em até três jobs, e o conteúdo vem das mesmas fixtures sintéticas. O job `integracao` continua sem `upload-artifact`. Os dois artefatos do workflow (`.github/workflows/ci.yml:190` e `:209`) são do e2e e não mudaram.

Auditoria: não se aplica. A correção não tem leitura, exportação nem alteração de dado de aluno, nota ou permissão.

Envio externo: nenhum. O workflow continua com `permissions: contents: read`, sem segredo e com `persist-credentials: false`. O `${{ matrix.fatia }}` interpolado no `run` vem de uma lista fixa `[1, 2, 3]`. Quem abre um PR não controla esse valor, então ele não abre caminho para injeção. Além disso, `fatiaDosArgumentosDoVitest` recusa formato errado antes de subir o compose, e isso tem teste em `tools/ci/scripts.test.ts:221-225`.

Seed/fixture: sintético. Nenhuma seed nem fixture mudou. Repartir os arquivos em fatias muda só onde cada teste roda, não os dados dele. Cada fatia começa com o banco vazio.

Bloqueantes: nenhum.

Recomendações:
- O runbook (`docs/runbook.md`, seção "Esteira vermelha na integração") manda somar a duração de cada arquivo com `gh run view <id> --log`. Isso já valia para a infra, mas vale uma linha lembrando que o log da esteira é público (o repositório é público). Uma fixture de integração que um dia imprima dado não sintético apareceria agora em três jobs, não em um. É o mesmo aviso que a seção do censo do e2e já faz.

Arquivos auditados:
- tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md
- .github/workflows/ci.yml
- tools/ci/integracao.ts
- tools/ci/executar.ts
- tools/ci/compose.ts
- tools/ci/esteira.test.ts
- tools/ci/scripts.test.ts
- docs/runbook.md
- README.md
- TODO.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 08:25:39 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção sem Tech Spec própria. O desenho é o que a infra e a unidade já usam: matriz `fatia`, `fail-fast: false`, `--shard=<i>/<n>` lido por `fatiaDosArgumentosDoVitest` e o compose de cada fatia montado por `executarTestesComInfra`. Não há uma segunda forma de fazer a mesma coisa.

Portão local: carimbo válido. O `conferir` passou para o código atual, com typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum.

O que conferi:
- **Fatia não esquecida:** `.github/workflows/ci.yml:85-112` declara o total de fatias em três lugares: a matriz, o `name` e o `--shard`. `tools/ci/esteira.test.ts` cobre os três. O caso dos comandos de cada job exige `/<tamanho da matriz>` no passo, e o caso novo (linhas 379-390) exige o `name`, o `fail-fast` e o teto abaixo de 30 min.
- **Uso local:** `tools/ci/integracao.ts:7` sem argumento roda o projeto inteiro. Com fatia malformada, o script reprova antes de subir o compose. `tools/ci/scripts.test.ts:204-227` prova o `up`, o teste e o `down` nessa ordem, o despejo de log quando a fatia sai vermelha e as quatro formas malformadas.
- **Nome do job:** `tools/processo/esteira.ts` não depende do nome antigo. Ele só aparece na fixture histórica `run-view-jobs-cancelada-por-prazo.json`, o que está certo.
- **Repartição:** `test:integracao` é `vitest run --project integracao`, então o `--shard` chega ao Vitest sem nada no meio. O documento registra uma fatia rodada sozinha na máquina: a 2/3, com 66 arquivos verdes em 9 min 55 s.
- **README:** a linha passou a citar a infra, que já roda em três fatias e faltava ali. É ajuste de documentação dentro do que a correção toca.

Recomendações:
- O comentário de `tools/ci/integracao.ts:4-6` repete a história da execução 44887365743, que já está no `ci.yml` e no runbook. Bastaria dizer que sem fatia o projeto roda inteiro e que a esteira passa a fatia. A história fica num lugar só e não envelhece em três.
- O limite de "12 min de teste numa fatia" está escrito à mão no `ci.yml` e em `docs/runbook.md:2040`, e nada avisa quando ele é passado. Isso já está no item M7 do `TODO.md`, que a correção atualizou para incluir a integração. Fica registrado para a retro: é a quarta suíte repartida pelo mesmo motivo sem esse aviso.

Arquivos auditados:
- .github/workflows/ci.yml
- tools/ci/integracao.ts
- tools/ci/executar.ts
- tools/ci/esteira.test.ts
- tools/ci/scripts.test.ts
- docs/runbook.md
- tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 08:25:49 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só a esteira de CI e a documentação dela; nenhum código de runtime mudou)
Rate limit: ok (não foi tocado)
Fila e prioridade: ok (não foi tocada)
Concorrência: protegida (não há operação nova; as fatias rodam em runners separados, cada uma com o seu compose e o seu banco)
Índice e paginação: ok (não se aplica, não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código novo no caminho quente nem alerta novo; o runbook ganhou a seção "Esteira vermelha na integração")
Bloqueantes: nenhum

Rodei `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts` aqui e os 53 testes passaram. Não rodei nenhuma das três fatias.

O que conferi:
- A matriz `[1, 2, 3]`, o `/3` do nome do job e o `--shard=.../3` do passo concordam, e `esteira.test.ts` confere isso.
- Uma fatia malformada reprova antes de subir o compose.
- O `ci:integracao` sem fatia continua igual ao de antes, então o portão local não muda.
- Nenhum outro arquivo depende do nome antigo do job ("integração (Postgres, Redis, storage)").

Recomendações:
- A tarefa só mediu a fatia 2/3 rodando sozinha. As fatias 1/3 e 3/3 ainda não rodaram sozinhas com o banco vazio. Se algum arquivo depender de outro ter rodado antes, isso aparece na primeira execução da esteira, e a primeira execução verde das três fatias deve ser conferida antes do pouso.
- O limite de "12 min de teste por fatia" existe só no comentário do `ci.yml` e no runbook, sem aviso automático. Isso continua aberto no item M7 do `TODO.md`, que agora inclui a integração, e é lá que deve ser tratado.
- Se a branch protection do GitHub exigir o check pelo nome antigo do job, a regra precisa ser atualizada para os três nomes novos (`integração 1/3`, `2/3` e `3/3`). Fica fora do repositório, então confira à mão.

Arquivos auditados:
- .github/workflows/ci.yml
- tools/ci/integracao.ts
- tools/ci/executar.ts
- tools/ci/esteira.test.ts
- tools/ci/scripts.test.ts
- docs/runbook.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 08:26:04 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO

**Cenários exigidos (infra da esteira, sem dado de escola):**
- **Caminho feliz:** a matriz `fatia: [1, 2, 3]` com `fail-fast: false`. O nome do job mostra a fatia. O passo leva `--shard=<i>/3` até o Vitest, depois do `up` e antes do `down`.
- **Borda 1:** a matriz, o `/N` do nome e o `/N` do `--shard` têm de concordar. Uma matriz com buraco ou com `include`/`exclude` precisa reprovar.
- **Borda 2:** fatia malformada reprova antes de subir o compose. Os casos são `${{` sem expandir, índice 0, índice acima do total e duas fatias.
- **Borda 3:** uma fatia vermelha ainda derruba o compose e despeja o log com carimbo de hora.
- **Borda 4:** sem fatia, o comando roda o projeto inteiro, como o `npm run ci:integracao` da máquina e o portão da tarefa.
- **Teto:** o limite de cada fatia fica abaixo dos 30 min do job único.
- **Permissão e isolamento entre escolas:** não se aplicam, porque a tarefa não toca rota nem dado de escola.
- **Concorrência:** as três fatias rodam em paralelo, cada uma no seu runner e com o seu compose. Não há estado em comum para disputar.

**Cobertos:**
- `tools/ci/esteira.test.ts`:
  - O caso "a integração roda em fatias que não se cancelam…" cobre as fatias (mais de uma), o `fail-fast`, o nome com `${{ matrix.fatia }}/3` e o teto entre 0 e 30.
  - O caso "tem os jobs verificar, unidade, integracao…" passou a exigir `--shard=${{ matrix.fatia }}/<tamanho da matriz>` no passo.
  - `fatiasDoJob('integracao')` exige uma lista de 1 a n, sem `include`/`exclude`.
- `tools/ci/scripts.test.ts`, caso "ci:integracao leva a fatia da esteira ao Vitest…": cobre a fatia e a ordem `up` → teste → `down`, a execução sem fatia e sem `--shard`, a fatia vermelha com `down` e despejo, e as quatro malformadas, que saem com código diferente de 0 e zero chamadas.
- Rodei os dois arquivos com `npx vitest run`: 53 de 53 verdes.
- Cada asserção cai se a regra for removida:
  - Matriz removida: `fatiasDoJob` volta `[1]` e o `toBeGreaterThan(1)` falha.
  - `--shard` tirado do passo: o `toEqual` dos comandos falha.
  - `integracao.ts` sem `fatiaDosArgumentosDoVitest`: o `toContain('… --shard=2/3')` e as malformadas falham.
  - Teto de volta a 30: o `toBeLessThan(30)` falha.
- A seção "Mutações" confere com o `git diff`. A única linha nova em `tools/` (`integracao.ts`) é uma chamada sem condição. `executar.ts` mudou só a união de tipo e o comentário. A leitura estrita da fatia já tem prova na infra e na unidade.
- Não há `.skip`, teste comentado nem IA. A imitação de `npm`/`npx`/`docker` só substitui o que está fora, e o `integracao.ts` real roda inteiro.
- Os nomes novos dos jobs não quebram nada: só a fixture de `tools/processo/__fixtures__/esteira/` cita o nome antigo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Só a fatia 2/3 foi provada sozinha na máquina. Um arquivo da 1/3 ou da 3/3 que dependa de outro ter rodado antes só aparece na esteira. O Orquestrador deve ler as três fatias verdes no push antes de dar a correção por fechada. Se uma ficar vermelha, a correção é no isolamento do arquivo, como o runbook já diz.
2. O nome do caso de `tools/ci/esteira.test.ts:379` diz "teto de até 30 min", mas a asserção é `< 30` e o `ci.yml` usa 25. Melhor algo como "abaixo dos 30 min do job único".
3. O limite "passando dos 12 min de teste numa fatia, acrescente fatia" (comentário do `ci.yml` e runbook) não tem guarda automática. Fica com o item M7 do `TODO.md`, que já cita a integração.
4. Em `tools/ci/scripts.test.ts:212-213`, `rodarScript('integracao.ts', null)` roda duas vezes. Guardar o resultado numa variável basta.

Arquivos auditados:
- tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md
- .github/workflows/ci.yml
- tools/ci/integracao.ts
- tools/ci/executar.ts
- tools/ci/esteira.test.ts
- tools/ci/scripts.test.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 08:36:00 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Rodada 2. A rodada 1 não exigiu correção. Revisei só o diff desde ela e o que ele afeta.

- **`tools/ci/esteira.test.ts:379-390`:** o nome do caso agora bate com o que ele confere, que é o teto `< 30` (linha 389). O nome antigo dizia "até 30 min", e a asserção não deixava chegar a 30. O `timeout-minutes: 25` em `.github/workflows/ci.yml:102` passa no teste. O "Teste que reproduz" do documento (linha 37) cita o nome novo.
- **`tools/ci/integracao.ts:4-5`:** o comentário agora aponta o porquê para o `ci.yml` em vez de repeti-lo. O comportamento não mudou.
- **`tools/ci/scripts.test.ts`:** o caso sem fatia agora roda o script uma vez só, guarda o resultado em `inteira` e faz as duas asserções sobre ele. Antes rodava duas vezes. As asserções são as mesmas.
- **Documento:** a tabela "Recomendações sem aplicar" (linhas 63-70) dá um destino a cada recomendação que ficou aberta: o `TODO.md` M7, o Orquestrador no pouso, o Joaquim na branch protection.

Recomendações:
- **`docs/runbook.md:2037`:** o parêntese novo cabe numa linha que já era longa e a deixa difícil de ler. Também diz "nada além da saída do Vitest vai para o log", mas é justamente pela saída do Vitest que um `console.log` de fixture vazaria. Sugiro tirar o aviso do parêntese e escrevê-lo como frase própria logo depois, por exemplo: "O log da esteira é público; fixture que imprime dado não sintético vaza agora em três jobs (regra 20, item 17)."

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 08:36:13 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO
Caminho quente tocado: deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 1ª rodada que não foram aplicadas estão registradas, com destino, em "Recomendações sem aplicar" de tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md.

Esta rodada só mexeu em comentário, nome de teste, texto do runbook e documento da tarefa. A rodada anterior não exigiu correção, então não havia o que conferir.

- O nome novo do caso em tools/ci/esteira.test.ts ("teto abaixo dos 30 min do job único") bate com o que o teste afirma (`toBeLessThan(30)`).
- O workflow continua com `fail-fast: false`, matriz `[1, 2, 3]`, `/3` no nome e no passo, e teto de 25 min por fatia.
- Em tools/ci/integracao.ts o comportamento é o mesmo: só o comentário mudou, e ele agora remete ao `ci.yml` para o porquê.
- tools/ci/scripts.test.ts ganhou só a variável `inteira`, e o que o teste confere é o mesmo.
- A frase nova em docs/runbook.md:2040, sobre o log público e a regra 20, item 17, não muda nenhum comportamento.
- Rodei `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts`: os 2 arquivos e os 53 testes passaram.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 08:36:13 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff só mexe em infraestrutura de CI: a integração roda agora em fatias, com matriz 1/3, `--shard` passado ao Vitest e teto de 25 min por fatia. Também mexe em comentários, num nome de caso de teste e no runbook. Nenhum schema, migration, DTO, rota ou fixture muda.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entra campo novo.

Autorização por objeto: não se aplica. Nenhuma rota foi criada ou alterada.

Logs: limpos. A forma de logar continua a mesma. `executarTestesComInfra` só ganhou o argumento da fatia, e o despejo do log dos serviços quando há falha continua carimbado do mesmo jeito (`afirmarDespejoCarimbado` em `tools/ci/scripts.test.ts`). O runbook agora diz que o log da esteira é público, como recomendei na rodada anterior (`docs/runbook.md:2040`). O texto diz que o log é público porque o repositório é público, que um fixture com dado não sintético apareceria em três jobs e que só a saída do Vitest vai para o log, citando a regra 20, item 17. Era essa a correção que eu tinha recomendado.

Auditoria: não se aplica. Nenhuma ação desta tarefa pede auditoria.

Envio externo: nenhum. Não há chamada a provedor de IA nem envio a terceiro.

Seed/fixture: sintético. Nenhum seed ou fixture foi alterado. As fatias só repartem os mesmos arquivos de teste por hash do caminho, e cada fatia começa com o banco vazio, como o job único começava.

Rodada nova, conferida pelo diff:
- `docs/runbook.md:2040`: o aviso do log público entrou.
- `tools/ci/esteira.test.ts`: o nome do caso agora diz "abaixo dos 30 min". O teste confirma o que o nome diz, com `toBeLessThan(30)`.
- `tools/ci/integracao.ts`: só o comentário mudou, sem efeito de privacidade.
- `tools/ci/scripts.test.ts`: só uma variável extraída, mesma asserção.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre o aluno nem para onde isso é enviado, então a resposta é a mesma da rodada aprovada.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 08:36:32 · `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md`

VEREDITO: APROVADO

Cenários exigidos (desde a 1ª rodada, que já foi aprovada):
- O job de integração roda em mais de uma fatia, as fatias não se cancelam, o nome mostra qual é a fatia e o teto de cada uma fica abaixo dos 30 min do job único.
- O passo do job é só `npm ci` mais `npm run ci:integracao -- --shard=${{ matrix.fatia }}/N`, e o N é o tamanho da matriz.
- O `ci:integracao` leva a fatia ao Vitest depois do `up` e antes do `down`.
- Sem fatia, roda o projeto inteiro, sem `--shard`.
- Uma fatia vermelha também derruba o compose e despeja o log.
- Fatia malformada reprova antes de subir o compose. Os casos são índice fora do total, índice zero, `${{` sem expandir e duas fatias.

Cobertos:
- Os testes de 1ª rodada continuam valendo, e os dois arquivos passam, 53 casos (`npx vitest run tools/ci/scripts.test.ts tools/ci/esteira.test.ts`).
- O que mudou nesta rodada:
  - `tools/ci/esteira.test.ts`: só o nome do caso mudou. O nome novo ("teto abaixo dos 30 min do job único") agora bate com a asserção `toBeLessThan(30)`. O nome antigo dizia "até 30", e a asserção nunca foi `<= 30`.
  - `tools/ci/scripts.test.ts`: as duas chamadas viraram uma variável `inteira`. As asserções são as mesmas, e o script roda uma vez só em vez de duas.
  - `tools/ci/integracao.ts`: só o comentário mudou, e o código é o mesmo.
  - `docs/runbook.md`: ganhou o aviso de que o log da esteira é público, com a citação da regra 20, item 17. Não é código e não pede teste.
- O documento `tasks/correcoes/2026-11-21-integracao-no-teto-da-esteira.md` está em dia:
  - Em "Teste que reproduz" (linha 37), o nome do caso é o novo.
  - "Recomendações sem aplicar" (linhas 63 a 70) dá um destino a cada recomendação da 1ª rodada.
  - "Mutações" continua coerente: nenhuma linha nova de `tools/` tem condição. O `integracao.ts` só chama `fatiaDosArgumentosDoVitest`, que já é provado na infra e na unidade, e o novo caso de `scripts.test.ts` prova de novo os caminhos dela pela integração.
- Não há `.skip`, nem mock que esconda a regra. Nenhum teste chama provedor de IA, e nenhuma operação concorrente está em jogo.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada estão registradas com destino no documento (linhas 67 a 70). Duas delas: ler as três fatias verdes no push, e conferir o nome do check na branch protection.
