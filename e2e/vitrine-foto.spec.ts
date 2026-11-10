import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from './support/profiles.ts'
import { criarEscolaSintetica, gerarAcessoDaSalaNoBanco, montarEstruturaNoBanco, porNaListaDaTurma } from './support/seed.ts'
import { tirarAFoto } from '../tools/vitrine/captura.ts'

/**
 * A foto da vitrine (`tools/vitrine/captura.ts`): a página mais alta que a janela, como a sala (`/e/<slug>/turma`), sai com a entrada da onça no fim, e não recomeçada.
 * O `fullPage` do Playwright redimensiona a página para tirar a foto, e o Chromium reinicia as animações CSS nesse momento: a onça saía translúcida (opacidade perto de 0,4, rodando)
 * em todo recorte de uma tela que rola. Com `animations: 'disabled'` ela sai no último quadro. É a tela real, e não uma página de teste: o reinício que importa só aconteceu nela.
 * No celular a onça é parada: lá o caso só confere que nada recomeça, e a espera pela entrada é só do computador.
 */
test('a foto da página que rola não recomeça a entrada da onça', async ({ page }, testInfo) => {
  const comEntrada = testInfo.project.name !== 'celular'
  const escola = await criarEscolaSintetica()
  const estrutura = await montarEstruturaNoBanco(escola.escolaId, ['7A'])
  const turma = estrutura.turmas[0]
  if (turma === undefined) throw new Error('estrutura sem turma')
  const marca = randomUUID().slice(0, 8)
  await porNaListaDaTurma(
    escola.escolaId,
    turma.id,
    [1, 2, 3, 4, 5, 6].map((indice) => ({ nome: `Aluna sintética ${String(indice)} ${marca}`, matricula: `M${String(indice)}-${marca}` })),
  )
  const acesso = await gerarAcessoDaSalaNoBanco(escola.escolaId, turma.id)

  await page.goto(`/e/${escola.slug}/turma#${acesso.token}`)
  await expect(page.getByRole('main').getByRole('heading', { level: 2, name: `Turma ${turma.nome}` })).toBeVisible()
  const estados = () => page.evaluate(() => document.getAnimations().map((animacao) => (animacao.effect?.getComputedTiming().iterations === Infinity ? 'infinita' : animacao.playState)))
  // A entrada de 240 ms e o aceno que começa depois terminam sozinhos: é o estado em que a foto deve sair.
  if (comEntrada) await expect.poll(async () => (await estados()).length).toBeGreaterThan(0)
  await expect.poll(async () => (await estados()).filter((estado) => estado !== 'finished' && estado !== 'infinita')).toEqual([])
  const antes = await estados()

  const janela = page.viewportSize()
  const altura = Number(await page.evaluate('document.documentElement.scrollHeight'))
  expect(altura, 'a página tem de ser mais alta que a janela: é o que a faz sair pelo `fullPage`').toBeGreaterThan(janela?.height ?? 0)
  // O recorte é o pedaço da página comprida: a foto tem o tamanho dele (o PNG guarda a altura no cabeçalho, 4 bytes a partir do byte 20), e não o da página.
  const arquivo = testInfo.outputPath('foto-da-sala.png')
  const alturaDoRecorte = altura - 100
  await tirarAFoto(page, arquivo, { x: 0, y: 0, width: janela?.width ?? 0, height: alturaDoRecorte })
  const escala = Number(await page.evaluate('window.devicePixelRatio'))
  expect(readFileSync(arquivo).readUInt32BE(20)).toBe(alturaDoRecorte * escala)

  expect(await estados()).toEqual(antes)
})
