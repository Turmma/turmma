// As mutações da tarefa, conferidas por máquina (D79, proposta M1 da retrospectiva do F3).
//
// A maior causa de reprovação do F3 (17 em 14 tarefas, grupo A) foi regra ou cláusula sem teste que falhe sem ela, e
// em cinco delas a seção "Mutações" afirmava um vermelho que não acontecia. Três rodadas de texto ("rode a mutação",
// "termo a termo", "confira antes da primeira rodada") não mexeram no número. Aqui a seção vira entrada do portão da
// tarefa: cada bloco diz o arquivo, o trecho, o que entra no lugar e o teste; o portão aplica, roda o teste, exige
// vermelho e restaura. O carimbo guarda a impressão dos blocos, e o commit é bloqueado se eles mudaram depois.
//
// O bloco, no documento da tarefa ou da correção:
//
//   ```mutacao
//   arquivo: apps/api/src/privacidade/titulares.repository.ts
//   teste: apps/api/test/pedido-titular.int.test.ts › a coordenação de outra escola não acha o pedido
//     .where(and(
//   -   eq(pedidos.escolaId, escolaId),
//       eq(pedidos.id, id),
//   ```
//
// Depois das duas linhas de cabeçalho vem um pedaço de diff: linha que começa com `-` sai, com `+` entra, e com espaço
// é contexto, que fica e serve para o trecho existir uma vez só no arquivo. O espaço do começo e do fim de cada linha
// não conta. Em `teste:`, o nome do caso depois de ` › ` é opcional: sem ele roda o arquivo inteiro.
//
// O vermelho que vale é o de um caso que rodou e falhou. Mutação que deixa o arquivo com erro de sintaxe, ou o módulo sem
// carregar, derruba o teste sem que caso nenhum rode, e o código de saída é o mesmo: a corrida lê o relatório do Vitest ou do
// Playwright e recusa essa mutação com o motivo (M2 da retrospectiva da X7). O caso que roda e lança também conta: é um caso
// que caiu.
//
// "Nenhum caso falhou" inclui mais que sintaxe: o `beforeAll` que lança (o Vitest pode deixar `numFailedTests` em 0, com os casos
// pulados) e o ambiente que não subiu antes de o teste rodar (o compose do `tools/ci/e2e.ts`, sem relatório) caem como erro de carga
// também. O portão fica vermelho, o que está certo, e o motivo diz isso; a mutação de produção que só quebra o preparo de um teste
// de integração precisa de um trecho que ainda deixe um caso rodar e falhar.
//
// Uma linha de cabeçalho, `falha: <trecho da linha do expect>`, é opcional e diz qual asserção tem de cair (X8, M1 da retrospectiva):
//
//   falha: not.toContain('insertAuditoria')
//
// A corrida lê no relatório (a pilha do Vitest, `errors[].location` do Playwright) a primeira linha do arquivo de teste em que o caso
// caiu, lê essa linha no arquivo e recusa o bloco com "vermelho em outra asserção" se o trecho não está nela: o caso com um `expect`
// positivo antes da negativa fica vermelho na positiva, e esse vermelho não prova a cláusula. O trecho que não existe no arquivo de
// teste é recusado antes de qualquer corrida. Sem a linha, nada muda: vale o vermelho de qualquer caso.
//
// Outra linha de cabeçalho, `projeto: celular`, é opcional e só vale para teste de e2e: diz em que projeto do
// Playwright o caso roda. Sem ela é o `chromebook`. A cláusula que só existe no celular (o ramo de toque, o menu de baixo)
// não é alcançada no computador, e o teste ficaria verde sem ela; o bloco diz onde ela se prova.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Mutacao {
  arquivo: string
  teste: string
  /** O nome do caso, ou um pedaço dele. `null`: o arquivo de teste inteiro. */
  caso: string | null
  /** O projeto do Playwright onde o caso de e2e roda. Ausente: `chromebook`. Só o bloco que declara a linha o tem. */
  projeto?: ProjetoDoE2e
  /** O trecho da linha do `expect` que tem de cair no arquivo de teste. Ausente: vale o vermelho de qualquer caso. */
  falha?: string
  /** O que tem de estar no arquivo hoje: contexto e linhas que saem, na ordem. */
  antes: string[]
  /** O que fica no lugar: contexto e linhas que entram, na ordem. */
  depois: string[]
}

export interface Leitura {
  mutacoes: Mutacao[]
  /** Bloco que não deu para ler: o portão recusa antes de rodar qualquer coisa. */
  erros: string[]
}

/** Os projetos de `playwright.config.ts`. O primeiro é o que vale quando o bloco não diz. */
export const PROJETOS_DO_E2E = ['chromebook', 'celular'] as const
export type ProjetoDoE2e = (typeof PROJETOS_DO_E2E)[number]

