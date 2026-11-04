# Achados das revisões — `tasks/prd-onboarding-por-convite/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 23:02:41 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

**Caminhos de escrita em Nota:** nenhum. O diff da 7.0 grava em `turma`, `serie`, `lista_nome`, `auditoria` e `importacao_planilha`, e em mais nada. Procurei escritas em `nota`, `correcao`, `usuario` e `credencial_matricula` em `packages/core/src/importacao/` e nos três repositórios alterados, e não há nenhuma. Todos com autor humano? Sim, porque não há caminho nenhum.

**Decisão autônoma sobre aluno:** ausente. O tipo `alunos` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`) faz só três coisas: casa a linha com uma turma pela `chave`, cria a turma e a série que faltam, e põe o nome na `lista_nome` como `livre`. Não cria usuário nem credencial. O aluno continua entrando pela reivindicação que o professor aprova (D4, regra 60 item 7). Nada aprova, reprova ou encaminha aluno. A matrícula que a escola já tem vira "já existe" e não grava nada. O que essa matrícula diz sobre nome e turma fica para as tarefas 8.0, 9.0 e 10.0, que dependem de ação humana.

**Aprovação registrada:** ok. Não há IA nesta tarefa e nenhuma saída de IA chega ao aluno. A auditoria nova `turma.criada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts:502-507`) registra só a série e a origem `planilha`. Tem como autor a coordenação que gravou a planilha (`alunos.ts:199`, gravada na transação do job) e não leva nome de aluno nem matrícula.

**Supervisão do tutor:** ok. A tarefa não toca o tutor.

**Autonomia declarada e visível:** sim, e não muda. A tarefa não cria nem altera agente.

Os itens 6 a 9 também não são tocados. A tarefa não tem IA, não mede nem infere comportamento de aluno, não toca discursiva nem redação e não cria métrica de professor.

**Bloqueantes:** nenhum.

**Recomendações:** nenhuma da regra 70. O escopo, a privacidade e a carga desta tarefa ficam com o `tenancy-guardian`, o `privacy-guardian` e o `infra-guardian`, que a tarefa exige.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 23:03:02 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. As tabelas tocadas são `turma`, `serie`, `lista_nome`, `credencial_matricula` e `auditoria` (ação nova `turma.criada`, que guarda série e origem, sem nome nem matrícula). Todas têm `escola_id`, e `turma` e `lista_nome` têm também `ano_letivo_id`. As FKs são compostas: `turma_serie_da_escola_fk`, `turma_ano_letivo_da_escola_fk` e `lista_nome_turma_do_ano_da_escola_fk`. Todos os índices únicos começam pela escola: `turma_chave_no_ano_unica`, `turma_nome_no_ano_unico`, `lista_nome_matricula_no_ano_unica` e `credencial_matricula_matricula_unica`. Por isso o `CONFLITO` ou o `desatualizada` causados por 23505 nunca dependem de dado de outra escola. Os ids são UUID.

Queries verificadas:
- `TurmaRepository.doAnoComSerie`, `criarNoAno` e `travarNoAno` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/turma.repository.ts`) pegam a escola do contexto. O join com `serie` também filtra por escola.
- `SerieRepository.todas` e `criar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/serie.repository.ts`) pegam a escola do contexto.
- `ListaRepository.emUsoNoAno` e `inserirNoAno` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`) filtram `lista_nome` por escola e ano, e `credencial_matricula` por escola.
- Os métodos novos de `ImportacaoRepository` só delegam aos repositórios acima. O autor da lista vem de `requestIdentity()`.
- O `anoLetivoId` de destino vem do corpo, mas é conferido por `anoDeDestino` e por `anoPorId`, ambos com `eq(anoLetivo.escolaId, requireEscolaId())`. O motor chama `travar` só depois dessa conferência.
- Nenhum endpoint aceita `escolaId`: `contratos.test.ts` prova que o schema o recusa na prévia e no gravar.
- Não há `@Unscoped()` novo e nada toca a camada de rede.

Teste de isolamento: presente e efetivo.
- Sem o `escolaId` em `credencial_matricula` dentro de `emUsoNoAno`, a linha `credencialDaB` viraria `ja_existe` e o caso `isolamento: a matrícula da escola B…` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts` quebraria.
- Sem o `escolaId` em `SerieRepository.todas`, a série 8º EF da escola B entraria no mapa da A. A criação da turma da A violaria `turma_serie_da_escola_fk` e o caso `isolamento: a matrícula e a turma da escola B…` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts` quebraria.
- Os filtros de escola em `turma` e em `lista_nome` são redundantes com o filtro de ano, que já é da escola (UUID conferido no escopo). Ficam pela regra 10, item 3.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/7_task.md:110`, motivo (3): o texto diz que, sem o `eq(escolaId)`, "o resultado é o mesmo" por causa da FK composta. Isso é falso para `SerieRepository.todas()`, que não tem filtro de ano: sem o termo, ela devolve as séries de todas as escolas. Hoje quem pega isso é a FK `turma_serie_da_escola_fk` mais o caso de isolamento do worker. Corrigir o motivo, ou trocá-lo por um bloco de mutação que aponte para esse caso.
- No mesmo parágrafo, as referências `lista.repository.ts:93/:98/:102/:112` e `turma.repository.ts:211/:221` não batem com as linhas atuais dos arquivos. Reapontar.
- `ImportacaoRepository.inserirNomes` não chama `requireEscolaId()` antes de delegar, ao contrário dos métodos irmãos. O `inserirNoAno` já exige a escola, então o efeito é o mesmo; vale só pela uniformidade.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 23:03:10 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: o nome e a matrícula do aluno. Entram em `lista_nome` como nome livre e ficam guardados até o job terminar em `importacao_planilha.linhas`. Os dois campos já existem. Nenhuma coluna nova foi criada. O nome da turma e a série não são dados de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada. A tabela já cobre os dois lugares:
- `docs/lgpd.md:73` ("Planilha em gravação", que inclui turma, nome e matrícula do aluno)
- `docs/lgpd.md:84` ("Lista de nomes da turma")

