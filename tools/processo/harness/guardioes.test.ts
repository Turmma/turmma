// A tabela de caminho para guardião (X7, RF15): `tasks/prd-harness/tabela-de-guardioes.md`, seção "O teste da tabela".
// Os literais estão escritos aqui, por extenso, e não lidos da constante: tabela que se confere contra si mesma não vê erro dela.
// O RF16 (14.0) é o último bloco: o código de processo, com o conjunto exato por caminho. Os dois lados pela `decidirCommit` (recusado
// sem o guardião, aceito com ele) ficam em `revisoes.test.ts`.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXCECOES_DO_CODIGO, guardioesDoCaminho, REGRAS_DO_RF16, RESTO_DO_PROCESSO, type ConteudoDe, type Guardiao } from '../guardioes-por-caminho.ts'
import { ARQUIVOS_DE_PROCESSO, PASTAS_DE_PROCESSO } from '../portao.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

const T: Guardiao = 'tenancy-guardian'
const P: Guardiao = 'privacy-guardian'
const C: Guardiao = 'conformidade-reviewer'
const I: Guardiao = 'infra-guardian'
const OS_QUATRO = [T, P, C, I]

/** O texto do arquivo no índice e no HEAD. Sem o segundo, o HEAD é igual ao índice; `null` é o arquivo que não existe naquele lado. */
const textos =
  (indice: string | null, head: string | null | undefined = indice): ConteudoDe =>
  (_arquivo, onde) =>
    onde === 'indice' ? indice : head
const SEM_TEXTO = textos('export const a = 1\n')
const pede = (arquivo: string, conteudoDe: ConteudoDe = SEM_TEXTO): Guardiao[] => guardioesDoCaminho([arquivo], conteudoDe)

const versionados = (...pastas: string[]): string[] =>
  execFileSync('git', ['ls-files', '-z', '--', ...pastas], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)

/** As exceções do código, com o conjunto exato que cada uma pede. O arquivo é um que existe no repositório. */
const EXCECOES: { prefixo: string; arquivo: string; guardioes: Guardiao[] }[] = [
  { prefixo: 'apps/web/src/components/ui/', arquivo: 'apps/web/src/components/ui/Tabs.tsx', guardioes: [C, I] },
  { prefixo: 'apps/web/src/components/ui/ai/', arquivo: 'apps/web/src/components/ui/ai/AgentSignature.tsx', guardioes: [P, C, I] },
  { prefixo: 'apps/web/src/index.css', arquivo: 'apps/web/src/index.css', guardioes: [C] },
  { prefixo: 'apps/web/src/theme.ts', arquivo: 'apps/web/src/theme.ts', guardioes: [] },
  { prefixo: 'apps/web/src/estilos.test.ts', arquivo: 'apps/web/src/estilos.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/theme.test.ts', arquivo: 'apps/web/src/theme.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/contraste.test.ts', arquivo: 'apps/web/src/contraste.test.ts', guardioes: [] },
  { prefixo: 'apps/web/src/gallery/', arquivo: 'apps/web/src/gallery/GallerySection.tsx', guardioes: [P, C] },
  { prefixo: 'apps/web/vite.config.ts', arquivo: 'apps/web/vite.config.ts', guardioes: [I] },
  { prefixo: 'apps/web/chunk-names.ts', arquivo: 'apps/web/chunk-names.ts', guardioes: [I] },
  { prefixo: 'apps/web/chunk-names.test.ts', arquivo: 'apps/web/chunk-names.test.ts', guardioes: [I] },
  { prefixo: 'apps/web/downlevel-color.ts', arquivo: 'apps/web/downlevel-color.ts', guardioes: [I] },
  { prefixo: 'apps/web/downlevel-color.test.ts', arquivo: 'apps/web/downlevel-color.test.ts', guardioes: [I] },
  { prefixo: 'apps/despachante/', arquivo: 'apps/despachante/src/app.module.ts', guardioes: [T, P, I] },
  { prefixo: 'infra/', arquivo: 'infra/Caddyfile', guardioes: [P, I] },
]

