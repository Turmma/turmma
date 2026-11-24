# Achados das revisões — `tasks/prd-avaliacao-e-correcao/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:52:19 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. As que a consulta passou a ler já existiam e foram conferidas em `packages/core/src/db/schema/prova-online.ts`:
- `extensao_de_tempo` e `convocado_da_segunda_chamada` têm `escolaId` e `anoLetivoId`, id UUID (`uuidv7()`) e FK composta `(escola, ano, aplicação)`.
- `pulso_da_api` e `indisponibilidade` são globais e vêm da 2.0, lidas por `QuedasDaApiRepository.leituraDesde`, que tem `@Unscoped` com justificativa escrita. Elas não guardam escola nem pessoa.

Queries verificadas: em `apps/api/src/tutor/tutor.repository.ts`:
- `consultaDasAvaliativasAbertas` (232–265): o `where` filtra por `escolaId` e `anoLetivoId` do contexto, por `requireEscolaId` e `requireAnoEmCurso`. O `alunoId` vem de `requestSessao().usuarioId` e está nas junções da tentativa e do convocado.
- `avaliativaAberta` (276–294): a extensão é filtrada por `escolaId` do contexto e pelo id de uma aplicação que já passou pelo escopo. O `alunoId` também vem do contexto.

Os chamadores passam a turma tirada da sessão ou do alcance do servidor, nunca do cliente: `turno.command.ts:214,260` e `tutor.service.ts:115,209`. Nenhum endpoint novo e nenhum `escolaId` aceito do corpo ou da query. A resposta é o mesmo 409 ou 202 para todos e não revela existência. Não há agregado de rede envolvido.

Teste de isolamento: presente e efetivo, em `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:291-312`.
- Sem `eq(atividadeAplicada.escolaId, escolaId)`, a leitura com escola A e ano da B alcança a prova da B, e o teste quebra.
- Sem o termo do ano, a leitura com escola B e ano da A alcança a prova, e o teste quebra.
- O controle (a B no contexto dela) mostra que a cena trava de fato.
- Os casos do colega e do convocado de outra chamada quebram se a junção perder o `alunoId`.

Bloqueantes: nenhum.

Recomendações:
- `tutor.repository.ts:285`: a leitura de `extensaoDeTempo` filtra a escola mas não o `anoLetivoId` do contexto. Hoje não vaza, porque a FK composta e o id da aplicação já escopada garantem o ano. Mesmo assim, incluir `eq(extensaoDeTempo.anoLetivoId, anoLetivoId)` deixaria o padrão da regra 10, item 3, completo nesta consulta.
- `tutor.repository.ts:291`: `new QuedasDaApiRepository(this.banco)` é criado a cada candidata dentro do laço. O risco é de carga, não de isolamento (fica para o `infra-guardian`). Uma instância só antes do laço já resolve.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-24 00:52:19 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tarefa só lê o que já existe: `tentativa_atividade.iniciada_em` e `limite_base_em`, `extensao_de_tempo.aluno_id` e `minutos`, `convocado_da_segunda_chamada.aluno_id`, e o pulso e as indisponibilidades, que são fatos globais da API, sem pessoa. Não há migration nem coluna nova.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- O aluno vem sempre do contexto (`this.#aluno()`), nunca de parâmetro. A assinatura `avaliativaAberta(turmaId)` não mudou.
- A junção da tentativa e a do convocado se prendem a esse aluno. A extensão lida é só a da turma ou a dele (`apps/api/src/tutor/tutor.repository.ts:102-105`).
- Troquei o id mentalmente: com a turma da escola B no contexto da A, a trava não aparece, nos dois cruzamentos de escola e ano (`apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:291-300`).
- A resposta continua `409 TUTOR_PAUSADO_EM_AVALIACAO` ou `202`, com o mesmo corpo para todos.
- A trava por aluno poderia expor o tempo extra de um colega pelo estado dele: um aluno travado ou livre poderia deduzir a extensão do outro. Isso não acontece. A extensão de um aluno não trava o colega, e a tentativa e a queda de um colega não prendem quem não começou (linhas 202-209 e 222-230 do mesmo arquivo de teste).
- O título da segunda chamada só chega ao convocado.

Logs: limpos. O diff não acrescenta nenhuma chamada de log.

Auditoria: não se aplica. A tarefa só lê, quem lê é o próprio aluno, e nenhuma ação da lista do item 10 é tocada.

Envio externo:
- Nada novo vai ao modelo.
- Esta é a parte mais delicada para a regra 20: o tempo adicional costuma revelar uma adaptação. O caso da memória do Tutor (D66) prova que tempo adicional, percentual, saídas da aba, extensão e limite não entram no pedido ao modelo, conferindo o pedido capturado no adaptador falso. Ele também traz o controle positivo, a memória do trabalho do aluno.
- O registro em `ExecucaoAgente` não mudou.

Seed/fixture: sintético. Os títulos são de fantasia ("Prova com extensão", "Prova do 2ºC"), os ids vêm de `randomUUID`, e não há nome, matrícula nem contato de pessoa.

