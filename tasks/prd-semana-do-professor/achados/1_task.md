# Achados das revisões — `tasks/prd-semana-do-professor/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 15:02:08 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A diff não toca `Nota`, `correcao` nem qualquer gravação de avaliação, então a pergunta "todos com autor humano?" não se aplica.

Decisão autônoma sobre aluno: ausente. A tarefa só cria a tabela `aula` (o texto que a professora escreve sobre a aula), sem lógica sobre a trajetória do aluno.

Aprovação registrada: ok. Nenhuma saída de IA nasce aqui: a seção 8 da Tech Spec, "Uso de IA", diz "Não se aplica".

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nada muda: nenhum agente novo e nenhum nível alterado.

Regra 70, item 8 (a coordenação não alcança o que é do professor, sem métrica sobre ele), conferida no código e nos testes:
- **Permissões:** professor tem `proprio` em `aula.ler` e `aula.gravar`; coordenação, rede e aluno têm `nunca` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/permissao/matriz.ts:243,289,335,381`. O teste que prova as quatro células está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/permissao/matriz.test.ts:148`.
- **Arquivo do titular:** o texto da aula só sai na versão `completa` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/titular/leitura-do-titular.ts:147`). Isso é provado na unidade e na integração. Na versão da coordenação, nem o texto, nem o id, nem a chave da tabela aparecem (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:782-793`). O registro de um colega e uma aula plantada no vínculo de um aluno também ficam de fora.
- **Prévia do titular (D64):** inserir uma aula não muda a resposta da prévia, e a palavra "aula" não aparece nela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:586`). Não surge contagem, ranking nem indicador de adoção.
- **Saída do texto:** o texto apaga na virada do ano, com escopo de escola e de ano, e não passa por log, auditoria nem IA.
- **Regra 70, item 7:** não aparece nenhum campo sobre comportamento ou estado emocional de aluno.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/modelo-de-dados.md:275` chama a `Aula` de fonte do "seu dia e sua semana", "função do Assistente de ensino" (`docs/agentes.md`). Já `docs/lgpd.md` ("Registro da aula") diz que o texto "não vai a IA (a F11 reabre a linha)". Vale explicitar no modelo de dados que o Assistente usa a grade e o calendário, e não o `conteudo`, até a F11. Assim ninguém lê ali licença para mandar o texto ao modelo.
2. Na tarefa 2.0, quando existirem `GET /v1/semana` e `PUT /v1/aulas`, falta um teste de integração que prove que o coordenador recebe 404 nas duas rotas. Também falta um que prove que um professor da mesma turma e disciplina não lê o texto do colega (R4). A matriz de permissões sozinha não prova a rota.
3. O selo "Falta preencher" (seção 9 da Tech Spec) precisa continuar por aula e sem total. Também não pode chegar a nenhuma tela da coordenação, nem como agregado, porque viraria indicador de adoção (D64). Vale conferir isso na tarefa da tela.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 15:02:13 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:**
- `aula` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/drizzle/0041_registro_da_aula.sql`).
  - Tem `escola_id` (NOT NULL, com FK) e `ano_letivo_id` (NOT NULL).
  - A FK composta `(escola_id, ano_letivo_id, vinculo_id)` aponta para `vinculo` com `on delete cascade`.
  - O id é UUID, gerado por `uuidv7()`.
  - O índice `aula_semana_idx` começa pela escola e pelo ano.
  - Nenhum `@Unscoped()`.
  - A tabela está registrada em `database.ts`, em `index.ts` e em `tabelas-do-nucleo.mjs`.

**Queries verificadas:**
- `VinculoRepository.virarAno` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/estrutura/vinculo.repository.ts:362`): o `delete` usa `requireEscolaId()` do contexto e o `anoLetivoId`. O ano é o que o `AnoLetivoRepository` acabou de encerrar na mesma transação (`ano-letivo.service.ts:56`), não um valor vindo do cliente.
- `LEITURAS_DO_ARQUIVO.aula` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/titular/leitura-do-titular.ts:144`):
  - escopo de escola no `select` e no subselect;
  - ligação pelo vínculo de professor do titular;
  - só entra na versão `completa`.
- A matriz dá `proprio` ao professor e `nunca` à coordenação, à rede e ao aluno. A rede não alcança o texto nem o agregado dele.
- A tarefa não cria endpoint, então nenhum ponto aceita `escolaId` do corpo ou da query string.
- A prévia não ganha categoria nem contagem, e a versão `coordenacao` não traz nem a chave `aula`. Nada revela que o dado existe.

**Teste de isolamento:** presente e efetivo.
- `apps/api/test/virada-do-ano.int.test.ts` › "o escopo de escola vale sozinho nas aulas" forja o contexto da escola A com o ano da escola B. Se a cláusula `eq(aula.escolaId, requireEscolaId())` sair, a aula de B é apagada e o teste fica vermelho. Há um controle com a transação desfeita, que prova que a chamada alcançaria B com o contexto de B.
- A cláusula do ano é provada pelo ano planejado da A, que sobrevive à virada (caso S7).
- No banco, `aula.int.test.ts` prova que a FK composta recusa o vínculo de B na escola A, a escola de B com o vínculo de A, e o outro ano.
- No arquivo do titular, o colega da mesma escola e a aula plantada num vínculo de aluno provam a ligação.
- Rodei `matriz.test.ts`, `leitura-do-titular.test.ts`, `tabelas-do-nucleo.test.ts`, `architecture.test.ts` e `repositories-com-escopo.test.ts`: 163 de 163 verdes. Os testes de integração não rodei.

**Bloqueantes:** nenhum.

**Recomendações:**
- As cláusulas `t.escola_id` e `v.escola_id` do `select` da `aula` no arquivo do titular (`leitura-do-titular.ts:151`) não têm teste que as observe, porque os ids são únicos entre escolas. A tarefa já declara isso nas Mutações. Fica registrado para a retro: uma regressão nessas cláusulas só seria pega na revisão.
- Na 2.0, o repository de leitura e gravação da `aula` precisa:
  - aplicar escola, ano e vínculo do professor da sessão, tirados do token;
  - responder igual a id ou vínculo inexistente e a id ou vínculo de outra professora ou escola;
  - ter seu próprio teste de isolamento, com todo id da B lido no contexto da A.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 15:02:18 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok (a tarefa não cria rota; `GET /v1/semana` e `PUT /v1/aulas` só entram na 2.0)
Fila e prioridade: ok (a tarefa não tem job)
Concorrência: protegida (a restrição `aula_vinculo_data_inicio_unico` em `(vinculo_id, data, inicio)` já segura o `insert … on conflict do update` que a 2.0 vai usar, e o teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.int.test.ts` prova que a mesma aula é recusada)
Índice e paginação: ok (`aula_semana_idx` começa por `escola_id, ano_letivo_id`, e o teste prova pelo `EXPLAIN` que a leitura pelo escopo o usa. A exclusão em cascata pelo vínculo usa o índice único, que começa por `vinculo_id`. O `delete` da virada usa o prefixo do `aula_semana_idx`)
Degradação de IA: não se aplica
Migration: compatível (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/drizzle/0041_registro_da_aula.sql` só cria tabela nova. As FKs entram com a tabela vazia, então a validação é instantânea e a trava em `vinculo` e `escola` é breve. O código anterior ignora a tabela)
Métrica e alerta: ok (nenhum código novo no caminho quente; métrica e cenário de carga são cobrados na 2.0)
Bloqueantes: nenhum

Recomendações:
- O `delete` das aulas fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/estrutura/vinculo.repository.ts:362`. Ele roda dentro do request síncrono `POST /v1/anos-letivos/:id/encerrar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts:56`). Numa escola de 900 alunos com o ano inteiro preenchido, isso chega a algumas dezenas de milhares de linhas, apagadas sob o `statement_timeout` da API. Enquanto essa transação estiver aberta, as gravações da 2.0 esperam no `for share` do ano, com `lock_timeout` de 2 s. Vale incluir esse volume num cenário (ou anotar no runbook do encerramento) e conferir que `BANCO_TIMEOUT_CONSULTA_MS` em produção comporta a exclusão.
- Na 2.0, o cenário do teste de carga precisa incluir `GET /v1/semana` e `PUT /v1/aulas` com sessenta turmas, e a rota precisa medir latência e erro. Já fica registrado para quem for auditar a 2.0.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 15:02:36 · `tasks/prd-semana-do-professor/1_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. A tabela, a migration 0041, a matriz, a classificação, o prazo fixo, o arquivo do titular, o comentário da troca de nome, o `virarAno` e os documentos estão feitos, e as sete subtarefas foram entregues. Nada da 2.0, 4.0 ou 5.0 entrou: não há repository de `aula`, nem rota, nem passo da grade, nem tela.

**Aderência à Tech Spec:** ok.
- A tabela segue a seção 3: FK composta com cascata, único `(vinculo, data, inicio)`, índice que começa pelo escopo e os dois checks.
- O `virarAno` apaga as aulas filtrando por escola do contexto e pelo ano, conforme as seções 5 e 7.
- O arquivo do titular traz a `aula` só na versão `completa` e não cria categoria na prévia, como pedem a seção 7 e a 7b.
- As duas divergências estão registradas na `techspec.md`: o glossário na seção 2 e o teste da migration do F2 na 7c. Nenhuma das duas muda regra nem cenário.

**Portão local:** carimbo válido: "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)". O `mutacoes.ts --faltando` informa que nenhuma linha nova de produção ficou sem bloco.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/alocacao.ts:8-9`: o docblock ainda diz que "a `Aula` concreta da F2b aponta para ela". Isso agora é falso, porque o desenho tirou a FK para a alocação de propósito. Esta tarefa corrigiu o glossário e o `modelo-de-dados.md` pelo mesmo motivo e deixou este comentário contradizendo o código ao lado.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/1_task.md:137`: a linha solta `--faltando: 1 linhas (3 blocos, 0 motivos)` parece saída de ferramenta colada no documento. Ela também contradiz a execução atual do `--faltando`, que não acusa nada. Convém tirá-la.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/1_task.md:71`: a nota diz que a cláusula de escola do `virarAno` "não é observável". A seção Mutações (linhas 133 a 135) desmente isso, e com razão, porque essa cláusula tem bloco. Ajustar a nota evita que a próxima leitura tropece na contradição.
4. O S7 do `cenarios.md` fala de vínculo "encerrado antes por realocação", e o caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/virada-do-ano.int.test.ts` usa o vínculo desligado. Para o `delete` por ano dá no mesmo, mas convém alinhar o texto do cenário ao caso, ou o caso ao cenário. Isso é da área do `test-engineer`; fica só registrado.
5. O `Retencao.tsx` da coordenação lê `PRAZOS_FIXOS` e, com esta tarefa, passa a mostrar a linha "Registro da aula". O texto não traz contagem e é coerente com o D64. Fica a nota para a tarefa de tela conferir o rótulo na foto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 15:02:51 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

A tarefa 1.0 cria só a tabela `aula`, a célula dela na matriz, a classificação, a leitura no arquivo do titular e a limpeza na virada. Ainda não há rota nem tela, então a gravação e a leitura da semana serão auditadas na 2.0.

**Campos pessoais tocados:** `aula.conteudo`, texto livre da professora com até 500 caracteres, que pode citar aluno. Também `aula.vinculo_id`, `data`, `inicio`, `fim` e `atualizado_em`, que ligam o texto à professora.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Registro da aula" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/lgpd.md:75`, com titular, finalidade, base legal e retenção (até a virada, e antes disso em cascata com o vínculo). Ela diz que a tabela fica fora da troca de nome e da prévia. Nenhum campo proibido para aluno foi criado.

