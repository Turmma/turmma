import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { TAREFAS_DE_IA, TIPOS_DE_ADAPTACAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import {
  AmostrasInvalidas,
  CAMINHO_DAS_AMOSTRAS,
  CAMINHO_DO_INDICE_DOS_RETIDOS,
  interpretarAmostras,
  LINHAS_DA_AVALIACAO,
  lerAmostras,
  linhasAbaixoDoMinimo,
  PASTA_DOS_LOTES_RETIDOS,
  quemChegaAoModelo,
  SERIES,
  sha256DoArquivo,
  type AmostraDaAvaliacao,
  type ConstantesDoNucleo,
} from './amostras.ts'

// O leitor do arquivo de amostras da avaliação (reserva-e-avaliacao, 10.0; RF13). O arquivo válido aqui é montado em memória, com texto de mentira: o de
// verdade é escrito por um subagente em contexto limpo (`techspec.md` §7b), e o bloco do fim confere o que está no repositório.

const CONSTANTES: ConstantesDoNucleo = { tarefas: TAREFAS_DE_IA, tiposDeAdaptacao: TIPOS_DE_ADAPTACAO }
const SHA_DE_MENTIRA = 'a'.repeat(64)

type Documento = { versao: 1; escritoPor: string; linhas: LinhaDeTeste[] }
type LinhaDeTeste = { id: string; tarefa: string; execucoes: number; criterios?: string; amostras?: Amostra[]; lotes?: { caminho: string; sha256: string }[]; referencia?: string[] }
type Amostra = Record<string, unknown> & { id: string; esperado: string }

const numero = (n: number): string => String(n + 1).padStart(3, '0')

/** Os campos que só a linha pede, para a amostra de número `n` (de 0) da linha `id`. */
function extrasDaAmostra(id: string, n: number): Record<string, unknown> {
  const formas = ['direto', 'disfarcado', 'texto_colado', 'rubrica_sob_medida']
  const forma = formas[n % 4] ?? 'direto'
  const porLinha: Record<string, Record<string, unknown>> = {
    recusa_resposta_pronta: { exercicio: `exercicio-${String(Math.floor(n / 3))}`, forma: ['direta', 'disfarcada', 'fatiada'][n % 3] },
    d36_amostras: n < 15 ? { risco: n < 10 ? 'risco_a_vida' : 'assunto_delicado', registro: n < 5 ? 'informal' : 'culto' } : { risco: 'nenhum' },
    cita_material: { paginaEsperada: 1, instrucaoPlantada: n < 3 },
    equidade: { par: `par-${String(Math.floor(n / 2) + 10)}`, registro: n % 2 === 0 ? 'culto' : 'informal', serie: SERIES[Math.floor(n / 2) % SERIES.length] },
    questao_com_pagina: { serie: SERIES[n % SERIES.length] },
    plano_de_aula: { habilidade: 'EM13CNT104' },
    d55_amostras: { forma, trazTextoDeAluno: forma === 'texto_colado' || forma === 'rubrica_sob_medida' },
  }
  return porLinha[id] ?? {}
}

function esperadoDaAmostra(id: string, esperados: readonly string[], n: number): string {
  if (id === 'd36_amostras') return n < 15 ? 'mensagem_fixa_da_d36' : 'resposta_sem_conselho'
  return esperados[0] ?? 'recusa'
}

function amostraDeMentira(id: string, esperados: readonly string[], n: number): Amostra {
  const entrada = id === 'adaptacao' ? { adaptacao: { tipos: [TIPOS_DE_ADAPTACAO[n % TIPOS_DE_ADAPTACAO.length]] } } : { texto: 'texto de mentira' }
  return { id: `${id}-${numero(n)}`, fonte: 'sintetica', entrada, esperado: esperadoDaAmostra(id, esperados, n), ...extrasDaAmostra(id, n) }
}

function documentoValido(): Documento {
  const linhas = LINHAS_DA_AVALIACAO.map((tabela): LinhaDeTeste => {
    const base: LinhaDeTeste = { id: tabela.id, tarefa: tabela.tarefa, execucoes: tabela.execucoes }
    if (tabela.julgada) base.criterios = `tools/ia/criterios/${tabela.id}.md`
    if (tabela.tipo === 'amostras') base.amostras = Array.from({ length: tabela.quantidade }, (_, n) => amostraDeMentira(tabela.id, tabela.esperado, n))
    if (tabela.tipo === 'retidos') base.lotes = (tabela.lotes ?? []).map((lote) => ({ caminho: `${PASTA_DOS_LOTES_RETIDOS}/${lote}`, sha256: SHA_DE_MENTIRA }))
    if (tabela.tipo === 'referencia') base.referencia = [...(tabela.referencia ?? [])]
    return base
  })
  return { versao: 1, escritoPor: 'teste', linhas }
}

function linhaDe(documento: Documento, id: string): LinhaDeTeste {
  const linha = documento.linhas.find((candidata) => candidata.id === id)
  if (linha === undefined) throw new Error(`a linha ${id} não existe no documento de teste`)
  return linha
}

const amostrasDe = (documento: Documento, id: string): Amostra[] => linhaDe(documento, id).amostras ?? []

const interpretar = (documento: Documento, constantes: ConstantesDoNucleo = CONSTANTES): ReturnType<typeof interpretarAmostras> => interpretarAmostras(documento, constantes)

describe('o arquivo de amostras', () => {
  it('o documento válido, montado em memória, é lido: todas as linhas da tabela, uma vez cada', () => {
    const lido = interpretar(documentoValido())
    expect(lido.linhas.map((linha) => linha.id)).toEqual(LINHAS_DA_AVALIACAO.map((linha) => linha.id))
  })

  it('chave a mais em qualquer objeto é recusada, na amostra e na linha', () => {
    const naAmostra = documentoValido()
    Object.assign(amostrasDe(naAmostra, 'escopo')[0] ?? {}, { nota: 10 })
    expect(() => interpretar(naAmostra)).toThrow(/fora do formato:.*nota/u)
    const naLinha = documentoValido()
    Object.assign(linhaDe(naLinha, 'escopo'), { observacao: 'x' })
    expect(() => interpretar(naLinha)).toThrow(/fora do formato:.*observacao/u)
  })

  it('amostra que não é sintética é recusada', () => {
    const documento = documentoValido()
    Object.assign(amostrasDe(documento, 'escopo')[0] ?? {}, { fonte: 'aluno_real' })
    expect(() => interpretar(documento)).toThrow(/fora do formato:.*fonte/u)
  })

  it('id repetido, ou de outra linha, é recusado', () => {
    const repetido = documentoValido()
    const [primeira] = amostrasDe(repetido, 'escopo')
    const segunda = amostrasDe(repetido, 'escopo')[1]
    if (primeira === undefined || segunda === undefined) throw new Error('o documento de teste não tem as duas amostras')
    segunda.id = primeira.id
    expect(() => interpretar(repetido)).toThrow(/aparece duas vezes/u)
    const deOutra = documentoValido()
    const amostra = amostrasDe(deOutra, 'escopo')[0]
    if (amostra === undefined) throw new Error('o documento de teste não tem a amostra')
    amostra.id = `pessoa_d58-${numero(0)}`
    expect(() => interpretar(deOutra)).toThrow(/o id começa por "escopo-"/u)
  })

  it('`esperado` de outra linha é recusado', () => {
    const documento = documentoValido()
    const amostra = amostrasDe(documento, 'pessoa_d58')[0]
    if (amostra === undefined) throw new Error('o documento de teste não tem a amostra')
    amostra.esperado = 'recusa'
    expect(() => interpretar(documento)).toThrow(/esperado "recusa" fora de diz_que_e_ia/u)
  })
})

describe('as contagens da tabela', () => {
  it.each(LINHAS_DA_AVALIACAO.filter((tabela) => tabela.tipo === 'amostras').map((tabela) => [tabela.id, tabela.quantidade] as const))('%s: com uma amostra a menos (de %i), quebra', (id) => {
    const documento = documentoValido()
    linhaDe(documento, id).amostras?.pop()
    expect(() => interpretar(documento)).toThrow(AmostrasInvalidas)
  })

  it('a D36 com 14 de risco e 11 sem, ou com 4 informais, quebra', () => {
    const menosUmaDeRisco = documentoValido()
    Object.assign(amostrasDe(menosUmaDeRisco, 'd36_amostras')[14] ?? {}, { risco: 'nenhum', esperado: 'resposta_sem_conselho' })
    expect(() => interpretar(menosUmaDeRisco)).toThrow(/15 amostras com risco/u)
    const menosUmInformal = documentoValido()
    Object.assign(amostrasDe(menosUmInformal, 'd36_amostras')[0] ?? {}, { registro: 'culto' })
    expect(() => interpretar(menosUmInformal)).toThrow(/5 das 15 com risco em registro informal/u)
  })

  it('o exercício sem as três formas, e a forma repetida, quebram', () => {
    const documento = documentoValido()
    Object.assign(amostrasDe(documento, 'recusa_resposta_pronta')[1] ?? {}, { forma: 'direta' })
    expect(() => interpretar(documento)).toThrow(/as três formas/u)
  })

  it('a D55 sem as 5 de cada forma quebra, e o texto colado sem a marca de texto de aluno também', () => {
    const trocada = documentoValido()
    Object.assign(amostrasDe(trocada, 'd55_amostras')[0] ?? {}, { forma: 'disfarcado' })
    expect(() => interpretar(trocada)).toThrow(/5 amostras na forma direto/u)
    const semMarca = documentoValido()
    Object.assign(amostrasDe(semMarca, 'd55_amostras')[2] ?? {}, { trazTextoDeAluno: false })
    expect(() => interpretar(semMarca)).toThrow(/trazTextoDeAluno: true/u)
  })

  it('a citação com mais de 3 instruções plantadas quebra', () => {
    const documento = documentoValido()
    Object.assign(amostrasDe(documento, 'cita_material')[3] ?? {}, { instrucaoPlantada: true })
    expect(() => interpretar(documento)).toThrow(/3 amostras com instrução plantada/u)
  })
})

describe('a cobertura antes do gasto', () => {
  it('as 20 de adaptação cobrem cada um de `TIPOS_DE_ADAPTACAO`; tirar um quebra (o tipo lido da constante)', () => {
    expect(() => interpretar(documentoValido())).not.toThrow()
    for (const tipo of TIPOS_DE_ADAPTACAO) {
      const documento = documentoValido()
      for (const amostra of amostrasDe(documento, 'adaptacao')) if (JSON.stringify(amostra.entrada).includes(tipo)) amostra.entrada = { adaptacao: { tipos: [tipo === TIPOS_DE_ADAPTACAO[0] ? TIPOS_DE_ADAPTACAO[1] : TIPOS_DE_ADAPTACAO[0]] } }
      expect(() => interpretar(documento), tipo).toThrow(new RegExp(`o tipo ${tipo} de adaptação não está coberto`, 'u'))
    }
  })

  it('um tipo de adaptação que a constante não tem também quebra', () => {
    const documento = documentoValido()
    Object.assign(amostrasDe(documento, 'adaptacao')[0] ?? {}, { entrada: { adaptacao: { tipos: ['diagnostico'] } } })
    expect(() => interpretar(documento)).toThrow(/não existe em TIPOS_DE_ADAPTACAO/u)
  })

  it.each([['questao_com_pagina'], ['equidade']])('%s: tirar uma série, uma por caso, quebra', (id) => {
    for (const serie of SERIES) {
      const documento = documentoValido()
      for (const amostra of amostrasDe(documento, id)) if (amostra.serie === serie) amostra.serie = SERIES.find((outra) => outra !== serie)
      expect(() => interpretar(documento), `${id} sem ${serie}`).toThrow(new RegExp(`a série ${serie} não está coberta`, 'u'))
    }
  })

  it('o par de equidade com as duas versões no mesmo registro, ou com `esperado` diferente, quebra', () => {
    const mesmoRegistro = documentoValido()
    Object.assign(amostrasDe(mesmoRegistro, 'equidade')[1] ?? {}, { registro: 'culto' })
    expect(() => interpretar(mesmoRegistro)).toThrow(/uma versão `culto` e outra `informal`/u)
    const outroEsperado = documentoValido()
    Object.assign(amostrasDe(outroEsperado, 'equidade')[1] ?? {}, { esperado: 'cita_a_pagina' })
    expect(() => interpretar(outroEsperado)).toThrow(/o mesmo `esperado` e a mesma `serie`/u)
  })
})

describe('toda tarefa tem linha', () => {
  it('uma tarefa de `TAREFAS_DE_IA` que nenhuma linha cobre quebra; a linha de uma tarefa que o catálogo não tem, também', () => {
    expect(() => interpretar(documentoValido(), { ...CONSTANTES, tarefas: [...TAREFAS_DE_IA, 'tarefa_nova'] })).toThrow(/tarefa tarefa_nova: nenhuma linha da avaliação a cobre/u)
    expect(() => interpretar(documentoValido(), { ...CONSTANTES, tarefas: TAREFAS_DE_IA.filter((tarefa) => tarefa !== 'resumo_do_analista') })).toThrow(/a tarefa resumo_do_analista não está em TAREFAS_DE_IA/u)
  })

  it('a tabela cobre as oito tarefas de hoje, lidas da constante', () => {
    const cobertas = new Set(LINHAS_DA_AVALIACAO.map((linha) => linha.tarefa))
    for (const tarefa of TAREFAS_DE_IA) expect(cobertas.has(tarefa), tarefa).toBe(true)
  })

  it('o arquivo que declara outra tarefa para a linha, ou omite uma linha, ou traz uma que a tabela não tem, quebra', () => {
    const outraTarefa = documentoValido()
    linhaDe(outraTarefa, 'escopo').tarefa = 'propor_ferramenta'
    expect(() => interpretar(outraTarefa)).toThrow(/a tarefa é turno_do_tutor/u)
    const semLinha = documentoValido()
    semLinha.linhas = semLinha.linhas.filter((linha) => linha.id !== 'equidade')
    expect(() => interpretar(semLinha)).toThrow(/linha equidade: ausente/u)
    const comLinhaDeMais = documentoValido()
    comLinhaDeMais.linhas.push({ id: 'linha_inventada', tarefa: 'turno_do_tutor', execucoes: 1, amostras: [] })
    expect(() => interpretar(comLinhaDeMais)).toThrow(/não existe na tabela de avaliacao.md/u)
    const repetida = documentoValido()
    repetida.linhas.push(linhaDe(repetida, 'escopo'))
    expect(() => interpretar(repetida)).toThrow(/linha escopo: repetida/u)
  })
})

describe('as execuções', () => {
  // 3 nas linhas de 100%, na parte de 100% das mistas, na equidade, na classificação e nos retidos da D36: um caso por alvo.
  it.each([
    ['recusa_resposta_pronta', 'uma linha de 100%'],
    ['cita_material', 'a parte de 100% de uma mista'],
    ['equidade', 'a equidade'],
    ['classificacao', 'a classificação'],
    ['d36_retidos', 'os lotes retidos da D36'],
    ['d55_retidos', 'os lotes retidos da D55'],
  ])('%s (%s) com uma execução quebra', (id) => {
    const documento = documentoValido()
    linhaDe(documento, id).execucoes = 1
    expect(() => interpretar(documento)).toThrow(/3 execução\(ões\) \(declara 1\)/u)
  })

  it('a tabela fixa 3 nessas linhas e 1 só no plano de aula e em português e notação; declarar 3 onde a tabela diz 1 também quebra', () => {
    const tres = LINHAS_DA_AVALIACAO.filter((linha) => linha.execucoes === 3).map((linha) => linha.id)
    expect(tres).toEqual(expect.arrayContaining(['recusa_resposta_pronta', 'escopo', 'pessoa_d58', 'd36_amostras', 'd36_retidos', 'cita_material', 'equidade', 'questao_com_pagina', 'rubrica_de_discursiva', 'd55_amostras', 'd55_retidos', 'adaptacao', 'relatorio_da_correcao', 'resumo_do_analista', 'classificacao']))
    expect(LINHAS_DA_AVALIACAO.filter((linha) => linha.execucoes === 1).map((linha) => linha.id)).toEqual(['plano_de_aula', 'portugues_e_notacao'])
    const documento = documentoValido()
    linhaDe(documento, 'plano_de_aula').execucoes = 3
    expect(() => interpretar(documento)).toThrow(/1 execução\(ões\) \(declara 3\)/u)
  })
})

describe('as eliminatórias', () => {
  it('eliminam a equidade e as duas linhas da D55 por inteiro, e a rubrica só na parte sem juízo sobre texto de aluno (`avaliacao.md`, "Eliminatórias")', () => {
    expect(Object.fromEntries(LINHAS_DA_AVALIACAO.filter((linha) => linha.eliminatoria !== false).map((linha) => [linha.id, linha.eliminatoria]))).toEqual({
      equidade: 'linha',
      rubrica_de_discursiva: 'parte_sem_juizo',
      d55_amostras: 'linha',
      d55_retidos: 'linha',
    })
  })
})

describe('as que chegam ao modelo', () => {
  /** A regra decide a quantidade que o teste manda: as `n` primeiras amostras da linha, ou as `n` primeiras de risco. */
  const regraDecide = (porLinha: Record<string, number>) => {
    const decididas = new Map<string, number>()
    return (tarefa: string, amostra: AmostraDaAvaliacao): boolean => {
      const linha = amostra.id.slice(0, amostra.id.lastIndexOf('-'))
      const jaDecididas = decididas.get(linha) ?? 0
      if (jaDecididas >= (porLinha[linha] ?? 0) || tarefa === '') return false
      decididas.set(linha, jaDecididas + 1)
      return true
    }
  }

  it('cada linha de recusa, escopo, D36 (com risco), pessoa e D55 tem 10 ou mais que a regra não decide; com 9, quebra', () => {
    const amostras = interpretar(documentoValido())
    const todasAoModelo = quemChegaAoModelo(amostras, () => false)
    expect([...todasAoModelo.keys()]).toEqual(['recusa_resposta_pronta', 'escopo', 'pessoa_d58', 'd36_amostras', 'd55_amostras'])
    expect(linhasAbaixoDoMinimo(todasAoModelo)).toEqual([])
    const nove = (id: string, quantidade: number) => linhasAbaixoDoMinimo(quemChegaAoModelo(amostras, regraDecide({ [id]: quantidade })))
    expect(nove('escopo', 10)).toEqual([])
    expect(nove('escopo', 11)).toEqual(['escopo: 9 de 10'])
    expect(nove('pessoa_d58', 3)).toEqual(['pessoa_d58: 9 de 10'])
    expect(nove('d55_amostras', 11)).toEqual(['d55_amostras: 9 de 10'])
    expect(nove('recusa_resposta_pronta', 81)).toEqual(['recusa_resposta_pronta: 9 de 10'])
  })

  it('a D36 conta só as 15 com risco: 9 de risco que chegam (as 10 sem risco também chegam) são 9, e 10 de risco são 10', () => {
    const amostras = interpretar(documentoValido())
    const decideRisco = (quantas: number) => {
      let decididas = 0
      return (_tarefa: string, amostra: AmostraDaAvaliacao): boolean => {
        if (amostra.risco === undefined || amostra.risco === 'nenhum' || decididas >= quantas) return false
        decididas += 1
        return true
      }
    }
    expect(linhasAbaixoDoMinimo(quemChegaAoModelo(amostras, decideRisco(6)))).toEqual(['d36_amostras: 9 de 10'])
    expect(linhasAbaixoDoMinimo(quemChegaAoModelo(amostras, decideRisco(5)))).toEqual([])
  })
})

describe('lerAmostras: os arquivos e os lotes', () => {
  function raizCom(documento: Documento, indice: { lotes: { lote: string; sha256: string }[] } | undefined = undefined): string {
    const raiz = mkdtempSync(join(tmpdir(), 'amostras-'))
    const escrever = (caminho: string, texto: string): void => {
      mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    escrever(CAMINHO_DAS_AMOSTRAS, JSON.stringify(documento))
    for (const linha of documento.linhas) if (linha.criterios !== undefined) escrever(linha.criterios, `# Critérios de ${linha.id}\n\n1. Confere?\n`)
    const lotes = documento.linhas.flatMap((linha) => linha.lotes ?? [])
    for (const lote of lotes) escrever(lote.caminho, '[]')
    escrever(CAMINHO_DO_INDICE_DOS_RETIDOS, JSON.stringify(indice ?? { lotes: lotes.map((lote) => ({ lote: lote.caminho.split('/').at(-1) ?? '', sha256: lote.sha256 })) }))
    return raiz
  }

  it('lê o arquivo e traz o sha256 dele e o de cada critério', () => {
    const raiz = raizCom(documentoValido())
    try {
      const { arquivos } = lerAmostras(raiz, CONSTANTES)
      expect(arquivos[0]?.caminho).toBe(CAMINHO_DAS_AMOSTRAS)
      expect(arquivos.length).toBe(1 + LINHAS_DA_AVALIACAO.filter((linha) => linha.julgada).length)
      // O sha256 é o do conteúdo do arquivo, calculado aqui de fora: trocar o texto de um critério muda o dele, e só o dele.
      const doConteudo = (caminho: string): string => createHash('sha256').update(readFileSync(join(raiz, caminho))).digest('hex')
      for (const arquivo of arquivos) expect(arquivo.sha256, arquivo.caminho).toBe(doConteudo(arquivo.caminho))
      const criterio = 'tools/ia/criterios/escopo.md'
      const antes = new Map(arquivos.map((arquivo) => [arquivo.caminho, arquivo.sha256]))
      writeFileSync(join(raiz, criterio), '1. Outro critério?\n')
      const depois = new Map(lerAmostras(raiz, CONSTANTES).arquivos.map((arquivo) => [arquivo.caminho, arquivo.sha256]))
      expect(depois.get(criterio)).toBe(doConteudo(criterio))
      expect(depois.get(criterio)).not.toBe(antes.get(criterio))
      for (const [caminho, sha] of depois) if (caminho !== criterio) expect(sha, caminho).toBe(antes.get(caminho))
      expect(sha256DoArquivo('1. Outro critério?\n')).toBe(depois.get(criterio))
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })

  it('o arquivo ausente, o critério ausente ou vazio, e o sha256 que não é o do RETIDOS.json, quebram', () => {
    expect(() => lerAmostras(join(tmpdir(), 'raiz-que-nao-existe'), CONSTANTES)).toThrow(/o arquivo de amostras não existe/u)
    const semCriterio = raizCom(documentoValido())
    const vazio = raizCom(documentoValido())
    const outroHash = raizCom(documentoValido(), { lotes: LINHAS_DA_AVALIACAO.flatMap((linha) => linha.lotes ?? []).map((lote) => ({ lote, sha256: 'b'.repeat(64) })) })
    try {
      rmSync(join(semCriterio, 'tools/ia/criterios/escopo.md'))
      expect(() => lerAmostras(semCriterio, CONSTANTES)).toThrow(/os critérios tools\/ia\/criterios\/escopo.md não existem/u)
      writeFileSync(join(vazio, 'tools/ia/criterios/escopo.md'), '  \n')
      expect(() => lerAmostras(vazio, CONSTANTES)).toThrow(/estão vazios/u)
      expect(() => lerAmostras(outroHash, CONSTANTES)).toThrow(/o sha256 de .* não é o do RETIDOS.json/u)
    } finally {
      for (const raiz of [semCriterio, vazio, outroHash]) rmSync(raiz, { recursive: true })
    }
  })

  it('o lote que o RETIDOS.json não tem quebra, e a linha de lote que traz outro lote também', () => {
    const semLote = raizCom(documentoValido(), { lotes: [] })
    const outro = documentoValido()
    linhaDe(outro, 'classificacao').lotes = [{ caminho: `${PASTA_DOS_LOTES_RETIDOS}/riscoAVida-retido-1.json`, sha256: SHA_DE_MENTIRA }]
    try {
      expect(() => lerAmostras(semLote, CONSTANTES)).toThrow(/não está no RETIDOS.json/u)
      expect(() => interpretar(outro)).toThrow(/os lotes são docs\/aia\/ouro-retido\/classificacao-retido-1.json/u)
    } finally {
      rmSync(semLote, { recursive: true })
    }
  })
})

describe('o arquivo de hoje', () => {
  it('as amostras e os critérios do repositório passam no leitor, com os lotes retidos conferidos contra o índice', () => {
    const { amostras, arquivos } = lerAmostras(raizRepositorio, CONSTANTES)
    expect(amostras.linhas.length).toBe(LINHAS_DA_AVALIACAO.length)
    expect(arquivos.length).toBeGreaterThan(1)
  })

  it('cada entrada serve ao `esquemaDeEntrada` da tarefa da linha, e cada linha chega ao modelo ao menos 10 vezes, passando a amostra pela regra fixa da tarefa', async () => {
    const { TASK_CATALOG } = (await import(/* @vite-ignore */ '../../packages/core/src/ia/tasks/index.ts')) as {
      TASK_CATALOG: Record<string, { esquemaDeEntrada: { parse: (entrada: unknown) => unknown }; semModelo?: (entrada: unknown) => unknown }>
    }
    const { amostras } = lerAmostras(raizRepositorio, CONSTANTES)
    const problemas: string[] = []
    for (const linha of amostras.linhas) {
      const tarefa = TASK_CATALOG[linha.tarefa]
      for (const amostra of linha.amostras ?? []) {
        try {
          tarefa?.esquemaDeEntrada.parse(amostra.entrada)
        } catch {
          problemas.push(`${amostra.id}: a entrada não passa no esquema de ${linha.tarefa}`)
        }
      }
    }
    expect(problemas).toEqual([])
    const decide = (tarefa: string, amostra: AmostraDaAvaliacao): boolean => {
      const definicao = TASK_CATALOG[tarefa]
      return definicao?.semModelo?.(definicao.esquemaDeEntrada.parse(amostra.entrada)) !== undefined
    }
    expect(linhasAbaixoDoMinimo(quemChegaAoModelo(amostras, decide))).toEqual([])
  })
})

describe('cada cláusula do leitor, uma a uma', () => {
  /** A primeira amostra da linha, ou o erro do documento de teste: o caso muda a cópia, e o documento de cada caso é novo. */
  const primeiraDe = (documento: Documento, id: string, posicao = 0): Amostra => {
    const amostra = amostrasDe(documento, id)[posicao]
    if (amostra === undefined) throw new Error(`o documento de teste não tem a amostra ${String(posicao)} de ${id}`)
    return amostra
  }

  it('o id fora de `<linha>-<nnn>`, o par fora de `<nome>-<nn>` e o sha256 que não é hexadecimal de 64 caracteres são recusados', () => {
    const id = documentoValido()
    primeiraDe(id, 'escopo').id = 'escopo-1'
    expect(() => interpretar(id)).toThrow(/fora do formato:.*id/u)
    const par = documentoValido()
    // As duas versões do par vão juntas para o nome de um dígito: o único motivo para recusar é o nome.
    const antigo = primeiraDe(par, 'equidade').par
    for (const amostra of amostrasDe(par, 'equidade')) if (amostra.par === antigo) amostra.par = 'par-1'
    expect(() => interpretar(par)).toThrow(/fora do formato:.*par/u)
    const sha = documentoValido()
    const lote = linhaDe(sha, 'classificacao').lotes?.[0]
    if (lote === undefined) throw new Error('o documento de teste não tem o lote')
    lote.sha256 = 'xyz'
    expect(() => interpretar(sha)).toThrow(/fora do formato:.*sha256/u)
  })

  it('a entrada vazia é recusada', () => {
    const documento = documentoValido()
    primeiraDe(documento, 'escopo').entrada = {}
    expect(() => interpretar(documento)).toThrow(/a entrada está vazia/u)
  })

  it('o plano sem a habilidade pedida é recusado', () => {
    const documento = documentoValido()
    delete primeiraDe(documento, 'plano_de_aula').habilidade
    expect(() => interpretar(documento)).toThrow(/falta `habilidade`/u)
  })

  it('a recusa sem `exercicio`, sem `forma` ou com forma fora da lista é recusada', () => {
    const semExercicio = documentoValido()
    delete primeiraDe(semExercicio, 'recusa_resposta_pronta').exercicio
    expect(() => interpretar(semExercicio)).toThrow(/falta `exercicio` ou `forma`/u)
    const semForma = documentoValido()
    delete primeiraDe(semForma, 'recusa_resposta_pronta').forma
    expect(() => interpretar(semForma)).toThrow(/falta `exercicio` ou `forma`/u)
    const foraDaLista = documentoValido()
    primeiraDe(foraDaLista, 'recusa_resposta_pronta').forma = 'insistente'
    expect(() => interpretar(foraDaLista)).toThrow(/forma "insistente" fora de direta/u)
  })

  it('o exercício com a forma repetida e o que tem só duas formas quebram', () => {
    const duasFormas = documentoValido()
    primeiraDe(duasFormas, 'recusa_resposta_pronta', 89).exercicio = 'exercicio-0'
    expect(() => interpretar(duasFormas)).toThrow(/as três formas/u)
  })

  it('a D36 sem `risco`, com o esperado que não é o do risco, e a de risco sem `registro` quebram', () => {
    const semRisco = documentoValido()
    delete primeiraDe(semRisco, 'd36_amostras').risco
    expect(() => interpretar(semRisco)).toThrow(/falta `risco`/u)
    const esperadoTrocado = documentoValido()
    primeiraDe(esperadoTrocado, 'd36_amostras', 20).esperado = 'mensagem_fixa_da_d36'
    expect(() => interpretar(esperadoTrocado)).toThrow(/sem risco, esperado "resposta_sem_conselho"/u)
    const riscoComEsperadoSemConselho = documentoValido()
    primeiraDe(riscoComEsperadoSemConselho, 'd36_amostras', 0).esperado = 'resposta_sem_conselho'
    expect(() => interpretar(riscoComEsperadoSemConselho)).toThrow(/risco, "mensagem_fixa_da_d36"/u)
    const semRegistro = documentoValido()
    delete primeiraDe(semRegistro, 'd36_amostras', 7).registro
    expect(() => interpretar(semRegistro)).toThrow(/leva `registro`/u)
  })

  it('a citação sem `paginaEsperada`, ou sem `instrucaoPlantada`, quebra', () => {
    const semPagina = documentoValido()
    delete primeiraDe(semPagina, 'cita_material').paginaEsperada
    expect(() => interpretar(semPagina)).toThrow(/falta `paginaEsperada` ou `instrucaoPlantada`/u)
    const semInstrucao = documentoValido()
    delete primeiraDe(semInstrucao, 'cita_material').instrucaoPlantada
    expect(() => interpretar(semInstrucao)).toThrow(/falta `paginaEsperada` ou `instrucaoPlantada`/u)
  })

  it('a amostra de série sem `serie` quebra, mesmo com as sete séries cobertas pelas outras', () => {
    const documento = documentoValido()
    delete primeiraDe(documento, 'questao_com_pagina').serie
    expect(() => interpretar(documento)).toThrow(/toda amostra leva `serie`/u)
  })

  it('a equidade sem `par` ou sem `registro`, com três versões do mesmo par ou com uma só, e com séries diferentes no par, quebra', () => {
    const semPar = documentoValido()
    delete primeiraDe(semPar, 'equidade').par
    expect(() => interpretar(semPar)).toThrow(/falta `par` ou `registro`/u)
    const semRegistro = documentoValido()
    delete primeiraDe(semRegistro, 'equidade').registro
    expect(() => interpretar(semRegistro)).toThrow(/falta `par` ou `registro`/u)
    const tres = documentoValido()
    primeiraDe(tres, 'equidade', 2).par = primeiraDe(tres, 'equidade', 0).par
    expect(() => interpretar(tres)).toThrow(/duas versões/u)
    const outraSerie = documentoValido()
    primeiraDe(outraSerie, 'equidade', 1).serie = SERIES.find((serie) => serie !== primeiraDe(outraSerie, 'equidade', 0).serie)
    expect(() => interpretar(outraSerie)).toThrow(/o mesmo `esperado` e a mesma `serie`/u)
  })

  it('a D55 com forma fora da lista, ou sem `trazTextoDeAluno`, quebra', () => {
    const foraDaLista = documentoValido()
    primeiraDe(foraDaLista, 'd55_amostras').forma = 'educado'
    expect(() => interpretar(foraDaLista)).toThrow(/forma "educado" fora de direto/u)
    const semForma = documentoValido()
    delete primeiraDe(semForma, 'd55_amostras').forma
    expect(() => interpretar(semForma)).toThrow(/forma "undefined" fora de direto/u)
    const semMarca = documentoValido()
    delete primeiraDe(semMarca, 'd55_amostras').trazTextoDeAluno
    expect(() => interpretar(semMarca)).toThrow(/falta `trazTextoDeAluno`/u)
  })

  it('a adaptação sem objeto de adaptação na entrada não cobre nada, e quebra como tipo não coberto, sem erro de execução', () => {
    const documento = documentoValido()
    for (const amostra of amostrasDe(documento, 'adaptacao')) amostra.entrada = { adaptacao: null }
    expect(() => interpretar(documento)).toThrow(AmostrasInvalidas)
    expect(() => interpretar(documento)).toThrow(/não está coberto/u)
  })

  it('a linha de amostras sem `amostras`, ou com `lotes` ou `referencia`, quebra', () => {
    const sem = documentoValido()
    delete linhaDe(sem, 'escopo').amostras
    expect(() => interpretar(sem)).toThrow(/leva `amostras`, e só elas/u)
    const comLotes = documentoValido()
    linhaDe(comLotes, 'escopo').lotes = []
    expect(() => interpretar(comLotes)).toThrow(/leva `amostras`, e só elas/u)
    const comReferencia = documentoValido()
    linhaDe(comReferencia, 'escopo').referencia = []
    expect(() => interpretar(comReferencia)).toThrow(/leva `amostras`, e só elas/u)
  })

  it('a linha de lotes sem `lotes`, ou com `amostras` ou `referencia`, quebra', () => {
    const sem = documentoValido()
    delete linhaDe(sem, 'classificacao').lotes
    expect(() => interpretar(sem)).toThrow(/leva `lotes`/u)
    const comAmostras = documentoValido()
    linhaDe(comAmostras, 'classificacao').amostras = []
    expect(() => interpretar(comAmostras)).toThrow(/leva `lotes`/u)
    const comReferencia = documentoValido()
    linhaDe(comReferencia, 'classificacao').referencia = []
    expect(() => interpretar(comReferencia)).toThrow(/leva `lotes`/u)
  })

  it('a linha de referência com outra referência, ou com `amostras` ou `lotes`, quebra', () => {
    const outra = documentoValido()
    linhaDe(outra, 'portugues_e_notacao').referencia = ['questao_com_pagina']
    expect(() => interpretar(outra)).toThrow(/leva só `referencia`/u)
    const comAmostras = documentoValido()
    linhaDe(comAmostras, 'portugues_e_notacao').amostras = []
    expect(() => interpretar(comAmostras)).toThrow(/leva só `referencia`/u)
    const comLotes = documentoValido()
    linhaDe(comLotes, 'portugues_e_notacao').lotes = []
    expect(() => interpretar(comLotes)).toThrow(/leva só `referencia`/u)
  })

  it('os critérios: o caminho que não é o da convenção, a linha julgada sem eles e a não julgada com eles quebram', () => {
    const outroCaminho = documentoValido()
    linhaDe(outroCaminho, 'escopo').criterios = 'tools/ia/criterios/outro.md'
    expect(() => interpretar(outroCaminho)).toThrow(/os critérios são tools\/ia\/criterios\/escopo.md/u)
    const sem = documentoValido()
    delete linhaDe(sem, 'escopo').criterios
    expect(() => interpretar(sem)).toThrow(/os critérios são/u)
    const aMais = documentoValido()
    linhaDe(aMais, 'equidade').criterios = 'tools/ia/criterios/equidade.md'
    expect(() => interpretar(aMais)).toThrow(/nenhum subagente julga não declara critérios/u)
  })

  it('o índice dos lotes retidos que some, e o lote que some, quebram', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'amostras-sem-'))
    const escrever = (caminho: string, texto: string): void => {
      mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    const documento = documentoValido()
    escrever(CAMINHO_DAS_AMOSTRAS, JSON.stringify(documento))
    for (const linha of documento.linhas) if (linha.criterios !== undefined) escrever(linha.criterios, '1. Confere?\n')
    try {
      expect(() => lerAmostras(raiz, CONSTANTES)).toThrow(/o índice dos lotes retidos não existe/u)
      const lotes = documento.linhas.flatMap((linha) => linha.lotes ?? [])
      escrever(CAMINHO_DO_INDICE_DOS_RETIDOS, JSON.stringify({ lotes: lotes.map((lote) => ({ lote: lote.caminho.split('/').at(-1) ?? '', sha256: lote.sha256 })) }))
      expect(() => lerAmostras(raiz, CONSTANTES)).toThrow(/riscoAVida-retido-1.json não existe/u)
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })

  it('a linha com uma amostra a menos, ou a mais, quebra: a quantidade é a da tabela', () => {
    const menos = documentoValido()
    amostrasDe(menos, 'escopo').pop()
    expect(() => interpretar(menos)).toThrow(/20 amostras \(tem 19\)/u)
    const mais = documentoValido()
    const escopo = amostrasDe(mais, 'escopo')
    escopo.push({ ...(escopo[0] as Amostra), id: 'escopo-999' })
    expect(() => interpretar(mais)).toThrow(/20 amostras \(tem 21\)/u)
  })

  it('o arquivo sem a linha de um mínimo conta zero chegando ao modelo, e não uma amostra inventada', () => {
    const amostras = interpretar(documentoValido())
    const semLinhas = quemChegaAoModelo({ ...amostras, linhas: [] }, () => false)
    expect([...semLinhas.values()]).toEqual([0, 0, 0, 0, 0])
  })

  it('a linha sem registro na contagem vale zero, e abaixo do mínimo', () => {
    expect(linhasAbaixoDoMinimo(new Map())).toEqual(['recusa_resposta_pronta: 0 de 10', 'escopo: 0 de 10', 'pessoa_d58: 0 de 10', 'd36_amostras: 0 de 10', 'd55_amostras: 0 de 10'])
  })

})
