import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { CAMINHO_DAS_AMOSTRAS_DA_GUARDA, verificarAmostrasDaD55, verificarAmostrasDaD55DaRaiz, type ArquivoDeAmostrasLido, type DetectorDaD55 } from './amostras-da-d55.ts'

// A guarda da D55 sobre as amostras (reserva-e-avaliacao, 10.0): a amostra que espera correção, nota ou devolutiva sobre texto de aluno é proibida,
// e o arquivo precisa das que pedem isso com `esperado: recusa`. Quem reconhece o pedido é o detector da D55 do núcleo, carregado aqui como o
// `tools/ia/medir-risco-a-vida.test.ts` carrega o provedor: por caminho em variável, porque o `tsconfig` de `tools/` não compila o núcleo.

const PASTA_DAS_FIXTURES = 'tools/guardas/__fixtures__/amostras-da-d55'
const CAMINHO_DO_DETECTOR = '../../packages/core/src/ia/tasks/propor-ferramenta.ts'

interface ModuloDoDetector {
  conversaPedeJulgamentoDeTextoDeAluno: (mensagem: string, turnosAnteriores: readonly { autor: string; texto: string }[], semProposta?: boolean) => boolean
}

async function detectorDoNucleo(): Promise<DetectorDaD55> {
  const modulo = (await import(/* @vite-ignore */ CAMINHO_DO_DETECTOR)) as ModuloDoDetector
  return (entrada) => {
    const turnos = Array.isArray(entrada.turnosAnteriores) ? (entrada.turnosAnteriores as { autor: string; texto: string }[]) : []
    return modulo.conversaPedeJulgamentoDeTextoDeAluno(String(entrada.mensagem ?? ''), turnos, entrada.semProposta === true)
  }
}

type LinhaDeTeste = ArquivoDeAmostrasLido['linhas'][number]
type AmostraLidaDeTeste = NonNullable<LinhaDeTeste['amostras']>[number]

const lerFixture = (nome: string): ArquivoDeAmostrasLido => JSON.parse(readFileSync(join(raizRepositorio, PASTA_DAS_FIXTURES, nome), 'utf8')) as ArquivoDeAmostrasLido

describe('o pedido de nota de discursiva', () => {
  it('com `esperado: recusa` passa; com outro esperado, no mesmo texto, quebra', async () => {
    const detector = await detectorDoNucleo()
    expect(verificarAmostrasDaD55(lerFixture('completo.json'), detector)).toEqual([])
    const trocado = verificarAmostrasDaD55(lerFixture('nota-com-outro-esperado.json'), detector)
    expect(trocado.map((violacao) => violacao.onde)).toContain('d55_amostras, amostra d55_amostras-001')
    expect(trocado.map((violacao) => violacao.motivo).join('\n')).toContain('só espera "recusa"')
  })

  it('o arquivo sem nenhuma amostra de recusa da D55 quebra, mesmo com a rubrica certa', async () => {
    const violacoes = verificarAmostrasDaD55(lerFixture('sem-recusa.json'), await detectorDoNucleo())
    expect(violacoes).toEqual([expect.objectContaining({ onde: 'd55_amostras', motivo: expect.stringContaining('nenhuma amostra de recusa da D55') })])
  })

  it('texto de aluno marcado em amostra de outra linha cujo esperado não é recusa quebra, e a recusa da D55 com a marca passa', async () => {
    const violacoes = verificarAmostrasDaD55(lerFixture('texto-de-aluno-em-outra-linha.json'), await detectorDoNucleo())
    expect(violacoes).toEqual([expect.objectContaining({ onde: 'rubrica_de_discursiva, amostra rubrica_de_discursiva-001', motivo: expect.stringContaining('texto de aluno marcado só vale na linha d55_amostras') })])
  })
})

describe('quem contorna: o pedido em outra forma que o detector conhece, escondido numa linha que espera outra coisa', () => {
  it.each(['pedido-direto.json', 'pedido-disfarcado.json', 'texto-colado.json', 'rubrica-sob-medida.json'])('%s é acusado pelo detector', async (nome) => {
    const violacoes = verificarAmostrasDaD55(lerFixture(`contornos/${nome}`), await detectorDoNucleo())
    expect(violacoes.map((violacao) => violacao.onde)).toEqual(['rubrica_de_discursiva, amostra rubrica_de_discursiva-001'])
    expect(violacoes[0]?.motivo).toContain('o detector da D55 reconhece')
  })

  it('o controle: a rubrica de antes da aplicação, sem texto de aluno, o detector não reconhece, e ela passa', async () => {
    const violacoes = verificarAmostrasDaD55(lerFixture('completo.json'), await detectorDoNucleo())
    expect(violacoes).toEqual([])
  })

  it('sem o detector, a mesma fixture não é acusada: é o detector que dá o alcance, e por isso a guarda o recebe', () => {
    expect(verificarAmostrasDaD55(lerFixture('contornos/pedido-direto.json'), () => false)).toEqual([])
  })
})

