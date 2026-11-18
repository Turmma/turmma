# Achados das revisões — `tasks/prd-classificacao-bncc/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 20:38:05 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe em dado de material da escola (seção, trecho, título de capítulo), em código BNCC (tabela pública) e em controle de execução (`falhas_seguidas`, `classificada_em`, `resultado.secoes`, que é só uma contagem). A execução `classificar_secoes` nasce sem pessoa e sem ano: `solicitada_por` e `ano_letivo_id` ficam nulos, e `consumo_ia.aluno_id` também fica nulo. O teste `classificacao.int.test.ts` › caminho feliz confere isso.

Fora da tabela de dados do docs/lgpd.md: nada. A migration `0063_resultado_da_classificacao.sql` só acrescenta o tipo `classificacao_do_material` ao check de `execucao_agente.resultado` e não cria coluna de pessoa.

Autorização por objeto: ok. Todo método de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts` tira a escola de `requireEscolaId()`, nunca de argumento. A única leitura sem escola é `candidatas`, marcada com `@Unscoped` e justificada: ela lê a tabela pública da BNCC. `paraExecutarDaRotina` filtra por escola e por `solicitada_por is null`, então o comando da rotina não roda no lugar da execução de uma pessoa. Fora de `daRotina`, `quemPediu` ausente continua dando `NAO_ENCONTRADO`. Se o job da escola A trouxer o `execucaoId` da B, ele é recusado e nada muda (teste "isolamento entre escolas"). A tarefa não cria endpoint HTTP.

Logs: limpos. Os eventos novos (`ia.execucao.adiada_pela_janela`, `adiada_pelo_provedor`, `volta_nao_gravada`, `worker_ia.janela_da_escola_invalida`) levam só ids, tipo, código e espera. O teste "o log da execução leva ids…" procura o título e o texto da página nas linhas de log e não os encontra.

Auditoria: nenhuma ação desta tarefa a exige. Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota ou permissão. A gravação de `origem: 'ia'` na seção é etiqueta de material, não saída que chega ao aluno. Quem decide se ela precisa de aprovação é o `conformidade-reviewer`, pela regra 70.

Envio externo: vai ao provedor do perfil, pelo `LLMGateway`, com o balde `lote`, a checagem de soberania e `categoriasEnviadas: ['material_da_escola']`. O que vai: título do capítulo, até 1.500 caracteres do começo da seção, até 500 de subtítulos e as candidatas da BNCC. Nenhum dado de pessoa é enviado. O envio fica registrado em `execucao_agente` e em `consumo_ia`. Com `entradaParaORegistro`, o consumo guarda só os ids das seções e a versão do prompt, e o teste confere que o texto "sigiloso" não aparece. A métrica `material.classificacao.espera` leva só `escola_id` como rótulo, e isso também tem teste.

Seed/fixture: sintético. O teste monta capítulos e subtítulos com textos fictícios ("Capítulo N sigiloso", "Subtítulo sigiloso N"), e a bancada `fila-de-ia.fixture.ts` só ganhou o relógio e a janela injetados.

Pergunta de fechamento: a tarefa não grava nada novo sobre aluno. O que vai ao provedor é material da escola e está rastreado por execução em `execucao_agente` e `consumo_ia`. O que o arquivo do titular já respondia continua respondendo.

Bloqueantes: nenhum.

Recomendações:
- Há na raiz do worktree um arquivo vazio chamado `0`, que não está no git (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0`). Provavelmente sobrou de um redirecionamento de shell. Convém apagá-lo antes do commit para não ir à `develop`.
- `docs/lgpd.md`: valeria registrar no mapa de dados, na linha de `consumo_ia`, que para `classificar_secoes` a entrada guarda só ids e versão do prompt (`entradaParaORegistro`). Assim o dossiê responde sem precisar ler o código.
- O `ia.geracao.erro_inesperado` do gateway, que já existia, registra `summarizeError(erro)` com nome e pilha. Agora o lote passa por ali com texto de apostila na entrada. Vale manter o teste de que esse resumo nunca leva a mensagem do erro.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 20:38:10 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A `0063_resultado_da_classificacao.sql` só troca o check `execucao_agente_resultado_so_na_concluida` (inclui `classificacao_do_material`), com `lock_timeout`, `NOT VALID` e `VALIDATE`. `habilidade_bncc` é a tabela pública da exceção fixa (regra 10, item 1) e entra em `TABELAS_DO_NUCLEO`. `secao_do_material`, `habilidade_da_secao`, `material`, `trecho`, `disciplina`, `material_serie` e `serie` já têm `escola_id`. A execução da rotina não tem ano, conforme a Tech Spec.

Queries verificadas:
- **`SecoesRepository`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`):
  - Escopo por `requireEscolaId()` em toda consulta, inclusive no `update` em SQL cru (`s.escola_id`): `vivasDaExecucao`, `paginasDaSecao`, `recorteDosMateriais`, `gravarClassificacao`, `limparDaExecucao` e `somarFalha`. Nenhum método recebe a escola por argumento.
  - `candidatas` usa `@Unscoped` com justificativa escrita e lê só código e descrição da BNCC.
- **`ExecucaoRepository`**: `paraExecutarDaRotina`, `voltarAPendente` e `falharPendente` filtram por escola do contexto, id e estado. `paraExecutarDaRotina` filtra também `solicitada_por is null`, então o comando da rotina não roda no lugar da execução de quem pediu.
- **Varredura**: casa `j.escola_id = p.escola_id` e o par tipo e fila.
- **`ExecucaoProcessor`**: a escola vem de `job_registro` (`escopo: 'escola'`), nunca do payload, que só leva `execucaoId`. `paraIniciar` é escopado, então o job da A com o `execucaoId` da B termina em `DADOS_INVALIDOS` sem modelo.
- **`ExecucaoScheduler`**: recusa a fila `lote` vinda de requisição. Nenhum endpoint novo, e nada aceita `escolaId` do cliente.
- **Consumo e métrica**: o consumo leva só ids e versão (`entradaParaORegistro`), e a métrica só tem o rótulo de escola.
- **Camada de rede**: não é tocada.

Teste de isolamento: presente e efetivo. O arquivo é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts`, bloco "isolamento entre escolas" (linhas 883 a 927), mais os casos diretos de repository nas linhas 781, 852 e 864. Tirando `escola_id` de `vivasDaExecucao:68`, de `paginasDaSecao:81` ou de `somarFalha:196`, o caso da linha 884 quebra. O mesmo vale para `recorteDosMateriais` com o caso da linha 793 e para `paraExecutarDaRotina`, `voltarAPendente` e `falharPendente` com os casos das linhas 859, 871 e 877.

Bloqueantes: nenhum.