**Autorização por objeto:** ok neste nível. Não há rota ainda; a por objeto será da 2.0.
- Na matriz, o professor tem `aula` como `proprio`; coordenação, rede e aluno têm `nunca`. Os quatro casos estão testados em `packages/shared/src/permissao/matriz.test.ts`.
- No arquivo do titular, a leitura liga a aula ao vínculo de professor do próprio titular, dentro da escola. Os testes provam que o colega não entra e que uma aula plantada no vínculo de um aluno também não.
- A versão `coordenacao` do arquivo não traz a tabela (`leitura-do-titular.ts:147`). O teste de integração confirma pelo JSON gravado: nem a chave, nem o texto, nem o id aparecem.

**Logs:** limpos. Nenhum log novo. O `virarAno` não devolve a contagem de aulas apagadas, então ela não entra na auditoria.

**Auditoria:** presente onde a regra exige.
- A tarefa não cria leitura por coordenação ou rede, exportação, nota, permissão nem saída de IA.
- A gravação do texto não é auditada, por decisão da Tech Spec (§11, regra 20 item 10): é dado da própria professora.
- A exportação pelo arquivo do titular já é auditada pelo caminho que existia.

**Envio externo:** nenhum. O texto não vai a IA nem a terceiro; a linha da LGPD registra que a F11 reabre esse ponto.

