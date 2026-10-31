// A skill de receitas aponta o guia, e a esteira acusa o caminho que some e a skill que se afasta dele (X7, RF32).
//
// A receita mora em `docs/guia-do-desenvolvedor.md` (§5), e as travas na §7. A skill `receitas-de-codigo` só aponta: para cada
// `### 5.x` do guia há uma linha com o exemplo real e as travas que pegam o erro, sem copiar a receita (RF21). Duas coisas
// estragam isto sem que nada avise: o exemplo mudar de lugar no guia e a skill continuar mandando copiar o velho, e uma receita
// nova entrar no guia sem linha na skill. A conferência lê tudo do disco, sobre uma pasta-raiz, e roda sobre o repositório e sobre
// amostras quebradas em pasta temporária.
//
// O que conta como caminho é o da 16.0 (`caminhos.ts`): do que a extração devolve, só o que começa por uma pasta da raiz. Limites
// declarados: o teste prova que o caminho existe e que o exemplo está na linha `Exemplo:` da seção, não que o exemplo ainda é um bom
// exemplo; a trava é conferida contra o texto da coluna "Trava" da §7, não contra o que ela de fato barra; o código na skill é achado
// pela forma (cerca ou recuo de quatro espaços), e lista recuada de propósito também é acusada; e o nome da skill no guia, no
// `executar-task` e no modelo da Tech Spec é achado como texto, na seção que o RF32 aponta.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ehCaminho, extrairCaminhos, problemaDoCaminho } from './caminhos.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

const SKILL = '.claude/skills/receitas-de-codigo/SKILL.md'
const GUIA = 'docs/guia-do-desenvolvedor.md'
const EXECUTAR_TASK = '.claude/skills/executar-task/SKILL.md'
const MODELO_DA_TECHSPEC = '.claude/skills/criar-techspec/template.md'
const CLAUDE_MD = 'CLAUDE.md'
const NOME_DA_SKILL = 'receitas-de-codigo'

const LIMITE_DE_LINHAS = 60
const LIMITE_DE_BYTES = 6_000

/** Os seis assuntos que o Claude Code usa para carregar a skill: a `description` precisa trazer a palavra de cada um. */
const ASSUNTOS: Record<string, RegExp> = {
  endpoint: /\bendpoint\b/i,
  tabela: /\btabela\b/i,
  job: /\bjob\b/i,
  IA: /\bIA\b/,
  tela: /\btela\b/i,
  isolamento: /\bisolamento\b/i,
}

/** O que a conferência acha hoje; lista encurtada para calar o teste deixa de somar isto. */
const MINIMO_DE_RECEITAS = 6
const MINIMO_DE_TRAVAS = 16
const MINIMO_DE_CAMINHOS_DA_SKILL = 6
const MINIMO_DE_CAMINHOS_DA_SECAO_5 = 20
const MINIMO_DE_CAMINHOS_DA_SECAO_6 = 5
const MINIMO_DE_CAMINHOS_DA_SECAO_7 = 8

const lerOuNulo = (caminho: string): string | null => {
  try {
    return readFileSync(caminho, 'utf8')
  } catch {
    return null
  }
}

/** Do título que casa até o próximo `## `, ou até o fim; `null` quando o título não existe. */
function secao(texto: string, titulo: RegExp): string | null {
  const linhas = texto.split('\n')
  const inicio = linhas.findIndex((linha) => titulo.test(linha))
  if (inicio === -1) return null
  const fim = linhas.findIndex((linha, indice) => indice > inicio && linha.startsWith('## '))
  return linhas.slice(inicio, fim === -1 ? undefined : fim).join('\n')
}

const celulasDe = (linha: string): string[] =>
  linha
    .split('|')
    .slice(1, -1)
    .map((celula) => celula.trim())

/** As linhas de dados de uma tabela: sem o cabeçalho e sem a linha de traços. */
const linhasDeDados = (texto: string): string[] => texto.split('\n').filter((linha) => linha.startsWith('|')).slice(2)