Recomendações:
- `secoes.repository.ts:136`, `:141` e `:152` (`gravarClassificacao`), e `:179`, `:182` e `:186` (`limparDaExecucao`): o escopo de escola está repetido em camadas, então nenhuma remoção isolada vaza dado. O lado ruim é que nenhuma mutação de uma cláusula sozinha deixa teste vermelho. Os casos das linhas 889 e 898 provam o efeito do conjunto, e a justificativa está registrada no documento da tarefa. Se uma camada sair num refactor, convém um caso que distinga cada uma delas.
- O balde `lote` de tokens é global (5%), e a justiça entre escolas fica só na vaga `lote` por escola (2). Não é vazamento de dado, mas é assunto do `infra-guardian` (regra 80, item 3).
- Há um arquivo vazio `0`, não rastreado, na raiz do worktree (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0`). Ele não deve entrar no commit.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-17 20:38:16 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Perfis usados: `rapido` na tarefa `classificar_secoes`. Classificar seção de material pela lista de candidatas é o perfil mais barato que resolve. Não há `complexo`. O gateway não desce para modelo menor, porque a tarefa entra em `TAREFAS_SEM_MODELO_MENOR`.

Custo estimado por professor/mês: não há custo por professor. O custo é por escola, no onboarding do material, e não entra no pacote do Tutor (D38). A Tech Spec §8 estima cerca de 625 chamadas por onboarding, entre R$ 4 e R$ 20 por escola. Cada chamada leva até 12 seções e leva cerca de 12 mil tokens de entrada no recorte comum. A estimativa está anexada na spec. Para o relatório, ela se converte em R$ por escola/mês quando a 5.0 definir o limite de execuções por noite.

Prompt versionado: sim. O prompt está em `packages/core/src/ia/prompts/classificar-secoes.ts` (3.0), com `PROMPT_CLASSIFICAR_SECOES.versao`. O consumo registra só os ids das seções e a versão, por `entradaParaORegistro`. O teste de caminho feliz prova que o título e o texto não entram no registro.

Validação de schema: sim. A entrada e a saída têm schema estrito. A saída só aceita códigos da lista de candidatas, sem seção omitida, repetida ou inventada. A saída inválida (`IA_SAIDA_INVALIDA`) termina `falhou` e soma `falhas_seguidas` na mesma transação. A entrega dupla soma uma vez só.

Aprovação humana no caminho: não se aplica. A saída é metadado do material (habilidade da seção) e não chega ao aluno, não vira nota nem decisão. A coordenação pode corrigir (`origem: 'coordenacao'`, RF6). A conferência humana foi tratada na 3.0 (AIA de diagnóstico por habilidade).

Verifiquei, no diff e nos testes:
- **SDK:** nenhum SDK de provedor foi tocado. Tudo passa pelo `LLMGateway` e pelo adaptador.
- **Orçamento e soberania:** a D62 e o orçamento continuam sendo consultados antes do envio e da reserva de vaga.
- **Teste sem provedor pago:** os testes usam a bancada `FilaDeIa` com adaptador falso e `comModelo`, e o dublê lança `LLMError`. Nenhum chama provedor pago.
- **Rodada em fila:** a execução roda no `main-worker`, na fila `lote`, com job `ia.executar-lote` (uma tentativa, prazo de 150 s, não urgente).
- **Conferências antes do `rodando`:**
  - A janela letiva adia com `JobAdiadoError('janela')`, sem modelo e sem transição.
  - A função suspensa falha a `pendente` com `FUNCAO_SUSPENSA`, sem modelo e sem consumo.
- **Idempotência:** a entrega dupla acha a execução já terminada, e o teste prova uma chamada, um consumo e uma gravação.
- **Worker morto:** a varredura inclui a `lote` e casa o par tipo e fila.
- **Sem pessoa:** `quemPediu` ausente só passa no comando `daRotina`. Nos outros comandos continua `NAO_ENCONTRADO`, sem modelo e sem consumo.
- **Soberania:** a soberania é definitiva e não é adiada.
- **Registro de consumo:** a tentativa que não saiu (balde cheio, disjuntor) não deixa linha de consumo. A que saiu e falhou deixa.
- **Mutações:** o documento declara 109 mutações.

Bloqueantes: nenhum

Recomendações:
1. `apps/api/src/ia/execucao.processor.ts`, `#adiarOLote` e `adiavelNoLote`: o adiamento por provedor fora não tem teto de tentativas nem de idade. É o que a Tech Spec §5 manda (adiar sem gastar tentativa), então não bloqueia. Com provedor fora de forma permanente e a escola fora da janela, a execução volta a `pendente` a cada cerca de 30 s mais jitter, e cada passagem que sai e falha deixa linha de consumo. Sugiro limitar por idade da `pendente` (por exemplo 24 h) ou por número de adiamentos, terminando `falhou IA_INDISPONIVEL`. Essa regra cabe na 5.0 ou na 7.0, junto do limite de execuções por noite por escola. A regra 30, item 10, pede que o agente saiba parar.
2. Teto de custo por escola: a Tech Spec §7c declara que não há teto de custo por escola na classificação. O limitador é o balde `lote` (5% do contratado), a vaga por escola e, na 5.0, o limite de execuções por noite. Mantenha isso explícito na 5.0 e no runbook. Sem esse limite, o balde por provedor é o único freio.
3. Arquivo vazio `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0` na raiz, não rastreado (provável redirecionamento de shell por engano). Apague antes de `git add -A` para não entrar no commit.
4. A divergência "vaga `lote` por escola é 2, não 1" está registrada na tabela de divergências, mas o item de `docs/infra.md` merece uma linha dizendo que a vaga é dividida com expurgo e eliminação. O diff de `docs/infra.md` já cobre isso, então é só conferir na validação.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 20:38:45 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não toca `Nota`. A busca no diff por `nota`, `lancadaPor`, aprovação, reprovação, encaminhamento, emoção e ranking não achou nada. Só três coisas são gravadas: `habilidade_da_secao` (`origem: 'ia'`), o estado da `secao_do_material` e um `resultado` de execução `{ tipo: 'classificacao_do_material', secoes: <n> }`, que guarda apenas a contagem. Todos com autor humano? Não se aplica, porque não há escrita em Nota.

Decisão autônoma sobre aluno: ausente. A classificação é do material, não do aluno. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/time/funcoes.ts:65` a declaração diz que "nada chega ao aluno pela classificação": a habilidade só passa a valer na atividade que o professor confere e aplica. Os códigos que o modelo devolve precisam estar entre as candidatas da tabela pública da BNCC (`packages/core/src/ia/tasks/classificar-secoes.ts`, `problemasDaClassificacao`). O que estiver fora vira `IA_SAIDA_INVALIDA` e não é gravado.

Aprovação registrada: ok. Esta função é "faz e registra; a coordenação corrige, e a correção vence". Ela não entrega nada ao aluno, então o item 3 da regra 70 não pede aprovação. A exceção D47 não foi estendida a ela. A correção humana vence, e o código prova isso:
- o `update` de `gravarClassificacao` filtra por `corrigida_em is null` e `execucao_id = :esta` (`apps/api/src/material/secoes.repository.ts`);
- a troca apaga só as habilidades `origem: 'ia'`;
- `classificacao.int.test.ts` testa cada ponto com mutação: "P1a", "a gravação troca só as habilidades `ia`…" e "`limparDaExecucao` … só as habilidades `ia`".

Supervisão do tutor: ok. A tarefa não mexe no Tutor. O teste "o pacote do Tutor não muda" prova que a classificação não consome o pacote dele.

Autonomia declarada e visível: sim. A função `classificacao_do_material` tem autonomia 1 e alto risco, e foi declarada na 3.0 (`packages/shared/src/time/funcoes.ts:59-66`). Também está em `docs/agentes.md:79` e em "Como cada IA trabalha", com o texto em português comum. A suspensão é conferida antes de `rodando` (`execucao.processor.ts`, `#antesDeRodarOLote`) e testada em "a função suspensa › antes de `rodando`…".

Auditoria: responde. O que a IA gerou fica em `habilidade_da_secao` (`origem: 'ia'`), ligado a `secao_do_material.execucao_id` e `classificada_em`. O `consumo_ia` registra a função, a saída (os códigos), os ids das seções e a versão do prompt, sem pessoa nem texto (`entradaParaORegistro`). O teste "caminho feliz" lê isso do banco. Quem corrigiu e quando vem do `corrigida_em` da coordenação, que é escopo de outra tarefa.

Supervisão não é vigilância: ok. Não há inferência sobre pessoa. O log e a métrica levam só ids, tarefa, código e a espera por escola, e o teste "log e métrica" confirma.

D46/D55 (discursiva e redação): não se aplica. Não há campo, prompt nem tela com nota.

D45 (medir o professor): não se aplica. Nenhuma métrica de professor e nenhuma leitura de conversa do chat.

Bloqueantes: nenhum.

Recomendações:
1. O processador agora roda sem `quemPediu` quando o comando declara `daRotina` (`apps/api/src/ia/execucao.processor.ts:236`). Hoje só `ClassificarSecoesCommand` declara isso (`apps/api/src/material/classificar-secoes.command.ts:36`). Vale um teste em `apps/api/src/ia/registro-de-comandos.test.ts` que fixe essa lista em `['classificar_secoes']`. Assim, um comando novo que produza entrega, devolutiva ou algo ligado a nota não passa a rodar sem autor sem que isso seja discutido.
2. Há um arquivo vazio e não rastreado chamado `0` na raiz do worktree (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0`), que parece ter vindo de um redirecionamento do shell. Convém apagá-lo antes do commit.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 20:39:04 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | IA | migration
Rate limit: ok (não há endpoint novo. O agendador da API recusa a tarefa do lote, e `classificacao.int.test.ts` › "o agendador da API recusa a tarefa do lote" prova isso.)
Fila e prioridade: ok. O job `ia.executar-lote` vai na fila `lote` com `naoUrgente: true` e executor `api`, e o pool tem 1 job por réplica. O limite por escola vem de `VAGAS_ESCOLA_LOTE`, provado pelo teste "três da A e uma da B". O processador confere a janela letiva da escola antes de passar a `rodando`. O balde do `lote` fica em 5% do contratado, à parte do balde do Tutor.
Concorrência: protegida. `falharPendente` e `voltarAPendente` só gravam se o estado ainda é o esperado. A falha e as `falhas_seguidas` vão na mesma transação, só para quem mudou o estado. O `concluir` relê o material com `for share` e grava a seção só se `execucao_id` e `corrigida_em` continuam valendo. A entrega dupla, P1a, P4, P4b e P9 têm teste e mutação cada.
Índice e paginação: ok. As consultas usam `secao_do_material_execucao_idx (escola_id, execucao_id)`, `trecho_pagina_do_material_unica (escola_id, material_id, pagina)` e a PK de `material_serie`, que começa pela escola. A leitura das seções tem `limit(SECOES_POR_EXECUCAO=12)`. `habilidade_bncc` é tabela pública e pequena.
Degradação de IA: ok. O lote não desce para o modelo menor (está em `TAREFAS_SEM_MODELO_MENOR`). Com balde cheio, disjuntor aberto ou provedor fora, a execução volta a `pendente` e o job é adiado sem gastar tentativa. A recusa de soberania falha de vez. O prazo único estourado vira `IA_TEMPO_ESGOTADO`. Nada chega ao aluno.
Migration: compatível. A `0063` só acrescenta um tipo ao check de `resultado`, com `lock_timeout` de 5 s. O código anterior nunca grava esse tipo.
Métrica e alerta: ok. Há o histograma `material.classificacao.espera` por escola, com painel em `fundacao.json`. Não há alerta novo.
Bloqueantes: nenhum

Recomendações:
- Na raiz há um arquivo vazio não rastreado chamado `0` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0`), provavelmente sobra de um redirecionamento do shell. Precisa ser apagado antes do commit, senão entra com `git add -A`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0063_resultado_da_classificacao.sql:10-12`: o `VALIDATE` roda na mesma transação do `DROP` e do `ADD`. Com isso, `execucao_agente` fica sob `ACCESS EXCLUSIVE` durante toda a varredura, e essa tabela ganha uma linha a cada turno do Tutor. Hoje é aceitável, porque não há volume e segue o precedente da 0058 e da 0062. Antes do piloto, essas migrations precisam separar o `VALIDATE` em migration própria. Convém registrar isso no `TODO.md` para não depender de alguém lembrar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.processor.ts`: falta sinal para o lote que nunca termina, e o caso real é o provedor fora a noite toda. `material.classificacao.espera` só registra quando uma seção é gravada. Se o provedor ficar fora a noite inteira, o job é adiado a cada 30 s e nada aparece. Para o operador saber de manhã que a fila não andou, vale um contador `ia.execucao.adiada` por motivo (`janela`/`provedor`) e escola, ou um alerta de idade da execução `pendente` do `lote`, com o parágrafo no runbook.
- Quando o provedor falha depois de a chamada sair (sem `motivo`), cada nova tentativa grava uma linha `falhou` em `consumo_ia`. O disjuntor limita isso, mas o `llm-integrator` deveria confirmar que essas linhas não somam ao orçamento da escola (D14).

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-17 20:39:54 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 "Classificação". A execução que junta seções de materiais com recortes diferentes manda ao modelo a união das candidatas e grava em cada seção qualquer código dessa união. A Tech Spec não diz isso.
Portão local: carimbo válido

Bloqueantes:

1. **Uma seção pode receber habilidade de outro recorte.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts:60` e `:65-79`, com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:243-262`.
   - O que está errado: o `preparar` junta as candidatas de todos os materiais da execução numa lista só. O `concluir` grava o código em cada seção sem conferir se ele pertence ao componente e às séries do material dela. Assim, uma seção de material do 8º ano pode ganhar código do Médio, ou de outro componente, sem `IA_SAIDA_INVALIDA`.
   - O próprio teste prova isso como se fosse correto. Em `classificacao.int.test.ts:385-412` ("dois recortes na mesma execução"), a seção do material do Fundamental (`EF08CI`) recebe `EM13CNT101` e o resultado conta 4 seções gravadas.
   - Isso viola o `cenarios.md` ("Sonda de saída… do EM em seção do EF… `IA_SAIDA_INVALIDA` sem gravar") e a Tech Spec §3 (l. 43-45), onde a união vale só para as séries do mesmo material.
   - Há um segundo problema: o `.slice(0, CANDIDATAS_MAXIMAS)` aplicado sobre a união corta candidatas em silêncio quando dois recortes passam de 300. O maior recorte sozinho já tem 267, e o corte por ordem de código derruba primeiro as do Médio. A seção fica sem as candidatas certas e o modelo só pode escolher entre as erradas.
   - Correção exigida:
     - Cada código só pode ser gravado se for candidato do recorte do material daquela seção, aplicando `habilidadeEhCandidata` por seção na validação ou no `concluir`. Fora disso, `IA_SAIDA_INVALIDA`, como o cenário c1 pede.
     - A união não pode ser cortada em silêncio: a execução recusa ou falha de forma tipada.
     - A decisão sobre execução com mais de um recorte, inclusive se a 5.0 deve agrupar por recorte, entra na `techspec.md` §5 e no `cenarios.md`. Se a mudança for de desenho, pare e reporte ao Arquiteto.
     - O teste da linha 385 passa a provar que o código do Médio não chega à seção do Fundamental, com a mutação correspondente.

2. **Arquivo vazio `0` na raiz.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/0`, sem rastreio no git, criado às 20:06.
   - O que está errado: é sobra de algum redirecionamento de shell e está na lista de alterados da tarefa. Entraria no commit de um repositório público.
   - Correção exigida: apagar o arquivo antes do commit.

Recomendações:
- **Varredura que casa tipo e fila.** A tabela de divergências diz que isso está na `techspec.md` §7c ("Fila"), mas a §7c não mudou. Não é divergência de fato: a spec já dizia "a varredura inclui a `lote`". Escreva na §7c ou tire a linha da tabela.
- **Constante duplicada.** `ESPERA_DO_PROVEDOR_FORA_MS = 30_000` (`execucao.processor.ts:56`) repete `MEIO_ABRE_O_DISJUNTOR_EM_MS` (`resilient-adapter.ts:26`). Exporte a do core em vez de copiar o número.
- **Janela às 10h05, não às 7h05.** O `cenarios.md` e a tarefa pedem o job que volta às 7h05, e o teste da janela usa 10h05 (`classificacao.int.test.ts:502`). Fica para o `test-engineer`; registro aqui só para a validação.
- **`falhas_seguidas` em 3 seções, não em 12.** A tabela da tarefa diz "inválida soma nas 12" e o teste usa 3 seções (`:596`). O texto da tarefa ou o caso deve ser alinhado.
- **Leitura em laço no `preparar`.** `classificar-secoes.command.ts:56-59` lê as páginas de cada seção numa consulta própria, uma por seção, até 12. Numa noite de onboarding valeria uma consulta só por execução; quem confirma é a medida da 5.0.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 20:42:32 · `tasks/prd-classificacao-bncc/4_task.md`

**VEREDITO: REPROVADO**

Rodei `classificacao.int.test.ts` uma vez: 52 de 52 verdes. Depois rodei sozinho o caso do log, com `-t`, e ele ficou vermelho. Não alterei nenhum arquivo.

**Cenários exigidos** (os da tabela da 4.0 e os de "Classificação no worker" do `cenarios.md`): caminho feliz e consumo; pacote do Tutor; `quemPediu` com e sem `daRotina`; worker real na `lote`; três da A e uma da B; os quatro casos do `preparar`; função suspensa; degradação (balde, disjuntor, modelo menor, provedor depois da chamada, Tutor da B, soberania); janela (7h05, janela da escola, `pendente` às 10h); worker morto; os quatro de `falhas_seguidas`; as duas entregas duplas [P]; P1a, P9, P4 e P4b [P]; isolamento A×B; log e métrica sem título, texto nem código.

**Cobertos com teste que prova:**
- O caminho feliz, o consumo só com ids e versão, e o `quemPediu`.
- A vaga por escola, com quatro jobs simultâneos no worker real.
- Os quatro casos do `preparar` (corrigidas, de outra execução, excluído, não `pronto`), a função suspensa, o balde, o disjuntor e a soberania.
- A janela às 10h05, a janela própria da escola e o caso das 19h05.
- `falhas_seguidas`: inválida soma, sucesso zera, interrompida e suspensa não somam.
- P1a, P9 e P4 com a mudança feita dentro do modelo falso, que é uma ordem forçada legítima. P4b com outra conexão e `lock_timeout`, que é concorrência de verdade.
- Isolamento nos testes de 884 a 926.
- Métrica só com `escola_id`.
- Na camada de baixo: modelo menor, `semEnvio`, consumo do provedor depois da chamada e o balde `lote` (`llm-gateway.test.ts`, `token-limiter.test.ts`, `resilient-adapter.test.ts`).
- Nenhum `.skip`. Nenhum provedor real: só `ScriptedAdapter` e o modelo falso da bancada.

**Bloqueantes:**

1. **As duas linhas [P] de entrega dupla são sequenciais, e nenhuma é paralela.**
   - Onde: `classificacao.int.test.ts:580` ("o job entregue duas vezes: uma chamada…") e `:625` ("…soma uma falha só"). Os dois chamam `await rodar(...)` e só depois `await rodar(...)` de novo.
   - Por que bloqueia: no `cenarios.md:4`, P quer dizer "chamadas em paralelo, com a ordem forçada". O caso sequencial só prova que a segunda entrega acha a execução já terminada.
   - O que o paralelo mostraria: pela semântica herdada da 6.0 (`execucao-interrompida.int.test.ts:339-392`), a segunda entrega que acha `rodando` encerra a execução com `EXECUCAO_INTERROMPIDA` e desfaz o `concluir` da primeira. Em paralelo, o resultado seria **nenhuma gravação** e duas linhas de consumo (a da chamada e a estimada). Não seria "uma chamada, um consumo, uma gravação", como o `cenarios.md:108` promete.
   - O caminho `daRotina` (`#antesDeRodarOLote`, depois `#comecar`) não tem nenhum teste com duas entregas ao mesmo tempo.
   - Correção exigida:
     - Escrever os dois casos com `Promise.all` de dois `entregarDeNovo`, com a ordem forçada (`WriteBlockTrigger` ou `esperarNaTrava`, como em `execucao-interrompida.int.test.ts:371`).
     - Afirmar o que de fato acontece com a classificação: chamadas ao modelo, linhas em `consumo_ia`, seções gravadas e `falhas_seguidas`.
     - Ajustar o `cenarios.md` e a Tech Spec ao resultado. Se o desejado for de fato "uma gravação", o código precisa mudar.

2. **O teste do log não verifica que o código fica fora do log, e só passa por depender da ordem dos testes.**
   - Onde: `classificacao.int.test.ts:944-948`.
   - O nome do teste e a tabela pedem "sem título, texto nem código", mas a lista de proibidos é só `['sigiloso', textoDaHabilidade…]`. O `CODIGO_DE_CNT` (`EM13CNT101`) nunca é conferido.
   - O teste não cria execução própria: lê o log que os casos anteriores deixaram. Rodado sozinho (`-t "o log da execução leva ids"`), ele falha em `expect(texto).toContain('ia.execucao')`. Conferi agora.
   - Correção exigida: rodar uma execução dentro do próprio teste e incluir `CODIGO_DE_CNT` e o título do material (`'Apostila de teste'`) na lista de proibidos.

3. **O teste do "pacote do Tutor não muda" não lê o pacote.**
   - Onde: `classificacao.int.test.ts:179-187`. Ele conta `consumo_ia` com `funcao = 'tutor_com_o_aluno'`.
   - O pacote, porém, sai de `mensagem_tutor`, em `OrcamentoRepository.consultar` (`apps/api/src/ia/orcamento.repository.ts:41-63`). A mutação que a tabela pede ("somar ao pacote") não deixaria esse teste vermelho.
   - Do jeito que está, ele repete a asserção `funcao: 'classificacao_do_material'` que o caminho feliz já faz.
   - Correção exigida: configurar a escola A com `tutor_trocas_por_mes` baixo e um aluno da turma com o pacote em limite−1. Consultar `OrcamentoRepository.consultar({ funcao: 'tutor_com_o_aluno', alunoId, turmaId })` antes e depois da classificação e afirmar que continua `permitido: true`. Contar também `mensagem_tutor` da turma antes e depois.

**Recomendações (não bloqueiam):**
- **Janela às 7h05.** A tabela pede 7h05 e o teste usa 10h05 (`:502`). A regra está provada, mas o instante logo depois da abertura, que é o caso do job adiado pelo provedor que volta cedo, não está.
- **`pendente` às 10h** (`:530`): a varredura roda com o relógio fixado em 19h05 e um job recém-enfileirado. Vale fazer o caso com o job já adiado pela janela.
- **Saída inválida "soma nas 12"** (`:596`): o teste usa 3 seções. Vale semear 12.
- **Worker morto** (`:642`): `iniciada_em` de 20 minutos não prende o limite de 300 s. Use 301 s. Falta também a reentrega de uma classificação já `rodando` pelo caminho `daRotina`.
- **Provedor fora depois da chamada** (`:460`): o `cenarios.md` diz "com o `consumo_ia` da chamada". Vale afirmar `consumosDa(...) === 1` também na integração.
- **Nome que promete demais** em `llm-gateway.test.ts`, no caso "…e o Tutor da outra fila segue o caminho dele": nada é afirmado sobre o Tutor. Tirar do nome ou afirmar.
- **"A janela é só do lote"** (`:546`): o caso termina em `NAO_ENCONTRADO` por falta de pessoa. Vale usar uma execução com pessoa que chegue a `concluida`.
- **P4 "edição nova"** está simulado com `estado = 'falhou'` (`:691`), e não pelo fluxo de edição nova.
- **Caso de borda sem teste, que pode ser defeito:** uma execução que mistura a seção de um material com série e a de um material sem série. Hoje a segunda vai ao modelo com as candidatas do outro recorte (`classificar-secoes.command.ts:69-77`). Vale um caso e a opinião do `llm-integrator`.
- **`:206`** lê `VAGAS_ESCOLA_LOTE` de `process.env` com 2 como padrão. Vale tirar o valor da mesma fonte que a bancada usa.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/orcamento.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao-interrompida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-17 21:46:22 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada (a migração 0063 já tinha sido aprovada na 1ª rodada e não mudou). Também conferidas, pelo que o diff toca: `secao_do_material`, `habilidade_da_secao`, `execucao_agente`, `consumo_ia`, `configuracao_operacional_escola` e `mensagem_tutor` (as duas últimas só nos testes).

Queries verificadas:
- `SecoesRepository.limparDaExecucao` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:174`): o novo filtro opcional `soAsSecoes` só soma ao filtro que já existia. O `escolaId` continua vindo de `requireEscolaId()`, não de parâmetro, no select, no delete e no update.
- `ClassificarSecoesCommand.preparar` e `concluir` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts`): o recorte de cada seção sai de `vivasDaExecucao` e de `recorteDosMateriais`, que já filtram pela escola do contexto. Se o modelo devolver uma seção que não está no recorte lido, inclusive seção de outra escola, o `concluir` recusa com `IA_SAIDA_INVALIDA` antes de gravar. Isso deixa o isolamento mais rígido que antes.
- `repositorio.candidatas` lê só a BNCC, que é tabela pública e fica fora da regra.
- `habilidadeEhCandidata` é função pura, sem acesso ao banco.
- `execucao.processor.ts` e `resilient-adapter.ts`: só trocam a constante de espera (`MEIO_ABRE_O_DISJUNTOR_EM_MS`). Nenhuma query muda.

