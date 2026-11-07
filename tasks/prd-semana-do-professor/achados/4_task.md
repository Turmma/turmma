# Achados das revisões — `tasks/prd-semana-do-professor/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 21:12:30 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `aula` não muda nesta tarefa. Ela foi criada na 1.0, com `escola_id`, `ano_letivo_id` e id UUID, e a FK composta `aula_vinculo_do_ano_da_escola_fk` foi conferida pelo caso `23503`. Também vi as tabelas lidas pela tarefa: `vinculo`, `ano_letivo`, `evento_calendario` e `alocacao`.

Queries verificadas (todas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts`):
- `vinculoDaProfessora` (linhas 117 a 133): filtra por escola e ano do contexto, pelo usuário da sessão, pelo papel `professor` e pelo estado `confirmado`.
- `travarVinculo` (linha 141): a chave da trava inclui `hashtext(escolaId‖vinculoId)`, com a escola tirada do contexto.
- `fimDaAulaGravavel`, as quatro consultas (linhas 154 a 205): escola e ano do contexto em todas.
- `gravar`, o upsert (linhas 213 a 222): escola e ano vêm do contexto, com `setWhere` da escola.
- `apagar` (linhas 226 a 230): escola, ano, vínculo, data e início.

Nenhum método recebe escola, ano ou usuário por parâmetro. O contrato `gravarAulaRequestSchema` é `strictObject` e não tem `escolaId`, e um campo a mais responde `ENTRADA_INVALIDA`, o que o caso "o contrato é estrito" prova. Na matriz, rede, coordenação e aluno têm `aula.gravar: 'nunca'`, e o professor tem `proprio`. Nenhum `@Unscoped()` aparece.

Teste de isolamento: presente e efetivo. Os casos que o provam estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts`:
- O `R1` (linha 496) cobre vínculo de B, de colega, pendente, contestado, encerrado, de aluno e id inexistente. A resposta inteira, com a mensagem, é a mesma nos sete.
- Um caso cobre o vínculo da própria pessoa na escola B, usado com o token de A (linha 526).
- O `R1b (b)` (linha 570) mostra que a chave da trava separa as escolas.
- Um caso planta linhas de outra escola e de outro ano com `session_replication_role = replica` (linha 667). Ele torna observáveis as cláusulas que as FKs compostas deixam redundantes: vínculo, alocação, registro, evento, `setWhere` e `delete`.

Tirando de cabeça cada cláusula de escola ou de ano, algum desses casos quebra, e cada uma tem o seu bloco de mutação no documento da tarefa.

Bloqueantes: nenhum.

Recomendações:
- `aula.repository.ts:213-222` e `aulas.service.ts:53-59`: se o `setWhere` um dia barrar a linha, o upsert não grava nada e a rota ainda responde 200 com o texto. Hoje isso é inalcançável por causa da FK composta, e o caso da linha 543 prova isso. Como segunda camada, vale conferir a contagem de linhas afetadas e responder `NAO_ENCONTRADO` quando for zero, em vez de confirmar uma gravação que não aconteceu.
- `aula.repository.ts:157`: o `eq(anoLetivo.escolaId, escolaId)` ficou sem mutação, e o motivo está escrito na tarefa. Pode ficar como está. Se a 5.0 reaproveitar `fimDaAulaGravavel`, vale plantar um ano de outra escola com o mesmo id para torná-lo observável, ou deixar isso registrado na seção 11 da Tech Spec.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 21:12:35 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava em `Nota`. A única escrita nova é na tabela `aula`, com o texto que a professora digita, por `PUT /v1/aulas`. Todos com autor humano? Sim, por vacuidade. A escrita em `aula` também vem de pessoa: o vínculo precisa ser da professora da sessão (`requestSessao().usuarioId`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:65`).

Decisão autônoma sobre aluno: ausente. Nada nesta tarefa toca a trajetória do aluno, e o fluxo não chama IA.

Aprovação registrada: ok, não se aplica. Nenhuma saída de IA é produzida. `aulas.service.ts` e `aula.repository.ts` não importam a porta de IA, não chamam agente nem gravam saída de modelo. Também não há exceção do tutor fora do tutor.

Supervisão do tutor: ok, não se aplica. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado nem mudou de nível, então a declaração em governança fica como estava.

Pontos da regra 70 que conferi pelo efeito no código:
- **Item 8 e D45 (medir o professor não é vigiar):** coordenação, rede e aluno têm `aula: { ler: 'nunca', gravar: 'nunca' }` na matriz (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/shared/src/permissao/matriz.ts:243`, `:289`, `:381`). Só o professor tem `proprio` (`:335`). O teste `R7, o PUT` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts:622`) mostra que coordenação e aluno recebem a recusa e que nada é gravado. A coordenação não alcança o texto da aula.
- **Item 9 e D64:** o código não cria contagem, indicador nem trilha de uso por professor. O texto não vai a log nem a auditoria (G5). Nada aqui pode virar métrica de adoção ou de "professor que não preenche".
- **Item 7:** o código não mede comportamento nem infere nada.
- **Item 2a e D55:** o código não cria campo de nota, conceito ou sugestão de nota.

Bloqueantes: nenhum.

Recomendações:
- Na 7.0 (o painel), cuidar para que a ausência de texto da aula não vire, para a coordenação, contagem, lista nominal ou alerta por professor. A `techspec.md` já diz "nenhuma contagem" e "selo por aula, sem total", e vale manter isso quando o painel existir.
- Se um agente vier a ler o texto da aula, por exemplo o Assistente de ensino usando o que a professora planejou, essa leitura passa pela porta de IA e precisa declarar a autonomia em governança. Fica para a tarefa que fizer isso; esta não faz.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 21:13:02 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** só `aula.conteudo`, o texto livre da professora, que pode citar aluno, mais `vinculo_id`, `data`, `inicio` e `fim`. A tabela é da tarefa 1.0; esta tarefa só escreve nela e não cria coluna. Nenhum campo de aluno, e nenhum campo proibido.

**Fora da tabela de dados do docs/lgpd.md:** nada. "Registro da aula" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/docs/lgpd.md:75`, com finalidade (RF5), base legal, retenção até a virada, acesso só da professora (`proprio`), entrada no arquivo do titular só na versão completa, e "não vai a log, a auditoria nem a IA". A gravação segue o que está escrito ali.

**DTO de saída:** explícito. `gravarAulaResponseSchema.parse({ vinculoId, data, inicio, texto })` em `apps/api/src/semana/aulas.service.ts:39`, com `strictObject`. A resposta devolve o texto só para quem o escreveu. O corpo de entrada também é estrito (`ZodValidationPipe` com `gravarAulaRequestSchema`). Quando a validação falha, a resposta traz só o código, sem `issues` e sem eco do valor recebido.

**Autorização por objeto:** ok em `PUT /v1/aulas`.
- **Matriz:** `aula.gravar` é `proprio` para o professor e `nunca` para coordenação, rede e aluno (`packages/shared/src/permissao/matriz.ts:243,289,335,381`). O teste R7 prova isso.
- **Conferência do vínculo** (`packages/core/src/semana/aula.repository.ts:56-72`) exige seis termos: escola do contexto, ano em curso, id, usuário da sessão, papel `professor` e estado `confirmado`.
- **Troca de id, testada mentalmente:** vínculo da colega, da escola B, pendente, contestado, encerrado, de aluno ou inexistente dão o mesmo `NAO_ENCONTRADO`. O R1 compara a resposta inteira nos sete casos. O vínculo da própria professora na escola B, com o token de A, também recusa.
- **Ordem "confere, depois trava":** quem não é dono nunca entra na fila da trava, então nem a demora nem o `INDISPONIVEL_TENTE_DE_NOVO` denunciam que o vínculo existe (R1b a). A chave da trava inclui a escola (R1b b). As checagens de data, feriado, alocação e registro passado só rodam depois que o vínculo foi confirmado como dela, então não revelam dado de terceiro.
- **Não encontrado e sem permissão** respondem igual em todos os caminhos.

**Logs:** limpos.
- O controller, o service e o repository não registram nada.
- O caminho de erro passa pelo `all-exceptions.filter`, que grava só `evento`, `status`, `codigo` e `summarizeError`. Isso deixa de fora o `detail` do Postgres e os parâmetros que o Drizzle anexa à consulta, e por isso o texto não vaza nem quando o banco recusa a gravação.
- O G5 (`apps/api/test/aulas.int.test.ts:326`) prova com uma sentinela que o texto não aparece em linha de log nenhuma, nem na gravação aceita nem nas duas recusas (`NAO_ENCONTRADO` e `ENTRADA_INVALIDA`).

**Auditoria:** nenhuma é exigida aqui. A professora escreve no próprio registro, e não há leitura por coordenação ou rede, exportação, nota, permissão nem saída de IA. A ausência é intencional, coerente com `docs/lgpd.md:75`, e provada pelo G5: a contagem da tabela `auditoria` não muda.

**Envio externo:** nenhum. Não há chamada de IA nem integração de terceiro.

**Seed/fixture:** sintético. Professoras como `Prof <rótulo> ${PREFIXO}`, e-mails `@professores.invalid`, conteúdos como "frações equivalentes" e a sentinela feita com `randomUUID`.

**Ciclo de vida:** esta tarefa não muda nada. O apagar é físico e idempotente, o que é correto para um rascunho da própria professora sem valor de registro escolar. Retenção, virada do ano e arquivo do titular vêm da 1.0 e continuam valendo.

**Pergunta de fechamento:** sim, o código responde. O registro da aula entra no arquivo do titular da professora pelo `vinculo_id` (1.0), não é enviado a lugar nenhum, e esta tarefa não cria caminho novo de saída.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O contrato apara o texto com `String.prototype.trim()` do JS, que remove tab, quebra de linha e espaço não separável. A checagem do banco, `aula_conteudo_preenchido`, usa `btrim`, que remove só o espaço comum. Hoje isso não causa erro, porque o JS sempre apara mais que o banco. Vale um comentário no schema para ninguém trocar uma pela outra.
2. Para a tela da tarefa 7.0: a orientação de não escrever nome de aluno (`docs/lgpd.md:75`) precisa aparecer junto do campo de texto, e essa auditoria deve conferi-la nas fotos da tela.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 21:13:09 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**Escopo.** A tarefa entrega só o `PUT /v1/aulas`: repository, service, controller, a ligação no módulo e a constante da trava (7_000_004) exportada para a 5.0. O passo da grade (5.0) e o painel (7.0) ficaram de fora. As subtarefas 4.1, 4.2 e 4.3 estão feitas.

**Tech Spec.** A ordem da gravação segue a §5 "Gravar": primeiro os dois tempos da transação, depois o ano em `for share`, a conferência do vínculo sem trava de linha, a trava do vínculo com a escola na chave, a conferência da data e, por fim, o upsert com `setWhere` ou o `delete`. A única divergência é o `statement_timeout` de 3 s, e ela está registrada nos três lugares exigidos: `techspec.md` §5 e §7c e `cenarios.md` J13. O `setWhere` não alcançável está provado pelo próprio banco (`23503`) e pela linha plantada; a tarefa não precisa registrá-lo na seção 11.

**Regra 00.** O controller só valida o corpo com o contrato estrito e chama o service. O service não consulta o banco direto, só usa `AulaRepository` e `TurmaRepository`. A saída passa por `gravarAulaResponseSchema`, o contrato está em `packages/shared` e os erros são tipados.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/index.ts:1` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/index.ts:358` exportam `ESPERA_MAXIMA_DA_GRAVACAO_MS`, mas nada fora do repository a usa, e o job da 5.0 tem `lock_timeout` próprio de 1 s. Basta exportar a constante da trava.
2. O comentário do `AulasService` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/semana/aulas.service.ts:9-10`) fala só do `lock_timeout` de 2 s. Falta citar o `statement_timeout` de 3 s, que é justamente a divergência registrada.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:45` chama `requireEscolaId()` e descarta o resultado. Se a chamada serve só para afirmar o contexto (ou para a guarda de escopo), uma linha dizendo isso evita que alguém a apague por parecer código morto.
4. O `'55P03'` ganha a quarta constante local, depois de `migrate.ts`, `motor.ts` e `importacao.repository.ts`. Uma constante compartilhada em `packages/core/src/db` evitaria repetir.
5. Se o `setWhere` for falso, o upsert não grava e a rota ainda responde 200 com o texto. Com dado consistente isso não acontece, como o caso prova, mas cabe uma linha no comentário do `gravar` dizendo que a resposta nesse caso não reflete o banco.
6. No documento da tarefa, o item de contexto que aponta `conta-global.repository.ts:122` como a tradução do `55P03` está desatualizado: aquela linha lança `INDISPONIVEL_TENTE_DE_NOVO` depois de três tentativas e não traduz `55P03`. E `packages/core/src/index.ts` foi alterado sem constar em "Arquivos previstos".

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 21:13:19 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. O `PUT /v1/aulas` só recebe gravações da professora. A tech spec, seção 7c, já o põe fora do caminho quente.
Rate limit: ok. A rota passa pelo `RateLimitGuard` global, que limita pelo usuário (`sub`) e pela escola (`esc`) do token e guarda a contagem no Redis (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/app.module.ts:151`). Nada é limitado só por IP.
Fila e prioridade: ok. A tarefa não cria fila. O request faz uma transação curta com consultas por chave e um upsert de uma linha.
Concorrência: protegida.
- O clique duplo cai na restrição única `(vinculo_id, data, inicio)` com `on conflict do update`, e a trava `pg_advisory_xact_lock(7_000_004, hashtext(escolaId‖vinculoId))` põe as duas gravações em fila. O caso G6 roda as duas em `Promise.all` e prova que fica uma linha só.
- A ordem das travas segue a global: ano em `for share`, depois a conferência do vínculo sem trava de linha, depois a trava do vínculo. Quem não é dona do vínculo recebe a recusa antes de entrar na fila da dona (R1b a e b).
- A virada do ano está coberta por J14 e pelo caso do ano que deixa de estar em curso.
- `lock_timeout` de 2 s, com `statement_timeout` local de 3 s. Assim quem corta a espera é o `lock_timeout`, e o `55P03` vira `INDISPONIVEL_TENTE_DE_NOVO` com Retry-After (J13).
- Rodei `apps/api/test/aulas.int.test.ts`: 39 de 39 passaram.

Índice e paginação: ok. Todas as consultas usam chave primária ou restrição única: `vinculo.id`, `ano_letivo.id`, `alocacao_vinculo_dia_inicio_unico` e `aula_vinculo_data_inicio_unico`. O evento do calendário usa `evento_calendario_ano_idx (escola_id, ano_letivo_id)`, e uma escola tem poucas dezenas de eventos por ano. A rota grava uma linha e não lista nada, então não há o que paginar. Não precisei de `EXPLAIN`.
Degradação de IA: não se aplica.
Migration: não se aplica. A tarefa não tem migration; a 0041 é da tarefa 1.0.
Métrica e alerta: ok. A latência e o erro da rota já são medidos pela métrica global `http.server.request.duration`, por rota (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/telemetry/metrics.ts:17`). A tarefa não cria alerta.
Bloqueantes: nenhum.
Recomendações:
- Na tarefa da tela, o salvamento automático do texto precisa de debounce e não pode mandar dois PUT ao mesmo tempo para a mesma aula. Sem isso, a digitação gasta o limite do usuário e, quando a trava está presa, cada PUT segura uma conexão do pool por até 2 s.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:47`: o `statement_timeout` de 3 s vale para todos os comandos da transação, não só para a espera da trava. É aceitável porque o prazo é fixo e está escrito na tech spec. Se o padrão da API mudar, este valor precisa acompanhar; derivá-lo do `BANCO_TIMEOUT_CONSULTA_MS` evitaria a divergência.
- Durante a virada, todos os PUT da escola esperam até 2 s no `for share` do ano. Hoje isso não pesa porque a virada acontece fora do horário letivo. Vale registrar no runbook que uma virada feita em horário de aula gera uma onda de `INDISPONIVEL_TENTE_DE_NOVO` na Semana.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 21:15:39 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** grava a aula da grade, e o segundo `PUT` muda o texto, o `fim` e o `atualizadoEm`.
- **Borda:** G1 (13 cláusulas, mais o feriado novo sobre um registro já gravado e "o que não tira a aula"), G2 (o registro que saiu da grade, com o `fim` dele), G3 e o texto aparado, o apagar sem registro, G4 (o ano anterior), S16 (aula dupla), S6 (escola sem ano em curso) e R4 (substituto e antecessor, pela reimportação real da grade).
- **Permissão:** R1 (sete alvos, com a mesma resposta e a mesma mensagem) e R7 (coordenação e aluno).
- **Isolamento:**
  - o vínculo da própria professora na escola B, com o token de A;
  - as linhas que as FKs compostas não deixam existir, criadas com `session_replication_role = replica`, para cada cláusula de escola e de ano (vínculo, alocação, registro, evento, `setWhere` e o apagar);
  - a FK composta que recusa (`23503`).
- **Concorrência:**
  - G6: duas gravações reais em paralelo, com `Promise.all`;
  - J13 e R1b: trava presa por uma transação do teste, com a espera conferida em `pg_locks`;
  - J14 e "o ano que deixa de estar em curso": a ordem forçada, e o `esperarNaTrava` casando só o `for share` do ano.
- **Log e auditoria:** G5.

**Cobertos:** todos. Conferi as 22 linhas da tabela de testes de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/4_task.md`, e cada uma tem o seu caso, achado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts`. Rodei o arquivo uma vez: 39 casos, todos verdes.
- **Mutações:** conferi contra o diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/semana/aulas.service.ts`, `aulas.controller.ts` e `semana.module.ts`. Toda condição nova tem bloco, ou está entre os cinco motivos escritos, e os motivos se sustentam. Cada caso citado chega à cláusula pelo motivo certo.
  - Sem o `for share`, o J14 fica vermelho no `esperarNaTrava`, e esse é o comportamento certo: sem a trava do ano, o insert passaria pela FK sem esperar, porque o `UPDATE` da virada não mexe em coluna de chave, e gravaria no ano que está encerrando.
  - Sem a escola ou o ano na conferência do vínculo, a linha criada só para o teste leva a um 500 da FK no lugar do 404. É o efeito da cláusula que se vê de fora, e não um erro de carga.
- **O que não há:** nenhum `.skip`, nenhum mock de código nosso, nenhuma IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`aulas.int.test.ts:604` e `:618`:** no R4, o antecessor grava numa data futura (`SEGUNDA_FUTURA`), e o teste exige que o texto fique. Quando a 5.0 entrar, o passo "o texto acompanha a grade" (J11, J16) deve apagar os registros futuros do vínculo encerrado, e essa asserção fica vermelha por uma regra que não é desta tarefa. Use `SEGUNDA_PASSADA`, que também tem alocação às 8h na segunda.
2. **`aulas.int.test.ts:563` e `:580`:** em R1b (a) e (b), o `esperandoNaTravaDoVinculo() === 0` lido depois da resposta é sempre zero, e não prova nada. O que prova é o código da resposta, já firmado pela mutação que troca a ordem. Tire a linha, ou leia a fila antes de a resposta voltar.
3. **`aulas.int.test.ts:603` e `:609`:** o R4 confirma os vínculos com `update` direto no banco. O cenário diz "o substituto confirma", e a rota de confirmar deixaria o caso mais perto do uso real.
4. **Professor com duas disciplinas na mesma turma:** não há caso em que ela tenha dois vínculos confirmados e a gravação ou o apagar de um não toque o outro. Hoje quem prova isso é a colega e os vínculos dos outros estados. Vale um caso, se for barato.
5. **Contagem global de `pg_locks`:** a contagem da classe 7_000_004 lê o banco inteiro, sem filtrar o que o teste criou, e só é confiável porque a integração roda um arquivo por vez (`fileParallelism: false`). Se a 5.0 deixar transações esperando nessa mesma classe, registre essa dependência ou filtre pelo `objid` do caso.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 21:34:38 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a rodada aprovada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/.processo/ordens/diff-r2.patch`) e o que ele afeta. A 1ª rodada não exigiu nenhuma correção, então não havia correção a conferir.

Campos pessoais tocados: nenhum novo. O diff não mexe em schema, DTO nem resposta. O único dado pessoal em jogo continua sendo o texto da aula, campo da professora, já aprovado na 1ª rodada.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. A mudança no R4 deixa o teste mais forte. A professora que saiu (antecessor) agora tenta gravar em `SEGUNDA_PASSADA`, numa data em que ela já tinha texto gravado. Como a regra de gravação aceita "um registro passado já gravado", a falta de alocação não serve mais para recusar. A resposta `NAO_ENCONTRADO` passa a vir só do vínculo `encerrado`, que é o que a regra 20, item 18, pede. Os casos de quem tenta gravar no vínculo do outro seguem recusados com `NAO_ENCONTRADO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts:614-617`). No R1b, o vínculo do colega e o de outra escola, saiu a contagem de travas, mas a propriedade continua provada: a resposta chega com a trava ainda segura e é `NAO_ENCONTRADO`. Se a ordem fosse trocada, a resposta seria `INDISPONIVEL_TENTE_DE_NOVO`. A função de contagem continua em uso em `aulas.int.test.ts:756,763`.
Logs: limpos. Não há `logger` nem `console` em `aulas.service.ts`, `aulas.controller.ts` nem `aula.repository.ts`. O diff só acrescenta comentários.
Auditoria: não se aplica, nada mudou. Gravar o texto da aula pela própria professora não está entre as ações que a regra manda auditar.
Envio externo: nenhum. Nada vai a provedor de IA.
Seed/fixture: sintético. Os textos de teste são fictícios ("texto do antecessor" e parecidos).
Bloqueantes: nenhum.
Recomendações:
- O que mudou fora dos comentários é só código interno: `ESPERA_MAXIMA_DA_GRAVACAO_MS` deixou de ser exportado (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:21`) e ninguém fora do arquivo o usava.
- As recomendações de privacidade da 1ª rodada estão na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/4_task.md`. A diferença entre o `trim()` do JS e o `btrim` foi para o `TODO.md`. A orientação de não escrever nome de aluno ao lado do campo de texto ficou para a 7.0, onde vou conferir nas fotos da tela.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-06 21:34:46 · `tasks/prd-semana-do-professor/4_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: aula (a rodada nova não mexeu em schema nem em migration; escolaId, anoLetivoId e a FK composta aula_vinculo_do_ano_da_escola_fk continuam como na 1ª rodada)
Queries verificadas: AulaRepository.limitarEspera, vinculoDaProfessora, travarVinculo, fimDaAulaGravavel, gravar (setWhere da escola) e apagar. Escola, ano e usuário continuam vindo de requireEscolaId(), requireAnoEmCurso() e requestSessao(). Nenhum método recebe escopo do cliente. O diff nessa parte só troca comentários e deixa de exportar ESPERA_MAXIMA_DA_GRAVACAO_MS, que nenhum outro arquivo usava.
Teste de isolamento: presente e efetivo
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts:763: a última asserção que ainda usa `esperandoNaTravaDoVinculo()` lê o pg_locks do banco inteiro. Ela só é confiável porque `vitest.config.ts:22` define `fileParallelism: false`. Quando a 5.0 passar a usar a chave 7_000_004, filtre pelo `objid` do caso, como o próprio comentário da linha 215 já avisa.
```

O que a rodada 2 muda no isolamento:

- **R1b (a) e (b), linhas 556-592:** a saída de `expect(esperandoNaTravaDoVinculo()).toBe(0)` não enfraquece os dois casos. Com o segurador de pé e o `lock_timeout` de 2 s, um código que travasse antes de conferir o vínculo devolveria `INDISPONIVEL_TENTE_DE_NOVO` (503), e não `NAO_ENCONTRADO`. Em (b), se a escola saísse da chave, a gravação da própria escola B esbarraria na trava `soDoVinculo`, que está presa, e também receberia 503 no lugar do 200 esperado. Os dois casos continuam quebrando sem a ordem conferir-antes-de-travar e sem a escola na chave.
- **R4, linhas 594-621:** a troca de SEGUNDA_FUTURA para SEGUNDA_PASSADA deixa o caso mais forte. O relógio está fixo em 2026-11-04, e a SEGUNDA_PASSADA é 2026-11-02. Como já existe registro passado no vínculo antigo e o vínculo novo tem alocação nessa data, a conferência de data passa nos três `NAO_ENCONTRADO`. Assim, cada recusa vem só da conferência do dono e do estado `confirmado` em `vinculoDaProfessora`, que fica em `packages/core/src/semana/aula.repository.ts:56-72`. Sem essa cláusula, os três casos virariam 200 e o teste quebraria. Com a SEGUNDA_FUTURA, o caso do antecessor no vínculo antigo era recusado pela própria data, independente do vínculo.

Correções exigidas na 1ª rodada: nenhuma, então não havia o que conferir.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 21:34:59 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

Esta foi a 2ª rodada. Auditei só o diff desde a 1ª, que estava aprovada sem correções exigidas, e o que ele afeta. Não havia correção a conferir. O diff não toca em Nota, IA, Tutor, agentes nem indicador de professor. A única regra 70 que encosta nesta tarefa é a dos itens 8 e 9, já que a tarefa grava o texto da aula que a própria professora escreve, e o diff não muda nada que ela governe.

- **Caminhos de escrita em Nota:** nenhum. A tarefa grava só o texto da aula, em `PUT /v1/aulas`, e o autor é a professora. Todos com autor humano? Sim, porque não existe escrita em `Nota`.
- **Decisão autônoma sobre aluno:** ausente.
- **Aprovação registrada:** ok. Nenhuma saída de IA entra no fluxo. O texto é da professora, e por isso faz sentido o comentário em `aulas.service.ts:13` dizer que o texto não vai a auditoria. A regra 70 item 3 cobre saída de IA, e esse texto não é.
- **Supervisão do tutor:** ok. O Tutor não aparece no fluxo.
- **Autonomia declarada e visível:** sim. Nenhum agente foi criado ou mudado; vale a declaração que já existe.

**Bloqueantes:** nenhum.

O que o diff mudou:
- **`packages/core/src/semana/aula.repository.ts`:** `ESPERA_MAXIMA_DA_GRAVACAO_MS` deixou de ser exportada. Procurei em `apps` e `packages` e ninguém de fora a importa. O resto são comentários.
- **`packages/core/src/semana/index.ts` e `packages/core/src/index.ts`:** perderam o mesmo export.
- **`apps/api/src/semana/aulas.service.ts`:** só um comentário, sobre o `statement_timeout` de 3 s.
- **`apps/api/test/aulas.int.test.ts`:**
  - Saíram dois `expect(await esperandoNaTravaDoVinculo()).toBe(0)`. Os casos continuam provando que a gravação no vínculo de outra pessoa responde `NAO_ENCONTRADO` sem esperar a trava.
  - Em cinco chamadas do R4, a data passou de `SEGUNDA_FUTURA` para `SEGUNDA_PASSADA`.
  - Os dois são assunto de tenancy e de teste, não da regra 70.
- **`tasks/prd-semana-do-professor/4_task.md`:** só o documento, com a tabela de recomendações e a de revisões.

**Recomendações** (as duas já estão registradas em `4_task.md` e continuam válidas):
- **Tarefa 7.0:** quando faltar o texto da aula, isso não pode virar contagem, lista nominal nem alerta por professor para a coordenação (regra 70, itens 8 e 9; D45 e D64).
- **Se um agente vier a ler o texto da aula:** a leitura passa pela porta de IA, e a autonomia desse agente é declarada na governança (regra 70 item 5; regra 30).

Arquivos lidos nesta rodada:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/.processo/ordens/diff-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/semana/aulas.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 21:35:18 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (o diff desta rodada só mexe em comentários, em um export e em testes)
Rate limit: ok (a rodada não toca no limite)
Fila e prioridade: ok (não se aplica: a gravação continua síncrona, curta e com prazo)
Concorrência: protegida
Índice e paginação: ok (a rodada não muda nenhuma query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (a rodada não muda nada)
Bloqueantes: nenhum

A 1ª rodada não exigiu nenhuma correção, então não havia correção a conferir. O que conferi no diff:

- **O `ESPERA_MAXIMA_DA_GRAVACAO_MS` deixou de ser exportado.** Nenhum arquivo de `apps/` ou `packages/` usa a constante fora de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts`. O `PRAZO_DA_GRAVACAO_MS` ainda é calculado a partir dela (2 s + 1 s), então o `lock_timeout` de 2 s e o `statement_timeout` de 3 s ficam como estavam. O comentário novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/semana/aulas.service.ts` bate com o código.
- **Os testes R1b (a) e (b) perderam a asserção `esperandoNaTravaDoVinculo() == 0`, e a ordem das travas continua provada.** O PUT roda com a trava presa por outra conexão. Se o código travasse antes de conferir o vínculo, esperaria os 2 s do `lock_timeout` e responderia `INDISPONIVEL_TENTE_DE_NOVO`. Como a resposta é `NAO_ENCONTRADO`, fica provado que ela não esperou. O (b) também ainda prova que a escola faz parte da chave da trava, porque a gravação da própria B responde 200 com as outras duas chaves presas.
- **O helper `esperandoNaTravaDoVinculo` ainda é usado** no teste de espera da trava (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts`, linhas 756 e 763). O lint e o typecheck dos dois arquivos não mostraram nenhum erro. O G6 continua no arquivo: duas gravações simultâneas da mesma aula deixam uma linha só.
- **O R4 passou a usar `SEGUNDA_PASSADA`.** Continua provando as quatro recusas e a gravação do substituto, cada uma conferida pela linha no banco. Isso é regra de autorização e não muda nada de carga.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts:217`: `esperandoNaTravaDoVinculo` conta as esperas do banco inteiro e só é confiável porque a integração roda um arquivo por vez (`fileParallelism: false`). Vale filtrar pelo `objid` do caso já na 5.0, como o próprio comentário prevê, em vez de esperar quebrar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts:26-28`: as datas são fixas (`2026-11-02` e `2026-11-09`). Hoje é 06/11, então a `SEGUNDA_FUTURA` vira passado em três dias. Se a regra de gravar ainda depender de passado ou futuro em relação ao relógio da API, vale confirmar que ela usa um `Clock` fixo.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-06 21:35:19 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Bloqueantes:**

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/4_task.md:649`, `:653`, `:654` e `:656`. Quatro recomendações têm o destino "`TODO.md`": o `btrim` contra o `trim()` (privacy-guardian), a onda de `INDISPONIVEL_TENTE_DE_NOVO` na virada do ano (infra-guardian), a constante única do `55P03` (revisor-geral) e a professora com duas disciplinas na mesma turma (test-engineer). Só que o `TODO.md` não mudou na árvore (`git status` limpo para ele), e nenhum dos quatro itens está lá (procurei por `btrim`, `55P03`, "duas disciplinas na mesma turma" e "virada do ano em horário"). O template diz que destino `TODO.md` "é a linha já escrita no `TODO.md`, no commit da tarefa, e não promessa" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/.claude/skills/criar-tasks/task-template.md:172-176`). Do jeito que está, o documento registra um encaminhamento que não existe, e as quatro recomendações se perdem no commit.
  - **Correção exigida:** escrever as quatro linhas no `TODO.md`, com dono e a origem (tarefa 4.0, revisor e rodada), nesta mesma árvore. A outra saída é trocar o destino de cada linha por "recusada, com o motivo" ou pela tarefa que toca o arquivo. A da linha 656 já cita a 5.0 como "o lugar natural", e aí o destino pode ser só a tarefa 5.0.

