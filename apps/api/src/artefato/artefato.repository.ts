import { artefato, atividadeAplicada, entrega, exigirAnoEmCurso, exigirEscolaDoContexto, material, sessaoDaRequisicao, type Banco, type TransacaoBanco } from '@educa/nucleo'
import { InvariantException, MAXIMO_DE_VERSOES_NO_ARTEFATO, type ArtefatosQuery, type ConteudoDoArtefato, type EstadoDeAtividadeAplicada, type EstadoDeEntrega, type TipoDeArtefato } from '@educa/shared'
import { and, desc, eq, exists, inArray, lt, ne, not, sql, type SQL } from 'drizzle-orm'
import { comVinculoConfirmadoDoProfessor, disciplinaDoArtefato } from '../assistente/turma-do-professor.repository.js'

/** Um artefato como o repository o devolve: o `conteudo` é `jsonb`, e o service o valida antes de usar. */
export interface ArtefatoLido {
  readonly id: string
  readonly tipo: TipoDeArtefato
  readonly titulo: string
  readonly turmaId: string
  readonly disciplinaId: string
  readonly origemId: string | null
  readonly conteudo: unknown
  readonly criadoEm: Date
  /** A entrega da versão adaptada; nula no artefato original. */
  readonly entregaId: string | null
  readonly entregaEstado: EstadoDeEntrega | null
  readonly entregaDecididaEm: Date | null
}

export interface AplicacaoLida {
  readonly id: string
  readonly turmaId: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly aplicadaEm: Date
}

export interface NovoArtefato {
  readonly turmaId: string
  readonly disciplinaId: string
  readonly conteudo: ConteudoDoArtefato
  readonly execucaoId: string
  /** Só na versão adaptada: o artefato de que ela saiu, da mesma turma. */
  readonly origemId?: string
}

const colunas = {
  id: artefato.id,
  tipo: artefato.tipo,
  titulo: artefato.titulo,
  turmaId: artefato.turmaId,
  disciplinaId: artefato.disciplinaId,
  origemId: artefato.origemId,
  conteudo: artefato.conteudo,
  criadoEm: artefato.criadoEm,
  entregaId: entrega.id,
  entregaEstado: entrega.estado,
  entregaDecididaEm: entrega.decididaEm,
}

/**
 * Os artefatos da escola e do ano letivo do contexto que o professor do contexto alcança: os das turmas em que ele tem
 * vínculo `confirmado` **na disciplina do artefato** (`turma_vinculada`; regra 10, itens 3 e 4). **A turma e a
 * disciplina que autorizam são as do próprio artefato**, lidas do banco, nunca as que o cliente mandou: a professora de
 * outra disciplina da mesma turma não o alcança. Coordenação e aluno não têm vínculo de professor: nada é achado.
 *
 * O artefato tem o gabarito: nenhum método daqui serve ao aluno, que recebe a prova pela atividade aplicada.
 */
