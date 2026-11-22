import {
  AuditoriaRecorder,
  currentContext,
  diaAnterior,
  diaDeUso,
  DomainException,
  estadoDaCoordenacao,
  mapPostgresError,
  OrcamentoDoMesRepository,
  postgresErrorIn,
  runInContext,
  requireContextOperador,
  systemClock,
  type Database,
  type Clock,
} from '@educa/core'
import {
  ErrorCode,
  centavosParaMicros,
  conviteDaCoordenacaoResponseSchema,
  criadoNoPainelResponseSchema,
  escolasDoPainelResponseSchema,
  mesmoOrcamentoDefinido,
  orcamentoDaEscolaNoPainel,
  orcamentoDaRedeNoPainel,
  orcamentoDeIaDoPainelSchema,
  orcamentoDoMes,
  orcamentoVigente,
  redesDoPainelResponseSchema,
  usoDeIaDaEscolaDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  type OrcamentoDefinido,
  type OrcamentoDeIaDoPainel,
  type OrcamentoDeIaRequest,
  type PainelQuery,
  type UsoDeIaDaEscolaDoPainel,
  type UsoDeIaDaEscolaDoPainelResponse,
  type UsoDoPainelQuery,
  type ConviteDaCoordenacaoRequest,
  type CriarEscolaRequest,
  type CriarRedeRequest,
  type ConviteDaCoordenacaoResponse,
  type CriadoNoPainelResponse,
  type EscolasDoPainelResponse,
  type RedesDoPainelResponse,
  type UsoDoPainelResponse,
} from '@educa/shared'
import { Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { createEscola, createRede } from '../escola/escola.js'
import { type AuthorCheck, createConviteDeCoordenador, refazerConviteDaCoordenacao, revogarConvitePeloOperador } from '../../sessao/index.js'
import { OperadorRepository } from '../operador/operador.repository.js'
import { OrcamentoDaRedeRepository } from './orcamento-da-rede.repository.js'
import { PainelRepository, type IaLidaNoPainel, type ReferenciaDoUso } from './painel.repository.js'

/**
 * O autor das escritas do painel: o operador da sessão, conferido dentro da transação da escrita (Tech Spec da A0b,
 * seção 7c, "Autor ativo"). Desativado entre a guarda e aqui, ou enquanto a escrita esperava a linha dele: a sessão
 * acabou de terminar, e nada é gravado. O corpo do pedido nunca chega aqui.
 */
function autorDaSessao(operadorId: string): AuthorCheck {
  return async (tx) => {
    const apelido = await OperadorRepository.autorAtivoNaTransacao(tx, { operadorId })
    if (apelido === undefined) throw new DomainException(ErrorCode.SESSAO_ENCERRADA)
    return apelido
  }
}

/**
 * O período do uso lido no instante `agora`: o último dia fechado, que é o dia civil de São Paulo anterior ao de hoje
 * (`diaDeUso`, o mesmo fuso da consolidação), e o mês dele, do dia 1 até ele. Às 22h de São Paulo, já o dia seguinte em
 * UTC, o último dia fechado continua o de ontem em São Paulo; no dia 1, o mês é o anterior.
 */
export function referenciaDoUso(agora: Date): ReferenciaDoUso {
  const dia = diaAnterior(diaDeUso(agora))
  return { dia, primeiroDoMes: `${dia.slice(0, 7)}-01` }
}

/** O pedido em micros: o valor digitado em centavos vira micros, e o teto segue em %. Nulo continua nulo ("sem valor próprio", e a escola volta a valer o da rede). */
function definidoPeloPedido(pedido: OrcamentoDeIaRequest): OrcamentoDefinido {
  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: pedido.tetoDeSegurancaPercentual }
}

/**
 * O grupo `ia` de uma escola no uso: o consumo de hoje e do mês, e o orçamento do mês corrente, calculado **na hora** com os alunos ativos de hoje e o que vale (a escola sobre a rede, coluna a coluna): a mesma conta
 * (`orcamentoVigente`, `orcamentoDoMes`) do lote, da Governança e da medida. Sem valor, `sem_orcamento`; sem aluno ativo, `sem_aluno_ativo`; nos dois a porcentagem é nula e os reais seguem no consumo.
 */
