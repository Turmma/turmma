# Tarefa 1.0 — Migration da prova online; aplicar com janela, duração, embaralhar e tempo adicional; mudar a janela

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O professor aplica a prova e a muda antes do primeiro começo.

## Contexto necessário

- `techspec.md` §3, §4 (todas as rotas, para os contratos), §5.1, §6, §7, §11
- `prd.md` RF1 a RF3; §8
- `cenarios.md` §1 (RF1 a RF3), §1b, §2 (expurgo, eliminação, titular), §3 (b) e (k)
- `.claude/rules/20` (tempo adicional é sensível) e `80`

## Subtarefas

- [ ] 1.1 — Migration `0068_prova_online.sql` à mão e schema (§3; `saida_da_aba` **sem `id` nem tempo**)
- [ ] 1.2 — Contratos de **todas** as rotas da §4 e a matriz
- [ ] 1.3 — Classificação, expurgo e as exceções do `architecture.test.ts` (§3, §11)
- [ ] 1.4 — `aplicar` com janela (opcional até a 10.0), duração, embaralhar e tempo adicional (§5.1)
- [ ] 1.5 — `PATCH …/:id/janela` parcial, com `for update` e o estado relido (§5.1)
- [ ] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0068_prova_online.sql` e `meta/_journal.json` | novo, alterado |
| `packages/core/src/db/schema/atividade-aplicada.ts`, `tentativa-atividade.ts` | alterado |
| `packages/core/src/db/schema/prova-online.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `packages/core/src/retencao/expurgo-da-escola.repository.ts` | alterado |
| `packages/shared/src/atividade/atividade-aplicada.ts`, `prova.ts` | alterado |
| `packages/shared/src/index.ts` | alterado |
| `packages/shared/src/permissao/matriz.ts`, `privacidade/classificacao.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/` (controller, service, repository) | alterado |
| `TODO.md`, `docs/lgpd.md` | alterado (a 0068 na lista das migrations sem `concurrently`; a exceção do tempo adicional na versão da coordenação) |
| `apps/api/test/atividade.fixture.ts` | alterado (o `architecture.test.ts` não mudou: as exceções da 1.3 estão em `tools/guardas/tabelas-do-nucleo.mjs`) |
| `apps/api/src/atividade/prova-online.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Aplicar com +25%, +50% e +100% sobre 40 min | integração | RF1, RF3: as três linhas; auditoria só com a contagem | colega sem linha; nenhum `alunoId` na auditoria | `apps/api/src/atividade/prova-online.int.test.ts › +25%, +50% e +100% sobre 40 min gravam três linhas com quem concedeu; o colega não tem linha; a auditoria só leva a contagem, e a resposta, nenhum percentual` |
| Janela de 50 min, duração 40, aluno com +50% | integração | `ENTRADA_INVALIDA` (sem nome de campo no corpo: divergência 3) no aplicar e no PATCH | a janela de 60 min passa | `apps/api/src/atividade/prova-online.int.test.ts › janela de 50 min com duração 40 e um aluno com +50% é ENTRADA_INVALIDA, sem gravar nada; a janela de 60 min passa` (aplicar) e `… › a janela que não cabe, o corpo vazio, a chave a mais e o aluno de fora são recusados e não mudam nada; o de 60 min passa` (PATCH) |
| Aluno de outra turma, de outra escola, inexistente, no aplicar e no PATCH | integração | a mesma resposta, nada gravado | três ids, mais o professor, o aluno de vínculo pendente e o de conta desativada | `apps/api/src/atividade/prova-online.int.test.ts › aluno de outra turma, de outra escola, inexistente, professor, de vínculo pendente e desativado respondem a mesma coisa, e nada é gravado` (aplicar) e o `… › a janela que não cabe, o corpo vazio, a chave a mais e o aluno de fora são recusados…` (PATCH) |
| Não avaliativa com janela | integração | `ENTRADA_INVALIDA` | a avaliativa passa | `apps/api/src/atividade/prova-online.int.test.ts › o que não fecha é ENTRADA_INVALIDA: não avaliativa com janela, duração sem janela, tempo adicional sem duração, chave a mais (motivo) e aluno repetido` e, no PATCH, `… › a atividade sem prova não ganha janela pelo PATCH, e a encerrada é ATIVIDADE_ENCERRADA` |
| PATCH (só janela; só `tempoAdicional`) antes e depois de uma tentativa | integração | RF2: grava e audita sem `alunoId`; depois, `PROVA_JA_COMECOU` e a aplicação igual | os dois campos, na mesma aplicação | `apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional, antes do primeiro começo: grava, audita só a contagem, e o que não veio fica como estava`, `… › a avaliativa sem prova ganha a janela pelo PATCH: a auditoria guarda nulo no que ainda não havia` e `… › com uma tentativa iniciada, a mudança é PROVA_JA_COMECOU, em cada campo, e a aplicação fica igual` |
| Corrida (b) janela × começar | integração | `PROVA_JA_COMECOU` pela trava | sem `comecar` ainda: por SQL, `for share` e o insert da tentativa numa transação segurada | `apps/api/src/atividade/prova-online.int.test.ts › (b) mudar a janela × começar: o começo segura a aplicação em `for share`, a mudança espera a trava, relê e recebe PROVA_JA_COMECOU` |
| Corrida (k) janela × janela | integração | a segunda relê e é recusada | PATCH só da janela (50 min) segurado; o outro só +50% sobre 40 | `apps/api/src/atividade/prova-online.int.test.ts › (k) mudar a janela × mudar a janela: a segunda relê a janela de 50 min que a primeira gravou e recebe ENTRADA_INVALIDA` |
| Professor de B; sem vínculo; outra disciplina; vínculo encerrado em X e aberto em Y; escola sem ano em curso; aluno e coordenação | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A | `apps/api/src/atividade/prova-online.int.test.ts › mudar a janela, por quem não é o professor daquela turma e daquela disciplina, responde como o inexistente e não muda nada` e `… › a escola sem ano em curso: mudar a janela é NAO_ENCONTRADO e aplicar é recusado, sem gravar` |
| Colunas da `saida_da_aba` | integração | só as cinco, sem default de uuid | lista exata | `apps/api/src/atividade/prova-online.int.test.ts › tem só as cinco colunas, nenhuma de horário e nenhuma com valor padrão; a chave v7 e a repetida são recusadas pelo banco` |
| Expurgo das quatro tabelas | integração | o ano vencido sai, o em curso fica | dois anos; a extensão da turma (aluno nulo) sai | `apps/worker/test/expurgo-da-escola.int.test.ts › a prova online (avaliacao-e-correcao, 1.0) › o ano vencido apaga a saída da aba, o tempo adicional, as extensões (a da turma também) e a convocação; o ano ainda dentro do prazo não perde nada, nem o de outra escola` |
| Repository chamado direto: contexto da A com ids da B; contexto da A no ano anterior | integração | vazio | sem passar pela rota | `apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo com a escola trocada ou o ano trocado não acha nada; no ano dele, acha` (leituras e gravações) |
| Eliminar o aluno | integração | as linhas dele saem; as do colega ficam | | `apps/api/test/ciclo-de-vida.int.test.ts › a prova online (avaliacao-e-correcao, 1.0): eliminar o aluno apaga a saída da aba, o tempo adicional, a extensão e a convocação dele; as do colega e a extensão da turma ficam` |
| Arquivo do titular | integração | pelo `aluno_id`, sem `concedido_por` nem `chave` | o arquivo do professor que concedeu não traz o adicional | `apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece, e a linha de outro aluno e a de outra escola não` e `… › o tempo adicional e a extensão ficam no arquivo do aluno, pelo `aluno_id`: o arquivo do professor que os concedeu não os traz, nem a chave` |
| Matriz e contratos | unidade | ações novas, coordenação e rede em `nunca`; `motivo` e `chave` v7 recusados | | `packages/shared/src/permissao/matriz.test.ts › cada célula da matriz está na expectativa escrita à mão, e cada linha da expectativa está na matriz`, `… › MVP: as cinquenta e três rotas têm célula, e a rede não chama nenhuma` e `packages/shared/src/atividade/prova-online.test.ts` (os onze casos) |
| As restrições da migration 0068, provadas no banco | integração | cada check, índice, FK composta, unicidade e gatilho recusa o que devia, e o schema do Drizzle diz o mesmo texto da migration | o limite de cada lado (4 e 5, 300 e 301, 0 e 1, 120 e 121); a segunda chamada da mesma turma e de outro artefato | `packages/core/src/db/schema/prova-online.int.test.ts` (os quatorze casos) |

## Como testar

- `apps/api/src/atividade/atividade.int.test.ts › a professora aplica a atividade objetiva à turma dela…`, com
  `aplicarAtividade` (`apps/api/test/atividade.fixture.ts`) ganhando janela e tempo adicional opcionais
- `atividade-isolamento.int.test.ts › aplicar exige vínculo confirmado…`
- Corridas: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Schema: `mvp-tables.int.test.ts › pelo catálogo: toda FK…`; expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts`;
  titular: `arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece…`; eliminação: `ciclo-de-vida.int.test.ts`