describe('o padrão: os quatro guardiões', () => {
  it('todo arquivo versionado nas cinco pastas pede os quatro, salvo os que casam uma exceção', () => {
    const arquivos = versionados('apps', 'packages', 'e2e', 'tools/guardas', 'tools/testes')
    const deExcecao = (arquivo: string): boolean => EXCECOES.some((excecao) => arquivo.startsWith(excecao.prefixo))
    const comPadrao = arquivos.filter((arquivo) => !deExcecao(arquivo))
    // Pastas lidas vazias deixariam o teste verde sem olhar nada.
    expect(comPadrao.length).toBeGreaterThan(300)
    const fora = comPadrao.filter((arquivo) => pede(arquivo).join() !== OS_QUATRO.join())
    expect(fora).toEqual([])
  })

  it('as cinco pastas pedem os quatro, uma a uma, e o documento não é código aqui', () => {
    for (const arquivo of ['apps/api/src/x.ts', 'packages/core/src/x.ts', 'e2e/x.spec.ts', 'tools/guardas/x.mjs', 'tools/testes/x.ts']) {
      expect(pede(arquivo)).toEqual(OS_QUATRO)
    }
    // Documento não é código: nem citando a regra pede guardião. O código de processo (RF16) é o último bloco deste arquivo.
    const cita = textos('regra 10 regra 20 regra 70 regra 80 LGPD')
    for (const arquivo of ['docs/lgpd.md', 'tasks/prd-x/1_task.md', '.claude/rules/10-multitenancy.md', '.claude/skills/x/SKILL.md', 'docs/aia/tutor.md']) {
      expect(pede(arquivo, cita)).toEqual([])
    }
  })

  it('pasta inventada dentro de uma das cinco pede os quatro; os quatro nomes que a tabela cita também', () => {
    expect(pede('apps/api/src/pasta-nova-que-ninguem-previu/x.ts')).toEqual(OS_QUATRO)
    expect(pede('packages/core/src/titular/leitura-do-titular.ts')).toEqual(OS_QUATRO)
    expect(pede('apps/api/test/estrutura-isolamento.int.test.ts')).toEqual(OS_QUATRO)
    expect(pede('e2e/aluno-tutor.spec.ts')).toEqual(OS_QUATRO)
  })

  it('o padrão não lê o conteúdo do arquivo: não há o que a citação acrescentar', () => {
    const lidos: string[] = []
    const espia: ConteudoDe = (arquivo) => (lidos.push(arquivo), null)
    expect(pede('apps/api/src/x.ts', espia)).toEqual(OS_QUATRO)
    expect(lidos).toEqual([])
    // A exceção lê, nos dois lados.
    pede('apps/web/src/theme.ts', espia)
    expect(lidos).toEqual(['apps/web/src/theme.ts', 'apps/web/src/theme.ts'])
  })
})

