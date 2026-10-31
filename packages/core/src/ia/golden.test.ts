import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  type Amostra,
  type Base,
  type Corpus,
  diferencasDaBase,
  entradaDoPedidoDeRespostaPronta,
  interpretarCorpus,
  interpretarMedidas,
  lerCorpus,
  lerJson,
  lerMedidas,
  medir,
  type Medida,
  GoldenRejectedError,
  POLITICAS,
  type Politica,
  quedasDaBase,
  raizDoOuro,
  semOsNaoMedidos,
  tarefaConcluidaNaLista,
  turnosDoProfessor,
} from './__fixtures__/golden.js'
import { atribuiNotaOuConceito, conversaPedeJulgamentoDeTextoDeAluno, conversaTrazTextoDeAluno, julgaTextoDeAluno } from './tasks/propor-ferramenta.js'
import { ehAssuntoDelicado, mencionaRiscoAVida, pedeRespostaPronta } from './tasks/turno-do-tutor.js'

/**
 * O `ouro` (`docs/aia/ouro/`) contra as funções de hoje. A 1.0 reproduziu a `base` que o Arquiteto gravou em 21/10/2026,
 * categoria por categoria, e ligou o piso de `assuntoDelicado`, `pedidoDeRespostaPronta` e `saidaComNota`. A 2.0 mudou regra: o
 * `riscoAVida` passa a valer pelo alvo (a reprodução exata deu lugar a ele, de propósito), `ameaca_a_terceiro` tem o piso, e o
 * `assuntoDelicado`, que recebe os mesmos padrões, não pode cair. As outras duas são medidas e impressas; o alvo delas liga na 3.0.
 *
 * **O `ouro` v1 de `riscoAVida` foi lido na 2.0 para escrever os padrões.** Por isso, além do alvo (que não muda), o teste "o `ouro`
 * v1 de `riscoAVida`, lido na 2.0, não perde nenhuma amostra" é **regressão exata**: toda amostra fora de `ameaca_a_terceiro`
 * decide como o `esperado` dela. Ele prova que nada que a 2.0 mediu caiu depois, e não que o padrão reconhece frase que não
 * conhecia: essa medida é do lote retido, em `onda-0.md` §2.1 ("Quem escreve o padrão não lê o `ouro`").
 */

type Objeto = Record<string, unknown>

const CORPORA = Object.fromEntries(POLITICAS.map((politica) => [politica, lerCorpus(politica)])) as Record<Politica, Corpus>
const MEDIDAS = lerMedidas()

const imprimir = (linha: string): void => {
  process.stdout.write(`${linha}\n`)
}

function linhaDaMedida(rotulo: string, medida: Medida): string {
  const categorias = Object.entries(medida.porCategoria).map(([categoria, { certos, total }]) => `${categoria} ${String(certos)}/${String(total)}`)
  return `ouro ${rotulo}: recall ${String(medida.recall)} (${String(medida.barradasDasPositivas)}/${String(medida.positivas)}), precisão ${String(medida.precisao)}; ${categorias.join(', ')}`
}

const IDS_QUE_A_MENSAGEM_NOMEIA = 40

/** As amostras que a função errou, por id, para o teste dizer quais foram e não só quantas; passando de 40, diz quantas ficaram de fora. */
function quaisErraram(amostras: readonly Amostra[], barra: (amostra: Amostra) => boolean): string {
  const erradas = amostras.filter((amostra) => barra(amostra) !== (amostra.esperado === 'casa')).map((amostra) => `${amostra.id} ${amostra.categoria}`)
  const demais = erradas.length - IDS_QUE_A_MENSAGEM_NOMEIA
  return `erraram ${String(erradas.length)}: ${erradas.slice(0, IDS_QUE_A_MENSAGEM_NOMEIA).join('; ')}${demais > 0 ? `; e mais ${String(demais)}` : ''}`
}

const BARRAS: Record<Politica, (amostra: Amostra) => boolean> = {
  riscoAVida: (amostra) => mencionaRiscoAVida(amostra.texto),
  assuntoDelicado: (amostra) => ehAssuntoDelicado(amostra.texto),
  pedidoDeRespostaPronta: (amostra) => pedeRespostaPronta(entradaDoPedidoDeRespostaPronta(amostra)),
  julgamentoDeTextoDeAluno: (amostra) => conversaPedeJulgamentoDeTextoDeAluno(amostra.texto, turnosDoProfessor(amostra)),
  saidaComNota: (amostra) => atribuiNotaOuConceito(amostra.texto),
  // README do `ouro`: a saída é o `texto`; a conversa é o pedido (`mensagemDoProfessor`) e os turnos do professor.
  saidaQualitativa: (amostra) => julgaTextoDeAluno(amostra.texto, conversaTrazTextoDeAluno(amostra.contexto?.mensagemDoProfessor ?? '', turnosDoProfessor(amostra))),
}

