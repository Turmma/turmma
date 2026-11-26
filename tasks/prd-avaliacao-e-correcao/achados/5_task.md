# Achados das revisões — `tasks/prd-avaliacao-e-correcao/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:17:50 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. Conferi as que ela usa, todas vindas da 1.0 e da 2.0:
- `extensao_de_tempo` tem `escolaId` e `anoLetivoId`, uma FK composta (escola, ano, aplicação) para `atividade_aplicada`, uma FK (escola, aluno) para `usuario`, id `uuidv7` e a chave única por (escola, aplicação, chave).
- `pulso_da_api` e `indisponibilidade` são globais de infraestrutura e estão declaradas em `tools/guardas/tabelas-do-nucleo.mjs`.

Queries verificadas, em `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts` e em `alunosDaTurmaEntre`:
- `noAlcanceDoProfessor`: escola e ano em curso vêm do contexto, e o vínculo `confirmado` do professor é conferido na turma e na disciplina da própria linha.
- `AcompanhamentoRepository.consulta`: o `where` aplica o alcance. As junções de vínculo, usuário e tentativa ficam presas à escola, ao ano e à turma da aplicação. A subconsulta de extensões filtra por `escola_id` e `atividade_aplicada_id` da linha.
- `ExtensaoRepository.lockParaEstender`: aplica o mesmo alcance, com `for share` só em `atividade_aplicada`.
- `ExtensaoRepository.save`: escola, ano e `concedidaPor` vêm do contexto e da sessão. A FK composta recusa a gravação com escola ou ano trocados.
- `AtividadeAplicadaRepository.alunosDaTurmaEntre`: escola e ano vêm do contexto, e a turma é a lida da aplicação travada, nunca a do corpo.
- `estenderTempoRequestSchema` é estrito (`alunoId`, `minutos`, `chave`). Escola ou ano no corpo dá `ENTRADA_INVALIDA`, e a rota de acompanhamento não lê query string.
- Não revela existência de dado: o id malformado, o inexistente e o de fora do alcance respondem o mesmo `NAO_ENCONTRADO`. Os cinco casos de aluno fora da turma respondem o mesmo `ENTRADA_INVALIDA`, com o mesmo corpo de erro.
- Matriz de permissão: `rede`, `coordenador` e `aluno` estão como `nunca` para `estender` e `acompanhar`, então a camada rede não alcança o acompanhamento individual.
- Não há `@Unscoped()`.

