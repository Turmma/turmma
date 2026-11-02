# Validação — nomes-de-mercado (X8)

## Rodada 2 — 02/11/2026

**Escopo:** funcionalidade completa (revalidação depois da correção `2026-11-02-guarda-formas-do-inventario`)
**Commit validado:** `68902e84` (código igual ao de `9614bdf8`; o `68902e84` só registra o estado)
**Veredito: REPROVADA**

O crítico da rodada 1 está fechado: a guarda recusa agora `Agendador…` e as formas do `inventario.md` §1 que valem, e as
três que ficaram de fora têm o motivo escrito na `guarda.md`. A mesma correção abriu um crítico novo, pequeno mas contra
um RF com ⛔: ela renomeou `ProcessadorContado` (`apps/despachante/test/slots.int.test.ts`) para `CountingProcessor`
sem adenda e sem a palavra do Joaquim (RF2). O nome escolhido também não é o que a guarda dá (`ContadoProcessor`).

Diferença de código desde a rodada 1 (`git diff 13b562c9 68902e84`): `tools/guardas/nomes-de-mercado.mjs`, as três
fixtures da guarda, `tools/guardas/guardas.test.ts`, `apps/despachante/test/slots.int.test.ts` (só o nome da classe e
dois comentários) e a `guarda.md`. Nenhum `it`, `describe` ou `test` de `apps/`, `packages/` ou `e2e/` mudou. Os RF que
essa diferença não toca guardam a evidência da rodada 1, que continua valendo, e o `restos` rodou de novo.

O `node_modules` estava em dia com o `package-lock.json`: não precisei de `npm ci`.

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | como na rodada 1 | documento | `inventario.md` sem diff desde a rodada 1 |
| RF2 | **PARCIAL** | `apps/despachante/test/slots.int.test.ts:59` (`class CountingProcessor`, era `ProcessadorContado`), no `9614bdf8` | `git grep ProcessadorContado 68902e84`: só no documento da correção, no `achados/` e no `estado.md`. Não aparece em `inventario*.md`, nas adendas 1 a 5 nem em `tools/renomear/mapas/` | É peça técnica em português que o inventário não listou (o inventário lista classe não exportada, como `TempoEsgotado` e `CicloDoWorker` em `inventario-back.md:262,300`, e a adenda 5 levou ao Joaquim o `Cartao` local de `ChoicePrompt.test.tsx`). Foi achada pela guarda depois da aprovação, no mesmo caso da adenda 5, e renomeada sem adenda. Sonda minha: a guarda dá `ContadoProcessor` para ela, e o nome que entrou foi outro, `CountingProcessor`. Crítico 1 |
| RF3 | ATENDIDO | `tools/renomear/restos.ts` | `node tools/renomear/restos.ts` no `68902e84`: "limpo. 11 mapas, nenhum nome antigo sobrou." | O limite da declaração (menor da rodada 1) continua |
| RF4 | ATENDIDO | como na rodada 1 | `packages/`, `infra/` e os compose sem diff desde a rodada 1 | A construção das imagens é da esteira |
| RF5 | ATENDIDO | como na rodada 1 | `apps/web/` sem diff desde a rodada 1 | |
| RF6 | ATENDIDO | `apps/despachante/test/slots.int.test.ts` | diff do `9614bdf8`: só `ProcessadorContado` → `CountingProcessor` e dois comentários, sem linha de `it`/`describe`/`test` | O apoio de teste ganhou nome de mercado; a forma como entrou é o problema do RF2 |
| RF7 | ATENDIDO | como na rodada 1 (`conferir` verde nas onze ondas) | o diff de `apps/`, `packages/` e `e2e/` desde a rodada 1 é só o nome de uma classe local de teste: nenhuma string de fora, nenhum caso entra ou sai | Os casos novos de `guardas.test.ts` são da guarda (RF8), que o PRD §9 tira da conta |
| RF8 | ATENDIDO | `tools/guardas/nomes-de-mercado.mjs:46-53` (`Agendador`, `Processador`, `Executor`, com as variantes `…De` e os nomes exatos), `:69-70` (`METADADO_`; `CHAVE_` só em `apps/web`), `SEGMENTOS` (`*-de-teste`); `guarda.md` §"O que fica fora da lista, e por quê" (`:50`) | `tools/guardas/guardas.test.ts -t "guarda de nome de mercado"`: 104 ✅, com "a árvore depois da 11.0 passa sem nenhum erro", `class AdaptadorX` recusada com `XAdapter` e `class AgendadorDeX` com `XScheduler`; mutação abaixo. **Sonda minha** (`ESLint.lintText`, sem gravar arquivo): recusa `AgendadorDeX` (`XScheduler`), `AgendadorDeExecucao` (`ExecucaoScheduler`), `ExecutorDeX`, `ProcessadorDeX`, `ExecutorDeJobs` (`JobExecutor`), `Processador` (`JobProcessor`), `METADADO_X` (`X_KEY`), `CHAVE_X` em `apps/web` (`X_QUERY_KEY`), o arquivo `apps/api/test/material-de-teste.ts` (`material.fixture`), `AdaptadorX`, `XEmMemoria`; passam `TurmaController`, `EliminacaoDoTitular` e, como a `guarda.md` declara, `CHAVE_X` fora da web, `ConsultaDeX` e `Agendamento` | Todo item do critério tem prova. As três formas do §1 que ficaram de fora têm motivo de colisão escrito (`ConsultaDoReact`, `ConsultaComPrazoDoCliente`, "agendamento" de domínio, `CHAVE_DA_TRAVA_*`). O `inventario.md:20-21` ainda diz "a coluna da esquerda" sem ressalva (menor 1) |
| RF9 | ATENDIDO | como na rodada 1 | `docs/` sem diff desde a rodada 1; `restos` limpo com o `13.json` | |
| RF10 | ATENDIDO | como na rodada 1 | `.claude/` e `CLAUDE.md` sem diff desde a rodada 1 | |
| RF11 | ATENDIDO | como na rodada 1 | as guardas do RF11 (`escopo-dos-repositories.ts`, `camadas.cjs`, `eslint-suppressions.json`) sem diff desde a rodada 1 | |

