import { DomainException, estadoDoProfessor, AuditoriaRecorder, requireEscolaId, retryAfterSeconds, systemClock, type Database, type Clock, type CotaPorHora, type JobOutbox, type PontosGastos, type SecretCipher } from '@educa/core'
import {
  ErrorCode,
  REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO,
  REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO,
  TIPO_ENVIAR_CONVITE,
  type CadastrarProfessorRequest,
  type EnviarConvitesRequest,
  type EnviarConvitesResponse,
} from '@educa/shared'
import { ConviteRepository, type ProfessorParaEnvio } from './convite.repository.js'
import { convidarProfessor, expiraEmDo, refazerSobATrava, tokenNovo } from './convite.service.js'

/**
 * Os casos de uso do convite de professor pela coordenação da escola (A1, tarefa 3.0, RF6): cadastrar, refazer e
 * revogar. Moram em `sessao` e reusam o corpo comum do convite de `convite.service.ts` (`convidarProfessor`,
 * `refazerSobATrava`), sem copiar; a conta do e-mail vem do cadastro do professor, no core (`contaDoProfessor`). Tudo no
 * contexto da sessão: a escola e o autor vêm dele, nunca do corpo.
 */

const registro = new AuditoriaRecorder()

/** O convite do professor que a coordenação acabou de gerar: o usuário dele, o convite e o token, só nesta resposta. */
export interface ConviteDeProfessorGerado {
  readonly usuarioId: string
  readonly conviteId: string
  readonly token: string
}

/**
 * Os dados do professor para o refazer e o revogar, lidos sob a trava da escola, e o estado dele: professor sem convite
 * de professor nenhum, usuário de outro papel, de outra escola ou inexistente dão `NAO_ENCONTRADO` (I7).
 */
async function professorSobATrava(convites: ConviteRepository, usuarioId: string) {
  await convites.travarEscola()
  const dados = await convites.dadosDoProfessor(usuarioId)
  if (dados === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  return { estado: estadoDoProfessor(dados), conviteId: dados.ultimoConvite.id }
}

/**
 * O cadastro do professor pela coordenação da escola (`POST /v1/professores`; A1, tarefa 3.0, RF6; Tech Spec da A1,
 * seção 5, passo 1), no contexto da sessão: a escola e o autor vêm dele, nunca do corpo. Numa transação, com a trava do
 * convite da escola como primeira instrução (a mesma do operador e do aceite), o corpo comum de `convidarProfessor` com o papel
 * `professor` e o convite válido por 7 dias, e a auditoria `professor.cadastrado` (sem campo nenhum) e `convite.criado`
 * (o tipo, o usuário e a validade, sem `contaNova`): nada diz à coordenação se o e-mail tinha conta em outra escola (E11).
 *
 * - o e-mail de um professor ativo na escola, ou com convite em aberto: `CONFLITO`, sem gravar nada. Com convite em
 *   aberto, o caminho é refazer, ou revogar e cadastrar de novo;
 * - o e-mail de um professor inativo (convite revogado, vencido e revogado, aceito sem a primeira entrada, desativado):
 *   o mesmo usuário volta a esperar o convite novo, com o nome digitado agora; o convite antigo já usado deixa de ativar.
 *
 * Devolve o token, que só existe nesta resposta (o banco guarda o SHA-256). Nunca o token, o nome ou o e-mail em log.
 */
export async function cadastrarProfessor(banco: Database, pedido: CadastrarProfessorRequest, relogio: Clock = systemClock): Promise<ConviteDeProfessorGerado> {
  const token = tokenNovo()
  const expiraEm = expiraEmDo('professor', relogio)
  return banco.transaction(async (tx) => {
    const convites = new ConviteRepository(tx)
    await convites.travarEscola()
    const { conviteId, usuarioId } = await convidarProfessor(tx, convites, pedido, token, expiraEm)
    await registro.gravar(tx, 'professor.cadastrado', { entidadeId: usuarioId })
    await registro.gravar(tx, 'convite.criado', { entidadeId: conviteId, depois: { tipo: 'professor', usuarioId, expiraEm: expiraEm.toISOString() } })
    return { usuarioId, conviteId, token }
  })
}

/**
 * O refazer do convite do professor pela coordenação (`POST /v1/professores/:usuarioId/convite/refazer`; A1, RF6). O
 * convite é o último `tipo = 'professor'` do usuário na escola da sessão, lido sob a trava dela, e a matriz
 * `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO` decide: só `pendente` e `vencido` refazem, por `refazerSobATrava`, e o
 * convite novo vale 7 dias; os outros estados são `CONFLITO`, sem gravar nada. O convite de coordenador nunca é
 * alcançado por aqui (I7).
 */
export async function refazerConviteDeProfessor(banco: Database, usuarioId: string, relogio: Clock = systemClock): Promise<ConviteDeProfessorGerado> {
  const token = tokenNovo()
  const expiraEm = expiraEmDo('professor', relogio)
  return banco.transaction(async (tx) => {
    const convites = new ConviteRepository(tx)
    const { estado, conviteId } = await professorSobATrava(convites, usuarioId)
    if (REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estado] === 'conflito') throw new DomainException(ErrorCode.CONFLITO)
    const refeito = await refazerSobATrava(tx, convites, 'professor', conviteId, token, expiraEm)
    return { usuarioId: refeito.usuarioId, conviteId: refeito.conviteId, token }
  })
}

