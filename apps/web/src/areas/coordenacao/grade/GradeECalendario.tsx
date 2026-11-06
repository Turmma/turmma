import type { AnoLetivo, EventoDoCalendario, Turma } from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { ESTRUTURA_QUERY_KEY, anosLetivosQueryOptions, disciplinasQueryOptions, turmasQueryOptions, type ListaDaEstrutura } from '../../../api/estrutura'
import { EmptyState, ErrorState, LoadingState } from '../../../components/states/index'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { SELECT_CLASSES } from '../../../components/ui/fields/field-styles'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { formatDate } from '../../../format'
import { COORDENACAO_ROUTES } from '../../../paths'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import { ordenarTurmas } from '../comum/ordem'
import { calendarioQueryOptions, gradeDaTurmaQueryOptions } from './api/grade'
import { painelDoEndereco, type PainelDaGrade } from './endereco-da-grade'
import { montarGrade, type GradeMontada } from './grade-da-turma'
import { baixarModeloDoTipo, MODELOS_DE_PLANILHA } from './modelos-de-planilha'
import { PainelDaImportacaoDaGrade, PainelDaImportacaoDoCalendario } from './PaineisDeImportacao'
import { NOME_DO_TIPO_DE_EVENTO, TEXTO_DOS_MODELOS, VAZIO_DA_GRADE, VAZIO_DO_CALENDARIO } from './textos-da-grade'

/**
 * Escola › Grade e calendário (F2, 14.0; RF1, RF7, RF9 e RF10; Tech Spec, seções 4 e 9): os modelos das quatro planilhas para baixar, a
 * grade de cada turma (dias nas colunas, horários nas linhas) e o calendário do ano. A importação da grade e a do calendário abrem
 * num painel ao lado (`?painel=importar-grade` e `?painel=importar-calendario`), com a mesma peça da planilha de alunos.
 *
 * - **Quatro estados** em cada leitura (regra 50, item 5): a grade e o calendário têm o carregando, o erro com "Tentar de novo", o
 *   vazio, que convida a baixar o modelo ou importar, e o com dado. A escola sem ano em curso não tem grade nem calendário a ler, e
 *   a tela diz para abrir o ano em Turmas.
 * - **Uma ação cheia só por tela** (`docs/interface.md`): os botões de importar e de baixar são secundários, e o cheio é o do vazio ou
 *   o "Tentar de novo" da leitura que falhou.
 * - **A grade rola dentro do cartão**, nunca a página (Tech Spec, seção 9): a tabela tem a largura que os dias pedem, e a região que a
 *   contém rola de lado e, só quando rola, entra no Tab.
 * - **O ano planejado só se lê** (RF16): o calendário tem o seletor do ano planejado, e a importação grava no ano em curso, de modo
 *   que o botão de importar o calendário some quando o planejado está à vista.
 * - **A troca de turma vale a última**: a leitura da grade é por turma (a chave leva o id), e a resposta de uma turma anterior que
 *   chega depois não toma o lugar da de agora.
 */

const COLUNAS_DOS_EVENTOS: readonly [TableColumn<EventoDoCalendario>, ...TableColumn<EventoDoCalendario>[]] = [
  { chave: 'periodo', titulo: 'Período', celula: (evento) => (evento.inicio === evento.fim ? formatDate(evento.inicio) : `${formatDate(evento.inicio)} a ${formatDate(evento.fim)}`) },
  { chave: 'tipo', titulo: 'Tipo', celula: (evento) => NOME_DO_TIPO_DE_EVENTO[evento.tipo] },
  { chave: 'descricao', titulo: 'Descrição', celula: (evento) => <span className="wrap-anywhere">{evento.descricao}</span> },
]

/** O cabeçalho de uma seção da tela: o título, as ações dele e o anúncio do que acabou de acontecer. */
function Secao({ titulo, tituloRef, acao, anuncio, children }: { titulo: string; tituloRef?: RefObject<HTMLHeadingElement | null>; acao?: ReactNode; anuncio?: string | undefined; children: ReactNode }) {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={tituloRef} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
          {titulo}
        </h2>
        {acao}
      </div>
      <p role="status" className="text-apoio empty:hidden">
        {anuncio}
      </p>
      {children}
    </section>
  )
}

/**
 * A região que rola de lado só entra no Tab quando a tabela passa da largura dela. Ela é `relative` de propósito: o "Sem aula" e a
 * legenda da tabela são `sr-only` (posição absoluta), e sem um ancestral posicionado eles escapam do corte e alargam a página inteira.
 */
