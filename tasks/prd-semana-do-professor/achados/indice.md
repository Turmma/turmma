# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-06 13:18:54 | `frontend-reviewer` | 1ª | APROVADO | `revisao-spec` | , para a seção 1.8 de `docs/interface.md` e para as tarefas: |
| 2026-11-06 13:19:51 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | O texto da aula chega à coordenação pelo arquivo do titular. Fica em Tech Spec, seção 2, linha `packages/core/src/titular/leitura-do-titular.ts \| alterado \|… |
| 2026-11-06 13:20:06 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Tech Spec seções 2 e 7 ("a entrada `aula`" no arquivo do titular): a versão não é declarada, e o padrão é entrar nas duas (leitura-do-titular.ts:40). Assim a… |
| 2026-11-06 13:20:55 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seção 5 "Gravar" e seção 7c "Corridas de concorrência". A corrida 2 só protege o ramo da alocação. O ramo do registro passado fora da grade confere… |
| 2026-11-06 13:21:16 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seções 2 e 7, linha "DTO de saída" ("o registro entra no arquivo do titular"): falta dizer em qual versão do arquivo o texto entra. |
| 2026-11-06 13:21:16 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Escola sem ano letivo em curso (seções 5 e 10). Nenhuma das duas rotas tem esse cenário. |
| 2026-11-06 13:25:20 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | packages/core/src/titular/leitura-do-titular.ts:29-33: na tarefa, acrescentar a `aula` à lista do critério 5 no comentário do cabeçalho, para a próxima tabela… |
| 2026-11-06 13:25:20 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5, "Gravar", e §7c, "Corridas": o `PUT` toma `pg_advisory_xact_lock` com a chave tirada só do `vinculoId` do corpo, antes de conferir que o vínculo… |
| 2026-11-06 13:25:46 | `privacy-guardian` | 2ª | APROVADO | `revisao-spec` | `classificacao.ts`: não existe chave de prazo fixo para "até a virada do ano" que sirva à `aula`; a `lista_de_nomes` tem esse prazo com outra descrição. §2 da… |
| 2026-11-06 13:27:22 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | A gravação não trava o ano em curso. (Tech Spec §5 "Gravar", §7c "Corridas", §3 "Sai na virada do ano"; `apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts… |
| 2026-11-06 13:27:38 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | `techspec.md` §5 "Gravar", `cenarios.md` G1: o "passado" do segundo ramo não tem cenário. |
| 2026-11-06 13:29:30 | `tenancy-guardian` | 3ª | REPROVADO | `revisao-spec` | cenarios.md:39 (R1, a parte da "trava presa"). Este cenário não falha se a ordem voltar a ser a antiga. |
| 2026-11-06 13:31:08 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | `cenarios.md:29` (G1) e `techspec.md:65-67`: o "passado" do segundo ramo continua sem cenário que o derrube. |
| 2026-11-06 13:31:27 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | da rodada 2 (o que foi conferido): |
| 2026-11-06 13:34:06 | `tenancy-guardian` | 4ª | APROVADO | `revisao-spec` | techspec.md §6, última linha: diz "Testes de isolamento: R1 a R6 … e J6". Citar também R1b e R7 pelo nome, já que R7 fica fora do intervalo "R1 a R6" lido ao… |
| 2026-11-06 13:36:20 | `infra-guardian` | 4ª | REPROVADO | `revisao-spec` | `tasks/prd-semana-do-professor/cenarios.md`, J16: o cenário não prova a correção do bloqueante 1. |
| 2026-11-06 13:36:47 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | `cenarios.md:65`: o J16 não força a ordem e não fica vermelho com o passo depois de `encerrarOsMarcados`. O deadlock só acontece numa ordem exata: |
| 2026-11-06 13:38:53 | `infra-guardian` | 5ª | APROVADO | `revisao-spec` | 3, abaixo |
| 2026-11-06 13:39:28 | `test-engineer` | 5ª | APROVADO | `revisao-spec` | Prazo do job no J11b e no J16 é de 1 s, não 2 s (`cenarios.md:61`, `:65`). O job espera a trava sob o `lock_timeout` de 1 s e o `statement_timeout` de 1,5 s do… |
| 2026-11-06 15:02:08 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | `docs/modelo-de-dados.md:275` chama a `Aula` de fonte do "seu dia e sua semana", "função do Assistente de ensino" (`docs/agentes.md`). Já `docs/lgpd.md`… |
| 2026-11-06 15:02:13 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | As cláusulas `t.escola_id` e `v.escola_id` do `select` da `aula` no arquivo do titular (`leitura-do-titular.ts:151`) não têm teste que as observe, porque os… |
| 2026-11-06 15:02:18 | `infra-guardian` | 1ª | APROVADO | `1_task` | O `delete` das aulas fica em `packages/core/src/estrutura/vinculo.repository.ts:362`. Ele roda dentro do request síncrono `POST /v1/anos-letivos/:id/encerrar`… |
| 2026-11-06 15:02:36 | `revisor-geral` | 1ª | APROVADO | `1_task` | `packages/core/src/db/schema/alocacao.ts:8-9`: o docblock ainda diz que "a `Aula` concreta da F2b aponta para ela". Isso agora é falso, porque o desenho tirou… |
| 2026-11-06 15:02:51 | `privacy-guardian` | 1ª | APROVADO | `1_task` | Pôr uma linha de `aula` no caso de eliminação do professor do worker (`apps/worker/test/eliminar-titular.int.test.ts:656`, F2 RF17). Hoje "a professora… |
| 2026-11-06 15:03:14 | `test-engineer` | 1ª | APROVADO | `1_task` | `tasks/prd-semana-do-professor/1_task.md:137`: a linha `--faltando: 1 linhas (3 blocos, 0 motivos)` é saída antiga colada no documento. O comando hoje não… |
| 2026-11-06 15:14:46 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | `apps/api/test/arquivo-do-titular.int.test.ts:626`: a comparação nova de `Object.keys(com)` com `Object.keys(sem)` repete o `expect(com).toEqual(sem)` da linha… |
| 2026-11-06 15:15:05 | `privacy-guardian` | 2ª | APROVADO | `1_task` | O `Object.keys(com)` em `arquivo-do-titular.int.test.ts:626` repete o que o `toEqual(sem)` da linha 623 já garante. Não prejudica, mas pode sair se quiserem… |
| 2026-11-06 15:15:11 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | nenhuma nova |
| 2026-11-06 15:15:48 | `revisor-geral` | 2ª | APROVADO | `1_task` | `apps/api/test/arquivo-do-titular.int.test.ts:626`: a asserção que substituiu a antiga, `expect(Object.keys(com).sort()).toEqual(Object.keys(sem).sort())`, não… |
| 2026-11-06 15:15:49 | `infra-guardian` | 2ª | APROVADO | `1_task` | `apps/api/test/arquivo-do-titular.int.test.ts:625`: a nova comparação de chaves repete o `expect(com).toEqual(sem)` duas linhas acima, que já prova a mesma… |
| 2026-11-06 15:15:49 | `test-engineer` | 2ª | APROVADO | `1_task` | `arquivo-do-titular.int.test.ts:626`: comparar as chaves não acrescenta nada ao `toEqual(sem)` da linha 623, porque um corpo JSON não tem chave com valor… |
| 2026-11-06 15:49:58 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | `semana.repository.ts:91`: tirar a cláusula de escola de `vinculosDaProfessora` não deixa nenhum teste vermelho, porque o usuário da sessão já é único entre… |
| 2026-11-06 15:50:10 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | Na 3.0, o rótulo `correcao: 'Correção do Assistente'` (`packages/shared/src/semana/semana.ts:110`) precisa aparecer na tela com o selo de saída de IA (D58).… |
| 2026-11-06 15:50:16 | `privacy-guardian` | 1ª | APROVADO | `2_task` | Incluir a sessão de rede no laço do R7 (`apps/api/test/semana.int.test.ts:501`). Hoje a recusa da rede só é provada pela matriz, não pela rota. |
| 2026-11-06 15:50:20 | `infra-guardian` | 1ª | APROVADO | `2_task` | Em `apps/api/src/semana/semana.service.ts:36`, o `Promise.all` roda cinco consultas no `Database` (o pool, não uma transação). Cada request pode ocupar até… |
| 2026-11-06 15:50:32 | `revisor-geral` | 1ª | APROVADO | `2_task` | `docs/glossario.md:115-117`: o verbete "Semana (do professor)" diz que sábado e domingo aparecem "só quando a grade tem aula neles". Falta o caso do registro… |
| 2026-11-06 15:51:54 | `test-engineer` | 1ª | APROVADO | `2_task` | Motivo (1) das Mutações, `eq(vinculo.escolaId, …)` em `semana.repository.ts:91`. A frase "nenhuma linha muda" só vale para contexto coerente. O que garante a… |
| 2026-11-06 16:05:17 | `tenancy-guardian` | 2ª | APROVADO | `2_task` | O `if (typeof anoLetivoId !== 'string')` de `anoEmCurso` (`semana.repository.ts:73`) continua sem teste que o prove. Já está registrado como motivo (1) nas… |
| 2026-11-06 16:05:22 | `privacy-guardian` | 2ª | APROVADO | `2_task` | Continuam valendo as duas recomendações da rodada anterior, já registradas em `tasks/prd-semana-do-professor/2_task.md`: |
| 2026-11-06 16:05:35 | `conformidade-reviewer` | 2ª | APROVADO | `2_task` | Tarefas 3.0 e 8.0: o rótulo "Correção do Assistente" aparece na tela com o selo de saída de IA (D58). Quem clica nele chega à revisão do lote (D56), e não a… |
| 2026-11-06 16:05:36 | `revisor-geral` | 2ª | APROVADO | `2_task` | `tasks/prd-semana-do-professor/2_task.md:767`: a linha do `tenancy-guardian` em "Recomendações sem aplicar" ainda diz "motivo (3) das Mutações". Com a… |
| 2026-11-06 16:05:42 | `infra-guardian` | 2ª | APROVADO | `2_task` | As duas recomendações da minha 1ª rodada não estão no `TODO.md`, embora o `2_task.md` diga que foram para lá. A primeira é incluir `GET /v1/semana` como passo… |
| 2026-11-06 16:05:49 | `test-engineer` | 2ª | APROVADO | `2_task` | Em `tasks/prd-semana-do-professor/2_task.md`, a linha do `tenancy-guardian` na tabela "Recomendações sem aplicar" diz "já está no motivo (3) das Mutações". Com… |
| 2026-11-06 20:42:44 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | `semana.repository.ts`, `itensDaSemana` e `consultasDosItens`: o `anoLetivoId` chega por argumento. Hoje a origem dele é segura, e o caso R2 prova que um ano… |
| 2026-11-06 20:42:53 | `conformidade-reviewer` | 1ª | APROVADO | `3_task` | Tarefa 8.0 (tela): o item "Correção do Assistente · Para revisar" deve levar à tela de revisão do lote. Lá ficam os fora da curva abertos antes (D33) e o… |
| 2026-11-06 20:43:09 | `privacy-guardian` | 1ª | APROVADO | `3_task` | O comentário de `aula` em `packages/shared/src/permissao/matriz.ts:109-113` diz alcance `proprio`. Com a 3.0, o `GET /v1/semana` passa a trazer também a… |
| 2026-11-06 20:43:10 | `infra-guardian` | 1ª | APROVADO | `3_task` | `packages/core/src/semana/semana.repository.ts:67` (`diaNoFuso` aplicado em `naSemana`): o filtro da semana passa `to_char(... at time zone ...)` em cada linha… |
| 2026-11-06 20:43:11 | `revisor-geral` | 1ª | APROVADO | `3_task` | Ordem dos itens e dia fora da semana fora do `cenarios.md`. A ordem no dia (aplicada, encerrada, correção, depois título e atividade) e a regra "o dia que a… |
| 2026-11-06 20:44:26 | `test-engineer` | 1ª | APROVADO | `3_task` | Duas disciplinas confirmadas na mesma turma. Hoje esse caso só é provado pelo lado negativo (Física confirmada e Química pendente). Falta o lado positivo: a… |
| 2026-11-06 21:19:24 | `revisor-geral` | 2ª | APROVADO | `3_task` | O `3_task.md`, em "Recomendações sem aplicar", manda quatro itens para o `TODO.md`: |
| 2026-11-06 21:19:27 | `test-engineer` | 2ª | APROVADO | `3_task` | A linha nova da tabela em `tasks/prd-semana-do-professor/3_task.md:41` justifica o caso por "`exists` e não `join`". O caso não separa as duas formas. Um… |
