# Achados das revisões — `tasks/prd-reengenharia-continuacao/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-15 01:16:52 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. É revisão de spec, não existe código nem fotos. Conferi as premissas de tela em `apps/web/src/routes.tsx` e `main.tsx`.

**Estados:** faltando dois, e os dois cabem em bloqueante (abaixo).
- O "Tentar de novo" e a tela de falha têm estado de erro, e o `ErrorState` já existe (Tech Spec §9).
- O estado de carregando da espera do `Retry-After` (RF13) não está desenhado.
- O estado de erro do segundo `503` da entrada também não está desenhado.

**Acessibilidade:** implícita. A §9 reusa componentes que já existem.
- Não diz que o foco vai para o título ou o botão da tela de falha na raiz.
- Não diz que o aviso de espera é anunciado a leitores de tela (`role="status"` ou equivalente).
- Não diz que o botão "Voltar ao início" tem alvo de 44 px.
- Nenhum desses pontos é de veto, e entram como recomendação.

**Chromebook fraco:** parcialmente garantido.
- O RF11 dá prazos e a Tech Spec §5 manda o `PUT` estourado para a fila de reenvio sem travar as outras questões. Isso é bom para rede dividida.
- O RF6 e a §7c medem a carga no servidor com k6, mas não há medição no cliente fraco (CPU com throttling).
- Não se aplica a virtualização de lista nem a compressão de imagem: não há tela nova.

**Celular:** não se aplica a tela nova, mas há uma lacuna.
- A tela de falha na raiz e o aviso de espera da entrada são telas novas de fato. A Tech Spec §9 diz "sem tela nova", o que não é exato: `paginaInteira` na raiz da web é nova.
- Nenhum requisito manda o e2e do projeto Playwright `celular` cobrir a tela de falha (360 px, alvo de toque, sem rolagem horizontal).
- A regra 50 (item 2a) exige isso. É o bloqueante 3.

**Ação oficial protegida:** sim, não se aplica a esta spec. A IA no worker não muda o fluxo de aprovação (PRD §6, Tech Spec §7b). A entrega continua nascendo `pendente` e há teste de caracterização antes de mover as closures (§5).

**Itens da lista**
- **Item 2, feed nunca vazio:** não se aplica.
- **Item 3, seletor de escola:** o RF13 toca a escolha de escola. Ver o bloqueante 2.
- **Item 7, português:** o texto de `INDISPONIVEL_TENTE_DE_NOVO` e de `TEMPO_ESGOTADO` já existe em `operacao/textos.ts`.
  - O RF13 não define o texto da escola, que difere do do operador.
  - A Tech Spec nomeia `IA_INDISPONIVEL`, `EXECUCAO_INTERROMPIDA` e `TEMPO_ESGOTADO` como códigos, mas não manda mapeá-los para texto em português nas telas.
  - Hoje `aluno/tutor.test.ts` cobre os códigos de IA, o que é uma boa base.
- **Item 8, erro diz o que fazer:** é o ponto forte. O RF5, o RF7 e o RF11 pedem "Tentar de novo" e mensagem sem erro cru.

**Bloqueantes:**

1. **Tech Spec §5 "A web", `main.tsx`.** A Tech Spec manda envolver as rotas em `<AreaErrorBoundary paginaInteira>` em `main.tsx` com `FALHA_DA_AREA`, mas a premissa está errada. `FALHA_DA_AREA` vive em `apps/web/src/routes.tsx:63`, não é exportada e é usada por área e pela galeria. A `main.tsx` só renderiza `<AppRoutes />` (linha 59).
   - O RF12 é "quando uma tela quebra **fora de uma área**". Hoje as rotas `entrar`, `salaDaTurma`, a troca de senha e `sistema` ficam fora de qualquer `AreaErrorBoundary`. É nelas que a página branca acontece.
   - Correção exigida: a Tech Spec diz o arquivo real (`routes.tsx` ou `main.tsx`) e onde `FALHA_DA_AREA` é exportada. Diz também que a fronteira da raiz cobre `Entrada`, `TurmaPublica` e as rotas sem área.
   - Define o teste do RF12 como um componente que lança em cada uma dessas rotas, não só "na raiz".

2. **Tech Spec §5 "O Redis fora" e RF13.** "A web espera esse tempo uma vez" não está desenhado como estado de tela.
   - Falta dizer que o botão fica desabilitado, ou que há um aviso "Tentando de novo em N s", durante a espera.
   - Falta dizer o que aparece se o segundo `503` vier: o `ErrorState` com "Tentar de novo", sem nova espera automática.
   - Falta o teto da espera, porque um `Retry-After: 3600` não pode travar a entrada.
   - A escolha de escola é o seletor da área do professor e da coordenação (item 3). O comportamento dele durante a espera precisa estar escrito: mantém a escola atual selecionada e não limpa o cache (a troca de escola limpa o TanStack Query, `routes.tsx`).
   - Correção exigida: acrescentar essas três linhas à §5 e um caso ao teste "da web com o `Retry-After`" (RF13): espera única, teto, segundo `503` e botão sem duplo envio.

3. **Tech Spec §9 e §10, camada E2E.** A §9 afirma "Sem tela nova", mas a tela de falha na raiz (RF12) e o aviso de espera (RF13) são visíveis ao usuário, e nenhum teste os cobre no projeto `celular` do Playwright (regra 50, item 2a; D51).
   - O PRD §3 limita a tela ao "Tentar de novo" e à tela de falha. Isso é aceitável, mas o critério de celular continua valendo para elas.
   - Correção exigida: a §10 inclui um caso no projeto `celular` a 360 px, que força um chunk falho e um `503` com `Retry-After`. Ele confere que não há rolagem horizontal, que o "Tentar de novo" e o "Voltar ao início" têm 44 px e que o texto está em português.

**Recomendações:**
- Escrever, na §9 ou no RF11, que o `ErrorState` do `TEMPO_ESGOTADO` usa o texto "A operação demorou demais. Tente de novo em instantes." (`operacao/textos.ts`). Falta decidir se a escola usa o mesmo texto do operador ou um próprio.
- A resposta de prova que estoura (RF11, caso de borda "rede da escola trava na prova"): dizer ao aluno que a resposta ficou guardada para reenvio, para que ele não a refaça. A Tech Spec só diz "volta à fila de reenvio", sem a indicação visível.
- Acessibilidade das telas novas: foco no título, `role="status"` no aviso de espera e `role="alert"` na falha.
- Incluir no RF6 uma medição no cliente (Chromebook, CPU 4× mais lenta) da tela de falha e do "Tentar de novo".
- Nomear na Tech Spec §2 o arquivo do texto da escola para o `503`, junto de `web/src/api/client.ts`. Hoje a lista de módulos só cita `client.ts` e `main.tsx`.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/routes.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/main.tsx`

## llm-integrator · 1ª rodada · APROVADO · 2026-11-15 01:17:41 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A spec não cria tarefa nem prompt (§8). Ficam os perfis das tarefas de hoje:
- `rapido`: `turno_do_tutor`, `propor_ferramenta` e `relatorio_da_correcao`, que não tem chamador.
- `padrao`: `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `adaptar_atividade` e `resumo_do_analista`.

O degrau novo troca para o `LLM_MODELO_MENOR_<PERFIL>` dentro do mesmo perfil e é opcional até a D37.

Custo estimado por professor/mês: não muda, porque o número de chamadas de modelo é o mesmo. O que a spec altera é só onde a chamada roda. Os efeitos de custo são dois:
- A execução interrompida grava a reserva estimada em `consumo_ia`, para mais e nunca para menos (D14).
- A degradação pode usar um modelo mais barato.

A spec não traz o número de base (chamadas por professor por mês, por perfil). Ela remete ao custo de hoje, e não achei esse número em `docs/avaliacao-de-modelos.md`, `docs/infra.md` nem `docs/agentes.md`. Está listado nas recomendações.

Prompt versionado: sim. A §5 prevê um teste que fixa mensagens e hash de cada prompt contra a `versao`, antes de mover qualquer `aoConcluir`.

Validação de schema: sim, e sem mudança. O `JOB_DEFINITIONS` valida o payload `{ execucaoId: uuid }` com esquema estrito. A saída dos modelos segue o esquema de cada tarefa, e `IA_SAIDA_INVALIDA` continua sendo o caminho de erro.

Aprovação humana no caminho: sim. A entrega nasce `pendente`, e a §5 prevê um teste de caracterização antes de mover o `aoConcluir`. O Tutor continua na exceção da D47. Em D36 e S12, o sinal ao professor e a mensagem fixa são gravados mesmo com a execução descartada. A pergunta que expira em 20 s não conta a troca.

Bloqueantes: nenhum. Conferi os dez itens da lista:

1. Nenhum SDK fora dos adaptadores. A §1 só adiciona `TokenLimiter` e a conferência da D62 dentro do `LLMGateway`, em `packages/core/src/ia/`. A §2 tira o `LLM_PROVIDER` do `AppModule` HTTP.
2. Perfil declarado: cada tarefa já declara o dela. O teste de `tarefas.test.ts` fixa função, perfil e `levaTextoDeAluno`.
3. Prompt versionado: garantido pelo teste de hash da §5.
4. Schema: garantido, sem mudança.
5. Timeout, retry e limite:
   - Timeout e retry: o provedor resiliente da 48.0 está no desenho herdado de `onda-3c.md`. Os cortes ficam abaixo do `prazoMs` de 150 s e o orçamento de 56 s e 136 s já inclui os 8 s de espera. A §5 e §7c cobrem o tempo; o limite de tokens por minuto e a degradação em degraus entram nesta spec.
   - Limite de custo por escola: o teto em reais fica declarado fora de escopo (F5, D37). A D14 e a D38 continuam valendo.
6. Registro da execução: `execucao_agente` e `consumo_ia` seguem como hoje. A execução interrompida registra consumo estimado, e o payload do job não carrega dado.
7. Teste sem provedor pago: a §7c e a §10 usam o adaptador falso, `IA_LATENCIA_FALSA_MS_PADRAO` e `servidor-llama-falso`.
8. Fila, idempotência e reinício:
   - O comando fica no outbox (D49), na mesma transação do `agendar`.
   - `pendente → rodando` é `update … where estado = 'pendente'`; reentrega e worker morto dão `falhou EXECUCAO_INTERROMPIDA`, sem chamar o modelo de novo.
   - `falharInterrompidas` roda como rede de segurança.
   - As corridas e as mutações de `onda-3a.md` §3 estão herdadas explicitamente na §7c.
   - Premissas conferidas no código: o `JobExecutor` ('worker' | 'api') já existe em `job-definitions.ts`; `bullmqQueueName(fila, executor)` e o `uniqueIndex (escola_id, execucao_id, tipo)` do `sinal_tutor` também. Por isso o "sinal não duplica" não pede coluna nem índice novo, e a migration 0050 só amplia os dois checks.
9. Entrega `pendente`: coberta, como acima.
10. Agente sabe parar: é uma chamada por execução, e o limite de passos e de custo por execução é do F11, declarado em PRD §3. Não se aplica aqui.

Isolamento (regra 10) e dado pessoal (regra 20), pontos que a minha área toca:
- O payload leva só `execucaoId`.
- A escola vem de `job_registro.escola_id`.
- O repository passa a ler a escola de `requireEscolaId()` (§6).
- Os testes de isolamento têm mutação: contexto A lendo a execução da B, job da A com o id da B, e vaga de ferramenta separada por escola.
- O `preparar` repete a conferência de alcance que o `POST` fez, e o log só leva ids.

Recomendações:
- **Escola na métrica (§6 e §7c):** `ia.espera_estourada{escola_id}` contradiz o PRD §8 ("as métricas de IA não levam usuário nem escola") e o PRD §4 (operador sem dado de outra escola em métrica). A exceção está declarada e `escola_id` é contagem, mas conviria alinhar o texto do PRD §8 e do runbook, para a conformidade não estranhar.
- **Número de base no relatório:** a §8 devia trazer chamadas por professor por mês e custo por perfil (referência D39, até R$ 5 por aluno/mês, e D38). Sem isso o relatório da tarefa não fecha a estimativa que a precificação exige. Falta também dizer se a degradação ao modelo menor vale só para o Tutor, como no RF7, ou também para ferramentas e Analista, que a §5 deixa ambíguo.
- **Modelo gravado:** adicionar um teste de que, na degradação, `consumo_ia` e a execução registram o modelo menor realmente usado e não o principal. O `RegistroDeConsumo` já tem o campo `modelo`.
- **Pool da fila nova (§2):** a §2 não lista `packages/core/src/queue/queues.ts`. `WORKER_POOL_OPTIONS_BY_QUEUE` é um `Record<QueueName>` e hoje não tem `ferramenta`, então a compilação obriga a entrada. Declarar `lockDurationMs` e `stalledIntervalMs` iguais aos da `interativa`, como diz `onda-3a.md`, para sustentar o "stalled ~15 s" da §5.
- **D62 depois da subida:** a conferência roda só na subida (§5). Se a vigência ou o alcance do `suboperador` mudar depois, o processo continua enviando até reiniciar. Documentar a limitação ou reler a declaração de tempos em tempos.
- **Modelo menor na D62:** a §5 poderia afirmar que o modelo menor é do mesmo provedor e herda a conferência da D62. Hoje isso está só no `onda-3c.md` ("mesmo provedor e conferências da D62").
- **Rótulo do estado:** o PRD RF3 fala em `interrompida`, e a Tech Spec usa `falhou EXECUCAO_INTERROMPIDA`. Alinhar o nome.
- **Nomes antigos:** `onda-3a.md` usa `exigirEscolaDoContexto()` e `nucleo`. A Tech Spec §6 já corrige para `requireEscolaId()` e `core` (X8), mas conviria uma nota na tarefa para o implementador não copiar o nome antigo.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3c.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/queue/queues.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-15 01:18:32 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela ou coluna nova (Tech Spec §3). A migration 0050 só amplia os checks `job_registro_fila_valida` e `configuracao_operacional_vagas_validas`. `execucao_agente` já tem `escola_id` e `ano_letivo_id`, e o ano é gravado a partir do contexto em `gravarPendente`. `job_registro` tem `escola_id`, e o check `job_registro_escola_ou_sistema` obriga a escola em todo tipo `ia.*`. `consumo_ia` e o sinal `atencao_humana` continuam nas tabelas de hoje, que já têm escopo.

**Queries verificadas:**
- **Itens 2 e 3, escopo pelo token.** A Tech Spec garante (§6). `ExecucaoRepository` deixa de receber a escola por argumento (`marcarRodando`, `concluirRodando`, `marcarFalhou` e a nova leitura por id), passa a usar `requireEscolaId()` e sai de `REPOSITORIES_SEM_ESCOPO`. O payload leva só `{ execucaoId: uuid }` (§2). Conferi no código que a escola do job vem do `data` copiado da linha e que a linha é relida no escopo (`apps/worker/src/job-executor.ts`, de 189 a 240): job de outra escola dá `nao_encontrado` e não roda.
- **Item 3, rotas sem `escolaId` do cliente.** Não há rota nova (§4). `GET /v1/execucoes/:id` segue em `deQuemPediu`, com escola, ano e `solicitada_por` vindos do contexto. Na escolha de escola, `conferirLivre` roda antes de `#destinoDaConta` (`apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts:44`). Por isso o 503 com o Redis fora sai igual para qualquer `usuarioId` e não serve para descobrir vínculo. O destino continua vindo da conta do desafio assinado, nunca do cliente.
- **Itens 5 e 6.** Outra escola dá vazio e `NAO_ENCONTRADO`, sem resposta diferente. `execucaoId` é UUID por schema estrito.
- **Item 7, camada de rede.** Não se aplica. As métricas de IA não levam escola, salvo `ia.espera_estourada{escola_id}`, que é contagem e só o operador vê (§6).
- **Item 8, `@Unscoped`.** Só em `falharInterrompidas`, com justificativa escrita, a mesma de hoje.
- **Vagas.** São por fila e por escola, com a escola da linha (§5 "A fila", e `onda-3a.md`, "Filas separadas").
- **Limitador de tokens.** O balde é `provedor:modelo`, sem dado de escola na chave (§5).

**Teste de isolamento:** presente e efetivo. Há três testes (§6, e `onda-3a.md` §3):
- contexto da escola A lendo o id da B, com a mutação que tira o `escola_id`;
- job da A com o `execucaoId` da B, que deixa a execução `pendente` sem `fetch` e sem `consumo_ia`;
- quatro ferramentas da A, que não ocupam vaga da B, com a mutação da chave sem a escola.

Fiz a remoção mental: tirando a cláusula de escola do `marcarRodando`, a execução da B passa a `rodando` e o segundo teste fica vermelho. Tirando a escola da chave da vaga, o terceiro quebra.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Tech Spec §6.** Estender o teste "job da A com o `execucaoId` da B" a dois cenários. No primeiro, o relógio passa dos 20 s e a marcação `falhou IA_INDISPONIVEL` precisa sair escopada. No segundo, a execução da B está `rodando` na reentrega, e a marcação `EXECUCAO_INTERROMPIDA` com a gravação estimada em `consumo_ia` também precisa sair escopada. Cada cenário leva a sua mutação. Hoje só a passagem `pendente → rodando` tem prova direta.
2. **Tech Spec §7 e §10.** O `preparar` "repete a conferência de alcance que o `POST` fez", mas nenhum teste prova isso no worker. Sugiro uma execução cuja `entrada` cite um material ou uma turma da escola B, gravada direto no banco, que termine `NAO_ENCONTRADO` sem `fetch`. Sugiro também um professor que perdeu a turma entre o 202 e o job. A `entrada` persistida passa a ser a fronteira de confiança.
3. **Tech Spec §5, "A varredura `falharInterrompidas` vai para o `main-worker`".** Atualizar o motivo do `@Unscoped` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.repository.ts:65`, que ainda diz "varredura da subida da API". Também falta definir o corte `antesDe`, porque o `IA_EXECUCAO_TIMEOUT_MS` sai e a fila `ferramenta` não tem corte de espera. Sem isso, a varredura de uma réplica pode encerrar a `pendente` ou a `rodando` legítima de outra. Isso é com o `infra-guardian`.
4. **Tech Spec §2.** Declarar `escopo: 'escola'` na definição de `ia.executar` em `JOB_DEFINITIONS`. O campo é obrigatório e a spec não o cita.
5. **Tech Spec §5, "Os tokens".** O balde de 80 % é dividido entre a `interativa` e a `ferramenta` de todas as escolas, e só `normal` e `lote` param nos 50 %. Por tokens, a ferramenta de uma escola pode empurrar o Tutor de outra para o degrau. A vaga por escola limita, mas não garante. Isso é regra 80.3 e fica com o `infra-guardian` e o `llm-integrator`.

Documentos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3c.md`

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-15 01:19:27 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

**VEREDITO: REPROVADO**

Encontrei dois furos, e os dois atingem a pergunta de fechamento: "para onde o dado de um aluno, ou de um professor, já foi enviado". O resto do desenho garante o que a regra 20 pede.

**Campos pessoais tocados:** nenhum campo novo (Tech Spec §3 e §7, PRD §8). `job_registro.dados` passa a levar `{ execucaoId }`, e `consumo_ia` ganha a linha estimada da execução interrompida. A conversa fica só em `mensagem_tutor`. Conferi no código que `execucao_agente.entrada` já guarda os parâmetros da ferramenta, então o `preparar` relê do banco sem coluna nova.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha de `job_registro` passa a citar `ia.executar` (§7).

**Autorização por objeto:** ok.
- **Escola:** vem de `job_registro.escola_id`. O `ExecucaoRepository` sai de `REPOSITORIES_SEM_ESCOPO`. Conferi que hoje ele lê a escola do argumento, e o motivo registrado na guarda é exatamente esta troca.
- **Teste de isolamento:** o job da escola A com o `execucaoId` da escola B não roda, e tirar a cláusula de escopo deixa o teste vermelho (§6).
- **Pessoa:** o `preparar` reconfere turma, atividade e material, e relê o papel do vínculo ativo. `solicitada_por` nulo ou vínculo encerrado dá `NAO_ENCONTRADO` sem chamar o modelo (§5 "O contexto no worker", §7). Isso cobre a regra 20.18 e a eliminação antes do job rodar.
- **404 igual a sem permissão:** nenhuma rota nova (§4).

**Logs:** limpos no desenho. Só ids, tipo e código, nunca entrada, saída ou prompt (§7). `execucao_agente.erro` e `job_registro.codigoFalha` só aceitam código, e a borda de erro mostra o texto fixo de `FALHA_DA_AREA`.

**Auditoria:** nenhuma ação nova que a exija. A aprovação da saída de IA não muda: "a entrega nasce `pendente`" é testada antes de mover o `aoConcluir` (§5 "O comando").

**Envio externo:** o mesmo conteúdo de hoje, para o provedor de `IA_PROVEDOR_ID`, agora só no worker. Fica registrado em `execucao_agente` e em `consumo_ia` (`envio_externo`, `provedor`). O texto de aluno só sai com a declaração da D62 (§5 "A D62"). Duas lacunas no registro, abaixo.

**Seed/fixture:** sintético. A carga usa o adaptador falso, e o teste de hash dos prompts não usa dado real (PRD §6, §7c).

**Bloqueantes:**

1. **A execução interrompida pode sumir da lista de compartilhamento** (Tech Spec §8 e a linha `rodando` da tabela de estados em §5).
   - **O problema:** a reentrega grava em `consumo_ia` "a reserva estimada", mas a spec não diz o que vai em `envio_externo` e `provedor`.
     - Hoje só o gateway preenche esses dois campos, e só quando `tentativas > 0` (`packages/core/src/ia/llm-gateway.ts`, método `medir`).
     - Na linha da reentrega quem grava é o processador. O valor que o código já tem pronto é `SEM_ENVIO_EXTERNO`, descrito em `port.ts` como "chamada que nem chegou a sair".
     - Com o worker morto durante o `fetch`, a conversa do aluno pode ter chegado ao provedor. Mesmo assim, a linha diria que nada saiu.
   - **Por que importa:** o rastro do titular (`CompartilhamentoRepository.rastroDoAluno`) filtra por `c.envio_externo`. Essa chamada ficaria fora da resposta à escola e ao titular (LGPD art. 18, VII). O "a mais, nunca a menos" da D14 vale para tokens, e a spec não o estende ao destino.
   - **Correção exigida:** a §8 deve dizer que a linha estimada leva o envio do adaptador configurado (`envioExterno: true` e o `provedorId` quando ele é externo). Ou seja, superestima o envio como superestima o custo. A linha também leva `entrada` e `saida` nulas. E um teste prova que, depois do `kill -9` com o adaptador externo, a execução aparece no `rastroDoAluno` e na foto do compartilhamento.

