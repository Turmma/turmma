# Achados das revisões — `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-12 21:20:13 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só reparte o job `infra` em fatias (`.github/workflows/ci.yml`, `tools/ci/compose.ts`, `tools/ci/infra.ts`), mais os testes e a documentação. Não há migration, schema, DTO, rota, repository nem seed no diff, e nada em `infra/` nem no `vitest.config.ts` mudou.
Fora da tabela de dados do docs/lgpd.md: nada, porque não entra campo novo.
Autorização por objeto: não se aplica, porque não há rota nem endpoint no diff.
Logs: limpos. A única saída nova é a mensagem de erro de `fatiaDosArgumentosDaInfra` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/compose.ts`). Ela repete só o argumento `--shard` que a esteira passou, sem dado de pessoa. Em fatia vermelha, o despejo dos logs do compose é o mesmo de antes. Agora são até três runners em vez de um, mas o conteúdo não muda e o repositório público não ganha superfície nova.
Auditoria: não se aplica, porque nenhuma ação do diff exige auditoria.
Envio externo: nenhum. O job `infra` continua sem publicar artefato. A guarda que já existia em `tools/ci/esteira.test.ts:507-512` ("nenhum outro job publica artefato…") continua cobrindo as três fatias, porque `workflow.jobs['infra']` é um job só com matriz.
Seed/fixture: sintético. O diff não toca seed nem fixture, e os artefatos públicos (traço e censo) continuam só no `e2e`, como já eram.
Bloqueantes: nenhum.
Recomendações:
- Os textos ligados à regra 20 que justificaram trazer o `privacy-guardian` (as linhas 142 a 168 do `ci.yml`, sobre o artefato público do e2e, e as linhas 50, 411 e 448 do `esteira.test.ts`) não foram mexidos. Vale dizer isso no commit, para a validação não procurar mudança onde não houve.
- O despejo de log do compose no job `infra` sai no log público da execução, que é visível em PR de fork. Hoje isso depende só de os testes de `infra/test` usarem dado sintético (regra 20, item 17). Nenhuma guarda garante isso, como o `ci.yml` já registra para o e2e. Um comentário curto no job `infra` dizendo a mesma coisa deixaria a dependência visível. Fica para a retro.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-12 21:20:33 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Esta é uma correção de esteira e nenhuma techspec é citada. O caminho escolhido é o mesmo que o e2e já usa (`tasks/correcoes/2026-10-03-e2e-em-fatias.md`), sem nenhuma divergência tomada em silêncio.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/compose.ts:185-195`: `fatiaDosArgumentosDaInfra` copia `fatiaDosArgumentos` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/prazo-do-e2e.ts:65-75`, com a mesma regex, a mesma faixa e a mesma mensagem. Só mudam o filtro de `--shard` e o rótulo. Isso cria um segundo jeito de ler a fatia. O melhor é extrair uma função comum que receba o rótulo, ou importar a do e2e.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/esteira.test.ts:84-86`: `fatiasDoE2e()` virou só um repasse para `fatiasDoJob('e2e')`. Dá para chamar `fatiasDoJob('e2e')` direto onde ele é usado e apagar o repasse.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/vitest.config.ts:16` ainda diz "uns 16 min dos ~21 da integração" para a infra. Pela própria correção, o número certo hoje é cerca de 42,5 min. Agora contradiz o README novo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/TODO.md:442-450`: o item "Job `infra` da esteira perto do teto, sem guarda" fica resolvido em boa parte por esta correção. A matriz passa a ter guarda em `esteira.test.ts`, e os textos do `ci.yml` e do README foram reescritos. O item continua aberto e não cita a correção. Cabe ao Orquestrador fechar ou reduzir o item, deixando só o que sobra (o `vitest.config.ts` e a frase do runbook sobre o teto do e2e).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/esteira.test.ts:375-376`: a asserção `timeout-minutes ≤ 45` não liga o teto ao tamanho real das fatias. Uma fatia que voltar a passar de 45 min só vai aparecer na esteira. Hoje esse risco está mitigado pelo comentário do `ci.yml` e pelo runbook. Fica registrado para a retro, e não é bloqueante.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-12 21:20:44 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança é só da esteira: `ci.yml`, `tools/ci/` e a documentação. Não muda nada do que roda em produção às 10h.
Rate limit: ok (não foi alterado)
Fila e prioridade: ok (não foi alterada)
Concorrência: protegida. As fatias rodam cada uma no seu runner e no seu compose, e o `fileParallelism: false` de cada fatia continua valendo.
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Nenhum alerta novo. A seção nova "Esteira vermelha na infra" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md`.
Bloqueantes: nenhum

