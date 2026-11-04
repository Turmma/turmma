# Tarefa 8.0 — Reimportar a planilha de alunos atualiza sem duplicar, e a lista da turma segue a mesma regra

**Funcionalidade:** onboarding-por-convite · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Reimportar pela matrícula classifica "já existe", "nome corrigido", "muda de turma" e "fora da planilha"; nome corrigido
atualiza (o do aprovado no `usuario.nome`, o do não aprovado na `lista_nome`), e mudar de turma ou sair só acontece com
marca (9.0 e 10.0). A lista por turma da A1 passa a usar o mesmo contrato, e grava com 202.

## Contexto necessário

- `techspec.md` §4 (`/v1/turmas/:id/lista/previa` e `/lista` com o contrato da importação), §5 "Planilha" (aprovado pela
  `credencial_matricula` e pelo `usuario`; não aprovado pela `lista_nome`), "O job" passo (3) (pedidos relidos; `where
  estado <> 'aprovado'`), "Gravar" ("nome corrigido")
- `prd.md` RF4, RF16, RF17; PRD §10, pergunta 2 (a lista da A1 segue o RF4)
- `cenarios.md` RF4; "A1 que muda de regra" (`lista.int.test.ts`); Corridas ("Nome corrigido contra aprovação")
- Código: o tipo alunos da 7.0; `apps/api/src/estrutura/lista/` (controller, service, `lista-reader.ts`);
  `packages/core/src/estrutura/decisao.repository.ts` (da 1.0)

## Subtarefas

