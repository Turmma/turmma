import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { listaNome } from '../db/schema/lista-nome.js'
import { reivindicacao } from '../db/schema/reivindicacao.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'
import type { PaginationQuery, DecisorDaReivindicacao } from '@educa/shared'
import { and, asc, eq, exists, gt, inArray, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

/**
 * Como quem decide alcança o pedido, pela célula `reivindicacao.decidir` da `MATRIZ`: a coordenação, todo pedido da escola
 * no ano em curso (`unidade`); o professor, só o da turma em que ele tem vínculo `confirmado` (`turma_vinculada`).
 */
export type AlcanceDoPedido = 'unidade' | 'turma_vinculada'

/** Um pedido pendente da turma, como a lista de quem decide o mostra: nunca a matrícula, o hash nem a chave. */
export interface PedidoPendente {
  readonly id: string
  readonly nome: string | null
  readonly solicitadaEm: Date
  readonly teveMatriculaErrada: boolean | null
}

/** O pedido pendente travado para a decisão: a turma, o nome da lista e o hash da senha, que a aprovação leva à credencial. */
export interface PedidoTravado {
  readonly turmaId: string
  readonly listaNomeId: string
  readonly senhaHash: string
}

/** Os pedidos `pendente` que `fechar(…, 'encerrada')` fecha: os dos nomes dados, ou todos os de um ano. */
export type PedidosParaEncerrar = { readonly listaNomeIds: readonly string[] } | { readonly anoLetivoId: string }

/** O nome e a matrícula da linha da lista do pedido, que a aprovação leva ao usuário e à credencial. */
export interface NomeDoPedido {
  readonly nome: string
  readonly matricula: string
}

/**
 * Os pedidos de reivindicação e a decisão sobre eles, na escola e no ano em curso do contexto (A1, tarefa 8.0; Tech Spec
 * da A1, seções 4, 5 e 6; regra 10, item 3): escola, ano e, para o professor, o próprio usuário vêm do contexto que a
 * `SessaoGuard` gravou, nunca de argumento. Sem ano em curso, `requireAnoEmCurso` falha fechado com `NAO_ENCONTRADO`.
 *
 * O alcance do professor é o `exists` do vínculo confirmado dele na turma do pedido, nunca um `join`: com duas
 * disciplinas na mesma turma, o `join` repetiria a linha (P3). Nada daqui devolve a matrícula para fora da transação da
 * aprovação, nem o hash, a chave ou a marca de matrícula errada para resposta; e nada daqui vai a log.
 */
export class DecisaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O pedido que quem decide alcança, em qualquer estado: a escola e o ano do contexto e, para o professor, o vínculo. */
  #noAlcance(alcance: AlcanceDoPedido): SQL | undefined {
    return and(
      eq(reivindicacao.escolaId, requireEscolaId()),
      eq(reivindicacao.anoLetivoId, requireAnoEmCurso()),
      alcance === 'unidade' ? undefined : this.#comVinculoDoProfessor(),
    )
  }

  /** Existe vínculo `confirmado` de professor do usuário do contexto na turma do pedido, na escola e no ano do pedido. */
  #comVinculoDoProfessor(): SQL {
    const { usuarioId } = requestSessao()
    return exists(
      this.banco
        .select({ um: vinculo.id })
        .from(vinculo)
        .where(
          and(
            eq(vinculo.escolaId, reivindicacao.escolaId),
            eq(vinculo.anoLetivoId, reivindicacao.anoLetivoId),
            eq(vinculo.turmaId, reivindicacao.turmaId),
            eq(vinculo.usuarioId, usuarioId),
            eq(vinculo.papel, 'professor'),
            eq(vinculo.estado, 'confirmado'),
          ),
        ),
    )
  }

  /**
   * Uma página dos pedidos `pendente` da turma, em ordem de id (o `uuidv7`, que acompanha a hora do pedido), com uma linha
   * a mais que diz se há próxima. O nome vem da linha da lista, que o pendente sempre tem (check
   * `reivindicacao_pendente_com_nome`). Não confere quem pede: o service chama depois de abrir a turma com o alcance
   * dele. Pelo índice `(escola_id, turma_id, estado, solicitada_em)`; os pendentes de uma turma são no máximo um por nome
   * da lista dela.
   */
  pendentes(turmaId: string, { pagina, limite }: PaginationQuery): Promise<PedidoPendente[]> {
    return this.banco
      .select({ id: reivindicacao.id, nome: listaNome.nome, solicitadaEm: reivindicacao.solicitadaEm, teveMatriculaErrada: reivindicacao.teveMatriculaErrada })
      .from(reivindicacao)
      .innerJoin(listaNome, and(eq(listaNome.escolaId, reivindicacao.escolaId), eq(listaNome.id, reivindicacao.listaNomeId)))
      .where(
        and(
          eq(reivindicacao.escolaId, requireEscolaId()),
          eq(reivindicacao.anoLetivoId, requireAnoEmCurso()),
          eq(reivindicacao.turmaId, turmaId),
          eq(reivindicacao.estado, 'pendente'),
          pagina === undefined ? undefined : gt(reivindicacao.id, pagina),
        ),
      )
      .orderBy(asc(reivindicacao.id))
      .limit(limite + 1)
  }

  /**
   * O `update` condicional da decisão, na parte que escolhe a linha (Tech Spec da A1, seção 5, passo 6): trava em
   * `FOR UPDATE` o pedido com esse id se ele está no alcance de quem decide **e** ainda `pendente`, e devolve o que a
   * decisão precisa; senão, `undefined`. A decisão que chega ao mesmo tempo espera a trava e, relida a linha já decidida,
   * não a acha (C3): um decide, o outro sai sem linha. É leitura com trava, e não o `update` direto, porque o hash que a
   * aprovação leva à credencial sai na mesma escrita que decide, e o `returning` só devolve o valor novo.
   */
  async travarPendente(id: string, alcance: AlcanceDoPedido): Promise<PedidoTravado | undefined> {
    const [linha] = await this.banco
      .select({ turmaId: reivindicacao.turmaId, listaNomeId: reivindicacao.listaNomeId, senhaHash: reivindicacao.senhaHash })
      .from(reivindicacao)
      .where(and(this.#noAlcance(alcance), eq(reivindicacao.id, id), eq(reivindicacao.estado, 'pendente')))
      .for('update')
    if (linha === undefined) return undefined
    const { turmaId, listaNomeId, senhaHash } = linha
    // O check `reivindicacao_segredo_so_pendente` e o `reivindicacao_pendente_com_nome` garantem os dois no pendente.
    if (listaNomeId === null || senhaHash === null) throw new InvariantException('pedido pendente sem nome ou sem hash')
    return { turmaId, listaNomeId, senhaHash }
  }

  /**
   * Trava em `FOR UPDATE` os pedidos `pendente` das turmas do ano dado, em ordem de id e num comando só (passo (3) da planilha de
   * alunos, F2, 8.0; Tech Spec do onboarding, seção 5, última trava da ordem global). A decisão do professor trava o pedido antes de
   * ler o nome da lista: com o pedido preso pela planilha, a aprovação espera o fim do passo e lê o nome já corrigido; com a
   * aprovação na frente, a planilha espera, relê e sai `desatualizada`. O ano é o de destino da planilha, que não é
   * necessariamente o do contexto (o planejado também recebe planilha), e por isso vem de argumento: quem chama só pode passar um
   * ano já conferido na escola (o `anoDeDestino` do motor, como o `inserirNoAno` da 7.0), nunca um id vindo do cliente.
   */
  async travarPendentesDasTurmas(anoLetivoId: string, turmaIds: readonly string[]): Promise<void> {
    if (turmaIds.length === 0) return
    await this.banco
      .select({ id: reivindicacao.id })
      .from(reivindicacao)
      .where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'pendente'), inArray(reivindicacao.turmaId, [...turmaIds])))
      .orderBy(asc(reivindicacao.id))
      .for('update')
  }

  /**
   * Se o pedido com esse id está no alcance de quem decide, em qualquer estado: depois de `travarPendente` sem linha, separa
   * `ja_decidida` (alcança, e outra decisão o fechou) de `nao_encontrada`. O alcance vem **antes** do estado: o pedido
   * decidido de outra escola, de outro ano ou, para o professor, de turma sem vínculo confirmado dele responde como o
   * inexistente, e não confirma que existe (I6).
   */
  async alcancavel(id: string, alcance: AlcanceDoPedido): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: reivindicacao.id })
      .from(reivindicacao)
      .where(and(this.#noAlcance(alcance), eq(reivindicacao.id, id)))
      .limit(1)
    return linha !== undefined
  }

  /**
   * Fecha o pedido que `travarPendente` travou nesta transação: o estado, quando, quem e como decidiu, e o hash, a chave e
   * a marca de matrícula errada apagados na mesma escrita (check `reivindicacao_segredo_so_pendente`; `docs/lgpd.md`). A
   * escola do contexto é a segunda camada: o id já veio da linha travada.
   *
   * Com `'encerrada'` (F2, 9.0; Tech Spec do onboarding, seção 5, "Gravar"), fecha os pedidos `pendente` dos nomes dados, ou do ano
   * dado, **sem decisão**: grava só o estado e anula os segredos, e `decidida_em`, `decidida_por` e `decidida_como` ficam nulos
   * (regra 70, item 2: encerrar não é decidir). É a mesma escrita da transferência pela planilha e da virada do ano (`virarSala`).
   * Só o `pendente` é fechado, nunca o pedido que já foi aprovado, recusado ou encerrado; devolve os ids fechados. Quem chama passa um
   * ano já conferido na escola (o `anoDeDestino` do motor, ou o ano que a virada acabou de encerrar), nunca um id vindo do cliente.
   */
  async fechar(id: string, estado: 'aprovada' | 'recusada', decididaComo: DecisorDaReivindicacao): Promise<void>
  async fechar(onde: PedidosParaEncerrar, estado: 'encerrada'): Promise<string[]>
  async fechar(alvo: string | PedidosParaEncerrar, estado: 'aprovada' | 'recusada' | 'encerrada', decididaComo?: DecisorDaReivindicacao): Promise<string[] | void> {
    if (typeof alvo !== 'string') {
      const fechados = await this.banco
        .update(reivindicacao)
        .set({ estado: 'encerrada', senhaHash: null, chaveEnvio: null, teveMatriculaErrada: null })
        .where(
          and(
            eq(reivindicacao.escolaId, requireEscolaId()),
            eq(reivindicacao.estado, 'pendente'),
            'anoLetivoId' in alvo ? eq(reivindicacao.anoLetivoId, alvo.anoLetivoId) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
          ),
        )
        .returning({ id: reivindicacao.id })
      return fechados.map((fechado) => fechado.id)
    }
    await this.banco
      .update(reivindicacao)
      .set({
        estado,
        decididaEm: sql`now()`,
        decididaPor: requestSessao().usuarioId,
        decididaComo,
        senhaHash: null,
        chaveEnvio: null,
        teveMatriculaErrada: null,
      })
      .where(and(eq(reivindicacao.escolaId, requireEscolaId()), eq(reivindicacao.id, alvo)))
    return undefined
  }

  /**
   * O nome e a matrícula da linha da lista do pedido, na escola e no ano do contexto. É a linha `reivindicado` do pedido
   * pendente que esta transação travou: ninguém mais a muda enquanto o pedido está pendente (retirar só tira o `livre`, e
   * a outra decisão espera a trava do pedido). Escola e ano são a segunda camada: a FK composta prende o pedido ao nome da
   * mesma escola e da mesma turma.
   */
  async nomeDoPedido(listaNomeId: string): Promise<NomeDoPedido | undefined> {
    const [linha] = await this.banco
      .select({ nome: listaNome.nome, matricula: listaNome.matricula })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, listaNomeId)))
    if (linha === undefined || linha.nome === null || linha.matricula === null) return undefined
    return { nome: linha.nome, matricula: linha.matricula }
  }

  /**
   * A linha da lista do pedido aprovado passa a `aprovado`, com o usuário novo e sem nome nem matrícula, que passaram ao
   * usuário e à credencial (check `lista_nome_aprovado_sem_nome`; `docs/lgpd.md`).
   */
  async aprovarNome(listaNomeId: string, usuarioId: string): Promise<void> {
    await this.banco
      .update(listaNome)
      .set({ estado: 'aprovado', usuarioId, nome: null, matricula: null })
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, listaNomeId)))
  }

  /** A linha da lista do pedido recusado volta a `livre` (RF12): o nome reaparece na página da sala, e o dono o reivindica (E25). */
  async devolverNome(listaNomeId: string): Promise<void> {
    await this.banco
      .update(listaNome)
      .set({ estado: 'livre' })
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, listaNomeId)))
  }
}
