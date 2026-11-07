import type { AulaDaSemana, DiaDaSemana as Dia, SemanaResponse } from '@educa/shared'
import { useInfiniteQuery, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useSearch } from 'wouter'
import { SEMANA_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { DaySelector } from '../../../../components/ui/fields/DaySelector'
import { Select, type SelectOption } from '../../../../components/ui/fields/Select'
import { MEDIA_MD, useMediaQuery } from '../../../../components/ui/media-query'
import { EmptyState, ErrorState, LoadingState } from '../../../../components/states/index'
import { meusVinculosQueryOptions } from '../../comum/api/vinculos'
import { semanaQueryOptions } from '../api/semana'
import { DiaDaSemana } from './DiaDaSemana'
import {
  deveAbrirAdeHoje,
  diasFiltrados,
  faltaOCalendario,
  diaDoMes,
  enderecoDaAula,
  enderecoDaSemana,
  filtroDoEndereco,
  haSemanaAnterior,
  haSemanaSeguinte,
  hojeNoFusoDaEscola,
  nomeCompletoDoDia,
  nomeCurtoDoDia,
  segundaDe,
  semanaDoEndereco,
  somarDias,
  tituloDaSemana,
  valorDoFiltro,
  vazioDaSemana,
  type FiltroDaSemana,
} from './semana'

type Ano = NonNullable<SemanaResponse['ano']>

/**
 * O ano da última semana lida, de qualquer semana: é o que mantém "Semana anterior" e "Semana seguinte" presas ao ano enquanto a
 * semana nova ainda carrega. Lê o cache de consultas (e não um `useState`): a troca de escola o esvazia junto com o resto.
 * **Isso depende do `resetQueries` global de `main.tsx` (`aoTrocarDeSessao`):** a chave `['semana', segunda]` não leva a escola nem a pessoa,
 * e é esse reset que impede o ano, e as aulas, de uma escola ou de uma professora aparecerem na seguinte. Quem trocar o reset por um
 * escopado precisa dar à chave da semana o mesmo esvaziamento (os casos P30 e RF9 de `e2e/professor-semana.spec.ts` quebram se faltar).
 */
function useAnoConhecido(atual: SemanaResponse | undefined): Ano | undefined {
  const cliente = useQueryClient()
  const lida = atual ?? cliente.getQueriesData<SemanaResponse>({ queryKey: SEMANA_QUERY_KEY }).find(([, dados]) => dados !== undefined)?.[1]
  return lida?.ano ?? undefined
}

/**
 * Os focos da tela, que o navegador não dá sozinho. (1) O "Tentar de novo" some com o erro quando a leitura dá certo: o foco vai ao título
 * da semana. (2) O botão que a pessoa apertava fica desligado ao chegar na ponta do ano: o foco vai ao título, em vez de se perder.
 */
function useFocosDaSemana(segunda: string, lida: boolean, podeAnterior: boolean, podeSeguinte: boolean) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const botaoAnterior = useRef<HTMLButtonElement>(null)
  const botaoSeguinte = useRef<HTMLButtonElement>(null)
  // A semana em que o "Tentar de novo" foi pedido. É uma `ref`: o pedido não desenha nada.
  const novaTentativaDe = useRef<string | undefined>(undefined)
  const podiaAnterior = useRef(podeAnterior)
  const podiaSeguinte = useRef(podeSeguinte)
  useEffect(() => {
    if (novaTentativaDe.current !== segunda || !lida) return
    novaTentativaDe.current = undefined
    titulo.current?.focus()
  }, [segunda, lida])
  useEffect(() => {
    const chegouNaPonta = (podia: boolean, pode: boolean) => podia && !pode
    const ativo = document.activeElement
    const estavaNoBotao = ativo === document.body || ativo === botaoAnterior.current || ativo === botaoSeguinte.current
    if ((chegouNaPonta(podiaAnterior.current, podeAnterior) || chegouNaPonta(podiaSeguinte.current, podeSeguinte)) && estavaNoBotao) titulo.current?.focus()
    podiaAnterior.current = podeAnterior
    podiaSeguinte.current = podeSeguinte
  }, [podeAnterior, podeSeguinte])
  return { titulo, botaoAnterior, botaoSeguinte, pediNovaTentativa: () => (novaTentativaDe.current = segunda) }
}

