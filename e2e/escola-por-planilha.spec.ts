import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { APIRequestContext, BrowserContextOptions, Locator, Page } from '@playwright/test'
import { exibirCodigoDaTurma } from '../packages/shared/src/sala/acesso.ts'
import type { TipoDePlanilha } from '../packages/shared/src/importacao/contratos.ts'
import { abrirAbaAlunos, entrarPorEmail, irPelaNavegacao, passarPelaIntroducaoDoAluno, passarPelaIntroducaoDoProfessor, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'
import {
  cabecalhoDe,
  emailDoProfessor,
  entrarComoCoordenacaoComToken,
  entrarComTokenPelaApi,
  gravarPelaApi,
  linhaDaGrade,
  linkDoConviteDoProfessor,
  listaDaEscolaPorEstado,
  planilhaDe,
  tokenDaCoordenacao,
  turmaPorNome,
  usuarioDoProfessorPorEmail,
  vinculosDeProfessorPorEstado,
  aulasDaTurmaNoBanco,
  vinculosDaTurmaNoBanco,
} from './support/planilhas.ts'
import { expect, test } from './support/profiles.ts'
import { alunosDaTurmaNoBanco, aulasDaEscolaNoBanco, confirmarVinculosNoBanco, criarEquipeComSenha, criarProfessoraNaEscola, eventosDaEscolaNoBanco, gerarAcessoDaSalaNoBanco, type EquipeDeTeste } from './support/seed.ts'

/**
 * A escola inteira entra por planilha, só pela tela (F2, 16.0; RF1, RF2, RF18; regra 40, "Os fluxos que exigem E2E": o onboarding completo e a
 * planilha suja), nos projetos `chromebook` e `celular`, com axe. O fluxo é o do RF18: a escola vazia recebe as quatro planilhas (a de alunos,
 * suja), o professor aceita o convite que a coordenação copiou e confirma o que a grade definiu, um aluno pede o nome pela matrícula, e o
 * professor aprova.
 *
 * **Casos com seed compartilhado, e não um caso só.** O fluxo inteiro passa de 15 s, a metade do prazo que o portão cobra de cada caso, e um
 * caso que o carrega vira dívida da `develop` (X8). Cada caso prova uma etapa **pela tela** e semeia as de antes **pela rota de verdade**
 * (`gravarPelaApi`, o mesmo `POST /v1/importacoes/:tipo` que a tela chama, com o token da coordenação): o mundo que o caso encontra é o
 * que a etapa anterior deixa, e não um atalho no banco. Nomes, matrículas e e-mails são inventados pelo teste.
 */

const CAMPO_DO_ARQUIVO = 'Arquivo da planilha (Excel ou CSV)'
const SENHA_DO_PROFESSOR = 'senha do professor sintético'
const SENHA_DA_ALUNA = 'a frase que só a aluna sabe'
const ENDERECO_DOS_ALUNOS = '/coordenacao/estrutura?painel=importar'
const ENDERECO_DOS_PROFESSORES = '/coordenacao/professores?painel=importar'
const ENDERECO_DA_GRADE = '/coordenacao/grade?painel=importar-grade'
const ENDERECO_DO_CALENDARIO = '/coordenacao/grade?painel=importar-calendario'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

const principal = (page: Page): Locator => page.getByRole('main')
const painelDe = (page: Page, nome: string): Locator => page.getByRole('dialog', { name: nome })
/** O diálogo de formulário ou de confirmação, e não o painel (o painel do professor guarda o diálogo que abre por cima dele). */
const dialogo = (page: Page): Locator => page.locator('dialog[open]:not([data-painel-lado])')
const botao = (lugar: Locator, nome: string): Locator => lugar.getByRole('button', { name: nome, exact: true })
const resumoDaPrevia = (lugar: Locator, texto: string): Locator => lugar.getByRole('status').filter({ hasText: texto })
const conclusao = (lugar: Locator): Locator => lugar.getByRole('region', { name: 'Planilha gravada' })

/** Escolhe o arquivo no campo do painel, como o navegador o entrega. */
async function escolher(painel: Locator, nome: string, texto: string): Promise<void> {
  await painel.getByLabel(CAMPO_DO_ARQUIVO).setInputFiles({ name: nome, mimeType: 'text/csv', buffer: Buffer.from(texto, 'utf8') })
}

/** A tela sem violação grave de acessibilidade e sem rolagem horizontal. */
async function conferirTela(page: Page): Promise<void> {
  expect(await seriousViolations(page)).toEqual([])
  expect(await horizontalOverflow(page)).toBe(0)
}

/** Os nomes que o teste inventa: tudo leva a mesma marca, que é o que o teste procura na tela e no banco. */
function nomesDoCaso() {
  const marca = randomUUID().slice(0, 6)
  return {
    marca,
    ana: { nome: `Ana Prof ${marca}`, email: emailDoProfessor('ana', marca) },
    bia: { nome: `Bia Prof ${marca}`, email: emailDoProfessor('bia', marca) },
    alunos: [0, 1, 2, 3].map((posicao) => ({ nome: `Aluno ${String(posicao + 1)} ${marca}`, matricula: `E${marca}${String(posicao + 1)}` })),
  }
}

/** A escola vazia: ano em curso e a coordenação, e nenhuma turma, aluno nem professor. */
async function escolaVazia(): Promise<EquipeDeTeste> {
  return criarEquipeComSenha('coordenador')
}

test.describe('RF18 e RF2 (16.0): a escola vazia recebe as quatro planilhas pela tela', () => {
  test('a planilha de alunos suja mostra o erro de cada linha e não grava; corrigida, grava, e a escola vazia ganha as turmas', async ({ page, request, hasTouch }) => {
    const coordenadora = await escolaVazia()
    const { alunos } = nomesDoCaso()
    const [ana, bia, caio, dani] = alunos
    if (ana === undefined || bia === undefined || caio === undefined || dani === undefined) throw new Error('alunos do caso')
    const painel = painelDe(page, 'Importar alunos')
    await entrarComoCoordenacaoComToken(page, request, coordenadora, ENDERECO_DOS_ALUNOS, () => expect(botao(painel, 'Baixar modelo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))

    // Suja: a turma "Turma Azul" não se lê, e a matrícula repetida é erro nas duas linhas. A turma boa aparece escrita de três jeitos
    // ("8º A", "8A" e "8a"). Nada grava, e o botão nem aparece.
    await escolher(painel, 'alunos.csv', planilhaDe('alunos', `8º A;${ana.nome};${ana.matricula}`, `Turma Azul;${bia.nome};${bia.matricula}`, `8A;${caio.nome};${ana.matricula}`, `8a;${dani.nome};${dani.matricula}`))
    await expect(resumoDaPrevia(painel, '4 linhas lidas · 3 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const erros = painel.getByRole('region', { name: 'Linhas com erro (3)' })
    await expect(erros).toBeVisible()
    // O erro da turma ilegível diz o que fazer, em frase, e o da linha com a turma boa não a acusa.
    await expect(erros).toContainText('Não achei esta turma. Escreva o ano e a letra')
    await expect(botao(painel, 'Gravar planilha')).toHaveCount(0)
    await conferirTela(page)
    expect(await listaDaEscolaPorEstado(coordenadora.escolaId)).toEqual({})

    // Corrigida (o mesmo arquivo, com a turma e a matrícula certas): "8º A" e "8A" são a mesma turma, e grava.
    await escolher(painel, 'alunos-certa.csv', planilhaDe('alunos', `8º A;${ana.nome};${ana.matricula}`, `9º B;${bia.nome};${bia.matricula}`, `8A;${caio.nome};${caio.matricula}`, `8a;${dani.nome};${dani.matricula}`))
    await expect(resumoDaPrevia(painel, '4 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botao(painel, 'Gravar planilha'), hasTouch)
    await expect(conclusao(painel)).toContainText('4 alunos entraram. 2 turmas novas foram criadas.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await listaDaEscolaPorEstado(coordenadora.escolaId)).toEqual({ livre: 4 })
    await conferirTela(page)
  })

  test('a planilha de professores cadastra a equipe, e o "Copiar link" do cadastrado entrega o convite que o professor abre', async ({ page, request, hasTouch }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const coordenadora = await escolaVazia()
    const { ana, bia } = nomesDoCaso()
    const painel = painelDe(page, 'Importar professores')
    await entrarComoCoordenacaoComToken(page, request, coordenadora, ENDERECO_DOS_PROFESSORES, () => expect(botao(painel, 'Baixar modelo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))

    await escolher(painel, 'professores.csv', planilhaDe('professores', `${ana.nome};${ana.email}`, `${bia.nome};${bia.email}`))
    await expect(resumoDaPrevia(painel, '2 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botao(painel, 'Gravar professores'), hasTouch)
    await expect(conclusao(painel)).toContainText('2 professores cadastrados, com o convite em aberto.', { timeout: SIGN_IN_TIMEOUT_MS })
    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)

    // A Ana está pendente na lista, sem e-mail à vista; o painel dela refaz o convite e o diálogo entrega o link, que se copia.
    await activate(botao(principal(page), ana.nome), hasTouch)
    await activate(botao(painelDe(page, ana.nome), 'Refazer convite'), hasTouch)
    await activate(botao(dialogo(page), 'Refazer convite'), hasTouch)
    const link = await dialogo(page).getByLabel('Link do convite').inputValue({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(new URL(link).pathname).toBe('/convite')
    expect(new URL(link).hash.slice(1)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    await activate(botao(dialogo(page), 'Copiar link'), hasTouch)
    await expect(dialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
    await conferirTela(page)
    expect(await page.content()).not.toContain(ana.email)
  })

  test('a grade cria as turmas, as disciplinas e os vínculos que esperam o professor, e o calendário do ano entra', async ({ page, request, hasTouch }) => {
    const coordenadora = await escolaVazia()
    const { ana, bia } = nomesDoCaso()
    const painel = painelDe(page, 'Importar grade')
    const { token } = await entrarComoCoordenacaoComToken(page, request, coordenadora, ENDERECO_DA_GRADE, () => expect(botao(painel, 'Baixar modelo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
    // A equipe já está cadastrada (a planilha de professores do caso anterior): a grade a acha pelo e-mail.
    await gravarPelaApi(request, token, 'professores', planilhaDe('professores', `${ana.nome};${ana.email}`, `${bia.nome};${bia.email}`))

    await escolher(
      painel,
      'grade.csv',
      planilhaDe(
        'grade',
        linhaDaGrade({ turma: '8º A', disciplina: 'Matemática', professor: ana.nome, email: ana.email, dia: 'segunda', inicio: '07:30', fim: '08:20', sala: 'Sala 1' }),
        linhaDaGrade({ turma: '8º B', disciplina: 'Física', professor: bia.nome, email: bia.email, dia: 'terça', inicio: '08:20', fim: '09:10' }),
      ),
    )
    await expect(resumoDaPrevia(painel, '2 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botao(painel, 'Gravar grade'), hasTouch)
    await expect(conclusao(painel)).toContainText('2 aulas gravadas. 2 turmas novas foram criadas. 2 disciplinas novas foram criadas. 2 vínculos de professor esperam a confirmação deles.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(2)
    // Nenhum professor novo: a equipe já estava lá. Os vínculos nascem pendentes, à espera de quem dá a aula.
    expect(await vinculosDeProfessorPorEstado(coordenadora.escolaId)).toEqual({ pendente: 2 })
    await conferirTela(page)
  })

  test('o calendário do ano entra pela tela e a escola o lê de volta', async ({ page, request, hasTouch }) => {
    const coordenadora = await escolaVazia()
    const painel = painelDe(page, 'Importar calendário')
    await entrarComoCoordenacaoComToken(page, request, coordenadora, ENDERECO_DO_CALENDARIO, () => expect(botao(painel, 'Baixar modelo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
    await escolher(painel, 'calendario.csv', planilhaDe('calendario', '15/11/2026;15/11/2026;feriado;Proclamação da República', '14/12/2026;18/12/2026;recesso;Recesso de fim de ano'))
    await expect(resumoDaPrevia(painel, '2 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botao(painel, 'Gravar calendário'), hasTouch)
    await expect(conclusao(painel)).toContainText('2 eventos entraram no calendário.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await eventosDaEscolaNoBanco(coordenadora.escolaId)).toBe(2)
    await page.keyboard.press('Escape')
    await expect(principal(page).getByRole('region', { name: /^Calendário de \d{4}$/ })).toContainText('Proclamação da República', { timeout: SIGN_IN_TIMEOUT_MS })
    await conferirTela(page)
  })
})

/** Uma linha que o modelo baixado, preenchido, traz sem erro, por tipo. */
const LINHA_DO_MODELO: Readonly<Record<TipoDePlanilha, (marca: string) => string>> = {
  alunos: (marca) => `7º A;Aluno do modelo ${marca};MOD${marca}`,
  professores: (marca) => `Professor do modelo ${marca};modelo-${marca}@educa.invalid`,
  grade: (marca) => linhaDaGrade({ turma: '7º A', disciplina: 'Matemática', professor: `Professor do modelo ${marca}`, email: `modelo-${marca}@educa.invalid`, dia: 'segunda', inicio: '07:30', fim: '08:20' }),
  calendario: () => '15/11/2026;15/11/2026;feriado;Proclamação da República',
}
const PAINEL_DO_MODELO: Readonly<Record<TipoDePlanilha, { readonly endereco: string; readonly painel: string }>> = {
  alunos: { endereco: ENDERECO_DOS_ALUNOS, painel: 'Importar alunos' },
  professores: { endereco: ENDERECO_DOS_PROFESSORES, painel: 'Importar professores' },
  grade: { endereco: ENDERECO_DA_GRADE, painel: 'Importar grade' },
  calendario: { endereco: ENDERECO_DO_CALENDARIO, painel: 'Importar calendário' },
}

test.describe('RF1 (16.0): o modelo servido pela tela, preenchido, entra sem erro', () => {
  for (const tipo of ['alunos', 'professores', 'grade', 'calendario'] as const) {
    test(`o modelo de ${tipo}: o botão do painel baixa o arquivo com o cabeçalho do modelo, e ele com uma linha preenchida passa na prévia sem erro nem aviso`, async ({ page, request, hasTouch }) => {
      const coordenadora = await escolaVazia()
      const { marca } = nomesDoCaso()
      const { endereco, painel: nome } = PAINEL_DO_MODELO[tipo]
      const painel = painelDe(page, nome)
      await entrarComoCoordenacaoComToken(page, request, coordenadora, endereco, () => expect(botao(painel, 'Baixar modelo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))

      // O arquivo que a tela baixa: o cabeçalho do modelo, e é ele que se preenche. Aqui o preenchimento é a linha de baixo do mesmo arquivo.
      const baixando = page.waitForEvent('download')
      await activate(botao(painel, 'Baixar modelo'), hasTouch)
      const arquivo = await baixando
      expect(arquivo.suggestedFilename()).toBe(`modelo-${tipo}.csv`)
      const caminho = await arquivo.path()
      const baixado = readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '').trim()
      expect(baixado).toBe(cabecalhoDe(tipo))

      // A professora da grade precisa existir? Não: o professor que a planilha traz é novo, e a prévia só avisa que será cadastrado.
      await escolher(painel, `modelo-${tipo}.csv`, `${baixado}\r\n${LINHA_DO_MODELO[tipo](marca)}\r\n`)
      await expect(resumoDaPrevia(painel, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
      await expect(botao(painel, tipo === 'alunos' ? 'Gravar planilha' : `Gravar ${tipo === 'professores' ? 'professores' : tipo === 'grade' ? 'grade' : 'calendário'}`)).toBeVisible()
      await conferirTela(page)
      // "Entra": o modelo de alunos preenchido, gravado, vira o aluno na lista (os outros três tipos têm o caso da gravação em casa).
      if (tipo === 'alunos') {
        await activate(botao(painel, 'Gravar planilha'), hasTouch)
        await expect(conclusao(painel)).toContainText('1 aluno entrou.', { timeout: SIGN_IN_TIMEOUT_MS })
        expect(await listaDaEscolaPorEstado(coordenadora.escolaId)).toEqual({ livre: 1 })
      }
    })
  }
})

test.describe('RF18 (16.0): o professor aceita o convite copiado e confirma o que a grade definiu', () => {
  test('o professor abre o link do convite que a coordenação copiou, aceita, cria a senha e entra', async ({ page, browser, request, hasTouch }) => {
    const coordenadora = await escolaVazia()
    const { ana } = nomesDoCaso()
    const { token } = await tokenDaCoordenacao(request, coordenadora)
    await gravarPelaApi(request, token, 'professores', planilhaDe('professores', `${ana.nome};${ana.email}`))
    const link = await linkDoConviteDoProfessor(request, token, await usuarioDoProfessorPorEmail(coordenadora.escolaId, ana.email))

    // O professor, no computador dele: a página do link, aceitar, senha nova, e a entrada.
    const uso = test.info().project.use
    const opcoes: BrowserContextOptions = { hasTouch, locale: 'pt-BR' }
    if (uso.baseURL !== undefined) opcoes.baseURL = uso.baseURL
    const tela = page.viewportSize()
    if (tela !== null) opcoes.viewport = tela
    if (uso.isMobile !== undefined) opcoes.isMobile = uso.isMobile
    const contexto = await browser.newContext(opcoes)
    try {
      const professor = await contexto.newPage()
      await professor.goto(link)
      await activate(botao(principal(professor), 'Aceitar o convite'), hasTouch)
      await professor.getByLabel('Senha nova').fill(SENHA_DO_PROFESSOR, { timeout: SIGN_IN_TIMEOUT_MS })
      await activate(botao(principal(professor), 'Definir a senha e continuar'), hasTouch)
      await expect(professor).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
      await entrarPorEmail(professor, { email: ana.email, senha: SENHA_DO_PROFESSOR }, hasTouch)
      await passarPelaIntroducaoDoProfessor(professor, ana.nome, hasTouch)
      await conferirTela(professor)
    } finally {
      await contexto.close()
    }
  })

  test('o professor confirma o vínculo que a grade definiu: antes não alcança a turma, depois a abre', async ({ page, request, hasTouch }) => {
    const coordenadora = await escolaVazia()
    const professora = await criarProfessoraNaEscola(coordenadora)
    const { token } = await tokenDaCoordenacao(request, coordenadora)
    await gravarPelaApi(request, token, 'grade', planilhaDe('grade', linhaDaGrade({ turma: '8º A', disciplina: 'Matemática', professor: professora.nome, email: professora.email, dia: 'segunda', inicio: '07:30', fim: '08:20' })))
    expect(await vinculosDeProfessorPorEstado(coordenadora.escolaId)).toEqual({ pendente: 1 })
    const turmaId = await turmaPorNome(coordenadora.escolaId, '8º A')

    // O vínculo nasceu pendente: até ele confirmar, o endereço da turma responde como a turma que não existe (regra 60, item 8a; regra 10, item 4).
    await entrarComTokenPelaApi(page, professora, `/professor/turmas/${turmaId}`, () => expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
    await activate(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), hasTouch)
    const paraConfirmar = principal(page).getByRole('region', { name: 'Confirme suas turmas', exact: true })
    await expect(paraConfirmar).toContainText('8º A', { timeout: SIGN_IN_TIMEOUT_MS })
    // E a tela não oferece a turma por onde se chegaria a ela.
    await expect(principal(page).getByRole('link', { name: 'Abrir a turma 8º A' })).toHaveCount(0)
    await conferirTela(page)
    await activate(paraConfirmar.getByRole('listitem').filter({ hasText: '8º A' }).getByRole('button', { name: 'Confirmar' }), hasTouch)
    await activate(principal(page).getByRole('link', { name: 'Abrir a turma 8º A' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/${turmaId}$`), { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await vinculosDeProfessorPorEstado(coordenadora.escolaId)).toEqual({ confirmado: 1 })
    expect(await aulasDaTurmaNoBanco(coordenadora.escolaId, turmaId)).toBe(1)
    await conferirTela(page)
  })
})

/** A escola com a lista de uma turma gravada pela planilha, a professora com o vínculo confirmado e o acesso da sala com código conhecido. */
async function escolaComSalaAberta(request: APIRequestContext) {
  const coordenadora = await escolaVazia()
  const professora = await criarProfessoraNaEscola(coordenadora)
  const nomes = nomesDoCaso()
  const [aluna, colega, deOutraTurma] = nomes.alunos
  if (aluna === undefined || colega === undefined || deOutraTurma === undefined) throw new Error('alunos do caso')
  const { token } = await tokenDaCoordenacao(request, coordenadora)
  // A turma da aluna, com a colega, e outra turma da escola, com um aluno: nada dela pode aparecer para a aluna.
  await gravarPelaApi(request, token, 'alunos', planilhaDe('alunos', `7º A;${aluna.nome};${aluna.matricula}`, `7º A;${colega.nome};${colega.matricula}`, `8º A;${deOutraTurma.nome};${deOutraTurma.matricula}`))
  await gravarPelaApi(request, token, 'grade', planilhaDe('grade', linhaDaGrade({ turma: '7º A', disciplina: 'Matemática', professor: professora.nome, email: professora.email, dia: 'segunda', inicio: '07:30', fim: '08:20' })))
  const turmaId = await turmaPorNome(coordenadora.escolaId, '7º A')
  await confirmarVinculosNoBanco(coordenadora.escolaId, await vinculosDaTurmaNoBanco(coordenadora.escolaId, turmaId))
  const acesso = await gerarAcessoDaSalaNoBanco(coordenadora.escolaId, turmaId)
  return { coordenadora, professora, turmaId, aluna, colega, deOutraTurma, acesso }
}

test.describe('RF18 (16.0): o aluno pede o nome pela matrícula e o professor aprova', () => {
  test('a aluna abre a turma pelo código que a lousa mostra, escolhe o nome da lista que a planilha gravou e pede com a matrícula', async ({ page, request, hasTouch }) => {
    const { coordenadora, turmaId, aluna, acesso } = await escolaComSalaAberta(request)
    await page.goto(`/e/${coordenadora.slug}/turma`)
    await principal(page).getByLabel('Código da turma').fill(exibirCodigoDaTurma(acesso.codigo))
    await activate(botao(principal(page), 'Abrir a turma'), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 2, name: 'Turma 7º A' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('radio')).toHaveCount(2)
    await activate(principal(page).getByRole('radio', { name: aluna.nome }), hasTouch)
    await principal(page).getByLabel('Matrícula').fill(aluna.matricula)
    await principal(page).getByLabel('Crie uma senha').fill(SENHA_DA_ALUNA)
    await activate(botao(principal(page), 'Enviar pedido'), hasTouch)
    await expect(principal(page).getByRole('heading', { name: 'Pedido enviado' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await conferirTela(page)
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaId)).toBe(0)
  })

  test('o professor aprova o pedido pela tela, conferindo o nome, e a aluna passa a ser da turma', async ({ page, request, hasTouch }) => {
    const { coordenadora, professora, turmaId, aluna, acesso } = await escolaComSalaAberta(request)
    await pedirONome(request, coordenadora.slug, acesso.codigo, aluna)

    await entrarComTokenPelaApi(page, professora, `/professor/turmas/${turmaId}`, () => expect(page.getByRole('tab', { name: 'Alunos' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
    await abrirAbaAlunos(page, hasTouch)
    const pedidos = principal(page).getByRole('region', { name: 'Pedidos de nome' })
    await activate(pedidos.getByRole('checkbox', { name: aluna.nome }), hasTouch)
    await activate(botao(pedidos, 'Aprovar 1 pedido'), hasTouch)
    await expect(dialogo(page)).toContainText('Você vai aprovar 1 pedido da turma 7º A.')
    await activate(botao(dialogo(page), 'Aprovar 1 pedido'), hasTouch)
    await expect(dialogo(page)).toContainText('Aprovado: já pode entrar com a matrícula e a senha', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turmaId)).toBe(1)
    expect(await listaDaEscolaPorEstado(coordenadora.escolaId)).toEqual({ aprovado: 1, livre: 2 })
    await conferirTela(page)
  })

  test('a aluna aprovada entra com a matrícula e a senha que criou e vê só a turma dela, sem o colega', async ({ page, request, hasTouch }) => {
    const { coordenadora, professora, turmaId, aluna, colega, deOutraTurma, acesso } = await escolaComSalaAberta(request)
    await pedirONome(request, coordenadora.slug, acesso.codigo, aluna)
    // A aprovação do professor, pela rota da decisão: a etapa de antes tem o caso dela.
    const tokenDoProfessor = await entrarComTokenPelaApi(page, professora)
    const pendentes = await request.get(`/v1/turmas/${turmaId}/reivindicacoes?limite=100`, { headers: { Authorization: `Bearer ${tokenDoProfessor}` } })
    const { itens } = (await pendentes.json()) as { itens: Array<{ id: string }> }
    const decidida = await request.post('/v1/reivindicacoes/decidir', { headers: { Authorization: `Bearer ${tokenDoProfessor}` }, data: { ids: itens.map((item) => item.id), decisao: 'aprovar' } })
    expect(decidida.ok(), 'a aprovação pela API').toBe(true)

    await page.goto(`/e/${coordenadora.slug}`)
    await page.getByLabel('Matrícula').fill(aluna.matricula)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_DA_ALUNA)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await passarPelaIntroducaoDoAluno(page, aluna.nome, hasTouch)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(principal(page).locator('header').getByText('7º A')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(page.locator('body')).not.toContainText(colega.matricula)
    await expect(page.locator('body')).not.toContainText('8º A')
    await expect(page.locator('body')).not.toContainText(deOutraTurma.nome)
    await expect(page.locator('body')).not.toContainText(deOutraTurma.matricula)
    await conferirTela(page)
  })
})

/** O pedido de nome da aluna, pela rota da sala (a página pública tem o caso dela): abre a turma pelo código e escolhe o nome na lista. */
async function pedirONome(request: APIRequestContext, slug: string, codigo: string, aluna: { readonly nome: string; readonly matricula: string }): Promise<void> {
  const aberta = await request.post('/v1/salas/abrir', { data: { slug, codigo } })
  const { nomes } = (await aberta.json()) as { nomes: Array<{ id: string; nome: string }> }
  const nome = nomes.find((item) => item.nome === aluna.nome)
  if (nome === undefined) throw new Error('o nome da aluna não está na lista da sala')
  const pedido = await request.post('/v1/salas/reivindicar', { data: { slug, codigo, listaNomeId: nome.id, matricula: aluna.matricula, senha: SENHA_DA_ALUNA, chaveEnvio: randomUUID() } })
  expect(pedido.ok(), 'o pedido da aluna').toBe(true)
}