Teste de isolamento: presente e efetivo. O bloco "isolamento entre escolas" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts:1081` não mudou desde a rodada aprovada. Ele tem os quatro casos: ler, gravar e somar na execução da B; seção da B na resposta; job da A com o `execucaoId` da B; e FK composta. Os testes novos que usam a escola B (vaga `lote` por escola, e a `pendente` diante da varredura) usam o contexto da própria B e não abrem caminho entre as escolas.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts:256`: o nome do teste tem um erro de digitação ("nada gravadoe uma falha").
- Agora o `concluir` recusa a execução inteira quando chega uma seção fora do recorte lido. Falta um teste do comando, pelo worker, que prove essa recusa com a seção da B na resposta do modelo: nada gravado na A e nada tocado na B. Hoje isso só está provado no repository.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-17 21:46:39 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Esta rodada auditou o diff `e8ea1ce3..24faf47f`, sem `achados/`. Como na 1ª rodada não houve bloqueante, não havia correção a conferir.

Campos pessoais tocados: nenhum. As mudanças tratam do recorte da seção (componente e séries do material), da validação dos códigos da BNCC no `concluir` e do novo filtro `soAsSecoes` em `limparDaExecucao`. Tudo isso é conteúdo de material da escola e da tabela pública da BNCC. Nada é dado de aluno, professor ou responsável.

