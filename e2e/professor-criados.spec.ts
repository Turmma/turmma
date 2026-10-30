import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { atividadeSintetica, erroDaApi, portao, versaoAdaptada } from './__fixtures__/assistente.ts'
import { abrirNavegacao, entrarPelaApi, entrarPorEmail, escolherNoSeletor, irPelaNavegacao, nomeNoSeletor, PRAZO_DA_ENTRADA_MS, secoes } from './__fixtures__/casca.ts'
import { criarArtefatoDoVinculo, entrarEmCriados } from './__fixtures__/professor/criados.ts'
import { acionar, irPara, PRAZO_DA_TELA_MS } from './__fixtures__/professor/cena.ts'
import { carregarSemRedeLenta, expect, test } from './__fixtures__/perfis.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, criarUsuarioEmOutraEscola } from './__fixtures__/sessao.ts'
import { larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * "Criados" (telas do professor, 5.0; D74, D80; `docs/interface.md` 11.2): o que a professora já gerou, por turma, com os
 * filtros no endereço. A lista é a de `GET /v1/artefatos`, a mesma de antes, e saiu de Ferramentas.
 *
 * Cada caso é curto de propósito: o portão da tarefa reprova o caso de e2e que passa de 15 s na máquina, e o login pela tela
 * leva a maior parte deles. Por isso os casos entram pela API e abrem Criados direto (`entrarEmCriados`, `entrarPelaApi`).
 */

const noComputador = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768
const documentos = (page: Page) => page.locator('[data-artefato]')
const gruposDe = (page: Page) => page.getByRole('main').getByRole('heading', { level: 2 })
const tituloDaTela = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1, name: 'Criados' })

/** As leituras de `GET /v1/artefatos` que a tela faz de agora em diante, com a consulta que levaram (a turma, a página). */
function leiturasDaLista(page: Page): { readonly urls: string[] } {
  const urls: string[] = []
  page.on('request', (pedido) => {
    const url = new URL(pedido.url())
    if (pedido.method() === 'GET' && url.pathname === '/v1/artefatos') urls.push(`${url.pathname}${url.search}`)
  })
  return { urls }
}

/**
 * Escolhe uma opção de um filtro, no computador pelo menu e no celular pelo diálogo "Filtrar" (regra 50, item 2a). No celular
 * o diálogo fecha em "Ver …": o resto da página fica inerte enquanto ele está aberto.
 */
async function escolher(page: Page, hasTouch: boolean, filtro: 'Tipo' | 'Turma' | 'Estado', opcao: string): Promise<void> {
  if (noComputador(page)) {
    await acionar(page.getByRole('button', { name: new RegExp(`^${filtro}`) }), hasTouch)
    await acionar(page.getByRole('menuitemradio', { name: opcao, exact: true }), hasTouch)
    return
  }
  const dialogo = page.getByRole('dialog', { name: 'Filtrar' })
  await acionar(page.getByRole('button', { name: /^Filtrar/ }), hasTouch)
  await expect(dialogo).toBeVisible()
  await acionar(dialogo.getByRole('group', { name: filtro }).getByRole('button', { name: opcao, exact: true }), hasTouch)
  await acionar(dialogo.getByRole('button', { name: /^Ver / }), hasTouch)
  await expect(dialogo).toBeHidden()
}

