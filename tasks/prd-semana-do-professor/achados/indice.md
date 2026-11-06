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
