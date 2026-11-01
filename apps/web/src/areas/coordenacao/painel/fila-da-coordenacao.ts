import type { AnoLetivo, IncidenteDaEscola, Material, ProfessorDaEscola, Turma, VinculoDaCoordenacao } from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { anosLetivosQueryOptions, turmasQueryOptions, vinculosQueryOptions, type ListaDaEstrutura } from '../../../api/estrutura'
import { materiaisQueryOptions } from '../material/api/material'
import { incidentesQueryOptions } from '../privacidade/api/privacidade'
import { professoresQueryOptions } from '../professores/api/professores'
import { caminhoDoProfessor } from '../../../paths'
import { QUEUE_QUERY_OPTIONS, NO_AUTO_REFETCH, type LeituraDaFila } from '../../../components/sino/leitura-do-sino'
import type { ItemDoSino, SituacaoDoSino } from '../../../components/sino/Sino'
import { formatDayOfInstant } from '../../../format'

// As opções de leitura e o tipo da leitura são dos dois sinos (o do professor é da X3) e moram em `components/sino/leitura-do-sino.ts`;
// quem já os importava daqui continua importando.
export { NO_AUTO_REFETCH }
export type { LeituraDaFila }

/**
 * A fila "Esperando você" da coordenação (Tech Spec das telas da coordenação, seção 5, "A fila"; RF4, RF5 e RF7): uma função
 * pura, `montarFila`, sobre leituras que a web já faz, e o gancho que as lê. Nenhuma rota e nenhuma tabela são novas.
 *
 * **Os tipos são cinco e só esses.** Nada aqui deriva de uso, de entrega ou de atividade do professor, e nenhum item leva
 * número por professor (regra 70, itens 8 e 9; D64): quem contestou ou tem convite vencido aparece como o fato, um item por
 * vínculo ou convite, sem contagem. O único `contador` é o das turmas sem professor.
 */
export const TIPOS_DA_FILA = ['incidente', 'contestacao', 'convite-vencido', 'material-falhou', 'turmas-sem-professor'] as const
export type TipoDeItemDaFila = (typeof TIPOS_DA_FILA)[number]

export interface ItemDaFila extends ItemDoSino {
  readonly tipo: TipoDeItemDaFila
}

export interface EntradaDaFila {
  readonly anos: LeituraDaFila<readonly AnoLetivo[]>
  readonly incidentes: LeituraDaFila<readonly IncidenteDaEscola[]>
  readonly professores: LeituraDaFila<readonly ProfessorDaEscola[]>
  readonly materiais: LeituraDaFila<readonly Material[]>
  readonly turmas: LeituraDaFila<readonly Turma[]>
  readonly vinculos: LeituraDaFila<readonly VinculoDaCoordenacao[]>
}

export interface FilaDaCoordenacao {
  readonly itens: readonly ItemDaFila[]
  readonly situacao: SituacaoDoSino
  /** A primeira falha, para a mensagem; só com a fila em `erro` ou `parcial`. */
  readonly erro?: unknown
}

/** O vínculo que dá professor à turma: pendente espera o aceite, confirmado vale. Contestado e encerrado não. */
const ESTADOS_QUE_DAO_PROFESSOR = ['pendente', 'confirmado'] as const

/**
 * As turmas do ano em curso sem nenhum vínculo de professor pendente ou confirmado. É a conta única do sino e do filtro
 * "Sem professor" da Estrutura: duas disciplinas na mesma turma contam a turma uma vez, a turma só com vínculo contestado
 * está sem professor, e o vínculo encerrado não conta.
 */
export function turmasSemProfessor(turmas: readonly Turma[], vinculos: readonly VinculoDaCoordenacao[]): readonly Turma[] {
  const comProfessor = new Set(vinculos.filter((vinculo) => vinculo.papel === 'professor' && ESTADOS_QUE_DAO_PROFESSOR.some((estado) => estado === vinculo.estado)).map((vinculo) => vinculo.turma.id))
  return turmas.filter((turma) => !comProfessor.has(turma.id))
}

function lida<Dado>(leitura: LeituraDaFila<Dado>): Dado | undefined {
  return leitura.estado === 'lida' ? leitura.dado : undefined
}