Fora da tabela de dados do docs/lgpd.md: nada. O diff não cria migration nem campo novo.

Autorização por objeto: ok. Este diff não abre rota. `limparDaExecucao(execucaoId, soAsSecoes?)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:172-179` continua filtrando por `escolaId` (vindo de `requireEscolaId()`), `execucaoId` e `corrigidaEm`. O `inArray` só estreita o resultado, e quem chama só passa a lista quando ela não está vazia.

Logs: limpos. O diff não acrescenta log. O de `ia.execucao.adiada_pelo_provedor` em `execucao.processor.ts` mudou só a constante da espera e continua levando apenas ids, tipo, código e espera. O teste ainda confere que nem o título do material, nem o código, nem o texto da habilidade aparecem no que foi gravado (`classificacao.int.test.ts`, linha nova 281 do diff).

Auditoria: presente onde a regra exige. A classificação não é leitura de dado de aluno, não é exportação, não altera nota nem permissão, e não é saída de IA que chega ao aluno. O diff não traz nenhuma ação que exija auditoria. Há uma trava nova a favor, em `registro-de-comandos.test.ts`: só `classificar_secoes` pode declarar `daRotina`, ou seja, rodar sem pessoa. Um comando novo sem autor humano reprova nesse teste até alguém discutir o caso.