function useSobraDeLargura(): { readonly regiao: RefObject<HTMLDivElement | null>; readonly sobra: boolean } {
  const regiao = useRef<HTMLDivElement>(null)
  const [sobra, definirSobra] = useState(false)
  useEffect(() => {
    const elemento = regiao.current
    if (elemento === null) return
    const medir = () => definirSobra(elemento.scrollWidth > elemento.clientWidth)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    if (elemento.firstElementChild !== null) observador.observe(elemento.firstElementChild)
    return () => observador.disconnect()
  }, [])
  return { regiao, sobra }
}

function TabelaDaGrade({ nomeDaTurma, grade }: { nomeDaTurma: string; grade: GradeMontada }) {
  const { regiao, sobra } = useSobraDeLargura()
  return (
    <div
      ref={regiao}
      role="region"
      aria-label={`Grade da turma ${nomeDaTurma}`}
      tabIndex={sobra ? 0 : undefined}
      className="relative min-w-0 overflow-x-auto rounded-cartao border-2 border-borda bg-superficie"
    >
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <caption className="sr-only">Grade da turma {nomeDaTurma}: os dias da semana nas colunas e os horários nas linhas</caption>
        <thead>
          <tr className="border-b-2 border-borda">
            <th scope="col" className="t-selo px-3 py-3 font-semibold text-tinta">
              Horário
            </th>
            {grade.dias.map((dia) => (
              <th key={dia.numero} scope="col" className="t-selo px-3 py-3 font-semibold text-tinta">
                {dia.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grade.horarios.map((horario) => (
            <tr key={horario.chave} className="border-t-2 border-borda first:border-t-0">
              <th scope="row" className="px-3 py-3 align-top font-medium whitespace-nowrap text-tinta">
                {horario.inicio} – {horario.fim}
              </th>
              {grade.dias.map((dia) => {
                const aulas = grade.aulasEm(dia.numero, horario)
                return (
                  <td key={dia.numero} className="min-w-32 px-3 py-3 align-top">
                    {aulas.length === 0 ? (
                      <span className="text-apoio">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Sem aula</span>
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {aulas.map((aula) => (
                          <li key={aula.id} className="min-w-0 wrap-anywhere">
                            <span className="block font-semibold text-tinta">{aula.disciplina}</span>
                            <span className="block text-apoio">{aula.professor}</span>
                            {aula.sala !== null && <span className="block text-apoio">Sala {aula.sala}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GradeDaTurma({ turmas, aoEscolher, escolhida, anuncio, tituloRef, aoImportar }: { turmas: readonly Turma[]; escolhida: Turma; aoEscolher: (turmaId: string) => void; anuncio: string | undefined; tituloRef: RefObject<HTMLHeadingElement | null>; aoImportar: () => void }) {
  const campo = useId()
  const grade = useQuery(gradeDaTurmaQueryOptions(escolhida.id))
  const disciplinas = useQuery(disciplinasQueryOptions)
  const leituras = [grade, disciplinas] as const
  const falhou = leituras.find((leitura) => leitura.isError)
  const nomes = new Map((disciplinas.data?.itens ?? []).map((disciplina) => [disciplina.id, disciplina.nome]))

  let corpo: ReactNode
  if (falhou !== undefined) {
    corpo = <ErrorState erro={falhou.error} tentando={falhou.isFetching} aoTentarDeNovo={() => void falhou.refetch({ cancelRefetch: false })} />
  } else if (grade.data === undefined || disciplinas.isPending) {
    corpo = <LoadingState rotulo="Carregando a grade…" />
  } else if (grade.data.aulas.length === 0) {
    corpo = (
      <EmptyState
        titulo={`A turma ${escolhida.nome} ainda não tem aula na grade`}
        descricao={VAZIO_DA_GRADE}
        acao={{ rotulo: 'Baixar modelo', aoAcionar: () => baixarModeloDoTipo('grade') }}
      />
    )
  } else {
    corpo = <TabelaDaGrade nomeDaTurma={escolhida.nome} grade={montarGrade(grade.data.aulas, (id) => (id === null ? undefined : nomes.get(id)))} />
  }

  return (
    <Secao
      titulo="Grade horária"
      tituloRef={tituloRef}
      anuncio={anuncio}
      acao={
        <button type="button" onClick={aoImportar} className={SECONDARY_BUTTON_CLASSES}>
          Importar grade
        </button>
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={campo} className="font-medium">
          Turma
        </label>
        <select id={campo} value={escolhida.id} onChange={(evento) => aoEscolher(evento.target.value)} className={`${SELECT_CLASSES} max-w-xs`}>
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.nome}
            </option>
          ))}
        </select>
      </div>
      {corpo}
    </Secao>
  )
}

function GradeDaEscola({ anuncio, tituloRef, aoImportar }: { anuncio: string | undefined; tituloRef: RefObject<HTMLHeadingElement | null>; aoImportar: () => void }) {
  const turmas = useQuery(turmasQueryOptions)
  const [escolhida, definirEscolhida] = useState<string | undefined>(undefined)
  if (turmas.data === undefined) {
    return (
      <Secao titulo="Grade horária" tituloRef={tituloRef} anuncio={anuncio}>
        {turmas.isError ? <ErrorState erro={turmas.error} tentando={turmas.isFetching} aoTentarDeNovo={() => void turmas.refetch({ cancelRefetch: false })} /> : <LoadingState rotulo="Carregando as turmas…" />}
      </Secao>
    )
  }
  const emOrdem = ordenarTurmas(turmas.data.itens)
  const turma = emOrdem.find((candidata) => candidata.id === escolhida) ?? emOrdem[0]
  if (turma === undefined) {
    return (
      <Secao
        titulo="Grade horária"
        tituloRef={tituloRef}
        anuncio={anuncio}
        acao={
          <button type="button" onClick={aoImportar} className={SECONDARY_BUTTON_CLASSES}>
            Importar grade
          </button>
        }
      >
        <EmptyState titulo="Nenhuma turma ainda" descricao="A grade é de cada turma. Crie as turmas em Turmas, ou importe a grade: as turmas que ela cita e que ainda não existem nascem ao gravar." />
      </Secao>
    )
  }
  return <GradeDaTurma turmas={emOrdem} escolhida={turma} aoEscolher={definirEscolhida} anuncio={anuncio} tituloRef={tituloRef} aoImportar={aoImportar} />
}

/** Os anos que a coordenação pode ler no calendário: o em curso e o planejado. O encerrado não tem calendário a gravar nem a ler por aqui. */
const ehLegivel = (ano: AnoLetivo): boolean => ano.situacao === 'em_curso' || ano.situacao === 'planejado'

function CalendarioDoAno({ anos, anoEmCurso, anuncio, tituloRef, aoImportar }: { anos: readonly AnoLetivo[]; anoEmCurso: AnoLetivo; anuncio: string | undefined; tituloRef: RefObject<HTMLHeadingElement | null>; aoImportar: () => void }) {
  const campo = useId()
  const legiveis = anos.filter(ehLegivel)
  const [escolhido, definirEscolhido] = useState<string>(anoEmCurso.id)
  const ano = legiveis.find((candidato) => candidato.id === escolhido) ?? anoEmCurso
  const noPlanejado = ano.id !== anoEmCurso.id
  const calendario = useQuery(calendarioQueryOptions(noPlanejado ? ano.id : undefined))

  let corpo: ReactNode
  if (calendario.isError) corpo = <ErrorState erro={calendario.error} tentando={calendario.isFetching} aoTentarDeNovo={() => void calendario.refetch({ cancelRefetch: false })} />
  else if (calendario.isPending) corpo = <LoadingState rotulo="Carregando o calendário…" />
  else if (calendario.data.eventos.length === 0) {
    corpo = (
      <EmptyState
        titulo={`Nenhum evento no calendário de ${String(ano.ano)}`}
        descricao={noPlanejado ? 'O calendário do ano planejado ainda não foi gravado.' : VAZIO_DO_CALENDARIO}
      />
    )
  } else corpo = <Table rotulo={`Calendário de ${String(ano.ano)}`} colunas={COLUNAS_DOS_EVENTOS} linhas={calendario.data.eventos} chaveDaLinha={(evento) => evento.id} />

  return (
    <Secao
      titulo={`Calendário de ${String(ano.ano)}`}
      tituloRef={tituloRef}
      anuncio={anuncio}
      acao={
        noPlanejado ? undefined : (
          <button type="button" onClick={aoImportar} className={SECONDARY_BUTTON_CLASSES}>
            Importar calendário
          </button>
        )
      }
    >
      {legiveis.length > 1 && (
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={campo} className="font-medium">
            Ano letivo
          </label>
          <select id={campo} value={ano.id} onChange={(evento) => definirEscolhido(evento.target.value)} className={`${SELECT_CLASSES} max-w-xs`}>
            {legiveis.map((candidato) => (
              <option key={candidato.id} value={candidato.id}>
                {candidato.ano} ({candidato.situacao === 'em_curso' ? 'em curso' : 'planejado'})
              </option>
            ))}
          </select>
        </div>
      )}
      {noPlanejado && <p className="text-apoio">Este é o calendário do ano planejado, só para ler. A importação grava no ano em curso.</p>}
      {corpo}
    </Secao>
  )
}

function ModelosDePlanilha() {
  const titulo = useId()
  return (
    <section aria-labelledby={titulo} className="flex min-w-0 flex-col gap-3">
      <h2 id={titulo} className="text-lg font-semibold text-tinta">
        Modelos de planilha
      </h2>
      <p className="text-apoio">{TEXTO_DOS_MODELOS}</p>
      <ul className="flex flex-wrap gap-3">
        {MODELOS_DE_PLANILHA.map((modelo) => (
          <li key={modelo.tipo}>
            <button type="button" onClick={() => baixarModeloDoTipo(modelo.tipo)} className={SECONDARY_BUTTON_CLASSES}>
              {modelo.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A escola sem ano em curso não tem a quem gravar grade nem calendário: o convite é abrir o ano, em Turmas. */
function SemAnoEmCurso() {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <EmptyState titulo="Abra o ano letivo primeiro" descricao="A grade e o calendário são do ano letivo em curso. Abra o ano em Turmas e volte aqui para importar." />
      <div>
        <Link to={COORDENACAO_ROUTES.estrutura} className={SECONDARY_BUTTON_CLASSES}>
          Ir para Turmas
        </Link>
      </div>
    </div>
  )
}

interface AnunciosDaTela {
  readonly de: 'grade' | 'calendario'
  readonly texto: string
}

/** As leituras que dependem do ano em curso: a grade e o calendário, ou o convite a abrir o ano. */
function LeituraDaEscola({ anos, anuncio, tituloDaGrade, tituloDoCalendario, aoImportar }: { anos: UseQueryResult<ListaDaEstrutura<AnoLetivo>>; anuncio: AnunciosDaTela | undefined; tituloDaGrade: RefObject<HTMLHeadingElement | null>; tituloDoCalendario: RefObject<HTMLHeadingElement | null>; aoImportar: (qual: PainelDaGrade) => void }) {
  if (anos.isError) return <ErrorState erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch({ cancelRefetch: false })} />
  if (anos.data === undefined) return <LoadingState rotulo="Carregando a grade e o calendário…" />
  const anoEmCurso = anos.data.itens.find((ano) => ano.situacao === 'em_curso')
  if (anoEmCurso === undefined) return <SemAnoEmCurso />
  return (
    <>
      <GradeDaEscola anuncio={anuncio?.de === 'grade' ? anuncio.texto : undefined} tituloRef={tituloDaGrade} aoImportar={() => aoImportar('importar-grade')} />
      <CalendarioDoAno
        anos={anos.data.itens}
        anoEmCurso={anoEmCurso}
        anuncio={anuncio?.de === 'calendario' ? anuncio.texto : undefined}
        tituloRef={tituloDoCalendario}
        aoImportar={() => aoImportar('importar-calendario')}
      />
    </>
  )
}

export default function GradeECalendario() {
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const painel = painelDoEndereco(busca)
  const anos = useQuery(anosLetivosQueryOptions)
  // O painel só abre com o ano em curso lido: sem ele a importação não tem a quem gravar.
  const podeImportar = anos.data?.itens.some((ano) => ano.situacao === 'em_curso') === true
  const [anuncio, definirAnuncio] = useState<AnunciosDaTela | undefined>(undefined)
  const tituloDaGrade = useRef<HTMLHeadingElement>(null)
  const tituloDoCalendario = useRef<HTMLHeadingElement>(null)
  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: ESTRUTURA_QUERY_KEY }), [cliente])

  const abrirPainel = (qual: PainelDaGrade): void => {
    definirAnuncio(undefined)
    navegar(enderecoComParametro(caminho, busca, 'painel', qual))
  }
  const fecharPainel = (): void => navegar(enderecoComParametro(caminho, busca, 'painel', undefined), { replace: true })
  const concluir = (de: AnunciosDaTela['de'], texto: string) => () => {
    definirAnuncio({ de, texto })
    return recarregar()
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <ModelosDePlanilha />
      <LeituraDaEscola anos={anos} anuncio={anuncio} tituloDaGrade={tituloDaGrade} tituloDoCalendario={tituloDoCalendario} aoImportar={abrirPainel} />
      {podeImportar && painel === 'importar-grade' && (
        <PainelDaImportacaoDaGrade aoConcluir={concluir('grade', 'Planilha gravada. A grade abaixo já está atualizada.')} aoFechar={fecharPainel} focoDeReserva={() => tituloDaGrade.current?.focus()} />
      )}
      {podeImportar && painel === 'importar-calendario' && (
        <PainelDaImportacaoDoCalendario aoConcluir={concluir('calendario', 'Planilha gravada. O calendário abaixo já está atualizado.')} aoFechar={fecharPainel} focoDeReserva={() => tituloDoCalendario.current?.focus()} />
      )}
    </div>
  )
}