Pergunta de fechamento: a tarefa não grava dado novo nem cria destino novo de envio. O que o arquivo do titular já responde continua igual.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:23`: as linhas de log são capturadas (`linhasDeLog`), mas nenhum teste as confere. Um teste barato fecharia a regra 20, item 9, no caminho novo: depois do caso da memória, conferir que o log não traz o texto da pergunta, o título da prova nem `percentual`.
2. `apps/api/src/tutor/tutor.repository.ts:111`: hoje o motivo de não levar o limite à memória do Tutor está só no teste. Um comentário no docblock de `avaliativaAberta` dizendo que o limite e a extensão servem só para a trava e nunca entram no contexto do modelo (D66) protegeria contra quem reaproveitar a consulta mais tarde.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-24 00:52:28 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só lê. O diff não toca `Nota`, `correcao` nem `entrega`. O teste semeia resultado só pelo fixture `lancarLote`, que já existia, e nenhum caminho novo de escrita aparece. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A trava do Tutor decide quando o Tutor está disponível. Não aprova, não reprova e não encaminha ninguém.

Aprovação registrada: ok. A tarefa não cria nenhuma saída de IA nova. A resposta do Tutor continua sendo a única exceção (D47). A memória do Tutor continua lendo só o resultado de lote aprovado: a junção com `entrega.estado = 'aprovada'` segue intacta em `apps/api/src/tutor/tutor.repository.ts:510`.

Supervisão do tutor: ok. A trava fica mais precisa sem abrir nenhum uso do Tutor fora da vista do professor.
- **A trava continua no servidor.** O service e o comando (`turno.command.ts:214`, `:260`) chamam `avaliativaAberta` nos mesmos três pontos de antes.
- **A queda da API não destrava o Tutor no meio da prova.** O caso da lacuna aberta e o da indisponibilidade fechada provam isso pelo `limiteDaTentativa`.
- **A pesquisa na web (item 4c) fica desligada durante a avaliação para quem tem prova à frente.** O Tutor inteiro já fica travado nesse período.
- **As saídas da aba, o tempo adicional, a extensão e o limite não chegam à memória do Tutor (D66, D70).** A memória lê colunas explícitas em `tutor.repository.ts:496-504`: atividade, título, conteúdo, data de envio, acertos e acertos por habilidade. Nenhuma coluna da prova online entra. O caso `a memória do Tutor (D66)` (linhas 353-377 do teste novo) prova pelo pedido capturado no modelo falso. Ele confere antes que a memória do trabalho do aluno chegou ao pedido, para a busca pelos termos proibidos não passar à toa. Usa um aluno com +50% de tempo, 7 saídas da aba e uma extensão.
- **A trava não infere nada sobre o aluno.** Ela compara o horário do banco com a janela e com o limite dele, e devolve só o título da prova.

Autonomia declarada e visível: sim. Nenhum agente teve nível ou autonomia alterados nesta tarefa.

Supervisão não é vigilância (item 7) e medir o professor não é vigiar (item 8): nada mudou. As saídas da aba continuam presas à avaliação e fora da memória, e a tarefa não cria indicador de professor.

Discursiva e redação sem nota proposta (D55): não se aplica. A tarefa não tem campo, tela nem prompt sobre texto de aluno.

Fotos da tela: o prompt não trouxe fotos. A tarefa não tem tela, e o código de recusa `TUTOR_PAUSADO_EM_AVALIACAO` é o mesmo de antes.

Bloqueantes: nenhum.

Recomendações:
1. O professor não vê, em lugar nenhum, quais alunos da turma estão com o Tutor travado depois do `fecha_em`, como o estendido ou o convocado da segunda chamada. Não é uma lacuna da regra 70, porque o aluno travado não usa o Tutor. Vale registrar como pergunta de produto para a tela do modo sala na tarefa da segunda chamada (9.0).
2. A busca por `percentual` no pedido ao modelo (linha 374 do teste) pode dar falso vermelho se algum material de teste passar a conter essa palavra. Procurar `"percentual"` em formato de chave JSON, ou o valor `50` junto da chave, deixaria o caso menos frágil sem perder a prova.

Arquivos auditados:
- `apps/api/src/tutor/tutor.repository.ts`
- `apps/api/src/tutor/tutor.service.ts`
- `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`
- `docs/mvp-contratos.md`
- `tasks/prd-avaliacao-e-correcao/7_task.md`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-24 00:53:16 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

**Escopo:** respeitado. As subtarefas 7.1 a 7.4 foram feitas e nada da 9.0 (a rota da segunda chamada) entrou. Os convocados e as tentativas são semeados direto no banco, como a tarefa manda. O `tutor.service.ts` só ganhou o docblock novo.

**Aderência à Tech Spec:** ok.
- A trava funciona como a §5.10 pede:
  - é por aluno;
  - vai do `abre_em` até o `fecha_em` somado às extensões da turma, ou até o `limiteDaTentativa`, o que vier depois;
  - a avaliativa sem janela trava como antes;
  - a segunda chamada trava só o convocado.
- O limite usa as indisponibilidades e a lacuna aberta (`leituraDesde`), como a §5.4 manda.
- A consulta desce pelo índice `atividade_aplicada_turma_idx (escola_id, turma_id, id)`, e a extensão é lida pelo `(escola_id, atividade_aplicada_id)` da §7c.
- A assinatura `avaliativaAberta(turmaId)` não mudou: o aluno vem de `#aluno()`, isto é, da sessão. Os quatro chamadores continuam iguais: `tutor.service.ts:115` e `:209`, `turno.command.ts:214` e `:260`.
- Nenhuma divergência foi declarada e não achei divergência em silêncio.