/** O que a política mede hoje: as amostras do alvo e a função do README ("Como medir"). */
function medirHoje(politica: Politica): { medida: Medida; amostras: Amostra[]; barra: (amostra: Amostra) => boolean } {
  const barra = BARRAS[politica]
  const todas = CORPORA[politica].amostras
  const amostras = politica === 'julgamentoDeTextoDeAluno' ? semOsNaoMedidos(todas, MEDIDAS.julgamentoDeTextoDeAluno.alvo.medidoSem) : todas
  const foraDoAlvo = politica === 'riscoAVida' ? MEDIDAS.riscoAVida.foraDoAlvo : []
  return { medida: medir(amostras, barra, foraDoAlvo), amostras, barra }
}

function amostra(parcial: Partial<Amostra> & Pick<Amostra, 'id' | 'categoria'>): Amostra {
  return { texto: 'texto', esperado: 'casa', fonte: 'sintetica', ...parcial }
}

/** Recusou, de verdade: o zod ou o cruzamento com o corpus. Qualquer outro erro (um `TypeError` do próprio teste) sobe, e não vira "recusado". */
function recusa(funcao: () => unknown): boolean {
  try {
    funcao()
    return false
  } catch (erro) {
    if (erro instanceof ZodError || erro instanceof GoldenRejectedError) return true
    throw erro
  }
}

/** Os caminhos de todo objeto do JSON: o corpus e o MEDIDAS não têm campo livre, e o dicionário de categorias recusa a chave que não existe. */
type Caminho = (string | number)[]
function objetosDoJson(valor: unknown, caminho: Caminho = []): Caminho[] {
  if (Array.isArray(valor)) return valor.flatMap((item: unknown, indice) => objetosDoJson(item, [...caminho, indice]))
  if (valor === null || typeof valor !== 'object') return []
  const filhos = Object.entries(valor).flatMap(([chave, filho]) => objetosDoJson(filho, [...caminho, chave]))
  return [caminho, ...filhos]
}

function comChaveAMais(bruto: unknown, caminho: Caminho): unknown {
  const copia = structuredClone(bruto)
  let alvo = copia as Record<string | number, unknown>
  for (const passo of caminho) alvo = alvo[passo] as Record<string | number, unknown>
  alvo['chaveAMais'] = 1
  return copia
}

const medidasBrutas = (): Objeto => structuredClone(lerJson('MEDIDAS.json') as Objeto)
const dentro = (pai: Objeto, ...chaves: string[]): Objeto => chaves.reduce<Objeto>((atual, chave) => atual[chave] as Objeto, pai)
const interpretar = (bruto: unknown, tarefaConcluida: (tarefa: string) => boolean = () => false): unknown => interpretarMedidas(bruto, CORPORA, tarefaConcluida)

