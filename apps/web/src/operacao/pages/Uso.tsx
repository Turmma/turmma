import { ORDENS_DO_USO_DO_PAINEL, type UsoDoPainelQuery, type UsoDoPainelResponse, type UsoDaEscolaDoPainel, type UsoDoPeriodoDoPainel } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useLocation, useSearch } from 'wouter'
import { LoadingState, EmptyState } from '../../components/states'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { MEDIA_MD, useMediaQuery } from '../../components/ui/media-query'
import { useDialogState, type DialogOpening } from '../../components/ui/overlays/dialog-state'
import { formatNumber, formatQuantity } from '../../format'
import { buscaDaConsulta, doUsoQueryOptions, readConsultaDoUso, paginasDoTotal } from '../api/painel'
import { INICIO_DA_OPERACAO, USO_DA_OPERACAO } from '../paths'
import { ErroDaOperacao } from '../components/CascaDaOperacao'
import { DialogoDoOrcamento, type AlvoDoOrcamento } from '../components/DialogoDoOrcamento'
import { MesesDeIa } from '../components/MesesDeIa'
import { Pagination, SortSelect, VazioAlemDaUltima } from '../components/NavegacaoDaLista'
import { ScrollableList, useOverflow } from '../components/ScrollableList'
import { formatDia, formatMedidaDoUso, formatMesDeReferencia, MEDIDAS_DO_USO, ROTULO_DO_USO } from '../format'
import { reais, TEXTO_DO_USO_VAZIO, TEXTO_DOS_DOIS_PERIODOS_DO_USO, TITULO_DO_GRUPO_DE_IA, textoDoCustoPorAluno, textoDoOrcamentoDoMes } from '../textos'
import { useOperacaoPageTitle } from '../document-title'

/** Os dois períodos de cada escola, na ordem da tela: o último dia fechado, e o mês dele até esse dia. */
const PERIODOS = ['dia', 'mes'] as const
type Periodo = (typeof PERIODOS)[number]

type Referencia = Pick<UsoDoPainelResponse, 'dia' | 'mes'>

/**
 * O título de cada período, com a data que **a API** devolveu (nunca a de hoje no navegador): o dia é o último fechado em
 * São Paulo, e o mês vai do dia 1 até ele (Tech Spec da A0b, seção 5).
 */
function tituloDoPeriodo(periodo: Periodo, referencia: Referencia): string {
  return periodo === 'dia' ? `Dia ${formatDia(referencia.dia)}` : `Mês: ${formatMesDeReferencia(referencia)}`
}

/** O rótulo da medida no começo de uma linha ou de uma coluna: "requisições" vira "Requisições". */
function comoTitulo(rotulo: string): string {
  return rotulo.charAt(0).toLocaleUpperCase('pt-BR') + rotulo.slice(1)
}

/** Um valor da medida, inteiro na linha: "1.234" e "1,2 GB" nunca quebram no meio (RF23, 14.4). */
function Valor({ medida, valor }: { medida: keyof UsoDoPeriodoDoPainel; valor: number }) {
  return <span className="whitespace-nowrap">{formatMedidaDoUso(medida, valor)}</span>
}

/** Os dois diálogos da aba: o "Orçamento de IA" da escola da linha e os "Meses de IA" dela, cada um com a escola fotografada na abertura. */
type TipoDoDialogo = 'orcamento' | 'meses'
type AoAbrir = (tipo: TipoDoDialogo, escola: UsoDaEscolaDoPainel) => void

/** O atributo que marca o "Ver meses" de cada escola: é por ele que o foco volta à linha quando o botão que abriu o diálogo saiu dela. */
const ATRIBUTO_DO_VER_MESES = 'data-ver-meses'

/**
 * Uma coluna do grupo de IA: o título, que diz o período ("hoje", "no mês"), e a célula. A tabela e o cartão leem a mesma
 * lista, e por isso dizem o mesmo. Tudo é número da API; **a porcentagem não é calculada aqui** (cenário da seção 4): vem pronta, e a
 * única conta da tela é o custo por aluno, o custo do mês dividido pelos alunos ativos (Tech Spec, seção 4).
 */
interface ColunaDeIa {
  readonly chave: string
  readonly titulo: string
  readonly celula: (escola: UsoDaEscolaDoPainel, aoDefinir: (escola: UsoDaEscolaDoPainel) => void) => ReactNode
}