Ambos têm finalidade e retenção. Não entra nenhum campo proibido: e-mail, telefone, CPF, foto, endereço, nascimento ou diagnóstico. A matrícula que parece CPF ou data vira erro de linha (`alunos.ts:125`), e a matrícula em notação científica também (`alunos.ts:124`).

Autorização por objeto: ok.
- **Escopo das leituras novas:** `doAnoComSerie`, `travarNoAno` e `criarNoAno` (`turma.repository.ts:608-645`), `emUsoNoAno` e `inserirNoAno` (`lista.repository.ts:525-548`) e `todas` (`serie.repository.ts:562`) pegam a escola do contexto.
- **Ano de destino:** é conferido pelo motor (`anoDeDestino` e `anoPorId`, com escopo de escola).
- **Turmas existentes:** o `turmaId` de uma turma que já existe só vem da leitura com escopo, nunca do cliente.
- **Respostas iguais:** um ano de outra escola, um `turmaId` no corpo, e o professor ou o aluno pedindo a rota recebem `NAO_ENCONTRADO`. Os testes estão em `apps/api/test/importacao-alunos.int.test.ts:371` e `:387`.
- **Isolamento:** a matrícula, a credencial e a turma "8A" da escola B têm caso no teste de API e no de worker.
- **Saída da prévia:** o DTO é explícito. O motor passa a resposta por `previaDaPlanilhaResponseSchema.parse` (`motor.ts:72`), e só saem `linha`, `resultado` e o código. Nome e matrícula ficam só em `guardado`, que nunca é devolvido ao cliente.

Logs: limpos. Não há logger nos arquivos novos. Quando o job bate no índice único (23505), ele fecha `desatualizada` sem logar (`motor.ts:170`). Qualquer outro erro que suba passa por `summarizeError`, que descarta `message` e `detail` do Postgres, onde a matrícula apareceria.

Auditoria: presente.
- **`turma.criada`:** é ação nova na lista fechada (`acoes.ts:502`). O `depois` só aceita série e origem, num `strictObject`, sem nome de turma nem de aluno. O teste confere o `depois` exato (`gravar-planilha-alunos.int.test.ts:181-209`).
- **`planilha.gravada`:** continua registrada pelo motor, só com as contagens.
- **Ações que a regra exige auditoria:** a tarefa não lê dado de aluno pela coordenação nem faz exportação, e não mexe em nota nem em permissão.

Envio externo: nenhum. Não há chamada a IA nem a terceiros.

Seed/fixture: sintético. Os testes usam `Aluno Sintético ${uuid}`, "Ana", "Bia" e matrículas geradas.

Pergunta de fechamento: o código responde. O que a planilha grava cai em `lista_nome`, que a eliminação e o arquivo do titular já cobrem. As linhas guardadas em `importacao_planilha` saem quando o job termina. A auditoria não leva nem nome nem matrícula.

Bloqueantes: nenhum.

