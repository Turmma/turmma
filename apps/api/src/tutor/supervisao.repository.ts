import {
  artefato,
  atividadeAplicada,
  configuracaoOperacionalEscola,
  diaDeUso,
  execucaoAgente,
  requireAnoEmCurso,
  requireEscolaId,
  FUSO_DO_USO,
  material,
  mensagemTutor,
  systemClock,
  requestSessao,
  sinalTutor,
  turma,
  usuario,
  vinculo,
  type Database,
  type Clock,
  type DatabaseTransaction,
} from '@educa/nucleo'
import { TIPOS_DE_SINAL_DE_TRABALHO, TROCAS_POR_DIA_PADRAO_DO_TUTOR, TROCAS_POR_MES_PADRAO_DO_TUTOR, type TipoDeSinal, type TipoDeSinalDeTrabalho } from '@educa/shared'
import { and, asc, count, countDistinct, desc, eq, exists, gte, inArray, isNull, lt, notExists, or, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { comVinculoConfirmadoDoProfessor, type ColunasDaTurma } from '../assistente/turma-do-professor.repository.js'

export interface SinalDaTurma {
  readonly id: string
  readonly tipo: TipoDeSinal
  readonly alunoId: string
  readonly nome: string
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly materialId: string | null
  readonly pagina: number | null
  readonly criadoEm: Date
}

export interface GrupoDeSinaisDaTurma {
  readonly tipo: TipoDeSinalDeTrabalho
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly alunos: number
}

export interface UltimaTrocaDoAluno {
  readonly alunoId: string
  readonly nome: string
  readonly ultimaTrocaEm: Date
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly materialId: string | null
  readonly pagina: number | null
}

export interface LimitesDoTutor {
  readonly limiteDoDia: number
  readonly pacoteDaTurmaNoMes: number
}

/** As colunas de uma linha (mensagem ou sinal) que dizem a que trabalho ela se refere. */
interface ColunasDaReferencia extends ColunasDaTurma {
  readonly atividadeAplicadaId: AnyColumn
  readonly materialId: AnyColumn
}

const aplicacaoDaLinha = alias(atividadeAplicada, 'aplicacao_da_linha')
const artefatoDaAplicacao = alias(artefato, 'artefato_da_aplicacao_da_linha')
const materialDaLinha = alias(material, 'material_da_linha')
const alunoDaTurma = alias(vinculo, 'aluno_da_turma')

/**
 * A supervisão do Tutor pelo **professor da sessão** (MVP, A4; D8, D34, D47; regra 70, itens 4 e 7): os sinais e o uso
 * de uma turma. Escola, ano letivo e professor vêm do contexto (regra 10, item 3).
 *
 * **O alcance é por turma e por disciplina** (regra 10, item 4): o sinal e a troca que nasceram de uma atividade são
 * da disciplina do artefato dela; os que nasceram de material, da disciplina do material; e só o professor com vínculo
 * `confirmado` **naquela disciplina, naquela turma** os lê. A professora de Física do 2ºB não vê o que nasceu numa
 * atividade de Química do 2ºB. O que não tem disciplina chega a todo professor com vínculo confirmado na turma: o sinal
 * `atencao_humana` (não tem referência nenhuma, e é o aviso de que um aluno precisa de um adulto) e a troca feita fora
 * de atividade e de material (senão ela seria uso invisível a todos; regra 70, item 4).
 *
 * **Nada aqui lê `mensagem_tutor.texto` nem `citacoes`**, e nenhum método junta sinal com mensagem: o professor vê onde
 * e quando, nunca o que foi escrito (`docs/aia/sinais-e-alertas.md`, N11 e N12). `sinal.execucao_id` não é selecionado.
 */
export class SupervisaoDoTutorRepository {
  constructor(
    private readonly banco: Database | DatabaseTransaction,
    private readonly relogio: Clock = systemClock,
  ) {}

  #escopo(): { escolaId: string; anoLetivoId: string } {
    return { escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso() }
  }

  /** Existe vínculo `confirmado` de professor do usuário do contexto na turma da linha, **em qualquer disciplina**. */
  #comVinculoNaTurma(colunas: ColunasDaTurma): SQL {
    const { usuarioId } = requestSessao()
    return exists(
      this.banco
        .select({ um: vinculo.id })
        .from(vinculo)
        .where(
          and(
            eq(vinculo.escolaId, colunas.escolaId),
            eq(vinculo.anoLetivoId, colunas.anoLetivoId),
            eq(vinculo.turmaId, colunas.turmaId),
            eq(vinculo.usuarioId, usuarioId),
            eq(vinculo.papel, 'professor'),
            eq(vinculo.estado, 'confirmado'),
          ),
        ),
    )
  }

  /**
   * A disciplina do trabalho a que a linha se refere, como subconsulta: a do artefato da atividade aplicada, ou a do
   * material. Lidos na escola e no ano da própria linha. Sem atividade e sem material, nulo.
   */
  #disciplinaDaReferencia(colunas: ColunasDaReferencia): SQL {
    const daAtividade = this.banco
      .select({ disciplinaId: artefatoDaAplicacao.disciplinaId })
      .from(aplicacaoDaLinha)
      .innerJoin(artefatoDaAplicacao, and(eq(artefatoDaAplicacao.escolaId, aplicacaoDaLinha.escolaId), eq(artefatoDaAplicacao.anoLetivoId, aplicacaoDaLinha.anoLetivoId), eq(artefatoDaAplicacao.id, aplicacaoDaLinha.artefatoId)))
      .where(and(eq(aplicacaoDaLinha.escolaId, colunas.escolaId), eq(aplicacaoDaLinha.anoLetivoId, colunas.anoLetivoId), eq(aplicacaoDaLinha.id, colunas.atividadeAplicadaId)))
    const doMaterial = this.banco
      .select({ disciplinaId: materialDaLinha.disciplinaId })
      .from(materialDaLinha)
      .where(and(eq(materialDaLinha.escolaId, colunas.escolaId), eq(materialDaLinha.id, colunas.materialId)))
    return sql`coalesce((${daAtividade}), (${doMaterial}))`
  }

  /** O professor do contexto tem vínculo confirmado na disciplina do trabalho a que a linha se refere. */
  #daDisciplinaDoProfessor(colunas: ColunasDaReferencia): SQL {
    return comVinculoConfirmadoDoProfessor(this.banco, colunas, this.#disciplinaDaReferencia(colunas))
  }

  /**
   * A turma existe na escola e no ano do contexto, e o professor do contexto tem vínculo confirmado nela? A de outra
   * escola, de outro ano, de outro professor e a inexistente respondem igual: `false` (regra 10, item 6).
   */
  async turmaDoProfessor(turmaId: string): Promise<boolean> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(and(eq(turma.escolaId, escolaId), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId), this.#comVinculoNaTurma({ escolaId: turma.escolaId, anoLetivoId: turma.anoLetivoId, turmaId: turma.id })))
    return linha !== undefined
  }

  /** Os sinais da turma que este professor alcança: os da disciplina dele, e todo `atencao_humana` da turma. */
  #sinaisDoProfessor(turmaId: string): SQL | undefined {
    const { escolaId, anoLetivoId } = this.#escopo()
    const colunas = { escolaId: sinalTutor.escolaId, anoLetivoId: sinalTutor.anoLetivoId, turmaId: sinalTutor.turmaId, atividadeAplicadaId: sinalTutor.atividadeAplicadaId, materialId: sinalTutor.materialId }
    return and(
      eq(sinalTutor.escolaId, escolaId),
      eq(sinalTutor.anoLetivoId, anoLetivoId),
      eq(sinalTutor.turmaId, turmaId),
      or(and(eq(sinalTutor.tipo, 'atencao_humana'), this.#comVinculoNaTurma(colunas)), this.#daDisciplinaDoProfessor(colunas)),
    )
  }

  /**
   * Uma página dos sinais da turma, do mais novo para o mais antigo, com o nome do aluno (D34: só o professor da turma
   * o recebe). Só tipo, aluno, referência e hora: a tabela não tem texto, e a consulta não junta a conversa.
   */
  async sinais(turmaId: string, antesDe: string | undefined, limite: number): Promise<SinalDaTurma[]> {
    return this.banco
      .select({
        id: sinalTutor.id,
        tipo: sinalTutor.tipo,
        alunoId: sinalTutor.alunoId,
        nome: usuario.nome,
        atividadeAplicadaId: sinalTutor.atividadeAplicadaId,
        questao: sinalTutor.questao,
        materialId: sinalTutor.materialId,
        pagina: sinalTutor.pagina,
        criadoEm: sinalTutor.criadoEm,
      })
      .from(sinalTutor)
      .innerJoin(usuario, and(eq(usuario.escolaId, sinalTutor.escolaId), eq(usuario.id, sinalTutor.alunoId)))
      .where(and(this.#sinaisDoProfessor(turmaId), antesDe === undefined ? undefined : lt(sinalTutor.id, antesDe)))
      .orderBy(desc(sinalTutor.id))
      .limit(limite)
  }

  /**
   * O agrupado de "Seu time": por tipo, atividade e questão, **quantos alunos diferentes**, desde `desde`. Só os sinais
   * de trabalho: o `atencao_humana` nunca é somado nem agrupado. É contagem de alunos por questão, não de sinais por
   * aluno: nada aqui ordena nem pontua aluno (`docs/aia/sinais-e-alertas.md`, N5).
   */
  async grupos(turmaId: string, desde: Date, limite: number): Promise<GrupoDeSinaisDaTurma[]> {
    const alunos = countDistinct(sinalTutor.alunoId)
    const linhas = await this.banco
      .select({ tipo: sinalTutor.tipo, atividadeAplicadaId: sinalTutor.atividadeAplicadaId, questao: sinalTutor.questao, alunos })
      .from(sinalTutor)
      .where(and(this.#sinaisDoProfessor(turmaId), inArray(sinalTutor.tipo, [...TIPOS_DE_SINAL_DE_TRABALHO]), gte(sinalTutor.criadoEm, desde)))
      .groupBy(sinalTutor.tipo, sinalTutor.atividadeAplicadaId, sinalTutor.questao)
      .orderBy(desc(alunos), asc(sinalTutor.atividadeAplicadaId), asc(sinalTutor.questao), asc(sinalTutor.tipo))
      .limit(limite)
    return linhas as GrupoDeSinaisDaTurma[]
  }

  /** A execução da pergunta terminou `falhou`: o modelo não respondeu, e a pergunta não conta como troca (a mesma regra do freio). */
  #execucaoQueFalhou() {
    return this.banco
      .select({ id: execucaoAgente.id })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou')))
  }

  /**
   * Os alunos da turma que já trocaram com o Tutor no ano, **em ordem de nome**, cada um com a hora e a referência da
   * **última** troca que este professor alcança (a da disciplina dele, ou a feita fora de atividade e de material).
   *
   * O que a consulta não tem, de propósito (regra 70, item 7): o texto da pergunta ou da resposta; quem **não** usou
   * (a junção é com a última troca, e quem não tem não aparece); as trocas anteriores à última; ordenação por recência
   * ou por quantidade.
   */
  async ultimasTrocas(turmaId: string, limite: number): Promise<UltimaTrocaDoAluno[]> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const colunas = { escolaId: mensagemTutor.escolaId, anoLetivoId: mensagemTutor.anoLetivoId, turmaId: mensagemTutor.turmaId, atividadeAplicadaId: mensagemTutor.atividadeAplicadaId, materialId: mensagemTutor.materialId }
    const semDisciplina = and(isNull(mensagemTutor.atividadeAplicadaId), isNull(mensagemTutor.materialId))
    const ultima = this.banco
      .select({
        criadaEm: mensagemTutor.criadaEm,
        atividadeAplicadaId: mensagemTutor.atividadeAplicadaId,
        questao: mensagemTutor.questao,
        materialId: mensagemTutor.materialId,
        pagina: mensagemTutor.pagina,
      })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, escolaId),
          eq(mensagemTutor.anoLetivoId, anoLetivoId),
          eq(mensagemTutor.turmaId, turmaId),
          eq(mensagemTutor.alunoId, alunoDaTurma.usuarioId),
          eq(mensagemTutor.autor, 'aluno'),
          notExists(this.#execucaoQueFalhou()),
          or(and(semDisciplina, this.#comVinculoNaTurma(colunas)), this.#daDisciplinaDoProfessor(colunas)),
        ),
      )
      .orderBy(desc(mensagemTutor.id))
      .limit(1)
      .as('ultima_troca')
    return this.banco
      .select({
        alunoId: usuario.id,
        nome: usuario.nome,
        ultimaTrocaEm: ultima.criadaEm,
        atividadeAplicadaId: ultima.atividadeAplicadaId,
        questao: ultima.questao,
        materialId: ultima.materialId,
        pagina: ultima.pagina,
      })
      .from(alunoDaTurma)
      .innerJoin(usuario, and(eq(usuario.escolaId, alunoDaTurma.escolaId), eq(usuario.id, alunoDaTurma.usuarioId)))
      .innerJoinLateral(ultima, sql`true`)
      .where(and(eq(alunoDaTurma.escolaId, escolaId), eq(alunoDaTurma.anoLetivoId, anoLetivoId), eq(alunoDaTurma.turmaId, turmaId), eq(alunoDaTurma.papel, 'aluno'), eq(alunoDaTurma.estado, 'confirmado')))
      .orderBy(asc(usuario.nome), asc(usuario.id))
      .limit(limite)
  }

  /** O começo do dia `dia` (`AAAA-MM-DD`) no fuso do uso: é de onde o freio conta o dia e o mês. */
  #desde(dia: string): SQL {
    return sql`(${dia}::date)::timestamp at time zone ${FUSO_DO_USO}`
  }

  /**
   * As trocas de hoje de cada aluno. **A mesma conta do freio do dia** (`OrcamentoRepository`): pergunta do aluno, na
   * escola, desde a virada do dia no fuso do uso, cuja execução não terminou `falhou`. É o número que se compara com o
   * limite do dia, e por isso soma as trocas do aluno em qualquer disciplina: recortar por disciplina faria a tela
   * dizer "12 de 60" para um aluno que o freio já parou.
   */
  async trocasDeHoje(alunos: readonly string[]): Promise<Map<string, number>> {
    if (alunos.length === 0) return new Map()
    const { escolaId } = this.#escopo()
    const linhas = await this.banco
      .select({ alunoId: mensagemTutor.alunoId, total: count() })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, escolaId),
          inArray(mensagemTutor.alunoId, [...alunos]),
          eq(mensagemTutor.autor, 'aluno'),
          gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
          notExists(this.#execucaoQueFalhou()),
        ),
      )
      .groupBy(mensagemTutor.alunoId)
    return new Map(linhas.map((linha) => [linha.alunoId, linha.total]))
  }

  /** As trocas da turma no mês, com a mesma conta do pacote do mês (`OrcamentoRepository`). */
  async trocasDaTurmaNoMes(turmaId: string): Promise<number> {
    const { escolaId } = this.#escopo()
    const [linha] = await this.banco
      .select({ total: count() })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, escolaId),
          eq(mensagemTutor.turmaId, turmaId),
          eq(mensagemTutor.autor, 'aluno'),
          gte(mensagemTutor.criadaEm, this.#desde(`${diaDeUso(this.relogio.agora()).slice(0, 7)}-01`)),
          notExists(this.#execucaoQueFalhou()),
        ),
      )
    return linha?.total ?? 0
  }

  /** O freio do dia e o pacote do mês da turma: os da configuração da escola, ou os padrões do contrato (D38, D41). O pacote é por aluno, somado na turma. */
  async limites(turmaId: string): Promise<LimitesDoTutor> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [configurados] = await this.banco
      .select({ porDia: configuracaoOperacionalEscola.tutorTrocasPorDia, porMes: configuracaoOperacionalEscola.tutorTrocasPorMes })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
    const [daTurma] = await this.banco
      .select({ alunos: count() })
      .from(vinculo)
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), eq(vinculo.papel, 'aluno'), eq(vinculo.estado, 'confirmado')))
    return {
      limiteDoDia: configurados?.porDia ?? TROCAS_POR_DIA_PADRAO_DO_TUTOR,
      pacoteDaTurmaNoMes: (configurados?.porMes ?? TROCAS_POR_MES_PADRAO_DO_TUTOR) * Math.max(1, daTurma?.alunos ?? 0),
    }
  }
}
