import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { montarXlsx } from '../apps/web/src/__fixtures__/xlsx.ts'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { abrirEstrutura, entrarPelaTelaComSegundoFator, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { expect, test } from './support/profiles.ts'
import { alunosDaTurmaNoBanco, aprovarNaListaDaTurma, colocarAlunoNaTurma, criarAlunoComMatricula, criarEquipeComSenha, criarTurmaComNomeNoBanco, estadosDaListaNoBanco, type EquipeDeTeste } from './support/seed.ts'

/**
 * A planilha de alunos da escola inteira, na aba Turmas (F2, 13.0; RF2 a RF4 e RF15): o painel "Importar alunos" (`?painel=importar`), a
 * prévia com os erros e as marcas primeiro, o gravar e o resultado. Tudo pela tela, nos projetos `chromebook` e `celular`, com nomes e
 * matrículas inventados pelo teste.
 *
 * Cada caso abre o painel pelo endereço e entra pela API (`abrirPelaApiSemMedirAPrimeiraCarga`): o assunto aqui vem depois da entrada
 * (a entrada pela tela tem os casos dela), e o login pela tela não cabe nos 15 s do portão junto com a prévia e o gravar. A planilha
 * entra sempre por `setInputFiles` com `buffer`, como a coordenação escolhe o arquivo; nunca se cola texto num campo.
 */

const ENDERECO_DO_PAINEL = '/coordenacao/estrutura?painel=importar'
const CAMPO_DO_ARQUIVO = 'Arquivo da planilha (Excel ou CSV)'
const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const ROTA_DA_PREVIA = '**/v1/importacoes/alunos/previa'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const painel = (page: Page): Locator => page.getByRole('dialog', { name: 'Importar alunos' })

/** A coordenação entra pela API e cai direto no painel, com o convite do começo à vista. */
async function abrirOPainel(page: Page, request: APIRequestContext, coordenadora: EquipeDeTeste): Promise<Locator> {
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, ENDERECO_DO_PAINEL, () =>
    expect(painel(page).getByRole('button', { name: 'Baixar modelo' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }),
  )
  return painel(page)
}

/** Escolhe o arquivo no campo do painel, como o navegador o entrega. */
async function escolher(page: Page, nome: string, conteudo: string | Uint8Array, tipo = 'text/csv'): Promise<void> {
  const buffer = typeof conteudo === 'string' ? Buffer.from(conteudo, 'utf8') : Buffer.from(conteudo)
  await painel(page).getByLabel(CAMPO_DO_ARQUIVO).setInputFiles({ name: nome, mimeType: tipo, buffer })
}

/** Uma planilha no modelo: o cabeçalho e as linhas. */
const planilha = (...linhas: string[]): string => ['turma;nome;matricula', ...linhas].join('\n') + '\n'

const resumoDaPrevia = (dialogo: Locator, texto: string | RegExp): Locator => dialogo.getByRole('status').filter({ hasText: texto })
const tituloDaPrevia = (dialogo: Locator): Locator => dialogo.getByRole('heading', { name: 'Prévia' })

/** Os POST de gravar e de prévia que a página mandou, para contar. */
function contarPedidos(page: Page): { readonly gravacoes: Request[]; readonly previas: Request[] } {
  const gravacoes: Request[] = []
  const previas: Request[] = []
  page.on('request', (pedido) => {
    if (pedido.method() !== 'POST') return
    const caminho = new URL(pedido.url()).pathname
    if (caminho === '/v1/importacoes/alunos') gravacoes.push(pedido)
    if (caminho === '/v1/importacoes/alunos/previa') previas.push(pedido)
  })
  return { gravacoes, previas }
}

async function alvoDeToque(alvo: Locator, descricao: string, minimo: number): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(minimo)
}

