import { DomainException, AuditoriaRecorder, type Database } from '@educa/core'
import { CicloDeVidaRepository } from '@educa/core/ciclo-de-vida'
import { Logger } from '@nestjs/common'
import {
  ErrorCode,
  InvariantException,
  listaDeVinculosResponseSchema,
  meusVinculosResponseSchema,
  vinculoResponseSchema,
  vinculoDaCoordenacaoResponseSchema,
  ESTADOS_EM_DECISAO,
  type PaginationQuery,
  type VinculosQuery,
  type EstadoDeVinculo,
  type ContestarVinculoRequest,
  type CriarVinculoRequest,
  type EncerrarVinculoRequest,
  type ListaDeVinculosResponse,
  type MeusVinculosResponse,
  type VinculoResponse,
  type VinculoDaCoordenacaoResponse,
  type Vinculo,
  type VinculoDaCoordenacao,
} from '@educa/shared'
import { DisciplinaRepository } from '../disciplina/disciplina.repository.js'
import { paginar } from '../../http/pagination.js'
import { TurmaRepository } from '../turma/turma.repository.js'
import { VinculoRepository, type Decisao, type VinculoLido } from './vinculo.repository.js'

const registro = new AuditoriaRecorder()

const emDecisao = (estado: EstadoDeVinculo): estado is (typeof ESTADOS_EM_DECISAO)[number] => (ESTADOS_EM_DECISAO as readonly EstadoDeVinculo[]).includes(estado)

/** O vínculo como o professor dono o vê: sem o `complemento`, que é só da coordenação (Tech Spec, seção 7). */
function doProfessor(lido: VinculoLido): Vinculo {
  return {
    id: lido.id,
    turma: lido.turma,
    ...(lido.disciplina === null ? {} : { disciplina: lido.disciplina }),
    estado: lido.estado,
    ...(lido.contestacao === null ? {} : { contestacao: lido.contestacao }),
    ...(lido.decididoEm === null ? {} : { decididoEm: lido.decididoEm.toISOString() }),
  }
}

/** O vínculo como a coordenação o vê: de quem é, o papel, o `complemento` e o motivo do encerramento. */
function daCoordenacao(lido: VinculoLido): VinculoDaCoordenacao {
  return {
    ...doProfessor(lido),
    usuarioId: lido.usuarioId,
    papel: lido.papel,
    ...(lido.complemento === null ? {} : { complemento: lido.complemento }),
    ...(lido.motivoEncerramento === null ? {} : { motivoEncerramento: lido.motivoEncerramento }),
  }
}

/**
 * O vínculo pessoa × turma × disciplina do ano letivo em curso (RF3 a RF5, RF19; regra 60, item 8a). Toda operação
 * falha fechada sem ano em curso (Tech Spec, seção 5, "Requisição"), e toda escrita grava a auditoria na mesma
 * transação (regra 20, item 10).
 *
 * - **Criar** (coordenação): a turma do ano em curso, o professor alocável da escola (`VinculoRepository.professorAlocavel`:
 *   o convite em aberto e dentro do prazo, o `aceito` e o `ativo`; A1, 13.0) e a disciplina da escola, ou
 *   `NAO_ENCONTRADO`, igual para o id de outra escola e o inexistente. Nasce `pendente`, e só alcança a turma depois de o
 *   professor aceitar o convite, entrar e confirmar. O repetido, mesmo em dois pedidos simultâneos, dá `CONFLITO` pelo
 *   índice único.
 * - **Confirmar e contestar** (professor dono): o vínculo de outro professor, de outra escola ou inexistente dá
 *   `NAO_ENCONTRADO`. Só a partir de `pendente` ou `contestado`. Confirmar de novo o que já está confirmado responde o
 *   vínculo como está, sem gravar nada (o segundo clique); o resto dá `CONFLITO`.
 * - **Encerrar** (coordenação): `desligamento` ou `realocacao`. O acesso cai na requisição seguinte, porque a leitura
 *   da turma junta o vínculo a cada vez. Encerrar de novo responde o vínculo como está. Se era o último vínculo
 *   confirmado do professor na turma, o acesso da turma (link e código da sala) que ele gerou é revogado na mesma
 *   transação, com `acesso_turma.revogado` (correção 2026-10-03-acesso-sobrevive-ao-vinculo; regra 20, item 18).
 */
export class VinculoService {
  /** Só o nome do evento: escola, usuário e requisição vêm do contexto, e o complemento nunca vai a log (regra 20, item 9). */
  readonly #logger = new Logger('vinculo')

  constructor(private readonly banco: Database) {}