**Seed/fixture:** sintético. Os testes usam "Escola sintética da F2b", e-mails `@educa.invalid` e textos marcados com `sentinela(...)`.

**Ciclo de vida:**
- A virada apaga as aulas do ano, com escola e ano no filtro (`vinculo.repository.ts:362`).
- O teste S7 cobre o vínculo encerrado antes da virada, o ano planejado da mesma escola e a escola B. O caso de isolamento usa o contexto da A com o ano da B.
- Na eliminação do professor, `apagarVinculos` apaga o vínculo e a `aula` sai em cascata. A cascata está provada em `aula.int.test.ts:165`.
- O nome de um aluno eliminado pode ficar no texto até a virada. Isso foi decidido na Tech Spec (§6 e §11, regra 20 item 15), com o mesmo argumento usado para a contestação do vínculo, e está declarado no `lgpd.md` e em `troca-de-nome.ts`. Não reabri.

**Pergunta de fechamento:** responde. A tabela está na classificação e entra no arquivo da professora, só na versão completa. Para o aluno, a menção ao nome dele no texto livre está declarada no mapa de dados, tem prazo curto e não vai a lugar nenhum.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Pôr uma linha de `aula` no caso de eliminação do professor do worker (`apps/worker/test/eliminar-titular.int.test.ts:656`, F2 RF17). Hoje "a professora eliminada perde o texto" só é provado juntando dois testes: a cascata no banco e o `apagarVinculos`.
2. A `aula` só sai quando a escola encerra o ano. Uma escola que nunca encerra guarda o texto, e com ele algum nome de aluno, sem limite. A `lista_nome` já tem o mesmo comportamento. Vale um item no `TODO.md` para uma rotina de reserva no expurgo.
3. Na 2.0, confirmar que a tela pede para não escrever nome de aluno e que as rotas de gravar e ler não registram `conteudo` em log nem em erro. Isso está prometido no docblock de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.ts` e no `lgpd.md:75`, mas ainda não tem código que o cumpra.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 15:03:14 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a linha válida entra. O professor recebe a própria aula no arquivo `completa`. A virada apaga as aulas do ano.
- **Casos de borda do domínio:**
  - virada de ano letivo, inclusive a aula de um vínculo já encerrado por desligamento;
  - ano `planejado` da mesma escola, cuja aula não pode sair na virada;
  - professor que dá duas disciplinas na mesma turma, com dois vínculos (a mesma data e o mesmo início entram);
  - colega da mesma escola, cuja aula não vai ao arquivo do titular;
  - nome de aluno eliminado escrito no texto da aula;
  - horário invertido ou igual;
  - texto só de espaços, e limite de 500 depois do `btrim`;
  - apagar o vínculo apaga em cascata só a aula dele.
- **Permissão:** coordenação, rede e aluno têm `nunca` na matriz; o professor tem `proprio`. A versão `coordenacao` do arquivo não traz a tabela nem o texto. A aula plantada num vínculo de aluno não vai ao arquivo do aluno.
- **Isolamento:** um vínculo da B não entra numa aula da A (FK composta). O `virarAno` rodado no contexto de A com o ano de B não apaga a aula de B, e há um controle com B no contexto.
- **Concorrência:** não se aplica, porque a tarefa não grava. A disputa entre a virada e a gravação é o J14, na 2.0.

**Cobertos:** Todas as 21 linhas da tabela "Testes que provam a regra" têm teste citado pelo nome. Conferi uma a uma contra o diff, inclusive as linhas que juntam duas coisas (FK de escola e de ano, coordenação e completa).

Os 29 blocos de mutação batem com as cláusulas novas do diff. Para cada um, conferi que o cenário chega à cláusula e que o vermelho vem pelo motivo certo:
- o ano planejado derruba a mutação sem o ano;
- o contexto forjado A com o ano de B derruba a mutação sem a escola;
- `'     '` derruba o piso 0 e a retirada do `btrim`;
- `'  ' + 500 + '  '` derruba a segunda retirada do `btrim`;
- o outro início no mesmo dia derruba o único sem `inicio`;
- o colega derruba a mutação sem o `usuario_id`;
- a aula plantada num vínculo de aluno derruba a mutação sem o `papel`.

Os motivos sem bloco se sustentam. O `escola_id` do `select` do arquivo não é observável, porque o usuário é por escola. O `aula.ts` é gerado pelo `drizzle-kit` a partir da mesma definição da migration. O comentário de `troca-de-nome.ts` não tem cláusula.

Hoje, `mutacoes.ts --faltando` responde "Nenhuma linha nova de produção com condição fica sem bloco".

O que rodei aqui:
- a unidade de `matriz`, `retencao` e `leitura-do-titular`: 56 verdes;
- `aula.int.test.ts`: 8 verdes;
- os dois casos de aula de `virada-do-ano.int.test.ts`: verdes.

Os testes alterados não têm `.skip`, `.only` nem teste comentado. Não há mock de coisa nossa: o insert vai direto ao banco, o `encerrar` roda o `virarAno` de verdade e o arquivo é lido do JSON que o job gravou. A tarefa não tem IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tasks/prd-semana-do-professor/1_task.md:137`: a linha `--faltando: 1 linhas (3 blocos, 0 motivos)` é saída antiga colada no documento. O comando hoje não lista nada. Convém tirá-la para não confundir a validação.
2. `tasks/prd-semana-do-professor/1_task.md:71` diz que a cláusula de escola do `virarAno` "não é observável, sem bloco verde". As linhas 133 a 135 e o bloco das linhas 150 a 155 provam o contrário, e quem está certo são eles. Ajustar ou riscar a nota da linha 71, ou levar a divergência à tabela de divergências.
3. `packages/core/src/titular/leitura-do-titular.test.ts:348-350` confere a forma do texto SQL (`t.conteudo`, `from aula t`). Está declarado na autoconferência e o resultado é provado na integração, então não bloqueia. Ainda assim é asserção sobre forma, e pode sair se incomodar.
4. `apps/api/test/arquivo-do-titular.int.test.ts:81`: `not.toMatch(/aula/i)` sobre o JSON inteiro da prévia pode dar falso vermelho no futuro, se surgir uma categoria ou texto com "aula", e pode não dizer o que quebrou. Vale trocar por uma asserção sobre as chaves das categorias e contagens. O teste de igualdade com e sem o texto (linha 79) já carrega a regra.
5. `packages/core/src/db/schema/aula.int.test.ts:141`: a mutação que tira a FK da escola fica vermelha só pelo nome da restrição, porque a FK composta continua recusando. Isso está certo, mas mostra que a FK simples da escola é redundante com a composta. Basta registrar, como na `alocacao`.
6. Para a 2.0, fica registrado agora:
   - o J14 (virada × gravação) e o duplo `PUT` na mesma (vínculo, data, início) precisam de teste com as duas chamadas em paralelo, e não em sequência;
   - o "texto vazio apaga a linha" do docblock de `packages/core/src/db/schema/aula.ts:16-17` precisa de teste próprio.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/1_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/virada-do-ano.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/titular/leitura-do-titular.test.ts

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-06 15:14:46 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `aula`, que não mudou desde a 1ª rodada. O registro novo no teste do worker grava `escola_id`, `ano_letivo_id` e `vinculo_id` na ordem do schema em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.ts`, e o id é UUID.

Queries verificadas:
- `select id from aula where escola_id = $1`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts:694`. A consulta é presa à escola do cenário. O teste cobre a eliminação de um titular entre dois professores da mesma escola, por isso não testa a fronteira entre escolas. O efeito que ele prova também é observável: o registro do professor eliminado sai pela FK composta com `on delete cascade`, e o do outro professor fica.
- Os docblocks e a documentação mudaram só no texto. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/alocacao.ts:8-9` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/modelo-de-dados.md:415` não há query, repository nem endpoint novo.
- Nenhum `@Unscoped()` novo, e nenhum endpoint passa a receber `escolaId` do corpo ou da query.

