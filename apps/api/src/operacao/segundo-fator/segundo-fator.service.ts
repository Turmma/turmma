import { contextoAtual, ErroDeDominio, executarNoContexto, relogioDoSistema, type Ambiente, type Banco, type EmissorDeTokenDeOperador, type Relogio } from '@educa/nucleo'
import {
  ErrorCode,
  type ConfigurarSegundoFatorDeOperadorRequest,
  type SegundoFatorDeOperadorRequest,
  type ConfigurarSegundoFatorDeOperadorResponse,
  type SegundoFatorDeOperadorResponse,
} from '@educa/shared'
import { Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { BYTES_DO_REFRESH, type CifraDoSegredo, type ContadorDeTentativas, type CookieDeDispositivo, gerarCodigosDeRecuperacao, gerarSegredo, hashDoRefresh, hmacDaRecuperacao, ipParaRegistro, lerCookie, normalizarEmail, normalizarRecuperacao, passoDoCodigo, ROTULO_TOTP_DA_OPERACAO, SegredoNaoDecifra } from '../../credencial/index.js'
import { cookiesDaSessaoDeOperador } from '../cookie-de-operador.js'
import { verificarDesafioDeOperador, type ConsumoDeDesafioDeOperador, type DesafioDeOperadorVerificado, type EmissorDeDesafioDeOperador } from '../desafio-de-operador.js'
import { COOKIE_DISPOSITIVO_DE_OPERADOR } from '../dispositivo-de-operador.js'
import { PREFIXO_DO_CONTADOR_DA_OPERACAO } from '../entrada/entrada.service.js'
import type { FalhasDeEntradaDaOperacao } from '../falhas-de-entrada.js'
import { OperadorRepository, type OperadorParaSegundoFator } from '../operador/operador.repository.js'

export interface DependenciasDoSegundoFator {
  readonly banco: Banco
  /** A cifra do segredo do F1, com as mesmas chaves; o dado autenticado (AAD) é o `operador.id`. */
  readonly cifra: Pick<CifraDoSegredo, 'cifrar' | 'decifrar'>
  /** A chave do HMAC dos códigos de recuperação (`IDENTIDADE_CHAVE_RECUPERACAO`), a do F1. */
  readonly chaveRecuperacao: Uint8Array
  /** Chave de assinatura do desafio, a mesma do token de acesso. */
  readonly chaveAssinatura: Uint8Array
  readonly consumo: Pick<ConsumoDeDesafioDeOperador, 'consumir'>
  /** O contador do F1, com o prefixo `login-op` e a chave pelo `operador.id` (C34). */
  readonly contador: Pick<ContadorDeTentativas, 'chaveDe' | 'reservar' | 'zerar'>
  /** O cookie de dispositivo do operador, com a chave própria (`dispositivo-de-operador.ts`). */
  readonly dispositivo: Pick<CookieDeDispositivo, 'conhece' | 'comEntrada'>
  readonly emissorDeDesafio: Pick<EmissorDeDesafioDeOperador, 'emitir'>
  readonly emissorDeToken: Pick<EmissorDeTokenDeOperador, 'emitir'>
  readonly ambiente: Ambiente
  /** A série `operacao.entrada_falha`, a mesma da entrada por e-mail. */
  readonly falhas: Pick<FalhasDeEntradaDaOperacao, 'somar'>
  readonly relogio?: Relogio
}

/**
 * O que o controller tira da requisição: o cabeçalho `Cookie`, para a origem do contador e o cookie de dispositivo, e o
 * IP, para o registro da entrada e da falha em `acesso_operacao`.
 */
export interface OrigemDoSegundoFator {
  readonly cabecalhoCookie: string | undefined
  readonly ip: string
}

/** A sessão aberta: o corpo da resposta e os dois `Set-Cookie`. */
export interface SessaoDeOperadorAberta {
  readonly resposta: SegundoFatorDeOperadorResponse
  readonly cookies: readonly string[]
}

/** Desafio inválido, usado, de outra etapa, de operador desativado ou sem segundo fator para conferir: uma resposta só. */
const desafioInvalido = () => new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)