const BLOCO = /^```mutacao[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm

/** Lê os blocos `mutacao` de um documento. Bloco malformado vira erro com o número dele, e não some. */
export function lerMutacoes(documento: string): Leitura {
  const mutacoes: Mutacao[] = []
  const erros: string[] = []
  let numero = 0
  for (const bloco of documento.matchAll(BLOCO)) {
    numero += 1
    const linhas = (bloco[1] ?? '').split(/\r?\n/)
    let arquivo: string | null = null
    let teste: string | null = null
    let projeto: string | null = null
    let falha: string | null = null
    const antes: string[] = []
    const depois: string[] = []
    let saiAlguma = false
    let erro: string | null = null
    for (const linha of linhas) {
      if (linha.trim() === '') continue
      const cabecalho = /^(arquivo|teste|projeto|falha):\s*(.+?)\s*$/.exec(linha)
      if (cabecalho && antes.length === 0 && depois.length === 0) {
        if (cabecalho[1] === 'arquivo') arquivo = cabecalho[2] ?? null
        else if (cabecalho[1] === 'teste') teste = cabecalho[2] ?? null
        else if (cabecalho[1] === 'falha') falha = cabecalho[2] ?? null
        else projeto = cabecalho[2] ?? null
        continue
      }
      const marca = linha[0]
      const texto = linha.slice(1).trim()
      if (marca === '-') {
        antes.push(texto)
        saiAlguma = true
      } else if (marca === '+') depois.push(texto)
      else if (marca === ' ') {
        antes.push(texto)
        depois.push(texto)
      } else {
        erro = `linha "${linha}" não começa com "-", "+" nem espaço`
        break
      }
    }
    if (!erro && !arquivo) erro = 'falta a linha "arquivo:"'
    if (!erro && !teste) erro = 'falta a linha "teste:"'
    if (!erro && !saiAlguma) erro = 'nenhuma linha começa com "-": a mutação precisa tirar ou trocar um trecho que existe'
    if (!erro && antes.join('\n') === depois.join('\n')) erro = 'o que entra é igual ao que sai'
    if (!erro && projeto !== null) {
      if (!PROJETOS_DO_E2E.some((nome) => nome === projeto)) erro = `projeto "${projeto}" não existe (${PROJETOS_DO_E2E.join(' ou ')})`
      else if (tipoDoTeste((teste ?? '').split(' › ')[0]?.trim() ?? '') !== 'e2e') erro = '"projeto:" só vale para teste de e2e'
    }
    if (erro || !arquivo || !teste) {
      erros.push(`mutação ${String(numero)}: ${erro ?? 'bloco incompleto'}`)
      continue
    }
    const [caminhoDoTeste = '', ...caso] = teste.split(' › ')
    const doBloco = PROJETOS_DO_E2E.find((nome) => nome === projeto)
    mutacoes.push({
      arquivo,
      teste: caminhoDoTeste.trim(),
      caso: caso.length > 0 ? caso.join(' › ').trim() : null,
      ...(doBloco ? { projeto: doBloco } : {}),
      ...(falha ? { falha } : {}),
      antes,
      depois,
    })
  }
  return { mutacoes, erros }
}

/**
 * A impressão dos blocos, que o carimbo guarda. Sai do que o portão conferiu, e não do texto da seção: reescrever a
 * frase em volta não invalida nada, e mudar um trecho, um teste ou acrescentar um bloco invalida.
 */
export function impressaoDasMutacoes(mutacoes: readonly Mutacao[]): string {
  return createHash('sha256').update(JSON.stringify(mutacoes)).digest('hex').slice(0, 16)
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Aplica a mutação ao conteúdo do arquivo. O trecho tem de existir **uma** vez: zero é linha velha (o código mudou
 * depois de ela ser escrita, que foi o defeito da 15.0 do F3), e duas ou mais é trecho que não diz qual cláusula sai.
 */
export function aplicarMutacao(conteudo: string, mutacao: Mutacao): { mutado: string } | { recusa: string } {
  const trecho = new RegExp(mutacao.antes.map(escapar).join('[ \\t]*\\r?\\n[ \\t]*'), 'g')
  const achados = [...conteudo.matchAll(trecho)]
  if (achados.length === 0) return { recusa: `o trecho não está em ${mutacao.arquivo}: o código mudou depois de a mutação ser escrita` }
  if (achados.length > 1) {
    return { recusa: `o trecho aparece ${String(achados.length)} vezes em ${mutacao.arquivo}: acrescente linhas de contexto (começadas por espaço) até sobrar uma` }
  }
  const achado = achados[0]
  if (!achado) return { recusa: 'trecho não localizado' }
  const inicio = achado.index
  // O recuo da primeira linha do trecho vale para as que entram: o arquivo mutado continua legível se o teste falhar.
  const recuo = /[ \t]*$/.exec(conteudo.slice(0, inicio).split('\n').at(-1) ?? '')?.[0] ?? ''
  const novo = mutacao.depois.join(`\n${recuo}`)
  return { mutado: conteudo.slice(0, inicio) + novo + conteudo.slice(inicio + achado[0].length) }
}

export type TipoDeTeste = 'unidade' | 'integracao' | 'infra' | 'processo' | 'e2e'

export function tipoDoTeste(teste: string): TipoDeTeste | null {
  if (/^e2e\/.*\.spec\.ts$/.test(teste)) return 'e2e'
  if (/^infra\/.*\.int\.test\.ts$/.test(teste)) return 'infra'
  // O teste do git hook roda contra um git de verdade e não sobe o compose: projeto próprio (`vitest.config.ts`).
  if (/^tools\/processo\/.*\.int\.test\.ts$/.test(teste)) return 'processo'
  if (/\.int\.test\.ts$/.test(teste)) return 'integracao'
  if (/\.test\.tsx?$/.test(teste)) return 'unidade'
  return null
}

/** O que serve a web e as APIs ao e2e são imagens construídas: mutar o fonte sem reconstruir não muda o que o teste vê. */
export function pedeReconstrucao(mutacao: Mutacao): boolean {
  return tipoDoTeste(mutacao.teste) === 'e2e' && /^(apps|packages)\//.test(mutacao.arquivo)
}

/**
 * O comando que roda o teste de uma mutação. No e2e, um projeto só, o que o bloco declara (`chromebook` sem a linha): a
 * mutação prova a regra, não o perfil de máquina, mas a regra que só vale no celular só cai lá.
 */
export function comandoDoTeste(mutacao: Mutacao): string[] | null {
  const tipo = tipoDoTeste(mutacao.teste)
  if (tipo === null) return null
  if (tipo === 'e2e') {
    const filtro = [...(mutacao.caso ? [`--grep=${mutacao.caso}`] : []), `--project=${mutacao.projeto ?? PROJETOS_DO_E2E[0]}`]
    return pedeReconstrucao(mutacao)
      ? ['node', 'tools/ci/e2e.ts', '--manter-ambiente', mutacao.teste, ...filtro]
      : ['npx', 'playwright', 'test', mutacao.teste, ...filtro]
  }
  return ['npx', 'vitest', 'run', '--project', tipo, mutacao.teste, ...(mutacao.caso ? ['-t', mutacao.caso] : [])]
}

export interface Resultado {
  mutacao: Mutacao
  /** `vermelho` é o único que passa: o teste caiu com a cláusula fora. `recusada` inclui o teste que passou do prazo. */
  veredito: 'vermelho' | 'verde' | 'recusada'
  motivo?: string
}

/** O teto de uma corrida, da limpa e da mutada: acima disso o teste trava, e não demora (RF4, M3 da X5). */
export const TETO_DA_CORRIDA_MS = 10 * 60_000
/** O piso do prazo da mutada: a limpa de 1 s não faz de 3 s o prazo de um teste que sobe o compose. */
export const PISO_DO_PRAZO_MS = 60_000
/** Do SIGTERM ao SIGKILL no grupo do teste que passou do prazo. */
export const ESPERA_ATE_SIGKILL_MS = 5_000
/** O `testTimeout` do Vitest quando o projeto não declara (`vitest.config.ts`). */
const TESTTIMEOUT_PADRAO_DO_VITEST_MS = 5_000
/** O `timeout` do Playwright quando o caso não declara (`playwright.config.ts`); `test.slow()` triplica. */
const TIMEOUT_PADRAO_DO_E2E_MS = 30_000

/**
 * O que a corrida devolve: `true` passou, `false` caiu porque um caso falhou, `'estourou'` foi morta no prazo e `'carga'` caiu
 * sem caso nenhum falhar (erro de sintaxe, módulo que não carrega, nenhum caso rodou). O relógio de quem chama também decide
 * (um `rodar` que não sabe medir só devolve `false`), e a corrida que levou mais que o prazo conta como estourada. `{ outra }`: um caso
 * falhou, mas não na linha que `falha` pedia (só com o quarto argumento); `outra` diz a linha que caiu.
 */
export type Rodar = (comando: string[], prazoMs?: number, restaurar?: Restauracao, falha?: FalhaEsperada) => boolean | 'estourou' | 'carga' | { outra: string }

/**
 * A asserção que o bloco diz que tem de cair (`falha:`): o arquivo de teste, como o bloco o escreveu, e o trecho da linha do `expect`.
 * Com ela, a corrida devolve `{ outra }` (o motivo, com a linha que caiu) quando o caso vermelho caiu em outro lugar.
 */
export interface FalhaEsperada {
  teste: string
  trecho: string
}

/**
 * O arquivo que a mutada alterou e o que ele era: o supervisor o devolve quando o grupo do teste acaba, por qualquer caminho.
 * O `finally` de `conferirMutacoes` não alcança o portão morto por Ctrl-C (o Node morre no sinal sem rodá-lo, preso no `spawnSync`),
 * e o supervisor, que recebe o mesmo sinal do terminal, é quem fica de pé.
 */
export interface Restauracao {
  arquivo: string
  original: string
}

export interface OpcoesDaConferencia {
  /** O relógio, em ms. Injetado, a corrida de 61 s não espera 61 s. */
  agora?: () => number
  /** O prazo da mutada, dado o que a limpa levou e o `testTimeout` da mutação. Injetado, o teste de processo usa 2 s. */
  prazoDaMutada?: (limpaMs: number, testTimeoutMs: number) => number
  /** O `testTimeout` de uma mutação. Sem ele, lê o do caso no arquivo de teste e o do projeto na configuração. */
  testTimeoutMs?: (mutacao: Mutacao) => number
}

/**
 * O prazo da mutada: o maior entre 3 × a corrida limpa, o `testTimeout` (o do caso, ou o do projeto) e 60 s, e nunca
 * mais que 10 min. Teste que cai com a cláusula fora cai antes do que o limpo leva; o que passa disso travou.
 */
export function prazoDaMutada(limpaMs: number, testTimeoutMs: number): number {
  return Math.min(TETO_DA_CORRIDA_MS, Math.max(3 * limpaMs, testTimeoutMs, PISO_DO_PRAZO_MS))
}

function numero(texto: string): number {
  return Number(texto.replaceAll('_', ''))
}

/** O `testTimeout` que o projeto declara em `vitest.config.ts`, ou o padrão do Vitest. No e2e (ou sem teste), o `timeout` do Playwright. */
export function testTimeoutDoProjeto(configuracao: string, tipo: TipoDeTeste | null): number {
  if (tipo === null || tipo === 'e2e') return TIMEOUT_PADRAO_DO_E2E_MS
  // `unidade` não declara: a integração e a infra repartem o mesmo objeto, que declara, e o `processo` declara o mesmo valor.
  if (tipo === 'unidade') return TESTTIMEOUT_PADRAO_DO_VITEST_MS
  const [declarado] = [...configuracao.matchAll(/\btestTimeout:\s*([\d_]+)/g)].map((achado) => numero(achado[1] ?? '0'))
  return declarado ?? TESTTIMEOUT_PADRAO_DO_VITEST_MS
}

/**
 * O prazo que o caso citado declara no próprio arquivo de teste: `it('nome', async () => { … }, 120_000)`,
 * `{ timeout: 120_000 }`, `test.setTimeout(120_000)` ou `test.slow()` (3 × o padrão do e2e). O trecho do caso vai do nome dele
 * até o próximo `it('`/`test('`/`describe('` que começa a linha (com o nome do caso, e não `test.setTimeout(`). `null`: o caso não declara, ou a mutação roda o arquivo todo.
 */
export function testTimeoutDoCaso(fonteDoTeste: string, caso: string | null): number | null {
  const trecho = caso === null ? undefined : trechoDoCaso(fonteDoTeste, caso)
  if (trecho === undefined) return null
  const setTimeout = /\btest\.setTimeout\(\s*([\d_]+)\s*\)/.exec(trecho)
  if (setTimeout) return numero(setTimeout[1] ?? '0')
  if (/\btest\.slow\(\s*\)/.test(trecho)) return 3 * TIMEOUT_PADRAO_DO_E2E_MS
  const declarado = /\btimeout:\s*([\d_]+)/.exec(trecho) ?? /\}\s*,\s*([\d_]+)\s*\)\s*;?\s*$/.exec(trecho.trimEnd())
  return declarado ? numero(declarado[1] ?? '0') : null
}

