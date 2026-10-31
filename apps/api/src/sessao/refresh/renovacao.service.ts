import {
  currentContext,
  DomainException,
  runInContext,
  METRICS,
  AuditoriaRecorder,
  sessaoAindaVale,
  type Environment,
  type Database,
  type TokenIssuer,
  type Meter,
} from '@educa/core'
import { ErrorCode, InvariantException, JANELA_DE_RENOVACAO_SIMULTANEA_MS, type RenovacaoResponse } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { COOKIE_SESSAO, lerCookie, serializarCookie } from '../../credencial/cookies.js'
import { BYTES_DO_REFRESH, hashDoRefresh } from '../../credencial/login-identifiers.js'
import { ipParaRegistro, type OrigemDaRequisicao } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import { ResolucaoDeTenantRepository, type SessaoParaRenovar } from '../tenant/tenant-resolution.repository.js'
import { EscritaDeSessaoRepository } from '../../credencial/sessao-write.repository.js'

/**
 * Até quantos segundos depois da rotação o cookie anterior, com o token novo já usado, é outra aba que renovou junto
 * (409 `JA_RENOVADO`). Depois disso é reuso (Tech Spec, seção 5, "Renovar").
 */
export const JANELA_DE_JA_RENOVADO_SEGUNDOS = 30

/**
 * Até quantos milissegundos depois da rotação o cookie anterior, com o token novo ainda não usado, é uma renovação
 * simultânea à que acabou de rotacionar (duas abas, duas requisições no mesmo instante), e não uma resposta perdida:
 * a segunda esperou o `FOR UPDATE` da primeira e recebe 409, e a família continua viva. Uma resposta perdida só volta
 * depois de o cliente notar a falha, e aí rotaciona de novo.
 *
 * Mora no contrato (`packages/shared`) desde a 18.0: a web espera mais que esta janela antes de repetir a renovação
 * depois de um 409, e dois valores diferentes deslogariam a pessoa.
 */
export { JANELA_DE_RENOVACAO_SIMULTANEA_MS }

/** O que a renovação decidiu, rótulo de `sessao.renovacao`. */
export const RESULTADOS_DA_RENOVACAO = ['ok', 'ja_renovado', 'resposta_perdida', 'reuso', 'recusada'] as const
export type ResultadoDaRenovacao = (typeof RESULTADOS_DA_RENOVACAO)[number]

/** O refresh do cookie: 32 bytes em base64url, sem preenchimento. Qualquer outra coisa nem chega ao banco. */
const FORMATO_DO_REFRESH = /^[A-Za-z0-9_-]{43}$/

export interface ResultadoDaRenovacaoHttp {
  readonly resposta: RenovacaoResponse
  readonly cookies: readonly string[]
}

/** O erro da renovação recusada, com o `Set-Cookie` que apaga o cookie que não vale mais. */
export class RenovacaoRecusada extends DomainException {
  /** `ACESSO_SUSPENSO` quando o cookie é de uma pessoa com a eliminação agendada (14.0); `NAO_AUTENTICADO` em todo o resto. */
  constructor(
    readonly cookies: readonly string[],
    codigo: ErrorCode = ErrorCode.NAO_AUTENTICADO,
  ) {
    super(codigo)
  }
}

export interface DependenciasDaRenovacao {
  readonly banco: Database
  readonly emissorDeToken: TokenIssuer
  readonly ambiente: Environment
  readonly medidor: Meter
}

type Decisao =
  | { readonly resultado: 'ok' | 'resposta_perdida'; readonly sessao: SessaoParaRenovar; readonly rotacionadoEm: Date; readonly novoRefresh: string }
  | { readonly resultado: 'ja_renovado' | 'reuso' }
  /** `suspenso`: o cookie é de quem tem a eliminação agendada (14.0), e a resposta é `ACESSO_SUSPENSO`, não a recusa de sempre. */
  | { readonly resultado: 'recusada'; readonly suspenso?: boolean }

