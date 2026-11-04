# Achados das revisões — `tasks/prd-onboarding-por-convite/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 01:22:50 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, correção, tutor, agente nem a porta de IA, e os tipos de importação são só `alunos`, `calendario` e `professores`. Todos com autor humano? Sim, porque não existe escrita.

Decisão autônoma sobre aluno: ausente.
- "Muda de turma" (`transferir`) e "fora da planilha" (`desligar`) são só candidatos, calculados por código fixo, sem IA, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:241-259`.
- Eles só valem com marca enviada pela coordenação. Antes da 9.0 e da 10.0, gravar sem marca não tem efeito, e isso é provado em `apps/api/test/lista.int.test.ts` › `"muda de turma" e "fora da planilha" sem marca gravam sem efeito`.
- O nome corrigido muda só o cadastro, não a trajetória do aluno. Ele só acontece quando a coordenação manda gravar a planilha, e cada aluno corrigido fica na auditoria (`usuario.nome_corrigido` ou `lista.nome_corrigido`, sem o nome).
- `travarPendentesDasTurmas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/decisao.repository.ts:132-140`) só trava os pedidos pendentes. Não aprova nem recusa nenhum, então a identidade do aluno continua passando por aprovação humana (D4).

Aprovação registrada: não se aplica, porque nenhuma saída de IA entra neste fluxo. Quem lê o nome do banco fica auditado (`turma.alunos_lidos` com finalidade, provado em `lista.int.test.ts` › `a prévia que mostra nome do banco`).

Supervisão do tutor: não se aplica, o tutor não é tocado.

Autonomia declarada e visível: não se aplica, nenhum agente é tocado.

Bloqueantes: nenhum.

Recomendações:
- Para a 9.0, a 10.0 e a tela da 13.0: os candidatos a `transferir` e `desligar` devem chegar à tela desmarcados, e a coordenação marca um a um. Uma opção "marcar todos" vinda marcada, ou o candidato já marcado, faria a sugestão do sistema valer sozinha para a saída do aluno. Vale também deixar um teste provando que gravar sem marca não muda ninguém de turma nem tira ninguém da escola, que hoje é o que `lista.int.test.ts` prova.
- O rótulo do candidato traz o nome e a matrícula que estão no banco. Na 13.0, a tela deve dizer que é uma conferência feita a partir da planilha, sem parecer recomendação do sistema.

`docs/regulacao.md` não mudou nesta tarefa.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-04 01:23:38 · `tasks/prd-onboarding-por-convite/8_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. As tabelas tocadas (lista_nome, usuario, credencial_matricula, reivindicacao, turma, importacao_planilha, auditoria) já têm escolaId; lista_nome, turma e reivindicacao também têm anoLetivoId.
Queries verificadas:
- ListaRepository.paraReimportar e corrigirNomes: escola pelo contexto; o ano vem de anoDeDestino, conferido na escola.
- DecisaoRepository.travarPendentesDasTurmas: escola pelo contexto, ano de destino, turmas vindas de turmasDoAno.
- ImportacaoRepository.alunosParaReimportar, travarPedidosPendentes, corrigirNomesNaLista e corrigirNomesDosAlunos (UPDATE em SQL cru com u.escola_id do contexto).
- tipoAlunos.previaDaLista: turmaId do caminho conferido contra turmasDoAno (doAnoComSerie, escola e ano), o mesmo alcance do antigo TurmaRepository.aberta('unidade').
- tipoAlunos.destinoDaLinha: no job, o turmaId guardado é conferido de novo contra as turmas da escola e do ano.
- MotorDePlanilha.previa e gravar com daLista: nenhum corpo aceita escolaId, anoLetivoId ou turmaId (textoDaListaRequestSchema e gravarListaRequestSchema são strict; o turmaId vem só do caminho, via IdPipe). Na rota /v1/importacoes/:tipo, um turmaId no corpo continua dando NAO_ENCONTRADO.
- Marcas: só valem as que estão entre os candidatos da prévia, que é escopada.
- Nenhum @Unscoped novo, nenhum id sequencial, nada passa pela camada de rede.
Teste de isolamento: presente e efetivo.
- apps/api/test/lista.int.test.ts:284: turma da B, id sorteado e ano encerrado dão o mesmo NAO_ENCONTRADO na prévia e na gravação, sem importação, sem job e sem turma.alunos_lidos. Sem o turmas.some(...) do previaDaLista, o teste quebra.
- apps/worker/test/gravar-planilha-alunos.int.test.ts:380: o aprovado, o livre e o reivindicado da B não são corrigidos nem viram candidatos na planilha da A. Sem o escopo de escola e ano do paraReimportar, o teste quebra.
- Rodados agora: lista.int, gravar-planilha-alunos.int, alunos.test, architecture.test, repositories-com-escopo, configure-app.test e lista-reader.test, todos verdes (52 de integração, 156 dos outros).
Bloqueantes: nenhum
Recomendações:
- packages/core/src/importacao/importacao.repository.ts:375: corrigirNomesDosAlunos faz UPDATE em usuario com SQL cru dentro do ImportacaoRepository. Está escopado, mas a escrita em usuario deveria ficar no repository dono da tabela, como foi feito com ListaRepository.corrigirNomes.
- packages/core/src/estrutura/lista.repository.ts:107: tirar só o eq(escolaId) não derruba teste nenhum, porque o ano já prende a escola pela FK composta. Isso está documentado na seção de mutações. Fica registrado que o isolamento dessa consulta depende de o anoLetivoId vir sempre de anoDeDestino ou anoPorId e nunca do cliente; vale um comentário no próprio método.
- packages/core/src/estrutura/decisao.repository.ts:132: o anoLetivoId chega por argumento, e a origem é segura (o ano de destino já conferido). Vale dizer no docblock que quem chama só pode passar um ano já conferido na escola, como o 7.0 fez com inserirNoAno.
```

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 01:23:38 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

Auditei o diff da tarefa 8.0. Não rodei os testes: o veredito sai da leitura do código e dos casos de teste.

**Campos pessoais tocados:**
- `lista_nome.nome` e `usuario.nome`, que a reimportação corrige.
- `importacao_planilha.linhas`, que agora também recebe o texto da lista da turma (nome, matrícula e o `turmaId`).
- O rótulo do candidato a marca (`nome (matrícula)`), mostrado à coordenação na prévia. Ele não é gravado em lugar nenhum.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. As três origens já estão na tabela, com finalidade e retenção: a lista de nomes (`docs/lgpd.md:84`), a planilha em gravação (`docs/lgpd.md:73`, até o fim do job e no máximo cerca de 25 h) e o `usuario`. A resposta da prévia ficou menor que a da A1: as linhas não trazem mais nome nem matrícula, só o número da linha, o resultado e o código.

**Autorização por objeto:** ok.
- `POST /v1/turmas/:id/lista/previa` e `/lista`: `previaDaLista` confere o `turmaId` contra as turmas da escola e do ano (`packages/core/src/importacao/tipos/alunos.ts:1455-1456`). A turma da escola B, um id sorteado e uma turma de ano encerrado respondem o mesmo `NAO_ENCONTRADO`, sem importação, sem job e sem leitura auditada (`apps/api/test/lista.int.test.ts:284`).
- Só a coordenação alcança essas rotas (`unidade`). A rede fica com `nunca` em `lista_nome` e em `importacao_planilha` (`packages/shared/src/permissao/matriz.ts:227`, `:315`, `:359`).
- Toda escrita nova filtra pela escola da sessão: `corrigirNomes`, `corrigirNomesDosAlunos`, `paraReimportar` e `travarPendentesDasTurmas`. O isolamento entre escolas está provado em `apps/worker/test/gravar-planilha-alunos.int.test.ts:380`.

**Logs:** limpos. Nenhum log novo nos módulos tocados. Um erro de SQL no `update ... from (values ...)` não leva o nome a log, porque `summarizeError` só guarda o SQLSTATE e a constraint. O script de carga escreve só o estado da importação no erro.

**Auditoria:** presente.
- `turma.alunos_lidos`, com a finalidade `conferencia_de_cadastro` e a quantidade, gravada por turma de onde o nome saiu, na prévia que mostra nome do banco. Sem o registro, a prévia não é devolvida (`packages/core/src/importacao/motor.ts:815-820`). Provado em `apps/api/test/lista.int.test.ts:769`, que também confirma que nenhum nome vai à auditoria.
- `usuario.nome_corrigido` e `lista.nome_corrigido`, só com o id e sem `antes` nem `depois` (`packages/core/src/auditoria/acoes.ts:442-457`). Um teste procura os nomes em toda a auditoria da escola e não os acha (`apps/worker/test/gravar-planilha-alunos.int.test.ts:320`).
- A gravação devolve só o id da importação, por isso não grava leitura.

**Envio externo:** nenhum. A tarefa não chama IA nem terceiro.

**Seed/fixture:** sintético. Os nomes são gerados (`Aluno N <sufixo>`, `Nome Corrigido`), os CPFs são os sintéticos que já estavam no repositório, e o script de carga monta a escola com dado gerado.

**Pergunta de fechamento:** o código responde. Cada correção de nome fica na auditoria com o id do aluno ou da linha e com o autor. Cada leitura de nome na prévia fica por turma, com a finalidade. A cópia na planilha tem retenção mapeada e expurgo. Nada sai do sistema.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O comentário de `'lista.gravada'` (`packages/core/src/auditoria/acoes.ts:350-354`) ainda diz "pelo texto ou pelo nome avulso". A gravação pelo texto passou ao job e grava `planilha.gravada`. Ajuste o comentário para não induzir quem montar o arquivo do titular a procurar pelo texto nessa ação.
2. `turma.alunos_lidos` diz quantos nomes foram lidos em cada turma, mas não quais alunos. É o mesmo nível da A1 e atende a regra 20, item 10. Se a secretaria perguntar "quem viu o nome deste aluno", a resposta para em "a coordenação X leu N nomes da turma T em tal data". Vale registrar isso para a retro ou para o dossiê de conformidade.
3. `previaDaListaResponseSchema` e `gravacaoDaListaResponseSchema` continuam exportados em `packages/shared/src/index.ts` enquanto a tela não migra (13.0). Tire os dois na 13.0, para nenhum código novo voltar a usar o contrato antigo, que ecoava nome e matrícula por linha.

Arquivos centrais da auditoria:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/lista/lista.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/lista.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 01:24:16 · `tasks/prd-onboarding-por-convite/8_task.md`

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
- **A tela da lista quebra até a 13.0.** O `apps/web/src/areas/coordenacao/estrutura/api/lista.ts:53` e o `:58` ainda leem a resposta com `previaDaListaResponseSchema` e `gravacaoDaListaResponseSchema`, que são estritos. A API agora devolve `{ linhas, contagens, candidatos }` na prévia e `{ id }` com 202 na gravação. Até a 13.0 pousar, a lista da turma da coordenação falha ao ler a resposta, e o e2e dela deve ficar vermelho no ramo da spec. A spec não pode pousar sem a 13.0. Os dois schemas antigos, exportados em `packages/shared/src/index.ts:202` e no `:215`, saem na 13.0.
- **Consulta dos aprovados sem índice próprio.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:764-769`, o `or(...)` junta `credencial_matricula.matricula` e `lista_nome.turma_id`, que são de tabelas diferentes. Assim, nenhum dos dois índices filtra sozinho: o banco lê todas as linhas `aprovado` da escola no ano (pelo `lista_nome_turma_idx`, prefixo escola e ano) e só depois filtra. O custo hoje é limitado: alguns milhares de linhas por escola e ano, na prévia (com a vaga da escola) e no job. Vale anexar o `EXPLAIN` com 3.000 linhas na escola, ou trocar o `or` por duas consultas unidas.
- **Comentário inconsistente.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/scripts/carga-sala.ts:493`, o comentário de `ESPERA_MAXIMA_DA_LISTA_MS` diz "o dobro do alerta de fila parada". Isso não bate com nenhum limite do código. Basta dizer só o que o número é.

Conferido nesta tarefa:
- A prévia e a gravação da lista passaram a usar `@ImportacaoRateLimit`, por usuário, e a vaga da escola (`comVaga`).
- A gravação foi para o job `estrutura.gravar-planilha`, na fila `normal`, com uma importação `na_fila` por escola.
- O passo (3) trava na ordem global da techspec: usuários, turmas e pedidos. As aprovações cruzadas têm testes `[P]` nos dois sentidos, sem `40P01`.
- Os índices de `lista_nome` e de `reivindicacao` começam pelo escopo.
- O cenário de carga foi atualizado para o 202 com espera pelo job.
- Os 68 testes de unidade tocados passam (`alunos.test.ts`, `configure-app.test.ts`, `lista-reader.test.ts`, `carga-sala.test.ts`). Os de integração eu não rodei.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-04 01:24:48 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `techspec.md` §4 e §5 e em `cenarios.md` (RF4 e Limites). As divergências estão escritas só no `8_task.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**Bloqueantes:**