- [x] 8.1 — Classificação de reimportação: já existe, nome corrigido (aprovado e não aprovado), muda de turma e fora da planilha como candidatos à marca
- [x] 8.2 — Gravar: nome corrigido com `usuario.nome_corrigido` ou `lista.nome_corrigido`, sem nome; pedidos pendentes das turmas relidos sob a trava
- [x] 8.3 — A lista por turma da A1 com o contrato da importação (202), com o `turmaId` conferido na escola e no ano; auditoria `turma.alunos_lidos` na prévia que lê nome do banco
- [x] 8.4 — Reescrever em `apps/api/test/lista.int.test.ts` os casos que mudam de regra (E4, E6, o teto, o 202), com a regra nova no nome
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `apps/api/src/estrutura/lista/lista.controller.ts`, `lista.service.ts`, `lista-reader.ts` | alterado |
| `packages/shared/src/estrutura/lista.ts` | alterado |
| `apps/api/test/lista.int.test.ts`, `apps/worker/test/gravar-planilha-alunos.int.test.ts` | alterado |
| `apps/api/src/configure-app.ts`, `configure-app.test.ts` | alterado (além do previsto) |
| `apps/api/src/estrutura/importacao/importacao.service.ts`, `estrutura.module.ts` | alterado (além do previsto) |
| `packages/core/src/importacao/motor.ts`, `tipo.ts`, `importacao.repository.ts`, `index.ts`; `packages/core/src/estrutura/lista.repository.ts`, `decisao.repository.ts`, `index.ts`; `packages/core/src/auditoria/acoes.ts`; `packages/core/src/index.ts`; `packages/shared/src/index.ts` | alterado (além do previsto) |
| `apps/api/test/decisao.int.test.ts`, `escola-montada.int.test.ts`, `importacao-alunos.int.test.ts`, `virada-do-ano.int.test.ts`, `ciclo-de-vida.int.test.ts`, `salas-abrir.int.test.ts`, `salas-reivindicar.int.test.ts`, `sala.fixture.ts`, `architecture.test.ts` | alterado (o que gravava a lista pelo texto passa ao avulso ou ao job) |
| `infra/scripts/carga-sala.ts`, `infra/test/carga-sala.test.ts` | alterado (o cenário de carga gravava a lista de forma síncrona) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A mesma planilha duas vezes: tudo "já existe", e o banco não muda | integração | caminho feliz (RF4) | `apps/api/test/lista.int.test.ts` › `a mesma lista duas vezes é tudo "já existe"`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao` (a segunda importação) |
| Nome corrigido do aprovado atualiza `usuario.nome` | integração | RF4 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao`; `apps/api/test/decisao.int.test.ts` › `E6: a matrícula do aprovado nesta turma` |
| Nome corrigido do não aprovado atualiza a `lista_nome` | integração | RF4 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao`; `apps/api/test/lista.int.test.ts` › `a mesma lista duas vezes é tudo` |
| Nenhum dos dois esbarra no `lista_nome_aprovado_sem_nome` | integração | check | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao` (o aprovado segue sem nome nem matrícula na lista, o reivindicado e o livre com os dois) |
| Auditoria `usuario.nome_corrigido` e `lista.nome_corrigido`, sem nome | integração | RF17 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao`; `apps/api/test/lista.int.test.ts` › `lista.nome_corrigido leva o id da linha` |
| "Muda de turma" e "fora da planilha", sem marca, gravam sem efeito | integração | RF4 | `apps/api/test/lista.int.test.ts` › `"muda de turma" e "fora da planilha" sem marca`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `nome corrigido: o do aprovado vai ao` |
| [P] Aprovação do mesmo nome entre o (2) e o (3): `desatualizada`, nunca `falhou` | [P] | | `apps/api/test/decisao.int.test.ts` › `[P] a aprovação do mesmo nome entre o passo (2) e o (3)`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] o nome do não aprovado trocado à mão`, `[P] o aprovado desativado ou com o nome trocado` |
| [P] Aprovação parada depois de travar o pedido, com o job no (3), e o inverso: só o estado final; zero `40P01` | [P] | | `apps/api/test/decisao.int.test.ts` › `[P] a aprovação parada depois de travar o pedido`, `[P] o inverso, o job parado depois de corrigir o nome`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `o passo (3) trava, nesta ordem` |
| [P] Pedido criado e aprovado durante o (3): nunca o nome antigo com `concluida` | [P] | pedidos relidos | `apps/api/test/decisao.int.test.ts` › `[P] o pedido criado e aprovado durante o passo (3)` |
| [P] Nome reivindicado, ou reivindicado e aprovado, entre a releitura e a escrita: `desatualizada` (nunca `falhou`), o nome de antes, sem auditoria de correção | [P] | escrita condicional de `corrigirNomes` (regra 80, item 7) | `apps/api/test/decisao.int.test.ts` › `[P] o nome reivindicado entre a releitura e a escrita`, `[P] o nome reivindicado e aprovado entre a releitura e a escrita` |
| Mais correções do que um lote (501 aprovados e 501 não aprovados): a soma por lote fecha a conta | integração | lote de 500 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `mais nomes corrigidos do que cabem num lote` |
| Prévia da escola A não oferece nenhum aluno da B como candidato | integração | isolamento (regra 10, item 5) | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `isolamento da reimportação` (`candidatos: []`) |
| Aprovado desativado entre o (2) e o (3): `desatualizada`, nome intacto | [P] | | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] o aprovado desativado ou com o nome trocado` (a segunda parte) |
| 21º pedido por minuto e vaga da escola nas duas rotas da lista: 429, a outra escola e o outro usuário seguem | integração | regra 80, itens 1 e 3 | `apps/api/test/lista.int.test.ts` › `20 pedidos por minuto por usuário`, `[P] duas vagas da escola ocupadas` |
| `turma.alunos_lidos` também pela prévia de `/v1/importacoes/alunos/previa` | integração | RF17 | `apps/api/test/importacao-alunos.int.test.ts` › `a prévia que mostra nome do banco` |
| Lista por turma com `turmaId` da B: igual a inexistente | integração | isolamento | `apps/api/test/lista.int.test.ts` › `a turma da escola B, a de um id sorteado e a de um ano encerrado`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `isolamento da reimportação` |
| Lista por turma com `turmaId` de outro ano: `NAO_ENCONTRADO` | integração | ano | `apps/api/test/lista.int.test.ts` › `a turma da escola B, a de um id sorteado e a de um ano encerrado`; `E5: … a turma de lá não ganha nome` |
| `lista.int.test.ts` E4: matrícula em uso passa a "muda de turma" | integração | A1 que muda | `apps/api/test/lista.int.test.ts` › `a prévia aponta cada linha ruim com o código, entre as boas` |
| `lista.int.test.ts` E6: "já existe com outro nome" passa a "nome corrigido" | integração | A1 que muda | `apps/api/test/lista.int.test.ts` › `a mesma lista duas vezes é tudo "já existe"` |
| `lista.int.test.ts`: o teto passa a 3.001 linhas e 512 KB; a gravação responde 202 | integração | A1 que muda | `apps/api/test/lista.int.test.ts` › `o teto da planilha, 3.000 linhas e 512 KB`, `a gravação responde 202 com o id da importação`; `apps/api/src/configure-app.test.ts` › `a prévia e a gravação da lista da turma seguem com o corpo grande` |
| Auditoria `turma.alunos_lidos` (`conferencia_de_cadastro`) | integração | RF17 | `apps/api/test/lista.int.test.ts` › `a prévia que mostra nome do banco` |

## Como testar

- Os casos a reescrever: `apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim com o código, …, com matrícula em uso é CONFLITO, …` (E4); `› a mesma lista duas vezes não muda a contagem; o que já está na lista da turma sai ja_existe, mesmo com outro nome; …` (E6); `› 201 linhas ou 64 KB + 1 byte na prévia e na gravação: …`
- Corrida com a decisão: `apps/api/test/decisao.int.test.ts` e o `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/test/lista.int.test.ts apps/worker/test/gravar-planilha-alunos.int.test.ts apps/api/test/decisao.int.test.ts`
- Armadilha: a gravação do texto da lista passou a responder 202 e a gravar no job. Teste que a usa para pôr nomes na escola usa o nome avulso (`/lista/nome`, que grava na hora) ou roda o job (`executarPlanilha`); a fixture `sala.fixture.ts` e as de `salas-*` mudaram para o avulso

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o mesmo nome corrigido para um aprovado e para um não aprovado na mesma planilha.

1. **Mutação de cada cláusula:** 51 blocos na seção "Mutações" e as linhas sem bloco com o motivo escrito (atalho de lista vazia, filtro redundante com o escopo da turma, dupla defesa). A regra pura (resultado de cada linha, candidatos a marca, a defesa contra a escrita que mudou menos linhas) é provada em `alunos.test.ts`; a trava, o escopo de repository e a corrida, nos casos de integração citados.
2. **O texto na tela:** a tarefa não tem tela (a da lista é a 13.0); não se aplica. A resposta da API não traz nome nem matrícula: a prévia traz o número da linha, o resultado e o código; só o rótulo do candidato a marca traz o nome do banco e a matrícula, para a coordenação conferir, e isso grava `turma.alunos_lidos`.
3. **O segundo dado:** o mesmo nome corrigido (`Nome Corrigido`) para um aprovado e um não aprovado na mesma planilha (`gravar-planilha-alunos.int.test.ts › nome corrigido: o do aprovado vai ao`), com um reivindicado de nome diferente, um ausente e um de outra turma; o aprovado da escola B e os dois nomes da B com a matrícula da planilha da A (`isolamento da reimportação`); o aprovado desativado e o aluno com a linha só em outro ano.
4. **Checagem anterior que responde antes:** o erro do texto (turma, nome, matrícula, documento, repetida) vem antes de qualquer alvo; a turma da lista (escola, ano) vem antes de tudo na prévia (`NAO_ENCONTRADO`, igual para a de outra escola e o id sorteado); o teto de linhas e de bytes vem antes de procurar a turma (`ENTRADA_INVALIDA`).
5. **Resultado, não forma do código:** as asserções leem `lista_nome`, `usuario`, `auditoria` e `importacao_planilha`; o espião de SQL só confere a ordem das travas (ano, usuários, turmas, pedidos, primeira escrita).
6. **Guarda nova:** nenhuma. Duas ações de auditoria na lista fechada de `acoes.ts` (`usuario.nome_corrigido`, `lista.nome_corrigido`, sem `antes` nem `depois`), e a lista das ações da entidade `usuario` de `architecture.test.ts` acompanha.
7. **Comentários:** relidos contra o código. Os docblocks de `alunos.ts` (`classificar`, `travar`, `corrigirNomes`), de `lista.repository.ts` (`paraReimportar`, `corrigirNomes`), de `decisao.repository.ts` (`travarPendentesDasTurmas`) e de `lista.service.ts` dizem o que o código faz agora.
8. **A divergência cria regra?** Quatro, na tabela "Divergências resolvidas": o escopo de "fora da planilha", a prioridade de "muda de turma" sobre "nome corrigido", a contagem `nomes_corrigidos` só quando há correção, e o corpo grande nas duas rotas da lista. Nenhuma muda a seção 11 da Tech Spec.
9. **Peça que já existe:** o motor, o `TipoDeImportacao` e o job da 4.0 e da 7.0; `lerTextoDaLista` (agora com o teto da planilha), `AuditoriaRecorder`, `WriteBlockTrigger`/`esperarNaTrava`, `executarPlanilha`, `SessaoFixtures`; o repository de lista ganhou três métodos (`paraReimportar`, `corrigirNomes`, e `inserirNoAno` já existia), o de decisão um (`travarPendentesDasTurmas`), sem cópia. O tipo `alunos` serve a planilha e a lista, pela `DaLista`.
10. **Corrida:** a aprovação do mesmo nome entre o (2) e o (3), a aprovação parada depois de travar o pedido com o job no (3) e o inverso, o pedido criado durante o (3), o nome trocado à mão e o avulso entre o (2) e o (3), duas gravações ao mesmo tempo (uma 202 e uma `CONFLITO`: uma importação na fila por escola), o avulso contra o job parado no `insert`, o excluir da turma contra o job, a turma que sai antes e entre a gravação e o job.
11. **Isolamento e coluna "Caso":** cada linha da tabela tem o caso. O isolamento tem a turma da B, o id sorteado e o ano encerrado na prévia e na gravação (sem importação, sem job, sem leitura auditada), e o aprovado e os nomes da B contra a planilha da A (a B não muda e a A não vê candidato dela).
12. **O que verificar dos guardiões:** `tenancy-guardian` (a escola pelo contexto em todo método novo; o ano de destino; a turma da lista conferida em escola e ano), `privacy-guardian` (nome e matrícula só na `lista_nome` e no rótulo do candidato; auditoria sem nome, com `turma.alunos_lidos` e finalidade; log sem o texto), `infra-guardian` (a ordem global das travas importação, ano, usuários, turmas, pedidos; a escrita condicional em lote; o corpo de até 512 KB só nas duas rotas da lista; a carga que gravava a lista de forma síncrona agora espera a importação).

## Fora do escopo desta tarefa

Transferência e desligamento com marca (9.0, 10.0); a tela da lista (13.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| "Fora da planilha" só alcança as turmas que a planilha cita (as de linha sem erro e de turma única); quem é de turma que ela não cita não é candidato | Planilha de uma turma só não pode oferecer a escola inteira para desligar; a turma ambígua ou com erro também não oferece os alunos dela | `techspec.md` §5 "Planilha" (o candidato `desligar`); `cenarios.md` RF4 |
| Matrícula em outra turma é "muda de turma" mesmo com o nome diferente; o nome só é corrigido quando a turma é a mesma | A turma de destino da linha é o que a 9.0 precisa para transferir, e corrigir o nome de quem pode mudar de lugar misturaria duas decisões da coordenação | `techspec.md` §5 "Gravar" ("nome corrigido"); `cenarios.md` RF4 |
| `nomes_corrigidos` só entra no `resumo` quando é maior que zero; `corrigidos` só entra na auditoria `planilha.gravada` nesse caso | O resumo guarda o que a planilha fez, e as contagens que não houve não entram (as da 7.0 seguem iguais) | `techspec.md` §5 "Gravar"; a seção 11 não muda |
| Ações de auditoria novas `usuario.nome_corrigido` (entidade `usuario`) e `lista.nome_corrigido` (entidade `lista_nome`), sem `antes` nem `depois` | O id da entidade já diz qual aluno mudou; nome nenhum vai à auditoria (regra 20, item 10) | `techspec.md` §5 "Gravar" (a auditoria do nome corrigido); `cenarios.md` RF17 |
| A lista por turma lê o texto na API (`lerTextoDaLista`, sem cabeçalho, `nome;matricula`) e o entrega ao motor como `DaLista`; o teto é o da planilha (3.000 linhas e 512 KB) | A lista da A1 não tem coluna de turma, e o contrato da importação é de planilha com turma; o tipo `alunos` aceita as duas entradas | `techspec.md` §4 (`/v1/turmas/:id/lista/previa` e `/lista`); `prd.md` §10, pergunta 2 |
| As duas rotas da lista (`POST /v1/turmas/:id/lista` e `/lista/previa`) passam a aceitar corpo de até 1 MB, como as da planilha; o resto da API segue com 100 KB | Sem isso o teto de 512 KB e 3.000 linhas era inalcançável (uma lista de 3.000 linhas passa de 100 KB) | `techspec.md` §4 (teto da planilha); regra 80, item 3 |
| A gravação do texto da lista responde 202 e **não tem** mais o `CONFLITO` da matrícula em uso; o `CONFLITO` que sobra é o de uma importação na fila por escola | A matrícula que a escola já tem é "já existe", "nome corrigido" ou "muda de turma" (o RF4); a fila de uma por escola é a da 4.0 | `techspec.md` §4; `cenarios.md` "A1 que muda de regra" |
| Arquivos além dos "previstos": `configure-app.ts`, `importacao.service.ts`, `estrutura.module.ts`, `motor.ts`, `tipo.ts`, os repositories, `acoes.ts`, os testes de integração que usavam a gravação do texto (`decisao`, `escola-montada`, `virada-do-ano`, `ciclo-de-vida`, `salas-*`, `sala.fixture`, `importacao-alunos`), `infra/scripts/carga-sala.ts` e `infra/test/carga-sala.test.ts` | Cada um é onde o contrato novo precisa existir ou onde o teste dependia da gravação síncrona | `techspec.md` §2, §4 e §5; a seção 11 não muda |
| A tela da lista (`apps/web`) e o `e2e/lista-da-turma.spec.ts` seguem com o contrato antigo até a 13.0 | A 8.0 tira a tela do escopo, e a 13.0 troca a lista da turma pelo `ImportarPlanilha` (`13_task.md`, arquivos previstos e o caso "A lista da turma usa o `ImportarPlanilha` e grava com 202"); a esteira do e2e fica vermelha nesses casos até lá | `13_task.md`; `techspec.md` §4 |

## Mutações

--faltando: 10 linhas (51 blocos, 10 motivos)

**Sem bloco (motivo):** (1) os atalhos de lista vazia, `DecisaoRepository.travarPendentesDasTurmas` (`turmaIds.length === 0`), `ListaRepository.paraReimportar` (`matriculas.length === 0 && turmaIds.length === 0`), `corrigirNomes` (`correcoes.length === 0`) e `inserirNoAno` (`nomes.length === 0`): sem eles o `inArray` ou o `values` vazio vira falso ou não escreve nada, e o resultado é o mesmo; poupam só a consulta. (2) `travarPendentesDasTurmas`, as cláusulas `escolaId` e `anoLetivoId` do `where`: a turma é de uma escola e de um ano só (o id é UUID), então o conjunto trancado é o mesmo sem elas; ficam por escopo (regra 10) O mesmo vale para `eq(listaNome.escolaId, escolaId)` nos dois `where` de `ListaRepository.paraReimportar`: o `anoLetivoId` vem do contexto da escola e a chave composta `lista_nome_turma_do_ano_da_escola_fk` (escola, ano, turma) prende o ano à escola, então não existe linha de outra escola naquele ano e a mutação não muda resultado nenhum (testada: os dois isolamentos seguem verdes); a cláusula fica por escopo explícito e por começar o índice (regras 10 e 80), e o isolamento é provado pelos testes de outra escola e de outro ano. (3) `paraReimportar`, no ramo dos aprovados: `eq(listaNome.estado, 'aprovado')` e `eq(usuario.papel, 'aluno')` são a mesma coisa que o `innerJoin` pelo `usuario_id` (só a aprovação grava `usuario_id`, e ela cria aluno, check `lista_nome_aprovado_sem_nome`); no ramo dos não aprovados, `ne(listaNome.estado, 'aprovado')` e o filtro do `flatMap` (`estado === 'aprovado'`, nome nulo) são dupla defesa: tirar uma não muda nada, e o que a regra exige é que o aprovado não chegue como nome. (4) `motor.ts`, `leituras.length === 0` (sem leitura a transação abriria vazia, e o resultado é o mesmo) e `doTipo.previaDaLista === undefined` (só o tipo `alunos` recebe `daLista`, e ele tem `previaDaLista`; é guarda de tipo). (5) `alunos.ts`: o `erro ?? null` da assinatura (`undefined` em lista vira `null` no `JSON.stringify`), `alvo.id`, `alvo.estado` e `alvo.turmaId` na assinatura (o `resultado` e o `destino` já a mudam; o id trocado por outro igual não muda o efeito, o estado trocado por reivindicação fecha pela escrita condicional que não acha a linha e sai `desatualizada` do mesmo jeito, e a turma de origem de quem muda de turma só vai ao rótulo até a 9.0), o `turmasLidas ??` do `classificarAgora` (só poupa reler as turmas), o filtro de turma conhecida em `turmasTocadas` (o id desconhecido não trava nada), e o `sort` dos candidatos a desligar (ordem estável da resposta). (6) SQL cru, que o `--faltando` não lê: em `ListaRepository.corrigirNomes`, `l.escola_id` e `l.ano_letivo_id` são o mesmo argumento do (2) (o `id` é UUID de uma linha que a releitura achou no ano de destino, e a chave composta prende o ano à escola), e `l.estado <> 'aprovado'` é a mesma coisa que `l.estado = v.estado` (o `estadoLido` vem de `naoAprovados`, que nunca é `aprovado`); o `l.estado = v.estado` tem bloco (43 e 44 tiram os dois, e só o `=`). Em `ImportacaoRepository.corrigirNomesDosAlunos`, `u.escola_id`, `u.papel = 'aluno'`, `u.desativado_em is null` e `u.nome = v.nome_lido` são defesa em profundidade da linha que o `travarUsuarios` já trancou em `FOR NO KEY UPDATE` antes da releitura: o aluno desativado ou com o nome trocado muda a assinatura (a releitura o lê como "já existe" ou com o nome novo) e a importação sai `desatualizada` antes da escrita; o teste `[P] o aprovado desativado ou com o nome trocado` prova a assinatura, e nenhuma escrita chega ao `where` com a linha mudada, então a cláusula tirada não deixa caso nenhum vermelho.

A prévia e a gravação da lista da turma deixam de ter o corpo grande: a rota `/lista/previa` sai da regra.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › a prévia e a gravação da lista da turma seguem
-const ROTA_DA_LISTA_DA_TURMA = /^\/v1\/turmas\/[0-9a-f-]{36}\/lista(\/previa)?(\?.*)?$/
+const ROTA_DA_LISTA_DA_TURMA = /^\/v1\/turmas\/[0-9a-f-]{36}\/lista(\?.*)?$/
```