**Portão local:** carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

**Bloqueantes:** nenhum.

**Recomendações:**
1. O `tasks/prd-avaliacao-e-correcao/cenarios.md` §2 (linhas 102 a 105) ainda diz que os casos da trava e da memória do Tutor estão em `apps/api/src/tutor/tutor.int.test.ts`, mas eles estão em `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`. O arquivo novo já vinha previsto no `7_task.md`, então isto é só alinhar a referência, não uma divergência.
2. O bloco de mutação "decide o que vier depois: só o limite", no `7_task.md`, escreve `candidata.agora.getTime() < limite?.getTime() ?? 0`. Pela precedência, isso vira `(a < b) ?? 0`. A mutação continua válida, porque o teste fica vermelho, mas fica mais claro escrever `< (limite?.getTime() ?? 0)`.
3. Em `apps/api/src/tutor/tutor.repository.ts:236`, `consultaDasAvaliativasAbertas` ficou pública só para o `EXPLAIN` do teste. O docblock explica o motivo. Se o projeto já tiver um jeito de expor consulta para `EXPLAIN` (ver como fez a correção `explain-semana-itens`), vale seguir o mesmo.
4. Em `apps/api/src/tutor/tutor.repository.ts:290`, a linha que monta a chamada de `limiteDaTentativa` com o `await` espalhado lá dentro fica mais legível se a leitura das quedas for para uma variável própria antes da chamada.

Arquivos auditados:
- `apps/api/src/tutor/tutor.repository.ts`
- `apps/api/src/tutor/tutor.service.ts`
- `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`
- `docs/mvp-contratos.md`
- `tasks/prd-avaliacao-e-correcao/7_task.md`

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-24 00:53:46 · `tasks/prd-avaliacao-e-correcao/7_task.md`

```
VEREDITO: REPROVADO
Caminho quente tocado: tutor
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: faltando
Bloqueantes:
- apps/api/src/tutor/tutor.repository.ts:276 (avaliativaAberta)
  Problema: nada mede a latência da trava. A subtarefa 7.2 está marcada [x] ("com a latência medida, roda a cada turno"), mas não entrou métrica nenhuma. O EXPLAIN do teste mostra o plano da consulta, não mede quanto ela demora.
  A spec pede as duas coisas, separadas:
  - techspec.md:111 diz "Latência medida na tarefa", e a §7c põe o "EXPLAIN na tarefa" em outra linha, a dos índices;
  - achados/revisao-spec.md:387 diz "medir a latência".
  Por que pesa às 10h: o código passou de 1 consulta para até 1 + 2 por avaliativa aberta (extensões na linha 281, quedas na 290). Ele roda três vezes por turno: no POST, no `preparar` e no `concluir`, este dentro da transação que grava a resposta.
  O `http.server.request.duration` cobre a rota inteira. Ele não separa a trava e não alcança o `preparar` nem o `concluir`, que rodam no worker. Se a trava ficar lenta, ninguém vê.
  Correção exigida:
  - um histograma novo em `METRICS`, por exemplo `tutor.trava.duracao`, em segundos, com só `escola_id` no rótulo (nada de aluno nem prova), gravado em volta de `avaliativaAberta` e também quando ela lança erro;
  - um caso em `tutor-trava-da-prova.int.test.ts` que prove que a medida é gravada no caminho com prova (as consultas extras) e no caminho sem prova;
  - se a decisão for não ter alerta, escrever isso na tarefa; se houver alerta, ele leva o parágrafo no `docs/runbook.md`.
Recomendações:
- O EXPLAIN (`tutor-trava-da-prova.int.test.ts`, por volta da linha 316) só confere `atividade_aplicada`. A consulta de extensões (`tutor.repository.ts:281`) e as junções de tentativa e convocado ficam sem prova de índice. Elas devem usar as chaves únicas `extensao_de_tempo_chave_por_aplicacao`, `tentativa_atividade_uma_por_aluno` e `convocado_da_segunda_chamada_um_por_aluno`, mas vale estender o teste a esses nós.
- O laço da linha 278 faz duas consultas por candidata. O número é pequeno (avaliativas abertas da turma), mas cresce com prova vencida que a rotina não encerrou. Dá para trazer a soma das extensões da turma e do aluno na própria consulta principal, ou ler as quedas uma vez antes do laço, desde a menor `iniciadaEm`.
- O cenário k6 previsto (`prova-online.js`, cenarios.md §5) não gera turnos do Tutor com prova aberta, então a trava não entra na carga. Registrar isso para a tarefa da carga, ou incluir alguns turnos do Tutor nas turmas sem prova da mesma escola.
```

