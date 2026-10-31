import {
  artefato,
  atividadeAplicada,
  correcao,
  disciplina,
  entrega,
  requireAnoEmCurso,
  requireEscolaId,
  respostaAtividade,
  requestSessao,
  tentativaAtividade,
  usuario,
  vinculo,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import type { PaginationQuery, DiagnosticoGravado, EstadoDeAtividadeAplicada } from '@educa/shared'
import { and, asc, desc, eq, exists, isNull, lt, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

/** Uma atividade da turma do aluno, na lista dele: sem acerto, sem gabarito, sem colega. */
export interface MinhaAtividadeLida {
  readonly id: string
  readonly titulo: string
  readonly disciplinaId: string
  readonly disciplinaNome: string
  readonly avaliativa: boolean
  readonly estado: EstadoDeAtividadeAplicada
  readonly questoes: number
  readonly respondidas: number
  readonly aplicadaEm: Date
  readonly iniciadaEm: Date | null
  readonly enviadaEm: Date | null
  readonly comDiagnostico: boolean
}

/** A atividade como o aluno a abre. `conteudo` é o do artefato, com o gabarito: o service só tira dele a prova. */
export interface ProvaLida {
  readonly id: string
  readonly titulo: string
  readonly avaliativa: boolean
  readonly estado: EstadoDeAtividadeAplicada
  readonly conteudo: unknown
}

export interface TentativaLida {
  readonly iniciadaEm: Date
  readonly enviadaEm: Date | null
}

export interface RespostaLida {
  readonly questao: number
  readonly alternativa: number
  /** A ordem da escolha gravada: 0 na linha anterior à coluna. */
  readonly sequencia: number
  readonly respondidaEm: Date
}

/** A correção do próprio aluno num lote **aprovado**, com quem aprovou e quando. */
export interface DiagnosticoLido {
  readonly titulo: string
  readonly conteudo: unknown
  readonly acertos: number
  readonly total: number
  readonly porHabilidade: DiagnosticoGravado
  readonly nomeDeQuemAprovou: string | null
  readonly aprovadoEm: Date
}

const artefatoDaAplicacao = and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId))

/** As colunas que `respostas` lê e que `responder` devolve: a mesma forma de `RespostaLida`. */
const COLUNAS_DA_RESPOSTA = { questao: respostaAtividade.questao, alternativa: respostaAtividade.alternativa, sequencia: respostaAtividade.sequencia, respondidaEm: respostaAtividade.respondidaEm }

/**
 * O lado do aluno na atividade (`proprio`; regra 10, itens 3 e 4; regra 20, item 5). **O aluno é o da sessão**, nunca
 * de argumento: tentativa, resposta e diagnóstico são sempre filtrados por ele, e a atividade só é alcançada se for de
 * uma turma em que ele tem vínculo de aluno `confirmado`, na escola e no ano letivo do contexto. O banco aceitaria a
 * tentativa de qualquer aluno da escola: quem confere a turma é este repository, antes de criar a tentativa.
 *
 * Nenhuma consulta daqui lê tentativa, resposta ou correção de outro aluno, nem soma da turma.
 */