- `npx vitest run --project integracao apps/api/src/atividade/prova-online.int.test.ts`
- Armadilha: a migration leva o próximo número livre

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois.

1. **A mutação de cada cláusula** está na seção "Mutações": um bloco por cláusula do repository (`create`, `alunosDaTurmaEntre`, `saveTempoAdicional`, `tempoAdicionalDaAplicacao`, `trocarTempoAdicional`, `lockParaMudarAJanela`, `existeTentativa`, `saveJanela`), do service (`aplicar`, `mudarAJanela`, `#provaDepoisDaMudanca`, `#lockAntesDoComeco`, `#conferirAlunosDaTurma`), da conferência única e dos esquemas zod, de cada check, índice, unicidade, FK e gatilho da migration, do expurgo e das leituras do arquivo do titular. O que não tem bloco tem o motivo em prosa na mesma seção (cláusula equivalente: a unicidade do uuid, o `NULL` distinto do índice único, a guarda dupla).
2. **O texto na tela:** a tarefa não tem tela, e nenhum texto novo vai para `apps/web`. o `grep` por `janela`, `duracaoMin` e `tempoAdicional` em `apps/web/src` e `e2e` só acha a janela do convite, do acesso e da turma de hoje, que são outra coisa, e a lista de atividades da turma não muda de forma (os campos novos de `atividadeAplicadaSchema` são opcionais até a 10.0).
3. **O segundo dado de cada cláusula:** o repository filtra por escola, ano, turma, papel e estado, e o caso tem o aluno de outra turma, o de outra escola, o inexistente, o professor, o de vínculo `pendente` e o de conta desativada (todos respondem o mesmo `ENTRADA_INVALIDA`); `trocarTempoAdicional` e `saveJanela` têm a aplicação vizinha (com tempo adicional próprio e uma tentativa começada) que não pode mudar, a concessão que não muda (Ana) e a que sai (Caio); `existeTentativa` tem a vizinha com tentativa e a aplicação que ninguém começou; o embaralhar tem uma aplicação com `questoes` e outra com `alternativas`; o expurgo tem o ano vencido, o ano dentro do prazo e a outra escola.
4. **A checagem anterior que responde antes:** `aplicar` cai em `canAplicarNaTurma` e em `alvo.tipo` antes do tempo adicional, e o caso usa a turma e o artefato certos para chegar na conferência dos alunos; o PATCH passa por `requireAnoEmCurso()` (o caso da escola sem ano em curso) e pela matriz (o aluno e a coordenação respondem 404 antes do service). A corrida (b) cria a condição por SQL (`for share` e o insert da tentativa numa transação segurada, porque o `comecar` é da 3.0) e espera a trava com `esperarNaTrava`; a (k) usa `WriteBlockTrigger` em `atividade_aplicada`, e a segunda mudança é recusada **pelo valor que a primeira gravou** (50 min), não por outra regra.
5. **A asserção olha o resultado:** os casos leem a aplicação, o `tempo_adicional` e a `auditoria` no banco depois da rota, e comparam o retrato inteiro antes e depois da recusa (`retratoDa`). A auditoria é lida do banco e não leva o `alunoId` nem a palavra `percentual`.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo. As guardas existentes que a tarefa toca (`tabelas-do-nucleo.mjs`, `architecture.test.ts`, `contracts.test.ts`, a matriz) foram conferidas verdes.
7. **Comentário que afirma o que o código não faz:** o docblock do service diz que `aplicar` grava aplicação, tempo adicional e auditoria numa transação e que o PATCH relê o estado depois da trava, e só o segundo é provado por caso (as corridas (b) e (k)); a transação do `aplicar` é uma só (`runInContext`), e toda recusa vem antes do `create`, então não há caso de falha depois dele: a atomicidade é a da transação, que o repository não abre por conta própria; o texto de `docs/modelo-de-dados.md` (as seis tabelas e as colunas novas) e as linhas de `docs/lgpd.md` já existem na árvore e citam `tempo_adicional`, `saida_da_aba` e a ausência de motivo e de horário, que o schema e o caso da tabela provam.
8. **Divergências:** as sete da tabela abaixo; nenhuma muda regra do PRD. A 1 e a 2 estão na Tech Spec §4 (a conferência única), e a 3 a 7 acrescentam campo opcional ou ação de auditoria sem mudar o que o professor vê.
9. **Peça que já existe:** `WriteBlockTrigger` e `esperarNaTrava` (corridas), `exigir_equipe_da_escola` (a 0023, o gatilho do autor), `requireEscolaId()`/`requireAnoEmCurso()` (escopo), `registro.save` (auditoria), `doAnoEncerradoAlemDoPrazo` (um helper para as três tabelas do expurgo, em vez de três cópias).
10. **A operação em duas chamadas ao mesmo tempo:** (b) e (k), com a ordem forçada; a segunda concessão do mesmo aluno é a unicidade do banco (`tempo_adicional_um_por_aluno`) e a lista inteira do PATCH troca sob `for update`.
11. **O isolamento quebra sem a cláusula:** o caso "no repository" chama as leituras e as gravações com a escola da B e com o ano anterior da A, ids da A, e exige vazio e retrato igual; a cláusula de escola tirada do `where` deixa o caso vermelho (os blocos de `tempoAdicionalDaAplicacao`, `trocarTempoAdicional`, `existeTentativa`, `saveJanela` e `alunosDaTurmaEntre` com a escola ou o ano tirados). Cada linha da tabela de testes tem o caso na coluna "Caso".
12. **Os guardiões:** `tenancy-guardian` (escopo no repository a partir do contexto, 404 igual, id uuid, `escola_id` e `ano_letivo_id` nas quatro tabelas do aluno), `privacy-guardian` (tempo adicional só com o percentual, sem motivo; auditoria só com a contagem; arquivo do titular pelo `aluno_id` sem `concedido_por` nem `chave`; saída da aba sem `id` nem horário; expurgo e eliminação), `infra-guardian` (migration só expansão, com `NOT VALID` e `VALIDATE`, índice novo antes de derrubar o antigo; `for update` e estado relido; as duas corridas). `achados/indice.md` só tem as rodadas da revisão da spec (a Tech Spec §3 com `ano_letivo_id` nas tabelas, a `saida_da_aba` com chave v4 e sem horário, o tempo adicional como dado sensível, a indisponibilidade lida com o pulso): a migration, o schema e os testes seguem o que a spec ficou dizendo, e nenhuma tarefa teve rodada ainda.

## Fora do escopo desta tarefa

