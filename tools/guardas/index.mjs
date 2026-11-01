import comentarios from '@eslint-community/eslint-plugin-eslint-comments'
import { erroTipado } from './regras-erro.mjs'
import { logSemConteudoMontado, logSemDadoPessoal } from './regras-log.mjs'
import { nomeDeMercado } from './regras-nome.mjs'
import { MENSAGEM_SDK_DE_IA, PASTA_DOS_ADAPTADORES, REGEX_SDK_DE_IA, sdkDeIaSoNoAdaptador } from './regras-ia.mjs'
import { esperarServicoDoCompose, testeSemDesligar } from './regras-teste.mjs'
import { tabelaSoNoRepository } from './regras-tenant.mjs'

/**
 * Guardas da esteira (RF11): o que as regras 20 e 30 proíbem reprova no lint, sem depender de
 * revisão humana. Entram por último no `eslint.config.mjs`, para nenhum bloco posterior as
 * sobrescrever, e não podem ser desligadas por comentário.
 */
export const guardas = {
  meta: { name: 'guardas' },
  rules: {
    'log-sem-dado-pessoal': logSemDadoPessoal,
    'log-sem-conteudo-montado': logSemConteudoMontado,
    'sdk-de-ia-so-no-adaptador': sdkDeIaSoNoAdaptador,
    'esperar-servico-do-compose': esperarServicoDoCompose,
    'teste-sem-desligar': testeSemDesligar,
    'tabela-so-no-repository': tabelaSoNoRepository,
    'erro-tipado': erroTipado,
    'nome-de-mercado': nomeDeMercado,
  },
}

export const REGRAS_DE_LOG = ['guardas/log-sem-dado-pessoal', 'guardas/log-sem-conteudo-montado']
export const REGRAS_DE_SDK_DE_IA = ['@typescript-eslint/no-restricted-imports', 'guardas/sdk-de-ia-so-no-adaptador']
/** A tabela do schema só aparece no repository, onde o escopo de tenant é aplicado (regra 00, item 3; regra 10, item 3). */
export const REGRAS_DE_TENANT = ['guardas/tabela-so-no-repository']
/** Guardas que valem em todo arquivo do repositório. */
export const REGRAS_EM_TODO_ARQUIVO = [...REGRAS_DE_LOG, ...REGRAS_DE_SDK_DE_IA, ...REGRAS_DE_TENANT]
/**
 * Em produção só se lança erro com tipo (X5, 25.0; regra 00, item 9): sem `Error` genérico nem literal, e o motivo do
 * `InvariantException` é texto fixo (regra 20, item 11). Vale em `src` de cada app e do núcleo; o teste e o `__fixtures__`
 * ficam de fora (`EXCECOES_DAS_GUARDAS`).
 */
export const REGRAS_DE_ERRO = ['guardas/erro-tipado']
export const ESCOPO_DO_ERRO_TIPADO = ['apps/*/src/**/*.{ts,tsx}', 'packages/core/src/**/*.{ts,tsx}']
/**
 * Em código novo não nasce o nome técnico em português que a X8 trocou pelo de mercado (RF8; D81): a declaração de topo, o
 * arquivo e a pasta. Vale em `apps`, `packages` e `e2e`; `tools/` fica de fora (o PRD não o renomeia). Entra na segunda
 * passada, sem comentários: o `eslint-disable` não a desliga.
 */
export const REGRAS_DE_NOME = ['guardas/nome-de-mercado']
export const ESCOPO_DO_NOME = [
  'apps/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
  'packages/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
  'e2e/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
]
export const REGRAS_DE_TESTE = ['guardas/esperar-servico-do-compose', 'guardas/teste-sem-desligar']
/**
 * O `no-restricted-syntax` do ESLint, com os seletores em `eslint.config.mjs`, serve a dois blocos: a entrada do
 * controller passa pelo pipe no parâmetro (D81), e o kit visual não importa `api/`, `areas/` nem `sessao/` por `import()`
 * (D81, R56). Tirá-lo desta lista devolve ao `eslint-disable` o poder de furar a segunda passada nos dois.
 */
export const REGRAS_DE_ENTRADA = ['no-restricted-syntax']
/**
 * Só em teste: a espera do serviço se justifica pelo orçamento do teste (cenário de carga derruba serviço de
 * propósito), e `.skip` fora de teste é só o nome de um método.
 */
export const ARQUIVOS_DE_TESTE = ['**/*.test.{ts,tsx}', 'e2e/**/*.spec.ts']
/**
 * O kit visual não importa `api/`, `areas/` nem `sessao/` (D81, R56): o `no-restricted-imports` do ESLint core, para
 * `import`, `import type` e `export … from`. O `import()` é do `no-restricted-syntax`, que está em `REGRAS_DE_ENTRADA`
 * (o mesmo seletor-regra serve ao controller e ao kit) e por isso não se repete aqui.
 */
