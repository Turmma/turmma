import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { alvosQueSumiram, INDICE_DOS_LOTES, lerArquivosParaIds, PASTA_DOS_LOTES, verificarIdsRetidos, type ArquivoParaIds } from './ids-retidos-sem-texto.ts'

// A guarda dos ids retidos (reserva-e-avaliacao, 10.0; RF14): o id de `docs/aia/ouro-retido/` só aparece fora da pasta sozinho. As frases das fixtures
// são de teste: nenhuma é de lote, e o teste não abre `docs/aia/ouro-retido/`.

const PASTA_DAS_FIXTURES = 'tools/guardas/__fixtures__/ids-retidos'

/** Uma fixture lida como se fosse o arquivo do caminho dado: o que se prova é o que o texto dela faz. */
function fixtureComo(nome: string, caminho: string): ArquivoParaIds {
  return { caminho, texto: readFileSync(join(raizRepositorio, PASTA_DAS_FIXTURES, nome), 'utf8') }
}

const UM_MD = 'docs/aia/diagnostico-por-habilidade.md'

// Os ids de mentira são montados, para este arquivo não ter, ele mesmo, um id com texto ao lado (a guarda lê o repositório inteiro).
const IDS = { lote: ['RT', '001'].join('-'), injecao: ['CR', '025'].join('-') }

describe('o id com texto ao lado, fora da pasta dos lotes', () => {
  it('o `CR-025` com a frase entre parênteses num .md quebra; o id sozinho passa', () => {
    expect(verificarIdsRetidos([fixtureComo('texto-ao-lado.md', UM_MD)])).toEqual([expect.objectContaining({ arquivo: UM_MD, id: 'CR-025', motivo: expect.stringContaining('texto ao lado') })])
    expect(verificarIdsRetidos([fixtureComo('id-sozinho.md', UM_MD)])).toEqual([])
  })

  it.each([
    ['aspas-antes.md', 'RJ-022'],
    ['parafrase-na-linha-de-baixo.md', 'CR-048'],
    ['dois-pontos.md', 'RQ-007'],
  ])('%s: o id %s com a frase antes, na linha de baixo ou depois de dois pontos é acusado', (nome, id) => {
    expect(verificarIdsRetidos([fixtureComo(nome, UM_MD)]).map((violacao) => violacao.id)).toEqual([id])
  })

  it('o `relatorio.md` de docs/avaliacao/ é lido como qualquer .md', () => {
    const relatorio = 'docs/avaliacao/finalista-a/2026-11-22/relatorio.md'
    expect(verificarIdsRetidos([fixtureComo('texto-ao-lado.md', relatorio)]).map((violacao) => violacao.arquivo)).toEqual([relatorio])
    expect(verificarIdsRetidos([fixtureComo('id-sozinho.md', relatorio)])).toEqual([])
  })

  it('a pasta dos lotes não é cobrada: é lá que a frase mora', () => {
    expect(verificarIdsRetidos([fixtureComo('texto-ao-lado.md', `${PASTA_DOS_LOTES}/README.md`), fixtureComo('lote-copiado.json', `${PASTA_DOS_LOTES}/riscoAVida-retido-1.json`)])).toEqual([])
  })
})

describe('o lote copiado', () => {
  it('o lote em tools/ia/amostras/ quebra, um por id; o resultado só com id e resultado passa', () => {
    const copia = verificarIdsRetidos([fixtureComo('lote-copiado.json', 'tools/ia/amostras/riscoAVida-retido-1.json')])
    expect(copia.map((violacao) => violacao.id)).toEqual(['RT-001', 'RT-002'])
    expect(copia[0]?.motivo).toContain('"texto"')
    expect(verificarIdsRetidos([fixtureComo('resultado-so-com-id.json', 'docs/avaliacao/finalista-a/2026-11-22/resultado.json')])).toEqual([])
  })

  it('o `saidas.jsonl` com a saída ao lado do id quebra, e a linha só com id e resultado passa', () => {
    const violacoes = verificarIdsRetidos([fixtureComo('saidas-com-texto.jsonl', 'docs/avaliacao/finalista-a/2026-11-22/saidas.jsonl')])
    expect(violacoes.map((violacao) => violacao.id)).toEqual(['RQ-002'])
    expect(violacoes[0]?.motivo).toContain('"saida"')
  })

  it('o JSON que não abre, com id dentro, quebra: sem prova de que não tem texto', () => {
    const violacoes = verificarIdsRetidos([fixtureComo('json-quebrado.json', 'docs/avaliacao/finalista-a/resultado.json')])
    expect(violacoes).toEqual([expect.objectContaining({ id: 'RT-001', motivo: expect.stringContaining('não abre') })])
  })
})