1. **`tasks/prd-onboarding-por-convite/8_task.md:102` e `apps/api/src/configure-app.ts:24` e `:37`.** O corpo de até 1 MB foi estendido para `POST /v1/turmas/:id/lista` e `/lista/previa`. Isso contradiz o texto da spec:
   - `techspec.md:64-66` diz "fora de `/v1/importacoes`, um middleware antes do leitor recusa pelo `Content-Length` o corpo JSON de mais de 100 KB".
   - A tabela "Limites" do `cenarios.md:224` diz o mesmo.

   Nenhum dos dois arquivos mudou nesta tarefa (`git status`). A coluna "Onde está na spec" aponta para o §4, mas o §4 diz o contrário. **Correção exigida:** reescrever `techspec.md` §4 e a linha "Corpo JSON de outra rota" do `cenarios.md` com as duas rotas da lista como exceção, e o caso `configure-app.test.ts › a prévia e a gravação da lista da turma seguem` como prova.

2. **`8_task.md:97` e `packages/core/src/importacao/tipos/alunos.ts:250-257`.** A regra de "fora da planilha" foi decidida só no documento da tarefa: só é candidato a desligar quem é de turma citada por linha sem erro e de turma única. A turma ambígua ou com erro não oferece ninguém. É uma regra nova de quem a coordenação pode desligar. `techspec.md` §5 não fala de candidato a desligar aluno, e `cenarios.md:57` diz só "Ausente na planilha segue ativo sem marca". **Correção exigida:** escrever a regra em `techspec.md` §5 ("Gravar", Alunos) e no RF4 do `cenarios.md`, com os casos de `alunos.test.ts › quem é da turma que a planilha cita` e `› a turma ambígua ou com erro não oferece`.

