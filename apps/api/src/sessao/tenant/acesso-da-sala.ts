import { ErroDeDominio } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { naEscolaSemUsuario } from './escola-sem-usuario.js'
import type { AcessoDaSalaAchado, ResolucaoDeTenantRepository } from './resolucao-de-tenant.repository.js'

/**
 * Como a página pública chegou: o slug do endereço e o SHA-256 do token do link, ou o HMAC do código digitado. Quem
 * chama calcula o hash e o HMAC (o `sala` tem a chave do código); nada aqui recebe escola, ano ou turma.
 */
export type EntradaDaSala = { readonly slug: string; readonly tokenHash: string } | { readonly slug: string; readonly codigoHmac: string }

/**
 * O limite de código errado por escola (A1, tarefa 7.0; Tech Spec da A1, seção 7c), que o `sala` implementa e o
 * `AcessoDaSala` chama só no caminho do código, com a escola do slug. O token do link tem 256 bits e não se adivinha.
 */
export interface GuardaDoCodigo {
  /**
   * Antes da busca do acesso pelo código, fora de transação e sem conexão do pool: acima do teto da escola, espera. Nunca
   * recusa, para o código certo continuar entrando.
   */
  antesDaBusca(escolaId: string): Promise<void>
  /** O código não achou acesso vigente na escola do slug: conta no teto dela. */
  codigoErrado(escolaId: string): Promise<void>
}

/**
 * A porta do `sala` para a resolução de tenant (A1, tarefa 5.0; Tech Spec da A1, seção 6): a rota pública da sala não
 * tem sessão, e a escola, o ano e a turma saem do acesso vigente achado pelo link ou pelo código, na escola do slug e no
 * ano em curso dela, pela `ResolucaoDeTenantRepository`, que só o `sessao` alcança (I1). O `sala` importa só isto.
 *
 * Acesso inexistente, vencido, revogado, de ano encerrado, de turma excluída, de outra escola ou slug inexistente dão o
 * mesmo `NAO_ENCONTRADO` (regra 10, item 6).
 *
 * **Pelo código** (7.0): a escola do slug é lida antes, numa consulta própria que devolve a conexão ao pool; a `guarda`
 * roda entre ela e a busca do acesso (a espera acima do teto) e depois da busca que não achou nada (a contagem). O slug
 * inexistente responde `NAO_ENCONTRADO` sem guarda: não há escola onde contar, e o slug é público (`/acesso`).
 */
export class AcessoDaSala {
  constructor(private readonly resolucao: ResolucaoDeTenantRepository) {}

  /**
   * Resolve a sala e roda `funcao` no contexto da escola e do ano dela, sem usuário: os repositories do `sala` leem o
   * escopo dali (regra 10, item 3), e a requisição continua com o mesmo `requisicaoId`.
   */
  async naSala<T>(entrada: EntradaDaSala, funcao: (sala: AcessoDaSalaAchado) => Promise<T>, guarda: GuardaDoCodigo): Promise<T> {
    const sala = 'tokenHash' in entrada ? await this.resolucao.acessoDaSalaPorToken(entrada.slug, entrada.tokenHash) : await this.#peloCodigo(entrada, guarda)
    if (sala === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    return naEscolaSemUsuario({ escolaId: sala.escolaId, anoLetivoId: sala.anoLetivoId }, () => funcao(sala))
  }

  async #peloCodigo(entrada: { readonly slug: string; readonly codigoHmac: string }, guarda: GuardaDoCodigo): Promise<AcessoDaSalaAchado | undefined> {
    const escolaId = await this.resolucao.escolaPorSlug(entrada.slug)
    if (escolaId === undefined) return undefined
    await guarda.antesDaBusca(escolaId)
    const sala = await this.resolucao.acessoDaSalaPorCodigo(entrada.slug, entrada.codigoHmac)
    if (sala === undefined) await guarda.codigoErrado(escolaId)
    return sala
  }
}
