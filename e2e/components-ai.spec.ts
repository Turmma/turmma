import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { avaliarAvatares, avaliarSelos, conferirAssinaturas } from './support/avatar.ts'
import { abrirGaleria, acionar, caixa, conferirQueCabeNaJanela, conferirQueOFocoNaoCaiu, desenho, desenhos, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, corDoToken, focoVisivel, IMPACTOS_QUE_REPROVAM, larguraExcedente, TAGS_WCAG, violacoesGraves } from './support/checks.ts'

/**
 * As peças do MVP de apresentação (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 11.1 e 11.3), na galeria (`/galeria`),
 * nos projetos `chromebook` e `celular`: o que a regra de cada peça promete, visto no navegador. A galeria não chama a
 * API e não tem sessão; o dado é inventado, escrito nela.
 *
 * Este arquivo é o grupo `ia` do antigo `pecas.spec.ts` (tarefa 2.0 da X1): cada caso veio inteiro, com a mesma
 * asserção, e só mudou de arquivo. Os auxiliares comuns estão em `support/gallery.ts`.
 */

/** As seções da conversa que o axe e a medida do alvo percorrem. */
const SECOES_DA_CONVERSA = ['selo-de-ia', 'conversa', 'escolha-estados', 'caixa-pedido', 'caixa-do-aluno', 'caixa-desligada', 'pagina-mini', 'motor', 'motor-com-falha', 'motor-da-adaptacao'] as const
/** As peças de ação: o chip, que corre dentro da linha, fica de fora e é medido à parte. */
const ALVOS_DE_ACAO = 'button:not([data-texto-da-ia] button), summary, label:has(input), select, textarea, input:not([type="checkbox"])'

/** Os hex da 9.1 do `docs/interface.md`, como o navegador os devolve no estilo calculado: só os que este arquivo afirma. */
const RGB = {
  laranja: 'rgb(232, 115, 46)',
  grafite: 'rgb(51, 51, 51)',
  superficie: 'rgb(255, 255, 255)',
  iaFundo: 'rgb(240, 240, 240)',
  iaTexto: 'rgb(66, 66, 66)',
  okFundo: 'rgb(233, 245, 238)',
  pendenteFundo: 'rgb(253, 240, 232)',
  erroFundo: 'rgb(253, 236, 236)',
} as const