describe('o leitor do ouro', () => {
  it('os seis arquivos são lidos com as contagens do desenho', () => {
    const esperado: Record<Politica, { total: number; casa: number; comContexto: number }> = {
      riscoAVida: { total: 128, casa: 82, comContexto: 0 },
      assuntoDelicado: { total: 84, casa: 54, comContexto: 0 },
      pedidoDeRespostaPronta: { total: 80, casa: 42, comContexto: 80 },
      julgamentoDeTextoDeAluno: { total: 90, casa: 57, comContexto: 13 },
      saidaComNota: { total: 65, casa: 35, comContexto: 0 },
      saidaQualitativa: { total: 99, casa: 58, comContexto: 99 },
    }
    for (const politica of POLITICAS) {
      const amostras = CORPORA[politica].amostras
      expect(CORPORA[politica].politica).toBe(politica)
      expect(
        { total: amostras.length, casa: amostras.filter((a) => a.esperado === 'casa').length, comContexto: amostras.filter((a) => a.contexto !== undefined).length },
        politica,
      ).toEqual(esperado[politica])
    }
    expect(CORPORA.julgamentoDeTextoDeAluno.amostras.filter((a) => a.fonte === 'revisor').map((a) => a.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `JT-${String(i + 1).padStart(3, '0')}`),
    )
  })

  it('amostra com campo a mais é recusada', () => {
    const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
    bruto.amostras[0] = { ...bruto.amostras[0], pessoa: 'Maria' }
    expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
  })

  it('toda chave a mais é recusada, em cada objeto do corpus e do MEDIDAS', () => {
    const aceitas: string[] = []
    for (const politica of POLITICAS) {
      const bruto = lerJson(`${politica}.json`)
      for (const caminho of objetosDoJson(bruto)) {
        if (!recusa(() => interpretarCorpus(politica, comChaveAMais(bruto, caminho)))) aceitas.push(`${politica}/${caminho.join('.')}`)
      }
    }
    const medidas = lerJson('MEDIDAS.json')
    for (const caminho of objetosDoJson(medidas)) {
      if (!recusa(() => interpretar(comChaveAMais(medidas, caminho)))) aceitas.push(`MEDIDAS/${caminho.join('.')}`)
    }
    expect(aceitas).toEqual([])
  })

  it('fonte fora de sintetica e revisor é recusada', () => {
    const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
    bruto.amostras[0] = { ...bruto.amostras[0], fonte: 'aluno_real' }
    expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
  })

  it('esperado fora de casa e nao_casa é recusado', () => {
    const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
    bruto.amostras[0] = { ...bruto.amostras[0], esperado: 'talvez' }
    expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
  })

  it('contexto com chave fora das quatro do README é recusado', () => {
    const bruto = lerJson('pedidoDeRespostaPronta.json') as { amostras: Objeto[] }
    bruto.amostras[0] = { ...bruto.amostras[0], contexto: { comQuestao: true, nomeDoAluno: 'Maria' } }
    expect(recusa(() => interpretarCorpus('pedidoDeRespostaPronta', bruto))).toBe(true)
  })

  it('id repetido no mesmo corpus é recusado', () => {
    const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
    bruto.amostras[1] = { ...bruto.amostras[1], id: bruto.amostras[0]?.['id'] }
    expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
  })

  it('id fora do formato de duas letras e três algarismos é recusado', () => {
    const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
    bruto.amostras[0] = { ...bruto.amostras[0], id: 'maria-1' }
    expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
  })

  describe('valor inválido de campo do corpus é recusado', () => {
    const doContexto: [string, unknown][] = [
      ['comQuestao que não é verdadeiro nem falso', { comQuestao: 'sim' }],
      ['turnoAnteriorDoAluno vazio', { turnoAnteriorDoAluno: '' }],
      ['turnosDoProfessor com turno vazio', { turnosDoProfessor: [''] }],
      ['turnosDoProfessor que não é lista', { turnosDoProfessor: 'um texto' }],
      ['mensagemDoProfessor vazia', { mensagemDoProfessor: '' }],
    ]
    it.each(doContexto)('contexto com %s', (_nome, contexto) => {
      const bruto = lerJson('pedidoDeRespostaPronta.json') as { amostras: Objeto[] }
      bruto.amostras[0] = { ...bruto.amostras[0], contexto }
      expect(recusa(() => interpretarCorpus('pedidoDeRespostaPronta', bruto))).toBe(true)
    })

    const daAmostra: [string, Objeto][] = [
      ['texto vazio', { texto: '' }],
      ['categoria vazia', { categoria: '' }],
    ]
    it.each(daAmostra)('amostra com %s', (_nome, troca) => {
      const bruto = lerJson('riscoAVida.json') as { amostras: Objeto[] }
      bruto.amostras[0] = { ...bruto.amostras[0], ...troca }
      expect(recusa(() => interpretarCorpus('riscoAVida', bruto))).toBe(true)
    })

    const doCorpus: [string, Objeto][] = [
      ['regra vazia', { regra: '' }],
      ['escritoPor vazio', { escritoPor: '' }],
      ['versao zero', { versao: 0 }],
      ['versao fracionada', { versao: 1.5 }],
      ['nenhuma amostra', { amostras: [] }],
    ]
    it.each(doCorpus)('corpus com %s', (_nome, troca) => {
      expect(recusa(() => interpretarCorpus('riscoAVida', { ...(lerJson('riscoAVida.json') as Objeto), ...troca }))).toBe(true)
    })
  })

  it('o arquivo de outra política não é lido como esta', () => {
    expect(recusa(() => interpretarCorpus('assuntoDelicado', lerJson('riscoAVida.json')))).toBe(true)
  })

  it('chave de alvo desconhecida no MEDIDAS é recusada', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'riscoAVida', 'alvo')['recallMinimo'] = 0.5
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it('o MEDIDAS que o Arquiteto gravou é aceito', () => {
    expect(() => interpretar(lerJson('MEDIDAS.json'))).not.toThrow()
  })

  describe('categoria e id do MEDIDAS que não existem no corpus', () => {
    const falsa = { certos: 0, total: 1 }
    const casos: [string, (bruto: Objeto) => void][] = [
      ['base de riscoAVida', (bruto) => (dentro(bruto, 'riscoAVida', 'base', 'porCategoria')['inventada'] = falsa)],
      ['base de assuntoDelicado', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['inventada'] = falsa)],
      ['base de pedidoDeRespostaPronta', (bruto) => (dentro(bruto, 'pedidoDeRespostaPronta', 'base', 'porCategoria')['inventada'] = falsa)],
      ['base de julgamentoDeTextoDeAluno', (bruto) => (dentro(bruto, 'julgamentoDeTextoDeAluno', 'base', 'porCategoria')['inventada'] = falsa)],
      ['base de saidaComNota', (bruto) => (dentro(bruto, 'saidaComNota', 'base', 'porCategoria')['inventada'] = falsa)],
      ['base de saidaQualitativa', (bruto) => (dentro(bruto, 'saidaQualitativa', 'base', 'porCategoria')['inventada'] = falsa)],
      ['perdaMaxima', (bruto) => (dentro(bruto, 'riscoAVida', 'alvo', 'perdaMaxima')['inventada'] = 1)],
      ['foraDoAlvo', (bruto) => (bruto['riscoAVida'] as { foraDoAlvo: string[] }).foraDoAlvo.push('inventada')],
      ['pisoForaDoAlvo', (bruto) => (dentro(bruto, 'riscoAVida', 'pisoForaDoAlvo')['inventada'] = 'nao_cair_da_base')],
      ['semCasar', (bruto) => (dentro(bruto, 'julgamentoDeTextoDeAluno', 'alvo')['semCasar'] as string[]).push('inventada')],
      ['naoCairDaBase', (bruto) => (dentro(bruto, 'julgamentoDeTextoDeAluno', 'alvo')['naoCairDaBase'] as string[]).push('inventada')],
      ['medidoSem, que cita um id', (bruto) => (dentro(bruto, 'julgamentoDeTextoDeAluno', 'alvo')['medidoSem'] as string[]).push('JT-999')],
    ]
    it.each(casos)('%s', (_nome, estraga) => {
      const bruto = medidasBrutas()
      estraga(bruto)
      expect(recusa(() => interpretar(bruto))).toBe(true)
    })
  })

  it('base nula sem semBaseAte é recusada', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'saidaQualitativa')['base'] = null
    delete dentro(bruto, 'saidaQualitativa')['semBaseAte']
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it('base nula depois da tarefa de semBaseAte fica vermelha, e antes dela não', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'saidaQualitativa')['base'] = null
    expect(dentro(bruto, 'saidaQualitativa')['semBaseAte']).toBe('3.0')
    expect(recusa(() => interpretar(bruto, (tarefa) => tarefa === '3.0'))).toBe(true)
    expect(recusa(() => interpretar(bruto, (tarefa) => tarefa === '2.0'))).toBe(false)
  })

  it('política nova com alvo nao_cair_da_base é recusada', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'saidaQualitativa')['alvo'] = 'nao_cair_da_base'
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it.each(['assuntoDelicado', 'pedidoDeRespostaPronta', 'saidaComNota'])('o alvo de %s é nao_cair_da_base, e nenhum outro texto', (politica) => {
    const bruto = medidasBrutas()
    dentro(bruto, politica)['alvo'] = 'qualquer_coisa'
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it.each(['assuntoDelicado', 'saidaComNota'])('base nula só vale em saidaQualitativa: %s não a aceita', (politica) => {
    const bruto = medidasBrutas()
    dentro(bruto, politica)['base'] = null
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it('o piso fora do alvo só aceita nao_cair_da_base', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'riscoAVida', 'pisoForaDoAlvo')['ameaca_a_terceiro'] = 'tanto_faz'
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it('erraPara só aceita mais', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'riscoAVida', 'alvo')['erraPara'] = 'menos'
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  it('recall e precisão fora de zero a um são recusados', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'assuntoDelicado', 'base')['recall'] = 1.5
    expect(recusa(() => interpretar(bruto))).toBe(true)
    const negativo = medidasBrutas()
    dentro(negativo, 'assuntoDelicado', 'base')['precisao'] = -0.1
    expect(recusa(() => interpretar(negativo))).toBe(true)
  })

  it('categoria com mais certos que total é recusada', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['luto'] = { certos: 7, total: 6 }
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  describe('valor inválido de campo do MEDIDAS é recusado', () => {
    const casos: [string, (bruto: Objeto) => void][] = [
      ['certos negativo', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['luto'] = { certos: -1, total: 6 })],
      ['certos fracionado', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['luto'] = { certos: 1.5, total: 6 })],
      ['total fracionado', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['luto'] = { certos: 4, total: 6.5 })],
      ['total zero', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base', 'porCategoria')['luto'] = { certos: 0, total: 0 })],
      ['medidaEm que não é uma data', (bruto) => (dentro(bruto, 'assuntoDelicado', 'base')['medidaEm'] = 'ontem')],
      ['perdaMaxima negativa', (bruto) => (dentro(bruto, 'riscoAVida', 'alvo', 'perdaMaxima')['explicita'] = -1)],
      ['perdaMaxima fracionada', (bruto) => (dentro(bruto, 'riscoAVida', 'alvo', 'perdaMaxima')['explicita'] = 0.5)],
      ['legitimasBarradas negativo', (bruto) => (dentro(bruto, 'saidaQualitativa', 'alvo')['legitimasBarradas'] = -1)],
      ['legitimasBarradas fracionado', (bruto) => (dentro(bruto, 'saidaQualitativa', 'alvo')['legitimasBarradas'] = 0.5)],
    ]
    it.each(casos)('%s', (_nome, estraga) => {
      const bruto = medidasBrutas()
      estraga(bruto)
      expect(recusa(() => interpretar(bruto))).toBe(true)
    })
  })

  it('semBaseAte só aceita o número de uma tarefa do documento', () => {
    const bruto = medidasBrutas()
    dentro(bruto, 'saidaQualitativa')['semBaseAte'] = 'depois'
    expect(recusa(() => interpretar(bruto))).toBe(true)
  })

  describe('a tarefa concluída se lê da lista de tarefas', () => {
    const pastas: string[] = []
    afterAll(() => {
      for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
    })
    function listaCom(linhas: string[]): (tarefa: string) => boolean {
      const raiz = mkdtempSync(join(tmpdir(), 'ouro-tasks-'))
      pastas.push(raiz)
      mkdirSync(join(raiz, 'tasks/prd-reengenharia'), { recursive: true })
      writeFileSync(join(raiz, 'tasks/prd-reengenharia/tasks.md'), `# Tarefas\n\n${linhas.join('\n')}\n`)
      return tarefaConcluidaNaLista(raiz)
    }

    it('só a tarefa marcada com x conta, e 13.0 não conta como 3.0', () => {
      const concluida = listaCom(['- [x] **1.0 — A**', '- [ ] **3.0 — C**', '- [x] **13.0 — D**'])
      expect(concluida('1.0')).toBe(true)
      expect(concluida('3.0')).toBe(false)
      expect(concluida('13.0')).toBe(true)
      expect(listaCom(['- [x] **13.0 — D**', '- [ ] **3.0 — C**'])('3.0')).toBe(false)
    })

    it('a tarefa marcada em qualquer linha da lista conta', () => {
      expect(listaCom(['- [ ] **1.0 — A**', '  - [x] 1.1 sub', '- [x] **3.0 — C**'])('3.0')).toBe(true)
    })

    it('o ponto de 3.0 não casa qualquer caractere', () => {
      expect(listaCom(['- [x] **3x0 — C**'])('3.0')).toBe(false)
    })

    /**
     * O `ouro` copiado para `<raiz>/docs/aia/ouro`, com a lista de tarefas em `<raiz>/tasks/prd-reengenharia/`. A base de
     * `saidaQualitativa` da cópia é nula, como a do `MEDIDAS` real antes de a 3.0 gravá-la: é a base nula que o caso prova
     * recusada quando a lista marca a 3.0.
     */
    function repositorioFabricado(linhaDaTarefa: string): string {
      const raiz = mkdtempSync(join(tmpdir(), 'ouro-repo-'))
      pastas.push(raiz)
      mkdirSync(join(raiz, 'docs/aia'), { recursive: true })
      cpSync(raizDoOuro(), join(raiz, 'docs/aia/ouro'), { recursive: true })
      const medidas = lerJson('MEDIDAS.json', join(raiz, 'docs/aia/ouro')) as Objeto
      dentro(medidas, 'saidaQualitativa')['base'] = null
      writeFileSync(join(raiz, 'docs/aia/ouro/MEDIDAS.json'), JSON.stringify(medidas, null, 2))
      mkdirSync(join(raiz, 'tasks/prd-reengenharia'), { recursive: true })
      writeFileSync(join(raiz, 'tasks/prd-reengenharia/tasks.md'), `# Tarefas\n\n${linhaDaTarefa}\n`)
      return join(raiz, 'docs/aia/ouro')
    }

    it('lerMedidas lê a lista de tarefas três pastas acima do ouro', () => {
      expect(() => lerMedidas(repositorioFabricado('- [ ] **3.0 — C**'))).not.toThrow()
      expect(() => lerMedidas(repositorioFabricado('- [x] **3.0 — C**'))).toThrow(GoldenRejectedError)
    })
  })

  describe('o auxiliar que diz que recusou', () => {
    it('o erro de outro tipo sobe, e não vira recusa', () => {
      expect(() =>
        recusa(() => {
          throw new TypeError('defeito do próprio teste')
        }),
      ).toThrow(TypeError)
      expect(recusa(() => undefined)).toBe(false)
    })
  })

  describe('o aviso de quem errou', () => {
    const casa = (indice: number): Amostra => amostra({ id: `ZZ-${String(indice).padStart(3, '0')}`, categoria: 'K' })

    it('nomeia por id as que a função errou, e só as que errou', () => {
      const amostras = [casa(1), casa(2), amostra({ id: 'ZZ-003', categoria: 'K', esperado: 'nao_casa' })]
      expect(quaisErraram(amostras, (a) => a.id === 'ZZ-001')).toBe('erraram 1: ZZ-002 K')
    })

    it('passando de 40 ids, diz quantos ficaram de fora', () => {
      const muitas = Array.from({ length: 45 }, (_, i) => casa(i + 1))
      const aviso = quaisErraram(muitas, () => false)
      expect(aviso).toMatch(/^erraram 45: /)
      expect(aviso).toContain('ZZ-040 K')
      expect(aviso).not.toContain('ZZ-041')
      expect(aviso).toMatch(/; e mais 5$/)
      expect(quaisErraram(muitas.slice(0, 40), () => false)).not.toContain('e mais')
    })
  })

  it('a raiz resolvida de uma URL de módulo fabricada é a pasta do ouro dessa raiz', () => {
    expect(raizDoOuro('file:///fabricada/packages/core/src/ia/__fixtures__/golden.ts')).toBe('/fabricada/docs/aia/ouro')
    expect(raizDoOuro()).toMatch(/\/docs\/aia\/ouro$/)
  })
})

