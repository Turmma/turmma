import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import {
  ALUNOS_DA_PROVA,
  AVANCO_MINIMO_DO_LIMITE_S,
  codigoDeSaidaDaProva,
  ITENS_DA_PROVA,
  julgarProva,
  LIMITE_DA_VOLTA_S,
  LIMITE_P95_DO_PUT_MS,
  lerResumoDaProva,
  QUEDA_DURACAO_S,
  QUEDA_INICIO_S,
  REDE_CAI_APOS_S,
  REDE_CAI_DURACAO_S,
  RESPOSTAS_ESPERADAS,
  type CanarioDaQueda,
  type MedidaDaProva,
  type ResumoDaProva,
} from '../scripts/conferir-carga-prova.ts'

/**
 * O cenário "a prova da manhã" sem subir nada (avaliacao-e-correcao, tarefa 6.0; `cenarios.md`, seção 5): o veredito critério por critério, o controle negativo e as constantes que
 * o k6 repete. A execução de verdade é `npm run carga:prova`, manual, com a corrida registrada no documento da tarefa.
 */

const T0 = new Date('2026-11-26T10:00:00Z')
const emSegundos = (s: number): Date => new Date(T0.getTime() + s * 1_000)

const LIMPA: MedidaDaProva = {
  k6: { putFluxoNormalP95Ms: 18, putDaVoltaP95Ms: 1_600, filaDaVoltaMaxS: 38, respostasEnviadas: RESPOSTAS_ESPERADAS, putFalhasForaDaQueda: 0, respostasInesperadas: 0 },
  respostasGravadas: RESPOSTAS_ESPERADAS,
  lacuna: { duracaoS: 92, inicio: emSegundos(0), fim: emSegundos(92) },
  encerradasNaQueda: 0,
  // Venceu 40 s depois do início da queda; o limite gravado anda os 40 s que a queda cobriu e o resto até o fim dela.
  canario: { fechaEm: emSegundos(40), encerradaEm: emSegundos(150), limiteGravadoEm: emSegundos(40 + 52) },
}

/** O resumo do k6 da medida limpa, com o que o caso muda: sem `!`, porque a medida limpa sempre tem resumo. */
const k6Com = (mudanca: Partial<ResumoDaProva>): ResumoDaProva => ({ putFluxoNormalP95Ms: 18, putDaVoltaP95Ms: 1_600, filaDaVoltaMaxS: 38, respostasEnviadas: RESPOSTAS_ESPERADAS, putFalhasForaDaQueda: 0, respostasInesperadas: 0, ...mudanca })
const canarioCom = (mudanca: Partial<CanarioDaQueda>): CanarioDaQueda => ({ fechaEm: emSegundos(40), encerradaEm: emSegundos(150), limiteGravadoEm: emSegundos(92), ...mudanca })

const criterios = (medida: MedidaDaProva): string[] => julgarProva(medida).map(({ criterio }) => criterio)

