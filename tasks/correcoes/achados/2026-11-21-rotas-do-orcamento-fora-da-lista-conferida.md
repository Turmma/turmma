# Achados das revisões — `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 10:24:08 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

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
- O título do `describe` em `apps/api/test/ops-escola.int.test.ts:213` ainda diz "fora das duas do painel da operação". A lista conferida agora tem oito rotas, quatro delas do painel da operação. Vale trocar para "fora da lista conferida", que é o texto do próprio `it`.

O diff só mexe em teste e não muda nada às 10h de segunda. Ele inclui as duas rotas na lista do teste que confere que nenhuma rota cria rede ou escola (`ROTAS_PERMITIDAS`). Conferi as duas em `apps/api/src/operacao/painel/painel.controller.ts:89` e `:99`.

- **Caminho:** cada uma é um `PUT` dentro de `v1/operacao`, e as entradas novas da lista batem com esses caminhos.
- **Limite de uso:** as duas usam `@OperacaoRoute()`, que limita por operador (`rl:op:{sub}`), não por IP.
- **Filtro:** a regra que marca rota de escrita com rede ou escola no caminho (`criaRedeOuEscola`) não mudou. As asserções novas mostram que o `POST` nos mesmos caminhos continua sendo pego.
- **Provedor pago:** nenhum teste chama provedor pago.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 10:24:14 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta correção. Conferi as duas que as rotas escrevem. `configuracao_operacional_escola` tem `escolaId`, e o único `insert` cria só essa linha com `onConflictDoNothing`, nunca uma `escola`. `rede` fica acima do tenant e recebe só `update`, sem `insert`.

Queries verificadas:
- `OrcamentoDoMesRepository.lockConfiguracaoDaEscola`, `saveConfiguracaoDaEscola` e `configuracaoDaRede` (`packages/core/src/ia/orcamento-do-mes.repository.ts:190-215`): o escopo vem de `requireEscolaId()`, do contexto, e não de argumento.
- `OrcamentoDaRedeRepository.definir` (`apps/api/src/operacao/painel/orcamento-da-rede.repository.ts`): é `@Unscoped` com justificativa escrita, preso a `rede.id` do caminho, e só o operador o alcança.
- `PainelService.definirOrcamentoDaEscola` (`apps/api/src/operacao/painel/painel.service.ts:245-272`): roda em `runInContext({ escolaId })` com o id do caminho, e a rota é `@OperacaoRoute`. A chave estrangeira recusada (`23503`) vira `NAO_ENCONTRADO`, sem resposta diferente que revele se a escola existe.
- As duas rotas em `apps/api/src/operacao/painel/painel.controller.ts:89-106` são `@OperacaoRoute()`. O que a tarefa afirma na "Causa" bate com o código.

Teste de isolamento: presente e efetivo. Esta correção não cria escopo novo, e o teste dela é a guarda de "nenhuma rota cria rede nem escola". A exceção casa método e caminho exatos. As asserções novas provam que `POST` nas mesmas rotas continua pego e que só o `PUT` passa. O teste que lista as rotas registradas no Nest não mudou e segue pegando qualquer rota de escrita nova fora da lista. Se as duas entradas novas saíssem, ele voltaria a falhar, como falhou na esteira.

Bloqueantes: nenhum.

Recomendações:
- O título do `describe` diz "fora das duas do painel da operação", mas `ROTAS_PERMITIDAS` já tem oito entradas. Vale trocar por "fora da lista conferida" (`apps/api/test/ops-escola.int.test.ts:209`).

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 10:24:16 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só no teste `apps/api/test/ops-escola.int.test.ts`. Ela acrescenta duas rotas à lista `ROTAS_PERMITIDAS`, duas linhas de comentário explicando por quê, e quatro asserções no caso do filtro. Não há migration, DTO, log nem envio externo novo.

Fora da tabela de dados do docs/lgpd.md: nada. O que as duas rotas gravam é configuração de orçamento de IA da escola e da rede (`configuracao_operacional_escola`, colunas `ia*` de `rede`). Isso não é dado de pessoa.

Autorização por objeto: ok. A correção não abre acesso novo. Conferi no código as justificativas que entraram no teste:
- `apps/api/src/operacao/painel/painel.controller.ts:89-107`: as duas rotas são `@OperacaoRoute()`, usam `IdPipe` no `:id` e respondem com `no-store`. Só a sessão de operador Turmma chega nelas.
- `packages/core/src/ia/orcamento-do-mes.repository.ts:192`: o único `insert … onConflictDoNothing` é da linha de configuração da escola. Nenhum cria `escola`.
- `apps/api/src/operacao/painel/orcamento-da-rede.repository.ts:32`: faz só `update` de `rede` pelo id do caminho, sem `insert`.

Então liberar o `PUT` nessas duas rotas não deixa ninguém criar rede ou escola. O filtro `criaRedeOuEscola` ficou como estava. As asserções novas provam que o `POST` nas mesmas rotas continua barrado.

Logs: limpos. Nenhum log foi tocado.

Auditoria: não se aplica a esta correção. Nenhuma das ações da regra 20.10 foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. A mudança não traz fixture nova; as asserções usam só caminhos de rota.

Bloqueantes: nenhum.

Recomendações:
- O que deixou a falha escondida foi o teto de tempo da esteira, não uma lacuna de privacidade. Ainda assim, vale registrar na retro que rota nova com `escolas` ou `redes` no caminho precisa atualizar `ROTAS_PERMITIDAS` na mesma tarefa. Assim o portão local pega isso antes da esteira.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 10:24:45 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

VEREDITO: APROVADO

