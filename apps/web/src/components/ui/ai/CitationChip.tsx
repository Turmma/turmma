import type { Citacao } from '@educa/shared'
import { FileText } from 'lucide-react'
import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { estiloDoFlutuante, useFloating } from '../overlays/floating'
import { nomeDoChip, textoDoChip, tituloDoMaterial, type TitulosDosMateriais } from './source-labels'

interface CitationChipProps {
  readonly citacao: Citacao
  /** Os títulos dos materiais, pelo id: a citação traz só o `materialId`. */
  readonly materiais: TitulosDosMateriais
}

/** A altura que o cartão da fonte costuma ter, para decidir se abre para baixo ou para cima. */
const ALTURA_DO_CARTAO = 220

/**
 * O chip de fonte, `p. 142`, dentro do texto da IA (`docs/interface.md` 10.2 e 11.3), em família `ia`: pílula de 28 px
 * com a borda de 2 px, sem degrau (ele corre dentro de uma linha de texto, e a margem do degrau a abriria). Ao ativar, mostra **o
 * material, a página e o trecho**: é por aqui que a professora confere, de relance, de onde a questão saiu (D6).
 *
 * - **Abre por clique, por toque e pelo teclado** (Enter ou Espaço), e não por hover: no Chromebook de toque e no
 *   celular não existe hover (regra 50, item 2a). É um botão com `aria-expanded`, e o cartão vem logo depois dele na
 *   ordem de leitura.
 * - **Fecha** pelo mesmo botão, pelo Esc (com o foco de volta no chip), pelo toque fora e **quando o foco sai dele**: quem
 *   segue pelo Tab não deixa um cartão aberto para trás, cobrindo o texto.
 * - **Cabe dentro de um parágrafo**: é feito só de `span`, e o alvo tem 28 px de altura, acima dos 24 px do piso.
 * - **Não passa da janela a 360 px nem é cortado** pela lista que rola: a posição é fixa na janela, medida na abertura
 *   (`floating.ts`). Quando a conversa rola, o cartão fecha.
 *
 * Fonte de fora leva outro chip, "da web", de desenho diferente (a mesma pílula, com a borda tracejada; D68), que nasce
 * com a busca na web (F9): hoje nenhuma citação vem da web, e a peça não desenha o que não tem dado.
 */
export function CitationChip({ citacao, materiais }: CitationChipProps) {
  const [aberto, definirAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const idDoCartao = useId()
  const { ancora, posicao } = useFloating<HTMLSpanElement>({ aberto, aoFechar: fechar, alinhamento: 'inicio', lado: 'auto', altura: ALTURA_DO_CARTAO })
  const nome = nomeDoChip(citacao, materiais)
  const visivel = textoDoChip(citacao.pagina)

  /**
   * Fecha pelo toque fora e pela rolagem por fora. Se o foco estava dentro do cartão, que some, volta para o chip — sem
   * rolar a página até ele.
   */
  function fechar(): void {
    const focoNoCartao = document.activeElement !== botao.current && ancora.current?.contains(document.activeElement) === true
    definirAberto(false)
    if (focoNoCartao) botao.current?.focus({ preventScroll: true })
  }

  function aoTeclar(evento: KeyboardEvent<HTMLSpanElement>): void {
    if (evento.key !== 'Escape' || !aberto) return
    // O Esc é do chip: dentro de um diálogo, ele fecha o cartão da fonte, e não o diálogo.
    evento.preventDefault()
    evento.stopPropagation()
    definirAberto(false)
    botao.current?.focus()
  }

  /** O foco saiu do chip e do cartão dele (o Tab seguiu adiante): fecha. Dentro do cartão, que recebe foco, continua aberto. */
  function aoPerderOFoco(evento: FocusEvent<HTMLSpanElement>): void {
    if (!(evento.relatedTarget instanceof Node) || !evento.currentTarget.contains(evento.relatedTarget)) definirAberto(false)
  }

  return (
    <span ref={ancora} onKeyDown={aoTeclar} onBlur={aoPerderOFoco} className="mx-0.5 inline-block align-baseline">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        {...(aberto ? { 'aria-controls': idDoCartao } : {})}
        onClick={() => definirAberto((estava) => !estava)}
        className={`inline-flex min-h-7 min-w-7 items-center justify-center gap-1 rounded-full border-2 border-borda t-apoio px-2.5 leading-none font-bold whitespace-nowrap text-ia hover:bg-realce ${aberto ? 'bg-realce' : 'bg-ia-cx'}`}
      >
        <FileText aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
        <span className="sr-only">{nome.slice(0, nome.length - visivel.length)}</span>
        {visivel}
      </button>
      {aberto && (
        <span
          id={idDoCartao}
          role="group"
          aria-label={nome}
          // Recebe foco pelo toque e pelo clique, para quem seleciona o trecho não fechar o cartão ao tirar o foco do chip.
          tabIndex={-1}
          style={estiloDoFlutuante(posicao)}
          className="fixed z-30 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-1 rounded-cartao bg-superficie p-4 text-left text-sm font-normal whitespace-normal shadow-flutua"
        >
          <span className="text-sm font-bold text-sutil">Material da escola</span>
          <span className="font-semibold break-words text-tinta">{tituloDoMaterial(citacao.materialId, materiais)}</span>
          <span className="text-sutil">Página {citacao.pagina}</span>
          <span className="mt-2 rounded-linha bg-realce-suave p-3 leading-relaxed break-words text-apoio">“{citacao.trecho}”</span>
        </span>
      )}
    </span>
  )
}
