# Achados das revisões — `tasks/prd-onboarding-por-convite/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 18:35:12 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não cria nem altera escrita em `Nota`. A importação aceita só quatro tipos de planilha: `alunos`, `professores`, `grade` e `calendario` (`TIPOS_DE_PLANILHA` e o check `importacao_planilha_tipo_valido`). Nenhum cabeçalho em `CABECALHOS_DA_PLANILHA` traz nota ou conceito, e nenhuma tabela nova tem campo de nota. Todos com autor humano? Não se aplica, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. As marcas `transferir`, `desligar` e `encerrar` são ids que a coordenação marca na prévia. A importação só age sobre elas e não decide nada sozinha. Nada nesta tarefa envolve IA nem promoção, retenção ou encaminhamento.

Aprovação registrada: ok. Nenhuma saída de IA é criada nem alterada.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo, e a governança não foi tocada.

Bloqueantes: nenhum.

Como cheguei a esse veredito:
- Os itens 1 a 6 da regra 70 ficam fora do diff. Nenhum arquivo do diff está em `ia/`, `tutor/`, `governanca/`, `entrega/`, `artefato/`, `assistente/` ou `docs/regulacao.md`. Uma busca nos arquivos novos por nota, IA, agente, tutor e autonomia também não achou nada.
- Item 7, supervisão sem vigilância: `alocacao` guarda vínculo, dia, horário e sala. `evento_calendario` guarda tipo, datas e descrição. Nenhuma das duas mede comportamento, tempo ocioso ou navegação.
- Item 8, nada de nota sugerida em discursiva e redação (D55): não há campo, contrato ou texto que proponha nota.
- Item 9, medir o professor não é vigiar (D45 e D64): `alocacao` é a agenda do professor e está classificada como dado pessoal dele (`packages/shared/src/privacidade/classificacao.ts`). O `resumo` da importação aceita só uma lista fechada de contagens agregadas (`resumoDaImportacaoSchema`, estrito), sem métrica, ranking ou indicador por professor. `importacao_planilha.criado_por` é da coordenação e não alimenta nenhuma métrica.

Recomendações:
1. Se algum dia surgir um tipo de planilha com nota (por exemplo, "notas do bimestre" importadas de outro sistema), ele precisa passar pela construção de `Nota` com `lancadaPor` humano e ganhar um teste próprio. Vale um comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts`, junto de `TIPOS_DE_PLANILHA`, lembrando que acrescentar um tipo com nota reabre a regra 70 item 1.
2. Quando a 4.0 em diante gravar `alocacao`, nenhuma leitura da grade pode virar indicador de professor na coordenação, como aulas por professor ou carga comparada (regra 70 itens 8 e 9). Fica para a auditoria daquelas tarefas.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 18:35:19 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:**
- `alocacao`: tem `escolaId` e `anoLetivoId`. A FK composta `(escola_id, ano_letivo_id, vinculo_id)` aponta para o alvo novo `vinculo_escola_ano_id_unico`. O id é `uuidv7()`.
- `evento_calendario`: tem `escolaId` e `anoLetivoId`, com FK composta para `ano_letivo(escola_id, id)`. O id é `uuidv7()`.
- `importacao_planilha`: tem `escolaId`. O `anoLetivoId` só fica nulo quando o tipo é `professores` (check `importacao_planilha_ano_ou_professores`). Há FK composta do ano com a escola e do `criado_por` com a escola (`set null ("criado_por")`). O id é `uuidv7()`.
- `turma.chave`: o único parcial é `(escola_id, ano_letivo_id, chave)`. O preenchimento retroativo na migration agrupa por `escola_id, ano_letivo_id, chave`.
- `vinculo.origem`: tem check de lista fechada. O `UNIQUE(escola_id, ano_letivo_id, id)` novo só aumenta o que a FK pode alcançar.

**Queries verificadas:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/turma.repository.ts`: `criar` (linha 333) tira a escola e o ano de `requireEscolaId()` e `requireAnoEmCurso()`. `renomear` (linhas 347-353) recalcula a `chave` no mesmo `update` e mantém o `where` com escola, ano e id vindos da sessão.
- `leitura-do-titular.ts`: a coluna `origem` entrou no `select` do vínculo, e o filtro por `escola_id` e titular continua lá.
- `previaDaPlanilhaRequestSchema` e `gravarPlanilhaRequestSchema` são `strictObject` e não aceitam `escolaId` no corpo.
- Nenhuma tabela nova tem endpoint nem repository nesta tarefa. Não há `@Unscoped()` novo.
- O `CONFLITO` da chave repetida não revela nada de outra escola, porque o único é por escola e ano. O teste confere que a resposta sai sem o valor e sem o nome da restrição.