/** A leitura que serve à conta: lida **e inteira**. Truncada, a conta que depende dela não é feita. */
function inteira<Dado>(leitura: LeituraDaFila<Dado>): Dado | undefined {
  return leitura.estado === 'lida' && leitura.completa ? leitura.dado : undefined
}

function itensDeIncidente(incidentes: readonly IncidenteDaEscola[]): ItemDaFila[] {
  return incidentes
    .filter((incidente) => incidente.confirmadoEm === null)
    .map((incidente) => ({
      id: `incidente-${incidente.id}`,
      tipo: 'incidente',
      titulo: 'Incidente de segurança sem confirmação',
      detalhe: `Avisado em ${formatDayOfInstant(incidente.avisadoEm)}. Confirme que recebeu.`,
      urgente: true,
      para: '/privacidade/incidentes',
    }))
}

function itensDeContestacao(vinculos: readonly VinculoDaCoordenacao[], professores: readonly ProfessorDaEscola[] | undefined): ItemDaFila[] {
  const nomes = new Map((professores ?? []).map((professor) => [professor.usuarioId, professor.nome]))
  return vinculos
    .filter((vinculo) => vinculo.papel === 'professor' && vinculo.estado === 'contestado')
    .map((vinculo) => ({
      id: `contestacao-${vinculo.id}`,
      tipo: 'contestacao',
      titulo: `${nomes.get(vinculo.usuarioId) ?? 'Um professor'} contestou a turma`,
      detalhe: vinculo.disciplina === undefined ? vinculo.turma.nome : `${vinculo.turma.nome} · ${vinculo.disciplina.nome}`,
      urgente: false,
      para: caminhoDoProfessor(vinculo.usuarioId),
    }))
}

function itensDeConviteVencido(professores: readonly ProfessorDaEscola[]): ItemDaFila[] {
  return professores
    .filter((professor) => professor.estado === 'vencido')
    .map((professor) => ({
      id: `convite-${professor.usuarioId}`,
      tipo: 'convite-vencido',
      titulo: `Refazer o convite de ${professor.nome}`,
      detalhe: 'O convite venceu antes de ser aceito.',
      urgente: false,
      para: caminhoDoProfessor(professor.usuarioId),
    }))
}

function itensDeMaterial(materiais: readonly Material[]): ItemDaFila[] {
  return materiais
    .filter((material) => material.estado === 'falhou')
    .map((material) => ({
      id: `material-${material.id}`,
      tipo: 'material-falhou',
      titulo: `O material "${material.titulo}" não foi lido`,
      detalhe: 'Abra o material para ver o que fazer.',
      urgente: false,
      para: `/material?material=${encodeURIComponent(material.id)}`,
    }))
}

function itemDeTurmasSemProfessor(semProfessor: readonly Turma[]): ItemDaFila[] {
  if (semProfessor.length === 0) return []
  return [
    {
      id: 'turmas-sem-professor',
      tipo: 'turmas-sem-professor',
      titulo: semProfessor.length === 1 ? 'Uma turma sem professor' : 'Turmas sem professor',
      detalhe: 'Aloque um professor em cada uma.',
      urgente: false,
      para: '/estrutura?situacao=sem-professor',
      contador: { n: semProfessor.length, oQueConta: semProfessor.length === 1 ? 'turma sem professor' : 'turmas sem professor' },
    },
  ]
}

/**
 * Monta a fila das leituras (Tech Spec, seção 5). Com a falha de uma leitura, ou com `completa: false` em qualquer uma, os
 * itens das outras aparecem e a situação é `parcial`; "turmas sem professor" não é calculada com turmas ou vínculos
 * incompletos. Sem ano em curso, turmas e vínculos nem se leem, e a fila vale com as quatro leituras que existem. `erro` é
 * quando nenhuma leitura que se aplica deu certo; `carregando`, enquanto alguma ainda não respondeu.
 */
