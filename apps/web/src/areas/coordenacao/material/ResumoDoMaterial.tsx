import type { Disciplina, Material, ResumoDoMaterialResponse, Serie } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { errorMessage } from '../../../api/client'
import { disciplinasQueryOptions, seriesQueryOptions } from '../../../api/estrutura'
import { Button } from '../../../components/ui/Button'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { LoadingState } from '../../../components/states/index'
import { formatNumber } from '../../../format'
import { RESUMO_DO_MATERIAL_QUERY_KEY, resumoDoMaterialQueryOptions } from './api/resumo'
import { assinaturaDosEstados, avisoDaMigracao, linhasDoResumo, resumoFicouParaTras, type MaterialResumoRow } from './resumo-do-material'

const COLUNAS: readonly [TableColumn<MaterialResumoRow>, ...TableColumn<MaterialResumoRow>[]] = [
  { chave: 'disciplina', titulo: 'Disciplina', celula: (linha) => linha.disciplina },
  { chave: 'serie', titulo: 'Série', celula: (linha) => linha.serie },
  { chave: 'pronto', titulo: 'Prontos', alinhamento: 'fim', celula: (linha) => formatNumber(linha.pronto) },
  { chave: 'processando', titulo: 'Processando', alinhamento: 'fim', celula: (linha) => formatNumber(linha.processando) },
  { chave: 'falhou', titulo: 'Com falha', alinhamento: 'fim', celula: (linha) => formatNumber(linha.falhou) },
  { chave: 'recusados', titulo: 'Recusados em 30 dias', alinhamento: 'fim', celula: (linha) => formatNumber(linha.recusados30Dias) },
]

interface Props {
  /** A lista de materiais que a aba já leu: serve ao aviso das séries da migração (sem ela, ainda lendo, o aviso depende só do `semSerie`) e ao momento de reler o resumo (`useRelerOResumoQuandoUmEstadoMuda`). */
  readonly materiais: readonly Pick<Material, 'id' | 'estado' | 'serieIds'>[] | undefined
}

/** O nome do botão do resumo: distinto do "Tentar de novo" da lista, para a pessoa que usa leitor de tela ouvir dois botões diferentes quando as duas leituras caem juntas. */
const TENTAR_DE_NOVO_O_RESUMO = 'Tentar de novo o resumo'

/**
 * O erro do resumo, com o botão `secundario` e o nome próprio (`TENTAR_DE_NOVO_O_RESUMO`): o `primario` da tela é um só, o "Enviar material", e o `ErrorState` da casca só tem o botão primário "Tentar de novo". Serve à releitura que
 * falhou, ao lado do resumo que já está na tela (o número de antes fica), e ao erro de quando ainda não há nada na tela.
 */
function ErroDoResumo({ erro, tentando, aoTentarDeNovo }: { readonly erro: unknown; readonly tentando: boolean; readonly aoTentarDeNovo: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-cartao border border-erro bg-erro-cx p-4">
      <p role="alert" className="min-w-0 flex-1 basis-56 break-words text-erro">
        {errorMessage(erro)}
      </p>
      <Button variante="secundario" onClick={aoTentarDeNovo}>
        {TENTAR_DE_NOVO_O_RESUMO}
      </Button>
      <span role="status" className="text-erro">
        {tentando ? 'Tentando de novo…' : ''}
      </span>
    </div>
  )
}

interface PropsDoCorpo {
  readonly resumo: ResumoDoMaterialResponse
  readonly disciplinas: readonly Disciplina[]
  readonly series: readonly Serie[]
  readonly materiais: Props['materiais']
  readonly releituraFalhou: boolean
  readonly erro: unknown
  readonly tentando: boolean
  readonly aoTentarDeNovo: () => void
}

/** O resumo lido: a releitura que caiu, o aviso da migração e a tabela, ou o vazio quando não há nada a contar. */
function CorpoDoResumo({ resumo, disciplinas, series, materiais, releituraFalhou, erro, tentando, aoTentarDeNovo }: PropsDoCorpo) {
  const aviso = avisoDaMigracao(resumo, materiais, series)
  return (
    <>
      {releituraFalhou && <ErroDoResumo erro={erro} tentando={tentando} aoTentarDeNovo={aoTentarDeNovo} />}
      {aviso !== undefined && (
        <p role="note" className="t-apoio rounded-cartao border-2 border-borda bg-superficie p-4 break-words text-tinta">
          {aviso}
        </p>
      )}
      {resumo.linhas.length > 0 && <Table rotulo="Resumo do material por disciplina e série" colunas={COLUNAS} linhas={linhasDoResumo(resumo, disciplinas, series)} chaveDaLinha={(linha) => linha.chave} />}
      {resumo.linhas.length === 0 && !releituraFalhou && (
        <p className="t-apoio rounded-cartao border-2 border-borda bg-superficie p-4 text-apoio">Ainda não há material para resumir. Quando a escola enviar o primeiro PDF, os números aparecem aqui.</p>
      )}
    </>
  )
}