2. **A conferência da D62 deixou de exigir as outras categorias enviadas** (Tech Spec §5 "A D62", PRD RF9).
   - **O problema:** o desenho herdado (`onda-3c.md`, "RF20 — a D62 na subida") exigia `conversa_do_aluno` **"e as outras categorias enviadas"**. A §5 desta spec lista só `conversa_do_aluno`. Como a spec diz que o desenho de outubro vale "onde esta spec não diz outra coisa", essa lista mais curta passa a valer.
   - **O efeito:** sobe um provedor declarado só com `conversa_do_aluno` que recebe também:
     - `conversa_do_professor` (`propor_ferramenta`, e o tema das ferramentas, que a linha `consumo_ia.entrada` do `docs/lgpd.md` trata como conversa do professor);
     - `material_da_escola` (trechos citados);
     - e, no Analista e na correção, `trabalho_do_aluno`.
   - **Por que importa:** a escola veria a empresa listada com categorias que não batem com o que ela recebe. O professor, como titular, recebe pelo `usoRealDoProfessor` uma resposta incompleta. Conferi que nenhum código confere `categorias` hoje, então não há outra camada que cubra isso.
   - **Correção exigida:** voltar à regra da onda-3c. Cada `TarefaDeIa` declara as categorias que envia, como já declara `levaTextoDeAluno`. Na subida da API e do `main-worker`, o suboperador vigente precisa conter a união das categorias das tarefas registradas. E um teste de subida por categoria que falte, além dos ramos já listados.

**Recomendações:**
- **Encerramento de suboperador com os workers no ar** (§5 "A D62"): a declaração só é conferida na subida. Se o operador encerra o suboperador com o worker rodando, o envio continua até reiniciar. Vale reconferir periodicamente, ou escrever no runbook que `ops:suboperador encerrar` exige reiniciar a API e os `worker-ia`.
- **Eliminação com a execução já `rodando`:** a onda-3a cobre só a execução pendente ("Usuário eliminado: depois do 202"). Falta o caso em que o `concluir` ou o registro de consumo chegam depois da eliminação: não pode recriar `mensagem_tutor`, sinal ou `aluno_id` ligados ao titular eliminado.
- **"Ver a pergunta que ficou sem resposta"** (PRD §4 e RF5): a frase pode ser lida como o professor vendo o texto. O `docs/lgpd.md` diz que nesta fatia o professor vê só o uso (`GET /v1/tutor/uso`), sem conteúdo. Vale trocar por "a troca sem resposta aparece no uso, sem o texto".
- **Degrau do modelo menor:** um teste de que `consumo_ia.modelo` grava o modelo menor quando ele atende (regra 30.4), para a resposta "o que a IA usou" continuar verdadeira.
- **Comentário desatualizado:** o comentário de `packages/core/src/db/schema/execucao-agente.ts` ("roda no processo da API… `TODO(fila)`") deve ser atualizado junto com o `docs/arquitetura.md`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3c.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/titular/compartilhamento.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/port.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/db/schema/suboperador.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/db/schema/execucao-agente.ts

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-15 01:19:48 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum nesta spec. Ainda não existe tabela `nota` no código. O único rastro é o comentário em `packages/shared/src/importacao/contratos.ts:12-15`, que já exige `lancadaPor` humano. Nenhum dos comandos que vão para o worker grava Nota: Tutor, ferramentas, `propor_ferramenta`, adaptação e Analista (as cinco closures de `apps/api/src/{tutor,artefato,assistente,governanca}`). Todos com autor humano? sim, porque não há caminho.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A adaptação continua a nascer com a entrega `pendente`, na mesma transação (`artefato.service.ts:186-187`). A Tech Spec §5 fixa isso num teste de caracterização antes de mover qualquer `aoConcluir`. As ferramentas continuam em autonomia 1, sem ir ao aluno (`ferramentas.service.ts:55`). A exceção da D47 continua só no Tutor.

Supervisão do tutor: lacuna na degradação do Tutor, no Bloqueante 1. O restante está garantido:
- A pergunta que espera mais de 20 s fica em `mensagem_tutor`, visível ao professor (PRD RF5, Tech Spec §5).
- A D36 e a S12 continuam no comando, com o sinal fora do `where estado = 'rodando'` e chave única por execução (Tech Spec §5, `onda-3a.md` §3, "D36 descartada").
- A avaliação aberta é conferida no `preparar` e de novo no `concluir`.
- A suspensão continua conferida a cada chamada no gateway, no contexto do worker (`llm-gateway.ts:117-119`). Por isso, um job já na fila não roda depois de a coordenação suspender a função.

Autonomia declarada e visível: sim, sem mudança. A spec não mexe no nível de nenhum agente nem na tela de governança.

Os demais itens da lista:
- **Item 6 (auditoria):** ok. A `execucao_agente` liga entrega e artefato, e o gasto grava o modelo que respondeu (`llm-gateway.ts:197`).
- **Item 7 (supervisão não é vigilância):** ok. A única métrica com escola é `ia.espera_estourada{escola_id}`, uma contagem que não diz nada do aluno.
- **Item 8 (D55):** ok. Não entra tarefa nem prompt novo (Tech Spec §8), e o hash por `versao` prova isso.
- **Item 9 (D45 e D64):** ok. As métricas de IA não levam usuário nem escola, o job leva só o `execucaoId`, e a conversa do professor continua só em `mensagem_agente`. O grupo mínimo da D45 está em `agregados()` (`analista.service.ts:100-104`), que o `preparar` reaproveita.

Bloqueantes:

1. **Tech Spec §5 ("Os tokens") e §7b, PRD §8b. A degradação muda o Tutor e a AIA não registra isso.**
   - **O que está errado.** O desenho põe a tarefa de perfil `rapido` no `LLM_MODELO_MENOR_<PERFIL>` quando o teto aperta, e o turno do Tutor é `rapido` (`turno-do-tutor.ts:625`). Mas o modelo é a segunda camada da D36: segundo `docs/aia/tutor.md:234-236`, a regra sozinha reconhece 37 de 75 frases de risco à vida, e com o modelo chega a 51. A mesma AIA (linhas 228-229) diz que essa medida vale só para o modelo medido e precisa ser repetida com o de produção.
   - **O efeito.** Um modelo menor configurado entraria no Tutor sem a medida de risco à vida e sem a suíte de recusa da regra 30.11 (`tutor-modelo.int.test.ts`). Isso muda o comportamento de uma funcionalidade de alto risco sem AIA nem teste que prove a regra (regra 70, itens 4 e 6a).
   - **Onde a spec deixa passar.** O PRD §8b diz que "a supervisão não muda" e que a AIA só atualiza "onde ele roda". A §7b limita a revisão de conformidade às tarefas de comando, worker e D62. Fica de fora a tarefa dos tokens e da degradação, que na X5 tinha veto de conformidade (`onda-3c.md` §5, tarefa 49.0).
   - **Correção exigida.**
     - (a) Escrever na §5 que, enquanto o modelo menor não passar pela mesma medida de risco à vida e pela suíte de recusa (o que depende da D37), o degrau do modelo menor é pulado para `turno_do_tutor`. A tarefa vai direto de 8 s de espera para `IA_INDISPONIVEL`, e um teste prova isso.
     - (b) O PRD §8b e a §7b passam a dizer que a AIA do Tutor registra a degradação como limitação conhecida. Ela cobre o modelo menor, quando houver, e também os turnos que terminam sem modelo (espera estourada, teto, recusa da D62): neles a camada do modelo da D36 não roda, e só a regra, aplicada antes da fila, continua valendo.
     - (c) A §7b inclui a tarefa dos tokens e da degradação entre as que o `conformidade-reviewer` revisa.

Recomendações:
- **D19 e D84 ainda não existem no código.** O PRD §6 diz que o Tutor desligado na escola (D84) ou fora da política da turma (D19) "não chega a criar job". Hoje não há política de Tutor por turma (`tutor.service.ts:421-422`). Vale escrever que, quando D19 e D84 entrarem, a conferência se repete no `preparar`, porque com a fila a janela entre o `202` e a execução cresce.
- **Teste da suspensão no caminho do worker.** Incluir na Tech Spec §10 este caso: função suspensa entre o `202` e o worker termina sem `fetch`, sem `consumo_ia` e sem contar a troca. O gateway já confere, mas nenhum caso da spec prova isso pela fila.
- **Modelo gravado na degradação.** Incluir na §10 um teste de que, quando o modelo menor responde, o `consumo_ia` e a execução gravam o modelo que respondeu, e não o principal. É o que sustenta "o que a IA gerou" na auditoria e na regra 30.4.
- **Nome da tarefa.** A Tech Spec §5 diz "chamar o gateway com o sinal da tentativa". Vale nomear a tarefa no comando do Tutor, para o `conformidade-reviewer` saber quais casos de `onda-3a.md` §3 o comando precisa cobrir primeiro: "D36 descartada" e "Avaliação abre no meio".

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3c.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/tasks/turno-do-tutor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/tutor/tutor.service.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-15 01:21:03 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor | IA | fila | prova | login (o RF13 cobre o segundo fator e a escolha de escola) | migration | deploy (dois `worker-ia` novos)
Rate limit: ok
Fila e prioridade: problema
Concorrência: corrida na Tech Spec §4 e §5, no corte de 20 s da `interativa`
Índice e paginação: ok
Degradação de IA: ok (falta o provedor de reserva, desvio declarado para o F5 na §11)
Migration: compatível
Métrica e alerta: ok

**Bloqueantes:**

1. **Tech Spec §4 e §5, tabela de estados, linha `pendente`: o corte de 20 s não tem dono.** A §4 diz que o `GET /v1/execucoes/:id` também devolve `IA_INDISPONIVEL` quando a espera estoura. A §5 diz que a execução passa a `falhou IA_INDISPONIVEL` após 20 s desde `criada_em`. Em nenhum lugar está escrito quem grava essa passagem nem com que relógio.
   - O que acontece às 10h: perto dos 20 s, o `GET` decide "estourou" e o processador faz `pendente → rodando` no mesmo instante. O aluno vê "indisponível", sem troca contada, e logo depois o modelo responde e a troca conta. É o padrão "busca, verifica, grava" sem trava.
   - Se o `GET` só calcular o estado na leitura, sem gravar, o `ia.espera_estourada{escola_id}` sobe a cada consulta (polling de 1 s) e o alerta "escola grande" dispara à toa.
   - Correção exigida:
     - O corte é uma única passagem condicional pelo relógio do banco: `update … set estado='falhou', erro='IA_INDISPONIVEL' where estado='pendente' and criada_em < now() - 20s`, aplicada por quem chegar primeiro (o `GET` e o processador).
     - O `pendente → rodando` do processador ganha a condição oposta, `criada_em >= now() - 20s`.
     - A métrica soma só quando o `returning` vem não vazio.
     - Teste de corrida com barreira entre o `GET` e o processador na fronteira dos 20 s: um só vence, um `fetch` no máximo, e a resposta que o aluno vê bate com o estado gravado. Mutação: tirar a condição de tempo do `pendente → rodando`.

2. **Tech Spec §5 ("Os tokens") e §7c ("Carga na manhã"): o Tutor pode esperar pelos tokens da ferramenta.** O balde é por `provedor:modelo`, com 80 % para `interativa` e `ferramenta` juntas; só a `normal` e o `lote` param nos 50 %.
   - A conta da §7c (~1,5 milhão de tokens por minuto, `docs/infra.md` §3.2) é só do Tutor e já ocupa quase todos os 80 % de um contrato de ~1,9 milhão. A ferramenta reserva de uma vez, antes da chamada, caracteres ÷ 4 + `maximoDeTokensDeSaida`, para chamadas de 50 s. Com 40 ferramentas rodando nas 10 escolas, esse consumo sai da parte do Tutor.
   - Às 10h o aluno cai no "espera 8 s, modelo menor, indisponível" por causa da prova que a professora está gerando. Isso contradiz o objetivo do PRD ("o Tutor em sala não espera pela ferramenta do professor"), o RF2 e o RF6 ("nenhum aluno vê indisponível"), e a prioridade que a regra 80.4 exige do limitador.
   - O cenário de carga não provaria nada: o `infra/carga.env` não define `LLM_TOKENS_POR_MINUTO`, e a `FASE=sala` nunca chega ao teto.
   - Correção exigida:
     - O `TokenLimiter` dá à `ferramenta` um teto próprio abaixo do da `interativa` (ou reserva uma fatia só para a `interativa`), e a §5 diz o que a ferramenta faz quando bate no teto dela.
     - A §7c soma os tokens de ferramenta e de proposta à conta do pico.
     - Teste: com a `ferramenta` no teto dela, o Tutor reserva sem esperar. Mutação: as duas filas no mesmo teto.
     - A `FASE=sala` roda com `LLM_TOKENS_POR_MINUTO` finito, num valor que force disputa.

3. **Tech Spec §2 (`llm-config.ts`) e §5 ("A varredura `falharInterrompidas` vai para o `main-worker`"): a varredura fica sem limiar.** A spec remove `IA_EXECUCAO_TIMEOUT_MS`, mas é dela que a varredura tira o limiar e o intervalo: `antesDe = agora − 2 × timeoutMs` e `setInterval(timeoutMs)`, em `packages/core/src/ia/executor.ts`. A varredura também derruba execução `pendente` antiga.
   - Na desenho novo, a `pendente` espera de propósito: a ferramenta não tem corte, e com o Redis de fila fora a §7c promete que ela "roda quando ele volta".
   - Sem limiar escrito, a réplica que sobe depois de um `kill -9` ou de um deploy pode encerrar o que a outra réplica está rodando, ou o que espera vaga legitimamente.
   - Correção exigida:
     - A §5 fixa o limiar em função do `prazoMs` da fila (por exemplo, 2 × 150 s para `rodando`) e o intervalo da varredura.
     - Para `pendente`: ou só encerra a que não tem job vivo em `job_registro`, ou declara o corte e corrige a promessa da §7c.
     - Teste com duas réplicas: a subida de uma não encerra a `rodando` da outra nem a ferramenta que espera vaga.

**Recomendações:**
- §3: o número `0050` já existe (`packages/core/drizzle/0050_material_envio_em_andamento.sql`); a próxima é a `0058`.
- §3 ou §13: dizer o que um rollback faz com os `ia.executar` em voo. O código anterior não tem processador para eles: o job dá `TIPO_DESCONHECIDO` e a execução fica `pendente` até a varredura antiga.
- §5: escrever a reserva estimada em `consumo_ia` na mesma transação da passagem `rodando → falhou` que vencer. A tabela não tem índice único por execução, e "grava se não há linha" é ler e depois gravar.
- §5 e RF11: a `fila-de-respostas` manda sempre `pendentes[0]` (`apps/web/src/areas/aluno/respostas.ts`, `proximoEnvio`). Dizer como o `PUT` estourado "não segura as outras" (vai para o fim da fila?) e prender isso com uma mutação.
- `IA_REPLICAS` precisa bater com o número de `worker-ia` do compose. Derivar do compose ou conferir no `tools/ci/compose.int.test.ts`, senão o seguro com o Redis fora passa do contratado.
- A D62 só é conferida na subida: um suboperador que perde a vigência com o processo de pé continua passando até reiniciar. Avaliar uma releitura periódica (é tema do `privacy-guardian`).
- `JOB_DEFINITIONS` do `ia.executar`: listar `filas: ['interativa','ferramenta','normal']` e o valor de `ferramenta` em `QUEUE_PRIORITY` (`packages/core/src/queue/job-outbox.ts`).

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/executor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/infra/carga.env

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 01:21:24 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos** (por RF, com caminho feliz, borda, permissão e isolamento):
- **RF1, IA no worker.** O turno do Tutor e cada ferramenta passam pela fila e concluem. O `AppModule` não tem `LLM_PROVIDER`. Cada `TarefaDeIa` tem o seu comando.
- **RF2, filas separadas.** Com 4 ferramentas rodando, a 5.ª espera e o Tutor da mesma escola responde. A escola B segue com as suas. `vagas.ferramenta` da escola sobrepõe o padrão.
- **RF3, entrega duplicada.** A entrega em corrida, as duas que leem `pendente` (com barreira, em paralelo), o worker morto e a entrega depois. O clique duplo no `POST` com a mesma `chaveEnvio` gera um job só.
- **RF4, D36 e S12 no worker.** O assunto delicado do modelo grava a mensagem e o sinal mesmo com a execução descartada, sem duplicar. A avaliação que abre no meio faz a troca não contar. O "quero sumir" por palavra-chave nunca entra na fila.
- **RF5, espera de 20 s.** Com 21 s a `interativa` termina indisponível, a troca não conta, o professor vê a pergunta e o alerta dispara. A ferramenta com 21 s roda. Caso de borda: o Redis volta antes ou depois dos 20 s.
- **PRD §6.** Tutor desligado, suspenso ou fora da política: recusa e nenhum job.
- **Contexto no worker.** Usuário eliminado, vínculo encerrado e alcance perdido entre o `202` e o worker. A virada de ano letivo.
- **RF7, tokens.** Um teste por degrau. O degrau sem modelo menor. A `normal` para nos 50 %. Duas réplicas em paralelo somam. Com o Redis fora, cada réplica fica com o teto ÷ réplicas.
- **RF8.** Uma métrica por degrau, os alertas e o runbook, e as métricas sem escola nem usuário.
- **RF9 e RF10, D62.** Na subida, um teste por ramo e um com o banco fora. Na chamada: marca ligada e provedor sem a declaração, nenhum envio. As tarefas que levam texto de aluno declaram isso. Uma tarefa sem a marca não compila.
- **RF11, prazo da web.** Cada tipo de prazo. O cancelamento sem erro na tela. O `PUT` da prova pendurado, sem travar as outras questões. A guarda do lint.
- **RF12.** Um componente que lança na raiz mostra a tela de falha.
- **RF13, Redis fora.** O segundo fator e a escolha de escola dão 503 sem gastar tentativa, e a web espera o `Retry-After` uma vez.
- **§6, isolamento.** O repository e o job da escola A com o `execucaoId` da B.

**Cobertos** (pelo §10 da Tech Spec, mais o §3 de `onda-3a.md` e de `onda-3c.md` herdados):
- **RF2:** a tabela "Filas separadas" tem as mutações.
- **RF3:** quase todo. "Duplicado em corrida" e "As duas leem `pendente`" são concorrência de verdade, com barreira e mutação.
- **RF4:** a "D36 descartada" é feita pelo modelo. As chaves únicas `sinal_tutor_um_por_execucao` e `mensagem_tutor_uma_por_execucao` já existem no schema e sustentam a deduplicação.
- **RF5:** a parte do relógio falso.
- **RF7:** quase todos os degraus.
- **RF8:** os alertas e `alerta-tem-runbook`.
- **RF9:** todos os ramos e o banco fora.
- **RF13:** o 503 e o `etapas-do-login.test.ts`.
- **RF1:** o teste de composição da §13.
- **§6:** o isolamento, com a mutação do `escola_id`.
- **Regra 30:** em todo lugar os testes usam o adaptador falso ou o `servidor-llama-falso`, e a carga roda com o falso.

**Bloqueantes:**

1. **§10 e RF4: não há harness de teste que passe pela fila de verdade.**
   - Hoje 23 usos em cerca de 10 suítes de integração tiram o `InProcessAgenteExecutor` de `EXECUTOR_DE_AGENTE` (por exemplo, `tutor.int.test.ts:162`, `ia.int.test.ts`, `entrega.int.test.ts` e `governanca.int.test.ts`). A §2 diz que ele sai, mas a spec não diz o que entra no lugar nos testes.
   - Se cada suíte chamar o `ExecucaoProcessor` direto, "os testes de hoje passam pela fila" (RF4) vira um atalho que esconde a regra: o outbox, o despachante e a vaga ficam de fora.
   - **Correção:** nomear na §10 o harness, isto é, um helper que publica pelo outbox e consome com o `JobExecutor` real contra o Redis de teste. Dizer que as suítes de D36, S12, entrega e governança migram para ele.

2. **§5 e §7: as cláusulas novas do "contexto no worker" não têm teste.**
   - A tabela herdada só tem "Usuário eliminado". Ficam sem caso:
     - o vínculo encerrado entre o `202` e o worker (professor que saiu, aluno transferido);
     - o "papel relido do vínculo ativo", que a §5 diz e que a `onda-3a` dizia ser do `usuario`;
     - "o `preparar` repete a conferência de alcance (turma, atividade, material)" para as ferramentas, e não só para o Tutor.
   - **Correção:** um caso por cláusula, com a mesma asserção para todos: `NAO_ENCONTRADO`, nenhum `fetch` e nenhum `consumo_ia`. Mutação de cada um: tirar a conferência do `preparar`.

3. **PRD §6: duas regras de negócio sem teste na §10.**
   - **(a)** "A mensagem fixa nunca espera vaga": o `#encaminhar` de `tutor.service.ts:369` hoje é síncrono. Se ele passar a usar o `agendar`, nenhum teste listado fica vermelho, porque o harness drena a fila.
     - **Correção:** um teste com a `interativa` da escola cheia, ou com o Redis de fila fora. O "quero sumir" responde `concluida` no próprio `POST`, com CVV e sinal, e sem nenhuma linha `ia.executar` em `job_registro`.
   - **(b)** O Tutor desligado (D84), suspenso (D9) ou fora da política (D19) não cria job.
     - **Correção:** para cada um, a recusa e zero linhas `ia.executar`. Mutação: gravar o job antes da conferência.

