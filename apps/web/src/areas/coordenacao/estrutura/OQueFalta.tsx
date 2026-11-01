import { useId } from 'react'
import { Link } from 'wouter'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import type { PassoDoRoteiro } from './o-que-falta-da-escola'

/**
 * O roteiro da escola e o painel "O que falta" (telas da coordenação, 5.0; RF12): os sete passos de `o-que-falta-da-escola.ts`,
 * com o estado de cada um em texto. Sem a onça: ela é decisão do Joaquim (Tech Spec, seção 12). A lista de nomes continua sem
 * marca, de propósito (regra 20, item 10): saber se uma turma tem lista seria ler a lista dela.
 */

export function Roteiro({ passos, titulo }: { passos: readonly PassoDoRoteiro[]; titulo: string }) {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="rounded-cartao border border-linha bg-superficie p-4">
      <h2 id={idDoTitulo} className="font-semibold text-tinta">
        {titulo}
      </h2>
      <ol className="mt-3 flex flex-col gap-2">
        {passos.map((passo, posicao) => (
          <li key={passo.titulo} className="flex min-w-0 gap-3">
            <span className="w-6 shrink-0 text-right text-sutil tabular-nums">{posicao + 1}.</span>
            <span className="min-w-0 break-words">
              <span className="font-medium text-tinta">{passo.titulo}</span>
              {/* O estado em texto, e não só em cor (regra 50, item 11). */}
              {passo.feito !== undefined && <span className={passo.feito ? 'text-ok' : 'text-pendente'}>{passo.feito ? ' · feito' : ' · falta'}</span>}
              <span className="block text-sm text-apoio">
                {passo.texto}
                {passo.link !== undefined && (
                  <>
                    {' '}
                    <Link className="text-caramelo-texto underline" to={passo.link.para}>
                      {passo.link.rotulo}
                    </Link>
                    .
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** O painel `?painel=falta`: o roteiro todo, com o que está feito e o que falta. */
export function PainelDoQueFalta({
  passos,
  aoFechar,
  focoDeReserva,
}: {
  readonly passos: readonly PassoDoRoteiro[]
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}) {
  return (
    <Sheet titulo="O que falta" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <Roteiro titulo="O que falta para a escola começar" passos={passos} />
    </Sheet>
  )
}
