import type { EstadoDeVinculo, MotivoDeEncerramentoDeVinculo, PapelDeUsuario, TipoDeConvite } from '@educa/shared'
import { and, asc, eq, exists, gt, gte, inArray, isNotNull, isNull, ne, notExists, or, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { DatabaseTransaction } from '../db/database.js'
import { acessoTurma } from '../db/schema/acesso-turma.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { CANCELAR_O_ENVIO_DO_CONVITE } from '../convite/cancelar-envio.js'
import { convite } from '../db/schema/convite.js'
import { contaExterna, type ProvedorExterno } from '../db/schema/conta-externa.js'
import { credencialMatricula } from '../db/schema/credencial-matricula.js'
import { listaNome } from '../db/schema/lista-nome.js'
import { reivindicacao } from '../db/schema/reivindicacao.js'
import { sessao, type MotivoDeEncerramento } from '../db/schema/sessao.js'
import { turma } from '../db/schema/turma.js'
import { usuario } from '../db/schema/usuario.js'
import { vinculo } from '../db/schema/vinculo.js'

/**
 * O usuário alvo da desativação ou da eliminação: o papel, a conta, se já está desativado e se está à espera da primeira
 * entrada (inativo, com o convite da escola usado e não revogado, aceito depois de ele ficar inativo: o que o login ativaria).
 * Nunca o nome.
 */
export interface UsuarioDoCicloDeVida {
  readonly papel: PapelDeUsuario
  readonly contaId: string | null
  readonly desativadoEm: Date | null
  readonly aEsperaDaPrimeiraEntrada: boolean
}

/**
 * As escritas da desativação e da eliminação (tarefa 17.0) dentro da escola do contexto. Toda instrução leva a escola do
 * contexto na cláusula, nunca a de um argumento (regra 10, item 3): o usuário da mesma pessoa em outra escola é outro
 * `usuario_id`, e o id de outra escola não alcança nada. O que toca a conta global fica na `ContaGlobalRepository`.
 *
 * Mora no `nucleo` desde o F3 (tarefa 1.0), para o worker alcançar a eliminação. A trava das turmas do professor, o
 * encerramento das sessões dele e a revogação do acesso que ele gerou vieram junto, da `TurmaRepository`, da
 * `SessaoWriteRepository` e da `AcessoDaTurmaRepository` da API, sem mudar a instrução: o `nucleo` não importa
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
   * Trava em `FOR SHARE`, em ordem de id e num comando só, os anos letivos da escola do contexto em que o usuário tem vínculo
   * (onboarding-por-convite, 3.0; Tech Spec, seção 5, "O job", passo 3): é o **segundo degrau da ordem global** (importação,
   * ano, usuários, contas, turmas, pedidos), e vem antes de travar o usuário. O `update` do ano que a virada faz
   * (`FOR NO KEY UPDATE`) espera esta transação ou a faz esperar, e o `virarAno` e o `virarSala` nunca encerram o ano no meio de uma
   * desativação: o vínculo que a virada ia encerrar por `fim_do_ano` ou o encerrado aqui por `desligamento`, um só, e nenhum
   * fica aberto. Com `soAbertos`, só os anos em que ele ainda tem vínculo que não está `encerrado` (a desativação: o ano em
   * curso e o planejado); sem, todos os anos em que ele tem vínculo em qualquer estado (a eliminação, que apaga todos e pode
   * rodar sem ano no contexto). O escopo é a escola, nunca um ano recebido.
   */
  async travarAnosDosVinculos(usuarioId: string, soAbertos: boolean): Promise<void> {
    await this.tx
      .select({ id: anoLetivo.id })
      .from(anoLetivo)
      .where(
        and(
          eq(anoLetivo.escolaId, requireEscolaId()),
          exists(
            this.tx
              .select({ um: vinculo.id })
              .from(vinculo)
              .where(
                and(
                  eq(vinculo.escolaId, anoLetivo.escolaId),
                  eq(vinculo.anoLetivoId, anoLetivo.id),
                  eq(vinculo.usuarioId, usuarioId),
                  soAbertos ? ne(vinculo.estado, 'encerrado') : undefined,
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(anoLetivo.id))
      .for('share')
  }

  /**
   * Encerra, com o `motivo`, todo vínculo do usuário na escola do contexto que ainda não está `encerrado`, de professor e de
   * aluno, no ano em curso e no planejado (onboarding-por-convite, 3.0; RF5): é o `VinculoRepository.encerrar`, mas por pessoa e sem
   * o ano do contexto, porque o `encerrar` da coordenação alcança só o vínculo de professor do ano em curso. Os vínculos são
   * lidos com `FOR UPDATE`, em ordem de id (a decisão do professor que chega no meio espera e o relê já `encerrado`), e
   * devolvidos com o estado de antes, para a auditoria `vinculo.encerrado`. Roda **depois** de travar as turmas
   * (`travarContraOGerarDoProfessor`) e antes de `revogarDeQuemSaiu`, que só deixa de contar o vínculo encerrado.
   */
  async encerrarVinculosDaPessoa(
    usuarioId: string,
    motivo: MotivoDeEncerramentoDeVinculo,
  ): Promise<Array<{ readonly id: string; readonly estadoAntes: EstadoDeVinculo }>> {
    const escolaId = requireEscolaId()
    const abertos = await this.tx
      .select({ id: vinculo.id, estado: vinculo.estado })
      .from(vinculo)
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), ne(vinculo.estado, 'encerrado')))
      .orderBy(asc(vinculo.id))
      .for('update')
    if (abertos.length === 0) return []
    const ids = abertos.map((aberto) => aberto.id)
    await this.tx
      .update(vinculo)
      .set({ estado: 'encerrado', motivoEncerramento: motivo, encerradoEm: sql`now()` })
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), inArray(vinculo.id, ids)))
    return abertos.map((aberto) => ({ id: aberto.id, estadoAntes: aberto.estado }))
  }

  /**
   * Revoga o convite do usuário que ainda está em aberto (não usado e não revogado; vencido também), e devolve o id e o tipo
   * (onboarding-por-convite, 3.0; N1 da A1). **É defesa, não o caminho do dia a dia**: o usuário ativo não tem convite em
   * aberto por rota nenhuma (o `usuarioConvidado` só cria ou reaproveita usuário inativo, e o `ativarPorConvite` só consome
   * convite usado), e o professor pendente, que tem o convite em aberto, é inativo e não ativável: o `desativar` o recusa
   * antes da conta, e o convite dele sai pelo `convite/revogar` da A1, sob a trava da escola. Esta cláusula
   * roda sem a trava da escola, e por isso não resolve a corrida com o aceite. Ela fecha a brecha caso um convite em aberto apareça num usuário ativo (uma rotina, um dado antigo): o aceite que chegasse depois da
   * desativação marcaria o convite usado depois do `desativado_em`, e a ativação por convite (`usado_em >= desativado_em`)
   * devolveria o acesso a quem a escola acabou de tirar. Vale para qualquer tipo, pois o índice `convite_pendente_unico`
   * deixa um só em aberto por usuário. O convite já usado fica como está: o `desativado_em` gravado com `clock_timestamp()`,
   * depois da trava do usuário, é posterior a todo aceite confirmado, e o `ativarPorConvite` exige `usado_em >= desativado_em`.
   */
  async revogarConviteAberto(usuarioId: string): Promise<{ readonly id: string; readonly tipo: TipoDeConvite } | undefined> {
    const [revogado] = await this.tx
      .update(convite)
      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
      .returning({ id: convite.id, tipo: convite.tipo })
    return revogado
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
    await this.travarContraOGerarDosProfessores([usuarioId])
  }

  /**
   * O mesmo para vários professores de uma vez, num comando só e em ordem de id (o passo (3) da planilha de professores,
   * onboarding-por-convite, 6.0): a união das turmas de todos os vínculos deles, em qualquer estado, para duas importações
   * ou a desativação que chegar com as turmas em outra ordem não se prenderem (`40P01`).
   */
  async travarContraOGerarDosProfessores(usuarioIds: readonly string[]): Promise<void> {
    if (usuarioIds.length === 0) return
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
                  inArray(vinculo.usuarioId, [...usuarioIds]),
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
   * O convite desta escola, do usuário da consulta que a contém, que o login ainda usaria para ativá-lo: usado, não revogado
   * e aceito depois de o usuário ficar inativo (`usado_em >= desativado_em`). É a condição do `ativarPorConvite` e do
   * `usuarioComConviteAceito` da API (`apps/api/src/sessao/convite/convite.repository.ts`), sem o `conviteId`: as três andam
   * juntas, e o núcleo não importa `apps/api`, por isso a cópia. Correlaciona com `usuario`: só entra em consulta que o tem.
   */
  #conviteAceitoAEspera() {
    return this.tx
      .select({ um: sql`1` })
      .from(convite)
      .where(
        and(
          eq(convite.escolaId, requireEscolaId()),
          eq(convite.usuarioId, usuario.id),
          isNotNull(convite.usadoEm),
          isNull(convite.revogadoEm),
          gte(convite.usadoEm, usuario.desativadoEm),
        ),
      )
  }

  /**
   * Trava o usuário (`FOR NO KEY UPDATE`) e devolve papel, conta, desativação e se está à espera da primeira entrada: duas desativações ou eliminações do
   * mesmo usuário ao mesmo tempo esperam uma pela outra, e a segunda relê o que a primeira deixou. A desativação não
   * muda a chave do usuário: a trava não segura o `FOR KEY SHARE` da FK de quem grava sessão ou auditoria dele. A
   * eliminação apaga a linha, e o `delete` sobe a trava na hora dele.
   */
  async travarUsuario(usuarioId: string): Promise<UsuarioDoCicloDeVida | undefined> {
    const [linha] = await this.tx
      .select({
        papel: usuario.papel,
        contaId: usuario.contaId,
        desativadoEm: usuario.desativadoEm,
        aEsperaDaPrimeiraEntrada: sql<boolean>`${exists(this.#conviteAceitoAEspera())}`,
      })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId)))
      .limit(1)
      .for('no key update')
    return linha
  }

  /**
   * Marca como desativado agora (`clock_timestamp()`, depois da trava do usuário) o usuário ativo ou à espera da primeira
   * entrada; `undefined` se não era nenhum dos dois. O `now()` é a hora do começo da transação: o aceite que ativou o usuário
   * enquanto a desativação esperava na trava do usuário tem `usado_em` maior, e o bilhete o reativaria. O `exists` repete a
   * condição do login para o convite revogado entre a trava e o `update`.
   */
  async desativar(usuarioId: string): Promise<Date | undefined> {
    const [linha] = await this.tx
      .update(usuario)
      .set({ desativadoEm: sql`clock_timestamp()` })
      .where(
        and(
          eq(usuario.escolaId, requireEscolaId()),
          eq(usuario.id, usuarioId),
          or(isNull(usuario.desativadoEm), exists(this.#conviteAceitoAEspera())),
        ),
      )
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
   * Apaga o hash da senha da matrícula **e a senha provisória** (as três colunas dela), regra 20, item 18: a linha fica, com a
   * matrícula, que é registro escolar, e o login responde como senha errada. A provisória vai junto (acesso-e-convites, tarefa 9.0):
   * sem isso o aluno desativado entraria com a provisória gerada antes de sair da escola. Devolve se havia hash de senha ou provisória.
   */
  async apagarSenhaDaMatricula(usuarioId: string): Promise<boolean> {
    const apagadas = await this.tx
      .update(credencialMatricula)
      .set({ senhaHash: null, provisoriaHash: null, provisoriaExpiraEm: null, provisoriaGeradaPor: null })
      .where(
        and(
          eq(credencialMatricula.escolaId, requireEscolaId()),
          eq(credencialMatricula.usuarioId, usuarioId),
          or(isNotNull(credencialMatricula.senhaHash), isNotNull(credencialMatricula.provisoriaHash)),
        ),
      )
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
