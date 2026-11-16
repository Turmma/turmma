import {
  anoLetivo,
  execucaoAgente,
  requireAnoEmCurso,
  requireEscolaId,
  EXECUCAO_INTERROMPIDA,
  mensagemAgente,
  mensagemTutor,
  Unscoped,
  threadAgente,
  usuario,
  type Database,
  type CodigoDeFalhaDaExecucao,
  type DatabaseTransaction,
} from '@educa/core'
import { execucaoInputSchema, resultadoGravadoSchema, FUNCAO_DA_TAREFA_DE_IA, type ErrorCode, type ExecucaoInput, type EstadoDeExecucao, type PapelDeUsuario, type ResultadoGravado, type TarefaDeIa } from '@educa/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { requireUsuarioId } from './execucao-context.js'
import type { ExecucaoLida } from './execucao-command.js'

/** O que o processador lê da execução antes de rodá-la: a tarefa, o estado e **quem pediu**, para montar o contexto que o `POST` tinha. */
export interface ExecucaoParaIniciar {
  readonly id: string
  readonly tarefa: TarefaDeIa
  readonly estado: EstadoDeExecucao
  /**
   * O contexto de quem pediu; ausente quando a pessoa foi desativada ou tem a eliminação agendada, ou o ano letivo da linha já não está em curso. O vínculo
   * não é lido aqui: o fim dele desativa a conta (regra 20, item 18), e o `preparar` do comando confere o vínculo de novo.
   */
  readonly quemPediu: { readonly usuarioId: string; readonly papel: PapelDeUsuario; readonly anoLetivoId: string } | undefined
}

/**
 * `execucao_agente` para o **processador do worker de IA** (X6, 5.0): a escola é a do contexto do job (`job_registro.escola_id`,
 * que o `JobExecutor` grava no contexto) e entra em toda cláusula (regra 10, item 3); nenhum método a recebe por argumento. Com o
 * contexto da escola A e o id de uma execução da B, nada é lido nem mudado.
 *
 * As passagens de estado são um `update` condicional, numa instrução só, com o `now()` do banco: duas entregas do mesmo job, ou o
 * job e a varredura, não rodam nem concluem a mesma execução (regra 80, item 7).
 */