Teste de isolamento: presente e efetivo, em `apps/api/src/atividade/extensao.int.test.ts`, bloco "isolamento" (linhas 498-557). Tirei cada cláusula mentalmente e o teste quebra:
- Sem `escolaId`, o caso "com a escola da B e o professor da A" acha a linha, porque o vínculo vem das colunas da linha e não do contexto.
- Sem `anoLetivoId`, os casos "com o ano trocado" e "ano de ninguém" acham a linha.
- Sem o vínculo, a professora de B, a colega, a professora de outra disciplina, o vínculo pendente, o vínculo encerrado, a coordenação e o aluno deixam de receber 404 pela rota.
- Sem o id, o caso "estender numa prova não espera o encerramento de outra" quebra.
- O filtro de aplicação nas extensões é provado em "lê numa consulta só": a extensão de 9 min da outra prova da turma não pode aparecer.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/atividade/extensao.int.test.ts:532`: o caso "nos repositories" testa o id da A com contexto trocado, mas não o contrário (contexto da A com uma aplicação criada na B). Hoje está coberto pela rota (`b.professora` na linha 511) e pela FK composta. Um caso no repository tornaria a prova simétrica.
- `extensao_de_tempo.concedidaPor` (schema da 1.0) não tem FK (escola, usuário). Não vaza dado porque o valor vem só da sessão, mas a FK daria a mesma garantia estrutural que `alunoId` já tem. Fica para a validação e a retro.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-24 00:17:54 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO

A tarefa 5.0 não tem IA no caminho. A extensão de tempo é um ato do professor, e o acompanhamento só lê onde cada aluno está na prova. Não li `docs/regulacao.md` por inteiro, porque a tarefa não toca nota, tutor nem autonomia de agente. Não rodei os testes; li o código e o que os testes afirmam.

Caminhos de escrita em Nota: nenhum nesta tarefa. Só a tabela `extensao_de_tempo` é gravada, e a tabela de nota não aparece no diff, nem no serviço, nem no repository, nem no teste. — todos com autor humano? sim (não se aplica)

Decisão autônoma sobre aluno: ausente. As quatro situações (`nao_comecou`, `fazendo`, `enviou`, `tempo_esgotado`) só descrevem a prova. Elas não aprovam, não reprovam e não encaminham ninguém. Uma tentativa vencida e não enviada conta como enviada, mas essa regra de tempo é da Tech Spec §5.5 e não decide a trajetória do aluno. A extensão só existe quando o professor da turma e da disciplina a pede (`noAlcanceDoProfessor`, em `acompanhamento.repository.ts:117-123`).

Aprovação registrada: ok, e não se aplica. Nenhuma saída de IA nasce ou chega ao aluno nesta tarefa. O ato humano tem autor e data:
- A linha da extensão grava quem a deu, `concedidaPor: requestSessao().usuarioId` (`acompanhamento.repository.ts:241`).
- A auditoria `atividade.tempo_estendido` guarda o autor, e o teste confere esse autor (`extensao.int.test.ts:233`).

Supervisão do tutor: ok, e não se aplica. A tarefa não toca o tutor. No critério de vigilância, o acompanhamento mostra só a situação na prova e o `limiteEm` de quem está fazendo. Ele não mede tempo ocioso nem navegação, não infere emoção e não traz a contagem de saídas da aba (D70, D88). Três lugares garantem isso:
- o contrato estrito `acompanhamentoDoAlunoSchema` (`packages/shared/src/atividade/atividade-aplicada.ts:192`);
- o caso `contracts.test.ts › avaliacao-e-correcao 5.0`, que recusa `saidas` e `saidasDaAba`;
- `extensao.int.test.ts:348`, que confere a resposta lida.

Autonomia declarada e visível: sim, sem alteração nesta tarefa, porque nenhum agente foi criado ou mudou de nível.

Medir o professor (D45) e D55: nada nesta tarefa mede o professor, e não há campo de nota, conceito ou sugestão de nota.

Bloqueantes: nenhum.

Recomendações:
1. **Para a tela da 11.0.** O acompanhamento é relido a cada 15 s. A tela deve continuar mostrando só a situação e o "termina às". Não deve acrescentar tempo desde a última resposta, "parado há X min" ou outro sinal de atividade, porque isso viraria a janela permanente sobre o comportamento que a regra 70, item 7 veda. Vale registrar isso como restrição na tarefa 11.0.
2. **Para a tela da 11.0.** Quando a tentativa vence sem envio e a situação passa a `tempo_esgotado`, o texto não deve sugerir falta ou consequência para o aluno. "Tempo esgotado" é o fato, sem julgamento.
3. **Na AIA ou no dossiê da avaliação online.** Hoje a auditoria guarda só o escopo, aluno ou turma, para proteger a adaptação, que é dado sensível (D35). Por isso a pergunta "quem deu tempo a quem" só se responde pela linha da extensão, e não pela consulta da auditoria. Vale deixar isso escrito, para a coordenação não esperar essa resposta da consulta da auditoria.

Arquivos auditados:
- `apps/api/src/atividade/atividade-aplicada/extensao.service.ts`
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts`
- `apps/api/src/atividade/extensao.int.test.ts`
- `packages/core/src/auditoria/acoes.ts`
- `apps/api/test/contracts.test.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:18:17 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO

A tarefa 5.0 cumpre a regra 20 e o `docs/lgpd.md`: nenhum bloqueante. Rodei os testes: o de contratos e o de ações da auditoria passaram (58 casos), e o `extensao.int.test.ts` também (19 casos).

Campos pessoais tocados: na tabela `extensao_de_tempo` a tarefa grava o aluno, os minutos, quem concedeu e quando. No acompanhamento, sai para o professor o id e o nome de cada aluno, a situação e o `limiteEm`. Nenhuma coluna nova: a tabela vem da 1.0.

Fora da tabela de dados do docs/lgpd.md: nada. A `extensao_de_tempo` está em `docs/lgpd.md:59`, com finalidade e retenção. Nenhum campo proibido para aluno foi tocado. Tempo a mais fica guardado como minutos, sem diagnóstico (D35).

Autorização por objeto: ok.
- **Escopo:** o `noAlcanceDoProfessor` (`acompanhamento.repository.ts:50-56`) aplica escola e ano em curso do contexto, mais vínculo confirmado na turma e na disciplina do artefato. Vale na leitura e na trava `for share`.
- **Matriz:** coordenação, rede e aluno estão em `nunca` nas duas ações.
- **Trocar o id na URL:** a aplicação de outra escola, de outra turma ou inexistente, e o id malformado, respondem todos `NAO_ENCONTRADO`.
- **Aluno trocado no corpo:** o de outra turma, de outra escola, o inexistente, o pendente e o desativado recebem a mesma resposta, `ENTRADA_INVALIDA` (`extensao.service.ts:221-224`, com o `alunosDaTurmaEntre`).
- **Corpo da requisição:** o contrato do pedido é estrito, então quem manda `motivo`, escola ou ano a mais recebe `ENTRADA_INVALIDA`.
- **Chave de idempotência:** a chave única inclui `escola_id`, então não serve de sinal entre escolas.

DTO: explícito e estrito (`acompanhamentoResponseSchema.parse` em `extensao.service.ts:246`). Não traz saídas da aba, percentual, tempo adicional nem quem concedeu, e o `contracts.test.ts` prova isso. As duas rotas respondem com `no-store`, e o erro é o `DomainException` tipado, sem eco de dado.

Logs: limpos. Os dois arquivos novos não têm logger.

Auditoria: presente. A `atividade.tempo_estendido` leva só o escopo (`aluno` ou `turma`), sem minutos nem `alunoId`. O esquema é estrito e o `acoes.test.ts` o prova. O pedido repetido não grava outra auditoria. A regra não exige auditoria para essa ação; o registro é a mais. Nenhuma ação desta tarefa cai nas obrigatórias da regra 20, item 10.

Envio externo: nenhum. A tarefa não chama IA e não alcança conversa de Tutor.

Ciclo de vida: a eliminação do aluno apaga as extensões dele pela FK `extensao_de_tempo_aluno_da_escola_fk`, com `on delete cascade`. O expurgo segue a retenção `trabalho_do_aluno` (`expurgo-da-escola.repository.ts:53` e `:288`). A extensão do aluno entra no arquivo do titular (`leitura-do-titular.ts:340-345`).

Seed/fixture: sintético. Os nomes nos testes são do tipo "Aluna Sintética Ana".

Pergunta de fechamento: responde. A extensão dada a um aluno aparece no arquivo dele, e não houve envio para fora.

Bloqueantes: nenhum.

Recomendações:
1. `packages/core/src/titular/leitura-do-titular.ts:345` filtra por `aluno_id = titular`, então a extensão dada à turma toda (aluno nulo) não aparece no arquivo de nenhum aluno, embora tenha mudado o limite dele. Vale avaliar se entra no arquivo de cada aluno com tentativa naquela aplicação, para a resposta à secretaria ficar completa. Fica para a validação e a retro.
2. `extensao.service.ts:225`: a mesma `chave` com outro aluno ou outros minutos devolve em silêncio o que já estava gravado. Não vaza nada, mas a tela (11.0) precisa gerar uma chave nova a cada vez que o diálogo abre, para o professor não achar que estendeu quando não estendeu.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-24 00:18:55 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md`. A regra das situações do acompanhamento foi registrada só na Tech Spec e no `5_task.md`.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:

