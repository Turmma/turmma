# Achados das revisões — `tasks/prd-nomes-de-mercado/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-01 22:37:50 · `tasks/prd-nomes-de-mercado/13_task.md`

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
- O diff de código da tarefa se limita a três mudanças: o literal `**O avatar** (\`AgentAvatar\`)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/Onca.test.tsx` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/CabecaOnca.test.tsx`, e um comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/CabecaOnca.tsx`. Nada roda em request, fila, gateway de IA, sala, prova ou migration. O literal bate com `docs/interface.md:1161`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/guia-do-desenvolvedor.md` (§9 reescrita) continua dizendo que o `RateLimiter` usa "Redis, com reserva em memória". Isso já estava escrito antes desta tarefa e não muda nada no código. Mesmo assim, vale registrar para a retro que essa reserva em memória vai contra o item 5 da regra 80 quando houver duas instâncias. O que fazer com ela fica para a medição da N2 da X5, e não para esta tarefa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/ia/README.md` mantém a linha "O executor roda no processo da API (`TODO(fila)`, D77)", que também já existia. O nome novo `ExecucaoScheduler` não altera esse ponto. Ele continua pendente de levar para a fila quando a D77 deixar de valer.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-01 22:38:04 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou. A tarefa 13.0 não toca schema, repository, job, seed, importação nem webhook. Os caminhos que já existiam ficam como estavam: todos com autor humano? sim, nada mudou nesta tarefa.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok
Autonomia declarada e visível: sim, sem alteração

O que conferi:

- **Código.** A tarefa altera três arquivos de código, e nenhum muda comportamento:
  - `apps/web/src/components/ui/onca/CabecaOnca.tsx`: só comentário (`AssinaturaIA` vira `AgentSignature`, `AvatarAgente` vira `AgentAvatar`).
  - `CabecaOnca.test.tsx` e `Onca.test.tsx`: só o literal `**O avatar** (`AgentAvatar`)`, que bate com `docs/interface.md:1161`.
- **Documentos.** Olhei a diferença palavra por palavra em `docs/guia-do-desenvolvedor.md`, `docs/interface.md`, `docs/arquitetura.md`, `docs/modelo-de-dados.md`, `docs/mvp-rapido.md`, `docs/aia/tutor.md`, nos dois README e em `.claude/`. É só troca de nome. Nenhuma frase sobre aprovação, nota, D55, tutor, autonomia ou medição do professor mudou de sentido. A §9 do guia foi reescrita, mas trata só de padrões técnicos (outbox, erro, limite, escopo, processo), sem nada da regra 70.
- **Os nomes novos existem no código.** Os documentos citam vários nomes ligados à regra 70, e procurei cada um em `apps/` e `packages/`. Todos existem:
  - `ApprovalLine`: a linha de aprovação, com quem aprovou e quando (item 6).
  - `AgentSignature`, `AgentAvatar` e `AIBadge`: a assinatura, o avatar e o selo de IA (item 4a).
  - `AIMessage`, `StatusBadge` e `ConfirmDialog`.
  - `ExecucaoScheduler`, `AgenteExecutor` e `FuncaoSuspensionCheck`: este último confere a suspensão da correção de objetiva.
  - `LLMError` e `TASK_CATALOG`.
- **Documentos da regra 70 sem nome antigo.** Nenhum dos nomes velhos (`AvatarAgente`, `AssinaturaIA`, `LinhaAprovacao`, `MensagemIA`, `SeloIA`) aparece em `docs/regulacao.md`, `docs/agentes.md`, `docs/aia/`, `.claude/rules/` ou `CLAUDE.md`.
- **O que ficou como estava.** `docs/regulacao.md` e `.claude/rules/70-conformidade-cne.md` não foram alterados. Os itens 1 a 9 da regra seguem com os mesmos testes citados.
- **Fotos da tela.** O prompt não trouxe nenhuma, e a tarefa não muda tela.

Bloqueantes: nenhum