test.describe('RF2 e RF15 (13.0): subir a planilha de alunos, ver a prévia e gravar', () => {
  test('o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador', async ({
    page,
    request,
    hasTouch,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const ana = `Ana Souza ${marca}`
    const bia = `Bia Lima ${marca}`
    const { gravacoes } = contarPedidos(page)
    const dialogo = await abrirOPainel(page, request, coordenadora)

    // O vazio convida a baixar o modelo: o arquivo com o cabeçalho da planilha de alunos.
    await expect(dialogo.getByText('Nenhuma planilha escolhida')).toBeVisible()
    // O seletor é o botão em português do produto, e o campo do navegador ("Choose File", no idioma dele) fica escondido.
    await expect(dialogo.getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()
    await expect(dialogo.getByText('Nenhum arquivo escolhido.')).toBeVisible()
    await expect(dialogo.getByLabel(CAMPO_DO_ARQUIVO)).toBeHidden()
    const baixando = page.waitForEvent('download')
    await activate(dialogo.getByRole('button', { name: 'Baixar modelo' }), hasTouch)
    expect((await baixando).suggestedFilename()).toBe('modelo-alunos.csv')

    // Carregando: a prévia segurada, e a tela diz que está conferindo.
    const segurada = gate()
    await page.route(ROTA_DA_PREVIA, async (rota: Route) => {
      await segurada.aberta
      await rota.continue()
    })
    await escolher(page, 'alunos.csv', planilha(`8º A;${ana};${marca}01`, `9º B;${bia};${marca}02`))
    await expect(dialogo.getByRole('status').filter({ hasText: 'Conferindo a planilha com a escola…' })).toBeVisible()
    await expect(dialogo.getByText('Nenhuma planilha escolhida')).toHaveCount(0)
    segurada.abrir()

    // A prévia chega com o foco no título; o resto é contagem, sem nome nem matrícula.
    await expect(resumoDaPrevia(dialogo, '2 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(tituloDaPrevia(dialogo)).toBeFocused()
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).toContainText('2 linhas entram')
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).toContainText('2 turmas novas serão criadas.')
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).not.toContainText(ana)

    // O clique duplo manda um pedido só, e o resultado diz quantos entraram e leva o foco.
    await dialogo.getByRole('button', { name: 'Gravar planilha' }).dblclick()
    const resultado = dialogo.getByRole('heading', { name: 'Planilha gravada' })
    await expect(resultado).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogo.getByRole('region', { name: 'Planilha gravada' })).toContainText('2 alunos entraram. 2 turmas novas foram criadas. Nenhuma linha ficou de fora.')
    expect(gravacoes).toHaveLength(1)
    await expect(tituloDaPrevia(dialogo)).toHaveCount(0)

    // Sem rastro: nome e matrícula não vão para o armazenamento do navegador nem para o endereço, e a tela não cria banco nem cache.
    const guardado = await page.evaluate(async () => ({
      texto: JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), location.href]),
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    for (const dado of [ana, bia, marca]) expect(guardado.texto).not.toContain(dado)
    expect(guardado.bancos).toEqual([])
    expect(guardado.caches).toEqual([])

    // As turmas da tela de trás já estão atualizadas: fechar o painel mostra as duas turmas novas.
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    const turmas = page.getByRole('main').getByRole('region', { name: 'Turmas de 2026' })
    await expect(turmas).toContainText('8º A', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(turmas).toContainText('9º B')
  })

  test('o XLSX só é carregado quando alguém escolhe um, fora do pedaço da entrada; a primeira aba vira a prévia', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Cada resposta de script da página, com o texto: o leitor do Excel se reconhece pelo caminho da planilha de textos dentro do zip.
    const scripts: Array<Promise<{ url: string; texto: string }>> = []
    page.on('response', (resposta) => {
      if (resposta.request().resourceType() !== 'script') return
      scripts.push(resposta.text().then((texto) => ({ url: resposta.url(), texto })))
    })
    const dialogo = await abrirOPainel(page, request, coordenadora)
    const antes = await Promise.all(scripts)
    expect(antes.length).toBeGreaterThan(0)
    expect(antes.filter(({ texto }) => texto.includes('sharedStrings'))).toEqual([])

    const marca = `m${randomUUID().slice(0, 7)}`
    await escolher(page, 'alunos.xlsx', montarXlsx([['turma', 'nome', 'matricula'], ['8º A', `Ana Souza ${marca}`, '00123']]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await expect(resumoDaPrevia(dialogo, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).toContainText('1 linha entra')
    const depois = await Promise.all(scripts)
    expect(depois.filter(({ texto }) => texto.includes('sharedStrings')).length).toBeGreaterThan(0)
    expect(depois.length).toBeGreaterThan(antes.length)
  })

  test('com erro, a prévia lista os erros em frase e de cem em cem, o resto fica em contagem, não há como gravar, e a 360 px nada rola de lado', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const { gravacoes } = contarPedidos(page)
    const dialogo = await abrirOPainel(page, request, coordenadora)
    // 130 linhas sem turma e uma boa: os erros vêm primeiro, a boa só entra na contagem.
    const semTurma = Array.from({ length: 130 }, (_, posicao) => `;Aluno ${String(posicao)} ${marca};${marca}${String(posicao).padStart(3, '0')}`)
    await escolher(page, 'com-erro.csv', planilha(...semTurma, `8º A;Ana Souza ${marca};${marca}900`))

    const erros = dialogo.getByRole('region', { name: 'Linhas com erro (130)' })
    await expect(erros).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(tituloDaPrevia(dialogo)).toBeFocused()
    await expect(resumoDaPrevia(dialogo, '131 linhas lidas · 130 com erro · 0 com aviso')).toBeVisible()
    await expect(erros.getByRole('listitem')).toHaveCount(100)
    await expect(erros.getByRole('listitem').first()).toHaveText(/^Linha 2: Falta a turma\. Escreva a turma desta linha, como "8º A"\.$/)
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).toContainText('1 linha entra')
    await expect(dialogo.getByRole('region', { name: 'O resto da planilha' })).not.toContainText(`Ana Souza ${marca}`)
    const verMais = erros.getByRole('button', { name: 'Ver mais (30 restantes)' })
    await alvoDeToque(verMais, 'Ver mais', 24)
    await activate(verMais, hasTouch)
    await expect(erros.getByRole('listitem')).toHaveCount(130)
    await expect(verMais).toHaveCount(0)

    // Com erro, o botão nem aparece: o motivo está no lugar dele, e nada foi enviado para gravar.
    await expect(dialogo.getByRole('button', { name: 'Gravar planilha' })).toHaveCount(0)
    await expect(dialogo).toContainText('nada é gravado enquanto houver erro')
    expect(gravacoes).toHaveLength(0)
    expect(await horizontalOverflow(page)).toBe(0)
    await paginaNaoRola(page)
  })

  test('a prévia que falha diz o que fazer, com "Tentar de novo"; o arquivo novo tira o aviso e o foco do anterior', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const dialogo = await abrirOPainel(page, request, coordenadora)
    let falhar = true
    await page.route(ROTA_DA_PREVIA, (rota: Route) => (falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue()))

    await escolher(page, 'alunos.csv', planilha(`8º A;Ana ${marca};${marca}01`))
    const alerta = dialogo.getByRole('alert')
    await expect(alerta).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(alerta).toBeFocused()
    // O "carregando" sai quando a prévia falha: o alerta não convive com "Conferindo a planilha…".
    await expect(dialogo.getByRole('status').filter({ hasText: 'Conferindo a planilha com a escola…' })).toHaveCount(0)
    await alvoDeToque(dialogo.getByRole('button', { name: 'Tentar de novo' }), 'Tentar de novo', 24)
    expect(await seriousViolations(page)).toEqual([])
    // "Tentar de novo" manda o mesmo texto de novo, e com o servidor de volta a prévia chega e o aviso sai.
    falhar = false
    await activate(dialogo.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(tituloDaPrevia(dialogo)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(alerta).toHaveCount(0)

    // Uma falha nova, depois um arquivo bom: o aviso da tentativa anterior sai com o arquivo novo, e o foco não volta a ele.
    falhar = true
    await escolher(page, 'outro.csv', planilha(`8º A;Bia ${marca};${marca}02`))
    await expect(alerta).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(tituloDaPrevia(dialogo)).toHaveCount(0)
    falhar = false
    await escolher(page, 'terceiro.csv', planilha(`8º A;Caio ${marca};${marca}03`))
    await expect(tituloDaPrevia(dialogo)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(alerta).toHaveCount(0)
  })

  test('a resposta atrasada da prévia anterior não aparece no lugar da nova; o mesmo arquivo escolhido de novo pede uma prévia nova', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const { previas } = contarPedidos(page)
    const dialogo = await abrirOPainel(page, request, coordenadora)
    const segurada = gate()
    // O pedido segurado terminou: o fim dele, e não um tempo qualquer, é o que o caso espera antes de olhar a tela.
    const terminou = gate()
    let primeira = true
    await page.route(ROTA_DA_PREVIA, async (rota: Route) => {
      const seguro = primeira
      primeira = false
      if (seguro) await segurada.aberta
      await rota.continue().catch(() => undefined)
      if (seguro) terminou.abrir()
    })

    // O primeiro arquivo (3 linhas) fica no ar; o segundo (1 linha) chega primeiro e é o que a tela mostra.
    await escolher(page, 'antigo.csv', planilha(`8º A;Ana ${marca};${marca}01`, `8º A;Bia ${marca};${marca}02`, `8º A;Caio ${marca};${marca}03`))
    await expect.poll(() => previas.length).toBe(1)
    await escolher(page, 'novo.csv', planilha(`9º B;Duda ${marca};${marca}04`))
    await expect(resumoDaPrevia(dialogo, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    segurada.abrir()
    await terminou.aberta
    // Dois quadros depois do fim do pedido: a página já teve onde desenhar a resposta antiga, se ela fosse desenhada.
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    await expect(resumoDaPrevia(dialogo, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible()
    await expect(dialogo).not.toContainText('3 linhas lidas')

    // O mesmo arquivo de novo (a planilha corrigida com o mesmo nome): outra leitura, outra prévia, e o foco volta ao título.
    await dialogo.getByRole('heading', { name: 'Escolher a planilha' }).focus()
    await escolher(page, 'novo.csv', planilha(`9º B;Duda ${marca};${marca}04`))
    await expect.poll(() => previas.length).toBe(3)
    await expect(tituloDaPrevia(dialogo)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
  })
})

test.describe('recomeço: a pessoa seguinte na mesma aba', () => {
  test('a prévia e o nome do arquivo da coordenação anterior não aparecem para a que entra depois, sem recarregar a página', async ({ page, request, hasTouch }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    const segunda = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const ana = `Ana Souza ${marca}`
    const dialogo = await abrirOPainel(page, request, primeira)
    await escolher(page, 'da-primeira.csv', planilha(`8º A;${ana};${marca}01`))
    await expect(resumoDaPrevia(dialogo, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    // O painel é modal: a primeira fecha o painel e sai, e a aba continua a mesma.
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    // Da entrada da seguinte em diante, qualquer momento em que a tela traz o nome do aluno ou o do arquivo da anterior é registrado.
    await page.evaluate(
      ({ nome, arquivo }) => {
        const vazamentos: string[] = []
        ;(window as unknown as { __vazamentos: string[] }).__vazamentos = vazamentos
        const ler = () => {
          const texto = document.body.textContent ?? ''
          if (texto.includes(nome)) vazamentos.push(nome)
          if (texto.includes(arquivo)) vazamentos.push(arquivo)
        }
        new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, characterData: true })
      },
      { nome: ana, arquivo: 'da-primeira.csv' },
    )

    // O segundo fator é configurado pela API: o caso é sobre o que a aba mostra da pessoa anterior, e o login pela tela continua.
    const { segredo } = await configurarSegundoFatorPelaApi(request, segunda)
    await entrarPelaTelaComSegundoFator(page, segunda, segredo, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await activate(page.getByRole('button', { name: 'Importar alunos' }), hasTouch)
    await expect(painel(page).getByRole('button', { name: 'Baixar modelo' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel(page).getByText('Nenhuma planilha escolhida')).toBeVisible()
    await expect(tituloDaPrevia(painel(page))).toHaveCount(0)
    await expect(painel(page)).not.toContainText('da-primeira.csv')
    expect(await page.content()).not.toContain(ana)
    expect(await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos)).toEqual([])
  })
})

/** Dois alunos de 8º A que a planilha põe em 8º B, e um (Eva) que fica em 8º A mas não está na planilha. */
async function escolaComAlunosParaMarcar(coordenadora: EquipeDeTeste) {
  const marca = `m${randomUUID().slice(0, 7)}`
  const turmaA = await criarTurmaComNomeNoBanco(coordenadora.escolaId, '8º A', 8)
  const turmaB = await criarTurmaComNomeNoBanco(coordenadora.escolaId, '8º B', 8)
  const alunos = []
  for (const [posicao, primeiroNome] of ['Caio', 'Duda', 'Eva'].entries()) {
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `${primeiroNome} Pires ${marca}`, matricula: `${marca}${String(posicao + 1).padStart(2, '0')}` })
    await colocarAlunoNaTurma(aluno, turmaA)
    await aprovarNaListaDaTurma(aluno, turmaA.turmaId)
    alunos.push(aluno)
  }
  const [caio, duda, eva] = alunos
  if (caio === undefined || duda === undefined || eva === undefined) throw new Error('alunos do seed')
  const texto = planilha(`8º B;${caio.nome};${caio.matricula}`, `8º B;${duda.nome};${duda.matricula}`, `8º A;Fábio Alves ${marca};${marca}09`)
  return { marca, turmaA, turmaB, caio, duda, eva, texto }
}

test.describe('RF4 e regra 70 (13.0): as marcas são escolha da coordenação', () => {
  test('transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia', async ({
    page,
    request,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const { marca, turmaA, turmaB, caio, duda, eva, texto } = await escolaComAlunosParaMarcar(coordenadora)
    const dialogo = await abrirOPainel(page, request, coordenadora)
    await escolher(page, 'alunos.csv', texto)

    const marcas = dialogo.getByRole('region', { name: 'Você decide' })
    await expect(marcas).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(marcas).toContainText('conferência feita a partir da planilha, não um resultado automático')
    // Cada marca diz quem é: o nome e a matrícula que a escola já tem. Nenhuma chega marcada, nem o "marcar todos".
    for (const aluno of [caio, duda, eva]) await expect(marcas.getByRole('checkbox', { name: `${aluno.nome} (${aluno.matricula})` })).not.toBeChecked()
    await expect(marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' })).not.toBeChecked()
    await expect(marcas.getByRole('checkbox', { name: 'Marcar todos para desligar' })).not.toBeChecked()
    await expect(marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' })).toBeVisible()
    // O resto é contagem: a mudança de turma diz que só vale com a marca, sem nome.
    const resto = dialogo.getByRole('region', { name: 'O resto da planilha' })
    await expect(resto).toContainText('1 linha entra')
    await expect(resto).toContainText('2 linhas aparecem em outra turma (só mudam com a sua marca)')
    await expect(resto).not.toContainText(caio.nome)

    // A tela cabe, tem uma só ação cheia, o botão principal tem 44 px, as caixas de marca têm mais de 24 px, e o axe não acha nada.
    expect(await horizontalOverflow(page)).toBe(0)
    await paginaNaoRola(page)
    await expect(dialogo.locator('button.bg-laranja:visible')).toHaveCount(1)
    await alvoDeToque(dialogo.getByRole('button', { name: 'Gravar planilha' }), 'Gravar planilha', ALVO_DE_TOQUE_PRINCIPAL_PX)
    await alvoDeToque(marcas.getByRole('checkbox', { name: `${caio.nome} (${caio.matricula})` }).locator('xpath=ancestor::label'), 'marca de transferir', 24)
    await alvoDeToque(marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' }).locator('xpath=ancestor::label'), 'marcar todos para transferir', 24)
    await alvoDeToque(dialogo.getByRole('button', { name: 'Baixar modelo' }), 'Baixar modelo', 24)
    await alvoDeToque(dialogo.getByRole('button', { name: 'Trocar arquivo' }), 'Trocar arquivo', 24)
    expect(await seriousViolations(page)).toEqual([])

    // Antes de gravar, a tela diz o que as marcas vão fazer; sem marca, não diz nada.
    const aoGravar = dialogo.getByText(/^Ao gravar, com as suas marcas:/)
    await expect(aoGravar).toHaveCount(0)
    await marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' }).check()
    await expect(aoGravar).toHaveText('Ao gravar, com as suas marcas: 2 alunos mudarão de turma.')
    await marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' }).uncheck()
    await expect(aoGravar).toHaveCount(0)

    // Gravar sem marcar ninguém: entra quem é novo, ninguém muda de turma nem sai, e a tela conta o que ficou de fora.
    await dialogo.getByRole('button', { name: 'Gravar planilha' }).click()
    await expect(dialogo.getByRole('region', { name: 'Planilha gravada' })).toContainText(
      '1 aluno entrou. 2 linhas ficaram de fora: o aluno aparece em outra turma e você não marcou a transferência.',
      { timeout: SIGN_IN_TIMEOUT_MS },
    )
    // Os três de 8º A seguem lá (a contagem é de vínculos) e ninguém foi para 8º B; Fábio entrou só na lista de nomes, até reivindicar.
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaA.turmaId)).toBe(3)
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaB.turmaId)).toBe(0)
    expect((await estadosDaListaNoBanco(coordenadora.escolaId, turmaA.turmaId)).some(({ nome }) => nome === `Fábio Alves ${marca}`)).toBe(true)
  })

  test('só muda quem a coordenação marcou: um aluno transferido e outro desligado, e o resultado diz isso', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const { turmaA, turmaB, caio, eva, texto } = await escolaComAlunosParaMarcar(coordenadora)
    const dialogo = await abrirOPainel(page, request, coordenadora)
    await escolher(page, 'alunos.csv', texto)
    const marcas = dialogo.getByRole('region', { name: 'Você decide' })
    await expect(marcas).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await activate(marcas.getByRole('checkbox', { name: `${caio.nome} (${caio.matricula})` }), hasTouch)
    await activate(marcas.getByRole('checkbox', { name: `${eva.nome} (${eva.matricula})` }), hasTouch)
    await expect(marcas.getByRole('checkbox', { name: `${caio.nome} (${caio.matricula})` })).toBeChecked()
    await expect(marcas.getByRole('checkbox', { name: 'Marcar todos para transferir' })).not.toBeChecked()
    await activate(dialogo.getByRole('button', { name: 'Gravar planilha' }), hasTouch)

    await expect(dialogo.getByRole('region', { name: 'Planilha gravada' })).toContainText('1 aluno entrou. 1 aluno mudou de turma. 1 aluno saiu. 1 linha ficou de fora', { timeout: SIGN_IN_TIMEOUT_MS })
    // Caio foi para 8º B; Duda, que não foi marcada, ficou em 8º A; Eva saiu. Fábio entrou só na lista de nomes, sem vínculo.
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaB.turmaId)).toBe(1)
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaA.turmaId)).toBe(1)
  })
})

test.describe('teto da planilha (13.0): 3.000 linhas, por arquivo', () => {
  test('as 3.000 linhas do teto: a prévia e a gravação terminam abaixo da metade do prazo', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = `m${randomUUID().slice(0, 7)}`
    const { gravacoes } = contarPedidos(page)
    const dialogo = await abrirOPainel(page, request, coordenadora)
    // Gerada no teste e entregue por arquivo: colar 3.000 linhas num campo levaria uns 27 s.
    const linhas = Array.from({ length: 3_000 }, (_, posicao) => `${String(6 + (posicao % 4))}º ${String.fromCharCode(65 + (posicao % 5))};Aluno ${String(posicao)} ${marca};${marca}${String(posicao).padStart(4, '0')}`)
    await escolher(page, 'escola-inteira.csv', planilha(...linhas))
    await expect(resumoDaPrevia(dialogo, '3.000 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await dialogo.getByRole('button', { name: 'Gravar planilha' }).click()
    await expect(dialogo.getByRole('region', { name: 'Planilha gravada' })).toContainText('3.000 alunos entraram.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(gravacoes).toHaveLength(1)
  })
})
