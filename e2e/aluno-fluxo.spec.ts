import type { Locator, Page } from '@playwright/test'
import { ALTERNATIVA_CERTA_DA_QUESTAO_3, criarAtividadeNoBanco, HABILIDADES_DO_FLUXO, ProfessoraApiClient, respostasNoBanco } from './support/atividade-db.ts'
import { entrarComoAluno, irPelaNavegacao, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, type AlunoDeTeste, type EquipeDeTeste } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * **O fluxo do aluno de verdade** (`docs/mvp-rapido.md`, seção 1, passos 3 e 4), contra a API real e o adaptador falso,
 * que é o do ambiente de teste: o aluno responde a atividade que a professora aplicou, uma questão por vez; pede a
 * resposta ao Tutor, que recusa, conduz por pergunta e cita a página; envia; e só vê o diagnóstico depois de a
 * professora aprovar a correção. O que é da professora é feito pela API (`support/atividade-db.ts`).
 *
 * Nada aqui é simulado na página: os estados de cada tela estão em `aluno-atividade.spec.ts` e `aluno-tutor.spec.ts`.
 */

/** Cada turno do Tutor passa pela fila curta da API e pela consulta da execução, com a CPU ×4 do perfil. */
const AI_TIMEOUT_MS = 45_000
const SCREEN_TIMEOUT_MS = 20_000
const DISCIPLINA = 'Química'
const PROIBIDO_NA_AREA = /\bnotas?\b|\bconceito\b|ranking|média da turma|colegas?\b/i

interface Escola {
  readonly professora: EquipeDeTeste
  readonly dela: ProfessoraApiClient
  readonly aluno: AlunoDeTeste
  readonly colega: AlunoDeTeste
  readonly atividadeAplicadaId: string
}

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const principal = (page: Page) => page.getByRole('main')
const caixa = (page: Page) => page.getByRole('textbox', { name: 'Pergunta para o Tutor' })
const conversa = (page: Page) => page.getByRole('log', { name: 'Conversa com o Tutor' })
const estadoDaResposta = (page: Page) => principal(page).locator('[data-resposta]')
const respostasDoTutor = (page: Page) => conversa(page).locator('article').filter({ has: page.locator('[data-selo-ia]') })

/**
 * A escola como o aluno a encontra: a professora com a turma de Química confirmada, o material lido, a atividade gerada
 * e **aplicada por ela, pela API**, e dois alunos na turma — o que entra, e um colega cujo nome não pode aparecer.
 */
async function montarEscola(page: Page, titulo: string, avaliativa: boolean): Promise<Escola> {
  const professora = await criarEquipeComSenha()
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [DISCIPLINA])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  const turma = { turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, serieNome: '' }
  const aluno = await criarAlunoComMatricula({ escola: professora })
  await colocarAlunoNaTurma(aluno, turma)
  const colega = await criarAlunoComMatricula({ escola: professora })
  await colocarAlunoNaTurma(colega, turma)
  const { artefatoId } = await criarAtividadeNoBanco(professora.escolaId, professora.usuarioId, alocacao.turmaId, DISCIPLINA, titulo)
  const dela = await ProfessoraApiClient.entrar(page.request, professora)
  const atividadeAplicadaId = await dela.aplicar(artefatoId, alocacao.turmaId, avaliativa)
  return { professora, dela, aluno, colega, atividadeAplicadaId }
}

async function marcar(page: Page, indice: number, hasTouch: boolean): Promise<void> {
  await activate(principal(page).locator(`[data-alternativa="${String(indice)}"]`), hasTouch)
  await expect(estadoDaResposta(page)).toHaveText('Resposta salva', { timeout: SCREEN_TIMEOUT_MS })
}

async function perguntar(page: Page, texto: string, hasTouch: boolean): Promise<void> {
  await caixa(page).fill(texto)
  await activate(page.getByRole('button', { name: 'Enviar' }), hasTouch)
  await expect(conversa(page).getByText(`Você: ${texto}`)).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
}