/** Um dia por vez, escolhido no `DaySelector` (celular, RF12). Abre em hoje, ou no primeiro dia da semana mostrada; uma semana inteira tem de 5 a 7 dias. */
function UmDiaPorVez({ dias, hoje, agora, aoAbrirAula }: { dias: readonly Dia[]; hoje: string; agora: string; aoAbrirAula: (aula: AulaDaSemana, data: string) => void }) {
  const [escolhido, definirEscolhido] = useState<string | undefined>(undefined)
  const inicial = dias.find((dia) => dia.data === hoje)?.data ?? dias[0]?.data ?? ''
  const marcado = escolhido !== undefined && dias.some((dia) => dia.data === escolhido) ? escolhido : inicial
  const dia = dias.find((candidato) => candidato.data === marcado)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DaySelector
        rotulo="Dia da semana"
        dias={dias.map((candidato) => ({ valor: candidato.data, rotulo: nomeCurtoDoDia(candidato.data), diaDoMes: diaDoMes(candidato.data), nome: nomeCompletoDoDia(candidato.data), hoje: candidato.data === hoje }))}
        valor={marcado}
        aoMudar={definirEscolhido}
      />
      {dia !== undefined && <DiaDaSemana dia={dia} hoje={hoje} agora={agora} aoAbrirAula={aoAbrirAula} />}
    </div>
  )
}

/** As opções do filtro: "Todas as turmas" e uma por turma e disciplina de vínculo confirmado (só ele dá aula). */
function useOpcoesDoFiltro(): readonly SelectOption[] {
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)
  const confirmados = (vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).flatMap((vinculo) =>
    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }] : [],
  )
  return [{ valor: '', rotulo: 'Todas as turmas' }, ...confirmados]
}

interface CorpoProps {
  readonly semana: UseQueryResult<SemanaResponse>
  readonly dias: readonly Dia[]
  readonly aguardandoHoje: boolean
  readonly filtro: FiltroDaSemana | undefined
  readonly pediNovaTentativa: () => void
  readonly aoVerTodas: () => void
  readonly aoAbrirAula: (aula: AulaDaSemana, data: string) => void
}

/** Os quatro estados (RF12): erro, carregando, vazio que diz por quê, e com dado — em colunas no computador, um dia por vez no celular. */
function CorpoDaSemana({ semana, dias, aguardandoHoje, filtro, pediNovaTentativa, aoVerTodas, aoAbrirAula }: CorpoProps) {
  const noComputador = useMediaQuery(MEDIA_MD)
  const dados = semana.data
  if (semana.isError) {
    return (
      <ErrorState
        erro={semana.error}
        tentando={semana.isFetching}
        aoTentarDeNovo={() => {
          pediNovaTentativa()
          void semana.refetch({ cancelRefetch: false })
        }}
      />
    )
  }
  if (dados === undefined || aguardandoHoje) return <LoadingState rotulo="Carregando a semana…" />
  const vazio = vazioDaSemana(dados, dias)
  if (vazio !== undefined) {
    return <EmptyState titulo={vazio.titulo} descricao={vazio.descricao} {...(filtro === undefined ? {} : { acao: { rotulo: 'Ver todas as turmas', aoAcionar: aoVerTodas } })} />
  }
  if (!noComputador) return <UmDiaPorVez key={dias[0]?.data} dias={dias} hoje={dados.hoje} agora={dados.agora} aoAbrirAula={aoAbrirAula} />
  return (
    <div style={{ gridTemplateColumns: `repeat(${String(dias.length)}, minmax(0, 1fr))` }} className="grid min-w-0 items-start gap-2">
      {dias.map((dia) => (
        <DiaDaSemana key={dia.data} dia={dia} hoje={dados.hoje} agora={dados.agora} aoAbrirAula={aoAbrirAula} />
      ))}
    </div>
  )
}

interface BarraProps {
  readonly segunda: string
  readonly titulo: RefObject<HTMLHeadingElement | null>
  readonly botaoAnterior: RefObject<HTMLButtonElement | null>
  readonly botaoSeguinte: RefObject<HTMLButtonElement | null>
  readonly podeAnterior: boolean
  readonly podeSeguinte: boolean
  readonly irParaSemana: (nova: string | undefined) => void
  readonly filtro: FiltroDaSemana | undefined
  readonly aoFiltrar: (valor: string) => void
}

