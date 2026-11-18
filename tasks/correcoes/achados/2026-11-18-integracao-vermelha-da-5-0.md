# Achados das revisões — `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-18 05:52:22 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A correção só mexe em fixture e teste de integração e não adiciona chamada de modelo. Ela tira uma chamada ao modelo que o teste não pediu (`FakeAdapter`, via `ia.executar-lote`).
Custo estimado por professor/mês: não se aplica. Nenhuma chamada nova. O custo da classificação agendada na extração vem da tarefa 5.0 e não muda aqui. Em produção o código segue como a 5.0 decidiu.
Prompt versionado: não se aplica (nenhum prompt tocado).
Validação de schema: não se aplica.
Aprovação humana no caminho: não se aplica. Nada oficial é produzido; a execução da seção continua nascendo `pendente`.
Bloqueantes: nenhum.

O que conferi:
- **Tipo do substituto.** `SEM_JOB_DA_CLASSIFICACAO` (`apps/api/test/material.fixture.ts`) é `Pick<JobOutbox, 'enfileirarUmaVez'>`, o mesmo tipo que `criarExtracaoDoPdf` aceita (`apps/worker/src/processors/extrair-pdf.ts:36`). O retorno `{ situacao: 'ja_enfileirado', id: null }` é válido para `IdempotencyKeyResult` (`packages/core/src/queue/job-outbox.repository.ts:41`).
- **Produção intacta.** O `enfileirador` é opcional em `criarExtracaoDoPdf`, e `apps/worker/src/composition.ts` continua passando o `JobOutbox` real. Nenhuma mudança em código de produção.
- **Regra 30.** Nenhum teste chama provedor pago. O job que chamava o modelo, nem que fosse o adaptador falso, deixa de existir nesses testes.
- **Cobertura da classificação.** `apps/worker/test/classificacao-agendada.int.test.ts` e `apps/worker/test/extrair-pdf.int.test.ts` existem e cobrem o agendamento. O teste novo em `apps/api/test/material.int.test.ts` prova que o fixture não enfileira o job. Sua mutação está declarada na tarefa (`toBe(0)`).
- **Execução dos testes.** Não rodei a suíte de integração; a análise é só de leitura e tipos.

Recomendações:
- Os comentários novos do fixture têm duas linhas bem longas. Quebrar em linhas menores deixaria a leitura mais fácil.
- Nenhum teste prova que a execução da seção ainda nasce `pendente` com o fixture. A tarefa afirma isso, mas só o teste da 5.0 no worker cobre. Uma asserção a mais no teste novo fecharia o ponto.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.int.test.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-18 05:52:25 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova. A correção não traz migration nem schema, e mexe só em dois arquivos de `apps/api/test/`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.int.test.ts:161`: a consulta direta a `job_registro` no teste novo filtra por `escola_id = $1`, com a escola criada no próprio caso. Assim ela não conta job de outra escola de teste que rode em paralelo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts:235` (`materiaisDa`): filtra por `escola_id`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts:191` e `:212`: a extração do teste continua rodando com `runInContext` e a escola do objeto. Só troca o enfileirador por `SEM_JOB_DA_CLASSIFICACAO`. O stub segue o contrato `Pick<JobOutbox, 'enfileirarUmaVez'>` (`packages/core/src/queue/job-outbox.ts:45`) e não muda o escopo da transação da extração.
- Nenhum repository, endpoint, `@Unscoped()` ou consulta da camada rede foi alterado. Nada em código de produção mudou: `apps/worker/src/processors/extrair-pdf.ts` continua com o `JobOutbox` real por padrão.

Teste de isolamento: não se aplica. A correção não cria escopo novo, e o isolamento do material segue coberto por `apps/api/test/material-isolamento.int.test.ts`, que não mudou.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts:174`: o stub devolve `{ situacao: 'ja_enfileirado', id: null }`, que pelo contrato quer dizer "já existe ou terminou". Se algum código passar a ler esse retorno para decidir o que fazer, o teste vai mostrar um estado que não acontece em produção. Vale deixar isso dito no comentário do stub. Não afeta o isolamento.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-18 05:52:25 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

