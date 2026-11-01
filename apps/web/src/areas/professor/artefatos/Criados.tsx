import { NOME_DA_FERRAMENTA } from '@educa/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { artefatosQueryOptions } from './api/artefatos'
import { meusVinculosQueryOptions } from '../comum/api/vinculos'
import { PROFESSOR_ROUTES, caminhoDoArtefatoDoProfessor } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { ListItem } from '../../../components/ui/ListItem'
import { Menu } from '../../../components/ui/overlays/Menu'
import { Onca } from '../../../components/ui/onca/Onca'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { Toggle } from '../../../components/ui/Toggle'
import { formatDateTime, formatQuantity } from '../../../format'
import { usePageTitle } from '../../../document-title'
import { agruparPorTurma, enderecoComFiltros, FAMILIA_DA_ENTREGA, filtrar, filtrosLigados, lerFiltros, OPCOES_DE_ESTADO, OPCOES_DE_TIPO, rotuloDeVerDocumentos, SELO_DA_ENTREGA, SEM_FILTROS, type FiltrosDeCriados, type OpcaoDeFiltro } from './criados'
import { textoDaAdaptacao } from './entregas'
import { IconeDeFerramenta } from '../ferramentas/icones-de-ferramenta'
import { nomesDasDisciplinas, nomesDasTurmas, turmasDaProfessora } from '../comum/turmas-da-professora'

interface PropsDoFiltroEmMenu {
  readonly nome: string
  readonly opcoes: readonly OpcaoDeFiltro<string>[]
  readonly valor: string
  readonly valorSemFiltro: string
  /** O rótulo do que está escolhido quando a opção não está na lista (a turma que o endereço traz e a professora não tem). */
  readonly rotuloDoDesconhecido: string
  readonly aoEscolher: (id: string) => void
}

/** Um filtro do computador: o menu de escolha única, com o nome do filtro quando nada está escolhido e o que está escolhido quando está. */
function FiltroEmMenu({ nome, opcoes, valor, valorSemFiltro, rotuloDoDesconhecido, aoEscolher }: PropsDoFiltroEmMenu) {
  const ligado = valor !== valorSemFiltro
  const escolhida = opcoes.find((opcao) => opcao.id === valor)
  return (
    <Menu
      rotulo={ligado ? (escolhida?.rotulo ?? rotuloDoDesconhecido) : nome}
      {...(ligado ? { prefixo: nome } : {})}
      itens={opcoes}
      escolhido={valor}
      aoEscolher={aoEscolher}
      titulo={nome}
      alinhamento="fim"
    />
  )
}

/** Um grupo de toques do diálogo "Filtrar" (o celular): escolher o que já está escolhido tira o filtro. */
function GrupoDeToques({ nome, opcoes, valor, valorSemFiltro, aoEscolher }: Omit<PropsDoFiltroEmMenu, 'rotuloDoDesconhecido'>) {
  return (
    <div role="group" aria-label={nome} className="mt-4 flex min-w-0 flex-col gap-2">
      <p aria-hidden="true" className="t-selo text-sutil">
        {nome}
      </p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {opcoes
          .filter((opcao) => opcao.id !== valorSemFiltro)
          .map((opcao) => (
            <Toggle key={opcao.id} selecionado={opcao.id === valor} aoMudar={(selecionado) => aoEscolher(selecionado ? opcao.id : valorSemFiltro)}>
              {opcao.rotulo}
            </Toggle>
          ))}
      </div>
    </div>
  )
}

/**
 * "Criados" (D74, D80; telas do professor, 5.0; `docs/interface.md` 11.2): o que a professora já gerou, **por turma**,
 * com o filtro de tipo, de turma e de estado no endereço. É a leitura de `GET /v1/artefatos`, a mesma de antes, e nenhum dado
 * novo: a lista saiu de Ferramentas.
 *
 * - **Os filtros moram no endereço** (`?tipo=`, `?turma=`, `?estado=`) e trocam com `replace`: abrir um documento e voltar pelo
 *   histórico devolve a lista como estava. Valor desconhecido cai em "todos".
 * - **A turma vai ao servidor**; o tipo e o estado filtram o que já foi lido. A turma que o endereço traz não é conferida contra
 *   as da professora: o servidor responde a de outra escola como a que não existe (regra 10, itens 4 e 6), e a tela mostra o
 *   mesmo para as duas.
 * - **O estado é o da versão adaptada** (esperando a professora, aprovada, rejeitada). O original não passa por aprovação, não
 *   tem selo, e com um estado escolhido não aparece.
 * - **No celular** os três filtros viram o botão "Filtrar", que abre um diálogo com os toques (regra 50, item 2a).
 *
 * Os quatro estados: carregando, erro com "Tentar de novo", vazio (com o caminho para Ferramentas) e com dado. Filtro sem
 * resultado é outro caso: com mais páginas por ler diz "até aqui" e mantém "Ver mais", e sem elas diz "Nada com estes
 * filtros", com "Limpar filtros".
 */
