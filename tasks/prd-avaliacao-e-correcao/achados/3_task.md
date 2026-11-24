# Achados das revisões — `tasks/prd-avaliacao-e-correcao/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:40:35 · `tasks/prd-avaliacao-e-correcao/3_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: tentativa_atividade (limite_base_em, envio), tempo_adicional, extensao_de_tempo, atividade_aplicada (abre_em, fecha_em, duracao_min), resposta_atividade, vinculo; pulso_da_api e indisponibilidade como fato global da API. Nenhuma tabela nova nesta tarefa: a migration é da 1.0.
Queries verificadas: MinhaAtividadeRepository.list (incluindo as subconsultas correlacionadas de percentual, respondidas e comDiagnostico), prova, lockParaGravar, leitura, #paraGravar, comecar (insert on conflict do nothing), tentativa, tentativaTravada, percentualDoAluno, extensoes, extensoesDas, send; QuedasDaApiRepository.leituraDesde (o @Unscoped da 2.0 tem justificativa escrita e não mudou).
Teste de isolamento: presente e efetivo
Bloqueantes: nenhum
Recomendações:
- apps/api/src/atividade/atividade-isolamento.int.test.ts:211: o laço que roda as rotas do aluno com os outros papéis (professor, coordenação, rede) ainda não chama `comecar` nem `tempo`. Hoje a cobertura disso vem só da matriz (`nunca` em `matriz.expectativa.ts:107-108, 241-242, 377-378`). Incluir as duas rotas no laço daria a prova também por HTTP.
- `extensoesDas` só recebe ids que vieram da `list`, que já tem escopo, e repete o escopo na própria consulta. Um caso que passe um id de outra escola no array, dentro do contexto da escola A, deixaria isso provado no repository e não só pela forma como o service o chama.
```

Notas da auditoria:
- O escopo vem sempre do contexto (`requireEscolaId`, `requireAnoEmCurso`, `requestSessao().usuarioId`). O corpo de `comecar` é vazio e estrito, e nenhuma rota recebe `escolaId` do cliente.
- A ordem está certa: primeiro o alcance, depois a janela, depois o estado. O intruso de outra turma ou de outra escola recebe `NAO_ENCONTRADO` mesmo fora da janela, nunca `PROVA_FORA_DA_JANELA` (`prova-online-aluno.int.test.ts:409`). `tempo` sem tentativa e o PUT ou envio antes de `comecar` respondem `NAO_ENCONTRADO`, igual ao id de outra escola (`prova-online-aluno.int.test.ts:210`).
- Para conferir a efetividade, tirei mentalmente as cláusulas de escopo. Sem `escolaId` em `#minha` ou em `extensoes`, o caso "escola trocada" do teste do repository ainda casa o ano e o aluno, acha a linha e fica vermelho (`prova-online-aluno.int.test.ts:455`). Sem `anoLetivoId`, quem quebra é o caso "ano trocado". As gravações (`comecar` e `send`) com o contexto errado têm verificação própria (`prova-online-aluno.int.test.ts:485`).
- A extensão de outro aluno não entra na conta (`or(isNull(alunoId), eq(alunoId, sessão))`), e há teste disso (`prova-online-aluno.int.test.ts:334` e `:348`).
- O balde de `rl:comecar-prova` é por usuário, nunca por IP. Os ids são UUID. A camada rede tem `nunca` em `comecar` e em `ler_tempo`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-24 00:41:01 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa grava só em `tentativa_atividade` (o `insert ... on conflict do nothing` de `comecar` e o `envio = 'aluno'` de `send`) e em `resposta_atividade` (o PUT, como antes). O diff não tem nenhum `insert` nem `update` em nota. Fora dos testes, a busca por `lancadaPor` só acha `packages/shared/src/importacao/contratos.ts`, que esta tarefa não toca. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. `TEMPO_ESGOTADO` e a regra "vencida sem envio conta como enviada" aplicam o prazo que o professor definiu (janela, duração, extensão). Não há IA nisso e nada decide aprovação, reprovação ou encaminhamento. A tentativa vencida vira só uma leitura com `envio = 'limite'`. A gravação de verdade fica para a 6.0, e a correção e a nota continuam presas ao lote que o professor aprova (D33, D56).

Aprovação registrada: ok. A tarefa não produz saída de IA, e o `situacao: 'com_diagnostico'` continua exigindo `entrega.estado = 'aprovada'`.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado nem alterado.

Supervisão não é vigilância (item 7): ok.
- O `GET .../tempo`, relido a cada 30 s, só lê e não grava nada sobre o aluno, como pede `minha-atividade.service.ts`.
- O pulso é da instância da API, não do aluno.
- O balde `rl:comecar-prova:{usuarioId}` é um contador de 1 minuto no Redis, sem nada persistido nem somado por aluno.
- Nada mede tempo ocioso, navegação ou estado emocional. As saídas da aba ficam fora do escopo (8.0), e `apps/api/test/contracts.test.ts` testa que `saida` e `saidas` não aparecem em nenhum contrato do aluno.

