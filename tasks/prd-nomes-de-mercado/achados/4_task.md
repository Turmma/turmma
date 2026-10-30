# Achados das revisões — `tasks/prd-nomes-de-mercado/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-10-30 19:19:07 · `tasks/prd-nomes-de-mercado/4_task.md`

Typecheck limpo. Os testes da camada de IA e das guardas passam: 1369 de 1369.

```
VEREDITO: APROVADO
Perfis usados: nenhum novo. A tarefa só renomeia símbolos, e nenhuma chamada de modelo foi adicionada, removida ou trocada de perfil.
Custo estimado por professor/mês: sem variação (R$ 0 de delta). Nenhuma chamada nova ao modelo.
Prompt versionado: sim (não se aplica à mudança). Os sete arquivos em packages/nucleo/src/ia/prompts/ mudam só o tipo da anotação, de PromptVersionado para VersionedPrompt. O texto e a versão dos prompts ficam intactos.
Validação de schema: sim (não se aplica à mudança). A lógica de interpretar e validar em packages/nucleo/src/ia/provedor.ts muda só em nomes de tipos. O caminho de erro continua sendo LLMError, com os mesmos códigos de fio: IA_INDISPONIVEL, IA_TEMPO_ESGOTADO, MATERIAL_INSUFICIENTE e IA_ORCAMENTO_ESGOTADO.
Aprovação humana no caminho: não se aplica. A tarefa não mexe em entrega, nota nem artefato.
Bloqueantes: nenhum
Recomendações:
- Os nomes mistos continuam como estão, porque a 4.0 renomeia só os símbolos: parâmetros e campos em português (chamada, tarefa, codigoDeIa, correcoes) e o nome do arquivo (adaptador-roteirizado.ts, que agora guarda ScriptedAdapter). O pacote e os arquivos ficam para a 5.0. Registro só para a retro.
- AgenteExecutor, AgenteExecutorConfig e InProcessAgenteExecutor misturam português e inglês. A 4.0 registrou isso, e é decisão de nome, não violação de regra.
```

O que conferi na camada de IA:

- **Regra 30, item 1:** nenhum módulo passou a chamar provedor direto.
  - `grep` por `openai`, `@anthropic-ai/sdk`, `@google/genai` e `ollama` em `apps` e `packages` não achou import de SDK.
  - O único `fetch` em `packages/nucleo/src/ia` fica em `adaptador-openai-compat.ts:145`, dentro do adaptador.
  - `tools/guardas/regras-ia.mjs` e a fixture `sdk-de-ia.ts` não aparecem no diff, então a trava `sdk-de-ia-so-no-adaptador` continua como era.
- **Porta e adaptadores:**
  - A porta `LLMProvider` ficou com o nome. `ProvedorDeIa` virou `LLMGateway`, `AdaptadorFalso` virou `FakeAdapter` e `AdaptadorRoteirizado` virou `ScriptedAdapter`.
  - `AdaptadorDeModelo` virou `ModelAdapter`, e `AdaptadorResiliente` virou `ResilientAdapter`, que cuida de prazo e repetição.
  - `DefinicaoDeTarefa` virou `TaskDefinition`.
  - O diff de `porta.ts`, `adaptador.ts`, `tarefa.ts`, `erros.ts`, `consumo.ts`, `executor.ts` e `provedor.ts` mostra só substituição de identificador, de comentário e de `this.name`. Nenhum limite, perfil, orçamento nem ordem de chamada mudou.
  - `perfis.ts` não tem diff.
- **Config:** `loadLLMConfig` e `llmEnvSchema` mudaram de nome, mas as variáveis de ambiente (`IA_ADAPTADOR`, `LLM_BASE_URL`) são as mesmas.
- **Teste sem provedor pago:** os testes de IA usam `FakeAdapter` e `ScriptedAdapter`, e o servidor de Llama falso continua em `__fixtures__`.
- **`tools/ia/medir-risco-a-vida.ts`:** o carregamento dinâmico do núcleo foi atualizado junto com os símbolos (`loadLLMConfig`, `createLLMGateway`, `runInContext`, `InMemory*`). A medida do ouro não mudou: o recall do `riscoAVida` segue em 75/75.
- **Execução:** `npx vitest run packages/nucleo/src/ia tools/ia tools/guardas` passou, com 24 arquivos e 1369 testes. `tsc -p tsconfig.json --noEmit` saiu sem erro.
- **Migration:** não há arquivo de migration nem `_journal` no `git status`, como a tarefa exige.

Não rodei a esteira inteira (`npm run lint` e a suíte completa). O relatório da onda (`tools/renomear/mapas/4.relatorio.md`) marca "Estado: verde", e eu não o contestei.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 19:19:48 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: correção de objetiva com aprovação do lote (`apps/api/src/atividade/correcao/correcao.repository.ts`, `confirmadaPor` e `decididaPor` vindos de `requestSessao().usuarioId`) e a decisão da entrega (`apps/api/src/entrega/entrega.repository.ts`, `decididaPor` de `requestSessao().usuarioId`). Todos com autor humano? Sim. O rename só trocou `sessaoDaRequisicao` por `requestSessao`, que continua recusando quando falta sessão. O schema não mudou: só comentários, o nome do tipo `ConfiguredConcurrency` e o export `mvpTables`. Não há migration. O check de `decididaPor` em `entrega.ts:102` ficou como estava.

Decisão autônoma sobre aluno: ausente. Nada de comportamento mudou nos serviços de entrega, correção ou analista.

Aprovação registrada: ok. O que muda em `entrega.service.ts`, `correcao.service.ts` e `lote.controller.ts` é só o nome de `ErroDeDominio`, que virou `DomainException`, de `RegistroDeAuditoria`, que virou `AuditoriaRecorder`, e de `@Permite`, que virou `@RequirePermissao`. As mesmas recusas continuam: `ENTREGA_JA_DECIDIDA`, `DESTAQUES_NAO_ABERTOS`, `CONFLITO` e lote recusado por `decidir`. A exceção do tutor (D47) não chegou a outro agente.

Supervisão do tutor: ok. `tutor.int.test.ts` e `tutor-modelo.int.test.ts` só trocaram o tipo `ExecutorNoProcesso` por `InProcessAgenteExecutor`. `turno-do-tutor.ts` e o teste dele só renomearam esquemas e tipos. O texto dos prompts não mudou, e `MENSAGEM_DE_ASSUNTO_DELICADO` e `MENSAGEM_DE_RISCO_A_VIDA` continuam com o mesmo nome.

