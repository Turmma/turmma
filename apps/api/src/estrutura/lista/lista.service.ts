import { DomainException, AuditoriaRecorder, type Database } from '@educa/core'
import {
  ErrorCode,
  nomeDaListaSchema,
  gravacaoDaListaResponseSchema,
  listaDaTurmaResponseSchema,
  previaDaListaResponseSchema,
  type ListaDaTurmaQuery,
  type ErroDaLinhaDaLista,
  type PreviaRow,
  type NomeDaLista,
  type NomeAvulsoRequest,
  type TextoDaListaRequest,
  type GravacaoDaListaResponse,
  type ListaDaTurmaResponse,
  type PreviaDaListaResponse,
} from '@educa/shared'
import { paginar } from '../../http/pagination.js'
import { errosDasLinhas, lerTextoDaLista, type ParsedRow } from './lista-reader.js'
import { ListaRepository } from './lista.repository.js'
import { TurmaRepository } from '../turma/turma.repository.js'

const registro = new AuditoriaRecorder()

/**
 * O resultado de cada linha contra a lista da escola neste ano e os alunos da escola (A1, 2.0, E4 a E6), na ordem do
 * texto. `errosDoTexto` são os que o texto sozinho já mostra (`errosDasLinhas`), e vencem o que a busca achar.
 *
 * - Na lista desta turma, ou de aluno aprovado nesta turma no ano em curso (8.0, E6), que já não está na lista com a
 *   matrícula: `ja_existe`, pela matrícula (RF5: reenviar acrescenta só o que falta).
 * - Na lista de outra turma da escola neste ano, ou de outro aluno da escola (`credencial_matricula`): `matricula_em_uso`.
 * - O resto: `entra`.
 *
 * A lista é lida **antes** da credencial, cada uma num comando: a aprovação (8.0) tira a matrícula da lista e a grava na
 * credencial num commit só, e o comando da lista, anterior a ele, ainda a acha na lista; o da credencial, posterior, já a
 * acha na credencial. A matrícula que está sendo aprovada nunca sai `entra` (C12).
 */
async function classificar(lista: ListaRepository, turmaId: string, linhas: readonly ParsedRow[], errosDoTexto: ReadonlyArray<ErroDaLinhaDaLista | undefined>): Promise<PreviaRow[]> {
  const procuradas = linhas.map((linha) => linha.matricula)
  const turmaDaMatricula = new Map((await lista.naLista(procuradas)).map(({ matricula, turmaId: daLista }) => [matricula, daLista]))
  const deAluno = new Set(await lista.comCredencial(procuradas))
  const aprovadasNaTurma = new Set(await lista.aprovadasNaTurma(turmaId, procuradas))
  /** O resultado da matrícula que passou na conferência do texto, pelo que está gravado. */
  const peloBanco = (matricula: string): Pick<PreviaRow, 'resultado' | 'erro'> => {
    const naLista = turmaDaMatricula.get(matricula)
    if (naLista === turmaId || aprovadasNaTurma.has(matricula)) return { resultado: 'ja_existe' }
    if (naLista !== undefined || deAluno.has(matricula)) return { resultado: 'erro', erro: 'matricula_em_uso' }
    return { resultado: 'entra' }
  }
  return linhas.map(({ linha, nome, matricula }, posicao) => {
    const doTexto = errosDoTexto[posicao]
    return { linha, nome, matricula, ...(doTexto === undefined ? peloBanco(matricula) : { resultado: 'erro', erro: doTexto }) }
  })
}

/**
 * A lista de nomes da turma pela coordenação (A1, 2.0, RF4 e RF5; Tech Spec da A1, seções 4 e 7). Todas as rotas são só
 * da coordenação (células `unidade` e, na leitura, `nominal_auditado`), e alcançam a turma do ano em curso da escola da
 * sessão; a de outro ano, de outra escola ou inexistente responde `NAO_ENCONTRADO`, e nada é gravado. A lista roda na
 * hora, sem fila, porque tem teto: 200 linhas e 64 KB (seção 11, regra 00; `docs/infra.md` 3.5).
 *
 * Nada disto loga: nome, matrícula e o texto da lista nunca vão a log, e o erro sai pelo filtro global só com ids. A
 * auditoria leva ids e contagens.
 */