/** O próximo caso que começa a linha, com o nome entre aspas: o `test.setTimeout(` de dentro de um caso não conta. */
const PROXIMO_CASO = /\n[ \t]*(?:it|test|describe)(?:\.\w+)*\(\s*['"`]/

/** Do nome do caso até o próximo; `undefined` se o nome não está no arquivo. */
function trechoDoCaso(fonteDoTeste: string, caso: string): string | undefined {
  return fonteDoTeste.split(caso)[1]?.split(PROXIMO_CASO)[0]
}

/** O `testTimeout` de uma mutação: o do caso, quando ele declara, e senão o do projeto. */
export function testTimeoutDaMutacao(raiz: string, mutacao: Mutacao): number {
  const doCaso = testTimeoutDoCaso(readFileSync(join(raiz, mutacao.teste), 'utf8'), mutacao.caso)
  if (doCaso !== null) return doCaso
  const configuracao = join(raiz, 'vitest.config.ts')
  return testTimeoutDoProjeto(existsSync(configuracao) ? readFileSync(configuracao, 'utf8') : '', tipoDoTeste(mutacao.teste))
}

function segundos(ms: number): string {
  return `${String(Math.round(ms / 100) / 10)} s`
}

const TETO_EM_TEXTO = `${String(TETO_DA_CORRIDA_MS / 60_000)} min`

/** O motivo da recusa da mutação que a corrida mutada não provou, ou `null` se ela caiu na linha certa ou ficou verde (o chamador distingue). */
function motivoDaMutadaRecusada(
  corrida: ReturnType<Rodar>,
  { mutadaMs, prazo, limpaMs, testTimeout, falha }: { mutadaMs: number; prazo: number; limpaMs: number; testTimeout: number; falha: string | undefined },
): string | null {
  if (corrida === 'estourou' || mutadaMs > prazo) {
    return `o teste passou do prazo de ${segundos(prazo)} com a cláusula fora (o maior entre 3 × a corrida limpa de ${segundos(limpaMs)}, o testTimeout de ${segundos(testTimeout)} e ${segundos(PISO_DO_PRAZO_MS)}, até ${TETO_EM_TEXTO}): foi morto, com o grupo de processo, e o arquivo voltou ao que era`
  }
  if (corrida === 'carga') {
    return 'o teste ficou vermelho por erro de carga, e não por um caso que falhou (sintaxe, módulo que não carrega, preparo do teste que lançou, ambiente que não subiu ou nenhum caso rodou): a mutação não prova a cláusula. Troque o trecho por código válido, que o arquivo de teste consiga carregar e rodar'
  }
  if (typeof corrida === 'object') {
    return `vermelho em outra asserção: o caso caiu, mas não no expect que "falha:" cita (\`${falha ?? ''}\`): ${corrida.outra}. A mutação não prova a cláusula: troque-a por uma que deixe as asserções anteriores verdes, ou corrija o trecho de "falha:"`
  }
  return null
}

/** O que a corrida mutada confere no relatório: ausente se o bloco não tem `falha:`. */
function falhaEsperada(mutacao: Mutacao): FalhaEsperada | undefined {
  return mutacao.falha === undefined ? undefined : { teste: mutacao.teste, trecho: mutacao.falha }
}

/** O trecho de `falha:` que não está no arquivo de teste não prova nada: recusado antes de qualquer corrida. */
function recusaDaFalhaQueNaoExiste(raiz: string, mutacao: Mutacao): string | null {
  if (mutacao.falha === undefined || readFileSync(join(raiz, mutacao.teste), 'utf8').includes(mutacao.falha)) return null
  return `a linha "falha:" cita \`${mutacao.falha}\`, que não está em ${mutacao.teste}: copie o trecho da linha do expect que tem de cair`
}

/**
 * Confere as mutações, uma a uma. Para cada par de teste e caso, uma corrida limpa antes, que tem de passar e de caber no
 * teto de 10 min: sem ela, um nome de caso errado ou um teste já vermelho contaria como mutação provada, e a limpa
 * também dá a medida do prazo da mutada. O arquivo é restaurado sempre, também quando o teste estoura ou é morto no prazo.
 */
export function conferirMutacoes(
  raiz: string,
  mutacoes: readonly Mutacao[],
  rodar: Rodar,
  avisar: (texto: string) => void = () => undefined,
  opcoes: OpcoesDaConferencia = {},
): Resultado[] {
  const agora = opcoes.agora ?? Date.now
  const calcularPrazo = opcoes.prazoDaMutada ?? prazoDaMutada
  const limpos = new Map<string, { passou: boolean; estourou: boolean; ms: number }>()
  const resultados: Resultado[] = []
  for (const [indice, mutacao] of mutacoes.entries()) {
    const rotulo = `mutação ${String(indice + 1)} de ${String(mutacoes.length)} (${mutacao.arquivo} → ${mutacao.teste}${mutacao.caso ? ` › ${mutacao.caso}` : ''})${mutacao.projeto ? ` [${mutacao.projeto}]` : ''}`
    const recusar = (motivo: string) => {
      avisar(`✗ ${rotulo}: ${motivo}\n`)
      resultados.push({ mutacao, veredito: 'recusada', motivo })
    }
    const caminho = join(raiz, mutacao.arquivo)
    const comando = comandoDoTeste(mutacao)
    if (!existsSync(caminho)) {
      recusar(`${mutacao.arquivo} não existe`)
      continue
    }
    if (comando === null || !existsSync(join(raiz, mutacao.teste))) {
      recusar(`${mutacao.teste} não existe ou não é arquivo de teste`)
      continue
    }
    const semTrecho = recusaDaFalhaQueNaoExiste(raiz, mutacao)
    if (semTrecho !== null) {
      recusar(semTrecho)
      continue
    }
    const original = readFileSync(caminho, 'utf8')
    const aplicada = aplicarMutacao(original, mutacao)
    if ('recusa' in aplicada) {
      recusar(aplicada.recusa)
      continue
    }
    const chave = comando.join(' ')
    let limpa = limpos.get(chave)
    if (!limpa) {
      const inicio = agora()
      const corrida = rodar(comando, TETO_DA_CORRIDA_MS)
      const ms = agora() - inicio
      limpa = { passou: corrida === true, estourou: corrida === 'estourou' || ms > TETO_DA_CORRIDA_MS, ms }
      limpos.set(chave, limpa)
    }
    if (limpa.estourou) {
      recusar(`a corrida limpa do teste citado passou do teto de ${TETO_EM_TEXTO} (levou ${segundos(limpa.ms)}): o teste trava ou é lento demais para provar mutação, e nenhuma foi aplicada`)
      continue
    }
    if (!limpa.passou) {
      recusar('o teste citado não passa sem a mutação (ou o nome do caso não acha teste nenhum): conserte o teste antes')
      continue
    }
    const testTimeout = (opcoes.testTimeoutMs ?? ((alvo: Mutacao) => testTimeoutDaMutacao(raiz, alvo)))(mutacao)
    const prazo = calcularPrazo(limpa.ms, testTimeout)
    let corridaMutada: ReturnType<Rodar>
    let mutadaMs: number
    try {
      writeFileSync(caminho, aplicada.mutado)
      const inicio = agora()
      corridaMutada = rodar(comando, prazo, { arquivo: caminho, original }, falhaEsperada(mutacao))
      mutadaMs = agora() - inicio
    } finally {
      writeFileSync(caminho, original)
    }
    const motivo = motivoDaMutadaRecusada(corridaMutada, { mutadaMs, prazo, limpaMs: limpa.ms, testTimeout, falha: mutacao.falha })
    if (motivo !== null) {
      recusar(motivo)
    } else if (corridaMutada === true) {
      avisar(`✗ ${rotulo}: o teste continuou verde sem a cláusula. Falta o teste que falhe sem ela.\n`)
      resultados.push({ mutacao, veredito: 'verde', motivo: 'o teste continuou verde sem a cláusula' })
    } else {
      avisar(`✓ ${rotulo}: vermelho\n`)
      resultados.push({ mutacao, veredito: 'vermelho' })
    }
  }
  return resultados
}

/** O código com que o supervisor sai quando matou o grupo no prazo. Um teste que cai sai com 1. */
export const SAIDA_DO_PRAZO = 124
export const MARCA_DO_SUPERVISOR = '--supervisionar-corrida'

/** Manda o sinal ao grupo de processo inteiro. `false`: o grupo não existe mais (ou o sinal 0 não achou ninguém). */
export function sinalAoGrupo(grupo: number, sinal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-grupo, sinal)
    return true
  } catch {
    return false
  }
}