Sem nota em discursiva e redação (D46, D55): ok. O diff não traz campo, tela nem prompt de nota.

Medir o professor (D45, item 8): não se aplica, porque a tarefa não cria nenhum indicador de professor.

Bloqueantes: nenhum.

Recomendações:
- Na 6.0, quando a vencida passar a ser gravada com `envio = 'limite'`, convém que o lote de correção mostre ao professor qual tentativa foi enviada pelo limite e qual o aluno enviou, e que o registro da validação (D56) guarde isso. Assim o professor sabe o que está aprovando.
- A web joga fora `tempo.envio` (`apps/web/src/api/atividades-do-aluno.ts`, no `queryFn` de `provaQueryOptions`). A tela de foco (12.0) precisa dizer ao aluno, em português comum, que a prova foi enviada porque o tempo acabou, e não só mostrar um erro.

Arquivos auditados:
- apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
- packages/shared/src/atividade/prova.ts
- packages/shared/src/atividade/limite-da-tentativa.ts
- packages/core/src/rate-limit/comecar-prova-rate-limit.decorator.ts
- apps/api/test/contracts.test.ts
- apps/web/src/api/atividades-do-aluno.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:41:04 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo no banco. A tarefa passa a ler e gravar campos que a 1.0 já criou: em `tentativa_atividade`, o `limite_base_em` e o `envio` (agora gravados no `comecar` e no envio); em `tempo_adicional`, o `percentual`, que é dado sensível (D35) e só entra na conta da duração; e as linhas de `extensao_de_tempo`, só lidas. Na saída, o aluno passa a receber `janela` e `duracaoMin` (a duração dele, com o tempo adicional já somado) em `minhas-atividades` e em `prova`, e `tempo.limiteEm` em `comecar`, `prova` e `tempo`.

Fora da tabela de dados do docs/lgpd.md: nenhum. As linhas 48, 59 e 60 de `docs/lgpd.md` cobrem a tentativa, o limite, o envio, a extensão e o tempo adicional. A linha 60 já diz que "a tela do aluno mostra a duração, sem dizer que é adicional", e é isso que o código faz. O contador novo `rl:comecar-prova:{usuarioId}` (no Redis, janela de 1 min) não está na tabela, mas os baldes por usuário que vieram antes (`rl:busca-titular`, `rl:importacao`) também não estão (ver recomendação).

Autorização por objeto: ok.
- Toda leitura passa pelo filtro `#daMinhaTurma` (escola, ano, turma e vínculo `confirmado` do aluno da sessão), e tentativa, resposta e tempo adicional passam pelo filtro `#minha`, preso ao `usuarioId` da sessão (`minha-atividade.repository.ts:129-155`).
- O alcance vem antes da janela (`minha-atividade.service.ts:206-211`). O aluno de outra turma e o de outra escola, fora da janela, recebem `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA` (`prova-online-aluno.int.test.ts:409`).
- O id inexistente, o aluno transferido e a escola sem ano em curso também recebem 404.
- O caso do repository troca a escola e o ano em cada leitura e em cada gravação, e exige vazio (`:451-503`).
- As extensões de outro aluno ficam fora da consulta, pelo `or(isNull, eq(alunoId))`.

Logs: limpos. Nenhum logger novo nos arquivos de `minha-atividade`, do rate limit ou do teste novo.

Auditoria: não se aplica. Só o próprio aluno lê os dados dele, e nenhuma ação da regra 20, item 10 é tocada (nem leitura por coordenação ou rede, nem exportação, nem nota, permissão ou saída de IA).

Envio externo: nenhum. Não há chamada de IA nesta tarefa.

Seed/fixture: sintético. Os nomes do teste são "Aluna Sintética Ana", "Aluno Sintético Caio" e outros assim (`prova-online-aluno.int.test.ts:78-79`). O e2e usa um mock com dado fixo.

Exposição:
- **DTOs explícitos e estritos:** `paraATela` e `#emAndamento` montam a saída campo a campo, e os schemas `provaAntesDeComecarResponseSchema`, `provaEmAndamentoResponseSchema` e `tempoDaProvaSchema` são `strictObject`.
- **Tempo adicional fora da saída:** o percentual nunca sai da API. O contrato do aluno recusa os campos `percentual`, `tempoAdicional`, `adicional`, `saida`, `extensao` e `concedidoPor` (`apps/api/test/contracts.test.ts:319`). O teste de integração confere no texto da resposta que não aparece `/adicional|percentual/` em `prova`, `minhas-atividades`, `comecar` e `tempo`, e que o colega lê 40 onde a aluna com +50% lê 60 (`prova-online-aluno.int.test.ts:220-240`).
- **Erros:** `PROVA_FORA_DA_JANELA` e `TEMPO_ESGOTADO` saem tipados e sem dado no corpo.
- **Tela:** a web só tira `comecou` e `tempo` do que recebe e valida o resto pelo `provaResponseSchema`, que é estrito.

