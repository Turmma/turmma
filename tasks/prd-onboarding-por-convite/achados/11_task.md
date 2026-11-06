# Achados das revisões — `tasks/prd-onboarding-por-convite/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 06:17:26 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nenhum arquivo do diff grava, lê ou cita `Nota`, `Correcao` ou `lancadaPor`. A planilha da grade grava `alocacao`, `vinculo` (pendente, `origem = grade`), `turma`, `serie`, `disciplina` e a conta do professor novo. Todos com autor humano? Sim, de forma vacuosa: nada aqui escreve nota. Os vínculos levam como autor a coordenação que gravou (`criadoPor` vem de `requestIdentity()`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/estrutura/vinculo.repository.ts`, no `criarProfessoresDaGrade`). A auditoria `vinculo.criado` também leva a coordenação como autora (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/grade.ts:465`).

Decisão autônoma sobre aluno: ausente. Nada decide aprovação, reprovação ou encaminhamento. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/alunos.ts` o código só foi reorganizado: a criação de turma virou a função `criarTurmasNovas`, sem mudar o que ela faz.

Aprovação registrada: ok, e o item não se aplica. Não há saída de IA no fluxo, e o diff não importa nada de `LLMProvider`, gateway ou agente. O vínculo que a grade cria nasce `pendente`, e o professor confirma ou contesta. Só o confirmado dá acesso à turma, e um teste do plano da tarefa prova isso (`… › antes de confirmar, o professor não alcança a turma`).

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, e a governança continua como estava.

Itens 7 a 9 (vigilância, D46/D55, medir o professor):
- Os avisos "professor em duas turmas no mesmo horário" e "turma com duas aulas no mesmo horário" aparecem só na prévia da planilha, para a coordenação conferir antes de gravar. Não ficam gravados como indicador do professor e não somam nada sobre ele.
- A `alocacao` guarda dia, horário e sala da aula. Não mede uso nem comportamento.
- A tarefa não cria campo de nota em discursiva ou redação.
- `docs/regulacao.md` não mudou. A mudança em `docs/lgpd.md` (a `alocacao` no arquivo do titular) é assunto da regra 20, não desta.

Bloqueantes: nenhum.

Recomendações:
- A `alocacao` vai alimentar "a semana do professor" na F2b. Quando essa tela for feita, a coordenação não deve ver a grade como medida do professor, como carga, aulas dadas ou cumprimento de horário (D45, regra 70 item 8). Vale registrar isso na Tech Spec da F2b antes de escrever código.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-04 06:17:37 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nasceu nesta tarefa. Conferi a `alocacao`, criada na 2.0 e gravada pela primeira vez aqui. Ela tem `escola_id` e `ano_letivo_id`, id UUID (`uuidv7()`), FK composta `(escola_id, ano_letivo_id, vinculo_id)` para o vínculo do mesmo ano e da mesma escola, e índice `(escola_id, ano_letivo_id)`. O `vinculo` com `origem = grade` nasce com `escolaId` do contexto e `anoLetivoId` já conferido pelo motor.

Queries verificadas:
- `AlocacaoRepository.doAno` e `.gravar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts`): escola por `requireEscolaId()`, mais o ano.
- `VinculoRepository.professoresAbertosDoAno` e `.criarProfessoresDaGrade`: escola do contexto, ano, `papel = professor`, `criadoPor` vindo de `requestIdentity()`.
- `DisciplinaRepository.todas`: escola do contexto.
- Os métodos novos do `ImportacaoRepository` (`travarConviteDaEscola`, `disciplinasDaEscola`, `criarDisciplina`, `vinculosDeProfessorDoAno`, `criarVinculosDeProfessorDaGrade`, `aulasDoAno`, `gravarAulas`) chamam `requireEscolaId()` e delegam a repositórios com escopo.
- `travarUsuarios`, `travarTurmas` e `professoresDaEscola`, já existentes e agora usados pela grade: escopo por escola.
- A leitura `alocacao` do arquivo do titular (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/titular/leitura-do-titular.ts`): `escola_id` mais subconsulta nos vínculos de professor do próprio titular naquela escola.
- Nenhuma rota recebe `escolaId` do cliente. Professor e aluno na prévia e no gravar da grade recebem `NAO_ENCONTRADO`. Não há `@Unscoped()` no diff. Nada toca a camada de rede.