/**
 * O supervisor: roda o comando em grupo de processo próprio (`detached` é um `setsid`: o pgid é o do filho) e, passado o
 * prazo, manda SIGTERM ao grupo inteiro, e não só ao filho: o teste abre `npx`, `vitest`, `docker compose` e `sleep`, e o
 * `spawnSync` com `timeout` só alcançaria o primeiro, deixando o neto segurando o `flock`. Os containers que o `docker compose` subiu ficam fora do grupo, e este não os alcança (o `compose down` do ambiente é de quem o subiu). Se o grupo ainda
 * existe `esperaMs` depois, SIGKILL. O mesmo vale quando o filho sai e deixa um neto vivo no grupo: o neto não sobrevive ao
 * teste. Sai com 0 se o comando passou, 1 se caiu, `SAIDA_DO_PRAZO` se foi morto no prazo ou por sinal, e 127 se o
 * programa nem abriu. Não é exportado: só roda como processo, pelo `rodarCalado`.
 */
function supervisionar(comando: string[], prazoMs: number, esperaMs: number): Promise<number> {
  return new Promise((resolver) => {
    const [programa = '', ...argumentos] = comando
    // O pgid do grupo do teste só existe depois do `spawn`; os tratadores de sinal, registrados antes dele, o leem quando rodam.
    const grupo: { id?: number | undefined } = {}
    let estourou = false
    /** SIGTERM ao grupo e, passada a espera, SIGKILL: o fim do grupo, e não só o do filho (o `sh` que sai deixa o neto, que ignora o SIGTERM). */
    const acabarOGrupo = (): Promise<void> =>
      new Promise((acabou) => {
        const dono = grupo.id
        if (dono === undefined || !sinalAoGrupo(dono, 0)) return acabou()
        sinalAoGrupo(dono, 'SIGTERM')
        const limite = Date.now() + esperaMs
        const espiar = setInterval(() => {
          const vivo = sinalAoGrupo(dono, 0)
          if (vivo && Date.now() < limite) return
          clearInterval(espiar)
          sinalAoGrupo(dono, 'SIGKILL')
          acabou()
        }, 25)
      })
    const terminar = (): void => {
      // O prazo e um sinal podem chegar os dois: uma vez só, senão cada chamada abre outro `setInterval`.
      if (estourou) return
      estourou = true
      void acabarOGrupo().then(() => resolver(SAIDA_DO_PRAZO))
    }
    // Ctrl-C no portão não alcança o grupo do teste (outra sessão): o supervisor o leva junto. Os tratadores existem **antes** do
    // filho: com o `process.on` depois do `spawn`, um sinal que chegasse entre os dois (máquina carregada) matava o supervisor sem
    // tratador e deixava o grupo vivo.
    for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sinal, terminar)
    const filho = spawn(programa, argumentos, { stdio: 'ignore', detached: true })
    grupo.id = filho.pid
    if (grupo.id === undefined) {
      filho.on('error', () => resolver(127))
      return
    }
    setTimeout(terminar, prazoMs)
    filho.on('close', (codigo) => {
      if (estourou) return
      // O filho saiu, mas o grupo pode ter ficado com um neto: sem o fim dele, o neto segura o `flock` da fila de carga.
      void acabarOGrupo().then(() => resolver(codigo === 0 ? 0 : 1))
    })
  })
}

/**
 * Devolve a fonte que a mutada alterou: escreve a original (guardada pelo `rodarCalado`) sobre o arquivo e apaga a cópia. É um
 * `writeFileSync` sobre o arquivo que já existe, e não um `copyFileSync`: este aplica ao destino o modo da cópia (0644) e tiraria
 * o bit de execução do hook de shell que o portão muta.
 */
function restaurarOArquivo(destino: string, origem: string): void {
  try {
    writeFileSync(destino, readFileSync(origem))
  } finally {
    rmSync(origem, { force: true })
  }
}