4. **§5 (`agendar`) e item 6: falta concorrência de verdade no clique duplo.**
   - Pelo desenho, um segundo job para a mesma execução que a encontre `rodando` grava `EXECUCAO_INTERROMPIDA` ("Duplicado em corrida"). Um clique duplo que gere dois jobs mata a execução viva do aluno.
   - A garantia é o `enfileirarUmaVez` com a chave `execucaoId`, junto com o `onConflictDoNothing` da `chaveEnvio`, e nenhum teste a prova.
   - **Correção:** dois `POST` com a mesma `chaveEnvio` em `Promise.all`, no Tutor e numa ferramenta. Resultado esperado: uma execução, uma linha em `job_registro`, um `fetch`, estado `concluida` e não `interrompida`. Mutação: uma chave de job aleatória.

5. **RF5 e §7c ("Quando cada dependência cai"): a spec se contradiz no Redis fora.**
   - A §7c e o caso "Redis fora" da `onda-3a` §3 dizem que o `POST` dá 202 e que "o Redis volta e a resposta chega". Com o corte de 20 s da `interativa`, isso só vale se o Redis voltar antes de 20 s.
   - O teste herdado não fixa a duração e pode codificar o comportamento errado.
   - **Correção:** dois casos.
     - O Redis volta antes de 20 s: a resposta chega.
     - O Redis volta depois de 20 s: `IA_INDISPONIVEL` sem modelo, a troca não conta, a pergunta fica visível ao professor e `ia.espera_estourada` sobe.
   - Dizer também quem grava o corte (o processador na entrada, com `update … where estado = 'pendente'`) e com que relógio. `criada_em` é `defaultNow()` do Postgres (`execucao-agente.ts:67`), e um relógio falso só no processo não move esse valor. O teste precisa gravar `criada_em` no passado, ou o corte precisa comparar com o `now()` do banco. Com relógio falso só no processo, o teste "a de 21 s" não chega à cláusula.

6. **RF5: falta a asserção de que o professor vê a pergunta (regra 70.4 e D8).**
   - O caso "Fila cheia" da `onda-3a` confere `IA_INDISPONIVEL`, a troca e a métrica. Não confere que a pergunta aparece ao professor na supervisão da turma.
   - **Correção:** acrescentar essa asserção, pela leitura de supervisão do professor.

7. **RF10: a marca `levaTextoDeAluno` não tem valor fixado por tarefa.**
   - Um campo obrigatório do tipo `boolean` com `turno_do_tutor: false` compila e passa por todos os testes listados, e a D62 deixa de valer em silêncio.
   - **Correção:** um teste que fixa a marca de cada uma das 7 `TAREFAS_DE_IA` (`packages/shared/src/time/execucao.ts:26`). No mínimo `turno_do_tutor` é `true`, e cada `false` vem com justificativa.
   - "Não compila" precisa de um `@ts-expect-error` ou de um `expectTypeOf` que o typecheck da esteira leia. Há o padrão em `job-definitions.test.ts` e em `llm-gateway.test.ts`.
   - Também falta o caso positivo: o adaptador falso e o local, com a marca, passam. Sem ele, a definição de "declaração conferida" fica aberta e quebra todas as suítes do Tutor.

8. **RF7: o degrau "sem modelo menor configurado" não tem teste.**
   - É a cláusula nova da decisão do Joaquim, e até a D37 é o caminho que roda em produção.
   - **Correção:** um caso sem `LLM_MODELO_MENOR_<PERFIL>`. Esperado: 8 s, depois `IA_INDISPONIVEL` direto, a troca não conta e a métrica do degrau pulado sobe. Mutação: tentar o modelo principal no lugar do menor.

9. **RF11 e RF12: faltam na §10 os testes de web que o PRD exige.**
   - **(a)** Prova com um `PUT` pendurado. Com relógio falso, ele estoura em 10 s, volta à `fila-de-respostas.ts` e as outras questões gravam.
[… 25 linhas cortadas]

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-15 01:21:46 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 "A D62" (categorias do suboperador, contra `onda-3c.md` RF20) e em §5 "A web" (conta com um "Voltar ao início" que não existe no código)
Portão local: não se aplica. A revisão é de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta fase.

Bloqueantes:

1. **§5, tabela de estados, linha `pendente`, e §4: a espera de 20 s não diz quem grava o corte nem com que relógio.** A Tech Spec diz duas coisas. Pela tabela, a execução que passa de 20 s "sem chegar ao processador" vira `falhou IA_INDISPONIVEL`. Pela §4, o `GET /v1/execucoes/:id` "também dá `IA_INDISPONIVEL` na espera estourada". Hoje o `ExecucoesService.ler` só lê. O job que nunca chega ao processador (despachante atrasado, Redis de fila fora) não tem ninguém que grave o `falhou`, então o `GET` teria de deduzir o estado na leitura. Se ele deduz, e o `pendente → rodando` do processador continua sendo só `where estado = 'pendente'` (como a §5 escreve), o aluno vê "indisponível" aos 20,5 s e a resposta chega depois. A troca então conta, o que viola o RF5 e a regra 80.7. E se o `GET` grava, o `ia.espera_estourada` soma uma vez por consulta.
   **Correção exigida:** escrever que o corte é uma transição condicional no banco, pelo relógio do Postgres. O processador só pega com `where estado = 'pendente' and criada_em > now() - 20 s` (interativa) e, fora disso, grava `falhou IA_INDISPONIVEL` sem modelo. Escrever também quem encerra o job que nunca chegou: o `GET` lê pelo mesmo predicado ou faz o mesmo `update` condicional, e a métrica soma só na transição. O teste da §10 precisa ter a mutação "processador sem a cláusula de idade".

2. **§5 (linha `rodando`) e §8: não há de onde tirar o "consumo estimado" da execução morta.** O RF3 e a D14 exigem que a reentrega grave a reserva estimada em `consumo_ia`. Na `onda-3a.md` essa reserva vinha da porta própria `LimiteDeTokens`. A Tech Spec troca a porta pelo `RateLimiterRedis`, com o balde por `provedor:modelo`. Esse balde não guarda nada por execução, e a §3 proíbe coluna nova. A reentrega, que sai "sem modelo", fica sem o número que precisa gravar.
   **Correção exigida:** dizer como a reentrega calcula a estimativa. Duas saídas possíveis: rodar `preparar` + `montarPedido` sem modelo e fazer caracteres ÷ 4 + `maximoDeTokensDeSaida`, ou usar um teto declarado por tarefa. Dizer também como fica a linha dupla quando o processo original estava vivo, sem o lock, e grava o consumo real. Pôr o caso no teste do RF3.

3. **§5 "A D62": o suboperador passa a ser conferido só pela categoria `conversa_do_aluno`, contra o desenho herdado.** A `onda-3c.md` (RF20) exige `conversa_do_aluno` **e as outras categorias enviadas**. O mesmo provedor recebe `conversa_do_professor` (Assistente) e `material_da_escola` (trechos), e a lista de compartilhamento do titular (LGPD, art. 18, VII) sai do cadastro do suboperador. A Tech Spec diz que o desenho de outubro vale "onde esta spec não diz outra coisa". Aqui ela diz outra coisa sem registrar a mudança.
   **Correção exigida:** voltar a exigir todas as categorias que as tarefas mandam ao provedor, com um caso por categoria em `config.test.ts`. A outra saída é declarar o estreitamento e o motivo na §11 e no PRD, com aceite do `privacy-guardian`.

4. **§5 "A web" (o `main.tsx`) e §9: a tela de falha da raiz depende de um "Voltar ao início" que não existe.** O `FALHA_DA_AREA` (`apps/web/src/routes.tsx:63`) tem só título, título da aba e texto. O componente `Falha` (`apps/web/src/components/AreaErrorBoundary.tsx`) tem só o "Tentar de novo", que recarrega a página. O RF12 pede "o caminho de volta". Para entregá-lo, o componente muda, e isso altera a tela de falha de todas as áreas. Mesmo assim, a revisão desta rodada tirou `components/AreaErrorBoundary` da tabela da §2, e a §9 diz "a `AreaErrorBoundary` de hoje".
   **Correção exigida:** pôr a mudança do `AreaErrorBoundary` de volta na §2 e dizer o que a tela da raiz mostra (o texto e o destino do "Voltar ao início"), e se a mudança vale também nas áreas. A §10 precisa de um teste da raiz que cubra o caminho de volta.

Recomendações:
- **§3:** a "Migration 0050" já existe (`0050_material_envio_em_andamento.sql`). As migrations vão até a 0057, então esta é a 0058, ou escreva só "a próxima".
- **Pela herança da `onda-3a.md`, o `worker-pdf-1` iria para o `main-worker`.** Na F4 ele ficou em `apps/worker` (`infra/compose.yml:473`, `executor: 'worker'`). Diga com todas as letras que ele fica lá.
- **A varredura `falharInterrompidas`:** o limite dela é o dobro do `IA_EXECUCAO_TIMEOUT_MS` (`packages/core/src/ia/executor.ts`), variável que a §2 remove. Diga qual prazo passa a valer. Diga também que, com o Redis de fila fora por mais tempo que esse prazo, a execução `pendente` cai, o que contradiz o "roda quando ele volta" da §7c.
- **§5, a D36 no comando:** "fora do `where estado = 'rodando'`" não basta. Hoje o `concluirRodando` falso lança dentro da mesma transação e desfaz tudo. Escreva que o sinal e a mensagem fixa são gravados mesmo assim (em transação própria, ou sem lançar).
- **§5, a D62 por chamada:** diga que o falso e o local contam como "declaração conferida", senão o Tutor é recusado no desenvolvimento, no e2e e no k6. Diga também se um suboperador encerrado depois da subida é percebido ou se vale só a fotografia da subida. Sem essa leitura, a recusa por chamada não acrescenta nada em produção.
- **O campo `levaTextoDeAluno`** já existe e já é obrigatório (`packages/core/src/ia/task.ts:65`, `tarefas.test.ts`). O "não compila" do RF10 já vale hoje, e o que falta é só a recusa no gateway. Vale dizer isso.
- **§1 e §5 "Os tokens":** o `RateLimiterRedis` em `packages/core` substitui a porta sobre o `ContadorEmJanela` da `onda-3c.md`. Diga que é uma troca deliberada (D81), para quem ler as duas não achar que é engano.
- **PRD, RF3:** "fica `interrompida`" não é um estado. O estado é `falhou` com `EXECUCAO_INTERROMPIDA`. Alinhe o texto com a tabela da §5.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3a.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia/onda-3c.md`

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-15 02:37:31 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não (revisão de spec, sem tela nova; o desenho foi lido contra `AreaErrorBoundary.tsx`, `routes.tsx` e `client.ts`)
Estados: ok. Carregando, vazio e com dado não mudam. Erro: a falha da raiz, o `ErrorState` com "Tentar de novo" para `TEMPO_ESGOTADO` e o aviso da espera estão desenhados (techspec §5 "A web" e "O Redis fora", §9).
Acessibilidade: ok, com uma recomendação. O aviso da espera é `role="status"`, o "Voltar ao início" tem alvo de 44 px, e a `Falha` já leva o foco ao título.
Chromebook fraco: sem impacto. Nenhuma lista nova. O teto de 10 s de espera é curto e a espera não repete.
Celular: ok. O cenário §7 tem o caso E no projeto `celular` a 360 px (`Falha` e aviso, sem rolagem horizontal, alvos de 44 px, texto em português).
Ação oficial protegida: sim, sem mudança. Esta spec não mexe em aprovação de nota.

**Os três itens da rodada 1 entraram.**

1. **Tela de falha na raiz.** A techspec §5 diz que um `AreaErrorBoundary paginaInteira` envolve as `<Routes>` inteiras. Cobre entrada, sala pública, troca de senha e sistema. O cenário §7 testa um componente que lança em cada uma dessas rotas. Hoje o código só tem a fronteira por área (`routes.tsx:138`, `:196` e `:216`), então o que a spec descreve ainda está por construir.
2. **"Voltar ao início".** `Falha` hoje não tem esse botão (`AreaErrorBoundary.tsx:39-51`). A spec o adiciona em toda área, com link para `/` e alvo de 44 px. `FALHA_DA_AREA` sai de `routes.tsx` para `components/`, para a raiz poder importá-lo.
3. **Espera do `Retry-After`.** A spec desenha: espera de até 10 s, uma vez, botão desabilitado e aviso `role="status"`. Um `Retry-After` maior que 10 s, ou um segundo 503, mostra o `ErrorState` sem nova espera. O seletor mantém a escola atual. O cenário §7 cobre 3 s, o segundo 503 e 30 s. O cliente já expõe `esperaSegundos` (`client.ts:7` e `:54-56`), então o dado existe.

**Buraco novo:** nenhum bloqueante.

Bloqueantes: nenhum.

Recomendações:
- **Aviso da espera (techspec §5):** "Tentando de novo em N s" não deve ser anunciado a cada segundo pelo leitor de tela. Anuncie uma vez (texto fixo "Tentando de novo em instantes" no `role="status"`) e deixe a contagem visual com `aria-hidden`.
- **"Voltar ao início" na raiz:** o boundary raiz pode ficar fora do `Router`. Use `<a href="/">`, que também refaz a árvore depois de uma falha, em vez de `<Link>`. Se a spec usar `<Link>`, o teste do cenário §7 precisa montar o boundary dentro do `BrowserRouter`.
- **`DrawerContext` fora da casca:** a `Falha` da raiz usa `useContext(DrawerContext)` (`AreaErrorBoundary.tsx:32`). Confirme que o valor padrão do contexto tem um `fechar` que não faz nada, e cubra isso no teste da raiz.
- **Rótulo do botão:** "Tentar de novo" na `Falha` recarrega a página. Na raiz isso é adequado.

## llm-integrator · 2ª rodada · AJUSTES NECESSÁRIOS · 2026-11-15 02:37:55 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: nenhum novo. As tarefas mantêm os perfis de hoje, `turno_do_tutor` e `propor_ferramenta` no `rapido` e as geradoras no `padrao`. O modelo menor é do mesmo perfil, configurado em `LLM_MODELO_MENOR_<PERFIL>`, e portanto não troca de perfil. Não verifiquei o perfil de cada tarefa.

Custo estimado por professor/mês: a spec não adiciona chamada de modelo, e o §8 diz "o custo é o de hoje", o que é coerente. Mas o §8 não traz o número por professor por mês nem o custo do modelo menor, que é uma fonte nova de custo. Sem esse número a precificação segue em chute (D39, D41).

Prompt versionado: sim. O §5 fixa o hash de cada prompt contra a `versao` antes de mover os `aoConcluir`.

Validação de schema: sim, sem mudança. As tarefas mantêm `esquemaDeSaida`.

Aprovação humana no caminho: sim. A entrega nasce `pendente` e o §5 caracteriza isso em teste. O Tutor segue como a exceção da D47.

O que confere com a porta, os perfis e o gateway de hoje:
- `consumo_ia` já tem o campo `modelo` (`packages/core/src/ia/consumo.ts`), então gravar o modelo que respondeu cabe sem mudar o formato.
- `levaTextoDeAluno` e `levaTextoLivreDePessoa` já existem em `task.ts`. `categoriasEnviadas` é campo novo, na mesma linha.
- A linha estimada da execução interrompida, com `entrada` e `saida` nulas, bate com a regra de hoje. As tarefas de texto livre já não gravam entrada nem saída no consumo.
- O Tutor sem degrau de modelo menor tem teste e mutação em `cenarios.md`.
- O modelo menor vem do mesmo provedor e passa pela mesma D62.
- O balde da ferramenta (15 %) e o da normal (10 %) deixam ao Tutor pelo menos 55 % do contratado.

Bloqueantes:
1. Techspec §5 ("Os tokens") contra §5 ("Os estados"): a espera da ferramenta subiu para 30 s e o orçamento de tempo sumiu.
   - A versão anterior dizia que o orçamento da 48.0 (56 s e 136 s) já incluía os 8 s de espera. Essa frase saiu do texto.
   - O corte do perfil `padrao` é de 140 s, e o `prazoMs` do job é de 150 s. Uma ferramenta que espera 30 s no limiter e depois chama o modelo pode passar de 150 s.
   - Nesse caso o job estoura, a reentrega acha `rodando` e grava `EXECUCAO_INTERROMPIDA` com consumo estimado. O modelo, porém, pode ter respondido e gasto tokens de verdade. O resultado é resposta perdida e consumo em dobro, justamente no caminho em que a escola está no teto.
   - Correção exigida: dizer na spec se a espera do limiter conta dentro do corte do perfil (então o corte da chamada é o corte menos a espera) ou fora (então o `prazoMs` de `ia.executar` sobe para pelo menos 140 + 30 s mais margem, e o corte da varredura de 300 s é revisto). Pôr um teste de relógio falso em `cenarios.md`: espera de 30 s seguida de chamada de `padrao` no corte, que termina com `IA_INDISPONIVEL` ou `concluida`, nunca `EXECUCAO_INTERROMPIDA`.

Recomendações:
- PRD RF7 e Techspec §5 divergem. O PRD ainda diz que o trabalho que não é do Tutor nem da ferramenta "usa até metade dele". A Tech Spec e `cenarios.md` dizem 10 % para a `normal`. Alinhar o PRD à Tech Spec.
- `maximoDeTokensDeEntrada` não existe em `task.ts`, que só tem `maximoDeTokensDeSaida`. É campo novo e obrigatório por tarefa, mas o §2 (linha de `packages/core/src/ia/`) e o §8 ("nenhuma tarefa nova") não o listam. Acrescentar ao §2 e a um teste do tipo "tarefa sem o teto não compila".
- O custo em reais depende da tabela de preço constante no código (D41, `consumo.ts`). O modelo menor precisa de linha nela. Sem a linha, `consumo_ia` do degrau grava custo zero ou incorreto. Pôr um teste: modelo sem preço na tabela falha na subida ou grava custo conservador.
- A estimativa por tarefa (chamadas por professor por mês, perfil, custo) deveria entrar no §8 ou ser remetida a `docs/avaliacao-de-modelos.md`. Os "~2.000 tokens por proposta" do §12 são premissa não verificada.
- O limiter reserva por estimativa de caracteres ÷ 4 e "acerta pelo uso real". A execução interrompida não devolve nem acerta a reserva. Registrar que o balde superestima por até 1 minuto depois de um `kill -9`.

Documentos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`, `prd.md`, `cenarios.md`, e `packages/core/src/ia/task.ts`, `consumo.ts`, `perfis.ts`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 02:38:24 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

A correção da rodada 1 entrou. As outras três correções desta rodada (a D36 numa transação própria, o corte dos 20 s e a execução interrompida) não abriram buraco na regra 70.

**A correção exigida na rodada 1**
- **Tech Spec §5 "Os tokens":** "O `turno_do_tutor` pula o modelo menor até ele passar pela medida de risco à vida e pela suíte de recusa". O pulo vale sempre que a tarefa é `turno_do_tutor`, sem depender de configuração. Para liberar o modelo menor no Tutor é preciso mudar o código, e essa mudança passa por revisão.
- **cenarios.md §4:** tem o caso "`turno_do_tutor` sem vaga pula o modelo menor e termina `IA_INDISPONIVEL`", com a mutação "permitir o degrau no Tutor".
- **A AIA:** o PRD §8b e a Tech Spec §7b registram como limitação o turno que termina sem modelo (espera, teto, D62), em que só a regra da D36 vale. Isso bate com `docs/aia/tutor.md`, onde o modelo soma à regra no risco à vida (limitação da 94.0).
- **O revisor:** a Tech Spec §7b põe o `conformidade-reviewer` nas tarefas de tokens, e o PRD §8b nas do RF7.

**As outras correções da rodada, olhadas pela regra 70**
- **A D36 numa transação própria (§5 "A D36 e a S12"):** fica melhor do que antes. O sinal ao professor e a mensagem fixa sobrevivem à execução encerrada. O cenarios.md §2 traz a mutação "gravar o sinal dentro da conclusão condicional" e o caso da reentrega com sinal único. A conferência do assunto delicado continua antes da fila, sem job (§2, fila cheia e Redis fora).
- **O corte dos 20 s:** termina sem modelo, sem resposta ao aluno e sem contar a troca. O professor vê a troca sem resposta no uso da turma (cenarios.md §1). Não existe uso de IA que o professor deixe de ver, porque nenhuma saída de IA chegou ao aluno.
- **A execução interrompida:** a conclusão condicional impede que a resposta do processo original, se ele ainda estiver vivo, chegue ao aluno. A linha estimada em `consumo_ia` só conta custo e envio, não produz saída.

Caminhos de escrita em Nota: nenhum novo. A spec não toca em `Nota`, e o `relatorio_da_correcao` fica sem comando nem chamador (§5 "O comando") — todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A cenarios.md §1 caracteriza "a entrega nasce `pendente`" no assistente e no artefato, antes e depois de o `aoConcluir` ir para o worker. A exceção da D47 continua só no Tutor.
Supervisão do tutor: ok. Nada muda na supervisão (§7b). A troca sem resposta aparece ao professor (cenarios.md §1). Tutor desligado (D84), função suspensa (D9) ou fora da política da turma (D19) não cria job (cenarios.md §2).
Autonomia declarada e visível: sim. Nada muda; o degrau de modelo não altera o nível de nenhum agente.

Os demais itens da lista:
- **Auditoria (item 6):** fica melhor, porque `consumo_ia` passa a gravar o modelo que respondeu (§5 e cenarios.md §4).
- **Vigilância (item 7):** a única métrica com escola é `ia.espera_estourada{escola_id}`, uma contagem, e nenhuma métrica leva usuário. Não há métrica de comportamento.
- **D55 (item 8):** a recusa por regra fixa (`propor-ferramenta.ts`) e a conferência da saída (`conferir`/`validar` no `llm-gateway.ts`) ficam na definição da tarefa e no gateway, e valem para qualquer modelo, inclusive o menor.
- **Medir o professor (item 9):** não há métrica por professor. O "custo de base por professor" é número de relatório de carga com dado sintético, fora do produto.

