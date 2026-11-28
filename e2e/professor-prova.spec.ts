import type { Locator, Page, Request } from '@playwright/test'
import { entrarComoAlunoPelaApi, responderPelaApi, sairDaAbaPelaApi } from './support/aluno-api.ts'
import { criarAtividadeNoBanco, ProfessoraApiClient } from './support/atividade-db.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'
import { activate } from './support/professor-flow.ts'
import { irPara } from './support/professor/scenario.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, type AlunoDeTeste, type EquipeDeTeste } from './support/seed.ts'

/**
 * **A prova online do lado do professor** (avaliacao-e-correcao, 11.0; RF4, RF5, RF9, RF10), contra a API real: ele acompanha,
 * estende, encerra pelo botão e aprova com a saída da aba e o aviso. O aluno faz a parte dele **pela API** (a tela dele é a 12.0). Nos dois projetos, `chromebook` e `celular`
 * (360 px), com axe. Cada caso monta a escola no banco, abre a sessão pela API (o cookie vai no contexto da página) e abre direto a tela que prova: a carga do aplicativo no
 * Chromebook com CPU ×4 pesa no caso, e por isso os `/assets/` vêm direto, sem a rede do perfil, como em `aluno-prova.spec.ts` (a carga na rede lenta é de `casca.spec.ts`). Os casos são curtos, cada um com uma coisa, e nenhum passa de 15 s (metade do prazo da esteira).
 */
const DISCIPLINA = 'Química'
const TITULO = 'Prova de estequiometria'
const AVISO_DA_SAIDA_DA_ABA = 'Conta as vezes em que a aba da prova perdeu o foco. Leitor de tela, teclado virtual e avisos do sistema também contam. Sozinho, não indica cola.'

interface Escola {
  readonly professora: EquipeDeTeste
  readonly dela: ProfessoraApiClient
  readonly turmaId: string
  readonly artefatoId: string
  readonly ana: AlunoDeTeste
  readonly bia: AlunoDeTeste
}

/** A escola com a professora, a turma de Química, dois alunos (Ana Souza e Bia Lima) e a atividade de três questões; a professora tem a sessão aberta, e cada caso abre a tela que quer. */
async function montarEscola(page: Page): Promise<Escola> {
  const professora = await criarEquipeComSenha()
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [DISCIPLINA])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  const turma = { turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, serieNome: '' }
  const ana = await criarAlunoComMatricula({ escola: professora, nome: 'Ana Souza' })
  await colocarAlunoNaTurma(ana, turma)
  const bia = await criarAlunoComMatricula({ escola: professora, nome: 'Bia Lima' })
  await colocarAlunoNaTurma(bia, turma)
  const { artefatoId } = await criarAtividadeNoBanco(professora.escolaId, professora.usuarioId, alocacao.turmaId, DISCIPLINA, TITULO)
  // Os pedaços do aplicativo (`/assets/…`) são uns 40, e na rede lenta do perfil eles chegam em ondas de 0,5 s: a carga sozinha leva uns 10 s de um caso de 15 s. Eles vêm
  // direto, como em `aluno-prova.spec.ts` (a carga do aplicativo na rede lenta é de `casca.spec.ts`); a CPU ×4 e a rede do perfil seguem para tudo o que estes casos provam: as chamadas à API e a tela.
  await page.route('**/assets/**', async (rota) => rota.fulfill({ response: await rota.fetch() }))
  // A sessão abre pela API, no contexto da página: o cookie vai junto, e a tela já abre dentro dela (a entrada pelo formulário é de `casca.spec.ts`).
  const dela = await ProfessoraApiClient.entrar(page.request, professora)
  return { professora, dela, turmaId: alocacao.turmaId, artefatoId, ana, bia }
}

/** A prova aplicada pela API (aberta desde uma hora atrás, com a duração e o tempo adicional que o caso pedir). Aplicar pela tela, com a janela e o tempo adicional, é de `professor-aplicacao.spec.ts` (10.0). */
async function aplicarPelaApi(escola: Escola, prova: Parameters<ProfessoraApiClient['aplicar']>[3] = {}): Promise<string> {
  return escola.dela.aplicar(escola.artefatoId, escola.turmaId, true, prova)
}

/** Abre o painel da atividade direto pelo endereço dele: o que o caso prova mora ali, e a Home só custaria a carga dela. */
async function abrirOPainel(page: Page, escola: Escola, atividadeId: string): Promise<Locator> {
  await page.goto(enderecoDoPainel(escola, atividadeId))
  const painel = painelDe(page)
  await expect(painel).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  return painel
}

