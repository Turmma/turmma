// Páginas de fixture das guardas: cada uma tem uma violação de propósito, e o controle, a mesma página sem ela.
// Servem para provar que as verificações de largura e de acessibilidade pegam de fato.

function pagina(corpo: string, estilo = ''): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fixture</title>
    <style>body { margin: 0; font-family: sans-serif; color: #111; background: #fff } ${estilo}</style>
  </head>
  <body><main><h1>Fixture</h1>${corpo}</main></body>
</html>`
}

/** Um bloco de 480 px fixos: mais largo que a tela de 360 px. */
export const WIDE_PAGE = pagina('<div style="width: 480px; height: 40px">largo demais</div>')
export const HTML_PAGE_WITHIN_WIDTH = pagina('<div style="max-width: 100%; width: 480px; height: 40px">cabe</div>')

/** Botões de 16 × 16 px encostados: o `target-size` do WCAG 2.2 pede 24 px ou espaço equivalente. */
export const HTML_PAGE_16_PX_BUTTONS = pagina(
  '<div style="display: flex"><button style="width:16px;height:16px;padding:0;border:0" aria-label="Um">1</button><button style="width:16px;height:16px;padding:0;border:0" aria-label="Dois">2</button></div>',
)
export const HTML_PAGE_44_PX_BUTTONS = pagina(
  '<div style="display: flex; gap: 8px"><button style="min-width:44px;min-height:44px">1</button><button style="min-width:44px;min-height:44px">2</button></div>',
)

/** Texto cinza-claro sobre branco: `color-contrast` é violação `serious`. */
export const HTML_PAGE_LOW_CONTRAST = pagina('<p style="color: #d0d0d0">texto que quase não se lê</p>')
export const HTML_PAGE_GOOD_CONTRAST = pagina('<p style="color: #333">texto que se lê</p>')

/**
 * O cabeçalho de uma tela do aluno com nomes sintéticos como o e2e os gera (`marca.slice(0, 8)`, oito caracteres
 * hexadecimais minúsculos), todos com "503" por acaso e nenhum erro na tela. Os nomes ficam colados no texto vizinho, como
 * o `textContent` de elementos seguidos. Cada um tem o "503" num lugar, para cada vizinho hexadecimal ser provado sozinho:
 * `fa5030ac` e `a2503562` são os da esteira de 12/10/2026 (hexadecimal dos dois lados); `503a1c9d` abre com o 503 e vem
 * depois de espaço (só o vizinho de trás é não hexadecimal); `9fe1c503` fecha com ele e vem antes do botão "Sair" (só o da
 * frente).
 */
export const HTML_PAGE_503_IN_SCHOOL_NAME = pagina(
  '<header><span>Colégio sintético fa5030ac</span><button>Sair</button></header><p>Escola: Colégio sintético a2503562</p>' +
    '<p>Aluno sintético 503a1c9d</p><p><span>Aluno sintético 9fe1c503</span><button>Sair</button></p>',
)

/** A mesma tela com o erro de verdade: o código cru da API, em linha própria. */
export const HTML_PAGE_RAW_503 = pagina('<header><span>Colégio sintético fa5030ac</span></header><p role="alert">Erro 503</p>')
/** E com o código colado ao texto do botão que vem depois, como o `textContent` o entrega: "Erro 503Tentar de novo". */
export const HTML_PAGE_503_GLUED_TO_BUTTON = pagina(
  '<header><span>Colégio sintético fa5030ac</span></header><p>Erro 503</p><button>Tentar de novo</button>',
)
