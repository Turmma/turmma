/**
 * A lista da guarda `guardas/nome-de-mercado` (X8, 12.0; RF8; D81): o nome técnico em português que não pode nascer de
 * novo, o tipo de declaração em que cada forma vale e o nome de mercado que a mensagem sugere. A gramática, o limite
 * declarado e os casos estão em `tasks/prd-nomes-de-mercado/guarda.md`.
 *
 * Cada linha tem a `forma`, o modo de casar (`exato`, `prefixo` ou `sufixo`), os `tipos` de declaração de topo em que
 * vale e o `mercado`: os nomes sugeridos, com `{X}` para o que sobra do nome depois de tirar a forma e `{x}` para o
 * mesmo resto com a primeira letra minúscula. O prefixo só casa quando a letra seguinte é maiúscula (`Erro` não casa
 * `Erros`), e `onde` limita a linha a um caminho do repositório.
 */

/** Os tipos de declaração de topo que a regra lê. */
const TIPOS = ['classe', 'interface', 'tipo', 'const', 'funcao', 'enum']

const EM_QUALQUER_DECLARACAO = TIPOS
const EM_CLASSE = ['classe']
const EM_INTERFACE_E_TIPO = ['interface', 'tipo']
const EM_CONST_E_FUNCAO = ['const', 'funcao']

/** O kit visual da web (RF5): o nome exato, em qualquer declaração. */
const NOMES_DO_KIT = [
  ['Botao', 'Button'],
  ['Cartao', 'Card'],
  ['Dialogo', 'Dialog'],
  ['Abas', 'Tabs'],
  ['Tabela', 'Table'],
  ['Tela', 'Page'],
]

/** @typedef {{ forma: string, casa: 'exato' | 'prefixo' | 'sufixo', tipos: string[], mercado: string[], onde?: RegExp }} Forma */

/** @type {Forma[]} */
export const FORMAS = [
  ...NOMES_DO_KIT.map(([forma, mercado]) => ({ forma, casa: 'exato', tipos: EM_QUALQUER_DECLARACAO, mercado: [mercado] })),

  { forma: 'Adaptador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Adapter'] },
  { forma: 'Guarda', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Guard'] },
  { forma: 'Filtro', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Filter'] },
  { forma: 'Interceptor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Interceptor'] },
  { forma: 'Erro', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Exception', '{X}Error'] },
  { forma: 'Falha', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Exception', '{X}Error'] },
  { forma: 'Emissor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Issuer'] },
  { forma: 'Armazem', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}FileStorage'] },
  { forma: 'Medicao', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Gauge'] },
  { forma: 'Bancada', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Fixtures'] },
  { forma: 'AgendadorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
  { forma: 'Agendador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
  { forma: 'Processador', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobProcessor'] },
  { forma: 'ProcessadorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
  { forma: 'Processador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
  { forma: 'ExecutorDeJobs', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobExecutor'] },
  { forma: 'ExecutorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },
  { forma: 'Executor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },

  { forma: 'EmMemoria', casa: 'sufixo', tipos: ['classe', 'interface', 'tipo'], mercado: ['InMemory{X}'] },

  { forma: 'Linha', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Row'] },
  { forma: 'Opcoes', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Options'] },
  { forma: 'Dependencias', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Dependencies'] },
  { forma: 'Configuracao', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Config'] },

  { forma: 'esquema', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}Schema'] },
  { forma: 'lerConfiguracao', casa: 'exato', tipos: EM_CONST_E_FUNCAO, mercado: ['loadConfig'] },
  { forma: 'lerConfiguracao', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['load{X}Config'] },
  { forma: 'consulta', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}QueryOptions'], onde: /^apps\/web\// },

  // A constante de chave: a de metadado do Nest (`SetMetadata`) em qualquer lugar; a do TanStack Query só na web, porque
  // `CHAVE_DA_TRAVA_*`, `CHAVE_V1` e afins são chave de lock, de cifra e de teste nos apps e nos pacotes.
  { forma: 'METADADO_', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_KEY'] },
  { forma: 'CHAVE_', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_QUERY_KEY'], onde: /^apps\/web\// },

  // A pasta das tarefas de IA se chama `tasks/` desde a 5.0 (`ia/tarefas/` → `ia/tasks/`).
  ...['EntradaDe', 'EntradaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Input'], onde: /(?:^|\/)ia\/tasks\// })),
  ...['SaidaDe', 'SaidaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Output'], onde: /(?:^|\/)ia\/tasks\// })),
]

/**
 * O segmento de arquivo e de pasta (sem a extensão, que começa no primeiro ponto): `adaptador-*`, `guarda-*`,
 * `*-em-memoria`, `*-de-teste`. Vale em todo o escopo da guarda; `mercado` é o que a mensagem sugere.
 */
export const SEGMENTOS = [
  { padrao: /^adaptador-(.+)/, mercado: '{x}-adapter' },
  { padrao: /^guarda-(.+)/, mercado: '{x}.guard' },
  { padrao: /^(.+)-em-memoria$/, mercado: 'in-memory-{x}' },
  { padrao: /^(.+)-de-teste$/, mercado: '{x}.fixture' },
]

/** A pasta que é domínio nos apps ("fila", "limite") e por isso só é técnica em `packages/`. */
export const PASTAS_SO_EM_PACKAGES = [
  { pasta: 'fila', mercado: 'queue' },
  { pasta: 'limite', mercado: 'rate-limit' },
]

/**
 * A exceção nominal: o nome que a gramática pegaria e que é outra coisa, cada um com o arquivo e o motivo. Exceção nova
 * se discute na revisão. Um teste confere que o arquivo existe e que cita o nome.
 */
export const EXCECOES_NOMINAIS = [
  {
    arquivo: 'e2e/aparencia.spec.ts',
    nome: 'esquemaDeCor',
    motivo: 'É o esquema de cor da tela (`prefers-color-scheme`, o `color-scheme` do navegador), e não um schema zod.',
  },
  {
    arquivo: 'apps/web/src/__fixtures__/danger-solid.ts',
    nome: 'CHAVE_CHEIO_NAS_CLASSES',
    motivo: 'É a chave `cheio` de um objeto, procurada por expressão regular no código da tela, e não uma chave do TanStack Query.',
  },
]