Nenhum RF tem tela ("Nenhuma tela muda", Tech Spec §9): sem foto.

Provas de mutação (a árvore terminou limpa, `git status` vazio):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF8 | a linha `{ forma: 'Agendador', casa: 'prefixo', … }` de `tools/guardas/nomes-de-mercado.mjs:47` | `tools/guardas/guardas.test.ts`: os seis "recusa cada forma… em <caminho>" e "AgendadorX (classe) em apps/api/src/x.ts dá o nome de mercado ["`XScheduler`"]" (7 vermelhos) |

As mutações da rodada 1 (RF8 `Adaptador`, RF11 `@Unscoped`, RF3 `restos`) não foram refeitas: o código delas não mudou.

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: glossário vence | cumprida | `Agendamento` e `ConsultaX` passam de propósito (palavra de domínio, `guarda.md:50`); `TurmaController`, `EliminacaoDoTitular` passam (sonda) |
| Regra: nome misto, sem misturar idiomas na mesma palavra | cumprida | como na rodada 1 |
| Regra: o nome novo é o da documentação | cumprida, com uma ressalva | `CountingProcessor` é nome em inglês inventado para uma classe local de teste, fora do mecânico que a guarda dá (`ContadoProcessor`): entra no crítico 1, para o Joaquim escolher |
| Regra: as regras 10, 20 e 70 não se afrouxam | cumprida | as travas não mudaram desde a rodada 1; os quatro guardiões aprovaram a correção |
| Regra: cada onda termina verde e pousável | cumprida no que cabe aqui | a esteira é do Orquestrador |
| Borda: correção na `develop` no meio da X8 com nome antigo | coberta por teste; **pendente na prática** | como na rodada 1 (seção 6) |
| Bordas: colisão de nome, colisão com biblioteca, string de fora, recusa de domínio, rename só de caixa | cobertas | como na rodada 1; a correção não as toca |
| Pronto: nenhuma peça do inventário e das adendas 1 a 5 com nome antigo | cumprido | `restos` limpo no `68902e84` |
| Pronto: `@educa/core` construído, compose sem diff de serviço | cumprido | rodada 1; sem diff desde então |
| Pronto: kit com os nomes do shadcn e do Radix, onça sem diff | cumprido | rodada 1; `apps/web` sem diff desde então |
| Pronto: apoio de teste com nome de mercado, texto dos casos igual | cumprido | RF6 |
| Pronto: `conferir` verde em cada onda | cumprido | rodada 1 |
| Pronto: a guarda recusa o nome técnico em português, e a árvore passa | **cumprido** | RF8 |
| Pronto: documentos vivos, `.claude/` e `CLAUDE.md` com os nomes novos | cumprido | RF9, RF10 |
| Pronto: cada trava continua recusando o que recusava | cumprido | rodada 1, e a mutação desta rodada |
| Pronto: esteira verde no último commit que alterou código | esteira: conferida no fechamento | |
| Roadmap, "Pronto quando": a guarda recusa `Adaptador…`, `…EmMemoria`, `Agendador…` | **cumprido** | sonda e mutação do RF8 |
| Roadmap: guia §9, `docs/arquitetura.md` e o README da camada de IA | cumprido | RF9 |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: suíte inteira, da esteira |
| `npm run lint` | não rodado: suíte inteira, da esteira |
| `npm run test` | não rodado inteiro. Rodado isolado, como evidência: `tools/guardas/guardas.test.ts -t "guarda de nome de mercado"` (104 ✅, com o caso da árvore inteira). Nenhum vermelho fora da mutação |
| Ferramentas da onda | `restos` limpo no `68902e84` |
| `npm run test:e2e` | não se aplica aqui (esteira) |
| `npm run test:infra` | não se aplica aqui (esteira) |
| Esteira do GitHub | conferida no fechamento: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ A correção `guarda-formas-do-inventario` tem os seis revisores obrigatórios, com APROVADO na última rodada (o `test-engineer` reprovou a 1ª por falta de blocos de mutação e aprovou a 2ª, com doze blocos). As 13 tarefas e as outras correções: como na rodada 1 |

