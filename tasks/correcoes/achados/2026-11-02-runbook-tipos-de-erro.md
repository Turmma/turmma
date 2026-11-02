# Achados das revisões — `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-02 00:29:07 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não cria nem altera migration, schema ou tabela. Os arquivos alterados são `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/mapas/13.relatorio.md`, três testes onde só o caminho citado mudou e o teste novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`.

Queries verificadas: nenhuma. Nenhuma linha de `apps/*/src` ou `packages/*/src` mudou. O teste novo só lê arquivos do repositório com `readFileSync` e chama `git ls-files`. Ele não toca banco, repository nem endpoint. Em `metrics.test.ts`, `instalacao.test.ts` e `mutacoes.test.ts`, a única mudança é a string do caminho, de `metrics.int.test.ts` para `metricas.int.test.ts`. A lista fechada `METRICS_WITH_ESCOLA` continua como estava, então o controle de cardinalidade por `escola_id` não muda.

Teste de isolamento: não se aplica. A correção não traz módulo, repository nem endpoint novo, então não há cláusula de escopo para remover mentalmente. A tabela nova do runbook lista nomes de classes de erro e onde cada uma nasce. Não traz `escolaId`, id de registro nem dado de pessoa, e nada nela revela se existe dado de outra escola.

Bloqueantes: nenhum.

Recomendações: nenhuma no escopo de isolamento multi-tenant.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-02 00:29:47 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de documento e teste, sem arquitetura nova e sem divergência a registrar.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que conferi:
- **As 20 linhas da tabela batem com o código.** Todo `tipo` novo é o `name` de uma classe que existe hoje em `apps/*/src` ou `packages/*/src`, por exemplo `apps/worker/src/job-failure.error.ts:15` e `packages/core/src/ia/task.ts:107`. O `ErroDoPostgres` que o runbook cita é mesmo o valor fixo de `packages/core/src/error/summarize-error.ts:53`.
- **Os números de linha batem.** As linhas da tabela "Troca à mão" em `tools/renomear/mapas/13.relatorio.md` correspondem ao runbook: linha 983 para `ErroDoPostgres` e linhas 990 a 1009 para a tabela.
- **As três citações foram corrigidas, e só elas.** Elas apontavam para `infra/test/metrics.int.test.ts`, e o arquivo certo, `infra/test/metricas.int.test.ts`, existe. Já `apps/realtime/test/metrics.int.test.ts`, citado em `.claude/rules/80-infra-e-carga.md:90`, existe e não era alvo.
- **Nenhum arquivo de produção mudou.** Por isso a correção dispensa o bloco de mutação, como o próprio documento diz.

Recomendações:
1. **`docs/runbook.md:984`: a frase sobre os alertas diz mais do que é verdade.** Ela afirma "Nenhuma regra de `infra/grafana/alertas/` busca por `tipo`", mas `job-falhou-de-vez.yaml:46` e `sala-codigo-errado-por-escola.yaml:47` usam um rótulo chamado `tipo`. É outro `tipo`, de métrica e não de log. Além disso, o teste citado só prova que nenhuma regra usa os nomes antigos. Sugiro escrever "Nenhuma regra de alerta filtra pelo `tipo` do log (o nome da classe de erro)".
2. **`tools/guardas/runbook-tipo-do-log.test.ts`: o nome da função engana.** `arquivosVersionados()` também lista arquivos não versionados (`--others --exclude-standard`), e o título do último teste repete "versionado". Sugiro trocar o nome, por exemplo para `arquivosDoRepositorio()`, ou deixar só `--cached`.
3. **A lista do teste é escrita à mão.** `TIPOS_RENOMEADOS` repete a tabela do runbook em vez de vir dos mapas de renomeação. O segundo caso segura o desvio, então é aceitável, mas um 21º nome renomeado depois não seria cobrado por ninguém.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/mapas/13.relatorio.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 00:30:34 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não muda nada)
Fila e prioridade: ok (não muda nada)
Concorrência: protegida (não muda nada)
Índice e paginação: ok (não muda nada)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Não entra métrica nova nem alerta novo. O runbook ganhou a seção "Buscar um erro no log pelo `tipo`", que liga cada um dos 20 nomes antigos de `tipo` ao novo. Nenhuma regra de `infra/grafana/alertas/` usa nome antigo, e o teste prova isso.
Bloqueantes: nenhum

