# Achados das revisões — `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 02:19:49 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

**VEREDITO: APROVADO**

- **Escopo:** respeitado. A tarefa pediu duas cláusulas, nos dois removedores do `e2e/support/painel.ts`, e o diff traz só isso, mais o teste que reproduz o erro. Não há outro `delete from escola` em `e2e/` nem em `tools/`.
- **Aderência à Tech Spec:** ok. A tarefa conserta um defeito da develop no suporte do e2e e não mexe na arquitetura.
- **Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).
- **Bloqueantes:** nenhum.

**Recomendações:**

1. **Ainda sobra uma corrida pequena.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:195-196` e `:262-263`, o worker pode gravar um `job_registro` entre o apagar dos jobs e o `delete from escola`. Nesse caso a mesma FK volta a recusar a limpeza. A janela é de milissegundos e o caso fica raríssimo, mas não some. Há duas saídas:
   - repetir o par de deletes quando a FK falhar;
   - fazer o worker do ambiente de teste não pegar escola sintética do painel.

   Vale anotar na retro se a falha voltar na esteira.
2. **O teste só prova a FK que deu erro.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts` cobre só o `job_registro`. Se outra rotina do worker gravar em outra tabela com FK para `escola` (o expurgo, por exemplo), o mesmo sintoma volta com outro nome de restrição. Convém conferir se alguma outra tabela com FK para `escola`, sem `on delete`, é gravada pelo worker.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 02:19:51 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. Conferi a `job_registro` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/packages/core/src/db/schema/job-registro.ts`. Ela já tem `escola_id`, e a restrição `job_registro_escola_ou_sistema` só deixa o campo nulo em job de tipo `sistema.%`. O schema não mudou nesta tarefa.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:195`, em `removerPainel`: `delete from job_registro where escola_id = any($1::uuid[])`. O `$1` são os ids das 30 escolas que `semearPainel` acabou de criar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:262`, em `removerEscolaSemConvite`: `delete from job_registro where escola_id = $1`. O `$1` é a escola sintética semeada pelo próprio teste.

As duas consultas são de limpeza do e2e, rodam só no banco de teste e cada uma vale apenas para os ids que o próprio seed criou. Nenhuma alcança job de outra escola, nem job de sistema com `escola_id` nulo. Elas não passam por repository nem por endpoint, então os itens 2, 3, 5, 7 e 8 não se aplicam. Também não há `@Unscoped()` novo.

Teste de isolamento: não se aplica. A tarefa corrige código de apoio ao e2e e não cria escopo de tenant novo. O teste de regressão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts` funciona: sem cada uma das duas cláusulas, o `delete from escola` cai na FK, e é isso que as duas mutações registradas na tarefa mostram.

Bloqueantes: nenhum.