Teste de isolamento: presente e efetivo.
- `gravar-planilha-grade.int.test.ts › isolamento no repository`: no contexto da escola A, lê pelo id do ano da B e pelo id de outro ano. Tirar `alocacao.escolaId`, `alocacao.anoLetivoId`, `vinculo.escolaId` ou `disciplina.escolaId` faz o teste falhar, e as quatro mutações estão declaradas.
- `› isolamento: o professor de outra escola com o mesmo e-mail`: prova que o professor da B não recebe vínculo nem aula da A, e que a B não muda.
- `arquivo-do-titular.int.test.ts`: confere que a sala do colega não entra no arquivo. A mutação que tira `v.usuario_id` da subconsulta está declarada.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts:50`: o `onConflictDoUpdate` não tem `setWhere: eq(alocacao.escolaId, escolaId)`. No `ON CONFLICT DO UPDATE` o Postgres não confere a FK composta da linha proposta. Se um `vinculoId` de outra escola chegasse ali, a aula da outra escola mudaria de fim e de sala. Hoje esse id só vem de leituras com escopo e dos vínculos recém-criados na escola, então não há vazamento possível. Vale acrescentar como segunda camada, com um teste que passe um `vinculoId` de outra escola e confira que a aula dela não muda.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 06:18:13 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

A grade grava as aulas e os vínculos pendentes sem expor nome nem e-mail. O arquivo do professor passa a levar as aulas dele, e só as dele. Não encontrei bloqueante. Rodei só os testes de unidade (`leitura-do-titular.test.ts`, `grade.test.ts` e os de `packages/shared/src/privacidade`): 62 de 62 passaram. Os testes de integração não rodei.

Campos pessoais tocados: `alocacao` (dia, início, fim e sala, ligados ao professor pelo vínculo); `vinculo` com `origem = grade` e `criado_por`; nome e e-mail do professor guardados em `importacao_planilha.linhas` até o fim do job. Não entra nenhum campo de aluno.

Fora da tabela de dados do docs/lgpd.md: nenhum. As linhas "Aula da grade", "Vínculo" e "Planilha em gravação" já cobrem tudo isso. A da aula ganhou nesta tarefa a frase que a põe no arquivo do titular.

Autorização por objeto: ok.
- Professor e aluno que chamam `POST /v1/importacoes/grade/previa` e `/v1/importacoes/grade` recebem `NAO_ENCONTRADO`, a mesma resposta das outras rotas (`apps/api/test/importacao.int.test.ts:43-46`).
- Toda leitura nova filtra pela escola do contexto: `professoresAbertosDoAno`, `DisciplinaRepository.todas` e `AlocacaoRepository.doAno`, este também pelo ano. Há mutação provando cada filtro.
- O vínculo nasce `pendente`. Antes de o professor confirmar, a turma não abre para ele, e há teste disso.
- O professor de outra escola com o mesmo e-mail não recebe vínculo nem aula.

Exposição:
- A prévia da coordenação devolve só número da linha, resultado e código de erro ou de aviso (`packages/core/src/importacao/tipos/grade.ts:421-424`). Nome e e-mail do banco não saem; o `guardado` fica no servidor.
- No arquivo do titular, a leitura liga a aula pelo vínculo do próprio titular (`packages/core/src/titular/leitura-do-titular.ts:474-482`). O teste confere que a sala do professor aparece e a do colega não (`apps/api/test/arquivo-do-titular.int.test.ts:543-544`), e há mutação provando a ligação.

Logs: limpos. O processor só registra `importacaoId`, estado, tentativa e `summarizeError`. Este último descarta a mensagem e o `detail` do Postgres, que é onde iria o valor da linha no 23505. O código novo não grava log nenhum.

Auditoria: presente.
- `vinculo.criado` só com ids, `origem: 'grade'` e a coordenação como autora (`grade.ts:465`). O teste confere que nome e e-mail não aparecem (`apps/worker/test/gravar-planilha-grade.int.test.ts:244`).
- `planilha.gravada` só com as contagens; `turma.criada` como já era.
- A aula não exige auditoria pela regra 20, item 10.

Envio externo: nenhum. A tarefa não chama IA nem manda e-mail; o convite por e-mail é da F2c.

Ciclo de vida:
- A aula sai em cascata com o vínculo (`packages/core/src/db/schema/alocacao.ts:36-40`). Assim segue o prazo de `vinculo_encerrado`, ajustável pela escola, e a eliminação do professor.
- A planilha guardada segue a retenção que a tabela já descreve.

Seed/fixture: sintético. Os e-mails são `@professores.invalid` com sufixo aleatório, e os nomes são inventados ("Ana Souza", "Coordenação sintética").

Pergunta de fechamento: o código responde. As aulas do professor entram no arquivo do titular pelo vínculo, com o caso de integração mostrando que as do colega ficam de fora. A tarefa não cria nenhum envio a terceiro.

Bloqueantes: nenhum.

Recomendações:
1. A sala é texto livre e pode acabar levando nome de pessoa ("Sala da Prof. Ana"). Valeria a mesma nota que a descrição do evento já tem na linha "Aula da grade" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md`, com o modelo da planilha pedindo para não escrever nome.
2. O limite de 40 caracteres da sala (`TAMANHO_MAXIMO_DA_SALA_DA_AULA`) só é conferido na planilha. A coluna `sala` não tem `check` de tamanho em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/db/schema/alocacao.ts`. Se um dia a aula for gravada à mão, um `check` no banco seguraria o texto longo, como já é feito com a descrição do evento.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 06:18:41 · `tasks/prd-onboarding-por-convite/11_task.md`

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
- **O teste de carga não cobre a grade.** O cenário [C] da 16.0 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/cenarios.md:19`) só põe à prova o job de alunos e o de professores. O passo (3) da grade faz mais trabalho com as travas na mão: a do convite da escola, a dos professores citados e a das turmas. Esse trabalho é um `convidarProfessorDaPlanilha` por professor novo e uma auditoria `vinculo.criado` por vínculo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/grade.ts:446-450` e `:464-466`), além dos lotes de `alocacao`. Recomendo que a 16.0 inclua uma grade de 3.000 linhas, com dezenas de professores novos e centenas de vínculos, rodando contra o gerar acesso nessas turmas. Ela deve medir o passo (3) contra o teto de 1 s e a espera de trava contra o p95 de 300 ms.
- **A auditoria sai um insert de cada vez.** Em `grade.ts:464-466` cada vínculo grava sua auditoria num insert próprio, dentro da transação que segura as turmas. É o mesmo padrão do `alunos.ts`. Se a medida da 16.0 passar de 1 s, troque por um insert em lote do `AuditoriaRecorder`.
- **O agrupamento dos avisos copia o grupo a cada linha.** Em `grade.ts:259-260`, `[...(mapa.get(k) ?? []), linha]` cresce em tempo quadrático quando muitas linhas caem na mesma chave (turma e dia, ou professor e dia), e isso roda dentro do request da prévia. Com o teto de 3.000 linhas o custo é pequeno; `push` no array já guardado tira a cópia.

Rodei `apps/worker/test/gravar-planilha-grade.int.test.ts` (28 de 28 passaram) e `packages/core/src/importacao/tipos/grade.test.ts` (26 de 26 passaram).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-04 06:18:51 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As cinco subtarefas foram feitas. A 11.3 já vinha garantida pelo código existente: o `decidir` só confirma vínculo do ano em curso (`requireAnoEmCurso`, `vinculo.repository.ts:335`). Por isso o `vinculo.service.ts`, previsto na tarefa, ficou intocado, e o caso `o ano planejado: …` prova isso. O que é da 12.0 ficou fora: apagar do ano a aula que a planilha não traz e o "sai da grade" (`grade.ts:43-44`). A gravação que mantém o id por (vínculo, dia, início), feita como upsert, está pedida na própria 11.0 (caso `a aula que já existe muda de fim e de sala`).

Aderência à Tech Spec: ok. A ordem das travas do passo (3) segue a §5: importação, convite da escola, ano, usuários, contas e turmas num comando só, em ordem de id. O vínculo aberto é reaproveitado e o pendente nasce com `origem = grade`. O único violado e a `DiferencaNaPlanilhaError` fecham a importação `desatualizada` pelo caminho que o motor já tinha. A `alocacao` entra no arquivo do titular pelo vínculo, com o `docs/lgpd.md` e o `classificacao.ts` atualizados.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. A §5 da `techspec.md` diz "na planilha de professores a trava do convite da escola", mas a grade também a pega (`motor.ts:278`, `cadastraProfessores`). Isso está certo: a grade chama o `convidar`, e se não pegasse a trava antes, quebraria a ordem global. Mesmo assim, vale escrever na Tech Spec que o tipo que cadastra professor, a grade incluída, pega essa trava.
2. O convite `vencido` como erro de linha (`professor_com_convite_vencido`, `grade.ts:236`) é comportamento visível à coordenação. Hoje ele está só no código e no `grade.test.ts`, e não no `cenarios.md` nem na §5. A escolha bate com o `ESTADOS_DO_PROFESSOR_ALOCAVEIS` da A1, mas o PRD §7 só fala do professor "não convidado". Vale registrar no `cenarios.md`, até para a 15.0 traduzir o código em frase.
3. `ESTADOS_QUE_VOLTAM` (`grade.ts:138`) repete o `ESTADOS_QUE_ENTRAM` de `professores.ts:52`: o mesmo conjunto, com outro nome. Vale uma constante só, para que a regra de "quem volta pelo `convidar`" não divirja entre as duas planilhas.
4. `compactar` (`grade.ts:160`) faz o mesmo que o `nomeDaTurma` exportado de `alunos.ts`. É o segundo jeito de fazer a mesma coisa.
5. Detalhe de texto em `11_task.md:913-914`: falta a linha em branco antes do bloco "A aula do colega entra no arquivo do professor".

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/grade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/cenarios.md

## test-engineer · 1ª rodada · REPROVADO · 2026-11-04 06:21:09 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (pela tabela da 11.0 e pelo `cenarios.md`, nas seções "RF7 e RF8", "Virada de ano" e "Job e estados"):
- **Caminho feliz:** a tripla sem vínculo vira vínculo pendente com `origem = grade`, e a auditoria sai sem nome nem e-mail.
- **Avisos:** professor em duas turmas no mesmo horário; turma com duas aulas no mesmo horário.
- **Erros:** aula das 9h às 8h; linha sem professor.
- **Professor com duas disciplinas na turma:** dois vínculos.
- **O que nasce ao gravar:** turma, disciplina e professor novos; o `desativado` volta.
- **Acesso:** o professor não alcança a turma antes de confirmar.
- **Vínculo existente:** o confirmado não muda; o feito à mão é reaproveitado; o encerrado não reabre (também com um encerrado e um aberto na mesma tripla); o contestado não volta.
- **Ano planejado:** o professor não vê nem confirma o vínculo, e o ano em curso não muda.
- **[P] entre o passo (2) e o (3):** vínculo encerrado; vínculo criado à mão; professor desativado.
- **[P] contra o `desativar`:** espião e barreira.
- **Falha e reimportação:** falha no segundo lote de 1.200 linhas; reimportar mantém o id da aula.
- **Travas e reexecução:** trava do convite da escola; expurgo da conta entre o (1) e o (3); job executado duas vezes.
- **Permissão:** o professor sobe a grade e é recusado.
- **Isolamento:** no repository, e pelo e-mail de outra escola.
- **Classificação sem banco** (teste de unidade).
- **Arquivo do titular:** leva a `alocacao` do professor.

**Cobertos:** todos, salvo a parte "não vê" do ano planejado. Rodei aqui `grade.test.ts` (26 passaram) e `gravar-planilha-grade.int.test.ts` (28 passaram). A saída do `--faltando` dá as mesmas 17 linhas, e as 17 têm motivo escrito. Não há `.skip`, teste comentado nem provedor de IA. O mock do `convidarProfessorDaPlanilha` e do `AuditoriaRecorder` só existe no teste de unidade, e as integrações provam o convite e a auditoria de verdade.

**Bloqueantes:**
1. **O "não vê" do ano planejado está no nome do teste, mas nenhuma asserção o confere.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-grade.int.test.ts:576-606`. O cenário está em `cenarios.md:86` e na linha 59 da tabela.
   - O problema: o nome do teste e o cenário dizem "o professor não o vê nem confirma". O teste confere o confirmar (`confirmar` dá `false`) e o acesso à turma (`alcancaATurma`), mas nunca o que o professor vê, que é o `VinculoRepository.listarDoUsuario`. As duas metades contam separado: hoje "não vê" é uma afirmação sem teste.
   - Correção exigida: em 594-597, no contexto do professor com o ano em curso, ler `listarDoUsuario({ limite: 50 })` e afirmar que o id do `vinculo27` não está na lista. Depois da virada (603), com o planejado em curso, afirmar que ele está e que segue `pendente` até o `confirmar`.

