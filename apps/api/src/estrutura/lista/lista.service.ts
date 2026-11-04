import { DomainException, AuditoriaRecorder, type Database } from '@educa/core'
import {
  ErrorCode,
  nomeDaListaSchema,
  listaDaTurmaResponseSchema,
  type GravarListaRequest,
  type GravarPlanilhaResponse,
  type ListaDaTurmaQuery,
  type NomeDaLista,
  type NomeAvulsoRequest,
  type PreviaDaPlanilhaResponse,
  type TextoDaListaRequest,
  type ListaDaTurmaResponse,
} from '@educa/shared'
import { paginar } from '../../http/pagination.js'
import { ImportacaoService } from '../importacao/importacao.service.js'
import { lerTextoDaLista } from './lista-reader.js'
import { ListaRepository, TurmaRepository } from '@educa/core/estrutura'

const registro = new AuditoriaRecorder()

/**
 * A lista de nomes da turma pela coordenação (A1, 2.0, RF4 e RF5; Tech Spec da A1, seções 4 e 7). Todas as rotas são só
 * da coordenação (células `unidade` e, na leitura, `nominal_auditado`), e alcançam a turma do ano em curso da escola da
 * sessão; a de outro ano, de outra escola ou inexistente responde `NAO_ENCONTRADO`, e nada é gravado. A prévia e a gravação do
 * texto seguem a planilha de alunos (F2, 8.0): o mesmo motor, o mesmo teto (3.000 linhas, 512 KB), o mesmo job, e a gravação
 * responde 202. O nome avulso, a retirada e a leitura seguem na hora.
 *
 * Nada disto loga: nome, matrícula e o texto da lista nunca vão a log, e o erro sai pelo filtro global só com ids. A
 * auditoria leva ids e contagens.
 */
export class ListaService {
  constructor(
    private readonly banco: Database,
    private readonly importacoes: ImportacaoService,
  ) {}

  /**
   * `POST /v1/turmas/:id/lista/previa`: o que aconteceria com cada linha se a lista fosse gravada, sem gravar nada, com o contrato
   * da importação (F2, 8.0): as linhas, as contagens e os candidatos a marca. O texto acima do teto (3.000 linhas, 512 KB)
   * responde `ENTRADA_INVALIDA` antes de procurar a turma; a turma de outro ano, de outra escola ou inexistente, `NAO_ENCONTRADO`.
   */
  previa(turmaId: string, { texto }: TextoDaListaRequest): Promise<PreviaDaPlanilhaResponse> {
    return this.importacoes.previaDaLista(turmaId, texto, lerTextoDaLista(texto))
  }

  /**
   * `POST /v1/turmas/:id/lista`: grava a lista como a planilha de alunos, pelo job `estrutura.gravar-planilha` (F2, 8.0): responde
   * 202 com o id da importação, que se acompanha por `GET /v1/importacoes/:id`. Linha com erro é `ENTRADA_INVALIDA`; a turma
   * conferida na escola e no ano, como na prévia. A matrícula que a escola já tem passa a ser "já existe", "nome corrigido" ou "muda
   * de turma" (candidato a marca), e não mais `CONFLITO`.
   */
  gravar(turmaId: string, { texto, marcas }: GravarListaRequest): Promise<GravarPlanilhaResponse> {
    return this.importacoes.gravarDaLista(turmaId, texto, marcas, lerTextoDaLista(texto))
  }

  /**
   * `POST /v1/turmas/:id/lista/nome`: o nome avulso (o aluno que chega em maio), `livre`, com `lista.gravada` na mesma
   * transação. O ano e a turma travam como na gravação (10.0, C10; C9). A matrícula na lista de qualquer turma da
   * escola neste ano (o índice único), ou de um aluno da escola (`credencial_matricula`, porque o aprovado sai da lista
   * sem matrícula): `CONFLITO`, e nada é gravado.
   *
   * A credencial é conferida **depois** do `insert` (8.0, C12): a aprovação da mesma matrícula tira a matrícula da lista
   * e a grava na credencial num commit só. O `insert` que chega no meio dela espera o commit no índice único e, depois
   * dele, entra; a conferência, num comando novo, já acha a credencial, e a transação volta atrás. Conferida antes do
   * `insert`, ela não acharia a credencial ainda sem commit, e a lista ganharia um nome livre com a matrícula do aprovado.
   */
  async acrescentar(turmaId: string, pedido: NomeAvulsoRequest): Promise<NomeDaLista> {
    const criado = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if (!(await turmas.travarAnoEmCurso()) || !(await turmas.travarContraExclusao(turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const lista = new ListaRepository(tx)
      const gravado = await lista.inserir(turmaId, pedido)
      if ((await lista.comCredencial([pedido.matricula])).length > 0) throw new DomainException(ErrorCode.CONFLITO)
      await registro.gravar(tx, 'lista.gravada', { entidadeId: turmaId, depois: { ids: [gravado.id], gravados: 1, jaExistentes: 0 } })
      return gravado
    })
    return nomeDaListaSchema.parse(criado)
  }

  /**
   * `DELETE /v1/lista-nomes/:id`: retira o nome `livre`, que sai de fato, com `lista_nome.retirado` na mesma transação.
   * O reivindicado e o aprovado não saem por aqui: `CONFLITO`. O nome de outro ano, de outra escola ou inexistente:
   * `NAO_ENCONTRADO`.
   */
  async retirar(id: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const lista = new ListaRepository(tx)
      const retirado = await lista.retirarLivre(id)
      if (retirado === undefined) throw new DomainException((await lista.existe(id)) ? ErrorCode.CONFLITO : ErrorCode.NAO_ENCONTRADO)
      await registro.gravar(tx, 'lista_nome.retirado', { entidadeId: id, antes: { turmaId: retirado.turmaId, estado: 'livre' } })
    })
  }

  /**
   * `GET /v1/turmas/:id/lista` (regra 20, itens 4 e 10): uma página dos nomes da turma, com a matrícula. A rota é só da
   * coordenação, pela célula `nominal_auditado`: a finalidade é obrigatória no contrato, que o controller confere antes
   * de chegar aqui, então a falta dela responde igual para qualquer id. A leitura grava `turma.lista_lida` na mesma
   * transação, a cada leitura: sem registro, sem lista.
   */
  async ler(turmaId: string, consulta: ListaDaTurmaQuery): Promise<ListaDaTurmaResponse> {
    const { finalidade } = consulta
    const pagina = await this.banco.transaction(async (tx) => {
      if ((await new TurmaRepository(tx).aberta(turmaId, 'unidade')) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const cortada = paginar(await new ListaRepository(tx).pagina(turmaId, consulta), consulta.limite)
      await registro.gravar(tx, 'turma.lista_lida', { entidadeId: turmaId, depois: { quantidade: cortada.itens.length }, finalidade })
      return cortada
    })
    return listaDaTurmaResponseSchema.parse(pagina)
  }
}