export class ExecucaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A execução do job e quem a pediu. A pessoa só vale se está ativa (nem desativada, nem com eliminação agendada) e o ano letivo da
   * linha ainda está em curso: a virada do ano, a desativação (que o fim do vínculo faz, regra 20, item 18) e a eliminação entre o `202` e o
   * worker dão `quemPediu` vazio. O vínculo em si é conferido pelo `preparar` do comando, que repete o alcance do `POST`.
   */
  async paraIniciar(id: string): Promise<ExecucaoParaIniciar | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({
        id: execucaoAgente.id,
        tarefa: execucaoAgente.tarefa,
        estado: execucaoAgente.estado,
        anoLetivoId: execucaoAgente.anoLetivoId,
        usuarioId: usuario.id,
        papel: usuario.papel,
        anoEmCurso: anoLetivo.id,
      })
      .from(execucaoAgente)
      .leftJoin(
        usuario,
        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)),
      )
      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, execucaoAgente.escolaId), eq(anoLetivo.id, execucaoAgente.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
      .where(and(eq(execucaoAgente.escolaId, escolaId), eq(execucaoAgente.id, id)))
    if (linha === undefined) return undefined
    const quemPediu = linha.usuarioId !== null && linha.papel !== null && linha.anoEmCurso !== null ? { usuarioId: linha.usuarioId, papel: linha.papel, anoLetivoId: linha.anoLetivoId } : undefined
    return { id: linha.id, tarefa: linha.tarefa, estado: linha.estado, quemPediu }
  }

  /** `pendente` → `rodando`, com o instante do banco. `false` é a execução que já não estava `pendente`: outra entrega a pegou, ou ela terminou. Quem recebe `false` não chama o modelo. */
  async marcarRodando(id: string): Promise<boolean> {
    const marcadas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'rodando', iniciadaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
      .returning({ id: execucaoAgente.id })
    return marcadas.length > 0
  }

  /**
   * `rodando` → `concluida`, com a referência ao que a execução gravou, e diz se concluiu. `false` é a execução que já não estava
   * `rodando` (a varredura a encerrou antes): quem produziu desfaz a própria transação.
   */
  async concluirRodando(id: string, resultado: ResultadoGravado): Promise<boolean> {
    // O resultado é só referência: o que não é, nem chega ao banco.
    const referencia = resultadoGravadoSchema.parse(resultado)
    const concluidas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'concluida', resultado: referencia, concluidaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
      .returning({ id: execucaoAgente.id })
    return concluidas.length > 0
  }

  /** `rodando` → `falhou`, com o código do contrato. Não mexe em quem não está `rodando`. */
  async marcarFalhou(id: string, codigo: CodigoDeFalhaDaExecucao): Promise<boolean> {
    const falhadas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
      .returning({ id: execucaoAgente.id })
    return falhadas.length > 0
  }

  /**
   * `rodando` → `falhou EXECUCAO_INTERROMPIDA`, na escola do contexto, e devolve a execução encerrada, ou `undefined` se ela já não estava `rodando`
   * (terminou, ou outra entrega ou a varredura a encerrou antes). É a reentrega da 6.0: o job chegou e a execução já estava `rodando`, de um
   * worker que morreu ou de outra entrega que ainda roda. Quem recebe a linha grava a estimada na **mesma transação** (`consumoEstimadoDaInterrompida`),
   * e quem recebe `undefined` não grava nada: uma execução encerra uma vez, com uma linha.
   */
  async encerrarRodando(id: string): Promise<InterrompidaEncerrada | undefined> {
    const [encerrada] = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
      .returning({ id: execucaoAgente.id, escolaId: execucaoAgente.escolaId, tarefa: execucaoAgente.tarefa, duracaoMs: sql<number>`(extract(epoch from (now() - ${execucaoAgente.iniciadaEm})) * 1000)::float8` })
    return encerrada
  }

  /**
   * A varredura da `rodando` (X6, 6.0): encerra, com `EXECUCAO_INTERROMPIDA`, até `lote` execuções `rodando` iniciadas há mais de `limiteSegundos` (2 × o `prazoMs` do job),
   * em qualquer escola, e devolve cada uma com a escola dela, para quem chama gravar a linha estimada na mesma transação. A idade é a do banco
   * (`now()`), e `estado = 'rodando'` está no `update`: duas réplicas na mesma linha encerram uma vez só, a segunda recebe zero linhas ao fim da espera pela primeira.
   */
  @Unscoped('varredura do main-worker: encerra a execução que o processo caído deixou rodando, em qualquer escola, e devolve só o id, a escola, a tarefa e a duração; grava estado, código e data, e não lê conteúdo nem pessoa')
  async encerrarRodandasVelhas(limiteSegundos: number, lote: number): Promise<InterrompidaEncerrada[]> {
    const { rows } = await this.banco.execute<{ id: string; escola_id: string; tarefa: TarefaDeIa; duracao_ms: number }>(sql`
      update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
        and x.estado = 'rodando'
      returning x.id, x.escola_id, x.tarefa, (extract(epoch from (now() - x.iniciada_em)) * 1000)::float8 as duracao_ms
    `)
    return rows.map((linha) => ({ id: linha.id, escolaId: linha.escola_id, tarefa: linha.tarefa, duracaoMs: Number(linha.duracao_ms) }))
  }

  /**
   * A varredura da `pendente` (X6, 6.0): encerra, com `EXECUCAO_INTERROMPIDA`, até `lote` execuções `pendente` **sem job vivo**, em qualquer escola, e devolve quantas. "Sem job vivo" é
   * não haver, **na mesma escola**, `ia.executar` não finalizado nas filas da IA com o `execucaoId` dela: o predicado é o do `job_registro_pendentes_idx`
   * (`fila`, `escola_id`, parcial em `estado not in ('concluido', 'falhou')`). Não lê o Redis: com ele fora o job continua vivo no outbox e a execução fica. Sem linha estimada: o modelo
   * nunca foi chamado, a execução não saiu de `pendente`.
   */
  @Unscoped('varredura do main-worker: encerra a execução pendente que não tem mais job vivo na mesma escola, em qualquer escola; grava só estado, código e data, e não lê conteúdo nem pessoa')
  async encerrarPendentesSemJob(lote: number): Promise<number> {
    const { rows } = await this.banco.execute<{ id: string }>(sql`
      update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
      where x.id in (
          select p.id from execucao_agente p
          where p.estado = 'pendente'
            and not exists (
              select 1 from job_registro j
              where j.escola_id = p.escola_id
                and j.fila in ('interativa', 'ferramenta', 'normal')
                and j.tipo = 'ia.executar'
                and j.dados ->> 'execucaoId' = p.id::text
                and j.estado not in ('concluido', 'falhou')
            )
          order by p.criada_em limit ${lote})
        and x.estado = 'pendente'
      returning x.id
    `)
    return rows.length
  }
}

/** A execução que a reentrega ou a varredura encerrou como interrompida: com a escola, a tarefa e quanto tempo ficou `rodando`, para a linha estimada. */
export interface InterrompidaEncerrada {
  readonly id: string
  readonly escolaId: string
  readonly tarefa: TarefaDeIa
  readonly duracaoMs: number
}

export interface ExecucaoDeQuemPediu {
  readonly id: string
  readonly tarefa: TarefaDeIa
  readonly estado: EstadoDeExecucao
  readonly resultado: ResultadoGravado | null
  readonly erro: ErrorCode | null
}

export interface MensagemGravada {
  readonly id: string
  readonly criadaEm: Date
}

/**
 * As execuções da **pessoa da sessão**, na escola dela: quem grava é quem pede, e quem lê é quem pediu. Escola, ano
 * letivo e pessoa vêm do contexto (regra 10, item 3); nenhum método os recebe.
 */