Recomendações:
- O teste de `removerPainel` (linha 38) só confere que os jobs das escolas semeadas sumiram. Vale incluir um job de outra escola ou de sistema e conferir que ele continua lá depois da limpeza, para registrar que o apagamento fica restrito às escolas do seed.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 02:19:52 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A limpeza apaga `job_registro`, que pelo mapa de `docs/lgpd.md:116` guarda só ids e parâmetro técnico, e só das escolas sintéticas que o próprio seed do painel criou.
Fora da tabela de dados do docs/lgpd.md: nada. `job_registro` já está na tabela, com finalidade e retenção.
Autorização por objeto: não se aplica. A tarefa não cria nem altera rota, repository ou DTO. O `delete` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:195` e `:262` só alcança os ids das escolas semeadas (`any($1::uuid[])` com `painel.escolas`, e `escola.id`), no banco do compose de teste (`urlDoBancoDeTeste`).
Logs: limpos. Não há log novo. O comentário novo não traz dado.
Auditoria: não se aplica. É limpeza de fixture de e2e no banco de teste, não uma ação da operação em produção. O caminho real de descarte (`ops:descartar-job`, com `job.descartado`) não foi tocado.
Envio externo: nenhum.
Seed/fixture: sintético. As escolas vêm de `semearPainel` e `semearEscolaDoConvite`, com nomes inventados e e-mail em `.invalid`. O job inserido em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts` não preenche `dados`, só escola, fila, prioridade e tipo.
Bloqueantes: nenhum.
Recomendações:
- O teste insere `tipo = 'retencao.expurgar-escola'` como literal. Se o tipo for renomeado, o teste continua passando com um tipo que não existe mais. Vale importar a constante do catálogo de jobs, se ela existir.
- Fechamento: a resposta à secretaria não muda. A tarefa não cria dado novo nem envio novo, e o `job_registro` real continua no mapa e no expurgo como antes.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 02:20:01 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:195` e `:262`: ainda resta uma corrida pequena. Os deletes correm em autocommit, sem transação. Se o worker gravar um `job_registro` da escola entre o `delete from job_registro` e o `delete from escola`, a FK recusa de novo. A rotina `sistema.expurgar-dado-pessoal` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/apps/worker/src/processors/expurgar-dado-pessoal.ts`) lê a lista de escolas antes do laço e grava escola por escola. A janela é de milissegundos, mas o e2e pode voltar a falhar de vez em quando. Para fechar, basta uma transação que trave as escolas antes de apagar: `begin`, `select id from escola where id = any($1) for update`, depois os deletes, depois `commit`. Assim a gravação do worker espera a trava e, quando a escola some, cai na FK do lado dele, que já registra o erro e segue.
- O mesmo vale para os outros removedores de `e2e/support/` que apagam `escola`. Os 10 arquivos têm o próprio `comBanco` e não vi um `delete from job_registro` fora do `painel.ts`. Qualquer escola sintética que fique no banco durante uma passada do worker pode ter a mesma falha. Vale um levantamento único em vez de correções uma a uma.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 02:21:25 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: REPROVADO

Cenários exigidos:
1. Caminho feliz: `removerPainel` apaga as 30 escolas e a rede quando o worker deixou um `job_registro` em alguma delas.
2. Caminho feliz: `removerEscolaSemConvite` apaga a escola e a rede com um `job_registro` dela.
3. Borda: o worker não só enfileirou, mas já executou o `retencao.expurgar-escola` da escola sintética antes do `afterEach`. Isso grava linhas em `expurgo_execucao`, que também tem FK para a escola.
4. Borda: o worker grava um `job_registro` entre o `delete from job_registro` e o `delete from escola`. É a corrida com o worker.
5. Isolamento: a limpeza só apaga linhas das escolas que o próprio teste semeou, nunca as de outras execuções no mesmo banco.
6. Permissão: não se aplica, porque é suporte de e2e com acesso direto ao banco.

Cobertos:
- Os cenários 1 e 2 estão em `tools/ci/painel-do-e2e.int.test.ts`, nos casos "removerPainel apaga as escolas semeadas, com os jobs que o worker enfileirou para elas" e "removerEscolaSemConvite apaga a escola com o job do worker".
- Os testes conferem o resultado: zero escolas e zero jobs depois da remoção. Rodei os dois e passaram (2 de 2).
- Os dois blocos de mutação batem com as duas linhas novas do `git diff`. Cada mutação deixa o seu caso vermelho pela FK, que é o motivo certo.
- O cenário 5 está coberto: os dois `delete` filtram pelos ids semeados.
- Não há `.skip`, mock nem chamada de IA.