**O que foi mudado depois da 1ª rodada está certo:**

- **R1b (a) e (b):** tirar `expect(await esperandoNaTravaDoVinculo()).toBe(0)` não enfraquece os casos. O segurador fica de pé até o `finally`. Quem esperasse a trava levaria `55P03` e responderia `INDISPONIVEL_TENTE_DE_NOVO`, então o `toEqual(NAO_ENCONTRADO)` sozinho já prova que não houve espera. O helper continua em uso na linha 756.
- **R4:** a troca para `SEGUNDA_PASSADA` não muda o que o caso prova. A alocação é semanal, e o caso segue exigindo 200 para o substituto e `NAO_ENCONTRADO` para os outros três.
- **`ESPERA_MAXIMA_DA_GRAVACAO_MS`:** virou constante local sem nenhum uso externo restante.
- **Comentários:** só texto, sem mudança de comportamento.

**Recomendações:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:150-151`: o comentário novo do `gravar` quebra a linha em largura diferente da do resto do bloco. Vale realinhar.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 21:35:28 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da 1ª rodada não mudaram. São o caminho feliz (G1, G2, G3, aparar, apagar sem registro, S16), os casos de borda (feriado, recesso, registro gravado com feriado novo, ano anterior em G4, escola sem ano em S6, substituição pela grade em R4, virada em J14 e o ano que fecha durante a espera), a permissão (R7), o isolamento (R1, a professora com vínculo na B, o `setWhere` inalcançável, a cláusula de escola e de ano, R1b (b)) e a concorrência (G6 com dois `PUT` em paralelo, J13, J14, R1b).

Cobertos: todos. Nesta rodada conferi o diff da r2 e o que ele toca no teste e nas mutações.

- **R1b (a)**: a asserção `esperandoNaTravaDoVinculo() === 0` saiu, e a ordem "confere, depois trava" continua provada. Se a ordem fosse trocada, o `PUT` ficaria na trava presa até o `lock_timeout` e responderia `INDISPONIVEL_TENTE_DE_NOVO`, o que reprova `toEqual(NAO_ENCONTRADO)`. A mutação da ordem (4_task.md:240-247) fica vermelha pelo motivo certo.
- **R1b (b)**: a mesma asserção saiu daqui também. A escola na chave continua provada pela gravação da própria B, que precisa responder 200 enquanto a chave só do vínculo está presa (aulas.int.test.ts:585-586). A mutação da chave sem a escola (4_task.md:223-228) a deixaria esperando, e o resultado seria 503 em vez de 200.
- **R4, de `SEGUNDA_FUTURA` para `SEGUNDA_PASSADA`**: o teste ficou mais forte. Com o relógio do teste em 2026-11-04, a nova tentativa do antecessor no vínculo encerrado (aulas.int.test.ts:614) agora passa pela cláusula "registro passado já gravado". A única coisa que a recusa é o `estado = 'confirmado'`. Antes, a falta de alocação também recusava, e isso mascarava a regra.
- **`ESPERA_MAXIMA_DA_GRAVACAO_MS`** deixou de ser exportada e nenhum teste a importava. As outras mudanças são só comentários.
- `npx vitest run apps/api/test/aulas.int.test.ts`: 39 de 39 verdes.

Bloqueantes: nenhum.

Recomendações:
- Nenhum bloco de mutação cita `R4, o PUT`. A mutação do estado (4_task.md:195-201) cita `R1:`. Agora que o R4 isola a cláusula de estado num registro passado, um segundo bloco dessa mutação citando `R4, o PUT` mostraria que essa é a única barreira ao antecessor. Melhora a cobertura, mas não bloqueia.
- O comentário de `esperandoNaTravaDoVinculo` (aulas.int.test.ts:223-226) depende de `fileParallelism: false`. Se a 5.0 reaproveitar o helper, convém filtrar pelo `objid` do caso, como o próprio comentário já diz.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/aulas.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/4_task.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/.processo/ordens/diff-r2.patch`