Pergunta de fechamento: o código responde. O arquivo do titular já traz da tentativa o `limite_base_em`, o `envio`, a `ordem` e as `saidas_da_aba`, e traz o `tempo_adicional` (`packages/core/src/titular/leitura-do-titular.ts:310-337`). Esta tarefa não cria dado novo nem destino novo.

Bloqueantes: nenhum.

Recomendações:
- Registrar em `docs/lgpd.md` os baldes por usuário do rate limit, entre eles o novo `rl:comecar-prova:{usuarioId}` (id do aluno como chave, 1 minuto, sem log, métrica ou leitura à mão). A tabela já registra assim os contadores do acesso (linha 93) e os contadores por IP (linhas 183-205). Não bloqueia, porque os baldes anteriores, `rl:busca-titular` e `rl:importacao`, também não estão lá.
- Quem tem tempo adicional pode deduzir que tem, comparando a própria duração com a de um colega. É o comportamento que a linha 60 do `docs/lgpd.md` aceita. Vale citá-lo na AIA ou no texto da 12.0, para a escola não ser pega de surpresa.

Arquivos auditados:
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts`
- `packages/shared/src/atividade/prova.ts`
- `packages/shared/src/atividade/limite-da-tentativa.ts`
- `packages/core/src/rate-limit/rate-limit.guard.ts`
- `packages/core/src/rate-limit/rate-limiter.ts`
- `apps/api/src/atividade/prova-online-aluno.int.test.ts`
- `apps/api/test/contracts.test.ts`
- `apps/web/src/api/atividades-do-aluno.ts`
- `e2e/support/aluno.ts`
- `docs/lgpd.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-24 00:41:46 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Caminho quente tocado: prova

Rate limit: ok. O `comecar` tem balde próprio, `rl:comecar-prova`, de 30 por minuto por usuário (`packages/core/src/rate-limit/rate-limiter.ts`, `consumeDoComecarDaProva`). Ele conta além dos limites gerais por usuário e por escola. O caso "a 31ª chamada do minuto é 429" mostra que um segundo aluno no mesmo IP continua passando.

Fila e prioridade: ok. A tarefa não põe job novo na fila, e nada demorado roda dentro do request. A rotina que grava a tentativa vencida fica para a 6.0.

Concorrência: protegida.
- **Começar × começar:** `on conflict do nothing` na chave única de `tentativa_atividade`, e depois a linha gravada é lida de novo.
- **Mudar a janela × começar:** a aplicação fica em `for share` contra o `for update` do PATCH.
- **PUT e envio:** a aplicação fica em `for share` e a tentativa em `for update`. O `tempo` é lido sem trava.
- **Bloqueio cruzado:** as travas são sempre tomadas na mesma ordem (aplicação, depois tentativa), então não há deadlock.
- Os dois casos de corrida têm teste com a ordem forçada.

Índice e paginação: ok.
- `tentativa_atividade`: a chave única `(escola, ano, aplicação, aluno)` atende.
- `tempo_adicional`: a chave única `(escola, aplicação, aluno)` atende.
- `extensao_de_tempo`: a chave única `(escola, aplicação, chave)` atende pelo começo `(escola, aplicação)`.
- `indisponibilidade`: tem índice em `fim`.
- A lista continua paginada por cursor, e a conta das vencidas só olha a página.

Degradação de IA: não se aplica.

Migration: não se aplica.

Métrica e alerta: ok. As rotas novas entram na medida global `http.server.request.duration`, por rota template e status. O alerta do p95 do PUT e o runbook são da 6.3 (`tasks/prd-avaliacao-e-correcao/6_task.md`).

Bloqueantes: nenhum.

Recomendações:
- A Tech Spec §7c pede "`EXPLAIN` na tarefa", e a 3.0 não o registra. Os índices existem, mas convém anexar o `EXPLAIN` de `extensoes`/`extensoesDas` e da subconsulta de `percentual` da lista em `tasks/prd-avaliacao-e-correcao/3_task.md`.
- O PUT agora roda mais duas consultas, as extensões e `leituraDesde`, com a aplicação e a tentativa travadas. Isso é aceitável a ~80 req/s. A carga `infra/k6/prova-online.js` (6.5) precisa medir esse PUT com o `tempo` a cada 30 s, e não só a gravação.
- A tela de hoje (`apps/web/src/api/atividades-do-aluno.ts`) chama `comecar` ao abrir a prova, então o relógio corre desde a abertura. Com a duração ainda nula, isso não pesa. Quando o professor usar janela e duração antes da 12.0, o aluno começa sem o aviso. Fica para a validação de produto.

Rodei `prova-online-aluno.int.test.ts` e `pulso/pulso.int.test.ts`: 37 de 37 verdes. Nenhum teste chama provedor pago.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-24 00:42:12 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Escopo: respeitado. Embaralhamento, rotina da vencida, rota de extensão, saídas e tela de foco ficaram de fora, como o documento pede. As extensões só são lidas, com a linha posta por SQL no teste.