### 4. Achados

**Críticos**
- `apps/despachante/test/slots.int.test.ts:59` (correção `2026-11-02-guarda-formas-do-inventario`, `9614bdf8`): `ProcessadorContado`
  virou `CountingProcessor` sem estar no inventário nem numa adenda, e sem a aprovação do Joaquim. O RF2 (⛔) diz que peça achada depois
  da aprovação entra numa adenda que ele aprova antes do rename, e a adenda 5 fez exatamente isso para as onze declarações que a guarda
  acusou na 12.0. O documento da correção chama a troca de "colisão que a lista nova achou" e o `revisor-geral` a registrou sem cobrar a
  adenda. O nome também foge do mecânico: a guarda sugere `ContadoProcessor`. Correção (uma das duas): (a) o Orquestrador leva ao Joaquim
  uma adenda 6 de uma linha (`ProcessadorContado` → `CountingProcessor` ou `ContadoProcessor`, tipo classe não exportada, caminho, 4 usos),
  registrada com a data da aprovação e com a nota de que ela veio depois do `9614bdf8`; se ele escolher `ContadoProcessor`, uma correção de
  uma linha aplica; ou (b) uma correção volta ao `ProcessadorContado` e o põe como exceção nominal na `nomes-de-mercado.mjs`, com o motivo.
  Depois, revalidar só o RF2.

**Maiores**
- Nenhum.

**Menores**
- `tasks/prd-nomes-de-mercado/inventario.md:20-21` (dono: Arquiteto ou Orquestrador, no fechamento): a frase "A guarda do RF8 usa os
  prefixos e sufixos da coluna da esquerda" segue sem ressalva, e a `guarda.md:50` tira três formas dessa coluna. Recomendação do
  `revisor-geral` (1ª rodada da correção), recusada por o arquivo estar fora da correção. Correção: uma linha no §1 apontando para a
  `guarda.md`, "O que fica fora da lista". Se a adenda 6 do crítico for escrita, cabe no mesmo commit.
- Da rodada 1, sem mudança: `tools/renomear/sintaxe.ts:31-34` (o `restos` não cobra o nome antigo na declaração); `TODO.md` com 11
  itens que citam caminho antigo; `tasks.md:16-19`, as subtarefas 2.1 a 2.4 em `[ ]` com a 2.0 `[x]`; `ROADMAP.md:360` cita
  `packages/nucleo/src/ia/README.md`. Donos e correções como na rodada 1.

**Positivos**
- A correção registrou o que ficou de fora com o motivo, no lugar em que a gramática vive (`guarda.md`), e pôs um caso de "passa" para
  cada forma excluída (`ConsultaX`, `Agendamento`, `CHAVE_X` fora da web). Quem ler a guarda não vai achar o furo de novo.
- O `test-engineer` reprovou a 1ª rodada por faltarem nove blocos de mutação, e a 2ª veio com um bloco por cláusula nova.

### 5. Conclusão

REPROVADA por um crítico só, novo, e pequeno: uma classe local de teste renomeada fora do inventário, contra o RF2. O RF8 e os dois
itens de pronto que faltavam na rodada 1 estão cumpridos, com sonda e mutação próprias. O resto da funcionalidade não mudou desde a
rodada 1 e segue provado lá.

O caminho até APROVADA: a palavra do Joaquim numa adenda 6 de uma linha (opção a, sem código se ele aceitar `CountingProcessor`), ou a
volta ao nome antigo com exceção nominal (opção b). Depois, revalidar só o RF2.

### 6. Pendências herdadas

- **Merge da `develop` antes do pouso** (Orquestrador, `passos/8-validacao-e-pouso.md:67-70`): como na rodada 1. A `origin/develop`
  tem os mesmos commits de 30/10 que a spec não trouxe (12 no `git log 68902e84..origin/develop`, contando os merges e os de
  registro), com 17 arquivos de código em `apps/web/src/componentes/` e `e2e/casca-publica.spec.ts`, no caminho e no nome antigos. O
  `restos` e a guarda desta validação não viram esse código.
