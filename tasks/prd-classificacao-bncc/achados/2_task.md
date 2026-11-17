# Achados das revisões — `tasks/prd-classificacao-bncc/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 14:27:32 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `secao_do_material` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0060_secao_do_material.sql`). Tem `escola_id`, e o id é UUID (`uuidv7()`). Toda FK composta leva a escola: para o material, o capítulo, a execução e o usuário. Tem `unique (escola_id, id)`, e os três índices começam pela escola.
- `habilidade_da_secao`. Tem `escola_id`, chave `(escola_id, secao_id, codigo)` e FK composta para a seção.
- `capitulo_do_material` ganhou `unique (escola_id, id)`.
- As duas tabelas novas não têm `anoLetivoId`, o que é coerente: o material não muda por ano letivo (F4 §6).
- As duas estão em `TABELAS_DO_NUCLEO`, na classificação e no arquivo do titular.

Queries verificadas:
- `ExtracaoDoMaterialRepository.gravarCapitulos`, `gravarSecoes` e `herdarClassificacao`: a escola vem sempre de `requireEscolaId()`, do contexto, e nunca de parâmetro. As duas leituras da herança filtram `secao_do_material.escola_id`, e o `update` e o `insert` repetem a escola. `antigaId` vem de `material.substituiId`, lido já dentro do escopo.
- Backfill `0061_secao_do_material_backfill.sql`: escola tirada do próprio material e do capítulo, com a junção pela escola.
- `LEITURAS_DO_ARQUIVO.secao_do_material`: filtra `t.escola_id = ${escolaId} and t.corrigida_por = ${titularId}`, e `corrigida_por` fica em `fora`.
- Nenhum endpoint novo, nenhum `escolaId` vindo do cliente e nenhum `@Unscoped()` novo.
- Os guardas `repositories-com-escopo.test.ts` e `architecture.test.ts` e os testes de unidade `secoes.test.ts` e `leitura-do-titular.test.ts` passaram: 151 de 151.

Teste de isolamento: presente e efetivo.
- `apps/api/test/material-edicao.int.test.ts`, caso "a correção da B não é herdada pela A". Se a escola sai da leitura das corrigidas, o caso quebra: os pares se formam e `herdarClassificacao` devolve 1, contra o `toBe(0)` esperado.
- Caso "a seção da B, com a anterior da A": quebra da mesma forma se a escola sai da leitura das seções da edição nova.
- Caso de controle "a mesma chamada, no contexto da B": prova que o repository herda de fato e não passa por nunca herdar nada.
- `apps/worker/test/extrair-pdf.int.test.ts`: `gravarSecoes` com o material da B no contexto da A é recusado pela FK composta, e a seção da A não consegue apontar o capítulo nem o material da B.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/material/extracao.repository.ts`, no fim de `herdarClassificacao`: a função devolve `pares.length`, e não o número de linhas que o `update` alterou de fato. Hoje dá no mesmo. Mas se as cláusulas de escola repetidas no `update` e no `insert` um dia divergirem das leituras, a contagem e o `material.classificacao_herdada` gravado na auditoria passam a afirmar uma herança que não aconteceu. Melhor devolver o `rowCount` do `update`.
- As cláusulas `escola_id` repetidas no `update` e no `insert` da herança ficam sem teste que as prove sozinhas. O motivo está registrado em "Sem mutação que um teste veja" e é aceitável como defesa em profundidade. Fica registrado para a retro.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 14:27:50 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não toca `Nota`, correção, lote nem entrega; o diff não tem `nota`, `lancadaPor` nem nada de aprovar. Todos com autor humano? Sim, nada mudou nos caminhos que já existem.

Decisão autônoma sobre aluno: ausente. A seção e a habilidade dela descrevem o material da escola, não o aluno. Pela §7b da techspec, a habilidade só chega ao aluno pela atividade que o professor conferiu e aprovou.

Aprovação registrada: ok.
- Nesta tarefa a IA ainda não classifica nada. A seção nasce sem execução (`execucao_id` nulo) e o agendamento fica para a 5.0.
- A herança entre edições não aprova nada: só copia `corrigida_em` e as habilidades de uma correção feita por uma pessoa, sem `corrigida_por`.
- A auditoria registra a herança com `material.classificacao_herdada`, assinada pela `rotina`, e leva `herdadoDe`. Com isso a cadeia de "quem corrigiu e quando" chega até `material.classificacao_corrigida` na anterior (7.0).
- O check `auditoria_rotina_so_nas_acoes` (`packages/core/drizzle/0060_secao_do_material.sql:55`, espelhado em `packages/core/src/db/schema/auditoria.ts`) ganhou só essa ação. Ele continua fora de aprovação, rejeição e validação de lote, e `packages/core/src/auditoria/auditoria.int.test.ts` cobre a ação nova entre as aceitas.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, nesta etapa. A função `classificacao_do_material` (autonomia 1, alto risco, suspensível, com `fazSozinha` e `esperaAprovacao` em português comum) e a revisão da AIA estão na 3.0, antes de qualquer execução. Esta tarefa não liga a IA.

Itens 7, 8 e 9: nada nesta tarefa. Não há inferência emocional, nota sugerida em discursiva ou redação, nem indicador de professor. O único dado pessoal novo é `corrigida_por`. Ele está em `fora` no arquivo do titular, entra na classificação e em `docs/lgpd.md`, e vira nulo quando a pessoa é eliminada.

Bloqueantes: nenhum.

Recomendações:
1. A herança põe na edição nova habilidades com `origem: 'coordenacao'` (`packages/core/src/material/extracao.repository.ts:152`) e `corrigida_em`, em conteúdo que nenhuma pessoa leu naquela edição. Hoje só a auditoria mostra que foi herança. Na 7.0, a leitura da classificação deveria dizer "herdada da edição anterior" (por exemplo, juntando `material.classificacao_herdada`). Assim a coordenação não toma por correção dela o que a rotina carregou.
2. Na 3.0, o `fazSozinha` de `classificacao_do_material` deveria dizer em português comum que a correção de um capítulo passa sozinha para a edição nova quando o número e o título são iguais. É uma ação automática (`apps/worker/src/processors/extrair-pdf.ts:49`), e a escola precisa poder apontá-la numa tela (regra 70, item 5).
3. A revisão da AIA `docs/aia/diagnostico-por-habilidade.md` (3.0) deveria registrar a herança entre edições como risco: capítulo com o mesmo número e título e conteúdo trocado. Junto, o caminho de contestação, que é a correção da seção.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/extracao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/extrair-pdf.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0060_secao_do_material.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0061_secao_do_material_backfill.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/schema/auditoria.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md (§7b)

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 14:28:05 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: `secao_do_material.corrigida_por` é o único campo novo de pessoa: a coordenação que corrigiu a classificação. `habilidade_da_secao` tem só códigos da tabela pública da BNCC e a origem (`ia` ou `coordenacao`), sem pessoa. O título do capítulo já existia, sem pessoa (`SEM_PESSOA`, da F4). A herança só o compara em memória e não o grava em lugar nenhum novo. Nenhum campo de aluno foi tocado.

Fora da tabela de dados do docs/lgpd.md: nenhum. A linha do material em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md:79` agora traz as seções, `corrigida_por` e o que acontece com ele na eliminação (vira nulo e `corrigida_em` fica), a retenção (sai em cascata com o material, categoria `material_excluido`), a nova ação de auditoria e o arquivo do titular.

