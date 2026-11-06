# Achados das revisões — `tasks/prd-onboarding-por-convite/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-05 11:27:50 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 12.0 não grava em `Nota`, não lê `Nota` e não chama `lancadaPor`. Ela escreve em três lugares: em `alocacao`, ao apagar as aulas que a planilha não traz (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/alocacao.repository.ts`, `apagar`); em `vinculo`, ao encerrar o que foi marcado como "sai da grade" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts`, `encerrarProfessoresDaGrade`); e em `acesso_turma`, ao revogar o acesso de quem saiu. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A tarefa não envolve aluno nem IA. A reimportação não encerra vínculo de professor por conta própria. Ela mostra o vínculo como candidato, e só o que a coordenação marca é encerrado. O motor recusa marca que não esteja na lista de candidatos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:99-101`). Cada vínculo encerrado e cada acesso revogado ficam na auditoria (`vinculo.encerrado` e `acesso_turma.revogado`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.ts`, `encerrarOsMarcados`).

Aprovação registrada: ok. Nenhuma saída de IA passa por esta tarefa.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. A tarefa não muda nenhum agente, e a célula `time` da matriz ficou como estava.

Medir o professor (item 8 e D64): ok. `GET /v1/grade` lê por turma e não tem leitura por professor. Isso está escrito em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/grade.repository.ts:63` e na matriz (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/permissao/matriz.ts`, recurso `grade`). A resposta traz só o id e o nome do professor, sem e-mail e sem nenhuma métrica, contagem ou ordenação por professor. A tarefa não cria indicador de adoção, ranking nem nada que alimente decisão sobre o professor.

Supervisão não é vigilância (item 7): ok. A tarefa não mede tempo ocioso, navegação nem comportamento de ninguém.

D46 e D55: não se aplicam, porque a tarefa não envolve discursiva nem redação.

`docs/regulacao.md`: a tarefa não alterou o arquivo, e nada nela pede mudança nele.

Bloqueantes: nenhum.

Recomendações:
- O texto que justifica a leitura só por turma ("a grade é da turma, e não a medida de quem a dá") está no repository e na matriz. Falta um teste que impeça alguém de criar mais tarde um `GET /v1/grade?professorId=`. Hoje quem impede é o `strictObject` do `gradeQuerySchema`, e vale um caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/grade.int.test.ts` que mande `professorId` e espere `ENTRADA_INVALIDA`, citando o item 8 da regra 70.
- A sala é texto livre e pode acabar com o nome de uma pessoa ("Sala da Prof. Ana"). O cuidado já está registrado em `docs/lgpd.md` e passa para a tarefa 14.0. Isso é da regra 20; anoto aqui só para a retro.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-05 11:27:57 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. Conferi como a tarefa usa `alocacao` e `vinculo`. As duas têm `escola_id` e `ano_letivo_id`, e a FK composta `(escolaId, anoLetivoId, vinculoId)` prende a aula ao vínculo da mesma escola e do mesmo ano. Os ids são UUID: `gradeQuerySchema` usa `z.uuid()` e o teste recusa `?turmaId=1837`.

Queries verificadas:
- `packages/core/src/importacao/grade.repository.ts`:
  - `turmaExiste`: filtra por escola do contexto, ano e id.
  - `aulasDaTurma`: filtra a alocação por escola e ano, e os joins de `vinculo` e `usuario` também exigem a escola. Não lê e-mail.
  - `professorTemVinculoConfirmadoNaTurma`: o usuário vem de `requestSessao()` e o estado precisa ser `confirmado`.
- `packages/core/src/importacao/alocacao.repository.ts` `apagar`: filtra por escola, ano e `inArray` de ids.
- `packages/core/src/estrutura/vinculo.repository.ts`:
  - `encerrarProfessoresDaGrade`: o `select ... for update` filtra por escola, ano, papel `professor`, vínculo não encerrado e ids. O `update` filtra por escola, ano e só os ids que o `select` achou.
  - `professoresAbertosDoAno`: só ganhou a coluna `origem`, e o escopo não mudou.
- `ImportacaoRepository.apagarAulas` e `encerrarVinculosDeProfessorDaGrade`: chamam `requireEscolaId()` e trabalham em lotes.
- `apps/api/src/estrutura/grade/grade.service.ts`:
  - O `anoLetivoId` que vem do cliente passa por `anoDeDestino`, que filtra pela escola da sessão e aceita só o ano `planejado`.
  - O professor só lê o ano em curso, tirado do contexto, e um filtro de ano dele responde `NAO_ENCONTRADO`.
  - Nenhum `escolaId` vem do cliente: a consulta é estrita, e o teste prova `ENTRADA_INVALIDA` quando se manda `escolaId`.
- Marcas "sai da grade": no gravar, `motor.ts:99-101` confere cada marca contra os candidatos da prévia. A assinatura inclui os candidatos e as aulas que saem, então uma diferença na hora do job fecha a importação como `desatualizada`.
- Matriz de permissão: recurso `grade` com rede e aluno em `nunca`, então a camada de rede não alcança a grade. Nenhum `@Unscoped()` novo.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/grade.int.test.ts`:
- Linha 571: a turma da B, lida pela coordenação e pelo professor da A, dá a mesma resposta que um id inexistente, inclusive com o `anoLetivoId` da B. A reimportação da A não toca nas aulas nem nos vínculos da B.
- Linhas 417 e 437: `apagar` e `encerrar` com ids de outra escola, de outro ano, de vínculo de aluno ou de vínculo já encerrado não mudam nada.
- Linha 466: a leitura no repository não alcança turma de outra escola nem de outro ano.