**Teste de isolamento:** presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/schema/f2-planilhas.int.test.ts`:
  - linhas 148-157: vínculo de outra escola, ano de outra escola e escola trocada na `alocacao`;
  - linhas 190-194: ano de outra escola no `evento_calendario`;
  - linhas 219-224: ano e autor de outra escola na `importacao_planilha`;
  - linhas 226-236: a fila única vale por escola;
  - linhas 257-263: a mesma chave em outra escola e em outro ano é aceita.
- `apps/api/test/estrutura.int.test.ts`: a escola B cria "8A" via API sem receber 409.
- Cada FK composta tem mutação declarada que a troca pela FK simples. Se a cláusula de escopo sair, o teste quebra.

**Bloqueantes:** nenhum.

**Recomendações** (todas para quando o endpoint e o repository dessas tabelas existirem):
1. `packages/shared/src/importacao/contratos.ts:55-56`: o corpo da prévia e do gravar recebe `turmaId` e `anoLetivoId` do cliente. O repository da 4.0 precisa achar os dois dentro da escola da sessão e devolver para id de outra escola a mesma resposta do id que não existe. A FK composta é só a última barreira. O teste de troca de id na API entra nessa tarefa.
2. `importacao_planilha_na_fila_idx (criado_em)` foi feito para varrer todas as escolas. A query do expurgo que usar esse índice vai precisar de `@Unscoped()` com a linha de justificativa.
3. `alocacao`, `evento_calendario` e `importacao_planilha` ainda não têm teste de isolamento pela API (escola A pedindo um id da escola B e recebendo 404). Ele tem de entrar junto com o primeiro repository de cada uma.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 18:35:51 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

Caminho quente tocado: migration

Rate limit: ok (a tarefa não cria endpoint novo nem limite novo)

Fila e prioridade: ok (a tarefa não cria job; o `estrutura.gravar-planilha` foi passado para a 4.4, de forma justificada)

Concorrência: protegida. "8º A" e "8A" criadas ou renomeadas ao mesmo tempo esbarram no índice único parcial `turma_chave_no_ano_unica`, e quem perde recebe `CONFLITO` sem o valor. O caso [P] está em `apps/api/test/estrutura.int.test.ts`, nos dois caminhos (criar e renomear). A segunda importação `na_fila` da mesma escola é barrada pelo único parcial `importacao_planilha_uma_na_fila_por_escola`.

Índice e paginação: ok. `alocacao_ano_idx` e `evento_calendario_ano_idx` começam por `(escola_id, ano_letivo_id)`. A cascata vinda do `vinculo` usa o único `(vinculo_id, dia_semana, inicio)`. Ainda não há query de listagem nesta tarefa.

Degradação de IA: não se aplica

Migration: compatível. Ela só acrescenta: tabelas novas, `turma.chave` nula e `vinculo.origem` com padrão constante, que no PG 11+ não reescreve a tabela. O código anterior ignora as duas colunas, e a chave nula não colide no índice parcial. O teste sobre o dado da A1 (`migracao-f2.int.test.ts`) prova que nada foi apagado e que a chave só é preenchida onde é única no ano. O runbook tem o procedimento para voltar a versão e depois reaplicá-la. Rodei `migracao-f2.int.test.ts`, `f2-planilhas.int.test.ts` e `estrutura.int.test.ts`: 45 de 45 passaram.

Métrica e alerta: ok (não há código novo de requisição no caminho quente nem alerta novo; o runbook ganhou um procedimento, sem regra de alerta)

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql:57` e `:87`: o `UNIQUE` e o `CHECK` no `vinculo` travam a tabela inteira enquanto o banco percorre as linhas (lock `ACCESS EXCLUSIVE`). Hoje passa, porque a tabela tem poucas dezenas de milhares de linhas e o deploy acontece fora do horário letivo. Quando a tabela crescer, o padrão é `CREATE UNIQUE INDEX CONCURRENTLY` + `ADD CONSTRAINT ... USING INDEX`, e `CHECK ... NOT VALID` seguido de `VALIDATE CONSTRAINT`. Vale deixar isso registrado no guia antes que o `vinculo` cresça.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql:74`: o SQL tira acento com `translate` sobre uma lista fixa de letras, e o JS (`normalizador.ts:14`) usa NFD com `\p{M}`. Os dois divergem nas letras fora da lista (ñ, ý) e, conforme o locale, em dígito e espaço Unicode. Se uma turma ficar sem chave por essa diferença, o único parcial não a protege. Um teste que compare `chaveDaTurma` com a conta SQL sobre os mesmos nomes evitaria isso. A mesma conta está copiada no runbook, com o mesmo risco de as duas versões se afastarem.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql:68`: o `importacao_planilha_na_fila_idx` não começa pela escola. Isso se aceita para a varredura global de expiração (no máximo uma linha `na_fila` por escola). A rotina que o usar na 4.x precisa vir com `@Unscoped()` e a justificativa.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 18:36:05 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados:
- `importacao_planilha.linhas` e `marcas`. Guardam, só durante a importação, o nome e a matrícula do aluno e o nome e o e-mail do professor.
- `importacao_planilha.criado_por` (o autor).
- `alocacao`, que é dado do professor pelo vínculo: dia, horário e sala.
- `vinculo.origem`.
- `turma.chave` e `evento_calendario` não guardam pessoa.
- Planilha de alunos só com `turma`, `nome` e `matricula` (`packages/shared/src/importacao/modelos.ts:9`). Nenhum campo proibido para aluno, e nenhum diagnóstico.