O avulso (`/lista/nome`) passa a ter o corpo grande, como a planilha.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › a prévia e a gravação da lista da turma seguem
-const ROTA_DA_LISTA_DA_TURMA = /^\/v1\/turmas\/[0-9a-f-]{36}\/lista(\/previa)?(\?.*)?$/
+const ROTA_DA_LISTA_DA_TURMA = /^\/v1\/turmas\/[0-9a-f-]{36}\/lista(\/previa|\/nome)?(\?.*)?$/
```

A rota da lista da turma sai da lista de rotas com o corpo grande.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › a prévia e a gravação da lista da turma seguem
-caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`) || ROTA_DA_LISTA_DA_TURMA.test(caminho)
+caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
```

A trava dos pedidos pendentes prende os de outro estado, e não os pendentes: a planilha não espera a aprovação parada.

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/decisao.int.test.ts › a aprovação parada depois de travar o pedido
-.where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'pendente'), inArray(reivindicacao.turmaId, [...turmaIds])))
+.where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'recusada'), inArray(reivindicacao.turmaId, [...turmaIds])))
```

A trava dos pedidos pendentes deixa de alcançar as turmas da planilha.

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/decisao.int.test.ts › a aprovação parada depois de travar o pedido
-.where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'pendente'), inArray(reivindicacao.turmaId, [...turmaIds])))
+.where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'pendente'), inArray(reivindicacao.turmaId, [])))
```

O que a escola já tem deixa de ser buscado pela matrícula da planilha: a matrícula da outra turma volta a ser só "já existe".

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim
-if (matriculas.length > 0) {
+if (false) {
```