export default function Criados() {
  usePageTitle('Criados')
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const filtros = lerFiltros(busca)
  const artefatos = useInfiniteQuery(artefatosQueryOptions(filtros.turma))
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)
  const noComputador = useMediaQuery(MEDIA_MD)
  const [filtrando, definirFiltrando] = useState(false)
  // Os documentos que já estavam na tela quando a professora pediu "Ver mais" (num ref: só o efeito os lê), e a contagem que o acorda.
  const jaNaTela = useRef<ReadonlySet<string> | undefined>(undefined)
  const [pedidoDeFoco, definirPedidoDeFoco] = useState(0)
  const tituloDaTela = useRef<HTMLHeadingElement>(null)
  const grupos = useRef<HTMLDivElement>(null)
  const idDoTitulo = useId()

  const vinculosLidos = vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const nomeDaTurma = nomesDasTurmas(vinculosLidos)
  const nomeDaDisciplina = nomesDasDisciplinas(vinculosLidos)
  const lidos = artefatos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const visiveis = filtrar(lidos, filtros)
  const porTurma = agruparPorTurma(visiveis, (turmaId) => nomeDaTurma[turmaId], (disciplinaId) => nomeDaDisciplina[disciplinaId])
  const ligados = filtrosLigados(filtros)
  // As turmas do filtro: uma vez cada, mesmo com duas disciplinas nela; o filtro é pela turma.
  const turmasDoFiltro: OpcaoDeFiltro<string>[] = [
    { id: '', rotulo: 'Todas as turmas' },
    ...[...new Map(turmasDaProfessora(vinculosLidos).map((turma) => [turma.turmaId, turma.turmaNome] as const))].map(([id, rotulo]) => ({ id, rotulo })),
  ]

  // "Ver mais" lê a página seguinte e leva o foco ao primeiro documento que ela trouxe: o botão pode ter saído da tela.
  useEffect(() => {
    const antes = jaNaTela.current
    if (antes === undefined) return
    jaNaTela.current = undefined
    const primeiroNovo = porTurma.flatMap((grupo) => grupo.itens).find((artefato) => !antes.has(artefato.id))
    const link = primeiroNovo === undefined ? null : grupos.current?.querySelector<HTMLElement>(`[data-artefato-id="${primeiroNovo.id}"] a`)
    if (link) link.focus()
    else if (document.activeElement === null || document.activeElement === document.body) tituloDaTela.current?.focus()
    // Sem pedido (`jaNaTela` vazio) o efeito não faz nada: a lista que muda por outro caminho não leva o foco a lugar nenhum.
  }, [pedidoDeFoco, porTurma])

  function mudar(mudanca: Partial<FiltrosDeCriados>): void {
    navegar(enderecoComFiltros(caminho, busca, mudanca), { replace: true })
  }

  function limpar(): void {
    mudar(SEM_FILTROS)
    // O botão que limpou sai da tela com o resultado novo: o foco vai para o título (regra 50, item 11).
    tituloDaTela.current?.focus()
  }

  async function verMais(): Promise<void> {
    const antes = new Set(visiveis.map((artefato) => artefato.id))
    await artefatos.fetchNextPage()
    // O pedido só existe depois da leitura: as renderizações enquanto ela corre não podem consumi-lo.
    jaNaTela.current = antes
    definirPedidoDeFoco((n) => n + 1)
  }

  // O que cada filtro faz com a escolha: um valor que não é opção cai em "todos", e a turma "Todas as turmas" tira o filtro.
  const escolherTipo = (id: string): void => mudar({ tipo: OPCOES_DE_TIPO.find((opcao) => opcao.id === id)?.id ?? 'todos' })
  const escolherTurma = (id: string): void => mudar({ turma: id === '' ? undefined : id })
  const escolherEstado = (id: string): void => mudar({ estado: OPCOES_DE_ESTADO.find((opcao) => opcao.id === id)?.id ?? 'todos' })

  const carregando = artefatos.isPending || (vinculos.isPending && !artefatos.isError)
  const lido = !carregando && artefatos.data !== undefined
  const menus = (
    <>
      <FiltroEmMenu nome="Tipo" opcoes={OPCOES_DE_TIPO} valor={filtros.tipo} valorSemFiltro="todos" rotuloDoDesconhecido="Tipo" aoEscolher={escolherTipo} />
      <FiltroEmMenu nome="Turma" opcoes={turmasDoFiltro} valor={filtros.turma ?? ''} valorSemFiltro="" rotuloDoDesconhecido={vinculos.isPending ? 'Turma' : 'Outra turma'} aoEscolher={escolherTurma} />
      <FiltroEmMenu nome="Estado" opcoes={OPCOES_DE_ESTADO} valor={filtros.estado} valorSemFiltro="todos" rotuloDoDesconhecido="Estado" aoEscolher={escolherEstado} />
    </>
  )

  return (
    <Page
      titulo="Criados"
      idDoTitulo={idDoTitulo}
      refDoTitulo={tituloDaTela}
      acoes={
        noComputador ? (
          menus
        ) : (
          <Button variante="secundario" tamanho="compacto" onClick={() => definirFiltrando(true)}>
            {ligados === 0 ? 'Filtrar' : `Filtrar (${String(ligados)})`}
          </Button>
        )
      }
    >
      <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-6">
        {carregando && <LoadingState rotulo="Carregando o que você já gerou…" />}
        {artefatos.isError && <ErrorState erro={artefatos.error} tentando={artefatos.isFetching} aoTentarDeNovo={() => void artefatos.refetch({ cancelRefetch: false })} />}

        {lido && visiveis.length === 0 && lidos.length === 0 && !artefatos.hasNextPage && ligados === 0 && (
          <EmptyState
            variante="tracejado"
            ilustracao={<Onca pose="apontando" agente="assistente_de_ensino" tamanho={120} animada={false} />}
            titulo="Nada gerado ainda"
            descricao="Escolha uma ferramenta, ou peça ao Assistente no Início. O que for gerado fica guardado aqui, ligado à turma."
            acao={{ rotulo: 'Ir para Ferramentas', aoAcionar: () => navegar(PROFESSOR_ROUTES.ferramentas) }}
          />
        )}
        {lido && visiveis.length === 0 && (lidos.length > 0 || ligados > 0) && !artefatos.hasNextPage && (
          <EmptyState titulo="Nada com estes filtros" descricao="Nenhum documento seu tem este tipo, nesta turma e neste estado." acao={{ rotulo: 'Limpar filtros', aoAcionar: limpar }} />
        )}
        {lido && visiveis.length === 0 && artefatos.hasNextPage && (
          <EmptyState titulo="Nada com estes filtros até aqui" descricao="Ainda há documentos mais antigos que não foram lidos. Veja mais para procurar neles." />
        )}

        {/* Enquanto os vínculos não chegam, os grupos não têm nome de turma: esperam, em vez de aparecerem como "Outra turma". */}
        <div ref={grupos} className="flex min-w-0 flex-col gap-6">
          {!carregando && porTurma.map((grupo) => (
            <section key={grupo.chave} aria-labelledby={`${idDoTitulo}-${grupo.chave}`} className="flex min-w-0 flex-col gap-3">
              <SectionHeader id={`${idDoTitulo}-${grupo.chave}`} titulo={grupo.titulo} apoio={formatQuantity(grupo.itens.length, 'documento', 'documentos')} />
              <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda bg-superficie">
                {grupo.itens.map((artefato) => {
                  const turma = nomeDaTurma[artefato.turmaId]
                  return (
                    <li key={artefato.id} data-artefato="" data-artefato-id={artefato.id}>
                      <ListItem
                        para={caminhoDoArtefatoDoProfessor(artefato.id)}
                        titulo={artefato.titulo}
                        inicio={<IconeDeFerramenta ferramenta={artefato.adaptacao === null ? artefato.tipo : 'adaptacao'} tamanho={40} />}
                        abaixo={
                          <>
                            {artefato.adaptacao === null ? NOME_DA_FERRAMENTA[artefato.tipo] : `Versão adaptada · ${textoDaAdaptacao(artefato.adaptacao)}`}
                            {/* A turma já é o título do grupo; fora dele, na lista de links, a linha continua dizendo de que turma é. */}
                            {turma !== undefined && <span className="sr-only"> · {turma}</span>} · {formatDateTime(artefato.criadoEm)}
                          </>
                        }
                        {...(artefato.entrega === null ? {} : { fim: <StatusBadge familia={FAMILIA_DA_ENTREGA[artefato.entrega.estado]}>{SELO_DA_ENTREGA[artefato.entrega.estado]}</StatusBadge> })}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        {artefatos.hasNextPage && (
          <Button variante="secundario" onClick={() => void verMais()} disabled={artefatos.isFetchingNextPage} className="self-start">
            {artefatos.isFetchingNextPage ? 'Carregando…' : 'Ver mais'}
          </Button>
        )}
      </section>

      {!noComputador && filtrando && (
        <Dialog titulo="Filtrar" aoFechar={() => definirFiltrando(false)}>
          <GrupoDeToques nome="Tipo" opcoes={OPCOES_DE_TIPO} valor={filtros.tipo} valorSemFiltro="todos" aoEscolher={escolherTipo} />
          <GrupoDeToques nome="Turma" opcoes={turmasDoFiltro} valor={filtros.turma ?? ''} valorSemFiltro="" aoEscolher={escolherTurma} />
          <GrupoDeToques nome="Estado" opcoes={OPCOES_DE_ESTADO} valor={filtros.estado} valorSemFiltro="todos" aoEscolher={escolherEstado} />
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variante="secundario" onClick={() => mudar(SEM_FILTROS)} disabled={ligados === 0}>
              Limpar filtros
            </Button>
            <Button onClick={() => definirFiltrando(false)}>{rotuloDeVerDocumentos(visiveis.length, artefatos.hasNextPage)}</Button>
          </div>
        </Dialog>
      )}
    </Page>
  )
}
