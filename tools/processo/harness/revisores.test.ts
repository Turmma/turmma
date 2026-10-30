// O que os revisores repetem é um texto só, e o `executar-task` não guarda diário (X7, RF21 e RF22).
//
// Três coisas estragam sem que nada quebre. (1) O bloco de severidade, o das fotos da tela e as listas dos guardiões vivem em
// nove arquivos de `.claude/agents/`: quem mexe numa cópia e esquece as outras faz um revisor julgar por regra diferente de outro,
// e ninguém vê. (2) A lista "O que verificar" e o formato da resposta de um guardião com veto são o contrato dele com a Mesa e com
// o hook: a deduplicação não pode tocá-los, e a medida de antes (24/10/2026) está em `__fixtures__/revisores-antes/`, gravada antes
// de qualquer edição e nunca regravada, salvo o literal da marca de rotina sem escopo na linha 13 do `tenancy-guardian`, que a 4.0 de nomes-de-mercado trocou por `@Unscoped()` (nada mais dela muda). (3) O `executar-task` volta a crescer com cada incidente contado nele; os casos moram em
// `docs/processo-licoes.md`, com data e origem, e o arquivo fica abaixo de 500 linhas.
//
// Cada conferência é uma função sobre o texto (`Arquivos`: caminho a partir da raiz → conteúdo) e roda sobre o repositório e sobre
// uma amostra quebrada. Limite declarado: o teste prova que o texto está nos arquivos, não que o revisor o segue; e a comparação com a
// gravação de antes é exata (uma vírgula a mais é vermelha de propósito: lista de guardião com veto muda por tarefa própria).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REVISORES_COM_VETO, REVISORES_SEM_VETO } from '../revisoes.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

/** Caminho a partir da raiz → conteúdo. O que não existe não entra. */
type Arquivos = Record<string, string>

const AGENTES = '.claude/agents/'
const ANTES = 'tools/processo/harness/__fixtures__/revisores-antes/'
const EXECUTAR_TASK = '.claude/skills/executar-task/SKILL.md'
const MODELO_DA_TAREFA = '.claude/skills/criar-tasks/task-template.md'
const LICOES = 'docs/processo-licoes.md'

const GUARDIOES = ['tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian'] as const
/** Quem repete o bloco das fotos da tela com o mesmo começo e o mesmo fim (o `frontend-reviewer` tem a tela inteira, em outro título). */
const COM_FOTOS = ['privacy-guardian', 'conformidade-reviewer', 'revisor-geral', 'pedagogia-reviewer'] as const

const TITULO_DA_SEVERIDADE = '## Severidade e rodada nova'
const TITULO_DAS_FOTOS = '## Quando o prompt traz fotos da tela'
const TITULO_DA_AUTOCONFERENCIA = '## Autoconferência'

const LIMITE_DE_LINHAS = 500
const MAXIMO_DE_PERGUNTAS = 12
/** O que a conferência acha hoje; lista encurtada para calar o teste deixa de somar isto. */
const MINIMO_DE_PERGUNTAS = 10
const MINIMO_DE_LICOES = 20

/** Onde começa e onde termina a lista "O que verificar" de cada guardião: no privacy, ela é feita de várias seções. */
const LISTA_DO_GUARDIAO: Record<(typeof GUARDIOES)[number], { inicio: string; fim?: string }> = {
  'tenancy-guardian': { inicio: '## O que verificar' },
  'conformidade-reviewer': { inicio: '## O que verificar' },
  'infra-guardian': { inicio: '## O que verificar' },
  'privacy-guardian': { inicio: '## Checklist de coleta', fim: TITULO_DAS_FOTOS },
}

const ler = (caminho: string): string | null => {
  try {
    return readFileSync(caminho, 'utf8')
  } catch {
    return null
  }
}

/** Os arquivos que as conferências leem, do repositório. */
function carregar(): Arquivos {
  const caminhos = [
    ...REVISORES_COM_VETO.map((nome) => `${AGENTES}${nome}.md`),
    ...REVISORES_SEM_VETO.map((nome) => `${AGENTES}${nome}.md`),
    EXECUTAR_TASK,
    MODELO_DA_TAREFA,
    LICOES,
  ]
  const arquivos: Arquivos = {}
  for (const caminho of caminhos) {
    const texto = ler(join(RAIZ, caminho))
    if (texto !== null) arquivos[caminho] = texto
  }
  return arquivos
}