O que a escola já tem deixa de ser buscado pelas turmas que a planilha cita: ninguém é candidato a desligar.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/lista.int.test.ts › "muda de turma" e "fora da planilha" sem marca
-if (turmaIds.length > 0) {
+if (false) {
```

O nome ainda não aprovado de outro ano passa a ser achado pela matrícula.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a turma e a lista de outro ano da mesma escola não contam
-.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), ne(listaNome.estado, 'aprovado'), or(...daNaoAprovada)))
+.where(and(eq(listaNome.escolaId, escolaId), ne(listaNome.estado, 'aprovado'), or(...daNaoAprovada)))
```

O aluno aprovado desativado passa a ser corrigido.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o aluno aprovado desativado
-.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm), or(...daAprovada)))
+.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(usuario.papel, 'aluno'), or(...daAprovada)))
```

O aluno aprovado com a linha só em outro ano passa a ser achado e corrigido.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o aluno aprovado desativado
-.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm), or(...daAprovada)))
+.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.estado, 'aprovado'), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm), or(...daAprovada)))
```

A prévia da planilha de outro tipo passa a procurar o ramo da lista.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a turma escrita de três jeitos
-if (daLista === undefined) return { ano, previa: await doTipo.previa(repositorio, ano, pedido.texto) }
+if (false) return { ano, previa: await doTipo.previa(repositorio, ano, pedido.texto) }
```

A prévia sem leituras (todo tipo que não é alunos) deixa de pular a auditoria das leituras.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › caminho feliz: a prévia classifica
-if (leituras === undefined || leituras.length === 0) return
```