Bloqueantes:
- `e2e/support/painel.ts:195` e `e2e/support/painel.ts:262`: a correção cobre só metade do caminho do worker que ela mesma aponta como causa.
  - O que está errado:
    - A rotina `sistema.expurgar-dado-pessoal` (`apps/worker/src/job-schedules.ts:34`, à 1h) grava um `retencao.expurgar-escola` por escola (`apps/worker/src/processors/expurgar-dado-pessoal.ts:51-56`).
    - Esse job vai para a fila de lote como não urgente. Fora da janela letiva ele é despachado logo, e às 1h a janela está fechada.
    - Quando o worker executa o job, o processador grava uma linha por categoria pelo `repositorio.registrar` (`apps/worker/src/processors/expurgar-escola.ts:109,126,132`). Essas linhas vão para `expurgo_execucao` (`packages/core/src/retencao/expurgo-da-escola.repository.ts:612`).
    - Essa tabela tem `escola_id notNull().references(() => escola.id)` sem `on delete` (`packages/core/src/db/schema/expurgo-execucao.ts:24-26`).
    - Resultado: na mesma esteira, o `afterEach` volta a cair, agora em `expurgo_execucao_escola_id_escola_id_fk`.
    - O teste só simula o enfileiramento, e o documento diz "Fora desta correção: nada".
  - Correção exigida:
    - Nos dois removedores, apagar também `expurgo_execucao where escola_id = ...` antes do `delete from escola`.
    - Acrescentar ao teste uma linha de `expurgo_execucao` na escola, como o worker grava ao executar o job (ou um caso próprio para isso).
    - Um bloco `mutacao` por cláusula nova.
    - Corrigir a "Causa" no documento.
    - Conferir também o job por escola da rotina das 19h (`TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS`, `job-schedules.ts:42`), a classificação. Ele também roda com a janela fechada e pode gravar em outra tabela com FK para a escola. Não verifiquei essa trilha. Apague o que ela grava, ou registre no documento que ela não grava nada nessas escolas.

Recomendações:
- Cenário 4, a corrida com o worker. Os deletes rodam em comandos soltos, sem transação. Se o worker grava um `job_registro` entre o delete do job e o da escola, a FK recusa de novo. A janela é curta, mas é o mesmo defeito intermitente. Um jeito de fechar:
  - Rodar a limpeza numa transação que começa por `select id from escola where id = any($1) for update`.
  - A inserção do worker fica esperando o fim da transação e depois falha do lado dele, onde a rotina já loga e tenta de novo.
  - Basta um comentário no código explicando a escolha. Não precisa de teste de carga.
- No segundo caso, falta a pré-condição que o primeiro tem (`expect(await quantosJobs([escola.id])).toBe(1)` antes de remover).
- O comentário de `painel.ts:194` cita só o expurgo noturno. Depois da correção, ele deve citar as rotinas pelo que gravam.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/packages/core/src/db/schema/expurgo-execucao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/apps/worker/src/processors/expurgar-escola.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 02:35:56 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Escopo: respeitado. Nesta 2ª rodada só mudou `e2e/support/painel.ts`, junto com o teste, o documento e o `TODO.md`. O produto não foi tocado.

Aderência à Tech Spec: ok. É uma correção de suporte do e2e e não toca a arquitetura. O documento explica a causa com as duas tabelas que têm chave estrangeira para `escola` sem `on delete`: `job_registro` e `expurgo_execucao`.

Portão local: carimbo válido. A mensagem do `conferir` foi "portão local válido para o código atual", com typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum.

Nenhuma correção tinha sido exigida na 1ª rodada. Conferi o que entrou depois dela:
- **Apagar `expurgo_execucao`:** os dois removedores agora apagam essa tabela antes de `job_registro` e de `escola` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:197` e `:265`). No repository do expurgo só há uma escrita no banco (`packages/core/src/retencao/expurgo-da-escola.repository.ts:612`), então o job não grava mais nada que trave a remoção da escola.
- **Teste:** os dois casos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts` conferem as pré-condições, que as linhas da escola semeada saíram e que o job e a linha de expurgo de uma escola de fora do seed continuam no banco. Assim, um `delete` que apagasse demais também derruba o teste.
- **Mutações:** são quatro blocos, um por `delete`, cada um apontando para o caso que o pega.
- **Minhas recomendações da 1ª rodada:** a corrida entre os `delete` e a revisão dos outros dez removedores do e2e estão registradas no `TODO.md`, em "Infra e operação", e na tabela "Recomendações sem aplicar" do documento. A terceira, sobre outra tabela com chave estrangeira gravada pelo worker, foi atendida com `expurgo_execucao` e com a conferência da rotina das 19h.

