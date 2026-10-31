import { rede, Unscoped, type Database, type DadosDaCoordenacao, type UsagePeriod } from '@educa/core'
import { ESCOLAS_POR_PAGINA, MAXIMO_DE_REDES_DO_PAINEL, type OrdemDoPainel, type RedeDoPainel } from '@educa/shared'
import { asc, sql, type SQL } from 'drizzle-orm'

/** O período do uso que a lista e o uso leem: o último dia fechado e o primeiro dia do mês dele, `AAAA-MM-DD`. */
export interface ReferenciaDoUso {
  readonly dia: string
  readonly primeiroDoMes: string
}

/** Uma página da lista ou do uso: 25 escolas a partir de `pagina` (de 1), na `ordem`, com o período de referência do uso. */
export interface PedidoDePaginaDoPainel {
  readonly pagina: number
  readonly ordem: OrdemDoPainel
  readonly referencia: ReferenciaDoUso
}

/** Uma escola da lista: id, nome, endereço, rede, contagens do ano em curso e o que decide o estado da coordenação. */
export interface EscolaLidaNoPainel {
  readonly id: string
  readonly nome: string
  readonly slug: string
  readonly rede: { readonly id: string; readonly nome: string }
  readonly turmas: number
  readonly professores: number
  readonly alunos: number
  readonly coordenacao: DadosDaCoordenacao
}

/** O uso de uma escola no dia de referência e no mês dele, até esse dia. */
export interface UsoLidoNoPainel {
  readonly id: string
  readonly nome: string
  readonly dia: UsagePeriod
  readonly mes: UsagePeriod
}

export interface PaginaLidaNoPainel<Item> {
  readonly itens: Item[]
  readonly total: number
}

/** O que o driver devolve de uma linha da lista: contagens em `int`, instantes em milissegundos desde a época (texto). */
interface EscolaRow extends Record<string, unknown> {
  id: string
  nome: string
  slug: string
  redeId: string
  redeNome: string
  turmas: number
  professores: number
  alunos: number
  coordenadorAtivo: boolean
  conviteId: string | null
  expiraEmMs: string | null
  usadoEmMs: string | null
  revogadoEmMs: string | null
  usuarioDesativadoEmMs: string | null
  agoraMs: string
}

/** O que o driver devolve de uma linha do uso: `bigint` e `sum` chegam como texto. */
interface UsoRow extends Record<string, unknown> {
  id: string
  nome: string
  diaRequisicoes: string
  diaJobs: string
  diaBytes: string
  mesRequisicoes: string
  mesJobs: string
  mesBytes: string
}

/** Quantas escolas existem: o total que a lista e o uso paginam, lido junto da página por cada um deles. */
const TOTAL_DE_ESCOLAS = sql`select count(*)::int as total from escola`

const instante = (ms: string | null): Date | null => (ms === null ? null : new Date(Number(ms)))

/**
 * As escolas da página, na ordem pedida, cada uma com a posição dela: `nome` (crescente), ou `uso`, as requisições do mês
 * de referência até o dia (decrescente), calculadas para todas as escolas antes de cortar a página; nas duas, o
 * desempate é pelo `id`, e a posição é total: a página seguinte continua exatamente de onde a anterior parou. Só a
 * página (25) segue para as subconsultas das contagens e do uso.
 */
function escolasDaPagina({ pagina, ordem, referencia }: PedidoDePaginaDoPainel): SQL {
  const chave =
    ordem === 'nome'
      ? sql`e.nome, e.id`
      : sql`(select coalesce(sum(u.requisicoes), 0) from uso_infra_diario as u
              where u.escola_id = e.id and u.dia between ${referencia.primeiroDoMes}::date and ${referencia.dia}::date) desc, e.id`
  return sql`
    select ordenadas.id, ordenadas.posicao
    from (select e.id, row_number() over (order by ${chave}) as posicao from escola as e) as ordenadas
    order by ordenadas.posicao
    limit ${ESCOLAS_POR_PAGINA} offset ${(pagina - 1) * ESCOLAS_POR_PAGINA}`
}