Recomendações:
1. `packages/shared/src/importacao/contratos.ts:170`: o `codigoDeLinha` aceita qualquer palavra em `[a-z0-9_]`. Hoje os códigos vêm da união fechada `ErroDaLinhaDeAluno` (`alunos.ts:56`), então nada vaza. Mesmo assim, um enum fechado no contrato compartilhado deixaria impossível, por estrutura, um código montado com uma palavra da linha (um nome curto em minúsculas, por exemplo).
2. Nenhum teste lê a linha de `importacao_planilha` depois de concluída para provar que, no tipo alunos, `linhas` foi esvaziado (retenção da `docs/lgpd.md:73`). A garantia vem do motor da 4.0. Uma asserção a mais no caso feliz de `gravar-planilha-alunos.int.test.ts` provaria a retenção também para este tipo.
3. A planilha de alunos coloca até 3.000 nomes livres de uma vez na lista da turma. Pela `docs/lgpd.md:84`, esses nomes ficam visíveis a quem tiver o link ou o código vigente da turma. Isso já está documentado e não é furo novo. Vale lembrar a tela da 13.0 de avisar a coordenação disso antes de gravar.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/turma.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/serie.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-03 23:03:53 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Três pontos divergem da spec original, e os três estão registrados na `techspec.md` e no `cenarios.md`, não só no `7_task.md`:
- A matrícula que a escola já tem vira "já existe": `techspec.md` §5 "Gravar", "Alunos (7.0)"; `cenarios.md` RF2, linha 17.
- O gancho opcional `travar` no tipo: `techspec.md` §5.
- A ação `turma.criada`: `cenarios.md` RF17, linha 239.

Os arquivos fora da lista de previstos são os pontos onde o código novo precisava entrar.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum

Recomendações:
1. **"Já existe" grosso, à espera da 8.0.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:160`, toda matrícula em uso cai em `ja_existe`, inclusive a que a 8.0 vai separar em "nome corrigido" e "muda de turma". Enquanto a 8.0 não chega, a coordenação que reimporta vê "já existe" para o aluno que mudou de turma. Isso se sustenta como passo intermediário e está documentado. A recomendação é escrever no `8_task.md`, na seção de contexto, que a 8.0 parte desse `ja_existe` e o divide. Assim a 8.0 não trata o caso "A mesma planilha duas vezes", que a 7.0 já entrega em boa parte, como trabalho novo.
2. **Ternário que só serve ao tipo.** Em `alunos.ts:195`, `nova.serie.etapa === 'em' ? { etapa: 'em', … } : { etapa: 'ef_anos_finais', … }` existe só para encaixar `Etapa` em `CriarSerieRequest`. Uma função `pedidoDaSerie(serie)` com nome, ou um `serieDaChave` que já devolva o tipo do pedido, deixa isso legível.
3. **Linhas longas demais.** `alunos.ts:161`, `:167` e `:201` passam de 180 colunas. Vale extrair a montagem da assinatura em `assinaturaDe(anoLetivoId, linhas)` e o registro da turma nova numa linha própria.
4. **Escopo conferido duas vezes.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts:329-363`, cada delegação chama `requireEscolaId()` e depois o repository delegado chama de novo. Não faz mal, mas é ruído. Se a intenção é satisfazer a guarda de escopo, cabe um comentário único em vez de seis chamadas.
5. **Trava a mais, sem efeito no resultado.** O `travar` (`alunos.ts:232`) usa a turma de toda linha guardada, também das linhas de erro e das de "já existe". Por isso trava turmas que não recebem escrita. É inofensivo e mais simples do que filtrar, mas vale uma linha no docblock dizendo que é de propósito.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 23:04:12 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (o job `estrutura.gravar-planilha`, com o tipo alunos de até 3.000 linhas)
Rate limit: ok (`@ImportacaoRateLimit`, 20 por minuto por usuário, para a prévia e para o gravar; não há limite por IP)
Fila e prioridade: ok (prioridade `normal`, concorrência por escola, uma importação `na_fila` por escola pelo único parcial; o tipo novo não muda isso)
Concorrência: protegida
- A turma criada à mão ou renomeada é barrada pelo único de `turma_chave_no_ano_unica` e `turma_nome_no_ano_unico`; o 23505 fecha a importação `desatualizada`.
- A matrícula na lista é barrada pelo único `lista_nome_matricula_no_ano_unica`.
- A série é barrada por `serie_escola_etapa_ano_unico`.
- O job que roda duas vezes é resolvido pelo `for update` da importação e pela conferência do estado.
- As turmas são travadas em `FOR NO KEY UPDATE` por id, num comando só, na ordem importação, ano e turma. Esse modo deixa passar o `FOR KEY SHARE` da sala.
Índice e paginação: ok
- `emUsoNoAno` usa `(escola_id, ano_letivo_id, btrim(matricula))` e `(escola_id, matricula)`.
- `doAnoComSerie` e `travarNoAno` usam `(escola_id, ano_letivo_id, id)`.
- A prévia faz o mesmo número de consultas com 30 e com 3.000 linhas, e há teste que conta.
- Não pagina, mas a leitura é interna e limitada: as turmas de um ano e as séries da escola.
Degradação de IA: não se aplica
Migration: não se aplica (a tarefa não tem migration)
Métrica e alerta: ok (o passo (3) já é medido pelo `aoMedirOPasso3` do motor; a tarefa não traz alerta novo)
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts:405`: o título diz que o único da `credencial_matricula` impede gravar a mesma matrícula. Não impede: a planilha grava em `lista_nome`, e o único da credencial não alcança essa tabela. O que pega o caso é a releitura no passo (3). Fica uma janela sem trava entre essa releitura e o commit. Uma credencial gravada nela, por exemplo a aprovação de um aluno da lista de outro ano, não é barrada, mas o estado final é o mesmo de "planilha primeiro, aprovação depois", então não é bug. Corrija o título e escreva no docblock de `emUsoNoAno` (`packages/core/src/estrutura/lista.repository.ts:72`) que a proteção é a releitura sob a trava do passo (3) e que a ordem serial equivalente é aceita.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:551` e `:492`: o `travar` e o `planejar` leem `turmasDoAno` cada um, dentro da transação travada do passo (3). É uma consulta a mais enquanto as turmas estão em `FOR NO KEY UPDATE`; dá para reaproveitar a leitura.
3. No staging, medir quanto dura o passo (3) com 3.000 linhas e cerca de 32 turmas novas, separado por tipo de planilha. Durante esse tempo, quem gera acesso numa turma tocada espera; o `statement_timeout` de 1,5 s limita cada comando, mas não a transação inteira. Hoje o caso de 3.000 linhas só mostra que o job conclui no teste.

