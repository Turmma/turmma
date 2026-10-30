import { contextoAtual, criarLogger, type EscolaComPendentes, type JanelaLetiva, type JobReservado } from '@educa/nucleo'
import type { QueueName } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { Despachante, type DependenciasDoDespachante } from './despachante.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'
const ESCOLA_C = '0190f5a0-0000-7000-8000-00000000000c'

interface Reserva {
  fila: QueueName
  escolaId: string | null
  rotinaDoSistema: boolean
  limite: number
  soUrgentes: boolean
}

/** O padrão do `.env.example`: São Paulo, de segunda a sexta, das 07:00 às 18:00. */
const JANELA_PADRAO: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' }
/** Domingo, 13/09/2026, 12h em São Paulo: fora do horário letivo padrão. */
const DOMINGO_MEIO_DIA = new Date('2026-09-13T12:00:00-03:00')
/** Terça, 15/09/2026, 10h em São Paulo: dentro do horário letivo padrão. */
const TERCA_10H = new Date('2026-09-15T10:00:00-03:00')

/** Despachante com repository, vagas e fila falsos, que registram o que o despachante pediu e em que contexto. */
function montar({
  pendentes,
  livres = () => 5,
  conceder = (ids: readonly string[]) => ids,
  publicacaoFalha = false,
  vagasDaEscola = { interativa: 5, normal: 5, lote: 2 },
  lote,
  publicadosDaEscola = [],
  membrosDaVaga = [],
  janelaDaEscola = () => JANELA_PADRAO,
  agora = DOMINGO_MEIO_DIA,
  urgentesDisponiveis = Number.POSITIVE_INFINITY,
}: {
  pendentes: EscolaComPendentes[]
  livres?: (fila: QueueName, escolaId: string | null, limite: number) => number
  conceder?: (ids: readonly string[]) => readonly string[]
  publicacaoFalha?: boolean
  vagasDaEscola?: Record<QueueName, number>
  lote?: number
  publicadosDaEscola?: string[]
  membrosDaVaga?: string[]
  janelaDaEscola?: (escolaId: string | null) => JanelaLetiva
  agora?: Date
  /** Quantos urgentes a reserva com `soUrgentes` ainda encontra; a reserva sem filtro sempre enche o limite. */
  urgentesDisponiveis?: number
}) {
  const ordem: string[] = []
  const reservas: Reserva[] = []
  const devolvidos: string[] = []
  const publicados: string[] = []
  const liberados: string[] = []
  const consultasDePublicados: string[][] = []
  const mantidas: Array<{ escolaId: string | null; ids: readonly string[] }> = []
  const tomadas: Array<{ fila: QueueName; escolaId: string | null; limite: number; ids: readonly string[] }> = []
  let sequencia = 0

  const repositorio: DependenciasDoDespachante['repositorio'] = {
    listarEscolasComPendentes: () => Promise.resolve(pendentes),
    publicadosEntre: (ids: readonly string[]) => {
      consultasDePublicados.push([...ids])
      return Promise.resolve(publicadosDaEscola)
    },
    reservarDaEscola: (fila: QueueName, limite: number, opcoes?: { soUrgentes?: boolean }): Promise<JobReservado[]> => {
      const contexto = contextoAtual()
      const escolaId = contexto?.escolaId ?? null
      const soUrgentes = opcoes?.soUrgentes === true
      reservas.push({ fila, escolaId, rotinaDoSistema: contexto?.rotinaDoSistema === true, limite, soUrgentes })
      const quantidade = soUrgentes ? Math.min(limite, urgentesDisponiveis) : limite
      if (soUrgentes) urgentesDisponiveis -= quantidade
      return Promise.resolve(Array.from({ length: quantidade }, () => ({ id: `job-${++sequencia}`, escolaId, requisicaoId: null, tipo: 'sintetico', fila })))
    },
    devolverParaAguardando: (ids: readonly string[]) => {
      devolvidos.push(...ids)
      return Promise.resolve(ids.length)
    },
    marcarPublicados: (ids: readonly string[]) => Promise.resolve(ids.length),
  }

  const dependencias: DependenciasDoDespachante = {
    repositorio,
    fila: {
      publicar: (jobs) => {
        if (publicacaoFalha) return Promise.reject(new Error('Redis fora'))
        publicados.push(...jobs.map((job) => job.id))
        return Promise.resolve()
      },
    },
    vagas: {
      membros: () => {
        ordem.push('membros')
        return Promise.resolve(membrosDaVaga)
      },
      manter: (_fila, escolaId, ids) => {
        ordem.push('manter')
        mantidas.push({ escolaId, ids })
        return Promise.resolve()
      },
      livres: (fila, escolaId, limite) => {
        ordem.push('livres')
        return Promise.resolve(livres(fila, escolaId, limite))
      },
      tomar: (fila, escolaId, limite, ids) => {
        tomadas.push({ fila, escolaId, limite, ids })
        return Promise.resolve(new Set(conceder(ids)))
      },
      liberar: (_fila, _escolaId, ids) => {
        liberados.push(...ids)
        return Promise.resolve()
      },
    },
    vagasDaEscola: { daEscola: () => Promise.resolve(vagasDaEscola) },
    // Como a configuração de verdade: a janela é a da escola do contexto em que o despachante pergunta.
    janelaDaEscola: { daEscola: () => Promise.resolve(janelaDaEscola(contextoAtual()?.escolaId ?? null)) },
    relogio: { agora: () => agora },
    logger: criarLogger({ servico: 'despachante-teste', nivel: 'silent' }),
  }
  return { dependencias, despachante: new Despachante(dependencias, lote === undefined ? {} : { lote }), reservas, devolvidos, publicados, liberados, tomadas, mantidas, ordem, consultasDePublicados }
}

