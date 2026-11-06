# Achados das revisões — `tasks/prd-semana-do-professor/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 15:49:58 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. A `aula` veio da 1.0 e tem `escolaId` e `anoLetivoId`. As leituras usam `vinculo`, `alocacao`, `evento_calendario`, `ano_letivo`, `turma` e `disciplina`, e todas filtram por escola e, onde a tabela varia por ano, por ano letivo. Os joins de `turma` e `disciplina` também ligam pela escola.

Queries verificadas (as sete de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts`):
- `anoEmCurso`: escola do contexto, ano do contexto e `situacao = 'em_curso'`.
- `vinculosDaProfessora`: escola, ano, usuário da sessão (`requestSessao().usuarioId`), papel de professor e estado `confirmado`.
- `alocacoesDosVinculos`, `registrosDosVinculos`, `eventosDaSemana`, `gradeImportada` e `calendarioImportado`: todas com `requireEscolaId()` e `anoLetivoId`.

Nenhum método recebe escola nem usuário. O `anoLetivoId` que o service passa vem do `anoEmCurso()`, que o lê do contexto. A consulta da rota é estrita (`z.strictObject`), e `escolaId` na query string responde `ENTRADA_INVALIDA`, o que o caso G7 pela rota prova. Coordenação e aluno levam `NAO_ENCONTRADO` pela matriz (`aula.ler: 'nunca'`), a mesma resposta do id inexistente. O DTO é estrito, os ids são UUID, não há `@Unscoped()` e a rede tem `nunca` na matriz.

Teste de isolamento: presente e efetivo. No caso "o repository só devolve a escola do contexto", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts:565`, o contexto é da escola A e todos os ids passados são da B. Tirando a cláusula de escola de `alocacoesDosVinculos`, `registrosDosVinculos`, `eventosDaSemana`, `gradeImportada`, `calendarioImportado` ou `anoEmCurso` (`:595`), o teste quebra. O mesmo caso confere que a leitura com dado da A no contexto da A volta, então o vazio não vem de um repository quebrado. O R2 (`:449`) prova o isolamento pela rota, com a mesma pessoa nas duas escolas.

Bloqueantes: nenhum.

Recomendações:
- `semana.repository.ts:91`: tirar a cláusula de escola de `vinculosDaProfessora` não deixa nenhum teste vermelho, porque o usuário da sessão já é único entre escolas. A tarefa registra isso como redundância. Se um dia um usuário puder ter vínculos em mais de uma escola com o mesmo id, vale um caso com o mesmo `usuarioId` nas duas escolas.
- `semana.repository.ts:73`: a mutação do `typeof` ficou verde e está registrada como motivo. Não precisa de ação, mas fica na retro como cláusula que nenhum teste prova.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 15:50:10 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 2.0 só lê, pela rota `GET /v1/semana`. Ela não grava `Nota`, `Correcao` nem `entrega`, e não tem job, seed, importação ou webhook. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A rota devolve aulas, eventos do calendário e o texto que a própria professora escreveu. Não há nada sobre trajetória do aluno, e o DTO não traz nome nem dado de aluno.

Aprovação registrada: ok. Nenhuma saída de IA é produzida nem chega ao aluno. `itens` vai vazio até a 3.0, e um teste prende isso (`apps/api/src/semana/montar-dias.test.ts:139` e `apps/api/test/semana.int.test.ts:549`). O contrato já prevê o item `correcao`, e ele só pode vir da `entrega` `lote_de_correcao`. O banco aceita esse tipo só com a função `correcao_de_objetiva`, pelo check em `packages/core/src/db/schema/entrega.ts:95`. Assim, discursiva e redação ficam de fora por estrutura (D55). O item também não tem campo de nota, acerto nem autor (`packages/shared/src/semana/semana.ts:48-64`).

Supervisão do tutor: ok, a tarefa não toca o tutor.

Autonomia declarada e visível: a tarefa não toca agente nem nível de autonomia, então nada mudou aqui.

Regra 70, item 8 (medir o professor não é vigiar): ok. O texto da aula só sai para a dona do vínculo, porque a consulta filtra por `requestSessao().usuarioId` (`packages/core/src/semana/semana.repository.ts:93`). Na matriz, `aula.ler` é `proprio` para o professor e `nunca` para coordenação, rede e aluno (`packages/shared/src/permissao/matriz.ts:243, 289, 335, 381`). O teste R7 prova a recusa da coordenação e do aluno (`apps/api/test/semana.int.test.ts:495`). A rota não gera indicador, ranking nem métrica sobre a professora.

Itens 6 e 7 (auditoria e vigilância): sem impacto. A tarefa não gera saída de IA que precise de auditoria e não mede tempo, navegação nem estado emocional.

Bloqueantes: nenhum.

Recomendações:
- Na 3.0, o rótulo `correcao: 'Correção do Assistente'` (`packages/shared/src/semana/semana.ts:110`) precisa aparecer na tela com o selo de saída de IA (D58). Quem clica no item deve chegar à revisão do lote, onde a validação humana fica registrada (D56), e não a uma nota.
- Na 3.0 e na 4.0, o "Falta preencher" e a existência ou não do texto da aula não podem virar indicador nem contagem visível à coordenação, nem agregado por professor (D45, D64). Vale um caso de teste que prove isso quando a tela entrar.
- Na 3.0, a consulta dos itens deve ler só o `estado` da entrega, nunca resultado, acerto ou pontuação do lote. Isso mantém o DTO sem nota, como promete o comentário em `packages/shared/src/semana/semana.ts:48`.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/semana/semana.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.controller.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/app.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 15:50:16 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

A tarefa 2.0 passa na auditoria de privacidade sem bloqueantes. A rota `GET /v1/semana` só lê dados e devolve à professora as aulas dela e o texto que ela mesma escreveu, com escola e ano tirados do token e a professora tirada da sessão. Não houve imagens de tela para conferir, porque a tarefa não tem tela.

Campos pessoais tocados: o texto da aula (`aula.conteudo`), que é texto livre e pode citar aluno; a sala da alocação (`alocacao.sala`), também texto livre. Os nomes de turma e de disciplina não são dado pessoal. Nenhuma coluna nova: a tarefa só lê.

Fora da tabela de dados do docs/lgpd.md: nada. "Registro da aula" e "Aula da grade" já estão na tabela de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/lgpd.md` (linhas 74 e 75), com finalidade e retenção, e trazem "só a professora o lê" e o risco de nome na sala. Nenhum campo proibido para aluno aparece.

Autorização por objeto: ok.
- **Nenhum id do cliente:** a rota só recebe `segunda`, e o contrato estrito recusa campo a mais, inclusive `escolaId` (o teste G7 prova isso).
- **Vínculos:** `vinculosDaProfessora` filtra pelo usuário da sessão e só aceita vínculo `confirmado` (`packages/core/src/semana/semana.repository.ts:93-95`).
- **Registros:** a leitura usa só esses vínculos e repete escola e ano (`semana.repository.ts:138-140`).
- **Quem não pode, não consegue:** colega da mesma turma (S12), professor anterior e substituto (R4), outra escola (R2) e vínculo encerrado (S8) não alcançam o texto alheio.
- **Papéis recusados:** na matriz, `aula.ler` é `proprio` para professor e `nunca` para rede, coordenação e aluno.
- **Mesma resposta:** a recusa é `NAO_ENCONTRADO`, igual à de registro inexistente (R7).

Logs: limpos. Não há `logger` nem `console` em `apps/api/src/semana`, `packages/core/src/semana` nem `packages/shared/src/semana`. Um teste com texto-sentinela prova que o conteúdo não chega ao log da API (`apps/api/test/semana.int.test.ts:555`).

DTO: explícito e estrito. `semanaResponseSchema.parse` é a saída (`apps/api/src/semana/semana.service.ts:199,212`), e o teste confere as chaves exatas, sem e-mail, sem nome de professor e sem `atualizadoEm` (`semana.int.test.ts:520-538`).

Auditoria: não se aplica. É leitura do próprio dado pela professora: não há leitura por coordenação ou rede, exportação, alteração de nota, alteração de permissão nem saída de IA.

Envio externo: nenhum. Não há IA, arquivo nem URL assinada nesta tarefa.

Seed/fixture: sintético. Nomes no formato `Prof <rótulo> <PREFIXO>`, e-mails em `@professores.invalid` e ids gerados.

Ciclo de vida: o registro do ano anterior não volta (S7), e o vínculo confirmado do ano anterior não gera aula. O apagamento na virada e a entrada no arquivo do titular ficaram na tarefa 1.0, que esta não altera.

Pergunta de fechamento: o código responde. O texto da aula entra no arquivo completo do titular pelo `vinculo_id` (tarefa 1.0), e esta tarefa não cria nenhum destino novo para o dado.

Bloqueantes: nenhum.

Recomendações:
1. Incluir a sessão de rede no laço do R7 (`apps/api/test/semana.int.test.ts:501`). Hoje a recusa da rede só é provada pela matriz, não pela rota.
2. A sala (texto livre de até 40 caracteres) agora chega também à Semana da professora. Quando a tela da Semana existir, vale o mesmo aviso da tela de grade para não escrever nome de pessoa, ou um registro de que o risco é aceito.
3. Na tela da 4.0 e no `PUT`, manter o aviso "não escreva nome de aluno" ao lado do campo de texto, como o `docs/lgpd.md` linha 75 promete.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 15:50:20 · `tasks/prd-semana-do-professor/2_task.md`

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

**Base de cada item:**
- **Rate limit:** `GET /v1/semana` passa pelo `RateLimitGuard` global, que limita por usuário e por escola (`porUsuarioMin` e `porEscolaMin`, no Redis). O controller não desliga esse limite.
- **Fila:** a rota não faz nada demorado no request. São sete consultas em janela de uma semana, com `statement_timeout` do pool. Não enfileira nada.
- **Estado em memória:** não há. O relógio é injetado e não guarda estado.
- **Concorrência:** a rota só lê, então não tem "busca, verifica, grava".
- **Índices:** cada consulta tem índice que começa pela escola e pelo ano.
  - `aula`: `aula_semana_idx (escola_id, ano_letivo_id, vinculo_id, data)`.
  - `vinculo`: `vinculo_usuario_idx (escola, ano, usuario, estado)`.
  - `alocacao`: `alocacao_ano_idx (escola, ano)`.
  - `evento_calendario`: `evento_calendario_ano_idx (escola, ano)`.
  - As duas checagens de existência usam `limit 1`.
- **Paginação:** a resposta vai até sete dias e só traz os vínculos da professora, então não precisa paginar.
- **Métrica:** `http.server.request.duration` já mede latência e erro de toda rota, pelo middleware de `packages/core/src/telemetry/metrics.ts`. A tarefa não cria alerta novo.

**Recomendações (não bloqueiam):**
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:36`, o `Promise.all` roda cinco consultas no `Database` (o pool, não uma transação). Cada request pode ocupar até cinco conexões ao mesmo tempo. Às 7h30 a abertura da Semana pelos professores coincide com a rajada de login, e o limite de espera do pool no cenário `rajada` é 100 ms (R40). Há dois jeitos de resolver:
   - rodar em sequência, ou num `transaction` só de leitura com uma conexão;
   - juntar `gradeImportada` e `calendarioImportado` numa consulta com dois `exists`.
2. Incluir `GET /v1/semana` como passo do professor no cenário de carga das 7h30 (`infra/scripts/carga-login.ts` ou o cenário `rajada`). É a primeira tela que o professor abre no dia.
3. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts:107`, `alocacoesDosVinculos` filtra `vinculo_id` em cima do `alocacao_ano_idx (escola, ano)`. O custo cresce com a grade da escola inteira (alguns milhares de linhas), não só com a da professora. Hoje não pesa. Se o `EXPLAIN` no staging mostrar varredura da escola toda, um índice `(escola_id, ano_letivo_id, vinculo_id)` resolve.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 15:50:32 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**Escopo.** As subtarefas 2.1 a 2.5 estão feitas e todos os arquivos previstos existem.
- O contrato do `PUT` (`gravarAulaRequestSchema` e `gravarAulaResponseSchema`) e os esquemas e rótulos dos itens entram pela 2.1, que pede "as duas rotas" e "a tabela de rótulos". Isso não invade tarefa futura.
- `montarDias` devolve `itens: []`, e um teste prende isso. Não há gravação, consulta de itens nem tela.

**Tech Spec.** O código segue a §5 "Ler":
- as quatro consultas;
- eventos por cruzamento (`fim ≥ segunda`, `inicio ≤ domingo`);
- registro passado sem alocação marcado como `foraDaGrade`;
- feriado e recesso tiram a aula, e o evento não tira;
- `ano: null` sem `requireAnoEmCurso`;
- relógio injetável, como o `relogioDaPrivacidade`.

As duas divergências (o que significam `gradeImportada` e `calendarioImportado`, `agora` em `HH:MM`, a regra do fim de semana, e os verbetes do glossário) estão na `techspec.md` §5 e no `cenarios.md` S17. Nenhuma ficou só no `2_task.md`.

**Regra 00 e regra 40.**
- O controller não tem regra de negócio, só o pipe com o contrato estrito.
- O repository é o único que acessa o banco, e escola, ano e professora vêm do contexto e da sessão.
- A saída passa por `semanaResponseSchema.parse`, como no `grade.service.ts`.
- Não achei `.skip`, `.only`, `any` nem `TODO`.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/glossario.md:115-117`: o verbete "Semana (do professor)" diz que sábado e domingo aparecem "só quando a grade tem aula neles". Falta o caso do registro passado fora da grade, que também faz o dia aparecer (`techspec.md` §5; `montar-dias.ts:82`). Vale alinhar o texto.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts:14`: o `horario = (valor) => valor.slice(0, 5)` já existe igual em `grade.repository.ts:12` e em `alocacao.repository.ts:19`. Esta é a terceira cópia, e uma função comum no `core` resolveria. O nome também colide com o `horario` de `packages/shared/src/semana/semana.ts:13`, que é um regex com outro sentido.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:5-10`: `horaDeUso` faz par com o `diaDeUso` do `core` (`usage-day.ts`). Ficaria melhor lá, ao lado dele, antes que outro módulo precise de `HH:MM` no fuso e escreva a dele.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.ts:97`: o `push` do dia faz o mapeamento dos eventos, o filtro de feriado e recesso, a ordenação e o mapeamento das aulas numa linha só. Separar em duas ou três linhas deixaria a regra "feriado tira a aula" mais fácil de ler.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 15:51:54 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** só o vínculo `confirmado` gera aula, a ordem do dia, o texto em cada aula e o fora da grade passado.
- **Bordas do domínio:**
  - professora com duas disciplinas na mesma turma (S11);
  - turma sem professor (S12);
  - feriado e evento no mesmo dia (S3);
  - recesso que atravessa as semanas, filtrado por cruzamento (S4);
  - semana na borda do ano letivo (S5);
  - virada do ano e vínculo do ano anterior (S7 e o caso próprio);
  - vínculo encerrado (S8);
  - substituição pela reimportação real da grade (R4);
  - 22h de Brasília, que já é o dia seguinte em UTC (S13);
  - aula dupla (S16);
  - sábado e domingo só com aula, contados antes de o feriado tirar a aula.
- **Permissão:** coordenação e aluno recebem a recusa da matriz (R7).
- **Isolamento:** a professora de duas escolas (R2), o feriado e o evento da escola B (R3), e os ids da B passados ao repository no contexto da A.
- **Concorrência:** não se aplica. A tarefa só lê; a gravação e a trava são da 4.0.

**Cobertos:** todas as 26 linhas da tabela "Testes que provam a regra" têm caso com o nome citado e existente. Rodei os testes:
- unidade: 15 de 15 verdes (`montar-dias.test.ts`, `semana.test.ts`);
- integração: 31 de 31 verdes (`semana.int.test.ts`).

O `mutacoes.ts --faltando` aponta uma linha só, o `typeof` de `anoEmCurso` em `semana.repository.ts:73`. Ela está declarada com motivo (item 3) e a mutação foi rodada verde.

Conferi os blocos de mutação contra o diff:
- cada termo das condições de `montar-dias.ts` tem bloco;
- cada cláusula de `where` do repository tem bloco, com duas exceções, `vinculo.escolaId` e `vinculo.papel`, declaradas com motivo;
- os blocos do escopo de escola apontam para o caso do repository que passa id da B no contexto da A, e ele chega à cláusula.

Os casos leem o corpo da resposta, nenhum confere só o status. O DTO compara as chaves exatas. Não há `.skip`, teste comentado nem mock de coisa nossa: a grade e o calendário passam pelo `executarPlanilha` real, e o relógio é injetado. A tarefa não chama IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Motivo (1) das Mutações, `eq(vinculo.escolaId, …)` em `semana.repository.ts:91`.** A frase "nenhuma linha muda" só vale para contexto coerente. O que garante a redundância é a FK `vinculo_usuario_da_escola_fk` (`packages/core/src/db/schema/vinculo.ts:62`), que prende o vínculo à escola do usuário. Cite a FK no motivo, ou feche com um bloco: contexto com a escola da A e o `usuarioId` da professora da B, chamando `vinculosDaProfessora(b.emCurso)` e esperando `[]`. É o mesmo padrão que o arquivo já usa, e esse contexto deixaria o caso vermelho sem a cláusula.
2. **Motivo (2), `eq(vinculo.papel, 'professor')` em `semana.repository.ts:94`.** "O usuário tem um papel só" não é garantido pelo banco: o `vinculo_papel_valido` não compara o papel do vínculo com o do usuário. Um vínculo `aluno` com disciplina, inserido direto para a professora, deixaria a cláusula vermelha. Reescreva o motivo ou acrescente o bloco.
3. **Comentário enganoso em `apps/api/test/semana.int.test.ts:295`.** Ele diz que "só o filtro do ano pode esconder o registro", mas quem esconde é o `inArray` dos vínculos e o mapa de vínculos da montagem. O próprio item (5) das Mutações reconhece isso. Corrija o comentário para não induzir a próxima tarefa.
4. **Dois casos de rota que não falhariam por mutação de escopo.** São "o `ano` é o da escola do token" (`semana.int.test.ts:440`) e a 1ª asserção de "`gradeImportada` e `calendarioImportado` são da escola do token" (`:402`). O escopo real está provado no caso do repository (`:565`). Vale dizer isso na coluna "O que prova" das linhas 59 a 61 da tabela, para ninguém tomar esses casos como a prova.
5. **S17 na tabela.** A segunda metade (a professora sem aula vê `true` e a semana vazia) tem caso próprio, "`gradeImportada` olha a escola e não a professora" (`semana.int.test.ts:415`), mas a linha do S17 não o cita.
6. **Caso do log (`semana.int.test.ts:555`).** Acrescente `expect(linhasDeLog.length).toBeGreaterThan(0)`, para que o "nenhuma linha traz o texto" não passe sem nenhuma linha de log.
7. **Blocos das linhas 71 e 75 de `montar-dias.ts`.** Os blocos que tiram o `vinculo !== undefined` ficam vermelhos por `TypeError` no `comoAula`, e não pela asserção. Chegam à cláusula, mas uma asserção que leia a aula seria mais clara.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/semana/semana.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/semana/semana.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/2_task.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-06 16:05:17 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. As tabelas que esta tarefa lê (`vinculo`, `turma`, `disciplina`, `alocacao`, `evento_calendario`, `aula`, `ano_letivo`) já estavam aprovadas na 1ª rodada.

Queries verificadas: `packages/core/src/semana/semana.repository.ts`
- `vinculosDaProfessora` (linhas 91 a 95): a escola, o ano, o usuário e o papel vêm do contexto, e o estado é `confirmado`.
- `alocacoesDosVinculos` (linha 107), `eventosDaSemana` (linha 122), `registrosDosVinculos` (linha 138), `gradeImportada` (linha 154), `calendarioImportado` (linha 164) e `anoEmCurso` (linha 77): todas filtram pela escola que vem de `requireEscolaId()`, como antes.
- Em `apps/api/src/semana/semana.service.ts`, as cinco consultas passaram de `Promise.all` para uma sequência. Os argumentos não mudaram e o escopo continua o mesmo.

Teste de isolamento: presente e efetivo. As duas recomendações da 1ª rodada foram aplicadas. Conferi cada caso tirando a cláusula de cabeça:
- **Professora da B no contexto da A** (`apps/api/test/semana.int.test.ts:580-581`): sem `eq(vinculo.escolaId, requireEscolaId())`, a consulta continuaria filtrando pelo ano e pelo usuário da B. Os joins de turma e disciplina usam `vinculo.escolaId`, não o contexto, então também não seguram o vínculo. Ele voltaria e o `toEqual([])` quebra.
- **Vínculo `aluno` confirmado, com disciplina, no mesmo usuário** (`apps/api/test/semana.int.test.ts:651-655`): sem `eq(vinculo.papel, 'professor')`, a consulta devolveria dois vínculos e o `toEqual([dela.vinculoId])` quebra.

Não consegui rodar os testes de integração aqui: o pacote `@educa/core` não resolve sem build. A conclusão acima vem da leitura do código.

Bloqueantes: nenhum.

Recomendações:
- O `if (typeof anoLetivoId !== 'string')` de `anoEmCurso` (`semana.repository.ts:73`) continua sem teste que o prove. Já está registrado como motivo (1) nas Mutações e fica para a retro.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 16:05:22 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Esta rodada só olhou o diff desde a 1ª rodada (aprovada) e o que ele afeta: `semana.service.ts`, `semana.int.test.ts`, `docs/glossario.md` e `2_task.md`. O repository, o DTO, o schema e a matriz não mudaram.

Campos pessoais tocados: nenhum campo novo. O serviço continua lendo as mesmas cinco consultas, agora uma depois da outra em vez de `Promise.all` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:36-41`). A saída continua passando por `semanaResponseSchema.parse`, então o que a resposta expõe é o mesmo.

