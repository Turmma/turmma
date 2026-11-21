// O aviso do portão para a divergência que ficou só no documento da tarefa (M3 da retro da X7). O `executar-task` manda que
// o que diverge da Tech Spec entre também na `techspec.md` e no `cenarios.md`, antes dos revisores; sem isso o `revisor-geral`
// reprova a rodada. O portão não sabia ler isso: aqui ele passa a saber, e só informa, como o `--faltando`
// (`tools/processo/mutacoes.ts`): quem decide é o revisor. A conferência é por arquivo, e não por conteúdo: o silêncio não
// prova que a divergência chegou à spec. Ela lê a coluna "Onde está na spec" de cada linha nova e cobra **cada** arquivo `.md`
// que a coluna cita (a `techspec.md`, o `cenarios.md`, o documento da seção 11), e não "um dos dois mudou" (M1 da retro da F4b);
// com `arquivo:linha` (ou `arquivo:de-ate`) citado, cobra que o diff toque aquele trecho. A linha sem coluna (texto corrido) ou
// que não cita nenhum `.md` cai no critério antigo: um dos dois arquivos da spec mudou.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'

const TITULO_DA_SECAO = '## Divergências resolvidas nesta tarefa'

/** Os dois arquivos da spec, na pasta do documento da tarefa, onde a divergência também precisa estar. */
const ARQUIVOS_DA_SPEC = ['techspec.md', 'cenarios.md']

/** Linha da seção que é divergência: não é o cabeçalho da tabela, o separador, o comentário, a linha em branco nem o "nenhuma". */
function ehDivergencia(linha: string): boolean {
  if (linha === '' || linha.startsWith('<!--') || /^[|\s:-]+$/.test(linha)) return false
  const semBarras = linha.replace(/^[|\s*]+/, '')
  if (/^Diverg[êe]ncia\s*\|/.test(semBarras)) return false
  if (/^nenhuma\b/i.test(semBarras)) return false
  return true
}

/** As linhas de divergência da seção, sem o recuo: do título até o próximo `## `. Texto ausente ou sem a seção não tem nenhuma. */
function linhasDaSecao(texto: string | null): string[] {
  if (texto === null) return []
  const linhas = texto.split('\n')
  const inicio = linhas.findIndex((linha) => linha.trim() === TITULO_DA_SECAO)
  if (inicio === -1) return []
  const fim = linhas.findIndex((linha, indice) => indice > inicio && linha.startsWith('## '))
  return linhas
    .slice(inicio + 1, fim === -1 ? undefined : fim)
    .map((linha) => linha.trim())
    .filter(ehDivergencia)
}

/** As linhas da seção que o texto de agora tem e o do HEAD (`null` se o documento é novo) não tinha. */
export function divergenciasNovas(antes: string | null, depois: string): string[] {
  const jaTinha = new Set(linhasDaSecao(antes))
  return linhasDaSecao(depois).filter((linha) => !jaTinha.has(linha))
}

/** Um arquivo que a coluna "Onde está na spec" cita, com a linha (ou o intervalo) quando ela diz `arquivo:linha` ou `arquivo:de-ate`. */
export interface Citacao {
  arquivo: string
  de?: number
  ate?: number
}

/** Diz se o diff do arquivo (contra o HEAD) toca alguma linha de `de` a `ate`, contadas no arquivo de agora. */
export type TocouOTrecho = (arquivo: string, de: number, ate: number) => boolean

/**
 * Um `.md` com ou sem caminho, e a linha ou o intervalo depois dos dois pontos. O `(?<![\w./-])` impede o nome de começar no meio de outro: a captura
 * não abre numa `/`, e sem o lookbehind ela recomeçaria logo depois dela, e o que é URL (`https://host/x/a.md`), caminho absoluto (`/home/u/a.md`),
 * `foo//x.md`, placeholder (`<spec>/cenarios.md`) ou glob (com `*` antes da barra) viraria arquivo da raiz que nunca está entre os alterados. O
 * `(?![\w])` deixa de fora o `cenarios.mdx` e o `x.md5`.
 */
