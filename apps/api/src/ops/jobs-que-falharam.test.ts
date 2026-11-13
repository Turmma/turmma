import { DomainException, InvalidConfigError } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { InvalidArgumentError, OperadorRejectedError, urlDoRedisDeFilaDeOperacao } from './command.js'
import { executarOpsDescartarJob } from './descartar-job.js'
import { exigirJobDaOperacao, executarOpsJobsQueFalharam, JobRecusadoError, lerPedidoDeJob, terminarComErro } from './jobs-que-falharam.js'
import { executarOpsReprocessarJob } from './reprocessar-job.js'
import type { JobQueFalhou } from '../operacao/jobs-que-falharam.repository.js'

/**
 * O leitor de argumentos dos três comandos de job (`ops:jobs-que-falharam`, `ops:reprocessar-job`, `ops:descartar-job`), as recusas antes do
 * banco, da fila e do storage, e a recusa por tipo (ingestao-do-material, 3.0). O que o comando faz no banco e na fila está em
 * `apps/api/test/ops-jobs.int.test.ts`.
 */

const JOB = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA = '0190f5a0-0000-7000-8000-00000000000b'

/** O que nenhum destes casos pode abrir: a recusa vem antes. */
const proibido = (o: string) => () => {
  throw new Error(`o comando abriu ${o} antes de recusar`)
}

async function rodar(executar: typeof executarOpsReprocessarJob | typeof executarOpsDescartarJob, argumentos: string[], ambiente: Record<string, string | undefined>) {
  let saida = ''
  let erro = ''
  const codigo = await executar(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }, proibido('o banco'), proibido('a fila ou o storage') as never)
  return { codigo, saida, erro }
}

const linha = (tipo: string, escolaId: string | null = ESCOLA): JobQueFalhou => ({ id: JOB, escolaId, tipo, fila: 'normal', codigoFalha: 'ERRO_INTERNO', concluidoEm: new Date('2026-11-11T12:00:00Z') })

describe('lerPedidoDeJob', () => {
  it('aceita o UUID do job, em minúsculas ou maiúsculas, e o chamado inteiro positivo', () => {
    expect(lerPedidoDeJob([JOB, '--chamado', '4711'])).toEqual({ jobId: JOB, chamado: 4711 })
    expect(lerPedidoDeJob(['--chamado', '1', JOB.toUpperCase()])).toEqual({ jobId: JOB, chamado: 1 })
  })

  it.each([
    ['sem id', ['--chamado', '7'], '<id do job>'],
    ['id que não é UUID', ['1837', '--chamado', '7'], '<id do job>'],
    ['dois ids', [JOB, JOB, '--chamado', '7'], '<id do job>'],
    ['sem --chamado', [JOB], '--chamado'],
    ['--chamado 0', [JOB, '--chamado', '0'], '--chamado'],
    ['--chamado negativo', [JOB, '--chamado', '-3'], '<id do job> e --chamado'],
    ['--chamado=-3 negativo', [JOB, '--chamado=-3'], '--chamado'],
    ['--chamado texto', [JOB, '--chamado', 'abc'], '--chamado'],
    ['--chamado decimal', [JOB, '--chamado', '1.5'], '--chamado'],
    ['--chamado com zero à esquerda', [JOB, '--chamado', '007'], '--chamado'],
    ['--chamado com dez dígitos', [JOB, '--chamado', '1234567890'], '--chamado'],
    ['--chamado vazio', [JOB, '--chamado', ''], '--chamado'],
  ])('%s: InvalidArgumentError citando só a opção', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDeJob(argumentos)).toThrow(new InvalidArgumentError(opcao))
  })

  it('opção desconhecida não repete o valor recebido na mensagem', () => {
    expect(() => lerPedidoDeJob([JOB, '--chamado', '7', '--dados', 'Enzo Martins'])).toThrow(new InvalidArgumentError('<id do job> e --chamado'))
  })
})

describe('os comandos recusam antes de abrir o banco, a fila e o storage', () => {
  it.each([
    ['ops:reprocessar-job', executarOpsReprocessarJob],
    ['ops:descartar-job', executarOpsDescartarJob],
  ])('%s: --chamado inválido e OPERADOR ausente ou fora do formato saem com 2, sem repetir o valor', async (_nome, executar) => {
    expect(await rodar(executar, [JOB, '--chamado', '0'], { OPERADOR: 'joaquim' })).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --chamado\n' })
    expect(await rodar(executar, [JOB, '--chamado', 'abc'], { OPERADOR: 'joaquim' })).toMatchObject({ codigo: 2, saida: '' })
    for (const ambiente of [{}, { OPERADOR: 'Nome Com Espaço' }]) {
      const execucao = await rodar(executar, [JOB, '--chamado', '7'], ambiente)
      expect(execucao).toMatchObject({ codigo: 2, saida: '' })
      expect(execucao.erro).toContain('OPERADOR')
      expect(execucao.erro).not.toContain('Nome Com Espaço')
    }
  })

  it('ops:jobs-que-falharam não aceita argumento, e sem OPERADOR sai com 2', async () => {
    const terminal = { saida: () => undefined, erro: () => undefined }
    expect(await executarOpsJobsQueFalharam(['--escola', ESCOLA], { OPERADOR: 'joaquim' }, terminal, proibido('o banco') as never)).toBe(2)
    expect(await executarOpsJobsQueFalharam([], {}, terminal, proibido('o banco') as never)).toBe(2)
  })
})

