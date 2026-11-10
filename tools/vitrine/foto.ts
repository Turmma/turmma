import { chromium, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { raizRepositorio } from '../ci/executar.ts'
import { tirarAFoto } from './captura.ts'
import { acessosDa, codigoDoPasso, comPassoGasto, gravarVitrine, proximoPasso, type Vitrine } from './escola.ts'

// A foto da tela da vitrine: entra com o papel pedido, abre o endereço e grava a página inteira nos dois tamanhos de
// toda tela (regra 50, D51). É o que o agente lê com a ferramenta de leitura de imagem para ver o que a tarefa fez.
//
// Usa o Chromium do Playwright, sem janela, e não a página do canvas do Maestri: a foto da página do canvas só sai com
// a janela do Maestri visível, e o processo roda sem ninguém olhando. A página do canvas continua servindo para
// navegar e clicar à mão.

export const PAPEIS = ['coordenacao', 'professora', 'aluno'] as const
export type Papel = (typeof PAPEIS)[number]

export function ehPapel(texto: string | undefined): texto is Papel {
  return PAPEIS.some((papel) => papel === texto)
}

/** As medidas dos projetos `chromebook` e `celular` do `playwright.config.ts`. */
export const TELAS = [
  { nome: 'computador', largura: 1366, altura: 768 },
  { nome: 'celular', largura: 360, altura: 800 },
] as const

/** A janela do computador: a página que passa dela rola. */
const JANELA = `${String(TELAS[0].largura)} × ${String(TELAS[0].altura)}`

/** Se a página, com aquela altura, rola na janela do computador (1366 × 768). Página que cabe mede exatamente a janela. */
export function rolaNaJanela(alturaDaPagina: number): boolean {
  return alturaDaPagina > TELAS[0].altura
}

export const PASTA_DAS_FOTOS = '.processo/vitrine'

/**
 * A altura de cada pedaço da foto. Página comprida numa foto só chega reduzida a quem a lê (a tela de 360 px com 3.900
 * de altura vira uma tira ilegível): por isso ela sai em pedaços, de cima para baixo.
 */
export const ALTURA_DO_PEDACO = 1_600

/** Onde cada pedaço começa e quanto mede, para uma página daquela altura. */
export function pedacos(alturaDaPagina: number, alturaDoPedaco = ALTURA_DO_PEDACO): { readonly y: number; readonly altura: number }[] {
  const total = Math.max(1, Math.ceil(alturaDaPagina / alturaDoPedaco))
  return Array.from({ length: total }, (_, indice) => ({ y: indice * alturaDoPedaco, altura: Math.min(alturaDoPedaco, Math.max(1, alturaDaPagina - indice * alturaDoPedaco)) }))
}

/** A entrada passa pelo hash da senha no servidor, e o ambiente de teste divide a máquina com o portão. */
const PRAZO_MS = 30_000

const semSimbolo = (texto: string): string => texto.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

/**
 * O começo do nome dos arquivos de uma foto: o papel, o endereço sem a consulta nem o fragmento, o que foi clicado e a
 * tela. O clique entra no nome porque duas abas da mesma página têm o mesmo endereço, e a segunda foto apagaria a primeira.
 * A escola vazia leva a marca na frente, pelo mesmo motivo: o endereço é o mesmo da cheia. O aparelho escuro leva a dele, e
 * vem antes da marca da vazia: a foto no escuro e a no claro da mesma tela não se apagam.
 */
export function baseDaFoto(papel: Papel, caminho: string, tela: string, cliques: readonly string[] = [], vazia = false, escuro = false): string {
  const endereco = semSimbolo(caminho.replace(/[?#].*$/, ''))
  const clicado = cliques.map((clique) => semSimbolo(clique.replace(/^[a-z]+=/, ''))).join('-')
  return `${escuro ? 'escuro--' : ''}${vazia ? 'vazia--' : ''}${papel}--${endereco === '' ? 'inicio' : endereco}${clicado === '' ? '' : `--${clicado}`}--${tela}`
}

/** O arquivo de uma foto: a base e, na página comprida, o número do pedaço. */
export function nomeDaFoto(base: string, pedaco?: number): string {
  return `${base}${pedaco === undefined ? '' : `-${String(pedaco)}`}.png`
}

/** Entre os arquivos da pasta, os de uma foto anterior com aquela base: inteira ou em pedaços. */
export function fotosAnteriores(arquivos: readonly string[], base: string): string[] {
  return arquivos.filter((arquivo) => arquivo === `${base}.png` || (arquivo.startsWith(`${base}-`) && /^\d+\.png$/.test(arquivo.slice(base.length + 1))))
}

/** O endereço da tela de entrada de cada papel: é para lá que a web manda quem chega sem sessão. */
function estaNaEntrada(page: Page): boolean {
  const { pathname } = new URL(page.url())
  return pathname === '/entrar' || pathname.startsWith('/e/')
}

async function entrar(page: Page, vitrine: Vitrine, vazia: boolean, papel: Papel, raiz: string): Promise<void> {
  const acessos = acessosDa(vitrine, vazia)
  if (papel === 'aluno') {
    await page.goto(`${vitrine.url}/e/${acessos.escola.slug}`)
    await page.getByLabel('Matrícula').fill(acessos.aluno.matricula)
    await page.getByLabel('Senha').fill(acessos.aluno.senha)
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    await page.waitForURL(/\/aluno\//, { timeout: PRAZO_MS })
    return
  }
  const pessoa = papel === 'coordenacao' ? acessos.coordenacao : acessos.professora
  await page.goto(`${vitrine.url}/entrar`)
  await page.getByLabel('E-mail').fill(pessoa.email)
  await page.getByLabel('Senha').fill(pessoa.senha)
  await page.getByRole('button', { name: /^Entrar$/ }).click()
  if (papel === 'professora') {
    await page.waitForURL(/\/professor\//, { timeout: PRAZO_MS })
    return
  }
  const { segredo, ultimoPasso } = acessos.coordenacao
  if (segredo === null) throw new Error('a coordenação da vitrine está sem segundo fator: monte a vitrine de novo com a API de pé')
  const campo = page.getByLabel(/Código do aplicativo|Digite o código que o aplicativo mostra/)
  await campo.waitFor({ timeout: PRAZO_MS })
  const { passo, esperarSegundos } = proximoPasso(Date.now(), ultimoPasso)
  // Grava antes de usar: o passo gasto não volta, nem se a entrada falhar depois.
  gravarVitrine(comPassoGasto(vitrine, vazia, passo), raiz)
  if (esperarSegundos > 0) await page.waitForTimeout(esperarSegundos * 1_000)
  await campo.fill(codigoDoPasso(segredo, passo))
  await page.getByRole('button', { name: /^Entrar$/ }).click()
  await page.waitForURL(/\/coordenacao\//, { timeout: PRAZO_MS })
}

/**
 * Espera a tela assentar: a rede parar, a sessão guardada abrir (é quando a web decide se manda para a entrada) e o
 * "Carregando…" sair. Tela que nunca assenta sai na foto como está.
 */
async function assentar(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: PRAZO_MS }).catch(() => undefined)
  for (const espera of ['Abrindo a sua sessão…', 'Carregando…']) {
    await page
      .getByText(espera)
      .first()
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined)
  }
}

/** A altura da página quando ela para de mudar: duas medidas iguais seguidas, ou a última depois de dois segundos. */
async function alturaDaPagina(page: Page): Promise<number> {
  let anterior = -1
  for (let vez = 0; vez < 8; vez += 1) {
    const altura = Number(await page.evaluate('document.documentElement.scrollHeight'))
    if (altura === anterior) return altura
    anterior = altura
    await page.waitForTimeout(250)
  }
  return anterior
}

export interface Foto {
  readonly caminho: string
  readonly tela: string
  readonly arquivo: string
  /** Onde a página parou: diferente do pedido quando a web redirecionou (sem permissão, endereço que não existe). */
  readonly parouEm: string
  /** A altura da página quando ela parou de mudar, a que serviu para cortar os pedaços. */
  readonly alturaDaPagina: number
  /** O que foi clicado antes da foto: a mesma lista das fotos daquela chamada. */
  readonly cliques: readonly string[]
}

/**
 * As `Foto` de uma tela: uma por arquivo, todas com a mesma altura medida e os mesmos cliques. É por aqui que a medida chega
 * ao relatório de rolagem, tanto na foto em pedaços quanto na inteira que o `catch` de `fotografar` grava.
 */
export function fotosDaTela(tela: Omit<Foto, 'arquivo'>, arquivos: readonly string[]): Foto[] {
  return arquivos.map((arquivo) => ({ ...tela, arquivo }))
}

/**
 * As linhas do relatório de rolagem de uma chamada: as telas cuja página passa da janela de 1366 × 768, uma linha por tela,
 * mesmo que ela tenha saído em pedaços. É o que mostra o "só o miolo rola" que a foto sozinha esconde (X2: C1 e C2). A do
 * celular não entra: nele toda tela rola. Sem foto do computador, não há o que dizer.
 */
export function relatorioDeRolagem(fotos: readonly Foto[], vazia: boolean): string[] {
  const doComputador = fotos.filter((foto) => foto.tela === 'computador')
  if (doComputador.length === 0) return []
  const marca = vazia ? ' (escola vazia)' : ''
  const rolam = new Map<string, Foto>()
  for (const foto of doComputador) if (rolaNaJanela(foto.alturaDaPagina)) rolam.set(foto.caminho, foto)
  if (rolam.size === 0) return [`Nenhuma tela rola a ${JANELA}.${marca}`]
  return [
    `Telas cuja página rola a ${JANELA}${marca}, com a altura medida:`,
    ...[...rolam.values()].map(
      (foto) => `  ${foto.caminho}${foto.cliques.length === 0 ? '' : `, depois de clicar ${foto.cliques.join(' e ')}`}: ${String(foto.alturaDaPagina)} px`,
    ),
  ]
}

/** O que o comando `foto` imprime: um arquivo por linha, o aviso de redirecionamento e, no fim, o relatório de rolagem. */
export function linhasDoResultado(fotos: readonly Foto[], urlDaWeb: string, vazia: boolean): string[] {
  return [
    ...fotos.map((foto) => `${foto.arquivo}${foto.parouEm === new URL(foto.caminho, urlDaWeb).pathname ? '' : `   (a página parou em ${foto.parouEm})`}`),
    ...relatorioDeRolagem(fotos, vazia),
  ]
}

/**
 * Fotografa cada endereço como aquele papel, nas duas telas. `cliques` são seletores do Playwright (`text=Alunos`,
 * `role=tab[name="Alunos"]`) acionados em ordem depois de a tela abrir, para a foto pegar a aba, o diálogo ou o estado
 * que a tarefa mexeu. `vazia` fotografa a escola vazia da vitrine, onde cada tela abre sem dado. `escuro` abre o navegador
 * com o aparelho no tema escuro (`prefers-color-scheme: dark`), que é o que a aparência Sistema segue (X1, RF3).
 *
 * A sessão do papel fica guardada entre uma chamada e outra (`sessao-<papel>.json`): sem isso cada foto da coordenação
 * gastaria um código do segundo fator, e a terceira no mesmo meio minuto teria de esperar.
 */
export async function fotografar(
  vitrine: Vitrine,
  papel: Papel,
  caminhos: readonly string[],
  opcoes: { readonly cliques?: readonly string[]; readonly vazia?: boolean; readonly escuro?: boolean } = {},
  raiz = raizRepositorio,
): Promise<Foto[]> {
  const cliques = opcoes.cliques ?? []
  const vazia = opcoes.vazia === true
  const escuro = opcoes.escuro === true
  const pasta = join(raiz, PASTA_DAS_FOTOS)
  mkdirSync(pasta, { recursive: true })
  const sessao = join(pasta, `sessao-${vazia ? 'vazia-' : ''}${papel}.json`)
  const [computador] = TELAS
  const navegador = await chromium.launch()
  try {
    const contexto = await navegador.newContext({
      baseURL: vitrine.url,
      viewport: { width: computador.largura, height: computador.altura },
      locale: 'pt-BR',
      colorScheme: escuro ? 'dark' : 'light',
      ...(existsSync(sessao) ? { storageState: sessao } : {}),
    })
    const page = await contexto.newPage()
    const fotos: Foto[] = []
    try {
      for (const caminho of caminhos) {
        await page.setViewportSize({ width: computador.largura, height: computador.altura })
        await page.goto(caminho)
        await assentar(page)
        if (estaNaEntrada(page)) {
          await entrar(page, vitrine, vazia, papel, raiz)
          await page.goto(caminho)
          await assentar(page)
        }
        for (const clique of cliques) {
          await page.locator(clique).first().click({ timeout: PRAZO_MS })
          await assentar(page)
        }
        for (const tela of TELAS) {
          await page.setViewportSize({ width: tela.largura, height: tela.altura })
          await assentar(page)
          const altura = await alturaDaPagina(page)
          const partes = pedacos(altura)
          const medida = { caminho, tela: tela.nome, parouEm: new URL(page.url()).pathname, alturaDaPagina: altura, cliques }
          const base = baseDaFoto(papel, caminho, tela.nome, cliques, vazia, escuro)
          // A foto de antes sai antes da nova: a página que encolheu deixaria pedaços velhos ao lado dos novos.
          for (const velha of fotosAnteriores(readdirSync(pasta), base)) rmSync(join(pasta, velha))
          try {
            const arquivos: string[] = []
            for (const [indice, parte] of partes.entries()) {
              const arquivo = join(pasta, nomeDaFoto(base, partes.length === 1 ? undefined : indice + 1))
              await tirarAFoto(page, arquivo, { x: 0, y: parte.y, width: tela.largura, height: parte.altura })
              arquivos.push(arquivo)
            }
            fotos.push(...fotosDaTela(medida, arquivos))
          } catch {
            // A página mudou de altura entre a medida e a foto (conteúdo que chega depois): o recorte caiu fora dela. A foto
            // inteira, numa peça só, vale mais que foto nenhuma.
            const arquivo = join(pasta, nomeDaFoto(base))
            await tirarAFoto(page, arquivo)
            fotos.push(...fotosDaTela(medida, [arquivo]))
          }
        }
      }
    } finally {
      // A web troca o cookie de renovação a cada uso: guardar a sessão só no fim feliz deixaria no arquivo um cookie já
      // gasto, e a chamada seguinte ficaria presa em "Abrindo a sua sessão…".
      await contexto.storageState({ path: sessao })
    }
    return fotos
  } finally {
    await navegador.close()
  }
}
