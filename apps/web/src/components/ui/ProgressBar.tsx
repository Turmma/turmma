import { percentualDaBarra, preenchimentoDaBarra } from './progress'

interface ProgressBarProps {
  /** O que a barra mede: a habilidade, "Consumo do mês", "Hoje". */
  readonly rotulo: string
  readonly valor: number
  /** O valor que enche a barra. Sem ele, 100: `valor` é percentual. */
  readonly maximo?: number
  /** O valor **em texto**, ao lado do rótulo: "72%", "12 de 60 perguntas". Sem ele, o percentual inteiro. */
  readonly texto?: string
  /** Uma segunda linha, em `sutil`: "EM13CNT101 · 3 questões". */
  readonly detalhe?: string
}

/**
 * Barra horizontal com o rótulo e o **valor em texto** (`docs/interface.md` 10.2 e 11.6): acerto por habilidade, consumo
 * contra o orçamento e o "Hoje: N de 60" do aluno. O número está escrito, e por isso a barra é só desenho
 * (`aria-hidden`): o leitor de tela lê o texto, e ninguém depende do comprimento de um traço.
 *
 * **Cor neutra, sempre.** A barra não fica vermelha perto do limite nem verde com acerto alto: estado não é dito por
 * cor (regra 50, item 11), e no uso do dia do aluno a barra que muda de cor vira pressão (D59). O trilho é `ia-cx` e o
 * enchimento é `sutil`, nos dois temas: a D80 mudou só a forma (12 px de altura e a ponta redonda), e a cor ficou.
 *
 * É SVG, e não uma `div` com largura no `style`: o preenchimento vai num atributo, sem estilo em linha.
 */
export function ProgressBar({ rotulo, valor, maximo = 100, texto, detalhe }: ProgressBarProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className="min-w-0 font-medium break-words text-tinta">{rotulo}</span>
        <span className="shrink-0 font-semibold text-tinta tabular-nums">{texto ?? percentualDaBarra(valor, maximo)}</span>
      </p>
      <svg aria-hidden="true" focusable="false" className="block h-3 w-full" preserveAspectRatio="none">
        <rect width="100%" height="100%" rx="6" className="fill-ia-cx" />
        <rect width={`${String(preenchimentoDaBarra(valor, maximo))}%`} height="100%" rx="6" className="fill-sutil" />
      </svg>
      {detalhe !== undefined && <p className="text-sm break-words text-sutil">{detalhe}</p>}
    </div>
  )
}