Autorização por objeto: ok. A tarefa não cria rota nenhuma; a leitura na API fica para a 7.0. No repository, `herdarClassificacao` e `gravarSecoes` usam a `escola_id` do contexto (`extracao.repository.ts:302-358`). Os testes cobrem o caso da escola B no contexto da A, e a mesma chamada no contexto da B acha a correção dela. As FKs compostas impedem que a seção da A aponte material ou capítulo da B.

Logs: limpos. `extrair-pdf.ts:67` registra só o id do material e contagens (`secoesTotal`, `secoesHerdadasTotal`). Há teste com os títulos dos capítulos como sentinelas (`extrair-pdf.int.test.ts` › "o log da extração leva só ids e contagens…").

Auditoria: presente.
- A ação `material.classificacao_herdada` (`acoes.ts:121`) usa um schema estrito só com `herdadoDe` (um uuid) e `secoes` (inteiro positivo), e tem como autor a `rotina`.
- O check `auditoria_rotina_so_nas_acoes` foi ampliado na migration `0060` e no schema TypeScript.
- O teste confirma que a auditoria não leva título de capítulo nem código de habilidade (`material-edicao.int.test.ts:843-858`).
- A correção humana original vai para a auditoria quando a 7.0 a criar (`material.classificacao_corrigida`), o que está fora desta tarefa.

Envio externo: nenhum. A tarefa não chama IA; as seções nascem `nao_agendada`, com `execucao_id` nulo.

Seed/fixture: sintético. São nomes genéricos ("Coordenação", "Outra", "Colega") e e-mails `@lida.invalid`, e os capítulos têm títulos de química.

Arquivo do titular e eliminação:
- `secao_do_material` entra no arquivo de quem corrigiu (`leitura-do-titular.ts:403-418`), com `corrigida_por`, execução, falhas e capítulo em `fora`.
- O teste de integração confirma que entram só as seções do próprio titular: as do colega, as sem correção e as de outra escola ficam de fora (`arquivo-do-titular.int.test.ts:731-765`).
- Na eliminação, `corrigida_por` vira nulo pela regra `on delete set null ("corrigida_por")`. Conferi que a eliminação apaga a linha de `usuario` de fato (`ciclo-de-vida.repository.ts:400`), então essa regra é disparada.
- A classificação em `classificacao.ts` está coerente.
- Rodei os testes unitários do arquivo do titular, das seções e da classificação: 57 de 57 passaram.