Bloqueantes: nenhum

Recomendações:
- **Citar a fonte certa no gate (§5 "Os tokens"):** a trava do Tutor cita "(D37)". Citar também a D36 e a regra 30.11, que são de onde vem a exigência. Dizer onde a medida fica registrada (`docs/avaliacao-de-modelos.md`) e que liberar o degrau no Tutor pede uma decisão registrada, não só configuração.
- **Um caso para o degrau nas outras tarefas (cenarios.md §4):** mostrar que, no modelo menor, a saída passa pela mesma conferência. Por exemplo, `propor_ferramenta` com saída que traz nota é recusada (D55), e `adaptar_atividade` com gabarito trocado também. O desenho já garante isso porque a conferência está no gateway; o teste deixa isso fixado contra uma refatoração futura da degradação.
- **A mensagem fixa na D36 com execução encerrada (cenarios.md §2):** dizer o que o aluno vê quando a mensagem fixa e o "Tentar de novo" chegam juntos, para que o CVV não fique escondido atrás do erro.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/tasks/propor-ferramenta.ts

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-15 02:39:00 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

**VEREDITO: REPROVADO**

**Correção 1 (o rastro):** feita só pela metade. A linha estimada em `consumo_ia` com `envio_externo` e `provedor`, `entrada` e `saida` nulas, foi escrita (Tech Spec §8), entra no rastro (§7) e grava na mesma transação (§5, tabela de estados). O teste também existe, com mutação, com o caso do local e com o caso das duas linhas (cenarios.md §3). O `rastroDoAluno` de hoje (`packages/core/src/titular/compartilhamento.repository.ts`, `alunoTrailStatement`) acha a linha pelo `solicitada_por`, mesmo quando `aluno_id` fica nulo. Isso fecha o caso de quem pega o job de novo depois que o worker morre. Não fecha o caso da varredura, que é o bloqueante abaixo.

**Correção 2 (a D62):** feita. Cada tarefa declara `categoriasEnviadas`, e a subida confere a união delas (Tech Spec §5, "A D62"). O teste tem um caso por categoria faltando e a mutação "conferir só `conversa_do_aluno`" (cenarios.md §5). A falha restante é a recomendação 1.

```
VEREDITO: REPROVADO
Campos pessoais tocados: nenhum novo. Muda o que vai em consumo_ia (linha estimada da execução interrompida: envio_externo, provedor, tokens do teto, entrada e saida nulas) e no job_registro (tipo ia.executar, payload só com execucaoId)
Fora da tabela de dados do docs/lgpd.md: nenhum campo. A linha de consumo_ia (docs/lgpd.md:99) diz que provedor é "nulo na chamada que falhou antes de sair", e a linha estimada grava o provedor mesmo sem saber se o envio saiu (ver recomendações)
Autorização por objeto: ok. O preparar repete o alcance do POST, a suspensão e o vínculo, e trata pessoa eliminada, ano virado e alcance perdido com NAO_ENCONTRADO, sem modelo e sem consumo_ia (Tech Spec §5 "O contexto no worker"; cenarios.md §1 e §6)
Logs: limpos. Ids, tarefa e código; ia.geracao.soberania_recusada sem conteúdo (Tech Spec §7)
Auditoria: presente. Nenhuma ação nova que a regra 20.10 cubra
Envio externo: o de hoje, ao IA_PROVEDOR_ID, só com o suboperador BR, com treinamento vedado e com a união das categorias. Registrado em consumo_ia e no rastro na chamada normal e na reentrega. Na interrompida que a varredura encerra, não está registrado
Seed/fixture: sintético, com o adaptador falso (cenarios.md, abertura)
Bloqueantes: 1
Recomendações: 4
```

**Bloqueante**

1. **A `rodando` que a varredura encerra não deixa linha no rastro** (Tech Spec §5 "A varredura", §8; cenarios.md §1 e §3).
   - **O que está errado:** o §8 diz que "a execução interrompida grava, na transação que a encerra" a linha estimada. Mas o único caminho desenhado e testado é a reentrega com a execução em `rodando`. A varredura encerra com `EXECUCAO_INTERROMPIDA` a `rodando` com mais de 300 s, e é a rede de segurança justamente para quando a reentrega não acontece (o job deixou de ser reentregue, ou o Redis de fila perdeu o job). Essa execução pode ter chegado ao provedor antes do worker morrer.
   - **O conflito:** o motivo atual do `@Unscoped` (`apps/api/src/ia/execucao.repository.ts:65`) diz que a varredura "grava só estado, código e data". A spec manda reescrever esse motivo sem dizer que agora ela também grava `consumo_ia`. O caso da varredura em cenarios.md §1 não confere linha nenhuma, e o §3 só cobre a reentrega.
   - **Por que reprova:** é a pergunta de fechamento. "Para onde isso já foi enviado" pode responder a menos, e o desenho promete "nunca a menos" também para o destino.
   - **Correção exigida:**
     - O §5 "A varredura" diz que a `rodando` encerrada por ela grava a linha estimada (teto da tarefa, `envio_externo` e `provedor` do adaptador configurado) na mesma transação e na escola da linha.
     - A `pendente` encerrada não grava, porque nunca passou do `pendente → rodando` que vem antes do `fetch`.
     - O motivo do `@Unscoped` passa a dizer isso.
     - O cenarios.md §3 ganha o caso: varredura com adaptador externo e uma `rodando` de 301 s dá uma linha com `envio_externo` e `provedor`, que aparece em `rastroDoAluno`; a `pendente` encerrada não gera linha. Mutação: a varredura não grava a linha.

**Recomendações**

1. **Fixar `categoriasEnviadas` de toda tarefa, não só do `turno_do_tutor`** (cenarios.md §5).
   - O valor ficou fixado em teste só no Tutor. O caso "um por categoria" itera sobre a união, que sai das próprias declarações. Se `resumo_do_analista` ou `relatorio_da_correcao` deixarem de declarar `trabalho_do_aluno`, a subida aceita um suboperador sem essa categoria e o teste passa.
   - Proposta: estender o `DECLARADO` de `packages/core/src/ia/tasks/tarefas.test.ts` com as categorias de cada tarefa. Também vale exigir que `levaTextoDeAluno: true` implique `conversa_do_aluno` ou `conversa_do_professor` na declaração.
2. **Atualizar a linha de `consumo_ia` no `docs/lgpd.md` (linha 99), não só a do `job_registro`** (Tech Spec §7).
   - Hoje ela diz "provedor nulo na chamada que falhou antes de sair". A linha estimada da interrompida grava o provedor sem saber se o envio saiu. É uma superestimativa deliberada, e o texto precisa dizer isso.
   - O arquivo do titular também pode marcar a entrada como estimada, para a escola não afirmar ao titular um envio que pode não ter saído.
3. **Dizer se a linha estimada do Tutor leva `aluno_id`, e provar que o freio diário não a conta** (Tech Spec §8).
   - O comentário de `consumo-ia.ts` diz que o freio conta as linhas por aluno no dia. O RF3 diz que a troca interrompida não conta.
   - O rastro funciona com ou sem `aluno_id`, porque acha a linha pelo `solicitada_por`. A dúvida é a regra do freio (D38), não um vazamento.
4. **Alinhar o texto do RF9 no PRD**, que ainda cita só a categoria "conversa do aluno". A Tech Spec já confere a união das categorias.

Fora o que mudou, não achei buraco novo:
- **A métrica `ia.espera_estourada{escola_id}`:** só conta, sem pessoa (PRD §8).
- **A troca sem resposta:** o professor a vê no uso, sem o texto, o que é menos exposição que antes.
- **A tela de falha e o aviso do `Retry-After`:** não mostram dado de pessoa (Tech Spec §5 "A web" e "O Redis fora").
- **O modelo menor:** é do mesmo provedor, então a D62 continua valendo para ele.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/titular/compartilhamento.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/db/schema/consumo-ia.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/tasks/tarefas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/docs/lgpd.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-15 02:39:01 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

```
VEREDITO: APROVADO
Tabelas verificadas: execucao_agente (escola_id e ano_letivo_id já existem; nenhuma tabela ou coluna nova, techspec §3); job_registro (escola_id já existe; a migration só amplia job_registro_fila_valida e configuracao_operacional_vagas_validas com `ferramenta`); consumo_ia e mensagem_tutor (as linhas novas, a estimada da §8 e a do assunto delicado da §5 "A D36 e a S12", são gravadas no contexto da escola)
Queries verificadas: ExecucaoRepository saindo de REPOSITORIES_SEM_ESCOPO e lendo a escola de requireEscolaId() (techspec §6); os métodos passam a ser cobrados pela guarda tools/guardas/escopo-dos-repositories.ts; pendente → rodando com a condição de idade, e o corte pelo processador (§5 "Os estados"); o corte pelo GET /v1/execucoes/:id (§4, §5); o contexto no worker vindo de job_registro.escola_id, que o JobExecutor já restaura da linha e localiza no escopo dela, com o `preparar` relendo a execução no escopo, o ano letivo da linha, o papel do vínculo ativo e o alcance do POST (§5 "O contexto no worker", §7); a varredura @Unscoped com job_registro (§5 "A varredura"); a métrica ia.espera_estourada{escola_id} (§7c), que é só contagem, só para o operador, com o precedente de job.aguardando_vaga
Teste de isolamento: presente e efetivo (cenarios.md §6). O item 1 tem mutação declarada. O item 2 quebra sem a cláusula de escola, porque a B iria para `rodando` com fetch. O item 3 quebra sem a conferência do `preparar`, e §1 declara essa mutação.
Bloqueantes: nenhum
Recomendações:
- techspec §5 "Os estados" e §4, o corte pelo GET: escrever que ele só acontece depois que deQuemPediu achou a linha, ou que o `update` leva as mesmas cláusulas (escola, ano letivo e solicitada_por, todas do contexto). Do jeito que está escrito, o texto permite cortar antes da leitura, com escopo só de escola, e aí outra pessoa da mesma escola dispara o corte de uma execução que não é dela. O efeito hoje é nulo, porque depois de 20 s o processador já não pega a execução, mas isso é autorização por objeto (regra 10.4). Acrescentar em cenarios.md §6: GET de um usuário da escola A, e de outro usuário da mesma escola, sobre uma `pendente` de 21 s responde 404 com o mesmo corpo de id inexistente; a linha segue `pendente`; ia.espera_estourada não soma. Mutação: cortar antes de deQuemPediu, ou sem solicitada_por.
- techspec §5 "A varredura": a junção com job_registro deve igualar também job_registro.escola_id = execucao_agente.escola_id, além do execucaoId do payload. Sem isso, um job de outra escola que cite o id mantém viva a `pendente` alheia (o cenário de cenarios.md §6, item 2). O novo motivo do @Unscoped deve dizer que a varredura lê de job_registro só o estado e o id do payload, e grava só estado, código e data.
- techspec §2, JOB_DEFINITIONS: a versão anterior trazia `{ execucaoId: uuid }` e o texto atual deixou de citar o esquema. Manter o esquema estrito com uuid, para que um id fora do formato seja recusado em DADOS_INVALIDOS antes do repository (regra 10.7).
- techspec §6: com a escola vindo de requireEscolaId(), tirar escolaId da ExecucaoAgendada que os métodos de estado recebem, ou conferir que ele bate com o contexto. Assim nenhum método volta a decidir o escopo pelo argumento.
```

O arquivo auditado é /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md, junto com prd.md e cenarios.md da mesma pasta.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-15 02:39:02 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** bancada que publica pelo outbox e consome com o `JobExecutor` real · contexto no worker (vínculo, papel, alcance, eliminação, virada do ano, suspensão) · mensagem fixa sem job com a fila cheia e com o Redis fora · Tutor desligado, suspenso e fora da política sem job · clique duplo em paralelo · job entregue duas vezes, em sequência e em corrida · worker morto · varredura com duas réplicas · corte dos 20 s por quem chega primeiro, com barreira · Redis de volta antes e depois dos 20 s · professor vendo a troca sem resposta · linha estimada no rastro · degraus de tokens, incluindo o Tutor sem modelo menor e o degrau sem modelo menor · baldes de 15 % e 10 % · D62 por campo e por categoria, com caso positivo do falso e do local · marca e categorias fixadas por tarefa · isolamento no repository, no job e na entrada gravada · prazo da web, cancelamento, `PUT` pendurado, falha na raiz, guarda do `fetch`, `Retry-After`, celular a 360 px · carga com `FASE=sala`.

**Correções da rodada 1, item a item (o que cabia a mim):**
- **Bancada e suítes que migram:** entrou (Tech Spec §10; `cenarios.md`, "A bancada").
- **Contexto no worker:** entrou, com mutação (`cenarios.md` §1, último item).
- **Mensagem fixa sem job com a fila cheia:** entrou, também com o Redis fora (§2, item 1).
- **Três camadas do Tutor desligado sem job:** entrou (§2, último item).
- **Clique duplo em paralelo:** entrou, com `Promise.all` (§1).
- **Redis de volta antes e depois dos 20 s:** entrou (§1). Mas não prova quem faz o corte (bloqueante 1).
- **Professor vendo a troca:** entrou (§1).
- **Marca `levaTextoDeAluno` fixada:** já existe hoje para toda tarefa, no `DECLARADO` de `packages/core/src/ia/tasks/tarefas.test.ts`. A declaração nova `categoriasEnviadas` não ficou fixada (bloqueante 5).
- **Caso positivo do falso e do local:** entrou na subida (§5).
- **Degrau sem modelo menor:** entrou (§4).
- **`PUT` pendurado:** entrou, com mutação (§7).
- **Cancelamento sem erro na tela:** entrou (§7).
- **Raiz e guarda do `fetch`:** entraram (§7).
- **Celular a 360 px:** entrou (§7, [E]).
- **Corte dos 20 s com barreira:** entrou (§1, [P]). A mutação declarada pode não chegar à cláusula (bloqueante 2).

**Cobertos:** todos os itens acima, salvo o que está nos bloqueantes. Isolamento (§6), rastro do titular (§3), varredura com duas réplicas, D36 em transação própria (com mutação), virada do ano, degrau do Tutor (com mutação), baldes, D62 por categoria (com mutação), carga com teto finito. Nenhum teste chama provedor pago, e o adaptador falso está declarado.

**Bloqueantes:**

1. **O corte feito pelo processador não tem cenário que caia sem ele** (`cenarios.md` §1; Tech Spec §5, tabela de estados, linha `pendente`).
   - Se a mutação "o processador não tenta o corte" for aplicada, nenhum caso fica vermelho:
     - no [P], o `GET` corta e o processador falha a condição de idade;
     - no caso dos 21 s ("a tela mostra Tentar de novo"), quem corta é o `GET`;
     - no caso dos 25 s, "o `GET` já encerrou".
   - Sem o corte do processador, a `pendente` sem `GET` (o aluno fechou a aba) fica parada até a varredura e termina `EXECUCAO_INTERROMPIDA`, sem a métrica.
   - **Correção exigida:**
     - um caso "job chega com 21 s e nenhum `GET`": `falhou IA_INDISPONIVEL`, `ia.espera_estourada` +1, sem modelo. Mutação: tirar o corte do processador;
     - um caso simétrico "Redis fora, só o `GET`", conferindo o estado logo depois do `GET` e antes de o Redis voltar. Mutação: tirar o corte do `GET`.

2. **O [P] do corte não fixa a ordem e pode não alcançar a mutação declarada** (`cenarios.md` §1, item [P]; Tech Spec §5).
   - A Tech Spec não diz em que ordem o processador tenta as duas passagens.
   - Se ele tenta o corte antes do `pendente → rodando`, tirar a condição de idade do `pendente → rodando` deixa o [P] verde: o processador corta antes e o modelo não é chamado. É o "vermelho pelo motivo errado".
   - **Correção exigida:**
     - a §5 fixa a sequência do processador: primeiro o `pendente → rodando` com a condição de idade, e só com zero linhas o corte;
     - o [P] roda as duas ordens forçadas (processador primeiro, `GET` primeiro), com o resultado esperado de cada uma;
     - a mutação é provada na ordem "processador primeiro".

3. **Job executado duas vezes ao mesmo tempo não tem teste paralelo em `cenarios.md`** (§1, "Entrega duplicada", marcado [I]).
   - A Tech Spec §10 diz que os cenários estão em `cenarios.md`, mas os casos de corrida ficaram em `onda-3a.md` §3, citados só de passagem na §7c ("as de `onda-3a.md` §3"). Na X3, foi esse tipo de item solto que ficou sem teste. Os casos que faltam:
     - "Duplicado em corrida", com barreira: a 1.ª entrega marca `rodando` antes do `fetch` e a 2.ª marca `EXECUCAO_INTERROMPIDA`;
     - "As duas leem `pendente`", com barreira entre a leitura e o `update`;
     - "Pool do banco": a Tech Spec §5 promete que o job não segura conexão durante o modelo.
   - Há também uma contradição sem resolver. O RF3 do PRD e o item de `cenarios.md` esperam "uma resposta, uma troca". Pelo desenho, a duplicada que chega com a execução em `rodando` dá `EXECUCAO_INTERROMPIDA`, com zero resposta e sem contar a troca.
   - **Correção exigida:** trazer os três casos para `cenarios.md`, com as corridas marcadas [P], e separar o resultado esperado por momento:
     - duplicada durante `rodando`: interrompida, nenhuma resposta, a troca não conta;
     - duplicada depois de `concluida`: sem efeito, uma resposta, uma troca.

4. **A espera de 30 s da `ferramenta`, nova nesta rodada, não tem cenário contra o corte do perfil (140 s) e o `prazoMs` (150 s)** (Tech Spec §5, "Os tokens" e tabela de estados).
   - A rodada 1 dizia que o orçamento da 48.0 já incluía os 8 s de espera. Essa frase saiu, e não está dito se os 30 s contam dentro dos 140 s.
   - O caso "Prazo por perfil" de `onda-3a.md` §3 não está em `cenarios.md`.
   - **Correção exigida:**
     - a §5 diz que a espera do teto conta dentro do corte do perfil;
     - `cenarios.md` §4 ganha um caso com relógio falso: `ferramenta` espera 30 s no teto e o modelo demora até o corte, e ela termina pelo corte antes de 150 s, sem reentrega nem `EXECUCAO_INTERROMPIDA`;
     - o teste de configuração "corte abaixo do `prazoMs`" soma a espera máxima da fila.

5. **`categoriasEnviadas` não fica fixada por tarefa** (`cenarios.md` §5, item [U]; Tech Spec §5, "A D62").
   - Só o valor do `turno_do_tutor` é fixado.
   - Uma tarefa que declare menos categorias encolhe a união, e a subida aceita um suboperador sem a categoria que essa tarefa envia. Nenhum caso fica vermelho, porque o "um por categoria faltando" testa a união já encolhida.
   - **Correção exigida:** `categoriasEnviadas` entra no `DECLARADO` de `tarefas.test.ts`, para todas as tarefas. Mutação: tirar uma categoria de uma tarefa.

**Recomendações:**
- **Guarda do executor:** uma guarda que acuse qualquer suíte trocando o `EXECUTOR_DE_AGENTE` ou o executor da bancada. Hoje "nenhuma suíte nova troca o executor" é só promessa.
- **Mutações a nomear:**
  - clique duplo: tirar a restrição única da `chaveEnvio`;
  - mensagem fixa: mover a conferência para o comando;
  - Tutor desligado: uma mutação para cada uma das três camadas;
  - professor vendo a troca: filtrar as trocas sem resposta;
  - degrau sem modelo menor: conferir também a métrica do degrau.
- **Fronteira do `Retry-After`:** um caso com 10 e outro com 11.
- **E2E a 360 px:** dizer como o teste provoca a falha na raiz e o `503` (por exemplo, `page.route`), sem gancho no build de produção.
- **Redis fora com `ferramenta`:** um caso em que o Redis volta e a `ferramenta` roda, como diz a §7c.
- **Caso positivo do gateway:** marca ligada, adaptador falso, a chamada sai. Hoje só o caso negativo está explícito.
- **Divergência para o `revisor-geral`:** o RF7 do PRD diz "espera até 8 s", e a Tech Spec dá 30 s à `ferramenta`.

[… 1 linhas cortadas]

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-15 02:40:11 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor | fila | IA | login | prova | migration | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes:
- **Tech Spec §7c ("Carga na manhã") e §5 ("Os tokens"): o teto de tokens que a spec registra não cobre o pico que ela mesma calcula.** A spec pede um contrato de ~2,1 milhões de tokens por minuto. O balde geral fica com 80 % disso, 1,68 milhão, que o Tutor divide com a ferramenta e com a `normal`. A própria §7c põe a demanda do pico em 1,5 milhão do Tutor mais 0,2 milhão de ferramenta, ou 1,7 milhão. Isso já passa de 1,68 milhão antes de contar qualquer Analista na `normal`. O "~2,1" é 1,7 ÷ 0,8 = 2,125 arredondado para baixo, e um piso não se arredonda para baixo. Às 10h o resultado é este: o Tutor fica sem vaga no balde a cada janela de minuto, espera 8 s e, como pula o modelo menor (D36), termina em `IA_INDISPONIVEL`. Isso contradiz o RF6 ("nenhum aluno vê indisponível") e a regra 80 (dimensionar para a manhã de segunda).
  Correção exigida:
  - Registrar no `docs/infra.md` o contrato como piso: (pico do Tutor + pico da ferramenta + o que a `normal` usa em horário letivo) ÷ 0,8. Isso dá ≥ ~2,2 milhões se a `normal` ficar perto de zero às 10h, ou ~2,4 milhões se ela puder encher os 10 %. A spec escolhe um dos dois e diz por quê.
  - O `LLM_TOKENS_POR_MINUTO` do `infra/carga.env` sai dessa conta, na escala do que o adaptador falso informa de uso, para a `FASE=sala` provar que o teto morde e que nenhum aluno vê "indisponível" (`cenarios.md` §8).