Recomendações:
- O `afterAll` do teste repete à mão a sequência de `delete` dos removedores. Se surgir uma terceira tabela, é preciso lembrar de mudar em três lugares. Isso entra no mesmo item do `TODO.md` que propõe juntar a limpeza num ponto só.
- `contar` monta o nome da tabela por interpolação na consulta. O tipo restringe os valores possíveis e não há risco, mas ler a consulta pede atenção. Fica como observação de legibilidade.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-21 02:36:03 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A `expurgo_execucao` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/packages/core/src/db/schema/expurgo-execucao.ts:24-26`) já tem `escola_id` obrigatório, com FK para `escola`. O schema não mudou. A `job_registro` não mudou desde a rodada 1.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:197`: `delete from expurgo_execucao where escola_id = any($1::uuid[])`. O `$1` são só os ids que `semearPainel` criou.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:265`: `delete from expurgo_execucao where escola_id = $1`. O `$1` é a escola sintética que o próprio teste semeou.
- As linhas 198 e 266 (`job_registro`) não mudaram desde a rodada 1.

As duas consultas novas são limpeza de fixture no banco de teste. Não passam por repository nem por endpoint e não alcançam linha de outra escola. Não há `@Unscoped()` novo, e os itens 2, 3, 5, 7 e 8 não se aplicam.

Teste de isolamento: presente e efetivo. A recomendação da rodada 1 foi aplicada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts`:
- O `beforeAll` cria uma escola de fora do seed, com um `job_registro` e uma linha de `expurgo_execucao`.
- Os dois casos conferem que essas linhas continuam lá depois da limpeza (linhas 61-62 e 76-77).
- Se alguém trocar o filtro por um delete sem `where escola_id`, esses dois `expect` falham.
- Os quatro blocos de mutação cobrem cada `delete` novo. Sem a cláusula, o `delete from escola` cai na FK.

Correções exigidas na rodada anterior: nenhuma.

Bloqueantes: nenhum.

Recomendações:
- No mesmo teste, linhas 29-34: se o `beforeAll` falhar antes de preencher `foraDoSeed`, o `afterAll` quebra ao ler `foraDoSeed.escolaId`, e o erro que aparece esconde a causa real. Basta proteger com `if (foraDoSeed)`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 02:36:05 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

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

O que foi conferido nesta rodada:
- A 1ª rodada não exigiu nenhuma correção. A exigência do `test-engineer` foi cumprida. Os dois removedores agora apagam `expurgo_execucao` e depois `job_registro`, antes de apagar a escola. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:196-198` e `:265-267`.
- O teste está de acordo com o schema real (`packages/core/src/db/schema/expurgo-execucao.ts`). A categoria `conversa_tutor` passa pelo check da tabela. O tipo do job vem de `TIPO_EXPURGAR_ESCOLA`, importado do pacote compartilhado, e não de um texto escrito à mão.
- O teste também verifica que a limpeza não toca uma escola de fora do seed. Rodei `tools/ci/painel-do-e2e.int.test.ts` no Postgres do compose de teste: os 2 casos passaram.
- O job `expurgar-escola` grava fora do expurgo só pelo `enfileirarEliminacoes`. Essa trilha precisa de usuário vencido, e as escolas sintéticas do painel não têm nenhum. Nada mais gravado por ele ficou de fora.
- As duas recomendações que ficaram pendentes da 1ª rodada estão no `TODO.md`: a corrida entre o worker e a limpeza, e os dez outros removedores de `e2e/support/`. Elas também aparecem na tabela "Recomendações sem aplicar" do documento.

Recomendações:
- O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:193-195` diz que a rotina das 19h só grava `job_registro` porque a escola sintética não tem material. Isso só vale enquanto o seed do painel não semear material. Se um dia semear, a classificação passa a gravar `execucao_agente`, que também aponta para a escola, e a limpeza volta a falhar. Vale citar essa condição na linha do `TODO.md`, junto do levantamento dos outros removedores.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 02:36:12 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª e o que ele afeta. A 1ª rodada não exigiu correções. A minha recomendação dela foi aplicada: o teste agora importa `TIPO_EXPURGAR_ESCOLA` de `@educa/shared` em vez de escrever o tipo à mão.

Campos pessoais tocados: nenhum. A correção passa a apagar também `expurgo_execucao`, que guarda só id, escola, categoria, contagem de linhas, `concluida` e data. Nenhuma coluna diz de quem era o que saiu (`packages/core/src/db/schema/expurgo-execucao.ts:10`). O `job_registro` continua como na 1ª rodada (`docs/lgpd.md:116`).

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo nem tabela nova. O `expurgo_execucao` já aparece em `docs/lgpd.md:152` e `:158`, com o que registra e a retenção de 5 anos.

