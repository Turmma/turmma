import type { PapelDeUsuario } from '@educa/shared'
import { and, asc, eq, exists, gt, inArray, isNotNull, isNull, notExists, sql } from 'drizzle-orm'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { DatabaseTransaction } from '../db/banco.js'
import { acessoTurma } from '../db/schema/acesso-turma.js'
import { contaExterna, type ProvedorExterno } from '../db/schema/conta-externa.js'
import { credencialMatricula } from '../db/schema/credencial-matricula.js'
import { listaNome } from '../db/schema/lista-nome.js'
import { reivindicacao } from '../db/schema/reivindicacao.js'
import { sessao, type MotivoDeEncerramento } from '../db/schema/sessao.js'
import { turma } from '../db/schema/turma.js'
import { usuario } from '../db/schema/usuario.js'
import { vinculo } from '../db/schema/vinculo.js'

/** O usuário alvo da desativação ou da eliminação: o papel, a conta e se já está desativado. Nunca o nome. */
export interface UsuarioDoCicloDeVida {
  readonly papel: PapelDeUsuario
  readonly contaId: string | null
  readonly desativadoEm: Date | null
}

/**
 * As escritas da desativação e da eliminação (tarefa 17.0) dentro da escola do contexto. Toda instrução leva a escola do
 * contexto na cláusula, nunca a de um argumento (regra 10, item 3): o usuário da mesma pessoa em outra escola é outro
 * `usuario_id`, e o id de outra escola não alcança nada. O que toca a conta global fica na `ContaGlobalRepository`.
 *
 * Mora no `nucleo` desde o F3 (tarefa 1.0), para o worker alcançar a eliminação. A trava das turmas do professor, o
 * encerramento das sessões dele e a revogação do acesso que ele gerou vieram junto, da `TurmaRepository`, da
 * `EscritaDeSessaoRepository` e da `AcessoDaTurmaRepository` da API, sem mudar a instrução: o `nucleo` não importa
 * `apps/api`. O encerramento do vínculo pela coordenação (`VinculoService.encerrar`) usa a mesma revogação daqui.
 */