Conferência das correções da rodada 1:
- **(1) O corte dos 20 s: feito.** Está na §5, tabela de estados:
  - o `update` é condicional com o `now()` do banco, nos dois sentidos;
  - a condição de idade entrou no `pendente → rodando` da `interativa`;
  - quem chega primeiro faz o corte, seja o processador ou o `GET`;
  - a métrica só soma quando o `update` devolve a linha;
  - há teste com barreira e mutação (`cenarios.md` §1).
  - A troca não conta porque é derivada de execução `falhou` (`supervisao.repository.ts`).
- **(2) A ferramenta e os tokens: feito em parte.** O balde próprio de 15 %, abaixo do Tutor, está na §5. A §7c soma a ferramenta ao pico e a `FASE=sala` tem teto finito. O que falta é o bloqueante acima: a conta somada não fecha.
- **(3) A varredura: feita.** O limiar é 300 s, ou 2 × `prazoMs`. A `pendente` com job vivo fica, mesmo com o Redis fora. Há teste com duas réplicas e mutação do limiar e da leitura do `job_registro` (`cenarios.md` §1).
- **Recomendações da rodada 1: todas entraram.** A migration 0058 é de fato a próxima (a última é a `0057`). O `worker-pdf` ficou em `apps/worker`, o `ia.executar` tem `escopo` e filas, e a `ferramenta` está no `QUEUE_PRIORITY` e no `WORKER_POOL_OPTIONS_BY_QUEUE`. O rollback está na §13: a varredura antiga (`execucao.repository.ts:66`) de fato encerra a `pendente`. O `IA_REPLICAS` é conferido contra o compose.

Recomendações:
- **O alerta "Tokens acima de 80 %" (§7c):** diga em relação a quê é medido, se ao contratado ou ao teto, e confira que ele não dispara em toda manhã de pico nominal. Se for esperado que dispare, o runbook precisa dizer isso.
- **O adaptador falso (`packages/core/src/ia/fake-adapter.ts`)** conta os tokens pela entrada real, que é sintética. Na `FASE=sala`, faça o falso informar o formato da `docs/infra.md` §3.2 (3.000 + 250 por turno), ou ajuste o teto à escala dele. Sem isso, o limitador não morde na carga.
- **O prazo do job (§5, "Os tokens" e tabela de estados):** diga que a espera por vaga no balde (8 s na `interativa`, 30 s na `ferramenta`) fica dentro do corte do perfil (60 s e 140 s). Hoje isso não está escrito. Se a espera ficar fora, a ferramenta chega a 170 s e passa do `prazoMs` de 150 s.
- **A varredura com `job_registro` (§5):** escreva a consulta como "não existe job vivo" (`tipo = 'ia.executar'`, `dados->>'execucaoId'`), para ela descer pelo índice parcial de não finalizados (`job_registro_pendentes_idx`). Ponha o `EXPLAIN` na tarefa. Os finalizados de 7 dias passam a ter uma linha por troca do Tutor.
- **O corte no `GET` (§4 e §5):** só emita o `update` quando a leitura já mostrou `pendente` com mais de 20 s. Sem isso, cada consulta de status vira uma escrita.
- **O rollback (§13):** diga o que o despachante antigo faz com as linhas de `fila = 'ferramenta'` e de tipo desconhecido que ficarem em `job_registro`. Elas não podem prender a fila nem disparar o `job-interativo-esperando`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-15 02:40:28 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

Escopo: respeitado. O provedor de reserva fica no F5, o Analista por evento no F11, e não há tela nova além do aviso da espera e do "Voltar ao início".

Aderência à Tech Spec: divergência em três pontos: §5 com o RF5 e o §4 do PRD (a troca sem resposta que o professor vê), §8 (o teto de entrada que não existe) e §5 "A web" (o "Voltar ao início" na raiz).

Portão local: não se aplica. É revisão de spec e não há código; o `conferir` responde "nunca passou nesta árvore", o que é esperado.

**As quatro correções da rodada 1**

- **Corte dos 20 s condicional: entrou** (§5, tabela de estados). O `update` passa a ser condicional no `now()` do banco, feito por quem chegar primeiro (o processador ou o `GET`). O `pendente → rodando` ganha a condição de idade, e a métrica só soma quando a linha volta. O `cenarios.md` §1 tem o teste com barreira e a mutação.
- **D62 pela união das categorias: entrou** (§5 "A D62", `cenarios.md` §5, um caso por categoria). `CATEGORIAS_DE_DADO_DO_SUBOPERADOR` e as colunas `pais`, `veda_treinamento`, `alcance`, `categorias` e `fim` existem no código.
- **Tela de falha da raiz: entrou em parte.** `FALHA_DA_AREA` sai de `routes.tsx` e a fronteira envolve as rotas inteiras. Mas o "Voltar ao início" ficou com um buraco (bloqueante 3).
- **Estimativa e envio da linha interrompida: o envio entrou** (`envio_externo`, `provedor`, rastro do titular, `cenarios.md` §3). **A estimativa abriu um buraco novo** (bloqueante 2).

**Bloqueantes**

1. **O professor não vê hoje a troca sem resposta, e a Tech Spec não diz como passa a ver.**
   - O PRD pede isso no §4 ("ver no uso a troca sem resposta, sem o texto") e no RF5 ("visível ao professor"). O `cenarios.md` §1 tem um teste para isso.
   - O código faz o contrário. `ultimasTrocas` e `trocasDeHoje`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/tutor/supervisao.repository.ts` (linhas 205–210, 240 e 288), tiram de propósito toda troca cuja execução terminou `falhou`, com `notExists(#execucaoQueFalhou())`. Essas são as consultas que alimentam o `GET /v1/tutor/uso`.
   - Nenhuma seção da Tech Spec muda essa leitura, e o §2 não lista o `supervisao.repository.ts` nem o DTO do uso. Do jeito que está, o teste não tem como passar, ou a tarefa vai decidir sozinha uma mudança no que o professor vê do Tutor (regra 70.4 e 70.7).
   - Correção, um dos dois caminhos:
     - A Tech Spec desenha a leitura: qual campo, com contagem ou marca e sem texto; como ela convive com o freio, que continua não contando a troca; e o `conformidade-reviewer` revisando a tarefa. O `supervisao.repository.ts` entra no §2.
     - Ou o PRD (RF5 e §4) e o `cenarios.md` §1 tiram o "visível ao professor". Isso é mudar critério do PRD e passa pelo Joaquim.

2. **O §8 usa um teto de entrada que não existe e que ninguém garante.**
   - O §8 estima a linha da execução interrompida como `maximoDeTokensDeEntrada` + `maximoDeTokensDeSaida`, "declarado por tarefa". Mas `maximoDeTokensDeEntrada` não existe: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/task.ts` só tem `maximoDeTokensDeSaida`, na linha 52.
   - O §2 não lista esse campo novo. A Tech Spec também não diz que o gateway recusa ou corta uma entrada acima dele.
   - Sem essa garantia, um turno do Tutor com histórico e trechos do material pode passar do teto declarado. Aí a linha fica abaixo do real, e o RF3 e a D14 ("a mais, nunca a menos") deixam de valer. Isso também se afasta do que a rodada 1 pediu: estimar a partir de `preparar` + `montarPedido`.
   - Correção:
     - Pôr o campo em `TaskDefinition` no §2.
     - O `LLMGateway` recusa, antes do envio, o pedido cuja entrada estimada passa do teto, com erro tipado. Ou então a Tech Spec volta à estimativa por `montarPedido`.
     - O `cenarios.md` §3 ganha o caso da entrada acima do teto.

3. **O "Voltar ao início" da raiz pode não sair da tela de falha.**
   - A Tech Spec diz "link para `/`" no `Falha`, com uma `AreaErrorBoundary` envolvendo o `<Switch>` de `AppRoutes`. A fronteira guarda `falhou: true` no próprio estado e não volta atrás quando a rota muda (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/components/AreaErrorBoundary.tsx`, linhas 67–76).
   - Com um `<Link>` do wouter, o jeito comum no projeto, o endereço muda e a `Falha` continua na tela. O botão exigido na rodada 1 fica sem efeito justamente na raiz.
   - Correção: a Tech Spec diz se é navegação completa (`<a href="/">`, como o "Tentar de novo" já usa `reload`) ou se a fronteira volta atrás quando a rota muda. O cenário do `cenarios.md` §7 clica no botão e confirma que a tela saiu da `Falha`.

**Recomendações**

- **A `normal` no PRD e na Tech Spec.** O RF7 do PRD diz "usa até metade"; a Tech Spec dá à `normal` um balde de 10 % e não fala mais do `lote`. Não chega a ser contradição, mas o PRD devia dizer o mesmo número.
- **O pico de tokens contra o balde.** O §7c soma ~1,7 milhão por minuto no pico (Tutor mais ferramenta), e o balde geral tem 80 % de ~2,1 milhões, cerca de 1,68 milhão. No pico estimado o Tutor já espera, o que arrisca o "nenhum aluno vê indisponível" do RF6. Vale conferir com o `infra-guardian` se o contrato registrado precisa ser maior.
- **A linha estimada da `pendente` que nunca rodou.** A varredura encerra com `EXECUCAO_INTERROMPIDA` a `pendente` com job final ou ausente. Pelo §8, isso grava `envio_externo` e entra no rastro do titular sem que nada tenha ido ao provedor. Melhor gravar a linha estimada só quando `iniciada_em` está preenchida.
- **O destino do "Voltar ao início" na operação.** "Em toda área" inclui a operação, e `/` leva o operador à área da escola. Ali o destino devia ser `/operacao`.
- **O nome das rotas.** O §5 chama de `<Routes>` o que no código é o `<Switch>` de `AppRoutes` (wouter). Melhor citar `AppRoutes`.
- **A definição do job.** `ia.executar` em `JOB_DEFINITIONS` também precisa de `naoUrgente` e `retentativa`, que o `defineJob` exige (`job-definitions.ts`). A Tech Spec só cita `escopo`, `filas`, `prazoMs` e "uma tentativa".

Conferido no código e sem problema:
- A 0057 é a última migration, então a próxima é a 0058.
- `QUEUE_PRIORITY`, `WORKER_POOL_OPTIONS_BY_QUEUE`, `#semRedis`, `conferirLivre`, `rastroDoAluno`, `falharInterrompidas`, `queue.fixture.ts`, `infra/carga.env` e `job-interativo-esperando.yaml` existem.
- `levaTextoDeAluno` já é campo obrigatório da tarefa.
- O `consumo_ia` aceita a linha estimada sem coluna nova.
- A Tech Spec tem 1.998 palavras.

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-15 02:46:17 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não (revisão de spec, sem tela para fotografar). Li o PRD, a techspec (§5 e §9), `cenarios.md` (§1, §2, §7) e conferi contra `AreaErrorBoundary.tsx`, `routes.tsx`, `drawer-context.ts` e `packages/shared/src/tutor/uso.ts`.

Estados: ok. O uso do Tutor ganha "N sem resposta hoje" só quando N > 0. A espera do `Retry-After` tem o estado "tentando de novo", com `role="status"`. O erro depois da espera, ou depois de um segundo 503, cai no `ErrorState`. A `Falha` já existe, e ela ganha a saída "Voltar ao início".

Acessibilidade: ok no desenho.
- O aviso da espera tem texto fixo ("Tentando de novo em instantes") em `role="status"`, e a contagem visível é `aria-hidden`. O leitor de tela não anuncia número a cada segundo.
- A mensagem fixa do D36, com o CVV, fica acima do "Tentar de novo" (cenarios §2). A `Falha` já usa `role="alert"` e leva o foco ao título.
- O "Voltar ao início" é um `<a href="/">` de 44 px. O link é nativo, então funciona por teclado.
- O `DrawerContext` padrão com `fechar` sem efeito já é o comportamento de hoje: `drawer-context.ts` declara `fechar: () => undefined`. A `Falha` fora da casca não quebra.

Chromebook fraco: ok.
- Os prazos do RF11 (leitura 20 s, PDF 30 s, envio de arquivo 180 s, prova 10 s) evitam tela pendurada na rede ruim da escola.
- Uma resposta de prova pendurada vai para o fim da fila e não trava as outras.
- A espera do Redis é limitada a 10 s, uma única vez.

Celular: ok no desenho. A techspec §9 e cenarios §7 pedem o projeto `celular` a 360 px para a `Falha`, o aviso da espera e a linha do aluno. O alvo de 44 px no "Voltar ao início" está escrito. O código de hoje, `Falha` com `max-w-md` e `Button`, não impõe rolagem horizontal.

Ação oficial protegida: sim. Nada desta spec é ação oficial. O professor vê só a contagem, sem o texto da pergunta (D34, D66), e o teste exige DTO sem texto.

Bloqueantes: nenhum.

Recomendações:
1. Ponto de código a cuidar na implementação. Hoje o "Tentar de novo" da `Falha` faz `window.location.reload()`, e o novo "Voltar ao início" será `<a href="/">`. Os dois botões lado a lado precisam de hierarquia visual clara: "Tentar de novo" primário, "Voltar ao início" secundário. Ambos devem ter 44 px e, a 360 px, quebrar sem cortar texto. Vale uma linha no teste `celular`.
2. Redação de "N sem resposta hoje": use o singular com N = 1 ("1 sem resposta hoje" funciona para os dois números, então o texto já serve). Confirme na linha do aluno, em `TurmaHoje.tsx`, que a contagem não parece alerta nem censura ao aluno. Deve ser um dado neutro, sem cor de erro, para respeitar a D59 e a regra 70.7.
3. Na tela de uso, `trocasDeHoje` em `sinais.ts:116` mostra "X de Y". Mostre "sem resposta" como texto separado, para não ser lido como parte do freio diário.
4. O `/operacao` da `Falha` vale também para a galeria (`routes.tsx:216`), que hoje usa `FALHA_DA_AREA` com `paginaInteira`. Decida o destino da galeria, que é só de desenvolvimento, e registre.

## llm-integrator · 3ª rodada · AJUSTES NECESSÁRIOS · 2026-11-15 02:46:20 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: `rapido` no Tutor, `padrao` nas ferramentas, no artefato e no `propor_ferramenta`, e o Analista na fila `normal`. Não há tarefa nem prompt novo. O modelo menor é do mesmo perfil, só nas tarefas que não são o Tutor.

Custo estimado por professor/mês: a spec não traz estimativa em reais, porque não acrescenta chamada nova (Tech Spec §8, "custo de hoje"). Os números de volume que ela cita são ~1,5 milhão de tokens/min do Tutor no pico, ~0,2 milhão de ferramenta e ~2.000 tokens por proposta (§7c e §12, marcados como não verificados). A linha estimada de `consumo_ia` da execução interrompida só superestima. Isso é aceitável para esta spec, e o preço do modelo menor entra na tabela de `consumo.ts` ou a subida falha.

Prompt versionado: sim (os testes de hash de prompt contra a `versao`, §5)
Validação de schema: sim (`interpretar` e a repetição do gateway, mantidos)
Aprovação humana no caminho: sim. A entrega nasce `pendente` e é caracterizada por teste antes de mover o `aoConcluir`. O Tutor segue na exceção da D47.

**Conferido da rodada 2**
- A espera de 8 s em toda fila, o teste `corte + espera < prazoMs` e o caso de relógio falso entraram (§5 "Os tokens" e tabela de estados; `cenarios.md` §4).
- `maximoDeTokensDeEntrada` obrigatório em `TaskDefinition`, com recusa antes do `fetch` e `@ts-expect-error` para a tarefa sem o teto, entrou (§2, §8; `cenarios.md` §3).
- O preço do modelo menor em `consumo.ts` ou a subida falha entrou (§5 e `cenarios.md` §4).
- A reserva da interrompida que não volta entrou (§5).
- O Tutor pula o modelo menor (D36), com teste de mutação.

**Bloqueantes**
1. **Tech Spec §5 ("Os tokens" e tabela de estados, linha `rodando`) e `cenarios.md` §4 (caso "O prazo"): o "corte do perfil" não vale por execução, então a conta `corte + espera < prazoMs` não prova o que diz.**
   - Em `packages/core/src/ia/resilient-adapter.ts:144-167`, o prazo é aplicado a cada `adaptador.chamar`.
   - Em `packages/core/src/ia/llm-gateway.ts:35` e `:192-198`, o gateway faz até 2 chamadas ao adaptador (`TENTATIVAS_MAXIMAS = 2`) quando a saída vem inválida, e cada uma ganha o prazo inteiro.
   - A spec ainda acrescenta o degrau do modelo menor, que é uma terceira chamada, depois da espera.
   - No `padrao` com corte de 140 s, o pior caso é 8 s de espera, 140 s na primeira chamada e 140 s na segunda. Isso passa de 150 s com folga.
   - O job estoura o `prazoMs` e cai de novo no `EXECUCAO_INTERROMPIDA` com modelo ainda cobrando. É o mesmo defeito da rodada 2, por outro caminho.
   - O teste de configuração soma só um corte e uma espera, e o caso de relógio falso usa uma chamada só. Nenhum dos dois pega isso.
   - Correção exigida: a spec deve definir um prazo único por execução, um deadline absoluto que cobre a espera dos tokens, o degrau do modelo menor e todas as tentativas do gateway. Pode ser um `AbortSignal.timeout(corte)` criado no início do `ExecucaoProcessor` ou do gateway e repassado como `pedido.sinal`, com o orçamento restante repartido entre as chamadas.
   - A spec deve dizer o que acontece quando o deadline cai no meio: `falhou IA_INDISPONIVEL`, sem reentrega.
   - Em `cenarios.md` §4, acrescentar um caso de relógio falso com primeira saída inválida e segunda chamada lenta, ou com espera de 8 s seguida do modelo menor lento. O caso deve provar que a execução termina antes de 150 s sem `EXECUCAO_INTERROMPIDA`. Mutação: deixar o prazo por chamada.

**Recomendações**
- `packages/core/src/config/llm-config.ts:84-88`: hoje o `padrao` tem 60 s e o `rapido` 20 s. A spec fala em 60 s e 140 s sem dizer que os padrões mudam. Registre os valores novos, os de produção e os de teste, e a nova regra de validação que troca `IA_EXECUCAO_TIMEOUT_MS`.
- A spec não diz o que o limitador reserva a cada tentativa. Na repetição por saída inválida e no degrau do modelo menor, deve ficar claro se há uma reserva nova por chamada, e a anterior deve ser acertada pelo uso real.
- O resumo de custo por professor/mês é conta de produto que ainda não existe. Registre-o na tarefa do `docs/infra.md` ou em `docs/avaliacao-de-modelos.md`, depois da D37.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-15 02:47:09 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta spec. Ela não toca `Nota`, correção nem lançamento; o diff mexe no worker de IA, nos tokens, na D62, no uso do Tutor e na web. Todos com autor humano? sim, nada mudou desde a rodada 2.

Decisão autônoma sobre aluno: ausente. `semRespostaHoje` é uma contagem para o professor. Não dispara alerta, não tem consequência automática e não ordena por uso: a lista segue por nome, como em `packages/shared/src/tutor/uso.ts`.

Aprovação registrada: ok. A entrega do assistente e do artefato continua nascendo `pendente`, e um teste fixa isso antes de qualquer `aoConcluir` mudar de lugar (Tech Spec §5 "O comando"; cenarios.md §1). A exceção da D47 continua só no Tutor.

Supervisão do tutor: ok, e o desenho novo reforça a supervisão:
- **Contra a regra 70, item 7.** O professor vê quantas perguntas do aluno ficaram sem resposta hoje. É um fato do serviço, não do comportamento do aluno:
  - não leva texto, e o DTO estrito recusa conteúdo;
  - zera a cada dia, sem histórico nem soma ao longo do tempo;
  - não mede tempo ocioso nem navegação;
  - não infere estado emocional;
  - usa o mesmo recorte de turma e disciplina de `ultimasTrocas`, que só restringe o alcance.

  Hoje a pergunta que terminou `falhou` some do uso (`notExists(this.#execucaoQueFalhou())` em `supervisao.repository.ts`). Por isso o aluno que só teve pergunta cortada ficava invisível ao professor. O cenário "o aluno que só teve pergunta cortada aparece na lista" fecha essa lacuna da regra 70, item 4, e da N21 da AIA.
- **Contra `docs/aia/tutor.md`.** Bate com a N21: o uso vem "sem conteúdo, sem tempo ocioso e sem histórico de navegação". `trocasHoje` e o freio não mudam, então a pergunta que falhou continua sem contar contra o aluno (D38).
- **Os testes provam o desenho:** a contagem de 2 com `trocasHoje` 1, o recorte de disciplina com mutação e a linha "N sem resposta hoje" que some com 0 (cenarios.md §1).

Autonomia declarada e visível: sim, sem mudança.

Bloqueantes: nenhum.

As recomendações acolhidas da rodada 2 conferem:
- **A trava do modelo menor no Tutor.** A Tech Spec §5 "Os tokens" cita a D36 e a regra 30.11. Liberar o modelo menor no Tutor pede três coisas: a medida de risco à vida, a suíte de recusa em `docs/avaliacao-de-modelos.md` e uma decisão registrada. O teste com mutação está em cenarios.md §4.
- **A saída do modelo menor.** Ela passa pela mesma conferência: `propor_ferramenta` com nota na saída é recusada (D55, cenarios.md §4).
- **A mensagem fixa.** A mensagem fixa com o CVV fica visível acima do "Tentar de novo" (cenarios.md §2).