A correção mexe só no fixture de teste e acrescenta um caso que reproduz o problema. O código de produção da 5.0 não muda. Os pontos que conferi:

- **Tipo:** o `SEM_JOB_DA_CLASSIFICACAO` respeita o tipo exigido em `apps/worker/src/processors/extrair-pdf.ts:36`. O retorno `{ situacao: 'ja_enfileirado', id: null }` é um resultado válido de `IdempotencyKeyResult`, definido em `packages/core/src/queue/job-outbox.repository.ts:41`.
- **Quem usa o fixture:** nenhum dos arquivos que chamam `esperarExtracao` ou `extrairMaterial` dependia do job `ia.executar-lote`. O único que fala de classificação, `apps/api/test/material-edicao.int.test.ts`, confere a herança e a auditoria `material.classificacao_herdada`. Isso continua funcionando, porque a execução da seção ainda nasce `pendente`; só o job deixa de existir.
- **Agendamento real:** quem prova o agendamento de verdade continua sendo os testes do worker que o documento cita. O fixture não tira essa cobertura.
- **Mutação:** a mutação declarada está ligada ao caso novo em `apps/api/test/material.int.test.ts`. A falta de prova separada para o `extrairMaterial` está justificada no documento.

Recomendações:
1. O comentário do `SEM_JOB_DA_CLASSIFICACAO` em `apps/api/test/material.fixture.ts:170-173` está longo e repete a seção "Causa" do documento da correção. Bastaria uma frase dizendo que o job da classificação chamaria o modelo falso e somaria chamada e consumo nos testes do Assistente, do Tutor e do artefato.
2. Na seção "Causa", a lição sobre a lacuna de "Quem usa o que mudou" no documento da 5.0 vale para a retro: mudança de produção usada por um fixture compartilhado deveria levar o portão local a rodar os arquivos que importam esse fixture.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 05:52:27 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO

A correção só mexe em teste. Ela devolve os testes do Assistente, do Tutor e do artefato ao comportamento de antes da tarefa 5.0, e nenhum ponto da regra 70 muda.