3. **`8_task.md:98` e `alunos.ts:235-238`.** Também foi decidida só no documento da tarefa a prioridade de "muda de turma" sobre "nome corrigido": a matrícula em outra turma com nome diferente não corrige o nome. Isso muda o que a 9.0 vai receber. **Correção exigida:** registrar em `techspec.md` §5 ("Gravar", "nome corrigido") e no RF4 do `cenarios.md`.

4. **`8_task.md:99`, `:101` e `alunos.ts:294`.** Duas outras divergências estão só no documento da tarefa:
   - `nomes_corrigidos` e `corrigidos` só entram no `resumo` e na `planilha.gravada` quando são maiores que zero.
   - A lista da turma lê o texto na API (`lerTextoDaLista`) e entrega ao motor como `DaLista`, sem coluna de turma.

   As duas mudam o contrato do §4 e do §5. **Correção exigida:** uma linha em `techspec.md` §4 ("`/lista/previa` e `/lista` com o contrato da importação", com a entrada `DaLista`) e uma no §5 "Gravar" (a contagem ausente vale zero).

   O próprio `tools/processo/divergencias.ts:1-4` lembra que divergência só no `N_task.md` reprova a rodada. Uma mudança nos dois arquivos da spec cala o aviso, mas o que vale é o conteúdo estar lá.

