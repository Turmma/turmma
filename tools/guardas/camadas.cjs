// A guarda de camadas e de ciclos (X5, 12.0; RF10). Roda no `npm run lint` pelo `guarda:camadas`:
//   depcruise --config tools/guardas/camadas.cjs apps packages tools infra e2e
// As cinco pastas são as da varredura que o `apps/api/test/architecture.test.ts` fazia à mão. Toda regra é `error`:
// uma em `warn` sairia com código 0 e o lint passaria calado (`camadas.test.ts` confere).
//
// As cercas do tenant são por import direto (R63), sem `reaches`: a regra olha quem importa o **arquivo** da classe. Dois
// reexports ela não vê, e cada um tem o seu teste. O do barril que a zona permite (`sessao/index.ts`, `credencial/index.ts`)
// é conferido em execução pelos `it` dos barris do `architecture.test.ts`. O feito de dentro da zona (uma ponte em `sessao/`,
// em `ciclo-de-vida/` ou o `export` do `painel.service.ts`) deixa qualquer arquivo usar a classe por outro caminho, e é o
// teste `architecture.test.ts › o nome das classes cercadas…` que o pega, pelo nome da classe, em apps, packages, tools e infra.
// Teste fica de fora das três cercas, como mudança aceita.

/** Teste e apoio de teste: `*.test.ts(x)`, `*.spec.ts`, pasta `test/`, `__fixtures__/` e o e2e. */
const TESTE = String.raw`(?:\.(?:test|spec)\.tsx?$|(?:^|/)test/|(?:^|/)__fixtures__/|^e2e/)`

const API = '^apps/api/src/'
const SESSAO = `${API}sessao/`
const CREDENCIAL = `${API}credencial/`
/** Onde as cercas olham: `e2e/` é teste, e teste fica de fora delas. */
const TODO_O_CODIGO = '^(?:apps|packages|tools|infra)/'

/** O código de produção das pastas de código (`apps/*` e `packages/*`), sem teste. */
const PRODUCAO = { path: '^(?:apps|packages)/[^/]+/src/', pathNot: TESTE }
const DRIZZLE = String.raw`(?:^|/)node_modules/drizzle-orm(?:/|$)`

/** O subcaminho `@educa/core/conta-global` resolve para este arquivo pela condição `source` (`conditionNames`, abaixo). */
const CONTA_GLOBAL = String.raw`^packages/core/src/ciclo-de-vida/conta-global\.repository\.ts$`

/**
 * Fora de `credencial/` e de `sessao/` (a primeira é a base da segunda), só se importa uma e outra pelo `index.ts`, em
 * `apps/api/src` e `apps/api/test` (onda 2, "As travas"). `e2e/`, `infra/`, `tools/` e `apps/worker` ficam de fora.
 */
function soPeloIndex(nome, pasta, motivo, tambemPermitidos = []) {
  return {
    name: `${nome}-so-pelo-index`,
    comment: motivo,
    severity: 'error',
    from: { path: '^apps/api/(?:src|test)/', pathNot: [SESSAO, CREDENCIAL, ...tambemPermitidos.map((arquivo) => `^${arquivo}$`)] },
    to: { path: `^${pasta}`, pathNot: `^${pasta}index\\.ts$` },
  }
}