- **`tasks/prd-avaliacao-e-correcao/cenarios.md`, §1, linhas 27 a 30 (bloco RF4).** A tabela "Divergências resolvidas" do `5_task.md`, linha 94, declara a segunda divergência e aponta só para `techspec.md` §4. Essa divergência traz a regra de cada situação, o `limiteEm` só em `fazendo` e o 200 no pedido repetido. A nova linha 74 da `techspec.md` define essa regra. O `cenarios.md` não tem nenhuma linha sobre ela: `grep` por `nao_comecou`, `tempo_esgotado` e `situação` não acha cenário de acompanhamento. Ficam sem cenário as duas decisões que a tela da 11.0 vai consumir:
  - a tentativa sem envio, com a aplicação encerrada pelo professor e o limite adiante, sai como `enviou`;
  - o `limiteEm` vem nulo fora de `fazendo`.

  Divergência registrada só no `N_task.md` e na Tech Spec, sem estar no `cenarios.md`, é bloqueante.

  **Correção exigida:**
  1. Acrescentar ao bloco RF4 do `cenarios.md` uma linha "Acompanhamento". Ela deve trazer as quatro situações, com o `envio = 'limite'` como `tempo_esgotado` e a encerrada pelo professor com limite adiante como `enviou`, e o `limiteEm` só em `fazendo`. Também deve trazer o tipo (integração, `extensao.int.test.ts`) e a mutação que o caso pega.
  2. Atualizar a coluna "Onde está na spec" da linha 94 do `5_task.md` para citar também o `cenarios.md`.