/**
 * Quantas pessoas com vínculo `papel` no ano em curso da escola `e`, de usuário ativo, contando cada uma uma vez (o
 * professor com duas disciplinas, ou o aluno em duas turmas do ano). `condicao` diz que vínculo conta.
 */
function pessoasComVinculo(papel: 'professor' | 'aluno', condicao: SQL): SQL {
  return sql`(select count(distinct v.usuario_id)::int
    from vinculo as v join usuario as pessoa on pessoa.escola_id = v.escola_id and pessoa.id = v.usuario_id
    where v.escola_id = e.id and v.ano_letivo_id = ano.id and v.papel = ${papel} and ${condicao} and pessoa.desativado_em is null)`
}

/**
 * A leitura entre escolas do painel da operação (Tech Spec da A0b, seções 5 e 6): o único lugar desse alcance, e por isso
 * cada método é `@Unscoped` com a justificativa do painel (regra 10, item 9). Devolve só id, nome, endereço e número,
 * mais as datas que decidem o estado da coordenação: nada de pessoa, nada de dentro da escola. Só o `painel.service.ts`
 * o importa (I1).
 *
 * A lista e o uso são uma consulta por página, mais a do total: as 25 escolas da página saem primeiro, na ordem pedida, e
 * só elas descem às subconsultas, cada uma correlacionada pelo `escola_id` e pelos índices que começam por ele (regra 80,
 * item 8; o plano está na tarefa 5.0 da A0b).
 */
export class PainelRepository {
  constructor(private readonly banco: Database) {}

  @Unscoped('painel do operador: a lista de redes para criar escola, acima do tenant; só id, nome e tipo, até 200, sem escola nem pessoa')
  async redes(): Promise<RedeDoPainel[]> {
    return this.banco.select({ id: rede.id, nome: rede.nome, tipo: rede.tipo }).from(rede).orderBy(asc(rede.nome), asc(rede.id)).limit(MAXIMO_DE_REDES_DO_PAINEL)
  }

  /**
   * Uma página da lista de escolas. As contagens são do ano `em_curso` de cada escola (sem ele, zero): turmas do ano;
   * professores com vínculo `confirmado` e não encerrado; alunos com vínculo não encerrado; sempre de usuário ativo, cada
   * pessoa uma vez. Junto, o que decide o estado da coordenação (`estadoDaCoordenacao`), lido como na escrita: se há
   * coordenador ativo, o último convite de coordenação (maior `expira_em`, depois maior `id`) com o `desativado_em` do
   * usuário dele, e a hora do banco.
   */
  @Unscoped('painel do operador: a lista de escolas com o estado da coordenação e as contagens do ano em curso; só id, nome, endereço e número, sem pessoa')
  async escolas(pedido: PedidoDePaginaDoPainel): Promise<PaginaLidaNoPainel<EscolaLidaNoPainel>> {
    const [pagina, total] = await Promise.all([
      this.banco.execute<EscolaRow>(sql`
        with pagina as (${escolasDaPagina(pedido)})
        select e.id, e.nome, e.slug, r.id as "redeId", r.nome as "redeNome",
          (select count(*)::int from turma as t where t.escola_id = e.id and t.ano_letivo_id = ano.id) as turmas,
          ${pessoasComVinculo('professor', sql`v.estado = 'confirmado' and v.encerrado_em is null`)} as professores,
          ${pessoasComVinculo('aluno', sql`v.encerrado_em is null`)} as alunos,
          exists(select 1 from usuario as coordenador
            where coordenador.escola_id = e.id and coordenador.papel = 'coordenador' and coordenador.desativado_em is null) as "coordenadorAtivo",
          ultimo.id as "conviteId",
          extract(epoch from ultimo.expira_em) * 1000 as "expiraEmMs",
          extract(epoch from ultimo.usado_em) * 1000 as "usadoEmMs",
          extract(epoch from ultimo.revogado_em) * 1000 as "revogadoEmMs",
          extract(epoch from ultimo.usuario_desativado_em) * 1000 as "usuarioDesativadoEmMs",
          extract(epoch from now()) * 1000 as "agoraMs"
        from pagina
        join escola as e on e.id = pagina.id
        join rede as r on r.id = e.rede_id
        left join lateral (select a.id from ano_letivo as a where a.escola_id = e.id and a.situacao = 'em_curso') as ano on true
        left join lateral (
          select c.id, c.expira_em, c.usado_em, c.revogado_em, convidado.desativado_em as usuario_desativado_em
          from convite as c join usuario as convidado on convidado.escola_id = c.escola_id and convidado.id = c.usuario_id
          where c.escola_id = e.id and c.tipo = 'coordenador'
          order by c.expira_em desc, c.id desc
          limit 1
        ) as ultimo on true
        order by pagina.posicao`),
      this.banco.execute<{ total: number }>(TOTAL_DE_ESCOLAS),
    ])
    return {
      total: total.rows[0]?.total ?? 0,
      itens: pagina.rows.map((linha) => {
        const expiraEm = instante(linha.expiraEmMs)
        return {
          id: linha.id,
          nome: linha.nome,
          slug: linha.slug,
          rede: { id: linha.redeId, nome: linha.redeNome },
          turmas: linha.turmas,
          professores: linha.professores,
          alunos: linha.alunos,
          coordenacao: {
            coordenadorAtivo: linha.coordenadorAtivo,
            ultimoConvite:
              linha.conviteId === null || expiraEm === null
                ? undefined
                : {
                    id: linha.conviteId,
                    expiraEm,
                    usadoEm: instante(linha.usadoEmMs),
                    revogadoEm: instante(linha.revogadoEmMs),
                    usuarioDesativadoEm: instante(linha.usuarioDesativadoEmMs),
                  },
            agora: new Date(Number(linha.agoraMs)),
          },
        }
      }),
    }
  }