export const REGRAS_DO_KIT = ['no-restricted-imports']
/**
 * O tamanho tem catraca (X5, 13.0; RF11, R37): complexidade 10, 80 linhas de código por função, aninhamento 4 e 800 linhas por
 * spec de e2e. Entram na segunda passada, com `applySuppressions`, para o `eslint-disable` não furar o limite e a linha de base
 * (`eslint-suppressions.json`) ser a única exceção.
 */
export const REGRAS_DE_TAMANHO = ['complexity', 'max-lines-per-function', 'max-depth', 'max-lines']
export const REGRAS_DAS_GUARDAS = [
  ...REGRAS_DE_LOG,
  ...REGRAS_DE_SDK_DE_IA,
  ...REGRAS_DE_TENANT,
  ...REGRAS_DE_ERRO,
  ...REGRAS_DE_NOME,
  ...REGRAS_DE_TESTE,
  ...REGRAS_DE_ENTRADA,
  ...REGRAS_DO_KIT,
  ...REGRAS_DE_TAMANHO,
]

const TODOS_OS_ARQUIVOS = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']

/**
 * Exceções fechadas, cada uma com o motivo. Um teste confere que a lista é exatamente esta:
 * exceção nova se discute na revisão, não entra em silêncio.
 */
export const EXCECOES_DAS_GUARDAS = [
  {
    // O adaptador é o único lugar onde o SDK do provedor existe (regra 30, item 1).
    files: [PASTA_DOS_ADAPTADORES],
    regras: REGRAS_DE_SDK_DE_IA,
  },
  {
    // A tabela é do repository, onde o escopo de tenant é aplicado a partir do token (regra 00, item 3; regra 10, item 3).
    files: ['**/*.repository.ts'],
    regras: REGRAS_DE_TENANT,
  },
  {
    // Teste monta e confere o estado direto na tabela; o código que ele prova é que não pode.
    files: ARQUIVOS_DE_TESTE,
    regras: REGRAS_DE_TENANT,
  },
  {
    // O schema e a camada do banco do núcleo são onde a tabela nasce.
    files: ['packages/core/src/db/**'],
    regras: REGRAS_DE_TENANT,
  },
  {
    // A guarda de tabela nomeia o pacote que procura: o texto `@educa/core` dela não carrega nada.
    files: ['tools/guardas/regras-tenant.mjs'],
    regras: REGRAS_DE_TENANT,
  },
  {
    // Teste e apoio de teste lançam o que o cenário pede: o `Error` com o caminho no texto ajuda quem depura o teste.
    files: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
    regras: REGRAS_DE_ERRO,
  },
  {
    // O ponto de entrada da web: o `#raiz` ausente do `index.html` quebra antes de qualquer tela, e não há erro de domínio.
    files: ['apps/web/src/main.tsx'],
    regras: REGRAS_DE_ERRO,
  },
  {
    // O teste do redact precisa entregar chave pessoal ao logger para provar que ela sai removida.
    files: ['packages/core/src/log/logger.test.ts'],
    regras: REGRAS_DE_LOG,
  },
  {
    // O NestLogger repassa ao logger a mensagem do Nest, depois de conferir que é evento fixo ou
    // do boot. Só a guarda de conteúdo montado sai; a de dado pessoal continua valendo aqui.
    files: ['packages/core/src/log/nest-logger.ts'],
    regras: ['guardas/log-sem-conteudo-montado'],
  },
]

export const configuracaoDasGuardas = [
  {
    files: TODOS_OS_ARQUIVOS,
    plugins: { guardas, '@eslint-community/eslint-comments': comentarios },
    rules: {
      'guardas/log-sem-dado-pessoal': 'error',
      'guardas/log-sem-conteudo-montado': 'error',
      'guardas/sdk-de-ia-so-no-adaptador': 'error',
      'guardas/tabela-so-no-repository': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [{ regex: REGEX_SDK_DE_IA, message: MENSAGEM_SDK_DE_IA }] },
      ],
      // Guarda desligada por comentário deixa de ser guarda (regra 40). Também reprova o
      // `eslint-disable` sem regra, que desligaria todas de uma vez. Um comentário ainda
      // conseguiria desligar esta própria regra, ou configurar a guarda com `/* eslint ... */`:
      // por isso `npm run lint` roda também `tools/guardas/lint.ts`, que ignora todo comentário.
      '@eslint-community/eslint-comments/no-restricted-disable': [
        'error',
        'guardas/*',
        '@typescript-eslint/no-restricted-imports',
      ],
    },
  },
  {
    files: ESCOPO_DO_ERRO_TIPADO,
    rules: Object.fromEntries(REGRAS_DE_ERRO.map((regra) => [regra, 'error'])),
  },
  {
    files: ESCOPO_DO_NOME,
    rules: Object.fromEntries(REGRAS_DE_NOME.map((regra) => [regra, 'error'])),
  },
  {
    files: ARQUIVOS_DE_TESTE,
    rules: Object.fromEntries(REGRAS_DE_TESTE.map((regra) => [regra, 'error'])),
  },
  ...EXCECOES_DAS_GUARDAS.map(({ files, regras }) => ({
    files,
    rules: Object.fromEntries(regras.map((regra) => [regra, 'off'])),
  })),
]