/**
 * A revogação do convite do professor pela coordenação (`POST /v1/professores/:usuarioId/convite/revogar`; A1, RF6). O
 * convite é o último `tipo = 'professor'` do usuário na escola da sessão, lido sob a trava dela, e a matriz
 * `REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO` decide: `pendente` e `vencido` revogam, com `convite.revogado`; `revogado`
 * é `NAO_ENCONTRADO`; os outros, `CONFLITO`, sem gravar nada. O convite de coordenador nunca é alcançado por aqui (I7).
 */
export async function revogarConviteDeProfessor(banco: Database, usuarioId: string): Promise<void> {
  await banco.transaction(async (tx) => {
    const convites = new ConviteRepository(tx)
    const { estado, conviteId } = await professorSobATrava(convites, usuarioId)
    const acao = REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO[estado]
    if (acao === 'nao_encontrado') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (acao === 'conflito') throw new DomainException(ErrorCode.CONFLITO)
    // Sob a trava, o convite em aberto não muda de estado entre a leitura e aqui: o aceite, que o usaria, pega a mesma
    // trava antes. O `update` só não revogaria o convite já revogado.
    if (!(await convites.revogar(conviteId, 'professor'))) throw new DomainException(ErrorCode.CONFLITO)
    await registro.gravar(tx, 'convite.revogado', { entidadeId: conviteId, depois: { tipo: 'professor' } })
  })
}

/** O que o "Enviar convites" usa fora do banco: a cota da escola, a cifra do token e do endereço na fila de envio, e a porta do job. */
export interface EnvioDeConvites {
  readonly cota: Pick<CotaPorHora, 'consumir' | 'devolver'>
  readonly cifra: Pick<SecretCipher, 'cifrar'>
  readonly fila: JobOutbox
}

/**
 * A regra de quem o "Enviar convites" alcança: o professor que a matriz manda refazer (`pendente` e `vencido`, também o copiado e o da planilha ou da grade),
 * com um convite de origem e um endereço na conta. Devolve o endereço e o convite que o refazer revoga, ou `undefined` para quem fica de fora.
 */
function quemEsperaOConvitePorEmail({ email, dados }: ProfessorParaEnvio): { email: string; origemId: string } | undefined {
  return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estadoDoProfessor(dados)] === 'refazer' && dados.ultimoConvite !== undefined && email !== null ? { email, origemId: dados.ultimoConvite.id } : undefined
}

