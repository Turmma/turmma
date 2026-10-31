import { DomainException, METRICS, systemClock, type Database, type Meter, type Clock } from '@educa/core'
import { ErrorCode, type EtapaComDesafio, type MfaRequest, type AtivarMfaResponse, type ConfigurarMfaResponse } from '@educa/shared'
import type { SecretCipher } from '../../credencial/secret-cipher.js'
import type { ConclusaoDeLogin } from '../completion/login-completion.js'
import type { LoginLockout } from '../../credencial/login-lockout.js'
import type { AtivacaoPorConvite } from '../convite/convite.service.js'
import type { DeviceCookie } from '../../credencial/device-cookie.js'
import { DEVICE_COOKIE, lerCookie } from '../../credencial/cookies.js'
import { verifyChallenge, type ChallengeConsumer, type VerifiedChallenge } from '../../credencial/challenge.js'
import { ipParaRegistro, type RequestOrigin, type ResultadoDoLogin } from '../../credencial/request-origin.js'
import { TenantResolutionRepository, type MfaDaConta, type UsuarioAtivoDaConta } from '../tenant/tenant-resolution.repository.js'
import { gerarCodigosDeRecuperacao, gerarSegredo, hmacDaRecuperacao, normalizarRecuperacao, passoDoCodigo } from '../../credencial/totp.js'

export interface MfaDependencies {
  readonly banco: Database
  readonly resolucao: TenantResolutionRepository
  readonly contador: LoginLockout
  readonly dispositivo: DeviceCookie
  readonly cifra: SecretCipher
  readonly consumo: ChallengeConsumer
  readonly conclusao: ConclusaoDeLogin
  readonly ativacao: AtivacaoPorConvite
  /** Chave de assinatura do desafio, a mesma do token de acesso. */
  readonly chaveAssinatura: Uint8Array
  /** Chave do HMAC dos códigos de recuperação (`IDENTIDADE_CHAVE_RECUPERACAO`). */
  readonly chaveRecuperacao: Uint8Array
  readonly medidor: Meter
  readonly relogio?: Clock
}

const naoAutenticado = () => new DomainException(ErrorCode.NAO_AUTENTICADO)

/**
 * O segundo fator do coordenador (RF12; Tech Spec, seções 4 e 5): configurar e ativar o app autenticador, e entrar
 * com o código dele ou com um código de recuperação. Toda rota recebe o desafio no `Authorization`, nunca o token de
 * acesso, e toda recusa é `NAO_AUTENTICADO`, sem dizer se foi o desafio, a etapa ou o código.
 *
 * - **Configurar e ativar** só com o desafio `configurar_mfa` e o MFA inativo: quem tem só a senha de uma conta com
 *   MFA não troca o segundo fator. A ativação consome o desafio e não abre sessão: a pessoa entra de novo, agora com o
 *   código (o caminho feliz do `mfa.int.test.ts`).
 * - **Entrar** só com o desafio `mfa`. O código do app vale uma vez (`mfa_ultimo_passo`), e o de recuperação também
 *   (`usado_em`), as duas coisas decididas no banco.
 * - **Tentativas:** cada código conta no `LoginLockout`, com a chave `HMAC(conta_id)`, sem escola (a conta é
 *   global) e separada da chave do e-mail: o acerto da senha zera o contador da senha, não o do segundo fator. É o
 *   limite próprio do MFA: na quinta falha seguida, a resposta é `CONTA_SEGURADA` e o desafio é consumido, e daí nem
 *   o código certo passa com ele; a espera dobra de 30 s a 15 min, como a da senha. O sufixo `conhecido` vale para o
 *   navegador que já concluiu um login desta conta, que só ganha o `educa_dispositivo` depois do segundo fator.
 * - **Redis de fila fora:** o desafio é recusado antes de qualquer código ser conferido, e a pessoa entra de novo.
 * - **Fim:** o acerto ativa o usuário do convite que veio no desafio (7.0), sob a trava do convite da escola, e só então
 *   consome o desafio (o 503 da trava não o gasta); segue como o login da senha, para `escolher` (com o MFA cumprido)
 *   ou `pronta`, que grava a sessão e os cookies `educa_sessao` e `educa_dispositivo`. O desafio que veio da escolha ou
 *   da troca de escola (12.0) leva o destino: o acerto entra direto nele e, na troca, encerra só agora a sessão de
 *   origem, na mesma transação.
 * - **O convite que já não ativa** (Tech Spec da A0b, seção 5): o código certo com o convite do desafio revogado (antes
 *   do login, entre a senha e o código, ou por um gerar do operador que venceu a trava) entra no outro usuário ativo da
 *   conta; sem nenhum, `NAO_ENCONTRADO`, sem `login_falho` e com a reserva do contador do código desfeita. Código errado
 *   conta como sempre.
 */