describe('o que a 1.0 passa à função', () => {
  it('comQuestao verdadeiro vira questão definida, e falso ou ausente não', () => {
    expect(entradaDoPedidoDeRespostaPronta(amostra({ id: 'PR-900', categoria: 'direta', contexto: { comQuestao: true } })).questao).toBeDefined()
    const sem = entradaDoPedidoDeRespostaPronta(amostra({ id: 'PR-901', categoria: 'direta', contexto: { comQuestao: false } }))
    expect(sem).not.toHaveProperty('questao')
    expect(entradaDoPedidoDeRespostaPronta(amostra({ id: 'PR-902', categoria: 'direta' }))).not.toHaveProperty('questao')
  })

  it('turnoAnteriorDoAluno vira o último turno do aluno', () => {
    const entrada = entradaDoPedidoDeRespostaPronta(amostra({ id: 'PR-903', categoria: 'insistencia', texto: 'e aí?', contexto: { comQuestao: true, turnoAnteriorDoAluno: 'é a b, né?' } }))
    expect(entrada).toMatchObject({ duvida: 'e aí?', turnosAnteriores: [{ autor: 'aluno', texto: 'é a b, né?' }] })
    expect(entradaDoPedidoDeRespostaPronta(amostra({ id: 'PR-904', categoria: 'direta', contexto: { comQuestao: true } })).turnosAnteriores).toEqual([])
  })

  it('turnosDoProfessor viram turnos do professor, na ordem', () => {
    expect(turnosDoProfessor(amostra({ id: 'JT-900', categoria: 'conversa', contexto: { turnosDoProfessor: ['primeiro', 'segundo'] } }))).toEqual([
      { autor: 'professor', texto: 'primeiro' },
      { autor: 'professor', texto: 'segundo' },
    ])
    expect(turnosDoProfessor(amostra({ id: 'JT-901', categoria: 'conversa' }))).toEqual([])
  })

  it('o medidoSem tira do julgamento as 12 do revisor, e só elas', () => {
    const medidas = semOsNaoMedidos(CORPORA.julgamentoDeTextoDeAluno.amostras, MEDIDAS.julgamentoDeTextoDeAluno.alvo.medidoSem)
    expect(medidas).toHaveLength(78)
    expect(medidas.every((a) => a.fonte === 'sintetica')).toBe(true)
    expect(medidas.filter((a) => a.esperado === 'casa')).toHaveLength(45)
  })
})