/** O texto como se fosse o arquivo do caminho dado, sem fixture: o caso conta a frase inteira. */
const comoTexto = (texto: string, caminho = UM_MD): ArquivoParaIds => ({ caminho, texto })
const idsAcusados = (arquivo: ArquivoParaIds): string[] => verificarIdsRetidos([arquivo]).map((violacao) => violacao.id)
const ID_A = ['RJ', '022'].join('-')
const ID_B = ['RT', '001'].join('-')
const ID_C = ['RQ', '002'].join('-')

describe('onde está o texto ao lado', () => {
  it('a lista de ids entre parênteses não é texto; o parêntese com palavras é', () => {
    expect(idsAcusados(comoTexto(`Os ids ${ID_B} (${ID_C} e ${ID_A}) ficam na lista.`))).toEqual([])
    expect(idsAcusados(comoTexto(`O id ${ID_B} (veja a frase) fica com texto.`))).toEqual([ID_B])
  })

  it('as aspas só contam na mesma frase: depois do ponto e espaço, e da quebra de linha, não', () => {
    expect(idsAcusados(comoTexto(`Em ${ID_A} o professor disse “algo”.`))).toEqual([ID_A])
    expect(idsAcusados(comoTexto(`Veja ${ID_A} sozinho. Outra frase, com “aspas”.`))).toEqual([])
    expect(idsAcusados(comoTexto(`Veja ${ID_A} sozinho\nOutra linha, com “aspas”.`))).toEqual([])
  })

  it('a aspa que abre no fim do alcance conta; a que está além do alcance da frase, não', () => {
    expect(idsAcusados(comoTexto(`veja ${ID_A} e “`))).toEqual([ID_A])
    expect(idsAcusados(comoTexto(`veja ${ID_A} ${'e '.repeat(60)}“x”`))).toEqual([])
  })

  it('o id colado a enfeite de markdown (crase, ênfase) segue lido: a frase depois do enfeite é texto', () => {
    expect(idsAcusados(comoTexto(`**\`${ID_A}\`** (a frase do lote)`))).toEqual([ID_A])
    expect(idsAcusados(comoTexto(`“a frase do lote” \`${ID_A}\``))).toEqual([ID_A])
    expect(idsAcusados(comoTexto(`“a frase do lote” (${ID_A})`))).toEqual([ID_A])
  })

  it('o id no começo e no fim do arquivo é lido sem erro', () => {
    expect(idsAcusados(comoTexto(ID_A))).toEqual([])
    expect(idsAcusados(comoTexto(`${ID_A} (x)`))).toEqual([ID_A])
    expect(idsAcusados(comoTexto(`(${ID_A}`))).toEqual([])
  })
})

