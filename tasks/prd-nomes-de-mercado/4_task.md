# Tarefa 4.0 — Onda do core, símbolos

**Funcionalidade:** nomes-de-mercado · **Depende de:** 3.0, e a correção `2026-10-29-links-do-runbook` trazida da `develop`
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As classes, interfaces, tipos, constantes, funções e decorators do `packages/nucleo` passam ao nome de mercado:
`Unscoped`, `requireEscolaId`, `Database`, `FakeAdapter`, `InvariantException` e o resto do anexo. Arquivos, pastas e
pacote ficam para a 5.0. As travas de isolamento, de log, de auditoria e da camada de IA continuam recusando o que
recusavam.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5, §6, §7, §7b, §7c (o `db:gerar`) e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-core-shared.md`, as linhas com "Onde" em `nucleo/` dos §2 a §15. As 26 linhas `packages/nucleo` de
  `inventario-adenda-2.md`
- `inventario.md` §1 e as adendas 1 e 3
- `travas.md`, as linhas com 4.0 na coluna "Onda"
- `.claude/rules/10-multitenancy.md` (itens 3 e 9) e `.claude/rules/30-camada-ia.md`

## Subtarefas

- [x] 4.1 — O mapa `tools/renomear/mapas/4.json`. As adendas valem: o `this.name` acompanha a classe, e o leitor de
  configuração é `load<X>Config`
- [x] 4.2 — O `aplicar` e a classificação. A regex de `CHAVES_DOS_MARCADORES` parte o nome e o passo 6 não a acha:
  troque à mão
- [x] 4.3 — As travas:
  - `TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO` e o export `SemEscopo`;
  - `inserirAuditoria` em `REPOSITORIES_SEM_ESCOPO`;
  - `'@SemEscopo('`;
  - `CHAVES_DOS_MARCADORES` e as fixtures 653, 654 e 660;
  - `resumirErro` e `LoggerDoNest`;
  - `porta-unica`, a linha 74, o `toEqual` da 83 e a regex da 49.

  As fixtures do escopo continuam importando `@educa/nucleo` até a 5.0
- [x] 4.4 — O `conferir`, o `restos` e o `db:gerar` sem migration. A busca dos nomes antigos em `apps/web/src`, `e2e/` e
  `docs/`
- [x] 4.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/` | alterado |
| `apps/` | alterado |
| `e2e/` | alterado |
| `infra/` | alterado |
| `tools/guardas/` | alterado |
| `tools/processo/guardioes-por-caminho.ts` | alterado |
| `tools/processo/portao.ts` | alterado: só o comentário da linha 375 (`@SemEscopo(`) |
| `tools/demonstracao/ia-com-o-material.test.ts` | alterado: só o import e o uso dos símbolos do core que a onda renomeia (`DefinicaoDeTarefa`); os caminhos são da 5.0 |
| `eslint.config.mjs` | alterado: só o comentário da linha 94 (`ipDaRequisicao`) |
| `tools/ci/ambiente-de-teste.test.ts`, `tools/ci/dockerfile.test.ts`, `tools/processo/separar-achados.test.ts` | sem diff no fim: o passo 5 troca o `migrar` entre crases, que aí é o serviço do compose ou a `migrar` de `separar-achados.ts`, e a onda desfaz à mão (Tech Spec §5, passo 5) |
| `tools/ci/borda.test.ts` | alterado: só o nome da constante na regex da linha 95 (`DEFAULT_RETRY_AFTER_SECONDS`); o caminho é da 5.0 |
| `tools/processo/harness/guardioes.test.ts` | alterado: só a marca `@SemEscopo()` por extenso dos casos das linhas 128 e 316 |
| `tools/processo/harness/__fixtures__/revisores-antes/tenancy-guardian.verificar.md` | alterado: só o literal `@SemEscopo()` → `@Unscoped()` da linha 13, igual ao item 8 do `tenancy-guardian.md` |
| `tools/processo/harness/revisores.test.ts` | alterado: só o comentário do topo (linhas 5 a 7), com uma frase dizendo que a gravação de 24/10 teve esse literal trocado pela 4.0 de nomes-de-mercado e nada mais |
| `tools/ia/` | alterado |
| `tools/testes/` | alterado |
| `tools/renomear/mapas/` | novo |
| `CLAUDE.md` | alterado |
| `.claude/` | alterado |
| `docs/` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos, e nenhum teste de isolamento sai (RF7) | |
| `restos` | ferramenta | nenhum `de` sobra (RF3) | |
| `db:gerar` | comando | sem migration, e o `_journal` sem diff | |
| esteira | esteira | tudo verde | |
| `TIPOS_DO_BANCO` e `PROVAS_DE_ESCOPO`, forma A | mutação | `sem-prova`, `banco-por-parametro`, `funcao-exportada` e `executor-de-auditoria` ficam vermelhos (`repositories-com-escopo.test.ts`, 155 a 176) | |
| `inserirAuditoria`, forma C | mutação | `lista-metodo-inexistente`: vermelho | |
| `'@SemEscopo('`, forma A | mutação | `@Unscoped(` chama o `tenancy-guardian` | |
| `CHAVES_DOS_MARCADORES`, forma A | mutação | os casos 653, 654 e 660: vermelhos | |
| `summarizeError` e `NestLogger`, forma A | mutação | `{ erro: e.message }` continua vermelho | |
| `porta-unica`, forma B | mutação | a linha 74: vermelha | |
| `porta-unica`, forma A | mutação | a linha 83 e a regex da 49: vermelhas | |

