import { ErroDeDominio, type Meter } from '@educa/nucleo'
import { ErrorCode, type LoginEmailRequest } from '@educa/shared'
import type { ConclusaoDeLogin } from '../conclusao/conclusao-de-login.js'
import type { AtivacaoPorConvite } from '../convite/convite.service.js'
import type { ContadorDeTentativas } from '../../credencial/contador-de-tentativas.js'
import type { CookieDeDispositivo } from '../../credencial/cookie-dispositivo.js'
import { COOKIE_DISPOSITIVO, lerCookie } from '../../credencial/cookies.js'
import { normalizarEmail } from '../../credencial/identificadores-do-login.js'
import { ipParaRegistro, type OrigemDaRequisicao, type ResultadoDoLogin } from '../../credencial/origem-da-requisicao.js'
import type { ResolucaoDeTenantRepository, UsuarioAtivoDaConta, UsuarioComConviteAceito } from '../tenant/resolucao-de-tenant.repository.js'
import { baldeDaEquipe, contadorDoRebaixamentoPorIp } from '../../credencial/senha/baldes-de-login.js'
import type { ConferenciaNaVez, SenhaConferida, TentativaDeSenha } from '../../credencial/senha/conferencia-na-vez.js'
import { DuracaoDoLogin } from '../../credencial/senha/duracao-do-login.js'
import type { LimiteDoEmailPorIp } from '../../credencial/senha/limite-email-ip.js'

export interface DependenciasDoLogin {
  readonly resolucao: ResolucaoDeTenantRepository
  /** A vez no semáforo do hash, o contador e o hash (14.0, 15.6): a vez é pedida antes de contar a tentativa. */
  readonly conferencia: ConferenciaNaVez
  readonly contador: ContadorDeTentativas
  /** O limite por IP da rota (15.2): acima dele, a tentativa vai para o fim do balde da equipe. */
  readonly limitePorIp: LimiteDoEmailPorIp
  readonly dispositivo: CookieDeDispositivo
  readonly conclusao: ConclusaoDeLogin
  readonly ativacao: AtivacaoPorConvite
  readonly medidor: Meter
}

/** A credencial da conta como a resolução a devolve, pelo e-mail. */
type CredencialDaConta = Awaited<ReturnType<ResolucaoDeTenantRepository['contaPorEmail']>>

/**
 * O login da equipe por e-mail e senha (RF6, RF11, RF14; Tech Spec, seção 5).
 *
 * - **Respostas iguais:** senha errada, e-mail que não existe e conta sem usuário ativo levam um hash cada e a mesma
 *   resposta, `NAO_AUTENTICADO`, e as três contam no contador daquele e-mail: nem o tempo, nem o corpo, nem o
 *   bloqueio dizem se a conta existe.
 * - **Segura por conta, nunca por IP:** a tentativa é contada antes do hash, no contador do e-mail e da origem
 *   (`conhecido` quando o navegador tem o `educa_dispositivo` daquela conta). Segurada, responde 429
 *   `CONTA_SEGURADA` com `Retry-After`, sem conferir a senha.
 * - **Etapas:** mais de um usuário ativo leva a `escolher`; um coordenador leva a `configurar_mfa` ou `mfa`; um
 *   professor, a `pronta`. Só `pronta` grava sessão e os cookies `educa_sessao` e `educa_dispositivo`; as outras
 *   devolvem só o desafio, sem cookie.
 * - **Convite aceito por conta que já tinha senha** (7.0): só com o `bilhete` que o aceite devolveu, da mesma conta, o
 *   usuário que espera o convite conta como usuário da conta, e só é ativado com a credencial inteira. Sem MFA, logo
 *   depois da senha certa, sob a trava do convite da escola (`AtivacaoPorConvite`); com MFA, a resposta é `mfa` com o
 *   convite no desafio, e quem ativa é o `MfaService`, depois do código. Sem o bilhete, o login segue como se não
 *   houvesse convite.
 * - **A senha certa com o convite que já não ativa** (Tech Spec da A0b, seção 5): o bilhete é desta conta, mas o convite
 *   foi revogado, antes ou por um gerar do operador que venceu a trava. Com outro usuário ativo, entra nele (ou vai a
 *   `escolher`, sem a escola do convite). Sem nenhum, `NAO_ENCONTRADO`, a resposta de convite inválido, sem `login_falho`
 *   e com a reserva do contador desfeita; com MFA, essa resposta só vem depois do código certo. Senha errada conta como
 *   sempre. Quem tem o bilhete (30 min, preso à conta) distingue aí a senha certa (404) da errada (401): é aceito, porque
 *   as erradas continuam contando, e com o convite ainda válido a senha certa já dava o login, sinal mais forte.
 * - **Semáforo do hash** (14.0): todo login por e-mail, exista a conta ou não, espera a vez no balde `equipe`, com a
 *   vez rodando por IP. A vez vem antes de a tentativa ser contada: o 503 de quem esperou demais não conta como senha
 *   errada, e a web que repete o pedido no 503 não segura a conta de ninguém.
 * - **Limite por IP** (15.2): o IP acima de `LIMITE_LOGIN_EMAIL_IP_MIN` tentativas por minuto (vezes as escolas da rede,
 *   se é o IP de saída dela) vai para o fim do balde da equipe, nunca recusado; quem traz a conta no
 *   `educa_dispositivo` mantém a vez.
 */