- **Aviso de pouso** (o campo `tipo` do log em 20 classes de erro), **`ERRO_INTERNO` com o Postgres sem resposta** e a frase de
  "Como testar" do `11_task.md`: como na rodada 1.
- **Fora do processo:** nenhum commit `Fora do processo:` com código na spec. O único commit de código desde a rodada 1 é o
  `9614bdf8`, marcado `(correção 2026-11-02-guarda-formas-do-inventario)`.
- **Revisão da spec:** `revisao-spec.md`, rodada 9 (30/10/2026), APROVADA.

## Rodada 1 — 02/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `13b562c9` (código igual ao de `8b9a2c45`; o `13b562c9` só registra o estado)
**Veredito: REPROVADA**

Um crítico: a guarda do RF8 não recusa `Agendador…`, que o próprio RF8 e o "Pronto quando" do `ROADMAP.md` citam pelo
nome, nem seis outras formas da coluna que o `inventario.md` §1 diz que a guarda usa. O resto da funcionalidade está
provado: o rename está completo (`restos` limpo, com mutação), o `conferir` está verde nas onze ondas, refeitas aqui, as
travas das regras 10, 20 e 70 continuam mordendo, e todo revisor obrigatório tem rodada aprovada.

Antes dos testes, o `node_modules` era anterior ao `package-lock.json` (ainda ligava `@educa/nucleo`): rodei `npm ci`.

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `inventario.md` (§1 regras, §2 decisões fechadas, "Ficam", "Não muda, mas parece"); anexos `inventario-core-shared.md`, `inventario-back.md`, `inventario-web-e2e.md` com nome atual, nome novo, tipo, caminho e usos, agrupados com a regra do grupo | documento | Status "aprovado (Joaquim, 29/10/2026)"; dúvidas fechadas no §2 |
| RF2 | ATENDIDO | aprovação em `6ea5721b` (29/10 21:20 UTC); adendas 1 e 3 no `inventario.md:174,193`, 2, 4 e 5 em arquivo próprio, cada uma com a data da aprovação | `git merge-base --is-ancestor`: `6ea5721b` antes da 1.0 (`da6e5462`) e da primeira onda (`699d7fa9`, 30/10); adenda 4 (`af49ef09`) antes da 10.0 (`91a644e5`); adenda 5 (`36e3b716`) antes da correção que a aplica (`165b7ca8`) | |
| RF3 | ATENDIDO | `tools/renomear/restos.ts:153` (`restos`), 11 mapas em `tools/renomear/mapas/` | `node tools/renomear/restos.ts` no `13b562c9`: "limpo. 11 mapas, nenhum nome antigo sobrou."; `tools/renomear/restos.test.ts` verde (com "a árvore não tem resto dos mapas aplicados"); mutação abaixo | O `restos` não cobra o nome antigo **na própria declaração** (`tools/renomear/sintaxe.ts:31-34`, `ehNomeDeDeclaracaoLocal`): só o uso. Varredura minha das declarações exportadas em `apps/`, `packages/`, `e2e/`: 9, todas homônimas classificadas `fica` nos mapas 7, 8 e 10 (`inventario-web-e2e.md:555`, `inventario-back.md:209,473`). Menor, abaixo |
| RF4 | ATENDIDO | `packages/core/package.json` (`@educa/core`), `infra/docker/servico.Dockerfile` (só `nucleo` → `core`), `infra/compose.yml` (só três comentários) | `npm run build -w @educa/shared && npm run build -w @educa/core`: verde; serviços de `infra/compose.yml` iguais antes (`d5303ef1`) e depois (mesmo hash da lista de chaves de topo); `compose.yaml` e `infra/compose.carga.yml` sem diff; imagem da API construída localmente (resultado na seção 3) | A construção de todas as imagens é da esteira, conferida no fechamento |
| RF5 | ATENDIDO | `apps/web/src/components/ui/` (`Button`, `Card`, `Tabs`, `Alert`, `Table`, `overlays/Dialog`, `overlays/Sheet`, `ai/…` do AI Elements); ficam `Comemoracao` e a onça, pelo inventário ("Ficam") | `apps/web/src/components/ui/onca/fidelidade-ao-mockup.test.tsx` verde e com **0 linhas de diff** desde `d5303ef1` (move puro); `Onca.tsx` com 4 linhas (o import do `AIBadge`, que a Tech Spec §5 prevê) | |
| RF6 | ATENDIDO | `e2e/support/` (era `e2e/__fixtures__/`), `apps/api/test/*.fixture.ts`, `SessaoFixtures` | `conferir` refeito por mim nas onze ondas (seção 3): ele compara os casos de teste por arquivo e ficou verde em todas | Os títulos que citam nome antigo (`@SemEscopo` em `repositories-com-escopo.test.ts:87`, `packages/nucleo/src` em `tools/guardas/guardas.test.ts:456`) ficam, pelo RF6 |
| RF7 | ATENDIDO | `tools/renomear/conferir.ts` | `conferir` refeito em worktree temporário para cada onda (`git reset --soft` no pai do commit da onda; mapas 3 a 11, 13 e adenda-5): **verde nas onze**. Sanidade: com a rota de `sessao.controller.ts:20` trocada, a 7.0 ficou VERMELHA com as duas strings. Migrations: `git diff -M d5303ef1 13b562c9` em `drizzle/` dá 81 arquivos, todos `R100`, `_journal.json` sem diff | O "verde antes e depois de cada onda" das suítes inteiras é da esteira, conferida no fechamento |
| RF8 | **PARCIAL** | `tools/guardas/nomes-de-mercado.mjs:31-63` (`FORMAS`), `tools/guardas/regras-nome.mjs` | `tools/guardas/guardas.test.ts` › "guarda de nome de mercado" verde (86 casos); mutação abaixo. **Sonda minha** (`ESLint.lintText`, sem gravar arquivo) em `apps/api/src/ia/x.ts`: `class AdaptadorX` e `class XEmMemoria` recusadas com o nome de mercado; `class TurmaController` passa; **`class AgendadorDeX` passa**, e também `class ExecutorDeX`, `class ProcessadorDeX`, `class ExecutorDeJobs`, `const METADADO_X`, `const CHAVE_X` (em `apps/web`), `interface ConsultaDeX` e o arquivo `apps/api/test/material-de-teste.ts` | O RF8 cita `Agendador…` entre os prefixos que a guarda recusa, e o "Pronto quando" do `ROADMAP.md:357-358` também. O `inventario.md` §1 diz "A guarda do RF8 usa os prefixos e sufixos da coluna da esquerda", e a coluna tem `METADADO_<X>`, `CHAVE_<X>`, `Consulta<X>`, `Processador`, `Agendamento`, `ExecutorDeJobs` e `*-de-teste.ts`, que a `guarda.md` não traz e não justifica (só `Pedido…` e `Resposta…` têm motivo, a colisão com o domínio). Crítico 1 |
| RF9 | ATENDIDO | `docs/guia-do-desenvolvedor.md:450` (§9 reescrita: "Nomes nossos e o padrão que eles implementam", só o que mistura domínio e peça); `docs/arquitetura.md`; `docs/interface.md`; `packages/core/src/ia/README.md`; `apps/web/src/components/ui/ai/README.md` | `restos` limpo com o `mapas/13.json` (que liga os documentos e tira a isenção do ouro); `git grep` de 18 nomes antigos de amostra (`SemEscopo`, `ErroDeDominio`, `AdaptadorFalso`, `packages/nucleo`, `componentes/ui`, `ProvedorDeIa`, `EmMemoria`, `AgendadorDe`, `e2e/__fixtures__`…) nesses documentos: 0 | `docs/runbook.md:995` cita `ErroDeDominio` de propósito, na tabela "antes → depois" do `tipo` do log (correção `runbook-tipos-de-erro`) |
| RF10 | ATENDIDO | `.claude/`, `CLAUDE.md` | `tools/processo/harness/caminhos.test.ts` (X7, RF24) verde; o mesmo `git grep` de amostra em `.claude/` e `CLAUDE.md`: 0 | |
| RF11 | ATENDIDO | `tools/guardas/escopo-dos-repositories.ts:272` (`Unscoped`), `tools/guardas/camadas.cjs:58-80` (`packages/core`), `eslint-suppressions.json` | `tools/guardas/filtros-casam.test.ts` verde; `tools/guardas/repositories-com-escopo.test.ts` e `camadas.test.ts` verdes; `eslint-suppressions.json`: 200 chaves, 0 órfãs; mutação abaixo | Os nomes de regra do `camadas.cjs` (`nucleo-nao-importa-app`) ficam: são texto de `tools/`, fora do recorte (PRD §3) |

