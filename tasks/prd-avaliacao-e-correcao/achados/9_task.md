# Achados das revisões — `tasks/prd-avaliacao-e-correcao/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-28 01:20:32 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela nova nesta tarefa. As duas que a segunda chamada grava vieram da tarefa 1.0 e foram conferidas aqui:
- `convocado_da_segunda_chamada` (`packages/core/src/db/schema/prova-online.ts:107`): tem `escolaId` e `anoLetivoId`. O id é UUID (`uuidv7()`). A FK composta `(escola_id, ano_letivo_id, atividade_aplicada_id)` aponta para `atividade_aplicada` e a FK `(escola_id, aluno_id)` aponta para `usuario`. A chave única `(escola_id, atividade_aplicada_id, aluno_id)` serve de índice de escopo.
- `atividade_aplicada.segunda_chamada_de`: a FK composta da original prende escola, ano, turma e artefato.

**Queries verificadas:**
- `AtividadeAplicadaRepository.originalDaSegundaChamada` usa `#noAlcance()`: escola e ano vêm do contexto, mais o vínculo confirmado da professora na turma e na disciplina.
- `quemEnviou` filtra por escola e ano do contexto, pela original e pela lista de alunos, com `enviada_em` preenchido.
- `saveConvocados` grava escola e ano do contexto, e a FK composta recusa a troca de escola ou de ano.
- `create` recebe `segundaChamadaDe`, e a turma e o artefato vêm da original lida do banco, nunca do corpo.
- Também conferidos os reusos: `artefatoParaAplicar` (`for update`, com escopo), `alunosDaTurmaEntre` (a turma vem da original), `saveTempoAdicional` e `porId`.
- `MinhaAtividadeRepository.#daMinhaTurma`: o novo `or(isNull(segunda_chamada_de), exists(convocado do usuário da sessão))` vale para a lista, a prova, a leitura, o `comecar`, o tempo, a resposta, o envio, a saída da aba e o diagnóstico.
- O corpo da rota é `strictObject`, sem `escolaId` nem `anoLetivoId`. O escopo vem sempre do token.
- Nenhum `@Unscoped()`. Nenhuma consulta agregada da camada rede foi mexida.

**Teste de isolamento:** presente e efetivo. O arquivo é `apps/api/src/atividade/segunda-chamada.int.test.ts`.
- **Caso "quem não é a professora daquela turma", via HTTP:** cobre a professora da B, a colega, a de outra disciplina, a com vínculo pendente, a com vínculo encerrado na turma X, a coordenação e o aluno. Todos recebem resposta igual à do id inexistente, e nada é gravado.
- **Caso "nos repositories":** usa o id certo com a escola trocada, com o ano de ninguém e com a escola da B mais a professora da A. Do lado do aluno, testa o colega não convocado, a escola trocada e o ano trocado.
- **Remoção mental das cláusulas:** sem o `#noAlcance()` em `originalDaSegundaChamada`, sem `escolaId` ou `anoLetivoId` em `quemEnviou`, ou sem o termo do aluno ou da aplicação no `exists`, o teste quebra. Os blocos de mutação correspondentes estão na seção "Mutações" de `tasks/prd-avaliacao-e-correcao/9_task.md`.
- **O que a resposta revela:** a original fora do alcance responde `NAO_ENCONTRADO`, igual à inexistente. O aluno de outra turma, de outra escola, inexistente, desativado ou que já enviou recebe sempre o mesmo `ENTRADA_INVALIDA`. Para o não convocado, nenhuma rota responde `PROVA_FORA_DA_JANELA`, então a existência da segunda chamada não vaza.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts:855`: o serviço grava o tempo adicional confiando só no contrato. É o `superRefine` de `segundaChamadaRequestSchema` que garante que esses alunos estão entre os convocados. O `saveTempoAdicional` e o banco só garantem a escola. Como defesa em profundidade, convém conferir no serviço que cada `tempoAdicional[].alunoId` está entre os convocados, como o `aplicar` faz com `#conferirAlunosDaTurma`.
2. `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:720`: o `exists` do convocado prende a escola, mas não o ano (`anoLetivoId`). Hoje não muda nenhum resultado, porque o id da aplicação é único e a consulta de fora já prende o ano. Ficaria simétrico às outras subconsultas de escopo.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 01:20:37 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum caminho novo, todos com autor humano? sim. Neste código a nota que vale é a `correcao` cuja `entrega` está aprovada. A `entrega` não chega a `aprovada` sem `decidida_por` e `decidida_em`; isso é garantido pelo check e pelo gatilho em `packages/core/src/db/schema/entrega.ts`. A segunda chamada só cria a aplicação, os convocados, o tempo adicional e a auditoria (`segunda-chamada.service.ts:37-51`). Quando ela é encerrada, o caminho de correção que já existia abre um lote `pendente` próprio. O caso `› com o lote da original aprovado` (`segunda-chamada.int.test.ts:314-339`) prova isso: a entrega nova sai `pendente`, e a entrega e as correções da original continuam como estavam, sem nova entrega para ela.

