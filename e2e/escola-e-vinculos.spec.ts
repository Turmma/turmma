import type { Locator, Page, Route } from '@playwright/test'
import { AVISO_DA_TROCA_RECUSADA, MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { AVISO_DO_COMPLEMENTO, EFEITO_DA_CONTESTACAO, NOME_DA_CONTESTACAO, NOME_DO_ESTADO_DE_VINCULO } from '../packages/shared/src/estrutura/vinculo.ts'
import {
  codigoDoAutenticador,
  criarAlocacaoDoProfessor,
  criarAlunoComMatricula,
  criarEquipeComSenha,
  criarUsuarioEmOutraEscola,
  liberarProvedorDaEscola,
  ligarContaExterna,
  type EquipeDeTeste,
} from './support/seed.ts'
import { abrirNavegacao, abrirSeletorDeEscola, botaoDoSeletor, entrarPelaApi, esperarPainel, irPelaNavegacao, lateral, linhaDoSeletor, nomeNoSeletor, esperarNovaConversa, esperarInicioDoAluno, secoes } from './support/casca.ts'
import { carregarSemRedeLenta, expect, test } from './support/profiles.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, focoVisivel, larguraExcedente, violacoesGraves } from './support/checks.ts'

const ROTA_MEUS_VINCULOS = '**/v1/meus-vinculos*'
const ROTA_CONFIRMAR = '**/v1/vinculos/*/confirmar'
const ROTA_CONTESTAR = '**/v1/vinculos/*/contestar'
/** O Chromebook com CPU ×4 e rede Fast 3G carrega a página e ainda faz o hash da senha no servidor. */
const PRAZO_DA_ENTRADA_MS = 20_000
/** O login pela conta da escola passa por três navegações e o discovery do provedor. */
const PRAZO_DO_LOGIN_EXTERNO_MS = 40_000
/** Um passo do TOTP à frente: a ativação grava o passo usado, e só um passo maior entra depois (6.0). */
const PASSO_SEGUINTE_SEGUNDOS = 30

/** Os usuários sintéticos do `oidc-falso` (infra/oidc-falso/config.json), escolhidos pelo nome digitado no login dele. */
const CONTA_NO_PROVEDOR = 'google-aluna-a'
const SUJEITO_NO_PROVEDOR = 'google-sub-aluna-a'
const DOMINIO_DA_ESCOLA = 'escola-a.educa-sintetica.test'

const campoEmail = (page: Page) => page.getByLabel('E-mail')
const campoSenha = (page: Page) => page.getByLabel('Senha')

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
async function acionar(page: Page, nome: string | RegExp, hasTouch: boolean, papel: 'button' | 'link' = 'button'): Promise<void> {
  const alvo = page.getByRole(papel, { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function esperarAlvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

async function entrarPorEmail(page: Page, equipe: EquipeDeTeste, hasTouch: boolean): Promise<void> {
  await campoEmail(page).fill(equipe.email)
  await campoSenha(page).fill(equipe.senha)
  await acionar(page, /^Entrar$/, hasTouch)
}

/**
 * A área autenticada de uma escola: o nome de quem entrou e o nome dela. A professora abre em "Nova conversa" (A2; D73),
 * com o nome dela e o da escola na casca.
 */
async function esperarEscola(page: Page, nome: string, escolaNome: string): Promise<void> {
  await esperarNovaConversa(page, nome, { escolaNome })
}

/** O aluno abre em "Início" (X4, 2.0), com o nome dele e o da escola na lateral. */
async function esperarEscolaDoAluno(page: Page, nome: string, escolaNome: string): Promise<void> {
  await esperarInicioDoAluno(page, nome, { escolaNome })
}

/** O formulário do `oidc-falso`, que faz o papel da tela do Google: o nome digitado ali é o `subject` do usuário. */
async function entrarNoProvedorFalso(page: Page, sujeito: string): Promise<void> {
  await page.route('**://fonts.googleapis.com/**', (rota: Route) => rota.abort())
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
  await page.locator('input[name="username"]').fill(sujeito)
  await page.locator('input[type="submit"]').click()
}

/**
 * Caminha pelo teclado até o alvo, como quem não usa o mouse (regra 50, item 11). Falha se ele não estiver na ordem
 * de foco: tela alcançável só por clique é tela que exclui gente, e edital de escola pública cobra isso.
 */
async function tabAte(page: Page, alvo: Locator, descricao: string, maximoDeTeclas = 30): Promise<void> {
  for (let tecla = 0; tecla < maximoDeTeclas; tecla++) {
    await page.keyboard.press('Tab')
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      expect(await focoVisivel(page), `foco invisível em ${descricao}`).toBe(true)
      return
    }
  }
  throw new Error(`${descricao} não foi alcançado pelo teclado em ${String(maximoDeTeclas)} teclas`)
}

/** Toca ou clica a linha de uma escola na lista aberta do seletor. */
async function acionarNoSeletor(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  const linha = linhaDoSeletor(page, nome)
  if (hasTouch) await linha.tap()
  else await linha.click()
}

/**
 * A professora entra pela API (o cookie fica na aba) e abre o endereço: uma carga só. Cada carga custa uns 7 s no Chromebook de
 * teste, e o portão da tarefa reprova caso de e2e alterado que passa de 15 s; a entrada pela tela é provada em outros casos.
 */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

test.describe('escolher e trocar de escola', () => {
  test('a professora com duas escolas escolhe por onde entra, só com teclado, e vê escola e papel de cada acesso', async ({ page }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await page.goto('/entrar')

    await page.keyboard.press('Tab')
    await page.keyboard.type(emA.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(emA.senha)
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Escolher a escola' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Sem a lista que vem junto com o desafio, esta tela não teria o que mostrar: não há sessão para consultar nada.
    await expect(page.getByRole('button', { name: `${emA.escolaNome} · professor` })).toBeVisible()
    await expect(page.getByRole('button', { name: `${emB.escolaNome} · professor` })).toBeVisible()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Alcança a escolha só com o teclado, e o foco aparece.
    await page.keyboard.press('Tab')
    expect(await focoVisivel(page)).toBe(true)
    await page.getByRole('button', { name: `${emB.escolaNome} · professor` }).focus()
    await page.keyboard.press('Enter')

    await esperarEscola(page, 'Professora sintética na outra escola', emB.escolaNome)
    expect(new URL(page.url()).pathname).toBe('/professor/nova-conversa')
    // O nome de A aparece no seletor, e só ali: é um acesso da própria conta. O nome de quem ela é em A, não.
    await expect(page.getByRole('main')).not.toContainText(emA.escolaNome)
    await expect(page.locator('body')).not.toContainText(emA.nome)
  })

  test('isolamento: trocar de escola pelo seletor não leva a turma da escola anterior, nem pelo histórico', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    const alocacao = await criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId)

    await page.goto('/entrar')
    await entrarPorEmail(page, emA, hasTouch)
    await acionar(page, `${emA.escolaNome} · professor`, hasTouch)
    await esperarEscola(page, emA.nome, emA.escolaNome)

    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('main')).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })

    // A janela que importa: a lista de B segurada desde antes da troca. É nela que a turma de A apareceria se tivesse
    // ficado no cliente — depois que a resposta de B chega, a ausência já não prova nada. A rota entra antes da troca
    // porque a Nova conversa de B já lê os vínculos: segurada só depois, a de Turmas saía do cache, sem janela (falhou
    // assim no celular, esteira `37250031803`).
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_MEUS_VINCULOS, async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })

    await abrirSeletorDeEscola(page, hasTouch)
    await esperarAlvoDeToque(linhaDoSeletor(page, nomeNoSeletor(emB, 'professor')), 'a escola de destino no seletor')
    await acionarNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)

    // A troca volta à tela em que o professor abre, já da escola de destino, com a lista de B ainda a caminho.
    await esperarEscola(page, 'Professora sintética na outra escola', emB.escolaNome)
    expect(new URL(page.url()).pathname).toBe('/professor/nova-conversa')
    await expect(page.getByText('Carregando as suas turmas…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Sem o esvaziamento do cache na troca, a turma de A continuaria no cliente e apareceria na tela de B. O nome da
    // escola A segue no seletor, e só nele: ele é um acesso da própria conta, e não dado da escola A.
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)
    await expect(page.locator('body')).not.toContainText(emA.nome)

    // E nem voltando pelo histórico: o que saiu do cliente não volta.
    await page.goBack()
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })

    // Voltar aos vínculos, já em B, com a lista ainda segurada.
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('Carregando as suas turmas…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)
    liberar()
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)
  })

  test('o aluno não tem seletor nem vínculos: a conta dele é só da escola dele', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await page.goto(`/e/${aluno.slug}`)
    await page.getByLabel('Matrícula').fill(aluno.matricula)
    await campoSenha(page).fill(aluno.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    await esperarEscolaDoAluno(page, aluno.nome, aluno.escolaNome)

    // O aluno entra por matrícula e não tem conta (regra 20, item 2): não há outra escola para listar, e é por isso
    // que a troca de escola nunca começa por ele. A lateral diz só onde ele está.
    await abrirNavegacao(page, hasTouch)
    await expect(botaoDoSeletor(page)).toHaveCount(0)
    await expect(lateral(page).getByRole('button', { expanded: false })).toHaveCount(0)
    await expect(lateral(page)).toContainText(`Escola: ${aluno.escolaNome}`)
    // Vínculo é do professor: o aluno não confirma turma nenhuma (RF4); os itens dele são Início, Tarefas e Eu (X4, 2.0; W2).
    await expect(page.getByRole('link', { name: 'Turmas', exact: true })).toHaveCount(0)
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Tarefas', 'Eu'])
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('isolamento: a troca que passa pelo segundo fator também não leva nada da escola de origem para a de destino', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'coordenador')
    const alocacao = await criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId)

    // Primeiro acesso: ela escolhe a escola onde coordena e configura o segundo fator, que a partir daí é da conta.
    const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
    await page.goto('/entrar')
    await entrarPorEmail(page, emA, hasTouch)
    await acionar(page, `${emB.escolaNome} · coordenação`, hasTouch)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }
    await page.getByLabel(/Código do aplicativo|Digite o código que o aplicativo mostra/).fill(codigoDoAutenticador(segredo))
    await acionar(page, /Ativar o segundo fator|Ativando/, hasTouch)
    await acionar(page, 'Ir para a entrada', hasTouch, 'link')

    // Agora ela entra na escola onde dá aula, e carrega os vínculos dela lá.
    await entrarPorEmail(page, emA, hasTouch)
    await acionar(page, `${emA.escolaNome} · professor`, hasTouch)
    await esperarEscola(page, emA.nome, emA.escolaNome)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('main')).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })

    // E troca para a escola onde coordena. A sessão de origem continua valendo até o código ser aceito: é por isso
    // que esvaziar o cache aqui, antes do token de destino, traria de volta o dado da escola de origem — com a
    // credencial dela, que ainda funciona (regra 10, item 1).
    await abrirSeletorDeEscola(page, hasTouch)
    await acionarNoSeletor(page, nomeNoSeletor(emB, 'coordenação'), hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByLabel('Código do aplicativo').fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
    await acionar(page, /^Entrar$|Entrando/, hasTouch)

    // Na escola onde coordena, ela abre em Governança (A5), com a escola de destino no seletor.
    await esperarPainel(page)
    await expect(page.locator('body')).toContainText(emB.escolaNome)
    // Nada da escola onde ela dá aula pode aparecer dentro da escola onde ela coordena. O nome de A segue só no
    // seletor, que é acesso da própria conta.
    await expect(page.getByRole('main')).not.toContainText(emA.escolaNome)
    await expect(page.locator('body')).not.toContainText(alocacao.turmaNome)
    await expect(page.locator('body')).not.toContainText(emA.nome)
  })

  test('trocar para uma escola onde ela coordena passa pelo segundo fator antes de qualquer sessão nova', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'coordenador')

    await page.goto('/entrar')
    await entrarPorEmail(page, emA, hasTouch)
    await acionar(page, `${emA.escolaNome} · professor`, hasTouch)
    await esperarEscola(page, emA.nome, emA.escolaNome)

    await abrirSeletorDeEscola(page, hasTouch)
    await acionarNoSeletor(page, nomeNoSeletor(emB, 'coordenação'), hasTouch)

    // Coordenar exige o segundo fator sempre, mesmo vindo de uma sessão já aberta (Tech Spec, seção 5).
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/mfa\/configurar$/)
    await expect(page.locator('body')).not.toContainText(emB.escolaNome)
  })

  test('quem entrou pela conta da escola não troca por aqui: o seletor explica e oferece a entrada por e-mail', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await liberarProvedorDaEscola(emA.escolaId, 'google', DOMINIO_DA_ESCOLA)
    await ligarContaExterna(emA.escolaId, emA.usuarioId, { provedor: 'google', sujeito: SUJEITO_NO_PROVEDOR })

    await page.goto(`/e/${emA.slug}`)
    await acionar(page, /Entrar com a conta Google/, hasTouch, 'link')
    await entrarNoProvedorFalso(page, CONTA_NO_PROVEDOR)
    await esperarNovaConversa(page, emA.nome, { timeout: PRAZO_DO_LOGIN_EXTERNO_MS })

    await abrirSeletorDeEscola(page, hasTouch)
    await acionarNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)

    // A API recusa a troca de uma sessão que não é de e-mail, e a tela diz o que fazer em vez de mostrar o código.
    await expect(page.getByRole('alert')).toContainText(AVISO_DA_TROCA_RECUSADA, { timeout: PRAZO_DA_ENTRADA_MS })
    for (const proibido of ['NAO_ENCONTRADO', codigoCru('404')]) await expect(page.locator('body')).not.toContainText(proibido)
    // E continua na escola em que estava, com a sessão de pé.
    await esperarEscola(page, emA.nome, emA.escolaNome)
  })
})

