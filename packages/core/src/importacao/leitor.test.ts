import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { lerTabela, normalizarTexto } from './leitor.js'

const COLUNAS = ['inicio', 'fim', 'tipo', 'descricao'] as const

function recusa(texto: string): void {
  expect(() => lerTabela(texto, COLUNAS)).toThrow(expect.objectContaining({ codigo: ErrorCode.ENTRADA_INVALIDA }) as Error)
}

describe('lerTabela', () => {
  it('lê pelo separador do cabeçalho, ponto e vírgula, tab ou vírgula, com os campos pelo nome da coluna', () => {
    for (const separador of [';', '\t', ',']) {
      const texto = ['inicio', 'fim', 'tipo', 'descricao'].join(separador) + '\n' + ['2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'].join(separador)
      expect(lerTabela(texto, COLUNAS).linhas, separador).toEqual([{ linha: 2, campos: { inicio: '2026-04-21', fim: '2026-04-21', tipo: 'feriado', descricao: 'Tiradentes' } }])
    }
  })

  it('aceita o cabeçalho em outra ordem, com caixa e acento diferentes, e tira o marcador de ordem de byte do Excel', () => {
    const texto = String.fromCharCode(0xfeff) + 'Descrição;TIPO;Fim;Início\nRecesso;recesso;2026-07-24;2026-07-13'
    expect(lerTabela(texto, COLUNAS).linhas).toEqual([{ linha: 2, campos: { descricao: 'Recesso', tipo: 'recesso', fim: '2026-07-24', inicio: '2026-07-13' } }])
  })

  it('o campo entre aspas guarda o separador e a aspa dobrada', () => {
    const texto = 'inicio;fim;tipo;descricao\n2026-04-21;2026-04-21;feriado;"Tiradentes; ""dia"" santo"'
    expect(lerTabela(texto, COLUNAS).linhas[0]?.campos?.['descricao']).toBe('Tiradentes; "dia" santo')
  })

  it('a quebra de linha do Windows (CRLF) e a do Mac antigo (CR) separam as linhas, sem sobrar o retorno no último campo', () => {
    for (const quebra of ['\r\n', '\r', '\n']) {
      const texto = ['inicio;fim;tipo;descricao', '2026-04-21;2026-04-21;feriado;Tiradentes', '2026-05-01;2026-05-01;feriado;Trabalho'].join(quebra)
      expect(lerTabela(texto, COLUNAS).linhas.map((linha) => [linha.linha, linha.campos?.['descricao']]), JSON.stringify(quebra)).toEqual([
        [2, 'Tiradentes'],
        [3, 'Trabalho'],
      ])
    }
  })

  it('a aspa no meio do campo é letra, e só a que abre o campo agrupa', () => {
    const texto = 'inicio;fim;tipo;descricao\n2026-04-21;2026-04-21;feriado;Dom "Pedro" II'
    expect(lerTabela(texto, COLUNAS).linhas[0]?.campos?.['descricao']).toBe('Dom "Pedro" II')
  })

  it('linha em branco é ignorada mas conta no número da linha; linha com campos a mais ou a menos volta com `campos: null`', () => {
    const texto = 'inicio;fim;tipo;descricao\n\n2026-04-21;2026-04-21;feriado\n2026-04-22;2026-04-22;feriado;a;b\n2026-04-23;2026-04-23;feriado;ok\r\n'
    expect(lerTabela(texto, COLUNAS).linhas.map(({ linha, campos }) => [linha, campos === null])).toEqual([
      [3, true],
      [4, true],
      [5, false],
    ])
  })

  it('texto vazio, só o cabeçalho, cabeçalho de outra planilha, coluna repetida ou faltando: ENTRADA_INVALIDA', () => {
    recusa('')
    recusa('   \n  ')
    recusa('inicio;fim;tipo;descricao')
    recusa('inicio;fim;tipo;descricao\n\n')
    recusa('nome;matricula\nAna;1')
    recusa('inicio;inicio;tipo;descricao\n1;2;3;4')
    recusa('inicio;fim;tipo\n1;2;3')
    recusa('inicio;fim;tipo;descricao;extra\n1;2;3;4;5')
    recusa('a;b;c;d\n1;2;3;4')
    recusa('2026-04-21;2026-04-21;feriado;Tiradentes')
  })
})

describe('normalizarTexto', () => {
  it('tira acento, caixa e espaço a mais', () => {
    expect(normalizarTexto('  Início   DO  Ano ')).toBe('inicio do ano')
  })
})
