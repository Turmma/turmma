# Cenários de teste — reengenharia-continuacao (X6)

Exigidos pela revisão da spec (`revisao-spec.md`, rodadas 1 a 6). I = integração com Postgres e Redis reais e relógio injetado ·
U = unidade, ou componente com a API falsa · E = e2e em `chromebook` e `celular`, com axe · P = em paralelo, com a ordem
forçada por barreira · C = carga, fora da esteira. Toda mutação citada deixa o teste vermelho por um caso que rodou e falhou.
Nenhum teste chama provedor pago (regra 80.11): o adaptador é o falso, com latência e erro injetáveis. As transições usam o
`now()` do banco: a idade (21 s, 299 s, 301 s) se faz recuando `criada_em` e `iniciada_em` no banco, não com relógio de JS.

**A bancada.** `apps/api/test/fila-de-ia.fixture.ts`, no molde de `apps/worker/test/queue.fixture.ts`: publica pelo outbox,
roda o despachante e consome com o `JobExecutor` real, no Redis de teste. As suítes que hoje trocam o `EXECUTOR_DE_AGENTE`
(23 usos) passam por ela. Uma guarda em `tools/guardas/` acusa a suíte que troca o `EXECUTOR_DE_AGENTE` ou o executor da
bancada, com fixture.

## 1. O comando, o job e os estados (RF1, RF3, RF5)

- [U] Toda `TarefaDeIa` tem comando registrado, salvo `relatorio_da_correcao`. Mutação: tirar um registro
- [I] O `AppModule` sobe sem `LLM_PROVIDER`; o `main-worker` sobe sem controller nem porta. Mutação: importar o provedor no
  `AppModule`
- [I] O hash de cada prompt bate com a `versao` antes e depois da troca; a conversa do Assistente e a geração por ferramenta concluem sem entrega (só a adaptação cria entrega, e `pendente`)
- [U] `ia.executar` recusa payload sem `execucaoId`, com campo a mais ou com id fora do formato uuid (`DADOS_INVALIDOS`, antes do
  repository)
- [I] Turno do Tutor pela fila: `POST` dá 202 com a execução `pendente` e um `ia.executar` no outbox, na mesma transação; o
  worker conclui, a resposta chega, a troca conta uma vez
- [P] Clique duplo: dois `POST` com a mesma `chaveEnvio` em `Promise.all` dão uma execução e um job. Mutação: tirar a restrição
  única da `chaveEnvio`
- **Entrega duplicada, separada por momento:**
  - [I] depois de `concluida`: sem efeito, uma chamada, uma resposta, uma troca. Mutação: tirar o `where estado = 'pendente'`
  - [P] em corrida, com barreira: a 1.ª entrega marca `rodando` antes do `fetch`; a 2.ª acha `rodando` e grava
    `EXECUCAO_INTERROMPIDA`; a conclusão da 1.ª não muda a linha; nenhuma resposta, a troca não conta, uma chamada no máximo.
    Mutação: concluir sem `where estado = 'rodando'`
  - [P] as duas leem `pendente`, com barreira entre a leitura e o `update`: uma só vira `rodando`, uma só chamada
- [I] Worker morto (`kill -9` simulado: job reentregue com a execução em `rodando`): `falhou EXECUCAO_INTERROMPIDA`, sem modelo,
  a troca não conta, uma linha estimada em `consumo_ia` na mesma transação (§3)
- [I] Pool do banco: com o adaptador falso demorando 5 s, 20 execuções em paralelo numa réplica de pool 20 não esgotam o pool, e
  um `select` pelo pool da própria réplica, com tempo curto para pegar conexão, responde no meio (o job não segura conexão
  durante o modelo)
- [P] Varredura com duas réplicas, com barreira entre o `update … returning` e o `commit`: um encerramento e uma linha estimada. Mutação:
  tirar a condição de estado do `update` da varredura
- [I] Varredura: a `rodando` de 301 s é encerrada; a de 299 s fica; a `pendente` com job vivo em
  `job_registro` fica, mesmo com o Redis fora; a `pendente` com job final ou ausente é encerrada; um job vivo de outra escola com o
  mesmo `execucaoId` no payload não segura a `pendente`. Mutação: limiar fixo antigo, não ler `job_registro`, ou não igualar a escola