**Recomendações:**
- **Job executado duas vezes (`:502`):** as duas chamadas são em sequência, e a segunda sai no `estado !== 'na_fila'` de `motor.ts:177`, sem chegar à releitura sob trava de `motor.ts:254`. A regra é do motor e tem [P] de verdade em `gravar-planilha.int.test.ts:134` e `gravar-planilha-alunos.int.test.ts:643`. Para a grade, que agora passa pelo passo (1) também, vale um [P] no mesmo molde: barreira e `Promise.all`, com uma `concluida` e uma `ignorada`.
- **Único violado (subtarefa 11.4):** o "[P] vínculo à mão criado entre o (2) e o (3)" (`:657`) cai em `desatualizada` porque a assinatura mudou: o vínculo entra antes da leitura do passo (3). Nenhum caso da grade chega ao 23505 de `motor.ts:187`. Um `WriteBlockTrigger` no insert de `vinculo`, com a mesma tripla inserida pelo segurador, provaria o 23505 numa só chamada do processor, que é a armadilha da rodada 8.
- **"[P] T1 e T2 contra o `desativar`" (`:740`):** a professora não tem vínculo antes do job, e job e `desativar` se enfileiram na trava do usuário antes de qualquer turma. Por isso o caso passaria até com as turmas travadas em ordem inversa. O cenário pede "ordem inversa à do vínculo", e a ordem só está provada pelo espião do job (`:703`). Registrar isso no documento, ou montar os vínculos em ordem inversa.
- **Termos novos sem bloco e sem motivo escrito:** `eq(vinculo.anoLetivoId, anoLetivoId)` em `vinculo.repository.ts:113`; `t.escola_id`, `v.escola_id` e `v.papel = 'professor'` em `leitura-do-titular.ts:493`. Nenhuma mutação deles muda o resultado: a FK `vinculo_turma_do_ano_da_escola_fk` amarra a turma ao ano, e o usuário já é de uma escola só. Vale escrevê-los em "Sem bloco (motivo)", como o documento já fez com o item (10).
- **Caractere de controle:** o `temControle` de turma, disciplina, nome e sala (`grade.ts:172,181,184,207`) nunca é exercitado. O bloco que apaga cada um desses `if` fica vermelho só pelo caso de tamanho. Falta uma linha com `\u0007`, se o `lerTabela` deixar o caractere passar.
- **Falha no segundo lote (`:845`):** `rejects.toThrow()` aceita qualquer erro. Afirmar a mensagem do gatilho (`falha do teste no segundo lote`) garante que o job chegou mesmo ao segundo lote.
- **Mesmo nome, e-mails diferentes:** falta um caso com dois professores "Ana Souza" na mesma planilha, que precisam virar duas pessoas e dois vínculos (o professor se identifica pelo e-mail).

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-04 06:37:46 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `alocacao` (o `escolaId` e o `anoLetivoId` continuam lá, e o id continua UUID). Nenhuma migration nova nesta rodada.