Recomendações:

- **Função de alcance duplicada.** `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts:50-56` (`noAlcanceDoProfessor`) é cópia literal de `AtividadeAplicadaRepository.#noAlcance` (`atividade-aplicada.repository.ts:124-130`). São dois lugares para manter a mesma cláusula de escopo. Exportar uma só e usar nos dois.
- **`ExtensaoRepository` no arquivo do acompanhamento.** A classe mora em `acompanhamento.repository.ts:144`, mas o comentário dela diz que "a tabela só se toca por aqui". Num `extensao.repository.ts` próprio ela seria achada pelo nome. Se mudar, atualizar a tabela de arquivos previstos.
- **(d) descrito por um mecanismo que o código não usa.** O `cenarios.md`, linha 115, diz que a segunda extensão "cai no 23505" e que a mutação é "tirar o índice único". O código usa `on conflict do nothing` (`acompanhamento.repository.ts:177`): a segunda espera e não falha. A explicação está só na autoconferência, item 7. O efeito é o mesmo, mas convém alinhar o texto do cenário ao mecanismo real.
- **Comentário que promete um filtro que não existe.** `acompanhamento.repository.ts:23` fala em "as indisponibilidades **fechadas**", e a subconsulta (linha 83) não filtra nada. Só não é bug porque a linha de indisponibilidade nasce fechada. Basta tirar a palavra.
- **Repetição depois do encerramento.** O pedido repetido com a mesma `chave` depois do encerramento recebe `ATIVIDADE_ENCERRADA`, e não "o gravado". O comportamento é aceitável, mas não está escrito em lugar nenhum. Vale uma frase na Tech Spec §4.

Arquivos relevantes:
- tasks/prd-avaliacao-e-correcao/cenarios.md
- tasks/prd-avaliacao-e-correcao/5_task.md
- apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-11-24 00:19:00 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO

Caminho quente tocado: prova

Rate limit: ok. As duas rotas novas passam pela `RateLimitGuard` global, que limita pelo usuário (`sub`) e pela escola (`esc`) do token, com os limites de cada escola (`apps/api/src/app.module.ts:173-179`). Nada é limitado só por IP. Com sessenta professores relendo o acompanhamento a cada 15 s, a carga fica perto de 4 req/s.

Fila e prioridade: ok. Não há trabalho demorado no request. O estender é uma transação curta: trava a aplicação, confere o aluno, faz o `insert`, grava a auditoria e relê. O acompanhamento é uma consulta só, e o limite de cada aluno é calculado em memória.

Concorrência: protegida.
- O clique duplo e o reenvio caem na chave única `extensao_de_tempo_chave_por_aplicacao` (escola, aplicação, chave). O `on conflict do nothing` devolve o que já estava gravado, e a auditoria só é gravada quando o `insert` gravou.
- Estender e encerrar ao mesmo tempo: a aplicação é tomada em `for share` e o encerrar em `for update`.
- As três corridas têm teste com a ordem forçada (`WriteBlockTrigger` e `esperarNaTrava`): estender × estender, estender × encerrar, e a prova vizinha que não pode esperar.

