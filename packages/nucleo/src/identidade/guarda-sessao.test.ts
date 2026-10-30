import { ErrorCode } from '@educa/shared'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { METRICAS } from '../telemetria/metricas.js'
import { contextoAtual, executarNoContexto } from '../contexto/contexto.js'
import { GuardaDeSessao, type LeituraDeSessao } from './guarda-sessao.js'
import type { LinhaDaSessao } from './sessao.repository.js'
import { guardarTokenDaRequisicao } from './token-da-requisicao.js'
import type { TokenVerificado } from './verificar-token.js'

const token = {
  escolaId: '0190f5a0-0000-7000-8000-00000000000a',
  usuarioId: '0190f5a0-0000-7000-8000-0000000000a1',
  sessaoId: '0190f5a0-0000-7000-8000-0000000000d1',
} as TokenVerificado

const agora = new Date()
const linhaValida: LinhaDaSessao = {
  usuarioId: token.usuarioId,
  papel: 'professor',
  desativadoEm: null,
  eliminacaoAgendadaEm: null,
  encerradaEm: null,
  expiraEm: new Date(agora.getTime() + 3_600_000),
  ultimoUsoEm: agora,
  inatividadeAlunoMin: 30,
  inatividadeEquipeMin: 120,
  anoLetivoId: null,
  rotacionadoEm: null,
  atualApresentado: false,
  agora,
}

class Rota {
  handler(): void {}
}

function execucao(requisicao: object): ExecutionContext {
  return {
    getHandler: () => Rota.prototype.handler,
    getClass: () => Rota,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext
}

const comToken = () => {
  const requisicao = {}
  guardarTokenDaRequisicao(requisicao, token)
  return requisicao
}

describe('GuardaDeSessao', () => {
  it('sessão válida: grava escola, usuário, papel, sessão e ano no contexto, com uma leitura só', async () => {
    const leitura: LeituraDeSessao = { lerParaGuarda: vi.fn().mockResolvedValue(linhaValida), marcarAtualApresentado: vi.fn() }
    const contexto = await executarNoContexto({ requisicaoId: 'r' }, async () => {
      expect(await new GuardaDeSessao(new Reflector(), leitura).canActivate(execucao(comToken()))).toBe(true)
      return contextoAtual()
    })
    expect(contexto).toEqual({ requisicaoId: 'r', ...token, papel: 'professor', anoLetivoId: null })
    expect(leitura.lerParaGuarda).toHaveBeenCalledTimes(1)
    expect(leitura.lerParaGuarda).toHaveBeenCalledWith(token)
  })

  it('falha: erro ou prazo estourado na leitura responde INDISPONIVEL_TENTE_DE_NOVO 503 com espera, nunca 401, e não grava contexto', async () => {
    for (const falha of [Object.assign(new Error('Connection terminated due to connection timeout'), {}), Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014', severity: 'ERROR' })]) {
      const leitura: LeituraDeSessao = { lerParaGuarda: vi.fn().mockRejectedValue(falha), marcarAtualApresentado: vi.fn() }
      await executarNoContexto({ requisicaoId: 'r' }, async () => {
        await expect(new GuardaDeSessao(new Reflector(), leitura).canActivate(execucao(comToken()))).rejects.toMatchObject({
          codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
          status: 503,
          tenteDeNovoEmSegundos: expect.any(Number),
        })
        expect(contextoAtual()?.escolaId).toBeUndefined()
      })
    }
  })

  it('sessão que não vale (inexistente) responde NAO_AUTENTICADO e não grava contexto', async () => {
    const leitura: LeituraDeSessao = { lerParaGuarda: vi.fn().mockResolvedValue(undefined), marcarAtualApresentado: vi.fn() }
    await executarNoContexto({ requisicaoId: 'r' }, async () => {
      await expect(new GuardaDeSessao(new Reflector(), leitura).canActivate(execucao(comToken()))).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO, status: 401 })
      expect(contextoAtual()?.escolaId).toBeUndefined()
    })
  })

  it('sem token verificado na requisição (guarda fora de ordem), falha fechada sem ler o banco', async () => {
    const leitura: LeituraDeSessao = { lerParaGuarda: vi.fn(), marcarAtualApresentado: vi.fn() }
    await executarNoContexto({ requisicaoId: 'r' }, async () => {
      await expect(new GuardaDeSessao(new Reflector(), leitura).canActivate(execucao({}))).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    })
    expect(leitura.lerParaGuarda).not.toHaveBeenCalled()
  })
})

