import { ErroDeDominio, medidorGlobal, type Banco } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurmaRepository } from '../../estrutura/turma/turma.repository.js'
import type { AcessoDaSala } from '../../sessao/index.js'
import type { BaldeDeLogin } from '../../credencial/index.js'
import { ListaLivreRepository } from './lista-livre.repository.js'
import { ReivindicacaoRepository } from './reivindicacao.repository.js'
import { ReivindicacaoService } from './reivindicacao.service.js'

/**
 * R3 (A1, tarefa 6.0; `tasks/prd-apresentacao-escola/cenarios.md`): o argon2id roda uma vez em todo pedido que passou da
 * chave, com a matrícula certa ou errada, com o nome tomado, inexistente ou de outra turma, pelo semáforo, no balde da
 * escola do acesso, e antes da transação. Rodar o hash só quando a matrícula bate mediria a matrícula pelo tempo.
 *
 * Sem banco: o hash, o semáforo e a transação são falsos e anotam a ordem; os repositories são trocados pelo resultado de
 * cada caso. A mesma regra, com o banco e o hash de verdade, está no R2 de `apps/api/test/salas-reivindicar.int.test.ts`.
 */

/** Um erro com a forma do erro do Postgres, como o Drizzle o entrega em `cause`. */
function erroDoPostgres(code: string): Error {
  return new Error('consulta falhou', { cause: Object.assign(new Error('do servidor'), { code, severity: 'ERROR' }) })
}

/** A sala que o `AcessoDaSala` acharia: só o acesso, a escola, o ano e a turma. */
const SALA: Parameters<Parameters<AcessoDaSala['naSala']>[1]>[0] = { acessoId: randomUUID(), escolaId: randomUUID(), anoLetivoId: randomUUID(), turmaId: randomUUID() }

/** Os cinco casos do R3: o que o `insert` do pedido e o `update` do nome fazem em cada um. */
const CASOS = [
  { caso: 'matrícula certa', inserir: 'grava', tomar: true, resposta: 'enviado' },
  { caso: 'matrícula errada', inserir: 'grava', tomar: false, resposta: ErrorCode.REIVINDICACAO_RECUSADA },
  { caso: 'nome tomado (23505 do pendente por nome)', inserir: '23505', tomar: true, resposta: ErrorCode.REIVINDICACAO_RECUSADA },
  { caso: 'listaNomeId inexistente (23503 da FK)', inserir: '23503', tomar: true, resposta: ErrorCode.REIVINDICACAO_RECUSADA },
  { caso: 'nome de outra turma', inserir: 'grava', tomar: false, resposta: ErrorCode.REIVINDICACAO_RECUSADA },
] as const