As turmas da escola de mesma chave deixam de se somar no índice.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma da escola com a mesma chave
-porIndice.set(indice, [...(porIndice.get(indice) ?? []), turma])
+porIndice.set(indice, [turma])
```

A turma dada da lista deixa de ser a turma tocada: nenhum aluno dela é lido nem travado.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › "muda de turma" e "fora da planilha" sem marca
-if (turmaId !== undefined) {
+if (false) {
```

A turma pedida por nome, que ainda não existe, deixa de ter a lista vazia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o job cria a turma e a série que faltam
-} else for (const achada of porIndice.get(indiceDaTurma(turma, null)) ?? []) ids.add(achada.id)
+} else for (const achada of porIndice.get(indiceDaTurma(turma, null))) ids.add(achada.id)
```

A linha da lista de uma turma passa a exigir a coluna de turma.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › a mesma lista duas vezes é tudo
-if (turma === '' && turmaId === undefined) return 'turma_vazia'
+if (turma === '') return 'turma_vazia'
```

A turma dada da lista que sumiu deixa de ser `turma_invalida`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › C9: a turma que sai antes da lista
-if (lida.turmaId !== undefined) return turmas.some((turma) => turma.id === lida.turmaId) ? { tipo: 'existente', turmaId: lida.turmaId } : 'turma_invalida'
+if (lida.turmaId !== undefined) return turmas.some((turma) => turma.id === lida.turmaId) ? { tipo: 'existente', turmaId: lida.turmaId } : { tipo: 'existente', turmaId: lida.turmaId }
```

O nome do banco sai da assinatura: o nome trocado à mão entre o (2) e o (3) passa despercebido.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o nome do não aprovado trocado à mão
-const alvoDe = (alvo: Alvo | undefined) => (alvo === undefined ? null : [alvo.tipo, alvo.id, alvo.tipo === 'lista' ? alvo.estado : null, alvo.nome, alvo.turmaId])
+const alvoDe = (alvo: Alvo | undefined) => (alvo === undefined ? null : [alvo.tipo, alvo.id, alvo.tipo === 'lista' ? alvo.estado : null, alvo.turmaId])
```

