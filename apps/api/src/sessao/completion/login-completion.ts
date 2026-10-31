import { currentContext, DURACAO_DA_SESSAO_HORAS, DomainException, runInContext, type Environment, type Database, type TokenIssuer, type MetodoDeSessao } from '@educa/core'
import { ErrorCode, InvariantException, type EtapaComDesafio, type LoginResponse } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { MAX_AGE_DO_COOKIE_DISPOSITIVO_SEGUNDOS, type DeviceCookie } from '../../credencial/device-cookie.js'
import { DEVICE_COOKIE, SESSAO_COOKIE, lerCookie, serializarCookie } from '../../credencial/cookies.js'
import { SessaoCreateRepository } from '../../credencial/sessao-create.repository.js'
import type { ChallengeIssuer, SessaoDeOrigemDaTroca } from '../../credencial/challenge.js'
import { BYTES_DO_REFRESH, hashDoRefresh } from '../../credencial/login-identifiers.js'
import { ipParaRegistro, type RequestOrigin, type ResultadoDoLogin } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import type { TenantResolutionRepository, UsuarioAtivoDaConta } from '../tenant/tenant-resolution.repository.js'
import { SessaoDeOrigemRepository } from '../../credencial/sessao-de-origem.repository.js'

export interface LoginCompletionDependencies {
  readonly banco: Database
  readonly dispositivo: DeviceCookie
  readonly emissorDeToken: TokenIssuer
  readonly emissorDeDesafio: ChallengeIssuer
  readonly ambiente: Environment
  /** Só para a etapa `escolher`: os acessos da conta que a tela lista (20.0). */
  readonly resolucao: TenantResolutionRepository
}

/** O que a etapa que acabou de passar sabe da pessoa: a conta, o e-mail dela (só para o HMAC do cookie) e os usuários ativos. */
export interface CredencialConferida {
  readonly contaId: string
  readonly email: string
  readonly usuarios: readonly UsuarioAtivoDaConta[]
  readonly mfaAtivo: boolean
  /** Se o segundo fator já foi cumprido nesta entrada. */
  readonly mfaCumprido: boolean
}

/**
 * O fim de cada etapa do login da equipe (Tech Spec, seção 5, "Etapas"), usado pela senha (4.0) e pelo segundo fator
 * (6.0): decide a próxima etapa e, só em `pronta`, grava a sessão, o registro de acesso e os dois cookies. O aluno que
 * entra por matrícula (11.0) vai direto a `pronta`, pelo mesmo caminho.
 *
 * - **Sem cookie antes do fim:** nas etapas com desafio não sai `educa_sessao` nem `educa_dispositivo`. Quem tem só a
 *   senha de um coordenador não ganha a marca de navegador conhecido sem o segundo fator.
 * - **`educa_dispositivo` em `pronta`:** a entrada da conta no topo, com a data de agora.
 */
export class ConclusaoDeLogin {
  constructor(private readonly dependencias: LoginCompletionDependencies) {}

  async concluir(credencial: CredencialConferida, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    const etapa = etapaDoLogin(credencial.usuarios, credencial.mfaAtivo, credencial.mfaCumprido)
    if (etapa !== 'pronta') {
      const desafio = await this.dependencias.emissorDeDesafio.emitir({ contaId: credencial.contaId, etapa, mfaCumprido: credencial.mfaCumprido })
      // `escolher` leva a lista de acessos (20.0): é o que a tela mostra, e o `usuarioId` que ela devolve a
      // `POST /v1/sessao/escola` não existe em nenhum outro lugar ao alcance do cliente. São os mesmos campos do
      // `/v1/eu.acessos`, da mesma conta que acabou de provar a senha.
      if (etapa === 'escolher') return { resposta: { etapa, desafio, acessos: await this.dependencias.resolucao.acessosDaConta(credencial.contaId) }, cookies: [] }
      return { resposta: { etapa, desafio }, cookies: [] }
    }
    const [unico] = credencial.usuarios
    if (unico === undefined) throw new InvariantException('etapa pronta sem usuário')
    return this.#pronta(unico, credencial.contaId, 'email', credencial.email, origem)
  }

