# Achados das revisões — `tasks/prd-onboarding-por-convite/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 21:27:20 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa (não há migration). As tabelas que as consultas novas tocam já têm `escolaId` e id UUID: `importacao_planilha`, `evento_calendario` (também com `anoLetivoId`), `vinculo` (também com `anoLetivoId`) e `ano_letivo`.

Queries verificadas:
- `ImportacaoRepository.lerPorId` filtra por `escolaId` vindo do contexto e não devolve `linhas` nem `marcas`. Não exige ano em curso, como a spec pede.
- `ImportacaoRepository.criadaEmDaNaFilaMaisAntiga` filtra por `escolaId` do contexto e `estado = 'na_fila'`.
- `CalendarioRepository.doAno` filtra por `escolaId` do contexto e pelo ano. O ano chega já validado por `anoDeDestino`, que também filtra pela escola do contexto.
- `CalendarioRepository.professorTemVinculoConfirmado` filtra por escola, ano em curso e `usuarioId` da sessão, com `papel` e `estado = 'confirmado'`, e é lido a cada chamada.
- `ExpurgoDaEscolaRepository.fecharImportacoesParadas` tem `escola_id` do contexto no `update` e no `select ... for update skip locked`.
- `ExpurgoDeAcessoRepository`, alvo `importacao_planilha`: entra no método `@Unscoped` que já existia, e a justificativa foi atualizada para citar a importação terminada (90 dias, sem a `na_fila`). É rotina nossa, devolve só a contagem e não atende requisição de escola.
- `SchoolSemaphore.ocupar(requireEscolaId())`: a chave `sem:importacao:{escolaId}` vem do contexto. O balde `rl:importacao:{usuarioId}` vem do token.
- Contratos: `calendarioQuerySchema` é estrito, e `escolaId` na query dá `ENTRADA_INVALIDA` (há teste). Nenhum endpoint aceita `escolaId` do cliente.
- Matriz: a rede tem `nunca` em `importacao_planilha.ler` e em `calendario.ler`, com as linhas correspondentes na expectativa.