## revisor-geral · 3ª rodada · APROVADO · 2026-11-06 21:56:48 · `tasks/prd-semana-do-professor/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (o `conferir` aceitou o código atual com typecheck, lint, segredo, dependências, unidade e alvo)
Bloqueantes: nenhum

As duas correções da 2ª rodada foram feitas:
- **Destino `TODO.md` das quatro recomendações:** as quatro linhas agora estão no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/TODO.md`, na seção nova "Da semana-do-professor, tarefa 4.0". As quatro são a do `btrim`, a do runbook da virada do ano, a da constante do `55P03` e a da professora com duas disciplinas na mesma turma. Cada uma traz a origem (tarefa, revisor e rodada) e o dono. O `git diff` confirma que estão na árvore. Os destinos que o `4_task.md` declara, nas linhas 649, 653, 654 e 656, passam a apontar para linhas que existem.
- **Comentário do `gravar`:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/aula.repository.ts:147-152`, o comentário agora quebra as linhas na mesma largura do resto do bloco. Só o comentário mudou, o código não.

As cinco linhas novas em "Recomendações sem aplicar" registram as recomendações da 2ª rodada. Cada uma tem destino ou motivo de recusa, e nenhuma muda código. Fora disso o diff não mexeu em mais nada.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/4_task.md:649`: o texto diz "`trim()` do JS aparta mais que o `btrim`", e o certo é "apara". O `TODO.md` já escreve "apara".
- A linha do `esperandoNaTravaDoVinculo` aponta para a tarefa 5.0. Vale conferir que o `5_task.md` cita o ajuste (filtrar pelo `objid` do caso) quando a 5.0 for planejada, para ele não ficar só neste documento.
