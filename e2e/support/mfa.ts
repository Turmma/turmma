import type { APIRequestContext, Page } from '@playwright/test'
import { codigoDoAutenticador, codigoDoPassoAnterior, type EquipeDeTeste } from './seed.ts'
import { loadUnthrottled, expect } from './profiles.ts'

/**
 * O segundo fator da coordenação, para os specs que precisam de uma conta com MFA ativo (a 6.0 do F1 e o W10 da A0b):
 * entrar com a senha e configurar o app autenticador do jeito sem celular, pela tela (`setUpMfa`) ou, quando
 * a configuração só prepara a conta, pela API (`configurarSegundoFatorPelaApi`).
 */

const SIGN_IN_TIMEOUT_MS = 20_000

/**
 * O segundo fator aceita um passo de 30 s uma vez só e sempre maior que o anterior (`mfa_ultimo_passo`), numa janela de um passo para
 * cada lado. Com `deixarOPassoSeguinteLivre`, a ativação usa o passo anterior (`-30`) e a entrada pela API, o de agora (`0`): sobra o
 * `+30` para um **login seguinte da mesma conta** (a troca de escola, que pede o código de novo) sem esperar a virada do relógio. Sem
 * a opção, a ativação usa o `0` e a entrada, o `+30`, como sempre.
 */
export interface PassoOptions {
  readonly deixarOPassoSeguinteLivre?: boolean
}

export const campoCodigo = (page: Page) => page.getByLabel(/Código do aplicativo|Digite o código que o aplicativo mostra/)

/** O segundo fator e os códigos de recuperação que a configuração entregou uma vez só. */
export interface ConfiguredMfa {
  readonly segredo: string
  readonly codigosDeRecuperacao: readonly string[]
}

export async function entrarComSenha(page: Page, equipe: EquipeDeTeste): Promise<void> {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(equipe.email)
  await page.getByLabel('Senha').fill(equipe.senha)
  await page.getByRole('button', { name: /^Entrar$/ }).click()
}

/**
 * A pessoa da equipe configura o segundo fator pela tela, do jeito sem celular: copia o segredo em texto, cola no
 * aplicativo do computador (aqui, o `otpauth` do teste) e ativa.
 */
