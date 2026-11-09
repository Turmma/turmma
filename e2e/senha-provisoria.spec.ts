import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { abrirNavegacao, entrarPelaApiSemMedirAPrimeiraCarga, esperarNovaConversa, entrarPorEmail, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { activate, principal } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { queryCache } from './support/query-cache.ts'
import {
  colocarAlunoNaTurma,
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarAlunoComMatricula,
  criarEquipeComSenha,
  ligarContaExterna,
  matricularAlunosNaTurmaNoBanco,
  montarEstruturaNoBanco,
  type AlunoDeTeste,
  type AlocacaoDeTeste,
  type EquipeDeTeste,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A tela "Gerar senha provisória" (acesso-e-convites, 12.0; RF13, RF18), pela tela, nos projetos `chromebook` e `celular`: o item no menu da linha do aluno aprovado, na aba Alunos
 * da turma do professor e na seção "Alunos aprovados" da turma aberta da coordenação; a confirmação que lê o aluno (nome, turma, matrícula) e a senha, uma vez, em dois grupos.
 * A sessão, a turma, os alunos e a API são os de verdade; só a resposta segurada ou recusada de um caso (`page.route`) é simulada. Cada caso entra pela API e paga uma carga de página
 * só (o portão reprova caso alterado acima de 15 s). Nomes, matrículas e e-mails inventados pelo teste.
 */

const PADRAO_DA_SENHA = /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/
const ENVELOPE = (codigo: string) => JSON.stringify({ erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_DO_ALUNO_QUE_SAIU = 'Este aluno não está mais na turma. A lista foi atualizada.'
const TEXTO_DA_CONTA_DA_ESCOLA = 'Este aluno entra pela conta da escola. Não precisa de senha.'

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const dialogoDaSenha = (page: Page): Locator => page.getByRole('dialog', { name: 'Gerar senha provisória' })
const botaoGerar = (page: Page): Locator => dialogoDaSenha(page).getByRole('button', { name: /^(Gerar senha provisória|Gerando…)$/ })
const ehOAlvo = (alunoId: string) => (url: URL) => url.pathname === `/v1/usuarios/${alunoId}/senha-provisoria`

/** A primeira geração do aluno é recusada com o envelope de erro dado; as seguintes passam ao servidor. */
async function recusarAPrimeiraGeracao(page: Page, usuarioId: string, status: number, codigo: string): Promise<void> {
  let recusadas = 0
  await page.route(ehOAlvo(usuarioId), (rota: Route) => {
    if (rota.request().method() !== 'POST' || recusadas > 0) return rota.fallback()
    recusadas += 1
    return rota.fulfill({ status, contentType: 'application/json', body: ENVELOPE(codigo) })
  })
}

interface CenarioDoProfessor {
  readonly professora: EquipeDeTeste
  readonly turma: AlocacaoDeTeste
  readonly primeira: AlunoDeTeste
  readonly segunda: AlunoDeTeste
  readonly nome: string
}

/**
 * A professora com a turma confirmada e dois alunos de **mesmo nome** nela, cada um com a sua matrícula (a primeira é a do aluno criado antes, que a lista traz antes). O aluno do menu
 * `nth(0)` é o `primeira`, e o `nth(1)`, o `segunda`: a lista os ordena por nome e, empatados, pelo id, que segue a criação.
 */
async function cenarioDoProfessor(): Promise<CenarioDoProfessor> {
  const marca = randomUUID().slice(0, 8)
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
  const nome = `Ana Souza ${marca}`
  const escola = { escolaId: professora.escolaId, escolaNome: professora.escolaNome, slug: professora.slug }
  const primeira = await criarAlunoComMatricula({ escola, nome, matricula: `A${marca}1` })
  const segunda = await criarAlunoComMatricula({ escola, nome, matricula: `A${marca}2` })
  const turmaDoAluno = { turmaId: turma.turmaId, turmaNome: turma.turmaNome, serieNome: '7º ano do Ensino Fundamental' }
  await colocarAlunoNaTurma(primeira, turmaDoAluno)
  await colocarAlunoNaTurma(segunda, turmaDoAluno)
  return { professora, turma, primeira, segunda, nome }
}

/** A professora entra pela API (o cookie fica na aba) e abre a aba Alunos, sem a rede lenta do perfil na primeira carga: o assunto é a senha, e não o tempo de abrir. */
async function abrirAAbaAlunos(page: Page, cenario: CenarioDoProfessor): Promise<void> {
  await entrarPelaApiSemMedirAPrimeiraCarga(page, cenario.professora, `/professor/turmas/${cenario.turma.turmaId}?aba=alunos`, () =>
    expect(menusDaLista(page, cenario.nome)).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS }),
  )
}

/** Os botões "Ações" das linhas do aluno de um nome: um por aluno, na ordem da lista. */
const menusDaLista = (page: Page, nome: string): Locator => principal(page).getByRole('region', { name: 'Por aluno' }).getByRole('button', { name: new RegExp(`^${nome}:?\\s*Ações$`) })

/** Abre o menu da linha e escolhe "Gerar senha provisória", sem esperar o diálogo: quando a leitura do alvo responde 404, ele fecha na hora. */
async function escolherASenha(page: Page, menu: Locator, hasTouch: boolean): Promise<void> {
  await activate(menu, hasTouch)
  await activate(page.getByRole('menuitem', { name: 'Gerar senha provisória' }), hasTouch)
}

/** O mesmo, e a confirmação abre: o aluno é lido. */
async function pedirASenha(page: Page, menu: Locator, hasTouch: boolean): Promise<void> {
  await escolherASenha(page, menu, hasTouch)
  await expect(dialogoDaSenha(page)).toBeVisible()
}

/** Gera e espera a senha: a que a tela mostra, em dois grupos. */
async function gerar(page: Page, hasTouch: boolean): Promise<string> {
  await activate(botaoGerar(page), hasTouch)
  const senha = dialogoDaSenha(page).locator('[data-senha-provisoria]')
  await expect(senha).toHaveText(PADRAO_DA_SENHA, { timeout: SIGN_IN_TIMEOUT_MS })
  return (await senha.innerText()).trim()
}

test.describe('RF13 e RF18: a senha provisória pela aba Alunos do professor', () => {
  test('gerar e mostrar: nome, turma e matrícula na confirmação; a senha em dois grupos, lida grupo a grupo, com "Copiar" e a validade; a senha abre a troca', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)

    await expect(dialogoDaSenha(page)).toContainText(cenario.nome)
    await expect(dialogoDaSenha(page)).toContainText(cenario.turma.turmaNome)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await expect(dialogoDaSenha(page)).toContainText('A senha atual deixa de valer, e o aluno sai da conta em todo lugar.')
    expect(await seriousViolations(page)).toEqual([])

    const senha = await gerar(page, hasTouch)
    // O leitor de tela ouve a senha grupo a grupo; os dois grupos, a validade e "Copiar".
    const [primeiroGrupo, segundoGrupo] = senha.split('-')
    await expect(dialogoDaSenha(page).locator('.sr-only').filter({ hasText: /^\S \S \S \S, \S \S \S \S$/ })).toHaveText(`${[...(primeiroGrupo ?? '')].join(' ')}, ${[...(segundoGrupo ?? '')].join(' ')}`)
    await expect(dialogoDaSenha(page)).toContainText(/Ela vale até \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} e aparece uma vez só/)
    await expect(dialogoDaSenha(page).getByRole('button', { name: 'Copiar' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])

    // A senha que a tela mostrou é a que vale: o login de matrícula a devolve como "trocar a senha", e a digitada sem o hífen também.
    const entrada = await page.request.post('/v1/sessao/matricula', { data: { slug: cenario.primeira.slug, matricula: cenario.primeira.matricula, senha: senha.replace('-', '') } })
    expect((await entrada.json()) as { etapa?: string }).toMatchObject({ etapa: 'trocar_senha' })
  })

  test('dois alunos de mesmo nome: a confirmação difere pela matrícula, e cancelar não gera nada', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    const geracoes: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname.endsWith('/senha-provisoria')) geracoes.push(pedido)
    })
    await abrirAAbaAlunos(page, cenario)

    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(0), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await expect(dialogoDaSenha(page)).not.toContainText(cenario.segunda.matricula)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(dialogoDaSenha(page)).toHaveCount(0)

    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(1), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.segunda.matricula)
    await expect(dialogoDaSenha(page)).not.toContainText(cenario.primeira.matricula)
    expect(geracoes).toHaveLength(0)
  })

  test('fechar sem copiar pergunta antes; copiar faz fechar sem pergunta', async ({ page, hasTouch, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    const senha = await gerar(page, hasTouch)

    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(dialogoDaSenha(page).getByRole('heading', { name: 'Fechar sem copiar a senha?' })).toBeVisible()
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Voltar à senha' }), hasTouch)
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveText(senha)

    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Copiar' }), hasTouch)
    await expect(dialogoDaSenha(page).getByText('Senha copiada.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(senha)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(dialogoDaSenha(page)).toHaveCount(0)
  })

  test('a senha fora do navegador: nada em localStorage, sessionStorage, endereço nem cache de consultas, e ela sai da tela ao fechar', async ({ page, hasTouch, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const cenario = await cenarioDoProfessor()
    const mensagensDoConsole: string[] = []
    page.on('console', (mensagem) => mensagensDoConsole.push(mensagem.text()))
    page.on('pageerror', (erro) => mensagensDoConsole.push(erro.message))
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    const senha = await gerar(page, hasTouch)

    const guardado = async () => JSON.stringify({ local: { ...(await page.evaluate(() => ({ ...window.localStorage }))) }, sessao: await page.evaluate(() => ({ ...window.sessionStorage })), endereco: page.url(), consultas: await queryCache(page), cookies: await page.evaluate(() => document.cookie) })
    // O controle: a senha está na tela, e é só lá que ela está; a matrícula também só passa pelo diálogo.
    await expect(dialogoDaSenha(page)).toContainText(senha)
    for (const segredo of [senha, senha.replace('-', ''), cenario.primeira.matricula]) expect(await guardado()).not.toContain(segredo)

    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Copiar' }), hasTouch)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(senha)
    await expect(page.locator('body')).not.toContainText(cenario.primeira.matricula)
    for (const segredo of [senha, cenario.primeira.matricula]) expect(await guardado()).not.toContain(segredo)
    // Nem o console da aba (o que a web escreve ao gerar, ao copiar e ao fechar) leva a senha, a matrícula ou o nome do aluno (regra 20, item 9).
    const doConsole = mensagensDoConsole.join('\n')
    for (const segredo of [senha, senha.replace('-', ''), cenario.primeira.matricula, cenario.nome]) expect(doConsole).not.toContain(segredo)
  })

  test('as falhas: CONFLITO (a geração de menos de 10 s antes) e 429, cada uma com o aviso que sai na nova tentativa', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)

    // A regra dos 10 s é do servidor e já está provada na integração: aqui só a tela, com o 409 do envelope. A confirmação continua, e a nova tentativa (a segunda resposta é a de verdade) tira o aviso.
    await recusarAPrimeiraGeracao(page, cenario.primeira.usuarioId, 409, 'CONFLITO')
    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(0), hasTouch)
    await activate(botaoGerar(page), hasTouch)
    await expect(dialogoDaSenha(page).getByRole('alert')).toHaveText('Esta senha acabou de ser gerada. Espere alguns segundos para gerar outra.')
    await expect(botaoGerar(page)).toBeEnabled()
    await activate(botaoGerar(page), hasTouch)
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveText(PADRAO_DA_SENHA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogoDaSenha(page).getByRole('alert')).toHaveCount(0)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar sem copiar' }), hasTouch)

    // O 429 vem do limite de quem gera, no outro aluno.
    await recusarAPrimeiraGeracao(page, cenario.segunda.usuarioId, 429, 'LIMITE_EXCEDIDO')
    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(1), hasTouch)
    await activate(botaoGerar(page), hasTouch)
    await expect(dialogoDaSenha(page).getByRole('alert')).toHaveText('Muitas tentativas. Espere alguns minutos e tente de novo.')
    await expect(botaoGerar(page)).toBeEnabled()
    await activate(botaoGerar(page), hasTouch)
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveText(PADRAO_DA_SENHA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogoDaSenha(page).getByRole('alert')).toHaveCount(0)
  })

  test('a confirmação carrega com "Gerar" ocupado, e a geração com o botão ocupado', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    const leitura = gate()
    const geracao = gate()
    await page.route(ehOAlvo(cenario.primeira.usuarioId), async (rota: Route) => {
      if (rota.request().method() === 'GET') await leitura.aberta
      else await geracao.aberta
      return rota.fallback()
    })
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)

    await expect(dialogoDaSenha(page).getByText('Carregando…')).toBeVisible()
    await expect(botaoGerar(page)).toBeDisabled()
    await expect(botaoGerar(page)).toHaveAttribute('aria-busy', 'true')
    leitura.abrir()
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await expect(botaoGerar(page)).toBeEnabled()

    await activate(botaoGerar(page), hasTouch)
    await expect(botaoGerar(page)).toHaveText('Gerando…')
    await expect(botaoGerar(page)).toBeDisabled()
    geracao.abrir()
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveText(PADRAO_DA_SENHA, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('o aluno que entra pela conta da escola: o aviso já na confirmação, sem "Gerar", e nenhuma geração', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    const [daConta] = await matricularAlunosNaTurmaNoBanco(cenario.professora.escolaId, cenario.turma.turmaId, [`Bia Da Conta ${randomUUID().slice(0, 8)}`])
    if (daConta === undefined) throw new Error('faltou o aluno da conta da escola')
    await ligarContaExterna(cenario.professora.escolaId, daConta.usuarioId, { provedor: 'google', sujeito: `sujeito-${randomUUID()}` })
    const geracoes: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname.endsWith('/senha-provisoria')) geracoes.push(pedido)
    })
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, principal(page).getByRole('region', { name: 'Por aluno' }).getByRole('button', { name: new RegExp(`^${daConta.nome}:?\\s*Ações$`) }), hasTouch)

    await expect(dialogoDaSenha(page)).toContainText(TEXTO_DA_CONTA_DA_ESCOLA)
    await expect(dialogoDaSenha(page)).toContainText(daConta.nome)
    await expect(dialogoDaSenha(page).getByRole('button', { name: 'Gerar senha provisória' })).toHaveCount(0)
    await expect(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' })).toBeVisible()
    expect(geracoes).toHaveLength(0)
  })

  test('o aluno que sumiu da turma: o 404 da leitura e o da geração fecham a confirmação com o aviso, e a lista é lida de novo', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    const leiturasDaLista: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'GET' && new URL(pedido.url()).pathname === `/v1/turmas/${cenario.turma.turmaId}/alunos`) leiturasDaLista.push(pedido)
    })
    let metodoQueFalha: 'GET' | 'POST' = 'GET'
    await page.route(ehOAlvo(cenario.primeira.usuarioId), (rota: Route) =>
      rota.request().method() === metodoQueFalha ? rota.fulfill({ status: 404, contentType: 'application/json', body: ENVELOPE('NAO_ENCONTRADO') }) : rota.fallback(),
    )
    await abrirAAbaAlunos(page, cenario)
    expect(leiturasDaLista).toHaveLength(1)

    await escolherASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    await expect(principal(page).getByText(TEXTO_DO_ALUNO_QUE_SAIU)).toBeVisible()
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await expect.poll(() => leiturasDaLista.length).toBe(2)

    // A geração: a confirmação abre (a leitura passa), e o 404 vem no "Gerar".
    metodoQueFalha = 'POST'
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    await expect(principal(page).getByText(TEXTO_DO_ALUNO_QUE_SAIU)).toHaveCount(0)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await activate(botaoGerar(page), hasTouch)
    await expect(principal(page).getByText(TEXTO_DO_ALUNO_QUE_SAIU)).toBeVisible()
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await expect.poll(() => leiturasDaLista.length).toBe(3)
  })

  test('recomeço: reabrir o diálogo pede a confirmação de novo, sem a senha velha', async ({ page, hasTouch, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    const senha = await gerar(page, hasTouch)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Copiar' }), hasTouch)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)

    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText('Confira quem é o aluno antes de gerar a senha provisória.')
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(senha)
  })

  test('recomeço: a resposta atrasada da geração do primeiro aluno, que chega depois de fechar, não aparece no diálogo do segundo', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    const atrasada = gate()
    await page.route(ehOAlvo(cenario.primeira.usuarioId), async (rota: Route) => {
      if (rota.request().method() === 'POST') await atrasada.aberta
      return rota.fallback()
    })
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(0), hasTouch)
    await activate(botaoGerar(page), hasTouch)
    await expect(botaoGerar(page)).toHaveText('Gerando…')

    // Fecha com a geração no ar (a pergunta antes) e abre o outro aluno.
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(dialogoDaSenha(page).getByText(/A senha ainda está sendo gerada/)).toBeVisible()
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar sem copiar' }), hasTouch)
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await pedirASenha(page, menusDaLista(page, cenario.nome).nth(1), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.segunda.matricula)

    // A resposta da primeira chega de verdade (o servidor gerou) e a tela ganha um quadro para mostrá-la, se fosse mostrar: só então se afirma que a confirmação do segundo não mudou.
    const tardia = page.waitForResponse((resposta) => resposta.request().method() === 'POST' && ehOAlvo(cenario.primeira.usuarioId)(new URL(resposta.url())))
    atrasada.abrir()
    await tardia
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => setTimeout(resolver, 0))))
    await expect(dialogoDaSenha(page).locator('[data-senha-provisoria]')).toHaveCount(0)
    await expect(dialogoDaSenha(page)).toContainText(cenario.segunda.matricula)
    await expect(dialogoDaSenha(page)).toContainText('Confira quem é o aluno antes de gerar a senha provisória.')
  })

  test('recomeço: a primeira pessoa sai e a segunda entra na mesma aba: nada da senha da primeira nem o diálogo (o aoTrocarDeSessao é da unidade)', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    const senha = await gerar(page, hasTouch)

    // A primeira fecha sem copiar (a pergunta antes) e sai: nada da senha fica na aba.
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar sem copiar' }), hasTouch)
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(senha)

    const outra = await criarEquipeComSenha()
    await entrarPorEmail(page, outra, hasTouch)
    await esperarNovaConversa(page, outra.nome)
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(senha)
    await expect(page.locator('body')).not.toContainText(cenario.nome)
  })

  test('em 360 e em 1366 px: nada rola de lado, e os alvos de toque têm 44 px nas ações principais e 24 px no resto', async ({ page, hasTouch }) => {
    const cenario = await cenarioDoProfessor()
    await abrirAAbaAlunos(page, cenario)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await alturaDe(menusDaLista(page, cenario.nome).first())).toBeGreaterThanOrEqual(24)
    await pedirASenha(page, menusDaLista(page, cenario.nome).first(), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)

    for (const botao of [botaoGerar(page), dialogoDaSenha(page).getByRole('button', { name: 'Cancelar' })]) expect(await alturaDe(botao)).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await cabeNaLargura(page, dialogoDaSenha(page))).toBe(true)

    await gerar(page, hasTouch)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await cabeNaLargura(page, dialogoDaSenha(page).locator('[data-senha-provisoria]'))).toBe(true)
    for (const nome of ['Copiar', 'Fechar']) expect(await alturaDe(dialogoDaSenha(page).getByRole('button', { name: nome }))).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  })
})