Envio externo: menos do que antes. A seção sem recorte deixou de ir ao modelo (`classificar-secoes.command.ts`, o laço do `preparar` filtra por `recorteDaSecao`). O conteúdo enviado continua sendo título, começo e subtítulos de material licenciado, mais códigos da BNCC, pelo gateway e com registro em `ExecucaoAgente`/`consumo_ia`. Com mais de 300 candidatas, o gateway recusa a entrada (`IA_ENTRADA_INVALIDA`) sem chamar o modelo.

Seed/fixture: sintético. Os testes usam material "Apostila de teste", texto "texto de <titulo>" e ids `randomUUID()`.

Bloqueantes: nenhum.

Recomendações:
- O quadro de destino em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/4_task.md` manda minha recomendação da 1ª rodada para o `TODO.md`: registrar em `docs/lgpd.md`, na linha de `consumo_ia`, que `classificar_secoes` guarda só ids e versão do prompt (`entradaParaORegistro`). Mas o `TODO.md` não mudou nesta tarefa, e a entrada parecida que existe (linha 1239, da 3.0) é de antes. A recomendação precisa de uma entrada própria no `TODO.md`, ou o `docs/lgpd.md` precisa ser atualizado direto, para não se perder.
- Pergunta de fechamento: o diff não muda nada do que responde "o que o sistema guarda sobre o aluno e para onde foi". A classificação não tem titular aluno, e o envio dela fica registrado por execução.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-17 21:46:56 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Auditei só o diff desde a rodada aprovada e o que ele afeta. A rodada anterior não exigiu correção, então não havia nada a conferir nesse sentido.

Perfis usados: `rapido`, em `packages/core/src/ia/tasks/classificar-secoes.ts:110`. É o perfil mais barato e é o que a regra 30 prevê para classificar. Continua só na fila `lote`.

Custo estimado por professor/mês: a tarefa não traz um número por professor. A classificação é de material, não de uso do professor. Vai uma execução por lote de até `SECOES_POR_EXECUCAO` seções, e só quando o material muda. Em material estável o custo é zero, porque a execução sem seção viva ou sem candidata conclui sem modelo e sem consumo. O custo é cobrado da escola, não do professor, e entra no orçamento do `lote`, sem tocar o pacote do Tutor (há teste para isso). O estimador do gateway já registra o consumo por execução. Isso fica como recomendação, abaixo.

Prompt versionado: sim, no arquivo da tarefa. Este diff não o altera.

Validação de schema: sim, e ficou mais forte neste diff. Em `apps/api/src/material/classificar-secoes.command.ts` (`concluir`), cada código devolvido pelo modelo só é gravado se for candidato do recorte da própria seção (`habilidadeEhCandidata`). Se não for, o comando lança `LLMError('IA_SAIDA_INVALIDA')` dentro da transação.

- O processador trata esse erro como falha definitiva.
- A gravação é desfeita, a execução vai a `falhou` e as `falhas_seguidas` somam 1 em cada seção.
- O teste `o código do Médio numa seção do Fundamental` (`apps/api/src/material/classificacao.int.test.ts:463`) prova isso: apagada a checagem, ele falha.

Aprovação humana no caminho: não se aplica. A classificação grava `origem: 'ia'` e `classificada_em` na seção do material, e a coordenação pode corrigir (`corrigida_em`). Não é nota, nem mensagem à família, nem decisão sobre aluno, e não envolve texto de aluno. A execução da rotina sem pessoa continua restrita a um único comando: o teste novo em `apps/api/src/ia/registro-de-comandos.test.ts` reprova se outro comando declarar `daRotina`.

Bloqueantes: nenhum.

O restante do diff não mexe em regra:

- `MEIO_ABRE_O_DISJUNTOR_EM_MS` passou a ser exportado e usado no processador, no lugar da constante duplicada de 30 s.
- A seção sem recorte volta a `nao_agendada` por `limparDaExecucao(execucaoId, soAsSecoes)`, que mantém `escolaId` no escopo.
- Os testes usam o adaptador falso, ou o gateway real sem provedor; nenhum chama provedor pago.

Recomendações:
1. Anexar ao relatório a estimativa de custo da classificação: tokens por seção, seções por material e materiais por escola por mês, no perfil `rapido`. Hoje ela está só implícita no medidor.
2. Tirar o corte de 300 candidatas faz uma execução com recortes demais falhar de vez em `IA_ENTRADA_INVALIDA`. O custo é zero e as `falhas_seguidas` ficam em 0, mas as seções ficam presas à execução falhada.
   - Confirmar que a 5.0 agrupa por recorte e que o reagendamento não gira em laço sobre a mesma execução.
   - O alerta e o parágrafo no runbook para esse código seriam úteis.
3. Em `apps/api/src/material/classificacao.int.test.ts:463`, o nome do teste tem "gravadoe" (faltou espaço antes do "e").
4. Em `packages/core/src/ia/llm-gateway.test.ts`, o teste `a classificação não desce a modelo menor` perdeu a parte "o Tutor da outra fila segue o caminho dele" no título. Confirmar que esse caso continua coberto em outro teste.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-17 21:47:09 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Esta rodada audita só o diff `e8ea1ce3..24faf47f`. A rodada anterior não pediu correção.

- **Fila e prioridade:** o job do lote continua na fila `lote`, sem passar pela interativa. Quando o provedor recusa, a execução volta a `pendente` e o job é adiado. Se o provedor não diz quando voltar, a espera agora vem de `MEIO_ABRE_O_DISJUNTOR_EM_MS`, exportado do disjuntor, em vez de um 30 s copiado à mão.
- **Concorrência:** o código inválido para o recorte da seção lança `IA_SAIDA_INVALIDA` dentro de `concluir`. Isso acontece na transação do gravador, então nada fica gravado, e a falha passa por `#aoFalhar` → `marcarFalhou` → `somarFalha` só se a execução passou a `falhou` agora. Há teste com duas entregas ao mesmo tempo e ordem forçada, para a saída válida e para a inválida, e teste de reentrega depois de concluir e depois de falhar.
- **Seções sem série ou sem componente:** a limpeza delas (`limparDaExecucao` com `soAsSecoes`) roda na mesma transação de `concluir`. O `update` repete a condição de `execucao_id` e de `corrigida_em is null`, então uma seção corrigida pelo professor não é tocada.
- **Nenhum teste chama provedor pago:** o caso de mais de 300 candidatas usa o gateway real com o adaptador falso da fixture. A recusa vem da validação da entrada, antes do balde, e o teste confirma consumo zero.
- **Guarda nova:** um novo teste em `registro-de-comandos.test.ts` reprova se outro comando, além de `classificar_secoes`, declarar `daRotina` (rodar sem pessoa e sem ano).