  /**
   * Uma página do uso de infra por escola (D30), com a mesma regra do `UsageRepository`: no dia de referência, a linha dele;
   * no mês, do dia 1 até o dia de referência, requisições e jobs somados e o pico de bytes. Sem linha, zero. O que vem
   * depois do dia de referência (o dia de hoje, ainda não fechado) não entra.
   */
  @Unscoped('painel do operador: o uso de infra de cada escola no último dia fechado e no mês dele; só id, nome e número, sem pessoa')
  async uso(pedido: PedidoDePaginaDoPainel): Promise<PaginaLidaNoPainel<UsoLidoNoPainel>> {
    const { dia, primeiroDoMes } = pedido.referencia
    const [pagina, total] = await Promise.all([
      this.banco.execute<UsoRow>(sql`
        with pagina as (${escolasDaPagina(pedido)})
        select e.id, e.nome,
          coalesce(no_dia.requisicoes, 0) as "diaRequisicoes",
          coalesce(no_dia.jobs, 0) as "diaJobs",
          coalesce(no_dia.bytes_storage, 0) as "diaBytes",
          no_mes.requisicoes as "mesRequisicoes",
          no_mes.jobs as "mesJobs",
          no_mes.bytes as "mesBytes"
        from pagina
        join escola as e on e.id = pagina.id
        left join uso_infra_diario as no_dia on no_dia.escola_id = e.id and no_dia.dia = ${dia}::date
        left join lateral (
          select coalesce(sum(m.requisicoes), 0) as requisicoes, coalesce(sum(m.jobs), 0) as jobs, coalesce(max(m.bytes_storage), 0) as bytes
          from uso_infra_diario as m
          where m.escola_id = e.id and m.dia between ${primeiroDoMes}::date and ${dia}::date
        ) as no_mes on true
        order by pagina.posicao`),
      this.banco.execute<{ total: number }>(TOTAL_DE_ESCOLAS),
    ])
    return {
      total: total.rows[0]?.total ?? 0,
      itens: pagina.rows.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        dia: { requisicoes: Number(linha.diaRequisicoes), jobs: Number(linha.diaJobs), bytesStorage: Number(linha.diaBytes) },
        mes: { requisicoes: Number(linha.mesRequisicoes), jobs: Number(linha.mesJobs), bytesStorage: Number(linha.mesBytes) },
      })),
    }
  }
}
