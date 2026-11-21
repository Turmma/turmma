// Documento de trabalho de uma revisão: o veredito, a rodada, a seção "Revisões", os achados e o índice.
//
// Documento de trabalho é o arquivo onde as rodadas ficam registradas: o N_task.md de uma tarefa,
// o revisao-spec.md de uma Tech Spec, ou o tasks/correcoes/<slug>.md de uma correção.
//
// `registrar` (SubagentStop): quando um revisor termina, acrescenta a rodada à seção "Revisões" do
// documento, com início, fim e veredito, e guarda o que ele exigiu em `achados/<documento>.md`, com
// uma linha de resumo em `achados/indice.md`. Quem escreve é o hook, não quem implementou.
//
// A separação existe porque o arquivo único por pasta chegou a 646 KB e 158 rodadas no F1, e o
// passo 2 do `/executar-task` manda lê-lo antes de cada tarefa: o índice é o que cabe na janela,
// e o bloco inteiro se abre por ele.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { alteracoesDeCodigo, arquivosAlterados, chaveDaRodada, comTrava, gravarInstantaneo } from './caducidade.ts'

export const REVISORES_COM_VETO = ['tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian', 'test-engineer', 'revisor-geral']
export const REVISORES_SEM_VETO = ['llm-integrator', 'pedagogia-reviewer', 'frontend-reviewer']

/**
 * O rótulo que o hook procura no `N_task.md`, escrito em `.claude/skills/criar-tasks/task-template.md`. Os nomes que ele
 * lista só contam se estiverem em `REVISORES_COM_VETO` ou `REVISORES_SEM_VETO`; `tools/processo/harness/rotulos.test.ts`
 * confere o rótulo e os nomes do modelo.
 */
export const ROTULO_DOS_SUBAGENTES = '**Subagentes obrigatórios:**'
const REVISORES = new Set([...REVISORES_COM_VETO, ...REVISORES_SEM_VETO])

/** O arquivo único por pasta, de antes da separação. Só a migração o lê. */
export const NOME_ACHADOS = 'achados-revisoes.md'
/** Os achados ficam em `<pasta do documento>/achados/`: um arquivo por documento, mais o índice. */
export const PASTA_ACHADOS = 'achados'
export const NOME_INDICE = 'indice.md'

export interface Revisao {
  inicio: string
  fim: string
  revisor: string
  rodada: number
  veredito: string
  agente: string
}

export type TipoDocumento = 'tarefa' | 'spec' | 'correcao'

const TITULO_SECAO = '## Revisões'
const CABECALHO_TABELA = '| Início | Fim | Revisor | Rodada | Veredito | Agente |\n|---|---|---|---|---|---|'
const TEXTO_SECAO =
  'Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:\n' +
  'o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código\n' +
  'atual, com APROVADO quando o revisor tem veto.'

export function extrairVeredito(texto: string): string | null {
  const achado = /VEREDITO\**\s*:?\s*\**\s*(APROVADO|REPROVADO|AJUSTES NECESS[ÁA]RIOS|VETO)/.exec(texto)
  if (!achado?.[1]) return null
  if (achado[1] === 'VETO') return 'REPROVADO'
  return achado[1].replace('NECESSARIOS', 'NECESSÁRIOS')
}

const DOCUMENTO = /tasks\/(?:prd-[a-z0-9-]+\/(?:\d+_task|revisao-spec)|correcoes\/(?!achados-revisoes)[a-z0-9-]+)\.md/

// A linha "Tarefa: <documento>" do prompt do revisor vence; sem ela, a primeira menção.
export function caminhoDaTarefa(texto: string): string | null {
  const declarada = new RegExp(`Tarefa:\\s*\`?(${DOCUMENTO.source})`).exec(texto)
  if (declarada?.[1]) return declarada[1]
  return DOCUMENTO.exec(texto)?.[0] ?? null
}

export function tipoDoDocumento(caminho: string): TipoDocumento {
  if (caminho.startsWith('tasks/correcoes/')) return 'correcao'
  if (caminho.endsWith('/revisao-spec.md')) return 'spec'
  return 'tarefa'
}

