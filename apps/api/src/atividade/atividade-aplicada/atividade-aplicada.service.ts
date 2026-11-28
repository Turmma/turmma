import { DomainException, AuditoriaRecorder, encerrarProva, type Database } from '@educa/core'
import {
  ErrorCode,
  camposInvalidosDaProva,
  atividadeAplicadaResponseSchema,
  atividadeEncerradaResponseSchema,
  listaDeAtividadesAplicadasResponseSchema,
  type AtividadesAplicadasQuery,
  type AplicarAtividadeLido,
  type AtividadeAplicadaResponse,
  type AtividadeEncerradaResponse,
  type ListaDeAtividadesAplicadasResponse,
  type MudarJanelaRequest,
  type TempoAdicionalDoAluno,
} from '@educa/shared'
import { paginar } from '../../http/pagination.js'
import type { FuncaoSuspensionCheck } from '../../ia/funcao-suspension-check.js'
import { AtividadeAplicadaRepository, type AplicacaoLida, type AplicacaoParaMudarAJanela, type ArtefatoParaAplicar } from './atividade-aplicada.repository.js'

const registro = new AuditoriaRecorder()

/**
 * As recusas de quem aplica, em um lugar só (o aplicar e a segunda chamada as usam): só atividade objetiva se aplica, e a versão adaptada só com a entrega dela `aprovada`. O gatilho do banco é a
 * segunda barreira da versão adaptada.
 */
export function conferirArtefatoParaAplicar(alvo: ArtefatoParaAplicar): void {
  if (alvo.tipo !== 'atividade_objetiva') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  if (alvo.versaoAdaptada && alvo.entregaEstado !== 'aprovada') throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
}

/** A atividade aplicada como a tela a recebe (DTO explícito; regra 20, item 4): só contagem de participação, nenhum aluno. */
export function paraATela(lida: AplicacaoLida): unknown {
  return {
    id: lida.id,
    artefatoId: lida.artefatoId,
    turmaId: lida.turmaId,
    titulo: lida.titulo,
    avaliativa: lida.avaliativa,
    estado: lida.estado,
    questoes: lida.questoes,
    aplicadaEm: lida.aplicadaEm.toISOString(),
    encerradaEm: lida.encerradaEm?.toISOString() ?? null,
    janela: lida.abreEm === null || lida.fechaEm === null ? null : { abreEm: lida.abreEm.toISOString(), fechaEm: lida.fechaEm.toISOString() },
    duracaoMin: lida.duracaoMin,
    embaralhar: { questoes: lida.embaralharQuestoes, alternativas: lida.embaralharAlternativas },
    segundaChamadaDe: lida.segundaChamadaDe,
    comTempoAdicional: lida.comTempoAdicional,
    participacao: { alunos: lida.alunos, iniciaram: lida.iniciaram, enviaram: lida.enviaram },
    entrega: lida.entrega,
  }
}

/**
 * A atividade aplicada (MVP, A3; regra 70, item 3): aplicar, listar e encerrar, da professora com vínculo confirmado
 * na turma e na disciplina do artefato. A de outra turma, de outra disciplina, de outra escola e a inexistente
 * respondem o mesmo `NAO_ENCONTRADO` (regra 10, item 6).
 *
 * - **Aplicar é o ato humano que leva a saída da IA ao aluno**: fica com autor na linha e na auditoria
 *   (`atividade.aplicada`), na mesma transação. Só atividade objetiva se aplica, e a versão adaptada só com a entrega
 *   dela `aprovada`: o service recusa com erro tipado, e o gatilho do banco é a segunda barreira.
 * - **Encerrar corrige**, na mesma transação (`correcao_de_objetiva`; D33, D46): a conta é determinística, pelo
 *   gabarito, e o lote nasce `pendente`. Nada aqui aprova, e nada do resultado é visível ao aluno antes da aprovação.
 * - **Encerrar é idempotente** (regra 80, item 7): a aplicação fica travada até o commit, e quem chega depois encontra
 *   o lote vigente e não corrige de novo. Depois de o lote ser aprovado, nenhuma correção dele é inserida nem alterada.
 *   Só o lote rejeitado deixa corrigir de novo, num lote novo.
 * - **Função suspensa não corrige** (D60): a atividade encerra, as respostas ficam, e o lote não nasce. Com a função
 *   retomada, encerrar de novo corrige.
 * - **A prova online** (avaliacao-e-correcao, 1.0): aplicar leva a janela, a duração, o embaralhamento e o tempo adicional por aluno, e
 *   grava a aplicação, o `tempo_adicional` e a auditoria numa transação. O aluno do tempo adicional é da turma (aluno de outra turma, de
 *   outra escola ou inexistente respondem o mesmo `ENTRADA_INVALIDA`, sem gravar nada), e o tempo adicional cabe na janela. Mudar a janela
 *   (`mudarAJanela`) é parcial, com a aplicação travada e o estado relido, e só antes de alguém começar.
 */