/** A gravação de antes: nunca muda com a amostra, porque é a medida de 24/10/2026. */
function carregarAntes(): Arquivos {
  const arquivos: Arquivos = {}
  for (const guardiao of GUARDIOES) {
    for (const parte of ['verificar', 'formato']) {
      const caminho = `${ANTES}${guardiao}.${parte}.md`
      const texto = ler(join(RAIZ, caminho))
      if (texto !== null) arquivos[caminho] = texto
    }
  }
  return arquivos
}

/** Da linha que é exatamente o título até a anterior ao próximo `## ` (ou o fim do arquivo). `null` quando o título não existe. */
function secao(texto: string, titulo: string, ate?: string): string | null {
  const linhas = texto.split('\n')
  const inicio = linhas.indexOf(titulo)
  if (inicio === -1) return null
  const fim = linhas.findIndex((linha, i) => i > inicio && (ate === undefined ? linha.startsWith('## ') : linha === ate))
  if (ate !== undefined && fim === -1) return null
  return `${linhas.slice(inicio, fim === -1 ? undefined : fim).join('\n').trimEnd()}\n`
}

/** Da linha do título até o fim do arquivo. */
function ateOFim(texto: string, comeco: RegExp): string | null {
  const linhas = texto.split('\n')
  const inicio = linhas.findIndex((linha) => comeco.test(linha))
  return inicio === -1 ? null : `${linhas.slice(inicio).join('\n').trimEnd()}\n`
}

const agente = (arquivos: Arquivos, nome: string): string | undefined => arquivos[`${AGENTES}${nome}.md`]

interface Conferencia {
  falhas: string[]
  /** Quantos textos a conferência comparou: zero é vermelho, porque uma pasta lida vazia deixaria tudo verde. */
  comparados: number
}

/** Os revisores de uma família têm a mesma seção de severidade, letra por letra. */
function conferirSeveridade(arquivos: Arquivos, familia: string, revisores: readonly string[]): Conferencia {
  const falhas: string[] = []
  let referencia: { nome: string; texto: string } | null = null
  let comparados = 0
  for (const nome of revisores) {
    const arquivo = agente(arquivos, nome)
    if (arquivo === undefined) {
      falhas.push(`revisor ausente (${familia}): ${AGENTES}${nome}.md`)
      continue
    }
    const texto = secao(arquivo, TITULO_DA_SEVERIDADE)
    if (texto === null) {
      falhas.push(`${nome} (${familia}) não tem a seção "${TITULO_DA_SEVERIDADE}"`)
      continue
    }
    comparados += 1
    if (referencia === null) referencia = { nome, texto }
    else if (texto !== referencia.texto) falhas.push(`${nome} (${familia}): a seção de severidade difere da de ${referencia.nome}`)
  }
  return { falhas, comparados }
}

/** Três parágrafos: o começo e o fim são iguais em todos; o do meio é do papel. */
function conferirFotos(arquivos: Arquivos): Conferencia {
  const falhas: string[] = []
  const comeco = new Map<string, string>()
  const fim = new Map<string, string>()
  for (const nome of COM_FOTOS) {
    const arquivo = agente(arquivos, nome)
    if (arquivo === undefined) {
      falhas.push(`revisor ausente (fotos): ${AGENTES}${nome}.md`)
      continue
    }
    const texto = secao(arquivo, TITULO_DAS_FOTOS)
    if (texto === null) {
      falhas.push(`${nome} não tem a seção "${TITULO_DAS_FOTOS}"`)
      continue
    }
    const paragrafos = texto
      .split('\n\n')
      .slice(1)
      .map((paragrafo) => paragrafo.trim())
      .filter(Boolean)
    if (paragrafos.length !== 3) {
      falhas.push(`${nome}: o bloco das fotos tem ${paragrafos.length} parágrafos, e o modelo tem três (começo, o do papel, fim)`)
      continue
    }
    comeco.set(nome, paragrafos[0] ?? '')
    fim.set(nome, paragrafos[2] ?? '')
  }
  falhas.push(...compararParte('o começo', comeco), ...compararParte('o fim', fim))
  return { falhas, comparados: comeco.size + fim.size }
}

/** Cada parágrafo da parte é igual ao do primeiro revisor que a tem. */
function compararParte(parte: string, textos: Map<string, string>): string[] {
  const falhas: string[] = []
  const [referencia, textoDeReferencia] = [...textos.entries()][0] ?? []
  for (const [nome, texto] of textos) {
    if (texto !== textoDeReferencia) falhas.push(`${nome}: ${parte} do bloco das fotos difere do de ${referencia}`)
  }
  return falhas
}

