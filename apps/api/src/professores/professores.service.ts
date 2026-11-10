import { estadoDoProfessor, systemClock, type Clock, type Database } from '@educa/core'
import {
  conviteDeProfessorResponseSchema,
  enviarConvitesResponseSchema,
  listaDeProfessoresResponseSchema,
  type PaginationQuery,
  type CadastrarProfessorRequest,
  type ConviteDeProfessorResponse,
  type CorrigirEmailDoProfessorRequest,
  type EnviarConvitesRequest,
  type EnviarConvitesResponse,
  type ListaDeProfessoresResponse,
} from '@educa/shared'
import { paginarPor } from '../http/pagination.js'
import { cadastrarProfessor, corrigirEmailDoProfessor, enviarConvitesDeProfessores, refazerConviteDeProfessor, revogarConviteDeProfessor, type EnvioDeConvites } from '../sessao/index.js'
import { ProfessoresRepository } from './professores.repository.js'

/**
 * Os professores da escola pela coordenação (A1, tarefa 3.0, RF6): cadastrar, listar, e refazer e revogar o convite. A
 * escrita é o caso de uso do convite de professor, em `sessao/convite/convite-de-professor.service.ts` (`cadastrarProfessor`,
 * `refazerConviteDeProfessor`, `revogarConviteDeProfessor`), que é quem alcança a conta global; aqui ficam a lista e os
 * contratos de saída.
 *
 * - O token sai só na resposta do cadastro e do refazer, pelo contrato estrito; a lista não o traz, nem o link, nem o
 *   e-mail, nem nada que diga se a conta do e-mail já existia (E8, E11).
 * - O "Enviar convites" (acesso-e-convites, tarefa 3.0) também é caso de uso do `sessao`, e a cota, a cifra e a fila chegam pelo módulo.
 * - A lista não audita: são professores da escola, não aluno, e o nome é o que a própria coordenação digitou.
 * - Nada disto loga: o nome, o e-mail e o token nunca vão a log, e o erro sai pelo filtro global só com ids.
 */
export class ProfessoresService {
  constructor(
    private readonly banco: Database,
    private readonly envio: EnvioDeConvites,
    private readonly relogio: Clock = systemClock,
  ) {}

  async cadastrar(pedido: CadastrarProfessorRequest): Promise<ConviteDeProfessorResponse> {
    return conviteDeProfessorResponseSchema.parse(await cadastrarProfessor(this.banco, pedido))
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeProfessoresResponse> {
    const lidos = await new ProfessoresRepository(this.banco).pagina(consulta)
    const pagina = paginarPor(lidos, consulta.limite, (lido) => lido.usuarioId)
    return listaDeProfessoresResponseSchema.parse({
      ...pagina,
      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? (lido.enviadoEm?.toISOString() ?? null) : null })),
    })
  }

  /** O "Enviar convites": refaz o convite de quem o espera, com canal `email`, e enfileira o envio (cota de 300/h por escola). A resposta é a contagem, e o e-mail sai depois, pelo worker. */
  async enviarConvites(pedido: EnviarConvitesRequest): Promise<EnviarConvitesResponse> {
    return enviarConvitesResponseSchema.parse(await enviarConvitesDeProfessores(this.banco, this.envio, pedido, this.relogio))
  }

  async refazerConvite(usuarioId: string): Promise<ConviteDeProfessorResponse> {
    return conviteDeProfessorResponseSchema.parse(await refazerConviteDeProfessor(this.banco, usuarioId))
  }

  /** O "Corrigir o e-mail": o professor que nunca entrou passa à conta do e-mail certo, com o mesmo id, e ganha convite novo (caso de uso do `sessao`, que alcança a conta global). */
  async corrigirEmail(usuarioId: string, pedido: CorrigirEmailDoProfessorRequest): Promise<ConviteDeProfessorResponse> {
    return conviteDeProfessorResponseSchema.parse(await corrigirEmailDoProfessor(this.banco, usuarioId, pedido, this.relogio))
  }

  async revogarConvite(usuarioId: string): Promise<void> {
    await revogarConviteDeProfessor(this.banco, usuarioId)
  }
}
