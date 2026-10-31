# Achados das revisões — `tasks/prd-nomes-de-mercado/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-31 05:45:23 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A tarefa não toca migration, `db/schema` nem SQL.

Queries verificadas:
- Os sete repositories movidos guardam o sufixo `.repository.ts`, e nenhum saiu do alcance de `tools/guardas/repositories-com-escopo.test.ts`. São eles:
  - `credencial/sessao-create`
  - `credencial/sessao-write`
  - `sessao/external/conta-externa`
  - `sessao/tenant/tenant-resolution`
  - nos testes, os pares `.test` e `.int.test` correspondentes
- Os repositories modificados (`ia/execucao`, `material/material`, `operacao/operador/operador`, `packages/core/.../conta-global` e `synthetic-effect`) só trocaram import ou comentário. O diff de `apps/` e `packages/`, tirados os imports e os comentários, só tem caminho em string.
- Os controllers só trocaram import: nenhum passou a aceitar `escolaId` e nenhuma rota mudou.
- As travas que mudaram de caminho apontam para os nomes novos e continuam recusando:
  - `cerca-resolucao-de-tenant` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/camadas.cjs:151`
  - a zona de `ResolucaoDeTenantRepository`, `QUEM_USA_A_ROTINA` (a rotina sem escopo) e o índice de `sessao/tenant`, os três em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts`
  - as listas de exceção com caminho de repository existente em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/repositories-com-escopo.test.ts:136-145`
- Rodei `repositories-com-escopo`, `camadas` e `filtros-casam` (115 casos), `architecture.test.ts` e `escola.repository.test.ts` (69 casos). Passaram todos.

Teste de isolamento: presente e efetivo. Não há módulo novo. Os testes de isolamento que já existiam só trocaram import, e o diff fora das linhas de import está vazio. São eles: `atividade-isolamento`, `estrutura-isolamento`, `material-isolamento`, `operacao-isolamento`, `acesso-da-turma` e os três `input-boundary*`. Por isso a força deles não mudou.

Bloqueantes: nenhum.

Recomendações:
- A regra `cerca-resolucao-de-tenant` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/camadas.cjs:147` e a chave em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/camadas.test.ts:142`) ainda tem o nome antigo, embora o alvo agora seja `tenant-resolution.repository.ts`. Ela pode ser alinhada junto com o símbolo `ResolucaoDeTenantRepository`, nas tarefas 7.0 a 11.0.
- A regex `IMPORTA_O_LOGIN_SERVICE` mudou de `\b` para `(?<![\w-])` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts:1404`. Isso não toca o isolamento, mas a tarefa não lista essa mudança, e ela merece uma linha nas divergências.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 05:46:11 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: `apps/api/src/atividade/correcao/correcao.service.ts` (`.aprovar(`) e `apps/api/src/atividade/correcao/lote.controller.ts` (`.aprovarLote(`). Nenhum job, seed, importação ou webhook grava Nota. Todos com autor humano? sim. A onda não renomeou nenhum desses arquivos. Em `correcao.service.ts` só mudaram os imports. A trava `correcao.int.test.ts:377-378` continua listando exatamente esses dois arquivos.

Decisão autônoma sobre aluno: ausente. Nenhum service, controller ou processador do worker mudou de comportamento.

Aprovação registrada: ok. Em `entrega/`, `artefato/`, `assistente/`, `atividade/`, `tutor/`, `governanca/`, `ia/` e `apps/worker/src`, cada linha alterada é de import ou de caminho. A única exceção é `ARQUIVO_DO_SANDBOX`, que agora aponta para `synthetic.sandbox.ts` e não toca a regra 70. As peças de aprovação da web (`approval.ts`, `LinhaAprovacao.tsx`) só mudaram de pasta, para `components/ui/ai/`.

Supervisão do tutor: ok. Em `tutor.service.ts` e `tutor.int.test.ts` só mudaram os imports. A conversa do professor continua fora do alcance da coordenação. A sentinela em `assistente.int.test.ts:341-360` ainda casa com a árvore real: os arquivos que tocam `mensagemAgente` e `mensagem_agente` fora dos três listados (`assistente.service.ts` e o renomeado `ia/execucao.scheduler.ts`) só os citam em comentário de bloco, que o teste descarta.

Autonomia declarada e visível: sim. As telas de `areas/coordenacao/governanca/` só tiveram imports trocados, e `textos-da-governanca.test.ts` passa.

Bloqueantes: nenhum.

O que conferi:
- **Mudança da regra 70.** Mudaram duas linhas: as referências de Checagem dos itens 4a e 4b passam a citar `apps/web/src/components/ui/ai/avatar-com-funcao-e-selo.test.tsx` e `apps/web/src/components/MenuDaPessoa.test.tsx`. Todo caminho citado na regra 70 e em `docs/regulacao.md`, `docs/agentes.md`, `docs/conformidade-mec.md`, `docs/lgpd.md` e `docs/aia/` existe na árvore nova. A única falta é `tools/guardas/ouro-separado.ts`, que já faltava no HEAD e o README cita como trabalho futuro, então não é desta tarefa.
- **`docs/regulacao.md`** não mudou.
- **Revisores obrigatórios.** Em `tools/processo/guardioes-por-caminho.ts`, `components/ui/ai/` continua pedindo os três revisores `[P, C, I]` e `gallery/` continua com `[P, C]`. A conformidade não sumiu de nenhum caminho.
- **Testes rodados.** Rodei os testes da regra 70 nos caminhos novos (`components/ui/ai`, `MenuDaPessoa`, `areas/aluno/tutor.test.ts`, `coordenacao/governanca`, `packages/shared/src/governanca`, `guardioes.test.ts`): 21 arquivos e 339 casos passam. Os testes de integração com banco não rodei.