Fora da tabela de dados do docs/lgpd.md: nada. A mudança no glossário diz quando sábado e domingo aparecem ("ou há registro passado fora da grade"). Isso descreve algo que a rodada anterior já tinha aprovado e não cria dado novo.

Autorização por objeto: ok, e a prova ficou mais forte. Dois testes novos:
- **Escola trocada:** no contexto da escola A, com o usuário e o ano da escola B, a busca de vínculos volta vazia (`apps/api/test/semana.int.test.ts`, caso "o repository só devolve a escola do contexto"). Esse teste quebra se alguém tirar `eq(vinculo.escolaId, requireEscolaId())` em `packages/core/src/semana/semana.repository.ts:91`. Antes, essa cláusula não tinha teste que a provasse.
- **Papel trocado:** um vínculo de `aluno` com disciplina no mesmo usuário não vira aula da professora. Esse teste quebra se alguém tirar `eq(vinculo.papel, 'professor')` (`semana.repository.ts:94`).

Logs: limpos. Nem `semana.service.ts`, nem `montar-dias.ts`, nem `semana.repository.ts` chamam `logger` ou `console`. O teste que procura o texto da aula no log agora também confere que o log não está vazio (`expect(linhasDeLog.length).toBeGreaterThan(0)`), então ele não passa só por não haver log nenhum.