/**
 * A cópia do supervisor que as corridas executam. O portão muta `mutacoes.ts` e roda o teste: se o supervisor fosse o
 * arquivo vivo, uma mutação dentro dele mudaria o supervisor que mede o teste dela, e o vermelho dela poderia voltar verde.
 * A cópia leva o fonte de quando o `Rodar` nasce (antes de qualquer mutação), num arquivo que o conteúdo nomeia.
 *
 * Restrição: a cópia roda fora desta pasta, e por isso este arquivo só pode importar módulos `node:`. Um import relativo
 * novo quebra toda corrida (o supervisor não abre), e o portão leria isso como "o teste não passa limpo".
 */
function copiaDoSupervisor(): string {
  const fonte = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const copia = join(tmpdir(), `educa-supervisor-${createHash('sha256').update(fonte).digest('hex').slice(0, 16)}.ts`)
  const provisorio = `${copia}.${String(process.pid)}`
  writeFileSync(provisorio, fonte)
  renameSync(provisorio, copia)
  return copia
}

/** Quem lê o relatório: o formato do Vitest (`--reporter=json`) e o do Playwright (repórter `json`). */
export type LeitorDoRelatorio = 'vitest' | 'playwright'

/**
 * A variável que o `playwright.config.ts` lê para gravar o relatório `json` (`VARIAVEL_DO_RELATORIO_DO_E2E`, em
 * `tools/ci/duracao-do-e2e.ts`). Repetida aqui porque este arquivo só pode importar módulos `node:` (ver `copiaDoSupervisor`);
 * `mutacoes.test.ts` prova que as duas são a mesma.
 */
const VARIAVEL_DO_RELATORIO_DO_PLAYWRIGHT = 'EDUCA_RELATORIO_DO_E2E'

export interface RelatorioPreparado {
  /** O comando que roda, já com o que grava o relatório. */
  comando: string[]
  /** O que a corrida acrescenta ao ambiente do teste. */
  env: Record<string, string>
  leitor: LeitorDoRelatorio
}

/**
 * O que cada tipo de corrida recebe para gravar o relatório em `arquivo`. O Vitest ganha o repórter `json` na linha de comando
 * (a saída da corrida é descartada, então trocar o repórter dele não tira nada de ninguém); o Playwright, que perderia a lista
 * se o repórter fosse trocado, grava pela variável que a configuração dele já lê. `null`: comando que não é de teste do
 * repositório, e então vale o código de saída.
 *
 * O relatório do Vitest guarda o nome de cada caso e a mensagem de cada asserção que falhou. Só dado sintético entra nos testes
 * (regra 20, item 17), e é isso que o mantém inofensivo; a pasta temporária de `rodarCalado`, apagada no fim da corrida, existe
 * também para esse conteúdo não ficar no disco depois dela. O que o portão mostra no terminal a partir dele (`falhaNaLinhaCerta`) é a linha
 * do código do arquivo de teste e o número dela, e nunca a mensagem da asserção: `failureMessages` traz valores de fixture, e quem mexer no
 * motivo não deve passar a mostrá-los (regra 20, itens 9 e 17).
 */
export function prepararRelatorio(comando: string[], arquivo: string): RelatorioPreparado | null {
  const [programa, segundo] = comando
  if (programa === 'npx' && segundo === 'vitest') return { comando: [...comando, '--reporter=json', `--outputFile=${arquivo}`], env: {}, leitor: 'vitest' }
  const playwright = (programa === 'npx' && segundo === 'playwright') || (programa === 'node' && segundo === 'tools/ci/e2e.ts')
  return playwright ? { comando, env: { [VARIAVEL_DO_RELATORIO_DO_PLAYWRIGHT]: arquivo }, leitor: 'playwright' } : null
}

/** O número que está no caminho do JSON, ou 0 se o caminho não existe ou não termina num número. */
function contagemNoJson(relatorio: unknown, ...caminho: string[]): number {
  let atual = relatorio
  for (const chave of caminho) {
    if (typeof atual !== 'object' || atual === null) return 0
    atual = (atual as Record<string, unknown>)[chave]
  }
  return typeof atual === 'number' ? atual : 0
}

/**
 * O relatório mostra ao menos um caso que rodou e falhou? É o que separa o vermelho que prova a cláusula do que só mostra que
 * o arquivo não carregou: no Vitest, `numFailedTests` (a sintaxe e o módulo que falta deixam 0, com `numFailedTestSuites` 1); no
 * Playwright, `stats.unexpected` (a sintaxe deixa 0, com `errors` preenchido). Relatório ausente, ilegível ou de outra forma
 * não prova nada.
 */
export function casoFalhouNoRelatorio(leitor: LeitorDoRelatorio, texto: string | null): boolean {
  if (texto === null) return false
  let relatorio: unknown
  try {
    relatorio = JSON.parse(texto)
  } catch {
    return false
  }
  return (leitor === 'vitest' ? contagemNoJson(relatorio, 'numFailedTests') : contagemNoJson(relatorio, 'stats', 'unexpected')) > 0
}

/** Os campos de um objeto do JSON, ou `null` se o valor não é objeto. */
function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}

/** A linha do primeiro frame do arquivo de teste num texto de pilha (`…/arquivo:linha:coluna`). */
function linhaNaPilha(pilha: string, teste: string): number | null {
  const frame = new RegExp(`(?:^|[\\s(/\\\\])${escapar(teste.replaceAll('\\', '/'))}:(\\d+):\\d+`).exec(pilha.replaceAll('\\', '/'))
  return frame ? Number(frame[1]) : null
}

/** Os casos que falharam no Vitest, cada um com a linha do arquivo de teste em que caiu (`null`: a pilha não tem frame dele). */
function linhasDoVitest(relatorio: unknown, teste: string): (number | null)[] {
  const linhas: (number | null)[] = []
  for (const arquivo of lista(objeto(relatorio)?.testResults)) {
    for (const caso of lista(objeto(arquivo)?.assertionResults)) {
      const dados = objeto(caso)
      if (dados?.status !== 'failed') continue
      const pilhas = lista(dados.failureMessages).filter((texto): texto is string => typeof texto === 'string')
      linhas.push(pilhas.map((pilha) => linhaNaPilha(pilha, teste)).find((linha) => linha !== null) ?? null)
    }
  }
  return linhas
}

/**
 * O erro do Playwright cai no arquivo de teste se `location.file` é ele, absoluto ou relativo ao `testDir`. Limite conhecido: o relativo só é
 * comparado pelo fim do caminho, e um apoio de mesmo nome de arquivo noutra pasta do `testDir` também passaria; é improvável, e apertar
 * a comparação muda o comportamento (`TODO.md`).
 */
function ehOArquivo(file: unknown, teste: string): boolean {
  if (typeof file !== 'string') return false
  const alvo = teste.replaceAll('\\', '/')
  const achado = file.replaceAll('\\', '/')
  return achado === alvo || achado.endsWith(`/${alvo}`) || alvo.endsWith(`/${achado}`)
}

/** Os resultados de caso que falharam, em qualquer profundidade das suites do relatório do Playwright. */
function resultadosFalhos(suite: unknown): Record<string, unknown>[] {
  const dados = objeto(suite)
  const daqui = lista(dados?.specs)
    .flatMap((especificacao) => lista(objeto(especificacao)?.tests))
    .flatMap((execucao) => lista(objeto(execucao)?.results))
    .map(objeto)
    .filter((resultado): resultado is Record<string, unknown> => resultado?.status === 'failed' || resultado?.status === 'timedOut')
  return [...lista(dados?.suites).flatMap(resultadosFalhos), ...daqui]
}

