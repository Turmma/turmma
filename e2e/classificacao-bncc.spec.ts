import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../tools/ci/compose.ts'
import { PAGINAS_DE_ESTEQUIOMETRIA } from '../packages/core/src/ia/__fixtures__/estequiometria.ts'
import { entrarPelaApiSemMedirAPrimeiraCarga, entrarPorEmail, esperarNovaConversa, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'
import { entrarComoAlunoPelaApi, responderPelaApi } from './support/aluno-api.ts'
import { ProfessoraApiClient } from './support/atividade-db.ts'
import { criarCapitulosNoBanco, criarMaterialNoBanco, criarSecoesNoBanco, definirComponenteNoBanco, habilidadesDoRecorteNoBanco, secoesNoBanco, vincularMaterialAUmaSerieNoBanco } from './support/material.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { expect, loadUnthrottled, test } from './support/profiles.ts'
import { queryCache, semAcessosDaConta } from './support/query-cache.ts'
import { activate, irPara, SCREEN_TIMEOUT_MS, soOPainelDaAbaRola, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import { aplicacaoDoArtefato, tokenDaEquipe } from './support/roteiro.ts'
import {
  colocarAlunoNaTurma,
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarAlunoComMatricula,
  criarCoordenadoraNaEscola,
  criarEquipeComSenha,
  type AlunoDeTeste,
  type EquipeDeTeste,
} from './support/seed.ts'

/**
 * O fluxo da classificação pela BNCC, do material à turma (classificacao-bncc, 12.0; RF6, RF7, RF9, RF19; `cenarios.md`, "Telas", [E]), com a API de verdade e o adaptador falso, nos projetos `chromebook` e `celular`:
 * a coordenação corrige o capítulo, a professora gera e vê a habilidade corrigida, troca uma e deixa outra questão sem habilidade, aplica, a turma responde, e Turmas e a aluna mostram a trocada e o "Sem habilidade", com a explicação.
 *
 * **Em casos em série, não num só**: o caso de e2e tem de caber na metade do prazo (15 s, `tools/ci/duracao-do-e2e.ts`), e o fluxo inteiro, com a CPU ×4 e a rede do perfil, não cabe. Cada caso é um passo do fluxo e deixa o que o seguinte lê no banco; o
 * material, a escola e as pessoas nascem no banco (`beforeAll`), como o envio e a leitura do PDF já provam em `material.spec.ts` e no roteiro da demonstração. A turma tem três alunos que respondem pela API.
 */

const TITULO_DO_MATERIAL = 'Química 7, capítulo 2: Reações e cálculos'
const TITULO_DO_CAPITULO = 'Reações e cálculos'
const TEMA = 'Massa molar'
const QUESTOES = 3
const EXPLICACAO = 'Esta questão não tem habilidade da BNCC associada.'
const PROIBIDO_NA_AREA_DO_ALUNO = /\bnotas?\b|\bconceito\b|ranking|média da turma|colegas?\b/i

interface Cena {
  readonly professora: EquipeDeTeste
  readonly coordenadora: EquipeDeTeste
  readonly turmaId: string
  readonly turmaNome: string
  readonly disciplinaId: string
  readonly materialId: string
  readonly alunos: readonly AlunoDeTeste[]
  /** As três habilidades da BNCC do recorte (Ciências, 7º ano) que o fluxo usa: a que a IA sugeriu, a que a coordenação põe no lugar e a que a professora escolhe na troca. */
  readonly sugerida: string
  readonly corrigida: string
  readonly trocada: string
  /** A descrição de cada uma, que é o que a aluna lê (o rótulo da barra dela é a descrição, sem o código). */
  readonly descricaoDa: Readonly<Record<string, string>>
  /** Os ids que os passos deixam um para o outro. */
  artefatoId: string
  aplicadaId: string
}

let cena: Cena

const principal = (page: Page) => page.getByRole('main')

/** O começo da descrição da habilidade na tabela da BNCC: o artefato guarda a descrição longa cortada (com "…") no limite do contrato, e o começo é o que sobra igual. */
function descricaoDe(codigo: string): string {
  const descricao = cena.descricaoDa[codigo]
  if (descricao === undefined || descricao.length < 20) throw new Error(`a habilidade ${codigo} não tem descrição na tabela da BNCC do banco de teste`)
  return descricao.slice(0, 60)
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

/** A tela aberta, com o título, sem "Carregando…": a medida de um e2e de tela só vale com a leitura terminada. */
const telaLida = (page: Page) => expect(principal(page).getByText(/^Carregando/)).toHaveCount(0, { timeout: SCREEN_TIMEOUT_MS })

/** A medida de toda tela do fluxo: sem rolar de lado, sem violação séria de acessibilidade, e sem o vocabulário de nota (D46). */
async function conferirATela(page: Page): Promise<void> {
  expect(await horizontalOverflow(page)).toBe(0)
  expect(await seriousViolations(page)).toEqual([])
  await expect(principal(page)).not.toContainText(VOCABULARIO_DE_NOTA)
}

test.describe.configure({ mode: 'serial' })

test.describe('o fluxo da classificação pela BNCC, do material à turma', () => {
  test.beforeAll(async () => {
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
    const coordenadora = await criarCoordenadoraNaEscola(professora)
    const disciplinaId = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ disciplina_id: string }>('select disciplina_id from vinculo where id = $1 and escola_id = $2', [alocacao.vinculoIds[0], professora.escolaId])
      return rows[0]?.disciplina_id ?? ''
    })
    await definirComponenteNoBanco(professora.escolaId, disciplinaId, 'ciencias')
    const habilidades = await habilidadesDoRecorteNoBanco('ciencias', 7)
    const [sugerida, corrigida, trocada] = habilidades.map((habilidade) => habilidade.codigo)
    const descricaoDa = Object.fromEntries(habilidades.map((habilidade) => [habilidade.codigo, habilidade.descricao]))
    if (sugerida === undefined || corrigida === undefined || trocada === undefined) throw new Error('a tabela da BNCC do banco de teste não tem três habilidades de Ciências do 7º ano')

    // O material pronto, de seis páginas com frases definitórias (é delas que o adaptador falso tira as questões), num capítulo só, que a IA classificou com a primeira habilidade.
    const materialId = await criarMaterialNoBanco(professora.escolaId, disciplinaId, { titulo: TITULO_DO_MATERIAL, estado: 'pronto', paginas: PAGINAS_DE_ESTEQUIOMETRIA.length, textos: PAGINAS_DE_ESTEQUIOMETRIA })
    await vincularMaterialAUmaSerieNoBanco(professora.escolaId, materialId, 7)
    await criarCapitulosNoBanco(professora.escolaId, materialId, [{ numero: 2, titulo: TITULO_DO_CAPITULO, paginaInicial: 1, paginaFinal: PAGINAS_DE_ESTEQUIOMETRIA.length }])
    await criarSecoesNoBanco(professora.escolaId, materialId, [
      { paginaInicial: 1, paginaFinal: PAGINAS_DE_ESTEQUIOMETRIA.length, capituloOrdem: 1, situacao: 'classificada', habilidades: [{ codigo: sugerida, origem: 'ia' }] },
    ])

    const turma = { turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, serieNome: '7º ano do Ensino Fundamental' }
    const alunos: AlunoDeTeste[] = []
    for (const [indice, nome] of ['Ana', 'Bruno', 'Carla'].entries()) {
      const aluno = await criarAlunoComMatricula({ escola: professora, matricula: `${String(Date.now()).slice(-6)}${String(indice)}`, nome: `${nome} Sintética` })
      await colocarAlunoNaTurma(aluno, turma)
      alunos.push(aluno)
    }
    cena = { professora, coordenadora, turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, disciplinaId, materialId, alunos, sugerida, corrigida, trocada, descricaoDa, artefatoId: '', aplicadaId: '' }
  })

  test('a coordenação corrige o capítulo, e a correção vale no lugar da sugestão da IA', async ({ page, request, hasTouch }) => {
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, cena.coordenadora, '/coordenacao/material', async () => {
      await expect(page).toHaveURL(/\/coordenacao\/material$/, { timeout: SIGN_IN_TIMEOUT_MS })
      await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
    })
    const lista = principal(page).getByRole('region', { name: 'Materiais da escola' })
    await activate(linhasDaTabela(lista).filter({ hasText: TITULO_DO_MATERIAL }).getByRole('button', { name: TITULO_DO_MATERIAL }), hasTouch)
    const painel = page.getByRole('dialog', { name: TITULO_DO_MATERIAL })
    const capitulo = painel.getByRole('region', { name: 'Habilidades da BNCC' }).locator('ol > li').filter({ hasText: `Capítulo 2 · ${TITULO_DO_CAPITULO}` })
    await expect(capitulo).toContainText('Sugerida pela IA', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(capitulo).toContainText(cena.sugerida)

    await activate(capitulo.getByRole('button', { name: /^Corrigir/ }), hasTouch)
    const caixas = capitulo.getByRole('group', { name: /^Habilidades de / })
    await caixas.getByRole('checkbox', { name: new RegExp(cena.sugerida) }).uncheck({ timeout: SIGN_IN_TIMEOUT_MS })
    await caixas.getByRole('checkbox', { name: new RegExp(cena.corrigida) }).check()
    await activate(capitulo.getByRole('button', { name: 'Salvar correção' }), hasTouch)
    // O painel diz em texto de quem é a habilidade, e a da IA saiu.
    await expect(capitulo).toContainText('Corrigida pela coordenação', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(capitulo).toContainText(cena.corrigida)
    await expect(capitulo).not.toContainText(cena.sugerida)
    expect((await secoesNoBanco(cena.coordenadora.escolaId, cena.materialId)).flatMap((linha) => linha.habilidades)).toEqual([{ codigo: cena.corrigida, origem: 'coordenacao' }])
    await conferirATela(page)
  })

  test('a professora gera a atividade, e cada questão traz a habilidade que a coordenação corrigiu, com o capítulo', async ({ page, request }) => {
    const token = await tokenDaEquipe(request, cena.professora.email, cena.professora.senha)
    cena.artefatoId = await gerarAtividadePelaApi(request, token, { turmaId: cena.turmaId, disciplinaId: cena.disciplinaId, tema: TEMA, quantidade: QUESTOES })
    await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, `/professor/artefatos/${cena.artefatoId}`, () =>
      expect(principal(page).getByRole('heading', { level: 1 })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS }),
    )
    const folha = page.locator('[data-folha]')
    await expect(folha.getByText(`Habilidade ${cena.corrigida}:`, { exact: false })).toHaveCount(QUESTOES, { timeout: SCREEN_TIMEOUT_MS })
    // A sugestão da IA não vale mais, e a questão diz de que capítulo veio a habilidade dela.
    await expect(folha).not.toContainText(cena.sugerida)
    await expect(folha.getByText(`Capítulo 2 · ${TITULO_DO_CAPITULO} (Páginas 1 a ${String(PAGINAS_DE_ESTEQUIOMETRIA.length)})`)).toHaveCount(QUESTOES)
    await conferirATela(page)
  })

  test('a professora troca a habilidade de uma questão, deixa outra sem habilidade e aplica à turma: a troca fica no artefato e a aplicação trava a troca', async ({ page, hasTouch }) => {
    await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, `/professor/artefatos/${cena.artefatoId}`, () =>
      expect(page.locator('[data-folha]').getByText(`Habilidade ${cena.corrigida}:`, { exact: false })).toHaveCount(QUESTOES, { timeout: SIGN_IN_TIMEOUT_MS }),
    )
    const folha = page.locator('[data-folha]')
    const seletorDa = (questao: number) => page.getByRole('group', { name: `Habilidades para a questão ${String(questao)}` })
    // A questão 1 passa à habilidade que a professora escolhe: a troca vale na hora e devolve o foco ao botão.
    const trocar = page.getByRole('button', { name: 'Trocar a habilidade da questão 1' })
    await activate(trocar, hasTouch)
    await seletorDa(1).getByRole('checkbox', { name: new RegExp(cena.trocada) }).click()
    await expect(folha.getByText(`Habilidade ${cena.trocada}:`, { exact: false })).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
    await expect(trocar).toBeFocused()
    // A questão 3 fica sem habilidade, e a questão 2 segue com a que a coordenação corrigiu.
    await activate(page.getByRole('button', { name: 'Trocar a habilidade da questão 3' }), hasTouch)
    await activate(page.getByRole('button', { name: 'Deixar sem habilidade' }), hasTouch)
    await expect(folha.getByText('Sem habilidade', { exact: true })).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
    await expect(folha.getByText(`Habilidade ${cena.corrigida}:`, { exact: false })).toHaveCount(1)

    expect(await habilidadesDasQuestoesNoBanco(cena.professora.escolaId, cena.artefatoId)).toEqual([cena.trocada, cena.corrigida, null])

    await page.getByRole('tab', { name: 'Na turma' }).click()
    const naTurma = page.locator('[data-aplicacao-do-artefato]')
    await activate(naTurma.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    const aplicar = page.getByRole('alertdialog', { name: 'Aplicar à turma' })
    await aplicar.getByRole('radio', { name: /^É avaliativa/ }).check()
    await activate(aplicar.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    await expect(naTurma.locator('[data-atividade-aplicada="aberta"]')).toContainText('Aberta para a turma · avaliativa', { timeout: SCREEN_TIMEOUT_MS })
    cena.aplicadaId = await aplicacaoDoArtefato(cena.professora.escolaId, cena.artefatoId)
    // Aplicada, a habilidade não muda mais: o diagnóstico da turma é o das habilidades de agora.
    await page.getByRole('tab', { name: 'Conteúdo' }).click()
    await expect(page.getByRole('button', { name: 'Trocar a habilidade da questão 1' })).toBeDisabled()
    expect(await habilidadesDasQuestoesNoBanco(cena.professora.escolaId, cena.artefatoId)).toEqual([cena.trocada, cena.corrigida, null])
    await conferirATela(page)
  })

  test('Turmas mostra a habilidade trocada e o "Sem habilidade" com a explicação, e a nota abaixo da tabela de alunos diz o mesmo uma vez só', async ({ page, request, hasTouch }) => {
    // A turma responde pela API (a tela do aluno é do caso seguinte), e a professora encerra e aprova o lote: só correção aprovada entra em Turmas (D46).
    for (const [indice, aluno] of cena.alunos.entries()) {
      await responderPelaApi(request, await entrarComoAlunoPelaApi(request, aluno), cena.aplicadaId, [indice % 2, 1, 2])
    }
    await (await ProfessoraApiClient.entrar(request, cena.professora)).encerrarEAprovar(cena.aplicadaId)

    await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, `/professor/turmas/${cena.turmaId}?aba=hoje`, () =>
      expect(principal(page).getByRole('region', { name: 'Acerto por habilidade' })).toContainText(/\d+ de \d+/, { timeout: SIGN_IN_TIMEOUT_MS }),
    )
    const habilidades = principal(page).getByRole('region', { name: 'Acerto por habilidade' })
    await expect(habilidades).toContainText(cena.trocada)
    await expect(habilidades).toContainText(cena.corrigida)
    await expect(habilidades).toContainText('Sem habilidade')
    await expect(habilidades.getByText(EXPLICACAO, { exact: false })).toHaveCount(1)
    // A habilidade da IA, que a coordenação tirou, nunca chegou à turma.
    await expect(habilidades).not.toContainText(cena.sugerida)
    await conferirATela(page)
    await soOPainelDaAbaRola(page)

    await activate(page.getByRole('tab', { name: 'Alunos' }), hasTouch)
    const alunos = principal(page).getByRole('region', { name: 'Por aluno' })
    for (const aluno of cena.alunos) await expect(alunos).toContainText(aluno.nome, { timeout: SCREEN_TIMEOUT_MS })
    // A célula da coluna "Por habilidade" (no celular a tabela vira lista, e por isso não se procura pelo papel de tabela).
    await expect(alunos.getByText(/· Sem habilidade: \d+ de \d+/).first()).toBeVisible()
    // A explicação vem uma vez, abaixo da tabela, e não em cada linha.
    await expect(alunos.getByText(`Sem habilidade: ${EXPLICACAO}`, { exact: true })).toHaveCount(1)
    await telaLida(page)
    await conferirATela(page)
    await paginaNaoRola(page)
  })

  test('a aluna vê o resultado com a habilidade trocada e o "Sem habilidade" com a explicação, sem nota nem colega', async ({ page }) => {
    const aluna = cena.alunos[0]
    if (aluna === undefined) throw new Error('a turma do fluxo não tem aluna')
    // A entrada pela API: a sessão vai no cookie, e a tela da tarefa abre direto no endereço dela.
    const entrada = await page.context().request.post('/v1/sessao/matricula', { data: { slug: aluna.slug, matricula: aluna.matricula, senha: aluna.senha } })
    expect(entrada.ok(), 'a aluna entra pela API').toBe(true)
    const resultado = principal(page).getByRole('region', { name: 'Seu resultado' })
    // A primeira carga sem a rede do perfil (`loadUnthrottled`): o assunto do caso é o que a tela mostra, e não quanto ela leva para baixar.
    await loadUnthrottled(page, async () => {
      await page.goto(`/aluno/atividades/${cena.aplicadaId}`)
      await expect(resultado).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    })
    const porHabilidade = resultado.getByRole('region', { name: 'Acertos por habilidade' })
    // A habilidade trocada e a corrigida chegam com a descrição, e a que a IA sugeriu antes da correção nunca chega à aluna.
    await expect(porHabilidade).toContainText(descricaoDe(cena.trocada))
    await expect(porHabilidade).toContainText(descricaoDe(cena.corrigida))
    await expect(porHabilidade).not.toContainText(descricaoDe(cena.sugerida))
    await expect(porHabilidade).toContainText('Sem habilidade')
    await expect(porHabilidade.getByText(EXPLICACAO, { exact: false })).toHaveCount(1)
    await expect(porHabilidade.locator('svg[aria-hidden="true"]')).toHaveCount(3)
    await expect(page.locator('body')).not.toContainText(PROIBIDO_NA_AREA_DO_ALUNO)
    for (const colega of cena.alunos.slice(1)) await expect(page.locator('body')).not.toContainText(colega.nome)
    await conferirATela(page)
  })

  test('recomeço: a professora seguinte entra na mesma aba, e nada da turma da anterior aparece em Turmas, nem no cache da aba', async ({ page, hasTouch }) => {
    const segunda = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(segunda.escolaId, alocacao.vinculoIds)
    await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, `/professor/turmas/${cena.turmaId}?aba=hoje`, () =>
      expect(principal(page).getByRole('region', { name: 'Acerto por habilidade' })).toContainText(cena.trocada, { timeout: SIGN_IN_TIMEOUT_MS }),
    )
    // O controle: com a turma aberta, o cache da aba guarda a habilidade. Sem isto, a ausência depois não provaria nada.
    expect(JSON.stringify(await queryCache(page))).toContain(cena.trocada)

    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarPorEmail(page, segunda, hasTouch)
    await esperarNovaConversa(page, segunda.nome)
    await irPara(page, '/professor/turmas')
    await expect(principal(page).getByRole('link', { name: `Abrir a turma ${alocacao.turmaNome}` })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(cena.turmaNome)
    await expect(page.locator('body')).not.toContainText('Sem habilidade')
    const cache = semAcessosDaConta(await queryCache(page))
    for (const marca of [cena.trocada, cena.corrigida, cena.turmaNome, EXPLICACAO]) expect(cache).not.toContain(marca)
    await conferirATela(page)
  })
})

