import { DomainException } from '@educa/core'
import { ErrorCode, MAXIMO_DE_BYTES_DA_LISTA, MAXIMO_DE_LINHAS_DA_LISTA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { lerTextoDaLista } from './lista-reader.js'

/** O código do `DomainException` que a leitura lançou, ou `undefined` se ela não lançou. */
function codigoDaRecusa(texto: string): string | undefined {
  try {
    lerTextoDaLista(texto)
    return undefined
  } catch (erro) {
    if (erro instanceof DomainException) return erro.codigo
    throw erro
  }
}

/** Só nome e matrícula, na ordem. */
const pares = (texto: string) => lerTextoDaLista(texto).map(({ nome, matricula }) => [nome, matricula])

/** `quantas` linhas de aluno distintas, com o separador. */
const linhasDeAluno = (quantas: number, separador = ';') => Array.from({ length: quantas }, (_, posicao) => `Aluno ${String(posicao)}${separador}m-${String(posicao)}`)

describe('E3: a leitura do texto da lista (A1, 2.0, e o teto da planilha, 8.0)', () => {
  it('lê `;`, `,` e tabulação, uma linha por aluno, com nome e matrícula', () => {
    for (const separador of [';', ',', '\t']) {
      expect(pares(`Ana Souza${separador}101\nBruno Lima${separador}102`), JSON.stringify(separador)).toEqual([
        ['Ana Souza', '101'],
        ['Bruno Lima', '102'],
      ])
    }
  })

  it('o separador é o da primeira linha, na ordem tabulação, `;`, `,`, e vale para o texto inteiro', () => {
    // A vírgula dentro do nome não separa quando o separador é o `;` ou a tabulação.
    expect(pares('Souza, Ana;101\nLima, Bruno;102')).toEqual([
      ['Souza, Ana', '101'],
      ['Lima, Bruno', '102'],
    ])
    expect(pares('Souza; Ana\t101')).toEqual([['Souza; Ana', '101']])
    // Com a vírgula escolhida pela primeira linha, o `;` da segunda é texto.
    expect(pares('Ana,101\nBruno;102,103')).toEqual([
      ['Ana', '101'],
      ['Bruno;102', '103'],
    ])
  })

  it('o cabeçalho é reconhecido, em qualquer caixa e com ou sem acento, é ignorado, e dá a ordem das colunas', () => {
    expect(pares('Nome;Matrícula\nAna;101')).toEqual([['Ana', '101']])
    expect(pares('NOME DO ALUNO,MATRICULA\nAna,101')).toEqual([['Ana', '101']])
    expect(pares('matrícula\tnome completo\n101\tAna')).toEqual([['Ana', '101']])
    // Sem cabeçalho, a primeira linha é de aluno.
    expect(pares('Ana;101\nBruno;102')).toHaveLength(2)
    // Um campo só com as duas palavras não é cabeçalho: sem a coluna da matrícula, a linha é de aluno e mostra o erro dela.
    expect(pares('Nome e matrícula\nAna')).toEqual([
      ['Nome e matrícula', ''],
      ['Ana', ''],
    ])
  })

  it('coluna a mais é ignorada; campo que falta vira vazio', () => {
    expect(pares('Ana;101;8ºA;;\nBruno')).toEqual([
      ['Ana', '101'],
      ['Bruno', ''],
    ])
  })

  it('aspas guardam o separador e a aspa dobrada; a aspa que não fecha leva o resto da linha', () => {
    expect(pares('"Souza; Ana";"10;1"\n"Ana ""Nina"" Lima";102\n"Bruno;103')).toEqual([
      ['Souza; Ana', '10;1'],
      ['Ana "Nina" Lima', '102'],
      ['Bruno;103', ''],
    ])
    // Espaço antes da aspa de abertura ainda abre as aspas; a aspa no meio do campo é texto.
    expect(pares(' "Souza; Ana" ;101\nD"Ávila;102')).toEqual([
      ['Souza; Ana', '101'],
      ['D"Ávila', '102'],
    ])
  })

  it('o BOM do Excel sai, e não impede de reconhecer o cabeçalho', () => {
    expect(pares('\uFEFFNome;Matrícula\nAna;101')).toEqual([['Ana', '101']])
    expect(pares('\uFEFFAna;101')).toEqual([['Ana', '101']])
  })

  it('o separador vem da primeira linha que tem um: a linha em branco e o título sem separador antes dela não mudam a leitura', () => {
    expect(lerTextoDaLista('\n  \nAna;101')).toEqual([{ linha: 3, nome: 'Ana', matricula: '101' }])
    expect(pares('Lista do 8ºA\nAna;101\nBruno;102')).toEqual([
      ['Lista do 8ºA', ''],
      ['Ana', '101'],
      ['Bruno', '102'],
    ])
  })

  it('o título com vírgula antes da lista escolhe a vírgula: as linhas com `;` saem sem matrícula, e a prévia mostra (13.0)', () => {
    expect(pares('Turma 8ºA, manhã\nAna;101')).toEqual([
      ['Turma 8ºA', 'manhã'],
      ['Ana;101', ''],
    ])
  })

  it('sem separador em linha nenhuma, cada linha é um campo só, também com o `;` entre aspas', () => {
    expect(pares('"Souza; Ana"\nBruno')).toEqual([
      ['"Souza; Ana"', ''],
      ['Bruno', ''],
    ])
  })

  it('linha em branco e linha só com separadores são ignoradas, e a numeração é a do arquivo', () => {
    const lidas = lerTextoDaLista('Nome;Matrícula\r\n\r\nAna;101\n  \n;;\n\t\rBruno;102\n')
    expect(lidas).toEqual([
      { linha: 3, nome: 'Ana', matricula: '101' },
      { linha: 7, nome: 'Bruno', matricula: '102' },
    ])
  })

  it('nome e matrícula sem espaço nas pontas, também dentro das aspas', () => {
    expect(pares('  Ana Souza  ;  101 \n" Bruno ";" 102 "')).toEqual([
      ['Ana Souza', '101'],
      ['Bruno', '102'],
    ])
  })

  it('3.000 linhas de aluno passam; 3.001 recusam com ENTRADA_INVALIDA; o cabeçalho e a linha em branco não contam (o teto da planilha, F2, 8.0)', () => {
    expect(MAXIMO_DE_LINHAS_DA_LISTA).toBe(3000)
    expect(lerTextoDaLista(['Nome;Matrícula', '', ...linhasDeAluno(3000), ''].join('\n'))).toHaveLength(3000)
    expect(codigoDaRecusa(linhasDeAluno(3001).join('\n'))).toBe(ErrorCode.ENTRADA_INVALIDA)
  })

  it('512 KB em UTF-8 passam; 512 KB + 1 byte recusam com ENTRADA_INVALIDA, contando o acento como dois bytes', () => {
    expect(MAXIMO_DE_BYTES_DA_LISTA).toBe(524_288)
    const nome = 'á'.repeat(99)
    const linha = `${nome};m-000000`
    // Cada linha tem 198 + 9 bytes e o `\n`: 208 bytes, e 199 linhas dão 41.392. O resto vai numa linha de preenchimento.
    const base = Array.from({ length: 199 }, (_, posicao) => `${nome};m-${String(posicao).padStart(6, '0')}`).join('\n')
    expect(Buffer.byteLength(linha, 'utf8')).toBe(207)
    const falta = MAXIMO_DE_BYTES_DA_LISTA - Buffer.byteLength(`${base}\nx;`, 'utf8')
    const noLimite = `${base}\nx;${'1'.repeat(falta)}`
    expect(Buffer.byteLength(noLimite, 'utf8')).toBe(MAXIMO_DE_BYTES_DA_LISTA)
    expect(lerTextoDaLista(noLimite)).toHaveLength(200)
    expect(codigoDaRecusa(`${noLimite}1`)).toBe(ErrorCode.ENTRADA_INVALIDA)
  })

  it('texto sem nenhuma linha de aluno recusa com ENTRADA_INVALIDA: vazio, só em branco, só separadores, só o cabeçalho', () => {
    for (const texto of ['', '\n\n  \n', ';;\n ; ;', ',,', '\uFEFF', 'Nome;Matrícula\n\n']) expect(codigoDaRecusa(texto), JSON.stringify(texto)).toBe(ErrorCode.ENTRADA_INVALIDA)
  })
})