/** O que a transação do `/sessao/mfa` decidiu. Só `aberta` gravou alguma coisa. */
type Desfecho =
  | { readonly tipo: 'desafio_invalido' }
  | { readonly tipo: 'configure_de_novo' }
  | { readonly tipo: 'segurada'; readonly esperaMs: number }
  | { readonly tipo: 'codigo_recusado'; readonly esperaMs: number }
  | { readonly tipo: 'aberta'; readonly sessaoId: string; readonly email: string; readonly chave: string }

/**
 * O segundo fator do operador Turmma (Tech Spec da A0, seções 4 e 5): configurar o app autenticador e entrar com o
 * código dele ou com um código de recuperação. O desafio vem **no corpo** e passa por três conferências, nesta ordem,
 * antes de qualquer outra coisa: assinatura, prazo e `typ` (`verificarDesafioDeOperador`), a etapa da rota, e o uso
 * único do `jti` (`SET NX`, fora da transação; com o Redis fora, 503). Toda recusa do desafio é `NAO_AUTENTICADO`.
 *
 * - **Configurar** (`configurar_mfa`): numa transação, a trava "configurar" grava o segredo novo e sobe o `mfa_versao`
 *   (só com o segundo fator inativo e o operador ativo), e troca os códigos de recuperação pelos novos. Devolve o
 *   segredo, os códigos e o desafio `mfa` com a versão. Nada fica ativo ainda.
 * - **Entrar** (`mfa`), numa transação só, a partir do `for update` da linha do operador ativo (e, antes do desafio, o
 *   contexto da requisição: sem ele, falha de montagem, `ERRO_INTERNO` sem gastar nada):
 *   1. o desafio que leva versão exige a mesma `mfa_versao` da linha: diferente, outra aba configurou depois, e a
 *      resposta é 409 `CONFLITO` ("configure de novo"), **sem conferir o código nem contar tentativa**; o desafio sem
 *      versão (da entrada por e-mail) exige o segundo fator ativo;
 *   2. a tentativa é reservada no contador `login-op:{HMAC(operador.id)}:{conhecido|outro}` (C34), por conta e nunca
 *      por IP; segurada, 429 `CONTA_SEGURADA` sem conferir o código;
 *   3. o código é gasto no banco: o do app pelo passo (`mfa_ultimo_passo`), o de recuperação por `delete … returning`,
 *      e este só depois da ativação;
 *   4. o primeiro código válido ativa o segredo da versão conferida, com a auditoria `operador.mfa_configurado` (o
 *      autor é o próprio operador, o da sessão que se abre), e a sessão de 8 h é inserida, com a `entrada` em
 *      `acesso_operacao` (operador, IP e data).
 *   O código que não confere grava `entrada_falha` em `acesso_operacao`, com IP e sem operador, como a senha errada da
 *   entrada por e-mail; ele e a conta segurada somam em `operacao.entrada_falha`.
 *   O `desativar` começa pelo mesmo `for update`: ou esta transação não acha o operador, ou ele espera por ela e encerra
 *   a sessão que ela abriu.
 * - **Fim:** zera o contador, emite o acesso de 10 min (`operador+jwt`, sem `esc`) e grava os cookies
 *   `turmma_operacao` e `turmma_operacao_dispositivo`, em `/v1/operacao/sessao`. A sessão já foi gravada: o contador que
 *   o Redis não zerou (fora, ou recusando) não vira erro para quem entrou, e a resposta segue. Vira a linha
 *   `operacao.contador_nao_zerado`, com o `requisicaoId` e o `operadorId`, e nada da pessoa (tarefa 9.0 da A0b); o
 *   contador vence sozinho em 15 min.
 */
export class SegundoFatorDoOperadorService {
  readonly #logger = new Logger('operacao')
  readonly #relogio: Relogio

  constructor(private readonly dependencias: DependenciasDoSegundoFator) {
    this.#relogio = dependencias.relogio ?? relogioDoSistema
  }