A correção só mexe em documento e em teste. Conferi o seguinte:
- O `ErroDoPostgres` que o runbook cita continua no código, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/packages/core/src/error/summarize-error.ts:53`.
- As linhas 983 e 990 a 1009 da tabela "Troca à mão" batem com o runbook.
- `infra/test/metricas.int.test.ts` existe.
- Os cinco arquivos de teste da correção passam: o novo teste de runbook e o `restos` (46 casos), e os três que tiveram citação trocada (188 casos).

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md:984-985`: o texto diz que "Nenhuma regra de `infra/grafana/alertas/` busca por `tipo`", mas o teste citado ali só prova que nenhuma regra busca pelos 20 nomes **antigos**. Troque para "nenhuma regra busca pelo `tipo` antigo", ou faça o teste conferir que nenhuma regra filtra por `tipo`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/mapas/13.relatorio.md:74-94`: essa tabela libera o nome antigo pelo número da linha do runbook. Qualquer edição acima da linha 977 desloca a seção e faz o `restos` acusar os 21 nomes de novo. Vale registrar isso na retro da X8, porque é um defeito do jeito como a ferramenta libera o nome antigo, e não desta correção.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`: o teste de citação de `infra/test/` só pega arquivo `.ts`. Uma citação quebrada a `infra/k6/` ou a outra pasta de `infra/` passaria. Se a guarda é para ficar, estenda a outras pastas de `infra/`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-02 00:30:59 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO

Cenários exigidos (correção só de documento e teste, sem código de produção):
- caminho feliz: o runbook mostra, para cada classe de erro renomeada na X8, o `tipo` antigo e o novo na mesma linha da tabela;
- a tabela não pode se afastar do código: o nome novo existe como `name` de uma classe do servidor, e o antigo não existe mais em nenhuma;
- a "Causa" precisa valer: nenhuma regra de alerta filtra pelo `tipo` antigo;
- nenhum arquivo cita um teste de `infra/test/` que não existe (as três citações de `metrics.int.test.ts`);
- borda: o `ErroDoPostgres` continua igual e não pode entrar como renomeado;
- borda: um erro que só aparece no cliente web (`ErroDaApi`) não pode entrar na tabela;
- borda: os nomes antigos citados de propósito no runbook não podem quebrar o `restos`;
- permissão, isolamento e concorrência não se aplicam: não há endpoint, dado de escola nem operação concorrente.

Cobertos:
- `tools/guardas/runbook-tipo-do-log.test.ts`, os quatro casos citados pelo nome no documento:
  - "o runbook diz... na mesma linha": falha sem a seção e falha se faltar uma linha.
  - "o `tipo` novo de cada linha é o `name`...": guarda contra o desvio nos dois sentidos.
  - "nenhuma regra de alerta busca pelo `tipo` antigo".
  - "nenhum arquivo versionado cita um arquivo de `infra/test/` que não existe": vermelho com as três citações velhas, porque `infra/test/metrics.int.test.ts` não existe e `metricas.int.test.ts` existe.