Recomendações:
1. **Dizer quais finais contam como "sem resposta".** Tech Spec §5 "A pergunta sem resposta" conta todo `falhou`. Isso pega também `TUTOR_PAUSADO_EM_AVALIACAO`, quando a avaliação abre entre o `POST` e o `preparar`/`concluir`, e a recusa da conferência. Contar a pausa por avaliação pode ser lido como "o aluno chamou o Tutor na hora da prova". Não é medida de navegação, mas fica perto do limite da D70. A Tech Spec deve listar os códigos que contam (capacidade e interrupção) ou registrar por que conta todos, com um cenário para o caso da avaliação.
2. **Atualizar a N21 de `docs/aia/tutor.md`.** Ela enumera o que o professor vê (trocas do dia, hora da última, em que estava). A Tech Spec §7b diz que a AIA ganha a limitação do turno sem modelo, mas não diz que a N21 ganha `semRespostaHoje`. Vale atualizar também o comentário "O que a resposta não tem" de `packages/shared/src/tutor/uso.ts`, para ficar claro que a contagem é sem texto.
3. **Deixar claro que quem não respondeu foi o Tutor.** "N sem resposta hoje" pode ser lido como o aluno deixando algo sem responder. Algo como "N perguntas que o Tutor não respondeu hoje", ou um texto de apoio, evita atribuir ao aluno uma falha do serviço.
4. **Fixar o "hoje" e o número que ele acompanha.** Convém dizer na Tech Spec que o "hoje" de `semRespostaHoje` usa o mesmo fuso de `trocasHoje` (`FUSO_DO_USO`). Também convém dizer que `trocasHoje` soma todas as disciplinas e `semRespostaHoje` só a do professor, para a tela não sugerir que os dois números se comparam.
5. **Cobrir a linha nova no celular.** A Tech Spec §9 cita a linha do aluno no uso a 360 px, mas o e2e de cenarios.md §7 só cobre a `Falha` e o aviso da espera. Falta a linha nova no `celular`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/tutor/supervisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/shared/src/tutor/uso.ts

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum nesta spec — todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok
Autonomia declarada e visível: sim
Bloqueantes: nenhum
Recomendações: (1) listar quais códigos de `falhou` contam em `semRespostaHoje`, ou justificar todos, com cenário para TUTOR_PAUSADO_EM_AVALIACAO; (2) atualizar a N21 de docs/aia/tutor.md e o comentário de uso.ts; (3) texto "N perguntas que o Tutor não respondeu hoje"; (4) fixar FUSO_DO_USO e o recorte diferente de trocasHoje; (5) e2e da linha do uso a 360 px
```

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-15 02:47:14 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo gravado. A leitura muda em dois pontos: `semRespostaHoje` por aluno nomeado em `GET /v1/tutor/uso`, que é uma contagem sem texto, e a linha estimada de `consumo_ia` da execução interrompida, que leva `envio_externo` e `provedor` e deixa `aluno_id`, `entrada` e `saida` nulos. `job_registro` passa a ter o tipo `ia.executar`, com payload `{ execucaoId: uuid }` estrito.

Fora da tabela de dados do docs/lgpd.md: nada é gravado fora dela. A Tech Spec §7 já prevê o ajuste das linhas `job_registro` e `consumo_ia`. Falta a linha "Uso do Tutor por aluno" (`docs/lgpd.md`:52) citar o `semRespostaHoje` (ver Recomendações).

Autorização por objeto: ok.
- `GET /v1/tutor/uso`: hoje só o professor com vínculo na turma lê (`turma_vinculada`). Coordenação, rede e aluno ficam em `nunca`, conferido em `packages/shared/src/permissao/matriz.expectativa.ts`. O `#turmaDoProfessor` responde `NAO_ENCONTRADO`. O `semRespostaHoje` segue o recorte de disciplina de `ultimasTrocas`, que é mais restrito que o de `trocasHoje`, e o teste com mutação está em cenarios.md §1.
- Corte do `GET /v1/execucoes/:id`: só depois de ler a linha no escopo de quem pediu. O repository de hoje já filtra por `solicitada_por = requireUsuarioId()`. A cenarios.md §6 cobre outro usuário da mesma escola e um da escola B: os dois recebem 404 com o mesmo corpo do id inexistente, a linha continua `pendente` e a métrica não soma.
- O `preparar` repete o alcance do `POST` (Tech Spec §5 "O contexto no worker"), e o job da escola A com um id da escola B não muda nada (cenarios.md §6).

Logs: limpos. `ia.geracao.soberania_recusada` e as demais métricas levam só ids, tarefa e código. Só `ia.espera_estourada` leva `escola_id`, como contagem.

Auditoria: presente onde a regra exige. Nenhuma ação nova pede auditoria: o professor lê a própria turma, e a coordenação e a rede não alcançam o uso.

Envio externo: o envio de hoje, para o suboperador da `IA_PROVEDOR_ID`. A D62 é conferida na subida pela união das `categoriasEnviadas`, com um caso de teste por categoria, e recusada a cada chamada antes do orçamento e do `fetch`. A interrompida conta como envio. Está registrado: a linha estimada é gravada na transação que encerra a execução, tanto na reentrega quanto na varredura (Tech Spec §5 "A varredura" e §8). A `pendente` encerrada não gera linha (cenarios.md §3). O rastro alcança a interrompida pelo ramo da execução de `rastroDoAluno` (`solicitada_por`), já que vai sem `aluno_id`.

Seed/fixture: sintético. Adaptador falso, `carga.env` na escala do falso, `page.route` no e2e e nenhum provedor pago.

**Correção da rodada 2:** entrou.
- A `rodando` encerrada pela varredura grava a linha estimada, sem `aluno_id`. A `pendente` não grava.
- Os casos têm mutação: "a varredura não grava a linha", "gravar com `aluno_id`" e "gravar sem `envio_externo`".
- Há o caso das duas réplicas, com a linha gravada na escola da execução.

As duas recomendações da rodada 2 também entraram: o `DECLARADO` com `categoriasEnviadas` de toda tarefa e a linha de `consumo_ia` no `docs/lgpd.md`.

**Buraco novo:** nenhum. O `semRespostaHoje` não tem texto, o schema estrito continua e a contagem só sai para o professor da turma.

Bloqueantes: nenhum.

Recomendações:
1. **`docs/lgpd.md`:52 e PRD §8.** A linha "Uso do Tutor por aluno" lista o que o professor vê: as trocas do dia, a hora e a referência da última troca. A tarefa do uso deve acrescentar ali "quantas perguntas de hoje ficaram sem resposta" e dizer que a "última troca" passa a incluir a que falhou. O PRD §8 ganha o mesmo item. Hoje a Tech Spec §7 só cita `job_registro` e `consumo_ia`.
2. **Tech Spec §8.** Dizer de forma explícita que a linha estimada leva o `execucao_id`. Sem `aluno_id`, é só por ele que o `rastroDoAluno` e o expurgo `consumo_por_aluno` alcançam a linha. O caso de cenarios.md §3 já pegaria a falta, mas o texto deve dizer.
3. **cenarios.md §5.** A invariante "`levaTextoDeAluno: true` exige `conversa_do_aluno` ou `conversa_do_professor`" deixa uma tarefa de texto de aluno passar declarando só `conversa_do_professor`. Hoje o `DECLARADO`, que fixa as categorias de cada tarefa, impede isso. Fica mais forte separar: tarefa do Tutor exige `conversa_do_aluno`, e só `propor_ferramenta` aceita `conversa_do_professor`.
4. **Fronteira para o `conformidade-reviewer`.** A falha por avaliação aberta (S12) e por `FUNCAO_SUSPENSA` também vai somar no `semRespostaHoje`. Para a privacidade está ok, porque é um fato do sistema e não do comportamento do aluno. Ele confirma se o texto "N sem resposta hoje" não sugere vigilância.

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`. Conferi contra o código atual: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/titular/compartilhamento.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/tutor/supervisao.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.repository.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/docs/lgpd.md`.

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-15 02:47:20 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: `execucao_agente` (escola e ano letivo já existem, sem coluna nova), `job_registro` (o `escola_id` existe, e o `ia.executar` tem `escopo: 'escola'`), `consumo_ia` (FK composta `(escola_id, execucao_id)` para `execucao_agente`, então a linha estimada da varredura não tem como cair em outra escola), `mensagem_tutor` (usada por `semRespostaHoje`). Não há tabela nova. A migration só amplia check constraint. Os ids continuam UUID, e o payload `{ execucaoId: uuid }` é estrito.

Queries verificadas:
- Tech Spec §5, tabela de estados: o `pendente → rodando` e o corte do processador usam o `ExecucaoRepository` com a escola tirada de `requireEscolaId()`. Nenhum método recebe a escola por argumento (§6).
- O corte do `GET` vem só depois de `deQuemPediu` (escola, ano, id e `solicitada_por` do contexto), e o `update` repete essas cláusulas. Para a outra escola e para outro usuário da mesma escola, a resposta é 404 com o mesmo corpo do id inexistente, a linha não muda e a métrica não soma (cenarios.md §6).
- Tech Spec §5, "A varredura": o `@Unscoped` continua sendo o único do módulo, e tem motivo escrito. O `not exists` em `job_registro` iguala a escola, e o caso do job de outra escola com o mesmo `execucaoId` tem mutação (cenarios.md §1).
- Tech Spec §5, "A pergunta sem resposta": `semRespostaHoje` fica no `SupervisaoRepository`, com `#escopo()` (escola e ano do token) e o recorte de turma e disciplina de `ultimasTrocas`, sem texto. A permissão `uso_do_tutor` é `nunca` para `rede` e `coordenador` em `packages/shared/src/permissao/matriz.expectativa.ts`. A camada de rede não alcança o dado.
- Nenhum endpoint aceita `escolaId` do cliente.

Teste de isolamento: presente e efetivo. Os casos de cenarios.md §6 quebram sem a cláusula: tirar o `escola_id` do `where`, cortar antes da leitura ou cortar sem `solicitada_por`. O mesmo vale para os casos de cenarios.md §1: a varredura que não iguala a escola e o recorte de disciplina de `semRespostaHoje`.

Bloqueantes: nenhum.