export function formatarHora(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())} ${dois(data.getHours())}:${dois(data.getMinutes())}:${dois(data.getSeconds())}`
}

interface EntradaTranscript {
  type?: string
  timestamp?: string
  message?: { content?: unknown }
}

function textoDoConteudo(conteudo: unknown): string {
  if (typeof conteudo === 'string') return conteudo
  if (!Array.isArray(conteudo)) return ''
  return conteudo.map((bloco: { type?: string; text?: string }) => (bloco?.type === 'text' ? (bloco.text ?? '') : '')).join('')
}

function ehMensagemDeQuemChamou(entrada: EntradaTranscript): boolean {
  if (entrada.type !== 'user') return false
  const conteudo = entrada.message?.content
  if (typeof conteudo === 'string') return true
  return Array.isArray(conteudo) && conteudo.some((bloco: { type?: string }) => bloco?.type === 'text')
}

// O prompt de quem chamou e o início da rodada atual (a última mensagem que não é resultado de ferramenta).
export function lerTranscript(conteudo: string): { prompt: string; inicioDaRodada: Date | null } {
  const entradas = conteudo
    .split('\n')
    .filter((linha) => linha.trim())
    .flatMap((linha): EntradaTranscript[] => {
      try {
        return [JSON.parse(linha) as EntradaTranscript]
      } catch {
        return []
      }
    })
    .filter(ehMensagemDeQuemChamou)
  const ultima = entradas.at(-1)
  return {
    prompt: entradas.map((entrada) => textoDoConteudo(entrada.message?.content)).join('\n'),
    inicioDaRodada: ultima?.timestamp ? new Date(ultima.timestamp) : null,
  }
}

export function lerRevisoes(conteudoTarefa: string): Revisao[] {
  const inicio = conteudoTarefa.indexOf(`\n${TITULO_SECAO}\n`)
  if (inicio === -1) return []
  return conteudoTarefa
    .slice(inicio)
    .split('\n')
    .filter((linha) => /^\| \d{4}-/.test(linha))
    .map((linha) => {
      const [inicioRodada = '', fim = '', revisor = '', rodada = '', veredito = '', agente = ''] = linha
        .split('|')
        .slice(1, -1)
        .map((celula) => celula.trim().replaceAll('`', ''))
      return { inicio: inicioRodada, fim, revisor, rodada: Number(rodada), veredito, agente }
    })
}

/**
 * As linhas da tabela da seção "Revisões", do título até o fim do arquivo (é onde `lerRevisoes` lê e onde `acrescentarRevisao`
 * escreve): cabeçalho, separador e rodadas, toda linha que começa por `|`. Sem a seção, a lista é vazia. Supõe que a seção seja a
 * última do arquivo, como o hook a deixa: outra tabela depois dela entraria na conta, e o gancho do `Write` passaria a exigi-la.
 */
export function linhasDaTabelaDeRevisoes(conteudo: string): string[] {
  const titulo = `\n${TITULO_SECAO}\n`
  const secao = conteudo.split(titulo).slice(1).join(titulo)
  return secao.split('\n').filter((linha) => linha.startsWith('|'))
}

/** A recusa de um `Write` que apagaria rodadas: a frase que o hook devolve, ou `null` quando a escrita pode seguir. */
export function recusaDeEscritaSobreRevisoes(arquivo: string, existente: string, novo: string): string | null {
  const antes = linhasDaTabelaDeRevisoes(existente)
  const depois = new Set(linhasDaTabelaDeRevisoes(novo))
  const faltam = antes.filter((linha) => !depois.has(linha))
  if (faltam.length === 0) return null
  return (
    `Write bloqueado: ${arquivo} já tem a seção "${TITULO_SECAO.slice(3)}" e o conteúdo novo não traz ${String(faltam.length)} de ` +
    `${String(antes.length)} linhas da tabela dela. Quem escreve essa seção é o hook: reescrever o documento a apaga e a contagem das rodadas ` +
    'recomeça do 1. Mude o documento com Edit, só no trecho que precisa mudar.'
  )
}