Recomendações:
- `docs/aia/tutor.md:165` diz que "só a `AgentSignature`" desenha a cabeça da onça. Já `CabecaOnca.tsx:220` diz que quem desenha a cabeça é só o `AgentAvatar`, e que a `AgentSignature` desenha o avatar. A frase da AIA já era imprecisa antes desta tarefa: o rename só trocou o nome. Vale alinhar a frase da AIA à cadeia de desenho `AgentSignature` → `AgentAvatar` → `CabecaOnca`, numa tarefa de documento, porque é a AIA que se mostra à escola como prova da identidade do agente (D58).

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-01 22:38:15 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO

A tarefa 13.0 só troca nomes em documentos. No código, mexe em um comentário e em dois textos de teste da onça. Nenhum campo, rota, DTO, log, auditoria ou envio para IA mudou.

Campos pessoais tocados: nenhum. Não há migration, schema nem DTO no diff. O código alterado se resume a isto:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/CabecaOnca.tsx`: só o comentário `AvatarAgente` virou `AgentAvatar`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/CabecaOnca.test.tsx` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/Onca.test.tsx`: só o texto do marcador de fim da seção 9.7, que busca o novo título de `docs/interface.md`.

Fora da tabela de dados do docs/lgpd.md: nada. `docs/lgpd.md`, `.claude/rules/`, `CLAUDE.md` e `docs/decisoes.md` não têm diff.

Autorização por objeto: ok. Nenhuma rota nem repository mudou. Nos documentos, a classe agora citada como `TenantResolutionRepository` mantém o mesmo texto sobre escopo e o mesmo `@Unscoped`. Conferi que a classe existe em `apps/api/src/sessao/tenant/tenant-resolution.repository.ts`.

Logs: limpos. Nenhuma linha de log foi criada ou alterada.

Auditoria: presente. Nenhuma ação que exige auditoria foi tocada, e o `AuditoriaRecorder` continua na tabela da seção 9 do guia.

Envio externo: nenhum novo. O README da camada de IA (`packages/core/src/ia/README.md`) só troca nomes: `ErroDeIa` virou `LLMError`, `tarefas/` virou `tasks/`, e `CATALOGO_DE_TAREFAS` virou `TASK_CATALOG`. Continua lá a frase de que a entrada é estrita e não tem chave para nome de aluno ou professor. Também conferi que nenhum texto de privacidade saiu dos documentos.
- Na seção 9 reescrita do guia, as peças tiradas da tabela (`@Unscoped`, `AsyncLocalStorage`, `LoginLockout`, `WindowCounter`, `HashBulkhead`, `DomainException`, `AllExceptionsFilter`) aparecem todas na lista logo abaixo, com o mesmo significado.
- Os caminhos citados existem: `core/src/error/`, `core/src/permissao/require-permissao.decorator.ts`, `SessaoFixtures`, `ExecucaoScheduler` e `AgenteExecutor`.

Seed/fixture: sintético. Não há seed nem fixture no diff. Procurei e-mail, CPF e telefone em `tools/renomear/mapas/13.json` e `13.relatorio.md` e não achei nada. Os dois arquivos só têm pares de nomes técnicos.

Pergunta de fechamento: esta tarefa não altera nada do que hoje responde ao pedido da secretaria: arquivo do titular, auditoria e o registro de envios em `ExecucaoAgente`.

Bloqueantes: nenhum.

Recomendações:
- O `reaplicar` não filtra pelo `arquivo` da entrada. Na própria 13.0 ele reescreveu 182 arquivos de código e derrubou o hook do Bash. A tarefa já registra isso como correção própria. Ela precisa pousar antes de o `reaplicar` voltar a ser usado: uma troca solta de identificador em `packages/core/src/auditoria/`, `titular/` ou `log/` passaria despercebida até a esteira.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-01 22:40:16 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As duas divergências (o `reaplicar` não serve à 13.2, e o literal da 9.7 nos dois testes da onça) estão no `13_task.md` e também na `techspec.md` §5. Não pedem caso novo no `casos.md`, porque a ferramenta não mudou.
Portão local: carimbo válido

Bloqueantes:
- `docs/mvp-rapido.md:520`: a tabela da §9.2 tem a coluna "Desenho em `mockups/src/areas/`" e agora aponta para `professor/Conversation.tsx`, que não existe. O arquivo do mockup é `mockups/src/areas/professor/Conversa.tsx`, e `mockups/` fica fora da X8 (Tech Spec §5). Na mesma linha, `QueueAlert` substituiu `AvisoFila`, e na linha 522 `SchemaForm` substituiu `MotorFormulario`. Os dois são nomes do mockup. Nenhum dos nomes novos existe em `mockups/src`; os antigos existem (conferido com grep).
- `docs/mvp-rapido.md:538-542`: o título da §9.3 diz "nomes do mockup, para se achar o desenho". A lista agora traz os nomes do produto (`PromptInput`, `AIMessage`, `AgentSignature`, `SchemaForm`, `StatCard`…), e nenhum deles está no mockup. A seção não serve mais para o que diz servir.
- `docs/mvp-rapido.md:511`: "(`AgentAvatar` do mockup)". No mockup o nome é `AvatarAgente`.
- O que corrigir: voltar aos nomes do mockup nessas três passagens (linha 511; caminho, `AvisoFila` e `MotorFormulario` nas linhas 520 e 522; a lista da §9.3). Registrar cada ocorrência como `fica` no `tools/renomear/mapas/13.json`, com o motivo "nome do mockup, que fica fora da X8". Assim o `restos` continua em zero sem apagar a referência. Depois, rodar o `restos` de novo e regravar o carimbo. O `Button`, o `Dialog` e o `FormField` da linha 495 falam do produto ("já existem") e podem ficar como estão.

Recomendações:
- Correção que não estava no pedido, mas está certa: `.claude/skills/executar-task/SKILL.md:210` e `docs/processo-licoes.md:39` voltam para `infra/test/metricas.int.test.ts`, que é o arquivo que existe. A 6.0 tinha trocado o nome por engano. Vale citar no relatório da onda.
- `estado.md` registra o aviso de pouso da 7.0 e da 8.0 como "levado à 13.0, runbook": o `tipo` do log mudou em `JobFailureError`, `QueueFacingError` e mais oito classes, e uma busca salva com o nome antigo deixa de achar. A 13.0 não mexeu no `docs/runbook.md`. Esse item não está no `13_task.md`, então não reprova esta tarefa. Fica para o Orquestrador decidir para onde vai.
- `tools/renomear/mapas/13.relatorio.md` ainda não está versionado (`??`). Precisa entrar no commit.
- `docs/guia-do-desenvolvedor.md:237`: o exemplo `eq(threadAgente.usuarioId, requireUsuarioId())` não corresponde ao que está em `apps/api/src/ia/execucao.repository.ts`, que usa `execucaoAgente.solicitadaPor`. O erro já existia antes do rename, mas a pergunta 7 da autoconferência pede que o guia não afirme o que o código não tem.
- O conserto do `reaplicar`, que não filtra pelo `arquivo` da entrada, vai para a correção própria. Quando ela sair, precisa levar um caso no `casos.md`, na seção `reaplicar (1.0)`.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/mvp-rapido.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.json`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-01 22:40:27 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: REPROVADO