function iaDaEscola(ia: IaLidaNoPainel): UsoDeIaDaEscolaDoPainel {
  const vigente = orcamentoVigente(ia.orcamento.escola, ia.orcamento.rede)
  // `true` é o mês corrente, o único que tem aviso; o aviso sai calculado e fica de fora do uso de propósito (o contrato do uso só leva a porcentagem, e o aviso é do lote e da Governança).
  const mes = orcamentoDoMes({ alunosAtivos: ia.alunosAtivos, valorPorAlunoMicros: vigente.valorPorAlunoMicros, tetoPercentual: vigente.tetoPercentual, origemDoValor: vigente.origemDoValor }, ia.mes.custoMicros, true)
  return {
    hoje: ia.hoje,
    mes: ia.mes,
    alunosAtivos: ia.alunosAtivos,
    valorPorAlunoMicros: vigente.valorPorAlunoMicros,
    origemDoValor: vigente.origemDoValor,
    porcentagem: mes.porcentagem,
    // O cast é seguro: o mês corrente nunca é `sem_retrato` (essa situação é só do mês fechado sem retrato), e o `parse` estrito do uso recusa se um dia for.
    situacao: mes.situacao as UsoDeIaDaEscolaDoPainel['situacao'],
  }
}

/** O estado do orçamento como a auditoria o guarda, com os nomes dela. */
function auditado(definido: OrcamentoDefinido): { valorPorAlunoMicros: number | null; tetoDeSegurancaPercentual: number | null } {
  return { valorPorAlunoMicros: definido.valorPorAlunoMicros, tetoDeSegurancaPercentual: definido.tetoPercentual }
}

const registro = new AuditoriaRecorder()

/** Roda `logar` com a escola no contexto, além dos ids da requisição: a linha de log leva só ids (regra 20, item 9). */
function naEscola(escolaId: string, logar: () => void): void {
  runInContext({ ...(currentContext() ?? { requisicaoId: randomUUID() }), escolaId }, logar)
}

/**
 * O painel da operação (A0b, D76): o operador cria rede e escola pelos mesmos casos de uso do `ops:escola`, com o id
 * sorteado pela web (o clique duplo devolve o mesmo id, sem criar outra), lê as redes, e gera e revoga o convite da
 * coordenação pelos mesmos casos de uso do `ops:convite-coordenador` e do `ops:revogar-convite`, e o refaz (só pelo
 * painel).
 *
 * - A auditoria (`rede.criada`, `escola.criada`, `convite.criado`, `convite.refeito`, `convite.revogado`) leva o apelido
 *   do operador da sessão, conferido na transação.
 * - O log leva só o evento e os ids do contexto (`operacao.rede.criada`, `operacao.escola.criada`,
 *   `operacao.convite.gerado`, `operacao.convite.refeito` e `operacao.convite.revogado`, com a escola): nunca nome,
 *   e-mail, endereço nem token. O pedido repetido não loga de novo, como não audita de novo.
 * - A escola do `:id` do caminho (que o controller só confere como UUID) vai só ao caso de uso do gerar, que abre o
 *   contexto dela depois de conferir o autor (Tech Spec da A0b, seção 6).
 * - A leitura entre escolas (redes, a lista e o uso) vem só do `PainelRepository`, e sai pelos contratos estritos de
 *   `packages/shared`: id, nome, endereço e número, nunca pessoa. A leitura não audita nem loga: não traz dado de aluno
 *   nem de pessoa (Tech Spec da A0b, seção 7).
 */
export class PainelService {
  readonly #logger = new Logger('operacao')

  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** As redes com o orçamento de IA próprio e o vigente (a rede vale para a escola sem nada próprio) e quantas escolas usam o valor ou o teto dela. */
  async redes(): Promise<RedesDoPainelResponse> {
    const lidas = await new PainelRepository(this.banco).redes()
    return redesDoPainelResponseSchema.parse({ itens: lidas.map(({ orcamento, ...rede }) => ({ ...rede, orcamento: orcamentoDaRedeNoPainel(orcamento) })) })
  }

  /**
   * Uma página da lista de escolas, com o estado da coordenação calculado pela mesma `estadoDaCoordenacao` da escrita, e o
   * `conviteId` do último convite de coordenação, quando há. Na ordem `uso`, o mês de referência é o do `uso`.
   */
  async escolas({ pagina, ordem }: PainelQuery): Promise<EscolasDoPainelResponse> {
    const agora = this.relogio.agora()
    const lida = await new PainelRepository(this.banco).escolas({ pagina, ordem, referencia: referenciaDoUso(agora), agora })
    return escolasDoPainelResponseSchema.parse({
      pagina,
      total: lida.total,
      itens: lida.itens.map(({ coordenacao, orcamento, ...escola }) => ({
        ...escola,
        orcamento: orcamentoDaEscolaNoPainel(orcamento.escola, orcamento.rede),
        estado: estadoDaCoordenacao(coordenacao),
        ...(coordenacao.ultimoConvite === undefined ? {} : { conviteId: coordenacao.ultimoConvite.id }),
      })),
    })
  }

