import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { entrarComoCoordenacaoNaMesmaAba, abrirEstrutura, esperarEstrutura, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { expect, test } from './support/profiles.ts'
import {
  apagarTurmaNoBanco,
  confirmarVinculosNoBanco,
  convidarProfessorNoBanco,
  criarAlocacaoDoProfessor,
  criarEquipeComSenha,
  type EquipeDeTeste,
  montarEstruturaNoBanco,
  porNaListaDaTurma,
} from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A lista de nomes da turma (X2, 3.0; movida de `estrutura.spec.ts` sem editar o corpo): W10 e W4 (Lista), o arquivo do Excel e o
 * clique duplo em "Gravar lista". Tudo pela tela, nos projetos `chromebook` e `celular`, com nomes e matrículas inventados pelo teste.
 *
 * Na 9.0 os nomes passaram a uma tabela (que vira lista no celular) e a turma ganhou os professores ao lado: o que mudou nos
 * casos de cima é só o elemento que se conta (`linhasDaTabela`, no lugar de `listitem`) e a matrícula, que deixou de vir com a
 * palavra "Matrícula" colada no número. Nenhuma regra mudou, e os dois casos novos, no fim, são os da coluna e da altura.
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

/** Os nomes que o arquivo do Excel traz, com acento: é por eles que se vê que o windows-1252 foi lido certo. */
const ARQUIVO_DO_EXCEL = 'e2e/support/lista-excel.csv'

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

const principal = (page: Page) => page.getByRole('main')

const dialogo = (page: Page, titulo: string) => page.getByRole('dialog', { name: titulo })

/** O anúncio da ação que terminou, dentro da seção onde ela aconteceu: é lá que quem enxerga o vê. */
const anuncio = (secao: Locator, texto: string | RegExp) => secao.getByRole('status').filter({ hasText: texto })

const secao = (page: Page, nome: string) => principal(page).getByRole('region', { name: nome })

/** Abre a turma pela lista de turmas da Estrutura, pelo link "Lista de nomes". */
async function abrirTurma(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  await activate(principal(page).getByRole('link', { name: `Lista de nomes da turma ${nome}` }), hasTouch)
  await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
}

/** O campo do arquivo da planilha, o mesmo da planilha da escola (`ImportarPlanilha`): a lista da turma só muda as rotas. */
const CAMPO_DO_ARQUIVO = 'Arquivo da planilha (Excel ou CSV)'

/** Escolhe o arquivo no campo, como o navegador o entrega. A prévia chega sozinha: não há botão de "ver a prévia". */
async function escolher(page: Page, nome: string, conteudo: string | Buffer, tipo = 'text/csv'): Promise<void> {
  const buffer = typeof conteudo === 'string' ? Buffer.from(conteudo, 'utf8') : conteudo
  await principal(page).getByLabel(CAMPO_DO_ARQUIVO).setInputFiles({ name: nome, mimeType: tipo, buffer })
}

/** A coordenação entra pela API e cai na turma pelo endereço: o assunto aqui vem depois da entrada, e a entrada pela tela não cabe nos 15 s. */
async function abrirATurma(page: Page, request: APIRequestContext, coordenadora: EquipeDeTeste, turma: { readonly id: string; readonly nome: string }): Promise<void> {
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, `/coordenacao/estrutura/turmas/${turma.id}`, () =>
    expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }),
  )
}

const previaDaLista = (page: Page): Locator => principal(page).getByRole('region', { name: 'Prévia' })
const resumoDaPrevia = (page: Page, texto: string): Locator => previaDaLista(page).getByRole('status').filter({ hasText: texto })
const resultadoDaGravacao = (page: Page): Locator => principal(page).getByRole('region', { name: 'Planilha gravada' })

