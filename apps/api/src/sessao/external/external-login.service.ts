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
import { ErrorCode, PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO, TENANT_DE_CONTA_PESSOAL_MICROSOFT, type FalhaDoLoginExterno } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { ConclusaoDeLogin } from '../completion/login-completion.js'
import { lerCookie } from '../../credencial/cookies.js'
import { naEscolaSemUsuario } from '../tenant/escola-sem-usuario.js'
import { ipParaRegistro, type OrigemDaRequisicao } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import type { ResolucaoDeTenantRepository } from '../tenant/tenant-resolution.repository.js'
import { CAMINHO_DO_RETORNO } from '../../credencial/external-login-config.js'
import { ContaExternaRepository, type ChaveDaContaExterna, type LigacaoDaContaExterna } from './conta-externa.repository.js'
import { COOKIE_OIDC, type CookieOidc, type LoginExternoEmAndamento } from './cookie-oidc.js'
import { ProvedorExternoFalhou, type ContaNoProvedor, type ProvedorExternoPort } from './external-provider.port.js'

/** O redirecionamento que o controller devolve: o `Location` e os `Set-Cookie`. */
export interface Redirecionamento {
  readonly endereco: string
  readonly cookies: readonly string[]
}

export interface DependenciasDoLoginExterno {
  readonly banco: Database
  readonly resolucao: ResolucaoDeTenantRepository
  readonly provedor: ProvedorExternoPort
  readonly cookie: CookieOidc
  readonly conclusao: ConclusaoDeLogin
  /** O `redirect_uri` configurado: o retorno é remontado sobre ele, com a query que chegou. */
  readonly retorno: URL | undefined
  readonly medidor: Meter
}

/** Para onde a web vai depois de entrar: a casca, que renova a sessão pelo cookie e lê `/v1/eu` (18.0). */
export const DESTINO_DEPOIS_DE_ENTRAR = '/'

/** O endereço da escola na web com a falha, que a tela `/e/:slug` mostra (19.0). */
export function enderecoDaFalha(slug: string | undefined, falha: FalhaDoLoginExterno): string {
  const consulta = `?${PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO}=${falha}`
  return slug === undefined ? `/${consulta}` : `/e/${encodeURIComponent(slug)}${consulta}`
}

type Decisao =
  | { readonly tipo: 'entrar'; readonly ligacao: Pick<LigacaoDaContaExterna, 'usuarioId' | 'contaId'> }
  | { readonly tipo: 'recusar' }
  /** A conta do provedor está certa e a pessoa tem a eliminação agendada (14.0): sem sessão e sem ligar nada. */
  | { readonly tipo: 'suspenso' }

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
 * - **Provedor:** `error` no retorno, prazo de 5 s, resposta que não confere ou cookie ausente dão `?falha=provedor`.
 *   O login por matrícula e por e-mail não passa por aqui, e continua.
 * - **Nada de pessoa guardado:** o e-mail do provedor só é comparado, na memória desta requisição; nome, foto, tokens e
 *   claims nem saem do adaptador. Nada disso vai ao log, a uma exceção, à auditoria ou ao banco.
 */
export class LoginExterno {
  readonly #auditoria = new AuditoriaRecorder()
  readonly #resultados: ReturnType<Meter['createCounter']>

  constructor(private readonly dependencias: DependenciasDoLoginExterno) {
    this.#resultados = dependencias.medidor.createCounter(METRICS.loginExterno, { description: 'Retornos do login pela conta da escola, por resultado' })
  }

  /** Os provedores que a configuração ligou (a lista de `GET /v1/escolas/:slug/acesso` se limita a eles). */
  get ligados(): readonly ProvedorExterno[] {
    return this.dependencias.provedor.ligados
  }

  /** O contrato exige o `provedor` e o `slug` já validados pelo `ZodValidationPipe` do controller: outro chamador tem de conferir o formato antes. */
  async iniciar(provedor: ProvedorExterno, slug: string): Promise<Redirecionamento> {
    if (!this.ligados.includes(provedor)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const escolaId = await this.dependencias.resolucao.escolaPorSlug(slug)
    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const liberado = await naEscolaSemUsuario({ escolaId }, () => new ContaExternaRepository(this.dependencias.banco).provedorLiberado(provedor))
    if (!liberado) throw new DomainException(ErrorCode.NAO_ENCONTRADO)

    try {
      const inicio = await this.dependencias.provedor.iniciar(provedor)
      const emAndamento: LoginExternoEmAndamento = { escolaId, slug, provedor, state: inicio.state, nonce: inicio.nonce, verificador: inicio.verificador }
      return { endereco: inicio.endereco.href, cookies: [this.dependencias.cookie.gravar(emAndamento)] }
    } catch (erro) {
      if (!(erro instanceof ProvedorExternoFalhou)) throw erro
      this.#resultados.add(1, { resultado: 'provedor' })
      return { endereco: enderecoDaFalha(slug, 'provedor'), cookies: [] }
    }
  }

  /**
   * O navegador voltou do provedor. `consulta` é a query que chegou (`?code=...&state=...` ou `?error=...`); o
   * `slug`, se vier, é ignorado.
   */
  async retorno(consulta: string, origem: OrigemDaRequisicao): Promise<Redirecionamento> {
    const { cookie, retorno } = this.dependencias
    const apagar = cookie.apagar()
    const emAndamento = cookie.ler(lerCookie(origem.cabecalhoCookie, COOKIE_OIDC))
    if (emAndamento === undefined || retorno === undefined) return this.#falhaDoProvedor(undefined, apagar)
    const parametros = new URLSearchParams(consulta)
    if (parametros.has('error')) return this.#falhaDoProvedor(emAndamento.slug, apagar)

    return naEscolaSemUsuario({ escolaId: emAndamento.escolaId }, async () => {
      let contaNoProvedor: ContaNoProvedor
      try {
        contaNoProvedor = await this.dependencias.provedor.concluir(emAndamento.provedor, new URL(`${CAMINHO_DO_RETORNO}?${parametros.toString()}`, retorno), emAndamento)
      } catch (erro) {
        if (!(erro instanceof ProvedorExternoFalhou)) throw erro
        return this.#falhaDoProvedor(emAndamento.slug, apagar)
      }
      const decisao = await this.#decidir(emAndamento.escolaId, contaNoProvedor)
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

  #falhaDoProvedor(slug: string | undefined, apagar: string): Redirecionamento {
    this.#resultados.add(1, { resultado: 'provedor' })
    return { endereco: enderecoDaFalha(slug, 'provedor'), cookies: [apagar] }
  }

  /** Entra ou recusa, na escola do contexto (a do cookie). */
  async #decidir(escolaId: string, conta: ContaNoProvedor): Promise<Decisao> {
    const repositorio = new ContaExternaRepository(this.dependencias.banco)
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
        const ligacaoId = await new ContaExternaRepository(tx).ligar(usuarioId, chave)
        if (ligacaoId === undefined) return false
        await this.#auditoria.gravar(tx, 'conta_externa.ligada', { entidadeId: ligacaoId, depois: { usuarioId, provedor: chave.provedor } })
        return true
      }),
    )
  }
}
