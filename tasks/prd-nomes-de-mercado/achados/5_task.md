# Achados das revisões — `tasks/prd-nomes-de-mercado/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 01:16:30 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila | IA | migration | deploy. O diff só muda caminho, pacote e nome de arquivo, sem mudar comportamento.

Rate limit: ok. O código do limitador e do guarda de limite só mudou de pasta. Nenhuma chave, janela ou escopo por usuário e por escola mudou.

Fila e prioridade: ok. A chave `vaga:{fila}:{escola}` e o script Lua são os mesmos. O `build` copia `src/queue/concurrency-slot.lua` para o `dist`, o `readFileSync` de `packages/core/src/queue/escola-concurrency-limiter.ts` aponta para o nome novo, e o `dist/queue/concurrency-slot.lua` existe depois do build. As filas e o `job-definitions` não mudaram.

Concorrência: protegida. Nenhuma lógica de "busca, verifica, grava" foi tocada.

Índice e paginação: ok. Não há query nova nem schema alterado.

Degradação de IA: ok. `resilient-adapter.ts`, `llm-gateway.ts` e `errors.ts` só mudaram de nome, e os timeouts e o caminho de degradação são os mesmos.

Migration: compatível. `packages/core/drizzle` tem os mesmos blobs que `packages/nucleo/drizzle` no `HEAD`, tanto no índice quanto na árvore. Com o `'../../drizzle'` do `migrate.ts`, a pasta é achada do mesmo jeito a partir de `src/db` e de `dist/db`, e o Dockerfile copia `packages/core/drizzle`.