  async criar(pedido: CriarVinculoRequest): Promise<VinculoDaCoordenacaoResponse> {
    const turmaId = pedido.turmaId.toLowerCase()
    const usuarioId = pedido.usuarioId.toLowerCase()
    const disciplinaId = pedido.disciplinaId?.toLowerCase() ?? null
    const criado = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      const vinculos = new VinculoRepository(tx)
      // O ano em curso travado em `FOR SHARE`: o encerramento do ano espera o vínculo nascer, e o que chega depois não nasce.
      if (!(await turmas.travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if ((await turmas.aberta(turmaId, 'unidade')) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // A guarda confere o papel de professor, o único que a coordenação cria (`PAPEIS_DE_VINCULO_PELA_COORDENACAO`):
      // outro papel naquela lista pede outra guarda aqui.
      if (!(await vinculos.professorAlocavel(usuarioId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (disciplinaId !== null && (await new DisciplinaRepository(tx).porId(disciplinaId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const id = await vinculos.criar({ usuarioId, turmaId, disciplinaId, papel: pedido.papel })
      await registro.gravar(tx, 'vinculo.criado', { entidadeId: id, depois: { usuarioId, turmaId, disciplinaId, papel: pedido.papel, estado: 'pendente' } })
      return this.#lido(vinculos.porId(id))
    })
    this.#logger.log('vinculo.criado')
    return vinculoDaCoordenacaoResponseSchema.parse(daCoordenacao(criado))
  }

  async listar(consulta: VinculosQuery): Promise<ListaDeVinculosResponse> {
    const linhas = await new VinculoRepository(this.banco).listar(consulta)
    const pagina = paginar(linhas, consulta.limite)
    return listaDeVinculosResponseSchema.parse({ ...pagina, itens: pagina.itens.map(daCoordenacao) })
  }

  async meus(consulta: PaginationQuery): Promise<MeusVinculosResponse> {
    const linhas = await new VinculoRepository(this.banco).listarDoUsuario(consulta)
    const pagina = paginar(linhas, consulta.limite)
    return meusVinculosResponseSchema.parse({ ...pagina, itens: pagina.itens.map(doProfessor) })
  }

  confirmar(id: string): Promise<VinculoResponse> {
    return this.#decidir(id, { estado: 'confirmado' })
  }

  contestar(id: string, pedido: ContestarVinculoRequest): Promise<VinculoResponse> {
    return this.#decidir(id, { estado: 'contestado', contestacao: pedido.contestacao, complemento: pedido.complemento ?? null })
  }

  async encerrar(id: string, pedido: EncerrarVinculoRequest): Promise<VinculoDaCoordenacaoResponse> {
    const encerrado = await this.banco.transaction(async (tx) => {
      const vinculos = new VinculoRepository(tx)
      // A turma travada antes do vínculo, na ordem do excluir e da eliminação (turma → vínculo): o gerar do professor que
      // está no meio termina primeiro, e o acesso dele cai abaixo; o que chega depois espera, reconfere o vínculo e sai
      // `NAO_ENCONTRADO`. O vínculo é relido com a trava: o estado lido aqui pode ter mudado na espera.
      const turmaId = await vinculos.turmaDe(id)
      if (turmaId === undefined || !(await new TurmaRepository(tx).travarContraOGerar(turmaId, 'no key update'))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const antes = await vinculos.travar(id, { doUsuario: false })
      if (antes === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (antes.estado !== 'encerrado') {
        if (!(await vinculos.encerrar(id, pedido.motivo))) throw new DomainException(ErrorCode.CONFLITO)
        await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: antes.estado }, depois: { estado: 'encerrado', motivo: pedido.motivo } })
        const revogados = await new CicloDeVidaRepository(tx).revogarDeQuemSaiu(antes.usuarioId, antes.turmaId)
        for (const revogado of revogados) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId } })
        this.#logger.log('vinculo.encerrado')
      }
      return this.#lido(vinculos.porId(id))
    })
    return vinculoDaCoordenacaoResponseSchema.parse(daCoordenacao(encerrado))
  }

  async #decidir(id: string, decisao: Decisao): Promise<VinculoResponse> {
    const decidido = await this.banco.transaction(async (tx) => {
      const vinculos = new VinculoRepository(tx)
      const travado = await vinculos.travar(id, { doUsuario: true })
      if (travado === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const antes = travado.estado
      // Contestar só sai de `pendente` ou `contestado`: o vínculo confirmado, o único que gera acesso, nunca é contestado,
      // e a decisão não tem acesso a revogar.
      if (!emDecisao(antes)) {
        if (antes === 'confirmado' && decisao.estado === 'confirmado') return this.#lido(vinculos.porIdDoUsuario(id))
        throw new DomainException(ErrorCode.CONFLITO)
      }
      if (!(await vinculos.decidir(id, decisao))) throw new DomainException(ErrorCode.CONFLITO)
      if (decisao.estado === 'confirmado') {
        await registro.gravar(tx, 'vinculo.confirmado', { entidadeId: id, antes: { estado: antes }, depois: { estado: 'confirmado' } })
        this.#logger.log('vinculo.confirmado')
      } else {
        // Só o código: o complemento nunca vai à auditoria nem ao log (Tech Spec, seção 7).
        await registro.gravar(tx, 'vinculo.contestado', { entidadeId: id, antes: { estado: antes }, depois: { estado: 'contestado', contestacao: decisao.contestacao } })
        this.#logger.log('vinculo.contestado')
      }
      return this.#lido(vinculos.porIdDoUsuario(id))
    })
    return vinculoResponseSchema.parse(doProfessor(decidido))
  }

  async #lido(leitura: Promise<VinculoLido | undefined>): Promise<VinculoLido> {
    const lido = await leitura
    if (lido === undefined) throw new InvariantException('vínculo lido na mesma transação não encontrado')
    return lido
  }
}
