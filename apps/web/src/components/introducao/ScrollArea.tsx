import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Falta menos que isto (em px) para o fim da região: já se leu tudo. */
const FOLGA_DO_FIM = 4

interface PropsDaRegiaoQueRola {
  /** O nome da região para o leitor de tela. Quem lê com teclado a alcança pelo Tab (`scrollable-region-focusable`). */
  readonly nome: string
  /** A altura máxima, como classe literal do Tailwind (ele só gera a classe que acha escrita por inteiro): `max-h-[28dvh]`. */
  readonly alturaMaxima: string
  readonly children: ReactNode
}

/**
 * A região que rola dentro de uma tela de foco (telas do aluno e primeiro acesso, 9.0 e 10.0; RF20): **só o miolo rola**, e o
 * "Continuar" fica à vista em 1366 × 768. **Enquanto há o que ler abaixo, uma faixa com "Role para ler mais" cobre o pé da
 * região**: sem ela a pessoa veria um pedaço e acharia que acabou. Chegando ao fim, ou quando tudo cabe, a faixa sai.
 *
 * "Há mais" vem da medida da região, na montagem, ao rolar e quando ela muda de tamanho. **Sem medida** (altura zero: o ambiente
 * não desenha) vale "há mais", o lado de quem avisa a mais. (A guarda de cor da web não aceita degradê com transparência nem
 * modificador de opacidade: a faixa é de cor cheia.)
 */
export function ScrollArea({ nome, alturaMaxima, children }: PropsDaRegiaoQueRola) {
  const regiao = useRef<HTMLDivElement>(null)
  const [haMais, definirHaMais] = useState(true)

  const medir = useCallback((): void => {
    const medida = regiao.current
    if (medida === null || medida.clientHeight === 0) return
    definirHaMais(medida.scrollTop + medida.clientHeight < medida.scrollHeight - FOLGA_DO_FIM)
  }, [])

  useEffect(() => {
    medir()
    const medida = regiao.current
    if (medida === null || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(medida)
    return () => observador.disconnect()
  }, [medir])

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={regiao}
        role="region"
        aria-label={nome}
        tabIndex={0}
        onScroll={medir}
        className={`flex ${alturaMaxima} w-full min-w-0 flex-col gap-4 overflow-y-auto rounded-controle border-2 border-borda p-4 text-left`}
      >
        {children}
      </div>
      {haMais && (
        <div aria-hidden="true" data-mais-abaixo="" className="pointer-events-none absolute inset-x-[2px] bottom-[2px] flex h-9 items-center justify-center rounded-b-controle border-t-2 border-borda bg-fundo">
          <span className="t-apoio text-sutil">Role para ler mais</span>
        </div>
      )}
    </div>
  )
}