Os dois arquivos de integração da tarefa passaram (`gravar-planilha-alunos.int.test.ts` e `importacao-alunos.int.test.ts`, 40 testes).

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 23:06:00 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** turma escrita de três jeitos (caminho feliz, RF3). Duas turmas com a mesma chave, ou com a chave nula deixada pela migration. Turma renomeada, nos dois sentidos. "Turma Azul", "10A", "4A" e "6AB". Série criada quando falta. Homônimos. Matrícula repetida, em notação científica ou com cara de CPF ou data. Matrícula que a escola já tem. Teto de 3.001 linhas ou 512 KB, e 3.000 que entram. Consultas da prévia que não crescem com a planilha. Escola sem ano em curso e ano de outra escola. Turma e lista de outro ano. Permissão do professor e do aluno. Isolamento entre escolas (lista, credencial, "8A" e série da B). Corridas: criação à mão e renomeação contra o job (nos dois sentidos), mudança entre o passo (2) e o (3), nome avulso, credencial, job executado duas vezes, trava acima de 1 s, gerar acesso e encerrar do ano.

**Cobertos:** cada linha da tabela de testes tem o seu caso, citado pelo nome. Conferi os itens juntados por ponto e vírgula um a um. Não há `.skip`, teste comentado nem mock que esconda a regra. A tarefa não tem IA. A unidade passa: `alunos.test.ts` deu 8 de 8.

Estão certos:
- **Execução dupla:** as duas execuções do mesmo job correm em paralelo de verdade (duas tentativas presas na mesma trava e soltas juntas).
- **Mesma execução:** os cenários de único violado chamam o processor uma vez e conferem `desatualizada` na tentativa 1.
- **Ordem das travas:** é conferida pelo espião, e a turma não tocada fica de fora.
- **Isolamento:** pega a credencial da B (bloco no `lista.repository.ts`) e a série da B (bloco no `serie.repository.ts`).

**Bloqueantes:**

1. **A corrida da criação à mão não é uma corrida.** Está em `apps/api/test/importacao-alunos.int.test.ts:407`.
   - O que acontece: o `esperarNaTrava(bancada.pool, '%insert into "turma"%')` encontra o próprio job. Ele está parado no gatilho, numa espera de trava (`wait_event_type = 'Lock'`), com a consulta `insert into "turma" …`. A espera volta na primeira conferência, o gatilho é solto e o job confirma antes de o `POST /v1/turmas` chegar ao índice.
   - Por que bloqueia: o teste vira duas chamadas em sequência. Ele continuaria verde se a criação à mão fosse "confere e depois grava", sem o índice único decidir.
   - Correção exigida: esperar dois processos na trava (`esperarNaTrava(…, '%insert into "turma"%', 2)`), ou um padrão que só a consulta da API casa. Assim se prova que a criação à mão está mesmo esperando o índice do job.

