# Achados das revisões — `tasks/prd-ingestao-do-material/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-11 15:57:36 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: só `envio_de_material`, que é nova.
- Tem `escola_id` NOT NULL, com FK para `escola`, e a chave primária composta `(escola_id, material_id)`.
- Não há FK para `material`, e isso está justificado.
- Não varia por período, então não precisa de `anoLetivoId`.
- A classificação é `sem_pessoa` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/privacidade/classificacao.ts:131`).
- O `material_id` é UUIDv7 gerado no servidor, nunca vem do cliente.
- Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0050_material_envio_em_andamento.sql` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/material.ts`.

Queries verificadas:
- **Em `EnvioDeMaterialRepository`:** `registrar`, `apagarNoEnvio`, `apagar` e `travarParada` aplicam a escola por `requireEscolaId()`, tirada do contexto. Nenhum método recebe a escola por parâmetro.
- **Em `VarreduraDoMaterialRepository`:** `enviosParados` e `objetosQueSobraram` levam `@Unscoped`, com a justificativa escrita no próprio método. As duas devolvem só `(escolaId, materialId)` e não apagam nada.
- **No processador `varrer-envios.ts`:** cada alvo roda com `runInContext` na escola da linha, e o apagar usa os repositories com escopo. A chave do objeto (`chaveDoTemporario`) também sai do contexto, então cada `apagar` só alcança o storage daquela escola.
- **Em `material.service.ts`:** a linha nasce e sai no contexto da requisição autenticada. Não entrou endpoint novo nem parâmetro `escolaId` vindo do cliente.
- **`@Unscoped` no módulo:** há só esses dois, os dois justificados. A guarda `tools/guardas/repositories-com-escopo.test.ts` rodou aqui e passou nos 51 casos.
- **Camada de rede:** a tarefa não toca leitura de rede.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts`:
- **Linha 460:** com a escola A no contexto, o teste usa o id da B em `travarParada`, `apagarNoEnvio` e `apagar`. Sem a cláusula `escola_id`, quebra nos três: a trava viria `true`, o `apagarNoEnvio` também, e a linha da B sumiria.
- **Linha 527:** cobre `marcarObjetoApagado` com o id da B.
- **Linhas 249 e 355:** cobrem o contexto de cada escola na varredura. A mutação "um contexto só" quebra o teste pela chave do objeto.
- As mutações de cada `eq(escolaId)` estão declaradas no documento da tarefa.

Bloqueantes: nenhum.

Recomendações:
- Na linha 365 do mesmo teste ("duas escolas", o objeto que sobrou), trocar o `arrayContaining` por igualdade sobre as chaves apagadas filtradas pelas duas escolas do teste, como já se faz na linha 261. Assim o caso também provaria que nenhuma chave cruzada foi tentada.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-11 15:58:05 · `tasks/prd-ingestao-do-material/2_task.md`

**VEREDITO: APROVADO**

A tarefa não toca dado de pessoa. A tabela nova guarda só ids e um instante, a varredura loga só ids e contagens, e todo `delete`/`select` com escopo usa a escola do contexto.

**Campos pessoais tocados:** nenhum.
- `envio_de_material` tem só `escola_id`, `material_id` e `criado_em`, e está classificada `sem_pessoa` (`packages/shared/src/privacidade/classificacao.ts:131`).
- Ninguém lê essa tabela pela API e ela não entra no arquivo do titular, o que é coerente com não ter pessoa.
- As duas leituras `@Unscoped` devolvem só `{escolaId, materialId}`. O caso "as duas leituras `@Unscoped`…" de `varrer-envios.int.test.ts:441` confere as chaves do retorno.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Material da escola" (`docs/lgpd.md:101`) descreve a linha de `envio_de_material`: o que guarda, que não tem pessoa, quando nasce e quando sai. Descreve também os prazos novos do PDF: até 2 h para o envio sem commit e até 26 h para o objeto que sobrou depois do commit. `docs/modelo-de-dados.md` também foi atualizado.

**Autorização por objeto:** ok.
- Não há rota nova.
- Cada método de `packages/core/src/material/envio-de-material.repository.ts` (`registrar`, `apagarNoEnvio`, `apagar`, `travarParada`) aplica `requireEscolaId()` e não recebe a escola por parâmetro.
- A varredura abre `runInContext` com a escola de cada alvo (`apps/worker/src/processors/varrer-envios.ts:83`).
- Há testes com a escola A no contexto e o id da B, e uma mutação para cada `escola_id` retirado.
- O envio continua passando pela mesma autorização da 1.0. As saídas novas são 503 e 409 tipados, sem dado no corpo.

**Logs:** limpos.
- `material.objeto_nao_apagado` e `material.envio_nao_apagado` levam só `materialId` e `summarizeError` (`apps/api/src/material/material.service.ts:121,136,139`).
- `material.varredura_nao_apagou` e `material.varredura` levam só `escolaId`, `materialId`, `origem` e as contagens (`varrer-envios.ts:92,125`). Não vão ao log a chave do objeto, o título, o licenciante nem a mensagem do erro: `summarizeError` descarta a mensagem.
- Há teste que prova isso: `varrer-envios.int.test.ts:419-437`.

**Auditoria:** presente onde a regra exige. A tarefa não traz nenhuma das ações de auditoria obrigatória. Apagar o PDF temporário não é leitura de aluno nem exportação, e o `material.enviado` e o `material.recusado` da 1.0 continuam onde estavam.

**Envio externo:** nenhum. Não há IA nem terceiro. O PDF fica no storage privado, sob a chave `material-temporario/<escola>/<id>`, que só leva ids.

**Seed/fixture:** sintético. São usados `'Química'`, `'Título que nunca vai ao log'` e UUIDs aleatórios. `material.fixture.ts` só ganhou a limpeza da tabela nova.