export class MfaService {
  readonly #relogio: Clock
  readonly #contaSegurada: ReturnType<Meter['createCounter']>

  constructor(private readonly dependencias: MfaDependencies) {
    this.#relogio = dependencias.relogio ?? systemClock
    this.#contaSegurada = dependencias.medidor.createCounter(METRICS.contaSegurada, { description: 'Tentativas de login respondidas com CONTA_SEGURADA' })
  }

  async configurar(desafio: string): Promise<ConfigurarMfaResponse> {
    const verificado = await this.#desafioLivre(desafio, 'configurar_mfa')
    const conta = await this.dependencias.resolucao.mfaDaConta(verificado.contaId)
    if (conta === undefined) throw naoAutenticado()
    // Com o MFA já ativo, quem recusa é o banco (`where mfa_ativado_em is null`), e não uma leitura anterior: entre as
    // duas, outra aba pode ter ativado.
    const novo = gerarSegredo()
    const { cifrado, versao } = this.dependencias.cifra.cifrar(novo.bytes, conta.id)
    if (!(await this.dependencias.resolucao.gravarSegredoDeMfa(conta.id, cifrado, versao))) throw naoAutenticado()
    return { uri: novo.uri, segredo: novo.base32 }
  }

  async ativar(desafio: string, codigo: string): Promise<AtivarMfaResponse> {
    const verificado = await this.#desafioLivre(desafio, 'configurar_mfa')
    const conta = await this.dependencias.resolucao.mfaDaConta(verificado.contaId)
    if (conta === undefined || conta.segredoCifrado === null) throw naoAutenticado()
    const passo = passoDoCodigo(this.#segredo(conta), codigo, this.#relogio.agora())
    if (passo === undefined) throw naoAutenticado()
    // Consome antes de gravar: dois pedidos com o mesmo desafio não ativam duas vezes, e o segundo nunca recebe outro
    // lote de códigos. O código errado, acima, não consome. Com dois desafios (duas abas), quem decide é o `update`
    // condicional da ativação, que só passa com o MFA inativo e com o segredo que foi conferido aqui.
    await this.dependencias.consumo.consumir(verificado)
    const codigos = gerarCodigosDeRecuperacao()
    const hmacs = codigos.map((texto) => hmacDaRecuperacao(this.dependencias.chaveRecuperacao, texto))
    const segredoConferido = conta.segredoCifrado
    const ativou = await this.dependencias.banco.transaction((tx) => new TenantResolutionRepository(tx).ativarMfa(conta.id, segredoConferido, passo, hmacs))
    if (!ativou) throw naoAutenticado()
    return { codigosRecuperacao: codigos }
  }

  async entrar(desafio: string, pedido: MfaRequest, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    const { resolucao, contador, dispositivo } = this.dependencias
    const verificado = await this.#desafioLivre(desafio, 'mfa')
    const conta = await resolucao.mfaDaConta(verificado.contaId)
    if (conta === undefined || conta.ativadoEm === null) throw naoAutenticado()

    const conhecido = dispositivo.conhece(lerCookie(origem.cabecalhoCookie, DEVICE_COOKIE), conta.email)
    const chave = contador.chaveDe(conta.id, conhecido ? 'conhecido' : 'outro')
    const reserva = await contador.reservar(chave)
    if (!reserva.liberada) throw this.#segurada(reserva.esperaMs)

    if (!(await this.#fatorConfere(conta, pedido))) {
      await resolucao.gravarFalhaDeLoginPorEmail(ipParaRegistro(origem.ip))
      if (reserva.esperaSeFalharMs > 0) {
        // O quinto erro seguido gasta o desafio: daí em diante, nem o código certo passa com ele.
        await this.dependencias.consumo.consumir(verificado).catch(() => undefined)
        throw this.#segurada(reserva.esperaSeFalharMs)
      }
      throw naoAutenticado()
    }

    // Daqui em diante o código está certo: o que falhar no caminho (a trava da escola além do prazo, o banco fora) não é
    // código errado, e a reserva é desfeita antes de o erro subir.
    const usuarios = await this.#depoisDoCodigoCerto(conta.id, verificado).catch(async (erro: unknown) => {
      await contador.desfazer(chave, reserva)
      throw erro
    })
    if (usuarios.length === 0 && verificado.conviteId !== undefined) {
      // O convite do bilhete já não ativa (revogado antes, ou por um gerar do operador que venceu a trava), e a conta não
      // tem outro usuário ativo: a resposta de convite inválido, sem `login_falho`, e o contador do código volta ao que
      // era antes (Tech Spec da A0b, seção 5).
      await contador.desfazer(chave, reserva)
      throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    await contador.zerar(chave)
    if (usuarios.length === 0) throw naoAutenticado()
    if (verificado.destinoUsuarioId !== undefined) {
      // O segundo fator pedido na escolha ou na troca de escola (12.0): entra direto no usuário escolhido, que ainda
      // precisa ser ativo desta conta, e encerra a sessão de origem só agora.
      const destino = usuarios.find((ativo) => ativo.usuarioId === verificado.destinoUsuarioId)
      if (destino === undefined) throw naoAutenticado()
      return this.dependencias.conclusao.entrarNoDestino(destino, conta.id, conta.email, verificado.origem, origem)
    }
    return this.dependencias.conclusao.concluir({ contaId: conta.id, email: conta.email, usuarios, mfaAtivo: true, mfaCumprido: true }, origem)
  }

  /**
   * Com a credencial inteira verificada: ativa o usuário do convite cujo bilhete veio no login (7.0), sob a trava da
   * escola, lê os usuários ativos da conta, sem aluno, e só então consome o desafio. Na ordem inversa, o 503 da trava
   * (ou do banco) gastaria o desafio, e a pessoa, repetindo como o `Retry-After` manda, receberia "código incorreto".
   * Assim ela repete com o código seguinte do app: o passo deste já foi gravado (`mfa_ultimo_passo`), e dois pedidos com
   * o mesmo desafio não passam os dois pelo código. A ativação já acontece uma vez só, pelo `update` condicional.
   */
  async #depoisDoCodigoCerto(contaId: string, verificado: VerifiedChallenge): Promise<UsuarioAtivoDaConta[]> {
    const { consumo, ativacao, resolucao } = this.dependencias
    const pendente = verificado.conviteId === undefined ? undefined : await ativacao.pendenteDoConvite(contaId, verificado.conviteId)
    if (pendente !== undefined) await ativacao.ativar(pendente)
    const usuarios = (await resolucao.usuariosAtivosDaConta(contaId)).filter((ativo) => ativo.papel !== 'aluno')
    await consumo.consumir(verificado)
    return usuarios
  }

