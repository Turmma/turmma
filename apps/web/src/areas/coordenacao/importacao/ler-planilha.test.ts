import { MAXIMO_DE_BYTES_DA_PLANILHA, MAXIMO_DE_LINHAS_DA_PLANILHA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { lerPlanilha, linhasEmTexto, MAXIMO_DE_BYTES_DO_XLSX } from './ler-planilha'
import { montarXlsx } from '../../../__fixtures__/xlsx'

const xlsx = (linhas: Parameters<typeof montarXlsx>[0]) => new Blob([montarXlsx(linhas)])

describe('13.0 (unidade): a planilha lida no navegador vira texto', () => {
  it('o XLSX de verdade (pela biblioteca) vira linhas com ";" e a matrícula em texto mantém o zero à esquerda', async () => {
    const lida = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ['8º A', 'Ana Souza', '00123'], ['8º A', 'Bia Lima', '00124']]))
    expect(lida).toEqual({ ok: true, texto: 'turma;nome;matricula\n8º A;Ana Souza;00123\n8º A;Bia Lima;00124' })
  })

  it('a matrícula que o Excel guardou como número sai como o número que a pessoa vê, sem notação científica', async () => {
    const lida = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ['8º A', 'Ana', 123], ['8º A', 'Bia', 2026001]]))
    expect(lida).toEqual({ ok: true, texto: 'turma;nome;matricula\n8º A;Ana;123\n8º A;Bia;2026001' })
  })

  it('a data vira aaaa-mm-dd pelo dia da célula, qualquer que seja o fuso do navegador (a trava de CPF e data a segura na API)', async () => {
    const lida = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ['8º A', 'Ana', new Date(Date.UTC(2012, 1, 1))]]))
    expect(lida).toEqual({ ok: true, texto: 'turma;nome;matricula\n8º A;Ana;2012-02-01' })
  })

  it('o nome com ponto e vírgula ou aspas continua numa coluna só, entre aspas', async () => {
    const lida = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ['8º A', 'Ana; "Aninha" Souza', '1']]))
    expect(lida).toEqual({ ok: true, texto: 'turma;nome;matricula\n8º A;"Ana; ""Aninha"" Souza";1' })
  })

  it('o .xls antigo, que a biblioteca não abre, e o arquivo que não é planilha dizem "formato", e o zip quebrado também', async () => {
    const xls = new Uint8Array(2_000)
    xls.set([0xd0, 0xcf, 0x11, 0xe0])
    expect(await lerPlanilha(new Blob([xls]))).toEqual({ ok: false, motivo: 'formato' })
    const zipQuebrado = new Uint8Array(2_000)
    zipQuebrado.set([0x50, 0x4b, 0x03, 0x04])
    expect(await lerPlanilha(new Blob([zipQuebrado]))).toEqual({ ok: false, motivo: 'formato' })
  })

  it('o XLSX acima do teto nem é aberto', async () => {
    const grande = new Uint8Array(MAXIMO_DE_BYTES_DO_XLSX + 1)
    grande.set([0x50, 0x4b, 0x03, 0x04])
    expect(await lerPlanilha(new Blob([grande]))).toEqual({ ok: false, motivo: 'grande' })
  })

  it('as 3.000 linhas passam, a 3.001ª não: o teto é o mesmo do CSV, e o motivo diz "linhas"', async () => {
    const dados = (quantas: number) => Array.from({ length: quantas }, (_, posicao) => ['8º A', `Aluno ${String(posicao)}`, String(posicao)])
    const noTeto = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ...dados(MAXIMO_DE_LINHAS_DA_PLANILHA)]))
    expect(noTeto.ok).toBe(true)
    const acima = await lerPlanilha(xlsx([['turma', 'nome', 'matricula'], ...dados(MAXIMO_DE_LINHAS_DA_PLANILHA + 1)]))
    expect(acima).toEqual({ ok: false, motivo: 'linhas' })
  })

  it('o CSV com ";", o com tabulação e o com BOM vêm do leitor de texto e passam pelos mesmos tetos', async () => {
    expect(await lerPlanilha(new Blob(['turma;nome;matricula\n8º A;Ana;1\n']))).toEqual({ ok: true, texto: 'turma;nome;matricula\n8º A;Ana;1\n' })
    expect(await lerPlanilha(new Blob(['turma\tnome\tmatricula\n8º A\tAna\t1\n']))).toEqual({ ok: true, texto: 'turma\tnome\tmatricula\n8º A\tAna\t1\n' })
    expect(await lerPlanilha(new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), 'nome;matricula\nAna;1\n']))).toEqual({ ok: true, texto: 'nome;matricula\nAna;1\n' })
    expect(await lerPlanilha(new Blob([new Uint8Array(MAXIMO_DE_BYTES_DA_PLANILHA + 4).fill(0x61)]))).toEqual({ ok: false, motivo: 'grande' })
    // O teto de linhas vale para o CSV também (3.001 linhas curtas cabem nos bytes).
    const linhasCurtas = (quantas: number) => `n;m\n${Array.from({ length: quantas }, () => 'a;1').join('\n')}\n`
    expect((await lerPlanilha(new Blob([linhasCurtas(MAXIMO_DE_LINHAS_DA_PLANILHA - 1)]))).ok).toBe(true)
    expect(await lerPlanilha(new Blob([linhasCurtas(MAXIMO_DE_LINHAS_DA_PLANILHA + 1)]))).toEqual({ ok: false, motivo: 'linhas' })
  })
})

describe('13.0 (unidade): as linhas da aba em texto', () => {
  it('linha em branco no meio continua em branco (a numeração da prévia é a do Excel); as do fim saem', () => {
    expect(linhasEmTexto([['a', 'b'], [null, null], ['c', 'd'], [null, ''], []])).toBe('a;b\n\nc;d')
  })

  it('a linha curta é completada até a largura do cabeçalho, para a coluna não andar', () => {
    expect(linhasEmTexto([['turma', 'nome', 'matricula'], ['8º A', 'Ana']])).toBe('turma;nome;matricula\n8º A;Ana;')
    // A célula em branco do meio da linha não vira a palavra "null".
    expect(linhasEmTexto([['turma', 'nome', 'matricula'], ['8º A', null, 7], ['8º B', 'Bia', true]])).toBe('turma;nome;matricula\n8º A;;7\n8º B;Bia;true')
  })

  it('quebra de linha e tabulação dentro da célula viram espaço: a célula não parte a linha', () => {
    expect(linhasEmTexto([['nome', 'm'], ['Ana\nSouza\tLima', '1']])).toBe('nome;m\nAna Souza Lima;1')
  })
})