## Como testar

- O escopo: `npx vitest run --project unidade tools/guardas/repositories-com-escopo.test.ts`. O caso `reprovaOndeDiz`
  lê a fixture por nome.
- Os guardiões: `tools/processo/harness/guardioes.test.ts`, que escreve os literais por extenso.
- O log: `tools/guardas/guardas.test.ts › guarda de log com dado pessoal`.
- A porta única: `npx vitest run --project unidade packages/nucleo/src/auditoria/porta-unica.test.ts`.
- Os marcadores: `apps/api/test/arquitetura.test.ts`, de 640 a 665.
- A correção `links-do-runbook` tem de estar na spec antes do mapa: `git log --oneline -- infra/grafana/alertas/`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6: depois do rename, a guarda de escopo continua reprovando o repository sem
prova? Rode as fixtures, não só a árvore.

## Fora do escopo desta tarefa

Arquivo, pasta e pacote do core (5.0). Os símbolos dos apps (7.0 a 11.0).

## Divergências resolvidas nesta tarefa

- 2026-10-30, Arquiteto: o `aplicar` recusou seis arquivos fora dos previstos. `portao.ts` e `eslint.config.mjs` (comentário) e `ia-com-o-material.test.ts` (import relativo de `DefinicaoDeTarefa`, já no `inventario-core-shared.md`, 1116 a 1118) entram restritos ao que a onda arrasta. Nos três de `migrar`, e em `docs/guia-do-desenvolvedor.md` e `docs/infra.md`, o passo 5 troca a palavra comum entre crases onde ela nomeia o serviço do compose (ou a `migrar` de `separar-achados.ts`): a onda desfaz à mão e registra cada ocorrência como `fica` no `4.json`, com o motivo. Registrado na Tech Spec §5, passo 5. Nenhum critério muda.
- 2026-10-30, Arquiteto: o `conferir` ficou vermelho só por três homônimos de outro pacote (`DependenciasDoExecutor` de `apps/worker`, `LinhaNova` e `migrar` de `tools/processo`), que o `aplicar` corretamente não renomeou. O nome exportado segue a entrada só no pacote do `arquivo` dela e em quem reexporta dele (Tech Spec §5, "O `conferir`"; `casos.md`, `conferir`): o conserto do `conferir` é correção à parte, antes da retomada, e esta tarefa não toca `tools/renomear/`. `borda.test.ts` (regex da 95) e `guardioes.test.ts` (a marca por extenso) entram nos previstos, restritos a esses literais (`travas.md`). Nenhum critério muda.
- 2026-10-30, Arquiteto: o portão da correção `conferir-homonimo-de-outro-pacote`, rodado na árvore da 4.0, ficou vermelho em `revisores.test.ts:421` ("os de hoje são os de antes"): a 4.0 trocou o item 8 do `tenancy-guardian.md` para `@Unscoped()`, e a gravação de 24/10 (`revisores-antes/tenancy-guardian.verificar.md`, linha 13) ficou com `@SemEscopo()`. A troca no agente é da 4.0 e fica: com o nome velho, o guardião procuraria uma marca que não existe mais (regra 10, item 9). A gravação acompanha o mesmo literal, e só ele; não é regravada, e o comentário do topo do `revisores.test.ts` registra a troca. As duas entram nos previstos (`travas.md`). A lista do guardião não muda de sentido, e nenhum critério muda.

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. Em toda forma A, a mutação devolve a trava ao nome
antigo e um caso que já existe fica vermelho. Nenhum caso entra (RF7).