Fora da tabela de dados do docs/lgpd.md: nenhum. "Planilha em gravação", "Aula da grade" e "Evento do calendário" estão em `docs/lgpd.md:73-75`, com finalidade, base legal e retenção. A retenção casa com a classificação e com o prazo fixo `planilha_importada`. A coluna `origem` entrou na leitura do arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:128`).

Autorização por objeto: não se aplica nesta tarefa, que não cria rota nova. No banco, a `alocacao`, o `evento_calendario` e a `importacao_planilha` (ano e autor) têm FK composta com a escola. A chave da turma criada ou renomeada é gravada pelo repository já escopado (`packages/core/src/estrutura/turma.repository.ts:123,141`). O `CONFLITO` sai sem o valor, sem o nome da constraint e sem "turma_", e o teste prova isso (`apps/api/test/estrutura.int.test.ts`, caso "dá CONFLITO sem o valor").

Logs: limpos. Nenhum log novo no diff.

Auditoria: não há ação desta tarefa que a regra 20 exija auditar. A `planilha.gravada` fica para a 4.0.

Envio externo: nenhum.

Seed/fixture: sintético. São nomes genéricos ("Maria Souza", "Ana Lima", "Outro professor sintético") e turmas "8ºA" e "Turma Azul".

Bloqueantes: nenhum.

Recomendações:
1. **O professor não recebe a própria grade no arquivo do titular.** A `alocacao` ficou fora do arquivo (`packages/shared/src/privacidade/classificacao.ts:67`), mas `docs/lgpd.md:74` diz que o titular dela é o professor. Ele recebe o vínculo, mas não o dia, o horário nem a sala. O comentário diz "não é desta tarefa" e nenhuma tarefa futura tem isso registrado. Sugiro pôr na 11.0, que é quem grava a alocação, a leitura da alocação pelo vínculo no arquivo do professor, ou anotar a exclusão e o motivo na linha da `docs/lgpd.md`.
2. **Aluno eliminado com importação na fila.** Se o aluno for eliminado enquanto há importação `na_fila`, o nome e a matrícula dele continuam em `importacao_planilha.linhas` até o job terminar ou o expurgo fechar a importação, por até cerca de 25 h. Esse dado em trânsito também não entra no arquivo do titular. Isso está documentado na `docs/lgpd.md`; vale dizer na 5.0 ou na 15.0 que a eliminação não espera o gravar, ou que anula as `linhas` das importações na fila da escola.
3. **Auditoria da prévia.** O `candidatoDaMarcaSchema.rotulo` (`packages/shared/src/importacao/contratos.ts:150`) leva o nome e a matrícula de alunos que já estão no banco para a coordenação. Quando a rota da prévia nascer (3.0 ou 4.0), confirme se isso conta como leitura de dado de aluno pela coordenação e pede auditoria, ou deixe escrito por que não pede.
4. **Sala.** A `alocacao.sala` é texto livre sem limite. Um teto de tamanho e o mesmo aviso do calendário ("não escreva nome de pessoa") deixariam a coluna coerente com a `evento_calendario.descricao`.

Rodei os testes de unidade dos contratos e normalizador das planilhas, de `apps/api/test/contracts.test.ts` e da classificação e retenção: 6 arquivos e 55 testes passaram. Os testes de integração (migration, checks, FKs e eliminação) eu li, mas não rodei.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/privacidade/classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/modelos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/turma.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/eliminar-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/lgpd.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-03 18:36:39 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Sobre o escopo e as divergências:
- Os contratos de `GET /v1/grade` e `GET /v1/calendario` entram em `contratos.ts`. Não contam como invasão de escopo: a tabela de testes da própria tarefa pede "a grade sai sem e-mail" em `contracts.test.ts`.
- A definição do job foi da 2.2 para a 4.4. A mudança está registrada no `2_task.md`, no `4_task.md` e no `tasks.md`, e a Tech Spec não muda.
- A guarda `tabelas-do-nucleo.mjs` recebeu as três tabelas novas, e isso também está registrado.

Recomendações:
1. **Aula da grade fora do arquivo do titular, sem destino** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/privacidade/classificacao.ts:63-67`).
   - O `docs/lgpd.md` diz que o titular da aula da grade é o professor. Mesmo assim, a `alocacao` ficou fora do arquivo do titular, com a justificativa "não é desta tarefa".
   - Nenhuma tarefa ficou com isso: falta registrar onde vai (12.0 ou `TODO.md`) e confirmar com o `privacy-guardian`.
   - Hoje o professor que pede o arquivo recebe o vínculo, mas não o dia, o horário nem a sala (regra 20, item 19).