Cenários exigidos (a tabela de testes da 13.0, linha por linha):
- `conferir` com o diff de código vazio
- `restos` sem isenção, zero com todos os mapas (a correção do ouro pousou)
- nenhum nome antigo no guia, na arquitetura, na interface e nos dois README (RF9)
- nenhum nome antigo em `.claude/` e no `CLAUDE.md` (RF10)
- `caminhos.test.ts` da X7 verde
- `docs/decisoes.md` e `tasks/prd-*` fechados, sem diff
- §9 do guia (a tabela já diz que só a revisão garante)
- o efeito colateral da opção B: o literal do fim da 9.7 nos dois testes da onça acompanha a frase de `docs/interface.md`, e as nove cores continuam as mesmas

Cobertos (rodei cada um, sem alterar arquivo):
- **`conferir`:** `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/13.json` deu verde, com 210923 itens e nenhuma diferença que o mapa não explique. As quatro `excecoesDoConferir` do `13.json` correspondem às duas linhas trocadas em `Onca.test.tsx:30` e `CabecaOnca.test.tsx:28`.
- **`restos` sem isenção:** `tools/renomear/restos.test.ts › restos na árvore` está verde com o `13.json` na pasta, e com ele a isenção do ouro e dos mapas de linha deixa de valer. Os casos unitários `na 13.0, o caminho antigo num README do ouro` e `com o 13.json, o mapa de linha vale também nos documentos` provam que essa troca de modo existe. A `Arvore` lê do índice só a lista de arquivos; o conteúdo vem do disco, então o verde vale para a árvore como está agora.
- **RF10:** `ehDocumentoVivo` (`tools/renomear/texto.ts:24-25`) lê `CLAUDE.md` e `.claude/**.md`. Os outros arquivos de `.claude/` passam pela busca de texto e de código. Está coberto.
- **Harness:** `caminhos.test.ts` e a pasta inteira `tools/processo/harness/` estão verdes (609 casos).
- **Fronteira:** o diff desta tarefa (`git diff HEAD`) não toca `docs/decisoes.md`, o ouro, `mockups/`, `CLAUDE.md` nem `.claude/rules/`. Em `tasks/`, só mexe em `tasks/prd-nomes-de-mercado/`.
- **Onça:** os 4 arquivos de `apps/web/src/components/ui/onca/` passam, com 58 casos. Em `CabecaOnca.test.tsx`, o `expect(fim).toBeGreaterThan(inicio)` fica vermelho se a frase e o literal se separarem.
- **Mutações:** `**Sem mutação:** rename, sem condição nova` confere com o diff. Em `apps/*/src`, a única mudança fora de teste é um comentário em `CabecaOnca.tsx:218-220`. Não há cláusula nova.
- **Proibições:** nenhum `.skip`, nenhum teste comentado, nenhum mock. A tarefa não envolve IA nem concorrência.