Recomendações (não bloqueiam):
1. **Docs com caminhos antigos.** Alguns documentos ainda citam os caminhos curtos antigos (`componentes/ui/ia/`, `componentes/...`), inclusive para as peças de IA que mostram o selo "IA" e a linha de quem aprovou:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/interface.md` (linhas 639, 1145, 1525, 1585, 1597, 1604, 1637, 1641)
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/glossario.md` (243, 250, 252)
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/guia-do-desenvolvedor.md` (166, 167, 331, 332, 337, 415)
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/pendencias-dos-mockups.md:12`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/arquitetura.md:198`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/mvp-rapido.md:409` e `:543`

   A subtarefa 6.4 promete buscar os nomes antigos em `docs/`, mas essa busca não pega o caminho curto, sem o prefixo `apps/web/src/`. Cabe ao `revisor-geral` confirmar se isso fica para uma onda posterior.
2. **Comentários de código com caminho antigo.** Três comentários ainda citam `src/rotas.tsx`, que agora é `src/routes.tsx`: `apps/web/src/areas/aluno/routes.tsx:9`, `apps/web/src/areas/professor/routes.tsx:9` e `apps/web/src/gallery/Gallery.tsx:17`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 05:46:52 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

A tarefa 6.0 só renomeia arquivos e pastas. Nada nela muda coleta, exposição, log, auditoria, envio externo ou seed.

Campos pessoais tocados: nenhum. Não há migration nem campo de schema, nem DTO novo ou alterado. Nas pastas `src` de api, worker, realtime e despachante, o diff fora de import muda só caminhos em comentários e em strings: os `export type ... from`, a lista de importadores em `escola.repository.test.ts` e o `ARQUIVO_DO_SANDBOX`. Em `apps/web/src`, fora de teste, mudam só os caminhos do `lazy(import(...))`, do `import.meta.glob` e do `readFileSync` do CSS.

Fora da tabela de dados do docs/lgpd.md: nada. A tabela não mudou e não precisava mudar.

Autorização por objeto: ok. Não muda guard, repository nem controller; as rotas `/v1/...` continuam iguais. O `v1/sessao/externa` segue como rota, e o relatório o classifica como `fica`.

Logs: limpos.
- `guardas/log-sem-dado-pessoal` e `log-sem-conteudo-montado` valem em `**/*` (`tools/guardas/index.mjs`).
- As únicas exceções a elas, `packages/core/src/log/logger.test.ts` e `nest-logger.ts`, não mudaram de caminho.
- O `erro-tipado` cobre `apps/*/src/**`; o `e2e/__fixtures__` que virou `e2e/support` já ficava fora desse escopo.

Auditoria: presente e sem mudança. `porta-unica.test.ts` e `acoes.test.ts` passaram.

Envio externo: nenhum novo e nenhum alterado.

Seed/fixture: sintético. Os `*-de-teste.ts`, que viraram `*.fixture.ts`, e o `e2e/__fixtures__/`, que virou `e2e/support/`, mudaram de 0 a 5 linhas cada, só import e caminho. O `e2e/support/seed.ts` (antes `sessao.ts`) mudou 1 linha e continua declarando nome inventado e e-mail `.invalid`. O `lista-excel.csv` só mudou de pasta, sem alteração de conteúdo.

O que mais conferi, do lado da regra 20:
- **Caminhos citados nas regras:** os testes que a regra 20, a 10, a 70, o `docs/lgpd.md`, o `docs/regulacao.md`, o `docs/conformidade-mec.md` e o `privacy-guardian.md` citam existem todos com o nome novo (`contracts.test.ts`, `error.int.test.ts`, `input-boundary-late-modules.int.test.ts`, `components/ui/ai/...`).
- **Listas de arquivos permitidos:** continuam exatas e conferidas por `existsSync`. Vale para o `QUEM_USA_A_ROTINA` em `apps/api/test/architecture.test.ts:1329-1339`, que é a rotina sem escopo usada no expurgo e inclui `processors/expurgar-dado-pessoal.ts`. Vale também para a lista dos arquivos que tocam `mensagemAgente` no `assistente.int.test.ts`. Um caminho velho nessas listas deixaria o teste vermelho; não deixa a regra passar calada.
- **Guardiões por caminho:** `tools/processo/guardioes-por-caminho.ts` mantém o P (privacidade) em `components/ui/ai/`, `gallery/`, `apps/despachante/` e `infra/`, e todo prefixo casa ao menos um arquivo versionado.
- **Testes rodados agora, todos verdes:** 8 arquivos, 361 casos. São eles `tools/renomear/restos.test.ts`, `apps/api/test/contracts.test.ts`, `porta-unica.test.ts`, `acoes.test.ts`, `s3-file-storage.test.ts`, `guardas.test.ts`, `filtros-casam.test.ts` e `packages/shared/src/permissao/matriz.test.ts`.

