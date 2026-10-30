import { ErrorCode, InvariantException } from '@educa/shared'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { IncomingMessage } from 'node:http'
import type { ConfiguracaoIdentidade } from '../config/validar-config.js'
import type { ConfiguracaoOperacional, LimitesDeRequisicao } from '../configuracao/configuracao-operacional.js'
import { contextoAtual, executarNoContexto } from '../contexto/contexto.js'
import { ErroDeDominio } from '../erro/erro-de-dominio.js'
import { marcadorDeOperacao } from '../identidade/marcadores-de-operacao.js'
import { rotaSemSessao } from '../identidade/rota-sem-sessao.js'
import { tokenDaRequisicao } from '../identidade/token-da-requisicao.js'
import { extrairTokenBearer, verificarTokenDeOperador, type TokenDeOperadorVerificado } from '../identidade/verificar-token.js'
import { ipDoCliente, segundosParaTentarDeNovo } from './chaves.js'
import type { LimitadorDeRequisicoes } from './limitador.js'
import { METADADO_LIMITE_DA_BUSCA_DE_TITULARES } from './limite-da-busca-de-titulares.decorator.js'
import type { ProxiesConfiaveis } from './proxies-confiaveis.js'
import { METADADO_LIMITE_QUE_REBAIXA, METADADO_SEM_LIMITE } from './rota-anonima.decorator.js'

/** As requisições de login que passaram do limite por IP: marcadas pela guarda, lidas pelo controller. */
const ACIMA_DO_LIMITE_DO_IP = new WeakSet<IncomingMessage>()

/**
 * Se a requisição de login (`@LimiteQueRebaixa()`) passou do limite por IP: ela não foi recusada, e o login a manda
 * para o fim do balde dela no semáforo do hash.
 */
export function acimaDoLimiteDoIp(requisicao: IncomingMessage): boolean {
  return ACIMA_DO_LIMITE_DO_IP.has(requisicao)
}

/**
 * Guarda global de rate limit da API. Registre depois da `GuardaDeAutenticacao` e antes da `GuardaDeSessao`: a
 * rota autenticada é limitada pelo `sub` e pelo `esc` do token que a autenticação verificou, nunca por algo que o
 * cliente mande (regra 10), com os limites da configuração dessa escola. Assim a rajada acima do limite é recusada
 * antes de chegar à leitura de sessão no Postgres (regra 80, item 1). Só a rota `@RotaAnonima()` é limitada por
 * IP, e o IP do `X-Forwarded-For` só vale quando a conexão vem da borda.
 *
 * Excesso responde 429 `LIMITE_EXCEDIDO` com `Retry-After`, menos nas rotas de login por senha (`@LimiteQueRebaixa()`):
 * nelas o excesso do IP só marca a requisição, que o login rebaixa, e o balde é próprio (identidade, 15.0).
 *
 * A rota `@RotaDeOperacao()` conta no limite do operador (`rl:op:{sub}`, Tech Spec da A0, seção 5), pelo token de
 * operador que esta guarda verifica. Sem token de operador que confira, não conta nada e deixa passar: quem responde é
 * a `GuardaDeOperador`, com o 404 de uma rota inexistente, sem banco nem Redis. Contar ali daria um 429 que a rota
 * inexistente não dá, e diria que a rota existe. O token vencido conta: ele também chega ao Postgres.
 *
 * A rota `@EntradaDeOperacao()` conta por IP no balde próprio da operação (`rl:ip:op`, A0b, tarefa 9.0), nunca no
 * `rl:ip` nem no `rl:ip-login` da escola: acima dele, recusa com 429, ou só marca a requisição, se é `@LimiteQueRebaixa`.
 */
