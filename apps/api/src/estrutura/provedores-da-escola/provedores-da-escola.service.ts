import { currentContext, DomainException, AuditoriaRecorder, type Database } from '@educa/nucleo'
import { ErrorCode, provedoresDaEscolaResponseSchema, type ProvedoresDaEscolaRequest, type ProvedoresDaEscolaResponse } from '@educa/shared'
import { ProvedoresLiberadosRepository, type ProvedorLiberado } from './provedores-liberados.repository.js'

/** Os ids liberados por provedor, como a auditoria `escola.provedores_alterados` os guarda. */
function idsPorProvedor(linhas: readonly ProvedorLiberado[]): { google: string[]; microsoft: string[] } {
  return {
    google: linhas.filter((linha) => linha.provedor === 'google').map((linha) => linha.id),
    microsoft: linhas.filter((linha) => linha.provedor === 'microsoft').map((linha) => linha.id),
  }
}

const chaveDe = (item: { provedor: string; valor: string }): string => `${item.provedor}|${item.valor}`

/**
 * A coordenação troca a lista de domínios Google (`hd`) e tenants Microsoft (`tid`) liberados para o login pela conta
 * da escola (RF8; Tech Spec, seção 4). A lista pedida substitui a atual, numa transação, com a escola travada: o que
 * saiu ganha `removido_em`, o que entrou é inserido, e o que ficou mantém o id. Grava a auditoria
 * `escola.provedores_alterados` com os ids antes e depois (regra 20, item 10: alteração de permissão). Vale no login
 * seguinte, que lê a lista a cada retorno. A escola vem da sessão.
 */
export class ProvedoresDaEscolaService {
  readonly #auditoria = new AuditoriaRecorder()

  constructor(private readonly banco: Database) {}

  async alterar(pedido: ProvedoresDaEscolaRequest): Promise<ProvedoresDaEscolaResponse> {
    const escolaId = currentContext()?.escolaId
    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    const depois = await this.banco.transaction(async (tx) => {
      const repositorio = new ProvedoresLiberadosRepository(tx)
      if (!(await repositorio.travarEscola())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const antes = await repositorio.liberados()
      const pedidas = new Set(pedido.provedores.map(chaveDe))
      const atuais = new Set(antes.map(chaveDe))
      await repositorio.retirar(antes.filter((linha) => !pedidas.has(chaveDe(linha))).map((linha) => linha.id))
      await repositorio.liberar(pedido.provedores.filter((item) => !atuais.has(chaveDe(item))))
      const gravados = await repositorio.liberados()
      await this.#auditoria.gravar(tx, 'escola.provedores_alterados', { entidadeId: escolaId, antes: idsPorProvedor(antes), depois: idsPorProvedor(gravados) })
      return gravados
    })
    return provedoresDaEscolaResponseSchema.parse({ provedores: depois.map((linha) => ({ provedor: linha.provedor, valor: linha.valor })) })
  }
}