export class AtividadeAplicadaService {
  constructor(
    private readonly banco: Database,
    private readonly conferencia: FuncaoSuspensionCheck,
  ) {}

  async aplicar(pedido: AplicarAtividadeLido): Promise<AtividadeAplicadaResponse> {
    const artefatoId = pedido.artefatoId.toLowerCase()
    const turmaId = pedido.turmaId.toLowerCase()
    const criada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const alvo = await aplicacoes.artefatoParaAplicar(artefatoId)
      // O artefato fora do alcance e a turma sem vínculo na disciplina dele respondem igual: nenhum confirma o outro.
      if (alvo === undefined || !(await aplicacoes.canAplicarNaTurma(turmaId, alvo.disciplinaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      conferirArtefatoParaAplicar(alvo)
      // O aluno do tempo adicional é da turma: o de outra turma, de outra escola e o inexistente respondem igual, e nada se grava.
      await this.#conferirAlunosDaTurma(aplicacoes, turmaId, pedido.tempoAdicional)
      const id = await aplicacoes.create({ turmaId, artefatoId, avaliativa: pedido.avaliativa, janela: pedido.janela, duracaoMin: pedido.duracaoMin, embaralhar: pedido.embaralhar })
      await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
      // Só a contagem de quem tem tempo adicional: o percentual por aluno é adaptação, dado sensível, e não vai para a auditoria.
      await registro.save(tx, 'atividade.aplicada', {
        entidadeId: id,
        depois: { artefatoId, turmaId, avaliativa: pedido.avaliativa, versaoAdaptada: alvo.versaoAdaptada, comTempoAdicional: pedido.tempoAdicional.length },
      })
      const lida = await aplicacoes.porId(id)
      if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return lida
    })
    return atividadeAplicadaResponseSchema.parse(paraATela(criada))
  }

  /**
   * `PATCH /v1/atividades-aplicadas/:id/janela` (RF2): muda a janela, a duração e o tempo adicional, **parcial**, antes do primeiro começo. Trava a aplicação (`for update`) e **relê o
   * estado depois da trava**: o `comecar` em andamento (que a toma em `for share`) termina antes, e a mudança recebe `PROVA_JA_COMECOU`; a outra mudança de janela em andamento termina
   * antes, e esta confere o conjunto de novo contra o que ela gravou. O que não veio no corpo vale o que está gravado, e o conjunto inteiro passa pela mesma conferência do aplicar.
   * Depois do começo o professor só estende.
   */
  async mudarAJanela(id: string, pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
    const mudada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const travada = await this.#lockAntesDoComeco(aplicacoes, id)
      const antesDoTempoAdicional = await aplicacoes.tempoAdicionalDaAplicacao(id)
      const { janela, duracaoMin, tempoAdicional } = this.#provaDepoisDaMudanca(travada, pedido, antesDoTempoAdicional)
      if (pedido.tempoAdicional !== undefined) {
        await this.#conferirAlunosDaTurma(aplicacoes, travada.turmaId, pedido.tempoAdicional)
        await aplicacoes.trocarTempoAdicional(id, pedido.tempoAdicional)
      }
      await aplicacoes.saveJanela(id, { janela, duracaoMin })
      await registro.save(tx, 'atividade.janela_alterada', {
        entidadeId: id,
        antes: { janela: travada.janela ?? null, duracaoMin: travada.duracaoMin ?? null, comTempoAdicional: antesDoTempoAdicional.length },
        depois: { janela: janela ?? null, duracaoMin: duracaoMin ?? null, comTempoAdicional: tempoAdicional.length },
      })
      const depois = await aplicacoes.porId(id)
      if (depois === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return depois
    })
    return atividadeAplicadaResponseSchema.parse(paraATela(mudada))
  }