Auditoria: presente onde a regra exige. A rota é a professora lendo a própria semana. Não é leitura de dado de aluno pela coordenação ou pela rede, nem exportação ou alteração. Nada disso mudou.

Envio externo: nenhum. A rota não chama IA.

Seed/fixture: sintético. As professoras de teste se chamam "hana", "fani" e "gil", o texto é "texto de 2026 numa data de 2027", e as turmas e disciplinas são inventadas ("7º C", "Física"). O `insert` direto no banco usa ids gerados no próprio teste.

Correções exigidas na rodada anterior: nenhuma. Sobre a minha recomendação da sessão de rede no laço do R7, aceito o motivo registrado: não existe papel `rede` em `PAPEIS_DE_USUARIO`, e `packages/shared/src/permissao/matriz.test.ts` já prova que a rede não alcança `aula`.

Pergunta de fechamento: sim, o código responde. O registro da aula já entra no arquivo do titular desde a 1.0, e esta rodada não criou dado novo nem envio para fora.

Bloqueantes: nenhum.

Recomendações:
- Continuam valendo as duas recomendações da rodada anterior, já registradas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/2_task.md`:
  - na 6.0, o aviso "não escreva nome de pessoa" ao lado da sala;
  - na 4.0 e na 7.0, o aviso "não escreva nome de aluno" ao lado do campo de texto da aula.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 16:05:35 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Esta rodada só olhou o diff `cd4cab27…` → `9c03db03…`, conferido contra a 1ª rodada, que foi aprovada. Nenhuma correção tinha sido exigida, então não há correção a conferir.

Caminhos de escrita em Nota: nenhum. O diff não escreve em `Nota`, e o módulo `semana` só lê. A pergunta "todos com autor humano?" não se aplica, porque não há caminho.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Esta tarefa não produz saída de IA. O rótulo "Correção do Assistente · Aprovada" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/semana/semana.ts:114` só mostra o estado de uma entrega que já foi aprovada fora daqui.
Supervisão do tutor: ok. O tutor não aparece nesta tarefa.
Autonomia declarada e visível: sim. Nada no diff muda isso.

