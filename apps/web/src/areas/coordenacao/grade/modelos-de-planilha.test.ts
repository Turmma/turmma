import { CABECALHOS_DA_PLANILHA, TIPOS_DE_PLANILHA } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baixarModeloDoTipo, MODELOS_DE_PLANILHA, textoDoModelo } from './modelos-de-planilha'

const baixar = vi.hoisted(() => vi.fn())
vi.mock('../../../components/download-from-url', () => ({ downloadFromUrl: baixar }))

describe('os modelos das quatro planilhas (14.0; RF1)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('há um modelo para cada tipo de planilha, na ordem em que a escola se monta, cada um com o nome do arquivo e o rótulo', () => {
    expect(MODELOS_DE_PLANILHA.map(({ tipo }) => tipo)).toEqual(['alunos', 'professores', 'grade', 'calendario'])
    expect([...MODELOS_DE_PLANILHA.map(({ tipo }) => tipo)].sort()).toEqual([...TIPOS_DE_PLANILHA].sort())
    expect(MODELOS_DE_PLANILHA.map(({ arquivo }) => arquivo)).toEqual(['modelo-alunos.csv', 'modelo-professores.csv', 'modelo-grade.csv', 'modelo-calendario.csv'])
  })

  it.each(TIPOS_DE_PLANILHA)('o texto do modelo de %s é o cabeçalho de packages/shared, separado por ponto e vírgula, com o BOM e mais nada', (tipo) => {
    expect(textoDoModelo(CABECALHOS_DA_PLANILHA[tipo])).toBe(`\uFEFF${CABECALHOS_DA_PLANILHA[tipo].join(';')}\r\n`)
  })

  it('o modelo da grade traz as oito colunas e o do calendário, as quatro, na ordem que a prévia confere', () => {
    expect(textoDoModelo(CABECALHOS_DA_PLANILHA.grade)).toContain('turma;disciplina;professor;email;dia;inicio;fim;sala')
    expect(textoDoModelo(CABECALHOS_DA_PLANILHA.calendario)).toContain('inicio;fim;tipo;descricao')
  })

  it('baixar entrega o arquivo do tipo com o nome dele, e o conteúdo é o cabeçalho do tipo', async () => {
    const criar = vi.fn(() => 'blob:modelo')
    vi.stubGlobal('URL', { createObjectURL: criar, revokeObjectURL: vi.fn() })
    baixar.mockClear()
    baixarModeloDoTipo('grade')
    expect(baixar).toHaveBeenCalledExactlyOnceWith('blob:modelo', 'modelo-grade.csv')
    const blob = (criar.mock.calls as unknown as [Blob][])[0]?.[0]
    // `Blob.text()` tira o BOM ao decodificar: os bytes é que provam que o arquivo o leva.
    const texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob?.arrayBuffer())
    expect(texto).toBe(textoDoModelo(CABECALHOS_DA_PLANILHA.grade))
    vi.unstubAllGlobals()
  })
})
