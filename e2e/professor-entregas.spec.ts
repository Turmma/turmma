import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { FUNCOES } from '../packages/shared/src/time/funcoes.ts'
import { atividadeSintetica, erroDaApi, portao, QUEM_DECIDE, versaoAdaptada } from './support/assistente.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { acionar, comLote, entrar, irPara, PRAZO_DA_TELA_MS, selosDeIA } from './support/professor/scenario.ts'
import { listaDoSino, sinoDe } from './support/professor/sino.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'

/**
 * As entregas do Assistente de ensino (11.4, A2 e A3, pacote W), na tela que o pé do sino abre. Separado de `professor-assistente.spec.ts` e
 * `professor-turma.spec.ts` pela 2.5.
 */

test.describe('Seu time › Assistente de ensino (11.4)', () => {
  test('carregando, erro, e sem entrega nenhuma a tela não fica vazia: diz o que o Assistente faz, com o texto da escola, e como pedir', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api } = await entrar(page, hasTouch)
    const segura = portao()
    api.trocar('entregas', async (pedido) => {
      await segura.aberta
      return pedido.url.searchParams.get('estado') === 'pendente' ? api.responder('entregas', pedido) : erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    await irPara(page, '/professor/time/assistente')
    await expect(page.getByText('Carregando o que o Assistente fez…')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    segura.abrir()
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    api.trocar('entregas')
    await acionar(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)

    // O vazio abre pelo que o Assistente faz, e só depois diz que não há nada esperando.
    const convite = page.getByRole('region', { name: 'O que o Assistente de ensino faz por você' })
    await expect(convite).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(convite).toContainText('Agora não há nada esperando você.')
    await expect(convite).toContainText(FUNCOES.adaptacao.fazSozinha)
    await expect(convite.getByRole('button', { name: 'Pedir ao Assistente' })).toBeVisible()
    // O cabeçalho diz o que cada função faz sozinha e o que espera aprovação, com o texto que a API dá.
    await acionar(page.getByText('O que cada função faz sozinha, e o que espera você'), hasTouch)
    const adaptacao = page.locator('[data-funcao="adaptacao"]')
    await expect(adaptacao).toContainText(FUNCOES.adaptacao.fazSozinha)
    await expect(adaptacao).toContainText(FUNCOES.adaptacao.esperaAprovacao)
    // Só as funções do Assistente: as do Tutor e do Analista não são dele.
    await expect(page.locator('[data-funcao]')).toHaveCount(3)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(convite.getByRole('button', { name: 'Pedir ao Assistente' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/)
  })

  test('a 1366 × 768 a página não rola com a conversa cheia: a faixa e as abas ficam paradas e só a conversa rola por dentro (RF22, correção formulario-e-assistente-rolam-a-pagina)', async ({ page, hasTouch }) => {
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    const origem = atividadeSintetica(turmaId, disciplinaId)
    const versoes = [versaoAdaptada(origem), versaoAdaptada(origem), versaoAdaptada(origem), versaoAdaptada(origem, 'aprovada'), versaoAdaptada(origem, 'aprovada'), versaoAdaptada(origem, 'rejeitada')]
    api.artefatos = [origem, ...versoes.map(({ artefato }) => artefato)]
    api.entregas = versoes.map(({ entrega }) => entrega)
    await irPara(page, '/professor/time/assistente')
    await expect(page.locator('[data-entrega]')).toHaveCount(versoes.length, { timeout: PRAZO_DA_TELA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    // A 360 px a página rola inteira, como qualquer outra: só se mede o miolo a partir de 768 px.
    if ((page.viewportSize()?.width ?? 0) < 768) return

    await paginaNaoRola(page)
    const painel = page.getByRole('tabpanel')
    expect(await painel.evaluate((elemento) => elemento.scrollHeight - elemento.clientHeight), 'a conversa rola por dentro').toBeGreaterThan(0)
    // A faixa "Esperando você" e as abas não saem do lugar com a conversa rolando.
    const abas = page.getByRole('tab', { name: 'Tudo' })
    const faixa = page.locator('[data-faixa-esperando]')
    const abasAntes = await abas.boundingBox()
    const faixaAntes = await faixa.boundingBox()
    expect(abasAntes, 'as abas têm caixa antes de a conversa rolar').not.toBeNull()
    expect(faixaAntes, 'a faixa tem caixa antes de a conversa rolar').not.toBeNull()
    await painel.evaluate((elemento) => elemento.scrollTo(0, elemento.scrollHeight))
    expect((await abas.boundingBox())?.y, 'as abas não saem do lugar').toBe(abasAntes?.y)
    expect((await faixa.boundingBox())?.y, 'a faixa não sai do lugar').toBe(faixaAntes?.y)
    // A última entrega chegou à vista, e a página continua com a altura da janela.
    const ultima = await page.locator('[data-entrega]').last().boundingBox()
    const caixaDoPainel = await painel.boundingBox()
    expect((ultima?.y ?? Infinity) + (ultima?.height ?? 0), 'a última entrega termina dentro do painel').toBeLessThanOrEqual((caixaDoPainel?.y ?? 0) + (caixaDoPainel?.height ?? 0) + 1)
    expect((caixaDoPainel?.y ?? Infinity) + (caixaDoPainel?.height ?? 0), 'o painel termina dentro da janela').toBeLessThanOrEqual(page.viewportSize()?.height ?? 0)
    await paginaNaoRola(page)
    // Abrir a lista da faixa muda a altura do que está acima da conversa: a conversa encolhe e a página continua sem rolar.
    await acionar(faixa.getByText('3 entregas esperando você'), hasTouch)
    await expect(faixa.getByRole('listitem')).toHaveCount(3)
    await paginaNaoRola(page)
  })

  test('Aprovar mostra o que vai acontecer antes de confirmar, passa pela decisão registrada uma vez só, mesmo com dois cliques, e a tela mostra quem aprovou e quando', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch, { antes: (simulada) => simulada.suspensas.add('adaptacao') })
    const origem = atividadeSintetica(turmaId, disciplinaId)
    const adaptada = versaoAdaptada(origem)
    const antiga = versaoAdaptada(origem, 'rejeitada')
    api.artefatos = [origem, adaptada.artefato]
    api.entregas = [adaptada.entrega, antiga.entrega]
    await irPara(page, '/professor/time/assistente')

    // A faixa "Esperando você" presa no alto, o filtro com o contador e a entrega em balão, assinada.
    const faixa = page.locator('[data-faixa-esperando]')
    await expect(faixa).toContainText(`${adaptada.artefato.titulo} · ${turmaNome}`, { timeout: PRAZO_DA_TELA_MS })
    expect(await faixa.evaluate((elemento) => getComputedStyle(elemento).position)).toBe('sticky')
    await expect(page.getByRole('tab')).toHaveText([/^Tudo$/, /^Esperando você1/, /^Correção$/, /^Adaptação$/])
    const pendente = page.locator('[data-entrega="pendente"]')
    await expect(pendente).toContainText(`Preparei "${adaptada.artefato.titulo}" da turma ${turmaNome}. Esta versão adaptada só pode ir aos alunos depois que você aprovar.`)
    await expect(pendente.getByText('Assistente · adaptação')).toBeVisible()
    await expect(selosDeIA(page.getByRole('log'))).toHaveCount(2)
    await expect(pendente.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você')
    // A escola suspendeu a Adaptação: a entrega que espera diz isso, e continua podendo ser decidida. A já decidida não diz.
    await expect(pendente.locator('[data-entrega-de-funcao-suspensa]')).toHaveText('A coordenação suspendeu a função "Adaptação" nesta escola: o Assistente não prepara outra enquanto isso. Esta entrega continua esperando a sua decisão.')
    await expect(page.locator('[data-entrega="rejeitada"] [data-entrega-de-funcao-suspensa]')).toHaveCount(0)
    // A rejeitada de antes diz quem rejeitou e o motivo, e não tem mais o que decidir.
    const rejeitada = page.locator('[data-entrega="rejeitada"]')
    await expect(rejeitada.locator('[data-aprovacao="rejeitada"]')).toContainText(`${QUEM_DECIDE.nome} rejeitou`)
    await expect(rejeitada.locator('[data-aprovacao="rejeitada"]')).toContainText('Motivo: A questão 2 perdeu o enunciado.')
    await expect(rejeitada.getByRole('button')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Aprovar é o botão preto, e abre a confirmação que diz o que é, de qual turma e o que muda.
    const aprovar = pendente.getByRole('button', { name: /^Aprovar/ })
    expect(await aprovar.evaluate((elemento) => getComputedStyle(elemento).backgroundColor)).toBe('rgb(51, 51, 51)')
    await acionar(aprovar, hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Aprovar a versão adaptada' })
    await expect(dialogo).toContainText(adaptada.artefato.titulo)
    await expect(dialogo).toContainText(turmaNome)
    await expect(dialogo).toContainText('Só depois da sua aprovação esta versão pode ir aos alunos da turma.')
    // Nada foi decidido só por abrir.
    expect(api.pedidosEm(/decidir$/)).toHaveLength(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Dois cliques seguidos em confirmar: uma decisão só.
    const segura = portao()
    api.trocar('decidir', async (pedido) => {
      await segura.aberta
      return api.responder('decidir', pedido)
    })
    const confirmar = dialogo.getByRole('button', { name: 'Aprovar a versão adaptada' })
    await confirmar.evaluate((botao: HTMLButtonElement) => {
      botao.click()
      botao.click()
    })
    await expect(dialogo.getByRole('button', { name: 'Aprovando…' })).toBeDisabled()
    segura.abrir()
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/decidir$/).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([{ caminho: `/v1/entregas/${adaptada.entrega.id}/decidir`, corpo: { decisao: 'aprovar' } }])

    // Depois de decidir, a tela mostra quem e quando, e não oferece decidir de novo.
    const decidida = page.locator('[data-entrega="aprovada"]')
    await expect(decidida.locator('[data-aprovacao="aprovada"]')).toContainText(`Aprovada por ${QUEM_DECIDE.nome} · `, { timeout: PRAZO_DA_TELA_MS })
    await expect(decidida.getByRole('button')).toHaveCount(0)
    // O botão que abriu o diálogo saiu com a decisão: o foco fica na entrega decidida, e não no `body`.
    await expect(decidida).toBeFocused()
    await expect(faixa).toHaveCount(0)
    // O número do sino acompanha: não há mais nada esperando.
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, nada')
  })

  test('Rejeitar exige justificativa de 8 a 500 caracteres antes de mandar, e a tela mostra quem rejeitou e o motivo; a entrega já decidida em outra aba vira a tela atualizada, e não erro', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    const origem = atividadeSintetica(turmaId, disciplinaId)
    const primeira = versaoAdaptada(origem)
    const segunda = versaoAdaptada({ ...origem, titulo: 'Lista 4' })
    api.artefatos = [origem, primeira.artefato, segunda.artefato]
    api.entregas = [primeira.entrega, { ...segunda.entrega, criadaEm: '2026-10-05T14:00:00.000Z' }]
    // As entregas vêm em páginas: "Ver mais entregas" traz a seguinte.
    api.porPagina = 1
    await irPara(page, '/professor/time/assistente')
    const pendentes = page.locator('[data-entrega="pendente"]')
    await expect(pendentes).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page.getByRole('button', { name: 'Ver mais entregas' }), hasTouch)
    await expect(pendentes).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('button', { name: 'Ver mais entregas' })).toHaveCount(0)
    api.porPagina = undefined
    // Com mais de uma pendência a faixa presa fica recolhida no contador, e abre a pedido: não toma a tela do celular.
    const faixa = page.locator('[data-faixa-esperando]')
    await expect(faixa.getByText('2 entregas esperando você')).toBeVisible()
    await expect(faixa.getByRole('button', { name: /^Ver/ })).toHaveCount(0)
    await acionar(faixa.getByText('2 entregas esperando você'), hasTouch)
    await expect(faixa.getByRole('button', { name: /^Ver/ })).toHaveCount(2)
    await acionar(faixa.getByText('2 entregas esperando você'), hasTouch)

    await acionar(pendentes.nth(0).getByRole('button', { name: /^Rejeitar/ }), hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Rejeitar a versão adaptada' })
    const justificativa = dialogo.getByLabel(/Por que você está rejeitando\?/)
    await expect(dialogo).toContainText('Não escreva nome de aluno nem o motivo da adaptação.')
    const confirmar = dialogo.getByRole('button', { name: 'Rejeitar a versão adaptada' })
    // Sem justificativa, e com uma curta demais, nada é mandado, e o campo diz o que falta.
    await acionar(confirmar, hasTouch)
    await expect(dialogo.getByText('Escreva pelo menos 8 caracteres.')).toBeVisible()
    await justificativa.fill('  curta  ')
    await acionar(confirmar, hasTouch)
    await expect(dialogo.getByText('Escreva pelo menos 8 caracteres: faltam 3.')).toBeVisible()
    await expect(justificativa).toHaveAttribute('aria-invalid', 'true')
    expect(api.pedidosEm(/decidir$/)).toHaveLength(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await justificativa.fill('  A questão 2 ficou sem as alternativas.  ')
    await acionar(confirmar, hasTouch)
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/decidir$/).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([
      { caminho: `/v1/entregas/${primeira.entrega.id}/decidir`, corpo: { decisao: 'rejeitar', justificativa: 'A questão 2 ficou sem as alternativas.' } },
    ])
    const rejeitada = page.locator('[data-entrega="rejeitada"]')
    await expect(rejeitada.locator('[data-aprovacao="rejeitada"]')).toContainText(`${QUEM_DECIDE.nome} rejeitou · `, { timeout: PRAZO_DA_TELA_MS })
    await expect(rejeitada.locator('[data-aprovacao="rejeitada"]')).toContainText('Motivo: A questão 2 ficou sem as alternativas.')
    await expect(rejeitada).toBeFocused()

    // A outra entrega é decidida em outra aba enquanto o diálogo está aberto nesta.
    await acionar(pendentes.nth(0).getByRole('button', { name: /^Aprovar/ }), hasTouch)
    const aprovar = page.getByRole('alertdialog', { name: 'Aprovar a versão adaptada' })
    await expect(aprovar).toBeVisible()
    api.entregas = api.entregas.map((entrega) => (entrega.id === segunda.entrega.id ? { ...entrega, estado: 'aprovada', decididaEm: '2026-10-05T15:00:00.000Z', decididaPor: QUEM_DECIDE } : entrega))
    await acionar(aprovar.getByRole('button', { name: 'Aprovar a versão adaptada' }), hasTouch)
    await expect(aprovar).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'já tinha sido decidida' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('ENTREGA_JA_DECIDIDA')
    await expect(page.locator('[data-entrega="aprovada"] [data-aprovacao="aprovada"]')).toContainText(`Aprovada por ${QUEM_DECIDE.nome}`, { timeout: PRAZO_DA_TELA_MS })
    await expect(pendentes).toHaveCount(0)
    // Também aqui o diálogo só fechou depois de a tela reler: o foco está na entrega, e não no `body`.
    await expect(page.locator('[data-entrega="aprovada"]')).toBeFocused()
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('Seu time com a correção e o Tutor (11.4)', () => {
  test('o lote de correção espera a professora com "Revisar", que leva à tela de aprovar: não se aprova de dentro do balão; e a Home aponta para a mesma tela', async ({ page, hasTouch }) => {
    test.slow()
    const { api, turmaNome } = await entrar(page, hasTouch, { antes: (simulada, turma) => void comLote(simulada, turma) })
    const atividadeId = [...api.correcoes.keys()][0] ?? ''
    // O título do caso fica como era (o prazo do `test.slow()` do HEAD se acha por ele): a Home deixou de mostrar o lote, e quem
    // aponta para a mesma tela é o sino, com "Correção para revisar", a atividade e a turma.
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, 1', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('main').getByRole('heading', { name: 'Esperando você' })).toHaveCount(0)
    await acionar(sinoDe(page), hasTouch)
    await expect(listaDoSino(page).getByRole('region', { name: turmaNome }).getByRole('link', { name: /Correção para revisar.*Atividade de estequiometria/ })).toBeVisible()
    await page.keyboard.press('Escape')

    await irPara(page, '/professor/time/assistente')
    const lote = page.locator('[data-entrega="pendente"]')
    await expect(lote).toContainText(`Corrigi "Atividade de estequiometria" da turma ${turmaNome}. O diagnóstico só chega aos alunos depois que você revisar os destaques e aprovar.`, { timeout: PRAZO_DA_TELA_MS })
    await expect(lote.getByText('Assistente · correção de objetiva')).toBeVisible()
    await expect(lote.locator('[data-selo-ia]')).toHaveCount(1)
    await expect(lote.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você')
    // Nenhum botão de decidir no balão: a decisão do lote é na tela dos destaques.
    await expect(lote.getByRole('button')).toHaveCount(0)
    // A aba "Correção" tem conteúdo.
    await acionar(page.getByRole('tab', { name: 'Correção' }), hasTouch)
    await expect(page.locator('[data-entrega]')).toHaveCount(1)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(lote.getByRole('link', { name: /^Revisar/ }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/aprovar/${atividadeId}$`))
    await expect(page.getByRole('group', { name: 'Aprovação do lote' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
  })
})