Teste de isolamento: presente e efetivo. Nada mudou no teste de isolamento da 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.int.test.ts`). Nesta rodada só entrou cobertura nova no teste de eliminação.

Bloqueantes: nenhum. A 1ª rodada não exigiu correções, então não havia nada a conferir.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:626`: a comparação nova de `Object.keys(com)` com `Object.keys(sem)` repete o `expect(com).toEqual(sem)` da linha 623. A asserção antiga (`not.toMatch(/aula/i)`) checava se o texto da aula aparecia em algum ponto da prévia. Para guardar a mesma coisa sem depender da palavra "aula", vale buscar o próprio texto sintético gravado, por exemplo `expect(JSON.stringify(com)).not.toContain('<texto sintético usado no cenário>')`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 15:15:05 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. O diff só mexe em testes, em docblock e na documentação da `aula.conteudo`, que foi aprovada na 1ª rodada.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Registro da aula" continua em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/lgpd.md:75`. O trecho novo de `docs/modelo-de-dados.md` ("não lê o `conteudo`, o texto não vai a IA até a F11") diz o mesmo que ela.

Autorização por objeto: ok. Nenhuma rota nova; as rotas da `aula` só chegam na 2.0 e na 4.0.

Logs: limpos. Nenhum log foi tocado.

Auditoria: presente. Nada novo exige auditoria nesta rodada.