/**
 * A decisão do hook do `Write` (PreToolUse): o motivo da recusa, ou `null`. Só vale para arquivo que já existe sob `tasks/` da
 * raiz; arquivo novo, ou fora de `tasks/`, passa. Falha de leitura que não é "não existe" sobe: o hook trata como recusa.
 */
export function decidirEscrita(entrada: EntradaHook, raiz: string): string | null {
  const alvo = entrada.tool_input?.file_path
  if (typeof alvo !== 'string') return null
  const absoluto = resolve(raiz, alvo)
  const relativo = relative(resolve(raiz), absoluto)
  // Fora da raiz o caminho relativo começa por `../`, e também não é `tasks/`.
  if (!relativo.startsWith('tasks/')) return null
  if (!existsSync(absoluto)) return null
  const conteudo = entrada.tool_input?.content
  return recusaDeEscritaSobreRevisoes(relativo, readFileSync(absoluto, 'utf8'), typeof conteudo === 'string' ? conteudo : '')
}

/**
 * A pasta da cópia da tabela "Revisões" de cada documento: fora de `tasks/`, e `.processo/` é ignorada pelo git (`.gitignore`), então a
 * cópia nunca entra em commit nem em `alteracoesDeCodigo`. O `Write` tem o gancho dele (`decidirEscrita`); o script e o `>` do Bash não
 * passam por gancho nenhum, e a cópia é de onde a linha que eles apagaram volta (X6 retro M2). Um arquivo por documento, com as linhas
 * da tabela como `linhasDaTabelaDeRevisoes` as lê.
 */
export const PASTA_DAS_COPIAS = '.processo/revisoes'

export function caminhoDaCopiaDasRevisoes(documento: string): string {
  return join(PASTA_DAS_COPIAS, `${documento.replaceAll('/', '__')}.txt`)
}

/** As linhas da tabela como o hook as gravou da última vez; vazia quando o documento nunca teve rodada registrada aqui. */
export function lerCopiaDasRevisoes(raiz: string, documento: string): string[] {
  const caminho = join(raiz, caminhoDaCopiaDasRevisoes(documento))
  return existsSync(caminho) ? readFileSync(caminho, 'utf8').split('\n').filter((linha) => linha.startsWith('|')) : []
}

/** Grava a tabela que o documento tem agora. Sem linha de tabela, não grava: a cópia vazia não ensinaria nada ao que voltar. */
export function gravarCopiaDasRevisoes(raiz: string, documento: string, conteudo: string): void {
  const linhas = linhasDaTabelaDeRevisoes(conteudo)
  if (linhas.length === 0) return
  const caminho = join(raiz, caminhoDaCopiaDasRevisoes(documento))
  mkdirSync(dirname(caminho), { recursive: true })
  // Num temporário e renomeado: o processo que cai no meio da escrita não deixa a cópia truncada, que devolveria só parte da tabela.
  const temporario = `${caminho}.${String(process.pid)}.tmp`
  writeFileSync(temporario, `${linhas.join('\n')}\n`)
  renameSync(temporario, caminho)
}

const ehRodada = (linha: string): boolean => /^\| \d{4}-/.test(linha)

/**
 * O documento com as linhas da cópia que ele já não tem de volta na tabela, e quais foram. Sem a seção, ela é recriada no fim, como o hook
 * a escreve; com a seção, só o trecho da tabela é refeito (a cópia na ordem em que foi gravada, depois a rodada que o documento tem e a
 * cópia não), e o texto da seção e o que vem depois da tabela ficam. A ordem importa: `lerRevisoes` toma a última rodada de cada revisor.
 * Nada perdido devolve o conteúdo como veio.
 */
