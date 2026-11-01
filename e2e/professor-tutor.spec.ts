import { randomUUID } from 'node:crypto'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { ALUNOS_DO_LOTE, apiError, type AssistenteApiMock } from './support/assistente.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { principal } from './support/professor-flow.ts'
import { abrirOSino, activate, entrar, irPara, SCREEN_TIMEOUT_MS } from './support/professor/scenario.ts'
import { peDoSino } from './support/professor/sino.ts'
import { abrirOPainelDoTutor, ENDERECO_DE_HOJE, painelDoTutor } from './support/professor/tutor.ts'
import { expect, test } from './support/profiles.ts'

/**
 * O Tutor visto pela professora (11.4, A4, pacote W; X3 telas do professor, 10.0): os sinais, a atenção humana e as funções do
 * Tutor moram na aba Hoje da turma, e o nome do aluno só chega ao painel "O que o Tutor viu". Separado de
 * `professor-turma.spec.ts` pela 2.5. Cada caso paga a entrada da professora (cerca de 11 s na máquina), por isso cada um prova
 * uma coisa só: o caso que passa de 15 s o portão reprova.
 */

const atividade = { id: randomUUID(), titulo: 'Atividade de estequiometria' }
const alunoDoLote = (indice: number): { id: string; nome: string } => {
  const aluno = ALUNOS_DO_LOTE[indice]
  if (aluno === undefined) throw new Error('faltou aluno sintético')
  return { id: aluno.alunoId, nome: aluno.nome }
}
const ANA = alunoDoLote(0)
const BRUNO = alunoDoLote(1)
const CAIO = alunoDoLote(2)
const NOMES = [ANA.nome, BRUNO.nome, CAIO.nome]

/** A turma passa a ter atividade, sinais e uso: a atenção de Caio, o travou de Ana e a resposta pronta de Bruno. */
function comSinaisEUso(api: AssistenteApiMock, turmaId: string): void {
  api.aplicadas = [{ id: atividade.id, artefatoId: randomUUID(), turmaId, titulo: atividade.titulo, avaliativa: false, estado: 'aberta', questoes: 5, aplicadaEm: '2026-10-05T13:00:00.000Z', encerradaEm: null, participacao: { alunos: 30, iniciaram: 20, enviaram: 3 }, entrega: null }]
  api.sinais = {
    itens: [
      { id: randomUUID(), tipo: 'atencao_humana', aluno: CAIO, criadoEm: '2026-10-05T13:40:00.000Z' },
      { id: randomUUID(), tipo: 'travou', aluno: ANA, atividadeAplicadaId: atividade.id, questao: 3, materialId: null, pagina: null, criadoEm: '2026-10-05T13:20:00.000Z' },
      { id: randomUUID(), tipo: 'resposta_pronta', aluno: BRUNO, atividadeAplicadaId: atividade.id, questao: 1, materialId: null, pagina: null, criadoEm: '2026-10-05T13:25:00.000Z' },
    ],
    grupos: [{ tipo: 'travou', atividadeAplicadaId: atividade.id, questao: 3, alunos: 8 }],
  }
  api.uso = {
    turmaId,
    limiteDoDia: 60,
    trocasDaTurmaNoMes: 412,
    pacoteDaTurmaNoMes: 9000,
    alunos: [
      { aluno: BRUNO, trocasHoje: 2, ultimaTrocaEm: '2026-10-05T13:26:00.000Z', ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: null, pagina: null } },
      { aluno: ANA, trocasHoje: 12, ultimaTrocaEm: '2026-10-05T13:42:00.000Z', ultimaReferencia: { atividadeAplicadaId: atividade.id, questao: 3, materialId: null, pagina: null } },
    ],
  }
}

