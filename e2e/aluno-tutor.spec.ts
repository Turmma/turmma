import type { Locator, Page } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { conferirAssinaturas, conferirQueAOncaNaoTemNome } from './__fixtures__/avatar.ts'
import { encaminhamento, erroDaApi, minhaAtividade, perguntaDoAluno, portao, provaDa, respostaDoTutor, simularAluno, type ApiDoAluno } from './__fixtures__/aluno.ts'
import { entrarComoAluno, irPelaNavegacao, PRAZO_DA_ENTRADA_MS } from './__fixtures__/casca.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, type AlunoDeTeste } from './__fixtures__/sessao.ts'
import { codigoCru, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * O Tutor do aluno (MVP, A4, pacote X; `docs/interface.md` 11.6): a escolha da atividade e a conversa por atividade.
 * **Os estados da tela**, com a API simulada na página (`__fixtures__/aluno.ts`). A sessão, o `/v1/eu` e a turma são os
 * de verdade. O fluxo inteiro contra a API real está em `aluno-fluxo.spec.ts`.
 */

const PRAZO_DA_TELA_MS = 15_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SUPERVISAO = 'Quem dá a aula acompanha como você usa o Tutor.'
const PROIBIDO_NA_AREA = /\bnotas?\b|\bconceito\b|ranking|média da turma|colegas?\b/i
/** O que a área do aluno não tem (D59; 11.6): sequência, conquista, sugestão pronta. */
const INDUZ_USO = /sequência|dias seguidos|conquista|parabéns|continue assim|sugest/i

interface Cena {
  readonly api: ApiDoAluno
  readonly aluno: AlunoDeTeste
  readonly colega: AlunoDeTeste
}

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

async function irPara(page: Page, caminho: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState(null, '', destino)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, caminho)
}

async function recarregar(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })
}

async function entrar(page: Page, hasTouch: boolean, antes?: (api: ApiDoAluno) => void): Promise<Cena> {
  const api = await simularAluno(page)
  antes?.(api)
  const aluno = await criarAlunoComMatricula()
  const turma = await colocarAlunoNaTurma(aluno)
  const colega = await criarAlunoComMatricula({ escola: aluno })
  await colocarAlunoNaTurma(colega, turma)
  await entrarComoAluno(page, aluno, hasTouch)
  return { api, aluno, colega }
}

const principal = (page: Page) => page.getByRole('main')
const faixa = (page: Page) => principal(page).locator('[data-faixa-de-supervisao]')
const caixa = (page: Page) => page.getByRole('textbox', { name: 'Pergunta para o Tutor' })
const conversa = (page: Page) => page.getByRole('log', { name: 'Conversa com o Tutor' })
const usoDoDia = (page: Page) => principal(page).locator('[data-uso-do-dia]')
const pausa = (page: Page) => principal(page).locator('[data-pausa-do-tutor]')

async function perguntar(page: Page, texto: string, hasTouch: boolean): Promise<void> {
  await caixa(page).fill(texto)
  await acionar(page.getByRole('button', { name: 'Enviar' }), hasTouch)
}

/** Nada na tela se mexe sozinho: nenhuma animação em laço, em elemento nenhum (D59; 9.5, regra 7). */
async function animacoesEmLaco(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((elemento) => {
        const estilo = getComputedStyle(elemento)
        return estilo.animationName !== 'none' && estilo.animationIterationCount === 'infinite'
      })
      .map((elemento) => elemento.tagName),
  )
}

