import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { entrarComoCoordenacaoNaMesmaAba, abrirEstrutura, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { comOQueFalta, irPelaCoordenacao } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import {
  apagarDisciplinaNoBanco,
  apagarTurmaNoBanco,
  confirmarVinculosNoBanco,
  contestarVinculosNoBanco,
  convidarProfessorNoBanco,
  criarAlocacaoDoProfessor,
  criarDisciplinaNoBanco,
  criarEquipeComSenha,
  montarEstruturaNoBanco,
  vencerConviteNoBanco,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, violacoesGraves } from './support/checks.ts'

/**
 * A alocação no painel do professor (X2, 7.0; antes a seção "Alocação" da Estrutura): W4. A coordenação abre o professor em Professores e
 * acrescenta a turma pelo diálogo "Acrescentar turma".
 * Tudo pela tela, nos projetos `chromebook` e `celular`, com nomes inventados pelo teste.
 */

const ROTA_VINCULOS = '**/v1/vinculos?*'

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const principal = (page: Page) => page.getByRole('main')

/** O anúncio da ação que terminou, dentro do painel onde ela aconteceu: é lá que quem enxerga o vê. */
const anuncio = (secao: Locator, texto: string | RegExp) => secao.getByRole('status').filter({ hasText: texto })

/** Os `dialog` abertos que não são o painel do professor: o painel fica aberto por baixo do diálogo (dois `<dialog>` modais empilhados). */
const dialogo = (page: Page) => page.locator('dialog[open]:not([data-painel-lado])')
/** O painel do professor, pelo nome dele no título. */
const painelDe = (page: Page, nome: string) => page.getByRole('dialog', { name: nome })

/** Entra pela coordenação e vai a Professores. */
async function abrirProfessores(page: Page, coordenadora: Awaited<ReturnType<typeof criarEquipeComSenha>>, hasTouch: boolean): Promise<void> {
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
  await abrirEstrutura(page, hasTouch)
  await irPelaCoordenacao(page, 'Professores', hasTouch)
  await expect(page).toHaveURL(/\/coordenacao\/professores$/)
}

/** Abre o painel do professor pelo botão do nome na linha dele. */
async function abrirPainel(page: Page, nome: string, hasTouch: boolean): Promise<Locator> {
  await acionar(principal(page).getByRole('button', { name: nome }), hasTouch)
  const painel = painelDe(page, nome)
  await expect(painel).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  return painel
}

async function fecharPainel(painel: Locator, hasTouch: boolean): Promise<void> {
  await acionar(painel.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
  await expect(painel).toHaveCount(0)
}


async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

test.describe('W4 (Alocação): "Acrescentar turma" no painel do professor', () => {
  test('quem não recebe turma vê por quê; carregando; a escolha incompleta não sai; o vínculo nasce esperando a confirmação; o repetido, o convite que vence e a turma e a disciplina que saem com o diálogo aberto; o erro com "Tentar de novo"; o vazio sem turma', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Turmas e disciplinas criadas fora da ordem do nome: as escolhas vêm pelo nome.
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7B', '7A'])
    const [outraTurma, turma] = estrutura.turmas
    if (turma === undefined || outraTurma === undefined) throw new Error('estrutura sem as duas turmas')
    const artes = `Artes sintética ${randomUUID().slice(0, 8)}`
    await criarDisciplinaNoBanco(coordenadora.escolaId, artes)
    // Só um professor, de convite vencido: ele não recebe turma.
    const vencido = await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido')
    const alocacoes: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/v1/vinculos') alocacoes.push(pedido)
    })
    let falhar = false
    const vinculosSegurados = portao()
    await page.route(ROTA_VINCULOS, async (rota: Route) => {
      await vinculosSegurados.aberta
      await (falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue())
    })
    await abrirProfessores(page, coordenadora, hasTouch)

    // Carregando: a leitura dos vínculos segurada. Quem não recebe turma vê por quê, e não tem o botão.
    const doVencido = await abrirPainel(page, vencido.nome, hasTouch)
    await expect(doVencido.getByRole('status').filter({ hasText: 'Carregando as turmas…' })).toBeVisible()
    vinculosSegurados.abrir()
    await expect(doVencido).toContainText('O convite venceu. Refaça o convite para acrescentar uma turma.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(doVencido).toContainText('Nenhuma turma.')
    await expect(doVencido.getByRole('button', { name: 'Acrescentar turma' })).toHaveCount(0)
    await fecharPainel(doVencido, hasTouch)

    // Dois com o convite em aberto, criados fora da ordem do nome.
    const bruno = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bruno')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await page.reload()
    // O roteiro "O que falta" abre pela tela Turmas, que tem o aviso dele.
    await irPelaCoordenacao(page, 'Turmas', hasTouch)
    await expect(principal(page).getByRole('region', { name: /^Turmas de / })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await comOQueFalta(page, hasTouch, async (oQueFalta) => {
      await expect(oQueFalta).toContainText('Professores · feito')
      await expect(oQueFalta).toContainText('Alocação · falta')
    })
    await irPelaCoordenacao(page, 'Professores', hasTouch)
    const daAna = await abrirPainel(page, ana.nome, hasTouch)
    await expect(daAna).toContainText('Nenhuma turma.', { timeout: PRAZO_DA_ENTRADA_MS })

    await alvoDeToque(daAna.getByRole('button', { name: 'Acrescentar turma' }), 'Acrescentar turma')
    await acionar(daAna.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    const aberto = dialogo(page)
    await expect(aberto.getByLabel('Turma').locator('option')).toHaveText(['Escolha a turma', turma.nome, outraTurma.nome])
    await expect(aberto.getByLabel('Disciplina').locator('option')).toHaveText(['Escolha a disciplina', artes, estrutura.disciplina.nome])
    // Sem escolher tudo, diz o que falta, e nada sai.
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText('Escolha a turma e a disciplina.')
    expect(alocacoes).toHaveLength(0)
    await aberto.getByLabel('Turma').selectOption({ label: turma.nome })
    await aberto.getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    const alocado = anuncio(daAna, `Alocação feita: ${ana.nome} em ${turma.nome} · ${estrutura.disciplina.nome}. A turma abre depois que quem foi alocado confirmar.`)
    await expect(alocado).toBeVisible()
    const turmasDela = daAna.getByRole('list', { name: 'Turmas do professor' })
    await expect(turmasDela.getByRole('listitem')).toHaveCount(1)
    await expect(turmasDela).toContainText(turma.nome)
    await expect(turmasDela).toContainText('Esperando o professor confirmar')
    await fecharPainel(daAna, hasTouch)
    await irPelaCoordenacao(page, 'Turmas', hasTouch)
    await expect(principal(page).getByRole('region', { name: /^Turmas de / })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await comOQueFalta(page, hasTouch, async (oQueFalta) => {
      await expect(oQueFalta).toContainText('Alocação · feito')
    })
    await irPelaCoordenacao(page, 'Professores', hasTouch)
    await abrirPainel(page, ana.nome, hasTouch)

    // A mesma alocação de novo: a API recusa, e o diálogo explica.
    await acionar(daAna.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await aberto.getByLabel('Turma').selectOption({ label: turma.nome })
    await aberto.getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText('Este professor já está alocado nesta turma e nesta disciplina.', { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await violacoesGraves(page)).toEqual([])
    // A mesma professora em outra disciplina da mesma turma: os vínculos vêm pela turma e pela disciplina, e não pela ordem de criação.
    await aberto.getByLabel('Disciplina').selectOption({ label: artes })
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(turmasDela.getByRole('listitem')).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(turmasDela.getByRole('listitem')).toContainText([artes, estrutura.disciplina.nome])
    await fecharPainel(daAna, hasTouch)

    // O convite do outro professor vence com o diálogo aberto: a API responde como inexistente, e o diálogo explica.
    const doBruno = await abrirPainel(page, bruno.nome, hasTouch)
    await acionar(doBruno.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await aberto.getByLabel('Turma').selectOption({ label: turma.nome })
    await aberto.getByLabel('Disciplina').selectOption({ label: artes })
    await vencerConviteNoBanco(bruno.usuarioId)
    const antes = alocacoes.length
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText('Este professor já não pode receber turma: o convite mudou. A tela foi atualizada.', { timeout: PRAZO_DA_ENTRADA_MS })
    expect(alocacoes).toHaveLength(antes + 1)
    // O convite venceu: sobra só "Fechar", sem "Acrescentar" nem "Cancelar".
    await expect(aberto.getByRole('button', { name: 'Acrescentar', exact: true })).toHaveCount(0)
    await expect(aberto.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0)
    await acionar(aberto.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
    await expect(aberto).toHaveCount(0)
    await fecharPainel(doBruno, hasTouch)

    // Erro: a leitura dos vínculos cai; o painel diz o que fazer, e a tela continua em pé.
    falhar = true
    await page.reload()
    const comErro = await abrirPainel(page, ana.nome, hasTouch)
    await expect(comErro.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    falhar = false
    await acionar(comErro.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(comErro.getByRole('list', { name: 'Turmas do professor' })).toContainText(artes, { timeout: PRAZO_DA_ENTRADA_MS })

    // A turma que outra pessoa excluiu com a escolha feita: a API responde como inexistente, a turma sai da escolha quando a tela
    // recarrega, e o "Acrescentar" seguinte pede a escolha de novo, com a disciplina ainda escolhida.
    const mudou = 'O professor, a turma ou a disciplina mudou enquanto você escolhia. A tela foi atualizada: confira e tente de novo.'
    await acionar(comErro.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    const daTurma = aberto.getByLabel('Turma')
    const daDisciplina = aberto.getByLabel('Disciplina')
    await daTurma.selectOption({ label: turma.nome })
    await daDisciplina.selectOption({ label: artes })
    await apagarTurmaNoBanco(coordenadora.escolaId, turma.id)
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText(mudou, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(daTurma.locator('option')).toHaveText(['Escolha a turma', outraTurma.nome], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(daTurma).toHaveValue('')
    const aposATurma = alocacoes.length
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText('Escolha a turma e a disciplina.')
    expect(alocacoes).toHaveLength(aposATurma)
    // E a disciplina, do mesmo jeito.
    await daTurma.selectOption({ label: outraTurma.nome })
    await daDisciplina.selectOption({ label: estrutura.disciplina.nome })
    await apagarDisciplinaNoBanco(coordenadora.escolaId, estrutura.disciplina.id)
    await acionar(aberto.getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(aberto.getByRole('alert')).toHaveText(mudou, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(daDisciplina.locator('option')).toHaveText(['Escolha a disciplina', artes], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(daDisciplina).toHaveValue('')
    await acionar(aberto.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(aberto).toHaveCount(0)
    await fecharPainel(comErro, hasTouch)

    // Vazio de novo, agora sem turma: há professor e disciplina, e falta a turma.
    await apagarTurmaNoBanco(coordenadora.escolaId, outraTurma.id)
    await page.reload()
    const semTurma = await abrirPainel(page, ana.nome, hasTouch)
    await expect(semTurma).toContainText('Crie uma turma primeiro', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(semTurma).toContainText('Falta: uma turma.')
    await expect(semTurma.getByRole('button', { name: 'Acrescentar turma' })).toHaveCount(0)
  })
})

test.describe('W4 (Alocação): o que o painel mostra e o recomeço do diálogo', () => {
  test('o professor que confirmou uma disciplina e contestou outra: as duas linhas, com o estado em texto e o motivo; corrigir é acrescentar a turma certa', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['8A'])
    const [turmaCerta] = estrutura.turmas
    if (turmaCerta === undefined) throw new Error('estrutura sem turma')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'ativo', 'Carla')
    const alocacao = await criarAlocacaoDoProfessor(coordenadora.escolaId, professor.usuarioId, ['Física sintética', 'Artes sintética'])
    const [confirmado, contestado] = alocacao.vinculoIds
    if (confirmado === undefined || contestado === undefined) throw new Error('alocação sem os dois vínculos')
    await confirmarVinculosNoBanco(coordenadora.escolaId, [confirmado])
    await contestarVinculosNoBanco(coordenadora.escolaId, [contestado])
    await abrirProfessores(page, coordenadora, hasTouch)

    const painel = await abrirPainel(page, professor.nome, hasTouch)
    const turmas = painel.getByRole('list', { name: 'Turmas do professor' })
    await expect(turmas.getByRole('listitem')).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(turmas.getByRole('listitem')).toContainText(['Contestou', 'Confirmou'])
    await expect(turmas).toContainText('Motivo: Não dou aula nesta turma')
    await expect(painel).toContainText('Para corrigir uma turma contestada, acrescente a turma certa.')
    // Corrigir: acrescentar a turma certa. O vínculo novo espera o aceite, ao lado dos dois.
    await acionar(painel.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: turmaCerta.nome })
    await dialogo(page).getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    await acionar(dialogo(page).getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(turmas.getByRole('listitem')).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(turmas).toContainText('Esperando o professor confirmar')
    // Três turmas passam da altura do painel nos dois projetos: o miolo que rola está no ciclo do Tab, e o axe não acusa nada.
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('dois cliques em "Acrescentar" são um pedido e um vínculo só; a falha de um professor não passa ao diálogo do outro', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['9A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const bruno = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bruno')
    const alocacoes: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/v1/vinculos') alocacoes.push(pedido)
    })
    await abrirProfessores(page, coordenadora, hasTouch)

    const daAna = await abrirPainel(page, ana.nome, hasTouch)
    await acionar(daAna.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: turma.nome })
    await dialogo(page).getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    // Os dois cliques no mesmo instante, antes de a tela desligar o botão: só a trava do pedido no ar os segura.
    await dialogo(page)
      .getByRole('button', { name: 'Acrescentar', exact: true })
      .evaluate((elemento: HTMLButtonElement) => {
        elemento.click()
        elemento.click()
      })
    const turmasDela = daAna.getByRole('list', { name: 'Turmas do professor' })
    await expect(turmasDela.getByRole('listitem')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(alocacoes).toHaveLength(1)

    // A mesma alocação de novo: o CONFLITO fica no diálogo da Ana e não vai ao do Bruno.
    await acionar(daAna.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: turma.nome })
    await dialogo(page).getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    await acionar(dialogo(page).getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(dialogo(page).getByRole('alert')).toHaveText('Este professor já está alocado nesta turma e nesta disciplina.', { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
    await fecharPainel(daAna, hasTouch)

    const doBruno = await abrirPainel(page, bruno.nome, hasTouch)
    await acionar(doBruno.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await expect(dialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(dialogo(page)).toContainText(bruno.nome)
    await expect(dialogo(page)).not.toContainText(ana.nome)
    await expect(dialogo(page).getByLabel('Turma')).toHaveValue('')
    await expect(dialogo(page).getByLabel('Disciplina')).toHaveValue('')
    expect(alocacoes).toHaveLength(2)
  })
  test('a resposta que chega depois de o diálogo ter fechado não fecha o diálogo que a pessoa abriu em seguida, e o painel anuncia a alocação', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['6A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await abrirProfessores(page, coordenadora, hasTouch)
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await expect(painel).toContainText('Nenhuma turma.', { timeout: PRAZO_DA_ENTRADA_MS })

    // O pedido fica segurado: a pessoa cancela o diálogo e abre outro por cima do painel antes de a resposta chegar.
    const seguro = portao()
    await page.route('**/v1/vinculos', async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      await seguro.aberta
      return rota.fallback()
    })
    await acionar(painel.getByRole('button', { name: 'Acrescentar turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: turma.nome })
    await dialogo(page).getByLabel('Disciplina').selectOption({ label: estrutura.disciplina.nome })
    await acionar(dialogo(page).getByRole('button', { name: 'Acrescentar', exact: true }), hasTouch)
    await expect(dialogo(page).getByRole('button', { name: 'Acrescentando…' })).toBeDisabled()
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
    await acionar(painel.getByRole('button', { name: 'Refazer convite' }), hasTouch)
    await expect(dialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeVisible()
    seguro.abrir()
    // A resposta chega: o vínculo entra na lista e o painel anuncia, mas o diálogo do refazer continua onde a pessoa o deixou.
    await expect(painel.getByRole('list', { name: 'Turmas do professor' }).getByRole('listitem')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(painel.locator('[role="status"]').filter({ hasText: `Alocação feita: ${ana.nome} em ${turma.nome}` })).toHaveCount(1)
    await expect(dialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeVisible()
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
  })
})