**Cenários exigidos:**
1. **Caminho feliz:** as duas rotas `PUT .../orcamento-ia` passam pela lista conferida, e a enumeração das rotas do Nest volta a ficar verde.
2. **Borda, método:** a entrada da lista vale só para o método conferido. `POST` na mesma rota continua sendo pego pelo filtro.
3. **Borda, filtro intacto:** o regex `criaRedeOuEscola` e o teste que enumera as rotas não mudam. Assim a lista não vira brecha genérica para `escolas/:id/*`.
4. **Permissão:** só a sessão de operador alcança as rotas (`@OperacaoRoute`). Credencial de escola recebe a mesma resposta de rota inexistente.
5. **Isolamento e justificativa:** rede ou escola inexistente dá `NAO_ENCONTRADO`, sem criar linha. É a premissa da justificativa escrita na lista.

**Cobertos:**
- **1 e 3:** `apps/api/test/ops-escola.int.test.ts:250`, com as entradas novas em `:204-205`. Rodei `npx vitest run apps/api/test/ops-escola.int.test.ts` e passaram os 9 casos. A entrada é a string exata `MÉTODO caminho`, então a lista não abre caminho para outras rotas.
- **2:** `ops-escola.int.test.ts:242-245`. Os dois `PUT` dão `false` e os dois `POST` dão `true`. Sem a entrada na lista, o `PUT` daria `true`, porque o segmento `escolas`/`redes` casa com o regex. As asserções falhariam sem a correção.
- **4 e 5:** já cobertos pela tarefa 3.0, em `apps/api/test/painel-escrita.int.test.ts`:
  - `:615` cobre escola e rede inexistentes, e id que não é UUID: `NAO_ENCONTRADO` sem linha nem auditoria.
  - `:641` cobre o isolamento: o PUT na escola A não muda a B, e o da rede 1 não muda a rede 2.
  - `:687` cobre a sessão da própria escola: resposta igual à da rota inexistente.
- **Justificativa conferida no código:** a única gravação do lado da escola é o `insert … onConflictDoNothing` na `configuracao_operacional_escola` (`packages/core/src/ia/orcamento-do-mes.repository.ts:192`). Do lado da rede, `apps/api/src/operacao/painel/orcamento-da-rede.repository.ts:32` só faz `update` de `rede` pelo id. Não há `insert` em `escola` nem em `rede`.
- **Mutações:** nenhum código de `apps/*/src` ou `packages/*/src` mudou; o diff toca só o arquivo de teste. A RF17 não se aplica, e `--faltando: 0` está coerente.
- **Itens 4 a 6 do checklist:** sem `.skip`, sem teste comentado, sem mock e sem IA. A correção não tem operação concorrente; as corridas do PUT já estão cobertas em `painel-escrita.int.test.ts:780-892`.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Para a retro, sobre o processo:** a tarefa 3.0 criou duas rotas de escrita sem rodar `ops-escola.int.test.ts`, porque o arquivo não estava no diff dela. Vale estudar um caminho para o portão da tarefa rodar esse teste sempre que o diff tocar `@Post`, `@Put`, `@Patch` ou `@Delete` em controller. Assim a falha aparece antes do commit, e não quando a integração da esteira chega nele.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 11:26:09 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`conferir` aceitou typecheck, lint, segredo, dependências, unidade e alvo para a árvore atual)
Bloqueantes: nenhum
Recomendações: nenhuma nova.

Esta rodada só trocou o título do `describe`, em `apps/api/test/ops-escola.int.test.ts:217`. É a recomendação que o tenancy-guardian e o infra-guardian deram na rodada anterior. O título novo é "fora da lista conferida", o mesmo termo que o caso da linha 250 usa. O título antigo falava em "duas do painel da operação", e isso já não valia: `ROTAS_PERMITIDAS` (linhas 197 a 206) tem oito rotas, e só algumas são do painel.

A troca não mexe na lógica: `criaRedeOuEscola`, a lista conferida e as asserções continuam como na rodada aprovada. A 1ª rodada não exigiu correções, então não havia nada a conferir. As recomendações do privacy-guardian e do test-engineer que ficaram sem aplicar estão registradas no documento da correção, cada uma com destino, como pede o processo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 11:26:17 · `tasks/correcoes/2026-11-21-rotas-do-orcamento-fora-da-lista-conferida.md`

VEREDITO: APROVADO

Cenários exigidos (da 1ª rodada, sem mudança):
- Caminho feliz: as duas rotas `PUT .../orcamento-ia` (da escola e da rede) estão na lista conferida e o teste de varredura passa.
- Permissão: mudar o método dessas rotas para `POST` volta a contar como "cria rede ou escola" e o teste falha.
- Borda: rota que só lê (`GET /v1/escolas/:slug/acesso`) e rota fora do padrão (`POST /v1/sistema/jobs-sinteticos`) não são marcadas.

Cobertos: todos. Desde a rodada aprovada, a única mudança no teste é o título do `describe` em `apps/api/test/ops-escola.int.test.ts:217`. Ele passou a se chamar "permissão: nenhuma rota da API cria rede nem escola, fora da lista conferida", que é a recomendação de tenancy-guardian e infra-guardian, já aplicada. Nenhuma asserção mudou. As oito asserções sobre o método, que a 1ª rodada já tinha auditado, continuam iguais. Rodei de novo só esse `describe` (`npx vitest run test/ops-escola.int.test.ts -t "fora da lista conferida"`): 2 testes passaram. Os 7 marcados como pulados ficaram de fora pelo filtro `-t`. Não há `.skip` no arquivo.

Correções exigidas na rodada anterior: nenhuma, e nada a conferir.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As duas da 1ª rodada (para a retro: o portão rodar este teste quando o diff mexe em verbo de escrita de controller) continuam em "Recomendações sem aplicar" do documento, com destino.