Pergunta de fechamento: a resposta continua a mesma de antes desta tarefa. Ela não toca o arquivo do titular nem a lista de compartilhamento, só o nome dos arquivos que os montam.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/vitrine/escola.ts:18` e `:23`: os comentários ainda dizem `sessao.ts`, mas o arquivo agora é `e2e/support/seed.ts` (o import da linha 8 já está certo). O `restos` não pega porque o nome aparece solto, sem a pasta. Não afeta privacidade; fica para a próxima onda ou para a retro.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/decisoes.md:1506` ainda cita `apps/web/src/componentes/ui/onca/`. A Tech Spec §5 deixa esse arquivo de fora de propósito; só registro.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 05:46:53 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. Só arquivos e pastas mudaram de nome. Isso alcança a fila (`apps/worker`, `apps/despachante`), a sala (`apps/realtime`), o rate limit (`apps/api/src/rate-limit.module.ts`, `apps/api/src/assistente/ai-request-rate-limit.ts`) e os scripts de carga, mas nenhum comportamento mudou.

Rate limit: ok. `ai-request-rate-limit.ts` mudou de nome sem mudar de conteúdo, e os tetos por usuário e por escola continuam lidos do caminho novo.

Fila e prioridade: ok. Nomes de fila, nomes de job, prefixos de chave no Redis, nomes de métrica e entradas de processo (`dist/main.js`, `dist/ops/*.js`, `dist/ops/migrar.js` no compose) ficaram como estavam. Fora `import`, comentário e teste, a única linha de código alterada no backend é `ARQUIVO_DO_SANDBOX` (`apps/worker/src/processors/synthetic.ts:12`). Ela continua relativa e aponta para um arquivo que existe.

Concorrência: protegida (nada novo).

Índice e paginação: ok (nenhuma query nova).

Degradação de IA: não se aplica.

Migration: não se aplica. Nenhum arquivo de migration ou do Drizzle foi tocado. No `packages/core` só mudaram comentários.

Métrica e alerta: ok. Nenhum nome de métrica ou de alerta mudou. Os arquivos citados na Checagem da `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/rules/80-infra-e-carga.md` existem nos caminhos novos. `alerta-tem-runbook.test.ts` passou: 10 de 10.

