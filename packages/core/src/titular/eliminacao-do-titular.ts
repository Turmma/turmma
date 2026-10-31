import { AUTOR_DA_ROTINA, InvariantException } from '@educa/shared'
import { AuditoriaRecorder } from '../auditoria/auditoria-recorder.js'
import { CicloDeVidaService, type AutoriaDoCicloDeVida } from '../ciclo-de-vida/ciclo-de-vida.service.js'
import { currentContext, runInContext } from '../context/context.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database } from '../db/database.js'
import { systemClock, type Clock } from '../clock.js'
import { Compartilhamento } from './compartilhamento.js'
import { EliminacaoDoTitularRepository } from './eliminacao-do-titular.repository.js'
import { haHomonimoDoTitular } from './homonimo.js'
import { FAIXA_DA_TROCA_DE_NOME, TrocaDeNome } from './troca-de-nome.js'

export interface EliminacaoOptions {
  /**
   * `true` quando o horário letivo da escola abriu: conferida **antes de cada faixa** da troca de nome. Quando abre, o job
   * termina sem rodar a etapa 3, e o pedido continua `agendado` (a rotina da noite seguinte o enfileira de novo).
   */
  readonly janelaAberta: () => boolean
  /** Linhas examinadas por faixa da troca de nome. Só o teste troca. */
  readonly faixa?: number
}

/**
 * - `concluida`: a etapa 3 rodou, a pessoa saiu (ou já não estava), e o pedido ficou `concluido`.
 * - `sem_efeito`: o pedido não está `agendado`, não venceu, é de outra escola ou não existe: nada mudou.
 * - `interrompida_pela_janela`: a janela letiva abriu entre duas faixas da troca; o que já foi trocado fica, e nada foi eliminado.
 */
export type ResultadoDaEliminacao = 'concluida' | 'sem_efeito' | 'interrompida_pela_janela'

const registro = new AuditoriaRecorder()

/**
 * A eliminação do titular no 8º dia (F3, tarefa 15.0; RF14 e RF15; Tech Spec do F3, seção 5, "`titular.eliminar`"). É o que o
 * job `titular.eliminar` da fila de lote executa, no contexto da escola do job, em três passos:
 *
 * 1. **Confere** que o pedido é desta escola, é de eliminação, está `agendado` e venceu (`eliminar_em <= now()`); senão, nada.
 * 2. **Troca o nome** (só o aluno, e só sem homônimo ativo nem nome livre igual na lista): o nome completo atual sai dos
 *    textos livres, em faixas, com a janela letiva conferida entre elas (`TrocaDeNome`). O professor não tem troca, e o
 *    aluno com homônimo fica com `homonimo = true` e sem troca (o texto pode ser do outro).
 * 3. **Uma transação**, na ordem pedido → usuário: trava o pedido (`FOR UPDATE`; fora de `agendado`, termina sem efeito),
 *    **refaz a foto do compartilhamento** (a eliminação apaga as datas de entrada de onde ela sai), anonimiza as execuções
 *    do titular e o texto do consumo delas, roda `CicloDeVidaService.eliminar` **nesta transação** (uma falha dele desfaz a
 *    anonimização), marca `apagado_em` nos arquivos dele, conclui os outros pedidos abertos do titular e conclui o pedido.
 *
 * **O autor**: quem registrou o pedido, se ainda é usuário ativo da escola (o gatilho da auditoria exige usuário da escola);
 * senão, `rotina` (`AUTOR_DA_ROTINA`), que o banco só aceita em `usuario.eliminado`, `acesso_turma.revogado`,
 * `titular.nome_trocado` e `pedido.concluido`. É decidido **sob a trava**, na etapa 3: quem registrou foi desativado entre o
 * agendamento e o 8º dia é o caso previsto, e o pedido conclui com `rotina`, sem erro do gatilho.
 *
 * Reexecução e dois jobs do mesmo pedido são inofensivos (D49): a troca de nome é idempotente, e a trava do pedido deixa
 * passar um só. A pessoa que já saiu da escola (por outro caminho) não tem o que eliminar: o pedido conclui sem
 * `usuario.eliminado`, e a foto salva fica como estava, porque sem a pessoa o rastro dela já saiu.
 */