Sem a cláusula de ano ou de id, esses testes quebram, como as mutações declaradas na tarefa confirmam. Pendente, inexistente, contestado e outra escola dão a mesma resposta, `NAO_ENCONTRADO` (linhas 507-531).

Bloqueantes: nenhum.

Recomendações:
- `grade.repository.ts:27`, `:54` e `:69`: tirar só o termo `escolaId` não faz teste nenhum falhar, porque o ano já é de uma escola só e o teste de isolamento é barrado antes pelo ano. A cláusula está lá e o escopo do ano já é conferido na escola, então não bloqueia. Para um teste pegar a remoção desse termo, seria preciso um caso com o ano da A e a turma da B no mesmo ano, o que o esquema não permite. Basta deixar registrado na retro que essa camada não tem teste, por desenho.
- `grade.int.test.ts:466`: o caso chama `bancoDoJob` direto no repository. Vale um comentário dizendo que esse papel tem acesso a todas as escolas e que o escopo vem só do `runInContext`, para ninguém achar que é o mesmo papel da API.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-05 11:28:09 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. Dois campos que já existiam passam a ser expostos ou usados:
- `usuario.nome` do professor sai na nova `GET /v1/grade`, dentro de `aulas[].professor { usuarioId, nome }`.
- `vinculo.origem` passa a ser lido para decidir quem é candidato a "sai da grade".

O `rotulo` do candidato (professor, turma e disciplina) só aparece na prévia para a coordenação. Não é gravado: em `importacao_planilha.marcas` ficam só ids.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Aula da grade" foi atualizada na mesma tarefa (`docs/lgpd.md:72`). Ela registra quem lê, que o colega aparece só com id e nome, que o e-mail nunca sai e que não há leitura por professor (regra 70, item 8). As marcas `encerrar` já estavam na linha "Planilha em gravação". Nenhum campo proibido para aluno: a grade não toca dado de aluno.

**Autorização por objeto:** ok. Fiz a troca de id na URL para cada papel:
- **Coordenação:** `turmaExiste` filtra por escola, ano e id (`packages/core/src/importacao/grade.repository.ts:24-31`). O `anoLetivoId` passa por `anoDeDestino`: aceita só o planejado da própria escola, e qualquer outro valor dá `NAO_ENCONTRADO`.
- **Professor:** precisa de vínculo `confirmado` dele, naquela turma, no ano em curso, lido a cada chamada (`grade.repository.ts:67-82`). Se mandar filtro de ano, a resposta é `NAO_ENCONTRADO` (`apps/api/src/estrutura/grade/grade.service.ts:22`).
- **Aluno e rede:** `nunca` na matriz, também com a resposta do inexistente.
- **Turma da escola B:** a coordenação e o professor da A recebem exatamente o erro da turma inexistente (`apps/api/test/grade.int.test.ts:571`). Vínculo pendente, contestado, encerrado ou ausente responde igual (`:507`, `:535`). O professor que sai da grade pela marca perde a leitura na hora (`:552`).
- **Escritas:** `apagar` e `encerrarProfessoresDaGrade` levam escola e ano na cláusula e só alcançam vínculo de professor aberto. Os testes `:417` e `:437` provam isso.