- **O corte dos 20 s:**
  - [I] job chega com 21 s e nenhum `GET`: o processador corta, `falhou IA_INDISPONIVEL`, `ia.espera_estourada` +1, sem modelo.
    Mutação: tirar o corte do processador
  - [I] Redis fora, só o `GET` aos 21 s: a linha vira `falhou IA_INDISPONIVEL` logo depois do `GET`, antes de o Redis voltar.
    Mutação: tirar o corte do `GET`
  - [I] `GET` aos 15 s: nenhuma escrita (o `update` só sai com a linha vencida)
  - [I] `GET` com mais de 20 s sobre uma `concluida` e sobre uma `rodando`: nenhuma escrita, a resposta continua, a métrica não
    soma. Mutação: tirar o estado da decisão de cortar na leitura do `GET`
  - [I] `GET` de quem pediu sobre uma `pendente` da `ferramenta` com 21 s: nenhuma escrita, e ela roda depois. Mutação: tirar a
    fila da decisão de cortar na leitura do `GET`
  - [P] processador e `GET` juntos, nas duas ordens forçadas: com o processador primeiro, aos 21 s, ele faz o `pendente → rodando`
    com zero linhas, corta, e o `GET` acha `falhou`; com o `GET` primeiro, ele corta e o processador acha `falhou`. Nas duas, um
    só corte, a métrica soma uma vez, o modelo não é chamado. Na ordem "processador primeiro", a barreira fica também entre a
    leitura do `GET` e o `update` dele, que recebe zero linhas e não soma. Mutações, nessa ordem: tirar a condição de idade do
    `pendente → rodando` (o modelo é chamado); tirar `estado = 'pendente'` do `update` do corte do `GET`
  - [I] a interativa cortada: a tela mostra "Tentar de novo", a troca não conta; a ferramenta com 21 s na fila roda
  - [I] Redis fora e de volta: em 15 s, o job roda; em 25 s, o `GET` já cortou e o job, ao chegar, sai sem modelo; a ferramenta
    roda quando ele volta
- **O professor vê a pergunta sem resposta:**
  - [I] o aluno com duas perguntas cortadas hoje e uma respondida: `semRespostaHoje` 2, `trocasHoje` 1, sem texto no DTO; o
    aluno que só teve pergunta cortada aparece na lista. Mutação: manter o filtro de `falhou` na leitura nova
  - [I] contam também, uma de cada: a reentrega (`EXECUCAO_INTERROMPIDA`), o prazo único estourado (`IA_TEMPO_ESGOTADO`), a saída
    inválida (`IA_SAIDA_INVALIDA`), `PEDIDO_ACIMA_DO_TETO` (com o teto rebaixado na definição injetada da tarefa) e a recusa da
    D62 (`IA_INDISPONIVEL`). Mutações: contar só o corte; contar só `IA_INDISPONIVEL`
  - [I] parametrizado sobre a constante `PASSAGEIROS` importada de `packages/shared`, sem filtro: cada código, inclusive
    `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`, dá +1 em `semRespostaHoje`. Mutação: uma lista copiada no repository, sem `ERRO_INTERNO`
  - [U] em `packages/shared`, um teste fixa a `PASSAGEIROS` inteira, com `IA_SAIDA_INVALIDA`, `IA_ENTRADA_INVALIDA` e
    `PEDIDO_ACIMA_DO_TETO`. Mutação: tirar um código da constante
  - [I] com o "agora" do uso fixado às 10h de Brasília, uma pergunta cortada ontem às 23h50 (`FUSO_DO_USO`): `semRespostaHoje`
    continua 2. Mutações: tirar o filtro de dia; contar o dia em UTC
  - [I] não contam: a falha por avaliação aberta (S12), por `FUNCAO_SUSPENSA` e por `NAO_ENCONTRADO`, e a pergunta que recebeu a
    mensagem fixa. Mutação: contar todo `falhou`
  - [I] o recorte de turma, ano e disciplina de `ultimasTrocas` vale para `semRespostaHoje`: a pergunta cortada na disciplina de
    outro professor, em outra turma ou no ano anterior não aparece; o professor de duas disciplinas na turma vê as duas.
    Mutação: tirar o recorte
  - [I] a pergunta cortada e reenviada pelo "Tentar de novo", e respondida: a cortada conta, a reenviada entra em `trocasHoje`
  - [U] a linha do aluno mostra "2 perguntas que o Tutor não respondeu hoje", em texto neutro e separado do "X de Y" do freio;
    com 0, nada
