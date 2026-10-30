import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { ARQUIVOS_DE_TESTE, configuracaoDasGuardas } from './tools/guardas/index.mjs'

// A entrada do controller (D81): o que cada seletor reprova. `@Req()` fica fora desta lista, num objeto à parte, porque
// `sessao/` e `operacao/` o recuperam (o cookie e o IP só se leem da requisição).
const SELETORES_DA_ENTRADA = [
  {
    selector: "Decorator > CallExpression[callee.name=/^(Body|Query|Param)$/][arguments.length=0]",
    message: 'Entrada sem pipe: use @Body(new ZodValidationPipe(esquema)), @Query(new ZodValidationPipe(esquema)) ou @Param(\'id\', IdPipe).',
  },
  {
    selector: "Decorator > CallExpression[callee.name=/^(Body|Query|Param)$/][arguments.length=1] > Literal.arguments",
    message: 'Parâmetro de caminho ou de consulta sem pipe: use @Param(\'id\', IdPipe) ou @Query(\'nome\', new ZodValidationPipe(esquema)).',
  },
  {
    selector: "MemberExpression[object.name='requisicao'][property.name=/^(body|query|params)$/]",
    message: 'A entrada não se lê da requisição: use @Body, @Query e @Param com o pipe.',
  },
]

const SELETOR_DA_REQUISICAO = {
  selector: "Decorator > CallExpression[callee.name=/^(Req|Request)$/]",
  message: 'A entrada não se lê da requisição: use @Body, @Query e @Param com o pipe.',
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'playwright-report/**',
      'test-results/**',
      // Violações de propósito: o teste das guardas as passa pelo ESLint com um caminho simulado.
      'tools/guardas/__fixtures__/**',
      // Protótipo só de front-end, com projeto e lint próprios (mockups/LEIAME.md); não é código do produto.
      'mockups/**',
      // Checkouts inteiros do repositório, os de subagente: cada um tem o seu lint, na árvore dele.
      '.claude/worktrees/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    // Nest injeta dependência pelo tipo do construtor: o import precisa ser de valor.
    files: ['apps/api/**/*.ts', 'apps/realtime/**/*.ts', 'apps/despachante/**/*.ts', 'apps/worker/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Os processadores do worker montam o registro de cada job (os totais do expurgo, A0b, tarefa 9.0) como objeto
    // literal com o tipo declarado: `{} as Record<…>` esconderia do compilador a chave que faltasse, e um
    // `Partial<…>` preenchido no laço e afirmado no fim (`t as Record<…>`) também. Por isso nenhuma afirmação de tipo
    // (`as const` continua valendo).
    files: ['apps/worker/src/processadores/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    // A entrada HTTP passa pelo pipe no parâmetro (D81; NestJS, "Pipes" › Object schema validation): `@Body(new
    // ZodValidationPipe(esquema))`, `@Query(new ZodValidationPipe(esquema))` e `@Param('id', IdPipe)`. Parâmetro sem pipe
    // entrega ao service o que o cliente mandou, e `@Req()` e `requisicao.body|query|params` leem a entrada por fora dele.
    // Vale em todo `apps/api/src/**/*.controller.ts` (17.0): o `files` cresceu por tarefa até aqui (14.0: os cinco primeiros
    // módulos; 15.0: estrutura, sala e governança; 16.0: sessão e operação), e controller de módulo novo já nasce barrado.
    // `no-restricted-syntax` está em `REGRAS_DAS_GUARDAS`:
    // o `eslint-disable` dele não fura a segunda passada do `npm run lint`. O `@UploadedFile()` não é barrado: os campos
    // ao lado dele passam pelo pipe.
    files: ['apps/api/src/**/*.controller.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SELETORES_DA_ENTRADA, SELETOR_DA_REQUISICAO],
    },
  },
  {
    // O `@Req()` volta a `sessao/` e `operacao/` (16.0), logo depois do bloco acima, que ele vence por vir depois: o cookie
    // (`educa_sessao`, `educa_dispositivo`, `turmma_operacao`), o `Authorization` do desafio e o IP (`requestIp`)
    // só existem na requisição (e a `retorno` do login externo lê a URL de volta do OIDC em `requisicao.url`, que os seletores
    // não barram, para entregá-la ao `openid-client`), e o corpo, a consulta e o caminho continuam barrados pelos três seletores que sobram.
    files: ['apps/api/src/{sessao,operacao}/**/*.controller.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SELETORES_DA_ENTRADA],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // O kit visual (`componentes/ui/`) não conhece a API, as telas nem a sessão (D81, R56; `onda-2.md`, "Onde moram"): o
    // que ele recebe vem por prop, e quem fala com o servidor é a tela. O `no-restricted-imports` do ESLint core vale para
    // `import`, `import type` e `export … from`; o `import()` é o seletor, porque o core não o vê. As duas regras estão em
    // `REGRAS_DO_KIT` e `REGRAS_DE_ENTRADA` (`tools/guardas/index.mjs`, uma para cada): o `eslint-disable` delas não fura a
    // segunda passada do `npm run lint`.
    // É o `no-restricted-imports` do core, e não o `@typescript-eslint/no-restricted-imports` do bloco das guardas, que é
    // o último e seria sobrescrito por este.
    files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^|/)api(/|$)', message: 'O kit visual não importa a API: o dado chega por prop, e quem busca é a tela.' },
            { regex: '(^|/)areas(/|$)', message: 'O kit visual não importa tela: a dependência vai das áreas para o kit, nunca o contrário.' },
            { regex: '(^|/)sessao(/|$)', message: 'O kit visual não importa a sessão: o que ele precisa dela chega por prop.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // O `/` do caminho entra como `\x2f`: o esquery não aceita `/` dentro do literal de expressão regular.
          selector: 'ImportExpression[source.value=/(^|\\x2f)(api|areas|sessao)(\\x2f|$)/]',
          message: 'O kit visual não importa a API, as telas nem a sessão, também por `import()`.',
        },
      ],
    },
  },
  {
    // O cenário de carga roda no runtime do k6, que dá `__ENV` e `open` ao script (infra/k6).
    files: ['infra/k6/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', open: 'readonly' } },
  },
  {
    // Tamanho com catraca (X5, 13.0; R37): função nova acima de 10 de complexidade, 80 linhas de código (sem branco nem
    // comentário) ou aninhamento acima de 4 reprova. O que já passava disso em 22/10/2026 está em `eslint-suppressions.json`, que só
    // encolhe: quem corta uma função roda `eslint . --prune-suppressions` na mesma tarefa, e `tools/guardas/catraca.test.ts`
    // recusa supressão nova. As quatro regras estão em `REGRAS_DE_TAMANHO` (`tools/guardas/index.mjs`): o `eslint-disable`
    // delas não fura a segunda passada do `npm run lint`.
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    rules: {
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
    },
  },
  {
    // Teste: o `describe` e o `it` são funções de centenas de linhas por desenho (R39), então só o comprimento da função sai;
    // a complexidade e o aninhamento valem. O e2e ganha o teto do arquivo, porque um spec de mil linhas esconde o que prova.
    files: [...ARQUIVOS_DE_TESTE, '**/test/**/*.ts', 'e2e/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    files: ['e2e/**/*.spec.ts'],
    rules: { 'max-lines': ['error', 800] },
  },
  // Por último: nenhum bloco acima sobrescreve as guardas (tools/guardas).
  ...configuracaoDasGuardas,
)
