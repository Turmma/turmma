import { useId, type ReactNode, type Ref } from 'react'
import type { HeadingLevel } from './Page'

interface CardProps {
  /** Com título, o cartão é uma região com nome (`section` rotulada por ele); sem título, é só a caixa. */
  readonly titulo?: string
  /** O nível do título. Sem ele, 2; dentro de uma seção que já tem `h2`, 3. */
  readonly nivel?: HeadingLevel
  /**
   * O título em si, para quem precisa levar o foco a ele (o cartão que muda de "esperando" para "confirmado" e perde o botão
   * que tinha o foco). Com a ref, o título passa a ser focável por programa (`tabIndex={-1}`), e não entra na ordem do Tab.
   * Sem `titulo` não há título a focar, e a ref é ignorada.
   */
  readonly refDoTitulo?: Ref<HTMLHeadingElement>
  /** Uma ação à direita do título. */
  readonly acao?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/**
 * O cartão do produto (`docs/interface.md` 9.3 e 10.2): **borda de 2 px em `borda`, sem sombra e sem degrau**, canto de
 * 16 px, 16 px por dentro e 20 px a partir de 1024 px. O cartão de leitura não é botão: o degrau é a marca de que a peça
 * se aperta, e este não se aperta. A hierarquia vem de tom e de linha, não de elevação: sombra em cada cartão custa
 * pintura no computador fraco da escola e não diz nada (regra 50, item 1).
 *
 * O cartão clicável é a `ListItem`; aqui só se lê.
 */
export function Card({ titulo, nivel = 2, refDoTitulo, acao, children, className = '' }: CardProps) {
  const idDoTitulo = useId()
  const Titulo = `h${nivel}` as const
  const classes = `min-w-0 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5 ${className}`
  if (titulo === undefined) return <div className={classes}>{children}</div>
  return (
    <section aria-labelledby={idDoTitulo} className={classes}>
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Titulo id={idDoTitulo} ref={refDoTitulo} tabIndex={refDoTitulo === undefined ? undefined : -1} className="t-cartao min-w-0 break-words text-tinta">
          {titulo}
        </Titulo>
        {acao}
      </div>
      {children}
    </section>
  )
}
