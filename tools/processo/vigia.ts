// O filtro da vigia: diz ao Orquestrador se há o que olhar (D79, revista em 11/10/2026).
//
//   node tools/processo/vigia.ts        imprime `/vigia` quando há o que olhar, e nada quando não há
//
// Foi o `--pre-run` da rotina, cujo comando era `{{output}}`. No Maestri do Windows (05/11/2026) o `--pre-run` não roda,
// e o filtro passou a ser o primeiro passo da skill da vigia: com a saída vazia, ela responde em uma linha, sem reler o
// estado nem os terminais. No F3, 96 de 100 vigias acordaram para responder "nada a fazer". Na dúvida, imprime: erro ao
// falar com o Maestri, terminal que não se reconhece ou tela que não se lê imprimem `/vigia`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Os terminais do time, com o número da linha quando há mais de uma. Outro terminal ligado ao Orquestrador não conta. */
const TERMINAL_DO_TIME = /^(Arquiteto|Implementador|Mesa|Validador)( \d+)?$/

/** Os terminais do time entre os agentes ligados, como o `maestri list` os imprime. */
export function nomesDoTime(saidaDoList: string): string[] {
  const ligados = saidaDoList.slice(saidaDoList.indexOf('Connected agents:'))
  return [...ligados.matchAll(/^\s*- name: "([^"]+)"/gm)].map((achado) => achado[1] ?? '').filter((nome) => TERMINAL_DO_TIME.test(nome))
}

/**
 * O rodapé do Claude Code com comando em segundo plano: `⏵⏵ bypass permissions on · 1 shell · ↓ to manage`. É o portão que o
 * Implementador solta e espera: o turno acaba, e o aviso de fim acorda o terminal sozinho. Só o rodapé conta, e não o
 * `· 1 shell still running` que fica no histórico depois de o comando acabar (05/11/2026).
 */
const RODAPE_COM_COMANDO = /· \d+ shells? ·/

/** Quantas linhas do fim da tela são o rodapé: a caixa de entrada e a barra de baixo. */
const LINHAS_DO_RODAPE = 4

/** O Claude Code mostra "esc to interrupt" enquanto o turno corre, e o rodapé conta o comando que roda em segundo plano. */
export function estaTrabalhando(tela: string): boolean {
  const linhas = tela.trimEnd().split('\n')
  return (
    linhas.slice(-25).some((linha) => linha.includes('esc to interrupt')) ||
    linhas.slice(-LINHAS_DO_RODAPE).some((linha) => RODAPE_COM_COMANDO.test(linha))
  )
}

/** Quanto um terminal trabalha sem a vigia olhar: o prazo da tarefa pequena (`.claude/skills/vigia/SKILL.md`). */
export const SEM_OLHAR_MS = 2 * 60 * 60 * 1000

export interface Decisao {
  acordar: boolean
  motivo: string
  /** Desde quando cada terminal é visto trabalhando sem parar, em ISO: o que se grava para a próxima vez. */
  visto: Record<string, string>
}

export function decidir(telas: Readonly<Record<string, string>>, visto: Readonly<Record<string, string>>, agora: Date): Decisao {
  const trabalhando = Object.keys(telas).filter((nome) => estaTrabalhando(telas[nome] ?? ''))
  if (trabalhando.length === 0) return { acordar: true, motivo: Object.keys(telas).length === 0 ? 'nenhum terminal do time ligado' : 'ninguém trabalhando', visto: {} }
  const agoraVisto: Record<string, string> = {}
  const demorados: string[] = []
  for (const nome of trabalhando) {
    const desde = visto[nome] ?? agora.toISOString()
    const demorou = agora.getTime() - new Date(desde).getTime() >= SEM_OLHAR_MS
    if (demorou) demorados.push(nome)
    // Acordado por demora, o relógio recomeça: a vigia volta a olhar em duas horas, e não a cada meia hora.
    agoraVisto[nome] = demorou ? agora.toISOString() : desde
  }
  return demorados.length > 0
    ? { acordar: true, motivo: `${demorados.join(', ')} trabalha há duas horas sem a vigia olhar`, visto: agoraVisto }
    : { acordar: false, motivo: `${trabalhando.join(', ')} trabalhando`, visto: agoraVisto }
}