As outras rotas (2.0 a 9.0) e a tela (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A janela é opcional no `aplicar` e na resposta até a 10.0 | A tela de hoje (A3) manda `{artefatoId, turmaId, avaliativa}`: exigir a janela agora quebraria a aplicação que a web e o e2e fazem. A avaliativa sem janela segue como antes da F6, sem backfill | `techspec.md` §3: "A **API exige janela** na avaliativa nova; a antiga segue como hoje, sem backfill"; subtarefa 1.4 desta tarefa: "janela (opcional até a 10.0)". A exigência entra na 10.0, com a tela; `cenarios.md` §1 RF1 ("avaliativa nova sem janela: `ENTRADA_INVALIDA`") passa a valer então, e o caso dele fica com a 10.0 |
| `tempoAdicional` exige `duracaoMin` (e `duracaoMin`, `janela`) | O limite de quem tem tempo adicional é `duração × (1 + percentual)`: sem duração não há sobre o que somar, e duração sem janela não tem de onde contar. É a mesma função (`camposInvalidosDaProva`) no aplicar, no PATCH e na segunda chamada | `techspec.md` §5, passo 1: "Tempo adicional que não cabe na janela (`fecha_em − abre_em < duração × (1 + maior percentual)`) é `ENTRADA_INVALIDA`, também ao mudar a janela e na segunda chamada" |
| `ENTRADA_INVALIDA` sem o nome do campo no corpo do erro | O corpo de erro da casa é curto e tipado (regra 20, item 11): o código diz que a entrada não fecha, e quem sabe o campo é o schema compartilhado, que a tela usa antes de enviar (`camposInvalidosDaProva`). Dizer o campo no servidor para o aluno de outra turma confirmaria que o id existe | `techspec.md` §5, passo 1 (a mesma frase); `cenarios.md` §1 RF3 diz "`ENTRADA_INVALIDA` no campo da janela": o campo é o do schema compartilhado (`camposInvalidosDaProva` devolve `janela`, `duracaoMin`, `embaralhar` ou `tempoAdicional`, e a tela o mostra), e o corpo de erro da API leva só o código; regra 20, itens 6 e 11 |
| A resposta da aplicação e a auditoria `atividade.aplicada` ganham `comTempoAdicional` (a contagem) | A tela precisa saber se há tempo adicional para o resumo, e a auditoria precisa do quantos sem o percentual nem o aluno (adaptação é dado sensível, D35) | `techspec.md` §7, "Log, métrica, auditoria": "auditoria `atividade.aplicada` (quantos com tempo adicional)" |
| A ação `atividade.janela_alterada` leva `antes` e `depois` só com a janela, a duração e a contagem | A spec lista a ação e não o corpo. Sem o `alunoId` nem o percentual, pelo mesmo motivo | `techspec.md` §7, a mesma linha: "`.janela_alterada`" |
| `saidasDaAba` é opcional no contrato da correção (`GET …/:id/correcao`) | A 1.0 só dá o contrato; quem preenche é a 5.0, e a correção de hoje (F3) não o tem | `techspec.md` §4, linha de `GET …/:id/correcao`: "+ `saidasDaAba` por aluno, só em avaliativa" |
| A `saida_da_aba` do arquivo do titular vem agrupada por tentativa (a contagem), com `id` da tentativa | A tabela não tem `id` nem horário (D70): o arquivo leva "quantas vezes por prova", que é o que a tabela diz, e a chave do cliente nunca entra | `techspec.md` §3: "`saida_da_aba` … `chave*` uuid v4 (sem id nem tempo)"; `docs/lgpd.md` linha da saída da aba |
| O tempo adicional e a contagem de saídas da aba entram também na versão `coordenacao` do arquivo do titular (do titular sem conta ativa) | O PRD §4 e a Tech Spec "DTO" diziam que a coordenação não vê nenhum dos dois; o titular sem conta ativa só recebe o arquivo por essa versão, e o direito de acesso (art. 18) pede o arquivo completo, como a conversa do Tutor na F3. Decidida pelo Joaquim em 23/11/2026, na divergência desta tarefa (rodada 2 da Mesa, item 1) | `prd.md` §4 (linha da Coordenação, RF9, linha da saída da aba) e §6 (a exceção declarada); `techspec.md` "Retenção e titular" e "DTO"; `docs/lgpd.md` linhas do tempo adicional e da saída da aba; docblock de `leitura-do-titular.ts`, item 5; um caso de cada na versão `coordenacao` em `arquivo-do-titular.int.test.ts` |

## Mutações

--faltando: nenhuma linha nova de produção com condição fica sem bloco (`node tools/processo/mutacoes.ts --faltando` confere): 168 blocos e os motivos abaixo.

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os blocos da migration valem porque o teste do schema (`packages/core/src/db/schema/prova-online.int.test.ts`) constrói o **próprio banco** pelas migrations da pasta a cada corrida: o banco compartilhado já tem a 0068 aplicada, e o que se muda nela depois não o alcança. O mesmo teste prova que o schema do Drizzle diz o mesmo texto da migration (checks e índices), e é nele que os blocos do schema TypeScript ficam vermelhos.

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- `eq(usuario.escolaId, vinculo.escolaId)` no `innerJoin` de `alunosDaTurmaEntre`: `usuario.id` é uuid de chave primária, e o termo `eq(usuario.id, vinculo.usuarioId)` (com bloco) já amarra a mesma linha; tirar o da escola não muda nenhuma linha devolvida.
- `eq(tempoAdicional.escolaId, escolaId)` do `delete` de `trocarTempoAdicional` e do `where` de `tempoAdicionalDaAplicacao` **têm** bloco; o termo `${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId}` da contagem `comTempoAdicionalDaAplicacao` é equivalente ao termo do id da aplicação, que tem bloco (o id é uuid).
- `where escola_id = ${escolaId} and id = any(array(` e `where t.escola_id = ${escolaId} and ...` do expurgo (`doAnoEncerradoAlemDoPrazo`): a subconsulta já filtra pela escola e o `join` com `ano_letivo` leva `al.escola_id = ${escolaId}`; o `delete` de fora repete o termo por defesa (o texto do docblock do lote). Tirar um dos dois não muda o que sai.
- `for update of t skip locked` do expurgo: é a trava dos lotes irmãos (`tentativa_atividade`, `artefato_autoria`), provada lá pelo caso de dois jobs; um terceiro caso aqui repetiria o mesmo mecanismo.
- `atividade_aplicada_janela_ordenada` sem o `abre_em is null or`: a comparação com `NULL` dá `NULL`, e o check passa; o termo existe só para ler melhor. `atividade_aplicada_prova_so_na_avaliativa` sem `duracao_min is null`: a duração só existe com janela (`atividade_aplicada_duracao_valida`), e o mesmo check já exige `abre_em is null`. `atividade_aplicada_segunda_chamada_aberta_unica` sem `segunda_chamada_de is not null`: `NULL` é distinto num índice único, então a original nunca colide. As três tiradas deixam o banco recusando e aceitando o mesmo.
- As FKs `*_escola_id_escola_id_fk` das quatro tabelas do aluno: as FKs compostas (aplicação e aluno) já levam a `escola_id`; a simples é o padrão das outras tabelas e não recusa nada a mais.
- `@RequirePermissao('atividade_aplicada', 'janela')` do `PATCH`: tirá-lo derruba o boot da API (`PermissaoBootCheck` recusa rota sem permissão, `apps/api/test/permissao-boot-check.test.ts`), não um caso; o mutante cai em erro de carga, que o portão recusa.
- `ALTER TABLE … VALIDATE CONSTRAINT` e o `NOT VALID` da 0068: é o modo de a migration entrar sem bloquear a escrita (regra 80, item 9), conferido pelo `infra-guardian`; não muda o que o banco aceita depois da migration.
- `linha.fechaEm === null` (repository) e `lida.fechaEm === null` (service), segundo termo da conferência da janela: `abre_em` e `fecha_em` nascem juntos (a aplicação grava a janela inteira, e o check `atividade_aplicada_janela_inteira` recusa uma ponta sem a outra), então o primeiro termo decide sozinho; os blocos do ternário inteiro provam a leitura.
- `janela: linha.abreEm === null` (repository) e `janela: lida.abreEm === null` (service): primeiro termo do ternário; tirá-lo deixa o segundo, que decide o mesmo (as duas pontas da janela nascem juntas). O ternário inteiro tem bloco que o troca por `undefined`/`null`.
- As FKs e unicidades do schema TypeScript (`foreignKey(...)`, `unique(...)`) são espelho da migration, que o banco de teste usa; o snapshot `0068_snapshot.json` as traz como o `drizzle-kit` as gerou.

### A trava das duas corridas (ordem da rodada 1)

O `for update` de `lockParaMudarAJanela` e a ordem "trava, depois `existeTentativa`" não têm condição, e por isso o `--faltando` não as cobra; cada uma tem o seu bloco, e o caso é o da corrida (nomes sem parênteses, porque o `-t` do vitest é regex).

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › mudar a janela × mudar a janela
 .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
-.for('update', { of: atividadeAplicada })
 if (linha === undefined) return undefined
 return {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › mudar a janela × começar
 .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
-.for('update', { of: atividadeAplicada })
 if (linha === undefined) return undefined
 return {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › mudar a janela × começar
-const travada = await aplicacoes.lockParaMudarAJanela(id)
-if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
-if (await aplicacoes.existeTentativa(id)) throw new DomainException(ErrorCode.PROVA_JA_COMECOU)
+const jaComecou = await aplicacoes.existeTentativa(id)
+const travada = await aplicacoes.lockParaMudarAJanela(id)
+if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
+if (jaComecou) throw new DomainException(ErrorCode.PROVA_JA_COMECOU)
 return travada
```

### Leitura da janela e conferência do contrato

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-janela: linha.abreEm === null || linha.fechaEm === null ? undefined : { abreEm: linha.abreEm.toISOString(), fechaEm: linha.fechaEm.toISOString() },
+janela: undefined,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-janela: lida.abreEm === null || lida.fechaEm === null ? null : { abreEm: lida.abreEm.toISOString(), fechaEm: lida.fechaEm.toISOString() },
+janela: null,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-if (depois === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (depois !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
+if (prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
+if (prova.janela !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
```

### Repository

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 aplicadaPor: requestSessao().usuarioId,
-abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
+abreEm: null,
 fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
 duracaoMin: nova.duracaoMin ?? null,
 embaralharQuestoes: nova.embaralhar.questoes,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
-fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
+fechaEm: null,
 duracaoMin: nova.duracaoMin ?? null,
 embaralharQuestoes: nova.embaralhar.questoes,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
-duracaoMin: nova.duracaoMin ?? null,
+duracaoMin: null,
 embaralharQuestoes: nova.embaralhar.questoes,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › janela de 50 min com duração 40
-embaralharQuestoes: nova.embaralhar.questoes,
+embaralharQuestoes: false,
 embaralharAlternativas: nova.embaralhar.alternativas,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › janela de 50 min com duração 40
 embaralharQuestoes: nova.embaralhar.questoes,
-embaralharAlternativas: nova.embaralhar.alternativas,
+embaralharAlternativas: false,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .where(
 and(
-eq(vinculo.escolaId, requireEscolaId()),
 eq(vinculo.anoLetivoId, requireAnoEmCurso()),
 eq(vinculo.turmaId, turmaId),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 eq(vinculo.escolaId, requireEscolaId()),
-eq(vinculo.anoLetivoId, requireAnoEmCurso()),
 eq(vinculo.turmaId, turmaId),
 eq(vinculo.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 eq(vinculo.anoLetivoId, requireAnoEmCurso()),
-eq(vinculo.turmaId, turmaId),
 eq(vinculo.papel, 'aluno'),
 eq(vinculo.estado, 'confirmado'),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 eq(vinculo.turmaId, turmaId),
-eq(vinculo.papel, 'aluno'),
 eq(vinculo.estado, 'confirmado'),
 sql`${usuario.desativadoEm} is null`,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 eq(vinculo.papel, 'aluno'),
-eq(vinculo.estado, 'confirmado'),
 sql`${usuario.desativadoEm} is null`,
 inArray(vinculo.usuarioId, [...alunoIds]),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 eq(vinculo.estado, 'confirmado'),
-sql`${usuario.desativadoEm} is null`,
 inArray(vinculo.usuarioId, [...alunoIds]),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 sql`${usuario.desativadoEm} is null`,
-inArray(vinculo.usuarioId, [...alunoIds]),
 ),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
-.innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
+.innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId)))
 .where(
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a atividade sem prova continua como antes
 async saveTempoAdicional(atividadeAplicadaId: string, concedidos: readonly TempoAdicionalDoAluno[]): Promise<void> {
-if (concedidos.length === 0) return
 await this.banco
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .from(tempoAdicional)
-.where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.anoLetivoId, requireAnoEmCurso()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.anoLetivoId, requireAnoEmCurso())))
 return linhas.map((linha) => ({ alunoId: linha.alunoId, percentual: linha.percentual as PercentualDeTempoAdicional }))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .from(tempoAdicional)
-.where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.anoLetivoId, requireAnoEmCurso()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tempoAdicional.anoLetivoId, requireAnoEmCurso()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
 return linhas.map((linha) => ({ alunoId: linha.alunoId, percentual: linha.percentual as PercentualDeTempoAdicional }))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .from(tempoAdicional)
-.where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.anoLetivoId, requireAnoEmCurso()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
 return linhas.map((linha) => ({ alunoId: linha.alunoId, percentual: linha.percentual as PercentualDeTempoAdicional }))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .delete(tempoAdicional)
 .where(
 and(
-eq(tempoAdicional.escolaId, escolaId),
 eq(tempoAdicional.anoLetivoId, anoLetivoId),
 eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 eq(tempoAdicional.escolaId, escolaId),
-eq(tempoAdicional.anoLetivoId, anoLetivoId),
 eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId),
 alunos.length === 0 ? undefined : notInArray(tempoAdicional.alunoId, alunos),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 eq(tempoAdicional.anoLetivoId, anoLetivoId),
-eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId),
 alunos.length === 0 ? undefined : notInArray(tempoAdicional.alunoId, alunos),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId),