Nenhum RF tem tela ("Nenhuma tela muda", Tech Spec §9): sem foto.

Provas de mutação (a árvore terminou limpa em todas, `git status` vazio):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF8 | a linha `{ forma: 'Adaptador', … }` de `tools/guardas/nomes-de-mercado.mjs` | `tools/guardas/guardas.test.ts`: os seis "recusa cada forma… em <caminho>", "AdaptadorX (classe) … dá o nome de mercado" e "a mensagem de `class AdaptadorX` contém `XAdapter`" |
| RF11 (regra 10) | `exportado === 'Unscoped'` → `'SemEscopo'` em `tools/guardas/escopo-dos-repositories.ts:272` (a trava de volta ao nome antigo, forma A) | `tools/guardas/repositories-com-escopo.test.ts`: 5 casos, entre eles "todo método público real tem (a) a prova do contexto, (b) @SemEscopo com motivo ou (c) a entrada na lista" |
| RF3 | `new FakeAdapter(` → `new AdaptadorFalso(` em `packages/core/src/ia/llm-gateway.test.ts:37`, com `git add` (o `restos` lê o índice, Tech Spec §5) | `node tools/renomear/restos.ts`: "1 nomes antigos sobraram … llm-gateway.test.ts:37 (identificador) cita "AdaptadorFalso"" |