## test-engineer · 1ª rodada · REPROVADO · 2026-11-24 00:55:16 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a prova na janela trava o aluno da turma, pelo repository e pela rota (409 com `TUTOR_PAUSADO_EM_AVALIACAO`).
- **Bordas:**
  - prova de amanhã;
  - prova cujo fim já passou com a aplicação ainda `aberta` (a rotina não rodou);
  - aluno com extensão além do `fecha_em`, e o colega sem extensão;
  - queda fechada dentro da prova, e a queda anterior à tentativa;
  - lacuna aberta;
  - extensão da turma para o aluno sem tentativa;
  - limite vencido com a janela ainda aberta;
  - tentativa sem limite base;
  - avaliativa sem janela;
  - atividade que não é avaliativa;
  - segunda chamada: o convocado, o colega, e o convocado de outra segunda chamada;
  - a extensão e a tentativa de outra prova, ou de um colega;
  - **duas avaliativas abertas na mesma turma**, o caso do professor com duas disciplinas na turma: a primeira já acabou mas segue `aberta`, e a segunda está na janela.
- **Permissão:** o aluno da outra turma da escola segue livre.
- **Isolamento:** a escola A com o ano da B, e a escola B com o ano A; a extensão da B não estica a trava da A.
- **Latência:** o `EXPLAIN` mostra que a consulta desce pelo índice `(escola_id, turma_id)`.
- **Memória:** o tempo adicional, as saídas da aba, a extensão e o limite não chegam ao pedido ao modelo.
- **Concorrência:** não se aplica. É leitura, e a corrida do 202 já está documentada no `turno.command.ts`.

**Cobertos:** todos, menos o das duas avaliativas abertas. Cada linha da tabela tem o seu caso, e os nomes batem com os `it` do arquivo. Não há `.skip` nem teste comentado. O modelo é o adaptador falso (`startFakeModel`), e o teste de memória tem controle positivo (a memória do trabalho entra no pedido). Os 32 blocos de mutação alcançam a cláusula que dizem alcançar. Rodei `npx vitest run --project integracao` nos dois arquivos: `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` passou (20 de 20) e `apps/api/src/tutor/tutor.int.test.ts` também (52 de 52). O segundo arquivo não foi alterado e por isso não roda no portão.

**Bloqueantes:**