/** A altura do alvo na tela, em px (0 se ele não está na tela). */
async function alturaDe(alvo: Locator): Promise<number> {
  return (await alvo.boundingBox())?.height ?? 0
}

/** O alvo inteiro dentro da largura da janela: nada passa da borda, à esquerda nem à direita. */
async function cabeNaLargura(page: Page, alvo: Locator): Promise<boolean> {
  const caixa = await alvo.boundingBox()
  if (caixa === null) return false
  return caixa.x >= 0 && caixa.x + caixa.width <= (page.viewportSize()?.width ?? 0)
}

interface CenarioDaCoordenacao {
  readonly coordenadora: EquipeDeTeste
  readonly turma: { readonly id: string; readonly nome: string }
  readonly nome: string
  readonly primeira: AlunoDeTeste
  readonly segunda: AlunoDeTeste
}

/** A coordenação com uma turma e dois alunos aprovados de mesmo nome, cada um com a sua matrícula. */
async function cenarioDaCoordenacao(): Promise<CenarioDaCoordenacao> {
  const marca = randomUUID().slice(0, 8)
  const coordenadora = await criarEquipeComSenha('coordenador')
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const turma = estrutura.turmas[0]
  if (turma === undefined) throw new Error('estrutura sem turma')
  const nome = `Ana Souza ${marca}`
  const escola = { escolaId: coordenadora.escolaId, escolaNome: coordenadora.escolaNome, slug: coordenadora.slug }
  const primeira = await criarAlunoComMatricula({ escola, nome, matricula: `C${marca}1` })
  const segunda = await criarAlunoComMatricula({ escola, nome, matricula: `C${marca}2` })
  const turmaDoAluno = { turmaId: turma.id, turmaNome: turma.nome, serieNome: '7º ano do Ensino Fundamental' }
  await colocarAlunoNaTurma(primeira, turmaDoAluno)
  await colocarAlunoNaTurma(segunda, turmaDoAluno)
  return { coordenadora, turma, nome, primeira, segunda }
}