describe('o lote copiado em código', () => {
  const emCodigo = (texto: string, caminho = 'packages/core/src/ia/tutor.test.ts'): ArquivoParaIds => comoTexto(texto, caminho)

  it('o `{ id, texto }` com aspas simples, aspas duplas ou crase num `.ts` ou `.tsx` é acusado, com a chave antes ou depois do id', () => {
    expect(idsAcusados(emCodigo(`const lote = [{ id: '${ID_B}', texto: 'a frase inteira do lote retido' }]`))).toEqual([ID_B])
    expect(idsAcusados(emCodigo(`const lote = [{ id: \`${ID_B}\`, frase: \`a frase\` }]`, 'apps/web/src/lote.tsx'))).toEqual([ID_B])
    expect(idsAcusados(emCodigo(`const lote = [{ texto: 'a frase inteira', id: '${ID_C}' }]`))).toEqual([ID_C])
  })

  it('o lote copiado pela metade, sem a chave que abre ou sem a que fecha, também é acusado', () => {
    expect(idsAcusados(emCodigo(`id: '${ID_B}', texto: 'a frase' }`))).toEqual([ID_B])
    expect(idsAcusados(emCodigo(`const lote = [{ id: '${ID_B}', texto: '`))).toEqual([ID_B])
  })

  it('o id sozinho, ou com chave que não é de texto, num `.ts` passa; e o mesmo texto num `.md` não é lido como código', () => {
    expect(idsAcusados(emCodigo(`const ids = ['${ID_B}', '${ID_C}']`))).toEqual([])
    expect(idsAcusados(emCodigo(`const resultado = { id: '${ID_B}', passou: true }`))).toEqual([])
    expect(idsAcusados(emCodigo(`const outro = { id: '${ID_B}' }; const dois = { texto: 'x' }`))).toEqual([])
    expect(idsAcusados(emCodigo(`{ id: '${ID_B}', texto: 'x' }`, 'docs/aia/exemplo.md'))).toEqual([])
  })

  it('o lote copiado numa fixture de outra pasta que `tools/guardas/__fixtures__/` é acusado', () => {
    expect(idsAcusados(comoTexto(JSON.stringify([{ id: ID_B, texto: 'a frase' }]), 'packages/core/src/ia/__fixtures__/x.json'))).toEqual([ID_B])
  })
})

describe('o objeto do JSON', () => {
  const comoJson = (valor: unknown, caminho = 'docs/avaliacao/x/resultado.json'): ArquivoParaIds => comoTexto(JSON.stringify(valor), caminho)

  it('o objeto fundo, com lista, número, texto solto e nulo ao lado, é percorrido e só o do id com texto quebra', () => {
    // O `{ id: ID_A }` sem texto prova que o arquivo foi percorrido: se o percurso quebrasse, o `catch` acusaria todo id do arquivo.
    const arquivo = comoJson({ itens: [null, 5, 'texto solto', { id: ID_A }, { id: ID_B, razao: 'a frase' }, [{ id: ID_C, saida: 'outra' }]] })
    expect(idsAcusados(arquivo)).toEqual([ID_B, ID_C])
  })

  it('o `id` que não é só um id, a chave de texto vazia e a que não é texto não acusam', () => {
    expect(idsAcusados(comoJson({ id: `lote ${ID_B}`, texto: 'x' }))).toEqual([])
    expect(idsAcusados(comoJson({ id: ID_B, texto: '' }))).toEqual([])
    expect(idsAcusados(comoJson({ id: ID_B, texto: 5 }))).toEqual([])
    expect(idsAcusados(comoJson({ id: ID_B }))).toEqual([])
  })

  it('o `.jsonl` com linha em branco no meio é lido linha a linha; o `.json` com duas linhas de objeto, não', () => {
    const linhas = `${JSON.stringify({ id: ID_B })}\n\n${JSON.stringify({ id: ID_C, resultado: 'ok' })}\n`
    expect(idsAcusados(comoTexto(linhas, 'docs/avaliacao/x/saidas.jsonl'))).toEqual([])
    expect(idsAcusados(comoTexto(linhas, 'docs/avaliacao/x/saidas.json'))).toEqual([ID_B, ID_C])
  })
})