Decisão autônoma sobre aluno: ausente. A professora escolhe os convocados um a um (`alunoIds`, mínimo 1, `segundaChamadaRequestSchema`). O sistema não convoca ninguém sozinho, nem como sugestão. Ele só recusa quem não pode ser convocado (quem é de outra turma ou já enviou), e recusa o pedido inteiro.

Aprovação registrada: ok. A tarefa não cria saída de IA nova. A exceção do tutor (D47) não aparece em outro agente.

Supervisão do tutor: ok. A tarefa não mexe no Tutor. A trava do convocado, na tarefa 7.0, já considera `segunda_chamada_de` (`apps/api/src/tutor/tutor.repository.ts:268`).

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi alterado.

Os outros pontos da regra 70 que a tarefa toca:
- **D55:** a segunda chamada repete `conferirArtefatoParaAplicar` (`atividade-aplicada.service.ts:658-661`). Só atividade objetiva pode ser reaberta, então não existe segunda chamada de discursiva ou de redação, nem campo de nota proposto.
- **Supervisão não é vigilância:** a auditoria `atividade.segunda_chamada_aplicada` guarda só contagens. Ela não registra quem foi convocado nem o percentual de tempo adicional, que é dado de adaptação (D35). `acoes.ts:813-818` e o caso em `acoes.test.ts` provam isso. Como a segunda chamada é uma aplicação nova, as saídas da aba ficam presas a ela e não somam com as da original (D70). Nada novo mede comportamento ou infere emoção.
- **Medir o professor (D45):** a tarefa não cria métrica de professor.
- **Permissão:** só o professor da turma pode abrir a segunda chamada. Coordenação, rede e aluno recebem `nunca` em `matriz.ts:373` e em `matriz.expectativa.ts`.
- **Documentação:** `docs/regulacao.md` não foi alterado.

Bloqueantes: nenhum.

Recomendações:
- O teste do lote próprio encerra a segunda chamada pela professora. Falta um caso em que a rotina da 6.0 encerra uma segunda chamada vencida e o lote também nasce `pendente`, separado da original. O caminho é o mesmo e é genérico por aplicação, então isso não bloqueia. Fica para a retro ou para a 11.0.
- Na tela da 11.0, a segunda chamada precisa aparecer com aprovação de lote separada da original. Sem isso, o professor pode achar que já aprovou aquelas notas ao aprovar o lote da original.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 01:20:45 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (o alcance do aluno, `#daMinhaTurma`, que todas as rotas do aluno usam, inclusive o PUT da resposta)
Rate limit: ok (a rota nova passa pela `RateLimitGuard` global, que limita pelo `sub` e pela `esc` do token, `apps/api/src/app.module.ts:180`; nada é limitado por IP)
Fila e prioridade: ok (nada demorado no request: uma transação curta, com a lista de convocados limitada a `MAXIMO_DE_ALUNOS_NA_LISTA_DA_PROVA`; nenhum job novo)
Concorrência: protegida (o índice único parcial `atividade_aplicada_segunda_chamada_aberta_unica` é a barreira, e o 23505 vira `CONFLITO` pelo filtro global; a trava `for update` no artefato vem na mesma ordem do aplicar; o caso (h) do teste usa `WriteBlockTrigger` e `esperarNaTrava`, e há também o caso sequencial. `originalDaSegundaChamada` lê sem trava, e isso é correto porque `encerrada` não volta a `aberta` e, com a original encerrada, `quemEnviou` não muda mais)
Índice e paginação: ok (`quemEnviou` é coberto por `tentativa_atividade_uma_por_aluno (escola, ano, aplicação, aluno)`; o `exists` do convocado, pela chave única `convocado_da_segunda_chamada_um_por_aluno (escola, aplicação, aluno)`; o `inArray` é limitado pelo contrato. Nenhuma listagem nova)
Degradação de IA: não se aplica
Migration: não se aplica (a tarefa não tem migration; o esquema veio da 1.0)
Métrica e alerta: ok (a rota nova é da professora, fora do caminho quente, e é medida pelo interceptor global de HTTP; nenhum alerta novo)
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:725`: o `or(isNull(segundaChamadaDe), exists(...))` entrou no alcance de toda rota do aluno, inclusive o PUT da resposta, que tem p95 < 500 ms como meta. Rodar `npm run carga:prova` uma vez para confirmar que o p95 do fluxo normal não mudou. Anexar também o `EXPLAIN` da consulta de `prova` e do PUT com o alcance novo, que as retros da 5.0 e da 6.0 pediram para toda consulta nova.
- `tasks/prd-avaliacao-e-correcao/9_task.md:83`: o texto remete a "ver Recomendações" para o `EXPLAIN`, mas a tabela "Recomendações sem aplicar" (linha 470) está vazia. Preencher a tabela ou tirar a remissão.
- Não rodei os testes de integração. A verificação de que `segunda-chamada.int.test.ts` passa fica com o `test-engineer` e a esteira.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 01:21:03 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

A tarefa 9.0 cria a segunda chamada sem campo pessoal novo e sem buraco de exposição. Rodei `segunda-chamada.int.test.ts` (17 casos) e `acoes.test.ts` (46 casos), e os dois passaram.

Campos pessoais tocados: `convocado_da_segunda_chamada.aluno_id`, que é escrito pela primeira vez por `saveConvocados`. A tabela já existia desde a 1.0. Também `tempo_adicional`, por uma função que já existia (`saveTempoAdicional`), e `atividade_aplicada.segunda_chamada_de`, que liga a aplicação nova à original e não é dado de pessoa. A tarefa não cria coluna nem migration.

Fora da tabela de dados do docs/lgpd.md: nada. A linha 59 do `docs/lgpd.md` já cobre "os convocados da segunda chamada", com finalidade ("reabrir para quem faltou"), base legal e retenção, que é a do trabalho do aluno e sai com a eliminação. Nenhum campo proibido para aluno entra. O tempo adicional continua guardado como percentual, que é a adaptação, nunca o diagnóstico.

Autorização por objeto: ok.
- **Professora:** `originalDaSegundaChamada` usa `#noAlcance()` (escola, ano, turma e disciplina dela). A professora de outra escola, de outra turma, de outra disciplina, com vínculo encerrado ou sem ano em curso recebe o mesmo `NAO_ENCONTRADO` do id que não existe, e nada é gravado. Os testes "quem não é a professora daquela turma", "a escola sem ano em curso" e "nos repositories" provam isso.
- **Aluno convocado:** o aluno de outra turma, de outra escola, o inexistente, o pendente, o desativado e o transferido recebem todos o mesmo `ENTRADA_INVALIDA`. Nenhum confirma que outro existe.
- **Aluno não convocado:** `#daMinhaTurma` (`minha-atividade.repository.ts:137`) é o alcance de toda rota do aluno: lista, prova, tempo, resposta, começar e diagnóstico. A saída da aba só se grava em cima de tentativa do próprio aluno. Com isso, o colega não convocado recebe `NAO_ENCONTRADO` dentro e fora da janela, e nunca `PROVA_FORA_DA_JANELA`, o que confirmaria que a prova existe. O caso "o não convocado não vê na lista" prova isso.
- **Matriz de permissão:** coordenação, rede e aluno ficam em `nunca` para `segunda_chamada`.

