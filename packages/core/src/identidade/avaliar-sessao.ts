import type { RequestSessao } from '../context/context.js'
import type { SessaoRow } from './sessao.repository.js'
import type { VerifiedToken } from './verify-token.js'

/**
 * Minutos além da inatividade configurada pela escola antes de a sessão vencer: uma atividade perdida (a web
 * manda no máximo uma a cada 5 min) não desloga ninguém (Tech Spec, seção 5, "Atividade").
 */
export const TOLERANCIA_DE_INATIVIDADE_MIN = 5

const MS_POR_MINUTO = 60_000

/** Os minutos sem uso que a escola dá ao papel: o do aluno, ou o da equipe para professor e coordenador. */
export function inatividadeDoPapel(linha: Pick<SessaoRow, 'papel' | 'inatividadeAlunoMin' | 'inatividadeEquipeMin'>): number {
  return linha.papel === 'aluno' ? linha.inatividadeAlunoMin : linha.inatividadeEquipeMin
}

/** O que decide se uma sessão ainda vale, sem olhar o token: a guarda e a renovação conferem o mesmo. */
export type EstadoDaSessao = Pick<
  SessaoRow,
  'papel' | 'desativadoEm' | 'eliminacaoAgendadaEm' | 'encerradaEm' | 'expiraEm' | 'ultimoUsoEm' | 'inatividadeAlunoMin' | 'inatividadeEquipeMin' | 'agora'
>

/**
 * Se a sessão ainda vale agora (a hora do banco): não encerrada, usuário ativo e sem eliminação agendada (F3, 14.0: o
 * registro já encerrou as sessões abertas, e a condição repete, para a sessão que nascesse no meio nunca valer), dentro das 12 h absolutas, e com o
 * último uso dentro da inatividade do papel mais a tolerância. A renovação confere o mesmo que a guarda: um cookie
 * de sessão vencida por inatividade não renova (o Chromebook do carrinho não entrega a conta anterior).
 */
export function sessaoAindaVale(linha: EstadoDaSessao): boolean {
  if (linha.encerradaEm !== null || linha.desativadoEm !== null || linha.eliminacaoAgendadaEm !== null) return false
  const agora = linha.agora.getTime()
  if (linha.expiraEm.getTime() <= agora) return false
  const limiteDeInatividadeMs = (inatividadeDoPapel(linha) + TOLERANCIA_DE_INATIVIDADE_MIN) * MS_POR_MINUTO
  return agora - linha.ultimoUsoEm.getTime() < limiteDeInatividadeMs
}

/**
 * Se a requisição traz o token que a última renovação emitiu, e a sessão ainda não foi marcada: o `iat` dele não é
 * anterior a `rotacionado_em`. O banco confere de novo, com a hora exata, na marcação.
 */
export function tokenDaUltimaRenovacao(token: VerifiedToken, linha: Pick<SessaoRow, 'rotacionadoEm' | 'atualApresentado'>): boolean {
  if (linha.atualApresentado || linha.rotacionadoEm === null || token.emitidoEm === undefined) return false
  return token.emitidoEm * 1_000 >= linha.rotacionadoEm.getTime()
}

/**
 * Confere a sessão lida para o token e devolve o que vai para o contexto, ou `undefined` quando ela não vale. Toda
 * recusa é a mesma para quem chamou (`NAO_AUTENTICADO`):
 * - sessão inexistente para `(esc, sid)`;
 * - `sessao.usuario_id` diferente do `sub` do token;
 * - sessão encerrada, ou expirada (`expira_em` já passou);
 * - usuário desativado, ou com a eliminação agendada (14.0);
 * - inatividade vencida: `ultimo_uso_em` mais a inatividade do papel e a tolerância já passou.
 */
export function avaliarSessao(token: VerifiedToken, linha: SessaoRow | undefined): RequestSessao | undefined {
  if (linha === undefined) return undefined
  if (linha.usuarioId !== token.usuarioId) return undefined
  if (!sessaoAindaVale(linha)) return undefined
  return {
    escolaId: token.escolaId,
    usuarioId: token.usuarioId,
    papel: linha.papel,
    sessaoId: token.sessaoId,
    anoLetivoId: linha.anoLetivoId,
  }
}