test.describe('Criados (D74, D80): o que a professora já gerou', () => {
  test('carregando e erro: o texto de espera, a mensagem do catálogo, e "Tentar de novo" lê de novo e mostra o vazio', async ({ page, hasTouch }) => {
    const segura = portao()
    const { api } = await entrarEmCriados(page, {
      antes: ({ api: simulada }) =>
        simulada.trocar('artefatos', async () => {
          await segura.aberta
          return erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO')
        }),
    })
    await expect(page).toHaveTitle('Criados · Turmma', { timeout: PRAZO_DA_TELA_MS })
    await expect(tituloDaTela(page)).toBeVisible()
    await expect(page.getByText('Carregando o que você já gerou…')).toBeVisible()
    segura.abrir()
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    api.trocar('artefatos')
    await acionar(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(page.getByText('Nada gerado ainda')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
  })

  test('vazio: "Nada gerado ainda" leva a Ferramentas, sem rolagem para o lado e sem violação de acessibilidade', async ({ page, hasTouch }) => {
    await entrarEmCriados(page)
    await expect(page.getByText('Nada gerado ainda')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(page.getByRole('button', { name: 'Ir para Ferramentas' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/ferramentas$/, { timeout: PRAZO_DA_TELA_MS })
  })

  test('vazio: a onça, o título e a ação ficam no mesmo eixo, como no mockup', async ({ page }) => {
    await entrarEmCriados(page)
    await expect(page.getByText('Nada gerado ainda')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // Mede o que se vê. A caixa do `<p>` do título ocupa a largura inteira mesmo com o texto à esquerda, e enganaria a conta: por isso o
    // centro do título é o do **texto** (um `Range`), e o do botão é o da caixa dele.
    const centros = await page.evaluate(() => {
      const meio = (r: DOMRect): number => r.left + r.width / 2
      // O desenho (o `svg`) é o que se mede, e a sua falta reprova: a `figure` da onça ocupa a largura toda e se centraliza de qualquer jeito,
      // e foi esse o erro que deixou o vazio descentralizado passar. A busca é dentro do `main`, para não medir uma onça de fora da tela.
      const desenho = document.querySelector('main [data-onca] svg')
      const titulo = Array.from(document.querySelectorAll('main p')).find((p) => p.textContent === 'Nada gerado ainda')
      const botao = Array.from(document.querySelectorAll('main button')).find((b) => b.textContent?.trim() === 'Ir para Ferramentas')
      if (desenho === null || titulo === undefined || botao === undefined) return null
      const texto = document.createRange()
      texto.selectNodeContents(titulo)
      return { onca: meio(desenho.getBoundingClientRect()), titulo: meio(texto.getBoundingClientRect()), botao: meio(botao.getBoundingClientRect()) }
    })
    expect(centros, 'o desenho da onça, o título e o botão do vazio estão na tela').not.toBeNull()
    const { onca, titulo, botao } = centros as { onca: number; titulo: number; botao: number }
    expect(Math.abs(onca - titulo), `onça em ${onca.toFixed(1)}, texto do título em ${titulo.toFixed(1)}`).toBeLessThanOrEqual(3)
    expect(Math.abs(onca - botao), `onça em ${onca.toFixed(1)}, botão em ${botao.toFixed(1)}`).toBeLessThanOrEqual(3)
  })

  test('com dado: a lista em páginas, "Ver mais" traz a seguinte, o grupo leva o nome da turma, e só a versão adaptada tem a situação dela', async ({ page, hasTouch }) => {
    const { turmaNome } = await entrarEmCriados(page, {
      antes: ({ api, turmaId, disciplinaId }) => {
        const origem = atividadeSintetica(turmaId, disciplinaId)
        api.artefatos = [versaoAdaptada(origem).artefato, origem]
        // A lista vem em páginas: a primeira, e "Ver mais" traz a seguinte.
        api.porPagina = 1
      },
    })
    await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page.getByRole('button', { name: 'Ver mais' }), hasTouch)
    await expect(documentos(page)).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('button', { name: 'Ver mais' })).toHaveCount(0)
    // Os dois são da mesma turma e disciplina: um grupo só, com o nome dela.
    await expect(gruposDe(page)).toHaveText([`${turmaNome} · Química`])
    await expect(documentos(page).nth(0)).toContainText('Versão adaptada · Fonte ampliada + Tempo adicional (50% a mais)')
    await expect(documentos(page).nth(0)).toContainText('Esperando você')
    await expect(documentos(page).nth(1)).toContainText(`Atividade objetiva · ${turmaNome}`)
    // O original não passa por aprovação: não tem selo.
    await expect(documentos(page).nth(1)).not.toContainText('Esperando você')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o tipo filtra o que já foi lido, sem ler de novo, e mora no endereço', async ({ page, hasTouch }) => {
    let nomeDoGrupo = ''
    await entrarEmCriados(page, {
      antes: ({ api, turmaId, disciplinaId, turmaNome }) => {
        nomeDoGrupo = `${turmaNome} · Química`
        const origem = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade de estequiometria' })
        const plano = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Plano de eletroquímica', tipo: 'plano_de_aula' })
        api.artefatos = [versaoAdaptada(origem).artefato, plano, origem]
      },
    })
    const leituras = leiturasDaLista(page)
    await expect(documentos(page)).toHaveCount(3, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('region', { name: nomeDoGrupo })).toContainText('3 documentos')
    await escolher(page, hasTouch, 'Tipo', 'Plano de aula')
    await expect(page).toHaveURL(/\/professor\/criados\?tipo=plano_de_aula$/)
    await expect(documentos(page)).toHaveCount(1)
    await expect(documentos(page)).toContainText('Plano de eletroquímica')
    await expect(page.getByRole('region', { name: nomeDoGrupo })).toContainText('1 documento')
    expect(leituras.urls, 'o tipo não lê a lista de novo').toEqual([])
  })

  test('o estado é o da decisão sobre a versão adaptada; valor desconhecido no endereço cai em "todos"; sem resultado, "Limpar filtros" volta ao endereço limpo', async ({ page, hasTouch }) => {
    // O endereço abre com valores que a tela não conhece: ela abre a lista inteira, sem quebrar.
    await entrarEmCriados(page, {
      endereco: '/professor/criados?tipo=prova&estado=para_aprovar&turma=7a',
      antes: ({ api, turmaId, disciplinaId }) => {
        const origem = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade de estequiometria' })
        const adaptada = versaoAdaptada(origem)
        api.artefatos = [adaptada.artefato, origem]
        api.entregas = [adaptada.entrega]
      },
    })
    const leituras = leiturasDaLista(page)
    await expect(documentos(page)).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    // Com um estado escolhido o original não passa: ele não tem decisão. Ninguém rejeitou a versão adaptada.
    await escolher(page, hasTouch, 'Estado', 'Rejeitada')
    await expect(page).toHaveURL(/estado=rejeitada/)
    await expect(documentos(page)).toHaveCount(0)
    await expect(page.getByText('Nada com estes filtros')).toBeVisible()
    expect(leituras.urls, 'o estado não lê a lista de novo').toEqual([])
    await acionar(page.getByRole('button', { name: 'Limpar filtros' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/criados$/)
    await expect(documentos(page)).toHaveCount(2)
    await expect(tituloDaTela(page)).toBeFocused()
  })

  test('a turma vai ao servidor: trocar a turma lê de novo com `?turmaId=`, e a lista que volta é a dela', async ({ page, hasTouch }) => {
    const { turmaId, turmaNome } = await entrarEmCriados(page, {
      antes: ({ api, turmaId: daProfessora, disciplinaId }) => {
        // O segundo documento é de uma turma em que a professora não tem vínculo: a tela o põe em "Outra turma", nunca pelo id.
        api.artefatos = [atividadeSintetica(daProfessora, disciplinaId, { titulo: 'Atividade de estequiometria' }), atividadeSintetica(randomUUID(), randomUUID(), { titulo: 'Atividade de ótica' })]
      },
    })
    const leituras = leiturasDaLista(page)
    await expect(documentos(page)).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    await expect(gruposDe(page)).toHaveText([`${turmaNome} · Química`, 'Outra turma'])
    await escolher(page, hasTouch, 'Turma', turmaNome)
    await expect(page).toHaveURL(new RegExp(`/professor/criados\\?turma=${turmaId}$`))
    await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toContainText('Atividade de estequiometria')
    expect(leituras.urls).toContain(`/v1/artefatos?turmaId=${turmaId}`)
  })

  test('o voltar devolve os filtros: abrir um documento e voltar pelo histórico mostra a lista como estava', async ({ page, hasTouch }) => {
    await entrarEmCriados(page, {
      antes: ({ api, turmaId, disciplinaId }) => {
        api.artefatos = [atividadeSintetica(turmaId, disciplinaId, { titulo: 'Plano de eletroquímica', tipo: 'plano_de_aula' }), atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade de estequiometria' })]
      },
    })
    await expect(documentos(page)).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    // O filtro é do endereço: ligar um, abrir um documento e voltar tem de devolver a lista com ele.
    await irPara(page, '/professor/criados?tipo=atividade_objetiva')
    await expect(documentos(page)).toHaveCount(1)
    await acionar(documentos(page).getByRole('link'), hasTouch)
    await expect(page.getByRole('heading', { level: 1, name: 'Atividade de estequiometria' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await page.goBack()
    await expect(page).toHaveURL(/\/professor\/criados\?tipo=atividade_objetiva$/)
    await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toContainText('Atividade de estequiometria')
    await expect(page.getByText('Plano de eletroquímica')).toHaveCount(0)
  })

  test('Criados é o quarto lugar, depois de Início, Turmas e Ferramentas, na lateral, no trilho e na barra de baixo', async ({ page, hasTouch }) => {
    await entrarEmCriados(page, { endereco: '/professor/turmas' })
    for (const largura of [1366, 900, 360]) {
      await page.setViewportSize({ width: largura, height: 800 })
      await abrirNavegacao(page, hasTouch)
      // No trilho o rótulo aparece duas vezes no texto (o do leitor e o da dica): os nomes dos quatro links é que valem.
      await expect(secoes(page).getByRole('link'), `${String(largura)} px`).toHaveCount(4)
      for (const rotulo of ['Início', 'Turmas', 'Ferramentas', 'Criados']) await expect(secoes(page).getByRole('link', { name: rotulo, exact: true }), `${rotulo} a ${String(largura)} px`).toHaveCount(1)
      // O ícone do lugar é decoração: o nome do link é só o rótulo.
      await expect(secoes(page).getByRole('link', { name: 'Criados' }).locator('svg[data-icone]'), `${String(largura)} px`).toHaveCount(1)
      await irPelaNavegacao(page, 'Criados', hasTouch)
      await expect(page).toHaveURL(/\/professor\/criados$/)
      await abrirNavegacao(page, hasTouch)
      await expect(secoes(page).getByRole('link', { name: 'Criados' }), `${String(largura)} px`).toHaveAttribute('aria-current', 'page')
      await expect(secoes(page).getByRole('link', { name: 'Ferramentas' })).not.toHaveAttribute('aria-current', 'page')
      expect(await larguraExcedente(page), `${String(largura)} px`).toBe(0)
      await irPelaNavegacao(page, 'Turmas', hasTouch)
      await expect(page).toHaveURL(/\/professor\/turmas$/)
    }
  })

  test('recomeço: a professora seguinte entra pela tela, na mesma aba e sem recarregar, e a turma da anterior no endereço não lhe mostra a lista dela', async ({ page, hasTouch }) => {
    const primeira = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(primeira.escolaId, primeira.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(primeira.escolaId, alocacao.vinculoIds)
    const confidencial = `Atividade confidencial da professora ${randomUUID().slice(0, 8)}`
    await criarArtefatoDoVinculo(primeira.escolaId, alocacao.vinculoIds[0] ?? '', primeira.usuarioId, confidencial)
    const segunda = await criarEquipeComSenha()
    const alocacaoDaSegunda = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(segunda.escolaId, alocacaoDaSegunda.vinculoIds)
    // A primeira abre Criados já com a turma no endereço: é a chave que a segunda vai pedir, e que o cache só guarda se a leitura foi essa.
    // A primeira carga não afirma nada sobre o tempo de baixar (`carregarSemRedeLenta`); o que vem depois, sim.
    await carregarSemRedeLenta(page, async () => {
      await entrarPelaApi(page, primeira, `/professor/criados?turma=${alocacao.turmaId}`)
      await expect(documentos(page)).toContainText(confidencial, { timeout: PRAZO_DA_TELA_MS })
    })

    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // Pela tela, sem recarregar: a recarga apagaria o cache, e o cache é o que este caso quer ver esvaziado.
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await irPara(page, `/professor/criados?turma=${alocacao.turmaId}`)
    await expect(page.getByText('Nada com estes filtros')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(confidencial)
    await expect(page.locator('body')).not.toContainText(primeira.nome)
  })

  test('isolamento (regra 10): a turma de outra escola no endereço mostra o mesmo que uma turma que não existe, e o documento dela não aparece', async ({ page }) => {
    // A API de verdade, sem simulação: é o repositório que impede o vazamento, e uma API simulada não o provaria.
    const marca = randomUUID().slice(0, 8)
    const tituloDela = `Atividade da professora ${marca}`
    const tituloDeFora = `Atividade da escola vizinha ${marca}`

    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
    await criarArtefatoDoVinculo(professora.escolaId, alocacao.vinculoIds[0] ?? '', professora.usuarioId, tituloDela)

    const vizinha = await criarEquipeComSenha()
    const alocacaoDaVizinha = await criarAlocacaoDoProfessor(vizinha.escolaId, vizinha.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(vizinha.escolaId, alocacaoDaVizinha.vinculoIds)
    const deFora = await criarArtefatoDoVinculo(vizinha.escolaId, alocacaoDaVizinha.vinculoIds[0] ?? '', vizinha.usuarioId, tituloDeFora)

    await entrarPelaApi(page, professora, '/professor/criados')
    // Sem filtro: só o dela, na turma dela.
    await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toContainText(tituloDela)
    await expect(gruposDe(page)).toHaveText([`${alocacao.turmaNome} · Química`])
    await expect(page.locator('body')).not.toContainText(tituloDeFora)

    // A turma da escola vizinha, no endereço: nada, e a tela não diz que a turma existe.
    await irPara(page, `/professor/criados?turma=${deFora.turmaId}`)
    await expect(page.getByText('Nada com estes filtros')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(tituloDeFora)
    await expect(page.locator('body')).not.toContainText(alocacaoDaVizinha.turmaNome)
    const comTurmaDeFora = await page.getByRole('main').innerText()

    // Uma turma que não existe em lugar nenhum responde igual (regra 10, item 6): o texto da tela é o mesmo.
    await irPara(page, `/professor/criados?turma=${randomUUID()}`)
    await expect(page.getByText('Nada com estes filtros')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(await page.getByRole('main').innerText()).toBe(comTurmaDeFora)
  })

  test('trocar de escola esvazia Criados: a lista e a turma da primeira escola não aparecem na segunda', async ({ page, hasTouch }) => {
    const marca = randomUUID().slice(0, 8)
    const tituloDeA = `Atividade da escola A ${marca}`
    const tituloDeB = `Atividade da escola B ${marca}`

    // A mesma pessoa, com vínculo confirmado nas duas escolas e um documento em cada uma.
    const emA = await criarEquipeComSenha()
    const alocacaoA = await criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(emA.escolaId, alocacaoA.vinculoIds)
    await criarArtefatoDoVinculo(emA.escolaId, alocacaoA.vinculoIds[0] ?? '', emA.usuarioId, tituloDeA)
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    const alocacaoB = await criarAlocacaoDoProfessor(emB.escolaId, emB.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(emB.escolaId, alocacaoB.vinculoIds)
    await criarArtefatoDoVinculo(emB.escolaId, alocacaoB.vinculoIds[0] ?? '', emB.usuarioId, tituloDeB)

    // A primeira carga não afirma nada sobre o tempo de baixar (`carregarSemRedeLenta`); a troca de escola e o que vem depois, sim.
    await carregarSemRedeLenta(page, async () => {
      await entrarPelaApi(page, emA, '/professor/criados', emA.usuarioId)
      await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
      await expect(documentos(page)).toContainText(tituloDeA)
    })

    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await irPelaNavegacao(page, 'Criados', hasTouch)
    await expect(documentos(page)).toHaveCount(1, { timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toContainText(tituloDeB)
    await expect(page.locator('body')).not.toContainText(tituloDeA)
    await expect(page.locator('body')).not.toContainText(alocacaoA.turmaNome)

    // A turma da escola A, no endereço, já na B: a mesma pessoa, mas a escola ativa é outra. Responde como o filtro sem resultado.
    await irPara(page, `/professor/criados?turma=${alocacaoA.turmaId}`)
    await expect(page.getByText('Nada com estes filtros')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(documentos(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(tituloDeA)
    await expect(page.locator('body')).not.toContainText(alocacaoA.turmaNome)
  })
})