export function montarFila(entrada: EntradaDaFila): FilaDaCoordenacao {
  const { anos, incidentes, professores, materiais, turmas, vinculos } = entrada
  const leituras = [anos, incidentes, professores, materiais, turmas, vinculos]

  const itens: ItemDaFila[] = [
    ...itensDeIncidente(lida(incidentes) ?? []),
    ...itensDeContestacao(lida(vinculos) ?? [], lida(professores)),
    ...itensDeConviteVencido(lida(professores) ?? []),
    ...itensDeMaterial(lida(materiais) ?? []),
  ]
  const turmasLidas = inteira(turmas)
  const vinculosLidos = inteira(vinculos)
  if (turmasLidas !== undefined && vinculosLidos !== undefined) itens.push(...itemDeTurmasSemProfessor(turmasSemProfessor(turmasLidas, vinculosLidos)))

  const primeiraFalha = leituras.find((leitura) => leitura.estado === 'erro')
  const falha = primeiraFalha?.estado === 'erro' ? { erro: primeiraFalha.erro } : {}
  if (leituras.some((leitura) => leitura.estado === 'carregando')) return { itens, situacao: 'carregando' }
  if (!leituras.some((leitura) => leitura.estado === 'lida')) return { itens, situacao: 'erro', ...falha }
  // Lista lida em parte (`completa: false`) deixa a fila parcial: o que ficou de fora pode ter item (ou ser o ano em curso).
  const truncada = leituras.some((leitura) => leitura.estado === 'lida' && !leitura.completa)
  if (primeiraFalha !== undefined || truncada) return { itens, situacao: 'parcial', ...falha }
  return { itens, situacao: 'pronta' }
}

/** O ano em curso entre os que se leram; sem a lista inteira nem ano nela, não se sabe. */
export function anoEmCurso(anos: LeituraDaFila<readonly AnoLetivo[]>): AnoLetivo | undefined {
  return lida(anos)?.find((ano) => ano.situacao === 'em_curso')
}

function leituraDe<Dado>(consulta: UseQueryResult<ListaDaEstrutura<Dado>>, aplica = true): LeituraDaFila<readonly Dado[]> {
  if (!aplica) return { estado: 'nao-se-aplica' }
  if (consulta.isError) return { estado: 'erro', erro: consulta.error }
  if (consulta.data === undefined) return { estado: 'carregando' }
  return { estado: 'lida', dado: consulta.data.itens, completa: consulta.data.completa }
}

/** A lista da estrutura que não veio inteira (`lerPaginas` bateu no teto de páginas). */
function veioTruncada(dado: unknown): boolean {
  return typeof dado === 'object' && dado !== null && 'completa' in dado && dado.completa === false
}

export interface FilaLida extends FilaDaCoordenacao {
  readonly tentarDeNovo: () => void
  readonly tentandoDeNovo: boolean
  readonly atualizar: () => void
  readonly atualizando: boolean
  /** Quando a fila ficou pronta pela primeira vez e a cada "Atualizar" que terminou. Sem relógio: só muda por clique. */
  readonly atualizadoEm: Date | undefined
}

/**
 * Lê a fila: seis observadores com as opções acima. O de incidentes é o do aviso da área, uma leitura por sessão
 * (`staleTime: Infinity`). **Turmas e vínculos só se leem com ano letivo em curso**: sem ele a API responde como
 * inexistente, e a fila não chama.
 *
 * "Tentar de novo" relê só o que falhou ou veio truncado, e "Atualizar" relê os cinco da lista (anos, turmas, vínculos,
 * professores e materiais), cada um **por `refetchQueries` com a chave exata** da consulta do observador: nunca por prefixo,
 * que alcançaria também a lista de nomes e os pedidos de titular, cuja leitura é auditada (regra 20, item 10).
 */
