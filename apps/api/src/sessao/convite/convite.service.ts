import {
  contextoAtual,
  ErroDeDominio,
  estadoDaCoordenacao,
  executarNoContexto,
  RegistroDeAuditoria,
  relogioDoSistema,
  VALIDADE_DO_CONVITE_HORAS_POR_TIPO,
  type Banco,
  type Relogio,
  type TipoDeConvite,
  type TransacaoBanco,
} from '@educa/nucleo'
import {
  ErrorCode,
  GERAR_CONVITE_POR_ESTADO,
  REFAZER_CONVITE_POR_ESTADO,
  REVOGAR_CONVITE_POR_ESTADO,
  type EstadoDaCoordenacao,
  type AceitarConviteRequest,
  type AceitarConviteResponse,
  type ConsultarConviteResponse,
} from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import type { BilheteDeConvite } from './bilhete-de-convite.js'
import { ConviteRepository } from './convite.repository.js'
import type { EmissorDeDesafio } from '../../credencial/desafio.js'
import { BYTES_DO_TOKEN_DE_CONVITE, hashDoToken } from '../../credencial/hash-do-token.js'
import type { HashDeSenha } from '../../credencial/hash-de-senha.js'
import { normalizarEmail } from '../../credencial/identificadores-do-login.js'
import { ResolucaoDeTenantRepository, type UsuarioComConviteAceito } from '../tenant/resolucao-de-tenant.repository.js'
import type { ConferenciaDoAutor } from '../conferencia-do-autor.js'

const registro = new RegistroDeAuditoria()

/** Expirado, revogado, usado e inexistente: a mesma resposta, que não diz se o convite existe (regra 10, item 6). */
const conviteInvalido = () => new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)

/** O token novo do link: 256 bits sorteados. O banco guarda só o SHA-256. */
export const tokenNovo = (): string => randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')

/** Até quando vale o convite do tipo gerado agora: 72 h o do coordenador, 7 dias o do professor (`@educa/shared`). */
export const expiraEmDo = (tipo: TipoDeConvite, relogio: Relogio): Date => new Date(relogio.agora().getTime() + VALIDADE_DO_CONVITE_HORAS_POR_TIPO[tipo] * 60 * 60 * 1_000)

export interface DependenciasDoConvite {
  readonly banco: Banco
  readonly resolucao: ResolucaoDeTenantRepository
  readonly hash: HashDeSenha
  readonly emissorDeDesafio: EmissorDeDesafio
  readonly bilhetes: BilheteDeConvite
}

/**
 * As rotas anônimas do convite do primeiro coordenador (RF1, RF12; Tech Spec, seção 5, "Convite"), com o token sempre
 * no corpo.
 *
 * - **Consultar:** só o nome da escola que convida.
 * - **Aceitar, conta sem senha:** exige a senha, grava o hash, ativa o usuário, grava `convite.aceito` e responde, sem
 *   sessão e sem cookie: o convite de coordenador, `configurar_mfa` com o desafio (o aceite não pula o MFA); o de
 *   professor, `entrar` com o bilhete, e a entrada por e-mail e senha termina em `pronta`, sem segundo fator (A1, tarefa
 *   3.0; `etapaDoLogin`).
 * - **Aceitar, conta com senha** (a pessoa trabalha em outra escola cliente): a senha que vier é ignorada, o convite é
 *   marcado como usado e a resposta é `entrar`, com o bilhete do convite (30 min). O usuário desta escola só é ativado
 *   quando a pessoa entra com a senha e o segundo fator que a conta já tem **e** com esse bilhete
 *   (`AtivacaoPorConvite`): o login rotineiro da conta, sem o link, nunca ativa. O link nunca troca a senha de uma
 *   conta existente.
 * - **Uso único no banco:** o aceite é o `update … where usado_em is null and revogado_em is null and expira_em > now()`,
 *   e a senha só é gravada `where senha_hash is null`, na mesma transação.
 * - **Sob a trava da escola** (Tech Spec da A0b, seção 7c, "Ativação por convite"): a primeira instrução da transação é
 *   a trava do convite da escola, a mesma do gerar, do refazer e do revogar do operador, antes de o aceite prender a
 *   linha do convite. Na outra ordem, o aceite seguraria a linha esperando a trava, e o refazer seguraria a trava
 *   esperando a linha (40P01). Quem chega depois lê o que o outro gravou: o aceite depois de um refazer ou revogar não
 *   acha o convite e responde como convite inválido; o refazer ou revogar depois de um aceite lê o estado novo e recebe
 *   `CONFLITO`. O aceite que não ativa o usuário desfaz tudo e responde como convite inválido, nunca 500. A espera na
 *   trava além do `statement_timeout` é o 503 `TEMPO_ESGOTADO`, sem nada gravado.
 */