**`TIPOS_DO_BANCO`** (`travas.md`, regra 10, linha 1, forma A). Um nome por bloco, cada um com a fixture que o usa: `sem-prova`
(`Database`), `banco-por-parametro` e `funcao-exportada` (`DatabaseTransaction`) e `executor-de-auditoria` (`DatabaseExecutor`).

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › toca this.banco sem prova de escopo, com o arquivo e o método
-export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'DatabaseExecutor'])
+export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Banco', 'DatabaseTransaction', 'DatabaseExecutor'])
```

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › o banco recebido por parâmetro também
-export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'DatabaseExecutor'])
+export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'TransacaoBanco', 'DatabaseExecutor'])
```

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › a função exportada do módulo é ponto de entrada público, e a interna não
-export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'DatabaseExecutor'])
+export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'TransacaoBanco', 'DatabaseExecutor'])
```

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › o banco recebido pelo tipo do executor de auditoria também
-export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'DatabaseExecutor'])
+export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'ExecutorDeAuditoria'])
```

**`PROVAS_DE_ESCOPO`** (mesma linha, forma A). `requireEscolaId` com o nome antigo deixa de ser prova, e o método
`listarNaEscola` da fixture `banco-por-parametro`, que a usa, passa a ser acusado sem a marca `reprova:`. `requestIdentity` e
`jobScopeInContext` têm a fixture `provas-do-contexto`, uma para cada.

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › o banco recebido por parâmetro também
-export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'requestIdentity', 'jobScopeInContext'])
+export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['exigirEscolaDoContexto', 'requestIdentity', 'jobScopeInContext'])
```

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › só identidadeDaRequisicao, ou só escopoDoJobNoContexto, valem cada uma
-export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'requestIdentity', 'jobScopeInContext'])
+export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'identidadeDaRequisicao', 'jobScopeInContext'])
```

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › só identidadeDaRequisicao, ou só escopoDoJobNoContexto, valem cada uma
-export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'requestIdentity', 'jobScopeInContext'])
+export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'requestIdentity', 'escopoDoJobNoContexto'])
```

**O export `Unscoped`** (mesma linha, forma A). A guarda volta a procurar o decorator pelo nome antigo: o `@Unscoped` importado
deixa de valer e a fixture `decorator-e-satisfies`, que passa limpa, é acusada.

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › decorator, satisfies e as const compilam no parser da raiz, e o @SemEscopo com motivo vale
-          if (exportado === 'Unscoped') decoratorsSemEscopo.add(elemento.name.text)
+          if (exportado === 'SemEscopo') decoratorsSemEscopo.add(elemento.name.text)
```