DTO de saída: explícito. A resposta passa por `paraATela` e por `atividadeAplicadaResponseSchema.parse`, só com contagens. Nenhum convocado nem percentual sai na resposta.

Logs: limpos. O código novo não tem nenhum logger.

Auditoria: presente. A ação `atividade.segunda_chamada_aplicada` é gravada na mesma transação. O esquema é `strictObject` e leva só a original, a turma e as contagens (`convocados` com mínimo de 1, `comTempoAdicional`). Os ids dos alunos e o percentual são recusados pelo esquema, e `acoes.test.ts` prova isso. Quando a chamada é recusada ou bate em `CONFLITO`, nada fica na auditoria.

Envio externo: nenhum. A tarefa não chama IA nem provedor de terceiro.

Seed/fixture: sintético. A fixture só ganhou a rota `segundaChamada`, e os alunos do teste são inventados (Ana, Bia, Caio, Dani, Edu, Fabi) com UUIDs aleatórios.

Ciclo de vida: o convocado é apagado junto com o aluno (`onDelete('cascade')` na FK com `usuario`). A tabela já está no expurgo por escola (`expurgo-da-escola.repository.ts`) e no arquivo do titular (`leitura-do-titular.ts:348`).

Pergunta de fechamento: o código responde. A segunda chamada de que o aluno foi convocado sai no arquivo do titular, pela linha de `convocado_da_segunda_chamada`. O tempo adicional dele sai por `tempo_adicional`, e a tarefa não envia nada para fora.

Bloqueantes: nenhum.

Recomendações:
1. A linha 59 do `docs/lgpd.md` diz que os convocados ficam guardados "cada um com quem concedeu e quando". A linha de `convocado_da_segunda_chamada` não tem autor nem data: os dois só existem na aplicação (`aplicada_por`, `aplicada_em`) e no autor da auditoria. Ajustar o texto do mapa de dados para dizer onde estão o "quem" e o "quando", sem criar coluna (o arquivo do titular sai sem o autor, pela D85).
2. A auditoria nova não tem o id do aluno, de propósito, então ela não aparece no arquivo do titular. Isso é coerente com a regra 20, item 3, e o ato continua chegando ao titular pela linha do convocado. Vale registrar esse motivo na AIA ou no dossiê, para a pergunta "que atos houve sobre este aluno".

