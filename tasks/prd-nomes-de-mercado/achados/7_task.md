# Achados das revisões — `tasks/prd-nomes-de-mercado/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 11:08:57 · `tasks/prd-nomes-de-mercado/7_task.md`

VEREDITO: APROVADO

A 7.0 só troca nomes. Para provar isso, apliquei o mapa `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/7.json` ao contrário (nome novo de volta ao antigo) em todos os 279 arquivos alterados e comparei com o `HEAD`. Sobraram só quatro diferenças, todas esperadas:
- As duas regex de `apps/api/test/architecture.test.ts` (linhas 49 e 1398). O `\b` grudado no nome impede a troca de volta, e as duas já usam o nome novo, como deviam.
- A chave e os comentários da cerca `cerca-tenant-resolution`, em `tools/guardas/camadas.cjs` e `camadas.test.ts`. A troca está prevista na tarefa.
- Os textos de processo em `tasks/`.

Nenhuma condição, campo, consulta ou caminho de escrita mudou. `docs/regulacao.md` e os demais `docs/` não foram tocados. Rodei `architecture.test.ts`, `governanca.test.ts` e `lote-read-marker.test.ts`: 94 de 94 passaram.

Caminhos de escrita em Nota: o caminho da correção de objetiva (`apps/api/src/atividade/correcao/correcao.service.ts`, que exige o registro de leitura do lote pelo `LoteReadMarker` antes de gravar). Nada de importação, seed, job ou webhook entrou ou mudou. O diff desse arquivo é só o nome do tipo da dependência (`LeituraDoLote` → `LoteReadMarker`). Todos com autor humano? sim, sem mudança em relação ao `HEAD`.

Decisão autônoma sobre aluno: ausente. Nenhum fluxo novo, e o diff não acrescenta condição.

Aprovação registrada: ok. `entrega`, `artefato` e `assistente` só têm tipos de dependência renomeados (`ExecucaoScheduler`, `IaRequestRateLimit`, `TrechoSearch`). O registro de quem pediu cada execução de agente continua preso à pessoa: `requireUsuarioId()` (antes `exigirUsuarioDoContexto`) em `apps/api/src/ia/execucao.repository.ts:108,130,144,155,164`.

Supervisão do tutor: ok. `tutor.service.ts`, `tutor.module.ts` e `tutor.repository.ts` só trocam nome. Em `tutor.int.test.ts` a única troca é `LinhaDeSinal` → `SinalRow`, e as asserções são as mesmas.

Autonomia declarada e visível: sim, sem mudança. A suspensão de função continua conferida pela `FuncaoSuspensionCheck` (`apps/api/src/ia/ia.module.ts:81,84`), e o teste dela em `apps/api/src/ia/ia.int.test.ts:392-393` só trocou o nome da classe.