describe('a varredura do disco', () => {
  it('lê só o que cabe, só as extensões de texto e não o `package-lock.json` nem o `node_modules`', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'ids-retidos-varredura-'))
    const escrever = (caminho: string, texto: string): void => {
      mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    escrever('docs/pequeno.md', 'x')
    escrever('docs/grande.md', 'x'.repeat(50))
    escrever('docs/imagem.png', 'x')
    escrever('package-lock.json', 'x')
    escrever('node_modules/pacote/leia.md', 'x')
    escrever('docs/aia/ouro-retido-ao-lado/outro.md', 'x')
    try {
      expect(
        lerArquivosParaIds(raiz, 10)
          .map((arquivo) => arquivo.caminho)
          .sort(),
      ).toEqual(['docs/aia/ouro-retido-ao-lado/outro.md', 'docs/pequeno.md'])
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })
})

const textoComId = (id: string): string => id + ' ("x")'

describe('o alvo some', () => {
  function raizCom(arquivos: Record<string, string>): string {
    const raiz = mkdtempSync(join(tmpdir(), 'ids-retidos-'))
    for (const [caminho, texto] of Object.entries(arquivos)) {
      mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    return raiz
  }

  it('a pasta docs/aia/ouro-retido/ some, ou o índice, e a guarda reprova em vez de passar em branco', () => {
    const completa = raizCom({ [INDICE_DOS_LOTES]: '{ "lotes": [] }' })
    const semIndice = raizCom({ [`${PASTA_DOS_LOTES}/README.md`]: '' })
    const semPasta = raizCom({ 'docs/outro.md': '' })
    try {
      expect(alvosQueSumiram(completa)).toEqual([])
      expect(alvosQueSumiram(semIndice)).toEqual([INDICE_DOS_LOTES])
      expect(alvosQueSumiram(semPasta)).toEqual([PASTA_DOS_LOTES, INDICE_DOS_LOTES])
    } finally {
      for (const raiz of [completa, semIndice, semPasta]) rmSync(raiz, { recursive: true })
    }
  })

  it('a varredura não lê a pasta dos lotes, o `achados/` das tarefas nem as fixtures das guardas, e lê o resto, as outras fixtures e o `relatorio.md` da avaliação incluídos', () => {
    const lote = JSON.stringify([{ id: IDS.lote, texto: 'x' }])
    const raiz = raizCom({
      [`${PASTA_DOS_LOTES}/lote.json`]: lote,
      'tasks/prd-x/achados/revisao.md': textoComId(IDS.injecao),
      'tools/guardas/__fixtures__/ids-retidos/texto-ao-lado.md': textoComId(IDS.injecao),
      'docs/aia/outra.md': textoComId(IDS.injecao),
      'packages/core/src/ia/__fixtures__/lote.json': lote,
      'docs/achados/nota.md': textoComId(IDS.injecao),
      'docs/avaliacao/finalista-a/2026-11-22/relatorio.md': textoComId(IDS.injecao),
    })
    try {
      const lidos = lerArquivosParaIds(raiz)
      expect(lidos.map((arquivo) => arquivo.caminho).sort()).toEqual(['docs/achados/nota.md', 'docs/aia/outra.md', 'docs/avaliacao/finalista-a/2026-11-22/relatorio.md', 'packages/core/src/ia/__fixtures__/lote.json'])
      // O que a varredura leu chega à guarda: o lote copiado numa fixture de outra pasta e o `relatorio.md` são acusados.
      expect(
        verificarIdsRetidos(lidos)
          .map((violacao) => violacao.arquivo)
          .sort(),
      ).toEqual(['docs/achados/nota.md', 'docs/aia/outra.md', 'docs/avaliacao/finalista-a/2026-11-22/relatorio.md', 'packages/core/src/ia/__fixtures__/lote.json'])
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })
})

describe('o repositório de verdade', () => {
  it('a árvore de hoje passa: nenhum id retido com texto fora de docs/aia/ouro-retido/, e a pasta está onde a guarda espera', () => {
    const arquivos = lerArquivosParaIds(raizRepositorio)
    // A lista vazia não é "nada a cobrar": é a leitura que não achou os arquivos.
    expect(arquivos.length).toBeGreaterThan(500)
    expect(verificarIdsRetidos(arquivos)).toEqual([])
    expect(alvosQueSumiram(raizRepositorio)).toEqual([])
  })
})
