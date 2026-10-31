import {
  currentContext,
  DomainException,
  postgresErrorIn,
  runInContext,
  mapPostgresError,
  AuditoriaRecorder,
  type Database,
  type TipoDeRede,
} from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { AuthorCheck } from '../../sessao/index.js'
import { RedeEEscolaRepository, type Criada } from './escola.repository.js'

/**
 * Criação de rede e de escola pelo operador Turmma (RF1, D2): o painel da operação (`POST /v1/operacao/redes` e
 * `/escolas`, A0b) e o comando de terminal `ops:escola` (`ops/escola.ts`) chamam os mesmos `criarRede` e `criarEscola`.
 * Não há rota de escola nem cadastro público: a escola nasce só por um dos dois.
 */

const registro = new AuditoriaRecorder()

/**
 * Cria a rede e grava `rede.criada`, com escola nula e o autor conferido, na mesma transação. O autor é a primeira
 * instrução dela (`AuthorCheck`): quem não passa não grava nada. O pedido repetido (mesmo id, mesmos dados)
 * devolve o mesmo id sem auditoria nova; o mesmo id com outros dados, `CONFLITO`.
 */
export function criarRede(banco: Database, autor: AuthorCheck, pedido: { id: string; nome: string; tipo: TipoDeRede }): Promise<Criada> {
  return runInContext({ requisicaoId: currentContext()?.requisicaoId ?? randomUUID() }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const criada = await new RedeEEscolaRepository(tx).criarRede(pedido)
      if (criada.nova) await registro.gravar(tx, 'rede.criada', { entidadeId: criada.id, depois: { tipo: pedido.tipo }, autorOperador })
      return criada
    }),
  )
}

/**
 * Cria a escola e grava `escola.criada` no contexto dela, na mesma transação, com o autor conferido como primeira
 * instrução. Slug de outra escola e o mesmo id com outros dados saem como `CONFLITO`, e rede inexistente como
 * `NAO_ENCONTRADO`, sem o valor recebido. O pedido repetido devolve o mesmo id sem auditoria nova.
 */
export async function criarEscola(banco: Database, autor: AuthorCheck, pedido: { id: string; redeId: string; nome: string; slug: string }): Promise<Criada> {
  const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
  try {
    return await runInContext({ requisicaoId }, () =>
      banco.transaction(async (tx) => {
        const autorOperador = await autor(tx)
        const criada = await new RedeEEscolaRepository(tx).criarEscola(pedido)
        if (criada.nova) {
          await runInContext({ requisicaoId, escolaId: criada.id }, () =>
            registro.gravar(tx, 'escola.criada', { entidadeId: criada.id, depois: { redeId: pedido.redeId }, autorOperador }),
          )
        }
        return criada
      }),
    )
  } catch (erro) {
    // foreign_key_violation: a rede informada não existe.
    if (postgresErrorIn(erro)?.code === '23503') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    throw mapPostgresError(erro) ?? erro
  }
}
