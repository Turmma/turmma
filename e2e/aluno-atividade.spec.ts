import type { Locator, Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import type { ProvaResponse } from '../packages/shared/src/index.ts'
import { diagnosticoDa, apiError, minhaAtividade, gate, provaDa, QUEM_APROVA, QUESTOES_SINTETICAS, mockAlunoApi, type AlunoApiMock } from './support/aluno.ts'
import { abrirNavegacao, entrarComoAluno, esperarATelaDepoisDaRecarga, esperarInicioDoAluno, irPelaNavegacao, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, type AlunoDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, rawCodePattern, horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'

/**
 * As telas da atividade do aluno (MVP, A3, pacote X): "Atividades" e a atividade aberta. **Os estados de cada tela**, com
 * a API destas telas simulada na página (`support/aluno.ts`). A sessão, o `/v1/eu` e a turma são os de verdade. O
 * fluxo inteiro contra a API real está em `aluno-fluxo.spec.ts`.
 */

const SCREEN_TIMEOUT_MS = 15_000
/** A fila de respostas tenta de novo sozinha em 2 s, 4 s e 8 s: o teste espera até a terceira tentativa, com folga. */
const PRAZO_DO_REENVIO_MS = 25_000
const AVISO_DA_AVALIACAO = 'Avaliação: o Tutor fica pausado até quem dá a aula encerrar.'
const ESPERA_PELA_CORRECAO = 'Quem dá a aula ainda vai revisar a correção.'
/** O que a área do aluno nunca diz: nota, conceito, e nada que compare (D46; regra 50, item 9). */
const PROIBIDO_NA_AREA = /\bnotas?\b|\bconceito\b|ranking|média da turma|colegas?\b/i

interface Scenario {
  readonly api: AlunoApiMock
  readonly aluno: AlunoDeTeste
  /** Um colega de verdade, na mesma turma: o nome dele não pode aparecer em tela nenhuma do aluno. */
  readonly colega: AlunoDeTeste
}

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

/** Navega dentro da aplicação, sem recarregar: a sessão e a memória da aba continuam, como num clique. */
async function irPara(page: Page, caminho: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState(null, '', destino)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, caminho)
}

async function recarregar(page: Page): Promise<void> {
  await page.reload()
  await esperarATelaDepoisDaRecarga(page)
}

/** O aluno entra, com a API das telas dele simulada e um colega de verdade na mesma turma. */
async function entrar(page: Page, hasTouch: boolean, antes?: (api: AlunoApiMock) => void): Promise<Scenario> {
  const api = await mockAlunoApi(page)
  antes?.(api)
  const aluno = await criarAlunoComMatricula()
  const turma = await colocarAlunoNaTurma(aluno)
  const colega = await criarAlunoComMatricula({ escola: aluno })
  await colocarAlunoNaTurma(colega, turma)
  await entrarComoAluno(page, aluno, hasTouch)
  // O aluno abre no Início (X4, 2.0); a lista de tarefas, onde estes casos começam, é o segundo lugar dele.
  await irPelaNavegacao(page, 'Tarefas', hasTouch)
  return { api, aluno, colega }
}

const principal = (page: Page) => page.getByRole('main')
const mapa = (page: Page) => principal(page).getByRole('navigation', { name: 'Questões' })
const alternativa = (page: Page, indice: number) => principal(page).locator(`[data-alternativa="${String(indice)}"]`)
const estadoDaResposta = (page: Page) => principal(page).locator('[data-resposta]')
/** O que o mapa das questões diz de cada uma, pelo nome de cada botão. */
const nomesNoMapa = (page: Page) => mapa(page).getByRole('button').evaluateAll((botoes) => botoes.map((botao) => botao.getAttribute('aria-label')))

const comemoracao = (page: Page) => principal(page).locator('[data-comemoracao]')

/** Os elementos da árvore da comemoração (a raiz inclusa) com alguma animação resolvida pelo navegador. */
const animacoesDaComemoracao = (page: Page) =>
  comemoracao(page).evaluate((raiz) =>
    [raiz, ...raiz.querySelectorAll('*')].flatMap((no) => {
      const nome = getComputedStyle(no).animationName
      return nome === 'none' ? [] : [{ nome }]
    }),
  )
/** O que a comemoração diz (`FALA_DA_ENTREGA`, em `areas/aluno/atividade.ts`): o fato da entrega, e nada de nota. */
const FALA_DA_ENTREGA = 'Atividade entregue. Quem dá a aula vê a correção antes de você.'

/** Abre o diálogo "Enviar a atividade?" e confirma, pelos dois botões da tela. */
async function confirmarOEnvio(page: Page, hasTouch: boolean): Promise<void> {
  await activate(principal(page).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
  await activate(page.getByRole('alertdialog', { name: 'Enviar a atividade?' }).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
}

/** Abre uma atividade pela lista, como o aluno faz. */
async function abrirAtividade(page: Page, titulo: string, hasTouch: boolean): Promise<void> {
  await activate(principal(page).getByRole('link', { name: new RegExp(titulo) }), hasTouch)
  await expect(principal(page).getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
}

test.describe('Tarefas: os quatro estados', () => {
  test('carregando, vazia sem culpa, erro com "Tentar de novo" e a lista com o estado de cada atividade em texto, sem nada de colega', async ({ page, hasTouch }) => {
    test.slow()
    const segurada = gate()
    const { api, colega } = await entrar(page, hasTouch, (simulada) => {
      simulada.trocar('atividades', async (entrada) => {
        await segurada.aberta
        return simulada.responder('atividades', entrada)
      })
    })

    // Carregando: o texto, e nada de lista.
    await expect(principal(page).getByRole('status')).toHaveText('Carregando as suas atividades…')
    await expect(page).toHaveTitle('Tarefas · Turmma')

    // Vazia: diz que não há o que fazer agora, sem cobrar nada.
    segurada.abrir()
    await expect(principal(page).getByText('Nada para fazer agora')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page)).toContainText('Quando quem dá a aula passar uma atividade para a turma, ela aparece aqui.')
    await expect(principal(page).getByRole('link')).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])

    // Erro: a tela diz o que fazer, sem código nem status.
    api.trocar('atividades', () => apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await recarregar(page)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SCREEN_TIMEOUT_MS })
    for (const cru of [rawCodePattern('503'), 'INDISPONIVEL']) await expect(page.locator('body')).not.toContainText(cru)

    // Com dado: cada atividade com o estado em texto, e a avaliação avisada antes de abrir.
    api.atividades = [
      minhaAtividade({ titulo: 'Lista de estequiometria' }),
      minhaAtividade({ titulo: 'Prova de reagente limitante', avaliativa: true, situacao: 'em_andamento', respondidas: 1 }),
      minhaAtividade({ titulo: 'Lista de mol', situacao: 'enviada', respondidas: 3, enviadaEm: '2026-10-05T13:30:00.000Z' }),
      minhaAtividade({ titulo: 'Lista de balanceamento', situacao: 'encerrada', respondidas: 1 }),
      minhaAtividade({ titulo: 'Lista de massa molar', situacao: 'com_diagnostico', respondidas: 3, enviadaEm: '2026-10-04T13:30:00.000Z' }),
    ]
    api.trocar('atividades')
    await activate(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    const paraFazer = principal(page).getByRole('region', { name: 'Para fazer' })
    await expect(paraFazer.getByRole('link')).toHaveCount(2, { timeout: SCREEN_TIMEOUT_MS })
    await expect(paraFazer.getByRole('link', { name: /Lista de estequiometria/ })).toContainText('Para fazer')
    const prova = paraFazer.getByRole('link', { name: /Prova de reagente limitante/ })
    await expect(prova).toContainText('Você respondeu 1 de 3.')
    await expect(prova).toContainText(AVISO_DA_AVALIACAO)
    const entregues = principal(page).getByRole('region', { name: 'Entregues' })
    await expect(entregues.getByRole('link')).toHaveCount(2)
    await expect(entregues.getByRole('link', { name: /Lista de mol/ })).toContainText('Entregue')
    await expect(entregues.getByRole('link', { name: /Lista de mol/ })).toContainText(ESPERA_PELA_CORRECAO)
    await expect(entregues.getByRole('link', { name: /Lista de balanceamento/ })).toContainText('Encerrada')
    const corrigidas = principal(page).getByRole('region', { name: 'Corrigidas' })
    await expect(corrigidas.getByRole('link')).toHaveCount(1)
    await expect(corrigidas.getByRole('link', { name: /Lista de massa molar/ })).toContainText('Corrigida')
    // Só a atividade com a correção aprovada fala de resultado, e só ela é "Corrigida".
    await expect(entregues).not.toContainText(/resultado|acert|corrigida/i)

    // Nada de colega, de nota nem de comparação, e nada que se mexa sozinho ou cobre (regra 50, item 9; D46; D59).
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    await expect(principal(page)).not.toContainText(/atrasad|faltam \d+ (dias|horas)|!/)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('a atividade aberta: uma questão por vez, e a resposta salva no servidor a cada escolha', () => {
  test('carregando, erro e a atividade que não existe; depois, cada escolha vira um PUT, a tela diz "Resposta salva" e o mapa diz quais já têm resposta', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const segurada = gate()
    const { api, colega } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
      simulada.trocar('prova', async (entrada) => {
        await segurada.aberta
        return simulada.responder('prova', entrada)
      })
    })

    // Carregando.
    await activate(principal(page).getByRole('link', { name: /Lista de estequiometria/ }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/atividades/${atividade.id}$`))
    await expect(principal(page).getByRole('status')).toHaveText('Carregando a atividade…', { timeout: SCREEN_TIMEOUT_MS })

    // Com dado: uma questão por vez.
    segurada.abrir()
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Lista de estequiometria' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page).toHaveTitle('Lista de estequiometria · Turmma')
    await expect(mapa(page)).toContainText('Questão 1 de 3')
    await expect(principal(page).getByRole('radio')).toHaveCount(4)
    await expect(principal(page)).toContainText('Qual é a massa molar da água')
    await expect(principal(page)).not.toContainText('reagente limitante')
    expect(await nomesNoMapa(page)).toEqual(['Questão 1, sem resposta', 'Questão 2, sem resposta', 'Questão 3, sem resposta'])
    await expect(estadoDaResposta(page)).toHaveText('')
    await expect(principal(page).getByRole('button', { name: 'Anterior' })).toBeDisabled()

    // A escolha vai ao servidor na hora, e só então a tela diz "Resposta salva".
    await activate(alternativa(page, 1), hasTouch)
    await expect(estadoDaResposta(page)).toHaveText('Resposta salva', { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('radio', { name: /^B\./ })).toBeChecked()
    expect(api.pedidosEm(/\/respostas\/1$/)).toEqual([{ metodo: 'PUT', caminho: `/v1/atividades-aplicadas/${atividade.id}/respostas/1`, corpo: { alternativa: 1, sequencia: 1 } }])
    await expect(mapa(page).getByRole('button', { name: 'Questão 1, respondida' })).toHaveAttribute('aria-current', 'step')

    // Pelo teclado: o rádio nativo anda com as setas, e a troca também é salva.
    if (!hasTouch) {
      await principal(page).getByRole('radio', { name: /^B\./ }).focus()
      await page.keyboard.press('ArrowDown')
      await expect(principal(page).getByRole('radio', { name: /^C\./ })).toBeChecked()
      await expect.poll(() => api.provas.get(atividade.id)?.respostas).toEqual([{ questao: 1, alternativa: 2, sequencia: 2 }])
      await expect(estadoDaResposta(page)).toHaveText('Resposta salva', { timeout: SCREEN_TIMEOUT_MS })
    }

    // "Próxima" leva à questão 2, e só ela aparece; "Anterior" volta, com a escolha salva marcada.
    await activate(principal(page).getByRole('button', { name: 'Próxima' }), hasTouch)
    await expect(mapa(page)).toContainText('Questão 2 de 3')
    await expect(principal(page)).toContainText('quantos mols de amônia')
    await expect(principal(page)).not.toContainText('Qual é a massa molar da água')
    await expect(principal(page).getByRole('radio', { checked: true })).toHaveCount(0)
    await activate(principal(page).getByRole('button', { name: 'Anterior' }), hasTouch)
    await expect(principal(page).getByRole('radio', { checked: true })).toHaveCount(1)
    // O mapa leva direto a qualquer questão.
    await activate(mapa(page).getByRole('button', { name: 'Questão 3, sem resposta' }), hasTouch)
    await expect(mapa(page)).toContainText('Questão 3 de 3')
    await expect(principal(page).getByRole('button', { name: 'Próxima' })).toBeDisabled()
    // Trocar de questão leva o foco ao enunciado; o "Próxima" que desliga na última não deixa o foco cair no `body`.
    await expect(principal(page).getByRole('heading', { level: 2, name: /^Questão 3:/ })).toBeFocused()
    await activate(principal(page).getByRole('button', { name: 'Anterior' }), hasTouch)
    await activate(principal(page).getByRole('button', { name: 'Próxima' }), hasTouch)
    await expect(principal(page).getByRole('button', { name: 'Próxima' })).toBeDisabled()
    await expect(principal(page).getByRole('heading', { level: 2, name: /^Questão 3:/ })).toBeFocused()

    // Atividade comum: o Tutor está a um toque, levando a atividade e a questão.
    await expect(principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' })).toHaveAttribute('href', `/aluno/tutor/${atividade.id}?questao=3`)
    await expect(principal(page)).not.toContainText(AVISO_DA_AVALIACAO)
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Erro ao abrir: "Tentar de novo". E a atividade que não é dele responde como a que não existe.
    api.trocar('prova', () => apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await recarregar(page)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SCREEN_TIMEOUT_MS })
    api.trocar('prova')
    await activate(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(mapa(page)).toContainText('Questão 1 de 3', { timeout: SCREEN_TIMEOUT_MS })
    await irPara(page, '/aluno/atividades/0190f5a0-0000-7000-8000-00000000dead')
    await expect(principal(page).getByText('Esta atividade não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
  })

  test('a resposta que falha ao salvar continua marcada, a tela diz que não salvou, e ela é reenviada sozinha quando a rota volta', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
    })
    await abrirAtividade(page, 'Lista de estequiometria', hasTouch)

    // A rota cai: a escolha não é salva, e a tela não diz que foi.
    api.trocar('responder', () => apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await activate(alternativa(page, 3), hasTouch)
    await expect(estadoDaResposta(page)).toContainText('Não foi possível salvar agora.', { timeout: SCREEN_TIMEOUT_MS })
    await expect(estadoDaResposta(page)).not.toContainText('Resposta salva')
    // A escolha não se perde: continua marcada, e o mapa diz que ainda não foi salva.
    await expect(principal(page).getByRole('radio', { name: /^D\./ })).toBeChecked()
    await expect(mapa(page).getByRole('button', { name: 'Questão 1, resposta ainda não salva' })).toBeVisible()
    expect(api.provas.get(atividade.id)?.respostas).toEqual([])
    for (const cru of [rawCodePattern('503'), 'INDISPONIVEL']) await expect(page.locator('body')).not.toContainText(cru)

    // Com resposta não salva, o envio é segurado, e o diálogo diz por quê.
    await activate(principal(page).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Enviar a atividade?' })
    await expect(dialogo).toContainText('Uma resposta ainda não foi salva.')
    await expect(dialogo.getByRole('button', { name: 'Enviar a atividade' })).toBeDisabled()
    await activate(dialogo.getByRole('button', { name: 'Continuar respondendo' }), hasTouch)
    expect(api.pedidosEm(/\/enviar$/)).toEqual([])

    // A rota volta: sem o aluno fazer nada, a mesma escolha é mandada de novo e passa a constar como salva.
    api.trocar('responder')
    await expect(estadoDaResposta(page)).toHaveText('Resposta salva', { timeout: PRAZO_DO_REENVIO_MS })
    expect(api.provas.get(atividade.id)?.respostas).toEqual([{ questao: 1, alternativa: 3, sequencia: 1 }])
    const envios = api.pedidosEm(/\/respostas\/1$/)
    expect(envios.length).toBeGreaterThanOrEqual(2)
    // O reenvio leva a mesma `sequencia` do primeiro: o servidor grava uma vez só.
    for (const envio of envios) expect(envio.corpo).toEqual({ alternativa: 3, sequencia: 1 })
    await expect(mapa(page).getByRole('button', { name: 'Questão 1, respondida' })).toBeVisible()
    await expect(principal(page).getByRole('radio', { name: /^D\./ })).toBeChecked()
  })

  test('enviar pede confirmação dizendo quantas ficaram em branco; depois de enviar nada muda, e o resultado só aparece depois de a professora aprovar', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade({ situacao: 'em_andamento', respondidas: 2 })
    const { api, colega } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade, { respostas: [{ questao: 1, alternativa: 1, sequencia: 1 }, { questao: 2, alternativa: 0, sequencia: 1 }] }))
    })
    await abrirAtividade(page, 'Lista de estequiometria', hasTouch)
    // Quem volta continua de onde parou: as respostas salvas vêm marcadas.
    await expect(principal(page).getByRole('radio', { name: /^B\./ })).toBeChecked()
    expect(await nomesNoMapa(page)).toEqual(['Questão 1, respondida', 'Questão 2, respondida', 'Questão 3, sem resposta'])

    // A confirmação mostra o que vai acontecer, e cancelar não manda nada.
    await activate(principal(page).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Enviar a atividade?' })
    await expect(dialogo).toContainText('Lista de estequiometria')
    await expect(dialogo).toContainText('2 de 3 questões')
    await expect(dialogo).toContainText('1 questão em branco')
    await expect(dialogo).toContainText('Depois de enviar, não dá para mudar as respostas.')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await activate(dialogo.getByRole('button', { name: 'Continuar respondendo' }), hasTouch)
    await expect(dialogo).toBeHidden()
    expect(api.pedidosEm(/\/enviar$/)).toEqual([])

    // Confirmar manda uma vez só, mesmo com o toque repetido enquanto a resposta não chega.
    const segurado = gate()
    api.trocar('enviar', async (entrada) => {
      await segurado.aberta
      return api.responder('enviar', entrada)
    })
    await activate(principal(page).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    await activate(dialogo.getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    await expect(dialogo.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    segurado.abrir()
    await expect(principal(page).getByRole('heading', { name: 'Atividade enviada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(api.pedidosEm(/\/enviar$/)).toEqual([{ metodo: 'POST', caminho: `/v1/atividades-aplicadas/${atividade.id}/enviar`, corpo: {} }])

    // A comemoração é da entrega: uma vez, a onça comemorando assinada pela função, o fato e o caminho de volta, sem número.
    await expect(comemoracao(page)).toHaveCount(1)
    await expect(comemoracao(page).locator('[data-onca]')).toHaveAttribute('data-pose', 'comemorando')
    await expect(comemoracao(page).locator('figcaption')).toContainText('Tutor')
    await expect(comemoracao(page).locator('figcaption [data-selo-ia]')).toHaveCount(1)
    await expect(comemoracao(page)).toContainText(FALA_DA_ENTREGA)
    await expect(principal(page).getByRole('link', { name: 'Voltar às tarefas' })).toBeVisible()
    // Um salto só: na árvore da comemoração uma única animação resolvida pelo navegador, a do corpo da onça.
    expect(await comemoracao(page).locator('.onca-comemora').evaluate((no) => getComputedStyle(no).animationName)).toBe('onca-comemorar')
    expect((await animacoesDaComemoracao(page)).map((animacao) => animacao.nome)).toEqual(['onca-comemorar'])
    await expect(comemoracao(page).locator('xpath=..')).not.toContainText(/\d|acert|parab[ée]ns|nota/i)

    // Enviada: a tela não deixa mudar, e do resultado só diz que a professora ainda vai revisar.
    await expect(principal(page).getByRole('radio')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Enviar a atividade' })).toHaveCount(0)
    await expect(principal(page)).toContainText('Você respondeu 2 de 3 questões. Não dá mais para mudar as respostas.')
    await expect(principal(page).locator('[data-resultado="aguardando"]')).toContainText(ESPERA_PELA_CORRECAO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page)).not.toContainText(/Seu resultado|acertou|A resposta é/)
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])

    // Recarregar apaga a comemoração, e abrir a tarefa pela lista também: ela é da entrega que acabou de acontecer.
    await recarregar(page)
    await expect(principal(page).getByRole('heading', { name: 'Atividade enviada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(comemoracao(page)).toHaveCount(0)
    await irPelaNavegacao(page, 'Tarefas', hasTouch)
    await activate(principal(page).getByRole('region', { name: 'Entregues' }).getByRole('link', { name: /Lista de estequiometria/ }), hasTouch)
    await expect(principal(page).getByRole('heading', { name: 'Atividade enviada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(comemoracao(page)).toHaveCount(0)

    // A professora aprova a correção: o diagnóstico aparece, por habilidade, com quem aprovou e o selo de IA.
    api.diagnosticos.set(atividade.id, diagnosticoDa(atividade))
    await recarregar(page)
    const resultado = principal(page).getByRole('region', { name: 'Seu resultado' })
    await expect(resultado).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(resultado).toContainText('Você acertou 2 de 3 questões.')
    await expect(resultado).toContainText(`Correção aprovada por ${QUEM_APROVA}`)
    await expect(resultado.locator('[data-selo-ia]')).toHaveCount(1)
    const porHabilidade = resultado.getByRole('region', { name: 'Acertos por habilidade' })
    await expect(porHabilidade).toContainText('Calcular a massa molar de uma substância')
    await expect(porHabilidade).toContainText('1 de 2 questões')
    await expect(resultado.locator('[data-questao-corrigida="certa"]')).toHaveCount(2)
    await expect(resultado.locator('[data-questao-corrigida="outra"]')).toContainText('A resposta é: C. 4 mol')
    await expect(resultado.getByRole('button', { name: 'Fonte: Material da escola, p. 3' })).toHaveCount(1)

    // Diagnóstico, e não nota: sem nota, conceito, percentual nem comparação com ninguém.
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    await expect(principal(page)).not.toContainText('%')
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(comemoracao(page)).toHaveCount(0)
    await expect(principal(page).locator('[data-resultado="aguardando"]')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a avaliação avisa que o Tutor fica pausado e não oferece o caminho até ele; a que a professora encerra para de receber resposta', async ({ page, hasTouch }) => {
    test.slow()
    const avaliacao = minhaAtividade({ titulo: 'Prova de estequiometria', avaliativa: true })
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [avaliacao]
      simulada.provas.set(avaliacao.id, provaDa(avaliacao))
    })
    await abrirAtividade(page, 'Prova de estequiometria', hasTouch)
    await expect(principal(page).getByRole('note')).toHaveText(AVISO_DA_AVALIACAO)
    await expect(principal(page).getByRole('link', { name: /Tutor/ })).toHaveCount(0)

    // A professora encerra enquanto o aluno responde: a escolha seguinte é recusada, e a tela passa a dizer o que houve.
    const prova = api.provas.get(avaliacao.id)
    if (prova === undefined) throw new Error('prova sintética não criada')
    api.provas.set(avaliacao.id, { ...prova, estado: 'encerrada' })
    await activate(alternativa(page, 0), hasTouch)
    await expect(principal(page).getByRole('heading', { name: 'Quem dá a aula encerrou esta atividade' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('radio')).toHaveCount(0)
    // A escolha que não chegou a ser salva é dita, em vez de sumir em silêncio.
    await expect(principal(page).getByRole('alert')).toHaveText('A atividade foi encerrada antes de a resposta da questão 1 ser salva. Se isso fizer diferença, avise quem dá a aula.')
    await expect(principal(page)).toContainText('Você respondeu 0 de 3 questões.')
    await expect(principal(page).locator('[data-resultado="aguardando"]')).toContainText(ESPERA_PELA_CORRECAO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})

/**
 * O aluno entra e abre a tarefa pelo endereço, sem colega nem a ida pela lista: estes casos provam a comemoração, e a
 * entrada mais curta deixa cada um bem abaixo da metade do prazo do portão (15 s).
 */
async function entrarNaTarefa(page: Page, hasTouch: boolean, respostas: ProvaResponse['respostas']): Promise<void> {
  const api = await mockAlunoApi(page)
  const atividade = minhaAtividade({ situacao: 'em_andamento', respondidas: respostas.length })
  api.atividades = [atividade]
  api.provas.set(atividade.id, provaDa(atividade, { respostas }))
  const aluno = await criarAlunoComMatricula()
  await entrarComoAluno(page, aluno, hasTouch)
  await irPara(page, `/aluno/atividades/${atividade.id}`)
  await expect(mapa(page)).toContainText('Questão 1 de 3', { timeout: SCREEN_TIMEOUT_MS })
}

test.describe('a tarefa aberta: a comemoração, a 360 px, com movimento reduzido e no recomeço', () => {
  test('a 360 px: sem rolagem lateral, "Próxima" com 44 px e à vista na barra presa, e a comemoração cabe', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await entrarNaTarefa(page, hasTouch, [{ questao: 1, alternativa: 1, sequencia: 1 }, { questao: 2, alternativa: 0, sequencia: 1 }])

    const barra = principal(page).getByRole('group', { name: 'Trocar de questão' })
    const proxima = barra.getByRole('button', { name: 'Próxima' })
    expect((await proxima.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect((await barra.getByRole('button', { name: 'Anterior' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    // Presa embaixo: "Próxima" está à vista sem rolar, e continua à vista depois de rolar a página até o fim.
    await expect(proxima).toBeInViewport()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(proxima).toBeInViewport()

    await confirmarOEnvio(page, hasTouch)
    await expect(comemoracao(page)).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const volta = principal(page).getByRole('link', { name: 'Voltar às tarefas' })
    expect((await volta.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('com "reduzir movimento" a onça aparece parada, inteira, com a função e o selo', async ({ page, hasTouch }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await entrarNaTarefa(page, hasTouch, [{ questao: 1, alternativa: 1, sequencia: 1 }])
    await confirmarOEnvio(page, hasTouch)

    await expect(comemoracao(page)).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(await comemoracao(page).locator('.onca-comemora').evaluate((no) => getComputedStyle(no).animationName)).toBe('none')
    expect(await animacoesDaComemoracao(page), 'nenhuma animação na árvore da comemoração').toEqual([])
    await expect(comemoracao(page).locator('[data-onca]')).toHaveAttribute('data-pose', 'comemorando')
    await expect(comemoracao(page).locator('figcaption [data-selo-ia]')).toBeVisible()
  })

  test('o aluno seguinte no mesmo computador, na mesma tarefa, não herda a comemoração nem as respostas do anterior', async ({ page, hasTouch }) => {
    const api = await mockAlunoApi(page)
    const atividade = minhaAtividade({ situacao: 'em_andamento', respondidas: 1 })
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade, { respostas: [{ questao: 1, alternativa: 1, sequencia: 1 }] }))
    const primeiro = await criarAlunoComMatricula()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })

    // O primeiro entrega e vê a comemoração; depois sai.
    await entrarComoAluno(page, primeiro, hasTouch)
    await irPara(page, `/aluno/atividades/${atividade.id}`)
    await expect(mapa(page)).toContainText('Questão 1 de 3', { timeout: SCREEN_TIMEOUT_MS })
    await confirmarOEnvio(page, hasTouch)
    await expect(comemoracao(page)).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)')), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // O segundo entra na mesma aba, sem recarregar, e a mesma tarefa está por fazer e sem resposta para ele.
    api.provas.set(atividade.id, provaDa(atividade))
    api.atividades = [{ ...atividade, respondidas: 0 }]
    await irPara(page, `/e/${segundo.slug}`)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarInicioDoAluno(page, segundo.nome)
    await irPara(page, `/aluno/atividades/${atividade.id}`)

    await expect(mapa(page)).toContainText('Questão 1 de 3', { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('radio', { checked: true })).toHaveCount(0)
    expect(await nomesNoMapa(page)).toEqual(['Questão 1, sem resposta', 'Questão 2, sem resposta', 'Questão 3, sem resposta'])
    await expect(comemoracao(page)).toHaveCount(0)
    await expect(principal(page).getByRole('heading', { name: 'Atividade enviada' })).toHaveCount(0)
  })
})

test.describe('Tarefas a 360 px', () => {
  test('sem rolagem lateral, com a linha de pelo menos 44 px e o selo do estado abaixo do nome', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [
        minhaAtividade({ titulo: 'Lista de estequiometria com um título bem comprido para provar o corte' }),
        minhaAtividade({ titulo: 'Lista de mol', situacao: 'enviada', respondidas: 3 }),
        minhaAtividade({ titulo: 'Lista de massa molar', situacao: 'com_diagnostico', respondidas: 3 }),
      ]
    })

    await expect(principal(page).getByRole('link')).toHaveCount(3, { timeout: SCREEN_TIMEOUT_MS })
    for (const link of await principal(page).getByRole('link').all()) {
      const [linha, nome, selo] = [await link.boundingBox(), await link.locator('[title]').boundingBox(), await link.locator('[data-estado]').boundingBox()]
      expect(linha?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      // O selo desce para baixo do nome: nenhum dos dois toma a largura do outro.
      expect(selo?.y ?? 0).toBeGreaterThanOrEqual((nome?.y ?? 0) + (nome?.height ?? 0) - 1)
    }
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('recomeço de Tarefas', () => {
  test('o aluno seguinte vê as tarefas dele, e a resposta atrasada do anterior não aparece', async ({ page, hasTouch }) => {
    const primeiro = await criarAlunoComMatricula()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    const doPrimeiro = minhaAtividade({ titulo: 'Lista só do primeiro aluno' })
    const doSegundo = minhaAtividade({ titulo: 'Lista só do segundo aluno' })
    let vez: 'primeiro' | 'segundo' = 'primeiro'
    const segurada = gate()
    let entregue: () => void = () => undefined
    const entregaDoPrimeiro = new Promise<void>((resolver) => (entregue = resolver))
    await page.route('**/v1/minhas-atividades', async (rota: Route) => {
      if (vez === 'segundo') {
        await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [doSegundo] }) })
        return
      }
      // A do primeiro fica no ar, e só chega depois de o segundo estar na tela.
      await segurada.aberta
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [doPrimeiro] }) }).catch(() => undefined)
      entregue()
    })

    await entrarComoAluno(page, primeiro, hasTouch)
    await irPara(page, '/aluno/atividades')
    await expect(principal(page).getByRole('status')).toHaveText('Carregando as suas atividades…', { timeout: SIGN_IN_TIMEOUT_MS })

    // O primeiro sai com a leitura no ar; o segundo entra na mesma aba, sem recarregar.
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)')), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    vez = 'segundo'
    await irPara(page, `/e/${segundo.slug}`)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarInicioDoAluno(page, segundo.nome)
    await irPara(page, '/aluno/atividades')
    await expect(principal(page).getByRole('region', { name: 'Para fazer' }).getByRole('link', { name: /Lista só do segundo aluno/ })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    // Agora a resposta do primeiro chega. Duas voltas de quadro depois dela, a tela continua sendo a do segundo.
    segurada.abrir()
    await entregaDoPrimeiro
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(page.locator('body')).not.toContainText(doPrimeiro.titulo)
    await expect(principal(page)).toContainText(doSegundo.titulo)
  })
})

/** A caixa do elemento na tela; sem ela o caso falha dizendo qual era. */
async function caixaDe(alvo: Locator, nome: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await alvo.boundingBox()
  if (caixa === null) throw new Error(`${nome} não tem caixa na tela`)
  return caixa
}

/** Nada por cima: no centro e junto da borda de baixo do elemento, quem aparece naquele ponto é ele mesmo (ou algo dentro dele). */
async function semNadaPorCima(alvo: Locator, nome: string): Promise<void> {
  const pontos = await alvo.evaluate((no) => {
    const caixa = no.getBoundingClientRect()
    const x = caixa.left + caixa.width / 2
    return [caixa.top + caixa.height / 2, caixa.bottom - 2].map((y) => {
      const topo = document.elementFromPoint(x, y)
      return topo !== null && no.contains(topo)
    })
  })
  expect(pontos, `${nome}: algo cobre o centro ou a borda de baixo`).toEqual([true, true])
}

const ALTURA_DO_CHROMEBOOK = 768

test.describe('a tarefa aberta na janela do aluno (RF20)', () => {
  test('"Para fazer", na questão de enunciado mais longo, cabe em 1366 × 768: "Enviar a atividade" e o ponto de parada à vista, sem nada por cima', async ({ page, hasTouch }) => {
    const api = await mockAlunoApi(page)
    const atividade = minhaAtividade({ situacao: 'para_fazer', respondidas: 0 })
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade))
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)
    await irPara(page, `/aluno/atividades/${atividade.id}`)
    await expect(mapa(page)).toContainText('Questão 1 de 3', { timeout: SCREEN_TIMEOUT_MS })
    // A questão 2 é a de enunciado mais longo das sintéticas (`QUESTOES_SINTETICAS`), com quatro alternativas.
    await activate(mapa(page).getByRole('button', { name: /^Questão 2/ }), hasTouch)
    await expect(mapa(page)).toContainText('Questão 2 de 3')
    await expect(principal(page).getByRole('radio')).toHaveCount(4)

    const barra = principal(page).getByRole('group', { name: 'Trocar de questão' })
    const enviar = principal(page).getByRole('button', { name: 'Enviar a atividade' })
    const parada = principal(page).getByText('Pode parar quando quiser.')
    expect(await horizontalOverflow(page), 'a página rola para o lado').toBe(0)

    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      // O Chromebook: "Anterior" e "Próxima" na mesma linha de "Enviar a atividade", a barra solta (não presa), e a página inteira na janela.
      expect(page.viewportSize()).toEqual({ width: 1366, height: ALTURA_DO_CHROMEBOOK })
      expect(await barra.evaluate((no) => getComputedStyle(no).position), 'a barra presa cobriria a ação').toBe('static')
      const linhaDoEnvio = await caixaDe(enviar, 'Enviar a atividade')
      const proxima = await caixaDe(barra.getByRole('button', { name: 'Próxima' }), 'Próxima')
      expect(Math.abs(proxima.y - linhaDoEnvio.y), 'Próxima na linha de Enviar').toBeLessThan(linhaDoEnvio.height)
      expect(await page.evaluate(() => document.documentElement.scrollHeight), 'a página rola').toBeLessThanOrEqual(ALTURA_DO_CHROMEBOOK)
      for (const [nome, alvo] of [
        ['Enviar a atividade', enviar],
        ['Pedir ajuda ao Tutor', principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' })],
        ['Anterior', barra.getByRole('button', { name: 'Anterior' })],
        ['Próxima', barra.getByRole('button', { name: 'Próxima' })],
        ['o ponto de parada', parada],
      ] as const) {
        await expect(alvo, nome).toBeInViewport({ ratio: 1 })
        await semNadaPorCima(alvo, nome)
      }
    } else {
      // O celular: a barra continua presa embaixo, abaixo de "Enviar a atividade" e do ponto de parada (a 6.1). No fim da página ela está no lugar dela.
      expect(await barra.evaluate((no) => getComputedStyle(no).position)).toBe('sticky')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      expect((await caixaDe(barra, 'a barra')).y, 'a barra abaixo de Enviar').toBeGreaterThan((await caixaDe(enviar, 'Enviar a atividade')).y)
      expect((await caixaDe(barra, 'a barra')).y, 'a barra abaixo do ponto de parada').toBeGreaterThan((await caixaDe(parada, 'o ponto de parada')).y)
    }
    expect(await seriousViolations(page)).toEqual([])
  })

  test('corrigida, com quatro questões, cabe em 1366 × 768: o resumo e a lista em duas colunas, a lista rola por dentro, com foco, e o resto fica à vista', async ({ page, hasTouch }) => {
    const api = await mockAlunoApi(page)
    const atividade = minhaAtividade({ situacao: 'com_diagnostico', respondidas: 4, questoes: 4, enviadaEm: '2026-10-05T13:30:00.000Z' })
    const base = diagnosticoDa(atividade)
    const segunda = base.questoes.find((item) => item.numero === 2)
    if (segunda === undefined) throw new Error('o diagnóstico sintético não tem a questão 2')
    const quarta = { ...segunda, numero: 4, explicacao: 'A proporção é de 3 para 2, e o hidrogênio acaba primeiro.' }
    const questoes: ProvaResponse['questoes'] = [...QUESTOES_SINTETICAS, { numero: 4, enunciado: 'Quantos mols de N₂ reagem com 9 mol de H₂?', alternativas: ['1 mol', '2 mol', '3 mol', '9 mol'] }]
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade, { questoes, enviadaEm: atividade.enviadaEm, respostas: questoes.map((q) => ({ questao: q.numero, alternativa: 0, sequencia: 1 })) }))
    api.diagnosticos.set(atividade.id, { ...base, total: 4, questoes: [...base.questoes, quarta] })
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)
    await irPara(page, `/aluno/atividades/${atividade.id}`)
    const resultado = principal(page).getByRole('region', { name: 'Seu resultado' })
    await expect(resultado).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const lista = resultado.getByRole('group', { name: 'Questões corrigidas' })
    await expect(resultado.locator('[data-questao-corrigida]')).toHaveCount(4)
    expect(await horizontalOverflow(page), 'a página rola para o lado').toBe(0)

    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      expect(page.viewportSize()).toEqual({ width: 1366, height: ALTURA_DO_CHROMEBOOK })
      expect(await page.evaluate(() => document.documentElement.scrollHeight), 'a página rola').toBeLessThanOrEqual(ALTURA_DO_CHROMEBOOK)
      // Duas colunas: o resumo à esquerda e a lista à direita. A lista é que rola, por dentro, e se alcança pelo teclado.
      const resumo = await caixaDe(resultado.getByRole('region', { name: 'Acertos por habilidade' }), 'Acertos por habilidade')
      const questoesCaixa = await caixaDe(lista, 'a lista')
      expect(questoesCaixa.x, 'a lista à direita do resumo').toBeGreaterThan(resumo.x + resumo.width - 1)
      expect(await lista.evaluate((no) => no.scrollHeight > no.clientHeight), 'a lista não rola por dentro').toBe(true)
      await expect(lista).toHaveAttribute('tabindex', '0')
      await expect(resultado.getByRole('region', { name: 'Acertos por habilidade' })).toBeInViewport({ ratio: 1 })
      await expect(resultado.locator('[data-questao-corrigida]').first()).toBeInViewport()
    } else {
      // O celular: a página rola, e a lista não é uma segunda rolagem dentro dela: sem o grupo, sem o foco, e a lista do tamanho que tem.
      await expect(lista).toHaveCount(0)
      const caixaDaLista = resultado.locator('ol').locator('xpath=..')
      expect(await caixaDaLista.evaluate((no) => no.scrollHeight <= no.clientHeight), 'a lista rola por dentro no celular').toBe(true)
      await expect(caixaDaLista).not.toHaveAttribute('tabindex', /.*/)
    }
    expect(await seriousViolations(page)).toEqual([])
  })
})
