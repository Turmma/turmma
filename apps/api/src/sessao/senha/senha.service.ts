import { AuditoriaRecorder, currentContext, DomainException, insuranceLimit, runInContext, systemClock, type Clock, type Database, type JobOutbox, type LoggerBase, type SecretCipher } from '@educa/core'
import { ContaGlobalRepository } from '@educa/core/conta-global'
import { ErrorCode, TIPO_ENVIAR_EMAIL_DA_CONTA, type EsqueciSenhaRequest, type RedefinirSenhaRequest } from '@educa/shared'
import { Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PasswordHasher } from '../../credencial/password-hasher.js'
import type { HashBulkhead } from '../../credencial/senha/hash-bulkhead.js'
import { equipeBucket } from '../../credencial/senha/login-buckets.js'
import type { WindowCounter } from '../../credencial/senha/window-counter.js'
import { normalizarEmail } from '../../credencial/login-identifiers.js'
import { hashDoToken } from '../../credencial/token-hash.js'
import { tokenNovo } from '../convite/convite.service.js'
import { linkJaAberto, TenantResolutionRepository } from '../tenant/tenant-resolution.repository.js'

const registro = new AuditoriaRecorder()

/** O piso da resposta do "esqueci": quem pede com e-mail que tem conta e quem pede com o que não tem levam o mesmo tempo (Tech Spec, seção 5, "Esqueci"). */
export const PISO_DO_ESQUECI_MS = 400
/** Quanto vale o link do "esqueci a senha". */
export const VALIDADE_DO_LINK_DE_REDEFINIR_MS = 60 * 60 * 1000
/** O balde do "esqueci" por IP: 10 por minuto, pelo HMAC do IP. Acima dele o pedido não gera link e a resposta é a mesma. */
export const PREFIXO_DO_BALDE_DO_ESQUECI_POR_IP = 'rl:ip:senha'
export const LIMITE_DO_ESQUECI_POR_IP_MIN = 10
/** O "esqueci" por e-mail digitado: 3 por hora, pelo HMAC do e-mail (alcança também e-mail sem conta). */
export const PREFIXO_DO_ESQUECI_POR_EMAIL = 'rl:senha:email'
export const LIMITE_DO_ESQUECI_POR_EMAIL_HORA = 3

/** O relógio e a espera do piso: o teste os troca para provar os 400 ms por relógio falso. */
export interface PisoDoEsqueci {
  readonly relogio: Clock
  readonly esperar: (ms: number) => Promise<void>
}

export interface SenhaDependencies {
  readonly banco: Database
  readonly resolucao: TenantResolutionRepository
  readonly hash: Pick<PasswordHasher, 'gerar'>
  /** O semáforo do argon2, o mesmo do login: a senha nova espera a vez no balde da equipe, por IP. */
  readonly semaforo: Pick<HashBulkhead, 'executar'>
  /** A janela de um minuto, a do balde por IP. */
  readonly porMinuto: Pick<WindowCounter, 'chaveDe' | 'somar'>
  /** A janela de uma hora, a do balde por e-mail. */
  readonly porHora: Pick<WindowCounter, 'chaveDe' | 'somar'>
  /** Quantas instâncias da API dividem o limite quando a contagem é do seguro em memória. */
  readonly instancias: number
  /** A cifra do token e do endereço na fila de envio (`EMAIL_TOKEN_KEY`), a mesma do convite. */
  readonly cifra: Pick<SecretCipher, 'cifrar'>
  readonly fila: Pick<JobOutbox, 'enfileirar'>
  /** O logger JSON do processo: o evento leva o id do link, nunca o e-mail nem o token (regra 20, item 9). */
  readonly logger: Pick<LoggerBase, 'info'>
  readonly relogio?: Clock
  /** A espera até o piso. Só o teste troca, para provar o piso por relógio falso e nunca por cronômetro. */
  readonly esperar?: (ms: number) => Promise<void>
}