describe('o veredito da prova da manhã', () => {
  it('a escala é a do `cenarios.md`: 10 escolas, 6 turmas, 35 alunos, 20 itens', () => {
    expect(ALUNOS_DA_PROVA).toBe(2_100)
    expect(RESPOSTAS_ESPERADAS).toBe(42_000)
    expect(julgarProva(LIMPA)).toEqual([])
  })

  it('p95 do PUT do fluxo normal no teto ou acima reprova; abaixo passa', () => {
    expect(criterios({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: LIMITE_P95_DO_PUT_MS - 1 }) })).toEqual([])
    expect(criterios({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: LIMITE_P95_DO_PUT_MS }) })).toEqual(['put_p95'])
    expect(criterios({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: 780 }) })).toEqual(['put_p95'])
  })

  it('o PUT de quem se recupera não tem teto: p95 de 1,6 s na volta passa, e a volta é julgada pela fila', () => {
    expect(criterios({ ...LIMPA, k6: k6Com({ putDaVoltaP95Ms: 4_900 }) })).toEqual([])
  })

  it('a fila que levou 60 s ou mais para esvaziar depois do fim da queda reprova; abaixo passa', () => {
    expect(criterios({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: LIMITE_DA_VOLTA_S - 1 }) })).toEqual([])
    expect(criterios({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: LIMITE_DA_VOLTA_S }) })).toEqual(['fila_da_volta'])
    expect(criterios({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: 190 }) })).toEqual(['fila_da_volta'])
  })

  it('sem nenhuma fila que atravessou a queda, a volta não foi medida: sem amostra, e não aprovada', () => {
    expect(criterios({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: undefined }) })).toEqual(['sem_amostra'])
  })

  it('resposta enviada pelo cliente que o banco não tem, ou que o banco tem a mais, reprova: nada se perde nem se duplica', () => {
    expect(criterios({ ...LIMPA, respostasGravadas: RESPOSTAS_ESPERADAS - 1 })).toEqual(['resposta_perdida'])
    expect(criterios({ ...LIMPA, respostasGravadas: RESPOSTAS_ESPERADAS + 1 })).toEqual(['resposta_perdida'])
  })

  it('aluno que não terminou (enviadas abaixo das esperadas, mesmo com o banco igual) reprova', () => {
    const faltando = RESPOSTAS_ESPERADAS - ITENS_DA_PROVA
    expect(criterios({ ...LIMPA, k6: k6Com({ respostasEnviadas: faltando }), respostasGravadas: faltando })).toEqual(['resposta_nao_enviada'])
  })

  it('falha fora da janela da queda reprova, no PUT e nas outras chamadas', () => {
    expect(criterios({ ...LIMPA, k6: k6Com({ putFalhasForaDaQueda: 1 }) })).toEqual(['put_falhou_fora_da_queda'])
    expect(criterios({ ...LIMPA, k6: k6Com({ respostasInesperadas: 1 }) })).toEqual(['resposta_inesperada'])
  })

  it('sem resumo do k6, ou sem nenhuma resposta, a medida não diz nada', () => {
    expect(criterios({ ...LIMPA, k6: undefined })).toEqual(['sem_amostra'])
    expect(criterios({ ...LIMPA, k6: k6Com({ respostasEnviadas: 0 }), respostasGravadas: 0 })).toEqual(['sem_amostra'])
    expect(criterios({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: undefined }) })).toEqual(['sem_amostra'])
  })

  it('a queda que o pulso não gravou reprova; a gravada abaixo de 75 s também', () => {
    expect(criterios({ ...LIMPA, lacuna: undefined })).toContain('queda_nao_gravada')
    expect(criterios({ ...LIMPA, lacuna: { duracaoS: QUEDA_DURACAO_S - 16, inicio: emSegundos(0), fim: emSegundos(74) } })).toContain('queda_nao_gravada')
    expect(criterios({ ...LIMPA, lacuna: { duracaoS: QUEDA_DURACAO_S - 15, inicio: emSegundos(0), fim: emSegundos(75) } })).toEqual([])
  })

  it('prova encerrada durante a queda reprova, e a que venceu nela e foi encerrada antes de a queda acabar também', () => {
    expect(criterios({ ...LIMPA, encerradasNaQueda: 1 })).toEqual(['encerrada_na_queda'])
    expect(criterios({ ...LIMPA, canario: canarioCom({ encerradaEm: emSegundos(60) }) })).toEqual(['encerrada_na_queda'])
  })

  it('a prova que venceu na queda e nunca foi encerrada reprova: a rotina não voltou', () => {
    expect(criterios({ ...LIMPA, canario: canarioCom({ encerradaEm: null, limiteGravadoEm: null }) })).toEqual(['canario_nao_encerrado'])
    expect(criterios({ ...LIMPA, canario: undefined })).toEqual(['canario_nao_encerrado'])
  })

  it('o limite que a queda não andou reprova; andando o mínimo, passa', () => {
    const fechaEm = emSegundos(40)
    expect(criterios({ ...LIMPA, canario: canarioCom({ limiteGravadoEm: new Date(fechaEm.getTime() + (AVANCO_MINIMO_DO_LIMITE_S - 1) * 1_000) }) })).toEqual(['limite_nao_andou'])
    expect(criterios({ ...LIMPA, canario: canarioCom({ limiteGravadoEm: new Date(fechaEm.getTime() + AVANCO_MINIMO_DO_LIMITE_S * 1_000) }) })).toEqual([])
  })
})

describe('os controles negativos', () => {
  it('o PUT atrasado em 600 ms passa só se o cenário reprovar pelo p95 do fluxo normal; reprovar por outra coisa não prova nada', () => {
    const lento = julgarProva({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: 640 }) })
    expect(codigoDeSaidaDaProva(lento, 'put_p95')).toBe(0)
    expect(codigoDeSaidaDaProva(julgarProva({ ...LIMPA, respostasGravadas: 1 }), 'put_p95')).toBe(1)
    expect(codigoDeSaidaDaProva([], 'put_p95')).toBe(1)
  })

  it('as APIs fora por 150 s passam só se o cenário reprovar pela fila da volta, mesmo com outras reprovações ao lado', () => {
    const longa = julgarProva({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: 74 }) })
    expect(codigoDeSaidaDaProva(longa, 'fila_da_volta')).toBe(0)
    expect(codigoDeSaidaDaProva(julgarProva({ ...LIMPA, k6: k6Com({ filaDaVoltaMaxS: 74, putFluxoNormalP95Ms: 900 }) }), 'fila_da_volta')).toBe(0)
    // O PUT lento não prova a volta, e a volta longa não prova o PUT.
    expect(codigoDeSaidaDaProva(julgarProva({ ...LIMPA, k6: k6Com({ putFluxoNormalP95Ms: 640 }) }), 'fila_da_volta')).toBe(1)
    expect(codigoDeSaidaDaProva(longa, 'put_p95')).toBe(1)
    expect(codigoDeSaidaDaProva([], 'fila_da_volta')).toBe(1)
  })

  it('sem controle negativo, sai 0 só sem reprovação', () => {
    expect(codigoDeSaidaDaProva([], undefined)).toBe(0)
    expect(codigoDeSaidaDaProva(julgarProva({ ...LIMPA, respostasGravadas: 1 }), undefined)).toBe(1)
  })
})