test.describe('o Tutor em Hoje (11.4, X3)', () => {
  test('o pé do sino leva à aba Hoje da turma, e o link do Tutor não leva número', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch)
    await abrirOSino(page, hasTouch)
    const link = peDoSino(page).getByRole('link', { name: 'O que o Tutor viu' })
    await expect(link).toHaveAccessibleName('O que o Tutor viu')
    await activate(link, hasTouch)
    await expect(page).toHaveURL(ENDERECO_DE_HOJE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('tab', { selected: true })).toHaveText('Hoje', { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('sem sinal e sem uso, a tela não fica vazia: diz o que o Tutor avisa, sem aviso de atenção', async ({ page, hasTouch }) => {
    const { turmaId } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    await expect(page.getByText('Nenhum sinal desta turma ainda')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-atencao-humana]')).toHaveCount(0)
    await expect(principal(page).locator('[data-selo-ia]')).toHaveCount(1)
  })

  test('a leitura dos sinais que falha mostra a mensagem e "Tentar de novo"; relida, mostra o grupo da turma, assinado pela função do Tutor e sem nome', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    api.trocar('sinais', () => apiError(429, 'LIMITE_EXCEDIDO'))
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    const sinais = page.getByRole('region', { name: 'Sinais da turma' })
    await expect(sinais.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO, { timeout: SIGN_IN_TIMEOUT_MS })

    api.trocar('sinais')
    await activate(sinais.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(sinais.getByRole('log')).toContainText('8 alunos travaram na questão 3 de "Atividade de estequiometria".', { timeout: SCREEN_TIMEOUT_MS })
    await expect(sinais.getByRole('log').getByText('Tutor · sinais para o professor')).toBeVisible()
    await expect(sinais.getByRole('link')).toHaveCount(0)
  })

  test('a atenção humana está no alto de Hoje, sem painel aberto: contagem, hora e o que fazer, sem nome, sem o que foi dito e sem caminho para conversa', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    const atencao = page.locator('[data-atencao-humana]')
    await expect(atencao).toContainText('Um aluno precisa de um adulto', { timeout: SCREEN_TIMEOUT_MS })
    await expect(atencao).toContainText(/Aviso mais recente: 05\/10, \d{2}h40/)
    await expect(atencao).toContainText('O que foi dito não aparece aqui')
    await expect(atencao.getByRole('link')).toHaveCount(0)
    await expect(atencao.getByRole('button')).toHaveText('Ver quem')
    await expect(painelDoTutor(page)).toHaveCount(0)
    // Nenhum nome de aluno em Hoje (a professora projeta esta aba): nem nos sinais, nem em lugar nenhum da página.
    for (const nome of NOMES) await expect(page.locator('body')).not.toContainText(nome)
    await expect(principal(page)).not.toContainText(/há \d+ (min|hora|segundo)|ocios|não usou|não usaram/i)
  })

  test('sem o painel, só os sinais são lidos: o uso por aluno não é pedido; o painel o pede, e fechá-lo solta os nomes', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    const lidos: string[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'GET') lidos.push(new URL(pedido.url()).pathname)
    })
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    await expect(page.locator('[data-atencao-humana]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(lidos).toContain('/v1/sinais')
    expect(lidos).not.toContain('/v1/tutor/uso')

    await abrirOPainelDoTutor(page, hasTouch, 'quem')
    await expect(painelDoTutor(page)).toContainText(CAIO.nome)
    expect(lidos).toContain('/v1/tutor/uso')

    await activate(painelDoTutor(page).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(painelDoTutor(page)).toHaveCount(0)
    await expect(page).toHaveURL(ENDERECO_DE_HOJE)
    for (const nome of NOMES) await expect(page.locator('body')).not.toContainText(nome)
  })

  test('o painel começa pela atenção humana, segue com os sinais e o uso por aluno em ordem de nome, e nada nele abre a conversa de um aluno', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    await expect(page.locator('[data-atencao-humana]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await abrirOPainelDoTutor(page, hasTouch)
    const painel = painelDoTutor(page)

    const atencao = painel.getByRole('region', { name: 'Alunos que precisam de um adulto' })
    await expect(atencao).toContainText(/Caio Sintético · 05\/10, \d{2}h40/, { timeout: SCREEN_TIMEOUT_MS })
    await expect(atencao).toContainText('O que foi dito não aparece aqui')

    const sinais = painel.getByRole('region', { name: 'Sinais por aluno' })
    await expect(sinais).toContainText('Travou na questão 3 de "Atividade de estequiometria"')
    await expect(sinais).toContainText('Pediu a resposta pronta na questão 1 de "Atividade de estequiometria"')
    // A atenção humana não se repete entre os sinais de trabalho.
    await expect(sinais).not.toContainText(CAIO.nome)

    const uso = painel.getByRole('region', { name: 'Uso do Tutor pela turma' })
    await expect(uso).toContainText('412 de 9000')
    await expect(uso).toContainText('12 de 60')
    await expect(uso).toContainText('05/10, 10h42')
    await expect(uso).toContainText('Na questão 3 de "Atividade de estequiometria"')
    await expect(uso).toContainText('Sem atividade nem material')
    // Em ordem de nome, e não de recência nem de uso: Ana antes de Bruno, embora Bruno apareça antes na API.
    const ordem = await uso.getByText(/Sintétic[ao]$/).allInnerTexts()
    expect(ordem.map((nome) => nome.replace(/^Aluno:\s*/, ''))).toEqual([ANA.nome, BRUNO.nome])
    // Sem tempo relativo, sem ociosidade, sem lista de quem não usou. Nada neste painel abre a conversa de um aluno.
    await expect(painel).not.toContainText(/há \d+ (min|hora|segundo)|ocios|não usou|não usaram/i)
    await expect(painel.getByRole('link')).toHaveCount(0)
    await expect(painel.getByRole('button')).toHaveCount(1)
    await expect(painel.getByRole('button')).toHaveAccessibleName('Fechar')
  })

  test('o nome do aluno não vai a endereço nem a armazenamento do navegador', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    await expect(page.locator('[data-atencao-humana]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await abrirOPainelDoTutor(page, hasTouch, 'quem')
    await expect(painelDoTutor(page)).toContainText(CAIO.nome, { timeout: SCREEN_TIMEOUT_MS })
    const guardado = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, sessao: { ...sessionStorage }, endereco: location.href }))
    for (const nome of NOMES) expect(guardado).not.toContain(nome)
  })

  test('o painel pedido no endereço (`?ver=tutor`) abre, com Hoje por baixo', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje&ver=tutor`)
    await expect(painelDoTutor(page)).toContainText(CAIO.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\?aba=hoje&ver=tutor$/)
  })

  test('o vínculo encerrado com Hoje aberta: o 404 da releitura dos 15 s tira a página inteira, com o painel "Ver quem" e os nomes dele', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comSinaisEUso(api, turmaId)
    // O relógio é simulado antes de Hoje abrir: a releitura dos 15 s (o intervalo nasce com a aba) anda quando o teste manda.
    await page.clock.install()
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje&ver=tutor`)
    await expect(painelDoTutor(page)).toContainText(CAIO.nome, { timeout: SCREEN_TIMEOUT_MS })
    // A página sai pela releitura dos sinais, e não pela releitura da turma (foco e visibilidade, 30 s): a turma não é lida de novo.
    const leiturasDaTurma: string[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'GET' && new URL(pedido.url()).pathname === `/v1/turmas/${turmaId}`) leiturasDaTurma.push(pedido.url())
    })

    // A coordenação encerrou o vínculo: a releitura seguinte dos sinais já não acha a turma.
    api.trocar('sinais', () => apiError(404, 'NAO_ENCONTRADO'))
    await page.clock.fastForward('00:16')
    await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(painelDoTutor(page)).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page).toHaveTitle('Turma · Turmma')
    for (const nome of NOMES) await expect(page.locator('body')).not.toContainText(nome)
    expect(leiturasDaTurma).toEqual([])
  })

  test('as funções do Tutor e o bloco "Quando o Tutor avisa você" estão em Hoje, e os do Assistente continuam pelo sino', async ({ page, hasTouch }) => {
    const { turmaId } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}?aba=hoje`)
    await activate(page.getByText('O que o Tutor faz sozinho, e o que você vê aqui'), hasTouch)
    await expect(page.locator('[data-funcao="sinais_para_o_professor"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page)).toContainText('Quando o Tutor avisa você')
    await expect(principal(page)).toContainText('Travou: a quarta troca seguida na mesma questão ou página, no mesmo dia.')
    await abrirOSino(page, hasTouch)
    await expect(peDoSino(page).getByRole('link', { name: 'O que o Assistente fez' })).toBeVisible()
  })
})

test.describe('o endereço antigo do Tutor leva a Hoje', () => {
  test('com uma turma confirmada, `/professor/time/tutor` leva a Hoje dela, e o Voltar não cai no endereço antigo', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch)
    await irPara(page, '/professor/time/tutor')
    await expect(page).toHaveURL(ENDERECO_DE_HOJE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('region', { name: 'Sinais da turma' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.goBack()
    await expect(page).not.toHaveURL(/\/time\/tutor$/)
  })

  test('com duas turmas, leva a Turmas, onde ela escolhe', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch, { outrasDisciplinas: ['Física'] })
    await irPara(page, '/professor/time/tutor')
    await expect(page).toHaveURL(/\/professor\/turmas$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('region', { name: 'Sinais da turma' })).toHaveCount(0)
  })

  test('sem turma confirmada, leva a Turmas', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch, { comTurma: false })
    await irPara(page, '/professor/time/tutor')
    await expect(page).toHaveURL(/\/professor\/turmas$/, { timeout: SIGN_IN_TIMEOUT_MS })
  })
})
