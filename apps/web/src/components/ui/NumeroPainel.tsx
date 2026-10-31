import type { ReactNode } from 'react'
import { formatarNumero } from '../../format'

interface PropsDoNumeroPainel {
  readonly rotulo: string
  /** Número vai no formato local (1.234); texto vai como veio ("61%", "—"). */
  readonly valor: number | string
  /** Uma linha embaixo do número: o que ele quer dizer, ou uma `BarraRotulada`. */
  readonly apoio?: ReactNode
}

/**
 * O número de painel (`docs/interface.md` 9.2, 10.2 e 11.7): o rótulo em cima, em `t-selo` e `sutil`, e embaixo o número
 * em `t-numero` (28 px, 700, `tabular-nums`), para os quatro da Governança não dançarem quando mudam. Cartão de leitura:
 * borda de 2 px, sem degrau. **Sem gráfico onde um número basta**, e sem variação "boa" ou "ruim" em cor.
 *
 * O rótulo vem antes do número também na leitura: quem ouve "412" precisa ter ouvido de quê. A caixa-alta do rótulo é do
 * CSS: o texto vai escrito normal para o leitor de tela.
 */
export function NumeroPainel({ rotulo, valor, apoio }: PropsDoNumeroPainel) {
  return (
    <div className="min-w-0 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5">
      <p className="t-selo break-words text-sutil">{rotulo}</p>
      <p className="t-numero mt-2 break-words text-tinta">{typeof valor === 'number' ? formatarNumero(valor) : valor}</p>
      {apoio !== undefined && <div className="mt-2 text-sm text-sutil">{apoio}</div>}
    </div>
  )
}