export function devolverRevisoesPerdidas(conteudo: string, copia: string[]): { conteudo: string; devolvidas: string[] } {
  const atuais = linhasDaTabelaDeRevisoes(conteudo)
  const presentes = new Set(atuais)
  const devolvidas = copia.filter((linha) => !presentes.has(linha))
  if (devolvidas.length === 0) return { conteudo, devolvidas }
  const daCopia = new Set(copia)
  const tabela = [...copia, ...atuais.filter((linha) => ehRodada(linha) && !daCopia.has(linha))]
  const base = conteudo.endsWith('\n') ? conteudo : `${conteudo}\n`
  const titulo = `\n${TITULO_SECAO}\n`
  const inicio = base.indexOf(titulo)
  if (inicio === -1) return { conteudo: `${base}${titulo}\n${TEXTO_SECAO}\n\n${tabela.join('\n')}\n`, devolvidas }
  const corte = inicio + titulo.length
  const linhas = base.slice(corte).split('\n')
  const marcas = linhas.map((linha) => linha.startsWith('|'))
  const primeira = marcas.indexOf(true)
  const antes = primeira === -1 ? [...linhas.slice(0, -1), ''] : linhas.slice(0, primeira)
  const depois = primeira === -1 ? [''] : linhas.slice(marcas.lastIndexOf(true) + 1)
  return { conteudo: base.slice(0, corte) + [...antes, ...tabela, ...depois].join('\n'), devolvidas }
}

/** O aviso de que o hook devolveu linhas ao documento: o que aconteceu e o que fazer, em uma mensagem. */
export function avisoDeRevisoesDevolvidas(documento: string, devolvidas: string[]): string {
  const rodadas = devolvidas.filter(ehRodada).length
  const quantas = rodadas > 0 ? `${String(rodadas)} linha${rodadas === 1 ? '' : 's'} da tabela` : 'a tabela'
  return (
    `A seção "${TITULO_SECAO.slice(3)}" de ${documento} tinha perdido ${quantas}, e o hook devolveu o que faltava ao documento, de uma cópia em ` +
    `${PASTA_DAS_COPIAS}/. Documento com a seção não se reescreve por script nem por \`>\`: mude-o com Edit, só no trecho que precisa mudar.`
  )
}

/**
 * Devolve ao documento, no disco, as linhas que a cópia tem e ele já não tem. Chamada de dentro da trava do documento (`registrar`) ou
 * por `devolverComTrava`. Sem documento ou sem cópia, não faz nada.
 */
export function restaurarRevisoes(raiz: string, documento: string): string[] {
  const caminho = join(raiz, documento)
  const copia = lerCopiaDasRevisoes(raiz, documento)
  if (copia.length === 0 || !existsSync(caminho)) return []
  const { conteudo, devolvidas } = devolverRevisoesPerdidas(readFileSync(caminho, 'utf8'), copia)
  if (devolvidas.length > 0) writeFileSync(caminho, conteudo)
  return devolvidas
}

/** `restaurarRevisoes` com a trava do documento, para quem não a tem (o portão do commit): o `registrar` escreve nele ao mesmo tempo. */
export function restaurarRevisoesComTrava(raiz: string, documento: string): string[] {
  return comTrava(join(raiz, documento), () => restaurarRevisoes(raiz, documento))
}

// Os marcados no documento, mais os que toda tarefa e toda correção têm, marcados ou não.
export function revisoresObrigatorios(conteudoTarefa: string, tipo: TipoDocumento = 'tarefa'): string[] {
  const linha = conteudoTarefa.split(ROTULO_DOS_SUBAGENTES)[1]?.split('\n')[0] ?? ''
  const marcados = [...linha.matchAll(/`([a-z-]+)`/g)].map((achado) => achado[1] ?? '').filter((nome) => REVISORES.has(nome))
  const sempre = tipo === 'tarefa' ? ['test-engineer', 'revisor-geral'] : tipo === 'correcao' ? ['test-engineer'] : []
  return [...new Set([...marcados, ...sempre])]
}

/**
 * A maior rodada que o hook já guardou para o revisor no arquivo de achados do documento (`achados/<documento>.md`).
 *
 * É a segunda fonte da contagem: a tabela "Revisões" mora no documento, e quem o reescreve inteiro a apaga (a X1
 * perdeu a seção duas vezes e a contagem recomeçou do 1). O arquivo de achados é só do hook. Limite: só guarda a rodada
 * que exigiu algo, então a aprovada limpa não está aqui.
 */