Teste de isolamento: presente e efetivo. Conferi tirando a cláusula de escopo de cada consulta, uma por vez:
- Sem o `escolaId` em `lerPorId`, quebra `importacao.int.test.ts › isolamento: o id da importação da B, na A`. Ele também compara com o id inexistente, e as duas respostas são `NAO_ENCONTRADO`.
- Sem o `escolaId` em `doAno`, quebra `calendario.int.test.ts › o repositório do calendário só devolve o ano da escola do contexto`. O teste vai direto ao repository, para não ser mascarado pelo `anoDeDestino`.
- Sem o `usuarioId` ou o `estado` do vínculo, quebra `professor sem vínculo confirmado`, porque há um colega confirmado na mesma escola.
- Sem o `escola_id` do expurgo, quebra `expurgo-da-escola.int.test.ts › relógio falso`: a importação de B, com a mesma idade, fica.
- Sem o escopo da medição, quebra `importacao-gauge.int.test.ts › a importação de B não aparece na série de A`.
- Semáforo e balde: "a outra escola segue" e "outro usuário da escola segue".

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/importacao.int.test.ts`, caso "o id que não é UUID": a asserção é só `status >= 400`. Fixar o código esperado (o do `IdPipe`) para não aceitar um 500.
- `packages/core/src/importacao/calendario.repository.ts`: o repository de leitura do calendário mora em `importacao/`. Pensar em movê-lo para um módulo de calendário ou grade quando a 11.0, a 12.0 e a 14.0 chegarem.
- `ExpurgoDeAcessoRepository`: a justificativa do `@Unscoped` já cobre nove tabelas num método só. A regra 10, item 9, limita a contagem a anotações por módulo, e aqui continua sendo uma anotação, mas vale acompanhar se a lista continuar crescendo.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 21:27:35 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Os tipos de planilha são `alunos`, `professores`, `grade` e `calendario` (`packages/shared/src/importacao/contratos.ts:14`). Nem o motor da importação, nem o job `gravar-planilha`, nem os dois expurgos, nem a composição do worker mencionam `Nota` ou `lancadaPor`. Todos com autor humano? Sim, porque nenhum caminho novo grava em `Nota`.

Decisão autônoma sobre aluno: ausente. A tarefa cuida dos limites da importação, do fechamento da importação parada, da leitura do estado da importação e da leitura do calendário. Nada disso aprova, reprova ou encaminha aluno.

Aprovação registrada: ok, e nada a exigir aqui. A tarefa não produz saída de IA: não há chamada a provedor, nem agente, nem conteúdo gerado. A exceção do tutor (D47) também não aparece.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado ou alterado; a matriz ganha o recurso `calendario` e o `ler` de `importacao_planilha`, e nenhum dos dois tem relação com agente.

Os outros pontos da regra 70:
- **Item 7 (supervisão não é vigilância):** a métrica `importacao.minutos_na_fila` leva só `escola_id` e um número (`apps/worker/src/importacao-gauge.ts`). Os alertas não trazem importação nem autor (`infra/grafana/alertas/importacao-parada.yaml:4-6`). Não há inferência sobre aluno nem medição de comportamento.
- **Item 8 e D45 (medir o professor):**
  - O professor só lê o calendário, com vínculo confirmado lido a cada chamada (`packages/core/src/importacao/calendario.repository.ts`). Isso não gera indicador sobre ele.
  - O balde de 20 por minuto por usuário fica no Redis, vence sozinho e é exclusivo da coordenação. Não vira métrica, ranking nem registro consultável.
  - A resposta de `GET /v1/importacoes/:id` não leva `criadoPor`, nem `linhas`, nem `marcas` (`packages/core/src/importacao/importacao.repository.ts`, `lerPorId`).
- **D55 (discursiva e redação):** não se aplica, porque a tarefa não tem campo, tela ou prompt de avaliação.
- **`docs/regulacao.md`:** não foi alterado nem é contrariado pelo diff.

Bloqueantes: nenhum.

Recomendações:
- Se um dia aparecer um tipo de planilha de notas, ele reabre a regra 70 item 1: a importação em lote precisa gravar `lancadaPor` humano e passar pela validação registrada da D56. Vale deixar isso escrito ao lado de `TIPOS_DE_PLANILHA`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts`, para que a pessoa que acrescentar o tipo não ignore o aviso.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-03 21:28:59 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao.int.test.ts:733-738`, em conjunto com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts:45` (`app.use(limitarCorpoForaDaPlanilha)`).
  - **O que está errado:** a tarefa criou uma regra (corpo acima de 100 KB fora de `/v1/importacoes` é `ENTRADA_INVALIDA`, regra 80, item 3), e nenhum teste prova que ela funciona pela API.
  - O caso de integração manda `{ etapa, ano, enchimento: 'x'.repeat(101 * 1024) }` para `POST /v1/series`. Esse contrato é `.strict()` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/estrutura/serie.ts:30-35`), então o campo `enchimento` já dá `ENTRADA_INVALIDA` pelo `ZodValidationPipe`. Sem a linha 45, o leitor de 1 MB lê o corpo e o teste continua verde.
  - O `configure-app.test.ts` testa só a função solta. Nenhum bloco da seção "Mutações" cobre a linha 45.
  - Também não há prova de que o `DomainException` lançado num middleware Express cru chega ao `AllExceptionsFilter` como 400 tipado. Se não chegar, o handler padrão do Express responde 500 com stack trace fora de produção (regra 20, item 11).
  - **Correção exigida:**
    - Trocar o caso por um corpo que o contrato aceitaria se não fosse o tamanho, por exemplo `{"etapa":"ef_anos_finais","ano":7}` seguido de 101 KB de espaço em branco (JSON válido). O teste deve conferir `ENTRADA_INVALIDA` com o status 400 e nenhuma série gravada.
    - Acrescentar o caso de controle: o mesmo corpo com 100 KB exatos é aceito.
    - Registrar em "Mutações" o bloco que remove `app.use(limitarCorpoForaDaPlanilha)`, apontando para esse caso.

Recomendações:
- O `delete` de `importacao_planilha` no `sistema.expurgar-acesso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/retencao/expurgo-de-acesso.repository.ts`, filtro `estado <> 'na_fila' and concluida_em < ...`) varre a tabela de todas as escolas sem índice. Hoje a tabela é pequena. Se o volume crescer, um índice parcial em `concluida_em where estado <> 'na_fila'` resolve.
- `GET /v1/calendario` não é paginado. O tamanho fica limitado porque a importação substitui os eventos do ano (até 3.000). Vale escrever esse limite na Tech Spec §4, para ninguém acrescentar escrita incremental sem paginar.
- Um corpo sem `Content-Length` (enviado em pedaços) passa pelo middleware e fica preso só ao leitor de 1 MB em qualquer rota. O comentário assume isso; fica registrado para a retro.
- A medição a cada 5 min mais o `for: 1m` faz o alerta "parada na fila" disparar entre 31 e 36 min. Vale dizer isso no parágrafo do runbook.
- O fechamento da `na_fila` com mais de 1 h só roda no expurgo noturno ou no gravar seguinte. O runbook já fala em cerca de 25 h; vale repetir essa frase no `cenarios.md`, para ninguém ler "1 h" como "em tempo real".

Os testes unitários do semáforo, do teto de corpo, dos alertas e do `alerta-tem-runbook` passaram (36 de 36). Os de integração não foram rodados.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 21:29:10 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Rodei os testes de integração da tarefa: `calendario`, `importacao`, `expurgo-da-escola` e `expurgo-de-acesso`. Passaram os 203.

**Campos pessoais tocados:** nenhum campo novo. A tarefa só lê, expurga ou fecha colunas que já existiam.
- `importacao_planilha.linhas` e `marcas` (nome e matrícula do aluno, nome e e-mail do professor): ficam nulas quando a importação parada fecha.
- `importacao_planilha.criado_por`: não sai em resposta nenhuma.
- `evento_calendario.descricao`: texto livre, classificado "nenhum titular, por desenho".

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Planilha em gravação" (`docs/lgpd.md:73`) já traz a retenção que esta tarefa coloca no código: a importação parada fecha com 1 h, o dado fica no máximo cerca de 25 h e a linha final sai em 90 dias. O calendário está na linha 75.

**Autorização por objeto:** ok.
- `GET /v1/importacoes/:id`: o `lerPorId` (`packages/core/src/importacao/importacao.repository.ts`) filtra por `escolaId` do contexto. O id de outra escola responde `NAO_ENCONTRADO`, igual ao inexistente, e isso tem teste.
- `GET /v1/calendario`: o `anoLetivoId` do coordenador passa pelo `anoDeDestino` (só o ano da própria escola) e o `doAno` repete o escopo da escola. O professor precisa de vínculo `confirmado`, conferido a cada chamada, no ano em curso e com o `usuarioId` da sessão. Se mandar filtro de ano, ou não tiver vínculo, recebe a mesma resposta do inexistente.
- Aluno e rede ficam como `nunca` nos dois recursos da matriz.

**Exposição:** as duas respostas são montadas campo a campo.
- `importacaoSchema` é estrito e o repository escolhe as colunas uma a uma: sem `linhas`, `marcas` ou `criado_por`. O `resumo` só aceita uma lista fechada de contagens e o `erro` só aceita códigos de uma lista fechada.
- O teto de 100 KB está no middleware de `apps/api/src/configure-app.ts`. Conferi rodando o teste: o erro sai pelo filtro global como `ENTRADA_INVALIDA` tipado, sem stack trace.

**Logs:** limpos.
- O expurgo da escola loga só contagens (`importacoesFechadasTotal`).
- A medição da fila loga só o evento `worker.medicao_da_importacao_indisponivel`.
- A métrica `importacao.minutos_na_fila` leva só `escola_id`, sem id de importação nem autor.
- As consultas do runbook trazem só ids, estados e datas, e mandam nunca pedir a planilha por mensagem.
- As chaves `rl:importacao` e `sem:importacao` usam UUID.

**Auditoria:** nada novo exige. A leitura do estado da importação e a do calendário não levam dado de aluno, e a tarefa não altera nota, permissão nem saída de IA.

**Envio externo:** nenhum. A tarefa não usa IA.

**Seed/fixture:** sintético. São prefixos aleatórios ("Evento N", "turma xxxx", "disciplina …").

**Bloqueantes:** nenhum.

**Recomendações:**
1. O prazo de 90 dias da importação terminada (`RETENCAO_IMPORTACAO_DIAS`, em `packages/core/src/retencao/expurgo-de-acesso.repository.ts`) é fixo e vale para todas as escolas, não é configurável por escola. Bate com o `docs/lgpd.md` e com o tratamento de convite e sessão, porque é rastro operacional e não registro escolar. Se uma rede pedir prazo próprio, isso vira item da regra 20, item 16.
2. O `descricao` do calendário agora chega ao professor. Ele continua protegido só pelo texto da tela e do modelo da planilha, que pedem para não escrever nome de pessoa. Quando a tela do calendário entrar (tarefa 14.0), vale repetir o aviso ali.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/calendario.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/grade/calendario.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/importacao/importacao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/retencao/expurgo-de-acesso.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/lgpd.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-03 21:29:11 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §7c. Duas divergências estão registradas só no `5_task.md`: o documento diz que elas estão na §7c, e não estão.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. **O novo teto de corpo quebrou o envio de material.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts:30`, montado na linha 45.
   - **O que está errado:** o middleware `limitarCorpoForaDaPlanilha` recusa por `Content-Length` qualquer corpo acima de 100 KB fora de `/v1/importacoes`. Ele não olha o tipo do conteúdo. Com isso, `POST /v1/materiais` (multipart, até 20 MB pelo `MAXIMO_DE_BYTES_DO_MATERIAL`, com o `FileInterceptor` de `apps/api/src/material/material-upload.ts`) passou a responder `ENTRADA_INVALIDA` para qualquer PDF acima de 100 KB.
   - **Como confirmei:** rodei só este caso:
     `npx vitest run --project integracao apps/api/test/material.int.test.ts -t "exatamente no tamanho máximo"`
     Resultado: `expected 400 to be 201`, em `material.int.test.ts:333`. No HEAD (`a0e62a3c`) o middleware não existe, então a falha vem desta tarefa. O `e2e/material.spec.ts` deve cair pelo mesmo motivo.
   - **O texto novo da `techspec.md` §4 tem o mesmo defeito:** diz "o corpo de mais de 100 KB" fora de `/v1/importacoes`, sem restringir a JSON.
   - **Correção exigida:**
     - Limitar o teto ao corpo JSON, por exemplo conferindo o `content-type` `application/json` ou aplicando o limite no próprio leitor de JSON por rota.
     - Ajustar a frase da §4 e a linha "Corpo de outra rota" do `cenarios.md` para "corpo JSON".
     - Acrescentar ao `configure-app.test.ts` o caso do multipart grande que segue.
     - Rodar `material.int.test.ts` e renovar o carimbo do portão.

