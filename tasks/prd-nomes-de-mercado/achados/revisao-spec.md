# Achados das revisões — `tasks/prd-nomes-de-mercado/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-10-29 21:35:31 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: nenhum novo. A Tech Spec não adiciona nem altera chamada de modelo. `Perfil` e `PERFIS` ficam (inventário core-shared §2), e os quatro perfis (`rapido`, `padrao`, `complexo`, `visao`) seguem como estão.

Custo estimado por professor/mês: não se aplica. Não há chamada nova, então o custo é o de hoje. O código de execução, os perfis e as strings de consumo são os mesmos (Tech Spec §7 e §7c).

Prompt versionado: sim, sem mudança. `ia/prompts` e os `PROMPT_*` ficam (inventário core-shared §2 e "Já com nome de mercado"). Os arquivos de prompt não entram no mapa.

Validação de schema: sim, sem mudança. O rename não toca schema nem `limpar-saida`, só nomes (`limpar-saida.ts` vira `clean-output.ts`). O `conferir` (§5) compara os casos de teste por arquivo.

Aprovação humana no caminho: não se aplica. O rename não mexe em entrega, nota nem aprovação. A regra 70 está coberta pela §10 ("as suítes de hoje, inteiras, em cada onda").

**Os itens da minha lista contra a Tech Spec**

| # | Item | Situação | Onde na Tech Spec |
|---|---|---|---|
| 1 | SDK só no adaptador (`PASTA_DOS_ADAPTADORES`) | Deixa implícito, e o desenho tem um defeito (bloqueante abaixo) | §7 só diz que a constante muda "porque os arquivos viram `*-adapter.ts`". Não dá o valor novo |
| 1b | Regra 30: nenhum módulo chama provedor direto | Garante por não-alteração | §6 e §10. A guarda `sdk-de-ia-so-no-adaptador` e o `no-restricted-imports` ficam, e o caso "deixa passar" é atualizado. Falta o caso negativo, ver B1 |
| 2 | Perfil declarado e o mais barato | Não se aplica | `Perfil` e as tarefas não mudam (§7) |
| 3 | Prompt em arquivo versionado | Não se aplica | `ia/prompts` e `PROMPT_*` ficam |
| 4 | Saída estruturada com caminho de erro | Garante por não-alteração | O `conferir` mantém o conjunto de casos. `CodigoDeErroDeIa` e `LLM_ERROR_CODES` mudam só de nome, e os códigos `IA_*` ficam |
| 5 | Timeout, retry, limite de custo | Não se aplica | `ResilientAdapter` e `OrcamentoDeIa` mudam só de nome |
| 6 | Registro completo da execução | Garante | §7: `consumo_ia` e `origem` (`falso`, `openai_compat`, `regra_fixa`) são strings que ficam, e o `conferir` as compara |
| 7 | Teste com adaptador falso ou Ollama | Garante por não-alteração | `FakeAdapter`, `ScriptedAdapter` e `FakeLlamaServer` só mudam de nome. Ver a recomendação sobre o inventário |
| 8 | Fila, idempotência, sobrevive a reinício | Garante | §7c: strings de fila e de chave Redis iguais, sem migration. `JobOutbox` e `OutboxRelay` são rename |
| 9 | Entrega nasce `pendente` | Não se aplica | §7b e §10 |
| 10 | Limites de passos e de custo | Não se aplica | Sem mudança de comportamento |

**Pontos específicos que você pediu**

- `Adaptador*` para `*Adapter`: a escolha de `Adapter` em vez de `Provider` está bem justificada (inventário §2, decisão 6).
- `ProvedorDeIa` para `LLMGateway`: a decisão 6 resolve a colisão de `LLMProvider` e `ProvedorDeIa` do PRD §7. A porta fica e a classe que a implementa sai. O sufixo `Gateway` é de mercado.
- `LLM_PROVIDER` fica: o token já está em inglês e a porta não muda.
- `IA_ADAPTADOR` e `origem`: ficam como string, e a Tech Spec cita `IA_ADAPTADOR` em §7. O inventário core-shared "Não muda, mas parece" lista `falso`, `openai_compat`, `regra_fixa` e o check de `consumo_ia`. Os arquivos que as leem são `config-ia.ts`, `.env.example`, `docs/roteiro-da-demonstracao.md` e `apps/api/test/escola-com-tutor.ts`.
- README da camada de IA: a Tech Spec o cobre na 12.0, que fala de "os READMEs". O `aplicar` não o troca, porque o passo 5 só olha `CLAUDE.md`, `.claude/` e `docs/`. O README cita `ErroDeIa`, `ExecutorDeAgente`, `AgendadorDeExecucoes` e outros, e fica com nome antigo da 3.0 até a 12.0.

**Bloqueantes**

**B1. Tech Spec §7 e §5, mais inventário core-shared §17 (linha `ia/adaptador.ts` para `ia/model-adapter.ts`): a guarda de SDK da regra 30 fica incoerente com o nome novo do arquivo.**

O que está errado:
- Hoje a exceção é `packages/nucleo/src/ia/adaptador-*.ts`. Ela cobre `adaptador-falso.ts`, `adaptador-openai-compat.ts` e `adaptador-resiliente.ts`, e **não cobre** `adaptador.ts`, que é a interface `AdaptadorDeModelo` e não tem SDK.
- O caso `packages/nucleo/src/ia/adaptador.ts` está de propósito na lista de reprovados em `tools/guardas/guardas.test.ts` (bloco "guarda de SDK de provedor de IA").
- A Tech Spec §7 diz que os arquivos "viram `*-adapter.ts`", mas o inventário renomeia `adaptador.ts` para `model-adapter.ts`. Esse nome **casa** com `*-adapter.ts`.
- O resultado depende de como o implementador resolver:
  - Se o glob virar `*-adapter.ts`, o arquivo da interface passa a ficar isento da proibição de SDK, e a exceção da regra 30.1 se alarga em silêncio.
  - Se o caso do `guardas.test.ts` for atualizado mecanicamente para `.../model-adapter.ts`, ele fica vermelho.
  - Se for removido para ficar verde, "nenhum caso entra ou sai" (RF7) é violado.
  - Se ninguém o tocar, ele continua verde sem testar nada.
- A segunda causa é que o `aplicar` nunca troca string, e o relatório dele só lista ocorrências fora do TypeScript (§2 e §5, passo 5). Os caminhos escritos como texto em `tools/guardas/guardas.test.ts` e `tools/processo/harness/caminhos.test.ts` (arquivos `.ts`) não aparecem na lista.
- O caso de reprovação é o que deixa o teste vazio sem aviso. O de "deixa passar" fica vermelho por si e é notado.
- Hoje nenhum adaptador importa SDK (o `OpenAICompat` usa fetch). Um glob que não casa com nada fica verde sem checar nada. Só `caminhos.test.ts` percebe, porque exige que a pasta exista (`problemaDoCaminho`).