export class ListaService {
  constructor(private readonly banco: Database) {}

  /**
   * `POST /v1/turmas/:id/lista/previa`: o que aconteceria com cada linha se a lista fosse gravada, sem gravar nada. O
   * texto acima do teto responde `ENTRADA_INVALIDA` antes de procurar a turma.
   */
  async previa(turmaId: string, { texto }: TextoDaListaRequest): Promise<PreviaDaListaResponse> {
    const linhas = lerTextoDaLista(texto)
    const errosDoTexto = errosDasLinhas(linhas)
    if ((await new TurmaRepository(this.banco).aberta(turmaId, 'unidade')) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const classificadas = await classificar(new ListaRepository(this.banco), turmaId, linhas, errosDoTexto)
    const quantas = (resultado: PreviaRow['resultado']) => classificadas.filter((linha) => linha.resultado === resultado).length
    return previaDaListaResponseSchema.parse({ linhas: classificadas, entram: quantas('entra'), jaExistem: quantas('ja_existe'), comErro: quantas('erro') })
  }

  /**
   * `POST /v1/turmas/:id/lista`: grava a lista só se nenhuma linha tiver erro, e grava `lista.gravada` na mesma
   * transação. O erro que o texto sozinho mostra (sem nome, sem matrícula, com forma de documento, repetida no texto) é
   * `ENTRADA_INVALIDA`, antes de procurar a turma; a matrícula em uso, que depende do que já está gravado, é `CONFLITO`.
   * Nos dois, nada é gravado.
   *
   * - O ano em curso fica travado em `FOR SHARE` (10.0, C10), antes da turma: o `encerrar` que chega depois espera e
   *   apaga os nomes livres que ela gravou; o que chegou antes faz a gravação responder `NAO_ENCONTRADO`.
   * - A turma fica travada contra a exclusão até o fim (C9): a exclusão que chega depois espera e sai `CONFLITO`; a que
   *   chegou antes faz a gravação responder `NAO_ENCONTRADO`.
   * - A mesma lista gravada duas vezes ao mesmo tempo entra uma vez (C8): a segunda não grava de novo o que a primeira
   *   gravou (`on conflict do nothing`) e conta como `jaExistentes`.
   * - A matrícula que outra gravação pôs, ao mesmo tempo, na lista de **outra** turma não entra aqui e não conta como já
   *   existente: a gravação inteira volta atrás com `CONFLITO`.
   */
  async gravar(turmaId: string, { texto }: TextoDaListaRequest): Promise<GravacaoDaListaResponse> {
    const linhas = lerTextoDaLista(texto)
    const errosDoTexto = errosDasLinhas(linhas)
    if (errosDoTexto.some((erro) => erro !== undefined)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const gravacao = await this.banco.transaction(async (tx) => {
      const turmas = new TurmaRepository(tx)
      if (!(await turmas.travarAnoEmCurso()) || !(await turmas.travarContraExclusao(turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const lista = new ListaRepository(tx)
      const classificadas = await classificar(lista, turmaId, linhas, errosDoTexto)
      if (classificadas.some((linha) => linha.resultado === 'erro')) throw new DomainException(ErrorCode.CONFLITO)
      const novas = classificadas.filter((linha) => linha.resultado === 'entra')
      const gravadas = await lista.inserirSemRepetir(turmaId, novas)
      const matriculasGravadas = new Set(gravadas.map((gravada) => gravada.matricula))
      const deOutraGravacao = novas.filter((linha) => !matriculasGravadas.has(linha.matricula)).map((linha) => linha.matricula)
      if ((await lista.quantasNaTurma(turmaId, deOutraGravacao)) !== deOutraGravacao.length) throw new DomainException(ErrorCode.CONFLITO)
      const contagens = { gravados: gravadas.length, jaExistentes: linhas.length - gravadas.length }
      await registro.gravar(tx, 'lista.gravada', { entidadeId: turmaId, depois: { ids: gravadas.map((gravada) => gravada.id), ...contagens } })
      return contagens
    })
    return gravacaoDaListaResponseSchema.parse(gravacao)
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