Arquivos auditados:
- apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
- packages/core/src/auditoria/acoes.ts
- apps/api/src/atividade/segunda-chamada.int.test.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-28 01:21:31 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no §5.9. O caso "aluno que já enviou uma segunda chamada da mesma original" não está decidido em lugar nenhum, e o código o resolveu sozinho.
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)

Bloqueantes:

1. **O aluno pode refazer a prova.** O problema está em `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts`, na linha `const jaEnviaram = await aplicacoes.quemEnviou(original.id, convocados)`, e em `atividade-aplicada.repository.ts`, no `quemEnviou`, que filtra por `eq(tentativaAtividade.atividadeAplicadaId, originalId)`.
   - O que acontece: só conta como envio a tentativa da original. O índice parcial deixa abrir outra segunda chamada depois que a anterior é encerrada, e o próprio teste prova isso em `segunda-chamada.int.test.ts:343-353` ("encerrada a primeira, outra se abre").
   - A sequência:
     1. Dani é convocada na segunda chamada nº 1, faz a prova e envia.
     2. A professora encerra essa segunda chamada.
     3. A professora abre a nº 2 com a Dani de novo, e o pedido passa.
   - A consequência: a Dani faz a mesma prova uma terceira vez e fica com duas correções da mesma prova em dois lotes. As duas entram no `historicoAprovado` e no diagnóstico por habilidade.
   - Por que é bloqueante: o RF10 do PRD diz "reabre a prova para quem não a enviou", e quem enviou a segunda chamada enviou a prova. Nem a Tech Spec §5.9, nem o `cenarios.md` §1 RF10, nem a tabela de divergências da 9_task tratam desse caso. O caso de teste mais próximo (linha 179) cobre a segunda chamada de **outra** prova, não a da mesma original.
   - Correção exigida:
     - O `quemEnviou` passa a considerar a tentativa com `enviada_em` da original **e** a de toda aplicação com `segunda_chamada_de = original.id`, no mesmo escopo de escola e ano.
     - Entra um caso no `segunda-chamada.int.test.ts`: Dani envia a nº 1, a nº 1 é encerrada, e a nº 2 com a Dani responde `ENTRADA_INVALIDA` sem gravar nada. Bia, que não enviou, passa.
     - Entra o bloco de mutação do termo novo.
     - A regra vai para a `techspec.md` §5.9 e para o `cenarios.md` §1 RF10.
     - Se o produto decidir que refazer é permitido, essa decisão vai escrita na Tech Spec e nos cenários, com o efeito no diagnóstico. Do jeito que está, sem decisão, não fica.

Recomendações:

- **Acompanhamento da segunda chamada.** Pela §4, `GET …/:id/acompanhamento` lista os alunos da turma inteira. Numa segunda chamada, quem não foi convocado aparece como `nao_comecou`. A 9.0 não mexeu nisso e a tarefa não pede. Vale registrar para a 11.0 (a tela da professora), que vai mostrar essa lista, e definir se ela deve conter só os convocados.
- **Ordem das conferências no `SegundaChamadaService.aplicar`.** O artefato é travado (`for update`) antes de conferir `estado`, `avaliativa` e `segundaChamadaDe` da original, que já foram lidos sem trava. Conferir a original logo depois do `originalDaSegundaChamada` evita travar o artefato num pedido que vai ser recusado, e mantém a ordem das travas do aplicar no caminho que segue.
- **Tabela "Recomendações sem aplicar" da 9_task.md.** A autoconferência (item 12) remete a ela ("ver 'Recomendações'"), e ela está vazia. Preencher com as recomendações da 5.0 e da 6.0, ou tirar a remissão.