-alunos.length === 0 ? undefined : notInArray(tempoAdicional.alunoId, alunos),
+undefined,
 ),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-if (lista.length === 0) return
 await this.banco
 .insert(tempoAdicional)
 .values(lista.map(
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 set: { percentual: sql`excluded.percentual`, concedidoPor: sql`excluded.concedido_por`, concedidoEm: sql`now()` },
-setWhere: sql`${tempoAdicional.percentual} <> excluded.percentual`,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › por quem não é o professor daquela turma
 .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
 .for('update', { of: atividadeAplicada })
-if (linha === undefined) return undefined
 return {
 id: linha.id,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › por quem não é o professor daquela turma
 .from(atividadeAplicada)
-.where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
+.where(and(eq(atividadeAplicada.id, id)))
 .for('update', { of: atividadeAplicada })
 if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .from(atividadeAplicada)
-.where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
+.where(and(this.#noAlcance()))
 .for('update', { of: atividadeAplicada })
 if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 avaliativa: linha.avaliativa,
-janela: linha.abreEm === null || linha.fechaEm === null ? undefined : { abreEm: linha.abreEm.toISOString(), fechaEm: linha.fechaEm.toISOString() },
+janela: undefined,
 duracaoMin: linha.duracaoMin ?? undefined,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 janela: linha.abreEm === null || linha.fechaEm === null ? undefined : { abreEm: linha.abreEm.toISOString(), fechaEm: linha.fechaEm.toISOString() },
-duracaoMin: linha.duracaoMin ?? undefined,
+duracaoMin: undefined,
 embaralhar: { questoes: linha.embaralharQuestoes, alternativas: linha.embaralharAlternativas },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .from(tentativaAtividade)
-.where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso())))
 .limit(1)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .from(tentativaAtividade)
-.where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
 .limit(1)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 .from(tentativaAtividade)
-.where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
+.where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
 .limit(1)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .set({
 abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
 fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
-duracaoMin: nova.duracaoMin ?? null,
+duracaoMin: null,
 })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .set({
-abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
+abreEm: null,
 fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
 duracaoMin: nova.duracaoMin ?? null,
 })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 .set({
 abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
-fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
+fechaEm: null,
 duracaoMin: nova.duracaoMin ?? null,
 })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 duracaoMin: nova.duracaoMin ?? null,
 })
-.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+.where(and(eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
 duracaoMin: nova.duracaoMin ?? null,
 })
-.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 duracaoMin: nova.duracaoMin ?? null,
 })
-.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a atividade sem prova não ganha janela
 duracaoMin: nova.duracaoMin ?? null,
 })
