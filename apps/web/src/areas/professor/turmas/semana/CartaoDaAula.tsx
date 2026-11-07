import type { AulaDaSemana } from '@educa/shared'
import { useId } from 'react'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import { chaveDaAula, descricaoDaAula, faltaPreencher, horarioDaAula, nomeDaAula } from './semana'

interface Props {
  readonly aula: AulaDaSemana
  /** A data da aula, `AAAA-MM-DD`. */
  readonly data: string
  readonly hoje: string
  /** É a aula de hoje que está no ar agora (o `agora` do fuso da escola). */
  readonly emAndamento: boolean
  readonly aoAbrir: () => void
}

/**
 * Uma aula da professora no dia (RF1, RF5, RF6): botão que abre a aula. O **nome acessível é só "Terça, 7h30, 7ºA, Matemática"**; o resto
 * (o fim, a sala, o texto, o que falta) é a descrição, lida depois dele.
 *
 * - **O texto em duas linhas** (`line-clamp-2`), ou o selo neutro "Falta preencher" na aula de hoje ou futura sem texto (D59: o selo
 *   lembra e não cobra; cinza, sem total em lugar nenhum — D64). A aula passada sem texto não leva selo.
 * - **Estado nunca é só cor** (regra 50, item 11): "Agora" e "Fora da grade" são texto.
 * - **O texto é da professora**: aparece aqui só para ela, e nunca vai a log nem a endereço (regra 20, item 9).
 */
export function CartaoDaAula({ aula, data, hoje, emAndamento, aoAbrir }: Props) {
  const idDaDescricao = useId()
  const falta = faltaPreencher(data, hoje, aula)
  const descricao = descricaoDaAula(data, hoje, emAndamento, aula)
  return (
    <>
      <button
        type="button"
        aria-label={nomeDaAula(data, aula)}
        aria-describedby={idDaDescricao}
        data-aula={chaveDaAula(aula.vinculoId, data, aula.inicio)}
        onClick={aoAbrir}
        className={`flex w-full min-w-0 flex-col items-start gap-1 rounded-controle border-2 p-3 text-left hover:bg-fundo-suave ${emAndamento ? 'border-azul-borda bg-azul-claro' : 'border-borda bg-superficie'}`}
      >
        <span aria-hidden="true" className="t-selo text-apoio">
          {horarioDaAula(aula)}
        </span>
        <span aria-hidden="true" className="min-w-0 text-sm font-bold break-words text-tinta">
          {aula.turma}
        </span>
        <span aria-hidden="true" className="min-w-0 text-sm break-words text-tinta">
          {aula.disciplina}
        </span>
        {aula.sala !== null && (
          <span aria-hidden="true" className="min-w-0 text-xs break-words text-apoio">
            Sala {aula.sala}
          </span>
        )}
        {(emAndamento || aula.foraDaGrade) && (
          <span aria-hidden="true" className="flex flex-wrap gap-1">
            {emAndamento && <StatusBadge familia="info">Agora</StatusBadge>}
            {aula.foraDaGrade && <StatusBadge familia="info">Fora da grade</StatusBadge>}
          </span>
        )}
        {aula.texto !== null && (
          <span aria-hidden="true" data-texto-da-aula="" className="line-clamp-2 min-w-0 text-sm break-words text-apoio">
            {aula.texto}
          </span>
        )}
        {falta && (
          <span aria-hidden="true">
            <StatusBadge familia="info">Falta preencher</StatusBadge>
          </span>
        )}
      </button>
      <span id={idDaDescricao} className="sr-only">
        {descricao}
      </span>
    </>
  )
}