/** Pede a atividade objetiva à ferramenta (`POST /v1/ferramentas/atividade_objetiva/gerar`), espera a execução terminar e devolve o id do artefato. */
async function gerarAtividadePelaApi(request: APIRequestContext, token: string, pedido: { turmaId: string; disciplinaId: string; tema: string; quantidade: number }): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` }
  const aceito = await request.post('/v1/ferramentas/atividade_objetiva/gerar', { headers, data: { ...pedido, chaveEnvio: randomUUID() } })
  expect(aceito.status(), 'a ferramenta aceita o pedido').toBe(202)
  const { execucaoId } = (await aceito.json()) as { execucaoId: string }
  let artefatoId: string | undefined
  await expect
    .poll(
      async () => {
        const execucao = (await (await request.get(`/v1/execucoes/${execucaoId}`, { headers })).json()) as { estado: string; resultado: { artefatoId?: string } | null }
        artefatoId = execucao.resultado?.artefatoId
        return execucao.estado
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe('concluida')
  if (artefatoId === undefined) throw new Error('a geração não devolveu artefato')
  return artefatoId
}

/** O código da habilidade de cada questão do artefato, na ordem (`null` é a questão sem habilidade). */
function habilidadesDasQuestoesNoBanco(escolaId: string, artefatoId: string): Promise<(string | null)[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ conteudo: { questoes: { habilidade: { codigo: string } | null }[] } }>('select conteudo from artefato where escola_id = $1 and id = $2', [escolaId, artefatoId])
    return (rows[0]?.conteudo.questoes ?? []).map((questao) => questao.habilidade?.codigo ?? null)
  })
}