  async configurar(pedido: ConfigurarSegundoFatorDeOperadorRequest): Promise<ConfigurarSegundoFatorDeOperadorResponse> {
    const { banco, cifra, chaveRecuperacao, emissorDeDesafio } = this.dependencias
    const verificado = await this.#desafioConsumido(pedido.desafio, 'configurar_mfa')
    const novo = gerarSegredo(ROTULO_TOTP_DA_OPERACAO)
    const { cifrado, versao: chaveVersao } = cifra.cifrar(novo.bytes, verificado.operadorId)
    const codigosRecuperacao = gerarCodigosDeRecuperacao()
    const hmacs = codigosRecuperacao.map((codigo) => hmacDaRecuperacao(chaveRecuperacao, codigo))
    const versao = await banco.transaction(async (tx) => {
      const repositorio = new OperadorRepository(tx)
      const gravada = await repositorio.gravarSegredoParaConfigurar({ operadorId: verificado.operadorId, segredoCifrado: cifrado, chaveVersao })
      if (gravada !== undefined) await repositorio.trocarCodigosDeRecuperacao(verificado.operadorId, hmacs)
      return gravada
    })
    // Segundo fator já ativo, ou operador desativado: nada gravado, e a mesma resposta do desafio inválido (C16, C6b).
    if (versao === undefined) throw desafioInvalido()
    const desafio = await emissorDeDesafio.emitir({ operadorId: verificado.operadorId, etapa: 'mfa', versao })
    return { uri: novo.uri, segredo: novo.base32, codigosRecuperacao, etapa: 'mfa', desafio }
  }