/** O título da semana, "Semana anterior", "Hoje", "Semana seguinte" e o filtro por turma e disciplina. */
function BarraDaSemana({ segunda, titulo, botaoAnterior, botaoSeguinte, podeAnterior, podeSeguinte, irParaSemana, filtro, aoFiltrar }: BarraProps) {
  const opcoes = useOpcoesDoFiltro()
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 ref={titulo} tabIndex={-1} className="t-secao min-w-0 text-tinta">
          Semana de {tituloDaSemana(segunda)}
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button ref={botaoAnterior} variante="secundario" tamanho="compacto" disabled={!podeAnterior} onClick={() => irParaSemana(somarDias(segunda, -7))}>
            Semana anterior
          </Button>
          <Button variante="secundario" tamanho="compacto" onClick={() => irParaSemana(undefined)}>
            Hoje
          </Button>
          <Button ref={botaoSeguinte} variante="secundario" tamanho="compacto" disabled={!podeSeguinte} onClick={() => irParaSemana(somarDias(segunda, 7))}>
            Semana seguinte
          </Button>
        </div>
      </div>
      <div className="max-w-sm">
        <Select rotulo="Turma e disciplina" opcoes={opcoes} valor={valorDoFiltro(filtro)} aoMudar={aoFiltrar} />
      </div>
    </>
  )
}

/**
 * A aba **Semana** de Turmas (F2b, RF1 a RF4, RF9, RF12; `docs/interface.md` 1.8): as aulas da professora na escola ativa, de segunda a
 * domingo, uma coluna por dia (um dia por vez no celular). Só existe com a aba aberta: é a `lazy` de `Turmas` que a monta, e a leitura
 * (`GET /v1/semana`) sai daqui, uma por semana, com a chave `['semana', segunda]`.
 *
 * - **O endereço** leva só datas e ids: `?semana=` (a segunda da semana; inválido ou fora do ano, abre a de hoje) e `?turma=<turmaId>.<disciplinaId>`.
 *   O clique no cartão põe `?aula=<vinculoId>.<data>.<HHMM>`; o painel da aula é da tarefa 7.0.
 * - **A navegação é presa ao ano** (RF2): "Semana anterior" fica desligada na semana do começo dele e "Semana seguinte" na do fim.
 * - **Os quatro estados** (RF12): carregando; erro com "Tentar de novo", e o foco vai ao título da semana quando a nova leitura dá certo; vazio
 *   que diz por quê; com dado. Sem calendário importado, as aulas aparecem com o aviso de que ele falta.
 * - **Filtro por turma e disciplina**: as opções são os vínculos dela (a leitura de Turmas, que já está no cache); o filtro corta o que a API devolveu.
 */
export default function Semana() {
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const pedida = semanaDoEndereco(busca)
  const segunda = pedida ?? segundaDe(hojeNoFusoDaEscola(new Date()))
  const filtro = filtroDoEndereco(busca)
  const semana = useQuery(semanaQueryOptions(segunda))
  const dados = semana.data
  const ano = useAnoConhecido(dados)
  const podeAnterior = ano !== undefined && haSemanaAnterior(segunda, ano)
  const podeSeguinte = ano !== undefined && haSemanaSeguinte(segunda, ano)
  const focos = useFocosDaSemana(segunda, dados !== undefined, podeAnterior, podeSeguinte)
  // A semana do endereço que não toca o ano abre a de hoje (RF2).
  const irParaHoje = deveAbrirAdeHoje(pedida, segunda, dados)

  useEffect(() => {
    if (irParaHoje) navegar(enderecoDaSemana(caminho, busca, { semana: undefined }), { replace: true })
  }, [irParaHoje, navegar, caminho, busca])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BarraDaSemana
        segunda={segunda}
        titulo={focos.titulo}
        botaoAnterior={focos.botaoAnterior}
        botaoSeguinte={focos.botaoSeguinte}
        podeAnterior={podeAnterior}
        podeSeguinte={podeSeguinte}
        irParaSemana={(nova) => navegar(enderecoDaSemana(caminho, busca, { semana: nova }))}
        filtro={filtro}
        aoFiltrar={(valor) => navegar(enderecoDaSemana(caminho, busca, { turma: valor }), { replace: true })}
      />
      {faltaOCalendario(dados) && (
        <Alert tom="atencao" titulo="O calendário da escola ainda não foi importado">
          Feriados e recessos não aparecem aqui, e as aulas mostradas podem cair em dia sem aula. Quem importa o calendário é a coordenação.
        </Alert>
      )}
      <CorpoDaSemana
        semana={semana}
        dias={dados === undefined ? [] : diasFiltrados(dados.dias, filtro)}
        aguardandoHoje={irParaHoje}
        filtro={filtro}
        pediNovaTentativa={focos.pediNovaTentativa}
        aoVerTodas={() => navegar(enderecoDaSemana(caminho, busca, { turma: undefined }))}
        aoAbrirAula={(aula, data) => navegar(enderecoDaAula(caminho, busca, aula, data))}
      />
    </div>
  )
}