1. **`apps/api/src/tutor/tutor.repository.ts:267-293`: o laço sobre todas as candidatas não tem teste nem bloco.**
   - **O que mudou:** a tarefa tirou o `.limit(1)` e passou a percorrer as candidatas com `for (const candidata of …)`. O `return undefined` só sai depois de olhar todas.
   - **O que falta:** nenhum caso do arquivo deixa duas avaliativas candidatas abertas na mesma turma. O `afterEach` encerra o que cada caso semeou, e "a extensão e a tentativa de outra prova" encerra a outra antes de ler.
   - **Duas mutações passariam verdes:**
     - devolver o `.limit(1)` depois do `.orderBy(asc(atividadeAplicada.id))`, que era o comportamento anterior;
     - trocar a linha 112 do diff por `return candidata.agora.getTime() < … ? { titulo } : undefined`, que decide só pela primeira.
   - **O bug que escapa é real:** a prova de Matemática acabou às 9h e segue `aberta` porque a rotina não rodou. A de História abre às 10h na mesma turma. O aluno fica com o Tutor livre durante a prova de História.
   - **Correção exigida:** um caso com duas avaliativas abertas na turma. A primeira por id tem o fim efetivo no passado, e a segunda está dentro da janela. A asserção é que a trava devolve o título da segunda. O caso entra na tabela de testes e ganha um bloco ` ```mutacao ` que devolve o `.limit(1)`, exigindo vermelho com `.toBe('<título da segunda>')`.

**Recomendações:**

- **O "409, não 503" da linha da lacuna aberta promete mais do que o teste prova.** A `FilaDeIa` sobe a API com `app.listen` e nunca chama `PulsoService.start()`. Sem esse início, `aceitaProva()` devolve sempre `true`. Se alguém pusesse o `RotasDeProvaGuard` na rota do Tutor, o caso continuaria verde. O `cenarios.md` pede o relógio da recusa ainda fresco, e isso está atendido. Para provar o "não 503" de verdade: subir uma API com `relogioDoPulso` 31 s adiante e `tiqueDoPulso` injetado, e mostrar o Tutor em 409 enquanto `prova` responde 503. Outra saída é tirar o "não 503" da coluna.
- **O `EXPLAIN` só lê a consulta principal (`consultaDasAvaliativasAbertas`).** A leitura de `extensao_de_tempo` e a `leituraDesde` rodam uma vez por candidata, só quando há prova aberta. Nenhuma das duas tem plano conferido, e o título "nenhuma varre a tabela" sugere que todas têm. Vale ajustar o título ou incluir as duas.
- **A 7.2 fala em "latência medida", mas o diff não traz métrica nenhuma.** O que mede é o `EXPLAIN`. Fica para o `infra-guardian` dizer se a medição de duração do turno, que já existe, cobre isso (regra 80, item 10).
- **O pulso fresco vale por caso.** O `beforeEach` grava o pulso de agora, e um caso que passe de 30 s abriria uma lacuna em toda tentativa. Hoje o arquivo inteiro leva cerca de 10 s, então não é bloqueante, mas vale um comentário perto de `pulsouHa(0)`.
- **"A extensão e a tentativa da B não esticam a trava da A" não falharia sem o escopo da escola.** A extensão é filtrada pelo id da aplicação, e a própria seção de mutações admite isso. É controle de cena, não prova de isolamento. A prova de isolamento está no caso dos dois contextos cruzados.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-24 01:53:55 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. Foram lidas `atividade_aplicada`, `artefato`, `tentativa_atividade`, `convocado_da_segunda_chamada`, `extensao_de_tempo`, mais `pulso_da_api` e `indisponibilidade`, que são globais e estão sob `@Unscoped` com justificativa escrita (`apps/api/src/atividade/pulso/pulso.repository.ts:109`, sem mudança nesta rodada).

Queries verificadas:
- `apps/api/src/tutor/tutor.repository.ts:242-272` (`consultaDasAvaliativasAbertas`): sem mudança. Escola, ano e aluno vêm do contexto (`#aluno()`, linha 138: `requireEscolaId`, `requireAnoEmCurso`, `requestSessao`), no `where` e nas junções.
- `tutor.repository.ts:298` (extensões): a recomendação da 1ª rodada foi aplicada. A consulta agora tem `eq(extensaoDeTempo.anoLetivoId, anoLetivoId)` ao lado da escola, os dois tirados do contexto. O escopo está completo.
- `tutor.repository.ts:291` e `:304`: a instância única de `QuedasDaApiRepository` saiu do laço, como recomendado. A leitura continua global e justificada, e o escopo da tentativa segue com quem chama.
- `tutor.repository.ts:286` e `apps/api/src/tutor/trava-duration.ts:27`: o histograma `tutor.trava.duracao` recebe a escola de `this.#aluno().escolaId`, ou seja, do token e não de parâmetro do cliente. O único rótulo é `escola_id`. Não leva aluno, turma nem prova, e a métrica não alcança dado individual. Ela entrou de propósito na lista fechada de `METRICS_WITH_ESCOLA` e na lista de infra. Nenhuma assinatura pública mudou e nenhum endpoint passou a receber `escolaId`.

Teste de isolamento: presente e efetivo.
- Os casos cruzados de escola e ano da 1ª rodada não mudaram.
- O caso novo "a medida da escola A não soma na da B" (`apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:157-164`) quebra se a escola do rótulo deixar de vir do contexto. Com `'sistema'` no lugar, por exemplo, a B não ganha a medida e o `+1` falha. A seção de mutações tem um bloco para esse caso.
- O caso das duas avaliativas na turma não toca o escopo e pega o `.limit(1)`.

Bloqueantes: nenhum.

Recomendações:
- `tutor.repository.ts:286` e `:290`: `#aluno()` é chamado duas vezes por conferência, uma em `avaliativaAberta` e outra em `#quemTrava`. O contexto é o mesmo e não há risco, mas passar o resultado da primeira chamada para `#quemTrava` deixa claro que a escola da medida e a do escopo são a mesma.
- `tutor-trava-da-prova.int.test.ts:65`, `:78`, `:82`: o arquivo agora faz `delete from indisponibilidade` sem filtro e restaura as linhas no `afterAll`. Isso só é seguro enquanto os arquivos de integração rodarem um por vez. Não é questão de tenant, mas vale deixar registrado para o `infra-guardian`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-24 01:54:04 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não toca `Nota`, correção nem lançamento; `avaliativaAberta` só lê. Todos com autor humano? Sim, nada mudou nos caminhos que já existiam.

Decisão autônoma sobre aluno: ausente. A trava decide só se o Tutor responde durante a prova (regra 70, item 4c). Não decide aprovação, reprovação nem encaminhamento.

Aprovação registrada: ok. Esta rodada não cria nenhuma saída de IA nova que chegue ao aluno.

Supervisão do tutor: ok.
- O caso novo das duas avaliativas abertas, `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` (linhas 177 a 187 do diff), deixa a trava mais forte. Antes, uma prova vencida que a rotina não encerrou podia esconder a que está na janela. As duas mutações, `.limit(1)` e "decide só pela primeira", provam isso.
- A memória do Tutor (D66) continua sem tempo adicional, saídas da aba, extensão nem limite. O caso agora confere também o log do turno, com controle de log não vazio, e o docblock de `apps/api/src/tutor/tutor.repository.ts:278-283` deixa escrito que esses campos não entram no contexto do modelo.

Autonomia declarada e visível: sim. A rodada não muda o nível de nenhum agente.