test.describe('peças do MVP de apresentação, na galeria', () => {
  test('o selo de IA e a assinatura: o texto "IA" em toda saída de IA, um desenho só, e avatar da onça em círculo com anel, nunca pessoa', async ({ page }) => {
    await abrirGaleria(page)
    const seloDeIa = secao(page, 'selo-de-ia')

    // A assinatura: o nome da função e o selo com o texto "IA", para o agente e para a função dele.
    for (const nome of ['Assistente de ensino', 'Tutor', 'Analista de desempenho escolar', 'Assistente · correção de objetiva']) {
      const assinatura = seloDeIa.locator('[data-assinatura]', { hasText: nome }).filter({ has: page.locator('[data-agente]') })
      await expect(assinatura, nome).toHaveCount(1)
      await expect(assinatura.getByText('IA', { exact: true }), nome).toBeVisible()
    }

    // Um conjunto só, igual em todo o produto: todo selo "IA" da tela tem o mesmo desenho, em família `ia`. O que a sigla
    // quer dizer está em texto, para o leitor de tela, e não num `title`, que só existe no hover.
    // Todos os selos numa ida ao navegador, e não quatro por selo: no runner da esteira (CPU ×4) o laço passava dos 30 s.
    const selos = page.locator('[data-selo-ia]')
    const relatorioDosSelos = await avaliarSelos(page)
    expect(relatorioDosSelos.total).toBeGreaterThanOrEqual(10)
    expect(relatorioDosSelos.falhas).toEqual([])
    const desenhosDosSelos = await desenhos(selos)
    expect(desenhosDosSelos).toHaveLength(relatorioDosSelos.total)
    expect([...new Set(desenhosDosSelos.map((d) => JSON.stringify(d)))]).toHaveLength(1)
    expect(desenhosDosSelos[0]).toMatchObject({ fundo: RGB.iaFundo, texto: RGB.iaTexto })

    // Toda mensagem de IA da conversa assina: avatar, nome e selo. Nas duas variantes e no "preparando a resposta".
    const mensagensDeIa = secao(page, 'conversa')
      .locator('article')
      .filter({ has: page.locator('[data-agente]') })
    expect(await mensagensDeIa.count()).toBe(5)
    for (const mensagem of await mensagensDeIa.all()) await expect(mensagem.getByText('IA', { exact: true })).toBeVisible()
    await expect(mensagensDeIa.filter({ hasText: 'Corrigi as 32 atividades' }).getByText('Assistente · correção de objetiva')).toBeVisible()
    await expect(mensagensDeIa.filter({ hasText: 'Oito alunos travaram' }).getByText('Tutor · sinais para o professor')).toBeVisible()

    // O avatar: a cabeça da onça num círculo `fundo` com o anel de 2 px na cor do agente, um por agente, e nenhuma
    // imagem dentro (D58). Quem é o agente e a função dele está no bloco, e nunca só na cor: A28 e RF10.
    const avatares = page.locator('[data-agente]')
    for (const agente of ['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar']) expect(await page.locator(`[data-agente="${agente}"]`).count(), agente).toBeGreaterThan(0)
    // Idem: todos os avatares numa ida só.
    const relatorioDosAvatares = await avaliarAvatares(page)
    expect(relatorioDosAvatares.total).toBeGreaterThan(0)
    expect(relatorioDosAvatares.falhas).toEqual([])
    const [fundo, azul, laranja, anil] = await Promise.all(['fundo', 'azul', 'laranja', 'anil'].map((token) => corDoToken(page, token)))
    expect(await desenho(page.locator('[data-agente="assistente_de_ensino"]').first())).toMatchObject({ fundo, borda: `2px solid ${azul}` })
    expect(await desenho(page.locator('[data-agente="tutor"]').first())).toMatchObject({ fundo, borda: `2px solid ${laranja}` })
    expect(await desenho(page.locator('[data-agente="analista_de_desempenho_escolar"]').first())).toMatchObject({ fundo, borda: `2px solid ${anil}` })
    // Todo avatar da galeria tem, no bloco dele, o nome da função em texto visível e um selo "IA".
    expect(await conferirAssinaturas(page)).toBe(await avatares.count())

    // A linha da aprovação: quem aprovou e quando, em `ok`; a pendente e a rejeitada com o motivo. O ano só aparece
    // quando não é o de agora, e por isso é opcional aqui.
    const aprovada = seloDeIa.locator('[data-aprovacao="aprovada"]')
    await expect(aprovada).toHaveText(/^Aprovado por Camila Souza · 19\/09(\/2026)?, 10h42$/)
    await expect(aprovada.locator('svg')).toHaveCount(1)
    await expect(seloDeIa.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você')
    const rejeitada = seloDeIa.locator('[data-aprovacao="rejeitada"]')
    // A rejeição é escrita com a pessoa como sujeito: não depende do gênero de quem rejeitou nem do que foi rejeitado.
    await expect(rejeitada).toContainText(/Camila Souza rejeitou · 19\/09(\/2026)?, 10h42/)
    await expect(rejeitada).toContainText('Motivo: A questão 3 não é do capítulo 7.')

    // A linha da aprovação é o selo de estado, e não um segundo desenho: mesma cor, mesmo canto, mesmo respiro.
    const selosDeEstado = secao(page, 'estado')
    for (const [estado, familia, fundo] of [
      ['aprovada', 'ok', RGB.okFundo],
      ['pendente', 'pendente', RGB.pendenteFundo],
      ['rejeitada', 'erro', RGB.erroFundo],
    ] as const) {
      const daLinha = await desenho(seloDeIa.locator(`[data-aprovacao="${estado}"] [data-estado]`))
      expect(daLinha, estado).toEqual(await desenho(selosDeEstado.locator(`[data-estado="${familia}"]`)))
      expect(daLinha.fundo, estado).toBe(fundo)
    }

    // Na mensagem, a aprovação tem lugar fixo: depois do conteúdo e antes das ações.
    const comAprovacao = mensagensDeIa.filter({ has: page.locator('[data-texto-da-ia]') })
    const daMensagem = comAprovacao.locator('[data-aprovacao="aprovada"]')
    await expect(daMensagem).toHaveText(/^Aprovada por Camila Souza · /)
    const [texto, linha, acao] = [await caixa(comAprovacao.locator('[data-texto-da-ia]')), await caixa(daMensagem), await caixa(comAprovacao.getByRole('button', { name: 'Copiar' }))]
    expect(texto.y + texto.height).toBeLessThanOrEqual(linha.y)
    expect(linha.y + linha.height).toBeLessThanOrEqual(acao.y)
  })

  test('a Escolha da D18: duas opções do mesmo tamanho e do mesmo desenho, nenhuma primária, e o foco vai para a linha da escolha', async ({ page }) => {
    await abrirGaleria(page)
    const escolha = page.getByRole('group', { name: 'Posso fazer isso com a ferramenta Atividade, ou só conversar.' })
    const opcoes = escolha.getByRole('button')
    await expect(opcoes).toHaveCount(2)
    const ferramenta = opcoes.filter({ hasText: 'Usar a ferramenta Atividade' })
    const conversa = opcoes.filter({ hasText: 'Só conversar' })

    // Mesmo tamanho, lado a lado no Chromebook e empilhadas no celular.
    const [medidaDaFerramenta, medidaDaConversa] = [await caixa(ferramenta), await caixa(conversa)]
    expect(medidaDaFerramenta.width).toBeCloseTo(medidaDaConversa.width, 0)
    expect(medidaDaFerramenta.height).toBeCloseTo(medidaDaConversa.height, 0)
    expect(medidaDaFerramenta.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    // Mesmo desenho, e nenhum é o da ação primária (laranja) nem o da decisão oficial (grafite): nenhuma é a "certa" (D59).
    // A `noite` de antes não prova nada aqui: o oficial deixou de ser ela, e a lista com ela passaria com o oficial dentro.
    const [desenhoDaFerramenta, desenhoDaConversa] = [await desenho(ferramenta), await desenho(conversa)]
    expect(desenhoDaFerramenta).toEqual(desenhoDaConversa)
    expect(desenhoDaFerramenta.fundo).toBe(RGB.superficie)
    expect([RGB.laranja, RGB.grafite]).not.toContain(desenhoDaFerramenta.fundo)
    // A borda de 2 px na `borda` e o degrau de 4 px na mesma cor, iguais nas duas: a peça se aperta, e nenhuma pesa mais.
    const borda = await corDoToken(page, 'borda')
    expect(desenhoDaFerramenta.borda).toBe(`2px solid ${borda}`)
    expect(desenhoDaFerramenta.peso).toBe(desenhoDaConversa.peso)
    const degraus = await opcoes.evaluateAll((botoes) => botoes.map((botao) => getComputedStyle(botao).boxShadow))
    expect(degraus).toEqual([`${borda} 0px 4px 0px 0px`, `${borda} 0px 4px 0px 0px`])
    // Nenhuma vem com o foco: o Enter de quem chega não escolhe por ela.
    expect(await opcoes.evaluateAll((botoes) => botoes.some((botao) => botao === document.activeElement))).toBe(false)

    // Pelo teclado: o botão escolhido some com o cartão, e o foco vai para a linha que diz o que foi escolhido.
    await conversa.focus()
    await page.keyboard.press('Enter')
    const feita = secao(page, 'conversa').locator('[data-escolha="feita"]')
    await expect(feita).toHaveText('Você escolheu: Só conversar')
    await expect(escolha).toHaveCount(0)
    await expect(feita).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)
    // Uma linha: o cartão de duas opções deu lugar a uma pílula da altura de um texto.
    expect((await caixa(feita)).height).toBeLessThan(medidaDaConversa.height)
  })

  test('a Escolha desligada e a escolhida: as duas opções desligam juntas, sem degrau e sem cor de ação, e a linha da escolha é uma só', async ({ page }) => {
    await abrirGaleria(page)
    const estados = secao(page, 'escolha-estados')
    const desligada = estados.getByRole('group', { name: 'Posso montar o plano de aula com a ferramenta, ou só conversar.' })
    const opcoes = desligada.getByRole('button')
    await expect(opcoes).toHaveCount(2)
    await expect(opcoes.first()).toBeDisabled()
    await expect(opcoes.last()).toBeDisabled()
    const [primeira, segunda] = [await desenho(opcoes.first()), await desenho(opcoes.last())]
    expect(primeira).toEqual(segunda)
    // Peça desligada é outro desenho: face `borda`, texto `apoio`, sem degrau (`docs/interface.md` 9.3).
    const [borda, apoio] = await Promise.all([corDoToken(page, 'borda'), corDoToken(page, 'apoio')])
    expect(primeira).toMatchObject({ fundo: borda, texto: apoio })
    expect(await opcoes.evaluateAll((botoes) => botoes.map((botao) => getComputedStyle(botao).boxShadow))).toEqual(['none', 'none'])
    // A descrição da opção desligada também é `apoio`: o `sutil` sobre a face `borda` não chega a 4,5:1.
    expect(await opcoes.first().locator('span span').last().evaluate((no) => getComputedStyle(no).color)).toBe(apoio)

    const feita = estados.locator('[data-escolha="feita"]')
    await expect(feita).toHaveText('Você escolheu: Só conversar')
    await expect(estados.locator('[data-escolha="aberta"]')).toHaveCount(1)
    expect(await desenho(feita)).toMatchObject({ borda: `2px solid ${borda}` })
  })

  // Este caso era um só, de 9,8 s na máquina e 24,5 s no runner do celular (execução 40880199949, 1ª tentativa; mais de 30 s na
  // esteira anterior); são quatro, que abrem a galeria cada um e dividem o que ele afirmava, na mesma ordem e sem tirar asserção.
  test('o texto da IA entra como texto, com os chips no fim, um por fonte, na pílula de 28 px', async ({ page }) => {
    await abrirGaleria(page)
    const texto = secao(page, 'conversa').locator('[data-texto-da-ia]')

    // O que o modelo devolveu com cara de HTML está escrito, e não virou marcação.
    await expect(texto).toContainText('Use <b>massa molar</b> e a proporção da equação balanceada.')
    await expect(texto.locator('b, strong, em, script, img, h1, h2, h3, pre, code')).toHaveCount(0)
    await expect(texto.locator('> ul, > ol')).toHaveCount(0)
    // A marcação de Markdown que o modelo mandou sai, sem virar título nem lista: `###`, `**` e o marcador somem, o item
    // de lista vira parágrafo, e a quebra de linha simples fica dentro do parágrafo dela.
    await expect(texto.locator('p').first()).toHaveText('Lista de estequiometria')
    await expect(texto.locator('p').nth(1)).toContainText('Questão 1. Qual a massa de CO₂ formada na queima de 24 g de carbono?')
    await expect(texto.locator('p').nth(1)).toContainText('Questão 2. Qual é o reagente limitante quando sobra oxigênio?')
    expect(await texto.textContent()).not.toMatch(/\*\*|###/)
    // O asterisco que é conteúdo fica: a conta continua uma conta.
    await expect(texto.locator('p').nth(2)).toHaveText('Lembre: 2 * 12 = 24 g de carbono.')
    // Um chip por fonte, sem repetir a página citada duas vezes.
    const chips = texto.getByRole('button', { name: /^Fonte: / })
    await expect(chips).toHaveCount(3)
    await expect(chips).toHaveText([/p\. 142$/, /p\. 145$/, /p\. 151$/])
    // A pílula de 28 px, com a borda de 2 px e o canto inteiro: o alvo de 24 px do piso (WCAG 2.5.8) com folga.
    expect(await desenho(chips.first())).toMatchObject({ borda: `2px solid ${await corDoToken(page, 'borda')}`, peso: '700', fonte: '15px' })
    expect((await caixa(chips.first())).height).toBe(28)
  })

  test('o ChipFonte abre pelo teclado e mostra o trecho, que cabe na janela e não tem violação', async ({ page }) => {
    await abrirGaleria(page)
    const chip = page.getByRole('button', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    await expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect((await caixa(chip)).height).toBeGreaterThanOrEqual(24)

    await chip.focus()
    await page.keyboard.press('Enter')
    await expect(chip).toHaveAttribute('aria-expanded', 'true')
    const cartao = page.getByRole('group', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    await expect(cartao).toBeVisible()
    await expect(cartao).toContainText('Química 2, cap. 7')
    await expect(cartao).toContainText('Página 142')
    await expect(cartao).toContainText('A proporção entre as quantidades de matéria de reagentes e produtos é dada pelos coeficientes da equação balanceada.')
    await conferirQueCabeNaJanela(page, cartao)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o Esc fecha o cartão e devolve o foco ao chip, com o anel à vista, e o Tab não deixa o cartão aberto para trás', async ({ page }) => {
    await abrirGaleria(page)
    const chip = page.getByRole('button', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    const cartao = page.getByRole('group', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    await chip.focus()
    await page.keyboard.press('Enter')
    await expect(cartao).toBeVisible()

    // O Esc fecha e devolve o foco ao chip, com o anel à vista.
    await page.keyboard.press('Escape')
    await expect(cartao).toHaveCount(0)
    await expect(chip).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)

    // O Tab que segue adiante não deixa o cartão aberto para trás.
    await page.keyboard.press('Enter')
    await expect(cartao).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(cartao).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Fonte: Química 2, cap. 7, p. 145' })).toBeFocused()
  })

  test('o ChipFonte abre pelo toque, tocar no trecho não fecha, o toque fora fecha, e a lista de fontes diz as páginas sem repetir', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const chip = page.getByRole('button', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    const cartao = page.getByRole('group', { name: 'Fonte: Química 2, cap. 7, p. 142' })

    // Pelo toque (ou pelo clique) abre do mesmo jeito; tocar no trecho não fecha, e o toque fora fecha.
    await acionar(chip, hasTouch)
    await expect(cartao).toBeVisible()
    await acionar(cartao.getByText('A proporção entre as quantidades'), hasTouch)
    await expect(cartao).toBeVisible()
    await acionar(page.getByRole('heading', { level: 1, name: 'Galeria de peças' }), hasTouch)
    await expect(cartao).toHaveCount(0)

    // A lista de fontes: a linha recolhida já diz as páginas, sem repetir a que foi citada duas vezes.
    const fontes = secao(page, 'conversa').locator('summary')
    await expect(fontes).toHaveText('Fontes (3): Química 2, cap. 7, p. 142 · p. 145 · p. 151')
    await fontes.focus()
    await page.keyboard.press('Enter')
    const lista = secao(page, 'conversa').locator('details li')
    await expect(lista).toHaveCount(3)
    await expect(lista.nth(1)).toContainText('O reagente limitante é o que acaba primeiro')
    expect(await larguraExcedente(page)).toBe(0)
  })

  test('a CaixaPedido: com teclado, Enter envia e Shift+Enter quebra a linha; com o dedo, Enter quebra a linha e o envio é o botão; o foco volta ao campo', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const doProfessor = secao(page, 'caixa-pedido')
    const campo = doProfessor.getByLabel('Pedido ao Assistente de ensino')
    const enviar = doProfessor.getByRole('button', { name: 'Enviar' })
    const parar = doProfessor.getByRole('button', { name: 'Parar' })
    const enviado = doProfessor.locator('[data-enviado]')

    // O ponteiro do projeto é o que decide o que o Enter faz: fino no Chromebook, grosso no celular.
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(hasTouch)
    await expect(campo).toHaveAttribute('enterkeyhint', hasTouch ? 'enter' : 'send')
    // O campo não aceita mais do que o contrato da API aceita.
    await expect(campo).toHaveAttribute('maxlength', '2000')

    // Vazia, não envia: o botão está desligado.
    await expect(enviar).toBeDisabled()
    await acionar(campo, hasTouch)
    await page.keyboard.type('monta uma atividade')
    const alturaDeUmaLinha = (await caixa(campo)).height

    if (hasTouch) {
      // No teclado virtual não existe Shift+Enter: o Enter quebra a linha, e o pedido não sai pela metade.
      await page.keyboard.press('Enter')
      await page.keyboard.type('de estequiometria')
      await expect(campo).toHaveValue('monta uma atividade\nde estequiometria')
      await expect(enviado).toHaveText('')
      await expect(parar).toHaveCount(0)
      await expect.poll(async () => (await caixa(campo)).height).toBeGreaterThan(alturaDeUmaLinha)
      // O envio é o botão, com o toque.
      await enviar.tap()
    } else {
      await page.keyboard.press('Shift+Enter')
      await page.keyboard.type('de estequiometria')
      await expect(campo).toHaveValue('monta uma atividade\nde estequiometria')
      await expect(enviado).toHaveText('')
      await expect.poll(async () => (await caixa(campo)).height).toBeGreaterThan(alturaDeUmaLinha)
      // O botão de enviar é o primário da tela, redondo, com 44 px.
      expect(await desenho(enviar)).toMatchObject({ fundo: RGB.laranja })
      const medidaDoEnviar = await caixa(enviar)
      expect(medidaDoEnviar.width).toBe(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(medidaDoEnviar.height).toBe(ALVO_DE_TOQUE_PRINCIPAL_PX)
      await page.keyboard.press('Enter')
    }
    // Sai com as duas linhas, o campo esvazia, e o foco fica nele: o enviar deu lugar ao "Parar" sem o foco cair.
    await expect(enviado).toHaveText('Enviado: monta uma atividade de estequiometria')
    expect(await enviado.textContent()).toBe('Enviado: monta uma atividade\nde estequiometria')
    await expect(campo).toHaveValue('')
    await expect(campo).toBeFocused()

    // Enquanto a resposta chega, enviar vira "Parar", e um segundo pedido não sai, nem pelo Enter.
    await expect(parar).toBeVisible()
    await expect(enviar).toHaveCount(0)
    await page.keyboard.type('outro pedido')
    await page.keyboard.press('Enter')
    await expect(enviado).toHaveText('Enviado: monta uma atividade de estequiometria')
    // O "Parar" ligado e o desligado não são o mesmo desenho; aqui ele está ligado, com o contorno do secundário, e não o
    // oficial: parar é sair, e sair nunca é menor nem mais enfeitado que entrar (D59).
    expect(await desenho(parar)).toMatchObject({ fundo: RGB.superficie, borda: `2px solid ${await corDoToken(page, 'borda')}` })
    expect((await caixa(parar)).height).toBe(ALVO_DE_TOQUE_PRINCIPAL_PX)

    // Parar pelo teclado: só para — o pedido escrito não sai junto —, e o foco volta ao campo em vez de cair no `body`.
    await parar.focus()
    await page.keyboard.press('Enter')
    await expect(enviar).toBeEnabled()
    await expect(campo).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)
    await expect(enviado).toHaveText('Enviado: monta uma atividade de estequiometria')

    // Enviar pelo botão, acionado pelo teclado: o botão some, e o foco volta ao campo.
    await enviar.focus()
    await page.keyboard.press('Enter')
    await expect(enviado).toHaveText(/^Enviado: outro pedido$/)
    await expect(campo).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)

    // Os encaixes: o menu de ferramenta à esquerda e a turma à direita, passados por quem usa.
    await expect(doProfessor.getByRole('button', { name: 'Ferramenta: Só conversar' })).toBeVisible()
    await expect(doProfessor.getByLabel('Turma do pedido')).toHaveValue('turma-2b')

    // A do aluno é só texto e enviar: sem menu, sem seleção, sem mais nenhum controle.
    const doAluno = secao(page, 'caixa-do-aluno')
    await expect(doAluno.locator('[data-caixa-pedido="so-texto"]')).toHaveCount(1)
    await expect(doAluno.locator('[data-caixa-pedido] select')).toHaveCount(0)
    await expect(doAluno.locator('[data-caixa-pedido] button')).toHaveCount(1)
    await expect(doAluno.getByLabel('Pergunta para o Tutor')).toHaveAttribute('maxlength', '2000')
    await doAluno.getByLabel('Pergunta para o Tutor').fill('o que é reagente limitante?')
    await acionar(doAluno.getByRole('button', { name: 'Enviar' }), hasTouch)
    await expect(doAluno.locator('[data-enviado]')).toHaveText('Enviado: o que é reagente limitante?')
    await expect(doAluno.getByLabel('Pergunta para o Tutor')).toBeFocused()
  })

  test('o motor de formulário diz o que falta e o que é obrigatório, entrega os valores validados, não perde o foco, e a Adaptação não tem campo de texto', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const motor = secao(page, 'motor')
    const gerar = motor.getByRole('button', { name: 'Gerar atividade' })
    // O botão que gera é o primário, e o de cancelar tem o mesmo tamanho.
    expect(await desenho(gerar)).toMatchObject({ fundo: RGB.laranja })
    expect((await caixa(motor.getByRole('button', { name: 'Cancelar' }))).height).toBe((await caixa(gerar)).height)
    // O que é obrigatório está escrito no rótulo e dito ao leitor de tela; o opcional não leva marca.
    await expect(motor.getByText('Turma (obrigatório)')).toBeVisible()
    await expect(motor.getByText('Tema (obrigatório)')).toBeVisible()
    await expect(motor.getByText('Questões (obrigatório)')).toHaveCount(0)
    await expect(motor.getByLabel('Turma')).toHaveAttribute('aria-required', 'true')
    await expect(motor.getByLabel('Tema')).toHaveAttribute('aria-required', 'true')
    await expect(motor.getByLabel('Questões')).not.toHaveAttribute('aria-required')

    // Gerar com o que falta não sai: a tela diz o que falta, e o foco vai ao primeiro campo pendente.
    await acionar(gerar, hasTouch)
    await expect(motor.getByRole('alert')).toHaveText('Para gerar, confira: Turma, Tema.')
    await expect(motor.getByLabel('Turma')).toBeFocused()
    await expect(motor.getByText('Escolha uma opção em "Turma".')).toBeVisible()
    await expect(motor.getByText('Preencha "Tema".')).toBeVisible()
    await expect(motor.locator('[data-pedido]')).toHaveText('')

    await motor.getByLabel('Turma').selectOption('turma-2b')
    await motor.getByLabel('Tema').fill('  Estequiometria ')
    // Número fora da faixa também não sai.
    await motor.getByLabel('Questões').fill('40')
    await acionar(gerar, hasTouch)
    await expect(motor.getByRole('alert')).toHaveText('Para gerar, confira: Questões.')
    await expect(motor.getByText('Use um número inteiro de 1 a 20 em "Questões".')).toBeVisible()
    await motor.getByLabel('Questões').fill('8')

    // Gerar pelo teclado: o botão some com o formulário, e o foco vai para a linha do pedido.
    await gerar.focus()
    await page.keyboard.press('Enter')
    await expect(motor.locator('[data-motor="gerando"]')).toContainText('Atividade objetiva · 2ºB · Química · Estequiometria · Questões: 8')
    await expect(motor.getByRole('status').filter({ hasText: 'Gerando…' })).toBeVisible()
    await conferirQueOFocoNaoCaiu(page)
    expect(await page.evaluate(() => document.activeElement?.closest('[data-motor="gerando"]') !== null)).toBe(true)
    expect(JSON.parse((await motor.locator('[data-pedido]').textContent()) ?? '')).toEqual({ turmaId: 'turma-2b', tema: 'Estequiometria', quantidade: 8 })
    await acionar(motor.getByRole('button', { name: 'Simular a resposta' }), hasTouch)
    await expect(motor.locator('[data-motor="pronto"]')).toContainText('O artefato gerado aparece aqui')

    // "Editar os campos" pelo teclado: o botão some com o pedido recolhido, e o foco vai para o título do formulário.
    await motor.getByRole('button', { name: 'Editar os campos' }).focus()
    await page.keyboard.press('Enter')
    await expect(motor.getByRole('heading', { level: 3, name: 'Atividade objetiva' })).toBeFocused()
    await conferirQueOFocoNaoCaiu(page)
    // Voltar a editar traz o que foi preenchido.
    await expect(motor.getByLabel('Tema')).toHaveValue('  Estequiometria ')

    // A Adaptação: só a lista fechada de tipos. Nenhum campo de texto, nem de uma linha nem de várias (D35, D67).
    const adaptacao = secao(page, 'motor-da-adaptacao')
    await expect(adaptacao.locator('form input[type="checkbox"]')).toHaveCount(6)
    await expect(adaptacao.locator('form input:not([type="checkbox"]), form textarea, form [contenteditable]')).toHaveCount(0)
    await expect(adaptacao.getByText('Tipo de adaptação (obrigatório)')).toBeVisible()
    await acionar(adaptacao.getByRole('button', { name: 'Gerar versão adaptada' }), hasTouch)
    await expect(adaptacao.getByRole('alert')).toHaveText('Para gerar, confira: Tipo de adaptação.')
    await adaptacao.getByLabel('Tempo adicional').check()
    await adaptacao.getByLabel('Fonte ampliada').check()
    await acionar(adaptacao.getByRole('button', { name: 'Gerar versão adaptada' }), hasTouch)
    // Os tipos saem na ordem da lista, e não na do clique.
    expect(JSON.parse((await adaptacao.locator('[data-pedido]').textContent()) ?? '')).toEqual({ tipos: ['fonte_ampliada', 'tempo_adicional'] })
    expect(await larguraExcedente(page)).toBe(0)
  })

  test('o exemplo do campo vazio aparece inteiro: a caixa mede o exemplo, e não só o que se digita', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    for (const [nome, rotulo] of [
      ['caixa-pedido', 'Pedido ao Assistente de ensino'],
      ['caixa-do-aluno', 'Pergunta para o Tutor'],
    ] as const) {
      const campo = secao(page, nome).getByLabel(rotulo)
      const exemplo = (await campo.getAttribute('placeholder')) ?? ''
      expect(exemplo.length, nome).toBeGreaterThan(10)

      // O campo vazio é tão alto quanto o mesmo texto digitado: o `scrollHeight` não conta o exemplo, e a caixa o mede.
      const vazio = (await caixa(campo)).height
      await campo.fill('x')
      const deUmaLinha = (await caixa(campo)).height
      await campo.fill(exemplo)
      await expect.poll(async () => (await caixa(campo)).height, nome).toBeGreaterThanOrEqual(deUmaLinha)
      const digitado = (await caixa(campo)).height
      expect(vazio, nome).toBeGreaterThanOrEqual(digitado)
      // Nenhuma linha do exemplo fica fora do campo: o que a caixa mostra cobre o que o exemplo ocupa.
      expect(await campo.evaluate((no) => no.scrollHeight <= no.clientHeight), nome).toBe(true)
      // A 360 px a caixa tem de ser o caso que quebra o exemplo em mais de uma linha: sem isto o teste passaria vazio.
      if (hasTouch && nome === 'caixa-pedido') expect(vazio, 'o exemplo deveria quebrar a 360 px').toBeGreaterThan(deUmaLinha)

      // Apagar o texto devolve o campo à altura do exemplo.
      await campo.fill('')
      await expect.poll(async () => (await caixa(campo)).height, nome).toBe(vazio)
    }

    // A medida não escreve no campo em uso: quem apaga o pedido inteiro ainda desfaz com Ctrl+Z (o histórico do campo,
    // que trocar o valor por código apagaria).
    const campo = secao(page, 'caixa-pedido').getByLabel('Pedido ao Assistente de ensino')
    await campo.click()
    await page.keyboard.type('monta uma atividade de química')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await expect(campo).toHaveValue('')
    await page.keyboard.press('Control+Z')
    await expect(campo).toHaveValue('monta uma atividade de química')
    expect(await larguraExcedente(page)).toBe(0)
  })

  for (const tema of ['claro', 'escuro'] as const) {
    // Este caso era um só, de 10,5 s na máquina e 27 s no runner do celular (execução 40880199949, 1ª tentativa); são dois por tema:
    // o axe, e o alvo de toque, que agora mede todas as peças numa ida só ao navegador, em vez de uma ida por peça.
    test(`as peças da conversa, no tema ${tema}: sem violação grave`, async ({ page }) => {
      await abrirGaleria(page)
      await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
      expect(await violacoesDasSecoes(page, SECOES_DA_CONVERSA)).toEqual([])

      // Abre o chip e a lista de fontes: o cartão e a lista também passam no axe, nos dois temas.
      const conversa = secao(page, 'conversa')
      await conversa.getByRole('button', { name: 'Fonte: Química 2, cap. 7, p. 142' }).click()
      await conversa.locator('summary').click()
      expect(await violacoesDasSecoes(page, ['conversa'])).toEqual([])
      await page.keyboard.press('Escape')
    })

    test(`as peças da conversa, no tema ${tema}: o alvo de toque do projeto`, async ({ page, hasTouch }) => {
      await abrirGaleria(page)
      await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
      // O alvo: 44 px no celular em toda peça de ação das seções, **inclusive os gatilhos de menu** (o chip, que corre
      // dentro da linha, tem os 28 px da pílula e é medido à parte); no computador, o piso de 24 px (WCAG 2.5.8).
      const minimo = hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24
      // Uma ida só ao navegador para todas as peças: com a CPU ×4 cada `boundingBox` era uma ida, e eram dezenas.
      const medidas = await page.evaluate(
        ({ nomes, seletor }) =>
          nomes.flatMap((nome) =>
            [...(document.querySelector(`[data-galeria="${nome}"]`)?.querySelectorAll(seletor) ?? [])].map((alvo) => {
              const medida = alvo.getBoundingClientRect()
              return { quem: `${nome}: ${alvo.textContent?.slice(0, 30) ?? alvo.getAttribute('aria-label') ?? ''}`, height: medida.height, width: medida.width }
            }),
          ),
        { nomes: [...SECOES_DA_CONVERSA], seletor: ALVOS_DE_ACAO },
      )
      expect(medidas.length, 'alvos medidos').toBeGreaterThan(0)
      for (const medida of medidas) {
        expect(medida.height, medida.quem).toBeGreaterThanOrEqual(minimo)
        expect(medida.width, medida.quem).toBeGreaterThanOrEqual(minimo)
      }
      for (const chip of await secao(page, 'conversa').locator('[data-texto-da-ia] button[aria-expanded]').all()) expect((await caixa(chip)).height).toBeGreaterThanOrEqual(28)
    })
  }
})

/** O axe, só nas seções pedidas: as peças desta tarefa, e não a galeria inteira, que é de outras tarefas. */
async function violacoesDasSecoes(page: Page, nomes: readonly string[]): Promise<{ regra: string; impacto: string; alvos: string[] }[]> {
  let construtor = new AxeBuilder({ page }).withTags([...TAGS_WCAG])
  for (const nome of nomes) construtor = construtor.include(`[data-galeria="${nome}"]`)
  const resultado = await construtor.analyze()
  return resultado.violations
    .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
    .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact ?? '', alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
}