test.describe('W10 e W4 (Lista): a lista de nomes da turma', () => {
  test('o arquivo do Excel em windows-1252 e o UTF-8 com BOM e vírgula: a prévia com os nomes certos, erros primeiro e em texto; gravar só sem erro, uma vez só', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
    const turma = estrutura.turmas[0]
    if (turma === undefined) throw new Error('estrutura sem turma')
    const leiturasDaLista: Request[] = []
    const gravacoes: Request[] = []
    const segurarLeitura = gate()
    page.on('request', (pedido) => {
      const caminho = new URL(pedido.url()).pathname
      if (caminho === `/v1/turmas/${turma.id}/lista` && pedido.method() === 'POST') gravacoes.push(pedido)
      if (caminho === `/v1/turmas/${turma.id}/lista` && pedido.method() === 'GET') leiturasDaLista.push(pedido)
    })
    await page.route(`**/v1/turmas/${turma.id}/lista?*`, async (rota: Route) => {
      await segurarLeitura.aberta
      await rota.continue()
    })
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(turma.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirTurma(page, turma.nome, hasTouch)
    await expect(page).toHaveTitle(`Turma ${turma.nome} · Turmma`)

    // Carregando, e depois o vazio com o que fazer.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a lista de nomes…' })).toBeVisible()
    segurarLeitura.abrir()
    await expect(principal(page)).toContainText('Escolha o arquivo com o nome e a matrícula de cada aluno', { timeout: SIGN_IN_TIMEOUT_MS })
    // A leitura leva a finalidade (regra 20, item 10).
    expect(new URL(leiturasDaLista[0]?.url() ?? 'http://x').searchParams.get('finalidade')).toBe('conferencia_de_cadastro')
    await expect(principal(page)).toContainText('"nome; matrícula"')
    expect(await seriousViolations(page)).toEqual([])

    // O arquivo do Excel: windows-1252, com `;`, acento, uma linha sem matrícula e uma matrícula repetida. A prévia diz a linha de cada erro.
    const arquivo = principal(page).getByLabel(CAMPO_DO_ARQUIVO)
    await arquivo.setInputFiles(ARQUIVO_DO_EXCEL)
    // A escolha é limpa depois de lida: a mesma planilha, corrigida e escolhida de novo, dispara outra leitura (no
    // navegador, escolher de novo o arquivo que continua escolhido não avisa a página).
    await expect(arquivo).toHaveValue('')
    const previa = previaDaLista(page)
    await expect(resumoDaPrevia(page, '4 linhas lidas · 3 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // A prévia que chega leva o foco ao título dela: o leitor de tela lê o resumo e as linhas em seguida.
    await expect(previa.getByRole('heading', { name: 'Prévia' })).toBeFocused()
    // Erros primeiro, na ordem da planilha, cada um em frase com o que fazer; a linha que entra fica na contagem.
    await expect(previa.getByRole('region', { name: 'Linhas com erro (3)' }).getByRole('listitem')).toHaveText([
      /^Linha 2: Esta matrícula aparece em mais de uma linha da planilha\./,
      /^Linha 4: Falta a matrícula\./,
      /^Linha 5: Esta matrícula aparece em mais de uma linha da planilha\./,
    ])
    await expect(previa.getByRole('region', { name: 'O resto da planilha' })).toContainText('1 linha entra')
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    await expect(previa).toContainText('nada é gravado enquanto houver erro')
    expect(await horizontalOverflow(page)).toBe(0)
    // O aviso do arquivo que não é planilha leva o foco, e a prévia anterior sai: o arquivo novo recomeça tudo.
    await escolher(page, 'lista.xls', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(500)]), 'application/vnd.ms-excel')
    const avisoDaPlanilha = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('alert')
    await expect(avisoDaPlanilha).toContainText('Este arquivo não é uma planilha que a tela leia.')
    await expect(avisoDaPlanilha).toBeFocused()
    await expect(previa).toHaveCount(0)

    // Os nomes acentuados do Excel, sem os erros: o windows-1252 é lido certo e grava com o acento. A prévia não mostra o nome; a lista, sim.
    const doExcel = readFileSync(ARQUIVO_DO_EXCEL).toString('latin1').split('\r\n')
    const semErro = Buffer.from([doExcel[0], doExcel[1], doExcel[2]].join('\r\n'), 'latin1')
    await escolher(page, 'excel.csv', semErro)
    await expect(resumoDaPrevia(page, '2 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(previa.getByRole('button', { name: 'Gravar lista' }), hasTouch)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(resultadoDaGravacao(page)).toContainText('2 alunos entraram. Nenhuma linha ficou de fora.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDaTabela(lista).filter({ hasText: 'João Conceição' }).filter({ hasText: '900101' })).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDaTabela(lista).filter({ hasText: 'Antônia Araújo' }).filter({ hasText: '900102' })).toHaveCount(1)

    // O UTF-8 com BOM e vírgula, como o Google Planilhas salva: sem erro, e grava. O clique duplo manda um pedido só.
    const marca = randomUUID().slice(0, 8)
    // Dois alunos com o mesmo nome na turma, o primeiro e o último, cada um com a sua matrícula.
    const homonimo = `Ígor Ávila ${marca}`
    const nomes = [homonimo, `Luíza Góes ${marca}`, `Otávio Ümit ${marca}`, homonimo]
    const utf8 = `nome,matrícula\n${nomes.map((nome, posicao) => `${nome},${String(880001 + posicao)}`).join('\n')}\n`
    const comBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(utf8, 'utf8')])
    gravacoes.length = 0
    await escolher(page, 'lista.csv', comBom)
    // Arquivo novo: o resultado de antes sai, e a prévia é a deste arquivo.
    await expect(resultadoDaGravacao(page)).toHaveCount(0)
    await expect(principal(page).getByText('Arquivo lido: lista.csv.')).toBeVisible()
    await expect(resumoDaPrevia(page, '4 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await previa.getByRole('button', { name: 'Gravar lista' }).dblclick()
    await expect(resultadoDaGravacao(page)).toContainText('4 alunos entraram. Nenhuma linha ficou de fora.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(gravacoes).toHaveLength(1)
    // O foco vai ao resultado, e os nomes gravados já estão na tabela, cada um com a sua matrícula (os dois homônimos, a primeira e a quarta).
    await expect(resultadoDaGravacao(page).getByRole('heading', { name: 'Planilha gravada' })).toBeFocused()
    for (const nome of nomes) await expect(lista).toContainText(nome)
    for (const [posicao, nome] of nomes.entries())
      await expect(linhasDaTabela(lista).filter({ hasText: nome }).filter({ hasText: String(880001 + posicao) })).toHaveCount(1)

    // Mesma entrada: a mesma lista de novo sai "já existe", sem duplicar, e não há o que gravar.
    await escolher(page, 'lista.csv', comBom)
    await expect(resultadoDaGravacao(page)).toHaveCount(0)
    await expect(resumoDaPrevia(page, '4 linhas lidas · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(previa.getByRole('region', { name: 'O resto da planilha' })).toContainText('4 linhas já existem, e nada muda')
    await expect(previa).toContainText('Nada novo para gravar')
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    await expect(linhasDaTabela(lista)).toHaveCount(6)

    // Dois alunos com o mesmo nome: cada "Retirar" diz a matrícula, e a confirmação também. Sai o da matrícula
    // escolhida, e o outro fica.
    await expect(lista.getByRole('button', { name: `Retirar ${homonimo}, matrícula 880001 da lista` })).toBeVisible()
    await activate(lista.getByRole('button', { name: `Retirar ${homonimo}, matrícula 880004 da lista` }), hasTouch)
    const retirar = dialogo(page, 'Retirar o nome da lista')
    await expect(retirar).toContainText(`${homonimo}, matrícula 880004, sai da lista desta turma`)
    await activate(retirar.getByRole('button', { name: 'Retirar da lista' }), hasTouch)
    await expect(anuncio(secao(page, 'Nomes da turma'), 'Nome retirado da lista.')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDaTabela(lista)).toHaveCount(5)
    // Fica o homônimo da matrícula 880001, na linha dele; a 880004 saiu da região inteira.
    await expect(linhasDaTabela(lista).filter({ hasText: homonimo })).toHaveCount(1)
    await expect(linhasDaTabela(lista).filter({ hasText: homonimo })).toContainText('880001')
    await expect(lista).not.toContainText('880004')

    // A coluna que parece CPF segura a gravação (aluno não tem CPF, regra 20): a linha diz o porquê, e o motivo é o da coluna.
    await escolher(page, 'cpf.csv', `nome;matrícula\nCom documento ${marca};123.456.789-09`)
    await expect(resumoDaPrevia(page, '1 linha lida · 1 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(previa.getByRole('region', { name: 'Linhas com erro (1)' }).getByRole('listitem')).toContainText('Parece CPF ou data de nascimento, e não matrícula')
    await expect(previa).toContainText('Nada é gravado enquanto a coluna da matrícula parecer CPF ou data de nascimento.')
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)

    // Sem rastro: nome e matrícula não vão para o armazenamento do navegador nem para o endereço, e a tela não cria
    // banco nem cache no navegador.
    const guardado = await page.evaluate(async () => ({
      texto: JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), location.href]),
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    for (const dado of [...nomes, '880001', 'João', '900101']) expect(guardado.texto).not.toContain(dado)
    expect(guardado.bancos).toEqual([])
    expect(guardado.caches).toEqual([])
  })

  test('a lista paginada de cem em cem, sem releitura ao voltar para a aba, com o nome que o aluno já pediu', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const marca = randomUUID().slice(0, 8)
    // 101 nomes: a primeira página traz 100, e o reivindicado é o primeiro depois da primeira.
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [
      { nome: `Primeira da lista ${marca}`, matricula: '660001' },
      ...Array.from({ length: 99 }, (_, posicao) => ({ nome: `Colega ${String(posicao)} ${marca}`, matricula: String(661000 + posicao) })),
      { nome: `Já pediu o nome ${marca}`, matricula: '669999', estado: 'reivindicado' as const },
    ])
    const leituras: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'GET' && new URL(pedido.url()).pathname === `/v1/turmas/${turma.id}/lista`) leituras.push(pedido)
    })
    await abrirATurma(page, request, coordenadora, turma)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista).toContainText('Mostrando os primeiros 100 nomes')
    await expect(linhasDaTabela(lista)).toHaveCount(100)

    // Cada leitura da coordenação vai para a auditoria: voltar para a aba, uma hora depois, relê o que envelhece (a turma
    // aberta), e não a lista. A releitura da turma é o sinal de que a volta foi tratada: a da lista sairia junto com ela,
    // depois de a sessão renovar, e não num prazo que o teste teria de adivinhar.
    expect(leituras).toHaveLength(1)
    const releituraDaTurma = page.waitForResponse((resposta) => resposta.request().method() === 'GET' && new URL(resposta.url()).pathname === `/v1/turmas/${turma.id}`, {
      timeout: SIGN_IN_TIMEOUT_MS,
    })
    await page.evaluate(() => {
      const agora = Date.now()
      Date.now = () => agora + 60 * 60 * 1_000
      window.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    await (await releituraDaTurma).finished()
    expect(leituras).toHaveLength(1)

    // A página seguinte: o nome que o aluno já pediu, sem "Retirar", com o estado em texto.
    await lista.getByRole('button', { name: 'Ver mais nomes' }).click()
    await expect(linhasDaTabela(lista)).toHaveCount(101, { timeout: SIGN_IN_TIMEOUT_MS })
    // As leituras até aqui: a de abrir a turma e a da página seguinte, e nenhuma pela volta para a aba.
    expect(leituras).toHaveLength(2)
    await expect(lista).toContainText('101 nomes na lista')
    const reivindicado = linhasDaTabela(lista).filter({ hasText: `Já pediu o nome ${marca}` })
    await expect(reivindicado).toContainText('O aluno pediu o nome: esperando a decisão')
    await expect(reivindicado.getByRole('button')).toHaveCount(0)
    await expect(lista.getByRole('button', { name: `Retirar Primeira da lista ${marca}, matrícula 660001 da lista` })).toBeVisible()
  })

  test('o que a tela segura antes de enviar: o arquivo grande demais e o que não é planilha, sem pedir nada à API; a prévia que a API recusa leva o foco ao aviso', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const previas: Request[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === `/v1/turmas/${turma.id}/lista/previa`) previas.push(pedido)
    })
    await abrirATurma(page, request, coordenadora, turma)
    const aviso = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('alert')

    // O arquivo acima de 512 KB e o que não é planilha (um .xls antigo): a tela diz o que fazer, e a API não é chamada. O teto de 3.000 linhas é do e2e `importar-alunos` (por arquivo).
    await escolher(page, 'grande.csv', Buffer.alloc(512 * 1024 + 4, 'a'))
    await expect(aviso).toHaveText('A planilha é grande demais para um envio só (o limite é 512 KB). Divida em partes e envie uma de cada vez.')
    await escolher(page, 'lista.xls', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(2_000)]), 'application/vnd.ms-excel')
    await expect(aviso).toContainText('Este arquivo não é uma planilha que a tela leia.')
    expect(previas).toHaveLength(0)

    // A prévia que a API recusa (só o cabeçalho, sem aluno): a tela diz o que conferir e leva o foco ao aviso.
    await escolher(page, 'vazia.csv', 'nome;matrícula\n')
    await expect(aviso).toContainText('Não deu para ler a lista. Confira se cada linha tem o nome e a matrícula', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aviso).toBeFocused()
    expect(previas).toHaveLength(1)
    // O arquivo novo tira o aviso do anterior.
    await escolher(page, 'boa.csv', 'nome;matrícula\nAna Souza;660050\n')
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aviso).toHaveCount(0)
  })

  test('a resposta atrasada da prévia do arquivo anterior não aparece no lugar da do novo', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const marca = randomUUID().slice(0, 8)
    await abrirATurma(page, request, coordenadora, turma)
    const segurada = gate()
    // O pedido segurado terminou: o fim dele, e não um tempo qualquer, é o que o caso espera antes de olhar a tela.
    const terminou = gate()
    let primeira = true
    await page.route(`**/v1/turmas/${turma.id}/lista/previa`, async (rota: Route) => {
      const seguro = primeira
      primeira = false
      if (seguro) await segurada.aberta
      await rota.continue().catch(() => undefined)
      if (seguro) terminou.abrir()
    })
    await escolher(page, 'antigo.csv', `nome;matrícula\nAluno antigo ${marca};660002\nOutro antigo ${marca};660003\n`)
    await escolher(page, 'novo.csv', `nome;matrícula\nAluno novo ${marca};660004\n`)
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    segurada.abrir()
    await terminou.aberta
    // Dois quadros depois do fim do pedido: a página já teve onde desenhar a resposta antiga, se ela fosse desenhada.
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible()
    await expect(principal(page)).not.toContainText('2 linhas lidas')
  })

  test('o "Gravar lista" refaz a prévia: a matrícula que outra pessoa pôs em outra turma depois da prévia não entra, e a lista recarrega com o que ela pôs', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A', '7B'])
    const [turma, outraTurma] = estrutura.turmas
    if (turma === undefined || outraTurma === undefined) throw new Error('estrutura sem as duas turmas')
    const marca = randomUUID().slice(0, 8)
    await abrirATurma(page, request, coordenadora, turma)
    await escolher(page, 'lista.csv', `nome;matrícula\nAluno novo ${marca};660003\n`)
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // Outra pessoa põe a mesma matrícula na lista de outra turma, e um nome na desta, depois da prévia.
    await porNaListaDaTurma(coordenadora.escolaId, outraTurma.id, [{ nome: `Da outra turma ${marca}`, matricula: '660003' }])
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [{ nome: `Chegou durante a prévia ${marca}`, matricula: '660070' }])
    // O gravar refaz a prévia no servidor (não há janela entre as duas): a matrícula que já é de outra pessoa não entra, e a tela diz o que gravou.
    await previaDaLista(page).getByRole('button', { name: 'Gravar lista' }).click()
    const gravada = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('region', { name: 'Planilha gravada' })
    // A frase inteira: a linha que a prévia dava como gravada e a escola mudou antes do gravar não vira "nenhuma linha ficou de fora".
    await expect(gravada).toContainText(
      '0 alunos entraram. 1 linha ficou de fora: a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.',
      { timeout: SIGN_IN_TIMEOUT_MS },
    )
    await expect(previaDaLista(page)).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    // A lista recarrega com o que outra pessoa pôs nela, e o nome da prévia não entrou.
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista).toContainText(`Chegou durante a prévia ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista).not.toContainText(`Aluno novo ${marca}`)
  })

  test('a gravação que cai com o servidor fora do ar diz o que fazer e deixa a prévia; com o servidor de volta, a mesma prévia grava', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const marca = randomUUID().slice(0, 8)
    await abrirATurma(page, request, coordenadora, turma)
    await escolher(page, 'lista.csv', `nome;matrícula\nAluno novo ${marca};660004\n`)
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    let foraDoAr = true
    await page.route(`**/v1/turmas/${turma.id}/lista`, (rota: Route) =>
      foraDoAr && rota.request().method() === 'POST' ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue(),
    )
    const aviso = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('alert')
    await previaDaLista(page).getByRole('button', { name: 'Gravar lista' }).click()
    await expect(aviso).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aviso).toBeFocused()
    // A prévia não envelheceu: ela fica, com o botão, e gravar de novo funciona.
    await expect(previaDaLista(page).getByRole('button', { name: 'Gravar lista' })).toBeVisible()
    foraDoAr = false
    await previaDaLista(page).getByRole('button', { name: 'Gravar lista' }).click()
    await expect(resultadoDaGravacao(page)).toContainText('1 aluno entrou.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('region', { name: 'Nomes da turma' })).toContainText(`Aluno novo ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('o nome avulso, o aluno que chega em maio, e a retirada do nome livre', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem turma')
    const marca = randomUUID().slice(0, 8)
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [{ nome: `Primeira da lista ${marca}`, matricula: '660001' }])
    await abrirATurma(page, request, coordenadora, turma)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(lista.getByRole('button', { name: 'Acrescentar um nome' }), hasTouch)
    const avulso = dialogo(page, 'Acrescentar um nome')
    await expect(avulso.getByLabel('Matrícula')).toHaveAttribute('autocomplete', 'off')
    // Nome e matrícula de aluno não vão para o corretor ortográfico do navegador.
    for (const rotulo of ['Nome do aluno', 'Matrícula']) await expect(avulso.getByLabel(rotulo)).toHaveAttribute('spellcheck', 'false')
    // Sem o nome ou sem a matrícula, o erro fica no campo que falta, e nada é enviado.
    const avulsos: Request[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === `/v1/turmas/${turma.id}/lista/nome`) avulsos.push(pedido)
    })
    const semNome = avulso.getByText('Digite o nome do aluno.')
    const semMatricula = avulso.getByText('Digite a matrícula do aluno.')
    await avulso.getByLabel('Matrícula').fill('660001')
    await activate(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(semNome).toBeVisible()
    await expect(semMatricula).toHaveCount(0)
    await expect(avulso.getByLabel('Nome do aluno')).toBeFocused()
    await avulso.getByLabel('Nome do aluno').fill(`Aluno de maio ${marca}`)
    await avulso.getByLabel('Matrícula').fill('  ')
    await activate(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(semMatricula).toBeVisible()
    await expect(semNome).toHaveCount(0)
    await expect(avulso.getByLabel('Matrícula')).toBeFocused()
    // A matrícula que parece CPF ou data de nascimento tem a mesma trava da planilha (aluno não tem CPF, regra 20).
    for (const documento of ['123.456.789-09', '01/02/2012']) {
      await avulso.getByLabel('Matrícula').fill(documento)
      await activate(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
      await expect(avulso.getByText('Isto parece CPF ou data de nascimento, e não matrícula.')).toBeVisible()
      await expect(avulso.getByLabel('Matrícula')).toBeFocused()
    }
    expect(avulsos).toHaveLength(0)
    await avulso.getByLabel('Matrícula').fill('660001')
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [{ nome: `Chegou durante o avulso ${marca}`, matricula: '660071' }])
    await activate(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    // A matrícula já está na lista: nada gravado, o que fazer, e a lista recarrega (com o nome que chegou enquanto isso).
    await expect(avulso.getByRole('alert')).toContainText('Esta matrícula já está na lista', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista).toContainText(`Chegou durante o avulso ${marca}`)
    await avulso.getByLabel('Matrícula').fill('660009')
    await activate(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(avulso).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista).toContainText(`Aluno de maio ${marca}`)
    expect(avulsos).toHaveLength(2)

    // Retirar o nome livre: sai, e o foco vai para o título dos nomes. Abrir o diálogo apaga o anúncio da ação anterior.
    await expect(anuncio(lista, 'Nome acrescentado à lista da turma.')).toBeVisible()
    await activate(lista.getByRole('button', { name: `Retirar Aluno de maio ${marca}, matrícula 660009 da lista` }), hasTouch)
    await expect(dialogo(page, 'Retirar o nome da lista')).toBeVisible()
    await expect(page.getByText('Nome acrescentado à lista da turma.')).toHaveCount(0)
    await activate(dialogo(page, 'Retirar o nome da lista').getByRole('button', { name: 'Retirar da lista' }), hasTouch)
    await expect(anuncio(secao(page, 'Nomes da turma'), 'Nome retirado da lista.')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista).not.toContainText(`Aluno de maio ${marca}`)
    await expect(principal(page).getByRole('heading', { name: 'Nomes da turma' })).toBeFocused()
  })

  test('outra turma aberta pelo histórico recomeça a tela, sem a prévia da anterior; "Voltar para Escola" leva à lista de turmas', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A', '7B'])
    const [turma, outraTurma] = estrutura.turmas
    if (turma === undefined || outraTurma === undefined) throw new Error('estrutura sem as duas turmas')
    const marca = randomUUID().slice(0, 8)
    await abrirATurma(page, request, coordenadora, turma)
    await escolher(page, 'rascunho.csv', `nome;matrícula\nRascunho da 7A ${marca};669000\n`)
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // Outra turma, pelo histórico e sem passar pela Estrutura: a tela recomeça, sem a prévia da anterior (que "Gravar lista" mandaria para a turma nova).
    await irParaOEndereco(page, `/coordenacao/estrutura/turmas/${outraTurma.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${outraTurma.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(previaDaLista(page)).toHaveCount(0)
    await expect(principal(page)).not.toContainText(`Rascunho da 7A ${marca}`)
    await expect(principal(page).getByText('Nenhuma planilha escolhida')).toBeVisible()
    // "Voltar para Escola" leva de volta à lista de turmas.
    await activate(principal(page).getByRole('link', { name: 'Voltar para Escola' }), hasTouch)
    await esperarEstrutura(page)
  })

  test('o erro da leitura da lista com "Tentar de novo", na seção dela, e a nova tentativa traz os nomes', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem a turma')
    const marca = randomUUID().slice(0, 8)
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [
      { nome: `Primeira da lista ${marca}`, matricula: '660001' },
      { nome: `Segunda da lista ${marca}`, matricula: '660002' },
    ])
    let falhar = true
    await page.route(`**/v1/turmas/${turma.id}/lista?*`, (rota: Route) => (falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue()))
    await abrirATurma(page, request, coordenadora, turma)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await seriousViolations(page)).toEqual([])
    falhar = false
    await activate(lista.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('a turma aberta tem o seu carregando: a leitura segurada mostra o estado, e liberada traz a turma', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem a turma')
    const turmaSegurada = gate()
    await page.route(`**/v1/turmas/${turma.id}`, async (rota: Route) => {
      await turmaSegurada.aberta
      await rota.continue()
    })
    // A entrada pela API não espera a tela (o `aguardar` fica vazio): a leitura segurada é o que a tela mostra como carregando.
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, `/coordenacao/estrutura/turmas/${turma.id}`)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a turma…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    turmaSegurada.abrir()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('a turma aberta tem o seu erro: a leitura recusada diz o que fazer, com o caminho de volta, e "Tentar de novo" traz a turma', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem a turma')
    let falharTurma = true
    await page.route(`**/v1/turmas/${turma.id}`, async (rota: Route) => {
      await (falharTurma ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue())
    })
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, `/coordenacao/estrutura/turmas/${turma.id}`)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('link', { name: 'Voltar para Escola' })).toBeVisible()
    falharTurma = false
    await activate(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('a turma que outra pessoa excluiu entre a prévia e o "Gravar lista": a API responde como inexistente, a tela diz que nada foi gravado, e a prévia sai', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem a turma')
    const marca = randomUUID().slice(0, 8)
    await abrirATurma(page, request, coordenadora, turma)
    await escolher(page, 'lista.csv', `nome;matrícula\nAluno tardio ${marca};660090\n`)
    await expect(resumoDaPrevia(page, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await apagarTurmaNoBanco(coordenadora.escolaId, turma.id)
    await previaDaLista(page).getByRole('button', { name: 'Gravar lista' }).click()
    const aviso = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('alert')
    await expect(aviso).toHaveText('Esta turma não está mais no ano letivo em curso. Nada foi gravado.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(previaDaLista(page)).toHaveCount(0)
  })
})

/** Vai a um endereço da área pelo histórico, sem passar pela Estrutura: o que o botão "Voltar" do navegador faria. */
const irParaOEndereco = (page: Page, destino: string) =>
  page.evaluate((caminho) => {
    window.history.pushState(null, '', caminho)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, destino)

test.describe('RF16 (9.0): os professores da turma, ao lado dos nomes', () => {
  test('duas disciplinas do mesmo professor são duas linhas, cada uma com o estado em texto e o link para o painel dele; a turma sem professor diz que não há; a lista de nomes continua lida uma vez só', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const camila = await convidarProfessorNoBanco(coordenadora.escolaId, 'ativo', 'Camila')
    const alocacao = await criarAlocacaoDoProfessor(coordenadora.escolaId, camila.usuarioId, ['Matemática', 'Ciências'])
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['8B'])
    const [semProfessor] = estrutura.turmas
    if (semProfessor === undefined) throw new Error('estrutura sem turma')
    const leituras: Request[] = []
    const professoresLidos: Request[] = []
    page.on('request', (pedido) => {
      const caminho = new URL(pedido.url()).pathname
      if (pedido.method() === 'GET' && caminho === `/v1/turmas/${alocacao.turmaId}/lista`) leituras.push(pedido)
      if (pedido.method() === 'GET' && (caminho === '/v1/vinculos' || caminho === '/v1/professores')) professoresLidos.push(pedido)
    })
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(alocacao.turmaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirTurma(page, alocacao.turmaNome, hasTouch)

    // Uma linha por vínculo: o professor aparece duas vezes, cada uma com a sua disciplina (em ordem), e o vínculo nasceu
    // esperando a confirmação dele. O link leva ao painel do professor, só com o id no endereço.
    const professores = secao(page, 'Professores da turma')
    const links = professores.getByRole('link')
    await expect(links).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })
    for (const [posicao, disciplina] of ['Ciências', 'Matemática'].entries()) {
      await expect(links.nth(posicao)).toContainText(camila.nome)
      await expect(links.nth(posicao)).toContainText(disciplina)
      await expect(links.nth(posicao)).toContainText('Esperando o professor confirmar')
      await expect(links.nth(posicao)).toHaveAttribute('href', `/coordenacao/professores?professor=${camila.usuarioId}`)
    }
    // Ler os professores da turma não é ler a lista de nomes: a lista saiu uma vez, ao abrir, e nenhuma leitura de professor leva finalidade.
    expect(leituras).toHaveLength(1)
    expect(professoresLidos.length).toBeGreaterThan(0)
    for (const leitura of professoresLidos) expect(new URL(leitura.url()).searchParams.has('finalidade')).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    expect(await horizontalOverflow(page)).toBe(0)

    // O professor confirma, e a tela diz em texto, depois de a leitura ser feita de novo.
    await confirmarVinculosNoBanco(coordenadora.escolaId, alocacao.vinculoIds)
    await page.reload()
    await expect(professores.getByRole('link').first()).toContainText('Confirmado pelo professor', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(professores.getByRole('link').last()).toContainText('Confirmado pelo professor')

    // O link abre Professores, com o professor no endereço.
    await activate(professores.getByRole('link').first(), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/coordenacao/professores\\?professor=${camila.usuarioId}$`), { timeout: SIGN_IN_TIMEOUT_MS })
    await page.goBack()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${alocacao.turmaNome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    // A turma sem professor diz que não há, com o caminho para Professores.
    await irParaOEndereco(page, `/coordenacao/estrutura/turmas/${semProfessor.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${semProfessor.nome}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(professores).toContainText('Nenhum professor nesta turma', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(professores.getByRole('link')).toHaveCount(0)
    await activate(professores.getByRole('button', { name: 'Ver os professores' }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('a 1366 × 768 há duas colunas, a página fica parada e a lista rola dentro do miolo, que se alcança pelo teclado; a 360 px é uma coluna só, a página rola e nada rola de lado', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const camila = await convidarProfessorNoBanco(coordenadora.escolaId, 'ativo', 'Camila')
    const alocacao = await criarAlocacaoDoProfessor(coordenadora.escolaId, camila.usuarioId, ['Matemática'])
    const marca = randomUUID().slice(0, 8)
    // Cem nomes: a lista passa da altura da janela nos dois perfis.
    await porNaListaDaTurma(
      coordenadora.escolaId,
      alocacao.turmaId,
      Array.from({ length: 100 }, (_, posicao) => ({ nome: `Colega ${String(posicao)} ${marca}`, matricula: String(770000 + posicao) })),
    )
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(alocacao.turmaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirTurma(page, alocacao.turmaNome, hasTouch)
    const nomes = secao(page, 'Nomes da turma')
    const professores = secao(page, 'Professores da turma')
    const subir = secao(page, 'Subir a lista de nomes')
    await expect(linhasDaTabela(nomes)).toHaveCount(100, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(professores.getByRole('link')).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    const [caixaDosNomes, caixaDosProfessores, caixaDoEnvio] = await Promise.all([nomes.boundingBox(), professores.boundingBox(), subir.boundingBox()])
    if (caixaDosNomes === null || caixaDosProfessores === null || caixaDoEnvio === null) throw new Error('uma das seções não tem caixa na tela')
    const miolo = principal(page).getByRole('region', { name: `Turma ${alocacao.turmaNome}` })
    const largura = page.viewportSize()?.width ?? 0

    if (largura >= 1024) {
      // Duas colunas: os professores à direita dos nomes, e no alto, na altura do envio da lista.
      expect(caixaDosProfessores.x).toBeGreaterThanOrEqual(caixaDosNomes.x + caixaDosNomes.width - 1)
      expect(Math.abs(caixaDosProfessores.y - caixaDoEnvio.y)).toBeLessThan(2)
      // A página não rola; quem rola é o miolo, que recebe foco, e o teclado o alcança.
      await paginaNaoRola(page)
      await expect(miolo).toHaveAttribute('tabindex', '0')
      expect(await miolo.evaluate((elemento) => elemento.scrollHeight > elemento.clientHeight)).toBe(true)
      await miolo.focus()
      await page.keyboard.press('End')
      await expect.poll(() => miolo.evaluate((elemento) => elemento.scrollTop)).toBeGreaterThan(0)
      await paginaNaoRola(page)
    } else {
      // Uma coluna, na ordem do documento: os professores abaixo dos nomes, na mesma largura. A página é que rola.
      expect(caixaDosProfessores.y).toBeGreaterThanOrEqual(caixaDosNomes.y + caixaDosNomes.height - 1)
      expect(Math.abs(caixaDosProfessores.x - caixaDosNomes.x)).toBeLessThan(2)
      expect(Math.abs(caixaDosProfessores.width - caixaDosNomes.width)).toBeLessThan(2)
      await expect(miolo).not.toHaveAttribute('tabindex')
      expect(await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight)).toBe(true)
      expect(await horizontalOverflow(page)).toBe(0)
    }
    expect(await seriousViolations(page)).toEqual([])
  })
})