describe('Despachante.rodada', () => {
  it('atende as filas em ordem de prioridade, e em cada fila as escolas em rodízio: quem começa muda a cada rodada', async () => {
    const pendentes: EscolaComPendentes[] = [
      { fila: 'lote', escolaId: ESCOLA_A },
      { fila: 'lote', escolaId: ESCOLA_B },
      { fila: 'interativa', escolaId: ESCOLA_A },
      { fila: 'interativa', escolaId: ESCOLA_B },
      { fila: 'interativa', escolaId: ESCOLA_C },
      { fila: 'normal', escolaId: ESCOLA_C },
    ]
    const { despachante, reservas } = montar({ pendentes, livres: () => 1 })
    const ordem = () => reservas.splice(0).map(({ fila, escolaId }) => `${fila}:${escolaId?.slice(-1)}`)

    await despachante.rodada()
    expect(ordem()).toEqual(['interativa:a', 'interativa:b', 'interativa:c', 'normal:c', 'lote:a', 'lote:b'])
    await despachante.rodada()
    expect(ordem()).toEqual(['interativa:b', 'interativa:c', 'interativa:a', 'normal:c', 'lote:b', 'lote:a'])
    await despachante.rodada()
    expect(ordem()).toEqual(['interativa:c', 'interativa:a', 'interativa:b', 'normal:c', 'lote:a', 'lote:b'])
  })

  it('reserva no contexto da escola, só as vagas livres, e toma a vaga com o limite da fila na configuração dela', async () => {
    const { despachante, reservas, tomadas, publicados } = montar({
      pendentes: [{ fila: 'lote', escolaId: ESCOLA_A }],
      livres: () => 2,
      vagasDaEscola: { interativa: 5, normal: 5, lote: 7 },
    })
    expect(await despachante.rodada()).toBe(2)
    expect(reservas).toEqual([{ fila: 'lote', escolaId: ESCOLA_A, rotinaDoSistema: false, limite: 2, soUrgentes: true }])
    expect(tomadas).toEqual([{ fila: 'lote', escolaId: ESCOLA_A, limite: 7, ids: ['job-1', 'job-2'] }])
    expect(publicados).toEqual(['job-1', 'job-2'])
  })

  it('renova a vaga dos jobs já publicados e ainda não iniciados antes de estimar as livres: busca só entre os que têm vaga', async () => {
    const { despachante, mantidas, ordem, consultasDePublicados } = montar({
      pendentes: [{ fila: 'lote', escolaId: ESCOLA_A }],
      membrosDaVaga: ['publicado-1', 'publicado-2', 'ativo-1'],
      publicadosDaEscola: ['publicado-1', 'publicado-2'],
      livres: () => 0,
    })
    await despachante.rodada()
    expect(consultasDePublicados).toEqual([['publicado-1', 'publicado-2', 'ativo-1']])
    expect(mantidas).toEqual([{ escolaId: ESCOLA_A, ids: ['publicado-1', 'publicado-2'] }])
    expect(ordem).toEqual(['membros', 'manter', 'livres'])
  })

  it('escola sem vaga livre nem reserva: nenhuma escrita no banco a cada rodada', async () => {
    const { despachante, reservas, tomadas } = montar({ pendentes: [{ fila: 'lote', escolaId: ESCOLA_A }], livres: () => 0 })
    expect(await despachante.rodada()).toBe(0)
    expect(reservas).toEqual([])
    expect(tomadas).toEqual([])
  })

  it('vaga negada depois da reserva: a linha volta a aguardando e não é publicada', async () => {
    const { despachante, devolvidos, publicados, liberados } = montar({
      pendentes: [{ fila: 'interativa', escolaId: ESCOLA_A }],
      livres: () => 3,
      conceder: (ids) => ids.slice(0, 1),
    })
    expect(await despachante.rodada()).toBe(1)
    expect(publicados).toEqual(['job-1'])
    expect(devolvidos).toEqual(['job-2', 'job-3'])
    expect(liberados).toEqual([])
  })

  it('publicação que falha devolve as vagas tomadas, e a reserva fica para vencer', async () => {
    const { despachante, devolvidos, liberados } = montar({ pendentes: [{ fila: 'normal', escolaId: ESCOLA_B }], livres: () => 2, publicacaoFalha: true })
    expect(await despachante.rodada()).toBe(0)
    expect(liberados).toEqual(['job-1', 'job-2'])
    expect(devolvidos).toEqual([])
  })

  it('Redis de fila sem resposta na vaga de uma escola: a rodada termina ali, sem reservar nada e sem tentar as outras', async () => {
    const consultadas: Array<string | null> = []
    const { despachante, reservas } = montar({
      pendentes: [
        { fila: 'interativa', escolaId: ESCOLA_A },
        { fila: 'interativa', escolaId: ESCOLA_B },
        { fila: 'lote', escolaId: ESCOLA_C },
      ],
      livres: (_fila, escolaId) => {
        consultadas.push(escolaId)
        throw new Error('Command timed out')
      },
    })
    expect(await despachante.rodada()).toBe(0)
    expect(consultadas).toEqual([ESCOLA_A])
    expect(reservas).toEqual([])
  })

  it('rotina do sistema (sem escola) reserva no contexto de rotina, com a vaga própria do sistema', async () => {
    const { despachante, reservas, tomadas } = montar({ pendentes: [{ fila: 'lote', escolaId: null }], livres: () => 1 })
    await despachante.rodada()
    expect(reservas).toEqual([{ fila: 'lote', escolaId: null, rotinaDoSistema: true, limite: 1, soUrgentes: true }])
    expect(tomadas.map(({ escolaId }) => escolaId)).toEqual([null])
  })

  it('para no teto de publicações da rodada, e a próxima continua pela escola seguinte do rodízio', async () => {
    const pendentes: EscolaComPendentes[] = [
      { fila: 'interativa', escolaId: ESCOLA_A },
      { fila: 'interativa', escolaId: ESCOLA_B },
    ]
    const { despachante, reservas } = montar({ pendentes, livres: () => 100, lote: 100 })
    expect(await despachante.rodada()).toBe(100)
    expect(reservas.splice(0).map(({ escolaId, limite }) => [escolaId, limite])).toEqual([[ESCOLA_A, 100]])
    expect(await despachante.rodada()).toBe(100)
    expect(reservas.splice(0).map(({ escolaId }) => escolaId)).toEqual([ESCOLA_B])
  })
})

