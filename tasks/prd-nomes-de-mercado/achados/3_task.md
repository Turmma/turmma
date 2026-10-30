# Achados das revisões — `tasks/prd-nomes-de-mercado/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 16:45:37 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A fila, o limite, a sala e o erro global só mudaram de nome de símbolo. Nenhum valor que roda em produção mudou.
Rate limit: ok. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/limite/guarda-limite.ts` só mudaram os nomes `ErrorCode` e `InvariantException`. Os baldes por usuário, por escola e por operador estão iguais.
Fila e prioridade: ok. Os valores de `QUEUE_NAMES` (`interativa`, `normal`, `lote`) são os mesmos de antes. Também não mudaram:
- as constantes `TIPO_*`, a fila, a retentativa, o `prazoMs` e o `naoUrgente` de cada tipo em `job-definitions.ts`;
- a chave Redis `vaga:${fila}:${escolaId}`;
- o prefixo `api-` de `nomeDaFilaBullMQ`;
- a variável de ambiente `FILAS` que o worker lê, em `apps/worker/src/config.ts:28`.
Concorrência: protegida. Não há lógica nova, só a troca de identificador.
Índice e paginação: ok. Não há query nova. `paginacao.ts` passou a `pagination.ts` sem mudar o conteúdo.
Degradação de IA: não se aplica.
Migration: não se aplica. Nenhum arquivo de schema, SQL ou drizzle foi alterado.
Métrica e alerta: ok. Comparei todos os literais de string alterados no diff. Só mudaram três tipos:
- caminhos de import;
- nomes de schema dentro dos testes de contrato e das guardas;
- o `this.name` da classe.
Nenhum nome de métrica, chave Redis, namespace do realtime (`/sistema`), `REALTIME_PATH`, código de erro ou tipo de job mudou. `infra/grafana/alertas/`, `docs/runbook.md` e `infra/k6/` não filtram por `ErroDeInvariante` nem importam `@educa/shared`. Em `infra/`, o único arquivo alterado é `infra/test/borda.int.test.ts`, só com troca de identificador.
Bloqueantes: nenhum.
Recomendações:
- O nome da classe que vai no log do erro interno passou de `ErroDeInvariante` para `InvariantException`, como mostra o `this.name` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/errors/invariant.exception.ts`. Nenhum alerta depende disso hoje. Quem buscar nos logs pelo nome antigo depois do deploy não acha nada. Vale uma linha na nota do pouso ou no `docs/runbook.md`, junto com as classes `…Error` das ondas 4.0 e 5.0, que vão mudar o log do mesmo jeito.
- O cenário de carga (`infra/k6/`, `infra/compose.carga.yml`) não precisou de atualização, porque o comportamento não mudou. Vale rodar o `infra/test/borda.int.test.ts` (duas APIs e dois realtimes) na esteira antes do merge, já que ele importa três dos símbolos renomeados.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-30 16:45:51 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: a tarefa não cria tabela nem migration. Os 8 arquivos alterados em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/db/schema/` (`artefato`, `consumo-ia`, `correcao`, `execucao-agente`, `mensagem-agente`, `resumo-do-analista`, `validacao-do-lote`, `mvp/tabelas-do-mvp.int.test.ts`) só mudam o tipo em `$type<...>`, os imports e os comentários. Nenhuma coluna, `escolaId`, `anoLetivoId`, check ou tipo de id mudou.

Queries verificadas: as 32 `*.repository.ts` alteradas, mais controllers e services de `apps/api`, `apps/worker`, `apps/despachante` e `apps/realtime`. Para conferir, apliquei o mapa `tools/renomear/mapas/3.json` (484 símbolos, 15 arquivos, 2 pastas) à versão do `HEAD` de cada um dos 641 arquivos e comparei o resultado com a árvore atual:
- **Repositories:** nenhuma linha de `where`, `eq(` ou `and(` mudou além do nome do símbolo.
- **Diferenças que sobram:** só três tipos, e nenhum mexe em escopo.
  - As travas previstas na 3.3 (`contratos.test.ts`: o filtro `endsWith('ResponseSchema')` e a fixture).
  - As strings que ficaram como estavam, como era exigido (rotas `/v1/sistema/...`, "Fila" no texto, títulos de caso, a variável `FILAS`).
  - Os caminhos de import dos arquivos renomeados.
- **`@SemEscopo()`:** nenhuma linha com ele mudou.
- **Corpo e query string:** nenhum endpoint passou a aceitar `escolaId` por eles. O caso `GET /v1/sistema/contexto?escolaId=...` de `apps/api/test/contexto.int.test.ts` continua igual.
- **Colisão de nomes:** nenhum `para` aparece duas vezes no mapa. Os quatro nomes novos que já existiam no `HEAD` (`ErrorResponse`, `InvariantException`, `turmaSchema`, `avisosResponseSchema`) existiam só em comentário ou em fixture de `tools/renomear/`, então nenhum import passou a apontar para outro schema.
- **Varredura de `contratos.test.ts`:** cobre o mesmo conjunto. São 97 `esquemaResposta*` no `HEAD` e, depois do mapa, os mesmos 97 `*ResponseSchema` na árvore, nome a nome.

Teste de isolamento: presente e efetivo. Não há módulo novo, então não cabia teste novo. Os testes de isolamento que já existiam (`atividade-isolamento.int.test.ts`, `contexto.int.test.ts`, `acesso-da-turma`, entre outros) mudaram só no nome dos símbolos, e cada um continua quebrando se a cláusula de escopo sair do repository.

Bloqueantes: nenhum

Recomendações:
- `tools/renomear/mapas/` (`3.json` e `3.relatorio.md`) ainda não está rastreado no git. Ele está nos arquivos previstos e é a entrada do `conferir` e do `restos`, então precisa entrar no commit da tarefa.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 16:46:16 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Não existe tabela nem classe `Nota` nesta fatia (D46, `packages/nucleo/src/db/schema/correcao.ts:13`). A tarefa não cria nem altera caminho de escrita: no `correcao.ts` e no `validacao-do-lote.ts` só mudou o nome de schema citado em comentário. Todos com autor humano? sim, porque não há nenhum.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Em `entrega`, `correcao`/`lote` e `artefato` só os símbolos importados do `shared` mudaram, e os testes de `entrega.int.test.ts` e `artefato.int.test.ts` mudaram só nos nomes importados.
Supervisão do tutor: ok. Em `tutor.service.ts`, `supervisao.service.ts`, `tutor.controller.ts` e `tutor.int.test.ts` a mudança é só nos nomes dos DTOs e schemas.
Autonomia declarada e visível: sim. Os textos de `packages/shared/src/governanca/governanca.ts` não mudaram. Os nomes `*DaGovernanca*` passaram para `*Schema`/`*Response` e as chaves do JSON ficaram.

Como conferi:
- **Strings literais.** Comparei as do diff inteiro, antes e depois, fora os caminhos de import. Todas as diferenças são nomes de símbolo do mapa: em comentário, no rótulo do `contratos.test.ts`, no `this.name` e nas mensagens da guarda de erro. Nenhum texto de tela, nenhum texto de governança e nenhuma chave de JSON mudou.
- **Identificadores, arquivo por arquivo.** Contei os identificadores do arquivo antigo, já passado pelo mapa 3, e os do novo. Sobram 12 arquivos com diferença, e todas têm explicação: "Fila" como palavra comum, título de caso que fica em português (RF6), a troca de `startsWith` por `endsWith` prevista na trava, e um tipo local `PedidoSemCorpo` em `apps/api/src/sala/acesso-da-turma/acesso-da-turma.controller.ts:9`, que não é o símbolo do `shared`.
- **Testes.** Nenhum `it`, `test` ou `describe` saiu ou entrou. As linhas com `expect(` são 923 removidas e 923 adicionadas. Não apareceu `.skip`, `.only` nem `.todo`.
- **Documentos e caminhos.** `docs/regulacao.md`, `.claude/rules/70-conformidade-cne.md` e `docs/agentes.md` não mudaram. Os caminhos de teste citados nas checagens da regra 70 e em `regulacao.md` continuam existindo.
- **Itens 7, 8 e 9.** Não há campo, tela, métrica de professor ou sinal novo. Pelos itens 2a e 8 nada mudou.
- **Fotos da tela.** O prompt não trouxe, e a tarefa não tem tela nova.

Bloqueantes: nenhum.

Recomendações:
- O tipo local `PedidoSemCorpo` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/sala/acesso-da-turma/acesso-da-turma.controller.ts:9` tem o mesmo nome de um símbolo do mapa (`EmptyBodyRequest`). Não é uso do `shared` e não afeta a regra 70, mas vale o `revisor-geral` decidir se ele acompanha o nome de mercado na onda dos apps, para o `restos` não confundir os dois.
- O mapa usado na conferência está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/3.json`, e ainda não está no git.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 16:47:36 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só troca nomes de símbolo (schemas zod, tipos Request/Response, `ErrorCode`, `InvariantException`, as definições de job) e move as pastas `errors/` e `system/`. As chaves do JSON, as colunas do banco (`codigoDeErro: text().$type<ErrorCode>()` continua `codigo_de_erro`), as rotas (`/v1/sistema/...`), os códigos de erro e as filas ficaram como estavam. Não há migration nova.

Fora da tabela de dados do docs/lgpd.md: nenhum campo novo. `docs/lgpd.md` não foi alterado, e não precisava.

Autorização por objeto: ok. Os controllers só trocaram nomes de tipo, com o mesmo `IdPipe` e o mesmo `ZodValidationPipe` (por exemplo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/sala/acesso-da-turma/acesso-da-turma.controller.ts`). A lógica de escopo não mudou.

Logs: limpos. As chaves de `CHAVES_PESSOAIS` e a lógica de `tools/guardas/regras-log.mjs` não mudaram. O único texto que muda no rastro é o `erro.tipo` do log, que passa a ser `'InvariantException'`. É nome de classe, não dado pessoal.

Auditoria: presente, sem mudança. Nenhuma ação auditável foi criada ou alterada.

Envio externo: nenhum envio novo. Os payloads de job continuam presos à regra 20, item 9: `tools/guardas/definicoes-de-job.test.ts` passou com `JOB_DEFINITIONS`.

Seed/fixture: sintético. As fixtures do e2e só trocaram nomes de tipo.

O que eu rodei e conferi:
- **`conferir`**: verde (209394 itens, nenhuma diferença que o mapa não explique). As 52 exceções do mapa caem todas em teste ou em guarda: `contratos.test.ts`, `erro.int.test.ts`, `invariant.exception(.test).ts` e as mensagens de `regras-erro.mjs`. Nenhuma toca corpo de resposta nem texto de log.
- **`restos`**: limpo.
- **Comparação própria**: peguei o conteúdo do `HEAD`, apliquei o mapa e comparei com a árvore. Sobraram 16 arquivos, e conferi cada um no diff: são títulos de caso mantidos de propósito (RF6), "Fila" como palavra do português e imports. Não há mudança de lógica.
- **Varredura do contrato de saída (regra 20, item 4)**: são 97 `esquemaResposta*` no mapa e todos foram para `*ResponseSchema`. Nenhum `*ResponseSchema` novo veio de outro nome, e a árvore tem 97 `export const *ResponseSchema`. O conjunto varrido é o mesmo. A fixture com `email` continua reprovada, e a exceção do `segredo` segue restrita ao contrato do configurar.
- **Erro tipado (regra 20, item 11)**: `NOME_DA_CLASSE_DE_INVARIANTE = 'InvariantException'` acompanha o `this.name`, e as fixtures `reprova:` usam o nome novo. A troca para `InvariantException` não afrouxa o `not.toContain('Error')` da linha 150 de `erro.int.test.ts`, porque a linha 166 testa o nome novo explicitamente.
- **Testes**: na unidade passaram 268 de 268 (`contratos.test.ts`, `packages/shared/src/errors`, `tools/guardas/guardas.test.ts`, `tools/guardas/definicoes-de-job.test.ts`, `documento-na-matricula.test.ts`, `matriz.test.ts`). Na integração, `apps/api/test/erro.int.test.ts` passou 10 de 10.
- **Mutações**: não rodei. Elas exigem editar arquivo, e eu só audito. Pela leitura, os blocos da tarefa são coerentes com cada trava.

Pergunta de fechamento: a resposta não muda com esta tarefa. Ela não mexe em mapa de dados, auditoria, arquivo do titular nem lista de compartilhamento.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/ia/README.md:50` ainda cita `CodigoDeErro`. Vale trocar por `ErrorCode` na passada de docs.
- Alguns títulos de caso ainda dizem `ErroDeInvariante`: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts:160`, `packages/shared/src/errors/invariant.exception.test.ts:4,13`, `packages/nucleo/src/auditoria/acoes.test.ts:14`, `tools/guardas/guardas.test.ts:419,430` e `apps/web/src/areas/professor/ferramentas/ferramentas.test.ts:206`. Manter foi decisão de RF6. Se a retro quiser o nome do símbolo no título, fica para uma onda de texto.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-30 16:47:59 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: ok
Portão local: carimbo válido

**Conferências que fiz.** O `conferir` e o `restos` rodaram de novo sobre a árvore atual e saíram verdes: 209394 itens, nenhuma diferença que o mapa não explique, e nenhum nome antigo sobrou. O mapa só tem peças de `packages/shared`, e cobre todas as linhas com "Onde" em `shared/` de `inventario-core-shared.md` (§2 a §17) e de `inventario-adenda-2.md`. Não achei `any`, `TODO`, `.skip` nem `.only` novos no diff.

**Bloqueantes:**

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/3.json`: um pedaço da subtarefa 3.3 não foi feito, e ela está marcada como feita.**
   - **O que foi pedido.** O `3_task.md` (subtarefa 3.3) e o `travas.md:54` dizem a mesma coisa: o `not.toContain('Error')` da linha 150 de `apps/api/test/erro.int.test.ts` fica mais estrito com as classes `…Error` das ondas seguintes (`LLMError`, `JobRequestRejectedError`), "e isso vai para o mapa" ("o mapa da 3.0 o registra").
   - **O que foi feito.** O mapa não tem nenhuma entrada sobre essa linha: nada em `ocorrencias`, nada em `excecoesDoConferir`, e o relatório também não cita. O registro foi parar só no texto do `3_task.md` ("esta onda só o registra"). O lugar mudou sem ninguém decidir.
   - **Correção exigida.** Pôr a linha 150 no mapa como `trava`, com a linha `travas.md:54` e um `trecho` que pegue só ela. Exemplo: `{"arquivo":"apps/api/test/erro.int.test.ts","de":"Error","classe":"trava","linha":"travas.md:54","trecho":"'.ts:', 'Error'"}`. A entrada não muda o resultado do `aplicar`, do `restos` nem do `conferir`. Depois, rodar o portão de novo, porque o mapa muda o carimbo. Se o Arquiteto preferir deixar o registro no documento da tarefa, o `travas.md:54` e a 3.3 precisam ser corrigidos por ele, não pelo Implementador.

**Recomendações:**

- **A divergência do §4 foi decidida e registrada pelo próprio Implementador.** São as 26 linhas de Fila, 158 a 183, que entraram no mapa 3. Ele também editou o "Contexto necessário" do `3_task.md` para acomodar a mudança, sem mandar `DIVERGÊNCIA`, ao contrário do que fez com `tools/ci/borda.test.ts`. O mérito está certo: são peças de `packages/shared`, o objetivo da 3.0 diz "todas as peças" e a tabela de ondas da Tech Spec dá a 3.0 ao shared. Sem isso, nenhuma onda as pegaria. Ainda assim, vale o Arquiteto ratificar a decisão, que passa a valer também para a 4.0.
- No `3_task.md`, seção "Mutações", o texto diz "que entraram com a divergência abaixo", mas a divergência está acima.
- O relatório marca como `fica` as rotas `/v1/sistema/...` e o `apps/realtime/src/sistema.gateway.js`, porque casam com o trecho "sistema/". Estão certas, porque são strings de rota e um arquivo da 6.0. O rótulo `packages/shared/src/sistema/...` na coluna "Nome" engana quem lê; se a ferramenta mostrar o texto achado em vez do caminho, fica mais claro.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 16:51:16 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** `conferir` (RF7); `restos` (RF3); esteira; `{ esquemaX }` (a chave fica e o DTO de saída é o mesmo); `PedidoDoTitular` e a "Resposta" do aluno ficam; `NOME_DA_CLASSE_DE_INVARIANTE`, forma A; `contratos.test.ts`, forma A, nos três pontos (o filtro, a lista de nomes e as chaves de `EXCECOES_NOMINAIS`); `erro.int.test.ts:169` e `invariant.exception.test.ts:10`, forma A; `erro.int.test.ts:166`, forma B. Concorrência e isolamento não se aplicam: é rename sem mudança de comportamento, e os testes de isolamento rodaram no alvo do portão.

**Cobertos:**
- **Guarda de erro tipado.** A mutação de `regras-erro.mjs` tira a reprovação das linhas `new InvariantException(\`…${valor}\`)` da fixture `erro-sem-tipo.ts`. O caso de `guardas.test.ts:419` fica vermelho pelo motivo certo.
- **Contratos, filtro e lista.** `startsWith('esquemaResposta')` esvazia a varredura e a linha 93 fica vermelha. A lista antiga também quebra a linha 93.
- **Contratos, chave `configurarMfaResponseSchema`.** Revertida, a linha 106 fica vermelha.
- **Conjunto varrido.** Conferi por conta própria. O HEAD tem 97 `esquemaResposta*` e a árvore tem 97 `*ResponseSchema`, com o mesmo conjunto quando passo os nomes pelo mapa. O `index.ts` exporta os 97 nos dois. A fixture com `email` continua reprovada (linha 128 do teste).
- **`this.name`.** O `resumirErro` usa `erro.name` (`resumir-erro.ts:63`), então a forma A deixa `erro.int.test.ts:169` e `invariant.exception.test.ts:10` vermelhos pelo motivo certo.
- **`{ esquemaX }`.** A forma curta é coberta pelo caso de `conferir.test.ts:71`.
- **`PedidoDoTitular`.** Fica em `titular.ts:215`.
- **Higiene.** Sem `.skip`, `.only` ou teste comentado no diff. Os 3 casos "removidos" são só a mudança de pasta de `synthetic-jobs.test.ts`, com os mesmos casos.
- **Testes rodados.** `contratos.test.ts`, `invariant.exception.test.ts` e `guardas.test.ts` passam: 211 casos.

**Bloqueantes:**

1. **A forma B fica vermelha pelo motivo errado** (`apps/api/test/erro.int.test.ts:164` e `:166`; `3_task.md:166-171`; `travas.md:54`).
   - A mutação põe `excecao.name` na `mensagem` do corpo. Quem quebra é a linha 164 (`esperarEnvelopeSemVazamento`), que exige `mensagem: MENSAGENS_DE_ERRO[codigo]` com `toEqual` estrito. A linha 166 nem chega a rodar.
   - Se a 166 tivesse ficado com o nome antigo, `not.toContain('ErroDeInvariante')`, o bloco continuaria vermelho. Ele não prova a cláusula que diz provar. E o envelope estrito impede qualquer mutação que vaze o nome no corpo e passe pela 164.
   - O `travas.md:54` diz que o filtro "deixa a 166 vermelha", e isso é falso.
   - Correção exigida, uma das duas:
     - (a) Reescrever o bloco e a linha 54 do `travas.md`: a forma B prova o envelope da 164, a 166 é redundante com ele, e quem garante o rename dela é o `restos`/`conferir`.
     - (b) Pôr as duas linhas `not.toContain` (165 e 166) antes de `esperarEnvelopeSemVazamento`, para a mutação parar na 166.

2. **Falta o bloco da segunda chave de `EXCECOES_NOMINAIS`** (`apps/api/test/contratos.test.ts:33`).
   - A trava (`travas.md:53`) é "as chaves", e o diff troca duas. Só `configurarMfaResponseSchema` tem bloco.
   - Correção exigida: um bloco que volta `configurarSegundoFatorDeOperadorResponseSchema` para `esquemaRespostaConfigurarSegundoFatorDeOperador`, citando `contratos.test.ts › nenhum contrato de resposta exportado tem campo proibido`.

3. **A "Resposta" do aluno não ficou** (`packages/shared/src/atividade/prova.ts:79-80`; `tools/renomear/mapas/3.json`; `inventario-core-shared.md:585` e `:601`).
   - `esquemaRespostaSalva`/`RespostaSalva` passaram a `salvaResponseSchema`/`SalvaResponse`. É, palavra por palavra, "a resposta que o aluno já salvou" (comentário da linha 78), usada em `provaResponseSchema.respostas`. O glossário define: "Resposta — O que o aluno respondeu em um item".
   - O cenário da tabela ("o 'Resposta' do aluno fica") está violado. Além disso, o `restos` não pode provar um "fica": ele só confere os `de` do mapa.
   - Correção exigida:
     - Divergência do Arquiteto, nos moldes da regra do próprio inventário na linha 465: `RespostaSalva` fica e só o schema ganha sufixo, como `respostaSalvaSchema`. Corrigir as linhas 585 e 601 do inventário e o mapa.
     - Registrar que o schema sai do `endsWith('ResponseSchema')` (96 na varredura), com os campos ainda varridos por dentro de `provaResponseSchema`.
     - Na linha da tabela, citar uma conferência concreta: a busca na árvore que mostra `PedidoDoTitular` e `RespostaSalva` presentes.

**Recomendações:**
- O item 3.3 e o `travas.md:54` dizem que o `not.toContain('Error')` da linha 150 "vai para o mapa", mas o `mapas/3.json` não o registra. Ou o registro entra, ou o texto sai do documento. Na prática a linha já cobre `LLMError` e `JobRequestRejectedError`, porque `'Error'` é substring dos dois nomes.
- Juntar ao documento a saída atual do `conferir` e do `restos`. As que estão em `.processo/` (`conferir2.txt`, `restos1.txt`) são das 13h45, e o `restos1.txt` ainda lista 17 sobras.
- A igualdade do conjunto varrido (97 = 97, nome a nome) hoje é prova manual do documento. Vale dizer isso na linha da tabela, que fala em "mutação".

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/contratos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/atividade/prova.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/3.json

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-30 18:06:33 · `tasks/prd-nomes-de-mercado/3_task.md`

**VEREDITO: APROVADO**

**Campos pessoais tocados:** nenhum. Esta rodada só muda nomes de tipo e de schema. `RespostaSalva` continua com os mesmos campos `questao`, `alternativa` e `sequencia`, sem nenhum identificador de pessoa. `RespostaAProposta` só mudou de nome. Nenhuma migration, nenhuma coluna nova.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. Nenhuma rota, repository ou query mudou nesta rodada.

**Logs:** limpos. `apps/api/test/erro.int.test.ts` continua cobrando que o log não tenha `MOTIVO_DA_INVARIANTE` e que o `erro.tipo` traga só o nome da classe.

**Auditoria:** presente. Nenhuma ação que a regra 20, item 10, obriga a auditar foi tocada.

**Envio externo:** nenhum novo. Nada mudou em porta de IA nem em `ExecucaoAgente`.

**Seed/fixture:** sintético. Nenhum seed ou fixture mudou.

**O que conferi nas mudanças desta rodada, pela regra 20:**

1. **Erro sem stack e sem dado no corpo (item 11).** Em `erro.int.test.ts:166-168` as verificações mudaram de ordem: os dois `not.toContain` agora rodam antes de `esperarEnvelopeSemVazamento`. O teste ficou mais forte, porque um filtro que vaze o nome da classe no corpo agora falha na linha que olha o nome, e não na comparação do envelope. A linha 150 (`'.ts:', 'Error'`) não mudou e agora está registrada como `trava` no `3.json`.
2. **DTO de saída (item 4), pela varredura de `apps/api/test/contratos.test.ts`.** Com o nome novo, `respostaSalvaSchema`, o schema deixa de entrar no filtro `endsWith('ResponseSchema')`, e a varredura passa a pegar 96 schemas em vez de 97. Isso não abre buraco, por três motivos:
   - `camposDoEsquema` desce em arrays (`case 'array'`), e o schema é usado em `provaResponseSchema.respostas` (`packages/shared/src/atividade/prova.ts:115`). Os campos dele continuam sendo varridos ali dentro.
   - Nenhuma resposta da `apps/api/src` usa `respostaSalvaSchema` sozinho: busquei e só aparece em `prova.ts` e no `index.ts`.
   - Rodei `test/contratos.test.ts` e passou: 5 de 5.
3. **Segunda chave de `EXCECOES_NOMINAIS`.** A mutação descrita no `3_task.md` está certa: com `configurarSegundoFatorDeOperadorResponseSchema` de volta ao nome antigo, a exceção do segredo deixa de valer e a varredura reprova o campo `segredo`. Além disso, a última linha do teste (`expect(EXCECOES_NOMINAIS).toEqual(...)`) prende as duas chaves pelo nome novo.
4. **Mapa e inventário.** O `3.json` perdeu as duas entradas e ficou com 499, o mesmo número do relatório. As linhas 521 e 585 do inventário estão marcadas "fica (domínio)", e `travas.md:53` registra a saída do filtro. O texto bate com o código.

**Pergunta de fechamento:** um rename de símbolo não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. O que o código já respondia continua respondendo do mesmo jeito.

**Bloqueantes:** nenhum.

**Recomendações:**
- O `3.relatorio.md` gerado pelo `aplicar` foi corrigido à mão para 499 entradas (482 símbolos). Para o relatório continuar sendo saída da ferramenta, convém rodar o `aplicar` de novo com o mapa final antes do pouso, em vez de deixar a contagem editada à mão.
- Rodei só `contratos.test.ts`. Não rodei `erro.int.test.ts` neste checkout, porque é teste de integração e precisa da infra. Vale confirmar que ele passa no portão.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/3_task-diff-r2-limpo.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/contratos.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/atividade/prova.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-30 18:06:36 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou desde a minha rodada aprovada. A rodada nova só troca nomes no `shared`, ajusta o mapa e muda a ordem das linhas de um teste de erro. Nenhum serviço, repository, job, seed ou webhook que grava `Nota` foi tocado. Todos com autor humano? sim, como já estava na 1ª rodada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok. O diff desta rodada não toca nenhum arquivo do tutor.
Autonomia declarada e visível: sim. O diff desta rodada não toca governança nem as telas da coordenação.

Bloqueantes: nenhum

Recomendações: nenhuma nova.

**O que auditei (só o que mudou, `e58aee48..1f78d792`, sem a correção do runbook que veio no merge):**

- **`RespostaSalva` e `respostaSalvaSchema`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/atividade/prova.ts:79-80`). Guardam a alternativa que o aluno marcou na objetiva, com `questao`, `alternativa` e `sequencia`. Não têm nota, pontuação, correção nem nada gerado por IA, e não tocam discursiva nem redação (item 2a, D55). O nome é só de domínio e não tem efeito na regra 70.
- **`RespostaAProposta`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/assistente/conversa.ts:65`). É o tipo da resposta do professor quando o Assistente propõe uma ferramenta, e hoje só aceita `'so_conversar'`. Não muda nenhum fluxo de aprovação, e a entrega do agente continua nascendo pendente (item 3).
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/areas/aluno/respostas.ts` e `fila-de-respostas.ts`.** Só voltaram a importar o tipo pelo nome de domínio. A fila que guarda a resposta de prova não mudou de comportamento.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts:164-168`.** Só mudou a ordem das linhas: os dois `not.toContain` agora vêm antes do teste do envelope. Não afeta conformidade.
- **`tools/renomear/mapas/3.json`, `3.relatorio.md`, o inventário e o `travas.md`.** Saíram duas entradas do mapa, `esquemaRespostaSalva` passou a se chamar `respostaSalvaSchema` e entrou a trava da linha 150. Nada disso trata de nota, tutor, autonomia ou indicador de professor.
- **Busca na árvore:** `SalvaResponse`, `salvaResponseSchema` e `APropostaResponse` não aparecem mais em `apps`, `packages`, `e2e` nem `tools`.

**Correções exigidas na rodada anterior:** nenhuma era minha. As do revisor-geral e do test-engineer (a trava da linha 150, a ordem das linhas da forma B, a mutação da segunda chave de `EXCECOES_NOMINAIS` e a volta de `RespostaSalva`) aparecem feitas no diff. Quem confirma se ficaram certas são eles.

Nesta rodada não houve fotos da tela, porque a tarefa não mexe em tela.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 18:07:02 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (só nome de tipo no cliente da fila de respostas; o formato do payload e a fila não mudaram)
Rate limit: ok (o diff não toca limitador)
Fila e prioridade: ok (o diff não toca fila)
Concorrência: protegida (o diff não muda comportamento; `adotarLeitura` e a fila de respostas ficaram iguais, só o tipo foi renomeado de volta)
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código novo no caminho quente. Os alertas do Grafana e a guarda `alerta-tem-runbook` vieram do merge da correção `2026-10-29-links-do-runbook` e ficaram fora do escopo)
Bloqueantes: nenhum
Recomendações:
- O `packages/shared/dist/` ainda traz os nomes antigos em `.d.ts` gerado. Não bloqueia porque é build. Vale regerar antes da esteira, para nenhum consumidor resolver tipo velho.

O que conferi nesta rodada:
- **Correção 3 do test-engineer.** Não sobrou `SalvaResponse`, `salvaResponseSchema` nem `APropostaResponse` em `apps/`, `packages/`, `e2e/` e `tools/` fora do `dist/`. Os nomes do domínio (`RespostaSalva`, `respostaSalvaSchema`, `RespostaAProposta`) estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/atividade/prova.ts:79-80,115`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/assistente/conversa.ts:58` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/shared/src/index.ts:643,660`. O schema continua `strictObject` com `questao`, `alternativa` e `sequencia`, então o contrato do salvamento por item ficou igual. O typecheck do `apps/web` passou sem erro.
- **Mapa `3.json`.** As duas entradas de símbolo saíram, `esquemaRespostaSalva` agora vira `respostaSalvaSchema`, e entrou a trava `apps/api/test/erro.int.test.ts` com `travas.md:54` (correção do revisor-geral). As contagens do `3.relatorio.md` (499 entradas e 482 símbolos) batem com as duas remoções.
- **Correção 1 do test-engineer.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts:161-168`, as checagens do nome da classe e do motivo agora vêm antes da comparação do envelope. Mudou só a ordem das linhas do teste, sem efeito em carga.
- **Correção 2 do test-engineer** (o bloco de mutação de `configurarSegundoFatorDeOperadorResponseSchema`). Esse bloco não aparece na parte de código do diff que recebi e eu não o procurei, então fica com o test-engineer. O item não tem efeito em carga.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 18:07:32 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A triagem do Arquiteto (`efd23674`) está registrada nos lugares certos: `inventario-core-shared.md` (linhas 122, 462, 521, 585 e 601), `travas.md:53` e "Divergências resolvidas" do `3_task.md`. Ela mantém `RespostaSalva` e `RespostaAProposta` com o nome atual por serem domínio e confirma as linhas 158 a 183 do §4 na 3.0. A spec não tem `cenarios.md`. O `casos.md` só fala da forma `startsWith('esquemaResposta')`/`endsWith`, e a mudança não o contradiz.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

A correção exigida na rodada 1 foi feita. `tools/renomear/mapas/3.json` agora traz a entrada `trava` para `apps/api/test/erro.int.test.ts`, com `de: "Error"`, `linha: "travas.md:54"` e `trecho: "'.ts:', 'Error'"`. Conferi que `tools/renomear/referencias.ts:188` filtra pelo `trecho`, então a entrada pega só a linha do `for (const proibido of [...])`, que hoje é a 149. O carimbo foi refeito depois da mudança no mapa.

As mudanças desta rodada também batem:
- `erro.int.test.ts:163-167`: os dois `not.toContain` agora vêm antes de `esperarEnvelopeSemVazamento`, e a forma B volta a cair na linha do nome.
- `contratos.test.ts:133`: as duas chaves de `EXCECOES_NOMINAIS` estão no `toEqual`.
- A mutação da segunda chave está registrada no `3_task.md`.
- `RespostaSalva` e `respostaSalvaSchema` estão em uso coerente em `prova.ts`, `index.ts`, `respostas.ts` e `fila-de-respostas.ts`, e nenhum dos nomes que saíram do mapa (`SalvaResponse`, `APropostaResponse`, `salvaResponseSchema`) sobrou no código.
- A palavra "abaixo" foi trocada por "acima".

Recomendações:
- A linha de contagem de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/3.relatorio.md` (499 entradas, 482 símbolos) foi corrigida à mão, mas o corpo do relatório ainda é o do `aplicar` com 501 entradas. O `3_task.md` avisa disso. Ainda assim, um relatório gerado e depois editado à mão engana quem o lê depois. O melhor é gerá-lo de novo pelo `aplicar`/`relatorio` com o mapa atual, ou anotar no próprio relatório que a linha foi editada.
- O comentário que entrou em `apps/api/test/erro.int.test.ts:163-164` explica por que a ordem das linhas importa. Vale manter, mas pode ficar em uma linha só.
- Continua aberto o rótulo do `restos`, que mostra `packages/shared/src/sistema/...` para rotas `/v1/sistema/...`. O destino já registrado é o `TODO.md`.

## test-engineer · 2ª rodada · REPROVADO · 2026-10-30 18:08:13 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** esta é a 2ª rodada, então auditei o diff `e58aee48..1f78d792` e o que ele afeta. Conferi:
1. A forma B de `erro.int.test.ts` fica vermelha pelo motivo certo.
2. A segunda chave de `EXCECOES_NOMINAIS` tem bloco de mutação.
3. `RespostaSalva` e `RespostaAProposta` ficam, e só o schema ganha sufixo, com a varredura registrada.
4. As três recomendações que a ordem mandou aplicar foram aplicadas.
5. `travas.md:54` e o `3_task.md` apontam as linhas certas de `erro.int.test.ts` depois da reordenação.

**Cobertos:**
- **Correção 1, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts`, as duas checagens `not.toContain` (linhas 166 e 167) agora vêm antes de `esperarEnvelopeSemVazamento` (168). A mutação do `filtro-global.ts:73` põe `excecao.name` na mensagem. A linha 166, do motivo, passa, e o teste para na 167, do nome. É o motivo certo.
- **Correção 2, feita.** O bloco em `3_task.md:160-167` cita `contratos.test.ts › nenhum contrato de resposta exportado tem campo proibido`. `configurarSegundoFatorDeOperadorResponseSchema` (`packages/shared/src/operacao/segundo-fator.ts:35`) tem o campo `segredo`. Com a chave de volta ao nome antigo, a exceção deixa de valer e a varredura reprova o campo. Também é o motivo certo.
- **Correção 3, feita no código, no mapa e no inventário.** Os nomes estão em `prova.ts:79-80`, `conversa.ts:58` e `index.ts`. As duas entradas saíram do `3.json`, e `esquemaRespostaSalva` agora vai para `respostaSalvaSchema`. O inventário diz "fica" nas linhas 521, 585 e 601. A regra está escrita na linha 253 e no `travas.md:53`. Contei 96 `export const *ResponseSchema` em `packages/shared/src`, o mesmo número do documento.
- **Recomendações aplicadas:**
  - a entrada da linha 150 (`'.ts:', 'Error'`, `travas.md:54`) entrou no `3.json`;
  - a saída do `conferir` e do `restos` está em `3_task.md:107-110`;
  - a nota de que a igualdade do conjunto varrido é conferência manual está em `3_task.md:61`.
- **Rodei dois testes, os dois verdes:** `npx vitest run --project unidade apps/api/test/contratos.test.ts` (5 casos) e `npx vitest run --project integracao apps/api/test/erro.int.test.ts` (10 casos). Não há `.skip`, nem mock que esconda a regra, nem chamada a provedor de IA.

**Bloqueantes:**
1. **As linhas citadas de `erro.int.test.ts` ficaram erradas depois da reordenação.** Duas linhas de comentário e a troca de ordem empurraram as asserções: a forma B saiu da 166 e está na **167**, e o `toMatchObject` com `tipo: 'InvariantException'` (forma A) saiu da 169 e está na **171**. A 166 agora é a checagem do motivo, que **não** fica vermelha com o nome vazando.
   - `tasks/prd-nomes-de-mercado/travas.md:54` ainda diz "linhas 166 e 169", "169 … A; 166, B" e "deixa a 166 vermelha". Essa linha vale para a 3.0 **e para a 4.0**. A 4.0, lendo "166", escreveria o bloco da forma B contra a linha errada, o mesmo erro da rodada 1.
   - `tasks/prd-nomes-de-mercado/3_task.md:62` ("`erro.int.test.ts:169` … forma A") e `3_task.md:169` ("Forma A em `erro.int.test.ts` (linha 169)") também estão errados.
   - **Correção:** trocar 166 por 167 e 169 por 171 no `travas.md:54` (nos três lugares) e no `3_task.md:62` e `:169`. Outra opção é tirar o número e citar a asserção pelo texto (`not.toContain('InvariantException')` e `erro: { tipo: 'InvariantException' }`), o que não envelhece na próxima mudança de linha.
2. **A última parte da correção 3 não foi feita na linha da tabela.** `3_task.md:59` continua "`PedidoDoTitular` e o "Resposta" do aluno | `restos` | ficam, porque são domínio", com a coluna "Caso" vazia. O `restos` não prova que um nome ficou: ele só confere que nenhum `de` do mapa sobrou, e `RespostaSalva` nem é mais `de`. A prova é a busca na árvore, que está no `3_task.md:103`, mas a linha da tabela não a cita. A rodada 1 pediu exatamente isso.
   - **Correção:** na linha 59, trocar o tipo para "busca na árvore", ou acrescentá-lo, e citar na coluna "Caso" a busca do `3_task.md:103`, com os três arquivos (`prova.ts`, `conversa.ts`, `titular.ts`). A linha também deveria nomear `RespostaAProposta`, que a triagem do Arquiteto pôs na mesma situação.

As duas correções mexem só em texto de documento: nenhum código e nenhum bloco de mutação muda.

**Recomendações:**
- `3_task.md:112`: o `3.relatorio.md` teve a linha de contagem corrigida à mão para 499 (482), mas o corpo continua sendo o do `aplicar` com 501 entradas. Se o `aplicar` aceitar ser refeito do mapa atual sem mudar nenhuma troca, o relatório deixa de ser meio gerado e meio editado.
- `3_task.md:131`: a frase com "(… que entraram com a divergência registrada acima, em "Divergências resolvidas")" ficou longa demais para a linha do parágrafo. É só texto.

## test-engineer · 3ª rodada · APROVADO · 2026-10-30 19:12:56 · `tasks/prd-nomes-de-mercado/3_task.md`

VEREDITO: APROVADO

Cenários exigidos (nesta rodada, as duas correções pedidas na 2ª):
1. Nenhuma citação de linha de `apps/api/test/erro.int.test.ts` errada no texto atual de `3_task.md` e `travas.md`.
2. `3_task.md:59` cita a busca de "Busca dos nomes antigos (3.4)", com o tipo "busca na árvore", os arquivos `prova.ts`, `conversa.ts` e `titular.ts`, e nomeia `RespostaAProposta`.

Cobertos:
- **Diff da rodada:** só mudaram `3_task.md` e `travas.md`. Comparei `1f78d792` com `47e2e404`, sem o que veio do merge. Nenhum código, teste ou mapa mudou, e o que eu tinha aprovado antes continua valendo.
- **Correção 1, feita.** No arquivo, a forma B está na linha 167 (`not.toContain('InvariantException')`) e a forma A na 171 (`erro: { tipo: 'InvariantException' }`).
  - `travas.md:54` cita as duas formas pelo texto e diz para não citar pela linha.
  - `3_task.md:62`, `:63`, `:169-170` e `:186-188` também citam pelo texto. Os números velhos 166 e 169 sumiram do texto.
  - Sobraram três citações por número, e as três estão certas. `3_task.md:208` aponta `erro.int.test.ts:160`, que é a linha do título do caso. `3_task.md:30` e `:189` apontam a "linha 150", que é a lista de proibidos com `'Error'` (`for (const proibido of [..., 'Error'])`).
- **Correção 2, feita.** `3_task.md:59` diz "busca na árvore", nomeia `PedidoDoTitular`, `RespostaSalva` e `RespostaAProposta`, e cita os três arquivos.
  - A busca citada existe no documento: a seção "Busca dos nomes antigos (3.4)" (`3_task.md:89`) e o parágrafo da `:103`, que lista os mesmos três arquivos, cada um com o seu tipo.
  - Na árvore, os três tipos estão nos arquivos citados: `packages/shared/src/atividade/prova.ts:80` (`RespostaSalva`), `packages/shared/src/assistente/conversa.ts:58` (`RespostaAProposta`) e `packages/shared/src/privacidade/titular.ts:215` (`PedidoDoTitular`).
- **Os blocos de mutação dessa parte continuam certos.** Os da `:172-197` apontam o caso pelo nome ("ErroDeInvariante vira ERRO_INTERNO 500…"), e o título continua igual no arquivo (linha 160).

Bloqueantes: nenhum.

Recomendações:
- `3_task.md:30` e `:189` citam o `'Error'` da lista de proibidos pela "linha 150". Hoje o número está certo, mas `travas.md:54` manda citar pela asserção. Trocar por "a lista de proibidos do caso 'exceção não tratada vira ERRO_INTERNO 500…'", como a própria `travas.md:54` faz, evita a mesma correção na próxima reordenação.
- A frase longa que recomendei na rodada anterior foi encurtada na `:131`. O período continua comprido na `:132`, a parte do `respostaSalvaSchema` e da triagem `efd23674`. Dá para dividir em duas frases.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/erro.int.test.ts