  /**
   * O aluno que provou matrícula e senha (11.0): tem um usuário só, sem conta e sem segundo fator, e vai direto a
   * `pronta`, com sessão de método `matricula`. A entrada do `educa_dispositivo` é a de `escola_id|matricula`.
   */
  entrarComoAluno(aluno: Pick<UsuarioAtivoDaConta, 'usuarioId' | 'escolaId'>, identificadorDoDispositivo: string, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    return this.#pronta(aluno, null, 'matricula', identificadorDoDispositivo, origem)
  }

  /**
   * A entrada no usuário escolhido de uma conta, depois de `escolher` ou na troca de escola (12.0), já com o segundo
   * fator cumprido quando o destino é a coordenação: grava a sessão de e-mail no destino, com família nova, e devolve
   * `pronta` com os dois cookies. Com `troca`, encerra a sessão de origem na mesma transação, com motivo
   * `troca_de_escola`; se ela já não estava aberta (saída, outra troca que chegou antes), nada é gravado e a resposta é
   * `NAO_AUTENTICADO`.
   */
  entrarNoDestino(
    destino: Pick<UsuarioAtivoDaConta, 'usuarioId' | 'escolaId'>,
    contaId: string,
    email: string,
    troca: SessaoDeOrigemDaTroca | undefined,
    origem: RequestOrigin,
  ): Promise<ResultadoDoLogin> {
    return this.#pronta(destino, contaId, 'email', email, origem, troca)
  }

  /**
   * Quem entrou pela conta Google ou Microsoft da escola (13.0): o professor ligado, com a conta dele, ou o aluno
   * ligado, sem conta. Vai direto a `pronta`, com sessão de método `externo`, na escola da ligação: a troca de escola
   * não vale para ela (12.0). Sem `educa_dispositivo`: ele só dá prioridade ao login por senha, que esta entrada não usa.
   */
  entrarPorContaExterna(usuario: Pick<UsuarioAtivoDaConta, 'usuarioId' | 'escolaId'>, contaId: string | null, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    return this.#pronta(usuario, contaId, 'externo', undefined, origem)
  }