/** "Definir orçamento", na célula sem orçamento: abre o diálogo da escola da linha, e o nome acessível diz de qual (WCAG 2.5.3). */
function DefinirOrcamento({ escola, aoDefinir }: { escola: UsoDaEscolaDoPainel; aoDefinir: (escola: UsoDaEscolaDoPainel) => void }) {
  return (
    <button type="button" onClick={() => aoDefinir(escola)} className={`${SECONDARY_BUTTON_CLASSES} mt-1`}>
      Definir orçamento
      <span className="sr-only"> da escola {escola.nome}</span>
    </button>
  )
}

/** O orçamento da escola em texto (a porcentagem vem da API; nunca só cor), e, sem orçamento definido, a ação para defini-lo. */
function OrcamentoDaLinha({ escola, aoDefinir }: { escola: UsoDaEscolaDoPainel; aoDefinir: (escola: UsoDaEscolaDoPainel) => void }) {
  const { situacao, porcentagem } = escola.ia
  return (
    <>
      <span className="block font-bold wrap-anywhere">{textoDoOrcamentoDoMes(situacao, porcentagem)}</span>
      {situacao === 'sem_orcamento' && <DefinirOrcamento escola={escola} aoDefinir={aoDefinir} />}
    </>
  )
}

const COLUNAS_DE_IA: readonly ColunaDeIa[] = [
  { chave: 'hoje-chamadas', titulo: 'Chamadas hoje', celula: ({ ia }) => <Numero valor={ia.hoje.chamadas} /> },
  { chave: 'hoje-tokens', titulo: 'Tokens hoje', celula: ({ ia }) => <Numero valor={ia.hoje.tokens} /> },
  { chave: 'hoje-reais', titulo: 'Reais hoje', celula: ({ ia }) => <span className="whitespace-nowrap">{reais(ia.hoje.custoMicros)}</span> },
  { chave: 'mes-chamadas', titulo: 'Chamadas no mês', celula: ({ ia }) => <Numero valor={ia.mes.chamadas} /> },
  { chave: 'mes-tokens', titulo: 'Tokens no mês', celula: ({ ia }) => <Numero valor={ia.mes.tokens} /> },
  { chave: 'mes-reais', titulo: 'Reais no mês', celula: ({ ia }) => <span className="whitespace-nowrap">{reais(ia.mes.custoMicros)}</span> },
  {
    chave: 'mes-por-aluno',
    titulo: 'Custo por aluno no mês, contra o valor',
    celula: ({ ia }) => <span className="whitespace-nowrap">{textoDoCustoPorAluno(ia.mes.custoMicros, ia.alunosAtivos, ia.valorPorAlunoMicros)}</span>,
  },
  { chave: 'orcamento', titulo: 'Orçamento do mês', celula: (escola, aoDefinir) => <OrcamentoDaLinha escola={escola} aoDefinir={aoDefinir} /> },
  { chave: 'reserva', titulo: 'Chamadas da reserva no mês', celula: ({ ia }) => <Numero valor={ia.mes.chamadasPeloProvedorDeReserva} /> },
]

/** Um número inteiro da IA, inteiro na linha: "1.234.567" nunca quebra no meio. */
function Numero({ valor }: { valor: number }) {
  return <span className="whitespace-nowrap">{formatNumber(valor)}</span>
}

/** "Ver meses" da escola, junto do nome dela, na tabela e no cartão: abre os 12 meses anteriores. */
function VerMeses({ escola, aoAbrir }: { escola: UsoDaEscolaDoPainel; aoAbrir: AoAbrir }) {
  return (
    <button type="button" {...{ [ATRIBUTO_DO_VER_MESES]: escola.id }} onClick={() => aoAbrir('meses', escola)} className={`${SECONDARY_BUTTON_CLASSES} mt-2`}>
      Ver meses
      <span className="sr-only"> de IA da escola {escola.nome}</span>
    </button>
  )
}

/**
 * Computador: a tabela, com a escola como cabeçalho da linha e os dois períodos como grupos de três colunas, com o dia e o
 * mês de referência no cabeçalho de cada grupo. Na pele do produto (D80): moldura de 2 px de canto 16, cabeçalho de 44 px e
 * linha de 64. A tabela que passa da largura **rola dentro da própria moldura**, que aí — e só aí — recebe foco.
 */