O que rodei:
- `npm run typecheck`: passou sem erro.
- Testes de unidade de worker, despachante, realtime, `chunk-names` e `ai-request-rate-limit`: 255 de 255.
- Testes de unidade de `infra/test` (carga, carga-login, carga-sala, alertas, expurgo-da-carga): 131 de 131.
- Os alvos que os scripts de carga importam do `dist` (`synthetic-sessions`, `password-hasher`, `escola`) existem na origem.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/src/config.ts:68`: o comentário ficou com metade do caminho novo, `processadores/synthetic.sandbox.ts`. O certo é `processors/synthetic.sandbox.ts`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/src/processors/synthetic.sandbox.ts:4`: o comentário ainda diz `sintetico.ts`. O certo é `synthetic.ts`.
- Não rodei `infra/test/jobs.int.test.ts`, que precisa da imagem. É o teste que prova o sandbox do worker no `dist`, então ele precisa estar verde na esteira antes do pouso.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 05:48:52 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (tabela "Testes que provam a regra" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/6_task.md` mais as linhas 6.0 de `travas.md`): `conferir`; `restos` e esteira; `data-testid` e rotas iguais; rename só de caixa no checkout limpo; cerca A e C; guardiões A; `ZONAS` C; `correcao.int.test.ts` A (ou `fica`); `assistente.int.test.ts` A; avatar A; `infra/scripts` e `ARQUIVO_DO_SANDBOX` C; eslint 72 e 116 C; `guardas.test.ts:159`; `mutacoes.ts` A; `chunk-names` A. Somam-se as "Achadas na 6.0" (travas 134 a 146), e a Tech Spec §10 pede um bloco por trava.

**Cobertos.** Rodei 12 arquivos de teste: 746 casos verdes, entre eles `restos`, `filtros-casam`, `camadas`, `guardioes`, `chunk-names`, `playwright`, `mutacoes`, o teste do avatar, `guardas`, `escola.repository`, `architecture` e `conferir`. Esta é a situação de cada linha:
- **Com bloco que chega à cláusula:** cerca A (o C cita `camadas.test.ts › real: todo alvo de regra existe no grafo`), guardiões (`ui/ai/`, `gallery/`, `index.css`, `chunk-names.ts`), avatar, `ARQUIVO_DO_SANDBOX` (`jobs.int.test.ts`), eslint 72 e 116, `knip`, `guardas.test.ts:159`, `chunk-names` (os dois blocos), `architecture.test.ts:1404`, `escola.repository.test.ts`, `playwright.test.ts`, a exceção do `sessao` em `camadas.cjs`, `carga.test.ts`, `revisoes.test.ts`, `textos-da-introducao` e `estrutura.spec.ts`.
- **`mutacoes.ts`:** o próprio `mutacoes.ts` não mudou. O bloco na linha 178 prova que `e2e/support/` continua apoio, porque o caso usa `e2e/support/seed.ts`. Vale.
- **`assistente.int.test.ts`:** a lista `tocam` não mudou, só os imports. O bloco que tira um item é uma prova de sanidade válida.
- **`correcao.int.test.ts`:** o `fica` está certo. O diff só toca imports, e `correcao.service.ts` e `lote.controller.ts` não mudaram de nome.
- **Diff:** é simétrico linha a linha fora de `tasks/`. Não há troca que não seja de nome.
- **Nada proibido:** não há `.skip`, mock nem provedor de IA. A tarefa não envolve concorrência.

**Bloqueantes:**

1. **`apps/api/test/architecture.test.ts:49` (`ZONAS`, linha 70 da tabela, trava 43) mudou sem bloco, e a prova que o `travas.md` declara não existe.**
   - O `restos` procura o arquivo pela forma `pasta-mãe/nome` (`tools/renomear/referencias.ts:38`), que aqui é `tenant/resolucao-de-tenant.repository`. A regex só tem `resolucao-de-tenant\.repository`, sem o `tenant/`, então o `restos` não a vê.
   - A alternância com `\bResolucaoDeTenantRepository\b` esconde a metade do caminho de todos os casos, também na 7.0.
   - Pôr isso em "Recomendações sem aplicar" não fecha o cenário.
   - **Correção:** um bloco que prove a metade viva tirando a metade da classe. Conferi que nenhum arquivo de `sessao/` tem mais o caminho antigo e que 15 de produção têm o novo, então a mutação abaixo fica vermelha pela metade do caminho.
     ```
     arquivo: apps/api/test/architecture.test.ts
     teste: apps/api/test/architecture.test.ts › a varredura enxerga o código: acha as três classes dentro da zona delas
     -  { classe: 'ResolucaoDeTenantRepository', uso: /\bResolucaoDeTenantRepository\b|tenant-resolution\.repository/, zona: ['apps/api/src/sessao/'] },
     +  { classe: 'ResolucaoDeTenantRepository', uso: /resolucao-de-tenant\.repository/, zona: ['apps/api/src/sessao/'] },
     ```
     A outra saída é o Arquiteto registrar a divergência da trava 43 e dizer onde ela passa a ser provada.

2. **`infra/scripts/carga-login.ts:338-339`, `carga-sala.ts:249-250` e `ensaio-alertas.ts:679` (o `dist`, linha 74 da tabela, trava 85) ficaram sem bloco.** A linha 74 junta `infra/scripts` e `ARQUIVO_DO_SANDBOX`, e só o segundo ganhou bloco. Cada item conta sozinho.
   - **Correção:** um bloco que devolva `apps/api/dist/sessao/tenant/synthetic-sessions.js` a `sessoes-sinteticas.js` em `carga-login.ts:338`. O teste citado é `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`, ou o caso da fonte "dist de infra/scripts e de medir-risco-a-vida" de `tools/guardas/filtros-casam.test.ts:232`.

3. **`apps/api/test/architecture.test.ts:1329-1339` (`QUEM_USA_A_ROTINA`, trava 139) e as listas das linhas 559, 634, 1394 e 1439 ficaram sem bloco.**
   - `QUEM_USA_A_ROTINA` é a cerca de regra 10 que diz quem pode usar a única consulta sem escopo (`CronEscolasRepository`). Mudou de caminho, e um caso existente a alcança na forma A.
   - **Correção:** um bloco que devolva `'apps/worker/src/processors/expurgar-dado-pessoal.ts'` a `processadores/`, citando `architecture.test.ts › fora dos testes, só o worker-lote usa a lista de escolas da rotina`. O `existsSync` e a varredura ficam vermelhos.

4. **`apps/web/src/components/casca-sem-import.test.ts:43-44`, `perigo-cheio.test.ts:21` e `estilos.test.ts:96,384` (trava 140) ficaram sem bloco.**
   - Na linha 43, a regex `(?:ai|onca)` é cláusula, e o `restos` não a alcança: `ai/` solto não é `pasta-mãe/nome`. É o mesmo furo do item 1.
   - **Correção:** ao menos um bloco que devolva `(?:ai|onca)` a `(?:ia|onca)`, citando `casca-sem-import.test.ts › o detector reprova a peça e a pasta por caminho relativo…` (o caso `motivoDeFora('./ui/ai/AssinaturaIA')`). Mais um na lista fechada de `perigo-cheio.test.ts:21`, citando `› os arquivos que o escrevem são os da lista fechada, nem mais nem menos`.

**Recomendações:**
- **Travas 138 (exemplos em `guardas`, `tamanho-das-pastas` e `filtros-casam`), 146 (rótulos do `.size-limit.json`), 95 (`eslint-suppressions.json`) e o comentário de `infra/compose.yml:381`:** são texto, e o `restos` os pega. Um bloco cada, citando o `restos`, fecharia o "um bloco por trava" da §10. A 95 depende de o lint rodar sem supressão órfã, e a validação deve conferir isso no portão.
- **"Rename só de caixa":** o `6.json` não tem nenhuma entrada só de caixa, e `git ls-files | sort -f | uniq -di` não acha colisão. Vale escrever na tabela que o cenário não se aplica nesta onda, em vez de deixá-lo sem prova.
- **Cerca, forma C (linha 68):** o `travas.md` diz que o `path` entra na trava contra filtro vazio. O bloco cita `camadas.test.ts › real: todo alvo de regra existe no grafo`, que prova a mesma coisa, mas convém alinhar o texto da linha 68 ou citar o caso de `filtros-casam.test.ts` que lê o `camadas.cjs`.
- **Bloco do `assistente.int.test.ts`:** ele tira um item da lista em vez de devolver um nome antigo. Vale dizer na tabela que é prova de sanidade, porque a lista não mudou.
- **Fixture `kit-importa-api.ts`:** a decisão de `fica` (e se ganha linha em "Não muda, mas parece") continua com o Arquiteto, como o documento já registra.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 05:49:12 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: divergência em §5, passo 5, e §2 (o caminho em comentário e documento vivo muda na onda que move o arquivo)
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`, 24 mutações no carimbo)