Autorização por objeto: não se aplica. A tarefa não toca rota, repository nem DTO. Os `delete` novos em `e2e/support/painel.ts:197` e `:265` alcançam só os ids que o próprio seed criou. O teste agora prova isso: uma escola de fora do seed mantém o job e a linha de expurgo depois de cada limpeza (`tools/ci/painel-do-e2e.int.test.ts:227-228` e `:246-247`).

Logs: limpos. Não há log novo, e os comentários novos não trazem dado.

Auditoria: não se aplica. É limpeza de fixture do e2e no banco do compose de teste (`urlDoBancoDeTeste`). O expurgo real e o `ops:descartar-job` não mudaram.

Envio externo: nenhum.

Seed/fixture: sintético. A escola de fora do seed se chama "Escola sintética da limpeza <uuid>", na "Rede sintética da limpeza <uuid>", com o slug `limpeza-<uuid>`. A linha de `expurgo_execucao` inserida traz `conversa_tutor`, 0 linhas, concluída. É só categoria e número, sem conteúdo.

Bloqueantes: nenhum.

Recomendações:
- O `afterAll` do teste (`tools/ci/painel-do-e2e.int.test.ts:186-189`) apaga a escola de fora do seed em comandos soltos, como os removedores. Se o worker do ambiente gravar nela durante o teste, a limpeza pode cair na mesma FK e deixar a escola sintética no banco de teste. Não vaza nada, porque o dado é sintético e fica só no banco de teste. Isso vale para a linha do `TODO.md` sobre a corrida e o ponto único de limpeza.
- Fechamento: a resposta à secretaria não muda. A tarefa não cria dado novo nem envio novo, e as duas tabelas continuam no mapa e no expurgo como antes.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/packages/core/src/db/schema/expurgo-execucao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/docs/lgpd.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 02:36:16 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff não grava, apaga nem lê `Nota`. Os comandos novos só apagam `expurgo_execucao` e `job_registro` das escolas que o próprio seed criou, no banco de teste. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA é criada, aprovada nem apagada. `execucao_agente` e `artefato` não foram tocados. O documento confirma que a rotina das 19h, a da classificação, não grava `execucao_agente` em escola sem material, e a escola sintética do painel não tem material.
Supervisão do tutor: ok. A única menção ao tutor é a categoria de retenção `'conversa_tutor'` na linha falsa de `expurgo_execucao`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts:40`. A linha registra `linhas = 0` e não guarda conteúdo de conversa, e não muda a forma como o tutor é usado ou acompanhado.
Autonomia declarada e visível: sim. Nada mudou na governança nem no que cada agente declara fazer sozinho.
Bloqueantes: nenhum

Recomendações: nenhuma da regra 70. Para registro, apagar `expurgo_execucao` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts:197` e `:265` remove só as linhas das escolas sintéticas no banco de teste. Isso não toca a auditoria de IA: essa tabela guarda o que o expurgo fez, e não o que a IA gerou nem quem aprovou. A consulta "o que a IA gerou, quem aprovou, quando" e o dossiê continuam iguais.

Na 1ª rodada não houve correção exigida de mim. Nesta, conferi o diff de `1a09adeb` a `c750c939` (os arquivos `TODO.md`, `e2e/support/painel.ts`, o documento da tarefa e `tools/ci/painel-do-e2e.int.test.ts`). Nenhum item da regra 70 é afetado. Não houve tela, então não houve foto para conferir.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 02:36:46 · `tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md`

VEREDITO: APROVADO

