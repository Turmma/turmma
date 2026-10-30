import {
  contextoAtual,
  diaAnterior,
  diaDeUso,
  ErroDeDominio,
  estadoDaCoordenacao,
  executarNoContexto,
  exigirOperadorDoContexto,
  relogioDoSistema,
  type Banco,
  type Relogio,
} from '@educa/nucleo'
import {
  ErrorCode,
  conviteDaCoordenacaoResponseSchema,
  criadoNoPainelResponseSchema,
  escolasDoPainelResponseSchema,
  redesDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  type PainelQuery,
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
import { criarEscola, criarRede } from '../escola/escola.js'
import { type ConferenciaDoAutor, criarConviteDeCoordenador, refazerConviteDaCoordenacao, revogarConvitePeloOperador } from '../../sessao/index.js'
import { OperadorRepository } from '../operador/operador.repository.js'
import { PainelRepository, type ReferenciaDoUso } from './painel.repository.js'

/**
 * O autor das escritas do painel: o operador da sessão, conferido dentro da transação da escrita (Tech Spec da A0b,
 * seção 7c, "Autor ativo"). Desativado entre a guarda e aqui, ou enquanto a escrita esperava a linha dele: a sessão
 * acabou de terminar, e nada é gravado. O corpo do pedido nunca chega aqui.
 */
function autorDaSessao(operadorId: string): ConferenciaDoAutor {
  return async (tx) => {
    const apelido = await OperadorRepository.autorAtivoNaTransacao(tx, { operadorId })
    if (apelido === undefined) throw new ErroDeDominio(ErrorCode.SESSAO_ENCERRADA)
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

/** Roda `logar` com a escola no contexto, além dos ids da requisição: a linha de log leva só ids (regra 20, item 9). */
function naEscola(escolaId: string, logar: () => void): void {
  executarNoContexto({ ...(contextoAtual() ?? { requisicaoId: randomUUID() }), escolaId }, logar)
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
    private readonly banco: Banco,
    private readonly relogio: Relogio = relogioDoSistema,
  ) {}

  async redes(): Promise<RedesDoPainelResponse> {
    return redesDoPainelResponseSchema.parse({ itens: await new PainelRepository(this.banco).redes() })
  }

  /**
   * Uma página da lista de escolas, com o estado da coordenação calculado pela mesma `estadoDaCoordenacao` da escrita, e o
   * `conviteId` do último convite de coordenação, quando há. Na ordem `uso`, o mês de referência é o do `uso`.
   */
  async escolas({ pagina, ordem }: PainelQuery): Promise<EscolasDoPainelResponse> {
    const lida = await new PainelRepository(this.banco).escolas({ pagina, ordem, referencia: referenciaDoUso(this.relogio.agora()) })
    return escolasDoPainelResponseSchema.parse({
      pagina,
      total: lida.total,
      itens: lida.itens.map(({ coordenacao, ...escola }) => ({
        ...escola,
        estado: estadoDaCoordenacao(coordenacao),
        ...(coordenacao.ultimoConvite === undefined ? {} : { conviteId: coordenacao.ultimoConvite.id }),
      })),
    })
  }

  /** Uma página do uso por escola, com o último dia fechado e o mês dele como referência. */
  async uso({ pagina, ordem }: PainelQuery): Promise<UsoDoPainelResponse> {
    const referencia = referenciaDoUso(this.relogio.agora())
    const lida = await new PainelRepository(this.banco).uso({ pagina, ordem, referencia })
    return usoDoPainelResponseSchema.parse({ pagina, total: lida.total, itens: lida.itens, dia: referencia.dia, mes: referencia.dia.slice(0, 7) })
  }

  async criarRede(pedido: CriarRedeRequest): Promise<CriadoNoPainelResponse> {
    const autor = autorDaSessao(exigirOperadorDoContexto())
    const criada = await criarRede(this.banco, autor, { id: pedido.id.toLowerCase(), nome: pedido.nome, tipo: pedido.tipo })
    if (criada.nova) this.#logger.log('operacao.rede.criada')
    return criadoNoPainelResponseSchema.parse({ id: criada.id })
  }

  async criarEscola(pedido: CriarEscolaRequest): Promise<CriadoNoPainelResponse> {
    const autor = autorDaSessao(exigirOperadorDoContexto())
    const criada = await criarEscola(this.banco, autor, { id: pedido.id.toLowerCase(), redeId: pedido.redeId.toLowerCase(), nome: pedido.nome, slug: pedido.slug })
    if (criada.nova) naEscola(criada.id, () => this.#logger.log('operacao.escola.criada'))
    return criadoNoPainelResponseSchema.parse({ id: criada.id })
  }

  /** Gera o convite da primeira coordenação da escola do `:id`, pela matriz da seção 5. O token sai só nesta resposta. */
  async gerarConvite(escolaId: string, pedido: ConviteDaCoordenacaoRequest): Promise<ConviteDaCoordenacaoResponse> {
    const autor = autorDaSessao(exigirOperadorDoContexto())
    const gerado = await criarConviteDeCoordenador(this.banco, autor, { escolaId, email: pedido.email, nome: pedido.nome })
    naEscola(escolaId, () => this.#logger.log('operacao.convite.gerado'))
    return conviteDaCoordenacaoResponseSchema.parse(gerado)
  }

  /** Refaz o convite da coordenação pelo id, pela matriz da seção 5; a escola vem do convite. O token sai só nesta resposta. */
  async refazerConvite(conviteId: string): Promise<ConviteDaCoordenacaoResponse> {
    const autor = autorDaSessao(exigirOperadorDoContexto())
    const refeito = await refazerConviteDaCoordenacao(this.banco, autor, conviteId)
    naEscola(refeito.escolaId, () => this.#logger.log('operacao.convite.refeito'))
    return conviteDaCoordenacaoResponseSchema.parse({ conviteId: refeito.conviteId, token: refeito.token })
  }

  /** Revoga o convite da coordenação pelo id, pela matriz da seção 5; a escola vem do convite. */
  async revogarConvite(conviteId: string): Promise<void> {
    const autor = autorDaSessao(exigirOperadorDoContexto())
    const { escolaId } = await revogarConvitePeloOperador(this.banco, autor, conviteId)
    naEscola(escolaId, () => this.#logger.log('operacao.convite.revogado'))
  }
}