const caminhosDe = (texto: string): string[] => extrairCaminhos(texto).filter(ehCaminho).map((caminho) => caminho.replace(/^\.\//, ''))

interface Receita {
  numero: string
  /** Os caminhos da raiz que estão nas linhas com `Exemplo:` da seção. */
  exemplos: Set<string>
}

interface Guia {
  secao5: string
  secao6: string
  secao7: string
  receitas: Receita[]
  /** O texto exato de cada célula da coluna "Trava" da §7. */
  travas: Set<string>
}

/** As `### 5.x` da §5, cada uma com os caminhos das suas linhas `Exemplo:`; seção sem nenhum é falha. */
function receitasDoGuia(secao5: string, falhas: string[]): Receita[] {
  const partes = secao5.split(/^(?=### 5\.\d+\b)/m).slice(1)
  return partes.map((parte) => {
    const numero = /^### (5\.\d+)/.exec(parte)?.[1] ?? ''
    const linhas = parte.split('\n').filter((linha) => linha.includes('Exemplo:'))
    const exemplos = new Set(linhas.flatMap(caminhosDe))
    if (exemplos.size === 0) falhas.push(`${GUIA}: a ${numero} não tem linha Exemplo: com caminho da raiz`)
    return { numero, exemplos }
  })
}

function lerGuia(raiz: string, falhas: string[]): Guia | null {
  const texto = lerOuNulo(join(raiz, GUIA))
  if (texto === null) {
    falhas.push(`${GUIA} não existe`)
    return null
  }
  const secoes = [5, 6, 7].map((numero) => secao(texto, new RegExp(`^## ${numero}\\. `)))
  for (const [indice, achada] of secoes.entries()) {
    if (achada === null) falhas.push(`${GUIA} não tem a §${indice + 5}`)
  }
  const achadas = secoes.filter((achada): achada is string => achada !== null)
  if (achadas.length < secoes.length) return null
  const [secao5 = '', secao6 = '', secao7 = ''] = achadas
  const receitas = receitasDoGuia(secao5, falhas)
  if (receitas.length === 0) falhas.push(`${GUIA}: a §5 não tem nenhuma ### 5.x`)
  const travas = new Set(linhasDeDados(secao7).map((linha) => celulasDe(linha)[0] ?? ''))
  return { secao5, secao6, secao7, receitas, travas }
}

/** O texto do começo da `description` do frontmatter; `null` quando o frontmatter ou a `description` faltam. */
function descricaoDa(skill: string): string | null {
  const bloco = /^---\n([\s\S]*?)\n---/.exec(skill)?.[1] ?? ''
  try {
    const dados: unknown = parse(bloco)
    const descricao: unknown = dados instanceof Object ? Reflect.get(dados, 'description') : null
    return typeof descricao === 'string' ? descricao : null
  } catch {
    return null
  }
}

/** A primeira linha de código da skill: cerca de ` ``` ` ou `~~~`, ou recuo de quatro espaços ou tabulação. */
function codigoNaSkill(skill: string): string | null {
  const linhas = skill.split('\n')
  const cerca = linhas.findIndex((linha) => /^ {0,3}(```|~~~)/.test(linha))
  if (cerca !== -1) return `cerca na linha ${cerca + 1}`
  const recuo = linhas.findIndex((linha) => /^( {4}|\t)/.test(linha))
  return recuo === -1 ? null : `recuo na linha ${recuo + 1}`
}

function conferirTamanhoECodigo(skill: string, falhas: string[]): void {
  const linhas = skill.replace(/\n$/, '').split('\n').length
  if (linhas > LIMITE_DE_LINHAS) falhas.push(`${SKILL} tem ${linhas} linhas, e o limite é ${LIMITE_DE_LINHAS}`)
  const bytes = Buffer.byteLength(skill)
  if (bytes > LIMITE_DE_BYTES) falhas.push(`${SKILL} tem ${bytes} B, e o limite é ${LIMITE_DE_BYTES}`)
  const codigo = codigoNaSkill(skill)
  if (codigo !== null) falhas.push(`${SKILL} tem código (${codigo})`)
}

function conferirDescricao(skill: string, falhas: string[]): void {
  const descricao = descricaoDa(skill)
  if (descricao === null) {
    falhas.push(`${SKILL}: o frontmatter não tem description`)
    return
  }
  for (const [assunto, palavra] of Object.entries(ASSUNTOS)) {
    if (!palavra.test(descricao)) falhas.push(`${SKILL}: a description não tem a palavra ${JSON.stringify(assunto)}`)
  }
}

/** O exemplo da linha: existe, tem pasta da raiz e está na linha `Exemplo:` da seção do guia (quando a seção existe). */
function conferirExemplo(exemplo: string, numero: string, receita: Receita | undefined, falhas: string[]): void {
  const exemplos = caminhosDe(exemplo)
  if (exemplo === '') falhas.push(`${SKILL}: a linha ${numero} não tem exemplo`)
  else if (exemplos.length === 0) falhas.push(`${SKILL}: o exemplo da linha ${numero} não tem pasta da raiz`)
  for (const caminho of receita === undefined ? [] : exemplos.filter((achado) => !receita.exemplos.has(achado))) {
    falhas.push(`${SKILL}: o exemplo ${caminho} da linha ${numero} não está na linha Exemplo: da ${numero} do guia`)
  }
}

/** As travas da linha, separadas por `;`: ao menos uma, e cada uma é a célula exata da coluna "Trava" da §7. */
function conferirTravas(travas: string, numero: string, guia: Guia, falhas: string[]): void {
  const citadas = travas.split(';').map((trava) => trava.trim()).filter((trava) => trava !== '')
  if (citadas.length === 0) falhas.push(`${SKILL}: a linha ${numero} não tem trava`)
  for (const trava of citadas.filter((citada) => !guia.travas.has(citada))) {
    falhas.push(`${SKILL}: a linha ${numero} cita a trava ${JSON.stringify(trava)}, que não é célula da coluna Trava da §7`)
  }
}

/** Uma linha da tabela da skill: a seção que ela aponta, o exemplo e as travas. `vistos` guarda as seções que já tiveram linha. */
function conferirLinha(linha: string, guia: Guia, vistos: Set<string>, falhas: string[]): void {
  const [primeira = '', exemplo = '', travas = ''] = celulasDe(linha)
  const numero = /^(5\.\d+)\b/.exec(primeira)?.[1]
  if (numero === undefined) {
    falhas.push(`${SKILL}: a linha ${JSON.stringify(primeira)} não começa pelo número de uma seção 5.x`)
    return
  }
  const receita = guia.receitas.find((achada) => achada.numero === numero)
  if (receita === undefined) falhas.push(`${SKILL}: a linha ${numero} aponta uma seção que o guia não tem`)
  if (vistos.has(numero)) falhas.push(`${SKILL}: a seção ${numero} tem mais de uma linha`)
  vistos.add(numero)
  conferirExemplo(exemplo, numero, receita, falhas)
  conferirTravas(travas, numero, guia, falhas)
}

/** Confere cada caminho da raiz do texto: o que não existe vira uma falha com o lugar que o cita. Devolve quantos caminhos conferiu. */
function conferirCaminhos(texto: string, lugar: string, raiz: string, falhas: string[]): number {
  const caminhos = extrairCaminhos(texto).filter(ehCaminho)
  for (const caminho of caminhos) {
    const problema = problemaDoCaminho(caminho, raiz)
    if (problema !== null) falhas.push(`${lugar} cita ${caminho}: ${problema}`)
  }
  return caminhos.length
}

interface Conferencia {
  falhas: string[]
  /** As `### 5.x` que o guia tem, e as linhas que a skill tem. */
  receitasDoGuia: number
  linhasDaSkill: number
  travasDaSecao7: number
  /** Quantos caminhos da raiz foram conferidos em cada lugar: zero é vermelho, porque lugar lido vazio deixaria tudo verde. */
  caminhos: { skill: number; secao5: number; secao6: number; secao7: number }
}

/** A skill e o guia: os caminhos, a tabela, os limites e a `description`. */
export function conferirReceitas(raiz: string): Conferencia {
  const falhas: string[] = []
  const caminhos = { skill: 0, secao5: 0, secao6: 0, secao7: 0 }
  const resultado = { falhas, receitasDoGuia: 0, linhasDaSkill: 0, travasDaSecao7: 0, caminhos }
  const guia = lerGuia(raiz, falhas)
  const skill = lerOuNulo(join(raiz, SKILL))
  if (skill === null) falhas.push(`${SKILL} não existe`)
  if (guia !== null) {
    caminhos.secao5 = conferirCaminhos(guia.secao5, `${GUIA} §5`, raiz, falhas)
    caminhos.secao6 = conferirCaminhos(guia.secao6, `${GUIA} §6`, raiz, falhas)
    caminhos.secao7 = conferirCaminhos(guia.secao7, `${GUIA} §7`, raiz, falhas)
    resultado.receitasDoGuia = guia.receitas.length
    resultado.travasDaSecao7 = guia.travas.size
  }
  if (skill === null) return resultado
  caminhos.skill = conferirCaminhos(skill, SKILL, raiz, falhas)
  conferirTamanhoECodigo(skill, falhas)
  conferirDescricao(skill, falhas)
  if (!/seção 11 da Tech Spec/.test(skill)) falhas.push(`${SKILL} não manda o desvio para a seção 11 da Tech Spec`)
  if (guia === null) return resultado
  const vistos = new Set<string>()
  const linhas = linhasDeDados(skill)
  resultado.linhasDaSkill = linhas.length
  for (const linha of linhas) conferirLinha(linha, guia, vistos, falhas)
  for (const receita of guia.receitas.filter((achada) => !vistos.has(achada.numero))) {
    falhas.push(`${SKILL}: a seção ${receita.numero} do guia não tem linha`)
  }
  return resultado
}

/** O nome da skill (ou o do guia) escrito no lugar que o RF32 aponta, em cada um dos quatro arquivos. */
export function conferirApontamentos(raiz: string): string[] {
  const falhas: string[] = []
  const apontamentos: { arquivo: string; onde: string; nome: string; trecho: (texto: string) => string | null }[] = [
    { arquivo: EXECUTAR_TASK, onde: 'a seção ## 1. Contexto', nome: NOME_DA_SKILL, trecho: (texto) => secao(texto, /^## 1\. Contexto/) },
    { arquivo: MODELO_DA_TECHSPEC, onde: 'a seção ## 2. Módulos afetados', nome: NOME_DA_SKILL, trecho: (texto) => secao(texto, /^## 2\. Módulos afetados/) },
    { arquivo: CLAUDE_MD, onde: 'o arquivo', nome: GUIA, trecho: (texto) => texto },
    { arquivo: GUIA, onde: 'o topo, antes da §1', nome: NOME_DA_SKILL, trecho: (texto) => texto.split('\n## ')[0] ?? '' },
  ]
  for (const { arquivo, onde, nome, trecho } of apontamentos) {
    const texto = lerOuNulo(join(raiz, arquivo))
    const parte = texto === null ? null : trecho(texto)
    if (texto === null) falhas.push(`${arquivo} não existe`)
    else if (parte === null) falhas.push(`${arquivo} não tem ${onde}`)
    else if (!parte.includes(nome)) falhas.push(`${arquivo}: ${onde} não cita ${nome}`)
  }
  return falhas
}

// ---------------------------------------------------------------------------------------------------------------------------------
// A amostra: um repositório mínimo e certo em pasta temporária, que cada caso estraga num ponto só.

const GUIA_BASE = `# Guia

A skill \`${NOME_DA_SKILL}\` aponta a receita.

## 1. Em cinco minutos

Nada aqui.

## 5. Receitas

### 5.1 Um

Exemplo: \`apps/a/um.ts\`.

### 5.2 Dois

Exemplo: \`apps/a/dois.ts\` e \`dois-b.ts\`.

## 6. Testes

Veja \`apps/a/um.ts\`.

## 7. As travas

| Trava | O que barra | Onde |
|---|---|---|
| Boot da API | rota sem permissão | \`apps/a/um.ts\` |
| Lint \`guardas/x\` e \`y\` | log com nome | \`apps/a/dois.ts\` |

## 8. Fim
`

const SKILL_BASE = `---
name: ${NOME_DA_SKILL}
description: Aponta a receita para escrever um endpoint, uma tabela, um job, uma chamada de IA, uma tela ou o teste de isolamento
user-invocable: false
---

A receita mora em \`${GUIA}\`.

| Seção | Exemplo | Travas |
|---|---|---|
| 5.1 Um | \`apps/a/um.ts\` | Boot da API |
| 5.2 Dois | \`apps/a/dois.ts\` | Boot da API; Lint \`guardas/x\` e \`y\` |

O que se afasta da receita vai à seção 11 da Tech Spec com o motivo.
`

const EXECUTAR_TASK_BASE = `# Executar

## 1. Contexto

Leia a skill \`${NOME_DA_SKILL}\`.

## 2. Planejar

Nada.
`

const MODELO_BASE = `# Tech Spec

## 2. Módulos afetados

A receita está na skill \`${NOME_DA_SKILL}\`.

## 3. Modelo de dados
`

const CLAUDE_MD_BASE = `# Turmma\n\n**Para escrever código:** \`${GUIA}\`\n`

const ARQUIVOS_BASE: Record<string, string> = {
  [GUIA]: GUIA_BASE,
  [SKILL]: SKILL_BASE,
  [EXECUTAR_TASK]: EXECUTAR_TASK_BASE,
  [MODELO_DA_TECHSPEC]: MODELO_BASE,
  [CLAUDE_MD]: CLAUDE_MD_BASE,
  'apps/a/um.ts': 'export {}\n',
  'apps/a/dois.ts': 'export {}\n',
  'apps/a/outro.ts': 'export {}\n',
  'apps/api/src/existe.ts': 'export {}\n',
}

const pastas: string[] = []
afterEach(() => {
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true })
})

/** A amostra certa, com o que o caso troca: texto novo para o arquivo, ou `null` para tirá-lo. */
function amostra(muda: Record<string, string | null> = {}): string {
  const raiz = mkdtempSync(join(tmpdir(), 'receitas-'))
  pastas.push(raiz)
  for (const [nome, texto] of Object.entries({ ...ARQUIVOS_BASE, ...muda })) {
    if (texto === null) continue
    mkdirSync(join(raiz, dirname(nome)), { recursive: true })
    writeFileSync(join(raiz, nome), texto)
  }
  return raiz
}

/** O texto com `de` trocado por `para`; `de` que não está no texto é erro do teste, e não um caso que passa sem estragar nada. */
function variar(base: string, de: string, para: string): string {
  if (!base.includes(de)) throw new Error(`a amostra não tem ${JSON.stringify(de)}`)
  return base.replace(de, para)
}

const naSkill = (de: string, para: string): Record<string, string> => ({ [SKILL]: variar(SKILL_BASE, de, para) })
const noGuia = (de: string, para: string): Record<string, string> => ({ [GUIA]: variar(GUIA_BASE, de, para) })

const falhasDe = (muda: Record<string, string | null>): string[] => conferirReceitas(amostra(muda)).falhas

/** Os quatro lados que citam caminho, cada um com o ponto onde um texto novo entra sem estragar o resto. */
const LADOS: { lado: string; lugar: string; com: (linha: string) => Record<string, string> }[] = [
  { lado: 'skill', lugar: SKILL, com: (linha) => naSkill('O que se afasta', `${linha}\n\nO que se afasta`) },
  { lado: 'guia §5', lugar: `${GUIA} §5`, com: (linha) => noGuia('### 5.1 Um\n', `### 5.1 Um\n\n${linha}\n`) },
  { lado: 'guia §6', lugar: `${GUIA} §6`, com: (linha) => noGuia('## 6. Testes\n', `## 6. Testes\n\n${linha}\n`) },
  { lado: 'guia §7', lugar: `${GUIA} §7`, com: (linha) => noGuia('## 8. Fim', `${linha}\n\n## 8. Fim`) },
]

const FORMAS: { forma: string; escrever: (caminho: string) => string; token: (caminho: string) => string }[] = [
  { forma: 'crase', escrever: (c) => `Leia \`${c}\` antes.`, token: (c) => c },
  { forma: 'crase com ./', escrever: (c) => `Leia \`./${c}\` antes.`, token: (c) => `./${c}` },
  { forma: 'aspas simples', escrever: (c) => `const PASTA = '${c}'`, token: (c) => c },
  { forma: 'aspas duplas', escrever: (c) => `const PASTA = "${c}"`, token: (c) => c },
  { forma: './ solto no texto', escrever: (c) => `Leia ./${c} antes.`, token: (c) => `./${c}` },
]

describe('o repositório de hoje (RF32)', () => {
  it('a skill e o guia passam, com uma linha por ### 5.x e cada contagem afirmada', () => {
    const conferencia = conferirReceitas(RAIZ)
    expect(conferencia.falhas).toEqual([])
    expect(conferencia.receitasDoGuia).toBeGreaterThanOrEqual(MINIMO_DE_RECEITAS)
    expect(conferencia.linhasDaSkill).toBe(conferencia.receitasDoGuia)
    expect(conferencia.travasDaSecao7).toBeGreaterThanOrEqual(MINIMO_DE_TRAVAS)
    expect(conferencia.caminhos.skill).toBeGreaterThanOrEqual(MINIMO_DE_CAMINHOS_DA_SKILL)
    expect(conferencia.caminhos.secao5).toBeGreaterThanOrEqual(MINIMO_DE_CAMINHOS_DA_SECAO_5)
    expect(conferencia.caminhos.secao6).toBeGreaterThanOrEqual(MINIMO_DE_CAMINHOS_DA_SECAO_6)
    expect(conferencia.caminhos.secao7).toBeGreaterThanOrEqual(MINIMO_DE_CAMINHOS_DA_SECAO_7)
  })

  it('cada receita do guia tem exemplo e trava na skill, e o exemplo está na linha Exemplo: da seção', () => {
    const guia = readFileSync(join(RAIZ, GUIA), 'utf8')
    const skill = readFileSync(join(RAIZ, SKILL), 'utf8')
    const linhas = linhasDeDados(skill).map(celulasDe)
    const numeros = [...guia.matchAll(/^### (5\.\d+)\b/gm)].map((achado) => achado[1])
    expect(linhas.map(([primeira]) => /^(5\.\d+)/.exec(primeira ?? '')?.[1])).toEqual(numeros)
    for (const [, exemplo, travas] of linhas) {
      expect(caminhosDe(exemplo ?? '').length).toBeGreaterThan(0)
      expect((travas ?? '').trim()).not.toBe('')
    }
  })

  it('os quatro apontamentos estão no lugar que o RF32 manda', () => {
    expect(conferirApontamentos(RAIZ)).toEqual([])
  })
})

describe('caminho citado que não existe (RF32)', () => {
  const CAMINHO = 'apps/api/src/inexistente.ts'

  it.each(LADOS.flatMap((lado) => FORMAS.map((forma) => ({ ...lado, ...forma }))))('quem contorna é acusado no $lado: o caminho escrito com $forma', ({ lugar, com, escrever, token }) => {
    expect(falhasDe(com(escrever(CAMINHO)))).toEqual([`${lugar} cita ${token(CAMINHO)}: não existe`])
  })

  it.each(LADOS)('o caminho que existe é verde no $lado', ({ com }) => {
    expect(falhasDe(com('Leia `apps/api/src/existe.ts` antes.'))).toEqual([])
  })

  it.each(LADOS)('placeholder cuja pasta não existe é vermelho no $lado, e o que tem a pasta é verde', ({ lugar, com }) => {
    expect(falhasDe(com('`apps/api/src/inexistente/<modulo>/x.ts`'))).toEqual([`${lugar} cita apps/api/src/inexistente/<modulo>/x.ts: a pasta apps/api/src/inexistente/ não existe`])
    expect(falhasDe(com('`apps/api/src/<modulo>/x.int.test.ts`'))).toEqual([])
  })

  it.each(LADOS)('glob que não casa nada é vermelho no $lado, e o que casa é verde', ({ lugar, com }) => {
    expect(falhasDe(com('`apps/api/src/*.mjs`'))).toEqual([`${lugar} cita apps/api/src/*.mjs: o padrão não casa com nenhum arquivo`])
    expect(falhasDe(com('`apps/api/src/*.ts`'))).toEqual([])
  })

  it.each(LADOS)('fora da conferência no $lado: fragmento relativo, regra de lint e rota', ({ com }) => {
    expect(falhasDe(com('`components/dialogs.tsx`, `guardas/log-sem-dado-pessoal` e `/v1/disciplinas`'))).toEqual([])
  })
})

describe('a linha da skill contra o guia (RF32)', () => {
  it('exemplo fora da linha com Exemplo: da seção: vermelho, mesmo existindo', () => {
    expect(falhasDe(naSkill('| `apps/a/um.ts` | Boot da API |', '| `apps/a/outro.ts` | Boot da API |'))).toEqual([
      `${SKILL}: o exemplo apps/a/outro.ts da linha 5.1 não está na linha Exemplo: da 5.1 do guia`,
    ])
  })

  it('o exemplo da skill escrito com ./ é o mesmo caminho do guia: verde', () => {
    expect(falhasDe(naSkill('| `apps/a/um.ts` | Boot da API |', '| `./apps/a/um.ts` | Boot da API |'))).toEqual([])
  })

  it('caminho que o guia cita fora da linha Exemplo: da seção não vale como exemplo', () => {
    const muda = { ...noGuia('### 5.1 Um\n', '### 5.1 Um\n\nVeja `apps/a/outro.ts`.\n'), ...naSkill('| `apps/a/um.ts` | Boot da API |', '| `apps/a/outro.ts` | Boot da API |') }
    expect(falhasDe(muda)).toEqual([`${SKILL}: o exemplo apps/a/outro.ts da linha 5.1 não está na linha Exemplo: da 5.1 do guia`])
  })

  it('exemplo sem pasta da raiz: vermelho', () => {
    expect(falhasDe(naSkill('| `apps/a/um.ts` | Boot da API |', '| `um.ts` | Boot da API |'))).toEqual([`${SKILL}: o exemplo da linha 5.1 não tem pasta da raiz`])
  })

  it('linha sem exemplo: vermelho', () => {
    expect(falhasDe(naSkill('| 5.1 Um | `apps/a/um.ts` |', '| 5.1 Um |  |'))).toEqual([`${SKILL}: a linha 5.1 não tem exemplo`])
  })

  it('linha sem trava: vermelho', () => {
    expect(falhasDe(naSkill('| `apps/a/um.ts` | Boot da API |', '| `apps/a/um.ts` |  |'))).toEqual([`${SKILL}: a linha 5.1 não tem trava`])
  })

  it('linha que aponta 5.9: vermelho, e a linha de uma seção que existe segue verde', () => {
    expect(falhasDe(naSkill('\nO que se afasta', '| 5.9 Nove | `apps/a/um.ts` | Boot da API |\n\nO que se afasta'))).toEqual([
      `${SKILL}: a linha 5.9 aponta uma seção que o guia não tem`,
    ])
  })

  it('linha que não começa pelo número de uma seção 5.x: vermelho', () => {
    expect(falhasDe(naSkill('| 5.2 Dois |', '| Dois |'))).toEqual([
      `${SKILL}: a linha "Dois" não começa pelo número de uma seção 5.x`,
      `${SKILL}: a seção 5.2 do guia não tem linha`,
    ])
  })

  it('duas linhas para a mesma seção: vermelho', () => {
    expect(falhasDe(naSkill('\nO que se afasta', '| 5.1 Um de novo | `apps/a/um.ts` | Boot da API |\n\nO que se afasta'))).toEqual([`${SKILL}: a seção 5.1 tem mais de uma linha`])
  })

  it('### 5.x do guia sem linha na skill: vermelho', () => {
    expect(falhasDe(noGuia('## 6. Testes', '### 5.3 Três\n\nExemplo: `apps/a/um.ts`.\n\n## 6. Testes'))).toEqual([`${SKILL}: a seção 5.3 do guia não tem linha`])
  })

  it('### 5.x do guia sem linha Exemplo: com caminho da raiz: vermelho', () => {
    expect(falhasDe(noGuia('Exemplo: `apps/a/um.ts`.', 'Exemplo: `um.ts`.'))).toEqual([`${GUIA}: a 5.1 não tem linha Exemplo: com caminho da raiz`, `${SKILL}: o exemplo apps/a/um.ts da linha 5.1 não está na linha Exemplo: da 5.1 do guia`])
  })

  it('trava fora da coluna "Trava" da §7 (a célula exata, com as crases): vermelho', () => {
    expect(falhasDe(naSkill('| Boot da API |', '| rota sem permissão |'))).toEqual([`${SKILL}: a linha 5.1 cita a trava "rota sem permissão", que não é célula da coluna Trava da §7`])
    expect(falhasDe(naSkill('Lint `guardas/x` e `y` |', 'Lint guardas/x e y |'))).toEqual([`${SKILL}: a linha 5.2 cita a trava "Lint guardas/x e y", que não é célula da coluna Trava da §7`])
  })

  it('trava pela metade ("Lint"): vermelho', () => {
    expect(falhasDe(naSkill('Lint `guardas/x` e `y` |', 'Lint |'))).toEqual([`${SKILL}: a linha 5.2 cita a trava "Lint", que não é célula da coluna Trava da §7`])
  })
})

describe('o formato da skill (RF32)', () => {
  const comLinhas = (total: number): string => {
    const faltam = total - SKILL_BASE.replace(/\n$/, '').split('\n').length
    return `${SKILL_BASE}${'Mais uma frase.\n'.repeat(faltam)}`
  }
  const comBytes = (total: number): string => {
    const faltam = total - Buffer.byteLength(SKILL_BASE) - 'Z\n'.length
    return `${SKILL_BASE}Z${'a'.repeat(faltam)}\n`
  }

  it('60 linhas passam e 61 são vermelho', () => {
    expect(falhasDe({ [SKILL]: comLinhas(60) })).toEqual([])
    expect(falhasDe({ [SKILL]: comLinhas(61) })).toEqual([`${SKILL} tem 61 linhas, e o limite é 60`])
  })

  it('6.000 B passam e 6.001 B são vermelho', () => {
    expect(Buffer.byteLength(comBytes(6000))).toBe(6000)
    expect(falhasDe({ [SKILL]: comBytes(6000) })).toEqual([])
    expect(falhasDe({ [SKILL]: comBytes(6001) })).toEqual([`${SKILL} tem 6001 B, e o limite é 6000`])
  })

  it.each([
    ['cerca de três crases', '```\nnpm test\n```', 'cerca na linha 14'],
    ['cerca de três til', '~~~\nnpm test\n~~~', 'cerca na linha 14'],
    ['cerca recuada em três espaços', '   ```\nnpm test\n   ```', 'cerca na linha 14'],
    ['recuo de quatro espaços', '    npm test', 'recuo na linha 14'],
    ['recuo de tabulação', '\tnpm test', 'recuo na linha 14'],
  ])('código por %s: vermelho', (_forma, codigo, onde) => {
    expect(falhasDe(naSkill('O que se afasta', `${codigo}\n\nO que se afasta`))).toEqual([`${SKILL} tem código (${onde})`])
  })

  it.each(Object.keys(ASSUNTOS))('description sem a palavra %s: vermelho', (assunto) => {
    const palavra = ASSUNTOS[assunto]
    const linha = /^description: .*$/m.exec(SKILL_BASE)?.[0] ?? ''
    expect(linha.match(palavra ?? /$^/)).not.toBeNull()
    const sem = SKILL_BASE.replace(linha, linha.replace(palavra ?? /$^/, 'coisa'))
    expect(falhasDe({ [SKILL]: sem })).toEqual([`${SKILL}: a description não tem a palavra ${JSON.stringify(assunto)}`])
  })

  it('frontmatter sem description, ou sem frontmatter: vermelho', () => {
    expect(falhasDe(naSkill(/^description: .*\n/m.exec(SKILL_BASE)?.[0] ?? '', ''))).toEqual([`${SKILL}: o frontmatter não tem description`])
    expect(falhasDe({ [SKILL]: SKILL_BASE.replace(/^---\n[\s\S]*?\n---\n/, '') })).toEqual([`${SKILL}: o frontmatter não tem description`])
  })

  it('frontmatter que não é YAML válido: vermelho', () => {
    expect(falhasDe(naSkill(/^description: .*$/m.exec(SKILL_BASE)?.[0] ?? '', 'description: uma: outra'))).toEqual([`${SKILL}: o frontmatter não tem description`])
  })

  it('skill sem a seção 11 da Tech Spec: vermelho', () => {
    expect(falhasDe(naSkill('seção 11 da Tech Spec', 'Tech Spec'))).toEqual([`${SKILL} não manda o desvio para a seção 11 da Tech Spec`])
  })
})

describe('o alvo ausente é vermelho (RF32)', () => {
  it('guia ausente: vermelho, e a skill ainda é lida', () => {
    const conferencia = conferirReceitas(amostra({ [GUIA]: null }))
    expect(conferencia.falhas).toEqual([`${GUIA} não existe`, `${SKILL} cita ${GUIA}: não existe`])
    expect(conferencia.caminhos).toEqual({ skill: 3, secao5: 0, secao6: 0, secao7: 0 })
  })

  it('guia sem a §5: vermelho', () => {
    expect(falhasDe(noGuia('## 5. Receitas', '## 5b. Receitas'))).toEqual([`${GUIA} não tem a §5`])
  })

  it('guia sem a §6 ou sem a §7: vermelho', () => {
    expect(falhasDe(noGuia('## 6. Testes', '## 6b. Testes'))).toEqual([`${GUIA} não tem a §6`])
    expect(falhasDe(noGuia('## 7. As travas', '## 7b. As travas'))).toEqual([`${GUIA} não tem a §7`])
  })

  it('guia com a §5 sem nenhuma ### 5.x: vermelho', () => {
    const semSubsecoes = GUIA_BASE.replaceAll('### 5.', '### 5a.')
    expect(falhasDe({ [GUIA]: semSubsecoes })).toEqual([
      `${GUIA}: a §5 não tem nenhuma ### 5.x`,
      `${SKILL}: a linha 5.1 aponta uma seção que o guia não tem`,
      `${SKILL}: a linha 5.2 aponta uma seção que o guia não tem`,
    ])
  })

  it('skill ausente: vermelho', () => {
    expect(falhasDe({ [SKILL]: null })).toEqual([`${SKILL} não existe`])
  })
})

describe('os quatro apontamentos (RF32)', () => {
  const apontamentos = (muda: Record<string, string | null>): string[] => conferirApontamentos(amostra(muda))

  it('a amostra certa passa', () => {
    expect(apontamentos({})).toEqual([])
  })

  it('## 1. Contexto do executar-task sem o nome: vermelho, e o nome em outra seção não vale', () => {
    const outraSecao = EXECUTAR_TASK_BASE.replace(`Leia a skill \`${NOME_DA_SKILL}\`.`, 'Leia.').replace('Nada.', `A skill \`${NOME_DA_SKILL}\`.`)
    expect(apontamentos({ [EXECUTAR_TASK]: outraSecao })).toEqual([`${EXECUTAR_TASK}: a seção ## 1. Contexto não cita ${NOME_DA_SKILL}`])
    expect(apontamentos({ [EXECUTAR_TASK]: '# Executar\n\n## 2. Planejar\n\nNada.\n' })).toEqual([`${EXECUTAR_TASK} não tem a seção ## 1. Contexto`])
  })

  it('§2 do modelo da Tech Spec sem o nome: vermelho, e o nome em outra seção não vale', () => {
    const outraSecao = MODELO_BASE.replace(`A receita está na skill \`${NOME_DA_SKILL}\`.`, 'A receita.').replace('## 3. Modelo de dados\n', `## 3. Modelo de dados\n\n\`${NOME_DA_SKILL}\`\n`)
    expect(apontamentos({ [MODELO_DA_TECHSPEC]: outraSecao })).toEqual([`${MODELO_DA_TECHSPEC}: a seção ## 2. Módulos afetados não cita ${NOME_DA_SKILL}`])
  })

  it('CLAUDE.md sem docs/guia-do-desenvolvedor.md: vermelho', () => {
    expect(apontamentos({ [CLAUDE_MD]: '# Turmma\n' })).toEqual([`${CLAUDE_MD}: o arquivo não cita ${GUIA}`])
  })

  it('guia sem o nome da skill no topo: vermelho, e o nome depois da §1 não vale', () => {
    const noTopo = `A skill \`${NOME_DA_SKILL}\` aponta a receita.`
    expect(apontamentos(noGuia(noTopo, 'Só o guia.'))).toEqual([`${GUIA}: o topo, antes da §1 não cita ${NOME_DA_SKILL}`])
    expect(apontamentos(noGuia(noTopo, `Só o guia.\n\n## 1b. Outra\n\n\`${NOME_DA_SKILL}\``))).toEqual([`${GUIA}: o topo, antes da §1 não cita ${NOME_DA_SKILL}`])
  })

  it('arquivo ausente: vermelho, um por arquivo', () => {
    expect(apontamentos({ [EXECUTAR_TASK]: null, [MODELO_DA_TECHSPEC]: null, [CLAUDE_MD]: null, [GUIA]: null })).toEqual([
      `${EXECUTAR_TASK} não existe`,
      `${MODELO_DA_TECHSPEC} não existe`,
      `${CLAUDE_MD} não existe`,
      `${GUIA} não existe`,
    ])
  })
})