describe('exigirJobDaOperacao: quais jobs a operação mexe', () => {
  it.each(['ia.gerar-atividade', 'ia.responder-tutor', 'titular.montar-arquivo', 'titular.eliminar'])('%s: recusado nos dois comandos, com o motivo e sem o id', (tipo) => {
    for (const recusados of [[], ['material.extrair-pdf']]) {
      expect(() => exigirJobDaOperacao(linha(tipo), recusados)).toThrow(new JobRecusadoError('tipo de job que a operação não mexe: IA ou pedido do titular'))
    }
  })

  it('material.extrair-pdf: o reprocessar o recusa com "Tentar de novo é envio novo", e o descartar o aceita', () => {
    expect(() => exigirJobDaOperacao(linha('material.extrair-pdf'), ['material.extrair-pdf'])).toThrow(new JobRecusadoError('Tentar de novo é envio novo'))
    expect(exigirJobDaOperacao(linha('material.extrair-pdf'), [])).toEqual({ escolaId: ESCOLA, tipo: 'material.extrair-pdf' })
  })

  it('retencao.* e o e-mail de convite passam, com a escola da linha', () => {
    expect(exigirJobDaOperacao(linha('retencao.expurgar-escola'), ['material.extrair-pdf'])).toEqual({ escolaId: ESCOLA, tipo: 'retencao.expurgar-escola' })
    expect(exigirJobDaOperacao(linha('email.enviar-convite'), [])).toEqual({ escolaId: ESCOLA, tipo: 'email.enviar-convite' })
  })

  it('tipo que não existe é recusado, para a auditoria nunca receber texto livre', () => {
    expect(() => exigirJobDaOperacao(linha('tipo.de-uma-versao-antiga'), [])).toThrow(new JobRecusadoError('tipo de job desconhecido'))
  })

  it('job sem escola (sistema.*) passa, com a escola nula: a auditoria dele sai sem escola (5.0)', () => {
    expect(exigirJobDaOperacao(linha('sistema.expurgar-acesso', null), [])).toEqual({ escolaId: null, tipo: 'sistema.expurgar-acesso' })
    expect(exigirJobDaOperacao(linha('sistema.expurgar-acesso', null), ['material.extrair-pdf'])).toEqual({ escolaId: null, tipo: 'sistema.expurgar-acesso' })
  })
})

describe('terminarComErro: o código de saída e o texto, sem nada do pedido nem da linha', () => {
  const terminar = (erro: unknown) => {
    let texto = ''
    const codigo = terminarComErro(erro, { saida: () => undefined, erro: (linhaDeErro) => (texto += linhaDeErro) })
    return { codigo, texto }
  }

  it('argumento, ambiente e operador: 2, só com o nome da opção ou da variável', () => {
    expect(terminar(new InvalidArgumentError('--chamado'))).toEqual({ codigo: 2, texto: 'Opção inválida ou ausente: --chamado\n' })
    expect(terminar(new InvalidConfigError(['REDIS_FILA_URL'])).codigo).toBe(2)
    expect(terminar(new OperadorRejectedError()).codigo).toBe(2)
  })

  it('recusa por tipo: 1, com a mensagem fixa', () => {
    expect(terminar(new JobRecusadoError('Tentar de novo é envio novo'))).toEqual({ codigo: 1, texto: 'Tentar de novo é envio novo\n' })
  })

  it('NAO_ENCONTRADO e CONFLITO do domínio, e o 23505 do Postgres que vira CONFLITO: 1, com o texto do código', () => {
    expect(terminar(new DomainException(ErrorCode.NAO_ENCONTRADO))).toEqual({ codigo: 1, texto: 'NAO_ENCONTRADO: job não encontrado entre os que falharam\n' })
    expect(terminar(new DomainException(ErrorCode.CONFLITO)).texto).toMatch(/^CONFLITO: /)
    const unica = Object.assign(new pg.DatabaseError('duplicate key com o valor Enzo Martins', 0, 'error'), { severity: 'ERROR', code: '23505', constraint: 'job_registro_idempotencia' })
    expect(terminar(unica)).toMatchObject({ codigo: 1, texto: expect.stringMatching(/^CONFLITO: /) })
  })

  it('o código de domínio sem texto próprio e o erro qualquer: ERRO_INTERNO resumido, sem a mensagem', () => {
    const outroCodigo = terminar(new DomainException(ErrorCode.NAO_AUTENTICADO))
    expect(outroCodigo.codigo).toBe(1)
    expect(outroCodigo.texto).toMatch(/^ERRO_INTERNO: /)
    const qualquer = terminar(new Error('falha com o valor Enzo Martins'))
    expect(qualquer.codigo).toBe(1)
    expect(qualquer.texto).toMatch(/^ERRO_INTERNO: /)
    expect(qualquer.texto).not.toContain('Enzo Martins')
  })
})

describe('urlDoRedisDeFilaDeOperacao: o Redis de fila dos comandos', () => {
  it('o REDIS_FILA_URL do container vale, e só no formato redis://host[:porta][/banco]', () => {
    expect(urlDoRedisDeFilaDeOperacao({ REDIS_FILA_URL: 'redis://redis-fila:6379', REDIS_FILA_PORTA_HOST: '6380' })).toBe('redis://redis-fila:6379')
    expect(() => urlDoRedisDeFilaDeOperacao({ REDIS_FILA_URL: 'http://redis-fila:6379' })).toThrow(InvalidConfigError)
    expect(() => urlDoRedisDeFilaDeOperacao({ REDIS_FILA_URL: 'redis://com espaço:6379' })).toThrow(InvalidConfigError)
  })

  it('na máquina, a porta do host do compose local; sem nenhum dos dois, InvalidConfigError pelo nome da variável', () => {
    expect(urlDoRedisDeFilaDeOperacao({ REDIS_FILA_PORTA_HOST: '6380' })).toBe('redis://127.0.0.1:6380')
    expect(() => urlDoRedisDeFilaDeOperacao({})).toThrow(new InvalidConfigError(['REDIS_FILA_URL']))
  })
})