  /** O código do app (passo novo, gravado no banco) ou o de recuperação (usado uma vez, no banco). */
  async #fatorConfere(conta: MfaDaConta, pedido: MfaRequest): Promise<boolean> {
    if ('codigo' in pedido) {
      const passo = passoDoCodigo(this.#segredo(conta), pedido.codigo, this.#relogio.agora())
      return passo !== undefined && (await this.dependencias.resolucao.avancarPassoDoMfa(conta.id, passo))
    }
    const codigo = normalizarRecuperacao(pedido.recuperacao)
    return codigo !== undefined && (await this.dependencias.resolucao.usarCodigoDeRecuperacao(conta.id, hmacDaRecuperacao(this.dependencias.chaveRecuperacao, codigo)))
  }

  #segredo(conta: MfaDaConta): Uint8Array {
    if (conta.segredoCifrado === null || conta.chaveVersao === null) throw naoAutenticado()
    return this.dependencias.cifra.decifrar({ cifrado: conta.segredoCifrado, versao: conta.chaveVersao }, conta.id)
  }

  /** O desafio da etapa, com assinatura, prazo, `typ` e `aud` conferidos, e ainda não usado. */
  async #desafioLivre(desafio: string, etapa: EtapaComDesafio): Promise<VerifiedChallenge> {
    const verificado = await verifyChallenge(desafio, this.dependencias.chaveAssinatura, [etapa])
    await this.dependencias.consumo.conferirLivre(verificado)
    return verificado
  }

  #segurada(esperaMs: number): DomainException {
    this.#contaSegurada.add(1)
    return new DomainException(ErrorCode.CONTA_SEGURADA, undefined, Math.max(1, Math.ceil(esperaMs / 1_000)))
  }
}