describe('o resumo do k6', () => {
  it('lê o p95 do fluxo normal e o da volta, o máximo da fila da volta e a contagem de cada contador; o que não está no resumo é zero ou ausente', () => {
    const resumo = lerResumoDaProva({
      metrics: {
        put_fluxo_normal_ms: { 'p(95)': 212.5 },
        put_da_volta_ms: { 'p(95)': 1_620 },
        fila_esvaziada_na_volta_s: { max: 41.2 },
        put_ms: { 'p(95)': 999 },
        respostas_enviadas: { count: 41_990 },
        put_falhas_fora_da_queda: { count: 2 },
      },
    })
    expect(resumo).toEqual({ putFluxoNormalP95Ms: 212.5, putDaVoltaP95Ms: 1_620, filaDaVoltaMaxS: 41.2, respostasEnviadas: 41_990, putFalhasForaDaQueda: 2, respostasInesperadas: 0 })
    expect(lerResumoDaProva(undefined)).toBeUndefined()
    expect(lerResumoDaProva({ metrics: {} })).toEqual({ putFluxoNormalP95Ms: undefined, putDaVoltaP95Ms: undefined, filaDaVoltaMaxS: undefined, respostasEnviadas: 0, putFalhasForaDaQueda: 0, respostasInesperadas: 0 })
  })
})

describe('o k6 repete as constantes do veredito', () => {
  const script = readFileSync(join(raizRepositorio, 'infra/k6/prova-online.js'), 'utf8')
  const constante = (nome: string): number => Number(new RegExp(`^const ${nome} = (\\d+)$`, 'm').exec(script)?.[1])
  const doApp = (arquivo: string, padrao: RegExp): number => Number(padrao.exec(readFileSync(join(raizRepositorio, arquivo), 'utf8'))?.[1]?.replaceAll('_', ''))

  it('os itens, a queda, a rede e o teto do p95 são os mesmos', () => {
    expect(constante('ITENS')).toBe(ITENS_DA_PROVA)
    expect(constante('QUEDA_INICIO_S')).toBe(QUEDA_INICIO_S)
    expect(constante('QUEDA_DURACAO_S')).toBe(QUEDA_DURACAO_S)
    expect(constante('REDE_CAI_APOS_S')).toBe(REDE_CAI_APOS_S)
    expect(constante('REDE_CAI_DURACAO_S')).toBe(REDE_CAI_DURACAO_S)
    expect(constante('LIMITE_P95_DO_PUT_MS')).toBe(LIMITE_P95_DO_PUT_MS)
    expect(constante('LIMITE_DA_VOLTA_S')).toBe(LIMITE_DA_VOLTA_S)
    expect(constante('INTERVALO_DO_TEMPO_S')).toBe(30)
  })

  it('o cliente do k6 imita a fila do app: o recuo, o jitter e o prazo do PUT são os de `respostas.ts` e `client.ts`', () => {
    const respostas = 'apps/web/src/areas/aluno/respostas.ts'
    expect(constante('PRIMEIRA_ESPERA_DA_FILA_MS')).toBe(doApp(respostas, /^export const PRIMEIRA_ESPERA_DA_FILA_MS = ([\d_]+)$/m))
    expect(constante('MAIOR_ESPERA_DA_FILA_MS')).toBe(doApp(respostas, /^export const MAIOR_ESPERA_DA_FILA_MS = ([\d_]+)$/m))
    expect(constante('JITTER_DA_FILA_PCT')).toBe(Math.round(100 * doApp(respostas, /^export const JITTER_DA_FILA = ([\d.]+)$/m)))
    expect(constante('PRAZO_DO_PUT_MS')).toBe(doApp('apps/web/src/api/client.ts', /PRAZOS_DA_CHAMADA_MS = \{[^}]*\bprova: ([\d_]+)/))
  })

  it('o cenário usa as rotas reais do aluno, e o PUT só conta o 200', () => {
    for (const rota of ['/comecar', '/respostas/', '/tempo', '/enviar']) expect(script).toContain(rota)
    expect(script).toContain('resposta.status !== 200')
    expect(script).toContain("put_fluxo_normal_ms: [`p(95)<${LIMITE_P95_DO_PUT_MS}`]")
    expect(script).toContain("fila_esvaziada_na_volta_s: [`max<${LIMITE_DA_VOLTA_S}`]")
  })
})