O nome do banco sai da assinatura: o nome do aprovado trocado à mão entre o (2) e o (3) passa despercebido.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o aprovado desativado ou com o nome trocado
-const alvoDe = (alvo: Alvo | undefined) => (alvo === undefined ? null : [alvo.tipo, alvo.id, alvo.tipo === 'lista' ? alvo.estado : null, alvo.nome, alvo.turmaId])
+const alvoDe = (alvo: Alvo | undefined) => (alvo === undefined ? null : [alvo.tipo, alvo.id, alvo.tipo === 'lista' ? alvo.estado : null, alvo.turmaId])
```

O aprovado deixa de ser o alvo da matrícula.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › nome corrigido: o do aprovado vai ao
-if (aprovado !== undefined) return { tipo: 'usuario', id: aprovado.usuarioId, nome: aprovado.nome, turmaId: aprovado.turmaId }
```

O nome ainda não aprovado deixa de ser o alvo da matrícula.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › nome corrigido: o do aprovado vai ao
-return nao === undefined ? undefined : { tipo: 'lista', id: nao.id, estado: nao.estado, nome: nao.nome, turmaId: nao.turmaId }
+return undefined
```

A matrícula de outra turma deixa de ser "muda de turma".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim
-if (destino.tipo !== 'existente' || destino.turmaId !== alvo.turmaId) return 'muda_de_turma'
```

A turma nova para a matrícula que a escola já tem deixa de ser "muda de turma".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a matrícula de outra turma é "muda de turma"
-if (destino.tipo !== 'existente' || destino.turmaId !== alvo.turmaId) return 'muda_de_turma'
+if (destino.tipo !== 'existente' && destino.turmaId !== alvo.turmaId) return 'muda_de_turma'
```

O nome diferente deixa de ser "nome corrigido".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a mesma matrícula na mesma turma é "já existe"
-return nome === alvo.nome ? 'ja_existe' : 'nome_corrigido'
+return 'ja_existe'
```

O candidato a transferir passa a ser o que "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a matrícula de outra turma é "muda de turma"
-resultado === 'muda_de_turma' && alvo !== undefined ? [{ id: alvo.id, acao: 'transferir', rotulo: rotulo(alvo.nome, matricula), turmaId: alvo.turmaId }] : [],
+resultado === 'ja_existe' && alvo !== undefined ? [{ id: alvo.id, acao: 'transferir', rotulo: rotulo(alvo.nome, matricula), turmaId: alvo.turmaId }] : [],
```

Nenhuma turma é citada pela planilha: ninguém é candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › quem é da turma que a planilha cita
-const citadas = new Set(linhas.flatMap(({ destino }) => (destino?.tipo === 'existente' ? [destino.turmaId] : [])))
+const citadas = new Set<string>()
```

