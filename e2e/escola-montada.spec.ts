import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page } from '@playwright/test'
import { exibirCodigoDaTurma } from '../packages/shared/src/sala/acesso.ts'
import type { AcessoGeradoResponse } from '../packages/shared/src/sala/acesso.ts'
import { entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, abrirEstrutura, irPelaNavegacao, PRAZO_DA_ENTRADA_MS, passarPelaIntroducaoDoAluno, passarPelaIntroducaoDoProfessor, abrirAbaAlunos } from './__fixtures__/casca.ts'
import { irPelaCoordenacao, painelDoAno } from './__fixtures__/coordenacao.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { alunosDaTurmaNoBanco, criarEquipeComSenha, montarEstruturaNoBanco, porNaListaDaTurma } from './__fixtures__/sessao.ts'
import { larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * W1 (A1, tarefa 17.0; `tasks/prd-apresentacao-escola/cenarios.md`; RF1 e RF18): o fluxo inteiro, da escola vazia ao
 * aluno aprovado, só pela tela, nos projetos `chromebook` e `celular`. A coordenação monta ano, série, disciplina, turma,
 * lista, professor e alocação; o professor aceita o convite, confirma o vínculo e gera o acesso; a aluna pede o nome pelo
 * código; o professor aprova; a aluna entra e vê só a própria turma. Cada pessoa no seu navegador, como na escola. Nomes,
 * matrículas e e-mails gerados pelo teste.
 */

const SENHA_DO_PROFESSOR = 'senha do professor sintético'
const SENHA_DA_ALUNA = 'a frase que só a aluna sabe'

const principal = (page: Page) => page.getByRole('main')
/** O diálogo de formulário ou de confirmação, e não o painel (o painel do ano letivo guarda o diálogo que abre por cima dele). */
const dialogo = (page: Page) => page.locator('dialog[open]:not([data-painel-lado])')
const anuncio = (lugar: Locator, texto: string) => lugar.getByRole('status').filter({ hasText: texto })

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Um botão pelo nome exato, dentro de um lugar. */
const botao = (lugar: Locator, nome: string) => lugar.getByRole('button', { name: nome, exact: true })

/** A tela sem violação grave de acessibilidade e sem rolagem horizontal. */
async function conferirTela(page: Page): Promise<void> {
  expect(await violacoesGraves(page)).toEqual([])
  expect(await larguraExcedente(page)).toBe(0)
}

const contextos: BrowserContext[] = []
/** Outro navegador, com as opções do projeto: o computador do professor, o da aluna. */
async function outroNavegador(browser: Browser): Promise<Page> {
  const uso = test.info().project.use
  const opcoes: BrowserContextOptions = {}
  if (uso.baseURL !== undefined) opcoes.baseURL = uso.baseURL
  if (uso.viewport !== undefined) opcoes.viewport = uso.viewport
  if (uso.isMobile !== undefined) opcoes.isMobile = uso.isMobile
  if (uso.hasTouch !== undefined) opcoes.hasTouch = uso.hasTouch
  if (uso.userAgent !== undefined) opcoes.userAgent = uso.userAgent
  if (uso.deviceScaleFactor !== undefined) opcoes.deviceScaleFactor = uso.deviceScaleFactor
  if (uso.locale !== undefined) opcoes.locale = uso.locale
  if (uso.timezoneId !== undefined) opcoes.timezoneId = uso.timezoneId
  const contexto = await browser.newContext(opcoes)
  contextos.push(contexto)
  return contexto.newPage()
}

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
})