describe('o alcance de cada cláusula', () => {
  const comoDoPedidoDireto = (muda: (rubrica: AmostraLidaDeTeste, linha: LinhaDeTeste) => void): ArquivoDeAmostrasLido => {
    const arquivo = lerFixture('contornos/pedido-direto.json')
    const linha = arquivo.linhas.find((candidata) => candidata.id === 'rubrica_de_discursiva') as LinhaDeTeste
    muda(linha.amostras?.[0] as AmostraLidaDeTeste, linha)
    return arquivo
  }

  it('o mesmo pedido numa tarefa que não é a de propor ferramenta não passa pelo detector', async () => {
    const arquivo = comoDoPedidoDireto((_rubrica, linha) => {
      linha.tarefa = 'plano_de_aula'
    })
    expect(verificarAmostrasDaD55(arquivo, await detectorDoNucleo())).toEqual([])
  })

  it('a amostra de propor ferramenta sem `entrada` não é lida pelo detector, e não derruba a guarda', async () => {
    const arquivo = comoDoPedidoDireto((rubrica) => {
      delete rubrica.entrada
    })
    expect(verificarAmostrasDaD55(arquivo, await detectorDoNucleo())).toEqual([])
  })

  it('a amostra da D55 com texto de aluno marcado e esperado que não é recusa é acusada também pela marca', async () => {
    const arquivo = lerFixture('completo.json')
    const daD55 = arquivo.linhas.find((linha) => linha.id === 'd55_amostras')?.amostras?.find((amostra) => amostra.trazTextoDeAluno === true) as AmostraLidaDeTeste
    daD55.esperado = 'correcao'
    const motivos = verificarAmostrasDaD55(arquivo, await detectorDoNucleo()).map((violacao) => violacao.motivo)
    expect(motivos.some((motivo) => motivo.includes('texto de aluno marcado só vale na linha'))).toBe(true)
  })

  it('a marca de texto de aluno numa linha que não é a da D55 é acusada mesmo com `esperado: recusa`', async () => {
    const arquivo = lerFixture('completo.json')
    const outra = arquivo.linhas.find((linha) => linha.id === 'rubrica_de_discursiva')?.amostras?.[0] as AmostraLidaDeTeste
    outra.esperado = 'recusa'
    outra.trazTextoDeAluno = true
    const violacoes = verificarAmostrasDaD55(arquivo, await detectorDoNucleo())
    expect(violacoes).toEqual([expect.objectContaining({ onde: expect.stringContaining('rubrica_de_discursiva'), motivo: expect.stringContaining('texto de aluno marcado só vale na linha') })])
  })

  it('a linha sem `amostras` (lotes, referência) passa, e o arquivo sem a linha da D55 quebra por falta de recusa', async () => {
    const detector = await detectorDoNucleo()
    const comLote = lerFixture('completo.json')
    comLote.linhas.push({ id: 'classificacao', tarefa: 'classificar_habilidade' })
    expect(verificarAmostrasDaD55(comLote, detector)).toEqual([])
    const semALinha = lerFixture('completo.json')
    semALinha.linhas = semALinha.linhas.filter((linha) => linha.id !== 'd55_amostras')
    expect(verificarAmostrasDaD55(semALinha, detector)).toEqual([expect.objectContaining({ onde: 'd55_amostras', motivo: expect.stringContaining('nenhuma amostra de recusa da D55') })])
  })
})

describe('o arquivo de amostras some', () => {
  it('sem o arquivo, a guarda reprova e não passa em branco', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'amostras-da-d55-'))
    try {
      expect(verificarAmostrasDaD55DaRaiz(raiz, await detectorDoNucleo())).toEqual([expect.objectContaining({ onde: CAMINHO_DAS_AMOSTRAS_DA_GUARDA, motivo: expect.stringContaining('não existe') })])
      mkdirSync(dirname(join(raiz, CAMINHO_DAS_AMOSTRAS_DA_GUARDA)), { recursive: true })
      writeFileSync(join(raiz, CAMINHO_DAS_AMOSTRAS_DA_GUARDA), '{ não é json')
      expect(verificarAmostrasDaD55DaRaiz(raiz, await detectorDoNucleo())).toEqual([expect.objectContaining({ motivo: expect.stringContaining('não abre') })])
      writeFileSync(join(raiz, CAMINHO_DAS_AMOSTRAS_DA_GUARDA), JSON.stringify(lerFixture('completo.json')))
      expect(verificarAmostrasDaD55DaRaiz(raiz, await detectorDoNucleo())).toEqual([])
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })
})

describe('o repositório de verdade', () => {
  it('as amostras de hoje passam na guarda da D55', async () => {
    expect(verificarAmostrasDaD55DaRaiz(raizRepositorio, await detectorDoNucleo())).toEqual([])
  })
})
