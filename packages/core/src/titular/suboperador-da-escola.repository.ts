import type { AlcanceDoSuboperador, CategoriaDeDadoDoSuboperador } from '@educa/shared'
import { alias } from 'drizzle-orm/pg-core'
import { and, asc, desc, eq, exists, gt, isNull, ne, or, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { escola } from '../db/schema/escola.js'
import { suboperador, suboperadorEscola } from '../db/schema/suboperador.js'

/**
 * O suboperador como a escola o lê: o que a coordenação vê, e nada do que é da operação (contrato, quem cadastrou, as
 * outras escolas da lista). `inicio` e `fim` são a vigência **para esta escola**.
 *
 * O `id` e o `alcance` são da leitura interna: a foto do compartilhamento (12.0) precisa do id para assinar a linha e
 * do alcance para a regra "a hospedagem (`todas`) aparece sempre". O DTO da rota (`GET suboperadores`) monta a resposta
 * campo a campo e não os expõe.
 */
export interface SuboperadorLidoPelaEscola {
  readonly id: string
  readonly alcance: AlcanceDoSuboperador
  readonly chave: string
  readonly nome: string
  readonly finalidade: string
  readonly pais: string
  readonly categorias: CategoriaDeDadoDoSuboperador[]
  readonly vedaTreinamento: boolean
  readonly inicio: Date
  readonly fim: Date | null
}

/**
 * A leitura dos suboperadores da escola do contexto (F3, RF7; Tech Spec do F3, seções 4 e 6). **Só leitura**: o teste de
 * arquitetura confere que o arquivo não escreve em `suboperador` nem em `suboperador_escola`. Quem escreve é o
 * `OperacaoPrivacidadeRepository`, pelo `ops:suboperador`.
 *
 * `suboperador` não tem `escola_id`, então o escopo é a pergunta "esta escola é atendida por ele?":
 * `(alcance = 'todas' or exists (ligação com a escola do contexto))`. Os parênteses são parte da regra: ela entra no `and`
 * de qualquer filtro que a leitura ganhe, e sem eles o `or` engoliria o filtro. O `exists` é **correlacionado** com o
 * suboperador da linha (`suboperador_id = suboperador.id`): sem a correlação, a escola que tem qualquer ligação enxergaria
 * todo suboperador `lista` das outras.
 *
 * A vigência da escola vem da ligação (`lista`) ou do suboperador (`todas`, que não tem ligação); o `fim` é o mais cedo
 * entre os dois, e a escola que saiu da lista com a empresa seguindo para as outras a vê como passada.
 *
 * **A vigência nunca é anterior à escola** (Tech Spec do F3, seção 6; correção da 8.0). O `todas` não tem ligação, e sem esta
 * regra a escola leria como sua a empresa que saiu antes de ela existir. Só para a linha sem ligação (alcance `todas`), e com a
 * comparação feita no banco, contra a `escola` do contexto (`escola.id = contexto`): o início é o maior entre o da empresa e o
 * `criada_em` da escola, e a linha cujo `fim` é igual ou anterior ao `criada_em` não é devolvida (o igual também fica fora: não
 * houve um instante em comum). Com ligação (`lista`) nada muda: ela nasce depois da escola, pela FK. Todo método de leitura que
 * este repositório ganhar aplica a mesma regra.
 */
export class SuboperadorDaEscolaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Os suboperadores da escola do contexto, vigentes e passados, pelo nome e do mais recente ao mais antigo. */
  async daEscola(): Promise<SuboperadorLidoPelaEscola[]> {
    const escolaId = requireEscolaId()
    const ligacao = suboperadorEscola
    const outra = alias(suboperadorEscola, 'ligacao_da_escola')
    const linhas = await this.banco
      .select({
        id: suboperador.id,
        alcance: suboperador.alcance,
        chave: suboperador.chave,
        nome: suboperador.nome,
        finalidade: suboperador.finalidade,
        pais: suboperador.pais,
        categorias: suboperador.categorias,
        vedaTreinamento: suboperador.vedaTreinamento,
        inicioDoSuboperador: sql<Date>`case when ${suboperador.alcance} = 'todas' then greatest(${suboperador.inicio}, ${escola.criadaEm}) else ${suboperador.inicio} end`.mapWith(suboperador.inicio),
        fimDoSuboperador: suboperador.fim,
        inicioDaLigacao: ligacao.inicio,
        fimDaLigacao: ligacao.fim,
      })
      .from(suboperador)
      .innerJoin(escola, eq(escola.id, escolaId))
      .leftJoin(ligacao, and(eq(ligacao.suboperadorId, suboperador.id), eq(ligacao.escolaId, escolaId)))
      .where(
        and(
          or(
            eq(suboperador.alcance, 'todas'),
            exists(
              this.banco
                .select({ um: sql`1` })
                .from(outra)
                .where(and(eq(outra.suboperadorId, suboperador.id), eq(outra.escolaId, escolaId))),
            ),
          ),
          // A empresa de `todas` encerrada até o instante em que a escola passou a existir nunca recebeu dado dela.
          or(ne(suboperador.alcance, 'todas'), isNull(suboperador.fim), gt(suboperador.fim, escola.criadaEm)),
        ),
      )
      // O `desc(suboperador.inicio)` basta: o `greatest` com o `criada_em` não muda a ordem entre linhas do mesmo nome.
      .orderBy(asc(suboperador.nome), desc(suboperador.inicio))
    return linhas.map((linha) => ({
      id: linha.id,
      alcance: linha.alcance,
      chave: linha.chave,
      nome: linha.nome,
      finalidade: linha.finalidade,
      pais: linha.pais,
      categorias: linha.categorias,
      vedaTreinamento: linha.vedaTreinamento,
      // A ligação, quando há (alcance `lista`), e senão o próprio suboperador (alcance `todas`).
      inicio: linha.inicioDaLigacao ?? linha.inicioDoSuboperador,
      fim: maisCedo(linha.fimDoSuboperador, linha.fimDaLigacao),
    }))
  }
}

/** O mais cedo entre os dois fins, ignorando o nulo (vigente); nulo só se os dois são nulos. */
function maisCedo(a: Date | null, b: Date | null): Date | null {
  if (a === null || b === null) return a ?? b
  return a.getTime() <= b.getTime() ? a : b
}