export class ExecucaoDaSessaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Grava a execução `pendente`, de quem está na sessão, e devolve o id. Com a chave de envio já usada na escola,
   * não grava e devolve `undefined`: o índice único decide, sem "verifica e depois grava" (regra 80, item 7).
   */
  async gravarPendente(tarefa: TarefaDeIa, chaveEnvio: string, entrada: ExecucaoInput): Promise<string | undefined> {
    const [gravada] = await this.banco
      .insert(execucaoAgente)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: requireAnoEmCurso(),
        funcao: FUNCAO_DA_TAREFA_DE_IA[tarefa],
        tarefa,
        solicitadaPor: requireUsuarioId(),
        chaveEnvio,
        entrada,
      })
      .onConflictDoNothing({ target: [execucaoAgente.escolaId, execucaoAgente.chaveEnvio] })
      .returning({ id: execucaoAgente.id })
    return gravada?.id
  }

  /**
   * A execução desta chave, **se foi esta pessoa que pediu, no ano letivo em curso**. A chave de outra pessoa da escola
   * não é achada, nem a de um ano anterior: a execução é do ano em que foi pedida (regra 10, item 2).
   */
  async daChave(chaveEnvio: string): Promise<{ id: string; tarefa: TarefaDeIa } | undefined> {
    const [linha] = await this.banco
      .select({ id: execucaoAgente.id, tarefa: execucaoAgente.tarefa })
      .from(execucaoAgente)
      .where(
        and(
          eq(execucaoAgente.escolaId, requireEscolaId()),
          eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()),
          eq(execucaoAgente.chaveEnvio, chaveEnvio),
          eq(execucaoAgente.solicitadaPor, requireUsuarioId()),
        ),
      )
    return linha
  }

  /**
   * O que o comando relê **pelo id** antes de rodar: a execução que esta pessoa pediu, no ano letivo em curso, com a
   * `entrada` gravada validada de novo (é `jsonb`, sem FK). A de outra pessoa, a de outra escola, a de outro ano e a
   * anonimizada (`solicitada_por` nulo não casa com ninguém) não são achadas, nem a de entrada que o schema não lê (o check
   * `execucao_agente_entrada_da_tarefa` já garante que a `tarefa` da entrada é a da linha).
   */
  async paraExecutar(id: string): Promise<ExecucaoLida | undefined> {
    const [linha] = await this.banco
      .select({ id: execucaoAgente.id, tarefa: execucaoAgente.tarefa, chaveEnvio: execucaoAgente.chaveEnvio, entrada: execucaoAgente.entrada })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
    if (linha === undefined) return undefined
    const entrada = execucaoInputSchema.safeParse(linha.entrada)
    if (!entrada.success) return undefined
    return { id: linha.id, tarefa: linha.tarefa, chaveEnvio: linha.chaveEnvio, entrada: entrada.data }
  }

  /**
   * A execução com esse id que esta pessoa pediu, no ano letivo em curso. A de outra pessoa, mesmo da mesma escola, a
   * de outra escola e a de outro ano letivo não são achadas.
   */
  async deQuemPediu(id: string): Promise<ExecucaoDeQuemPediu | undefined> {
    const [linha] = await this.banco
      .select({ id: execucaoAgente.id, tarefa: execucaoAgente.tarefa, estado: execucaoAgente.estado, resultado: execucaoAgente.resultado, erro: execucaoAgente.erro })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
    return linha
  }

  /**
   * A resposta do Assistente com esse id, na conversa desta pessoa: a thread é dela, e a mensagem é do agente e do ano
   * letivo em curso. A de um ano anterior não é achada: o join só iguala o ano da mensagem ao da thread, então a cláusula
   * de ano é a da própria mensagem (regra 10, item 2).
   */
  async mensagemDoAssistente(id: string): Promise<(MensagemGravada & { conteudo: unknown }) | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ id: mensagemAgente.id, criadaEm: mensagemAgente.criadaEm, conteudo: mensagemAgente.conteudo })
      .from(mensagemAgente)
      .innerJoin(threadAgente, and(eq(threadAgente.escolaId, mensagemAgente.escolaId), eq(threadAgente.anoLetivoId, mensagemAgente.anoLetivoId), eq(threadAgente.id, mensagemAgente.threadId)))
      .where(and(eq(mensagemAgente.escolaId, escolaId), eq(mensagemAgente.anoLetivoId, requireAnoEmCurso()), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, requireUsuarioId())))
    return linha
  }

  /**
   * A resposta do Tutor com esse id, na conversa deste aluno, no ano letivo em curso. A de um ano anterior não é achada:
   * as chaves da mensagem só a ligam à turma e à execução do ano dela, então a cláusula de ano é a da própria mensagem
   * (regra 10, item 2).
   */
  async mensagemDoTutor(id: string): Promise<(MensagemGravada & { tipo: string; texto: string; citacoes: unknown }) | undefined> {
    const [linha] = await this.banco
      .select({ id: mensagemTutor.id, criadaEm: mensagemTutor.criadaEm, tipo: mensagemTutor.tipo, texto: mensagemTutor.texto, citacoes: mensagemTutor.citacoes })
      .from(mensagemTutor)
      .where(and(eq(mensagemTutor.escolaId, requireEscolaId()), eq(mensagemTutor.anoLetivoId, requireAnoEmCurso()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, requireUsuarioId())))
    return linha
  }
}
