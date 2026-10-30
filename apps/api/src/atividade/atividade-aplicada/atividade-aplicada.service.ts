import { ErroDeDominio, RegistroDeAuditoria, type Banco, type TransacaoBanco } from '@educa/nucleo'
import {
  ErrorCode,
  conteudoDeAtividadeSchema,
  atividadeAplicadaResponseSchema,
  atividadeEncerradaResponseSchema,
  listaDeAtividadesAplicadasResponseSchema,
  type AtividadesAplicadasQuery,
  type AplicarAtividadeRequest,
  type AtividadeAplicadaResponse,
  type AtividadeEncerradaResponse,
  type ListaDeAtividadesAplicadasResponse,
} from '@educa/shared'
import { paginar } from '../../http/paginacao.js'
import type { ConferenciaDeFuncao } from '../../ia/conferencia-de-funcao.js'
import { AtividadeAplicadaRepository, type AplicacaoLida, type AplicacaoTravada } from './atividade-aplicada.repository.js'
import { acertosDoLote, corrigirTentativa, destaquesDaTentativa, type HistoricoAprovado } from '../correcao/correcao-de-objetiva.js'
import { CorrecaoRepository, type NovaCorrecao } from '../correcao/correcao.repository.js'

const registro = new RegistroDeAuditoria()

/** A atividade aplicada como a tela a recebe (DTO explícito; regra 20, item 4): só contagem de participação, nenhum aluno. */
function paraATela(lida: AplicacaoLida): unknown {
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
 */
export class AtividadeAplicadaService {
  constructor(
    private readonly banco: Banco,
    private readonly conferencia: ConferenciaDeFuncao,
  ) {}

  async aplicar(pedido: AplicarAtividadeRequest): Promise<AtividadeAplicadaResponse> {
    const artefatoId = pedido.artefatoId.toLowerCase()
    const turmaId = pedido.turmaId.toLowerCase()
    const criada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const alvo = await aplicacoes.artefatoParaAplicar(artefatoId)
      // O artefato fora do alcance e a turma sem vínculo na disciplina dele respondem igual: nenhum confirma o outro.
      if (alvo === undefined || !(await aplicacoes.podeAplicarNaTurma(turmaId, alvo.disciplinaId))) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      if (alvo.tipo !== 'atividade_objetiva') throw new ErroDeDominio(ErrorCode.ENTRADA_INVALIDA)
      if (alvo.versaoAdaptada && alvo.entregaEstado !== 'aprovada') throw new ErroDeDominio(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
      const id = await aplicacoes.criar({ turmaId, artefatoId, avaliativa: pedido.avaliativa })
      await registro.gravar(tx, 'atividade.aplicada', { entidadeId: id, depois: { artefatoId, turmaId, avaliativa: pedido.avaliativa, versaoAdaptada: alvo.versaoAdaptada } })
      const lida = await aplicacoes.porId(id)
      if (lida === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      return lida
    })
    return atividadeAplicadaResponseSchema.parse(paraATela(criada))
  }

  async listar(consulta: AtividadesAplicadasQuery): Promise<ListaDeAtividadesAplicadasResponse> {
    const linhas = await new AtividadeAplicadaRepository(this.banco).listar({ ...consulta, turmaId: consulta.turmaId.toLowerCase() })
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeAtividadesAplicadasResponseSchema.parse({ itens: itens.map(paraATela), ...(proxima === undefined ? {} : { proxima }) })
  }

  async encerrar(id: string): Promise<AtividadeEncerradaResponse> {
    const encerrada = await this.banco.transaction(async (tx) => {
      const aplicacoes = new AtividadeAplicadaRepository(tx)
      const travada = await aplicacoes.travar(id)
      if (travada === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      if (travada.estado === 'aberta') await aplicacoes.encerrar(id)
      await this.#corrigir(tx, travada)
      const lida = await aplicacoes.porId(id)
      if (lida === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
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
      if (erro instanceof ErroDeDominio && erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return true
      throw erro
    }
  }

  /**
   * A correção do lote, com a aplicação já travada. Não corrige se a aplicação já tem lote pendente ou aprovado (é o
   * que faz a reexecução não inserir nem alterar correção), se a função está suspensa, ou se ninguém abriu a atividade.
   * **Quem nunca abriu não tem correção**: faltar não é ficar em branco.
   */
  async #corrigir(tx: TransacaoBanco, aplicacao: AplicacaoTravada): Promise<void> {
    const correcoes = new CorrecaoRepository(tx)
    if (await correcoes.temLoteVigente(aplicacao.id)) return
    if (await this.#suspensa()) return
    const respostas = await correcoes.respostasPorAluno(aplicacao.id)
    if (respostas.size === 0) return

    const { questoes } = conteudoDeAtividadeSchema.parse(aplicacao.conteudo)
    const historico = new Map<string, HistoricoAprovado>()
    for (const anterior of await correcoes.historicoAprovado([...respostas.keys()], aplicacao.disciplinaId)) {
      const soma = historico.get(anterior.alunoId) ?? { acertos: 0, total: 0 }
      historico.set(anterior.alunoId, { acertos: soma.acertos + anterior.acertos, total: soma.total + anterior.total })
    }
    const lote = acertosDoLote(questoes, [...respostas.values()])
    const novas: NovaCorrecao[] = [...respostas].map(([alunoId, marcadas]) => {
      const correcao = corrigirTentativa(questoes, marcadas)
      return { alunoId, ...correcao, destaques: destaquesDaTentativa({ questoes, respostas: marcadas, correcao, historico: historico.get(alunoId), lote }) }
    })
    await correcoes.criarLote(aplicacao, novas)
  }
}