Recomendações:
1. Tech Spec §5, tabela de estados, linha `pendente`: hoje "as mesmas cláusulas" deixa em aberto se o corte do `GET` vale só para a `interativa`. Escrever isso de forma explícita e acrescentar em cenarios.md §1 o caso "ferramenta com 21 s e `GET` de quem pediu: nenhuma escrita". Sem isso, o `GET` que o professor faz em polling corta a ferramenta que deveria rodar.
2. Tech Spec §5, "A varredura": o motivo atual do `@Unscoped` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.repository.ts` diz "grava só estado, código e data". Ele precisa passar a citar também a leitura de `job_registro` e a gravação da linha estimada em `consumo_ia`. A spec deve dizer ainda que a escola dessa linha sai da própria linha encerrada (`returning`), e não de um contexto.
3. cenarios.md §3, varredura com adaptador externo: rodar com execuções `rodando` de duas escolas no mesmo ciclo e conferir que cada linha de `consumo_ia` fica na escola da própria execução.
4. cenarios.md §1, "O professor vê a pergunta sem resposta": incluir um caso com pergunta cortada do mesmo aluno em outra turma ou em outro ano letivo, que não deve entrar em `semRespostaHoje`. É o que prova o recorte de turma e ano, além do de disciplina.

## revisor-geral · 3ª rodada · REPROVADO · 2026-11-15 02:47:34 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §8 (`maximoDeTokensDeEntrada`, abaixo)
Portão local: não se aplica a esta revisão, porque é de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore"; o carimbo será exigido na primeira tarefa.

**As três correções da rodada 2, conferidas contra o código de hoje**
1. **Pergunta sem resposta (RF5): feita.** Hoje o `notExists(#execucaoQueFalhou())` existe em `ultimasTrocas` e em `trocasDeHoje` (`apps/api/src/tutor/supervisao.repository.ts`, linhas 240 e 288). A spec tira o filtro só da última pergunta e cria `semRespostaHoje` com o recorte de disciplina. `trocasHoje` e o freio continuam como estão. O contrato `usoDoAlunoSchema` está na §2, e `cenarios.md` §1 tem a mutação certa. PRD §4 e §5, Tech Spec §4, §5 e §7b dizem o mesmo.
2. **`maximoDeTokensDeEntrada`: o campo entrou, mas a correção abriu um buraco.** Ver o bloqueante.
3. **"Voltar ao início": feita.** `/` casa com `CAMINHOS_COM_SESSAO` (`apps/web/src/routes.tsx:150`), então leva à área de quem tem sessão e à entrada de quem não tem. O `Falha` de hoje só tem "Tentar de novo" (`components/AreaErrorBoundary.tsx`), e a spec acrescenta o link. A raiz envolve o `<Switch>` de `AppRoutes`, e `/operacao` vale na operação.

Bloqueantes:
- **Tech Spec §8 e `cenarios.md` §3: o teto de entrada pode recusar pedidos válidos do aluno.**
  - **O que está errado:** a spec tira o `maximoDeTokensDeEntrada` "do maior pedido dos testes de hoje com folga", e o gateway passa a recusar com `IA_INDISPONIVEL` todo pedido estimado acima dele. As entradas, porém, já têm limite no schema. Em `packages/core/src/ia/tasks/turno-do-tutor.ts` são `duvida` até 2000 caracteres, 8 `trechos`, 12 de `memoria` e 8 `turnosAnteriores` de até 2000. Em `propor-ferramenta.ts` são 6 trechos e 8 turnos de até 2000. Os testes de hoje usam entradas curtas, então uma conversa longa e válida em produção estoura o teto e termina "indisponível".
  - **Por que bloqueia:** é um modo de falha que o PRD não prevê. O PRD §6 diz que o que a escola vê "só muda no RF5, no RF11 ao RF13 e no degrau do RF7", e o RF6 exige que nenhum aluno veja "indisponível". O teto também alimenta a linha estimada da execução interrompida, que precisa ser o pior caso para "nunca subestimar" (D14). Um teto tirado de amostra não garante isso.
  - **Correção exigida:**
    - Na §8: o teto de cada tarefa sai do `montarPedido` com cada campo no limite do `esquemaDeEntrada`, mais o prompt.
    - Em `cenarios.md` §3: um caso [U] por tarefa em que a entrada máxima válida passa pelo teto sem recusa. Mutação: um teto menor que o pior caso.
    - Se a recusa nunca puder disparar com entrada válida, a spec deve dizer que ela é só uma guarda.

Recomendações:
- §5 "A pergunta sem resposta": diga quais códigos de `falhou` entram em `semRespostaHoje`. Hoje entram também a S12 (avaliação aberta), o `NAO_ENCONTRADO` e o `FUNCAO_SUSPENSA`. Também falta o caso da D36 gravada com a execução já encerrada: o aluno recebeu a mensagem fixa e mesmo assim a pergunta conta como sem resposta. O `conformidade-reviewer` deve olhar a S12 ali.
- Com a mudança, `ultimaTrocaEm` e `ultimaReferencia` passam a poder apontar para uma pergunta que falhou, e o comentário de `packages/shared/src/tutor/uso.ts` ("Troca é a mensagem que o aluno mandou") e o nome `ultimaTrocaEm` ficam ambíguos frente a `trocasHoje`, que não conta a que falhou. Ajuste o texto do contrato.
- §2 cita "a tela de uso" sem o caminho do arquivo.
- §5 "A web": `FALHA_DA_AREA` diz "Confira a conexão e tente de novo". Na raiz, a causa costuma ser um erro de renderização, não a rede, então o texto engana ali.
- `cenarios.md` §5: "`levaTextoDeAluno: true` exige `conversa_do_aluno` ou `conversa_do_professor`" deixa uma tarefa que leva texto de aluno declarar só `conversa_do_professor`. O certo é exigir `conversa_do_aluno`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/tutor/supervisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/task.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/components/AreaErrorBoundary.tsx

## test-engineer · 3ª rodada · REPROVADO · 2026-11-15 02:48:17 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os cinco bloqueantes da rodada 2, cada um no ponto da Tech Spec e de `cenarios.md` que o corrige. Também o desenho novo: a pergunta sem resposta no uso do professor (Tech Spec §5, `cenarios.md` §1) e o `maximoDeTokensDeEntrada` (Tech Spec §8, `cenarios.md` §3). Para cada um verifiquei se a mutação citada deixaria o teste vermelho e se a correção abriu buraco novo.

**Cobertos:**
- **(1) Corte só pelo processador e corte só pelo `GET`:** feito. Os dois casos estão em `cenarios.md` §1, "O corte dos 20 s", cada um com a sua mutação. As duas mutações caem.
- **(2) Ordem do processador e o [P] nas duas ordens:** feito. O processador tenta primeiro o `pendente → rodando` com a condição de idade, e só corta se nenhuma linha mudar. A mutação da condição de idade cai na ordem "processador primeiro". Na ordem "`GET` primeiro", a métrica contada sem transição cai pelo lado do processador. Fica uma recomendação para o lado do `GET`.
- **(3) Corridas separadas por momento e pool do banco:** feito em parte. "Depois de `concluida`", "em corrida durante `rodando`" e "as duas leem `pendente`" estão separados, e o pool está lá. Falta a varredura em paralelo (bloqueante 3).
- **(4) Espera do teto dentro do corte do perfil:** o cenário existe, mas a mutação sobrevive (bloqueante 2).
- **(5) `categoriasEnviadas` de toda tarefa no `DECLARADO`:** feito (`cenarios.md` §5), com a mutação.
- **Desenho novo:** o filtro de `falhou`, o recorte de disciplina e o DTO sem texto da pergunta sem resposta estão cobertos. A recusa por `maximoDeTokensDeEntrada` tem o caso negativo e o `@ts-expect-error`.
- **Sem pendência:** isolamento (§6), D36 e S12 (§2), D62 (§5), web (§7) e rastro (§3).

**Bloqueantes:**

1. **O corte do `GET` tem duas cláusulas sem cenário.** Onde: Tech Spec §5, tabela de estados, linha `pendente`; `cenarios.md` §1, "O corte dos 20 s".
   - O `update` do `GET` leva "as mesmas cláusulas": `estado = 'pendente'` e "só `interativa`". Nenhum cenário falha sem elas. O "`GET` aos 15 s" só prova a idade, e o caso de 404 só prova o escopo.
   - Sem `estado = 'pendente'`, um `GET` aos 25 s sobre uma `concluida` ou uma `rodando` vira `falhou IA_INDISPONIVEL`. Para isso basta a tela recarregar ou o turno ter começado aos 19 s: a resposta já entregue some.
   - Sem o filtro de fila, a ferramenta que o professor fica consultando é cortada aos 21 s. Isso acontece justamente quando as 4 vagas dela estão cheias.
   - Correção exigida, três casos [I]:
     - `GET` com mais de 20 s sobre uma `concluida`: nenhuma escrita, a resposta continua, `ia.espera_estourada` não soma.
     - O mesmo sobre uma `rodando`.
     - `GET` sobre uma `pendente` da `ferramenta` com 21 s: nenhuma escrita, e ela roda depois.
   - Mutações: tirar `estado = 'pendente'` do `GET`; tirar o filtro de fila do corte do `GET`.

2. **No teste do prazo, a mutação "contar a espera fora do corte" sobrevive.** Onde: `cenarios.md` §4, "[I] O prazo"; Tech Spec §5, linha `rodando`.
   - Com a mutação, a ferramenta termina em 8 + 140 = 148 s. Isso ainda fica abaixo de 150 s, sem reentrega, e o teste passa.
   - O teste de configuração, "corte + espera máxima < `prazoMs`", contradiz a §5, que põe a espera *dentro* do corte. E ele dá verde nos dois desenhos.
   - Correção exigida:
     - O caso [I] afirma, pelo relógio injetado, que a execução termina aos 140 s contados da entrada em `rodando`, e não aos 148 s. O mesmo vale para o `rapido`: 60 s, com os 8 s de espera dentro.
     - O teste de configuração passa a conferir `corte < prazoMs − folga da reentrega`.
     - O cenário diz como prova "sem reentrega" sem esperar 150 s de verdade: `prazoMs` em escala no teste, ou a prova só pela configuração.

3. **A varredura com duas réplicas não é teste de concorrência.** Onde: `cenarios.md` §1, "[I] Varredura com duas réplicas".
   - Rodada em sequência, a segunda réplica já acha `falhou`. Então tirar `where estado = 'rodando'` do `update` da varredura não muda nada.
   - No mundo real, as duas réplicas rodam a cada 60 s e se sobrepõem. Sem a cláusula, gravam duas linhas estimadas em `consumo_ia` e o custo conta em dobro.
   - Correção exigida: [P] com barreira entre o `select` da varredura e o `update`. Resultado esperado: um encerramento e uma linha estimada. Mutação: tirar a condição de estado do `update` da varredura.

4. **No `semRespostaHoje`, o "de hoje" não tem caso que o prove.** Onde: Tech Spec §5, "A pergunta sem resposta"; `cenarios.md` §1, "O professor vê a pergunta sem resposta".
   - O cenário só tem perguntas de hoje. Contar todas as `falhou` passa verde.
   - Correção exigida:
     - Acrescentar uma pergunta cortada ontem. Uma delas fica perto da meia-noite de Brasília, com a mesma referência de dia do `trocasHoje`.
     - Esperado: `semRespostaHoje` continua 2.
     - Mutação: tirar o filtro de dia.

5. **Nada prova que o `maximoDeTokensDeEntrada` deixa passar o pedido legítimo.** Onde: Tech Spec §8; `cenarios.md` §3.
   - O teto sai do "maior pedido dos testes de hoje com folga". Os testes de hoje usam histórico e trecho curtos.
   - Numa sessão real, o histórico cresce. O Tutor passaria a dar `IA_INDISPONIVEL` em todo turno, em sala, e nenhum teste fica vermelho (regra 80).
   - Correção exigida, por tarefa:
     - Um caso [U] que monta, pelo `montarPedido`, o pior pedido permitido: histórico no limite, trecho do material no limite, entrada no máximo do DTO. Ele confere que esse pedido cabe no teto.
     - Se o `montarPedido` não tem limite, a Tech Spec diz o que corta o pedido antes do teto.
     - Mutação: o teto abaixo do pior pedido.
   - No Tutor, o caso de recusa confere também que a troca não conta e que nenhum orçamento foi reservado.

6. **A linha do aluno no uso a 360 px está prometida e não tem cenário.** Onde: Tech Spec §9; `cenarios.md` §7, [E].
   - A §9 lista três coisas no `celular` a 360 px: o `Falha`, o aviso da espera e a linha do aluno no uso. O [E] cobre só as duas primeiras.
   - Correção exigida: o [E] inclui a linha do aluno no uso com "N sem resposta hoje". Sem rolagem horizontal, alvos de 44 px, axe.

**Recomendações:**
- **Corte, ordem "processador primeiro":** pôr a barreira entre a leitura do `GET` e o `update` dele. Assim o `GET` tenta cortar e recebe zero linhas, e a métrica contada sem transição cai também pelo lado do `GET`.
- **Pool do banco:** dizer que o `select` "de fora" usa o pool da própria réplica, com tempo curto para pegar conexão. Feito com outra conexão, não prova nada.
- **Como dar idade às linhas:** as transições usam o `now()` do banco, então os 21 s, 299 s e 301 s se fazem recuando `criada_em` e o início no banco. Um relógio de JS injetado não move o `now()`.
- **Entrega duplicada durante `rodando`:** citar a mutação de concluir sem `where estado = 'rodando'`.
- **Regra do `DECLARADO`:** por que `levaTextoDeAluno: true` aceita só `conversa_do_professor`? A D62 pede `conversa_do_aluno`. Ou se exige essa, ou se escreve o motivo.
- **Pergunta sem resposta:** dizer o que acontece com a pergunta cortada que o aluno reenviou pelo "Tentar de novo" e que foi respondida. Hoje ela conta como "sem resposta", o que pode enganar o professor. Acrescentar o caso do professor que dá duas disciplinas na mesma turma: ele vê as duas.
- **`maximoDeTokensDeEntrada`:** a recusa vem antes do `TokenLimiter`, como na D62. O caso confere "nenhum orçamento reservado".
- **Alerta do RF5:** o caso de borda do PRD §7 ("o alerta diz uma escola grande") ganha conferência da expressão do alerta, além da existência do runbook.

Tudo isso está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`.

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-15 02:48:58 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor | fila | IA | login | prova | migration | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ausente (dois buracos, nos bloqueantes 1 e 2)
Migration: compatível
Métrica e alerta: ok

Bloqueantes:

1. **Tech Spec §5, "Os tokens" e a linha `rodando` da tabela de estados; `cenarios.md` §4, caso "O prazo": o "corte do perfil" vale por chamada, não por execução, e a ferramenta passa dos 150 s.**
   - A spec diz que o corte de 60 s ou 140 s, já com a espera dos tokens, "fica abaixo dos 150 s". No código não é assim:
     - `packages/core/src/ia/resilient-adapter.ts:144-167` aplica o `timeout(prazoMs)` a cada `adaptador.chamar`.
     - `packages/core/src/ia/llm-gateway.ts:35` e `:192-196` fazem até 2 chamadas (`TENTATIVAS_MAXIMAS = 2`), e cada uma ganha o prazo inteiro.
     - O degrau do modelo menor acrescenta mais uma chamada.
   - Na `ferramenta`, o pior caso é 8 + 140 + 140 s. Isso estoura o `prazoMs`, e o `JobExecutor` aborta o sinal e encerra o job, que só tem uma tentativa. A execução fica `rodando` até a varredura dos 300 s. Durante esse tempo o professor fica olhando um "gerando". No fim sai uma linha estimada de uma chamada só, quando foram feitas duas, o que subestima o consumo (D14).
   - O teste "corte + espera < `prazoMs`" soma um corte e uma espera só, então fica verde com o defeito.
   - Correção exigida:
     - Um prazo único por execução, criado no início do `ExecucaoProcessor` e repassado como `pedido.sinal`. Ele cobre a espera dos tokens, as duas tentativas e o modelo menor, e cada chamada usa o mínimo entre o prazo do perfil e o que sobrou.
     - Quando esse prazo estoura, o processador grava `falhou IA_INDISPONIVEL` por `update` condicional, e isso não fica para a varredura.
     - No `cenarios.md` §4, dois casos com relógio falso: (a) a primeira saída inválida e a segunda chamada lenta; (b) a espera de 8 s e depois o modelo menor lento. Os dois terminam antes de 150 s, sem `EXECUCAO_INTERROMPIDA`. A mutação é voltar ao prazo por chamada.
   - O `llm-integrator` achou o mesmo defeito na rodada 3.

2. **Tech Spec §8, `maximoDeTokensDeEntrada` "tirado do maior pedido dos testes de hoje com folga"; `cenarios.md` §3: o desenho novo recusa entrada válida de produção, e "Tentar de novo" não resolve.**
   - Os fixtures dos testes têm trechos sintéticos curtos. O schema do Tutor aceita muito mais (`packages/core/src/ia/tasks/turno-do-tutor.ts:57-64`): 8 trechos de até 8.000 caracteres, 8 turnos de 2.000 e a questão. Isso dá cerca de 85 mil caracteres, ou ~21 mil tokens. Uma página real do PDF tem milhares de caracteres (`pdf-extractor.ts`, `MAXIMO_DE_CARACTERES_DO_TRECHO = 20_000`).
   - Às 10h, com material real, o aluno com conversa longa ou com trechos grandes passa do teto em toda mensagem. O histórico não encolhe, então cada "Tentar de novo" é recusado de novo, e a conversa fica travada.
   - A recusa sai como `IA_INDISPONIVEL`, o mesmo código da falta de capacidade. O operador não distingue as duas coisas, e o alerta da espera não pega.
   - Correção exigida:
     - O teto de cada tarefa sai do pedido máximo que o schema de entrada permite, montado pelo `montarPedido` com o prompt de sistema.
     - Um teste por tarefa monta a entrada válida máxima e prova que ela passa abaixo do teto. A mutação é baixar o teto.
     - A recusa, que então só acontece por defeito, ganha código, log e métrica próprios, por exemplo `ia.pedido_acima_do_teto{tarefa}`, sem escola nem usuário. Ela não se confunde com `IA_INDISPONIVEL` e entra num alerta com runbook.

Conferência das correções exigidas na rodada 2:
- **O contrato de tokens: feito.** A §7c traz o piso (1,5 + 0,2) ÷ 0,7 ≈ 2,5 milhões com a `normal` cheia, registrado no `docs/infra.md`. Conferi a conta: com 2,5 milhões o Tutor fica com 62 %, cerca de 1,55 milhão contra 1,5 de demanda, e a `ferramenta` cabe nos 15 % (375 mil contra 200 mil). O `carga.env` sai do piso na escala do falso (3.000 + 250 por turno), em `cenarios.md` §8.
- **As recomendações da rodada 2 entraram:**
  - o alerta medido sobre o contratado;
  - a varredura como `not exists`, com o `EXPLAIN` na tarefa;
  - o corte do `GET` só com a linha vencida;
  - o rollback com linhas de `ferramenta` e de tipo desconhecido (§13).
  - A espera "dentro do corte do perfil" foi escrita, mas no código não vale, e esse é o bloqueante 1.
- **`semRespostaHoje` (§5) não precisa de índice novo.** A consulta tem o mesmo formato de `trocasDeHoje` (`supervisao.repository.ts:277`), cobre só os alunos da página e desce por `mensagem_tutor_trocas_idx` e `mensagem_tutor_aluno_idx`.

Recomendações:
- **§7c, alerta "Tokens acima de 80 %" do contratado.** Esse ponto é o próprio teto do balde. O alerta só dispara quando os alunos já estão esperando 8 s, e no pico nominal a folga é de 2 pontos. Ponha um aviso antes, por exemplo 70 % do contratado, ou escreva no runbook que esse alerta é de saturação.
- **§12, os 3.000 tokens por turno.** O `docs/avaliacao-de-modelos.md:37` considera 5.000 + 300 mais realista. Com esse número o Tutor vai a ~2,4 milhões por minuto e o piso a ~3,7 milhões. Registre os dois pisos no `docs/infra.md` e marque a premissa como não verificada.
- **§5, `RateLimiterRedis` com `duration: 60`.** É janela fixa, e na virada do minuto pode sair uma rajada acima do que o provedor mede em janela móvel. Use uma janela menor com pontos proporcionais, ou o `BurstyRateLimiter`, e diga qual.
- **§5, a varredura.** O `job_registro_pendentes_idx` começa por `fila` (`job-registro.ts:44-46`). Ponha `fila in ('interativa','ferramenta','normal')` no `not exists`.
- **§5, os cortes do perfil.** Diga se 60 s e 140 s são os novos padrões de `LLM_TIMEOUT_MS_RAPIDO` e `LLM_TIMEOUT_MS_PADRAO`, que hoje são 20 s e 60 s em `llm-config.ts:84-88`. Com 60 s no Tutor, um provedor lento ocupa as 10 vagas da escola bem mais cedo.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md

## llm-integrator · 4ª rodada · APROVADO · 2026-11-15 02:52:34 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

Perfis usados: `rapido` (o corte da execução é de 60 s) e `padrao` (140 s). O Tutor usa `rapido` e as ferramentas usam `padrao`. Não há perfil `complexo` nem tarefa nova de modelo, e o spec dispensa prompt novo. O degrau para `LLM_MODELO_MENOR_<PERFIL>` desce no preço, e o `turno_do_tutor` o pula (D36, regra 30.11).

Custo estimado por professor/mês: não há chamada nova de modelo; o custo é o de hoje (Tech Spec §8). O spec traz a estimativa por escola: o piso de tokens por minuto, que ele próprio marca como NÃO VERIFICADO, a ser medido na `FASE=sala`. Sem a estimativa por professor, a precificação ainda depende dessa medição.

Prompt versionado: sim. Os prompts continuam nos arquivos de hoje (`packages/core/src/ia/prompts`).

Validação de schema: sim. O schema de saída e a repetição por saída inválida (`IA_SAIDA_INVALIDA`) seguem como estão. O que mudou é o `maximoDeTokensDeEntrada`, calculado do pior pedido válido, com recusa só como guarda.

Aprovação humana no caminho: sim. A entrega nasce `pendente`. A exceção é o Tutor (D47), supervisionado. A interrompida e a estourada não produzem entrega.

Bloqueantes: nenhum. O bloqueante da rodada 3 foi corrigido.
- O prazo único da execução está no Tech Spec §5, linha `rodando`. Ele é contado do `rodando`, repassado como `pedido.sinal`, e cobre a espera dos tokens, as tentativas do gateway e o degrau.
- Confere com `packages/core/src/ia/llm-gateway.ts:195`, onde o gateway já repassa `pedido.sinal` ao adaptador.
- Confere com `resilient-adapter.ts:75-131`. O sinal de quem chamou aborta o `fetch` e a espera da repetição. O prazo do perfil continua por fora, então vale o menor entre os dois.
- O `cenarios.md` §4 cobre o prazo contado do `rodando` (140 s, não 148 s) e as duas sequências lentas. A mutação "prazo por chamada" e a mutação "contar a espera fora do prazo" estão nomeadas.
- Os 60 s e 140 s ficam abaixo do `prazoMs` de 150 s menos a folga da reentrega, e há teste de configuração para isso.
- A reserva de tokens nova a cada chamada, acertada pelo uso real, está no §5 "Os tokens".

Recomendações:
1. Código de erro do estouro. `errors.ts:13` já tem `IA_TEMPO_ESGOTADO`, e o spec manda gravar `falhou IA_INDISPONIVEL` quando o prazo da execução estoura. Isso é coerente, porque o aluno vê o mesmo "Tentar de novo". Ainda assim, uma frase no §5 diria se o estouro do prazo da execução vira `IA_INDISPONIVEL` por escolha ou se `IA_TEMPO_ESGOTADO` fica só para o corte do adaptador. `consumo_ia.codigo_de_erro` e o alerta dependem dessa distinção.
2. `PEDIDO_ACIMA_DO_TETO`. O código não existe em `LLM_ERROR_CODES` nem em `ErrorCode` hoje. O spec cita o nome e `cenarios.md:100` o testa, mas o §3 não lista o código novo em `packages/shared` com o status HTTP em `HTTP_STATUS_BY_CODE`. Vale acrescentar essa linha na tarefa.
3. Distinguir o cancelamento do estouro. `resilient-adapter.ts:131` converte o sinal abortado em `ChamadaCancelada`. O processador precisa separar "o prazo da execução venceu" (`falhou IA_INDISPONIVEL`) de "o worker foi encerrado" (reentrega). Um caso no `cenarios.md` §4 para o abort por desligamento do worker fecharia essa distinção.

## revisor-geral · 4ª rodada · REPROVADO · 2026-11-15 02:54:52 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado.

**Aderência à Tech Spec:** há divergência entre o PRD e a Tech Spec no alerta de tokens. O desenho também tem um furo novo na contagem `semRespostaHoje`.

**Portão local:** não se aplica, porque é revisão de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta fase.

A correção que eu exigi na rodada 3 foi feita: o `maximoDeTokensDeEntrada` sai do pior pedido válido, e a recusa virou guarda de defeito, com código, métrica e alerta, mais um caso por tarefa com mutação na §3 dos cenários. O prazo único da execução também está coerente com o código de hoje: o `pedido.sinal` já existe no `adapter.ts:15` e as tarefas só usam os perfis `rapido` e `padrao`. A Tech Spec tem 1.997 palavras.

**Bloqueantes**

1. **O alerta de tokens tem um número no PRD e outro na Tech Spec.**
   - O PRD, no RF8 (§5), diz "Tokens acima de 80 %".
   - A Tech Spec, na §7c, linha "Métrica e alerta", passou para "Tokens acima de 70 %" do contratado, com o motivo "aos 80 % o balde satura".
   - Na rodada 3 isso entrou como "recomendação acolhida", sem constar que muda critério do PRD. O PRD já está aprovado e não foi atualizado.
   - O teste de alertas vai conferir 70 %, e o Validador, lendo o RF8, vai procurar 80 %.
   - **Correção exigida:** alinhar o RF8 do PRD a "Tokens acima de 70 % do contratado", com a palavra do Joaquim, porque o PRD está aprovado. A outra saída é voltar a Tech Spec ao texto do PRD. O "Pedido acima do teto" também deveria entrar na lista de alertas do RF8.

2. **A contagem `semRespostaHoje` deixa de fora perguntas que o Tutor não respondeu** (Tech Spec §5, "A pergunta sem resposta"; `cenarios.md` §1).
   - A contagem só inclui `IA_INDISPONIVEL` e `EXECUCAO_INTERROMPIDA`.
   - Ficam de fora `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA` e o novo `PEDIDO_ACIMA_DO_TETO`. Os três terminam a execução em `falhou`, e o aluno vê o mesmo "Tentar de novo" (`apps/web/src/api/ciclo-de-execucao.ts:109-118`; o `PEDIDO_ACIMA_DO_TETO` só depois de entrar nessa lista, ver recomendação 1).
   - O provedor lento é o cenário central do PRD (§1). Hoje o corte do `LLM_TIMEOUT_MS_RAPIDO` (20 s), que a própria linha `rodando` mantém ("o menor entre o `LLM_TIMEOUT_MS_*` e o que sobra"), termina em `IA_TEMPO_ESGOTADO` (`resilient-adapter.ts:51,76`). O sinal do prazo único abortado também vira `ProviderError('tempo')`, ou seja, `IA_TEMPO_ESGOTADO` (`openai-compat-adapter.ts:124,156`).
   - Resultado: o provedor fora entra na conta, o provedor lento não. E a tela diz ao professor "N perguntas que o Tutor não respondeu hoje" com um número menor que o real. Isso contradiz o PRD §4 ("ver no uso a troca sem resposta") e a regra 70.4 (nenhum uso invisível ao professor).
   - **Correção exigida:**
     - Definir a contagem pelas falhas que passam sozinhas (a mesma lista `PASSAGEIROS` da web: `IA_INDISPONIVEL`, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`, `EXECUCAO_INTERROMPIDA` e `PEDIDO_ACIMA_DO_TETO`). A outra saída é contar todo `falhou`, menos S12, `FUNCAO_SUSPENSA`, `NAO_ENCONTRADO` e a mensagem fixa.
     - Pôr em `cenarios.md` §1 um caso com `IA_TEMPO_ESGOTADO` e um com `IA_SAIDA_INVALIDA` contando, e a mutação "contar só `IA_INDISPONIVEL`".

**Recomendações**