export function useFilaDaCoordenacao(): FilaLida {
  const anos = useQuery({ ...anosLetivosQueryOptions, ...QUEUE_QUERY_OPTIONS })
  const incidentes = useQuery({ ...incidentesQueryOptions, ...QUEUE_QUERY_OPTIONS, staleTime: Infinity })
  const professores = useQuery({ ...professoresQueryOptions, ...QUEUE_QUERY_OPTIONS })
  const materiais = useQuery({ ...materiaisQueryOptions, ...QUEUE_QUERY_OPTIONS })
  const leituraDosAnos = leituraDe(anos)
  const aplicaAoAno = anoEmCurso(leituraDosAnos) !== undefined
  const turmas = useQuery({ ...turmasQueryOptions, ...QUEUE_QUERY_OPTIONS, enabled: aplicaAoAno })
  const vinculos = useQuery({ ...vinculosQueryOptions, ...QUEUE_QUERY_OPTIONS, enabled: aplicaAoAno })

  // Os incidentes são uma leitura à parte (`staleTime: Infinity`) e entram na fila como as outras: lidos, em erro ou carregando.
  const leituraDeIncidentes: LeituraDaFila<readonly IncidenteDaEscola[]> = incidentes.isError
    ? { estado: 'erro', erro: incidentes.error }
    : incidentes.data === undefined
      ? { estado: 'carregando' }
      : { estado: 'lida', dado: incidentes.data.incidentes, completa: true }
  const fila = montarFila({
    anos: leituraDosAnos,
    incidentes: leituraDeIncidentes,
    professores: leituraDe(professores),
    materiais: leituraDe(materiais),
    turmas: leituraDe(turmas, aplicaAoAno),
    vinculos: leituraDe(vinculos, aplicaAoAno),
  })

  const [tentandoDeNovo, definirTentando] = useState(false)
  const [atualizando, definirAtualizando] = useState(false)
  const [atualizadoEm, definirAtualizadoEm] = useState<Date | undefined>(undefined)
  // A primeira vez que a fila deixa de carregar marca o "Atualizado às": o relógio não anda sozinho depois disso. Quando ela
  // volta a carregar (recomeço da sessão, troca de escola), a hora da leitura anterior sai: era de outra escola ou pessoa.
  if (atualizadoEm === undefined && fila.situacao !== 'carregando') definirAtualizadoEm(new Date())
  if (atualizadoEm !== undefined && fila.situacao === 'carregando') definirAtualizadoEm(undefined)

  // Funções do render de agora, sem memória: o clique usa as leituras que a tela está mostrando. Cada leitura é pela chave
  // **exata**: com o prefixo (`['estrutura']`, `['privacidade']`) a releitura alcançaria também a lista de nomes e os
  // pedidos de titular que estiverem abertos, e cada uma dessas leituras é auditada (regra 20, item 10).
  const cliente = useQueryClient()
  const reler = (consulta: { readonly queryKey: readonly unknown[] }): Promise<unknown> => cliente.refetchQueries({ queryKey: consulta.queryKey, exact: true })

  // As seis leituras. "Atualizar" relê as cinco da lista (os incidentes são uma leitura por sessão). Turmas e vínculos sem ano em
  // curso estão desligadas (`enabled`), e `refetchQueries` não relê consulta desligada: sem ano, nenhuma chamada a elas.
  const leiturasDaFila = [
    { resultado: anos, consulta: anosLetivosQueryOptions, atualiza: true },
    { resultado: incidentes, consulta: incidentesQueryOptions, atualiza: false },
    { resultado: professores, consulta: professoresQueryOptions, atualiza: true },
    { resultado: materiais, consulta: materiaisQueryOptions, atualiza: true },
    { resultado: turmas, consulta: turmasQueryOptions, atualiza: true },
    { resultado: vinculos, consulta: vinculosQueryOptions, atualiza: true },
  ] as const

  /** Só o que falhou ou veio truncado: reler o que já está inteiro seria leitura à toa. */
  function tentarDeNovo(): void {
    const relidas = leiturasDaFila.filter(({ resultado }) => resultado.isError || veioTruncada(resultado.data)).map(({ consulta }) => reler(consulta))
    definirTentando(true)
    void Promise.allSettled(relidas).then(() => definirTentando(false))
  }

  function atualizar(): void {
    const relidas = leiturasDaFila.filter(({ atualiza }) => atualiza).map(({ consulta }) => reler(consulta))
    definirAtualizando(true)
    void Promise.allSettled(relidas).then(() => {
      definirAtualizando(false)
      definirAtualizadoEm(new Date())
    })
  }

  return { ...fila, tentarDeNovo, tentandoDeNovo, atualizar, atualizando, atualizadoEm }
}