Supervisão não é vigilância (item 7): ok. O histograma `tutor.trava.duracao` (`apps/api/src/tutor/trava-duration.ts:17-28`) mede quanto tempo o servidor leva para conferir a trava. Não mede o comportamento do aluno.
- O único rótulo é `escola_id`, provado por teste e por mutação.
- Não mede tempo ocioso nem navegação.
- Aparece só no painel de operação (`infra/grafana/paineis/fundacao.json`, painel 62), com o p95 por escola. Não chega à tela do professor nem à da coordenação.

Sem nota proposta em discursiva e redação (D55): nada no diff.

Medir o professor (D45): nada no diff. A métrica não tem professor e não forma indicador de pessoa.

Correções exigidas da rodada anterior: não havia bloqueante.
- A recomendação 2 foi feita: o pedido ao modelo agora procura a chave `"percentual"`, não a palavra solta, e o log procura a palavra solta.
- A recomendação 1 foi registrada com destino na tarefa 11.0, em `tasks/prd-avaliacao-e-correcao/7_task.md`, na seção "Recomendações sem aplicar". O motivo é correto: o aluno travado não está usando o Tutor, então não há uso que o professor deixe de ver.

Bloqueantes: nenhum.

Recomendações:
1. A busca por `"percentual"` (com aspas) no pedido ao modelo só pega essa chave exata. Uma chave como `percentualAdicional` ou `percentual_extra` passaria. Hoje `tempoAdicional` e `tempo_adicional` cobrem as formas conhecidas. Se a adaptação ganhar outro formato no contexto do modelo, vale uma busca pelo valor semeado (`50`, junto da chave da adaptação), além do nome.
2. Quando a tarefa 11.0 mostrar ao professor quem está travado depois do `fecha_em`, a tela deve dizer só o fato ("Tutor pausado: em prova"). Não deve mostrar o motivo da extensão nem o tempo adicional, porque isso é adaptação (regra 20, item 3).

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-24 01:54:12 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A rodada acrescenta uma métrica de duração e um teste de log. A conferência da trava continua lendo o que já lia (as extensões do aluno e da turma, a tentativa, as quedas) e devolve só `{ titulo }`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- O aluno, a escola e o ano vêm de `#aluno()`, ou seja, do contexto autenticado.
- A consulta de extensões ganhou o termo `eq(extensaoDeTempo.anoLetivoId, anoLetivoId)` (`apps/api/src/tutor/tutor.repository.ts:247`). O escopo ficou mais apertado, não mais frouxo.
- A resposta continua sendo 409 ou 202, igual para todos. Ela não confirma se um registro existe.

Logs: limpos.
- A recomendação da 1ª rodada foi aplicada. O caso da memória do Tutor agora captura o log do turno inteiro, com a trava rodando três vezes.
- O teste confere que o log tem conteúdo (é o controle) e que não traz a pergunta, o título da prova, `percentual`, `tempo_adicional` nem `saidas_da_aba` (`apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:432-436`).

Métrica `tutor.trava.duracao` (regra 20):
- O único rótulo é `escola_id` (`apps/api/src/tutor/trava-duration.ts:27`). É o id opaco da escola, que é a controladora, e não dado de titular. O `docs/lgpd.md:285` já admite `escolaId` em telemetria, e a métrica segue o mesmo padrão de `METRICS_WITH_ESCOLA`.
- Não leva aluno, turma nem prova.
- O teste prova isso: `expect([...new Set(comErro.rotulos)]).toEqual([ROTULO_ESCOLA])`. Existe uma mutação que acrescenta o rótulo `turma` e exige que o teste fique vermelho.
- A métrica entrou de propósito em três listas fechadas: `metrics.ts`, `metrics.test.ts` e `infra/test/metricas.int.test.ts`.
- O painel agrupa só por `le, escola_id`.
- Quando a conferência lança erro, a medida é gravada sem a mensagem nem nenhum dado do erro.

O caso das duas avaliativas abertas na turma:
- O teste semeia duas provas e trava pela segunda, a que está na janela, mesmo quando a primeira por id já acabou.
- A resposta continua só com o título da prova da própria turma do aluno. Não expõe nada de outra turma nem de colega.
- As duas mutações registradas na tarefa (o `.limit(1)` e a decisão tomada só pela primeira candidata) cobrem o laço.

Auditoria: não se aplica. A rodada não tem leitura por coordenação ou rede, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nada novo nesta rodada. O teste da memória (D66) continua provando que o limite, a extensão e o tempo adicional não chegam ao pedido ao modelo. A troca de `'percentual'` por `'"percentual"'` só deixa a busca mais precisa: procura a chave do campo, não a palavra solta. O controle positivo (a memória por habilidade presente no pedido) continua lá.

Seed/fixture: sintético. O teste usa escolas montadas pela bancada, títulos inventados e um banco falso que lança "o banco caiu". O arquivo agora apaga e restaura a tabela `indisponibilidade`, que é tabela de operação e não tem dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- Num painel de operação compartilhado, `{{escola_id}}` como legenda (`infra/grafana/paineis/fundacao.json:311`) mostra o UUID da escola, e não o nome dela. Hoje está correto. A recomendação é manter assim: não trocar por nome da escola num refinamento futuro do painel.