Bloqueantes:
1. **A linha "nomes antigos … nos dois README" (`tasks/prd-nomes-de-mercado/13_task.md:54`) cita o `restos` como prova, mas ele não lê esses arquivos.**
   - **O que está errado:** a busca de documento do `restos` (`tools/renomear/restos.ts:159`) só olha o que `ehDocumentoVivo` aceita: `CLAUDE.md`, `.claude/` e `docs/` (`tools/renomear/texto.ts:24-25`). `packages/core/src/ia/README.md` e `apps/web/src/components/ui/ai/README.md` ficam fora dela. A busca de texto também não os lê: o próprio caso `restos.test.ts › o que não é código não é lido como código: um Markdown fora de docs/ com o nome em prosa` prova isso.
   - **O efeito:** um `` `AvatarAgente` `` entre crases que sobrasse nesses dois README deixaria o `restos` verde. A parte do RF9 sobre os README ("busca dos nomes antigos nesses documentos: zero", `prd.md:81`) fica sem prova executada. É o caso da X3: um item juntado a outro, sem teste que o cubra.
   - **Hoje está limpo:** fiz uma busca avulsa com os 2127 `de` de todos os mapas nos dois README e no `README.md` da raiz. Só achou palavra comum em prosa, como o título "## Conversa". O problema é a prova citada, não o conteúdo.
   - **Correção exigida:** corrigir a linha 54 para separar os README. A prova deles passa a ser a busca de verdade: o comando e a saída vazia registrados no documento, como pede a pergunta 8 da autoconferência. Junto, escrever o limite: "o `restos` não lê Markdown fora de `docs/`/`.claude/`". Pôr os dois README em `ehDocumentoVivo` mexe em código de ferramenta: se for esse o caminho, é correção própria, junto do conserto do `reaplicar`, e não conta como prova desta tarefa.