-.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+.where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
```

### Service e controller

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 encerradaEm: lida.encerradaEm?.toISOString() ?? null,
-janela: lida.abreEm === null || lida.fechaEm === null ? null : { abreEm: lida.abreEm.toISOString(), fechaEm: lida.fechaEm.toISOString() },
+janela: null,
 duracaoMin: lida.duracaoMin,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 // O aluno do tempo adicional é da turma: o de outra turma, de outra escola e o inexistente respondem igual, e nada se grava.
-await this.#conferirAlunosDaTurma(aplicacoes, turmaId, pedido.tempoAdicional)
 const id = await aplicacoes.create({ turmaId, artefatoId, avaliativa: pedido.avaliativa, janela: pedido.janela, duracaoMin: pedido.duracaoMin, embaralhar: pedido.embaralhar })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 const id = await aplicacoes.create({ turmaId, artefatoId, avaliativa: pedido.avaliativa, janela: pedido.janela, duracaoMin: pedido.duracaoMin, embaralhar: pedido.embaralhar })
-await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
 // Só a contagem de quem tem tempo adicional: o percentual por aluno é adaptação, dado sensível, e não vai para a auditoria.
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
-depois: { artefatoId, turmaId, avaliativa: pedido.avaliativa, versaoAdaptada: alvo.versaoAdaptada, comTempoAdicional: pedido.tempoAdicional.length },
+depois: { artefatoId, turmaId, avaliativa: pedido.avaliativa, versaoAdaptada: alvo.versaoAdaptada, comTempoAdicional: 0 },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-if (pedido.tempoAdicional !== undefined) {
+if (false) {
 await this.#conferirAlunosDaTurma(aplicacoes, travada.turmaId, pedido.tempoAdicional)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a janela que não cabe, o corpo vazio
 if (pedido.tempoAdicional !== undefined) {
-await this.#conferirAlunosDaTurma(aplicacoes, travada.turmaId, pedido.tempoAdicional)
 await aplicacoes.trocarTempoAdicional(id, pedido.tempoAdicional)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 await this.#conferirAlunosDaTurma(aplicacoes, travada.turmaId, pedido.tempoAdicional)
-await aplicacoes.trocarTempoAdicional(id, pedido.tempoAdicional)
 }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a avaliativa sem prova ganha a janela
-antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: antesDoTempoAdicional.length },
+antes: { janela: travada.janela, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: antesDoTempoAdicional.length },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a avaliativa sem prova ganha a janela
-antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: antesDoTempoAdicional.length },
+antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin, comTempoAdicional: antesDoTempoAdicional.length },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a avaliativa sem prova ganha a janela
-depois: { janela: janela ?? null, duracaoMin: duracaoMin ?? null, comTempoAdicional: tempoAdicional.length },
+depois: { janela: janela, duracaoMin: duracaoMin ?? null, comTempoAdicional: tempoAdicional.length },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a avaliativa sem prova ganha a janela
-depois: { janela: janela ?? null, duracaoMin: duracaoMin ?? null, comTempoAdicional: tempoAdicional.length },
+depois: { janela: janela ?? null, duracaoMin: duracaoMin, comTempoAdicional: tempoAdicional.length },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: antesDoTempoAdicional.length },
+antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: 0 },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-depois: { janela: janela ?? null, duracaoMin: duracaoMin ?? null, comTempoAdicional: tempoAdicional.length },
+depois: { janela: janela ?? null, duracaoMin: duracaoMin ?? null, comTempoAdicional: 0 },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-const janela = pedido.janela ?? travada.janela
+const janela = pedido.janela
 const duracaoMin = pedido.duracaoMin ?? travada.duracaoMin
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 const janela = pedido.janela ?? travada.janela
-const duracaoMin = pedido.duracaoMin ?? travada.duracaoMin
+const duracaoMin = pedido.duracaoMin
 const tempoAdicional = pedido.tempoAdicional ?? tempoAdicionalAtual
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
 const duracaoMin = pedido.duracaoMin ?? travada.duracaoMin
-const tempoAdicional = pedido.tempoAdicional ?? tempoAdicionalAtual
+const tempoAdicional = pedido.tempoAdicional ?? []
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a janela que não cabe, o corpo vazio
 const tempoAdicional = pedido.tempoAdicional ?? tempoAdicionalAtual
-if (camposInvalidosDaProva({ avaliativa: travada.avaliativa, janela, duracaoMin, embaralhar: travada.embaralhar, tempoAdicional }).length > 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 return { janela, duracaoMin, tempoAdicional }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › por quem não é o professor daquela turma
 const travada = await aplicacoes.lockParaMudarAJanela(id)
-if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a atividade sem prova não ganha janela
 if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
 if (await aplicacoes.existeTentativa(id)) throw new DomainException(ErrorCode.PROVA_JA_COMECOU)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › com uma tentativa iniciada
 if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
-if (await aplicacoes.existeTentativa(id)) throw new DomainException(ErrorCode.PROVA_JA_COMECOU)
 return travada
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-if (lista.length === 0) return
+if (lista.length === 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 const ids = lista.map((item) => item.alunoId.toLowerCase())
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › respondem a mesma coisa, e nada é gravado
 const daTurma = await aplicacoes.alunosDaTurmaEntre(turmaId, ids)
-if (ids.some((alunoId) => !daTurma.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

### Contrato compartilhado (shared)

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › o tempo adicional cabe quando
-if (percentuais.length === 0) return true
+if (percentuais.length === 0) return false
 const maior = Math.max(...percentuais)
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-return prova.avaliativa ? camposInvalidosDaAvaliativa(prova) : camposDaProvaForaDeAvaliativa(prova)
+return prova.avaliativa ? camposDaProvaForaDeAvaliativa(prova) : camposInvalidosDaAvaliativa(prova)
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined) campos.push('janela')
 if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
 if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.janela !== undefined) campos.push('janela')
-if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
 if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
-if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
+if (prova.embaralhar.alternativas) campos.push('embaralhar')
 if (prova.tempoAdicional.length > 0) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
-if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
+if (prova.embaralhar.questoes) campos.push('embaralhar')
 if (prova.tempoAdicional.length > 0) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.embaralhar.questoes || prova.embaralhar.alternativas) campos.push('embaralhar')
-if (prova.tempoAdicional.length > 0) campos.push('tempoAdicional')
 return campos
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
+if (prova.janela === undefined) campos.push('duracaoMin')
 if (prova.tempoAdicional.length > 0 && prova.duracaoMin === undefined) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
+if (prova.duracaoMin !== undefined) campos.push('duracaoMin')
 if (prova.tempoAdicional.length > 0 && prova.duracaoMin === undefined) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
-if (prova.tempoAdicional.length > 0 && prova.duracaoMin === undefined) campos.push('tempoAdicional')
+if (prova.duracaoMin === undefined) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
 if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
-if (prova.tempoAdicional.length > 0 && prova.duracaoMin === undefined) campos.push('tempoAdicional')
+if (prova.tempoAdicional.length > 0) campos.push('tempoAdicional')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
+if (prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela as JanelaDaProva, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
 return campos
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
+if (prova.janela !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin as number, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
 return campos
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela !== undefined && prova.duracaoMin !== undefined && !tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
+if (prova.janela !== undefined && prova.duracaoMin !== undefined && tempoAdicionalCabeNaJanela(prova.janela, prova.duracaoMin, prova.tempoAdicional.map((item) => item.percentual))) campos.push('janela')
 return campos
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › o PATCH é parcial
-.refine((pedido) => pedido.janela !== undefined || pedido.duracaoMin !== undefined || pedido.tempoAdicional !== undefined)
+.refine((pedido) => pedido.duracaoMin !== undefined || pedido.tempoAdicional !== undefined)
 export type MudarJanelaRequest = z.infer<typeof mudarJanelaRequestSchema>
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › o PATCH é parcial
-.refine((pedido) => pedido.janela !== undefined || pedido.duracaoMin !== undefined || pedido.tempoAdicional !== undefined)
+.refine((pedido) => pedido.janela !== undefined || pedido.tempoAdicional !== undefined)
 export type MudarJanelaRequest = z.infer<typeof mudarJanelaRequestSchema>
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › o PATCH é parcial
-.refine((pedido) => pedido.janela !== undefined || pedido.duracaoMin !== undefined || pedido.tempoAdicional !== undefined)
+.refine((pedido) => pedido.janela !== undefined || pedido.duracaoMin !== undefined)
 export type MudarJanelaRequest = z.infer<typeof mudarJanelaRequestSchema>
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a segunda chamada pede os convocados
 const convocados = new Set(pedido.alunoIds.map((id) => id.toLowerCase()))
-if (pedido.tempoAdicional.some((item) => !convocados.has(item.alunoId.toLowerCase()))) contexto.addIssue({ code: 'custom', path: ['tempoAdicional'], message: 'prova' })
 })
```

### Expurgo, arquivo do titular, schema TypeScript, matriz e controller

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-trabalho_do_aluno: ['tempo_adicional', 'extensao_de_tempo', 'convocado_da_segunda_chamada', 'tentativa_atividade'],
+trabalho_do_aluno: ['extensao_de_tempo', 'convocado_da_segunda_chamada', 'tentativa_atividade'],
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-trabalho_do_aluno: ['tempo_adicional', 'extensao_de_tempo', 'convocado_da_segunda_chamada', 'tentativa_atividade'],
+trabalho_do_aluno: ['tempo_adicional', 'convocado_da_segunda_chamada', 'tentativa_atividade'],
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-trabalho_do_aluno: ['tempo_adicional', 'extensao_de_tempo', 'convocado_da_segunda_chamada', 'tentativa_atividade'],
+trabalho_do_aluno: ['tempo_adicional', 'extensao_de_tempo', 'tentativa_atividade'],
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-tempo_adicional: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('tempo_adicional', escolaId, prazo, limite),
+tempo_adicional: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('extensao_de_tempo', escolaId, prazo, limite),
 extensao_de_tempo: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('extensao_de_tempo', escolaId, prazo, limite),
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-extensao_de_tempo: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('extensao_de_tempo', escolaId, prazo, limite),
+extensao_de_tempo: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('tempo_adicional', escolaId, prazo, limite),
 convocado_da_segunda_chamada: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('convocado_da_segunda_chamada', escolaId, prazo, limite),
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-convocado_da_segunda_chamada: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('convocado_da_segunda_chamada', escolaId, prazo, limite),
+convocado_da_segunda_chamada: (escolaId, prazo, limite) => doAnoEncerradoAlemDoPrazo('tempo_adicional', escolaId, prazo, limite),
 tentativa_atividade: (escolaId, prazo, limite) => sql`
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
 delete from ${alvo}
 where escola_id = ${escolaId} and id = any(array(
 select t.id from ${alvo} t
-join ano_letivo al on al.escola_id = t.escola_id and al.id = t.ano_letivo_id
+join ano_letivo al on al.escola_id = t.escola_id
 where t.escola_id = ${escolaId} and ${ANO_ENCERRADO_ALEM_DO_PRAZO(escolaId, prazo)}
 limit ${limite}
 for update of t skip locked
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
 delete from ${alvo}
 where escola_id = ${escolaId} and id = any(array(
 select t.id from ${alvo} t
 join ano_letivo al on al.escola_id = t.escola_id and al.id = t.ano_letivo_id
 where t.escola_id = ${escolaId} and ${ANO_ENCERRADO_ALEM_DO_PRAZO(escolaId, prazo)}
-limit ${limite}
+limit 0
 for update of t skip locked
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o ano vencido apaga a saída da aba
-delete from ${alvo}
+select count(*) from ${alvo}
 where escola_id = ${escolaId} and id = any(array(
 select t.id from ${alvo} t
 join ano_letivo al on al.escola_id = t.escola_id and al.id = t.ano_letivo_id
 where t.escola_id = ${escolaId} and ${ANO_ENCERRADO_ALEM_DO_PRAZO(escolaId, prazo)}
 limit ${limite}
 for update of t skip locked
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece
-sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'iniciada_em', 'enviada_em', 'limite_base_em', 'ordem', 'saidas_da_aba', 'envio')} from tentativa_atividade t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'iniciada_em', 'enviada_em', 'limite_base_em', 'ordem', 'saidas_da_aba', 'envio')} from tentativa_atividade t where t.escola_id = ${escolaId} and t.aluno_id is not null`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › a saída da aba no arquivo é a contagem
 from tentativa_atividade t