export class GuardaDeLimite implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limitador: LimitadorDeRequisicoes,
    private readonly proxies: ProxiesConfiaveis,
    private readonly limitesDaEscola: Pick<ConfiguracaoOperacional<LimitesDeRequisicao>, 'daEscola'>,
    private readonly identidade: ConfiguracaoIdentidade,
  ) {}

  async canActivate(execucao: ExecutionContext): Promise<boolean> {
    // Outro tipo de execução não passa pela autenticação HTTP; ela já o recusa.
    if (execucao.getType() !== 'http') return true
    const alvos = [execucao.getHandler(), execucao.getClass()]
    if (this.reflector.getAllAndOverride<boolean | undefined>(METADADO_SEM_LIMITE, alvos) === true) return true

    const requisicao = execucao.switchToHttp().getRequest<IncomingMessage>()
    const marcador = marcadorDeOperacao(this.reflector, execucao)
    if (marcador === 'rota') return this.#consumirDeOperador(requisicao)
    const anonima = rotaSemSessao(this.reflector, execucao)
    const rebaixa = anonima && this.reflector.getAllAndOverride<boolean | undefined>(METADADO_LIMITE_QUE_REBAIXA, alvos) === true
    if (marcador === 'entrada') {
      const daOperacao = await this.limitador.consumirDaOperacao(await this.#ipDaRequisicao(requisicao))
      if (daOperacao.aceita) return true
      if (!rebaixa) throw new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, segundosParaTentarDeNovo(daOperacao.msAteLiberar))
      ACIMA_DO_LIMITE_DO_IP.add(requisicao)
      return true
    }
    if (rebaixa) {
      const doLogin = await this.limitador.consumirDoLogin(await this.#ipDaRequisicao(requisicao))
      if (!doLogin.aceita) ACIMA_DO_LIMITE_DO_IP.add(requisicao)
      return true
    }
    const resultado = anonima
      ? await this.limitador.consumirAnonima(await this.#ipDaRequisicao(requisicao))
      : await this.#consumirAutenticada(requisicao)
    if (!resultado.aceita) {
      throw new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, segundosParaTentarDeNovo(resultado.msAteLiberar))
    }
    // A busca de titulares (`@LimiteDaBuscaDeTitulares`) conta ainda no balde próprio dela, por usuário: além do
    // balde do F0, que continua valendo, ela tem o teto de 30 por minuto (Tech Spec do F3, seção 7c).
    if (!anonima && this.reflector.getAllAndOverride<boolean | undefined>(METADADO_LIMITE_DA_BUSCA_DE_TITULARES, alvos) === true) {
      const token = tokenDaRequisicao(requisicao)
      // Sem token verificado (guarda fora de ordem), falha fechada, como no limite autenticado.
      if (token === undefined) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
      const daBusca = await this.limitador.consumirDaBuscaDeTitulares(token.usuarioId)
      if (!daBusca.aceita) {
        throw new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, segundosParaTentarDeNovo(daBusca.msAteLiberar))
      }
    }
    return true
  }

  async #consumirDeOperador(requisicao: IncomingMessage): Promise<true> {
    const token = await tokenDeOperadorOuNada(requisicao.headers.authorization, this.identidade)
    if (token === undefined) return true
    const resultado = await this.limitador.consumirDeOperador(token.operadorId)
    if (!resultado.aceita) {
      throw new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, segundosParaTentarDeNovo(resultado.msAteLiberar))
    }
    return true
  }

  /**
   * Conta no limite do `sub` e do `esc` do token verificado. Os limites da escola são lidos num contexto que só
   * leva a escola do token, do qual a configuração tira o escopo: o contexto da requisição continua sem escola até
   * a `GuardaDeSessao` conferir a sessão.
   */
  async #consumirAutenticada(requisicao: IncomingMessage) {
    const token = tokenDaRequisicao(requisicao)
    // Sem token verificado (guarda fora de ordem), falha fechada.
    if (token === undefined) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
    const requisicaoId = contextoAtual()?.requisicaoId
    if (requisicaoId === undefined) throw new InvariantException('contexto da requisição ausente')
    const identidade = { escolaId: token.escolaId, usuarioId: token.usuarioId }
    const limites = await executarNoContexto({ requisicaoId, escolaId: token.escolaId }, () => this.limitesDaEscola.daEscola())
    return this.limitador.consumirAutenticada(identidade, limites)
  }

  #ipDaRequisicao(requisicao: IncomingMessage): Promise<string> {
    return ipDaRequisicao(requisicao, this.proxies)
  }
}

/**
 * O IP do cliente: o da conexão, ou a última entrada do `X-Forwarded-For` quando a conexão vem da borda. É o mesmo
 * IP da chave de limite anônimo e o que o registro de acesso grava. Pode ser `IP_DESCONHECIDO`.
 */
export async function ipDaRequisicao(requisicao: IncomingMessage, proxies: Pick<ProxiesConfiaveis, 'ehConfiavel'>): Promise<string> {
  const enderecoDaConexao = requisicao.socket.remoteAddress
  const encaminhado = requisicao.headers['x-forwarded-for']
  // Sem cabeçalho, nem precisa perguntar se a conexão é da borda.
  const daBorda = encaminhado !== undefined && (await proxies.ehConfiavel(enderecoDaConexao))
  return ipDoCliente(enderecoDaConexao, encaminhado, daBorda)
}

/** O token de operador do `Authorization`, verificado, ou `undefined` quando não há um que confira. */
async function tokenDeOperadorOuNada(cabecalho: string | string[] | undefined, identidade: ConfiguracaoIdentidade): Promise<TokenDeOperadorVerificado | undefined> {
  try {
    return await verificarTokenDeOperador(extrairTokenBearer(cabecalho), identidade)
  } catch (erro) {
    if (erro instanceof ErroDeDominio) return undefined
    throw erro
  }
}
