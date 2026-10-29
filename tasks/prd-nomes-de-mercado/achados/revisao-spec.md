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

## llm-integrator · 2ª rodada · APROVADO · 2026-10-29 22:19:34 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: APROVADO

Perfis usados: não se aplica. A X8 não adiciona nem altera chamada de modelo, e o perfil de cada tarefa continua o mesmo.
Custo estimado por professor/mês: R$ 0 adicional. Nenhuma chamada nova e nenhuma mudança de perfil, de prompt ou de orçamento.
Prompt versionado: sim, sem mudança. Os prompts são `.ts` em `ia/prompts/` e as constantes `PROMPT_*` ficam (inventário §2).
Validação de schema: sim, sem mudança. Só o nome dos schemas muda, e o `conferir` compara as strings.
Aprovação humana no caminho: não se aplica. O rename não altera o fluxo de entrega pendente nem de aprovação.

Bloqueantes: nenhum.

O bloqueante da rodada 1 foi resolvido:

- `adaptador.ts` agora vira `adapter.ts` (adenda 1 do `inventario.md` e `inventario-core-shared.md`), que não casa com `*-adapter.ts`.
- `AdaptadorDeIa` agora vira `LLMAdapterKind`.
- A Tech Spec §7 e a linha "Regra 30" de `travas.md` fixam `PASTA_DOS_ADAPTADORES = packages/core/src/ia/*-adapter.ts`.
- A prova vermelha pede a interface `adapter.ts` e o `llm-gateway.ts` importando o SDK, com os três adaptadores passando.
- `fake-adapter.ts`, `openai-compat-adapter.ts` e `resilient-adapter.ts` casam o glob. `scripted-adapter.ts`, em `__fixtures__/`, não casa, como hoje.
- A trava `tools/processo/harness/caminhos.test.ts` mantém a guarda, a regra 30 e o `llm-integrator.md` citando a mesma pasta.

Conferi também que `tools/processo/guardioes-por-caminho.ts` não aciona o `llm-integrator` por caminho. Nenhuma exigência de guardião some em silêncio no rename. O corpus `ouro` fica fora das ondas e vai por correção do Arquiteto com o selo regravado, o que respeita a regra 30 e a X7.

Recomendações (nenhuma bloqueia):

1. **`travas.md`, linha "Regra 30", frase "Os arquivos isentos são os mesmos de hoje".** Não é exata.
   - Hoje `adaptador-*.ts` isenta também `adaptador-openai-compat.test.ts` e `adaptador-resiliente.test.ts`. O glob `*-adapter.ts` não isenta `*-adapter.test.ts`.
   - É um aperto, não um afrouxamento, e nenhum dos dois testes importa SDK. Convém dizê-lo.
   - Acrescente à linha as três citações em `tools/guardas/guardas.test.ts` (242, 322 e o `toEqual` das exceções, 651) e o cabeçalho de `tools/guardas/__fixtures__/sdk-de-ia.ts`.
2. **Escopo do passo 6 (Tech Spec §5) e do `restos`.** Cobrem `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`. Ficam de fora os arquivos da raiz e `.github/`, que o inventário §4 e a §2 da Tech Spec já tratam como acompanhantes.
   - O caso concreto é `knip.json`, que tem a chave de workspace `"packages/nucleo"`. Se o caminho mudar e a chave não, o knip deixa de configurar o pacote sem acusar erro.
   - O `vitest.config.ts` e o `package.json` da raiz também citam `packages/nucleo` e `@educa/nucleo`. Os scripts `-w` quebram alto, mas entram pelo mesmo vazio de escopo.
   - Inclua os arquivos da raiz e `.github/` no passo 6 e no `restos`, ou liste o `knip.json` em "Processo e configuração" de `travas.md`.
3. **Travas de `tools/ci/` fora de `travas.md`.** `dockerfile.test.ts:118` usa `not.toContain('@educa/nucleo')`, que fica verde sem checar nada depois do rename. Outras da mesma pasta:
   - `dockerfile.test.ts:111` (`COPY packages/nucleo/drizzle ...`).
   - `borda.test.ts:78` e `:95`.
   - `resolucao-do-shared.test.ts:23`.
   - `caminhos-da-esteira.ts:7`.

   O passo 6 as pega, porque `tools/` está no escopo, mas só como `trava` ou `fica` "com motivo". Liste ao menos `dockerfile.test.ts:118` no anexo.
4. **Inconsistência entre §5 e `travas.md`.** A Tech Spec §5 diz que `trava` leva "a linha do `travas.md`". O anexo diz que a ocorrência achada e não listada entra no mapa "com o motivo". Escolha uma das duas, por exemplo "linha do `travas.md` ou motivo escrito no mapa, com a prova vermelha".
5. **Custo de IA.** Fica registrado como zero adicional. Nenhuma chamada nova de modelo nasce nesta spec.