export class CicloDeVidaRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  /**
   * Encerra todas as sessões ainda abertas do usuário, só na escola do contexto (a desativação, 17.0): o usuário da
   * mesma conta em outra escola é outro `usuario_id`, e a sessão dele lá não é alcançada. Devolve quantas encerrou.
   */
  async encerrarSessoesDoUsuario(usuarioId: string, motivo: MotivoDeEncerramento): Promise<number> {
    const encerradas = await this.tx
      .update(sessao)
      .set({ encerradaEm: sql`now()`, motivo })
      .where(and(eq(sessao.escolaId, requireEscolaId()), eq(sessao.usuarioId, usuarioId), isNull(sessao.encerradaEm)))
      .returning({ id: sessao.id })
    return encerradas.length
  }

  /**
   * Trava em `FOR NO KEY UPDATE`, em ordem de id, toda turma da escola do contexto em que o usuário tem vínculo de
   * professor, em qualquer estado (a eliminação do professor, correção 2026-10-03-acesso-sobrevive-ao-vinculo): é a
   * `TurmaRepository.travarContraOGerar` de cada turma dele, antes de apagar os vínculos e revogar o acesso que ele
   * gerou. Qualquer estado, e não só o confirmado: o pendente que ele confirma entre esta trava e o `delete` dos vínculos
   * daria acesso numa turma destravada. A ordem de id evita que duas eliminações se prendam uma à outra; a turma vem
   * antes do vínculo, como no encerrar e no excluir. O escopo é só a escola: a eliminação pode rodar sem ano no contexto
   * (o comando do operador), e o limite de tenant continua sendo a escola.
   */
  async travarContraOGerarDoProfessor(usuarioId: string): Promise<void> {
    await this.tx
      .select({ id: turma.id })
      .from(turma)
      .where(
        and(
          eq(turma.escolaId, requireEscolaId()),
          exists(
            this.tx
              .select({ um: vinculo.id })
              .from(vinculo)
              .where(
                and(
                  eq(vinculo.escolaId, turma.escolaId),
                  eq(vinculo.anoLetivoId, turma.anoLetivoId),
                  eq(vinculo.turmaId, turma.id),
                  eq(vinculo.usuarioId, usuarioId),
                  eq(vinculo.papel, 'professor'),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(turma.id))
      .for('no key update')
  }

  /**
   * Revoga o acesso vigente que o usuário gerou nas turmas em que ele não tem mais vínculo `confirmado` de professor, e
   * devolve o id e a turma de cada um (correção 2026-10-03-acesso-sobrevive-ao-vinculo; regra 20, item 18). Roda na
   * transação que encerra o vínculo (com `turmaId`, só aquela turma) ou que elimina o usuário (sem, todas), depois da
   * trava da turma (`TurmaRepository.travarContraOGerar`) e da mudança no vínculo: o vínculo encerrado ou apagado já não
   * conta. Outro vínculo confirmado dele na mesma turma (outra disciplina) segura o acesso; o acesso gerado por outro
   * professor não é dele, e fica.
   *
   * O escopo é a escola do contexto, sem o ano: o limite de tenant continua sendo a escola (regra 10); o ano fica de fora
   * porque a eliminação pode rodar sem ano no contexto (o comando do operador), e o acesso de um ano encerrado já foi
   * revogado na virada. O vínculo que segura o acesso é o da escola, do ano e da turma
   * do próprio acesso.
   */
  async revogarDeQuemSaiu(usuarioId: string, turmaId?: string): Promise<Array<{ readonly id: string; readonly turmaId: string }>> {
    const escolaId = requireEscolaId()
    const vinculoQueSegura = this.tx
      .select({ um: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, acessoTurma.escolaId),
          eq(vinculo.anoLetivoId, acessoTurma.anoLetivoId),
          eq(vinculo.turmaId, acessoTurma.turmaId),
          eq(vinculo.usuarioId, usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
    return this.tx
      .update(acessoTurma)
      .set({ revogadoEm: sql`now()` })
      .where(
        and(
          eq(acessoTurma.escolaId, escolaId),
          turmaId === undefined ? undefined : eq(acessoTurma.turmaId, turmaId),
          eq(acessoTurma.criadoPor, usuarioId),
          isNull(acessoTurma.revogadoEm),
          gt(acessoTurma.expiraEm, sql`now()`),
          notExists(vinculoQueSegura),
        ),
      )
      .returning({ id: acessoTurma.id, turmaId: acessoTurma.turmaId })
  }

  /**
   * Trava o usuário (`FOR NO KEY UPDATE`) e devolve papel, conta e desativação: duas desativações ou eliminações do
   * mesmo usuário ao mesmo tempo esperam uma pela outra, e a segunda relê o que a primeira deixou. A desativação não
   * muda a chave do usuário: a trava não segura o `FOR KEY SHARE` da FK de quem grava sessão ou auditoria dele. A
   * eliminação apaga a linha, e o `delete` sobe a trava na hora dele.
   */
  async travarUsuario(usuarioId: string): Promise<UsuarioDoCicloDeVida | undefined> {
    const [linha] = await this.tx
      .select({ papel: usuario.papel, contaId: usuario.contaId, desativadoEm: usuario.desativadoEm })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId)))
      .limit(1)
      .for('no key update')
    return linha
  }

  /** Marca o usuário ativo como desativado agora. Devolve a hora da desativação, ou `undefined` se ele já não estava ativo. */
  async desativar(usuarioId: string): Promise<Date | undefined> {
    const [linha] = await this.tx
      .update(usuario)
      .set({ desativadoEm: sql`now()` })
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), isNull(usuario.desativadoEm)))
      .returning({ desativadoEm: usuario.desativadoEm })
    return linha?.desativadoEm ?? undefined
  }

  /**
   * Suspende o acesso da pessoa para a eliminação agendada (F3, tarefa 14.0; RF14): grava `eliminacao_agendada_em` com o
   * `now()` do banco, **só se ainda não estava agendada**, e devolve a hora. `undefined` quando já estava (a segunda chamada
   * não grava de novo nem mexe na data). Não toca em credencial, vínculo nem conta: o cancelamento devolve o acesso com a
   * mesma senha.
   */
  async suspender(usuarioId: string): Promise<Date | undefined> {
    const [linha] = await this.tx
      .update(usuario)
      .set({ eliminacaoAgendadaEm: sql`now()` })
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), isNull(usuario.eliminacaoAgendadaEm)))
      .returning({ eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm })
    return linha?.eliminacaoAgendadaEm ?? undefined
  }

  /** Devolve o acesso: apaga `eliminacao_agendada_em`. Devolve se havia suspensão a desfazer. */
  async devolverAcesso(usuarioId: string): Promise<boolean> {
    const devolvidos = await this.tx
      .update(usuario)
      .set({ eliminacaoAgendadaEm: null })
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), isNotNull(usuario.eliminacaoAgendadaEm)))
      .returning({ id: usuario.id })
    return devolvidos.length > 0
  }

  /**
   * Apaga o hash da senha da matrícula (regra 20, item 18): a linha fica, com a matrícula, que é registro escolar, e o
   * login responde como senha errada. Devolve se havia hash.
   */
  async apagarSenhaDaMatricula(usuarioId: string): Promise<boolean> {
    const apagadas = await this.tx
      .update(credencialMatricula)
      .set({ senhaHash: null })
      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), eq(credencialMatricula.usuarioId, usuarioId), isNotNull(credencialMatricula.senhaHash)))
      .returning({ id: credencialMatricula.id })
    return apagadas.length > 0
  }

  /** Apaga a credencial por matrícula inteira (a eliminação). Devolve se havia. */
  async apagarCredencialDaMatricula(usuarioId: string): Promise<boolean> {
    const apagadas = await this.tx
      .delete(credencialMatricula)
      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), eq(credencialMatricula.usuarioId, usuarioId)))
      .returning({ id: credencialMatricula.id })
    return apagadas.length > 0
  }

  /** Apaga a conta Google ou Microsoft ligada ao usuário. Devolve a ligação que saiu (id e provedor), ou `undefined`. */
  async apagarContaExterna(usuarioId: string): Promise<{ id: string; provedor: ProvedorExterno } | undefined> {
    const [apagada] = await this.tx
      .delete(contaExterna)
      .where(and(eq(contaExterna.escolaId, requireEscolaId()), eq(contaExterna.usuarioId, usuarioId)))
      .returning({ id: contaExterna.id, provedor: contaExterna.provedor })
    return apagada
  }

  /** Apaga as sessões do usuário, abertas ou não (a eliminação). Devolve quantas. */
  async apagarSessoes(usuarioId: string): Promise<number> {
    const apagadas = await this.tx
      .delete(sessao)
      .where(and(eq(sessao.escolaId, requireEscolaId()), eq(sessao.usuarioId, usuarioId)))
      .returning({ id: sessao.id })
    return apagadas.length
  }

  /** Apaga os vínculos do usuário, de todos os anos letivos da escola (a eliminação). Devolve quantos. */
  async apagarVinculos(usuarioId: string): Promise<number> {
    const apagados = await this.tx
      .delete(vinculo)
      .where(and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.usuarioId, usuarioId)))
      .returning({ id: vinculo.id })
    return apagados.length
  }

  /**
   * Apaga a linha `aprovado` da lista de nomes que aponta para o usuário (o aluno que entrou pela lista, A1) e, antes
   * dela, os pedidos que apontam para essa linha: o aprovado e os recusados do mesmo nome (A1, tarefa 10.0; Tech Spec da
   * A1, seção 7, "Eliminação"). Os pedidos antes, porque o `set null` da FK os manteria sem nome; a linha antes do
   * usuário, porque a FK do `usuario_id` não tem ação e faria a eliminação falhar. A linha aprovada não tem pedido
   * pendente (a aprovação o fechou, e o nome só volta a receber pedido se for `livre`). De qualquer ano da escola. Não
   * há índice por `(escola_id, usuario_id)`: a busca percorre as linhas da escola pelo prefixo de `lista_nome_turma_idx`,
   * como a FK do `usuario_id` no `delete` do usuário; a eliminação é rara, e o índice fica no `TODO.md`.
   */
  async apagarDaListaDeNomes(usuarioId: string): Promise<{ readonly linhaDaListaApagada: boolean; readonly pedidosApagados: number }> {
    const escolaId = requireEscolaId()
    const doUsuario = and(eq(listaNome.escolaId, escolaId), eq(listaNome.usuarioId, usuarioId))
    const pedidos = await this.tx
      .delete(reivindicacao)
      .where(and(eq(reivindicacao.escolaId, escolaId), inArray(reivindicacao.listaNomeId, this.tx.select({ id: listaNome.id }).from(listaNome).where(doUsuario))))
      .returning({ id: reivindicacao.id })
    const linhas = await this.tx.delete(listaNome).where(doUsuario).returning({ id: listaNome.id })
    return { linhaDaListaApagada: linhas.length > 0, pedidosApagados: pedidos.length }
  }

  /**
   * Apaga o usuário. O convite dele sai junto (`on delete cascade`); a auditoria de que ele é autor e o vínculo de outra
   * pessoa que ele criou ficam, com o id dele (migration 0013).
   */
  async apagarUsuario(usuarioId: string): Promise<void> {
    await this.tx.delete(usuario).where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId)))
  }
}