async function abrirATurmaDaCoordenacao(page: Page, request: APIRequestContext, cenario: CenarioDaCoordenacao): Promise<void> {
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, cenario.coordenadora, `/coordenacao/estrutura/turmas/${cenario.turma.id}`, () =>
    expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${cenario.turma.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }),
  )
}

const secaoDosAprovados = (page: Page): Locator => principal(page).getByRole('region', { name: 'Alunos aprovados' })

test.describe('RF13 e RF18: a senha provisória pela seção "Alunos aprovados" da coordenação', () => {
  test('a lista só é lida no clique; a linha tem o menu, a mesma confirmação, e a contagem antiga não aparece', async ({ page, request, hasTouch }) => {
    const cenario = await cenarioDaCoordenacao()
    const leituras: string[] = []
    page.on('request', (pedido) => {
      const url = new URL(pedido.url())
      if (pedido.method() === 'GET' && url.pathname === `/v1/turmas/${cenario.turma.id}/alunos`) leituras.push(url.search)
    })
    await abrirATurmaDaCoordenacao(page, request, cenario)

    // Antes do clique, nada lido, e nenhuma contagem de aprovados na lista de nomes.
    await expect(secaoDosAprovados(page)).toContainText('Cada consulta fica registrada na auditoria, em seu nome.')
    await expect(page.locator('body')).not.toContainText(/Aprovados (nesta turma|entre os primeiros)/)
    expect(leituras).toEqual([])

    await activate(secaoDosAprovados(page).getByRole('button', { name: 'Mostrar alunos aprovados' }), hasTouch)
    await expect(menusDosAprovados(page, cenario.nome)).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(leituras).toEqual(['?finalidade=conferencia_de_cadastro&limite=100'])
    await paginaNaoRola(page)

    // Os dois alunos de mesmo nome se distinguem na confirmação, pela matrícula.
    await pedirASenha(page, menusDosAprovados(page, cenario.nome).nth(0), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    await expect(dialogoDaSenha(page)).toContainText(cenario.turma.nome)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await pedirASenha(page, menusDosAprovados(page, cenario.nome).nth(1), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.segunda.matricula)
    const senha = await gerar(page, hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(senha)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('em 360 px: a seção não rola de lado, e "Mostrar", "Atualizar", "Voltar à senha" e "Fechar sem copiar" têm 44 px, o menu "Ações" 24 px', async ({ page, request, hasTouch }) => {
    const cenario = await cenarioDaCoordenacao()
    await abrirATurmaDaCoordenacao(page, request, cenario)
    const mostrar = secaoDosAprovados(page).getByRole('button', { name: 'Mostrar alunos aprovados' })
    expect(await alturaDe(mostrar)).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await horizontalOverflow(page)).toBe(0)

    await activate(mostrar, hasTouch)
    await expect(menusDosAprovados(page, cenario.nome)).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await alturaDe(secaoDosAprovados(page).getByRole('button', { name: /^Atualizar/ }))).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await alturaDe(menusDosAprovados(page, cenario.nome).first())).toBeGreaterThanOrEqual(24)
    expect(await horizontalOverflow(page)).toBe(0)

    await pedirASenha(page, menusDosAprovados(page, cenario.nome).first(), hasTouch)
    await expect(dialogoDaSenha(page)).toContainText(cenario.primeira.matricula)
    expect(await cabeNaLargura(page, dialogoDaSenha(page))).toBe(true)
    await gerar(page, hasTouch)
    expect(await cabeNaLargura(page, dialogoDaSenha(page).locator('[data-senha-provisoria]'))).toBe(true)
    await activate(dialogoDaSenha(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    for (const nome of ['Voltar à senha', 'Fechar sem copiar']) expect(await alturaDe(dialogoDaSenha(page).getByRole('button', { name: nome }))).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('o aluno que sumiu: o aviso na seção, o diálogo fecha e a lista é lida de novo', async ({ page, request, hasTouch }) => {
    const cenario = await cenarioDaCoordenacao()
    const leituras: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'GET' && new URL(pedido.url()).pathname === `/v1/turmas/${cenario.turma.id}/alunos`) leituras.push(pedido)
    })
    await page.route(ehOAlvo(cenario.primeira.usuarioId), (rota: Route) => rota.fulfill({ status: 404, contentType: 'application/json', body: ENVELOPE('NAO_ENCONTRADO') }))
    await abrirATurmaDaCoordenacao(page, request, cenario)
    await activate(secaoDosAprovados(page).getByRole('button', { name: 'Mostrar alunos aprovados' }), hasTouch)
    await expect(menusDosAprovados(page, cenario.nome)).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })

    await escolherASenha(page, menusDosAprovados(page, cenario.nome).nth(0), hasTouch)

    await expect(secaoDosAprovados(page).getByText(TEXTO_DO_ALUNO_QUE_SAIU)).toBeVisible()
    await expect(dialogoDaSenha(page)).toHaveCount(0)
    await expect.poll(() => leituras.length).toBe(2)
  })
})

const menusDosAprovados = (page: Page, nome: string): Locator => secaoDosAprovados(page).getByRole('button', { name: new RegExp(`^${nome}:?\\s*Ações$`) })