  /**
   * Uma página do uso por escola, com o último dia fechado e o mês dele como referência para a infra, e o grupo `ia` (hoje e o mês corrente de São Paulo, pelo relógio do serviço). Na ordem `custo`, a de maior
   * custo de IA do mês primeiro.
   */
  async uso({ pagina, ordem }: UsoDoPainelQuery): Promise<UsoDoPainelResponse> {
    const agora = this.relogio.agora()
    const referencia = referenciaDoUso(agora)
    const lida = await new PainelRepository(this.banco).uso({ pagina, ordem, referencia, agora })
    return usoDoPainelResponseSchema.parse({
      pagina,
      total: lida.total,
      itens: lida.itens.map(({ ia, ...uso }) => ({ ...uso, orcamento: orcamentoDaEscolaNoPainel(ia.orcamento.escola, ia.orcamento.rede), ia: iaDaEscola(ia) })),
      dia: referencia.dia,
      mes: referencia.dia.slice(0, 7),
    })
  }

  /**
   * Os 12 meses anteriores da escola do `:id`, cada um **pelo retrato** (camada-ia, 5.0; RF11). Tudo no contexto da escola: o consumo, o retrato e a existência da escola partem do `:id`, e a leitura de outra escola
   * não entra. Escola inexistente é `NAO_ENCONTRADO`. Não audita nem loga: só número, sem aluno nem pessoa.
   */
  async usoDeIaDaEscola(escolaId: string): Promise<UsoDeIaDaEscolaDoPainelResponse> {
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    const meses = await runInContext({ requisicaoId, escolaId }, () => new OrcamentoDoMesRepository(this.banco).usoDosMesesAnteriores(this.relogio.agora()))
    if (meses === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return usoDeIaDaEscolaDoPainelResponseSchema.parse({
      meses: meses.map(({ mes, uso, orcamento }) => ({
        mes,
        ...uso,
        alunosAtivos: orcamento.alunosAtivos,
        valorPorAlunoMicros: orcamento.valorPorAlunoMicros,
        origemDoValor: orcamento.origemDoValor,
        porcentagem: orcamento.porcentagem,
        situacao: orcamento.situacao,
      })),
    })
  }

  async createRede(pedido: CriarRedeRequest): Promise<CriadoNoPainelResponse> {
    const autor = autorDaSessao(requireContextOperador())
    const criada = await createRede(this.banco, autor, { id: pedido.id.toLowerCase(), nome: pedido.nome, tipo: pedido.tipo })
    if (criada.nova) this.#logger.log('operacao.rede.criada')
    return criadoNoPainelResponseSchema.parse({ id: criada.id })
  }

  async createEscola(pedido: CriarEscolaRequest): Promise<CriadoNoPainelResponse> {
    const autor = autorDaSessao(requireContextOperador())
    const criada = await createEscola(this.banco, autor, { id: pedido.id.toLowerCase(), redeId: pedido.redeId.toLowerCase(), nome: pedido.nome, slug: pedido.slug })
    if (criada.nova) naEscola(criada.id, () => this.#logger.log('operacao.escola.criada'))
    return criadoNoPainelResponseSchema.parse({ id: criada.id })
  }

  /** Gera o convite da primeira coordenação da escola do `:id`, pela matriz da seção 5. O token sai só nesta resposta. */
  async generateConvite(escolaId: string, pedido: ConviteDaCoordenacaoRequest): Promise<ConviteDaCoordenacaoResponse> {
    const autor = autorDaSessao(requireContextOperador())
    const gerado = await createConviteDeCoordenador(this.banco, autor, { escolaId, email: pedido.email, nome: pedido.nome })
    naEscola(escolaId, () => this.#logger.log('operacao.convite.gerado'))
    return conviteDaCoordenacaoResponseSchema.parse(gerado)
  }

  /** Refaz o convite da coordenação pelo id, pela matriz da seção 5; a escola vem do convite. O token sai só nesta resposta. */
  async refazerConvite(conviteId: string): Promise<ConviteDaCoordenacaoResponse> {
    const autor = autorDaSessao(requireContextOperador())
    const refeito = await refazerConviteDaCoordenacao(this.banco, autor, conviteId)
    naEscola(refeito.escolaId, () => this.#logger.log('operacao.convite.refeito'))
    return conviteDaCoordenacaoResponseSchema.parse({ conviteId: refeito.conviteId, token: refeito.token })
  }

  /** Revoga o convite da coordenação pelo id, pela matriz da seção 5; a escola vem do convite. */
  async revogarConvite(conviteId: string): Promise<void> {
    const autor = autorDaSessao(requireContextOperador())
    const { escolaId } = await revogarConvitePeloOperador(this.banco, autor, conviteId)
    naEscola(escolaId, () => this.#logger.log('operacao.convite.revogado'))
  }

  /**
   * Define o orçamento de IA da escola do `:id` (camada-ia, 3.0; RF7). Tudo numa transação, **no contexto da escola**: o autor conferido primeiro, a linha de configuração garantida e travada
   * (`for update`), o `antes` lido já com a trava, a gravação e a auditoria `escola.orcamento_ia_alterado`, **só quando o `depois` difere do `antes`** (o mesmo pedido de novo não grava nem audita).
   * Escola inexistente é `NAO_ENCONTRADO` (a chave estrangeira da linha de configuração a recusa), e escola sem ano `em_curso` também grava: o contexto é só a escola. Devolve o orçamento próprio e o vigente.
   */
  async definirOrcamentoDaEscola(escolaId: string, pedido: OrcamentoDeIaRequest): Promise<OrcamentoDeIaDoPainel> {
    const autor = autorDaSessao(requireContextOperador())
    const depois = definidoPeloPedido(pedido)
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    try {
      const resultado = await runInContext({ requisicaoId, escolaId }, () =>
        this.banco.transaction(async (tx) => {
          const autorOperador = await autor(tx)
          const orcamentos = new OrcamentoDoMesRepository(tx)
          const antes = await orcamentos.lockConfiguracaoDaEscola()
          const mudou = !mesmoOrcamentoDefinido(antes, depois)
          if (mudou) {
            await orcamentos.saveConfiguracaoDaEscola(depois)
            await registro.save(tx, 'escola.orcamento_ia_alterado', { entidadeId: escolaId, antes: auditado(antes), depois: auditado(depois), autorOperador })
          }
          return { mudou, rede: await orcamentos.configuracaoDaRede() }
        }),
      )
      if (resultado.mudou) naEscola(escolaId, () => this.#logger.log('operacao.escola.orcamento_ia_alterado'))
      return orcamentoDeIaDoPainelSchema.parse(orcamentoDaEscolaNoPainel(depois, resultado.rede))
    } catch (erro) {
      // foreign_key_violation: a escola do caminho não existe.
      if (postgresErrorIn(erro)?.code === '23503') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      throw mapPostgresError(erro) ?? erro
    }
  }

  /**
   * Define o orçamento de IA da rede do `:id` (camada-ia, 3.0; RF7), acima do tenant: o `OrcamentoDaRedeRepository` trava a linha da rede, lê o `antes` e grava só se mudou, e a auditoria
   * `rede.orcamento_ia_alterado` (sem escola, assinada pelo operador) vai na mesma transação. Rede inexistente é `NAO_ENCONTRADO`, sem auditoria: é o `select` vazio, e não uma chave estrangeira recusada (a rede não grava linha nova), e por isso, ao contrário do `PUT` da escola, não há `catch` que traduza o `23503`; erro inesperado do Postgres sobe como está. A contagem de escolas afetadas vem do `GET /v1/operacao/redes`.
   */
  async definirOrcamentoDaRede(redeId: string, pedido: OrcamentoDeIaRequest): Promise<OrcamentoDeIaDoPainel> {
    const autor = autorDaSessao(requireContextOperador())
    const depois = definidoPeloPedido(pedido)
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    const definida = await runInContext({ requisicaoId }, () =>
      this.banco.transaction(async (tx) => {
        const autorOperador = await autor(tx)
        const definida = await new OrcamentoDaRedeRepository(tx).definir(redeId, depois)
        if (definida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (definida.mudou) await registro.save(tx, 'rede.orcamento_ia_alterado', { entidadeId: redeId, antes: auditado(definida.antes), depois: auditado(depois), autorOperador })
        return definida
      }),
    )
    if (definida.mudou) this.#logger.log('operacao.rede.orcamento_ia_alterado')
    return orcamentoDeIaDoPainelSchema.parse(orcamentoDaRedeNoPainel(depois))
  }
}
