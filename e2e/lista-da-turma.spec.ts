import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { entrarComoCoordenacaoNaMesmaAba, abrirEstrutura, esperarEstrutura, esperarPainel, PRAZO_DA_ENTRADA_MS } from './__fixtures__/casca.ts'
import { linhasDaTabela, paginaNaoRola } from './__fixtures__/coordenacao.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import {
  apagarTurmaNoBanco,
  confirmarVinculosNoBanco,
  convidarProfessorNoBanco,
  criarAlocacaoDoProfessor,
  criarEquipeComSenha,
  montarEstruturaNoBanco,
  porNaListaDaTurma,
} from './__fixtures__/sessao.ts'
import { larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

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
const ARQUIVO_DO_EXCEL = 'e2e/__fixtures__/lista-excel.csv'

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
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
  await acionar(principal(page).getByRole('link', { name: `Lista de nomes da turma ${nome}` }), hasTouch)
  await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
}

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
    const segurarLeitura = portao()
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
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(turma.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirTurma(page, turma.nome, hasTouch)
    await expect(page).toHaveTitle(`Turma ${turma.nome} · Turmma`)

    // Carregando, e depois o vazio com o que fazer.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a lista de nomes…' })).toBeVisible()
    segurarLeitura.abrir()
    await expect(principal(page)).toContainText('Cole a lista ou envie o arquivo: nome; matrícula', { timeout: PRAZO_DA_ENTRADA_MS })
    // A leitura leva a finalidade (regra 20, item 10).
    expect(new URL(leiturasDaLista[0]?.url() ?? 'http://x').searchParams.get('finalidade')).toBe('conferencia_de_cadastro')
    await expect(principal(page)).toContainText('nome; matrícula')
    expect(await violacoesGraves(page)).toEqual([])

    // O arquivo do Excel: windows-1252, com `;`, acento, uma linha sem matrícula e uma matrícula repetida.
    const arquivo = principal(page).getByLabel('Ou escolha o arquivo (CSV ou TXT, como o Excel salva)')
    await arquivo.setInputFiles(ARQUIVO_DO_EXCEL)
    await expect(principal(page).getByLabel('Lista colada')).toHaveValue(/João Conceição;900101/)
    // A escolha é limpa depois de lida: a mesma planilha, corrigida e escolhida de novo, dispara outra leitura (no
    // navegador, escolher de novo o arquivo que continua escolhido não avisa a página).
    await expect(arquivo).toHaveValue('')
    await acionar(principal(page).getByRole('button', { name: 'Ver a prévia' }), hasTouch)
    const previa = principal(page).getByRole('region', { name: 'Prévia' })
    await expect(previa.getByRole('status')).toHaveText('1 nome entra · 0 já estão na lista · 3 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    // A prévia que chega leva o foco ao título dela: o leitor de tela lê o resumo e as linhas em seguida.
    await expect(previa.getByRole('heading', { name: 'Prévia' })).toBeFocused()
    // Erros primeiro, na ordem do texto, cada um em texto; depois a linha que entra.
    await expect(previa.getByRole('listitem')).toHaveText([
      /^Linha 2: João Conceição · 900101Erro: Esta matrícula aparece em mais de uma linha do texto\.$/,
      /^Linha 4: Cecília BrandãoErro: Falta a matrícula\.$/,
      /^Linha 5: Érico Ibañez · 900101Erro: Esta matrícula aparece em mais de uma linha do texto\.$/,
      /^Linha 3: Antônia Araújo · 900102Entra na lista\.$/,
    ])
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    await expect(previa).toContainText('a lista só é gravada sem erro nenhum')
    expect(await larguraExcedente(page)).toBe(0)
    // O pedido de foco da prévia é atendido uma vez só: com a prévia na tela, o aviso da planilha recusada leva o foco, e
    // a renderização que ele provoca não o devolve ao título da prévia.
    await arquivo.setInputFiles({ name: 'lista.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(500)]) })
    const avisoDaPlanilha = principal(page).getByRole('region', { name: 'Subir a lista de nomes' }).getByRole('alert')
    await expect(avisoDaPlanilha).toContainText('Este arquivo é uma planilha (.xlsx, .xls ou .ods), e não texto.')
    await expect(previa).toBeVisible()
    await expect(avisoDaPlanilha).toBeFocused()
    // Nem outra renderização o atende de novo: abrir e cancelar o diálogo do nome avulso, com a prévia ainda na tela,
    // devolve o foco ao botão que o abriu, e não ao título da prévia.
    const acrescentar = principal(page).getByRole('button', { name: 'Acrescentar um nome' })
    await acionar(acrescentar, hasTouch)
    await acionar(dialogo(page, 'Acrescentar um nome').getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(previa).toBeVisible()
    await expect(acrescentar).toBeFocused()
    // Voltar ao campo para corrigir: a tecla errada tira a prévia, e apagá-la a traz de volta, porque o texto voltou a
    // ser o dela. O foco fica no campo, e o que a pessoa digita em seguida entra nele.
    const colada = principal(page).getByLabel('Lista colada')
    const lidaDoArquivo = await colada.inputValue()
    await colada.focus()
    await colada.press('Control+End')
    await page.keyboard.type('x')
    await expect(previa).toHaveCount(0)
    await page.keyboard.press('Backspace')
    await expect(previa).toBeVisible()
    await expect(colada).toBeFocused()
    await page.keyboard.type('Zé;900109')
    await expect(colada).toHaveValue(`${lidaDoArquivo}Zé;900109`)

    // O UTF-8 com BOM e vírgula, como o Google Planilhas salva: sem erro, e grava. O clique duplo manda um pedido só.
    const marca = randomUUID().slice(0, 8)
    // Dois alunos com o mesmo nome na turma, o primeiro e o último, cada um com a sua matrícula.
    const homonimo = `Ígor Ávila ${marca}`
    const nomes = [homonimo, `Luíza Góes ${marca}`, `Otávio Ümit ${marca}`, homonimo]
    const utf8 = `nome,matrícula\n${nomes.map((nome, posicao) => `${nome},${String(880001 + posicao)}`).join('\n')}\n`
    const comBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(utf8, 'utf8')])
    await arquivo.setInputFiles({ name: 'lista.csv', mimeType: 'text/csv', buffer: comBom })
    // Editar o texto descarta a prévia do texto anterior.
    await expect(previa).toHaveCount(0)
    // O controle do navegador volta a dizer que não há arquivo escolhido: a tela diz de onde veio o texto.
    const lido = principal(page).getByText('Arquivo lido: lista.csv. O texto dele está no campo acima.')
    await expect(lido).toBeVisible()
    await acionar(principal(page).getByRole('button', { name: 'Ver a prévia' }), hasTouch)
    await expect(previa.getByRole('status')).toHaveText('4 nomes entram · 0 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    for (const nome of nomes) await expect(previa).toContainText(nome)
    await expect(principal(page).getByLabel('Lista colada')).not.toHaveValue(/^\uFEFF/)
    await previa.getByRole('button', { name: 'Gravar lista' }).dblclick()
    await expect(anuncio(secao(page, 'Nomes da turma'), '4 nomes gravados na lista.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(gravacoes).toHaveLength(1)
    await expect(principal(page).getByRole('heading', { name: 'Nomes da turma' })).toBeFocused()
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    for (const nome of nomes) await expect(lista).toContainText(nome)
    // A matrícula está na linha do nome, e não solta na região: cada nome com a sua (os dois homônimos, a primeira e a quarta).
    for (const [posicao, nome] of nomes.entries())
      await expect(linhasDaTabela(lista).filter({ hasText: nome }).filter({ hasText: String(880001 + posicao) })).toHaveCount(1)
    await expect(principal(page).getByLabel('Lista colada')).toHaveValue('')
    await expect(lido).toHaveCount(0)

    // Mesma entrada: a mesma lista de novo sai "já existe", sem duplicar, e não há o que gravar.
    await arquivo.setInputFiles({ name: 'lista.csv', mimeType: 'text/csv', buffer: comBom })
    await expect(arquivo).toHaveValue('')
    await acionar(principal(page).getByRole('button', { name: 'Ver a prévia' }), hasTouch)
    await expect(previa.getByRole('status')).toHaveText('0 nomes entram · 4 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(previa).toContainText('nada muda, nem o nome gravado')
    await expect(previa).toContainText('Nada novo para gravar')
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    await expect(linhasDaTabela(lista)).toHaveCount(4)

    // Dois alunos com o mesmo nome: cada "Retirar" diz a matrícula, e a confirmação também. Sai o da matrícula
    // escolhida, e o outro fica.
    await expect(lista.getByRole('button', { name: `Retirar ${homonimo}, matrícula 880001 da lista` })).toBeVisible()
    await acionar(lista.getByRole('button', { name: `Retirar ${homonimo}, matrícula 880004 da lista` }), hasTouch)
    const retirar = dialogo(page, 'Retirar o nome da lista')
    await expect(retirar).toContainText(`${homonimo}, matrícula 880004, sai da lista desta turma`)
    await acionar(retirar.getByRole('button', { name: 'Retirar da lista' }), hasTouch)
    await expect(anuncio(secao(page, 'Nomes da turma'), 'Nome retirado da lista.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhasDaTabela(lista)).toHaveCount(3)
    // Fica o homônimo da matrícula 880001, na linha dele; a 880004 saiu da região inteira.
    await expect(linhasDaTabela(lista).filter({ hasText: homonimo })).toHaveCount(1)
    await expect(linhasDaTabela(lista).filter({ hasText: homonimo })).toContainText('880001')
    await expect(lista).not.toContainText('880004')

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

  test('a lista paginada, sem releitura ao voltar para a aba; o que a tela segura antes de enviar; a resposta atrasada; a gravação recusada; o avulso e a retirada; a turma aberta pelo histórico e a volta para a Estrutura', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A', '7B'])
    const [turma, outraTurma] = estrutura.turmas
    if (turma === undefined || outraTurma === undefined) throw new Error('estrutura sem as duas turmas')
    const marca = randomUUID().slice(0, 8)
    // 101 nomes: a primeira página traz 100, e o reivindicado é o primeiro depois da primeira.
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [
      { nome: `Primeira da lista ${marca}`, matricula: '660001' },
      ...Array.from({ length: 99 }, (_, posicao) => ({ nome: `Colega ${String(posicao)} ${marca}`, matricula: String(661000 + posicao) })),
      { nome: `Já pediu o nome ${marca}`, matricula: '669999', estado: 'reivindicado' as const },
    ])
    const leituras: Request[] = []
    const previas: Request[] = []
    page.on('request', (pedido) => {
      const caminho = new URL(pedido.url()).pathname
      if (pedido.method() === 'GET' && caminho === `/v1/turmas/${turma.id}/lista`) leituras.push(pedido)
      if (caminho === `/v1/turmas/${turma.id}/lista/previa`) previas.push(pedido)
    })
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(turma.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirTurma(page, turma.nome, hasTouch)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista).toContainText('Mostrando os primeiros 100 nomes')
    await expect(linhasDaTabela(lista)).toHaveCount(100)

    // Cada leitura da coordenação vai para a auditoria: voltar para a aba, uma hora depois, relê o que envelhece (a turma
    // aberta), e não a lista. A releitura da turma é o sinal de que a volta foi tratada: a da lista sairia junto com ela,
    // depois de a sessão renovar, e não num prazo que o teste teria de adivinhar.
    expect(leituras).toHaveLength(1)
    const releituraDaTurma = page.waitForResponse((resposta) => resposta.request().method() === 'GET' && new URL(resposta.url()).pathname === `/v1/turmas/${turma.id}`, {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    await page.evaluate(() => {
      const agora = Date.now()
      Date.now = () => agora + 60 * 60 * 1_000
      window.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    await (await releituraDaTurma).finished()
    expect(leituras).toHaveLength(1)
    await page.evaluate(() => {
      Date.now = () => new Date().getTime()
    })

    // A página seguinte: o nome que o aluno já pediu, sem "Retirar", com o estado em texto.
    await acionar(lista.getByRole('button', { name: 'Ver mais nomes' }), hasTouch)
    await expect(linhasDaTabela(lista)).toHaveCount(101, { timeout: PRAZO_DA_ENTRADA_MS })
    // As leituras até aqui: a de abrir a turma e a da página seguinte, e nenhuma pela volta para a aba.
    expect(leituras).toHaveLength(2)
    await expect(lista).toContainText('101 nomes na lista')
    const reivindicado = linhasDaTabela(lista).filter({ hasText: `Já pediu o nome ${marca}` })
    await expect(reivindicado).toContainText('O aluno pediu o nome: esperando a decisão')
    await expect(reivindicado.getByRole('button')).toHaveCount(0)
    await expect(lista.getByRole('button', { name: `Retirar Primeira da lista ${marca}, matrícula 660001 da lista` })).toBeVisible()

    // O que a tela segura antes de enviar: o texto vazio, a lista acima de 200 nomes e o arquivo acima de 64 KB.
    const campo = principal(page).getByLabel('Lista colada')
    const verPrevia = principal(page).getByRole('button', { name: 'Ver a prévia' })
    const subir = principal(page).getByRole('region', { name: 'Subir a lista de nomes' })
    await acionar(verPrevia, hasTouch)
    await expect(subir.getByRole('alert')).toHaveText('Cole a lista ou escolha o arquivo antes de ver a prévia.')
    await campo.fill(Array.from({ length: 202 }, (_, posicao) => `Aluno ${String(posicao)};${String(700000 + posicao)}`).join('\n'))
    await acionar(verPrevia, hasTouch)
    await expect(subir.getByRole('alert')).toHaveText('A lista passa de 200 nomes. Divida em partes e envie uma de cada vez.')
    await principal(page)
      .getByLabel('Ou escolha o arquivo (CSV ou TXT, como o Excel salva)')
      .setInputFiles({ name: 'grande.csv', mimeType: 'text/csv', buffer: Buffer.alloc(64 * 1024 + 4, 'a') })
    await expect(subir.getByRole('alert')).toHaveText('A lista é grande demais para um envio só. Divida em partes e envie uma de cada vez.')
    // A planilha do Excel (um zip) não é texto: a tela diz para salvar como CSV, em vez de encher o campo de lixo.
    await principal(page)
      .getByLabel('Ou escolha o arquivo (CSV ou TXT, como o Excel salva)')
      .setInputFiles({ name: 'lista.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2_000)]) })
    await expect(subir.getByRole('alert')).toContainText('Este arquivo é uma planilha (.xlsx, .xls ou .ods), e não texto.')
    await expect(campo).not.toHaveValue(/PK/)
    expect(previas).toHaveLength(0)

    // A prévia que a API recusa (só o cabeçalho, sem aluno): a tela diz o que conferir, e o aviso é do texto que foi
    // recusado, e sai quando o texto muda.
    await campo.fill('nome;matrícula')
    // O aviso do teto era do texto de antes: o texto novo o tira.
    await expect(subir.getByRole('alert')).toHaveCount(0)
    await acionar(verPrevia, hasTouch)
    await expect(subir.getByRole('alert')).toContainText('Não deu para ler a lista. Confira se cada linha tem o nome e a matrícula', { timeout: PRAZO_DA_ENTRADA_MS })
    // O alerta da prévia recusada leva o foco quando a resposta chega; quando ele volta porque o texto voltou a ser o
    // recusado (uma tecla errada e apagada), o foco fica no campo, e o que a pessoa digita em seguida entra nele.
    await expect(subir.getByRole('alert')).toBeFocused()
    await campo.focus()
    await campo.press('Control+End')
    await page.keyboard.type('x')
    await expect(subir.getByRole('alert')).toHaveCount(0)
    await page.keyboard.press('Backspace')
    await expect(subir.getByRole('alert')).toBeVisible()
    await expect(campo).toBeFocused()
    await page.keyboard.type('\nAna;1')
    await expect(campo).toHaveValue('nome;matrícula\nAna;1')
    await expect(subir.getByRole('alert')).toHaveCount(0)
    expect(previas).toHaveLength(1)
    await campo.fill('nome;matrícula\n')
    await expect(subir.getByRole('alert')).toHaveCount(0)
    expect(previas).toHaveLength(1)

    // O que o leitor aceita calado e a tela aponta: o cabeçalho que ele não reconhece entra como aluno, e a coluna que
    // parece CPF segura a gravação (aluno não tem CPF, regra 20).
    await campo.fill(`Aluno;RA\nCom documento ${marca};123.456.789-09`)
    await acionar(verPrevia, hasTouch)
    const comAvisos = principal(page).getByRole('region', { name: 'Prévia' })
    // A linha que parece CPF é erro da API (correção 2026-10-03-trava-de-documento-so-na-tela), e não "entra".
    await expect(comAvisos.getByRole('status')).toHaveText('1 nome entra · 0 já estão na lista · 1 linha com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(comAvisos).toContainText('A primeira linha parece um cabeçalho, e vai entrar como aluno.')
    await expect(comAvisos).toContainText('A segunda coluna parece CPF ou data de nascimento, e não matrícula.')
    // A linha suspeita diz o porquê, como erro, em vez de "Entra na lista", e o motivo de não gravar não repete o aviso.
    await expect(comAvisos.getByRole('listitem').filter({ hasText: '123.456.789-09' })).toContainText('Parece CPF ou data de nascimento, e não matrícula: confira esta linha.')
    await expect(comAvisos.getByRole('listitem').filter({ hasText: '123.456.789-09' })).not.toContainText('Entra na lista')
    await expect(comAvisos).toContainText('Nada é gravado enquanto a segunda coluna parecer CPF ou data de nascimento.')
    await expect(comAvisos.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)
    // O título antes da lista, com vírgula: o leitor passa a separar pela vírgula, as linhas com ";" saem sem matrícula, e
    // a tela diz para tirar o título.
    await campo.fill(`Turma 8ºA, manhã\nAna ${marca};660080\nBia ${marca};660081`)
    await acionar(verPrevia, hasTouch)
    await expect(comAvisos.getByRole('status')).toContainText('2 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(comAvisos).toContainText('Quase todas as linhas ficaram sem matrícula. Se a primeira linha é um título')
    await expect(comAvisos.getByRole('button', { name: 'Gravar lista' })).toHaveCount(0)

    // A resposta que chega com o foco já de volta no campo (a rede lenta): a prévia aparece, o foco fica onde a pessoa
    // está, e o que ela digita em seguida entra no campo.
    let segurada = portao()
    await page.route(`**/v1/turmas/${turma.id}/lista/previa`, async (rota: Route) => {
      await segurada.aberta
      await rota.continue()
    })
    await campo.fill(`Aluno antigo ${marca};660002`)
    const lenta = page.waitForResponse((pedido) => new URL(pedido.url()).pathname.endsWith('/lista/previa'))
    await acionar(verPrevia, hasTouch)
    await campo.focus()
    segurada.abrir()
    await (await lenta).finished()
    await expect(principal(page).getByRole('region', { name: 'Prévia' })).toBeVisible()
    await expect(campo).toBeFocused()
    await campo.press('Control+End')
    await page.keyboard.type('9')
    await expect(campo).toHaveValue(`Aluno antigo ${marca};6600029`)

    // De um botão, o foco vai: quem deu um Tab durante a espera e parou em "Acrescentar um nome" não estava digitando, e
    // é pelo foco no título que o leitor de tela fica sabendo que a prévia pedida chegou.
    segurada = portao()
    await campo.fill(`Aluno do tab ${marca};660005`)
    const comTab = page.waitForResponse((pedido) => new URL(pedido.url()).pathname.endsWith('/lista/previa'))
    await acionar(verPrevia, hasTouch)
    await page.keyboard.press('Tab')
    await expect(lista.getByRole('button', { name: 'Acrescentar um nome' })).toBeFocused()
    segurada.abrir()
    await (await comTab).finished()
    await expect(principal(page).getByRole('region', { name: 'Prévia' }).getByRole('heading', { name: 'Prévia' })).toBeFocused()

    // Resposta atrasada: a prévia do texto de antes chega depois da edição e não aparece.
    segurada = portao()
    await campo.fill(`Aluno antigo ${marca};660002`)
    const resposta = page.waitForResponse((pedido) => new URL(pedido.url()).pathname.endsWith('/lista/previa'))
    await acionar(verPrevia, hasTouch)
    await campo.fill(`Aluno novo ${marca};660003`)
    segurada.abrir()
    await (await resposta).finished()
    await expect(verPrevia).toBeEnabled()
    await expect(principal(page).getByRole('region', { name: 'Prévia' })).toHaveCount(0)
    await expect(principal(page)).not.toContainText(`Aluno antigo ${marca}`)
    await page.unroute(`**/v1/turmas/${turma.id}/lista/previa`)
    // O texto que volta a ser o da prévia atrasada a mostra, porque ela é dele, sem tirar o foco do campo: o foco que a
    // resposta atrasada pediria não fica guardado para depois.
    await campo.fill(`Aluno antigo ${marca};660002`)
    await expect(principal(page).getByRole('region', { name: 'Prévia' })).toBeVisible()
    await expect(campo).toBeFocused()
    await campo.fill(`Aluno novo ${marca};660003`)

    // A gravação recusada: a matrícula passou para a lista de outra turma depois da prévia. Nada é gravado, a prévia
    // sai com o "Gravar lista", a tela pede a prévia de novo, e a lista recarrega (com o nome que outra pessoa pôs nela
    // enquanto isso).
    await acionar(verPrevia, hasTouch)
    const previa = principal(page).getByRole('region', { name: 'Prévia' })
    await expect(previa.getByRole('status')).toHaveText('1 nome entra · 0 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    await porNaListaDaTurma(coordenadora.escolaId, outraTurma.id, [{ nome: `Da outra turma ${marca}`, matricula: '660003' }])
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [{ nome: `Chegou durante a prévia ${marca}`, matricula: '660070' }])
    await acionar(previa.getByRole('button', { name: 'Gravar lista' }), hasTouch)
    await expect(subir.getByRole('alert')).toHaveText(
      'Uma das matrículas passou a ser usada em outra turma ou por um aluno depois da prévia. Nada foi gravado: veja a prévia de novo.',
      { timeout: PRAZO_DA_ENTRADA_MS },
    )
    await expect(subir.getByRole('alert')).toBeFocused()
    await expect(previa).toHaveCount(0)
    await expect(lista).not.toContainText(`Aluno novo ${marca}`)
    await expect(lista).toContainText(`Chegou durante a prévia ${marca}`)
    // O aviso é do texto que foi recusado: mudar o texto o tira, e voltar a ele o traz de volta sem tirar o foco do campo.
    await campo.focus()
    await campo.press('Control+End')
    await page.keyboard.type('x')
    await expect(subir.getByRole('alert')).toHaveCount(0)
    await page.keyboard.press('Backspace')
    await expect(subir.getByRole('alert')).toBeVisible()
    await expect(campo).toBeFocused()
    await campo.fill(`Aluno novo ${marca};660004`)
    await expect(subir.getByRole('alert')).toHaveCount(0)

    // A gravação que cai com o servidor fora do ar: a tela diz o que fazer, e a prévia fica, com o "Gravar lista",
    // porque ela não envelheceu. Com o servidor de volta, a mesma prévia grava.
    await acionar(verPrevia, hasTouch)
    await expect(previa.getByRole('status')).toHaveText('1 nome entra · 0 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    let foraDoAr = true
    await page.route(`**/v1/turmas/${turma.id}/lista`, (rota: Route) =>
      foraDoAr && rota.request().method() === 'POST' ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue(),
    )
    await acionar(previa.getByRole('button', { name: 'Gravar lista' }), hasTouch)
    await expect(subir.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(previa.getByRole('button', { name: 'Gravar lista' })).toBeVisible()
    foraDoAr = false
    await acionar(previa.getByRole('button', { name: 'Gravar lista' }), hasTouch)
    await expect(anuncio(lista, '1 nome gravado na lista.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista).toContainText(`Aluno novo ${marca}`)

    // O nome avulso, o aluno que chega em maio.
    await acionar(lista.getByRole('button', { name: 'Acrescentar um nome' }), hasTouch)
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
    await acionar(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(semNome).toBeVisible()
    await expect(semMatricula).toHaveCount(0)
    await expect(avulso.getByLabel('Nome do aluno')).toBeFocused()
    await avulso.getByLabel('Nome do aluno').fill(`Aluno de maio ${marca}`)
    await avulso.getByLabel('Matrícula').fill('  ')
    await acionar(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(semMatricula).toBeVisible()
    await expect(semNome).toHaveCount(0)
    await expect(avulso.getByLabel('Matrícula')).toBeFocused()
    // A matrícula que parece CPF ou data de nascimento tem a mesma trava da lista colada (aluno não tem CPF, regra 20).
    for (const documento of ['123.456.789-09', '01/02/2012']) {
      await avulso.getByLabel('Matrícula').fill(documento)
      await acionar(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
      await expect(avulso.getByText('Isto parece CPF ou data de nascimento, e não matrícula.')).toBeVisible()
      await expect(avulso.getByLabel('Matrícula')).toBeFocused()
    }
    expect(avulsos).toHaveLength(0)
    await avulso.getByLabel('Matrícula').fill('660001')
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [{ nome: `Chegou durante o avulso ${marca}`, matricula: '660071' }])
    await acionar(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    // A matrícula já está na lista: nada gravado, o que fazer, e a lista recarrega (com o nome que chegou enquanto isso).
    await expect(avulso.getByRole('alert')).toContainText('Esta matrícula já está na lista', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista).toContainText(`Chegou durante o avulso ${marca}`)
    await avulso.getByLabel('Matrícula').fill('660009')
    await acionar(avulso.getByRole('button', { name: 'Acrescentar' }), hasTouch)
    await expect(avulso).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista).toContainText(`Aluno de maio ${marca}`)
    expect(avulsos).toHaveLength(2)

    // Retirar o nome livre: sai, e o foco vai para o título dos nomes. Abrir o diálogo apaga o anúncio da ação anterior.
    await expect(anuncio(lista, 'Nome acrescentado à lista da turma.')).toBeVisible()
    await acionar(lista.getByRole('button', { name: `Retirar Aluno de maio ${marca}, matrícula 660009 da lista` }), hasTouch)
    await expect(dialogo(page, 'Retirar o nome da lista')).toBeVisible()
    await expect(page.getByText('Nome acrescentado à lista da turma.')).toHaveCount(0)
    await acionar(dialogo(page, 'Retirar o nome da lista').getByRole('button', { name: 'Retirar da lista' }), hasTouch)
    await expect(anuncio(secao(page, 'Nomes da turma'), 'Nome retirado da lista.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista).not.toContainText(`Aluno de maio ${marca}`)
    await expect(principal(page).getByRole('heading', { name: 'Nomes da turma' })).toBeFocused()

    // Outra turma já aberta antes, pelo histórico, sem passar pela Estrutura: a tela recomeça, sem o texto colado na
    // anterior (que "Gravar lista" mandaria para a turma nova).
    const irPara = (destino: string) =>
      page.evaluate((caminho) => {
        window.history.pushState(null, '', caminho)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, destino)
    await irPara(`/coordenacao/estrutura/turmas/${outraTurma.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${outraTurma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await irPara(`/coordenacao/estrutura/turmas/${turma.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await campo.fill(`Rascunho da 7A ${marca};669000`)
    await irPara(`/coordenacao/estrutura/turmas/${outraTurma.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${outraTurma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByLabel('Lista colada')).toHaveValue('')
    // A página inicial leva a coordenação para o Painel sem ficar no histórico: o Voltar do navegador sai do Painel
    // para a turma de antes, em vez de cair na página inicial e ser trazido de volta.
    await irPara('/')
    await esperarPainel(page)
    await page.goBack()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${outraTurma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // "Voltar para Escola" leva de volta à lista de turmas.
    await acionar(principal(page).getByRole('link', { name: 'Voltar para Escola' }), hasTouch)
    await esperarEstrutura(page)
  })

  test('o erro da leitura da lista com "Tentar de novo"; a turma aberta com o seu carregando e o seu erro; a turma que outra pessoa excluiu entre a prévia e o "Gravar lista"', async ({
    page,
    hasTouch,
  }) => {
    // Caso próprio, com a sua escola: o de cima já enche a maior parte do limite do `test.slow()`, e o que vem daqui
    // não depende do que ele fez além da turma e do nome.
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId, ['7A'])
    const [turma] = estrutura.turmas
    if (turma === undefined) throw new Error('estrutura sem a turma')
    const marca = randomUUID().slice(0, 8)
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [
      { nome: `Primeira da lista ${marca}`, matricula: '660001' },
      { nome: `Segunda da lista ${marca}`, matricula: '660002' },
    ])
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(turma.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirTurma(page, turma.nome, hasTouch)
    const lista = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: PRAZO_DA_ENTRADA_MS })
    const campo = principal(page).getByLabel('Lista colada')
    const verPrevia = principal(page).getByRole('button', { name: 'Ver a prévia' })
    const subir = principal(page).getByRole('region', { name: 'Subir a lista de nomes' })
    const previa = principal(page).getByRole('region', { name: 'Prévia' })

    // Erro: a leitura da lista cai, e a seção diz o que fazer, com "Tentar de novo".
    let falhar = true
    await page.route(`**/v1/turmas/${turma.id}/lista?*`, (rota: Route) => (falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue()))
    await page.reload()
    await expect(lista.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await violacoesGraves(page)).toEqual([])
    falhar = false
    await acionar(lista.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(lista).toContainText(`Primeira da lista ${marca}`, { timeout: PRAZO_DA_ENTRADA_MS })

    // A turma aberta tem o seu carregando e o seu erro: a leitura da turma segurada, e depois recusada.
    const turmaSegurada = portao()
    let falharTurma = false
    await page.route(`**/v1/turmas/${turma.id}`, async (rota: Route) => {
      await turmaSegurada.aberta
      await (falharTurma ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue())
    })
    await page.reload()
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a turma…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    turmaSegurada.abrir()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    falharTurma = true
    await page.reload()
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('link', { name: 'Voltar para Escola' })).toBeVisible()
    falharTurma = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // A turma que outra pessoa excluiu entre a prévia e o "Gravar lista": a API responde como inexistente, a tela diz que
    // nada foi gravado, e a prévia sai.
    await campo.fill(`Aluno tardio ${marca};660090`)
    await acionar(verPrevia, hasTouch)
    await expect(previa.getByRole('status')).toHaveText('1 nome entra · 0 já estão na lista · 0 linhas com erro', { timeout: PRAZO_DA_ENTRADA_MS })
    await apagarTurmaNoBanco(coordenadora.escolaId, turma.id)
    await acionar(previa.getByRole('button', { name: 'Gravar lista' }), hasTouch)
    await expect(subir.getByRole('alert')).toHaveText('Esta turma não está mais no ano letivo em curso. Nada foi gravado.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(previa).toHaveCount(0)
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
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirTurma(page, alocacao.turmaNome, hasTouch)

    // Uma linha por vínculo: o professor aparece duas vezes, cada uma com a sua disciplina (em ordem), e o vínculo nasceu
    // esperando a confirmação dele. O link leva ao painel do professor, só com o id no endereço.
    const professores = secao(page, 'Professores da turma')
    const links = professores.getByRole('link')
    await expect(links).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
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
    expect(await violacoesGraves(page)).toEqual([])
    expect(await larguraExcedente(page)).toBe(0)

    // O professor confirma, e a tela diz em texto, depois de a leitura ser feita de novo.
    await confirmarVinculosNoBanco(coordenadora.escolaId, alocacao.vinculoIds)
    await page.reload()
    await expect(professores.getByRole('link').first()).toContainText('Confirmado pelo professor', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professores.getByRole('link').last()).toContainText('Confirmado pelo professor')

    // O link abre Professores, com o professor no endereço.
    await acionar(professores.getByRole('link').first(), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/coordenacao/professores\\?professor=${camila.usuarioId}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    await page.goBack()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${alocacao.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // A turma sem professor diz que não há, com o caminho para Professores.
    await irParaOEndereco(page, `/coordenacao/estrutura/turmas/${semProfessor.id}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${semProfessor.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professores).toContainText('Nenhum professor nesta turma', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professores.getByRole('link')).toHaveCount(0)
    await acionar(professores.getByRole('button', { name: 'Ver os professores' }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/, { timeout: PRAZO_DA_ENTRADA_MS })
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
    await expect(principal(page).getByRole('region', { name: 'Turmas de 2026' })).toContainText(alocacao.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirTurma(page, alocacao.turmaNome, hasTouch)
    const nomes = secao(page, 'Nomes da turma')
    const professores = secao(page, 'Professores da turma')
    const subir = secao(page, 'Subir a lista de nomes')
    await expect(linhasDaTabela(nomes)).toHaveCount(100, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professores.getByRole('link')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
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
      expect(await larguraExcedente(page)).toBe(0)
    }
    expect(await violacoesGraves(page)).toEqual([])
  })
})
