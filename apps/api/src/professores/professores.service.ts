import { estadoDoProfessor, type Database } from '@educa/nucleo'
import {
  conviteDeProfessorResponseSchema,
  listaDeProfessoresResponseSchema,
  type PaginationQuery,
  type CadastrarProfessorRequest,
  type ConviteDeProfessorResponse,
  type ListaDeProfessoresResponse,
} from '@educa/shared'
import { paginarPor } from '../http/paginacao.js'
import { cadastrarProfessor, refazerConviteDeProfessor, revogarConviteDeProfessor } from '../sessao/index.js'
import { ProfessoresRepository } from './professores.repository.js'

/**
 * Os professores da escola pela coordenação (A1, tarefa 3.0, RF6): cadastrar, listar, e refazer e revogar o convite. A
 * escrita é o caso de uso do convite de professor, em `sessao/convite/convite-de-professor.service.ts` (`cadastrarProfessor`,
 * `refazerConviteDeProfessor`, `revogarConviteDeProfessor`), que é quem alcança a conta global; aqui ficam a lista e os
 * contratos de saída.
 *
 * - O token sai só na resposta do cadastro e do refazer, pelo contrato estrito; a lista não o traz, nem o link, nem o
 *   e-mail, nem nada que diga se a conta do e-mail já existia (E8, E11).
 * - A lista não audita: são professores da escola, não aluno, e o nome é o que a própria coordenação digitou.
 * - Nada disto loga: o nome, o e-mail e o token nunca vão a log, e o erro sai pelo filtro global só com ids.
 */
export class ProfessoresService {
  constructor(private readonly banco: Database) {}

  async cadastrar(pedido: CadastrarProfessorRequest): Promise<ConviteDeProfessorResponse> {
    return conviteDeProfessorResponseSchema.parse(await cadastrarProfessor(this.banco, pedido))
  }

  async listar(consulta: PaginationQuery): Promise<ListaDeProfessoresResponse> {
    const lidos = await new ProfessoresRepository(this.banco).pagina(consulta)
    const pagina = paginarPor(lidos, consulta.limite, (lido) => lido.usuarioId)
    return listaDeProfessoresResponseSchema.parse({
      ...pagina,
      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido) })),
    })
  }

  async refazerConvite(usuarioId: string): Promise<ConviteDeProfessorResponse> {
    return conviteDeProfessorResponseSchema.parse(await refazerConviteDeProfessor(this.banco, usuarioId))
  }

  async revogarConvite(usuarioId: string): Promise<void> {
    await revogarConviteDeProfessor(this.banco, usuarioId)
  }
}
