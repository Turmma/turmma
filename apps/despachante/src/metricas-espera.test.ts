import { createLogger, METRICS, type JanelaLetiva, type FailedJobsMeasurement, type PendingJobsMeasurement } from '@educa/core'
import type { QueueName } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperaDoMaisAntigo, MedicaoDaFila, RETENCAO_DA_SERIE_ZERADA_MS } from './metricas-espera.js'

const JANELA: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' }
const TERCA_10H = new Date('2026-09-15T10:00:00-03:00')
const TERCA_18H = new Date('2026-09-15T18:00:00-03:00')
const TERCA_19H = new Date('2026-09-15T19:00:00-03:00')
const SABADO_10H = new Date('2026-09-19T10:00:00-03:00')
const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'

const segundosAntes = (instante: Date, segundos: number) => new Date(instante.getTime() - segundos * 1_000)

function medicao(parcial: Partial<PendingJobsMeasurement> & { fila: QueueName }): PendingJobsMeasurement {
  return { escolaId: ESCOLA_A, agora: TERCA_10H, urgenteCriadoEm: null, naoUrgenteCriadoEm: null, pendentes: 1, ...parcial }
}

describe('esperaDoMaisAntigo', () => {
  it('interativa: o mais antigo dos dois, marcado ou não como não urgente (só o lote segura)', () => {
    const espera = esperaDoMaisAntigo(medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 12), naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 40) }), undefined)
    expect(espera).toBe(40)
  })

  it('lote na terça às 10h: o não urgente segurado de propósito não conta, e o urgente conta', () => {
    const emAula = { janela: JANELA, emAula: true }
    expect(esperaDoMaisAntigo(medicao({ fila: 'lote', naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 3 * 3_600) }), emAula)).toBeUndefined()
    expect(esperaDoMaisAntigo(medicao({ fila: 'lote', urgenteCriadoEm: segundosAntes(TERCA_10H, 30), naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 3 * 3_600) }), emAula)).toBe(30)
  })

  it('lote às 19h: o não urgente criado às 10h espera desde as 18h, quando pôde sair, e não desde as 10h', () => {
    const espera = esperaDoMaisAntigo(medicao({ fila: 'lote', agora: TERCA_19H, naoUrgenteCriadoEm: TERCA_10H }), { janela: JANELA, emAula: false })
    expect(espera).toBe(3_600)
  })

  it('lote às 18h00 em ponto: o segurado do dia acabou de sair, espera zero', () => {
    expect(esperaDoMaisAntigo(medicao({ fila: 'lote', agora: TERCA_18H, naoUrgenteCriadoEm: TERCA_10H }), { janela: JANELA, emAula: false })).toBe(0)
  })

  it('lote num sábado: o não urgente criado fora do horário letivo espera desde a criação', () => {
    const espera = esperaDoMaisAntigo(medicao({ fila: 'lote', agora: SABADO_10H, naoUrgenteCriadoEm: segundosAntes(SABADO_10H, 90) }), { janela: JANELA, emAula: false })
    expect(espera).toBe(90)
  })

  it('só jobs já em execução (nenhum não iniciado): sem espera', () => {
    expect(esperaDoMaisAntigo(medicao({ fila: 'interativa', pendentes: 0 }), undefined)).toBeUndefined()
  })
})