- Conferi a lista contra o código: os 20 `this.name =` e `override readonly name =` de `apps/{api,worker,despachante}/src` e `packages/{core,shared}/src` (fora testes) são exatamente os 20 nomes novos da lista. Nenhuma classe calcula o nome com `new.target.name` ou `constructor.name`, então não sobra nome renomeado fora da tabela.
- O `ErroDoPostgres` vem de um valor literal em `summarize-error.ts` e o runbook diz isso.
- As 21 entradas de "Troca à mão" em `tools/renomear/mapas/13.relatorio.md` batem com as linhas 983 e 990 a 1009 do runbook.
- Rodei e passaram: o teste novo (4 de 4), `tools/renomear/restos.test.ts`, `tools/processo/mutacoes.test.ts`, `tools/processo/harness/instalacao.test.ts` e `packages/core/src/telemetry/metrics.test.ts` (230 de 230).
- Mutação: o diff não toca `apps/*/src` nem `packages/*/src` fora de teste, e a linha `**Sem mutação:**` tem motivo. Correto.
- Não há `.skip`, teste comentado, mock nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações:
1. `docs/runbook.md:984`: a frase "Nenhuma regra de `infra/grafana/alertas/` busca por `tipo`" é falsa ao pé da letra. `job-falhou-de-vez.yaml` usa `max by (tipo)` e `sala-codigo-errado-por-escola.yaml` usa `tipo="escola"`, mas esse `tipo` é o rótulo de métrica, não o do log de erro. O teste também só prova que nenhum nome antigo aparece ali. Sugestão de texto: "Nenhuma regra de `infra/grafana/alertas/` filtra pelo `tipo` antigo de um erro".
2. `tools/guardas/runbook-tipo-do-log.test.ts:12`: a lista `TIPOS_RENOMEADOS` foi escrita à mão. Hoje bate com o código, mas uma classe esquecida em outra adenda da X8 só seria vista na revisão. Um caso a mais pode exigir que todo `name = '<X>'` do servidor seja um nome novo da lista ou esteja numa lista curta de exceções.
3. As linhas fixas no "Troca à mão" do `13.relatorio.md` quebram o `restos` na primeira edição acima da linha 983 do runbook. A fragilidade vem da ferramenta, não desta correção, mas vale registrar na retro.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-02 00:37:31 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

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
Recomendações: nenhuma nova. As três da tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md` estão registradas, cada uma com um destino. Uma foi recusada, uma foi para a retro da X8 e uma foi para o TODO.md.

O que conferi no diff desta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md:985-986`: a frase nova está certa. As regras de `infra/grafana/alertas/` usam `tipo` só como rótulo de métrica, como em `job-falhou-de-vez.yaml` e `sala-codigo-errado-por-escola.yaml`. Nenhuma filtra pelo `tipo` do log.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`: a renomeação de `arquivosVersionados` para `arquivosDoRepositorio` chegou às três chamadas (linhas 59, 79 e 90) e não sobrou nenhuma referência ao nome antigo. O teste passa: 4 de 4.
- A rodada anterior não exigiu nenhuma correção.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-02 00:37:39 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. O diff não traz migration nem schema.
Queries verificadas: nenhuma. O diff não toca repository, query nem endpoint. As mudanças desde a 1ª rodada são três: o texto de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md` (linhas 982-983), o nome da função `arquivosVersionados` → `arquivosDoRepositorio` com as três chamadas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts` (linhas 37, 59, 79, 90) e as seções novas do documento da correção. Nenhuma delas cria, remove ou relaxa escopo de escola. Nenhum `@Unscoped()` novo. A lista fechada de métricas com `escola_id` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/packages/core/src/telemetry/metrics.test.ts` ficou como estava.
Teste de isolamento: não se aplica. A tarefa não cria módulo, tabela nem rota.
Bloqueantes: nenhum. A 1ª rodada não exigiu correção, então não há nada a conferir.
Recomendações: nenhuma nova. As três que a Mesa mandou para "Recomendações sem aplicar" não envolvem isolamento entre escolas, e o destino dado a cada uma está registrado no documento da correção.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-02 00:37:48 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Esta rodada mexe em três coisas: o texto do runbook, o nome de uma função e o título de um caso de teste da guarda, e a seção de recomendações do documento da correção.

Fora da tabela de dados do docs/lgpd.md: nenhum. Não entra campo novo nem migration.

Autorização por objeto: não se aplica. A correção não cria nem altera rota, repository ou query.

Logs: limpos. O trecho novo de `docs/runbook.md:985-986` fala do campo `tipo`, que é o nome da classe do erro, e não de dado de pessoa. A guarda `tools/guardas/runbook-tipo-do-log.test.ts` não loga nada: não há `console` nem `logger` no arquivo.

Auditoria: não se aplica. A correção não faz nenhuma das ações que exigem auditoria.

Envio externo: nenhum.

Seed/fixture: não se aplica. A correção não toca seed nem fixture, e o teste lê apenas os arquivos do repositório.

Bloqueantes: nenhum. A 1ª rodada não exigiu correções, e o diff desde ela só tem as duas recomendações aplicadas:
- `docs/runbook.md:985-986`: a frase agora diz que nenhuma regra de alerta filtra pelo `tipo` antigo do log e que o `tipo` das regras é rótulo de métrica. Está correta e não expõe dado.
- `tools/guardas/runbook-tipo-do-log.test.ts:37,59,79,90`: a função passou de `arquivosVersionados` para `arquivosDoRepositorio`, com as três chamadas trocadas e nenhum resto do nome antigo. O comportamento continua o mesmo.

Na seção "Recomendações sem aplicar" de `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`, nenhuma das três recomendações é de privacidade, e cada uma tem destino ou motivo registrado.

Recomendações: nenhuma nova.