Arquivos envolvidos:
- `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts`
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
- `apps/api/src/atividade/segunda-chamada.int.test.ts`
- `tasks/prd-avaliacao-e-correcao/techspec.md`
- `tasks/prd-avaliacao-e-correcao/cenarios.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-28 01:22:18 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- **Caminho feliz:** a professora reabre a prova encerrada. O convocado vê a segunda chamada, começa, responde, sai da aba e envia. O lote da segunda chamada é próprio e o da original, mesmo aprovado, não muda.
- **Casos de borda:**
  - a original aberta, a que não é avaliativa e a segunda chamada de uma segunda chamada;
  - janela de 50 min com duração de 40 e um convocado com +50% (o limite exato de 60 min passa);
  - quem enviou, e quem venceu sem enviar (gravado como `envio: 'limite'`);
  - quem a professora cortou e quem faltou continuam convocáveis;
  - Dani enviou a segunda chamada de outra prova;
  - convocado transferido antes de começar;
  - convocado de outra turma, de outra escola, inexistente, pendente ou desativado;
  - o artefato que deixou de ser objetiva e a versão adaptada sem a entrega aprovada;
  - id em maiúsculas;
  - escola sem ano em curso.
- **Permissão:** professora da B, colega sem vínculo, outra disciplina, vínculo pendente, vínculo encerrado na turma X, coordenação e aluno. O aluno não convocado recebe `NAO_ENCONTRADO` em todas as rotas, dentro e fora da janela.
- **Isolamento:** nos dois repositories, com a escola trocada, o ano trocado e a escola da B com a professora da A, e o colega não convocado no repository do aluno.
- **Concorrência:** duas segundas chamadas ao mesmo tempo, a corrida (h).

Cobertos: todas as 13 linhas da tabela de testes têm o seu caso no `segunda-chamada.int.test.ts`, com o nome citado. O esquema da auditoria está em `acoes.test.ts › avaliacao-e-correcao 9.0`.
- A corrida é paralela de verdade. O `WriteBlockTrigger` para o `insert` da primeira, a segunda fica esperando na trava `for update` do artefato (o `esperarNaTrava` filtra `wait_event_type = 'Lock'`), e o resultado é um 201, um `CONFLITO` e nada gravado da segunda.
- As asserções olham o resultado: as linhas gravadas por SQL, a `duracaoMin` de 60 e de 40, o embaralhamento herdado, o lote e as correções da original iguais antes e depois. As ausências são lidas depois da resposta que poderia trazer o que elas negam.
- Não há `.skip`, teste comentado nem mock. A tarefa não tem IA.
- Conferi os 38 blocos contra o `git diff`. Cada um tem um cenário que chega à cláusula, inclusive os termos do `quemEnviou` (Dani na outra prova, Bia cortada, Caio vencido) e os do `exists` do aluno (Edu convocado de outra segunda chamada). Os 7 motivos sem bloco se sustentam.
- O que rodei:
  - `segunda-chamada.int.test.ts`: 17 de 17 verdes;
  - `atividade.int.test.ts` com `prova-online-aluno.int.test.ts`: 64 de 64 verdes.

Bloqueantes:
1. `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts:87`: a chamada `conferirArtefatoParaAplicar(alvo)` dentro do `aplicar` é uma linha nova de produção sem bloco de mutação, e também não está na lista "Sem bloco, com motivo".
   - **O que está errado:** os blocos da seção "Mutações" mutam o corpo da função e a chamada dela no `segunda-chamada.service.ts`, mas nenhum tira a chamada do `aplicar`. Hoje dá para apagar a linha 87, e com ela as duas recusas do aplicar (só objetiva, e a versão adaptada só aprovada), com o portão desta tarefa verde. O `atividade.int.test.ts`, que pegaria isso, não foi alterado nesta tarefa, então o portão não o roda: só a esteira veria, uma tarefa depois.
   - **Correção exigida:** um bloco ```` ```mutacao ```` que tire a linha 87 do `atividade-aplicada.service.ts`, com o teste `apps/api/src/atividade/atividade.int.test.ts › só atividade objetiva se aplica`. O caso já existe e está verde, e o bloco faz o portão rodá-lo.

Recomendações:
- O caso de borda "professor que dá duas disciplinas na mesma turma" não foi provado. Falta a professora com Química e Física no 2ºB tentar reabrir pela disciplina errada. A lista de sessões em `segunda-chamada.int.test.ts:392` tem um professor de outra disciplina (`a.deFisica`), mas não uma mesma pessoa com as duas.
- Falta um caso do aluno que entrou na turma depois da original: sem tentativa e convocável, pela regra "turma atual".
- `segunda-chamada.int.test.ts:457`: `toBeTruthy()` sobre a leitura do convocado é uma asserção fraca. Seria melhor conferir o id lido, por exemplo `toMatchObject({ id })`, ou o comprimento 1 na lista.
- `9_task.md`, item 12 da Autoconferência: diz "ver 'Recomendações'", mas a tabela "Recomendações sem aplicar" está vazia.
- `9_task.md`: o primeiro bloco (o `segundaChamadaDe: null` no `create`) está sob o título "O alcance da segunda chamada (a professora)". Ele pertence a "O que a segunda chamada grava".

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 01:41:50 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A regra nova está na `techspec.md` §5.9 e no `cenarios.md` §1 RF10, com a mesma redação do `9_task.md`.

Portão local: carimbo válido. O `conferir` deu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

A correção que pedi na 1ª rodada foi feita:
- **`quemEnviou`** (`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`): agora junta a tentativa com `atividade_aplicada`, pela escola e pelo id, e filtra com `or(id = original, segunda_chamada_de = original)`. A escola e o ano continuam vindo do contexto, pela tentativa.
- **Caso novo** em `apps/api/src/atividade/segunda-chamada.int.test.ts` ("quem enviou uma segunda chamada, já encerrada…"):
  - A Dani envia a nº 1, a nº 1 é encerrada, e a nº 2 com a Dani responde `ENTRADA_INVALIDA`, sozinha e junto com a Bia.
  - As segundas chamadas, os convocados e as auditorias ficam iguais aos de antes do pedido.
  - A Bia sozinha recebe 201. Esse 201 prova que o corpo do pedido é válido, então o `ENTRADA_INVALIDA` anterior vem mesmo do termo novo.