describe('as exceções do código', () => {
  it.each(EXCECOES)('$prefixo pede exatamente $guardioes', ({ arquivo, guardioes }) => {
    expect(pede(arquivo)).toEqual(guardioes)
  })

  it('cada exceção casa ao menos um arquivo versionado: exceção morta é vermelha', () => {
    const arquivos = versionados('apps', 'infra')
    const mortas = EXCECOES.filter((excecao) => !arquivos.some((arquivo) => arquivo.startsWith(excecao.prefixo))).map((excecao) => excecao.prefixo)
    expect(mortas).toEqual([])
    // O arquivo que o caso usa existe, e a constante do código é a mesma tabela escrita aqui.
    expect(EXCECOES.filter((excecao) => !arquivos.includes(excecao.arquivo)).map((excecao) => excecao.arquivo)).toEqual([])
    expect(EXCECOES_DO_CODIGO.map((excecao) => [excecao.prefixo, OS_QUATRO.filter((g) => excecao.guardioes.includes(g))])).toEqual(EXCECOES.map((excecao) => [excecao.prefixo, excecao.guardioes]))
  })

  it('vale o prefixo mais longo: ui/ia/ pede P C I e o resto de ui/ pede C I', () => {
    expect(pede('apps/web/src/components/ui/ai/QueueAlert.tsx')).toEqual([P, C, I])
    expect(pede('apps/web/src/components/ui/overlays/ConfirmDialog.tsx')).toEqual([C, I])
    // O mais longo vence também quando a exceção é mais curta que o padrão: a exceção está dentro de apps/.
    expect(pede('apps/web/src/gallery/Gallery.tsx')).toEqual([P, C])
  })

  it('um prefixo que é arquivo não casa o vizinho de nome parecido: tema.ts não é tema-novo.ts', () => {
    expect(pede('apps/web/src/theme.ts')).toEqual([])
    expect(pede('apps/web/src/tema-novo.ts')).toEqual(OS_QUATRO)
    expect(pede('apps/web/vite.config.test.ts')).toEqual(OS_QUATRO)
  })

  it.each(['x.repository.ts', 'x.controller.ts', 'x.gateway.ts', 'x.service.ts'])('%s nunca cai em exceção: pede os quatro em ui/, galeria/, despachante/ e infra/', (nome) => {
    for (const pasta of ['apps/web/src/components/ui/', 'apps/web/src/gallery/', 'apps/despachante/src/', 'infra/']) {
      expect(pede(`${pasta}${nome}`)).toEqual(OS_QUATRO)
    }
  })

  it('o sufixo é o do fim do nome: x.service.test.ts, x.servico.ts e x.service.ts.orig ficam na exceção', () => {
    expect(pede('apps/web/src/components/ui/x.service.test.ts')).toEqual([C, I])
    expect(pede('apps/web/src/components/ui/x.servico.ts')).toEqual([C, I])
    expect(pede('apps/web/src/components/ui/x.service.ts.orig')).toEqual([C, I])
  })

  it('@SemEscopo( no índice, só no HEAD ou em nenhum: quatro, quatro, e C I (componentes/ui/)', () => {
    const arquivo = 'apps/web/src/components/ui/Alert.tsx'
    const marca = '@Unscoped() // rotina administrativa nossa\n'
    expect(pede(arquivo, textos(marca, 'export const a = 1\n'))).toEqual(OS_QUATRO)
    expect(pede(arquivo, textos('export const a = 1\n', marca))).toEqual(OS_QUATRO)
    expect(pede(arquivo, textos('export const a = 1\n'))).toEqual([C, I])
    // O arquivo que não existe num dos lados vale pelo outro.
    expect(pede(arquivo, textos(null, marca))).toEqual(OS_QUATRO)
    expect(pede(arquivo, textos(marca, null))).toEqual(OS_QUATRO)
  })
})