Aderência à Tech Spec: ok. Única divergência: `minhas-atividades` da escola sem ano em curso responde `NAO_ENCONTRADO`. Ela está declarada na tarefa e ajustada em `cenarios.md` §1b. A §4 da Tech Spec não dizia o status da rota.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **Leitura da vencida numa atividade já encerrada.** Em `minha-atividade.service.ts:55`, a checagem `estado === 'encerrada'` vem antes da do limite. Na lista, `minha-atividade.service.ts:136` só conta as candidatas de atividade `aberta`. Com isso, a tentativa que venceu às 10:40 numa prova que a professora encerrou às 11:00 aparece com `envio: 'encerramento'` e situação `encerrada`, e não com `limite` e `enviada`. A §5.5 diz "vencida sem envio conta como enviada em toda leitura". A escolha está testada ("a da atividade encerrada ficam como estão"), mas não está escrita na Tech Spec. Convém registrar lá, ou inverter a ordem antes de a 6.0 e a 12.0 dependerem do `envio`.
2. **Estado sem saída na tela de hoje.** O caso é o aluno que nunca começou uma atividade já encerrada. Ele clica no item "Encerrada" em Entregues, cujo texto diz "O que você marcou ficou guardado". Antes via a prova em branco com o aviso de encerrada. Agora o `comecar` (`apps/web/src/api/atividades-do-aluno.ts:148`) responde `ATIVIDADE_ENCERRADA`, e a tela (`apps/web/src/areas/aluno/Atividade.tsx:459`) mostra o `ErrorState` com "Tentar de novo", que nunca vai dar certo. O contrato não permite trazer de volta o comportamento antigo, porque `prova` sem tentativa não traz questões. Ainda assim, convém tratar esse código como estado vazio, ou deixar o caso para a 12.0. A simulação do e2e (`e2e/support/aluno.ts:182`) responde 200 ao `comecar` de atividade encerrada e esconde o caso.
3. **Retorno que ninguém usa.** `MinhaAtividadeRepository.comecar` (`minha-atividade.repository.ts:253`) devolve `boolean`, e o docblock explica esse retorno. O service (`minha-atividade.service.ts:215`) o ignora e relê a tentativa. Basta devolver `void` e tirar a frase do docblock.
4. **Import duplicado.** `minha-atividade.repository.ts:19-21` importa de `@educa/shared` em duas linhas separadas, só por causa do `InvariantException`. Dá para juntar numa linha só.
5. **`signal` só no GET.** Em `atividades-do-aluno.ts:147`, o `signal` vai para o GET da prova e não para o `comecarProva`. É inofensivo, porque o `comecar` é idempotente, mas fica desigual.
6. **Checkboxes desmarcadas.** As subtarefas 3.1 a 3.5 do `3_task.md` continuam `[ ]`. Convém marcar.

Arquivos auditados:
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts`
- `apps/web/src/api/atividades-do-aluno.ts`
- `packages/core/src/rate-limit/comecar-prova-rate-limit.decorator.ts`
- `packages/shared/src/atividade/limite-da-tentativa.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-24 00:44:23 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** começar dentro e fora da janela (os dois lados e o instante do fim); o limite a 10 min do `fecha_em` contra o começo cedo; `prova` sem tentativa não grava; a duração do aluno com +50% contra a do colega, sem dizer "adicional"; PUT e envio um minuto antes e um minuto depois do limite; a tentativa vencida sem envio lida como `envio=limite`; a não avaliativa; a indisponibilidade fechada; a lacuna aberta; as extensões do aluno, da turma e de outro aluno; a lista com a tentativa vencida, a estendida, a enviada e a encerrada; o pulso a +29, +30 e +31 s; as corridas (a) começar × começar e (b) mudar a janela × começar; o `tempo` sem trava; a escola sem ano em curso; o aluno transferido; o intruso de outra turma e de outra escola fora da janela; o repository com escola ou ano errado no contexto; a 31ª chamada do balde e outro aluno no mesmo IP; o contrato do aluno; a ordem `comecar` antes de `prova` na tela. Pela regra 80, item 7, também a resposta que chega junto com o envio.

**Cobertos:** as 16 linhas da tabela têm caso com o nome citado. `prova-online-aluno.int.test.ts` passa inteiro (22 de 22). Não há `.skip` nem IA. A corrida de três chamadas usa `Promise.all` de verdade, e a (b) segura o PATCH com `WriteBlockTrigger`. O `--faltando` lista 19 linhas, e todas têm o motivo em prosa na seção "Mutações".

**Bloqueantes:**

1. **`apps/api/src/atividade/prova-online-aluno.int.test.ts:161`: a corrida (a) com a primeira segurada não prova o que o nome diz.**
   - O que está errado: `esperarNaTrava(bancada.pool, '%tentativa_atividade%')` usa `quantos = 1`. A primeira chamada já conta: ela espera a trava consultiva do gatilho (`wait_event_type = 'Lock'`), e o texto da consulta é o `insert into tentativa_atividade`.
   - Consequência: a espera volta na hora, e o `desarmar` solta a primeira antes de a segunda chegar ao banco. A segunda encontra a tentativa já gravada e nunca passa pelo `on conflict do nothing`.
   - O caso fica verde mesmo com `onConflictDoUpdate` regravando o `limite_base_em`.
   - Correção exigida:
     - usar `esperarNaTrava(bancada.pool, '%tentativa_atividade%', 2)`;
     - acrescentar um bloco de mutação em `minha-atividade.repository.ts:253ss`, trocando `.onConflictDoNothing({ target })` por `.onConflictDoUpdate({ target, set: { limiteBaseEm: sql\`excluded.limite_base_em\` } })`, com este caso.

