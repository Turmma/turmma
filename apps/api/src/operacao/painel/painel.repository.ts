import {
  alunosAtivosDaEscola,
  COLUNAS_DO_USO_DE_IA,
  custoDaEscolaNoMes,
  faixaDoDia,
  faixaDoMes,
  Unscoped,
  usoDeIaLido,
  type Database,
  type DadosDaCoordenacao,
  type UsagePeriod,
  type UsoDeIa,
  type UsoDeIaDaLinha,
} from '@educa/core'
import {
  diaDeSaoPaulo,
  ESCOLAS_POR_PAGINA,
  MAXIMO_DE_REDES_DO_PAINEL,
  mesDeSaoPaulo,
  type OrcamentoDefinido,
  type OrdemDoUso,
  type TipoDeRede,
} from '@educa/shared'
import { sql, type SQL } from 'drizzle-orm'

/** O período do uso que a lista e o uso leem: o último dia fechado e o primeiro dia do mês dele, `AAAA-MM-DD`. */
export interface ReferenciaDoUso {
  readonly dia: string
  readonly primeiroDoMes: string
}

/**
 * Uma página da lista ou do uso: 25 escolas a partir de `pagina` (de 1), na `ordem`, com o período de referência do uso e o `agora` do relógio do serviço: o mês e o dia de IA são os de São Paulo de `agora`, e
 * nenhuma consulta lê o `now()` do Postgres. `custo` só chega pelo `uso()` (a lista não o aceita).
 */
export interface PedidoDePaginaDoPainel {
  readonly pagina: number
  readonly ordem: OrdemDoUso
  readonly referencia: ReferenciaDoUso
  readonly agora: Date
}

/** O que a escola define de orçamento de IA, e o que a rede dela define: a conta do que vale (`orcamentoDaEscolaNoPainel`) é do chamador, a mesma do lote e da Governança. */
export interface OrcamentoLidoDaEscola {
  readonly escola: OrcamentoDefinido
  readonly rede: OrcamentoDefinido
}

/** Uma rede da lista: id, nome, tipo, o que ela define de orçamento de IA e quantas escolas usam o valor ou o teto dela. */
export interface RedeLidaNoPainel {
  readonly id: string
  readonly nome: string
  readonly tipo: TipoDeRede
  readonly orcamento: OrcamentoDefinido
  readonly escolasQueUsamOValorDaRede: number
}

/** Uma escola da lista: id, nome, endereço, rede, contagens do ano em curso, o orçamento de IA e o que decide o estado da coordenação. */
export interface EscolaLidaNoPainel {
  readonly id: string
  readonly nome: string
  readonly slug: string
  readonly rede: { readonly id: string; readonly nome: string }
  readonly turmas: number
  readonly professores: number
  readonly alunos: number
  readonly orcamento: OrcamentoLidoDaEscola
  readonly coordenacao: DadosDaCoordenacao
}

/** O uso de IA de uma escola: hoje e o mês corrente, os alunos ativos de hoje e o que a escola e a rede dela definem de orçamento (a conta do que vale é do chamador, a mesma do lote e da Governança). */
export interface IaLidaNoPainel {
  readonly hoje: UsoDeIa
  readonly mes: UsoDeIa
  readonly alunosAtivos: number
  readonly orcamento: OrcamentoLidoDaEscola
}

/** O uso de uma escola no dia de referência e no mês dele, até esse dia, e o uso de IA de hoje e do mês corrente. */
export interface UsoLidoNoPainel {
  readonly id: string
  readonly nome: string
  readonly dia: UsagePeriod
  readonly mes: UsagePeriod
  readonly ia: IaLidaNoPainel
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
  iaValorMicros: string | null
  iaTeto: number | null
  redeIaValorMicros: string | null
  redeIaTeto: number | null
  coordenadorAtivo: boolean
  conviteId: string | null
  expiraEmMs: string | null
  usadoEmMs: string | null
  revogadoEmMs: string | null
  usuarioDesativadoEmMs: string | null
  agoraMs: string
}

/** O que o driver devolve de uma linha das redes: `bigint` chega como texto, e a contagem em `int`. */
interface RedeRow extends Record<string, unknown> {
  id: string
  nome: string
  tipo: TipoDeRede
  iaValorMicros: string | null
  iaTeto: number | null
  escolasQueUsamOValorDaRede: number
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
  iaHoje: UsoDeIaDaLinha
  iaMes: UsoDeIaDaLinha
  alunosAtivos: number
  iaValorMicros: string | null
  iaTeto: number | null
  redeIaValorMicros: string | null
  redeIaTeto: number | null
}