Pergunta de fechamento: o código responde. O que o sistema guarda sobre a coordenadora que corrigiu sai no arquivo dela. A seção herdada não leva autor. Nenhum dado de aluno entrou ou saiu nesta tarefa.

Bloqueantes: nenhum.

Recomendações:
- O teste `migracao-f4b.int.test.ts:301` apaga o usuário direto com `delete from usuario`. Seria bom ter um caso que passe pelo `CicloDeVidaService.eliminar` (o caminho do job `titular.eliminar`), para pegar uma eventual mudança futura na eliminação (por exemplo, anonimizar o usuário em vez de apagar a linha).
- O texto de `fora.corrigida_por` diz "o próprio titular". A seção herdada nasce com `corrigida_em` e sem autor, então não entra no arquivo de ninguém. Isso está certo e documentado em `docs/modelo-de-dados.md`. Vale uma frase também em `docs/lgpd.md` para quem atender o pedido do titular não procurar a seção herdada no arquivo da coordenadora original.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-17 14:28:36 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `tasks/prd-classificacao-bncc/cenarios.md`. Duas das três divergências registradas estão na `techspec.md`, mas não estão no `cenarios.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:
- **Duas divergências estão na `techspec.md` e faltam no `cenarios.md`.** Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/2_task.md:105-106` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md`.
  - **As duas que faltam:** `secao_do_material.execucao_id` com `on delete set null ("execucao_id")`, que faz as FKs para `execucao_agente` passarem de sete a oito, e o check `secao_do_material_corrigida_por_so_na_corrigida`.
  - **O que a busca mostra:** no `cenarios.md` não aparece "set null", nem "oito", nem o check. Só a terceira divergência, a do capítulo sem número, chegou lá (linhas 67-70).
  - **Por que bloqueia:** o `executar-task` (SKILL.md:47-49 e :292-295) exige a divergência na `techspec.md` e no `cenarios.md` antes dos revisores.
  - **O documento diz o contrário:** a autoconferência, item 8 (`2_task.md:95`), afirma que "a da FK da execução … entraram na `techspec.md` §3 e §5 e no `cenarios.md`". Isso não é verdade.
  - **Correção exigida:**
    - Em "Seções e agendamento", ou na seção do expurgo, acrescentar o `[I]` "a execução expurgada anula só o `execucao_id` da seção, sem anular a escola; o expurgo não trava".
    - Ainda no `cenarios.md`, acrescentar o `[I]` "`corrigida_por` sem `corrigida_em` é recusado pelo check", junto da linha 107.
    - Nos dois itens, citar a mutação que já está no documento.
    - Corrigir o item 8 da autoconferência e a coluna "Onde está na spec" das linhas 105-106, que hoje não citam o `cenarios.md`.

Recomendações:
- **Material que fica pronto entre a migration e o código novo:** se ele fica `pronto` pelo código anterior depois da `0061` (worker velho de pé durante o deploy), nunca ganha seção. A rotina das 19h (5.0) só agenda seção que já existe. Vale levar ao `infra-guardian` e ao runbook: parar os workers antes do `migrar`, ou rodar a `0061` de novo depois do deploy, já que ela é idempotente.
- **Texto de tarefa em documento permanente:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/modelo-de-dados.md:33` diz "Esta tarefa não agenda nada: as seções nascem `nao_agendada`". Isso caduca na 5.0. Trocar por "a seção nasce sem execução (`nao_agendada`); quem agenda é a rotina".
- **Arquivo fora do plano:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/guardas/tabelas-do-nucleo.mjs` foi alterado, mas não está na lista de arquivos do plano. A mudança é correta (é a guarda que cobra as tabelas novas); só falta citá-la ali.
- **Teste previsto e não alterado:** a tabela "Arquivos previstos" lista `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` como alterado, e ele não mudou. Se o teste de catálogo passa sem mudança, tirar a linha da tabela ou dizer que só foi rodado. A prova é do `test-engineer`.
- **Ordenação dos capítulos:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/extracao.repository.ts`, `gravarCapitulos` reordena o retorno do `returning` com `sort`. Funciona, mas `planejarSecoes` já recebe os capítulos na ordem. Um comentário de uma linha dizendo que o Postgres não garante a ordem do `returning` evitaria que alguém tire o `sort` achando que é código morto.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-17 14:29:04 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: migration, fila (a extração no `worker-pdf`, que roda na fila de lote)
Rate limit: ok (a tarefa não cria rota)
Fila e prioridade: ok (as seções são gravadas dentro da transação da extração, que já roda na fila de lote; a tarefa não cria job novo)
Concorrência: protegida (a seção só é gravada depois que um único `marcarPronto` consegue a transição; o `unique (escola_id, material_id, ordem)` recusa a ordem repetida; o backfill não duplica, pelo `NOT EXISTS` mais o `unique`, e há teste `[P]` com dois jobs)
Índice e paginação: ok (os três índices começam por `escola_id`; as consultas da herança usam o prefixo `(escola_id, material_id)`; a tarefa não tem listagem)
Degradação de IA: não se aplica
Migration: bloqueante
Métrica e alerta: ok (a extração já tem histograma e resultado; o log ganhou as contagens das seções, só com ids e números; a tarefa não cria alerta)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0061_secao_do_material_backfill.sql:13-40`, junto com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md` (falta uma seção depois da linha 1111).
  - **O que está errado:** o backfill roda uma vez só. Depois dele, nada no sistema cria seção para um material que fique `pronto` pelo código anterior. Se a versão do código voltar (a regra 80, item 9, exige que a volta seja um comando), o `worker-pdf` anterior extrai os PDFs normalmente e deixa cada material `pronto` com zero seções, para sempre.
  - **Por que é grave:** a rotina das 19h da 5.0 só agenda seção que já existe ("seção não corrigida… sem execução"). Esse material nunca é classificado, não herda correção na edição seguinte e não aparece como pendente em `secoesSemClassificacao`. A falha é silenciosa.
  - **Precedente:** a F4 resolveu o mesmo problema em "Voltar o código depois da F4", com o bloco 2 de roll-forward que repete a conta da `0055`. Esta tarefa não tem equivalente, e nenhuma tarefa da spec prevê um (`grep` por runbook, volta e roll-forward em `tasks/prd-classificacao-bncc/` não acha nada).
  - **Correção exigida:** escolher um dos dois caminhos.
    - (a) Seção nova no `docs/runbook.md` ("Voltar o código depois da classificacao-bncc 2.0"). Ela diz o que o código anterior faz com `secao_do_material`, `habilidade_da_secao` e a ação `material.classificacao_herdada` no check. Ela traz um bloco de roll-forward idempotente, que é o mesmo `INSERT … NOT EXISTS` da `0061`. E um teste de integração roda esse bloco sobre um material `pronto` sem seção e prova que a seção nasce, e que rodar duas vezes não duplica.
    - (b) Reparo automático: uma operação do repository, idempotente e escopada pela escola, que cria as seções do `pronto` não excluído que ainda não tem nenhuma. Ela é chamada pela rotina que agenda (5.0), e o cenário entra no `cenarios.md`, com teste.

    Nos dois caminhos, a conta precisa continuar igual à de `planejarSecoes`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0060_secao_do_material.sql:53-55`: o `migrar` roda tudo numa transação só. Por isso a trava `ACCESS EXCLUSIVE` que o `DROP`/`ADD CONSTRAINT` pega em `auditoria` continua de pé durante a varredura inteira do `VALIDATE`, e o padrão `NOT VALID` seguido de `VALIDATE` não alivia nada aqui. O check novo é mais frouxo que o anterior, então o `VALIDATE` não protege nada. Não bloqueia, porque segue o precedente da `0036`/`0056` e o deploy é fora do horário letivo. Mas o comentário deveria dizer o custo real, ou o `VALIDATE` deveria ir para uma migration separada quando `auditoria` crescer.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/titular/leitura-do-titular.ts:431-432`, e a FK `(escola_id, corrigida_por) on delete set null`: não há índice com `corrigida_por`. Com milhares de seções por escola, a leitura e a eliminação do titular varrem pelo prefixo da escola, o que é aceitável hoje. Vale um índice parcial `(escola_id, corrigida_por) where corrigida_por is not null` se a tabela crescer além disso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/extracao.repository.ts:354-395`: as seções corrigidas da anterior são lidas sem trava. Uma correção da coordenação gravada (7.0) ao mesmo tempo que a extração da edição nova fica fora da herança. Quando a 7.0 existir, vale registrar isso como cenário, ou ler a anterior `for share`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-17 14:29:55 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos**
- **Caminho feliz:** uma seção por capítulo, e um bloco a cada 10 páginas quando o PDF não tem capítulo (25 páginas dão 1–10, 11–20 e 21–25).
- **Bordas:**
  - as páginas antes do capítulo 1 ficam sem seção;
  - um material com 1, 10, 11 ou 20 páginas;
  - ordem duplicada;
  - código fora da `habilidade_bncc`;
  - material excluído durante a extração;
  - edição nova cujo capítulo casa só pelo número, só pelo título, ou não tem número;
  - edição anterior classificada só pela IA;
  - edição de PDF sem capítulo;
  - dois capítulos iguais na edição anterior;
  - correção com zero códigos;
  - coordenadora eliminada (`corrigida_por` fica nulo e `corrigida_em` fica);
  - execução expurgada.
- **Migration 2:** materiais `pronto` da A e da B; `excluido`, `processando` e `falhou` ficam fora; lote menor que o número de materiais; rodada repetida; material que a extração nova já tinha semeado.
- **Permissão e LGPD:** `corrigida_por` vai para `fora` no arquivo do titular, que só traz quem corrigiu; a auditoria é assinada pela `rotina` e não leva título nem código.
- **Isolamento:** as FKs compostas para material e capítulo; a herança da B lida no contexto da A; a seção da B gravada no contexto da A; `gravarSecoes` com material da B.
- **Concorrência:** dois jobs da mesma extração em `Promise.all` com barreira, e dois jobs da mesma edição.

**Cobertos:** todos. Cada linha da tabela "Testes que provam a regra" tem o caso citado pelo nome, e conferi que cada um existe. Rodei sete arquivos: `secoes.test.ts`, `leitura-do-titular.test.ts`, `migracao-f4b.int.test.ts`, `extrair-pdf.int.test.ts`, `material-edicao.int.test.ts`, `arquivo-do-titular.int.test.ts`, mais `mvp-tables.int.test.ts`, `expurgo-da-escola.int.test.ts` e `auditoria.int.test.ts`. Passaram todos: 33 de unidade e 438 de integração.

- **Mutações:** `mutacoes.ts --faltando` lista só as 8 linhas que já têm motivo escrito no documento. Os 60 blocos mutam cláusulas reais. Os casos de ausência vêm na mesma cena do positivo, por exemplo o `toHaveLength(3)` em "mesmo número com título diferente". O caso da B é vermelho por escopo, e o par "a mesma chamada, no contexto da B, acha a correção" prova que o repository herda de fato.
- **Concorrência de verdade:** os dois jobs da extração (`extrair-pdf.int.test.ts`) rodam em paralelo de verdade, com barreira em `aoLerBytes`. O backfill é sequencial, o que basta para migration.
- **Sem `.skip`, `.only`, `any` ou teste comentado** no diff nem nos arquivos novos. Nenhum mock esconde a regra: o extrator falso só substitui o PDF. Não há IA nesta tarefa.

**Bloqueantes:** nenhum.

**Recomendações**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/titular/leitura-do-titular.ts:432`: o termo `t.escola_id = ${escolaId}` está na mesma linha mutada pelo bloco de `corrigida_por`, mas nenhum teste o vê. A FK composta `(escola_id, corrigida_por)` já impede o vazamento. Pôr o motivo na lista "Sem mutação que um teste veja", como foi feito para a herança.
2. `apps/api/test/arquivo-do-titular.int.test.ts`: o caso diz que a seção "de outra escola não entra", mas passaria sem o filtro de escola, porque a seção da B é corrigida por um usuário da B. Ajustar o nome do caso, ou registrar que quem garante isso é a FK.
3. `material-edicao.int.test.ts`: falta um `[P]` de dois jobs da mesma edição com a anterior corrigida. A herança é protegida pelo mesmo `marcarPronto` que o `[P]` atual prova, mas uma herança em dobro estouraria a PK `habilidade_da_secao_pk`, e só um caso paralelo com herança mostraria isso diretamente.
4. `2_task.md`, seção "Como testar": a linha do backfill aponta `migracao-f4.int.test.ts` › "mais de um lote de 5.000…", que é o teste da F4. O desta tarefa é `migracao-f4b.int.test.ts` › "o lote menor que o número de materiais…".
5. `2_task.md`, "Arquivos previstos": `mvp-tables.int.test.ts` aparece como alterado, mas não mudou (passa sem alteração). Tirar da tabela ou marcar "só rodar".

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-17 15:11:46 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. O único dado de pessoa da tarefa continua sendo `secao_do_material.corrigida_por`, que já estava na tabela de dados e foi aprovado na 1ª rodada. O diff mexe em quatro coisas:
- **`capitulosDasSecoes`:** leitura nova no repository, extraída do que já existia, que devolve id da seção, número e título do capítulo. O título do capítulo é `SEM_PESSOA` e nenhuma rota o devolve.
- **Contagem da herança:** passou a vir do `rowCount` do `update`.
- **Bloco de SQL no runbook:** cria seções e não traz coluna de pessoa.
- **Frase nova no `docs/lgpd.md`:** a seção herdada não entra no arquivo de ninguém.