2. **Quatro corridas da API só passam se a requisição HTTP couber em 1 s.** Estão no mesmo arquivo, linhas 406–408 (criação, depois de corrigida), 427–428 (renomeação), 463–464 (gerar acesso, ordem b) e 482–483 (encerrar do ano).
   - O que acontece: o job fica parado no gatilho dentro do passo (3). A espera do gatilho é uma trava consultiva e obedece ao `lock_timeout` de 1 s e ao `statement_timeout` de 1,5 s do `limitesDoPasso3`. Dentro desse intervalo o teste ainda precisa disparar a requisição, esperar a API ler a sessão e chegar à trava, detectar e soltar.
   - Por que bloqueia: com a máquina carregada (o portão roda integração em paralelo), o job estoura com `55P03` e o teste fica vermelho sem defeito no código. A própria suíte já registrou esse risco e o evitou, em `apps/api/test/importacao.int.test.ts:407`: "Direto no banco: o job espera a trava só 1 s, e o encerrar precisa chegar a ela dentro disso."
   - Correção exigida: dentro do intervalo do passo (3), só passos feitos direto no banco. Duas saídas:
     - a escrita concorrente vai por SQL, como na 4.0, e a resposta `CONFLITO` da API se prova fora desse intervalo;
     - ou o lado HTTP fica parado antes de o job entrar no passo (3), como já faz a ordem (a) do gerar acesso.

3. **Cláusulas novas sem bloco de mutação e sem motivo escrito.**
   - `packages/core/src/importacao/motor.ts:259`, `await tipo.travar?.(gravacao, ano, linhas)`: é a chamada que leva o `FOR NO KEY UPDATE` da subtarefa 7.3 ao passo (3).
   - `packages/core/src/importacao/tipos/alunos.ts:233`, o filtro `pedidas.has(indiceDaTurma(turma.nome, turma.chave))`: é ele que limita a trava às turmas que as linhas tocam. O bloco que existe muta o `inArray` do `turma.repository.ts`, não este filtro.
   - O `--faltando` não listou nenhuma das duas. O caso `o passo (3) trava as turmas que as linhas tocam…` (`apps/worker/test/gravar-planilha-alunos.int.test.ts`) já ficaria vermelho com qualquer uma removida, pelo número de travas e pela turma não tocada. Falta declarar os dois blocos na seção "Mutações".

**Recomendações:**
- **Nome do teste da credencial.** O caso `[P] aluno aprovado com a matrícula M…` (`apps/worker/test/gravar-planilha-alunos.int.test.ts:405`) diz, entre parênteses, que "o único da `credencial_matricula` não deixa gravar". O que ele prova é outra coisa: o passo (3) relê a credencial e a assinatura muda. O job da 7.0 não escreve em `credencial_matricula`, e não há restrição entre ela e a `lista_nome`. Vale corrigir o nome do caso e a linha do `cenarios.md:40-41` ("viola o único"), para ninguém contar com um índice que não existe.
- **`rejects.toBeDefined()` da falha definitiva** (`apps/worker/test/gravar-planilha-alunos.int.test.ts:519`): poderia conferir que o erro é o `ImportacaoIlegivelError`. Hoje o `estado: 'falhou'` já segura o teste.
- **Lotes de nomes.** O `inserirNomes` (`packages/core/src/importacao/importacao.repository.ts`) reparte os nomes em lotes de `TAMANHO_DO_LOTE`. Sem o corte, 3.000 linhas ainda cabem num comando, então nenhum teste pegaria a mudança. Vale uma linha de motivo na seção "Mutações".
- **Fôlego do job duplo e do passo (2)–(3).** Esses dois testes (`entreOs2e3` e "duas execuções") também esperam dentro do `lock_timeout` de 1 s, mas só com passos direto no banco. Hoje o intervalo é curto; convém manter assim.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-03 23:19:01 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. O diff só tem testes, refatoração em `alunos.ts`, um comentário em `lista.repository.ts` e documentação.

Queries verificadas:
- `packages/core/src/estrutura/lista.repository.ts`: a mudança é só um comentário. `emUsoNoAno` continua igual e com escopo de escola vindo do contexto.
- `packages/core/src/importacao/tipos/alunos.ts`: `assinaturaDe`, `turmaNova` e `pedidoDaSerie` foram extraídas sem mudar o comportamento. Nenhuma recebe `escolaId`, e `criarSerie` e `criarTurma` continuam pelo repository com escopo.
- `motor.ts`, `turma.repository.ts`, `serie.repository.ts` e `importacao.repository.ts` não mudaram desde a 1ª rodada. Não reauditei.