Queries verificadas:
- `AlocacaoRepository.gravar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts:51`. A recomendação da 1ª rodada foi aplicada: o upsert agora tem `setWhere: eq(alocacao.escolaId, escolaId)`, com a escola tirada do contexto (`requireEscolaId()`). Nenhum parâmetro do cliente entra no escopo.
- `ImportacaoRepository.gravarAulas` (`importacao.repository.ts:492`) não mudou e só repassa para o método acima.
- `VinculoRepository.listarDoUsuario` aparece agora nos testes, chamado dentro do contexto do professor. O repository não foi alterado.

Teste de isolamento: presente e efetivo. O caso novo `isolamento no upsert da alocacao` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-grade.int.test.ts:640` grava, no contexto da escola A, uma aula na chave (vínculo, dia, início) de uma aula da escola B. Se eu tiro o `setWhere`, o `ON CONFLICT DO UPDATE` atualiza a linha da B, porque a FK composta não é conferida no caminho do conflito. Aí `escritas` passa a ser 1 e o fim e a sala da B mudam, e as duas asserções quebram. Essa mutação está registrada na tarefa. Os outros casos novos desta rodada (homônimos, as duas corridas `[P]`, a lista do professor no ano planejado e a causa do erro do lote) não mexem em escopo. O de ano planejado só reforça o recorte por `anoLetivoId` na lista do professor.

Bloqueantes: nenhum.

Recomendações:
- `alocacao.repository.ts:51`: incluir também `eq(alocacao.anoLetivoId, anoLetivoId)` no `setWhere`. Hoje, se quem chama passar um vínculo de outro ano da mesma escola, o caminho do conflito atualiza a aula daquele ano sem conferir a FK. O motor já impede isso, mas essa é a mesma proteção extra que agora existe para a escola, aplicada à dimensão do ano (regra 10, item 2).

## infra-guardian · 2ª rodada · APROVADO · 2026-11-04 06:37:56 · `tasks/prd-onboarding-por-convite/11_task.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts:51`: o `setWhere` impede que a aula da outra escola seja alterada. Mesmo assim, quando há conflito na chave, o Postgres trava a linha da outra escola até o fim da transação, ainda que o `WHERE` dê falso. Na prática isso não acontece, porque o job só monta `vinculoId` com dados da escola do contexto. Vale uma linha no comentário dizendo que esse caminho só existe com id forjado, para ninguém tomar o `setWhere` como a defesa principal.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-grade.int.test.ts:116-118`: o teste da execução dupla mede o contador `importacao.job` pela diferença entre antes e depois. Isso depende de nenhum outro caso do mesmo arquivo rodar em paralelo durante o teste. Hoje o `describe` roda os casos em sequência. Se um dia passar a rodar em paralelo, o caso deve filtrar o contador pela escola ou pelo id da importação, para não oscilar.