O não aprovado que está na planilha passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › quem é da turma que a planilha cita
-citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
+citadas.has(turmaId) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
```

O não aprovado de turma que a planilha não cita (ambígua ou com erro) passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma ambígua ou com erro não oferece
-citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
+!matriculasDaPlanilha.has(matricula) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
```

O aprovado que está na planilha passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › quem é da turma que a planilha cita
-citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
+citadas.has(turmaId) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
```

O aprovado de turma que a planilha não cita passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma ambígua ou com erro não oferece
-citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
+!matriculasDaPlanilha.has(matricula) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId }] : [],
```

A matrícula com alvo deixa de ser classificada pelo alvo.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a mesma matrícula na mesma turma é "já existe"
-if (alvo !== undefined) return { linha, resultado: resultadoComAlvo(destino, alvo, nome), destino, alvo, nome, matricula }
```

O resumo passa a trazer `nomes_corrigidos` mesmo sem correção.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › a mesma lista duas vezes é tudo
-const resumo = { entram: quantas('entra'), ja_existem: quantas('ja_existe'), ...(corrigidos > 0 ? { nomes_corrigidos: corrigidos } : {}), turmas_novas: novas.length }
+const resumo = { entram: quantas('entra'), ja_existem: quantas('ja_existe'), nomes_corrigidos: corrigidos, turmas_novas: novas.length }
```

Nenhum nome é corrigido na gravação.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o nome do não aprovado que a escrita não achou
-const corrigidas = linhas.flatMap(({ alvo, nome, resultado }) => (resultado === 'nome_corrigido' && alvo !== undefined ? [{ alvo, nome }] : []))
+const corrigidas = linhas.flatMap(({ alvo, nome, resultado }) => (false ? [{ alvo, nome }] : []))
```

O nome do não aprovado vai para o `usuario` na gravação.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › nome corrigido: o do aprovado vai ao
-const daLista = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'lista' ? [{ id: alvo.id, estadoLido: alvo.estado, nome }] : []))
+const daLista = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'usuario' ? [{ id: alvo.id, estadoLido: alvo.estado, nome }] : []))
```

O nome do aprovado vai para a `lista_nome` na gravação.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › nome corrigido: o do aprovado vai ao
-const dosAlunos = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'usuario' ? [{ usuarioId: alvo.id, nomeLido: alvo.nome, nome }] : []))
+const dosAlunos = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'lista' ? [{ usuarioId: alvo.id, nomeLido: alvo.nome, nome }] : []))
```

A correção do nome na lista que mudou menos linhas que o pedido deixa de ser diferença.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o nome do não aprovado que a escrita não achou
-if ((await gravacao.corrigirNomesNaLista(anoLetivoId, daLista)) !== daLista.length) throw new DiferencaNaPlanilhaError()
+await gravacao.corrigirNomesNaLista(anoLetivoId, daLista)
```

A correção do nome do aluno que mudou menos linhas que o pedido deixa de ser diferença.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o nome do aprovado que a escrita não achou
-if ((await gravacao.corrigirNomesDosAlunos(dosAlunos)) !== dosAlunos.length) throw new DiferencaNaPlanilhaError()
+await gravacao.corrigirNomesDosAlunos(dosAlunos)
```

A linha sem classificação deixa de ser `linha_incompleta`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o erro da linha vem na ordem em que a coordenação
-if (classificada === undefined) return { linha, resultado: 'erro', erro: 'linha_incompleta' }
```

O erro da linha deixa de aparecer na prévia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o erro da linha vem na ordem em que a coordenação
-if (classificada.erro !== undefined) return { linha, resultado: 'erro', erro: classificada.erro }
```

A contagem das leituras por turma deixa de partir do zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › a prévia que mostra nome do banco
-for (const { turmaId } of classificacao.candidatos) porTurma.set(turmaId, (porTurma.get(turmaId) ?? 0) + 1)
+for (const { turmaId } of classificacao.candidatos) porTurma.set(turmaId, porTurma.get(turmaId) + 1)
```

