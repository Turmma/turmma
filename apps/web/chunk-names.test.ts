import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Rolldown } from 'vite'
import { brotliCompressSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { AREAS_DA_ESCOLA, areaDoModulo, ehPecaForaDaEntrada, nomeDoChunk, PECAS_FORA_DA_ENTRADA, TETO_DE_UMA_TELA_EM_BYTES, TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES, type AreaDaEscola } from './chunk-names'

// B1 (o nome que o teto de 60 kB mede) e B2 (a entrada da escola não leva nada de `src/operacao/`), e o mesmo para a área
// de cada papel da escola (A1, tarefa 11.0), sobre o build de verdade do Vite, e não sobre o fonte: é o bundler que decide
// em que chunk cada módulo cai, e um `import` estático esquecido, ou uma configuração de chunk que arraste módulos, só
// aparece aqui.

const raizDaWeb = dirname(fileURLToPath(import.meta.url))
const diretorios: string[] = []

afterEach(() => {
  for (const diretorio of diretorios.splice(0)) rmSync(diretorio, { recursive: true, force: true })
})

type Chunk = Rolldown.OutputChunk

/**
 * Os chunks de JS de um build feito em memória, sem gravar `dist/`. `comGaleria` liga `VITE_COM_GALERIA=1`, como o
 * compose de teste; sem ele o build é o de produção, que não leva a galeria (`src/routes.tsx`).
 */
async function chunksDoBuild(opcoes: { raiz: string; configFile: string | false; comGaleria?: boolean }): Promise<Chunk[]> {
  const anterior = process.env['VITE_COM_GALERIA']
  // O Vitest roda com `NODE_ENV=test`, e o Vite o respeita no build: sairia o React de desenvolvimento, três vezes maior.
  // O tamanho que o teto mede é o do build de produção, como o `npm run build` faz.
  const ambienteAnterior = process.env['NODE_ENV']
  process.env['NODE_ENV'] = 'production'
  if (opcoes.comGaleria === true) process.env['VITE_COM_GALERIA'] = '1'
  else delete process.env['VITE_COM_GALERIA']
  try {
    return await chunksDoBuildComOAmbiente(opcoes)
  } finally {
    if (anterior === undefined) delete process.env['VITE_COM_GALERIA']
    else process.env['VITE_COM_GALERIA'] = anterior
    if (ambienteAnterior === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = ambienteAnterior
  }
}

async function chunksDoBuildComOAmbiente(opcoes: { raiz: string; configFile: string | false }): Promise<Chunk[]> {
  const saida = await build({
    root: opcoes.raiz,
    configFile: opcoes.configFile,
    logLevel: 'silent',
    build: {
      write: false,
      ...(opcoes.configFile === false ? { rolldownOptions: { output: { chunkFileNames: nomeDoChunk } } } : {}),
    },
  })
  const saidas = Array.isArray(saida) ? saida : [saida]
  return saidas.flatMap((resultado) => ('output' in resultado ? resultado.output : [])).filter((item): item is Chunk => item.type === 'chunk')
}

/** Os módulos de `src/operacao/` que o chunk de entrada leva. Lista vazia é a única resposta certa. */
function operacaoNaEntrada(chunks: readonly Chunk[]): string[] {
  const entrada = chunks.find((chunk) => chunk.isEntry)
  if (entrada === undefined) throw new Error('build sem chunk de entrada')
  return entrada.moduleIds.filter((id) => id.replaceAll('\\', '/').includes('/apps/web/src/operacao/'))
}

/**
 * Um projeto mínimo do Vite, numa pasta que também termina em `apps/web`, para o nome do chunk da operação valer do
 * mesmo jeito que no real. `arquivos` é relativo a `apps/web`.
 */
function projetoDeMentira(arquivos: Record<string, string>): string {
  const raiz = join(mkdtempSync(join(tmpdir(), 'educa-chunks-')), 'apps', 'web')
  diretorios.push(dirname(dirname(raiz)))
  const todos = { 'index.html': '<!doctype html><html><body><script type="module" src="/src/main.ts"></script></body></html>', ...arquivos }
  for (const [caminho, conteudo] of Object.entries(todos)) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
    writeFileSync(join(raiz, caminho), conteudo)
  }
  return raiz
}

describe('nome dos chunks', () => {
  it('o chunk que sai de src/operacao/ é operacao-*; o resto que não é entrada leva o prefixo parte-', () => {
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/operacao/routes.tsx' })).toBe('assets/operacao-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: 'C:\\repo\\apps\\web\\src\\operacao\\routes.tsx' })).toBe('assets/operacao-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/pages/index.tsx' })).toBe('assets/parte-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: null })).toBe('assets/parte-[name]-[hash].js')
  })

  it('o chunk que sai de src/areas/<papel>/ leva o nome da pasta; o que está na raiz de src/areas/, não', () => {
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/coordenacao/routes.tsx' })).toBe('assets/coordenacao-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/professor/routes.tsx' })).toBe('assets/professor-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: 'C:\\repo\\apps\\web\\src\\areas\\aluno\\routes.tsx' })).toBe('assets/aluno-[hash].js')
    // A tabela da navegação é da entrada, e uma pasta que só começa com o nome de uma área não é a área.
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/navigation.ts' })).toBe('assets/parte-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/professores/routes.tsx' })).toBe('assets/parte-[name]-[hash].js')
  })

  it('a tela que a área carrega por import() é tela-<area>-<nome>-*: fora do glob da área, do da entrada e do primeiro carregamento', () => {
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/professor/Aprovar.tsx' })).toBe('assets/tela-professor-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: 'C:\\repo\\apps\\web\\src\\areas\\aluno\\Tutor.tsx' })).toBe('assets/tela-aluno-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/coordenacao/governanca/Agentes.tsx' })).toBe('assets/tela-coordenacao-[name]-[hash].js')
    // Só o `routes.tsx` da raiz da área é a fachada: um `routes.tsx` de subpasta, ou um módulo com nome parecido, é tela.
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/professor/abas/routes.tsx' })).toBe('assets/tela-professor-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/areas/professor/other-routes.tsx' })).toBe('assets/tela-professor-[name]-[hash].js')
    // Nenhum dos nomes casa com os globs que o `.size-limit.json` soma: `<area>-*`, `index-*`, `parte-*`.
    for (const area of AREAS_DA_ESCOLA) {
      const nome = nomeDoChunk({ facadeModuleId: `/repo/apps/web/src/areas/${area}/index.tsx` }).replace('assets/', '')
      expect(nome).toBe(`tela-${area}-[name]-[hash].js`)
      expect(/^(?:index|parte|coordenacao|professor|aluno|operacao|pecas|galeria)-/.test(nome), nome).toBe(false)
    }
  })

  it('o pedaço sem fachada com módulo de uma área só é daquela área; com módulo de duas, não ganha nome de área nenhuma', () => {
    const doProfessor = '/repo/apps/web/src/areas/professor/destaques.ts'
    const peca = '/repo/apps/web/src/components/ui/ai/PromptInput.tsx'
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [doProfessor] })).toBe('assets/tela-professor-[name]-[hash].js')
    // Com uma peça junto, continua da área: é a área que o baixa, e o teto de tela o mede.
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [doProfessor, peca] })).toBe('assets/tela-professor-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [doProfessor, '/repo/apps/web/src/areas/aluno/Tutor.tsx'] })).toBe('assets/parte-[name]-[hash].js')
    expect(areaDoModulo(doProfessor)).toBe('professor')
    expect(areaDoModulo(peca)).toBeUndefined()
    expect(areaDoModulo('/repo/apps/web/src/areas/navigation.ts')).toBeUndefined()
  })

  it('o chunk que sai de src/galeria/ é galeria-*, fora do glob do primeiro carregamento', () => {
    expect(nomeDoChunk({ facadeModuleId: '/repo/apps/web/src/gallery/Gallery.tsx' })).toBe('assets/galeria-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: 'C:\\repo\\apps\\web\\src\\gallery\\Gallery.tsx' })).toBe('assets/galeria-[hash].js')
  })

  it('o pedaço sem fachada que só tem peças é pecas-*; com um módulo que não é peça, ou sem nenhum da web, continua parte-*', () => {
    const peca = '/repo/apps/web/src/components/ui/ai/PromptInput.tsx'
    const geral = '/repo/apps/web/src/components/ui/overlays/Menu.tsx'
    const deFora = '/repo/node_modules/lucide-react/dist/esm/icons/check.js'
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [peca, geral, deFora] })).toBe('assets/pecas-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: ['C:\\repo\\apps\\web\\src\\components\\ui\\ai\\textos-das-fontes.ts'] })).toBe('assets/pecas-[name]-[hash].js')
    // O `Dialog` é da entrada: o pedaço que o leva conta no primeiro carregamento, mesmo com uma peça ao lado.
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [peca, '/repo/apps/web/src/components/ui/overlays/Dialog.tsx'] })).toBe('assets/parte-[name]-[hash].js')
    // Só React, ou só o contrato compartilhado: é o que a entrada baixa, e continua `parte-*`.
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [deFora] })).toBe('assets/parte-[name]-[hash].js')
    expect(nomeDoChunk({ facadeModuleId: null, moduleIds: [] })).toBe('assets/parte-[name]-[hash].js')
  })

  it('peça fora da entrada é a pasta componentes/ui/ia/ e a lista das gerais, e nada mais de componentes/', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/ai/schema-form.ts')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/Tabs.tsx')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/tabs-keyboard.ts')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/StatusBadge.tsx?v=1')).toBe(true)
    // As que a entrada usa, e as que só têm o nome parecido.
    for (const daEntrada of ['ui/Button.tsx', 'ui/button-variants.ts', 'ui/overlays/Dialog.tsx', 'ui/fields/FormField.tsx', 'states/EmptyState.tsx', 'MenuDaPessoa.tsx', 'ui/fields/field-styles.ts', 'pedidos/Menu.tsx'])
      expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${daEntrada}`), daEntrada).toBe(false)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/areas/professor/Menu.tsx')).toBe(false)
  })

  it('as peças novas de campo (X1, 4.0) estão fora da entrada, e as que ela já usava continuam dentro', () => {
    for (const nova of ['ui/fields/SearchInput.tsx', 'ui/fields/Switch.tsx', 'ui/fields/OptionCard.tsx']) expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${nova}`), nova).toBe(true)
    for (const daEntrada of ['ui/fields/FormField.tsx', 'ui/fields/PasswordInput.tsx', 'ui/fields/field-styles.ts']) expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${daEntrada}`), daEntrada).toBe(false)
  })

  it('o painel ao lado (X1, 7.0) está fora da entrada, e o que ele divide com o `Dialogo` (`dialogo-modal`) fica dentro', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/overlays/Sheet.tsx')).toBe(true)
    // O `Dialog` é da entrada, e o que o painel divide com ele não pode morar numa peça que a entrada não baixa.
    for (const daEntrada of ['ui/overlays/Dialog.tsx', 'ui/overlays/modal-dialog.ts', 'ReauthDialog.tsx', 'DialogoDoConvite.tsx']) {
      expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${daEntrada}`), daEntrada).toBe(false)
    }
  })

  it('as peças novas de estado (X1, 6.0) estão fora da entrada, e os três de `estado/` e o `Botao` que eles usam, dentro', () => {
    for (const nova of ['ui/Alert.tsx', 'ui/CountBadge.tsx', 'ui/Toggle.tsx']) expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${nova}`), nova).toBe(true)
    for (const daEntrada of ['states/LoadingState.tsx', 'states/ErrorState.tsx', 'states/EmptyState.tsx', 'ui/Button.tsx']) {
      expect(ehPecaForaDaEntrada(`/repo/apps/web/src/components/${daEntrada}`), daEntrada).toBe(false)
    }
  })

  it('a cabeça da onça (X1, 8.0) está fora da entrada, com a pasta dela, e o avatar que a desenha já era peça de ia', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/onca/CabecaOnca.tsx')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/ai/AgentAvatar.tsx')).toBe(true)
    // Só o arquivo da lista: outra pasta com o mesmo nome de arquivo, ou outro arquivo da pasta da onça, não é peça sem entrar nela.
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/areas/professor/onca/CabecaOnca.tsx')).toBe(false)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/onca/OncaInteira.tsx')).toBe(false)
  })

  it('a comemoração e o estilo da onça dela (X4, 6.0) estão fora da entrada, e o CSS de outro arquivo não é peça só por ser CSS', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/Comemoracao.tsx')).toBe(true)
    // O estilo ao lado da peça é da peça: sem isto, o pedaço dividido entre a galeria e a tarefa aberta cai em `parte-*`.
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/onca/Onca.css')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/onca/Onca.css?used')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/Button.css')).toBe(false)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/areas/aluno/Onca.css')).toBe(false)
  })

  it('o tamanho da letra (X4, 8.0) está fora da entrada, com a pasta dela, e o `letra.ts`, que a entrada importa, não é peça', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/settings/TamanhoDaLetra.tsx')).toBe(true)
    // Só o arquivo da lista: o mesmo nome fora da pasta, ou o módulo da letra, não é peça sem entrar nela.
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/TamanhoDaLetra.tsx')).toBe(false)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/text-size.ts')).toBe(false)
  })

  it('a peça nova de lista (X1, 5.0) está fora da entrada, e o `Linha` do `Tabela` não é um arquivo', () => {
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/ListItem.tsx')).toBe(true)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/components/ui/ListItem.test.tsx')).toBe(false)
    expect(ehPecaForaDaEntrada('/repo/apps/web/src/areas/professor/ListItem.tsx')).toBe(false)
  })
})

/** Os módulos de `src/areas/<papel>/` que um chunk leva. */
function modulosDeArea(chunk: Chunk): string[] {
  return chunk.moduleIds.filter((id) => AREAS_DA_ESCOLA.some((area) => id.replaceAll('\\', '/').includes(`/apps/web/src/areas/${area}/`)))
}

/** O nome do pedaço sem a pasta e sem o hash, que tem oito caracteres e pode ter hífen: `tela-professor-Aprovar`. */
function semHash(nomeDoArquivo: string): string {
  return nomeDoArquivo.replace(/^assets\//, '').replace(/-[\w-]{8}\.js$/, '')
}

/** A área de um pedaço, pelo nome dele: a fachada (`<area>-*`) ou uma tela dela (`tela-<area>-*`). */
function areaDoPedaco(chunk: Chunk): { area: AreaDaEscola; tela: boolean } | undefined {
  for (const area of AREAS_DA_ESCOLA) {
    if (new RegExp(`^assets/${area}-[^/]+\\.js$`).test(chunk.fileName)) return { area, tela: false }
    if (new RegExp(`^assets/tela-${area}-[^/]+\\.js$`).test(chunk.fileName)) return { area, tela: true }
  }
  return undefined
}

/**
 * Os módulos de área que caíram num pedaço que não é da área deles, como `pedaço: módulo`. Lista vazia é a única resposta
 * certa: módulo de `areas/professor/` só existe na fachada do professor e nas telas dele.
 */
function modulosDeAreaForaDoLugar(chunks: readonly Chunk[]): string[] {
  return chunks.flatMap((chunk) =>
    chunk.moduleIds
      .filter((id) => areaDoModulo(id) !== undefined && areaDoModulo(id) !== areaDoPedaco(chunk)?.area)
      .map((id) => `${semHash(chunk.fileName)}: ${id.replaceAll('\\', '/').replace(/^.*\/apps\/web\/src\//, '')}`),
  )
}

/**
 * As telas que alguém de fora da área delas alcança, por `import` ou por `import()`, como `quem alcança → tela`. A tela
 * do professor só é alcançada pela fachada do professor e pelas outras telas dele: nem a entrada (que só chega à área
 * depois da guarda de papel), nem a galeria, nem a fachada de outro papel. É a regra 10 e a regra 50, item 9, no build: o
 * Chromebook do aluno não baixa a tela de Aprovar.
 *
 * O que decide é **quem alcança**, e não quem importa: um pedaço de peças (`pecas-*`) pode importar um pedaço de tela
 * quando os dois só existem para aquela área. Acontece quando uma peça e um módulo da área dividem uma dependência (um
 * ícone) e são usados pelas mesmas telas: o bundler põe a dependência junto do módulo da área, e a peça a importa de
 * lá. Por isso a conta sobe pelos pedaços sem área (`pecas-*`, `parte-*`) até achar de quem eles são.
 */
function telasImportadasDeFora(chunks: readonly Chunk[]): string[] {
  const quemImporta = (alvo: Chunk) => chunks.filter((chunk) => chunk.imports.includes(alvo.fileName) || chunk.dynamicImports.includes(alvo.fileName))
  const achados = new Set<string>()
  for (const tela of chunks) {
    const destino = areaDoPedaco(tela)
    if (destino?.tela !== true) continue
    const vistos = new Set<Chunk>()
    const pendentes = quemImporta(tela)
    while (pendentes.length > 0) {
      const quem = pendentes.pop()
      if (quem === undefined || vistos.has(quem)) continue
      vistos.add(quem)
      const area = areaDoPedaco(quem)?.area
      if (area === destino.area) continue
      // De outra área, a entrada, ou um pedaço com fachada que não é de área (a galeria, a operação): alcançou de fora.
      if (area !== undefined || quem.isEntry || quem.facadeModuleId !== null) achados.add(`${semHash(quem.fileName)} → ${semHash(tela.fileName)}`)
      // Pedaço dividido sem área: quem o alcança é que diz de quem ele é.
      else pendentes.push(...quemImporta(quem))
    }
  }
  return [...achados].sort()
}

/** As telas acima do teto de uma tela, em brotli, com o nome e o tamanho de cada uma: é a mensagem de quem estourou. */
function telasAcimaDoTeto(chunks: readonly Chunk[]): string[] {
  return chunks.flatMap((chunk) => {
    if (areaDoPedaco(chunk)?.tela !== true) return []
    const bytes = brotliCompressSync(chunk.code).length
    return bytes > TETO_DE_UMA_TELA_EM_BYTES ? [`${semHash(chunk.fileName)}: ${(bytes / 1000).toFixed(1)} kB em brotli, acima de ${String(TETO_DE_UMA_TELA_EM_BYTES / 1000)} kB`] : []
  })
}

/**
 * O primeiro carregamento de verdade: a entrada e os pedaços que ela importa estaticamente, direta e transitivamente,
 * com o tamanho de cada um em brotli, do maior para o menor. O `import()` não entra: é baixado só quando a tela pede.
 */
function primeiroCarregamento(chunks: readonly Chunk[]): { total: number; pedacos: { nome: string; bytes: number }[] } {
  const entrada = chunks.find((chunk) => chunk.isEntry)
  if (entrada === undefined) throw new Error('build sem chunk de entrada')
  const pedacos = [entrada, ...importadosJunto(chunks, entrada)]
    .map((chunk) => ({ nome: semHash(chunk.fileName), bytes: brotliCompressSync(chunk.code).length }))
    .sort((a, b) => b.bytes - a.bytes)
  return { total: pedacos.reduce((soma, pedaco) => soma + pedaco.bytes, 0), pedacos }
}

/** O que a reprovação diz: o total e os três maiores pedaços, para quem estourou saber onde cortar. */
function excessoDoPrimeiroCarregamento(chunks: readonly Chunk[]): string | undefined {
  const { total, pedacos } = primeiroCarregamento(chunks)
  if (total <= TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES) return undefined
  const maiores = pedacos.slice(0, 3).map((pedaco) => `${pedaco.nome} ${(pedaco.bytes / 1000).toFixed(1)} kB`)
  return `primeiro carregamento com ${(total / 1000).toFixed(1)} kB em brotli, acima de ${String(TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES / 1000)} kB; os maiores: ${maiores.join(', ')}`
}

/** Os chunks que o chunk dado importa estaticamente, e os que eles importam: o que o navegador baixa junto com ele. */
function importadosJunto(chunks: readonly Chunk[], chunk: Chunk): Chunk[] {
  const vistos = new Map<string, Chunk>()
  const pendentes = [...chunk.imports]
  while (pendentes.length > 0) {
    const nome = pendentes.pop() ?? ''
    const importado = chunks.find((outro) => outro.fileName === nome)
    if (importado === undefined || vistos.has(nome)) continue
    vistos.set(nome, importado)
    pendentes.push(...importado.imports)
  }
  return [...vistos.values()]
}

describe('o build de verdade da web', () => {
  it('B2: a entrada da escola não leva nenhum módulo de src/operacao/, e a área sai num chunk operacao-* só por import()', async () => {
    const chunks = await chunksDoBuild({ raiz: raizDaWeb, configFile: join(raizDaWeb, 'vite.config.ts') })
    const entrada = chunks.find((chunk) => chunk.isEntry)
    const operacao = chunks.filter((chunk) => /^assets\/operacao-[^/]+\.js$/.test(chunk.fileName))

    expect(entrada?.fileName).toMatch(/^assets\/index-[^/]+\.js$/)
    expect(operacaoNaEntrada(chunks)).toEqual([])
    // A área existe e está no chunk dela: sem isto, a asserção acima passaria com a área apagada do build.
    expect(operacao).toHaveLength(1)
    expect(operacao[0]?.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/apps/web/src/operacao/routes.tsx'))).toBe(true)
    // A entrada só chega a ela por `import()`, nunca por `import` estático, que o navegador baixaria junto.
    expect(entrada?.imports).not.toContain(operacao[0]?.fileName)
    expect(entrada?.dynamicImports).toContain(operacao[0]?.fileName)
    // Nenhum módulo da área cai num terceiro chunk (`parte-*`), que nem este teste nem o teto de 60 kB mediriam.
    const foraDoChunkDaArea = chunks
      .filter((chunk) => chunk !== operacao[0])
      .flatMap((chunk) => chunk.moduleIds.filter((id) => id.replaceAll('\\', '/').includes('/apps/web/src/operacao/')))
    expect(foraDoChunkDaArea).toEqual([])
    // Nenhum outro chunk tem o nome da entrada, que o teto de 150 kB mediria como se fosse ela.
    expect(chunks.filter((chunk) => !chunk.isEntry && /^assets\/index-/.test(chunk.fileName))).toEqual([])
  })

  it('as áreas da escola: uma fachada por papel, só por import(), fora da entrada; as telas em pedaços que só a área delas importa, cada uma no teto', async () => {
    const chunks = await chunksDoBuild({ raiz: raizDaWeb, configFile: join(raizDaWeb, 'vite.config.ts') })
    const entrada = chunks.find((chunk) => chunk.isEntry)
    if (entrada === undefined) throw new Error('build sem chunk de entrada')

    expect(modulosDeArea(entrada)).toEqual([])
    for (const area of AREAS_DA_ESCOLA) {
      // A fachada é uma só, e é o `routes.tsx` da área: é ela que o teto `<area>-*.js` mede. As telas por `import()` saem
      // como `tela-<area>-*`, e não entram nesta conta.
      const fachadas = chunks.filter((chunk) => new RegExp(`^assets/${area}-[^/]+\\.js$`).test(chunk.fileName))
      expect(fachadas, `fachada ${area}-*`).toHaveLength(1)
      expect(fachadas[0]?.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith(`/apps/web/src/areas/${area}/routes.tsx`))).toBe(true)
      expect(entrada.imports).not.toContain(fachadas[0]?.fileName)
      expect(entrada.dynamicImports).toContain(fachadas[0]?.fileName)
    }
    // Nenhum módulo de área cai fora da fachada e das telas dela, onde nem o teto da área nem o da tela o mediriam.
    expect(modulosDeAreaForaDoLugar(chunks)).toEqual([])
    // Nenhuma tela é importada de fora da área dela: nem pela entrada, nem pela fachada de outro papel.
    expect(telasImportadasDeFora(chunks)).toEqual([])
    // E nenhuma tela, sozinha, passa do teto de uma tela. A lista diz qual estourou, e por quanto.
    expect(telasAcimaDoTeto(chunks), 'divida a tela, ou tire dela o que pesa (docs/interface.md 10.4)').toEqual([])
    // O que a entrada baixa junto é primeiro carregamento, e o teto de 150 kB mede `index-*` e `parte-*`: qualquer outro
    // nome aqui (uma área, a operação) ficaria fora da conta, ou entraria no primeiro carregamento sem ninguém ver.
    expect(importadosJunto(chunks, entrada).map((chunk) => chunk.fileName).filter((nome) => !/^assets\/parte-[^/]+\.js$/.test(nome))).toEqual([])
    for (const junto of importadosJunto(chunks, entrada)) expect(modulosDeArea(junto)).toEqual([])
    // O primeiro carregamento de verdade — a entrada e o que ela importa estaticamente — no teto de 150 kB em brotli.
    // A mensagem diz o total e os três maiores pedaços.
    expect(excessoDoPrimeiroCarregamento(chunks), 'tire da entrada o que só uma tela usa (import() por tela; docs/interface.md 10.4)').toBeUndefined()
    // A conta não ficou vazia: a entrada está nela, com o tamanho de verdade.
    const { total, pedacos } = primeiroCarregamento(chunks)
    expect(pedacos.map((pedaco) => pedaco.nome)).toContain('index')
    expect(total).toBeGreaterThan(50_000)
  })

  it('as peças do MVP de apresentação ficam fora do primeiro carregamento, e a galeria sai num chunk galeria-* só por import()', async () => {
    const chunks = await chunksDoBuild({ raiz: raizDaWeb, configFile: join(raizDaWeb, 'vite.config.ts'), comGaleria: true })
    const entrada = chunks.find((chunk) => chunk.isEntry)
    if (entrada === undefined) throw new Error('build sem chunk de entrada')
    const galeria = chunks.filter((chunk) => /^assets\/galeria-[^/]+\.js$/.test(chunk.fileName))

    expect(galeria).toHaveLength(1)
    expect(galeria[0]?.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/apps/web/src/gallery/Gallery.tsx'))).toBe(true)
    expect(entrada.imports).not.toContain(galeria[0]?.fileName)
    expect(entrada.dynamicImports).toContain(galeria[0]?.fileName)

    // Nenhuma peça na entrada nem no que ela baixa junto: é o que mantém o Chromebook das 7h30 sem o peso delas.
    const primeiroCarregamento = [entrada, ...importadosJunto(chunks, entrada)]
    expect(primeiroCarregamento.flatMap((chunk) => chunk.moduleIds.filter(ehPecaForaDaEntrada))).toEqual([])
    // E as peças existem no build, cada arquivo da lista e a pasta de IA: sem isto, a asserção acima passaria com as
    // peças apagadas, ou com a lista apontando para arquivos que mudaram de nome.
    const noBuild = chunks.flatMap((chunk) => chunk.moduleIds.map((id) => id.replaceAll('\\', '/')))
    for (const peca of PECAS_FORA_DA_ENTRADA) expect(noBuild.some((id) => new RegExp(`/apps/web/src/components/${peca}\\.tsx?$`).test(id)), peca).toBe(true)
    for (const deIa of ['AgentSignature.tsx', 'PromptInput.tsx', 'CitationChip.tsx', 'ChoicePrompt.tsx', 'SchemaForm.tsx', 'AIText.tsx'])
      expect(noBuild.some((id) => id.endsWith(`/apps/web/src/components/ui/ai/${deIa}`)), deIa).toBe(true)
    // Peça nenhuma cai num `parte-*`, que o teto de 150 kB mediria como primeiro carregamento sem ela estar nele.
    const emParte = chunks.filter((chunk) => /^assets\/parte-/.test(chunk.fileName)).flatMap((chunk) => chunk.moduleIds.filter(ehPecaForaDaEntrada))
    expect(emParte).toEqual([])
  })

  it('sem VITE_COM_GALERIA=1 o build não leva a galeria: nem o pedaço, nem o módulo; quem esquece a variável fica sem ela', async () => {
    const chunks = await chunksDoBuild({ raiz: raizDaWeb, configFile: join(raizDaWeb, 'vite.config.ts') })
    expect(chunks.filter((chunk) => /^assets\/galeria-/.test(chunk.fileName))).toEqual([])
    expect(chunks.flatMap((chunk) => chunk.moduleIds.filter((id) => id.replaceAll('\\', '/').includes('/apps/web/src/gallery/')))).toEqual([])
    // O build continua inteiro: a entrada e as três áreas estão lá.
    expect(chunks.some((chunk) => chunk.isEntry)).toBe(true)
    for (const area of AREAS_DA_ESCOLA) expect(chunks.filter((chunk) => new RegExp(`^assets/${area}-`).test(chunk.fileName)), area).toHaveLength(1)
    // Qualquer outro valor também não liga: só o "1".
    process.env['VITE_COM_GALERIA'] = 'true'
    try {
      const comOutroValor = await chunksDoBuildComOAmbiente({ raiz: raizDaWeb, configFile: join(raizDaWeb, 'vite.config.ts') })
      expect(comOutroValor.filter((chunk) => /^assets\/galeria-/.test(chunk.fileName))).toEqual([])
    } finally {
      delete process.env['VITE_COM_GALERIA']
    }
  })

  it('a peça que duas telas dividem sai num pedaço pecas-*, e o que elas dividem e não é peça continua parte-*', async () => {
    // Uma função que lê o documento, e não uma constante de texto: a constante seria copiada para dentro de quem a usa, e
    // o módulo sumiria do build.
    const SELO_DE_MENTIRA = 'export function selo(): string {\n  return `IA em ${document.title}`\n}\n'
    const raiz = projetoDeMentira({
      'src/main.ts': "void import('./areas/professor/routes').then((m) => console.log(m.tela))\nvoid import('./gallery/Gallery').then((m) => console.log(m.tela))\n",
      'src/areas/professor/routes.ts': "import { selo } from '../../components/ui/ai/selo'\nimport { comum } from '../../components/comum'\nexport const tela = `professor ${selo()} ${comum()}`\n",
      'src/gallery/Gallery.ts': "import { selo } from '../components/ui/ai/selo'\nimport { comum } from '../components/comum'\nexport const tela = `galeria ${selo()} ${comum()}`\n",
      'src/components/ui/ai/selo.ts': SELO_DE_MENTIRA,
      'src/components/comum.ts': "export function comum(): string {\n  return `não é peça em ${document.title}`\n}\n",
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    const comOSelo = chunks.find((chunk) => chunk.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/src/components/ui/ai/selo.ts')))
    const semFachada = chunks.filter((chunk) => chunk.facadeModuleId === null)
    // O Rolldown junta num pedaço só o que as mesmas telas dividem: a peça e o módulo comum caem juntos, e o pedaço
    // misto conta no primeiro carregamento, que é o lado seguro.
    expect(semFachada.map((chunk) => chunk.fileName)).toEqual([expect.stringMatching(/^assets\/parte-[^/]+\.js$/)])
    expect(comOSelo?.fileName).toMatch(/^assets\/parte-/)
    expect(chunks.map((chunk) => chunk.fileName)).toContainEqual(expect.stringMatching(/^assets\/galeria-[^/]+\.js$/))

    // Sem o módulo que não é peça, o pedaço dividido só tem peças, e sai do glob do primeiro carregamento.
    const soPecas = projetoDeMentira({
      'src/main.ts': "void import('./areas/professor/routes').then((m) => console.log(m.tela))\nvoid import('./gallery/Gallery').then((m) => console.log(m.tela))\n",
      'src/areas/professor/routes.ts': "import { selo } from '../../components/ui/ai/selo'\nexport const tela = `professor ${selo()}`\n",
      'src/gallery/Gallery.ts': "import { selo } from '../components/ui/ai/selo'\nexport const tela = `galeria ${selo()}`\n",
      'src/components/ui/ai/selo.ts': SELO_DE_MENTIRA,
    })
    const chunksSoPecas = await chunksDoBuild({ raiz: soPecas, configFile: false })
    const dividido = chunksSoPecas.filter((chunk) => chunk.facadeModuleId === null)
    expect(dividido.map((chunk) => chunk.fileName)).toEqual([expect.stringMatching(/^assets\/pecas-[^/]+\.js$/)])
    expect(dividido[0]?.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/src/components/ui/ai/selo.ts'))).toBe(true)
  })

  /** Um módulo de mentira que o bundler não copia para dentro de quem o usa: lê o documento, e por isso não é constante. */
  const modulo = (nome: string, importa = '') => `${importa}export function ${nome}(): string {\n  return \`${nome} em \${document.title}\`\n}\n`
  /** A entrada de mentira, como a de verdade: cada área só por `import()`. */
  const ENTRADA_DE_MENTIRA = "void import('./areas/professor/routes').then((m) => console.log(m.default()))\nvoid import('./areas/aluno/routes').then((m) => console.log(m.default()))\n"
  const fachada = (telas: readonly string[]) => `export default function rotas(): string[] {\n  void Promise.all([${telas.map((tela) => `import('${tela}')`).join(', ')}])\n  return [document.title]\n}\n`

  it('a tela por import() sai como tela-<area>-<nome>-*, o que duas telas da área dividem também, e só a área delas as importa', async () => {
    const raiz = projetoDeMentira({
      'src/main.ts': ENTRADA_DE_MENTIRA,
      'src/areas/professor/routes.ts': fachada(['./Aprovar', './Home']),
      'src/areas/professor/Aprovar.ts': modulo('Aprovar', "import { destaques } from './destaques'\nconsole.log(destaques())\n"),
      'src/areas/professor/Home.ts': modulo('Home', "import { destaques } from './destaques'\nconsole.log(destaques())\n"),
      'src/areas/professor/destaques.ts': modulo('destaques'),
      'src/areas/aluno/routes.ts': fachada(['./Tutor']),
      'src/areas/aluno/Tutor.ts': modulo('Tutor'),
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    const nomes = chunks.map((chunk) => semHash(chunk.fileName)).sort()
    expect(nomes).toEqual(['aluno', 'index', 'professor', 'tela-aluno-Tutor', 'tela-professor-Aprovar', 'tela-professor-Home', 'tela-professor-destaques'])
    // Nenhum nome de tela casa com o glob da área, que o teto da fachada soma.
    for (const area of AREAS_DA_ESCOLA) expect(chunks.filter((chunk) => new RegExp(`^assets/${area}-`).test(chunk.fileName)).length, area).toBeLessThanOrEqual(1)

    expect(modulosDeAreaForaDoLugar(chunks)).toEqual([])
    expect(telasImportadasDeFora(chunks)).toEqual([])
    expect(telasAcimaDoTeto(chunks)).toEqual([])
    // A fachada do aluno só alcança a tela do aluno; a entrada não alcança tela nenhuma sem passar pela fachada.
    const doAluno = chunks.find((chunk) => /^assets\/aluno-/.test(chunk.fileName))
    const entrada = chunks.find((chunk) => chunk.isEntry)
    expect([...(doAluno?.imports ?? []), ...(doAluno?.dynamicImports ?? [])].filter((nome) => /tela-/.test(nome))).toEqual([expect.stringMatching(/^assets\/tela-aluno-Tutor-/)])
    expect([...(entrada?.imports ?? []), ...(entrada?.dynamicImports ?? [])].filter((nome) => /tela-/.test(nome))).toEqual([])
  })

  it('controle: a fachada do aluno que importa a tela do professor, por import() ou por import estático, reprova', async () => {
    const comum = {
      'src/main.ts': ENTRADA_DE_MENTIRA,
      'src/areas/professor/routes.ts': fachada(['./Aprovar']),
      'src/areas/professor/Aprovar.ts': modulo('Aprovar'),
      'src/areas/aluno/Tutor.ts': modulo('Tutor'),
    }
    // Por `import()`: a tela do professor vira dependência dinâmica da fachada do aluno.
    const porImportDinamico = await chunksDoBuild({ raiz: projetoDeMentira({ ...comum, 'src/areas/aluno/routes.ts': fachada(['./Tutor', '../professor/Aprovar']) }), configFile: false })
    expect(telasImportadasDeFora(porImportDinamico)).toEqual(['aluno → tela-professor-Aprovar'])

    // Por `import` estático: o navegador do aluno baixa a tela do professor junto com a área dele.
    const estatico = "import { Aprovar } from '../professor/Aprovar'\nconsole.log(Aprovar())\n"
    const porImportEstatico = await chunksDoBuild({ raiz: projetoDeMentira({ ...comum, 'src/areas/aluno/routes.ts': `${estatico}${fachada(['./Tutor'])}` }), configFile: false })
    expect(telasImportadasDeFora(porImportEstatico)).toEqual(['aluno → tela-professor-Aprovar'])

    // E a tela do professor que só o aluno importa, direto, vai parar dentro do pedaço do aluno: módulo fora do lugar.
    const soOAluno = await chunksDoBuild({
      raiz: projetoDeMentira({ ...comum, 'src/areas/professor/routes.ts': fachada([]), 'src/areas/aluno/routes.ts': `${estatico}${fachada(['./Tutor'])}` }),
      configFile: false,
    })
    expect(modulosDeAreaForaDoLugar(soOAluno)).toEqual(['aluno: areas/professor/Aprovar.ts'])

    // A entrada que pula a fachada e importa a tela direto também reprova: a tela chegaria antes da guarda de papel.
    const pelaEntrada = await chunksDoBuild({ raiz: projetoDeMentira({ ...comum, 'src/main.ts': `${ENTRADA_DE_MENTIRA}void import('./areas/professor/Aprovar')\n`, 'src/areas/aluno/routes.ts': fachada(['./Tutor']) }), configFile: false })
    expect(telasImportadasDeFora(pelaEntrada)).toEqual(['index → tela-professor-Aprovar'])
  })

  it('a peça que importa um pedaço de tela da única área que a usa não reprova; a mesma peça alcançada por outra área, sim', async () => {
    // A colisão que apareceu com as telas do professor: uma peça e um módulo da área dividem uma dependência (o ícone), a
    // peça é usada por duas das três telas e o módulo da área pelas três. O bundler põe o ícone junto do módulo da área,
    // num pedaço `tela-professor-*`, e a peça, num `pecas-*` que o importa. Tudo só para o professor: não é vazamento.
    const comum = {
      'src/areas/professor/routes.ts': fachada(['./Home', './Conversa', './Time']),
      'src/areas/professor/Home.ts': modulo('Home', "import { faixa } from '../../components/ui/ai/faixa'\nimport { avisos } from './avisos'\nconsole.log(faixa(), avisos())\n"),
      'src/areas/professor/Conversa.ts': modulo('Conversa', "import { avisos } from './avisos'\nconsole.log(avisos())\n"),
      'src/areas/professor/Time.ts': modulo('Time', "import { faixa } from '../../components/ui/ai/faixa'\nimport { avisos } from './avisos'\nconsole.log(faixa(), avisos())\n"),
      'src/areas/professor/avisos.ts': modulo('avisos', "import { icone } from '../../icone'\nconsole.log(icone())\n"),
      'src/components/ui/ai/faixa.ts': modulo('faixa', "import { icone } from '../../../icone'\nconsole.log(icone())\n"),
      'src/icone.ts': modulo('icone'),
      'src/areas/aluno/routes.ts': fachada(['./Tutor']),
      'src/areas/aluno/Tutor.ts': modulo('Tutor'),
    }
    const chunks = await chunksDoBuild({ raiz: projetoDeMentira({ ...comum, 'src/main.ts': ENTRADA_DE_MENTIRA }), configFile: false })
    const daPeca = chunks.find((chunk) => chunk.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/src/components/ui/ai/faixa.ts')))
    const doIcone = chunks.find((chunk) => chunk.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/src/icone.ts')))
    // A colisão está de pé: a peça num `pecas-*`, o ícone num pedaço de tela do professor, e um importando o outro.
    expect(daPeca?.fileName).toMatch(/^assets\/pecas-/)
    expect(doIcone?.fileName).toMatch(/^assets\/tela-professor-/)
    expect(daPeca?.imports).toContain(doIcone?.fileName)
    // E não reprova: quem alcança a peça são só telas do professor.
    expect(telasImportadasDeFora(chunks)).toEqual([])
    expect(modulosDeAreaForaDoLugar(chunks)).toEqual([])

    // O controle: a tela do aluno que alcança o módulo do professor por dentro de um pedaço dividido reprova, mesmo sem
    // importar a tela direto. Aqui o aluno usa a peça, e a peça importa o aviso do professor.
    const vazando = await chunksDoBuild({
      raiz: projetoDeMentira({
        ...comum,
        'src/main.ts': ENTRADA_DE_MENTIRA,
        'src/components/ui/ai/faixa.ts': modulo('faixa', "import { avisos } from '../../../areas/professor/avisos'\nconsole.log(avisos())\n"),
        'src/areas/aluno/Tutor.ts': modulo('Tutor', "import { faixa } from '../../components/ui/ai/faixa'\nconsole.log(faixa())\n"),
      }),
      configFile: false,
    })
    expect(telasImportadasDeFora(vazando).some((achado) => /^(?:aluno|tela-aluno-Tutor) → tela-professor-/.test(achado))).toBe(true)
  })

  it('controle do primeiro carregamento: conta o que a entrada importa estaticamente, reprova acima de 150 kB, e não conta o import()', async () => {
    // Base64 de bytes aleatórios não comprime: 90 mil bytes viram uns 120 kB em base64 e quase isso em brotli.
    const pesado = (nome: string) => `export const ${nome} = '${randomBytes(90_000).toString('base64')}'\n`
    const raiz = projetoDeMentira({
      'src/main.ts': "import { a } from './a'\nconsole.log(a.length)\nvoid import('./areas/professor/routes').then((m) => console.log(m.default()))\n",
      'src/a.ts': `import { b } from './b'\n${pesado('a')}console.log(b.length)\n`,
      'src/b.ts': pesado('b'),
      // O texto é usado inteiro, junto do título da página: `area.length` o minificador trocaria pelo número, e o peso sumiria.
      'src/areas/professor/routes.ts': `${pesado('area')}export default function rotas(): string {\n  return area + document.title\n}\n`,
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    // O que a entrada importa estaticamente, transitivamente, entra na conta, e passa do teto; a mensagem diz quanto e onde.
    expect(excessoDoPrimeiroCarregamento(chunks)).toMatch(/^primeiro carregamento com \d+\.\d kB em brotli, acima de 150 kB; os maiores: index \d+\.\d kB$/)
    // O pedaço da área, só por import(), tem o mesmo peso e fica de fora.
    const { total, pedacos } = primeiroCarregamento(chunks)
    expect(pedacos.map((pedaco) => pedaco.nome)).toEqual(['index'])
    expect(total).toBeGreaterThan(TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES)
    expect(chunks.map((chunk) => [chunk.fileName.replace(/-[\w-]{8}\.js$/, ''), brotliCompressSync(chunk.code).length > 80_000])).toContainEqual(['assets/professor', true])

    // O par: o mesmo peso, com o segundo módulo pesado só por import(), cabe. É a importação estática que decide.
    const leve = projetoDeMentira({
      'src/main.ts': "import { a } from './a'\nconsole.log(a.length)\nvoid import('./b').then((m) => console.log(m.b.length))\n",
      'src/a.ts': `export const a = '${randomBytes(40_000).toString('base64')}'\n`,
      'src/b.ts': pesado('b'),
    })
    expect(excessoDoPrimeiroCarregamento(await chunksDoBuild({ raiz: leve, configFile: false }))).toBeUndefined()
  })

  it('controle do teto de uma tela: a que passa de 30 kB em brotli aparece pelo nome, e a pequena ao lado dela, não', async () => {
    // Base64 de bytes aleatórios não comprime: 40 mil bytes viram mais de 30 kB em brotli.
    const pesada = `export const peso = '${randomBytes(40_000).toString('base64')}'\n${modulo('Governanca')}`
    const raiz = projetoDeMentira({
      'src/main.ts': "void import('./areas/coordenacao/routes').then((m) => console.log(m.default()))\n",
      'src/areas/coordenacao/routes.ts': fachada(['./Governanca', './Agentes']),
      'src/areas/coordenacao/Governanca.ts': pesada,
      'src/areas/coordenacao/Agentes.ts': modulo('Agentes'),
    })
    const estouradas = telasAcimaDoTeto(await chunksDoBuild({ raiz, configFile: false }))
    expect(estouradas).toEqual([expect.stringMatching(/^tela-coordenacao-Governanca: \d+\.\d kB em brotli, acima de 30 kB$/)])
    expect(TETO_DE_UMA_TELA_EM_BYTES).toBe(30_000)
  })

  it('controle do B2: um import estático de src/operacao/ na entrada aparece como módulo da operação no chunk de entrada', async () => {
    const raiz = projetoDeMentira({
      'src/main.ts': "import { area } from './operacao/area'\nconsole.log(area)\n",
      'src/operacao/area.ts': "export const area = 'operação'\n",
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    expect(operacaoNaEntrada(chunks)).toEqual([expect.stringMatching(/\/src\/operacao\/area\.ts$/)])
  })

  it('o mesmo módulo por import() não entra na entrada e sai como operacao-*', async () => {
    const raiz = projetoDeMentira({
      'src/main.ts': "void import('./operacao/area').then((modulo) => console.log(modulo.area))\n",
      'src/operacao/area.ts': "export const area = 'operação'\n",
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    expect(operacaoNaEntrada(chunks)).toEqual([])
    expect(chunks.map((chunk) => chunk.fileName)).toContainEqual(expect.stringMatching(/^assets\/operacao-[^/]+\.js$/))
  })

  it('um chunk por import() de um módulo cujo nome começa por index não cai no glob da entrada', async () => {
    // Recomendação da tarefa 2.0: com o nome padrão, este chunk seria `index-lento-*.js`, e o `index-*.js` do teto de
    // 150 kB o mediria como se fosse a entrada.
    const raiz = projetoDeMentira({
      'src/main.ts': "void import('./index-lento').then((modulo) => console.log(modulo.pagina))\n",
      'src/index-lento.ts': "export const pagina = 'uma página'\n",
    })
    const chunks = await chunksDoBuild({ raiz, configFile: false })
    const noGlobDaEntrada = chunks.filter((chunk) => /^assets\/index-/.test(chunk.fileName))
    expect(noGlobDaEntrada.map((chunk) => chunk.isEntry)).toEqual([true])
    expect(chunks.map((chunk) => chunk.fileName)).toContainEqual(expect.stringMatching(/^assets\/parte-index-lento-[^/]+\.js$/))
  })
})