**Recomendações:**
- **Interface duplicada.** `apps/api/src/estrutura/lista/lista-reader.ts:5` (`ParsedRow`) e `packages/core/src/importacao/tipo.ts` (`ListaRow`) têm a mesma forma. Fique com uma só: o leitor pode devolver `ListaRow`.
- **Contratos mortos em `packages/shared`.** `previaDaListaResponseSchema`, `gravacaoDaListaResponseSchema` e `PreviaDaListaResponse` (`packages/shared/src/index.ts:200-221`) não descrevem mais nenhuma rota. A web continua validando a resposta nova com esses schemas estritos (`apps/web/src/areas/coordenacao/estrutura/api/lista.ts:53`), então a tela da lista fica quebrada até a 13.0. Confira se a 13.4 ("busca pelos nomes antigos") os remove e deixe isso escrito no `13_task.md`.
- **Marcas aceitas sem efeito.** O gravar agora aceita `marcas.transferir` e `marcas.desligar` (antes não havia candidatos), e o job conclui sem fazer nada com elas até a 9.0 e a 10.0. Vale uma linha no `TODO.md` ou no `9_task.md` para isso não chegar à develop sem efeito.
- **Contagem errada.** A autoconferência, item 1 (`8_task.md:76`), diz "44 blocos". A seção "Mutações" tem 42, como diz a própria linha `--faltando`.
- **Classificação feita duas vezes no passo (3).** `alunos.ts:409-423` refaz a classificação no `travar` e de novo no `planejar`, cinco consultas cada, sob o `statement_timeout`. Não bloqueia; é para o `infra-guardian` conferir contra o p95 do passo (3).

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/8_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/configure-app.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/lista/lista-reader.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/index.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-04 01:27:17 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: reimportar a mesma planilha dá tudo "já existe" e o banco não muda.
- Nome corrigido: o do aprovado vai ao `usuario.nome`, o do não aprovado à `lista_nome`, sem esbarrar no check `lista_nome_aprovado_sem_nome`.
- "Muda de turma" e "fora da planilha" sem marca não mudam nada.
- Auditoria sem nome: `usuario.nome_corrigido`, `lista.nome_corrigido` e `turma.alunos_lidos`.
- A1 que muda de regra: E4, E6, o teto de 3.000 linhas e 512 KB, e o 202.
- Isolamento e ano: turma da escola B, id sorteado e ano encerrado; matrícula da B numa planilha da A.
- Permissão: as varreduras de `escola-montada`.
- Casos de borda: aprovado desativado, aprovado só em outro ano, dois alunos com o mesmo nome, a mesma correção para um aprovado e um não aprovado.
- Concorrência ([P]):
  - aprovação do mesmo nome entre o passo (2) e o (3);
  - aprovação parada com o pedido travado, e o inverso;
  - pedido criado e aprovado durante o (3), e a reivindicação contra o (3) (`cenarios.md`, "Corridas");
  - nome trocado à mão;
  - duas gravações em paralelo;
  - o avulso contra o job;
  - excluir a turma contra o job.

**Cobertos:** todas as linhas da tabela têm um teste citado pelo nome, e cada nome existe. Os 42 blocos e os 10 motivos do `--faltando` batem com o diff. Não há `.skip`, `.only` nem mock que esconda a regra: os falsos de `alunos.test.ts` só servem à regra pura. As duas gravações (C8) rodam em paralelo de verdade (`Promise.all`). Rodei `alunos.test.ts`, `configure-app.test.ts` e `lista-reader.test.ts` (40 verdes), e `lista.int`, `gravar-planilha-alunos.int` e `decisao.int` (78 verdes).

**Bloqueantes:**

1. **A escrita condicional do nome não aprovado não tem bloco nem teste que chegue a ela.**
   - O que está errado: a cláusula `l.estado = v.estado and l.estado <> 'aprovado'` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:147` é a única defesa quando um pedido nasce e é aprovado dentro do passo (3), entre a releitura do `planejar` e o `update`. A reivindicação trava o ano em `FOR SHARE` e a decisão a turma em `FOR KEY SHARE`, e as duas convivem com as travas do job. O motivo (5) do documento conta com essa escrita ("fecha pela escrita condicional"), mas ela não tem bloco.
   - O teste da linha [P] não prova essa linha: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/decisao.int.test.ts:824` (`[P] o pedido criado e aprovado durante o passo (3)`) para o job já dentro do `update`. A reivindicação espera a linha e o pedido "nasce depois do commit", como diz o próprio comentário na linha 836. Nenhum pedido é criado nem aprovado durante o (3). Sem a cláusula, o teste segue verde.
   - Correção exigida: parar o job antes da correção do nome, por exemplo com o `WriteBlockTrigger` no `insert` de uma linha "entra" da mesma lista. Nessa janela, reivindicar e aprovar o nome-alvo, e depois soltar. Esperar `desatualizada` (nunca `falhou`), o `usuario` com o nome de antes e nenhuma auditoria de correção. Acrescentar o bloco que remove a cláusula, apontando para esse teste.

