import { describe, expect, it } from 'vitest'
import { runInContext, type RequestContext } from '../context/context.js'
import { CAMPOS_PROIBIDOS_NA_AUDITORIA } from './acoes.js'
import type { DatabaseExecutor } from './auditoria.repository.js'
import { AuditoriaRejectedError } from './auditoria-rejected.error.js'
import { AuditoriaRecorder, type DadosDaAuditoria } from './auditoria-recorder.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const REDE = '0190f5a0-0000-7000-8000-0000000000e1'
const USUARIO = '0190f5a0-0000-7000-8000-0000000000c1'
const REQUISICAO = '0190f5a0-0000-7000-8000-0000000000f1'

const registro = new AuditoriaRecorder()

// Toda recusa acontece antes de tocar o banco: o executor falha ao primeiro acesso.
const bancoIntocavel = new Proxy(
  {},
  {
    get() {
      throw new Error('a recusa não pode chegar ao banco')
    },
  },
) as DatabaseExecutor

function gravarNoContexto(contexto: RequestContext | undefined, gravar: () => Promise<void>): Promise<void> {
  return contexto === undefined ? gravar() : runInContext(contexto, gravar)
}

async function motivoDaRecusa(contexto: RequestContext | undefined, gravar: () => Promise<void>): Promise<string> {
  const erro: unknown = await gravarNoContexto(contexto, gravar).then(
    () => undefined,
    (recusa: unknown) => recusa,
  )
  if (!(erro instanceof AuditoriaRejectedError)) throw new Error('esperava AuditoriaRecusada')
  return erro.motivo
}

const contextoDoOperadorNaEscola: RequestContext = { requisicaoId: REQUISICAO, escolaId: ESCOLA_A }

describe('RegistroDeAuditoria.gravar: recusa antes de gravar', () => {
  it.each(CAMPOS_PROIBIDOS_NA_AUDITORIA)('campo "%s" em depois é recusado, e a mensagem não leva o valor', async (proibido) => {
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE, [proibido]: 'Enzo Martins' }, autorOperador: 'joaquim' }
    const gravar = () => registro.gravar(bancoIntocavel, 'escola.criada', dados)
    expect(await motivoDaRecusa(contextoDoOperadorNaEscola, gravar)).toBe('dados_fora_do_schema')
    await expect(runInContext(contextoDoOperadorNaEscola, gravar)).rejects.not.toThrow(/Enzo|redeId|nome|email/)
  })

  it('campo pessoal em antes de uma ação sem estado anterior também é recusado', async () => {
    // O tipo já recusa `antes` numa criação; o cast simula o chamador que contorna o compilador.
    const dados = { entidadeId: ESCOLA_A, antes: { nome: 'Colégio Sintético' }, depois: { redeId: REDE }, autorOperador: 'joaquim' } as unknown as DadosDaAuditoria<'escola.criada'>
    expect(await motivoDaRecusa(contextoDoOperadorNaEscola, () => registro.gravar(bancoIntocavel, 'escola.criada', dados))).toBe('dados_fora_do_schema')
  })

  it('valor fora do tipo da lista (tipo de rede inventado, id que não é UUID) é recusado', async () => {
    const semEscola: RequestContext = { requisicaoId: REQUISICAO }
    const tipoInventado = { entidadeId: REDE, depois: { tipo: 'municipal' }, autorOperador: 'joaquim' } as unknown as DadosDaAuditoria<'rede.criada'>
    expect(await motivoDaRecusa(semEscola, () => registro.gravar(bancoIntocavel, 'rede.criada', tipoInventado))).toBe('dados_fora_do_schema')
    const idSequencial = { entidadeId: '1837', depois: { tipo: 'grupo' as const }, autorOperador: 'joaquim' }
    expect(await motivoDaRecusa(semEscola, () => registro.gravar(bancoIntocavel, 'rede.criada', idSequencial))).toBe('dados_fora_do_schema')
  })

  it('ação fora do mapa é recusada', async () => {
    const acao = 'nota.lancada' as 'escola.criada'
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, autorOperador: 'joaquim' }
    expect(await motivoDaRecusa(contextoDoOperadorNaEscola, () => registro.gravar(bancoIntocavel, acao, dados))).toBe('acao_desconhecida')
  })

  it('fora de um contexto não há requisição nem escola: recusa', async () => {
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, autorOperador: 'joaquim' }
    expect(await motivoDaRecusa(undefined, () => registro.gravar(bancoIntocavel, 'escola.criada', dados))).toBe('sem_contexto')
  })

  it('operador com usuário no contexto é recusado: o operador só age em rotina nossa', async () => {
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, autorOperador: 'joaquim' }
    const contextoComUsuario: RequestContext = { requisicaoId: REQUISICAO, escolaId: ESCOLA_A, usuarioId: USUARIO }
    expect(await motivoDaRecusa(contextoComUsuario, () => registro.gravar(bancoIntocavel, 'escola.criada', dados))).toBe('operador_com_usuario')
  })

  it.each([
    ['sem operador', undefined],
    ['operador vazio', ''],
    ['operador com e-mail', 'joaquim@educa.ia'],
    ['operador com espaço', 'Joaquim Paes'],
  ])('sem usuário no contexto e %s: sem autor, recusa', async (_caso, autorOperador) => {
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, ...(autorOperador === undefined ? {} : { autorOperador }) }
    expect(await motivoDaRecusa(contextoDoOperadorNaEscola, () => registro.gravar(bancoIntocavel, 'escola.criada', dados))).toBe('sem_autor')
  })

  it('sem escola no contexto, só a rede criada pelo operador passa: a escola criada sem contexto dela é recusada', async () => {
    const dados = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, autorOperador: 'joaquim' }
    expect(await motivoDaRecusa({ requisicaoId: REQUISICAO }, () => registro.gravar(bancoIntocavel, 'escola.criada', dados))).toBe('sem_escola')
  })

  it('finalidade em ação que não declara finalidade é recusada, mesmo curta: não há canal de texto livre', async () => {
    const comFinalidade = { entidadeId: ESCOLA_A, depois: { redeId: REDE }, autorOperador: 'joaquim', finalidade: 'leitura das notas do Enzo Martins' } as unknown as DadosDaAuditoria<'escola.criada'>
    const gravar = () => registro.gravar(bancoIntocavel, 'escola.criada', comFinalidade)
    expect(await motivoDaRecusa(contextoDoOperadorNaEscola, gravar)).toBe('dados_fora_do_schema')
    await expect(runInContext(contextoDoOperadorNaEscola, gravar)).rejects.not.toThrow(/Enzo/)
  })
})