- [I] O contexto no worker: vínculo encerrado, papel trocado, turma, atividade ou material fora do alcance, pessoa eliminada
  entre o `202` e o worker, virada do ano letivo e função suspensa: `NAO_ENCONTRADO` (ou `FUNCAO_SUSPENSA`), sem modelo, sem
  `consumo_ia`. Mutação: tirar a conferência do `preparar`

## 2. A D36 e a S12 no worker (RF4)

- [I] "quero sumir" com a fila cheia e com o Redis fora: a mensagem fixa e o `atencao_humana` saem na requisição, sem job.
  Mutação: mover a conferência para o comando
- [I] Assunto delicado detectado no `concluir` com a execução já encerrada pela varredura: o sinal e a mensagem ficam
  (transação própria). Mutação: gravar o sinal dentro da conclusão condicional
- [U] Quando a mensagem fixa e o "Tentar de novo" chegam juntos, a mensagem fixa (com o CVV) fica visível, acima do botão
- [I] Reentrega do job do assunto delicado: um sinal só (chave única)
- [I] Avaliação aberta entre o `POST` e o `preparar`, e entre o `preparar` e o `concluir`: a resposta não sai, a troca não conta
- [I] Tutor desligado na escola (D84), função suspensa (D9) e fora da política da turma (D19): nenhum job no outbox. Uma mutação
  por camada: tirar cada conferência

## 3. A execução interrompida no rastro (RF3, regra 20.19)

- [I] Reentrega com adaptador externo configurado: a linha estimada de `consumo_ia` tem `envio_externo` e `provedor`, `entrada`,
  `saida` e `aluno_id` nulos e os dois tetos da tarefa; a execução aparece em `rastroDoAluno`. Mutação: gravar sem `envio_externo`
- [I] Varredura com adaptador externo e `rodando` de 301 s de duas escolas no mesmo ciclo: cada linha, com o `execucao_id`, fica
  na escola da própria execução e aparece em `rastroDoAluno`; a `pendente` encerrada pela varredura não gera linha. Mutação: a
  varredura não grava a linha
- [I] A linha estimada não entra no freio do dia do aluno. Mutação: gravar com `aluno_id`
- [I] Com o falso ou o local, a linha estimada não conta como envio externo
- [I] O original vivo também registra: duas linhas, nunca zero
- [U] Por tarefa, o pior pedido válido (cada campo no limite do `esquemaDeEntrada`, montado pelo `montarPedido`, com o prompt)
  cabe no `maximoDeTokensDeEntrada`. O gerador falha se algum campo do esquema não tem limite (no Analista, o nome da disciplina
  ganhou o `max` do cadastro, 80). Mutação: um teto abaixo do pior
  pedido
- [U] O pedido acima do teto (só por defeito): `PEDIDO_ACIMA_DO_TETO`, nenhum `fetch`, nenhum orçamento reservado, nenhuma linha
  em `consumo_ia`, `ia.pedido_acima_do_teto{tarefa}` +1; a tarefa sem o teto não compila (`@ts-expect-error`)
- [I] No Tutor, o turno recusado acima do teto não conta como troca
- [U] Em `ciclo-de-execucao.test.ts`: `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'` ("Tentar de novo"). Mutação: deixar o
  código fora de `PASSAGEIROS`

## 4. Os tokens e o gateway (RF7, RF8)