Esta rodada conferiu só o diff da 1ª para a 2ª, sem correção exigida pendente. O `setWhere` na `alocacao` tem teste de isolamento. As duas corridas novas também têm teste [P]: a execução dupla, que termina com uma `concluida` e uma `ignorada`, e o vínculo feito à mão, que vira `desatualizada`. O contador `METRICS.importacaoPorResultado` (`importacao.job`) já está ligado no processor e agora é conferido no teste. O diff não traz migration, request novo nem chamada de IA.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-04 06:38:04 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei o diff `cff699fd..fdcbd7fd` inteiro e o que ele afeta. As versões auditadas de `alocacao.repository.ts`, `grade.ts`, `grade.test.ts`, `gravar-planilha-grade.int.test.ts`, `docs/lgpd.md`, `leitura-do-titular.ts` e `vinculo.repository.ts` são as mesmas da árvore de trabalho. A 1ª rodada não deixou correção exigida para conferir. A minha recomendação 1 (a nota sobre nome de pessoa na sala) foi feita: está na linha da `alocacao` em `docs/lgpd.md` e foi passada para a tarefa 14.0 em "Recomendações sem aplicar".

Campos pessoais tocados: nenhum campo novo. O diff mexe na `alocacao.sala`, que já estava na tabela de dados, e só acrescenta a nota de que é texto livre e pode acabar levando nome. Também mexe na validação de nome do professor, turma, disciplina e sala na prévia da grade: caractere de controle agora é erro da linha.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. O `setWhere: eq(alocacao.escolaId, escolaId)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/alocacao.repository.ts:51` fecha o caso em que o upsert da escola A mudaria a aula da escola B na mesma chave (vínculo, dia, início). A `escolaId` vem do contexto, pelo `requireEscolaId`. Um teste de isolamento prova isso: o caso "isolamento no upsert da `alocacao`" pede zero escritas, a B sem mudança e a A vazia. Ele tem mutação registrada na tarefa. O teste novo com o `listarDoUsuario` também mostra que o professor não vê o vínculo do ano planejado enquanto o ano em curso é outro.
Logs: limpos. A métrica `importacao.job` só leva `resultado` (o estado ou `nova_tentativa`/`falhou`), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/src/processors/gravar-planilha.ts:56,62,68`. Os logs do job continuam só com ids, tentativa e código.
Auditoria: presente. Os casos [P] novos pedem um `vinculo.criado` e um `planilha.gravada` na execução dupla. Na corrida com o vínculo criado à mão, a importação vira `desatualizada` e não sobra nenhum `planilha.gravada`.
Envio externo: nenhum.
Seed/fixture: sintético. Os e-mails são `*@professores.invalid` e `*@escola.invalid`, os nomes são fictícios ("Ana Souza") e as escolas são criadas por `escolaNova()`.
Bloqueantes: nenhum.
Recomendações:
1. O `check` de tamanho da `sala` no banco continua só no `TODO.md`, como ficou combinado na 1ª rodada. Ele tem de virar tarefa antes de a F2b gravar aula à mão, porque a validação de controle e de tamanho que entrou agora vale só na prévia da planilha.
2. O teste de falha no segundo lote agora confere a mensagem na `cause` do erro do Drizzle. Isso está certo para o teste. Só vale lembrar que essa `cause` nunca pode chegar ao corpo da resposta nem ao log sem passar pelo `summarizeError`, e hoje não chega.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-04 06:38:11 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da 1ª para a 2ª rodada não grava em `Nota` nem em `correcao`. Ele toca só a grade (`alocacao`, `vinculo`, convite), a validação da prévia e os testes. Todos com autor humano? Não se aplica, porque não há escrita.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA entra neste diff, e nada chama a porta de IA, o tutor ou o assistente.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. A governança não foi tocada, e o que aprovei na 1ª rodada continua igual.

O que mudou desde a 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/.processo/ordens/diff-11-r1-r2.patch`):
- `packages/core/src/importacao/alocacao.repository.ts:51`: a gravação das aulas agora só atualiza a aula da própria escola (`setWhere` pela escola). O teste "isolamento no upsert da `alocacao`" prova isso. É assunto da regra 10, não da 70.
- `packages/core/src/importacao/tipos/grade.test.ts`: dois casos novos. Caractere de controle na turma, na disciplina, no nome ou na sala vira erro da linha. Dois professores com o mesmo nome e e-mails diferentes viram duas pessoas.
- `apps/worker/test/gravar-planilha-grade.int.test.ts`: casos novos de corrida, de isolamento e de vínculo do ano planejado, e o medidor de resultado do job (`importacao.job`). O medidor conta resultados do job, não pessoas: não é indicador de professor nem de aluno (item 8, D45).
- `docs/lgpd.md`: aviso de que a sala é texto livre e pode acabar levando nome de pessoa. É assunto da regra 20.
- `tasks/prd-onboarding-por-convite/11_task.md`: mutações novas, recomendações e a tabela de revisões.

