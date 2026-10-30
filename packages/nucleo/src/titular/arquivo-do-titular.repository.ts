import { VALIDADE_DO_ARQUIVO_DIAS, type Compartilhamento as FotoDoCompartilhamento, type EstadoDoPedido, type PapelDoTitular, type TipoDePedidoDoTitular, type VersaoDoArquivo } from '@educa/shared'
import { and, asc, desc, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { arquivoTitular } from '../db/schema/arquivo-titular.js'
import { pedidoTitular } from '../db/schema/pedido-titular.js'
import { usuario } from '../db/schema/usuario.js'

const MS_POR_DIA = 86_400_000

/** O pedido como o job que monta o arquivo o lê: quem é o titular, o que ele pediu e a foto do compartilhamento. */
export interface PedidoParaMontar {
  readonly id: string
  readonly titularId: string
  readonly papel: PapelDoTitular
  readonly tipo: TipoDePedidoDoTitular
  readonly estado: EstadoDoPedido
  readonly compartilhamento: FotoDoCompartilhamento
}

/** A linha de `arquivo_titular` como a API a lê para entregar a URL. **O campo `chave_objeto` nunca sai pela API.** */
export interface ArquivoLido {
  readonly id: string
  readonly versao: VersaoDoArquivo
  readonly chaveObjeto: string
  readonly prontoEm: Date
  readonly expiraEm: Date
  readonly apagadoEm: Date | null
}

/** O arquivo que a rotina da escola vai apagar: o objeto do storage e, só depois, a linha. */
export interface ArquivoAApagar {
  readonly id: string
  readonly chaveObjeto: string
}

/** O pedido do próprio usuário, com a validade da versão completa do arquivo (`GET /v1/meus-dados`). */
export interface PedidoDoUsuario {
  readonly id: string
  readonly tipo: TipoDePedidoDoTitular
  readonly estado: EstadoDoPedido
  readonly chegouEm: string
  readonly arquivo: { readonly expiraEm: Date; readonly apagadoEm: Date | null } | null
}

/**
 * O arquivo do titular no banco (F3, tarefa 13.0; Tech Spec do F3, seções 3 e 5; regra 00, item 3): a linha de
 * `arquivo_titular`, a passagem do pedido para `pronto` e o que a rotina da escola apaga. **Cada método lê a escola do
 * contexto e nenhum a recebe por parâmetro** (regra 10, item 3). A linha guarda só onde o JSON está e até quando: nenhum
 * dado do titular passa por aqui.
 *
 * As travas de concorrência moram no banco, e não em "ler e depois gravar" (regra 80, item 7): dois jobs do mesmo pedido
 * gravam a mesma linha pelo único `(escola_id, pedido_id, versao)`, com `on conflict do update` só dos bytes, e a passagem
 * `em_preparacao → pronto` é um `update` condicional, que só uma das duas chamadas faz: o job grava a linha antes, na mesma transação.
 */
export class ArquivoDoTitularRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O pedido que o job monta, na escola do contexto. O de outra escola e o inexistente não vêm. */
  async pedidoParaMontar(pedidoId: string): Promise<PedidoParaMontar | undefined> {
    const [linha] = await this.banco
      .select({
        id: pedidoTitular.id,
        titularId: pedidoTitular.titularId,
        papel: pedidoTitular.papelTitular,
        tipo: pedidoTitular.tipo,
        estado: pedidoTitular.estado,
        compartilhamento: pedidoTitular.compartilhamento,
      })
      .from(pedidoTitular)
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId)))
      .limit(1)
    return linha
  }

  /**
   * Se o titular existe nesta escola e **tem conta ativa nela**: sem `desativado_em`. É por escola (Tech Spec do F3, seção
   * 4): quem está desativado em A e ativo em B não tem conta ativa em A. A 14.0 acrescenta o acesso suspenso pela
   * eliminação agendada: o predicado mora só aqui. Devolve `undefined` quando a pessoa já não existe na escola.
   */
  async contaAtiva(titularId: string): Promise<boolean | undefined> {
    const [linha] = await this.banco
      .select({ desativadoEm: usuario.desativadoEm, eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, titularId)))
      .limit(1)
    return linha === undefined ? undefined : linha.desativadoEm === null && linha.eliminacaoAgendadaEm === null
  }

  /**
   * Grava a versão pronta do arquivo: a linha nova, com a validade contada do instante em que ficou pronta. Se a linha já
   * existe (`on conflict` no único `(escola_id, pedido_id, versao)`), só os `bytes` mudam: **o `pronto_em` e o `expira_em`
   * originais ficam**, e a reentrega do job não renova a validade de 7 dias (regra 20, item 16).
   * **O `apagado_em` não é limpo**: o que a eliminação do titular marcou fica marcado, e o job não o ressuscita.
   * A chave do objeto é a do check `arquivo_titular_chave_da_escola`: `titular/<escola>/<pedido>/<versao>.json`.
   */
  async gravar(pedidoId: string, versao: VersaoDoArquivo, bytes: number, prontoEm: Date): Promise<string> {
    const escolaId = requireEscolaId()
    const chaveObjeto = objectKey(escolaId, pedidoId, versao)
    const expiraEm = new Date(prontoEm.getTime() + VALIDADE_DO_ARQUIVO_DIAS * MS_POR_DIA)
    await this.banco
      .insert(arquivoTitular)
      .values({ escolaId, pedidoId, versao, chaveObjeto, bytes, prontoEm, expiraEm })
      .onConflictDoUpdate({ target: [arquivoTitular.escolaId, arquivoTitular.pedidoId, arquivoTitular.versao], set: { bytes } })
    return chaveObjeto
  }

  /**
   * `em_preparacao → pronto`, **só se o pedido ainda está `em_preparacao`**: o `where` decide. Quem concluiu o pedido antes
   * de o job terminar o deixou `concluido`, e dois jobs do mesmo pedido passam um só. Devolve se esta chamada mudou o estado.
   */
  async marcarPronto(pedidoId: string): Promise<boolean> {
    const [pronto] = await this.banco
      .update(pedidoTitular)
      .set({ estado: 'pronto' })
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId), eq(pedidoTitular.estado, 'em_preparacao')))
      .returning({ id: pedidoTitular.id })
    return pronto !== undefined
  }

  /** A versão do arquivo deste pedido, na escola do contexto. Outra escola e a versão que não existe não vêm. */
  async doPedido(pedidoId: string, versao: VersaoDoArquivo): Promise<ArquivoLido | undefined> {
    const [linha] = await this.banco
      .select({
        id: arquivoTitular.id,
        versao: arquivoTitular.versao,
        chaveObjeto: arquivoTitular.chaveObjeto,
        prontoEm: arquivoTitular.prontoEm,
        expiraEm: arquivoTitular.expiraEm,
        apagadoEm: arquivoTitular.apagadoEm,
      })
      .from(arquivoTitular)
      .where(and(eq(arquivoTitular.escolaId, requireEscolaId()), eq(arquivoTitular.pedidoId, pedidoId), eq(arquivoTitular.versao, versao)))
      .limit(1)
    return linha
  }

  /**
   * Os arquivos que a rotina da escola apaga agora: com `apagado_em` (a eliminação do titular os marcou) ou vencidos, `expira_em`
   * antes do `agora`. Com 7 dias de vida o arquivo **fica**, com 8 sai: a comparação é estrita. Em lote, do mais antigo.
   */
  async aApagar(agora: Date, limite: number): Promise<ArquivoAApagar[]> {
    return this.banco
      .select({ id: arquivoTitular.id, chaveObjeto: arquivoTitular.chaveObjeto })
      .from(arquivoTitular)
      .where(and(eq(arquivoTitular.escolaId, requireEscolaId()), or(isNotNull(arquivoTitular.apagadoEm), lt(arquivoTitular.expiraEm, agora))))
      .orderBy(asc(arquivoTitular.expiraEm), asc(arquivoTitular.id))
      .limit(limite)
  }

  /** Apaga as linhas cujo objeto já saiu do storage. O `id` que outra execução já apagou não conta. */
  async apagarLinhas(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0
    const apagadas = await this.banco
      .delete(arquivoTitular)
      .where(and(eq(arquivoTitular.escolaId, requireEscolaId()), inArray(arquivoTitular.id, [...ids])))
      .returning({ id: arquivoTitular.id })
    return apagadas.length
  }

  /**
   * Os pedidos do próprio usuário na escola do contexto, do mais novo, com a versão completa do arquivo. A pessoa vem do
   * argumento porque quem chama é a rota "meus dados", que passa o `usuarioId` da sessão: o pedido de outra pessoa da mesma
   * escola nunca entra, e o de outra escola, pelo escopo.
   */
  async pedidosDoUsuario(usuarioId: string, limite: number): Promise<PedidoDoUsuario[]> {
    const linhas = await this.banco
      .select({
        id: pedidoTitular.id,
        tipo: pedidoTitular.tipo,
        estado: pedidoTitular.estado,
        chegouEm: pedidoTitular.chegouEm,
        expiraEm: arquivoTitular.expiraEm,
        apagadoEm: arquivoTitular.apagadoEm,
      })
      .from(pedidoTitular)
      .leftJoin(
        arquivoTitular,
        and(eq(arquivoTitular.escolaId, pedidoTitular.escolaId), eq(arquivoTitular.pedidoId, pedidoTitular.id), eq(arquivoTitular.versao, 'completa')),
      )
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.titularId, usuarioId)))
      .orderBy(desc(pedidoTitular.id))
      .limit(limite)
    return linhas.map(({ expiraEm, apagadoEm, ...pedido }) => ({ ...pedido, arquivo: expiraEm === null ? null : { expiraEm, apagadoEm } }))
  }

  /**
   * O pedido do próprio usuário com a versão completa do arquivo, para a rota que entrega a URL. Só o pedido **dele**
   * (`titular_id`), na escola do contexto: o do colega, o de outra escola e o inexistente devolvem `undefined`, e a rota
   * responde igual aos três (regra 10, item 6).
   */
  async arquivoCompletoDoUsuario(usuarioId: string, pedidoId: string): Promise<ArquivoLido | undefined> {
    const [linha] = await this.banco
      .select({
        id: arquivoTitular.id,
        versao: arquivoTitular.versao,
        chaveObjeto: arquivoTitular.chaveObjeto,
        prontoEm: arquivoTitular.prontoEm,
        expiraEm: arquivoTitular.expiraEm,
        apagadoEm: arquivoTitular.apagadoEm,
      })
      .from(arquivoTitular)
      .innerJoin(pedidoTitular, and(eq(pedidoTitular.escolaId, arquivoTitular.escolaId), eq(pedidoTitular.id, arquivoTitular.pedidoId)))
      .where(
        and(
          eq(arquivoTitular.escolaId, requireEscolaId()),
          eq(arquivoTitular.pedidoId, pedidoId),
          eq(arquivoTitular.versao, 'completa'),
          eq(pedidoTitular.titularId, usuarioId),
        ),
      )
      .limit(1)
    return linha
  }

  /**
   * Quando o pedido `em_preparacao` mais antigo da escola foi registrado, ou `undefined` sem nenhum. É o que o alerta lê: o
   * pedido de acesso nasce `em_preparacao` no registro, então `registrado_em` é desde quando ele espera.
   */
  async registradoEmDoEmPreparacaoMaisAntigo(): Promise<Date | undefined> {
    const [linha] = await this.banco
      .select({ registradoEm: sql<Date | string | null>`min(${pedidoTitular.registradoEm})` })
      .from(pedidoTitular)
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.estado, 'em_preparacao')))
    const valor = linha?.registradoEm
    return valor === null || valor === undefined ? undefined : valor instanceof Date ? valor : new Date(valor)
  }
}

/** A chave do objeto no storage: o check `arquivo_titular_chave_da_escola` a exige exatamente assim. */
export function objectKey(escolaId: string, pedidoId: string, versao: VersaoDoArquivo): string {
  return `titular/${escolaId}/${pedidoId}/${versao}.json`
}