Índice e paginação: ok.
- O `EXPLAIN` do `.toSQL()` do repository está no teste e prova a entrada por estes índices: `vinculo_turma_idx` (escola, ano, turma), `tentativa_atividade_uma_por_aluno` (com `escola_id` na condição), `extensao_de_tempo_chave_por_aplicacao` e `indisponibilidade_fim_idx`.
- A lista não é paginada, mas é limitada aos alunos de uma turma, como as outras listas por turma.

Degradação de IA: não se aplica.

Migration: não se aplica. A tarefa não cria migration.

Métrica e alerta: ok. As rotas novas são medidas pelo `httpMetricsMiddleware` global (`http.server.request.duration`, com a rota template). A tarefa não cria alerta. Os alertas da §7c da Tech Spec e o cenário de carga `infra/k6/prova-online.js` são da 6.0.

Bloqueantes: nenhum. Rodei `npx vitest run --project integracao apps/api/src/atividade/extensao.int.test.ts` e os 19 casos passaram. Nenhum teste chama provedor.

Recomendações:
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts:177`: a mesma `chave` com outro conteúdo (outro aluno ou outros minutos) devolve em silêncio a extensão antiga. Vale comparar o pedido com o que está gravado e recusar a divergência, como faz o padrão de mercado para chave de idempotência.
- `acompanhamento.repository.ts:82-83`: as subconsultas das extensões e das quedas dependem da linha de fora e rodam uma vez por aluno. São umas 35 buscas por índice em tabela pequena. Ler as extensões uma vez só, num CTE ou num `lateral`, deixa a consulta estável se a turma crescer.
- `apps/api/src/atividade/atividade-aplicada/extensao.service.ts:46`: a releitura dentro da transação usa o `now()` do começo dela. Se a extensão esperou na trava, o `agora` e a situação devolvidos ficam atrasados pelo tempo da espera. O efeito é pequeno; `clock_timestamp()` na releitura resolve.

Arquivos auditados:
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`
- `apps/api/src/atividade/atividade-aplicada/extensao.service.ts`
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts`
- `apps/api/src/atividade/extensao.int.test.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-24 00:22:36 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** estender 10 min só para a Ana; estender a turma inteira; a resposta do POST é o acompanhamento.
- **Bordas do domínio:**
  - limites de 0, 1, 120 e 121 minutos, e a chave a mais;
  - prova encerrada;
  - aluno de outra turma, de outra escola, inexistente, com vínculo pendente e com a conta desativada;
  - aluno que começa depois da extensão da turma;
  - tentativa sem limite;
  - queda do sistema antes e dentro da prova;
  - prova encerrada pelo professor e tentativa fechada no limite (`envio = 'limite'`);
  - turma em que o único aluno foi desativado;
  - sem a linha do pulso;
  - a outra prova da turma, criada antes, com tentativa dos mesmos alunos;
  - virada de ano, pelo ano trocado e pela escola sem ano em curso.
- **Permissão:** professor de B, colega de outra turma, professor de outra disciplina, professor com vínculo pendente, professor com vínculo encerrado em X e aberto em Y, coordenação e aluno.
- **Isolamento:** os dois repositories chamados direto, com a escola trocada, o ano trocado, o ano de ninguém e a escola da B com a professora da A; a gravação barrada pela FK.
- **Concorrência:** (d) estender × estender com a mesma chave e a ordem forçada; estender × encerrar; a trava presa à aplicação certa. A corrida (j), estender × rotina, fica para a 6.0, como declarado.
- **Contrato e auditoria:** acompanhamento sem saídas nem percentual; auditoria só com o escopo; uma ida ao banco e o `EXPLAIN`; `no-store` e id malformado.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm o seu caso citado pelo nome, e os nomes batem com `apps/api/src/atividade/extensao.int.test.ts` (19 casos, verdes aqui), com `apps/api/test/contracts.test.ts › avaliacao-e-correcao 5.0` e com `packages/core/src/auditoria/acoes.test.ts › avaliacao-e-correcao 5.0` (58 casos verdes). Os itens juntados por ponto e vírgula foram conferidos um a um: "1 e 120 passam", "linha da turma com aluno nulo", "nenhuma auditoria", "chave nova grava outra", "no contexto da dona, acha" e "sem a linha do pulso" têm, cada um, a sua asserção.
- A corrida (d) é paralela de verdade. O gatilho roda depois do insert, então a primeira já está no índice, e `esperarNaTrava(…, 2)` prova que a segunda espera na chave única.
- Estender × encerrar segura o `for update`. Sem o `for share`, a extensão não aparece na fila da trava e a ausência é detectada.
- Não há `.skip`, teste comentado nem IA. O proxy que conta as consultas só observa o pool e não esconde nada. As asserções olham o resultado gravado: `limite_base_em` lido do banco, o detalhe da auditoria e as linhas de `extensao_de_tempo`.
- O carimbo do portão vale para o código atual (48 mutações).