A rodada anterior não exigiu nenhuma correção, então não havia nada a conferir.

Itens 7 a 9 (supervisão, discursiva e redação, medir o professor): o diff não cria métrica de professor, ranking, campo de nota, inferência de comportamento nem visão da coordenação sobre a grade.

Bloqueantes: nenhum

Recomendações:
- Mantenho a da 1ª rodada, que já está na tabela de recomendações da tarefa com destino na Tech Spec da F2b: a grade (`alocacao`) não pode virar medida do professor para a coordenação, seja carga, aulas dadas ou cumprimento de horário (D45, regra 70 item 8).

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 06:38:13 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Esta rodada mudou só o diff desde a primeira. Em código de produção, é uma linha: o `setWhere: eq(alocacao.escolaId, escolaId)` no upsert da `alocacao`, em `packages/core/src/importacao/alocacao.repository.ts:51`. O resto são testes novos, uma frase em `docs/lgpd.md` e o registro de mutações e recomendações no `11_task.md`.

- **O `setWhere` corrige um furo real.** O Postgres só confere a chave estrangeira composta quando a coluna da chave muda. Sem o filtro, a escola A, ao gravar na mesma chave (vínculo, dia, início) da escola B, mudaria o fim e a sala da aula da B. O teste "isolamento no upsert da `alocacao`" pega exatamente isso: espera zero linhas escritas e a aula da B intacta, e quebra se o filtro sair. A mutação correspondente está registrada no `11_task.md`.
- **Os testes novos afirmam a regra, não só que o código rodou:**
  - dois professores com o mesmo nome e e-mails diferentes, na prévia e no job;
  - o mesmo job rodando duas vezes ao mesmo tempo, conferido pela contagem de `concluida` e `ignorada`;
  - o vínculo criado à mão entre a releitura e a gravação, que vira `desatualizada`;
  - o vínculo do ano planejado, que o professor não vê na própria lista;
  - o caso contra o `desativar`, agora com o vínculo já existente na turma de id maior;
  - o caso da falha no segundo lote, que agora afirma a mensagem de erro em vez de só esperar que algo falhe.