Fora da tabela de dados do docs/lgpd.md: nada. A frase pedida como recomendação na rodada anterior está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md:65`. Ela bate com o código: o arquivo do titular procura a seção por `corrigida_por` (`packages/core/src/titular/leitura-do-titular.ts:420-432`), e a seção herdada nasce sem `corrigida_por`.

Autorização por objeto: ok.
- **Repository:** `capitulosDasSecoes` (`packages/core/src/material/extracao.repository.ts:114-121`) pega `escolaId` de `requireEscolaId()` e não do argumento.
- **Teste do escopo:** `apps/api/test/material-edicao.int.test.ts:990-1001` lê, no contexto da escola A, o material da B, com e sem o filtro das corrigidas, e recebe vazio. No contexto da B, acha. Sem a cláusula de escopo o teste quebra, então ele prova o escopo de fato.
- **Arquivo do titular:** só o título do teste mudou, e as asserções continuam iguais. A seção de outra escola segue fora do arquivo (o teste ainda verifica que `deOutraEscola` não aparece).

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente. `material.classificacao_herdada` passa a gravar a contagem das linhas que o `update` alterou, e continua só com ids e número. O diff não traz ação nova que exija auditoria.

Envio externo: nenhum nesta tarefa. A seção nasce sem execução e a classificação pela IA fica para a 5.0. A pendência de registrar o envio em `ExecucaoAgente` na 6.0 já estava no `TODO.md` desde a 1.0.

Seed/fixture: sintético. `volta-da-2-0.int.test.ts` cria um banco próprio só para o teste, com "Rede da volta 2.0", "Escola A/B", "Material N" e "Capítulo N", e não cria usuário nem pessoa.

Bloqueantes: nenhum.

Recomendações:
- O cenário do `0061` e da volta da 2.0 continua em aberto no `TODO.md`: o material que ficar `pronto` pelo código anterior fica sem seção até alguém rodar o bloco do runbook à mão. Isso não é questão de LGPD, porque não cria nem expõe dado de pessoa. Registro só para a validação ver que o passo do plantão está escrito (`docs/runbook.md`, seção "Voltar o código depois da classificacao-bncc 2.0") e testado (`packages/core/src/db/volta-da-2-0.int.test.ts`).
- Quando a 7.0 passar a gravar `corrigida_por` de verdade, entra o caso da eliminação pelo `CicloDeVidaService.eliminar`, que já está no `TODO.md` com dono. Vale conferir que ele também prova que a seção some do arquivo do titular eliminado.

Pergunta de fechamento: o código responde. A seção entra no arquivo de quem a corrigiu, com `corrigida_por` fora. A seção herdada não entra em arquivo de ninguém, como o `docs/lgpd.md` passou a dizer. A auditoria guarda só ids. E nada foi enviado para fora nesta tarefa.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-17 15:12:07 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da rodada 2 não toca `Nota`, correção, lote nem entrega. Todos com autor humano? Sim. Os caminhos que já existiam não mudaram.

Decisão autônoma sobre aluno: ausente. A rodada 2 só mexe em seções do material, no runbook, nos testes e na documentação. Nada disso decide sobre a trajetória de um aluno.

Aprovação registrada: ok.
- **Herança da correção:** `herdarClassificacao` agora devolve `rowCount` do `update` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/extracao.repository.ts:162`), e não mais o número de pares lidos. Esse número vai para `material.classificacao_herdada`, assinado pela `rotina` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/extrair-pdf.ts:51`). A auditoria passa a contar só as seções que mudaram de fato, o que deixa mais exata a resposta a "o que foi gerado, quem aprovou e quando" (item 6). É a recomendação do `tenancy-guardian` na rodada 1, feita.
- **Bloco de roll-forward do runbook:** cria as seções sem execução, sem IA e sem copiar correção. A edição que o código anterior fechou não herda: a coordenação corrige de novo à mão, então nada nasce aprovado sem uma pessoa.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, nesta etapa. A IA continua desligada nesta tarefa, e a declaração da função `classificacao_do_material` segue prevista para a 3.0, como na rodada 1.

Itens 7, 8 e 9: nada no diff. Não há inferência emocional, nota em discursiva ou redação, nem indicador de professor. A frase nova em `docs/lgpd.md` diz que a seção herdada nasce sem `corrigida_por` e por isso não entra no arquivo de ninguém. Isso é coerente com a regra 70: a autoria da correção original continua na seção antiga e na auditoria dela.

Correções exigidas na rodada 1: nenhuma por esta auditoria. As três recomendações desta auditoria seguem como estavam:
- a marca "herdada da edição anterior" na tela vai para a 7.0;
- o `fazSozinha` dizendo que a correção passa sozinha para a edição nova vai para a 3.0;
- o risco da herança na AIA `diagnostico-por-habilidade` também vai para a 3.0.

Bloqueantes: nenhum.

Recomendações:
- Quando a 7.0 mostrar a classificação, ela precisa distinguir a seção que a coordenação corrigiu da que a rotina herdou pelo mesmo número e título. Hoje as duas têm `corrigida_em` e `origem: 'coordenacao'`. A recomendação continua aberta e não bloqueia esta tarefa, que não tem tela.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-2_task-r2.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/achados/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/extrair-pdf.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/extracao.repository.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 15:12:27 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção pedida na 1ª rodada foi feita:
- O `cenarios.md` ganhou um `[I]` para cada uma das duas divergências, nas linhas 72 a 76 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md`. A primeira é a FK `execucao_id` com `set null` só na coluna, que faz as FKs passarem a oito. A segunda é o check `secao_do_material_corrigida_por_so_na_corrigida`. Os dois trazem a mutação.
- Os testes que esses dois itens citam existem: `migracao-f4b.int.test.ts:315` e `:354`, e `expurgo-da-escola.int.test.ts:1998`.
- No `2_task.md`, o item 8 da autoconferência (linha 98) e a coluna "Onde está na spec" (linhas 108 e 109) agora citam o `cenarios.md` com o `[I]` de cada uma.