describe('reivindicação: o hash sempre, pelo semáforo, antes da transação (R3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function montar(caso: { readonly inserir: string; readonly tomar: boolean }, { rebaixado = false, livreComOutraMatricula = false, anoEmCurso = true } = {}) {
    const eventos: string[] = []
    const baldes: BaldeDeLogin[] = []
    let dentroDoSemaforo = false
    const hash = {
      gerar: vi.fn(async () => {
        eventos.push(dentroDoSemaforo ? 'hash no semáforo' : 'hash fora do semáforo')
        return '$argon2id$falso'
      }),
    }
    const semaforo = {
      executar: async <T>(balde: BaldeDeLogin, tarefa: () => Promise<T>): Promise<T> => {
        baldes.push(balde)
        dentroDoSemaforo = true
        try {
          return await tarefa()
        } finally {
          dentroDoSemaforo = false
        }
      },
    }
    const banco = {
      transaction: async (funcao: (tx: unknown) => Promise<void>) => {
        eventos.push('transação')
        await funcao({})
      },
    } as unknown as Banco
    vi.spyOn(ReivindicacaoRepository.prototype, 'chaveGravada').mockImplementation(async () => {
      eventos.push('lê a chave')
      return false
    })
    // A trava do ano em curso (10.0, C10), no começo da transação: fora de curso, o pedido volta atrás sem gravar.
    vi.spyOn(TurmaRepository.prototype, 'travarAnoEmCurso').mockImplementation(async () => {
      eventos.push('trava o ano')
      return anoEmCurso
    })
    vi.spyOn(ReivindicacaoRepository.prototype, 'inserirPendente').mockImplementation(async () => {
      eventos.push('insert do pedido')
      if (caso.inserir !== 'grava') throw erroDoPostgres(caso.inserir)
    })
    vi.spyOn(ListaLivreRepository.prototype, 'tomar').mockImplementation(async () => {
      eventos.push('update do nome')
      return caso.tomar
    })
    vi.spyOn(ListaLivreRepository.prototype, 'livreComOutraMatricula').mockImplementation(async () => {
      eventos.push('lê o nome livre')
      return livreComOutraMatricula
    })
    // Os limites da sala (7.0), falsos: só anotam quando são chamados, e o `antesDoHash` diz se a turma está no teto.
    const limites = {
      antesDaBusca: vi.fn(async () => undefined),
      codigoErrado: vi.fn(async () => undefined),
      antesDoHash: vi.fn(async (_nome: unknown, _turmaId: string, _escolaId: string, _matriculaErrada: boolean) => {
        eventos.push('limites antes do hash')
        return { rebaixado }
      }),
      teveMatriculaErrada: vi.fn(async () => {
        eventos.push('lê a marca do nome')
        return false
      }),
      hashSemPedido: vi.fn(async () => {
        eventos.push('conta na turma')
      }),
    }
    const servico = new ReivindicacaoService({
      banco,
      acessoDaSala: { naSala: (_entrada, funcao) => funcao(SALA) },
      semaforo,
      hash,
      chaveCodigo: new Uint8Array(32),
      limites,
      medidor: medidorGlobal(),
    })
    return { servico, eventos, baldes, hash, limites }
  }

  const pedido = { slug: 'colegio-sintetico', codigo: 'ABCD2345', listaNomeId: randomUUID(), matricula: 'sintetica-1', senha: 'senha-sintetica-12', chaveEnvio: randomUUID() }

  for (const caso of CASOS) {
    it(`${caso.caso}: um hash, no balde da escola do acesso, antes da transação`, async () => {
      const { servico, eventos, baldes, hash } = montar(caso)
      const resultado = await servico.reivindicar(pedido).then(
        (resposta) => resposta.resultado,
        (erro: unknown) => (erro instanceof ErroDeDominio ? erro.codigo : erro),
      )

      expect(resultado).toBe(caso.resposta)
      expect(hash.gerar).toHaveBeenCalledTimes(1)
      expect(hash.gerar).toHaveBeenCalledWith(pedido.senha)
      expect(baldes).toEqual([{ id: SALA.escolaId, subfila: '', rotulo: SALA.escolaId, rebaixado: false }])
      // A chave é lida antes dos limites e do hash, e a leitura do nome livre, antes dos limites (7.0); o hash roda dentro
      // do semáforo e antes de a transação abrir, e a marca do nome é lida entre os dois; a falha relê a chave e conta na
      // turma.
      const depois = caso.resposta === 'enviado' ? [] : ['lê a chave', 'conta na turma']
      const escritas = caso.inserir === 'grava' ? ['insert do pedido', 'update do nome'] : ['insert do pedido']
      expect(eventos).toEqual(['lê a chave', 'lê o nome livre', 'limites antes do hash', 'hash no semáforo', 'lê a marca do nome', 'transação', 'trava o ano', ...escritas, ...depois])
    })
  }

  it('a chave já gravada responde enviado sem hash, sem semáforo, sem transação e sem limite nenhum', async () => {
    const { servico, eventos, baldes, hash, limites } = montar(CASOS[0])
    vi.mocked(ReivindicacaoRepository.prototype.chaveGravada).mockResolvedValueOnce(true)
    expect(await servico.reivindicar(pedido)).toEqual({ resultado: 'enviado' })
    expect(hash.gerar).not.toHaveBeenCalled()
    expect(baldes).toEqual([])
    expect(eventos).toEqual([])
    for (const limite of Object.values(limites)) expect(limite).not.toHaveBeenCalled()
  })

  it('L5 (7.0): a turma no teto de hashes sem pedido manda o hash rebaixado, no balde da escola, e o pedido segue', async () => {
    const { servico, baldes } = montar(CASOS[0], { rebaixado: true })
    expect(await servico.reivindicar(pedido)).toEqual({ resultado: 'enviado' })
    expect(baldes).toEqual([{ id: SALA.escolaId, subfila: '', rotulo: SALA.escolaId, rebaixado: true }])
  })

  it('L6 (7.0): a matrícula errada num nome livre vai aos limites como errada, pelo acesso e pelo nome escolhido, antes do hash; a recusa conta na turma; o pedido criado não conta', async () => {
    const recusada = montar(CASOS[1], { livreComOutraMatricula: true })
    await expect(recusada.servico.reivindicar(pedido)).rejects.toMatchObject({ codigo: ErrorCode.REIVINDICACAO_RECUSADA })
    expect(recusada.limites.antesDoHash).toHaveBeenCalledWith({ acessoId: SALA.acessoId, listaNomeId: pedido.listaNomeId }, SALA.turmaId, SALA.escolaId, true)
    expect(recusada.limites.hashSemPedido).toHaveBeenCalledWith(SALA.turmaId)
    vi.restoreAllMocks()

    const criado = montar(CASOS[0])
    expect(await criado.servico.reivindicar(pedido)).toEqual({ resultado: 'enviado' })
    expect(criado.limites.antesDoHash).toHaveBeenCalledWith({ acessoId: SALA.acessoId, listaNomeId: pedido.listaNomeId }, SALA.turmaId, SALA.escolaId, false)
    expect(criado.limites.hashSemPedido).not.toHaveBeenCalled()
  })

  it('o nome travado (LIMITE_EXCEDIDO do limite) sai antes do hash, sem semáforo e sem transação', async () => {
    const { servico, eventos, hash, limites } = montar(CASOS[0])
    limites.antesDoHash.mockRejectedValueOnce(new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, 42))
    await expect(servico.reivindicar(pedido)).rejects.toMatchObject({ codigo: ErrorCode.LIMITE_EXCEDIDO, tenteDeNovoEmSegundos: 42 })
    expect(hash.gerar).not.toHaveBeenCalled()
    expect(eventos).toEqual(['lê a chave', 'lê o nome livre'])
  })

  it('o erro que não é FK, 23505 nem nome não tomado sobe como veio, sem reler a chave', async () => {
    const { servico, eventos } = montar({ inserir: '57014', tomar: true })
    await expect(servico.reivindicar(pedido)).rejects.toThrow('consulta falhou')
    expect(eventos).toEqual(['lê a chave', 'lê o nome livre', 'limites antes do hash', 'hash no semáforo', 'lê a marca do nome', 'transação', 'trava o ano', 'insert do pedido'])
  })

  it('C10 (10.0): o ano que deixou de estar em curso faz a transação voltar atrás antes do `insert`; relê a chave e, sem ela, recusa e conta na turma', async () => {
    const { servico, eventos, limites } = montar(CASOS[0], { anoEmCurso: false })
    await expect(servico.reivindicar(pedido)).rejects.toMatchObject({ codigo: ErrorCode.REIVINDICACAO_RECUSADA })
    expect(eventos).toEqual(['lê a chave', 'lê o nome livre', 'limites antes do hash', 'hash no semáforo', 'lê a marca do nome', 'transação', 'trava o ano', 'lê a chave', 'conta na turma'])
    expect(limites.hashSemPedido).toHaveBeenCalledWith(SALA.turmaId)
  })
})