**`inserirAuditoria` em `REPOSITORIES_SEM_ESCOPO`** (`travas.md`, regra 10, linha 2, forma C, a própria guarda). Com o método
no nome antigo, a lista cita um método que não existe e a guarda acusa `lista-metodo-inexistente`.

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › todo método público real tem \(a\) a prova do contexto, \(b\) @SemEscopo com motivo ou \(c\) a entrada na lista
-    metodos: ['insertAuditoria'],
+    metodos: ['inserirAuditoria'],
```

**`'@SemEscopo('`** (`guardioes-por-caminho.ts`, forma A). Com o literal antigo, o `@Unscoped()` que o caso escreve por extenso
não chama mais o `tenancy-guardian`.

```mutacao
arquivo: tools/processo/guardioes-por-caminho.ts
teste: tools/processo/harness/guardioes.test.ts › @SemEscopo\( no índice, só no HEAD ou em nenhum: quatro, quatro, e C I \(componentes/ui/\)
-const SEM_ESCOPO = '@Unscoped('
+const SEM_ESCOPO = '@SemEscopo('
```

**O item 8 do `tenancy-guardian.md` e a gravação de antes** (mesma tabela, forma A). Cada lado sozinho com o literal antigo:
`revisores.test.ts` só fica verde com os dois iguais.

```mutacao
arquivo: .claude/agents/tenancy-guardian.md
teste: tools/processo/harness/revisores.test.ts › os de hoje são os de antes, e a conferência compara oito textos
-8. `@Unscoped()` aparece só onde há justificativa escrita.
+8. `@SemEscopo()` aparece só onde há justificativa escrita.
```

```mutacao
arquivo: tools/processo/harness/__fixtures__/revisores-antes/tenancy-guardian.verificar.md
teste: tools/processo/harness/revisores.test.ts › os de hoje são os de antes, e a conferência compara oito textos
-8. `@Unscoped()` aparece só onde há justificativa escrita.
+8. `@SemEscopo()` aparece só onde há justificativa escrita.
```

**`CHAVES_DOS_MARCADORES`** (`arquitetura.test.ts`, forma A). Com a regex no nome antigo, a chave citada fora do lugar (as
strings das linhas 653, 654 e 660, agora `OPERACAO_ROUTE_KEY` e `OPERACAO_ENTRY_KEY`) não é achada e o caso deixa de reprovar.

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › a varredura reprova o marcador fora da pasta, na classe, no método ou pela chave, e não confunde comentário com uso
-const CHAVES_DOS_MARCADORES = /\bOPERACAO_(?:ROUTE|ENTRY)_KEY\b/
+const CHAVES_DOS_MARCADORES = /\bMETADADO_(?:ROTA|ENTRADA)_DE_OPERACAO\b/
```

**O repository que lê a escola do contexto** (`arquitetura.test.ts`, forma A). A asserção volta a procurar o nome antigo no
texto de `compartilhamento.repository.ts`, que já não o tem.

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › o repository lê a escola do contexto e nenhum método a recebe
-    expect(texto).toContain('requireEscolaId()')
+    expect(texto).toContain('exigirEscolaDoContexto()')
```

**`USO_DA_ROTINA`** (forma A). A regex só com o nome antigo da classe não acha mais quem usa `CronEscolasRepository`.

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › fora dos testes, só o worker-lote usa a lista de escolas da rotina
-const USO_DA_ROTINA = /\bCronEscolasRepository\b|escolas-da-rotina\.repository/
+const USO_DA_ROTINA = /\bEscolasDaRotinaRepository\b|escolas-da-rotina\.repository/
```

**`summarizeError`** (`regras-log.mjs`, regra 20, forma A). A guarda reconhece o resumo pelo nome antigo, e o
`erro: summarizeError(erro)` da fixture que passa deixa de passar. `{ erro: e.message }` segue reprovado pelo caso de
dado pessoal, que não muda. O `NestLogger` (antes `LoggerDoNest`) não tem trava de nome: ele só aparece num comentário de
`tools/guardas/index.mjs`, e a exceção da guarda lê o caminho do arquivo (`logger-do-nest.ts`, da 5.0). Não há bloco para ele.

```mutacao
arquivo: tools/guardas/regras-log.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o log com evento fixo, ids, durações, contagem de tokens e erro
-    if (atual.type === 'CallExpression' && atual.callee.type === 'Identifier' && atual.callee.name === 'summarizeError') return true
+    if (atual.type === 'CallExpression' && atual.callee.type === 'Identifier' && atual.callee.name === 'resumirErro') return true
```

**A porta única da auditoria** (`porta-unica.test.ts`, formas A e B). A linha 74, forma B: o índice do core exportando
a chave `insertAuditoria`, como constante e sem importar o módulo de inserção, para que a linha 73 (`importam`) continue verde e só a 74
fique vermelha. O `toEqual` da linha 83 e a regex da 49 leem caminho e nome de arquivo, e o arquivo muda na 5.0: os dois blocos
não são mutação de nome, só provam que as duas travas estão vivas (o da 83 tira `LEITURA` do esperado; o da 49 põe na regex o
nome que o arquivo não tem).

```mutacao
arquivo: packages/nucleo/src/index.ts
teste: packages/nucleo/src/auditoria/porta-unica.test.ts › só o RegistroDeAuditoria importa o módulo de inserção, e o pacote não o exporta
-export { AuditoriaRejectedError, MOTIVOS_DE_RECUSA_DA_AUDITORIA } from './auditoria/auditoria-recusada.js'
+export { AuditoriaRejectedError, MOTIVOS_DE_RECUSA_DA_AUDITORIA } from './auditoria/auditoria-recusada.js'
+export const insertAuditoria = (): void => {}
```

```mutacao
arquivo: packages/nucleo/src/auditoria/porta-unica.test.ts
teste: packages/nucleo/src/auditoria/porta-unica.test.ts › a tabela só é importada pelo módulo de inserção e pela leitura, e o schema exportado não a contém
-    expect(importam).toEqual([MODULO_DA_INSERCAO, LEITURA].sort())
+    expect(importam).toEqual([MODULO_DA_INSERCAO].sort())
```

```mutacao
arquivo: packages/nucleo/src/auditoria/porta-unica.test.ts
teste: packages/nucleo/src/auditoria/porta-unica.test.ts › só o RegistroDeAuditoria importa o módulo de inserção, e o pacote não o exporta
-const IMPORTA_O_MODULO_DE_INSERCAO = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])[^'"`\n]*insercao-de-auditoria[^'"`\n]*\1/
+const IMPORTA_O_MODULO_DE_INSERCAO = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])[^'"`\n]*auditoria-insert[^'"`\n]*\1/
```

**O `this.name` das classes de erro do core** (`travas.md`, regra 20, linha 5, formas A). Cada classe com o nome no
`this.name` que um teste lê; a mutação devolve o nome antigo.

```mutacao
arquivo: packages/nucleo/src/auditoria/acoes.ts
teste: packages/nucleo/src/auditoria/acoes.test.ts › o mapa com problema é recusado com um ErroDeInvariante de mensagem fixa e os caminhos num campo; o mapa real passa
-    this.name = 'InvalidAuditoriaMapError'
+    this.name = 'MapaDeAuditoriaInvalido'
```

```mutacao
arquivo: packages/nucleo/src/permissao/conferencia-das-permissoes.ts
teste: apps/api/test/permissao-no-boot.test.ts › rota sem @Permite, sem @RotaAnonima e sem marcador da operação derruba o boot, com o nome do controller e do método
-    this.name = 'RoutesWithoutPermissaoError'
+    this.name = 'RotasSemPermissao'
```

```mutacao
arquivo: packages/nucleo/src/titular/armazem-de-arquivos.ts
teste: apps/worker/test/montar-arquivo.int.test.ts › o armazém fora: o erro sobe, o pedido fica `em_preparacao` e nenhuma linha é gravada; com ele de volta, o job conclui
-    this.name = 'FileStorageUnavailableError'
+    this.name = 'ArmazemIndisponivel'
```

**A medida de risco à vida** (`medir-risco-a-vida.test.ts`, forma A). O módulo é lido por chave, sob `as unknown as`, e o `tsc`
não vê a chave que ficar para trás: com `AdaptadorRoteirizado` na chave, o caso quebra com `is not a constructor`. As chaves `loadLLMConfig`, `createLLMGateway` e
`runInContext` do `NucleoEmDist`, lidas só em `principal` (que nenhum teste chama), não são alcançadas por teste nem pelo `tsc`:
quem as prova é o `restos` (forma C).

```mutacao
arquivo: tools/ia/medir-risco-a-vida.test.ts
teste: tools/ia/medir-risco-a-vida.test.ts › pelo caminho da tarefa: o modelo que oscila vale pela pior execução, e o padrão não depende dele
-  const adaptador = new nucleo.ScriptedAdapter(roteiro)
+  const adaptador = new nucleo.AdaptadorRoteirizado(roteiro)
```

**A regex de `borda.test.ts`** (linha 95, `DEFAULT_RETRY_AFTER_SECONDS`, forma C). Sem bloco: com o nome antigo na regex, o `exec` sobre
`erro-de-dominio.ts` devolve `undefined` e o `expect(daApi).toBeDefined()` da linha seguinte falha alto.

**As chaves `createDatabase` e `createPool` dos scripts de `infra/`** (forma C, o `tsc`). Nenhum teste alcança os três
scripts, e o `restos` não olha a chave de um tipo literal: a prova é o `tsc -p infra/tsconfig.json`, que o portão roda no
passo dos tipos, e ela não cabe num bloco de mutação, que só roda teste. Rodada à mão nesta árvore, com a chave antiga numa
chamada e o arquivo restaurado depois, o `tsc` fica vermelho nas três:

- `carga-login.ts`: `nucleo.criarPool(` → `TS2339: Property 'criarPool' does not exist on type '{ createDatabase: …; createPool: … }'`;
- `carga-sala.ts`: `modulos.nucleo.criarBanco(pool)` → `TS2339: Property 'criarBanco' does not exist`;
- `ensaio-alertas.ts`: `nucleo.criarBanco(pool)` → `TS2339: Property 'criarBanco' does not exist`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | Nas `ocorrencias` com `fica`, o campo `linha` aponta para a linha do símbolo no inventário e não para "Não muda, mas parece"; as de `migrar` não levam o motivo, porque o formato só tem `trecho` | Muda a Tech Spec §5 ou o `mapa.ts`, e não cabe em poucas linhas: TODO.md, para o Arquiteto decidir antes da 5.0 |
| conformidade-reviewer (1ª) | Títulos de `it` e `describe` com `@SemEscopo`, `RegistroDeAuditoria`, `type Banco` nas fixtures de alias (`arquitetura.test.ts` 178, 179, 316, 415, 512, 1342, 1348; 346, 428, 527; `porta-unica.test.ts` 69 e 129) | O RF7 pede os mesmos casos, e o `conferir` compara pelo título: TODO.md, para a onda que libera os títulos |
| tenancy-guardian (1ª), privacy-guardian (1ª) | `sem-escopo.decorator.ts:18` e o `toThrow` de `sem-escopo.decorator.test.ts:17-18` ainda dizem "@SemEscopo exige justificativa escrita"; os motivos de `REPOSITORIES_SEM_ESCOPO` (`escopo-dos-repositories.ts`, 80 a 100) ainda citam `exigirEscolaDoContexto`, `contextoAtual()`, `escopoDoJobNoContexto`; `camadas.cjs:148` e `:162`; títulos de `logger.test.ts` e `guardas.test.ts` | Mudam texto que um teste lê (o `toThrow`), o que o mapa registra como `fica`: TODO.md, com a mensagem e o teste trocados juntos |
| infra-guardian (1ª) | O campo `tipo` do log de erro muda de valor (`ErroDoProvedor` passa a `ProviderError`); avisar quem consulta o Loki à mão | Aviso operacional, sem código: `docs/runbook.md`, na retrospectiva da funcionalidade |
| infra-guardian (1ª) | `carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` carregam o `dist` do core: rodar o build antes do próximo ensaio | Aviso para o próximo ensaio de carga e de alertas: TODO.md |
| infra-guardian (1ª) | `expurgo-da-carga.ts:85`, `PRIORIDADE_DO_LOTE = 3` é cópia de `QUEUE_PRIORITY` | Já existia antes da onda e não é nome: TODO.md |
| llm-integrator (1ª) | Nomes mistos (`adaptador-roteirizado.ts` guardando `ScriptedAdapter`; `AgenteExecutor`/`InProcessAgenteExecutor`) | Arquivo é da 5.0; o nome do executor foi registrado pela própria 4.0: só para a retrospectiva |
| revisor-geral (1ª) | O diagrama em ASCII de `docs/arquitetura.md` perdeu o alinhamento | Não há diagrama desalinhado lá: o da linha `AllExceptionsFilter` é o de `docs/guia-do-desenvolvedor.md`, linhas 105 a 116, e foi alinhado nesta rodada |
| test-engineer (2ª) | `tools/ci/borda.test.ts:95` (`DEFAULT_RETRY_AFTER_SECONDS`) fica sem bloco de mutação, só com a justificativa escrita; um bloco que devolve `TENTE_DE_NOVO_PADRAO_SEGUNDOS` à regex do teste custaria uma linha | A justificativa escrita basta para a 4.0 (falha alto pelo `toBeDefined()`); bloco opcional: retrospectiva da funcionalidade |
| revisor-geral (2ª) | O comentário reescrito no topo de `tools/processo/harness/revisores.test.ts` (linha 7) ficou muito mais longo que as linhas vizinhas; quebrar na mesma largura | Só formatação de comentário, e aplicar caducaria o `revisor-geral` de novo: TODO.md |
| revisor-geral (2ª) | Passar para o `TODO.md` os títulos de `it` com `@SemEscopo`, a mensagem de `sem-escopo.decorator.ts:18` com o `toThrow`, e `camadas.cjs:148` e `:162` | Já estão na tabela "Recomendações sem aplicar" do documento, com destino TODO.md: a 4.0 só precisa copiá-las para o `TODO.md` |
| conformidade-reviewer (2ª) | O mapa aponta para linha do `travas.md`, e linha quebra a cada edição (+1 em todas na 4.0) | Mesma linha da recomendação do `revisor-geral` (1ª) sobre o formato do mapa: TODO.md, para o Arquiteto decidir antes da 5.0 |
| llm-integrator (2ª) | Títulos de teste e mensagem de erro que ainda dizem `@Permite` (`apps/api/test/permissao-no-boot.test.ts:67`, `:75`, `:82`; `conferencia-das-permissoes.ts:67`) | Mensagem que um teste lê, registrada como `fica`: TODO.md, com a mensagem e o teste trocados juntos |
| infra-guardian (2ª) | Falta cumprir: aviso no `docs/runbook.md` de que o `tipo` do log muda de `ErroDoProvedor` para `ProviderError`, e o build do `dist` do core antes do próximo ensaio de carga e de alertas | Já têm destino na tabela do documento (runbook na retrospectiva; ensaio no TODO.md) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 19:17:07 | 2026-10-30 19:19:07 | `llm-integrator` | 1 | APROVADO | ab9185dd304a2340e |
| 2026-10-30 19:16:59 | 2026-10-30 19:19:48 | `conformidade-reviewer` | 1 | APROVADO | ae97e4d7166acf6cf |
| 2026-10-30 19:16:52 | 2026-10-30 19:20:47 | `tenancy-guardian` | 1 | APROVADO | ac1855796a9c7c6fd |
| 2026-10-30 19:17:03 | 2026-10-30 19:20:51 | `infra-guardian` | 1 | APROVADO | a8fff612620428285 |
| 2026-10-30 19:16:55 | 2026-10-30 19:21:03 | `privacy-guardian` | 1 | APROVADO | a4069b34b09ab0595 |
| 2026-10-30 19:17:11 | 2026-10-30 19:21:35 | `test-engineer` | 1 | REPROVADO | a679587dc653f7623 |
| 2026-10-30 19:17:14 | 2026-10-30 19:23:20 | `revisor-geral` | 1 | REPROVADO | a7ebee9646d76e817 |
| 2026-10-30 19:46:03 | 2026-10-30 19:46:37 | `tenancy-guardian` | 2 | APROVADO | a17bd09b58f81033c |
| 2026-10-30 19:46:18 | 2026-10-30 19:46:43 | `infra-guardian` | 2 | APROVADO | a585f61bd5c04481b |
| 2026-10-30 19:46:22 | 2026-10-30 19:46:46 | `llm-integrator` | 2 | APROVADO | aaae6b9dbd42ad703 |
| 2026-10-30 19:46:13 | 2026-10-30 19:46:46 | `conformidade-reviewer` | 2 | APROVADO | a0b3c5d12b3272015 |
| 2026-10-30 19:46:08 | 2026-10-30 19:46:54 | `privacy-guardian` | 2 | APROVADO | a6c851887d4cf0510 |
| 2026-10-30 19:45:50 | 2026-10-30 19:47:03 | `test-engineer` | 2 | APROVADO | aec54e5d5a6ed4bd0 |
| 2026-10-30 19:45:58 | 2026-10-30 19:47:15 | `revisor-geral` | 2 | APROVADO | a3ff41734f228157c |