Recomendações:
- `apps/api/src/material/classificar-secoes.command.ts:79`: quando as candidatas passam de 300, a execução fica `falhou` com `IA_ENTRADA_INVALIDA`, as seções continuam apontando para ela e `falhas_seguidas` fica em 0. A 5.0 precisa fazer duas coisas:
  - reagendar essas seções, sem prendê-las a uma execução que falhou;
  - provar com teste que nenhum recorte sozinho passa de 300 candidatas. Hoje o maior é LP do 6º ao 9º com o Médio, ~267.
  
  Sem isso, uma seção pode refalhar toda noite sem que ninguém veja. Não chama o modelo e não custa nada, mas ninguém fica sabendo.
- `apps/api/src/material/classificacao.int.test.ts:463`: erro de digitação no título do teste, "gravadoe".

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/registro-de-comandos.test.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-17 21:47:18 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada não grava em `Nota`. Ele mexe em `habilidade_da_secao` (a habilidade da BNCC que a IA dá à seção do material, `origem: 'ia'`), em `secao_do_material` e em `execucao_agente`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A classificação dá habilidades da BNCC às seções do material. Não toca em aluno, turma, aprovação, reprovação nem encaminhamento.

Aprovação registrada: ok. Esta rodada não cria saída de IA nova que chegue ao aluno. A garantia de que nada chega ao aluno sem o professor conferir a habilidade continua prevista para a tarefa 11.0, como já ficou registrado na 3.0 e na 1ª rodada. A correção humana continua mandando: o novo `limparDaExecucao(execucaoId, soAsSecoes?)` mantém o filtro `isNull(corrigidaEm)` e apaga só a habilidade de `origem: 'ia'` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`). O que o professor corrigiu fica intocado, e há mutação registrada que prova isso.

Supervisão do tutor: ok. O Tutor não foi tocado. O teste do pacote do Tutor ficou mais forte: a turma fica a uma troca de esgotar o pacote, e o teste confirma que a consulta ao pacote continua `permitido: true` antes e depois da classificação e que a contagem de `mensagem_tutor` não muda. A classificação não consome o pacote da turma.

Autonomia declarada e visível: sim, sem mudança nesta rodada. Este diff traz um ganho: o teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/registro-de-comandos.test.ts` exige que `classificar_secoes` seja o único comando com `daRotina`, ou seja, o único que roda sem pessoa. Um agente novo que tente rodar sem autor humano reprova ali até alguém discutir o caso. Conferi no código: `daRotina = true` só aparece em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts:47`, e o processador recusa a execução sem quem pediu quando o comando não é `daRotina` (`execucao.processor.ts:234`).

Correções exigidas da rodada anterior: nenhuma, porque a 1ª rodada foi aprovada só com recomendações.

O que esta rodada muda e como fica na regra 70:
- **Código de habilidade conferido por seção** (`classificar-secoes.command.ts`, no `concluir`). Antes, uma seção do 8º ano podia receber um código do Médio. Agora cada código é conferido contra o recorte da própria seção (o componente da disciplina e as séries do material) e, se não servir, a execução falha com `IA_SAIDA_INVALIDA` sem gravar nada. Isso evita que habilidade errada vire metadado pedagógico sem ninguém ver.
- **A lista de candidatas não é mais cortada em 300.** Quando passa de 300, o gateway recusa a entrada (`IA_ENTRADA_INVALIDA`), não chama o modelo e não mexe nas seções.
- **Seção sem recorte não vai ao modelo** e volta a `nao_agendada`.
- **Duas entregas ao mesmo tempo:** a segunda encerra a execução `EXECUCAO_INTERROMPIDA` e a gravação da primeira se desfaz. Nada que a IA produziu fica gravado pela metade.
- O teste do Assistente na janela letiva usa um comando de teste com sessão de professor e não muda nada em produção.

Nenhum desses pontos fere os itens 1 a 9 da regra 70. Não há inferência emocional, sinal sobre o aluno, nota em discursiva ou redação, nem métrica de professor. O log da execução só leva ids, e o teste agora também proíbe o título do material e o código escolhido.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts:259` (linha no diff da rodada): o nome do teste tem o erro de digitação "nada gravadoe uma falha". Corrigir para "nada gravado e uma falha".
- Continua valendo a recomendação anterior: a tarefa 11.0 precisa provar que habilidade com `origem: 'ia'` não chega ao aluno, nem orienta o Tutor, sem o professor conferir.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 21:48:05 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A decisão sobre execução com mais de um recorte está na `techspec.md` §5 ("A execução é de um recorte"), no `cenarios.md` ("Execução com mais de um recorte") e na tabela de divergências do `4_task.md`. O mesmo vale para as duas entregas ao mesmo tempo (§5 e `cenarios.md`).
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)"). Os arquivos de produção e o teste da árvore atual são iguais aos de `24faf47`. Depois dessa revisão, o `4_task.md` só ganhou a tabela de revisões que o hook preenche.
Bloqueantes: nenhum

