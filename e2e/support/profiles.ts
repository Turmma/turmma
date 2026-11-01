import { test as base, expect, type CDPSession, type Page } from '@playwright/test'

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

export interface ProfileOptions {
  /** Sem perfil, a página roda sem limitação, e o teste falha: todo projeto declara o seu. */
  profile: MachineProfile | undefined
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

/** Sem limitação: latência zero e vazão sem teto (`-1`, no CDP). */
const REDE_SEM_LIMITE: NetworkCondition = { nome: 'sem limite', latenciaMs: 0, downloadBytesPorSegundo: -1, uploadBytesPorSegundo: -1 }

/**
 * `test` de todo spec de tela. Antes de o teste usar a página, aplica a CPU e a rede do perfil do
 * projeto pelo CDP. Importar `test` direto de `@playwright/test` pula a limitação, e a guarda da
 * configuração (tools/ci/playwright.test.ts) reprova.
 */
export const test = base.extend<ProfileOptions>({
  profile: [undefined, { option: true }],
  page: async ({ page, profile }, use) => {
    if (!profile) throw new Error('projeto do Playwright sem perfil de máquina: declare `profile` em playwright.config.ts')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await limitarARede(cdp, profile.rede)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuMaisLenta })
    sessoesDoPerfil.set(page, { sessao: cdp, perfil: profile })
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