Teste de isolamento: presente e efetivo. Os casos de isolamento da API e do worker (matrícula, credencial e turma "8A" da escola B) não mudaram desde a rodada aprovada. As novas consultas diretas pelo pool `apoio` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts` servem só para abrir as corridas `[P]` dentro da janela de trava e filtram por escola ou por id da própria escola. Nenhum endpoint passou a aceitar `escolaId` vindo do cliente.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts`, no caso do encerrar do ano: o encerramento agora é um `update ano_letivo` direto no banco, sem passar pelo service. A expectativa foi de 0 nomes na lista para 1, então a virada da sala deixou de ser exercida contra o job. Se essa garantia importa, vale ter um caso pela API fora da janela de trava, como já foi feito para turma e renomeação.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-03 23:19:08 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre as árvores `cae9ae69` e `20f8548d`, sem a pasta `achados/`, e o que ele afeta. Na 1ª rodada nenhuma correção foi exigida.

Campos pessoais tocados: nenhum campo novo e nenhuma migration nova. O diff mexe em `nome` e `matricula` de `lista_nome` só onde eles já passavam:
- No código: `alunos.ts` foi refatorado, com `assinaturaDe`, `turmaNova` e `pedidoDaSerie` separados em funções. A assinatura continua sendo o hash de `[linha, resultado, erro, destino]`, sem nome nem matrícula, como na rodada aprovada.
- Nos testes: o teste do worker em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/gravar-planilha-alunos.int.test.ts` continua conferindo `linhas: null` e `marcas: null` quando a importação termina. Assim a retenção prevista no `docs/lgpd.md` segue provada: a importação concluída não guarda mais nome nem matrícula.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota, permissão ou escopo de repository mudou. Em `lista.repository.ts` só entrou um comentário. Os casos de isolamento da API e do worker estão intactos, e as consultas continuam presas à escola do contexto.

Logs: limpos. O diff não acrescenta log, e `alunos.ts` e `motor.ts` não têm `logger` nem `console`.

Auditoria: presente. O `registro.gravar(tx, 'turma.criada', …)` do plano não mudou.

Envio externo: nenhum, porque a tarefa não chama IA.

Seed/fixture: sintético. Os testes usam nomes como "Da Planilha" e "Avulsa à mão", matrículas geradas por `matricula()` e turmas como "8A" e "8º A".

Bloqueantes: nenhum.

Recomendações:
- Quatro testes [P] de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts` agora fazem a disputa direto no banco, pelo pool `apoio`. São os de criação de turma, de renomeação, o do passo (3) contra o gerar acesso no trecho (b) e o do encerrar do ano. A API só é chamada depois, fora da janela da disputa. Isso não afeta dado pessoal, mas muda o que esses testes provam. Quem julga se ainda bastam é o `test-engineer`, que reprovou a 1ª rodada.
- No teste do encerrar do ano, a expectativa passou de `nomesDaLista = 0` para `= 1`, porque o `update` direto não dispara a virada da sala, que apagava a lista. Para a retenção, vale ter em outro caso a prova de que encerrar o ano pela API apaga a `lista_nome`, se esse caso ainda não existir. O teste desta tarefa deixou de provar isso.

Pergunta de fechamento: este diff não cria dado novo nem destino novo. O que a planilha grava sobre um aluno continua em `lista_nome` e na auditoria de `turma.criada`, e nada sai do sistema.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-03 23:19:21 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Nem esta rodada nem a tarefa 7.0 gravam em `Nota`. A planilha de alunos grava `turma`, `serie` e `lista_nome` e registra `turma.criada` na auditoria. A busca por `nota`, `lancadaPor`, `llm`, `tutor` e `aprova` em `packages/core/src/importacao/tipos/alunos.ts`, `motor.ts` e `tipo.ts` só encontra "notação científica" e a contagem de tentativas do BullMQ. Todos com autor humano? Sim, porque não há nenhum.

Decisão autônoma sobre aluno: ausente. A importação só põe o nome na lista da turma (`lista_nome`). Não cria `credencial_matricula`, então a identidade do aluno continua passando por aprovação humana (D4). Não promove, não retém e não encaminha ninguém.

Aprovação registrada: ok. Nenhuma saída de IA passa por este diff.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nenhum agente foi alterado ou criado.

Bloqueantes: nenhum.

