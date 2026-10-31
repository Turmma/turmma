import type { Ref } from 'react'

interface PropsDoBalao {
  /** A fala do passo. É o `h1` da tela: o leitor de tela começa por ela. */
  readonly fala: string
  /** Para a introdução levar o foco à fala a cada passo (`tabIndex={-1}`: só o código o foca, o Tab não passa por ele). */
  readonly refDaFala?: Ref<HTMLHeadingElement>
  /** O `id` do que descreve a fala ("Passo 2 de 4"), lido logo depois dela. */
  readonly descritoPor?: string
}

/**
 * O balão da fala da onça (mockup 2.8): a fala do passo em `t-balao`, dentro de uma caixa. **A fala é o `h1`.** O texto é
 * fixo, escrito em `.ts` com teste, e fala em nome da função: nunca afirma ser pessoa nem promete voltar (D58, D59).
 */
export function Balao({ fala, refDaFala, descritoPor }: PropsDoBalao) {
  return (
    <div data-balao="" className="w-full min-w-0 rounded-caixa border-2 border-borda bg-superficie px-4 py-3">
      <h1 ref={refDaFala} tabIndex={-1} aria-describedby={descritoPor} className="t-balao min-w-0 break-words text-tinta">
        {fala}
      </h1>
    </div>
  )
}