2. **Cláusulas novas em SQL cru, sem bloco e sem motivo escrito.**
   - O que está errado: o `where` de `ImportacaoRepository.corrigirNomesDosAlunos`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts:383`, traz `u.escola_id`, `u.papel = 'aluno'`, `u.desativado_em is null` e `u.nome = v.nome_lido`. As cláusulas de escopo `l.escola_id` e `l.ano_letivo_id` de `lista.repository.ts:147` estão na mesma situação. O `--faltando` não lê SQL cru, e a seção "Mutações" não cobre nenhuma delas.
   - Correção exigida: para cada cláusula, um bloco com teste vermelho, ou um motivo na lista "Sem bloco". No `usuario`, o motivo seria que a linha já está travada em `FOR NO KEY UPDATE` antes da releitura, e a assinatura muda antes da escrita. No escopo, seria o mesmo argumento do motivo (2).

3. **O limite por usuário e por escola das duas rotas da lista não tem teste.**
   - O que está errado: `@ImportacaoRateLimit()` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/lista/lista.controller.ts:30` e `:38`, e a vaga da escola (`comVaga`) em `importacao.service.ts`, são a proteção da regra 80 para uma rota cujo teto esta tarefa multiplicou por 15. Se alguém tirar o decorador ou trocar `comVaga` por chamada direta, nenhum teste quebra.
   - Correção exigida: em `lista.int.test.ts`, provar que o 21º pedido do usuário em `/lista/previa` ou `/lista` recebe 429, no mesmo balde de `/v1/importacoes`, e que outro usuário da escola segue. Provar também que a terceira prévia ao mesmo tempo na escola recebe 429 e que a outra escola segue, como já fazem os casos de `importacao.int.test.ts:617-662`.