1. **`PEDIDO_ACIMA_DO_TETO` é código novo de contrato, e a §2 não lista onde ele entra.** Faltam `packages/shared/src/errors/` (`error-code.ts`, `messages.ts`), o `HTTP_STATUS_BY_CODE` de `domain.exception.ts`, o `LLM_ERROR_CODES` de `packages/core/src/ia/errors.ts` e a lista `PASSAGEIROS` de `apps/web/src/api/ciclo-de-execucao.ts`. Sem entrar nessa lista, `aparenciaDaFalha` devolve `'explicada'`, e o aluno não vê "Tentar de novo", como a §8 promete. Cabe um caso [U] na §7 dos cenários. Também vale dizer por que "Tentar de novo" serve para uma falha que se repete igual com o mesmo pedido.
2. **O código do prazo único estourado.** A Tech Spec grava `IA_INDISPONIVEL`, mas o catálogo de hoje já documenta `IA_TEMPO_ESGOTADO` para "a execução passou do dela" (`errors.ts:14`, `executor.ts:214`), e o adaptador abortado pelo sinal já produz esse código. Ou se mantém o código de hoje, ou a Tech Spec diz que o processador troca o código, e por quê.
3. A §8 poderia dizer se a recusa por `PEDIDO_ACIMA_DO_TETO` grava ou não uma linha em `consumo_ia`, como já faz para a interrompida.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/api/ciclo-de-execucao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/errors.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/resilient-adapter.ts`

```
VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em PRD RF8 ("Tokens acima de 80 %") contra Tech Spec §7c ("70 %")
Portão local: não se aplica (revisão de spec, sem código; o conferir diz "nunca passou nesta árvore")
Bloqueantes: (1) PRD §5 RF8 contra Tech Spec §7c: o número do alerta de tokens diverge; alinhar o PRD com a palavra do Joaquim, ou voltar a Tech Spec ao PRD. (2) Tech Spec §5 "A pergunta sem resposta" e cenarios.md §1: semRespostaHoje deixa fora IA_TEMPO_ESGOTADO, IA_SAIDA_INVALIDA e PEDIDO_ACIMA_DO_TETO, e o provedor lento some da conta do professor; contar as falhas que passam sozinhas (a lista PASSAGEIROS) e pôr os casos e a mutação nos cenários
Recomendações: PEDIDO_ACIMA_DO_TETO na §2 (shared/errors, HTTP status, LLM_ERROR_CODES, PASSAGEIROS da web) e caso [U] na §7; o código do prazo único (IA_TEMPO_ESGOTADO de hoje ou a troca justificada); dizer se a recusa por teto grava consumo_ia
```

## infra-guardian · 4ª rodada · APROVADO · 2026-11-15 02:55:15 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor | fila | IA | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

As duas correções exigidas na rodada 3 foram feitas e conferem com o código de hoje:

- **(1) Prazo único da execução (Tech Spec §5, linha `rodando`; cenarios.md §4).** O código já sustenta o desenho. `ResilientAdapter.chamar` repassa `chamada.sinal` ao `execute` do `cockatiel`. O `timeout(prazoMs, Aggressive)` de fora corta a chamada no menor entre o `LLM_TIMEOUT_MS_*` e o sinal de quem chamou. O abort de quem chamou vira `ChamadaCancelada` e não pesa no disjuntor (`falhaDe` devolve `undefined`). As contas do pior caso ficam dentro do prazo:
  - `rapido`: 8 s + 20 s + 8 s + 20 s = 56 s, abaixo de 60 s.
  - `padrao`: 8 s + 60 s + 8 s + 60 s = 136 s, abaixo de 140 s, que fica abaixo do `prazoMs` de 150 s.
  - Toda tarefa usa `rapido` ou `padrao`, então nenhuma fica sem prazo.
  - O cenário de configuração e a mutação "prazo por chamada" garantem a folga.
- **(2) Teto de entrada (§8; cenarios.md §3).** Todo `esquemaDeEntrada` é limitado (por exemplo, `tutorInputSchema` e `assistenteInputSchema` têm `max` em cada string e cada array), então o pior pedido válido é calculável. Os checks `execucao_agente_erro_e_codigo` e `consumo_ia_erro_e_codigo` aceitam o código pelo formato, e por isso `PEDIDO_ACIMA_DO_TETO` não pede migration. A métrica, o alerta e o runbook entram no teste de alertas (§4).
- **Recomendações da rodada 3, todas acolhidas.**
  - O `fila in (…)` cai no `job_registro_pendentes_idx`, que é `(fila, escola_id, criado_em)` parcial.
  - O alerta passou a disparar aos 70 % do contratado.
  - Os dois pisos estão no §12.

Recomendações:
1. **§5, "Os tokens":** a Tech Spec não diz a ordem nem a devolução dos dois baldes. Se a `ferramenta` consumir no balde geral e for recusada no dos 15 %, cada nova tentativa nos 8 s de espera gasta balde geral sem chamada nenhuma. Às 10h isso tira capacidade do Tutor. A tarefa 49.0 deve:
   - consumir primeiro o balde da fila e, se o geral recusar, devolvê-lo com `reward`;
   - esperar pelo `msBeforeNext`, em vez de ficar tentando em laço;
   - ganhar um cenário [I]: com a `ferramenta` esperando no teto dela, o balde geral não sobe e o Tutor roda com o geral perto do limite.

   Vale registrar também que o `RateLimiterRedis` conta por janela fixa: na virada do minuto pode passar quase o dobro, e quem responde por isso é o 429 do provedor.
2. **Código gravado quando o prazo estoura.** No `ResilientAdapter`, o prazo estourado sobe como `IA_TEMPO_ESGOTADO` (`traduzir`, `TaskCancelledError`). Se o abort pegar o `TokenLimiter` na espera, pode subir um erro que não é `LLMError`, e o `LLMGateway` o registra como `ia.geracao.erro_inesperado`. Melhor o processador decidir "prazo estourado" pelo próprio sinal, gravando `IA_INDISPONIVEL` seja qual for o código que subiu, e o gateway não registrar o abort como erro inesperado.
3. **§5, "A pergunta sem resposta":** `semRespostaHoje` não conta o turno do Tutor que termina `IA_TEMPO_ESGOTADO` (uma chamada que passou dos 20 s), `IA_SAIDA_INVALIDA` ou `PEDIDO_ACIMA_DO_TETO`. Com o provedor lento na manhã cheia, a falha mais comum é a primeira, e ela some do que o professor vê. O RF5 só exige o corte dos 20 s, então isso não bloqueia, mas vale levar ao `conformidade-reviewer`.
4. **PRD RF8:** ainda diz "Tokens acima de 80 %", e a Tech Spec §7c diz 70 %. Alinhar o PRD para a validação não conferir contra o número antigo.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/resilient-adapter.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/llm-gateway.ts

## test-engineer · 4ª rodada · REPROVADO · 2026-11-15 02:56:04 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos**
- O corte dos 20 s no processador e no `GET`, nas duas ordens, e o `GET` sobre `concluida`, `rodando` e `ferramenta`.
- A varredura em paralelo.
- O `semRespostaHoje`: o dia, os códigos que contam, o recorte e a linha a 360 px.
- O pior pedido válido contra `maximoDeTokensDeEntrada` e a recusa `PEDIDO_ACIMA_DO_TETO`.
- O prazo único da execução: espera, tentativas e degrau dentro de 60 s e 140 s.
- O isolamento do corte e da varredura.
- O e2e do uso em `celular`.

**Cobertos.** Cinco das seis correções da rodada 3 foram feitas:
1. **O `GET` sobre `concluida`, `rodando` e `ferramenta`:** feita, em cenarios.md §1, "O corte dos 20 s".
2. **A varredura em paralelo:** feita, em §1, [P] "Varredura com duas réplicas". A mutação "tirar a condição de estado do `update`" fica vermelha com qualquer desenho: sem a condição, até duas passadas em sequência encerram duas vezes.
3. **O "de hoje":** feita, em §1, a pergunta de ontem às 23h50 de Brasília.
4. **O pior pedido por tarefa:** feita, em §3. Os `esquemaDeEntrada` de hoje são todos limitados (`turno-do-tutor.ts:39-64`, `propor-ferramenta.ts:21-25`, `gerar-plano-de-aula.ts:20-24`, `gerar-atividade-objetiva.ts:24-30`).
5. **A linha do uso a 360 px:** feita, em §7 [E].
6. **O prazo de 140 s e não 148 s:** escrita, mas não fecha. É o bloqueante 1.

A recusa acima do teto, sem `fetch` e sem orçamento, tem caso em §3 [U], e o isolamento do corte tem caso em §6.

**Bloqueantes**

1. **cenarios.md §4, "O prazo único da execução", os dois [I]: com a configuração de hoje, o prazo único nunca chega a valer, e as duas mutações passam.**
   - O prazo de cada chamada já cobre a chamada e a repetição (`packages/core/src/ia/resilient-adapter.ts:28`, `:167`). Os padrões são `LLM_TIMEOUT_MS_RAPIDO` 20 s e `LLM_TIMEOUT_MS_PADRAO` 60 s (`llm-config.ts:86`, `:88`).
   - O gateway só repete quando a saída é inválida. Erro do adaptador sobe direto (`llm-gateway.ts:192-205`).
   - O Tutor é `rapido` (`tarefas.test.ts:42`). Na pior ordem, 8 + 20 + 8 + 20 = 56 s, abaixo dos 60 s. Então "o Tutor, aos 60 s" não acontece.
   - A ferramenta `padrao` com o modelo pendurado termina aos 8 + 60 = 68 s, pelo prazo da chamada. Isso vale com a regra certa e também com "contar a espera fora do prazo".
   - "Primeira saída inválida e segunda chamada lenta" fica em no máximo 8 + 60 + 8 + 60 = 136 s, abaixo de 140 s. A mutação "prazo por chamada" também passa.
   - Há ainda uma mistura de relógios: o prazo da execução roda no relógio falso e o `prazoMs` "em escala", no relógio real. Assim, "sem reentrega nem `EXECUCAO_INTERROMPIDA`" nunca falharia.

   **Correção exigida:**
   - O cenário fixa `LLM_TIMEOUT_MS_<PERFIL>` acima do que sobra do prazo (por exemplo, 600 s).
   - No segundo caso, os tempos fazem a soma por chamada passar do `prazoMs`. Por exemplo: prazo de chamada de 100 s, a 1.ª chamada inválida aos 90 s e a 2.ª pendurada. Com a regra, termina aos 140 s; com a mutação, aos 190 s, e vem a reentrega.
   - O prazo da execução e o do job correm no mesmo relógio, ou a asserção é o instante em que a execução termina.

2. **cenarios.md §1, "O professor vê a pergunta sem resposta": `EXECUCAO_INTERROMPIDA` em `semRespostaHoje` é cláusula nova (Tech Spec §5, "A pergunta sem resposta") e não tem caso.**
   - Os casos positivos usam só perguntas cortadas (`IA_INDISPONIVEL` sem `rodando`).
   - Uma implementação que conte só `IA_INDISPONIVEL`, ou só a pendente cortada (por exemplo, `iniciada_em is null`), passa em tudo.
   - Também falta caso para o `IA_INDISPONIVEL` dado pelo estouro do prazo único.

   **Correção exigida:** um caso com uma reentrega (`EXECUCAO_INTERROMPIDA`) e um com o estouro do prazo (`rodando` para `IA_INDISPONIVEL`), os dois contando em `semRespostaHoje`. A mutação é "contar só o corte".

3. **cenarios.md §3: "`PEDIDO_ACIMA_DO_TETO`, que o aluno vê como 'Tentar de novo'" (Tech Spec §8) não tem caso, e com o código de hoje isso não acontece.**
   - `aparenciaDaFalha` (`apps/web/src/api/ciclo-de-execucao.ts:109-134`) trata como `'fila'` (o "Tentar de novo") só os códigos da lista `PASSAGEIROS`.
   - Um código novo fora dela vira `'explicada'`.

   **Correção exigida:** um [U] em `ciclo-de-execucao.test.ts` com `aparenciaDaFalha(PEDIDO_ACIMA_DO_TETO) === 'fila'`. A mutação é deixar o código fora de `PASSAGEIROS`.

**Recomendações**
- **§1, `GET` sobre `concluida`/`rodando` e sobre `ferramenta`:** o desenho decide o corte na leitura ("vê-la vencida"; o `GET` aos 15 s não escreve) e repete as cláusulas no `update`. Tirar só uma das duas camadas deixa esses [I] verdes. Vale dizer que a mutação desses casos é na decisão da leitura. A cláusula de estado do `update` se prova no [P] "processador primeiro"; cite-a como mutação lá.
- **§1, [P] da varredura:** a barreira "entre o `select` e o `update`" supõe dois passos, e a Tech Spec descreve um `update … returning`. Com um comando só, a barreira fica entre o `update` e o `commit`.
- **§1, "de hoje":** fixar o "agora" do uso em um horário entre 00h e 21h de Brasília e acrescentar a mutação "dia em UTC". Como está, ela só fica vermelha conforme a hora em que a esteira roda.
- **§1, "não contam":** pôr na lista o `PEDIDO_ACIMA_DO_TETO` e a recusa da D62, que é `IA_INDISPONIVEL` e hoje contaria. Isso deixa explícito o que o professor vê.
- **§3:** o gerador do pior pedido falha quando algum campo de `esquemaDeEntrada` não tem limite, para que uma tarefa nova não passe com o teto errado. E "a troca não conta" não se observa num [U] do gateway: mova para um [I] ou tire.
- **§4:** um caso com o prazo vencendo durante a espera da 2.ª reserva de tokens, em que a espera respeita o `pedido.sinal`.
- **PRD RF8 contra Tech Spec §7c:** o RF8 diz "Tokens acima de 80 %" e a Tech Spec diz 70 %. Alinhar antes de o teste de alertas fixar um dos dois.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md`

## revisor-geral · 5ª rodada · APROVADO · 2026-11-15 02:59:50 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O PRD e a Tech Spec dizem o mesmo nos dois pontos da rodada 4. A Tech Spec tem 1.997 palavras.
Portão local: não se aplica. Esta é uma revisão de spec, sem código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta fase.
Bloqueantes: nenhum

As duas correções exigidas foram feitas e batem com o código de hoje:
- **Alerta de tokens (§7c):** agora diz "Tokens acima de 80 %" do contratado, como o RF8, com aviso aos 70 %. A conta fecha: a Tech Spec pede um contrato de cerca de 2,5 milhões de tokens por minuto, e o pico de 1,7 milhão dá ~68 %. O balde geral é 80 % do `LLM_TOKENS_POR_MINUTO`, que é o contratado, então "80 %" é mesmo o balde cheio.
- **Pergunta sem resposta (§5):** `semRespostaHoje` conta os códigos da lista `PASSAGEIROS`, que hoje está em `apps/web/src/api/ciclo-de-execucao.ts:109`. O prazo estourado grava `IA_TEMPO_ESGOTADO`, o código que `packages/core/src/ia/executor.ts:214` já usa. A S12 (avaliação aberta) grava `TUTOR_PAUSADO_EM_AVALIACAO`, que não está na lista; a suspensão e o `NAO_ENCONTRADO` também ficam fora. A exclusão que a spec declara bate com o código.

Recomendações:
1. **§7c, alerta "Tokens acima de 80 %":** o balde geral corta as reservas em exatamente 80 % do contratado. Um alerta com a condição "estritamente maior que 0,8" quase nunca dispara. Só dispararia com a estimativa de caracteres ÷ 4 abaixo do real, ou com o `insuranceLimiter` ligado. A tarefa deve dizer que a condição é "maior ou igual a 0,8", ou que o alerta lê a recusa do balde. O teste de alertas (`cenarios.md`, linha 137) deve provar que o balde cheio dispara o alerta.
2. **§2:** a mudança da lista `PASSAGEIROS` de `apps/web/src/api/ciclo-de-execucao.ts` para `packages/shared` só aparece na §5. Na tabela de módulos, `PASSAGEIROS` aparece só como lugar onde entra o `PEDIDO_ACIMA_DO_TETO`, sem o arquivo da web.
3. **`cenarios.md` §1, "contam também":** a lista inclui `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`, e uma execução pode terminar com esses dois códigos (`packages/core/src/ia/executor.ts:84`, `apps/api/src/ia/execucao.scheduler.ts:76`). Nenhum dos dois tem caso próprio, e a rodada 4 pediu "um caso por código". A cobertura é do `test-engineer`, por isso fica como recomendação.
4. **§2 ou §8:** falta dizer qual status HTTP o `PEDIDO_ACIMA_DO_TETO` recebe em `HTTP_STATUS_BY_CODE`.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md

## test-engineer · 5ª rodada · REPROVADO · 2026-11-15 03:00:52 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: os três bloqueantes da rodada 4: o prazo único com os dois relógios e o instante afirmado, `semRespostaHoje` contando toda a lista `PASSAGEIROS` com um caso por código, e `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'`. Também conferi se o diff da Tech Spec da r3 para a r5, que é quase todo compressão de texto, abriu algum buraco.

Cobertos:
- **Bloqueante 3 resolvido.** `aparenciaDaFalha` (`apps/web/src/api/ciclo-de-execucao.ts:130-134`) devolve `'explicada'` para um código fora de `PASSAGEIROS`. A mutação "deixar fora da lista" deixa vermelho o caso de `cenarios.md` §3.
- **Bloqueante 1 resolvido no caso principal e no de 100 s / 90 s.**
  - Com o `LLM_TIMEOUT_MS_<PERFIL>` em 600 s, o caso de 140 s contra 148 s separa a implementação certa da mutação. Os 148 s ficam abaixo do `prazoMs` de 150 s, então o job não interfere.
  - Com 100 s / 90 s, a 2.ª chamada usa o menor entre 100 s e os 50 s que sobram, e termina aos 140 s. Na mutação "prazo por chamada", ela vai aos 190 s.
  - O desligamento mata "tratar todo abort como prazo".
  - O `[U]` de configuração fica abaixo do `prazoMs` menos a folga.
- **Bloqueante 2 resolvido em parte.** Os cinco casos citados matam "só o corte" e "só `IA_INDISPONIVEL`". A recusa da D62 passa por `rodando` e separa do corte. O "não contam" continua fechado, e o recorte e o fuso continuam com mutação.
- **Compressão sem buraco de teste.** O que saiu da Tech Spec (o banco fora na subida, o corte só de quem pediu, a guarda do executor, o `DrawerContext`) continua em `cenarios.md` §1, §5, §6 e §7.

Bloqueantes:

1. **`cenarios.md` §1, "contam também", contra a Tech Spec §5, "A pergunta sem resposta".** A Tech Spec diz que conta toda a lista `PASSAGEIROS`. Só que a lista tem mais códigos que uma execução pode gravar do que os cinco que o cenário cita:
   - **O que falta.** `ERRO_INTERNO` vem de `codigoDaFalha` (`packages/core/src/ia/executor.ts:84`): toda exceção que não é de domínio vira esse código. `IA_ENTRADA_INVALIDA` vem do gateway (`packages/core/src/ia/llm-gateway.ts:106,113`) e do scheduler (`apps/api/src/ia/execucao.scheduler.ts:76`). Nenhum dos dois tem caso.
   - **Por que bloqueia.** A mutação "o repository filtra por uma lista própria com os cinco códigos do cenário" fica verde. Ela é exatamente a deriva que mover `PASSAGEIROS` para `packages/shared` quis evitar. O aluno cuja pergunta caiu num defeito nosso some da contagem, e nenhum teste acusa.
   - **Correção exigida.** Um caso parametrizado sobre a constante importada de `packages/shared`, filtrada pelos códigos que `execucao_agente` aceita gravar. Cada código dá +1 em `semRespostaHoje`. `TEMPO_ESGOTADO` e `INDISPONIVEL_TENTE_DE_NOVO` são só da web e ficam fora pelo filtro. Mutação: "lista copiada sem `ERRO_INTERNO`".

2. **`cenarios.md` §4, segundo caso, a cauda "O mesmo com a espera de 8 s seguida do modelo menor pendurado".** Com o prazo de chamada a 100 s do próprio caso, o valor esperado está errado e a mutação não se distingue:
   - **Por quê.** Prazo de chamada estourado não é repetido: a repetição é só para 429 e conexão recusada (`packages/core/src/ia/resilient-adapter.ts:87`), e o `chamarAteValer` só repete saída inválida (`llm-gateway.ts:192-205`). Então a chamada do modelo menor termina aos 8 + min(100, 132) = 108 s, tanto na implementação certa quanto na mutação "prazo por chamada". O "termina aos 140 s" é falso, e o caso fica verde com a mutação.
   - **O risco.** Para fazer os 140 s passarem, o implementador vai acabar ignorando o `LLM_TIMEOUT_MS_*`, e isso viola o "menor entre" da Tech Spec §5.
   - **Correção exigida.** A variante declara a própria configuração e o próprio instante:
     - (a) com 600 s: espera de 8 s e o modelo menor pendurado terminam aos 140 s; na mutação, aos 148 s;
     - (b) com 100 s: termina aos 108 s com `IA_TEMPO_ESGOTADO`, o que prova o "menor entre". Na mutação "só o que sobra do prazo", terminaria aos 140 s.
   - **Junto.** O primeiro caso do §4 ("espera os 8 s no teto e o modelo pendura") precisa dizer se a vaga abre aos 8 s e o pedido vai ao modelo principal, ou se o pedido vai ao modelo menor configurado. Depois de 8 s sem vaga, o próximo passo é o degrau, ou `IA_INDISPONIVEL` sem modelo menor, e não o modelo principal.

Recomendações:
- **O caso de 140 s.** Afirmar que não sai log `ia.geracao.erro_inesperado`, a cláusula "sem `erro_inesperado`" da Tech Spec §5. Hoje o cancelamento por sinal não é `LLMError` e cairia em `llm-gateway.ts:136` como `IA_INDISPONIVEL`. A asserção de `IA_TEMPO_ESGOTADO` já mata o código errado, mas o log ruidoso passaria.
- **"O prazo vence durante a espera da 2.ª reserva".** Dar os tempos, por exemplo a 1.ª chamada inválida aos 135 s e o fim aos 140 s, não aos 143 s. E a mutação: "a espera ignora o `pedido.sinal`".
- **`PEDIDO_ACIMA_DO_TETO` nos casos `[I]` do §1 e do §3.** Dizer que o teto é rebaixado na definição injetada da tarefa. Por desenho, pedido válido nunca chega à recusa.
- **Teste de alertas do §4.** Citar os limiares: "Tokens acima de 80 %" do contratado, como no RF8, e o aviso aos 70 %. A mutação "limiar trocado" hoje passaria no "estão no teste de alertas".

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/web/src/api/ciclo-de-execucao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/executor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/packages/core/src/ia/resilient-adapter.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/apps/api/src/ia/execucao.scheduler.ts

## test-engineer · 6ª rodada · APROVADO · 2026-11-15 03:04:06 · `tasks/prd-reengenharia-continuacao/revisao-spec.md`

VEREDITO: APROVADO

**Cenários exigidos.** Os dois bloqueantes da rodada 5 estão corrigidos:
- **§1, "O professor vê a pergunta sem resposta".** Agora há um caso parametrizado sobre a `PASSAGEIROS` de `packages/shared`. Ele inclui `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA` e tem a mutação "lista copiada no repository, sem `ERRO_INTERNO`".
- **§4, "O prazo único da execução".** O primeiro caso diz que a vaga abre e o pedido vai ao modelo principal. A variante do modelo menor tem configuração e instante próprios.

Também conferi se o 503 do `PEDIDO_ACIMA_DO_TETO` e a ida da `PASSAGEIROS` para `shared` (Tech Spec §2) abriram buraco novo. Não abriram.

**Cobertos.** Conferi cada mutação contra o código de hoje (`resilient-adapter.ts`, `llm-gateway.ts`, `executor.ts`, `ciclo-de-execucao.ts`).

- **§1, caso parametrizado:** a mutação "lista copiada sem `ERRO_INTERNO`" fica vermelha. O caso exige +1 em `semRespostaHoje` para cada código da constante de verdade, e o `ERRO_INTERNO` passa pelo filtro. O `PEDIDO_ACIMA_DO_TETO` também entra, porque passa a fazer parte da `PASSAGEIROS`.
- **§4, primeiro caso:** o fim aos 140 s contra 148 s na mutação "espera fora do prazo" fica vermelho. Os 148 s ainda ficam abaixo do `prazoMs` de 150 s, então não há reentrega para mascarar o resultado.
- **§4, segundo caso:** dá 140 s contra 190 s, com reentrega na mutação "prazo por chamada". Fica vermelho.
- **§4, variante (a):** dá 140 s contra 148 s. Fica vermelho.
- **§4, variante (b):** dá 108 s contra 140 s na mutação "só o que sobra do prazo". Fica vermelho, e prova o "menor entre". No `ResilientAdapter`, timeout não se repete (só 429 e conexão recusada), e o laço de duas tentativas do gateway só segue quando a saída é inválida. Então o fim aos 108 s não é encoberto por uma 2.ª tentativa.
- **§4, segunda reserva de tokens:** dá 140 s contra 143 s. Na mutação "a espera ignora o `pedido.sinal`", a espera termina aos 143 s e o modelo menor nem sai, porque o sinal já está abortado (`tentar` confere `sinal.aborted`). Fica vermelho no instante.
- **Recomendações da rodada 5:** as quatro foram aplicadas. Saiu o `erro_inesperado` do caso de 140 s; o teto rebaixado ficou na definição injetada; os limiares dos alertas aos 80 % e 70 % ganharam mutação; o `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'` está na §3.
- **Teste de IA:** usa sempre o adaptador falso.
- **Concorrência:** os casos marcados P continuam em paralelo, com barreira.

**Bloqueantes.** Nenhum.

**Recomendações.**
1. **§1, filtro do caso parametrizado.** O filtro "códigos que `execucao_agente` aceita gravar" não corresponde a nada no código. O check `execucao_agente_erro_e_codigo` aceita qualquer código no formato `^[A-Z][A-Z0-9_]{2,63}$`, e `CodigoDeFalhaDaExecucao = ErrorCode` (`executor.ts:18`). Logo, `TEMPO_ESGOTADO` e `INDISPONIVEL_TENTE_DE_NOVO` não ficam de fora por regra nenhuma. Há duas saídas:
   - tirar o filtro: gravar esses dois é aceito, e contá-los é a consequência correta de usar a `PASSAGEIROS`;
   - ou escrever o filtro como lista de exclusão explícita, com esses dois nomes.

   Uma lista de inclusão escrita à mão deixaria de pegar, em silêncio, um código novo que entrar na `PASSAGEIROS`. É justamente a deriva que o caso existe para pegar.
2. **Conteúdo da `PASSAGEIROS` em `shared`.** Hoje só `ciclo-de-execucao.test.ts:170` fixa o conteúdo, e só cinco códigos. Ficam de fora `IA_SAIDA_INVALIDA`, `IA_ENTRADA_INVALIDA` e o novo `PEDIDO_ACIMA_DO_TETO`. Tirar `IA_ENTRADA_INVALIDA` da constante passaria pela web e pelo RF5 sem nenhum teste vermelho, porque o caso parametrizado acompanha a constante. Vale um teste em `shared` que fixe a lista inteira.
3. **§4, primeiro caso: a vaga abre exatamente no limite da espera.** Os 8 s da vaga são também o fim da espera de 8 s. Se o pedido vai ao modelo principal ou ao menor depende de a comparação ser `<` ou `≤` e da ordem dos timers falsos. Abrir a vaga aos 7 s deixa o caso determinístico: fim aos 140 s, e 147 s na mutação.
4. **§2 da Tech Spec, o 503 do `PEDIDO_ACIMA_DO_TETO`.** Com toda IA no worker, esse status só aparece se algum caminho síncrono devolver o código. A presença do código no mapa já é garantida pelo `Record<ErrorCode, number>` (`domain.exception.ts:4`). Se o valor 503 importa, ele precisa de um caso; se não importa, uma linha na Tech Spec dizendo isso basta.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao/tasks/prd-reengenharia-continuacao/revisao-spec.md