describe('GuardaDeSessao: marcação do token renovado e medida da leitura', () => {
  const medidores: MedidorDeTeste[] = []
  afterEach(async () => {
    await Promise.all(medidores.splice(0).map((medidor) => medidor.encerrar()))
  })

  const rotacionadoEm = new Date(agora.getTime() - 60_000)
  const tokenDe = (emitidoEm: Date) => ({ ...token, emitidoEm: Math.floor(emitidoEm.getTime() / 1_000) }) as TokenVerificado
  const requisicaoCom = (verificado: TokenVerificado) => {
    const requisicao = {}
    guardarTokenDaRequisicao(requisicao, verificado)
    return requisicao
  }

  it('o token emitido depois da rotação marca a sessão sem esperar a gravação; o de antes não marca', async () => {
    let terminar: (marcou: boolean) => void = () => undefined
    const leitura: LeituraDeSessao = {
      lerParaGuarda: vi.fn().mockResolvedValue({ ...linhaValida, rotacionadoEm }),
      // A marcação fica pendurada: a guarda responde mesmo assim.
      marcarAtualApresentado: vi.fn(() => new Promise<boolean>((resolver) => (terminar = resolver))),
    }
    const guarda = new GuardaDeSessao(new Reflector(), leitura)
    const novo = tokenDe(new Date(rotacionadoEm.getTime() + 1_000))
    await executarNoContexto({ requisicaoId: 'r' }, async () => expect(await guarda.canActivate(execucao(requisicaoCom(novo)))).toBe(true))
    expect(leitura.marcarAtualApresentado).toHaveBeenCalledWith(novo)
    terminar(true)

    const antigo = tokenDe(new Date(rotacionadoEm.getTime() - 5_000))
    await executarNoContexto({ requisicaoId: 'r' }, async () => expect(await guarda.canActivate(execucao(requisicaoCom(antigo)))).toBe(true))
    expect(leitura.marcarAtualApresentado).toHaveBeenCalledTimes(1)
  })

  it('falha: a marcação que rejeita não derruba a requisição', async () => {
    const leitura: LeituraDeSessao = {
      lerParaGuarda: vi.fn().mockResolvedValue({ ...linhaValida, rotacionadoEm }),
      marcarAtualApresentado: vi.fn().mockRejectedValue(new Error('canceling statement due to statement timeout')),
    }
    const novo = tokenDe(new Date(rotacionadoEm.getTime() + 1_000))
    await executarNoContexto({ requisicaoId: 'r' }, async () => expect(await new GuardaDeSessao(new Reflector(), leitura).canActivate(execucao(requisicaoCom(novo)))).toBe(true))
    await new Promise((resolver) => setImmediate(resolver))
    expect(leitura.marcarAtualApresentado).toHaveBeenCalledTimes(1)
  })

  it('mede cada leitura em sessao.leitura.duracao, em segundos, também a que falha, e sem rótulo de escola nem de usuário', async () => {
    const medidor = new MedidorDeTeste()
    medidores.push(medidor)
    const leituras = [vi.fn().mockResolvedValue(linhaValida), vi.fn().mockRejectedValue(new Error('Connection terminated'))]
    for (const lerParaGuarda of leituras) {
      const guarda = new GuardaDeSessao(new Reflector(), { lerParaGuarda, marcarAtualApresentado: vi.fn() }, medidor.medidor)
      await executarNoContexto({ requisicaoId: 'r' }, () => guarda.canActivate(execucao(comToken())).catch(() => false))
    }
    const pontos = await medidor.pontos(METRICAS.leituraDeSessao)
    expect(pontos).toHaveLength(1)
    expect(pontos[0]?.atributos).toEqual({})
    expect((pontos[0]?.valor as { contagem: number }).contagem).toBe(2)
  })
})