/** A lista "O que verificar" e o formato da resposta de cada guardião com veto são os de antes, sem uma vírgula a mais. */
function conferirGuardioes(arquivos: Arquivos, antes: Arquivos): Conferencia {
  const falhas: string[] = []
  let comparados = 0
  for (const nome of GUARDIOES) {
    const arquivo = agente(arquivos, nome)
    if (arquivo === undefined) {
      falhas.push(`guardião ausente: ${AGENTES}${nome}.md`)
      continue
    }
    const lista = LISTA_DO_GUARDIAO[nome]
    const verificar = secao(arquivo, lista.inicio, lista.fim)
    const formato = ateOFim(arquivo, /^## Formato/)
    const gravadoVerificar = antes[`${ANTES}${nome}.verificar.md`]
    const gravadoFormato = antes[`${ANTES}${nome}.formato.md`]
    if (gravadoVerificar === undefined || gravadoFormato === undefined) {
      falhas.push(`a gravação de antes de ${nome} não existe em ${ANTES}`)
      continue
    }
    if (verificar === null) falhas.push(`${nome}: a lista "${lista.inicio}" não existe mais`)
    else {
      comparados += 1
      if (verificar !== gravadoVerificar) falhas.push(`${nome}: a lista "O que verificar" difere da gravada em ${ANTES}`)
    }
    if (formato === null) falhas.push(`${nome}: o bloco do formato da resposta não existe mais`)
    else {
      comparados += 1
      if (formato !== gravadoFormato) falhas.push(`${nome}: o formato da resposta difere do gravado em ${ANTES}`)
    }
  }
  return { falhas, comparados }
}

const totalDeLinhas = (texto: string): number => texto.trimEnd().split('\n').length

const LINHA_DE_LICAO = /^\|/
const DATA_DA_LICAO = /^(?:até )?\d{4}-\d{2}-\d{2}(?: e \d{4}-\d{2}-\d{2})?$/

/** As lições são a seção 1 do documento; a 2 (19.0) é a auditoria das skills, que tem outras colunas e não tem data. Sem a seção 1, o corte sai vazio ou sem tabela, e a conferência acusa o mínimo de lições. */
function soAsLicoes(documento: string): string {
  const linhas = documento.split('\n')
  const inicio = linhas.findIndex((linha) => linha.startsWith('## 1. '))
  const fim = linhas.findIndex((linha, i) => i > inicio && linha.startsWith('## '))
  return linhas.slice(inicio, fim === -1 ? undefined : fim).join('\n')
}

/** As linhas de dado da tabela de lições (menos o cabeçalho e o traço), em colunas. */
function linhasDeLicao(texto: string): string[][] {
  return soAsLicoes(texto)
    .split('\n')
    .filter((linha) => LINHA_DE_LICAO.test(linha))
    .map((linha) =>
      linha
        .split('|')
        .slice(1, -1)
        .map((celula) => celula.trim()),
    )
    .filter((colunas) => colunas[0] !== 'Data' && !/^-+$/.test(colunas[0] ?? ''))
}

/** Cada lição tem data, origem, o que aconteceu e o lugar onde a regra ficou. */
function conferirLicoes(documento: string): { falhas: string[]; licoes: number } {
  const falhas: string[] = []
  const linhas = linhasDeLicao(documento)
  if (linhas.length < MINIMO_DE_LICOES) falhas.push(`${LICOES} tem ${linhas.length} lições, e a conferência espera ao menos ${MINIMO_DE_LICOES}`)
  linhas.forEach((colunas, i) => {
    if (!DATA_DA_LICAO.test(colunas[0] ?? '')) falhas.push(`${LICOES}, lição ${i + 1}: a data ${JSON.stringify(colunas[0] ?? '')} não é AAAA-MM-DD`)
    if ((colunas[1] ?? '') === '') falhas.push(`${LICOES}, lição ${i + 1}: sem origem`)
    if ((colunas[2] ?? '') === '') falhas.push(`${LICOES}, lição ${i + 1}: sem o que aconteceu`)
    if ((colunas[3] ?? '') === '') falhas.push(`${LICOES}, lição ${i + 1}: sem o lugar onde a regra ficou`)
  })
  return { falhas, licoes: linhas.length }
}

/** A autoconferência do modelo da tarefa tem de dez a doze perguntas numeradas. */
function conferirPerguntas(modelo: string): { falhas: string[]; perguntas: number } {
  const falhas: string[] = []
  const corpo = secao(modelo, TITULO_DA_AUTOCONFERENCIA)
  if (corpo === null) return { falhas: [`${MODELO_DA_TAREFA} não tem a seção "${TITULO_DA_AUTOCONFERENCIA}"`], perguntas: 0 }
  const perguntas = corpo.split('\n').filter((linha) => /^\d+\. \*\*/.test(linha)).length
  if (perguntas > MAXIMO_DE_PERGUNTAS) falhas.push(`${MODELO_DA_TAREFA}: a autoconferência tem ${perguntas} perguntas, e o limite é ${MAXIMO_DE_PERGUNTAS}`)
  if (perguntas < MINIMO_DE_PERGUNTAS) falhas.push(`${MODELO_DA_TAREFA}: a autoconferência tem ${perguntas} perguntas, e a conferência espera ao menos ${MINIMO_DE_PERGUNTAS}`)
  return { falhas, perguntas }
}

/** O `executar-task` abaixo de 500 linhas, os casos com data e origem em `docs/processo-licoes.md`, e a autoconferência no modelo. */
function conferirExecutarTask(arquivos: Arquivos): Conferencia & { licoes: number; perguntas: number } {
  const falhas: string[] = []
  const skill = arquivos[EXECUTAR_TASK]
  if (skill === undefined) falhas.push(`arquivo ausente: ${EXECUTAR_TASK}`)
  else {
    const linhas = totalDeLinhas(skill)
    if (linhas >= LIMITE_DE_LINHAS) falhas.push(`${EXECUTAR_TASK} tem ${linhas} linhas, e o limite é ${LIMITE_DE_LINHAS - 1}`)
    if (!skill.includes(LICOES)) falhas.push(`${EXECUTAR_TASK} não aponta para ${LICOES}, onde os casos foram`)
    if (!skill.includes(MODELO_DA_TAREFA)) falhas.push(`${EXECUTAR_TASK} não aponta para ${MODELO_DA_TAREFA}, onde está a autoconferência`)
  }

  let licoes = 0
  const documento = arquivos[LICOES]
  if (documento === undefined) falhas.push(`arquivo ausente: ${LICOES}`)
  else {
    const lidas = conferirLicoes(documento)
    licoes = lidas.licoes
    falhas.push(...lidas.falhas)
  }

  let perguntas = 0
  const modelo = arquivos[MODELO_DA_TAREFA]
  if (modelo === undefined) falhas.push(`arquivo ausente: ${MODELO_DA_TAREFA}`)
  else {
    const lidas = conferirPerguntas(modelo)
    perguntas = lidas.perguntas
    falhas.push(...lidas.falhas)
  }
  return { falhas, comparados: licoes + perguntas, licoes, perguntas }
}

/** Uma cópia dos arquivos com um deles reescrito; a amostra precisa mudar o texto, ou não prova nada. */
function estragar(arquivos: Arquivos, caminho: string, mudar: (texto: string) => string): Arquivos {
  const antes = arquivos[caminho]
  expect(antes, `a amostra precisa de ${caminho}`).toBeDefined()
  const depois = mudar(antes ?? '')
  expect(depois, 'a amostra precisa mudar o arquivo, ou o teste não prova nada').not.toBe(antes)
  return { ...arquivos, [caminho]: depois }
}

function semArquivo(arquivos: Arquivos, caminho: string): Arquivos {
  const { [caminho]: _fora, ...resto } = arquivos
  expect(_fora, `a amostra precisa de ${caminho}`).toBeDefined()
  return resto
}

/** Acrescenta uma palavra à primeira linha que começa com `- ` dentro da seção, ou, na falta, à última linha dela. */
const mudarNaSecao =
  (titulo: string, ate?: string) =>
  (texto: string): string => {
    const corpo = secao(texto, titulo, ate)
    expect(corpo, `a amostra precisa da seção ${titulo}`).not.toBeNull()
    const linhas = (corpo ?? '').trimEnd().split('\n')
    const alvo = linhas.length - 1
    const mudada = [...linhas.slice(0, alvo), `${linhas[alvo]} (a mais)`].join('\n')
    return texto.replace((corpo ?? '').trimEnd(), mudada)
  }

const hoje = carregar()
const antes = carregarAntes()

describe('RF21: o que os revisores repetem é um texto só', () => {
  it('a severidade de hoje é igual nos seis com veto e nos três sem veto, e a conferência compara os nove', () => {
    const comVeto = conferirSeveridade(hoje, 'com veto', REVISORES_COM_VETO)
    const semVeto = conferirSeveridade(hoje, 'sem veto', REVISORES_SEM_VETO)
    expect(comVeto.falhas).toEqual([])
    expect(semVeto.falhas).toEqual([])
    expect(comVeto.comparados).toBeGreaterThanOrEqual(6)
    expect(semVeto.comparados).toBeGreaterThanOrEqual(3)
  })

  it.each([...REVISORES_COM_VETO].map((nome) => [nome, 'com veto', REVISORES_COM_VETO] as const))(
    'uma palavra a mais na severidade de %s (%s): vermelho, dizendo quem',
    (nome, familia, revisores) => {
      const amostra = estragar(hoje, `${AGENTES}${nome}.md`, mudarNaSecao(TITULO_DA_SEVERIDADE))
      const { falhas } = conferirSeveridade(amostra, familia, revisores)
      expect(falhas.length).toBeGreaterThan(0)
      expect(falhas.join('\n')).toContain(nome)
    },
  )

  it.each([...REVISORES_SEM_VETO].map((nome) => [nome, 'sem veto', REVISORES_SEM_VETO] as const))(
    'uma palavra a mais na severidade de %s (%s): vermelho, dizendo quem',
    (nome, familia, revisores) => {
      const amostra = estragar(hoje, `${AGENTES}${nome}.md`, mudarNaSecao(TITULO_DA_SEVERIDADE))
      const { falhas } = conferirSeveridade(amostra, familia, revisores)
      expect(falhas.join('\n')).toContain(nome)
    },
  )

  it('a seção de severidade some de um revisor: vermelho', () => {
    const amostra = estragar(hoje, `${AGENTES}test-engineer.md`, (texto) => texto.replace(TITULO_DA_SEVERIDADE, '## Outro título'))
    expect(conferirSeveridade(amostra, 'com veto', REVISORES_COM_VETO).falhas).toContain(`test-engineer (com veto) não tem a seção "${TITULO_DA_SEVERIDADE}"`)
  })

  it('revisor ausente da amostra: vermelho, e a conferência não se cala', () => {
    const amostra = semArquivo(hoje, `${AGENTES}infra-guardian.md`)
    expect(conferirSeveridade(amostra, 'com veto', REVISORES_COM_VETO).falhas).toContain(`revisor ausente (com veto): ${AGENTES}infra-guardian.md`)
  })

  it('pasta sem nenhum revisor: tudo vermelho, e nada comparado', () => {
    const vazia = conferirSeveridade({}, 'com veto', REVISORES_COM_VETO)
    expect(vazia.falhas).toHaveLength(REVISORES_COM_VETO.length)
    expect(vazia.comparados).toBe(0)
  })

  it('o bloco das fotos de hoje tem o mesmo começo e o mesmo fim nos quatro, e a conferência os compara', () => {
    const { falhas, comparados } = conferirFotos(hoje)
    expect(falhas).toEqual([])
    expect(comparados).toBe(COM_FOTOS.length * 2)
  })

  it.each(COM_FOTOS.map((nome) => [nome] as const))('o começo do bloco das fotos de %s diferente: vermelho, dizendo quem', (nome) => {
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, (texto) => texto.replace('Leia-os como imagem', 'Leia como imagem'))
    expect(conferirFotos(amostra).falhas.join('\n')).toContain(nome)
  })

  it.each(COM_FOTOS.map((nome) => [nome] as const))('o fim do bloco das fotos de %s diferente: vermelho, dizendo quem', (nome) => {
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, (texto) => texto.replace('você olha a sua regra.', 'você olha a regra.'))
    expect(conferirFotos(amostra).falhas.join('\n')).toContain(nome)
  })

  it('o bloco das fotos que volta a ser um parágrafo só: vermelho', () => {
    const amostra = estragar(hoje, `${AGENTES}revisor-geral.md`, (texto) => {
      const corpo = secao(texto, TITULO_DAS_FOTOS) ?? ''
      const primeiro = corpo.indexOf('\n\n')
      return texto.replace(corpo.trimEnd(), corpo.trimEnd().replace(/\n\n/g, (par, posicao: number) => (posicao === primeiro ? par : ' ')))
    })
    expect(conferirFotos(amostra).falhas.some((falha) => falha.startsWith('revisor-geral: o bloco das fotos tem 1 parágrafos'))).toBe(true)
  })

  it('revisor das fotos ausente da amostra: vermelho', () => {
    const amostra = semArquivo(hoje, `${AGENTES}pedagogia-reviewer.md`)
    const { falhas, comparados } = conferirFotos(amostra)
    expect(falhas).toContain(`revisor ausente (fotos): ${AGENTES}pedagogia-reviewer.md`)
    expect(comparados).toBe((COM_FOTOS.length - 1) * 2)
  })

  it('o bloco das fotos some de um revisor: vermelho', () => {
    const amostra = estragar(hoje, `${AGENTES}pedagogia-reviewer.md`, (texto) => texto.replace(TITULO_DAS_FOTOS, '## Fotos'))
    expect(conferirFotos(amostra).falhas).toContain(`pedagogia-reviewer não tem a seção "${TITULO_DAS_FOTOS}"`)
  })
})