**Recomendações:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts:417`: o nome promete "desativado ou com o nome trocado", mas o teste só troca o nome. Acrescentar o caso do aprovado desativado entre o (2) e o (3), ou tirá-lo do nome.
- `gravar-planilha-alunos.int.test.ts:380` (`isolamento da reimportação`): o nome diz que os alunos da B "não viram candidatos", mas nada confere os candidatos. Acrescentar a prévia da A com `candidatos: []`.
- Nenhum teste corrige mais nomes do que um lote (`TAMANHO_DO_LOTE = 500`). Vale um caso com mais de 500 correções, para provar a soma das linhas mudadas por lote.
- `turma.alunos_lidos` só é provado pela rota da lista. Vale um caso pela `/v1/importacoes/alunos/previa`, que passa pelo mesmo `previaDe`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 01:46:15 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, conferido sobre o código atual)

Bloqueantes: nenhum

As quatro correções da 1ª rodada estão feitas:
1. As duas rotas da lista agora são exceção ao teto de 100 KB, e o caso de prova existe no código.
   - Em `techspec.md` §4, as rotas citam `ROTA_DA_LISTA_DA_TURMA` e o caso de prova.
   - Em `cenarios.md`, a linha "Corpo JSON de outra rota" foi reescrita.
   - O caso está em `apps/api/src/configure-app.test.ts:37` e a regex em `apps/api/src/configure-app.ts:25`.
2. A regra de "fora da planilha" está em `techspec.md` §5, no parágrafo "Reimportar alunos (8.0)", e em `cenarios.md` RF4. Os dois casos existem em `packages/core/src/importacao/tipos/alunos.test.ts:162` e `:174`.
3. A prioridade de "muda de turma" sobre "nome corrigido" está escrita nos dois documentos. O caso fica em `alunos.test.ts:146`.
4. A entrada `DaLista` (`{ turmaId, linhas }`, `previaDaLista`) está em §4, e a regra "contagem ausente vale zero" está em §5 e no RF4. `ListaRow` saiu do `lista-reader.ts` e foi para `packages/core/src/importacao/tipo.ts:27`, exportada pelos dois índices: o leitor e o motor usam o mesmo tipo.

O resto do diff não abre escopo novo: são casos novos de teste (a janela entre a releitura e a escrita, o lote de 501, as 20 chamadas por minuto e as vagas da lista, a auditoria `turma.alunos_lidos`), comentários e linhas no `TODO.md` com destino.

Recomendações:
- `techspec.md` §4 e a tabela "Limites" do `cenarios.md`: escrever com todas as letras que as duas rotas da lista têm o mesmo limite de 20 por minuto por usuário que `/v1/importacoes` e ocupam as duas vagas da escola. Isso já está em `apps/api/src/estrutura/lista/lista.controller.ts:30,38` e em `apps/api/src/estrutura/importacao/importacao.service.ts:30,35`, e é provado em `apps/api/test/lista.int.test.ts`. Hoje a spec só diz "com o contrato da importação", e quem lê a tabela não descobre que a lista fica nos mesmos limites.
- `tasks/prd-onboarding-por-convite/8_task.md`, seção "Mutações", motivo (2): falta um ponto final antes de "O mesmo vale para".
- O motivo (6) da mesma seção explica as cláusulas `u.escola_id`, `u.papel`, `u.desativado_em` e `u.nome` de `corrigirNomesDosAlunos` como defesa em profundidade. O argumento só vale enquanto a trava `travarUsuarios` vier antes da releitura. Vale repetir isso no comentário do método, para que a dependência apareça quando o método for movido de repository (linha já no `TODO.md`).

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-04 01:46:27 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova neste diff. As tabelas em que o diff escreve ou que os testes leem, `lista_nome`, `usuario`, `credencial_matricula`, `reivindicacao`, `importacao_planilha` e `auditoria`, já tinham `escolaId`, e `lista_nome` tem `anoLetivoId`. Isso foi conferido na 1ª rodada e não mudou.

Queries verificadas:
- `ListaRepository.paraReimportar`: sem mudança de lógica. O escopo vem de `requireEscolaId()` e do `anoLetivoId` conferido no motor.
- `ListaRepository.corrigirNomes`: só o comentário mudou. O `where` continua com `escola_id` do contexto, `ano_letivo_id`, `id` e a escrita condicional por estado.
- `DecisaoRepository.travarPendentesDasTurmas`: só o comentário mudou. Ele agora diz que o ano só pode vir do `anoDeDestino` do motor, nunca do cliente.
- `lista-reader.ts`: trocou o tipo `ParsedRow` por `ListaRow` (`packages/core/src/importacao/tipo.ts`). O tipo não tem `escolaId` nem nada que o cliente escolha sobre escopo.
- Endpoints: nenhum novo, e nenhum passou a aceitar `escolaId` no corpo ou na query. O limite novo é de 20 pedidos por minuto por usuário, e a vaga de concorrência é da escola tirada do contexto. Isso está provado em `apps/api/test/lista.int.test.ts`, onde a outra escola e o outro usuário seguem.

Teste de isolamento: presente e efetivo.
- `apps/worker/test/gravar-planilha-alunos.int.test.ts`, em `isolamento da reimportação`, passou a conferir também a prévia da escola A. Ela devolve `candidatos: []` e marca as três linhas como `entra` quando a planilha traz matrículas da escola B. Sem o escopo de ano e escola em `paraReimportar`, os aprovados e os nomes da B apareceriam como "nome corrigido" ou como candidatos, e a asserção quebraria.
- Isso vale para o escopo como um todo, não para a cláusula `escola_id` sozinha. Tirar só ela não muda o resultado, porque a chave composta (escola, ano, turma) prende o ano à escola. A tarefa documenta isso nas linhas sem bloco de mutação, e o isolamento entre escolas segue provado pelos testes de outra escola e de outro ano já existentes.
- O 404 igual para turma de outra escola, id sorteado e ano encerrado continua coberto por `lista.int.test.ts`, sem mudança.

Bloqueantes: nenhum.

Recomendações:
- O caso de isolamento novo da prévia chama `motor.previa` direto, dentro de `runInContext`, e não pela rota HTTP `/v1/importacoes/alunos/previa` com o token da escola A. Um teste pela API provaria também que o contexto vem do token.
- `ImportacaoRepository.corrigirNomesDosAlunos` continua fazendo o UPDATE em `usuario` fora do repository dono da tabela. Já foi recomendado na 1ª rodada e está registrado no `TODO.md`; continua como recomendação.

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/8_task-diff-r2.diff` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-04 01:46:32 · `tasks/prd-onboarding-por-convite/8_task.md`

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
- A rodada 1 não exigiu correção, então não havia nada a conferir. O diff r2 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/8_task-diff-r2.diff`) não muda comportamento no caminho quente. Em código, só troca `ParsedRow` por `ListaRow` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/lista/lista-reader.ts` (o tipo é exportado por `@educa/core`, em `packages/core/src/index.ts:77`) e mexe em comentários. O resto são testes novos e documentação.
- Os testes novos cobrem o que a regra 80 pede:
  - **Rate limit nas duas rotas da lista:** 20 pedidos por minuto por usuário, no mesmo balde de `/v1/importacoes`, e outro usuário da escola segue (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/lista.int.test.ts`).
  - **Vaga por escola (`[P]`):** com as duas vagas ocupadas, a prévia e o gravar recebem 429, a outra escola segue e a vaga solta volta. As rotas continuam com `@ImportacaoRateLimit()` (`apps/api/src/estrutura/lista/lista.controller.ts:30` e `:38`) e passam por `comVaga` (`apps/api/src/estrutura/importacao/importacao.service.ts:30` e `:35`).
  - **Corrida entre a releitura e a escrita condicional de `corrigirNomes`:** dois casos, só reivindicado e reivindicado e aprovado, os dois terminam `desatualizada` e nunca `falhou` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/decisao.int.test.ts`).
  - **Aprovado desativado entre o passo (2) e o (3):** coberto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts`.
  - **Soma por lote:** 501 + 501 nomes corrigidos fecham a conta, no mesmo arquivo do worker.
  - Nenhum teste chama provedor pago.
- Fica em aberto o que já está no `TODO.md`: o `or(...)` sem índice próprio em `ListaRepository.paraReimportar`. Anexar o `EXPLAIN` com 3.000 linhas antes do pouso da spec, e não deixar para depois.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-04 01:46:34 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. Esta rodada só mudou testes, comentários e documentação, mais uma troca de tipo em `apps/api/src/estrutura/lista/lista-reader.ts`: o `ParsedRow` local deu lugar ao `ListaRow`, que agora fica em `packages/core/src/importacao/tipo.ts:27`. Os campos são os mesmos (`linha`, `nome`, `matricula`) e o tipo não foi alargado.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. O diff só acrescenta prova:
- O caso de isolamento da reimportação agora confere que a prévia da escola A volta com `candidatos: []`. Nenhum aluno da B aparece como "muda de turma" e nenhum nome da lista da B aparece como ausente (`apps/worker/test/gravar-planilha-alunos.int.test.ts:220-225`).
- Os comentários novos em `decisao.repository.ts:130` e `lista.repository.ts:139` registram que o `anoLetivoId` só pode vir de um ano já conferido na escola, nunca do cliente.

**Logs:** limpos. Nenhuma linha de log entrou no diff.

**Auditoria:** presente, e agora com teste. `turma.alunos_lidos` passou a ter prova também na prévia de `/v1/importacoes/alunos/previa` (`apps/api/test/importacao-alunos.int.test.ts:120-141`):
- A prévia que não mostra nome do banco não grava nada.
- A que mostra grava um registro por turma, com autor, `finalidade: 'conferencia_de_cadastro'` e `depois: { quantidade: 2 }`.
- O teste afirma que nenhum nome aparece no registro.

A mutação que tira o `auditarLeituras` (`motor.ts:73`) tem bloco. O comentário de `lista.gravada` em `acoes.ts:306` também foi corrigido: quem monta o arquivo do titular passa a saber que a gravação pelo texto fica em `planilha.gravada`. Isso ajuda a responder à pergunta de fechamento.

**Envio externo:** nenhum. A tarefa não chama IA.

**Seed/fixture:** sintético. Os testes novos usam nomes inventados ("Aluno Ausente Um", "Antigo Aprovado N", "Corrigido Livre N", "Aluno Novo da Janela") e matrículas aleatórias.

**Correções exigidas na 1ª rodada:** nenhuma. As recomendações da 1ª rodada que eram minhas estão registradas no `TODO.md` (seção da tarefa 8.0) e na tabela "Recomendações sem aplicar" de `tasks/prd-onboarding-por-convite/8_task.md`:
- A linha do dossiê sobre `turma.alunos_lidos`.
- Os schemas antigos da lista, que a 13.0 remove.

**Pergunta de fechamento:** o diff não piora a resposta e melhora a rastreabilidade. A leitura de nomes pela prévia da planilha agora é auditada e testada, e o comentário de `lista.gravada` diz onde procurar a gravação pelo texto.

**Bloqueantes:** nenhum.

**Recomendações:**
- No teste `turma.alunos_lidos` (`importacao-alunos.int.test.ts:140`), a checagem de que o nome não aparece busca só a substring "Aluno Ausente". Ela também poderia procurar a matrícula das duas linhas inseridas, que é o outro dado que o rótulo do candidato mostra.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/8_task-diff-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-04 01:46:48 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum no diff. A rodada nova não toca `Nota`, nenhum job, seed ou importação de nota, nem `lancadaPor`. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. Desligar e transferir continuam dependendo da marca da coordenação. O teste novo `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `mais nomes corrigidos do que cabem num lote` confirma que os quatro alunos que ficam fora da planilha não mudam sem marca. A correção de nome é um ato de cadastro feito pela planilha da coordenação. Não envolve IA nem afeta a trajetória do aluno.

