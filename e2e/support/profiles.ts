import { relative } from 'node:path'
import { test as base, errors, expect, type CDPSession, type Page } from '@playwright/test'

/**
 * Condições de rede aplicadas pelo CDP (`Network.emulateNetworkConditions`): latência de ida e volta em
 * ms e banda em bytes por segundo.
 */
export interface NetworkCondition {
  nome: string
  latenciaMs: number
  downloadBytesPorSegundo: number
  uploadBytesPorSegundo: number
}

export interface MachineProfile {
  /** Quantas vezes a CPU fica mais lenta (`Emulation.setCPUThrottlingRate`). */
  cpuMaisLenta: number
  rede: NetworkCondition
}

/** "Fast 3G" do DevTools do Chrome: 1,6 Mbps de descida e 750 kbps de subida, com 90% de vazão, e 562,5 ms. */
export const REDE_FAST_3G: NetworkCondition = {
  nome: 'Fast 3G',
  latenciaMs: 562.5,
  downloadBytesPorSegundo: ((1.6 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPorSegundo: ((750 * 1000) / 8) * 0.9,
}

/** Rede móvel lenta, de celular com sinal fraco fora da escola: menos banda que o Fast 3G e mais latência. */
export const REDE_MOVEL_LENTA: NetworkCondition = {
  nome: 'móvel lenta',
  latenciaMs: 600,
  downloadBytesPorSegundo: ((1 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPorSegundo: ((500 * 1000) / 8) * 0.9,
}

/** Chromebook de entrada na rede compartilhada da escola (regra 50, item 1). */
export const CHROMEBOOK_PROFILE: MachineProfile = { cpuMaisLenta: 4, rede: REDE_FAST_3G }

/** Celular de entrada em rede móvel, fora da sala (D51). */
export const MOBILE_PROFILE: MachineProfile = { cpuMaisLenta: 4, rede: REDE_MOVEL_LENTA }

/**
 * Quanto a primeira tentativa de `page.goto` espera o `load` antes de a página ser tida como travada. A carga normal leva de 3 a 4 s
 * na máquina e uns 7 s no runner da esteira, na rede do perfil (`2026-10-29-primeira-carga-do-e2e`): 15 s é mais do dobro do pior.
 */
export const PRAZO_DA_NAVEGACAO_MS = 15_000

export interface ProfileOptions {
  /** Sem perfil, a página roda sem limitação, e o teste falha: todo projeto declara o seu. */
  profile: MachineProfile | undefined
  /** Até quando a primeira tentativa de `page.goto` espera o `load` (`gotoComNovaTentativa`). Só o guarda desta trava o encurta. */
  prazoDaNavegacaoMs: number
  /** Para onde vai a linha `::warning` da trava. Só o guarda desta trava o troca, por um que guarda. */
  avisoDaEsteira: AvisoDaEsteira
}

/** Para onde vai a linha `::warning` da trava. Um objeto, e não uma função: no `test.use`, função é lida como fixture. */
export interface AvisoDaEsteira {
  escrever: (linha: string) => void
}

/** O aviso padrão: escreve a linha na saída só na esteira do GitHub (`GITHUB_ACTIONS`); fora dela, não escreve nada. */
export function avisoDaEsteira(ambiente: NodeJS.ProcessEnv, saida: { write: (linha: string) => unknown }): AvisoDaEsteira {
  return {
    escrever: (linha) => {
      if (ambiente['GITHUB_ACTIONS'] === 'true') saida.write(linha)
    },
  }
}

/** A linha que o GitHub transforma em anotação da execução. */
export function linhaDoAviso(onde: string, projeto: string, descricao: string): string {
  return `::warning title=primeira-carga-travou::${onde} (${projeto}) ${descricao}\n`
}

/**
 * A sessão do CDP que aplicou o perfil a cada página, para `loadUnthrottled` falar com ela e não com outra.
 * O campo `perfil` daqui é interno e não é a opção `profile` do Playwright (a da fixture e de `playwright.config.ts`).
 */
const sessoesDoPerfil = new WeakMap<Page, { sessao: CDPSession; perfil: MachineProfile }>()

function limitarARede(sessao: CDPSession, rede: NetworkCondition): Promise<unknown> {
  return sessao.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: rede.latenciaMs,
    downloadThroughput: rede.downloadBytesPorSegundo,
    uploadThroughput: rede.uploadBytesPorSegundo,
  })
}

type Ir = Page['goto']

/** O que a anotação e o aviso da esteira dizem: só o caminho (sem `?` nem `#`, onde moram o token do convite e o do bilhete), o prazo e o que se fez. */
export function descricaoDaTrava(alvo: string, prazoMs: number): string {
  return `${alvo.split(/[?#]/)[0]}: sem load em ${prazoMs} ms; uma nova tentativa`
}

/**
 * `page.goto` com **uma** nova tentativa quando o `load` não vem em `prazoMs`. Para a trava da primeira carga sob a rede do
 * perfil: o documento responde 200, e os pedidos seguintes nunca saem do navegador, de modo que o `load` não vem e o caso espera até
 * o prazo dele (30 s, ou 150 s no caso do segundo fator). Aconteceu em `casca.spec.ts` (17/10), `areas.spec.ts` (26/10) e
 * `incidentes.spec.ts` (08/11), com o mesmo traço; não se reproduz fora da esteira (`2026-11-08-incidente-ao-entrar-de-novo`).
 *
 * **O que a nova tentativa esconde, e como deixa de esconder.** A segunda navegação carrega com o cache já cheio: uma regressão real
 * da primeira carga acima do prazo, na rede do perfil, passaria verde. Por isso `aoTravar` registra toda ocorrência de dois jeitos: a
 * anotação `primeira-carga-travou` do caso, e, na esteira, a linha `::warning` que o GitHub põe na execução, visível também quando o caso
 * passa. Ocorrência que se repete é regressão, e não a trava rara. O tamanho do que a primeira carga baixa é o orçamento do build
 * (`tools/ci/tamanho-web.test.ts`).
 *
 * **O que ela supõe.** (1) Carregar a tela não consome nada: caso cuja abertura gasta algo de uso único (o convite, o bilhete da troca de
 * senha) ou confere a contagem de pedidos feitos ao abrir passa `timeout` ao `goto`, e então não ganha nova tentativa. (2) Só o `page` do
 * `test` deste arquivo a tem: página aberta por `context.newPage()` ou `browser.newContext()` navega como antes. É um override do
 * `page.goto`, e não um ajudante a chamar, porque o e2e tem 248 `page.goto` e um ajudante tinha de ser lembrado em cada um.
 *
 * A segunda tentativa vem depois de uma passada por `about:blank`, que larga o documento preso e os pedidos dele. É uma só e não tem
 * prazo próprio: se também não termina, o caso falha como falhava. Quem passa `timeout` decidiu o prazo sozinho.
 */
export async function gotoComNovaTentativa(ir: Ir, url: string, opcoes: Parameters<Ir>[1], prazoMs: number, aoTravar: (url: string) => void): ReturnType<Ir> {
  if (opcoes?.timeout !== undefined) return ir(url, opcoes)
  try {
    return await ir(url, { ...opcoes, timeout: prazoMs })
  } catch (erro) {
    if (!(erro instanceof errors.TimeoutError)) throw erro
    aoTravar(url)
    // Sem sair do documento preso, o `goto` à mesma URL com `#` é navegação dentro do mesmo documento: o Playwright a resolve sem recarregar,
    // com resposta `null`, e a página presa continua presa.
    await ir('about:blank', { timeout: prazoMs })
    return ir(url, opcoes)
  }
}

/** Sem limitação: latência zero e vazão sem teto (`-1`, no CDP). */
const REDE_SEM_LIMITE: NetworkCondition = { nome: 'sem limite', latenciaMs: 0, downloadBytesPorSegundo: -1, uploadBytesPorSegundo: -1 }

/**
 * `test` de todo spec de tela. Antes de o teste usar a página, aplica a CPU e a rede do perfil do
 * projeto pelo CDP. Importar `test` direto de `@playwright/test` pula a limitação, e a guarda da
 * configuração (tools/ci/playwright.test.ts) reprova.
 */
export const test = base.extend<ProfileOptions>({
  profile: [undefined, { option: true }],
  prazoDaNavegacaoMs: [PRAZO_DA_NAVEGACAO_MS, { option: true }],
  avisoDaEsteira: [avisoDaEsteira(process.env, process.stdout), { option: true }],
  page: async ({ page, profile, prazoDaNavegacaoMs, avisoDaEsteira }, use, testInfo) => {
    if (!profile) throw new Error('projeto do Playwright sem perfil de máquina: declare `profile` em playwright.config.ts')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await limitarARede(cdp, profile.rede)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuMaisLenta })
    sessoesDoPerfil.set(page, { sessao: cdp, perfil: profile })
    const irOriginal: Ir = page.goto.bind(page)
    page.goto = (url, opcoes) =>
      gotoComNovaTentativa(irOriginal, url, opcoes, prazoDaNavegacaoMs, (alvo) => {
        const descricao = descricaoDaTrava(alvo, prazoDaNavegacaoMs)
        testInfo.annotations.push({ type: 'primeira-carga-travou', description: descricao })
        // Na esteira, vira anotação da execução do GitHub, e aparece também com o caso verde (a anotação do caso só vai para o artefato).
        avisoDaEsteira.escrever(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
      })
    await use(page)
  },
})

/**
 * Roda `carregar` sem a **rede** do perfil e devolve a rede do perfil logo depois, ainda que `carregar` falhe. A CPU
 * continua limitada.
 *
 * É para a primeira carga de uma página que o caso não afirma nada sobre o tempo de baixar: a galeria (`/galeria`) são
 * umas cinquenta peças pequenas em cascata, e cada rodada de seis pedidos paga a latência inteira do perfil (562,5 ms no
 * Fast 3G): mais de seis segundos de espera por caso, nos trinta que o caso tem. O que o caso faz **depois**, com a página
 * aberta, continua na rede do perfil. Quanto uma tela da escola leva para baixar na rede lenta é medido onde ela é
 * medida (o orçamento do build e os specs de tela com API), e não aqui.
 *
 * Tem de ser a sessão do CDP que aplicou o perfil: uma segunda sessão que peça a rede livre não tira a limitação da
 * primeira. Numa página que não veio deste `test`, falha, em vez de seguir sem limitação nenhuma.
 */
export async function loadUnthrottled<T>(page: Page, carregar: () => Promise<T>): Promise<T> {
  const aplicado = sessoesDoPerfil.get(page)
  if (aplicado === undefined) throw new Error('a página não veio do `test` de profiles.ts: ela não tem rede de perfil para tirar nem para devolver')
  await limitarARede(aplicado.sessao, REDE_SEM_LIMITE)
  try {
    return await carregar()
  } finally {
    await limitarARede(aplicado.sessao, aplicado.perfil.rede)
  }
}

export { expect }