Arquivos lidos:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario-core-shared.md`

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-10-29 22:20:03 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

```
VEREDITO: REPROVADO
Tabelas verificadas: nenhuma nova nem alterada (Tech Spec §3 e §4; o `db:gerar` roda na 4.0 e na 5.0 sem gerar migration, §7c). As tabelas Drizzle e o `schema`/`Schema` ficam (inventario-core-shared.md §1129), então `TABELAS_DO_NUCLEO` e `NOMES_QUE_LEVAM_TABELA` continuam valendo.
Queries verificadas: nenhuma muda (§6). Conferi as travas de escopo contra o código de hoje: tools/guardas/escopo-dos-repositories.ts (TIPOS_DO_BANCO, PROVAS_DE_ESCOPO, o export `SemEscopo` na linha 272, REPOSITORIES_SEM_ESCOPO), regras-tenant.mjs (PACOTE), index.mjs (packages/nucleo/src/db/**), camadas.cjs (as três cercas de tenant), guardioes-por-caminho.ts (SEM_ESCOPO) e apps/api/test/arquitetura.test.ts (ZONAS_DAS_CLASSES_CERCADAS e justificativaSemEscopo).
Teste de isolamento: presente e efetivo. O `conferir` prova que nenhum caso entra ou sai (§5, §6). As provas de travas.md da Regra 10 quebram se a cláusula for esquecida, com uma exceção (o bloqueante abaixo).
```

**Os dois bloqueantes da rodada 1 estão resolvidos no desenho:**
- **B1:** travas.md, Regra 10, linhas de `regras-tenant.mjs` e de `index.mjs`, onda 5.0. O par de casos tem o import de `@educa/core` vermelho num service e o mesmo import passando em `packages/core/src/db/`.
- **B2:** travas.md, Regra 10, linha de `escopo-dos-repositories.ts`, onda 4.0. Cada tipo novo tem a sua fixture vermelha. Sobrar nome antigo em `PROVAS_DE_ESCOPO` ou em `SemEscopo` quebra os repositories reais e dá vermelho, não silêncio. Nenhum nome antigo sobra na guarda nem nas fixtures.

**Bloqueantes:**

1. **A cerca `cerca-resolucao-de-tenant` desliga calada na 6.0, e nenhuma linha do anexo a cobre (regra 10, item 9).**
   - **Onde:** travas.md, Regra 10, linha 21 (`camadas.cjs`), e Tech Spec §5, passo 6.
   - **O que está errado:**
     - Em `camadas.cjs`, o `to.path` da cerca é `^apps/api/src/sessao/tenant/resolucao-de-tenant\.repository\.ts$`. O arquivo vira `tenant-resolution.repository.ts` na 6.0 (inventario-back.md linha 103). Com o regex antigo, o depcruise não casa nada e fica verde. Qualquer código passa a importar o repository que concentra os `@SemEscopo` da resolução de tenant.
     - A linha 21 do anexo é da onda 5.0 e enumera quatro regras. Esta não está entre elas.
     - O mesmo nome está em `arquitetura.test.ts`, `ZONAS_DAS_CLASSES_CERCADAS`, linha 49. Lá, o regex `/\bResolucaoDeTenantRepository\b|resolucao-de-tenant\.repository/` lê a classe (renomeada na 7.0) e o arquivo (6.0). Essa linha também não está no anexo, que cita só a 50.
     - A rede de segurança não as pega. O passo 6 procura o `de` "como palavra inteira". Em `\bResolucaoDeTenantRepository\b`, o caractere antes do nome é o `b` do `\b`, então não há borda de palavra e a busca não acha. Em `resolucao-de-tenant\.repository` e `\\.ts`, o ponto escapado não casa com o `de` literal. Pelo mesmo motivo, `@educa\/nucleo` só está coberto porque foi listado à mão.
     - A trava contra filtro vazio cita `camadas.cjs`, mas o caso dela no §10 é "um glob que não casa nada". Ela não prova o `path` em regex do depcruise.
   - **Correção exigida:**
     - (a) Nova linha em travas.md, Regra 10, onda 6.0, para `camadas.cjs` › `cerca-resolucao-de-tenant`. Prova: import de `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` vindo de fora de `sessao/`, vermelho.
     - (b) Nova linha para `arquitetura.test.ts` › `ZONAS_DAS_CLASSES_CERCADAS` (linha 49), ondas 6.0 e 7.0. Prova: `import { TenantResolutionRepository }` numa ponte usada de `tools/`, vermelho, e a varredura achando a classe dentro da zona.
     - (c) No §5, passo 6, dizer que a busca em literal de regex e em `String.raw` é feita sobre a forma sem escape, ou com o `de` escapado e sem exigir borda depois de `\b`. Levar ao §10 um caso de `aplicar` com `/\bX\b/` e com `x\.repository`, ambos listados.
     - (d) No §10, um caso de filtro vazio com um `path` em regex de `camadas.cjs` que não casa nenhum arquivo, vermelho.

**Recomendações:**
- travas.md linha 18: `REPOSITORIES_SEM_ESCOPO` tem seis entradas em `packages/nucleo/src/` e o método `inserirAuditoria`, não só `job-registro.repository.ts`. A falha seria ruidosa (`lista-arquivo-inexistente` e `lista-metodo-inexistente`), mas a linha deve dizer "as seis entradas do core e os métodos renomeados".
- travas.md linha 21: incluir `nucleo-nao-importa-app` na enumeração das regras de `camadas.cjs` que citam o core.
- `tools/guardas/tabelas-do-nucleo.test.ts` importa o pacote pela string `'@educa/nucleo'` dentro de uma variável. Hoje ele quebra ruidoso, mas vale uma linha no anexo, onda 5.0, para não depender do `node_modules` local desatualizado depois de `npm install --package-lock-only`.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/api/test/arquitetura.test.ts

## infra-guardian · 2ª rodada · REPROVADO · 2026-10-29 22:20:09 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | IA | migration | deploy (só no nome)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida (nenhuma condição nova)
Índice e paginação: ok (nenhuma query muda)
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok

**Os dois bloqueantes da rodada 1**
- **B2 está resolvido.** A adenda 1 mantém `ops/migrar.ts` e `ops/sessao-sintetica.ts` com o nome. A §7c prova que o `docker compose config` de produção sai igual, e o rollback de imagem com o compose atual continua subindo o `migrar`.
- **B1 está resolvido em parte.** O passo 6 do `aplicar` agora lê `infra/`. Na linha "Regra 80" do `travas.md`, o `typeof import(<fonte>)` deixa o `tsc -p infra/tsconfig.json` (que já roda no `typecheck`) vermelho quando uma chave fica para trás. Falta o caminho do `dist`: a mesma linha diz que ele é "conferido à mão", e isso não é prova. O caminho do `dist` só fica coberto com a correção abaixo.

Bloqueantes:

1. **Tech Spec §5 (passo 6 do `aplicar` e o `restos`), §2 e `travas.md` "Regra 80" e "Processo e configuração": os arquivos da raiz que citam nome por texto ficam fora da busca, e não há trava para eles.**
   - **O que falta na busca.** O passo 6 lista ocorrências só em `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`. O `restos` diz "no código" sem definir o que é código. Por isso ficam fora:
     - o `package.json` da raiz, com `-w @educa/nucleo` em cerca de 20 scripts (`build`, todos os `ops:*`, `carga:login`, `carga:sala`, `ensaio:alertas`) e `db:gerar --config packages/nucleo/drizzle.config.ts`;
     - o `knip.json` (`"packages/nucleo"`);
     - o `vitest.config.ts`.
   - **Por que a esteira não pega.** Ela não roda `npm run build` da raiz (`tools/ci/verificar.ts` roda typecheck, lint e testes), e nenhum teste invoca os scripts `ops:*` pelo `npm`.
   - **O que acontece às 10h.** Um `-w @educa/nucleo` esquecido só aparece quando alguém roda o comando. `ops:revogar-acessos-sala` e `ops:incidente` são as ferramentas de incidente do runbook, então a falha aparece no meio de um incidente em horário de aula. O mesmo vale para `carga:login` e `ensaio:alertas`.
   - **O mesmo furo no `dist`.** Se o `restos` comparar o `de` de arquivo com a extensão (`hash-de-senha.ts`, `sessoes-sinteticas.ts`), ele não pega `apps/api/dist/credencial/hash-de-senha.js` nem `apps/api/dist/sessao/tenant/sessoes-sinteticas.js` em `infra/scripts/`. É por isso que sobrou a "conferência à mão".
   - **Correção exigida:**
     - (a) A §5 define o escopo do passo 6 e do `restos` de forma explícita: `apps/`, `packages/`, `e2e/`, `tools/`, `infra/`, `.github/` e os arquivos da raiz (`package.json`, `knip.json`, `vitest.config.ts`, `tsconfig*.json`, `eslint.config.mjs`).
     - (b) O `restos` compara o `de` de arquivo e de pasta também pelo segmento sem extensão (`nucleo`, `hash-de-senha`, `sessoes-sinteticas`).
     - (c) O `travas.md` ganha uma linha, na onda 5.0, para o `package.json` da raiz (`-w @educa/nucleo` e o `--config` do `db:gerar`). A prova é o `restos` zero na raiz mais a execução de `npm run build` e de `npm run db:gerar`.
     - (d) A linha dos três scripts de `infra/scripts/` troca "conferido à mão" por "o `restos` dá zero em `infra/scripts/`", como já está na linha do `medir-risco-a-vida.ts`.
     - Na §10, o caso do `restos` ganha um `.js` de `dist` com o nome antigo dentro de `infra/`, que tem de dar vermelho.

Recomendações:
- **`paths:` das regras.** Na linha `.claude/rules/*.md`, `paths:` do `travas.md` "Regra 80", a prova citada é o `base-fixa.test.ts` da X7. Ele só confere que existe um `paths:` com ao menos um item, e não que cada glob casa com algum arquivo: com `packages/nucleo/**` esquecido, ele fica verde. O `restos` sobre documento vivo pega o caso. Cite o `restos` como prova, ou ponha os `paths:` das regras na lista da trava contra filtro vazio (§5).
- **Teste barato para o `importarDaApi`.** Um teste em `infra/test/` que, para cada caminho de `dist` usado pelo `importarDaApi`, confere que o arquivo-fonte correspondente em `src/` existe. Isso dá prova executável sem precisar construir o `dist`.
- **Âncora do runbook.** Ao fechar a X8, ninguém tem de entrar com a palavra comum `migrar` na troca à mão do passo 5 nas seções do runbook que citam `dist/ops/migrar.js`. O arquivo fica com o nome, então a âncora e o comando continuam valendo.

Os arquivos que conferi:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/package.json` (linhas 13 e 31 a 49)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/knip.json` (linha 81)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/ci/verificar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/processo/harness/base-fixa.test.ts` (linhas 55 a 58)

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-29 22:20:10 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum muda. Esta spec é um rename. A coluna `lancada_por`, as rotas e os métodos `aprovar`/`aprovarLote` ficam (§3 e 4, inventário §3). Os testes que provam por varredura quem chama `aprovar`, `aprovarLote` e `decidir` estão em `travas.md`, "Regra 70", linhas 49 e 50. Todos com autor humano? sim.
Decisão autônoma sobre aluno: ausente. Nenhuma lógica muda, e o `conferir` (§5) prova que strings, regex, chaves e casos de teste continuam iguais.
Aprovação registrada: ok. A varredura de `entrega.int.test.ts` passa a `packages/core/src` (`travas.md`:49). A porta única da auditoria também está coberta (`travas.md`:36).
Supervisão do tutor: ok. Prompt e política são strings em `.ts`, então caem no `conferir`. Não há prompt em `.md` dentro de `packages/` ou `apps/`; só os dois README, que o RF9 cobre.
Autonomia declarada e visível: sim. Os textos de `governanca` são strings comparadas pelo `conferir`.

**Os dois bloqueantes da rodada 1:**
- **B1 (trava da regra 70 que lê nome ou caminho em string ou regex, sem caminho de troca): resolvido.** O passo 6 da §5 lista toda ocorrência por texto em `.ts`, `.mjs`, JSON e YAML. Cada uma é classificada como `fica` ou `trava`, e o relatório fica vermelho se sobrar alguma sem classificação. A troca de propósito entra em `excecoesDoConferir`. O `travas.md`, "Regra 70" (linhas 49 a 53), mais a linha 36 em "Regra 20", dá a cada trava a onda e a prova vermelha com o nome novo: `porta-unica`, `Mensagem.test.tsx` (D58), `avatar-so-nas-duas-pecas`, `entrega`, `correcao` e `assistente`. Conferi no código. As asserções que ficariam verdes em silêncio com o nome velho são duas, e as duas estão listadas: `not.toMatch(/from '\.\/AvatarAgente'/)` e `startsWith('galeria/')`. O resto falha alto, porque `toEqual` contra uma lista velha ou `readFileSync` de um arquivo que não existe mais deixam o teste vermelho.
- **B2 (o ouro): resolvido.** O passo 5 da §5 exclui `docs/aia/ouro/` e `docs/aia/ouro-retido/`. O `travas.md`:55-58 manda as citações para uma correção do Arquiteto depois da 5.0, com o selo regravado e o `conformidade-reviewer`. Duas coisas confirmam que nenhuma onda fica vermelha entre a 5.0 e essa correção:
  - O `tools/processo/harness/caminhos.test.ts` só confere `.claude/agents`, `.claude/rules` e `tools/guardas`, e não lê o README do ouro.
  - O `raizDoOuro` (`'../../../../../docs/aia/ouro'`) mantém a profundidade depois do move.

**Lacuna nova com veto:** nenhuma.

Bloqueantes: nenhum.

Recomendações:
1. **`travas.md`:36 (`porta-unica.test.ts`) tem linhas erradas.** A tabela cita as linhas "11, 12 e 31". A 31 não tem caminho. O que lê caminho ou nome são:
   - as linhas 11, 12 e 38 (`LEITURA`);
   - a regex `IMPORTA_O_MODULO_DE_INSERCAO`, na linha 50, que procura `insercao-de-auditoria` (o arquivo vira `auditoria-insert.repository.ts`);
   - os textos de teste das linhas 104 a 117, que mudam junto com a regex.

   Com a regex velha, o teste da linha 73 fica vermelho, então não há silêncio. Mesmo assim a linha do anexo deve ser exata.
2. **§5, passo 6: dizer quais "trechos de caminho" entram na busca.** A entrada de arquivo deve gerar também o nome sem extensão (`insercao-de-auditoria`, `Mensagem`) e cada segmento da pasta. Sem isso, a regex do item 1 não seria achada pelo nome completo do arquivo.
3. **`travas.md`:50: trocar `apps/api/src/.../correcao.int.test.ts` pelo caminho real,** `apps/api/src/atividade/correcao/correcao.int.test.ts`. Os nomes esperados (`correcao/correcao.service.ts`, `correcao/lote.controller.ts`) são de domínio e provavelmente não mudam. Nesse caso a linha vira `fica`.
4. **O ouro precisa de um ponto de fechamento.** Hoje o `restos` libera para sempre o que o passo 5 deixa fora, então nada acusa se a correção do Arquiteto não acontecer. Proposta: na 13.0, ou no pouso, o `restos` roda sem a isenção do ouro e dá zero.
5. **`travas.md`:23 (`guardioes-por-caminho.ts`): provar os três guardiões.** A prova de `components/ui/ai/` deve conferir `privacy-guardian`, `conformidade-reviewer` e `infra-guardian`, e não só o `conformidade-reviewer`. Se só a exceção `componentes/ui/` for atualizada, a pasta de IA cai nela e perde o `privacy-guardian`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/packages/nucleo/src/auditoria/porta-unica.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/processo/guardioes-por-caminho.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-10-29 22:20:49 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** são os mesmos da rodada 1.
- **`aplicar`:** um símbolo do shared renomeado nos dois projetos, com o comentário; a string de mesmo nome intacta; o move com o import relativo, o import de pacote e o `vi.mock`; o rename só de caixa; cada recusa do mapa.
- **`conferir`:** vermelho com uma string, uma regex, um `JsxText`, uma chave de objeto, um nome exportado ou uma parte fixa de template mudados, com um caso a menos e com um especificador fora do mapa.
- **`restos`:** prova o RF3, o RF6, o RF9 e o RF10.
- **A guarda:** cada tipo de declaração e cada restrição da gramática.
- **RF11:** cada trava com o caso com o nome novo que a deixa vermelha.
- **Isolamento:** as travas de tenant seguem pegando o que pegavam.
- **Não se aplicam:** concorrência (nada roda duas vezes ao mesmo tempo) e IA (nenhum teste chama modelo).

**Cobertos (a rodada 1, item a item):**
- **B1, resolvido.**
  - `NOME_DA_CLASSE_DE_INVARIANTE`: travas.md, "Regra 20", linha 1.
  - `ESCOPO_DO_ERRO_TIPADO`: "Regra 20", linha 2.
  - `PACOTE` de `regras-tenant.mjs`, com o par vermelho e verde: "Regra 10", linha 3.
  - `TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO` e `SemEscopo` completos: "Regra 10", linha 1.
- **B2, resolvido:**
  - §5, passo 6: lista cada `de` em string, template, regex, JSON, YAML, `.mjs` e `.cjs`, e a ocorrência sem classificação deixa o relatório vermelho;
  - a foto do `conferir` inclui regex;
  - `CHAVES_DOS_MARCADORES`, `porta-unica`, `Mensagem.test.tsx` e `avatar-so-nas-duas-pecas` estão em travas.md.
- **B3, resolvido.** O `this.name` acompanha a classe (adenda 1, §7, `excecoesDoConferir`). A asserção de `erro.int.test.ts:166` (`not.toContain('ErroDeInvariante')`), que calaria com o nome velho, está em travas.md, "Regra 20", linha 4.
- **B4, só em parte:** o `restos` existe (§5, §10), mas não dá para ficar verde. Ver o bloqueante 2.
- **B5, resolvido:**
  - o especificador é comparado depois do mapa;
  - a chave de objeto entra na foto;
  - a forma curta com a chave mantida tem caso no `aplicar`;
  - a chave mudada tem caso no `conferir`.
- **B6, só em parte:**
  - entraram um caso por tipo de declaração, `Botao` exato, `eslint-disable` e `tools/` fora;
  - faltam o caso de `Erro…` contra uma recusa de domínio e o caso da mensagem. Ver o bloqueante 3.
- **Recomendações da rodada 1 que entraram:**
  - o `db:gerar` sem migration e o `_journal` igual (§7c);
  - a base verde antes da 1.0;
  - a régua de duração do e2e (§13);
  - o `paths:` das regras;
  - o `typeof import` dos scripts de infra (§11);
  - a trava contra filtro vazio.

**Bloqueantes:**

1. **A forma da prova vermelha das travas está indefinida e se contradiz** (§10, "Mutação"; travas.md, todas as colunas "Prova vermelha").
   - **O que está errado:**
     - A §10 diz que as ondas levam "Sem mutação: rename, sem condição nova". Mas travas.md, "Regra 20", linha 4 (ondas 3.0 e 4.0), declara uma prova por "Mutação".
     - Trocar a constante que a trava compara (`TIPOS_DO_BANCO`, `PACOTE`, `NOME_DA_CLASSE_DE_INVARIANTE`, os globs) é mudar a condição dela. Não é "sem condição nova".
     - Quando a prova é um "caso" novo ("uma fixture por tipo novo", "`import { escola } from '@educa/core'` em `x.service.ts`: vermelho", `throw new Error` em `packages/core/src/x.ts`), ela bate de frente com o RF7 ("nenhum caso de teste entra ou sai"). Bate também com o `conferir`, que fotografa os casos de `tools/guardas/` e `tools/processo/` e fica vermelho com qualquer diferença.
     - Do jeito que está, cada prova vira um conserto improvisado na hora, e as que são conferência de uma vez só não ficam como teste.
   - **Correção exigida:**
     - Pôr em travas.md uma coluna "Forma": bloco `mutacao` da onda, que volta a constante da trava ao nome antigo (ou desliga a cláusula), sobre um caso que já existe e foi renomeado.
     - Exemplo: os fixtures `sem-prova` (`Banco`), `banco-por-parametro` e `funcao-exportada` (`TransacaoBanco`) e `executor-de-auditoria` (`ExecutorDeAuditoria`) já reprovam hoje. Renomeados, eles provam o tipo novo, e a mutação "`TIPOS_DO_BANCO` com `'Banco'`" tem de deixá-los vermelhos. Não precisa de fixture nova.
     - A §10 passa a dizer que toda onda com trava leva os blocos de mutação dela.
     - Onde nenhum caso existente chega à trava, a linha diz isso. O caso novo precisa então de exceção declarada no `conferir` e no RF7, e isso é parada do Joaquim.

2. **O `restos` não fica verde com palavra comum** (§5, "O `restos`"; §10, linha `restos`).
   - **O que está errado:**
     - Ele busca cada `de` "como palavra inteira, no código e nos documentos vivos", e libera só o `fica`, o texto dos casos e o que o passo 5 deixa fora.
     - Vários `de` são palavras comuns: `Banco` (→ `Database`), `Fila` (→ `QueueName`), `Tela` (→ `Page`), `Despachante` (→ `OutboxRelay`).
     - Exemplos que ficam vermelhos para sempre: o `CLAUDE.md` traz "D49 | Fila de jobs…", e os documentos trazem "Banco público de questões".
     - O passo 5 manda a palavra comum para a troca à mão, e o `restos` não tem a regra equivalente.
   - **Correção exigida:**
     - O `restos` aplica a mesma regra do passo 5. Em comentário e documento, conta só o identificador composto, o que está entre crases, o `{@link}` e o caminho. A palavra comum conta só como identificador no código (pela AST) e entre crases.
     - Na §10, entram três casos:
       - "Fila de jobs" em prosa no `CLAUDE.md`: verde;
       - `` `Fila` `` entre crases num documento: vermelho;
       - `Banco` como tipo no código: vermelho.

3. **A gramática da guarda não tem teste para a restrição por tipo, nem para a mensagem** (§5, "A gramática"; §10, linha "Guarda (12.0)").
   - **O que está errado:**
     - A §5 diz que `Linha…` e `Opcoes…` só valem em interface e tipo, e que `Erro…`, `Filtro…`, `Guarda…`, `Adaptador…` e `…EmMemoria` só valem em classe. Diz também que `ErroDaOperacao` e `LinhaDoMaterial` passam.
     - A §10 só lista casos que passam por nome exato (`DialogoDeAlocacao`, `CartaoDoAgente`) e por domínio.
     - Uma mutação que ignore o tipo de declaração sobrevive. Seguem faltando também o caso de `Erro…` contra uma recusa de domínio, que exigi na rodada 1, e a asserção do RF8, "com a sugestão na mensagem".
   - **Correção exigida:** pôr na §10:
     - `class ErroX` recusada, e `ErroDaOperacao` no tipo de declaração real dela: passa;
     - `interface LinhaX` recusada, e `LinhaDoMaterial` passa;
     - `RenovacaoRecusada` passa;
     - a mensagem de `class AdaptadorX` contém o nome de mercado (`XAdapter`).

4. **O `conferir` tem duas cláusulas sem caso** (§5, "O `conferir`"; §10, linha `conferir`).
   - **O que está errado:** a foto inclui "os nomes exportados por pacote" e "as partes fixas de template", mas a §10 não tem caso vermelho para nenhum dos dois.
   - **Correção exigida:** pôr na §10 "um nome exportado fora do mapa: vermelho" e "a parte fixa de um template mudada: vermelho".
[… 16 linhas cortadas]

## privacy-guardian · 2ª rodada · REPROVADO · 2026-10-29 22:21:04 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nenhum. Mudam só nomes de peças que tratam dado de aluno (auditoria, titular, armazém, log, erro). Nenhum campo, finalidade ou retenção muda, e o `docs/lgpd.md` não muda (PRD §8, Tech Spec §7).

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. A matriz é a mesma, as chaves dos schemas ficam e as rotas são strings comparadas pelo `conferir` (Tech Spec §3-4 e §7).

Logs: limpos. O evento do log não muda. O campo `tipo` passa a trazer o nome novo da classe, pela adenda 1. Conferi: nenhum alerta em `infra/grafana/` nem o runbook lê esse campo. Os `tipo` que aparecem lá são de job e de limite, e são strings que ficam. A guarda de log continua sem furo: a exceção por nome (`resumirErro` → `summarizeError`) está em travas.md, linha 35. As exceções por caminho (`logger.test.ts`, `logger-do-nest.ts`) entram na trava contra filtro vazio (§5), e se ficarem para trás a guarda fica mais estrita, nunca mais frouxa.

Auditoria: presente. A ação auditada é string. A porta única tem trava contra o nome novo `insertAuditoria` (travas.md, linha 36). Os caminhos `MODULO_DA_INSERCAO`, `REGISTRO` e `LEITURA` quebram em voz alta se ficarem para trás.

Envio externo: nada muda. O `IA_ADAPTADOR` é string. O glob da regra 30 passa a `*-adapter.ts`, com a interface em `adapter.ts` fora dele (adenda 1, travas.md linha 42). O `ExecucaoAgente` não é tocado.

Seed/fixture: sintético. Só muda o nome do apoio, não o conteúdo.

**Os três bloqueantes da rodada 1 estão resolvidos:**
- **B1 (guarda de erro tipado fora da §7):** a §7 remete à seção "Regra 20" de travas.md. `NOME_DA_CLASSE_DE_INVARIANTE` está na linha 31, com a prova `new InvariantException(\`${aluno.nome}\`)` vermelha. `ESCOPO_DO_ERRO_TIPADO` está na linha 32, com caminho real em `packages/core`. Os dois também entram na trava contra filtro vazio (§5).
- **B2 (`contratos.test.ts` varrendo lista vazia):** travas.md, linha 33. O filtro passa a `endsWith('ResponseSchema')`, o conjunto varrido é o mesmo, nome a nome, com a mesma contagem, e a fixture com `email` continua vermelha. Conferi que o inventário mapeia `esquemaResposta<X>` → `<x>ResponseSchema` de forma uniforme (`inventario-core-shared.md`, linha 463).
- **B3 (`this.name`):** a decisão está na adenda 1. O `this.name` entra em `excecoesDoConferir` (§5), a §7 trata do campo `tipo` do log, e travas.md, linha 34, troca o `not.toContain('ErroDeInvariante')` das linhas 166 e 169, com uma mutação que prova a 166 vermelha.

O passo 6 do `aplicar` (§5) também resolve o problema geral das referências por texto em `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`: ocorrência sem classificação deixa o relatório vermelho.

Bloqueantes:
1. **Tech Spec §5, passo 6, e "A trava contra filtro vazio".** Os arquivos de configuração da raiz e o `.github/` ficaram fora da busca por referências em texto. O `eslint.config.mjs` tem blocos `files:` com caminhos que a spec renomeia, e nada os atualiza:
   - `apps/worker/src/processadores/**/*.ts` (`eslint.config.mjs:72`): é a regra que proíbe afirmação de tipo no registro de totais do expurgo, para que a chave que faltar não fique escondida do compilador. Esse registro é a prova da retenção (regra 20, item 16). A pasta vira `processors/` (`inventario-back.md:286`).
   - `apps/web/src/componentes/ui/**` (`eslint.config.mjs:116`): é a regra pela qual o kit não importa a API nem a sessão. O kit vira `components/ui/`.

   Depois das ondas 5.0 e 6.0 esses globs não casam com nenhum arquivo, e o ESLint não acusa `files:` vazio. As duas regras deixam de valer em silêncio. O caso de `tools/guardas/guardas.test.ts:159` também continua verde, porque lint num caminho virtual antigo ainda casa com o glob antigo. O inventário (§4, linha 163) lista o `eslint.config.mjs` como trava, mas a Tech Spec não o varre, travas.md não tem linha para ele e a trava contra filtro vazio não o cobre. Era exatamente o furo da correção "referência por texto em qualquer arquivo".

   **Correção exigida:**
   - O passo 6 passa a varrer também os arquivos da raiz (`eslint.config.mjs`, `knip.json`, `package.json`, `vitest.config.ts`, `playwright.config.ts`, `.size-limit.json`, `compose.yaml`) e o `.github/`.
   - A trava contra filtro vazio passa a incluir todo `files`/`ignores` do `eslint.config.mjs` e os workspaces do `knip.json`.
   - travas.md ganha uma linha para o `eslint.config.mjs`, na onda 6.0, com prova vermelha no caminho real novo: uma afirmação `as Record<…>` em `apps/worker/src/processors/x.ts` e um import de `../sessao/x` em `apps/web/src/components/ui/x.tsx`. O caminho virtual de `guardas.test.ts` também passa ao nome novo.

Recomendações:
- travas.md, linhas 8 e 9, diz que a trava achada depois entra "no mapa da onda", e a §5 diz que a trava leva "a linha do `travas.md`". Que a trava nova entre nos dois, para travas.md continuar sendo a lista completa.
- travas.md, linha 36: a "linha 31" de `porta-unica.test.ts` é a regex da tabela, não um caminho. Falta o caminho `LEITURA` (linha 38). Ele falha em voz alta, mas vale listar.
- O `this.name` novo das classes que terminam em `…Error` passa a cair também no `not.toContain('Error')` de `erro.int.test.ts:150`. A checagem fica mais estrita, o que é bom. Registrar isso no mapa da 3.0 evita que alguém o leia como regressão.

Os arquivos que revisei estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/`: `techspec.md`, `travas.md`, `prd.md` e `inventario.md`. A evidência do bloqueante está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/eslint.config.mjs`, nas linhas 72 e 116.

## revisor-geral · 2ª rodada · REPROVADO · 2026-10-29 22:21:22 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 (o `restos` e o passo 6 do `aplicar` contra o passo 5 e contra as linhas; a gramática da guarda contra o inventário aprovado) e em `travas.md` (configuração da raiz ausente)
Portão local: não se aplica. É revisão de spec e ainda não há árvore de código (o `conferir` responde "nunca passou nesta árvore").

**Os sete bloqueantes da rodada 1**

| # | Situação |
|---|---|
| 1. Prosa estragada; §2 contra §5 | Resolvido para a edição: o passo 5 só troca sozinho o identificador composto, o que está entre crases, o `{@link}` e o caminho, e a §10 traz os casos "com" e "Banco público". Reabre na busca, no bloqueante novo 1 |
| 2. A guarda reprova nomes que ficam | Resolvido em parte: o escopo, a lista em `nomes-de-mercado.mjs`, o kit como nome exato, a entrada em `REGRAS_DAS_GUARDAS` e o `tools/` fora estão no desenho. Sobra o bloqueante novo 2 |
| 3. Nada prende a linha aos "Arquivos previstos" | Resolvido: o `--escopo` com recusa, e o teste na §10 ("seis casos de recusa") |
| 4. O compose de produção muda | Resolvido pela adenda 1. O `infra/compose.yml` só cita `nucleo` em comentário, então o `config` sai igual |
| 5. O `this.name` dos erros | Resolvido: a adenda 1, o `excecoesDoConferir` e a linha da §7 sobre o campo `tipo` do log |
| 6. A reaplicação depois do merge | Resolvido: o `reaplicar`, a correção com revisão e o teste na §10 |
| 7. O PRD acima do teto | Resolvido: 1.965 palavras |

**Bloqueantes**

1. **O `restos` e o passo 6 do `aplicar` buscam a palavra comum como palavra inteira, e ficam vermelhos para sempre** (Tech Spec §5, "O `restos`" e passo 6).
   - **O que está errado.** O mapa tem `de` que é palavra comum ou pedaço de caminho: `com`, `Banco`, `Tela`, `Fila`, `Contador`, `ia`, `erro`, `fila`, `componentes`. Contei as ocorrências como palavra inteira em `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`:
     - `com`: 10.647
     - `erro`: 3.777
     - `fila`: 2.250
     - `componentes`: 830
     - `ia`: 760
     - `Banco`: 504
   - Sem contar o que existe nos documentos vivos.
   - **Consequências.**
     - O passo 5 manda essas palavras para a troca à mão. A ocorrência que fica na prosa, porém, não está entre os liberados do `restos` ("o `fica`, o `describe`/`it`/`test` e o que o passo 5 deixa fora").
     - O passo 6 exige classificar, uma a uma, cada string com "com" ou "Fila", inclusive o texto de tela.
     - A chave mantida de propósito pelo passo 2 (`{ esquemaTurma: turmaSchema }`) também cai no `restos`.
     - O `restos` "roda em cada onda" sobre os documentos vivos, mas as ondas 7.0 a 11.0 "não tocam documento". Ele fica vermelho em toda onda de linha até a 13.0.
   - **Sem isso a prova do RF3 não funciona.** Ou fica vermelha sempre, ou alguém a ignora, que é o mesmo que não ter prova.
   - **Correção exigida.** Definir na §5:
     - a forma de busca por tipo de `de`: o símbolo como identificador de código, pelo AST ou pelo token, e não por palavra no texto; o caminho pelo trecho inteiro (`componentes/ui/`, `packages/nucleo`), nunca pelo segmento solto;
     - que a ocorrência deixada na troca à mão fica registrada no relatório como liberada;
     - que a chave mantida pelo passo 2 é liberada;
     - que nas ondas de linha o `restos` não olha documento.
   - A §10 ganha os casos: "com" numa string de tela e "Fila" na prosa, verdes; o símbolo `Banco` num import, vermelho.

2. **A gramática da guarda reprova nomes que não estão no inventário aprovado, e a §5 contradiz a si mesma** (Tech Spec §5, "A gramática"; RF8 e RF2).
   - **A contradição.** `Linha…` e `Opcoes…` valem em interface e tipo. A §5 diz que `LinhaDoMaterial` passa, mas ele é `export interface LinhaDoMaterial` (`apps/api/test/material-de-teste.ts:100`) e `export type` (`apps/web/src/areas/coordenacao/material/materiais-da-escola.ts:22`).
   - **O tamanho.** Cerca de 40 declarações caem na guarda e não estão em nenhum anexo. Por exemplo:
     - `LinhaDeAluno`, `LinhaDoUso`, `LinhaDaPrevia`, `LinhaEmMemoria`, `LinhaLida`, `LinhaDoResumo`;
     - `OpcoesDaEliminacao`, `OpcoesDoConsumo`, `OpcoesLidas`, `OpcoesDoDialogoModal`, `OpcoesDoFlutuante`, `OpcoesDoTexto`, `OpcoesDoPasso`;
     - as classes `SeguroEmMemoria` (`apps/api/src/credencial/contador-de-tentativas.ts`) e `AdaptadorDeRoteiro` (`packages/nucleo/src/ia/adaptador-resiliente.test.ts`).
   - **Consequência.** Na 12.0, a guarda fica vermelha sobre o código de hoje. O RF8 só se cumpre renomeando fora do inventário, contra o RF2, ou mudando a gramática em silêncio dentro da tarefa.
   - **Correção exigida.** Escolher uma de três saídas antes da 1.0:
     - uma adenda 2 com esses nomes, aprovada pelo Joaquim;
     - restringir `Linha…` e `Opcoes…` a um contexto que o inventário já cobre (por exemplo, `*.repository.ts` e o core);
     - uma lista de exceções nominais na própria `nomes-de-mercado.mjs`.

     Em qualquer caso, tirar `LinhaDoMaterial` da frase "passam" ou torná-la verdadeira. A §10 ganha o caso: a árvore inteira depois da 11.0, verde sob a guarda.

3. **A configuração da raiz que lê caminho renomeado não tem trava nem varredura** (`travas.md`, "Processo e configuração"; Tech Spec §5, passo 6 e "A trava contra filtro vazio").
   - **Dois globs do `eslint.config.mjs` apontam pastas que o inventário renomeia:**
     - `files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}']`, linha 116: a fronteira do kit, que não importa a API, as telas nem a sessão;
     - `files: ['apps/worker/src/processadores/**/*.ts']`, linha 72: a proibição de afirmação de tipo nos processadores, que protege os totais do expurgo.
   - **Nada pega se o glob ficar para trás:**
     - o passo 6 varre só `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`, e não a raiz;
     - a trava contra filtro vazio tem lista fechada e não inclui o `eslint.config.mjs` nem o `knip.json`;
     - o `travas.md` só cita o `eslint-suppressions.json`.
   - **Consequência.** Depois da 6.0, as duas regras passam a valer para zero arquivo, e ficam verdes sem checar nada. É exatamente o caso do RF11.
   - **Correção exigida.**
     - Incluir na trava contra filtro vazio todo `files` e `ignores` dos blocos do `eslint.config.mjs` (importando a configuração exportada) e os workspaces e entries do `knip.json`.
     - Pôr as duas linhas no `travas.md`, na onda 6.0, com a prova vermelha com o nome novo. Por exemplo, um arquivo em `components/ui/` importando `../api/x`: vermelho.
     - Estender o passo 6 aos arquivos da raiz: `*.config.*`, `package.json`, `knip.json`, `*.Dockerfile`.

**Recomendações**

- A foto do `conferir` não conta os casos de `tools/testes/`, `tools/ia/`, `tools/ci/`, `tools/demonstracao/` nem `infra/test/`, e o inventário §4 cita arquivos de lá. Incluir.
- `travas.md`, `PASTA_DOS_ADAPTADORES`: "os arquivos isentos são os mesmos de hoje" não é exato. Hoje `adaptador-*.ts` isenta também os `.test.ts`, e `*-adapter.ts` não isenta. Fica mais restrito, o que é aceitável, mas a frase deve dizer isso.
- O passo 6 cita `Dockerfile`, e o arquivo real é `infra/docker/servico.Dockerfile`. Escrever o glob.
- Os scripts do `package.json` da raiz (`-w @educa/nucleo`, `db:gerar --config packages/nucleo/...`) quebram alto se ficarem para trás. Mesmo assim, devem constar do passo 4 ou do passo 6, para não serem descobertos na esteira.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/prd.md
[… 2 linhas cortadas]

## infra-guardian · 3ª rodada · APROVADO · 2026-10-29 22:58:10 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: fila, IA, migration, deploy (só no nome: fila, chave Redis, Lua, limites, métricas e rotas continuam iguais)
Rate limit: ok (`rl:`, `vaga:` e `PREFIXO_LIMITE_*` são strings, e o `conferir` vigia o valor delas)
Fila e prioridade: ok (as filas `interativa`, `normal` e `lote`, o `nomeDaFilaBullMQ` e o `CodigoDeFalhaDeJob` são strings; nenhum código decide pelo `name` de uma classe que muda)
Concorrência: protegida (nada muda)
Índice e paginação: ok (nada muda)
Degradação de IA: não se aplica (`PASTA_DOS_ADAPTADORES` está em `travas.md:51`, aprovado pelo `llm-integrator`)
Migration: compatível (nenhuma migration; `db:gerar` sem saída na 4.0 e na 5.0, `_journal` igual, registro pelo hash, Tech Spec §3 e §7c)
Métrica e alerta: ok (nome de métrica e evento de log são strings; nenhum alerta lê o `tipo`, Tech Spec §7)

Bloqueantes: nenhum.

Os bloqueantes que dei nas rodadas 1 e 2 estão resolvidos no desenho:
- **Rodada 2: a raiz estava fora da busca e do `restos`.** Agora a raiz está no passo 6 e o `restos` busca no mesmo escopo (Tech Spec §5, passo 6 e `restos`). O `-w @educa/nucleo` e o `db:gerar --config` estão em `travas.md:85`, e o `knip.json` e o `vitest.config.ts` em `travas.md:86`, provados pela trava contra filtro vazio (§5).
- **Rodada 2: o caminho do `dist` era conferido à mão.** O caminho e o pacote agora são buscados como trecho inteiro, também sem extensão (`hash-de-senha`, `packages/nucleo`), em `infra/`. O §10 tem o caso "um `.js` de `dist` com o nome antigo em `infra/`: vermelho". As chaves passam a sair de `typeof import(<fonte>)`, e o `typecheck` da raiz já roda `tsc -p infra/tsconfig.json`, que inclui `scripts` (`travas.md:73`, §11).
- **Rodada 1, B1: os três scripts de `infra/scripts/` quebravam calados.** Resolvido pelo mesmo desenho do item anterior.
- **Rodada 1, B2: o `ops/migrar.ts` mudava o compose de produção.** O `ops/` fica (Tech Spec §7c, adenda 1). Conferi `infra/compose.yml`: o que cita `packages/nucleo` são só dois comentários (linhas 116 e 333). O `command: [node, dist/ops/migrar.js]` e o healthcheck do batimento (`/tmp/educa-batimento`) não dependem do caminho do pacote. A prova pelo `docker compose config` igual se sustenta.

Lacuna nova com veto: não achei. O `compose.yaml` e o `.env.example` da raiz não citam hoje nenhum caminho nem pacote que muda. O `.github/workflows/ci.yml` também não. A `vaga.lua` e o `ARQUIVO_DO_SANDBOX`, se errados, quebram alto (o build ou o job sintético no `infra/test/jobs.int.test.ts`), não calados.

Recomendações:
- **`travas.md:73-74`.** A prova do caminho do `dist` (os scripts de `infra/scripts/` e `tools/ia/medir-risco-a-vida.ts`) é o `restos` e o `tsc`, não "um caso que já existe fica vermelho", que é a forma da prova (linhas 12-15). Pela regra do próprio anexo, isso vira divergência na 5.0. Melhor declarar a exceção agora. Segue valendo a recomendação da rodada 2: um teste em `infra/test/` que confira que existe a fonte de cada caminho de `dist` do `importar`.
- **`travas.md:75-76`.** Para a `vaga.lua` e o `ARQUIVO_DO_SANDBOX`, falta dizer se o bloco de mutação roda o `infra/test/jobs.int.test.ts` pelo portão com `--infra`. Senão, declare que a quebra alta (o build ou o job que falha) basta como prova. Mutação que quebra o build é recusada como erro de carga (regra 40).
- **Tech Spec §5, passo 6 e `restos`.** A lista da raiz deixa de fora `compose.yaml`, `.env.example`, `.dockerignore`, `.size-limit.json` e `eslint-suppressions.json`. Hoje nenhum cita nome que muda. Mas um merge da `develop` passaria pelo `reaplicar` e pelo `restos` sem ser visto. Sugiro "todo arquivo versionado da raiz".
- **Tech Spec §5, `conferir`.** A foto não inclui `infra/scripts/`. Uma troca à mão de string num cenário de carga não seria vista pela ferramenta. Vale incluir, com o diff do `typeof import` como exceção declarada.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/compose.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/docker/servico.Dockerfile
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/infra/scripts/carga-login.ts

## tenancy-guardian · 3ª rodada · APROVADO · 2026-10-29 22:58:20 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova (Tech Spec §3 e §4; `db:gerar` sem migration na 4.0 e na 5.0, §7c). `TABELAS_DO_NUCLEO` continua conferida nos dois sentidos por `tabelas-do-nucleo.test.ts` (travas.md:33). Os nomes de tabela não estão no inventário.

Queries verificadas: nenhuma consulta muda (§6). O bloqueante da rodada 2 está resolvido no desenho:
- **`cerca-resolucao-de-tenant`** (`tools/guardas/camadas.cjs:151`): está em travas.md:28, na onda 6.0. O `to.path` é uma regex escrita dentro de template, e a trava contra filtro vazio passou a ler o `path` em regex do `camadas.cjs`, item a item (techspec.md:81-84; caso em techspec.md:156).
- **`ZONAS_DAS_CLASSES_CERCADAS`** (`apps/api/test/arquitetura.test.ts:49`): está em travas.md:32, nas ondas 6.0 e 7.0. O passo 6 agora busca dentro de regex na forma sem escape e sem exigir borda depois de `\b` (techspec.md:58-60; casos `/\bX\b/` e `x\.repository` em techspec.md:152).
- **As outras travas de regra 10, conferidas no código:**
  - as regex `@educa\/nucleo` (`arquitetura.test.ts:260` e `271`) têm casos sintéticos nas linhas 345-348, 427-430 e 526-529, que a mutação alcança;
  - `TIPOS_DO_BANCO`, o único modo de falha calado da guarda de escopo, está provado pelas fixtures de 155 a 176 (travas.md:23);
  - `PROVAS_DE_ESCOPO`, `SemEscopo` e `REPOSITORIES_SEM_ESCOPO` falham alto quando ficam para trás;
  - `justificativaSemEscopo` é símbolo, e o serviço de linguagem o renomeia;
  - `arquitetura.test.ts:470` (`toContain('exigirEscolaDoContexto()')`) e `repositories-com-escopo.test.ts:66` são asserções positivas e quebram alto. Entram pelo piso do passo 6.

Teste de isolamento: presente e efetivo. Os testes de isolamento existentes ficam garantidos pelo `conferir`, que compara os casos por arquivo (techspec.md:66-70). A mutação de cada trava da regra 10 cai sobre um caso que já existe.

Bloqueantes: nenhum.

Recomendações:
1. **travas.md:32**, a metade de caminho da regex na 6.0: até a 7.0, o caso "a varredura acha as três classes dentro da zona" (`arquitetura.test.ts:66-74`) continua casando pelo nome antigo da classe. Por isso a mutação que devolve só `resolucao-de-tenant\.repository` não deixa nenhum caso vermelho, e isso vira divergência e parada já prevista. Declare o `restos`, na busca em regex sem escape, como a prova dessa metade, ou anuncie a divergência desde já.
2. **travas.md:31**, a prova "`import * as x from '@educa/core/conta-global'` fora do lugar: vermelho" é um caso novo, o que contradiz a forma da prova (travas.md:12-15). Nenhum caso existente alcança a metade `@educa\/nucleo\/conta-global` de `arquitetura.test.ts:50`: a linha 98 é comentário e sai antes da varredura. Mesma correção do item 1.
3. **travas.md:24** diz "seis entradas de `packages/nucleo/src/`", mas são cinco (`escopo-dos-repositories.ts:84-104`). As entradas de `apps/api/src/` também caem na autochecagem `lista-arquivo-inexistente`. Corrija a contagem ou troque por "todas as entradas".
4. **travas.md:28**: diga, como a linha 27 faz, que andam juntos na 6.0:
   - a fixture `tools/guardas/__fixtures__/camadas/apps/api/src/sessao/tenant/resolucao-de-tenant.repository.ts`;
   - os imports das fixtures irmãs;
   - as expectativas de `camadas.test.ts:142-146` e `221`.

   Na 7.0, que é onda de linha e não toca `tools/`, o identificador `ResolucaoDeTenantRepository` dentro dessas fixtures precisa ser classificado como `fica` no mapa: a cerca lê o caminho, não a classe. Sem isso, o `restos` fica vermelho num lugar que a linha não pode editar.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/api/test/arquitetura.test.ts

## privacy-guardian · 3ª rodada · APROVADO · 2026-10-29 22:58:25 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: APROVADO

Esta é a rodada 3 da revisão da spec, ainda sem código. O único bloqueante que deixei na rodada 2 está resolvido no desenho. Não encontrei lacuna nova da regra 20.

**O bloqueante da rodada 2: `eslint.config.mjs` fora da busca e da trava contra filtro vazio**

- **Busca por texto (Tech Spec §5, passo 6).** A busca agora inclui a raiz (`package.json`, `knip.json`, `*.config.*`, `tsconfig*.json`) e o `.github/`. O `*.config.*` alcança o `eslint.config.mjs`, o `vitest.config.ts` e o `playwright.config.ts`.
- **Trava contra filtro vazio (Tech Spec §5, linhas 81 a 84).** Ela lê os `files`/`ignores` do `eslint.config.mjs` a partir da configuração exportada e confere item a item. Conferi as linhas 61, 72, 97 e 116 do `eslint.config.mjs`:
  - o glob `apps/worker/src/processadores/**` (linha 72, a regra que protege o registro de totais do expurgo e, com ele, a prova da retenção) e o `apps/web/src/componentes/ui/**` (linha 116, a fronteira do kit) ficariam vazios na 5.0 ou na 6.0. Agora a trava fica vermelha;
  - o brace `{sessao,operacao}` (linha 97) não corre risco, porque as duas pastas ficam (`inventario-back.md:571`).
- **Anexo de travas (`travas.md:84`).** A linha nova cobre as duas trocas (ondas 5.0 e 6.0) e leva o caminho virtual de `guardas.test.ts:159` ao nome novo.
- **A forma da prova mudou.** Ela deixou de ser o caso novo que eu pedi e passou a ser a mutação que devolve o nome antigo sobre o filtro vazio (`travas.md:12-15`, Tech Spec §10, "Mutação"). Aceito: um glob esquecido para trás não casa nada e a trava fica vermelha, e isso cumpre o RF7.
- **Caso de teste (Tech Spec §10, "Filtro vazio").** Inclui "um `files` do `eslint.config.mjs`".

As três recomendações da rodada 2 também entraram:
- a trava achada depois vai para o mapa e para o anexo (`travas.md:8-10`, Tech Spec §5);
- o caminho `LEITURA` está listado (`travas.md:45`);
- o `not.toContain('Error')` de `erro.int.test.ts:150` está registrado no mapa da 3.0 (`travas.md:43`).

**O que mais conferi**

- **Adenda 2 (94 declarações).** Nenhuma entra em `CHAVES_PESSOAIS` nem muda campo, coluna ou chave de schema. `esquemaDaResposta` → `respostaSchema` (no adaptador do core) não cai no filtro `endsWith('ResponseSchema')` do `contratos.test.ts`, e a mesma contagem exigida em `travas.md:42` pegaria qualquer desvio.
- **Guarda de log (`tools/guardas/regras-log.mjs`).** Ela só aceita valor calculado sob chave de id ou chave operacional, e reprova o resto. Como as chaves e colunas continuam em português, o vocabulário em inglês dos nomes técnicos não abre furo. O único nome que ela lê como texto, `resumirErro`, está em `travas.md:44`.
- **Escolha do `privacy-guardian` por caminho (`guardioes-por-caminho.ts`).** O `apps/web/src/componentes/ui/ia/` → `components/ui/ai/` continua com os três guardiões conferidos (`travas.md:30`). Uma exceção que ficar para trás já deixa a esteira vermelha hoje.
- **Testes do titular e de retenção.** Nenhum deles lê nome de tabela ou de símbolo como texto; o `conferir` garante que os mesmos casos continuam lá.

Campos pessoais tocados: nenhum. Mudam só nomes de peças que tratam dado de aluno (auditoria, titular, armazém, log, erro). O `docs/lgpd.md` não muda (Tech Spec §7).
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. A matriz é a mesma, as chaves de schema ficam, e rotas e permissões são strings comparadas pelo `conferir`.
Logs: limpos. O evento é o mesmo. O campo `tipo` acompanha o `this.name` (adenda 1), e nenhum alerta nem o runbook o leem.
Auditoria: presente. A ação auditada é string. A porta única tem trava com `insertAuditoria`, `LEITURA` e `IMPORTA_O_MODULO_DE_INSERCAO` (`travas.md:45`).
Envio externo: nada muda. O `IA_ADAPTADOR` é string, o glob da regra 30 passa a `*-adapter.ts` com a interface fora dele (`travas.md:51`), e o `ExecucaoAgente` não é tocado.
Seed/fixture: sintético. Muda só o nome do apoio (`Bancada` → `Fixtures`, `*-de-teste.ts` → `.fixture.ts`), não o conteúdo.
Bloqueantes: nenhum.
Recomendações:
- **Passo 6, arquivos da raiz que ficaram de fora.** O passo 6 deixou de fora `.size-limit.json`, `compose.yaml` e `.env.example`, que eu tinha listado na rodada 2. Hoje eles só citam os nomes antigos em prosa: `.size-limit.json:33` depende do nome do chunk, que `nome-dos-chunks.ts` já trava em `travas.md:89`. Por isso não bloqueia. Mesmo assim, convém trocar a lista da raiz por "todo arquivo versionado da raiz", ou escrever por que esses três ficam de fora.
- **Fora da minha regra, para o `revisor-geral`.** O §1 do `inventario.md` diz `lerConfiguracao<X>` → `load<X>Config`, mas a adenda 2, o `inventario-back.md:237` e o `guarda.md:24` usam `read<X>Config`. Basta alinhar o texto do §1. Isso não reabre o inventário, porque a adenda 2 aprovada já usa `read`.

Pergunta de fechamento: continua respondida. O rename não toca o arquivo do titular, o pedido do titular, a eliminação, a retenção nem o `ExecucaoAgente`, e as travas que provam esses pontos foram mantidas.

Arquivos revisados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario-adenda-2.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/eslint.config.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/regras-log.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/guardas/index.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tools/processo/guardioes-por-caminho.ts

## test-engineer · 3ª rodada · REPROVADO · 2026-10-29 22:59:04 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos** (os mesmos da rodada 2):
- **`aplicar`, `conferir`, `restos` e o filtro vazio:** cada cláusula com o seu caso.
- **A guarda:** cada linha da gramática, com um caso recusado e um que passa, mais a regra de olhar só a declaração de topo e a mensagem.
- **As travas (RF11):** cada uma com o seu bloco de mutação, sobre um caso que já existe.
- **Isolamento:** as travas de tenant continuam pegando o que pegavam.
- **Não se aplicam:** concorrência, porque nada roda duas vezes ao mesmo tempo, e IA, porque nenhum teste chama modelo.

**Cobertos (os meus bloqueantes da rodada 2):**
- **B1, a forma da prova: resolvido em parte.**
  - A §10, "Mutação", e o parágrafo "A forma da prova" de travas.md (linhas 12 a 15) definem o bloco que devolve a trava ao nome antigo, e dizem que nenhum caso entra.
  - Conferi na árvore que os casos citados existem:
    - as fixtures de `repositories/` e de `camadas/`;
    - `guardas.test.ts` 339, 360 e 418;
    - `guardioes.test.ts` 128 e 316;
    - o "acha dentro da zona" de `arquitetura.test.ts`.
  - Sobrou o caso da trava negativa (bloqueante 1).
- **B2, o `restos` com palavra comum: resolvido.** A §5 usa a forma de busca do passo 5 em comentário e documento. Os casos da §10 (linha 155) são os que exigi: `Banco` como tipo, `` `Fila` `` entre crases e "Fila de jobs" em prosa.
- **B3, a gramática: resolvido em parte.** guarda.md traz `class ErroX` contra `function ErroDaOperacao`, `interface LinhaX` contra `function LinhaX`, `RenovacaoRecusada` e a mensagem com `XAdapter`. `LinhaDoMaterial` saiu da lista "O que passa" e foi para a adenda 2. Faltam casos (bloqueante 2).
- **B4, o `conferir`: resolvido.** A §10 (linha 154) traz o nome exportado fora do mapa e a parte fixa de template mudada.

**Bloqueantes:**

1. **A trava negativa não se prova pela forma geral** (techspec.md 161–164; travas.md 12–15, contra as linhas 43, 45 e 87).
   - **O que está errado:**
     - A forma geral diz que a mutação devolve a trava ao nome antigo e que um caso existente fica vermelho.
     - Isso não vale para `not.toContain`. Volte `erro.int.test.ts:166` a `not.toContain('ErroDeInvariante')`, `porta-unica.test.ts:74` a `'inserirAuditoria'` ou `dockerfile.test.ts:118` a `'@educa/nucleo'`: a asserção passa sempre, e a mutação sobrevive.
     - Pela regra da §10, essas linhas cairiam em "divergência", que é parada do Joaquim.
     - As próprias linhas 43, 45 e 87 já descrevem outra coisa: uma mutação no código sob teste.
   - **Correção exigida:** a §10 e travas.md declaram a segunda forma.
     - Na trava negativa, a mutação põe o nome novo proibido no código sob teste (o filtro de erro que vaza `InvariantException`, o índice do core que exporta `insertAuditoria`, o Dockerfile da web com `@educa/core`), e o caso existente fica vermelho.
     - Cada linha de travas.md diz qual das duas formas usa.

2. **A gramática da guarda tem restrições sem caso que passa** (guarda.md 16, 22, 24, 27 e 53–57).
   - **O que está errado:** a mutação que remove qualquer destas restrições sobrevive. A árvore não tem nenhum exemplar que a pegue: não há pasta `fila/` em `apps/`.
     - a leitura só da declaração de topo;
     - o `fila/` que vale só em `packages/`;
     - `EmMemoria` só em classe, interface e tipo;
     - `esquema`/`lerConfiguracao` só em const e função.
   - **Correção exigida:** em "Passam", incluir:
     - `class ErroX` declarada dentro de uma função;
     - um arquivo em `apps/api/src/fila/` ou `apps/web/src/fila/`;
     - `function XEmMemoria`;
     - `interface esquemaX`.
   - A linha 27 precisa dizer se o "(só em `packages/`)" vale só para `fila/` ou para o segmento inteiro.

3. **A trava contra filtro vazio não prova as fontes novas, nem que leu alguma coisa** (techspec.md 81–84 e 156).
   - **O que está errado:**
     - A §10 tem caso para o glob, o item vazio, o `path` do `camadas.cjs` e os `files` do ESLint.
     - Não tem caso para os workspaces e entries do `knip.json`, para o `paths:` das regras nem para os `ignores`.
     - Um leitor que devolve lista vazia, por exemplo o import da configuração do ESLint sem nenhum bloco, deixa a trava verde sem checar nada. É o RF11 aplicado à própria trava.
   - **Correção exigida:** entram na §10:
     - vermelho com um workspace inexistente no `knip.json`;
     - vermelho com um glob inexistente no `paths:` de uma regra;
     - vermelho com um `ignores` que não casa nada;
     - vermelho quando qualquer fonte rende zero itens (um mínimo de itens por fonte).

4. **Cláusulas novas do passo 6 e do `restos` sem caso** (techspec.md 59–60, 73–75, 152 e 155).
   - **Faltam estes casos:**
     - **`aplicar`:** `startsWith('esquemaResposta')` e um `endsWith` com prefixo ou sufixo da gramática, listados como ocorrência. Nenhum dos dois é um `de` inteiro, e só essa cláusula os acha.
     - **`restos`, verde:** a troca à mão registrada no relatório; um documento com nome antigo numa onda de linha.
     - **`restos`, vermelho:** o caminho antigo num README do ouro na 13.0, verde nas demais ondas.
   - **Correção exigida:** pôr os quatro casos na §10.

**Recomendações:**
- **"com" numa string de tela (techspec.md 155):** a §10 espera verde, mas o passo 6 busca o símbolo como identificador também dentro de string. Dizer se a string de tela com palavra comum é listada e classificada `fica`, e então o caso precisa do `fica` no mapa, ou se não é listada.
- **travas.md 28 (`cerca-resolucao-de-tenant`):**
  - dizer que `tools/guardas/__fixtures__/camadas/apps/api/src/sessao/tenant/resolucao-de-tenant.repository.ts` muda de caminho junto, como a linha 27 diz da árvore do core;
  - pôr em `excecoesDoConferir` as strings esperadas de `camadas.test.ts` 143–146 e 221.
- **Filtro vazio:** declarar a base de busca, a raiz pelo `git ls-files`, sem `__fixtures__/`, `mockups/` nem `dist/`. Sem isso, uma árvore espelho de fixture mantém vivo um glob antigo sem âncora.
- **1.0, 2.0 e 12.0:** dizer se essas ondas rodam o `conferir`. Os casos novos de `tools/guardas/` (o teste da trava contra filtro vazio e o da guarda) o deixariam vermelho sem exceção declarada.
- **`conferir`:** um caso "arquivo de teste movido, com os mesmos casos: verde", para a cláusula "o caminho dos casos" de techspec.md 69.

Os arquivos revisados estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/`: `techspec.md`, `travas.md` e `guarda.md`. A evidência do bloqueante 1 está em `apps/api/test/erro.int.test.ts:166`, `packages/nucleo/src/auditoria/porta-unica.test.ts:74` e `tools/ci/dockerfile.test.ts:118`.

## revisor-geral · 3ª rodada · REPROVADO · 2026-10-29 22:59:32 · `tasks/prd-nomes-de-mercado/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5, passo 6 (a palavra comum dentro de string), em `travas.md:34` (contradiz o inventário aprovado e está na onda errada) e em `guarda.md` (uma declaração recusada que nenhum anexo lista)
Portão local: não se aplica. É revisão de spec, e o `conferir` responde "nunca passou nesta árvore", como na rodada 2.

**Situação dos três bloqueantes da rodada 2**

| # | Situação |
|---|---|
| 1. `restos` e passo 6 com palavra comum | **Resolvido no `restos`, não no `aplicar`.** O `restos` ganhou a ressalva "a palavra comum solta não conta" (techspec.md:73), a chave mantida e a troca à mão entre os liberados (:74), e não olha documento nas linhas (:75). O passo 6 continua sem essa ressalva. Ver bloqueante 1 |
| 2. Gramática contra o inventário | **Resolvido quase todo.** Apliquei a gramática do `guarda.md` às 1.495 fontes de `apps/`, `packages/` e `e2e/`. De 640 declarações recusadas, 639 estão nos anexos ou na adenda 2. Os nomes de "O que passa" existem com o tipo declarado. `LinhaDoMaterial` saiu da frase e entrou na adenda. Sobra uma declaração. Ver bloqueante 3 |
| 3. Configuração da raiz sem trava | **Resolvido.** A raiz e o `.github/` entraram no passo 6 (:56-57). Os `files`/`ignores` do `eslint.config.mjs` e o `knip.json` entraram na trava contra filtro vazio (:81-84). Há linhas próprias em `travas.md:84-86`. As linhas 72 e 116 do `eslint.config.mjs` e o `guardas.test.ts:159` conferem |

Bloqueantes:

1. **techspec.md:55-60 (passo 6) e :38-40: o `aplicar` ainda não roda numa onda que tenha `de` de palavra comum.**
   - **O problema.** O passo 6 busca "o símbolo como identificador" também dentro de string e template. Dentro de um literal, isso é o mesmo que buscar a palavra inteira. O `static com(...)` vira `forRoot` (inventario.md:63, onda 7.0). Contei os literais que contêm cada palavra:
     - "com": 5.969 literais em `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`;
     - "Tela": 117;
     - "Contador": 44;
     - "migrar": 40;
     - "Fila": 22.
   - **A consequência.** O `aplicar` recusa o mapa inteiro se sobra ocorrência sem classificação (:40). A 7.0 só roda com uns 6 mil `fica` escritos à mão, ou com o Implementador mudando a regra em silêncio.
   - **Os dois furos que sustentam o problema.**
     - A ressalva "a palavra comum solta não conta" existe só no `restos` (:73).
     - "Palavra comum" não tem definição: o mapa (:30) não tem campo para ela, e o passo 5 só dá exemplos.
   - **Correção exigida.**
     - Definir "palavra comum": a regra (identificador de uma palavra só, sem maiúscula interna nem `_`) ou um campo `comum: true` na entrada do mapa.
     - Definir no passo 6 quando a palavra comum em string é listada. Por exemplo: o literal inteiro igual ao nome (`'Banco'` em `TIPOS_DO_BANCO`), ou o nome colado a `(`, `.`, `@`, `/`, `\b`, ou dentro de `startsWith`/`endsWith`. A prosa não é listada.
     - A §10, linha `aplicar`, ganha três casos: "com" numa string de tela não listado; `'Banco'` num array listado; `'@SemEscopo('` listado.

2. **travas.md:34: a trava de `CHAVES_DOS_MARCADORES` contradiz o inventário, está na onda errada e deixa de fora a regex vizinha.**
   - Fica na área da regra 10: é a cerca que impede a rota `/v1/operacao/*`, que escapa das guardas de escola, de virar atalho.
   - **O nome novo está errado.** O anexo diz `OPERACAO_(ROUTE|LOGIN_ROUTE)_KEY`. O inventário aprovado diz `METADADO_ENTRADA_DE_OPERACAO` → `OPERACAO_ENTRY_KEY` (inventario-core-shared.md:282-283).
   - **A onda está errada.** As constantes nascem em `packages/nucleo/src/identidade/marcadores-de-operacao.ts`, então o serviço de linguagem as renomeia na 4.0. A regex de `apps/api/test/arquitetura.test.ts:553` só muda na 7.0. Entre a 4.0 e a 7.0, a varredura `marcadoresForaDaOperacao` não acha nada e fica verde calada.
   - **O passo 6 não pega essa regex.** `METADADO_(?:ROTA|ENTRADA)_DE_OPERACAO` não contém nenhum dos dois nomes, nem na forma sem escape. Se o anexo errar, nada mais pega a ocorrência.
   - **O que falta no anexo:**
     - `NOMES_DOS_MARCADORES` (:552, `RotaDeOperacao|EntradaDeOperacao` → `OperacaoRoute|OperacaoLoginRoute`, inventario-back.md:144-145, onda 7.0);
     - as strings de fixture com o nome antigo em :653, :654 e :660, que mudam junto com a regex e entram em `excecoesDoConferir`.
   - **Correção exigida.**
     - Linha 34: onda 4.0 e o nome novo `OPERACAO_(?:ROUTE|ENTRY)_KEY`, com as fixtures de 653 a 660.
     - Linha nova para a 552, na 7.0.
     - A prova é a mutação que devolve a regex ao nome antigo: o caso que já existe em :653-660, renomeado, fica vermelho.

3. **guarda.md:24, :42 e :63: `const esquemaDeCor`, em `e2e/aparencia.spec.ts:26`, é recusado pela linha "prefixo `esquema`, const e função".**
   - O nome não está no inventário, na adenda 1 nem na adenda 2. É "esquema de cor" (`colorScheme`), não um schema zod.
   - Do jeito que está, o caso da 12.0 "a árvore depois da 11.0 passa sem nenhum erro" fica vermelho. O Implementador teria de renomear fora do inventário (contra o RF2) ou mudar a gramática dentro da tarefa.
   - **Correção exigida, sem reabrir o inventário.** Uma exceção nominal em `nomes-de-mercado.mjs`, declarada em "O que passa" do `guarda.md`, com o caso correspondente. Se a opção for renomear, a saída é uma adenda 3 aprovada pelo Joaquim.

Recomendações:
- `guarda.md:27`: o "(só em `packages/`)" pode valer para os cinco segmentos ou só para `fila/`, e a linha 32 diz "`fila/` fica fora em `apps/web`". Hoje a árvore passa nas duas leituras. Com `fila/` ou `limite/` novo em `apps/api`, o resultado muda. Escrever uma leitura só.
- Passo 6: declarar como limite a regex com alternância que parte o nome. Hoje o único caso é `arquitetura.test.ts:553`, e só o `travas.md` o cobre.
- `travas.md:45`: `IMPORTA_O_MODULO_DE_INSERCAO` está na linha 49, não na 50, e o `not.toContain('inserirAuditoria')` está na 74, não na 73.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/tasks/prd-nomes-de-mercado/inventario-core-shared.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/apps/api/test/arquitetura.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado/e2e/aparencia.spec.ts