Cenários exigidos:
1. Caminho feliz: `removerPainel` apaga as 30 escolas e a rede mesmo quando o worker já gravou nelas.
2. Caminho feliz: `removerEscolaSemConvite` apaga a escola e a rede mesmo quando o worker já gravou nela.
3. Borda: o worker não só enfileirou o `retencao.expurgar-escola`, mas também o executou, e por isso existe linha em `expurgo_execucao`. Era o bloqueante da 1ª rodada.
4. Borda: a rotina das 19h (`TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS`) passou pela escola sintética.
5. Borda: o worker grava entre os deletes e o `delete from escola` (a corrida).
6. Isolamento: a limpeza não alcança linha de escola de fora do seed.
7. Permissão: não se aplica. É suporte de e2e com acesso direto ao banco de teste.

Cobertos:
- **Cenários 1, 2 e 3.** Estão em `tools/ci/painel-do-e2e.int.test.ts`, nos dois casos. Cada caso grava o par `job_registro` (com `TIPO_EXPURGAR_ESCOLA` importado) e `expurgo_execucao`. A linha usa uma categoria válida pelo check da tabela. O teste confere as pré-condições, limpa e afirma zero nas três tabelas. Rodei: 2 de 2 verdes.
- **Correções exigidas na 1ª rodada, todas feitas:**
  - `delete from expurgo_execucao` nos dois removedores, em `e2e/support/painel.ts:197` e `:265`.
  - Linha de `expurgo_execucao` no teste.
  - Quatro blocos `mutacao`, um por cláusula nova. Conferi contra o `git diff HEAD`: há exatamente quatro `delete` novos.
  - "Causa" reescrita no documento.
- **As quatro mutações ficam vermelhas pelo motivo certo.** Sem uma das cláusulas, o `delete from escola` cai na FK correspondente. As duas tabelas não têm FK entre si, então tirar uma linha não mascara a outra.
- **Cenário 4.** Conferi a trilha em `apps/worker/src/processors/agendar-classificacao.ts` e no `AgendamentoDaClassificacaoRepository`. A rotina só grava o `job_registro` por escola. O job por escola só insere `execucao_agente` quando `proximasSecoes` devolve alguma seção, e a escola sintética não tem material. O que o documento afirma confere.
- **Outros caminhos do `expurgar-escola`.** O único `insert` do `ExpurgoDaEscolaRepository` é o de `expurgo_execucao`, na linha 612. O resto (`enfileirarEliminacoes`, as provisórias vencidas, os envios parados) só age sobre dado que a escola sintética não tem.
- **Cenário 6.** A escola `foraDoSeed` recebe o mesmo par de linhas, e os dois casos afirmam que ela continua com 1 job e 1 linha. Um `delete` sem `where` deixaria o teste vermelho. A escola é apagada no `afterAll`. O projeto `integracao` não sobe worker, então a contagem `toBe(1)` não oscila.
- **Recomendações da 1ª rodada aplicadas:** a pré-condição no segundo caso e o comentário que cita as rotinas pelo que gravam.
- **Sem `.skip`, sem mock, sem IA.** O teste roda contra o Postgres real do compose de teste.

Bloqueantes: nenhum.

Recomendações:
- **Falta a limpeza de uso em `removerEscolaSemConvite` (`e2e/support/painel.ts:263-269`).** Ela não apaga `uso_infra_diario`, que tem FK para `escola`. Essa tabela é gravada pela rotina das 2h (`sistema.consolidar-uso`, `apps/worker/src/processors/consolidar-uso.ts`) a partir do contador de jobs da escola no Redis, e o próprio `expurgar-escola` rodado para a sintética pode alimentar esse contador. Só falharia se o e2e atravessasse as 2h com a escola viva, então é remotíssimo. Vale uma linha na "Causa" do documento, que hoje não cita a rotina das 2h, ou entrar no levantamento já registrado no `TODO.md`.
- **A ordem dos deletes não importa.** O documento e o comentário dizem que `expurgo_execucao` sai antes de `job_registro`, mas não há FK entre as duas tabelas. Dá para tirar esse "nessa ordem" para não sugerir uma dependência que não existe.
- **Corrida restante e levantamento dos outros dez removedores:** já estão no `TODO.md` e na tabela "Recomendações sem aplicar", com destino. Nada a acrescentar.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/e2e/support/painel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/painel-do-e2e.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-limpeza-do-painel-com-job-registro.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/apps/worker/src/processors/agendar-classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/apps/worker/src/processors/consolidar-uso.ts