Pergunta de fechamento: a rodada não cria lugar novo de guarda nem de envio de dado do aluno. A métrica não guarda nada sobre um aluno específico, então a resposta à secretaria continua a mesma da rodada aprovada.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-24 01:54:14 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

A correção da 1ª rodada foi feita:
- **O histograma existe.** `tutor.trava.duracao` está em `METRICS`, em segundos, só com `escola_id`, e entrou na lista fechada `METRICS_WITH_ESCOLA`, no teste de núcleo (`metrics.test.ts`) e no de infra (`metricas.int.test.ts`).
- **Mede com qualquer desfecho.** `medirATrava` grava no `finally`, então mede também quando a conferência lança erro. Ele envolve `avaliativaAberta` em `apps/api/src/tutor/tutor.repository.ts:283`.
- **Alcança o worker.** O `globalMeter()` vale nos dois processos, porque o worker chama `startTelemetry` e registra o provedor global. Assim o `preparar` e o `concluir` também ficam medidos.
- **Há teste.** `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` cobre os três caminhos (sem prova, com prova e as consultas extras, com erro), confere que o único rótulo é a escola e que a medida de uma escola não soma na de outra. Cada caso tem bloco de mutação correspondente.
- **Alerta decidido.** A 7_task.md, item 9, registra por escrito que não há alerta e por quê: o limiar depende da carga medida na 6.5. Sem alerta novo, não precisa de runbook. O painel 62 mostra o p95 por escola.

Recomendações:
- `apps/api/src/tutor/trava-duration.ts:18` pede o instrumento ao medidor a cada conferência, três vezes por turno. O SDK reaproveita o mesmo instrumento, então funciona. Mesmo assim, guardar o histograma num lugar fixo do módulo, como faz o `LoginDurationHistogram`, evita refazer a busca no caminho quente.
- Quando a 6.5 medir o `prova-online.js`, voltar ao alerta da trava com o limiar que sair da carga. Hoje a decisão vive só no texto da tarefa; registrá-la no `TODO.md` evita que se perca.
- `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` agora apaga toda a tabela `indisponibilidade` no `beforeAll` e a restaura no `afterAll`. Isso só é seguro enquanto os arquivos de integração rodarem um por vez, e vale escrever essa premissa no arquivo de configuração da bancada, não só no comentário do teste.

Não rodei os testes de integração (precisam do banco). O veredito vem da leitura do diff e do código que ele toca.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-24 01:55:07 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**Escopo.** O histograma, o painel e a lista de métricas em `tools/` cabem na tarefa. A subtarefa 7.2 pede "a latência medida", e a §5.10 da Tech Spec diz "Latência medida na tarefa". Os arquivos novos entraram em "Arquivos previstos", com o motivo de cada um. Não fazem trabalho de tarefa futura.

**Tech Spec.** A tarefa não cria alerta, e isso não diverge da spec: a §7c lista três alertas e nenhum é da trava do Tutor. A regra 80, item 10, só exige parágrafo no runbook para alerta novo, e não há alerta novo.

**Rodada nova.**
- As recomendações 2 e 4 da 1ª rodada foram aplicadas: o bloco "só o limite" agora tem os parênteses, e a leitura das quedas saiu da chamada.
- O caso das duas avaliativas abertas tem dois blocos de mutação (o `.limit(1)` e o `return` da primeira candidata). A ordem pelo id não depende de qual título caiu primeiro.
- `medirATrava` grava com qualquer desfecho, inclusive erro, e o único rótulo é `escola_id`, tirado do contexto. Um caso prova o rótulo único e outro prova a separação entre a escola A e a B.
- Em produção, o padrão `globalMeter()` exporta, porque `startTelemetry` define o provedor global na API (`apps/api/src/main.ts:19`) e no worker (`apps/worker/src/main.ts:11`).
- O painel 62 tem id único e não se sobrepõe ao 61.