const enderecoDoPainel = (escola: Escola, atividadeId: string): string => `/professor/turmas/${escola.turmaId}?aba=atividades&atividade=${atividadeId}`
const painelDe = (page: Page): Locator => page.getByRole('dialog', { name: TITULO })
const cartaoDe = (painel: Locator, nome: string): Locator => painel.locator('[data-aluno-da-prova]').filter({ hasText: nome })

/** Os minutos desde a meia-noite, na parede da escola (o fuso é o da escola, e não o da máquina). */
function minutosDoDiaNaEscola(instante: number): number {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instante))
  const valor = (tipo: string): number => Number(partes.find((parte) => parte.type === tipo)?.value)
  return valor('hour') * 60 + valor('minute')
}

/** A distância de um minuto-do-dia a um intervalo [de, ate], dando a volta à meia-noite; 0 se está dentro. */
function distanciaEmMinutos(minuto: number, de: number, ate: number): number {
  const volta = (24 * 60)
  const dentro = ((minuto - de + volta) % volta) <= ((ate - de + volta) % volta)
  if (dentro) return 0
  return Math.min(((de - minuto) + volta) % volta, ((minuto - ate) + volta) % volta)
}

/** Soma minutos a um `HH:MM` da parede da escola. */
function maisMinutosNaHora(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number) as [number, number]
  const total = (h * 60 + m + minutos) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