export class MinhaAtividadeRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Atividade da escola e do ano do contexto, de turma em que o aluno da sessão tem vínculo de aluno `confirmado`. */
  #daMinhaTurma(): SQL | undefined {
    const { usuarioId } = requestSessao()
    return and(
      eq(atividadeAplicada.escolaId, requireEscolaId()),
      eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
      exists(
        this.banco
          .select({ um: vinculo.id })
          .from(vinculo)
          .where(
            and(
              eq(vinculo.escolaId, atividadeAplicada.escolaId),
              eq(vinculo.anoLetivoId, atividadeAplicada.anoLetivoId),
              eq(vinculo.turmaId, atividadeAplicada.turmaId),
              eq(vinculo.usuarioId, usuarioId),
              eq(vinculo.papel, 'aluno'),
              eq(vinculo.estado, 'confirmado'),
            ),
          ),
      ),
    )
  }

  /** As colunas que prendem uma linha de tentativa, resposta ou correção ao aluno da sessão, na escola e no ano do contexto. */
  #minha<Tabela extends typeof tentativaAtividade | typeof respostaAtividade | typeof correcao>(tabela: Tabela, atividadeAplicadaId: string): SQL | undefined {
    return and(eq(tabela.escolaId, requireEscolaId()), eq(tabela.anoLetivoId, requireAnoEmCurso()), eq(tabela.atividadeAplicadaId, atividadeAplicadaId), eq(tabela.alunoId, requestSessao().usuarioId))
  }

  /**
   * Uma página das atividades das turmas do aluno, da mais nova para a mais antiga, com uma linha a mais que diz se há
   * próxima. `comDiagnostico` só é verdadeiro com correção **dele** em lote `aprovada`: é um sim ou não, sem número.
   */
  listar({ pagina, limite }: PaginationQuery): Promise<MinhaAtividadeLida[]> {
    const { usuarioId } = requestSessao()
    return this.banco
      .select({
        id: atividadeAplicada.id,
        titulo: artefato.titulo,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        avaliativa: atividadeAplicada.avaliativa,
        estado: atividadeAplicada.estado,
        questoes: sql<number>`jsonb_array_length(${artefato.conteudo} -> 'questoes')`,
        respondidas: sql<number>`(select count(*)::int from ${respostaAtividade} where ${respostaAtividade.escolaId} = ${atividadeAplicada.escolaId} and ${respostaAtividade.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${respostaAtividade.atividadeAplicadaId} = ${atividadeAplicada.id} and ${respostaAtividade.alunoId} = ${usuarioId})`,
        aplicadaEm: atividadeAplicada.aplicadaEm,
        iniciadaEm: tentativaAtividade.iniciadaEm,
        enviadaEm: tentativaAtividade.enviadaEm,
        comDiagnostico: sql<boolean>`exists (select 1 from ${correcao} inner join ${entrega} on ${entrega.escolaId} = ${correcao.escolaId} and ${entrega.id} = ${correcao.entregaId} where ${correcao.escolaId} = ${atividadeAplicada.escolaId} and ${correcao.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${correcao.atividadeAplicadaId} = ${atividadeAplicada.id} and ${correcao.alunoId} = ${usuarioId} and ${entrega.estado} = 'aprovada')`,
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId), eq(disciplina.id, artefato.disciplinaId)))
      .leftJoin(
        tentativaAtividade,
        and(
          eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId),
          eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId),
          eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id),
          eq(tentativaAtividade.alunoId, usuarioId),
        ),
      )
      .where(and(this.#daMinhaTurma(), pagina === undefined ? undefined : lt(atividadeAplicada.id, pagina)))
      .orderBy(desc(atividadeAplicada.id))
      .limit(limite + 1)
  }

  /**
   * A atividade da turma do aluno, com o conteúdo do artefato. `travar` segura a linha da aplicação em `for share` até
   * o fim da transação: o encerramento, que a trava em `for update`, espera a gravação em curso, e a gravação que chega
   * depois relê a atividade já `encerrada` (regra 80, itens 6 e 7). Trinta e cinco alunos gravando ao mesmo tempo não
   * se esperam: `for share` convive com `for share`.
   */
  async prova(id: string, travar = false): Promise<ProvaLida | undefined> {
    const consulta = this.banco
      .select({ id: atividadeAplicada.id, titulo: artefato.titulo, avaliativa: atividadeAplicada.avaliativa, estado: atividadeAplicada.estado, conteudo: artefato.conteudo })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
    const [linha] = await (travar ? consulta.for('share', { of: atividadeAplicada }) : consulta)
    return linha
  }

  /** O mesmo alcance e a mesma trava de `prova`, só com o estado e o número de questões: é o que o `PUT` da resposta e o envio leem, sem carregar o conteúdo. */
  async travarParaGravar(id: string): Promise<{ estado: EstadoDeAtividadeAplicada; questoes: number } | undefined> {
    const [linha] = await this.banco
      .select({ estado: atividadeAplicada.estado, questoes: sql<number>`jsonb_array_length(${artefato.conteudo} -> 'questoes')` })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
      .for('share', { of: atividadeAplicada })
    return linha
  }

  /**
   * A tentativa do aluno da sessão, criada se ainda não existe, numa instrução só: abrir a prova em duas abas cria uma
   * (regra 80, item 7). O `do update` não muda nada, mas trava a linha e devolve o estado dela: a resposta que chega
   * junto com o envio espera por ele e lê a tentativa já enviada. Só se chama depois de `prova` ou `travarParaGravar`
   * achar a atividade na turma do aluno.
   */
  async abrirTentativa(atividadeAplicadaId: string): Promise<TentativaLida> {
    const [linha] = await this.banco
      .insert(tentativaAtividade)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId: requestSessao().usuarioId })
      .onConflictDoUpdate({
        target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId],
        set: { iniciadaEm: sql`${tentativaAtividade.iniciadaEm}` },
      })
      .returning({ iniciadaEm: tentativaAtividade.iniciadaEm, enviadaEm: tentativaAtividade.enviadaEm })
    if (linha === undefined) throw new InvariantException('tentativa não aberta')
    return linha
  }

  /** A tentativa do aluno da sessão, se ele já abriu a atividade. */
  async tentativa(atividadeAplicadaId: string): Promise<TentativaLida | undefined> {
    const [linha] = await this.banco
      .select({ iniciadaEm: tentativaAtividade.iniciadaEm, enviadaEm: tentativaAtividade.enviadaEm })
      .from(tentativaAtividade)
      .where(this.#minha(tentativaAtividade, atividadeAplicadaId))
    return linha
  }

  /** As respostas do aluno da sessão na atividade, em ordem de questão. */
  respostas(atividadeAplicadaId: string): Promise<RespostaLida[]> {
    return this.banco
      .select(COLUNAS_DA_RESPOSTA)
      .from(respostaAtividade)
      .where(this.#minha(respostaAtividade, atividadeAplicadaId))
      .orderBy(asc(respostaAtividade.questao))
  }

  /**
   * Grava a alternativa do aluno da sessão na questão, **idempotente** e **só a mais nova** (regra 80, itens 6 e 7): a
   * mesma resposta duas vezes, o reenvio depois da queda de rede e as duas abas gravam uma linha só, e a escolha com
   * `sequencia` menor ou igual à gravada **não troca nada**: quem decide é o banco, na própria instrução, e não um
   * "lê e depois grava". Quem perde recebe de volta o que ficou gravado, para a tela adotar. Sem `sequencia` (cliente
   * antigo), a escolha vale como a mais nova, na mesma escala: a gravada mais 1, e 1 na primeira.
   */
  async responder(atividadeAplicadaId: string, questao: number, alternativa: number, sequencia?: number): Promise<RespostaLida> {
    const alvo = [respostaAtividade.escolaId, respostaAtividade.anoLetivoId, respostaAtividade.atividadeAplicadaId, respostaAtividade.alunoId, respostaAtividade.questao]
    const gravar = this.banco
      .insert(respostaAtividade)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId: requestSessao().usuarioId, questao, alternativa, sequencia: sequencia ?? 1 })
    const [gravada] = await (sequencia === undefined
      ? gravar.onConflictDoUpdate({ target: alvo, set: { alternativa, sequencia: sql`${respostaAtividade.sequencia} + 1`, respondidaEm: sql`now()` } })
      : gravar.onConflictDoUpdate({
          target: alvo,
          set: { alternativa, sequencia: sql`excluded.sequencia`, respondidaEm: sql`now()` },
          setWhere: sql`excluded.sequencia > ${respostaAtividade.sequencia}`,
        })
    ).returning(COLUNAS_DA_RESPOSTA)
    // Perdeu para uma `sequencia` maior ou igual: o `returning` não devolve a linha que o `where` recusou, e a que ficou é lida em seguida.
    const [lida] =
      gravada !== undefined
        ? [gravada]
        : await this.banco
            .select(COLUNAS_DA_RESPOSTA)
            .from(respostaAtividade)
            .where(and(this.#minha(respostaAtividade, atividadeAplicadaId), eq(respostaAtividade.questao, questao)))
    if (lida === undefined) throw new InvariantException('resposta não gravada')
    return lida
  }

  /** Marca o envio da tentativa do aluno da sessão, com a hora do banco, uma vez só: a já enviada fica com a primeira hora. */
  async enviar(atividadeAplicadaId: string): Promise<void> {
    await this.banco
      .update(tentativaAtividade)
      .set({ enviadaEm: sql`now()` })
      .where(and(this.#minha(tentativaAtividade, atividadeAplicadaId), isNull(tentativaAtividade.enviadaEm)))
  }

  /**
   * A correção do aluno da sessão na atividade, **só se o lote dela está `aprovada`** (regra 70, item 3): a junção com a
   * entrega pelo estado é o que faz o lote pendente, o rejeitado e o ainda não corrigido não acharem nada. A atividade
   * precisa ser da turma dele, como em toda leitura daqui.
   */
  async diagnostico(id: string): Promise<DiagnosticoLido | undefined> {
    const [linha] = await this.banco
      .select({
        titulo: artefato.titulo,
        conteudo: artefato.conteudo,
        acertos: correcao.acertos,
        total: correcao.total,
        porHabilidade: correcao.porHabilidade,
        nomeDeQuemAprovou: usuario.nome,
        aprovadoEm: entrega.decididaEm,
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .innerJoin(correcao, and(eq(correcao.escolaId, atividadeAplicada.escolaId), eq(correcao.anoLetivoId, atividadeAplicada.anoLetivoId), eq(correcao.atividadeAplicadaId, atividadeAplicada.id), eq(correcao.alunoId, requestSessao().usuarioId)))
      .innerJoin(entrega, and(eq(entrega.escolaId, correcao.escolaId), eq(entrega.id, correcao.entregaId), eq(entrega.estado, 'aprovada')))
      .leftJoin(usuario, and(eq(usuario.escolaId, entrega.escolaId), eq(usuario.id, entrega.decididaPor)))
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
    // A entrega aprovada sempre tem a data da decisão (check do banco); sem ela, não há diagnóstico a mostrar.
    if (linha === undefined || linha.aprovadoEm === null) return undefined
    return { ...linha, aprovadoEm: linha.aprovadoEm }
  }
}