- [U] Relógio falso, um teste por degrau: com vaga, roda; sem vaga, espera até 8 s; depois o modelo menor; depois
  `IA_INDISPONIVEL`, sem contar a troca e sem erro cru. Cada degrau confere também a sua métrica
- [U] `turno_do_tutor` sem vaga pula o modelo menor e termina `IA_INDISPONIVEL`. Mutação: permitir o degrau no Tutor
- [U] Sem `LLM_MODELO_MENOR_<PERFIL>`, o degrau é pulado, e a métrica do degrau não muda
- [U] Modelo menor sem preço na tabela de `consumo.ts`: a subida falha
- [I] No modelo menor, a saída passa pela mesma conferência: `propor_ferramenta` com nota na saída é recusada (D55)
- **O prazo único da execução.** O prazo da execução e o `prazoMs` do job correm no mesmo relógio falso, e o caso afirma o
  instante em que a execução termina. `LLM_TIMEOUT_MS_<PERFIL>` fica acima do que sobra do prazo (600 s), para o prazo único
  ser o que corta:
  - [I] a `ferramenta` espera no teto, a vaga abre aos 7 s, o pedido vai ao modelo principal e ele pendura: termina
    `falhou IA_TEMPO_ESGOTADO` aos 140 s contados do `rodando`, não aos 147 s, sem log `ia.geracao.erro_inesperado`; o Tutor, aos
    60 s. Mutação: contar a espera fora do prazo
  - [I] com o prazo de chamada a 100 s, a 1.ª saída inválida aos 90 s e a 2.ª chamada pendurada: termina aos 140 s, sem reentrega
    nem `EXECUCAO_INTERROMPIDA`; com a mutação "prazo por chamada", iria aos 190 s e viria a reentrega
  - [I] 8 s sem vaga e o modelo menor pendurado: (a) com o prazo de chamada a 600 s, termina aos 140 s; com a mutação "espera fora
    do prazo", aos 148 s; (b) com o prazo de chamada a 100 s, termina aos 108 s com `IA_TEMPO_ESGOTADO`, o que prova o "menor
    entre"; com a mutação "só o que sobra do prazo", aos 140 s
  - [I] o prazo vence durante a espera da 2.ª reserva de tokens (1.ª chamada inválida aos 135 s, sem vaga para a 2.ª): termina
    aos 140 s, não aos 143 s. Mutação: a espera ignora o `pedido.sinal`
  - [I] o worker desligado no meio (abort do desligamento, não do prazo): nenhuma escrita; a reentrega encerra com
    `EXECUCAO_INTERROMPIDA`. Mutação: tratar todo abort como prazo estourado
  - [U] configuração: o prazo de cada perfil fica abaixo do `prazoMs` menos a folga da reentrega
- [I] A `ferramenta` esperando no teto dela não consome o balde geral (devolvido com `reward`), e o Tutor roda com o geral perto
  do limite. Mutação: consumir o geral antes do balde da fila
- [I] A `ferramenta` no teto dela (15 %) espera enquanto o Tutor da mesma escola roda; a `normal` no dela (10 %) idem
- [I] Duas réplicas somam no mesmo balde; com o Redis fora, cada uma segura o teto ÷ `IA_REPLICAS`
- [I] `consumo_ia` grava o modelo que respondeu (o menor, no degrau)
- [U] Nenhuma métrica leva usuário; só `ia.espera_estourada` leva `escola_id`
- [U] Os alertas novos e o `job-interativo-esperando.yaml` estendido à `ferramenta` estão no teste de alertas, e a guarda do
  runbook acha a seção de cada um; a expressão de "IA: espera estourada" separa uma escola de várias (caso de borda do PRD §7);
  "Tokens acima de 80 %" dispara com o balde cheio (maior ou igual a 0,8 do contratado, RF8) e o aviso aos 70 %. Mutação: trocar
  um limiar

## 5. A D62 (RF9, RF10)

- [I] Subida com provedor externo: sobe com o suboperador vigente `BR`, `veda_treinamento`, `alcance = 'todas'` e a união das
  categorias; um caso de recusa por campo e **um por categoria faltando**. Mutação: conferir só `conversa_do_aluno`