2. **`apps/api/src/atividade/prova-online-aluno.int.test.ts:422-435`: falta a asserção "a tentativa fica".**
   - O que está errado: a linha da tabela diz "em A, as rotas `NAO_ENCONTRADO`; **a tentativa fica**; `minhas-atividades` só com as de B". Nada confere que a tentativa em A continua existindo, nem que o `comecar` antes da transferência deu 200.
   - Correção exigida: `expect((await rotas.comecar(c.aluno, id)).status).toBe(200)` antes da transferência. Depois das rotas, `expect(await tentativaDe(id, c.aluno)).toMatchObject({ enviada_em: null })`, ou a contagem igual a 1.

3. **`apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:273`: o `.for('update')` de `tentativaTravada` não tem bloco, motivo nem teste de concorrência.**
   - O que está errado: a trava é nova e substitui o `do update` do `openTentativa`. O docblock afirma que "a resposta que chega junto com o envio espera por ele e lê a tentativa já enviada", e nenhum caso prova isso.
   - Por que importa: `lockParaGravar` usa `for share` nas duas rotas, e as duas não se bloqueiam. Sem o `for update`, um PUT em paralelo com o envio grava resposta depois do envio.
   - Correção exigida:
     - um caso com `WriteBlockTrigger` no `update` de `tentativa_atividade`, segurando o envio;
     - o PUT em paralelo, e `esperarNaTrava(..., '%tentativa_atividade%for update%')`;
     - soltar e exigir `ATIVIDADE_ENCERRADA`, com `contarRespostas` igual ao de antes;
     - o bloco que tira o `.for('update')`, apontando para esse caso.

4. **`apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:206`: falta o bloco da trava `for share` do `comecar`.**
   - O que está errado: `atividades.prova(id, true)` é a trava que a linha (b) da tabela cita como "o que distingue" ("sem `for share`, o da antiga"), e não tem bloco.
   - Correção exigida: o bloco `prova(id, true)` → `prova(id)`, com `› (b) mudar a janela × começar`. O caso já fica vermelho sem a trava, porque `esperarNaTrava('%atividade_aplicada%for share%')` não encontra quem esperar.

5. **Termos novos do `where` sem bloco nem motivo em prosa.**
   - `minha-atividade.repository.ts:180`, a subconsulta do `percentual` na lista. O termo `tempo_adicional.aluno_id = usuarioId` é o que impede o +50% da Ana de virar a duração do colega (D35), e não tem bloco. O caso "o tempo adicional do aluno vira só a duração dele" já fica vermelho sem ele, porque o colega lê 40. Os termos de escola e de ano precisam de bloco ou de motivo em prosa.
   - `minha-atividade.repository.ts:310`, o `or(isNull(...), eq(...alunoId...))` de `extensoesDas`. Os dois blocos de `extensoes` se ancoram em `eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)` e não alcançam esta linha. Correção exigida: dois blocos, um por termo, com `› a lista conta como vencida a tentativa`. Sem o `isNull`, a extensão da turma some; sem o `eq`, some a do aluno.

**Recomendações:**
- `prova-online-aluno.int.test.ts:399`: o `tempo` sem trava decide por um `Promise.race` de 3 s. Seria mais firme conferir, com a transação aberta, que nenhum backend do `tempo` aparece em `pg_stat_activity` com `wait_event_type = 'Lock'`.
- `prova-online-aluno.int.test.ts:437-449`: na escola sem ano em curso, conferir também que `enviada_em` segue nulo depois do envio recusado.
- No documento, a linha "Lacuna aberta" diz "limite original = `fecha_em`", mas o caso usa um limite base de 2 min atrás. Vale ajustar o texto.
- O arquivo preserva as indisponibilidades que já estavam no banco compartilhado. Uma sobra recente de uma execução interrompida estenderia os limites e deixaria vermelhos os casos de `TEMPO_ESGOTADO`. Vale registrar isso como armadilha conhecida, ou filtrar pelo intervalo do caso.
- Um caso de integração com professor ou coordenação chamando `comecar` e `tempo` reforçaria a matriz, que hoje é provada só em `matriz.expectativa.ts`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-24 01:24:27 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O diff desta rodada mexe em teste, em documento da tarefa, no `TODO.md` e em uma mudança pequena no repository: o `comecar` agora devolve `void` em vez de `boolean`. O service, em `minha-atividade.service.ts:215`, já não usava o retorno.

Fora da tabela de dados do docs/lgpd.md: nada novo. A recomendação da 1ª rodada (registrar os baldes de rate limit por usuário, entre eles `rl:comecar-prova:{usuarioId}`) foi para o `TODO.md` com dono, o Arquiteto. Uma passada só para todos os baldes é um destino aceitável, porque os anteriores também faltam lá.

