import { artefato, atividadeAplicada, convocadoDaSegundaChamada, entrega, requireAnoEmCurso, requireEscolaId, requestSessao, tempoAdicional, tentativaAtividade, turma, usuario, vinculo, type AplicacaoTravada, type Database, type DatabaseTransaction } from '@educa/core'
import type { AtividadesAplicadasQuery, Embaralhar, EstadoDeAtividadeAplicada, EstadoDeEntrega, JanelaDaProva, PercentualDeTempoAdicional, TempoAdicionalDoAluno, TipoDeArtefato } from '@educa/shared'
import { and, desc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { InvariantException, limiteDaTentativa } from '@educa/shared'
import { comVinculoConfirmadoDoProfessor, disciplinaDoArtefato } from '../../assistente/turma-do-professor.repository.js'
import { extensoesDaAplicacao, indisponibilidadesDesde, ultimoPulsoDaApi } from './acompanhamento.repository.js'

/** Uma atividade aplicada como a professora da turma a lê: só contagem de participação, sem aluno. */
export interface AplicacaoLida {
  readonly id: string
  readonly artefatoId: string
  readonly turmaId: string
  readonly titulo: string
  readonly avaliativa: boolean
  readonly estado: EstadoDeAtividadeAplicada
  readonly questoes: number
  readonly aplicadaEm: Date
  readonly encerradaEm: Date | null
  readonly abreEm: Date | null
  readonly fechaEm: Date | null
  readonly duracaoMin: number | null
  readonly embaralharQuestoes: boolean
  readonly embaralharAlternativas: boolean
  readonly segundaChamadaDe: string | null
  /** Quantos alunos têm tempo adicional nesta prova: só a contagem, nunca quais nem o percentual. */
  readonly comTempoAdicional: number
  readonly alunos: number
  readonly iniciaram: number
  readonly enviaram: number
  readonly entrega: { readonly id: string; readonly estado: EstadoDeEntrega } | null
}

/** O artefato que a professora quer aplicar, com o que decide se pode: o tipo, se é versão adaptada, e a entrega dela. */
export interface ArtefatoParaAplicar {
  readonly id: string
  readonly tipo: TipoDeArtefato
  readonly disciplinaId: string
  readonly versaoAdaptada: boolean
  readonly entregaEstado: EstadoDeEntrega | null
}

export interface NovaAplicacao {
  readonly turmaId: string
  readonly artefatoId: string
  readonly avaliativa: boolean
  readonly janela?: JanelaDaProva | undefined
  readonly duracaoMin?: number | undefined
  readonly embaralhar: Embaralhar
  /** A original de que esta é a segunda chamada (RF10); ausente na prova de primeira chamada. */
  readonly segundaChamadaDe?: string | undefined
}

/**
 * A aplicação travada para mudar a janela (`for update`), com o que decide se pode e o que a mudança parcial completa: o estado,
 * se é avaliativa, a turma (de onde vêm os alunos do tempo adicional) e a janela e a duração de **agora**, lidas depois da trava.
 */
export interface AplicacaoParaMudarAJanela {
  readonly id: string
  readonly turmaId: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly avaliativa: boolean
  readonly janela: JanelaDaProva | undefined
  readonly duracaoMin: number | undefined
  readonly embaralhar: Embaralhar
}

/** A original da segunda chamada, como a professora a alcança: o que decide se ela pode ser reaberta, e o que a segunda chamada herda dela. */
export interface OriginalDaSegundaChamada {
  readonly id: string
  readonly turmaId: string
  readonly artefatoId: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly avaliativa: boolean
  /** Nulo na original; a segunda chamada de uma segunda chamada não existe (RF10). */
  readonly segundaChamadaDe: string | null
  readonly embaralhar: Embaralhar
}

/** Quantos alunos a turma tem agora: vínculo de aluno `confirmado`, de usuário ativo. Só a contagem. */
export function alunosDaTurma(colunas: { readonly escolaId: AnyColumn; readonly anoLetivoId: AnyColumn; readonly turmaId: AnyColumn }): SQL<number> {
  return sql<number>`(select count(distinct ${vinculo.usuarioId})::int from ${vinculo} inner join ${usuario} on ${usuario.escolaId} = ${vinculo.escolaId} and ${usuario.id} = ${vinculo.usuarioId} where ${vinculo.escolaId} = ${colunas.escolaId} and ${vinculo.anoLetivoId} = ${colunas.anoLetivoId} and ${vinculo.turmaId} = ${colunas.turmaId} and ${vinculo.papel} = 'aluno' and ${vinculo.estado} = 'confirmado' and ${usuario.desativadoEm} is null)`
}

const tentativasDaAplicacao = (condicao: SQL = sql`true`): SQL<number> =>
  sql<number>`(select count(*)::int from ${tentativaAtividade} where ${tentativaAtividade.escolaId} = ${atividadeAplicada.escolaId} and ${tentativaAtividade.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tentativaAtividade.atividadeAplicadaId} = ${atividadeAplicada.id} and ${condicao})`

/**
 * O lote de correção mais novo da aplicação (o id é `uuidv7`): o pendente ou aprovado, ou, se o último foi rejeitado, o
 * rejeitado. A turma entra no filtro porque é a da aplicação (FK) e é por ela que o índice da entrega começa.
 */
const loteMaisNovo = sql<{ id: string; estado: EstadoDeEntrega } | null>`(select jsonb_build_object('id', ${entrega.id}, 'estado', ${entrega.estado}) from ${entrega} where ${entrega.escolaId} = ${atividadeAplicada.escolaId} and ${entrega.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${entrega.turmaId} = ${atividadeAplicada.turmaId} and ${entrega.atividadeAplicadaId} = ${atividadeAplicada.id} order by ${entrega.id} desc limit 1)`

/** Quantos alunos da aplicação têm tempo adicional: a contagem, nunca quais. */
const comTempoAdicionalDaAplicacao = sql<number>`(select count(*)::int from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id})`

const colunas = {
  id: atividadeAplicada.id,
  artefatoId: atividadeAplicada.artefatoId,
  turmaId: atividadeAplicada.turmaId,
  titulo: artefato.titulo,
  avaliativa: atividadeAplicada.avaliativa,
  estado: atividadeAplicada.estado,
  questoes: sql<number>`jsonb_array_length(${artefato.conteudo} -> 'questoes')`,
  aplicadaEm: atividadeAplicada.aplicadaEm,
  encerradaEm: atividadeAplicada.encerradaEm,
  abreEm: atividadeAplicada.abreEm,
  fechaEm: atividadeAplicada.fechaEm,
  duracaoMin: atividadeAplicada.duracaoMin,
  embaralharQuestoes: atividadeAplicada.embaralharQuestoes,
  embaralharAlternativas: atividadeAplicada.embaralharAlternativas,
  segundaChamadaDe: atividadeAplicada.segundaChamadaDe,
  comTempoAdicional: comTempoAdicionalDaAplicacao,
  alunos: alunosDaTurma(atividadeAplicada),
  iniciaram: tentativasDaAplicacao(),
  enviaram: tentativasDaAplicacao(sql`${tentativaAtividade.enviadaEm} is not null`),
  entrega: loteMaisNovo,
}

/**
 * As atividades aplicadas da escola e do ano letivo do contexto que a professora do contexto alcança: as das turmas em
 * que ela tem vínculo `confirmado` **na disciplina do artefato** (`turma_vinculada`; regra 10, itens 3 e 4). A turma e
 * a disciplina que autorizam são as da própria linha, lidas do banco. Coordenação e aluno não têm vínculo de
 * professor: nada é achado. A professora de outra disciplina da mesma turma também não acha nada.
 *
 * Nada daqui serve ao aluno: o conteúdo do artefato tem o gabarito.
 */
export class AtividadeAplicadaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #noAlcance(): SQL | undefined {
    return and(
      eq(atividadeAplicada.escolaId, requireEscolaId()),
      eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
      comVinculoConfirmadoDoProfessor(this.banco, atividadeAplicada, disciplinaDoArtefato(this.banco, atividadeAplicada)),
    )
  }

  #lidas(condicao: SQL | undefined) {
    return this.banco
      .select(colunas)
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(and(this.#noAlcance(), condicao))
  }

  /**
   * Soma ao `enviaram` as tentativas **vencidas e ainda sem envio** das aplicações abertas: "vencida sem envio conta como enviada em toda leitura" (avaliacao-e-correcao, Tech Spec §5.5, RF5).
   * A rotina e o encerramento é que gravam o fato (`enviada_em = limite`), e a rotina só age quando o `fecha_em` passa: numa janela de um dia, a tentativa de 40 min vence na primeira hora e a
   * professora leria "0 enviaram" o dia inteiro. O limite não se calcula em SQL (extensões, quedas fechadas e lacuna aberta, em ponto fixo): vem da mesma `limiteDaTentativa` do acompanhamento,
   * sobre uma leitura só das tentativas em andamento de todas as aplicações lidas. A encerrada fica como o encerramento a gravou: a que ainda tinha tempo segue sem envio (§5.5).
   *
   * **Só recebe linhas que vieram de `#lidas`**: é lá que estão a escola, o ano e o vínculo da professora (regra 10, item 3). A consulta daqui repete a escola e o ano, mas os ids que a limitam são os das linhas lidas.
   */
  async #contandoAsVencidas(lidas: AplicacaoLida[]): Promise<AplicacaoLida[]> {
    const abertas = lidas.filter((lida) => lida.estado === 'aberta')
    // A encerrada não tem o que somar (o encerramento já gravou o fato): sem aberta, nenhuma ida ao banco.
    if (abertas.length === 0) return lidas
    const emAndamento = await this.banco
      .select({
        atividadeAplicadaId: tentativaAtividade.atividadeAplicadaId,
        alunoId: tentativaAtividade.alunoId,
        iniciadaEm: tentativaAtividade.iniciadaEm,
        limiteBase: tentativaAtividade.limiteBaseEm,
        agora: sql`now()`.mapWith(tentativaAtividade.iniciadaEm),
        ultimoPulso: ultimoPulsoDaApi,
        extensoes: extensoesDaAplicacao(atividadeAplicada.escolaId, atividadeAplicada.id),
        indisponibilidades: indisponibilidadesDesde(tentativaAtividade.iniciadaEm),
      })
      .from(tentativaAtividade)
      // A junção não é só filtro: sem ela as extensões de todas as provas da escola entram no limite (ver `extensoesDaAplicacao`).
      .innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.anoLetivoId, tentativaAtividade.anoLetivoId), eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)))
      .where(
        and(
          eq(tentativaAtividade.escolaId, requireEscolaId()),
          eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
          inArray(tentativaAtividade.atividadeAplicadaId, abertas.map((lida) => lida.id)),
          isNull(tentativaAtividade.enviadaEm),
        ),
      )
    const vencidas = new Map<string, number>()
    for (const tentativa of emAndamento) {
      const limite = limiteDaTentativa({
        alunoId: tentativa.alunoId,
        iniciadaEm: tentativa.iniciadaEm,
        limiteBase: tentativa.limiteBase,
        extensoes: tentativa.extensoes.map((extensao) => ({ alunoId: extensao.alunoId, minutos: extensao.minutos })),
        indisponibilidades: tentativa.indisponibilidades.map((queda) => ({ inicio: new Date(queda.inicio), fim: new Date(queda.fim) })),
        pulso: tentativa.ultimoPulso === null ? null : { ultimoEm: tentativa.ultimoPulso, agora: tentativa.agora },
      })
      const venceu = limite !== null && limite.getTime() <= tentativa.agora.getTime()
      if (venceu) vencidas.set(tentativa.atividadeAplicadaId, (vencidas.get(tentativa.atividadeAplicadaId) ?? 0) + 1)
    }
    return lidas.map((lida) => ({ ...lida, enviaram: lida.enviaram + (vencidas.get(lida.id) ?? 0) }))
  }

  /** A aplicação com esse id, se está no alcance. A de outra escola, de outro ano, de outra turma, de outra disciplina ou inexistente não é achada. */
  async porId(id: string): Promise<AplicacaoLida | undefined> {
    const [linha] = await this.#contandoAsVencidas(await this.#lidas(eq(atividadeAplicada.id, id)))
    return linha
  }

  /** Uma página das aplicações da turma no alcance, da mais nova para a mais antiga, com uma linha a mais que diz se há próxima. */
  async list({ turmaId, pagina, limite }: AtividadesAplicadasQuery): Promise<AplicacaoLida[]> {
    const lidas = await this.#lidas(and(eq(atividadeAplicada.turmaId, turmaId), pagina === undefined ? undefined : lt(atividadeAplicada.id, pagina)))
      .orderBy(desc(atividadeAplicada.id))
      .limit(limite + 1)
    return this.#contandoAsVencidas(lidas)
  }

  /**
   * O artefato que se quer aplicar, se a professora do contexto o alcança: vínculo confirmado na turma **dele**, na
   * disciplina **dele**. Com a entrega da versão adaptada, quando ele é uma.
   *
   * **Trava o artefato (`for update`) até o fim da transação** (classificacao-bncc, 11.0; Tech Spec, seção 5, "Troca"): a troca da habilidade de uma questão toma a mesma trava, então uma espera a outra. Aplicar depois da troca
   * aplica com a habilidade trocada, e a troca depois de aplicar encontra a aplicação e responde `CONFLITO` (P6a, P6b). A trava é só da linha do artefato (`of: artefato`): a entrega da versão adaptada, do outro lado da junção, não se trava.
   * Ela **não exige o dono do artefato** (`criado_por`), como a troca exige (`ArtefatoRepository.lockParaTrocar`): aqui vale o vínculo na turma e na disciplina, e a diferença é de propósito.
   */
  async artefatoParaAplicar(artefatoId: string): Promise<ArtefatoParaAplicar | undefined> {
    const [linha] = await this.banco
      .select({ id: artefato.id, tipo: artefato.tipo, disciplinaId: artefato.disciplinaId, origemId: artefato.origemId, entregaEstado: entrega.estado })
      .from(artefato)
      .leftJoin(entrega, and(eq(entrega.escolaId, artefato.escolaId), eq(entrega.anoLetivoId, artefato.anoLetivoId), eq(entrega.artefatoId, artefato.id)))
      .where(
        and(
          eq(artefato.escolaId, requireEscolaId()),
          eq(artefato.anoLetivoId, requireAnoEmCurso()),
          eq(artefato.id, artefatoId),
          comVinculoConfirmadoDoProfessor(this.banco, artefato, artefato.disciplinaId),
        ),
      )
      .for('update', { of: artefato })
    return linha === undefined ? undefined : { id: linha.id, tipo: linha.tipo, disciplinaId: linha.disciplinaId, versaoAdaptada: linha.origemId !== null, entregaEstado: linha.entregaEstado }
  }

  /** A turma do ano em curso em que a professora do contexto tem vínculo confirmado naquela disciplina: é onde ela pode aplicar. */
  async canAplicarNaTurma(turmaId: string, disciplinaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(
        and(
          eq(turma.escolaId, requireEscolaId()),
          eq(turma.anoLetivoId, requireAnoEmCurso()),
          eq(turma.id, turmaId),
          comVinculoConfirmadoDoProfessor(this.banco, { escolaId: turma.escolaId, anoLetivoId: turma.anoLetivoId, turmaId: turma.id }, disciplinaId),
        ),
      )
    return linha !== undefined
  }

  /**
   * Grava a aplicação, `aberta`, com a pessoa da sessão como quem aplicou (regra 70, item 3). A segunda aberta da mesma
   * turma e do mesmo artefato cai no índice único (23505), que o filtro global traduz em `CONFLITO`.
   */
  async create(nova: NovaAplicacao): Promise<string> {
    const [criada] = await this.banco
      .insert(atividadeAplicada)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: requireAnoEmCurso(),
        turmaId: nova.turmaId,
        artefatoId: nova.artefatoId,
        avaliativa: nova.avaliativa,
        aplicadaPor: requestSessao().usuarioId,
        abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
        fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
        duracaoMin: nova.duracaoMin ?? null,
        embaralharQuestoes: nova.embaralhar.questoes,
        embaralharAlternativas: nova.embaralhar.alternativas,
        segundaChamadaDe: nova.segundaChamadaDe ?? null,
      })
      .returning({ id: atividadeAplicada.id })
    if (criada === undefined) throw new InvariantException('atividade aplicada não criada')
    return criada.id
  }

  /**
   * A aplicação no alcance, **travada até o fim da transação** (`for update`): o segundo encerramento espera o primeiro,
   * e a resposta, a tentativa e o envio do aluno, que travam a mesma linha em `for share`, esperam ou são esperados. É
   * o que faz o conjunto de tentativas e respostas ficar parado antes da correção (regra 80, item 7).
   */
  async lock(id: string): Promise<AplicacaoTravada | undefined> {
    const [linha] = await this.banco
      .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, estado: atividadeAplicada.estado, disciplinaId: artefato.disciplinaId, conteudo: artefato.conteudo })
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
      .for('update', { of: atividadeAplicada })
    return linha
  }

  /**
   * Dos ids dados, quais são aluno **desta turma** do ano em curso, com vínculo `confirmado` e a conta ativa: é o conjunto a que o tempo adicional, a extensão e a
   * segunda chamada se aplicam. O aluno de outra turma, de outra escola, o inexistente e o desativado não voltam, e quem chama responde o mesmo `ENTRADA_INVALIDA` para todos
   * (nenhum confirma o outro). A turma é a da aplicação, lida do banco, nunca a do corpo.
   */
  async alunosDaTurmaEntre(turmaId: string, alunoIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (alunoIds.length === 0) return new Set()
    const linhas = await this.banco
      .selectDistinct({ id: vinculo.usuarioId })
      .from(vinculo)
      .innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.papel, 'aluno'),
          eq(vinculo.estado, 'confirmado'),
          sql`${usuario.desativadoEm} is null`,
          inArray(vinculo.usuarioId, [...alunoIds]),
        ),
      )
    return new Set(linhas.map((linha) => linha.id))
  }

  /**
   * Grava o tempo adicional da aplicação: uma linha por aluno, com quem concedeu (a pessoa da sessão). Sem motivo: a tabela não tem onde guardá-lo. **Que o aluno é da turma da
   * aplicação o banco não garante** (só que é da escola): quem chama confere antes, com `alunosDaTurmaEntre`.
   */
  async saveTempoAdicional(atividadeAplicadaId: string, concedidos: readonly TempoAdicionalDoAluno[]): Promise<void> {
    if (concedidos.length === 0) return
    await this.banco
      .insert(tempoAdicional)
      .values(
        concedidos.map((item) => ({
          escolaId: requireEscolaId(),
          anoLetivoId: requireAnoEmCurso(),
          atividadeAplicadaId,
          alunoId: item.alunoId.toLowerCase(),
          percentual: item.percentual,
          concedidoPor: requestSessao().usuarioId,
        })),
      )
  }

  /** O tempo adicional que a aplicação tem agora, por aluno: lido só para conferir a janela e para trocar a lista. Nenhuma rota o devolve. */
  async tempoAdicionalDaAplicacao(atividadeAplicadaId: string): Promise<TempoAdicionalDoAluno[]> {
    const linhas = await this.banco
      .select({ alunoId: tempoAdicional.alunoId, percentual: tempoAdicional.percentual })
      .from(tempoAdicional)
      .where(and(eq(tempoAdicional.escolaId, requireEscolaId()), eq(tempoAdicional.anoLetivoId, requireAnoEmCurso()), eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId)))
    return linhas.map((linha) => ({ alunoId: linha.alunoId, percentual: linha.percentual as PercentualDeTempoAdicional }))
  }

  /**
   * Troca a lista do tempo adicional pela dada, na mesma transação da aplicação travada: quem não está nela sai, quem está entra ou muda o percentual. A concessão nova leva
   * a pessoa da sessão e a hora do banco; a que não mudou fica como estava. **Que cada aluno é da turma da aplicação
   * é conferência de quem chama** (`alunosDaTurmaEntre`): o banco só garante a escola.
   */
  async trocarTempoAdicional(atividadeAplicadaId: string, lista: readonly TempoAdicionalDoAluno[]): Promise<void> {
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const alunos = lista.map((item) => item.alunoId.toLowerCase())
    await this.banco
      .delete(tempoAdicional)
      .where(
        and(
          eq(tempoAdicional.escolaId, escolaId),
          eq(tempoAdicional.anoLetivoId, anoLetivoId),
          eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId),
          alunos.length === 0 ? undefined : notInArray(tempoAdicional.alunoId, alunos),
        ),
      )
    if (lista.length === 0) return
    await this.banco
      .insert(tempoAdicional)
      .values(lista.map((item) => ({ escolaId, anoLetivoId, atividadeAplicadaId, alunoId: item.alunoId.toLowerCase(), percentual: item.percentual, concedidoPor: requestSessao().usuarioId })))
      .onConflictDoUpdate({
        target: [tempoAdicional.escolaId, tempoAdicional.atividadeAplicadaId, tempoAdicional.alunoId],
        set: { percentual: sql`excluded.percentual`, concedidoPor: sql`excluded.concedido_por`, concedidoEm: sql`now()` },
        setWhere: sql`${tempoAdicional.percentual} <> excluded.percentual`,
      })
  }

  /**
   * A aplicação no alcance do professor, **travada até o fim da transação** (`for update`), com a janela e a duração **de agora**: quem espera a trava lê o que o outro gravou
   * (a corrida de duas mudanças de janela: a segunda relê e confere o conjunto de novo). Quem começa a prova toma a mesma linha em `for share`, então o `PATCH` espera o começo
   * terminar e só então olha `existeTentativa`. A de outra escola, de outra turma, de outra disciplina e a inexistente não são achadas.
   */
  async lockParaMudarAJanela(id: string): Promise<AplicacaoParaMudarAJanela | undefined> {
    const [linha] = await this.banco
      .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, estado: atividadeAplicada.estado, avaliativa: atividadeAplicada.avaliativa, abreEm: atividadeAplicada.abreEm, fechaEm: atividadeAplicada.fechaEm, duracaoMin: atividadeAplicada.duracaoMin, embaralharQuestoes: atividadeAplicada.embaralharQuestoes, embaralharAlternativas: atividadeAplicada.embaralharAlternativas })
      .from(atividadeAplicada)
      .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
      .for('update', { of: atividadeAplicada })
    if (linha === undefined) return undefined
    return {
      id: linha.id,
      turmaId: linha.turmaId,
      estado: linha.estado,
      avaliativa: linha.avaliativa,
      janela: linha.abreEm === null || linha.fechaEm === null ? undefined : { abreEm: linha.abreEm.toISOString(), fechaEm: linha.fechaEm.toISOString() },
      duracaoMin: linha.duracaoMin ?? undefined,
      embaralhar: { questoes: linha.embaralharQuestoes, alternativas: linha.embaralharAlternativas },
    }
  }

  /** Alguém já começou? Lido **depois** da trava da aplicação: o começo em andamento já confirmou ou nunca vai conseguir inserir antes de a trava ser solta. */
  async existeTentativa(atividadeAplicadaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: tentativaAtividade.id })
      .from(tentativaAtividade)
      .where(and(eq(tentativaAtividade.escolaId, requireEscolaId()), eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)))
      .limit(1)
    return linha !== undefined
  }

  /** Grava a janela, a duração e o que a mudança parcial completou. Só a aplicação aberta e do ano em curso. */
  async saveJanela(id: string, nova: { readonly janela: JanelaDaProva | undefined; readonly duracaoMin: number | undefined }): Promise<void> {
    await this.banco
      .update(atividadeAplicada)
      .set({
        abreEm: nova.janela === undefined ? null : new Date(nova.janela.abreEm),
        fechaEm: nova.janela === undefined ? null : new Date(nova.janela.fechaEm),
        duracaoMin: nova.duracaoMin ?? null,
      })
      .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
  }

  /**
   * A aplicação que se quer reabrir em segunda chamada, **no alcance da professora** (turma e disciplina dela; a de outra escola, outra turma, outra disciplina, outro ano e a inexistente não são achadas),
   * sem trava: só a original **encerrada** é aceita, e `encerrada` não volta a `aberta`, então o estado lido aqui já é o definitivo.
   */
  async originalDaSegundaChamada(id: string): Promise<OriginalDaSegundaChamada | undefined> {
    const [linha] = await this.banco
      .select({
        id: atividadeAplicada.id,
        turmaId: atividadeAplicada.turmaId,
        artefatoId: atividadeAplicada.artefatoId,
        estado: atividadeAplicada.estado,
        avaliativa: atividadeAplicada.avaliativa,
        segundaChamadaDe: atividadeAplicada.segundaChamadaDe,
        embaralharQuestoes: atividadeAplicada.embaralharQuestoes,
        embaralharAlternativas: atividadeAplicada.embaralharAlternativas,
      })
      .from(atividadeAplicada)
      .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
    if (linha === undefined) return undefined
    const { embaralharQuestoes, embaralharAlternativas, ...resto } = linha
    return { ...resto, embaralhar: { questoes: embaralharQuestoes, alternativas: embaralharAlternativas } }
  }

  /**
   * Dos alunos dados, quais já **enviaram** a prova: a tentativa com `enviada_em` da original **ou de qualquer segunda chamada dela**, seja o envio do aluno ou o do limite (a vencida conta como enviada, e o encerramento a grava com
   * `enviada_em` = limite). Quem enviou uma segunda chamada já encerrada não é convocado de novo: a prova foi feita, e uma terceira daria duas correções da mesma prova. Quem nunca começou e quem a professora cortou antes do limite,
   * levado com o salvo e sem `enviada_em`, não voltam: continuam convocáveis (Tech Spec §5.5 e §5.9).
   */
  async quemEnviou(originalId: string, alunoIds: readonly string[]): Promise<ReadonlySet<string>> {
    const linhas = await this.banco
      .select({ alunoId: tentativaAtividade.alunoId })
      .from(tentativaAtividade)
      .innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)))
      .where(
        and(
          eq(tentativaAtividade.escolaId, requireEscolaId()),
          eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
          or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
          inArray(tentativaAtividade.alunoId, [...alunoIds]),
          isNotNull(tentativaAtividade.enviadaEm),
        ),
      )
    return new Set(linhas.map((linha) => linha.alunoId))
  }

  /** Grava os convocados da segunda chamada, na mesma transação da aplicação. Que cada um é da turma e não enviou a original é conferência de quem chama. */
  async saveConvocados(atividadeAplicadaId: string, alunoIds: readonly string[]): Promise<void> {
    if (alunoIds.length === 0) return
    await this.banco.insert(convocadoDaSegundaChamada).values(alunoIds.map((alunoId) => ({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId })))
  }
}
