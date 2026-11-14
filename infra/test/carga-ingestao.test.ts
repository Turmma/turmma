import { describe, expect, it } from 'vitest'
import {
  AMOSTRAS_MINIMAS_DO_TURNO,
  codigoDeSaidaDaIngestao,
  EXTRACOES_QUE_A_B_ESPERA,
  julgarIngestao,
  MARGEM_SOBRE_A_BASE_MS,
  NOITE_EM_SEGUNDOS,
  projetarAsTrezentas,
  TETO_DO_STATEMENT_MS,
  TOTAL_DE_PDFS,
  type MedidaDaIngestao,
} from '../scripts/conferir-carga-ingestao.ts'
import { argumentosDoK6DaIngestao, pdfUnico, SCRIPT_DO_K6_DA_INGESTAO, SESSOES_POR_GRUPO } from '../scripts/carga-ingestao.ts'

/**
 * O cenário "300 apostilas numa noite" sem subir nada (ingestao-do-material, tarefa 9.0; `cenarios.md`, "Carga"): o veredito critério por critério, o
 * controle negativo e o que o driver monta. A execução de verdade é `npm run carga:ingestao`, manual, com a corrida registrada no documento da tarefa.
 */

const LIMPA: MedidaDaIngestao = {
  envios: { aceitos: TOTAL_DE_PDFS, recusados: {} },
  // 300 PDFs em 60 s: 200 ms por PDF, 60 s projetados para as 300.
  extracoes: { prontos: TOTAL_DE_PDFS, falhos: 0, pendentes: 0, primeiroInicioMs: 1_000_000, ultimoFimMs: 1_060_000 },
  pdfDaB: { esperaMs: 900, extracoesDaAAntes: 1 },
  turnoDaBNaBase: { amostras: 180, p95Ms: 400 },
  turnoDaBNaIngestao: { amostras: 120, p95Ms: 700 },
  piorStatement: { forma: 'select 1', maximoMs: 300 },
}

const criterios = (medida: MedidaDaIngestao): string[] => julgarIngestao(medida).reprovacoes.map((reprovacao) => reprovacao.criterio)

describe('o veredito do cenário das 300 apostilas', () => {
  it('a medida limpa passa, e o relatório diz a vazão, o turno, o pior statement e a espera da B', () => {
    const { passou, linhas } = julgarIngestao(LIMPA)
    expect(passou).toBe(true)
    const texto = linhas.join('\n')
    expect(texto).toContain('300 aceitos (201) de 300')
    expect(texto).toContain('200 ms por PDF')
    expect(texto).toContain('p95 700 ms com a ingestão')
    expect(texto).toContain('atrás de 1 extrações da A')
  })

  it('a projeção é a vazão medida vezes as 300, e cabe na noite só com uma réplica rápida o bastante', () => {
    expect(projetarAsTrezentas({ prontos: 100, primeiroInicioMs: 0, ultimoFimMs: 100_000 })).toEqual({ vazaoPorPdfMs: 1_000, projecaoEmSegundos: 300 })
    expect(projetarAsTrezentas({ prontos: 0, primeiroInicioMs: null, ultimoFimMs: null })).toEqual({ vazaoPorPdfMs: null, projecaoEmSegundos: null })
    // 130 s por PDF: as 300 levam 39.000 s, acima das 10 h (36.000 s).
    expect(NOITE_EM_SEGUNDOS).toBe(36_000)
    expect(criterios({ ...LIMPA, extracoes: { ...LIMPA.extracoes, primeiroInicioMs: 0, ultimoFimMs: 39_000_000 } })).toEqual(['vazao'])
  })

  it.each([
    { caso: 'envio recusado pelo guard', medida: { ...LIMPA, envios: { aceitos: 299, recusados: { '429': 1 } }, extracoes: { ...LIMPA.extracoes, prontos: 299 } }, esperado: ['envio'] },
    { caso: 'extração que falhou', medida: { ...LIMPA, extracoes: { ...LIMPA.extracoes, prontos: 299, falhos: 1 } }, esperado: ['extracao'] },
    { caso: 'extração ainda pendente', medida: { ...LIMPA, extracoes: { ...LIMPA.extracoes, prontos: 299, pendentes: 1 } }, esperado: ['extracao'] },
    { caso: 'turno da B acima da base mais a margem', medida: { ...LIMPA, turnoDaBNaIngestao: { amostras: 120, p95Ms: 400 + MARGEM_SOBRE_A_BASE_MS + 1 } }, esperado: ['turno_da_b'] },
    { caso: 'turno da B sem amostra suficiente', medida: { ...LIMPA, turnoDaBNaIngestao: { amostras: AMOSTRAS_MINIMAS_DO_TURNO - 1, p95Ms: 100 } }, esperado: ['turno_da_b'] },
    { caso: 'statement acima do teto', medida: { ...LIMPA, piorStatement: { forma: 'select pesado', maximoMs: TETO_DO_STATEMENT_MS + 1 } }, esperado: ['statement'] },
    { caso: 'statements sem medição', medida: { ...LIMPA, piorStatement: undefined }, esperado: ['statement'] },
    { caso: 'PDF da B atrás de três extrações da A', medida: { ...LIMPA, pdfDaB: { esperaMs: 9_000, extracoesDaAAntes: EXTRACOES_QUE_A_B_ESPERA + 1 } }, esperado: ['espera_do_pdf_da_b'] },
    { caso: 'PDF da B que nunca começou', medida: { ...LIMPA, pdfDaB: { esperaMs: null, extracoesDaAAntes: null } }, esperado: ['espera_do_pdf_da_b'] },
  ])('$caso reprova só pelo critério dele', ({ medida, esperado }) => {
    expect(criterios(medida)).toEqual(esperado)
  })

  it('a margem e os limites são os da spec: 500 ms, 1,5 s, duas extrações', () => {
    expect([MARGEM_SOBRE_A_BASE_MS, TETO_DO_STATEMENT_MS, EXTRACOES_QUE_A_B_ESPERA, TOTAL_DE_PDFS]).toEqual([500, 1_500, 2, 300])
    // No limite exato, passa: o critério é "até".
    expect(criterios({ ...LIMPA, turnoDaBNaIngestao: { amostras: 120, p95Ms: 400 + MARGEM_SOBRE_A_BASE_MS }, piorStatement: { forma: 'x', maximoMs: TETO_DO_STATEMENT_MS }, pdfDaB: { esperaMs: 1, extracoesDaAAntes: EXTRACOES_QUE_A_B_ESPERA } })).toEqual([])
  })
})