2. **Duas divergências que só existem no `5_task.md`.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/5_task.md:100-101`.
   - **O que está errado:** a tabela afirma que estas duas decisões estão na `techspec.md` §7c:
     - a métrica nova `importacao.minutos_na_fila`, por escola, medida pelo worker de lote, de que o alerta "na fila há 30 min" depende;
     - a validade de 30 s da vaga de planilha (`VALIDADE_DA_VAGA_DA_PLANILHA_MS`).

     A §7c não cita nenhuma das duas, e o diff da `techspec.md` só mexe na §4. O `cenarios.md`, tabela "Limites", também não traz o valor de 30 s. O comentário de `school-semaphore.ts:11-13` e o de `importacao-gauge.ts:15` apontam para essa mesma §7c, que não diz isso.
   - **Correção exigida:** escrever as duas decisões na §7c, na linha "Métrica e alerta" e na linha "Limites e corridas", e o valor de 30 s na linha "Prévias simultâneas" do `cenarios.md`. A alternativa é parar e reportar a divergência.

Recomendações:
- **Semáforo duplicado:** `packages/core/src/rate-limit/school-semaphore.ts` é um segundo semáforo por escola no Redis (ZSET com validade, script atômico). O projeto já tem um, o `EscolaConcurrencyLimiter`, em `packages/core/src/queue/escola-concurrency-limiter.ts`. O item 9 da autoconferência ("nenhum semáforo por escola existia") está errado. Vale registrar na `techspec.md` por que os dois convivem: Redis de cache contra Redis de fila, e o seguro em memória. Ou extrair o núcleo comum.
- **Corpo sem `Content-Length`:** em `configure-app.ts`, o corpo enviado em pedaços continua chegando a 1 MB em toda rota. O comentário assume isso, mas a §4 não diz. Vale escrever a exceção ali.
- **Lugar do `CalendarioRepository`:** ele mora em `packages/core/src/importacao/`, mas o calendário não é importação. Fica mais fácil de achar quando a grade (11.0 e 12.0) trouxer o próprio repository.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 21:31:31 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- **Caminho feliz:** a coordenação lê `GET /v1/importacoes/:id` na fila e depois de concluída; lê o calendário do ano em curso; o professor com vínculo confirmado lê o calendário.
- **Bordas:**
  - o expurgo com 59, 60 e 61 minutos;
  - a importação final com 89 e com 91 dias;
  - a `na_fila` velha e a `na_fila` com data de término;
  - a escola sem ano em curso;
  - o filtro do ano planejado;
  - 3.000 e 3.001 linhas, 512 KB e 512 KB + 1 byte, quebra de linha `\r`, `\r\n` e `\n`;
  - o vínculo pendente, o encerrado, o confirmado só no ano planejado, nenhum vínculo, e o vínculo que acaba no meio.
- **Permissão:** professor e aluno não leem a importação; o aluno não lê o calendário; o professor não escolhe o ano; sem token, 401.
- **Isolamento:** a importação de B, o calendário de B, o ano de B no filtro, o expurgo de B e a medição de B na série de A.
- **Carga e concorrência:**
  - 20 pedidos por minuto por usuário, prévia e gravar no mesmo balde;
  - duas vagas por escola, com a terceira prévia **simultânea** recusada;
  - o gravar ocupando vaga;
  - a vaga que volta pelo prazo;
  - `skip locked` nos dois expurgos;
  - o corpo de mais de 100 KB em outra rota, pela API.

Cobertos: todas as linhas da tabela têm o teste citado pelo nome, e os testes existem. Rodei 9 arquivos e todos passaram: `configure-app.test`, `school-semaphore.test`, `contratos.test`, `matriz.test`, `metrics.test`, `alerta-tem-runbook.test`, `calendario.int`, `importacao-gauge.int`, e juntos `importacao.int`, `expurgo-da-escola.int` e `expurgo-de-acesso.int` (192 casos). `infra/test/alertas.test.ts` não rodei: os casos AL foram lidos, não executados. Os casos não usam `.skip` nem mock que esconda a regra, e a tarefa não chama IA. Estão bem provados:
- **Isolamento:** a importação de B igual à inexistente, com e sem ano em curso; o repositório do calendário chamado direto, porque o `anoDeDestino` responde antes.
- **Expurgos:** o relógio falso com o segundo dado (a `na_fila` de B e a `concluida` de A, na mesma idade); `skip locked` com transação de verdade segurando a linha.
- **Balde:** um único balde de 20 para as duas rotas (12 prévias + 8 gravares), e outro usuário da escola segue.
- **Vínculo:** o caso tem um colega confirmado na escola, para o professor sem vínculo não sair `NAO_ENCONTRADO` por ela estar vazia.

Bloqueantes:

1. **O teto de 100 KB pela API não tem teste que falhe sem ele.**
   - `apps/api/test/importacao.int.test.ts:735` manda `{ etapa, ano, enchimento: 'x'.repeat(101 KB) }` para `POST /v1/series`. O `criarSerieRequestSchema` é `.strict()` (`packages/shared/src/estrutura/serie.ts:30-35`), então o campo `enchimento` já dá `ENTRADA_INVALIDA` sem o middleware. O caso está sempre vermelho pelo motivo errado.
   - `apps/api/src/configure-app.test.ts` testa só a função. Assim, apagar `app.use(limitarCorpoForaDaPlanilha)` em `apps/api/src/configure-app.ts:45` não deixa nenhum teste vermelho, e a linha não tem bloco.
   - O `cenarios.md`, na tabela "Limites", pede esse cenário como [I].
   - **Correção:** mandar um corpo **válido** de mais de 100 KB, numa rota cujo contrato aceite o texto grande (ou num caso em que a resposta sem o middleware seria outra, 201 ou 409, e não 400). E acrescentar o bloco que remove o `app.use(...)`, citando esse caso.

2. **Cláusulas novas sem bloco**, e a Autoconferência 11 diz que existe bloco para "o expurgo de B", o que não é verdade.
   - `packages/core/src/retencao/expurgo-da-escola.repository.ts:460` e `:462`, `escola_id = ${escolaId}` no `update` e na subconsulta. É a cláusula de isolamento (regra 10). Cada cópia sozinha é redundante, então o bloco precisa tirar as duas juntas. O teste "relógio falso: com 59 min" (a de B fica) cai.
   - `:460` e `:462`, `estado = 'na_fila'`:
     - na subconsulta, protege a `concluida` de 61 min. Pede um bloco que tire as duas cópias juntas, citando o mesmo caso;
     - no `update`, é a guarda da corrida com o job. Pede um bloco, ou uma linha em "Sem bloco (motivo)".
   - `packages/core/src/retencao/expurgo-de-acesso.repository.ts:120-121`, `order by concluida_em` e `limit ${limite}`. O caso "a linha que um job segura não faz o lote esperar… e o lote leva as mais antigas primeiro" já cairia, mas não há bloco.

3. **A corrida do semáforo não tem teste de concorrência de verdade.**
   - O caso "[P] três prévias ao mesmo tempo na escola" (`apps/api/test/importacao.int.test.ts:635`) ocupa duas vagas em sequência (`await ocupar(); await ocupar()`) e depois pede uma prévia, também em sequência. Nenhuma chamada disputa a última vaga em paralelo.
   - O caso "[P] o gravar ocupa vaga" (:652) também não disputa: a vaga é ocupada antes e o gravar pega a segunda sozinho.
   - Se o script em Lua virasse "ZCARD e depois ZADD" em duas idas ao Redis, nenhum teste cairia.
   - **Correção:** `Promise.all` de N chamadas a `ocupar` (por exemplo 10) na mesma escola, contra o Redis real, exigindo exatamente `VAGAS_DA_PLANILHA_POR_ESCOLA` vagas obtidas. Opcional: outra escola no mesmo `Promise.all`, com as vagas dela.

4. **O caso do prazo da vaga só passa com a máquina folgada.**
   - O caso "a vaga volta quando o processo morre" (`apps/api/test/importacao.int.test.ts:682-703`) usa o relógio de verdade (`setTimeout` contra o `TIME` do Redis), com validade de 600 ms.
   - O `toBeUndefined` logo depois de `esperar(400)` exige que o timer atrase menos de cerca de 200 ms; o que vem depois de `esperar(300)` exige atraso menor que cerca de 300 ms.
   - Na suíte de integração, com a API Nest no mesmo processo e o Postgres na mesma máquina, esse atraso não é garantido. Esse caso é o único citado pelo bloco que tira o `ZREMRANGEBYSCORE`.
   - **Correção:** provar o vencimento sem depender de tempo. Semear o conjunto direto com `ZADD`, um membro com pontuação já vencida pelo `TIME` do Redis e outro no futuro, e exigir que `ocupar` aceite uma vaga e recuse a seguinte. Se o caso continuar com o relógio de verdade, ampliar as margens para segundos (validade de pelo menos 3 s, cada conferência a pelo menos 1 s das bordas).

Recomendações:
- **`apps/api/test/importacao.int.test.ts:682`:** o nome diz "e a chave toda some depois", mas nada confere a chave. Ou conferir com `PTTL`/`EXISTS`, o que prova o `PEXPIRE`, que hoje não tem bloco, ou tirar a frase do nome.
- **`apps/api/test/importacao.int.test.ts:609`:** `toBeGreaterThanOrEqual(400)` é fraco. Fixar o código esperado (`ENTRADA_INVALIDA` ou `NAO_ENCONTRADO`).
- **`apps/api/test/importacao.int.test.ts:673`:** as duas vagas ocupadas no fim do caso nunca são devolvidas e ficam presas 30 s no semáforo da API. Devolver.
- **Calendário:** falta o caso do filtro com o ano **encerrado** da própria escola (o `cenarios.md`, "Isolamento e ano letivo", pede `NAO_ENCONTRADO`; é a virada do ano letivo).
- **Balde `rl:importacao` com o Redis fora:** cobrir o seguro em memória dele, como o `V` faz com o semáforo.
- **Borda de 30 min do alerta de importação parada:** a borda está só no limiar do YAML (AL). Um caso no `G` com 30 e 31 minutos deixaria a fronteira explícita, junto da métrica.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/estrutura/serie.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/retencao/expurgo-da-escola.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/retencao/expurgo-de-acesso.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/5_task.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-03 21:52:44 · `tasks/prd-onboarding-por-convite/5_task.md`

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

A correção exigida na 1ª rodada foi feita:
- O caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao.int.test.ts:751-775` manda pela rede um JSON que o contrato aceita: `{"etapa":"ef_anos_finais","ano":7}` seguido de espaço em branco até 101 KB, com `Content-Type: application/json`. Sem a linha 47 de `configure-app.ts`, o leitor de 1 MB leria esse corpo e gravaria a série, e o teste ficaria vermelho.
- O teste confere o status 400, o corpo `{ erro: { codigo: ENTRADA_INVALIDA } }`, a ausência de pilha e nenhuma série gravada. Isso prova que o `DomainException` lançado no middleware cru chega ao `AllExceptionsFilter`.
- O caso de controle está lá: o mesmo corpo com 100 KB exatos responde 201 e grava uma série.
- O bloco que remove `app.use(limitarCorpoForaDaPlanilha)` está registrado em "Mutações" e aponta para esse caso.
- O `subirApi` monta a aplicação pelo mesmo `configureApp` da produção (`apps/api/test/test-api.ts:32`), então o teste cobre a montagem que sobe de verdade.

