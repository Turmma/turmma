import type { Route } from '@playwright/test'
import { abrirNavegacao, entrarComoCoordenacaoNaMesmaAba, esperarPainel, lateral, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { irPelaCoordenacao } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import {
  abrirABusca,
  acionar,
  acionarNoPontoDaLinha,
  busca,
  buscarPor,
  campoDoTermo,
  comoNaTela,
  confirmacao,
  COR_DO_OFICIAL,
  COR_DO_PERIGO,
  diaCurto,
  doisCliquesNoMesmoInstante,
  ELIMINADO,
  ENDERECO_DA_ABA,
  ENDERECO_DO_DETALHE,
  entrarNosPedidos,
  escolherEPedir,
  HOMONIMO,
  hoje,
  INDISPONIVEL,
  linhaDa,
  linhas,
  linkDoPedido,
  marca,
  portao,
  principal,
  registrarPeloFluxo,
  somarDiasAHoje,
} from './support/pedidos-do-titular.ts'
import {
  colocarAlunoNaTurma,
  convidarProfessorNoBanco,
  criarAlocacaoDoProfessor,
  criarAlunoComMatricula,
  criarEquipeComSenha,
  criarPedidoDeTitularEliminadoNoBanco,
  criarPedidoDoTitularNoBanco,
  criarPedidosDoTitularNoBanco,
  pedidosDoTitularNoBanco,
} from './support/seed.ts'
import { codigoCru, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * A aba "Pedidos" da Privacidade da coordenação (F3, 16.0; RF10, RF14, RF16 e RF20; `docs/interface.md` 3): a lista dos
 * pedidos, a busca da pessoa, a prévia e a confirmação com o aviso de homônimo e a família `perigo` na eliminação. Contra a
 * API real, nos projetos `chromebook` e `celular`. O que o clique fez se confere **no banco**, e não só no que a tela diz.
 */

const CARREGANDO = 'Carregando os pedidos…'
const VAZIO = 'Nenhum pedido registrado'
const TEXTO_DO_ALUNO_DA_LISTA = 'O aluno que ainda não reivindicou o nome não tem conta e não aparece na busca'
const LIMITE_DE_BUSCAS = 'Muitas buscas em pouco tempo. Aguarde um minuto e busque de novo.'
const NINGUEM = 'Nenhuma pessoa encontrada com esse nome.'
const CURTO = 'Digite pelo menos 3 letras do nome.'
const QUEDA_DO_REGISTRO = 'Não foi possível confirmar o registro agora. Tente de novo: o pedido não será registrado duas vezes.'
const LIMITE = JSON.stringify({ erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000002' } })

test.describe('Pedidos: registrar o pedido de um titular', () => {
  test('dois alunos com o mesmo nome: escolhe o certo pela turma, o diálogo avisa do homônimo, a eliminação vai em perigo e dois cliques registram um pedido só', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Um sobrenome comprido e sem espaço: a 360 px ele passaria da largura do diálogo sem `break-words`.
    const nome = `Bruna ${marca()} ${'Albuquerquemedeiros'.repeat(5)}`
    const primeira = await criarAlunoComMatricula({ escola: coordenadora, nome, matricula: `1${marca()}` })
    const segunda = await criarAlunoComMatricula({ escola: coordenadora, nome, matricula: `2${marca()}` })
    const turmaDaPrimeira = await colocarAlunoNaTurma(primeira)
    const turmaDaSegunda = await colocarAlunoNaTurma(segunda)
    await entrarNosPedidos(page, hasTouch, coordenadora)

    await abrirABusca(page, hasTouch)
    await buscarPor(page, nome)
    // O resultado é anunciado pela região viva, e cada pessoa se escolhe pela turma e pela matrícula, que separam os dois nomes iguais.
    await expect(busca(page).getByRole('status').filter({ hasText: '2 pessoas encontradas' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(busca(page).getByRole('radio')).toHaveCount(2)
    await expect(busca(page).getByRole('radio', { name: new RegExp(`${turmaDaPrimeira.turmaNome}.*matrícula ${primeira.matricula}`) })).toHaveCount(1)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Escolher outra pessoa recomeça o pedido: o tipo que valia para a primeira não vai para a segunda.
    await busca(page).getByRole('radio', { name: new RegExp(`${turmaDaPrimeira.turmaNome}.*matrícula ${primeira.matricula}`) }).check()
    await busca(page).getByLabel('Tipo do pedido').selectOption({ label: 'Acesso aos dados' })
    await busca(page).getByRole('radio', { name: new RegExp(`${turmaDaSegunda.turmaNome}.*matrícula ${segunda.matricula}`) }).check()
    await expect(busca(page).getByLabel('Tipo do pedido')).toHaveValue('')

    await escolherEPedir(page, hasTouch, new RegExp(`${turmaDaSegunda.turmaNome}.*matrícula ${segunda.matricula}`), 'Eliminação dos dados', 'O responsável legal')
    const dialogo = confirmacao(page, 'Registrar pedido: Eliminação dos dados')
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Quem, o quê, quem pediu e a chegada, antes de confirmar; e a turma da escolhida, não a da outra.
    await expect(dialogo).toContainText(nome)
    await expect(dialogo).toContainText(turmaDaSegunda.turmaNome)
    await expect(dialogo).not.toContainText(turmaDaPrimeira.turmaNome)
    await expect(dialogo).toContainText('O responsável legal')
    await expect(dialogo.getByText('Turma', { exact: true })).toBeVisible()
    await expect(dialogo).toContainText(comoNaTela(hoje()))
    // A prévia do aluno traz a contagem por categoria (o cadastro e o vínculo com a turma), e o aviso de homônimo vem com ela.
    const previa = dialogo.getByRole('region', { name: 'O que a escola guarda desta pessoa' })
    await expect(previa).toContainText('Cadastro na escola: 1', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(previa).toContainText('Vínculos com turmas: 1')
    await expect(dialogo).toContainText(HOMONIMO)
    await expect(dialogo).toContainText('7 dias')
    await expect(dialogo).toContainText('registro escolar')
    // O foco começa no texto, e não no botão que confirma; o botão da eliminação é o `perigo` cheio.
    const confirmar = dialogo.getByRole('button', { name: 'Registrar a eliminação', exact: true })
    await expect(confirmar).toBeEnabled()
    await expect(confirmar).not.toBeFocused()
    expect(await confirmar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_PERIGO)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await doisCliquesNoMesmoInstante(confirmar)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('status').filter({ hasText: `Pedido registrado: Eliminação dos dados, de ${nome}.` })).toBeVisible()
    await expect(linhaDa(page, nome)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDa(page, nome)).toContainText(turmaDaSegunda.turmaNome)
    await expect(linhaDa(page, nome)).toContainText('Eliminação agendada')
    // O foco volta ao botão que abriu o fluxo, e a tela não recarregou.
    await expect(principal(page).getByRole('button', { name: 'Registrar pedido', exact: true })).toBeFocused()

    // O banco tem um pedido só, da pessoa escolhida (e não da homônima), com o que o diálogo mostrou.
    const pedidos = await pedidosDoTitularNoBanco(coordenadora.escolaId)
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]).toMatchObject({
      titularId: segunda.usuarioId,
      papelTitular: 'aluno',
      tipo: 'eliminacao',
      solicitante: 'responsavel_legal',
      chegouEm: hoje(),
      estado: 'agendado',
      registradoPor: coordenadora.usuarioId,
    })
    expect(pedidos.map((pedido) => pedido.titularId)).not.toContain(primeira.usuarioId)
  })

  test('um pedido que não é eliminação confirma na decisão oficial, sem aviso de homônimo quando não há, e cancelar em qualquer etapa não registra nada', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Cecília ${marca()} Prado`, matricula: `3${marca()}` })
    const turma = await colocarAlunoNaTurma(aluno)
    await entrarNosPedidos(page, hasTouch, coordenadora)

    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    // O pedido só aparece depois de a pessoa ser escolhida: antes disso não há campo nem "Continuar".
    await expect(busca(page).getByRole('radio')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(busca(page).getByLabel('Tipo do pedido')).toHaveCount(0)
    await expect(busca(page).getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0)
    await busca(page).getByRole('radio', { name: new RegExp(turma.turmaNome) }).check()
    // Sem tipo e sem quem pediu, a confirmação não abre, e cada campo diz o que falta.
    await expect(busca(page).getByLabel('Dia em que o pedido chegou à escola')).toHaveAttribute('max', hoje())
    await acionar(busca(page).getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
    await expect(busca(page)).toContainText('Escolha o tipo do pedido.')
    await expect(busca(page)).toContainText('Diga quem pediu.')
    await expect(busca(page).getByLabel('Tipo do pedido')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    // O dia que ainda não chegou também não passa, mesmo digitado por cima do limite do campo.
    await busca(page).getByLabel('Tipo do pedido').selectOption({ label: 'Acesso aos dados' })
    await busca(page).getByLabel('Quem pediu').selectOption({ label: 'A própria pessoa' })
    await busca(page).getByLabel('Dia em que o pedido chegou à escola').fill('2099-01-01')
    await acionar(busca(page).getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
    await expect(busca(page)).toContainText('não pode ser depois de hoje')
    await expect(busca(page)).not.toContainText('Escolha o tipo do pedido.')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await busca(page).getByLabel('Dia em que o pedido chegou à escola').fill(hoje())
    await acionar(busca(page).getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Registrar pedido: Acesso aos dados')
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo.getByRole('region', { name: 'O que a escola guarda desta pessoa' })).toContainText('Cadastro na escola: 1', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo).not.toContainText(HOMONIMO)
    await expect(dialogo).not.toContainText('registro escolar')
    const confirmar = dialogo.getByRole('button', { name: 'Registrar pedido', exact: true })
    expect(await confirmar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_OFICIAL)
    // Sem homônimo e sem eliminação, não há aviso: nenhuma caixa de aviso vazia na descrição.
    await expect(dialogo.locator('p:not([role="alert"])').filter({ hasText: /^\s*$/ })).toHaveCount(0)

    // Cancelar fecha tudo, do mesmo tamanho que confirmar, e nada é registrado.
    await acionar(dialogo.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(busca(page)).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Registrar pedido', exact: true })).toBeFocused()
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(0)

    // Uma abertura nova começa do zero: o termo e a pessoa escolhida não ficaram da anterior.
    await abrirABusca(page, hasTouch)
    await expect(campoDoTermo(page)).toHaveValue('')
    await expect(busca(page).getByRole('radio')).toHaveCount(0)
    await acionar(busca(page).getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(busca(page)).toHaveCount(0)
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(0)

    // Cancelar com a pessoa já escolhida e o pedido preenchido (a terceira etapa): fecha tudo e nada é registrado.
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await busca(page).getByRole('radio', { name: new RegExp(turma.turmaNome) }).check({ timeout: PRAZO_DA_ENTRADA_MS })
    await busca(page).getByLabel('Tipo do pedido').selectOption({ label: 'Acesso aos dados' })
    await busca(page).getByLabel('Quem pediu').selectOption({ label: 'A própria pessoa' })
    await busca(page).getByLabel('Dia em que o pedido chegou à escola').fill(hoje())
    await acionar(busca(page).getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(busca(page)).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Registrar pedido', exact: true })).toBeFocused()
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(0)
  })

  test('a prévia que falha impede confirmar até ser lida, e a que vem sem nenhuma categoria diz que não há dado', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Helena ${marca()} Pires`, matricula: `8${marca()}` })
    await colocarAlunoNaTurma(aluno)
    let modo: 'falha' | 'vazia' = 'falha'
    const segurada = portao()
    await page.route(
      (url) => /^\/v1\/privacidade\/titulares\/[^/]+\/previa$/.test(url.pathname),
      async (rota: Route) => {
        await segurada.aberta
        if (modo === 'falha') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        const titularId = new URL(rota.request().url()).pathname.split('/')[4]
        return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: titularId, nome: aluno.nome, papel: 'aluno', categorias: [], homonimo: false }) })
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await escolherEPedir(page, hasTouch, new RegExp(aluno.nome), 'Correção de dados')
    const dialogo = confirmacao(page, 'Registrar pedido: Correção de dados')
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Enquanto a prévia não chega, o diálogo diz que consulta, e não se confirma: o aviso de homônimo mora nela.
    const confirmar = dialogo.getByRole('button', { name: 'Registrar pedido', exact: true })
    await expect(dialogo.getByRole('status').filter({ hasText: 'Consultando o que a escola guarda desta pessoa…' })).toBeVisible()
    await expect(confirmar).toBeDisabled()
    segurada.abrir()
    await expect(dialogo.getByRole('alert').filter({ hasText: 'O sistema está indisponível no momento' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(confirmar).toBeDisabled()
    modo = 'vazia'
    await acionar(dialogo.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(dialogo).toContainText('Nenhum dado desta pessoa foi encontrado nas categorias que a escola guarda.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(confirmar).toBeEnabled()
    await acionar(dialogo.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(0)
  })

  test('o professor aparece na busca e a prévia dele não traz contagem nem o que é do uso da IA', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'ativo', 'Professor')
    await criarAlocacaoDoProfessor(coordenadora.escolaId, professor.usuarioId, ['Matemática'])
    await entrarNosPedidos(page, hasTouch, coordenadora)

    await abrirABusca(page, hasTouch)
    await buscarPor(page, professor.nome)
    await expect(busca(page).getByRole('status').filter({ hasText: '1 pessoa encontrada' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await escolherEPedir(page, hasTouch, new RegExp(professor.nome), 'Acesso aos dados')
    const dialogo = confirmacao(page, 'Registrar pedido: Acesso aos dados')
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo).toContainText('Professor')
    await expect(dialogo.getByText('Turmas', { exact: true })).toBeVisible()
    const previa = dialogo.getByRole('region', { name: 'O que a escola guarda desta pessoa' })
    await expect(previa).toContainText('Cadastro na escola', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(previa).toContainText('Vínculos com turmas')
    // Sem número nenhum, e sem as categorias do uso da IA: a resposta é a mesma para quem usou e para quem não usou (D64).
    expect(await previa.innerText()).not.toMatch(/\d/)
    await expect(previa).not.toContainText('Tutor')
    await expect(previa).not.toContainText('Assistente de ensino')
    await acionar(dialogo.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(0)
  })
})

test.describe('Pedidos: a busca', () => {
  test('só sai com 3 letras e no Enter, nunca a cada letra; o limite diz o que fazer; quem não existe é dito, com o caminho do aluno da lista', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    let buscas = 0
    const enviados: { url: string; termo: unknown }[] = []
    page.on('request', (pedido) => {
      if (pedido.method() !== 'POST' || new URL(pedido.url()).pathname !== '/v1/privacidade/titulares/busca') return
      buscas += 1
      enviados.push({ url: pedido.url(), termo: (pedido.postDataJSON() as { termo?: unknown }).termo })
    })
    const procurado = `Inexistente ${marca()}`
    // A primeira busca que passa do mínimo bate no limite; as seguintes vão à API de verdade.
    let limitar = true
    const segurada = portao()
    await page.route(
      (url) => url.pathname === '/v1/privacidade/titulares/busca',
      async (rota: Route) => {
        if (limitar) {
          limitar = false
          await segurada.aberta
          return rota.fulfill({ status: 429, contentType: 'application/json', body: LIMITE })
        }
        return rota.continue()
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirABusca(page, hasTouch)

    // Duas letras: o campo diz o que falta, a busca não sai.
    await buscarPor(page, 'an')
    await expect(busca(page)).toContainText(CURTO)
    await expect(campoDoTermo(page)).toHaveAttribute('aria-invalid', 'true')
    expect(buscas).toBe(0)

    // Digitar não busca: só o Enter ou o botão.
    await campoDoTermo(page).fill('')
    await campoDoTermo(page).pressSequentially(`  ${procurado}  `)
    expect(buscas).toBe(0)
    await campoDoTermo(page).press('Enter')
    // Com a busca no ar, o botão e a região viva dizem "Buscando…", e o segundo Enter não manda outra.
    await expect(busca(page).getByRole('button', { name: 'Buscando…', exact: true })).toBeDisabled()
    await expect(busca(page).getByRole('status').filter({ hasText: 'Buscando…' })).toBeVisible()
    await campoDoTermo(page).press('Enter')
    segurada.abrir()
    await expect(busca(page).getByRole('alert')).toContainText(LIMITE_DE_BUSCAS, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(buscas).toBe(1)
    await expect(busca(page)).not.toContainText(codigoCru('429'))
    await expect(busca(page)).not.toContainText('LIMITE_EXCEDIDO')

    // O botão faz a mesma busca; sem ninguém, a região viva diz, e o texto aponta a lista da turma.
    await acionar(busca(page).getByRole('button', { name: 'Buscar', exact: true }), hasTouch)
    await expect(busca(page).getByRole('status').filter({ hasText: NINGUEM })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(busca(page)).toContainText('lista de nomes da turma')
    expect(buscas).toBe(2)
    // O termo vai no corpo, sem as pontas em branco, e nunca na URL.
    expect(enviados.map(({ termo }) => termo)).toEqual([procurado, procurado])
    expect(enviados.some(({ url }) => url.includes(encodeURIComponent(procurado)) || url.includes('Inexistente'))).toBe(false)
    // Sem ninguém achado, não há lista para escolher.
    await expect(busca(page).getByRole('group', { name: 'Escolha a pessoa' })).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  })

  test('a aba avisa que o aluno que nunca reivindicou o nome está na lista da turma, e o link leva às turmas', async ({ page, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await expect(principal(page).getByRole('note')).toContainText(TEXTO_DO_ALUNO_DA_LISTA)
    await expect(principal(page).getByRole('note')).toContainText('corrigir é retirar o nome e acrescentá-lo de novo')
    await acionar(principal(page).getByRole('link', { name: 'Ir para as turmas', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/estrutura$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })
})

test.describe('Pedidos: recomeço', () => {
  test('a rede cai depois de o servidor registrar: o reenvio leva a mesma chave e o pedido é um só; o diálogo novo leva outra chave', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Daniela ${marca()} Reis`, matricula: `4${marca()}` })
    await colocarAlunoNaTurma(aluno)
    const chaves: string[] = []
    let perder = true
    // A prévia é lida a cada diálogo e não fica guardada: a segunda abertura espera pela leitura dela.
    let leiturasDaPrevia = 0
    let segurarAPrevia = false
    const segundaPrevia = portao()
    await page.route(
      (url) => /^\/v1\/privacidade\/titulares\/[^/]+\/previa$/.test(url.pathname),
      async (rota: Route) => {
        leiturasDaPrevia += 1
        if (segurarAPrevia) await segundaPrevia.aberta
        return rota.continue()
      },
    )
    await page.route(
      (url) => url.pathname === '/v1/privacidade/pedidos',
      async (rota: Route) => {
        if (rota.request().method() !== 'POST') return rota.continue()
        const corpo = rota.request().postDataJSON() as { chaveEnvio: string }
        chaves.push(corpo.chaveEnvio)
        if (!perder) return rota.continue()
        // O servidor recebe e registra; a resposta se perde no caminho, como numa rede de escola que cai.
        perder = false
        await rota.fetch()
        return rota.abort('internetdisconnected')
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await escolherEPedir(page, hasTouch, new RegExp(aluno.nome), 'Portabilidade dos dados')
    const dialogo = confirmacao(page, 'Registrar pedido: Portabilidade dos dados')
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const confirmar = dialogo.getByRole('button', { name: 'Registrar pedido', exact: true })
    await expect(confirmar).toBeEnabled({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(confirmar, hasTouch)

    // O diálogo fica aberto, diz o que fazer e que repetir não duplica.
    await expect(dialogo.getByRole('alert')).toContainText(QUEDA_DO_REGISTRO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(confirmar).toBeEnabled()
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(1)

    await acionar(confirmar, hasTouch)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(chaves).toHaveLength(2)
    expect(chaves[1]).toBe(chaves[0])
    const depoisDoReenvio = await pedidosDoTitularNoBanco(coordenadora.escolaId)
    expect(depoisDoReenvio).toHaveLength(1)
    expect(depoisDoReenvio[0]?.chaveEnvio).toBe(chaves[0])

    // Outro diálogo, outro pedido do mesmo tipo e da mesma pessoa: é uma decisão nova, com chave nova.
    const leiturasDoPrimeiro = leiturasDaPrevia
    segurarAPrevia = true
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await escolherEPedir(page, hasTouch, new RegExp(aluno.nome), 'Portabilidade dos dados')
    const outro = confirmacao(page, 'Registrar pedido: Portabilidade dos dados')
    await expect(outro.getByRole('status').filter({ hasText: 'Consultando o que a escola guarda desta pessoa…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(outro.getByRole('button', { name: 'Registrar pedido', exact: true })).toBeDisabled()
    segundaPrevia.abrir()
    await expect(outro.getByRole('button', { name: 'Registrar pedido', exact: true })).toBeEnabled({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(leiturasDaPrevia).toBeGreaterThan(leiturasDoPrimeiro)
    await acionar(outro.getByRole('button', { name: 'Registrar pedido', exact: true }), hasTouch)
    await expect(outro).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(chaves).toHaveLength(3)
    expect(chaves[2]).not.toBe(chaves[0])
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(2)
  })

  test('a resposta do registro que chega depois de cancelar não fecha a busca que a coordenação abriu em seguida', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Elisa ${marca()} Braga`, matricula: `6${marca()}` })
    await colocarAlunoNaTurma(aluno)
    const segurada = portao()
    let noAr = 0
    await page.route(
      (url) => url.pathname === '/v1/privacidade/pedidos',
      async (rota: Route) => {
        if (rota.request().method() !== 'POST') return rota.continue()
        noAr += 1
        await segurada.aberta
        return rota.continue()
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await escolherEPedir(page, hasTouch, new RegExp(aluno.nome), 'Acesso aos dados')
    const dialogo = confirmacao(page, 'Registrar pedido: Acesso aos dados')
    const confirmar = dialogo.getByRole('button', { name: 'Registrar pedido', exact: true })
    await expect(confirmar).toBeEnabled({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(confirmar, hasTouch)
    await expect.poll(() => noAr, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(1)

    // Cancela com o pedido ainda no ar e abre a busca de novo; a resposta chega com essa busca aberta e com o que ela já tem digitado.
    await acionar(dialogo.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await abrirABusca(page, hasTouch)
    await campoDoTermo(page).fill('Elis')
    segurada.abrir()
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(busca(page)).toBeVisible()
    await expect(campoDoTermo(page)).toHaveValue('Elis')
    expect(await pedidosDoTitularNoBanco(coordenadora.escolaId)).toHaveLength(1)
  })

  test('a leitura atrasada da segunda página, que chega depois do registro, não vence a lista lida depois dele', async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    // 50 pedidos de um aluno e um de titular eliminado: a lista tem uma segunda página, que é a leitura que fica no ar. A API entrega
    // a chegada mais recente primeiro: a primeira página é o eliminado, de hoje, e os 49 mais recentes do aluno; a segunda, o mais antigo.
    const antigo = await criarAlunoComMatricula({ escola: coordenadora, nome: `Heitor ${marca()} Lopes`, matricula: `5${marca()}` })
    await colocarAlunoNaTurma(antigo)
    await criarPedidosDoTitularNoBanco(coordenadora.escolaId, antigo.usuarioId, coordenadora.usuarioId, 50, 1)
    await criarPedidoDeTitularEliminadoNoBanco(coordenadora.escolaId, coordenadora.usuarioId, 0)
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Elisa ${marca()} Freitas`, matricula: `8${marca()}` })
    await colocarAlunoNaTurma(aluno)
    const segurada = portao()
    const depoisDoRegistro = portao()
    // A fase é do teste: `atrasada` segura a leitura da segunda página, com a lista como ela era; `depois`, as de depois do registro.
    let fase: 'livre' | 'atrasada' | 'depois' = 'livre'
    let atrasadas = 0
    let depois = 0
    let atrasadaEntregue: () => void = () => undefined
    const entregue = new Promise<void>((resolver) => {
      atrasadaEntregue = resolver
    })
    await page.route(
      (url) => url.pathname === '/v1/privacidade/pedidos',
      async (rota: Route) => {
        if (rota.request().method() !== 'GET') return rota.continue()
        if (fase === 'depois') {
          // As de depois do registro: o diálogo espera por elas.
          depois += 1
          await depoisDoRegistro.aberta
          return rota.continue()
        }
        if (fase !== 'atrasada') return rota.continue()
        // A segunda página, pedida antes do registro, fica no ar com a lista como ela era, sem o pedido novo.
        atrasadas += 1
        try {
          const resposta = await rota.fetch()
          await segurada.aberta
          await rota.fulfill({ response: resposta })
        } catch {
          // A tela cancelou a leitura ao reler depois do registro: não há o que entregar.
        } finally {
          atrasadaEntregue()
        }
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await expect(linhas(page)).toHaveCount(50, { timeout: PRAZO_DA_ENTRADA_MS })

    // "Ver mais pedidos" pede a segunda página, e ela fica no ar.
    fase = 'atrasada'
    await acionar(principal(page).getByRole('button', { name: 'Ver mais pedidos' }), hasTouch)
    await expect.poll(() => atrasadas, { timeout: PRAZO_DA_ENTRADA_MS }).toBeGreaterThan(0)
    await expect(principal(page).getByRole('button', { name: 'Carregando…', exact: true })).toBeDisabled()
    fase = 'depois'

    // Com ela no ar, a coordenação registra um pedido; a lista é lida de novo depois dele.
    await abrirABusca(page, hasTouch)
    await buscarPor(page, aluno.nome)
    await escolherEPedir(page, hasTouch, new RegExp(aluno.nome), 'Compartilhamento dos dados')
    const dialogo = confirmacao(page, 'Registrar pedido: Compartilhamento dos dados')
    await expect(dialogo.getByRole('button', { name: 'Registrar pedido', exact: true })).toBeEnabled({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(dialogo.getByRole('button', { name: 'Registrar pedido', exact: true }), hasTouch)
    // O pedido já saiu, mas o diálogo só termina com a lista lida: até lá, "Registrando…", e nada na lista.
    await expect(dialogo.getByRole('button', { name: 'Registrando…', exact: true })).toBeDisabled({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect.poll(() => depois, { timeout: PRAZO_DA_ENTRADA_MS }).toBeGreaterThan(0)
    expect((await pedidosDoTitularNoBanco(coordenadora.escolaId)).length).toBe(52)
    await expect(dialogo).toHaveCount(1)
    await expect(linhaDa(page, aluno.nome)).toHaveCount(0)
    depoisDoRegistro.abrir()
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    // A lista foi relida: tem a primeira página, e a segunda, a que estava no ar, saiu. O pedido novo chegou hoje e está **na primeira
    // página**, sem que a coordenação peça a segunda; a segunda, com os dois mais antigos, ela ainda não leu de novo.
    await expect(linhas(page)).toHaveCount(50, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1)
    await expect(linhaDa(page, ELIMINADO)).toHaveCount(1)
    await expect(principal(page).getByRole('button', { name: 'Ver mais pedidos' })).toBeVisible()

    // A leitura de antes chega agora, com a lista como ela era (a segunda página tinha uma linha, a do pedido mais antigo): ela não
    // pode vencer, e a lista continua com as 50 de depois do registro, e não com 51.
    segurada.abrir()
    await entregue
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver(undefined)))))
    await expect(linhas(page)).toHaveCount(50)
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1)

    // A segunda página, lida agora, traz os dois mais antigos: as 52 linhas, cada pedido uma vez.
    await acionar(principal(page).getByRole('button', { name: 'Ver mais pedidos' }), hasTouch)
    await expect(linhas(page)).toHaveCount(52, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1)
    await expect(linhaDa(page, ELIMINADO)).toHaveCount(1)
    await expect(principal(page).getByRole('button', { name: 'Ver mais pedidos' })).toHaveCount(0)
  })

  test('a segunda pessoa na mesma aba, de outra escola, não vê os pedidos da anterior nem enquanto a lista dela não chegou', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const primeira = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: primeira, nome: `Fabiana ${marca()} Nunes`, matricula: `6${marca()}` })
    await colocarAlunoNaTurma(aluno)
    await criarPedidosDoTitularNoBanco(primeira.escolaId, aluno.usuarioId, primeira.usuarioId, 1)
    await entrarNosPedidos(page, hasTouch, primeira)
    await expect(linhaDa(page, aluno.nome)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })

    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    const segunda = await criarEquipeComSenha('coordenador')
    const segurada = portao()
    await page.route(
      (url) => url.pathname === '/v1/privacidade/pedidos',
      async (rota: Route) => {
        await segurada.aberta
        return rota.continue()
      },
    )
    await entrarComoCoordenacaoNaMesmaAba(page, segunda, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'Pedidos', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: CARREGANDO })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText(aluno.nome)

    segurada.abrir()
    await expect(principal(page).getByText(VAZIO)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText(aluno.nome)
  })
})

test.describe('Pedidos: a lista e os quatro estados', () => {
  test('carregando, erro com "Tentar de novo", vazio e com dado: o eliminado, a página de 50 com "Ver mais" e a ordem pela chegada, sem violação grave e sem rolagem de lado', async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const segurada = portao()
    let modo: 'erro' | 'real' = 'erro'
    // A segunda página: uma vez falha (depois de segurada, para o botão dizer "Carregando…"), e depois vem de verdade.
    const paginaSegurada = portao()
    // O cliente repete uma vez, sozinho, a leitura que falha: as duas falham, e só então a tela mostra o erro.
    let falhasDaPagina = 2
    await page.route(
      (url) => url.pathname === '/v1/privacidade/pedidos',
      async (rota: Route) => {
        if (rota.request().method() !== 'GET') return rota.continue()
        if (new URL(rota.request().url()).searchParams.has('pagina')) {
          await paginaSegurada.aberta
          if (falhasDaPagina > 0) {
            falhasDaPagina -= 1
            return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
          }
          return rota.continue()
        }
        await segurada.aberta
        if (modo === 'erro') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        return rota.continue()
      },
    )
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'Pedidos', hasTouch)
    await expect(page).toHaveURL(ENDERECO_DA_ABA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('tab', { name: 'Pedidos', exact: true })).toHaveAttribute('aria-selected', 'true')

    // Carregando.
    await expect(principal(page).getByRole('status').filter({ hasText: CARREGANDO })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)

    // Erro: diz o que fazer, e a tela não quebra.
    segurada.abrir()
    await expect(principal(page).getByRole('alert')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    expect(await violacoesGraves(page)).toEqual([])

    // Vazio: um convite, com o botão de registrar à vista.
    modo = 'real'
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(principal(page).getByText(VAZIO)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Registrar pedido', exact: true })).toBeVisible()
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Com dado: 50 pedidos de um aluno, de ontem para trás, e um do titular eliminado, de hoje. A API entrega a chegada mais recente
    // primeiro: o de hoje abre a primeira página, e a segunda tem só o mais antigo (o registrado antes de todos, e o último da lista).
    const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome: `Gabriela ${marca()} Moura`, matricula: `7${marca()}` })
    const turma = await colocarAlunoNaTurma(aluno)
    await criarPedidosDoTitularNoBanco(coordenadora.escolaId, aluno.usuarioId, coordenadora.usuarioId, 50, 1)
    await criarPedidoDeTitularEliminadoNoBanco(coordenadora.escolaId, coordenadora.usuarioId, 0)
    await page.reload()
    await expect(linhas(page)).toHaveCount(50, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByText(VAZIO)).toHaveCount(0)
    // A mais recente primeiro, na primeira página: a primeira linha é a do titular eliminado, de hoje, e a segunda é a de ontem.
    await expect(linhas(page).first()).toContainText(ELIMINADO)
    await expect(linhaDa(page, ELIMINADO)).toHaveCount(1)
    // Cada linha diz a pessoa, a turma, o pedido, quem pediu, a chegada e a situação em texto.
    const linhaDeOntem = linhas(page).nth(1)
    await expect(linhaDeOntem).toContainText(aluno.nome)
    await expect(linhaDeOntem).toContainText(turma.turmaNome)
    await expect(linhaDeOntem).toContainText('Acesso aos dados')
    await expect(linhaDeOntem).toContainText('A própria pessoa')
    await expect(linhaDeOntem).toContainText('Recebido')
    // O prazo está na linha: o pedido de ontem ainda tem 14 dias, e o do titular eliminado, concluído, não tem prazo a cumprir.
    await expect(linhaDeOntem).toContainText(`Faltam 14 dias, até ${diaCurto(somarDiasAHoje(14))}`)
    await expect(linhaDa(page, ELIMINADO)).toContainText('Pedido concluído: não há prazo a cumprir')
    const ontem = new Date(`${hoje()}T12:00:00Z`)
    ontem.setUTCDate(ontem.getUTCDate() - 1)
    await expect(linhaDeOntem).toContainText(comoNaTela(ontem.toISOString().slice(0, 10)))
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // "Ver mais pedidos" lê a página seguinte: enquanto ela não chega, o botão diz "Carregando…"; quando ela falha, a lista de
    // antes continua, com o erro e o botão para tentar de novo.
    await acionar(principal(page).getByRole('button', { name: 'Ver mais pedidos' }), hasTouch)
    await expect(principal(page).getByRole('button', { name: 'Carregando…', exact: true })).toBeDisabled()
    paginaSegurada.abrir()
    await expect(principal(page).getByRole('alert')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhas(page)).toHaveCount(50)
    await expect(principal(page).getByRole('button', { name: 'Ver mais pedidos' })).toBeVisible()
    // Tentar de novo lê de verdade: a segunda página traz o pedido mais antigo, que fica no fim, e o de hoje continua o primeiro.
    await acionar(principal(page).getByRole('button', { name: 'Ver mais pedidos' }), hasTouch)
    await expect(linhas(page)).toHaveCount(51, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Ver mais pedidos' })).toHaveCount(0)
    const doEliminado = linhaDa(page, ELIMINADO)
    await expect(doEliminado).toHaveCount(1)
    await expect(doEliminado).toContainText('Não consta')
    await expect(doEliminado).toContainText('Eliminação dos dados')
    await expect(doEliminado).toContainText('O responsável legal')
    await expect(doEliminado).toContainText('Concluído')
    await expect(linhas(page).first()).toContainText(ELIMINADO)
    await expect(linhas(page).last()).toContainText(aluno.nome)
    // O pedido mais antigo da página seguinte chegou há 50 dias: o prazo venceu há 35, dito em texto e na família do erro.
    await expect(linhas(page).last()).toContainText(`Prazo vencido há 35 dias (venceu em ${diaCurto(somarDiasAHoje(-35))})`)
    await expect(linhas(page).last().locator('[data-estado="erro"]')).toHaveCount(1)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Sair da aba e voltar lê a lista de novo, e a de antes não ficou guardada: volta a primeira página, com "Ver mais pedidos".
    await acionar(page.getByRole('tab', { name: 'Privacidade', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/privacidade\/retencao$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page.getByRole('tab', { name: 'Pedidos', exact: true }), hasTouch)
    await expect(linhas(page)).toHaveCount(50, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Ver mais pedidos' })).toBeVisible()
  })
})

test.describe('Pedidos: a escola entre dois anos letivos', () => {
  test('sem ano em curso (a escola ainda não abriu o ano letivo), a lista, a busca, o registro e o detalhe funcionam, só sem a turma', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    // A escola não tem ano em curso, como entre o fim de um ano e a abertura do seguinte: é quando o responsável pede o acesso ou a eliminação (regra 40, virada de ano). O fixture cria a escola sem ano; o encerramento pela API é provado na integração (pedido-titular.int.test.ts).
    const coordenadora = await criarEquipeComSenha('coordenador', { semAnoLetivo: true })
    const anterior = await criarAlunoComMatricula({ escola: coordenadora, nome: `Iara ${marca()} Teles`, matricula: `3${marca()}` })
    await criarPedidosDoTitularNoBanco(coordenadora.escolaId, anterior.usuarioId, coordenadora.usuarioId, 1)
    const novo = await criarAlunoComMatricula({ escola: coordenadora, nome: `Caio ${marca()} Neves`, matricula: `4${marca()}` })
    await entrarNosPedidos(page, hasTouch, coordenadora)

    // A lista traz o pedido que já existia, com a pessoa e a situação, e não o "Não encontramos" que a escola sem ano via.
    const doAnterior = linhaDa(page, anterior.nome)
    await expect(doAnterior).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(doAnterior).toContainText('Acesso aos dados')
    await expect(doAnterior).toContainText('Recebido')
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page)).not.toContainText('Não encontramos')

    // A busca acha a pessoa e o registro grava: o pedido volta para a lista e fica no banco.
    await registrarPeloFluxo(page, hasTouch, { nome: novo.nome, pessoa: new RegExp(novo.nome), tipo: 'Correção de dados', confirmar: 'Registrar pedido' })
    const doNovo = linhaDa(page, novo.nome)
    await expect(doNovo).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(doNovo).toContainText('Correção de dados')
    expect((await pedidosDoTitularNoBanco(coordenadora.escolaId)).filter(({ titularId }) => titularId === novo.usuarioId)).toEqual([expect.objectContaining({ tipo: 'correcao', estado: 'recebido' })])
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O detalhe abre: o nome da pessoa é o título, e a página não cai em "não está mais disponível".
    await acionar(linkDoPedido(doNovo, novo.nome), hasTouch)
    await expect(page).toHaveURL(ENDERECO_DO_DETALHE, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: novo.nome, exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText('não está mais disponível')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('Pedidos: o prazo na linha e a linha inteira como o link do detalhe', () => {
  test('o prazo de cada pedido está na linha, o vencido diz há quantos dias em texto, e qualquer ponto da linha abre o pedido dela', async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const vencida = await criarAlunoComMatricula({ escola: coordenadora, nome: `Vera ${marca()} Lopes`, matricula: `5${marca()}` })
    const aberta = await criarAlunoComMatricula({ escola: coordenadora, nome: `Bia ${marca()} Reis`, matricula: `6${marca()}` })
    await colocarAlunoNaTurma(vencida)
    await colocarAlunoNaTurma(aberta)
    const semear = (titularId: string, tipo: 'acesso' | 'correcao', chegouHaDias: number) =>
      criarPedidoDoTitularNoBanco({ escolaId: coordenadora.escolaId, titularId, registradoPor: coordenadora.usuarioId, tipo, estado: 'recebido', chegouHaDias })
    // Duas pessoas, dois pedidos: um que chegou há 20 dias (o prazo de 15 venceu há 5) e um de há 2 dias (faltam 13).
    const idDaVencida = await semear(vencida.usuarioId, 'correcao', 20)
    const idDaAberta = await semear(aberta.usuarioId, 'acesso', 2)
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await expect(linhas(page)).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    // A ordem é a da chegada, e o vencido não sobe: a pessoa de há 2 dias abre a lista.
    await expect(linhas(page).first()).toContainText(aberta.nome)

    // O prazo está na linha: o aberto em pendente, o vencido em texto, na família do erro e com o ícone dela.
    const daVencida = linhaDa(page, vencida.nome)
    const daAberta = linhaDa(page, aberta.nome)
    await expect(daVencida).toContainText(`Prazo vencido há 5 dias (venceu em ${diaCurto(somarDiasAHoje(-5))})`)
    await expect(daVencida.locator('[data-estado="erro"]')).toHaveCount(1)
    await expect(daVencida.locator('[data-estado="erro"] svg')).toHaveCount(1)
    await expect(daAberta).toContainText(`Faltam 13 dias, até ${diaCurto(somarDiasAHoje(13))}`)
    await expect(daAberta.locator('[data-estado="erro"]')).toHaveCount(0)
    // No celular a tabela vira lista e cada item diz "Prazo"; no computador, o cabeçalho da coluna.
    if ((page.viewportSize()?.width ?? 1366) < 768) await expect(daVencida.locator('dt', { hasText: 'Prazo' })).toHaveCount(1)
    else await expect(principal(page).getByRole('columnheader', { name: 'Prazo', exact: true })).toBeVisible()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Um link por linha, com o tipo do pedido no nome para quem ouve.
    await expect(daVencida.getByRole('link')).toHaveCount(1)
    await expect(daVencida.getByRole('link')).toHaveAccessibleName(`${vencida.nome}, Correção de dados`)
    await expect(daAberta.getByRole('link')).toHaveAccessibleName(`${aberta.nome}, Acesso aos dados`)

    // A linha inteira abre o pedido dela: o toque cai fora do nome, em "Quem pediu", e cada linha abre o seu. Com duas linhas, o link
    // que não estivesse preso à linha dele cobriria a outra.
    await acionarNoPontoDaLinha(daAberta.getByText('A própria pessoa', { exact: true }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/coordenacao/privacidade/pedidos/${idDaAberta}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: aberta.nome, exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // O detalhe é uma página de leitura, com o prazo no topo e o "‹ Pedidos" de volta.
    await expect(principal(page).locator('[data-tela]').first()).toHaveAttribute('data-tela', 'leitura')
    const prazo = principal(page).getByRole('region', { name: 'Prazo da declaração completa', exact: true })
    const pedido = principal(page).getByRole('region', { name: 'O pedido', exact: true })
    expect((await prazo.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan((await pedido.boundingBox())?.y ?? 0)
    await acionar(principal(page).getByRole('link', { name: 'Voltar para Pedidos', exact: true }), hasTouch)
    await expect(page).toHaveURL(ENDERECO_DA_ABA, { timeout: PRAZO_DA_ENTRADA_MS })

    await expect(linhas(page)).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionarNoPontoDaLinha(linhaDa(page, vencida.nome).getByText('A própria pessoa', { exact: true }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/coordenacao/privacidade/pedidos/${idDaVencida}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: vencida.nome, exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