  /**
   * Grava a sessão e devolve `pronta` com o token e os cookies: a entrada do dispositivo no topo (quando a entrada foi
   * por senha), e o refresh.
   */
  async #pronta(
    usuario: Pick<UsuarioAtivoDaConta, 'usuarioId' | 'escolaId'>,
    contaId: string | null,
    metodo: MetodoDeSessao,
    identificadorDoDispositivo: string | undefined,
    origem: RequestOrigin,
    troca?: SessaoDeOrigemDaTroca,
  ): Promise<ResultadoDoLogin> {
    const { token, expiraEm, refresh } = await this.#criarSessao(usuario, contaId, metodo, origem.ip, troca)
    const resposta: LoginResponse = { etapa: 'pronta', token, expiraEm: expiraEm.toISOString() }
    const dispositivo =
      identificadorDoDispositivo === undefined
        ? []
        : [
            serializarCookie(DEVICE_COOKIE, this.dependencias.dispositivo.comEntrada(lerCookie(origem.cabecalhoCookie, DEVICE_COOKIE), identificadorDoDispositivo), {
              ambiente: this.dependencias.ambiente,
              maxAgeSegundos: MAX_AGE_DO_COOKIE_DISPOSITIVO_SEGUNDOS,
            }),
          ]
    return { resposta, cookies: [...dispositivo, serializarCookie(SESSAO_COOKIE, refresh, { ambiente: this.dependencias.ambiente })] }
  }

  /**
   * A etapa `mfa` para a conta com MFA ativo que trouxe o bilhete de um convite aceito (7.0): o usuário do convite só é
   * ativado depois do código, e por isso o desafio, com o convite, vem antes de qualquer outra etapa. Sem cookie.
   */
  async pedirSegundoFator(contaId: string, conviteId: string): Promise<ResultadoDoLogin> {
    const desafio = await this.dependencias.emissorDeDesafio.emitir({ contaId, etapa: 'mfa', mfaCumprido: false, conviteId })
    return { resposta: { etapa: 'mfa', desafio }, cookies: [] }
  }

  /**
   * Grava a sessão e o registro de acesso na escola do usuário, numa transação, num contexto que tem só a escola:
   * a criação lê a escola do contexto, e a FK composta recusa usuário de outra escola.
   *
   * Na troca de escola, a sessão de origem é encerrada primeiro, na mesma transação e num contexto com a escola dela: o
   * `update` condicional trava a linha, e a segunda troca com a mesma origem, relendo, não a acha aberta e desfaz tudo.
   * A `saida` da origem vai ao registro de acesso da escola de origem, e o `login` ao do destino, cada um só com o
   * usuário da própria escola.
   */
  async #criarSessao(
    usuario: Pick<UsuarioAtivoDaConta, 'usuarioId' | 'escolaId'>,
    contaId: string | null,
    metodo: MetodoDeSessao,
    ip: string,
    troca?: SessaoDeOrigemDaTroca,
  ): Promise<{ token: string; expiraEm: Date; refresh: string }> {
    const refresh = randomBytes(BYTES_DO_REFRESH).toString('base64url')
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    const sessaoId = await runInContext({ requisicaoId, escolaId: usuario.escolaId }, () =>
      this.dependencias.banco.transaction(async (tx) => {
        if (troca !== undefined) {
          // A saída da origem fica no registro de acesso da escola de origem, só com o usuário de lá (17.5): a sessão
          // sai em 30 dias pelo expurgo, e o registro dura os 6 meses do Marco Civil.
          const saiu =
            contaId !== null &&
            (await runInContext({ requisicaoId, escolaId: troca.escolaId }, async () => {
              const usuarioDaOrigem = await new SessaoDeOrigemRepository(tx).encerrarParaTroca(troca.sessaoId, contaId)
              if (usuarioDaOrigem === undefined) return false
              await new RegistroDeAcessoRepository(tx).gravar('saida', usuarioDaOrigem, ipParaRegistro(ip))
              return true
            }))
          if (!saiu) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
        }
        const [criada] = await new SessaoCreateRepository(tx).criarSessoes([
          { usuarioId: usuario.usuarioId, contaId, metodo, refreshHash: hashDoRefresh(refresh), duracaoHoras: DURACAO_DA_SESSAO_HORAS },
        ])
        if (criada === undefined) throw new InvariantException('sessão não criada')
        await new RegistroDeAcessoRepository(tx).gravar('login', usuario.usuarioId, ipParaRegistro(ip))
        return criada.id
      }),
    )
    const { token, expiraEm } = await this.dependencias.emissorDeToken.emitir({ escolaId: usuario.escolaId, usuarioId: usuario.usuarioId, sessaoId })
    return { token, expiraEm, refresh }
  }
}

/**
 * A etapa depois da credencial certa (Tech Spec, seção 5, "Etapas"): mais de um usuário ativo, `escolher`; um só
 * coordenador, o segundo fator (`mfa`, ou `configurar_mfa` quando ainda não tem), a menos que ele já tenha sido
 * cumprido nesta entrada; um só professor, `pronta`.
 */
export function etapaDoLogin(usuarios: readonly Pick<UsuarioAtivoDaConta, 'papel'>[], mfaAtivo: boolean, mfaCumprido = false): EtapaComDesafio | 'pronta' {
  if (usuarios.length > 1) return 'escolher'
  if (usuarios[0]?.papel === 'coordenador' && !mfaCumprido) return mfaAtivo ? 'mfa' : 'configurar_mfa'
  return 'pronta'
}