describe('a leitura de uma seção', () => {
  it('a última seção do arquivo vai até o fim; com um fim declarado que não existe, não há seção', () => {
    expect(secao('# T\n\n## A\nx\n', '## A')).toBe('## A\nx\n')
    expect(secao('## A\nx\n## B\ny\n', '## A')).toBe('## A\nx\n')
    expect(secao('## A\nx\n## B\ny\n', '## A', '## C')).toBeNull()
    expect(secao('## A\nx\n## B\ny\n', '## A', '## B')).toBe('## A\nx\n')
  })
})

describe('RF21: a lista e o formato dos guardiões com veto não mudam', () => {
  it('os de hoje são os de antes, e a conferência compara oito textos', () => {
    const { falhas, comparados } = conferirGuardioes(hoje, antes)
    expect(falhas).toEqual([])
    expect(comparados).toBe(GUARDIOES.length * 2)
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('a gravação de antes de %s tem a lista e o formato inteiros', (nome) => {
    const verificar = antes[`${ANTES}${nome}.verificar.md`] ?? ''
    const formato = antes[`${ANTES}${nome}.formato.md`] ?? ''
    // Uma gravação encurtada deixaria a comparação verde sem proteger nada.
    expect(totalDeLinhas(verificar), `${nome}: lista`).toBeGreaterThanOrEqual(12)
    expect(totalDeLinhas(formato), `${nome}: formato`).toBeGreaterThanOrEqual(12)
    expect(formato).toContain('VEREDITO: APROVADO | REPROVADO')
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('um item a mais na lista "O que verificar" de %s: vermelho, dizendo quem', (nome) => {
    const lista = LISTA_DO_GUARDIAO[nome]
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, mudarNaSecao(lista.inicio, lista.fim))
    expect(conferirGuardioes(amostra, antes).falhas).toContain(`${nome}: a lista "O que verificar" difere da gravada em ${ANTES}`)
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('o formato da resposta de %s diferente: vermelho, dizendo quem', (nome) => {
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, (texto) => texto.replace('VEREDITO: APROVADO | REPROVADO', 'VEREDITO: APROVADO | REPROVADO | DUVIDA'))
    expect(conferirGuardioes(amostra, antes).falhas).toContain(`${nome}: o formato da resposta difere do gravado em ${ANTES}`)
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('guardião ausente da amostra (%s): vermelho, e a conferência não se cala', (nome) => {
    const amostra = semArquivo(hoje, `${AGENTES}${nome}.md`)
    const { falhas, comparados } = conferirGuardioes(amostra, antes)
    expect(falhas).toContain(`guardião ausente: ${AGENTES}${nome}.md`)
    expect(comparados).toBe((GUARDIOES.length - 1) * 2)
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('a lista de %s apagada: vermelho, dizendo que não existe mais', (nome) => {
    const lista = LISTA_DO_GUARDIAO[nome]
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, (texto) => texto.replace(lista.inicio, '## Outro título'))
    expect(conferirGuardioes(amostra, antes).falhas).toContain(`${nome}: a lista "${lista.inicio}" não existe mais`)
  })

  it.each(['verificar', 'formato'])('só a gravação de antes do %s some: vermelho, um caso por parte', (parte) => {
    const parcial = Object.fromEntries(Object.entries(antes).filter(([caminho]) => !caminho.endsWith(`.${parte}.md`)))
    const { falhas } = conferirGuardioes(hoje, parcial)
    expect(falhas).toHaveLength(GUARDIOES.length)
    expect(falhas.every((falha) => falha.includes('a gravação de antes'))).toBe(true)
  })

  it.each(GUARDIOES.map((nome) => [nome] as const))('o bloco do formato de %s apagado: vermelho, dizendo que não existe mais', (nome) => {
    const amostra = estragar(hoje, `${AGENTES}${nome}.md`, (texto) => texto.replace('## Formato', '## Final'))
    expect(conferirGuardioes(amostra, antes).falhas).toContain(`${nome}: o bloco do formato da resposta não existe mais`)
  })

  it('a gravação de antes some: vermelho, e não verde por não ter com o que comparar', () => {
    const { falhas } = conferirGuardioes(hoje, {})
    expect(falhas).toHaveLength(GUARDIOES.length)
    expect(falhas.every((falha) => falha.includes('a gravação de antes'))).toBe(true)
  })

  it('o fim da lista do privacy-guardian some (as fotos): vermelho, em vez de ler até o fim do arquivo', () => {
    const amostra = estragar(hoje, `${AGENTES}privacy-guardian.md`, (texto) => texto.replace(TITULO_DAS_FOTOS, '## Fotos'))
    expect(conferirGuardioes(amostra, antes).falhas).toContain(`privacy-guardian: a lista "## Checklist de coleta" não existe mais`)
  })
})

describe('RF22: o executar-task sem diário de incidentes', () => {
  it('o arquivo de hoje está abaixo de 500 linhas, os casos têm data e origem, e a autoconferência está no modelo', () => {
    const { falhas, licoes, perguntas } = conferirExecutarTask(hoje)
    expect(falhas).toEqual([])
    expect(licoes).toBeGreaterThanOrEqual(MINIMO_DE_LICOES)
    expect(perguntas).toBeGreaterThanOrEqual(MINIMO_DE_PERGUNTAS)
    expect(perguntas).toBeLessThanOrEqual(MAXIMO_DE_PERGUNTAS)
    expect(totalDeLinhas(hoje[EXECUTAR_TASK] ?? '')).toBeLessThan(LIMITE_DE_LINHAS)
  })

  it('500 linhas: vermelho; 499: verde', () => {
    const com = (linhas: number): Arquivos => estragar(hoje, EXECUTAR_TASK, (texto) => `${texto}${'linha\n'.repeat(linhas - totalDeLinhas(texto))}`)
    expect(conferirExecutarTask(com(500)).falhas).toContain(`${EXECUTAR_TASK} tem 500 linhas, e o limite é 499`)
    expect(conferirExecutarTask(com(499)).falhas).toEqual([])
  })

  it('o executar-task que não aponta para as lições nem para a autoconferência: vermelho, um caso por apontamento', () => {
    const semLicoes = estragar(hoje, EXECUTAR_TASK, (texto) => texto.replaceAll(LICOES, 'docs/outro.md'))
    expect(conferirExecutarTask(semLicoes).falhas).toContain(`${EXECUTAR_TASK} não aponta para ${LICOES}, onde os casos foram`)
    const semPerguntas = estragar(hoje, EXECUTAR_TASK, (texto) => texto.replaceAll(MODELO_DA_TAREFA, 'docs/outro.md'))
    expect(conferirExecutarTask(semPerguntas).falhas).toContain(`${EXECUTAR_TASK} não aponta para ${MODELO_DA_TAREFA}, onde está a autoconferência`)
  })

  it('o documento de lições ausente: vermelho', () => {
    const amostra = semArquivo(hoje, LICOES)
    expect(() => conferirExecutarTask(amostra)).not.toThrow()
    expect(conferirExecutarTask(amostra).falhas).toContain(`arquivo ausente: ${LICOES}`)
  })

  it('lição sem data, com data que não é AAAA-MM-DD, sem origem, sem o que aconteceu e sem o lugar da regra: vermelho, um caso cada', () => {
    const primeira = (linhasDeLicao(hoje[LICOES] ?? '')[0] ?? []).join(' | ')
    expect(primeira.length).toBeGreaterThan(0)
    const [data = '', origem = '', fato = '', lugar = ''] = linhasDeLicao(hoje[LICOES] ?? '')[0] ?? []
    const trocar = (colunas: string[]): Arquivos => estragar(hoje, LICOES, (texto) => texto.replace(`| ${[data, origem, fato, lugar].join(' | ')} |`, `| ${colunas.join(' | ')} |`))
    expect(conferirExecutarTask(trocar(['', origem, fato, lugar])).falhas.join('\n')).toContain('lição 1: a data "" não é AAAA-MM-DD')
    expect(conferirExecutarTask(trocar(['24/10/2026', origem, fato, lugar])).falhas.join('\n')).toContain('lição 1: a data "24/10/2026" não é AAAA-MM-DD')
    expect(conferirExecutarTask(trocar([data, '', fato, lugar])).falhas).toContain(`${LICOES}, lição 1: sem origem`)
    expect(conferirExecutarTask(trocar([data, origem, '', lugar])).falhas).toContain(`${LICOES}, lição 1: sem o que aconteceu`)
    expect(conferirExecutarTask(trocar([data, origem, fato, ''])).falhas).toContain(`${LICOES}, lição 1: sem o lugar onde a regra ficou`)
  })

  it('o documento de lições encurtado abaixo do mínimo: vermelho', () => {
    const amostra = estragar(hoje, LICOES, (texto) => texto.split('\n').filter((linha) => !/^\| (?:até )?2026-10/.test(linha)).join('\n'))
    expect(conferirExecutarTask(amostra).falhas.some((falha) => falha.includes('lições, e a conferência espera ao menos'))).toBe(true)
  })

  it('a seção 1 conta inteira quando é a última do arquivo, e a auditoria das skills não soma lição', () => {
    const documento = hoje[LICOES] ?? ''
    const soASecao1 = documento.slice(0, documento.indexOf('\n## 2. ')).trimEnd()
    expect(soASecao1.length, 'a amostra precisa cortar a seção 2').toBeLessThan(documento.length)
    expect(conferirLicoes(soASecao1).licoes).toBe(conferirLicoes(documento).licoes)
  })

  it('a auditoria das skills (seção 2) não conta como lição, e sem a seção 1 não há lição nenhuma', () => {
    const lidas = conferirLicoes(hoje[LICOES] ?? '')
    expect(lidas.falhas).toEqual([])
    const semASecao1 = estragar(hoje, LICOES, (texto) => texto.replace('## 1. O que saiu', '## Um. O que saiu'))
    expect(conferirExecutarTask(semASecao1).falhas.some((falha) => falha.includes('0 lições'))).toBe(true)
  })

  it('treze perguntas na autoconferência: vermelho; doze: verde', () => {
    const com = (n: number): Arquivos =>
      estragar(hoje, MODELO_DA_TAREFA, (texto) => {
        const corpo = secao(texto, TITULO_DA_AUTOCONFERENCIA) ?? ''
        const atuais = corpo.split('\n').filter((linha) => /^\d+\. \*\*/.test(linha)).length
        const extras = Array.from({ length: Math.max(0, n - atuais) }, (_, i) => `${atuais + i + 1}. **Pergunta a mais ${i + 1}.** Texto.`).join('\n')
        return texto.replace(corpo.trimEnd(), `${corpo.trimEnd()}\n${extras}`)
      })
    expect(conferirExecutarTask(com(MAXIMO_DE_PERGUNTAS + 1)).falhas.some((falha) => falha.includes('a autoconferência tem 13 perguntas'))).toBe(true)
    expect(conferirExecutarTask(com(MAXIMO_DE_PERGUNTAS)).falhas).toEqual([])
  })

  it('nove perguntas na autoconferência: vermelho', () => {
    const amostra = estragar(hoje, MODELO_DA_TAREFA, (texto) => {
      const corpo = secao(texto, TITULO_DA_AUTOCONFERENCIA) ?? ''
      const sem = corpo
        .split('\n')
        .filter((linha) => !/^(?:10|11|12)\. \*\*/.test(linha))
        .join('\n')
      return texto.replace(corpo.trimEnd(), sem.trimEnd())
    })
    expect(conferirExecutarTask(amostra).falhas.some((falha) => falha.includes('a autoconferência tem 9 perguntas'))).toBe(true)
  })

  it('o modelo sem a seção "Autoconferência", ou sem o modelo: vermelho', () => {
    const semSecao = estragar(hoje, MODELO_DA_TAREFA, (texto) => texto.replace(TITULO_DA_AUTOCONFERENCIA, '## Outra coisa'))
    expect(conferirExecutarTask(semSecao).falhas).toContain(`${MODELO_DA_TAREFA} não tem a seção "${TITULO_DA_AUTOCONFERENCIA}"`)
    const semModelo = semArquivo(hoje, MODELO_DA_TAREFA)
    expect(() => conferirExecutarTask(semModelo)).not.toThrow()
    expect(conferirExecutarTask(semModelo).falhas).toContain(`arquivo ausente: ${MODELO_DA_TAREFA}`)
  })

  it('o executar-task ausente: vermelho', () => {
    const amostra = semArquivo(hoje, EXECUTAR_TASK)
    expect(() => conferirExecutarTask(amostra)).not.toThrow()
    expect(conferirExecutarTask(amostra).falhas).toContain(`arquivo ausente: ${EXECUTAR_TASK}`)
  })
})