**Pergunta de fechamento:** responde. A tabela nova não tem titular e não muda o que o arquivo do titular já responde. O PDF da escola agora tem prazo de saída escrito e conferido pela varredura.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `docs/lgpd.md:101` promete "em até 2 h" para o envio sem commit e "em até 26 h" para o objeto que sobrou. Os dois prazos só valem com o storage no ar e com menos de 500 alvos por passada. Com o `apagar` falhando, o job repete pela fila e o objeto fica até o storage voltar. Vale dizer "em até 2 h, ou na primeira hora em que o storage aceitar o apagar", para o mapa de dados não prometer mais do que o código cumpre.
2. O `tsconfig.tsbuildinfo` não versionado aparece no status, na raiz do repositório. É artefato de build e não deve entrar no commit. Não é questão de privacidade.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/envio-de-material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/varredura.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0050_material_envio_em_andamento.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-envio-orfao.int.test.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-11 15:58:57 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila | migration
Rate limit: ok (o envio não tem rota nova; os tetos por pessoa e por escola da 1.0 continuam valendo)
Fila e prioridade: problema
Concorrência: protegida no dado (`for update skip locked`, a conferência do `apagarNoEnvio`, `lock_timeout` de 1 s com 503, e a varredura pode rodar de novo sem estrago). O problema é de recurso, descrito no bloqueante.
Índice e paginação: ok (`envio_de_material_criado_em_idx` para a leitura entre escolas; os `delete` usam a chave `(escola_id, material_id)`; o órfão em `material` usa o índice parcial `material_objeto_a_apagar_idx`; as duas leituras têm `limit`)
Degradação de IA: não se aplica
Migration: compatível (só tabela nova e vazia; a FK sobre `escola` trava a tabela por um instante; o índice é criado com a tabela vazia)
Métrica e alerta: ok (a falha do job no fim cai no alerta genérico `job-falhou-de-vez`, que já tem runbook; o log leva só ids e contagens)

Bloqueantes:

1. **A varredura ignora o `sinal` de corte, e o prazo do job não cobre o pior caso.** Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:77`, com os laços nas linhas 95 e 113.
   - **O que está errado:** o processador é `async () =>` e não recebe o `sinal` que o executor entrega. O contrato de `JobProcessor` (`apps/worker/src/job-executor.ts:50-52`) diz que "trabalho que pode durar passa o `sinal` adiante e para quando ele aborta". A conta não fecha: 500 alvos por passada, vezes 10 s de prazo em cada `apagar`, vezes 2 passadas, dá até 10.000 s. O `prazoMs` é de 600 s.
   - **O que acontece às 10h:** o caso real é o storage fora do ar. Cada envio que falhou no `guardarBytes` deixa sua linha, e cada `apagar` da varredura gasta os 10 s inteiros. Com cerca de 60 alvos o job já passa do prazo. O executor corta e marca `TEMPO_ESGOTADO`, mas o laço segue rodando. A `RETENTATIVA_DE_HOJE` dá 5 tentativas com 2 s de recuo, e cada uma abre um laço novo por cima do anterior. Cada laço segura uma conexão do pool do worker-lote, com transação aberta durante a chamada ao storage. Segundo `docs/infra.md`, esse pool tem 3 ou 4 conexões. Com o pool tomado, expurgo, eliminação do titular e as outras rotinas de lote ficam esperando, e a varredura é urgente: roda em pleno horário letivo.
   - **Correção exigida:**
     - receber `(_dados, _execucao, sinal)`;
     - parar o laço quando `sinal.aborted` (conferido antes de cada alvo) e passar o sinal ao `apagarComPrazo`;
     - interromper a passada no primeiro `FileStorageUnavailableError`, porque com o storage fora todos os alvos seguintes também vão falhar, e a hora seguinte retoma;
     - fazer o lote vezes o prazo do `apagar` caber no `prazoMs`, ou ajustar um dos dois;
     - teste em `varrer-envios.int.test.ts`: um armazém que nunca responde, mais alvos do que cabem no prazo, e o sinal abortado. A prova é que o processador para de chamar o `apagar` e nenhuma transação fica aberta depois do corte.

2. **O comentário afirma o que o código não faz.** Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/system/job-definitions.ts:229`.
   - **O que está errado:** a frase "O prazo cobre o lote de alvos com o prazo curto de cada `apagar`" é falsa pela conta do item 1. O docblock de `LOTE_DA_VARREDURA` (`varrer-envios.ts:24`) diz o mesmo. É a pergunta 7 da autoconferência.
   - **Correção exigida:** depois de resolver o item 1, reescrever os dois comentários com o que o código passa a garantir.

Recomendações:
- `#guardarObjeto` (`apps/api/src/material/material.service.ts`, linha do `armazem.apagar` no `catch`): quando o `guardarBytes` estoura os 30 s, o request ainda espera até 5 s pelo `apagar` (`TIMEOUT_DO_ARMAZEM_NA_API_MS`). Com o storage fora, vale pular esse `apagar`, já que a linha fica e a varredura apaga o objeto depois, e devolver o 503 na hora.
- Na passada do envio, o `apagar` do storage roda com a transação aberta, de propósito, para segurar a linha. Registrar esse motivo na seção 7c da Tech Spec, para ninguém "otimizar" tirando o `apagar` da transação.
- Somar ao log `material.varredura` a duração da execução, para separar a varredura lenta da varredura que falhou.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-11 15:59:06 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As divergências estão na §5 (3)(4), na §6, na §7c e na linha "2.0" da §11 da `techspec.md`, e no `cenarios.md`.
Portão local: carimbo válido

**Bloqueantes:**

1. **Um comentário afirma o que o código não faz, e esconde o que acontece quando o storage trava.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:23`, que diz que "o prazo do job cobre o lote inteiro com o prazo de cada `apagar`". O mesmo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/system/job-definitions.ts:403` ("O prazo cobre o lote de alvos com o prazo curto de cada `apagar`").
   - O que está errado: as contas não fecham. São duas passadas de até 500 alvos (`LOTE_DA_VARREDURA`), com 10 s por `apagar` (`PRAZO_DO_APAGAR_DA_VARREDURA_MS`). No pior caso isso dá 10.000 s, contra `prazoMs` de 600 s.
   - O que acontece de fato: o processador não recebe o `sinal`. Quando o executor corta a tentativa (`job-executor.ts:38-42`), o laço segue rodando. A retentativa e a execução da hora seguinte então somam laços simultâneos contra o storage travado.
   - Isso também entrou na Tech Spec e no motivo da divergência: "lote de 500 alvos por passada" e "a trava da linha não pode durar mais que o `lock_timeout` do envio vezes o lote".
   - Correção exigida, uma das duas:
     - (a) receber o `sinal` no `JobProcessor` e sair do laço quando ele aborta, como faz o `extrair-pdf.ts`, com um caso que prove isso;
     - (b) dimensionar lote e prazo para que 2 × lote × prazo do `apagar` caiba em `prazoMs`.
   - Nos dois casos, reescreva os dois comentários e o motivo da divergência na `2_task.md` para dizerem o que o código faz.