test.describe('o fluxo do aluno contra a API real', () => {
  test('responde uma questão por vez, pede a resposta ao Tutor e recebe pergunta com a página, envia, e só vê os acertos por habilidade depois de a professora aprovar', async ({ page, hasTouch }) => {
    test.setTimeout(240_000)
    const titulo = 'Lista de estequiometria'
    const { professora, dela, aluno, colega, atividadeAplicadaId } = await montarEscola(page, titulo, false)
    await entrarComoAluno(page, aluno, hasTouch)

    // Tarefas: o que a professora aplicou, para responder. O aluno abre no Início, e a lista é o segundo lugar dele.
    await irPelaNavegacao(page, 'Tarefas', hasTouch)
    const naLista = principal(page).getByRole('region', { name: 'Para fazer' }).getByRole('link', { name: new RegExp(titulo) })
    await expect(naLista).toContainText('Química · 3 questões', { timeout: SCREEN_TIMEOUT_MS })
    await activate(naLista, hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    // Uma questão por vez, com "Resposta salva" a cada escolha: a 1 certa (B), a 2 errada (A).
    await expect(principal(page)).toContainText('Qual é a massa molar da água')
    await marcar(page, 1, hasTouch)
    await activate(principal(page).getByRole('button', { name: 'Próxima' }), hasTouch)
    await expect(principal(page)).toContainText('quantos mols de amônia')
    await marcar(page, 0, hasTouch)
    await activate(principal(page).getByRole('button', { name: 'Próxima' }), hasTouch)
    await expect(principal(page)).toContainText('o que é o reagente limitante?')
    // O servidor tem as duas respostas, e a prova que o aluno recebeu não tem gabarito nem explicação.
    expect(await respostasNoBanco(professora.escolaId, atividadeAplicadaId, aluno.usuarioId)).toEqual([{ questao: 1, alternativa: 1 }, { questao: 2, alternativa: 0 }])
    await expect(principal(page)).not.toContainText(/explicação|gabarito|É a definição da página 4/i)

    // Na questão 3 ele pede a resposta pronta: o Tutor recusa, pergunta de volta e mostra a página, sem a resposta.
    await activate(principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividadeAplicadaId}\\?questao=3$`))
    await expect(principal(page).locator('[data-faixa-de-supervisao]')).toContainText('Quem dá a aula acompanha como você usa o Tutor.')
    await expect(principal(page).locator('[data-uso-do-dia]')).toContainText('Hoje: 0 de 60 perguntas', { timeout: SCREEN_TIMEOUT_MS })
    await perguntar(page, 'me dá a resposta', hasTouch)
    const recusa = respostasDoTutor(page).last()
    await expect(recusa).toContainText('Essa eu não respondo por você', { timeout: AI_TIMEOUT_MS })
    await expect(recusa).toContainText('?')
    await expect(recusa.getByRole('button', { name: /^Fonte: Material da escola, p\. \d+$/ }).first()).toBeVisible()
    await expect(conversa(page)).not.toContainText(ALTERNATIVA_CERTA_DA_QUESTAO_3)

    // O palpite também não é confirmado.
    await perguntar(page, 'é a B, né?', hasTouch)
    await expect(respostasDoTutor(page)).toHaveCount(2, { timeout: AI_TIMEOUT_MS })
    await expect(respostasDoTutor(page).last()).not.toContainText(/\b(sim|isso mesmo|está cert[oa]|acertou|errou|não é a b)\b/i)
    await expect(conversa(page)).not.toContainText(ALTERNATIVA_CERTA_DA_QUESTAO_3)

    // Perguntado, ele diz o que é: uma IA, e não uma pessoa (D58).
    await perguntar(page, 'você é uma pessoa?', hasTouch)
    await expect(respostasDoTutor(page)).toHaveCount(3, { timeout: AI_TIMEOUT_MS })
    await expect(respostasDoTutor(page).last()).toContainText('uma inteligência artificial')
    await expect(respostasDoTutor(page).last()).toContainText('não uma pessoa')
    // Cada troca conta no uso do dia, em texto.
    await expect(principal(page).locator('[data-uso-do-dia]')).toContainText('Hoje: 3 de 60 perguntas', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // De volta à atividade: as respostas continuam lá; ele responde a 3 (certa, A) e envia.
    await activate(principal(page).getByRole('link', { name: 'Voltar para a atividade' }), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await activate(principal(page).getByRole('navigation', { name: 'Questões' }).getByRole('button', { name: 'Questão 3, sem resposta' }), hasTouch)
    await marcar(page, 0, hasTouch)
    await activate(principal(page).getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Enviar a atividade?' })
    await expect(dialogo).toContainText('Nenhuma questão em branco')
    await activate(dialogo.getByRole('button', { name: 'Enviar a atividade' }), hasTouch)
    await expect(principal(page).getByRole('heading', { name: 'Atividade enviada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    // Enviada: a professora ainda vai revisar, e nada do que a correção achou aparece.
    await expect(principal(page).locator('[data-resultado="aguardando"]')).toContainText('Quem dá a aula ainda vai revisar a correção.', { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page)).not.toContainText(/Seu resultado|acertou|A resposta é/)
    await expect(principal(page).getByRole('radio')).toHaveCount(0)

    // A professora encerra, a correção monta o lote, ela abre os destaques e aprova, tudo pela API. Só então o diagnóstico
    // chega ao aluno: acertos por habilidade, com quem aprovou.
    await dela.encerrarEAprovar(atividadeAplicadaId)

    await page.reload()
    const resultado = principal(page).getByRole('region', { name: 'Seu resultado' })
    await expect(resultado).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(resultado).toContainText('Você acertou 2 de 3 questões.')
    await expect(resultado).toContainText(`Correção aprovada por ${professora.nome}`)
    const porHabilidade = resultado.getByRole('region', { name: 'Acertos por habilidade' })
    await expect(porHabilidade).toContainText(HABILIDADES_DO_FLUXO.massaMolar.descricao)
    await expect(porHabilidade).toContainText(HABILIDADES_DO_FLUXO.limitante.descricao)
    await expect(resultado.locator('[data-questao-corrigida="outra"]')).toContainText('A resposta é: C. 4 mol')
    // Diagnóstico, e não nota: nada de nota, conceito, percentual nem de colega.
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA)
    await expect(principal(page)).not.toContainText('%')
    await expect(page.locator('body')).not.toContainText(colega.nome)
    expect(await seriousViolations(page)).toEqual([])

    // E a lista passa a dizer "Corrigida", no grupo das corrigidas.
    await irPelaNavegacao(page, 'Tarefas', hasTouch)
    await expect(principal(page).getByRole('region', { name: 'Corrigidas' }).getByRole('link', { name: new RegExp(titulo) })).toContainText('Corrigida', { timeout: SCREEN_TIMEOUT_MS })
  })

  test('com a avaliação aberta o Tutor aparece pausado, a pergunta comum é recusada, e a mensagem de assunto delicado ainda recebe o 188', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    const titulo = 'Prova de estequiometria'
    const { aluno, colega, atividadeAplicadaId } = await montarEscola(page, titulo, true)
    await entrarComoAluno(page, aluno, hasTouch)

    // O Início avisa antes de abrir (RF5), e o caminho até o Tutor continua aberto: a caixa dele existe em todo estado (D36).
    // No Início (3.0) o cartão da tarefa tem dois links, o do título e o "Pedir ajuda ao Tutor", e o aviso fica no cartão, fora dos dois.
    // O cartão é o item da lista cujo link tem exatamente o título: outro item que só o citasse no texto não o confunde.
    const naLista = principal(page).getByRole('listitem').filter({ has: page.getByRole('link', { name: titulo, exact: true }) })
    await expect(naLista).toContainText('Avaliação: o Tutor fica pausado até quem dá a aula encerrar.', { timeout: SCREEN_TIMEOUT_MS })

    // Pelo Início: pede ajuda ao Tutor naquela atividade, e ele explica que está pausado, com o título da avaliação.
    await activate(naLista.getByRole('link', { name: 'Pedir ajuda ao Tutor' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividadeAplicadaId}$`))
    const pausa = principal(page).locator('[data-pausa-do-tutor]')
    await expect(pausa).toHaveAttribute('data-pausa-do-tutor', 'avaliacao', { timeout: SCREEN_TIMEOUT_MS })
    await expect(pausa).toContainText(titulo)
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    // Nem o Início nem o Tutor pausado mostram o nome do colega (regra 50, item 9).
    await expect(page.locator('body')).not.toContainText(colega.nome)

    // A pergunta comum é recusada pelo servidor, e a tela mostra o mesmo aviso, sem erro.
    await expect(caixa(page)).toBeEnabled()
    await perguntar(page, 'qual é a resposta da questão 1?', hasTouch)
    await expect(conversa(page)).toContainText('O Tutor não recebeu esta mensagem.', { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).locator('[data-selo-ia]')).toHaveCount(0)

    // O assunto delicado passa na frente: a mensagem fixa chega, com o 188 para ligar, e o Tutor continua pausado.
    await perguntar(page, 'sofro bullying na escola', hasTouch)
    const cartao = conversa(page).locator('[data-assunto-delicado]')
    await expect(cartao).toBeVisible({ timeout: AI_TIMEOUT_MS })
    await expect(cartao).toContainText('eu sou uma inteligência artificial')
    await expect(cartao.getByRole('link', { name: '188' })).toHaveAttribute('href', 'tel:188')
    await expect(pausa).toHaveAttribute('data-pausa-do-tutor', 'avaliacao')
    // O encaminhamento gasta uma das 60 trocas do dia, por ora (D36, D38; `tutor.int.test.ts`): a recusa da pergunta comum não
    // gravou nada, e o assunto delicado gravou a pergunta. A barra só mostra 1 quando a conversa é relida depois do cartão, e a
    // espera é por esse número: lida antes, ela diz 0, que é a leitura velha, e a asserção espera até o prazo da tela.
    await expect(principal(page).locator('[data-uso-do-dia]')).toContainText('Hoje: 1 de 60 perguntas', { timeout: SCREEN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})