const linkInvalido = () => new DomainException(ErrorCode.NAO_ENCONTRADO)
const esperarDeVerdade = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * O "esqueci a senha" e o "redefinir" da equipe (acesso-e-convites, tarefa 5.0, RF12; Tech Spec, seção 5, "Esqueci"). Anônimos: não há escola nem usuário no contexto.
 *
 * **Esqueci** (`POST /v1/senha/esqueci`, 202):
 * - A resposta é a mesma, no corpo e no tempo, para e-mail com conta, sem conta, de conta desligada e acima de qualquer limite: o piso de 400 ms vale também para quem
 *   perde a corrida do índice único. Nada na resposta diz se a conta existe.
 * - Os dois contadores andam sempre, exista a conta ou não: o balde `rl:ip:senha` (10 por minuto, pelo HMAC do IP) e o do e-mail digitado (3 por hora, pelo HMAC dele). Acima
 *   de qualquer um, o pedido termina sem link e sem envio, nunca com 429: a escola inteira sai por um IP (regra 80, item 1), e o login do mesmo IP não depende destes baldes.
 * - A conta ativa (ao menos um usuário que não foi desativado) ganha o link de 1 h: numa transação, o link aberto anterior é cancelado (o envio dele que ainda esperava termina
 *   `cancelado` na hora), o novo nasce `na_fila` com o token e o endereço cifrados, e o job `sistema.enviar-email-da-conta` entra na fila. O e-mail não sai na requisição.
 * - Dois pedidos ao mesmo tempo deixam um link aberto só (`link_da_conta_aberto_unico`): quem perde leva o 23505, desfaz a transação e responde igual.
 *
 * **Redefinir** (`POST /v1/senha/redefinir`, 204):
 * - O token é conferido **antes** do argon2: token inválido, vencido, usado ou de outro formato responde `NAO_ENCONTRADO` sem ocupar o semáforo do hash.
 * - Só então o hash da senha nova sai, pelo semáforo, fora da transação (ela não segura a conta durante o argon2).
 * - Na transação, com a conta travada (a ordem da redefinição do MFA e da desativação: conta, depois sessão): o link é marcado como usado, uma vez só (`usado_em is null`),
 *   a senha é trocada, todas as sessões da conta são encerradas (`senha_redefinida`) e `senha.redefinida` é gravado em cada escola em que a conta tem usuário ativo, com esse
 *   usuário como autor e alvo. O MFA fica como está. Conta sem usuário ativo no momento (desativado entre o link e o redefinir): nada é gravado e a resposta é a do link inválido.
 */
export class SenhaService {
  readonly #logger = new Logger('senha')
  readonly #relogio: Clock
  readonly #esperar: (ms: number) => Promise<void>

  constructor(private readonly dependencias: SenhaDependencies) {
    this.#relogio = dependencias.relogio ?? systemClock
    this.#esperar = dependencias.esperar ?? esperarDeVerdade
  }