/** A linha do arquivo de teste num erro do Playwright: `location`, ou a pilha se o erro foi lançado num apoio. */
function linhaDoErro(resultado: Record<string, unknown>, teste: string): number | null {
  const erro = objeto(lista(resultado.errors)[0] ?? resultado.error)
  const local = objeto(erro?.location)
  if (ehOArquivo(local?.file, teste) && typeof local?.line === 'number') return local.line
  const pilha = [erro?.stack, erro?.message].find((texto): texto is string => typeof texto === 'string')
  return pilha === undefined ? null : linhaNaPilha(pilha, teste)
}

/** Os casos que falharam no Playwright, cada um com a linha do arquivo de teste (`null`: nem `location` nem a pilha a dão). */
function linhasDoPlaywright(relatorio: unknown, teste: string): (number | null)[] {
  return resultadosFalhos(relatorio).map((resultado) => linhaDoErro(resultado, teste))
}

/**
 * A linha `falha:` do bloco confere com o relatório? `null`: ao menos um caso vermelho caiu numa linha do arquivo de teste que tem o
 * `trecho`. Senão, o motivo, com a linha que caiu e o texto dela. Basta um caso: `-t` pode pegar mais de um, e o que caiu na linha
 * certa prova a cláusula. Relatório que não se lê, ou pilha sem frame do arquivo de teste, não prova a linha e também é motivo.
 */
export function falhaNaLinhaCerta(leitor: LeitorDoRelatorio, texto: string | null, fonteDoTeste: string, teste: string, trecho: string): string | null {
  let relatorio: unknown
  try {
    relatorio = JSON.parse(texto ?? '')
  } catch {
    return 'o relatório da corrida não se lê, e a linha em que o caso caiu não se sabe'
  }
  const linhas = leitor === 'vitest' ? linhasDoVitest(relatorio, teste) : linhasDoPlaywright(relatorio, teste)
  const fonte = fonteDoTeste.split('\n')
  if (linhas.some((linha) => linha !== null && (fonte[linha - 1] ?? '').includes(trecho))) return null
  const primeira = linhas.find((linha) => linha !== null)
  if (primeira === undefined) return `não achei no relatório a linha de ${teste} em que o caso caiu`
  return `o caso caiu na linha ${String(primeira)} de ${teste} (\`${(fonte[primeira - 1] ?? '').trim()}\`)`
}

/** O que a corrida diz, dado o código de saída do supervisor e o relatório que o teste gravou (se gravou). */
function veredictoDaCorrida(status: number | null, relatorio: RelatorioPreparado | null, arquivo: string, raiz: string, falha?: FalhaEsperada): ReturnType<Rodar> {
  if (status === SAIDA_DO_PRAZO) return 'estourou'
  if (status === 0) return true
  if (relatorio === null) return false
  const texto = existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : null
  if (!casoFalhouNoRelatorio(relatorio.leitor, texto)) return 'carga'
  if (!falha) return false
  // Limite conhecido: a fonte do teste é lida depois da corrida; se o `arquivo:` do bloco for o próprio arquivo de teste, as linhas são as da mutada.
  const outra = falhaNaLinhaCerta(relatorio.leitor, texto, readFileSync(resolve(raiz, falha.teste), 'utf8'), falha.teste, falha.trecho)
  return outra === null ? false : { outra }
}

/**
 * Roda o comando calado: a saída de dezenas de corridas esconderia a linha que importa. Cada corrida é um supervisor
 * (a cópia deste arquivo, chamada com `--supervisionar-corrida`) que dá ao teste o grupo de processo e o prazo.
 *
 * O teste que sai com erro tem o relatório lido: se nenhum caso falhou nele, a corrida devolve `'carga'`, e não `false`.
 * `preparar` é injetado só pelo teste, que não tem Vitest nem Playwright para chamar.
 */