Pergunta de fechamento: esta correção não muda nada no que o sistema guarda sobre o aluno nem no que envia para fora. A resposta a esse pedido continua a mesma de antes dela.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 00:37:52 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (o documento é uma correção e não cita seção da `techspec.md`; o diff só muda o texto do runbook e o nome de uma função de teste)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md:57`: a terceira recomendação sem aplicar diz que vai para o `TODO.md`. O `TODO.md` não foi alterado nesta árvore e não tem item sobre levar a guarda a `infra/k6/` ou a outras pastas de `infra/`. É preciso escrever o item no `TODO.md`, ou trocar o destino na tabela, para o registro não ficar apontando para lugar nenhum.

O que conferi nesta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md:985-986`: a frase nova está certa. As duas regras que usam `tipo` (`job-falhou-de-vez.yaml:46` e `sala-codigo-errado-por-escola.yaml:47`) usam como rótulo de métrica (`job_falhos`, `sala_limite_atingido_total`), não como `tipo` do log. A troca foi de duas linhas por duas linhas, e as linhas que a tabela do `restos` aponta continuam batendo: `ErroDoPostgres` está na 983 e `ArgumentoInvalido` na 990, como em `tools/renomear/mapas/13.relatorio.md:74-75`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts:37`: o nome `arquivosDoRepositorio` agora diz o que a função faz, porque o `git ls-files --cached --others` pega também os arquivos ainda não versionados. As três chamadas e o título do caso foram trocados, e não sobrou nenhum `arquivosVersionados`.
- Os motivos das duas recomendações sem aplicar que restam se sustentam: a lista fechada das 20 classes já é conferida contra o código pelo próprio teste, e o deslocamento por número de linha é defeito da ferramenta `restos`, que fica para a retro da X8.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-02 00:37:53 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só em uma frase de `docs/runbook.md`, no nome de uma função e no título de um caso de teste em `tools/guardas/runbook-tipo-do-log.test.ts`, e em seções novas do documento da correção. Nenhum desses arquivos escreve em `Nota`. Todos com autor humano? sim (nada mudou).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. Nada do tutor foi tocado.
Autonomia declarada e visível: sim. O diff não toca governança nem a declaração dos agentes.
Bloqueantes: nenhum

Conferido nesta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/docs/runbook.md:985-986`: a frase nova está certa. As regras de `infra/grafana/alertas/` (por exemplo, `job-falhou-de-vez.yaml`) só usam `tipo` como rótulo da métrica `job.falhos{tipo}`, ou seja, o tipo do job. Nenhuma delas filtra pelo `tipo` da classe de erro no log. A seção é de operação, não fala de aluno nem de professor, e não traz nenhum indicador de pessoa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts:37,59,79,90`: a função foi renomeada para `arquivosDoRepositorio` e todos os lugares que a chamavam foram trocados. O título do caso na linha 87 foi trocado junto. O que o teste faz não mudou.
- Não havia correção exigida na 1ª rodada, então não há nada a conferir sobre isso. As três recomendações que ficaram sem aplicar estão registradas com destino em `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`. Nenhuma toca a regra 70.

Recomendações: nenhuma nova.

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 00:38:58 · `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª rodada e o que ele afeta. A 1ª rodada não exigiu nenhuma correção.

**Cenários exigidos:** os mesmos da 1ª rodada, sem mudança de escopo.
- Cada uma das 20 classes renomeadas aparece no runbook com o `tipo` antigo e o novo, na mesma linha.
- O `tipo` novo é o `name` de uma classe do servidor, e nenhuma classe usa mais o antigo.
- Nenhuma regra de alerta busca pelo `tipo` antigo.
- Nenhum arquivo do repositório cita um arquivo de `infra/test/` que não existe.

**Cobertos:**
- Os quatro casos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`. Rodei o arquivo e deu 4 de 4 verdes.
- A troca de `arquivosVersionados` por `arquivosDoRepositorio` só muda o nome. O comando `git ls-files --cached --others --exclude-standard` é o mesmo, e as três chamadas foram trocadas. As asserções continuam as mesmas, então nenhum caso perdeu força.
- A frase nova do runbook (`docs/runbook.md:982-983`) é verdadeira. Nas duas regras de `infra/grafana/alertas/`, o `tipo` é rótulo de métrica: o tipo de job em `job-falhou-de-vez.yaml:46` e `tipo="escola"` em `sala-codigo-errado-por-escola.yaml:47`. O caso 3 continua provando que nenhum nome antigo aparece ali.
- A edição troca duas linhas por duas, então a seção não saiu do lugar. Isso importa porque a tabela "Troca à mão" do `13.relatorio.md` libera o nome antigo pelo número da linha. O texto novo não traz nenhum nome antigo. Rodei `tools/renomear/restos.test.ts` contra o runbook editado e deu 42 de 42 verdes.
- Não há `.skip`, mock nem provedor de IA. O caso não envolve concorrência.
- A seção "Recomendações sem aplicar" dá destino ou motivo a cada uma das três. A recusa da lista escrita à mão tem motivo: o 2º caso do teste já confere a lista contra o código nos dois sentidos, e a guarda `guardas/nome-de-mercado` pega classe nova.

**Bloqueantes:** nenhum.

**Recomendações:**
- `tasks/correcoes/2026-11-02-runbook-tipos-de-erro.md:36`: o documento ainda cita o 4º caso pelo nome velho, "nenhum arquivo versionado cita um arquivo de `infra/test/` que não existe". O nome mudou para "nenhum arquivo do repositório cita…". Basta trocar "versionado" por "do repositório" para o documento citar o teste pelo nome que ele tem. Nenhuma ferramenta de `tools/processo` lê essa seção, e o caso continua fácil de achar, então não bloqueia.