Caminhos de escrita em Nota: nenhum novo nem alterado. O diff só toca no fixture `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts` e no teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.int.test.ts`. Nenhum dos dois grava em `Nota`. Todos com autor humano? sim, nada mudou.
Decisão autônoma sobre aluno: ausente. A classificação BNCC que deixa de ser agendada só nesses testes classifica seções de material, não o aluno.
Aprovação registrada: ok. Os testes da regra 70 item 3 (`apps/api/src/artefato/artefato.int.test.ts` e `apps/api/src/entrega/entrega.int.test.ts`) continuam provando a mesma coisa. A troca só tira deles uma chamada ao modelo que ninguém pediu (o job da classificação), e com ela as contagens de chamadas e de consumo voltam a valer.
Supervisão do tutor: ok. Em `apps/api/src/tutor/tutor-modelo.int.test.ts` só sai a chamada a mais do job da classificação, que distorcia o espião `chamar`. A cobertura da regra 70 item 4 fica igual.
Autonomia declarada e visível: sim, sem mudança. Não há declaração de agente nem tela no diff.

Bloqueantes: nenhum.

Recomendações:
- O documento da correção já registra que o enfileirador que não enfileira, usado em `extrairMaterial` (`material.fixture.ts:212`), não tem teste próprio. Fica para a retro.
- O código de produção continua agendando a classificação na extração (`apps/worker/src/processors/extrair-pdf.ts:65`), e o fixture agora esconde esse job dos testes da API. Quando a classificação BNCC passar a alimentar algo que chega ao aluno ou ao diagnóstico por habilidade, que a AIA da regra 70 item 6a prevê, a cobertura disso precisa vir dos testes do worker (`apps/worker/test/classificacao-agendada.int.test.ts`), não destes. Vale lembrar disso na revisão da spec.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 05:52:28 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO

A correção mexe só no fixture e no teste da API. Não cria campo, log, rota, DTO nem envio externo novo, e nenhum código de produção muda.

Campos pessoais tocados: nenhum. A mudança troca o mecanismo que agenda a classificação dentro da extração do teste. Nesse mecanismo só circulam o id da execução e o tipo do job (`TIPO_EXECUTAR_LOTE`), e nenhum dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Não há rota nova. O caso novo usa as funções de teste que já existiam (`montarEscolaComTurma`, `enviarMaterial` pela coordenação da própria escola). A consulta de conferência em `job_registro` filtra por `escola_id`.

Logs: limpos. O logger do fixture continua igual: `silent`, ou `trace` só para a lista em memória do teste.

Auditoria: presente. A tarefa não cria nem muda nenhuma ação que exija auditoria.

Envio externo: nenhum. A mudança diminui chamadas ao modelo. O falso de `apps/api/test/material.fixture.ts:174` faz o job `ia.executar-lote` da classificação deixar de existir nos testes do Assistente, do Tutor e do artefato. Com isso, o `FakeAdapter` deixa de receber chamadas que ninguém pediu. O formato do falso bate com o que a classificação usa: `Pick<JobOutbox, 'enfileirarUmaVez'>`, o mesmo tipo de `packages/core/src/material/agendamento-da-classificacao.repository.ts:125`. Em produção, a extração continua agendando com o `JobOutbox` de verdade, e o registro em `ExecucaoAgente` continua igual.

Seed/fixture: sintético. O PDF é o de demonstração (`tools/demonstracao/conteudo-estequiometria.ts`), e as escolas e pessoas são criadas pelo próprio teste.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/material.fixture.ts:174`: o falso responde `{ situacao: 'ja_enfileirado', id: null }` a toda chamada. Ele não guarda nada, então um teste futuro não consegue provar que a extração tentou agendar. Uma opção é expor o que recebeu, como uma lista dos tipos pedidos, para que o caso novo de `apps/api/test/material.int.test.ts:153` confirme que a extração pediu o job e o falso o descartou. Hoje ele só confirma que o job não existe.
- O próprio documento da tarefa registra que, em `extrairMaterial` (`apps/api/test/material.fixture.ts:212`), a troca não tem um caso que a prove sozinha. Para a regra 20 isso não é problema; fica anotado para o `test-engineer`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-18 05:52:30 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só o fixture e o teste em `apps/api/test/`; nenhum código de produção mudou)
Rate limit: ok (não se aplica, nenhum limite mexido)
Fila e prioridade: ok. A produção continua pondo `ia.executar-lote` na fila `lote` (`packages/core/src/material/agendamento-da-classificacao.repository.ts:199`). Só o fixture troca o enfileirador.
Concorrência: protegida. A troca do `execucao_id` com condição e o `enfileirarUmaVez` não mudaram. O teste de extração dupla em `apps/api/test/material-edicao.int.test.ts:715` continua cobrindo a gravação na transação.
Índice e paginação: ok (nenhuma query nova em produção; a do teste usa `escola_id`)
Degradação de IA: não se aplica. A correção tira dos testes a chamada ao `FakeAdapter` que ninguém pediu e não passa por provedor pago.
Migration: não se aplica
Métrica e alerta: ok (nada novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `apps/api/test/material.fixture.ts:174`: o stub responde `{ situacao: 'ja_enfileirado', id: null }`. O tipo `IdempotencyKeyResult` (`packages/core/src/queue/job-outbox.repository.ts:41`) aceita essa forma. Mas, se um dia algum chamador do fixture passar a ler o retorno, essa resposta diz "já havia um job e ele terminou", o que não é verdade aqui. Vale escrever no comentário do `SEM_JOB_DA_CLASSIFICACAO` que o retorno não é lido por `agendar`.
- A execução da seção fica `pendente` e sem job em todo teste da API que usa `esperarExtracao` ou `extrairMaterial`. Se um teste futuro da API precisar da classificação de ponta a ponta, ele tem de montar o enfileirador real de propósito. Vale deixar isso dito no mesmo comentário, para ninguém achar que a classificação está quebrada na API.

## test-engineer · 1ª rodada · APROVADO · 2026-11-18 05:54:34 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção mexe só num fixture de teste e não cria regra de negócio. Por isso permissão, isolamento e concorrência não se aplicam: o código de produção não muda. O que precisava ser provado:
1. Caminho feliz: com o fixture, o material de Química termina `pronto` e nenhum job `ia.executar-lote` é criado.
2. As 19 falhas da esteira voltam a passar: o modelo é chamado uma vez só, e as contagens de execução, consumo e mensagem ficam como eram antes da 5.0.
3. Ninguém que usa o fixture perde o que esperava, e a classificação agendada continua testada onde já era (os testes do worker e o `agendamento.int.test.ts`).

**Cobertos:**
- (1) O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/material.int.test.ts:153` olha o resultado, não só se o código rodou. Ele exige o material `pronto`, o que garante que a extração rodou e que o zero não é vazio, e exige que `job_registro` não tenha job do tipo `TIPO_EXECUTAR_LOTE` na escola. O bloco de mutação do documento troca a linha de `esperarExtracao` pela de antes, o que torna o caso vermelho pelo motivo certo (`toBe(0)`). Rodei o caso aqui e ele passa.
- (2) Rodei os quatro arquivos que caíram na esteira: `leitura-por-serie`, `assistente`, `tutor-modelo` e `artefato`. Passaram os quatro, 147 casos.
- (3) Rodei `material.int.test.ts` e `material-edicao.int.test.ts`, os dois que usam `extrairMaterial`: 112 casos, todos passam. Nenhum teste da API que usa o fixture esperava o job da classificação. O caso `material-edicao.int.test.ts:887` olha só seções, habilidades e auditoria.
- O substituto `SEM_JOB_DA_CLASSIFICACAO` devolve `{ situacao: 'ja_enfileirado', id: null }`, que é uma resposta válida pelo tipo de retorno de `enfileirarUmaVez` (`packages/core/src/queue/job-outbox.repository.ts:41`). O repositório de agendamento ignora esse retorno (`agendamento-da-classificacao.repository.ts:199`).
- Não há `.skip`, teste comentado nem chamada a provedor pago. A IA desses testes continua no `FakeAdapter`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A troca em `extrairMaterial` (`apps/api/test/material.fixture.ts:212`) não tem bloco de mutação. O documento explica por quê, e a RF17 não se aplica porque o arquivo está em `apps/api/test/`. Mas essa troca nem é necessária para a correção: os dois arquivos que usam `extrairMaterial` sobem a API sem a fila de IA. Há dois caminhos: dizer no documento que ela é só consistência, ou provar com um caso que chame `extrairMaterial` numa disciplina com componente da BNCC. Um exemplo é o ponto de `material.int.test.ts:1183`, com a mesma consulta a `job_registro`.
2. Com o fixture, a execução de classificação continua sendo criada, `pendente`, só sem job. Hoje os testes do Assistente, do Tutor e do artefato passam porque filtram as execuções pela função. Um teste futuro que conte `execucao_agente` da escola sem esse filtro vai ver uma linha a mais. Vale escrever isso no comentário de `SEM_JOB_DA_CLASSIFICACAO`, ou fazer o fixture também não criar a execução.
3. O nome do caso em `material-edicao.int.test.ts:887` diz que "a seção da edição vai à classificação", mas nada ali confere a classificação. Com o job desligado no fixture, o nome promete mais do que o caso prova. Sugiro trocar o nome ou acrescentar a asserção da execução criada para a seção.
4. Cabe uma nota para a retro: o portão da 5.0 não percorreu "Quem usa o que mudou" para fixtures compartilhados. Quando uma tarefa muda o comportamento padrão de algo que um fixture monta (aqui, o `enfileirador` padrão de `criarExtracaoDoPdf`), o documento dela deveria listar os arquivos que usam esse fixture.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 06:02:49 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que conferi nesta rodada:
- Diff `49b7ed31..aa6f950c`: o código não mudou depois desse commit. O documento da tarefa em disco é igual ao de `aa6f950c`.
- `apps/api/test/material.fixture.ts:170-174`: o comentário diz a verdade. O retorno de `enfileirarUmaVez` é descartado em `packages/core/src/material/agendamento-da-classificacao.repository.ts:199`, e a execução nasce antes do enfileiramento, por isso fica `pendente`.
- `apps/api/test/material.int.test.ts:163-165`: a asserção nova prova o que o documento promete. A extração continua criando a execução da seção, só não cria o job. Assim o caso deixa de provar apenas uma ausência.
- O documento diz que `extrairMaterial` é usado por dois arquivos. Confere: `material.int.test.ts` e `material-edicao.int.test.ts`.
- A tabela "Recomendações sem aplicar" diz o que aconteceu com cada recomendação da 1ª rodada. A linha nova do `TODO.md` corresponde à recomendação do test-engineer que foi para lá.
- Nenhum código de produção foi tocado.

Recomendações:
- `apps/api/test/material.int.test.ts:164`: `select estado from execucao_agente where escola_id = $1` não tem `order by` e espera exatamente uma linha. Isso só fica estável enquanto o PDF de demonstração der uma seção (ou um lote de até 12 seções). Se o fixture ganhar páginas e o material passar a gerar mais de uma execução, a comparação passa a depender da ordem das linhas. Filtrar pelo `material_id` e comparar com `every(estado === 'pendente')` mais a contagem tornaria o caso menos frágil.
- `apps/api/test/material.fixture.ts:171`: a observação "`ja_enfileirado` é só o tipo que cabe" explica uma escolha de tipagem. Ela fica certa só enquanto `agendar` não ler o retorno. Se alguém passar a ler `situacao`, o stub mente em silêncio. Vale um teste de unidade ou um tipo mais estreito no lugar do comentário, quando alguém tocar `agendar`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 06:02:53 · `tasks/correcoes/2026-11-18-integracao-vermelha-da-5-0.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 2, só o diff desde a 1ª):**
- O caso novo continua provando que a extração do teste não cria job `ia.executar-lote`.
- O caso novo agora também prova que a classificação agendada pela 5.0 continua nascendo: a execução da seção fica `pendente` em `execucao_agente`.
- O comentário do fixture diz o que o stub deixa de fora.
- O documento explica por que a troca em `extrairMaterial` não tem bloco de mutação.
- As recomendações da 1ª rodada que não foram aplicadas estão registradas no documento.