Autonomia declarada e visível: sim. `packages/shared/src/governanca/` não tem diff. O controller de governança só trocou o nome do decorator.

Bloqueantes: nenhum.

O que conferi:
- **Rename puro.** Inverti o `4.json` sobre as 661 linhas alteradas: em 651 arquivos, cada linha `+` vira exatamente a `-` que substituiu. Os 10 que não batem são os dez casos abaixo. Vi o diff deles, e não há mudança de lógica:
  - `apps/api/src/ia/`, quatro arquivos com alias de colisão (`ExecucaoRepository as ExecucaoRepositoryPort`);
  - `arquitetura.test.ts`, com a troca à mão prevista;
  - o guia, `migrar.ts` e `revisores.test.ts`, já registrados como divergência;
  - `4_task.md` e `travas.md`.
- **Nenhum teste da regra 70 sumiu.** Contei os `it`/`test` antes e depois. Ficaram iguais em `tabelas-do-mvp.int.test.ts` (53), `entrega.int.test.ts` (17), `tutor.int.test.ts` (47), `assistente.int.test.ts` (29), `governanca.int.test.ts` (22) e `auditoria.int.test.ts` (20).
- **D55.** `RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO` tem o mesmo nome e o mesmo uso em `assistente.int.test.ts`. `docs/regulacao.md`, `docs/agentes.md` e `docs/conformidade-mec.md` não têm diff.
- **Porta única de auditoria.** `porta-unica.test.ts:74` passou a conferir `insertAuditoria`, que é o nome novo, então a trava continua com efeito.
- **Gatilho do `conformidade-reviewer`.** Ele vai por caminho e por citação, não por nome de símbolo (`tools/processo/guardioes-por-caminho.ts:118`), então o rename não o enfraquece.
- **Testes rodados.** `turno-do-tutor.test.ts`, `porta-unica.test.ts`, `acoes.test.ts` e `packages/shared/src/governanca/governanca.test.ts` passaram: 565 de 565. Os testes de integração precisam de banco e não rodei; o diff deles é só de nomes.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/guia-do-desenvolvedor.md:111`: o diagrama ainda diz `@Permite(recurso, acao)` ao lado de `PermissaoGuard`, quando o decorator agora é `@RequirePermissao`. As colunas do diagrama também ficaram desalinhadas nas linhas 107 a 111.
- Alguns títulos de teste ainda usam os nomes antigos:
  - `porta-unica.test.ts:69` ("só o RegistroDeAuditoria") e `:129` ("sem @SemEscopo");
  - `apps/api/test/arquitetura.test.ts:178`, `:179`, `:316`, `:415`, `:512`, `:1342` e `:1348`.

  O RF7 mantém os mesmos casos e não proíbe atualizar o título. Fica para uma onda de texto, ou para a 5.0.
- `apps/api/test/arquitetura.test.ts:346`, `:428` e `:527`: o texto sintético das fixtures de alias ainda importa `type Banco`. Não muda nada na regra 70; quem confirma se a fixture ainda prova o que diz é o `tenancy-guardian`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-30 19:20:47 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. O `git status` só tem dois arquivos novos, `tools/renomear/mapas/4.json` e `4.relatorio.md`. Nenhum `escolaId` ou `anoLetivoId` saiu ou mudou: `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/4.json` deu verde, com 209404 itens e nenhuma diferença que o mapa não explique.

Queries verificadas: o mesmo `conferir` mostra que, nos repositories de `packages/nucleo`, `apps/*` e `tools/guardas/__fixtures__`, só mudaram nomes. Nenhuma cláusula `where` mudou, e nenhum `escolaId` passou a vir de parâmetro, corpo ou query. As travas foram conferidas uma a uma:
- `TIPOS_DO_BANCO` agora é `Database`, `DatabaseTransaction` e `DatabaseExecutor`, e o barrel exporta os três.
- `PROVAS_DE_ESCOPO` agora é `requireEscolaId`, `requestIdentity` e `jobScopeInContext`, e os três existem exportados.
- A guarda reconhece o decorator pelo import de `Unscoped`, que `packages/nucleo/src/db/sem-escopo.decorator.ts:16` exporta.
- `REPOSITORIES_SEM_ESCOPO` lista `insertAuditoria`, que existe em `packages/nucleo/src/auditoria/insercao-de-auditoria.repository.ts:27`.
- `SEM_ESCOPO` em `tools/processo/guardioes-por-caminho.ts:114` é `'@Unscoped('`.
- Os fixtures continuam importando de `@educa/nucleo`. `sem-escopo-local` e `copia-local` agora declaram a cópia local com o nome novo, então o caso continua testando o homônimo local e não passa por acaso.
- Os testes de `arquitetura.test.ts` sobre a justificativa sem escopo leem metadado em tempo de execução, por `unscopedJustification`, e não o texto do arquivo. Por isso não passam vazios depois do rename.

Teste de isolamento: presente e efetivo. Nenhum caso saiu, e o `conferir` compara os casos. Rodei `repositories-com-escopo.test.ts`, `porta-unica.test.ts`, `guardioes.test.ts`, `guardas.test.ts`, `sem-escopo.decorator.test.ts`, `arquitetura.test.ts`, `ciclo-de-vida.repository.test.ts`, `resolucao-de-tenant.repository.test.ts` e `matriz.test.ts`: 457 casos verdes. `npm run typecheck` também passou. As mutações de forma A continuam efetivas porque os fixtures usam os nomes novos: voltar um nome da trava ao antigo deixa a fixture correspondente sem prova e acusada. Não rodei as mutações, porque não edito arquivos. Elas ficam com o portão.

Bloqueantes: nenhum.

Recomendações:
- `packages/nucleo/src/db/sem-escopo.decorator.ts:18`: a mensagem diz `'@SemEscopo exige justificativa escrita'`, mas o decorator agora é `@Unscoped`. No mapa está como `fica`. Vale trocar na onda de textos, junto com o `toThrow` de `sem-escopo.decorator.test.ts:17-18`.
- `tools/guardas/escopo-dos-repositories.ts:80` e `:95`: os motivos de `REPOSITORIES_SEM_ESCOPO` ainda citam `exigirEscolaDoContexto`, `contextoAtual()` e `escopoDoJobNoContexto`, que não existem mais. Também estão como `fica`. Atualizar quando as strings entrarem.
- `tools/guardas/camadas.cjs:148` e `:162`, e os títulos de `it` e `describe` que dizem `@SemEscopo`: em `arquitetura.test.ts` (178, 179, 316, 415, 512, 1342, 1348), `repositories-com-escopo.test.ts` (87, 167, 168, 223, 232), `porta-unica.test.ts:129`, `ciclo-de-vida.repository.test.ts:14`, `resolucao-de-tenant.repository.test.ts:15` e `ia.int.test.ts:300`. Faz sentido que fiquem enquanto o RF7 pede os mesmos casos, mas quem procurar a marca nova por texto não acha esses lugares. Registrar para a onda que libera os títulos.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 19:20:51 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login | tutor | sala | fila | IA | migration | deploy (só nomes de símbolo; o comportamento não muda)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O campo `tipo` do log de erro (`summarizeError`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/erro/resumir-erro.ts:63`) vem do `this.name` e muda de valor: `ErroDoProvedor` passa a `ProviderError`, `PedidoDeJobRecusado` passa a `JobRequestRejectedError` etc. Nenhum alerta, painel ou o runbook lê esse campo, e a Tech Spec §7 já registra a troca. Falta avisar quem consulta o Loki à mão: durante a janela do deploy, uma busca pelo nome antigo só acha o que foi gravado antes dele.
- Os scripts `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/infra/scripts/carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` carregam `createDatabase` e `createPool` por import dinâmico de `packages/nucleo/dist/index.js`. Um `dist` desatualizado só quebra na hora de rodar, sem aviso do typecheck: rode o build do core antes do próximo ensaio de carga e de alertas. O typecheck (`npm run typecheck`) e 1239 testes de unidade de limite, fila, IA, worker, despachante e `borda.test.ts` passaram nesta árvore.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/infra/scripts/expurgo-da-carga.ts:85`, `PRIORIDADE_DO_LOTE = 3` é uma cópia, não importa `QUEUE_PRIORITY`. Isso já existia antes desta tarefa e fica para quando alguém mexer no arquivo.

Como conferi que o comportamento é o mesmo:
- **Números:** comparei os números em todas as linhas alteradas de `.ts`/`.mjs`, sem as fixtures. Nenhum mudou; a única diferença é o comentário novo do `revisores.test.ts`.
- **Constante citada:** `DEFAULT_RETRY_AFTER_SECONDS` continua valendo 5, e o `borda.test.ts:95` continua comparando com o `Retry-After` do Caddyfile.
- **Textos:** os literais entre aspas e entre crases só mudaram nos nomes que o mapa renomeia. São as travas, as mensagens das guardas e o `this.name` dos erros, que a adenda 1 previa. Nome de métrica, chave de Redis, nome de fila do BullMQ, variável de ambiente e campos do payload de job ficaram iguais. Por isso uma instância antiga e uma nova convivem durante o deploy.
- **Trocas fora do mapa:** só aparecem aliases de import (`migrate as drizzleMigrate`, `ExecucaoRepository as ExecucaoRepositoryPort`) e marcadores montados em `arquitetura.test.ts`. Nenhum altera o que o código faz.
- **Migrations:** nenhum arquivo de migration ou do `drizzle/` foi tocado.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 19:21:03 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

A tarefa só troca nomes. Comparei o diff de código (`apps`, `packages`, `tools`, `infra`, `eslint.config.mjs`) linha a linha, desfazendo os nomes pelo mapa `tools/renomear/mapas/4.json`. Sobraram 31 trechos com diferença, e conferi um por um: são casos que o script não desfaz sozinho, como o alias `drizzleMigrate`, o `ExecucaoRepositoryPort`, a chave lida por nome em `medir-risco-a-vida` e o comentário de `revisores.test.ts`. Nenhum muda o que o código faz. Rodei oito arquivos de teste de unidade (`porta-unica`, `acoes`, `repositories-com-escopo`, `guardas`, `logger`, `provedor`, `armazem-s3`, `contratos`): 412 casos, todos verdes. O portão e as mutações eu não rodei; eles ficam com o portão da tarefa.

```
Campos pessoais tocados: nenhum. Não há migration nem coluna nova; o diff em db/schema/ troca nome de tipo
  e comentário (VagasConfiguradas → ConfiguredConcurrency, tabelasDoMvp → mvpTables), sem mudar tabela.
Fora da tabela de dados do docs/lgpd.md: nenhum. Em docs/lgpd.md só mudou o literal `@SemEscopo` → `@Unscoped`.
Autorização por objeto: ok. Nenhuma rota, guarda ou repository mudou de comportamento. PROVAS_DE_ESCOPO,
  TIPOS_DO_BANCO, o export `Unscoped` e `insertAuditoria` em REPOSITORIES_SEM_ESCOPO acompanham os nomes novos,
  e repositories-com-escopo.test.ts passa com as fixtures.
Logs: limpos. Em regras-log.mjs a guarda agora reconhece o resumo de erro pelo nome `summarizeError`, e não sobrou
  nenhuma chamada a `resumirErro`. O NestLogger fica de fora de uma das guardas por caminho de arquivo
  (tools/guardas/index.mjs:124), não pelo nome da classe, então a troca não abre nada. CHAVES_PESSOAIS e
  CAMINHOS_REDACT não mudaram. O `tipo` que vai para o log é `erro.name`, nome de classe, sem dado de pessoa.
  A mutação que volta ao `resumirErro` está declarada.
Auditoria: presente. A porta única continua de pé: `insertAuditoria` não sai pelo índice do pacote
  (porta-unica.test.ts:74) e AuditoriaRecorder é a única porta de escrita. Os nomes das ações de auditoria
  (ACOES_DE_AUDITORIA) e CAMPOS_PROIBIDOS_NA_AUDITORIA não mudaram. Há mutações de forma A e B para as linhas
  49, 74 e 83.
Envio externo: nada muda. A troca de ProvedorDeIa → LLMGateway e de AdaptadorFalso → FakeAdapter é só de nome;
  o registro em ExecucaoAgente e o que se manda ao modelo continuam iguais.
Seed/fixture: sintético. As fixtures de tools/guardas/__fixtures__ só trocam nomes, e o "Enzo Martins" dos testes
  de log já estava lá.
Bloqueantes: nenhum
```

**DTO e erro tipado:** o filtro global (`packages/nucleo/src/erro/filtro-global.ts`) só trocou nomes: ErroDeDominio virou DomainException e a função de mapear o erro do Postgres virou mapPostgresError. O corpo da resposta continua levando só o código do erro e o `requisicaoId`, sem a pilha e sem o nome da classe. Os `this.name` novos das classes de erro não aparecem em nenhuma resposta, alerta ou painel de `infra/`; só os testes leem esses nomes (`montar-arquivo.int.test.ts`, `arquivo-do-titular.int.test.ts`), e cada um tem mutação declarada.

**Pergunta de fechamento:** a tarefa não mexe no arquivo do titular, na lista de compartilhamento nem no ExecucaoAgente além do nome. O código continua respondendo o que já respondia.

Recomendações (não bloqueiam):
1. Na mensagem de erro do decorator, `packages/nucleo/src/db/sem-escopo.decorator.ts:18`, ainda está escrito `'@SemEscopo exige justificativa escrita'`. Ela cita um decorator que não existe mais. O texto é testado em `sem-escopo.decorator.test.ts`; vale trocar as duas juntas numa onda futura.
2. Os motivos em REPOSITORIES_SEM_ESCOPO (`tools/guardas/escopo-dos-repositories.ts`, por volta das linhas 80 a 100) ainda citam `contextoAtual()`, `exigirEscolaDoContexto`, `AuditoriaRecusada`, `escopoDoJobNoContexto` e `TokenVerificado`. É texto livre, mas é o que um auditor lê para entender a exceção.
3. Ainda há nomes antigos em títulos de `describe` e `it`, que só servem para ler: `logger.test.ts:297` (`'LoggerDoNest'`), `:67`, `:349`, `guardas.test.ts:649`, e os comentários de `camadas.cjs:148` e `:162` (`@SemEscopo`). Se a 5.0 ou o `restos` não cobrirem isso, vale registrar.

Arquivos centrais que olhei:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-log.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/escopo-dos-repositories.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/auditoria/porta-unica.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/erro/filtro-global.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/erro/resumir-erro.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/log/logger.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 19:21:35 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: REPROVADO

Cenários exigidos (rename sem tela e sem migration, RF7): só nome, os mesmos casos e nenhum teste de isolamento sai. Cada trava renomeada precisa de um bloco que fique vermelho por causa dela: `TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO`, o export `Unscoped`, `insertAuditoria` em `REPOSITORIES_SEM_ESCOPO`, `'@Unscoped('` no `guardioes-por-caminho.ts`, o item 8 do `tenancy-guardian.md` e a gravação de antes, `CHAVES_DOS_MARCADORES`, `requireEscolaId()`, `USO_DA_ROTINA`, `summarizeError`, a porta única (74, 83, 49), os `this.name` lidos por teste, as chaves do `medir-risco-a-vida` e as chaves dos três scripts de `infra/` (forma C, `tsc`).

Cobertos:
- **RF7.** Nenhum `it`, `test` ou `describe` foi tocado no diff. Todo arquivo de teste tem tantas linhas tiradas quanto postas (359 `expect` saem e 359 entram), com uma exceção: o comentário do topo de `revisores.test.ts`. Nenhum teste foi apagado (o `git status` só traz modificados e os dois novos), e não entrou `.skip`, `.only`, `.todo` nem teste comentado. Os testes de isolamento estão todos lá.
- **Escopo dos repositories.** Os blocos de `TIPOS_DO_BANCO` (um por tipo), `PROVAS_DE_ESCOPO` (um por prova) e do export `Unscoped` ficam vermelhos pelo motivo certo: a fixture deixa de ser acusada, ou passa a ser acusada sem a marca `reprova:`. O de `insertAuditoria` (forma C) também: o teste "todo método público real…" roda sobre a árvore real.
- **Guardiões e gravação.** `'@Unscoped('` fica vermelho no caso da `componentes/ui/` (sai C I no lugar dos quatro). O `tenancy-guardian.md` e a gravação têm um bloco cada.
- **`arquitetura.test.ts`.** Em `CHAVES_DOS_MARCADORES`, as duas chaves de fora deixam de ser achadas. `requireEscolaId()` está coberto. Em `USO_DA_ROTINA`, os arquivos do worker importam a classe de `@educa/nucleo` sem o caminho, e saem da lista.
- **Log.** Com `summarizeError` no nome antigo, a fixture `log-permitido.ts` deixa de passar.
- **Porta única.** A regex da linha 49 e o `toEqual` da 83 provam que as duas travas estão vivas.
- **`this.name`.** As três classes que um teste lê por `name` têm bloco: `InvalidAuditoriaMapError`, `RoutesWithoutPermissaoError` e `FileStorageUnavailableError`. Nenhum teste nem `infra/` lê as outras seis.
- **`medir-risco-a-vida`.** O `ScriptedAdapter` tem bloco, e as outras chaves do teste estão no mesmo caminho que o caso percorre.
- **Infra.** Os três scripts de `infra/` foram provados à mão pelo `tsc`, como a forma C pede.
- **Árvore.** Nenhuma migration entrou e `packages/nucleo/drizzle` está sem diff. Rodei 7 arquivos de teste (504 casos) e todos passaram.

Bloqueantes:
1. **O bloco da forma B da porta única não alcança a linha 74.** Está em `tasks/prd-nomes-de-mercado/4_task.md:262-268` e devia provar `packages/nucleo/src/auditoria/porta-unica.test.ts:74`.
   - **O que acontece:** a mutação acrescenta `export { insertAuditoria } from './auditoria/insercao-de-auditoria.repository.js'` ao `index.ts`. Esse texto casa com `IMPORTA_O_MODULO_DE_INSERCAO`, então `importam` passa a ser `[index.ts, REGISTRO]`, e o caso cai antes, no `expect(importam).toEqual([REGISTRO])` da linha 73. O `not.toContain('insertAuditoria')` da linha 74 nunca chega a rodar.
   - **Por que bloqueia:** se a linha 74 tivesse ficado com `'inserirAuditoria'`, o bloco continuaria vermelho. Ele não prova a trava que a onda renomeou: é vermelho pelo motivo errado.
   - **Correção exigida:** pôr no `index.ts` a chave sem importar o módulo de inserção, por exemplo `+export const insertAuditoria = (): void => {}`. Aí a linha 73 continua verde e só a 74 fica vermelha. Depois, rodar o portão de novo.

Recomendações:
- A linha "`summarizeError` e `NestLogger`" da tabela de testes sugere uma trava `NestLogger`. Mas `LoggerDoNest`/`NestLogger` só aparece num comentário de `tools/guardas/index.mjs:122`; a exceção lê o caminho do arquivo. Vale dizer isso no documento, para a validação não procurar um bloco que não existe.
- Em `tools/ia/medir-risco-a-vida.ts`, as chaves `loadLLMConfig`, `createLLMGateway` e `runInContext` do `NucleoEmDist`, usadas em `principal`, não são alcançadas por teste nem pelo `tsc`. Hoje só o `restos` (forma C) as prova. O documento devia dizer isso; hoje ele só cita o bloco do `ScriptedAdapter`.
- `tools/ci/borda.test.ts:95` (`DEFAULT_RETRY_AFTER_SECONDS`) não aparece em "Mutações". Ele falha alto pelo `toBeDefined()`, o que vale como forma C, mas vale uma linha no documento.
- Em `tools/renomear/mapas/4.json` e no relatório, as referências a `travas.md` estão uma linha atrás: `travas.md:54` aponta a linha dos `this.name`, que hoje é a 55; o mesmo com 44 → 45, 108 → 109 e 109 → 110.
- O bloco do `toEqual` da linha 83 tira `LEITURA` do esperado: não é mutação de nome. Ele prova que a trava está viva, o que é aceitável, mas o texto do documento podia dizer só isso.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/4_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/auditoria/porta-unica.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/ia/medir-risco-a-vida.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.json

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-30 19:23:20 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: REPROVADO

Escopo: respeitado. Os únicos arquivos fora das pastas previstas são os dez restritos pela tarefa e pelas três divergências resolvidas, mais o `travas.md` (as linhas novas de "Achadas na 4.0" estão autorizadas pela Tech Spec §5 e pelo passo 3 do `tasks.md`). Nenhum arquivo, pasta ou pacote foi movido: isso é da 5.0. Nenhum símbolo de app foi renomeado: isso é da 7.0 à 11.0. Todas as 326 entradas do mapa estão em `packages/nucleo`, e cobrem as 300 linhas do core no inventário e as 26 da adenda 2.

Aderência à Tech Spec: há divergência na troca à mão (§5, passo 5, e RF3) e na referência ao `travas.md` (§5, `ocorrencias`). O resto confere:
- **Só nome:** o `conferir` deu verde (209.404 itens, nenhuma diferença que o mapa não explique). O `restos` deu limpo. Comparei o diff palavra a palavra contra o mapa, e fora das travas trocadas à mão só sobram dois apelidos de colisão (`ExecucaoRepositoryPort` e `drizzleMigrate`) e o comentário do `revisores.test.ts`.
- **Banco:** não há migration nova nem diff no `_journal`.
- **Mutações:** todos os blocos citam um caso que existe e uma linha que está no arquivo.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes:

1. **Nomes antigos que o relatório mandou trocar à mão e ficaram (RF3; Tech Spec §5, passo 5).** O `4.relatorio.md`, na seção "Troca à mão", lista estas ocorrências. O `restos` não as acha porque ignora palavra comum em comentário, e por isso a troca é da onda. Em todas, o comentário cita o símbolo do core pelo nome antigo:
   - `apps/api/src/app.module.ts:130`: "rota sem `@Permite` e sem `@Public`". A mesma linha já tem um nome novo e um antigo. Trocar para `@RequirePermissao`.
   - `apps/api/src/main.ts:28` e `apps/realtime/src/main.ts:12`: "(Drenagem, em @educa/nucleo)". Trocar para `GracefulShutdown`.
   - `docs/guia-do-desenvolvedor.md:111`, `:201` e `:207`: `@Permite(...)` no diagrama e no exemplo do controller. Na linha 111 o `PermissaoGuard` já é o nome novo. O documento vivo leva o nome nas ondas em fila (Tech Spec §2), e as outras três citações do mesmo guia já viraram `@RequirePermissao`. Trocar para `@RequirePermissao(`.
   - Antes de dar a lista por feita, revise de novo cada linha da "Troca à mão". As de `Banco`, `Dado`, `Ambiente` e `migrar` que conferi são prosa e ficam.

2. **A referência ao `travas.md` está deslocada em uma linha em `tools/renomear/mapas/4.json` (campo `linha` das `ocorrencias` com `classe: "trava"`) e em `tools/renomear/mapas/4.relatorio.md` (28 linhas da tabela).** O commit `bca02bcd` inseriu a linha 40 do `travas.md` depois de o mapa ser escrito, e toda referência da linha 40 em diante passou a apontar para a linha errada:
   - `travas.md:51` e `travas.md:108` caem na linha separadora `|---|`;
   - `travas.md:54`, usada nas 15 ocorrências de `this.name`, cai no `contratos.test.ts`;
   - `travas.md:44` (`CHAVES_DOS_MARCADORES`) cai no `tabelas-do-nucleo.test.ts`;
   - `travas.md:110` (`medir-risco-a-vida`) cai no `USO_DA_ROTINA`.

   A Tech Spec §5 define a `trava` como "com a linha do `travas.md`", e esse rastro é o que a 5.0 e o `reaplicar` vão ler. Correção: somar 1 a toda referência `travas.md:N` com N ≥ 40 no `4.json` (44, 51, 54, 55, 56, 98, 108, 109, 110) e gerar de novo o relatório, ou corrigi-lo na mesma medida.

Recomendações:
- `docs/guia-do-desenvolvedor.md:105-111`: o diagrama em ASCII perdeu o alinhamento das colunas com os nomes novos, mais curtos (`AuthGuard`, `RateLimitGuard`, `SessaoGuard`). O mesmo acontece no `docs/arquitetura.md`, na linha do `AllExceptionsFilter`.
- `tools/processo/harness/revisores.test.ts:13`: a frase entrou no fim do comentário do topo, e não nas linhas 5 a 7 que os previstos indicam. As linhas 6 e 7 continuam dizendo "nunca regravada" sem remeter à exceção, que fica seis linhas abaixo.
- Nas `ocorrencias` com `fica`, o campo `linha` aponta para a linha do próprio símbolo no inventário, e não para "Não muda, mas parece", como diz a §5. A 3.0 fez o mesmo. As ocorrências de `migrar` desfeitas à mão também não levam o motivo que a divergência pede ("registra … com o motivo"), porque o formato da ocorrência só tem `trecho`. Vale um ajuste da Tech Spec ou do `mapa.ts` para casar a regra com a prática.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/app.module.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/main.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/realtime/src/main.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/guia-do-desenvolvedor.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-30 19:46:37 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff entre as árvores `bd90ea30` e `ccc8ac71` não traz migration nem schema.

Queries verificadas: nenhuma mudou. O diff não toca em nenhum `*.repository.ts`, em `packages/nucleo/src/contexto`, em `tools/guardas` nem em `apps/api/test/arquitetura.test.ts`. O que mudou desde a 1ª rodada:
- `apps/api/src/app.module.ts:130`, `apps/api/src/main.ts:28` e `apps/realtime/src/main.ts:12`: só comentários, com `@Permite` trocado por `@RequirePermissao` e `Drenagem` por `GracefulShutdown`.
- `docs/guia-do-desenvolvedor.md`: o diagrama foi realinhado e `@Permite` virou `@RequirePermissao`. O texto ainda manda o repository tirar o escopo do contexto.
- `tools/renomear/mapas/4.json` e `4.relatorio.md`: só mudaram as referências de linha `travas.md:N` nos campos `linha` e `motivo`. Nenhuma entrada passou de `migrar` para `fica` nem o contrário, e nenhum símbolo novo entrou.
- `tasks/prd-nomes-de-mercado/4_task.md`: a mutação de `insertAuditoria` agora é uma constante, e entraram texto sobre `NestLogger`, `borda.test.ts` e a tabela de recomendações. Isso toca auditoria, não escopo de tenant.
- `tools/processo/harness/revisores.test.ts`: a nota sobre a exceção do literal `@Unscoped()` mudou de lugar no comentário. A linha 13 da gravação `__fixtures__/revisores-antes/tenancy-guardian.verificar.md` continua igual ao item 8 de `.claude/agents/tenancy-guardian.md:23`.

Confirmado: neste diff não mudou nenhum repository, query nem trava de escopo.

Teste de isolamento: presente e efetivo, como na 1ª rodada. A tarefa é de rename e não criou módulo novo, e os testes de isolamento que já existiam não mudaram neste diff.

Bloqueantes: nenhum

Recomendações:
- Continua aberta a recomendação da 1ª rodada, já registrada no `4_task.md` para o TODO.md: `sem-escopo.decorator.ts:18` e o `toThrow` de `sem-escopo.decorator.test.ts:17-18` ainda dizem "@SemEscopo exige justificativa escrita". O mesmo vale para os motivos de `REPOSITORIES_SEM_ESCOPO` em `escopo-dos-repositories.ts`, linhas 80 a 100, que ainda citam nomes antigos. Trocar a mensagem e o teste juntos.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 19:46:43 · `tasks/prd-nomes-de-mercado/4_task.md`

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
- As três recomendações de infra da 1ª rodada estão em "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/4_task.md`, cada uma com destino. Falta cumprir duas delas antes da próxima rodada operacional:
  - O aviso no `docs/runbook.md` de que o campo `tipo` do log muda de `ErroDoProvedor` para `ProviderError`.
  - O build do `dist` do core antes do próximo ensaio de carga e de alertas (`carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts`).

Escopo da rodada: o diff `bd90ea30` → `ccc8ac71` não muda código que roda.
- Comentários: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/app.module.ts:130`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/main.ts:22` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/realtime/src/main.ts:12`. Só trocam o nome antigo pelo novo; o drenar no SIGTERM e o PID 1 ficam como estavam.
- O diagrama e os exemplos de `docs/guia-do-desenvolvedor.md` foram realinhados e passaram a `@RequirePermissao`.
- Texto e blocos de mutação do `4_task.md`.
- O comentário de cabeçalho de `tools/processo/harness/revisores.test.ts`.
- Em `tools/renomear/mapas/4.json` e `4.relatorio.md`, só mudam as referências `travas.md:N` (deslocadas em uma linha) e os `motivo`. Nenhuma entrada `de`/`para` e nenhuma `classe` mudou.

Não há rate limit, fila, gateway de IA, estado em memória, query, migration nem métrica nova ou alterada.

## llm-integrator · 2ª rodada · APROVADO · 2026-10-30 19:46:46 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Perfis usados: não se aplica. O diff desde a 1ª rodada não adiciona nem altera chamada de modelo.
Custo estimado por professor/mês: sem variação em relação à 1ª rodada. O diff só toca comentário, documentação, arquivos de processo e o mapa de rename.
Prompt versionado: não se aplica
Validação de schema: não se aplica
Aprovação humana no caminho: não se aplica. A tarefa não altera nenhum caminho de entrega de agente.

Auditei o diff de `bd90ea30` para `ccc8ac71` e o que ele afeta. O que mudou:

- **Comentários em código:** `apps/api/src/app.module.ts`, `apps/api/src/main.ts` e `apps/realtime/src/main.ts`.
  - O de `app.module.ts` passa a citar `@RequirePermissao`.
  - Os dois de `main.ts` passam a citar `GracefulShutdown`. `packages/nucleo/src/index.ts:120` exporta de fato esse nome.
  - Nenhuma linha de código executável mudou.
- **Documentação:** `docs/guia-do-desenvolvedor.md`. O diagrama do pipeline e o exemplo do controller passam a usar `@RequirePermissao`, com o diagrama realinhado. A descrição do fluxo não mudou.
- **Harness:** `tools/processo/harness/revisores.test.ts`.
  - Só o comentário mudou. A exceção ao literal `@Unscoped()` na linha 13 do `tenancy-guardian` passou do fim do bloco para o meio dele.
  - A conferência continua a mesma.
- **Mapa e relatório do rename:** `tools/renomear/mapas/4.json`.
  - O único campo alterado nos itens do mapa é `linha`. As referências `travas.md:N` deslocaram em 1.
  - Nenhum símbolo, arquivo ou trecho mudou.
- **Texto da tarefa:** `4_task.md` e `4.relatorio.md`. Houve esclarecimentos sobre as mutações. Em `porta-unica.test.ts`, a mutação passou a usar uma constante `insertAuditoria`, de modo que só a linha 74 fique vermelha. O resto são notas sobre `NestLogger`, as chaves do `NucleoEmDist` e a regex de `borda.test.ts`. Nada disso muda comportamento.

Nada no diff toca isolamento de tenant, dado pessoal, camada de IA ou conformidade. Não há correção exigida pendente da 1ª rodada, porque ela foi APROVADA sem bloqueante.

Bloqueantes: nenhum

Recomendações:
- Os títulos de teste e a mensagem de erro ainda dizem `@Permite`. Estão em `apps/api/test/permissao-no-boot.test.ts:67`, `:75` e `:82`, e em `packages/nucleo/src/permissao/conferencia-das-permissoes.ts:67`. A mensagem do código e a do teste combinam entre si. Isso já está nas recomendações sem aplicar do relatório, sem pendência nova.
- Os demais itens que a 1ª rodada deixou como recomendação continuam registrados no relatório. Não precisam de ação agora.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-30 19:46:46 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou nesta rodada. O diff não toca schema, repository, job, seed, importação nem webhook de `Nota`. Os caminhos auditados na 1ª rodada continuam iguais, todos com autor humano. Todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de entrega, artefato ou aprovação foi alterado.
Supervisão do tutor: ok. Nada no diff toca o tutor.
Autonomia declarada e visível: sim. O diff não toca governança nem a declaração de autonomia dos agentes.

O que auditei, só o diff `bd90ea30` → `ccc8ac71`, sem reauditar o que não mudou:
- `apps/api/src/app.module.ts:130`, `apps/api/src/main.ts:28` e `apps/realtime/src/main.ts:12`: só comentários, com o nome novo (`@RequirePermissao`, `GracefulShutdown`). Não muda comportamento.
- `docs/guia-do-desenvolvedor.md:104-116, 198-210`: o diagrama foi realinhado e `@Permite` virou `@RequirePermissao` nos exemplos. A ordem dos guards (sessão, permissão, escopo no repository) é a mesma de antes.
- `tasks/prd-nomes-de-mercado/4_task.md`: o bloco de mutação da porta única da auditoria passou a `export const insertAuditoria = (): void => {}`. Assim só a asserção do export fica vermelha, e a de `importam` continua verde. A prova da trava ficou mais precisa. Conferi que `packages/nucleo/src/index.ts` não exporta `insertAuditoria` nem o módulo de inserção, e que `packages/nucleo/src/auditoria/porta-unica.test.ts:69-76` continua cobrando isso. A rastreabilidade "o que a IA gerou, quem aprovou, quando" segue com uma porta única de escrita. O arquivo também ganhou a tabela de recomendações não aplicadas, explicações sobre `NestLogger`, as chaves do `NucleoEmDist` e a regex do `borda.test.ts`, e a tabela de revisões do hook.
- `tools/processo/harness/revisores.test.ts:7`: o comentário da exceção da gravação de antes mudou de lugar. O teste em si não mudou.
- `tools/renomear/mapas/4.json` e `4.relatorio.md`: as referências de linha `travas.md:N` foram deslocadas em +1, e alguns `motivo` foram reescritos. São só metadados do mapa de rename, sem efeito em nota, aprovação, tutor, autonomia, auditoria, vigilância ou indicador de professor.

Itens 7, 8 e 9 (vigilância, nota proposta em discursiva e redação, medição do professor): o diff não acrescenta campo, prompt, tela, métrica nem acesso da coordenação a conversa de professor.

Bloqueantes: nenhum

Recomendações:
- O deslocamento de +1 em todas as referências `travas.md:N` é sinal de que o mapa aponta para linha, e linha quebra a cada edição. A sugestão já registrada pelo revisor-geral (1ª) no `4_task.md`, de decidir o formato do mapa antes da 5.0, resolveria também isto.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/4_task-diff-r2-limpo.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/4_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/nucleo/src/auditoria/porta-unica.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.json

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-30 19:46:54 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Esta rodada mexe em comentários, documentação e metadados do mapa de rename, e não muda nenhum schema, DTO, migration ou campo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota, guard ou repository muda de lógica. As mudanças em `apps/api/src/app.module.ts`, `apps/api/src/main.ts` e `apps/realtime/src/main.ts` são só comentários com o nome novo (`@RequirePermissao`, `GracefulShutdown`). O resto do código, que não mudou desde a minha 1ª rodada, não foi auditado de novo.

Logs: limpos. Nenhuma chamada de log foi adicionada ou alterada. A nota nova do `4_task.md` sobre o `NestLogger` só explica que a exceção da guarda depende do caminho do arquivo, e a guarda em si não muda.

Auditoria: presente. A trava da porta única (`porta-unica.test.ts`, linha 74) continua coberta. O bloco de mutação do `4_task.md` agora exporta `insertAuditoria` como constante, sem importar o módulo de inserção, então só a trava da linha 74 fica vermelha. A prova ficou mais exata e não ficou mais fraca.

Envio externo: nenhum novo. A nota do `4_task.md` sobre `loadLLMConfig`, `createLLMGateway` e `runInContext` registra só como esses nomes são provados (pela forma C, o `restos`). Nada muda no que é enviado ao provedor.

Seed/fixture: sintético. Nenhum seed ou fixture mudou. O comentário de `tools/processo/harness/revisores.test.ts` foi só reescrito e movido para dentro do item (2), e a exceção da gravação continua restrita ao literal `@Unscoped()`.

Bloqueantes: nenhum.

O que conferi:
- **`tools/renomear/mapas/4.json`**: todas as linhas `+/-` do diff são só os campos `"linha"` e `"motivo"`, com as referências a `travas.md` deslocadas em +1 (54→55, 108→109/110, 98→99, 56→57, 44→45). Não há entrada de símbolo nova, `de`/`para` alterado, nem mudança de `classe` ou `trecho`.
- **Mapas na árvore atual**: `tools/renomear/mapas/4.json` e `tools/renomear/mapas/4.relatorio.md` estão sem rastreio no git, mas o conteúdo de hoje é idêntico ao da árvore `ccc8ac71…` (hashes `02b2ace9` e `0f2557aa`).
- **`tools/renomear/mapas/4.relatorio.md`**: só reflete a mesma renumeração.
- **`docs/guia-do-desenvolvedor.md`**: as linhas do diagrama foram realinhadas e `@Permite` virou `@RequirePermissao` no exemplo. Não muda nenhuma regra.
- **Correções exigidas na 1ª rodada**: não exigi nenhuma. A minha recomendação daquela rodada (o texto "@SemEscopo exige justificativa" em `sem-escopo.decorator.ts:18` e no `toThrow` do teste) está na tabela "Recomendações sem aplicar" do `4_task.md`, indo para o TODO.md, o que basta.

Recomendações:
- Nenhuma nova. A da 1ª rodada continua registrada no `4_task.md` com destino TODO.md.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/4_task-diff-r2-limpo.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/4.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/4_task.md

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 19:47:03 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Cenários exigidos: esta tarefa só renomeia símbolos do core, sem tela, sem migration e sem regra de negócio nova. O que precisa de prova são as travas que leem um símbolo pelo nome. Cada uma precisa ficar vermelha quando o nome antigo volta, ou quando a regra que ela guarda é violada. Nesta rodada, o ponto exigido era a forma B da porta única da auditoria: o índice do core não pode exportar `insertAuditoria`, e é a linha 74 de `porta-unica.test.ts` que prova isso.

Cobertos:
- **Correção 1 da 1ª rodada, feita.** O bloco em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/4_task.md:265-271` agora acrescenta `+export const insertAuditoria = (): void => {}`, logo depois da linha `AuditoriaRejectedError`, que segue igual em `packages/nucleo/src/index.ts:271`.
  - A linha nova não tem `from`, `import(`, `require(` nem `import `, então não casa com `IMPORTA_O_MODULO_DE_INSERCAO` (linha 49). A linha de contexto importa `auditoria-recusada.js`, não `insercao-de-auditoria`. Com isso, `importam` continua `[REGISTRO]` e o `toEqual` da linha 73 fica verde.
  - O teste faz `import * as nucleo from '../index.js'` (linha 5). A chave nova entra em `Object.keys(nucleo)`, e o `not.toContain('insertAuditoria')` da linha 74 fica vermelho. O vermelho agora vem do motivo certo.
- **Os outros dois blocos da porta única** (o `toEqual` da linha 83 sem `LEITURA`, e a regex da 49 com `auditoria-insert`) seguem com teste citado pelo título. O texto em 4_task.md:259-263 agora diz que são prova de que as travas estão vivas, não mutação de nome.
- **As recomendações que a Mesa mandou aplicar foram todas aplicadas:**
  - nota do `NestLogger`, em 4_task.md:249-250;
  - nota das chaves `loadLLMConfig`, `createLLMGateway` e `runInContext`, cobertas pelo `restos`, em 4_task.md:312-314;
  - linha de `borda.test.ts:95`, em 4_task.md:323-324. Conferi o `expect(daApi).toBeDefined()` na linha 96 do teste;
  - texto do `toEqual` da linha 83.
- **Referências a `travas.md` com +1, conferidas.** Abri as linhas 45, 52, 55, 56, 57, 99, 109, 110 e 111 de `travas.md`: cada uma é a linha que o `4.json` e o `4.relatorio.md` citam. As linhas 34 e 39, que não mudaram, também continuam certas.
- **O resto do diff não mexe em asserção:** comentários em `app.module.ts` e nos dois `main.ts`, o diagrama alinhado no guia do desenvolvedor, e o comentário de `revisores.test.ts` só mudou de lugar. A gravação em `__fixtures__/revisores-antes/` não mudou nesta rodada.
- **Rodei** `npx vitest run` em `porta-unica.test.ts` e `revisores.test.ts`: 74 de 74 passaram.
- Não há `.skip`, nem mock que esconda regra, nem provedor pago, nem operação concorrente nova.

Bloqueantes: nenhum.

Recomendações:
- A trava de `borda.test.ts:95` ficou como "sem bloco", com a justificativa escrita. Um bloco que devolve `TENTE_DE_NOVO_PADRAO_SEGUNDOS` à regex do teste custaria uma linha e trocaria essa explicação pela prova do portão. Fica para a retro.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 19:47:15 · `tasks/prd-nomes-de-mercado/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` aceita typecheck, lint, segredo, dependências, unidade e alvo para o código atual.

Bloqueantes: nenhum.

As duas correções da 1ª rodada foram feitas:

1. **Nomes antigos que ficaram.**
   - `apps/api/src/app.module.ts:130` agora diz `@RequirePermissao`.
   - `apps/api/src/main.ts:28` e `apps/realtime/src/main.ts:12` agora dizem `GracefulShutdown`.
   - `docs/guia-do-desenvolvedor.md:111`, `:201` e `:207` agora usam `@RequirePermissao(`.
   - Revi de novo cada linha da "Troca à mão" de `tools/renomear/mapas/4.relatorio.md`. As linhas de `Banco`, `Dado`, `Ambiente` e `migrar` que ainda restam são prosa, como "Banco fora", "Dado inventado", "expandir, migrar, contrair", o nome do serviço `migrar` e "Banco público". Nenhuma é símbolo.
   - Os `@Permite`, `@SemEscopo` e `Drenagem` que ainda existem estão só em título de `it`/`describe`, em mensagem que um teste lê, ou em `camadas.cjs`. Todos já foram classificados como `fica` ou registrados como recomendação pendente com destino.

2. **Referências ao `travas.md` deslocadas em uma linha.**
   - `tools/renomear/mapas/4.json` e `4.relatorio.md` agora apontam para 45, 52, 55, 56, 57, 99, 109, 110 e 111. As de 34 e 39 continuam iguais.
   - Conferi cada uma contra `tasks/prd-nomes-de-mercado/travas.md`, e todas caem na linha certa. Por exemplo, a 45 é `CHAVES_DOS_MARCADORES`, a 55 é o `this.name` da classe de erro, a 57 é `porta-unica.test.ts`, a 99 é `borda.test.ts`, a 109 é `exigirEscolaDoContexto`, a 110 é `USO_DA_ROTINA` e a 111 é `medir-risco-a-vida`.
   - O `motivo` das duas entradas que antes citavam "108 e 109" foi separado. A de `METADADO_*` aponta para a 45 e a de `EscolasDaRotinaRepository` para a 110.

As duas recomendações que a Mesa mandou aplicar também foram feitas:
- O diagrama de `docs/guia-do-desenvolvedor.md` (105 a 116) está alinhado: toda descrição começa na mesma coluna, inclusive na linha do `AllExceptionsFilter`.
- A exceção do `tenancy-guardian` foi para dentro da frase "nunca regravada", no topo de `tools/processo/harness/revisores.test.ts`, e a linha solta foi removida.

O texto novo de `tasks/prd-nomes-de-mercado/4_task.md` confere com o código. O `NestLogger` aparece só no comentário de `tools/guardas/index.mjs:122`, e a exceção da guarda lê o caminho `logger-do-nest.ts`. Nesta rodada a `techspec.md` e o `cenarios.md` não mudaram, e não há divergência nova.

Recomendações:
- O comentário reescrito no topo de `tools/processo/harness/revisores.test.ts` (linha 7) ficou muito mais longo que as linhas vizinhas. Ficaria mais fácil de ler quebrado na mesma largura delas.
- As pendências registradas na tabela "Recomendações sem aplicar" do `4_task.md` continuam valendo e devem entrar no `TODO.md` como diz a própria tabela: títulos de `it` com `@SemEscopo`, a mensagem do `sem-escopo.decorator.ts:18` junto com o `toThrow`, e `camadas.cjs:148` e `:162`.