**Bloqueantes:**

1. **Uma mutação aponta para um caso que não olha o que ela muda.** O bloco que tira `|| linha.nome === null` (`apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts:118`) cita `extensao.int.test.ts › lê numa consulta só`.
   - **O que o caso não confere:** com a mutação, o aluno desativado entra na leitura com o nome nulo. Nenhuma asserção desse caso (`apps/api/src/atividade/extensao.int.test.ts:400-416`) olha quem está na lista ou o nome. Ele confere só o número de consultas, o estado, a Bia, as extensões e quedas da Ana, o pulso e o Caio.
   - **O vermelho do portão não se explica pela leitura:** se ficou vermelho, foi por outro motivo, e um bloco vermelho pelo motivo errado conta como bloqueante.
   - **Correção exigida:** apontar o bloco para `› quem não começou, quem faz`, que falha pelo motivo certo (o contrato recusa o nome nulo e o laço das linhas 349-350 recusa o desativado). Outra saída é acrescentar ao caso citado a asserção `expect(leitura?.alunos.map((aluno) => aluno.alunoId)).not.toContain(desativado.usuarioId)`. Nos dois casos, rodar a mutação de novo pelo portão.

**Recomendações:**
- **Prazo da espera:** o bloco que tira o `for share` (`acompanhamento.repository.ts:157`, caso `estender × encerrar`) fica vermelho porque a espera de `esperarNaTrava` estoura em 15 s, e não pela asserção de `ATIVIDADE_ENCERRADA`. Vale declarar `falha: não aconteceu a tempo` no bloco. O mesmo vale para `› estender numa prova não espera o encerramento de outra`.
- **Aluno transferido:** não há caso para o aluno transferido, com o vínculo `encerrado` na turma. Estender para ele deveria dar `ENTRADA_INVALIDA`, e ele não deveria aparecer no acompanhamento mesmo com tentativa em andamento. A cláusula está provada pelo aluno pendente, mas o caso real da escola fica sem teste.
- **Dois alunos com o mesmo nome:** o desempate `asc(vinculo.usuarioId)` (`acompanhamento.repository.ts:107`) não tem caso.
- **Fronteira do tempo esgotado:** o `>` do tempo esgotado (`extensao.service.ts:17`) não tem caso no instante exato do limite. Ele precisa concordar com o PUT da 3.0.
- **Chave reaproveitada:** a mesma chave com outro corpo (outro aluno ou outros minutos) devolve 200 sem gravar nada, em silêncio. O padrão de mercado de chave de idempotência recusa o corpo diferente. Vale ao menos um caso que fixe o comportamento escolhido.
- **Maiúsculas:** a normalização para minúsculas do `alunoId` e da `chave` (`acompanhamento.repository.ts:172,175`) não tem caso com UUID em maiúsculas.
- **Termo sem motivo listado:** o termo `escola_id = atividade_aplicada.escola_id` da subconsulta das extensões (`acompanhamento.repository.ts:82`) não tem bloco nem motivo na lista dos equivalentes.
- **Extensão da turma depois da janela:** a frase "`limiteEm` = `fecha_em` + extensão" da linha "Estender a turma" compara com o `limite_base_em` gravado pelo teste, e não com o `fecha_em`. Vale confirmar que a 6.0 cobre a extensão **da turma** no fim efetivo: a tabela dela só cita a do aluno.
- **Duas extensões em paralelo:** falta um caso com duas extensões de chaves diferentes ao mesmo tempo (as duas gravam e uma não espera a outra). Hoje esse caminho só é provado em sequência.

