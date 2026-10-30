import { ErrorCode } from '@educa/shared'
import { z } from 'zod'
import { RegistroDeAuditoria } from '../auditoria/registro-de-auditoria.js'
import { contextoAtual } from '../contexto/contexto.js'
import { exigirEscolaDoContexto } from '../contexto/escola-do-contexto.js'
import type { Banco, TransacaoBanco } from '../db/banco.js'
import { ErroDeDominio } from '../erro/erro-de-dominio.js'
import { CicloDeVidaRepository, type UsuarioDoCicloDeVida } from './ciclo-de-vida.repository.js'
import { ContaGlobalRepository } from './conta-global.repository.js'

/** Quem pede a ação, quando não é a pessoa da sessão: alguém da nossa equipe, por comando, a pedido da escola. */
export interface AutoriaDoCicloDeVida {
  readonly autorOperador?: string
}

const registro = new RegistroDeAuditoria()
const esquemaId = z.uuid()

/** Id de outra escola, de ninguém, já desativado (na desativação) ou o próprio: a mesma resposta (regra 10, item 6). */
const naoEncontrado = () => new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)

/**
 * O fim do acesso de quem sai da escola (tarefa 17.0; Tech Spec, seção 5, "Ciclo de vida"; regra 20, itens 15 e 18).
 * Cada ação roda numa transação, com a auditoria dentro dela, e alcança só o que é da escola do contexto: a conta
 * global só é limpa quando não serve mais a escola nenhuma. Mora no `nucleo` desde o F3 (tarefa 1.0), para o worker
 * alcançar a eliminação do titular; a API importa pelo subcaminho `@educa/nucleo/ciclo-de-vida`.
 *
 * Não há rota no F1 (a tela de estrutura é do F2, e o pedido do titular do F3): quem chama já conferiu a permissão, e
 * o contexto traz a escola e o autor, a pessoa da sessão ou o operador.
 *
 * **A transação de quem chama.** `desativar` e `eliminar` recebem, opcional, a transação de quem chama (a etapa 3 da
 * eliminação do titular, o lote de `pessoa_desativada`): as travas, as escritas e a auditoria entram nela, e uma falha
 * depois, em quem chama, desfaz também o que o ciclo de vida fez. Sem ela, cada ação abre a própria transação. Na
 * transação de quem chama, o ciclo de vida não abre ponto de salvamento: um erro aqui sobe, e quem chama desfaz tudo.
 * Um erro de SQL aborta a transação inteira de quem chama, que não pode capturá-lo e seguir nela; quem elimina em lote
 * usa uma transação por titular. O `NAO_ENCONTRADO` sai antes de qualquer escrita e pode ser capturado.
 *
 * - **Desativar:** o usuário deixa de entrar na requisição seguinte (a guarda recusa usuário desativado) e deixa de ter
 *   credencial guardada nesta escola: as sessões dele aqui são encerradas, o hash da senha da matrícula é apagado e a
 *   conta Google ou Microsoft ligada é desligada. Se a conta global ficou sem usuário ativo em escola nenhuma, ela é
 *   limpa (e-mail, senha, segundo fator e as sessões que restarem).
 * - **Eliminar:** apaga de fato o usuário e o que é dele nesta escola (credencial, conta externa, vínculos e sessões,
 *   e, do aluno que entrou pela lista da A1, a linha `aprovado` da lista e os pedidos dela, antes do usuário); o
 *   registro de acesso e a auditoria ficam pela retenção legal. De quem gerou acesso da turma, gravou a lista ou decidiu
 *   pedido, o `criado_por` e o `decidida_por` ficam nulos pela FK, e a autoria fica na auditoria. O acesso da turma
 *   vigente que ele gerou é revogado antes, com `acesso_turma.revogado`: os vínculos dele saíram, e o link e o código não
 *   continuam abrindo a sala (correção 2026-10-03-acesso-sobrevive-ao-vinculo). Se era o último usuário da conta, a
 *   mesma limpeza.
 * - **Agendar a eliminação e cancelá-la** (F3, tarefa 14.0): suspende o acesso sem apagar nada, e devolve.
 * - **Desligar a conta externa:** a coordenação desliga a conta Google ou Microsoft de um usuário ativo, e ele liga a
 *   nova no login seguinte (decidido na 13.0).
 *
 * A ordem das travas: o usuário, depois a conta, e só então as sessões, como a redefinição do MFA (conta, depois
 * sessões), para as duas não se prenderem uma à outra. Duas desativações de usuários da mesma conta ao mesmo tempo
 * esperam uma pela outra na conta, e a segunda vê que ninguém mais está ativo.
 */