Envio externo: nenhum. O docblock e o `modelo-de-dados.md` agora dizem com todas as letras que o Assistente de ensino não lê o `conteudo`.

Seed/fixture: sintético. As fixtures novas do teste de eliminação usam 'Texto sintético da aula' e as do arquivo do titular usam `sentinela(...)`.

O que conferi no diff (`81d97469..d2fbccd7`):
- **`apps/worker/test/eliminar-titular.int.test.ts:672-696`**: o teste agora prova a eliminação real do registro da aula (regra 20, item 15). Quando o professor é eliminado, o texto dele sai e o do colega fica. Isso vale porque a FK composta para `vinculo` está com `ON DELETE cascade` (`packages/core/drizzle/0041_registro_da_aula.sql:19`). A cobertura melhorou.
- **`apps/api/test/arquivo-do-titular.int.test.ts:625-626`**: a busca pela palavra `/aula/i` deu lugar à comparação das chaves da resposta. A garantia de que a prévia não ganha categoria nem contagem (D64) continua inteira, porque `expect(com).toEqual(sem)` e a lista fixa de `categorias` ficaram. Não houve perda.
- **`packages/core/src/db/schema/alocacao.ts:8-9`**: só o docblock mudou. Ele corrige a afirmação errada de que a `Aula` apontava para a `alocacao`. Não tem efeito em dado.
- **`tasks/prd-semana-do-professor/1_task.md`**: só registro. As recomendações de privacidade da 1ª rodada estão encaminhadas: o limite para quem nunca vira o ano foi para o `TODO.md` em "LGPD e conformidade", e as rotas que não logam `conteudo` e a tela que pede para não escrever nome de aluno foram para a 4.0 e a 7.0.

