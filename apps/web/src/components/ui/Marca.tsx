/**
 * O lockup da marca (`docs/interface.md` 9.6): a pinta caramelo, do arquivo do manual em `public/marca/`, e o nome.
 *
 * A pinta vem em curvas, então nenhuma fonte é baixada; o nome fica na fonte do sistema, porque a Fustat do logotipo
 * não entra no primeiro carregamento do Chromebook (regra 50, item 1). A imagem é decorativa (`alt` vazio): o nome ao
 * lado já diz o que ela é, e o leitor de tela não repete "Turmma" duas vezes.
 */
export function Marca() {
  return (
    <p className="inline-flex items-center gap-2 text-lg font-semibold text-tinta">
      <img src="/marca/turmma-pinta.svg" alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
      Turmma
    </p>
  )
}