/**
 * O "Enviar convites" da coordenação (`POST /v1/professores/convites/enviar`; acesso-e-convites, tarefa 3.0, RF11, RF17; Tech Spec, seção 5, "Enviar"): refaz o
 * convite de cada professor que o espera, com canal `email`, e põe o envio na fila. Tudo no contexto da sessão: a escola e a autora vêm dele, nunca do corpo.
 *
 * - **Sob a trava da escola**, como o refazer, o revogar e o aceite: dois "Enviar" ao mesmo tempo, ou um "Enviar" e um "Copiar link", decidem um depois do
 *   outro, cada um vendo o que o anterior gravou. O que o primeiro enfileirou e o segundo refez termina `cancelado`: um convite aberto e um e-mail por professor.
 * - **O filtro é o estado do professor**, pela mesma matriz do refazer (`REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`): só `pendente` e `vencido` entram, também o
 *   copiado e o da planilha ou da grade. Aceito, ativo, desativado, revogado, id de outra escola e id que não existe ficam de fora, sem recusa: a resposta é
 *   a contagem do que entrou, e zero não é erro. Sem seleção, são todos os que esperam.
 * - **A cota de 300/h gasta um ponto por convite que entra**, não por item da seleção, de uma vez e atomicamente. Lote que não cabe: `LIMITE_EXCEDIDO` com
 *   `Retry-After`, nada na fila nem na auditoria. A transação que se desfaz depois do gasto devolve os pontos.
 * - **O convite novo carrega o token e o endereço cifrados** (o id da linha é o dado autenticado) e o job só leva o id dele. O envio não acontece na requisição:
 *   a resposta volta com os convites `na_fila`.
 * - **`convite.enviado` é gravado aqui**, um por convite, com a coordenação como autora; o job só muda o `envio`.
 *
 * Não exige ano letivo em curso: o convite é da escola. Nunca o token, o nome ou o e-mail em log.
 */
export async function enviarConvitesDeProfessores(banco: Database, envio: EnvioDeConvites, pedido: EnviarConvitesRequest, relogio: Clock = systemClock): Promise<EnviarConvitesResponse> {
  const escolaId = requireEscolaId()
  const expiraEm = expiraEmDo('professor', relogio)
  let gasto: PontosGastos | undefined
  try {
    return await banco.transaction(async (tx) => {
      const convites = new ConviteRepository(tx)
      await convites.travarEscola()
      const lidos = await convites.professoresParaEnvio(pedido.usuarioIds === undefined ? undefined : [...new Set(pedido.usuarioIds)])
      const entram = lidos.map(quemEsperaOConvitePorEmail).filter((pedido) => pedido !== undefined)
      if (entram.length === 0) return { quantidade: 0 }
      const consumo = await envio.cota.consumir(escolaId, entram.length)
      if (consumo.resultado === 'recusado') throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, retryAfterSeconds(consumo.msAteLiberar))
      gasto = consumo.gasto
      for (const { email, origemId } of entram) {
        const token = tokenNovo()
        const cifrarParaEnvio = (conviteId: string) => ({
          tokenCifrado: envio.cifra.cifrar(Buffer.from(token, 'utf8'), conviteId).cifrado,
          destinoCifrado: envio.cifra.cifrar(Buffer.from(email, 'utf8'), conviteId).cifrado,
        })
        const refeito = await refazerSobATrava(tx, convites, 'professor', origemId, token, expiraEm, undefined, cifrarParaEnvio)
        await envio.fila.enfileirar(tx, TIPO_ENVIAR_CONVITE, { conviteId: refeito.conviteId })
        await registro.gravar(tx, 'convite.enviado', { entidadeId: refeito.conviteId, depois: { tipo: 'professor', canal: 'email' } })
      }
      return { quantidade: entram.length }
    })
  } catch (erro) {
    // A transação se desfez (ou a recusa veio depois do gasto): os pontos que não viraram convite voltam, só na janela em que foram gastos.
    if (gasto !== undefined) await envio.cota.devolver(gasto)
    throw erro
  }
}