Pergunta de fechamento: o código responde. O registro da aula entra na versão completa do arquivo do titular pelo `vinculo_id`, sai de fato na eliminação (agora testado) e não vai a nenhum destino externo.

Bloqueantes: nenhum

Recomendações:
- O `Object.keys(com)` em `arquivo-do-titular.int.test.ts:626` repete o que o `toEqual(sem)` da linha 623 já garante. Não prejudica, mas pode sair se quiserem enxugar.
- Continuam valendo as da 1ª rodada que foram para as tarefas 2.0, 4.0 e 7.0 e para o `TODO.md`. Na 4.0, confiram que a rota não loga `conteudo`, nem em caminho de erro.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 15:15:11 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa nem no diff desta rodada. A tarefa cria só a tabela `aula`, onde a professora guarda o texto da aula; não há `Nota`, `Correcao` nem campo de pontuação. Todos com autor humano? Sim, porque não há caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA foi criada ou alterada. O texto da aula é escrito pela professora e não passa por IA.
Supervisão do tutor: ok. O Tutor não foi tocado.
Autonomia declarada e visível: sim, sem mudança. O texto novo em `docs/modelo-de-dados.md` limita o que o Assistente de ensino faz: ele usa a grade e o calendário, não lê o `conteudo`, e esse texto não vai a IA até a F11 reabrir a linha. Isso bate com `docs/lgpd.md:75`, que diz "Não vai a log, a auditoria nem a IA".
Bloqueantes: nenhum
Recomendações: nenhuma nova

