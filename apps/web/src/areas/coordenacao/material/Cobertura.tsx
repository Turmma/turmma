import { nomeDaSerie, nomeDoGrupoDaCobertura, type CoberturaResponse, type Serie } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { aoTrocarDeSessao } from '../../../api/sessao'
import { seriesQueryOptions } from '../../../api/estrutura'
import { EmptyState, ErrorState, LoadingState } from '../../../components/states/index'
import { Alert } from '../../../components/ui/Alert'
import { Select } from '../../../components/ui/fields/Select'
import { coberturaQueryOptions } from './api/cobertura'
import { quantasSecoesSemClassificacao, textoDasHabilidadesSemMaterial } from './cobertura'

const AVISO_DA_SUSPENSAO = 'A classificação pela IA está suspensa na escola. Valem só as habilidades corrigidas pela coordenação.'
const AVISO_DAS_SECOES_SEM_CLASSIFICACAO = 'Enquanto houver capítulos sem classificação, a lista pode trazer habilidades que o material já cobre.'

/** As séries na ordem em que a escola as lê: o Fundamental antes do Médio, e o ano dentro da etapa. */
function seriesEmOrdem(series: readonly Serie[]): Serie[] {
  return [...series].sort((a, b) => (a.etapa === b.etapa ? a.ano - b.ano : a.etapa === 'ef_anos_finais' ? -1 : 1))
}

/** As habilidades de um grupo que nenhum material cobre, uma por linha: o código e o texto da BNCC. */
function HabilidadesSemMaterial({ habilidades }: { readonly habilidades: CoberturaResponse['grupos'][number]['semMaterial'] }) {
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {habilidades.map((habilidade) => (
        <li key={habilidade.codigo} className="flex min-w-0 flex-col gap-0.5 border-t border-borda pt-2 sm:flex-row sm:gap-3">
          <span className="shrink-0 font-semibold text-tinta">{habilidade.codigo}</span>
          <span className="min-w-0 break-words text-apoio">{habilidade.descricao}</span>
        </li>
      ))}
    </ul>
  )
}

function GrupoDaCobertura({ grupo, etapa }: { readonly grupo: CoberturaResponse['grupos'][number]; readonly etapa: CoberturaResponse['etapa'] }) {
  const nome = nomeDoGrupoDaCobertura(grupo.chave, etapa)
  const pendentes = quantasSecoesSemClassificacao(grupo.secoesSemClassificacao)
  return (
    <section aria-label={`${etapa === 'em' ? 'Área' : 'Componente'}: ${nome}`} className="flex min-w-0 flex-col gap-2 rounded-cartao border-2 border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold break-words text-tinta">{nome}</h3>
        <p className="t-apoio text-apoio">{textoDasHabilidadesSemMaterial(grupo.semMaterial.length, grupo.total)}</p>
      </div>
      {pendentes !== null && <p className="t-apoio text-apoio">{pendentes}</p>}
      {grupo.semMaterial.length > 0 && <HabilidadesSemMaterial habilidades={grupo.semMaterial} />}
    </section>
  )
}

function CoberturaDaSerie({ serieId }: { readonly serieId: string }) {
  const cobertura = useQuery(coberturaQueryOptions(serieId))
  const dados = cobertura.data
  if (cobertura.isPending) return <LoadingState rotulo="Carregando a cobertura…" />
  if (dados === undefined) return <ErrorState erro={cobertura.error} tentando={cobertura.isFetching} aoTentarDeNovo={() => void cobertura.refetch({ cancelRefetch: false })} />
  if (dados.materiaisEmUso === 0) {
    return <EmptyState titulo="Nenhum material desta série ainda" descricao="Envie material desta série para ver a cobertura. Enquanto não houver, todas as habilidades da série estão sem material." />
  }
  const faltaClassificar = dados.grupos.some((grupo) => grupo.secoesSemClassificacao > 0)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {dados.classificacaoSuspensa && <Alert tom="atencao">{AVISO_DA_SUSPENSAO}</Alert>}
      {faltaClassificar && <Alert tom="info">{AVISO_DAS_SECOES_SEM_CLASSIFICACAO}</Alert>}
      {dados.grupos.map((grupo) => (
        <GrupoDaCobertura key={grupo.chave} grupo={grupo} etapa={dados.etapa} />
      ))}
    </div>
  )
}

/**
 * Escola › Material › Cobertura (classificacao-bncc, 13.0; RF19; `docs/interface.md` 3): a coordenação escolhe a série e vê, por componente (por área, no Ensino Médio), as habilidades da BNCC que nenhum material em uso
 * cobre, e quantos capítulos ainda estão sem classificação. Só leitura: a tela não classifica nem corrige nada (isso é do painel do material), e o professor não a vê (RF20).
 *
 * - **A série é escolhida na tela e não vai ao endereço**: ela some com a sessão (`aoTrocarDeSessao`), e a pessoa seguinte do mesmo computador começa sem série escolhida. Cada série é uma consulta, com a chave dela: a resposta
 *   atrasada de uma série não cai na tela de outra.
 * - **Não tem laço de releitura** (regra 80, item 10): relê-se ao escolher a série e em "Tentar de novo". A classificação roda à noite.
 *
 * Os quatro estados: carregando; erro com "Tentar de novo"; vazio (a escola sem material da série, que convida a enviar); e com dado.
 */
export function Cobertura() {
  const series = useQuery(seriesQueryOptions)
  const [serieId, definirSerieId] = useState('')
  useEffect(() => aoTrocarDeSessao(() => definirSerieId('')), [])

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Cobertura da BNCC">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Cobertura da BNCC por série</h2>
        <p className="t-apoio max-w-prose text-apoio">As habilidades da BNCC da série que nenhum material em uso cobre, por componente (por área, no Ensino Médio). Os capítulos são classificados pela IA, e a coordenação corrige a classificação em Material.</p>
      </div>
      {series.isPending ? (
        <LoadingState rotulo="Carregando as séries…" />
      ) : series.data === undefined ? (
        <ErrorState erro={series.error} tentando={series.isFetching} aoTentarDeNovo={() => void series.refetch({ cancelRefetch: false })} />
      ) : series.data.itens.length === 0 ? (
        <EmptyState titulo="Nenhuma série ainda" descricao="Cadastre as séries da escola em Escola, e envie material para elas, para ver a cobertura." />
      ) : (
        <>
          <div className="max-w-sm">
            <Select
              rotulo="Série"
              marcador="Escolha a série"
              valor={serieId}
              aoMudar={definirSerieId}
              opcoes={seriesEmOrdem(series.data.itens).map((serie) => ({ valor: serie.id, rotulo: nomeDaSerie(serie) }))}
            />
          </div>
          {serieId === '' ? <p className="t-apoio text-apoio">Escolha uma série para ver as habilidades que ainda não têm material.</p> : <CoberturaDaSerie key={serieId} serieId={serieId} />}
        </>
      )}
    </section>
  )
}
