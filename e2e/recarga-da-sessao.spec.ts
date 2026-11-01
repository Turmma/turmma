import { esperarATelaDepoisDaRecarga } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'

/**
 * A espera da tela depois da recarga (correção 2026-10-31-conversa-sem-titulo-na-entrada): com a sessão `indisponivel`, a tela da sessão
 * mostra o aviso e "Tentar de novo" **fora do `main`**, e a espera repete uma vez, como a pessoa faria. Páginas estáticas, sem a API: o que se
 * prova é o que a espera faz com o que a tela mostra. A recarga de verdade, com a renovação recusada na rede, está em `professor-conversa.spec.ts`.
 */

const AVISO = 'Não foi possível concluir agora. Tente de novo em instantes.'

/** A tela da sessão indisponível; cada clique em "Tentar de novo" conta e, a partir do `abrirNaTentativa`, abre a área com o título. */
const telaDaSessao = (abrirNaTentativa: number): string => `
  <div id="sessao">
    <div role="alert">${AVISO}</div>
    <button type="button" id="denovo">Tentar de novo</button>
  </div>
  <script>
    let cliques = 0
    document.getElementById('denovo').addEventListener('click', () => {
      cliques += 1
      if (cliques >= ${String(abrirNaTentativa)}) document.body.innerHTML = '<main><h1>Início</h1></main>'
    })
  </script>`

test.describe('a espera da tela depois da recarga', () => {
  test('com a tela da sessão indisponível, tenta de novo uma vez e chega ao título', async ({ page }) => {
    await page.setContent(telaDaSessao(1))
    await esperarATelaDepoisDaRecarga(page)
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Início')
  })

  test('recusada de novo, falha dizendo o que a tela mostrava, e não espera o título até o fim do relógio', async ({ page }) => {
    await page.setContent(telaDaSessao(99))
    await expect(esperarATelaDepoisDaRecarga(page)).rejects.toThrow(`A API recusou a renovação da sessão 2 vezes seguidas depois da recarga: "${AVISO}"`)
  })

  test('o "Tentar de novo" de dentro do `main` é de uma tela, e não da sessão: a espera não o clica e espera o título', async ({ page }) => {
    // O `main` tem o aviso e o botão, e o título só chega depois de uns 300 ms. Sem o filtro `:not(main *)`, a primeira volta acharia o botão antes
    // do título e o clicaria.
    await page.setContent(`
      <main>
        <div role="alert">${AVISO}</div>
        <button type="button" id="da-tela">Tentar de novo</button>
      </main>
      <script>
        window.cliques = 0
        document.getElementById('da-tela').addEventListener('click', () => { window.cliques += 1 })
        setTimeout(() => document.querySelector('main').insertAdjacentHTML('afterbegin', '<h1>Início</h1>'), 300)
      </script>`)
    await esperarATelaDepoisDaRecarga(page)
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Início')
    expect(await page.evaluate(() => (window as unknown as { cliques: number }).cliques), 'o botão de dentro do `main` não foi clicado').toBe(0)
  })
})