2. **FK da `alocacao` para o ano** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/schema/alocacao.ts:98-101`).
   - A §3 diz que "toda tabela nova com ano tem FK composta (escolaId, anoLetivoId) para ano_letivo". A `alocacao` não tem essa FK direta e se apoia na FK composta para o `vinculo`.
   - Na prática dá no mesmo, porque o vínculo leva à turma e a turma leva ao ano, e a linha da `alocacao` na §3 sustenta essa leitura.
   - Vale uma linha na tabela de divergências da tarefa para essa leitura não ser questionada depois.
3. **Turma da vitrine sem chave** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/vitrine/escola.ts:215`). A vitrine insere turma sem `chave`, então a escola de demonstração não vai casar a planilha pela chave. Os scripts de carga em `infra/scripts/` fazem o mesmo, mas lá o impacto é menor.
4. **A migration não faz exatamente a mesma conta que `chaveDaTurma`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql:69-74`).
   - O comentário diz que é a mesma conta, mas o `translate` só cobre uma lista fixa de acentos. Fora dela ("ñ", outros diacríticos e talvez o NBSP, conforme o `\s` do Postgres), a migration deixa a chave nula onde o TypeScript calcularia uma.
   - O erro vai para o lado seguro, já que a classificação calcula pelo nome quando a chave é nula, mas o comentário deveria dizer que a conta é aproximada.
5. **Erro de digitação** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/modelo-de-dados.md`, na linha da `ImportacaoPlanilha`: está "criadoPor? ," com um espaço sobrando antes da vírgula.
6. **Subtarefas desencontradas** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/tasks.md`. As subtarefas 2.x continuam sem marcar, enquanto o `2_task.md` já as marca como feitas. Ou se alinha agora, ou se confirma que a marcação no `tasks.md` só acontece no pouso.
7. **Nota sem efeito no veredito:** o comentário de `alocacao.ts` diz que quem grava é o job da grade (11.0), e o `importacao-planilha.ts` e o `modelo-de-dados.md` dizem "4.0 em diante". As duas versões estão corretas, cada uma para a sua tabela.

## test-engineer · 1ª rodada · APROVADO · 2026-11-03 18:38:09 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** criar "8º A" grava `chave = 8a`. Renomear recalcula a chave no mesmo `update`. As tabelas novas aceitam linha válida. A migration só expande.
- **Bordas do domínio:**
  - planilha com a turma escrita de vários jeitos ("8ºA", "8º A", "8A", "8a", "8º ano A", "8ª A", "8° a", "8ºÁ");
  - nome fora do padrão ("Turma Azul", "10A");
  - virada de ano, com a mesma chave em 2027;
  - duas turmas antigas de mesma chave no ano, que ficam as duas nulas;
  - eliminação do professor que gravou planilha e tem aula na grade.
- **Permissão:** a tarefa não cria rota. Criar e renomear turma seguem nas rotas da coordenação, já testadas antes. O que cabe aqui é o autor de outra escola recusado pela FK composta e o `escolaId` recusado no corpo da prévia e do gravar.
- **Isolamento:** vínculo, ano e autor de outra escola recusados pelas FKs compostas. A mesma chave na escola B é aceita, pela API e no banco.
- **Concorrência:** "8º A" e "8A" criadas em paralelo, e duas renomeações em paralelo.

**Cobertos:** as 16 linhas da tabela "Testes que provam a regra" têm teste.
- **Migration sobre dado da A1:** `migracao-f2.int.test.ts › só expande`, e `› a chave das turmas que já existiam nasce só onde é única no ano` para as duas de mesma chave.
- **Chave igual e chave nula:** `normalizador.test.ts`, nos casos "8ºA"… e "Turma Azul" e "10A".
- **Criar, renomear para nula, `CONFLITO`, outro ano e escola B, e o [P]:** `estrutura.int.test.ts`, nos três casos `F2, RF3`.
- **[P]:** é concorrência de verdade. São dois `POST` e dois `PATCH` em `Promise.all`, com nomes que o único do nome não pega ("8º A" contra "8A", "8 Z" contra "8ºz"). Só o único parcial da chave decide.
- **Checks e FKs compostas de `alocacao`, `evento_calendario` e `importacao_planilha`, e o único na fila:** `f2-planilhas.int.test.ts`.
- **Eliminação:** `eliminar-titular.int.test.ts › F2, RF17`.
- **Grade sem e-mail:** `contracts.test.ts › F2, RF17: a grade sai sem e-mail`.
- **`resumo` estrito:** `contratos.test.ts › recusa chave que não é contagem`.

Conferi os 42 blocos de mutação contra o diff e o teste citado por cada um. Todos ficam vermelhos por uma asserção que roda, não por erro de carga. Alguns exemplos:
- o `WHERE total >= 1` faz a criação do índice único falhar dentro do caso `só expande`;
- o `PARTITION` sem o ano deixa a turma de 2026 e a de 2027 sem chave;
- o `.set({ nome })` mantém a chave antiga depois de renomear para "9B".

Os três motivos e o `UNIQUE` do `vinculo` sem bloco estão corretos. Não há `.skip`, teste comentado nem mock de código nosso, e a tarefa não chama IA.

Rodei os testes e todos passaram:
- unidade: 34 casos, em `packages/shared/src/importacao` e `contracts.test.ts`;
- integração: 22 casos, em `f2-planilhas` e `migracao-f2`;
- integração `-t F2`: 24 casos, em `estrutura` e `eliminar-titular`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A conta da chave está escrita três vezes e nenhum teste confere que dão o mesmo.** Ela está em TypeScript (`normalizador.ts`), no SQL da migration (`0040_f2_planilhas.sql:72-85`) e no SQL do runbook (`docs/runbook.md`, "Voltar o código depois da chave da turma"). Hoje há divergências possíveis:
   - o `\s` do JS pega espaço não separável e tabulação, e o do Postgres talvez não;
   - o `btrim` só tira espaço;
   - o `translate` tem lista fixa de acentos, e o JS tira qualquer acento.

   Um caso que passe a lista do `normalizador.test.ts` pelo `regexp_match` da migration e compare com `chaveDaTurma` prenderia as escritas (e outro, que compare o texto do runbook com o da migration, prenderia o runbook).
2. **Restrições novas sem bloco nem motivo.** O `importacao_planilha_escola_id_unico` (`0040_f2_planilhas.sql:48`) é hoje o único índice de `importacao_planilha` que começa pela escola e serve a leitura por id. O caso `› cada um começa pelo escopo` poderia incluí-lo, ou o documento pode dizer o motivo. O mesmo vale para as três FKs simples para `escola` (`:58`, `:60`, `:62`); a de `importacao_planilha` é a única que segura a escola quando o ano é nulo (planilha de professores).
3. **`migracao-f2.int.test.ts` tem casos que dependem da ordem.** O 2º e o 3º leem o que o 1º semeou e migrou, então rodados sozinhos com `-t` ficam vermelhos. Semear e migrar no `beforeAll` (e deixar o "só expande" comparar o retrato de antes e de depois) resolveria.
4. **"Como testar" no `2_task.md` cita testes que não são desta tarefa.** Cita `mvp-tables.int.test.ts › turma, disciplina, …` para os checks e as FKs, mas o teste real é `f2-planilhas.int.test.ts`. E o [P] já está escrito com a chave, não só com o nome igual.
5. **Duas linhas da tabela testadas por equivalente.**
   - "Renomear para 'Turma Azul'" é testado com "Turma Verde". O resultado é o mesmo; alinhar o texto evita dúvida na validação.
   - "`alocacao` com o ano de outra escola" é provado pelos casos de vínculo da B, escola da B e ano de 2027 da mesma escola, que pegam a mesma FK. Um caso literal (ano da B, vínculo da A) é opcional.
6. **Schema TypeScript diferente do SQL na FK do autor.** `importacao-planilha.ts:46` declara `.onDelete('set null')`, e a migration diz `set null ("criado_por")`. Hoje o banco vem do SQL, mas um próximo `drizzle-kit generate` pode regerar a FK no formato do TypeScript (anulando também a escola) sem ninguém ver. Isso é da alçada do `infra-guardian`.
7. **Único da fila sem teste paralelo.** O único de uma importação `na_fila` por escola está provado em sequência, no banco, o que basta para a restrição. O [P] de dois "gravar" em paralelo pertence à 4.0 e precisa ser cobrado lá.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/drizzle/0040_f2_planilhas.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/schema/f2-planilhas.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/migracao-f2.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/normalizador.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/estrutura.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/contracts.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/eliminar-titular.int.test.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 19:01:33 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. A 1ª não exigiu correção nenhuma, então auditei só o diff da rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/diff-2_task-r2.patch`, lido inteiro) e o que ele afeta. Rodei `migracao-f2.int.test.ts` e `f2-planilhas.int.test.ts`, que passaram com 25 de 25. Rodei também os casos de chave de `estrutura.int.test.ts`, que passaram com 2 de 2.