2. **Um artefato de build está na lista da tarefa.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tsconfig.tsbuildinfo`.
   - O que está errado: é saída do `tsc` na raiz, criada às 15:10. Não está no `.gitignore` e nunca foi versionada. Do jeito que está, entra no commit do repositório público como um arquivo fora do escopo.
   - Correção exigida: apagar o arquivo antes do commit.

**Recomendações:**

- **Linha `--faltando` desatualizada.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/2_task.md:125` diz "12 linhas (11 blocos, 1 motivo)". O `mutacoes.ts --faltando` de agora lista só 1 linha, o `licenciante ?? null` em `material.service.ts:152`, que tem motivo. A seção ainda tem cerca de 50 blocos e 4 motivos. Atualize a linha.
- **O envio que recebe 503 pela trava pode passar de 1 s.** No `#desfazerEnvio` de `material.service.ts`, depois do `55P03`, o `EnvioDeMaterialRepository(banco).apagar(id)` roda fora de transação e sem `lock_timeout`. Ele espera a trava da varredura até o `statement_timeout` (2 s), e a requisição chega a uns 3 s. Vale aplicar a mesma espera curta ou não apagar a linha nesse caminho, já que a varredura vai apagá-la.
- **Atribuição sem uso.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/varredura.repository.ts`, no `objetosQueSobraram`, o `const linhas = await ...; return linhas` pode virar só `return this.banco...`, como em `enviosParados`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-12 15:05:04 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** a linha de `envio_de_material` existe antes do `guardarBytes` e não sobra depois do commit.
- **Toda saída depois do `guardarBytes` apaga o objeto e depois a linha:** `CONFLITO`, `LIMITE_EXCEDIDO` reconferido sob a trava, e commit que falha.
- **O `guardarBytes` estoura o prazo e o PUT chega depois:** 503, a linha fica, e a varredura a apaga em 61 min (em 59 min, não).
- **O `apagar` falha:** no envio, ficam a linha e o objeto; se é o `delete` da linha que falha, a recusa continua sendo a resposta.
- **Varredura:** 59 e 61 min no mesmo `Clock`; linha sem objeto; `apagar` que falha uma vez; `apagar` que não responde, cortado pelo prazo curto; lote nas duas passadas.
- **Órfão depois do commit:** `pronto` com 23 e 25 h; `falhou` vindo do processador de verdade; excluído; `processando`; material de antes da migration.
- **Concorrência real, nas duas direções:** o envio lento trava a linha e a varredura pula; a varredura trava a linha e o envio espera o `lock_timeout` e responde 503. Também a varredura que apagou a linha de um envio lento.
- **Permissão:** a varredura só roda como rotina do sistema.
- **Isolamento:** com a escola A no contexto, a linha e o material da B não são alcançados; cada `apagar` roda no contexto da sua escola; a falha numa escola não segura as outras.
- **As duas leituras `@Unscoped`:** justificativa escrita, e devolvem só escola e id.
- **Log:** só ids e contagens.
- **Fiação:** job urgente, cron `10 * * * *`, composição na fila `lote`, classificação `sem_pessoa`.

Cobertos: todos. Conferi as 18 linhas da tabela de testes, incluindo os itens juntados por ponto e vírgula: cada caso citado existe com esse nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-envio-orfao.int.test.ts`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts` ou nos testes de unidade e guarda citados.
- O `--faltando` lista uma linha só, `material.service.ts:152` (o `?? null` reindentado), que tem motivo escrito.
- Os blocos que conferi chegam à cláusula pelo motivo certo. Por exemplo: sem o travar, o `[P]` cai no prazo de 5 s porque o `envios.apagar` espera a linha travada; sem o `where` de `enviosParados`, a linha de 59 min aparece como pulada no resumo.
- O `[P]` da API com `WriteBlockTrigger` no `delete` prova o pulo de verdade: o gatilho BEFORE ROW roda com a linha já travada, e a asserção é que o objeto continua lá.
- Não há `.skip` nem teste comentado. Os armazéns trocados nos testes só registram a chave e repassam o pedido ao armazém em memória, então não escondem a regra. Não há IA.
- Não rodei as suítes de integração. Elas apagam `envio_de_material` e reescrevem `material.objeto_apagado_em` no banco inteiro, e atrapalhariam os outros revisores que rodam ao mesmo tempo. O portão já as rodou e provou as mutações.

Bloqueantes: nenhum.

Recomendações:
1. **Log que diz "só o id" sem provar o "só".** `material-envio-orfao.int.test.ts:221` e `:249` usam `expect.objectContaining({ materialId: id })`, e o nome do caso promete "o log diz só o id". Uma chave a mais (título, chave do objeto) passaria. O item 12 da autoconferência afirma que "o caso do log compara a lista de chaves", e nenhum dos dois casos compara: em `varrer-envios.int.test.ts:432-434` são `arrayContaining` e `toMatchObject`, salvos pelo laço de texto proibido da linha 436. Não bloqueio porque a guarda de lint `regras-log.mjs` já recusa valor calculado sob chave que não é id. Mesmo assim, comparar `Object.keys(...).toSorted()` fecha o achado da 1.0, que já voltou uma vez.
2. **Duas varreduras ao mesmo tempo, sem teste.** É o caso do job executado duas vezes, ou de duas réplicas. O documento afirma "segura com duas réplicas (`skip locked`)", e o mecanismo está provado só contra um envio. Um caso com duas execuções em paralelo, uma parada no `apagar`, provaria que a outra pula e que cada objeto e cada marca saem uma vez.
3. **Escola com falha persistente pode segurar as outras.** O lote de 500 é global e ordenado por `criado_em` (e por `material.id` na passada do órfão). Uma escola com 500 ou mais alvos cujo `apagar` falha sempre fica na frente toda hora, e a B nunca é alcançada. O caso "a falha numa escola não segura as outras" usa o lote padrão com 2 alvos, então não prova a afirmação junto com o lote. Fica para o `infra-guardian` decidir, junto com o veto dele sobre o `sinal` e o prazo do job.
4. **Dois envios em paralelo não conferem a tabela nova.** `material.int.test.ts:368` ("dois envios do mesmo arquivo ao mesmo tempo gravam um") é o clique duplo de verdade, mas não confere que nenhuma linha de `envio_de_material` sobrou. Falta `expect(linhasDoEnvio).toEqual([])`.
5. **A espera de 1 s não está fixada em teste.** O teste do `lock_timeout` prova que ele existe, mas não o valor: com 1,9 s o resultado seria o mesmo. Fixar `ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS < statement_timeout` em teste de unidade pegaria quem a aumentar.
6. **Mutação citada sem bloco.** A linha "o `guardarBytes` estoura o prazo" da tabela cita "Mutação: apagar a linha nesse `catch`" e não tem bloco. O teste a pega (`material-envio-orfao.int.test.ts:188-189`), mas fica a mutação declarada e não provada pelo portão.
7. **Varredura sobre o banco inteiro nos testes.** Na API, `varrer()` também roda `objetosQueSobraram` sobre todo o banco de teste acumulado, e o `beforeEach` do worker (`varrer-envios.int.test.ts:60`) marca `objeto_apagado_em` em todo material. Hoje é seguro porque o projeto `integracao` roda um arquivo por vez (`fileParallelism: false`). Vale um comentário dizendo essa dependência.
8. **Texto da tabela.** A linha do `@Unscoped` diz "`architecture.test.ts` acha a justificativa", mas cita `repositories-com-escopo.test.ts` › "o analisador enxerga o código real", que é um `describe`. O caso que vale é "todo método público real tem (a)… (b) @SemEscopo com motivo…".

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-12 16:13:35 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. `envio_de_material` e `material` não mudaram no schema nem na migration 0050 desde a rodada aprovada.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/varredura.repository.ts`: em `objetosQueSobraram`, a mudança só tira a variável intermediária. O método continua com `@Unscoped(JUSTIFICATIVA_DOS_OBJETOS)` e devolve só `(escolaId, materialId)`, com o mesmo `where`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts`: o laço passou para `percorrer`, e entraram o `sinal` e o `storageFora`. Cada alvo segue rodando em `runInContext({ escolaId do alvo })`. O processador continua usando só `EnvioDeMaterialRepository` (`travarParada`, `apagar`) e `ExtracaoDoMaterialRepository.marcarObjetoApagado`, que têm escopo. A chave do objeto continua saindo de `chaveDoTemporario`, que lê a escola do contexto (`requireEscolaId()`). Quando o `sinal` aborta, o `apagar` falha dentro da transação, a transação é desfeita e a linha fica livre.
- O guarda de rotina do sistema continua lá (`rotinaDoSistema !== true` dá `DADOS_INVALIDOS`).
- Não entrou endpoint nem parâmetro de escola vindo do cliente.

Teste de isolamento: presente e efetivo. O caso "duas escolas: cada `apagar` roda no contexto da sua e a marca vai só para a linha dela" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts`, por volta da linha 360) trocou o `arrayContaining` por um filtro das duas escolas seguido de `toEqual` com a lista ordenada. Ficou mais estrito. Testei a mutação de um contexto só: o B passaria a ser apagado com a chave da escola A, então o `toEqual` quebra e o `temObjeto(b.escolaId, daB)` também.