function TabelaDoUso({ escolas, referencia, aoAbrir }: { escolas: readonly UsoDaEscolaDoPainel[]; referencia: Referencia; aoAbrir: AoAbrir }) {
  const moldura = useRef<HTMLDivElement>(null)
  const sobra = useOverflow(moldura, 'x')
  return (
    <div
      ref={moldura}
      {...(sobra ? { role: 'region', 'aria-label': 'Medidas de cada escola', tabIndex: 0 } : {})}
      className="min-w-0 overflow-x-auto rounded-cartao border-2 border-borda"
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Uso de cada escola. Infra, no último dia fechado e no mês: requisições, tarefas em segundo plano e armazenamento. IA, hoje até agora e no mês: chamadas, tokens, reais, custo por aluno contra o valor, orçamento e chamadas da
          reserva
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="t-selo border-b-2 border-borda px-4 text-left align-bottom whitespace-nowrap text-sutil">
              Escola
            </th>
            {PERIODOS.map((periodo) => (
              <th
                key={periodo}
                scope="colgroup"
                colSpan={3}
                className={`t-selo h-11 px-4 text-right whitespace-nowrap text-tinta ${periodo === 'mes' ? 'border-l-2 border-borda' : ''}`}
              >
                {tituloDoPeriodo(periodo, referencia)}
              </th>
            ))}
            <th scope="colgroup" colSpan={COLUNAS_DE_IA.length} className="t-selo h-11 border-l-2 border-borda px-4 text-left whitespace-nowrap text-tinta">
              {TITULO_DO_GRUPO_DE_IA}
            </th>
          </tr>
          <tr className="h-11 border-b-2 border-borda">
            {PERIODOS.flatMap((periodo) =>
              MEDIDAS_DO_USO.map((medida, posicao) => (
                <th
                  key={`${periodo}-${medida}`}
                  scope="col"
                  className={`t-selo px-4 text-right align-bottom text-sutil ${periodo === 'mes' && posicao === 0 ? 'border-l-2 border-borda' : ''}`}
                >
                  {comoTitulo(ROTULO_DO_USO[medida])}
                </th>
              )),
            )}
            {COLUNAS_DE_IA.map((coluna, posicao) => (
              <th key={coluna.chave} scope="col" className={`t-selo px-4 text-right align-bottom text-sutil ${posicao === 0 ? 'border-l-2 border-borda' : ''}`}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {escolas.map((escola) => (
            <tr key={escola.id} className="h-16 border-b-2 border-borda last:border-b-0">
              <th scope="row" className="t-apoio min-w-52 px-4 py-3 text-left font-bold wrap-anywhere text-tinta">
                <span data-nome-da-escola="" className="block">
                  {escola.nome}
                </span>
                <VerMeses escola={escola} aoAbrir={aoAbrir} />
              </th>
              {PERIODOS.flatMap((periodo) =>
                MEDIDAS_DO_USO.map((medida, posicao) => (
                  <td key={`${periodo}-${medida}`} className={`t-apoio px-4 py-3 text-right tabular-nums text-tinta ${periodo === 'mes' && posicao === 0 ? 'border-l-2 border-borda' : ''}`}>
                    <Valor medida={medida} valor={escola[periodo][medida]} />
                  </td>
                )),
              )}
              {COLUNAS_DE_IA.map((coluna, posicao) => (
                <td key={coluna.chave} className={`t-apoio px-4 py-3 text-right tabular-nums text-tinta ${posicao === 0 ? 'border-l-2 border-borda' : ''}`}>
                  {coluna.celula(escola, (alvo) => aoAbrir('orcamento', alvo))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Celular: um cartão por escola, com o dia e o mês empilhados, cada medida numa linha, sem rolagem horizontal a 360 px. */
function Cartoes({ escolas, referencia, aoAbrir }: { escolas: readonly UsoDaEscolaDoPainel[]; referencia: Referencia; aoAbrir: AoAbrir }) {
  return (
    <ul aria-label="Uso de cada escola" className="flex min-w-0 flex-col gap-3">
      {escolas.map((escola) => (
        <li key={escola.id} className="min-w-0 rounded-cartao border-2 border-borda bg-superficie p-4">
          <h2 className="t-cartao break-words text-tinta">{escola.nome}</h2>
          <VerMeses escola={escola} aoAbrir={aoAbrir} />
          {PERIODOS.map((periodo) => (
            <div key={periodo} className={periodo === 'dia' ? 'mt-3' : 'mt-3 border-t-2 border-borda pt-3'}>
              <h3 className="t-selo text-sutil">{tituloDoPeriodo(periodo, referencia)}</h3>
              <dl className="mt-2 flex flex-col gap-2">
                {MEDIDAS_DO_USO.map((medida) => (
                  <div key={medida} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="t-apoio min-w-0 text-sutil">{comoTitulo(ROTULO_DO_USO[medida])}</dt>
                    <dd className="t-apoio min-w-0 text-right font-bold tabular-nums text-tinta">
                      <Valor medida={medida} valor={escola[periodo][medida]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="mt-3 border-t-2 border-borda pt-3">
            <h3 className="t-selo text-sutil">{TITULO_DO_GRUPO_DE_IA}</h3>
            <dl className="mt-2 flex flex-col gap-2">
              {COLUNAS_DE_IA.map((coluna) => (
                <div key={coluna.chave} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="t-apoio min-w-0 text-sutil">{coluna.titulo}</dt>
                  <dd className="t-apoio min-w-0 text-right font-bold tabular-nums text-tinta">{coluna.celula(escola, (alvo) => aoAbrir('orcamento', alvo))}</dd>
                </div>
              ))}
            </dl>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Sobre o que o diálogo age: a própria escola da linha, com a rede e o orçamento que o item do uso trouxe (a aba Escolas monta o mesmo alvo da sua linha). */
function alvoDoOrcamento(escola: UsoDaEscolaDoPainel): AlvoDoOrcamento {
  return { tipo: 'escola', id: escola.id, nome: escola.nome, redeId: escola.rede.id, orcamento: escola.orcamento }
}

type AberturaDoDialogo = DialogOpening<TipoDoDialogo, UsoDaEscolaDoPainel>

interface PropsDosDialogos {
  readonly aberta: AberturaDoDialogo | undefined
  readonly aoFechar: () => void
  /** O orçamento salvo: recebe a abertura em que o pedido saiu, para só ela fechar. */
  readonly aoSalvar: (abertura: AberturaDoDialogo) => void
  readonly focarNaEscola: (escolaId: string) => void
}

/** O diálogo aberto da aba, quando há um: "Orçamento de IA" ou "Meses de IA", sobre a escola da linha que o abriu. */
function DialogosDoUso({ aberta, aoFechar, aoSalvar, focarNaEscola }: PropsDosDialogos) {
  if (aberta?.alvo === undefined) return null
  const escola = aberta.alvo
  if (aberta.tipo === 'meses') return <MesesDeIa key={aberta.numero} escola={escola} aoFechar={aoFechar} focoDeReserva={() => focarNaEscola(escola.id)} />
  return (
    <DialogoDoOrcamento key={aberta.numero} alvo={alvoDoOrcamento(escola)} aoFechar={aoFechar} focoDeReserva={() => focarNaEscola(escola.id)} aoSalvar={() => aoSalvar(aberta)} />
  )
}

/**
 * Uso (`/operacao/uso`; Tech Spec da A0b, seção 9; RF4 e RF5; camada-ia, 8.0, RF11): o uso de infra de cada escola —
 * requisições, tarefas em segundo plano e armazenamento (D30) —, no último dia fechado e no mês dele, e o de IA —
 * chamadas, tokens, reais, custo por aluno contra o valor, porcentagem e o que a reserva atendeu —, hoje até agora e no
 * mês corrente, lado a lado. **Só número**, por escola, nunca pessoa (D10, D76). As datas da infra são as que a API
 * devolveu: o dia de hoje só entra depois da consolidação, e a escola sem uso consolidado aparece com zero. A
 * porcentagem vem da API: nenhuma tela a calcula.
 *
 * Na célula sem orçamento, "Definir orçamento" abre o diálogo da 7.0 com a escola da linha; "Ver meses" abre os 12 meses
 * anteriores dela. A ordem por custo fica na barra, ao lado de nome e uso.
 *
 * Os quatro estados (regra 50, item 5): carregando; erro, com "Tentar de novo" e a tela no lugar (ou "Atualize a página",
 * sem o botão, quando a web não reconhece a resposta); vazio, com o caminho para Escolas; e com dado. A página além da
 * última tem o seu vazio, como em Escolas. A página e a ordem ficam na query string, e a troca mantém a página anterior
 * na tela até a nova chegar.
 */
export function Uso() {
  useOperacaoPageTitle('Uso')
  const busca = useSearch()
  const [, navegar] = useLocation()
  const consulta = readConsultaDoUso(busca)
  const uso = useQuery(doUsoQueryOptions(consulta))
  // O diálogo aberto: um de cada vez, com a escola da linha fotografada na abertura (`dialog-state.ts`).
  const dialogo = useDialogState<TipoDoDialogo, UsoDaEscolaDoPainel>()
  const aberta = dialogo.aberta
  const [anuncio, definirAnuncio] = useState('')
  const regiaoDoAnuncio = useRef<HTMLDivElement>(null)

  /** O foco de volta à escola quando o botão que abriu o diálogo saiu da linha ("Definir orçamento" some com o orçamento salvo): o "Ver meses" dela, ou o anúncio da tela. */
  const focarNaEscola = useCallback((escolaId: string) => {
    const botao = document.querySelector<HTMLElement>(`[${ATRIBUTO_DO_VER_MESES}="${CSS.escape(escolaId)}"]`)
    if (botao) botao.focus()
    else regiaoDoAnuncio.current?.focus()
  }, [])

  function irPara(nova: UsoDoPainelQuery): void {
    navegar(`${USO_DA_OPERACAO}?${buscaDaConsulta(nova)}`)
  }

  const dados = uso.data
  const paginas = paginasDoTotal(dados?.total ?? 0)
  const trocando = uso.isPlaceholderData
  // Uma estrutura de cada vez no documento: a tabela a partir de 768 px, a lista de cartões abaixo (a `Table` do produto faz o mesmo).
  const larga = useMediaQuery(MEDIA_MD)
  const aoAbrir: AoAbrir = (tipo, escola) => dialogo.open(tipo, escola)

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SortSelect ordem={consulta.ordem} ordens={ORDENS_DO_USO_DO_PAINEL} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
      </div>

      <div ref={regiaoDoAnuncio} tabIndex={-1} role="status">
        {anuncio !== '' && <p className="rounded-controle border border-ok bg-ok-cx p-3 text-ok wrap-anywhere">{anuncio}</p>}
      </div>

      {uso.isPending ? (
        <LoadingState rotulo="Carregando o uso das escolas…" />
      ) : uso.isError && dados === undefined ? (
        <ErroDaOperacao erro={uso.error} aoTentarDeNovo={() => void uso.refetch()} tentando={uso.isFetching} />
      ) : dados === undefined || dados.total === 0 ? (
        <EmptyState
          titulo={TEXTO_DO_USO_VAZIO.titulo}
          descricao={TEXTO_DO_USO_VAZIO.descricao}
          acao={{ rotulo: TEXTO_DO_USO_VAZIO.link, aoAcionar: () => navegar(INICIO_DA_OPERACAO) }}
        />
      ) : dados.itens.length === 0 ? (
        <VazioAlemDaUltima paginas={paginas} aoIrParaAPrimeira={() => irPara({ pagina: 1, ordem: consulta.ordem })} />
      ) : (
        <ScrollableList
          rotulo="Uso por escola"
          ocupada={trocando}
          pe={<Pagination rotulo="Páginas do uso" pagina={consulta.pagina} paginas={paginas} trocando={trocando} aoIr={(pagina) => irPara({ pagina, ordem: consulta.ordem })} />}
        >
          {uso.isError && <ErroDaOperacao erro={uso.error} aoTentarDeNovo={() => void uso.refetch()} tentando={uso.isFetching} />}
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-apoio">
              Último dia fechado: <span className="font-medium text-tinta">{formatDia(dados.dia)}</span>. Mês:{' '}
              <span className="font-medium text-tinta">{formatMesDeReferencia(dados)}</span>. O dia de hoje entra na
              madrugada seguinte.
            </p>
            <p className="text-apoio">{TEXTO_DOS_DOIS_PERIODOS_DO_USO}</p>
            <p className="text-sutil">{formatQuantity(dados.total, 'escola', 'escolas')}</p>
          </div>
          {larga ? <TabelaDoUso escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} /> : <Cartoes escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} />}
        </ScrollableList>
      )}
      <DialogosDoUso
        aberta={aberta}
        aoFechar={dialogo.close}
        focarNaEscola={focarNaEscola}
        aoSalvar={(abertura) => {
          definirAnuncio('Orçamento salvo.')
          dialogo.closeSeAinda(abertura)
        }}
      />
    </>
  )
}