/**
 * `POST /v1/sessao/renovar` (Tech Spec, seção 5, "Renovar"). Numa transação, trava a sessão do cookie e decide:
 *
 * - **Cookie atual**, sessão válida (não encerrada, dentro das 12 h e da inatividade com tolerância): rotaciona, guarda o
 *   anterior e devolve token e cookie novos. O token sai com `iat` depois de `rotacionado_em`, e a primeira requisição
 *   com ele marca `atual_apresentado` (na `SessaoGuard`).
 * - **Cookie anterior, token novo nunca usado**: a resposta anterior se perdeu. Rotaciona de novo, sem encerrar, e o
 *   anterior continua o mesmo. Se a rotação é de menos de 2 s, é a renovação simultânea de outra aba: 409.
 * - **Cookie anterior, token novo já usado**: até 30 s, 409 `JA_RENOVADO` (outra aba renovou). Depois, é reuso: encerra
 *   a família, grava a auditoria `sessao.reuso_de_refresh` e responde 401.
 * - Sessão que não vale, cookie desconhecido ou fora do formato: 401, e o cookie é apagado.
 * - Cookie atual de quem tem a eliminação agendada, de sessão que valeria sem a suspensão (F3, 14.0): 403 `ACESSO_SUSPENSO`, e o
 *   cookie é apagado. Qualquer outro cookie dele (vencido, encerrado por outro motivo, já rotacionado) é o 401 de sempre.
 *
 * Renovar não move `ultimo_uso_em` (não é uso) nem `expira_em`, e grava `renovacao` no registro de acesso.
 */
export class RenovacaoService {
  readonly #renovacoes: ReturnType<Meter['createCounter']>
  readonly #auditoria = new AuditoriaRecorder()

  constructor(private readonly dependencias: DependenciasDaRenovacao) {
    this.#renovacoes = dependencias.medidor.createCounter(METRICS.renovacaoDeSessao, { description: 'Renovações de sessão pelo cookie, por resultado' })
    // Cada resultado nasce em 0: o alerta de reuso compara o máximo e o mínimo da janela, e a série que só aparece no
    // primeiro reuso esconderia os primeiros.
    for (const resultado of RESULTADOS_DA_RENOVACAO) this.#renovacoes.add(0, { resultado })
  }

  async renovar(origem: OrigemDaRequisicao): Promise<ResultadoDaRenovacaoHttp> {
    const refresh = lerCookie(origem.cabecalhoCookie, COOKIE_SESSAO)
    const decisao = refresh !== undefined && FORMATO_DO_REFRESH.test(refresh) ? await this.#decidir(hashDoRefresh(refresh), origem.ip) : { resultado: 'recusada' as const }
    this.#renovacoes.add(1, { resultado: decisao.resultado })
    switch (decisao.resultado) {
      case 'ja_renovado':
        throw new DomainException(ErrorCode.JA_RENOVADO)
      case 'reuso':
      case 'recusada':
        throw new RenovacaoRecusada(
          [serializarCookie(COOKIE_SESSAO, '', { ambiente: this.dependencias.ambiente, maxAgeSegundos: 0 })],
          decisao.resultado === 'recusada' && decisao.suspenso === true ? ErrorCode.ACESSO_SUSPENSO : undefined,
        )
      default:
        return this.#emitir(decisao)
    }
  }

