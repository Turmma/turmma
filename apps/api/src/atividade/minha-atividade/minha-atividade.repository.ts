import {
  artefato,
  atividadeAplicada,
  convocadoDaSegundaChamada,
  correcao,
  disciplina,
  entrega,
  extensaoDeTempo,
  requireAnoEmCurso,
  requireEscolaId,
  respostaAtividade,
  requestSessao,
  tempoAdicional,
  tentativaAtividade,
  usuario,
  vinculo,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import { InvariantException, type Embaralhar, type PaginationQuery, type DiagnosticoGravado, type EnvioDaTentativa, type EstadoDeAtividadeAplicada, type ExtensaoDoLimite, type PercentualDeTempoAdicional } from '@educa/shared'
import { and, asc, desc, eq, exists, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import type { OrdemDaProva } from './ordem-da-prova.js'

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
  /** O aluno da tentativa (o da sessão), quando há tentativa: é o que a conta do limite da página pede. */
  readonly alunoId: string | null
  readonly comDiagnostico: boolean
  /** A janela e a duração da prova online, como estão na aplicação; nulas na atividade sem prova. A duração do aluno (com o tempo adicional) é conta do service. */
  readonly abreEm: Date | null
  readonly fechaEm: Date | null
  readonly duracaoMin: number | null
  /** O percentual de tempo adicional **do aluno da sessão**, ou nulo. Só serve à conta da duração dele: nunca sai daqui para a tela. */
  readonly percentual: PercentualDeTempoAdicional | null
  readonly limiteBaseEm: Date | null
  /** O `now()` do banco, o mesmo em todas as linhas da página: com ele o service decide se a tentativa em andamento já venceu. */
  readonly agora: Date
}

/** A atividade como o aluno a abre. `conteudo` é o do artefato, com o gabarito: o service só tira dele a prova. */
export interface ProvaLida {
  readonly id: string
  readonly titulo: string
  readonly avaliativa: boolean
  readonly estado: EstadoDeAtividadeAplicada
  readonly conteudo: unknown
  /** A janela e a duração da aplicação (nulas fora da prova online) e o `now()` do banco, que decide se o aluno pode começar. */
  readonly abreEm: Date | null
  readonly fechaEm: Date | null
  readonly duracaoMin: number | null
  readonly agora: Date
}

/** A tentativa do aluno da sessão, com o que o limite pede (`limiteDaTentativa`) e o `now()` do banco na mesma leitura. */
export interface TentativaLida {
  readonly alunoId: string
  readonly iniciadaEm: Date
  readonly enviadaEm: Date | null
  readonly limiteBaseEm: Date | null
  readonly envio: EnvioDaTentativa | null
  /** A ordem do aluno como foi gravada (`jsonb`): quem a lê é `readOrdem`. Nula quando a aplicação não embaralha. */
  readonly ordem: unknown
  readonly agora: Date
}

/** A atividade para a resposta, o envio e a saída da aba: o estado, se é avaliativa e quantas questões tem. */
export interface AtividadeParaGravar {
  readonly estado: EstadoDeAtividadeAplicada
  readonly avaliativa: boolean
  readonly questoes: number
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

/** O `now()` do banco como `Date`: o relógio da prova é o dele, e a transação o mantém o mesmo até o fim (regra 80, item 6). */
const agoraDoBanco = sql`now()`.mapWith(tentativaAtividade.iniciadaEm)

/** As colunas da tentativa que `TentativaLida` pede. */
const COLUNAS_DA_TENTATIVA = {
  alunoId: tentativaAtividade.alunoId,
  iniciadaEm: tentativaAtividade.iniciadaEm,
  enviadaEm: tentativaAtividade.enviadaEm,
  limiteBaseEm: tentativaAtividade.limiteBaseEm,
  envio: tentativaAtividade.envio,
  ordem: tentativaAtividade.ordem,
  agora: agoraDoBanco,
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

  /**
   * Atividade da escola e do ano do contexto, de turma em que o aluno da sessão tem vínculo de aluno `confirmado`. **A segunda chamada só é do convocado** (RF10): a que tem `segunda_chamada_de` exige a linha dele em
   * `convocado_da_segunda_chamada`, e este é o alcance de toda rota do aluno (lista, prova, tempo, resposta, envio, saída e diagnóstico), então o colega não convocado recebe o `NAO_ENCONTRADO` de quem não é da turma.
   */
  #daMinhaTurma(): SQL | undefined {
    const { usuarioId } = requestSessao()
    return and(
      eq(atividadeAplicada.escolaId, requireEscolaId()),
      eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
      or(
        isNull(atividadeAplicada.segundaChamadaDe),
        exists(
          this.banco
            .select({ um: convocadoDaSegundaChamada.id })
            .from(convocadoDaSegundaChamada)
            .where(
              and(
                eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId),
                eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id),
                eq(convocadoDaSegundaChamada.alunoId, usuarioId),
              ),
            ),
        ),
      ),
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
  #minha<Tabela extends typeof tentativaAtividade | typeof respostaAtividade | typeof correcao | typeof tempoAdicional>(tabela: Tabela, atividadeAplicadaId: string): SQL | undefined {
    return and(eq(tabela.escolaId, requireEscolaId()), eq(tabela.anoLetivoId, requireAnoEmCurso()), eq(tabela.atividadeAplicadaId, atividadeAplicadaId), eq(tabela.alunoId, requestSessao().usuarioId))
  }

  /**
   * Uma página das atividades das turmas do aluno, da mais nova para a mais antiga, com uma linha a mais que diz se há
   * próxima. `comDiagnostico` só é verdadeiro com correção **dele** em lote `aprovada`: é um sim ou não, sem número.
   */
  list({ pagina, limite }: PaginationQuery): Promise<MinhaAtividadeLida[]> {
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
        alunoId: tentativaAtividade.alunoId,
        abreEm: atividadeAplicada.abreEm,
        fechaEm: atividadeAplicada.fechaEm,
        duracaoMin: atividadeAplicada.duracaoMin,
        percentual: sql<PercentualDeTempoAdicional | null>`(select ${tempoAdicional.percentual} from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id} and ${tempoAdicional.alunoId} = ${usuarioId})`,
        limiteBaseEm: tentativaAtividade.limiteBaseEm,
        agora: agoraDoBanco,
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
      .select({
        id: atividadeAplicada.id,
        titulo: artefato.titulo,
        avaliativa: atividadeAplicada.avaliativa,
        estado: atividadeAplicada.estado,
        conteudo: artefato.conteudo,
        abreEm: atividadeAplicada.abreEm,
        fechaEm: atividadeAplicada.fechaEm,
        duracaoMin: atividadeAplicada.duracaoMin,
        agora: agoraDoBanco,
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
    const [linha] = await (travar ? consulta.for('share', { of: atividadeAplicada }) : consulta)
    return linha
  }

  /**
   * O que a professora ligou nesta aplicação, no mesmo alcance de `prova`: lido só por quem vai **começar** (a ordem do aluno é sorteada uma vez, e só para o que está ligado). Fora de
   * `prova` de propósito: o texto da consulta de `prova` já passa do 1 kB que `pg_stat_activity` guarda, e o teste da trava `for share` (`prova-online-aluno.int.test.ts`, "mudar a janela × começar") acha a espera pelo começo dele.
   */
  async embaralhar(id: string): Promise<Embaralhar | undefined> {
    const [linha] = await this.banco
      .select({ questoes: atividadeAplicada.embaralharQuestoes, alternativas: atividadeAplicada.embaralharAlternativas })
      .from(atividadeAplicada)
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
    return linha
  }

  /** O mesmo alcance de `prova`, só com o estado e o número de questões, e a **trava**: é o que o `PUT` da resposta e o envio leem, sem carregar o conteúdo. */
  async lockParaGravar(id: string): Promise<AtividadeParaGravar | undefined> {
    const [linha] = await this.#paraGravar(id).for('share', { of: atividadeAplicada })
    return linha
  }

  /** O mesmo que `lockParaGravar`, **sem trava**: o que `tempo` lê a cada 30 s de cada aluno, e não pode esperar o encerramento. */
  async leitura(id: string): Promise<AtividadeParaGravar | undefined> {
    const [linha] = await this.#paraGravar(id)
    return linha
  }

  #paraGravar(id: string) {
    return this.banco
      .select({ estado: atividadeAplicada.estado, avaliativa: atividadeAplicada.avaliativa, questoes: sql<number>`jsonb_array_length(${artefato.conteudo} -> 'questoes')` })
      .from(atividadeAplicada)
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
  }

  /**
   * Começa a prova: cria a tentativa do aluno da sessão com o `limite_base_em` já calculado, **uma só** (`on conflict do nothing`: o clique duplo, a outra aba e a retomada não
   * criam outra; regra 80, item 7). Quando a tentativa já existia, nada muda, e quem chama lê a gravada, com o limite e a `ordem` da primeira (os dois são sorteados e calculados antes, mas só valem na primeira inserção). O `iniciada_em` é o `now()` do banco, o mesmo com que `limiteBaseEm` foi calculado (a transação é a mesma). Só se chama depois de `prova` achar a atividade na turma do aluno.
   */
  async comecar(atividadeAplicadaId: string, limiteBaseEm: Date | null, ordem: OrdemDaProva | null): Promise<void> {
    await this.banco
      .insert(tentativaAtividade)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId: requestSessao().usuarioId, limiteBaseEm, ordem })
      .onConflictDoNothing({ target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId] })
  }

  /** A tentativa do aluno da sessão, se ele já começou a atividade. */
  async tentativa(atividadeAplicadaId: string): Promise<TentativaLida | undefined> {
    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId))
    return linha
  }

  /**
   * A mesma tentativa, **travada até o fim da transação** (`for update`): a resposta que chega junto com o envio espera por ele e lê a tentativa já enviada, e duas respostas do
   * mesmo aluno se enfileiram (regra 80, item 7). A tentativa não nasce aqui: sem ela, o aluno não começou (só o `comecar` a cria).
   */
  async tentativaTravada(atividadeAplicadaId: string): Promise<TentativaLida | undefined> {
    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId)).for('update')
    return linha
  }

  /** O percentual de tempo adicional do aluno da sessão nesta aplicação, ou nulo. É dado sensível (D35): só serve à conta do limite e da duração dele, e nunca sai de `service`. */
  async percentualDoAluno(atividadeAplicadaId: string): Promise<PercentualDeTempoAdicional | null> {
    const [linha] = await this.banco.select({ percentual: tempoAdicional.percentual }).from(tempoAdicional).where(this.#minha(tempoAdicional, atividadeAplicadaId))
    return (linha?.percentual as PercentualDeTempoAdicional | undefined) ?? null
  }

  /** As extensões que valem para o aluno da sessão nesta aplicação: as dele e as da turma (`aluno_id` nulo). A de outro aluno não volta. */
  async extensoes(atividadeAplicadaId: string): Promise<ExtensaoDoLimite[]> {
    return this.banco
      .select({ alunoId: extensaoDeTempo.alunoId, minutos: extensaoDeTempo.minutos })
      .from(extensaoDeTempo)
      .where(
        and(
          eq(extensaoDeTempo.escolaId, requireEscolaId()),
          eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
          eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
        ),
      )
  }

  /** As extensões de várias aplicações de uma vez, para a lista: o mesmo filtro de `extensoes`, por aplicação. */
  async extensoesDas(atividadeAplicadaIds: readonly string[]): Promise<Map<string, ExtensaoDoLimite[]>> {
    const porAplicacao = new Map<string, ExtensaoDoLimite[]>()
    if (atividadeAplicadaIds.length === 0) return porAplicacao
    const linhas = await this.banco
      .select({ atividadeAplicadaId: extensaoDeTempo.atividadeAplicadaId, alunoId: extensaoDeTempo.alunoId, minutos: extensaoDeTempo.minutos })
      .from(extensaoDeTempo)
      .where(
        and(
          eq(extensaoDeTempo.escolaId, requireEscolaId()),
          eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
          inArray(extensaoDeTempo.atividadeAplicadaId, [...atividadeAplicadaIds]),
          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
        ),
      )
    for (const { atividadeAplicadaId, ...extensao } of linhas) porAplicacao.set(atividadeAplicadaId, [...(porAplicacao.get(atividadeAplicadaId) ?? []), extensao])
    return porAplicacao
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

  /** Marca o envio da tentativa do aluno da sessão, com a hora do banco e `envio = 'aluno'`, uma vez só: a já enviada fica com a primeira hora. */
  async send(atividadeAplicadaId: string): Promise<void> {
    await this.banco
      .update(tentativaAtividade)
      .set({ enviadaEm: sql`now()`, envio: 'aluno' })
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
