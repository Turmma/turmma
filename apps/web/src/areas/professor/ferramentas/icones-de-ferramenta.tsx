import type { Ferramenta } from '@educa/shared'
import type { ReactElement } from 'react'

/**
 * Os ícones ilustrados das ferramentas do Assistente (`docs/interface.md` 9.4; D80, item 4): um desenho para cada
 * ferramenta que existe (`FERRAMENTAS`, em `@educa/shared`), na mesma grade de 48 por 48 e com as mesmas regras dos
 * ícones dos lugares (`components/ui/icons/places.tsx`):
 *
 * - **Só token.** A cor dominante é a face de uma família (`fill-verde`, `fill-roxo`, `fill-turquesa`) e o papel e as linhas
 *   são `fill-icone-papel` e `fill-icone-linha`. Nenhuma cor escrita, nenhum `style`: o desenho acompanha o tema, e a guarda
 *   de cor o varre como a qualquer outro arquivo. O mapa de classes é literal, porque o Tailwind só gera a que acha inteira.
 * - **Chapados e parados.** Sem contorno, degradê, sombra, texto nem animação (D59).
 * - **Decoração.** `aria-hidden`: o nome da ferramenta está escrito ao lado, e dizê-lo duas vezes é ruído.
 *
 * Quem os consome é a tela que mostra a ferramenta: os atalhos do Início, o cartão da conversa e a página de Ferramentas.
 * Ferramenta nova é um desenho novo aqui, e o tipo não compila sem ele.
 */

/** Atividade objetiva, em verde: a folha com três alternativas, a do meio marcada. */
function AtividadeObjetiva() {
  return (
    <>
      <rect x="9" y="5" width="30" height="38" rx="5" className="fill-verde" />
      <rect x="13" y="9" width="22" height="30" rx="2.5" className="fill-icone-papel" />
      <circle cx="19" cy="17" r="2.5" className="fill-icone-linha" />
      <rect x="24" y="15.5" width="8" height="3" rx="1.5" className="fill-icone-linha" />
      <circle cx="19" cy="24" r="2.5" className="fill-verde" />
      <rect x="24" y="22.5" width="8" height="3" rx="1.5" className="fill-icone-linha" />
      <circle cx="19" cy="31" r="2.5" className="fill-icone-linha" />
      <rect x="24" y="29.5" width="8" height="3" rx="1.5" className="fill-icone-linha" />
    </>
  )
}

/** Plano de aula, em roxo: o caderno de espiral, com as linhas de etapa escritas na página. */
function PlanoDeAula() {
  return (
    <>
      <rect x="9" y="5" width="32" height="38" rx="5" className="fill-roxo" />
      <rect x="18" y="10" width="19" height="28" rx="2.5" className="fill-icone-papel" />
      <rect x="5" y="12" width="12" height="4" rx="2" className="fill-icone-linha" />
      <rect x="5" y="22" width="12" height="4" rx="2" className="fill-icone-linha" />
      <rect x="5" y="32" width="12" height="4" rx="2" className="fill-icone-linha" />
      <rect x="22" y="16" width="11" height="3" rx="1.5" className="fill-icone-linha" />
      <rect x="22" y="23" width="11" height="3" rx="1.5" className="fill-icone-linha" />
      <rect x="22" y="30" width="7" height="3" rx="1.5" className="fill-icone-linha" />
    </>
  )
}

/** Adaptação, em turquesa: três réguas de ajuste, cada uma com o seu botão em outro ponto. */
function Adaptacao() {
  return (
    <>
      <rect x="5" y="10" width="38" height="5" rx="2.5" className="fill-icone-linha" />
      <rect x="5" y="22" width="38" height="5" rx="2.5" className="fill-icone-linha" />
      <rect x="5" y="34" width="38" height="5" rx="2.5" className="fill-icone-linha" />
      <circle cx="31" cy="12.5" r="6" className="fill-turquesa" />
      <circle cx="16" cy="24.5" r="6" className="fill-turquesa" />
      <circle cx="28" cy="36.5" r="6" className="fill-turquesa" />
    </>
  )
}

/** O desenho de cada ferramenta. A chave é a `Ferramenta` do contrato. */
export const DESENHO_DA_FERRAMENTA: Readonly<Record<Ferramenta, () => ReactElement>> = {
  atividade_objetiva: AtividadeObjetiva,
  plano_de_aula: PlanoDeAula,
  adaptacao: Adaptacao,
}

/** Os tamanhos em que o ícone de ferramenta aparece, em px. */
export type TamanhoDoIconeDeFerramenta = 24 | 32 | 40 | 48

interface Props {
  readonly ferramenta: Ferramenta
  readonly tamanho: TamanhoDoIconeDeFerramenta
}

/** O ícone ilustrado de uma ferramenta: o `<svg>` de 48 por 48 com o desenho dela, só para os olhos. */
export function IconeDeFerramenta({ ferramenta, tamanho }: Props) {
  const Desenho = DESENHO_DA_FERRAMENTA[ferramenta]
  return (
    <svg data-icone-de-ferramenta={ferramenta} width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="block shrink-0">
      <Desenho />
    </svg>
  )
}