Os avisos de `material-envio-orfao.int.test.ts` e de `varrer-envios.int.test.ts` agora são comparados pelo conjunto exato de chaves. Nenhum leva chave do objeto, título nem arquivo.

Bloqueantes: nenhum.

Recomendações:
- Na rodada anterior não houve correção exigida, e nada nesta rodada pedia correção.
- `varrer-envios.ts`, função `percorrer`: o primeiro `FileStorageUnavailableError` de qualquer escola para a passada de todas. Hoje o storage é um só, então isso não afeta isolamento. Se um dia houver storage por escola ou por rede, a falha de uma escola vai segurar as outras. Vale registrar essa premissa na Tech Spec, junto do item do lote global que o `TODO.md` já leva.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-12 16:13:45 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

As duas correções da 1ª rodada foram feitas:

1. **Correção 1, pela opção (a).** O processador agora recebe o `sinal` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:109`.
   - Ele confere o `sinal` antes de cada alvo (linha 127). Quando o `sinal` aborta durante um `apagar`, a espera rejeita na hora (linhas 52-54), a transação desfaz e o corte não conta como falha (linha 132).
   - Quatro casos novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts:339-413` provam isso. Um deles confere que a linha fica livre com `for update nowait`.
   - Os comentários dizem o que o código faz: o docblock de `LOTE_DA_VARREDURA` (linhas 24-28) e o do job em `packages/shared/src/system/job-definitions.ts:229`.
   - O motivo da divergência foi reescrito na `2_task.md`. A mesma divergência está na `techspec.md` (§7c e §11, linha "2.0") e no `cenarios.md` (caso novo "O corte e o storage fora do ar"). Conferi com o `job-executor.ts` (linhas 365-386): o executor aborta o `controle` no prazo e entrega o `sinal`.
2. **Correção 2.** O `tsconfig.tsbuildinfo` não está mais na raiz nem no `git status`.

Recomendações:
- Os comentários de `varrer-envios.ts:24-28`, `:93` e `job-definitions.ts:229` dizem que o que sobra sai "na hora seguinte". Mas, depois do corte, o executor falha a tentativa com `TEMPO_ESGOTADO`, que não é definitivo e segue a `RETENTATIVA_DE_HOJE`. A fila pode então retomar antes da hora seguinte. Vale escrever "na próxima tentativa ou na hora seguinte".
- Em `docs/lgpd.md`, a linha do material diz que "a varredura para no primeiro `apagar` que falha". O código só para no `FileStorageUnavailableError`, que inclui o `apagar` que passa dos 10 s. Outra falha conta e a varredura segue. Vale citar o erro.
- Em `varrer-envios.ts:60`, o `if (aoAbortar)` sempre é verdadeiro, porque o executor da `Promise` roda de forma síncrona. É só para o compilador, e pode virar uma atribuição direta.
- Um só `apagar` lento (10 s) liga o `storageFora` e encerra a execução inteira. Está documentado e é uma escolha defensável, mas convém que o alerta de "objeto não apagado" leve isso em conta, para que um único soluço do storage não pareça uma queda.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-12 16:13:45 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila

Rate limit: ok (não se aplica: é rotina do sistema, sem entrada de fora)

Fila e prioridade: ok

Concorrência: protegida

Índice e paginação: ok

Degradação de IA: não se aplica

Migration: não se aplica nesta rodada (o diff não muda a 0050)

Métrica e alerta: ok

**Bloqueantes:** nenhum.

**Correções exigidas na 1ª rodada:**