- **Mutações:** há o bloco do termo `segundaChamadaDe` contra o caso novo, o bloco do termo da original contra "quem enviou e quem venceu sem enviar" e o bloco do id na junção. O termo da escola na junção ficou sem bloco, com motivo, e o motivo está certo: o id da aplicação é único e o `where` já prende a escola.
- **Recomendação da Mesa aplicada:** o serviço confere a original logo depois de `originalDaSegundaChamada`, antes de travar o artefato. Os blocos de mutação foram ajustados à nova ordem.
- **Asserções do lado do aluno:** antes conferiam só que havia resultado (`toBeTruthy`). Agora comparam com o valor esperado (`toEqual`), e a checagem do vazio ganhou o auxiliar `semNada`.

Recomendações:
- `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts:14`: o docblock ainda diz "que **não enviou** a original". Falta "nem nenhuma segunda chamada dela", como já dizem o docblock do `quemEnviou` e a §5.9. O item 7 da autoconferência afirma que esse docblock foi conferido, e não foi.
- O item 1 da autoconferência ainda fala em "os cinco termos do `quemEnviou`". A consulta agora tem a junção e o `or`, e os blocos estão certos; vale atualizar a contagem no texto.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-28 01:41:50 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. A junção nova do `quemEnviou` usa `tentativa_atividade` e `atividade_aplicada`, que já têm `escolaId`. `tentativa_atividade` tem também `anoLetivoId`. O texto da linha "Tempo da prova online" em `docs/lgpd.md` mudou, mas o schema não.

Queries verificadas:
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`, em `quemEnviou`:
  - A escola e o ano continuam vindo do contexto (`requireEscolaId()`, `requireAnoEmCurso()`) e são aplicados na tentativa.
  - O `innerJoin` exige a mesma escola e o mesmo id de aplicação.
  - O `or(id = originalId, segundaChamadaDe = originalId)` só alcança aplicações da escola do token.
  - O `originalId` vem da URL, mas antes passa por `originalDaSegundaChamada`, que tem escopo e vínculo.
  - A consulta não aceita `escolaId` do cliente.
- `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts`, na mudança de ordem: a conferência de `estado`, `avaliativa` e `segundaChamadaDe` agora vem antes da trava do artefato. Ela só roda depois do `NAO_ENCONTRADO` do alcance. Por isso o `ENTRADA_INVALIDA` nunca responde sobre aplicação fora do escopo e não confirma que um id de outra escola existe.

Teste de isolamento: presente e efetivo.
- O bloco do lado do aluno em `apps/api/src/atividade/segunda-chamada.int.test.ts` (por volta das linhas 463 a 478) ficou mais forte. Antes a asserção do convocado era `toBeTruthy`. Agora ela exige o resultado exato (`objectContaining({ id })`, o estado `aberta` e avaliativa, e a lista igual a `[id]`).
- Os três casos negativos (o colega, a escola trocada e o ano de ninguém) continuam passando por `semNada`.
- Sem a cláusula de escola ou de ano do `quemEnviou`, os blocos de mutação dele, que apontam para o caso `nos repositories`, continuam válidos com o contexto novo.

Bloqueantes: nenhum.

Recomendações:
- O docblock de `saveConvocados` em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` ainda diz "não enviou a original". Com a regra nova, o certo é "não enviou a prova (a original ou uma segunda chamada dela)".

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 01:41:56 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff mexe em quatro pontos e nenhum grava em `Nota`: a ordem das conferências da segunda chamada, o alcance de `quemEnviou`, os testes e os documentos. Todos com autor humano? sim, porque nenhum caminho novo existe e os da rodada aprovada não mudaram.

Decisão autônoma sobre aluno: ausente. A segunda chamada continua sendo aberta pela professora, com a lista de convocados escolhida por ela. A regra nova em `quemEnviou` só impede convocar de novo quem já enviou uma segunda chamada. Isso evita duas correções da mesma prova no diagnóstico e não decide nada sozinho sobre a trajetória do aluno. O caso de teste novo prova a recusa (`ENTRADA_INVALIDA`, sem gravar nada) e prova que quem foi convocado e não enviou continua convocável.

Aprovação registrada: ok. O lote da segunda chamada segue o caminho genérico por aplicação, como na 1ª rodada. A auditoria `atividade.segunda_chamada_aplicada` está mantida (`segunda-chamada.service.ts:49-52`). O caso da rotina da 6.0 sobre uma segunda chamada vencida foi levado ao `TODO.md`, como recomendado na 1ª rodada.

Supervisão do tutor: ok. O tutor está fora do diff, e a trava do convocado é da 7.0.

Autonomia declarada e visível: sim, sem mudança nesta rodada.

Bloqueantes: nenhum. A 1ª rodada não deixou correção exigida para conferir.