- [I] Banco fora na subida: não fica pronto e não consome fila
- [I] O falso e o local sobem sem suboperador (caso positivo)
- [U] O `DECLARADO` de `packages/core/src/ia/tasks/tarefas.test.ts` fixa `levaTextoDeAluno` e `categoriasEnviadas` de **toda**
  tarefa; `levaTextoDeAluno: true` exige `conversa_do_aluno` nas categorias. Mutação: tirar uma categoria de uma tarefa
- [U] Marca ligada e declaração não conferida: nenhum `fetch`, nenhum orçamento reservado, `IA_INDISPONIVEL`, log
  `ia.geracao.soberania_recusada`. Mutação: conferir depois do orçamento
- [U] Marca ligada e adaptador falso: a chamada sai (caso positivo do gateway)

## 6. Isolamento (regra 10)

- [I] O `ExecucaoRepository` lê a escola do contexto: com o contexto da escola A, a execução da B não é lida nem mudada. Mutação:
  tirar o `escola_id` do `where`
- [I] Job da escola A com o `execucaoId` de uma execução da B: no `pendente`, no corte e na reentrega, nada muda na B e o modelo
  não é chamado
- [I] `GET` de um usuário da escola B, e de outro usuário da mesma escola, sobre uma `pendente` de 21 s: 404 com o mesmo corpo do
  id inexistente; a linha segue `pendente`; `ia.espera_estourada` não soma. Mutação: cortar antes da leitura, ou sem
  `solicitada_por`
- [I] Entrada gravada que cita turma ou material da B: o `preparar` dá `NAO_ENCONTRADO`
- [I] Vagas: a escola A com 4 ferramentas rodando espera na 5.ª, e o Tutor dela responde; a escola B segue com as suas (RF2).
  A `QUEUE_PRIORITY` ordena `interativa` 1, `ferramenta` 2, `normal` 3, `lote` 4, `pdf` 5; um `ferramenta` novo começa antes de
  qualquer `normal` não iniciado (pool próprio)

## 7. A web (RF11, RF12, RF13)

- [U] Cliente com relógio falso: a leitura estoura em 20 s, o PDF em 30 s, o envio de arquivo em 180 s, a resposta de prova em
  10 s: `TEMPO_ESGOTADO` e "Tentar de novo" (a de prova é o `responderQuestao`, com `tipo: 'prova'`; o prazo cobre também a leitura do
  corpo da resposta). Cancelamento de quem chamou: nenhum `ErrorState`. O prazo é **o de cada tentativa**: a leitura repetida uma vez
  pelo `shouldRetry` (1 s de atraso) só mostra "Tentar de novo" por volta dos 41 s (20 s + 1 s + 20 s)
- [U] O estouro do prazo do cliente leva a marca `origem: 'cliente'` (o `ApiError` criado em `comPrazo`); o `TEMPO_ESGOTADO` da API
  (503 do `statement_timeout`, 408, 504) não a leva. Só o estouro do cliente deixa incerto se a gravação aconteceu (`ehResultadoIncerto`,
  em `operacao/textos.ts`: a proteção da tentativa incerta de `NovaEscola` liga) e só ele manda a escolha seguinte da fila de prova
  na hora; o `TEMPO_ESGOTADO` da API passa pelo recuo com jitter. O aviso da decisão da correção, no estouro, manda conferir a
  correção, sem afirmar que nada foi aprovado
- [U] `material/api/material.ts` e `artefatos/api/artefatos.ts` com prazo; a guarda acusa `fetch` fora de `api/client.ts`, com
  fixture em `tools/guardas/guardas.test.ts`
- [U] `PUT` de resposta pendurado: estoura, vai para o fim da `fila-de-respostas`, e a questão seguinte sai. Mutação: devolver
  ao início da fila
  - com uma só escolha na fila, o estouro espera o recuo de sempre; a falha que não é estouro também (a seguinte só sai na hora no
    estouro, `haOutraEsperando`); a escolha trocada enquanto a velha pendurava não é movida
