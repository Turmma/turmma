import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { lerArquivosPrevistos, seSobrepoem } from '../processo/linhas.ts'
import { Arvore, type Executor, executarDeVerdade } from './arvore.ts'
import { type EntradaDoMapa, lerMapa, type Mapa, type Recusa, validarMapa } from './mapa.ts'
import { moverEntrada } from './movimentos.ts'
import { pacoteExiste, renomearPacotes } from './pacotes.ts'
import { abrirProjetos, type Projeto } from './projetos.ts'
import { acharReferencias, estaClassificada, type Referencia } from './referencias.ts'
import { montarRelatorio } from './relatorio.ts'
import { acharDeclaracoes, type Declaracao, renomearSimbolo } from './simbolos.ts'
import { aplicarPasso5, type TrocaAMao } from './texto.ts'

/**
 * `aplicar`: renomeia uma onda pelo mapa (Tech Spec da X8, §5). Calcula tudo na árvore em memória e só grava no fim; o mapa
 * recusado não deixa um byte no disco, nem o relatório.
 */

export interface OpcoesDoAplicar {
  /** O `N_task.md` da onda: a edição fora dos "Arquivos previstos" dele é recusa. Sem ele, não se confere: a linha de comando o exige, e só a função o deixa de fora (os testes). */
  escopo?: string
  executar?: Executor
}

export interface ResultadoDoAplicar {
  /** 0 aplicado; 1 recusado, nada gravado. */
  codigo: 0 | 1
  recusas: Recusa[]
  texto: string
  relatorio?: string
  /** Os `git mv` da gravação, na ordem. */
  comandos?: string[]
}

const CAMINHO_DO_LOCK = 'package-lock.json'

/** O que falta para a entrada ter o que renomear, ou `undefined` se tudo está na árvore. */
function oQueFalta(arvore: Arvore, entrada: EntradaDoMapa, declaracoes: readonly Declaracao[]): string | undefined {
  if (entrada.tipo === 'simbolo') {
    if (declaracoes.length > 0) return undefined
    return entrada.arquivo === undefined ? 'em nenhum arquivo' : `em ${entrada.arquivo}`
  }
  if (entrada.tipo === 'pacote') return pacoteExiste(arvore, entrada.de) ? undefined : 'em nenhum package.json'
  const existe = entrada.tipo === 'arquivo' ? arvore.existe(entrada.de) : arvore.temPasta(entrada.de)
  return existe ? undefined : ''
}

function destinoOcupado(arvore: Arvore, entrada: EntradaDoMapa): boolean {
  if (entrada.tipo === 'arquivo') return arvore.existe(entrada.para)
  return entrada.tipo === 'pasta' && arvore.temPasta(entrada.para)
}

function existencias(arvore: Arvore, entradas: readonly EntradaDoMapa[]): Recusa[] {
  const recusas: Recusa[] = []
  for (const entrada of entradas) {
    const achadas = entrada.tipo === 'simbolo' ? acharDeclaracoes(arvore, entrada) : []
    const falta = oQueFalta(arvore, entrada, achadas)
    if (falta !== undefined) recusas.push({ codigo: 'de-inexistente', detalhe: `${entrada.tipo} "${entrada.de}" não existe${falta === '' ? '' : ` ${falta}`}` })
    else if (destinoOcupado(arvore, entrada)) recusas.push({ codigo: 'colisao', detalhe: `${entrada.tipo} "${entrada.para}" já existe` })
  }
  return recusas
}

function aplicarSimbolosEMovimentos(arvore: Arvore, mapa: Mapa): Recusa[] {
  const precisaDoServico = mapa.entradas.some((entrada) => entrada.tipo === 'simbolo' || entrada.tipo === 'arquivo' || entrada.tipo === 'pasta')
  const projetos: Projeto[] = precisaDoServico ? abrirProjetos(arvore) : []
  const recusas: Recusa[] = []
  for (const entrada of mapa.entradas.filter((e) => e.tipo === 'simbolo')) {
    // As declarações são lidas agora, na árvore como o rename anterior a deixou: a posição achada antes de ele mudar o tamanho do texto
    // não vale mais no mesmo arquivo, e o rename cairia em outro nome (ou em nenhum) sem recusa.
    recusas.push(...renomearSimbolo(arvore, projetos, entrada, acharDeclaracoes(arvore, entrada)))
  }
  if (recusas.length > 0) return recusas
  for (const entrada of mapa.entradas.filter((e) => e.tipo === 'arquivo' || e.tipo === 'pasta')) moverEntrada(arvore, projetos, entrada)
  return recusas
}

function escopoDaOnda(raiz: string, escopo: string): string[] {
  return lerArquivosPrevistos(readFileSync(join(raiz, escopo), 'utf8'))
}