A primeira tentativa no RF3 trocou o nome **na declaração** (`fake-adapter.ts`, `class FakeAdapter` → `class AdaptadorFalso`) e o
`restos` deu limpo: é o limite do `ehNomeDeDeclaracaoLocal` (menor 2).

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: glossário vence | cumprida | "Ficam" e "Não muda, mas parece" do inventário; `Comemoracao`, `Conversa`, `Fila` de domínio continuam; a guarda deixa passar `TurmaController`, `EliminacaoDoTitular` (sonda e casos de `guardas.test.ts`) |
| Regra: nome misto, sem misturar idiomas na mesma palavra | cumprida | `SessaoGuard`, `EscolaConcurrencyLimiter`, `ExecucaoScheduler`, `OperadorChallengeStep` (guia §9) |
| Regra: o nome novo é o da documentação | cumprida | inventário §1 (NestJS, BullMQ, shadcn, AI Elements, transactional outbox), revisado pelo Joaquim |
| Regra: as regras 10, 20 e 70 não se afrouxam | cumprida | mutação do `@Unscoped` (regra 10) vermelha; `conferir` verde nas onze ondas (nenhum caso saiu); travas em `travas.md` com mutação por onda; as duas correções `mensagem-do-assistente-por-ano` e `mensagem-do-tutor-por-ano` fecharam furos reais da regra 10 achados no caminho, com revisão própria |
| Regra: cada onda termina verde e pousável | cumprida no que cabe aqui | `conferir` verde em cada onda; a esteira de cada encontro é do Orquestrador |
| Borda: correção pousa na `develop` no meio da X8 com nome antigo | coberta por teste; **pendente na prática** | `tools/renomear/reaplicar.test.ts` verde (com o filtro por `arquivo` da correção `reaplicar-filtra-arquivo`); `.claude/skills/seguir/passos/8-validacao-e-pouso.md:67-70` manda o merge virar correção com o `reaplicar`. A `origin/develop` tem 9 commits que a spec não trouxe (a onça na tela de entrar), com código no caminho e no nome antigos: `apps/web/src/componentes/CascaPublica.tsx` importa `./ui/Marca` (hoje `Logo`), e há arquivos novos em `componentes/ui/onca/`. Seção 6 |
| Borda: o nome novo colide com um que já existe (`LLMProvider` e `ProvedorDeIa`) | coberta | `ProvedorDeIa` → `LLMGateway` (inventário §2, decisão 6); `restos` limpo |
| Borda: colide com nome de biblioteca | coberta | inventário dá o nome sem alias ou registra o alias; o `aplicar` recusa colisão sem `alias` (`casos.md`, `aplicar.test.ts`) |
| Borda: classe técnica que grava string de fora | coberta | `conferir` verde: filas, rotas, códigos de erro e eventos iguais; o `this.name` dos erros muda de propósito (adenda 1, `excecoesDoConferir`), com o runbook acertado na correção `runbook-tipos-de-erro` |
| Borda: recusa de domínio (`RenovacaoRecusada`) | coberta | → `RefreshRejectedError` (inventário §1); o código de erro é string, igual no `conferir` |
| Borda: rename só de caixa | coberta | `tools/renomear/aplicar.test.ts` › "rename só de caixa: passa pelo nome intermediário" verde; nenhum rename só de caixa aconteceu, e a árvore do `13b562c9` não tem dois caminhos que só diferem na caixa |
| Pronto: nenhuma peça do inventário e das adendas 1 a 5 com nome antigo (`restos` com todos os mapas, sem a isenção do ouro) | cumprido | `restos` limpo, com o `13.json` presente |
| Pronto: `@educa/core` construído, compose de produção sem diff de serviço | cumprido | build local; serviços iguais |
| Pronto: kit com os nomes do shadcn e do Radix, onça sem diff | cumprido | RF5 |
| Pronto: apoio de teste com nome de mercado, texto dos casos igual | cumprido | RF6 |
| Pronto: `conferir` verde em cada onda | cumprido | refeito aqui nas onze |
| Pronto: a guarda recusa o nome técnico em português, e a árvore passa | **faltando** | a árvore passa; a guarda não recusa `Agendador…` nem seis formas do inventário §1 (RF8) |
| Pronto: documentos vivos, `.claude/` e `CLAUDE.md` com os nomes novos | cumprido | RF9, RF10 |
| Pronto: cada trava continua recusando o que recusava | cumprido | mutações por onda nos `N_task.md`; duas refeitas aqui (RF8, RF11) |
| Pronto: esteira verde no último commit que alterou código | esteira: conferida no fechamento | |
| Roadmap, "Pronto quando": "uma guarda recusa… (`Adaptador…`, `…EmMemoria`, `Agendador…`)" | **faltando** | `Agendador…` passa |
| Roadmap: guia §9, `docs/arquitetura.md` e o README da camada de IA com os nomes novos | cumprido | RF9 |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: suíte inteira, da esteira |
| `npm run lint` | não rodado: suíte inteira, da esteira |
| `npm run test` | não rodado inteiro. Rodados isolados, como evidência: `tools/renomear/restos.test.ts`, `tools/guardas/filtros-casam.test.ts`, `tools/processo/harness/caminhos.test.ts` (103 ✅); `tools/guardas/guardas.test.ts -t "guarda de nome de mercado"` (86 ✅); `tools/guardas/repositories-com-escopo.test.ts` (51 ✅); `tools/guardas/camadas.test.ts` e `apps/web/src/components/ui/onca/fidelidade-ao-mockup.test.tsx` (51 ✅); `tools/renomear/reaplicar.test.ts` e `conferir.test.ts` (93 ✅); `tools/renomear/aplicar.test.ts -t caixa` (1 ✅). Nenhum vermelho fora das mutações |
| Ferramentas da onda | `restos` limpo no `13b562c9`; `conferir` verde nas onze ondas (3, 4, 5, 6, 7, 8, 9, 10, 11, adenda-5, 13), refeito em worktree temporário |
| Build | `@educa/shared` e `@educa/core` ✅; imagem da API (`servico.Dockerfile --target api`, com `packages/core` e `drizzle/`) ✅, construída e apagada em seguida |
| `npm run test:e2e` | não se aplica aqui (esteira) |
| `npm run test:infra` | não se aplica aqui (esteira) |
| Esteira do GitHub | conferida no fechamento: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ As 13 tarefas têm rodada de todo revisor obrigatório do `tasks.md` (com `llm-integrator` na 4.0 e na 5.0 e `frontend-reviewer` na 9.0 e na 10.0), com APROVADO na última; as 23 correções da spec também |