1. **O `sinal` de corte e o prazo do job: feita.**
   - O processador recebe o `sinal`. O laço o confere antes de cada alvo (`varrer-envios.ts:127`), e o `catch` sai sem contar falha quando o corte já aconteceu (`varrer-envios.ts:132`).
   - O `apagarComPrazo` escuta o `sinal`. Quando ele aborta, a promessa rejeita e o `banco.transaction` desfaz a transação antes de devolver o controle.
   - O primeiro `FileStorageUnavailableError` liga `storageFora`, e isso encerra as duas passadas.
   - A opção foi "ajustar um dos dois" do jeito declarado: o lote continua não cabendo no `prazoMs` no pior caso. Isso está escrito em `2_task.md:120`, na techspec e em `docs/lgpd.md`, e quem garante o corte é o `sinal`. Aceito: a tentativa não passa mais do prazo, e o executor a encerra com `TEMPO_ESGOTADO`, como em qualquer job.
   - Os quatro testes pedidos existem em `varrer-envios.int.test.ts:439-513`:
     - `sinal` já abortado: zero `apagar`.
     - Armazém mudo, com três alvos e o `sinal` abortado no meio: um `apagar` só, e a linha livre provada por `for update nowait`.
     - Storage fora do ar na passada dos envios.
     - Storage fora do ar na passada dos objetos: um `apagar` só.
2. **Os comentários: feita.** `job-definitions.ts:229` e o docblock de `LOTE_DA_VARREDURA` (`varrer-envios.ts:24-28`) agora descrevem o que o código faz.

**Recomendações:**
- `varrer-envios.ts:25`: o exemplo "500 alvos de 10 s cada" não acontece de fato. O primeiro `apagar` que chega aos 10 s vira `FileStorageUnavailableError` e encerra a passada. O pior caso real é cada `apagar` levar pouco menos de 10 s. Trocar o texto para isso.
- O corte pelo `sinal` termina como `TEMPO_ESGOTADO`, e a `RETENTATIVA_DE_HOJE` repete a execução, que pode coincidir com a da hora seguinte. A sobreposição é tolerada (`skip locked` na linha, `apagar` e marca idempotentes), mas o caso de duas varreduras ao mesmo tempo continua sem teste. Já está no `TODO.md` como item do test-engineer.
- Se o storage ficar lento sem cair, o job estoura o prazo toda hora. Somar `duracaoMs` ao resumo (já no `TODO.md`) deixa isso visível sem depender do alerta de job que falhou de vez.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/system/job-definitions.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/2_task.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-12 16:13:59 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff r1→r2. Não havia correção exigida na rodada anterior.

Campos pessoais tocados: nenhum novo. O diff não mexe em schema nem migration. As mudanças são o corte da varredura pelo `sinal` e pelo storage fora do ar, testes mais rigorosos e textos.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Material da escola" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:101`) foi atualizada nesta rodada. Agora os prazos de 2 h e 26 h valem "com o storage no ar". Com o storage fora, o objeto fica até a primeira hora em que o `apagar` funcionar. A linha também registra o corte pelo prazo do job e o lote de 500. A tabela continua batendo com o comportamento do código.

Autorização por objeto: ok. Não há rota nova. Cada `apagar` continua rodando no contexto da escola do alvo (`naEscola`). As duas leituras `@Unscoped` continuam devolvendo só `(escolaId, materialId)`. A de `objetosQueSobraram` foi só simplificada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/varredura.repository.ts:47`).

Logs: limpos, e agora provados com mais rigor.
- O resumo `material.varredura` ganhou só o campo `estado` (`cortada`, `storage_fora` ou `completa`), que é um valor de lista fechada.
- O teste do log (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts:533-554`) passou de `arrayContaining`/`toMatchObject` para comparar o **conjunto exato de chaves** do aviso e do resumo. Uma chave nova com título, arquivo ou chave do objeto agora quebra o teste.
- O mesmo vale para os avisos `material.objeto_nao_apagado` e `material.envio_nao_apagado` da API (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-envio-orfao.int.test.ts:228,257`): as chaves exatas são `erro, escolaId, evento, materialId, usuarioId`, todos ids.
- `summarizeError` não leva a mensagem do erro. Confirmei em `packages/core/src/error/summarize-error.ts:49`.

Auditoria: presente onde a regra exige. A varredura é rotina técnica do sistema: não lê dado de aluno, não exporta, não altera nota, permissão nem saída de IA. Não há ato que exija registro, e isso não mudou.

Envio externo: nenhum. Não há IA nem chamada a terceiro. Só o storage próprio, que é privado.

Seed/fixture: sintético. Os casos novos usam `escolaNova()`, `envio()`, `material()` e `randomUUID()`.

Bloqueantes: nenhum.

Recomendações:
1. **Um único objeto travado pode parar a varredura de todas as escolas.** O `apagar` que passa de 10 s dispara `FileStorageUnavailableError`, que liga `storageFora` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:165`) e encerra as duas passadas. Os alvos saem sempre na mesma ordem (`criado_em` e `material.id`). Assim, um objeto que estoura o prazo toda vez, mesmo com o storage no ar, segura a fila de todas as escolas a cada hora. Nesse caso o prazo de 2 h/26 h de `docs/lgpd.md` deixa de valer sem que nada o declare. Hoje o PDF é material da escola, não dado de aluno, por isso não bloqueia. Isso se soma ao item do lote global que já está no `TODO.md`, e vale decidir os dois juntos com o Arquiteto: separar o estouro de prazo de cada alvo do storage fora de fato, ou pular o alvo que falhou.
2. **Texto de `docs/lgpd.md:101`.** "a varredura para no primeiro `apagar` que falha" é mais amplo que o código. Ela para só na indisponibilidade do storage, incluindo o estouro do prazo de 10 s. Recusa de outro tipo segue para o próximo alvo, como prova o caso do log. Vale ajustar a frase para dizer "storage indisponível ou prazo estourado".
3. **`summarizeError` grava as linhas da pilha (`pilha`) no log.** Não é dado pessoal e já era assim na 1ª rodada. Fica só registrado que essas linhas trazem caminhos de arquivo do servidor, caso o destino do log mude um dia.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-12 16:14:56 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: REPROVADO

Cenários exigidos (rodada 2, sobre o diff r1→r2):
- O corte do job: com o `sinal` já abortado, nenhum `apagar` é chamado nas duas passadas. Com o `sinal` abortando durante um `apagar` mudo, o job volta, a transação desfaz, a linha fica livre e nenhum outro alvo é tentado.
- O storage fora do ar para a passada no primeiro alvo, e a passada do objeto que sobrou também para.
- O `estado` do resumo (`cortada`, `storage_fora`, `completa`), e o log com o conjunto exato de chaves.
- A espera de 1 s menor que o `statement_timeout` da API.
- Continua valendo da rodada 1: a falha numa escola não segura as outras (`cenarios.md`, "Falha numa escola não para as outras", e a linha "falha numa escola" da tabela da `2_task.md`).

