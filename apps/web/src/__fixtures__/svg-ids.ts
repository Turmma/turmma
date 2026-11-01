/**
 * O desenho da onça declara a pinta, os recortes e os olhos com `id` de SVG, e o `id` vem do `useId` do React: dois renders
 * do mesmo desenho só diferem nele. Os testes que comparam o HTML de dois desenhos o comparam sem esse id (e sem a
 * referência `url(#…)` ou `href="#…"` que o usa).
 */
export function stripSvgIds(html: string): string {
  return html.replace(/\b(?:cab|onca)[a-zA-Z0-9]+(?=-(?:pinta|corpo|boca|olho-[ed])\b)/g, 'id')
}