Recomendações:
- O docblock de `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts:14` ainda diz "que **não enviou** a original". Com a mudança em `quemEnviou` (`atividade-aplicada.repository.ts:390-407`), a regra passou a ser "não enviou a original nem nenhuma segunda chamada dela". A Tech Spec §5.9 e o docblock do repository já foram atualizados. Falta este, que é o mesmo comentário que o item 7 da autoconferência da tarefa diz ter conferido.
- A linha nova de `docs/lgpd.md` sobre os convocados está correta: o autor e a data ficam em `aplicada_por` e `aplicada_em` da aplicação e na auditoria. Fica registrado para a validação que o "quem abriu" de cada convocado se lê pela aplicação, e não pela linha do convocado.
- `docs/regulacao.md` não mudou nesta tarefa, e não precisava mudar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 01:42:12 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a rodada aprovada (`.processo/ordens/diff-9_task-r2.txt`) e o que ele afeta. A 1ª rodada não deixou nenhuma correção exigida para conferir.

**Campos pessoais tocados:** nenhum campo novo. A regra de "quem enviou" agora também olha a `tentativa_atividade` (`aluno_id`, `enviada_em`) das segundas chamadas da mesma original, além da tentativa da original. Isso fica em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:397-412`. A linha dos convocados em `docs/lgpd.md:129` foi corrigida para o que o schema guarda de fato. Conferi em `packages/core/src/db/schema/prova-online.ts:107-117`: a tabela tem só `escolaId`, `anoLetivoId`, `atividadeAplicadaId` e `alunoId`. O "quem abriu" e o "quando" ficam em `aplicada_por`, `aplicada_em` e na auditoria. Antes o mapa de dados dizia "com quem concedeu e quando", o que não batia com o schema.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- `segunda-chamada.service.ts`: a recusa por estado (`ENTRADA_INVALIDA`) subiu para antes da trava do artefato, mas continua depois do `NAO_ENCONTRADO` do alcance da professora (`originalDaSegundaChamada`). Quem não é a professora da turma e da disciplina recebe o mesmo `NAO_ENCONTRADO` de antes e não descobre o estado da original.
- `quemEnviou` junta `atividade_aplicada` por `escolaId` e `id`, e a consulta continua presa à escola e ao ano do contexto (`requireEscolaId`, `requireAnoEmCurso`).
- O convocado que já enviou uma segunda chamada recebe o mesmo `ENTRADA_INVALIDA` do aluno de outra turma, de outra escola ou inexistente. A recusa nova não revela nada que as outras não revelem.
- No teste do lado do aluno, as asserções de "quem não pode, não vê" passaram de "algo verdadeiro" para valor exato, e isso deixou o teste mais forte.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente. Os dados de `atividade.segunda_chamada_aplicada` não mudaram: só a original, a turma e as contagens, sem id de aluno nem tempo adicional por aluno. O caso novo prova que o pedido recusado não grava auditoria, convocado nem aplicação.

**Envio externo:** nenhum.

**Seed/fixture:** sintético (Bia, Dani e as escolas `a` e `b` da bancada).

**Bloqueantes:** nenhum.

**Recomendações (não bloqueiam):**
1. Dois docblocks em `apps/api/src/atividade/atividade-aplicada/` ainda dizem "não enviou a original" e não acompanham a regra nova ("da original ou de qualquer segunda chamada dela"):
   - `segunda-chamada.service.ts:14`, no item "Quem é convocado";
   - `atividade-aplicada.repository.ts:414`, no docblock de `saveConvocados`.

   Não há impacto de privacidade, só texto desatualizado. O item 7 da autoconferência da tarefa diz que os comentários foram conferidos contra o código, então vale acertar os dois.
2. A minha recomendação da 1ª rodada foi para o `TODO.md`: registrar na AIA da correção de objetiva por que a auditoria nova não leva o id do aluno. Ela segue aberta, com destino correto.

**Pergunta de fechamento:** o código responde. O ato chega ao titular pela linha dele em `convocado_da_segunda_chamada` e pela tentativa. Essa linha sai com a eliminação do aluno, como o teste do schema já provava, e nada foi enviado para fora.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 01:42:12 · `tasks/prd-avaliacao-e-correcao/9_task.md`

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
- **Corrida estreita no `quemEnviou`** (`apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts:35-36`). A conferência agora olha também as segundas chamadas da mesma original, mas a leitura não tem trava. Pode acontecer assim: a professora pede uma nova segunda chamada enquanto a anterior ainda está aberta e sendo encerrada. O `quemEnviou` lê antes de o encerramento gravar o `enviada_em` do aluno vencido. O `insert` espera no índice parcial `atividade_aplicada_segunda_chamada_aberta_unica` e passa quando o encerramento confirma. O resultado é o mesmo aluno convocado duas vezes. Só acontece com as duas ações da professora disparadas juntas, então fica como recomendação, não bloqueante. Se for tratar, há dois caminhos: travar com `for update` a segunda chamada aberta da original antes do `quemEnviou`, ou refazer o `quemEnviou` depois do `insert`. Junto, cabe um caso com `WriteBlockTrigger` no `update` do encerramento.
- O `quemEnviou` com junção e `or(id, segunda_chamada_de)` roda só quando a professora abre a segunda chamada. O índice `tentativa_atividade_aluno_idx (escola_id, aluno_id)` e a PK da aplicação cobrem a consulta. Não precisa de `EXPLAIN` aqui. Ele continua pendente no `TODO.md` só para a `prova` e o PUT, como já registrado.

A correção que a rodada anterior pediu foi feita. A original agora é conferida antes de o artefato ser travado (`for update`), então o pedido recusado não trava o artefato. O caso que faltava, de quem enviou uma segunda chamada já encerrada, ganhou teste e bloco de mutação. As asserções do lado do aluno agora comparam o valor esperado, e não apenas que veio algo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 01:42:47 · `tasks/prd-avaliacao-e-correcao/9_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada: o diff desde a 1ª e as correções exigidas):
- O bloco de mutação de `conferirArtefatoParaAplicar(alvo)` no `aplicar`, que era o bloqueante da 1ª rodada.
- O termo novo do `quemEnviou`: quem enviou uma segunda chamada já encerrada não é convocado de novo, e quem foi convocado e não enviou continua convocável.
- A conferência da original passou para antes da trava do artefato.
- A leitura do convocado agora se prova pelo id, e não por `toBeTruthy()`.
- O bloco do `segundaChamadaDe` foi para "O que a segunda chamada grava".

