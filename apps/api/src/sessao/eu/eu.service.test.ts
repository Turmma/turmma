import { runInContext, METRICS } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../../tools/testes/metricas.ts'
import type { TenantResolutionRepository } from '../tenant/tenant-resolution.repository.js'
import type { MeRepository, MeRow } from './eu.repository.js'
import { MeService } from './eu.service.js'

const ANTIGA = new Date('2020-01-02T03:04:05.678Z')
const MEIA = new Date('2022-06-07T08:09:10.111Z')
const RECENTE = new Date('2026-10-01T10:00:00.000Z')

const LINHA: MeRow = {
  usuarioId: randomUUID(),
  contaId: randomUUID(),
  papel: 'professor',
  nome: 'Pessoa sintética',
  escola: { id: randomUUID(), nome: 'Escola sintética', slug: 'escola-sintetica' },
  inatividadeAlunoMin: 30,
  inatividadeEquipeMin: 60,
  introducaoVistaEm: null,
}

interface Cenario {
  readonly servico: MeService
  readonly gravacoes: () => number
  readonly consultasDeConta: () => number
}

/**
 * Um `MeService` sobre repositories de mão: só a regra de qual data vale e de quando o `GET` grava. O que o banco faz
 * (`coalesce`, o `id` do contexto, a corrida) é do teste de integração, que roda a API de verdade.
 */
function montar(
  medidor: MedidorDeTeste,
  opcoes: { linha?: Partial<MeRow> | null; emprestada?: Date | null; gravada?: Date | null; gravacaoFalha?: boolean },
): Cenario {
  let gravacoes = 0
  let consultas = 0
  const linha: MeRow | undefined = opcoes.linha === null ? undefined : { ...LINHA, ...opcoes.linha }
  const eu = {
    doContexto: async () => linha,
    marcarIntroducaoVista: async () => {
      gravacoes += 1
      if (opcoes.gravacaoFalha === true) throw new Error('banco fora')
      return opcoes.gravada === null ? undefined : (opcoes.gravada ?? RECENTE)
    },
  } as unknown as MeRepository
  const resolucao = {
    acessosDaConta: async () => [],
    introducaoMaisAntigaDaConta: async () => {
      consultas += 1
      return opcoes.emprestada ?? null
    },
  } as unknown as TenantResolutionRepository
  return { servico: new MeService(eu, resolucao, medidor.medidor), gravacoes: () => gravacoes, consultasDeConta: () => consultas }
}

describe('EuService: qual data da introdução vale, e quando o GET grava', () => {
  const medidores: MedidorDeTeste[] = []
  const novoMedidor = () => {
    const medidor = new MedidorDeTeste()
    medidores.push(medidor)
    return medidor
  }
  const comContexto = <T>(corpo: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId: LINHA.escola.id, usuarioId: LINHA.usuarioId }, corpo)

  afterEach(async () => {
    await Promise.all(medidores.splice(0).map((medidor) => medidor.encerrar()))
  })

  it('sem data em lugar nenhum: nulo, e o GET não grava', async () => {
    const cenario = montar(novoMedidor(), {})
    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBeNull()
    expect(cenario.gravacoes()).toBe(0)
  })

  it('só a própria: devolve a própria, sem gravar', async () => {
    const cenario = montar(novoMedidor(), { linha: { introducaoVistaEm: MEIA } })
    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBe(MEIA.toISOString())
    expect(cenario.gravacoes()).toBe(0)
  })

  it('só a emprestada, com a linha nula: devolve a emprestada e grava uma vez, pelo método que não recebe data', async () => {
    const cenario = montar(novoMedidor(), { emprestada: ANTIGA })
    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBe(ANTIGA.toISOString())
    expect(cenario.gravacoes()).toBe(1)
  })

  it('a emprestada mais antiga que a própria vence; a própria mais antiga que a emprestada vence; nenhuma das duas grava', async () => {
    const emprestadaVence = montar(novoMedidor(), { linha: { introducaoVistaEm: RECENTE }, emprestada: ANTIGA })
    const propriaVence = montar(novoMedidor(), { linha: { introducaoVistaEm: ANTIGA }, emprestada: RECENTE })
    expect((await comContexto(() => emprestadaVence.servico.obter())).introducaoVistaEm).toBe(ANTIGA.toISOString())
    expect((await comContexto(() => propriaVence.servico.obter())).introducaoVistaEm).toBe(ANTIGA.toISOString())
    expect([emprestadaVence.gravacoes(), propriaVence.gravacoes()]).toEqual([0, 0])
  })

  it('a gravação que falha: o GET devolve a emprestada e conta a falha, sem rótulo', async () => {
    const medidor = novoMedidor()
    const cenario = montar(medidor, { emprestada: ANTIGA, gravacaoFalha: true })

    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBe(ANTIGA.toISOString())

    expect(await medidor.pontos(METRICS.introducaoFalha)).toEqual([{ atributos: {}, valor: 1 }])
  })

  it('só a emprestada, e a linha sumiu na hora de gravar: o GET devolve a emprestada, sem contar falha', async () => {
    const medidor = novoMedidor()
    const cenario = montar(medidor, { emprestada: ANTIGA, gravada: null })

    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBe(ANTIGA.toISOString())

    expect(cenario.gravacoes()).toBe(1)
    expect(await medidor.pontos(METRICS.introducaoFalha)).toEqual([{ atributos: {}, valor: 0 }])
  })

  it('o aluno não tem conta: não consulta as outras escolas, e vale a própria data', async () => {
    const cenario = montar(novoMedidor(), { linha: { papel: 'aluno', contaId: null, introducaoVistaEm: MEIA } })
    expect((await comContexto(() => cenario.servico.obter())).introducaoVistaEm).toBe(MEIA.toISOString())
    expect(cenario.consultasDeConta()).toBe(0)
  })

  it('o POST responde a mais antiga entre a que ficou gravada e a emprestada', async () => {
    const cenario = montar(novoMedidor(), { gravada: RECENTE, emprestada: ANTIGA })
    expect((await comContexto(() => cenario.servico.concluirIntroducao())).introducaoVistaEm).toBe(ANTIGA.toISOString())
    const semEmprestada = montar(novoMedidor(), { gravada: MEIA })
    expect((await comContexto(() => semEmprestada.servico.concluirIntroducao())).introducaoVistaEm).toBe(MEIA.toISOString())
  })

  it('a pessoa que saiu entre a guarda e a leitura é não autenticada, no GET e no POST; e a marca que não achou a linha também', async () => {
    const semLinha = montar(novoMedidor(), { linha: null })
    await expect(comContexto(() => semLinha.servico.obter())).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    await expect(comContexto(() => semLinha.servico.concluirIntroducao())).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    expect(semLinha.gravacoes()).toBe(0)

    const saiuNaMarca = montar(novoMedidor(), { gravada: null })
    await expect(comContexto(() => saiuNaMarca.servico.concluirIntroducao())).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
  })
})