Recomendações:
- **Teste de `Onca.test.tsx`:** o `coresDaOnca` de `apps/web/src/components/ui/onca/Onca.test.tsx:27-33` não tem o `expect(fim, …).toBeGreaterThan(inicio)` que o `CabecaOnca.test.tsx:30` tem. Se o literal sair de acordo com o documento, `slice(inicio, -1)` lê o documento até o fim, e o motivo do vermelho fica errado. O problema já existia antes; vale igualar os dois numa correção.
- **Relatório não versionado:** `tools/renomear/mapas/13.relatorio.md` está fora do índice, então o `restos` de agora não leu a tabela de troca à mão dele. Depois do `git add` essa tabela só pode liberar mais. Antes do commit, confirme que ela não registra nenhuma palavra que seja resto de verdade nos documentos.
- **Nome misto:** em `tasks/prd-nomes-de-mercado/achados/13_task.md:20` aparece o nome `ExecucaoScheduler`, que mistura português e inglês. Fica para o `revisor-geral` e para a guarda `nome-de-mercado` conferirem se é o nome do mapa ou erro de prosa.
- **Comando da fronteira:** o `git diff --stat develop... -- docs/decisoes.md tasks/` do "Como testar" também lista `tasks/correcoes/`, com os arquivos novos das correções da spec. O texto "mostra só `tasks/prd-nomes-de-mercado/`" não confere com isso: acrescente que `tasks/correcoes/` também aparece, só com arquivos novos.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-02 00:04:23 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff da rodada 2 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/13_task-diff-r2.patch`) não mexe em migration nem em schema.

Queries verificadas: nenhuma nova. O código em `apps/` e `packages/` é o mesmo da rodada 1: só os dois README e os literais da onça. O único texto do diff que fala de escopo é o exemplo `proprio` do guia, que ficou sem mudança. Conferi o exemplo contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/ia/execucao.repository.ts`, e o código tem o que ele cita:
- `eq(threadAgente.usuarioId, requireUsuarioId())` está em `:155`
- `eq(mensagemTutor.alunoId, requireUsuarioId())` está em `:164`
- as duas consultas também filtram por `escolaId` vindo do contexto

Assim, o guia continua descrevendo de verdade o escopo aplicado no repository. Pelo meu eixo, o motivo de não aplicar o item 8 da ordem de correção se sustenta.

Teste de isolamento: não se aplica. A tarefa é de documento e de mapa, sem módulo, endpoint ou cláusula de escopo nova. O diff de código está vazio, e é o `conferir` que prova isso.

Bloqueantes: nenhum. A rodada anterior não exigiu correções do `tenancy-guardian`.

Recomendações:
- Isto já existia antes da tarefa e está fora do diff. Fica para a retro ou para uma correção própria. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/ia/execucao.repository.ts:150-156`, o `mensagemDoAssistente` não filtra `mensagemAgente.anoLetivoId` pelo `requireAnoEmCurso()`. O join só iguala o ano da mensagem ao ano da thread. As outras consultas do arquivo prendem a busca ao ano em curso. O dado não sai da escola nem passa para outra pessoa, porque `escolaId` e o dono da thread continuam no filtro. O que fica diferente das outras consultas é só o ano letivo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-02 00:04:24 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada 2 só muda texto, em quatro arquivos:
- `docs/mvp-rapido.md`, seções 9.1 a 9.3: os nomes do mockup voltaram, entre eles `AvatarAgente`, `Conversa.tsx`, `AvisoFila`, `MotorFormulario` e a lista de peças.
- `tasks/prd-nomes-de-mercado/13_task.md`: a linha dos dois README saiu da prova do `restos` e virou uma busca de texto, o comando da fronteira passou a citar `tasks/correcoes/` e o documento ganhou a tabela de recomendações e a de revisões.
- `tools/renomear/mapas/13.json`: 21 entradas novas marcadas `fica`.
- `tools/renomear/mapas/13.relatorio.md`: o relatório da onda.

Nenhum desses trechos tem nome, matrícula, nota, conversa ou outro dado de pessoa. São nomes de componente, caminhos de arquivo e nomes de coluna (`usuarioId`, `alunoId`, `solicitadaPor`), estes só citados como exemplo de escopo.
Fora da tabela de dados do docs/lgpd.md: nenhum. Não há campo nem migration.
Autorização por objeto: não se aplica. Não há rota, repository nem query. O exemplo `proprio` do guia ficou como estava (item 8 da ordem). O relatório confere que as colunas citadas existem em `apps/api/src/ia/execucao.repository.ts:155` e `:164`, e o exemplo continua prendendo a leitura ao usuário autenticado.
Logs: limpos. Não há código de log no diff.
Auditoria: não se aplica. O diff não mexe em leitura, exportação, nota, permissão nem aprovação de IA.
Envio externo: nenhum.
Seed/fixture: não se aplica. Não há seed nem fixture no diff, e o `13.json` só tem nomes de peça do mockup e linhas de inventário.

As correções exigidas na 1ª rodada desta auditoria: nenhuma. Os itens 1 a 9 da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/13_task-r1.md` vieram do `revisor-geral` e do `test-engineer`. Conferi só o que eles podem afetar na regra 20, e nada afeta.