Aprovação registrada: ok. Não há saída de IA neste diff.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. Nada mudou aqui.

Bloqueantes: nenhum.

O que conferi no diff desde a 1ª rodada (de `cd58a91a` a `b260e863`):
- **Testes novos.** Pedido de nome feito ou aprovado no intervalo entre a releitura do plano e a escrita (`apps/api/test/decisao.int.test.ts`). Limite de pedidos e vaga da escola nas rotas da lista (`apps/api/test/lista.int.test.ts`). `turma.alunos_lidos` gravado pela prévia da planilha (`apps/api/test/importacao-alunos.int.test.ts`), com a quantidade e sem o nome. Isolamento da prévia entre escolas, lote de 501 nomes e aluno aprovado desativado no meio do caminho (`apps/worker/test/gravar-planilha-alunos.int.test.ts`).
- **Código.** Só comentários em `packages/core/src/auditoria/acoes.ts`, `packages/core/src/estrutura/decisao.repository.ts`, `packages/core/src/estrutura/lista.repository.ts` e `infra/scripts/carga-sala.ts`. Em `apps/api/src/estrutura/lista/lista-reader.ts`, o tipo `ParsedRow` foi trocado por `ListaRow`, o mesmo usado no core.
- **Documentos.** `TODO.md`, `8_task.md`, `cenarios.md` e `techspec.md`.

Nada disso toca nota, IA, tutor, autonomia de agente, indicador de professor, vigilância (item 7) ou nota proposta em discursiva e redação (D46/D55). A 1ª rodada não exigiu correção. A recomendação de conformidade daquela rodada (candidatos a `transferir` e `desligar` chegando desmarcados à tela, sem "marcar todos" já marcado, e o rótulo de conferência a partir da planilha) entrou no `TODO.md`, na seção "Da tarefa 8.0", com destino 9.0, 10.0 e 13.0.

Recomendações:
- Na 9.0 e na 10.0, cobrar o teste de que gravar sem marca não transfere nem desliga ninguém, como diz o `TODO.md`. Desligar é uma decisão de cadastro que precisa continuar só nas mãos da coordenação, sem nada vir pré-marcado.