describe('o medidor', () => {
  const amostras = [
    amostra({ id: 'AA-001', categoria: 'X' }),
    amostra({ id: 'AA-002', categoria: 'X' }),
    amostra({ id: 'AA-003', categoria: 'X' }),
    amostra({ id: 'AA-004', categoria: 'Y', esperado: 'nao_casa' }),
    amostra({ id: 'AA-005', categoria: 'Y', esperado: 'nao_casa' }),
    amostra({ id: 'AA-006', categoria: 'Y', esperado: 'nao_casa' }),
    amostra({ id: 'AA-007', categoria: 'Z' }),
  ]
  const barradas = new Set(['AA-001', 'AA-003', 'AA-004', 'AA-005', 'AA-007'])
  const barra = (a: Amostra): boolean => barradas.has(a.id)

  it('conta o acerto de cada categoria: barrou a casa, deixou passar a nao_casa', () => {
    expect(medir(amostras, barra).porCategoria).toEqual({ X: { certos: 2, total: 3 }, Y: { certos: 1, total: 3 }, Z: { certos: 1, total: 1 } })
  })

  it('o recall é das casa, a precisão é do que foi barrado, e os dois em três casas', () => {
    expect(medir(amostras, barra)).toMatchObject({ recall: 0.75, precisao: 0.6, barradasDasPositivas: 3, positivas: 4 })
    expect(medir(amostras, (a) => ['AA-001', 'AA-003', 'AA-004'].includes(a.id))).toMatchObject({ recall: 0.5, precisao: 0.667 })
  })

  it('a categoria fora do alvo conta por categoria, mas não entra no recall nem na precisão', () => {
    const medida = medir(amostras, barra, ['Z'])
    expect(medida).toMatchObject({ recall: 0.667, precisao: 0.5, barradasDasPositivas: 2, positivas: 3 })
    expect(medida.porCategoria['Z']).toEqual({ certos: 1, total: 1 })
  })

  it('a função que não barra nada tem precisão zero, e não NaN', () => {
    expect(medir(amostras, () => false)).toMatchObject({ recall: 0, precisao: 0 })
    // E o recall de um conjunto sem nenhuma casa também: zero, e não NaN.
    expect(medir(amostras.filter((a) => a.esperado === 'nao_casa'), () => false)).toMatchObject({ recall: 0, precisao: 0 })
  })
})

