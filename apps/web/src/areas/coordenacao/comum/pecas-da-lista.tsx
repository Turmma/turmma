import type { ReactNode } from 'react'

/**
 * As peças das listas da coordenação, que a Estrutura (13.0) e os Professores (14.0) desenham do mesmo jeito: o item em
 * cartão e o aviso da lista que passou do teto de páginas.
 */

/** Um item da lista: o cartão, em uma coluna no celular e em linha a partir de 768 px (W12). */
export function ListRow({ titulo, detalhe, children }: { titulo: string; detalhe?: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="font-medium break-words text-tinta">{titulo}</p>
        {detalhe !== undefined && <p className="text-sm break-words text-apoio">{detalhe}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  )
}

/** "Mostrando os primeiros 1.000": a lista passou do teto de páginas que a tela lê (`lerPaginas`). */
export function AvisoDeListaIncompleta({ completa }: { completa: boolean }) {
  if (completa) return null
  return <p className="text-sm text-apoio">A lista é maior do que esta tela mostra: aparecem só os primeiros.</p>
}

/**
 * O botão do nome que abre o painel da linha (Professores, 6.0; Material, 8.0): ele se estende pela linha toda (`after:inset-0`, sobre
 * o `relative` da linha da `Table`), com o anel do foco por dentro dela.
 */
export const CLASSES_DO_BOTAO_DA_LINHA =
  "inline-flex min-h-11 max-w-full items-center gap-1 text-left font-semibold text-tinta after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-linha focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-foco"