Bloqueantes: nenhum.

Recomendações:
- Os dois README (`packages/core/src/ia/README.md` e `apps/web/src/components/ui/ai/README.md`) ficam fora do `restos`, porque `ehDocumentoVivo` não os lê. Hoje isso só deixa sem guarda automática a troca de nomes. Se um dia esses arquivos descreverem o que a camada de IA envia ao provedor, um texto desatualizado ali passa sem aviso. Vale incluí-los quando sair a correção do `reaplicar`, que já está registrada.
- A pendência do `reaplicar` que apontei na 1ª rodada (ele não filtra pelo `arquivo`) está registrada como correção própria, e o conserto precisa entrar antes de a ferramenta voltar a ser usada. Não bloqueia, porque esta onda não usou o `reaplicar`.

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/13_task-diff-r2.patch` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/13_task-r1.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-02 00:04:29 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou nesta rodada. O diff só mexe em documento e no mapa: `docs/mvp-rapido.md`, `13_task.md`, `13.json` e `13.relatorio.md`. Todos com autor humano? sim, sem mudança desde a 1ª rodada, que foi aprovada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok
Autonomia declarada e visível: sim, sem mudança. A tarefa não tem tela.

Bloqueantes: nenhum

Conferi o diff `eaaa46a8 → 1003652e` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/13_task-diff-r2.patch`) contra a ordem de correção `13_task-r1.md`, olhando só a regra 70:

- **Nomes do mockup de volta em `docs/mvp-rapido.md`.** As seções §9.1, §9.2 e §9.3 voltaram aos nomes do mockup (linhas 511, 520, 522 e 540–542). As novas entradas `fica` no `13.json` só registram nomes, sem mudar o sentido de nada. Conferi na árvore: `mockups/src/areas/professor/Conversa.tsx` e `FerramentaForm.tsx` existem, e `AvatarAgente`, `AssinaturaIA`, `SeloIA` e `LinhaAprovacao` aparecem em `mockups/src`.
- **Pontos da regra 70 em `docs/mvp-rapido.md` §9.2 ficaram como estavam:**
  - Aprovar: "diagnóstico, não nota" (D46), botão `oficial` inativo até abrir todos os destaques, registro da validação.
  - Tutor: faixa de supervisão que não fecha.
  - Memória: o aluno vê e contesta (D66).
  - Governança: sem coluna, filtro ou ordenação por professor, e o nominal só com auditoria (D45).
  - Agentes: autonomia em português comum.

  Nenhuma linha do diff toca nesses pontos, e nenhuma sugere nota em discursiva ou redação (D55).
- **`13_task.md`.** As mudanças são a linha separada dos README, a fronteira do diff e a tabela de recomendações. A minha recomendação da 1ª rodada (`docs/aia/tutor.md:165`) ficou registrada com destino `TODO.md` e um motivo aceitável: mudar o sentido de um texto de AIA não é rename.
- **`13.relatorio.md`.** É só registro, sem efeito na regra 70.