describe('o comparador com a base', () => {
  const base: Base = {
    medidaEm: '2026-10-21',
    recall: 0.5,
    precisao: 0.8,
    porCategoria: { A: { certos: 3, total: 4 }, B: { certos: 2, total: 4 } },
  }
  const medida = (porCategoria: Medida['porCategoria'], extra: Partial<Medida> = {}): Medida => ({
    recall: 0.5,
    precisao: 0.8,
    porCategoria,
    barradasDasPositivas: 0,
    positivas: 0,
    ...extra,
  })

  it('a reprodução exata não tem diferença', () => {
    expect(diferencasDaBase(base, medida({ A: { certos: 3, total: 4 }, B: { certos: 2, total: 4 } }))).toEqual([])
  })

  it('a reprodução reprova diferença para cima, e também para baixo', () => {
    expect(diferencasDaBase(base, medida({ A: { certos: 4, total: 4 }, B: { certos: 2, total: 4 } }))).toHaveLength(1)
    expect(diferencasDaBase(base, medida({ A: { certos: 3, total: 4 }, B: { certos: 1, total: 4 } }))).toHaveLength(1)
  })

  it('a reprodução reprova o total diferente com o mesmo acerto', () => {
    expect(diferencasDaBase(base, medida({ A: { certos: 3, total: 5 }, B: { certos: 2, total: 4 } }))).toHaveLength(1)
  })

  it('a reprodução reprova categoria que falta e categoria que sobra', () => {
    expect(diferencasDaBase(base, medida({ A: { certos: 3, total: 4 } }))).toHaveLength(1)
    expect(diferencasDaBase(base, medida({ A: { certos: 3, total: 4 }, B: { certos: 2, total: 4 }, C: { certos: 1, total: 1 } }))).toHaveLength(1)
  })

  it('a reprodução reprova recall e precisão diferentes', () => {
    const iguais = { A: { certos: 3, total: 4 }, B: { certos: 2, total: 4 } }
    expect(diferencasDaBase(base, medida(iguais, { recall: 0.6 }))).toHaveLength(1)
    expect(diferencasDaBase(base, medida(iguais, { precisao: 0.7 }))).toHaveLength(1)
  })

  it('queda numa categoria com o total igual reprova', () => {
    const quedas = quedasDaBase(base, medida({ A: { certos: 2, total: 4 }, B: { certos: 3, total: 4 } }))
    expect(quedas).toHaveLength(1)
    expect(quedas[0]).toMatch(/^A:/)
  })

  it('subir não é queda, e igual também não', () => {
    expect(quedasDaBase(base, medida({ A: { certos: 4, total: 4 }, B: { certos: 2, total: 4 } }))).toEqual([])
  })

  it('categoria da base que a medida não tem é queda', () => {
    expect(quedasDaBase(base, medida({ A: { certos: 3, total: 4 } }))).toHaveLength(1)
  })
})