Cenários exigidos (o que mudou nesta rodada):
- A conta da chave em SQL, na migration e no runbook, nunca dá uma chave diferente da do `chaveDaTurma` do TypeScript. Onde as duas se afastam, o SQL deixa a chave nula.
- O SQL do runbook ("Voltar o código depois da chave da turma") é a mesma conta da migration.
- Uma escola que não existe é recusada na planilha de professores, que não tem ano: só a FK simples da escola segura esse caso.
- O índice `importacao_planilha_escola_id_unico` começa pela escola (regra 80, item 8).
- Na migration, só as turmas cuja chave é única no ano recebem a chave. O bloco de mutação foi refeito para ficar vermelho pelo motivo certo.

Cobertos:
- **Conta da chave igual nas duas escritas.** O teste `migracao-f2.int.test.ts › a conta da chave em SQL (a da migration, a mesma do runbook) dá a mesma chave que o chaveDaTurma…` tira o `regexp_match` do próprio `.sql` e o roda no Postgres sobre 24 nomes. A lista inclui acento, "ano", tab, vazio, "10A" e "8ºAB". Os quatro casos de divergência (ñ, ÿ, quebra de linha na ponta, U+00A0) são afirmados como nulos no SQL. As asserções são sobre o valor da chave.
- **Runbook igual à migration.** O teste `› o SQL do runbook … faz a mesma conta da migration` compara o texto das duas. Se alguém mudar uma escrita sem a outra, ele fica vermelho.
- **Escola inexistente.** O teste `f2-planilhas.int.test.ts › a escola que não existe é recusada…` passa `ano_letivo_id` nulo, e o `importacao()` não traz `criado_por`, então as duas FKs compostas são puladas (MATCH SIMPLE). Com a mutação `SELECT 1`, a linha entra e o teste fica vermelho pelo motivo certo. A asserção está no nome exato da restrição, e há um par positivo na mesma escola.
- **Ordem do índice.** O teste `› cada um começa pelo escopo` exige `(escola_id, id)` no `indexdef`. A mutação `UNIQUE("id","escola_id")` carrega, porque a FK do Postgres casa as colunas em qualquer ordem, e falha na regex. O bloco é coerente.
- **Mutação `WHERE "total" = 1`.** A troca de `>= 1` (que dava erro de carga no `CREATE UNIQUE INDEX`, motivo errado) por `= 0` faz com que nenhuma turma ganhe chave. Assim o caso "nasce só onde é única" fica vermelho pela asserção. A exclusão das repetidas sem bloco está justificada na seção "Mutações": tirá-la só produz erro de carga, e o caso `6ºA`/`6 a` confere o resultado.
- **Refatoração para `beforeAll`.** O seed, os dois retratos e a migração passaram para o `beforeAll`, com prazo de 240 s, e cada caso roda sozinho com `-t`. O caso "aplicada de novo" continua migrando outra vez sobre o banco já migrado, então a idempotência segue provada.
- **Troca de nomes em `estrutura.int.test.ts`.** "Turma Azul" e "Turma Verde" viraram "Turma Branca" e "Turma Azul". As asserções não mudaram (chave nula, depois `7c`, e a chave fora da resposta).
- **Motivos novos sem bloco.** As FKs simples de `alocacao` e `evento_calendario` para `escola` ficam cobertas pelas FKs compostas, então a mutação nunca ficaria vermelha. O argumento confere com a migration. A seção "Mutações" diz 44 blocos e 6 motivos, e contei seis motivos no texto.
- **Tabela "Como testar".** Agora cita `f2-planilhas.int.test.ts` e `migracao-f2.int.test.ts` no lugar do `mvp-tables.int.test.ts`, que não era desta tarefa. O [P] da concorrência continua citado pelo nome.