/** Quanto a limpeza do Orquestrador pode demorar depois de pedida: o `sleep 25` do comando, com folga larga. */
export const LIMPEZA_DEMORA_MS = 10 * 60 * 1000

/** `.processo/limpeza.json`: quando o Orquestrador pediu a limpeza do contexto dele e quando o início de sessão a viu feita (RF27). */
export interface Limpeza {
  pedida?: string
  feita?: string
}

/**
 * A rotina `Limpa o Orquestrador` pula o disparo se o terminal dele estiver ocupado, e ninguém vê. Pedida há mais de dez
 * minutos sem uma `feita` igual ou depois dela, a limpeza se perdeu. Data que não se lê conta como perdida: na dúvida, acorda.
 */
export function limpezaPerdida(limpeza: Limpeza, agora: Date): boolean {
  if (limpeza.pedida === undefined) return false
  const pedida = Date.parse(limpeza.pedida)
  if (Date.parse(limpeza.feita ?? '') >= pedida) return false
  return !(agora.getTime() - pedida <= LIMPEZA_DEMORA_MS)
}

/** Une a limpeza perdida à decisão da vigia: ela acorda o Orquestrador mesmo com o time trabalhando. */
export function comLimpeza(decisao: Decisao, limpeza: Limpeza, agora: Date): Decisao {
  if (!limpezaPerdida(limpeza, agora)) return decisao
  return { ...decisao, acordar: true, motivo: `a limpeza pedida às ${limpeza.pedida ?? ''} não aconteceu` }
}

/**
 * Une à decisão o conteúdo de `.processo/limpeza.json` como está no disco (`null`: não há arquivo). O que não é JSON, e o JSON
 * que não é um objeto (`null`, lista, texto, número), não diz se a limpeza aconteceu: acorda, com o motivo dito (M5 da retro da X7).
 */
export function comLimpezaDoArquivo(decisao: Decisao, conteudo: string | null, agora: Date): Decisao {
  if (conteudo === null) return decisao
  const ilegivel = (porque: string): Decisao => ({ ...decisao, acordar: true, motivo: `.processo/limpeza.json ${porque}: não dá para saber se a limpeza aconteceu` })
  let lido: unknown
  try {
    lido = JSON.parse(conteudo)
  } catch {
    return ilegivel('não é JSON')
  }
  if (typeof lido !== 'object' || lido === null || Array.isArray(lido)) return ilegivel('não é um objeto')
  return comLimpeza(decisao, lido as Limpeza, agora)
}

if (import.meta.filename === process.argv[1]) {
  const registro = join(import.meta.dirname, '..', '..', '.processo', 'vigia.json')
  const arquivoDaLimpeza = join(import.meta.dirname, '..', '..', '.processo', 'limpeza.json')
  const maestri = (...argumentos: string[]) => execFileSync('maestri', argumentos, { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] })
  let decisao: Decisao
  try {
    const telas = Object.fromEntries(nomesDoTime(maestri('list')).map((nome) => [nome, maestri('check', nome)]))
    const visto = existsSync(registro) ? (JSON.parse(readFileSync(registro, 'utf8')) as Record<string, string>) : {}
    const conteudoDaLimpeza = existsSync(arquivoDaLimpeza) ? readFileSync(arquivoDaLimpeza, 'utf8') : null
    const agora = new Date()
    decisao = comLimpezaDoArquivo(decidir(telas, visto, agora), conteudoDaLimpeza, agora)
    mkdirSync(dirname(registro), { recursive: true })
    writeFileSync(registro, `${JSON.stringify(decisao.visto, null, 2)}\n`)
  } catch {
    decisao = { acordar: true, motivo: 'não consegui ler o time', visto: {} }
  }
  process.stdout.write(decisao.acordar ? '/vigia\n' : '')
}