export class EliminacaoDoTitular {
  readonly #cicloDeVida: CicloDeVidaService
  readonly #troca: TrocaDeNome

  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {
    this.#cicloDeVida = new CicloDeVidaService(banco)
    this.#troca = new TrocaDeNome(banco)
  }

  async eliminar(pedidoId: string, { janelaAberta, faixa = FAIXA_DA_TROCA_DE_NOME }: EliminacaoOptions): Promise<ResultadoDaEliminacao> {
    requireEscolaId()
    const leitura = new EliminacaoDoTitularRepository(this.banco)
    const pedido = await leitura.vencido(pedidoId)
    if (pedido === undefined) return 'sem_efeito'

    let nomeTrocado = false
    let homonimo = false
    if (pedido.papel === 'aluno') {
      const nome = await leitura.nomeDoTitular(pedido.titularId)
      if (nome !== undefined) {
        homonimo = await haHomonimoDoTitular(this.banco, pedido.titularId)
        if (!homonimo) {
          const ativo = await leitura.registradorAtivo(pedido.registradoPor)
          const troca = await this.#comAutor(ativo ? pedido.registradoPor : undefined, (autoria) => this.#troca.trocar({ pedidoId, nome, autoria, janelaAberta, faixa }))
          if (!troca.concluida) return 'interrompida_pela_janela'
          nomeTrocado = true
        }
      }
    }

    return this.banco.transaction(async (tx) => {
      const gravacao = new EliminacaoDoTitularRepository(tx)
      const travado = await gravacao.travarVencido(pedidoId)
      if (travado === undefined) return 'sem_efeito' as const
      const ativo = await gravacao.registradorAtivo(travado.registradoPor)
      return this.#comAutor(ativo ? travado.registradoPor : undefined, async (autoria) => {
        const existe = (await gravacao.nomeDoTitular(travado.titularId)) !== undefined
        if (existe) {
          await gravacao.gravarCompartilhamento(travado.id, await new Compartilhamento(tx, this.relogio).doTitular({ titularId: travado.titularId, papel: travado.papel }))
          await gravacao.anonimizarExecucoes(travado.titularId, this.relogio.agora())
          // A pessoa que saiu por outro caminho entre a leitura e a trava faz o `eliminar` responder `NAO_ENCONTRADO` antes de qualquer
          // escrita: o job falha, a etapa 3 desfaz e a tentativa seguinte já não a encontra (`existe` falso) e só conclui o pedido.
          await this.#cicloDeVida.eliminar(travado.titularId, autoria, tx)
        }
        await gravacao.marcarArquivosApagados(travado.titularId)
        for (const outro of await gravacao.concluirOutrosAbertos(travado.titularId, travado.id)) {
          await registro.gravar(tx, 'pedido.concluido', { entidadeId: outro.id, antes: { estado: outro.estado }, depois: { estado: 'concluido' }, ...autoria })
        }
        // Sob a trava do pedido, `agendado` não muda: se mesmo assim não concluir, a transação inteira (a pessoa, a anonimização) desfaz.
        if (!(await gravacao.concluir(travado.id, { nomeTrocado, homonimo }))) throw new InvariantException('pedido de eliminação não concluído sob a trava')
        await registro.gravar(tx, 'pedido.concluido', { entidadeId: travado.id, antes: { estado: 'agendado' }, depois: { estado: 'concluido' }, ...autoria })
        return 'concluida' as const
      })
    })
  }

  /**
   * Roda `acao` assinando como a pessoa da coordenação (`usuarioId` no contexto, e o registro da auditoria o lê de lá) ou,
   * sem ela, como a rotina (`autorOperador`). O contexto novo guarda a mesma escola e a mesma requisição.
   */
  async #comAutor<T>(usuarioId: string | undefined, acao: (autoria: AutoriaDoCicloDeVida) => Promise<T>): Promise<T> {
    const contexto = currentContext()
    if (contexto === undefined) throw new InvariantException('eliminação do titular fora de um contexto')
    if (usuarioId === undefined) return acao({ autorOperador: AUTOR_DA_ROTINA })
    return runInContext({ ...contexto, usuarioId }, () => acao({}))
  }
}