Bloqueantes:

1. **Subtarefa 6.4, terceiro item: a busca dos nomes antigos em `apps/web/src`, `e2e/` e `docs/` foi marcada feita, mas a árvore ainda aponta para caminhos que esta onda moveu.** Isso fere o RF3 ("nem no comentário que a nomeia") e o RF6 ("busca dos nomes antigos de apoio: zero", para `e2e/__fixtures__`). O `restos` dá limpo porque só procura o caminho com a pasta-mãe e o nome (`src/componentes`, `e2e/__fixtures__`). O caminho parcial em comentário escapa dele, e justamente por isso a 6.4 pedia a busca à mão. Há casos em que o mesmo arquivo ficou meio trocado, prova de que a onda o tocou e parou no meio:
   - `apps/worker/src/config.ts:68`: `processadores/synthetic.sandbox.ts`. O arquivo foi trocado e a pasta não.
   - `.size-limit.json:33`: `componentes/ui/ (com as de ui/ai/)`. A `travas.md:146` diz que o `restos` zera esse rótulo, e a pasta continua no nome antigo.
   - `apps/web/chunk-names.ts:22,24,91`: `src/galeria/` e `componentes/ui/ia/`. No mesmo arquivo, a linha 16 já foi trocada.
   - `apps/web/src/components/ui/ai/README.md:3-5,58`: `apps/web/src/componentes/ui/`, `ui/campos/`, `ui/sobrepostos/`, `ui/icones/`, `src/galeria/Galeria.tsx`, `componentes/estado`.
   - `apps/web/src/areas/navigation.ts:13-16`: `../../componentes/ui/ia/CaixaPedido`, `src/rotas.tsx`, `paginas/`, `src/componentes/ui/ia/README.md`.
   - `apps/web/src/__fixtures__/importers.ts:4,14,32,33`, `danger-solid.ts:5,31`, `components/ui/onca/CabecaOnca.tsx:221`, `components/ui/SeloDeEstado.tsx:5,30`, `components/ui/Comemoracao.tsx:19`, `areas/coordenacao/privacidade/AvisoDeIncidente.tsx:47`, `areas/professor/ferramentas/icones-de-ferramenta.tsx:7`, `areas/professor/artefatos/api/titulos-dos-materiais.ts:9`.
   - No e2e: `e2e/components-{ai,button,gallery,overlays,surfaces}.spec.ts` citam `__fixtures__/galeria.ts`, que hoje é `support/gallery.ts`. `e2e/aluno-{atividade,inicio,tutor}.spec.ts` citam `__fixtures__/aluno.ts`, e `e2e/aluno-fluxo.spec.ts:12` cita `__fixtures__/a3.ts`, que hoje é `support/atividade-db.ts`. Também ficaram `e2e/components-brand-icons.spec.ts:10-11`, `components-brand-onca.spec.ts:11-12`, `components-fields.spec.ts:12` e `introducao-components.spec.ts:11`.
   - Em `docs/`: `pendencias-dos-mockups.md:12` (`componentes/ui/ia/motor-formulario.ts`, que agora é `schema-form.ts`), `glossario.md:243,250,252`, `interface.md:639,1145,1585,1637,1641`, `guia-do-desenvolvedor.md:166,283,337,415`, `arquitetura.md:198` e `mvp-rapido.md:543`.

   **Correção exigida:** rodar a busca da 6.4 pelas formas parciais (`componentes/`, `ui/ia/`, `ui/campos/`, `ui/icones/`, `ui/sobrepostos/`, `galeria/`, `secoes/`, `paginas/`, `processadores/`, `__fixtures__/` no e2e, `rotas.tsx`, `estilos.css`, e os nomes de arquivo do mapa sem a pasta-mãe). Trocar cada comentário e documento pelo caminho novo, ou registrar o que fica como `fica` no mapa, com o motivo. O texto de `describe`/`it`/`test` fica, porque o RF7 manda manter. Os caminhos virtuais de fixture, como `paginas/Fixture.tsx` em `estilos.test.ts`, ficam como estão. Se alguma parte de `docs/` for deixada para a 13.0, isso é divergência da Tech Spec §2 e precisa ser levado ao Arquiteto: não basta escrever no `6_task.md`. Depois, rodar o `restos` e o portão de novo.