Autorização por objeto: ok. Este diff até reforça a prova.
- `atividade-isolamento.int.test.ts:211` agora inclui `comecar` e `tempo` entre as rotas do aluno que professora e coordenação recebem como `NAO_ENCONTRADO`.
- O novo caso de repository (`prova-online-aluno.int.test.ts`, "`extensoesDas` com o id de uma aplicação de outra escola") prova que, no mesmo array, um id de outra escola não traz a extensão dela. É o teste de trocar o id, feito no repository.
- O caso do aluno transferido agora confere que a tentativa em A fica e não é enviada.
- O caso da escola sem ano em curso confere que o envio recusado não gravou.

Logs: limpos. Não há logger nem console nos arquivos de `minha-atividade/`.

Auditoria: nada no diff a exige. São leituras e gravações do próprio aluno, sem leitura por coordenação ou rede, sem exportação, sem nota e sem permissão.

Envio externo: nenhum.

Seed/fixture: sintético. Os testes usam os nomes de fixture (ana, bia, caio, colega) e `randomUUID()` na `chave` da extensão inserida à mão.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada estão aplicadas ou têm destino registrado na tabela "Recomendações sem aplicar" de `tasks/prd-avaliacao-e-correcao/3_task.md`. Entre elas, a do tempo adicional que dá para deduzir comparando com um colega, que vai para a 12.0.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-24 01:24:34 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. No diff da rodada 2 aparecem `tentativa_atividade`, `extensao_de_tempo` e `tempo_adicional`. As três têm `escola_id` e `ano_letivo_id`, e o `insert` do `comecar` pega os dois de `requireEscolaId()` e `requireAnoEmCurso()`.

Queries verificadas:
- `MinhaAtividadeRepository.comecar` agora devolve `void`. O escopo e o `on conflict do nothing` continuam iguais, alvo incluído. O service, em `minha-atividade.service.ts:215-216`, não usava o retorno e relê a tentativa pelo `#minha`.
- `tentativaTravada` continua com `#minha` e `for update`; só o comentário mudou.
- `extensoes` e `extensoesDas` (`minha-atividade.repository.ts:280-311`) filtram por escola e ano do contexto, pela aplicação e por aluno nulo ou igual ao da sessão.
- A subconsulta de `percentual` da lista (`minha-atividade.repository.ts:179`) é correlacionada a `atividade_aplicada`, que já passa pelo `#daMinhaTurma`. Tirar os termos de escola e ano não muda o resultado, e o texto da tarefa registra isso com a justificativa de índice.
- Não há `escolaId` vindo do corpo ou da query, e nenhum `@Unscoped()` novo.

Teste de isolamento: presente e efetivo.
- `atividade-isolamento.int.test.ts:211` agora cobre também `comecar` e `tempo` para professora e coordenação, com resposta `NAO_ENCONTRADO`.
- O caso novo de `extensoesDas` (`prova-online-aluno.int.test.ts:528-539`) põe no mesmo array uma aplicação de outra escola e uma da própria. Sem o escopo de escola e ano, a extensão da outra entraria no mapa e o teste quebraria.
- O caso do aluno transferido agora confirma que a tentativa em A continua lá e não foi enviada. O da escola sem ano em curso confirma que o envio recusado não gravou nada.

Bloqueantes: nenhum.

Recomendações:
- `prova-online-aluno.int.test.ts:528-539`: a aplicação da outra escola está também em outro ano letivo. Com isso, o caso só quebra se as duas cláusulas, `escola_id` e `ano_letivo_id`, forem removidas juntas; tirar só uma, qualquer uma, não o derruba. Se a intenção é provar cada cláusula sozinha, falta um caso com o ano letivo trocado na mesma escola, ou um bloco de mutação para cada termo de `extensoesDas` em `tasks/prd-avaliacao-e-correcao/3_task.md`.

Arquivos auditados:
- apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
- apps/api/src/atividade/prova-online-aluno.int.test.ts
- apps/api/src/atividade/atividade-isolamento.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-24 01:24:36 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- Em `apps/api/src/atividade/prova-online-aluno.int.test.ts`, no caso de `tempo` sem trava sobre a aplicação, o filtro `query ilike '%atividade_aplicada%'` também pega qualquer consulta em `tentativa_atividade`, `extensao_de_tempo` ou `tempo_adicional`, porque todas citam a coluna `atividade_aplicada_id`. Se outro arquivo de integração rodar em paralelo e tiver uma espera de trava nessas tabelas, este caso falha sem motivo. Ele nunca passa por engano. Restringir a `'%from "atividade_aplicada"%for%'` ou filtrar pelo `id` da aplicação.
- No mesmo arquivo, a corrida (a) com a primeira segurada ainda espera 1.100 ms de relógio de parede para garantir outro `now()`. Isso já existia e não muda o resultado do teste. Fica registrado para a retro, junto com a troca que esta rodada fez no caso do `tempo`, que passou a usar `aguardar`.