  async entrar(pedido: SegundoFatorDeOperadorRequest, origem: OrigemDoSegundoFator): Promise<SessaoDeOperadorAberta> {
    const { banco, contador, emissorDeToken, dispositivo, ambiente } = this.dependencias
    // O middleware abre o contexto em toda requisição HTTP. Sem ele é falha de montagem: recusa antes de gastar o desafio
    // ou gravar qualquer coisa, em vez de inventar um `requisicaoId` para a linha de log do fim.
    const requisicao = contextoAtual()
    if (requisicao === undefined) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
    const verificado = await this.#desafioConsumido(pedido.desafio, 'mfa')
    const refresh = randomBytes(BYTES_DO_REFRESH).toString('base64url')
    const cookieDeDispositivo = lerCookie(origem.cabecalhoCookie, COOKIE_DISPOSITIVO_DE_OPERADOR)

    const desfecho = await banco.transaction(async (tx): Promise<Desfecho> => {
      const repositorio = new OperadorRepository(tx)
      const linha = await repositorio.ativoParaSegundoFator(verificado.operadorId)
      if (linha === undefined) return { tipo: 'desafio_invalido' }
      if (verificado.versao !== undefined && verificado.versao !== linha.mfaVersao) return { tipo: 'configure_de_novo' }
      if (verificado.versao === undefined && !linha.mfaAtivo) return { tipo: 'desafio_invalido' }
      const segredo = this.#segredo(linha)
      if (segredo === undefined) return { tipo: 'desafio_invalido' }

      const email = normalizarEmail(linha.email)
      const chave = contador.chaveDe(linha.id, dispositivo.conhece(cookieDeDispositivo, email) ? 'conhecido' : 'outro', PREFIXO_DO_CONTADOR_DA_OPERACAO)
      const reserva = await contador.reservar(chave)
      if (!reserva.liberada) return { tipo: 'segurada', esperaMs: reserva.esperaMs }

      if (!(await this.#codigoConfere(repositorio, linha, segredo, pedido))) {
        // Só depois de conferir o código, como a senha errada: o desafio (que só a senha dá) freia o ritmo das gravações.
        await repositorio.registrarFalhaDeEntrada(ipParaRegistro(origem.ip))
        return { tipo: 'codigo_recusado', esperaMs: reserva.esperaSeFalharMs }
      }
      if (!linha.mfaAtivo) {
        // A linha está travada desde o `for update`, com a versão conferida acima: a ativação não tem como não casar.
        if (!(await repositorio.ativarSegundoFator(linha.id, linha.mfaVersao))) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
        await repositorio.auditar({ autor: linha.apelido, acao: 'operador.mfa_configurado', operadorAlvoId: linha.id })
      }
      const sessaoId = await repositorio.abrirSessao(linha.id, hashDoRefresh(refresh))
      await repositorio.registrarAcesso('entrada', linha.id, ipParaRegistro(origem.ip))
      return { tipo: 'aberta', sessaoId, email, chave }
    })

    switch (desfecho.tipo) {
      case 'desafio_invalido':
        throw desafioInvalido()
      case 'configure_de_novo':
        throw new ErroDeDominio(ErrorCode.CONFLITO)
      case 'segurada':
        this.dependencias.falhas.somar()
        throw contaSegurada(desfecho.esperaMs)
      case 'codigo_recusado':
        this.dependencias.falhas.somar()
        throw desfecho.esperaMs > 0 ? contaSegurada(desfecho.esperaMs) : new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
      case 'aberta': {
        if (!(await contador.zerar(desfecho.chave))) {
          const operadorId = verificado.operadorId
          executarNoContexto({ ...requisicao, operadorId }, () => this.#logger.warn('operacao.contador_nao_zerado'))
        }
        const { token, expiraEm } = await emissorDeToken.emitir({ operadorId: verificado.operadorId, sessaoId: desfecho.sessaoId })
        return {
          resposta: { token, expiraEm: expiraEm.toISOString() },
          cookies: cookiesDaSessaoDeOperador({ refresh, email: desfecho.email, cabecalhoCookie: origem.cabecalhoCookie, dispositivo, ambiente }),
        }
      }
    }
  }

  /** O código do app (passo novo, gasto no banco) ou o de recuperação (gasto no banco, e só com o segundo fator ativo). */
  async #codigoConfere(repositorio: OperadorRepository, linha: OperadorParaSegundoFator, segredo: Uint8Array, pedido: SegundoFatorDeOperadorRequest): Promise<boolean> {
    if ('codigo' in pedido) {
      const passo = passoDoCodigo(segredo, pedido.codigo, this.#relogio.agora())
      return passo !== undefined && (await repositorio.avancarPassoDoSegundoFator(linha.id, passo))
    }
    // Antes da ativação, o código de recuperação não vale (C20): quem ainda não provou ter o app não o pula.
    if (!linha.mfaAtivo) return false
    const codigo = normalizarRecuperacao(pedido.recuperacao)
    return codigo !== undefined && (await repositorio.usarCodigoDeRecuperacao(linha.id, hmacDaRecuperacao(this.dependencias.chaveRecuperacao, codigo)))
  }

  /** O segredo decifrado com o `operador.id` como AAD; sem segredo, ou com um que não decifra, `undefined`. */
  #segredo(linha: OperadorParaSegundoFator): Uint8Array | undefined {
    if (linha.segredoCifrado === null || linha.chaveVersao === null) return undefined
    try {
      return this.dependencias.cifra.decifrar({ cifrado: linha.segredoCifrado, versao: linha.chaveVersao }, linha.id)
    } catch (erro) {
      if (erro instanceof SegredoNaoDecifra) return undefined
      throw erro
    }
  }

  /** O desafio da etapa, conferido e consumido: o `jti` vale uma vez, e com o Redis fora a resposta é 503. */
  async #desafioConsumido(desafio: string, etapa: DesafioDeOperadorVerificado['etapa']): Promise<DesafioDeOperadorVerificado> {
    const verificado = await verificarDesafioDeOperador(desafio, this.dependencias.chaveAssinatura, etapa)
    await this.dependencias.consumo.consumir(verificado)
    return verificado
  }
}

function contaSegurada(esperaMs: number): ErroDeDominio {
  return new ErroDeDominio(ErrorCode.CONTA_SEGURADA, undefined, Math.max(1, Math.ceil(esperaMs / 1_000)))
}
