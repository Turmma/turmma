import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request, Route } from '@playwright/test'
import type { DesempenhoDaTurmaResponse } from '../packages/shared/src/atividade/desempenho.ts'
import { desempenhoSintetico, mockAssistenteApi, type AssistenteApiMock } from './support/assistente.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { queryCache } from './support/query-cache.ts'
import { principal } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { irPara, soOPainelDaAbaRola, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import {
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarEquipeComSenha,
  criarProfessoraNaEscola,
  matricularAlunosNaTurmaNoBanco,
  type AlocacaoDeTeste,
  type AlunoNaTurmaDeTeste,
  type EquipeDeTeste,
} from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A aba Alunos da turma aberta (telas do professor, 12.0; RF18, RF21), pela tela, nos projetos `chromebook` e `celular`: a lista
 * de nomes em ordem de nome, com os acertos das correções aprovadas, quem saiu da turma, o que fica na memória da aba, o
 * isolamento e os 360 px. A sessão, a turma e os alunos são os de verdade (a lista vem de `GET /v1/turmas/:id/alunos`); o
 * desempenho aprovado é o da API simulada do Assistente. Os pedidos de nome da aba estão em `pedidos.spec.ts`, e o recomeço da
 * segunda pessoa na mesma aba, no caso de recomeço de `professor-sino.spec.ts`. Cada caso entra pela API e paga uma carga de
 * página só: o portão reprova caso alterado acima de 15 s. Nomes e e-mails inventados pelo teste.
 */

const TURMA_INDISPONIVEL = 'Esta turma não está disponível para você agora'
/** A mesma palavra das telas do professor: nada de média, ranking nem posição (D46, D69). */
const PALAVRAS_DE_RANKING = /ranking|pódio|posição|º lugar|m[ée]dia/i

/** A professora entra pela API (o cookie fica na aba) e abre o endereço: uma carga só, sem passar pela tela de entrada. */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

interface Cenario {
  readonly api: AssistenteApiMock
  readonly professora: EquipeDeTeste
  readonly turma: AlocacaoDeTeste
  readonly alunos: readonly AlunoNaTurmaDeTeste[]
  readonly marca: string
}

/** A professora com a turma confirmada e alunos nela, em ordem de id (a da API), que não é a de nome. */
async function prepararCenario(page: Page, nomes?: readonly string[]): Promise<Cenario> {
  const marca = randomUUID().slice(0, 8)
  const api = await mockAssistenteApi(page)
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
  const alunos = await matricularAlunosNaTurmaNoBanco(
    professora.escolaId,
    turma.turmaId,
    nomes ?? [`Zélia Sintética ${marca}`, `Álvaro Sintético ${marca}`, `Bruna Sintética ${marca}`, `Ana Sintética ${marca}`, `João Sintético ${marca}`, `João Sintético ${marca}`],
  )
  return { api, professora, turma, alunos, marca }
}

const enderecoDaAba = (turma: AlocacaoDeTeste): string => `/professor/turmas/${turma.turmaId}?aba=alunos`
const regiaoDosAlunos = (page: Page): Locator => principal(page).getByRole('region', { name: 'Por aluno' })

/**
 * Os nomes da lista, na ordem da tela: no computador, o cabeçalho de cada linha da tabela; no celular, o título de cada item da lista
 * (o texto "Aluno: " é só para o leitor de tela).
 */
async function nomesNaTela(page: Page): Promise<string[]> {
  const nomes = await regiaoDosAlunos(page).locator('tbody th[scope="row"], [data-tabela="lista"] > li > div:first-child').allInnerTexts()
  return nomes.map((nome) => nome.replace(/^Aluno:\s*/, '').trim())
}

/** A linha (computador) ou o item (celular) de um aluno, pelo nome. */
const linhaDe = (page: Page, nome: string): Locator => regiaoDosAlunos(page).locator('tbody tr, [data-tabela="lista"] > li').filter({ hasText: nome }).first()

/** O que a aba mostra do desempenho aprovado: o de cada aluno que o teste diz, e quem não consta. */
function desempenhoDe(turmaId: string, alunos: ReadonlyArray<{ alunoId: string; nome: string; acertos: number; total: number }>): DesempenhoDaTurmaResponse {
  const base = desempenhoSintetico(turmaId)
  const habilidade = base.porHabilidade[0]?.habilidade
  if (habilidade === undefined) throw new Error('o desempenho sintético não tem habilidade')
  return {
    ...base,
    alunos: alunos.map((aluno) => ({ ...aluno, porHabilidade: aluno.total === 0 ? [] : [{ habilidade, acertos: aluno.acertos, total: aluno.total }] })),
  }
}

/** Os pedidos da aba à lista de nomes de uma turma, vistos por quem os faz. */
function vigiarALista(page: Page): { readonly turmas: string[] } {
  const turmas: string[] = []
  page.on('request', (pedido: Request) => {
    const achado = /^\/v1\/turmas\/([^/]+)\/alunos$/.exec(new URL(pedido.url()).pathname)
    if (achado?.[1] !== undefined) turmas.push(achado[1])
  })
  return { turmas }
}

test.describe('Alunos na turma aberta: a lista de nomes e os acertos', () => {
  test('os alunos em ordem de nome, e não na de id da API; os acertos aprovados de cada um; sem correção aprovada e quem saiu da turma, sem número; nada de nota, de ranking nem de ordem por acerto', async ({ page }) => {
    const { api, professora, turma, alunos, marca } = await prepararCenario(page)
    const [zelia, alvaro, bruna, ana, joao, outroJoao] = alunos
    if (zelia === undefined || alvaro === undefined || bruna === undefined || ana === undefined || joao === undefined || outroJoao === undefined) throw new Error('faltou aluno')
    // Ana acertou tudo, Álvaro metade, o primeiro João nada; Bruna está no desempenho sem lote aprovado; Zélia e o outro João nem constam
    // nele. Dora está no desempenho e não na lista: foi transferida (ou teve o acesso desativado) entre uma leitura e a outra.
    api.desempenho = desempenhoDe(turma.turmaId, [
      { alunoId: ana.usuarioId, nome: ana.nome, acertos: 2, total: 2 },
      { alunoId: alvaro.usuarioId, nome: alvaro.nome, acertos: 1, total: 2 },
      { alunoId: joao.usuarioId, nome: joao.nome, acertos: 0, total: 2 },
      { alunoId: bruna.usuarioId, nome: bruna.nome, acertos: 0, total: 0 },
      { alunoId: randomUUID(), nome: `Dora Sintética ${marca}`, acertos: 2, total: 2 },
    ])
    await abrirJaEntrando(page, professora, enderecoDaAba(turma))

    await expect(linhaDe(page, ana.nome)).toContainText('2 de 2', { timeout: SIGN_IN_TIMEOUT_MS })
    // Em ordem de nome (a lista chegou em ordem de id): "Álvaro" com o A, os dois "João" em duas linhas, Dora entre Bruna e João.
    expect(await nomesNaTela(page)).toEqual([
      `Álvaro Sintético ${marca}`,
      `Ana Sintética ${marca}`,
      `Bruna Sintética ${marca}`,
      `Dora Sintética ${marca}`,
      `João Sintético ${marca}`,
      `João Sintético ${marca}`,
      `Zélia Sintética ${marca}`,
    ])
    await expect(linhaDe(page, alvaro.nome)).toContainText('1 de 2')
    await expect(linhaDe(page, alvaro.nome)).toContainText('QUI.EM.04: 1 de 2')
    await expect(linhaDe(page, bruna.nome)).toContainText('Sem correção aprovada')
    await expect(linhaDe(page, zelia.nome)).toContainText('Sem correção aprovada')
    await expect(linhaDe(page, `Dora Sintética ${marca}`)).toContainText('Saiu da turma')
    await expect(linhaDe(page, `Dora Sintética ${marca}`)).not.toContainText(/\d de \d/)
    await expect(regiaoDosAlunos(page)).not.toContainText('0 de 0')
    await expect(regiaoDosAlunos(page)).toContainText('7 alunos, em ordem de nome')

    // Não é ranking: nenhum controle na região, nenhuma palavra de nota, de média ou de posição na aba.
    await expect(regiaoDosAlunos(page).getByRole('button')).toHaveCount(0)
    await expect(principal(page)).not.toContainText(VOCABULARIO_DE_NOTA)
    await expect(principal(page)).not.toContainText(PALAVRAS_DE_RANKING)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a lista não fica na memória da aba: sai o nome ao deixar a aba, volta a ser lida ao voltar; nenhum nome em localStorage, sessionStorage, endereço nem log da web', async ({ page }) => {
    const { professora, turma, alunos, marca } = await prepararCenario(page, undefined)
    const nomeDeUm = alunos[0]?.nome
    if (nomeDeUm === undefined) throw new Error('faltou aluno')
    const lista = vigiarALista(page)
    const logs: string[] = []
    page.on('console', (mensagem) => logs.push(mensagem.text()))
    page.on('pageerror', (erro) => logs.push(erro.message))
    await abrirJaEntrando(page, professora, enderecoDaAba(turma))
    await expect(linhaDe(page, nomeDeUm)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // O controle: com a aba aberta, o cache guarda os nomes. Sem isto, a ausência depois não provaria nada.
    expect(JSON.stringify(await queryCache(page))).toContain(nomeDeUm)
    expect(lista.turmas).toEqual([turma.turmaId])

    const guardado = await page.evaluate(() => JSON.stringify({ local: { ...window.localStorage }, sessao: { ...window.sessionStorage }, endereco: window.location.href }))
    expect(guardado).not.toContain(marca)
    expect(guardado).not.toContain(encodeURIComponent(marca))

    // Sai da aba (Hoje), sem recarregar: a lista sai do cache. Volta, e ela é lida de novo.
    await irPara(page, `/professor/turmas/${turma.turmaId}?aba=hoje`)
    await expect(principal(page).getByRole('tab', { name: 'Hoje', selected: true })).toBeVisible()
    await expect.poll(async () => JSON.stringify(await queryCache(page)), { timeout: 5_000 }).not.toContain(nomeDeUm)
    await irPara(page, enderecoDaAba(turma))
    await expect(linhaDe(page, nomeDeUm)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(lista.turmas).toEqual([turma.turmaId, turma.turmaId])

    // Nenhum nome em log da web: a auditoria da leitura é a da API.
    expect(logs.join('\n')).not.toContain(marca)
    expect(logs.join('\n')).not.toMatch(/Sintétic/)
  })

  test('resposta atrasada: a lista da primeira turma, ainda a caminho quando a professora abre a segunda, não troca os alunos dela: a leitura sai do ar e nada dela fica no cache', async ({ page }) => {
    const marca = randomUUID().slice(0, 8)
    await mockAssistenteApi(page)
    const professora = await criarEquipeComSenha()
    const primeira = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'], `8ºA sintética ${marca}`)
    const segunda = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Física'], `8ºB sintética ${marca}`)
    await confirmarVinculosNoBanco(professora.escolaId, [...primeira.vinculoIds, ...segunda.vinculoIds])
    await matricularAlunosNaTurmaNoBanco(professora.escolaId, primeira.turmaId, [`Aluno da primeira ${marca}`])
    await matricularAlunosNaTurmaNoBanco(professora.escolaId, segunda.turmaId, [`Aluno da segunda ${marca}`])
    // A lista da primeira turma fica presa até a professora estar na segunda.
    let abrir: () => void = () => undefined
    const aberta = new Promise<void>((resolver) => {
      abrir = resolver
    })
    await page.route(`**/v1/turmas/${primeira.turmaId}/alunos*`, async (rota: Route) => {
      await aberta
      await rota.fallback().catch(() => undefined)
    })

    await abrirJaEntrando(page, professora, enderecoDaAba(primeira))
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os alunos da turma…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await irPara(page, enderecoDaAba(segunda))
    await expect(linhaDe(page, `Aluno da segunda ${marca}`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    abrir()
    // Ao trocar de turma a web cancela a leitura da primeira (o `signal` da consulta), e o navegador a aborta antes de a resposta chegar: o
    // que o caso prova é que, com a leitura solta, a segunda não mostra nome da primeira, e a primeira, que já saiu da tela, não deixa nome no cache.
    await expect.poll(async () => JSON.stringify(await queryCache(page)), { timeout: 5_000 }).not.toContain(`Aluno da primeira ${marca}`)
    await expect(principal(page)).not.toContainText(`Aluno da primeira ${marca}`)
    expect(await nomesNaTela(page)).toEqual([`Aluno da segunda ${marca}`])
  })

  test('1366 × 768: a página fica parada com um aluno na lista, e quem rola é o painel da aba', async ({ page }) => {
    const { professora, turma, alunos } = await prepararCenario(page, [`Ana Sintética ${randomUUID().slice(0, 8)}`])
    await abrirJaEntrando(page, professora, enderecoDaAba(turma))
    await expect(linhaDe(page, alunos[0]?.nome ?? '')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await soOPainelDaAbaRola(page)
  })

  test('360 px: a lista vira linhas sem rolar de lado, cada uma com ao menos 56 px, e o nome comprido quebra', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    const comprido = `Maria Aparecida de Nazaré Sintética Albuquerque de Souza e Silva ${randomUUID().slice(0, 8)}`
    const { professora, turma } = await prepararCenario(page, [comprido, `Bia Sintética ${randomUUID().slice(0, 8)}`])
    await abrirJaEntrando(page, professora, enderecoDaAba(turma))

    const itens = regiaoDosAlunos(page).locator('[data-tabela="lista"] > li')
    await expect(itens).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    for (const caixa of await itens.evaluateAll((lista) => lista.map((item) => item.getBoundingClientRect().toJSON() as { width: number; height: number; right: number }))) {
      expect(caixa.height).toBeGreaterThanOrEqual(56)
      expect(caixa.right).toBeLessThanOrEqual(360)
    }
    // O nome comprido quebra em mais de uma linha, dentro do cartão, e não corta nem estica.
    const nome = itens.filter({ hasText: comprido }).locator('> div:first-child')
    const altura = await nome.evaluate((elemento) => elemento.getBoundingClientRect().height)
    const umaLinha = await itens.filter({ hasText: 'Bia Sintética' }).locator('> div:first-child').evaluate((elemento) => elemento.getBoundingClientRect().height)
    expect(altura).toBeGreaterThan(umaLinha)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('Alunos: a turma de outra pessoa não lê a lista (regra 10, itens 4 e 6)', () => {
  /** Uma turma de outra escola, uma de outro professor da mesma escola e uma com o vínculo ainda pendente: nenhuma deixa ler os nomes. */
  for (const [caso, preparar] of [
    [
      'de outra escola',
      async (_professora: EquipeDeTeste): Promise<AlocacaoDeTeste & { escolaId: string }> => {
        const outra = await criarEquipeComSenha()
        const dela = await criarAlocacaoDoProfessor(outra.escolaId, outra.usuarioId, ['Geografia'])
        await confirmarVinculosNoBanco(outra.escolaId, dela.vinculoIds)
        return { ...dela, escolaId: outra.escolaId }
      },
    ],
    [
      'de outro professor da mesma escola',
      async (professora: EquipeDeTeste): Promise<AlocacaoDeTeste & { escolaId: string }> => {
        const colega = await criarProfessoraNaEscola(professora)
        const dele = await criarAlocacaoDoProfessor(colega.escolaId, colega.usuarioId, ['Geografia'])
        await confirmarVinculosNoBanco(colega.escolaId, dele.vinculoIds)
        return { ...dele, escolaId: colega.escolaId }
      },
    ],
    [
      'com o vínculo pendente',
      async (professora: EquipeDeTeste): Promise<AlocacaoDeTeste & { escolaId: string }> => {
        const pendente = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Geografia'])
        return { ...pendente, escolaId: professora.escolaId }
      },
    ],
  ] as const) {
    test(`a turma ${caso} responde "Turma indisponível", não lê a lista e não mostra nem o nome dos alunos dela`, async ({ page }) => {
      const { professora } = await prepararCenario(page)
      const alheia = await preparar(professora)
      const dela = await matricularAlunosNaTurmaNoBanco(alheia.escolaId, alheia.turmaId, [`Aluno alheio ${randomUUID().slice(0, 8)}`])
      const lista = vigiarALista(page)
      await abrirJaEntrando(page, professora, enderecoDaAba(alheia))

      await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toContainText(TURMA_INDISPONIVEL, { timeout: SIGN_IN_TIMEOUT_MS })
      await expect(page.getByRole('tab')).toHaveCount(0)
      await expect(regiaoDosAlunos(page)).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText(alheia.turmaNome)
      for (const aluno of dela) await expect(page.locator('body')).not.toContainText(aluno.nome)
      expect(lista.turmas).not.toContain(alheia.turmaId)
      // A chave de uma consulta que falhou leva o id que a professora digitou no endereço (a da estrutura da turma, da 9.x): o que não
      // pode existir é dado da turma alheia, nem consulta da lista de nomes dela.
      const cache = await queryCache(page)
      expect(cache.filter((consulta) => Array.isArray(consulta.chave) && consulta.chave[0] === 'alunos-da-turma')).toEqual([])
      // O vínculo pendente é da própria professora e consta de `meus-vinculos`, com o id da turma: o dado da turma é o que não pode existir.
      const dados = JSON.stringify(cache.filter((consulta) => !(Array.isArray(consulta.chave) && consulta.chave[0] === 'meus-vinculos')).map((consulta) => consulta.dado))
      expect(dados).not.toContain(alheia.turmaId)
      for (const aluno of dela) expect(dados).not.toContain(aluno.nome)
    })
  }
})