test('W1: da escola vazia à aluna aprovada, só pela tela — a coordenação monta, o professor aceita e gera o acesso, a aluna pede o nome pelo código, o professor aprova, e a aluna entra e vê só a turma dela', async ({
  page,
  browser,
  hasTouch,
}) => {
  test.setTimeout(240_000)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const marca = randomUUID().slice(0, 8)
  const turma = `7A ${marca}`
  const disciplina = `Matemática ${marca}`
  const professorNome = `Professor sintético ${marca}`
  const professorEmail = `prof-w1-${marca}@educa.invalid`
  const aluna = { nome: `Aluna sintética ${marca}`, matricula: `W1A-${marca}` }
  const colega = { nome: `Colega sintético ${marca}`, matricula: `W1B-${marca}` }

  // A coordenação, na escola como o painel da operação a cria: sem ano letivo, sem nada.
  const coordenadora = await criarEquipeComSenha('coordenador', { semAnoLetivo: true })
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
  await abrirEstrutura(page, hasTouch)
  await expect(principal(page).getByText('Comece pelo ano letivo')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

  // Ano letivo, aberto.
  await acionar(botao(principal(page), 'Criar o ano letivo'), hasTouch)
  await dialogo(page).getByLabel('Ano').fill('2026')
  await dialogo(page).getByLabel('Início').fill('2026-02-02')
  await dialogo(page).getByLabel('Fim').fill('2026-12-11')
  await acionar(botao(dialogo(page), 'Criar ano letivo'), hasTouch)
  await expect(dialogo(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
  // O ano criado a partir do vazio abre o painel dele, e é nele que o ano se abre e que a série e a disciplina nascem.
  await expect(painelDoAno(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(principal(page), 'Abrir o ano letivo 2026'), hasTouch)
  await expect(principal(page)).toContainText('Em curso', { timeout: PRAZO_DA_ENTRADA_MS })

  // Série, disciplina e turma.
  await acionar(botao(principal(page), 'Nova série'), hasTouch)
  await dialogo(page).getByLabel('Série').selectOption({ label: '7º ano do Ensino Fundamental' })
  await acionar(botao(dialogo(page), 'Criar série'), hasTouch)
  await expect(dialogo(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(principal(page), 'Nova disciplina'), hasTouch)
  await dialogo(page).getByLabel('Nome da disciplina').fill(disciplina)
  await acionar(botao(dialogo(page), 'Criar disciplina'), hasTouch)
  await expect(dialogo(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(painelDoAno(page), 'Fechar'), hasTouch)
  await expect(painelDoAno(page)).toHaveCount(0)
  await acionar(botao(principal(page), 'Nova turma'), hasTouch)
  await dialogo(page).getByLabel('Nome da turma').fill(turma)
  await acionar(botao(dialogo(page), 'Criar turma'), hasTouch)
  await expect(dialogo(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(turma)
  await conferirTela(page)

  // A lista de nomes da turma, colada.
  await acionar(principal(page).getByRole('link', { name: `Lista de nomes da turma ${turma}` }), hasTouch)
  await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await principal(page).getByLabel('Lista colada').fill(`nome;matrícula\n${aluna.nome};${aluna.matricula}\n${colega.nome};${colega.matricula}\n`)
  await acionar(botao(principal(page), 'Ver a prévia'), hasTouch)
  const previa = principal(page).getByRole('region', { name: 'Prévia' })
  await expect(previa.getByRole('status')).toHaveText('2 nomes entram · 0 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(previa, 'Gravar lista'), hasTouch)
  await expect(anuncio(principal(page).getByRole('region', { name: 'Nomes da turma' }), '2 nomes gravados na lista.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

  // O professor, com o convite de cópia única.
  await irPelaCoordenacao(page, 'Professores', hasTouch)
  await acionar(botao(principal(page), 'Cadastrar professor'), hasTouch)
  await dialogo(page).getByLabel('Nome do professor').fill(professorNome)
  await dialogo(page).getByLabel('E-mail do professor').fill(professorEmail)
  await acionar(botao(dialogo(page), 'Revisar'), hasTouch)
  await acionar(botao(dialogo(page), 'Cadastrar e gerar o link'), hasTouch)
  const campoDoConvite = dialogo(page).getByLabel('Link do convite')
  await expect(campoDoConvite).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  const linkDoConvite = await campoDoConvite.inputValue()
  await acionar(botao(dialogo(page), 'Copiar link'), hasTouch)
  await acionar(botao(dialogo(page), 'Fechar'), hasTouch)
  await expect(dialogo(page)).toHaveCount(0)
  await conferirTela(page)

  // A alocação vem antes do aceite: o vínculo espera o professor confirmar (E12). Ela é o "Acrescentar turma" do painel do professor
  // (7.0), que a linha dele abre em Professores.
  await acionar(botao(principal(page), professorNome), hasTouch)
  const painelDoProfessor = page.getByRole('dialog', { name: professorNome })
  await acionar(botao(painelDoProfessor, 'Acrescentar turma'), hasTouch)
  await dialogo(page).getByLabel('Turma').selectOption({ label: turma }, { timeout: PRAZO_DA_ENTRADA_MS })
  await dialogo(page).getByLabel('Disciplina').selectOption({ label: disciplina })
  await acionar(botao(dialogo(page), 'Acrescentar'), hasTouch)
  await expect(painelDoProfessor.getByRole('list', { name: 'Turmas do professor' })).toContainText('Esperando o professor confirmar', { timeout: PRAZO_DA_ENTRADA_MS })

  // O professor, no computador dele: aceita o convite, cria a senha, entra e confirma a turma.
  const professor = await outroNavegador(browser)
  await professor.goto(linkDoConvite)
  await acionar(botao(principal(professor), 'Aceitar o convite'), hasTouch)
  await professor.getByLabel('Senha nova').fill(SENHA_DO_PROFESSOR, { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(principal(professor), 'Definir a senha e continuar'), hasTouch)
  await expect(professor).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
  await entrarPorEmail(professor, { ...coordenadora, email: professorEmail, senha: SENHA_DO_PROFESSOR }, hasTouch)
  // Aceito o convite, o professor ainda não viu a introdução: ela é a primeira coisa que encontra (X4, 10.0).
  await passarPelaIntroducaoDoProfessor(professor, professorNome, hasTouch)
  await irPelaNavegacao(professor, 'Turmas', hasTouch)
  const paraConfirmar = principal(professor).getByRole('region', { name: 'Confirme suas turmas', exact: true })
  await expect(paraConfirmar).toContainText(turma, { timeout: PRAZO_DA_ENTRADA_MS })
  // O vínculo nasceu pendente: até ele confirmar, a turma não abre (regra 60, item 8a).
  await expect(principal(professor).getByRole('link', { name: `Abrir a turma ${turma}` })).toHaveCount(0)
  await acionar(paraConfirmar.getByRole('listitem').filter({ hasText: turma }).getByRole('button', { name: 'Confirmar' }), hasTouch)
  await acionar(principal(professor).getByRole('link', { name: `Abrir a turma ${turma}` }), hasTouch)
  // O acesso dos alunos e os pedidos ficam na aba "Alunos" da turma aberta (A3).
  await abrirAbaAlunos(professor, hasTouch)

  // O acesso dos alunos: o código que ele projeta na lousa.
  const acesso = principal(professor).getByRole('region', { name: 'Acesso dos alunos' })
  await acionar(botao(acesso, 'Convidar alunos'), hasTouch)
  const respostaDoGerar = professor.waitForResponse((resposta) => /^\/v1\/turmas\/[^/]+\/acesso$/.test(new URL(resposta.url()).pathname) && resposta.request().method() === 'POST')
  await acionar(botao(dialogo(professor), 'Gerar acesso'), hasTouch)
  const gerado = (await (await respostaDoGerar).json()) as AcessoGeradoResponse
  await expect(dialogo(professor).getByRole('group', { name: 'Código da turma' })).toContainText(exibirCodigoDaTurma(gerado.codigo), { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(dialogo(professor), 'Fechar'), hasTouch)
  await acionar(botao(dialogo(professor), 'Fechar sem copiar'), hasTouch)
  await expect(dialogo(professor)).toHaveCount(0)
  await conferirTela(professor)

  // Outra turma da escola, com um aluno na lista: nada dela pode aparecer para a aluna.
  const outra = await montarEstruturaNoBanco(coordenadora.escolaId, ['8B'])
  const outraTurma = outra.turmas[0]
  if (outraTurma === undefined) throw new Error('estrutura sem turma')
  const daOutraTurma = `Aluno da outra turma ${marca}`
  await porNaListaDaTurma(coordenadora.escolaId, outraTurma.id, [{ nome: daOutraTurma, matricula: `W1C-${marca}` }])

  // A aluna, no computador da escola: digita o código como está na lousa, escolhe o nome, a matrícula e a senha.
  const alunaNaTela = await outroNavegador(browser)
  await alunaNaTela.goto(`/e/${coordenadora.slug}/turma`)
  await principal(alunaNaTela).getByLabel('Código da turma').fill(exibirCodigoDaTurma(gerado.codigo))
  await acionar(botao(principal(alunaNaTela), 'Abrir a turma'), hasTouch)
  await expect(principal(alunaNaTela).getByRole('heading', { level: 2, name: `Turma ${turma}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(principal(alunaNaTela).getByRole('radio')).toHaveCount(2)
  await acionar(principal(alunaNaTela).getByRole('radio', { name: aluna.nome }), hasTouch)
  await principal(alunaNaTela).getByLabel('Matrícula').fill(aluna.matricula)
  await principal(alunaNaTela).getByLabel('Crie uma senha').fill(SENHA_DA_ALUNA)
  await acionar(botao(principal(alunaNaTela), 'Enviar pedido'), hasTouch)
  await expect(principal(alunaNaTela).getByRole('heading', { name: 'Pedido enviado' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await conferirTela(alunaNaTela)

  // Antes da aprovação, a entrada responde como senha errada: é o que a tela do pedido avisou.
  await acionar(principal(alunaNaTela).getByRole('link', { name: 'Ir para a entrada da escola' }), hasTouch)
  await alunaNaTela.getByLabel('Matrícula').fill(aluna.matricula)
  await alunaNaTela.getByLabel('Senha', { exact: true }).fill(SENHA_DA_ALUNA)
  await acionar(alunaNaTela.getByRole('button', { name: /^Entrar$/ }), hasTouch)
  await expect(alunaNaTela.getByRole('alert')).toHaveText('Matrícula ou senha incorretas. Confira as duas e tente de novo.', { timeout: PRAZO_DA_ENTRADA_MS })
  expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, await idDaTurma(professor))).toBe(0)

  // O professor aprova o pedido, conferindo o nome.
  await professor.reload()
  await abrirAbaAlunos(professor, hasTouch)
  const pedidos = principal(professor).getByRole('region', { name: 'Pedidos de nome' })
  await acionar(pedidos.getByRole('checkbox', { name: aluna.nome }), hasTouch)
  await acionar(botao(pedidos, 'Aprovar 1 pedido'), hasTouch)
  await expect(dialogo(professor)).toContainText(`Você vai aprovar 1 pedido da turma ${turma}.`)
  await acionar(botao(dialogo(professor), 'Aprovar 1 pedido'), hasTouch)
  await expect(dialogo(professor)).toContainText('Aprovado: já pode entrar com a matrícula e a senha', { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(botao(dialogo(professor), 'Fechar'), hasTouch)
  expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, await idDaTurma(professor))).toBe(1)

  // A aluna entra com a matrícula e a senha que criou, e vê só a turma dela, sem colega.
  await acionar(alunaNaTela.getByRole('button', { name: /^Entrar$/ }), hasTouch)
  // Aprovada pela tela, a aluna ainda não viu a introdução: ela é a primeira coisa que encontra (X4, 9.0).
  await passarPelaIntroducaoDoAluno(alunaNaTela, aluna.nome, hasTouch)
  await irPelaNavegacao(alunaNaTela, 'Eu', hasTouch)
  // Em Eu, a turma fica na linha de apoio do título, junto da série e da escola, e não em um título próprio.
  await expect(principal(alunaNaTela).locator('header').getByText(turma)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(principal(alunaNaTela)).toContainText(coordenadora.escolaNome)
  await expect(alunaNaTela.locator('body')).not.toContainText(colega.nome)
  await expect(alunaNaTela.locator('body')).not.toContainText(colega.matricula)
  await expect(alunaNaTela.locator('body')).not.toContainText(outraTurma.nome)
  await expect(alunaNaTela.locator('body')).not.toContainText(daOutraTurma)
  await conferirTela(alunaNaTela)
})

/** O id da turma aberta pelo professor, tirado do endereço dela. */
async function idDaTurma(professor: Page): Promise<string> {
  const id = new URL(professor.url()).pathname.split('/').at(-1)
  if (id === undefined || id === '') throw new Error('o professor não está numa turma aberta')
  return id
}