describe('o controle negativo', () => {
  const semAVaga = julgarIngestao({ ...LIMPA, pdfDaB: { esperaMs: 60_000, extracoesDaAAntes: 150 } }).reprovacoes

  it('sai verde só quando o cenário reprova pela espera do PDF da B, com o envio e a extração limpos', () => {
    expect(codigoDeSaidaDaIngestao(semAVaga, true)).toBe(0)
    // Passou: a vaga por escola não fez falta, e o controle negativo é que falhou.
    expect(codigoDeSaidaDaIngestao([], true)).toBe(1)
    // Reprovou por outra coisa: o ambiente não funcionou, e isso não prova a vaga.
    expect(codigoDeSaidaDaIngestao(julgarIngestao({ ...LIMPA, envios: { aceitos: 0, recusados: { '500': 300 } } }).reprovacoes, true)).toBe(1)
    expect(codigoDeSaidaDaIngestao(julgarIngestao({ ...LIMPA, pdfDaB: { esperaMs: 60_000, extracoesDaAAntes: 150 }, extracoes: { ...LIMPA.extracoes, falhos: 5, prontos: 295 } }).reprovacoes, true)).toBe(1)
  })

  it('no cenário de verdade, qualquer reprovação é saída 1', () => {
    expect(codigoDeSaidaDaIngestao([], false)).toBe(0)
    expect(codigoDeSaidaDaIngestao(semAVaga, false)).toBe(1)
  })
})

describe('o que o driver monta', () => {
  it('cada PDF é único, e o do seed vai inteiro no começo', () => {
    const base = Buffer.from('%PDF-1.4\nconteúdo\n%%EOF')
    const a = pdfUnico(base, 1, 'A')
    expect(a.subarray(0, base.length).equals(base)).toBe(true)
    expect(new Set([1, 2, 3].map((n) => pdfUnico(base, n, 'A').toString('hex'))).size).toBe(3)
    expect(pdfUnico(base, 1, 'A').equals(pdfUnico(base, 1, 'B'))).toBe(false)
  })

  it('as sessões: três coordenadores da A (100 envios cada, o teto da pessoa), um da B e trinta alunos da B', () => {
    expect(SESSOES_POR_GRUPO.a_coordenadores).toEqual({ escola: 'A', papel: 'coordenador', quantidade: 3 })
    expect(SESSOES_POR_GRUPO.b_coordenador.quantidade).toBe(1)
    expect(SESSOES_POR_GRUPO.b_tutor).toEqual({ escola: 'B', papel: 'aluno', quantidade: 30 })
  })

  it('o k6 da ingestão leva a fase, a duração e a base do turno; a base não leva a régua', () => {
    const base = argumentosDoK6DaIngestao('base', '2m')
    expect(base).toContain('FASE=base')
    expect(base).toContain('DURACAO=2m')
    expect(base.some((argumento) => argumento.startsWith('TURNO_BASE_P95_MS'))).toBe(false)
    expect(base.at(-1)).toBe(SCRIPT_DO_K6_DA_INGESTAO)
    expect(argumentosDoK6DaIngestao('ingestao', '3m', 412.3)).toContain('TURNO_BASE_P95_MS=413')
  })
})