Bloqueantes: nenhum.

Recomendações:
- O teste do runbook compara texto pela regex `/regexp_match\((.+)\) as achado/`. Se o runbook ganhar uma segunda ocorrência desse padrão, só a primeira é comparada. Vale ancorar a regex na seção "Voltar o código depois da chave da turma".
- Em `chavePelaMigration` (`migracao-f2.int.test.ts:124`), o `replace('"nome"', …)` troca só a primeira ocorrência. Hoje a conta tem uma só, mas `replaceAll` evita uma falha confusa se a conta passar a citar `nome` duas vezes.
- O bloco da ordem do índice (`UNIQUE("id","escola_id")`) prova o formato do índice, não uma regra que deixe dado passar. Está correto como guarda da regra 80, item 8. Só registro que ele cobre desempenho, não isolamento.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-03 19:01:33 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: há uma divergência na §3 (FK da `alocacao` para `ano_letivo`). Ela foi declarada só no `2_task.md` e não entrou na `techspec.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/2_task.md:97`: a linha nova da tabela de divergências diz que a `alocacao` não tem a FK composta `(escolaId, anoLetivoId)` para `ano_letivo`. A §3 da `techspec.md` continua exigindo essa FK sem exceção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md:29`: "toda tabela nova com ano tem FK composta `(escolaId, anoLetivoId)` para `ano_letivo`"), e a `techspec.md` não está entre os arquivos alterados.
   - **O que está errado:** a tarefa reconhece que diverge, mas a Tech Spec segue mandando o contrário. Uma divergência registrada só no `N_task.md` é bloqueante. A integridade do dado em si está garantida: a FK `(escola_id, ano_letivo_id, vinculo_id)` aponta para o `vinculo`, que leva à turma, e a turma tem a `turma_ano_letivo_da_escola_fk`.
   - **O risco:** quem implementar a 11.0, ou o `tenancy-guardian` dela, lê a linha 29 e "conserta" a migration já provada.
   - **Correção exigida:** mudar a frase da linha 29 da `techspec.md` para abrir a exceção. Por exemplo: "toda tabela nova com ano tem FK composta `(escolaId, anoLetivoId)` para `ano_letivo`, salvo a `alocacao`, que prende escola e ano pela FK composta do vínculo". Depois, trocar a coluna "Onde está na spec" da linha 97 do `2_task.md` para apontar para a frase nova. O `cenarios.md` não muda, porque nenhum cenário trata dessa FK.

Recomendações:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/migracao-f2.int.test.ts`: o `chavePelaMigration` reescreve a conta com `replace('"nome"', '$1::text')`, que só troca a primeira ocorrência. Se um dia a conta citar `"nome"` duas vezes, o teste roda uma conta diferente da migration sem avisar. Vale um `expect` de que sobrou zero `"nome"` depois da troca.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/estrutura.int.test.ts:499`: os nomes da turma mudaram (`Turma Azul` passou a `Turma Branca`, `Turma Verde` passou a `Turma Azul`) e o motivo não está registrado na tarefa. Se a troca evita colisão com outro caso, vale uma linha dizendo isso.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-03 19:10:20 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

A correção que pedi na 2ª rodada foi feita:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md:29` agora abre a exceção da `alocacao`. A frase diz que ela prende escola e ano pela FK composta do vínculo (`escolaId, anoLetivoId, vinculoId`). A linha 36 da §3 diz o mesmo, então a migration já provada não será "consertada" na 11.0.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/2_task.md:97` aponta, na coluna "Onde está na spec", para a frase nova da §3. A divergência não fica mais só no `N_task.md`.

O que mais mudou nesta rodada não cria problema:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/migracao-f2.int.test.ts:215-217,252`: a troca de `replace` por `replaceAll` faz o teste trocar todas as ocorrências de `"nome"`, e não só a primeira. O teste também ganhou uma conferência de que nenhum `"nome"` sobrou na conta. O teste fica mais forte e a regra provada é a mesma.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/2_task.md:50`: a linha cita o caso de renomeação em `estrutura.int.test.ts`. Conferi que a turma "Turma Branca" (linha 499) e o caso "Turma Azul" (linha 506) existem no teste.
- As duas linhas novas da tabela de recomendações do test-engineer (2ª rodada) trazem cada uma o seu motivo. Nenhuma esconde regra sem teste.

Recomendações:
- O teste do runbook compara só a primeira vez que a conta aparece. Se o runbook ganhar uma segunda cópia dela, vale prender a regex à seção "Voltar o código depois da chave da turma", como a própria tarefa já registrou.

## test-engineer · 3ª rodada · APROVADO · 2026-11-03 19:10:23 · `tasks/prd-onboarding-por-convite/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** nesta rodada só conferi o diff desde a 2ª (`diff-2_task-r3.patch`). Ele traz três mudanças:
- endurece a conta SQL da chave no teste da migration;
- cita, na tabela de testes, o teste da linha "Renomear para Turma Azul deixa a `chave` nula";
- registra na Tech Spec §3 que a `alocacao` é exceção à FK direta para o `ano_letivo`.