/** As três leituras que o resumo precisa (as contagens e os nomes de disciplina e de série) e o que a tela pergunta sobre elas: se alguma ainda não chegou, se alguma está lendo, e qual falhou. */
function useLeituraDoResumo() {
  const resumo = useQuery(resumoDoMaterialQueryOptions)
  const disciplinas = useQuery(disciplinasQueryOptions)
  const series = useQuery(seriesQueryOptions)
  const leituras = [resumo, disciplinas, series]
  return {
    resumo,
    disciplinas,
    series,
    tentando: leituras.some((leitura) => leitura.isFetching),
    pendente: leituras.some((leitura) => leitura.isPending),
    erro: leituras.find((leitura) => leitura.isError)?.error,
    tentarDeNovo: (): void => {
      for (const leitura of leituras) void leitura.refetch({ cancelRefetch: false })
    },
  }
}

/**
 * Relê o resumo **só quando a lista lida mostra que um estado mudou** (a assinatura `id:estado` de todos os materiais), e não num laço próprio (regra 80, itens 1 e 10). Uma leitura por mudança. A primeira lista lida não relê,
 * a não ser que o resumo já lido conte material `processando` que a lista, mais nova, não tem mais (`resumoFicouParaTras`). Essa conferência também roda **quando o resumo chega**: a lista que chega antes dele (ele é a leitura mais
 * pesada) já não pode pedir nada, e o resumo que chega depois, contando `processando`, ficaria assim para sempre. O resumo lido entra pela referência dele, que o TanStack mantém quando a leitura nova é igual: o resumo relido que
 * ainda conta `processando` não roda o efeito de novo, e não há laço. A invalidação cancela a leitura em curso e começa outra (o padrão do TanStack), que é a única por mudança de estado.
 */
function useRelerOResumoQuandoUmEstadoMuda(materiais: Props['materiais'], resumoLido: ResumoDoMaterialResponse | undefined): void {
  const cliente = useQueryClient()
  const anterior = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (materiais === undefined) return
    const assinatura = assinaturaDosEstados(materiais)
    const mudou = anterior.current !== undefined && anterior.current !== assinatura
    const atrasado = resumoFicouParaTras(resumoLido, materiais)
    anterior.current = assinatura
    if (mudou || atrasado) void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
  }, [materiais, resumoLido, cliente])
}

/**
 * O resumo no topo da aba Material (ingestao-do-material, 11.0; RF18; `docs/interface.md` 3): por disciplina e série, quantos materiais estão prontos, processando e com falha, quantos envios foram recusados por licença
 * nos últimos 30 dias, e o aviso das séries atribuídas na migração. **Tabela no computador, lista no celular** (`Table`). Só contagens: nenhum título, licenciante nem autor.
 *
 * Os quatro estados, e **o vazio só com a leitura terminada**: carregando o resumo, as disciplinas e as séries (que dão o nome às linhas); erro com "Tentar de novo o resumo"; vazio, quando a escola não tem material nem recusa
 * a contar; e com dado. Se o resumo já está na tela e a releitura falha, o erro vem ao lado dele, e o que está na tela fica: o número de antes não vira "nada".
 * O resumo não tem laço próprio: relê quando a lista mostra que um estado mudou (`useRelerOResumoQuandoUmEstadoMuda`).
 */
export function ResumoDoMaterial({ materiais }: Props) {
  const leitura = useLeituraDoResumo()
  useRelerOResumoQuandoUmEstadoMuda(materiais, leitura.resumo.data)
  const { resumo, disciplinas, series } = leitura
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="resumo-do-material">
      <h2 id="resumo-do-material" className="text-lg font-semibold text-tinta">
        Resumo do material
      </h2>
      {resumo.data !== undefined && disciplinas.data !== undefined && series.data !== undefined ? (
        <CorpoDoResumo
          resumo={resumo.data}
          disciplinas={disciplinas.data.itens}
          series={series.data.itens}
          materiais={materiais}
          releituraFalhou={resumo.isError}
          erro={resumo.error}
          tentando={leitura.tentando}
          aoTentarDeNovo={leitura.tentarDeNovo}
        />
      ) : leitura.pendente ? (
        <LoadingState rotulo="Carregando o resumo…" />
      ) : (
        <ErroDoResumo erro={leitura.erro} tentando={leitura.tentando} aoTentarDeNovo={leitura.tentarDeNovo} />
      )}
    </section>
  )
}