describe('MedicaoDaFila', () => {
  let medidor: MedidorDeTeste
  let medicoes: PendingJobsMeasurement[] | Error
  let falhos: FailedJobsMeasurement[] | Error
  let vagas: Map<string, number> | Error
  let agoraMs: number
  let relogio: Date
  let medicaoDaFila: MedicaoDaFila

  beforeEach(() => {
    medidor = new MedidorDeTeste()
    medicoes = []
    falhos = []
    vagas = new Map()
    agoraMs = 0
    relogio = TERCA_10H
    medicaoDaFila = new MedicaoDaFila(
      {
        repositorio: {
          medirPendentes: () => (medicoes instanceof Error ? Promise.reject(medicoes) : Promise.resolve(medicoes)),
          medirFalhos: () => (falhos instanceof Error ? Promise.reject(falhos) : Promise.resolve(falhos)),
        },
        vagas: { emUso: (fila, escolaId) => (vagas instanceof Error ? Promise.reject(vagas) : Promise.resolve(vagas.get(`${fila}:${escolaId}`) ?? 0)) },
        janelaDaEscola: { daEscola: () => Promise.resolve(JANELA) },
        relogio: { agora: () => relogio },
        logger: createLogger({ servico: 'teste', nivel: 'silent' }),
        medidor: medidor.medidor,
      },
      { agoraMs: () => agoraMs },
    )
  })

  afterEach(async () => {
    await medicaoDaFila.parar()
    await medidor.encerrar()
  })

  const pontos = async (nome: string) => (await medidor.pontos(nome)).map(({ atributos, valor }) => ({ ...atributos, valor }))

  it('caminho feliz: escolas A e B em séries separadas por fila e escola, com espera, pendentes e vagas; a rotina do sistema como `sistema`', async () => {
    medicoes = [
      medicao({ fila: 'interativa', escolaId: ESCOLA_A, urgenteCriadoEm: segundosAntes(TERCA_10H, 7), pendentes: 3 }),
      medicao({ fila: 'lote', escolaId: ESCOLA_A, urgenteCriadoEm: segundosAntes(TERCA_10H, 60), pendentes: 900 }),
      medicao({ fila: 'interativa', escolaId: ESCOLA_B, urgenteCriadoEm: segundosAntes(TERCA_10H, 2), pendentes: 1 }),
      medicao({ fila: 'lote', escolaId: null, naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 5), pendentes: 1 }),
    ]
    vagas = new Map([
      [`interativa:${ESCOLA_A}`, 5],
      [`lote:${ESCOLA_A}`, 2],
    ])
    await medicaoDaFila.medir()

    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([
      { fila: 'interativa', escola_id: ESCOLA_A, valor: 7 },
      { fila: 'lote', escola_id: ESCOLA_A, valor: 60 },
      { fila: 'interativa', escola_id: ESCOLA_B, valor: 2 },
      // O expurgo das 3h30 é não urgente: às 10h de terça ele está segurado, e não espera.
    ])
    expect(await pontos(METRICS.pendentes)).toEqual([
      { fila: 'interativa', escola_id: ESCOLA_A, valor: 3 },
      { fila: 'lote', escola_id: ESCOLA_A, valor: 900 },
      { fila: 'interativa', escola_id: ESCOLA_B, valor: 1 },
      { fila: 'lote', escola_id: 'sistema', valor: 1 },
    ])
    expect(await pontos(METRICS.vagasEmUso)).toEqual([
      { fila: 'interativa', escola_id: ESCOLA_A, valor: 5 },
      { fila: 'lote', escola_id: ESCOLA_A, valor: 2 },
      { fila: 'interativa', escola_id: ESCOLA_B, valor: 0 },
      { fila: 'lote', escola_id: 'sistema', valor: 0 },
    ])
  })

  it('permissão: os únicos rótulos são fila e escola_id', async () => {
    medicoes = [medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 7) })]
    await medicaoDaFila.medir()
    for (const { atributos } of await medidor.atributosDeTodas()) expect(Object.keys(atributos).sort()).toEqual(['escola_id', 'fila'])
  })

  it('borda: Redis de fila fora → a espera e os pendentes seguem medidos pelo banco, e só as vagas saem da exportação', async () => {
    medicoes = [medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 7) })]
    vagas = new Error('Connection is closed.')
    await medicaoDaFila.medir()
    medicoes = [medicao({ fila: 'interativa', agora: new Date(TERCA_10H.getTime() + 5_000), urgenteCriadoEm: segundosAntes(TERCA_10H, 7) })]
    await medicaoDaFila.medir()

    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 12 }])
    expect(await pontos(METRICS.pendentes)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 1 }])
    expect(await pontos(METRICS.vagasEmUso)).toEqual([])
  })

  it('borda: Postgres fora → a exportação fica sem espera, em vez de repetir a última parada no tempo', async () => {
    medicoes = [medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 7) })]
    await medicaoDaFila.medir()
    falhos = [{ tipo: 'ia.geracao.concluida', falhos: 2 }]
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.falhos)).toEqual([{ tipo: 'ia.geracao.concluida', valor: 2 }])
    medicoes = new Error('connect ECONNREFUSED')
    falhos = new Error('connect ECONNREFUSED')
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([])
    expect(await pontos(METRICS.pendentes)).toEqual([])
    expect(await pontos(METRICS.falhos)).toEqual([])
  })

  it('falhos: um ponto por tipo, só com o rótulo `tipo`: nem escola, nem fila, nem código da falha', async () => {
    falhos = [
      { tipo: 'titular.montar-arquivo', falhos: 5 },
      { tipo: 'ia.geracao.concluida', falhos: 1 },
    ]
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.falhos)).toEqual([
      { tipo: 'titular.montar-arquivo', valor: 5 },
      { tipo: 'ia.geracao.concluida', valor: 1 },
    ])
    for (const { nome, atributos } of await medidor.atributosDeTodas()) {
      if (nome === METRICS.falhos) expect(Object.keys(atributos)).toEqual(['tipo'])
    }
  })

  it('falhos: o tipo que o expurgo esvaziou sai da exportação na medição seguinte, e não fica em zero', async () => {
    falhos = [
      { tipo: 'titular.eliminar', falhos: 1 },
      { tipo: 'sistema.expurgar-jobs', falhos: 3 },
    ]
    await medicaoDaFila.medir()
    falhos = [{ tipo: 'titular.eliminar', falhos: 1 }]
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.falhos)).toEqual([{ tipo: 'titular.eliminar', valor: 1 }])
  })

  it('falhos: a consulta dos falhos que falha tira só `job.falhos` da exportação, e a espera da fila segue medida', async () => {
    medicoes = [medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 7) })]
    falhos = [{ tipo: 'titular.eliminar', falhos: 1 }]
    await medicaoDaFila.medir()
    falhos = new Error('canceling statement due to statement timeout')
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.falhos)).toEqual([])
    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 7 }])
  })

  it('falhos: a consulta dos falhos que falha deixa o aviso `despachante.medicao_indisponivel` no log, porque o alerta volta a normal sem a série', async () => {
    const linhas: string[] = []
    const comLog = new MedicaoDaFila({
      repositorio: { medirPendentes: () => Promise.resolve([]), medirFalhos: () => Promise.reject(new Error('canceling statement due to statement timeout')) },
      vagas: { emUso: () => Promise.resolve(0) },
      janelaDaEscola: { daEscola: () => Promise.resolve(JANELA) },
      relogio: { agora: () => TERCA_10H },
      logger: createLogger({ servico: 'teste', destino: { write: (linha: string) => linhas.push(linha) } }),
      medidor: medidor.medidor,
    })
    await comLog.medir()
    expect(linhas.map((linha) => JSON.parse(linha) as { evento?: string }).filter(({ evento }) => evento === 'despachante.medicao_indisponivel')).toHaveLength(1)
    await comLog.parar()
  })

  it('borda: a fila da escola esvaziou → série em zero, e não a última espera, até a retenção vencer; depois some', async () => {
    medicoes = [medicao({ fila: 'interativa', urgenteCriadoEm: segundosAntes(TERCA_10H, 45), pendentes: 4 })]
    vagas = new Map([[`interativa:${ESCOLA_A}`, 5]])
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 45 }])

    medicoes = []
    agoraMs = RETENCAO_DA_SERIE_ZERADA_MS
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 0 }])
    expect(await pontos(METRICS.pendentes)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 0 }])
    expect(await pontos(METRICS.vagasEmUso)).toEqual([{ fila: 'interativa', escola_id: ESCOLA_A, valor: 0 }])

    agoraMs = RETENCAO_DA_SERIE_ZERADA_MS + 1
    await medicaoDaFila.medir()
    expect(await pontos(METRICS.esperaMaisAntiga)).toEqual([])
  })

  it('isolamento: a janela lida é a da escola de cada série, no contexto dela, e a escola em aula não segura o lote da outra', async () => {
    const lidasNoContexto: Array<string | undefined> = []
    const { currentContext } = await import('@educa/core')
    const janelaPorEscola = new Map<string, JanelaLetiva>([
      [ESCOLA_A, JANELA],
      // A escola B não tem aula às terças.
      [ESCOLA_B, { ...JANELA, diasLetivos: [1, 3, 5] }],
    ])
    const outra = new MedicaoDaFila({
      repositorio: { medirPendentes: () => Promise.resolve(medicoes as PendingJobsMeasurement[]), medirFalhos: () => Promise.resolve([]) },
      vagas: { emUso: () => Promise.resolve(0) },
      janelaDaEscola: {
        daEscola: () => {
          const escolaId = currentContext()?.escolaId
          lidasNoContexto.push(escolaId)
          return Promise.resolve(janelaPorEscola.get(escolaId ?? '') ?? JANELA)
        },
      },
      relogio: { agora: () => TERCA_10H },
      logger: createLogger({ servico: 'teste', nivel: 'silent' }),
      medidor: medidor.medidor,
    })
    medicoes = [
      medicao({ fila: 'lote', escolaId: ESCOLA_A, naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 600) }),
      medicao({ fila: 'lote', escolaId: ESCOLA_B, naoUrgenteCriadoEm: segundosAntes(TERCA_10H, 600) }),
    ]
    await outra.medir()
    expect(lidasNoContexto).toEqual([ESCOLA_A, ESCOLA_B])
    expect(outra.series().map(({ escolaId, esperaS }) => ({ escolaId, esperaS }))).toEqual([
      { escolaId: ESCOLA_A, esperaS: undefined },
      { escolaId: ESCOLA_B, esperaS: 600 },
    ])
    await outra.parar()
  })
})
