// Quem é obrigatório num commit pelo caminho que ele altera (RF15, `techspec.md` §5(b)). A tabela legível, com o motivo de cada
// exceção, é `tasks/prd-harness/tabela-de-guardioes.md`; a fonte que vale é este arquivo, e o teste dele
// (`harness/guardioes.test.ts`) escreve os literais por extenso.
//
// O padrão são os quatro guardiões: todo arquivo de `apps/`, `packages/`, `e2e/`, `tools/guardas/` e `tools/testes/` pede
// `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer` e `infra-guardian`, testes e fixtures inclusive. Pasta nova
// nasce protegida. O que pede menos é exceção escrita abaixo, e a citação de uma regra no texto do arquivo soma o guardião dela.
//
// O RF16 (14.0) acrescenta o código de processo: `tools/`, `.github/`, `.claude/hooks/`, `.claude/settings*.json`, o corpus `ouro` e as
// configurações do portão. A tabela daqui não sabe se a sessão é de papel: o que depende do papel é o que conta como código
// (`decidirCommit`), e quem leva um desses arquivos num commit de tarefa ou de correção deve os guardiões da linha dele.
//
// Este módulo não importa nenhum outro: o `portao.ts` o usa em `decidirCommit`, e o `portao-local.ts` para imprimir a lista.

export const OS_QUATRO = ['tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian'] as const
export type Guardiao = (typeof OS_QUATRO)[number]

/** De onde se lê um arquivo: do HEAD ou do índice (o que vai para o commit). */
export type OndeLer = 'head' | 'indice'
/** O conteúdo de um arquivo em `onde`, ou `null` quando ele não existe lá. */
export type ConteudoDe = (arquivo: string, onde: OndeLer) => string | null

interface Entrada {
  /** O arquivo é desta entrada? Prefixo de caminho, sem glob, ou o padrão das duas famílias de nome da raiz. */
  casa: (arquivo: string) => boolean
  /** Vale a entrada de maior peso que casa: o tamanho do prefixo, e 1 para o padrão (nenhum prefixo de processo o sobrepõe). */
  peso: number
  guardioes: readonly Guardiao[]
}

const doPrefixo = (prefixo: string, guardioes: readonly Guardiao[]): Entrada => ({ casa: (arquivo) => arquivo.startsWith(prefixo), peso: prefixo.length, guardioes })
const doPadrao = (padrao: RegExp, guardioes: readonly Guardiao[]): Entrada => ({ casa: (arquivo) => padrao.test(arquivo), peso: 1, guardioes })

const [T, P, C, I] = OS_QUATRO

/** As pastas em que todo arquivo pede os quatro. */
const PADRAO: readonly Entrada[] = ['apps/', 'packages/', 'e2e/', 'tools/guardas/', 'tools/testes/'].map((prefixo) => doPrefixo(prefixo, OS_QUATRO))

/** As exceções do código, com o motivo de cada uma em `tabela-de-guardioes.md`. Uma entrada que não casa nenhum arquivo versionado deixa a esteira vermelha. */
export const EXCECOES_DO_CODIGO: readonly { prefixo: string; guardioes: readonly Guardiao[] }[] = [
  { prefixo: 'apps/web/src/components/ui/', guardioes: [C, I] },
  { prefixo: 'apps/web/src/components/ui/ai/', guardioes: [P, C, I] },
  { prefixo: 'apps/web/src/index.css', guardioes: [C] },
  { prefixo: 'apps/web/src/theme.ts', guardioes: [] },
  { prefixo: 'apps/web/src/estilos.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/theme.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/contraste.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/gallery/', guardioes: [P, C] },
  { prefixo: 'apps/web/vite.config.ts', guardioes: [I] },
  { prefixo: 'apps/web/chunk-names.ts', guardioes: [I] },
  { prefixo: 'apps/web/chunk-names.test.ts', guardioes: [I] },
  { prefixo: 'apps/web/downlevel-color.ts', guardioes: [I] },
  { prefixo: 'apps/web/downlevel-color.test.ts', guardioes: [I] },
  { prefixo: 'apps/despachante/', guardioes: [T, P, I] },
  { prefixo: 'infra/', guardioes: [I, P] },
]

/**
 * O código de processo (RF16), com o motivo de cada linha em `tabela-de-guardioes.md`. Os prefixos são os da tabela, e o conjunto de
 * cada um é o que `harness/guardioes.test.ts` escreve por extenso. As linhas sem guardião são o "resto" do §5(e): casam o arquivo
 * como código, para a citação de uma regra somar o guardião dela, e não pedem ninguém sem citação.
 */
export const REGRAS_DO_RF16: readonly { prefixo: string; guardioes: readonly Guardiao[] }[] = [
  // Aplicam ou provam a tabela e a lista de veto, ligam e suprimem as guardas: os quatro.
  ...[
    'tools/processo/guardioes-por-caminho.ts',
    'tools/processo/portao.ts',
    'tools/processo/caducidade.ts',
    'tools/processo/documento-de-revisao.ts',
    'tools/processo/revisoes.ts',
    'tools/processo/hook-revisoes.ts',
    'tools/processo/comando-git.ts',
    'tools/processo/hook-git.ts',
    'tools/processo/git-hooks/',
    'tools/processo/harness/guardioes.test.ts',
    'tools/ci/conferir-entregas.ts',
    'eslint.config.mjs',
    'eslint-suppressions.json',
  ].map((prefixo) => ({ prefixo, guardioes: OS_QUATRO })),
  { prefixo: 'tools/vitrine/', guardioes: [P, C] },
  { prefixo: 'tools/ia/', guardioes: [P, C] },
  { prefixo: 'docs/aia/ouro/', guardioes: [C] },
  { prefixo: 'docs/aia/ouro-retido/', guardioes: [C] },
  { prefixo: 'tools/ci/', guardioes: [I] },
  { prefixo: 'tools/ci/borda.test.ts', guardioes: [I, P] },
  { prefixo: '.github/', guardioes: [I, P] },
  { prefixo: 'playwright.config.ts', guardioes: [P] },
  { prefixo: 'compose.yaml', guardioes: [I] },
  { prefixo: '.env.example', guardioes: [I] },
]