O que conferi nesta rodada. A 1ª rodada foi aprovada sem correções exigidas, então olhei o diff `81d97469..d2fbccd7` e o que ele afeta:

- **`apps/api/test/arquivo-do-titular.int.test.ts:625-626`**: o `not.toMatch(/aula/i)` saiu e no lugar entrou a comparação das chaves de `com` e `sem`. O `expect(com).toEqual(sem)` de antes continua lá, então a prévia segue igual com ou sem o texto da aula. O item 8 da regra 70 e a D64 continuam provados. A asserção nova é mais firme que a antiga, que podia falhar à toa com qualquer palavra que contivesse "aula".
- **`apps/worker/test/eliminar-titular.int.test.ts:669-696`**: entra um texto sintético de aula para cada vínculo. O teste prova que o texto do professor eliminado sai e o do outro fica. É cobertura a mais para a regra 20, sem efeito na regra 70.
- **`packages/core/src/db/schema/alocacao.ts`**: só o docblock mudou. Agora ele diz que a `Aula` da F2b não aponta para a alocação, e o schema em `packages/core/src/db/schema/aula.ts` confirma: a tabela tem vínculo, data e início próprios.
- **`tasks/prd-semana-do-professor/1_task.md`**: são só os registros do processo (tabelas, notas e a seção de revisões), sem nada que afete a regra 70.