export function ultimaRodadaNosAchados(conteudoAchados: string, revisor: string): number {
  const rodadas = [...conteudoAchados.matchAll(/^## (\S+) · (\d+)ª rodada · [^·\n]+ · \d{4}-/gm)]
    .filter((achado) => achado[1] === revisor)
    .map((achado) => Number(achado[2]))
  return Math.max(0, ...rodadas)
}

export function acrescentarRevisao(conteudoTarefa: string, revisao: Omit<Revisao, 'rodada'>, nota?: string, achadosDoDocumento = ''): string {
  let conteudo = conteudoTarefa.endsWith('\n') ? conteudoTarefa : `${conteudoTarefa}\n`
  if (!conteudo.includes(`\n${TITULO_SECAO}\n`)) {
    conteudo += `\n${TITULO_SECAO}\n\n${TEXTO_SECAO}\n\n${nota ? `${nota}\n\n` : ''}${CABECALHO_TABELA}\n`
  }
  const naTabela = lerRevisoes(conteudo).filter((anterior) => anterior.revisor === revisao.revisor).length
  const rodada = Math.max(naTabela, ultimaRodadaNosAchados(achadosDoDocumento, revisao.revisor)) + 1
  return `${conteudo}| ${revisao.inicio} | ${revisao.fim} | \`${revisao.revisor}\` | ${rodada} | ${revisao.veredito} | ${revisao.agente} |\n`
}

// O que vale para a retrospectiva: toda rodada que não aprovou, e a aprovada que deixou recomendação.
//
// Guardar usa só `exigenciaDaRodada`; o resumo do índice tem, além dela, o recuo da primeira linha
// substantiva. A assimetria é de propósito. Revisor que declara "Bloqueantes: nenhum / Recomendações:
// nenhuma" não exigiu nada, e a prosa que ele escreve depois é justificativa, não pedido: guardá-la
// devolveria ao corpus as 172 rodadas aprovadas de 237, que é o peso que esta correção tirou. O recuo
// serve à rodada que **já vai ser guardada** por ter reprovado, para a célula do índice não sair vazia.
//
// A terceira possibilidade é onde se erra: seção **vazia** não é declaração. `Recomendações:` seguido
// de nada aproveitável quer dizer que o conteúdo está fora da seção, e aí a rodada é guardada mesmo
// aprovada — ver `temSecaoSemDeclaracao`. Um bloco real do corpus, com cinco recomendações, se perdeu
// assim quando o filtro de cerca entrou sozinho.
//
// Quem decide é `exigenciaDaRodada`, e não um regex de `Recomendações:`, porque o regex pedia os dois
// pontos: `## Recomendações (não bloqueiam)` seguido dos itens não casava, e a rodada ia para a
// tabela do documento sem bloco nenhum aqui. É o defeito que o `TODO.md` registra desde 20/09/2026.
export function achadoDaRodada(revisao: Revisao, mensagemFinal: string): string | null {
  if (revisao.veredito === 'APROVADO' && !exigenciaDaRodada(mensagemFinal) && !temSecaoSemDeclaracao(mensagemFinal)) return null
  // O corte guarda 80 linhas, mas `resumoDoAchado` lê a mensagem inteira: exigência abaixo da linha
  // 80 vira célula de índice apontando um bloco que não a contém. Disparou uma vez em 214 blocos.
  const linhas = mensagemFinal.trim().split('\n')
  const texto = linhas.length > 80 ? [...linhas.slice(0, 80), `[… ${linhas.length - 80} linhas cortadas]`].join('\n') : linhas.join('\n')
  return `## ${revisao.revisor} · ${revisao.rodada}ª rodada · ${revisao.veredito} · ${revisao.fim}\n\n${texto}\n`
}

/** O arquivo dos achados de um documento. Um por tarefa, spec ou correção — nunca um por pasta. */
export function caminhoDoAchado(documento: string): string {
  return join(dirname(documento), PASTA_ACHADOS, basename(documento))
}

/** O índice da pasta: uma linha por rodada, que é o que se lê antes de codar. */
export function caminhoDoIndice(documento: string): string {
  return join(dirname(documento), PASTA_ACHADOS, NOME_INDICE)
}

export function acrescentarAchado(conteudoAchados: string, documento: string, achado: string): string {
  const base =
    conteudoAchados ||
    `# Achados das revisões — \`${documento}\`\n\nEscrito pelo hook \`tools/processo/revisoes.ts\`. O resumo de cada rodada está em ` +
      `\`${NOME_INDICE}\`, nesta pasta. Não edite à mão.\n`
  const [cabecalho = '', ...resto] = achado.split('\n')
  return `${base.endsWith('\n') ? base : `${base}\n`}\n${cabecalho} · \`${documento}\`\n${resto.join('\n')}`
}

// O que o revisor exigiu, para caber numa linha do índice. As formas abaixo são as que eles de fato
// escrevem nos 214 blocos do F1: `Bloqueantes:`, `**Bloqueantes:**`, `## Bloqueantes`, com ou sem
// `(não bloqueiam)`, e o item na mesma linha ou na linha de baixo.
const CABECALHO_DE_SECAO = /^\s*#{0,4}\s*\**\s*(Bloqueantes|Recomendações)\s*\**\s*(?:\([^)]*\))?\s*\**\s*:?\s*(.*)$/i
const SEM_CONTEUDO = /^(nenhum[ao]?|n\/a|nada)\b[\s.,;:]*$/i
// `Bloqueantes: nenhum. A correção exigida na 1ª rodada foi feita:` — o revisor responde e segue
// falando. O ponto é o que separa a resposta do resto; sem ele, `nenhuma das rotas` é conteúdo.
const COMECA_SEM_NADA = /^(nenhum[ao]?|n\/a|nada)\s*[.;]/i
const nadaExigido = (texto: string) => SEM_CONTEUDO.test(texto) || COMECA_SEM_NADA.test(texto)
const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/
const CERCA = /^\s*(?:```|~~~)/
const LIMITE_DO_RESUMO = 160
// Quanto o corte pode recuar para não partir palavra. Além disso, corta seco: recuar demais devolve
// um resumo curto demais para dizer alguma coisa.
const RECUO_MAXIMO_DO_CORTE = 40

// Metade dos revisores cita o arquivo pelo caminho absoluto da máquina. Num resumo de 160 caracteres
// o prefixo até a raiz do repositório come a informação, e é igual em todas as linhas.
const ATE_A_RAIZ = /\/\S*?\/(?=(?:apps|packages|infra|e2e|tools|tasks|docs)\/|(?:CLAUDE|TODO|README|ROADMAP)\.md\b)/g

// Negrito antes do marcador de lista: `**texto**` não é item, e tirar o `*` primeiro o quebraria.
function limpar(linha: string): string {
  return linha.replaceAll('**', '').replace(ITEM, '').replaceAll('|', '\\|').replace(ATE_A_RAIZ, '').replace(/\s+/g, ' ').trim()
}

function encurtar(texto: string): string {
  if (texto.length <= LIMITE_DO_RESUMO) return texto
  const corte = texto.slice(0, LIMITE_DO_RESUMO)
  const espaco = corte.lastIndexOf(' ')
  return `${(espaco > LIMITE_DO_RESUMO - RECUO_MAXIMO_DO_CORTE ? corte.slice(0, espaco) : corte).trimEnd()}…`
}

/**
 * Três desfechos, não dois, e confundi-los custou um achado real do corpus:
 *
 * - **ausente**: o revisor não escreveu a seção;
 * - **declarou nada**: escreveu `nenhum`, `nenhuma`, `n/a` — não exigiu, e descartar está certo;
 * - **vazia**: escreveu o cabeçalho e não há texto aproveitável debaixo dele (só cerca de código).
 *   O conteúdo está **fora** da seção, e tratar isso como "nada exigido" apaga o bloco inteiro.
 *
 * O caso real: `test-engineer · 2ª rodada · APROVADO · 2026-09-21 17:26:58`, que tem `Recomendações:`
 * como última linha dentro da cerca e R1 a R5 em prosa depois dela.
 */
interface LeituraDaSecao {
  presente: boolean
  item: string | null
  declarouNada: boolean
}

const AUSENTE: LeituraDaSecao = { presente: false, item: null, declarouNada: false }
const comTexto = (texto: string): LeituraDaSecao =>
  nadaExigido(texto) ? { presente: true, item: null, declarouNada: true } : { presente: true, item: texto, declarouNada: false }

function lerSecao(linhas: string[], nome: RegExp): LeituraDaSecao {
  for (let i = 0; i < linhas.length; i++) {
    const achado = CABECALHO_DE_SECAO.exec(linhas[i] ?? '')
    if (!achado?.[1] || !nome.test(achado[1])) continue
    const naMesmaLinha = limpar(achado[2] ?? '')
    if (naMesmaLinha) return comTexto(naMesmaLinha)
    return lerOCorpoDaSecao(corpoDaSecao(linhas, i))
  }
  return AUSENTE
}

/** As linhas debaixo do cabeçalho da seção que começa em `inicio`, até o próximo cabeçalho. */
function corpoDaSecao(linhas: string[], inicio: number): string[] {
  const corpo: string[] = []
  for (const proxima of linhas.slice(inicio + 1)) {
    if (CABECALHO_DE_SECAO.test(proxima)) break
    if (proxima.trim()) corpo.push(proxima)
    // Linha em branco encerra só o parágrafo solto; a lista pode ter itens separados por branco.
    else if (corpo.length > 0 && !ITEM.test(corpo[0] ?? '')) break
  }
  return corpo
}

/** O primeiro item do corpo, ou a primeira linha de texto fora da cerca; corpo sem texto aproveitável é seção vazia. */
function lerOCorpoDaSecao(corpo: string[]): LeituraDaSecao {
  const util = corpo.filter((linha) => !CERCA.test(linha))
  const escolhida = limpar(util.find((linha) => ITEM.test(linha)) ?? util[0] ?? '')
  return escolhida ? comTexto(escolhida) : { presente: true, item: null, declarouNada: false }
}

function lerAsDuasSecoes(mensagemFinal: string): { bloqueantes: LeituraDaSecao; recomendacoes: LeituraDaSecao } {
  const linhas = mensagemFinal.split('\n')
  return { bloqueantes: lerSecao(linhas, /^Bloqueantes/i), recomendacoes: lerSecao(linhas, /^Recomenda/i) }
}

/** O primeiro bloqueante, ou a primeira recomendação. `nenhum` conta como nada exigido. */
export function exigenciaDaRodada(mensagemFinal: string): string | null {
  const { bloqueantes, recomendacoes } = lerAsDuasSecoes(mensagemFinal)
  return bloqueantes.item ?? recomendacoes.item
}

/** Seção escrita e sem texto debaixo dela: o que o revisor exigiu está fora, e some se descartarmos. */
export function temSecaoSemDeclaracao(mensagemFinal: string): boolean {
  const { bloqueantes, recomendacoes } = lerAsDuasSecoes(mensagemFinal)
  return [bloqueantes, recomendacoes].some((secao) => secao.presente && !secao.declarouNada && secao.item === null)
}

/** A célula "O que exigiu" do índice. */
export function resumoDoAchado(mensagemFinal: string): string {
  const exigencia = exigenciaDaRodada(mensagemFinal)
  if (exigencia) return encurtar(exigencia)
  // Revisor que não usou nenhuma das duas seções: o `test-engineer` escreve "Cenários exigidos".
  // Cabeçalho de seção não é conteúdo: `Bloqueantes: nenhum. Os dois da rodada 1 estão fechados` é
  // a declaração, e o que o revisor exigiu está nas linhas abaixo dela.
  const linha = mensagemFinal
    .split('\n')
    .filter((texto) => !CABECALHO_DE_SECAO.test(texto))
    .map((texto) => limpar(texto))
    .filter((texto) => !CERCA.test(texto))
    .find((texto) => texto.length >= 40 && !texto.startsWith('VEREDITO') && !nadaExigido(texto))
  return encurtar(linha ?? 'ver o bloco')
}

const CABECALHO_DO_INDICE =
  '# Índice dos achados das revisões\n\n' +
  'Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta\n' +
  'pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.\n' +
  'Não edite à mão.\n\n' +
  'Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.\n\n' +
  '| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |\n|---|---|---|---|---|---|\n'

export function acrescentarNoIndice(conteudoIndice: string, revisao: Revisao, documento: string, resumo: string): string {
  const base = conteudoIndice || CABECALHO_DO_INDICE
  const linha = `| ${revisao.fim} | \`${revisao.revisor}\` | ${String(revisao.rodada)}ª | ${revisao.veredito} | \`${basename(documento, '.md')}\` | ${resumo} |`
  return `${base.endsWith('\n') ? base : `${base}\n`}${linha}\n`
}

export interface EntradaHook {
  cwd?: string
  agent_type?: string
  agent_id?: string
  agent_transcript_path?: string
  last_assistant_message?: string
  tool_input?: { command?: string; file_path?: unknown; content?: unknown }
}

/** Devolve ao documento a linha que um script apagou e, se devolveu, avisa. Antes de contar a rodada: senão a contagem recomeça do 1. */
function restaurarAvisando(raiz: string, documento: string, avisar: ((texto: string) => void) | undefined): void {
  const devolvidas = restaurarRevisoes(raiz, documento)
  if (devolvidas.length > 0) avisar?.(avisoDeRevisoesDevolvidas(documento, devolvidas))
}

export function registrar(entrada: EntradaHook, raiz: string, agora = new Date(), avisar?: (texto: string) => void): string | null {
  if (!entrada.agent_type || !REVISORES.has(entrada.agent_type)) return null
  const transcript =
    entrada.agent_transcript_path && existsSync(entrada.agent_transcript_path)
      ? lerTranscript(readFileSync(entrada.agent_transcript_path, 'utf8'))
      : { prompt: '', inicioDaRodada: null }
  const mensagemFinal = entrada.last_assistant_message ?? ''
  const relativo = caminhoDaTarefa(transcript.prompt) ?? caminhoDaTarefa(mensagemFinal)
  if (!relativo) return null
  const caminho = join(raiz, relativo)
  if (!existsSync(caminho)) return null
  comTrava(caminho, () => {
    restaurarAvisando(raiz, relativo, avisar)
    const caminhoAchado = join(raiz, caminhoDoAchado(relativo))
    const achadosAnteriores = existsSync(caminhoAchado) ? readFileSync(caminhoAchado, 'utf8') : ''
    const atualizado = acrescentarRevisao(
      readFileSync(caminho, 'utf8'),
      {
        inicio: formatarHora(transcript.inicioDaRodada ?? agora),
        fim: formatarHora(agora),
        revisor: entrada.agent_type ?? '',
        veredito: extrairVeredito(mensagemFinal) ?? 'SEM VEREDITO',
        agente: entrada.agent_id ?? '',
      },
      undefined,
      achadosAnteriores,
    )
    writeFileSync(caminho, atualizado)
    gravarCopiaDasRevisoes(raiz, relativo, atualizado)
    const revisao = lerRevisoes(atualizado).at(-1)
    // O conteúdo que esta rodada viu. Mutação com restauração (o teste de mutação que se pede ao
    // `test-engineer`) deixa o conteúdo igual, e a rodada não caduca por causa dele.
    if (revisao) gravarInstantaneo(raiz, chaveDaRodada(relativo, revisao.revisor, revisao.rodada), alteracoesDeCodigo(raiz, arquivosAlterados(raiz)))
    const achado = revisao ? achadoDaRodada(revisao, mensagemFinal) : null
    if (achado && revisao) {
      mkdirSync(dirname(caminhoAchado), { recursive: true })
      writeFileSync(caminhoAchado, acrescentarAchado(achadosAnteriores, relativo, achado))
      // Trava própria, dentro da do documento: o índice é da pasta, e dois documentos a compartilham.
      // A ordem é sempre documento e depois índice, então não há ciclo.
      const caminhoIndice = join(raiz, caminhoDoIndice(relativo))
      comTrava(caminhoIndice, () => {
        const indice = existsSync(caminhoIndice) ? readFileSync(caminhoIndice, 'utf8') : ''
        writeFileSync(caminhoIndice, acrescentarNoIndice(indice, revisao, relativo, resumoDoAchado(mensagemFinal)))
      })
    }
  })
  return relativo
}