test.describe('a prova online, do lado do professor, contra a API real (11.0)', () => {
  test('acompanha cada aluno (a Ana com tempo adicional), e estende o tempo de um com o efeito dito antes de confirmar', async ({ page, hasTouch, request }) => {
    const escola = await montarEscola(page)
    const atividadeId = await aplicarPelaApi(escola, { duracaoMin: 40, tempoAdicional: [{ alunoId: escola.ana.usuarioId, percentual: 50 }] })
    // Os alunos fazem a parte deles, pela API: a Ana começa e responde sem enviar; a Bia envia.
    const antes = Date.now()
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, escola.ana), atividadeId, [0, 1, 2], { enviar: false })
    const depois = Date.now()
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, escola.bia), atividadeId, [1, 2, 0])

    const painel = await abrirOPainel(page, escola, atividadeId)
    const acompanhar = painel.getByRole('region', { name: 'Acompanhar' })
    await expect(cartaoDe(acompanhar, 'Ana Souza')).toContainText(/Fazendo · termina às \d{2}:\d{2}/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(cartaoDe(acompanhar, 'Bia Lima')).toContainText('Enviou')
    // Só situação: nada de saída da aba, de percentual nem de "parado há".
    await expect(acompanhar).not.toContainText(/saiu|saída|%|parado|falt/i)
    const termina = ((await cartaoDe(acompanhar, 'Ana Souza').textContent()) ?? '').match(/termina às (\d{2}:\d{2})/)?.[1]
    if (termina === undefined) throw new Error('a Ana não tem horário de fim')
    // O limite da Ana é o começo mais 60 min (40 de prova e +50%), e não 40: cabe entre o começo mais 60 e o fim da chamada mais 60, com 1 min de folga.
    const [h, m] = termina.split(':').map(Number) as [number, number]
    expect(distanciaEmMinutos(h * 60 + m, minutosDoDiaNaEscola(antes + 60 * 60_000), minutosDoDiaNaEscola(depois + 60 * 60_000))).toBeLessThanOrEqual(1)
    // Quem enviou não tem "Estender".
    await expect(cartaoDe(acompanhar, 'Bia Lima').getByRole('button')).toHaveCount(0)

    // Estender: o efeito vem antes, e o cartão troca o horário sem esperar a releitura.
    await activate(acompanhar.getByRole('button', { name: 'Estender o tempo de Ana Souza' }), hasTouch)
    const estender = page.getByRole('alertdialog', { name: 'Estender o tempo' })
    await estender.getByLabel('Mais quantos minutos?').fill('10')
    const novo = maisMinutosNaHora(termina, 10)
    await expect(estender).toContainText(`Ana Souza termina às ${novo} em vez de ${termina}.`)
    await activate(estender.getByRole('button', { name: 'Estender o tempo' }), hasTouch)
    await expect(estender).toBeHidden({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(cartaoDe(acompanhar, 'Ana Souza')).toContainText(`Fazendo · termina às ${novo}`)
  })

  test('encerra pelo botão dizendo quantos ainda fazem, e o painel deixa de oferecer o botão', async ({ page, hasTouch, request }) => {
    const escola = await montarEscola(page)
    const atividadeId = await aplicarPelaApi(escola)
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, escola.ana), atividadeId, [0, 1, 2], { enviar: false })

    const painel = await abrirOPainel(page, escola, atividadeId)
    await activate(painel.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    await expect(encerrar).toContainText('1 aluno ainda está fazendo. As respostas salvas dele vão para a correção.')
    await activate(encerrar.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await expect(encerrar).toBeHidden({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel.getByRole('button', { name: 'Encerrar a atividade' })).toHaveCount(0)
  })

  test('o lote da prova traz "1" na coluna "Saiu da aba" e o aviso fixo, e a saída da aba não trava a aprovação', async ({ page, hasTouch, request }) => {
    const escola = await montarEscola(page)
    const atividadeId = await aplicarPelaApi(escola)
    const tokenDaAna = await entrarComoAlunoPelaApi(request, escola.ana)
    // A Ana sai da aba com a prova em andamento; o encerramento leva o que ela salvou.
    await responderPelaApi(request, tokenDaAna, atividadeId, [0, 1, 2], { enviar: false })
    await sairDaAbaPelaApi(request, tokenDaAna, atividadeId)
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, escola.bia), atividadeId, [1, 2, 0])
    await escola.dela.encerrar(atividadeId)

    await page.goto(`/professor/aprovar/${atividadeId}`)
    // Sem destaque, a coluna está nas outras correções: "1" para a Ana, que saiu da aba uma vez, e "0" para a Bia, sempre com o aviso fixo acima.
    await expect(page.getByRole('heading', { level: 1, name: 'Revisar a correção' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page.getByRole('tab', { name: 'Outras' }), hasTouch)
    const outras = page.getByRole('region', { name: /^As outras 2 correções/ })
    await expect(outras).toContainText(AVISO_DA_SAIDA_DA_ABA, { timeout: SIGN_IN_TIMEOUT_MS })
    if (hasTouch) {
      // A 360 px a contagem vai dentro do cartão do aluno, com o mesmo rótulo.
      await expect(outras.getByRole('listitem').filter({ hasText: 'Ana Souza' })).toContainText(/Saiu da aba:?\s*1/)
      await expect(outras.getByRole('listitem').filter({ hasText: 'Bia Lima' })).toContainText(/Saiu da aba:?\s*0/)
    } else {
      await expect(outras.getByRole('columnheader', { name: 'Saiu da aba' })).toBeVisible()
      await expect(outras.getByRole('row').filter({ hasText: 'Ana Souza' }).getByRole('cell').last()).toHaveText('1')
      await expect(outras.getByRole('row').filter({ hasText: 'Bia Lima' }).getByRole('cell').last()).toHaveText('0')
    }
    expect(await seriousViolations(page)).toEqual([])

    // A saída da aba não trava a aprovação: nenhum destaque a abrir, e o lote se aprova.
    const aprovar = page.getByRole('group', { name: 'Aprovação do lote' }).getByRole('button', { name: 'Aprovar 2 correções' })
    await expect(aprovar).toBeEnabled()
    await activate(aprovar, hasTouch)
    const confirmar = page.getByRole('alertdialog', { name: 'Aprovar 2 correções' })
    await activate(confirmar.getByRole('button', { name: 'Aprovar 2 correções' }), hasTouch)
    await expect(confirmar).toBeHidden({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('[data-situacao-do-lote="aprovada"]')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('em 360 px e em 1366 × 768: cartões sem rolar de lado, e "Estender" e "Confirmar" com 44 px', async ({ page, hasTouch }) => {
    const escola = await montarEscola(page)
    const atividadeId = await aplicarPelaApi(escola)
    const painel = await abrirOPainel(page, escola, atividadeId)
    await expect(cartaoDe(painel, 'Ana Souza')).toContainText('Não começou', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel.locator('[data-aluno-da-prova]')).toHaveCount(2)
    await paginaNaoRola(page)
    const estender = painel.getByRole('button', { name: 'Estender o tempo de Ana Souza' })
    expect((await estender.boundingBox())?.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await activate(estender, hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Estender o tempo' })
    await dialogo.getByLabel('Mais quantos minutos?').fill('5')
    expect((await dialogo.getByRole('button', { name: 'Estender o tempo' }).boundingBox())?.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a segunda chamada abre na prova encerrada, com os convocados em uma coluna e o confirmar com 44 px', async ({ page, hasTouch }) => {
    const escola = await montarEscola(page)
    const atividadeId = await aplicarPelaApi(escola)
    await escola.dela.encerrarSemLote(atividadeId)
    const painel = await abrirOPainel(page, escola, atividadeId)
    await activate(painel.getByRole('button', { name: 'Segunda chamada' }), hasTouch)
    const segunda = page.getByRole('alertdialog', { name: 'Segunda chamada' })
    const ana = segunda.getByRole('checkbox', { name: 'Ana Souza' })
    const bia = segunda.getByRole('checkbox', { name: 'Bia Lima' })
    await expect(ana).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
    const [caixaDaAna, caixaDaBia] = [await ana.locator('xpath=ancestor::label').boundingBox(), await bia.locator('xpath=ancestor::label').boundingBox()]
    expect(caixaDaAna?.x).toBe(caixaDaBia?.x)
    expect(caixaDaAna?.y).toBeLessThan(caixaDaBia?.y ?? 0)
    expect((await segunda.getByRole('button', { name: 'Abrir a segunda chamada' }).boundingBox())?.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('recomeço: a leitura atrasada de outra prova não cobre o painel de agora, e a falha de estender sai quando o diálogo abre de novo', async ({ page, hasTouch }) => {
    const escola = await montarEscola(page)
    const primeira = await aplicarPelaApi(escola)
    const segundaAtividade = await criarAtividadeNoBanco(escola.professora.escolaId, escola.professora.usuarioId, escola.turmaId, DISCIPLINA, TITULO)
    const segunda = await escola.dela.aplicar(segundaAtividade.artefatoId, escola.turmaId, true)

    // A leitura da primeira fica segurada; a professora vai para a segunda; só então a primeira chega, com um aluno que a segunda não tem.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(`**/v1/atividades-aplicadas/${primeira}/acompanhamento`, async (rota) => {
      const resposta = await rota.fetch()
      const corpo = (await resposta.json()) as { alunos: { alunoId: string; nome: string; situacao: string; limiteEm: string | null }[] }
      await segurada
      await rota.fulfill({ response: resposta, json: { ...corpo, alunos: [...corpo.alunos, { alunoId: '0197a1c0-0000-7000-8000-00000000ffff', nome: 'Fantasma Antigo', situacao: 'nao_comecou', limiteEm: null }] } })
    })
    // O navegador dá a leitura por terminada quando o corpo chegou inteiro: é o sinal de que a página tem a resposta atrasada nas mãos.
    // O fim dessa leitura é o sinal de que a página já a resolveu: `requestfinished` se a resposta atrasada chegou, ou `requestfailed` (ERR_ABORTED) se a troca de prova a cancelou antes.
    const daPrimeira = (pedido: Request): boolean => pedido.url().includes(`/v1/atividades-aplicadas/${primeira}/acompanhamento`)
    const terminou = Promise.race([page.waitForEvent('requestfinished', daPrimeira), page.waitForEvent('requestfailed', daPrimeira)])
    await abrirOPainel(page, escola, primeira)
    await irPara(page, enderecoDoPainel(escola, segunda))
    const acompanhar = painelDe(page).getByRole('region', { name: 'Acompanhar' })
    await expect(cartaoDe(acompanhar, 'Ana Souza')).toContainText('Não começou', { timeout: SIGN_IN_TIMEOUT_MS })
    liberar()
    // Sem espera de relógio: a leitura da primeira terminou (chegou ou foi cancelada), e dois quadros depois a tela já a processou.
    await terminou
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    await expect(acompanhar).not.toContainText('Fantasma Antigo')
    await expect(acompanhar.locator('[data-aluno-da-prova]')).toHaveCount(2)

    // A falha de estender fica no diálogo e sai quando ele abre de novo.
    await page.route(`**/v1/atividades-aplicadas/${segunda}/extensoes`, (rota) => rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }) }))
    await activate(acompanhar.getByRole('button', { name: 'Estender o tempo de Ana Souza' }), hasTouch)
    const estender = page.getByRole('alertdialog', { name: 'Estender o tempo' })
    await estender.getByLabel('Mais quantos minutos?').fill('10')
    await activate(estender.getByRole('button', { name: 'Estender o tempo' }), hasTouch)
    await expect(estender.getByRole('alert')).not.toBeEmpty({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(estender.getByRole('button', { name: 'Cancelar' }), hasTouch)
    await activate(acompanhar.getByRole('button', { name: 'Estender o tempo de Ana Souza' }), hasTouch)
    await expect(page.getByRole('alertdialog', { name: 'Estender o tempo' })).toBeVisible()
    await expect(page.getByRole('alertdialog', { name: 'Estender o tempo' }).getByRole('alert')).toHaveCount(0)
  })
})