Conferência das correções exigidas na 1ª rodada:
1. Feita.
   - (a) O `concluir` (`apps/api/src/material/classificar-secoes.command.ts:104-107`) passa cada código por `habilidadeEhCandidata` com o recorte da própria seção e lança `IA_SAIDA_INVALIDA` dentro da transação do gravador. Pelo `execucao.processor.ts`, isso cai em `#aoFalhar`, não é adiado (`adiavelNoLote` só adia `IA_INDISPONIVEL`), marca `falhou` e soma `falhas_seguidas` por `aoFalharDefinitivo`. O `candidatas` do repository filtra com a mesma `habilidadeEhCandidata`, então uma saída válida não é recusada por divergência entre a lista de candidatas e a validação.
   - (b) O `.slice` saiu. Acima de 300 candidatas, o schema da tarefa (`CANDIDATAS_MAXIMAS`) faz o gateway real recusar com `IA_ENTRADA_INVALIDA`, sem consumo e sem somar falha. O teste da união com mais de 300 prova isso, e a mutação reintroduz o corte.
   - (c) A decisão está na Tech Spec §5 e no `cenarios.md`. Não muda contrato nem tabela, então não precisava ir ao Arquiteto.
   - (d) `classificacao.int.test.ts:463` ("o código do Médio numa seção do Fundamental") termina em `falhou IA_SAIDA_INVALIDA`, sem gravar nada e com uma falha somada em cada seção. As duas mutações da linha 106 (tirar a validação e inverter a condição) estão declaradas. O antigo teste que dava o comportamento errado como correto foi trocado pelo de `:447`, em que cada seção grava o código do próprio recorte.
2. Feita: o arquivo `0` não existe mais na raiz.

As recomendações da 1ª rodada estão aplicadas como o resumo diz:
- a §7c traz a varredura por par tipo e fila;
- `MEIO_ABRE_O_DISJUNTOR_EM_MS` é exportado do core e a constante duplicada no processador saiu;
- os cenários da janela e das 12 seções foram ajustados;
- o laço de leitura das páginas está registrado para a 5.0.

Recomendações:
- `apps/api/src/material/classificar-secoes.command.ts:110`, com `secoes.repository.ts` `somarFalha`: quando a execução falha com `IA_SAIDA_INVALIDA`, a seção sem recorte (que não foi ao modelo) continua com o `execucao_id` e também soma 1 em `falhas_seguidas`, por uma falha que não causou. Hoje o efeito é pequeno, porque a 5.0 agrupa por recorte e a seção sem recorte não deveria ser agendada. Ainda assim, vale limpar as seções sem recorte no `preparar` (ou excluí-las do `somarFalha`), ou registrar esse caso para a 5.0.
- Com a união dos recortes acima de 300 candidatas, a execução falha com `IA_ENTRADA_INVALIDA`, as seções ficam presas à execução que falhou e não somam falha. Se a 5.0 deixar de agrupar por recorte, a mesma união volta a falhar toda noite, sem sinal. Convém que a 5.0 tenha um teste que prove o agrupamento por recorte.
- `apps/api/src/material/classificacao.int.test.ts:463`: erro de digitação no nome do caso ("nada gravadoe uma falha"). Se o nome for corrigido, o seletor das mutações que o citam também precisa mudar.
- O comando de domínio lança `LLMError('IA_SAIDA_INVALIDA')` para uma falha que é de validação dele mesmo. Funciona, porque reaproveita o caminho tipado do processador. Um comentário curto na linha 106 dizendo que o código é escolhido para cair no `aoFalharDefinitivo` deixaria isso explícito para quem vier depois.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/4_task.md

## test-engineer · 2ª rodada · REPROVADO · 2026-11-17 21:49:47 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: REPROVADO

Cenários exigidos: os mesmos da 1ª rodada (a tabela da 4.0 e "Classificação no worker" do `cenarios.md`). Nesta rodada conferi as três correções exigidas, as recomendações aplicadas e os casos novos de "mais de um recorte na mesma execução". Rodei `npx vitest run --project integracao apps/api/src/material/classificacao.int.test.ts` e os 60 passaram. Rodei também o caso do log sozinho, com `-t`, e ele passou. Não alterei nenhum arquivo.

Cobertos:
- **Correção 2 (log), feita.** O caso roda uma execução própria e filtra as linhas pelo `execucaoId`. A lista de proibidos inclui `'Apostila de teste'` e `CODIGO_DE_CNT`, que é o código que `respondeComUmCodigo` devolve, então ele chega ao `concluir`. Sozinho, o caso fica verde.
- **Correção 3 (pacote do Tutor), feita.** O caso lê `OrcamentoRepository.consultar` com `turmaId`. Com a turma sem aluno, `Math.max(1, 0) × 1` dá pacote 1 com 0 trocas, ou seja, limite − 1. Afirma `permitido: true` antes e depois e conta `mensagem_tutor` da turma antes e depois. A mutação "somar ao pacote" deixaria o caso vermelho.
- **Correção 1, em parte.** Os dois casos usam `Promise.all` de dois `entregarDeNovo`, com a mesma ordem forçada de `execucao-interrompida.int.test.ts:371` (`WriteBlockTrigger` no `update` para `rodando` e `esperarNaTrava` com 2). Se a segunda entrega não ficasse presa na trava, o `esperarNaTrava` estouraria o prazo, então o cenário passa mesmo pelo caminho `daRotina`. Os casos afirmam uma chamada ao modelo, `EXECUCAO_INTERROMPIDA`, nenhuma seção gravada e `falhas_seguidas` em 0. O `cenarios.md` e a §5 da Tech Spec foram ajustados. Falta o `consumo_ia` (bloqueante abaixo).
- **Recomendações da 1ª rodada, bem aplicadas:**
  - **Janela às 7h05:** volta depois do adiamento do provedor, `baseMs` de 10 h 55 min.
  - **`pendente` às 10h:** testada com o job já adiado.
  - **Doze seções em `falhas_seguidas`:** semeadas e conferidas.
  - **Worker morto:** limite − 5 s e limite + 1 s, mais a reentrega de uma `rodando` pelo `daRotina`.
  - **Nome em `llm-gateway.test.ts`:** corrigido, e agora afirma `IA_INDISPONIVEL` e `modelosPedidos` não vazio.
  - **"A janela é só do lote":** usa execução com pessoa e chega a `concluida`. O comando falso não esconde a regra, porque a regra testada é o `comando?.fila === 'lote'` do processador, e o bloco de mutação dela aponta para esse caso.
  - **Vagas:** `vagasPadraoDoAmbiente().lote`.
  - **`daRotina`:** a lista fixada em `['classificar_secoes']` (`registro-de-comandos.test.ts`).
- **Mais de um recorte:** cada mutação nova tem o seu caso e chega à cláusula.
  - O código do Médio na seção do 8º ano passa pelo `comModelo`, então quem recusa é o `concluir`, e não o gateway.
  - O caso acima de 300 candidatas usa o gateway real, e a mutação `.slice(0, 300)` deixaria a recusa sumir.
  - Na seção sem série, os blocos cobrem o `limparDaExecucao` sem `soAsSecoes`, porque as seções de `a` perderiam o CNT.
- Nenhum `.skip`. Nenhum provedor real.