export class CicloDeVidaService {
  constructor(private readonly banco: Banco) {}

  async desativar(usuarioId: string, autoria: AutoriaDoCicloDeVida = {}, transacao?: TransacaoBanco): Promise<void> {
    await this.#naTransacao(usuarioId, transacao, async (tx, alvo) => {
      if (alvo.desativadoEm !== null) throw naoEncontrado()
      const repositorio = new CicloDeVidaRepository(tx)
      const desativadoEm = await repositorio.desativar(usuarioId)
      if (desativadoEm === undefined) throw naoEncontrado()
      const sessoesEncerradas = await repositorio.encerrarSessoesDoUsuario(usuarioId, 'desativacao')
      const credencialApagada = await repositorio.apagarSenhaDaMatricula(usuarioId)
      const contaExternaDesligada = (await repositorio.apagarContaExterna(usuarioId)) !== undefined
      const contaLimpa = alvo.contaId !== null && (await new ContaGlobalRepository(tx).limparContaSemUso(alvo.contaId))
      await registro.gravar(tx, 'usuario.desativado', {
        entidadeId: usuarioId,
        antes: { papel: alvo.papel },
        depois: { desativadoEm: desativadoEm.toISOString(), sessoesEncerradas, credencialApagada, contaExternaDesligada, contaLimpa },
        ...autoria,
      })
    })
  }

  async eliminar(usuarioId: string, autoria: AutoriaDoCicloDeVida = {}, transacao?: TransacaoBanco): Promise<void> {
    await this.#naTransacao(usuarioId, transacao, async (tx, alvo) => {
      const repositorio = new CicloDeVidaRepository(tx)
      const sessoesApagadas = await repositorio.apagarSessoes(usuarioId)
      // As turmas dele em `FOR NO KEY UPDATE` antes de apagar os vínculos (turma → vínculo, como o encerrar e o excluir): o gerar que está no meio termina primeiro, e o acesso
      // dele cai abaixo; o que chega depois espera, reconfere o vínculo e sai `NAO_ENCONTRADO`. A revogação vem antes do
      // `delete` do usuário, que anula o `criado_por` pela FK.
      await repositorio.travarContraOGerarDoProfessor(usuarioId)
      const vinculosApagados = await repositorio.apagarVinculos(usuarioId)
      const acessosRevogados = await repositorio.revogarDeQuemSaiu(usuarioId)
      for (const revogado of acessosRevogados) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId }, ...autoria })
      const credencialApagada = await repositorio.apagarCredencialDaMatricula(usuarioId)
      const contaExternaApagada = (await repositorio.apagarContaExterna(usuarioId)) !== undefined
      const { linhaDaListaApagada, pedidosApagados } = await repositorio.apagarDaListaDeNomes(usuarioId)
      await repositorio.apagarUsuario(usuarioId)
      const contaLimpa = alvo.contaId !== null && (await new ContaGlobalRepository(tx).limparContaSemUso(alvo.contaId))
      await registro.gravar(tx, 'usuario.eliminado', {
        entidadeId: usuarioId,
        antes: { papel: alvo.papel, desativadoEm: alvo.desativadoEm?.toISOString() ?? null },
        depois: { sessoesApagadas, vinculosApagados, credencialApagada, contaExternaApagada, linhaDaListaApagada, pedidosApagados, contaLimpa },
        ...autoria,
      })
    })
  }

  /**
   * Suspende o acesso da pessoa e encerra as sessões abertas dela nesta escola, com o motivo `eliminacao_agendada` (F3, tarefa
   * 14.0; RF14; Tech Spec do F3, seção 5, "Eliminação"). **Só roda na transação de quem chama**, a do registro do pedido, depois
   * de o pedido ser inserido (a ordem de travas é pedido → usuário): a auditoria é do pedido (`pedido.agendado`), e uma falha
   * depois desfaz também a suspensão. A conta global não é travada nem tocada, e a credencial, os vínculos e a conta externa
   * ficam como estavam: o cancelamento devolve o acesso com a mesma senha.
   *
   * O próprio usuário da sessão não se agenda (a mesma regra do `desativar`), e a pessoa que não é desta escola responde
   * `NAO_ENCONTRADO`. Se ela já estava agendada, responde `PEDIDO_EM_ESTADO_INVALIDO`: o registro nunca agenda duas vezes.
   */
  async agendarEliminacao(usuarioId: string, transacao: TransacaoBanco): Promise<{ readonly agendadaEm: Date; readonly sessoesEncerradas: number }> {
    this.#conferirAlvo(usuarioId)
    const repositorio = new CicloDeVidaRepository(transacao)
    if ((await repositorio.travarUsuario(usuarioId)) === undefined) throw naoEncontrado()
    const agendadaEm = await repositorio.suspender(usuarioId)
    if (agendadaEm === undefined) throw new ErroDeDominio(ErrorCode.PEDIDO_EM_ESTADO_INVALIDO)
    return { agendadaEm, sessoesEncerradas: await repositorio.encerrarSessoesDoUsuario(usuarioId, 'eliminacao_agendada') }
  }

  /**
   * Devolve o acesso da pessoa cuja eliminação foi cancelada (F3, tarefa 14.0): apaga `eliminacao_agendada_em` na transação
   * do cancelamento, depois de o pedido ser atualizado (pedido → usuário). Devolve `false` quando não há a quem devolver: a
   * pessoa já saiu da escola (eliminada por outro caminho, como a rotina de `pessoa_desativada`), e o cancelamento do pedido
   * vale mesmo assim. As sessões que o registro encerrou **não** voltam: a pessoa entra de novo com a senha.
   */
  async cancelarEliminacao(usuarioId: string, transacao: TransacaoBanco): Promise<boolean> {
    this.#conferirAlvo(usuarioId)
    const repositorio = new CicloDeVidaRepository(transacao)
    if ((await repositorio.travarUsuario(usuarioId)) === undefined) return false
    return repositorio.devolverAcesso(usuarioId)
  }

  async desligarContaExterna(usuarioId: string, autoria: AutoriaDoCicloDeVida = {}): Promise<void> {
    await this.#naTransacao(usuarioId, undefined, async (tx, alvo) => {
      if (alvo.desativadoEm !== null) throw naoEncontrado()
      const desligada = await new CicloDeVidaRepository(tx).apagarContaExterna(usuarioId)
      if (desligada === undefined) throw naoEncontrado()
      await registro.gravar(tx, 'conta_externa.desligada', { entidadeId: desligada.id, antes: { usuarioId, provedor: desligada.provedor }, ...autoria })
    })
  }

  /** A escola do contexto, um id bem formado e que não é o da própria sessão: o que o agendamento e o cancelamento exigem antes de travar. */
  #conferirAlvo(usuarioId: string): void {
    exigirEscolaDoContexto()
    if (!esquemaId.safeParse(usuarioId).success) throw naoEncontrado()
    if (contextoAtual()?.usuarioId === usuarioId.toLowerCase()) throw naoEncontrado()
  }

  /**
   * Na transação de quem chama, ou numa própria quando não há, trava o usuário da escola do contexto e a conta dele, e só
   * então roda a ação. O próprio usuário da sessão não se desativa nem se elimina: a escola ficaria sem quem pediu, e a
   * resposta é a mesma do id de ninguém.
   */
  async #naTransacao(usuarioId: string, transacao: TransacaoBanco | undefined, acao: (tx: TransacaoBanco, alvo: UsuarioDoCicloDeVida) => Promise<void>): Promise<void> {
    exigirEscolaDoContexto()
    if (!esquemaId.safeParse(usuarioId).success) throw naoEncontrado()
    // O contexto guarda o id em minúsculas, como o Postgres o devolve: a comparação com o próprio usuário vale em qualquer caixa.
    if (contextoAtual()?.usuarioId === usuarioId.toLowerCase()) throw naoEncontrado()
    const rodar = async (tx: TransacaoBanco): Promise<void> => {
      const alvo = await new CicloDeVidaRepository(tx).travarUsuario(usuarioId)
      if (alvo === undefined) throw naoEncontrado()
      if (alvo.contaId !== null) await new ContaGlobalRepository(tx).travarConta(alvo.contaId)
      await acao(tx, alvo)
    }
    await (transacao === undefined ? this.banco.transaction(rodar) : rodar(transacao))
  }
}
