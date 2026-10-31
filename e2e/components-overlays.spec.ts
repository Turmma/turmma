import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { abrirGaleria, acionar, caixa, conferirQueOFocoNaoCaiu, desenho, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, corDoToken, focoVisivel, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * As peças do MVP de apresentação (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 11.1 e 11.3), na galeria (`/galeria`),
 * nos projetos `chromebook` e `celular`: o que a regra de cada peça promete, visto no navegador. A galeria não chama a
 * API e não tem sessão; o dado é inventado, escrito nela.
 *
 * Este arquivo é o grupo `sobrepor` do antigo `pecas.spec.ts` (tarefa 2.0 da X1): cada caso veio inteiro, com a mesma
 * asserção, e só mudou de arquivo. Os auxiliares comuns estão em `support/gallery.ts`.
 */

/** Os hex da 9.1 do `docs/interface.md`, como o navegador os devolve no estilo calculado: só os que este arquivo afirma. */
const RGB = {
  grafite: 'rgb(51, 51, 51)',
  vermelho: 'rgb(242, 84, 91)',
  vermelhoTexto: 'rgb(184, 64, 69)',
  superficie: 'rgb(255, 255, 255)',
} as const

const TEMAS = ['claro', 'escuro'] as const

/** As quatro peças sobrepostas da galeria: onde ficam, o botão que abre, o que abre e, nas confirmações, qual é o botão que confirma. */
const ABERTOS = [
  { nome: 'o diálogo', borda: 'borda de 2 px com degrau', bloco: 'dialogo', gatilho: 'Nova disciplina', alvo: (page: Page) => page.getByRole('dialog', { name: 'Nova disciplina' }), confirmar: undefined },
  { nome: 'a confirmação oficial', borda: 'borda de 2 px com degrau', bloco: 'confirmacao', gatilho: 'Aprovar 32 correções', alvo: (page: Page) => page.getByRole('alertdialog', { name: 'Aprovar 32 correções' }), confirmar: 'oficial' },
  { nome: 'a confirmação de perigo', borda: 'borda de 2 px com degrau', bloco: 'confirmacao', gatilho: 'Suspender a função', alvo: (page: Page) => page.getByRole('alertdialog', { name: 'Suspender a correção de objetiva' }), confirmar: 'perigo' },
  { nome: 'o painel', borda: 'borda de 2 px de um lado só, sem degrau', bloco: 'painel-lado', gatilho: 'Abrir o painel da turma 2ºB', alvo: (page: Page) => page.getByRole('dialog', { name: 'Turma 2ºB · Química' }), confirmar: undefined },
] as const

/** O foco do teclado está dentro do elemento (o diálogo ou o painel): é o que a prisão do foco promete. */
function estaDentro(alvo: Locator): Promise<boolean> {
  return alvo.evaluate((elemento) => elemento.contains(document.activeElement))
}

test.describe('peças do MVP de apresentação, na galeria', () => {
  // Este caso era um só, de 8,3 s na máquina e 20,7 s no `celular` da esteira (execução 40880199949); são dois, que abrem a galeria cada um.
  test('abas pelo teclado: uma parada só no Tab, as setas trocam de aba e levam o foco junto', async ({ page }) => {
    await abrirGaleria(page)
    const abas = secao(page, 'abas')
    const lista = abas.getByRole('tablist', { name: 'Seções da turma' })
    const painel = abas.getByRole('tabpanel').first()
    await expect(lista.getByRole('tab')).toHaveCount(3)
    await expect(lista.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true')
    await expect(painel).toHaveText('Conteúdo de Visão geral.')
    // As três abas estão à vista, também a 360 px: a lista quebra de linha em vez de esconder a que não coube.
    const largura = page.viewportSize()?.width ?? 0
    for (const aba of await lista.getByRole('tab').all()) {
      const medida = await caixa(aba)
      expect(medida.x).toBeGreaterThanOrEqual(0)
      expect(medida.x + medida.width).toBeLessThanOrEqual(largura)
    }

    // Só a aba ativa está na ordem do Tab; as setas trocam de aba e levam o foco junto.
    expect(await lista.getByRole('tab').evaluateAll((guias) => guias.map((guia) => (guia as HTMLElement).tabIndex))).toEqual([0, -1, -1])
    await lista.getByRole('tab', { name: 'Visão geral' }).focus()
    await page.keyboard.press('ArrowRight')
    const alunos = lista.getByRole('tab', { name: /Alunos/ })
    await expect(alunos).toHaveAttribute('aria-selected', 'true')
    await expect(alunos).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await expect(painel).toHaveText('Conteúdo de Alunos.')
    // O contador diz o que conta, e quem usa a peça é que diz o quê.
    await expect(alunos).toHaveText(/2 pedidos de nome/)
    await page.keyboard.press('End')
    await expect(lista.getByRole('tab', { name: 'Atividades' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(lista.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true')
    // O Tab seguinte entra no painel, e não na aba ao lado.
    await page.keyboard.press('Tab')
    await expect(painel).toBeFocused()

    // Com a aba ativa fora da lista, nenhuma está selecionada, e a primeira continua alcançável pelo Tab.
    const semAtiva = abas.locator('[data-abas="sem-ativa"]').getByRole('tab')
    expect(await semAtiva.evaluateAll((guias) => guias.map((guia) => [(guia as HTMLElement).tabIndex, guia.getAttribute('aria-selected')]))).toEqual([
      [0, 'false'],
      [-1, 'false'],
      [-1, 'false'],
    ])

  })

  test('menu pelo teclado: a seta abre, as setas pulam o item desligado, a letra busca, o Esc devolve o foco, e o toque fora só fecha', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    // O menu: a seta para baixo abre com o foco no primeiro item, e as setas pulam o desligado.
    const bloco = secao(page, 'selecao-e-menu')
    const botao = bloco.getByRole('button', { name: 'Ações da atividade' })
    await botao.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'Ações da atividade' })
    await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    // A letra com Ctrl é atalho do navegador, e não busca no menu; sozinha, leva ao item que começa por ela.
    await page.keyboard.press('Control+g')
    await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()
    await page.keyboard.press('g')
    await expect(menu.getByRole('menuitem', { name: 'Gerar versão adaptada' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    // "Aplicar à turma" está desligado: a seta vai direto ao "Excluir".
    await expect(menu.getByRole('menuitem', { name: 'Excluir' })).toBeFocused()
    await expect(menu.getByRole('menuitem', { name: /Aplicar à turma/ })).toHaveAttribute('aria-disabled', 'true')
    expect(await violacoesGraves(page)).toEqual([])
    await page.keyboard.press('Home')
    await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()

    // O Esc fecha sem escolher e devolve o foco ao botão.
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(botao).toBeFocused()
    await expect(bloco.locator('[data-acao]')).toHaveText('')

    // O toque fora fecha, e só fecha: o botão vizinho, que estava embaixo do toque, não é acionado junto. O toque vai
    // pela coordenada, como o dedo: para o Playwright o vizinho está coberto, e ele esperaria o menu sair da frente.
    await page.keyboard.press('ArrowDown')
    await expect(menu).toBeVisible()
    // Inerte, o vizinho some da árvore de acessibilidade: aqui ele é achado pelo texto, e não pelo papel.
    const vizinho = bloco.locator('button', { hasText: 'Vizinho' })
    await expect(vizinho).toHaveAttribute('inert', '')
    const alvo = await caixa(vizinho)
    const [x, y] = [alvo.x + alvo.width / 2, alvo.y + alvo.height / 2]
    await (hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
    await expect(menu).toHaveCount(0)
    await expect(botao).toBeFocused()
    await expect(bloco.locator('[data-acao]')).toHaveText('')
    await expect(vizinho).not.toHaveAttribute('inert')
    // O controle: com o menu fechado, o mesmo toque aciona o vizinho.
    await acionar(vizinho, hasTouch)
    await expect(bloco.locator('[data-acao]')).toHaveText('Escolhido: vizinho')
    await botao.focus()

    // A página rola com o menu aberto: ele fecha, em vez de correr atrás do botão, e o foco volta para o botão sem
    // puxar a página de volta.
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()
    const antesDeRolar = await page.evaluate(() => window.scrollY)
    await page.evaluate(() => window.scrollBy(0, 120))
    await expect(menu).toHaveCount(0)
    await expect(botao).toBeFocused()
    expect(await page.evaluate(() => window.scrollY)).toBe(antesDeRolar + 120)
    await expect(vizinho).not.toHaveAttribute('inert')

    // Enter abre, e Enter no item escolhe.
    await page.keyboard.press('Enter')
    await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu).toHaveCount(0)
    await expect(bloco.locator('[data-acao]')).toHaveText('Escolhido: exportar')
    await expect(botao).toBeFocused()
  })

  test('o menu que abre logo depois de uma rolagem fica aberto: o evento de rolagem que sobrou de antes do clique não o fecha', async ({ page }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'selecao-e-menu')
    const botao = bloco.getByRole('button', { name: 'Ações da atividade' })
    const menu = page.getByRole('menu', { name: 'Ações da atividade' })
    await botao.scrollIntoViewIfNeeded()

    // A página rola e o botão é acionado no mesmo instante, como o Playwright faz ao trazer o botão para a tela e como
    // faz quem solta a rolagem e clica: o navegador entrega o evento de rolagem no quadro seguinte, com o menu já aberto.
    // O botão não saiu do lugar depois da abertura, e o menu não tem por que fechar.
    for (const repeticao of [1, 2, 3]) {
      await botao.evaluate((elemento) => {
        window.scrollBy(0, 40)
        ;(elemento as HTMLElement).click()
      })
      // Dois quadros: o evento de rolagem pendente já foi entregue.
      await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver(null)))))
      await expect(menu, `abertura ${String(repeticao)}`).toBeVisible()
      await expect(menu.getByRole('menuitem', { name: 'Exportar em PDF' })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
    }

    // O controle: com o menu aberto, a rolagem que tira o botão do lugar continua fechando.
    await botao.focus()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await page.evaluate(() => window.scrollBy(0, -60))
    await expect(menu).toHaveCount(0)
    await expect(botao).toBeFocused()
  })

  // Este caso era um só, de 11,2 s na máquina e mais de 30 s no runner do celular (execução 40880199949, 1ª tentativa); são três, que
  // abrem a galeria cada um e dividem o que ele afirmava, na mesma ordem e sem tirar asserção: o runner leva uns três vezes o
  // tempo da máquina nos casos que são só CPU ×4 (a galeria não chama a API).
  test('o diálogo de confirmação: o que vai acontecer e o aviso são lidos ao abrir, o foco não começa em confirmar e volta para onde dá', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'confirmacao')
    const gatilho = bloco.getByRole('button', { name: 'Aprovar 32 correções' })
    const decisao = bloco.locator('[data-decisao]')

    await acionar(gatilho, hasTouch)
    const oficial = page.getByRole('alertdialog', { name: 'Aprovar 32 correções' })
    await expect(oficial).toBeVisible()
    // O que vai acontecer, antes de confirmar: a atividade, a turma, quantas correções, e o efeito (regra 50, item 8).
    await expect(oficial).toContainText('Estequiometria: lista 3')
    await expect(oficial).toContainText('2ºB')
    await expect(oficial).toContainText('O diagnóstico por habilidade chega aos alunos da turma.')
    const aprovar = oficial.getByRole('button', { name: 'Aprovar 32 correções' })
    const cancelar = oficial.getByRole('button', { name: 'Cancelar' })
    // O foco começa no texto: um Enter a mais não aprova nada.
    await expect(aprovar).not.toBeFocused()
    await page.keyboard.press('Enter')
    await expect(oficial).toBeVisible()
    await expect(decisao).toHaveText('')
    // O botão que confirma é o grafite do oficial, e o de cancelar tem a mesma altura (D59).
    expect(await desenho(aprovar)).toMatchObject({ fundo: RGB.grafite })
    expect((await caixa(cancelar)).height).toBe((await caixa(aprovar)).height)
    expect((await caixa(cancelar)).height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // O Esc cancela, sem decidir, e o foco volta ao botão que abriu.
    await page.keyboard.press('Escape')
    await expect(oficial).toHaveCount(0)
    await expect(decisao).toHaveText('')
    await expect(gatilho).toBeFocused()

    // Em andamento: o botão que confirma desliga e diz o que está fazendo; cancelar continua valendo.
    await acionar(bloco.getByRole('button', { name: 'Ver a confirmação em andamento' }), hasTouch)
    await expect(oficial.getByRole('button', { name: 'Aprovando…' })).toBeDisabled()
    await expect(oficial.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(bloco.getByRole('button', { name: 'Ver a confirmação em andamento' })).toBeFocused()

    // Com falha: o texto diz o que fazer, e dá para tentar de novo.
    await acionar(bloco.getByRole('button', { name: 'Ver a confirmação com falha' }), hasTouch)
    await expect(oficial.getByRole('alert')).toHaveText('Não foi possível aprovar. Tente de novo em instantes.')
    await expect(oficial.getByRole('button', { name: 'Aprovar 32 correções' })).toBeEnabled()
    await page.keyboard.press('Escape')
  })

  test('rejeitar o lote pede o motivo: de 8 a 500 caracteres, contados sem o espaço das pontas, e o botão que confirma é o vermelho', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'confirmacao')
    const decisao = bloco.locator('[data-decisao]')

    // Rejeitar pede o motivo: sem ele, de 8 a 500 caracteres, o botão que confirma fica desligado.
    await acionar(bloco.getByRole('button', { name: 'Rejeitar o lote' }), hasTouch)
    const rejeicao = page.getByRole('alertdialog', { name: 'Rejeitar 32 correções' })
    const rejeitar = rejeicao.getByRole('button', { name: 'Rejeitar 32 correções' })
    const motivo = rejeicao.getByLabel('Motivo da rejeição')
    await expect(rejeitar).toBeDisabled()
    await expect(rejeicao.getByText('Motivo da rejeição (obrigatório)')).toBeVisible()
    await expect(motivo).toHaveAttribute('aria-required', 'true')
    // A marca "(obrigatório)" é para quem vê: o nome do campo não a leva, e o leitor de tela não ouve "obrigatório" duas vezes.
    await expect(rejeicao.getByRole('textbox', { name: 'Motivo da rejeição', exact: true })).toHaveCount(1)
    // O limite do campo é o do contador, e não o `maxlength` do navegador, que contaria o espaço das pontas.
    await expect(motivo).not.toHaveAttribute('maxlength')
    await expect(rejeicao.getByText('0 de 500')).toBeVisible()
    await motivo.fill('  errada  ')
    // O contador conta sem o espaço das pontas, como a API.
    await expect(rejeicao.getByText('6 de 500')).toBeVisible()
    await expect(rejeitar).toBeDisabled()
    await motivo.fill('A questão 3 não é do capítulo 7.')
    await expect(rejeitar).toBeEnabled()
    expect(await desenho(rejeitar)).toMatchObject({ fundo: RGB.vermelho })
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(rejeitar, hasTouch)
    await expect(decisao).toHaveText('Rejeitado')
  })

  test('a ação de perigo com aviso suspende a função, e aprovar pelo teclado leva o foco ao resultado', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'confirmacao')
    const gatilho = bloco.getByRole('button', { name: 'Aprovar 32 correções' })
    const decisao = bloco.locator('[data-decisao]')
    const oficial = page.getByRole('alertdialog', { name: 'Aprovar 32 correções' })
    const aprovar = oficial.getByRole('button', { name: 'Aprovar 32 correções' })

    // A ação de perigo com aviso: o cheio em vermelho só existe aqui dentro, e o aviso da auditoria faz parte do que o
    // leitor de tela ouve ao abrir (a descrição do diálogo), e não só do que se vê.
    const suspender = bloco.getByRole('button', { name: 'Suspender a função' })
    expect(await desenho(suspender)).toMatchObject({ fundo: RGB.superficie, texto: RGB.vermelhoTexto })
    await acionar(suspender, hasTouch)
    const perigo = page.getByRole('alertdialog', { name: 'Suspender a correção de objetiva' })
    await expect(perigo).toContainText('A suspensão fica na auditoria da escola.')
    const descricao = await perigo.evaluate((dialogo) => document.getElementById(dialogo.getAttribute('aria-describedby') ?? '')?.textContent ?? '')
    expect(descricao).toContain('O Assistente para de corrigir atividades nesta escola')
    expect(descricao).toContain('A suspensão fica na auditoria da escola.')
    const confirmar = perigo.getByRole('button', { name: 'Suspender a função' })
    expect(await desenho(confirmar)).toMatchObject({ fundo: RGB.vermelho })
    await acionar(confirmar, hasTouch)
    await expect(perigo).toHaveCount(0)
    await expect(decisao).toHaveText('Suspensa')

    // Aprovar pelo teclado. O botão que abriu desliga depois da aprovação: o foco não volta para ele, e também não cai
    // no `body` — vai para o resultado.
    await gatilho.focus()
    await page.keyboard.press('Enter')
    await aprovar.focus()
    await page.keyboard.press('Enter')
    await expect(oficial).toHaveCount(0)
    await expect(decisao).toHaveText('Aprovado')
    await expect(gatilho).toBeDisabled()
    await expect(decisao).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)
  })
  test('o diálogo comum: o Tab e o Shift+Tab não saem dele, o Esc fecha e o foco volta ao botão que abriu', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'dialogo')
    const gatilho = bloco.getByRole('button', { name: 'Nova disciplina' })
    await acionar(gatilho, hasTouch)
    const dialogo = page.getByRole('dialog', { name: 'Nova disciplina' })
    await expect(dialogo).toBeVisible()

    // O foco está dentro, e o Tab volta ao primeiro controle depois do último, nos dois sentidos: voltas e meia a mais
    // do que há de controles, para o Tab passar pelo limite das duas pontas.
    const controles = await dialogo.locator('input, button').count()
    expect(controles).toBe(3)
    for (let passo = 0; passo < controles * 2 + 1; passo++) {
      await page.keyboard.press('Tab')
      expect(await estaDentro(dialogo), `Tab ${String(passo + 1)}`).toBe(true)
    }
    for (let passo = 0; passo < controles * 2 + 1; passo++) {
      await page.keyboard.press('Shift+Tab')
      expect(await estaDentro(dialogo), `Shift+Tab ${String(passo + 1)}`).toBe(true)
    }
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)

    // A caixa tem até 520 px (`Dialogo`, `docs/interface.md` 10.2) e, na janela estreita, a janela menos duas margens de
    // 16 px. O rodapé fica à direita: o último botão termina na borda do miolo, que é o enchimento de 24 px (20 abaixo de 640).
    const janela = page.viewportSize()
    if (janela === null) throw new Error('o projeto não tem janela')
    const medidaDoDialogo = await caixa(dialogo)
    // O `max-width` do próprio `dialog` modal no navegador (`100% - 6px - 2em`) tira 6 px a mais que a margem de 16 px.
    const larguraEsperada = Math.min(520, janela.width - 32)
    expect(medidaDoDialogo.width).toBeLessThanOrEqual(larguraEsperada)
    expect(medidaDoDialogo.width).toBeGreaterThanOrEqual(larguraEsperada - 8)
    const enchimento = janela.width >= 640 ? 24 : 20
    const ultimoBotao = await caixa(dialogo.getByRole('button', { name: 'Cancelar' }))
    expect(Math.abs(ultimoBotao.x + ultimoBotao.width - (medidaDoDialogo.x + medidaDoDialogo.width - enchimento))).toBeLessThanOrEqual(0.5)
    // Os dois botões ficam juntos no fim da linha: sobra espaço à esquerda do primeiro, e não à direita do último.
    const primeiroBotao = await caixa(dialogo.getByRole('button', { name: 'Criar disciplina' }))
    expect(primeiroBotao.x - (medidaDoDialogo.x + enchimento)).toBeGreaterThan(40)
    expect(primeiroBotao.x).toBeLessThan(ultimoBotao.x)

    // O que foi digitado vai ao resultado, e o foco volta ao botão que abriu.
    await dialogo.getByLabel('Nome da disciplina').fill('Química orgânica')
    await acionar(dialogo.getByRole('button', { name: 'Criar disciplina' }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(bloco.locator('[data-dialogo-resultado]')).toHaveText('Disciplina criada: Química orgânica')
    await expect(gatilho).toBeFocused()

    // O Esc cancela, sem criar nada, e o foco volta ao mesmo botão.
    await acionar(gatilho, hasTouch)
    await expect(dialogo).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await expect(gatilho).toBeFocused()
    await expect(bloco.locator('[data-dialogo-resultado]')).toHaveText('Disciplina criada: Química orgânica')
  })

  test('o Esc de dentro do menu fecha o menu, e não o diálogo atrás: o seguinte é que fecha o diálogo', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'dialogo')
    const gatilho = bloco.getByRole('button', { name: 'Atribuir à turma' })
    await acionar(gatilho, hasTouch)
    const dialogo = page.getByRole('dialog', { name: 'Atribuir à turma' })
    await expect(dialogo).toBeVisible()

    const botao = dialogo.getByRole('button', { name: /2ºB · Química/ })
    await acionar(botao, hasTouch)
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    // O menu aberto dentro do diálogo cabe na janela, e o Esc é dele.
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(dialogo).toBeVisible()
    await expect(botao).toBeFocused()

    // Escolher fecha o menu, troca o rótulo e deixa o diálogo onde estava.
    await acionar(botao, hasTouch)
    await acionar(menu.getByRole('menuitemradio', { name: '1ºA · Química' }), hasTouch)
    await expect(menu).toHaveCount(0)
    await expect(dialogo.getByRole('button', { name: /1ºA · Química/ })).toBeFocused()
    await expect(dialogo).toBeVisible()

    // Com o menu fechado, o Esc é do diálogo, e o foco volta a quem abriu.
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await expect(gatilho).toBeFocused()
  })

  test('a confirmação de perigo: o foco começa no texto, os dois botões têm a mesma altura e, depois de excluir, o foco vai ao resultado', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'dialogo')
    const resultado = bloco.locator('[data-dialogo-resultado]')
    const gatilho = bloco.getByRole('button', { name: 'Excluir a turma 2ºB' })
    await acionar(gatilho, hasTouch)
    const confirmacao = page.getByRole('dialog', { name: 'Excluir a turma 2ºB' })
    await expect(confirmacao).toBeVisible()
    const excluir = confirmacao.getByRole('button', { name: 'Excluir a turma' })
    const cancelar = confirmacao.getByRole('button', { name: 'Cancelar' })
    await expect(excluir).not.toBeFocused()
    await expect(cancelar).not.toBeFocused()
    expect(await confirmacao.evaluate((alvo) => alvo.contains(document.activeElement))).toBe(true)
    // O perigo cheio, e o botão ao lado com a mesma altura (D59). Esta confirmação tem os botões à direita, cada um com a
    // largura do próprio rótulo: as duas colunas iguais são da `DialogoDeConfirmacao`, provadas no caso seguinte.
    expect(await desenho(excluir)).toMatchObject({ fundo: RGB.vermelho })
    expect((await caixa(excluir)).height).toBe((await caixa(cancelar)).height)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await acionar(excluir, hasTouch)
    await expect(confirmacao).toHaveCount(0)
    await expect(resultado).toHaveText('Turma excluída: 2ºB')
    // O gatilho desligou com o que fez: o foco não cai no `body`, vai para o resultado.
    await expect(gatilho).toBeDisabled()
    await expect(resultado).toBeFocused()
  })

  test('a confirmação oficial e a de perigo: dois botões do mesmo tamanho, cancelar antes de confirmar, lado a lado no computador e empilhados no celular', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'confirmacao')
    const largura = page.viewportSize()?.width ?? 0
    const casos = [
      { gatilho: 'Aprovar 32 correções', dialogo: 'Aprovar 32 correções', confirmar: 'Aprovar 32 correções' },
      { gatilho: 'Suspender a função', dialogo: 'Suspender a correção de objetiva', confirmar: 'Suspender a função' },
    ] as const
    for (const caso of casos) {
      await acionar(bloco.getByRole('button', { name: caso.gatilho }), hasTouch)
      const confirmacao = page.getByRole('alertdialog', { name: caso.dialogo })
      await expect(confirmacao).toBeVisible()
      const botoes = confirmacao.locator('[data-botoes-da-confirmacao] button')
      // Cancelar vem antes de confirmar, na tela e na ordem do Tab.
      await expect(botoes).toHaveText(['Cancelar', caso.confirmar])
      const cancelar = botoes.first()
      const confirmar = botoes.last()
      const [medidaDeCancelar, medidaDeConfirmar] = [await caixa(cancelar), await caixa(confirmar)]
      expect(medidaDeCancelar.height, caso.gatilho).toBe(medidaDeConfirmar.height)
      expect(Math.abs(medidaDeCancelar.width - medidaDeConfirmar.width), caso.gatilho).toBeLessThanOrEqual(0.5)
      expect(medidaDeCancelar.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      if (largura >= 640) {
        // Duas colunas iguais: o mesmo alto, um ao lado do outro.
        expect(medidaDeCancelar.y).toBe(medidaDeConfirmar.y)
        expect(medidaDeCancelar.x).toBeLessThan(medidaDeConfirmar.x)
      } else {
        // Empilhados, cada um com a largura inteira da caixa, e o cancelar em cima.
        expect(medidaDeCancelar.x).toBe(medidaDeConfirmar.x)
        expect(medidaDeCancelar.y).toBeLessThan(medidaDeConfirmar.y)
      }
      expect(await larguraExcedenteDoDialogo(page)).toBe(0)
      await expect(cancelar).not.toBeFocused()
      await expect(confirmar).not.toBeFocused()
      // O foco começa no texto, que está fora da ordem do Tab e antes dos dois botões: o Shift+Tab, que não tem controle
      // antes dele, vai ao último, o que confirma, e não sai da caixa para a barra do navegador.
      await page.keyboard.press('Shift+Tab')
      await expect(confirmar).toBeFocused()
      expect(await estaDentro(confirmacao), caso.gatilho).toBe(true)
      // O Tab no último volta ao primeiro: a ordem é Cancelar e depois o que confirma, e ela fecha o círculo.
      await page.keyboard.press('Tab')
      await expect(cancelar).toBeFocused()
      expect(await estaDentro(confirmacao), caso.gatilho).toBe(true)
      await page.keyboard.press('Tab')
      await expect(confirmar).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(cancelar).toBeFocused()
      expect(await estaDentro(confirmacao), caso.gatilho).toBe(true)
      await page.keyboard.press('Escape')
      await expect(confirmacao).toHaveCount(0)
    }
  })

  test('o painel ao lado: 480 px colados à direita no computador, folha de baixo no celular, e o foco entra no miolo', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'painel-lado')
    const gatilho = bloco.getByRole('button', { name: 'Abrir o painel da turma 2ºB' })
    await acionar(gatilho, hasTouch)
    const painel = page.getByRole('dialog', { name: 'Turma 2ºB · Química' })
    await expect(painel).toBeVisible()
    const janela = page.viewportSize()
    if (janela === null) throw new Error('o projeto não tem janela')
    const medida = await caixa(painel)

    if (janela.width >= 768) {
      // O painel de 480 px, colado à direita e na altura da janela.
      expect(medida.width).toBe(480)
      expect(medida.x + medida.width).toBe(janela.width)
      expect(medida.y).toBe(0)
      expect(medida.height).toBe(janela.height)
    } else {
      // A folha de baixo: a largura da janela, encostada no pé, com até 88% da altura.
      expect(medida.x).toBe(0)
      expect(medida.width).toBe(janela.width)
      expect(medida.y + medida.height).toBe(janela.height)
      expect(medida.height).toBeLessThanOrEqual(janela.height * 0.88 + 1)
    }
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await larguraExcedente(page)).toBe(0)

    // O foco entra no miolo, e não no "Fechar"; o miolo é comprido e rola por dentro, sem a página junto.
    const miolo = painel.locator('[data-painel-miolo]')
    await expect(miolo).toBeFocused()
    await expect(painel.getByRole('button', { name: 'Fechar' })).not.toBeFocused()
    expect(await miolo.evaluate((alvo) => alvo.scrollHeight > alvo.clientHeight)).toBe(true)
    // O cabeçalho tem 64 px, e o "Fechar" é um alvo de toque de 44.
    const fechar = await caixa(painel.getByRole('button', { name: 'Fechar' }))
    expect(fechar.width).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(fechar.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    const cabecalho = await painel.getByRole('heading', { name: 'Turma 2ºB · Química' }).evaluate((titulo) => titulo.parentElement?.getBoundingClientRect().height ?? 0)
    expect(cabecalho).toBeGreaterThanOrEqual(64)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o painel ao lado: foco preso, o Esc do menu é do menu, o toque fora não fecha, e o foco volta a quem abriu ou ao resultado', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const bloco = secao(page, 'painel-lado')
    const gatilho = bloco.getByRole('button', { name: 'Abrir o painel da turma 2ºB' })
    const resultado = bloco.locator('[data-painel-resultado]')
    await acionar(gatilho, hasTouch)
    const painel = page.getByRole('dialog', { name: 'Turma 2ºB · Química' })
    await expect(painel).toBeVisible()

    // O Tab e o Shift+Tab não saem do painel: passam de uma ponta à outra e voltam.
    const controles = await painel.locator('a[href], button:not([disabled]), input:not([disabled])').count()
    expect(controles).toBeGreaterThanOrEqual(4)
    for (let passo = 0; passo < controles + 2; passo++) {
      await page.keyboard.press('Tab')
      expect(await estaDentro(painel), `Tab ${String(passo + 1)}`).toBe(true)
    }
    for (let passo = 0; passo < controles + 2; passo++) {
      await page.keyboard.press('Shift+Tab')
      expect(await estaDentro(painel), `Shift+Tab ${String(passo + 1)}`).toBe(true)
    }

    // O Esc do menu de dentro fecha o menu, e o painel fica.
    const ordem = painel.getByRole('button', { name: /Ordem por nome/ })
    await acionar(ordem, hasTouch)
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(painel).toBeVisible()
    await expect(ordem).toBeFocused()

    // O toque fora do painel não o fecha: ele guardaria o que a pessoa digitou.
    const janela = page.viewportSize()
    if (janela === null) throw new Error('o projeto não tem janela')
    const [x, y] = janela.width >= 768 ? [20, 20] : [janela.width / 2, 8]
    await (hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
    await expect(painel).toBeVisible()

    // O "Fechar" fecha, e o foco volta ao botão que abriu.
    await acionar(painel.getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(painel).toHaveCount(0)
    await expect(gatilho).toBeFocused()

    // O Esc também fecha, e o foco volta ao mesmo botão.
    await acionar(gatilho, hasTouch)
    await expect(painel).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)
    await expect(gatilho).toBeFocused()

    // Aplicar fecha com o botão que abriu desligado: o foco não cai no `body`, vai para o resultado (`focoDeReserva`).
    await acionar(gatilho, hasTouch)
    await acionar(painel.getByRole('button', { name: 'Aplicar' }), hasTouch)
    await expect(painel).toHaveCount(0)
    await expect(resultado).toHaveText('Painel aplicado: ordem por nome')
    await expect(gatilho).toBeDisabled()
    await expect(resultado).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)
  })

  test('o item do menu e o "Fechar" do painel têm 44 px de alto, e o menu aberto no painel cabe na janela', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    await acionar(secao(page, 'painel-lado').getByRole('button', { name: 'Abrir o painel da turma 2ºB' }), hasTouch)
    const painel = page.getByRole('dialog', { name: 'Turma 2ºB · Química' })
    await acionar(painel.getByRole('button', { name: /Ordem por nome/ }), hasTouch)
    const itens = page.getByRole('menu').getByRole('menuitemradio')
    await expect(itens).toHaveCount(2)
    for (const item of await itens.all()) {
      expect((await caixa(item)).height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    const janela = page.viewportSize()
    const menu = await caixa(page.getByRole('menu'))
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(janela?.width ?? 0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  // Um caso por tema e por peça aberta: os quatro em sequência num caso só levavam 12 s aqui e 31,7 s no runner da esteira
  // (execução 39234137170), contra o prazo de 30 s. A galeria abre em ~1 s, então abrir uma peça por caso custa pouco.
  for (const tema of TEMAS) {
    for (const aberto of ABERTOS) {
      test(`${aberto.nome}, no tema ${tema}: ${aberto.borda}, véu do tema, sem violação do axe`, async ({ page, hasTouch }) => {
        await abrirGaleria(page)
        await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
        const veuEsperado = tema === 'claro' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.6)'
        const borda = await corDoToken(page, 'borda')
        const alvo = aberto.alvo(page)

        await acionar(secao(page, aberto.bloco).getByRole('button', { name: aberto.gatilho }), hasTouch)
        await expect(alvo).toBeVisible()
        const estilo = await alvo.evaluate((dialogo) => {
          const caixaDoDialogo = getComputedStyle(dialogo)
          return {
            veu: getComputedStyle(dialogo, '::backdrop').backgroundColor,
            sombra: caixaDoDialogo.boxShadow,
            fundo: caixaDoDialogo.backgroundColor,
            bordaDeCima: caixaDoDialogo.borderTopWidth,
            bordaDaEsquerda: caixaDoDialogo.borderLeftWidth,
            bordaDeBaixo: caixaDoDialogo.borderBottomWidth,
            canto: caixaDoDialogo.borderTopLeftRadius,
          }
        })
        expect(estilo.veu, `${aberto.bloco}: véu`).toBe(veuEsperado)
        expect(estilo.fundo, `${aberto.bloco}: fundo`).toBe(await corDoToken(page, 'superficie'))
        if (aberto.bloco === 'painel-lado') {
          // O painel é colado à janela: a borda de 2 px é a de um lado só (à esquerda no computador, em cima na folha), sem degrau.
          const janela = page.viewportSize()
          if ((janela?.width ?? 0) >= 768) expect(estilo.bordaDaEsquerda).toBe('2px')
          else expect(estilo.bordaDeCima).toBe('2px')
        } else {
          // Anel de 2 px mais o degrau sólido de 4 px, os dois em `borda`, e o canto de 16 px.
          // O navegador devolve antes delas as sombras transparentes do anel do Tailwind: só as duas últimas são nossas.
          const degrau = `${borda} 0px 0px 0px 2px, ${borda} 0px 4px 0px 0px`
          expect(estilo.sombra.slice(-degrau.length), `${aberto.bloco}: borda e degrau`).toBe(degrau)
          expect(estilo.canto, `${aberto.bloco}: canto`).toBe('16px')
        }
        // O botão que confirma, nos dois temas: o `perigo` cheio é o `vermelho` do tema, e o oficial não o é.
        if (aberto.confirmar === 'perigo') {
          const cheio = await desenho(alvo.getByRole('button', { name: aberto.gatilho }))
          expect(cheio.fundo, `${aberto.gatilho}: perigo cheio`).toBe(await corDoToken(page, 'vermelho'))
        }
        if (aberto.confirmar === 'oficial') {
          const oficial = await desenho(alvo.getByRole('button', { name: aberto.gatilho }))
          expect(oficial.fundo, `${aberto.gatilho}: oficial`).not.toBe(await corDoToken(page, 'vermelho'))
        }
        expect(await violacoesGraves(page), `${aberto.bloco}: axe`).toEqual([])
        await page.keyboard.press('Escape')
        await expect(alvo).toHaveCount(0)
      })
    }
  }
})