Métrica e alerta: ok. A telemetria ficou com o nome de antes (`fica`), os nomes das métricas e dos alertas não mudaram, e o healthcheck do compose continua lendo `/tmp/educa-batimento`. No compose, só dois comentários mudaram.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json:11394` ainda tem a entrada `"packages/nucleo"` (`@educa/nucleo`), agora com `"extraneous": true`, e essa pasta não existe mais. Nenhuma versão mudou, e o `npm ci` aceita entrada a mais no lock. Mesmo assim, vale gerar o lock de novo para tirar essa entrada antes do pouso, para o lock não citar um workspace que não existe.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json`: o `"include": ["src"]` virou `["../core/src"]`. Aponta para a mesma pasta, mas parece sobra do `aplicar`. Vale voltar para `"src"`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/README.md:42` e `:79` ainda citam `packages/nucleo/drizzle` e `packages/nucleo/src/db/schema`. É o documento que se lê para operar o `migrar` e o `db:gerar`. `TODO.md` e `ROADMAP.md:360` também têm caminhos antigos. Nenhum deles estava na lista da busca 5.4, mas vale trocar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts:454`: o título do caso ainda diz `packages/nucleo/src`. A asserção está certa, só o texto ficou velho.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-ia.mjs`: `PASTA_DOS_ADAPTADORES` passou de `adaptador-*.ts` para `*-adapter.ts`. Com isso, os `*.test.ts` dos adaptadores saem da exceção do SDK (antes, `adaptador-x.test.ts` casava com o glob). A regra ficou mais estrita, não mais solta, e vale registrar isso para o `llm-integrator`.
- No `packages/core/dist` local ficaram pastas do build anterior (`fila`, `contexto`, `limite` e outras). A imagem Docker constrói do zero e não é afetada, mas vale limpar o `dist` antes de repetir o `npm run build` e os scripts de carga que importam `packages/core/dist/index.js`. Assim nada passa por resolver um arquivo velho.
- O ouro (`docs/aia/ouro/README.md`) ainda cita `packages/nucleo`. Está fora do escopo pela tarefa e fica para a correção do Arquiteto.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 01:16:41 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: `correcao` (`packages/core/src/db/schema/correcao.ts`), `validacao_do_lote` (`packages/core/src/db/schema/validacao-do-lote.ts`) e a decisão da entrega (`entrega.decidida_por`, `packages/core/src/db/schema/entrega.ts:57`). Todos com autor humano? Sim. Os três arquivos de schema foram renomeados sem nenhuma linha mudada (similaridade de 100%), e as migrations `drizzle/*.sql` também (100%).

Decisão autônoma sobre aluno: ausente. Nenhuma linha de lógica mudou.

Aprovação registrada: ok. A trava `apps/api/src/entrega/entrega.int.test.ts:342` passou a ler `packages/core/src`. Ela não passa sem testar nada: o `readdirSync` quebra se a pasta não existir, então ela continua cobrindo o core.

Supervisão do tutor: ok. Em `packages/core/src/ia/tasks/turno-do-tutor.ts` e no prompt `ia/prompts/turno-do-tutor.ts` só mudaram os caminhos de import (`../task.js`, `../text.js`).

Autonomia declarada e visível: sim. `packages/shared/src/governanca` não mudou. Em `packages/shared`, o diff é de uma linha de comentário por arquivo, em seis arquivos.

Bloqueantes: nenhum.

**Como conferi que só mudou nome.**
- Peguei o diff das 864 entradas de código e doc, fora o mapa, o `tasks/` e o lock.
- Em cada linha removida, troquei os nomes antigos pelos novos, usando as 125 entradas de `tools/renomear/mapas/5.json` e `nucleo` → `core`. Depois comparei com as linhas adicionadas.
- Sobraram 54 arquivos. Li a sobra um por um: tudo é troca de caminho, de pacote ou de nome de arquivo dentro de texto, regex de trava ou fixture. Nada de lógica.
- Nos arquivos que importam para a regra 70, os renomeados com edição só trocaram caminho de import: `auditoria.repository.ts`, `auditoria-insert.repository.ts`, `auditoria-recorder.ts`, `mvp-tables.int.test.ts`, `ia/tasks/relatorio-da-correcao.ts` e `ia/tasks/turno-do-tutor.ts`.
- Os caminhos citados em "Checagem:" na regra 70 (`.claude/rules/70-conformidade-cne.md`) foram atualizados e os 14 existem. `mvp-tables.int.test.ts` e `ia/tasks/turno-do-tutor.test.ts` estão no lugar novo.
- `docs/regulacao.md`, `docs/conformidade-mec.md` e `docs/agentes.md` não mudaram e não citam caminho antigo.
- A tarefa não mexe em tela, e o prompt não trouxe foto.

Recomendações:
- `docs/aia/ouro/README.md:20` e `:126` ainda citam `packages/nucleo/src/ia/__fixtures__/...` (`ouro.ts`, que agora se chama `golden.ts`). O ouro fica fora desta tarefa por `travas.md`, então isto vai para o Orquestrador. A AIA é um documento da regra 70 (item 6a) e não deve apontar para arquivo que não existe mais.
- `packages/core/src/ia/README.md:8`: o exemplo ainda importa de `'@educa/nucleo'`.
- `packages/core/tsconfig.json`: `"include": ["src"]` virou `["../core/src"]`. Aponta para o mesmo lugar, mas é um efeito colateral do `aplicar`; o melhor é voltar para `"src"`.
- `package-lock.json:11394`: ficou uma entrada `"packages/nucleo"` / `"@educa/nucleo"` ao lado da nova `packages/core`. Fica com o `infra-guardian`.
- `README.md:42` e `:79`, `ROADMAP.md:360` e oito linhas do `TODO.md` ainda citam `packages/nucleo`. Estão fora da busca exigida na 5.4 (que cobre `apps/web/src`, `e2e/` e `docs/`); vale fazer uma varredura de texto depois.

Um erro meu durante a auditoria: rodei `git add -N .`, que marcou `tools/renomear/mapas/5.json` e `5.relatorio.md` como intent-to-add no índice. Desfiz com `git reset -q --` nesses dois arquivos. O `git status --short` voltou a ser idêntico a `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/status-5-r1.txt`. Nenhum arquivo da árvore foi editado.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 01:16:52 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

A tarefa 5.0 só mudou nome. Desfiz o mapa da onda (`tools/renomear/mapas/5.json`: as entradas de arquivo, pasta e pacote, mais `nucleo` → `core`) em cada arquivo alterado e comparei com o `HEAD`. Dos cerca de 680 arquivos com conteúdo mudado, sobraram resíduos em 14. Todos são nomes que a minha normalização não desfaz:
- o glob `adaptador-*.ts` virou `*-adapter.ts`;
- `insercao-de-auditoria` virou `auditoria-insert` na regex da `porta-unica`;
- `escolas-da-rotina` virou `cron-escolas` em `USO_DA_ROTINA`;
- o `include` do tsconfig e o lock;
- os textos da própria spec (`5_task.md`, `techspec.md`, `travas.md`).

Também procurei troca escondida em string que não é caminho, como nome de ação de auditoria, evento de log ou chave gravada no banco. Não há: o que sobra é `concurrency-slot.lua`, `s3-file-storage`, `migrate.ts` e `llm-gateway.ts`, todos nomes de arquivo.

- **Campos pessoais tocados:** nenhum. Não há migration, schema ou DTO com campo novo.
- **Fora da tabela de dados do docs/lgpd.md:** nada.
- **Autorização por objeto:** ok. Nenhuma rota, guard ou repository mudou de lógica, só o caminho do import.
- **Logs:** limpos. Nenhuma linha de log foi alterada além do import.
- **Auditoria:** presente. A trava da porta única procura `auditoria-insert`, e esse módulo existe com esse nome em `packages/core/src/auditoria/auditoria-insert.repository.ts`, então ela não ficou vazia.
- **Envio externo:** nada mudou. A lista de arquivos que podem importar o SDK de IA tem a mesma produção de antes: `fake-adapter.ts`, `openai-compat-adapter.ts` e `resilient-adapter.ts`, que eram os três `adaptador-*.ts`. Ela ficou menor, nunca maior: o glob velho também deixava passar `adaptador-openai-compat.test.ts`, e o novo não.
- **Seed/fixture:** sintético. A fixture de `e2e/__fixtures__` e as de `tools/guardas/__fixtures__` só mudaram o caminho.
- **Bloqueantes:** nenhum.

**Recomendações (não bloqueiam):**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json` ainda tem a entrada `"packages/nucleo"` marcada `"extraneous": true`, e essa pasta não existe mais no disco nem no git. Nenhuma versão mudou, então a regra do §12 está cumprida, mas um `npm install` tiraria essa entrada morta. O dono do assunto é o `infra-guardian`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json`: o `"include"` passou de `["src"]` para `["../core/src"]`. Aponta para o mesmo lugar, mas parece efeito colateral do `aplicar` reescrevendo caminho relativo. Vale voltar para `["src"]`.

**Pergunta de fechamento:** o código continua respondendo. Os testes de direitos do titular (`apps/api/test/arquivo-do-titular.int.test.ts`, `pedido-titular.int.test.ts`) e a consulta de auditoria só mudaram o caminho do import. Todas as checagens citadas em `.claude/rules/20-lgpd-menores.md` apontam para arquivos que existem, e nenhuma ficou com o caminho antigo.

**Testes que rodei**, projeto `unidade`, 9 arquivos e 454 testes, todos verdes:
- `porta-unica`, `acoes`, `s3-file-storage`, `llm-gateway`;
- `matriz` (a camada de rede só lê agregado);
- `guardas`, `filtros-casam`, `repositories-com-escopo`;
- `restos`.

Os testes de integração com banco não rodei.

## llm-integrator · 1ª rodada · APROVADO · 2026-10-31 01:17:29 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Perfis usados: não se aplica. A tarefa não adiciona nem altera chamada de modelo. Só mudaram nome de pacote, pasta e arquivo. Perfis, prompts e orçamento ficaram como estavam.
Custo estimado por professor/mês: não se aplica. A tarefa não cria chamada de modelo nova, então o custo não muda.
Prompt versionado: sim. Os `prompts/*.ts` mudaram só no import, e `promptVersao` não mudou.
Validação de schema: sim. O `LLMGateway`, ex-`provedor.ts`, mantém schema de entrada e de saída, uma repetição e o erro tipado `IA_SAIDA_INVALIDA`. O conteúdo é o mesmo de antes.
Aprovação humana no caminho: não se aplica. Nenhum caminho de entrega ou nota foi tocado.

O que conferi na camada de IA:

- **Guarda do SDK.**
  - `PASTA_DOS_ADAPTADORES` virou `packages/core/src/ia/*-adapter.ts`. O glob antigo era `adaptador-*.ts`.
  - O conjunto de adaptadores isentos é o mesmo: `fake-adapter`, `openai-compat-adapter` e `resilient-adapter`.
  - Rodei `eslint --stdin` com `import OpenAI from 'openai'` e `import('openai')`. `adapter.ts`, `llm-gateway.ts` e `__fixtures__/scripted-adapter.ts` ficam vermelhos, com o `no-restricted-imports` e o `guardas/sdk-de-ia-so-no-adaptador`. `fake-adapter.ts` passa.
  - A mensagem da guarda, as regras 30/20/80 e o `llm-integrator.md` citam o caminho novo.
- **Ferramentas de rename.**
  - `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/5.json` ficou verde, com 209.404 itens e nenhuma diferença fora do mapa.
  - `node tools/renomear/restos.ts` ficou limpo.
  - As exceções do `conferir` no mapa 5 são só regex de trava em `arquitetura.test.ts` e `porta-unica.test.ts`. Nenhuma toca prompt, perfil ou texto de IA.
- **Testes.** `vitest --project unidade packages/core/src/ia tools/guardas tools/renomear/restos.test.ts` passou: 23 arquivos, 1383 testes. Os testes de IA usam adaptador falso e nenhum chama provedor pago.
- **Ouro.** `golden.ts`, `golden.test.ts` e `golden-seal.test.ts` mudaram só em import e caminho. As taxas de recall e precisão impressas no teste estão iguais às registradas. `docs/aia/ouro/` não foi tocado.
- **Build.** `npm run build` passou para shared, core, api e worker.
- **`concurrency-slot.lua` (ex-`vaga.lua`).** O `build` do `packages/core/package.json` e o `readFileSync` estão no nome novo, e o arquivo existe em `dist/queue/`. A chave do Redis `vaga:{fila}:{escola}` não mudou.
- **Infra.** O `compose.yml` mudou só em 2 comentários. O `servico.Dockerfile` trocou só `packages/nucleo` por `packages/core` e `@educa/nucleo` por `@educa/core`.
- **Lock.** Nenhuma versão mudou. `npm ci --dry-run` resolve.

Bloqueantes: nenhum

Recomendações (não bloqueiam):

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/ia/README.md:8` ainda traz o exemplo `import { ErroDeIa, gerarAtividadeObjetiva, type LLMProvider } from '@educa/nucleo'`. O pacote antigo sobrou aqui porque o `restos` não varre `.md` dentro de `packages/`. `ErroDeIa` já estava defasado por ondas anteriores. O ROADMAP.md:360 já registra que esse README tem de ganhar os nomes novos, então vale fechar na onda que renomeia os símbolos.
2. `package-lock.json:11394` guarda uma entrada `"packages/nucleo"` com `"extraneous": true`, ao lado da nova `packages/core`. É resto do lock e o `npm ci` aceita. Vale limpar com `npm install --package-lock-only` na próxima oportunidade, desde que nenhuma versão mude.
3. `README.md` da raiz (linhas 42 e 79) cita `packages/nucleo/drizzle` e `packages/nucleo/src/db/schema`. Os dois são caminhos de comando de desenvolvedor, hoje errados. Estão fora das pastas que a 5.4 manda varrer (`apps/web/src`, `e2e/`, `docs/`), mas vale corrigir.
4. `docs/aia/ouro/README.md:20` e `:126` ainda citam `nucleo/.../ouro.ts` e `amostras-do-assistente-revisao.ts`, que viraram `golden.ts` e `assistente-review-samples.ts`. Isso está correto para esta tarefa, porque o ouro não se toca na 5.0. Peça ao Orquestrador que a onda que mexe no ouro atualize esses caminhos.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 01:18:13 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: REPROVADO

Cenários exigidos: a tabela "Testes que provam a regra" da 5.0. Isso cobre o `conferir`, o `restos` e a esteira, o `db:gerar` sem migration, o compose de produção sem diff de serviço, o lock sem versão mudada, as travas de forma A (`regras-tenant`/`index.mjs` `db/**`, `camadas.cjs`, `arquitetura.test.ts` 260/271/`USO_DA_ROTINA`, `tabelas-do-nucleo`, `ESCOPO_DO_ERRO_TIPADO`, `porta-unica` 11/12/49, `PASTA_DOS_ADAPTADORES`, `caminhos.test.ts`, `entrega.int.test.ts`, `dockerfile.test.ts:111`), a forma B (`dockerfile.test.ts:118`) e as de forma C (pelo `restos`, pelo filtro vazio e pela própria guarda em `REPOSITORIES_SEM_ESCOPO`). Isolamento, permissão e concorrência não se aplicam: a tarefa só muda nome.

Cobertos:
- **Só nome mudou, nenhum comportamento.** Rodei `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/5.json` e deu verde (209404 itens, nenhuma diferença que o mapa não explique). Fora dos documentos da tarefa e do lock, o diff tem o mesmo número de linhas tiradas e postas em todos os arquivos.
  - Em `packages/core` e `apps/*/src`, toda linha tirada é import, comentário ou o caminho/pacote antigo.
  - Em `apps/web` e `packages/shared` só mudaram comentários.
  - As migrations foram todas movidas sem mudar nada (R100). O `drizzle.config.ts` só trocou caminhos. O `.lua` foi trocado no `build` e no `readFileSync`, e o arquivo existe.
  - O compose só mudou em dois comentários. O Dockerfile só mudou caminho e `-w`.
- **Toda trava mudada no diff tem bloco**, ou motivo escrito para não ter (`vaga.lua`, a metade de caminho do `USO_DA_ROTINA`, `paths:`, `eslint.config.mjs`, `eslint-suppressions.json`). As cinco regras de `camadas.cjs` têm bloco cada uma, com a exceção do `expurgo` e os dois lugares de `CONTA_GLOBAL`.
- **Testes rodados agora:** os nove arquivos das travas passam, 404 casos: `restos`, `filtros-casam`, `camadas`, `guardas`, `repositories-com-escopo`, `tabelas-do-nucleo`, `caminhos` do harness, `dockerfile`, `porta-unica`.
- **Proibições:** nenhum `.skip`, `.only` ou teste comentado foi acrescentado, e nenhum mock esconde regra. Não há IA nem concorrência a testar.
- **Lock:** nenhuma versão mudou (mas veja o bloqueante).

Bloqueantes:
1. **O lock guarda o pacote antigo, e nada pega isso.** Em `package-lock.json:11394-11397` ficou a entrada `"packages/nucleo": { "name": "@educa/nucleo", ..., "extraneous": true, ... }`, com todas as dependências. A pasta `packages/nucleo/` não existe mais.
   - Não é troca de nome: a onda acrescentou `"extraneous": true` e manteve um workspace que não existe mais.
   - O `restos` não varre o lock (`tools/renomear/referencias.ts:23`, `SEM_VARREDURA`). A única checagem do lock, "nenhuma versão muda", passa por isso sem ver.
   - O próximo `npm install`, de qualquer tarefa, vai apagar a entrada. Esse diff cai numa tarefa seguinte e suja o "só nome" dela.
   - **Correção exigida:** tirar a entrada `packages/nucleo` do lock (rodar `npm install --package-lock-only` de novo agora que a pasta não existe, ou podar a entrada). Depois, conferir que o diff do lock só tem a troca `@educa/nucleo` → `@educa/core`, a nova ordem das entradas e o bloco `packages/core`, e que `grep -n "packages/nucleo\|extraneous" package-lock.json` não acha nada. Registrar essa conferência na 5.4.

Recomendações:
- **Alinhar a tabela do documento com os blocos.** A linha "forma C pelo `restos`" promete um bloco para `vaga.lua`, e a linha "forma C pelo filtro vazio" promete blocos para `paths:` e `eslint.config.mjs`. A seção "Sem bloco" explica por que eles não existem. A tabela deveria dizer o mesmo.
- **A exceção `packages/core/src/log/nest-logger.ts` do `index.mjs`** (`EXCECOES_DAS_GUARDAS`, `travas.md:123`, "linhas 118 e 124") é coberta pelo mesmo caso do `filtros-casam` que o bloco do `logger.test.ts`, mas sem bloco próprio. O mesmo vale para as outras quatro entradas de `REPOSITORIES_SEM_ESCOPO`, provadas por uma só. Um bloco por linha deixaria isso explícito.
- **Pôr no procedimento de cada onda uma busca do nome antigo no `package-lock.json`.** O `restos` não olha o lock por desenho.
- **Ficaram de propósito, só para registro:** o título do caso em `apps/api/test/arquitetura.test.ts:120` ("nem o barrel do @educa/nucleo…"), que é exceção do mapa (`5.json:823`). Também `packages/core/src/ia/README.md:8`, que fica para a 13.0, e `docs/aia/ouro/README.md`, que é o ouro.

Uma coisa a avisar: para ver a contagem do diff, rodei `git add -N` nos dois arquivos não rastreados (`tools/renomear/mapas/5.json` e `5.relatorio.md`). Isso alterou o índice. Desfiz logo em seguida com `git reset -q --` nesses dois, e o `git status` voltou a mostrá-los como `??`. Nenhum arquivo da árvore foi alterado.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 01:18:38 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

**Como conferi.** Peguei o diff com rename das 868 entradas. Em cada linha removida, troquei os nomes do `tools/renomear/mapas/5.json` e `nucleo` por `core`, e comparei com a linha que entrou. Sobraram 114 trechos e li todos. São quatro tipos:
- nomes que essa troca não desfaz: o glob `adaptador-*.ts`, que virou `*-adapter.ts`; o `insercao-de-auditoria`, que virou `auditoria-insert`; a metade do `USO_DA_ROTINA` que faltava da 4.0;
- texto da própria spec;
- o lock;
- uma linha do tsconfig (recomendação 1).

Nenhuma lógica mudou. Rodei de novo o `conferir` (verde, 209404 itens, nada fora do mapa) e o `restos` (limpo). A árvore ficou igual antes e depois. Nenhum arquivo de `apps/` foi renomeado; isso fica para a 6.0. `docs/aia/` e `apps/web/src/componentes/ui/onca/` não têm diff. As duas divergências do `5_task.md` já estão na `techspec.md` (§5 e §11, linha do RF7) e no `travas.md:85`.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json:9`: o `"include": ["src"]` virou `["../core/src"]`. Aponta para a mesma pasta, mas não é troca de nome. É o `aplicar` recalculando o caminho relativo a partir do lugar antigo, e desmente a frase nova do `travas.md:85` ("nenhum diff de não-nome sobra na spec"). Volte para `"src"`. Vale também conferir se o `aplicar` faz o mesmo nos tsconfig que a 6.0 vai mover.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json:11394` ainda tem a entrada `"packages/nucleo"` (`@educa/nucleo`), agora com `"extraneous": true`, e essa pasta não existe mais. Testei numa cópia: o `npm install --package-lock-only`, o `npm prune` e o `npm install` completo mantêm a entrada, e o `npm ci` aceita. Ela só sai editando o lock à mão. Nenhuma versão mudou.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md:198`: a premissa do lock continua "NÃO VERIFICADO", mas a 5.0 já conferiu o diff. Marque como verificada.
4. Comentários de código ainda citam o arquivo pelo nome antigo:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/drizzle.config.ts:4` (`src/db/migrar.ts`, hoje `migrate.ts`);
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/db/schema/mvp/tables.ts:22` (`db/banco.ts`, hoje `database.ts`).

   O `restos` não pega caminho parcial em comentário.
