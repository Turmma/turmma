import { useEffect, useState } from 'react'

/**
 * O movimento da onça de corpo inteiro que o JavaScript decide: o acenar da primeira vez (`Onca.css` faz o resto). Não há
 * temporizador: o piscar por temporizador foi vetado (parecer do `conformidade-reviewer`, D59). É o **único arquivo** da pasta
 * com efeito e estado (`Onca.test.tsx` reprova os outros), e nada aqui liga com "reduzir movimento": o navegador diz.
 */

/**
 * "Já acenou" mora na **memória da página**, e não no `sessionStorage`: a introdução e a aparência não deixam nada no navegador
 * além da aparência, da lateral recolhida e da letra do aluno (RF24 da X1; `e2e/aparencia.spec.ts` e os `*-introducao.spec.ts`
 * conferem), e quem entra depois no mesmo computador não herda uma marca, mesmo sem pessoa. A página recarregada é uma sessão
 * nova, e a onça acena de novo uma vez. Sair da conta sem recarregar não zera a marca: quem entra depois na mesma aba não vê o
 * aceno, o que não é dado pessoal e é o que o `sessionStorage` antigo também fazia.
 */
let jaAcenou = false

/** Só para os testes: volta ao começo de uma página recém-aberta. */
export function esquecerQueAcenou(): void {
  jaAcenou = false
}

export function reduzMovimento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * `acenando` acena uma vez só por sessão da página: a primeira onça que aparece. As seguintes ficam paradas. A leitura é na montagem, e a
 * marca de "já acenou" é guardada na memória da página logo depois, num efeito: sem estado mudado dentro do efeito.
 */
export function useAcenarNaPrimeiraVez(acenando: boolean): boolean {
  const [acena] = useState(() => acenando && !reduzMovimento() && !jaAcenou)
  useEffect(() => {
    if (acena) jaAcenou = true
  }, [acena])
  return acena
}