Cobertos: os quatro casos de "o corte do job e o storage fora do ar" (`varrer-envios.int.test.ts:439`, `:457`, `:483`, `:499`). Os blocos de mutação novos chegam à cláusula pelo motivo certo: o termo `sinal.aborted` e o termo `storageFora` do `||`, o `return` do `catch` (vira rejeição pelo `falhasTotal`), o listener (estoura a espera de 5 s), os dois ramos do `estado` e a espera de 2,5 s. O log compara as chaves por igualdade (`:533`, e `material-envio-orfao.int.test.ts` nos dois avisos). O nome de teste citado na linha do `@Unscoped` existe (`tools/guardas/repositories-com-escopo.test.ts:87`). Rodei `envio-de-material.repository.test.ts` e ficou verde. Não há `.skip` e o diff não chama provedor de IA.

Bloqueantes:
1. **O teste de "a falha numa escola não segura as outras" usa um erro que o storage de produção nunca lança, e por isso esconde que a regra deixou de valer.**
   - **O teste:** `apps/worker/test/varrer-envios.int.test.ts:281` (e o caso do log, `:432`, que o diff trocou de propósito para `new Error('armazém recusou')`) faz o armazém recusar com `new Error`.
   - **O código:** `packages/core/src/titular/s3-file-storage.ts:131-137` transforma **toda** falha do `DeleteObject` em `FileStorageUnavailableError` (403 numa chave, 5xx, prazo do SDK). O `apagarComPrazo` faz o mesmo quando estoura os 10 s (`varrer-envios.ts:98`). O código novo (`varrer-envios.ts:165` e `:172`) para as duas passadas no primeiro `FileStorageUnavailableError`.
   - **O efeito em produção:** uma única chave que falha sempre (403 na chave, ou um DELETE que sempre passa de 10 s) para a varredura de todas as escolas. As leituras são ordenadas por `criado_em` e por `id`, então esse alvo volta primeiro em toda hora, e o PDF das outras escolas fica no storage sem prazo. É o contrário do que dizem o `cenarios.md` ("Falha numa escola não para as outras"), a tabela de divergências da `2_task.md` ("a escola que falha não pode atrasar a outra") e o prazo de 2 h e 26 h do `docs/lgpd.md`.
   - **O teste não falharia:** se o código parasse em qualquer falha, o caso `:273` continuaria verde, porque só ele usa um erro que não para o laço.
   - **Correção exigida:**
     - Escrever o caso com duas escolas em que só a chave da A recusa com `FileStorageUnavailableError`, o erro real. Hoje ele fica vermelho.
     - Mudar o desenho para ele passar. Uma saída é distinguir "storage fora" de "chave que falha": parar só depois de N falhas seguidas em alvos de escolas diferentes, ou parar com um erro próprio de conexão, e tirar o estouro do prazo por chave de `storageFora`. Outra é registrar no `cenarios.md`, no `techspec.md` §11 e no `docs/lgpd.md` que uma chave com falha persistente segura todas as escolas, e provar isso em teste. Essa segunda opção é decisão do Arquiteto, porque contraria o RF13.
     - Nas duas saídas, o caso `:273` precisa usar o erro que o `S3FileStorage` lança de fato.

Recomendações:
- `varrer-envios.int.test.ts:467`: o `vi.waitFor` usa o prazo padrão de 1 s para a leitura, o `begin` e o `travarParada`. Passar `{ timeout: 5_000 }`, como as outras esperas do arquivo, para o caso não depender de máquina folgada.
- `varrer-envios.int.test.ts:483` e `:499`: afirmar também `enviosApagadosTotal: 0` e `objetosApagadosTotal: 0` no resumo, para fechar a contagem.
- `envio-de-material.repository.test.ts`: o teste lê `BANCO_TIMEOUT_CONSULTA_MS` do `.env.example`. Se o compose ou a produção sobrescreverem o valor em outro lugar, a comparação não vê. Vale citar de onde a produção lê o valor, ou ler a mesma constante.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/titular/s3-file-storage.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/2_task.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-12 19:47:35 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration desde a rodada 2. O diff r2→r3 não mexe em schema. Continuam valendo `envio_de_material` (`escolaId`, id UUID) e `material`, já auditadas.

Queries verificadas: nenhuma query mudou. As duas leituras `@Unscoped` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/varredura.repository.ts` (`enviosParados`, `objetosQueSobraram`) estão iguais e devolvem só a escola e o id. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:162-183`, cada `apagar` continua sendo feito dentro do contexto da escola do alvo (`naEscola`), com `EnvioDeMaterialRepository` e `ExtracaoDoMaterialRepository` aplicando o escopo. A lista `falhasDeStorageSeguidas` fica só em memória e não vai ao log: o resumo `material.varredura` (linhas 189-196) leva só contagens e o `estado`. Nenhum endpoint passou a receber `escolaId`.

Teste de isolamento: presente e efetivo. Os casos de isolamento das rodadas anteriores não mudaram: "duas escolas: cada `apagar` roda no contexto da sua…" e os de repository com a escola B no contexto da A. O caso "a falha numa escola não segura as outras" agora usa o `FileStorageUnavailableError`, que é o erro que o storage lança de fato, e ficou mais forte. O caso novo "uma chave que falha sempre, mesmo em vários alvos de uma escola só, não para as outras" quebra se a regra das duas escolas sair de `storageForaDepoisDe`: com três falhas da A, a execução pararia e a B não seria tentada, então `chamadas()` daria 3, e não 4.

Bloqueantes: nenhum