export function rodarCalado(
  raiz: string,
  opcoes: { esperaAteSigkillMs?: number; preparar?: (comando: string[], arquivo: string) => RelatorioPreparado | null } = {},
): Rodar {
  const supervisor = copiaDoSupervisor()
  return (comando, prazoMs = TETO_DA_CORRIDA_MS, restaurar, falha) => {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-corrida-'))
    try {
      const arquivo = join(pasta, 'relatorio.json')
      const relatorio = (opcoes.preparar ?? prepararRelatorio)(comando, arquivo)
      // A original vai para a pasta da corrida, e o supervisor a devolve ao arquivo quando o grupo do teste acaba.
      const copiaDaOriginal = join(pasta, 'original')
      if (restaurar) writeFileSync(copiaDaOriginal, restaurar.original)
      const aRestaurar = restaurar ? ['--restaurar', restaurar.arquivo, copiaDaOriginal] : []
      const resultado = spawnSync(
        process.execPath,
        [...process.execArgv, supervisor, MARCA_DO_SUPERVISOR, String(prazoMs), String(opcoes.esperaAteSigkillMs ?? ESPERA_ATE_SIGKILL_MS), ...aRestaurar, '--', ...(relatorio?.comando ?? comando)],
        { cwd: raiz, stdio: 'ignore', env: { ...process.env, ...relatorio?.env, EDUCA_BANCO_NOVO: undefined } },
      )
      return veredictoDaCorrida(resultado.status, relatorio, arquivo, raiz, falha)
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  }
}

export interface CarimboDasMutacoes {
  documento: string
  impressao: string
  total: number
}

/**
 * O e2e roda contra imagens construídas: a última mutação de tela deixou no ar a web mutada. Reconstrói do fonte
 * restaurado, com o teste dela verde, para a vitrine e a Mesa fotografarem a tela de verdade. `null`: não há o que
 * reconstruir, ou reconstruiu. Só `true` é reconstrução: a que passou do teto (`'estourou'`) e a que caiu deixam a web
 * mutada no ar, e o portão fica vermelho.
 */
export function reconstruirDepoisDasMutacoes(mutacoes: readonly Mutacao[], rodar: Rodar): string | null {
  const ultima = mutacoes.filter(pedeReconstrucao).at(-1)
  const comando = ultima ? comandoDoTeste(ultima) : null
  if (comando === null) return null
  const corrida = rodar(comando)
  if (corrida === true) return null
  return corrida === 'estourou' ? `a web não reconstruiu depois das mutações: a corrida passou do teto de ${TETO_EM_TEXTO}` : 'a web não reconstruiu depois das mutações'
}

/** O que o portão da tarefa faz com as mutações do documento: o carimbo (ausente se o documento não tem bloco), ou o motivo do vermelho. */
export type ConferenciaDoDocumento = { carimbo?: CarimboDasMutacoes } | { vermelho: string }

export function conferirMutacoesDoDocumento(
  raiz: string,
  documento: string,
  conteudo: string,
  rodar: Rodar,
  avisar: (texto: string) => void,
  opcoes: OpcoesDaConferencia = {},
): ConferenciaDoDocumento {
  const { mutacoes, erros } = lerMutacoes(conteudo)
  if (erros.length > 0) return { vermelho: erros.join('; ') }
  if (mutacoes.length === 0) return {}
  avisar(`\n▶ mutações de ${documento} (${String(mutacoes.length)})\n`)
  const resultados = conferirMutacoes(raiz, mutacoes, rodar, avisar, opcoes)
  // A web volta ao fonte restaurado mesmo quando alguma mutação reprovou.
  const reconstrucao = reconstruirDepoisDasMutacoes(mutacoes, rodar)
  const falhas = resultados.filter((resultado) => resultado.veredito !== 'vermelho')
  if (falhas.length > 0) return { vermelho: `${String(falhas.length)} de ${String(mutacoes.length)} mutações não deixaram o teste vermelho ou foram recusadas` }
  if (reconstrucao !== null) return { vermelho: reconstrucao }
  return { carimbo: { documento, impressao: impressaoDasMutacoes(mutacoes), total: mutacoes.length } }
}

/**
 * O que o commit e a Mesa perguntam: as mutações deste documento, como estão escritas agora, foram conferidas pelo
 * último portão? Documento sem bloco nenhum só é cobrado quando a árvore altera código de produto (RF17): aí ele precisa
 * dos blocos ou da linha `**Sem mutação:** <motivo>`, e o carimbo tem de ser do portão deste documento.
 *
 * `alterados` é a lista de arquivos alterados da árvore do commit (`arquivosAlterados`), obrigatória de propósito: sem ela
 * a exigência do RF17 não teria de onde saber se há produção.
 */
export function avaliarMutacoes(
  carimbo: { documento?: string; mutacoes?: CarimboDasMutacoes } | null,
  documento: string,
  conteudo: string,
  alterados: readonly string[],
): string | null {
  const { mutacoes, erros } = lerMutacoes(conteudo)
  const comando = `node tools/processo/portao-local.ts --tarefa ${documento}`
  if (erros.length > 0) return `portão local: ${erros.join('; ')}. Corrija o bloco e rode \`${comando}\`.`
  if (mutacoes.length === 0) return avaliarSemBloco(carimbo?.documento, documento, conteudo, alterados, comando)
  const conferidas = carimbo?.mutacoes
  if (!conferidas || conferidas.documento !== documento) {
    return `portão local: as ${String(mutacoes.length)} mutações de ${documento} não foram conferidas pelo último portão. Rode \`${comando}\`.`
  }
  if (conferidas.impressao !== impressaoDasMutacoes(mutacoes)) {
    return `portão local: a seção "Mutações" de ${documento} mudou depois do último portão. Rode \`${comando}\` de novo.`
  }
  return null
}

/**
 * O documento sem bloco: só é cobrado com produção alterada (RF17), e então precisa da linha `Sem mutação` com motivo e do
 * carimbo do portão deste documento (`documentoDoCarimbo`), porque sem bloco o carimbo não traz mais nada que diga de quem é.
 */
function avaliarSemBloco(documentoDoCarimbo: string | undefined, documento: string, conteudo: string, alterados: readonly string[], comando: string): string | null {
  const exigencia = exigenciaDeMutacao(alterados, conteudo)
  if (exigencia !== null) return `portão local: ${exigencia}`
  if (!alterados.some(ehArquivoDeProducao) || documentoDoCarimbo === documento) return null
  return `portão local: o último portão não foi o de ${documento}: a linha "Sem mutação:" só vale com o portão deste documento. Rode \`${comando}\`.`
}

// ─── Produção sem mutação (RF17) e cláusula sem bloco (RF5) ───

/**
 * Produção é o arquivo de `apps/<pacote>/src/**` ou `packages/<pacote>/src/**` que não é teste nem `.d.ts`: é o que o
 * usuário executa, e por isso cada cláusula dele precisa de quem a prove. Teste é o que a convenção do repositório chama
 * de teste: `*.test.ts(x)`, `*.spec.ts`, `__fixtures__/` e `test/`. `apps/web/vite.config.ts` fica fora: não está em `src`.
 */
export function ehArquivoDeProducao(arquivo: string): boolean {
  if (!/^(?:apps|packages)\/[^/]+\/src\//.test(arquivo)) return false
  if (/\.d\.ts$/.test(arquivo)) return false
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(arquivo)) return false
  return !/(?:^|\/)(?:test|tests|__tests__|__fixtures__)\//.test(arquivo)
}

/**
 * O que o `--faltando` lê: a produção (`ehArquivoDeProducao`) e o código de `tools/` (script, guarda, ferramenta do
 * processo), que a produção não cobre. Fora, em `tools/`: o que não é código (documento, dado, gancho sem extensão, em que
 * `?` e `&&` de texto corrido passariam por condição), teste, `.d.ts` e as pastas `test/`, `tests/`, `__tests__/`,
 * `__fixtures__/` e `fixtures/`. Só o `--faltando` e o relatório do portão usam: o RF17 (`exigenciaDeMutacao`) segue só com
 * a produção.
 */
export function ehArquivoDoFaltando(arquivo: string): boolean {
  if (ehArquivoDeProducao(arquivo)) return true
  if (!/^tools\/.+\.[cm]?[jt]sx?$/.test(arquivo)) return false
  if (/\.d\.ts$/.test(arquivo)) return false
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(arquivo)) return false
  return !/(?:^|\/)(?:test|tests|__tests__|__fixtures__|fixtures)\//.test(arquivo)
}

/**
 * A linha `**Sem mutação:** <motivo>` do documento: `motivo` (há uma com motivo), `vazia` (há, sem motivo, ou só o
 * `<motivo>` do modelo) ou `ausente`. A linha existe para a tarefa de produção que não tem cláusula a provar (tipo,
 * renomeação, texto), e o motivo é o que o revisor lê para discordar.
 */
export function semMutacaoDeclarada(conteudo: string): 'motivo' | 'vazia' | 'ausente' {
  const linhas = [...conteudo.matchAll(/^\*\*Sem mutação:\*\*[ \t]*(.*?)[ \t]*$/gm)].map((achado) => achado[1] ?? '')
  if (linhas.length === 0) return 'ausente'
  return linhas.some((motivo) => motivo !== '' && !/^<[^>]*>$/.test(motivo)) ? 'motivo' : 'vazia'
}

/**
 * O que o RF17 recusa: a árvore altera produção e o documento não tem bloco de mutação nem a linha `Sem mutação` com
 * motivo. `conteudo` nulo é o documento que não se achou. `null`: não exige, ou está atendido.
 */
export function exigenciaDeMutacao(alterados: readonly string[], conteudo: string | null): string | null {
  const producao = alterados.filter(ehArquivoDeProducao)
  if (producao.length === 0) return null
  const quais = `${producao.slice(0, 3).join(', ')}${producao.length > 3 ? ', …' : ''}`
  if (conteudo === null) {
    return `a árvore altera código de produto (${quais}) e não achei o documento da tarefa entre os alterados. Passe-o: \`node tools/processo/portao-local.ts --tarefa <documento>\`.`
  }
  if (lerMutacoes(conteudo).mutacoes.length > 0) return null
  const declarada = semMutacaoDeclarada(conteudo)
  if (declarada === 'motivo') return null
  const falta = declarada === 'vazia' ? 'a linha "**Sem mutação:**" está sem motivo' : 'não há bloco de mutação nem a linha "**Sem mutação:** <motivo>"'
  return `a árvore altera código de produto (${quais}) e no documento ${falta}. Cada cláusula nova ganha um bloco; só quando não há cláusula a provar (tipo, renomeação, texto) vale a linha, com o motivo.`
}

/**
 * O documento que o portão da tarefa confere quando ninguém o diz: o único documento de tarefa ou de correção alterado na
 * árvore. Achá-lo pela alteração, e não por ter bloco, é o que faz a tarefa de produção sem bloco ser cobrada no documento
 * dela, e não ficar fora da conferência. Com mais de um alterado não se escolhe: quem roda diz qual.
 */
export function documentoDaTarefa(alterados: readonly string[]): string | null {
  const candidatos = alterados.filter((arquivo) => /^tasks\/(?:prd-[^/]+\/\d+_task|correcoes\/[^/]+)\.md$/.test(arquivo))
  return candidatos.length === 1 ? (candidatos[0] ?? null) : null
}

export interface LinhaNova {
  arquivo: string
  linha: number
  texto: string
}