- **Os caracteres de controle não são código novo.** As verificações já estavam em `packages/core/src/importacao/tipos/grade.ts:172-207`. A rodada só acrescentou o teste em `grade.test.ts` e as três mutações.
- **O item novo da `docs/lgpd.md`** (a sala pode acabar levando nome de pessoa) manda o aviso para a 14.0, que entrega os modelos da planilha. É coerente com a recomendação do privacy-guardian e não adianta trabalho da 14.0.

Recomendações:
- `tasks/prd-onboarding-por-convite/11_task.md:98`: os itens de "Sem bloco (motivo)" estão fora de ordem, com o (14) antes do (13). Basta renumerar.
- `packages/core/src/importacao/alocacao.repository.ts:41`: a frase que entrou no comentário do `gravar` deixou a linha bem mais longa que as vizinhas. Vale quebrar a linha como no resto do bloco.
- O índice único da `alocacao` (vínculo, dia, início) não leva `escola_id`. Hoje o `setWhere` resolve, mas incluir a escola na chave numa migration futura deixaria o banco como segunda proteção sem depender do código. Isso cabe no `TODO.md`, junto do `check` de tamanho da sala que já está lá.

## test-engineer · 2ª rodada · APROVADO · 2026-11-04 06:38:30 · `tasks/prd-onboarding-por-convite/11_task.md`

