import type { ButtonHTMLAttributes, Ref } from 'react'
import { classesDoBotao, type TamanhoDeBotao, type VarianteDeBotao } from './button-variants'

type PropsDeBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** O tamanho da face: 44 px (`principal`), 36 px (`compacto`, controle de barra e de linha no computador) ou o círculo só de ícone (`icone`, 44 px). */
  tamanho?: TamanhoDeBotao
  /** O botão em si, para quem precisa devolver o foco a ele (o "Renomear" depois de fechar o campo, por exemplo). */
  ref?: Ref<HTMLButtonElement>
} & (
    | { variante?: Exclude<VarianteDeBotao, 'perigo'>; cheio?: never }
    /** `cheio` é o `perigo` na face `vermelho`, com o texto em `sobre-cor`: só o botão que confirma, dentro do diálogo de confirmação. */
    | { variante: 'perigo'; cheio?: boolean }
  )

/**
 * O botão do produto, nos seis desenhos da D80 (`docs/interface.md` 10.2; `button-variants.ts`): cinco variantes e o
 * `perigo` cheio. Sem `variante`, é a ação primária: face `laranja` com texto `sobre-cor`, escuro nos dois temas
 * (6,4:1), porque branco em cima do laranja dá 3,0:1 e reprova. O grafite é a variante `oficial`, e só a decisão
 * oficial o usa.
 *
 * Canto de 12 px, rótulo em caixa-alta e degrau: apertado, a face desce, no toque também, sem depender de hover. A face
 * tem 44 × 44 px no mínimo (regra 50, item 2a); o degrau é sombra e margem, fora da caixa. Desligado é outro desenho:
 * sem degrau, face `borda` e texto `apoio`. O foco é o anel global de 3 px em `foco`.
 */
export function Botao({ className = '', type = 'button', variante = 'primario', tamanho = 'principal', cheio = false, ...props }: PropsDeBotao) {
  return <button type={type} className={`${classesDoBotao({ variante, tamanho, cheio })} ${className}`} {...props} />
}
