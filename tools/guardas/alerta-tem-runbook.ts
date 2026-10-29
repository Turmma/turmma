import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { raizRepositorio } from '../ci/executar.ts'

/**
 * Guarda "alerta novo vem com runbook" (regra 80, item 10): toda regra provisionada em
 * `infra/grafana/alertas/` aponta, em `runbook_url`, para a entrada de `docs/runbook.md` com o mesmo
 * nome, e a entrada está escrita no formato do arquivo, citando a regra. Alerta sem entrada é alerta que
 * ninguém sabe tratar às 7h40 de uma segunda.
 */

export const PASTA_DOS_ALERTAS = 'infra/grafana/alertas'
export const CAMINHO_DO_RUNBOOK = 'docs/runbook.md'
/** O runbook no repositório: o Grafana mostra o link junto do alerta. */
export const ENDERECO_DO_RUNBOOK = 'https://github.com/Turmma/turmma/blob/main/docs/runbook.md#'
/** Os campos do formato de entrada do runbook, na ordem. */
export const CAMPOS_DA_ENTRADA = ['Dispara quando', 'Impacto', 'Primeiro olhar', 'Causas prováveis', 'Se nada disso resolver', 'Depois'] as const

export interface ArquivoDeAlerta {
  /** Caminho a partir da raiz do repositório. */
  caminho: string
  conteudo: string
}

export interface RegraDeAlerta {
  caminho: string
  uid: string
  titulo: string
  for: string
  runbookUrl: string
}

interface RegraNoArquivo {
  uid?: unknown
  title?: unknown
  for?: unknown
  annotations?: { runbook_url?: unknown }
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '')

/** As regras de um arquivo de provisionamento do Grafana (`groups[].rules[]`). */
export function regrasDoArquivo(arquivo: ArquivoDeAlerta): RegraDeAlerta[] {
  const documento = parse(arquivo.conteudo) as { groups?: Array<{ rules?: RegraNoArquivo[] }> } | null
  return (documento?.groups ?? []).flatMap((grupo) =>
    (grupo.rules ?? []).map((regra) => ({
      caminho: arquivo.caminho,
      uid: texto(regra.uid),
      titulo: texto(regra.title),
      for: texto(regra.for),
      runbookUrl: texto(regra.annotations?.runbook_url),
    })),
  )
}

/** A âncora que o GitHub dá a um título: minúsculo, sem pontuação, espaço vira hífen. */
export function ancoraDoTitulo(titulo: string): string {
  return titulo
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

/** As entradas `## <nome>` do runbook, pela âncora, com o texto até a próxima seção. */
export function entradasDoRunbook(runbook: string): Map<string, string> {
  const entradas = new Map<string, string>()
  const partes = runbook.split(/^## /m).slice(1)
  for (const parte of partes) {
    const [titulo = '', ...corpo] = parte.split('\n')
    entradas.set(ancoraDoTitulo(titulo), corpo.join('\n').split(/^---\s*$/m)[0] ?? '')
  }
  return entradas
}

/** O que falta para cada regra ter runbook. Lista vazia: toda regra tem a sua entrada. */
export function problemasDeRunbook(arquivos: readonly ArquivoDeAlerta[], runbook: string): string[] {
  const problemas: string[] = []
  const entradas = entradasDoRunbook(runbook)
  for (const arquivo of arquivos) {
    // O Grafana também provisiona regra de `.json`: arquivo que a guarda não lê não pode entrar na pasta.
    if (!/\.ya?ml$/.test(arquivo.caminho)) {
      problemas.push(`${arquivo.caminho}: a pasta de alertas só aceita regra em .yaml, que a guarda confere`)
      continue
    }
    const regras = regrasDoArquivo(arquivo)
    if (regras.length === 0) problemas.push(`${arquivo.caminho}: nenhuma regra no arquivo`)
    for (const regra of regras) {
      const nome = `${arquivo.caminho} (${regra.titulo || 'sem título'})`
      if (!regra.runbookUrl.startsWith(ENDERECO_DO_RUNBOOK)) {
        problemas.push(`${nome}: runbook_url precisa apontar para ${ENDERECO_DO_RUNBOOK}<entrada>`)
        continue
      }
      const ancora = regra.runbookUrl.slice(ENDERECO_DO_RUNBOOK.length)
      if (ancora !== ancoraDoTitulo(regra.titulo)) problemas.push(`${nome}: runbook_url aponta para #${ancora}, e a entrada precisa ter o nome da regra (#${ancoraDoTitulo(regra.titulo)})`)
      const entrada = entradas.get(ancora)
      if (entrada === undefined) {
        problemas.push(`${nome}: sem entrada "## ${regra.titulo}" em ${CAMINHO_DO_RUNBOOK}`)
        continue
      }
      if (/a preencher/i.test(entrada)) problemas.push(`${nome}: a entrada do runbook ainda está "a preencher"`)
      for (const campo of CAMPOS_DA_ENTRADA) {
        if (!new RegExp(`^(\\*\\*)?${campo}:`, 'm').test(entrada)) problemas.push(`${nome}: a entrada do runbook não tem "${campo}:"`)
      }
      if (!entrada.includes(arquivo.caminho)) problemas.push(`${nome}: a entrada do runbook não cita a regra (${arquivo.caminho})`)
    }
  }
  return problemas
}

/** Os arquivos da pasta de alertas versionada no repositório. */
export function arquivosDeAlertaDoRepositorio(): ArquivoDeAlerta[] {
  // Todo arquivo da pasta, e não só os .yaml: a pasta inteira é montada no provisionamento do Grafana.
  return readdirSync(join(raizRepositorio, PASTA_DOS_ALERTAS))
    .sort()
    .map((nome) => {
      const caminho = `${PASTA_DOS_ALERTAS}/${nome}`
      return { caminho, conteudo: readFileSync(join(raizRepositorio, caminho), 'utf8') }
    })
}