export class ConviteService {
  constructor(private readonly dependencias: DependenciasDoConvite) {}

  async consultar(token: string): Promise<ConsultarConviteResponse> {
    const valido = await this.dependencias.resolucao.conviteValidoPorHash(hashDoToken(token))
    if (valido === undefined) throw conviteInvalido()
    const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
    const escolaNome = await executarNoContexto({ requisicaoId, escolaId: valido.escolaId }, () => new ConviteRepository(this.dependencias.banco).nomeDaEscola())
    if (escolaNome === undefined) throw conviteInvalido()
    return { escolaNome }
  }

  async aceitar(pedido: AceitarConviteRequest): Promise<AceitarConviteResponse> {
    const { banco, resolucao, hash, emissorDeDesafio, bilhetes } = this.dependencias
    const tokenHash = hashDoToken(pedido.token)
    const valido = await resolucao.conviteValidoPorHash(tokenHash)
    if (valido === undefined) throw conviteInvalido()
    if (!valido.contaTemSenha && pedido.senha === undefined) throw new ErroDeDominio(ErrorCode.ENTRADA_INVALIDA)
    // O hash sai antes da transação, para ela não segurar a linha do convite durante o argon2.
    const senhaHash = !valido.contaTemSenha && pedido.senha !== undefined ? await hash.gerar(pedido.senha) : undefined
    const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()

    // A escola da trava é a do convite lido pelo hash: o `token_hash` é único, e o `update` abaixo acha o mesmo convite.
    const aceite = await executarNoContexto({ requisicaoId, escolaId: valido.escolaId }, () =>
      banco.transaction(async (tx) => {
        // A trava da escola primeiro, antes de prender a linha do convite: ver o docblock.
        await new ConviteRepository(tx).travarEscola()
        const resolucaoNaTransacao = new ResolucaoDeTenantRepository(tx)
        const usado = await resolucaoNaTransacao.usarConvitePorHash(tokenHash)
        if (usado === undefined) return undefined
        // Se outro convite da mesma conta definiu a senha entre a leitura e aqui, esta não é gravada: vale o caminho da
        // conta que já tem senha.
        const senhaDefinida = senhaHash !== undefined && (await resolucaoNaTransacao.definirSenhaNoAceite(valido.contaId, senhaHash))
        await executarNoContexto({ requisicaoId, escolaId: usado.escolaId, usuarioId: usado.usuarioId }, async () => {
          // O usuário que não ativa desfaz o uso do convite e a senha: a resposta é a de convite inválido.
          if (senhaDefinida && !(await new ConviteRepository(tx).ativarPorConvite(usado.usuarioId, usado.id))) throw conviteInvalido()
          await registro.gravar(tx, 'convite.aceito', { entidadeId: usado.id, depois: { tipo: valido.tipo, usuarioId: usado.usuarioId, usuarioAtivo: senhaDefinida } })
        })
        return { senhaDefinida, conviteId: usado.id }
      }),
    )
    if (aceite === undefined) throw conviteInvalido()
    // O coordenador com a conta nova vai direto ao MFA; o professor, e quem já tinha senha, vão à entrada com o bilhete.
    if (aceite.senhaDefinida && valido.tipo === 'coordenador') {
      return { etapa: 'configurar_mfa', desafio: await emissorDeDesafio.emitir({ contaId: valido.contaId, etapa: 'configurar_mfa', mfaCumprido: false }) }
    }
    return { etapa: 'entrar', bilhete: await bilhetes.emitir({ contaId: valido.contaId, conviteId: aceite.conviteId }) }
  }
}