O que mudou desde a 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/7_task-diff-r2.diff`). Nada disso toca a regra 70.
- **`packages/core/src/importacao/tipos/alunos.ts`:** refatoração pura. Saíram as funções `turmaNova`, `assinaturaDe` e `pedidoDaSerie`, e o `travar` ganhou comentário. O resultado é o mesmo.
- **`packages/core/src/estrutura/lista.repository.ts`:** só comentário, explicando que a proteção contra o aluno aprovado entre os passos (2) e (3) vem da releitura feita sob a trava, e não de um índice único.
- **`apps/api/test/importacao-alunos.int.test.ts`:** as corridas agora ficam paradas no banco, pelo pool de `apoio`, e a resposta da API é conferida depois, fora da janela da trava.
- **`apps/worker/test/gravar-planilha-alunos.int.test.ts`:** a falha definitiva agora é verificada como `JobFailureError` com `DADOS_INVALIDOS`.
- **`7_task.md` e `cenarios.md`:** a seção de mutações foi atualizada, ganhou dois blocos novos e os motivos agora citam funções em vez de números de linha.

Correções exigidas na rodada anterior: nenhuma, então não havia o que conferir.

Recomendações:
- Os testes `[P]` de `apps/api/test/importacao-alunos.int.test.ts` agora provam a corrida no banco e a resposta da API em dois momentos separados, sem a API presa na trava. Isso cabe ao `test-engineer` e ao `tenancy-guardian`, não a esta regra. Fica registrado para a retro: avaliar se a API ainda devolve CONFLITO quando perde dentro da janela.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 23:19:33 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Desde a 1ª rodada, o código de produção mudou só em duas coisas. Primeira, `assinaturaDe`, `turmaNova` e `pedidoDaSerie` foram extraídas em `packages/core/src/importacao/tipos/alunos.ts`, sem mudar o comportamento. Segunda, entraram dois docblocks: um em `travar`, outro em `ListaRepository.emUsoNoAno`. O texto da credencial ("releitura sob a trava, sem único entre `credencial_matricula` e `lista_nome`") foi corrigido no `cenarios.md:40-41` e no `7_task.md`. Não ficou divergência registrada só no `7_task.md`. Os dois blocos de mutação novos casam com o texto atual do código (`motor.ts:259` e `alunos.ts:256`), e os blocos reescritos casam com as funções extraídas.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

Recomendações:
1. **Cenário com teste que já não exercita o `virarSala`.** A linha 64 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/7_task.md` diz "Passo (3) contra o gerar acesso e o `virarSala`". Ela cita o caso `[P] o passo (3) parado depois de gravar a lista contra o encerrar do ano`. Nesta rodada, esse caso passou a fazer `update ano_letivo set situacao = 'encerrado'` direto no banco, em `apps/api/test/importacao-alunos.int.test.ts`. A expectativa mudou de 0 nomes para 1. Por isso, nenhum teste da tarefa passa mais pelo `virarSala` depois do job. A mudança resolve o problema de tempo que o `test-engineer` apontou, mas a frase da linha 64 ficou mais forte do que o que o teste prova. Há dois caminhos:
   - acrescentar, fora da janela do passo (3), o `POST /v1/anos-letivos/:id/encerrar` pela API, conferindo que a virada apaga o nome gravado (o mesmo padrão já usado para a turma criada e para a renomeação);
   - ou ajustar a linha 64 ao que o caso cobre agora.

   A decisão é do `test-engineer`. Registro aqui porque o mapeamento no documento deixou de bater com o caso.
2. **Achados da 1ª rodada que seguem em aberto.** São recomendações de outros revisores, e nenhuma bloqueia. Vale registrá-las na tabela "Recomendações sem aplicar" do `7_task.md`, que está vazia:
   - `requireEscolaId()` chamado duas vezes em `importacao.repository.ts`;
   - `turmasDoAno` lido duas vezes no passo (3);
   - enum fechado para o `codigoDeLinha`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-03 23:19:57 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (só testes, refatoração sem mudança de comportamento em `alunos.ts`, um comentário em `lista.repository.ts` e documentação; motor e repositories iguais aos da 1ª rodada)
