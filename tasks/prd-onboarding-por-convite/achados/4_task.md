# Achados das revisões — `tasks/prd-onboarding-por-convite/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 20:18:43 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO

A tarefa não toca nenhuma das exigências da regra 70. Não grava `Nota`, não chama IA, não mexe em tutor, agente, autonomia nem indicador de professor. Também não altera `docs/regulacao.md`, que nada aqui exige. Conferi as quatro coisas onde o motor da planilha poderia esbarrar na regra:

- **O que o motor grava:** só tem o tipo calendário (`TIPOS_DO_MOTOR`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:31`), que escreve em `evento_calendario`. Os quatro tipos previstos (alunos, professores, grade, calendário) e as chaves do resumo não têm nota nem conceito.
- **As marcas transferir, desligar e encerrar:** são escolhas da coordenação. O gravar recusa qualquer marca que não esteja entre os candidatos que a prévia mostrou (`motor.ts:77-79`). Nada decide sozinho sobre o aluno, e a gravação desses tipos só chega na 7.0.
- **Autor humano:** a auditoria `planilha.gravada` sai com a coordenação que gravou como autora (`motor.ts:199-204`). Se quem gravou já saiu (`criado_por` nulo), o job fecha `desatualizada` sem gravar e sem auditar (`motor.ts:178`). O caso `quem gravou já saiu` em `apps/api/test/importacao.int.test.ts:543` prova isso, e o bloco de mutação correspondente também.
- **Acesso:** só a coordenação faz prévia e gravação; professor, aluno e rede ficam em `nunca`, e `matriz.test.ts` prova. Nenhum caminho expõe dado de professor nem conversa do chat.

Caminhos de escrita em Nota: nenhum nesta tarefa (o motor grava `importacao_planilha`, `evento_calendario` e `auditoria`). Todos com autor humano? Não se aplica a `Nota`. A auditoria `planilha.gravada` tem autor humano e não é gravada quando ele falta.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (a tarefa não tem saída de IA)
Supervisão do tutor: ok (não toca o tutor)
Autonomia declarada e visível: sim (não muda, a tarefa não tem agente)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:364`: o comentário de `planilha.gravada` diz "O autor é a coordenação que gravou; se ela já saiu, a rotina." O código faz outra coisa (`motor.ts:178`, `desatualizada` sem auditoria), e a spec e o banco também (`techspec.md` §5, `auditoria_rotina_so_nas_acoes`). Trocar por algo como "se ela já saiu, a importação fecha `desatualizada` e não há registro", para ninguém ler ali que a rotina pode assinar a gravação.
- Quando a 6.0, a 7.0 e a 11.0 entrarem no `TIPOS_DO_MOTOR`, a auditoria precisa conferir de novo que nenhum tipo de planilha escreve em `Nota` ou em resultado de avaliação. Se um dia aparecer "importar notas", vale a regra 70 item 1: `lancadaPor` humano em toda linha, com o caso que prova.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 20:18:56 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. Foram conferidas as duas que ela usa, criadas na 2.0. `importacao_planilha` tem `escola_id`; `ano_letivo_id` é anulável só no tipo `professores`, e a FK composta com a escola impede apontar para o ano de outra. O único parcial "uma `na_fila` por escola" e o `criado_por` também têm FK composta com a escola, e o id é `uuidv7()`. `evento_calendario` tem `escola_id` e `ano_letivo_id`.

Queries verificadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`). Todas tiram a escola de `requireEscolaId()` e nenhuma recebe escola por argumento:
- leitura de ano: `anoDeDestino`, `anoPorId`
- fila: `fecharAExpirada` (no select e no update), `criar`, `ler` (com e sem trava), `trocarDeEstado`
- eventos: `eventosDoAno`, `apagarEventos`, `inserirEventos`
- `limitesDoPasso3`

Fora do repository:
- **Corpo da requisição:** o corpo é estrito, e `escolaId` no corpo dá `ENTRADA_INVALIDA` (há teste). O `anoLetivoId` do corpo só filtra, e o servidor o confere contra a escola da sessão e a situação `planejado`. O `turmaId` no calendário responde `NAO_ENCONTRADO`.
- **Job:** o job leva só `importacaoId`. A escola é a da linha do outbox, e a autoria da auditoria vem do `criado_por` da própria importação, que fica na mesma escola pela FK.
- **Camada rede:** tem `nunca` nas duas ações, na matriz e na expectativa.
- **`@Unscoped()`:** não aparece.

Teste de isolamento: presente e efetivo. Tirando a cláusula de escola de cada consulta, um teste quebra:
- **Ler a importação:** a leitura no contexto de B dá `toBeUndefined` (`apps/worker/test/gravar-planilha.int.test.ts:324`).
- **Trocar de estado:** `concluir`, `desatualizar` e `falhar` no contexto de B devolvem `false` (linhas 318 a 321).
- **Ler e apagar eventos:** com o ano de B no contexto de A, a lista vem vazia e nada é apagado (linhas 340 a 342).
- **Ano de destino:** o planejado de B no filtro dá `NAO_ENCONTRADO`, mesmo resultado do ano inexistente (`apps/api/test/importacao.int.test.ts:449`).
- **Fechar a expirada:** a `na_fila` velha da outra escola não é tocada (`apps/api/test/importacao.int.test.ts:300`), e com a linha dela travada não há `CONFLITO` falso (linha 349).

Pela regra 6, ano de outra escola, turma de outra escola, papel sem permissão e tipo inexistente respondem todos `NAO_ENCONTRADO`, igual ao inexistente. O `CONFLITO` só sai da fila da própria escola.

Bloqueantes: nenhum.

Recomendações:
- `importacao.repository.ts:96` (`anoPorId`): nenhum teste quebra se só esta cláusula de escola sair, porque hoje ela só é chamada depois de `ler`, que já tem escopo. Vale um caso direto no teste do repository: `anoPorId(b.anoId)` no contexto de A devolve `undefined`.
- `importacao.repository.ts:220` (`inserirEventos`): o caso de inserir no ano de outra escola não tem teste. Hoje quem barra é só a FK composta. Um caso que espere a recusa deixa isso documentado.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 20:19:12 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO

A tarefa 4.0 não tem bloqueante de regra 20 nem de `docs/lgpd.md`. Na planilha de calendário não entra dado de aluno. O único dado de pessoa que ela toca é o autor da gravação (`criado_por`, o id da coordenação), e ele já estava no mapa de dados desde a 2.0. O texto da planilha fica só enquanto ela espera o job e é apagado em toda troca de estado.

Campos pessoais tocados: `importacao_planilha.linhas` e `marcas`, o dado da planilha enquanto ela espera o job. No calendário isso são tipo, datas e descrição. Também `importacao_planilha.criado_por`, o autor, gravado a partir da sessão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts:136`. E `evento_calendario.descricao`, texto livre classificado como `sem_pessoa`. Nenhum campo novo de aluno, nenhum dos campos proibidos, nenhum diagnóstico.

Fora da tabela de dados do docs/lgpd.md: nenhum. "Planilha em gravação" está em `docs/lgpd.md:73` e "Evento do calendário" em `docs/lgpd.md:75`, as duas com finalidade e retenção. A chave nova `eventos_removidos` é só uma contagem.

Autorização por objeto: ok.
- As duas rotas exigem `importacao_planilha` com alcance `unidade`, só para a coordenação. Professor, aluno e rede ficam em `nunca`, e isso está em `matriz.ts` e na expectativa da matriz.
- O ano de destino é filtrado pela escola da sessão. Um ano de outra escola, encerrado, em curso ou inexistente responde o mesmo `NAO_ENCONTRADO`.
- Um `turmaId` de outra escola, um `:tipo` que não existe e o professor ou aluno na rota respondem igual.
- Uma marca de outra escola responde `ENTRADA_INVALIDA`, o mesmo que uma marca inexistente.
- O job lê a escola do contexto do outbox. Com o payload adulterado, ele termina `ignorada`, e há caso de teste para isso.
- Toda leitura e escrita do repository tem `escolaId` vindo do contexto.

Logs: limpos.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/gravar-planilha.ts:53,59,65` registra só ids, estado, tentativa e código.
- O erro passa por `summarizeError`, que tira a mensagem e o `detail` do Postgres.
- O executor manda ao Redis só o código tipado.
- O service e o controller não logam nada.
- O `ZodValidationPipe` devolve só o código, sem `issues`.
- O teste `o log do job traz só ids…` fixa as chaves permitidas e confere que a descrição do evento e o texto do erro do banco não aparecem.

Auditoria: presente.
- `planilha.gravada` é gravada na transação do passo (3), com o tipo e as contagens (`strictObject`, só números) e a coordenação como autora. O teste confere que nenhuma descrição de evento entra.
- Quando quem gravou já saiu (`criado_por` nulo), o job fecha `desatualizada` sem gravar e sem auditar. A regra ficou escrita em `techspec.md` §5 e em `cenarios.md`, e tem caso de teste.
- A tarefa não lê dado de aluno, não exporta e não mexe em nota nem em permissão de pessoa.

Envio externo: nenhum. A tarefa não chama IA nem provedor de terceiro. O payload do job é só `{ importacaoId }`, com schema estrito.

Seed/fixture: sintético. São "Coordenação sintética da planilha", e-mails `@planilha.invalid`, eventos "Evento n" com um prefixo por execução, e feriados nacionais.

Ciclo de vida:
- `linhas` e `marcas` viram `null` em `concluida`, `desatualizada`, `falhou` e `expirou`. Há testes para os três primeiros estados.
- O fechamento da `na_fila` com mais de 1 h está neste gravar. O expurgo à 1h, que fecha o pior caso de cerca de 25 h, fica na 5.0, como o `docs/lgpd.md:73` já descreve.
- A tabela já estava classificada em `packages/shared/src/privacidade/classificacao.ts` e coberta pelo teste de eliminação do titular (`apps/worker/test/eliminar-titular.int.test.ts`), desde a 2.0.

Pergunta de fechamento: o código responde. Esta tarefa não grava nada novo sobre aluno. O que fica sobre a coordenação (autor e auditoria) está nas tabelas já mapeadas para o arquivo do titular e para a eliminação, e nada sai do sistema.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:360-364`: o comentário de `planilha.gravada` diz "o autor é a coordenação que gravou; se ela já saiu, a rotina". O código faz outra coisa: o motor fecha `desatualizada` e não audita (`motor.ts:178`), e a rotina não assina esta ação. Corrigir o comentário.
2. A partir da 6.0 e da 7.0, `candidatos` e `linhas` da prévia vão levar nome e matrícula. Vale manter o DTO da prévia estrito (`previaDaPlanilhaResponseSchema`) e decidir lá se a prévia de alunos pela coordenação precisa de auditoria de leitura (regra 20, item 10). Para o calendário não se aplica.
3. O limite de 1 MB do corpo JSON (`configure-app.ts:23`) vale para todas as rotas. Não é risco de privacidade, mas convém o `infra-guardian` confirmar que nenhuma rota depende do limite antigo de 100 KB.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-03 20:19:46 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As cinco divergências estão na `techspec.md` §4 e §5 e no `cenarios.md` ("Job e estados"). Ver a recomendação 3, sobre a §6.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:364`. O comentário da ação `planilha.gravada` diz "O autor é a coordenação que gravou; se ela já saiu, a rotina." Nem o código nem a spec fazem isso. Esta mesma tarefa decidiu que a importação de quem já saiu (`criado_por` nulo) termina `desatualizada`, sem gravar e sem auditoria, porque a rotina não assina essa ação (`auditoria_rotina_so_nas_acoes`). Isso está em `motor.ts:178`, na `techspec.md` §5 e no caso `importacao.int.test.ts:543`. O mapa das ações de auditoria é onde as tarefas 6.0 e 7.0 vão consultar quem assina, e lá a regra está escrita ao contrário. A autoconferência 7 afirma que os comentários foram relidos. Correção exigida: trocar por "O autor é a coordenação que gravou; a importação de quem já saiu não grava nem é auditada (sai `desatualizada`)" ou texto equivalente.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:80-84`. A `contagensDaPlanilhaGravada` foi colocada entre o JSDoc do `ACOES_DE_AUDITORIA` (linhas 74-79) e a declaração dele. Esse comentário ficou solto, sem a constante que descreve. Mover a constante para antes do bloco.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/system/job-definitions.ts:169`. O comentário diz "a fila `normal` e não urgente", mas o código tem `naoUrgente: false`. Quem lê entende o contrário. Escrever "urgente (`naoUrgente: false`)".
3. `techspec.md` §6 diz que "a 4.0 acrescenta o processor do worker à zona, nas duas guardas" (a do `contaDoProfessor`). Nesta tarefa isso não foi feito, e acertou em não fazer: o calendário não usa o passo (1), e a guarda exige que toda entrada da zona tenha quem a use. Mesmo assim, o texto da spec ficou desatualizado. Mudar para "a 6.0" antes que a 6.0 comece.
4. A forma da resposta é conferida em dois lugares diferentes: a prévia é validada no motor (`motor.ts:66`) e o gravar no service (`importacao.service.ts`). Escolher um lugar só.
5. O `LIMITE_DO_CORPO_JSON` de 1 MB vale para todas as rotas da API, não só para as de planilha. A decisão está registrada na spec, mas a 5.1 ("512 KB e 3.000 linhas só nessas rotas") é o momento de avaliar se o parser de 1 MB deve ficar só nas rotas `/v1/importacoes`. A palavra final é do `infra-guardian`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 20:19:55 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts:23`: o limite de corpo JSON subiu de 100 KB para 1 MB em todas as rotas, inclusive as sem autenticação (login, reivindicação). Só as duas rotas de `/v1/importacoes` precisam dele. Como o parser roda antes da guarda de rate limit, cada conexão aberta passa a poder segurar 10 vezes mais memória durante o login das 7h30. Sugestão: registrar o parser de 1 MB só no caminho `/v1/importacoes` antes do parser padrão de 100 KB, com um caso provando que um corpo acima de 100 KB em outra rota continua recusado.
- Ainda faltam peças que outras tarefas da spec cobrem, e a spec só pode pousar com elas prontas. Na 5.0: o limite próprio da prévia e do gravar (20 por minuto por usuário, duas prévias simultâneas por escola), o teto de 3.000 linhas, os três alertas com o parágrafo do runbook, o expurgo da `na_fila` parada e o `GET /v1/importacoes/:id`. Na 16.0: o cenário k6 `importacao-7h30.js`. Até lá, a rota nova só tem o limite global por usuário e por escola, e o texto pode trazer bem mais de 3.000 linhas dentro dos 512 KB.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/telemetry/metrics.ts:160`: a métrica `importacao.job` não separa por escola; a escola só aparece no log do job. Isso serve para o alerta de `falhou` acima de 20% em 1 h. Mesmo assim, vale confirmar na 5.0 que o tamanho e a idade da fila `normal` por escola, que vêm das métricas gerais da fila, aparecem no painel ao lado dos dois painéis novos.

Os dois arquivos de integração da tarefa (`apps/api/test/importacao.int.test.ts` e `apps/worker/test/gravar-planilha.int.test.ts`) passam: 39 de 39 testes. Os de unidade do motor (`leitor.test.ts`, `calendario.test.ts`, `motor.test.ts`) eu não rodei.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 20:21:07 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** prévia, depois gravar com 202 e job na `normal`, e o job conclui.
- **Validação (RF2):** gravar sem prévia com texto errado; marca fora dos candidatos.
- **Linha a linha (RF10):** data fora do ano; evento de um dia (o feriado no dia da prova); fim antes do início; tipo e descrição inválidos; linha repetida; linha incompleta.
- **Planilha suja do Excel:** separadores `;`, tab e `,`; cabeçalho em outra ordem, caixa ou acento; marcador do Excel; quebra de linha CRLF ou CR; aspas.
- **Ano de destino:** reimportar substitui só no ano de destino; a prévia mostra o que entra, o que já existe e o que sai; sem ano em curso, só com o filtro do planejado; filtro com ano de outra escola, encerrado, em curso ou inexistente.
- **Concorrência:** clique duplo em gravar; job executado duas vezes; `encerrar` do ano junto com o job, nas duas ordens.
- **Estados do job:** `na_fila` velha e `nowait`; assinatura diferente antes do passo (2) e entre o (2) e o (3); ano encerrado; `lock_timeout` com o ano solto e com o ano sempre travado; falha no segundo lote; único violado; falha definitiva; quem gravou já saiu.
- **Isolamento:** payload adulterado; repository escola A contra B; `turmaId` e marca da B.
- **Permissão:** professor e aluno.
- **Auditoria e log:** auditoria sem nome; log sem a linha.

**Cobertos:** todas as 25 linhas da tabela de testes têm o caso citado pelo nome. Cada item separado por ponto e vírgula também tem o seu, incluindo o "quem gravou já saiu" e os quatro de falha definitiva.
- **Testes rodados:** as duas suítes de integração (39 casos) e as três de unidade (20 casos) passaram.
- **Corridas:** o "gravar duas vezes" usa `Promise.all` de verdade. As outras corridas têm a ordem forçada (`WriteBlockTrigger` e `esperarNaTrava`) e conferem o efeito no banco, na métrica e na auditoria.
- **Mutações:** são 74 blocos, e o `--faltando` lista 17 linhas. As 17 têm motivo escrito. 16 motivos se sustentam; um não (abaixo).
- **Proibidos:** não há `.skip`, `.only`, teste comentado nem `any`.
- **Sem mock de coisa nossa:** o enfileirador falso do teste do worker não esconde a regra, porque a API prova o outbox real (`job_registro`).

**Bloqueantes:**
1. **`packages/core/src/importacao/importacao.repository.ts:96`: a cláusula `eq(anoLetivo.escolaId, requireEscolaId())` do `anoPorId` não tem teste que a prove.**
   - **Por que o motivo não basta:** o motivo (4) da seção "Mutações" diz que o único chamador passa o ano da linha da importação, que a FK composta prende à escola. Isso é confiar em quem chama, que a regra 10, item 3, não aceita como garantia. A regra 10, item 5, pede que remover a cláusula de escopo do repository quebre um teste, e hoje nenhum quebra.
   - **O risco:** o `ImportacaoRepository` é exportado por `@educa/core` e as tarefas 5.0, 6.0 e 7.0 vão chamá-lo.
   - **Correção exigida:** no caso `apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado`, acrescentar `expect(await noContexto(a, (r) => r.anoPorId(b.anoId))).toBeUndefined()`, com e sem `travar`. No `4_task.md`, trocar o motivo (4) por um bloco ` ```mutacao ` que tira a cláusula e cita esse caso. É o mesmo padrão que o caso já usa para `eventosDoAno` e `apagarEventos`.

**Recomendações:**
- **Asserção de prazo em `apps/api/test/importacao.int.test.ts:341`:** o `expect(Date.now() - inicio).toBeLessThan(1_000)` mede o tempo de uma chamada HTTP e é a única asserção da tarefa que depende da máquina. Sem o `nowait`, o gravar ficaria parado até o tempo limite de consulta do pool e não sairia `CONFLITO`, então a asserção de `CONFLITO` já prova a regra. Vale tirar a de tempo ou trocar por uma prova que não dependa do relógio da máquina.
- **Janela de 1 s nas corridas:** estes casos dependem de o teste soltar a trava em menos de 1 s:
  - em `apps/api/test/importacao.int.test.ts`: `[P] encerrar … parado` (398) e `[P] … já encerrado` (418);
  - em `apps/worker/test/gravar-planilha.int.test.ts`: `[P] duas execuções` (134) e `assinatura que muda entre o (2) e o (3)` (288).

  O motivo é que o `lock_timeout` de 1 s do passo (3) também vale para a trava consultiva do `WriteBlockTrigger` e para o `for update` que o segurador prende. Hoje a margem é de umas 20 vezes. Se a esteira ficar intermitente, a saída é receber os tempos do passo (3) por `ExecucaoOptions` nesses casos e manter o valor real no "ano travado por mais de 1 s".
- **Comentário em `packages/shared/src/system/job-definitions.ts`, perto da linha 169:** ele diz "a fila `normal` e não urgente", mas o código tem `naoUrgente: false`. Corrigir o texto.
- **Bloco para o `lock_timeout`:** o `set_config('lock_timeout', '1000', true)` do `limitesDoPasso3` (`importacao.repository.ts:174`) não tem bloco próprio. Hoje o caso "ano sempre travado" o pega por tabela, porque sem ele o erro vira `57014` e o código sai `erro_interno`. Um bloco que muda o valor deixaria isso explícito.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 20:33:19 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita. O comentário de `planilha.gravada` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:364-365` agora diz que a importação de quem já saiu não grava, não é auditada e sai `desatualizada`, porque a rotina não assina essa ação (`auditoria_rotina_so_nas_acoes`). Isso bate com `motor.ts:179-186`: lá `desatualizar` retorna antes de `auditar`.

O que conferi no diff:
- **Recomendação 1:** feita. O JSDoc de `ACOES_DE_AUDITORIA` voltou para cima de `export const ACOES_DE_AUDITORIA`, e o duplicado acima de `contagensDaPlanilhaGravada` saiu.
- **Recomendação 2:** feita. O comentário em `packages/shared/src/system/job-definitions.ts:169` agora diz "urgente (`naoUrgente: false`)", que é o valor declarado na linha 178.
- **Recomendação 3:** feita. A `techspec.md` §6 passou a atribuir à 6.0 a entrada do processor do worker na zona do `contaDoProfessor`. A 4.0 não usa o `contaDoProfessor` no worker, e `tools/guardas/camadas.cjs:165` continua prendendo a chamada a `sessao/`.
- **`importacao.int.test.ts:338`:** a asserção de tempo saiu e o `CONFLITO` ficou. Esse `CONFLITO` só sai com o `nowait`, porque sem ele o gravar ficaria esperando a trava. O caso continua provando a regra.
- **`gravar-planilha.int.test.ts`:** os casos novos derrubariam o teste se o escopo saísse do repository.
  - O `anoPorId`, com e sem `travar`, não acha o ano de B no contexto de A. O filtro por `requireEscolaId()` fica em `importacao.repository.ts:96`.
  - O `inserirEventos` no ano de B, com o contexto de A, é recusado pela FK composta, e as contagens das duas escolas não mudam.

Recomendações: nenhuma nova. A 4 (validar a resposta em um lugar só) foi para o `TODO.md` e a 5 (parser de 1 MB só nas rotas de planilha) foi para a 5.1. Os dois destinos estão registrados no `4_task.md` com o motivo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 20:33:47 · `tasks/prd-onboarding-por-convite/4_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada conferi a correção exigida, as duas recomendações que a Mesa mandou aplicar e o que o diff afeta.

Cobertos:
- **Correção 1 (escopo do `anoPorId`), feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha.int.test.ts`, o caso `o repository: as trocas de estado` agora testa o ano de B lido pela escola A, com e sem `travar`, e espera `toBeUndefined()`. Testa também o ano de B lido pela própria B, nos dois modos, e espera `toMatchObject({ id: b.anoId })`. Esse controle positivo impede que o teste passe porque a função simplesmente nunca acha nada. Se a cláusula `eq(anoLetivo.escolaId, requireEscolaId())` sair de `importacao.repository.ts:96`, a escola A passa a achar o ano de B e o caso fica vermelho pelo motivo certo. O bloco ```mutacao novo do `4_task.md` (linhas 762 a 769) tira exatamente a linha 96 e cita esse caso. O motivo (4) antigo saiu da lista "Sem bloco", e a contagem passou para 75 blocos e 16 linhas com 14 motivos, o que bate com a lista.
- **Caso extra, que não foi exigido.** `inserirEventos` com o contexto de A no ano de B é recusado pela FK composta. O teste confere que nenhuma das duas escolas recebeu o evento (B segue com 1, A com 0).
- **Asserção de tempo tirada** de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao.int.test.ts`, caso `velha travada por um job que roda`. Isso não deixou o `nowait` sem teste. O pool tem `statement_timeout`, conferido em `packages/core/src/db/pool.ts:186` e `pool.int.test.ts:49`. Sem o `nowait`, o `select` esperaria a trava até esse limite, que devolve o erro 57014. O código sairia como `erro_interno`, e o `toEqual(CONFLITO)` ficaria vermelho. O comentário novo diz isso corretamente. O caso já não depende da máquina estar folgada.
- **Comentários corrigidos.** `job-definitions.ts` diz "urgente (`naoUrgente: false`)". Em `acoes.ts`, o JSDoc de `ACOES_DE_AUDITORIA` voltou para cima da constante certa, e o de `planilha.gravada` explica que a importação de quem já saiu não grava. A `techspec.md` §6 passou de 4.0 para 6.0. Nenhuma dessas mudanças altera comportamento.
- **Os dois arquivos rodaram verdes:** `gravar-planilha.int.test.ts` com 14 de 14 e `importacao.int.test.ts` com 25 de 25. Não há `.skip` nem mock novo.

Bloqueantes: nenhum.

Recomendações:
1. `4_task.md:118`: o motivo (4) saiu, e com isso o novo (4) `:114` e o (5) `:118` vêm logo depois de `acoes.ts:80`. Quem lê entende que são linhas do `acoes.ts`, mas são de `importacao.repository.ts`. A correção é escrever `importacao.repository.ts:114` no novo (4).
2. `4_task.md:57`: na tabela de testes, a linha do `nowait` cita a mutação "`nowait`", mas o bloco das linhas 236 a 242 tira o `catch` que converte o erro em `CONFLITO`, e não a opção `{ noWait: true }` da linha 113. Pelo raciocínio acima, o caso já pegaria a retirada da opção. Fica de sugestão um bloco próprio para ela, que deixaria isso provado pelo portão em vez de só argumentado.