Recomendações:
- A 6.4 deveria registrar no `6_task.md` o comando e o resultado da busca, como faz com o `conferir` e o `restos`. Sem isso, a prova não pode ser conferida.
- O `restos` deixa passar o caminho parcial em comentário, em `.md` dentro de `apps/` e no rótulo de JSON. Vale levar à retro como limite da ferramenta da 2.0 e registrar no `travas.md`, porque as ondas 9.0 a 11.0 vão repetir o mesmo ponto cego.
- As duas entradas `pasta` de `paginas`, a de `apps/web/src/paginas` e a de `operacao/paginas`, citam a mesma linha `inventario-web-e2e.md:409`. Isso está correto, porque a linha cobre as duas. Um comentário no mapa evitaria a dúvida.
- Ficou pendente a decisão sobre a fixture `tools/guardas/__fixtures__/kit-importa-api.ts`. Hoje ela está como `fica` por `inventario-web-e2e.md:557`, sem linha em "Não muda, mas parece".

Escopo e aderência conferidos sem achado:
- Nenhuma onda de símbolo foi antecipada: o diff palavra a palavra só troca caminho.
- `ops/` só move o `comando.ts`, que está no `inventario-back.md:400`. O `migrar.ts` e o `sessao-sintetica.ts` ficam onde estão.
- `correcao.service.ts` e `lote.controller.ts` não foram renomeados.
- Não houve rename só de caixa.
- As travas de `camadas.cjs`, `guardioes-por-caminho.ts`, `eslint.config.mjs`, `knip.json`, `chunk-names.ts` e `ARQUIVO_DO_SANDBOX` foram trocadas, e cada uma tem o bloco de mutação dela.

Dois desvios meus durante a revisão, já desfeitos:
- Rodei `git add -N` nos dois arquivos novos do mapa e desfiz com `git reset`. Eles voltaram a `??`.
- Um `portao-local.ts --help` começou o typecheck. O processo morreu e não regravou o carimbo, que continua válido.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/6_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/6.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/src/config.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/chunk-names.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/ai/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.size-limit.json

## infra-guardian · 2ª rodada · APROVADO · 2026-10-31 08:27:31 · `tasks/prd-nomes-de-mercado/6_task.md`

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
Recomendações:
- A tabela "Sem aplicar" da ordem registra que `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/infra/test/jobs.int.test.ts` não rodou nesta tarefa. Ele confere o sandbox do worker no `dist`, em `apps/worker/src/processors/synthetic.sandbox.ts`. Antes do pouso, o Validador precisa conferir que ele passou na esteira da `develop` (D52).
- `infra/scripts/carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` não mudaram nesta rodada. Eles importam `apps/api/dist/sessao/tenant/synthetic-sessions.js`, e o teste de carga só funciona se esse caminho existir no `dist` gerado. Na mesma esteira, rodar `carga-login` uma vez em modo seco confirma que o `dist` tem o caminho novo.