### 4. Achados

**Críticos**
- `tools/guardas/nomes-de-mercado.mjs:31-63` (e `guarda.md`, tabela "A gramática"): a guarda não recusa `Agendador…`, que o
  RF8 (`prd.md:80`) e o "Pronto quando" do `ROADMAP.md:357-358` citam pelo nome, nem `METADADO_<X>`, `CHAVE_<X>`,
  `Consulta<X>`, `Processador`/`Agendamento`/`ExecutorDeJobs` e `*-de-teste.ts`, que estão na coluna da esquerda do
  `inventario.md` §1, a que o próprio inventário diz que a guarda usa. Prova: `class AgendadorDeX {}` em
  `apps/api/src/ia/x.ts` passa sem mensagem. O estreitamento não está registrado: a `guarda.md` só justifica `Pedido…` e
  `Resposta…`. É o caso que o RF8 existe para pegar: um `AgendadorDe…` novo nasce com o nome antigo e nada acusa.
  Correção (uma das duas): (a) uma correção acrescenta à `FORMAS` ao menos `Agendador` → `{X}Scheduler` (classe), e as
  formas do §1 que valem (`METADADO_` → `{X}_KEY`, `CHAVE_` → `{X}_QUERY_KEY` em `apps/web`, `Processador`/`Executor` →
  `…Processor`/`…Executor`, o segmento `*-de-teste` → `*.fixture`), com um caso recusado e um que passa por forma em
  `guardas.test.ts` e a árvore continuando verde; ou (b) o Arquiteto registra na `guarda.md` por que cada forma fica fora e,
  com a palavra do Joaquim, tira `Agendador…` do RF8 e do "Pronto quando" do roadmap. Sem uma das duas, o RF8 fica parcial.