Recomendações:
- Continua aberta a recomendação da 1ª rodada sobre `docs/aia/tutor.md:165`, a frase de quem desenha a cabeça da onça (prova de identidade, D58). Ela tem destino no `TODO.md` e precisa ser corrigida antes de a AIA do Tutor ir ao dossiê de conformidade (D61).

## infra-guardian · 2ª rodada · APROVADO · 2026-11-02 00:04:30 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum. Desde a rodada aprovada, a 2ª rodada mexeu só em documento e em mapa: `docs/mvp-rapido.md`, `tasks/prd-nomes-de-mercado/13_task.md`, `tools/renomear/mapas/13.json` e `tools/renomear/mapas/13.relatorio.md`. Não há código novo em `apps/`, `packages/` ou `infra/`, nem migration, rota, job, fila ou chamada de modelo. Os outros arquivos de `apps/` e `packages/` na árvore são os da 1ª rodada, já aprovada, e não mudaram. A rodada anterior não exigiu correção.
Recomendações:
- As duas que registrei na 1ª rodada estão em "Recomendações sem aplicar" do `13_task.md`, com destino. Repito para a retro:
  - `docs/guia-do-desenvolvedor.md` descreve o `RateLimiter` com "reserva em memória", o que quebra o item 5 da regra 80 quando houver duas instâncias.
  - `packages/core/src/ia/README.md` diz que o executor roda no processo da API (`TODO(fila)`, D77).
