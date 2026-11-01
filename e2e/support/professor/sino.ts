import { randomUUID } from 'node:crypto'
import { expect, type Locator, type Page } from '@playwright/test'
import { atividadeSintetica, entregaDoLote, loteSintetico, mockAssistenteApi, versaoAdaptada, type AssistenteApiMock } from '../assistente.ts'
import { entrarPorEmail, esperarNovaConversa, SIGN_IN_TIMEOUT_MS } from '../casca.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, criarPedidosNoBanco, type AlocacaoDeTeste, type EquipeDeTeste, type PedidoDeTeste } from '../seed.ts'

/**
 * A cena do sino da professora (telas do professor, 1.0): uma professora com **um item de cada tipo** da fila, para o teste
 * olhar o sino pela tela. A sessão, os vínculos e os pedidos de nome são os de verdade (A1, no banco); as entregas e a
 * correção são as da API simulada do Assistente (`assistente.ts`), como nos outros specs do professor.
 *
 * - correção para revisar: o lote de uma atividade aplicada, na turma A;
 * - versão adaptada para decidir: a entrega pendente da adaptação, na turma A;
 * - pedidos de nome: dois, na turma A (confirmada);
 * - confirme sua turma: o vínculo da turma B, ainda pendente.
 */
export const TITULO_DA_CORRECAO = 'Atividade de estequiometria'
export const TITULO_DA_VERSAO = 'Atividade de estequiometria (versão adaptada)'

export interface SinoScenario {
  readonly api: AssistenteApiMock
  readonly professora: EquipeDeTeste
  /** A turma confirmada, com as duas entregas e os dois pedidos de nome. */
  readonly turmaA: AlocacaoDeTeste
  /** A turma do vínculo pendente. */
  readonly turmaB: AlocacaoDeTeste
  readonly pedidos: readonly PedidoDeTeste[]
  readonly atividadeAplicadaId: string
  readonly entregaDaVersao: string
}

/** Cria a cena no banco e na API simulada, sem entrar: quem usa decide como a professora chega (a mesma aba, outra escola). */
export async function setupScenario(page: Page): Promise<SinoScenario> {
  const api = await mockAssistenteApi(page)
  const professora = await criarEquipeComSenha()
  const turmaA = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  const turmaB = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Física'])
  await confirmarVinculosNoBanco(professora.escolaId, turmaA.vinculoIds)
  const pedidos = await criarPedidosNoBanco(professora.escolaId, turmaA.turmaId, [
    { nome: 'Ana Sintética do sino', matricula: `S${randomUUID().slice(0, 6)}` },
    { nome: 'Bruno Sintético do sino', matricula: `S${randomUUID().slice(0, 6)}` },
  ])
  const atividadeAplicadaId = randomUUID()
  const lote = loteSintetico({ id: atividadeAplicadaId, titulo: TITULO_DA_CORRECAO })
  const origem = atividadeSintetica(turmaA.turmaId, randomUUID())
  const { artefato, entrega } = versaoAdaptada(origem)
  api.artefatos = [origem, artefato]
  api.correcoes.set(atividadeAplicadaId, lote)
  api.entregas = [entregaDoLote(lote, turmaA.turmaId), entrega]
  return { api, professora, turmaA, turmaB, pedidos, atividadeAplicadaId, entregaDaVersao: entrega.id }
}

/** A professora entra pela tela de entrada e chega a "Início", onde o sino já está. */
export async function entrarNaCena(page: Page, cena: Pick<SinoScenario, 'professora'>, hasTouch: boolean): Promise<void> {
  await page.goto('/entrar')
  await entrarPorEmail(page, cena.professora, hasTouch)
  await esperarNovaConversa(page, cena.professora.nome)
}

export const sinoDe = (page: Page): Locator => page.getByRole('button', { name: /^Esperando você/ })
export const listaDoSino = (page: Page): Locator => page.getByRole('dialog', { name: 'Esperando você' })
/** O pé da lista: as duas telas do que a IA fez, que já não são item da lateral (telas do professor, 2.0). */
export const peDoSino = (page: Page): Locator => listaDoSino(page).getByRole('region', { name: 'Acompanhar a IA' })

/** Espera o sino ter lido tudo (nome com o número) e devolve o botão. */
export async function esperarSino(page: Page, nome: string): Promise<Locator> {
  const sino = sinoDe(page)
  await expect(sino).toHaveAccessibleName(nome, { timeout: SIGN_IN_TIMEOUT_MS })
  return sino
}

/**
 * Nada se mexe sozinho (D59): nenhum `@keyframes` em andamento no elemento nem no que há dentro dele, e o número e o desenho
 * do sino sem transição.
 */
export async function semAnimacao(alvo: Locator): Promise<void> {
  const animado = await alvo.evaluate((elemento) =>
    [elemento, ...elemento.querySelectorAll('*')]
      .filter((no) => {
        const estilo = getComputedStyle(no)
        const doSino = no.matches('[data-contador], [data-contador] *, svg')
        return estilo.animationName !== 'none' || (doSino && estilo.transitionDuration.split(',').some((duracao) => parseFloat(duracao) > 0))
      })
      .map((no) => no.outerHTML.slice(0, 80)),
  )
  expect(animado).toEqual([])
}

/** Uma porta que segura a resposta até o teste abrir. */
export function gate(): { readonly aberta: Promise<void>; readonly abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}
