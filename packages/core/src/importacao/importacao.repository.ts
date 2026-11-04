import { ErrorCode, InvariantException, type CriarSerieRequest, type EstadoDeVinculo, type EstadoDoProfessor, type MotivoDeEncerramentoDeVinculo, type Serie, type ErroDaImportacao, type EstadoDaImportacao, type ResumoDaImportacao, type TipoDeEventoDoCalendario, type TipoDePlanilha } from '@educa/shared'
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { estadoDoProfessor, type UltimoConviteDoProfessor } from '../convite/estado-do-professor.js'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { conta } from '../db/schema/conta.js'
import { convite } from '../db/schema/convite.js'
import { eventoCalendario } from '../db/schema/evento-calendario.js'
import { importacaoPlanilha } from '../db/schema/importacao-planilha.js'
import { usuario } from '../db/schema/usuario.js'
import { DomainException } from '../error/domain.exception.js'
import { postgresErrorIn } from '../error/summarize-error.js'
import { requestIdentity } from '../identidade/auth.guard.js'
import { DecisaoRepository } from '../estrutura/decisao.repository.js'
import { ListaRepository, type AlunosParaReimportar, type CorrecaoDeNomeNaLista, type TransferenciaDeAprovado, type TransferenciaDeNome } from '../estrutura/lista.repository.js'
import { SerieRepository } from '../estrutura/serie.repository.js'
import { TurmaRepository, type TurmaDoAno } from '../estrutura/turma.repository.js'
import { VinculoRepository } from '../estrutura/vinculo.repository.js'

/** O ano em que a planilha grava: o em curso da sessão, ou o planejado que a coordenação escolheu. */
export interface AnoDeDestino {
  readonly id: string
  readonly inicio: string
  readonly fim: string
  readonly situacao: 'planejado' | 'em_curso' | 'encerrado'
}

/** Um evento do calendário como está gravado: o suficiente para comparar com a planilha. */
export interface EventoGravado {
  readonly id: string
  readonly tipo: TipoDeEventoDoCalendario
  readonly inicio: string
  readonly fim: string
  readonly descricao: string
}

export type EventoNovo = Omit<EventoGravado, 'id'>

/** Um professor da escola como a planilha o compara: o `email` vem da conta dele e só serve para casar a linha (nunca sai da API), e o `estado` é o da lista. */
export interface ProfessorDaEscola {
  readonly usuarioId: string
  readonly nome: string
  readonly email: string | null
  readonly estado: EstadoDoProfessor
}

/** A importação que o gravar enfileira. `linhas` e `marcas` são o dado da planilha em trânsito, e saem em toda troca de estado. */
export interface NovaImportacao {
  readonly tipo: TipoDePlanilha
  readonly anoLetivoId: string | null
  readonly linhas: unknown
  readonly marcas: unknown
  readonly assinatura: string
}

/** A importação como o job a lê. */
export interface ImportacaoParaExecutar {
  readonly id: string
  readonly tipo: TipoDePlanilha
  readonly anoLetivoId: string | null
  readonly estado: EstadoDaImportacao
  readonly assinatura: string
  readonly linhas: unknown
  readonly marcas: unknown
  readonly criadoPor: string | null
}

/** A importação como a coordenação a lê (`GET /v1/importacoes/:id`): o estado, as contagens e o código do erro. Nunca a linha da planilha. */
export interface ImportacaoLida {
  readonly id: string
  readonly tipo: TipoDePlanilha
  readonly estado: EstadoDaImportacao
  readonly resumo: unknown
  readonly erro: ErroDaImportacao | null
  readonly criadoEm: Date
  readonly concluidaEm: Date | null
}

/** `lock_not_available`: o `lock_timeout` estourou, ou o `nowait` não pegou a linha. */
const SQLSTATE_TRAVA_NAO_DISPONIVEL = '55P03'

/** O tempo que a `na_fila` pode ficar parada antes de o gravar seguinte a fechar `falhou` (Tech Spec, seção 5). */
const PRAZO_DA_FILA = sql`interval '1 hour'`

const colunasDoAno = { id: anoLetivo.id, inicio: anoLetivo.inicio, fim: anoLetivo.fim, situacao: anoLetivo.situacao }

/** Tamanho do lote de escrita do passo (3) (Tech Spec, seção 5): o statement de cada lote fica bem abaixo dos 1,5 s. */
export const TAMANHO_DO_LOTE = 500

