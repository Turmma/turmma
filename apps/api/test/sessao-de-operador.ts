import { createPool, OperadorTokenIssuer, type DatabasePool } from '@educa/core'
import { createHash, randomBytes } from 'node:crypto'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { DURACAO_DA_SESSAO_DE_OPERADOR_HORAS } from '../src/operacao/sessao/prazos-da-sessao.js'

/** Um operador ativo com uma sessão aberta, e o token de acesso dela. */
export interface SessaoDeOperadorDeTeste {
  readonly operadorId: string
  readonly apelido: string
  readonly nome: string
  readonly sessaoId: string
  /** Token de acesso emitido na criação: vale 10 min. */
  readonly token: string
  /** O refresh da sessão, o valor do cookie `turmma_operacao` (o banco guarda só o SHA-256). */
  readonly refresh: string
  /** Um token desta sessão emitido em outro instante, para o caso do acesso já vencido. */
  tokenEm(agora: Date): Promise<string>
}

/**
 * Operadores e sessões de operador para os testes da área da operação, no Postgres do compose de teste, **antes** de
 * existir o login do operador (tarefa 7.0). O token sai do `OperadorTokenIssuer` de produção, com a chave e o
 * `typ` que a API confere: a `GuardaDeOperador` recusaria qualquer outro. A 7.0 repete o C47 com o cookie de verdade.
 *
 * Nada de pessoa: apelido sorteado, nome fixo e e-mail em `.invalid`. `fechar` apaga tudo o que a bancada criou, com a
 * auditoria dos comandos que rodaram sobre esses operadores: sem isso, o operador ativo que ficasse faria todo `ops:*`
 * de outro arquivo de teste exigir um `OPERADOR` que ele não conhece.
 */
export class BancadaDeOperadores {
  readonly pool: DatabasePool
  readonly #emissor: OperadorTokenIssuer
  readonly #chave: Uint8Array
  readonly #operadores: string[] = []

  constructor(url = urlDoBancoDeTeste(), ambiente: Record<string, string | undefined> = lerAmbienteDeTeste()) {
    this.pool = createPool({ url, maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    const chave = ambiente['IDENTIDADE_CHAVE_ASSINATURA']
    if (chave === undefined) throw new Error('IDENTIDADE_CHAVE_ASSINATURA ausente no ambiente de teste')
    this.#chave = new TextEncoder().encode(chave)
    this.#emissor = new OperadorTokenIssuer(this.#chave)
  }

  /** Um operador ativo novo, sem sessão. */
  async operador(): Promise<{ operadorId: string; apelido: string; nome: string }> {
    const apelido = `t-${randomBytes(6).toString('hex')}`
    const nome = 'Pessoa Sintética da Operação'
    const { rows } = await this.pool.query<{ id: string }>('insert into operador (apelido, nome, email) values ($1, $2, $3) returning id', [apelido, nome, `${apelido}@turmma.invalid`])
    const operadorId = rows[0]?.id
    if (operadorId === undefined) throw new Error('operador de teste não criado')
    this.#operadores.push(operadorId)
    return { operadorId, apelido, nome }
  }

  /** Uma sessão aberta agora, de 8 h, para o operador, e o token de acesso dela. */
  async sessao(operador: { operadorId: string; apelido: string; nome: string }): Promise<SessaoDeOperadorDeTeste> {
    const refresh = randomBytes(32).toString('base64url')
    const refreshHash = createHash('sha256').update(refresh).digest('hex')
    const { rows } = await this.pool.query<{ id: string }>(
      `insert into sessao_operador (operador_id, refresh_hash, expira_em) values ($1, $2, now() + make_interval(hours => $3)) returning id`,
      [operador.operadorId, refreshHash, DURACAO_DA_SESSAO_DE_OPERADOR_HORAS],
    )
    const sessaoId = rows[0]?.id
    if (sessaoId === undefined) throw new Error('sessão de operador de teste não criada')
    const pedido = { operadorId: operador.operadorId, sessaoId }
    return {
      ...operador,
      sessaoId,
      refresh,
      token: (await this.#emissor.emitir(pedido)).token,
      tokenEm: async (agora: Date) => (await new OperadorTokenIssuer(this.#chave, { agora: () => agora }).emitir(pedido)).token,
    }
  }

  /** Operador novo com uma sessão aberta. */
  async operadorComSessao(): Promise<SessaoDeOperadorDeTeste> {
    return this.sessao(await this.operador())
  }

  /** Apaga os operadores desta bancada e tudo que aponta para eles, e fecha o pool. */
  async fechar(): Promise<void> {
    try {
      const ids = this.#operadores
      if (ids.length > 0) {
        await this.pool.query('delete from auditoria_operacao where operador_alvo_id = any($1::uuid[])', [ids])
        await this.pool.query('delete from acesso_operacao where operador_id = any($1::uuid[])', [ids])
        await this.pool.query('delete from sessao_operador where operador_id = any($1::uuid[])', [ids])
        await this.pool.query('delete from convite_operador where operador_id = any($1::uuid[])', [ids])
        await this.pool.query('delete from codigo_recuperacao_operador where operador_id = any($1::uuid[])', [ids])
        await this.pool.query('delete from operador where id = any($1::uuid[])', [ids])
      }
    } finally {
      await this.pool.end()
    }
  }
}