export async function setUpMfa(page: Page, equipe: EquipeDeTeste): Promise<ConfiguredMfa> {
  const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
  await entrarComSenha(page, equipe)
  await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }

  const respostaDosCodigos = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/ativar')
  await campoCodigo(page).fill(codigoDoAutenticador(segredo))
  await page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ }).click()
  const { codigosRecuperacao } = (await (await respostaDosCodigos).json()) as { codigosRecuperacao: string[] }
  await expect(page.getByRole('link', { name: 'Ir para a entrada' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  return { segredo, codigosDeRecuperacao: codigosRecuperacao }
}

/** A entrada com a senha pela API, em contexto de requisição à parte, que não entrega cookie à aba. Devolve o desafio da etapa esperada. */
async function entrarPelaApi(request: APIRequestContext, equipe: EquipeDeTeste, etapaEsperada: 'configurar_mfa' | 'mfa'): Promise<string> {
  const entrada = await request.post('/v1/sessao/email', { data: { email: equipe.email, senha: equipe.senha } })
  expect(entrada.ok(), 'a entrada pela API').toBe(true)
  const { etapa, desafio } = (await entrada.json()) as { etapa: string; desafio: string }
  expect(etapa).toBe(etapaEsperada)
  return desafio
}

/**
 * O mesmo segundo fator, configurado pela API em vez de pela tela: o que o caso quer provar vem depois da configuração, e a
 * tela de configuração custa uns 8 s de um prazo de 30 s. Quem precisa provar a própria tela chama `setUpMfa`.
 */
export async function configurarSegundoFatorPelaApi(
  request: APIRequestContext,
  equipe: EquipeDeTeste,
  opcoes: PassoOptions = {},
): Promise<ConfiguredMfa> {
  const desafio = await entrarPelaApi(request, equipe, 'configurar_mfa')
  const porDesafio = { Authorization: `Bearer ${desafio}` }
  const configurado = await request.post('/v1/conta/mfa/configurar', { headers: porDesafio })
  expect(configurado.ok(), 'a configuração pela API').toBe(true)
  const { segredo } = (await configurado.json()) as { segredo: string }

  const ativado = await request.post('/v1/conta/mfa/ativar', { headers: porDesafio, data: { codigo: opcoes.deixarOPassoSeguinteLivre === true ? await codigoDoPassoAnterior(segredo) : codigoDoAutenticador(segredo) } })
  expect(ativado.ok(), 'a ativação pela API').toBe(true)
  const { codigosRecuperacao } = (await ativado.json()) as { codigosRecuperacao: string[] }
  return { segredo, codigosDeRecuperacao: codigosRecuperacao }
}

/** Gasta um código de recuperação pela API (entra com a senha e informa o código no segundo fator): a aba só vê o que vem depois. */
export async function gastarCodigoDeRecuperacaoPelaApi(request: APIRequestContext, equipe: EquipeDeTeste, codigo: string): Promise<void> {
  const desafio = await entrarPelaApi(request, equipe, 'mfa')
  const gasto = await request.post('/v1/sessao/mfa', { headers: { Authorization: `Bearer ${desafio}` }, data: { recuperacao: codigo } })
  expect(gasto.ok(), 'o código de recuperação gasto pela API').toBe(true)
}

/**
 * Quem é da equipe (a coordenação ou outro papel com segundo fator) entra pela API, com o segundo fator já configurado, e abre o endereço: o cookie de renovação fica no contexto e a
 * aplicação restaura a sessão a partir dele, como num retorno à aba. É o atalho do caso que prova outra coisa que não a entrada (a
 * entrada pela tela tem os casos dela) e que, com o argon2 e a CPU ×4 do perfil, não cabe nos 15 s do portão pagando a configuração do
 * segundo fator pela tela. Devolve o segredo, para o caso que precisa entrar de novo.
 */
export async function entrarPelaApiComSegundoFator(
  page: Page,
  request: APIRequestContext,
  pessoa: EquipeDeTeste,
  endereco: string,
  opcoes: PassoOptions = {},
): Promise<string> {
  const { segredo } = await configurarSegundoFatorPelaApi(request, pessoa, opcoes)
  const pedidos = page.context().request
  const entrada = await pedidos.post('/v1/sessao/email', { data: { email: pessoa.email, senha: pessoa.senha } })
  const { etapa, desafio } = (await entrada.json()) as { etapa?: string; desafio?: string }
  if (etapa !== 'mfa' || desafio === undefined) throw new Error(`a entrada pela API não pediu o segundo fator: ${String(entrada.status())} ${String(etapa)}`)
  // A ativação gastou o passo de agora: o código que o servidor aceita é o do passo seguinte.
  const segundo = await pedidos.post('/v1/sessao/mfa', { headers: { Authorization: `Bearer ${desafio}` }, data: { codigo: codigoDoAutenticador(segredo, opcoes.deixarOPassoSeguinteLivre === true ? 0 : 30) } })
  const { etapa: depois } = (await segundo.json()) as { etapa?: string }
  if (depois !== 'pronta') throw new Error(`o segundo fator pela API não abriu a sessão: ${String(segundo.status())} ${String(depois)}`)
  await page.goto(endereco)
  return segredo
}

/**
 * A receita das correções `2026-10-26-areas-entrar-estoura-o-prazo`, `2026-10-26-tres-casos-do-e2e-perto-do-prazo` e
 * `2026-10-26-material-sem-licenca-perto-do-prazo`, num lugar só: a pessoa da equipe entra pela API, com o segundo fator já
 * configurado, e a **primeira carga** (o endereço e a primeira tela, que `aguardar` espera) roda sem a rede do perfil
 * (`loadUnthrottled`). A CPU do perfil continua, e a rede do perfil volta quando a função devolve.
 *
 * **O que ele não mede:** quanto a aplicação leva para baixar e abrir na rede lenta. Isso fica para o orçamento do build e para
 * os specs de tela cujo assunto é a carga; um caso que afirma o tempo de abrir não usa este ajudante. Também não prova a entrada
 * pela tela (senha, segundo fator, troca de escola): ela tem os casos dela (`entrar.spec.ts`, `mfa.spec.ts`), e o caso que a
 * usa para chegar a outra coisa não a repete.
 *
 * **Segunda pessoa na mesma aba:** o caso sobre isolamento (a aba não mostra dado da pessoa anterior) continua com o **login da
 * segunda pessoa pela tela** (`entrarPelaTelaComSegundoFator`), com a configuração do segundo fator dela, no máximo, pela API. Trocar esse
 * login pela API num ajuste de prazo esvazia a prova da regra 10 (item 5) e da regra 20 (item 5): ele é o que faz a aba ter o cache da primeira. Devolve o segredo, para o caso que precisa entrar de novo pela tela.
 */
export async function abrirPelaApiSemMedirAPrimeiraCarga(
  page: Page,
  request: APIRequestContext,
  pessoa: EquipeDeTeste,
  endereco: string,
  aguardar?: () => Promise<void>,
  opcoes: PassoOptions = {},
): Promise<string> {
  return loadUnthrottled(page, async () => {
    const segredo = await entrarPelaApiComSegundoFator(page, request, pessoa, endereco, opcoes)
    await aguardar?.()
    return segredo
  })
}