/** O resto do §5(e): código de processo que não pede ninguém, salvo pela citação. Os nomes são os de `ARQUIVOS_DE_PROCESSO` e `PASTAS_DE_PROCESSO`, em `portao.ts`, e o teste da tabela os confere. */
export const RESTO_DO_PROCESSO: readonly string[] = [
  'tools/',
  '.claude/hooks/',
  'package.json',
  'vitest.config.ts',
  'knip.json',
  '.gitleaks.toml',
  '.size-limit.json',
]

const ENTRADAS: readonly Entrada[] = [
  ...PADRAO,
  ...EXCECOES_DO_CODIGO.map((excecao) => doPrefixo(excecao.prefixo, excecao.guardioes)),
  ...REGRAS_DO_RF16.map((regra) => doPrefixo(regra.prefixo, regra.guardioes)),
  doPadrao(/^\.claude\/settings[^/]*\.json$/, OS_QUATRO),
  doPadrao(/^tsconfig[^/]*\.json$/, []),
  ...RESTO_DO_PROCESSO.map((prefixo) => doPrefixo(prefixo, [])),
]

/** O sufixo de arquivo que toca dado de escola ou de pessoa: onde estiver, nunca cai em exceção e pede os quatro. */
const SUFIXOS_QUE_NUNCA_SAO_EXCECAO = ['.repository.ts', '.controller.ts', '.gateway.ts', '.service.ts']
const SEM_ESCOPO = '@Unscoped('

/**
 * A citação de uma regra soma o guardião dela. Sem diferença de maiúscula. A citação de uma das decisões do item M6 da retro da X7
 * (D45, D47, D55 a D59 e D64) soma o `conformidade-reviewer`, como a citação da regra 70; a regra 70 cita outras (D60, D66, D68, D70),
 * que não somam ainda. A decisão se escreve com o D maiúsculo, como nos documentos, e sem letra, dígito, `_` ou `#` antes, nem
 * letra, dígito ou `_` depois (hash e cor `#D45` não são decisão; D450 não é D45).
 */
const CITACOES: readonly { termo: RegExp; guardiao: Guardiao }[] = [
  { termo: /regra\s+10(?!\d)/i, guardiao: T },
  { termo: /regra\s+20(?!\d)/i, guardiao: P },
  { termo: /lgpd/i, guardiao: P },
  { termo: /regra\s+70(?!\d)/i, guardiao: C },
  { termo: /(?<![\w#])D(?:45|47|55|56|57|58|59|64)(?!\w)/, guardiao: C },
  { termo: /regra\s+80(?!\d)/i, guardiao: I },
]

/** A entrada de maior peso que casa o caminho (o prefixo mais longo), ou `undefined` quando o arquivo não é código. */
function entradaDe(arquivo: string): Entrada | undefined {
  return ENTRADAS.filter((entrada) => entrada.casa(arquivo)).sort((a, b) => b.peso - a.peso)[0]
}

function guardioesDoArquivo(arquivo: string, conteudoDe: ConteudoDe): Guardiao[] {
  const entrada = entradaDe(arquivo)
  if (!entrada) return []
  // O padrão pede os quatro e nada soma a mais: ler o arquivo não mudaria a resposta, e um commit grande de `apps/` não pagaria 2 leituras por arquivo.
  // Só a exceção chega abaixo, e é a ela que o sufixo e o `@Unscoped(` se aplicam.
  if (entrada.guardioes.length === OS_QUATRO.length) return [...OS_QUATRO]
  // Os dois lados: tirar a garantia junto com o comentário que a citava não tira o guardião, porque o HEAD ainda a tem.
  const textos = [conteudoDe(arquivo, 'indice'), conteudoDe(arquivo, 'head')].filter((texto): texto is string => texto !== null)
  if (SUFIXOS_QUE_NUNCA_SAO_EXCECAO.some((sufixo) => arquivo.endsWith(sufixo)) || textos.some((texto) => texto.includes(SEM_ESCOPO))) return [...OS_QUATRO]
  const citados = CITACOES.filter((citacao) => textos.some((texto) => citacao.termo.test(texto))).map((citacao) => citacao.guardiao)
  return [...entrada.guardioes, ...citados]
}

/**
 * Os guardiões que os arquivos pedem, na ordem dos quatro. `conteudoDe` serve à citação e ao `@Unscoped(`: lê o índice e o
 * HEAD, e o arquivo que não existe num dos dois lados vale pelo outro.
 */
export function guardioesDoCaminho(arquivos: readonly string[], conteudoDe: ConteudoDe): Guardiao[] {
  const pedidos = new Set(arquivos.flatMap((arquivo) => guardioesDoArquivo(arquivo, conteudoDe)))
  return OS_QUATRO.filter((guardiao) => pedidos.has(guardiao))
}