- O `13.relatorio.md` diz que o `tipo` do log mudou em `JobFailureError`, `QueueFacingError` e mais oito classes, e o `docs/runbook.md` não acompanhou. Os alertas e as buscas do runbook que filtram pelo `tipo` antigo deixam de casar sem dar erro. A decisão está com o Orquestrador. Precisa pousar antes da `main`, porque a `main` vai sozinha para a produção.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 00:05:17 · `tasks/prd-nomes-de-mercado/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

As correções que exigi na 1ª rodada estão feitas:
- **`docs/mvp-rapido.md:511`**: voltou a `AvatarAgente`, que existe em `mockups/src/components/turmma/ia.tsx`.
- **`docs/mvp-rapido.md:520`**: voltou a `professor/Conversa.tsx`, e o arquivo existe no mockup. `AvisoFila` também voltou.
- **`docs/mvp-rapido.md:522`**: voltou a `MotorFormulario`.
- **`docs/mvp-rapido.md:540-542`**: a lista da §9.3 voltou aos nomes do mockup, que é o que o título da seção promete.
- **`tools/renomear/mapas/13.json`**: todas as ocorrências estão como `fica`, com o motivo "nome do mockup, que fica fora da X8". O JSON abre sem erro.
- **`restos`**: rodei de novo sobre o índice e deu "limpo. 11 mapas, nenhum nome antigo sobrou." `docs/mvp-rapido.md` e o `13.json` estão no índice, sem mudança fora dele.
- **Linha 495**: `Button`, `Dialog` e `FormField` ficaram, com razão. Os três existem em `apps/web/src/components/ui/` (`Button.tsx`, `overlays/Dialog.tsx`, `fields/FormField.tsx`).

As correções de outros revisores que alcançam o meu escopo também estão feitas:
- **README separados (item 5)**: a linha da tabela de testes agora separa os README e diz que o `restos` não lê esses arquivos. Refiz a busca e os nomes com maiúscula que sobram batem com o que o documento registra: `Tela` e `Campo` no `README.md` da raiz, `Conversa` em `apps/web/src/components/ui/ai/README.md`.
- **Fronteira (item 9)**: o "Como testar" agora cita `tasks/correcoes/`.
- **"Recomendações sem aplicar"**: a tabela foi copiada para o `13_task.md`.

Recomendações:
- **Âncoras do `trecho` no `13.json`**: o `trecho` só exige que a linha contenha o texto. Algumas âncoras citam outra peça da mesma linha:
  - `AvisoFila` na 540 aponta para "`CaixaPedido`, `MensagemIA`".
  - `MotorFormulario` e `Estado` na 541 apontam para "`AssinaturaIA` e `SeloIA`".
  - `Cartao` e `Tela` na 542 apontam para "`NumeroPainel`, `BarraRotulada`".

  Funciona hoje, mas quebra se a lista for reordenada. O ideal é que o `trecho` cite o próprio nome.
- **`PaginaMini` na §9.3 (`docs/mvp-rapido.md:541`)**: esse nome não existe em `mockups/src`. O texto já era assim antes da X8 e ninguém o trocou nesta rodada. Fica para o `TODO.md`, junto das outras imprecisões de documento sobre o mockup.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/mvp-rapido.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/13_task.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 00:05:33 · `tasks/prd-nomes-de-mercado/13_task.md`

**VEREDITO: APROVADO**

**Cenários exigidos:** É uma tarefa de documentos, sem condição nova no código. Nesta rodada eram três coisas. A correção exigida na 1ª rodada (a prova dos dois README separada da linha do `restos`, com a busca de verdade e o limite escrito). A volta dos nomes do mockup em `docs/mvp-rapido.md` §9.1–9.3, declarados como `fica` no `13.json` sem tirar o `restos` do zero. E o "Sem mutação" continuar valendo.

**Cobertos:**
- **A correção exigida foi feita.** A linha antiga virou duas em `13_task.md`. A linha 54 cobre o guia, a arquitetura e a interface pelo `restos`. A linha 55 cobre os dois README pelo `grep` e escreve o limite: "o `restos` não lê Markdown fora de `docs/` e `.claude/` (`ehDocumentoVivo`)". A linha 65 do "Como testar" registra a busca nos três README (os dois e o da raiz) e o que ela devolveu. O `13.relatorio.md` diz o mesmo em "Fora do mapa".
- **Refiz a busca sem alterar nada**: os 1593 `de` de todos os mapas, palavra inteira, nos três README. O que sobra é o que o documento diz: `Conversa` (ui/ai/README.md:19, título), `migrar` (README.md:31 e :42, serviço do compose), `Tela` (:252), `portao` (:256, nome de arquivo) e `Campo` (:300, prosa). Além deles, só a preposição `com`.
- **Os `fica` novos funcionam.** O `estaClassificada` (`tools/renomear/referencias.ts:187-193`) compara `de`, `arquivo` e `trecho` contido na linha. Conferi cada um dos 21 `fica` novos contra as linhas 511, 520, 522 e 540–542 de `docs/mvp-rapido.md`, e todos casam. Rodei `node tools/renomear/restos.ts` na árvore com o índice atual: "limpo. 11 mapas, nenhum nome antigo sobrou". `git status` igual antes e depois.
- **"Sem mutação" continua valendo.** O diff da rodada não toca `apps/*/src` nem `packages/*/src`: é Markdown e mapa JSON, sem cláusula nova.
- Não há `.skip`, mock nem provedor de IA envolvidos.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tasks/prd-nomes-de-mercado/13_task.md:65` descreve a busca em prosa ("a busca dos `de` de todos os mapas, com palavra inteira"), sem o comando literal. Consegui refazê-la, mas o comando exato colado ali deixa a prova fácil de repetir, que é o que a pergunta 8 da autoconferência pede.
2. Na mesma linha, a saída listada omite `com`, que aparece dezenas de vezes nos três README. É palavra comum, já tirada pelo motivo dado em "Divergências resolvidas", mas convém dizer isso na própria lista, para a saída registrada bater com o que o comando devolve.
3. Em `tools/renomear/mapas/13.json`, vários `trecho` dos `fica` novos citam outro nome da mesma linha, e não o nome da entrada. Exemplos: `AvisoFila` com "`professor/Conversa.tsx`", `Cartao` e `Tela` com "`NumeroPainel`, `BarraRotulada`", `Estado` com "`AssinaturaIA` e `SeloIA`". Funciona porque o casamento é por "a linha contém o trecho". Mas se a linha for reescrita, o `fica` se solta sem aviso claro. Um trecho com o próprio nome é mais robusto.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/13_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/docs/mvp-rapido.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/referencias.ts