Arquivos: `apps/api/src/atividade/extensao.int.test.ts`, `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`, `apps/api/src/atividade/atividade-aplicada/extensao.service.ts`, `tasks/prd-avaliacao-e-correcao/5_task.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-24 01:39:09 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita.**
- O bloco RF4 do `cenarios.md` ganhou a linha 29, "Acompanhamento". Ela traz as quatro situações: o `envio = 'limite'` sai como `tempo_esgotado` e a prova encerrada pelo professor com o limite adiante sai como `enviou`. Traz também o `limiteEm` só em `fazendo`, o tipo (`extensao.int.test.ts` e `contracts.test.ts`) e as três mutações.
- Cada uma dessas mutações tem bloco em "Mutações" do `5_task.md`, nas linhas 390 a 452.
- A linha 95 do `5_task.md` agora cita `techspec.md` §4 e `cenarios.md` §1 RF4, linha "Acompanhamento".

**Os itens 3, 4 e 5 da ordem, que são do meu escopo, também foram feitos.**
- **Item 3:** a corrida (d) do `cenarios.md`, na linha 116, agora descreve o `on conflict do nothing` que o código usa.
- **Item 4:** a palavra "fechadas" saiu do comentário em `acompanhamento.repository.ts:23`.
- **Item 5:** a `techspec.md` §4, na linha 74, agora diz que o pedido repetido depois do encerramento recebe `ATIVIDADE_ENCERRADA`. Confere com `extensao.service.ts`: a checagem do estado vem antes do `save`.
- **Sem aplicar:** a tabela foi copiada para o `5_task.md` e para o `TODO.md`. As linhas para as tarefas 11.0 e 6.0 entraram no "Contexto necessário" de `11_task.md` e de `6_task.md`.

Recomendações:
- A `techspec.md` §4 (linha 74) ganhou duas frases novas que nenhuma linha do `cenarios.md` nomeia:
  - a mesma `chave` com outro corpo devolve o gravado;
  - o pedido repetido depois do encerramento recebe `ATIVIDADE_ENCERRADA`.

  Elas também não estão na linha 95 da tabela "Divergências resolvidas" do `5_task.md`. Vale acrescentá-las ao bloco RF4 do `cenarios.md`, junto da linha 30 ou da 31, e citá-las na linha 95. A primeira já tem teste (`› a mesma chave de novo devolve o gravado`). A segunda não tem caso próprio: a linha 30 do `cenarios.md` só cobre a prova encerrada com chave nova.
- O comentário novo em `extensao.int.test.ts:84` aponta para o `TODO.md` como "decisão do Arquiteto". Está certo, mas quando o Arquiteto decidir, o caso e a frase da Tech Spec mudam juntos.

Arquivos relevantes:
- tasks/prd-avaliacao-e-correcao/cenarios.md
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/5_task.md
- apps/api/src/atividade/atividade-aplicada/extensao.service.ts
- apps/api/src/atividade/extensao.int.test.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-24 01:41:46 · `tasks/prd-avaliacao-e-correcao/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** estender só para um aluno, para a turma, e na prova encerrada. Faixa de minutos. Clique duplo com a mesma chave, testado em paralelo. Estender e encerrar ao mesmo tempo, e estender uma prova sem esperar pela outra. Acompanhamento: as quatro situações e o `limiteEm` só em `fazendo`. Isolamento: escola B, repository chamado direto, ano anterior. Permissão: quem não é o professor da turma. Os três casos de borda pedidos na rodada 1: aluno transferido, dois alunos com o mesmo nome, e a mesma `chave` com outro corpo.