  async esqueci(pedido: EsqueciSenhaRequest, ip: string): Promise<void> {
    const inicio = this.#relogio.agora().getTime()
    await this.#pedir(normalizarEmail(pedido.email), ip)
    const falta = PISO_DO_ESQUECI_MS - (this.#relogio.agora().getTime() - inicio)
    if (falta > 0) await this.#esperar(falta)
  }

  async #pedir(email: string, ip: string): Promise<void> {
    const { resolucao } = this.dependencias
    // Os dois contadores andam sempre, antes de olhar a conta: nem o tempo nem o limite dizem se ela existe.
    const [doIp, doEmail] = await Promise.all([this.#contar('porMinuto', PREFIXO_DO_BALDE_DO_ESQUECI_POR_IP, ip, LIMITE_DO_ESQUECI_POR_IP_MIN), this.#contar('porHora', PREFIXO_DO_ESQUECI_POR_EMAIL, email, LIMITE_DO_ESQUECI_POR_EMAIL_HORA)])
    if (doIp || doEmail) return
    const achada = await resolucao.contaPorEmail(email)
    if (achada === undefined) return
    if ((await resolucao.usuariosAtivosDaConta(achada.id, { comSuspensos: true })).length === 0) return
    await this.#abrirLink(achada.id, email)
  }

  /** Soma um no contador e diz se o pedido passou do limite dele (dividido pelas instâncias no seguro em memória). */
  async #contar(janela: 'porMinuto' | 'porHora', prefixo: string, identificador: string, limite: number): Promise<boolean> {
    const contador = this.dependencias[janela]
    const { valor, doSeguro } = await contador.somar(contador.chaveDe(prefixo, identificador))
    return valor > (doSeguro ? insuranceLimit(limite, this.dependencias.instancias) : limite)
  }

  async #abrirLink(contaId: string, email: string): Promise<void> {
    const { banco, cifra, fila } = this.dependencias
    const token = tokenNovo()
    const expiraEm = new Date(this.#relogio.agora().getTime() + VALIDADE_DO_LINK_DE_REDEFINIR_MS)
    const cifrarParaEnvio = (linkId: string) => ({
      tokenCifrado: cifra.cifrar(Buffer.from(token, 'utf8'), linkId).cifrado,
      destinoCifrado: cifra.cifrar(Buffer.from(email, 'utf8'), linkId).cifrado,
    })
    try {
      const linkId = await banco.transaction(async (tx) => {
        const resolucao = new TenantResolutionRepository(tx)
        await resolucao.cancelarLinksAbertos(contaId, 'redefinir')
        const id = await resolucao.criarLinkDaConta({ contaId, finalidade: 'redefinir', tokenHash: hashDoToken(token), expiraEm, cifrarParaEnvio })
        await fila.enfileirar(tx, TIPO_ENVIAR_EMAIL_DA_CONTA, { linkId: id })
        return id
      })
      // O id do link correlaciona com o `email.link_da_conta_*` do worker; a conta, o e-mail e o token não saem.
      this.dependencias.logger.info({ evento: 'senha.link_na_fila', linkId })
    } catch (erro) {
      // Outro pedido da mesma conta abriu o link primeiro: ele vale, e este responde igual, no mesmo piso.
      if (!linkJaAberto(erro)) throw erro
    }
  }

  async redefinir(pedido: RedefinirSenhaRequest, ip: string): Promise<void> {
    const { banco, resolucao, hash, semaforo } = this.dependencias
    const tokenHash = hashDoToken(pedido.token)
    // O token se confere antes do argon2: o inválido não ocupa o semáforo.
    const valido = await resolucao.linkValidoPorHash(tokenHash, 'redefinir')
    if (valido === undefined) throw linkInvalido()
    const senhaHash = await semaforo.executar(equipeBucket(ip), () => hash.gerar(pedido.senha))
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    await banco.transaction(async (tx) => {
      const naTransacao = new TenantResolutionRepository(tx)
      // A conta primeiro: dois redefinir da mesma conta, e a desativação de um usuário dela, esperam uns pelos outros.
      if ((await naTransacao.travarContaParaRedefinir(valido.contaId)) === undefined) throw linkInvalido()
      const usado = await naTransacao.usarLinkPorHash(tokenHash, 'redefinir')
      if (usado === undefined || usado.contaId !== valido.contaId) throw linkInvalido()
      // Sem usuário ativo agora, não há escola a avisar nem quem entre com a senha nova: o link já não serve.
      const usuarios = await naTransacao.usuariosAtivosDaConta(valido.contaId, { comSuspensos: true })
      if (usuarios.length === 0) throw linkInvalido()
      await naTransacao.trocarSenha(valido.contaId, senhaHash)
      await new ContaGlobalRepository(tx).encerrarSessoesDaConta(valido.contaId, 'senha_redefinida')
      // Uma escola, um registro: o primeiro usuário ativo da conta nela, por id, é o autor e o alvo.
      const porEscola = new Map<string, string>()
      for (const ativo of usuarios) if (!porEscola.has(ativo.escolaId)) porEscola.set(ativo.escolaId, ativo.usuarioId)
      for (const [escolaId, usuarioId] of porEscola) {
        await runInContext({ requisicaoId, escolaId, usuarioId }, () => registro.gravar(tx, 'senha.redefinida', { entidadeId: usuarioId }))
      }
    })
    this.#logger.log('senha.redefinida')
  }
}