Correção exigida, na Tech Spec §7:
1. Escrever o valor novo de `PASTA_DOS_ADAPTADORES` e dizer que o conjunto de arquivos isentos é o mesmo de hoje (os três adaptadores).
2. Resolver o nome do arquivo da interface para que não case com o glob: `adapter.ts` (tradução direta de `adaptador.ts`), e não `model-adapter.ts`. O inventário core-shared §17 precisa ser corrigido na mesma passada.
3. Exigir que o `guardas.test.ts` continue com o caso "reprova" no arquivo da interface (`packages/core/src/ia/adapter.ts`) e com os casos "passa" nos três adaptadores novos.
4. Exigir a atualização do `caminhos.test.ts` que confere que a guarda, a regra 30 e o `llm-integrator.md` citam a mesma pasta, e que ela existe.
5. Dizer em que onda isso muda: pelo §7 e pelo §6, ao lado do `guardioes-por-caminho.ts`, deve ser a 4.0, junto com a renomeação dos arquivos.

**Recomendações**

- **`LLMProviderKind` contradiz a decisão 6** (inventário core-shared §2, `AdaptadorDeIa` para `LLMProviderKind`). A decisão evita `Provider` em três níveis, e este tipo lista os adaptadores (`falso`, `openai_compat`). Sugestão: `LLMAdapterKind`. O mesmo vale para a constante `ADAPTADORES_DE_IA`, que fica em português e não é pega pela guarda por ser UPPER_SNAKE.
- **Registrar o que fica, para ninguém reabrir:** a chave da regra de lint `sdk-de-ia-so-no-adaptador` (citada na regra 30, na skill `receitas-de-codigo` e no guia §10) e o nome `PASTA_DOS_ADAPTADORES`. Ambos estão em `tools/`, que o PRD §3 deixa fora do rename. A Tech Spec só implica isso.
- **Ampliar a lista de referências por texto do `aplicar`:** ele deveria listar também as ocorrências de string dentro de `.ts` de `tools/`, `infra/test/` e `apps/*/test`. O passo 5 e o §2 as deixam de fora. Isso vale para as outras guardas (regra 10), não só para a da IA.
- **Corrigir a frase do §7b "Sem IA no caminho do aluno":** o Tutor está no caminho do aluno. O sentido é que nada de comportamento muda. Diga que `turno-do-tutor.test.ts` e `tutor-modelo.int.test.ts` seguem verdes por suíte inteira, sem alteração.
- **O desenho do diagrama da regra 30 na 12.0:** o diagrama mostra `OllamaAdapter`, que não existe no código. O caminho real é `LLMProvider` → `LLMGateway` → `ModelAdapter` → `FakeAdapter` / `OpenAICompatAdapter` / `ResilientAdapter`. Ao reescrever, usar esses nomes.
- **Nomes mistos num mesmo identificador:** `withEscolaContextOfRequest` e `InProcessAgenteExecutor` misturam pt e en dentro de uma palavra composta, o que a regra 60.1 evita. O sufixo técnico no fim (`TurmaController`) é o padrão do PRD §6. Os dois casos são de fixture/interno e não bloqueiam.
- **O §5 e o §10 divergem na guarda 11.0:** o §5 diz que a guarda lê "cada pasta de `context.filename`", e o §10 testa um arquivo (`guarda-x.ts`). Diga se ela lê o nome do arquivo e se lê `tools/`.
- **RF9 sem teste:** a prova do README (RF9) é uma busca manual. Um teste que procure os nomes do mapa em `packages/core/src/ia/README.md` na 12.0 fecharia o ciclo.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario-core-shared.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/regras-ia.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/index.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/guardas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/processo/harness/caminhos.test.ts`
[… 1 linhas cortadas]

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-10-29 21:35:54 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: nenhuma tabela nova nem migration (Tech Spec §3 e §4, §7c). A pasta `drizzle/` muda de lugar junto com o pacote, e a varredura das tabelas físicas em `apps/api/test/arquitetura.test.ts` fica vermelha se o caminho ficar velho, então a falha aparece.

Queries verificadas: nenhuma consulta muda (§6). Conferi as travas que leem nome por texto, uma a uma, contra o código de hoje:
- `tools/guardas/escopo-dos-repositories.ts`
- `tools/guardas/regras-tenant.mjs`
- `tools/guardas/index.mjs`
- `tools/guardas/camadas.cjs`
- `tools/processo/guardioes-por-caminho.ts`
- `apps/api/test/arquitetura.test.ts`

Teste de isolamento: presente mas inútil em parte. As suítes de isolamento de hoje rodam inteiras em cada onda (§10), e isso basta para um rename. Mas a §6, que é onde se prova que a trava continua mordendo, deixa de fora a guarda de tabela e quase todos os tipos que contam como "o banco".

Item a item:
1. Tabela de domínio com `escolaId`, e com `anoLetivoId` quando varia por período: não se aplica (§3 e §4).
2. Escopo aplicado no repository a partir do token: a §6 garante só em parte. É o bloqueante 2.
3. Endpoint que aceita `escolaId` do cliente: não se aplica. Rota e corpo não mudam, e o `conferir` compara as strings (§3, §4 e §5).
4. Teste de isolamento efetivo: a §6 deixa implícito para duas travas. São os bloqueantes 1 e 2.
5. Não revelar dado de outra escola: garantido. Código de erro e `this.name` dos erros são strings, e o `conferir` as compara (§5).
6. Id UUID: não se aplica.
7. Camada de rede só com agregado: garantido. `permissao/` fica, e a matriz é a mesma (§7).
8. `@SemEscopo` só com justificativa: garantido. A justificativa é string e o `conferir` a compara. O `'@SemEscopo('` do `guardioes-por-caminho.ts` tem prova na §6.

Bloqueantes:

1. **§6, linha `regras-tenant.mjs`.** A Tech Spec diz que a guarda lê `Banco`, mas lá `Banco` só aparece em comentário. O que ela lê de fato é o nome do pacote: `const PACOTE = '@educa/nucleo'` (`tools/guardas/regras-tenant.mjs:31`).
   - **O problema:** na 4.0, quando o pacote vira `@educa/core`, um service com `import { escola } from '@educa/core'` passa sem acusação. É a regra 10.3 ficando verde sem checar nada, e os testes de hoje não percebem: o caso de `tools/guardas/guardas.test.ts:360` escreve `'@educa/nucleo'` direto no código.
   - **A mesma falha em `tools/guardas/index.mjs:98`:** a exceção `packages/nucleo/src/db/**` segue o caminho antigo.
   - **Correção exigida:** a §6 ganha uma linha para `regras-tenant.mjs` e `index.mjs`, onda 4.0, que lê `@educa/nucleo` e `packages/nucleo/src/db/**`.
   - **Prova exigida, nas duas direções:**
     - `import { escola } from '@educa/core'` em `apps/api/src/x/x.service.ts`: vermelho.
     - O mesmo import em `packages/core/src/db/schema/x.ts`: passa.
     - Nenhum caso de `guardas.test.ts` continua com `@educa/nucleo`.

2. **§6, linha `escopo-dos-repositories.ts`.** A lista do que a guarda lê está incompleta, e a prova é um caso só ("repository de fixture sem `requireEscolaId()`").
   - **O que a guarda lê de fato:**
     - `TIPOS_DO_BANCO = ['Banco', 'TransacaoBanco', 'ExecutorDeAuditoria']` (`tools/guardas/escopo-dos-repositories.ts:42`);
     - `PROVAS_DE_ESCOPO = ['exigirEscolaDoContexto', 'identidadeDaRequisicao', 'escopoDoJobNoContexto']` (linha 36);
     - o nome exportado `'SemEscopo'` (linha 272).
   - **O inventário já lista tudo isso** (`inventario-core-shared.md`, seção "Referências por caminho ou por nome", linha 1115), mas a §6 não leva para a prova.
   - **O caso perigoso é a troca parcial.** Se só `Banco` virar `Database` e `TransacaoBanco` e `ExecutorDeAuditoria` ficarem, todo método que recebe `tx: DatabaseTransaction` ou `DatabaseExecutor` deixa de "tocar o banco" e passa calado.
   - **Os testes de hoje não pegam isso:**
     - o teste com o repositório real (`repositories-com-escopo.test.ts:75`) continua verde, porque cada arquivo ainda tem um `this.banco: Database`;
     - as fixtures (`banco-por-parametro.repository.ts`, `executor-de-auditoria.repository.ts`, `propriedade-do-banco.repository.ts`) continuam verdes enquanto usarem o nome antigo, igual à lista velha.
   - **Correção exigida:** a §6 lista os seis nomes e os novos (`Database`, `DatabaseTransaction`, `DatabaseExecutor`, `requireEscolaId`, `requestIdentity`, `jobScopeInContext`), mais o `Unscoped`.
   - **Prova exigida:**
     - todas as fixtures de `tools/guardas/__fixtures__/repositories/` reescritas com os nomes novos e o import de `@educa/core`;
     - cada caso vermelho de hoje (linhas 155 a 176 do teste) continua vermelho;
     - a busca de cada nome antigo nas fixtures e na guarda dá zero.
   - **A onda passa a ser 3.0 e 4.0:** `REPOSITORIES_SEM_ESCOPO` cita `packages/nucleo/src/fila/job-registro.repository.ts`, que só muda de caminho na 4.0.

Recomendações:
- **§6, `apps/api/test/arquitetura.test.ts:50`:** a regex de uso da `ContaGlobalRepository` cita `@educa\/nucleo\/conta-global`. Depois da 4.0, o import `import * as x from '@educa/core/conta-global'` escapa dela. A cerca `cerca-conta-global` do `camadas.cjs` ainda o pega, mas a linha deveria estar na §6 com o caso vermelho.
- **§6, linha `camadas.cjs`:** trocar "violação de camada no caminho novo" por um caso por regra que cita `packages/nucleo` no `from` ou no `to`: `cerca-conta-global`, a regra do repository que importa service (exceção `expurgo-da-escola`), `shared-nao-importa-nucleo-nem-app` e `web-nao-importa-nucleo-nem-backend`. A árvore `tools/guardas/__fixtures__/camadas/packages/nucleo/` muda de caminho junto.
- **§6, `guardioes-por-caminho.ts`:** as exceções `apps/web/src/componentes/ui/` e `apps/web/src/galeria/` ficam velhas na 5.0 e na 8.0. O efeito pede mais guardiões, não menos, mas cabe registrar.
- **Fora do isolamento, para o `privacy-guardian`:** `ESCOPO_DO_ERRO_TIPADO` (`tools/guardas/index.mjs:38`) cita `packages/nucleo/src/**` e não está na §7.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/regras-tenant.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/index.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/guardas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/escopo-dos-repositories.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/repositories-com-escopo.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/camadas.cjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/api/test/arquitetura.test.ts`

## infra-guardian · 1ª rodada · REPROVADO · 2026-10-29 21:36:29 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | IA | migration | deploy. O rename passa pelos guards de sessão e de limite, pelo `EscolaConcurrencyLimiter` e o `concurrency-slot.lua`, pelo `OutboxRelay`, pelo `LLMGateway`, pelo comando do `migrar` e pelo Dockerfile. A §7c diz "fora do caminho quente", e não é o caso.
Rate limit: ok (prefixos `rl:` e `PREFIXO_LIMITE_*` e a env `LIMITE_*` não mudam; na §5 o `conferir` compara as strings)
Fila e prioridade: ok (`interativa`, `normal`, `lote`, `vaga:{fila}:{escola}` e o conteúdo do Lua não mudam; o SHA do script é o mesmo e o deploy em rolagem não quebra)
Concorrência: protegida (não se aplica: nenhuma condição nova)
Índice e paginação: ok (não se aplica: §3 e 4, nenhuma query muda)
Degradação de IA: ok (`IA_ADAPTADOR`, `falso` e `openai_compat` não mudam; o `adaptador-resiliente` só troca de nome; nenhum teste chama provedor pago)
Migration: compatível (§3 e 4: nenhuma migration nova; a pasta `drizzle/` vai junto e o journal não muda; o infra job prova que o `migrar` sai com 0)
Métrica e alerta: ok (nomes de métrica, `service.name` e `job="educa/..."` não mudam; nenhum alerta em `infra/grafana/` cita peça renomeada)

Bloqueantes:

1. **§2, §5 (passo 1 e `conferir`) e §7c: o harness de carga e o ensaio de alertas quebram em silêncio.** Três scripts carregam o código compilado por caminho em texto e acessam as funções por chave de objeto:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/scripts/carga-login.ts:336-339`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/scripts/carga-sala.ts:247-250`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/scripts/ensaio-alertas.ts:677-679`

   O código é este:
   ```ts
   nucleo: await importar('packages/nucleo/dist/index.js'),
   sessoes: await importar('apps/api/dist/sessao/tenant/sessoes-sinteticas.js'),
   hash: await importar('apps/api/dist/credencial/hash-de-senha.js'),
   ```
   Os tipos são literais, como `{ criarBanco: typeof criarBanco; criarPool: typeof criarPool }` e `{ HashDeSenha: typeof HashDeSenha }`.

   O inventário renomeia tudo isso: `packages/core`, `synthetic-sessions.ts`, `password-hasher.ts`, `createDatabase`, `createPool`, `PasswordHasher`, `createSyntheticSessions` e `syntheticTokenIssuer`. Nenhuma das proteções da spec pega o problema:
   - O `getEditsForFileRename` não vê `import()` com caminho montado por `join`.
   - O `findRenameLocations` não renomeia a chave do tipo literal. Por isso a tipagem continua verde e o `nucleo.criarBanco(...)` vira `undefined` em execução.
   - O `conferir` só lê `apps/`, `packages/` e `e2e/`.
   - Nenhum desses scripts roda na esteira (`importarDaApi` não aparece em `infra/test/`).

   O resultado: o próximo `carga:login` (7h30), o `carga:sala` e o `ensaio:alertas` falham, e são eles que provam a manhã de segunda e o alerta com runbook.

   Correção exigida:
   - Listar esses três arquivos na §2 e na §5 como referências por texto, com cada caminho de `dist` e cada chave.
   - Exigir uma prova que rode sem provedor pago, na onda que muda cada peça (4.0, 5.0 e 6.0). Pode ser um teste que chama `importarDaApi()` sobre o `dist` construído e confere que cada função existe, ou a execução de `carga:login`, `carga:sala` e `ensaio:alertas` com o adaptador falso, registrada na tarefa.
   - Levar a listagem de nomes do `aplicar` para `infra/scripts/`.

2. **§7c: a prova do deploy contradiz o inventário aprovado.** A §7c diz que "o serviço do compose não muda" e que "o `docker compose config` de produção sai igual". Mas o `inventario-back.md` (linhas 402 e 562) renomeia `apps/api/src/ops/migrar.ts` para `migrate.ts`. Com isso, o `command: [node, dist/ops/migrar.js]` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/compose.yml:123` tem de mudar, e o runbook também cita `dist/ops/migrar.js`. Do jeito que está escrita, a prova falha na 5.0 ou acaba sendo ignorada, e o serviço que roda antes de toda instância que usa o banco fica sem conferência.

   Correção exigida, em uma de duas formas:
   - manter `ops/migrar.ts` com o nome atual, como ponto de entrada chamado por texto, e registrar isso na lista do que fica; ou
   - declarar na §7c o diff esperado do `compose config` (só o `command` do `migrar`) e dizer em qual onda ele muda junto com o runbook. Nesse caso a §7c também precisa dizer que o rollback volta imagem e compose do mesmo commit, porque uma imagem anterior com o compose novo não sobe o `migrar`, e a API depende dele.

Recomendações:
- **§7c: reclassificar como caminho quente tocado (rename).** E nomear a prova no nível da imagem para as duas strings de arquivo lidas em execução: o `concurrency-slot.lua` copiado para o `dist` (script `build` de `packages/nucleo/package.json` mais o `readFileSync` em `vagas-por-escola.ts:14`) e o ramo `.js` do `ARQUIVO_DO_SANDBOX` (`apps/worker/src/processadores/sintetico.ts:12`). Essa prova é o `infra/test/jobs.int.test.ts` no job `infra` da esteira, porque os testes a partir do `src` só exercitam o ramo `.ts`.
- **§5, ondas em linha (6.0 a 10.0):** o `ci.yml` exclui `spec/**--l*`, então o infra job e o e2e só rodam quando a linha volta para a spec. Vale escrever que a onda de linha só conta como verde depois da esteira da spec.
- **§5 contra o inventário:** o `inventario-back.md:559` diz que o `this.name` do erro "muda junto com a classe". A §5 diz que o `aplicar` nunca toca string e que o `conferir` fica vermelho com qualquer string mudada. Decida qual vale, e se for a troca, ponha-a em `excecoesDoConferir`. Nenhum alerta lê o `tipo` do log, então não há impacto operacional.
- **§5, passo 5:** declarar e testar que o `paths:` da regra 80 (`packages/nucleo/**`) e o das outras regras passam a apontar para `packages/core/**`. Se não mudar, a regra 80 deixa de carregar sozinha para o core, e a revisão de infra das próximas specs fica sem ela.

Mantive a revisão no desenho, como pedido, e não editei nenhum arquivo.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-10-29 21:36:37 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

O rename não toca nenhum campo pessoal. O problema está em outro lugar: três checagens da regra 20 leem nome ou caminho como texto, e a Tech Spec não diz como cada uma continua provando o que provava. Duas delas, se o nome mudar e elas não, ficam verdes sem checar nada.

**Checklist, item por item**

*Coleta*
- **Campo novo na tabela do `docs/lgpd.md`:** não se aplica. Nenhum campo novo (§3 e 4, §7, PRD §8).
- **Campo proibido para aluno:** não se aplica. Nada muda.
- **Adaptação em vez de diagnóstico:** não se aplica. Nada muda.

*Exposição*
- **DTO de saída explícito:** implícito, e é bloqueante (B2). A §7 diz só que "as chaves do schema não mudam". Ela não vê que a trava deste item escolhe os schemas pelo prefixo do nome.
- **Autorização por objeto:** garantida. `@Permite` passa a `@RequirePermissao` com a mesma matriz (§7). A conferência das permissões lê a chave de metadado pelo símbolo, não pelo nome do decorator.
- **404 igual a 403:** não se aplica. Os códigos de erro são strings, e o `conferir` as compara (§3 e 4).
- **Bucket privado e URL assinada:** garantido. As variáveis `S3_*` e o formato da chave do objeto não mudam (anexo "Não muda, mas parece"). O caminho do teste citado na regra 20.7 está coberto pelo RF10.
- **Convite com expiração, uso único e revogação:** não se aplica. Só o nome da classe muda; as strings do JWT ficam.
- **Exportação auditada:** garantida. A ação auditada é string, e o `conferir` a compara (§7).
- **Erro sem stack trace e sem dado no corpo:** implícito, e é bloqueante (B1 e B3).

*Log e rastro*
- **Log sem dado pessoal:** garantido (§7). A guarda de log muda na 3.0 e na 4.0, com caso de fixture. Ela falha fechada: com o nome antigo esquecido, reprova código bom, não aprova código ruim.
- **Auditoria onde a regra exige:** garantida. O `porta-unica.test.ts` lê caminhos e um trecho de nome de arquivo por texto, mas todos falham fechados: o teste fica vermelho, não verde vazio.

*IA*
- **Envio mínimo, registro em `ExecucaoAgente`, provedor local:** garantidos. `IA_ADAPTADOR`, os valores `falso` e `openai_compat` e o código de execução não mudam. A `PASTA_DOS_ADAPTADORES` muda na 4.0, com caso (§7).
- **Conversa do tutor fora do alcance da rede:** não se aplica. A matriz não muda.

*Ciclo de vida*
- **Exclusão, retenção e eliminação:** não se aplica. Nenhuma migration, e os testes de hoje rodam inteiros em cada onda (§10).
- **Seed e fixture sintéticos:** garantido. O `conferir` exige as strings iguais, então nenhum dado entra pela troca de nome.

**Pergunta de fechamento.** Sim, o código continua respondendo. O arquivo do titular e a lista de compartilhamento só trocam de nome, e os testes deles seguem rodando.

```
VEREDITO: REPROVADO
Campos pessoais tocados: nenhum
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: ok
Logs: limpos (sem log novo; a guarda de log falha fechada)
Auditoria: presente
Envio externo: nenhum novo; IA_ADAPTADOR e o registro em ExecucaoAgente iguais (§7)
Seed/fixture: sintético (o conferir exige strings iguais)
Bloqueantes:
```

**B1. Tech Spec §7 e §10 ("Travas"): a guarda de erro tipado (regra 20.11) fica de fora, e ela pode ficar verde sem checar nada.**
- **O que está errado:** a §7 cita só a guarda de log e a do SDK de IA. A guarda de erro tem dois pontos que leem texto:
  - `regras-erro.mjs` procura a classe pelo nome `'ErroDeInvariante'`. Depois do rename, `new InvariantException(\`${aluno.nome}\`)` passa sem acusação.
  - `ESCOPO_DO_ERRO_TIPADO`, em `index.mjs`, vale para `packages/nucleo/src/**`. Com a pasta virando `packages/core`, o filtro não casa com nenhum arquivo e a guarda deixa de valer no core inteiro.
- **Por que os testes não pegam:** os de `guardas.test.ts` lintam com um caminho fictício `packages/nucleo/...`. Se esse caminho e o filtro ficarem velhos juntos, os testes continuam verdes.
- **Correção exigida:**
  - Pôr a guarda na §7, na 2.0 (a classe mora em `packages/shared/src/erros/`) e na 4.0 (o filtro).
  - Casos com caminho real `packages/core/src/x.ts`: `throw new Error(...)` reprova, e `new InvariantException` com valor de execução reprova.
  - Um teste de que todo filtro de arquivos em `configuracaoDasGuardas`, `EXCECOES_DAS_GUARDAS` e `PASTA_DOS_ADAPTADORES` casa com ao menos um arquivo existente, no mesmo espírito do "sem chave órfã" do RF11.

**B2. Tech Spec §7, linha "DTO de saída": a trava das regras 20.4 e 20.2 escolhe os schemas pelo nome e não está prevista.**
- **O que está errado:** `apps/api/test/contratos.test.ts` só varre os schemas exportados cujo nome começa com `'esquemaResposta'`, e a lista de nomes que ele confere e as exceções do MFA também estão escritas como texto. Depois da 2.0, que gera `*ResponseSchema` (98 entradas no anexo), a varredura não encontra nenhum schema. O teste de "nenhum campo proibido na saída" passa a comparar uma lista vazia e fica verde de qualquer jeito. Só a conferência da lista de nomes fica vermelha, e o RF7 ("nenhuma asserção muda") e o `conferir` (§5) proíbem a troca que a conserta. O implementador fica sem regra para decidir o novo filtro, e um filtro mais estreito encolhe a cobertura sem ninguém ver.
- **Correção exigida:**
  - Pôr a trava na §7, na 2.0.
  - Fixar o filtro novo: `endsWith('ResponseSchema')`.
  - Declarar em `excecoesDoConferir`, com o motivo, as strings que mudam (o prefixo, a lista de nomes e as chaves de `EXCECOES_NOMINAIS`).
  - Provar que o conjunto varrido depois é o de antes, nome a nome pelo mapa e com a mesma contagem, e que o caso de fixture com `email` na saída continua vermelho.

**B3. Tech Spec §5 (`conferir`) contra o inventário ("`name` do erro muda junto com a classe"): o teste que prova "nada interno no corpo do erro" (regra 20.11) perde o sentido.**
- **O que está errado:** o inventário diz que o `this.name` acompanha a classe. A §5 e o RF7 dizem que nenhuma string e nenhuma asserção mudam, e não declaram exceção. Se o `name` mudar e o teste não, `apps/api/test/erro.int.test.ts:166` (`expect(resposta.text).not.toContain('ErroDeInvariante')`) passa mesmo que o corpo da resposta traga `InvariantException`.
- **Correção exigida:** a Tech Spec decide entre duas saídas.
  - O `name` acompanha a classe, e as strings dos testes que o citam (`erro.int.test.ts:166` e `:169`, `erro-de-invariante.test.ts:10`) vão para `excecoesDoConferir`. Nesse caso, uma mutação prova que a 166 fica vermelha quando o filtro de erros vaza o nome novo.
  - Ou o `name` fica como string de fora e sai do inventário.

```
Recomendações:
```
- Incluir os literais de expressão regular no `conferir` (§5). Hoje ele compara só strings, partes de template e `JsxText`, e as detecções de CPF e as varreduras da auditoria são regex.
- Na guarda de log, a prova útil não é "fica vermelha": é `{ erro: summarizeError(e) }` passar e `{ erro: e.message }` continuar reprovando.
- Na guarda do SDK de IA, um caso em que um arquivo de `packages/core/src/ia/` que não é adaptador (o `llm-gateway.ts`) importa `openai` e reprova. Isso prova que o filtro `*-adapter.ts` não ficou mais largo que o de antes.
- Depois da 4.0, uma busca com resultado zero de `packages/nucleo` e `@educa/nucleo` em `tools/`.
- Pôr o `porta-unica.test.ts` na §7 só para o revisor saber que ele lê caminho por texto. Ele falha fechado.

Arquivos que conferi:
[… 5 linhas cortadas]

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-10-29 21:37:42 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

**VEREDITO: REPROVADO**

A spec não muda nenhum caminho de escrita, nenhuma decisão, nenhum prompt e nenhuma string de auditoria. O `conferir` (§5) garante isso, e a §3–4 diz que não há migration. Reprovo por dois bloqueantes: a §7b deixa implícito se as travas da regra 70 continuam provando o mesmo depois do rename, e isso não vale para todas. Algumas leem o código por nome ou caminho dentro de string ou de regex. As asserções negativas dessas travas viram vazias com a suíte verde, e nada do desenho percebe.

```
VEREDITO: REPROVADO
Caminhos de escrita em Nota: rota de aprovação do lote (`correcao.service` → `correcao.repository`), decisão de entrega (`entrega.service` → `entrega.repository`; `decidida_por`, `validacao_do_lote`); nenhum caminho novo — todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (comportamento igual; a trava "só a rota decide" fica vermelha e visível na 4.0)
Supervisão do tutor: ok (sem mudança; prompts são strings, comparadas pelo `conferir`)
Autonomia declarada e visível: sim (as constantes de valor ficam, inventário §2 item 4; o texto de tela é comparado pelo `conferir`)
Bloqueantes: B1 e B2, abaixo
Recomendações: R1 a R4, abaixo
```

**Item por item**

| Item | Na Tech Spec |
|---|---|
| 1. Nota com autor humano | Garante: nada muda na escrita. A trava do banco (`tabelas-do-mvp.int.test.ts`) usa nomes de banco, que ficam. As varreduras de código caem no B1 |
| 2. Decisão autônoma | Não se aplica |
| 3. Entrega nasce pendente | Garante pelo comportamento. A varredura do `entrega.int.test.ts` lê a pasta `packages/nucleo/src`, fica vermelha (ENOENT) na 4.0 e volta pela normalização de caminho do `conferir`. A §7b não lista essa trava |
| 4. Tutor | Não se aplica |
| 5. Autonomia | Garante (§5, `conferir`) |
| 6. Auditoria | Implícito, e falha: B1 |
| 7. Vigilância | Não se aplica |
| 8. D55 | Garante: prompts em TS como string, `numeros.test.ts` e a trava do banco ficam iguais. O ouro cai no B2 |
| 9. Medir o professor | Garante: a trava da conversa do professor no `assistente.int.test.ts` compara uma lista exata de caminhos, que ficam, e qualquer mudança a deixa vermelha |
| D58 (identidade de IA) | Implícito, e falha: B1 |

**Bloqueantes**

**B1. §2 ("Referências por texto"), §5 (passos 2 e 6 do `aplicar`; `conferir`), §7b e §10 ("Travas").**

O que está errado:
- O `aplicar` só lista referências por texto fora do TypeScript e nunca toca string.
- O `conferir` não lê regex. Para string, fica verde justamente quando ela **não** muda.
- Uma trava da regra 70 que cita nome ou caminho renomeado dentro de `.ts`/`.tsx` fica para trás, e a asserção negativa dela continua verde sem checar nada.

Casos confirmados na árvore:
- `packages/nucleo/src/auditoria/porta-unica.test.ts`: `expect(Object.keys(nucleo)).not.toContain('inserirAuditoria')`. A função vira `insertAuditoria` (anexo core-shared, linha 221). Exportar a porta de inserção pelo índice passaria. É a porta única da auditoria, que sustenta o item 6.
- `apps/web/src/componentes/ui/ia/Mensagem.test.tsx`: `not.toMatch(/from '\.\/AvatarAgente'/)`. O componente vira `AgentAvatar` (anexo web, linha 110). A mensagem poderia importar o avatar sem a assinatura (D58, regra 70 item 4a).
- `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts`: o filtro `nome.startsWith('galeria/')`. A pasta vira `gallery/` (anexo web, §13). Um arquivo da galeria importando o avatar direto passaria (D58).

Correção exigida:
- (a) O relatório do `aplicar` passa a listar também, em `.ts`/`.tsx` de `apps/`, `packages/` e `e2e/`, cada nome e cada trecho de caminho do mapa que aparece como palavra inteira dentro de string, de parte fixa de template ou de regex. A onda classifica cada ocorrência: "fica" (string de fora, como na lista do que parece mudar mas não muda) ou "trava" (atualizada, com entrada em `excecoesDoConferir` e o motivo).
- (b) A §7b ganha uma tabela como a da §6, com a trava, o que ela lê pelo nome, a onda e a prova vermelha com o nome novo. Ela cobre:
  - `entrega.int.test.ts`: chamar `decidir` de fora da rota, em `packages/core/src`
  - `correcao.int.test.ts`: chamar `.aprovar(` ou `.aprovarLote(` fora do service e da rota
  - `assistente.int.test.ts`: um repository novo tocando `mensagemAgente`
  - `porta-unica.test.ts`: o índice exportando `insertAuditoria`
  - `Mensagem.test.tsx`: a mensagem importando `AgentAvatar`
  - `avatar-so-nas-duas-pecas.test.ts`: um arquivo em `gallery/` importando o avatar
  - `guardioes-por-caminho.ts`: `components/ui/ai/` continua pedindo o `conformidade-reviewer`
- (c) A linha "Travas (RF11)" da §10 passa a dizer "§6, §7 e §7b".

**B2. §5, passo 5 (documentos vivos), contra a custódia do ouro.**

O que está errado: o passo troca caminho em todo o `docs/` menos o `decisoes.md`, e isso inclui o corpus do ouro.
- `docs/aia/ouro/README.md` cita `packages/nucleo/src/ia/__fixtures__/ouro.ts`, `amostras-do-assistente-revisao.ts`, `ouro.test.ts` e `selo-do-ouro.test.ts`.
- `docs/aia/ouro-retido/README.md` e `RETIDOS.json` citam `ouro.test.ts`.
- Mexer no README do ouro quebra o `SELO.json`, e o teste do selo fica vermelho.
- Pela X7 (RF16), só o Arquiteto altera o ouro, num commit de correção com o `conformidade-reviewer`, e o Implementador nunca o toca. O caminho mais curto para a onda voltar ao verde seria regravar o selo numa tarefa.

Correção exigida: o passo 5 deixa de fora `docs/aia/ouro/` e `docs/aia/ouro-retido/`, como já faz com `tasks/` e `mockups/`. A §7b diz o destino dessas citações: ou uma correção do Arquiteto depois da 4.0, com o selo regravado e o `conformidade-reviewer`, ou ficam desatualizadas de propósito, com o motivo escrito.

**Recomendações**

- **R1.** Trocar a frase "Sem IA no caminho do aluno" da §7b. O rename passa pela camada de IA que o Tutor e o Assistente usam (adaptadores, tarefas, prompts). O correto é "sem mudança de comportamento; prompts, versões de prompt e ações auditadas são strings, e o `conferir` os compara".
- **R2.** Citar na §7b os caminhos de checagem das regras 60 e 70 que mudam: `packages/nucleo/...`, `ia/tarefas/turno-do-tutor.test.ts`, `componentes/ui/ia/avatar-com-funcao-e-selo.test.tsx` e `componentes/MenuDaPessoa.test.tsx`. O RF10 e o teste de caminhos da X7 já cobrem, mas fica explícito.
- **R3.** Na guarda da 11.0 (§10), somar casos de domínio da regra 70 que precisam passar: `CorrecaoService`, `ValidacaoDoLote`, `NotaDoAluno`.
- **R4.** `docs/regulacao.md` e `docs/conformidade-mec.md` não citam caminho nem peça renomeada e não mudam. Vale uma linha na §7b, porque o dossiê de conformidade é entregável (D61).

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/packages/nucleo/src/auditoria/porta-unica.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/web/src/componentes/ui/ia/Mensagem.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/docs/aia/ouro/README.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-10-29 21:38:48 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos**

Esta é uma revisão de spec de um rename sem regra de negócio nova. Por isso os cenários de escola (transferência, virada de ano e os demais) não se aplicam, nem permissão de usuário. O que um teste tem de provar é isto:

- **`aplicar` (1.0):**
  - um símbolo do shared renomeado nos dois projetos, incluindo o comentário, com a string de mesmo nome intacta;
  - um move que corrige o import relativo, o import de pacote e o `vi.mock`;
  - um rename só de caixa;
  - o mapa recusado em cada uma das quatro condições.
- **`conferir` (1.0):** fica vermelho quando muda uma string, some um caso, muda um `JsxText` ou aparece um import fora do mapa. Fica verde com o especificador renomeado e com a exceção declarada.
- **RF3, RF6, RF9 e RF10:** a busca de cada nome antigo, como palavra inteira, dá zero fora da lista do que fica.
- **RF8 (11.0):** cada tipo de declaração que a guarda diz ler é recusado, e os nomes de domínio passam.
- **RF11:** cada trava que lê nome ou caminho por texto ganha um caso com o nome novo que a deixa vermelha, na direção em que ficar para trás seria silencioso.
- **Isolamento (regra 10):** as travas de tenant continuam pegando o que pegavam depois da 3.0 e da 4.0.
- **Concorrência (item 6):** não se aplica, porque nenhuma operação acontece duas vezes ao mesmo tempo.
- **IA (item 5):** não se aplica, porque nenhum teste chama modelo.

**Cobertos**

- O `aplicar` e o `conferir` estão na Tech Spec §10, linha 1, com bons casos. A única falha é a do B5.
- As travas de tenant estão na §6: o `escopo-dos-repositories` para `Database`, o `camadas.cjs`, o `guardioes-por-caminho` com `@Unscoped` e os caminhos do `arquitetura.test.ts`.
- As de log e de IA estão na §7: o `regras-log` e o `PASTA_DOS_ADAPTADORES`.
- Na guarda nova (§10), estão a classe, o arquivo, a pasta e os três casos de domínio que passam.
- A mutação está declarada para a 1.0 e a 11.0, e o "Sem mutação" para as ondas.

**Bloqueantes**

**B1. Tech Spec §6 e §7: faltam travas silenciosas que o próprio inventário lista** (`inventario-core-shared.md:1115`). Em todas elas o nome velho continua verde depois do rename:
- `tools/guardas/regras-erro.mjs:21`, `NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'`, onda 2.0. Depois de virar `InvariantException`, `new InvariantException(\`${nome}\`)` passa, e cai a regra 20.11. Exigido: uma linha na §7 e um caso com `InvariantException` e template com variável dando vermelho.
- `tools/guardas/index.mjs:38`, `ESCOPO_DO_ERRO_TIPADO` com `packages/nucleo/src/**`, onda 4.0. Depois do move, a guarda `erro-tipado` deixa de cobrir o core. Exigido: um caso com `throw new Error('x')` em `packages/core/src/x.ts` dando vermelho.
- `tools/guardas/regras-tenant.mjs:31`, `PACOTE = '@educa/nucleo'`, onda 4.0. A §6 lista essa guarda como "`Banco`, 3.0", mas ela só cita `Banco` em comentário. A trava de verdade é o nome do pacote. Depois do rename, um service que importa tabela de `@educa/core` passa, e cai a regra 10.3. Exigido: corrigir a linha da §6 e um caso com uma tabela importada de `@educa/core` fora de `*.repository.ts` dando vermelho.
- `tools/guardas/escopo-dos-repositories.ts:36` e `:42`. Faltam `TransacaoBanco`, `ExecutorDeAuditoria` (que vira `DatabaseExecutor`), `identidadeDaRequisicao` e `escopoDoJobNoContexto`. Um `TIPOS_DO_BANCO` que ficar para trás é silencioso por método: o teste da linha 75 do `repositories-com-escopo.test.ts` só confere por arquivo. Exigido: um caso para cada tipo novo, num método sem prova, dando vermelho.

**B2. Tech Spec §2 e §5: falta o que fazer com as referências por texto dentro do próprio TypeScript de `apps/`, `packages/` e `e2e/`.**
- O desenho fecha as quatro saídas:
  - o `aplicar` só lista referências fora do TypeScript (§2);
  - ele nunca toca string (§5, passo 2);
  - o `conferir` recusa qualquer string que mude;
  - e ele não fotografa regex.
- Resultado: ou a trava fica com o nome velho e cala, ou é trocada à mão sem caminho declarado.
- Casos reais:
  - `apps/api/test/arquitetura.test.ts:553`, `CHAVES_DOS_MARCADORES = /\bMETADADO_(?:ROTA|ENTRADA)_DE_OPERACAO\b/`. É a C40, que segura as rotas de operação, que escapam da guarda de escola. Não há conferência de que a varredura acha alguma coisa, e por isso fica muda quando `METADADO_*` virar `*_KEY`.
  - `arquitetura.test.ts:260` e `:271`, regex com `@educa\/nucleo` (C45).
  - `packages/nucleo/src/auditoria/porta-unica.test.ts:11-12` e `:31` (regra 20.10).
  - `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts`, que cita `ui/ia/` e `MensagemIA` (regra 70.4a).
- Exigido:
  - o relatório do `aplicar` lista cada `de` (símbolo, caminho e pacote) dentro de string, template e regex de TypeScript;
  - o `conferir` passa a incluir regex na foto;
  - cada troca dessas entra em `excecoesDoConferir`, com a trava e o caso com o nome novo que a deixa vermelha;
  - as linhas correspondentes entram na §6 e na §7.

**B3. O `this.name` das classes de erro está decidido de dois jeitos.**
- `inventario-back.md:559` diz que o `name` "muda junto com a classe". Ele aparece no `tipo` do log, via `resumirErro`, e na pilha que o BullMQ grava no Redis.
- O RF7 e a Tech Spec §5 dizem que nenhuma string muda.
- `packages/shared/src/erros/erro-de-invariante.test.ts:10` afirma `toBe('ErroDeInvariante')`: mudar o nome muda essa asserção, e o RF7 proíbe.
- Exigido: a Tech Spec decide. Ou o `name` fica, e entra como string de fora, liberada na busca do RF3. Ou muda, e cada `this.name` entra em `excecoesDoConferir`, a asserção é admitida por escrito e se confere que nenhum alerta ou painel lê o `tipo`.

**B4. O RF3 não tem prova** (e com ele o RF6, o RF9 e o RF10).
- A §5 diz que a esteira verde na 11.0 "prova que não sobrou nome antigo". Mas a guarda só lê prefixos e sufixos em declarações.
- Ficam fora dela `resumirErro`, `exigirEscolaDoContexto`, `Banco`, `chamarApi`, `consulta…`, `Tela`, o `com` e os caminhos citados nos documentos.
- Exigido: um comando de restos, que busca cada `de` de todos os mapas como palavra inteira, no código e nos documentos vivos. Roda no fim de cada onda e na 12.0, e entra na §10 com os seus testes:
  - nome velho no código: vermelho;
  - no texto de `describe`: verde;
  - na lista "Não muda, mas parece": verde;
  - em `docs/decisoes.md`: verde.

**B5. A foto do `conferir` (§5) tem dois furos no "diff só de nome".**
- **O especificador.** A §5 diz que o especificador de módulo "não entra", e a §10 quer vermelho com "um import fora do mapa": um contradiz o outro. Um `vi.mock` com caminho velho deixa de mockar sem avisar. Exigido: o especificador entra comparado depois de aplicado o mapa.
- **A chave de objeto.** A chave de um literal de objeto não é string, e a foto não a vê. Um símbolo renomeado usado em forma curta (`{ esquemaTurma }`) muda a chave em tempo de execução, e isso pode mudar o DTO de saída (§7: "as chaves do schema não mudam"). Exigido: os nomes de propriedade dos literais e os nomes exportados entram na foto. Na §10, entram dois casos: o `aplicar` mantém a chave na forma curta, e o `conferir` fica vermelho com uma chave mudada.

**B6. A guarda da 11.0 diz ler mais do que a §10 testa.**
- A §5 diz que ela lê classe, interface, tipo, enum, função, variável exportada e decorator, mais os nomes do kit.
- A §10 só testa a classe, o arquivo e a pasta.
- Exigido: um caso para cada tipo de declaração, um para nome do kit (`Botao`) e um para `Erro…` contra uma recusa de domínio. Também falta citar o teste que prova que "não se desliga por comentário".

**Recomendações**

- **Migration (RF7):** pôr na §10, para a 4.0, que o gerador do drizzle não produz migration nova e que o `_journal` não muda. Escrever também que a base está verde antes da 1.0.
[… 20 linhas cortadas]

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-29 21:38:56 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §2 × §5 passo 5 (a Tech Spec se contradiz), §5 (a guarda contra o inventário §2.26 e o §3), §7c (contra o `inventario-back.md`), §5 × §13 (a reaplicação depois do merge)
Portão local: não se aplica. É revisão de spec e ainda não há árvore de código para carimbar.

Bloqueantes:

1. **A troca por palavra inteira em comentário e documento estraga a prosa (§1, §5 passos 2 e 5, §2).**
   - **Contradição.** A §2 diz que o `aplicar` só lista as ocorrências em `.md` e não troca sozinho. O §5 passo 5 diz que ele troca o nome de símbolo nos documentos vivos nas ondas em fila.
   - **O que acontece se trocar.** O mapa traz nomes que também são palavras comuns, e eles iriam parar no meio do texto:
     - `com` → `forRoot` (inventário §2.2). Há 1.033 linhas de comentário com "com" só em `apps/api/src`.
     - `Banco` → `Database`. Pega o termo do glossário "Banco público" (`docs/glossario.md:128`), as linhas D21 e D26 do `CLAUDE.md` e comentários como "Banco fora:" (`apps/despachante/src/despachante.ts:204`).
     - `Despachante`. Os comentários que falam do app, que fica com esse nome, viram `OutboxRelay` (`apps/despachante/test/janela.int.test.ts:10`).
     - `Contador` → `CountBadge`. Pega `apps/api/src/operacao/entrada/entrada.service.ts:50`, `apps/worker/src/processadores/consolidar-uso.ts:171` e `docs/lgpd.md:68`, e o PRD §8 diz que o `docs/lgpd.md` não muda.
     - `Tela` → `Page`. Pega a regra 50 (linhas 21 e 49) e o termo do glossário "Tela de foco".
   - **Quem avisou.** O próprio `inventario-core-shared.md` (linha 5) diz que o rename "deve ser feito por símbolo, não por busca textual".
   - **Nada pega o erro.** O `conferir` não olha comentário nem `.md`.
   - **Correção exigida:**
     - Resolver a contradição entre a §2 e o §5 passo 5.
     - O `aplicar` troca sozinho, em comentário e documento, só o identificador composto que não é palavra comum, marcado no mapa. Os nomes comuns (`com`, `Banco`, `Tela`, `Contador`, `Despachante`, `Processador`, `Agendamento`, `migrar`, `Fila`) vão para a lista de troca à mão.
     - A §10 ganha o caso: comentário com "com" como preposição e "Banco público" num `.md` ficam intactos.

2. **A gramática da guarda reprova o que o inventário mandou ficar (§5 "A guarda", §10).**
   - **Prefixos do kit.** A guarda soma `Botao`, `Cartao`, `Dialogo` e `Tabela` aos prefixos do inventário §1 (`Linha`, `Filtro`, `Erro`, `Opcoes`, `Configuracao`). Isso reprova nomes de tela que ficam, pelo inventário §2.26 e pelo PRD §3, e que não estão em nenhum anexo:
     - `DialogoDeAlocacao` (`areas/coordenacao/estrutura/Alocacao.tsx:53`)
     - `CartaoDoAgente`, `TabelaDoUso`, `LinhaDoMaterial`, `FiltroDeEstado`
     - `ErroDaOperacao`, `ErroDaLinhaDaLista`, `BotaoDeFechar`, `CartaoDoIncidente`
   - **"Repositório inteiro".** A frase pega também o `tools/`, que o PRD §3 deixa em português: `GuardaDaEsteira` (`tools/ci/etapas-de-guarda.ts:93`), `ConfiguracaoLida`, `DependenciasDaMedida`, `LinhaNova`, `Opcoes`.
   - **Consequência.** O critério do RF8 ("o código de hoje, depois do rename: verde") só se cumpre renomeando fora do inventário, e isso viola o RF2.
   - **Pergunta não respondida.** A pergunta 2 do PRD ("onde fica a lista de prefixos") continua aberta. Não está dito se a regra lê o `inventario.md` ou se copia a lista para o código.
   - **Correção exigida:**
     - Declarar o escopo em globs (`apps/`, `packages/`, `e2e/`).
     - Pôr a lista no código, com o lugar dela.
     - Separar nome exato do kit de prefixo.
     - Tratar os nomes acima por adenda aprovada pelo Joaquim ou por exceção declarada.
     - A §10 ganha o caso: `DialogoDoConvite` e `CartaoDoAgente` passam.

3. **Nada prende o diff real de cada linha aos "Arquivos previstos" (§5, as duas linhas).**
   - O `linhas.ts` (`porQueNaoJuntas`) compara só os caminhos declarados. Nada compara o diff de verdade.
   - O `aplicar` carrega todos os projetos e troca comentários em todo o repositório. Exemplo: o `Contador` da 8.0, que é da linha web, cai em `apps/api` e `apps/worker`, que são da linha back.
   - **Correção exigida:** o `aplicar` recebe o escopo de caminhos da tarefa e recusa, ou reporta como divergência, qualquer edição fora dele. A §10 ganha um teste disso.

4. **O compose de produção muda, ao contrário do que dizem a §7c e o RF4 do PRD.**
   - O anexo aprovado renomeia `apps/api/src/ops/migrar.ts` para `migrate.ts` (`inventario-back.md:402` e `:562`, onde ele mesmo diz que o caminho do `.js` muda).
   - `infra/compose.yml:123` (`command: [node, dist/ops/migrar.js]`) muda junto, então o `docker compose config` de produção não sai igual. O script `ops:sessao-sintetica` e o runbook também mudam.
   - **Correção exigida:** ou manter `migrar.ts` por adenda, ou a §7c declara a onda que faz a mudança, a única diferença esperada no `config` e a atualização do runbook. Em qualquer caso, reconciliar o texto do RF4.

5. **O `name` das classes de erro não está decidido, e os documentos se contradizem (§5 `conferir`, §7).**
   - O `inventario-back.md:559` diz que `this.name` "muda junto com a classe". A Tech Spec diz que o `aplicar` nunca toca string e que qualquer diferença deixa o `conferir` vermelho.
   - No core há `this.name = 'ErroDeDominio'` (`packages/nucleo/src/erro/erro-de-dominio.ts:68`) e mais oito iguais. Esse valor vai para o campo `tipo` do log (`packages/nucleo/src/erro/resumir-erro.ts:63`).
   - **Consequência.** Ou o `conferir` fica vermelho em cada uma dessas classes, ou a busca do RF3 acha o nome antigo.
   - **Correção exigida:** decidir na §5 (de preferência uma regra de grupo em `excecoesDoConferir`), e a §7 declarar que o valor de `tipo` no log muda. Conferi que nenhum alerta em `infra/` nem o runbook leem esse campo.

6. **A reaplicação depois do merge não funciona como descrita (§13 contra §5).**
   - O `aplicar` recusa o mapa inteiro quando o `de` não existe no arquivo declarado. Depois da onda, o `de` não existe mais, então reaplicar os mapas sobre o que entrou da `develop` é recusado.
   - Também não está dito quem revisa o código que o Orquestrador troca fora de uma tarefa.
   - **Correção exigida:** um modo próprio de reaplicação, que só pega as ocorrências novas, com recusa definida e teste na §10. Ou declarar que esse merge vira uma correção, com revisão.

7. **O PRD passa do teto de tamanho.** Tem 2.007 palavras e nenhum aceite escrito no topo, e o `revisar-spec` §1 trata isso como achado bloqueante. **Correção exigida:** cortar o PRD ou registrar o aceite.

Recomendações:
- §5: o `git checkout .` não desfaz o `git mv`, que já entra no índice. Trocar por um comando que restaure o índice e a árvore.
- D81: escrever em uma linha por que a ferramenta não usa o ts-morph (o motivo cabível é ter um projeto por `tsconfig`). Escrever também por que a guarda não usa o `@typescript-eslint/naming-convention`, que a pergunta 2 do PRD cita (a mensagem com o nome de mercado e a leitura de arquivo e pasta). O motivo de hoje, "não se desliga por comentário", só vale se a regra entrar em `REGRAS_DAS_GUARDAS` (`tools/guardas/index.mjs`, a segunda passada com `allowInlineConfig: false`). Dizer isso na §5.
- O mapa não tem campo para o alias registrado de propósito (caso de borda do PRD). A checagem de colisão precisa olhar o escopo de cada arquivo que importa o nome.
- O critério do RF7 ("o gerador de migration não produz migration nova") não aparece na §10. Rodar o gerador na 3.0 e na 4.0.
- Dizer onde fica o relatório do `aplicar`: um arquivo por onda, para as duas linhas não gravarem no mesmo.
- A pasta `fila/` recusada para sempre pela guarda impede uma pasta de domínio no futuro: o anexo web trata "Fila" como domínio.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario-back.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/processo/linhas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/compose.yml
