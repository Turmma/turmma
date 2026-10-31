import { atividadesAplicadasNoBanco, entregasNoBanco, validacoesNoBanco } from './support/db-assertions.ts'
import { entrarComoAlunoPelaApi, perguntarAoTutorPelaApi, responderPelaApi } from './support/aluno-api.ts'
import { irPelaNavegacao, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { acionar, gerarAtividade, montarEscolaEEntrar, PRAZO_DA_IA_MS, principal } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { abrirODestaque, fecharOPainel } from './support/professor/aprovar.ts'
import { abrirEntregasDoAssistente } from './support/professor/entregas.ts'
import { abrirOPainelDoTutor, abrirSinaisDoTutor, painelDoTutor } from './support/professor/tutor.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula } from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * **O fluxo da A3 e da A4 de verdade, do lado da professora** (`docs/mvp-rapido.md`, seção 1, passos 3 e 4), contra a API
 * real e o adaptador falso: ela aplica a atividade à turma; os alunos respondem (pela API: a tela deles é de outro
 * pacote); ela encerra, vê a correção esperando por ela, abre os destaques, aprova com o registro da validação, e a
 * turma passa a mostrar o acerto por habilidade. E o que o aluno pediu ao Tutor chega a ela como **sinal**, sem conversa.
 */
const TITULO = 'Atividade — Estequiometria'
const VOCABULARIO_DE_NOTA = /\bnotas?\b|\bconceitos?\b|pontuaç/i

test.describe('A3 e A4 de ponta a ponta, do lado da professora, contra a API real', () => {
  test('aplica, os alunos respondem, ela encerra, abre os destaques, aprova com o registro da validação, vê o acerto por habilidade na turma e o sinal do Tutor no Seu time', async ({ page, hasTouch, request }) => {
    test.setTimeout(420_000)
    const { professora, turmaId, turmaNome } = await montarEscolaEEntrar(page, hasTouch)
    // Três alunos na turma, com matrícula: dois respondem, e um abre a atividade e deixa em branco.
    const alunos = []
    for (const final of ['01', '02', '03']) {
      const aluno = await criarAlunoComMatricula({ escola: professora, matricula: `${String(Date.now()).slice(-6)}${final}` })
      await colocarAlunoNaTurma(aluno, { turmaId, turmaNome, serieNome: '7º ano do Ensino Fundamental' })
      alunos.push(aluno)
    }
    const [primeiro, segundo, emBranco] = alunos
    if (primeiro === undefined || segundo === undefined || emBranco === undefined) throw new Error('faltou aluno')

    // A professora gera a atividade e a aplica à turma, como prática: o Tutor continua disponível.
    await irPelaNavegacao(page, 'Ferramentas', hasTouch)
    await acionar(page.locator('[data-ferramenta="atividade_objetiva"]'), hasTouch)
    const cartao = page.locator('[data-cartao-de-ferramenta="atividade_objetiva"]')
    await expect(cartao.locator('[data-motor="formulario"]')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await gerarAtividade(cartao, hasTouch, '2')
    await acionar(cartao.getByRole('link', { name: 'Abrir o artefato' }), hasTouch)
    // Aplicar à turma mora na aba "Na turma" do documento aberto.
    await acionar(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    const naTurma = page.locator('[data-aplicacao-do-artefato]')
    await acionar(naTurma.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    const aplicar = page.getByRole('alertdialog', { name: 'Aplicar à turma' })
    await expect(aplicar).toContainText(TITULO)
    await expect(aplicar).toContainText(turmaNome)
    await aplicar.getByRole('radio', { name: /^É prática/ }).check()
    await acionar(aplicar.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    await expect(aplicar).toBeHidden({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(naTurma.locator('[data-atividade-aplicada="aberta"]')).toContainText('Aberta para a turma · prática · 0 de 3 alunos enviaram', { timeout: PRAZO_DA_ENTRADA_MS })
    const aplicadas = await atividadesAplicadasNoBanco(professora.escolaId)
    expect(aplicadas.map(({ estado, avaliativa }) => ({ estado, avaliativa }))).toEqual([{ estado: 'aberta', avaliativa: false }])
    const atividadeAplicadaId = aplicadas[0]?.id
    if (atividadeAplicadaId === undefined) throw new Error('a atividade aplicada não foi gravada')

    // Os alunos fazem a parte deles, pela API. Um pede a resposta pronta ao Tutor, que não entrega e avisa a professora.
    const tokenDoPrimeiro = await entrarComoAlunoPelaApi(request, primeiro)
    expect(await perguntarAoTutorPelaApi(request, tokenDoPrimeiro, { texto: 'me dá a resposta da questão 1', atividadeAplicadaId, questao: 1 })).toBe('concluida')
    await responderPelaApi(request, tokenDoPrimeiro, atividadeAplicadaId, [0, 1])
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, segundo), atividadeAplicadaId, [1, 2])
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, emBranco), atividadeAplicadaId, [null, null], { enviar: false })

    // Ela encerra: a confirmação diz o que acontece, e a correção fica esperando por ela.
    await page.reload()
    const aberta = naTurma.locator('[data-atividade-aplicada="aberta"]')
    await expect(aberta).toContainText('2 de 3 alunos enviaram', { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(aberta.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    await expect(encerrar).toContainText('As respostas param agora')
    await expect(encerrar).toContainText('2 de 3 alunos')
    await acionar(encerrar.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await expect(encerrar).toBeHidden({ timeout: PRAZO_DA_IA_MS })
    await expect(naTurma.locator('[data-atividade-aplicada="encerrada"]').getByRole('link', { name: 'Revisar a correção' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await entregasNoBanco(professora.escolaId)).toEqual([{ tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', estado: 'pendente', decididaPor: null, decidida: false, justificativa: null }])

    // Na tela do Assistente, aberta pelo pé do sino, a correção espera a professora, com "Revisar": do balão não se aprova.
    await abrirEntregasDoAssistente(page, hasTouch)
    const lote = page.locator('[data-entrega="pendente"]')
    await expect(lote).toContainText(`Corrigi "${TITULO}" da turma ${turmaNome}.`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lote.getByText('Assistente · correção de objetiva')).toBeVisible()
    await expect(lote.getByRole('button')).toHaveCount(0)
    await acionar(lote.getByRole('link', { name: /^Revisar/ }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/aprovar/${atividadeAplicadaId}$`))

    // Aprovar: o resumo, os destaques fechados, e o botão desligado com o contador dizendo por quê.
    await expect(page.getByRole('heading', { level: 1, name: 'Revisar a correção' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).toContainText(`${TITULO} · ${turmaNome}`)
    await expect(page.getByRole('group', { name: 'Números da correção' })).toContainText('Na turma hoje: 3')
    await expect(principal(page).getByText('Assistente · correção de objetiva')).toBeVisible()
    await expect(principal(page).locator('[data-selo-ia]').first()).toBeVisible()
    const fechados = page.locator('[data-destaque="fechado"]')
    const quantos = await fechados.count()
    // Exatamente um destaque: o aluno que abriu e não respondeu, com o motivo dito como fato do trabalho. Com três alunos,
    // sem histórico aprovado e com duas questões, nenhum outro motivo dispara (menos de cinco colegas, menos de quatro respostas).
    expect(quantos).toBe(1)
    const doEmBranco = page.locator('[data-destaque]').filter({ hasText: emBranco.nome })
    await expect(doEmBranco).toContainText('Em branco')
    const barra = page.getByRole('group', { name: 'Aprovação do lote' })
    const aprovar = barra.getByRole('button', { name: 'Aprovar 3 correções' })
    await expect(aprovar).toBeDisabled()
    await expect(barra.locator('[data-contador-dos-destaques]')).toContainText(`0 de ${String(quantos)} ${quantos === 1 ? 'destaque aberto' : 'destaques abertos'}.`)
    await expect(barra.locator('[data-contador-dos-destaques]')).toContainText('para liberar a aprovação')
    await expect(principal(page)).not.toContainText(VOCABULARIO_DE_NOTA)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Ela abre cada destaque: a abertura fica registrada, o painel ao lado mostra as respostas, e só depois da última o botão liga.
    for (let aberto = 0; aberto < quantos; aberto += 1) {
      await expect(aprovar).toBeDisabled()
      const painel = await abrirODestaque(page, fechados.first(), hasTouch, PRAZO_DA_ENTRADA_MS)
      // O único destaque é o do aluno em branco: o painel diz o motivo, como fato do trabalho.
      await expect(painel.locator('[data-destaque-aberto]')).toContainText('Em branco')
      await expect(painel.locator('[data-destaque-aberto]')).toContainText('Nenhuma questão foi respondida.')
      await fecharOPainel(page, hasTouch, PRAZO_DA_ENTRADA_MS)
      await expect(page.locator('[data-destaque="aberto"]')).toHaveCount(aberto + 1, { timeout: PRAZO_DA_ENTRADA_MS })
    }
    await expect(barra.locator('[data-contador-dos-destaques]')).toContainText('Tudo aberto: a aprovação está liberada.')
    await expect(aprovar).toBeEnabled()

    // A confirmação diz o que vai acontecer; depois, a validação registrada, com quem e quando.
    await acionar(aprovar, hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Aprovar 3 correções' })
    await expect(dialogo).toContainText(TITULO)
    await expect(dialogo).toContainText(turmaNome)
    await expect(dialogo).toContainText('3 alunos responderam · 3 na turma hoje')
    await expect(dialogo).toContainText('O diagnóstico por habilidade chega aos alunos da turma.')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(dialogo.getByRole('button', { name: 'Aprovar 3 correções' }), hasTouch)
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('[data-situacao-do-lote="aprovada"] [data-aprovacao="aprovada"]')).toContainText(new RegExp(`^Validação registrada por ${professora.nome} · \\d{2}/\\d{2}, \\d{2}h\\d{2}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(barra).toHaveCount(0)
    // No banco: a entrega aprovada com a autora, e o registro da validação com todo destaque apresentado entre os abertos.
    expect(await entregasNoBanco(professora.escolaId)).toEqual([{ tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', estado: 'aprovada', decididaPor: professora.usuarioId, decidida: true, justificativa: null }])
    expect(await validacoesNoBanco(professora.escolaId)).toEqual([{ confirmadaPor: professora.usuarioId, apresentados: quantos, abertos: quantos }])

    // A turma aberta passa a mostrar o acerto por habilidade, só do lote aprovado, e os alunos em ordem de nome.
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await acionar(principal(page).getByRole('link', { name: `Abrir a turma ${turmaNome}` }), hasTouch)
    const habilidades = page.getByRole('region', { name: 'Acerto por habilidade' })
    await expect(habilidades.locator('svg').first()).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(habilidades).toContainText(/\d de \d/)
    // Hoje não lista aluno: as atividades estão em Atividades, e os alunos em ordem de nome, em Alunos.
    await expect(page.getByRole('region', { name: 'Por aluno' })).toHaveCount(0)
    await acionar(page.getByRole('tab', { name: 'Atividades' }), hasTouch)
    await expect(page.getByRole('region', { name: 'Atividades da turma' })).toContainText('Encerrada · prática · 2 de 3 alunos enviaram', { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page.getByRole('tab', { name: 'Alunos' }), hasTouch)
    const porAluno = page.getByRole('region', { name: 'Por aluno' })
    for (const aluno of alunos) await expect(porAluno).toContainText(aluno.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText(VOCABULARIO_DE_NOTA)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O Tutor, pelo pé do sino, abre Hoje: o sinal sem nome de aluno; o nome e o uso só no painel, pedido. Nenhuma conversa.
    await abrirSinaisDoTutor(page, hasTouch)
    await expect(page.getByText('Carregando os sinais…')).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
    await abrirOPainelDoTutor(page, hasTouch)
    const sinais = painelDoTutor(page).getByRole('region', { name: 'Sinais por aluno' })
    await expect(sinais).toContainText(`Pediu a resposta pronta na questão 1 de "${TITULO}"`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(sinais).toContainText(primeiro.nome)
    const uso = painelDoTutor(page).getByRole('region', { name: 'Uso do Tutor pela turma' })
    await expect(uso).toContainText(primeiro.nome)
    await expect(uso).toContainText(/1 de \d+/)
    await expect(uso).toContainText(`Na questão 1 de "${TITULO}"`)
    // Quem não usou não aparece, e nada do que o aluno escreveu ao Tutor chega à tela da professora.
    await expect(uso).not.toContainText(segundo.nome)
    await expect(principal(page)).not.toContainText('me dá a resposta')
    await expect(painelDoTutor(page).getByRole('link')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