export class LoginService {
  readonly #duracao: DuracaoDoLogin
  readonly #rebaixadasPeloIp: { contar: () => void }

  constructor(private readonly dependencias: DependenciasDoLogin) {
    this.#duracao = new DuracaoDoLogin(dependencias.medidor, 'email')
    this.#rebaixadasPeloIp = contadorDoRebaixamentoPorIp(dependencias.medidor)
  }

  entrarPorEmail(pedido: LoginEmailRequest, origem: OrigemDaRequisicao): Promise<ResultadoDoLogin> {
    return this.#duracao.medir(() => this.#entrarPorEmail(pedido, origem))
  }

  async #entrarPorEmail(pedido: LoginEmailRequest, origem: OrigemDaRequisicao): Promise<ResultadoDoLogin> {
    const { resolucao, conferencia, contador, dispositivo, limitePorIp } = this.dependencias
    const email = normalizarEmail(pedido.email)
    const conhecido = dispositivo.conhece(lerCookie(origem.cabecalhoCookie, COOKIE_DISPOSITIVO), email)
    const chave = contador.chaveDe(email, conhecido ? 'conhecido' : 'outro')
    // As duas contagens andam sempre: a do limite da rota de e-mail e, na guarda, a do limite por IP do login.
    const acimaDoLimiteDaRota = await limitePorIp.rebaixar(origem.ip, conhecido)
    const peloIp = !conhecido && origem.acimaDoLimiteDoIp === true
    if (peloIp) this.#rebaixadasPeloIp.contar()
    const rebaixado = acimaDoLimiteDaRota || peloIp
    const tentativa: TentativaDeSenha<CredencialDaConta> = {
      balde: baldeDaEquipe(origem.ip, rebaixado),
      chave,
      senha: pedido.senha,
      lerCredencial: () => resolucao.contaPorEmail(email),
    }

    const { reserva, credencial, confere } = await conferencia.conferir(tentativa)
    if (!confere || credencial === undefined) return this.#recusar(tentativa, reserva, origem)