-join saida_da_aba s on s.escola_id = t.escola_id and s.ano_letivo_id = t.ano_letivo_id and s.atividade_aplicada_id = t.atividade_aplicada_id and s.aluno_id = t.aluno_id
+join saida_da_aba s on s.escola_id = t.escola_id and s.ano_letivo_id = t.ano_letivo_id and s.atividade_aplicada_id = t.atividade_aplicada_id
 where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › a saída da aba no arquivo é a contagem
 from tentativa_atividade t
-join saida_da_aba s on s.escola_id = t.escola_id and s.ano_letivo_id = t.ano_letivo_id and s.atividade_aplicada_id = t.atividade_aplicada_id and s.aluno_id = t.aluno_id
+join saida_da_aba s on s.escola_id = t.escola_id and s.ano_letivo_id = t.ano_letivo_id and s.aluno_id = t.aluno_id
 where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece
 join saida_da_aba s on s.escola_id = t.escola_id and s.ano_letivo_id = t.ano_letivo_id and s.atividade_aplicada_id = t.atividade_aplicada_id and s.aluno_id = t.aluno_id
-where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}
+where t.escola_id = ${escolaId} and t.aluno_id is not null
 group by t.id, t.ano_letivo_id, t.atividade_aplicada_id`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece
-sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'percentual', 'concedido_em')} from tempo_adicional t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'percentual', 'concedido_em')} from tempo_adicional t where t.escola_id = ${escolaId} and t.aluno_id is not null`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o tempo adicional e a extensão ficam no arquivo do aluno
-sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'minutos', 'concedida_em')} from extensao_de_tempo t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'minutos', 'concedida_em')} from extensao_de_tempo t where t.escola_id = ${escolaId} and (t.aluno_id = ${titularId} or t.aluno_id is null)`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece
-sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'minutos', 'concedida_em')} from extensao_de_tempo t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id', 'minutos', 'concedida_em')} from extensao_de_tempo t where t.escola_id = ${escolaId} and t.aluno_id is not null`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece
-sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id')} from convocado_da_segunda_chamada t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'atividade_aplicada_id')} from convocado_da_segunda_chamada t where t.escola_id = ${escolaId} and t.aluno_id is not null`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o professor: cada tabela que ele tem aparece
-sql`select ${selectColumns('id', 'ano_letivo_id', 'turma_id', 'artefato_id', 'avaliativa', 'estado', 'aplicada_em', 'encerrada_em', 'abre_em', 'fecha_em', 'duracao_min', 'embaralhar_questoes', 'embaralhar_alternativas', 'segunda_chamada_de')} from atividade_aplicada t where t.escola_id = ${escolaId} and t.aplicada_por = ${titularId}`,
+sql`select ${selectColumns('id', 'ano_letivo_id', 'turma_id', 'artefato_id', 'avaliativa', 'estado', 'aplicada_em', 'encerrada_em', 'abre_em', 'fecha_em', 'duracao_min', 'embaralhar_questoes', 'embaralhar_alternativas', 'segunda_chamada_de')} from atividade_aplicada t where t.escola_id = ${escolaId} and t.aplicada_por is not null`,
```

### Migration 0068

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a janela vem inteira e ordenada
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_inteira" CHECK (("atividade_aplicada"."abre_em" is null) = ("atividade_aplicada"."fecha_em" is null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_inteira" CHECK (true) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a janela vem inteira e ordenada
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_ordenada" CHECK ("atividade_aplicada"."abre_em" is null or "atividade_aplicada"."abre_em" < "atividade_aplicada"."fecha_em") NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_ordenada" CHECK ("atividade_aplicada"."abre_em" is null or "atividade_aplicada"."abre_em" <= "atividade_aplicada"."fecha_em") NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a janela vem inteira e ordenada
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 5 and 300 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 4 and 300 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a janela vem inteira e ordenada
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 5 and 300 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 5 and 301 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a janela vem inteira e ordenada
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 5 and 300 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or "atividade_aplicada"."duracao_min" between 5 and 300) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a atividade que não é avaliativa não tem janela
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a atividade que não é avaliativa não tem janela
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a atividade que não é avaliativa não tem janela
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a segunda chamada é da mesma turma
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas")) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a segunda chamada é da mesma turma
-CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica_nova" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."segunda_chamada_de" is null;--> statement-breakpoint
+CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica_nova" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."estado" = 'aberta';--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a segunda chamada é da mesma turma
-CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica_nova" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."segunda_chamada_de" is null;--> statement-breakpoint
+CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica_nova" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."segunda_chamada_de" is null;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a segunda chamada é da mesma turma
-CREATE UNIQUE INDEX "atividade_aplicada_segunda_chamada_aberta_unica" ON "atividade_aplicada" USING btree ("escola_id","segunda_chamada_de") WHERE "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."segunda_chamada_de" is not null;--> statement-breakpoint
+CREATE UNIQUE INDEX "atividade_aplicada_segunda_chamada_aberta_unica" ON "atividade_aplicada" USING btree ("escola_id","segunda_chamada_de") WHERE "atividade_aplicada"."segunda_chamada_de" is not null;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a segunda chamada é da mesma turma
-ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_segunda_chamada_da_original_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","artefato_id","segunda_chamada_de") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","artefato_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
+ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_segunda_chamada_da_original_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","segunda_chamada_de") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o envio é
-ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o envio é
-ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o envio é
-ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o envio é
-ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or "tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o envio é
-ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_saidas_nao_negativas" CHECK ("tentativa_atividade"."saidas_da_aba" >= 0) NOT VALID;--> statement-breakpoint
+ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_saidas_nao_negativas" CHECK ("tentativa_atividade"."saidas_da_aba" >= -1) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 100))
+CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (50, 100))
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 100))
+CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 100))
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 100))
+CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50))
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 100))
+CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 75, 100))
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id"),
+CONSTRAINT "tempo_adicional_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id"),
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CONSTRAINT "tempo_adicional_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id"),
+CONSTRAINT "tempo_adicional_um_por_aluno" UNIQUE("escola_id","aluno_id"),
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o tempo adicional é 25
-CREATE CONSTRAINT TRIGGER "tempo_adicional_concedido_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "concedido_por" ON "tempo_adicional"
-  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('concedido_por', 'tempo_adicional_concedido_por_da_escola_fk');--> statement-breakpoint
 CREATE CONSTRAINT TRIGGER "extensao_de_tempo_concedida_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "concedida_por" ON "extensao_de_tempo"
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CREATE CONSTRAINT TRIGGER "extensao_de_tempo_concedida_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "concedida_por" ON "extensao_de_tempo"
-  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('concedida_por', 'extensao_de_tempo_concedida_por_da_escola_fk');--> statement-breakpoint
 INSERT INTO "pulso_da_api" ("ultimo_em") VALUES (now());
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 120)
+CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 0 and 120)
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 120)
+CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 2 and 120)
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 120)
+CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 121)
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 120)
+CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 119)
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_chave_por_aplicacao" UNIQUE("escola_id","atividade_aplicada_id","chave"),
+CONSTRAINT "extensao_de_tempo_chave_por_aplicacao" UNIQUE("escola_id","chave"),
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a extensão vai de 1 a 120
-CONSTRAINT "extensao_de_tempo_chave_por_aplicacao" UNIQUE("escola_id","atividade_aplicada_id","chave"),
+CONSTRAINT "extensao_de_tempo_chave_por_aplicacao" UNIQUE("escola_id","atividade_aplicada_id"),
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a convocação é uma por aluno
-CONSTRAINT "convocado_da_segunda_chamada_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id")
+CONSTRAINT "convocado_da_segunda_chamada_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id")
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a convocação é uma por aluno
-CONSTRAINT "convocado_da_segunda_chamada_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id")
+CONSTRAINT "convocado_da_segunda_chamada_um_por_aluno" UNIQUE("escola_id","aluno_id")
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a linha de aluno não aponta
-ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a linha de aluno não aponta
-ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a linha de aluno não aponta
-ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › eliminar o aluno apaga em cascata
-ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › eliminar o aluno apaga em cascata
-ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › eliminar o aluno apaga em cascata
-ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › eliminar o aluno apaga em cascata
-ALTER TABLE "saida_da_aba" ADD CONSTRAINT "saida_da_aba_tentativa_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") REFERENCES "public"."tentativa_atividade"("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "saida_da_aba" ADD CONSTRAINT "saida_da_aba_tentativa_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") REFERENCES "public"."tentativa_atividade"("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o pulso é uma linha só
-CREATE UNIQUE INDEX "pulso_da_api_linha_unica" ON "pulso_da_api" USING btree ((true));--> statement-breakpoint
+CREATE INDEX "pulso_da_api_linha_unica" ON "pulso_da_api" USING btree ((true));--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o pulso é uma linha só
-INSERT INTO "pulso_da_api" ("ultimo_em") VALUES (now());
+SELECT 1;
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › o pulso é uma linha só
-CONSTRAINT "indisponibilidade_ordenada" CHECK ("indisponibilidade"."inicio" < "indisponibilidade"."fim")
+CONSTRAINT "indisponibilidade_ordenada" CHECK ("indisponibilidade"."inicio" <= "indisponibilidade"."fim")
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a saída da aba tem a chave v4
-CONSTRAINT "saida_da_aba_chave_v4" CHECK (substring("saida_da_aba"."chave"::text from 15 for 1) = '4')
+CONSTRAINT "saida_da_aba_chave_v4" CHECK (substring("saida_da_aba"."chave"::text from 15 for 1) in ('4', '7'))
```