O que mais mudou nesta rodada é resposta a outros revisores, e não invade tarefa futura:
- A seção de volta do código no `docs/runbook.md`, com o teste `volta-da-2-0.int.test.ts`, que roda o bloco do próprio runbook. Foi a correção (a) que o `infra-guardian` exigiu, e entrou no `cenarios.md` e nos arquivos previstos.
- O `rowCount` da herança e a extração de `capitulosDasSecoes`, com o caso de isolamento dela. Os dois vieram das recomendações do `tenancy-guardian`.
- A frase sobre a seção herdada no `docs/lgpd.md`, recomendação do `privacy-guardian`.
- As recomendações que ficaram para depois estão no `TODO.md`, cada uma com dono.

Recomendações:
- `cenarios.md:77-78`: o `[I]` da volta do código é o único entre os novos sem "Mutação". Vale acrescentar uma, por exemplo tirar o `not exists` da seção que já existe, que o caso de "rodar de novo" pega.
- `docs/runbook.md`, no bloco `volta-da-2-0: roll-forward`: é um `INSERT` só, sem os lotes de 1.000 da `0061`. A janela de volta é curta e o volume pequeno, então está aceitável. Mesmo assim, uma linha dizendo por que aqui não há lote poupa a dúvida de quem estiver de plantão.
- `packages/core/src/material/extracao.repository.ts:114`: `capitulosDasSecoes` virou método público e só a herança e um teste o usam. Se a 7.0 não for usá-lo, uma nota no docblock dizendo que é leitura interna da herança evita que vire a segunda forma de ler as seções.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-17 15:12:30 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration, deploy
Rate limit: ok (a mudança desta rodada não cria rota nem limite)
Fila e prioridade: ok (nenhum job novo; a classificação fica para a 5.0)
Concorrência: protegida (o bloco de roll-forward é idempotente pelo `NOT EXISTS`, e a chave `(escola, material, ordem)` recusa a seção em dobro se a extração nova gravar no mesmo instante)
Índice e paginação: ok (`capitulosDasSecoes` filtra pela escola e pelo material e é atendida pela chave `(escola_id, material_id, ordem)`; a leitura fica limitada às seções de um material só)
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok (é um procedimento sem alerta novo, e o runbook diz isso)
Bloqueantes: nenhum