O que mudou e o efeito na regra 70:
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:36-41`:** as cinco consultas, que rodavam juntas em `Promise.all`, agora rodam uma depois da outra. As consultas, o escopo e o DTO de saída continuam os mesmos, e não há efeito na regra 70.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts`:** três testes novos.
  - Um confere que o log tem linhas antes de afirmar que o texto não está nele.
  - Um põe a professora da escola B no contexto da escola A e espera lista vazia.
  - Um põe um vínculo `aluno` confirmado no mesmo usuário e espera que ele não vire aula. Esse vínculo é inserido por SQL direto, mas é só preparação de teste na tabela `vinculo`, sem nota nem decisão sobre aluno.
  - Os três reforçam as regras 10 e 20 e não tocam na 70.
- **`docs/glossario.md`:** a definição de "Semana" agora diz que sábado e domingo aparecem também quando há registro passado fora da grade. É só a descrição de como a leitura funciona.
- **`2_task.md`:** as Mutações ganharam dois blocos (escola e papel em `vinculosDaProfessora`). Minhas três recomendações da 1ª rodada estão registradas em "Recomendações sem aplicar" e mandadas para as tarefas 3.0, 4.0 e 8.0, como pedi.

Itens 7, 8 e 9 da regra 70: o diff não traz inferência emocional, ranking, métrica de professor nem caminho da coordenação até a conversa do professor com o chat.