  /**
   * A prova como ficará: o que não veio no corpo vale o que está gravado (o embaralhamento não muda por aqui), e o conjunto inteiro passa pela conferência única do aplicar.
   * Não fecha: `ENTRADA_INVALIDA`, sem dizer o campo.
   */
  #provaDepoisDaMudanca(travada: AplicacaoParaMudarAJanela, pedido: MudarJanelaRequest, tempoAdicionalAtual: readonly TempoAdicionalDoAluno[]) {
    const janela = pedido.janela ?? travada.janela
    const duracaoMin = pedido.duracaoMin ?? travada.duracaoMin
    const tempoAdicional = pedido.tempoAdicional ?? tempoAdicionalAtual
    if (camposInvalidosDaProva({ avaliativa: travada.avaliativa, janela, duracaoMin, embaralhar: travada.embaralhar, tempoAdicional }).length > 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    return { janela, duracaoMin, tempoAdicional }
  }

  /** A aplicação do professor, travada, aberta e **sem tentativa**: lida depois da trava, é o que decide se a janela ainda pode mudar. */
  async #lockAntesDoComeco(aplicacoes: AtividadeAplicadaRepository, id: string): Promise<AplicacaoParaMudarAJanela> {
    const travada = await aplicacoes.lockParaMudarAJanela(id)
    if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
    if (await aplicacoes.existeTentativa(id)) throw new DomainException(ErrorCode.PROVA_JA_COMECOU)
    return travada
  }

  /** Todo aluno da lista é aluno confirmado da turma da aplicação; senão `ENTRADA_INVALIDA`, o mesmo para o de outra turma, de outra escola e o inexistente. */
  async #conferirAlunosDaTurma(aplicacoes: AtividadeAplicadaRepository, turmaId: string, lista: readonly TempoAdicionalDoAluno[]): Promise<void> {
    if (lista.length === 0) return
    const ids = lista.map((item) => item.alunoId.toLowerCase())
    const daTurma = await aplicacoes.alunosDaTurmaEntre(turmaId, ids)
    if (ids.some((alunoId) => !daTurma.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  }

  async list(consulta: AtividadesAplicadasQuery): Promise<ListaDeAtividadesAplicadasResponse> {
    const linhas = await new AtividadeAplicadaRepository(this.banco).list({ ...consulta, turmaId: consulta.turmaId.toLowerCase() })
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeAtividadesAplicadasResponseSchema.parse({ itens: itens.map(paraATela), ...(proxima === undefined ? {} : { proxima }) })
  }

  /**
   * Encerrar é da professora com a aplicação no alcance dela (`lock`), e o resto é o **miolo do `core`**, o mesmo que a rotina da prova vencida usa (`encerrarProva`; Tech Spec §5.5 e §5.6, "Onde mora o miolo"):
   * encerra, grava a vencida (`enviada_em` = limite) e corrige, na mesma transação.
   */
  async encerrar(id: string): Promise<AtividadeEncerradaResponse> {
    const encerrada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const travada = await aplicacoes.lock(id)
      if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await encerrarProva(tx, travada, () => this.#suspensa())
      const lida = await aplicacoes.porId(id)
      if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return lida
    })
    // A correção é uma conta, feita na transação: não há execução de agente a consultar.
    return atividadeEncerradaResponseSchema.parse({ atividade: paraATela(encerrada), execucaoId: null })
  }

  /** A função `correcao_de_objetiva` está suspensa na escola? Falha da consulta não vira "ativa": sobe como erro. */
  async #suspensa(): Promise<boolean> {
    try {
      await this.conferencia.exigirAtiva('correcao_de_objetiva')
      return false
    } catch (erro) {
      if (erro instanceof DomainException && erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return true
      throw erro
    }
  }
}