Rate limit: ok (não mudou)
Fila e prioridade: ok (não mudou)
Concorrência: protegida
- As corridas `[P]` já não dependem de a requisição HTTP caber no `lock_timeout` de 1 s. Dentro da janela só entram comandos direto no banco, e o `CONFLITO` da API é provado fora dela.
- Os padrões do `esperarNaTrava` (`insert into turma `, `update turma set`, `from turma where id = $1 for share`) só casam a consulta do teste, nunca o `insert into "turma"` do job. A espera prova que o outro lado está mesmo parado no índice único ou na trava.
- O `update ano_letivo` direto no banco é o mesmo primeiro comando do `encerrar` real (`mudarSituacao`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`). Então a ordem das travas (ano em `FOR SHARE` contra `update` do ano) continua provada.
- Rodei os dois arquivos de integração: 40 de 40 passaram.
Índice e paginação: ok (não mudou)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não mudou)
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts`, caso do encerrar do ano. Com o `update` direto, a expectativa passou de 0 para 1 nome, e nenhum teste exercita mais a virada da sala depois do job. A virada é o que apaga o nome que o job acabou de gravar. Vale um `POST /v1/anos-letivos/:id/encerrar` fora da janela, com 0 nomes no fim, como já foi feito para a criação e a renomeação de turma.
2. Continuam abertas as da 1ª rodada:
   - reaproveitar a leitura de `turmasDoAno` entre o `travar` e o `planejar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`;
   - medir no staging quanto dura o passo (3) com 3.000 linhas e cerca de 32 turmas novas.

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 23:20:40 · `tasks/prd-onboarding-por-convite/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** a turma escrita de três jeitos · dois alunos com o mesmo nome · matrícula repetida na planilha · matrícula da escola B na planilha da A · turma "8A" da B · turma de outro ano da mesma escola · escola sem ano em curso · permissão de professor e aluno (NAO_ENCONTRADO) · as corridas [P] (criação à mão e renomeação contra o job, gerar acesso nas duas ordens, encerrar do ano, nome avulso ou aprovado lançado entre o passo (2) e o (3), o mesmo job rodando duas vezes) · `lock_timeout` estourado e nova tentativa · falha definitiva · trava só das turmas que as linhas tocam.

**Cobertos:** todos. Na 1ª rodada eles já tinham teste; esta rodada só refez as corridas da API e a falha definitiva. Rodei os três arquivos e todos passam: `apps/api/test/importacao-alunos.int.test.ts` (22), e `apps/worker/test/gravar-planilha-alunos.int.test.ts` com `packages/core/src/importacao/tipos/alunos.test.ts` (26).

As três correções exigidas foram feitas:
1. **A criação à mão agora é uma corrida de verdade.** O `insert into turma` do teste vai por SQL e casa com `'%insert into turma %'`. O do job, gerado pelo Drizzle, é `insert into "turma"`, com aspas, e não casa com esse padrão. O gatilho é `after insert`, então a linha do job já está no índice único quando ele para. Por isso o `insert` do teste fica preso nesse índice, esperando o job, e não no gatilho. Depois que o job confirma, ele recebe `23505`, e o teste afirma isso. A renomeação segue o mesmo desenho, com `update turma set` parado no índice da `chave`.
2. **Nada de HTTP entra mais na janela de 1 s do passo (3)** na criação, na renomeação, na ordem (b) do gerar acesso e no encerrar. Ali só vai SQL direto. As respostas `CONFLITO` e 201 da API são provadas depois que a janela fecha. No encerrar, o `update ano_letivo` direto representa bem a API: o `encerrar` (`apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts:53-75`) começa pelo `mudarSituacao`, então a primeira trava que a API pede é essa mesma.
3. **Os dois blocos de mutação novos existem e chegam à cláusula.** Os dois apontam para o caso `o passo (3) trava as turmas que as linhas tocam` (`apps/worker/test/gravar-planilha-alunos.int.test.ts:480`):
   - Tirar o `tipo.travar?.()` deixa zero `for no key update` em turma, e o `toHaveLength(1)` falha.
   - Tirar o filtro `pedidas.has(…)` põe a "8C" nos parâmetros da trava, e o `not.toContain(intocada)` falha.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Citação vencida na tabela de testes.** As linhas 49 e 51 de `tasks/prd-onboarding-por-convite/7_task.md` citam `[P] a criação à mão de "8º A" parada contra o job` e `[P] a renomeação de "8B" para "8A" parada contra o job`. Os nomes atuais têm "(direto no banco)" no meio, então o trecho citado não acha mais o caso. Basta atualizar a citação para a validação encontrar o teste. A linha 64 continua casando.
- **A ordem (a) do gerar acesso ainda depende da API dentro da janela**, em `apps/api/test/importacao-alunos.int.test.ts:460-466`. Depois do `soltar`, a API ainda precisa terminar a transação dela (auditoria e commit) dentro do `lock_timeout` de 1 s do job. O risco é menor que o de antes, porque já não inclui a requisição HTTP inteira, mas o prazo continua apertado. Fica registrado para a retro. Uma saída é o teste aceitar uma nova tentativa do job, como faz o caso do `lock_timeout` no worker.
- **O fim da virada da sala saiu deste teste.** Antes, o caso do encerrar provava que a virada apagava o nome que a planilha gravou (o resultado era 0). Agora ele só prova a espera do `FOR SHARE` e o nome gravado (o resultado é 1). Vale confirmar que `apps/api/test/virada-do-ano.int.test.ts` cobre a virada apagando a `lista_nome` criada pela planilha.