```mutacao
arquivo: packages/core/drizzle/0068_prova_online.sql
teste: packages/core/src/db/schema/prova-online.int.test.ts › a saída da aba tem a chave v4
-CONSTRAINT "saida_da_aba_chave_v4" CHECK (substring("saida_da_aba"."chave"::text from 15 for 1) = '4')
+CONSTRAINT "saida_da_aba_chave_v4" CHECK (substring("saida_da_aba"."chave"::text from 14 for 1) = '4')
```

### Schema TypeScript, matriz, controller

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada índice com condição
-uniqueIndex('atividade_aplicada_aberta_unica').on(tabela.escolaId, tabela.turmaId, tabela.artefatoId).where(sql`${tabela.estado} = 'aberta' and ${tabela.segundaChamadaDe} is null`),
+uniqueIndex('atividade_aplicada_aberta_unica').on(tabela.escolaId, tabela.turmaId, tabela.artefatoId).where(sql`${tabela.estado} = 'aberta' and ${tabela.segundaChamadaDe} is not null`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada índice com condição
-uniqueIndex('atividade_aplicada_segunda_chamada_aberta_unica').on(tabela.escolaId, tabela.segundaChamadaDe).where(sql`${tabela.estado} = 'aberta' and ${tabela.segundaChamadaDe} is not null`),
+uniqueIndex('atividade_aplicada_segunda_chamada_aberta_unica').on(tabela.escolaId, tabela.segundaChamadaDe).where(sql`${tabela.estado} = 'encerrada' and ${tabela.segundaChamadaDe} is not null`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada índice com condição
-index('atividade_aplicada_prova_aberta_idx').on(tabela.fechaEm).where(sql`${tabela.avaliativa} and ${tabela.estado} = 'aberta' and ${tabela.fechaEm} is not null`),
+index('atividade_aplicada_prova_aberta_idx').on(tabela.fechaEm).where(sql`${tabela.avaliativa} and ${tabela.estado} = 'aberta' and ${tabela.fechaEm} is null`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('atividade_aplicada_janela_inteira', sql`(${tabela.abreEm} is null) = (${tabela.fechaEm} is null)`),
+check('atividade_aplicada_janela_inteira', sql`(${tabela.abreEm} is null) <> (${tabela.fechaEm} is null)`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('atividade_aplicada_janela_ordenada', sql`${tabela.abreEm} is null or ${tabela.abreEm} < ${tabela.fechaEm}`),
+check('atividade_aplicada_janela_ordenada', sql`${tabela.abreEm} is null or ${tabela.abreEm} <= ${tabela.fechaEm}`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('atividade_aplicada_duracao_valida', sql`${tabela.duracaoMin} is null or (${tabela.duracaoMin} between 5 and 300 and ${tabela.abreEm} is not null)`),
+check('atividade_aplicada_duracao_valida', sql`${tabela.duracaoMin} is null or (${tabela.duracaoMin} between 5 and 301 and ${tabela.abreEm} is not null)`),
```

```mutacao
arquivo: packages/core/src/db/schema/atividade-aplicada.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('atividade_aplicada_prova_so_na_avaliativa', sql`${tabela.avaliativa} or (${tabela.abreEm} is null and ${tabela.duracaoMin} is null and not ${tabela.embaralharQuestoes} and not ${tabela.embaralharAlternativas} and ${tabela.segundaChamadaDe} is null)`),
+check('atividade_aplicada_prova_so_na_avaliativa', sql`${tabela.avaliativa} or (${tabela.abreEm} is null and ${tabela.duracaoMin} is null and ${tabela.embaralharQuestoes} and not ${tabela.embaralharAlternativas} and ${tabela.segundaChamadaDe} is null)`),
```

```mutacao
arquivo: packages/core/src/db/schema/tentativa-atividade.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('tentativa_atividade_envio_valido', sql`${tabela.envio} is null or (${tabela.envio} in ('aluno', 'limite', 'encerramento') and ${tabela.enviadaEm} is not null)`),
+check('tentativa_atividade_envio_valido', sql`${tabela.envio} is null or (${tabela.envio} in ('aluno', 'encerramento') and ${tabela.enviadaEm} is not null)`),
```

```mutacao
arquivo: packages/core/src/db/schema/tentativa-atividade.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('tentativa_atividade_saidas_nao_negativas', sql`${tabela.saidasDaAba} >= 0`),
+check('tentativa_atividade_saidas_nao_negativas', sql`${tabela.saidasDaAba} >= 1`),
```

```mutacao
arquivo: packages/core/src/db/schema/prova-online.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('saida_da_aba_chave_v4', sql`substring(${tabela.chave}::text from 15 for 1) = '4'`),
+check('saida_da_aba_chave_v4', sql`substring(${tabela.chave}::text from 15 for 1) = '7'`),
```

```mutacao
arquivo: packages/core/src/db/schema/prova-online.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('tempo_adicional_percentual_valido', sql`${tabela.percentual} in (25, 50, 100)`),
+check('tempo_adicional_percentual_valido', sql`${tabela.percentual} in (25, 50)`),
```

```mutacao
arquivo: packages/core/src/db/schema/prova-online.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-check('extensao_de_tempo_minutos_validos', sql`${tabela.minutos} between 1 and 120`),
+check('extensao_de_tempo_minutos_validos', sql`${tabela.minutos} between 1 and 121`),
```

```mutacao
arquivo: packages/core/src/db/schema/prova-online.ts
teste: packages/core/src/db/schema/prova-online.int.test.ts › cada check que a migration cria
-(tabela) => [index('indisponibilidade_fim_idx').on(tabela.fim), check('indisponibilidade_ordenada', sql`${tabela.inicio} < ${tabela.fim}`)],
+(tabela) => [index('indisponibilidade_fim_idx').on(tabela.fim), check('indisponibilidade_ordenada', sql`${tabela.inicio} <= ${tabela.fim}`)],
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › cada célula da matriz está na expectativa
-atividade_aplicada: { aplicar: 'turma_vinculada', listar: 'turma_vinculada', encerrar: 'turma_vinculada', janela: 'turma_vinculada', estender: 'turma_vinculada', acompanhar: 'turma_vinculada', segunda_chamada: 'turma_vinculada' },
+atividade_aplicada: { aplicar: 'turma_vinculada', listar: 'turma_vinculada', encerrar: 'turma_vinculada', janela: 'escola', estender: 'turma_vinculada', acompanhar: 'turma_vinculada', segunda_chamada: 'turma_vinculada' },
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › cada célula da matriz está na expectativa
-minha_atividade: { listar: 'proprio', ler_prova: 'proprio', responder: 'proprio', enviar: 'proprio', ler_diagnostico: 'proprio', comecar: 'proprio', ler_tempo: 'proprio', registrar_saida: 'proprio' },
+minha_atividade: { listar: 'proprio', ler_prova: 'proprio', responder: 'proprio', enviar: 'proprio', ler_diagnostico: 'proprio', comecar: 'proprio', ler_tempo: 'proprio', registrar_saida: 'nunca' },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a resposta do PATCH
 @RequirePermissao('atividade_aplicada', 'janela')
-@Header('Cache-Control', 'no-store')
 mudarAJanela(
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a janela que não cabe, o corpo vazio
-mudarAJanela(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(mudarJanelaRequestSchema)) pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
+mudarAJanela(@Param('id', IdPipe) atividadeAplicadaId: string, @Body() pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
 return this.atividades.mudarAJanela(atividadeAplicadaId, pedido)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a resposta do PATCH
-mudarAJanela(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(mudarJanelaRequestSchema)) pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
+mudarAJanela(@Param('id') atividadeAplicadaId: string, @Body(new ZodValidationPipe(mudarJanelaRequestSchema)) pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
 return this.atividades.mudarAJanela(atividadeAplicadaId, pedido)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › só a janela e só o tempo adicional
-const comTempoAdicionalDaAplicacao = sql<number>`(select count(*)::int from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id})`
+const comTempoAdicionalDaAplicacao = sql<number>`(select count(*)::int from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId})`
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a auditoria só leva a contagem
 segundaChamadaDe: atividadeAplicada.segundaChamadaDe,
-comTempoAdicional: comTempoAdicionalDaAplicacao,
+comTempoAdicional: sql<number>`0`,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › no repository, o id certo
-if (alunoIds.length === 0) return new Set()
+if (alunoIds.length === 0) return new Set(['sem-ninguem'])
 const linhas = await this.banco
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Os contratos de `segunda-chamada` (`alunoIds`), `extensoes` (`alunoId`) e `acompanhamento` ainda não têm rota; as tarefas que as implementarem precisam do teste "aluno de outra escola e inexistente respondem igual" e do 404 igual | Tarefa 5.0 (`extensoes`, `acompanhamento`, 5.1) e 9.0 (`segunda-chamada`, 9.1): a rota é de cada uma |
| tenancy-guardian (1ª) | `tempo_adicional.concedido_por` e `extensao_de_tempo.concedida_por` sem FK, só o gatilho, como `aplicada_por`: conferir a eliminação do professor | Recusada: o `privacy-guardian` auditou a eliminação e o arquivo do titular na mesma rodada e não achou nada; é o padrão de `aplicada_por` (gatilho `exigir_equipe_da_escola`, 0023) |
| conformidade-reviewer (1ª) | Teste de que a saída da aba não cria destaque, não muda `podeAprovar` e não entra em `validacao_do_lote.apresentado` | Tarefa 8.0 (8.1, quando `saidasDaAba` passa a ser preenchida na correção); hoje só o formato do contrato garante |
| conformidade-reviewer (1ª) | O aviso de que as saídas da aba são contadas (D70) e o aviso fixo da tecnologia assistiva (D88), na Autoconferência da 10.0 | Tarefa 10.0 (`10_task.md`, "Autoconferência"): a tela é da 10.0 |
| conformidade-reviewer (1ª) | Confirmar com o `privacy-guardian` quem, além do titular, chega ao arquivo com a contagem de saídas da aba | Decidido na rodada 2 (item 1 da ordem, divergência da tarefa): a saída da aba entra na versão `coordenacao` por exceção declarada no PRD §6, com caso próprio em `arquivo-do-titular.int.test.ts` |
| infra-guardian (1ª) | Levar o `VALIDATE` da 0068 para um arquivo próprio, a partir do staging | `TODO.md` (linhas 231 e 286, que já pedem isso); a 0068 entra nessa lista pelo item 12 |
| infra-guardian (1ª) | O cenário do teste de carga da prova (resposta por item, retomada, relógio) precisa ser atualizado | Tarefa 3.0 (`comecar` e gravação por item) e 6.5 (carga `prova-online.js`) |
| revisor-geral (1ª) | PATCH com `{ tempoAdicional: [] }` numa atividade não avaliativa responde 200, grava nulos e audita | Não aplicar: é uma recusa nova (de 200 para `ENTRADA_INVALIDA`), que a Tech Spec §5.1 e o `cenarios.md` RF1 não escrevem (RF1 trata a janela, não a lista vazia). `TODO.md`, para o Arquiteto decidir se vira regra |
| privacy-guardian (1ª) | `provaAntesDeComecarResponseSchema` (`packages/shared/src/atividade/prova.ts`) reusa `duracaoDaProvaSchema` (máximo 300) para a duração do aluno, que já soma o tempo adicional: com +100% sobre 300 min dá 600 e o `parse` quebra | Tarefa 3.0 (3.2, `prova` e `comecar`): muda contrato, e a rota que o usa nasce lá |
| privacy-guardian (1ª) | O arquivo do professor não traz as concessões dele (`concedido_por`); daria para incluir o ato, sem o aluno e sem o percentual | Retrospectiva da spec: o registro da escolha. A Tech Spec decidiu assim |
| privacy-guardian (1ª) | `extensao_de_tempo.chave` sem o check de v4 que a `saida_da_aba` tem | Tarefa 5.0 (5.1, `extensoes` com chave): mudar a 0068, já aplicada, exigiria migration nova |
| tenancy-guardian (2ª) | O caso novo da versão da coordenação (`arquivo-do-titular.int.test.ts`, `o tempo adicional vai na versão da escola…`) não tem linha de `tempo_adicional` de outra escola para o mesmo titular | Sem aplicar: o revisor aprovou e diz que o isolamento dessa tabela no arquivo já é provado pelo caso geral `o aluno: cada tabela que ele tem aparece, e a linha de outro aluno e a de outra escola não` |
| infra-guardian (2ª) | A partir do staging, índices da 0068 com `concurrently` e `VALIDATE` em arquivo próprio | `TODO.md`: a entrada da 0068 que a rodada 1 acrescentou já diz isso |
| infra-guardian (2ª) | Cenário de carga da prova e duração do aluno acima de 300 min no `provaAntesDeComecarResponseSchema` | Tarefas 3.0 e 6.5, como na rodada 1 (já na tabela) |
| privacy-guardian (2ª) | Conferir `Object.keys(linha)` do `tempo_adicional` nas duas versões, para pegar coluna nova que vaze | Recusada: o `not.toContain(professor.id)` do caso do aluno e o caso novo da versão da escola já pegam o id de quem concedeu, e a lista de colunas da leitura é o contrato |
| privacy-guardian (2ª) | A exceção do tempo adicional entrar na lista "a confirmar com advogado" | Recusada: a linha do mapa em `docs/lgpd.md` já traz "**a confirmar com advogado**" na coluna da base legal, e a exceção está na mesma linha |
| conformidade-reviewer (2ª) | O teste da saída da aba na 8.0 (sem destaque, sem `podeAprovar`, fora do registro da validação) e o aviso na foto da tela da 10.0 | Tarefas 8.0 (8.1) e 10.0, como na rodada 1 (já na tabela) |
| test-engineer (2ª) | O caso (k) conferir o estado final quando o `esperarNaTrava` falha, para o bloco (a) quebrar também uma asserção de negócio | Retrospectiva da spec: o portão já deu vermelho nas 171 mutações |
| test-engineer (2ª) | Citar o caso novo da versão da escola na linha "Arquivo do titular" da tabela de testes | Retrospectiva da spec; o caso existe no arquivo de teste |
| test-engineer (2ª) | Caso de integração do PATCH com tempo adicional numa prova sem duração | Tarefa 9.0 (segunda chamada), que usa a mesma conferência; a unidade a cobre hoje |
| revisor-geral (3ª) | `cenarios.md:63` (RF9) diz "Coordenação e rede: nenhum dos três de aluno" e não cita a exceção do arquivo do titular que o `prd.md:50` cita; acrescentar "(fora o arquivo do titular, §6)" | Arquiteto, dono do `cenarios.md` (a spec é dele): o Orquestrador repassa na próxima edição da spec; a frase vale para os contratos da API e continua certa |
| test-engineer (3ª) | O comentário do caso novo da saída da aba (`arquivo-do-titular.int.test.ts:1366`) fala em "o id de quem concedeu", que a saída da aba não tem | Recusada: é texto herdado do caso do tempo adicional e não muda o que o teste prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 16:20:54 | 2026-11-23 16:22:13 | `tenancy-guardian` | 1 | APROVADO | a45ec6dcf9fe7b8dd |
| 2026-11-23 16:21:18 | 2026-11-23 16:22:19 | `conformidade-reviewer` | 1 | APROVADO | aa95a26445d5e3530 |
| 2026-11-23 16:21:04 | 2026-11-23 16:22:39 | `infra-guardian` | 1 | APROVADO | a2c5714958e19c5e9 |
| 2026-11-23 16:21:13 | 2026-11-23 16:23:17 | `revisor-geral` | 1 | APROVADO | ac3802f0b572ca767 |
| 2026-11-23 16:21:08 | 2026-11-23 16:23:27 | `test-engineer` | 1 | REPROVADO | a631e00fdf7ea83b1 |
| 2026-11-23 16:20:59 | 2026-11-23 16:24:13 | `privacy-guardian` | 1 | REPROVADO | afa5826548200de80 |
| 2026-11-23 16:58:20 | 2026-11-23 16:58:50 | `tenancy-guardian` | 2 | APROVADO | a54dd12143795a784 |
| 2026-11-23 16:58:38 | 2026-11-23 16:58:55 | `infra-guardian` | 2 | APROVADO | a8d5d524eb4c2669a |
| 2026-11-23 16:58:30 | 2026-11-23 16:59:04 | `privacy-guardian` | 2 | APROVADO | ae65f8736a8f5ef6d |
| 2026-11-23 16:59:06 | 2026-11-23 16:59:26 | `conformidade-reviewer` | 2 | APROVADO | abe3dece7bcf8de9e |
| 2026-11-23 16:58:58 | 2026-11-23 17:00:15 | `revisor-geral` | 2 | REPROVADO | aec4b648635e5c1c7 |
| 2026-11-23 16:58:51 | 2026-11-23 17:00:20 | `test-engineer` | 2 | APROVADO | a39ce88827967831f |
| 2026-11-23 20:12:03 | 2026-11-23 20:12:30 | `revisor-geral` | 3 | APROVADO | a02ea64a941a51ee3 |
| 2026-11-23 20:11:49 | 2026-11-23 20:12:38 | `test-engineer` | 3 | APROVADO | a6a96d981e39708b6 |