Arquivos de referência:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/8_task-diff-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/8_task.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-04 01:48:04 · `tasks/prd-onboarding-por-convite/8_task.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada):**
1. A escrita condicional de `corrigirNomes` na janela entre a releitura e a escrita: um caso em que o nome é só reivindicado, outro em que é reivindicado e aprovado.
2. Cada cláusula nova em SQL cru, com bloco de mutação ou motivo escrito.
3. O limite por usuário (20 por minuto, no balde de `/v1/importacoes`) e a vaga da escola nas duas rotas da lista.
4. As quatro recomendações que o Implementador aplicou.

**Cobertos:**

**Correção 1, feita.** O teste `pedidoNaJanelaDaEscrita` (`apps/api/test/decisao.int.test.ts:65`) para o job no `insert` da linha "entra". Pela ordem do `aplicar` (`packages/core/src/importacao/tipos/alunos.ts:354-355`, primeiro `inserirNomes` e depois `corrigirNomes`), essa parada fica depois da releitura e antes da correção. Na janela o teste reivindica o nome e, num dos casos, também o aprova. Depois confere:
- o desfecho e o estado da importação, `desatualizada`;
- o nome de antes, na lista ou no `usuario`;
- nenhuma auditoria `lista.nome_corrigido` nem `usuario.nome_corrigido`.

Os dois blocos chegam à cláusula pelo motivo certo:
- Tirar `l.estado = v.estado` e `<> 'aprovado'` deixa a escrita passar pela linha aprovada. O check `lista_nome_aprovado_sem_nome` falha e a importação sai `falhou`.
- Tirar só o `=` deixa a linha reivindicada ser corrigida, e a importação sai `concluida`.

Rodei os dois testes e os dois passam.

**Correção 2, feita, com motivo no item (6) da lista "Sem bloco":**
- `l.escola_id` e `l.ano_letivo_id`: o id vem da releitura no ano de destino, e a chave composta prende o ano à escola.
- `l.estado <> 'aprovado'`: o `estadoLido` vem de `naoAprovados`, que nunca é aprovado.
- No `usuario`: a linha está trancada por `travarUsuarios` em `FOR NO KEY UPDATE`, e a desativação ou a troca de nome muda a assinatura antes da escrita.

Os motivos se sustentam. A assinatura (`alunos.ts:221`) inclui o tipo, o id, o estado, o nome e a turma do alvo, então a aprovação que chega antes das travas também fecha `desatualizada`.

**Correção 3, feita** (`apps/api/test/lista.int.test.ts:167-207`). Rodei os dois casos e os dois passam.
- Limite por usuário: 20 prévias da lista passam. A 21ª recebe 429, e o gravar da lista também. A prévia de `/v1/importacoes/alunos/previa` recebe 429 no mesmo balde. Nenhuma importação é gravada, e outro coordenador da escola segue.
- Vaga da escola: o teste ocupa as duas vagas pelo `SchoolSemaphore` da própria API. A prévia e o gravar recebem 429 sem gravar importação, a outra escola segue, e a vaga solta volta.
- Os quatro blocos (os dois `@ImportacaoRateLimit` e os dois `comVaga`) ficam vermelhos. Sem `comVaga`, o gravar responderia 202 e criaria importação.

**As quatro recomendações aplicadas ficaram boas:**
- **Aprovado desativado entre o (2) e o (3)** (`apps/worker/test/gravar-planilha-alunos.int.test.ts:452`, a segunda parte): sai `desatualizada`, o nome fica e não há auditoria.
- **`candidatos: []` no isolamento da reimportação:** a prévia da A com as matrículas da B não oferece ninguém, e as três linhas saem `entra`.
- **Mais de um lote:** 501 aprovados e 501 não aprovados. Os dois blocos de `+=` trocado por `=` levariam a `DiferencaNaPlanilhaError` e a `desatualizada`, então o teste quebra.
- **`turma.alunos_lidos` pela `/v1/importacoes/alunos/previa`:** o teste confere o caso negativo e o positivo, a quantidade, a finalidade e a ausência de nome. O bloco aponta para a única chamada, em `packages/core/src/importacao/motor.ts:73`.

**A tabela do documento:** cada linha nova cita o teste pelo nome, e os nomes existem. Não há `.skip` novo, nem mock que esconda a regra, nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- `ImportacaoRepository.corrigirNomesDosAlunos`, `u.nome = v.nome_lido`: o motivo diz que nenhuma escrita chega com a linha mudada. Há uma brecha estreita, do tipo ABA (o valor sai e volta antes da releitura). O `travarUsuarios` só tranca quem a classificação sem trava do `travar` viu como `nome_corrigido`. Um aluno visto ali como "já existe", com o nome igual ao da planilha, e renomeado de volta antes da releitura passa pela assinatura sem estar trancado. Nesse caso a cláusula é a única defesa. Dá para acrescentar ao motivo "salvo o ABA entre a classificação do `travar` e a releitura", ou travar também os aprovados de "já existe" das matrículas da planilha.
- `[P] duas vagas da escola ocupadas` simula a concorrência ocupando as vagas, sem duas chamadas em paralelo. É determinístico e prova a regra. Vale dizer isso no título, porque o `[P]` sugere chamadas em paralelo.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/decisao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/lista.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/8_task.md