/** As linhas que um `git diff -U0` acrescenta, com o arquivo e o número delas no arquivo novo. Arquivo apagado não tem linha nova. */
export function linhasAcrescentadas(diff: string): LinhaNova[] {
  const linhas: LinhaNova[] = []
  let arquivo: string | null = null
  let numero = 0
  let noTrecho = false
  for (const linha of diff.split('\n')) {
    if (linha.startsWith('diff --git ')) {
      noTrecho = false
      // O git põe entre aspas o nome com acento (`+++ "b/…"`), que não casa com o cabeçalho abaixo: sem zerar, as linhas do
      // arquivo seguinte ficariam no anterior.
      arquivo = null
      continue
    }
    if (!noTrecho) {
      const novo = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(linha)
      if (novo) arquivo = novo[1] ?? null
    }
    const cabecalho = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(linha)
    if (cabecalho) {
      noTrecho = true
      numero = Number(cabecalho[1])
      continue
    }
    if (noTrecho && arquivo !== null && linha.startsWith('+')) {
      linhas.push({ arquivo, linha: numero, texto: linha.slice(1) })
      numero += 1
    }
  }
  return linhas
}

/** O texto da linha sem o que está entre aspas e sem o comentário do fim: `'a && b'` e `// se x ? y` não são condição. */
function semTextoLiteral(linha: string): string {
  return linha
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
    .replace(/\s\/\/.*$/, '')
}

/** A expressão regular escrita no código: depois de `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;` ou `return`, ou `new RegExp(`. */
const EXPRESSAO_REGULAR = /(?:^|[(,=:[!&|?{};]|\breturn\b)\s*\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*|\bnew RegExp\(/

/** Os operadores de condição, com o jeito de achar cada um: no texto sem aspas nem comentário do fim, ou no texto inteiro (a expressão regular). */
const OPERADORES_DE_CONDICAO: readonly { nome: string; acha: (codigo: string, inteiro: string) => boolean }[] = [
  { nome: 'if', acha: (codigo) => /\bif\s*\(/.test(codigo) },
  { nome: '&&', acha: (codigo) => codigo.includes('&&') },
  { nome: '||', acha: (codigo) => codigo.includes('||') },
  { nome: '??', acha: (codigo) => codigo.includes('??') },
  { nome: '?:', acha: (codigo) => /(?:^|\s)\?(?=\s|$)/.test(codigo) },
  { nome: 'case', acha: (codigo) => /^case\b/.test(codigo) },
  { nome: '.where(', acha: (codigo) => codigo.includes('.where(') },
  { nome: 'regex', acha: (_codigo, inteiro) => EXPRESSAO_REGULAR.test(inteiro) },
]

/** Os operadores de condição que a linha tem: `if`, `&&`, `||`, `??`, ternário de valor, `case`, `.where(` e expressão regular. */
export function condicoesDaLinha(texto: string): string[] {
  const aparada = texto.trim()
  if (/^(?:\/\/|\/\*|\*)/.test(aparada)) return []
  const codigo = semTextoLiteral(aparada)
  return OPERADORES_DE_CONDICAO.filter((operador) => operador.acha(codigo, aparada)).map((operador) => operador.nome)
}

export interface LinhaSemBloco extends LinhaNova {
  condicoes: string[]
}

/**
 * As linhas acrescentadas em produção com condição que nenhum bloco alcança. Alcançar é um bloco do **mesmo arquivo**
 * citar o texto da linha (trecho que sai, troca ou serve de contexto): o `.where(and(` do exemplo do `executar-task` é
 * contexto, e é ele que localiza a cláusula que sai.
 */
export function linhasSemBloco(novas: readonly LinhaNova[], mutacoes: readonly Mutacao[]): LinhaSemBloco[] {
  const citadas = new Map<string, Set<string>>()
  for (const mutacao of mutacoes) {
    const doArquivo = citadas.get(mutacao.arquivo) ?? new Set<string>()
    for (const linha of mutacao.antes) doArquivo.add(linha)
    citadas.set(mutacao.arquivo, doArquivo)
  }
  return novas
    .filter((nova) => ehArquivoDoFaltando(nova.arquivo))
    .map((nova) => ({ ...nova, condicoes: condicoesDaLinha(nova.texto) }))
    .filter((nova) => nova.condicoes.length > 0 && !citadas.get(nova.arquivo)?.has(nova.texto.trim()))
    .sort((a, b) => (a.arquivo === b.arquivo ? a.linha - b.linha : a.arquivo < b.arquivo ? -1 : 1))
}

/** O que a árvore acrescentou em produção e em `tools/` em relação ao HEAD: o diff dos versionados e todas as linhas dos arquivos novos. */
export function linhasNovasDaArvore(raiz: string): LinhaNova[] {
  const git = (...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const novas = linhasAcrescentadas(git('diff', '-U0', '--no-color', '--no-ext-diff', '--no-renames', 'HEAD', '--', 'apps', 'packages', 'tools'))
  for (const arquivo of git('ls-files', '--others', '--exclude-standard', '-z', '--', 'apps', 'packages', 'tools').split('\0')) {
    if (arquivo === '') continue
    const linhas = readFileSync(join(raiz, arquivo), 'utf8').split('\n')
    if (linhas.at(-1) === '') linhas.pop()
    linhas.forEach((texto, indice) => novas.push({ arquivo, linha: indice + 1, texto }))
  }
  return novas.filter((nova) => ehArquivoDoFaltando(nova.arquivo))
}

/** O texto do `--faltando`: a lista, ou a frase de que não falta nada. Só informa: quem decide é o `test-engineer`. */
export function relatorioDoFaltando(faltando: readonly LinhaSemBloco[], documento: string): string {
  if (faltando.length === 0) return `Nenhuma linha nova de produção com condição fica sem bloco em ${documento}.\n`
  const linhas = faltando.map((nova) => `  ${nova.arquivo}:${String(nova.linha)}  [${nova.condicoes.join(' ')}]  ${nova.texto.trim()}`)
  return `Linhas novas de produção com condição que nenhum bloco de ${documento} alcança (${String(faltando.length)}):\n${linhas.join('\n')}\n`
}

// Chamado como supervisor (`rodarCalado`), este arquivo não é módulo: roda o comando e sai com o código da corrida.
if (process.argv[2] === MARCA_DO_SUPERVISOR) {
  // prazo, espera, [`--restaurar` destino origem], `--`, e o comando.
  const argumentosDoSupervisor = process.argv.slice(3)
  const separador = argumentosDoSupervisor.indexOf('--')
  const [prazo = '0', espera = '0', ...opcoes] = argumentosDoSupervisor.slice(0, separador)
  const comando = argumentosDoSupervisor.slice(separador + 1)
  const codigo = await supervisionar(comando, Number(prazo), Number(espera))
  // Com o grupo do teste já acabado: o teste não lê mais a fonte, e o portão (vivo ou morto por Ctrl-C) a encontra como era.
  if (opcoes[0] === '--restaurar') restaurarOArquivo(opcoes[1] ?? '', opcoes[2] ?? '')
  process.exit(codigo)
}

// `node tools/processo/mutacoes.ts --faltando <documento>`: só imprime, e sai 0 também quando a lista não vem.
if (process.argv[2] === '--faltando' && resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const documento = process.argv[3]
  if (!documento) {
    process.stderr.write('uso: node tools/processo/mutacoes.ts --faltando <tasks/.../documento.md>\n')
    process.exit(2)
  }
  const raizDaArvore = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd()
  try {
    process.stdout.write(relatorioDoFaltando(linhasSemBloco(linhasNovasDaArvore(raizDaArvore), lerMutacoes(readFileSync(join(raizDaArvore, documento), 'utf8')).mutacoes), documento))
  } catch (erro) {
    process.stdout.write(`não foi possível listar as linhas sem bloco (${(erro as Error).message})\n`)
  }
}