Cobertos:
- **Correção 1, feita.** O bloco está em `tasks/prd-avaliacao-e-correcao/9_task.md`, na seção "Mutações" (o que entrou nas linhas 239 a 245 do arquivo de diff). Ele tira a linha 87 de `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`, e o contexto bate com o arquivo (linhas 86 e 88). O teste é `apps/api/src/atividade/atividade.int.test.ts › só atividade objetiva se aplica`. Sem a linha, o plano de aula deixa de dar 400 `ENTRADA_INVALIDA`, então o caso fica vermelho na asserção da linha 94. A tabela de testes cita o caso do aplicar na linha "Artefato que não é objetiva; versão adaptada não aprovada".
- **O `quemEnviou` novo.** O `or` tem um bloco para cada termo, e o `innerJoin` também:
  - Sem o termo `segundaChamadaDe`, o caso novo `quem enviou uma segunda chamada, já encerrada` fica vermelho já no primeiro `ENTRADA_INVALIDA` da Dani.
  - Sem o termo `id`, a Ana, que enviou a original, passa a ser convocável e o caso `quem enviou e quem venceu sem enviar` cai na linha 190.
  - Sem o id na junção, a tentativa da Dani na segunda chamada de outra prova se junta com todas as aplicações da escola, e a linha 198 deixa de dar 201.
  - O termo da escola da junção tem motivo escrito em "Sem bloco".
  - O `--faltando` não aponta nenhuma linha nova com condição sem bloco.
- **O caso novo olha o resultado.** Confere as contagens de segundas chamadas, convocados e auditorias antes e depois das duas recusas, inclusive o pedido "todos ou nenhum" com [Bia, Dani]. O 201 final da Bia prova que o caminho continua aberto, então a recusa vem do termo novo e não de outra checagem. O caso está na tabela de testes, no `cenarios.md` RF10 e na `techspec.md` §5.9.
- **A conferência movida.** Os quatro blocos de `estado`, `avaliativa`, `segunda_chamada_de` e artefato foram reescritos com o contexto novo.
- **O isolamento do lado do aluno.** O convocado agora é conferido por `toEqual` com o id, ou com `estado` e `avaliativa` na leitura sem trava. O vazio dos outros três contextos usa `semNada`.
- **Rodei os dois arquivos, e os dois passam:** `segunda-chamada.int.test.ts` com 18 casos e `atividade.int.test.ts` com 39. Não há `.skip` nem mock no caminho testado.

Bloqueantes: nenhum.

Recomendações:
- A frase nova de `segunda-chamada.service.ts:59` ("o pedido que vai ser recusado não trava nada") não tem caso que a prove. Voltar a ordem antiga deixaria toda a suíte verde. A promessa só vale com um teste de espera na trava do artefato, como o `esperarNaTrava` da corrida (h); sem ele, o comentário deveria dizer só a ordem.
- Na leitura do convocado, `'a leitura sem trava'` confere `estado` e `avaliativa`, mas não o id. Dá para juntar o `id`, se a leitura o devolver, para ficar igual às outras duas.
- As recomendações que ficaram no `TODO.md` estão registradas para a validação: a da rotina da 6.0 sobre a segunda chamada vencida, a da professora com duas disciplinas e a do aluno que entrou na turma depois da original.

Arquivos que olhei:
- tasks/prd-avaliacao-e-correcao/9_task.md
- apps/api/src/atividade/segunda-chamada.int.test.ts
- apps/api/src/atividade/atividade.int.test.ts
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