Bloqueantes:
1. **A correção 1 da rodada anterior não foi feita inteira: os casos paralelos não afirmam `consumo_ia`.**
   - **Onde:** `apps/api/src/material/classificacao.int.test.ts:712` e `:731`. O mesmo vale para a reentrega de `rodando` pelo `daRotina`, em `:835`.
   - **O que está errado:** a correção mandava afirmar as linhas em `consumo_ia`. Pela 6.0, quem encerra a `rodando` grava na mesma transação a linha estimada (`consumoEstimadoDaInterrompida`, `consumo.repository.ts:51`), e `execucao-interrompida.int.test.ts:348` e `:391` afirmam essa linha. Para a classificação ela não é afirmada em lugar nenhum. A execução da rotina tem diferenças próprias: não tem pessoa, não tem ano, e a função é `classificacao_do_material`. Hoje uma regressão que deixe de gravar a estimada passaria verde, e uma que a grave com outra função (o pacote do Tutor) ou com `aluno_id` também. A regra que fica sem prova é a regra 30, item 4, e a D14.
   - A linha 56 da tabela do `4_task.md` ainda promete "uma chamada, um consumo, uma gravação" para o caso [P], que agora é "nenhuma gravação".
   - **Correção exigida:**
     - Nos três casos, afirmar `consumosDa(execucaoId)`: com o `comModelo` substituindo o gateway, deve haver exatamente a linha estimada. Afirmar também o conteúdo dela:
       - `estado: 'falhou'`
       - `codigo_de_erro: 'EXECUCAO_INTERROMPIDA'`
       - `funcao: 'classificacao_do_material'`
       - `aluno_id: null`
     - Ajustar as linhas 55 e 56 da tabela "Testes que provam a regra" ao que o `cenarios.md` agora diz, separando o [P] paralelo do [I] da entrega depois de concluir ou de falhar.

Recomendações:
- `classificacao.int.test.ts:463`: no nome do caso, corrigir "nada gravadoe" para "nada gravado e".
- `classificacao.int.test.ts:657`: o caso força `job_registro.estado = 'ativo'` à mão para simular o job vivo. Ficaria mais fiel deixar o estado que o adiamento de verdade grava, ou dizer no comentário por que `ativo` é o equivalente.
- A coluna "Caso" da tabela de testes do `4_task.md` continua vazia em todas as linhas. Citar o nome do caso de cada linha ajuda a validação, sobretudo nas linhas com vários itens separados por ponto e vírgula (52 e 54).
- O caso acima de 300 candidatas depende do volume real de Língua Portuguesa e de Matemática na tabela da BNCC do banco de teste. Uma asserção de guarda tornaria explícita a premissa de que a união passa de 300, por exemplo contando `habilidade_bncc` dos dois recortes antes de rodar.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao-interrompida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/consumo.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/orcamento.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/4_task.md`

## revisor-geral · 3ª rodada · APROVADO · 2026-11-17 22:20:50 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

Nesta rodada só mudaram o teste, o `TODO.md` e o `4_task.md`. Nenhum arquivo de produção mudou, e a rodada anterior não deixou correção exigida.

- **Mutação nova no `4_task.md`:** a linha que ela troca existe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.processor.ts:208` (`registrarEstimada(interrompida, destino)`). O teste citado, "duas entregas ao mesmo tempo", agora afirma a linha estimada com `linhasDeConsumoDa`, então a mutação quebraria esse teste.
- **Tabela de cenários do `4_task.md`:** o novo nome "duas entregas ao mesmo tempo" leva a `EXECUCAO_INTERROMPIDA`. Isso bate com a `techspec.md` §5 (linha 100) e com o `cenarios.md` (linhas 44 e 108). A divergência não está só no `4_task.md`.
- **Premissa de mais de 300 candidatas:** a asserção conta pela mesma função que o repository usa (`habilidadeEhCandidata`) e compara com a constante exportada (`CANDIDATAS_MAXIMAS`, `packages/core/src/index.ts:395`). Os recortes do teste são os mesmos dos dois materiais criados logo abaixo.
- **`TODO.md`:** as quatro entradas novas têm dono e momento, e cada destino bate com a tabela de destinos do `4_task.md`.

Recomendações:
- O `4_task.md` diz que a reentrega de `rodando` e as duas entregas ao mesmo tempo deixam só a linha estimada em `consumo_ia` (função `classificacao_do_material`, sem aluno). O `cenarios.md:107-108` não diz isso. O comportamento vem da 6.0 e não diverge da spec, mas vale escrever no `cenarios.md`, para quem validar achar o que o teste prova.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts`, o comentário sobre o `ativo` à mão ficou numa linha só, longa demais. Partir em duas ajuda a leitura.

## test-engineer · 3ª rodada · APROVADO · 2026-11-17 22:21:05 · `tasks/prd-classificacao-bncc/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** a correção exigida na 2ª rodada. Os três casos precisam afirmar a linha estimada em `consumo_ia` e o que ela contém: as duas entregas ao mesmo tempo, as duas entregas ao mesmo tempo com saída inválida, e a reentrega de `rodando` pelo `daRotina`. As linhas 55 e 56 da tabela "Testes que provam a regra" precisam seguir o `cenarios.md`, com o [P] paralelo separado do [I] da entrega depois de concluir ou de falhar. Também conferi as recomendações da 2ª rodada que já foram aplicadas.

**Cobertos:**
- **Correção 1, nos três casos.** O novo `linhasDeConsumoDa` lê as linhas da execução em `consumo_ia`, e o `estimadaDaRotina` monta a linha esperada. O `toEqual` sobre a lista prova que há exatamente uma linha e confere o conteúdo: `estado: 'falhou'`, `codigo_de_erro: EXECUCAO_INTERROMPIDA`, `funcao: 'classificacao_do_material'`, `tarefa: 'classificar_secoes'`, `aluno_id: null`, `entrada: null`, `saida: null` e `escola_id` da escola A. As asserções estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificacao.int.test.ts:753`, `:773` e `:872`. Os valores batem com `consumoEstimadoDaInterrompida` (`packages/core/src/ia/consumo.ts:70-89`). Como o `comModelo` substitui o gateway, a entrega que chamou o modelo não grava consumo, e a única linha possível é a estimada. A lista exata, portanto, é a asserção certa.
- **Bloco de mutação novo, em `4_task.md`.** Ele troca `registrarEstimada(interrompida, destino)` por `void destino` em `execucao.processor.ts:208`. O trecho confere com o código, e o teste citado é o caso paralelo, que agora afirma a linha. O caso do `daRotina` passa pela mesma linha e também ficaria vermelho.
- **Tabela do `4_task.md`.** O [P] "duas entregas ao mesmo tempo (D49)" agora diz uma chamada, nenhuma gravação e só a estimada. O [P] da saída inválida diz `falhas_seguidas` em 0. Os casos [I] "depois de concluir" e "depois de falhar" ficaram em linhas próprias. Tudo isso confere com o `cenarios.md:44` e `:108`. A linha "worker morto" ganhou a estimada da reentrega, e cada linha cita o caso pelo nome.
- **Recomendações da 2ª rodada, todas bem aplicadas:**
  - o nome do caso foi corrigido para "nada gravado e" (`:481`);
  - o comentário sobre o `ativo` fixado à mão está em `:684`;
  - a coluna "Caso" foi preenchida;
  - a guarda das 300 candidatas, em `:499-507`, conta a união na `habilidade_bncc` com o mesmo `habilidadeEhCandidata` do repository e afirma `> CANDIDATAS_MAXIMAS`, de modo que o caso não passa mais em silêncio se a premissa cair;
  - as quatro entradas do `TODO.md` têm dono.
- **Rodada local.** Rodei os seis casos de entrega dupla e reentrega (`-t "entregue|duas entregas|reentregue"`), e os seis passaram. Os dois casos paralelos são concorrência de verdade: duas `rodar` em `Promise.all`, com a ordem forçada pela trava (`WriteBlockTrigger` e `esperarNaTrava`). Não há `.skip` e não há provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- O caso do `daRotina` (`:865`) não tem bloco de mutação próprio. Hoje ele é coberto pela mesma mutação do caso paralelo, porque passa pelo mesmo `registrarEstimada` do processor. Se um dia a reentrega ganhar caminho próprio, vale um bloco que cite esse caso.
- O `consumosDa` (contagem) e o novo `linhasDeConsumoDa` convivem no mesmo arquivo. O caso "depois de concluir" (`:777`) poderia afirmar o conteúdo da linha, com `estado` sucesso e `funcao`, em vez de só a contagem. É cobertura extra, não bloqueia.
