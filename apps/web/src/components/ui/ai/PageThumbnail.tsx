import type { Citacao } from '@educa/shared'
import { tituloDoMaterial, type TitulosDosMateriais } from './source-labels'

interface PageThumbnailProps {
  readonly citacao: Citacao
  readonly materiais: TitulosDosMateriais
}

/**
 * A miniatura da página de origem, no artefato (`docs/mvp-rapido.md` 9.2): uma folha pequena com o material no
 * cabeçalho, o **trecho de verdade** no corpo e o número da página no pé. É texto, e não imagem da página: o MVP guarda
 * o texto extraído do PDF, não o arquivo (`docs/mvp-rapido.md` 4, item 3), e o que não tem licença para estar aqui não
 * aparece nem em miniatura (D5).
 *
 * Nada menor que 14 px, o piso da 9.2: a folha corta o trecho que não couber, em vez de encolher a letra até não dar
 * para ler. A borda é de 2 px, como a de toda peça (9.3).
 */
export function PageThumbnail({ citacao, materiais }: PageThumbnailProps) {
  const material = tituloDoMaterial(citacao.materialId, materiais)
  return (
    <figure className="w-40 max-w-full shrink-0">
      <div className="flex aspect-[3/4] flex-col gap-2 overflow-hidden rounded-linha border-2 border-borda bg-superficie p-3">
        <p className="shrink-0 truncate border-b-2 border-borda pb-1.5 text-sm font-bold text-sutil">{material}</p>
        <p className="min-h-0 flex-1 overflow-hidden text-sm leading-snug break-words text-apoio">{citacao.trecho}</p>
        <p aria-hidden="true" className="shrink-0 text-right text-sm text-sutil tabular-nums">
          {citacao.pagina}
        </p>
      </div>
      <figcaption className="t-apoio mt-1.5 break-words text-sutil">
        Página {citacao.pagina} · {material}
      </figcaption>
    </figure>
  )
}