describe('as políticas contra a base e o alvo', () => {
  it('riscoAVida alcança o alvo: nenhuma categoria perde além da máxima, com ameaca_a_terceiro à parte', () => {
    const { medida, amostras, barra } = medirHoje('riscoAVida')
    imprimir(linhaDaMedida('riscoAVida', medida))
    const { perdaMaxima } = MEDIDAS.riscoAVida.alvo
    const acimaDaMaxima = Object.entries(perdaMaxima).flatMap(([categoria, maxima]) => {
      const { certos, total } = medida.porCategoria[categoria] ?? { certos: 0, total: 0 }
      return total - certos > maxima ? [`${categoria}: perdeu ${String(total - certos)} e o alvo aceita ${String(maxima)}`] : []
    })
    expect(acimaDaMaxima, quaisErraram(amostras, barra)).toEqual([])
    // O recall total é a soma das perdas máximas: 71 de 75.
    const perdaTotal = Object.values(perdaMaxima).reduce((soma, perda) => soma + perda, 0)
    expect(medida.barradasDasPositivas, quaisErraram(amostras, barra)).toBeGreaterThanOrEqual(medida.positivas - perdaTotal)
    expect(medida.positivas).toBe(75)
  })

  it('riscoAVida alcança o alvo: a precisão não cai, sem contar ameaca_a_terceiro', () => {
    const { medida, amostras, barra } = medirHoje('riscoAVida')
    expect(medida.precisao, quaisErraram(amostras, barra)).toBeGreaterThanOrEqual(MEDIDAS.riscoAVida.alvo.precisaoMinima)
  })

  it('o ouro v1 de riscoAVida, lido na 2.0, não perde nenhuma amostra: casa e nao_casa decidem como o esperado, fora ameaca_a_terceiro', () => {
    const { amostras, barra } = medirHoje('riscoAVida')
    const foraDoAlvo: readonly string[] = MEDIDAS.riscoAVida.foraDoAlvo
    const dentroDoAlvo = amostras.filter((amostra) => !foraDoAlvo.includes(amostra.categoria))
    expect(dentroDoAlvo.length).toBeGreaterThan(0)
    expect(quaisErraram(dentroDoAlvo, barra)).toBe('erraram 0: ')
  })

  it('ameaca_a_terceiro está fora do alvo e não cai da base: o piso é o que o padrão de hoje já acerta', () => {
    const { medida } = medirHoje('riscoAVida')
    const { base, pisoForaDoAlvo } = MEDIDAS.riscoAVida
    const piso = Object.fromEntries(Object.entries(base.porCategoria).filter(([categoria]) => categoria in pisoForaDoAlvo))
    expect(Object.keys(piso)).toEqual(['ameaca_a_terceiro'])
    expect(quedasDaBase({ ...base, porCategoria: piso }, medida)).toEqual([])
  })

  it('assuntoDelicado não cai da base em nenhuma categoria, inclusive em duvida_da_materia e tema_de_aula', () => {
    const { medida } = medirHoje('assuntoDelicado')
    imprimir(linhaDaMedida('assuntoDelicado', medida))
    expect(Object.keys(MEDIDAS.assuntoDelicado.base.porCategoria)).toEqual(expect.arrayContaining(['duvida_da_materia', 'tema_de_aula']))
    expect(quedasDaBase(MEDIDAS.assuntoDelicado.base, medida)).toEqual([])
  })

  it('pedidoDeRespostaPronta reproduz a base por categoria', () => {
    const { medida, amostras, barra } = medirHoje('pedidoDeRespostaPronta')
    imprimir(linhaDaMedida('pedidoDeRespostaPronta', medida))
    expect(diferencasDaBase(MEDIDAS.pedidoDeRespostaPronta.base, medida), quaisErraram(amostras, barra)).toEqual([])
  })

  it('pedidoDeRespostaPronta não cai da base em nenhuma categoria', () => {
    const { medida } = medirHoje('pedidoDeRespostaPronta')
    expect(quedasDaBase(MEDIDAS.pedidoDeRespostaPronta.base, medida)).toEqual([])
  })

  it('julgamentoDeTextoDeAluno alcança o alvo sem JT-001 a JT-012: recall, e imprime também com elas', () => {
    const { medida, amostras, barra } = medirHoje('julgamentoDeTextoDeAluno')
    imprimir(linhaDaMedida('julgamentoDeTextoDeAluno sem JT-001 a JT-012', medida))
    expect(medida.positivas).toBe(45)
    expect(medida.recall, quaisErraram(amostras, barra)).toBeGreaterThanOrEqual(MEDIDAS.julgamentoDeTextoDeAluno.alvo.recall)
    const com = medir(CORPORA.julgamentoDeTextoDeAluno.amostras, barra)
    imprimir(linhaDaMedida('julgamentoDeTextoDeAluno com JT-001 a JT-012', com))
    expect(com.positivas).toBe(57)
  })

  it('julgamentoDeTextoDeAluno: rubrica_antes e material_do_professor não casam, e as quatro categorias do alvo não caem da base', () => {
    const { medida, amostras, barra } = medirHoje('julgamentoDeTextoDeAluno')
    const { semCasar, naoCairDaBase } = MEDIDAS.julgamentoDeTextoDeAluno.alvo
    expect(semCasar).toEqual(['rubrica_antes', 'material_do_professor'])
    const casaram = semCasar.flatMap((categoria) => amostras.filter((amostra) => amostra.categoria === categoria && barra(amostra)).map((amostra) => `${amostra.id} ${categoria}`))
    expect(casaram).toEqual([])
    const { base } = MEDIDAS.julgamentoDeTextoDeAluno
    const piso = Object.fromEntries(Object.entries(base.porCategoria).filter(([categoria]) => naoCairDaBase.includes(categoria)))
    expect(Object.keys(piso).sort()).toEqual([...naoCairDaBase].sort())
    expect(quedasDaBase({ ...base, porCategoria: piso }, medida)).toEqual([])
  })

  it('saidaComNota reproduz a base por categoria', () => {
    const { medida, amostras, barra } = medirHoje('saidaComNota')
    imprimir(linhaDaMedida('saidaComNota', medida))
    expect(diferencasDaBase(MEDIDAS.saidaComNota.base, medida), quaisErraram(amostras, barra)).toEqual([])
  })

  it('saidaComNota não cai da base em nenhuma categoria', () => {
    const { medida } = medirHoje('saidaComNota')
    expect(quedasDaBase(MEDIDAS.saidaComNota.base, medida)).toEqual([])
  })

  it('saidaQualitativa alcança o alvo: recall nas positivas, e imprime a fração das legítimas barradas', () => {
    const { medida, amostras, barra } = medirHoje('saidaQualitativa')
    imprimir(linhaDaMedida('saidaQualitativa', medida))
    const legitimas = amostras.filter((amostra) => amostra.esperado === 'nao_casa')
    const barradas = legitimas.filter(barra)
    // A premissa de custo da Tech Spec (§8) é de 5 % dos pedidos barrados: o teste imprime o que o `ouro` mede.
    imprimir(`ouro saidaQualitativa: ${String(barradas.length)} de ${String(legitimas.length)} legítimas barradas (${String(Math.round((barradas.length / legitimas.length) * 1000) / 10)} %)`)
    expect(legitimas).toHaveLength(41)
    expect(medida.positivas).toBe(58)
    expect(medida.recall, quaisErraram(amostras, barra)).toBeGreaterThanOrEqual(MEDIDAS.saidaQualitativa.alvo.recall)
  })

  it('saidaQualitativa alcança o alvo: nenhuma legítima barrada (rubrica, critérios, lote, correção cega, conferência de entrega, material)', () => {
    const { amostras, barra } = medirHoje('saidaQualitativa')
    const barradas = amostras.filter((amostra) => amostra.esperado === 'nao_casa' && barra(amostra)).map((amostra) => `${amostra.id} ${amostra.categoria}`)
    expect(barradas.length, `barradas: ${barradas.join('; ')}`).toBeLessThanOrEqual(MEDIDAS.saidaQualitativa.alvo.legitimasBarradas)
  })
})