- [U] Componente que lança na raiz: aparece a `Falha` com "Voltar ao início", em cada rota sem área (entrada, sala pública,
  troca de senha, sistema), sem casca e com o `DrawerContext` padrão; o "Voltar ao início" é um link para `/` cujo clique não é
  impedido (a página nova é que limpa a fronteira: o `jsdom` não navega, e a saída da `Falha` é o [E] abaixo). Na operação, o
  destino é `/operacao`; a fronteira da área pega primeiro, com a casca de pé
- [U] 503 com `Retry-After: 3`: botão desabilitado, `role="status"` com "Tentando de novo em instantes" (a contagem é
  `aria-hidden`), uma nova tentativa; segundo 503: o `ErrorState`, sem nova espera; `Retry-After: 10` espera, `Retry-After: 11`
  vai direto ao `ErrorState`. Na entrada e no seletor, que mantém a escola
- [I] Redis fora no segundo fator e na escolha de escola: `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, e o contador do
  `insuranceLimiter` do `LoginLockout` sem tentativa gasta. Mutação: reservar antes de `conferirLivre`. O `docs/runbook.md`
  ("Seguro de limite ativo", causa 4) deixa de dizer 401 e "volta ao login": diz 503 e a espera única da tela (14.0)
- [I] Redis que cai **depois** do código certo (o `consumir` do segundo fator): `503 TEMPO_ESGOTADO`, e não o 503 que manda repetir o mesmo pedido; o código está gasto
  (o passo gravado, ou o de recuperação usado), nenhuma sessão abre, e o código seguinte, com o Redis de volta, entra. O desafio forjado, com o Redis fora, segue 401
- [E] Com o Redis de fila fora (`e2e/entrar-na-escola.spec.ts`): o segundo fator e a escolha de escola da entrada (login falso por `page.route`, sem usuário
  no banco) e o seletor (uma professora de verdade em duas escolas, entrando pela API) recebem o 503 com `Retry-After: 10` duas vezes, com o relógio da página parado (`page.clock`) enquanto o aviso é medido: o aviso com o botão
  desabilitado e, depois, o `ErrorState` com o foco de volta ao botão; a 1366 × 768 a página não rola, a 360 px nada rola de lado, o botão tem 44 px, e o axe não acha nada sério
- [E] A `Falha` fora de área (`e2e/tela-de-falha.spec.ts`): o estado do sistema (`/sistema`) com a hora que não formata (o `Intl` do
  navegador lança só nessa página, por `addInitScript`; nenhuma resposta válida da API faz uma tela da entrada lançar) e a operação com o
  chunk trocado por um módulo que lança (`page.route`). O foco vai ao título; a 1366 × 768 a página não rola; o "Voltar ao início" sai da
  `Falha` (`/` leva à entrada; na operação, a `/operacao`)
- [E] `celular` a 360 px: a `Falha` (os dois botões sem cortar texto, com o `min-height` de 44 px lido no estilo e não só na caixa, porque o link sem a
  classe herda a altura do irmão; a 360 px os dois já quebram em linha (173 e 181 px, mais o vão, passam dos 328 px), e o `flex-wrap` se prova a
  280 px, o celular dobrável fechado, onde o segundo desce para a linha de baixo sem passar da janela), o aviso da espera e a linha do aluno no uso
  com "N perguntas que o Tutor não respondeu hoje", sem rolagem horizontal, alvos de 44 px, texto em português, axe. A falha, o
  `503` e o uso vêm de `page.route`, sem gancho no build de produção

## 8. Carga (RF6)

- [C] `justica-entre-escolas.js`, `FASE=base` e `FASE=sala`, build anterior e o da tarefa na mesma sessão, com um `kill -9` num
  `worker-ia`. O falso informa 3.000 + 250 tokens por turno (`docs/infra.md` §3.2), e o `LLM_TOKENS_POR_MINUTO` de
  `infra/carga.env` sai do piso do contrato (§7c da Tech Spec) nessa escala, para o teto morder. Mede p95 do turno, espera p95 do
  Tutor e da ferramenta e o número de "indisponível". O relatório leva o RSS do `worker-ia` e o custo de base por professor