export class ArtefatoRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  #noAlcance(): SQL | undefined {
    return and(
      eq(artefato.escolaId, exigirEscolaDoContexto()),
      eq(artefato.anoLetivoId, exigirAnoEmCurso()),
      comVinculoConfirmadoDoProfessor(this.banco, { escolaId: artefato.escolaId, anoLetivoId: artefato.anoLetivoId, turmaId: artefato.turmaId }, artefato.disciplinaId),
    )
  }

  #lidos(condicao: SQL | undefined) {
    return this.banco
      .select(colunas)
      .from(artefato)
      .leftJoin(entrega, and(eq(entrega.escolaId, artefato.escolaId), eq(entrega.anoLetivoId, artefato.anoLetivoId), eq(entrega.artefatoId, artefato.id)))
      .where(and(this.#noAlcance(), condicao))
  }

  /** O artefato com esse id, se está no alcance. O de outra escola, de outro ano, de outra turma ou inexistente não é achado. */
  async porId(id: string): Promise<ArtefatoLido | undefined> {
    const [linha] = await this.#lidos(eq(artefato.id, id))
    return linha
  }

  /**
   * Uma página dos artefatos no alcance, **do mais novo para o mais antigo** (o id é `uuidv7`), originais e versões
   * adaptadas, com uma linha a mais que diz se há próxima. `turmaId` só restringe: a turma de outro professor não acha nada.
   */
  listar({ pagina, limite, turmaId }: ArtefatosQuery): Promise<ArtefatoLido[]> {
    return this.#lidos(and(turmaId === undefined ? undefined : eq(artefato.turmaId, turmaId), pagina === undefined ? undefined : lt(artefato.id, pagina)))
      .orderBy(desc(artefato.id))
      .limit(limite + 1)
  }

  /** As versões adaptadas que saíram do artefato, da mais nova para a mais antiga, até o teto da resposta. */
  versoesAdaptadas(origemId: string): Promise<ArtefatoLido[]> {
    return this.#lidos(eq(artefato.origemId, origemId)).orderBy(desc(artefato.id)).limit(MAXIMO_DE_VERSOES_NO_ARTEFATO)
  }

  /**
   * Onde o artefato foi aplicado, da aplicação mais nova para a mais antiga, até o teto da resposta. Só as aplicações em
   * turma em que o professor tem vínculo na disciplina do artefato: a aplicação pode ser em outra turma do mesmo ano.
   */
  aplicacoes(artefatoId: string): Promise<AplicacaoLida[]> {
    return this.banco
      .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, estado: atividadeAplicada.estado, aplicadaEm: atividadeAplicada.aplicadaEm })
      .from(atividadeAplicada)
      .where(
        and(
          eq(atividadeAplicada.escolaId, exigirEscolaDoContexto()),
          eq(atividadeAplicada.anoLetivoId, exigirAnoEmCurso()),
          eq(atividadeAplicada.artefatoId, artefatoId),
          comVinculoConfirmadoDoProfessor(
            this.banco,
            { escolaId: atividadeAplicada.escolaId, anoLetivoId: atividadeAplicada.anoLetivoId, turmaId: atividadeAplicada.turmaId },
            disciplinaDoArtefato(this.banco, { escolaId: atividadeAplicada.escolaId, anoLetivoId: atividadeAplicada.anoLetivoId, artefatoId: atividadeAplicada.artefatoId }),
          ),
        ),
      )
      .orderBy(desc(atividadeAplicada.id))
      .limit(MAXIMO_DE_VERSOES_NO_ARTEFATO)
  }

  /**
   * O título dos materiais que o artefato cita, para a linha "Fonte" do PDF. Inclui o material excluído: a linha dele
   * fica justamente porque artefatos já o citam. O id vem do `jsonb`, sem FK: só os da escola do contexto são achados.
   */
  async titulosDosMateriais(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const linhas = await this.banco
      .select({ id: material.id, titulo: material.titulo })
      .from(material)
      .where(and(eq(material.escolaId, exigirEscolaDoContexto()), inArray(material.id, [...ids])))
    return new Map(linhas.map((linha) => [linha.id, linha.titulo]))
  }

  /**
   * Troca o título, na coluna e dentro do `conteudo`, **no mesmo comando**: as duas cópias nunca divergem. Só o título
   * muda; as questões, o gabarito e as citações ficam como foram gravados.
   *
   * **A versão adaptada com a entrega já decidida não muda**: a condição vai no mesmo `update`, para a decisão que chega
   * junto com o renomear não deixar passar um título que a professora não viu ao decidir (regra 80, item 7). Diz se
   * renomeou; `false` é o artefato fora do alcance, ou a versão já decidida, e quem chama separa os dois.
   */
  async renomear(id: string, titulo: string): Promise<boolean> {
    const jaDecidida = this.banco
      .select({ um: entrega.id })
      .from(entrega)
      .where(and(eq(entrega.escolaId, artefato.escolaId), eq(entrega.anoLetivoId, artefato.anoLetivoId), eq(entrega.artefatoId, artefato.id), ne(entrega.estado, 'pendente')))
    const renomeados = await this.banco
      .update(artefato)
      .set({ titulo, conteudo: sql`jsonb_set(${artefato.conteudo}, '{titulo}', to_jsonb(${titulo}::text))`, atualizadoEm: sql`now()` })
      .where(and(this.#noAlcance(), eq(artefato.id, id), not(exists(jaDecidida))))
      .returning({ id: artefato.id })
    return renomeados.length > 0
  }

  /**
   * Grava o artefato que uma execução produziu, na escola e no ano do contexto, com quem pediu como autor. O tipo e o
   * título saem do conteúdo já validado. O índice único `(escola_id, execucao_id)` faz a execução repetida não criar dois.
   */
  async criar(novo: NovoArtefato): Promise<string> {
    const [criado] = await this.banco
      .insert(artefato)
      .values({
        escolaId: exigirEscolaDoContexto(),
        anoLetivoId: exigirAnoEmCurso(),
        turmaId: novo.turmaId,
        disciplinaId: novo.disciplinaId,
        tipo: novo.conteudo.tipo,
        titulo: novo.conteudo.titulo,
        conteudo: novo.conteudo,
        origemId: novo.origemId ?? null,
        execucaoId: novo.execucaoId,
        criadoPor: sessaoDaRequisicao().usuarioId,
      })
      .returning({ id: artefato.id })
    if (criado === undefined) throw new InvariantException('artefato não criado')
    return criado.id
  }
}