Nesta rodada, como manda a regra de rodada nova, li só o diff (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/6_task-diff-r2.patch`, 165 arquivos). A rodada anterior não exigiu correção de infra. Fora de comentário e documentação, o diff só muda três coisas:
- o rótulo `name` de uma entrada em `.size-limit.json`, sem mudar o limite;
- o texto de um erro e da sua espera no e2e, em `e2e/support/profiles.ts` e `e2e/components-gallery.spec.ts`;
- quatro entradas novas no mapa `tools/renomear/mapas/6.json`.

Nada disso é rate limit, fila, gateway de IA, estado em memória, query, migration, métrica ou rota.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-31 08:27:31 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. O diff da 2ª rodada não tem migration nem schema.
Queries verificadas: nenhuma lógica de query mudou. Em `apps/api/src/ops/operacao-privacidade.repository.ts`, `apps/api/src/ops/escola.ts`, `apps/api/src/ops/uso.ts`, `apps/api/src/operacao/entrada/entrada.service.ts`, `apps/api/src/operacao/mfa/segundo-fator.service.ts`, `apps/api/src/system/synthetic-jobs.controller.ts` e `apps/api/src/sala/codigo-da-sala.ts` o diff só troca, em comentário, o nome antigo de arquivo pelo novo. O que muda fora de comentário está na web, no e2e e nas ferramentas: texto do `.size-limit.json`, do README do kit e as mensagens de erro de `e2e/support/profiles.ts`. Nada disso toca escopo, endpoint nem `@Unscoped()`.
Teste de isolamento: presente e efetivo. A cerca de tenant em `apps/api/test/architecture.test.ts:49` (`ZONAS_DAS_CLASSES_CERCADAS`, `ResolucaoDeTenantRepository`) já usa o caminho novo, `tenant-resolution\.repository`. O arquivo existe em `apps/api/src/sessao/tenant/tenant-resolution.repository.ts`. Fora da zona `sessao/`, a classe só aparece em fixtures de `tools/guardas/__fixtures__/camadas/`, que a varredura exclui. O bloco de mutação novo em `tasks/prd-nomes-de-mercado/6_task.md` (item 1 da ordem r1) troca a regex só pelo caminho antigo, `resolucao-de-tenant\.repository`. Nenhum arquivo de `sessao/` tem mais esse caminho, então o caso "acha as três classes dentro da zona delas" falharia. A cerca continua provada.
Bloqueantes: nenhum.
Recomendações:
- Continua pendente, e foi para a 7.0, alinhar a chave `cerca-resolucao-de-tenant` (`tools/guardas/camadas.cjs:147`, `camadas.test.ts:142`) ao nome da classe quando ela for renomeada.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-31 08:27:40 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum caminho novo nem alterado nesta rodada. O diff `3725a8cc → 2f748dd4` (165 arquivos) mexe em comentários, documentação, rótulos do `.size-limit.json`, duas mensagens de erro do e2e, os registros que elas pedem em `tools/renomear/mapas/6.json` e no `6_task.md`. Os caminhos da 1ª rodada não mudaram. Todos com autor humano? sim

Decisão autônoma sobre aluno: ausente

Aprovação registrada: ok. Nenhum fluxo de entrega, artefato ou correção mudou. Nas linhas que tratam de aprovação, só o caminho citado nos comentários mudou: `apps/web/src/main.tsx` e o comentário da `LinhaAprovacao`, `componentes/ui/ia/` → `components/ui/ai/`.

Supervisão do tutor: ok. As mudanças que tocam o tutor são caminhos em comentário: `e2e/aluno-tutor.spec.ts:12` (`__fixtures__/aluno.ts` → `support/`) e `apps/web/src/areas/aluno/memoria-do-aluno.ts` (`memoria-da-aba.ts` → `tab-store.ts`). Nenhuma regra do modo sala ou do modo casa mudou.

Autonomia declarada e visível: sim. Nada em `governanca` mudou nesta rodada.

Bloqueantes: nenhum.

O que conferi além do diff:
- **Testes que provam a regra 70.** Os 14 que a seção "Checagem" de `.claude/rules/70-conformidade-cne.md` cita existem na árvore de agora. Isso vale para os que esta onda moveu, `apps/web/src/components/ui/ai/avatar-com-funcao-e-selo.test.tsx` e `apps/web/src/components/MenuDaPessoa.test.tsx`. A regra 70 continua com teste que a prova.
- **Mudanças fora de comentário.** São duas mensagens de erro (`e2e/support/profiles.ts` e `e2e/components-gallery.spec.ts`, `perfis.ts` → `profiles.ts`), registradas como troca à mão no `6.json`. Nenhuma toca nota, correção, discursiva ou redação (D55), indicador de professor (D45, D64) ou saída de aba (D70).
- **Arquivos de configuração.** As mudanças em `tools/guardas/camadas.cjs`, `eslint.config.mjs`, `vitest.config.ts` e `packages/shared/src/system/job-definitions.ts` são todas em comentário. Nenhuma cerca de nota ou de saída de IA mudou de comportamento.
- **`docs/regulacao.md`.** Não mudou nesta rodada.

Correções exigidas na 1ª rodada: nenhuma, porque a 1ª rodada não teve bloqueante desta auditoria. Os itens 1 a 9 da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/6_task-r1.md` vieram do `test-engineer` e do `revisor-geral`, e nenhum deles toca a regra 70.

Recomendações:
- Fica de pé a recomendação da 1ª rodada, deixada sem aplicar porque está fora do recorte da Tech Spec: `docs/decisoes.md:1506` ainda cita `apps/web/src/componentes/ui/onca/`. Ela vale para a retro.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 08:28:13 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Cenários exigidos: os quatro bloqueantes da 1ª rodada.
1. `ZONAS_DAS_CLASSES_CERCADAS`: a parte do caminho na regex precisa de prova própria (trava 43).
2. O caminho do `dist` em `infra/scripts` (trava 85).
3. `QUEM_USA_A_ROTINA` (trava 139).
4. Os caminhos do kit lidos como texto, pelo menos `casca-sem-import` e `perigo-cheio` (trava 140).

Também conferi que o diff r2 só muda texto ou comentário, e que o carimbo do portão lista as mutações provadas.

Cobertos:
- **1 (ZONAS).** O bloco é o que eu propus: tira o nome da classe e põe o caminho antigo na regex. Nenhum arquivo de `apps/api/src/sessao` tem mais `resolucao-de-tenant.repository`, e 17 têm `tenant-resolution.repository`. Com a mutação, `dentro.length` fica 0 em "acha as três classes dentro da zona delas", e o teste fica vermelho pelo motivo certo.
- **2 (`dist`).** Há um bloco para cada um dos três scripts (`carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts`), todos citando `restos.test.ts › a árvore não tem resto dos mapas aplicados`. Cada item ganhou o seu bloco, como foi pedido.
- **3 (`QUEM_USA_A_ROTINA`).** O bloco devolve o processador para `processadores/`. O `existsSync` de "fora dos testes, só o worker-lote usa a lista de escolas da rotina" fica vermelho.
- **4 (kit).**
  - O bloco de `casca-sem-import` devolve `(?:ai|onca)` para `(?:ia|onca)`. O caso `motivoDeFora('./ui/ai/AssinaturaIA')` passa a dar `null`, e o teste fica vermelho pelo motivo certo.
  - O bloco de `perigo-cheio` muda a chave da lista fechada. `novos` e `sumidos` ficam não vazios.
- **Recomendações 6 a 9 da ordem.** Também foram aplicadas:
  - os comentários de `tools/vitrine/escola.ts` e `synthetic.sandbox.ts`;
  - os blocos das travas de texto 95, 138, 146 e `compose.yml`;
  - a nota de sanidade no bloco de `assistente.int.test.ts`;
  - o comando e o resultado da busca da 6.4.
- **Diff r2.** Fora o `6_task.md` e o `6.json`, o diff só muda caminhos em comentários e documentos. A única mudança de comportamento é a mensagem de erro de `e2e/support/profiles.ts:95` (`perfis.ts` → `profiles.ts`). Ela casa com o `toThrow` de `e2e/components-gallery.spec.ts:195` e está registrada em `excecoesDoConferir` do `6.json`.
- **Portão.** `.processo/portao.json` registra 37 mutações provadas para este documento.
- **Testes.** Rodei os quatro arquivos citados pelos blocos novos (`architecture`, `casca-sem-import`, `perigo-cheio`, `estilos`): 138 de 138 passaram.

Bloqueantes: nenhum.

Recomendações:
- **Bloco de `estilos.test.ts`.** O bloco extra (linha 96) cita "a cor escrita à mão é de duas peças só", na linha 556 de `apps/web/src/estilos.test.ts`. Esse caso compara a constante com uma lista escrita no próprio teste, então fica vermelho com qualquer mudança, e não porque o arquivo sumiu. O caso que prova que o caminho existe é "nenhum arquivo da web pede cor fora do @theme da 9.10…" (linha 369), com o `toContain` "saiu do lugar" da linha 386. Vale citar esse no bloco. Não bloqueia: a ordem não exigia bloco para `estilos`, e o `restos` cobre `componentes/CodigoQr`.
- **Listas de `architecture.test.ts`.** As listas das linhas 559, 634, 1394 e 1439 continuam sem bloco próprio. A ordem exigiu só o `QUEM_USA_A_ROTINA`. Na retro, vale registrar no `travas.md` se essas listas ficam cobertas pelo `existsSync` ou pela varredura de cada caso.
- **Nome do teste em `perigo-cheio`.** O bloco cita o caso pelo começo do nome ("…os da lista fechada", sem "nem mais nem menos"). O portão aceitou, mas o nome inteiro evita ambiguidade se surgir outro caso com o mesmo começo.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/6_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/casca-sem-import.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/perigo-cheio.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/estilos.test.ts`

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 08:28:54 · `tasks/prd-nomes-de-mercado/6_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)