**Maiores**
- Nenhum além do crítico. (O estreitamento silencioso da `guarda.md` diante do inventário §1 seria um maior de "desvio sem
  registro"; está contado dentro do crítico.)

**Menores**
- `tools/renomear/sintaxe.ts:31-34` (dono: quem mexer no `tools/renomear/`): o `restos` não cobra o nome antigo na própria
  declaração (`class AdaptadorFalso {}` sem uso passa limpo, prova acima). O `tsc` pega o uso e a guarda pega as formas
  dela, mas uma declaração de topo exportada e sem uso, fora das formas da guarda, escaparia. Hoje a árvore não tem
  nenhuma (varredura acima). Correção: o `restos` cobrar a declaração de topo cujo nome é `de` de uma entrada com
  `arquivo` igual ao caminho dela (depois dos moves), ou declarar o limite na Tech Spec §5 ao lado dos outros.
- `TODO.md:83,168,231,259,751,1663,1773,1775,1780,2373,2376` (dono: Orquestrador): 11 itens abertos citam caminho ou nome
  antigo (`packages/nucleo/src/…`, `@SemEscopo`). O `TODO.md` está fora do RF9 e do RF10, mas quem pegar o item vai
  procurar arquivo que não existe. Correção: trocar o caminho no fechamento.
- `tasks/prd-nomes-de-mercado/tasks.md`: as subtarefas 2.1 a 2.4 estão `[ ]` com a 2.0 `[x]` (dono: Orquestrador).
- `ROADMAP.md:360` cita `packages/nucleo/src/ia/README.md` no "Pronto quando" da X8 (dono: Orquestrador, ao fechar a
  X8 no roadmap): é o texto da promessa, mas o caminho já não existe.

**Positivos**
- O `conferir` é reproduzível depois do fato: cada onda refeita em segundos num worktree, e ele pega uma rota trocada.
  Vale repetir em toda spec de rename ou de refatoração "sem mudar comportamento".
- As travas foram provadas por mutação na forma que a `travas.md` dava, e as duas que refiz aqui (a guarda nova e o
  `@Unscoped`) ficaram vermelhas de verdade.
- O rename achou e corrigiu dois furos reais da regra 10 (`mensagem-do-assistente-por-ano`, `mensagem-do-tutor-por-ano`)
  sem misturá-los às ondas, cada um com correção e revisão próprias.

### 5. Conclusão

REPROVADA por um crítico só: o RF8 promete, por escrito no PRD e no roadmap, que a guarda recusa `Agendador…`, e ela
não recusa; e o inventário §1 diz que a guarda usa a coluna inteira, e ela usa uma parte, sem registro do porquê. Todo o
resto está provado com evidência própria: o rename está completo e é só de nome (`restos` limpo, `conferir` verde nas
onze ondas, migrations só movidas, compose com os mesmos serviços, onça sem diff), as travas das regras 10, 20 e 70
continuam mordendo, e o processo está em ordem.

O caminho até APROVADA: a correção do crítico (opção a, que é pequena: linhas na `FORMAS` e casos no `guardas.test.ts`),
ou a revisão do RF8 e do roadmap com a palavra do Joaquim (opção b). Depois, revalidar só o RF8 e o "Pronto quando".

### 6. Pendências herdadas

- **Merge da `develop` antes do pouso** (Orquestrador, `passos/8-validacao-e-pouso.md:67-70`): a `origin/develop` tem 9
  commits que a spec não trouxe (`bcfde038`, `9beda7c6`, `d948aba6`, `5eb334c2` e os de registro), 17 arquivos de código
  em `apps/web/src/componentes/` (com `ui/onca/CenaDaOnca.tsx`, `DesenhoDaOnca.tsx`, `OncaDaMarca.tsx` e
  `CascaPublica.tsx`, que importa `./ui/Marca`, hoje `Logo`) e `e2e/casca-publica.spec.ts`. O merge vai dar conflito de
  local de arquivo e precisa da correção com `reaplicar`, `conferir` e `restos`, com a esteira verde, antes do pouso. O
  `restos` e a guarda desta validação não viram esse código.
- **Aviso de pouso (infra-guardian, 7.0 e 8.0; correção `runbook-tipos-de-erro`):** o campo `tipo` do log mudou em 20
  classes de erro; busca de log salva com o nome antigo deixa de achar. O runbook já diz isso; vai na mensagem de pouso.
- **Do `estado.md`, para decidir no pouso:** a API devolve `ERRO_INTERNO` (500), e não 503, com o Postgres sem resposta
  no `query_timeout` (`packages/core`, `pool.ts`/`mapPostgresError`), achado de passagem da correção da L1; e
  `coordenacao-introducao.spec.ts:102`, com a mesma exposição. Destino: `TODO.md`, se o Joaquim não quiser antes.
- **Do `11_task.md`, "Recomendações sem aplicar":** a frase de "Como testar" com destino `TODO.md`, ainda no "Devo ainda"
  do `estado.md`.
- **Fora do processo:** nenhum commit `Fora do processo:` com código na spec, e nenhum commit de código sem `(tarefa N.0)`
  ou `(correção <slug>)` depois de `origin/develop`.
- **Revisão da spec:** `revisao-spec.md`, rodada 9 (30/10/2026), APROVADA.
