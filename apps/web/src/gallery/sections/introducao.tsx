import { useState } from 'react'
import { Introducao, type PassoDaIntroducao } from '../../components/introducao/Introducao'
import { Comemoracao } from '../../components/ui/Comemoracao'
import { Secao } from '../GallerySection'

/** Os passos de amostra: nome inventado, texto fixo e as duas poses da introdução (a onça termina parada). */
const PASSOS: readonly PassoDaIntroducao[] = [
  { pose: 'acenando', fala: 'Oi, Lia! Eu sou o Tutor, um programa da escola.', obrigatorio: true, conteudo: <p className="t-corpo text-center">Posso errar. Confira no livro.</p> },
  { pose: 'apontando', fala: 'Seus professores veem o que você me pergunta.', obrigatorio: false, conteudo: <p className="t-corpo text-center">Eles acompanham a turma 7ºA.</p> },
  { pose: 'apontando', fala: 'Você pode rever esta introdução quando quiser.', obrigatorio: false },
]

/**
 * A introdução e a comemoração, como o produto as mostra (tarefa 5.0; `docs/interface.md` 9.7; mockup 2.8), com dado
 * inventado. A `Introducao` fica no meio das outras seções e por isso não leva o foco ao abrir. A galeria é o palco
 * da `Comemoracao` até a tarefa aberta a usar: é o único lugar, fora de `Atividade.tsx`, que a importa.
 */
export default function SecoesDaIntroducao() {
  const [revendo, definirRevendo] = useState(false)
  const [ultimo, definirUltimo] = useState('nenhum')
  return (
    <Secao nome="introducao" titulo="Introdução">
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-6" checked={revendo} onChange={(evento) => definirRevendo(evento.target.checked)} />
        <span>Revendo</span>
      </label>
      <div data-introducao-da-galeria="" key={String(revendo)} className="flex min-w-0 flex-col rounded-caixa border-2 border-borda p-4">
        <Introducao
          passos={PASSOS}
          agente="tutor"
          revendo={revendo}
          focarNaAbertura={false}
          aoConcluir={() => definirUltimo('concluiu')}
          aoPular={() => definirUltimo('pulou')}
        />
      </div>
      <p data-ultimo-evento="">Último evento: {ultimo}</p>
      <div data-comemoracao-da-galeria="" className="rounded-caixa border-2 border-borda p-4">
        <Comemoracao agente="tutor">Atividade enviada.</Comemoracao>
      </div>
    </Secao>
  )
}