Conferido nesta rodada:
- `comecar` no repository agora devolve `void`. O service, em `minha-atividade.service.ts:215`, não usava o retorno e relê a tentativa gravada. O `on conflict do nothing` segue igual.
- A corrida (c) entre enviar e responder agora tem teste, com mutação que tira o `for update`.
- As mutações novas de `extensoesDas` e do `percentual` da lista têm caso que as derruba.
- O `EXPLAIN` registrado na tarefa mostra as três consultas começando por `escola_id` nas restrições únicas que já existem.
- A rodada anterior não exigiu correção. As recomendações aplicadas estão no diff ou registradas com destino na tarefa e no `TODO.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-24 01:24:56 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. O diff desde a 1ª rodada (`abcb9b0b..822092dd`, sem `achados/`) muda cinco arquivos: `TODO.md`, `minha-atividade.repository.ts`, `prova-online-aluno.int.test.ts`, `atividade-isolamento.int.test.ts` e `3_task.md`. Nenhum toca `nota`, `lancadaPor`, correção ou aprovação. Todos com autor humano? sim, porque nenhum caminho novo foi aberto.

Decisão autônoma sobre aluno: ausente. A mudança no repository é só de assinatura. Em `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:251`, `comecar` passa a devolver `Promise<void>` em vez de `boolean`. O único chamador, em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:215`, já não usava o retorno. O `on conflict do nothing` continua, e com ele a tentativa única com o limite da primeira chamada. Nada decide aprovação, reprovação ou encaminhamento.

Aprovação registrada: ok. Nenhuma saída de IA nova chega ao aluno. A tarefa trata da tentativa e do tempo da prova online, e nada disso é gerado por IA.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança desde a 1ª rodada.

Bloqueantes: nenhum.

O que conferi no diff:
- **O tempo do aluno, item 7 da regra 70.** O teste novo da lista (`prova-online-aluno.int.test.ts:99-102`) confirma que o tempo adicional é lido por aplicação e que o aluno vê só a própria duração, sem dizer de onde ela veio.
- **O que o diff não traz.** Nenhum campo novo de comportamento, navegação ou tempo ocioso entra.
- **A corrida (c) enviar × responder** (`:110-134`) prova que a resposta que chega junto com o envio é recusada (`ATIVIDADE_ENCERRADA`) e não é gravada.
- **O caso do aluno transferido** (`:169-171`) e o da **escola sem ano em curso** (`:179-180`) confirmam que a tentativa fica intacta e que nada sai como enviado sem o aluno ter enviado. Isso protege o lote que a 6.0 vai validar (D56).
- **Correções exigidas da 1ª rodada:** não havia. As minhas duas recomendações estão registradas em `3_task.md` com destino. O lote mostrar a tentativa enviada pelo limite, e o registro da validação guardar isso, vai para a 6.0. O aviso ao aluno, em português comum, de que a prova foi enviada porque o tempo acabou vai para a 12.0.
- **O que mudou depois de `822092dd` na pasta de trabalho:** só a tabela "Revisões" de `3_task.md`, escrita pelo hook. O teste e o decorator do rate limit aparecem como apagados na comparação só porque ainda não estão no índice do git; os arquivos existem na pasta.

Recomendações:
- Na 6.0, quando a tentativa vencida passar a ser gravada, a escolha entre `encerramento` e `limite` precisa estar escrita na Tech Spec antes de ir para o lote. Essa escolha foi levantada pelo revisor-geral e já tem esse destino. Ela decide o que o professor vê antes de validar (D56).

## revisor-geral · 2ª rodada · APROVADO · 2026-11-24 01:24:57 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- O caso novo se chama "(c) enviar × responder", tanto no teste (`apps/api/src/atividade/prova-online-aluno.int.test.ts:300`) quanto na tabela de "Como testar" de `tasks/prd-avaliacao-e-correcao/3_task.md:57`. Só que o "(c)" do `tasks/prd-avaliacao-e-correcao/cenarios.md:114` é outra corrida, "resposta × encerrar e resposta × job". Com a mesma letra para duas corridas, quem for rastrear o cenário até o teste se engana. Sugiro trocar o rótulo, ou acrescentar a linha no `cenarios.md` com uma letra própria.
- Em `extensoesDas` (`apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:303-304`), o caso novo põe no array o id de outra escola. Essa escola tem também outro ano letivo, então tirar só o `eq(escolaId)` não deixa o caso vermelho, porque o `anoLetivoId` ainda filtra. O caso prova o escopo como um todo, mas não cada termo. Se a intenção é provar o `escolaId` sozinho, falta um caso com o mesmo ano e outra escola, ou uma mutação declarada que mostre que o termo é equivalente. A cobertura é do `test-engineer`; fica aqui só registrado.
- As recomendações da 1ª rodada foram tratadas:
  - O retorno sem uso de `comecar` saiu: agora é `Promise<void>`, e o service relê a tentativa na linha 216.
  - O import duplicado de `InvariantException` foi juntado ao outro.
  - O laço de isolamento agora cobre `comecar` e `tempo`.
  - O EXPLAIN da §7c ficou registrado.
  - As que ficaram sem aplicar têm destino escrito, nas tarefas 6.0, 12.0 e 6.5 e no `TODO.md`. A da ordem `encerrada` antes do limite depende de o Arquiteto escrever a escolha na Tech Spec antes da 6.0. Confira isso quando a 6.0 começar.