**DTO:** explícito. A resposta passa por `gradeResponseSchema.parse`, um contrato estrito sem e-mail. O `select` do repository nunca lê o e-mail. Três testes cobrem isso: `apps/api/test/contracts.test.ts` (o e-mail do colega é recusado em qualquer aula), `grade.int.test.ts:502` e `:525` (o corpo da resposta não tem `@`).

**Logs:** limpos. Os arquivos alterados não têm logger nem `console`. Os erros são `DomainException` tipado (`NAO_ENCONTRADO` ou `ENTRADA_INVALIDA`).

**Auditoria:** presente.
- Encerrar pela marca grava `vinculo.encerrado` com estado de antes, motivo `realocacao` e `origem: 'grade'`, sem nome nem e-mail.
- A revogação de acesso (alteração de permissão) grava `acesso_turma.revogado` (`packages/core/src/importacao/tipos/grade.ts:525-532`).
- O teste `grade.int.test.ts:316` confere a auditoria e a ausência de dado pessoal nela.
- A leitura da grade pela coordenação não é leitura de dado de aluno, então não exige auditoria.

**Envio externo:** nenhum. Esta tarefa não tem IA nem provedor.

**Seed/fixture:** sintético. Os e-mails usam `.invalid` com prefixo e UUID, e os nomes são genéricos ("Colega", "Ana", "Bruno").

**Ciclo de vida e fechamento:**
- A aula sai em cascata com o vínculo.
- O vínculo encerrado conta o prazo de `vinculo_encerrado`, que a escola configura.
- O arquivo do titular já inclui as aulas dos vínculos do professor.
- O encerramento pela grade fica rastreável por `vinculo.encerrado` com a origem.

Para um aluno específico, a tarefa não muda nada. Para o professor, o código continua respondendo o que guarda e quem lê.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Aula de colega com vínculo `contestado` mostra o nome dele. Em `packages/core/src/importacao/grade.repository.ts:55`, o `aulasDaTurma` só exclui o vínculo `encerrado`. Assim, o professor que contestou ("essa turma não é minha") continua aparecendo com o nome para os colegas confirmados. O risco é baixo: é dado interno de funcionário, definido pela escola. Ainda assim, vale escolher entre duas saídas:
   - omitir o nome (mantendo o id) na leitura do papel professor quando o vínculo é `contestado`;
   - ou registrar essa escolha na linha "Aula da grade" de `docs/lgpd.md`.
2. Quando a tela da 14.0 mostrar os candidatos com o `rotulo`, conferir que o rótulo não vai para log nem telemetria do frontend.