A prévia da lista da turma de outra escola, de outro ano ou inexistente deixa de ser `NAO_ENCONTRADO`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/lista.int.test.ts › a turma da escola B, a de um id sorteado
-if (!turmas.some((turma) => turma.id === turmaId)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O usuário cujo nome muda deixa de ser travado antes das turmas.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › trava, nesta ordem
-await repositorio.travarUsuarios(antes.linhas.flatMap(({ resultado, alvo }) => (resultado === 'nome_corrigido' && alvo?.tipo === 'usuario' ? [alvo.id] : [])))
+await repositorio.travarUsuarios([])
```

O nome reivindicado e aprovado dentro da janela da escrita passa a receber a correção (a importação sai `falhou` pelo check, e não `desatualizada`).

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/decisao.int.test.ts › o nome reivindicado e aprovado entre a releitura e a escrita
-where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado and l.estado <> 'aprovado'
+where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id
```

O nome só reivindicado dentro da janela da escrita passa a receber a correção (a importação sai `concluida`).

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/decisao.int.test.ts › o nome reivindicado entre a releitura e a escrita
-where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado and l.estado <> 'aprovado'
+where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado <> 'aprovado'
```

A prévia da lista deixa de ter o limite por usuário.

```mutacao
arquivo: apps/api/src/estrutura/lista/lista.controller.ts
teste: apps/api/test/lista.int.test.ts › 20 pedidos por minuto por usuário
 @Post('turmas/:id/lista/previa')
-@ImportacaoRateLimit()
 @RequirePermissao('lista_nome', 'previa')
```

O gravar da lista deixa de ter o limite por usuário.

```mutacao
arquivo: apps/api/src/estrutura/lista/lista.controller.ts
teste: apps/api/test/lista.int.test.ts › 20 pedidos por minuto por usuário
 @Post('turmas/:id/lista')
-@ImportacaoRateLimit()
 @RequirePermissao('lista_nome', 'gravar')
```

A prévia da lista deixa de ocupar a vaga da escola.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/lista.int.test.ts › duas vagas da escola ocupadas
-return this.comVaga(() => this.motor.previa('alunos', { texto }, { turmaId, linhas }))
+return this.motor.previa('alunos', { texto }, { turmaId, linhas })
```

O gravar da lista deixa de ocupar a vaga da escola.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/lista.int.test.ts › duas vagas da escola ocupadas
-return this.comVaga(async () => gravarPlanilhaResponseSchema.parse(await this.motor.gravar('alunos', { texto, marcas }, { turmaId, linhas })))
+return this.motor.gravar('alunos', { texto, marcas }, { turmaId, linhas }).then((resposta) => gravarPlanilhaResponseSchema.parse(resposta))
```

A soma dos nomes corrigidos por lote do `usuario` guarda só o último lote.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › mais nomes corrigidos do que cabem num lote
-corrigidos += mudados.rows.length
+corrigidos = mudados.rows.length
```

A soma dos nomes corrigidos por lote da lista guarda só o último lote.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › mais nomes corrigidos do que cabem num lote
-for (let inicio = 0; inicio < correcoes.length; inicio += TAMANHO_DO_LOTE) corrigidas += await lista.corrigirNomes(anoLetivoId, correcoes.slice(inicio, inicio + TAMANHO_DO_LOTE))
+for (let inicio = 0; inicio < correcoes.length; inicio += TAMANHO_DO_LOTE) corrigidas = await lista.corrigirNomes(anoLetivoId, correcoes.slice(inicio, inicio + TAMANHO_DO_LOTE))
```

A prévia da planilha de alunos deixa de auditar a leitura dos nomes do banco.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a prévia que mostra nome do banco
-await this.auditarLeituras(previa)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `corrigirNomesDosAlunos` faz UPDATE em `usuario` dentro do `ImportacaoRepository` | `TODO.md` (tarefa 8.0): muda de repository e de bloco; o escopo está provado |
| privacy-guardian (1ª) | `turma.alunos_lidos` diz quantos nomes por turma, não quais | `TODO.md`: linha para o dossiê de conformidade |
| privacy-guardian, infra-guardian, revisor-geral (1ª) | Schemas da resposta antiga da lista seguem exportados | `TODO.md`: a 13.0 os tira junto da tela |
| infra-guardian (1ª) | `or(...)` dos aprovados sem índice próprio | `TODO.md`: custo medido como limitado |
| conformidade-reviewer, revisor-geral (1ª) | Marcas desmarcadas na tela e marca sem efeito até a 9.0 e a 10.0 | `TODO.md`: uma linha para a 9.0, a 10.0 e a 13.0 |
| revisor-geral (1ª) | `alunos.ts` refaz a classificação no `travar` e no `planejar` | Recusada: o `infra-guardian` conferiu o passo (3) e a fila e aprovou |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 01:21:55 | 2026-11-04 01:22:50 | `conformidade-reviewer` | 1 | APROVADO | ae1b034d7db72f3f9 |
| 2026-11-04 01:21:35 | 2026-11-04 01:23:38 | `tenancy-guardian` | 1 | APROVADO | aaacdecb4fc8b320c |
| 2026-11-04 01:21:39 | 2026-11-04 01:23:38 | `privacy-guardian` | 1 | APROVADO | a94603ebdfc41b6b0 |
| 2026-11-04 01:21:43 | 2026-11-04 01:24:16 | `infra-guardian` | 1 | APROVADO | a8ef5af895c3a9e77 |
| 2026-11-04 01:21:51 | 2026-11-04 01:24:48 | `revisor-geral` | 1 | REPROVADO | a5243bc500af65f4b |
| 2026-11-04 01:21:47 | 2026-11-04 01:27:17 | `test-engineer` | 1 | REPROVADO | aaa08ee08d1f4ca56 |
| 2026-11-04 01:45:39 | 2026-11-04 01:46:15 | `revisor-geral` | 2 | APROVADO | a88bc2d9613c1c7d7 |
| 2026-11-04 01:45:57 | 2026-11-04 01:46:27 | `tenancy-guardian` | 2 | APROVADO | a0c318487af4bbb1e |
| 2026-11-04 01:46:12 | 2026-11-04 01:46:32 | `infra-guardian` | 2 | APROVADO | adaf80efc925888b1 |
| 2026-11-04 01:46:04 | 2026-11-04 01:46:34 | `privacy-guardian` | 2 | APROVADO | ab4ecd3fcc6155245 |
| 2026-11-04 01:46:19 | 2026-11-04 01:46:48 | `conformidade-reviewer` | 2 | APROVADO | ae4d485b6d9f87279 |
| 2026-11-04 01:45:50 | 2026-11-04 01:48:04 | `test-engineer` | 2 | APROVADO | ae26661b461f21bd6 |
