# Tarefa 7.0 — Onda da api, símbolos (linha back)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os símbolos técnicos de `apps/api/src/` passam ao nome de mercado: `SessaoGuard`, `TokenIssuer`, `forRoot`,
`TenantResolutionRepository` e o resto do anexo. A cerca da resolução de tenant e os marcadores de operação continuam
recusando o que recusavam. Corre em linha com a web.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5 (as linhas não tocam documento, e trava de `tools/` nelas é divergência), §7c (a linha só é verde
  depois da esteira da spec) e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-back.md`, as linhas com caminho em `apps/api/src/`. As linhas `apps/api/src` de `inventario-adenda-2.md`
- `inventario.md` §1 (o nome misto, como `TurmaController`) e a adenda 3 (`loadLoginConfig`)
- `travas.md`, as linhas com 7.0 na coluna "Onda"

## Subtarefas

- [x] 7.1 — O mapa `tools/renomear/mapas/7.json`, com `"linha": true`
- [x] 7.2 — O `aplicar` e a classificação. `static com(` vira `forRoot(`: o "com" em prosa e em string fica
- [x] 7.3 — As travas:
  - `ZONAS` (linha 49) com `TenantResolutionRepository`;
  - `NOMES_DOS_MARCADORES` (linha 552) e as fixtures 651, 652 e 657 a 659;
  - a chave `HashDeSenha` nos tipos de `infra/scripts/`.

  O `ResolucaoDeTenantRepository` das fixtures de `tools/guardas/__fixtures__/camadas/` é `fica`
- [x] 7.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/` e `e2e/`, sem `docs/` (é da 13.0)
- [x] 7.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/` | alterado |
| `apps/worker/test/`, `apps/realtime/test/`, `apps/despachante/test/` | alterado |
| `apps/worker/src/app.module.ts`, `apps/despachante/src/app.module.ts`, `apps/realtime/src/app.module.ts` | alterado |
| `infra/test/`, `infra/scripts/` | alterado |
| `e2e/support/seed.ts`, `e2e/support/operacao.ts` (os `e2e/__fixtures__/sessao.ts` e `operacao.ts` de antes da 6.0) | alterado |
| `e2e/entrar-na-escola.spec.ts`, `e2e/pedido-do-titular.spec.ts` | alterado |
| `tools/ci/codigo-do-autenticador.test.ts` | alterado |
| `apps/worker/src/main.ts`, `apps/despachante/src/main.ts`, `apps/realtime/src/configure-app.ts` | alterado (chamam `AppModule.com(`, que vira `forRoot(`) |
| `apps/worker/src/config.ts`, `apps/despachante/src/config.ts`, `apps/realtime/src/config.ts` | alterado (`esquemaAmbiente` → `envSchema`, homônimo do da api) |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`, `packages/core/src/context/context.ts`, `packages/core/src/identidade/operacao-markers.ts`, `packages/core/src/identidade/route-without-sessao.ts`, `packages/core/src/permissao/permissao-boot-check.ts`, `packages/core/src/rate-limit/keys.ts`, `packages/core/src/rate-limit/rate-limit.guard.ts`, `packages/core/src/rate-limit/rate-limiter.ts` | alterado (só comentário com nome da api) |
| `packages/core/src/identidade/verify-token.ts` | alterado (comentário, e `esquemaClaims` → `claimsSchema`, que escapou da 4.0) |
| `apps/web/src/operacao/api/sessao.ts` | alterado (só o comentário da linha 331; está nos previstos da 10.0, e a triagem conferiu que junta) |
| `tools/guardas/camadas.cjs`, `tools/guardas/camadas.test.ts` | alterado (a cerca `cerca-tenant-resolution`; `travas.md`, "Achadas na 7.0") |
| `tasks/prd-nomes-de-mercado/travas.md`, `tasks/prd-nomes-de-mercado/techspec.md` | alterado (as travas achadas; o parágrafo da triagem) |
| `tools/renomear/mapas/7.json`, `tools/renomear/mapas/7.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código; documento não conta na linha | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| "com" em prosa e em string | `restos` | fica | |
| edição em `tools/` fora dos previstos, ou em documento | `aplicar` | recusada pelo `--escopo` | |
| fixtures das camadas | `restos` | o `fica` é liberado | |
| `ZONAS`, A | mutação | "reprova quem usa a classe por uma ponte de dentro da zona…" (80 a 107), com a regex no nome antigo: vermelho. A regex num nome que o código não tem (caso "acha as três classes dentro da zona") é só o controle de que ela é necessária | |
| `NOMES_DOS_MARCADORES`, A | mutação | 651 e 652 (nome antigo nas fixtures `fora`) e 657 a 659 (a fixture `inocente` posta onde a regra a pega: fora de `operacao/`, sem o comentário, fora de teste): vermelhos | |
| `HashDeSenha` em `infra/scripts`, C | mutação | `restos` | |

## Como testar

- A forma C cita `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`.
- Os marcadores e as zonas: `npx vitest run --project unidade apps/api/test/architecture.test.ts`.
- A tipagem dos scripts de carga: `npx tsc -p infra/tsconfig.json --noEmit`.
- O `static com(` (`inventario-back.md:39`) vale também no `app.module.ts` do worker, do despachante e do realtime:
  a linha é inteira desta onda.
- Ao fechar, a linha não espera a esteira: ela roda na `spec/nomes-de-mercado` depois do encontro (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o caso das zonas só alcança a cláusula com a classe renomeada: confira que
ele fica vermelho com o nome antigo na regex.

## Fora do escopo desta tarefa

O worker, o despachante, o realtime e o apoio de teste de `apps/api/test/` (8.0), e os documentos (13.0).

## Divergências resolvidas nesta tarefa

- O rename da api alcança chamadores e comentários fora dos previstos: previstos ganham os main/configure-app e config.ts dos três apps, 9 arquivos de packages/core (comentário e esquemaClaims → claimsSchema, que escapou da 4.0), o comentário de apps/web/src/operacao/api/sessao.ts:331 e camadas.cjs/camadas.test.ts; o lerConfiguracao dos três apps fica para a 8.0; Tech Spec §5 — triagem do Arquiteto, 31/10.
- 2026-10-31, Orquestrador (observação da 6.0, linhas 421 e 437 de `6_task.md`): a chave `cerca-resolucao-de-tenant` (`camadas.cjs:147`, `camadas.test.ts:142`) acompanha a classe e vira `cerca-tenant-resolution`; o comentário da cerca (`camadas.cjs:148`) e o do `PainelRepository` (`camadas.cjs:162`) trocam `@SemEscopo` por `@Unscoped`, o decorador de hoje. A string do core `'@SemEscopo exige justificativa escrita'` é mensagem e fica. `travas.md`, "Achadas na 7.0".

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. Em toda forma A, a mutação devolve a trava ao nome antigo e um caso que já existe fica vermelho. Nenhum caso entra (RF7).

O `--faltando` lista 97 linhas de produção com condição: são linhas que já existiam em `apps/api/src/` e que o rename só reescreveu (`.forRoot(`, `SecretDecryptionError`, `InvalidArgumentError`, `requireEscolaId` e afins). O rename não acrescenta condição, e as travas da onda têm os blocos abaixo.

**`ZONAS_DAS_CLASSES_CERCADAS`** (`architecture.test.ts`, linha 49, forma A). Dois blocos, com provas diferentes. O primeiro, abaixo, **é a forma A**: devolve a regex ao nome e ao caminho antigos, `ResolucaoDeTenantRepository|resolucao-de-tenant.repository`, e o caso "reprova quem usa a classe por uma ponte de dentro da zona…" (linhas 80 a 107) fica vermelho, porque a fixture `tools/vaza.ts`, que importa `TenantResolutionRepository` de `ponte.js`, deixa de casar e o `toEqual` das linhas 101 a 107 falha.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › reprova quem usa a classe por uma ponte de dentro da zona
-  { classe: 'TenantResolutionRepository', uso: /\bTenantResolutionRepository\b|tenant-resolution\.repository/, zona: ['apps/api/src/sessao/'] },
+  { classe: 'TenantResolutionRepository', uso: /\bResolucaoDeTenantRepository\b|resolucao-de-tenant\.repository/, zona: ['apps/api/src/sessao/'] },
```

O segundo, o que vem logo depois, **é um controle, e não a forma A**: troca a regex por um nome que o código não tem (`TenantResolutionRepositoryAntigo`) e prova que a regex é necessária, isto é, que o caso "acha as três classes dentro da zona" (linhas 66 a 74) depende dela. Ele não pode ser a forma A porque o nome antigo ainda aparece nos títulos dos casos de `sessao/` (RF7, só nome), e a alternativa `tenant-resolution\.repository` da regex continua casando em `sessao/`: com o nome antigo, aquele caso não fica vermelho.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura enxerga o código: acha as três classes dentro da zona delas
-  { classe: 'TenantResolutionRepository', uso: /\bTenantResolutionRepository\b|tenant-resolution\.repository/, zona: ['apps/api/src/sessao/'] },
+  { classe: 'TenantResolutionRepository', uso: /\bTenantResolutionRepositoryAntigo\b|tenant-resolution-antigo\.repository/, zona: ['apps/api/src/sessao/'] },
```

**`NOMES_DOS_MARCADORES`** (linha 552, e as fixtures 651, 652 e 657 a 659, forma A). Com a regex no nome antigo, as duas fixtures `fora` (que citam os decoradores novos) deixam de casar, e o caso falha. As fixtures 657 a 659 são `inocentes`: com o nome antigo elas continuam sem casar, e o caso não fica vermelho por elas sozinhas. Por isso a prova delas é outra (os três blocos depois do da `atalho.controller.ts`): tirar a absolvição e ver o caso cair. As duas fixtures `fora` têm bloco próprio.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-const NOMES_DOS_MARCADORES = /\b(?:OperacaoRoute|OperacaoLoginRoute)\b/
+const NOMES_DOS_MARCADORES = /\b(?:RotaDeOperacao|EntradaDeOperacao)\b/
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-      { caminho: 'apps/api/src/estrutura/turma/turma.controller.ts', texto: "import { OperacaoRoute } from '../operacao/decorators.js'\n@OperacaoRoute()\n@Controller('v1/turmas')\nexport class TurmaController {}" },
+      { caminho: 'apps/api/src/estrutura/turma/turma.controller.ts', texto: "import { RotaDeOperacao } from '../operacao/decorators.js'\n@RotaDeOperacao()\n@Controller('v1/turmas')\nexport class TurmaController {}" },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-      { caminho: 'apps/api/src/sessao/atalho.controller.ts', texto: 'export class Atalho {\n  @Get()\n  @OperacaoLoginRoute()\n  obter() {}\n}' },
+      { caminho: 'apps/api/src/sessao/atalho.controller.ts', texto: 'export class Atalho {\n  @Get()\n  @EntradaDeOperacao()\n  obter() {}\n}' },
```

**As fixtures `inocentes` 657 a 659**, forma A. Elas mostram que o marcador **com o nome atual** é absolvido pela pasta (657), pelo comentário (658) e pelo caminho de teste (659). Cada bloco tira a absolvição e deixa o nome, e o caso fica vermelho só porque a regex conhece o nome. Sem caso novo (RF7).

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-      { caminho: 'apps/api/src/operacao/painel/painel.controller.ts', texto: '@OperacaoRoute()\nexport class PainelController {}' },
+      { caminho: 'apps/api/src/estrutura/painel.controller.ts', texto: '@OperacaoRoute()\nexport class PainelController {}' },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-      { caminho: 'packages/core/src/rate-limit/rate-limit.guard.ts', texto: '/** A rota `@OperacaoRoute()` conta no rl:op. */\n// e a @OperacaoLoginRoute não\nconst x = 1' },
+      { caminho: 'packages/core/src/rate-limit/rate-limit.guard.ts', texto: '@OperacaoRoute()\nconst x = 1' },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-      { caminho: 'apps/api/test/qualquer.int.test.ts', texto: '@OperacaoRoute()\nclass X {}' },
+      { caminho: 'apps/api/src/estrutura/qualquer.ts', texto: '@OperacaoRoute()\nclass X {}' },
```

**O controle positivo do barrel de `credencial/`** (`architecture.test.ts`, forma A). Com `'HashDeSenha'`, o barrel não tem a chave, e o caso falha. O rótulo `'ResolucaoDeTenantRepository'` do mesmo caso e do caso do barrel de `sessao/` é forma C: ele dá o nome à mensagem e a `Object.keys`, e o `Object.values` ao lado confere a classe pelo valor.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › nem o barrel de credencial/ exporta a ResolucaoDeTenantRepository nem a ContaGlobalRepository, com o nome dela ou outro
-    expect(Object.keys(credencial)).toContain('PasswordHasher')
+    expect(Object.keys(credencial)).toContain('HashDeSenha')
```

**`operador.repository.ts` não declara nem reexporta `AuthorCheck`** (forma B). Com o nome novo declarado no arquivo, o caso fica vermelho.

```mutacao
arquivo: apps/api/src/operacao/operador/operador.repository.ts
teste: apps/api/test/architecture.test.ts › operador.repository.ts não declara nem reexporta ConferenciaDoAutor
-import { ErrorCode } from '@educa/shared'
+import { ErrorCode } from '@educa/shared'
+export type AuthorCheck = unknown
```

**`NOMES_QUE_SAIRAM`** (`login.service.test.ts`, forma B). Com `export type { RequestOrigin }` no `login.service.ts`, o caso das exportações fica vermelho.

```mutacao
arquivo: apps/api/src/sessao/login/login.service.ts
teste: apps/api/src/sessao/login/login.service.test.ts › nenhuma exportação do arquivo cita um dos sete nomes, que os tipos não aparecem em Object.keys
-import { ipParaRegistro, type RequestOrigin, type ResultadoDoLogin } from '../../credencial/request-origin.js'
+import { ipParaRegistro, type RequestOrigin, type ResultadoDoLogin } from '../../credencial/request-origin.js'
+export type { RequestOrigin }
```

**`camadas.test.ts`, a chave `cerca-tenant-resolution`** (linha 142, forma A). Com a chave no nome antigo, a fixture é de uma regra que o `camadas.cjs` não tem mais, e o caso que confere regra e fixture falha.

```mutacao
arquivo: tools/guardas/camadas.test.ts
teste: tools/guardas/camadas.test.ts › toda regra da configuração tem a sua fixture, e nenhuma fixture é de regra que não existe
-  'cerca-tenant-resolution': [
+  'cerca-resolucao-de-tenant': [
```

**A descrição de `Symbol('…')` dos tokens de DI** (`travas.md`, forma C). Nenhum teste lê a descrição, e o `restos` a vê como texto: com a descrição no nome antigo, ele acusa.

```mutacao
arquivo: apps/api/src/database.module.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const DB_POOL = Symbol('DB_POOL')
+export const DB_POOL = Symbol('POOL_BANCO')
```

**O `this.name` das classes de erro** (forma C). Com o nome antigo na string, o `restos` acusa. Dois blocos, um por arquivo (`secret-cipher.ts` e `ops/command.ts`); os outros três (`OperadorRejectedError`, `DesativacaoRejectedError`, `ExternalProviderError`) seguem o mesmo caminho.

```mutacao
arquivo: apps/api/src/credencial/secret-cipher.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    this.name = 'SecretDecryptionError'
+    this.name = 'SegredoNaoDecifra'
```

```mutacao
arquivo: apps/api/src/ops/command.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    this.name = 'InvalidArgumentError'
+    this.name = 'ArgumentoInvalido'
```

**As chaves dos tipos literais de `infra/scripts/`** (`HashDeSenha` → `PasswordHasher`, `criarSessoesSinteticas` → `createSyntheticSessions`, `emissorDeTokenSintetico` → `syntheticTokenIssuer`; forma C, o `tsc`). Nenhum teste alcança os três scripts, e o `restos` não olha a chave de um tipo literal nem o membro de uma chamada (rodado com `hash.HashDeSenha.criar`, ele deu limpo). A chave é o que o `dist` exporta, e o `importar<T>` é uma afirmação de tipo: a chave antiga compilaria e quebraria na execução. Por isso troquei a chave e o uso à mão, e a prova é o `tsc -p infra/tsconfig.json`, que o portão roda no passo dos tipos e não cabe num bloco de mutação. Rodada à mão nesta árvore, com o nome antigo em cada uso e os arquivos restaurados depois, o `tsc` fica vermelho nos três:

- `carga-login.ts`: `hash.HashDeSenha.criar(` e `sessoes.criarSessoesSinteticas(` → `TS2339: Property … does not exist`;
- `carga-sala.ts`: `modulos.hash.HashDeSenha.criar(` e `modulos.sessoes.criarSessoesSinteticas(` → `TS2339`;
- `ensaio-alertas.ts`: `sessoes.emissorDeTokenSintetico(` e `sessoes.criarSessoesSinteticas(` → `TS2339`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| Implementador (antes da 1ª) | `SeguroEmMemoria` e `LimitesDoPrefixo.com` de `packages/core/src/rate-limit/` | `fica`: o core não é desta onda (o `SeguroEmMemoria` do core ficou da 4.0), e o `com(` do `LimitesDoPrefixo` é método comum, não o `static com` de módulo |
| Implementador (antes da 1ª) | `lerConfiguracao`, `ProntidaoController` (realtime), `EtapaDoDesafioDeOperador` (web) e o `Redirecionamento` local de `external-login.int.test.ts` | `fica` com a linha do anexo: homônimos de outro app ou locais; `lerConfiguracao` dos três apps é da 8.0 (triagem do Arquiteto, 31/10) |
| Implementador (antes da 1ª) | `travas.md` e o encontro com a linha 2: as citações `travas.md:154` a `159` (mapa, relatório e este documento) somam as linhas que a L2 acrescentou | Regra da triagem da 7.0: quem encontra depois põe o bloco depois do outro no `CONFLITO` do encontro |
| conformidade-reviewer (1ª) | `packages/core/src/ia/README.md:34,37,52` cita `AgendadorDeExecucoes` e `ConferenciaDeFuncao.exigirAtiva('correcao_de_objetiva')` | Documento: é a 13.0 (Fora do escopo desta tarefa: "os documentos (13.0)"). Anotar o trecho na 13.0 |
| conformidade-reviewer, tenancy-guardian, privacy-guardian, infra-guardian (1ª) | Títulos de caso com o nome antigo (`describe('AgendadorDeExecucoes'` em `ia.int.test.ts:691`, `architecture.test.ts:76,134,149,666,764,1397`, `operacao-isolamento.int.test.ts:159`, `sessao-sintetica.test.ts:17`, `revogar-acessos-sala.test.ts:36`, `password-hasher.test.ts:13`) | Recusada nesta onda: RF7 manda manter o título (só nome, os mesmos casos) e o bloco de mutação de `ZONAS` cita o título que fica. Vai para a retro da spec |
| tenancy-guardian, privacy-guardian (1ª) | A string do core `'@SemEscopo exige justificativa escrita'` convive com `@Unscoped` nos comentários de `camadas.cjs` | Recusada: a divergência resolvida desta tarefa (Orquestrador, 31/10) diz que a string do core é mensagem e fica. Alinhar na 13.0 |
| infra-guardian (1ª) | Aviso de pouso: o `tipo` do log mudou em cinco classes de erro (busca de log salva com o nome antigo deixa de achar) | `travas.md` já tem a linha do `this.name` ("o log (`tipo`) e a pilha mostram"). O aviso é para a nota de pouso, do Orquestrador: levado no relatório da tarefa |
| revisor-geral (1ª) | Descobrir por que o `aplicar` trocou um comentário num arquivo cuja ocorrência está como `fica`, e por que o `conferir` e o `restos` não acusaram | `TODO.md` (ferramenta `tools/renomear/`), a conferir antes da 8.0, que troca o `lerConfiguracao`. Depois do item 1 da ordem, o `conferir` e o `restos` rodam de novo e valem como a primeira checagem |
| revisor-geral (1ª) | `ContaExternalRepository` mistura português e inglês num nome só (destino vem do `inventario-back.md:94`) | Retro do inventário, não esta onda |
| test-engineer (1ª) | `architecture.test.ts:76` varre o repositório inteiro e estoura os 5 s com carga; vale `{ timeout }` explícito | `TODO.md`: já existia antes da tarefa e é teste fora do rename (RF7) |
| test-engineer (1ª) | Guarda que compare a chave de `importar<…>` de `infra/scripts` com o `typeof` ao lado | `TODO.md`: fora desta onda, como o próprio revisor diz |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 11:07:05 | 2026-10-31 11:08:57 | `conformidade-reviewer` | 1 | APROVADO | a4d212cf0d875008d |
| 2026-10-31 11:06:59 | 2026-10-31 11:09:44 | `tenancy-guardian` | 1 | APROVADO | aff013171e358cc9e |
| 2026-10-31 11:07:02 | 2026-10-31 11:10:08 | `privacy-guardian` | 1 | APROVADO | a7573d2e7164d59e1 |
| 2026-10-31 11:07:08 | 2026-10-31 11:11:49 | `infra-guardian` | 1 | APROVADO | abfb3d78de23b08f8 |
| 2026-10-31 11:07:15 | 2026-10-31 11:11:54 | `revisor-geral` | 1 | REPROVADO | ad78376a06108916a |
| 2026-10-31 11:07:12 | 2026-10-31 11:12:19 | `test-engineer` | 1 | REPROVADO | af6a5661bf38a630f |
| 2026-10-31 11:30:34 | 2026-10-31 11:31:15 | `test-engineer` | 2 | APROVADO | a380e5311cb9659b3 |
| 2026-10-31 11:30:42 | 2026-10-31 11:31:31 | `revisor-geral` | 2 | APROVADO | a5659cb7fd1eecc88 |
