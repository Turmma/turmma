import type { AulaDaSemana, DiaDaSemana as Dia } from '@educa/shared'
import { useId } from 'react'
import { CartaoDaAula } from './CartaoDaAula'
import { ItensDoDia } from './ItensDoDia'
import { diaEMes, emAndamento, nomeDoDia, rotuloDoEvento } from './semana'

interface Props {
  readonly dia: Dia
  readonly hoje: string
  readonly agora: string
  readonly aoAbrirAula: (aula: AulaDaSemana, data: string) => void
}

/**
 * Um dia da semana (RF1, RF3): o nome e a data, o evento ou feriado que cai nele e os cartões das aulas em ordem de horário (a API já as
 * entrega ordenadas; não há régua de horas, que dependeria da métrica da fonte, D72). **Feriado e recesso** mostram o tipo e a descrição, e a API
 * não manda aula nesses dias; **evento** aparece junto das aulas, sem tirar nenhuma. Hoje é texto ("Hoje"), e não só o destaque.
 * Embaixo das aulas vêm os itens do dia (RF7, `ItensDoDia`): o que aconteceu ali na turma e na disciplina dela, também no dia sem aula.
 */
export function DiaDaSemana({ dia, hoje, agora, aoAbrirAula }: Props) {
  const idDoTitulo = useId()
  const ehHoje = dia.data === hoje
  return (
    <section aria-labelledby={idDoTitulo} data-dia={dia.data} className={`flex min-w-0 flex-col gap-2 rounded-cartao border-2 p-2 ${ehHoje ? 'border-azul-borda' : 'border-borda'}`}>
      <h3 id={idDoTitulo} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-tinta">
        <span className="t-cartao">{nomeDoDia(dia.data)}</span>{' '}
        <span className="text-sm text-apoio">{diaEMes(dia.data)}</span>
        {ehHoje && (
          <>
            {' '}
            <span className="t-selo text-azul-texto">Hoje</span>
          </>
        )}
      </h3>
      {dia.eventos.length > 0 && (
        <ul className="flex flex-col gap-1">
          {dia.eventos.map((evento) => (
            <li key={`${evento.tipo}-${evento.descricao}`} className="min-w-0 rounded-linha bg-fundo-suave p-2 text-sm break-words text-tinta">
              <span className="font-bold">{rotuloDoEvento(evento.tipo)}</span> · {evento.descricao}
            </li>
          ))}
        </ul>
      )}
      {dia.aulas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {dia.aulas.map((aula) => (
            <li key={`${aula.vinculoId}-${aula.inicio}`} className="min-w-0">
              <CartaoDaAula aula={aula} data={dia.data} hoje={hoje} emAndamento={emAndamento(dia.data, hoje, agora, aula)} aoAbrir={() => aoAbrirAula(aula, dia.data)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-sutil">Sem aulas</p>
      )}
      {dia.itens.length > 0 && <ItensDoDia itens={dia.itens} />}
    </section>
  )
}