    // Daqui em diante a senha está certa: o que falhar no caminho (a trava da escola além do prazo, o banco fora) não é
    // senha errada, e a reserva é desfeita antes de o erro subir.
    const { conviteId, pendente, usuarios } = await this.#depoisDaSenhaCerta(credencial, pedido.bilhete).catch(async (erro: unknown) => {
      await contador.desfazer(chave, reserva)
      throw erro
    })
    if (vaiAoCodigoComOConvite(conviteId, credencial.mfaAtivo, pendente, usuarios)) {
      if (pendente === undefined) await contador.desfazer(chave, reserva)
      else await contador.zerar(chave)
      return this.dependencias.conclusao.pedirSegundoFator(credencial.id, conviteId)
    }
    if (usuarios.length === 0) {
      if (conviteId === undefined) {
        // A senha está certa e nenhum usuário pode entrar: se é porque a eliminação está agendada (14.0), é só agora que a
        // resposta diz que o acesso está suspenso. Conta sem usuário ativo nenhum segue como a senha errada.
        if (await this.dependencias.resolucao.temAcessoSuspenso(credencial.id)) {
          await contador.zerar(chave)
          throw new ErroDeDominio(ErrorCode.ACESSO_SUSPENSO)
        }
        return this.#recusar(tentativa, reserva, origem)
      }
      // A senha certa, com o bilhete desta conta, de um convite que já não ativa (revogado, ou trocado por um gerar que
      // venceu a trava) e sem outro usuário ativo: não houve acesso, e não foi senha errada. Nem `login` nem
      // `login_falho`, e o contador volta ao que era antes (Tech Spec da A0b, seção 5).
      await contador.desfazer(chave, reserva)
      throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    }

    await contador.zerar(chave)
    return this.dependencias.conclusao.concluir({ contaId: credencial.id, email, usuarios, mfaAtivo: credencial.mfaAtivo, mfaCumprido: false }, origem)
  }

  /**
   * O que vem depois da senha certa: o convite do bilhete desta conta, o usuário que espera por ele e, sem MFA, a
   * ativação dele (sob a trava da escola), e os usuários ativos da conta. Só com a senha certa há estas consultas a mais:
   * o tempo delas só diz algo a quem já tem a senha. Não copie este padrão para antes do hash.
   */
  async #depoisDaSenhaCerta(
    credencial: NonNullable<CredencialDaConta>,
    bilhete: string | undefined,
  ): Promise<{ conviteId: string | undefined; pendente: UsuarioComConviteAceito | undefined; usuarios: UsuarioAtivoDaConta[] }> {
    const { ativacao } = this.dependencias
    const conviteId = await ativacao.conviteDoBilhete(bilhete, credencial.id)
    const pendente = conviteId === undefined ? undefined : await ativacao.pendenteDoConvite(credencial.id, conviteId)
    // Sem MFA, o usuário do convite é ativado já com a senha certa; com MFA, só depois do código (`MfaService`).
    if (pendente !== undefined && !credencial.mfaAtivo) await ativacao.ativar(pendente)
    return { conviteId, pendente, usuarios: await this.#usuariosAtivos(credencial.id) }
  }

  /** Senha errada, e-mail que não existe e conta sem usuário ativo: `login_falho` e a resposta única (RF6). */
  async #recusar(tentativa: TentativaDeSenha<CredencialDaConta>, reserva: SenhaConferida<unknown>['reserva'], origem: OrigemDaRequisicao): Promise<never> {
    await this.dependencias.resolucao.gravarFalhaDeLoginPorEmail(ipParaRegistro(origem.ip))
    return this.dependencias.conferencia.recusar(tentativa, reserva)
  }

  async #usuariosAtivos(contaId: string): Promise<UsuarioAtivoDaConta[]> {
    return (await this.dependencias.resolucao.usuariosAtivosDaConta(contaId)).filter((ativo) => ativo.papel !== 'aluno')
  }
}

/**
 * Com MFA e o bilhete desta conta, o código vem antes de tudo: com o convite ainda à espera (quem ativa é o
 * `MfaService`), ou com o convite que já não ativa e nenhum outro usuário ativo, que aí só depois do código certo recebe
 * a resposta de convite inválido. Com outro usuário ativo e o convite que já não ativa, o login segue o caminho de sempre.
 */
function vaiAoCodigoComOConvite(conviteId: string | undefined, mfaAtivo: boolean, pendente: UsuarioComConviteAceito | undefined, usuarios: readonly UsuarioAtivoDaConta[]): conviteId is string {
  return conviteId !== undefined && mfaAtivo && (pendente !== undefined || usuarios.length === 0)
}