describe('a citação soma o guardião da regra', () => {
  it.each([
    ['apps/web/src/gallery/x.tsx', 'regra 70', [P, C]],
    ['apps/web/src/gallery/x.tsx', 'regra 10', [T, P, C]],
    ['apps/web/src/gallery/x.tsx', 'LGPD', [P, C]],
    ['apps/web/src/gallery/x.tsx', 'regra 80', [P, C, I]],
    ['apps/web/vite.config.ts', 'regra 20', [P, I]],
    ['apps/web/vite.config.ts', 'regra 80', [I]],
    ['apps/web/vite.config.ts', 'regra 10', [T, I]],
    ['apps/web/vite.config.ts', 'regra 70', [C, I]],
    ['apps/web/src/theme.ts', 'regra 70', [C]],
    ['apps/web/src/theme.ts', 'LGPD', [P]],
    ['apps/web/src/theme.ts', 'Regra 80', [I]],
    ['apps/web/src/theme.ts', 'regra 10', [T]],
    ['apps/web/src/theme.ts', 'regra 20', [P]],
  ] as [string, string, Guardiao[]][])('%s citando "%s" pede %j', (arquivo, termo, esperado) => {
    expect(pede(arquivo, textos(`// ${termo}\nexport const a = 1\n`))).toEqual(esperado)
  })

  it('sem citação, não soma', () => {
    expect(pede('apps/web/src/theme.ts', textos('export const a = 1\n'))).toEqual([])
    expect(pede('apps/web/vite.config.ts', textos('export const a = 1\n'))).toEqual([I])
  })

  it('sem diferença de maiúscula, com espaço duplo, e o número não pode ser prefixo de outro', () => {
    const tema = 'apps/web/src/theme.ts'
    expect(pede(tema, textos('// REGRA 10'))).toEqual([T])
    expect(pede(tema, textos('// Regra 20'))).toEqual([P])
    expect(pede(tema, textos('// lgpd'))).toEqual([P])
    expect(pede(tema, textos('// REGRA 70'))).toEqual([C])
    expect(pede(tema, textos('// rEGRA 80'))).toEqual([I])
    expect(pede(tema, textos('// regra  10'))).toEqual([T])
    expect(pede(tema, textos('// regra  20'))).toEqual([P])
    expect(pede(tema, textos('// regra  70'))).toEqual([C])
    expect(pede(tema, textos('// regra\t80'))).toEqual([I])
    for (const cem of ['regra 100', 'regra 200', 'regra 700', 'regra 800']) expect(pede(tema, textos(`// ${cem}`))).toEqual([])
    expect(pede(tema, textos('// regra 40, regra 50'))).toEqual([])
  })

  it.each(['D45', 'D47', 'D55', 'D56', 'D57', 'D58', 'D59', 'D64'])('a decisão %s soma o conformidade-reviewer, como a regra 70', (decisao) => {
    expect(pede('apps/web/src/theme.ts', textos(`// ${decisao}\nexport const a = 1\n`))).toEqual([C])
    expect(pede('apps/web/vite.config.ts', textos(`// ${decisao}\n`))).toEqual([C, I])
    expect(pede('tools/processo/x.ts', textos(`// ${decisao}\n`))).toEqual([C])
    expect(pede('package.json', textos(`// ${decisao}\n`))).toEqual([C])
    // O padrão já pede os quatro; a citação não muda a resposta.
    expect(pede('apps/api/src/x.ts', textos(`// ${decisao}\n`))).toEqual(OS_QUATRO)
  })

  it('a decisão citada no meio de uma frase, de uma lista ou de uma faixa soma o conformidade-reviewer', () => {
    const tema = 'apps/web/src/theme.ts'
    expect(pede(tema, textos('// pela D58, D59 e D8'))).toEqual([C])
    expect(pede(tema, textos('// (D45 revista)'))).toEqual([C])
    expect(pede(tema, textos('// D55 a D59'))).toEqual([C])
    expect(pede(tema, textos('// D55–D59'))).toEqual([C])
    expect(pede(tema, textos('// ver D64.'))).toEqual([C])
  })

  it('a decisão que a regra 70 não cita, e o número que é prefixo, sufixo ou parte de outro, não soma', () => {
    const tema = 'apps/web/src/theme.ts'
    for (const fora of ['D4', 'D5', 'D6', 'D8', 'D44', 'D46', 'D48', 'D54', 'D60', 'D63', 'D65', 'D80', 'D450', 'D455', 'D470', 'D559', 'D640', 'D645']) {
      expect(pede(tema, textos(`// ${fora}`))).toEqual([])
    }
    // Colado a letra, dígito ou `#`: hash e cor hexadecimal curta (`#D45`) não são decisão; o `_` vale dos dois lados (`ID_D58`, `D45_`).
    for (const parte of ['AD45', '1D45', 'xD64', '#D45', '#D55', 'ID_D58', 'D45x', 'D45_']) expect(pede(tema, textos(`// ${parte}`))).toEqual([])
    // Só a escrita da decisão (D maiúsculo) vale, como nos documentos.
    expect(pede(tema, textos('// d45 d55 d64'))).toEqual([])
  })

  it('a decisão citada só no HEAD, ou só no índice, soma o conformidade-reviewer', () => {
    expect(pede('apps/web/src/theme.ts', textos('export const a = 1\n', '// D55\n'))).toEqual([C])
    expect(pede('apps/web/src/theme.ts', textos('// D55\n', 'export const a = 1\n'))).toEqual([C])
    expect(pede('apps/web/src/theme.ts', textos(null, '// D57\n'))).toEqual([C])
  })

  it('a decisão soma junto com as outras citações, na ordem dos quatro', () => {
    expect(pede('apps/web/src/theme.ts', textos('// D55\n// regra 80\n// regra 20\n// regra 10\n'))).toEqual(OS_QUATRO)
    expect(pede('apps/web/vite.config.ts', textos('// D64 e regra 20\n'))).toEqual([P, C, I])
  })

  it('citava "regra 20" no HEAD e não cita no índice: soma P; citando só no índice, também', () => {
    expect(pede('apps/web/src/theme.ts', textos('export const a = 1\n', '// regra 20\n'))).toEqual([P])
    expect(pede('apps/web/src/theme.ts', textos('// regra 20\n', 'export const a = 1\n'))).toEqual([P])
    // Arquivo apagado do índice: o HEAD ainda diz o que ele citava.
    expect(pede('apps/web/src/theme.ts', textos(null, '// regra 70\n'))).toEqual([C])
    expect(pede('apps/web/src/theme.ts', textos(null, null))).toEqual([])
  })

  it('várias citações somam todas, na ordem dos quatro', () => {
    expect(pede('apps/web/src/theme.ts', textos('// regra 80\n// regra 70\n// regra 20\n// regra 10\n'))).toEqual(OS_QUATRO)
  })
})

