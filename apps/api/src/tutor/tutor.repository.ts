import {
  QuedasDaApiRepository,
  artefato,
  atividadeAplicada,
  configuracaoOperacionalEscola,
  convocadoDaSegundaChamada,
  correcao,
  diaDeUso,
  disciplina,
  entrega,
  execucaoAgente,
  extensaoDeTempo,
  requireAnoEmCurso,
  requireEscolaId,
  FUSO_DO_USO,
  globalMeter,
  material,
  mensagemTutor,
  systemClock,
  serie,
  requestSessao,
  sinalTutor,
  tentativaAtividade,
  turma,
  vinculo,
  type Database,
  type Clock,
  type Meter,
  type DatabaseTransaction,
} from '@educa/core'
import { InvariantException, limiteDaTentativa, TIPOS_DE_SINAL_DE_TRABALHO, TROCAS_POR_DIA_PADRAO_DO_TUTOR, type Citacao, type Etapa, type EstadoDeAtividadeAplicada, type TipoDeMensagemDoTutor, type TipoDeSinal, type TipoDeSinalDeTrabalho } from '@educa/shared'
import { and, asc, count, desc, eq, exists, gte, inArray, isNotNull, isNull, lt, lte, notExists, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { medirATrava } from './trava-duration.js'
import { declaradoParaASerie, proprioOuComLicencaVigente } from '../material/material.repository.js'
import type { TurnoDoAluno } from './sinais-do-turno.js'

export interface TurmaDoAluno {
  readonly turmaId: string
  /** A série da turma: o material que o Tutor lê é o declarado para ela (RF7). */
  readonly serieId: string
  readonly serie: { readonly etapa: Etapa; readonly ano: number }
}

/** A atividade aplicada à turma do aluno. `conteudo` é o do artefato, ainda não validado: tem gabarito e explicação, e **não sai do service**. */
export interface AtividadeDaTurma {
  readonly id: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly avaliativa: boolean
  readonly titulo: string
  readonly conteudo: unknown
  readonly disciplinaId: string
  readonly disciplina: string
}

export interface MaterialDaTurma {
  readonly id: string
  readonly disciplinaId: string
  readonly disciplina: string
  readonly paginas: number | null
}

/** Onde o aluno estava ao perguntar: é o que a mensagem dele guarda além do texto. */
export interface ReferenciaDaPergunta {
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly materialId: string | null
  readonly pagina: number | null
}

export interface PerguntaGravada extends ReferenciaDaPergunta {
  readonly id: string
  readonly execucaoId: string
  readonly turmaId: string
  readonly texto: string
  readonly criadaEm: Date
}

export interface MensagemDaConversa {
  readonly id: string
  readonly autor: 'aluno' | 'tutor'
  readonly tipo: TipoDeMensagemDoTutor
  readonly texto: string
  readonly citacoes: Citacao[] | null
  readonly criadaEm: Date
}

export type RespostaDoTutor = { readonly tipo: 'texto'; readonly texto: string; readonly citacoes: Citacao[] } | { readonly tipo: 'assunto_delicado'; readonly texto: string }

export interface SinalAGravar {
  readonly tipo: TipoDeSinal
  readonly atividadeAplicadaId?: string | null
  readonly questao?: number | null
  readonly materialId?: string | null
  readonly pagina?: number | null
}

export interface TrabalhoDoAluno {
  readonly atividadeAplicadaId: string
  readonly titulo: string
  readonly conteudo: unknown
  readonly enviadaEm: Date | null
  /** Só de lote aprovado: sem a aprovação da professora, os três vêm nulos. */
  readonly acertos: number | null
  readonly total: number | null
  readonly porHabilidade: unknown
}

export interface SinalDoAluno {
  readonly tipo: TipoDeSinalDeTrabalho
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly criadoEm: Date
}

const MS_POR_MINUTO = 60_000

const respostaDoTurno = alias(mensagemTutor, 'resposta_do_turno')

/**
 * O Tutor **do aluno da sessão** (MVP, A4): a turma dele, o que ele alcança, a conversa dele e a memória do trabalho
 * dele. Escola, ano letivo e aluno vêm do contexto (regra 10, item 3), em toda cláusula: nenhum método recebe aluno,
 * escola nem ano, e por isso não existe leitura da conversa, da memória ou do uso de um colega por aqui.
 *
 * O texto das mensagens nunca sai daqui para sinal, execução, consumo, auditoria nem log (regra 20, itens 9 e 14).
 *
 * O pacote de atividade e correção é de outro módulo: o que o Tutor precisa dele (a atividade aplicada à turma, a
 * correção de lote aprovado) é **lido direto das tabelas, aqui**, com o mesmo escopo.
 */
export class TutorDoAlunoRepository {
  constructor(
    private readonly banco: Database | DatabaseTransaction,
    private readonly relogio: Clock = systemClock,
    private readonly medidor: Meter = globalMeter(),
  ) {}

  #aluno(): { escolaId: string; anoLetivoId: string; alunoId: string } {
    return { escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), alunoId: requestSessao().usuarioId }
  }

  /** As mensagens do aluno do contexto, no ano em curso: a cláusula que toda leitura de conversa leva. */
  #doAluno(): SQL | undefined {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    return and(eq(mensagemTutor.escolaId, escolaId), eq(mensagemTutor.anoLetivoId, anoLetivoId), eq(mensagemTutor.alunoId, alunoId))
  }

  /** A turma do vínculo de aluno `confirmado` da sessão, no ano em curso. Sem vínculo, `undefined`: o aluno ainda não aprovado não usa o Tutor. */
  async turmaDoAluno(): Promise<TurmaDoAluno | undefined> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const [linha] = await this.banco
      .select({ turmaId: turma.id, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(vinculo)
      .innerJoin(turma, and(eq(turma.escolaId, vinculo.escolaId), eq(turma.anoLetivoId, vinculo.anoLetivoId), eq(turma.id, vinculo.turmaId)))
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.usuarioId, alunoId), eq(vinculo.papel, 'aluno'), eq(vinculo.estado, 'confirmado')))
      .orderBy(desc(vinculo.id))
      .limit(1)
    return linha === undefined ? undefined : { turmaId: linha.turmaId, serieId: linha.serieId, serie: { etapa: linha.etapa, ano: linha.ano } }
  }

  /** As disciplinas que a turma tem: as de professor com vínculo confirmado nela, em ordem de nome. */
  async disciplinasDaTurma(turmaId: string): Promise<string[]> {
    const { escolaId, anoLetivoId } = this.#aluno()
    const linhas = await this.banco
      .selectDistinct({ nome: disciplina.nome })
      .from(vinculo)
      .innerJoin(disciplina, and(eq(disciplina.escolaId, vinculo.escolaId), eq(disciplina.id, vinculo.disciplinaId)))
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), eq(vinculo.papel, 'professor'), eq(vinculo.estado, 'confirmado')))
      .orderBy(asc(disciplina.nome))
    return linhas.map((linha) => linha.nome)
  }

  /**
   * A atividade aplicada **à turma dada**, na escola e no ano do contexto. A de outra turma, de outro ano, de outra
   * escola e a que não existe: `undefined`, e quem chama responde igual para todas (regra 10, item 6).
   */
  async atividadeDaTurma(turmaId: string, atividadeAplicadaId: string): Promise<AtividadeDaTurma | undefined> {
    const { escolaId, anoLetivoId } = this.#aluno()
    const [linha] = await this.banco
      .select({
        id: atividadeAplicada.id,
        estado: atividadeAplicada.estado,
        avaliativa: atividadeAplicada.avaliativa,
        titulo: artefato.titulo,
        conteudo: artefato.conteudo,
        disciplinaId: artefato.disciplinaId,
        disciplina: disciplina.nome,
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId), eq(disciplina.id, artefato.disciplinaId)))
      .where(and(eq(atividadeAplicada.escolaId, escolaId), eq(atividadeAplicada.anoLetivoId, anoLetivoId), eq(atividadeAplicada.turmaId, turmaId), eq(atividadeAplicada.id, atividadeAplicadaId)))
    return linha
  }

  /**
   * O material que a turma dada pode usar: da escola do contexto, `pronto`, não excluído, e de disciplina que a turma
   * tem (há professor com vínculo confirmado nela, na turma), **declarado para a série da turma e próprio ou de licença
   * vigente em `hoje`** (o dia de São Paulo, do `Clock` da `TrechoSearch`). A `TrechoSearch` não confere quem pede: é aqui que o
   * aluno é impedido de ler material de disciplina que a turma dele não tem, e o que saiu do alcance (edição substituída, licença
   * vencida, série tirada) responde como o inexistente.
   */
  async materialDaTurma(turmaId: string, serieId: string, hoje: string, materialId: string): Promise<MaterialDaTurma | undefined> {
    const { escolaId, anoLetivoId } = this.#aluno()
    const turmaTemADisciplina = this.banco
      .select({ um: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, material.escolaId),
          eq(vinculo.anoLetivoId, anoLetivoId),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.disciplinaId, material.disciplinaId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
    const [linha] = await this.banco
      .select({ id: material.id, disciplinaId: material.disciplinaId, disciplina: disciplina.nome, paginas: material.paginas })
      .from(material)
      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
      .where(
        and(
          eq(material.escolaId, escolaId),
          eq(material.id, materialId),
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          exists(turmaTemADisciplina),
          declaradoParaASerie(this.banco, serieId),
          proprioOuComLicencaVigente(this.banco, hoje),
        ),
      )
    return linha
  }

  /**
   * As avaliativas abertas da turma que **o aluno do contexto** pode ter à frente agora, cada uma com a tentativa dele (se começou) e o convocado (se é a
   * segunda chamada). É a consulta do caminho quente do Tutor (roda a cada turno): desce pela turma, no índice `(escola_id, turma_id, id)`, e a tentativa e o
   * convocado entram pela chave única de cada um. A prova que ainda não abriu (`abre_em` no futuro, pelo `now()` do banco) não entra; a sem janela entra sempre; a
   * segunda chamada só entra para o convocado. Separada para o `EXPLAIN` do teste ler o `.toSQL()` desta mesma consulta.
   */
  consultaDasAvaliativasAbertas(turmaId: string) {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    return this.banco
      .select({
        id: atividadeAplicada.id,
        titulo: artefato.titulo,
        fechaEm: atividadeAplicada.fechaEm,
        iniciadaEm: tentativaAtividade.iniciadaEm,
        limiteBaseEm: tentativaAtividade.limiteBaseEm,
        agora: sql<Date>`now()`.mapWith(atividadeAplicada.aplicadaEm),
      })
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .leftJoin(
        tentativaAtividade,
        and(eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId), eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id), eq(tentativaAtividade.alunoId, alunoId)),
      )
      .leftJoin(convocadoDaSegundaChamada, and(eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId), eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id), eq(convocadoDaSegundaChamada.alunoId, alunoId)))
      .where(
        and(
          eq(atividadeAplicada.escolaId, escolaId),
          eq(atividadeAplicada.anoLetivoId, anoLetivoId),
          eq(atividadeAplicada.turmaId, turmaId),
          eq(atividadeAplicada.avaliativa, true),
          eq(atividadeAplicada.estado, 'aberta'),
          or(isNull(atividadeAplicada.abreEm), lte(atividadeAplicada.abreEm, sql`now()`)),
          or(isNull(atividadeAplicada.segundaChamadaDe), isNotNull(convocadoDaSegundaChamada.id)),
        ),
      )
      .orderBy(asc(atividadeAplicada.id))
  }

  /**
   * A avaliativa que **trava o Tutor para este aluno**, se há (regra 30, item 10; Tech Spec §5.10). Por aluno, e não pela turma: do `abre_em` até o fim da janela
   * (com as extensões da turma) **ou o limite dele, o que vier depois**. O aluno estendido segue travado depois do `fecha_em`, e o colega sem extensão destrava;
   * a segunda chamada trava só o convocado. A avaliativa sem janela (a de antes da F6) trava enquanto está aberta. O limite é o `limiteDaTentativa`, com as
   * indisponibilidades e a lacuna aberta, a mesma função do PUT: a queda da API não destrava o Tutor no meio da prova. Só o título sai, para a tela dizer qual.
   *
   * **O limite, a extensão e o tempo adicional servem só a esta conferência e nunca entram no contexto do modelo** (D66; regra 70, item 4d): a memória do Tutor é o trabalho do
   * aluno, e o tempo que ele teve é adaptação (regra 20, item 3). Quem reaproveitar esta consulta para outra coisa não leva estes campos para a memória nem para o pedido ao provedor.
   *
   * A duração sai em `tutor.trava.duracao{escola_id}`, com qualquer desfecho: roda a cada turno, três vezes.
   */
  async avaliativaAberta(turmaId: string): Promise<{ titulo: string } | undefined> {
    return medirATrava(this.medidor, this.#aluno().escolaId, () => this.#quemTrava(turmaId))
  }

  async #quemTrava(turmaId: string): Promise<{ titulo: string } | undefined> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const quedas = new QuedasDaApiRepository(this.banco)
    for (const candidata of await this.consultaDasAvaliativasAbertas(turmaId)) {
      if (candidata.fechaEm === null) return { titulo: candidata.titulo }
      // Só as extensões que alcançam este aluno: a da turma e as dele, desta prova. A função do limite e a soma abaixo repetem o filtro; o do banco poupa ler a dos colegas.
      const extensoes = await this.banco
        .select({ alunoId: extensaoDeTempo.alunoId, minutos: extensaoDeTempo.minutos })
        .from(extensaoDeTempo)
        .where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))))
      const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId === null).reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
      const fimDaJanela = candidata.fechaEm.getTime() + daTurmaEmMs
      const limite =
        candidata.iniciadaEm === null
          ? null
          : limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
      if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
    }
    return undefined
  }

  /**
   * Põe em fila, até o fim da transação, tudo que conta e grava troca deste aluno: dez envios ao mesmo tempo contam um
   * de cada vez, e nenhum passa do freio por ter contado antes de o outro gravar (regra 80, item 7).
   */
  async lockAluno(): Promise<void> {
    const { escolaId, alunoId } = this.#aluno()
    await this.banco.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`tutor.troca:${escolaId}:${alunoId}`}, 0))`)
  }

  /** Grava o que o aluno escreveu, ligado à execução que ele disparou, e devolve o id. É o único lugar em que o texto dele é gravado. */
  async savePergunta(execucaoId: string, turmaId: string, texto: string, onde: ReferenciaDaPergunta): Promise<string> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const [gravada] = await this.banco
      .insert(mensagemTutor)
      .values({ escolaId, anoLetivoId, turmaId, alunoId, execucaoId, autor: 'aluno', tipo: 'texto', texto, ...onde })
      .returning({ id: mensagemTutor.id })
    if (gravada === undefined) throw new InvariantException('pergunta ao Tutor não gravada')
    return gravada.id
  }

  /**
   * Grava a resposta do Tutor à pergunta, na conversa em que ela foi feita. A reexecução não responde duas vezes: o
   * índice único `(escola_id, execucao_id, autor)` decide, e a segunda relê a que já está gravada (D49).
   */
  async saveResposta(pergunta: Pick<PerguntaGravada, 'execucaoId' | 'turmaId' | 'atividadeAplicadaId'>, resposta: RespostaDoTutor): Promise<string> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const [gravada] = await this.banco
      .insert(mensagemTutor)
      .values({
        escolaId,
        anoLetivoId,
        turmaId: pergunta.turmaId,
        alunoId,
        execucaoId: pergunta.execucaoId,
        // A conversa é por atividade: a resposta fica na mesma em que a pergunta foi feita.
        atividadeAplicadaId: pergunta.atividadeAplicadaId,
        autor: 'tutor',
        tipo: resposta.tipo,
        texto: resposta.texto,
        citacoes: resposta.tipo === 'texto' ? resposta.citacoes : null,
      })
      .onConflictDoNothing({ target: [mensagemTutor.escolaId, mensagemTutor.execucaoId, mensagemTutor.autor] })
      .returning({ id: mensagemTutor.id })
    if (gravada !== undefined) return gravada.id
    const [existente] = await this.banco
      .select({ id: mensagemTutor.id })
      .from(mensagemTutor)
      .where(and(this.#doAluno(), eq(mensagemTutor.execucaoId, pergunta.execucaoId), eq(mensagemTutor.autor, 'tutor')))
    if (existente === undefined) throw new InvariantException('resposta do Tutor não gravada')
    return existente.id
  }

  /**
   * Tira da pergunta a questão, o material e a página, e deixa só a conversa em que ela foi feita. É o que acontece com
   * o turno de assunto delicado: ele não é referência a trabalho nenhum, e não aparece como "em que o aluno estava".
   */
  async tirarReferenciaDaPergunta(perguntaId: string): Promise<void> {
    await this.banco
      .update(mensagemTutor)
      .set({ questao: null, materialId: null, pagina: null })
      .where(and(this.#doAluno(), eq(mensagemTutor.id, perguntaId), eq(mensagemTutor.autor, 'aluno')))
  }

  /**
   * Grava um sinal do aluno do contexto. **Só tipo e referência**: a tabela não tem coluna de texto, e este método não
   * recebe texto nenhum. O `atencao_humana` vai sem referência (o banco recusa qualquer uma). Reexecução não avisa
   * duas vezes: índice único `(escola_id, execucao_id, tipo)`.
   */
  async saveSinal(execucaoId: string, turmaId: string, sinal: SinalAGravar): Promise<void> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const semReferencia = sinal.tipo === 'atencao_humana'
    await this.banco
      .insert(sinalTutor)
      .values({
        escolaId,
        anoLetivoId,
        turmaId,
        alunoId,
        execucaoId,
        tipo: sinal.tipo,
        atividadeAplicadaId: semReferencia ? null : (sinal.atividadeAplicadaId ?? null),
        questao: semReferencia ? null : (sinal.questao ?? null),
        materialId: semReferencia ? null : (sinal.materialId ?? null),
        pagina: semReferencia ? null : (sinal.pagina ?? null),
      })
      .onConflictDoNothing()
  }

  /**
   * A pergunta que este aluno gravou com **esta execução**, no ano em curso: é o que o comando relê pelo id da execução. A execução de
   * outro aluno, a de outra escola e a de outro ano não casam com a conversa do aluno da sessão, e a resposta é a do inexistente.
   *
   * Duas conferências, que se complementam: aqui, o escopo da conversa (`escolaId`, `anoLetivoId` e `alunoId` da mensagem); no `paraExecutar`
   * do `ExecucaoDaSessaoRepository`, o de quem pediu a execução (`solicitadaPor`). Este método não cruza com `execucao_agente`: não tire
   * nenhuma das duas achando que a outra basta.
   */
  async perguntaDaExecucao(execucaoId: string): Promise<PerguntaGravada | undefined> {
    const [linha] = await this.banco
      .select({
        id: mensagemTutor.id,
        execucaoId: mensagemTutor.execucaoId,
        turmaId: mensagemTutor.turmaId,
        texto: mensagemTutor.texto,
        atividadeAplicadaId: mensagemTutor.atividadeAplicadaId,
        questao: mensagemTutor.questao,
        materialId: mensagemTutor.materialId,
        pagina: mensagemTutor.pagina,
        criadaEm: mensagemTutor.criadaEm,
      })
      .from(mensagemTutor)
      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno'), eq(mensagemTutor.execucaoId, execucaoId)))
    return linha
  }

  /** A conversa é por atividade aplicada; sem atividade, é a conversa fora de atividade. */
  #daConversa(atividadeAplicadaId: string | null): SQL {
    return atividadeAplicadaId === null ? isNull(mensagemTutor.atividadeAplicadaId) : eq(mensagemTutor.atividadeAplicadaId, atividadeAplicadaId)
  }

  /** Uma página da conversa do aluno, da mais nova para a mais antiga, antes de `antes`. Só a dele. */
  async conversa(atividadeAplicadaId: string | null, antes: string | undefined, limite: number): Promise<MensagemDaConversa[]> {
    return this.banco
      .select({ id: mensagemTutor.id, autor: mensagemTutor.autor, tipo: mensagemTutor.tipo, texto: mensagemTutor.texto, citacoes: mensagemTutor.citacoes, criadaEm: mensagemTutor.criadaEm })
      .from(mensagemTutor)
      .where(and(this.#doAluno(), this.#daConversa(atividadeAplicadaId), antes === undefined ? undefined : lt(mensagemTutor.id, antes)))
      .orderBy(desc(mensagemTutor.id))
      .limit(limite)
  }

  /**
   * Os últimos turnos da mesma conversa, antes da pergunta, do mais novo para o mais antigo, **sem os turnos de assunto
   * delicado**. O filtro é o `tipo` gravado na resposta do turno, não o texto: o que o aluno escreveu naquele turno e a
   * mensagem fixa que ele recebeu nunca voltam ao modelo, mesmo que o texto da mensagem fixa mude um dia (D36, D62).
   */
  async turnosParaATarefa(pergunta: Pick<PerguntaGravada, 'id' | 'atividadeAplicadaId'>, limite: number): Promise<{ autor: 'aluno' | 'tutor'; texto: string }[]> {
    const respostaFixaDoTurno = this.banco
      .select({ um: respostaDoTurno.id })
      .from(respostaDoTurno)
      .where(and(eq(respostaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaDoTurno.execucaoId, mensagemTutor.execucaoId), eq(respostaDoTurno.tipo, 'assunto_delicado')))
    return this.banco
      .select({ autor: mensagemTutor.autor, texto: mensagemTutor.texto })
      .from(mensagemTutor)
      .where(and(this.#doAluno(), this.#daConversa(pergunta.atividadeAplicadaId), lt(mensagemTutor.id, pergunta.id), notExists(respostaFixaDoTurno)))
      .orderBy(desc(mensagemTutor.id))
      .limit(limite)
  }

  /**
   * Onde o aluno pediu ajuda nos turnos anteriores **que o Tutor respondeu** (a resposta é `texto`), do mais antigo para
   * o mais novo, até `limite`. Sem o texto: é só a referência e o dia de uso, que é o que a regra dos sinais lê.
   */
  async turnosRespondidos(antesDe: string, limite: number): Promise<TurnoDoAluno[]> {
    const respondido = this.banco
      .select({ um: respostaDoTurno.id })
      .from(respostaDoTurno)
      .where(and(eq(respostaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaDoTurno.execucaoId, mensagemTutor.execucaoId), eq(respostaDoTurno.autor, 'tutor'), eq(respostaDoTurno.tipo, 'texto')))
    const linhas = await this.banco
      .select({ atividadeAplicadaId: mensagemTutor.atividadeAplicadaId, questao: mensagemTutor.questao, materialId: mensagemTutor.materialId, pagina: mensagemTutor.pagina, criadaEm: mensagemTutor.criadaEm })
      .from(mensagemTutor)
      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno'), lt(mensagemTutor.id, antesDe), exists(respondido)))
      .orderBy(desc(mensagemTutor.id))
      .limit(limite)
    return linhas.reverse().map(({ criadaEm, ...onde }) => ({ ...onde, dia: diaDeUso(criadaEm) }))
  }

  /**
   * As trocas do aluno hoje e o freio do dia da escola, para "Hoje: N de 60". **A mesma conta do freio**
   * (`OrcamentoRepository`, em `apps/api/src/ia/`): pergunta do aluno, na escola, desde a virada do dia no fuso do uso,
   * cuja execução não terminou `falhou`. Se uma das duas mudar sem a outra, a tela mostra um número e o freio usa outro.
   */
  async usoDeHoje(): Promise<{ hoje: number; limiteDoDia: number }> {
    const { escolaId, alunoId } = this.#aluno()
    const [limites] = await this.banco.select({ porDia: configuracaoOperacionalEscola.tutorTrocasPorDia }).from(configuracaoOperacionalEscola).where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
    const falhou = this.banco
      .select({ id: execucaoAgente.id })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou')))
    const [linha] = await this.banco
      .select({ total: count() })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, escolaId),
          eq(mensagemTutor.alunoId, alunoId),
          eq(mensagemTutor.autor, 'aluno'),
          gte(mensagemTutor.criadaEm, sql`(${diaDeUso(this.relogio.agora())}::date)::timestamp at time zone ${FUSO_DO_USO}`),
          notExists(falhou),
        ),
      )
    return { hoje: linha?.total ?? 0, limiteDoDia: limites?.porDia ?? TROCAS_POR_DIA_PADRAO_DO_TUTOR }
  }

  /**
   * As atividades que o aluno abriu, da mais nova para a mais antiga, com o resultado **só quando o lote foi aprovado**:
   * a junção com a entrega exige `estado = 'aprovada'`, e por ela a correção pendente ou rejeitada não tem como chegar
   * ao Tutor nem ao aluno (regra 70, item 3). Sem aprovação, `acertos`, `total` e `porHabilidade` vêm nulos.
   */
  async trabalhos(limite: number): Promise<TrabalhoDoAluno[]> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    return this.banco
      .select({
        atividadeAplicadaId: tentativaAtividade.atividadeAplicadaId,
        titulo: artefato.titulo,
        conteudo: artefato.conteudo,
        enviadaEm: tentativaAtividade.enviadaEm,
        acertos: correcao.acertos,
        total: correcao.total,
        porHabilidade: correcao.porHabilidade,
      })
      .from(tentativaAtividade)
      .innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.anoLetivoId, tentativaAtividade.anoLetivoId), eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)))
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .leftJoin(
        entrega,
        and(eq(entrega.escolaId, tentativaAtividade.escolaId), eq(entrega.anoLetivoId, tentativaAtividade.anoLetivoId), eq(entrega.atividadeAplicadaId, tentativaAtividade.atividadeAplicadaId), eq(entrega.tipo, 'lote_de_correcao'), eq(entrega.estado, 'aprovada')),
      )
      .leftJoin(correcao, and(eq(correcao.escolaId, entrega.escolaId), eq(correcao.anoLetivoId, entrega.anoLetivoId), eq(correcao.entregaId, entrega.id), eq(correcao.alunoId, tentativaAtividade.alunoId)))
      .where(and(eq(tentativaAtividade.escolaId, escolaId), eq(tentativaAtividade.anoLetivoId, anoLetivoId), eq(tentativaAtividade.alunoId, alunoId)))
      .orderBy(desc(tentativaAtividade.id))
      .limit(limite)
  }

  /** Os sinais **de trabalho** do aluno, do mais novo para o mais antigo. O `atencao_humana` não é memória e fica de fora, na própria consulta. */
  async sinaisDeTrabalho(limite: number): Promise<SinalDoAluno[]> {
    const { escolaId, anoLetivoId, alunoId } = this.#aluno()
    const linhas = await this.banco
      .select({ tipo: sinalTutor.tipo, atividadeAplicadaId: sinalTutor.atividadeAplicadaId, questao: sinalTutor.questao, criadoEm: sinalTutor.criadoEm })
      .from(sinalTutor)
      .where(and(eq(sinalTutor.escolaId, escolaId), eq(sinalTutor.anoLetivoId, anoLetivoId), eq(sinalTutor.alunoId, alunoId), inArray(sinalTutor.tipo, [...TIPOS_DE_SINAL_DE_TRABALHO])))
      .orderBy(desc(sinalTutor.id))
      .limit(limite)
    return linhas as SinalDoAluno[]
  }
}