5. Títulos de caso ainda com o nome antigo:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/arquitetura.test.ts:120` ("barrel do @educa/nucleo");
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts:454` ("packages/nucleo/src").

   O relatório classifica a linha 120 como `trava`, mas só o corpo do caso mudou.
6. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/README.md:42` e `:79`, além de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/ia/README.md:8`, ainda citam `packages/nucleo` e `@educa/nucleo`. Os dois README são da 13.0, mas o da raiz é o que se lê para rodar o `db:gerar`.
7. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md`: a seção "Recomendações sem aplicar" está vazia. Preencha com os itens acima ou tire o título.
8. Avisar o Orquestrador da correção do ouro: `docs/aia/ouro/README.md:20` e `:126` apontam para `ouro.ts` e para `amostras-do-assistente-revisao.ts`, que agora se chamam `golden.ts` e `assistente-review-samples.ts`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-31 01:43:29 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela nova e nenhuma migration nova. As 40 migrations em `packages/core/drizzle/` e o `meta/_journal.json` foram só renomeadas (`R`, sem diff de conteúdo). O schema em `packages/core/src/db/schema/` foi só movido, e os imports foram trocados pelos nomes novos.

**Queries verificadas:** apliquei o mapa `tools/renomear/mapas/5.json` (pacote, pastas e arquivos, com e sem extensão) sobre cada linha removida do `git diff HEAD -M` e comparei com as linhas adicionadas. Nenhuma diferença sobrou em código de produção: os repositories de `packages/core` e de `apps/*` não ganharam nem perderam cláusula de `escolaId`/`anoLetivoId`. Os `@Unscoped()` e as justificativas escritas deles estão como antes, só com o import em `../db/unscoped.decorator.js`. O que sobrou fora de produção é nome: os globs `adaptador-*.ts` viraram `*-adapter.ts`, e as regex de `arquitetura.test.ts` e de `porta-unica.test.ts` passaram a usar `@educa/core`, `cron-escolas.repository` e `auditoria-insert`.

As travas de tenant apontam para os caminhos novos e todos existem:
- `tools/guardas/escopo-dos-repositories.ts` (`REPOSITORIES_SEM_ESCOPO`);
- `tools/guardas/index.mjs` (`packages/core/src/db/**` e `ESCOPO_DO_ERRO_TIPADO`);
- `tools/guardas/regras-tenant.mjs` (`PACOTE = '@educa/core'`).

Os caminhos que não existem no disco são só os fabricados pelas fixtures (`x.ts` e parecidos).

Nenhum endpoint novo, nenhum `escolaId` vindo do corpo ou da query, nenhum id novo.

**Teste de isolamento:** presente e efetivo. Esta onda não pede teste novo: ela não muda comportamento e o RF7 diz que nenhum caso entra. Os testes que já existiam seguem valendo pelo caminho novo. Rodei `repositories-com-escopo.test.ts` e `unscoped.decorator.test.ts`: 54 testes passaram. O bloco de mutação de `REPOSITORIES_SEM_ESCOPO` na `5_task.md` usa o caminho antigo, e com ele a guarda acusa `lista-arquivo-inexistente`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json:9`: o `"include"` ficou `["../core/src"]` em vez de `["src"]`. Aponta para a mesma pasta, mas é um artefato do `aplicar`; voltar para `["src"]`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json:11394`: sobrou a entrada `"packages/nucleo"` (`@educa/nucleo`, `"extraneous": true`). Está fora do meu escopo; fica para o `infra-guardian` conferir o §12 da Tech Spec.
3. Ficaram nomes antigos em títulos de teste e em documentação. Nenhum deles muda trava:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/arquitetura.test.ts:120` ("barrel do @educa/nucleo")
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts:454` ("packages/nucleo/src")
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/ia/README.md:8` (`from '@educa/nucleo'`)
   - `README.md`, `TODO.md`, `docs/guia-do-desenvolvedor.md:76` e `docs/aia/ouro/README.md`
4. `REPOSITORIES_SEM_ESCOPO` ainda lista nomes de método em português, como `inserir` e `buscarDaEscola` em `job-outbox.repository.ts`. Isso não é desta onda; vale conferir na onda dos símbolos que a lista acompanha o rename dos métodos, senão a guarda passa a acusar "método inexistente".

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-31 02:16:36 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova. O diff desta rodada não toca schema nem migration.
Queries verificadas: nenhuma. Os 3 arquivos do diff (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md`) não têm repository, endpoint, escopo nem `@Unscoped()`.
Teste de isolamento: presente e efetivo. Esta rodada não mexe nele, e o que foi aprovado na 1ª rodada continua igual.
Bloqueantes: nenhum. Não havia correção exigida por mim. Conferi também os itens da ordem `5_task-r1.md` que tocam o diff:
- Item 1: `grep "packages/nucleo\|extraneous\|@educa/nucleo"` em `package-lock.json` não acha nada. O diff do lock contra o HEAD tem 10 linhas a mais e 10 a menos, e nenhuma linha de `"version"` mudou.
- Item 2: o `include` de `packages/core/tsconfig.json` voltou a ser `["src"]`.
- Item 3: as duas linhas da tabela de testes de `5_task.md` agora batem com a seção "Sem bloco".

Recomendações: nenhuma nova. Continuam valendo as da 1ª rodada que estão em "Sem aplicar" da ordem `5_task-r1.md`. A mais importante para o isolamento: `REPOSITORIES_SEM_ESCOPO` ainda lista os métodos pelo nome em português. Ela precisa mudar na mesma onda que renomear esses métodos, senão a guarda acusa "método inexistente".

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-31 02:16:47 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Os três arquivos do diff da rodada 2 são de build e de documento de tarefa: `package-lock.json`, `packages/core/tsconfig.json` e `tasks/prd-nomes-de-mercado/5_task.md`.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. Nenhuma rota, repository ou query mudou nesta rodada. O que vale para o resto da onda é a auditoria da 1ª rodada, que aprovou.

Logs: limpos. Nenhum logger foi tocado.

Auditoria: presente. O diff não tem nenhuma ação que exija auditoria.

Envio externo: nenhum envio novo e nenhum adaptador de IA tocado.

Seed/fixture: sintético. O diff não toca seed nem fixture.

Bloqueantes: nenhum.

O que conferi das correções da ordem `5_task-r1.md`, mesmo sendo de outros revisores:
- **Item 1 (lock):** a entrada `packages/nucleo` com `"extraneous": true` saiu do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json`. A busca por `packages/nucleo`, `extraneous` e `@educa/nucleo` no lock não acha nada. Contra o HEAD, o diff do lock tem 10 linhas tiradas e 10 postas, e nenhuma linha de versão muda.
- **Item 2 (tsconfig):** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json` voltou a ter `"include": ["src"]`.
- **Item 3 (tabela de testes):** as duas linhas da tabela em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md` agora remetem a "Sem bloco" para `vaga.lua`, `paths:` e `eslint.config.mjs`, como a ordem pedia. A 5.4 registra a conferência do lock e o resultado da busca em `docs/`.

Pergunta de fechamento: o rename não altera o que o sistema guarda sobre um aluno nem para onde isso foi enviado. O arquivo do titular e os registros de `ExecucaoAgente` continuam os mesmos da 1ª rodada, com as travas renomeadas.

Recomendações:
- Fica valendo a da 1ª rodada sobre `docs/guia-do-desenvolvedor.md:74-83` e `docs/modelo-de-dados.md:747`, que ainda citam o caminho parcial `nucleo/src/...`. A 5.4 já as manda para a 13.0, e nada a acrescentar.
- A ordem pedia, no item 2, que o relatório dissesse se o `aplicar` estraga o `include` de outros `tsconfig` movidos, para o Orquestrador levar à 6.0. A 5.4 não traz esse registro. Não bloqueia esta tarefa, mas convém conferir onde ele ficou antes da 6.0.

## llm-integrator · 2ª rodada · APROVADO · 2026-10-31 02:16:56 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum. O diff não adiciona chamada de modelo nem toca a camada de IA. É a renomeação `nucleo` → `core`, e só mudaram o lock, um `tsconfig` e o texto da tarefa.
Custo estimado por professor/mês: não se aplica. Nenhuma chamada nova, então o custo não muda em relação à rodada anterior.
Prompt versionado: não se aplica (nada mudou)
Validação de schema: não se aplica (nada mudou)
Aprovação humana no caminho: não se aplica

Conferi o diff da rodada 2 e a correção exigida:
- **`package-lock.json`:** a entrada `packages/nucleo` com `"extraneous": true` saiu. `grep "packages/nucleo|extraneous|@educa/nucleo"` no lock não acha nada.
- **`packages/core/tsconfig.json`:** o `include` agora é `["src"]` e não aponta mais para `../core/src`. É um ajuste inofensivo.
- **Texto da tarefa (`5_task.md`):** as linhas da tabela de testes foram corrigidas e a seção "Revisões" foi escrita pelo hook. Não afeta a camada de IA.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/ia/README.md:8` ainda importa de `'@educa/nucleo'`. Fica dentro de `packages/core`, fora das buscas que a subtarefa 5.4 cita (`apps/web/src`, `e2e/` e `docs/`). Vale trocar para `@educa/core` nesta onda ou registrar para a 13.0.
- O `test-engineer` reprovou na rodada 1 (ver "Revisões" no `5_task.md`). Fica com ele conferir se a correção dele foi atendida.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-31 02:16:59 · `tasks/prd-nomes-de-mercado/5_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 1ª rodada estão em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/5_task-r1.md, na seção "Sem aplicar", e continuam com o destino que está lá.
```

O que conferi nesta rodada, pela ordem de correção:

- **Item 1, o lock.** Rodei `grep -n "packages/nucleo\|extraneous\|@educa/nucleo"` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json` e não achou nada. Comparei o lock com o HEAD:
  - as quatro dependências trocam `@educa/nucleo` por `@educa/core`;
  - o link `node_modules/@educa/core` mudou de posição na lista;
  - o bloco virou `packages/core`;
  - nenhuma versão mudou;
  - o `npm ci --dry-run` passa.
- **Item 2, o tsconfig.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json` está igual, byte a byte, ao `packages/nucleo/tsconfig.json` do HEAD (`"include": ["src"]`).
- **Item 3, a tabela.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md`, a tabela "Testes que provam a regra" agora remete à seção "Sem bloco" para `vaga.lua`, `paths:` e `eslint.config.mjs`. A 5.4 registra a conferência do lock e o resultado da busca em `docs/`.

O diff não mexe em rate limit, fila, gateway de IA, estado em memória, query, migration nem métrica. O compose de produção não muda.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-31 02:17:00 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou nesta rodada. O diff da 2ª rodada não toca em `Nota`, nas correções, nos jobs, no seed, na importação nem nos webhooks. Os caminhos auditados na 1ª rodada continuam com autor humano. Todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (o diff não toca em fluxo de entrega, artefato ou auditoria)
Supervisão do tutor: ok (o diff não toca no tutor)
Autonomia declarada e visível: sim (o diff não toca em governança)

Bloqueantes: nenhum

Esta rodada mudou três arquivos, e nenhum deles mexe na regra 70.

- **`package-lock.json`**: a entrada `packages/nucleo` saiu do lock (era `extraneous`). Procurei `packages/nucleo`, `extraneous` e `@educa/nucleo` no lock e não achei nada. Nenhuma versão mudou. Isso atende o item 1 da ordem `5_task-r1.md`.
- **`packages/core/tsconfig.json`**: o `include` voltou a ser `"src"`, que é a mesma pasta de antes. Os testes que a regra 70 cita continuam dentro do que o TypeScript compila: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `packages/core/src/auditoria/auditoria.int.test.ts`, `acoes.test.ts` e `porta-unica.test.ts`. Isso atende o item 2.
- **`tasks/prd-nomes-de-mercado/5_task.md`**: a 5.4 agora registra a conferência do lock e o resultado da busca em `docs/`. As duas linhas da tabela "Testes que provam a regra" dizem o mesmo que a seção "Sem bloco". Isso atende o item 3. A seção "Revisões" é escrita pelo hook e não entra na auditoria.

Também confirmei que as linhas de "Checagem" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/rules/70-conformidade-cne.md` no disco já apontam para `packages/core` e não citam mais `nucleo` nem `tabelas-do-mvp`. Assim, nenhuma regra fica com caminho de teste que não existe mais. O texto que o contexto da sessão mostrou ainda tem os caminhos antigos.

Recomendações: nenhuma nova. As da 1ª rodada estão na tabela "Sem aplicar" da ordem `5_task-r1.md`, com destino definido: o `README.md` e o `docs/` na 13.0, e o `docs/aia/ouro/README.md` com o Arquiteto.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/5_task-diff-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/5_task-r1.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 02:17:17 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Cenários exigidos (desta rodada): as três correções da ordem `5_task-r1.md`. A primeira é tirar do lock a entrada `packages/nucleo`, conferir que o diff do lock é só troca de nome e registrar essa conferência na 5.4. A segunda é voltar o `include` do `packages/core/tsconfig.json` para `src`. A terceira é alinhar a tabela de testes com a seção "Sem bloco".

Cobertos:
1. **Lock.** No `package-lock.json`, `grep -n "packages/nucleo\|extraneous\|@educa/nucleo"` não acha nada. Contra o HEAD, o `git diff` do lock tem só três coisas: a troca `@educa/nucleo` → `@educa/core` nas quatro dependências (api, despachante, realtime e a quarta, em torno da linha 170), a nova ordem de `node_modules/@educa/core` e o bloco `packages/core`. Nenhuma versão mudou. A conferência está na 5.4, junto com o motivo de a poda ter sido feita à mão: nenhum comando do npm tira a entrada, como o revisor-geral já tinha visto.
2. **tsconfig.** `packages/core/tsconfig.json:9` voltou a `"include": ["src"]`. Contra o HEAD, `git diff HEAD -M --stat` mostra `packages/{nucleo => core}/tsconfig.json | 0`, ou seja, rename puro, sem diff de conteúdo.
3. **Tabela.** As linhas 83 e 84 do `5_task.md` agora remetem `vaga.lua`, `paths:` e `eslint.config.mjs` a "Sem bloco". Isso bate com as linhas 475 a 479, que explicam por que não há bloco. A linha do filtro vazio cita `knip.json` e a exceção de log do `index.mjs`, e as duas têm bloco na linha 459 e seguintes.
4. **Cláusula nova.** Esta rodada não acrescenta cláusula de trava. O diff é a poda do lock, o `tsconfig` e texto do documento, então não falta bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
- O resto de workspace no lock continua sem trava automática. O `restos` não varre o lock (`SEM_VARREDURA`), e esta onda só pegou o problema pela revisão. Já está encaminhado ao Arquiteto, com a busca do nome antigo no `package-lock.json` entrando no procedimento de cada onda antes da 6.0. Reforço que convém fazer antes da 6.0, porque o `aplicar` vai deixar o mesmo `"extraneous": true` em todo workspace que mover.
- Pelo item 2 da ordem, o relatório tem de dizer se o `aplicar` recalcula o `include` relativo em outros `tsconfig` movidos, para a 6.0. Confiram que o relatório ao Orquestrador diz isso.
- Na linha 83, "mais os achados da 5.0" é vago. Valeria nomear os blocos, para a validação poder conferir linha a linha.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 02:17:26 · `tasks/prd-nomes-de-mercado/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` responde "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum

Esta rodada auditou só o diff desde a rodada aprovada (`package-lock.json`, `packages/core/tsconfig.json` e `5_task.md`). Os três itens da ordem `5_task-r1.md` estão feitos:

1. **Lock.** A entrada `packages/nucleo` com `"extraneous": true` saiu. O `grep -n "packages/nucleo\|extraneous\|@educa/nucleo" package-lock.json` não acha nada. No diff do lock contra a base sobram só três coisas:
   - a troca `@educa/nucleo` → `@educa/core` nos quatro dependentes;
   - a nova ordem de `node_modules/@educa/core` e `node_modules/@educa/despachante`;
   - `packages/nucleo` → `packages/core`.
   
   Nenhuma versão mudou. A 5.4 registra a conferência e o motivo de a poda ter sido à mão.
2. **tsconfig.** `packages/core/tsconfig.json` voltou a `"include": ["src"]` e não sobra diff de conteúdo contra o original. Nenhum outro `tsconfig*.json` de `apps/`, `packages/` ou da raiz cita `nucleo`.
3. **Tabela de testes.** As linhas "forma C pelo `restos`" e "forma C pelo filtro vazio" (`5_task.md:83-84`) batem com os blocos de "Mutações" e com a seção "Sem bloco" (`5_task.md:475-481`): `vaga.lua`, `paths:` e `eslint.config.mjs` sem bloco, com o motivo, e `knip.json` e a exceção de log do `index.mjs` com bloco (`5_task.md:459-473`).

Recomendações:
- `tasks/prd-nomes-de-mercado/5_task.md:483`: a seção "Recomendações sem aplicar" está vazia. A ordem `5_task-r1.md` manda copiar para lá a tabela "Sem aplicar", com 13 linhas e o destino de cada uma. Copie antes do commit, para a validação e a retro acharem no documento.
- O item 2 da ordem pedia que o relatório dissesse se o `aplicar` faz a mesma troca de `include` nos `tsconfig` que a 6.0 vai mover. Isso não aparece no documento e não dá para conferir daqui. O Orquestrador deve confirmar no relatório do Implementador antes de abrir a 6.0.
- Segue com o Arquiteto o que já estava registrado: `techspec.md:198`, a premissa do lock ainda "NÃO VERIFICADO", agora pode ser marcada como verificada. E a busca do nome antigo no `package-lock.json` entra no procedimento de cada onda em `tasks.md`.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/5_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/package-lock.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/tsconfig.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/5_task-r1.md
