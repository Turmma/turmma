import { defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

// `.claude/worktrees/` guarda checkouts inteiros do repositório (os de subagente): sem isto, cada teste rodaria de novo
// para cada worktree aberto, com o código de outra árvore.
// `tools/guardas/__fixtures__/` tem árvores de arquivo que só a guarda de camadas lê, uma delas com o nome `architecture.test.ts` (a exceção da regra do `index.ts` é por nome).
const ignorados = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'tools/ci/fixtures/**', 'tools/guardas/__fixtures__/**', 'mockups/**', '.claude/worktrees/**']

// Os de `infra/` provam a borda, as métricas, os alertas e os jobs contra o compose inteiro, e esperam o
// relógio real (o `for:` de 5 min do alerta, a sonda da borda, a exportação de métricas): uns 16 min dos
// ~21 da integração. Ficam num projeto próprio (D52): o portão da tarefa roda quando ela mexe em infra, e a
// esteira roda sempre.
const integracaoDeInfra = 'infra/**/*.int.test.ts'
// Os de `tools/processo/` provam o git hook contra um git de verdade, num repositório temporário: não tocam banco, Redis nem
// storage, e por isso não levam o `globalSetup` do compose (que custa uns 2 min só para subir). Projeto próprio: o portão da
// tarefa o roda quando `tools/processo/` muda (`alvosDoPortao`) e a esteira roda sempre, no job que não sobe compose.
const integracaoDoProcesso = 'tools/processo/**/*.int.test.ts'
const integracao = {
  exclude: ignorados,
  globalSetup: ['tools/testes/integracao.setup.ts'],
  // Os testes param e religam serviços do compose: um arquivo por vez.
  fileParallelism: false,
  testTimeout: 60_000,
  hookTimeout: 180_000,
}

// Pacotes do monorepo resolvem para `src` nos testes, sem depender de `dist` construído antes. Sem a
// condição `module` do Vite: o Node do container não a usa, e com ela o teste carregaria outra build da
// dependência (a `dist-es` do SDK S3, que o Node nem consegue importar) que não a de produção.
const condicoes = ['source', ...defaultServerConditions.filter((condicao) => condicao !== 'module')]

// O `globalSetup` da integração e da infra roda no runner do Vitest, que resolve pelo environment `__vitest__`, e o Vitest 5
// dá a ele as condições padrão, sem herdar `resolve` nem `ssr.resolve` do topo. Sem a condição `source` ali, o `globalSetup`
// que carrega `packages/core` resolve `@educa/shared` para o `dist`, que só existe onde alguém construiu (a esteira não
// constrói). `tools/ci/resolucao-do-shared.test.ts` prova a resolução.
export default defineConfig({
  resolve: { conditions: condicoes },
  ssr: { resolve: { conditions: condicoes } },
  environments: { __vitest__: { resolve: { conditions: condicoes } } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unidade',
          // Longe do -03 da escola e do UTC da esteira: o teste que lê o dia ou a hora do computador, em vez de declarar o
          // fuso (`America/Sao_Paulo`, ou meio-dia de UTC), fica vermelho na primeira corrida, e não só depois das 21 h ou
          // na máquina de outra pessoa. Quem prova o fuso de São Paulo o declara no próprio teste. A integração e o e2e
          // herdam o do computador, e o Postgres de teste declara o dele (`POSTGRES_FUSO`).
          env: { TZ: 'Asia/Tokyo' },
          // `.test.tsx` é o teste de componente da web: renderiza a peça no `jsdom` com a `testing-library`, e o arquivo
          // pede o ambiente na primeira linha (`// @vitest-environment jsdom`). O ambiente é do arquivo, e não do projeto, para
          // a unidade da API, do worker e dos pacotes continuar no Node, sem pagar o `jsdom`. Arquivo sem a linha cai no
          // `document is not defined`, e não passa calado. Roda no mesmo projeto que o resto da unidade, e por isso o portão
          // da tarefa, a esteira e as mutações (`tipoDoTeste`) já o alcançam, sem suíte nova.
          include: ['**/*.test.{ts,tsx}'],
          exclude: [...ignorados, '**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...integracao,
          name: 'integracao',
          include: ['**/*.int.test.ts'],
          exclude: [...ignorados, integracaoDeInfra, integracaoDoProcesso],
        },
      },
      {
        extends: true,
        test: {
          ...integracao,
          name: 'infra',
          include: [integracaoDeInfra],
        },
      },
      {
        extends: true,
        test: {
          name: 'processo',
          include: [integracaoDoProcesso],
          exclude: ignorados,
          // Cada caso faz commits e pushes de verdade, cada um com um `node` que carrega o hook: com a máquina carregada
          // passa dos 5 s do padrão.
          testTimeout: 60_000,
        },
      },
    ],
  },
})