A correção exigida na rodada 1 foi feita pelo caminho (a):
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md` ganhou a seção "Voltar o código depois da classificacao-bncc 2.0". Ela diz o que o código anterior faz com `secao_do_material`, `habilidade_da_secao` e `material.classificacao_herdada`, proíbe reverter as migrations e traz o bloco `-- volta-da-2-0: roll-forward`. Esse bloco é o mesmo `INSERT … NOT EXISTS` da `0061`, numa instrução só, e vem com a contagem de conferência.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/volta-da-2-0.int.test.ts` lê o SQL direto do runbook e prova três coisas:
  - as seções nascem pela conta de `planejarSecoes`, com capítulos, com blocos de 10 páginas e com uma página só;
  - o material excluído, o `processando` e o que já tinha seção ficam como estavam;
  - rodar o bloco duas vezes não duplica, e o material que fica `pronto` depois do primeiro bloco ganha a seção no seguinte.
- Rodei o teste da volta: 3 de 3 passaram. Rodei também `material-edicao.int.test.ts` e `extrair-pdf.int.test.ts`, por causa da troca para `rowCount` em `herdarClassificacao` e da nova `capitulosDasSecoes`: 103 de 103 passaram.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md:115-130`: abrir o bloco com `SET LOCAL lock_timeout = '5s';`, como faz a `0061`. Ele lê `material` e `capitulo_do_material` com `FOR KEY SHARE` por causa das FKs, e um roll-forward feito durante o dia não deveria ficar esperando trava sem limite.
- No mesmo runbook, deixar a ordem dos passos explícita: subir o código novo, esperar o `worker-pdf` antigo terminar os jobs que já estavam rodando, rodar o bloco e só então reabrir o envio. Hoje a ordem aparece só em pedaços, entre "antes de reabrir o envio" e o "Não faça".
- As quatro pendências que o Implementador registrou no `TODO.md` têm dono e momento, e seguem para a validação: o `VALIDATE` com a `auditoria` travada, o índice parcial de `corrigida_por`, o `[P]` da herança em dobro e a eliminação pelo `CicloDeVidaService`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 15:12:42 · `tasks/prd-classificacao-bncc/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. Esta rodada traz três coisas novas:
- o isolamento da leitura `capitulosDasSecoes`, que saiu de dentro da herança e virou método próprio;
- a contagem da herança, que agora vem do `rowCount` do `update`;
- a volta do código depois da 2.0: o bloco `roll-forward` do runbook dá seção ao `pronto` sem nenhuma, rodá-lo de novo não duplica nem mexe no que já existe, e o material que fica `pronto` depois do primeiro bloco ganha a seção no segundo.

