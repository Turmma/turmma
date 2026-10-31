import { DomainException, FORMATO_SLUG, TAMANHO_MAXIMO_SLUG, type Database, type Meter } from '@educa/core'
import { ErrorCode, type LoginMatriculaRequest } from '@educa/shared'
import type { ConclusaoDeLogin } from '../completion/login-completion.js'
import type { LoginLockout } from '../../credencial/login-lockout.js'
import type { DeviceCookie } from '../../credencial/device-cookie.js'
import { DEVICE_COOKIE, lerCookie } from '../../credencial/cookies.js'
import { CredencialMatriculaRepository } from '../../credencial/credencial-matricula.repository.js'
import { naEscolaSemUsuario } from '../tenant/escola-sem-usuario.js'
import { identificadorDoAluno } from '../../credencial/identificador-do-aluno.js'
import { ipParaRegistro, type RequestOrigin, type ResultadoDoLogin } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import type { TenantResolutionRepository } from '../tenant/tenant-resolution.repository.js'
import { escolaBucket, escolaDesconhecidaBucket, contadorDoRebaixamentoPorIp } from '../../credencial/senha/login-buckets.js'
import type { PasswordVerifier, PasswordAttempt } from '../../credencial/senha/password-verifier.js'
import { LoginDurationHistogram } from '../../credencial/senha/login-duration.js'
import type { EscolaIpThrottle } from '../../credencial/senha/ip-throttle.js'

/**
 * A "escola desconhecida" do slug que não existe: entra no lugar do `escola_id` na chave do contador e na entrada do
 * `educa_dispositivo`, para o slug inexistente seguir o mesmo caminho, com a mesma resposta, até o bloqueio. Não é
 * escola nenhuma e nunca vira contexto.
 */
export const ESCOLA_DESCONHECIDA = '00000000-0000-0000-0000-000000000000'

export interface LoginPorMatriculaDependencies {
  readonly banco: Database
  readonly resolucao: TenantResolutionRepository
  /** A vez no semáforo do hash (14.0), no balde da escola do endereço ou no da escola desconhecida, o contador e o hash. */
  readonly conferencia: PasswordVerifier
  readonly contador: LoginLockout
  /** O rebaixamento por IP e escola (15.1): o IP com falhas demais na escola vai para o fim do balde dela. */
  readonly rebaixamento: EscolaIpThrottle
  readonly dispositivo: DeviceCookie
  readonly conclusao: ConclusaoDeLogin
  readonly medidor: Meter
}

type CredencialDoAluno = Awaited<ReturnType<CredencialMatriculaRepository['doAlunoAtivo']>>

/** A chave do contador de uma tentativa, o identificador do cookie e se o navegador já conhece a conta. */
interface ChaveDaTentativa {
  readonly chave: string
  readonly identificador: string
  readonly conhecido: boolean
}

/**
 * O login do aluno pelo endereço da escola, com matrícula e senha (RF7, RF11, RF15; Tech Spec, seções 1, 5 e 6).
 *
 * - **A escola vem do slug:** a `TenantResolutionRepository` acha a escola pelo endereço, e a credencial é lida pelo
 *   repository com escopo, num contexto de escola sem usuário. A mesma matrícula em outra escola é outra conta, e a
 *   senha dela não abre esta.
 * - **Respostas iguais:** slug inexistente, matrícula inexistente, aluno desativado e senha errada levam um hash cada
 *   (o fixo, quando não há credencial) e a mesma resposta, `NAO_AUTENTICADO`; e todos contam no contador, até o
 *   `CONTA_SEGURADA`. Nem o corpo, nem o hash, nem o bloqueio dizem se a matrícula existe (regra 20, item 6).
 * - **Segura por conta, nunca por IP** (regra 80, item 1): a chave do contador é o HMAC de `escola_id|matricula`, com o
 *   sufixo `conhecido` quando o navegador tem o `educa_dispositivo` dessa conta. Errar a senha segura só a matrícula
 *   daquela escola; os colegas atrás do mesmo IP, e a mesma matrícula em outra escola, continuam entrando.
 * - **Eliminação agendada** (F3, 14.0): a credencial do aluno é conferida como a de qualquer um, e só com a senha certa a
 *   resposta é `ACESSO_SUSPENSO`. Senha errada na conta suspensa é igual à matrícula inexistente: mesmo status, mesmo corpo,
 *   mesmo contador, um hash cada.
 * - **Acerto:** zera o contador e vai direto a `pronta` (o aluno tem um usuário só, sem conta nem segundo fator), com
 *   sessão de método `matricula`, `registro_acesso` e os cookies `educa_sessao` e `educa_dispositivo`.
 * - **Log:** nada aqui escreve matrícula nem o slug digitado; o filtro de erro registra só o código.
 * - **Semáforo do hash** (14.0): a vez é pedida no balde da escola do endereço, exista a matrícula ou não (o endereço
 *   que não existe tem o balde dele), e antes de a tentativa ser contada: o 503 de quem esperou demais não conta como
 *   senha errada, e a rajada da escola vira fila, nunca `CONTA_SEGURADA`.
 * - **Rebaixamento** (15.1): o IP com mais falhas que o limiar da escola no último minuto vai para o fim do balde dela,
 *   sem recusa; quem traz o `educa_dispositivo` daquela matrícula mantém a vez. Toda falha na escola conta para o IP.
 *   O endereço que não existe não conta falha por IP: o balde dele não tem aluno de verdade a proteger.
 * - **Limite por IP do login** (15.0): o IP acima do limite por IP das rotas de login (`@DowngradeRateLimit()`) também vai
 *   para o fim do balde, com a mesma passagem pelo cookie, e nunca recebe 429.
 */