/**
 * A ativação, no login por e-mail, do usuário que espera o convite aceito pela conta que já tinha senha (Tech Spec,
 * seção 5, "Etapas"). Precisa das duas coisas juntas:
 * - o bilhete que o aceite devolveu, conferido e da mesma conta que acabou de provar a senha: quem aceitou o link é
 *   quem entrou. Sem ele, ou com o bilhete de outra conta, nada é ativado;
 * - a credencial inteira: a senha, e o segundo fator quando a conta tem MFA (o `LoginService` leva essa conta a `mfa`
 *   com o convite no desafio, e quem ativa é o `MfaService`, depois do código).
 *
 * O usuário é ativado na escola dele, numa transação com `usuario.ativado_por_convite`, e dois logins ao mesmo tempo
 * ativam uma vez. A primeira instrução da transação é a trava do convite da escola (Tech Spec da A0b, seção 7c): entre a
 * ativação e o gerar do operador, que revoga o convite aceito, só um vence. Quem perde é a ativação que acha o convite
 * já revogado, e aí `ativar` não grava nada; o login decide o que responder pelos usuários ativos da conta (seção 5).
 */
export class AtivacaoPorConvite {
  constructor(
    private readonly banco: Banco,
    private readonly bilhetes: BilheteDeConvite,
  ) {}

  /**
   * O convite do bilhete, se o bilhete vale e é desta conta; senão, `undefined`, e o login segue como se ele não tivesse
   * vindo. O convite pode já não ativar ninguém (revogado): quem diz é `pendenteDoConvite`, e depois `ativar`.
   */
  async conviteDoBilhete(bilhete: string | undefined, contaId: string): Promise<string | undefined> {
    if (bilhete === undefined) return undefined
    const verificado = await this.bilhetes.verificar(bilhete)
    return verificado?.contaId === contaId ? verificado.conviteId : undefined
  }

  /** O usuário da conta que espera este convite, pelo id que veio no desafio `mfa` assinado por nós. Sem aluno. */
  async pendenteDoConvite(contaId: string, conviteId: string): Promise<UsuarioComConviteAceito | undefined> {
    const pendente = await new ResolucaoDeTenantRepository(this.banco).usuarioComConviteAceito(contaId, conviteId)
    return pendente?.papel === 'aluno' ? undefined : pendente
  }

  /** Ativa o usuário pelo convite, sob a trava da escola, se o convite ainda o ativa. */
  async ativar(pendente: UsuarioComConviteAceito): Promise<void> {
    const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
    await executarNoContexto({ requisicaoId, escolaId: pendente.escolaId, usuarioId: pendente.usuarioId }, () =>
      this.banco.transaction(async (tx) => {
        const convites = new ConviteRepository(tx)
        await convites.travarEscola()
        if (!(await convites.ativarPorConvite(pendente.usuarioId, pendente.conviteId))) return
        await registro.gravar(tx, 'usuario.ativado_por_convite', { entidadeId: pendente.usuarioId, depois: { conviteId: pendente.conviteId } })
      }),
    )
  }
}

/**
 * O pedido do operador, já conferido: a escola (pelo endereço, no `ops:convite-coordenador`; pelo id do caminho, no
 * painel), o e-mail e o nome da coordenadora convidada.
 */
export type PedidoDeConvite = { readonly email: string; readonly nome: string } & ({ readonly slug: string } | { readonly escolaId: string })

/**
 * Pega a trava do convite da escola do contexto e só então lê o estado da coordenação (seção 7c, "Convite da escola").
 * Escola inexistente: `NAO_ENCONTRADO`, antes de qualquer escrita.
 */