function recusasDeEscopo(tocados: Iterable<string>, previstos: readonly string[]): Recusa[] {
  const fora = [...tocados].filter((arquivo) => !previstos.some((previsto) => seSobrepoem(arquivo, previsto))).sort()
  return fora.map((arquivo) => ({ codigo: 'fora-do-escopo', detalhe: `a edição de ${arquivo} cai fora dos "Arquivos previstos" da tarefa` }))
}

const relatorioDe = (caminhoDoMapa: string): string => caminhoDoMapa.replace(/\.json$/, '.relatorio.md')

/** A árvore já tem a onda aplicada, calculada e conferida; resta classificar, conferir o escopo e gravar. */
function fechar(raiz: string, caminhoDoMapa: string, mapa: Mapa, arvore: Arvore, aMao: TrocaAMao[], mudouPacote: boolean, opcoes: OpcoesDoAplicar): ResultadoDoAplicar {
  const referencias = acharReferencias(arvore, mapa.entradas)
  const classificadas: Array<{ referencia: Referencia; classificacao: NonNullable<ReturnType<typeof estaClassificada>> }> = []
  const semClassificacao: Referencia[] = []
  for (const referencia of referencias) {
    const classificacao = estaClassificada(referencia, mapa.ocorrencias)
    if (classificacao === undefined) semClassificacao.push(referencia)
    else classificadas.push({ referencia, classificacao })
  }
  const caminhoDoRelatorio = relatorioDe(caminhoDoMapa)
  const tocados = new Set([...arvore.tocados(), caminhoDoRelatorio, ...(mudouPacote ? [CAMINHO_DO_LOCK] : [])])
  const recusas: Recusa[] = [
    ...(opcoes.escopo === undefined ? [] : recusasDeEscopo(tocados, escopoDaOnda(raiz, opcoes.escopo))),
    ...semClassificacao.map((r): Recusa => ({ codigo: 'ocorrencia-sem-classificacao', detalhe: `${r.arquivo}:${String(r.linha)} cita "${r.de}": ${r.trecho}` })),
  ]
  const relatorio = montarRelatorio({ mapa, caminhoDoMapa, recusas, ocorrencias: classificadas, semClassificacao, aMao, arquivosTocados: tocados.size })
  if (recusas.length > 0) return { codigo: 1, recusas, texto: textoDaRecusa(recusas), relatorio }
  const executar = opcoes.executar ?? executarDeVerdade
  const comandos = arvore.gravar(executar)
  writeFileSync(join(raiz, caminhoDoRelatorio), relatorio)
  if (mudouPacote) executar('npm', ['install', '--package-lock-only'], raiz)
  return { codigo: 0, recusas: [], texto: `Onda ${mapa.nome} aplicada: ${String(tocados.size)} arquivos tocados. Relatório em ${caminhoDoRelatorio}.`, relatorio, comandos }
}

const textoDaRecusa = (recusas: readonly Recusa[]): string => ['RECUSADO: nada foi gravado.', ...recusas.map((r) => `- ${r.codigo}: ${r.detalhe}`)].join('\n')

export function aplicar(raiz: string, caminhoDoMapa: string, opcoes: OpcoesDoAplicar = {}): ResultadoDoAplicar {
  const mapa = lerMapa(join(raiz, caminhoDoMapa))
  const doMapa = validarMapa(mapa)
  if (doMapa.length > 0) return { codigo: 1, recusas: doMapa, texto: textoDaRecusa(doMapa) }
  const arvore = Arvore.carregar(raiz)
  const faltas = existencias(arvore, mapa.entradas)
  if (faltas.length > 0) return { codigo: 1, recusas: faltas, texto: textoDaRecusa(faltas) }
  const colisoes = aplicarSimbolosEMovimentos(arvore, mapa)
  if (colisoes.length > 0) return { codigo: 1, recusas: colisoes, texto: textoDaRecusa(colisoes) }
  const mudouPacote = renomearPacotes(arvore, mapa.entradas)
  const aMao = aplicarPasso5(arvore, mapa.entradas, { documentos: !mapa.linha })
  return fechar(raiz, caminhoDoMapa, mapa, arvore, aMao, mudouPacote, opcoes)
}

if (import.meta.filename === process.argv[1]) {
  const { values } = parseArgs({ options: { mapa: { type: 'string' }, escopo: { type: 'string' } } })
  if (values.mapa === undefined || values.escopo === undefined) {
    process.stderr.write('uso: node tools/renomear/aplicar.ts --mapa tools/renomear/mapas/<N>.json --escopo tasks/prd-<x>/<N>_task.md\n')
    process.exitCode = 2
  } else {
    const resultado = aplicar(process.cwd(), values.mapa, { escopo: values.escopo })
    process.stdout.write(`${resultado.texto}\n`)
    if (resultado.codigo === 1 && resultado.relatorio !== undefined) process.stdout.write(`\n${resultado.relatorio}\n`)
    process.exitCode = resultado.codigo
  }
}