Bloqueantes: nenhum

Recomendações (as mesmas da 1ª rodada, seguem para as próximas tarefas):
- **Tarefas 3.0 e 8.0:** o rótulo "Correção do Assistente" aparece na tela com o selo de saída de IA (D58). Quem clica nele chega à revisão do lote (D56), e não a uma nota.
- **Tarefas 3.0 e 4.0:** "Falta preencher" e a existência do texto da aula não podem virar contagem visível à coordenação nem agregado por professor (D45, D64). Isso precisa de um caso de teste quando a tela entrar.
- **Tarefa 3.0:** a consulta dos itens lê só o `estado` da entrega, nunca resultado, acerto ou pontuação do lote.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 16:05:36 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum.

Nesta rodada conferi o diff r2 e o que ele afeta:

- **Consultas em sequência.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:36-41`, as consultas trocaram o `Promise.all` por `await` em sequência. Os argumentos e o escopo continuam os mesmos. A Tech Spec e o `cenarios.md` não falam em paralelismo, então a troca não diverge deles. A mudança atende o achado do `infra-guardian` sobre a espera do pool, registrado em `achados/2_task.md:127`.
- **Testes novos.** No `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts` entraram três coisas:
  - O contexto da escola A com o usuário e o ano da B (linhas 580-582) prova a cláusula da escola em `vinculosDaProfessora`.
  - O vínculo `aluno` com disciplina, inserido no mesmo usuário (linhas 651-655), prova a cláusula `papel = 'professor'`.
  - O `linhasDeLog.length > 0` deixa de fora o falso negativo de um log vazio.

  As três mutações novas do `2_task.md` usam esses casos, e o portão as validou.
- **Documento.** Em Mutações, os motivos (1) e (2) da rodada anterior saíram, porque agora têm bloco, e o total passou a 58 blocos. A tabela de testes foi corrigida e diz qual caso prova o escopo e qual prova só o valor pela rota.
- **Glossário.** O verbete "Semana (do professor)" agora inclui o caso do sábado e do domingo com registro passado fora da grade. Isso bate com o caso S14 do sábado em `montar-dias.test.ts`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/2_task.md:767`: a linha do `tenancy-guardian` em "Recomendações sem aplicar" ainda diz "motivo (3) das Mutações". Com a renumeração, o `typeof` de `anoEmCurso` passou a ser o motivo (1), como a linha 133 já diz.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:36`: o comentário passa de 140 colunas. Pode ser quebrado em duas linhas, como os outros comentários do arquivo.
- As três recomendações da 1ª rodada que ficaram sem aplicar continuam bem encaminhadas: o helper `horario` e o `horaDeUso` vão para o `TODO.md`, e a linha do `push` foi recusada com motivo.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 16:05:42 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum (uma leitura nova do professor, `GET /v1/semana`. É o início da rajada das 7h30, mas não é login, tutor, sala, prova, fila nem IA.)
Rate limit: ok (nada mudou desde a 1ª rodada)
Fila e prioridade: ok (nenhum job novo)
Concorrência: protegida (só leitura. O diff não acrescenta escrita.)
Índice e paginação: ok (nada mudou. O índice de `alocacao` continua como recomendação condicionada ao `EXPLAIN`.)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nada mudou)
Bloqueantes: nenhum

O que esta rodada conferiu:
- As cinco consultas agora rodam uma depois da outra em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/semana.service.ts:37-41`, e não sobrou `Promise.all`. Cada requisição segura uma conexão do pool por vez. A latência fica maior, mas são cinco leituras indexadas por escola e ano, e o custo cabe na rota.
- As mudanças em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana.int.test.ts` são só de teste. São três: o contexto da escola A com a professora da B, o vínculo `aluno` com disciplina no mesmo usuário, e a conferência de que o log tem linhas. Nenhuma chama provedor pago nem afeta carga.
- `docs/glossario.md` e `2_task.md` mudaram só no texto e não tocam infra.

Recomendações:
- As duas recomendações da minha 1ª rodada não estão no `TODO.md`, embora o `2_task.md` diga que foram para lá. A primeira é incluir `GET /v1/semana` como passo do professor no cenário de carga das 7h30. A segunda é o índice `(escola_id, ano_letivo_id, vinculo_id)` em `alocacao`, se o `EXPLAIN` no staging mostrar que a consulta varre a escola toda. Procurei no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/TODO.md` por "7h30", "alocacao_ano", "alocacoesDosVinculos" e "v1/semana" e não achei nenhuma das duas. O `git status` também mostra o arquivo sem alteração. As duas do `revisor-geral` com destino `TODO.md` provavelmente estão na mesma situação. Registre as quatro no `TODO.md` antes do commit, ou corrija o destino na tabela "Recomendações sem aplicar".
- Continua valendo: a tela da 6.0 vai chamar essa rota toda segunda de manhã, e a medição dela no k6 tem de existir antes de ela entrar.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 16:05:49 · `tasks/prd-semana-do-professor/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. Nesta rodada conferi três coisas:
- se as sete recomendações viraram teste ou texto;
- se as duas cláusulas que eram motivo agora têm bloco: a escola e o papel em `vinculosDaProfessora`;
- se a troca de `Promise.all` por sequência em `semana.service.ts` muda algum comportamento que precise de teste.

**Cobertos:**
- **A escola do contexto em `vinculosDaProfessora`.** O teste `o repository só devolve a escola do contexto` (`apps/api/test/semana.int.test.ts:581-582`) usa o contexto da escola A com o usuário e o ano da B. Tirando o `eq(vinculo.escolaId, requireEscolaId())` (`packages/core/src/semana/semana.repository.ts:91`), o vínculo da B volta, porque o `join` de turma e disciplina segue a escola do próprio vínculo. Então o teste fica vermelho na asserção que o `falha:` aponta, pelo motivo certo.
- **O papel `professor`.** O teste está em `semana.int.test.ts:651-659`: um vínculo `aluno` confirmado, com disciplina, no mesmo usuário e em outra turma (7º C). Sem o `eq(vinculo.papel, 'professor')` da linha 94, ele entra na lista e o `toEqual([dela.vinculoId])` quebra. O vermelho vem do motivo certo.
- **As mutações de `montar-dias.ts`.** Os dois blocos agora têm `falha:` e uma substituição sem o cast (`vinculo ?? entrada.vinculos[0]`). Assim a aula ou o registro ganha um vínculo de verdade, e o teste confere o resultado, não um `undefined`.
- **Os motivos sem bloco.** Sobrou um só, o `typeof` de `anoEmCurso`, coerente com o `--faltando` (1 linha, 58 blocos).
- **O comentário do S7** (linhas 34-35) agora diz certo quem esconde o registro: o vínculo. O filtro de ano tem caso próprio.
- **O `linhasDeLog.length > 0`** (linha 564) garante que a ausência do texto não vem de um log vazio.
- **A tabela de testes.** As três linhas de escopo por rota agora dizem que provam o valor por rota, e citam o caso do repository que prova o escopo.
- **A sequência em `semana.service.ts`.** O resultado não muda e não entra cláusula nova com condição. É uma decisão de pool, e não precisa de bloco.
- **O glossário** (sábado e domingo com registro passado fora da grade) bate com o S14, que já tem teste em `montar-dias.test.ts`.
- **A execução.** Rodei `npx vitest run apps/api/test/semana.int.test.ts` e os 31 casos passaram. Não há `.skip`, mock da regra nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `tasks/prd-semana-do-professor/2_task.md`, a linha do `tenancy-guardian` na tabela "Recomendações sem aplicar" diz "já está no motivo (3) das Mutações". Com a renumeração, o `typeof` virou o item (1). Basta trocar a referência.
2. O nome do caso em `apps/api/test/semana.int.test.ts:647` só fala da colega ("a colega confirmada na mesma escola e o mesmo ano não entra"). Agora o caso também prova o vínculo de outro papel no mesmo usuário. Acrescentar algo como "nem o vínculo `aluno` do mesmo usuário" ajuda quem procura o teste do papel pelo nome.
3. Fica para a retro: o cenário da escola usa o contexto da A com o usuário da B. Isso não acontece pela rota, porque a sessão prende o usuário à escola dele. O bloco prova a defesa em profundidade do repository, e o texto das Mutações já diz isso. Não há ação a tomar.