**Cobertos:**
- **Isolamento de `capitulosDasSecoes`.** O caso `material-edicao.int.test.ts` › "a leitura dos capítulos das seções, no contexto da A, com o material da B…" lê o material da B no contexto da A, com e sem o filtro das corrigidas, e espera lista vazia. No contexto da B, acha a seção, o que mostra que o repository não devolve vazio sempre. O bloco de mutação que tira `eq(secaoDoMaterial.escolaId, escolaId)` aponta esse caso, e o cenário chega à cláusula: sem o escopo, a A leria a linha da B e a lista teria 1 item. As outras três mutações da nova linha do `where` (tirar o material, tirar o filtro de corrigidas, tirar o capítulo da junção) têm bloco cada uma.
- **Contagem pelo `rowCount`.** O caso `material-edicao.int.test.ts:854` confere `secoes: 2` na auditoria `material.classificacao_herdada`, então `return 0` fica vermelho. Trocar `rowCount` por `pares.length` daria o mesmo número hoje, e isso está explicado com motivo em "Sem mutação que um teste veja". Aceito.
- **Volta do código.** O `volta-da-2-0.int.test.ts` roda o bloco SQL lido do próprio `docs/runbook.md`, então o procedimento que a pessoa de plantão copia é o que o teste prova. Ele cobre capítulos, blocos de 25 páginas, uma página só, a escola B (a seção fica na escola do material), a seção existente com correção e falha (fica intacta), a idempotência com o total igual depois de duas rodadas e o material tardio que ganha exatamente 2 seções. Rodei o arquivo: 3 de 3 passaram.
- **Tabela de testes do documento.** As novas citações batem com os nomes reais: a linha "isolamento do repository de seção" e a linha "volta do código". Rodei os quatro casos de escopo da herança em `material-edicao.int.test.ts`: 4 passaram.
- **Os três `[I]` novos do `cenarios.md`.** Os casos existem em `migracao-f4b.int.test.ts` (linhas 315, 354 e o arquivo de volta) e têm bloco de mutação: o check do `corrigida_por` e a FK da execução trocada para `no action`.
- **Teste do arquivo do titular.** O novo nome do caso diz com honestidade que quem barra a outra escola é a FK composta, e não o filtro. Isso bate com o motivo listado em "Sem mutação".
- **Correções da rodada 1:** nenhuma era exigida. As recomendações foram tratadas, e as que viraram linha no `TODO.md` têm dono e momento.
- Nenhum `.skip`, nenhum teste comentado, nenhum mock de código nosso e nenhuma chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Metade do bloco do runbook fica sem prova.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/volta-da-2-0.int.test.ts:237-238`, os materiais `excluido` e `processando` nascem sem capítulo. Por isso só a parte do bloco por páginas prova que eles ficam sem seção. Na parte por capítulo do bloco SQL (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md:1220`), o filtro `m.estado = 'pronto' and m.excluido_em is null` pode ser tirado sem nenhum teste ficar vermelho, mesmo com o nome do caso dizendo "o excluído e o `processando` ficam sem". Não bloqueia porque é documento: o `tools/processo/mutacoes.ts` só cobra `apps/*/src`, `packages/*/src` e o código de `tools/`. A mesma condição na `0061` já está provada em `migracao-f4b.int.test.ts`. A correção é barata: dar `capitulos: 2` a esses dois materiais do arquivo de volta. Fica registrado para a validação.
2. **Comparação de data por texto.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/volta-da-2-0.int.test.ts:316`, o teste compara `corrigida_em` pelo `toISOString()` contra uma string com milissegundos. Funciona hoje, mas fica mais robusto comparando `getTime()` com `Date.parse(...)`, para não depender de como o driver formata o valor.
