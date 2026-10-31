import { DomainException, escola, rede, Unscoped, type DatabaseExecutor, type TipoDeRede } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { eq } from 'drizzle-orm'

/** O que a criação devolve: o id, e se a linha nasceu agora ou já existia com os mesmos dados (o pedido repetido). */
export interface Criada {
  readonly id: string
  readonly nova: boolean
}

/**
 * Criação de rede e de escola pelo operador Turmma: o `ops:escola` e o painel da operação (`POST /v1/operacao/redes` e
 * `/escolas`, A0b), pelos casos de uso de `escola.ts`. Nada aqui lê dado de escola existente além da linha do próprio
 * id do pedido.
 *
 * O id vem do pedido (Tech Spec da A0b, seção 7c, "Rede ou escola repetida"): `insert … on conflict do nothing
 * returning id`, e, sem linha, a leitura pelo id na mesma chamada. O mesmo id com os mesmos dados é o pedido repetido
 * (o clique duplo) e devolve o id sem criar nada; com outros dados, ou sem linha nesse id (o slug é de outra escola),
 * `CONFLITO`. O `on conflict` não tem alvo: dois pedidos iguais ao mesmo tempo esperam um pelo outro no índice do id
 * **e** no do slug, e nenhum dos dois levanta 23505; o slug de outra escola também não levanta, e cai no `CONFLITO`.
 */
export class RedeEEscolaRepository {
  constructor(private readonly banco: DatabaseExecutor) {}

  @Unscoped('a rede fica acima do tenant e ainda não tem escola; só o comando ou o painel do operador cria, e devolve só o id')
  async criarRede(dados: { id: string; nome: string; tipo: TipoDeRede }): Promise<Criada> {
    const [criada] = await this.banco.insert(rede).values(dados).onConflictDoNothing().returning({ id: rede.id })
    if (criada !== undefined) return { id: criada.id, nova: true }
    const [existente] = await this.banco.select({ nome: rede.nome, tipo: rede.tipo }).from(rede).where(eq(rede.id, dados.id)).limit(1)
    if (existente?.nome === dados.nome && existente.tipo === dados.tipo) return { id: dados.id, nova: false }
    throw new DomainException(ErrorCode.CONFLITO)
  }

  @Unscoped('a escola é o próprio tenant e nasce aqui, antes de existir contexto dela; só o comando ou o painel do operador cria, e devolve só o id')
  async criarEscola(dados: { id: string; redeId: string; nome: string; slug: string }): Promise<Criada> {
    const [criada] = await this.banco.insert(escola).values(dados).onConflictDoNothing().returning({ id: escola.id })
    if (criada !== undefined) return { id: criada.id, nova: true }
    const [existente] = await this.banco.select({ redeId: escola.redeId, nome: escola.nome, slug: escola.slug }).from(escola).where(eq(escola.id, dados.id)).limit(1)
    if (existente?.redeId === dados.redeId && existente.nome === dados.nome && existente.slug === dados.slug) return { id: dados.id, nova: false }
    throw new DomainException(ErrorCode.CONFLITO)
  }
}
