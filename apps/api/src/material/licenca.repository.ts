import { licencaDeMaterial, requireEscolaId, requestSessao, type Database, type DatabaseTransaction } from '@educa/core'
import { InvariantException, type AlterarLicencaRequest, type LicencasQuery, type RegistrarLicencaRequest } from '@educa/shared'
import { and, asc, eq, gt, sql } from 'drizzle-orm'

/** A licença como a coordenação a lê, ainda sem a situação (que depende do dia, e é do serviço). Nunca quem a registrou. */
export interface LicencaLida {
  readonly id: string
  readonly licenciante: string
  readonly cobertura: string
  readonly referencia: string
  readonly vigenteDesde: string
  readonly vigenteAte: string | null
  /** Quantos materiais **vivos** (não excluídos) a licença cobre. */
  readonly materiais: number
  readonly registradaEm: Date
  readonly alteradaEm: Date
}

/** A vigência que a auditoria leva, lida com a linha travada. */
export interface VigenciaDaLicenca {
  readonly vigenteDesde: string
  readonly vigenteAte: string | null
}

/** O que o envio do material de terceiro lê da licença: a vigência, para saber se vale hoje, e o licenciante, que o material copia. Nunca a cobertura nem a referência. */
export interface LicencaParaUso extends VigenciaDaLicenca {
  readonly licenciante: string
}

/**
 * Quantos materiais não excluídos a licença cobre. Escrito com os nomes qualificados: numa consulta de uma tabela só, o drizzle escreve a coluna sem a
 * tabela, e `escola_id = escola_id` dentro da subconsulta seria o material com ele mesmo (como `quantosTrechos`, no repository do material).
 */
const quantosMateriais = sql<number>`(select count(*)::int from "material" where "material"."escola_id" = "licenca_de_material"."escola_id" and "material"."licenca_id" = "licenca_de_material"."id" and "material"."excluido_em" is null)`

const colunas = {
  id: licencaDeMaterial.id,
  licenciante: licencaDeMaterial.licenciante,
  cobertura: licencaDeMaterial.cobertura,
  referencia: licencaDeMaterial.referencia,
  vigenteDesde: licencaDeMaterial.vigenteDesde,
  vigenteAte: licencaDeMaterial.vigenteAte,
  materiais: quantosMateriais,
  registradaEm: licencaDeMaterial.registradaEm,
  alteradaEm: licencaDeMaterial.alteradaEm,
}

/**
 * As licenças da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). A escola vem de `requireEscolaId()`, e a pessoa que registra, da sessão.
 * Não há exclusão: a licença sai só no expurgo de `material_excluido`, em `ExpurgoDaEscolaRepository`.
 */
export class LicencaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Uma página das licenças, em ordem de id, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite }: LicencasQuery): Promise<LicencaLida[]> {
    return this.banco
      .select(colunas)
      .from(licencaDeMaterial)
      .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(licencaDeMaterial.id, pagina)))
      .orderBy(asc(licencaDeMaterial.id))
      .limit(limite + 1)
  }

  /** A licença da escola com esse id; a de outra escola e a inexistente não são achadas. */
  async porId(id: string): Promise<LicencaLida | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(licencaDeMaterial)
      .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
    return linha
  }

  /**
   * A licença da escola do contexto que o envio do material de terceiro vai usar. Com `travar`, a linha é lida `for share` até o fim da transação do envio: um `PATCH` da vigência
   * (`travarVigencia`, `for update`) espera o envio terminar, e o envio nunca grava material sobre uma licença que acabou de ser encurtada. Sem `travar`, é a leitura da conferência
   * que vem antes de o arquivo ser lido. A de outra escola e a inexistente não são achadas.
   */
  async paraUso(id: string, travar: boolean): Promise<LicencaParaUso | undefined> {
    const consulta = this.banco
      .select({ licenciante: licencaDeMaterial.licenciante, vigenteDesde: licencaDeMaterial.vigenteDesde, vigenteAte: licencaDeMaterial.vigenteAte })
      .from(licencaDeMaterial)
      .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
    const [linha] = await (travar ? consulta.for('share') : consulta)
    return linha
  }

  /** Grava a licença da escola do contexto, registrada pela pessoa da sessão. */
  async inserir(pedido: RegistrarLicencaRequest): Promise<string> {
    const [gravada] = await this.banco
      .insert(licencaDeMaterial)
      .values({
        escolaId: requireEscolaId(),
        licenciante: pedido.licenciante,
        cobertura: pedido.cobertura,
        referencia: pedido.referencia,
        vigenteDesde: pedido.vigenteDesde,
        vigenteAte: pedido.vigenteAte ?? null,
        registradaPor: requestSessao().usuarioId,
      })
      .returning({ id: licencaDeMaterial.id })
    if (gravada === undefined) throw new InvariantException('licença não gravada')
    return gravada.id
  }

  /**
   * A vigência da licença da escola, **travada** (`for update`) até o fim da transação: dois `PATCH` da mesma licença passam um depois do outro, e cada um grava
   * a auditoria com o "antes" que de fato encontrou, nunca o de antes do outro. A de outra escola e a inexistente não são achadas.
   */
  async travarVigencia(id: string): Promise<VigenciaDaLicenca | undefined> {
    const [linha] = await this.banco
      .select({ vigenteDesde: licencaDeMaterial.vigenteDesde, vigenteAte: licencaDeMaterial.vigenteAte })
      .from(licencaDeMaterial)
      .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
      .for('update')
    return linha
  }

  /** Aplica a alteração à licença da escola e devolve se achou a linha; `alterada_em` é o relógio do banco. Só os campos que vieram mudam. */
  async alterar(id: string, alteracao: AlterarLicencaRequest): Promise<boolean> {
    const alteradas = await this.banco
      .update(licencaDeMaterial)
      .set({
        ...(alteracao.cobertura === undefined ? {} : { cobertura: alteracao.cobertura }),
        ...(alteracao.referencia === undefined ? {} : { referencia: alteracao.referencia }),
        ...(alteracao.vigenteDesde === undefined ? {} : { vigenteDesde: alteracao.vigenteDesde }),
        ...(alteracao.vigenteAte === undefined ? {} : { vigenteAte: alteracao.vigenteAte }),
        alteradaEm: sql`now()`,
      })
      .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
      .returning({ id: licencaDeMaterial.id })
    return alteradas.length > 0
  }
}