Recomendações:
- `varrer-envios.ts:83-85`: o critério novo impede que uma escola sozinha pare a varredura das outras. Mas duas escolas com chaves que falham sempre e que estão entre os alvos mais antigos (por exemplo A, B, A, sem alvo que passe no meio) disparam `storage_fora` toda hora e deixam o PDF das demais escolas no storage indefinidamente. É o mesmo assunto do lote global e da premissa de um storage único, que já estão no `TODO.md` com o Arquiteto como dono. Na decisão do lote, vale registrar também esse caso de duas escolas com defeito.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-12 19:47:42 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O novo critério de parada (3 `FileStorageUnavailableError` seguidos, em duas escolas ou mais, e o alvo que passa zera a conta) está registrado nos mesmos termos em `techspec.md` §7c e §11 (linha "2.0"), no `cenarios.md`, na tabela de divergências da `2_task.md` e na linha do material em `docs/lgpd.md`. O processador faz o que esses textos dizem.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O item 1 da ordem r2 foi feito pela primeira saída da ordem, que não precisava do Arquiteto:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts`, `storageForaDepoisDe` e o zerar da lista em `percorrer` separam o storage fora de uma chave com defeito. O estouro de 10 s do `apagarComPrazo` continua contando, mas em uma escola só nunca para a execução.
- O caso da linha ~281 e o caso do log agora usam o erro que a produção lança (`FileStorageUnavailableError`).
- Há casos novos para a chave que falha sempre numa escola, para o alvo que passa e zera a conta, e para a falha que não é do storage.
- Cada cláusula nova tem o seu bloco em "Mutações", e conferi à mão que cada um mata a mutação: o limite em 2 e em 4, sem a regra das duas escolas, sem o zerar, sem o `push`, e com `instanceof Error`.

As recomendações 2, 3 e 4 da ordem também foram aplicadas: o `waitFor` com 5 s, o resumo afirmando `enviosApagadosTotal: 0` e `objetosApagadosTotal: 0`, e o comentário que cita de onde vem o `statement_timeout`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts`, `storageForaDepoisDe`: a lista não reinicia quando a escola muda. Uma escola A com várias chaves que falham sempre, seguida na leitura por uma única falha numa escola B, já conta como "storage fora" (a, a, a, b). Se a falha da B também for persistente, as escolas que vêm depois na ordem de `criado_em` ficam paradas a cada hora. O critério está documentado e é o mesmo assunto do lote global que já está no `TODO.md` com o Arquiteto. Vale acrescentar o exemplo a esse item, ou contar escolas distintas em vez de falhas.
- No caso "o alvo que passa zera a conta" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts`), o laço repete o que o helper `enviosNaOrdem`, definido logo acima, já faz. Dá para usar o helper.
- No caso "falha que não é do storage", todos os envios usam o mesmo `RelogioMovel` sem avançar, então a ordem a, a, b, b do comentário não é a ordem da leitura. A asserção (`chamadas() === 4`) não depende da ordem, mas o comentário engana.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-12 19:47:42 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum novo. Esta rodada só muda quando a varredura considera o storage fora do ar. A lista nova `falhasDeStorageSeguidas` guarda apenas ids de escola, fica na memória da execução e não vai ao log nem ao banco (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:133-149`).

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Material da escola" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md` foi atualizada na mesma tarefa e descreve o código como ele está. A varredura para depois de 3 falhas de `apagar` seguidas em duas escolas ou mais. Uma chave que falha sempre não segura as outras escolas. O que passa do prazo do job fica para a próxima tentativa ou para a hora seguinte. O caso da escola com 500 alvos que ocupa o lote está declarado e tem item no `TODO.md`.

Autorização por objeto: ok. Nenhuma rota mudou. Cada `apagar` continua rodando no contexto da escola do alvo (`naEscola`, linha 131).

Logs: limpos. `material.varredura_nao_apagou` (linha 141) segue só com escolaId, materialId, origem e `summarizeError`. O resumo `material.varredura` (linhas 189-196) continua só com contagens e `estado`, e a lista de escolas não entrou nele.

Auditoria: presente onde a regra exige. A rodada não toca leitura de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. Não há chamada a provedor de IA nem envio a terceiro.

Seed/fixture: sintético. Os casos novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts` criam escolas com `escolaNova()` e ids aleatórios, e o armazém é falso (`armazemQueConta`, `recusa`).

Pergunta de fechamento: continua respondida. A mudança ajuda a apagar o PDF temporário a tempo. Antes, uma chave que falhava sempre parava a varredura de todas as escolas a cada hora. Agora o PDF das outras escolas sai no prazo descrito no `docs/lgpd.md`.

Bloqueantes: nenhum.

Recomendações:
- O PDF de uma escola cuja chave falha sempre continua sem prazo automático. Hoje o único sinal é o job falhando a cada hora. O alerta precisa separar "storage fora" de "chave com defeito" (item do revisor-geral já no `TODO.md`, dono o Arquiteto). Sem isso, a retenção prometida no `docs/lgpd.md` ("até 26 h com o storage no ar") pode estourar sem ninguém perceber.
- O critério de 3 falhas em duas escolas supõe um storage único para todas. Se um dia houver storage por escola ou por região, a linha do `docs/lgpd.md` sobre retenção do PDF precisa ser revista junto com o critério (item do tenancy-guardian já no `TODO.md`).

## infra-guardian · 3ª rodada · APROVADO · 2026-11-12 19:47:51 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Esta rodada mudou só o critério de parada por storage fora. Agora são 3 `FileStorageUnavailableError` seguidos, em duas escolas ou mais, e um alvo que passa zera a conta. Esse critério continua cortando a execução sem prender o pool de `lote` além do prazo do job: o `sinal` interrompe a execução nos 10 min e cada `apagar` tem prazo de 10 s. Sobre a ordem do test-engineer na rodada 2:
- **Separar storage fora de chave que falha sempre:** feito.
- **Testes:** os casos novos cobrem o limite, a regra das duas escolas, o zerar da conta e o erro que não é de storage. As mutações correspondentes estão registradas em `2_task.md`.
- **Ordem da leitura:** os testes dependem dela, e ela é determinística (`orderBy criadoEm, materialId` e `orderBy id` em `varredura.repository.ts:36` e `:51`).

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts:149`: hoje o alvo pulado zera `falhasDeStorageSeguidas`. Pulado é o caso em que `travarParada` devolve `false` e o storage nem foi chamado. Isso não prova que o storage está no ar. Zerar a conta só quando um `apagar` passou de fato deixa a detecção de storage fora mais fiel.
- Há um pior caso sem registro na carga da manhã: storage fora com alvos pendentes de uma escola só. A regra das duas escolas nunca dispara, e a execução gasta até 10 min por tentativa. São até 500 × 10 s, cada um com uma conexão de `lote` e uma transação aberta. Depois a fila repete o job. Não afeta a fila interativa, mas vale anotar esse caso no item do `TODO.md` sobre o lote global e o alerta que lê o `estado` do resumo (dono: o Arquiteto).
- Os quatro itens novos no `TODO.md` da rodada 2 (storage único, `pilha` no log, `if (aoAbortar)`, alerta pelo `estado`) estão bem encaminhados. Nenhum deles é bloqueante.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-12 19:47:52 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