Para a 9ª verificação (medir o professor não é vigiar) não há nada novo. A matriz de permissão, aprovada na 1ª rodada e intocada desta vez, mantém `aula.ler` e `aula.gravar` como `proprio`, e a coordenação fica fora da versão dela do arquivo do titular, conforme `docs/lgpd.md:75`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/modelo-de-dados.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/alocacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 15:15:48 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As seis correções da ordem `.processo/ordens/1_task-r1.md` estão feitas:
1. O docblock em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/alocacao.ts` não diz mais que a `Aula` aponta para a `alocacao`, e o arquivo entrou em "Arquivos previstos".
2. A nota abaixo da tabela de testes em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/1_task.md` agora concorda com "Mutações": a cláusula de escola do `virarAno` é observável.
3. A linha `--faltando:` mostra os números atuais, conforme a skill pede, em vez de ser removida.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/modelo-de-dados.md` agora diz que o Assistente usa a grade e o calendário e não lê o `conteudo` até a F11, o que fecha a contradição com `docs/lgpd.md`.
5. A asserção `not.toMatch(/aula/i)` saiu de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts`.
6. O caso F2 RF17 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts` grava agora uma linha de `aula` para cada professor. A do eliminado some e a do outro fica. A cascata vem da FK composta de `0041_registro_da_aula.sql` (`ON DELETE cascade`), então um teste só prova que a eliminação apaga o texto.

Desde a rodada anterior, o código não mudou fora disso. Depois do commit `d2fbccd`, só entraram as linhas que o hook grava em "Revisões".

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:626`: a asserção que substituiu a antiga, `expect(Object.keys(com).sort()).toEqual(Object.keys(sem).sort())`, não acrescenta nada. O `expect(com).toEqual(sem)` duas linhas acima já obriga as chaves a serem iguais. A regra está provada pela igualdade e pela lista de `categorias`. A linha nova e o comentário dela podem sair, ou dar lugar a uma asserção que olhe as contagens, como o test-engineer pediu.
- Quatro itens de "Sem aplicar" têm `TODO.md` como destino: o volume do `delete` no encerramento, a rotina de reserva no expurgo, o rótulo na tela de retenção e o S7 que vai à retro. O `TODO.md` não foi alterado neste checkout. Se escrever lá cabe ao Orquestrador, isso precisa ser feito antes do pouso.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 15:15:49 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica (a rodada não tem rota nem endpoint)
Fila e prioridade: ok (nenhum job novo; a eliminação do texto acontece no job de eliminação que já existia, pela cascata do vínculo)
Concorrência: protegida (nada mudou desde a rodada 1; a restrição `aula_vinculo_data_inicio_unico` continua em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/drizzle/0041_registro_da_aula.sql`)
Índice e paginação: ok (`aula_semana_idx` começa por `escola_id, ano_letivo_id`; não mudou)
Degradação de IA: não se aplica
Migration: compatível (só cria tabela; a 0041 e o snapshot são iguais byte a byte aos do commit `d2fbccd`)
Métrica e alerta: ok (a rodada não tem código no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:625`: a nova comparação de chaves repete o `expect(com).toEqual(sem)` duas linhas acima, que já prova a mesma coisa e mais. Pode sair sem perder cobertura.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts:694`: o teste lê com `where escola_id = $1` sem `order by` e compara com `toEqual([registroDoOutro])`. Hoje só sobra uma linha, então passa. Se alguém acrescentar outra linha no mesmo teste, a comparação depende da ordem que o banco devolver; vale pôr `order by id`.

Correções exigidas na rodada anterior: nenhuma. Das mudanças desta rodada, a única que pesa na carga é o teste de eliminação, que agora prova que o texto da aula do titular sai junto com o vínculo e que o de outra pessoa fica. As outras são texto e docblock.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 15:15:49 · `tasks/prd-semana-do-professor/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada, que foi aprovada. Nesta rodada auditei só o diff `81d97469..d2fbccd7`, que aplica as recomendações baratas da ordem `.processo/ordens/1_task-r1.md`:
- quando o professor é eliminado, o registro da aula dele sai junto com o vínculo e o registro do colega fica;
- a prévia do titular não ganha categoria nem campo por causa do texto da aula;
- a nota da tabela de testes e a seção "Mutações" passam a dizer que a cláusula de escola do `virarAno` é observável e tem bloco;
- só documentação: o docblock de `alocacao.ts`, `docs/modelo-de-dados.md` e a tabela de recomendações.

Cobertos:
- **Eliminação** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/worker/test/eliminar-titular.int.test.ts:672-696`, caso "F2, RF17"): o teste grava um registro de `aula` para cada professor e confere que, depois da eliminação, sobra só o do outro (`toEqual([registroDoOutro])`). Ele ficaria vermelho se a regra saísse. A FK é `on delete cascade` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/aula.ts:42-46`): sem o cascade, o `delete` do vínculo falha e o pedido não conclui; se a eliminação apagar demais, o `toEqual` acusa. Rodei o caso e ele passou.
- **Prévia do titular** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/arquivo-do-titular.int.test.ts:625-626`, caso "R5"): a asserção frágil por regex deu lugar à comparação das chaves. O `toEqual(sem)` e a lista fechada de `categorias` continuam e são o que prova a regra. Rodei e passou.
- **Documento da tarefa**: `--faltando` está em "0 linhas (28 blocos, 0 motivos)". A nota da tabela de testes agora concorda com a seção "Mutações" sobre a cláusula de escola do `virarAno`. As 13 recomendações têm destino ou motivo escrito.
- Não há `.skip`, teste comentado, mock da regra nem chamada de IA neste diff. Nenhuma operação concorrente nova.

Bloqueantes: nenhum.

Recomendações:
- `arquivo-do-titular.int.test.ts:626`: comparar as chaves não acrescenta nada ao `toEqual(sem)` da linha 623, porque um corpo JSON não tem chave com valor `undefined`. Pode sair, ou ficar só como documentação. Não bloqueia.
- `eliminar-titular.int.test.ts:656`: o título diz "a aula sai com o vínculo dele", mas o caso agora cobre a `alocacao` e também o registro da `aula`. Vale deixar claro, por exemplo: "a alocação e o registro da aula saem com o vínculo dele". A variável local `aula` (linha 669), que insere em `alocacao`, aumenta a confusão com a tabela `aula`.
- A tabela de testes do `1_task.md` não tem linha para "o registro da aula sai com o vínculo na eliminação". A cobertura existe, mas não está citada pelo nome. Fica para a validação e a retro.
