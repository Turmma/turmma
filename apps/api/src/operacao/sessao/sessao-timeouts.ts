/**
 * O que a `OperadorGuard` lê da sessão do token, numa consulta: os prazos, o encerramento, se o operador está
 * desativado, e a hora do banco, contra a qual os prazos se comparam (a mesma régua do `ultimo_uso_em`, que o banco grava).
 */
export interface SessaoDeOperadorForGuard {
  readonly encerradaEm: Date | null
  readonly expiraEm: Date
  readonly ultimoUsoEm: Date
  readonly operadorDesativadoEm: Date | null
  readonly agora: Date
}

/**
 * O que a renovação lê da sessão do cookie, numa consulta: o que a guarda lê (os prazos, o encerramento, o operador e a
 * hora do banco), mais os ids, se o cookie é o refresh atual ou o anterior, e quando a sessão rotacionou.
 */
export interface SessaoDeOperadorForRefresh extends SessaoDeOperadorForGuard {
  readonly id: string
  readonly operadorId: string
  readonly pelo: 'atual' | 'anterior'
  readonly rotacionadoEm: Date | null
}

/** A sessão do operador dura até 8 h, qualquer que seja o uso (PRD da A0, RF5). O `expira_em` nasce com isso. */
export const DURACAO_DA_SESSAO_DE_OPERADOR_HORAS = 8

/** A sessão do operador termina depois de 30 min sem uso (PRD da A0, RF5), sem tolerância nem configuração. */
export const INATIVIDADE_DO_OPERADOR_MIN = 30

/**
 * Por quantos segundos depois de uma rotação o cookie anterior ainda renova (Tech Spec da A0, seção 5, "Travas no
 * banco", renovação; PRD, "duas abas renovando ao mesmo tempo"): é a outra aba, que mandou o mesmo cookie junto. Depois
 * disso, o cookie anterior é reuso, e encerra a sessão. O mesmo prazo do F1 (`ALREADY_REFRESHED_WINDOW_SECONDS`).
 */
export const JANELA_DO_REFRESH_ANTERIOR_SEGUNDOS = 30

const MS_POR_MINUTO = 60_000

/**
 * Se a sessão do operador ainda vale agora (a hora do banco): existe, não foi encerrada (saída, desativação, refresh
 * reusado), o operador está ativo, as 8 h não passaram e o último uso tem menos de 30 min. Qualquer outro caso é
 * `SESSAO_ENCERRADA` na guarda; o prazo do token de acesso é conferido à parte (`ACESSO_VENCIDO`).
 */
export function sessaoDeOperadorVale(linha: SessaoDeOperadorForGuard | undefined): boolean {
  if (linha === undefined) return false
  if (linha.encerradaEm !== null || linha.operadorDesativadoEm !== null) return false
  const agora = linha.agora.getTime()
  if (linha.expiraEm.getTime() <= agora) return false
  return agora - linha.ultimoUsoEm.getTime() < INATIVIDADE_DO_OPERADOR_MIN * MS_POR_MINUTO
}