/** Quantas escolas existem: o total que a lista e o uso paginam, lido junto da página por cada um deles. */
const TOTAL_DE_ESCOLAS = sql`select count(*)::int as total from escola`

const instante = (ms: string | null): Date | null => (ms === null ? null : new Date(Number(ms)))

/** O `bigint` do driver (texto), em número: o valor por aluno em micros cabe folgado em 2^53 (no máximo R$ 100,00 = 10^8). */
const microsDoDriver = (valor: string | null): number | null => (valor === null ? null : Number(valor))

/**
 * A chave de cada ordem: `nome` (crescente); `uso`, as requisições do mês de referência até o dia (decrescente); e `custo`, o custo de IA do mês corrente de São Paulo, o de `agora` (decrescente), pelo mesmo
 * trecho da soma do orçamento (`custoDaEscolaNoMes`). Nas três o desempate é pelo `id`.
 */
function chaveDaOrdem({ ordem, referencia, agora }: PedidoDePaginaDoPainel): SQL {
  if (ordem === 'nome') return sql`e.nome, e.id`
  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(agora))} desc, e.id`
  return sql`(select coalesce(sum(u.requisicoes), 0) from uso_infra_diario as u
              where u.escola_id = e.id and u.dia between ${referencia.primeiroDoMes}::date and ${referencia.dia}::date) desc, e.id`
}

/**
 * As escolas da página, na ordem pedida, cada uma com a posição dela, calculada para todas as escolas antes de cortar a página; o desempate é pelo `id`, e a posição é total: a página seguinte continua
 * exatamente de onde a anterior parou. Só a página (25) segue para as subconsultas das contagens e do uso.
 */
function escolasDaPagina(pedido: PedidoDePaginaDoPainel): SQL {
  const { pagina } = pedido
  const chave = chaveDaOrdem(pedido)
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
function pessoasComVinculo(papel: 'professor', condicao: SQL): SQL {
  return sql`(select count(distinct v.usuario_id)::int
    from vinculo as v join usuario as pessoa on pessoa.escola_id = v.escola_id and pessoa.id = v.usuario_id
    where v.escola_id = e.id and v.ano_letivo_id = ano.id and v.papel = ${papel} and ${condicao} and pessoa.desativado_em is null)`
}

/**
 * A consulta do uso de uma página, sem executá-la: o `EXPLAIN` do teste lê o plano **desta** consulta. As 25 escolas da página saem primeiro, na ordem pedida; só elas descem às subconsultas, cada uma correlacionada pelo
 * `escola_id` e pelos índices que começam por ele (regra 80, item 8): o uso de infra, e o de IA de hoje e do mês, que leem o `consumo_ia_mes_idx` sem a tabela. `to_jsonb` leva as colunas de IA de cada período numa
 * coluna só, e o `UsoDeIaDaLinha` as descreve.
 */
export function usoDaPaginaSql(pedido: PedidoDePaginaDoPainel): SQL {
  const { dia, primeiroDoMes } = pedido.referencia
  const hoje = faixaDoDia(diaDeSaoPaulo(pedido.agora))
  const mes = faixaDoMes(mesDeSaoPaulo(pedido.agora))
  return sql`
    with pagina as (${escolasDaPagina(pedido)})
    select e.id, e.nome,
      coalesce(no_dia.requisicoes, 0) as "diaRequisicoes",
      coalesce(no_dia.jobs, 0) as "diaJobs",
      coalesce(no_dia.bytes_storage, 0) as "diaBytes",
      no_mes.requisicoes as "mesRequisicoes",
      no_mes.jobs as "mesJobs",
      no_mes.bytes as "mesBytes",
      to_jsonb(ia_hoje) as "iaHoje",
      to_jsonb(ia_mes) as "iaMes",
      ${alunosAtivosDaEscola(sql`e.id`)} as "alunosAtivos",
      cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
      cfg.ia_teto_de_seguranca_percentual as "iaTeto",
      r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
      r.ia_teto_de_seguranca_percentual as "redeIaTeto"
    from pagina
    join escola as e on e.id = pagina.id
    join rede as r on r.id = e.rede_id
    left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
    left join uso_infra_diario as no_dia on no_dia.escola_id = e.id and no_dia.dia = ${dia}::date
    left join lateral (
      select coalesce(sum(m.requisicoes), 0) as requisicoes, coalesce(sum(m.jobs), 0) as jobs, coalesce(max(m.bytes_storage), 0) as bytes
      from uso_infra_diario as m
      where m.escola_id = e.id and m.dia between ${primeiroDoMes}::date and ${dia}::date
    ) as no_mes on true
    left join lateral (
      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${hoje.inicio} and c.em < ${hoje.fim}
    ) as ia_hoje on true
    left join lateral (
      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${mes.inicio} and c.em < ${mes.fim}
    ) as ia_mes on true
    order by pagina.posicao`
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

  /**
   * As redes por nome, até 200, cada uma com o orçamento de IA que ela define e **quantas escolas usam o valor ou o teto dela**: a escola sem valor próprio quando a rede tem valor, ou sem teto próprio quando a
   * rede tem teto (a escola sem linha de configuração não tem nenhum dos dois próprios). Só id, nome, tipo e número, sem escola nem pessoa.
   */
  @Unscoped('painel do operador: a lista de redes para criar escola e definir o orçamento de IA, acima do tenant; só id, nome, tipo e número, até 200, sem escola nem pessoa')
  async redes(): Promise<RedeLidaNoPainel[]> {
    const { rows } = await this.banco.execute<RedeRow>(sql`
      select r.id, r.nome, r.tipo,
        r.ia_valor_por_aluno_micros::text as "iaValorMicros",
        r.ia_teto_de_seguranca_percentual as "iaTeto",
        (select count(*)::int
          from escola as e left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
          where e.rede_id = r.id
            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
              or (cfg.ia_teto_de_seguranca_percentual is null and r.ia_teto_de_seguranca_percentual is not null))) as "escolasQueUsamOValorDaRede"
      from rede as r
      order by r.nome, r.id
      limit ${MAXIMO_DE_REDES_DO_PAINEL}`)
    return rows.map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      tipo: linha.tipo,
      orcamento: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.iaTeto },
      escolasQueUsamOValorDaRede: linha.escolasQueUsamOValorDaRede,
    }))
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
          ${alunosAtivosDaEscola(sql`e.id`)} as alunos,
          cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
          cfg.ia_teto_de_seguranca_percentual as "iaTeto",
          r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
          r.ia_teto_de_seguranca_percentual as "redeIaTeto",
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
        left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
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
          orcamento: {
            escola: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.iaTeto },
            rede: { valorPorAlunoMicros: microsDoDriver(linha.redeIaValorMicros), tetoPercentual: linha.redeIaTeto },
          },
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
   * Uma página do uso por escola (D30): o de infra, com a mesma regra do `UsageRepository` (no dia de referência, a linha dele; no mês, do dia 1 até o dia de referência, requisições e jobs somados e o pico de bytes; sem
   * linha, zero; o dia de hoje, ainda não fechado, não entra) e **o de IA** (camada-ia, 5.0; RF11): hoje (o dia de São Paulo de `agora`) e o mês corrente (o mês de São Paulo de `agora`), somados do consumo gravado de
   * cada linha pelos trechos do `OrcamentoDoMesRepository` (`faixaDoDia`, `faixaDoMes`, `COLUNAS_DO_USO_DE_IA`, `alunosAtivosDaEscola`), com o orçamento que a escola e a rede definem. `agora` é parâmetro: nenhuma conta lê
   * o `now()` do Postgres. Só id, nome e número.
   */
  @Unscoped('painel do operador: o uso de infra e de IA de cada escola no último dia fechado, em hoje e no mês; só id, nome e número, sem pessoa')
  async uso(pedido: PedidoDePaginaDoPainel): Promise<PaginaLidaNoPainel<UsoLidoNoPainel>> {
    const [pagina, total] = await Promise.all([this.banco.execute<UsoRow>(usoDaPaginaSql(pedido)), this.banco.execute<{ total: number }>(TOTAL_DE_ESCOLAS)])
    return {
      total: total.rows[0]?.total ?? 0,
      itens: pagina.rows.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        dia: { requisicoes: Number(linha.diaRequisicoes), jobs: Number(linha.diaJobs), bytesStorage: Number(linha.diaBytes) },
        mes: { requisicoes: Number(linha.mesRequisicoes), jobs: Number(linha.mesJobs), bytesStorage: Number(linha.mesBytes) },
        ia: {
          hoje: usoDeIaLido(linha.iaHoje),
          mes: usoDeIaLido(linha.iaMes),
          alunosAtivos: linha.alunosAtivos,
          orcamento: {
            escola: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.iaTeto },
            rede: { valorPorAlunoMicros: microsDoDriver(linha.redeIaValorMicros), tetoPercentual: linha.redeIaTeto },
          },
        },
      })),
    }
  }
}