## test-engineer · 2ª rodada · APROVADO · 2026-11-24 01:26:34 · `tasks/prd-avaliacao-e-correcao/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 2):** as cinco correções da 1ª rodada, mais o que elas afetam:
- (a) começar × começar com a primeira segurada, com a segunda chegando de fato ao `on conflict`
- transferido com a tentativa em A, e a tentativa continua lá
- (c) enviar × responder, travados pelo `for update` da tentativa
- (b) a trava `for share` do `comecar`
- os termos do `percentual` da lista e de `extensoesDas`

**Cobertos:** todos. Rodei o arquivo `apps/api/src/atividade/prova-online-aluno.int.test.ts` uma vez, sem alterar nada, e passaram os 24 casos.

1. **Corrida (a):** feito, em `prova-online-aluno.int.test.ts:163`, com `esperarNaTrava(..., '%tentativa_atividade%', 2)`. O gatilho é `after insert`. A primeira fica parada na trava consultiva, com a linha já inserida. A segunda lê a tentativa sem trava (`service.ts:208`), não acha nada, vai para o `insert` e fica esperando na chave única. As duas aparecem como espera de trava no `insert`. Também entrou o bloco `onConflictDoUpdate` (3_task.md:657ss). No `do update` o gatilho de insert não dispara. A segunda regrava o `limite_base_em` com o `now()` dela, 1,1 s mais novo, e a asserção da linha 169 falha pelo motivo certo.
2. **Transferido:** feito. A linha 464 exige 200 no `comecar` antes da transferência. As linhas 474 e 475 conferem que a tentativa continua lá, uma só e com `enviada_em: null`.
3. **Corrida (c):** feito, no caso das linhas 300 a 324, com bloco (3_task.md:650ss). O envio trava a tentativa em `for update`, faz o `update` e fica parado no gatilho segurando a linha. O PUT passa pelo `for share` da aplicação e fica na fila do `for update`; a espera procura `%tentativa_atividade%for update%`, e o `update` do envio não casa com esse padrão. Depois de solto, o PUT relê a linha já enviada e recebe `ATIVIDADE_ENCERRADA`. O número de respostas é conferido durante a espera e depois dela. A linha nova da tabela de testes (3_task.md:57) cita o caso pelo nome.
4. **Trava do `comecar`:** feito. O bloco `prova(id, true)` → `prova(id)` aponta para "(b) mudar a janela × começar". Sem a trava, a espera em `%atividade_aplicada%for share%` não acha ninguém e o caso fica vermelho.
5. **Termos do `where`:**
   - Subconsulta do `percentual` (repository:179): dois blocos. Sem o termo do aluno, o colega lê 60 em vez de 40. Sem o termo da aplicação, a segunda aplicação da Ana com +100% (linhas 234 a 236) faz a lista falhar.
   - Termos de escola e de ano da subconsulta: têm motivo em prosa (3_task.md:123), com EXPLAIN em "Como testar". O motivo é aceitável, porque o `where` da própria lista (`#daMinhaTurma`) tem bloco e caso de repository.
   - `extensoesDas` (repository:306): dois blocos, um por termo, contra "a lista conta como vencida". Sem o `isNull`, a de `daTurma` vira vencida. Sem o `eq`, vira a de `doAluno`.

**Fora das correções:**
- Entraram o `comecar` e o `tempo` no caso de papéis em `atividade-isolamento.int.test.ts:211`.
- No caso da escola sem ano em curso, agora se confere que o envio recusado não gravou nada (linha 491).
- O caso "`tempo` é leitura sem trava" deixou o `Promise.race` de 3 s. Agora espera até a chamada responder ou até alguém aparecer parado na trava, sem relógio de parede.

**Bloqueantes:** nenhum.

**Recomendações:**
- `prova-online-aluno.int.test.ts:528`: o caso novo de `extensoesDas` com o id de outra escola nunca fica vermelho com um termo só a menos. A escola da outra tem outro ano letivo, e o termo que ficar já filtra a linha. Vale como cenário de isolamento, mas nenhum bloco depende dele. Se a intenção for prová-lo, monte a extensão da outra escola com o mesmo `anoLetivoId` do contexto.
- `prova-online-aluno.int.test.ts:159`: os 1.100 ms de espera real servem só para os dois `now()` serem diferentes. Com o bloco, um intervalo bem menor já basta, porque a comparação é em milissegundos. Não é prazo, só tempo a mais na suíte.
- O bloco que tira o termo da aplicação no `percentual` fica vermelho por erro do banco: a subconsulta volta mais de uma linha e a lista responde 500. Não é um valor errado. Continua sendo a regra que falta, mas uma asserção sobre o código do erro deixaria o motivo explícito.
