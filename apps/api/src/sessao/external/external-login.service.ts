import {
  currentContext,
  DomainException,
  runInContext,
  METRICS,
  AuditoriaRecorder,
  type Database,
  type Meter,
  type ProvedorExterno,
} from '@educa/core'
import {
  ENDERECO_DO_EU_DO_ALUNO,
  ErrorCode,
  PARAMETRO_DA_CONTA_PROVADA,
  PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO,
  PARAMETRO_DA_LIGACAO,
  TENANT_DE_CONTA_PESSOAL_MICROSOFT,
  VALOR_DA_CONTA_PROVADA,
  type FalhaDoLoginExterno,
  type ResultadoDaLigacao,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { ConclusaoDeLogin } from '../completion/login-completion.js'
import { lerCookie, SESSAO_COOKIE } from '../../credencial/cookies.js'
import { hashDoRefresh } from '../../credencial/login-identifiers.js'
import { naEscolaSemUsuario } from '../tenant/escola-sem-usuario.js'
import { ipParaRegistro, type RequestOrigin } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import type { TenantResolutionRepository } from '../tenant/tenant-resolution.repository.js'
import { CAMINHO_DO_RETORNO } from '../../credencial/external-login-config.js'
import { ContaExternalRepository, type ChaveDaContaExterna, type LigacaoDaContaExterna } from './conta-externa.repository.js'
import { COOKIE_OIDC, type ContaProvada, type CookieContaProvada, type CookieOidc, type LoginExternoEmAndamento } from './cookie-oidc.js'
import { ExternalProviderError, type ContaNoProvedor, type ExternalProviderPort } from './external-provider.port.js'

/** O redirecionamento que o controller devolve: o `Location` e os `Set-Cookie`. */
export interface Redirect {
  readonly endereco: string
  readonly cookies: readonly string[]
}

export interface ExternalLoginDependencies {
  readonly banco: Database
  readonly resolucao: TenantResolutionRepository
  readonly provedor: ExternalProviderPort
  readonly cookie: CookieOidc
  /** O cookie da conta que o aluno provou na sala (14.0): o retorno com `intencao=reivindicar` o grava. */
  readonly cookieDaConta: CookieContaProvada
  readonly conclusao: ConclusaoDeLogin
  /** O `redirect_uri` configurado: o retorno é remontado sobre ele, com a query que chegou. */
  readonly retorno: URL | undefined
  readonly medidor: Meter
}

/** Para onde a web vai depois de entrar: a casca, que renova a sessão pelo cookie e lê `/v1/eu` (18.0). */
export const DESTINO_DEPOIS_DE_ENTRAR = '/'

/**
 * Quanto o `auth_time` do ID token pode ser antigo na volta da ligação da conta em "Eu" (15.0): o `iniciar` pediu a prova de novo (`max_age=0`), e a folga cobre a senha digitada e o
 * relógio do provedor. O Google só traz a claim com um ajuste do console dele, e a Microsoft a traz como opcional: sem ela, vale o que o endereço pediu (`prompt`); com ela, ela precisa ser recente.
 */
export const IDADE_MAXIMA_DA_AUTENTICACAO_S = 120

/** A sala a que o `iniciar` com `intencao=reivindicar` prende o login: o acesso vigente, achado pelo link ou pelo código na escola do slug. */
export interface SalaDoLogin {
  readonly escolaId: string
  readonly acessoId: string
}

/** O endereço da página da sala na web, para onde o aluno volta com a conta provada (o token do link ele guardou antes de sair). */
export function enderecoDaSala(slug: string): string {
  return `/e/${encodeURIComponent(slug)}/turma?${PARAMETRO_DA_CONTA_PROVADA}=${VALOR_DA_CONTA_PROVADA}`
}

/** O endereço da escola na web com a falha, que a tela `/e/:slug` mostra (19.0). */
export function enderecoDaFalha(slug: string | undefined, falha: FalhaDoLoginExterno): string {
  const consulta = `?${PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO}=${falha}`
  return slug === undefined ? `/${consulta}` : `/e/${encodeURIComponent(slug)}${consulta}`
}

/** O que o retorno da ligação decide sozinho: a queda do provedor (`provedor`) não passa por aqui, e por isso a métrica `ligacao_<resultado>` só tem estes três. */
type ResultadoDoRetornoDaLigacao = Exclude<ResultadoDaLigacao, 'provedor'>

/** O endereço de "Eu" do aluno na web com o resultado da ligação (15.0), que a tela mostra e tira da barra. */
export function enderecoDaLigacao(resultado: ResultadoDaLigacao): string {
  return `${ENDERECO_DO_EU_DO_ALUNO}?${PARAMETRO_DA_LIGACAO}=${resultado}`
}

type Decisao =
  | { readonly tipo: 'entrar'; readonly ligacao: Pick<LigacaoDaContaExterna, 'usuarioId' | 'contaId'> }
  | { readonly tipo: 'recusar' }
  /** A conta do provedor está certa e a pessoa tem a eliminação agendada (14.0): sem sessão e sem ligar nada. */
  | { readonly tipo: 'suspenso' }
  /** Só com `intencao=reivindicar` (acesso-e-convites, 14.0): a conta é de domínio liberado e não está ligada a ninguém, e o aluno a prova para o pedido do nome. */
  | { readonly tipo: 'provada'; readonly conta: ContaProvada }

const RECUSA: Decisao = { tipo: 'recusar' }
const SUSPENSO: Decisao = { tipo: 'suspenso' }

/** A ligação que entra, ou a suspensão se a pessoa tem a eliminação agendada: uma só decisão para toda ligação achada. */
function entrarSeNaoSuspensa(ligacao: Pick<LigacaoDaContaExterna, 'usuarioId' | 'contaId' | 'suspenso'>): Decisao {
  return ligacao.suspenso ? SUSPENSO : { tipo: 'entrar', ligacao }
}

/**
 * O login pela conta Google ou Microsoft da escola (RF8, RF9, RF10; Tech Spec, seção 5, "Externo").
 *
 * - **`iniciar`:** resolve a escola pelo slug, confere que ela liberou o provedor, e manda o navegador ao provedor com
 *   `state`, `nonce` e PKCE, guardados com a escola no cookie cifrado `educa_oidc`.
 * - **`retorno`:** a escola vem só do cookie, nunca da query (regra 10, item 3): um `?slug=` de outra escola não muda
 *   nada. O cookie é apagado sempre. O código vira a conta no provedor, com as conferências da biblioteca.
 * - **Domínio:** o `hd` (Google) ou o `tid` (Microsoft) precisa estar liberado pela escola do cookie. Conta pessoal
 *   não tem `hd`, e o tenant de conta pessoal da Microsoft nunca vale.
 * - **Com ligação:** a conta ligada a usuário ativo dessa escola entra, com sessão `externo`. Se a pessoa tem a eliminação
 *   agendada (F3, 14.0), a conta do provedor certa não abre sessão: o redirecionamento é `?falha=acesso_suspenso`, com um
 *   `login_falho` sem usuário. O professor agendado ainda sem ligação também não é ligado.
 * - **Sem ligação:** só o professor ativo dessa escola cujo e-mail bate, com o e-mail verificado (a claim no Google, o
 *   tenant conferido na Microsoft), e que ainda não tem conta externa, é ligado, com auditoria. Dois retornos juntos do
 *   mesmo professor criam uma ligação só, e os dois entram; uma segunda conta com o mesmo e-mail é recusada.
 * - **Recusa:** todo o resto, com o mesmo redirecionamento (`conta_externa_nao_ligada`) e um `login_falho` na escola,
 *   sem usuário: o aluno sem ligação, a conta de outro domínio, a segunda conta do professor, o coordenador.
 * - **`intencao=reivindicar`** (acesso-e-convites, 14.0): o `iniciar` prende o login ao acesso vigente da sala, no cookie `educa_oidc`.
 *   No retorno, a conta de domínio liberado **sem ligação** não liga ninguém (nem o professor pelo e-mail): vira o cookie
 *   `educa_conta_provada`, e o aluno volta à página da sala. A conta ligada a usuário ativo entra como sempre; a ligada a
 *   desativado e o domínio não liberado são recusados como sempre.
 * - **`intencao=ligar`** (acesso-e-convites, 15.0): o aluno com sessão liga a conta da escola em "Eu". O `iniciar` o acha pelo `educa_sessao` e o prende no cookie `educa_oidc`; o retorno
 *   liga na trava da linha do usuário (a da senha provisória), com a auditoria `conta_externa.ligada`, e volta a `/aluno/eu?ligacao=…`. Não abre sessão nem grava `login_falho`.
 * - **Provedor:** `error` no retorno, prazo de 5 s, resposta que não confere ou cookie ausente dão `?falha=provedor`.
 *   O login por matrícula e por e-mail não passa por aqui, e continua.
 * - **Nada de pessoa guardado:** o e-mail do provedor só é comparado, na memória desta requisição; nome, foto, tokens e
 *   claims nem saem do adaptador. Nada disso vai ao log, a uma exceção, à auditoria ou ao banco.
 */
export class ExternalLoginService {
  readonly #auditoria = new AuditoriaRecorder()
  readonly #resultados: ReturnType<Meter['createCounter']>

  constructor(private readonly dependencias: ExternalLoginDependencies) {
    this.#resultados = dependencias.medidor.createCounter(METRICS.loginExterno, { description: 'Retornos do login pela conta da escola, por resultado' })
  }

  /** Os provedores que a configuração ligou (a lista de `GET /v1/escolas/:slug/acesso` se limita a eles). */
  get ligados(): readonly ProvedorExterno[] {
    return this.dependencias.provedor.ligados
  }

  /**
   * O contrato exige o `provedor` e o `slug` já validados pelo `ZodValidationPipe` do controller: outro chamador tem de conferir o formato antes.
   * `sala`, com `intencao=reivindicar`, é o acesso vigente que o controller achou pelo link ou pelo código na escola do slug; a escola dele tem de
   * ser a do slug, senão responde como o inexistente (regra 10, item 6).
   */
  async iniciar(provedor: ProvedorExterno, slug: string, sala?: SalaDoLogin): Promise<Redirect> {
    if (!this.ligados.includes(provedor)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const escolaId = await this.dependencias.resolucao.escolaPorSlug(slug)
    if (escolaId === undefined || (sala !== undefined && sala.escolaId !== escolaId)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return this.#aoProvedor(provedor, slug, escolaId, sala === undefined ? {} : { acessoDaSalaId: sala.acessoId })
  }

  /**
   * O `iniciar` com `intencao=ligar` (acesso-e-convites, 15.0): o aluno que já entrou liga a conta da escola em "Eu". Quem liga é a sessão de aluno que o cookie de renovação
   * `educa_sessao` (que vai à navegação da própria web) traz, achada na escola do slug: sem o cookie, vencida, encerrada, de professor ou coordenador, ou de outra escola, responde
   * como o inexistente (regra 10, item 6). O aluno e a sessão vão no cookie `educa_oidc`, porque o retorno vem de outro site e o `educa_sessao` (`Strict`) não vai nele.
   */
  async iniciarParaLigar(provedor: ProvedorExterno, slug: string, cabecalhoCookie: string | undefined): Promise<Redirect> {
    if (!this.ligados.includes(provedor)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const escolaId = await this.dependencias.resolucao.escolaPorSlug(slug)
    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const refresh = lerCookie(cabecalhoCookie, SESSAO_COOKIE)
    const aluno =
      refresh === undefined
        ? undefined
        : await naEscolaSemUsuario({ escolaId }, () => new ContaExternalRepository(this.dependencias.banco).sessaoDoAluno(hashDoRefresh(refresh)))
    if (aluno === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return this.#aoProvedor(provedor, slug, escolaId, { ligarAoAluno: { usuarioId: aluno.usuarioId, sessaoId: aluno.sessaoId } })
  }

  /** A escola liberou o provedor? Então manda o navegador a ele, com o login em andamento (e o que a intenção prende) no cookie cifrado. */
  async #aoProvedor(provedor: ProvedorExterno, slug: string, escolaId: string, prende: Pick<LoginExternoEmAndamento, 'acessoDaSalaId' | 'ligarAoAluno'>): Promise<Redirect> {
    const liberado = await naEscolaSemUsuario({ escolaId }, () => new ContaExternalRepository(this.dependencias.banco).provedorLiberado(provedor))
    if (!liberado) throw new DomainException(ErrorCode.NAO_ENCONTRADO)

    try {
      const inicio = await this.dependencias.provedor.iniciar(provedor, prende.ligarAoAluno !== undefined)
      const emAndamento: LoginExternoEmAndamento = { escolaId, slug, provedor, state: inicio.state, nonce: inicio.nonce, verificador: inicio.verificador, ...prende }
      return { endereco: inicio.endereco.href, cookies: [this.dependencias.cookie.gravar(emAndamento)] }
    } catch (erro) {
      if (!(erro instanceof ExternalProviderError)) throw erro
      this.#resultados.add(1, { resultado: 'provedor' })
      return { endereco: prende.ligarAoAluno === undefined ? enderecoDaFalha(slug, 'provedor') : enderecoDaLigacao('provedor'), cookies: [] }
    }
  }

  /**
   * O navegador voltou do provedor. `consulta` é a query que chegou (`?code=...&state=...` ou `?error=...`); o
   * `slug`, se vier, é ignorado.
   */
  async retorno(consulta: string, origem: RequestOrigin): Promise<Redirect> {
    const { cookie, retorno } = this.dependencias
    const apagar = cookie.apagar()
    const emAndamento = cookie.ler(lerCookie(origem.cabecalhoCookie, COOKIE_OIDC))
    if (emAndamento === undefined || retorno === undefined) return this.#falhaDoProvedor(undefined, apagar)
    const parametros = new URLSearchParams(consulta)
    if (parametros.has('error')) return this.#falhaDoProvedor(emAndamento, apagar)

    return naEscolaSemUsuario({ escolaId: emAndamento.escolaId }, async () => {
      let contaNoProvedor: ContaNoProvedor
      try {
        contaNoProvedor = await this.dependencias.provedor.concluir(emAndamento.provedor, new URL(`${CAMINHO_DO_RETORNO}?${parametros.toString()}`, retorno), emAndamento)
      } catch (erro) {
        if (!(erro instanceof ExternalProviderError)) throw erro
        return this.#falhaDoProvedor(emAndamento, apagar)
      }
      if (emAndamento.ligarAoAluno !== undefined) return this.#ligarAoAluno(emAndamento.escolaId, emAndamento.ligarAoAluno, contaNoProvedor, apagar)
      const decisao = await this.#decidir(emAndamento.escolaId, contaNoProvedor, emAndamento.acessoDaSalaId)
      if (decisao.tipo === 'provada') {
        const provada = this.dependencias.cookieDaConta.gravar(decisao.conta)
        this.#resultados.add(1, { resultado: 'conta_provada' })
        return { endereco: enderecoDaSala(emAndamento.slug), cookies: [apagar, provada] }
      }
      if (decisao.tipo !== 'entrar') {
        await new RegistroDeAcessoRepository(this.dependencias.banco).gravarFalha(ipParaRegistro(origem.ip))
        this.#resultados.add(1, { resultado: 'recusado' })
        return { endereco: enderecoDaFalha(emAndamento.slug, decisao.tipo === 'suspenso' ? 'acesso_suspenso' : 'conta_externa_nao_ligada'), cookies: [apagar] }
      }
      const entrada = await this.dependencias.conclusao.entrarPorContaExterna({ usuarioId: decisao.ligacao.usuarioId, escolaId: emAndamento.escolaId }, decisao.ligacao.contaId, origem)
      this.#resultados.add(1, { resultado: 'entrou' })
      return { endereco: DESTINO_DEPOIS_DE_ENTRAR, cookies: [apagar, ...entrada.cookies] }
    })
  }

  /** A queda do provedor: a tela da escola, ou "Eu" do aluno que ligava a conta, onde ele já está entrado. */
  #falhaDoProvedor(emAndamento: LoginExternoEmAndamento | undefined, apagar: string): Redirect {
    this.#resultados.add(1, { resultado: 'provedor' })
    return { endereco: emAndamento?.ligarAoAluno === undefined ? enderecoDaFalha(emAndamento?.slug, 'provedor') : enderecoDaLigacao('provedor'), cookies: [apagar] }
  }

  /**
   * A volta do `intencao=ligar` (15.0): liga a conta ao aluno que a pediu, ou diz por que não. Nada de login aqui: não abre sessão, não grava `login_falho` e não olha o e-mail. O
   * domínio ou o tenant precisa estar liberado pela escola, como no login. Numa transação, trava a linha do usuário (a mesma da geração da senha provisória e da aprovação com conta) e
   * **só então** confere que o aluno e a sessão em que a ligação nasceu ainda valem: a provisória gerada antes encerrou as sessões, e a ligação que esperava a trava não liga. O banco
   * decide o resto, pelos índices únicos: a conta ligada a outro aluno, ou o aluno que já tem outra conta, dão `conflito`, sem dizer a quem; a mesma conta já ligada a ele é `ligada`,
   * sem segundo registro. A auditoria `conta_externa.ligada` tem o aluno como autor, na mesma transação.
   */
  async #ligarAoAluno(escolaId: string, aluno: NonNullable<LoginExternoEmAndamento['ligarAoAluno']>, conta: ContaNoProvedor, apagar: string): Promise<Redirect> {
    const resultado = await this.#resultadoDaLigacao(escolaId, aluno, conta)
    this.#resultados.add(1, { resultado: `ligacao_${resultado}` })
    return { endereco: enderecoDaLigacao(resultado), cookies: [apagar] }
  }

  async #resultadoDaLigacao(escolaId: string, aluno: NonNullable<LoginExternoEmAndamento['ligarAoAluno']>, conta: ContaNoProvedor): Promise<ResultadoDoRetornoDaLigacao> {
    if (conta.dominio === undefined || (conta.provedor === 'microsoft' && conta.dominio === TENANT_DE_CONTA_PESSOAL_MICROSOFT)) return 'recusada'
    if (conta.autenticadaEm !== undefined && conta.autenticadaEm < Date.now() / 1_000 - IDADE_MAXIMA_DA_AUTENTICACAO_S) return 'recusada'
    if (!(await new ContaExternalRepository(this.dependencias.banco).dominioLiberado(conta.provedor, conta.dominio))) return 'recusada'

    const chave: ChaveDaContaExterna = { provedor: conta.provedor, tenant: conta.tenant, sujeito: conta.sujeito }
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    return runInContext({ requisicaoId, escolaId, usuarioId: aluno.usuarioId }, () =>
      this.dependencias.banco.transaction(async (tx): Promise<ResultadoDoRetornoDaLigacao> => {
        const repositorio = new ContaExternalRepository(tx)
        if (!(await repositorio.travarAlunoDaSessao(aluno.usuarioId, aluno.sessaoId))) return 'recusada'
        const ligacaoId = await repositorio.ligar(aluno.usuarioId, chave)
        if (ligacaoId !== undefined) {
          await this.#auditoria.gravar(tx, 'conta_externa.ligada', { entidadeId: ligacaoId, depois: { usuarioId: aluno.usuarioId, provedor: chave.provedor } })
          return 'ligada'
        }
        // O banco recusou: ou esta mesma conta já é dele (clique duplo, outra aba), ou ela é de outro aluno, ou ele já tem outra conta. Só a primeira é `ligada`.
        const relida = await repositorio.ligacao(chave)
        return relida?.usuarioId === aluno.usuarioId ? 'ligada' : 'conflito'
      }),
    )
  }

  /** Entra ou recusa, na escola do contexto (a do cookie). Com `acessoDaSalaId` (a intenção de reivindicar), a conta sem ligação vira `provada` e nada se liga. */
  async #decidir(escolaId: string, conta: ContaNoProvedor, acessoDaSalaId: string | undefined): Promise<Decisao> {
    const repositorio = new ContaExternalRepository(this.dependencias.banco)
    if (conta.dominio === undefined || (conta.provedor === 'microsoft' && conta.dominio === TENANT_DE_CONTA_PESSOAL_MICROSOFT)) return RECUSA
    if (!(await repositorio.dominioLiberado(conta.provedor, conta.dominio))) return RECUSA

    const chave: ChaveDaContaExterna = { provedor: conta.provedor, tenant: conta.tenant, sujeito: conta.sujeito }
    const ligada = await repositorio.ligacao(chave)
    if (ligada !== undefined) {
      if (!ligada.ativo) return RECUSA
      // A conta do provedor está certa e a eliminação, agendada: é só agora, e só para quem provou a conta, que a resposta
      // diz que o acesso está suspenso (14.0).
      return entrarSeNaoSuspensa(ligada)
    }

    // Para o pedido do nome, a conta de domínio liberado e sem ligação só é provada: ninguém é ligado aqui, a aprovação humana é que liga (D4).
    if (acessoDaSalaId !== undefined) return { tipo: 'provada', conta: { escolaId, acessoId: acessoDaSalaId, ...chave } }

    // Sem ligação, só o professor, pelo e-mail verificado. No Google, `email_verified`; na Microsoft, o tenant já
    // conferido contra a lista da escola é o que dá o e-mail por bom (Tech Spec, seção 5).
    const emailValido = conta.provedor === 'microsoft' || conta.emailVerificado
    if (conta.email === undefined || !emailValido) return RECUSA
    const professor = await repositorio.professorPeloEmail(conta.email)
    if (professor === undefined) return RECUSA
    // O professor com a eliminação agendada não é ligado agora: o cancelamento devolve o acesso, e a ligação vem no login seguinte.
    if (professor.suspenso) return SUSPENSO

    if (!professor.jaLigado && (await this.#ligar(escolaId, professor.usuarioId, chave))) return { tipo: 'entrar', ligacao: professor }
    // Já ligado, ou o banco recusou a ligação: ou outro retorno do mesmo professor ligou esta mesma conta um instante
    // antes (entre a leitura da ligação, lá em cima, e esta), e ele entra; ou o professor tem outra conta externa, e
    // esta é recusada.
    const relida = await repositorio.ligacao(chave)
    if (relida?.ativo !== true || relida.usuarioId !== professor.usuarioId) return RECUSA
    return entrarSeNaoSuspensa(relida)
  }

  /**
   * Liga a conta ao professor, com a auditoria `conta_externa.ligada` na mesma transação, num contexto com o próprio
   * professor como autor: é ele quem provou a conta. `false` se um índice único recusou a ligação.
   */
  async #ligar(escolaId: string, usuarioId: string, chave: ChaveDaContaExterna): Promise<boolean> {
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    return runInContext({ requisicaoId, escolaId, usuarioId }, () =>
      this.dependencias.banco.transaction(async (tx) => {
        const ligacaoId = await new ContaExternalRepository(tx).ligar(usuarioId, chave)
        if (ligacaoId === undefined) return false
        await this.#auditoria.gravar(tx, 'conta_externa.ligada', { entidadeId: ligacaoId, depois: { usuarioId, provedor: chave.provedor } })
        return true
      }),
    )
  }
}