Esta é a 3ª rodada. Auditei só o diff da árvore `800b510a` para a `f08b7b4a`, que o `.processo/ordens/2_task-diff-r2-r3.patch` descreve. Antes, conferi que os arquivos de código e o `docs/lgpd.md` na árvore de agora são iguais aos da `f08b7b4a`. Eu não tinha exigido nenhuma correção na 2ª rodada, que aprovei.

O diff mexe só no critério que faz a varredura de PDFs temporários parar quando o storage está fora do ar. Antes ela parava na primeira `FileStorageUnavailableError`; agora para depois de 3 falhas seguidas em duas escolas ou mais, e um alvo que passa zera a conta. O resto do diff são os testes desse critério, os comentários e o texto dos documentos (`docs/lgpd.md`, `techspec.md`, `cenarios.md`, `2_task.md`, `TODO.md`, `job-definitions.ts`). Nada disso chega a nota, saída de IA, tutor, autonomia de agente ou indicador de professor. Uma busca por `nota`, `lancadaPor`, `tutor`, `devolutiva` e `aprova` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts` não achou nada.

Caminhos de escrita em Nota: nenhum nesta tarefa nem neste diff — todos com autor humano? sim (não há nenhum)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (a tarefa não gera saída de IA; a varredura só apaga objetos do storage e a linha de `envio_de_material`)
Supervisão do tutor: ok (o diff não toca o tutor)
Autonomia declarada e visível: sim (o diff não toca agente nem governança; nada muda em relação à rodada anterior)
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70. A mudança é de operação e de LGPD (quanto tempo o PDF fica no storage), e o `infra-guardian` e o `privacy-guardian` já a cobrem. O texto novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md` registra o caso de uma escola com 500 alvos que falham sempre e ocupam o lote, e aponta o `TODO.md`. Isso está coerente com o código.

Nenhuma foto da tela veio nesta tarefa: ela não mexe em `apps/web`.

## test-engineer · 3ª rodada · APROVADO · 2026-11-12 19:48:21 · `tasks/prd-ingestao-do-material/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da rodada anterior. Esta rodada traz um cenário novo, exigido pela correção: a chave de uma escola só falha sempre com o erro real (`FileStorageUnavailableError`), e as outras escolas seguem. Vêm junto o limite de falhas seguidas que define "storage fora", a regra das duas escolas, o zerar da conta depois de um alvo que passa, e o erro que não é do storage não contar.

**Cobertos** (rodei `npx vitest run apps/worker/test/varrer-envios.int.test.ts`: 29 de 29 verdes):
- **Correção exigida, feita.** O caso novo "uma chave que falha sempre, mesmo em vários alvos de uma escola só, não para as outras" (`varrer-envios.int.test.ts:530`) monta a leitura `a, a, a, b` em ordem fixa por `criado_em` e usa o erro real. Ele exige 4 chamadas, a linha e o objeto da B apagados e o estado `completa`. Com o código da rodada 2, que parava no primeiro erro, ficaria com 1 chamada e ficaria vermelho. Com a mutação que tira a regra das duas escolas (`length >= 3`), ficaria com 3.
- **Os dois casos de "storage fora", o dos envios e o dos objetos (`:493`, `:512`).** Ambos usam o erro real e exigem `chamadas = FALHAS_SEGUIDAS_DO_STORAGE_FORA`. O resumo exige `falhasTotal: 3` e as duas contagens de apagados em zero. Com o limite mudado para 2 ou para 4, o caso falha pelo `falhasTotal`, como o documento diz.
- **O zerar da conta (`:563`, ordem `a, c, b, a`).** Sem o `length = 0`, a sequência guardada vira `[a, b, a]` e o resumo dá `storage_fora`, então o caso fica vermelho. A mutação `size >= 2` sozinha também deixa o caso vermelho.
- **O erro que não é do storage (`:549`).** Com `instanceof Error`, qualquer três primeiros de `{a, a, b, b}` cobrem duas escolas, e o caso para em 3 chamadas de forma determinística.
- **Os casos `:273` e o do log (`:601`) agora usam o erro real.** No do log há só 2 falhas, abaixo do limite de 3, e o caso afirma `estado: 'completa'`.
- **A tabela da `2_task.md`** cita cada caso pelo nome. Os nomes dos blocos de mutação são trechos dos nomes reais dos testes. `docs/lgpd.md`, `cenarios.md`, `techspec.md` e o comentário do `job-definitions.ts` dizem o mesmo que o código.
- **As recomendações da rodada 2 foram aplicadas:** o `vi.waitFor` ganhou `{ timeout: 5_000 }`; os casos de storage fora afirmam as contagens zeradas; o teste da espera de 1 s cita de onde vem o `BANCO_TIMEOUT_CONSULTA_MS`.
- Nenhum `.skip`, nenhum teste comentado. O armazém falso troca só o storage externo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`varrer-envios.int.test.ts:277-278`, o caso "a falha numa escola não segura as outras".** `idA` e `idB` nascem com o mesmo `criado_em`, e o desempate é pelo `material_id`, que é `randomUUID` (v4). Por isso, contra o código antigo, esse caso pegaria a falha só quando a A cai primeiro, ou seja, na metade das vezes. A prova determinística agora é o `:530`. Vale fixar a ordem também aqui, com `enviosNaOrdem([a, b], base)`.
2. **A conta de falhas atravessa as duas passadas** (`andamento.falhasDeStorageSeguidas` não zera entre a passada dos envios e a dos objetos). Exemplo: dois envios da A falham no fim da primeira passada e o primeiro objeto da B falha. A conta fica `[a, a, b]` e a passada dos objetos para inteira. Ou isso é intencional e fica escrito, ou a conta zera entre as passadas. Nos dois casos, falta um caso de teste.
3. **Resta um caso parecido com o bug corrigido, agora mais raro.** Três chaves com defeito permanente, de duas escolas, que fiquem seguidas no início da leitura, param a varredura de todas as escolas em toda hora, porque são sempre as mais antigas. Isso é do mesmo assunto do "lote global" que já está no `TODO.md` (dono: o Arquiteto). Vale citar o caso lá, e no `docs/lgpd.md`, que hoje garante só o caso de "uma escola só".
4. **O caso `:563` só se distingue pelo `estado` do resumo,** porque com ou sem o zerar ele faz 4 chamadas. Um quinto alvo, de qualquer escola, depois da sequência deixaria a prova também na contagem de chamadas.
5. **A linha pulada zera a conta como se o alvo tivesse passado** (`travarParada` devolve `false`, e o `try` termina sem erro), mesmo sem o storage ter sido consultado. É inofensivo hoje; vale um comentário.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/varrer-envios.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/varrer-envios.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/2_task.md`