describe('a união de vários arquivos', () => {
  it('soma o que cada um pede, sem repetir, na ordem dos quatro', () => {
    expect(guardioesDoCaminho(['infra/Caddyfile', 'apps/web/src/index.css'], SEM_TEXTO)).toEqual([P, C, I])
    expect(guardioesDoCaminho(['apps/web/src/theme.ts', 'apps/web/src/index.css', 'apps/web/src/index.css'], SEM_TEXTO)).toEqual([C])
    expect(guardioesDoCaminho(['apps/despachante/src/x.ts', 'apps/web/vite.config.ts'], SEM_TEXTO)).toEqual([T, P, I])
    expect(guardioesDoCaminho(['apps/web/src/theme.ts', 'apps/api/src/x.ts'], SEM_TEXTO)).toEqual(OS_QUATRO)
  })

  it('sem arquivo, ou só com arquivo que não é código, não pede ninguém', () => {
    expect(guardioesDoCaminho([], SEM_TEXTO)).toEqual([])
    expect(guardioesDoCaminho(['docs/x.md', 'tasks/prd-x/1_task.md'], SEM_TEXTO)).toEqual([])
  })
})

describe('o código de processo (RF16)', () => {
  /** Cada linha da tabela do RF16, com o conjunto exato que ela pede. O arquivo é um que existe no repositório, ou o nome que a linha cobre. */
  const LINHAS: { prefixo: string; arquivo: string; guardioes: Guardiao[] }[] = [
    { prefixo: 'tools/processo/guardioes-por-caminho.ts', arquivo: 'tools/processo/guardioes-por-caminho.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/portao.ts', arquivo: 'tools/processo/portao.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/caducidade.ts', arquivo: 'tools/processo/caducidade.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/documento-de-revisao.ts', arquivo: 'tools/processo/documento-de-revisao.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/revisoes.ts', arquivo: 'tools/processo/revisoes.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/hook-revisoes.ts', arquivo: 'tools/processo/hook-revisoes.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/comando-git.ts', arquivo: 'tools/processo/comando-git.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/hook-git.ts', arquivo: 'tools/processo/hook-git.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/git-hooks/', arquivo: 'tools/processo/git-hooks/commit-msg', guardioes: OS_QUATRO },
    { prefixo: 'tools/processo/harness/guardioes.test.ts', arquivo: 'tools/processo/harness/guardioes.test.ts', guardioes: OS_QUATRO },
    { prefixo: 'tools/ci/conferir-entregas.ts', arquivo: 'tools/ci/conferir-entregas.ts', guardioes: OS_QUATRO },
    { prefixo: 'eslint.config.mjs', arquivo: 'eslint.config.mjs', guardioes: OS_QUATRO },
    { prefixo: 'eslint-suppressions.json', arquivo: 'eslint-suppressions.json', guardioes: OS_QUATRO },
    { prefixo: 'tools/vitrine/', arquivo: 'tools/vitrine/escola.ts', guardioes: [P, C] },
    { prefixo: 'tools/ia/', arquivo: 'tools/ia/medir-risco-a-vida.ts', guardioes: [P, C] },
    { prefixo: 'docs/aia/ouro/', arquivo: 'docs/aia/ouro/riscoAVida.json', guardioes: [C] },
    { prefixo: 'docs/aia/ouro-retido/', arquivo: 'docs/aia/ouro-retido/x.json', guardioes: [C] },
    { prefixo: 'tools/ci/', arquivo: 'tools/ci/compose.ts', guardioes: [I] },
    { prefixo: 'tools/ci/borda.test.ts', arquivo: 'tools/ci/borda.test.ts', guardioes: [P, I] },
    { prefixo: '.github/', arquivo: '.github/workflows/ci.yml', guardioes: [P, I] },
    { prefixo: 'playwright.config.ts', arquivo: 'playwright.config.ts', guardioes: [P] },
    { prefixo: 'compose.yaml', arquivo: 'compose.yaml', guardioes: [I] },
    { prefixo: '.env.example', arquivo: '.env.example', guardioes: [I] },
  ]

  it.each(LINHAS)('$arquivo pede exatamente $guardioes', ({ arquivo, guardioes }) => {
    expect(pede(arquivo)).toEqual(guardioes)
  })

  it.each([
    '.claude/settings.json',
    '.claude/settings.local.json',
    '.claude/settings.team.json',
  ])('%s pede os quatro: o padrão `.claude/settings*.json`', (arquivo) => {
    expect(pede(arquivo)).toEqual(OS_QUATRO)
  })

  it.each([
    '.claude/settings/x.json',
    '.claude/settings.json.bak',
    'sub/.claude/settings.json',
    '.claude/skills/x/SKILL.md',
    '.claude/rules/40-testes.md',
    '.claude/agents/implementador.md',
  ])('%s não é código: o padrão não alcança o vizinho nem a pasta de documento', (arquivo) => {
    expect(pede(arquivo, textos('regra 10 regra 20 regra 70 regra 80 LGPD'))).toEqual([])
  })

  it('o resto de tools/ e as outras configurações do portão não pedem ninguém', () => {
    for (const arquivo of ['tools/processo/linhas.ts', 'tools/processo/portao-local.ts', 'tools/processo/revisoes.test.ts', '.claude/hooks/x.sh', 'package.json', 'vitest.config.ts', 'tsconfig.json', 'tsconfig.base.json', 'knip.json', '.gitleaks.toml', '.size-limit.json']) {
      expect(pede(arquivo), arquivo).toEqual([])
    }
  })

  it('o padrão e o `infra/` vencem o resto de tools/: tools/guardas/ e tools/testes/ pedem os quatro, infra/k6/ pede P I', () => {
    expect(pede('tools/guardas/index.mjs')).toEqual(OS_QUATRO)
    expect(pede('tools/testes/x.ts')).toEqual(OS_QUATRO)
    expect(pede('infra/k6/x.js')).toEqual([P, I])
    expect(pede('infra/Caddyfile')).toEqual([P, I])
  })

  it('vale o prefixo mais longo: borda.test.ts pede P I e o resto de tools/ci/ pede I', () => {
    expect(pede('tools/ci/borda.test.ts')).toEqual([P, I])
    expect(pede('tools/ci/borda.ts')).toEqual([I])
    expect(pede('tools/ci/fixtures/x.ts')).toEqual([I])
  })

  it('nunca cai em exceção: o sufixo e o @SemEscopo( pedem os quatro nas linhas do RF16 que pedem menos', () => {
    for (const nome of ['x.repository.ts', 'x.controller.ts', 'x.gateway.ts', 'x.service.ts']) {
      for (const pasta of ['tools/vitrine/', 'tools/ia/', 'tools/ci/', 'tools/processo/', 'docs/aia/ouro/', '.github/']) {
        expect(pede(`${pasta}${nome}`), `${pasta}${nome}`).toEqual(OS_QUATRO)
      }
    }
    const marca = '@Unscoped() // rotina administrativa nossa\n'
    // No índice, só no HEAD, e em nenhum: os quatro, os quatro, e a linha dele.
    expect(pede('tools/vitrine/x.ts', textos(marca, 'export const a = 1\n'))).toEqual(OS_QUATRO)
    expect(pede('tools/vitrine/x.ts', textos('export const a = 1\n', marca))).toEqual(OS_QUATRO)
    expect(pede('tools/vitrine/x.ts', textos('export const a = 1\n'))).toEqual([P, C])
    expect(pede('tools/processo/x.ts', textos(marca, null))).toEqual(OS_QUATRO)
  })

  it('a citação soma o guardião da regra no resto de tools/ e nas outras linhas', () => {
    expect(pede('tools/processo/x.ts', textos('// regra 20\n'))).toEqual([P])
    expect(pede('tools/processo/x.ts', textos('// regra 10\n'))).toEqual([T])
    expect(pede('tools/processo/x.ts', textos('// regra 70\n'))).toEqual([C])
    expect(pede('tools/processo/x.ts', textos('// Regra 80\n'))).toEqual([I])
    expect(pede('tools/processo/x.ts', textos('// LGPD\n'))).toEqual([P])
    expect(pede('tools/processo/x.ts', textos('export const a = 1\n'))).toEqual([])
    // Citava no HEAD e não cita no índice: o guardião continua.
    expect(pede('package.json', textos('{}\n', '// regra 20\n'))).toEqual([P])
    expect(pede('tools/vitrine/x.ts', textos('// regra 80\n'))).toEqual([P, C, I])
    expect(pede('tools/ci/x.ts', textos('// regra 10\n'))).toEqual([T, I])
    expect(pede('docs/aia/ouro/x.json', textos('regra 20'))).toEqual([P, C])
  })

  it('a união de vários arquivos de processo soma o que cada um pede', () => {
    expect(guardioesDoCaminho(['tools/vitrine/escola.ts', 'compose.yaml', 'tools/processo/linhas.ts'], SEM_TEXTO)).toEqual([P, C, I])
    expect(guardioesDoCaminho(['playwright.config.ts', 'docs/aia/ouro/x.json'], SEM_TEXTO)).toEqual([P, C])
    expect(guardioesDoCaminho(['tools/processo/linhas.ts', 'package.json'], SEM_TEXTO)).toEqual([])
  })

  it('cada linha da tabela casa ao menos um arquivo versionado, ou é o nome de um arquivo que o repositório pode ter: linha morta é vermelha', () => {
    const arquivos = versionados('tools', '.github', '.claude', 'docs/aia', 'eslint.config.mjs', 'eslint-suppressions.json', 'playwright.config.ts', 'compose.yaml', '.env.example')
    // `docs/aia/ouro-retido/` pode não estar versionado: ele nasce quando o corpus retido existe. Todas as outras linhas casam um arquivo de hoje.
    const podeNaoExistir = ['docs/aia/ouro-retido/']
    const mortas = LINHAS.filter((linha) => !podeNaoExistir.includes(linha.prefixo) && !arquivos.some((arquivo) => arquivo.startsWith(linha.prefixo))).map((linha) => linha.prefixo)
    expect(mortas).toEqual([])
    // A constante do código é a tabela escrita aqui, na ordem em que o código a escreve.
    const doCodigo = REGRAS_DO_RF16.map((regra) => [regra.prefixo, OS_QUATRO.filter((g) => regra.guardioes.includes(g))])
    const daqui = LINHAS.map((linha) => [linha.prefixo, OS_QUATRO.filter((g) => linha.guardioes.includes(g))])
    expect(doCodigo.sort()).toEqual(daqui.sort())
  })

  it('o resto do §5(e) é o que `portao.ts` lista e a tabela não pede: nenhum nome da esteira fica sem linha aqui', () => {
    const daEsteira = [...PASTAS_DE_PROCESSO, ...ARQUIVOS_DE_PROCESSO]
    const cobertos = [...LINHAS.map((linha) => linha.prefixo), ...RESTO_DO_PROCESSO]
    // Todo nome que a esteira conta como código de processo tem linha aqui; sem ela, citar a regra nele não somaria o guardião.
    const sem = daEsteira.filter((nome) => !cobertos.some((prefixo) => nome.startsWith(prefixo)))
    expect(sem).toEqual([])
    // E o inverso: o "resto" não guarda nome que a esteira não conta.
    expect(RESTO_DO_PROCESSO.filter((nome) => !daEsteira.some((da) => da === nome))).toEqual([])
    // Cada nome do "resto" é de fato pedido por citação.
    for (const nome of RESTO_DO_PROCESSO) expect(pede(nome.endsWith('/') ? `${nome}x.ts` : nome, textos('// regra 20\n')), nome).toEqual([P])
    expect(pede('tsconfig.base.json', textos('// regra 20\n'))).toEqual([P])
  })
})