export class LoginPorMatricula {
  readonly #duracao: LoginDurationHistogram
  readonly #rebaixadasPeloIp: { contar: () => void }

  constructor(private readonly dependencias: LoginPorMatriculaDependencies) {
    this.#duracao = new LoginDurationHistogram(dependencias.medidor, 'matricula')
    this.#rebaixadasPeloIp = contadorDoRebaixamentoPorIp(dependencias.medidor)
  }

  entrar(pedido: LoginMatriculaRequest, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    return this.#duracao.medir(() => this.#entrar(pedido, origem))
  }

  async #entrar(pedido: LoginMatriculaRequest, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    const escolaId = await this.#escolaDoSlug(pedido.slug)
    if (escolaId === undefined) return this.#recusar(ESCOLA_DESCONHECIDA, pedido, origem)
    return naEscolaSemUsuario({ escolaId }, async () => {
      const { banco, conferencia, contador, conclusao, rebaixamento } = this.dependencias
      const { chave, identificador, conhecido } = this.#chave(escolaId, pedido.matricula, origem)
      const peloIp = !conhecido && origem.acimaDoLimiteDoIp === true
      if (peloIp) this.#rebaixadasPeloIp.contar()
      const rebaixado = (await rebaixamento.rebaixar(origem.ip, escolaId, conhecido)) || peloIp
      const tentativa: PasswordAttempt<CredencialDoAluno> = {
        balde: escolaBucket(escolaId, rebaixado),
        chave,
        senha: pedido.senha,
        lerCredencial: () => new CredencialMatriculaRepository(banco).doAlunoAtivo(pedido.matricula),
        aoFalhar: () => rebaixamento.contarFalha(origem.ip, escolaId),
      }
      const { reserva, credencial, confere } = await conferencia.conferir(tentativa)
      if (credencial === undefined || !confere) {
        await new RegistroDeAcessoRepository(banco).gravarFalha(ipParaRegistro(origem.ip))
        return conferencia.recusar(tentativa, reserva)
      }

      await contador.zerar(chave)
      // A eliminação agendada (F3, 14.0): a senha está certa, e é só agora que se diz que o acesso está suspenso. Nada é
      // emitido e nenhuma sessão nasce; o registro de acesso é o de uma tentativa que não entrou.
      if (credencial.suspenso) {
        await new RegistroDeAcessoRepository(banco).gravarFalha(ipParaRegistro(origem.ip))
        throw new DomainException(ErrorCode.ACESSO_SUSPENSO)
      }
      return conclusao.entrarComoAluno({ usuarioId: credencial.usuarioId, escolaId }, identificador, origem)
    })
  }

  /** A escola do endereço, ou `undefined`: slug fora do formato nem vai ao banco, e responde como o inexistente. */
  async #escolaDoSlug(slug: string): Promise<string | undefined> {
    if (slug.length > TAMANHO_MAXIMO_SLUG || !FORMATO_SLUG.test(slug)) return undefined
    return this.dependencias.resolucao.escolaPorSlug(slug)
  }

  /**
   * O slug que não existe: espera a vez no balde da escola desconhecida, conta no contador dela e passa pelo hash fixo,
   * como a matrícula que não existe. Sem escola, não grava `registro_acesso`: não há de quem seja o registro.
   */
  async #recusar(escolaId: string, pedido: LoginMatriculaRequest, origem: RequestOrigin): Promise<never> {
    const { conferencia } = this.dependencias
    if (origem.acimaDoLimiteDoIp === true) this.#rebaixadasPeloIp.contar()
    const tentativa: PasswordAttempt<undefined> = {
      // O IP acima do limite por IP do login também vai para o fim deste balde, que não tem conta de verdade.
      balde: escolaDesconhecidaBucket(origem.acimaDoLimiteDoIp === true),
      chave: this.#chave(escolaId, pedido.matricula, origem).chave,
      senha: pedido.senha,
      lerCredencial: () => Promise.resolve(undefined),
    }
    const { reserva } = await conferencia.conferir(tentativa)
    return conferencia.recusar(tentativa, reserva)
  }

  #chave(escolaId: string, matricula: string, origem: RequestOrigin): ChaveDaTentativa {
    const { contador, dispositivo } = this.dependencias
    const identificador = identificadorDoAluno(escolaId, matricula)
    const conhecido = dispositivo.conhece(lerCookie(origem.cabecalhoCookie, DEVICE_COOKIE), identificador)
    return { chave: contador.chaveDe(identificador, conhecido ? 'conhecido' : 'outro'), identificador, conhecido }
  }
}