Recomendações:
1. `tasks/prd-avaliacao-e-correcao/7_task.md:124` ainda diz "32 blocos, 5 motivos". A seção tem 38 blocos, e o item 1 da autoconferência (linha 71) já diz "38 blocos e 6 motivos". A linha 122 também ficou velha: diz "O código novo é só o `avaliativaAberta` e a consulta", e agora há também `trava-duration.ts`.
2. `apps/api/src/tutor/tutor.repository.ts:134` passa a ser o único repository do projeto que recebe um `Meter`. O motivo para fazer assim faz sentido: há três chamadores, e o repository nasce a cada requisição. Mesmo assim, é um precedente de telemetria na camada de banco. Se aparecer um segundo caso, convém mover a medida para o comando ou o service, ou deixar a regra escrita no guia do desenvolvedor.
3. `apps/api/src/tutor/trava-duration.ts:17` segue o `LoginDurationHistogram` em forma de função e pede o instrumento ao medidor a cada conferência. O docblock justifica isso. Uma alternativa é guardar o instrumento por medidor num `WeakMap` em nível de módulo, o que evita registrar o mesmo instrumento três vezes por turno. Não muda o comportamento.
4. O teste prova a medida só com o medidor injetado. O padrão `globalMeter()` em produção não é exercitado. É cobertura extra, e quem decide é o `test-engineer`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-24 01:55:46 · `tasks/prd-avaliacao-e-correcao/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 2: diff `ca4e425b` → `9ec7726b`, mais a correção pedida na 1ª rodada):**
- Duas avaliativas abertas na mesma turma: a primeira por id já passou do fim e a segunda está dentro da janela. A trava precisa sair pela segunda. Com dois blocos de mutação: o `.limit(1)` de volta, e a decisão tomada só pela primeira candidata.
- A medida nova `tutor.trava.duracao{escola_id}`:
  - grava uma medida por conferência: sem prova, com prova na janela e quando a conferência lança;
  - o único rótulo é a escola;
  - a medida de uma escola não cai na série da outra.
- O isolamento do novo termo `anoLetivoId` na consulta de extensão.
- Nenhum `.skip`, e o modelo é sempre o adaptador falso.

**Cobertos:**
- **A correção exigida foi feita.** O caso novo está em `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`: "duas avaliativas abertas na turma: a primeira por id já acabou e a rotina não rodou, a segunda está na janela, e o Tutor trava pela segunda".
  - As duas provas são candidatas de fato. A consulta só filtra por `estado='aberta'` e `abre_em <= now()`, não por `fecha_em`, então a mutação do `.limit(1)` devolve só a primeira, a trava dá `undefined` e o caso fica vermelho.
  - A troca do `if` por `return … ? … : undefined` também decide pela primeira e fica vermelha.
  - A ordem não depende de sorte: o `.sort()` das strings de UUID é a mesma ordem de bytes do `uuid` no Postgres.
  - O caso está na tabela de testes, e há dois blocos ```mutacao com `falha: .toBe(tituloDe.get(segunda))`.
- **A medida tem um bloco por cláusula:**
  - o envoltório `medirATrava` (pego por `.toBe(antes.contagem + 1)`);
  - a escola do contexto, com a troca por `'sistema'` pega por `.toBe(antesB.contagem + 1)`;
  - o `finally`: sem ele, a conferência que lança não grava medida e `.toBe(comProva.contagem + 1)` falha;
  - o rótulo único, pego por `.toEqual([ROTULO_ESCOLA])`.
  - As asserções são sobre a contagem do histograma antes e depois de cada chamada, e não sobre o código ter rodado.
- **O `anoLetivoId` novo da extensão** não tem bloco, mas o motivo está escrito (FK composta) e é o mesmo dos termos parecidos.
- Os blocos que já existiam foram atualizados para o texto novo (`quedas.leituraDesde`, o `anoLetivoId` no `where`). O bloco do "só o limite" ganhou parênteses e agora compila como a mutação pretendida.
- A tabela de testes cita pelo nome os casos das três linhas novas (duas avaliativas, plano da consulta, latência medida), e os nomes batem com o arquivo.
- Nenhum `.skip`, `.only` nem `todo`. O modelo é o `startFakeModel`.
- Rodei o arquivo com `npx vitest run --project integracao apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`: 23 de 23 passaram, em 8,2 s.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`tutor.repository.ts:134` (a medida do caminho real não tem teste).** O padrão `medidor: Meter = globalMeter()` vem do `turno.command.ts`, mas o `turno.command.ts:128,143,206,259,274` e o `tutor.service.ts:115,130,163,203,224` constroem o repository sem passar o medidor que já recebem. Os casos novos injetam o medidor direto no repository. Assim, nenhum teste prova que um turno de verdade (POST, `preparar`, `concluir`) grava as três medidas que o docstring de `METRICS.duracaoDaTravaDoTutor` promete. Trocar o padrão por um medidor nulo passaria verde. A correção sugerida: passar o medidor injetado do comando e do service ao repository, e escrever um caso pela `FilaDeIa` que conte três medidas por turno.
2. **Controle do log fraco (caso da memória, linhas 433-436).** O `linhasDeLog` acumula o arquivo inteiro, desde a subida da API, então `log.length > 0` não prova que o log do turno foi capturado. Um controle melhor é exigir que o log contenha o evento do turno, ou o id da execução.
3. **`'percentual'` virou `'"percentual"'` no pedido ao modelo.** A troca está documentada na tabela e é aceitável, mas estreita a busca. Vale um comentário dizendo qual texto legítimo do pedido contém a palavra solta.
4. **Limpeza global no `beforeAll`.** Agora o `beforeAll` apaga todas as linhas de `indisponibilidade` e só as devolve no `afterAll`. Se o processo morrer no meio, as quedas que outros arquivos semearam não voltam. Isso só afeta o banco de teste, e a premissa de que os arquivos de integração rodam um por vez está escrita no topo do arquivo.
