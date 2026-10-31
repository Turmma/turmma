import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { NOME_DA_CONTESTACAO, NOME_DO_ESTADO_DE_VINCULO } from '../packages/shared/src/estrutura/vinculo.ts'
import {
  abrirNavegacao,
  entrarComoCoordenacaoNaMesmaAba,
  escolherNoSeletor,
  esperarPainel,
  nomeNoSeletor,
  entrarComoProfessora,
  entrarComoProfessoraPelaApi,
  entrarPelaApiSemMedirAPrimeiraCarga,
  entrarPelaTelaComSegundoFator,
  entrarPorEmail,
  gaveta,
  irPelaNavegacao,
  lateral,
  naGaveta,
  PRAZO_DA_ENTRADA_MS,
  esperarNovaConversa,
  secoes,
  TITULO_DA_NOVA_CONVERSA,
  esperarInicioDoAluno,
} from './support/casca.ts'
import { cliquesAte, irPelaCoordenacao, paginaNaoRola, type TelaDaCoordenacao } from './support/coordenacao.ts'
import { carregarSemRedeLenta, expect, test } from './support/profiles.ts'
import { configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { colocarAlunoNaTurma, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, criarUsuarioEmOutraEscola, type EquipeDeTeste } from './support/seed.ts'
import { codigoCru, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * As áreas de cada papel na casca da escola (A1, tarefa 11.0): a navegação por papel e a guarda (W2), a fronteira do
 * `import()` de cada área (W5), os quatro estados de "Turmas" (W4) e o recomeço da tela — outra pessoa na mesma aba, a
 * mesma rota aberta de novo, a área lenta que chega depois da troca e a falha com a gaveta aberta.
 */

const CHUNK_DO_PROFESSOR = /\/assets\/professor-[^/]+\.js$/
const CHUNK_DA_COORDENACAO = /\/assets\/coordenacao-[^/]+\.js$/
const CHUNK_DO_ALUNO = /\/assets\/aluno-[^/]+\.js$/
const ROTA_MEUS_VINCULOS = '**/v1/meus-vinculos*'

const TITULO_DA_FALHA = 'Não foi possível carregar esta parte do Turmma'

/**
 * Os itens do professor, como a tabela `apps/web/src/areas/navigation.ts` os declara. O e2e não importa o fonte da web
 * (outra resolução de módulos); a tarefa que acrescenta a linha lá acrescenta aqui, e o W2 percorre todos. "Nova
 * conversa" e "Ferramentas" chegaram com a A2 (D73); a ordem é a da D80 (telas do professor, 2.0), e "Seu time" saiu da lista; "Criados" chegou como o quarto (telas do professor, 5.0).
 */
const ITENS_DO_PROFESSOR = [
  { rotulo: 'Início', caminho: '/professor/nova-conversa' },
  { rotulo: 'Turmas', caminho: '/professor/turmas' },
  { rotulo: 'Ferramentas', caminho: '/professor/ferramentas' },
  { rotulo: 'Criados', caminho: '/professor/criados' },
] as const
/**
 * Os quatro lugares da coordenação, como a mesma tabela os declara (X2, 3.0): o Painel, onde ela abre, o Analista e as molduras
 * Escola e Registros, que abrem na primeira aba e dizem de onde a tela é na aba do navegador. O endereço de cada um é o de hoje
 * da primeira aba (`/estrutura`, `/governanca`): nenhum endereço mudou.
 */
const ITENS_DA_COORDENACAO = [
  { rotulo: 'Painel', caminho: '/coordenacao/painel', titulo: 'Painel' },
  { rotulo: 'Analista', caminho: '/coordenacao/analista', titulo: 'Analista' },
  { rotulo: 'Escola', caminho: '/coordenacao/estrutura', titulo: 'Escola: turmas' },
  { rotulo: 'Registros', caminho: '/coordenacao/governanca', titulo: 'Registros: IA' },
] as const
/** Os itens do aluno, como a mesma tabela os declara (X4, 2.0): Início, Tarefas (o endereço de Atividades) e Eu (era Minha turma). */
const ITENS_DO_ALUNO = [
  { rotulo: 'Início', caminho: '/aluno/inicio' },
  { rotulo: 'Tarefas', caminho: '/aluno/atividades' },
  { rotulo: 'Eu', caminho: '/aluno/eu' },
] as const

/** Os endereços da coordenação que têm tela: a Governança, onde ela abre (A5), uma turma aberta na Estrutura (13.0), Professores (14.0) e o Painel (telas da coordenação, 2.0). */
const ENDERECOS_DA_COORDENACAO = [
  { nome: 'Governança', endereco: '/coordenacao/governanca' },
  // O id é de uma turma que ninguém criou, de propósito: o que se prova é a guarda de papel, e não a turma.
  { nome: 'uma turma da Estrutura', endereco: `/coordenacao/estrutura/turmas/${randomUUID()}` },
  { nome: 'Professores', endereco: '/coordenacao/professores' },
  { nome: 'Painel', endereco: '/coordenacao/painel' },
] as const

/**
 * A professora entra pela API (`POST /v1/sessao/email`, o cookie fica na própria aba), sem passar pela tela de entrada nem
 * por "Início": quem chama abre o endereço que quer, e a página carrega uma vez só. A entrada pela tela é provada em outros casos.
 */
async function entrarPelaApi(page: Page, professora?: EquipeDeTeste): Promise<EquipeDeTeste> {
  const entrando = professora ?? (await criarEquipeComSenha())
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: entrando.email, senha: entrando.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  return entrando
}

/** Os pedidos de JS que a página fez, pelo caminho: é por eles que o teste sabe qual área foi baixada. */
function registrarChunks(page: Page): string[] {
  const pedidos: string[] = []
  page.on('request', (pedido: Request) => {
    const caminho = new URL(pedido.url()).pathname
    if (caminho.endsWith('.js')) pedidos.push(caminho)
  })
  return pedidos
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

/** Navega dentro da aplicação, sem recarregar: o cache e o módulo carregado continuam, como num clique. */
async function navegarSemRecarregar(page: Page, caminho: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState(null, '', destino)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, caminho)
}

/** Um aluno com turma, entrado pelo formulário da escola dele, no Início: o ponto de partida dos casos do aluno. */
async function entrarComoAlunoDaTurma(page: Page, hasTouch: boolean) {
  const aluno = await criarAlunoComMatricula()
  const turma = await colocarAlunoNaTurma(aluno)
  await page.goto(`/e/${aluno.slug}`)
  await page.getByLabel('Matrícula').fill(aluno.matricula)
  await page.getByLabel('Senha').fill(aluno.senha)
  if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
  else await page.getByRole('button', { name: /^Entrar$/ }).click()
  await esperarInicioDoAluno(page, aluno.nome)
  return { aluno, turma }
}

const naoEncontrada = (page: Page) => page.getByRole('heading', { name: 'Página não encontrada' })

/**
 * O que o navegador calcula num item da navegação, e que o aceso e o apagado mudam (A23, A24). Na lateral, o link inteiro
 * leva a face, a borda e o texto; na barra de baixo do celular, a face e a borda são da pílula do ícone (`data-pilula`) e o
 * texto é o do rótulo, que é o último filho do link: a pista é a mesma, em duas peças.
 */
async function pinturaDoItem(item: Locator): Promise<{ fundo: string; borda: string; larguraDaBorda: string; estiloDaBorda: string; texto: string; peso: string }> {
  return item.evaluate((elemento) => {
    const pilula = elemento.querySelector('[data-pilula]')
    const rotulo = pilula === null ? elemento : (elemento.lastElementChild ?? elemento)
    const caixa = getComputedStyle(pilula ?? elemento)
    const texto = getComputedStyle(rotulo)
    return {
      fundo: caixa.backgroundColor,
      borda: caixa.borderTopColor,
      larguraDaBorda: caixa.borderTopWidth,
      estiloDaBorda: caixa.borderTopStyle,
      texto: texto.color,
      peso: texto.fontWeight,
    }
  })
}

/**
 * Pela marca, que leva à raiz. Para o professor a raiz é a tela em que ele abre, "Início" (A2; D73; D80); para o aluno,
 * também "Início" (X4, 2.0).
 */
async function voltarAoInicio(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const marca = lateral(page).getByRole('link', { name: 'Turmma, página inicial' })
  if (hasTouch) await marca.tap()
  else await marca.click()
}

test.describe('W2: a navegação de cada papel e a guarda de papel', () => {
  test('o professor vê os itens da fase dele e o menu da pessoa, sem violação grave de acessibilidade', async ({ page, hasTouch }) => {
    const professora = await entrarComoProfessora(page, hasTouch)
    // O professor abre em "Início" (A2; D73; D80), e não numa página de passagem.
    await expect(page).toHaveTitle(TITULO_DA_NOVA_CONVERSA)
    // Os itens são os da tabela do papel, e só eles; cada tarefa de tela acrescenta a linha dela. Estão à vista sem abrir a
    // gaveta: no celular são a barra de baixo (RF14), e no computador, a lateral.
    await expect(secoes(page)).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(ITENS_DO_PROFESSOR.map(({ rotulo }) => rotulo))
    await abrirNavegacao(page, hasTouch)
    // O menu da pessoa (P18): o nome, o papel e o "Sair", à vista, sem abrir nada.
    await expect(lateral(page)).toContainText(professora.nome)
    await expect(lateral(page)).toContainText('professor')
    await expect(lateral(page).getByRole('button', { name: 'Sair' })).toBeVisible()
    // F3 (18.0) e X4 (10.0): "Meus dados" e "Rever a introdução" são links do menu da pessoa, e não itens da lista de seções; o professor não tem rodapé.
    await expect(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link')).toHaveText(['Meus dados', 'Rever a introdução'])
    await expect(lateral(page).getByRole('navigation', { name: 'Rodapé', exact: true })).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o professor: cada item da navegação leva à tela dele, e nenhum à que não existe', async ({ page, hasTouch }) => {
    await entrarComoProfessora(page, hasTouch)
    // Nenhum item da tabela leva a tela que não existe. O W2 termina em "Turmas", que a ordem da D80 deixou no meio: ela vai por último.
    for (const item of [...ITENS_DO_PROFESSOR].sort((a, b) => Number(a.rotulo === 'Turmas') - Number(b.rotulo === 'Turmas'))) {
      await irPelaNavegacao(page, item.rotulo, hasTouch)
      await expect(page).toHaveURL(new RegExp(`${item.caminho}$`))
      await expect(page).toHaveTitle(`${item.rotulo} · Turmma`, { timeout: PRAZO_DA_ENTRADA_MS })
      await expect(naoEncontrada(page)).toHaveCount(0)
    }
    // O laço terminou em "Turmas" (endereço, título e "não encontrada" já conferidos): a tela é a das turmas, e não a página não encontrada.
    await expect(page.getByRole('heading', { level: 1, name: 'Turmas' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('o professor: o item da tela aberta ganha as pistas do selecionado, e o apagado, nenhuma', async ({ page, hasTouch }) => {
    await entrarComoProfessora(page, hasTouch)
    await expect(page).toHaveTitle(TITULO_DA_NOVA_CONVERSA)
    // A tela em que ele abre não diz que as turmas ficam para depois: sem turma confirmada, aponta para elas, a um toque
    // também no celular.
    await expect(page.getByRole('main')).not.toContainText('próximas versões')
    const paraTurmas = page.getByRole('main').getByRole('button', { name: 'Ir para Turmas' })
    if (hasTouch) await paraTurmas.tap({ timeout: PRAZO_DA_ENTRADA_MS })
    else await paraTurmas.click({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/professor\/turmas$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Turmas' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })

    // O selecionado (A23; D80): o `aria-current`, que o leitor de tela anuncia, o fundo `azul-claro`, a borda de 2 px
    // `azul-borda` e o texto `azul-texto`. O peso deixa de ser pista (os dois em 700), e o filete saiu.
    const turmas = secoes(page).getByRole('link', { name: 'Turmas' })
    await expect(turmas).toHaveAttribute('aria-current', 'page')
    expect(await pinturaDoItem(turmas)).toEqual({ fundo: 'rgb(223, 241, 253)', borda: 'rgb(153, 210, 248)', larguraDaBorda: '2px', estiloDaBorda: 'solid', texto: 'rgb(20, 110, 170)', peso: '700' })
    await expect(turmas.locator('[data-filete]')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Fora de "Turmas", o item volta a ser um item comum. A marca não é item, e a gaveta fecha também pela troca de
    // endereço, e não só pelo toque num item.
    await voltarAoInicio(page, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/)
    await expect(gaveta(page)).toBeHidden()
    await expect(page).toHaveTitle(TITULO_DA_NOVA_CONVERSA)
    const apagado = secoes(page).getByRole('link', { name: 'Turmas' })
    // A negativa que passava vazia (A24): a busca é em `Seções`, que no celular é a barra de baixo, e o controle positivo é
    // a própria barra à vista, com o item achado. Sem ele, um `Seções` fora do lugar deixaria a afirmação vazia.
    await expect(secoes(page)).toHaveCount(1)
    await expect(apagado).toHaveCount(1)
    await expect(apagado).not.toHaveAttribute('aria-current', 'page')
    // A negativa (A24): sem o filete, `toHaveCount(0)` passaria vazio. O apagado tem outro fundo, a borda de 2 px transparente
    // (o espaço que o aceso ocupa, e por isso acender não desloca nada) e o texto `sutil`: nenhuma das pistas do aceso.
    const pintura = await pinturaDoItem(apagado)
    expect(pintura).toEqual({ fundo: 'rgba(0, 0, 0, 0)', borda: 'rgba(0, 0, 0, 0)', larguraDaBorda: '2px', estiloDaBorda: 'solid', texto: 'rgb(93, 93, 93)', peso: '700' })
    expect(pintura.fundo).not.toBe('rgb(223, 241, 253)')
    expect(pintura.borda).not.toBe('rgb(153, 210, 248)')
    await expect(apagado.locator('[data-filete]')).toHaveCount(0)
  })

  test('o professor no endereço do aluno cai em "não encontrada", sem baixar a área dele nem a da coordenação', async ({ page }) => {
    // Um caso por endereço (este e os quatro de baixo), e cada um entra pela API: as seis cargas de página do caso único (a entrada,
    // quatro endereços da coordenação e o do aluno) passavam dos 30 s da esteira no Chromebook de teste (CPU ×4, Fast 3G), onde cada
    // carga leva uns 4 s e a entrada pela tela, uns 9 s (esteira `39129521729`). As asserções são as de antes.
    const pedidos = registrarChunks(page)
    await entrarPelaApi(page)

    await page.goto('/aluno/eu')
    await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // A área do aluno responderia "não encontrada" para o professor também sem a guarda (Eu é só do aluno
    // na API): é o pedido do chunk que mostra que nenhuma das duas áreas foi baixada nem montada.
    expect(pedidos.filter((caminho) => CHUNK_DA_COORDENACAO.test(caminho) || CHUNK_DO_ALUNO.test(caminho))).toEqual([])
  })

  for (const { nome, endereco } of ENDERECOS_DA_COORDENACAO) {
    test(`o professor no endereço da coordenação em ${nome} cai em "não encontrada", sem baixar a área dela nem a do aluno`, async ({ page }) => {
      const pedidos = registrarChunks(page)
      await entrarPelaApi(page)

      await page.goto(endereco)
      await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      for (const titulo of ['Governança', 'Estrutura', 'Professores', 'Painel']) {
        await expect(page.getByRole('heading', { name: titulo })).toHaveCount(0)
      }
      await expect(page).toHaveTitle('Página não encontrada · Turmma')
      // A casca continua: a pessoa sai dali pela lateral, e não por um beco sem saída.
      await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
      expect(pedidos.filter((caminho) => CHUNK_DA_COORDENACAO.test(caminho) || CHUNK_DO_ALUNO.test(caminho))).toEqual([])
    })
  }

  // Separado dos casos acima só pelo prazo: as cinco entradas de página por `page.goto`, no perfil de rede lenta e com o
  // servidor do e2e sem compressão nem cache, passavam dos 30 s juntas (esteira `37245636814`). As asserções são as
  // mesmas de antes; cada teste começa da entrada da professora.
  test('o endereço que não existe na área do professor responde igual ao de outro papel, e "página inicial" volta ao Início', async ({ page, hasTouch }) => {
    const pedidos = registrarChunks(page)
    const professora = await entrarComoProfessora(page, hasTouch)

    // Um endereço que não existe dentro da própria área responde igual: a tela não confirma o que é de outro papel.
    await page.goto('/professor/qualquer')
    await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(pedidos.some((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toBe(true)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // Dentro da área, "página inicial" leva à raiz, e não ao começo da área (`/professor/`).
    if (hasTouch) await page.getByRole('main').getByRole('link', { name: 'página inicial', exact: true }).tap()
    else await page.getByRole('main').getByRole('link', { name: 'página inicial', exact: true }).click()
    // A raiz leva o professor à tela em que ele abre: é por ela que se chega a "Início", e não por `/professor/`,
    // que não é tela nenhuma.
    await esperarNovaConversa(page, professora.nome)
    await expect(naoEncontrada(page)).toHaveCount(0)
  })

  test('o aluno vê "Início", "Tarefas" e "Eu", cada um levando à tela dele', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    await page.goto(`/e/${aluno.slug}`)
    await page.getByLabel('Matrícula').fill(aluno.matricula)
    await page.getByLabel('Senha').fill(aluno.senha)
    if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
    else await page.getByRole('button', { name: /^Entrar$/ }).click()
    // O aluno abre em "Início" (X4, 2.0), e não numa página de passagem: nada ali aponta para Turmas, que não é tela dele.
    await esperarInicioDoAluno(page, aluno.nome)
    await expect(page.getByRole('main').getByRole('link', { name: 'Turmas', exact: true })).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('próximas versões')
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(page).toHaveURL(/\/aluno\/eu$/)
    await expect(page.getByRole('main')).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    // A marca leva à raiz, e a raiz do aluno é "Início".
    await voltarAoInicio(page, hasTouch)
    await expect(page).toHaveURL(/\/aluno\/inicio$/)

    await expect(secoes(page)).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(ITENS_DO_ALUNO.map(({ rotulo }) => rotulo))
    await abrirNavegacao(page, hasTouch)
    await expect(lateral(page)).toContainText(aluno.nome)
    await expect(lateral(page)).toContainText('aluno')
    // X4 (2.0): "Privacidade" é uma linha de Eu, e não do rodapé; o aluno não tem rodapé nem link no menu da pessoa, e o "Sair" fica à vista.
    await expect(lateral(page).getByRole('navigation', { name: 'Rodapé', exact: true })).toHaveCount(0)
    await expect(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true })).toHaveCount(0)
    await expect(lateral(page).getByRole('button', { name: 'Sair' })).toBeVisible()

    // Nenhum item da tabela leva a tela que não existe, e o lugar da tela fica aceso.
    for (const item of ITENS_DO_ALUNO) {
      await irPelaNavegacao(page, item.rotulo, hasTouch)
      await expect(page).toHaveURL(new RegExp(`${item.caminho}$`))
      await expect(page).toHaveTitle(`${item.rotulo} · Turmma`, { timeout: PRAZO_DA_ENTRADA_MS })
      await expect(naoEncontrada(page)).toHaveCount(0)
      await expect(secoes(page).getByRole('link', { name: item.rotulo, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(secoes(page).locator('[aria-current="page"]')).toHaveCount(1)
    }
    // O último item é "Eu": a tela dele, com a turma dele.
    await expect(page.getByRole('main')).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('os endereços do professor e da coordenação caem em "não encontrada" para o aluno, sem baixar o pedaço da área deles', async ({ page, hasTouch }) => {
    const pedidos = registrarChunks(page)
    await entrarComoAlunoDaTurma(page, hasTouch)

    // O primeiro, com a página recarregada (a guarda lê o `/v1/eu` do zero); os outros, sem recarregar.
    await page.goto('/professor/turmas')
    await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    for (const endereco of ['/coordenacao/estrutura', '/coordenacao/professores']) {
      await navegarSemRecarregar(page, endereco)
      await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    }
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho) || CHUNK_DA_COORDENACAO.test(caminho))).toEqual([])
  })

  test('o endereço de Minha turma leva a Eu, sem ficar no histórico: o Voltar não cai de novo nele', async ({ page, hasTouch }) => {
    const { turma } = await entrarComoAlunoDaTurma(page, hasTouch)

    // O endereço antigo da turma troca a entrada do histórico: o Voltar não cai de novo no endereço que redireciona.
    await navegarSemRecarregar(page, '/aluno/minha-turma')
    await expect(page).toHaveURL(/\/aluno\/eu$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await page.goBack()
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('os endereços de hoje do aluno abrem as telas de hoje, e Tutor e Privacidade acendem Início e Eu', async ({ page, hasTouch }) => {
    await entrarComoAlunoDaTurma(page, hasTouch)

    // O lugar aceso é o de Início para o Tutor e o de Eu para Privacidade.
    await navegarSemRecarregar(page, '/aluno/tutor')
    await expect(page).toHaveTitle('Tutor · Turmma', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(naoEncontrada(page)).toHaveCount(0)
    await expect(secoes(page).getByRole('link', { name: 'Início', exact: true })).toHaveAttribute('aria-current', 'page')
    await navegarSemRecarregar(page, '/aluno/privacidade')
    await expect(page).toHaveTitle('Privacidade · Turmma', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secoes(page).getByRole('link', { name: 'Eu', exact: true })).toHaveAttribute('aria-current', 'page')
    await navegarSemRecarregar(page, '/aluno/atividades')
    await expect(page).toHaveTitle('Tarefas · Turmma', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secoes(page).getByRole('link', { name: 'Tarefas', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  /**
   * A coordenação (X2, 3.0; RF1 a RF3): abre no Painel, tem os quatro lugares (na barra de baixo a 360 px), e cada tela de hoje
   * está a até dois cliques do lugar em que a pessoa está — o lugar e a aba —, com Empresas e Incidentes a três (o seletor da
   * Privacidade). Nenhum endereço mudou: o teste confere o de cada tela e o lugar que a lateral acende nele.
   */
  const TELAS_DA_COORDENACAO: readonly { readonly tela: TelaDaCoordenacao; readonly endereco: string; readonly lugar: string }[] = [
    { tela: 'Painel', endereco: '/coordenacao/painel', lugar: 'Painel' },
    { tela: 'Analista', endereco: '/coordenacao/analista', lugar: 'Analista' },
    { tela: 'Turmas', endereco: '/coordenacao/estrutura', lugar: 'Escola' },
    { tela: 'Professores', endereco: '/coordenacao/professores', lugar: 'Escola' },
    { tela: 'Material', endereco: '/coordenacao/material', lugar: 'Escola' },
    { tela: 'IA', endereco: '/coordenacao/governanca', lugar: 'Registros' },
    { tela: 'Agentes', endereco: '/coordenacao/agentes', lugar: 'Registros' },
    { tela: 'Pedidos', endereco: '/coordenacao/privacidade/pedidos', lugar: 'Registros' },
    { tela: 'Prazos de guarda', endereco: '/coordenacao/privacidade/retencao', lugar: 'Registros' },
    { tela: 'Empresas', endereco: '/coordenacao/privacidade/suboperadores', lugar: 'Registros' },
    { tela: 'Incidentes', endereco: '/coordenacao/privacidade/incidentes', lugar: 'Registros' },
  ]

  test('a coordenação abre no Painel, vê Painel, Analista, Escola e Registros (na barra de baixo a 360 px), e cada tela de hoje fica a até dois cliques; Empresas e Incidentes, a três', async ({ page, hasTouch }) => {
    // O caso entra com segundo fator, percorre os quatro lugares e, depois, as onze telas, e em cada uma `paginaNaoRola` espera a
    // leitura terminar (de 0,8 a 1,3 s na rede e na CPU do perfil). Na esteira isso soma mais que os 30 s do relógio padrão, sem
    // que nenhuma tela trave (trace da esteira 39062201162): é o tempo da medida verdadeira, não da tela. Por isso o relógio é o triplo.
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await expect(page).toHaveTitle('Painel · Turmma')

    // Os quatro lugares, nessa ordem. No celular são a barra de baixo, sempre à vista, e a gaveta não leva mais a navegação;
    // no computador, a lateral (RF1).
    await expect(secoes(page)).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(ITENS_DA_COORDENACAO.map(({ rotulo }) => rotulo))
    if (naGaveta(page)) {
      await expect(page.locator('html')).toHaveAttribute('data-barra-de-baixo', '')
      await expect(secoes(page).first()).toBeVisible()
      await expect(gaveta(page).getByRole('navigation', { name: 'Seções', exact: true })).toHaveCount(0)
    }
    expect(await violacoesGraves(page)).toEqual([])

    // Cada lugar leva ao endereço de hoje da primeira aba dele, com o título na aba e o lugar aceso.
    for (const item of ITENS_DA_COORDENACAO) {
      await irPelaNavegacao(page, item.rotulo, hasTouch)
      await expect(page).toHaveURL(new RegExp(`${item.caminho}$`))
      await expect(page).toHaveTitle(`${item.titulo} · Turmma`, { timeout: PRAZO_DA_ENTRADA_MS })
      await expect(naoEncontrada(page)).toHaveCount(0)
      await expect(secoes(page).getByRole('link', { name: item.rotulo, exact: true })).toHaveAttribute('aria-current', 'page')
      expect(await larguraExcedente(page), item.rotulo).toBe(0)
    }

    // O RF3: de um lugar que não é o da tela, cada uma está a até dois cliques (três, no seletor da Privacidade), e o endereço
    // e o lugar aceso são os de hoje. A ordem sai de um lugar e vai a outro de propósito: Registros → Escola → Registros.
    // `cliquesAte` lê a mesma tabela que `irPelaCoordenacao` executa, então o `expect` dele só guarda o teto da tabela: a prova do
    // RF3 é o clique de verdade, seguido do endereço e do lugar aceso. E, a 1366 × 768, a página não rola em nenhuma tela do laço
    // (RF23), medida com a leitura terminada: a partir de 768 px quem rola é o miolo, o da moldura em Escola e Registros e o da própria
    // tela nos Agentes e no Analista; o Painel, com a escola deste teste, cabe na janela.
    for (const { tela, endereco, lugar } of [...TELAS_DA_COORDENACAO].reverse()) {
      expect(cliquesAte(tela), tela).toBeLessThanOrEqual(tela === 'Empresas' || tela === 'Incidentes' ? 3 : 2)
      await irPelaCoordenacao(page, tela, hasTouch)
      await expect(page, tela).toHaveURL(new RegExp(`${endereco}$`))
      await expect(naoEncontrada(page), tela).toHaveCount(0)
      await expect(secoes(page).getByRole('link', { name: lugar, exact: true }), tela).toHaveAttribute('aria-current', 'page')
      await paginaNaoRola(page)
    }
  })
})

test.describe('W5: a fronteira do import() de cada área', () => {
  test('a área do professor que não chega: o texto e o título da falha, a casca de pé, e o título de antes ao sair', async ({ page, hasTouch }) => {
    await page.route(CHUNK_DO_PROFESSOR, (rota: Route) => rota.abort('internetdisconnected'))
    // O professor abre em "Início" (A2; D73; D80): a área é pedida já na entrada, e é ali que ela não chega.
    const professora = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrarPorEmail(page, professora, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('alert')).toContainText('Confira a conexão e tente de novo', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Não foi possível carregar · Turmma')
    // A fronteira assume com o foco nela: quem usa leitor de tela fica sabendo que a tela mudou.
    await expect(page.getByRole('heading', { name: TITULO_DA_FALHA })).toBeFocused()
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Saindo por outra rota, a aba volta a dizer a tela em que a pessoa está. Fora da área do professor, o que existe
    // para ele é a página não encontrada, que não depende do pedaço que falhou.
    await navegarSemRecarregar(page, '/coordenacao/estrutura')
    await expect(page.getByRole('heading', { name: TITULO_DA_FALHA })).toHaveCount(0)
    await expect(naoEncontrada(page)).toBeVisible()
    await expect(page).toHaveTitle('Página não encontrada · Turmma')

    // Saindo pelo "Sair", para uma tela que não põe título: a fronteira devolve o de antes dela, e a aba não continua
    // dizendo que algo não carregou (o `componentWillUnmount`, pendência da A0b).
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page).toHaveTitle('Não foi possível carregar · Turmma', { timeout: PRAZO_DA_ENTRADA_MS })
    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Turmma')
  })

  test('a área da coordenação que não chega mostra a mesma fronteira, e a nova tentativa carrega', async ({ page, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    // A coordenação abre no Painel (X2): a área é pedida já na entrada, e é ali que ela não chega.
    const abortar = (rota: Route) => rota.abort('internetdisconnected')
    await page.route(CHUNK_DA_COORDENACAO, abortar)
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await expect(page.getByRole('alert')).toContainText('Confira a conexão e tente de novo', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Não foi possível carregar · Turmma')
    await expect(page.getByRole('heading', { name: TITULO_DA_FALHA })).toBeFocused()
    expect(await violacoesGraves(page)).toEqual([])

    // Com a rede de volta, "Tentar de novo" recarrega e a área chega, com o Painel.
    await page.unroute(CHUNK_DA_COORDENACAO, abortar)
    if (hasTouch) await page.getByRole('button', { name: 'Tentar de novo' }).tap()
    else await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await esperarPainel(page)
    await expect(page.getByRole('heading', { name: TITULO_DA_FALHA })).toHaveCount(0)
  })
})

test.describe('W4: os estados de "Turmas"', () => {
  test('vazio com a rota interceptada: diz que quem aloca é a coordenação, com o próximo passo', async ({ page }) => {
    // A professora entra pela API e abre o endereço: cada carga custa uns 7 s no Chromebook de teste, e dois estados no mesmo caso passam de 15 s.
    await page.route(ROTA_MEUS_VINCULOS, (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [] }) }))
    await entrarPelaApi(page)
    await page.goto('/professor/turmas')

    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText('fale com ela')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('erro com a rota interceptada: a mensagem do catálogo, com "Tentar de novo", e nenhum código na tela', async ({ page }) => {
    await page.route(ROTA_MEUS_VINCULOS, (rota: Route) =>
      rota.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      }),
    )
    await entrarPelaApi(page)
    await page.goto('/professor/turmas')

    await expect(page.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    for (const proibido of [codigoCru('503'), 'INDISPONIVEL_TENTE_DE_NOVO']) await expect(page.locator('body')).not.toContainText(proibido)
  })

  test('só pendente e com as confirmadas: a confirmada passa para "Suas turmas", a contestada vira cartão sem link, e a faixa some', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática', 'História'])
    await entrarPelaApi(page, professora)
    await page.goto('/professor/turmas')

    // Só pendente: "Confirme suas turmas", com as duas disciplinas, e nenhuma "Suas turmas" ainda.
    const paraConfirmar = page.getByRole('region', { name: 'Confirme suas turmas', exact: true })
    const decididas = page.getByRole('region', { name: 'Suas turmas', exact: true })
    await expect(paraConfirmar.getByRole('listitem')).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(paraConfirmar).toContainText(alocacao.turmaNome)
    await expect(decididas).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Com dado: a confirmada passa para "Suas turmas", e a outra continua esperando a decisão.
    const matematica = paraConfirmar.getByRole('listitem').filter({ hasText: 'Matemática' })
    if (hasTouch) await matematica.getByRole('button', { name: 'Confirmar' }).tap()
    else await matematica.getByRole('button', { name: 'Confirmar' }).click()
    await expect(decididas.getByRole('listitem')).toHaveText([new RegExp(`${alocacao.turmaNome} · Matemática.*${NOME_DO_ESTADO_DE_VINCULO.confirmado}`)], {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    await expect(paraConfirmar.getByRole('listitem')).toHaveCount(1)
    await expect(paraConfirmar).toContainText('História')
    // A confirmada não oferece decidir de novo.
    await expect(decididas.getByRole('button')).toHaveCount(0)

    // A contestada espera a coordenação, e não mais a professora: sai da faixa e vira cartão, que não abre a turma.
    const historia = paraConfirmar.getByRole('listitem').filter({ hasText: 'História' })
    if (hasTouch) await historia.getByRole('button', { name: 'Contestar' }).tap()
    else await historia.getByRole('button', { name: 'Contestar' }).click()
    const painel = page.getByRole('dialog', { name: 'Contestar a turma' })
    await painel.getByRole('radio', { name: NOME_DA_CONTESTACAO.nao_leciono }).check()
    if (hasTouch) await painel.getByRole('button', { name: 'Enviar a contestação' }).tap()
    else await painel.getByRole('button', { name: 'Enviar a contestação' }).click()
    await expect(decididas.getByRole('listitem')).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(decididas.getByRole('listitem').filter({ hasText: 'História' })).toContainText(NOME_DO_ESTADO_DE_VINCULO.contestado)
    await expect(decididas.getByRole('listitem').filter({ hasText: 'História' }).getByRole('link')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Confirme suas turmas', exact: true })).toHaveCount(0)
  })
})

test.describe('recomeço da tela', () => {
  test('segunda pessoa: a coordenação entra na aba do professor sem o item nem o dado dele', async ({ page, hasTouch, request }) => {
    // A alocação existe antes da entrada: o Início já lê os vínculos ao abrir, e a lista que ela leu fica fresca
    // no cache por 30 s. Criada depois, a alocação perdia a corrida para essa leitura, e "Turmas" mostrava o vazio do
    // cache (esteiras 37324214757 e 37330163372; correção 2026-10-05-segunda-pessoa-cache-dos-vinculos).
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId)
    await entrarPelaApiSemMedirAPrimeiraCarga(page, professora, '/professor/nova-conversa', () => esperarNovaConversa(page, professora.nome))
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('main')).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })

    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A coordenadora entra na mesma aba, sem recarregar: o módulo da área do professor continua na memória da página.
    let leiturasDosVinculos = 0
    await page.route(ROTA_MEUS_VINCULOS, async (rota: Route) => {
      leiturasDosVinculos++
      await rota.continue()
    })
    const coordenadora = await criarEquipeComSenha('coordenador')
    // O segundo fator é configurado pela API: o caso é sobre o que a aba mostra da professora, e o login da coordenadora, pela tela, continua.
    const { segredo } = await configurarSegundoFatorPelaApi(request, coordenadora)
    await entrarPelaTelaComSegundoFator(page, coordenadora, segredo, hasTouch)
    // A coordenação abre no Painel (X2), que também não aponta para Turmas, tela do professor.
    await esperarPainel(page)
    await expect(page.getByRole('main').getByRole('link', { name: 'Turmas' })).toHaveCount(0)
    // A barra de baixo é a da coordenação agora (quatro lugares, X2), e não a da professora: no celular ela está à vista com os
    // lugares de quem entrou, e a página reserva o lugar dela; no computador, os mesmos lugares estão na lateral (A90, A91).
    await expect(secoes(page)).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(ITENS_DA_COORDENACAO.map(({ rotulo }) => rotulo))
    if (naGaveta(page)) await expect(page.locator('html')).toHaveAttribute('data-barra-de-baixo', '')
    else await expect(page.locator('html')).not.toHaveAttribute('data-barra-de-baixo', '')

    await abrirNavegacao(page, hasTouch)
    await expect(lateral(page)).toContainText(coordenadora.nome)
    await expect(page.locator('body')).not.toContainText(professora.nome)
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)

    // Nem voltando ao endereço das turmas: a guarda responde pelo papel da pessoa de agora, e o cache da anterior
    // não aparece.
    await navegarSemRecarregar(page, '/professor/turmas')
    await expect(naoEncontrada(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)
    expect(leiturasDosVinculos).toBe(0)
  })

  test('troca de escola pelo seletor, de "Início" para "Início": a gaveta não fica aberta por cima', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    // A primeira carga não afirma nada sobre o tempo de baixar `/entrar`: o caso é sobre a gaveta na troca de escola. Na rede do
    // perfil ela travou na esteira, com o documento 200 e 14 pedidos que nunca saíram do navegador (execução 40332902053; a mesma
    // trava de `2026-10-17-casca-carregando-estoura-o-goto`, em outro caso). A entrada e a troca seguem na rede do perfil.
    await carregarSemRedeLenta(page, () => page.goto('/entrar'))
    await entrarPorEmail(page, emA, hasTouch)
    const escolherA = page.getByRole('button', { name: `${emA.escolaNome} · professor` })
    if (hasTouch) await escolherA.tap({ timeout: PRAZO_DA_ENTRADA_MS })
    else await escolherA.click({ timeout: PRAZO_DA_ENTRADA_MS })
    await esperarNovaConversa(page, emA.nome)

    // A tela é a mesma antes e depois da troca (o professor abre em "Início" nas duas escolas): é a pessoa da
    // sessão que muda, e é ela que fecha a gaveta.
    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await esperarNovaConversa(page, 'Professora sintética na outra escola')
    expect(new URL(page.url()).pathname).toBe('/professor/nova-conversa')
    await expect(gaveta(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('mesma entrada: abrir "Turmas" de novo não monta a área duas vezes nem baixa o chunk de novo', async ({ page, hasTouch }) => {
    const pedidos = registrarChunks(page)
    await entrarComoProfessora(page, hasTouch)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('heading', { level: 1, name: 'Turmas' })).toHaveCount(1)
    await expect(page.getByText('A coordenação ainda não alocou você')).toHaveCount(1)
    // O item fecha a gaveta também quando o endereço não muda.
    await expect(gaveta(page)).toBeHidden()
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toHaveLength(1)
  })

  test('resposta atrasada: a área lenta que chega depois de a pessoa sair dela não aparece', async ({ page, hasTouch }) => {
    const pedidos = registrarChunks(page)
    const segurada = portao()
    await page.route(CHUNK_DO_PROFESSOR, async (rota: Route) => {
      await segurada.aberta
      await rota.continue()
    })
    // O professor abre em "Início" (A2; D73; D80): a área é pedida já na entrada, e fica segurada.
    const professora = await criarEquipeComSenha()
    await page.goto('/entrar')
    const pedidoDoChunk = page.waitForRequest((pedido) => CHUNK_DO_PROFESSOR.test(new URL(pedido.url()).pathname))
    await entrarPorEmail(page, professora, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Carregando…', { timeout: PRAZO_DA_ENTRADA_MS })
    const chunk = await pedidoDoChunk
    // Ela sai da área antes de a área chegar. Fora dela, o que existe para o professor é a página não encontrada.
    await navegarSemRecarregar(page, '/coordenacao/estrutura')
    await expect(page).toHaveTitle('Página não encontrada · Turmma')

    // O chunk chega, e o módulo é avaliado: o `import()` do mesmo endereço só resolve com o módulo que a página já tem.
    // Dois quadros depois, qualquer coisa que a chegada fosse pintar já estaria na tela.
    const resposta = chunk.response()
    segurada.abrir()
    const chegada = await resposta
    expect(chegada, 'o chunk não teve resposta').not.toBeNull()
    await chegada?.finished()
    await page.evaluate(async (url) => {
      await import(/* @vite-ignore */ url)
      await new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto())))
    }, chunk.url())
    await expect(page).toHaveURL(/\/coordenacao\/estrutura$/)
    // O único título do conteúdo é o da página em que ela está: nada da área do professor apareceu junto.
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(['Página não encontrada'])
    await expect(page.getByRole('main')).not.toContainText('O que vamos preparar hoje?')
    await expect(page.getByText('A coordenação ainda não alocou você')).toHaveCount(0)
    await expect(page).toHaveTitle('Página não encontrada · Turmma')

    // Controle: a área chegou de fato. Voltando a ela sem recarregar, aparece sem pedir o chunk de novo.
    await navegarSemRecarregar(page, '/professor/turmas')
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toHaveLength(1)
  })

  test('a guarda sem o /v1/eu: carrega enquanto ele não chega, e na falha mostra o erro com nova tentativa, nunca "não encontrada"', async ({ page, hasTouch }) => {
    const pedidos = registrarChunks(page)
    await entrarComoProfessoraPelaApi(page)

    let estado: 'segurado' | 'falha' | 'normal' = 'segurado'
    const segurado = portao()
    await page.route('**/v1/eu', async (rota: Route) => {
      if (estado === 'segurado') await segurado.aberta
      if (estado === 'falha')
        return rota.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
        })
      return rota.continue()
    })

    // A aba abre direto na área: a sessão volta pelo cookie, e o papel ainda não é conhecido. O pedaço da área que a
    // entrada baixou (o professor abre em "Início") foi com a página anterior: a conta recomeça aqui.
    pedidos.length = 0
    await page.goto('/professor/turmas')
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Carregando…', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(naoEncontrada(page)).toHaveCount(0)
    await expect(page).not.toHaveTitle('Página não encontrada · Turmma')

    // A API cai: a guarda diz o que fazer, e não que a página não existe, nem baixa a área sem saber o papel.
    estado = 'falha'
    segurado.abrir()
    await expect(page.getByRole('main').getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main').getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    await expect(naoEncontrada(page)).toHaveCount(0)
    await expect(page).not.toHaveTitle('Página não encontrada · Turmma')
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toEqual([])
    expect(await violacoesGraves(page)).toEqual([])

    // A API volta: "Tentar de novo" leva a "Turmas".
    estado = 'normal'
    const tentar = page.getByRole('main').getByRole('button', { name: 'Tentar de novo' })
    if (hasTouch) await tentar.tap()
    else await tentar.click()
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Turmas · Turmma')
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toHaveLength(1)
  })

  test('sem sessão, o endereço de uma área leva à entrada sem baixar a área', async ({ page }) => {
    const pedidos = registrarChunks(page)
    await page.goto('/professor/turmas')
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    expect(pedidos.filter((caminho) => CHUNK_DO_PROFESSOR.test(caminho))).toEqual([])
  })

  test('falha com a gaveta aberta: a fronteira assume, a gaveta fecha e o foco vai para a falha', async ({ page, hasTouch }) => {
    // No computador, a gaveta é a lateral que o trilho abre por cima, entre 768 e 1023 px.
    if (!naGaveta(page)) await page.setViewportSize({ width: 900, height: 768 })
    const segurada = portao()
    await page.route(CHUNK_DO_PROFESSOR, async (rota: Route) => {
      await segurada.aberta
      await rota.abort('internetdisconnected')
    })
    const professora = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrarPorEmail(page, professora, hasTouch)
    // O professor abre em "Início" (A2; D73; D80): a área começa a carregar já na entrada.
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A área está carregando, e a pessoa abre a gaveta enquanto espera.
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Carregando…', { timeout: PRAZO_DA_ENTRADA_MS })
    const abrir = page.getByRole('button', { name: naGaveta(page) ? 'Abrir o menu' : 'Abrir a lateral' })
    if (hasTouch) await abrir.tap()
    else await abrir.click()
    await expect(gaveta(page)).toBeVisible()

    segurada.abrir()
    await expect(page.getByRole('heading', { name: TITULO_DA_FALHA })).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(gaveta(page)).toBeHidden()
    await expect(page.getByRole('alert')).toContainText('Confira a conexão e tente de novo')
    expect(await violacoesGraves(page)).toEqual([])
  })
})