Os demais itens não mudaram de comportamento: a auditoria (item 6), supervisão sem vigilância (item 7), nenhuma nota proposta em discursiva e redação (item 8, D55) e o painel do professor (item 9, D45). O painel de operação (`apps/api/src/operacao/painel/*`) também é só rename. A cerca da tenant-resolution e os marcadores de operação continuam recusando o mesmo: as regex apontam para os nomes novos e os casos passam.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/ia/README.md:34,37,52` ainda cita `AgendadorDeExecucoes` e `ConferenciaDeFuncao.exigirAtiva('correcao_de_objetiva')`. É documento, fica para a 13.0, mas convém anotar lá: é o trecho que explica onde a suspensão da correção de objetiva é conferida.
- Alguns títulos de caso ainda levam o nome antigo, como o `describe('AgendadorDeExecucoes'` em `apps/api/src/ia/ia.int.test.ts:691` e o `it('operador.repository.ts não declara nem reexporta ConferenciaDoAutor'` em `apps/api/test/architecture.test.ts:1397`. A RF7 manda manter, mas vale registrar na retro para quem procurar pelo nome novo.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-31 11:09:44 · `tasks/prd-nomes-de-mercado/7_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não tem migration nem schema, e nenhum arquivo de packages/core/src/db foi tocado.
Queries verificadas: os 279 arquivos do diff. Desfiz o rename aplicando o mapa tools/renomear/mapas/7.json ao contrário nas linhas adicionadas e comparei com as removidas. Só duas linhas sobraram, e as duas são falso positivo da minha própria comparação (o `\b` da regex grudado no nome): /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts:49 (a regex da zona, agora `TenantResolutionRepository`) e :1397 (`AuthorCheck`). Nenhum `where`, `eq(…escolaId…)`, `@Unscoped` ou justificativa mudou além do nome. Nenhum campo de contrato, chave de Redis ou prefixo de rate limit mudou. Nas strings de produção mudaram só as descrições de `Symbol(...)` dos tokens de DI e o `this.name` de cinco classes de erro. Os nomes com letra minúscula no mapa (requireUsuarioId, escolaBucket, loadConfig, envSchema etc.) são nomes de função ou de variável, nunca de coluna nem de campo de DTO.
Teste de isolamento: presente e efetivo. A tarefa não cria módulo novo, então não cabe teste de isolamento novo. As travas de tenant que existiam continuam alcançando o código renomeado:
  - a zona `TenantResolutionRepository` (architecture.test.ts:49): a regex casa com a classe de hoje, e o bloco de mutação deixa vermelho o caso "acha as três classes dentro da zona";
  - a regex dos marcadores `OperacaoRoute`/`OperacaoLoginRoute` (:552) e as fixtures `fora` (651, 652) têm bloco de mutação;
  - a cerca `cerca-tenant-resolution` em tools/guardas/camadas.cjs:147 tem o mesmo `from` e o mesmo `to`, e a fixture que a acompanha está em camadas.test.ts:142.
  Rodei architecture.test.ts, camadas.test.ts, repositories-com-escopo.test.ts e matriz.test.ts: 169 de 169 verdes. O `tsc -p apps/api/tsconfig.json --noEmit` passou limpo.
Bloqueantes: nenhum
Recomendações:
  - Vários títulos de caso de isolamento continuam com o nome antigo, de propósito (RF7): architecture.test.ts:76, :134, :149, :666, :764, :1397, e apps/api/test/operacao-isolamento.int.test.ts:159 (`@RotaDeOperacao`). Quem cuida disso é a 8.0 ou a 13.0, mas enquanto não trocarem o título cita uma classe que não existe mais, e isso atrapalha quem procura a trava pelo nome.
  - Os comentários de camadas.cjs passaram a dizer `@Unscoped`, mas a mensagem do core continua `'@SemEscopo exige justificativa escrita'`. Fica dito em dois lugares diferentes para o mesmo decorador. Vale registrar na 13.0.
```

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 11:10:08 · `tasks/prd-nomes-de-mercado/7_task.md`

VEREDITO: APROVADO

A tarefa 7.0 só troca nomes de símbolo. Não toca em dado de pessoa, em formato de resposta, em log nem em auditoria. A cerca da resolução de tenant e os marcadores de operação continuam recusando o que recusavam.

Campos pessoais tocados: nenhum. Não há migration, schema nem campo novo. Em 279 arquivos alterados, nenhum nome foi trocado em chave de objeto de saída. Conferi isso por script, buscando cada nome antigo do mapa usado como chave nas linhas removidas: o único caso é a fixture de texto `'TenantResolutionRepository: tools/vaza.ts'` em `apps/api/test/architecture.test.ts`. Em `artefato.service.ts`, `correcao.service.ts`, `tutor.service.ts`, `privacidade.service.ts`, `ops/privacidade.ts` e `ops/retencao.ts`, o diff troca só tipo, classe e comentário.

Fora da tabela de dados do docs/lgpd.md: nada, porque nenhum campo entrou.

Autorização por objeto: ok. Nenhuma condição de acesso mudou. A cerca `cerca-tenant-resolution` em `tools/guardas/camadas.cjs:147` continua apontando para `sessao/tenant/tenant-resolution.repository.ts`, com a mesma severidade e os mesmos `from` e `pathNot`. A chave da fixture em `tools/guardas/camadas.test.ts:142` acompanha a regra. `NOMES_DOS_MARCADORES` e `ZONAS_DAS_CLASSES_CERCADAS` estão nos nomes novos. Rodei `architecture.test.ts`, `camadas.test.ts` e `contracts.test.ts`: 99 de 99 passaram.

Logs: limpos. As únicas linhas de log no diff são as de `DatabaseModule`, `RateLimitModule` e `UsageModule`. Mudou só o nome da classe que chama o logger; o contexto continua fixo (`'banco'`, `'limite'`, `'uso'`) e a mensagem é só uma chave de evento. O eslint, com as guardas de log e de erro, passou limpo em `apps/api/src`, nos `src` do worker, do realtime e do despachante, e em `infra/scripts`.

Auditoria: presente e intocada. Nenhuma ação de auditoria nem sua string mudou. Em `ops/privacidade.ts` e `ops/retencao.ts` a conferência do autor continua igual (só o tipo virou `AuthorCheck`), e o erro continua mostrando só o nome da opção, nunca o valor.

Envio externo: nenhum novo. O caminho do tutor e da IA (`TrechoSearch`, `ExecucaoScheduler`, `IaRequestRateLimit`) só mudou de nome, sem mudar o que é montado nem para onde vai.

Seed/fixture: sintético. `infra/scripts/carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` só renomeiam `PasswordHasher`, `createSyntheticSessions` e `syntheticTokenIssuer`. Escolas, matrículas e senhas continuam sintéticas (nomes "Escola sintética …", senhas de `randomBytes`).

Outras strings que mudaram, sem efeito sobre dado:
- **Nome interno das classes de erro** (`this.name`, por exemplo `SecretDecryptionError`, `InvalidArgumentError`): nenhum código compara por esse nome, e nada em `apps/api/src/configure-app.ts` o põe na resposta.
- **Descrição dos `Symbol` de DI**: fica só dentro do processo.
- **Valores de cookie e de prefixo de chave Redis**: só a constante foi renomeada, o valor ficou igual. Assim os desafios já consumidos e os cookies de dispositivo continuam válidos depois do deploy.

Pergunta de fechamento: a resposta é a mesma de antes desta tarefa. O código de pedido do titular, arquivo do titular e retenção mudou só nome de tipo.

Bloqueantes: nenhum

Recomendações:
- O texto `'@SemEscopo exige justificativa escrita'`, que fica no core por decisão da tarefa, agora convive com os comentários do `camadas.cjs` falando em `@Unscoped`. Vale alinhar na 13.0, junto com os documentos, para quem lê a mensagem de erro não procurar um decorador que não existe mais.
- Os títulos dos casos de `architecture.test.ts` ainda citam `ResolucaoDeTenantRepository` e `ConferenciaDoAutor` (RF7, a tarefa manda manter só o nome). Isso não pesa na privacidade; fica para quando a regra dos títulos for revista.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/7.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/7.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/camadas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 11:11:49 · `tasks/prd-nomes-de-mercado/7_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: login | sala | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O `this.name` mudou em cinco classes de erro (SecretDecryptionError, InvalidArgumentError, OperadorRejectedError, DesativacaoRejectedError, ExternalProviderError). Esse nome sai no campo `tipo` do log por /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/error/summarize-error.ts:63. Nenhum alerta, runbook ou `docs/` usa os nomes antigos (procurei, não achei nada). Mesmo assim, a nota de pouso da spec deveria avisar que busca de log salva com o `tipo` antigo deixa de achar o erro.
- Os títulos de caso ainda citam os nomes antigos, por exemplo /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/ops/sessao-sintetica.test.ts:17, /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/ops/revogar-acessos-sala.test.ts:36 e /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/credencial/password-hasher.test.ts:13 (`describe('HashDeSenha')`). A RF7 permite isso, mas convém registrar para a 13.0 ou para a retro, para quem procurar o nome novo no relatório de teste.
```

Como conferi:
- **Literais de texto do diff:** só mudaram as descrições de `Symbol(...)` dos tokens de injeção e o `this.name` dos erros. Não mudou nenhum prefixo de chave Redis (os valores de `USED_CHALLENGE_PREFIX` e `USED_OPERADOR_CHALLENGE_PREFIX` são os mesmos), nenhum nome de cookie, nenhuma variável de ambiente, nenhum nome de métrica ou de fila, e nenhuma mensagem de log (`limite.redis_indisponivel`, `uso.contador_indisponivel` e afins continuam iguais).
- **Limitadores:** `IaRequestRateLimit`, `LoginLockout`, os buckets de login por escola e por equipe, `RateLimitModule`, `UsageModule` e `SalaRateLimits` mudaram só de nome. A lógica, as chaves e o escopo por usuário e por escola são os mesmos.
- **Migrations, compose, `.github`, alertas e runbook:** nada mudou.
- **Tipagem:** `tsc --noEmit` passou em `infra/` e nos quatro apps (api, worker, realtime, despachante). Os scripts de carga (`carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts`) estão com as chaves novas.
- **Testes:** `architecture.test.ts` e `camadas.test.ts` passaram (94 casos), com a cerca `cerca-tenant-resolution` e os marcadores de operação ainda recusando o que recusavam. `infra/test/alertas.test.ts` passou (14 casos).
- **Nomes antigos que sobram em `apps/` e `e2e/`:** `lerConfiguracao`, `ProntidaoController` do realtime e `EtapaDoDesafioDeOperador` da web. A tarefa já marca esses como `fica` ou como trabalho da 8.0.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 11:11:54 · `tasks/prd-nomes-de-mercado/7_task.md`

VEREDITO: REPROVADO
Escopo: invadiu tarefa futura (um comentário que a triagem deixou para a 8.0)
Aderência à Tech Spec: divergência em `apps/realtime/test/realtime.fixture.ts:21`, que contraria a triagem de 31/10 e a própria classificação do mapa
Portão local: carimbo válido

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/realtime/test/realtime.fixture.ts:21`: o comentário passou a dizer "Configuração pelo mesmo `loadConfig` do boot". Ele fala da função de configuração do próprio realtime, que continua `lerConfiguracao`: o arquivo a importa na linha 11, a chama na linha 25, e `apps/realtime/src/config.ts:56` ainda a declara assim. `loadConfig` só existe em `apps/api/src/config.ts:120`. A troca entra no que a 8.0 vai fazer. A divergência resolvida na `7_task.md` diz "o lerConfiguracao dos três apps fica para a 8.0", e o mapa classifica essa ocorrência como `fica` (`tools/renomear/mapas/7.json`, entrada `apps/realtime/test/realtime.fixture.ts` / `lerConfiguracao`, linha do anexo `inventario-back.md:329`). O resultado contradiz o mapa, e o relatório não mostra a troca. **Correção exigida:** voltar o comentário para `lerConfiguracao` (a 8.0 o troca junto com a função) e rodar de novo o `conferir` e o `restos`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md`, seção "Achadas na 7.0": duas linhas descrevem uma prova diferente do bloco de mutação da `7_task.md`. Vale alinhar o texto ao bloco:
  - Na linha do `AuthorCheck`, a tabela diz `export type { AuthorCheck }`, e o bloco usa `export type AuthorCheck = unknown`.
  - Na linha da cerca, a tabela diz "com a chave nova: o caso ... fica vermelho", e o bloco põe a chave antiga no `camadas.test.ts`.
- Vale descobrir por que o `aplicar` trocou um comentário num arquivo cuja ocorrência está como `fica`, e por que o `conferir` e o `restos` não acusaram. Senão a 8.0 pode ter o mesmo furo no sentido contrário.
- A Autoconferência 4 pedia o caso das zonas vermelho com o nome antigo na regex. A mutação declarada usa um nome inventado, e a justificativa está escrita. Mesmo assim, o caso que tem `'TenantResolutionRepository: tools/vaza.ts'` na lista esperada parece ser o que fica vermelho com o nome antigo. Ele poderia ser o alvo de um segundo bloco, mais fiel ao que a tarefa pediu.
- `ContaExternalRepository` mistura português e inglês num nome só (o destino vem do `inventario-back.md:94`). Fica para a retro do inventário, não para esta onda.

O resto conferido não tem achado:
- As 279 linhas tiradas e postas em `apps/api/src` só trocam nome.
- Só mudaram strings que a `travas.md` lista: as descrições de `Symbol`, o `this.name` das classes de erro e os rótulos de teste.
- Não sobra `static com(` nem `Module.com(`.
- A cerca `cerca-tenant-resolution` e as fixtures dos marcadores acompanham a classe.
- O `typecheck` da raiz inclui `infra/tsconfig.json`.
- O parágrafo novo da Tech Spec §5 cobre os arquivos fora dos previstos que a tarefa tocou.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 11:12:19 · `tasks/prd-nomes-de-mercado/7_task.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:**
- caminho feliz: `conferir` mostra só troca de nome, com os mesmos casos (RF7), e `restos` não acha nome antigo em código
- "com" em prosa e em string fica
- `--escopo` recusa edição em `tools/` fora dos previstos ou em documento
- fixtures das camadas liberadas como `fica`
- isolamento: a cerca `TenantResolutionRepository` (`ZONAS`, `cerca-tenant-resolution`) e os marcadores de operação continuam recusando o que recusavam
- `NOMES_QUE_SAIRAM` e `AuthorCheck` não voltam a ser exportados
- `HashDeSenha` e as outras chaves de `infra/scripts` batem com o `dist`
- concorrência não se aplica: o rename não muda comportamento

**Cobertos:**
- Rodei `architecture.test.ts`, `camadas.test.ts`, `login.service.test.ts` e `restos.test.ts`: 137 de 138 verdes. O que falhou foi o caso da linha 76 de `architecture.test.ts`, que estourou o prazo de 5 s (12,8 s) com a máquina carregada pelos outros revisores. Sozinho, ele passa.
- `npx tsc -p infra/tsconfig.json --noEmit` está limpo. Nos três scripts, cada chave de tipo literal tem o mesmo nome do `typeof` ao lado.
- Os 91 arquivos de teste alterados tiram 122 `expect` e põem 122. Não entrou nenhum `.skip`, `.only`, `any` nem teste comentado.
- O "com" está coberto por `aplicar.test.ts:120`, que já existia. Não sobra `.com(` nos apps, e todo `forRoot` novo é de `Module.forRoot` ou `static forRoot`.
- As descrições antigas de `Symbol` e os `this.name` antigos não aparecem em `infra/`, `packages/`, `e2e/`, `tools/` nem na web.
- Os blocos que provam o que prometem: a regex de `NOMES_DOS_MARCADORES` e as fixtures 651 e 652, o `PasswordHasher` do barrel, `AuthorCheck` (forma B), `NOMES_QUE_SAIRAM` (forma B), a chave `cerca-tenant-resolution`, e os blocos C do `Symbol` e do `this.name`.

**Bloqueantes:**

1. **O bloco de `ZONAS` não prova a volta ao nome antigo.** Pontos: `7_task.md:66`, `7_task.md:99-106` e `travas.md:43`.
   - **O que está errado:** o próprio documento define a forma A como devolver a trava ao nome antigo e ver um caso que já existe ficar vermelho. O bloco declarado faz outra coisa: troca a regex por um nome inventado (`TenantResolutionRepositoryAntigo|tenant-resolution-antigo`). Isso prova que a regex é necessária, mas não que voltar a `ResolucaoDeTenantRepository` seria pego. E o caso que a tabela e o `travas.md:43` citam ("acha as três classes dentro da zona", linhas 67 a 74) não fica vermelho com o nome antigo, como o documento admite: a alternativa `tenant-resolution\.repository` da regex continua casando em `sessao/`. A Autoconferência pede exatamente "confira que ele fica vermelho com o nome antigo na regex", e isso não foi feito.
   - **Quem pega de fato:** o caso "reprova quem usa a classe por uma ponte de dentro da zona…" (`architecture.test.ts:80`). Com a regex antiga, a fixture `tools/vaza.ts` (linha 85, que importa `TenantResolutionRepository` de `ponte.js`) deixa de casar, e o `toEqual` das linhas 101 a 107 falha.
   - **Correção exigida:** acrescentar o bloco com `uso: /\bResolucaoDeTenantRepository\b|tenant-resolution\.repository/` citando esse caso, e corrigir a prova escrita na linha 66 da tabela e no `travas.md:43`. O bloco atual pode ficar.

2. **As fixtures 657 a 659 constam como vermelhas e nenhum bloco prova isso.** Pontos: `7_task.md:67`, `7_task.md:108` e `travas.md:46`.
   - **O que está errado:** a tabela diz "651, 652 e 657 a 659: vermelhos", e a seção Mutações diz que 657 a 659 não ficam vermelhas. O item juntado aos outros fica sem teste, o mesmo erro da X3. Essas fixtures existem para mostrar que o marcador **com o nome atual** é absolvido pela pasta, pelo comentário ou pelo caminho de teste. Com o nome antigo, elas passariam sem provar nada, e nada perceberia.
   - **Isso tem prova sem acrescentar caso (RF7):**
     - 657: mover o `caminho` para fora de `apps/api/src/operacao/`, por exemplo `apps/api/src/estrutura/painel.controller.ts`;
     - 658: tirar o comentário do texto, deixando `'@OperacaoRoute()\nconst x = 1'`;
     - 659: trocar `apps/api/test/qualquer.int.test.ts` por um caminho que não seja de teste.

     Cada uma dessas fica vermelha só porque a fixture usa o nome que a regex conhece.
   - **Correção exigida:** os três blocos, citando o caso "a varredura reprova o marcador fora da pasta…". A outra saída é reescrever a linha 67 da tabela e o `travas.md:46` dizendo que só 651 e 652 são provadas, mas aí as três fixtures ficam sem proteção.

**Recomendações:**
- Explicar no texto que o bloco da regex de `ZONAS` é um controle de que a regex é necessária, e não a forma A.
- O caso `architecture.test.ts:76` percorre o repositório inteiro e estourou o prazo padrão de 5 s com carga em paralelo. Isso já existia antes desta tarefa, mas na esteira pode dar vermelho intermitente. Vale um `{ timeout }` explícito, como os testes de `tools/renomear/` já têm, ou ler o repositório uma vez só por `describe`. Fica registrado para o `TODO.md` ou a retro.
- O `travas.md:159` diz que a prova da cerca é "o caso que importa o repository de fora de `sessao/`", mas o bloco cita outro caso, "toda regra da configuração tem a sua fixture…". Alinhar os dois textos.
- O `travas.md:158` fala em `export type { AuthorCheck }` e o bloco usa `export type AuthorCheck = unknown`. Alinhar o texto.
- `7_task.md:73` ainda cita `apps/api/test/arquitetura.test.ts`, que a 6.0 renomeou para `architecture.test.ts`.
- Nas chaves de `importar<…>` de `infra/scripts`, se a chave e o uso voltassem juntos ao nome antigo, o `tsc` continuaria verde e o erro só apareceria na execução. A convenção "chave igual ao `typeof`" segura isso hoje; uma guarda que compare os dois fecharia o buraco, fora desta onda.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 11:31:15 · `tasks/prd-nomes-de-mercado/7_task.md`

VEREDITO: APROVADO

Cenários exigidos (os da rodada 2, sobre o diff 48fdc4f7..2477d82d): a forma A de `ZONAS_DAS_CLASSES_CERCADAS`, isto é, a regex de volta ao nome antigo com um caso que já existe ficando vermelho; e as fixtures `inocentes` 657 a 659 de `NOMES_DOS_MARCADORES` provadas uma a uma, sem caso novo (RF7).

Cobertos:
- **Correção 1, feita.** O bloco em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/7_task.md:102-106` devolve a regex a `ResolucaoDeTenantRepository|resolucao-de-tenant\.repository` e cita "reprova quem usa a classe por uma ponte de dentro da zona". Conferi em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts`: a linha removida do bloco é igual à linha 49. A fixture `tools/vaza.ts` (linha 85) cita `TenantResolutionRepository` e `ponte.js`, e a regex antiga não casa com nenhum dos dois. Então `'TenantResolutionRepository: tools/vaza.ts'` sai do resultado e o `toEqual` das linhas 101 a 107 falha. É vermelho pelo motivo certo. O bloco antigo ficou (linhas 111-115) e o texto o apresenta como controle. A tabela (`7_task.md:66`) e o `travas.md:43` dizem o mesmo que os blocos.
- **Correção 2, feita com os três blocos.** Cada linha removida é igual à da fixture no arquivo (657, 658 e 659), e cada mutação tira só a absolvição:
  - **Bloco da 657** (`7_task.md:143-147`): o caminho `apps/api/src/estrutura/painel.controller.ts` passa no filtro `^(apps|packages)/[^/]+/src/`, não é teste e não começa por `PASTA_DA_OPERACAO`. A varredura o pega.
  - **Bloco da 658** (`7_task.md:150-154`): sem o comentário, `@OperacaoRoute()` sobra no código, fora de `operacao/`. A varredura o pega.
  - **Bloco da 659** (`7_task.md:157-161`): `apps/api/src/estrutura/qualquer.ts` não é caminho de teste e fica dentro de `src/`. A varredura o pega.
  - **Resultado**: nos três, o resultado ganha um caminho que não está em `fora`, e o `toEqual` da linha 662 falha. A tabela (`7_task.md:67`) e o `travas.md:46` dizem o mesmo.
- **Recomendações da 1ª rodada**: as três têm destino. O texto agora diz que o bloco da regex de ZONAS é um controle. O `travas.md:158` e o `:159` batem com os blocos das linhas 175-179 e 195-198, e a `7_task.md:73` já cita `architecture.test.ts`. O timeout da linha 76 e a guarda de `importar<…>` foram para o `TODO.md`.
- **O comentário do realtime** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/realtime/test/realtime.fixture.ts:21`) voltou ao HEAD e diz `lerConfiguracao` de novo, que é a troca da 8.0. Nenhum outro código mudou nesta rodada.
- **O que esta rodada não pede**: nenhum `.skip`, nenhum mock, nenhum provedor de IA e nenhuma operação concorrente. O rename não muda comportamento.
- **Como conferi**: lendo os blocos contra o arquivo de teste, sem rodar nada. Não rodei os testes nem apliquei as mutações: pelas regras deste papel, o portão da tarefa já prova cada bloco.

Bloqueantes: nenhum.

Recomendações:
- O `teste:` do bloco da forma A de ZONAS (`7_task.md:103`) é só o começo do título do caso. Vale conferir que o `mutacoes.ts` casa títulos por prefixo. Se não casar, o portão já recusou o bloco, então o único risco é de leitura. Escrever o título inteiro, como nos outros blocos, deixa isso fora de dúvida.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 11:31:31 · `tasks/prd-nomes-de-mercado/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` deu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

O bloqueante da 1ª rodada foi resolvido. Em `apps/realtime/test/realtime.fixture.ts:21` o comentário voltou a dizer `lerConfiguracao`, que é o que o arquivo importa na linha 11 e chama na linha 25, e o que `apps/realtime/src/config.ts:56` declara. O arquivo saiu do `git status`. O mapa (`tools/renomear/mapas/7.json`, entrada da `realtime.fixture.ts`) segue com `lerConfiguracao` como `fica`, e o resultado agora bate com ele. O relatório lista para esse arquivo só a classe `com`, nas linhas 21, 22 e 64. São as ocorrências em prosa e não uma troca. O portão valeu para a árvore atual com a unidade, e a unidade inclui o `restos`.

O que mudou no documento, conferido contra o código:
- O bloco novo de `ZONAS` (forma A) volta a regex para `ResolucaoDeTenantRepository|resolucao-de-tenant.repository`. A fixture `tools/vaza.ts` (`architecture.test.ts:86`) importa `TenantResolutionRepository` de `ponte.js` e deixa de casar, e o `toEqual` das linhas 101 a 107 perde `'TenantResolutionRepository: tools/vaza.ts'`. O vermelho que o texto descreve é coerente. O bloco antigo agora se apresenta como controle, com o motivo escrito.
- Os três blocos das fixtures inocentes 657, 658 e 659 citam as linhas que de fato estão em `architecture.test.ts:657-659`. Em cada um sai a absolvição (a pasta, o comentário ou o caminho de teste) e o nome atual fica.
- As linhas 43, 46, 158 e 159 de `travas.md` estão alinhadas aos blocos. `AuthorCheck` passou a ser `export type AuthorCheck = unknown`, e a cerca passou a usar a chave antiga com o caso "toda regra da configuração tem a sua fixture…".
- Todas as recomendações da 1ª rodada estão em "Recomendações sem aplicar", cada uma com destino: 13.0, retro, `TODO.md` ou nota de pouso.

Nenhum código de produção mudou nesta rodada.

Recomendações:
- O título do caso em `apps/api/test/architecture.test.ts:76` ainda diz `ResolucaoDeTenantRepository`. O RF7 manda manter, e o documento já levou isso para a retro. Fica aqui só como lembrete para quando a retro rodar.
- Rodar a investigação do `TODO.md` sobre por que o `aplicar` trocou uma ocorrência marcada `fica` antes de a 8.0 começar. A 8.0 é justamente a onda que troca o `lerConfiguracao`.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/realtime/test/realtime.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/7.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/7.relatorio.md