Não houve fotos de tela nesta tarefa. A tela fica para a 14.0.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-05 11:28:22 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (o job de importação da grade, na fila de lote que veio da 11.0). O `GET /v1/grade` é leitura de coordenação e professor, fora do caminho do aluno.
Rate limit: ok. A rota nova passa pelo `RateLimitGuard` global, que limita por `sub` e `esc` do token (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/app.module.ts:145-150`). Não há `@SkipThrottle` e não há limite por IP.
Fila e prioridade: ok. Apagar as aulas que saem e encerrar os vínculos marcados roda dentro do `aplicar` do job, em lotes de `TAMANHO_DO_LOTE`. Nada disso entrou no request. O que a prévia ganhou em request é cálculo em memória sobre dados que ela já lia (`saidasDe`), dentro do teto que a planilha já tinha.
Concorrência: protegida.
- As travas seguem a ordem global usuários → contas → turmas → vínculo. Os vínculos são lidos com `FOR UPDATE`, em ordem de id. O `encerrar` da API (turma → vínculo) e o confirmar ou contestar do professor (usuário → vínculo) seguem a mesma ordem.
- Se um vínculo for encerrado à mão, ou uma aula sumir, entre o gravar e o job, a assinatura já não confere, ou a contagem fica menor que o plano (`encerrados.length !== ids.length`, e a conferência de `apagarAulas`). Nos dois casos sai `DiferencaNaPlanilhaError` e a transação é desfeita.
- No gravar, toda marca precisa estar entre os candidatos (`motor.ts:99-101`), e a assinatura inclui os candidatos.
Índice e paginação: ok.
- A leitura da grade usa `vinculo_turma_idx (escola_id, ano_letivo_id, turma_id, estado)` e, para chegar às aulas, o único `(vinculo_id, dia_semana, inicio)`.
- `apagar` e `encerrarProfessoresDaGrade` levam escola e ano na cláusula e filtram por id.
- A resposta é a grade de uma turma, que tem dezenas de linhas, então dispensa paginação.
Degradação de IA: não se aplica.
Migration: não se aplica. Não há migration nova; os índices usados já existiam.
Métrica e alerta: ok. A rota é medida pelo interceptor global de HTTP e o job pelas métricas do motor. Não há alerta novo.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/grade.int.test.ts:371`: a corrida está provada por intercalação em sequência (encerrar à mão e só depois rodar o job). Falta um caso com as duas transações abertas ao mesmo tempo: o professor confirma ou contesta o vínculo marcado durante o passo (3) do job. A prova seria que a decisão dele espera a trava e encontra o vínculo já `encerrado`, sem deadlock. O próprio plano registra que a corrida com `WriteBlockTrigger` ficou de fora, mas as travas cresceram em relação à 11.0 (o usuário e a turma de cada vínculo marcado).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.ts`, em `encerrarOsMarcados`: `revogarDeQuemSaiu` faz uma consulta por vínculo marcado. Hoje o número de consultas fica limitado pelos candidatos. Se a coordenação passar a marcar dezenas de vínculos numa virada de ano, vale fazer em lote.
- `cenarios.md` e o teste de carga: a reimportação não está no cenário de carga. Sem impacto agora, porque roda em lote e não no horário letivo. Fica para a validação confirmar que a janela do despachante cobre o tipo `grade`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-05 11:28:59 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As quatro subtarefas da 12.0 estão feitas:
- A reimportação apaga a aula que a planilha não traz e mantém o id da que continua, por (vínculo, dia, início).
- O vínculo que perdeu as aulas aparece "sai da grade" e só encerra marcado, pelo mesmo caminho do `encerrar`, com auditoria e revogação do acesso.
- `GET /v1/grade` funciona para a coordenação e para o professor com vínculo `confirmado` na turma.
- O `docs/modelo-de-dados.md` foi conferido.

Não há código da tela (14.0) nem da `Aula` concreta (F2b). A marca é conferida contra os candidatos no gravar (`packages/core/src/importacao/motor.ts:99-101`). Se o candidato muda entre o gravar e o job, a assinatura muda e a importação sai `desatualizada`. A regra nova está em `techspec.md` §5 ("Grade") e em `cenarios.md` RF9.

Recomendações:
- **`techspec.md` §4, paginação:** registrar que `GET /v1/grade` não é paginado e por quê, como já está escrito para o `GET /v1/calendario`. A grade de uma turma é limitada pelas 3.000 linhas da planilha do ano. Sem essa linha, a regra 80, item 8 ("listagem é paginada") fica sem resposta escrita. A decisão é do `infra-guardian`.
- **`tasks/prd-onboarding-por-convite/12_task.md:110` e `:112`, tabela de divergências:** as linhas 1 e 3 não são divergências da Tech Spec. O §2 da `techspec.md` (linha 25) já põe os contratos em `packages/shared/src/importacao/`, e a matriz é só o jeito de implementar o papel que o §4 descreve. Mesmo assim, a coluna "Onde está" aponta para o §4, que não fala de nenhuma das duas. Corrija a coluna ou tire as linhas, para que o `divergencias.ts` e quem audita depois não procurem o que não está lá.
- **`12_task.md:19`:** o contexto diz que o `GET /v1/calendario` está no "mesmo controller". O código usa um `GradeController` separado (`apps/api/src/estrutura/grade/grade.controller.ts`), como a tabela de arquivos previstos pede. Alinhe o texto.
- **`packages/core/src/estrutura/vinculo.repository.ts:295-315`:** o `encerrarProfessoresDaGrade` repete o mesmo trecho de `encerrarVinculosDaPessoa` (`packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:99-117`): lê com `FOR UPDATE` em ordem de id, faz o `update` e devolve o estado de antes. Se aparecer um terceiro encerramento em lote, vale juntar os dois num helper só.
- **`packages/core/src/importacao/grade.repository.ts:83-103`:** a aula de vínculo `pendente` ou `contestado` aparece na grade lida. O comentário justifica a escolha, mas a Tech Spec não fala disso. Vale uma frase no §4 para a 14.0 não decidir de novo.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-05 11:30:19 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** reimportar mantém o id da aula por (vínculo, dia, início), e coordenação e professor confirmado leem a grade por turma.
- **Bordas:** um vínculo com duas aulas, uma fica e a outra sai. O vínculo da grade e o feito à mão, os dois sem aula. Planilha com erro de linha. Virada de ano (grade e calendário do planejado). Duas escolas com a mesma tripla. Vínculo encerrado numa turma e confirmado em outra. Professor que dá duas disciplinas na mesma turma.
- **Permissão:** professor com vínculo pendente, contestado ou sem vínculo. Aluno. Professor com filtro de ano.
- **Isolamento:** grade da B lida pela coordenação e pelo professor da A. Ano de outra escola no filtro. `apagar` e `encerrar` no repository com escola e ano.
- **Concorrência:** a marca "sai da grade" encerra o vínculo no job ao mesmo tempo em que o professor gera acesso na turma, confirma o vínculo ou a coordenação o encerra à mão.

**Cobertos:** rodei `grade.int.test.ts` (20 de 20 verdes), `grade.test.ts`, `contracts.test.ts` e `matriz.test.ts` (71 de 71 verdes). As 13 linhas da tabela de testes têm o teste citado pelo nome, e cada um tem asserção sobre o resultado: id da aula, estado e motivo do vínculo, `revogado_em`, auditoria sem nome nem e-mail, corpo sem `@`, 404 igual ao inexistente. O `--faltando` deixa 5 linhas sem bloco, e todas têm motivo escrito. Não há `.skip`. Os mocks de `CicloDeVidaRepository` e `AuditoriaRecorder` no teste de unidade não escondem a regra, porque a integração prova a revogação e a auditoria de verdade. A tarefa não tem IA.

**Bloqueantes:**
1. **O "sai da grade" pela planilha não tem nenhum teste de concorrência de verdade (duas chamadas em paralelo).** O que existe:
   - Em `apps/api/test/grade.int.test.ts:371` o caso "encerrado à mão entre o gravar e o job" é em sequência e só prova a assinatura.
   - Em `packages/core/src/importacao/tipos/grade.test.ts`, "a trava trava também o professor e a turma…", só confere a lista de chamadas de um repositório falso.
   - O `.for('update')` novo em `packages/core/src/estrutura/vinculo.repository.ts:308` não tem bloco de mutação nem caso que o prove.

   A autoconferência 10 da tarefa diz que as travas "são as mesmas da 11.0", e não são: a tarefa trava também a turma e o professor de cada vínculo marcado, e acrescenta o `FOR UPDATE` no vínculo.

   Esse é o caminho em que um acesso sobrevive ao vínculo, o caso que a correção 2026-10-03 fechou. Todo outro caminho que encerra vínculo de professor tem os dois [P] contra o gerar, nas duas ordens (`apps/api/test/acesso-fim-do-vinculo.int.test.ts:381`, `:401`, `:423`, `:486`). Sem a trava da turma do marcado, o gerar lê o vínculo ainda confirmado, grava o acesso depois do `revogarDeQuemSaiu` do job, e o acesso fica vigente para quem saiu da turma.

   **Correção exigida:** em `grade.int.test.ts`, com `WriteBlockTrigger`, seguindo o molde citado:
   - (a) O gerar parado depois do insert em `acesso_turma`, contra o job com a marca: o job espera a turma e revoga o acesso que acabou de nascer.
   - (b) O job parado com a turma travada (gatilho em `alocacao` ou na escrita do vínculo), contra o gerar: o gerar espera, reconfere o vínculo e sai `NAO_ENCONTRADO`, sem acesso vigente.
   - (c) O job contra o confirmar do professor no vínculo marcado: zero `40P01`, e o vínculo termina `encerrado`.

   Depois, um bloco de mutação que tire a turma do marcado do `travar` e o `.for('update')` do `encerrarProfessoresDaGrade`, citando esses casos.

**Recomendações:**
- O cabeçalho da seção "Mutações" (`12_task.md:116`) diz "25 linhas"; o `--faltando` atual dá 5.
- O motivo (4) não cita o termo `eq(vinculo.papel, 'professor')` de `grade.repository.ts:73`. Escrever por que ele fica sem bloco.
- Professor com duas disciplinas na mesma turma pelo caminho da grade: marcar a Física dele deve manter o acesso que a Química confirmada segura. Hoje isso só está provado no `encerrar` da API (`acesso-fim-do-vinculo.int.test.ts:131`).
- Marca com o id de um vínculo da escola B no `POST /v1/importacoes/grade` da A deve dar `ENTRADA_INVALIDA`. Hoje o isolamento das marcas só está provado no repository.
- Turma sem professor alocado: a coordenação recebe 200 com `aulas: []`. Hoje isso só está provado no repository.
- A resposta 404 do papel `rede` em `GET /v1/grade` está provada só na matriz; caberia um caso de integração.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/12_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/grade.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/acesso-fim-do-vinculo.int.test.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-05 11:49:04 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada, a diferença desde a 1ª é só de testes e de documentos. O código de produção não mudou. Conferi três coisas:
- **Corridas exigidas pelo `test-engineer`.** Os casos (a), (b) e (c) estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/grade.int.test.ts`, com `WriteBlockTrigger` e `esperarNaTrava`. Os blocos de mutação novos apontam para as linhas certas: `vinculo.repository.ts:308` (`.for('update')`) e `tipos/grade.ts:586` (a turma do marcado no `travar`).
- **Recomendações da 1ª rodada.** O `12_task.md` foi corrigido em quatro pontos: o contexto agora fala em `GradeController` próprio, a coluna "Onde está" das divergências foi corrigida, o cabeçalho de mutações diz 5 linhas e o motivo (4) agora cobre o `eq(vinculo.papel)`. A `techspec.md` §4 ganhou duas frases: por que `GET /v1/grade` não é paginado e por que a aula de vínculo `pendente`/`contestado` aparece na leitura. O `docs/lgpd.md` registra essa mesma escolha.
- **Casos novos de integração.** Entraram quatro: a marca da escola B no gravar da A, as duas disciplinas na mesma turma, a turma sem aula, e `professorId` na consulta dando `ENTRADA_INVALIDA`. Nenhum deles invade a 14.0 nem a F2b.

Recomendações:
- A `techspec.md` §4 passou a dizer que a aula de colega com vínculo `pendente` ou `contestado` aparece na grade, com o nome dele, e que só o `encerrado` a tira. O `cenarios.md` não tem um cenário com esse comportamento. Hoje o mais próximo é a linha 182, que trata do leitor pendente e não da aula do colega. Vale um `[I]` positivo, para que a 14.0 e a validação tenham onde conferir.
- O `quando` do `WriteBlockTrigger` monta o SQL com o id interpolado (`grade.int.test.ts`, nos casos de corrida). É só teste e o id é UUID gerado ali, então não bloqueia. Se o `WriteBlockTrigger` aceitar parâmetro, seria melhor usá-lo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-05 11:50:09 · `tasks/prd-onboarding-por-convite/12_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da 1ª rodada, mais as três corridas do item 1 da ordem: (a) o gerar parado depois do insert contra o job com a marca; (b) o job parado com a turma travada contra o gerar; (c) o job contra o confirmar do professor no vínculo marcado, sem `40P01`. E os blocos de mutação para a turma do marcado no `travar` e para o `.for('update')` de `encerrarProfessoresDaGrade`.

Cobertos:
- **(a)** `apps/api/test/grade.int.test.ts` › "o gerar parado depois do insert: o job com a marca espera a turma e revoga o acesso que acabou de nascer". O gatilho fica no insert em `acesso_turma`. O teste espera o job ficar parado em `"turma" … for no key update` antes de soltar o gerar, e confere o resultado: importação `concluida`, vínculo `encerrado`, nenhum acesso vigente e uma auditoria `acesso_turma.revogado`. Sem a turma do marcado no `travar`, só a 8ºA é travada. O job não espera, o `revogarDeQuemSaiu` não enxerga o acesso que ainda não foi gravado, e o acesso fica. O teste fica vermelho pelo motivo certo.
- **(b)** "o job parado com a turma travada: o gerar espera, reconfere o vínculo e sai NAO_ENCONTRADO". O gatilho fica no update do vínculo para `encerrado`, e o teste espera o gerar parado em `"turma" … for share`. Sem a trava da turma, o `travarComVinculoDoProfessor` não espera e o gerar sai 201. O teste falha na espera da trava e no `NAO_ENCONTRADO`.
- **(c)** "o job contra o confirmar do professor no vínculo marcado". O gatilho para o confirmar depois do update, ainda segurando a linha. O teste espera o job parado em `from "vinculo" … for update` e confere: confirmar 200, importação `concluida`, vínculo `encerrado`, e o `antes` da auditoria `vinculo.encerrado` igual a `{ estado: 'confirmado' }`. Sem o `.for('update')`, o job leria `pendente`, o `update` sem filtro de estado encerraria do mesmo jeito, e o `antes` sairia `pendente`. A asserção pega isso. Não há deadlock porque o `#decidir` (`apps/api/src/estrutura/vinculo/vinculo.service.ts:143`) não trava a turma: a ordem é turma e depois vínculo, sem ciclo. Se houvesse `40P01`, o 200 ou o `concluida` falhariam.
- **Blocos de mutação**: estão em `tasks/prd-onboarding-por-convite/12_task.md`. O `.for('update')` (vinculo.repository.ts:308) cita o caso (c). A turma do marcado no `travar` (grade.ts:586) tem dois blocos, um para (a) e outro para (b). O usuário do marcado no `travar` continua com o bloco de unidade de `grade.test.ts`.
- **Casos novos fora da ordem**:
  - a marca com o id de um vínculo da escola B, que dá `ENTRADA_INVALIDA` sem mudar nada nas duas escolas;
  - o professor com duas disciplinas na mesma turma, em que a Química confirmada segura o acesso e marcar depois a Química o revoga;
  - a turma sem professor alocado, que dá 200 com `aulas: []`;
  - o `professorId` como parâmetro, que dá `ENTRADA_INVALIDA`.

  Todos afirmam resultado.
- Rodei `npx vitest run apps/api/test/grade.int.test.ts`: 26 de 26 passaram. Os testes não dependem de a máquina estar folgada: a espera é por `pg_stat_activity` (`wait_event_type = 'Lock'`), não por tempo.
- Não há `.skip`, nem mock que esconda a trava, nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações:
1. No caso (b), o `acessosVigentes(...) == []` do fim também passaria com a mutação, porque o job retomado revoga o acesso que o gerar gravou. Quem prova a regra ali são a espera da trava e o `NAO_ENCONTRADO`. Vale um comentário no teste dizendo isso, para ninguém tirar essas duas linhas achando que a última basta.
2. A trava do professor do vínculo marcado no `travar` (grade.ts:583) só tem prova de unidade, com o espião. Não há corrida com o `desativar` ou com o aceite do mesmo professor. Fica para a retro, ou para quando houver um caso de produto que dependa disso.