**Cobertos:**
- **A correção exigida (item 2) foi feita, pelas duas saídas.** O bloco que tira `|| linha.nome === null` agora cita `› quem não começou, quem faz`. Esse caso cai pelo motivo certo: o contrato recusa o nome nulo, e o laço em `apps/api/src/atividade/extensao.int.test.ts:361` recusa o aluno desativado. O caso `› lê numa consulta só` também ganhou `not.toContain(desativado.usuarioId)` (`extensao.int.test.ts:432`).
- **Item 6, as duas linhas `falha:`.** Conferi o mecanismo, sem rodar a mutação. O `portao-local.ts conferir` diz que o carimbo vale para o código atual, com as 48 mutações e as linhas `falha:` conferidas pela linha do relatório.
  - Bloco que tira o `for share`: a extensão não fica na trava, e o `esperarNaTrava` da linha 288 estoura. É o motivo certo.
  - Bloco que tira o id do `where`: a extensão trava a vizinha. O `statement_timeout` de 2 s da API derruba o encerramento parado no gatilho, a vizinha é solta, e a extensão grava. O `aguardar` passa, e a linha 314 cai com `[200, não 200]`. Também é o motivo certo.
- **Item 7.** O motivo do termo `escola_id` da subconsulta das extensões está na lista "sem bloco" e é verdadeiro: o `atividade_aplicada_id` (uuid) e a FK composta já amarram a mesma aplicação.
- **Item 8, aluno transferido (vínculo `encerrado`).** Recebe `ENTRADA_INVALIDA` ao estender, entre os seis ids. Também fica fora do acompanhamento, mesmo com uma tentativa em andamento (linhas 335 e 361).
- **Item 10, mesma `chave` com outro aluno e outros minutos.** Devolve o gravado. O limite da Ana não muda, só existe uma extensão (10 min) e só uma auditoria (linhas 218-222).
- **Os itens 1, 3, 4 e 5** (cenarios.md, Tech Spec §4, comentário das indisponibilidades) estão no diff. A nova linha da tabela de testes cita os quatro casos pelo nome. A tabela "Recomendações sem aplicar" foi copiada, e os itens que iam para o `TODO.md`, para a `6_task.md` e para a `11_task.md` estão lá.
- `npx vitest run apps/api/src/atividade/extensao.int.test.ts`: 20 de 20 verdes. Não há `.skip` nem mock de coisa nossa.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O caso `› dois alunos com o mesmo nome` (`extensao.int.test.ts:124-137`) não prova o desempate `asc(vinculo.usuarioId)`** (`acompanhamento.repository.ts:107`).
   - Os dois gêmeos são criados em sequência, com uuid v7. A ordem física do vínculo já coincide, quase sempre, com a ordem do id.
   - Sem o desempate, o sort por nome devolveria a mesma ordem por acaso, e o caso continuaria verde.
   - A linha da tabela diz "os gêmeos saem na ordem do id". Para o caso provar isso, inverta a ordem física antes de ler, com um `update` sem efeito no vínculo do gêmeo de menor id (a tupla nova vai para o fim da tabela). Depois, acrescente um bloco de mutação que tire o `asc(vinculo.usuarioId)`.
   - Fica como recomendação, como na rodada 1, porque não há cláusula com condição. Vale levar para a validação.
2. **Os dois casos de corrida com a vizinha e com o encerramento dependem do `statement_timeout` de 2 s da API.**
   - Sem a mutação, a extensão precisa terminar antes de o encerramento parado estourar o prazo. A folga é grande, mas é um prazo.
   - Com a mutação de tirar o id do `where`, é esse mesmo estouro que faz a linha 314 cair.
   - O comentário da linha 310 diz que "o encerramento deixaria de dar 200" sem dizer por quê. Vale escrever ali que quem o derruba é o `statement_timeout` (2 s).
3. **No caso de outro corpo (linha 218), confira também o limite da Bia.** Uma asserção de que a Bia continua sem extensão deixaria explícito que o `alunoId` do corpo repetido não vale. Hoje só o `extensoesDe` cobre isso.

Arquivos relevantes:
- apps/api/src/atividade/extensao.int.test.ts
- apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
- tasks/prd-avaliacao-e-correcao/5_task.md
