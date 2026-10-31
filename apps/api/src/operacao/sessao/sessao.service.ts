import { DomainException, DEFAULT_RETRY_AFTER_SECONDS, throttledWarn, type Environment, type Database, type OperadorTokenIssuer } from '@educa/core'
import { ErrorCode, type RenovacaoDeOperadorResponse } from '@educa/shared'
import { Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { BYTES_DO_REFRESH, hashDoRefresh, ipParaRegistro, lerCookie, serializarCookie } from '../../credencial/index.js'
import { CAMINHO_DOS_COOKIES_DE_OPERADOR, COOKIE_SESSAO_DE_OPERADOR, cookieDeSessaoDeOperador } from '../cookie-de-operador.js'
import { OperadorRepository } from '../operador/operador.repository.js'
import { JANELA_DO_REFRESH_ANTERIOR_SEGUNDOS, sessaoDeOperadorVale } from './sessao-timeouts.js'

export interface DependenciasDaSessaoDoOperador {
  readonly banco: Database
  readonly emissorDeToken: Pick<OperadorTokenIssuer, 'emitir'>
  readonly ambiente: Environment
}

/** O que o controller tira da requisição: o cabeçalho `Cookie` e, para o registro da saída, o IP. */
export interface OrigemDaSessaoDoOperador {
  readonly cabecalhoCookie: string | undefined
  readonly ip: string
}

/** A renovação aceita: o corpo e, quando rotacionou, o `Set-Cookie` com o refresh novo. */
export interface RenovacaoDeOperador {
  readonly resposta: RenovacaoDeOperadorResponse
  readonly cookies: readonly string[]
}

/** A renovação recusada: 401 `SESSAO_ENCERRADA`, com o `Set-Cookie` que apaga o cookie que não vale mais. */
export class RenovacaoDeOperadorRecusada extends DomainException {
  constructor(readonly cookies: readonly string[]) {
    super(ErrorCode.SESSAO_ENCERRADA)
  }
}

/** O refresh do cookie: 32 bytes em base64url, sem preenchimento. Qualquer outra coisa nem chega ao banco. */
const FORMATO_DO_REFRESH = /^[A-Za-z0-9_-]{43}$/

type Decisao =
  | { readonly tipo: 'rotacionada'; readonly operadorId: string; readonly sessaoId: string }
  | { readonly tipo: 'pelo_anterior'; readonly operadorId: string; readonly sessaoId: string }
  | { readonly tipo: 'reuso' }
  | { readonly tipo: 'recusada' }

/**
 * `POST /v1/operacao/sessao/renovar` e `POST /v1/operacao/sessao/sair` (Tech Spec da A0, seções 4 e 5). As duas rotas
 * são de entrada, sem token de acesso: a credencial é o cookie `turmma_operacao`, cujo SHA-256 é o `refresh_hash`.
 *
 * **Renovar** confere as quatro condições da guarda (`sessaoDeOperadorVale`: 30 min parada, 8 h, encerrada, operador
 * desativado) e decide pelo cookie:
 * - **refresh atual**: rotaciona com a trava `where refresh_hash = $atual` (`rotacionarSessao`), devolve o acesso de
 *   10 min e o cookie novo. Quem perde a corrida (outra aba mandou o mesmo cookie) relê a sessão e cai no caso seguinte;
 * - **refresh anterior, até 30 s depois da rotação**: é a outra aba; vale, e devolve o acesso **sem** cookie (o
 *   navegador já tem o novo, e reescrevê-lo com o anterior quebraria a aba que rotacionou);
 * - **refresh anterior depois dos 30 s**: reuso. Encerra a sessão com motivo `reuso_de_refresh`;
 * - qualquer outro caso (sem cookie, fora do formato, desconhecido, sessão que não vale): 401 `SESSAO_ENCERRADA`, e o
 *   cookie é apagado. Nada disso diz se a sessão existiu.
 * Renovar não é uso: não move `ultimo_uso_em` nem `expira_em`. A aba esquecida aberta renovando sozinha não segura a
 * sessão além dos 30 min.
 *
 * **Sair** encerra a sessão aberta do cookie (atual ou anterior) com motivo `saida` e grava a `saida` em
 * `acesso_operacao` com o IP, numa transação, e apaga o cookie. Sem cookie, ou com um que não abre nada, responde igual:
 * sair nunca é mais difícil que entrar (D59).
 *
 * **Banco fora**, nas duas: 503 `INDISPONIVEL_TENTE_DE_NOVO`, nunca 401 (C31). A queda do banco não desloga ninguém.
 */
export class SessaoDoOperadorService {
  readonly #logger = new Logger('operacao')
  readonly #avisarIndisponivel = throttledWarn(() => this.#logger.warn('operacao.sessao_indisponivel'))

  constructor(private readonly dependencias: DependenciasDaSessaoDoOperador) {}

  async renovar(origem: Pick<OrigemDaSessaoDoOperador, 'cabecalhoCookie'>): Promise<RenovacaoDeOperador> {
    const refresh = lerCookie(origem.cabecalhoCookie, COOKIE_SESSAO_DE_OPERADOR)
    if (refresh === undefined || !FORMATO_DO_REFRESH.test(refresh)) throw this.#recusada()
    const novoRefresh = randomBytes(BYTES_DO_REFRESH).toString('base64url')
    const decisao = await this.#noBanco(() => this.#decidir(hashDoRefresh(refresh), hashDoRefresh(novoRefresh)))
    switch (decisao.tipo) {
      case 'reuso':
        // Só o evento: nada da sessão nem do operador no log (regra 20, item 9).
        this.#logger.warn('operacao.reuso_de_refresh')
        throw this.#recusada()
      case 'recusada':
        throw this.#recusada()
      case 'pelo_anterior':
        return { resposta: await this.#acesso(decisao), cookies: [] }
      case 'rotacionada':
        return { resposta: await this.#acesso(decisao), cookies: [cookieDeSessaoDeOperador(novoRefresh, this.dependencias.ambiente)] }
    }
  }

  async sair(origem: OrigemDaSessaoDoOperador): Promise<readonly string[]> {
    const refresh = lerCookie(origem.cabecalhoCookie, COOKIE_SESSAO_DE_OPERADOR)
    if (refresh !== undefined && FORMATO_DO_REFRESH.test(refresh)) {
      await this.#noBanco(() =>
        this.dependencias.banco.transaction(async (tx) => {
          const repositorio = new OperadorRepository(tx)
          const operadorId = await repositorio.encerrarSessaoPelaSaida(hashDoRefresh(refresh))
          if (operadorId !== undefined) await repositorio.registrarAcesso('saida', operadorId, ipParaRegistro(origem.ip))
        }),
      )
    }
    return [this.#cookieApagado()]
  }

  async #decidir(refreshHash: string, refreshHashNovo: string): Promise<Decisao> {
    const repositorio = new OperadorRepository(this.dependencias.banco)
    let sessao = await repositorio.sessaoParaRenovar(refreshHash)
    if (sessao === undefined || !sessaoDeOperadorVale(sessao)) return { tipo: 'recusada' }
    if (sessao.pelo === 'atual') {
      if (await repositorio.rotacionarSessao({ sessaoId: sessao.id, refreshHashAtual: refreshHash, refreshHashNovo })) {
        return { tipo: 'rotacionada', operadorId: sessao.operadorId, sessaoId: sessao.id }
      }
      // Outra renovação com o mesmo cookie rotacionou primeiro (ou a sessão acabou de ser encerrada): relê.
      sessao = await repositorio.sessaoParaRenovar(refreshHash)
      if (sessao === undefined || !sessaoDeOperadorVale(sessao) || sessao.pelo === 'atual') return { tipo: 'recusada' }
    }
    // Pelo anterior sempre houve rotação; sem a data, trata como a mais recente possível.
    const desdeARotacaoMs = sessao.agora.getTime() - (sessao.rotacionadoEm ?? sessao.agora).getTime()
    if (desdeARotacaoMs <= JANELA_DO_REFRESH_ANTERIOR_SEGUNDOS * 1_000) return { tipo: 'pelo_anterior', operadorId: sessao.operadorId, sessaoId: sessao.id }
    await repositorio.encerrarSessao(sessao.id, 'reuso_de_refresh')
    return { tipo: 'reuso' }
  }

  async #acesso(sessao: { operadorId: string; sessaoId: string }): Promise<RenovacaoDeOperadorResponse> {
    const { token, expiraEm } = await this.dependencias.emissorDeToken.emitir(sessao)
    return { token, expiraEm: expiraEm.toISOString() }
  }

  /** O que vai ao banco; qualquer falha dele vira 503, com uma linha a cada 30 s no log e nada do erro (regra 20, item 9). */
  async #noBanco<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao()
    } catch {
      this.#avisarIndisponivel()
      throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
    }
  }

  #recusada(): RenovacaoDeOperadorRecusada {
    return new RenovacaoDeOperadorRecusada([this.#cookieApagado()])
  }

  #cookieApagado(): string {
    return serializarCookie(COOKIE_SESSAO_DE_OPERADOR, '', { ambiente: this.dependencias.ambiente, caminho: CAMINHO_DOS_COOKIES_DE_OPERADOR, maxAgeSegundos: 0 })
  }
}