Bloqueantes: nenhum.

O bloqueante da 1ª rodada foi corrigido. Rodei de novo a busca que a 6.4 registra, pelas formas parciais (`componentes/`, `ui/ia/`, `ui/campos/`, `ui/icones/`, `ui/sobrepostos/`, `galeria/`, `secoes/`, `paginas/`, `processadores/`, `rotas.tsx`, `estilos.css`, `__fixtures__/` no e2e e em `tools/ci`). Busquei também as pastas movidas do back e da web: `sessao/{saida,renovacao,externa,conclusao}`, `operacao/{segundo-fator,componentes,paginas}`, `sistema/`, `estado/`, `ajustes/` e `worker/src/executor`. Fora dos títulos de `describe`/`it`, que o RF7 manda manter, só sobram três coisas, e as três estão de propósito:
- a rota `/v1/sessao/externa/`;
- a fixture `kit-importa-api.ts`, registrada como `fica`;
- a frase histórica de `docs/mvp-rapido.md:323`.

Os pontos que apontei antes estão trocados: `config.ts:68` do worker, `.size-limit.json`, `chunk-names.ts`, o `README.md` de `ui/ai/`, `navigation.ts`, os specs do e2e e os `docs/`.

O diff da rodada só mexe em comentários, documentos e nos blocos de mutação da ordem (itens 1 a 4, 7 e 8). A única mudança fora de comentário e de documento é a mensagem de erro de `e2e/support/profiles.ts:95`, que acompanha a asserção de `e2e/components-gallery.spec.ts:195`. Ela está declarada no `6.json` como manda o RF7.

Recomendações:
- **Arquivos fora dos "Arquivos previstos".** A correção mexeu em `packages/core/src/telemetry/metrics.test.ts`, `packages/shared/src/system/job-definitions.ts`, `vitest.config.ts`, `.size-limit.json` e `infra/compose.yml`, e nenhum deles está na lista. São só comentário e rótulo, o mesmo caso que o Arquiteto já classificou como "Detalhe não previsto" na triagem de 31/10. Ele deve nomeá-los na lista, como fez com os outros.
- **Restos pelo nome do arquivo sem a pasta.** A 6.4 diz que "o que sobra é só o que o RF7 manda manter", mas a busca ainda acha estes:
  - `tools/processo/revisoes.test.ts:2072`: o comentário cita `tema.ts`, e o código da linha seguinte já usa `theme.ts`.
  - `TODO.md:1640`: cita `cena.ts`, e a mesma linha já diz `scenario.ts`.
  - `TODO.md:1832`: cita `executor.ts`, que hoje é `job-executor.ts`.
  - `apps/web/chunk-names.test.ts:137`: o caminho virtual leva a pasta nova `components\ui\ai\` com o nome antigo `textos-das-fontes.ts`, que hoje é `source-labels.ts`.

  Os três primeiros estão fora do alcance do RF3 (`apps/`, `packages/`, `e2e/`), e o quarto é caminho virtual de teste. Por isso nenhum bloqueia, mas vale trocar ou registrar na próxima tarefa que tocar esses arquivos.
- **Limite do `restos`.** Ele não vê o nome do arquivo sem a pasta-mãe nem a regex com pedaço do caminho. A ordem já mandou isso ao Arquiteto e à retro, antes das ondas 9.0 a 11.0. A busca manual da 6.4 continua necessária nas próximas ondas até a ferramenta cobrir esses casos.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/6_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/6_task-r1.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/processo/revisoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/chunk-names.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/TODO.md