VEREDITO: APROVADO

Cenários exigidos: a correção da 1ª rodada, a do "não vê" do ano planejado, e o que mudou desde então: os novos [P] (job executado duas vezes; vínculo feito à mão com 23505), o isolamento no upsert da `alocacao`, o caractere de controle na turma, na disciplina, no nome e na sala, os dois professores com o mesmo nome e e-mails diferentes, a mensagem do gatilho no segundo lote, e os motivos novos em "Sem bloco".

Cobertos:
- **Correção exigida, feita.** Em `apps/worker/test/gravar-planilha-grade.int.test.ts:678`, com o ano em curso, a lista do professor (`listarDoUsuario`, pelo `vinculosQueVe`) não traz o `vinculo27`. Depois da virada, em 688-689, ele aparece como `pendente` na turma de 2027, antes do `confirmar` (690). Se a lista não filtrasse pelo ano, a 678 falharia.
- **[P] do job executado duas vezes (549-581): concorrência de verdade.** A segunda execução só começa quando a primeira está parada no gatilho do insert da `alocacao`. O teste confere, com o `esperarNaTrava`, que ela ficou esperando a trava `for update`, e depois roda as duas com `Promise.all`. As asserções olham o resultado: um vínculo, uma aula, uma auditoria `vinculo.criado` e uma `planilha.gravada`. As contagens do medidor sobem exatamente uma em `concluida` e uma em `ignorada`.
- **[P] do 23505 (763-790).** O vínculo à mão entra enquanto o job está parado no insert da disciplina. O teste afirma `desatualizada`, só o vínculo da coordenação, nenhuma aula, uma disciplina e nenhuma `planilha.gravada`. Sem o tratamento do 23505, a importação ficaria `na_fila` e o teste falharia.
- **Isolamento no upsert (640-657).** Tem bloco de mutação no `setWhere`. Afirma que nada foi escrito, que a aula da B segue igual e que a A continua sem aula.
- **Caractere de controle.** Há bloco para a disciplina, o nome e a sala. O da turma tem motivo no item (14): o resultado é o mesmo `turma_invalida`, e o caso o prova.
- **Mesmo nome, e-mails diferentes.** Coberto na unidade (`grade.test.ts`) e na integração (382-400): dois usuários, um convite cada, dois vínculos e duas aulas.
- **Segundo lote.** Agora o teste confere a mensagem do gatilho na causa do erro, o que prova que o job chegou até ali.
- **[P] contra o `desativar`.** Agora monta o vínculo na turma B. O item (13) registra por que a ordem das turmas fica com o espião do passo (3).
- **Rodada nova.** Contra `fdcbd7fd`, só mudou uma linha do `11_task.md`, a da tabela de revisões.
- **Testes.** Rodei `grade.test.ts` (28 passaram) e `gravar-planilha-grade.int.test.ts` (32 passaram). Não há `.skip` nem mock que esconda a regra, e nenhum dos casos toca provedor de IA.

Bloqueantes: nenhum.

Recomendações:
- `apps/worker/test/gravar-planilha-grade.int.test.ts:678`: o `not.toContain` passaria também se a lista viesse vazia por erro de contexto. Vale afirmar junto que o vínculo de 2026 da Ana está na lista. Hoje o 688-689 confere o mesmo caminho, mas só depois da virada.
- `tasks/prd-onboarding-por-convite/11_task.md`, "Sem bloco (motivo)": o item (14) aparece antes do (13). Basta renumerar.