test.describe('o Tutor pelo Início e a conversa por atividade', () => {
  test('a escolha da atividade e a conversa: carregando, vazia, erro e com mensagens; a faixa que não fecha, a caixa só de texto, o selo de IA, o chip de página e "Hoje: N de 60"', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const segurada = portao()
    const { api, colega } = await entrar(page, hasTouch)

    // Pelo Início (X4, 3.0), sem tarefa nenhuma: o vazio diz que o Tutor ajuda quando houver, e a faixa já está lá. O endereço de
    // hoje do Tutor, `/aluno/tutor`, abre a escolha da atividade (RF2) e fica dentro de "Início" na lateral.
    await irPelaNavegacao(page, 'Início', hasTouch)
    await expect(page).toHaveURL(/\/aluno\/inicio$/)
    await expect(page).toHaveTitle('Início · Turmma', { timeout: PRAZO_DA_TELA_MS })
    await expect(principal(page).getByText('Nenhuma tarefa por agora')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(faixa(page).getByRole('note')).toHaveText(SUPERVISAO)
    // Sem botão de fechar: o Tutor é sempre supervisionado, e o aluno não esconde o aviso (D8; regra 70, item 4).
    await expect(faixa(page).getByRole('button')).toHaveCount(0)
    await expect(caixa(page)).toHaveCount(0)

    // Com atividade: o aluno escolhe em qual quer ajuda, e a conversa é dela.
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade))
    api.trocar('conversa', async (entrada) => {
      await segurada.aberta
      return api.responder('conversa', entrada)
    })
    await recarregar(page)
    await irPara(page, '/aluno/tutor')
    await expect(page).toHaveURL(/\/aluno\/tutor$/)
    await expect(principal(page).getByRole('heading', { name: 'Em qual atividade você quer ajuda?' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await acionar(principal(page).getByRole('link', { name: /Lista de estequiometria/ }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividade.id}$`))

    // Carregando.
    await expect(principal(page).getByRole('status')).toHaveText('Carregando a conversa…', { timeout: PRAZO_DA_TELA_MS })
    await expect(faixa(page).getByRole('note')).toHaveText(SUPERVISAO)

    // Vazia: convite para perguntar, dizendo o que o Tutor é e o que ele não faz (D58, D65).
    segurada.abrir()
    await expect(principal(page).getByText('Nenhuma pergunta ainda')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(principal(page)).toContainText('O Tutor não entrega a resposta pronta')
    await expect(principal(page)).toContainText('Ele é uma inteligência artificial e pode errar.')
    await expect(principal(page)).toContainText('Ajuda em: Lista de estequiometria')

    // A caixa é só texto e enviar: sem seletor, sem menu, sem anexo.
    const formulario = page.locator('form[data-caixa-pedido="so-texto"]')
    await expect(formulario).toHaveCount(1)
    await expect(formulario.locator('select, input, [role="combobox"], [aria-haspopup]')).toHaveCount(0)
    await expect(formulario.getByRole('button')).toHaveCount(1)
    await expect(caixa(page)).toBeEnabled()
    // "Hoje: N de 60 perguntas", em texto, com o que a API mandou.
    await expect(usoDoDia(page)).toContainText('Hoje: 12 de 60 perguntas')
    await expect(usoDoDia(page)).toContainText('faltam 48')
    // Com o teclado aberto no celular (a tela baixa), a barra vira uma linha de texto, e volta quando a tela cresce.
    const tamanho = page.viewportSize()
    if (tamanho !== null) {
      const linha = usoDoDia(page).getByText('Hoje: 12 de 60 perguntas · faltam 48')
      await expect(linha).toBeHidden()
      await page.setViewportSize({ width: tamanho.width, height: 400 })
      await expect(linha).toBeVisible()
      await page.setViewportSize(tamanho)
      await expect(linha).toBeHidden()
    }
    expect(await violacoesGraves(page)).toEqual([])

    // Erro ao ler a conversa: "Tentar de novo", sem código.
    api.trocar('conversa', () => erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await recarregar(page)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    await expect(faixa(page).getByRole('note')).toHaveText(SUPERVISAO)
    for (const cru of [codigoCru('503'), 'INDISPONIVEL']) await expect(page.locator('body')).not.toContainText(cru)

    // Com mensagens: a fala do aluno, e a do Tutor assinada, com o selo "IA" e o chip da página.
    api.conversas.set(atividade.id, [
      perguntaDoAluno('qual é a resposta da questão 2?'),
      respostaDoTutor('Essa eu não respondo por você.\n\nO primeiro passo é pequeno: quantos mols há em 54 g de alumínio?'),
      ...Array.from({ length: 6 }, (_, indice) => [perguntaDoAluno(`pergunta sintética ${String(indice + 1)}`), respostaDoTutor(`O que a questão pede? (${String(indice + 1)})`, 145)]).flat(),
    ])
    api.trocar('conversa')
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(conversa(page).getByText('Você: qual é a resposta da questão 2?')).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    const respostas = conversa(page).locator('article').filter({ has: page.locator('[data-selo-ia]') })
    await expect(respostas).toHaveCount(7)
    // Cada resposta do Tutor assina com a onça, o nome "Tutor" e o selo "IA" no mesmo bloco (RF10).
    expect(await conferirAssinaturas(conversa(page))).toBeGreaterThanOrEqual(7)
    // Nada da conversa do aluno se chama "onça": o avatar é desenho, e quem assina é o Tutor (A28).
    await conferirQueAOncaNaoTemNome(page)
    await expect(respostas.first()).toContainText('Tutor')
    await expect(respostas.first()).toContainText('quantos mols há em 54 g de alumínio?')
    await expect(respostas.first().getByRole('button', { name: 'Fonte: Material da escola, p. 142' })).toBeVisible()

    // A faixa não fecha: não tem botão, e continua à vista no fim da conversa, depois de rolar.
    await expect(faixa(page).getByRole('button')).toHaveCount(0)
    await expect(faixa(page).getByRole('link')).toHaveCount(0)
    await caixa(page).scrollIntoViewIfNeeded()
    await expect(faixa(page)).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(faixa(page)).toBeInViewport()

    // A barra do uso é neutra, e nada se mexe sozinho.
    const cores = await usoDoDia(page).locator('svg rect').evaluateAll((barras) => barras.map((barra) => getComputedStyle(barra).fill))
    expect(cores).toEqual(['rgb(240, 240, 240)', 'rgb(93, 93, 93)'])
    expect(await animacoesEmLaco(page)).toEqual([])

    // Nada de colega, de nota, nem do que induz uso.
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    await expect(principal(page)).not.toContainText(INDUZ_USO)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('da atividade, "Pedir ajuda ao Tutor nesta questão" leva a atividade e a questão; a pergunta aparece na hora, o Tutor responde assinado, e o uso do dia sobe', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
    })
    // A atividade se abre por Tarefas: o link do Início leva direto ao Tutor dela.
    await irPelaNavegacao(page, 'Tarefas', hasTouch)
    await acionar(principal(page).getByRole('link', { name: /Lista de estequiometria/ }), hasTouch)
    await acionar(principal(page).getByRole('button', { name: 'Próxima' }), hasTouch)
    await acionar(principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividade.id}\\?questao=2$`))
    await expect(principal(page)).toContainText('Ajuda em: Lista de estequiometria · questão 2', { timeout: PRAZO_DA_TELA_MS })
    await expect(faixa(page).getByRole('note')).toHaveText(SUPERVISAO)

    await perguntar(page, 'me dá a resposta', hasTouch)
    // A pergunta aparece na hora, uma vez só; a caixa esvazia, e o "preparando" é texto parado.
    await expect(conversa(page).getByText('Você: me dá a resposta')).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await expect(caixa(page)).toHaveValue('')
    await expect(conversa(page).locator('[data-pensando]')).toContainText('Preparando a resposta…')
    expect(await animacoesEmLaco(page)).toEqual([])
    // Com a pergunta no ar, a caixa continua aceitando texto, e outra pergunta não sai.
    await caixa(page).fill('é a B, né?')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    const [pedido] = api.pedidosEm(/\/v1\/tutor\/mensagens$/)
    expect(pedido?.corpo).toEqual({ texto: 'me dá a resposta', atividadeAplicadaId: atividade.id, questao: 2, chaveEnvio: expect.stringMatching(UUID) })

    api.responderNoTutor(atividade.id, respostaDoTutor('Essa eu não respondo por você. Quantos mols de H₂ a equação pede para cada 2 mol de amônia?'))
    const resposta = conversa(page).locator('article').filter({ has: page.locator('[data-selo-ia]') }).last()
    await expect(resposta).toContainText('Quantos mols de H₂ a equação pede', { timeout: PRAZO_DA_TELA_MS })
    await expect(resposta.getByRole('button', { name: 'Fonte: Material da escola, p. 142' })).toBeVisible()
    await expect(conversa(page).locator('[data-pensando]')).toHaveCount(0)
    await expect(conversa(page).getByText('Você: me dá a resposta')).toHaveCount(1)
    await expect(conversa(page).getByText('Essa eu não respondo por você.')).toHaveCount(1)
    // O uso do dia é lido de novo depois da troca.
    await expect(usoDoDia(page)).toContainText('Hoje: 13 de 60 perguntas', { timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/\/v1\/tutor\/mensagens$/)).toHaveLength(1)
    // O que ficou escrito na caixa não saiu sozinho: agora dá para enviar.
    await expect(caixa(page)).toHaveValue('é a B, né?')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeEnabled()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('o Tutor pausado explica, não parece erro, e não trava a caixa', () => {
  test('"Ver mensagens anteriores" traz as antigas, em ordem, sem jogar a tela para o fim da conversa', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const troca = (numero: number, quando: string) => [
      perguntaDoAluno(`pergunta ${quando} ${String(numero)}`),
      respostaDoTutor(`Resposta ${quando} ${String(numero)}, com algumas linhas de texto para a conversa ficar mais alta que a janela do computador.`),
    ]
    await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.conversasAnteriores.set(atividade.id, [1, 2, 3, 4, 5, 6].flatMap((numero) => troca(numero, 'antiga')))
      simulada.conversas.set(atividade.id, [1, 2, 3, 4, 5, 6].flatMap((numero) => troca(numero, 'recente')))
    })
    await irPara(page, `/aluno/tutor/${atividade.id}`)
    const ultima = conversa(page).getByText('Resposta recente 6,')
    // A conversa abre no fim: a última mensagem à vista.
    await expect(ultima).toBeInViewport({ timeout: PRAZO_DA_TELA_MS })
    await expect(conversa(page).getByText('Você: pergunta antiga 1')).toHaveCount(0)

    const anteriores = page.getByRole('button', { name: 'Ver mensagens anteriores' })
    await anteriores.scrollIntoViewIfNeeded()
    await expect(ultima).not.toBeInViewport()
    await acionar(anteriores, hasTouch)
    await expect(conversa(page).getByText('Você: pergunta antiga 1')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(anteriores).toHaveCount(0)
    // O aluno foi ler o começo: a tela fica onde ele está, e não volta para o fim.
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(ultima).not.toBeInViewport()
    // As antigas vêm antes das recentes, cada pergunta antes da resposta dela.
    const falas = await conversa(page).locator('article').allInnerTexts()
    expect(falas).toHaveLength(24)
    expect(falas[0]).toContain('pergunta antiga 1')
    expect(falas[1]).toContain('Resposta antiga 1,')
    expect(falas[12]).toContain('pergunta recente 1')
    expect(falas[23]).toContain('Resposta recente 6,')
  })

  test('em avaliação: o aviso com o título dela; a pergunta comum volta recusada e vira o mesmo aviso; a mensagem de assunto delicado recebe o encaminhamento com o 188', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
      simulada.tutor = { estado: 'avaliacao', uso: { hoje: 12, limiteDoDia: 60 }, avaliacaoAberta: { titulo: 'Prova de estequiometria' } }
    })
    await irPara(page, `/aluno/tutor/${atividade.id}`)
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'avaliacao', { timeout: PRAZO_DA_TELA_MS })
    await expect(pausa(page)).toContainText('O Tutor está pausado durante a avaliação.')
    await expect(pausa(page)).toContainText('Prova de estequiometria')
    await expect(pausa(page)).toContainText('Ele volta quando quem dá a aula encerrar.')
    // É aviso, e não erro: sem alerta, sem "Tentar de novo", sem vermelho.
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
    expect(await pausa(page).evaluate((aviso) => getComputedStyle(aviso).backgroundColor)).toBe('rgb(255, 255, 255)')
    await expect(faixa(page).getByRole('note')).toHaveText(SUPERVISAO)

    // A caixa não trava: a pergunta comum sai, o servidor recusa (409), e a tela mostra o aviso do estado.
    await expect(caixa(page)).toBeEnabled()
    await perguntar(page, 'qual é a resposta da 2?', hasTouch)
    await expect(conversa(page)).toContainText('O Tutor não recebeu esta mensagem.', { timeout: PRAZO_DA_TELA_MS })
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'avaliacao')
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).locator('[data-falha-do-tutor]')).toHaveCount(0)
    for (const cru of [codigoCru('409'), 'TUTOR_PAUSADO', MENSAGENS_DE_ERRO.ERRO_INTERNO]) await expect(page.locator('body')).not.toContainText(cru)
    await expect(caixa(page)).toBeEnabled()

    // O assunto delicado passa na frente: a API aceita e responde com a mensagem fixa, mesmo com o Tutor pausado.
    api.trocar('mensagens', (entrada) => api.aceitarPergunta(entrada.corpo))
    await perguntar(page, 'sofro bullying na escola', hasTouch)
    await expect(conversa(page).getByText('Você: sofro bullying na escola')).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    api.responderNoTutor(atividade.id, encaminhamento())
    const cartao = conversa(page).locator('[data-assunto-delicado]')
    await expect(cartao).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(cartao).toContainText('Procure hoje seu professor ou a orientação educacional da escola.')
    // O 188 é texto que se seleciona e link para ligar; continua assinado pelo Tutor, com o selo de IA.
    const telefone = cartao.getByRole('link', { name: '188' })
    await expect(telefone).toHaveCount(1)
    await expect(telefone).toHaveAttribute('href', 'tel:188')
    expect(await telefone.evaluate((link) => getComputedStyle(link).userSelect)).not.toBe('none')
    await expect(cartao.locator('[data-selo-ia]')).toHaveCount(1)
    // Calmo: sem alerta, sem animação, sem vermelho.
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    expect(await cartao.evaluate((elemento) => [getComputedStyle(elemento).animationName, getComputedStyle(elemento).backgroundColor])).toEqual(['none', 'rgb(244, 244, 244)'])
    expect(await animacoesEmLaco(page)).toEqual([])
    // O estado continua o mesmo: o Tutor segue pausado, e a mensagem fixa não conta como pergunta do dia.
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'avaliacao')
    await expect(usoDoDia(page)).toContainText('Hoje: 12 de 60 perguntas')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('no limite do dia: diz com calma que por hoje acabou e que amanhã volta; a caixa não trava, e a mensagem sem o 188 ganha a linha dele', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
      simulada.tutor = { estado: 'limite', uso: { hoje: 60, limiteDoDia: 60 }, avaliacaoAberta: null }
    })
    await irPara(page, `/aluno/tutor/${atividade.id}`)
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'limite_do_dia', { timeout: PRAZO_DA_TELA_MS })
    await expect(pausa(page)).toContainText('Por hoje acabou.')
    await expect(pausa(page)).toContainText('Você fez as 60 perguntas de hoje. Amanhã o Tutor volta.')
    await expect(usoDoDia(page)).toContainText('Hoje: 60 de 60 perguntas')
    await expect(usoDoDia(page)).toContainText('por hoje acabou')
    // A barra cheia continua neutra: não fica vermelha, não pisca.
    const cores = await usoDoDia(page).locator('svg rect').evaluateAll((barras) => barras.map((barra) => getComputedStyle(barra).fill))
    expect(cores).toEqual(['rgb(240, 240, 240)', 'rgb(93, 93, 93)'])
    expect(await animacoesEmLaco(page)).toEqual([])
    await expect(principal(page).getByRole('alert')).toHaveCount(0)

    // A pergunta comum volta 429: o aviso do estado, e não erro.
    await expect(caixa(page)).toBeEnabled()
    await perguntar(page, 'só mais uma dúvida', hasTouch)
    await expect(conversa(page)).toContainText('O Tutor não recebeu esta mensagem.', { timeout: PRAZO_DA_TELA_MS })
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'limite_do_dia')
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    for (const cru of [codigoCru('429'), 'LIMITE_DIARIO']) await expect(page.locator('body')).not.toContainText(cru)

    // O assunto delicado ainda é atendido; a mensagem fixa que não traz o número ganha a linha do 188.
    api.trocar('mensagens', (entrada) => api.aceitarPergunta(entrada.corpo))
    await perguntar(page, 'me ameaçam na saída da escola', hasTouch)
    await expect(conversa(page).getByText('Você: me ameaçam na saída da escola')).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    api.responderNoTutor(atividade.id, encaminhamento('Obrigado por me contar.\n\nProcure hoje um adulto de confiança na escola.'))
    const cartao = conversa(page).locator('[data-assunto-delicado]')
    await expect(cartao).toContainText('Procure hoje um adulto de confiança na escola.', { timeout: PRAZO_DA_TELA_MS })
    await expect(cartao.getByRole('link', { name: '188' })).toHaveAttribute('href', 'tel:188')
    await expect(cartao).toContainText('ligue 188 (CVV)')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('a função suspensa pela escola vira aviso que explica; a falha do modelo deixa a pergunta na conversa com "Tentar de novo"', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade()
    const { api } = await entrar(page, hasTouch, (simulada) => {
      simulada.atividades = [atividade]
      simulada.provas.set(atividade.id, provaDa(atividade))
    })
    await irPara(page, `/aluno/tutor/${atividade.id}`)
    await expect(caixa(page)).toBeEnabled({ timeout: PRAZO_DA_TELA_MS })

    // Falha do modelo: a pergunta fica, com o texto calmo e o botão; nada de código.
    await perguntar(page, 'como acho a massa molar?', hasTouch)
    await expect(conversa(page).locator('[data-pensando]')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    api.falharNoTutor('IA_INDISPONIVEL')
    const falha = conversa(page).locator('[data-falha-do-tutor="tentar"]')
    await expect(falha).toContainText('O Tutor não conseguiu responder agora. Tente de novo.', { timeout: PRAZO_DA_TELA_MS })
    await expect(conversa(page).getByText('Você: como acho a massa molar?')).toHaveCount(1)
    for (const cru of ['IA_INDISPONIVEL', codigoCru('503'), MENSAGENS_DE_ERRO.IA_INDISPONIVEL]) await expect(page.locator('body')).not.toContainText(cru)
    // A pergunta que falhou não conta no uso do dia.
    await expect(usoDoDia(page)).toContainText('Hoje: 12 de 60 perguntas')
    expect(await violacoesGraves(page)).toEqual([])

    // "Tentar de novo" manda a mesma pergunta outra vez, e a resposta chega.
    await acionar(falha.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect.poll(() => api.pedidosEm(/\/v1\/tutor\/mensagens$/).length).toBe(2)
    expect(api.pedidosEm(/\/v1\/tutor\/mensagens$/).map((pedido) => (pedido.corpo as { texto: string }).texto)).toEqual(['como acho a massa molar?', 'como acho a massa molar?'])
    api.responderNoTutor(atividade.id, respostaDoTutor('Vamos por partes. O que a tabela periódica diz sobre o hidrogênio?'))
    await expect(conversa(page)).toContainText('O que a tabela periódica diz sobre o hidrogênio?', { timeout: PRAZO_DA_TELA_MS })
    await expect(conversa(page).locator('[data-falha-do-tutor]')).toHaveCount(0)
    // A API grava a pergunta de cada envio, também o que falhou: depois de tentar de novo ela está duas vezes na conversa.
    await expect(conversa(page).getByText('Você: como acho a massa molar?')).toHaveCount(2)

    // A coordenação suspende o Tutor: a pergunta seguinte é recusada, e a tela explica, sem alarme.
    api.trocar('mensagens', () => erroDaApi(409, 'FUNCAO_SUSPENSA'))
    await perguntar(page, 'e o oxigênio?', hasTouch)
    await expect(pausa(page)).toHaveAttribute('data-pausa-do-tutor', 'suspenso', { timeout: PRAZO_DA_TELA_MS })
    await expect(pausa(page)).toContainText('A coordenação pausou o Tutor por enquanto. Não é um erro, e não é com você.')
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).locator('[data-falha-do-tutor]')).toHaveCount(0)
    await expect(caixa(page)).toBeEnabled()
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
