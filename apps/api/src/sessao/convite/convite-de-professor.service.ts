import { DomainException, estadoDoProfessor, AuditoriaRecorder, systemClock, type Database, type Clock } from '@educa/core'
import { ErrorCode, REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO, REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO, type CadastrarProfessorRequest } from '@educa/shared'
import { ConviteRepository } from './convite.repository.js'
import { convidar, expiraEmDo, refazerSobATrava, tokenNovo } from './convite.service.js'

/**
 * Os casos de uso do convite de professor pela coordenação da escola (A1, tarefa 3.0, RF6): cadastrar, refazer e
 * revogar. Moram em `sessao` porque o cadastro alcança a conta global (`contaParaConvite`), e reusam o corpo comum do
 * convite de `convite.service.ts` (`convidar`, `refazerSobATrava`), sem copiar. Tudo no contexto da sessão: a escola e o
 * autor vêm dele, nunca do corpo.
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
 * convite da escola como primeira instrução (a mesma do operador e do aceite), o corpo comum de `convidar` com o papel
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
    const { conviteId, usuarioId } = await convidar(tx, convites, 'professor', pedido, token, expiraEm)
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