**Cobertos:**
- `apps/api/test/material.int.test.ts:153-166` faz as duas asserções sobre o resultado. A contagem de `job_registro` do tipo `TIPO_EXECUTAR_LOTE`, limitada à escola, tem de ser 0. As linhas de `execucao_agente` dessa escola têm de ser exatamente `[{ estado: 'pendente' }]`. Assim o caso não se satisfaz com o falso descartando tudo: se a extração deixasse de agendar a classificação, a segunda asserção falharia. Isso responde em parte à recomendação do privacy-guardian, sem mudar o desenho do fixture.
- Rodei `npx vitest run apps/api/test/material.int.test.ts`: 68 de 68 casos passaram.
- O bloco de mutação do documento não mudou. Ele troca o enfileirador de `esperarExtracao` em `apps/api/test/material.fixture.ts` e espera `falha: toBe(0)`, uma cláusula que o cenário alcança.
- No fixture (`apps/api/test/material.fixture.ts:17-24`) só o comentário mudou. O stub continua igual, e o texto novo diz que a execução nasce `pendente`, sem job, e que o retorno não é lido por `agendar`.
- O documento agora diz que a troca em `extrairMaterial` é só por consistência e que a correção não depende dela. Isso justifica a falta de bloco: não é cláusula nova de produção, e a RF17 só vale para `apps/*/src` e `packages/*/src`.
- A tabela "Recomendações sem aplicar" dá destino ou motivo a cada item. A do nome do caso em `material-edicao.int.test.ts` foi para o `TODO.md` com dono.
- Não há `.skip`, teste comentado nem chamada a provedor pago. A correção não cria operação concorrente nova.

**Bloqueantes:** nenhum.

**Recomendações:**
- Em `apps/api/test/material.int.test.ts:165`, a igualdade exata `[{ estado: 'pendente' }]` depende de o PDF de demonstração gerar uma seção só. Se o PDF ganhar seções, o caso fica vermelho por um motivo que não tem a ver com a regra. Dá para usar uma asserção que não dependa da contagem: toda linha `pendente` e pelo menos uma linha.
- O nome do caso (linha 153) não cita a segunda metade do que ele prova agora, que a execução da seção continua nascendo `pendente`. Vale acrescentar ao nome para quem lê só a lista de casos.
