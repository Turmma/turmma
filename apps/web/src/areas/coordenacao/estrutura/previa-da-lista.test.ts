import type { PreviaRow, PreviaDaListaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { avisosDaPrevia, linhasNaOrdemDaTela, podeGravar, TEXTO_DO_ERRO_DA_LINHA } from './previa-da-lista'

const entra = (linha: number, nome: string, matricula: string): PreviaRow => ({ linha, nome, matricula, resultado: 'entra' })
const comErro = (linha: number, erro: NonNullable<PreviaRow['erro']>, nome = 'Nome', matricula = ''): PreviaRow => ({ linha, nome, matricula, resultado: 'erro', erro })
const previa = (linhas: PreviaRow[]): PreviaDaListaResponse => ({
  linhas,
  entram: linhas.filter((linha) => linha.resultado === 'entra').length,
  jaExistem: linhas.filter((linha) => linha.resultado === 'ja_existe').length,
  comErro: linhas.filter((linha) => linha.resultado === 'erro').length,
})

describe('W10 (unidade): a prévia na tela', () => {
  it('as linhas de erro vêm primeiro, cada grupo na ordem do texto', () => {
    const linhas = [entra(2, 'Ana', '1'), comErro(5, 'sem_matricula'), { ...entra(3, 'Bia', '2'), resultado: 'ja_existe' as const }, comErro(4, 'sem_nome')]
    expect(linhasNaOrdemDaTela(linhas).map((linha) => linha.linha)).toEqual([4, 5, 2, 3])
  })

  it('o título com vírgula antes da lista: metade ou mais das linhas, e pelo menos duas, sem matrícula', () => {
    expect(avisosDaPrevia([comErro(1, 'sem_matricula'), comErro(2, 'sem_matricula'), entra(3, 'Ana', '1'), entra(4, 'Bia', '2')])).toEqual(['titulo_antes_da_lista'])
    // Uma só sem matrícula é erro de digitação, não título.
    expect(avisosDaPrevia([comErro(1, 'sem_matricula'), entra(2, 'Ana', '1')])).toEqual([])
    expect(avisosDaPrevia([comErro(1, 'sem_matricula'), comErro(2, 'sem_matricula'), entra(3, 'Ana', '1'), entra(4, 'Bia', '2'), entra(5, 'Caio', '3')])).toEqual([])
  })

  it('o cabeçalho que o leitor não reconhece: a primeira linha sem erro com a matrícula sem algarismo', () => {
    expect(avisosDaPrevia([entra(1, 'Aluno', 'RA'), entra(2, 'Ana', '1001')])).toEqual(['cabecalho_nao_reconhecido'])
    expect(avisosDaPrevia([entra(1, 'Ana', 'A1001'), entra(2, 'Aluno', 'RA')])).toEqual([])
    // A primeira pelo número da linha, e não pela ordem da resposta.
    expect(avisosDaPrevia([entra(2, 'Ana', '1001'), entra(1, 'Nome', 'Código')])).toEqual(['cabecalho_nao_reconhecido'])
    // A primeira com erro já é apontada pelo erro.
    expect(avisosDaPrevia([comErro(1, 'matricula_repetida', 'Aluno', 'RA'), entra(2, 'Ana', '1')])).toEqual([])
  })

  it('a coluna que parece CPF ou data segura a gravação; a matrícula de verdade, não', () => {
    // A API marca a linha (correção 2026-10-03-trava-de-documento-so-na-tela): CPF pontuado, data, ou a coluna com
    // maioria de CPF sem pontuação. A tela avisa a coluna e segura com o motivo dela.
    const documento = 'Nada é gravado enquanto a segunda coluna parecer CPF ou data de nascimento.'
    for (const qual of ['123.456.789-09', '01/02/2012', '1/2/12', '2012-02-01', '12345678909']) {
      const lida = previa([comErro(1, 'matricula_parece_documento', 'Ana', qual), entra(2, 'Bia', '1002')])
      expect(avisosDaPrevia(lida.linhas), qual).toEqual(['coluna_parece_documento'])
      expect(podeGravar(lida), qual).toEqual({ pode: false, motivo: documento })
    }
    // A forma de CPF pontuado ou de data com outro erro antes ainda faz a tela avisar a coluna; o motivo é o do outro erro.
    const comOutroErro = previa([comErro(1, 'sem_nome', '', '123.456.789-09'), entra(2, 'Bia', '1002')])
    expect(avisosDaPrevia(comOutroErro.linhas)).toEqual(['coluna_parece_documento'])
    expect(podeGravar(comOutroErro)).toEqual({ pode: false, motivo: 'Corrija as linhas com erro no texto e veja a prévia de novo: a lista só é gravada sem erro nenhum.' })
    for (const matricula of ['12345678909', '2024-0001', '20240101']) {
      expect(avisosDaPrevia([entra(1, 'Ana', matricula)]), matricula).toEqual([])
    }
    expect(TEXTO_DO_ERRO_DA_LINHA.matricula_parece_documento).toBe('Parece CPF ou data de nascimento, e não matrícula: confira esta linha.')
  })

  it('grava só sem erro e com algo novo', () => {
    expect(podeGravar(previa([entra(1, 'Ana', '1')]))).toEqual({ pode: true })
    expect(podeGravar(previa([entra(1, 'Ana', '1'), comErro(2, 'sem_nome', '', '2')])).pode).toBe(false)
    expect(podeGravar(previa([{ ...entra(1, 'Ana', '1'), resultado: 'ja_existe' }]))).toEqual({ pode: false, motivo: 'Nada novo para gravar: todos os nomes já estão na lista desta turma.' })
  })
})