O teto agora vale só para JSON, por causa da correção do multipart de material (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts:31-32`). Isso não abre caminho para corpo grande:
- O leitor de JSON só lê `application/json`, e é esse mesmo tipo que dispara o teto.
- O `urlencoded` padrão do Nest continua preso a 100 KB.
- O multipart fica com os limites do `FileInterceptor` (`apps/api/src/material/material-upload.ts:32`).
- A mutação `ehJson = true` derruba `material.int.test.ts › exatamente no tamanho máximo`, que passa pelo `configureApp`.

O teste do semáforo também mudou. A espera por relógio saiu, e o estado de um processo morto agora é montado com a hora do próprio Redis. O caso [P] de dez pedidos ao mesmo tempo prova exatamente duas vagas por escola, e a outra escola com as dela.

Recomendações:
- Um JSON enviado em pedaços (sem `Content-Length`) em rota que não é da planilha continua lido até 1 MB. A exceção está registrada na `techspec.md` §4. Se aparecer abuso, o caminho é contar os bytes no fluxo.
- O índice parcial de `importacao_planilha` para o expurgo de acesso ficou no `TODO.md`. Vale levar para a retro quando a tabela crescer.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-03 21:53:04 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não traz migration. `importacao_planilha` e os eventos do calendário (`escolaId` e `anoLetivoId`) não mudaram desde a 1ª rodada.

Queries verificadas:
- `packages/core/src/retencao/expurgo-da-escola.repository.ts:460-462`: o código não mudou. O `escola_id = ${escolaId} and estado = 'na_fila'` continua no `update` e na subconsulta. Os dois blocos de mutação novos em `5_task.md` correspondem ao código atual e tiram o escopo da escola e o estado.
- `apps/api/src/configure-app.ts:68-69` (o teto de 100 KB agora só vale para corpo JSON): é limite de corpo. Não decide escopo e não lê `escolaId` do cliente.
- `packages/shared/src/importacao/contratos.ts`: só um comentário novo.
- O resto do diff é teste e documentação (`runbook.md`, `techspec.md`, `cenarios.md`, `5_task.md`).

Teste de isolamento: presente e efetivo. O que mudou nesta rodada:
- `apps/api/test/calendario.int.test.ts:81-89` passou a cobrir também o ano encerrado da própria escola, que precisa responder igual ao inexistente (`NAO_ENCONTRADO`). Isso fecha o caso da virada do ano letivo.
- `apps/api/test/importacao.int.test.ts:606` antes aceitava qualquer status `>= 400` para o id não UUID (`/v1/importacoes/1837`). Agora exige `NAO_ENCONTRADO` exato (regras 6 e 7).
- O teste novo `[P]` do semáforo (`importacao.int.test.ts:159-174`) prova que cada escola tem as próprias vagas: dez pedidos em A e dez em B ocupam duas vagas em cada uma.

Correções exigidas na rodada anterior: nenhuma.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/configure-app.ts:68`: a checagem do `Content-Type` usa uma regex própria, que não reconhece valor com espaço no início nem o tipo `+json`. Não afeta o isolamento entre escolas, mas o leitor de JSON pode aceitar um corpo que essa regex deixa passar. Fica para o `infra-guardian` avaliar.
- Continuam valendo as duas da 1ª rodada, já registradas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/5_task.md`: mudar o `CalendarioRepository` de lugar na 11.0 ou na 12.0, e acompanhar na retro o `@Unscoped` do `ExpurgoDeAcessoRepository`, que já cobre nove tabelas.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 21:53:06 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As duas correções da 1ª rodada foram feitas.

1. **O teto de corpo agora vale só para JSON.**
   - `apps/api/src/configure-app.ts:68-69` só recusa quando o `Content-Type` é `application/json`, com ou sem parâmetros e em qualquer caixa. Conferi contra o leitor de JSON da API: ele só lê o tipo `application/json` exato, então nenhum outro tipo chega a ser lido sem passar pelo teto.
   - O `configure-app.test.ts` ganhou o caso do multipart e do PDF de 20 MB, que seguem. O JSON com parâmetro e outra caixa continua recusado.
   - Rodei de novo `material.int.test.ts -t "exatamente no tamanho máximo"`, o mesmo caso que falhou na rodada anterior. Agora passa.
   - A §4 da `techspec.md`, a linha "Corpo JSON de outra rota" do `cenarios.md` e a tabela de divergências do `5_task.md` dizem "corpo JSON". A §4 também registra a exceção do corpo enviado em pedaços (sem `Content-Length`).

2. **As duas divergências estão na `techspec.md` §7c.**
   - A linha "Limites e corridas" traz a vaga de 30 s (`VALIDADE_DA_VAGA_DA_PLANILHA_MS`) e o motivo.
   - A linha "Métrica e alerta" traz `importacao.minutos_na_fila` por `escola_id`, medida pelo worker de lote a cada 5 min, com a faixa de 31 a 36 min do alerta.
   - Uma linha nova, "Semáforo da planilha", explica por que o `SchoolSemaphore` convive com o `EscolaConcurrencyLimiter`.
   - A linha "Prévias simultâneas" do `cenarios.md` traz os 30 s.
   - Os comentários de `packages/core/src/rate-limit/school-semaphore.ts:11-13` e `apps/worker/src/importacao-gauge.ts:15` agora batem com o que a §7c diz.

O resto do diff não abre problema novo:
- O teste da vaga vencida passou a usar a hora do próprio Redis, sem `setTimeout`.
- Entrou o caso `[P]` de dez pedidos ao mesmo tempo.
- O caso do teto de 100 KB agora usa um JSON válido, com controle de 100 KB exatos e conferência de que nada foi gravado.
- O id `1837` agora exige `NAO_ENCONTRADO`.
- O calendário ganhou o caso do ano encerrado da própria escola.
- Entraram oito mutações novas.

Recomendações:
- `packages/shared/src/importacao/contratos.ts:14-15`: o comentário `//` novo repete o JSDoc logo acima (linhas 11-13, "tipo com nota ... reabre a regra 70, item 1"). Juntar os dois num só.
- `apps/api/src/configure-app.ts:68`: o teste do tipo deixa passar o `application/vnd.api+json`. Hoje não há furo, porque o leitor não lê esse tipo e ele cai no 1 MB. Se um dia o leitor passar a aceitar `+json`, o teto precisa acompanhar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-03 21:53:12 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre `47dd1e05` e `5d32ac35`, que está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/5_task-diff-r2.diff`. A 1ª rodada não deixou correção exigida para conferir.

Campos pessoais tocados: nenhum campo novo. O diff traz teto de corpo, testes, comentários e documentos de spec e runbook. Nenhum campo novo, nenhuma migration, nenhum DTO alterado.

Fora da tabela de dados do docs/lgpd.md: nada. O texto novo do `cenarios.md`, que diz que o dado da planilha pode ficar cerca de 25 h na pior hipótese, bate com o que `docs/lgpd.md:73` já diz. O documento da spec e o mapa de dados contam a mesma história.

Autorização por objeto: ok, e a cobertura ficou mais forte nesta rodada.
- `apps/api/test/importacao.int.test.ts:609`: o id não-UUID `/v1/importacoes/1837` agora precisa responder exatamente `NAO_ENCONTRADO`. Antes o teste aceitava qualquer status a partir de 400, o que deixava aberta uma resposta diferente que confirmaria a existência do registro (regra 20, item 6).
- `apps/api/test/calendario.int.test.ts:141-148`: um ano letivo encerrado da própria escola, no filtro `anoLetivoId`, responde igual ao id que não existe e ao ano da escola B.

Logs: limpos. O diff não acrescenta nenhuma linha de log.

Auditoria: nenhuma ação nova que a regra 20 obrigue a auditar. O que já estava aprovado na 1ª rodada não mudou.

Envio externo: nenhum, porque a tarefa não usa IA.

Seed/fixture: sintético. Os testes novos usam `randomUUID()`, membros de Redis chamados `processo-morto` e `processo-vivo`, a série `{"etapa":"ef_anos_finais","ano":7}` e o evento "Tiradentes de 2025". Nenhum deles traz nome, matrícula ou outro dado de pessoa.

Outros pontos do diff que conferi, sem problema de privacidade:
- `apps/api/src/configure-app.ts:68-69`: o teto de 100 KB agora vale só para corpo JSON. Isso não abre leitura de dado. O multipart do material continua preso ao limite do `FileInterceptor`. Um corpo com outro tipo de conteúdo não passa pelo leitor de JSON, então também não chega ao contrato como JSON.
- `apps/api/test/importacao.int.test.ts:751-775`: o corpo de 101 KB recusado volta tipado e sem pilha, com o teste `not.toMatch(/stack|\bat \S+ \(/)`, e não grava nada. Isso cobre a regra 20, item 11.
- `packages/shared/src/importacao/contratos.ts:234-235`: o comentário diz que planilha de notas reabre a regra 70, item 1, e a D56. Não muda comportamento.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada (o prazo fixo de 90 dias e o aviso na tela do calendário) já constam na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/5_task.md`, cada uma com destino ou motivo.

Pergunta de fechamento: este diff não muda a resposta da 1ª rodada. Nenhum dado novo e nenhum envio novo.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-03 21:53:14 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta rodada não muda nada que escreva em `Nota`. As planilhas aceitas continuam sendo quatro, `alunos`, `professores`, `grade` e `calendario`, e nenhuma delas traz nota. Os jobs mexidos (`gravar-planilha`, `expurgar-escola`, `expurgar-acesso`) mudam só o escopo do fechamento, a ordem e o limite do lote, e nada disso chega a `Nota`. Todos com autor humano? Sim, porque não há escrita.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. O diff não traz nenhuma saída de IA nem agente novo. A tarefa não usa IA (techspec, "Sem IA").
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou nela desde a 1ª rodada.
Bloqueantes: nenhum.

O que li nesta rodada foi o diff em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/5_task-diff-r2.diff`. A rodada anterior não pediu nenhuma correção, então não havia nada para conferir. O diff é de infraestrutura e de teste:

- **Teto de corpo:** o limite de 100 KB fora das rotas da planilha agora vale só para corpo JSON, e o multipart do material deixou de ser recusado por ele. Arquivos: `apps/api/src/configure-app.ts` e `configure-app.test.ts`.
- **Testes:** o teste da vaga vencida no semáforo não depende mais de espera, e entrou um caso com dez pedidos simultâneos. O id inválido agora é conferido como `NAO_ENCONTRADO`. O teto de corpo ganhou um caso de controle com 100 KB exatos. O calendário ganhou um caso com o ano encerrado.
- **Documentação:** runbook, techspec e cenários registram a janela do alerta, o prazo de 30 s da vaga e a convivência do `SchoolSemaphore` com o `EscolaConcurrencyLimiter`.
- **Mutações:** a tarefa passou a ter 65 blocos de mutação.

Nenhuma dessas mudanças toca nota, correção, tutor, discursiva ou redação (D46/D55), indicador de professor (D45/D64), inferência emocional ou medição de navegação.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts:14-15`: o comentário de linha novo repete o JSDoc logo acima (linhas 9-13). Vale juntar os dois num bloco só e manter a referência nova à D56, que diz que uma eventual planilha de notas precisa passar pela validação registrada. O conteúdo está certo e reforça a regra 70, item 1.

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 21:53:55 · `tasks/prd-onboarding-por-convite/5_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada): as quatro correções da 1ª rodada, e o diff `.processo/ordens/5_task-diff-r2.diff` com o que ele afeta: o teto do corpo agora vale só para JSON (o multipart do material não entra), o ano encerrado no isolamento do calendário e o `1837` respondendo `NAO_ENCONTRADO`.

Cobertos:
1. **O teto de 100 KB pela API.** O caso em `apps/api/test/importacao.int.test.ts` agora manda um JSON que o contrato aceita (`{"etapa":"ef_anos_finais","ano":7}`), completado com espaço em branco até 101 KB, pela mesma rota `POST /v1/series`. A conta é esta:
   - Sem o `app.use(limitarCorpoForaDaPlanilha)` (`apps/api/src/configure-app.ts:47`), o leitor de 1 MB aceita esse corpo e a resposta seria 201. O caso exige 400 e por isso fica vermelho.
   - O controle com 100 KB exatos dá 201 e grava a série, o que prova que o corpo é válido.
   - O caso também confere o erro tipado, a resposta sem pilha e que nada foi gravado.
   - O bloco que tira o `app.use(...)` existe e cita o caso.
   - O multipart do material também tem blocos: um em `configure-app.test.ts` › "o corpo que não é JSON segue" e outro em `material.int.test.ts` › "exatamente no tamanho máximo", com `ehJson = true`.
2. **As cláusulas do expurgo.**
   - **O escopo da escola:** o bloco tira as duas cópias de `escola_id` (`expurgo-da-escola.repository.ts:460` e `:462`). O primeiro `expect` que cai é o da importação de B (`apps/worker/test/expurgo-da-escola.int.test.ts:682`), antes do `expect` da `concluida` (:683). O teste fica vermelho pelo motivo certo, o isolamento.
   - **O estado:** o bloco tira as duas cópias de `estado`, e cai o `expect` da `concluida` (:683).
   - **O expurgo de acesso:** o `order by` tem bloco (vira `desc`) e o `limit` também (vira 1000000).
   - A Autoconferência 11 foi corrigida e agora aponta para o bloco certo.
3. **A corrida do semáforo.** O novo caso "[P] dez pedidos ao mesmo tempo" faz um `Promise.all` de 10 pedidos `ocupar` para a escola A e 10 para a escola B, contra o Redis real. Ele exige exatamente `VAGAS_DA_PLANILHA_POR_ESCOLA` vagas para cada escola. Se o script virasse "ZCARD e depois ZADD" em duas idas ao Redis, as dez leituras chegariam antes das gravações e o caso cairia.
4. **O vencimento da vaga sem relógio de verdade.** O caso semeia o conjunto por `ZADD` com a hora do próprio Redis: um membro vencido há 60 s e outro válido por mais 120 s.
   - Exige que uma vaga seja aceita e a seguinte recusada, que o membro vencido saia e o válido fique.
   - Exige também `pttl` de -1 antes e entre 0 e 5.000 ms depois. Com isso, o bloco do `PEXPIRE` cai e o do `ZREMRANGEBYSCORE` também.
   - Não sobrou nenhuma espera por tempo.
5. **O resto do diff.** O ano encerrado da própria escola entrou no laço do `NAO_ENCONTRADO` do calendário. O `1837` passou de `status >= 400` para `toEqual(NAO_ENCONTRADO)`. Não há `.skip` nem teste comentado.

Rodei os testes afetados (`importacao.int.test.ts` filtrado, `configure-app.test.ts`, `calendario.int.test.ts` no isolamento, `expurgo-da-escola.int.test.ts` no caso dos 59 min): todos verdes.

Bloqueantes: nenhum.

Recomendações:
- No caso "[P] dez pedidos" (`apps/api/test/importacao.int.test.ts:710`), conferir que a conta passou pelo Redis, por exemplo com `ZCARD` da chave da escola igual a 2 antes de liberar. Hoje, se o cliente não estivesse `ready`, o seguro em memória daria o mesmo resultado e o caso não provaria o script.
- O `estado = 'na_fila'` do `update` (`expurgo-da-escola.repository.ts:460`) só tem bloco junto com o da subconsulta. Com `for update skip locked`, o Postgres torna a conferir a linha travada, então essa cópia sozinha é redundante. Vale uma linha em "Sem bloco (motivo)" dizendo isso, para a validação não perguntar de novo.
