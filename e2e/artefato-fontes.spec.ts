import type { Page } from '@playwright/test'
import { atividadeSintetica, gate, MATERIAL, TITULO_DO_MATERIAL } from './support/assistente.ts'
import { entrarPelaApi, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { criarMaterialNoBanco, substituirMaterialNoBanco } from './support/material.ts'
import { criarArtefatoDoVinculo, entrarEmCriados } from './support/professor/criados.ts'
import { activate, irPara, SCREEN_TIMEOUT_MS } from './support/professor/scenario.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha } from './support/seed.ts'
import { expect, test } from './support/profiles.ts'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../tools/ci/compose.ts'

/**
 * O chip de fonte do artefato (ingestao-do-material, 10.0; RF11): título, edição e "edição anterior", lidos das `fontes` da
 * resposta do próprio artefato, e "material da escola" quando a linha do material já saiu. Os quatro primeiros casos usam a API
 * simulada (os estados e o recomeço da tela, com a resposta segurada); o último, a API de verdade, com a troca de edição
 * gravada no banco, porque a extração do PDF novo passa de 15 s (o caso dela é de integração, em `artefato.int.test.ts`).
 */

const fonte = (titulo: string, edicao: string | null, substituido: boolean) => ({ materialId: MATERIAL, titulo, edicao, substituido })
const chip = (page: Page, nome: string) => page.getByRole('button', { name: `Fonte: ${nome}, p. 142` })
const abrir = (page: Page, id: string) => irPara(page, `/professor/artefatos/${id}`)

test.describe('as fontes do artefato', () => {
  test('o chip diz título e edição e "edição anterior", e o artefato cabe na tela', async ({ page, hasTouch }) => {
    // Entra pela API: o caso não é sobre a entrada, e o login pela tela, com a CPU ×4, come a metade do prazo.
    const { api, turmaId, disciplinaId } = await entrarEmCriados(page)
    const edicaoAtual = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade com edição', fontes: [fonte(TITULO_DO_MATERIAL, '2025', false)] })
    const anterior = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade da edição anterior', fontes: [fonte(TITULO_DO_MATERIAL, '2024', true)] })
    api.artefatos = [edicaoAtual, anterior]

    await abrir(page, edicaoAtual.id)
    await expect(chip(page, `${TITULO_DO_MATERIAL} (2025)`)).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    await abrir(page, anterior.id)
    const doAnterior = chip(page, `${TITULO_DO_MATERIAL} (2024, edição anterior)`)
    await expect(doAnterior).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await activate(doAnterior, hasTouch)
    await expect(page.getByRole('group', { name: `Fonte: ${TITULO_DO_MATERIAL} (2024, edição anterior), p. 142` })).toContainText(`${TITULO_DO_MATERIAL} (2024, edição anterior)`)
    await page.keyboard.press('Escape')
    await paginaNaoRola(page)
  })

  test('a linha do material que saiu vira "material da escola", e sem fontes a página cai no padrão; o artefato aberto não pede a lista de materiais', async ({ page }) => {
    const { api, turmaId, disciplinaId } = await entrarEmCriados(page)
    const apagada = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade sem a linha', fontes: [fonte('material da escola', null, false)] })
    // Só a guarda da tela: a API nunca devolve `fontes` vazio para um artefato com citação (a linha que saiu vira "material da escola").
    const semFontes = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Atividade sem fontes', fontes: [] })
    api.artefatos = [apagada, semFontes]

    await abrir(page, apagada.id)
    await expect(chip(page, 'material da escola')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await abrir(page, semFontes.id)
    await expect(chip(page, 'Material da escola')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    // O título do material nunca veio da lista de materiais: o artefato aberto não a pede.
    expect(api.pedidosEm(/\/v1\/materiais/)).toEqual([])
  })

  test('o recomeço: outro artefato na mesma aba e o mesmo de novo mostram cada um a sua fonte', async ({ page }) => {
    const { api, turmaId, disciplinaId } = await entrarEmCriados(page)
    const primeiro = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Primeiro', fontes: [fonte('Química 2', '2024', true)] })
    const segundo = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Segundo', fontes: [fonte('Biologia 3', '2025', false)] })
    api.artefatos = [primeiro, segundo]
    const doPrimeiro = chip(page, 'Química 2 (2024, edição anterior)')
    const doSegundo = chip(page, 'Biologia 3 (2025)')

    await abrir(page, primeiro.id)
    await expect(doPrimeiro).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    // Outro artefato na mesma aba, sem recarregar: o chip é o dele, e o do anterior saiu.
    await abrir(page, segundo.id)
    await expect(doSegundo).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(doPrimeiro).toHaveCount(0)
    // O mesmo de novo: o chip é o do primeiro, e o do segundo saiu.
    await abrir(page, primeiro.id)
    await expect(doPrimeiro).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(doSegundo).toHaveCount(0)
  })

  test('a resposta atrasada de um terceiro artefato não traz a fonte dele para o que está aberto', async ({ page }) => {
    const { api, turmaId, disciplinaId } = await entrarEmCriados(page)
    const segundo = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Segundo', fontes: [fonte('Biologia 3', '2025', false)] })
    const terceiro = atividadeSintetica(turmaId, disciplinaId, { titulo: 'Terceiro', fontes: [fonte('Física 1', '2023', true)] })
    api.artefatos = [segundo, terceiro]
    const segura = gate()
    // A resposta do terceiro sai da API simulada só depois do portão; a tela, que já saiu dele, pode até ter cancelado o pedido.
    let terceiroRespondido = false
    api.trocar('artefato', async ({ ids }) => {
      const achado = api.artefatos.find((item) => item.id === ids[0])
      if (achado === terceiro) {
        await segura.aberta
        terceiroRespondido = true
      }
      return achado === undefined ? { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } } : { status: 200, corpo: achado }
    })
    const doSegundo = chip(page, 'Biologia 3 (2025)')
    const doTerceiro = chip(page, 'Física 1 (2023, edição anterior)')

    // O terceiro fica no ar, a professora volta ao segundo, e só então a resposta do terceiro chega.
    await abrir(page, terceiro.id)
    await expect(page.getByText('Carregando o artefato…')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await abrir(page, segundo.id)
    await expect(doSegundo).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    segura.abrir()
    await expect.poll(() => terceiroRespondido).toBe(true)
    await expect(doSegundo).toBeVisible()
    await expect(doTerceiro).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Segundo' })).toBeVisible()
  })

  test('a troca de edição, de ponta a ponta com a API de verdade: o artefato gerado antes mostra "edição anterior"', async ({ page }) => {
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
    const banco = new Client({ connectionString: urlDoBancoDeTeste() })
    await banco.connect()
    const disciplinaId = await banco
      .query<{ disciplina_id: string }>('select disciplina_id from vinculo where id = $1 and escola_id = $2', [alocacao.vinculoIds[0], professora.escolaId])
      .then(({ rows }) => rows[0]?.disciplina_id ?? '')
      .finally(() => banco.end())
    const titulo = 'Química 2 — apostila da escola'
    const antiga = await criarMaterialNoBanco(professora.escolaId, disciplinaId, { titulo, estado: 'pronto', paginas: 3 })
    const { artefatoId } = await criarArtefatoDoVinculo(professora.escolaId, alocacao.vinculoIds[0] ?? '', professora.usuarioId, 'Atividade da edição antiga', antiga)
    // A coordenação sobe a edição nova, e a extração a deixa `pronto` e tira a antiga: a professora só abre o artefato depois.
    await substituirMaterialNoBanco(professora.escolaId, antiga, '2024', '2025')

    await entrarPelaApi(page, professora, `/professor/artefatos/${artefatoId}`)
    const doChip = page.getByRole('button', { name: `Fonte: ${titulo} (2024, edição anterior), p. 2` })
    await expect(doChip).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })
})
