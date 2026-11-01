import type { PainelQuery, UsoDoPainelResponse, UsoDaEscolaDoPainel, UsoDoPeriodoDoPainel } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { useLocation, useSearch } from 'wouter'
import { LoadingState, EmptyState } from '../../components/states'
import { MEDIA_MD, useMediaQuery } from '../../components/ui/media-query'
import { formatQuantity } from '../../format'
import { buscaDaConsulta, doUsoQueryOptions, lerConsultaDaTela, paginasDoTotal } from '../api/painel'
import { INICIO_DA_OPERACAO, USO_DA_OPERACAO } from '../paths'
import { ErroDaOperacao } from '../components/CascaDaOperacao'
import { Pagination, SortSelect, VazioAlemDaUltima } from '../components/NavegacaoDaLista'
import { ScrollableList, useOverflow } from '../components/ScrollableList'
import { formatarDia, formatarMedidaDoUso, formatarMesDeReferencia, MEDIDAS_DO_USO, ROTULO_DO_USO } from '../format'
import { TEXTO_DO_USO_VAZIO } from '../textos'
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
  return periodo === 'dia' ? `Dia ${formatarDia(referencia.dia)}` : `Mês: ${formatarMesDeReferencia(referencia)}`
}

/** O rótulo da medida no começo de uma linha ou de uma coluna: "requisições" vira "Requisições". */
function comoTitulo(rotulo: string): string {
  return rotulo.charAt(0).toLocaleUpperCase('pt-BR') + rotulo.slice(1)
}

/** Um valor da medida, inteiro na linha: "1.234" e "1,2 GB" nunca quebram no meio (RF23, 14.4). */
function Valor({ medida, valor }: { medida: keyof UsoDoPeriodoDoPainel; valor: number }) {
  return <span className="whitespace-nowrap">{formatarMedidaDoUso(medida, valor)}</span>
}

/**
 * Computador: a tabela, com a escola como cabeçalho da linha e os dois períodos como grupos de três colunas, com o dia e o
 * mês de referência no cabeçalho de cada grupo. Na pele do produto (D80): moldura de 2 px de canto 16, cabeçalho de 44 px e
 * linha de 64. A tabela que passa da largura **rola dentro da própria moldura**, que aí — e só aí — recebe foco.
 */
function TabelaDoUso({ escolas, referencia }: { escolas: readonly UsoDaEscolaDoPainel[]; referencia: Referencia }) {
  const moldura = useRef<HTMLDivElement>(null)
  const sobra = useOverflow(moldura, 'x')
  return (
    <div
      ref={moldura}
      {...(sobra ? { role: 'region', 'aria-label': 'Medidas de cada escola', tabIndex: 0 } : {})}
      className="min-w-0 overflow-x-auto rounded-cartao border-2 border-borda"
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Uso de cada escola, no último dia fechado e no mês: requisições, tarefas em segundo plano e armazenamento</caption>
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
          </tr>
        </thead>
        <tbody>
          {escolas.map((escola) => (
            <tr key={escola.id} className="h-16 border-b-2 border-borda last:border-b-0">
              <th scope="row" className="t-apoio min-w-52 px-4 py-3 text-left font-bold wrap-anywhere text-tinta">
                {escola.nome}
              </th>
              {PERIODOS.flatMap((periodo) =>
                MEDIDAS_DO_USO.map((medida, posicao) => (
                  <td key={`${periodo}-${medida}`} className={`t-apoio px-4 py-3 text-right tabular-nums text-tinta ${periodo === 'mes' && posicao === 0 ? 'border-l-2 border-borda' : ''}`}>
                    <Valor medida={medida} valor={escola[periodo][medida]} />
                  </td>
                )),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Celular: um cartão por escola, com o dia e o mês empilhados, cada medida numa linha, sem rolagem horizontal a 360 px. */
function Cartoes({ escolas, referencia }: { escolas: readonly UsoDaEscolaDoPainel[]; referencia: Referencia }) {
  return (
    <ul aria-label="Uso de cada escola" className="flex min-w-0 flex-col gap-3">
      {escolas.map((escola) => (
        <li key={escola.id} className="min-w-0 rounded-cartao border-2 border-borda bg-superficie p-4">
          <h2 className="t-cartao break-words text-tinta">{escola.nome}</h2>
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
        </li>
      ))}
    </ul>
  )
}

/**
 * Uso (`/operacao/uso`; Tech Spec da A0b, seção 9; RF4 e RF5): o uso de infra de cada escola — requisições, tarefas em
 * segundo plano e armazenamento (D30) —, no último dia fechado e no mês dele, lado a lado. **Só número**, por escola,
 * nunca pessoa (D10, D76). As datas são as que a API devolveu: o dia de hoje só entra depois da consolidação, e a escola
 * sem uso consolidado aparece com zero.
 *
 * Custo em reais espera o provedor de hospedagem (D42), e o consumo de IA entra com a A2.
 *
 * Os quatro estados (regra 50, item 5): carregando; erro, com "Tentar de novo" e a tela no lugar; vazio, com o caminho
 * para Escolas; e com dado. A página além da última tem o seu vazio, como em Escolas. A página e a ordem ficam na query
 * string, e a troca mantém a página anterior na tela até a nova chegar.
 */
export function Uso() {
  useOperacaoPageTitle('Uso')
  const busca = useSearch()
  const [, navegar] = useLocation()
  const consulta = lerConsultaDaTela(busca)
  const uso = useQuery(doUsoQueryOptions(consulta))

  function irPara(nova: PainelQuery): void {
    navegar(`${USO_DA_OPERACAO}?${buscaDaConsulta(nova)}`)
  }

  const dados = uso.data
  const paginas = paginasDoTotal(dados?.total ?? 0)
  const trocando = uso.isPlaceholderData
  // Uma estrutura de cada vez no documento: a tabela a partir de 768 px, a lista de cartões abaixo (a `Table` do produto faz o mesmo).
  const larga = useMediaQuery(MEDIA_MD)

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SortSelect ordem={consulta.ordem} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
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
              Último dia fechado: <span className="font-medium text-tinta">{formatarDia(dados.dia)}</span>. Mês:{' '}
              <span className="font-medium text-tinta">{formatarMesDeReferencia(dados)}</span>. O dia de hoje entra na
              madrugada seguinte.
            </p>
            <p className="text-sutil">{formatQuantity(dados.total, 'escola', 'escolas')}</p>
          </div>
          {larga ? <TabelaDoUso escolas={dados.itens} referencia={dados} /> : <Cartoes escolas={dados.itens} referencia={dados} />}
        </ScrollableList>
      )}
    </>
  )
}