describe('Despachante.rodada no horário letivo', () => {
  const pendentesNasTresFilas: EscolaComPendentes[] = [
    { fila: 'interativa', escolaId: ESCOLA_A },
    { fila: 'normal', escolaId: ESCOLA_A },
    { fila: 'lote', escolaId: ESCOLA_A },
  ]

  it('terça às 10h: na fila de lote reserva só os urgentes; interativa e normal nunca são seguradas', async () => {
    const { despachante, reservas } = montar({ pendentes: pendentesNasTresFilas, agora: TERCA_10H, urgentesDisponiveis: 0 })
    await despachante.rodada()
    expect(reservas.map(({ fila, soUrgentes }) => [fila, soUrgentes])).toEqual([
      ['interativa', false],
      ['normal', false],
      ['lote', true],
    ])
  })

  it('fora do horário letivo o lote reserva os urgentes primeiro e completa as vagas com os não urgentes', async () => {
    const { despachante, reservas, publicados } = montar({ pendentes: pendentesNasTresFilas, agora: DOMINGO_MEIO_DIA, livres: () => 2, urgentesDisponiveis: 1 })
    await despachante.rodada()
    expect(reservas.map(({ fila, soUrgentes, limite }) => [fila, soUrgentes, limite])).toEqual([
      ['interativa', false, 2],
      ['normal', false, 2],
      ['lote', true, 2],
      ['lote', false, 1],
    ])
    expect(publicados).toHaveLength(6)
  })

  it('fora do horário letivo, urgentes que enchem as vagas dispensam a segunda reserva', async () => {
    const { despachante, reservas } = montar({ pendentes: [{ fila: 'lote', escolaId: ESCOLA_A }], agora: DOMINGO_MEIO_DIA, livres: () => 2, urgentesDisponiveis: 5 })
    expect(await despachante.rodada()).toBe(2)
    expect(reservas.map(({ soUrgentes, limite }) => [soUrgentes, limite])).toEqual([[true, 2]])
  })

  it('a hora vem do relógio injetado a cada rodada: 17h59 segura, 18h00 solta', async () => {
    let agora = new Date('2026-09-15T17:59:59.999-03:00')
    const pendentes: EscolaComPendentes[] = [{ fila: 'lote', escolaId: ESCOLA_A }]
    const falsos = montar({ pendentes, urgentesDisponiveis: 0 })
    const despachante = new Despachante({ ...falsos.dependencias, relogio: { agora: () => agora } })
    await despachante.rodada()
    expect(falsos.reservas.splice(0).map(({ soUrgentes }) => soUrgentes)).toEqual([true])
    agora = new Date('2026-09-15T18:00:00-03:00')
    await despachante.rodada()
    expect(falsos.reservas.map(({ soUrgentes }) => soUrgentes)).toEqual([true, false])
  })

  it('isolamento: a janela é a da escola do contexto; o sábado letivo da A não segura o lote da B', async () => {
    const sabado10h = new Date('2026-09-19T10:00:00-03:00')
    const { despachante, reservas } = montar({
      pendentes: [
        { fila: 'lote', escolaId: ESCOLA_A },
        { fila: 'lote', escolaId: ESCOLA_B },
      ],
      janelaDaEscola: (escolaId) => (escolaId === ESCOLA_A ? { ...JANELA_PADRAO, diasLetivos: [1, 2, 3, 4, 5, 6] } : JANELA_PADRAO),
      agora: sabado10h,
      urgentesDisponiveis: 0,
    })
    await despachante.rodada()
    expect(reservas.map(({ escolaId, soUrgentes }) => [escolaId, soUrgentes])).toEqual([
      [ESCOLA_A, true],
      [ESCOLA_B, true],
      [ESCOLA_B, false],
    ])
  })

  it('a rotina do sistema (sem escola) segue o horário letivo padrão', async () => {
    const { despachante, reservas } = montar({ pendentes: [{ fila: 'lote', escolaId: null }], agora: TERCA_10H, urgentesDisponiveis: 0 })
    await despachante.rodada()
    expect(reservas.map(({ escolaId, rotinaDoSistema, soUrgentes }) => [escolaId, rotinaDoSistema, soUrgentes])).toEqual([[null, true, true]])
  })

  it('escola sem vaga livre na janela não chega a reservar: o segurado não gera escrita', async () => {
    const { despachante, reservas, tomadas } = montar({ pendentes: [{ fila: 'lote', escolaId: ESCOLA_A }], livres: () => 0, agora: TERCA_10H })
    expect(await despachante.rodada()).toBe(0)
    expect(reservas).toEqual([])
    expect(tomadas).toEqual([])
  })
})
