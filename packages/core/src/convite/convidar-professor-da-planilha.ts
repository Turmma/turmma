import { ErrorCode } from '@educa/shared'
import { createHash, randomBytes } from 'node:crypto'
import { AuditoriaRecorder } from '../auditoria/auditoria-recorder.js'
import { systemClock } from '../clock.js'
import type { DatabaseTransaction } from '../db/database.js'
import { VALIDADE_DO_CONVITE_HORAS_POR_TIPO } from '../db/schema/convite.js'
import { DomainException } from '../error/domain.exception.js'
import { ConviteDaEscolaRepository } from './convite-da-escola.repository.js'

const registro = new AuditoriaRecorder()

/** Bytes do token sorteado e jogado fora: os mesmos 256 bits do convite da A1. */
const BYTES_DO_TOKEN_DESCARTADO = 32

/**
 * O `convidar` da A1 para o professor que a planilha cadastra (onboarding-por-convite, 6.0; Tech Spec, seção 5, "Gravar":
 * "o `convidar` da A1, token descartado (fica `pendente`)"), na transação do passo (3) e já com a trava do convite da escola
 * e a da conta: acha ou cria o usuário professor inativo na conta já achada no passo (1) e grava o convite de 7 dias com o
 * SHA-256 de um token que ninguém vê. O convite fica `pendente` na lista, e o link sai depois, pelo "Copiar link" (o
 * `convite/refazer`, que cria o token que a coordenação copia). Grava `professor.cadastrado` e `convite.criado` como o
 * cadastro avulso, sem campo que diga se a conta já existia em outra escola (E11 da A1), e nunca o nome nem o e-mail.
 *
 * Devolve `false` quando não há o que convidar: o usuário já está ativo na escola, ou o índice `convite_pendente_unico` recusou
 * (convite em aberto). Quem chama trata como diferença do que a prévia viu e desfaz a transação.
 */
export async function convidarProfessorDaPlanilha(tx: DatabaseTransaction, { contaId, nome }: { readonly contaId: string; readonly nome: string }): Promise<boolean> {
  const convites = new ConviteDaEscolaRepository(tx)
  const usuarioId = await convites.usuarioConvidado(contaId, nome, 'professor')
  if (usuarioId === undefined) return false
  const expiraEm = new Date(systemClock.agora().getTime() + VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor * 60 * 60 * 1_000)
  const tokenHash = createHash('sha256').update(randomBytes(BYTES_DO_TOKEN_DESCARTADO).toString('base64url')).digest('hex')
  let conviteId: string
  try {
    conviteId = await convites.criarConvite({ tipo: 'professor', tokenHash, usuarioId, expiraEm })
  } catch (erro) {
    if (erro instanceof DomainException && erro.codigo === ErrorCode.CONFLITO) return false
    throw erro
  }
  await registro.gravar(tx, 'professor.cadastrado', { entidadeId: usuarioId })
  await registro.gravar(tx, 'convite.criado', { entidadeId: conviteId, depois: { tipo: 'professor', usuarioId, expiraEm: expiraEm.toISOString() } })
  return true
}