  async #decidir(refreshHash: string, ip: string): Promise<Decisao> {
    const novoRefresh = randomBytes(BYTES_DO_REFRESH).toString('base64url')
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    return this.dependencias.banco.transaction(async (tx): Promise<Decisao> => {
      const achada = await new ResolucaoDeTenantRepository(tx).sessaoParaRenovar(refreshHash)
      if (achada === undefined) return { resultado: 'recusada' }
      // O cookie é a credencial da renovação, e só vale como tal o que valeria sem a suspensão: o cookie atual, de sessão
      // aberta (ou encerrada pelo próprio registro da eliminação), dentro das 12 h e da inatividade. O cookie vencido, o
      // encerrado por outro motivo e o já rotacionado respondem 401, como o desconhecido: o Chromebook do carrinho não
      // conta a suspensão de quem o usou antes (14.0).
      if (achada.eliminacaoAgendadaEm !== null) {
        const valeriaSemASuspensao =
          achada.pelo === 'atual' &&
          (achada.encerradaEm === null || achada.motivo === 'eliminacao_agendada') &&
          sessaoAindaVale({ ...achada, encerradaEm: null, eliminacaoAgendadaEm: null })
        return valeriaSemASuspensao ? { resultado: 'recusada', suspenso: true } : { resultado: 'recusada' }
      }
      if (!sessaoAindaVale(achada)) return { resultado: 'recusada' }
      // Daqui em diante, a escola e o usuário da sessão travada são o contexto: toda escrita é na escola dela.
      return runInContext({ requisicaoId, escolaId: achada.escolaId, usuarioId: achada.usuarioId }, async () => {
        const sessoes = new EscritaDeSessaoRepository(tx)
        const resultado = resultadoPeloCookie(achada)
        if (resultado === 'ja_renovado') return { resultado }
        if (resultado === 'reuso') {
          const sessoesEncerradas = await sessoes.encerrarFamilia(achada.familia, 'reuso_de_refresh')
          await this.#auditoria.gravar(tx, 'sessao.reuso_de_refresh', { entidadeId: achada.id, depois: { familia: achada.familia, sessoesEncerradas } })
          return { resultado }
        }
        const rotacionadoEm = await sessoes.rotacionar(achada.id, hashDoRefresh(novoRefresh), resultado === 'ok')
        if (rotacionadoEm === undefined) throw new InvariantException('sessão travada não rotacionou')
        await new RegistroDeAcessoRepository(tx).gravar('renovacao', achada.usuarioId, ipParaRegistro(ip))
        return { resultado, sessao: achada, rotacionadoEm, novoRefresh }
      })
    })
  }

  async #emitir(decisao: Extract<Decisao, { resultado: 'ok' | 'resposta_perdida' }>): Promise<ResultadoDaRenovacaoHttp> {
    const { sessao, rotacionadoEm, novoRefresh } = decisao
    // O `iat` do token novo não pode ser anterior a `rotacionado_em`: é por ele que a guarda reconhece o token desta
    // rotação. O `iat` é em segundos, então o token sai no segundo seguinte ao da rotação, se ainda estiver nele.
    const primeiroSegundoDepois = (Math.floor(rotacionadoEm.getTime() / 1_000) + 1) * 1_000
    const { token, expiraEm } = await this.dependencias.emissorDeToken.emitir(
      { escolaId: sessao.escolaId, usuarioId: sessao.usuarioId, sessaoId: sessao.id },
      new Date(Math.max(Date.now(), primeiroSegundoDepois)),
    )
    return {
      resposta: { token, expiraEm: expiraEm.toISOString() },
      cookies: [serializarCookie(COOKIE_SESSAO, novoRefresh, { ambiente: this.dependencias.ambiente })],
    }
  }
}

/**
 * O que fazer com uma sessão válida, pelo cookie que chegou (a regra da Tech Spec, seção 5, "Renovar"). A hora é a do
 * banco, lida junto com a sessão travada.
 */
export function resultadoPeloCookie(sessao: Pick<SessaoParaRenovar, 'pelo' | 'atualApresentado' | 'rotacionadoEm' | 'agora'>): 'ok' | 'resposta_perdida' | 'ja_renovado' | 'reuso' {
  if (sessao.pelo === 'atual') return 'ok'
  // Pelo anterior, sempre houve rotação; sem a data, trata como a mais recente possível.
  const desdeARotacaoMs = sessao.agora.getTime() - (sessao.rotacionadoEm ?? sessao.agora).getTime()
  if (!sessao.atualApresentado) return desdeARotacaoMs < JANELA_DE_RENOVACAO_SIMULTANEA_MS ? 'ja_renovado' : 'resposta_perdida'
  return desdeARotacaoMs <= JANELA_DE_JA_RENOVADO_SEGUNDOS * 1_000 ? 'ja_renovado' : 'reuso'
}