test.describe('vínculos do professor', () => {
  test('duas disciplinas na mesma turma: confirma uma, contesta a outra, e cada uma fica no seu estado, em texto', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática', 'História'])

    await abrirJaEntrando(page, professora, '/professor/turmas')

    const matematica = page.getByRole('listitem').filter({ hasText: 'Matemática' })
    const historia = page.getByRole('listitem').filter({ hasText: 'História' })
    // Cada vínculo que espera a professora é uma faixa "Confirme sua turma", com a turma e a disciplina, e ainda não é cartão de turma.
    await expect(matematica).toContainText(`Confirme sua turma · ${alocacao.turmaNome} · Matemática`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(historia).toContainText(`Confirme sua turma · ${alocacao.turmaNome} · História`)
    await expect(page.getByRole('region', { name: 'Suas turmas', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
    await esperarAlvoDeToque(matematica.getByRole('button', { name: 'Confirmar' }), 'o botão de confirmar o vínculo')
    expect(await larguraExcedente(page)).toBe(0)

    // Confirma só a de matemática: ela vira cartão, e a outra continua na faixa.
    if (hasTouch) await matematica.getByRole('button', { name: 'Confirmar' }).tap()
    else await matematica.getByRole('button', { name: 'Confirmar' }).click()
    await expect(matematica).toContainText(NOME_DO_ESTADO_DE_VINCULO.confirmado, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(historia).toContainText('Confirme sua turma')

    // Contesta a de história, no painel ao lado, com o motivo e o complemento.
    if (hasTouch) await historia.getByRole('button', { name: 'Contestar' }).tap()
    else await historia.getByRole('button', { name: 'Contestar' }).click()
    const painel = page.getByRole('dialog', { name: 'Contestar a turma' })
    await expect(painel).toBeVisible()
    // O texto livre é lido pela coordenação: a tela avisa, ali mesmo, para não escrever nome de aluno (regra 20).
    await expect(painel).toContainText(AVISO_DO_COMPLEMENTO)
    // Ação oficial: o que vai acontecer aparece antes de enviar (regra 50, item 8).
    await expect(painel).toContainText(EFEITO_DA_CONTESTACAO)

    await painel.getByRole('radio', { name: NOME_DA_CONTESTACAO.nao_leciono }).check()
    await painel.getByRole('textbox').fill('Quem dá história nesta turma é o outro professor.')
    expect(await violacoesGraves(page)).toEqual([])
    expect(await larguraExcedente(page)).toBe(0)
    if (hasTouch) await painel.getByRole('button', { name: 'Enviar a contestação' }).tap()
    else await painel.getByRole('button', { name: 'Enviar a contestação' }).click()

    await expect(painel).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(historia).toContainText(NOME_DO_ESTADO_DE_VINCULO.contestado, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(historia).toContainText(NOME_DA_CONTESTACAO.nao_leciono)
    // O contestado espera a coordenação: sai da faixa e não abre a turma.
    await expect(page.getByRole('region', { name: 'Confirme suas turmas', exact: true })).toHaveCount(0)
    await expect(historia.getByRole('link', { name: /Abrir a turma/ })).toHaveCount(0)
    // O estado de cada um é o seu: confirmar um não decide o outro (caso de borda do PRD).
    await expect(matematica).toContainText(NOME_DO_ESTADO_DE_VINCULO.confirmado)
  })

  test('o cartão se resolve inteiro pelo teclado: Tab até o botão, motivo com a barra de espaço e Enter para enviar', async ({ page }) => {
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática'])

    await abrirJaEntrando(page, professora, '/professor/turmas')
    await expect(page.getByRole('main')).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })

    // Abre a contestação sem tocar no mouse: ela abre no painel ao lado, e o foco entra nele.
    await tabAte(page, page.getByRole('button', { name: 'Contestar' }), 'o botão de contestar')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Contestar a turma' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'O que está errado neste vínculo?' })).toBeVisible()

    // Escolhe o motivo pelo teclado: o grupo de rádio começa sem nada marcado, e a barra de espaço marca o focado.
    const primeiroMotivo = page.getByRole('radio', { name: NOME_DA_CONTESTACAO.nao_leciono })
    await tabAte(page, primeiroMotivo, 'o primeiro motivo da contestação')
    await page.keyboard.press('Space')
    await expect(primeiroMotivo).toBeChecked()

    await tabAte(page, page.getByRole('textbox'), 'o complemento da contestação')
    await page.keyboard.type('Nunca dei aula nesta turma.')
    await tabAte(page, page.getByRole('button', { name: 'Enviar a contestação' }), 'o botão de enviar a contestação')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('main')).toContainText(NOME_DO_ESTADO_DE_VINCULO.contestado, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText(NOME_DA_CONTESTACAO.nao_leciono)
    // O painel fechou, e o foco foi para onde o cartão entrou: quem usa o teclado não volta ao topo da página.
    await expect(page.getByRole('dialog', { name: 'Contestar a turma' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Suas turmas' })).toBeFocused()
  })

  test('contestar sem escolher o motivo não manda nada, e o clique repetido em confirmar não decide duas vezes', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática', 'História'])

    let contestacoes = 0
    await page.route(ROTA_CONTESTAR, async (rota: Route) => {
      contestacoes++
      await rota.continue()
    })
    let confirmacoes = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_CONFIRMAR, async (rota: Route) => {
      confirmacoes++
      await segurada
      await rota.continue()
    })

    await abrirJaEntrando(page, professora, '/professor/turmas')

    const historia = page.getByRole('listitem').filter({ hasText: 'História' })
    await expect(historia).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    if (hasTouch) await historia.getByRole('button', { name: 'Contestar' }).tap()
    else await historia.getByRole('button', { name: 'Contestar' }).click()
    const painel = page.getByRole('dialog', { name: 'Contestar a turma' })
    await painel.getByRole('textbox').fill('sem motivo escolhido')
    if (hasTouch) await painel.getByRole('button', { name: 'Enviar a contestação' }).tap()
    else await painel.getByRole('button', { name: 'Enviar a contestação' }).click()
    // Contestação sem código não é contestação: a coordenação receberia um vínculo travado e sem motivo.
    await expect(painel).toBeVisible()
    expect(contestacoes).toBe(0)
    if (hasTouch) await painel.getByRole('button', { name: 'Cancelar' }).tap()
    else await painel.getByRole('button', { name: 'Cancelar' }).click()
    await expect(painel).toHaveCount(0)
    await expect(historia).toContainText('Confirme sua turma')

    const matematica = page.getByRole('listitem').filter({ hasText: 'Matemática' })
    const confirmar = matematica.getByRole('button', { name: /Confirmar|Confirmando/ })
    if (hasTouch) await confirmar.tap()
    else await confirmar.click()
    await expect(confirmar).toBeDisabled()
    // Duas confirmações do mesmo vínculo são duas decisões oficiais registradas com autor e data.
    await confirmar.dispatchEvent('click')
    liberar()
    await expect(matematica).toContainText(NOME_DO_ESTADO_DE_VINCULO.confirmado, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(confirmacoes).toBe(1)
  })

  /** A professora entra pela API e abre as Turmas; a primeira carga não afirma nada sobre o tempo de baixar (`carregarSemRedeLenta`). */
  async function abrirTurmasDaProfessora(page: Page, professora: EquipeDeTeste, hasTouch: boolean): Promise<void> {
    await carregarSemRedeLenta(page, async () => {
      await entrarPelaApi(page, professora, '/professor/nova-conversa')
      await esperarEscola(page, professora.nome, professora.escolaNome)
    })
    await irPelaNavegacao(page, 'Turmas', hasTouch)
  }

  // Os quatro estados em dois casos: com a entrada pela tela, a leitura segurada e as varreduras do axe, um só levava 23 s
  // (chromebook) e 24,7 s (celular) aqui, contra os 30 s que o runner da esteira leva em dobro.
  test('os estados sem lista: carregando, erro com nova tentativa e vazio convidando a falar com a coordenação', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()

    let segurar = true
    let falhar = false
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_MEUS_VINCULOS, async (rota: Route) => {
      if (segurar) await segurada
      if (falhar) {
        return rota.fulfill({
          status: 503,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
        })
      }
      return rota.continue()
    })

    await abrirTurmasDaProfessora(page, professora, hasTouch)

    // Carregando.
    await expect(page.getByText('Carregando as suas turmas…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Erro: a tela fica de pé e oferece tentar de novo (regra 80, item 6).
    falhar = true
    liberar()
    await expect(page.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

    // Vazio: a professora ainda não foi alocada, e o vazio diz o que fazer.
    falhar = false
    segurar = false
    await acionar(page, 'Tentar de novo', hasTouch)
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText('fale com ela')
    // Sem lista, o que resta na ordem de foco é a casca, e ela continua alcançável com foco visível.
    await tabAte(page, page.getByRole('button', { name: 'Sair' }), 'o "Sair" da casca')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o estado com a lista: carregando a leitura das turmas e depois a turma alocada pela coordenação', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    // A coordenação alocou antes de a professora abrir as Turmas: a lista vem na primeira busca.
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId)

    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_MEUS_VINCULOS, async (rota: Route) => {
      await segurada
      return rota.continue()
    })

    await abrirTurmasDaProfessora(page, professora, hasTouch)
    await expect(page.getByText('Carregando as suas turmas…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    liberar()
    await expect(page.getByRole('main')).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