const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+)(?:-(\d+))?)?/g

/** As células da linha de tabela, sem as barras das pontas; `null` se a linha não é de tabela. */
function celulas(linha: string): string[] | null {
  if (!linha.startsWith('|')) return null
  const partes = linha.split('|').map((parte) => parte.trim())
  partes.shift()
  if (partes[partes.length - 1] === '') partes.pop()
  return partes
}

/**
 * Os arquivos que a última coluna da linha cita: `techspec.md` e `cenarios.md` na pasta do documento; o que tem caminho
 * (o documento da seção 11, `docs/runbook.md`), na raiz. Só `.md`: código, teste e yaml citados ali são o que a divergência
 * muda, e não a spec. Um `.md` sem caminho que não é da spec (`README.md`) não se resolve e não é cobrado. `null` quando a
 * linha não é de tabela com três colunas ou a última não cita nenhum: vale então o critério antigo.
 */
export function citacoesDaLinha(linha: string, documento: string): Citacao[] | null {
  const partes = celulas(linha)
  if (partes === null || partes.length < 3) return null
  const citacoes: Citacao[] = []
  for (const achado of (partes[partes.length - 1] ?? '').matchAll(CITACAO_DE_MD)) {
    const citacao = citacaoDoAchado(achado, documento)
    if (citacao !== null && !citacoes.some((outra) => referencia(outra) === referencia(citacao))) citacoes.push(citacao)
  }
  return citacoes.length > 0 ? citacoes : null
}