O que conferi:
- **Testes:** `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts` passam (48 de 48).
- **Divisão das fatias:** simulei o algoritmo de fatia do Vitest 5.0.0 (sha1 do caminho e `calculateShardRange`), com as durações do log da execução 43325031136. A divisão sai 4, 4 e 3 arquivos, com 647 s, 789 s e 1.240 s. Bate com a conta da tarefa. A fatia mais longa fica em uns 21 min de teste, dentro dos 45 de teto. Nenhuma fatia fica vazia, e a união das três é o projeto inteiro.
- **Fatia malformada:** `fatiaDosArgumentosDaInfra` reprova antes de subir o compose quando recebe `0/3`, `4/3`, `${{` sem expansão ou duas fatias. O teste prova que, nesses casos, nenhum comando chega a rodar.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/vitest.config.ts:16`: o comentário ainda diz "uns 16 min dos ~21 da integração" para os testes de `infra/`. Hoje a soma é uns 45 min, e a esteira roda em três fatias. Vale alinhar o texto com o README e o runbook.
- Se um dia houver mais fatias que arquivos `*.int.test.ts` em `infra/test`, uma fatia sai vazia e o Vitest falha com "No test files found". A guarda de `esteira.test.ts` poderia exigir que o número de fatias não passe do número de arquivos do projeto `infra`. Assim o erro aparece na própria guarda, e não como vermelho sem explicação na esteira.
- O total `/3` está escrito em três lugares do `ci.yml`. O teste já confere que os três batem com a matriz. A recomendação é só registrar isso para a retro: se o e2e e a infra continuarem crescendo, um único lugar para o total evitaria editar três linhas.

## test-engineer · 1ª rodada · APROVADO · 2026-11-12 21:21:00 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO

Cenários exigidos (uma correção de esteira: não há dado de escola, papel de usuário nem concorrência de domínio, então os casos de isolamento, permissão e corrida não se aplicam):
- Caminho feliz: com `--shard=2/3`, o `ci:infra` sobe o compose, roda `npm run test:infra -- --shard=2/3` e derruba o ambiente, nessa ordem.
- Sem argumento, o projeto inteiro roda sem `--shard`. É o `npm run ci:infra` da máquina e o portão da tarefa.
- Fatia malformada reprova antes de subir o compose: índice acima do total (`4/3`), índice zero (`0/3`), `${{ matrix.fatia }}` que o GitHub não expandiu e duas fatias juntas.
- Fatia vermelha ainda derruba o compose e despeja o log com carimbo de hora.
- No workflow:
  - a matriz tem mais de uma fatia, numerada de 1 a n sem buraco;
  - `fail-fast: false`;
  - o total aparece igual nos três lugares (o tamanho da matriz, o `/n` do nome do job e o do `--shard` do passo);
  - cada fatia tem teto de até 45 min.

Cobertos: todos.
- `tools/ci/scripts.test.ts` › `ci:infra leva a fatia da esteira ao Vitest, e fatia malformada reprova antes de subir o compose` cobre o caminho feliz, a ordem das chamadas, o caso sem fatia, a fatia vermelha com despejo e os quatro formatos malformados. Para estes, afirma também que nenhuma chamada saiu (`toEqual([])`).
- `tools/ci/esteira.test.ts` › `a infra roda em fatias que não se cancelam…` cobre a matriz, o `fail-fast`, o nome do job e o teto.
- `tools/ci/esteira.test.ts` › `tem os jobs verificar, integracao, infra e e2e…` confere que o passo passa `--shard=${{ matrix.fatia }}/<tamanho da matriz>`.
- Os três testes da seção "Teste que reproduz" existem com esses nomes. Rodei os dois arquivos: 48 de 48 verdes.
- Mutações: rodei `node tools/processo/mutacoes.ts --faltando` no documento, e nenhuma linha nova com condição fica sem bloco. Conferi os 11 blocos contra o `git diff`, e cada um chega à sua cláusula pelo motivo certo:
  - Trocar `argumentos.length === 0` por `false` faz a chamada sem argumento lançar exceção, e o teste sem fatia quebra.
  - Trocar `argumentos.length === 1` por `true` deixa passar `['--shard=1/2','--shard=2/2']`, e o teste quebra.
  - Trocar `fatia === null` por `false` faz `--shard=${{` virar `NaN/NaN`, porque comparação com NaN dá falso e a validação não reprova. O teste quebra.
  - As mutações `indice < 1` e `indice > total` são mortas por `0/3` e `4/3`.
  - Tirar o espalhamento do `--`, tirar o repasse no `infra.ts` e as quatro mutações do `ci.yml` são todas mortas por asserção exata.
- Não há `.skip`, teste comentado nem mock que esconda a regra. As imitações de `npm` e `docker` só registram as chamadas, e a validação testada é a real, no `compose.ts`.
- IA não entra nesta correção. Concorrência também não, além do `fail-fast`, que está testado.

Bloqueantes: nenhum.

Recomendações:
1. O nome do teste novo em `tools/ci/esteira.test.ts`, "…e cada uma cabe no teto com folga", promete mais do que prova. O teste só confere `timeout-minutes` de até 45. Nada prova que a fatia mais longa, pela repartição por hash do Vitest, cabe nesse teto. A conta de 646, 780 e 1.237 s fica no documento e no comentário do `ci.yml`, e quem segura o crescimento é o runbook ("passando dos 30 min, acrescente fatia"). Eu tiraria "com folga" do nome, ou escreveria que a folga é conferida pelo runbook.
2. O `vitest.config.ts`, linhas 15 a 17, ainda diz "uns 16 min dos ~21 da integração" para o projeto `infra`. Isso destoa do README e do runbook, que agora dizem uns 45 min. Fica para alinhar numa próxima mexida.
3. A união das fatias ser o projeto inteiro, sem sobra nem repetição, depende do Vitest e não de teste nosso. Isso é aceitável e está declarado no documento. Fica registrado para a validação.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/compose.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/infra.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/scripts.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/.github/workflows/ci.yml

## revisor-geral · 2ª rodada · APROVADO · 2026-11-12 21:28:02 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção da esteira e não toca arquitetura de produto. O documento registra a mudança da infra para fatias.

Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependências, unidade e alvo sobre o código atual.

Bloqueantes: nenhum.

Nesta rodada, a única mudança de código está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/esteira.test.ts:368`. O teste da infra mudou de nome de "cabe no teto com folga" para "tem teto de até 45 min". Agora o nome diz o que o teste confere: o `timeout-minutes` é maior que 0 e no máximo 45. Com isso a recomendação do test-engineer foi aplicada. O resto do diff são o documento da tarefa, `achados/` e `indice.md`, escritos pelo hook ou copiados da tabela de recomendações. Não muda comportamento.

Recomendações: nenhuma nova. As da 1ª rodada continuam na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`, cada uma com destino.

## test-engineer · 2ª rodada · APROVADO · 2026-11-12 21:28:23 · `tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`

VEREDITO: APROVADO

Cenários exigidos: nesta rodada, só conferir se a recomendação da 1ª rodada foi aplicada. O teste da infra não podia prometer no nome "cabe no teto com folga", porque só confere o `timeout-minutes`.

Cobertos:
- A recomendação foi aplicada. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tools/ci/esteira.test.ts:368`, o nome do teste agora termina em "e cada uma tem teto de até 45 min". As asserções, nas linhas 370 a 376, conferem exatamente isso: há mais de uma fatia, `fail-fast` está falso, o nome do job mostra a fatia e o total, e `timeout-minutes` é maior que 0 e no máximo 45. O nome agora diz o que o corpo prova.
- O nome antigo não aparece em nenhum bloco de mutação do documento. Procurei "com folga" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md` e não achei nada, então a troca de nome não deixou nenhuma mutação sem o teste que ela cita. A seção "Mutações" não mudou desde a rodada aprovada.
- `npx vitest run tools/ci/esteira.test.ts` passou: 22 de 22.
- O resto do diff é texto, sem mudança de comportamento: a tabela "Recomendações sem aplicar", a seção "Revisões" escrita pelo hook, o arquivo de `achados/` e o `indice.md`.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada que ficaram sem aplicar estão registradas na tabela "Recomendações sem aplicar", cada uma com o destino dela (`TODO.md`, retro ou validação).