module.exports = {
  forbidden: [
    {
      name: 'sem-ciclo',
      comment: 'Ciclo de import, contando o que só é tipo. Desfaça-o levando o que as duas pontas usam para um terceiro arquivo, e não escondendo o import atrás de um reexport.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    // A direção dos pacotes.
    {
      name: 'shared-nao-importa-nucleo-nem-app',
      comment: 'O contrato compartilhado é a base: nem o nucleo nem uma app podem entrar nele.',
      severity: 'error',
      from: { path: '^packages/shared/' },
      to: { path: '^(?:packages/core|apps)/' },
    },
    {
      name: 'nucleo-nao-importa-app',
      comment: 'O nucleo serve as apps; a app não volta para dentro dele.',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^apps/' },
    },
    {
      name: 'app-nao-importa-app',
      comment: 'Uma app não importa outra (regra 00, item 1). Entre `test/` passa, até os helpers irem para `tools/testes/` (31.0).',
      severity: 'error',
      from: { path: '^apps/([^/]+)/', pathNot: TESTE },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'web-nao-importa-nucleo-nem-backend',
      comment: 'A web fala com a API por HTTP e pelo contrato de `@educa/shared` (regra 00, itens 1 e 6).',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^(?:packages/core/|apps/(?!web/))' },
    },
    {
      name: 'producao-nao-importa-teste',
      comment: 'O que vai para a imagem não carrega teste, fixture nem apoio de e2e.',
      severity: 'error',
      from: PRODUCAO,
      to: { path: TESTE },
    },

    // As camadas da API (regra 00, itens 2 e 3).
    {
      name: 'controller-nao-importa-repository',
      comment: 'O controller valida a entrada e chama o service; o banco é do repository.',
      severity: 'error',
      from: { path: `${API}.*\\.controller\\.ts$` },
      to: { path: '\\.repository\\.ts$' },
    },
    {
      name: 'controller-nao-importa-drizzle',
      comment: 'Query no controller foge do escopo de tenant do repository (regra 10, item 3).',
      severity: 'error',
      from: { path: `${API}.*\\.controller\\.ts$` },
      to: { path: DRIZZLE },
    },
    {
      name: 'service-nao-importa-drizzle',
      comment: 'Query solta no service é como o isolamento acaba furado (regra 00, item 3).',
      severity: 'error',
      from: { path: `${API}.*\\.service\\.ts$` },
      to: { path: DRIZZLE },
    },
    {
      name: 'repository-nao-importa-service-nem-controller',
      comment: 'A camada de baixo não conhece a de cima. A exceção é um arquivo, e não a pasta: o expurgo da escola enfileira a eliminação pelo `CicloDeVidaService`.',
      severity: 'error',
      from: {
        path: '^(?:apps/api/src|packages/core/src)/.*\\.repository\\.ts$',
        pathNot: '^packages/core/src/retencao/expurgo-da-escola\\.repository\\.ts$',
      },
      to: { path: '\\.(?:service|controller)\\.ts$' },
    },

    // Os módulos da API.
    {
      name: 'sessao-nao-importa-operacao',
      comment: 'A sessão da escola não depende da operação da equipe (10.0): o que as duas usam mora em `sessao/`.',
      severity: 'error',
      from: { path: SESSAO },
      to: { path: `${API}operacao/` },
    },
    {
      name: 'api-nao-importa-ops',
      comment: '`ops/` só tem comando de terminal (35.0). O caso de uso que uma rota também chama mora no módulo dela.',
      severity: 'error',
      from: { path: API, pathNot: [`${API}ops/`, TESTE] },
      to: { path: `${API}ops/` },
    },
    soPeloIndex('sessao', 'apps/api/src/sessao/', 'Fora de `sessao/`, só se importa pelo `index.ts`: ele escolhe o que a API usa (34.0).', [
      'apps/api/test/architecture.test.ts',
    ]),
    soPeloIndex('credencial', 'apps/api/src/credencial/', 'Fora de `credencial/`, só se importa pelo `index.ts` (33.0). O arquivo da exceção é carregado pelo e2e, que roda o `.ts` sem compilar, e o `index.ts` arrasta a `credencial/` inteira.', [
      'apps/api/src/operacao/token-do-convite.ts',
    ]),

    // As três cercas de tenant (regra 10, item 9), por import direto (R63).
    {
      name: 'cerca-resolucao-de-tenant',
      comment: 'A `ResolucaoDeTenantRepository` concentra os `@SemEscopo` da resolução de tenant e fica dentro de `sessao/` (Tech Spec, seção 6).',
      severity: 'error',
      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, TESTE] },
      to: { path: `${SESSAO}tenant/tenant-resolution\\.repository\\.ts$` },
    },
    {
      name: 'cerca-conta-global',
      comment: 'A `ContaGlobalRepository` escreve na `Conta`, que não tem escola: só `sessao/` e o ciclo de vida do nucleo a importam (F3, 1.0).',
      severity: 'error',
      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/core/src/ciclo-de-vida/', TESTE] },
      to: { path: CONTA_GLOBAL },
    },
    {
      name: 'cerca-painel-repository',
      comment: 'O `PainelRepository` lê entre escolas, com três `@SemEscopo`: só o `painel.service.ts` o usa (I1, A0b).',
      severity: 'error',
      from: { path: TODO_O_CODIGO, pathNot: ['^apps/api/src/operacao/painel/painel\\.service\\.ts$', TESTE] },
      to: { path: '^apps/api/src/operacao/painel/painel\\.repository\\.ts$' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    // Absoluto, para a guarda rodar em qualquer pasta: o teste a roda sobre cópias das fixtures.
    tsConfig: { fileName: `${__dirname}/../../tsconfig.base.json` },
    // Pacote de terceiro entra no grafo como destino, mas o cruiser não segue o que há dentro dele: os ciclos de `zod`, `pg` e `ioredis` não são nossos.
    doNotFollow: { path: 'node_modules' },
    exclude: { path: String.raw`(?:^|/)(?:dist|__fixtures__/camadas)/` },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['source', 'import'],
    },
  },
}