/** Um `.md` achado na última célula, resolvido contra a pasta do documento ou a raiz; `null` se não é cobrado. */
function citacaoDoAchado(achado: RegExpMatchArray, documento: string): Citacao | null {
  const caminho = (achado[1] ?? '').replace(/^\.\//, '')
  const daSpec = ARQUIVOS_DA_SPEC.includes(caminho)
  if (!caminho.includes('/') && !daSpec) return null
  const arquivo = daSpec ? posix.join(posix.dirname(documento), caminho) : caminho
  if (achado[2] === undefined) return { arquivo }
  const de = Number(achado[2])
  return { arquivo, de, ate: achado[3] === undefined ? de : Number(achado[3]) }
}

/** A divergência em poucas palavras, para o aviso: a primeira célula da tabela, ou a linha inteira, sem o negrito e o marcador. */
function rotulo(linha: string): string {
  const texto = (celulas(linha)?.[0] ?? linha).replace(/^[-*]\s+/, '').replaceAll('**', '')
  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto
}

function referencia(citacao: Citacao): string {
  if (citacao.de === undefined) return citacao.arquivo
  return citacao.ate === citacao.de ? `${citacao.arquivo}:${String(citacao.de)}` : `${citacao.arquivo}:${String(citacao.de)}-${String(citacao.ate)}`
}

/** O que falta para a linha chegar à spec, em frases; vazio quando ela está quite. */
function oQueFalta(linha: string, documento: string, alterados: readonly string[], tocou: TocouOTrecho): string[] {
  const citacoes = citacoesDaLinha(linha, documento)
  if (citacoes === null) {
    const arquivosDaSpec = ARQUIVOS_DA_SPEC.map((nome) => posix.join(posix.dirname(documento), nome))
    return arquivosDaSpec.some((arquivo) => alterados.includes(arquivo)) ? [] : [`falta mudar ${arquivosDaSpec.join(' ou ')} (a linha não diz onde está na spec)`]
  }
  const faltas: string[] = []
  for (const citacao of citacoes) {
    if (!alterados.includes(citacao.arquivo)) faltas.push(`falta mudar ${referencia(citacao)}`)
    else if (citacao.de !== undefined && !tocou(citacao.arquivo, citacao.de, citacao.ate ?? citacao.de)) faltas.push(`${referencia(citacao)}: o arquivo mudou, mas não nessa linha`)
  }
  return faltas
}

/**
 * O aviso, ou `null`: há linha nova na seção e algum arquivo que a coluna "Onde está na spec" cita não está entre os alterados
 * (ou, citado com a linha, o diff não a toca). `alterados` são caminhos relativos à raiz, como o `arquivosAlterados` os dá; `tocou`
 * responde pelo diff, e sem ele todo arquivo alterado vale como tocado na linha citada.
 */
export function avisoDeDivergencia(novas: readonly string[], documento: string, alterados: readonly string[], tocou: TocouOTrecho = () => true): string | null {
  const pendentes = novas.map((linha) => ({ linha, faltas: oQueFalta(linha, documento, alterados, tocou) })).filter((pendente) => pendente.faltas.length > 0)
  if (pendentes.length === 0) return null
  const quantas = `${String(pendentes.length)} ${pendentes.length === 1 ? 'linha' : 'linhas'}`
  const linhas = pendentes.map((pendente) => `- "${rotulo(pendente.linha)}": ${pendente.faltas.join('; ')}`)
  return (
    `Atenção: a seção "Divergências resolvidas nesta tarefa" de ${documento} ganhou ${quantas} que a spec ainda não recebeu:\n${linhas.join('\n')}\n` +
    'A divergência que fica só no documento da tarefa o revisor-geral reprova: ela entra também na techspec.md, no cenarios.md e no documento que a seção 11 aponta, antes dos revisores (o portão só informa; a Mesa devolve a rodada com a linha e o arquivo).\n'
  )
}

/** Há um arquivo no HEAD? Sem ele (arquivo novo, repositório sem HEAD) todo o texto é novo. */
function existeNoHead(raiz: string, arquivo: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${arquivo}`], { cwd: raiz, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * O `TocouOTrecho` da árvore de agora: `git diff -U0` contra o HEAD, e o lado novo de cada trecho (`@@ -a,b +c,d @@`). Arquivo que o HEAD não tem
 * vale como tocado em qualquer linha, e isso inclui o renomeado (`git mv`) citado pelo nome novo: o `arquivo:linha` que o diff de fato não toca
 * não é pego nesse caso, que é raro na spec.
 */
export function trechoTocadoNoDiff(raiz: string): TocouOTrecho {
  const doArquivo = (arquivo: string): Array<[number, number]> | 'novo' => {
    let lidos: Array<[number, number]> | 'novo' = 'novo'
    if (existeNoHead(raiz, arquivo)) {
      const diff = execFileSync('git', ['diff', '-U0', 'HEAD', '--', arquivo], { cwd: raiz, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      lidos = []
      for (const trecho of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const inicio = Number(trecho[1])
        const quantas = trecho[2] === undefined ? 1 : Number(trecho[2])
        // `+c,0` é só remoção: nenhuma linha do arquivo de agora.
        if (quantas > 0) lidos.push([inicio, inicio + quantas - 1])
      }
    }
    return lidos
  }
  return (arquivo, de, ate) => {
    const lidos = doArquivo(arquivo)
    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
  }
}

/** O aviso para a árvore de agora: lê o documento, o que o HEAD tinha dele e junta com os arquivos alterados e o diff. */
export function avisoDaDivergenciaSoNoDocumento(raiz: string, documento: string, alterados: readonly string[]): string | null {
  const depois = readFileSync(join(raiz, documento), 'utf8')
  let antes: string | null
  try {
    antes = execFileSync('git', ['show', `HEAD:${documento}`], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 })
  } catch {
    // Documento novo (ou repositório sem HEAD): não havia seção antes, e toda linha dela é nova.
    antes = null
  }
  return avisoDeDivergencia(divergenciasNovas(antes, depois), documento, alterados, trechoTocadoNoDiff(raiz))
}
