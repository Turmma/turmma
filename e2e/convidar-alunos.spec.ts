import type { Locator, Page } from '@playwright/test'
import type { AcessoGeradoResponse } from '../packages/shared/src/sala/acesso.ts'
import { PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, porNaListaDaTurma, type EquipeDeTeste } from './support/seed.ts'
import { larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * O diálogo "Convidar alunos" pelo endereço e pela confirmação da turma (telas do professor, 13.0; RF19): `?convidar=1` abre o
 * diálogo na aba Alunos, fechar tira o pedido do endereço, o aviso "Turma confirmada" leva até ele, e o passo "Acesso gerado"
 * é a janela inteira. Os nove casos do gerar, trocar e revogar estão em `acesso-da-turma.spec.ts`.
 *
 * Cada caso entra pela API (`abrirJaEntrando`) e carrega a página uma vez: no Chromebook de teste (CPU ×4, Fast 3G) cada carga
 * leva uns 7 s, e o portão da tarefa reprova caso novo de e2e acima de 15 s.
 */

/** O fundo da janela inteira é o token `fundo` (`index.css`): branco no claro, o azul-noite do escuro. Escrito por extenso. */
const FUNDO_NO_CLARO = 'rgb(255, 255, 255)'
const FUNDO_NO_ESCURO = 'rgb(19, 31, 36)'

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await acionar(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/** A professora entra pela API (o cookie fica na aba) e abre o endereço: uma carga só, sem passar pela tela de entrada. */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

const principal = (page: Page) => page.getByRole('main')
const dialogo = (page: Page) => page.getByRole('dialog')
const dialogosDaTela = (page: Page) => principal(page).locator('dialog')
const botaoConvidar = (page: Page) => principal(page).getByRole('region', { name: 'Acesso dos alunos' }).getByRole('button', { name: 'Convidar alunos', exact: true })

/** O endereço da página sem o que não é a rota: caminho e busca, para comparar por extenso. */
function caminhoEBusca(page: Page): string {
  const endereco = new URL(page.url())
  return `${endereco.pathname}${endereco.search}`
}

/** A professora com uma turma confirmada. */
async function criarProfessoraComTurma(disciplina = 'Matemática') {
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [disciplina])
  await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
  return { professora, turma }
}

test.describe('o endereço ?convidar=1', () => {
  test('abre o diálogo na aba Alunos; gerar não põe token nem código no endereço; fechar tira o pedido do endereço, e recarregar não abre de novo', async ({ page, hasTouch }) => {
    const { professora, turma } = await criarProfessoraComTurma()
    const endereco = `/professor/turmas/${turma.turmaId}`
    await abrirJaEntrando(page, professora, `${endereco}?aba=alunos&convidar=1`)
    await expect(dialogo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('dialog', { name: 'Gerar acesso' })).toBeVisible()
    expect(caminhoEBusca(page)).toBe(`${endereco}?aba=alunos&convidar=1`)

    // O link e o código nascem no diálogo e nunca no endereço.
    const resposta = page.waitForResponse((r) => r.request().method() === 'POST' && /\/v1\/turmas\/[^/]+\/acesso$/.test(new URL(r.url()).pathname))
    await tocar(dialogo(page), 'Gerar acesso', hasTouch)
    const gerado = (await (await resposta).json()) as AcessoGeradoResponse
    await expect(dialogo(page).getByRole('heading', { name: 'Acesso gerado' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    for (const segredo of [gerado.token, gerado.codigo]) expect(page.url()).not.toContain(segredo)
    expect(caminhoEBusca(page)).toBe(`${endereco}?aba=alunos&convidar=1`)

    // Fechar tira só o pedido do diálogo (a aba fica), sem passo novo no histórico, e o foco volta ao botão da seção.
    const historico = await page.evaluate(() => history.length)
    await tocar(dialogo(page), 'Fechar', hasTouch)
    await tocar(dialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    expect(caminhoEBusca(page)).toBe(`${endereco}?aba=alunos`)
    expect(await page.evaluate(() => history.length)).toBe(historico)
    await expect(botaoConvidar(page)).toBeFocused()
    for (const segredo of [gerado.token, gerado.codigo]) expect(page.url()).not.toContain(segredo)

    // O botão abre o diálogo sem escrever nada no endereço.
    await acionar(botaoConvidar(page), hasTouch)
    await expect(page.getByRole('dialog', { name: 'Convidar alunos' })).toBeVisible()
    expect(caminhoEBusca(page)).toBe(`${endereco}?aba=alunos`)
  })

  for (const [endereco, quem] of [
    ['com o vínculo ainda pendente', 'pendente'],
    ['de outra escola', 'outra-escola'],
  ] as const) {
    test(`a turma ${endereco} não abre o diálogo nem pede o acesso: responde como a turma indisponível`, async ({ page }) => {
      const professora = await criarEquipeComSenha()
      const pendente = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Ciências'])
      // A turma de outra escola é real, com acesso possível para o professor dela: trocar o id na URL não a alcança (regra 10, item 4).
      const outro = await criarEquipeComSenha()
      const deOutraEscola = await criarAlocacaoDoProfessor(outro.escolaId, outro.usuarioId, ['Geografia'])
      await confirmarVinculosNoBanco(outro.escolaId, deOutraEscola.vinculoIds)
      const turmaId = quem === 'pendente' ? pendente.turmaId : deOutraEscola.turmaId
      const gravacoes: string[] = []
      page.on('request', (pedido) => {
        if (pedido.method() === 'POST' && /\/v1\/turmas\/[^/]+\/acesso/.test(new URL(pedido.url()).pathname)) gravacoes.push(pedido.url())
      })
      await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}?aba=alunos&convidar=1`)
      await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
      for (const nome of [pendente.turmaNome, deOutraEscola.turmaNome]) await expect(principal(page)).not.toContainText(nome)
      expect(gravacoes).toEqual([])
    })
  }
})

test.describe('depois de confirmar a turma', () => {
  test('o aviso "Turma confirmada" leva a "Gerar o acesso": a aba Alunos com o diálogo aberto; o aviso some ao sair de Turmas', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['História'])
    await abrirJaEntrando(page, professora, '/professor/turmas')
    const paraConfirmar = principal(page).getByRole('region', { name: 'Confirme suas turmas', exact: true })
    await expect(paraConfirmar).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(paraConfirmar.getByRole('listitem').filter({ hasText: turma.turmaNome }), 'Confirmar', hasTouch)

    const aviso = principal(page).locator('[data-aviso="certo"]')
    await expect(aviso).toContainText(`Turma ${turma.turmaNome} confirmada`, { timeout: PRAZO_DA_ENTRADA_MS })
    const gerar = aviso.getByRole('link', { name: 'Gerar o acesso' })
    // O endereço leva só a aba e o pedido do diálogo.
    await expect(gerar).toHaveAttribute('href', `/professor/turmas/${turma.turmaId}?aba=alunos&convidar=1`)
    await acionar(gerar, hasTouch)

    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}\\?aba=alunos&convidar=1$`))
    await expect(page.getByRole('dialog', { name: 'Gerar acesso' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('tab', { name: 'Alunos' })).toHaveAttribute('aria-selected', 'true')
    await tocar(dialogo(page), 'Cancelar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    expect(caminhoEBusca(page)).toBe(`/professor/turmas/${turma.turmaId}?aba=alunos`)

    // O aviso mora na página de Turmas: ao voltar, ela abre sem ele.
    await acionar(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas$/)
    await expect(principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).locator('[data-aviso="certo"]')).toHaveCount(0)
  })
})

test.describe('o passo "Acesso gerado" é a janela inteira', () => {
  test('cobre a janela, com o fundo do token e nada legível atrás, no claro e no escuro; o passo "Gerar" fica na caixa de sempre', async ({ page, hasTouch }) => {
    const { professora, turma } = await criarProfessoraComTurma()
    // Nomes e acertos de uma turma de verdade atrás do diálogo: é o que não pode ficar legível na lousa.
    const nomes = [`Aluna da lista ${crypto.randomUUID().slice(0, 8)}`, `Aluno da lista ${crypto.randomUUID().slice(0, 8)}`]
    await porNaListaDaTurma(
      professora.escolaId,
      turma.turmaId,
      nomes.map((nome, posicao) => ({ nome, matricula: `M${String(posicao)}-${crypto.randomUUID().slice(0, 8)}` })),
    )
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}?aba=alunos&convidar=1`)
    await expect(page.getByRole('dialog', { name: 'Gerar acesso' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const janela = page.viewportSize()
    if (janela === null) throw new Error('a página sem viewport')

    // O passo "Gerar" é a caixa de 520 px (ou a janela menos as margens, no celular): mais estreito que a janela.
    const dePartida = await dialogo(page).boundingBox()
    expect(dePartida?.width ?? 0).toBeGreaterThan(0)
    expect(dePartida?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(520)
    expect(dePartida?.width ?? Number.POSITIVE_INFINITY).toBeLessThan(janela.width)

    await tocar(dialogo(page), 'Gerar acesso', hasTouch)
    await expect(dialogo(page).getByRole('heading', { name: 'Acesso gerado' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    for (const [esquema, fundo] of [
      ['light', FUNDO_NO_CLARO],
      ['dark', FUNDO_NO_ESCURO],
    ] as const) {
      await page.emulateMedia({ colorScheme: esquema })
      // A caixa do `dialog` é a janela: do canto de cima à esquerda ao de baixo à direita.
      const caixa = await dialogo(page).boundingBox()
      expect(caixa, `${esquema}: caixa`).not.toBeNull()
      expect(Math.round(caixa?.x ?? -1), `${esquema}: x`).toBe(0)
      expect(Math.round(caixa?.y ?? -1), `${esquema}: y`).toBe(0)
      expect(Math.round(caixa?.width ?? 0), `${esquema}: largura`).toBe(janela.width)
      expect(Math.round(caixa?.height ?? 0), `${esquema}: altura`).toBe(janela.height)
      // O fundo é o do token, opaco: no escuro ele difere do `Canvas` que o navegador daria ao diálogo sem a classe.
      await expect(dialogo(page)).toHaveCSS('background-color', fundo)
      // Nenhum ponto da janela cai na página de trás: cada um é o diálogo ou algo dentro dele.
      const atrás = await page.evaluate(() => {
        const fora: string[] = []
        for (const fx of [0.02, 0.25, 0.5, 0.75, 0.98])
          for (const fy of [0.02, 0.25, 0.5, 0.75, 0.98]) {
            const alvo = document.elementFromPoint(window.innerWidth * fx, window.innerHeight * fy)
            if (alvo === null || alvo.closest('dialog[open]') === null) fora.push(`${String(fx)},${String(fy)}`)
          }
        return fora
      })
      expect(atrás, `${esquema}: pontos que caem atrás do diálogo`).toEqual([])
    }
    // O título do diálogo e o conteúdo moram na mesma coluna centralizada (768 px): no computador o título não fica no canto da janela.
    const COLUNA_PX = 768
    if (janela.width > COLUNA_PX) {
      const xDoTitulo = (await dialogo(page).getByRole('heading', { name: 'Gerar acesso', level: 2 }).boundingBox())?.x ?? -1
      const xDoPasso = (await dialogo(page).getByRole('heading', { name: 'Acesso gerado' }).boundingBox())?.x ?? -2
      expect(xDoTitulo).toBeGreaterThanOrEqual((janela.width - COLUNA_PX) / 2 - 1)
      expect(Math.round(xDoTitulo)).toBe(Math.round(xDoPasso))
    }

    // A pergunta de fechar que sai dele fica na janela inteira também: o fundo não volta a aparecer no meio dos dois passos.
    await tocar(dialogo(page), 'Fechar', hasTouch)
    await expect(dialogo(page).getByRole('heading', { name: 'Fechar sem copiar o link?' })).toBeVisible()
    const daPergunta = await dialogo(page).boundingBox()
    expect(Math.round(daPergunta?.width ?? 0)).toBe(janela.width)
    expect(Math.round(daPergunta?.height ?? 0)).toBe(janela.height)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