Não há código de produção novo no diff, então nenhuma mutação nova é exigida.

**Cobertos:**
- **Linha "Renomear para Turma Azul…" da tabela de testes (`2_task.md:50`):** o teste citado existe em `apps/api/test/estrutura.int.test.ts:494`. O laço das linhas 504-512 renomeia a turma para "Turma Azul" e confere `chave` nula no banco (linha 511), depois volta para "8º ano A" e confere `8a`. Se o recálculo no `update` sumisse, o valor voltaria a `9b` e o teste falharia. A outra turma do caso passou a se chamar "Turma Branca", o que evita o `CONFLITO` de nome repetido.
- **`packages/core/src/db/migracao-f2.int.test.ts:215-216 e 252`:** o `replace` virou `replaceAll`, e uma asserção nova garante que nenhum `"nome"` sobra na conta rodada. O teste ficou mais rígido, não mais frouxo: se a migration ganhar uma segunda ocorrência de `"nome"`, a comparação SQL contra TypeScript e a comparação do runbook continuam valendo, em vez de falhar por erro de carga ou comparar texto meio trocado. Rodei `npx vitest run packages/core/src/db/migracao-f2.int.test.ts` e os 5 casos passaram.
- **Tech Spec §3:** a exceção da `alocacao` agora está escrita na própria Tech Spec, e a linha da divergência no `2_task.md:97` aponta para ela. Bate com a FK `alocacao_vinculo_do_ano_da_escola_fk`, que já era provada pelos casos de `f2-planilhas.int.test.ts` na 1ª rodada.
- **Recomendações da 2ª rodada:** estão registradas na tabela de recomendações com o encaminhamento de cada uma, e as duas recusas têm motivo.

**Bloqueantes:** nenhum.

**Recomendações:**
- Continua valendo o que ficou registrado na 2ª rodada: se o runbook ganhar uma segunda cópia da conta, a regex `CONTA_NO_RUNBOOK` em `migracao-f2.int.test.ts:208` precisa ser ancorada na seção "Voltar o código depois da chave da turma".