async function coordenacaoSobATrava(convites: ConviteRepository): Promise<{ estado: EstadoDaCoordenacao; ultimoConviteId: string | undefined }> {
  await convites.travarEscola()
  const dados = await convites.dadosDaCoordenacao()
  if (dados === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
  return { estado: estadoDaCoordenacao(dados), ultimoConviteId: dados.ultimoConvite?.id }
}

/**
 * O corpo comum de quem convida (A0b; A1, tarefa 3.0), dentro da transação de quem chama, na escola do contexto e depois
 * da trava dela: acha ou cria a conta do e-mail (conta nova nasce sem senha), acha ou cria o usuário do papel do
 * convite, inativo até o aceite (`usuarioConvidado`), e grava o convite com o SHA-256 do token. Usuário do papel já
 * ativo na escola, ou com convite em aberto (o índice `convite_pendente_unico`): `CONFLITO`, e a transação volta atrás.
 * Devolve o convite, o usuário e se a conta é nova, que só o convite do coordenador leva à auditoria.
 */
export async function convidar(
  tx: TransacaoBanco,
  convites: ConviteRepository,
  tipo: TipoDeConvite,
  pessoa: { readonly email: string; readonly nome: string },
  token: string,
  expiraEm: Date,
): Promise<{ conviteId: string; usuarioId: string; contaNova: boolean }> {
  const conta = await new ResolucaoDeTenantRepository(tx).contaParaConvite(normalizarEmail(pessoa.email))
  const usuarioId = await convites.usuarioConvidado(conta.id, pessoa.nome, tipo)
  if (usuarioId === undefined) throw new ErroDeDominio(ErrorCode.CONFLITO)
  const conviteId = await convites.criarConvite({ tipo, tokenHash: hashDoToken(token), usuarioId, expiraEm })
  return { conviteId, usuarioId, contaNova: conta.nova }
}

/**
 * O refazer comum (A0b; A1, tarefa 3.0), depois da trava da escola e da matriz de quem chama: revoga o convite de origem
 * pelo `update` condicional (só em aberto e só do tipo) e cria outro para o **mesmo usuário**, com `convite.refeito`
 * (o tipo, a origem, o usuário e a validade). Se o `update` não revoga (o convite deixou de estar em aberto no meio),
 * `CONFLITO`.
 */
export async function refazerSobATrava(
  tx: TransacaoBanco,
  convites: ConviteRepository,
  tipo: TipoDeConvite,
  origemId: string,
  token: string,
  expiraEm: Date,
  autorOperador?: string,
): Promise<{ conviteId: string; usuarioId: string }> {
  const usuarioId = await convites.revogarParaRefazer(origemId, tipo)
  if (usuarioId === undefined) throw new ErroDeDominio(ErrorCode.CONFLITO)
  const conviteId = await convites.criarConvite({ tipo, tokenHash: hashDoToken(token), usuarioId, expiraEm })
  const depois = { tipo, origemId, usuarioId, expiraEm: expiraEm.toISOString() }
  await registro.gravar(tx, 'convite.refeito', autorOperador === undefined ? { entidadeId: conviteId, depois } : { entidadeId: conviteId, depois, autorOperador })
  return { conviteId, usuarioId }
}

/**
 * O convite da primeira coordenação, pelo operador: pelo painel (`POST /v1/operacao/escolas/:id/convite-coordenacao`) e
 * pelo `ops:convite-coordenador`, o mesmo caso de uso (RF2; Tech Spec da A0b, seção 5). Numa transação:
 * - o autor é conferido como primeira instrução (`ConferenciaDoAutor`), antes de ler a escola do endereço;
 * - no contexto da escola, pega a trava dela e lê o estado da coordenação; a matriz (`GERAR_CONVITE_POR_ESTADO`, de
 *   `@educa/shared`, a mesma pela qual a lista do painel mostra as ações) decide:
 *   - `sem_convite`, `revogado`: cria;
 *   - `aceito`, `sem_coordenacao`: revoga o último convite, com `convite.revogado` dele na auditoria (no `aceito`, o aceite
 *     anterior deixa de ativar; no `sem_coordenacao`, o convite já usado é revogado só como registro), e cria;
 *   - `pendente`, `vencido`, `ativa`: `CONFLITO`, sem gravar nada. Com convite em aberto, o caminho é refazer, ou
 *     revogar e gerar;
 * - acha ou cria a conta pelo e-mail (conta nova nasce sem senha) e o coordenador dela, inativo até o aceite; com o mesmo
 *   e-mail, o usuário é reaproveitado, e só o convite novo o ativa;
 * - grava o convite com o SHA-256 do token, válido por 72 h, e `convite.criado` com o operador e se a conta é nova (sem o
 *   e-mail).
 *
 * Escola inexistente: `NAO_ENCONTRADO`, antes de criar conta ou usuário. Devolve o id do convite e o token: o painel o
 * devolve uma vez na resposta, e o comando o grava num arquivo 0600. Nunca o token, o nome ou o e-mail em log.
 */
export async function criarConviteDeCoordenador(banco: Banco, autor: ConferenciaDoAutor, pedido: PedidoDeConvite, relogio: Relogio = relogioDoSistema): Promise<{ conviteId: string; token: string }> {
  const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
  const token = tokenNovo()
  const expiraEm = expiraEmDo('coordenador', relogio)
  const conviteId = await executarNoContexto({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      // O autor primeiro: quem não passa não lê nem grava nada, nem a escola do endereço.
      const autorOperador = await autor(tx)
      const escolaId = 'slug' in pedido ? await new ResolucaoDeTenantRepository(tx).escolaPorSlug(pedido.slug) : pedido.escolaId
      if (escolaId === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      return executarNoContexto({ requisicaoId, escolaId }, async () => {
        const convites = new ConviteRepository(tx)
        const { estado, ultimoConviteId } = await coordenacaoSobATrava(convites)
        const acao = GERAR_CONVITE_POR_ESTADO[estado]
        if (acao === 'conflito') throw new ErroDeDominio(ErrorCode.CONFLITO)
        if (acao === 'revogar_o_ultimo_e_criar' && ultimoConviteId !== undefined) {
          if (!(await convites.revogar(ultimoConviteId, 'coordenador'))) throw new ErroDeDominio(ErrorCode.CONFLITO)
          await registro.gravar(tx, 'convite.revogado', { entidadeId: ultimoConviteId, depois: { tipo: 'coordenador' }, autorOperador })
        }
        // Sem coordenador ativo na escola (o estado não é `ativa`), o da conta também não está: `convidar` não recusa aqui.
        const { conviteId: criado, usuarioId, contaNova } = await convidar(tx, convites, 'coordenador', pedido, token, expiraEm)
        await registro.gravar(tx, 'convite.criado', { entidadeId: criado, depois: { tipo: 'coordenador', usuarioId, expiraEm: expiraEm.toISOString(), contaNova }, autorOperador })
        return criado
      })
    }),
  )
  return { conviteId, token }
}

/**
 * O refazer do convite da coordenação pelo operador, pelo painel (`POST /v1/operacao/convites/:id/refazer`; RF2; Tech
 * Spec da A0b, seção 5). A escola vem do convite, nunca do argumento, e só convite `tipo = 'coordenador'` é achado. Numa
 * transação, com o autor conferido como primeira instrução, no contexto da escola, com a trava dela, e só então o estado:
 * - convite inexistente ou de outro tipo: `NAO_ENCONTRADO`;
 * - `revogado`, `aceito`, `sem_coordenacao`, `ativa`: `CONFLITO`, sem gravar nada;
 * - convite que não é o último da escola (já refeito, ou em aberto de antes da trava): `CONFLITO` (o convite mudou);
 * - `pendente`, `vencido`: revoga o convite pelo `update` condicional (só em aberto: não usado e não revogado) e cria
 *   outro, válido por 72 h, para o **mesmo usuário**, com `convite.refeito` (a origem, o usuário e a validade). Nome e
 *   e-mail não mudam aqui: corrigem-se revogando e gerando. Se o `update` não revoga (o convite deixou de estar em aberto
 *   no meio), `CONFLITO`.
 *
 * Devolve o convite novo, o token (só nesta resposta; o banco guarda o SHA-256) e a escola, para o log de quem chamou.
 * Nunca o token, o nome ou o e-mail em log.
 */
export async function refazerConviteDaCoordenacao(
  banco: Banco,
  autor: ConferenciaDoAutor,
  conviteId: string,
  relogio: Relogio = relogioDoSistema,
): Promise<{ conviteId: string; token: string; escolaId: string }> {
  const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
  const token = tokenNovo()
  const expiraEm = expiraEmDo('coordenador', relogio)
  return executarNoContexto({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const escolaId = await new ResolucaoDeTenantRepository(tx).escolaDoConviteParaOperador(conviteId)
      if (escolaId === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      const novo = await executarNoContexto({ requisicaoId, escolaId }, async () => {
        const convites = new ConviteRepository(tx)
        const { estado, ultimoConviteId } = await coordenacaoSobATrava(convites)
        if (REFAZER_CONVITE_POR_ESTADO[estado] === 'conflito' || conviteId !== ultimoConviteId) throw new ErroDeDominio(ErrorCode.CONFLITO)
        return (await refazerSobATrava(tx, convites, 'coordenador', conviteId, token, expiraEm, autorOperador)).conviteId
      })
      return { conviteId: novo, token, escolaId }
    }),
  )
}

/**
 * A revogação do convite da coordenação pelo operador: pelo painel (`POST /v1/operacao/convites/:id/revogar`) e pelo
 * `ops:revogar-convite`, o mesmo caso de uso (RF2, RF19; Tech Spec da A0b, seção 5). A escola vem do convite, nunca do
 * argumento, e só convite `tipo = 'coordenador'` é achado. Numa transação, com o autor conferido como primeira
 * instrução, no contexto da escola, com a trava dela, e só então o estado:
 * - convite inexistente, de outro tipo, ou já revogado, e escola em `revogado` (ou em `sem_convite`, que só uma corrida
 *   com o expurgo alcançaria): `NAO_ENCONTRADO`, como no F1;
 * - convite que não é o último da escola: `CONFLITO` (o convite mudou);
 * - `pendente`, `vencido`, `aceito`: revoga, com `convite.revogado`. No `aceito`, o aceite deixa de ativar no login;
 * - `sem_coordenacao`, `ativa`: `CONFLITO`, sem gravar nada.
 *
 * Devolve a escola do convite, para o log de quem chamou.
 */
export async function revogarConvitePeloOperador(banco: Banco, autor: ConferenciaDoAutor, conviteId: string): Promise<{ escolaId: string }> {
  const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
  return executarNoContexto({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const escolaId = await new ResolucaoDeTenantRepository(tx).escolaDoConviteParaOperador(conviteId)
      if (escolaId === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      await executarNoContexto({ requisicaoId, escolaId }, async () => {
        const convites = new ConviteRepository(tx)
        const { estado, ultimoConviteId } = await coordenacaoSobATrava(convites)
        const acao = REVOGAR_CONVITE_POR_ESTADO[estado]
        if (acao === 'nao_encontrado') throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        // Já revogado (por um gerar ou revogar que veio antes na trava): como no F1.
        const jaRevogado = await convites.revogado(conviteId)
        if (jaRevogado === undefined || jaRevogado) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        if (acao === 'conflito') throw new ErroDeDominio(ErrorCode.CONFLITO)
        // Um convite em aberto que não é o último: o convite mudou.
        if (conviteId !== ultimoConviteId) throw new ErroDeDominio(ErrorCode.CONFLITO)
        if (!(await convites.revogar(conviteId, 'coordenador'))) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        await registro.gravar(tx, 'convite.revogado', { entidadeId: conviteId, depois: { tipo: 'coordenador' }, autorOperador })
      })
      return { escolaId }
    }),
  )
}