/**
 * As planilhas da escola do contexto (F2, 4.0; Tech Spec, seções 3 e 5): a fila (`importacao_planilha`), o ano de destino e
 * os eventos do calendário. Escola e ano vêm do contexto (regra 10, item 3), e no job, da linha do outbox; nenhum método recebe
 * escola. A importação de outra escola, e o ano de outra escola, não são achados.
 *
 * As trocas de estado são `update … where estado = 'na_fila'` e apagam `linhas` e `marcas`: o dado da planilha só existe
 * enquanto ela espera o job (`docs/lgpd.md`, "Planilha em gravação"). O estado nunca guarda texto do erro, só o código.
 */
export class ImportacaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * O ano de destino da planilha. Sem filtro, o ano em curso da sessão (sem ele, `NAO_ENCONTRADO`); com `anoLetivoId`, só o
   * `planejado` da escola da sessão. Outro valor (ano de outra escola, encerrado, em curso, inexistente) não é achado.
   */
  async anoDeDestino(anoLetivoId?: string): Promise<AnoDeDestino | undefined> {
    const doDestino = anoLetivoId === undefined ? and(eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')) : and(eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'planejado'))
    const [ano] = await this.banco
      .select(colunasDoAno)
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), doDestino))
    return ano
  }

  /**
   * O ano pelo id, na escola do job. Com `travar`, `FOR SHARE`: o `encerrar` do ano (que o atualiza) espera o fim da
   * transação do passo (3), ou o passo (3) espera o `encerrar` e lê o ano já encerrado.
   */
  async anoPorId(id: string, travar = false): Promise<AnoDeDestino | undefined> {
    const consulta = this.banco
      .select(colunasDoAno)
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, id)))
    const [ano] = await (travar ? consulta.for('share') : consulta)
    return ano
  }

  /**
   * Fecha `falhou` (`expirou`) a `na_fila` da escola que passou de 1 h, para o gravar seguinte poder entrar. A linha é travada
   * com `for update nowait`: se um job a segura, o gravar responde `CONFLITO` sem esperar. A `na_fila` de menos de 1 h não é
   * tocada, e o único parcial da escola barra a segunda com `CONFLITO`.
   */
  async fecharAExpirada(): Promise<void> {
    const escolaId = requireEscolaId()
    try {
      const velhas = await this.banco
        .select({ id: importacaoPlanilha.id })
        .from(importacaoPlanilha)
        .where(and(eq(importacaoPlanilha.escolaId, escolaId), eq(importacaoPlanilha.estado, 'na_fila'), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
        .for('update', { noWait: true })
      if (velhas.length === 0) return
      await this.banco
        .update(importacaoPlanilha)
        .set({ estado: 'falhou', erro: 'expirou', linhas: null, marcas: null, concluidaEm: sql`now()` })
        .where(and(eq(importacaoPlanilha.escolaId, escolaId), inArray(importacaoPlanilha.id, velhas.map((velha) => velha.id)), eq(importacaoPlanilha.estado, 'na_fila')))
    } catch (erro) {
      if (postgresErrorIn(erro)?.code === SQLSTATE_TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.CONFLITO)
      throw erro
    }
  }

  /** Grava a importação `na_fila`, com quem a gravou. A segunda `na_fila` da escola viola o único parcial: 23505, que o filtro global de erros responde como `CONFLITO`. */
  async criar(nova: NovaImportacao): Promise<string> {
    const [criada] = await this.banco
      .insert(importacaoPlanilha)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: nova.anoLetivoId,
        tipo: nova.tipo,
        linhas: nova.linhas,
        marcas: nova.marcas,
        assinatura: nova.assinatura,
        criadoPor: requestIdentity().usuarioId,
      })
      .returning({ id: importacaoPlanilha.id })
    if (criada === undefined) throw new InvariantException('importação não criada')
    return criada.id
  }

  /** A importação da escola do contexto, sem trava. Id de outra escola, ou inexistente, não é achado. */
  async paraExecutar(id: string): Promise<ImportacaoParaExecutar | undefined> {
    return this.ler(id, false)
  }

  /** O mesmo, com `for update`: o passo (3) trava a importação primeiro (a ordem global da Tech Spec, seção 5). */
  async travar(id: string): Promise<ImportacaoParaExecutar | undefined> {
    return this.ler(id, true)
  }

  private async ler(id: string, travar: boolean): Promise<ImportacaoParaExecutar | undefined> {
    const consulta = this.banco
      .select({
        id: importacaoPlanilha.id,
        tipo: importacaoPlanilha.tipo,
        anoLetivoId: importacaoPlanilha.anoLetivoId,
        estado: importacaoPlanilha.estado,
        assinatura: importacaoPlanilha.assinatura,
        linhas: importacaoPlanilha.linhas,
        marcas: importacaoPlanilha.marcas,
        criadoPor: importacaoPlanilha.criadoPor,
      })
      .from(importacaoPlanilha)
      .where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id)))
    const [linha] = await (travar ? consulta.for('update') : consulta)
    return linha
  }

  /**
   * A importação da escola do contexto para a leitura da coordenação (5.0): sem `linhas` nem `marcas`, que são o dado da
   * planilha em trânsito e não saem por rota nenhuma. Só exige a escola, e não o ano em curso: a coordenação acompanha a
   * importação mesmo na escola que ainda não abriu o ano. Id de outra escola, ou inexistente, não é achado.
   */
  async lerPorId(id: string): Promise<ImportacaoLida | undefined> {
    const [linha] = await this.banco
      .select({
        id: importacaoPlanilha.id,
        tipo: importacaoPlanilha.tipo,
        estado: importacaoPlanilha.estado,
        resumo: importacaoPlanilha.resumo,
        erro: importacaoPlanilha.erro,
        criadoEm: importacaoPlanilha.criadoEm,
        concluidaEm: importacaoPlanilha.concluidaEm,
      })
      .from(importacaoPlanilha)
      .where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id)))
    return linha
  }

  /** Quando a `na_fila` mais antiga da escola do contexto foi gravada, ou `undefined` sem nenhuma: é o que o alerta de importação parada mede (5.0). */
  async criadaEmDaNaFilaMaisAntiga(): Promise<Date | undefined> {
    const [linha] = await this.banco
      .select({ criadoEm: sql<Date | string | null>`min(${importacaoPlanilha.criadoEm})` })
      .from(importacaoPlanilha)
      .where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.estado, 'na_fila')))
    const valor = linha?.criadoEm
    return valor === null || valor === undefined ? undefined : valor instanceof Date ? valor : new Date(valor)
  }

  /** Os tempos do passo (3): trava esperada até 1 s, cada comando até 1,5 s. Só vale na transação de quem chama (`set local`). */
  async limitesDoPasso3(): Promise<void> {
    requireEscolaId()
    await this.banco.execute(sql`select set_config('lock_timeout', '1000', true), set_config('statement_timeout', '1500', true)`)
  }

  /** `concluida`, com as contagens. Devolve `false` se a importação já não estava `na_fila`. */
  concluir(id: string, resumo: ResumoDaImportacao): Promise<boolean> {
    return this.trocarDeEstado(id, { estado: 'concluida', resumo })
  }

  /** `desatualizada`: o que a planilha viu mudou entre a prévia e o passo (3). */
  desatualizar(id: string): Promise<boolean> {
    return this.trocarDeEstado(id, { estado: 'desatualizada' })
  }

  /** `falhou`, com o código de lista fechada (nunca o texto do erro). */
  falhar(id: string, erro: ErroDaImportacao): Promise<boolean> {
    return this.trocarDeEstado(id, { estado: 'falhou', erro })
  }

  private async trocarDeEstado(id: string, novo: { estado: EstadoDaImportacao; resumo?: ResumoDaImportacao; erro?: ErroDaImportacao }): Promise<boolean> {
    const trocadas = await this.banco
      .update(importacaoPlanilha)
      .set({ estado: novo.estado, resumo: novo.resumo ?? null, erro: novo.erro ?? null, linhas: null, marcas: null, concluidaEm: sql`now()` })
      .where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id), eq(importacaoPlanilha.estado, 'na_fila')))
      .returning({ id: importacaoPlanilha.id })
    return trocadas.length > 0
  }

  /** Os eventos do calendário do ano, na escola do contexto. */
  eventosDoAno(anoLetivoId: string): Promise<EventoGravado[]> {
    return this.banco
      .select({ id: eventoCalendario.id, tipo: eventoCalendario.tipo, inicio: eventoCalendario.inicio, fim: eventoCalendario.fim, descricao: eventoCalendario.descricao })
      .from(eventoCalendario)
      .where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
  }

  /** Apaga os eventos do ano com esses ids, em lotes. O de outro ano, ou de outra escola, não é tocado. */
  async apagarEventos(anoLetivoId: string, ids: readonly string[]): Promise<void> {
    const escolaId = requireEscolaId()
    for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_DO_LOTE) {
      await this.banco
        .delete(eventoCalendario)
        .where(and(eq(eventoCalendario.escolaId, escolaId), eq(eventoCalendario.anoLetivoId, anoLetivoId), inArray(eventoCalendario.id, ids.slice(inicio, inicio + TAMANHO_DO_LOTE))))
    }
  }

  /** Grava os eventos no ano, em lotes de `TAMANHO_DO_LOTE`. */
  async inserirEventos(anoLetivoId: string, eventos: readonly EventoNovo[]): Promise<void> {
    const escolaId = requireEscolaId()
    for (let inicio = 0; inicio < eventos.length; inicio += TAMANHO_DO_LOTE) {
      await this.banco.insert(eventoCalendario).values(eventos.slice(inicio, inicio + TAMANHO_DO_LOTE).map((evento) => ({ escolaId, anoLetivoId, ...evento })))
    }
  }

  /**
   * Os professores da escola do contexto, para a planilha de professores (6.0): o usuário `professor` de cada um, o e-mail da
   * conta dele (nulo se a conta já foi limpa) e o estado pela mesma regra da lista (`estadoDoProfessor`, com o último convite de
   * professor e a hora do banco). A conta entra só pelo `usuario.conta_id` da escola: a planilha nunca pergunta a e-mail de
   * conta que a escola não tem (E11 da A1), e o e-mail não sai daqui para a resposta. Em ordem de id.
   */
  async professoresDaEscola(): Promise<ProfessorDaEscola[]> {
    const escolaId = requireEscolaId()
    const professores = await this.banco
      .select({ usuarioId: usuario.id, nome: usuario.nome, email: conta.email, desativadoEm: usuario.desativadoEm, agora: sql<Date>`now()`.mapWith(usuario.desativadoEm) })
      .from(usuario)
      .leftJoin(conta, eq(conta.id, usuario.contaId))
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor')))
      .orderBy(asc(usuario.id))
    const convites = await this.banco
      .select({ usuarioId: convite.usuarioId, id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm })
      .from(convite)
      .where(and(eq(convite.escolaId, escolaId), eq(convite.tipo, 'professor')))
      .orderBy(asc(convite.usuarioId), desc(convite.expiraEm), desc(convite.id))
    const ultimo = new Map<string, UltimoConviteDoProfessor>()
    for (const { usuarioId, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, lido)
    return professores.map(({ usuarioId, nome, email, desativadoEm, agora }) => ({
      usuarioId,
      nome,
      email: email?.toLowerCase() ?? null,
      estado: estadoDoProfessor({ desativadoEm, ultimoConvite: ultimo.get(usuarioId), agora }),
    }))
  }

  /** Trava os usuários da escola em `FOR NO KEY UPDATE`, em ordem de id e num comando só: o `desativar` e o aceite esperam o fim do passo (3), ou o passo (3) os espera. */
  async travarUsuarios(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    await this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), inArray(usuario.id, [...ids])))
      .orderBy(asc(usuario.id))
      .for('no key update')
  }

  /**
   * Da planilha de alunos (F2, 7.0). As turmas e as matrículas são lidas por quem sabe delas (`TurmaRepository`,
   * `SerieRepository`, `ListaRepository`), no ano de destino e na escola do contexto: a prévia faz uma consulta de turmas e
   * duas de matrículas, qualquer que seja o número de linhas.
   */
  turmasDoAno(anoLetivoId: string): Promise<TurmaDoAno[]> {
    requireEscolaId()
    return new TurmaRepository(this.banco).doAnoComSerie(anoLetivoId)
  }

  /** Das matrículas dadas, as que já são de alguém da escola neste ano (na lista ou com credencial). */
  matriculasEmUso(anoLetivoId: string, matriculas: readonly string[]): Promise<Set<string>> {
    requireEscolaId()
    return new ListaRepository(this.banco).emUsoNoAno(anoLetivoId, matriculas)
  }

  /** Trava as turmas do ano em `FOR NO KEY UPDATE`, em ordem de id e num comando só (passo (3) da planilha de alunos). */
  travarTurmas(anoLetivoId: string, ids: readonly string[]): Promise<void> {
    requireEscolaId()
    return new TurmaRepository(this.banco).travarNoAno(anoLetivoId, ids)
  }

  /**
   * O que a escola já tem de aluno no ano de destino, para as matrículas da planilha e as turmas que ela cita (planilha de alunos,
   * 8.0): os nomes ainda não aprovados e os alunos aprovados e ativos com linha na lista do ano.
   */
  alunosParaReimportar(anoLetivoId: string, matriculas: readonly string[], turmaIds: readonly string[]): Promise<AlunosParaReimportar> {
    requireEscolaId()
    return new ListaRepository(this.banco).paraReimportar(anoLetivoId, matriculas, turmaIds)
  }

  /** Trava os pedidos pendentes das turmas do ano (`FOR UPDATE`, por id num comando): a última trava da ordem global do passo (3). */
  travarPedidosPendentes(anoLetivoId: string, turmaIds: readonly string[]): Promise<void> {
    requireEscolaId()
    return new DecisaoRepository(this.banco).travarPendentesDasTurmas(anoLetivoId, turmaIds)
  }

  /** Corrige, em lotes de `TAMANHO_DO_LOTE`, o nome de quem ainda não foi aprovado; devolve quantos mudaram (menos que os pedidos é diferença). */
  async corrigirNomesNaLista(anoLetivoId: string, correcoes: readonly CorrecaoDeNomeNaLista[]): Promise<number> {
    requireEscolaId()
    const lista = new ListaRepository(this.banco)
    let corrigidas = 0
    for (let inicio = 0; inicio < correcoes.length; inicio += TAMANHO_DO_LOTE) corrigidas += await lista.corrigirNomes(anoLetivoId, correcoes.slice(inicio, inicio + TAMANHO_DO_LOTE))
    return corrigidas
  }

  /**
   * Corrige o nome do aluno aprovado (planilha de alunos, 8.0), em lotes: a linha só muda se o aluno segue ativo e com o nome que a
   * planilha leu. O usuário foi travado antes (`travarUsuarios`); devolve quantos mudaram, e menos que os pedidos é diferença.
   */
  async corrigirNomesDosAlunos(correcoes: ReadonlyArray<{ readonly usuarioId: string; readonly nomeLido: string; readonly nome: string }>): Promise<number> {
    const escolaId = requireEscolaId()
    let corrigidos = 0
    for (let inicio = 0; inicio < correcoes.length; inicio += TAMANHO_DO_LOTE) {
      const valores = sql.join(correcoes.slice(inicio, inicio + TAMANHO_DO_LOTE).map(({ usuarioId, nomeLido, nome }) => sql`(${usuarioId}::uuid, ${nomeLido}, ${nome})`), sql`, `)
      const mudados = await this.banco.execute(sql`
        update usuario as u set nome = v.nome
        from (values ${valores}) as v(id, nome_lido, nome)
        where u.escola_id = ${escolaId} and u.id = v.id and u.papel = 'aluno' and u.desativado_em is null and u.nome = v.nome_lido
        returning u.id`)
      corrigidos += mudados.rows.length
    }
    return corrigidos
  }

  /**
   * Fecha, sem decisão, os pedidos `pendente` desses nomes (planilha de alunos, 9.0): o nome `reivindicado` que a transferência leva à
   * turma nova volta `livre`, e o pedido que o prendia à turma antiga é `encerrada`, pela mesma função da virada do ano. Em lotes de
   * `TAMANHO_DO_LOTE`; os pedidos já foram travados no passo (3) (`travarPedidosPendentes`).
   */
  async encerrarPedidosDosNomes(listaNomeIds: readonly string[]): Promise<void> {
    requireEscolaId()
    const decisao = new DecisaoRepository(this.banco)
    for (let inicio = 0; inicio < listaNomeIds.length; inicio += TAMANHO_DO_LOTE) await decisao.fechar({ listaNomeIds: listaNomeIds.slice(inicio, inicio + TAMANHO_DO_LOTE) }, 'encerrada')
  }

  /** Passa de turma os nomes ainda não aprovados, em lotes de `TAMANHO_DO_LOTE`; devolve quantos mudaram (menos que os pedidos é diferença). */
  async transferirNomes(anoLetivoId: string, transferencias: readonly TransferenciaDeNome[]): Promise<number> {
    requireEscolaId()
    const lista = new ListaRepository(this.banco)
    let movidos = 0
    for (let inicio = 0; inicio < transferencias.length; inicio += TAMANHO_DO_LOTE) movidos += await lista.transferirNomes(anoLetivoId, transferencias.slice(inicio, inicio + TAMANHO_DO_LOTE))
    return movidos
  }

  /** Passa de turma a linha `aprovado` de cada aluno, em lotes; devolve quantas mudaram. */
  async transferirAprovados(anoLetivoId: string, transferencias: readonly TransferenciaDeAprovado[]): Promise<number> {
    requireEscolaId()
    const lista = new ListaRepository(this.banco)
    let movidos = 0
    for (let inicio = 0; inicio < transferencias.length; inicio += TAMANHO_DO_LOTE) movidos += await lista.transferirAprovados(anoLetivoId, transferencias.slice(inicio, inicio + TAMANHO_DO_LOTE))
    return movidos
  }

  /** Encerra o vínculo de aluno de cada par (aluno, turma) no ano, em lotes; devolve o que encerrou, com o estado de antes. */
  async encerrarVinculosDosAlunos(
    anoLetivoId: string,
    pares: ReadonlyArray<{ readonly usuarioId: string; readonly turmaId: string }>,
    motivo: MotivoDeEncerramentoDeVinculo,
  ): Promise<Array<{ readonly id: string; readonly estadoAntes: EstadoDeVinculo }>> {
    requireEscolaId()
    const vinculos = new VinculoRepository(this.banco)
    const encerrados: Array<{ readonly id: string; readonly estadoAntes: EstadoDeVinculo }> = []
    for (let inicio = 0; inicio < pares.length; inicio += TAMANHO_DO_LOTE) encerrados.push(...(await vinculos.encerrarDosAlunos(anoLetivoId, pares.slice(inicio, inicio + TAMANHO_DO_LOTE), motivo)))
    return encerrados
  }

  /** Abre o vínculo confirmado de cada aluno na turma nova, em lotes, com a coordenação que gravou a planilha como autora. */
  async criarVinculosDosAlunos(anoLetivoId: string, alunos: ReadonlyArray<{ readonly usuarioId: string; readonly turmaId: string }>): Promise<Array<{ readonly id: string; readonly usuarioId: string }>> {
    requireEscolaId()
    const vinculos = new VinculoRepository(this.banco)
    const criados: Array<{ readonly id: string; readonly usuarioId: string }> = []
    for (let inicio = 0; inicio < alunos.length; inicio += TAMANHO_DO_LOTE) criados.push(...(await vinculos.criarAlunosDaLista(anoLetivoId, alunos.slice(inicio, inicio + TAMANHO_DO_LOTE))))
    return criados
  }

  /** As séries da escola, numa consulta só. */
  seriesDaEscola(): Promise<Serie[]> {
    requireEscolaId()
    return new SerieRepository(this.banco).todas()
  }

  /** Cria a série que a planilha de alunos tirou do nome da turma e a escola ainda não tinha. */
  async criarSerie(pedido: CriarSerieRequest): Promise<string> {
    requireEscolaId()
    return (await new SerieRepository(this.banco).criar(pedido)).id
  }

  /** Cria a turma nova no ano de destino, com a `chave` do nome. */
  criarTurma(anoLetivoId: string, nova: { readonly serieId: string; readonly nome: string }): Promise<string> {
    requireEscolaId()
    return new TurmaRepository(this.banco).criarNoAno(anoLetivoId, nova)
  }

  /** Grava os nomes `livre` na turma de cada um, em lotes de `TAMANHO_DO_LOTE`, com a coordenação que gravou a planilha como autora. */
  async inserirNomes(anoLetivoId: string, nomes: ReadonlyArray<{ readonly turmaId: string; readonly nome: string; readonly matricula: string }>): Promise<void> {
    const lista = new ListaRepository(this.banco)
    const { usuarioId } = requestIdentity()
    for (let inicio = 0; inicio < nomes.length; inicio += TAMANHO_DO_LOTE) await lista.inserirNoAno(anoLetivoId, usuarioId, nomes.slice(inicio, inicio + TAMANHO_DO_LOTE))
  }
}
