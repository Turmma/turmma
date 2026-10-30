import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { conferir, type ResultadoDoConferir } from './conferir.ts'
import { apagarRepositoriosDeTeste, montarRepositorio, pacoteDeTeste, type RepositorioDeTeste, tsconfigDe } from './repositorio-de-teste.ts'

// O `conferir` pelo efeito: o repositório de brinquedo tem o `HEAD` como a onda o encontra, o caso muda a árvore (a onda aplicada, ou
// uma mudança que não é de nome), e o que se confere é o veredito e o que ele aponta.

afterEach(apagarRepositoriosDeTeste)

const CAMINHO_DO_MAPA = 'tools/renomear/mapas/1.json'
const ANEXO = 'inventario-back.md:10'

/** Uma pasta de cada raiz da foto: o `conferir` exige arquivo em todas, e a foto vazia confere nada. */
const BASE: Record<string, string> = {
  'apps/api/src/a.ts': "import { Banco } from '@educa/shared'\nexport const a = new Banco()\n",
  'packages/shared/src/index.ts': "export * from './db.ts'\n",
  'packages/shared/src/db.ts': 'export class Banco {}\n',
  'packages/shared/package.json': pacoteDeTeste('@educa/shared'),
  'packages/shared/tsconfig.json': tsconfigDe(2),
  'e2e/x.spec.ts': "export const x = 'e2e'\n",
  'infra/test/i.test.ts': "export const i = 'infra'\n",
  'infra/scripts/s.ts': "export const s = 'script'\n",
  'tools/t.ts': "export const t = 'ferramenta'\n",
}

function repositorio(extra: Record<string, string> = {}): RepositorioDeTeste {
  return montarRepositorio({ ...BASE, ...extra })
}

type Entrada = Record<string, unknown>
const entrada = (campos: Entrada): Entrada => ({ linhaDoAnexo: ANEXO, ...campos })

function rodar(repo: RepositorioDeTeste, entradas: Entrada[] = [], excecoesDoConferir: Entrada[] = []): ResultadoDoConferir {
  repo.escrever(CAMINHO_DO_MAPA, JSON.stringify({ entradas: entradas.map(entrada), excecoesDoConferir }))
  return conferir(repo.raiz, CAMINHO_DO_MAPA)
}

const dos = (resultado: ResultadoDoConferir): string[] => resultado.divergencias.map((d) => `${d.lado} ${d.categoria} ${d.arquivo} ${d.valor}`).sort()

describe('conferir: vermelho quando', () => {
  const ANTES = {
    'apps/api/src/forma.tsx':
      "export const s = 'texto'\nexport const r = /abc/u\nexport const o = { chave: 1 }\nexport const t = `/rota/${s}/fim`\nexport const j = <p>Tela</p>\nexport const n = `abc`\n",
  }

  it.each([
    ['uma string', "'texto'", "'outro'", 'string'],
    ['uma regex', '/abc/u', '/abd/u', 'regex'],
    ['uma chave de objeto', '{ chave: 1 }', '{ outra: 1 }', 'chave'],
    ['a parte fixa de um template', '`/rota/${s}/fim`', '`/rota/${s}/novo`', 'template'],
    ['um JsxText', '<p>Tela</p>', '<p>Quadro</p>', 'jsx'],
    ['um template sem substituição', '`abc`', '`abd`', 'string'],
  ])('muda %s', (_forma, de, para, categoria) => {
    const repo = repositorio(ANTES)
    repo.escrever('apps/api/src/forma.tsx', ANTES['apps/api/src/forma.tsx'].replace(de, para))
    const resultado = rodar(repo)
    expect(resultado.codigo).toBe(1)
    expect(new Set(resultado.divergencias.map((d) => d.categoria))).toEqual(new Set([categoria]))
    expect(resultado.divergencias.every((d) => d.arquivo === 'apps/api/src/forma.tsx')).toBe(true)
  })

  it('a chave de aspas é chave: a string que a sustenta não conta duas vezes', () => {
    const repo = repositorio({ 'apps/api/src/k.ts': "export const o = { 'a-b': 1 }\n" })
    repo.escrever('apps/api/src/k.ts', "export const o = { 'a-c': 1 }\n")
    expect(dos(rodar(repo))).toEqual(['saiu chave apps/api/src/k.ts a-b', 'entrou chave apps/api/src/k.ts a-c'].sort())
  })

  it('o nome antigo passado para um template ou para uma chave é acusado, também na forma curta', () => {
    const repo = repositorio({ 'apps/api/src/c.ts': 'const AdaptadorFalso = 1\nexport const t = `${AdaptadorFalso}/AdaptadorFalso`\nexport const o = { AdaptadorFalso }\n' })
    repo.escrever('apps/api/src/c.ts', 'const FakeAdapter = 1\nexport const t = `${FakeAdapter}/FakeAdapter`\nexport const o = { FakeAdapter }\n')
    expect(dos(rodar(repo))).toEqual(
      ['entrou chave apps/api/src/c.ts FakeAdapter', 'entrou template apps/api/src/c.ts /FakeAdapter', 'saiu chave apps/api/src/c.ts AdaptadorFalso', 'saiu template apps/api/src/c.ts /AdaptadorFalso'].sort(),
    )
  })

  it('um caso de teste entra (RF7)', () => {
    const repo = repositorio({ 'apps/api/src/c.test.ts': "describe('a', () => {\n  it('um', () => {})\n})\n" })
    repo.escrever('apps/api/src/c.test.ts', "describe('a', () => {\n  it('um', () => {})\n  it('dois', () => {})\n})\n")
    const resultado = rodar(repo)
    expect(dos(resultado)).toEqual(['entrou caso apps/api/src/c.test.ts a › dois'])
    expect(resultado.codigo).toBe(1)
  })

  it('um caso de teste some', () => {
    const repo = repositorio({ 'apps/api/src/c.test.ts': "describe('a', () => {\n  it('um', () => {})\n  it('dois', () => {})\n})\n" })
    repo.escrever('apps/api/src/c.test.ts', "describe('a', () => {\n  it('um', () => {})\n})\n")
    expect(dos(rodar(repo))).toEqual(['saiu caso apps/api/src/c.test.ts a › dois'])
  })

  it('o texto de um describe muda (RF6), e a exceção não o salva', () => {
    const repo = repositorio({ 'apps/api/src/c.test.ts': "describe('o Banco', () => {\n  it.each([1])('um %s', () => {})\n})\n" })
    repo.escrever('apps/api/src/c.test.ts', "describe('o Database', () => {\n  it.each([1])('um %s', () => {})\n})\n")
    const resultado = rodar(repo, [], [
      { arquivo: 'apps/api/src/c.test.ts', texto: 'o Banco', motivo: 'tentativa' },
      { arquivo: 'apps/api/src/c.test.ts', texto: 'o Database', motivo: 'tentativa' },
    ])
    expect(dos(resultado)).toEqual(
      ['saiu caso apps/api/src/c.test.ts o Banco', 'saiu caso apps/api/src/c.test.ts o Banco › um %s', 'entrou caso apps/api/src/c.test.ts o Database', 'entrou caso apps/api/src/c.test.ts o Database › um %s'].sort(),
    )
  })

  it('a exceção vale só no arquivo dela', () => {
    const repo = repositorio({ 'apps/api/src/e.ts': "export const nome = 'velho'\n" })
    repo.escrever('apps/api/src/e.ts', "export const nome = 'novo'\n")
    const resultado = rodar(repo, [], [
      { arquivo: 'apps/api/src/outro.ts', texto: 'velho', motivo: 'outro arquivo' },
      { arquivo: 'apps/api/src/outro.ts', texto: 'novo', motivo: 'outro arquivo' },
    ])
    expect(resultado.codigo).toBe(1)
    expect(dos(resultado)).toEqual(['saiu string apps/api/src/e.ts velho', 'entrou string apps/api/src/e.ts novo'].sort())
  })

  it('uma string em infra/test/ e uma em infra/scripts/', () => {
    const repo = repositorio()
    repo.escrever('infra/test/i.test.ts', "export const i = 'infra-novo'\n")
    repo.escrever('infra/scripts/s.ts', "export const s = 'script-novo'\n")
    expect(dos(rodar(repo))).toEqual(
      ['entrou string infra/scripts/s.ts script-novo', 'entrou string infra/test/i.test.ts infra-novo', 'saiu string infra/scripts/s.ts script', 'saiu string infra/test/i.test.ts infra'].sort(),
    )
  })

  it('aparece um nome exportado fora do mapa', () => {
    const repo = repositorio()
    repo.escrever('packages/shared/src/db.ts', 'export class Banco {}\nexport class Intruso {}\n')
    expect(dos(rodar(repo))).toEqual(['entrou exportado packages/shared Intruso'])
  })

  it('aparece um especificador fora do mapa', () => {
    const repo = repositorio({ 'apps/api/src/b.ts': 'export const b = 1\n' })
    repo.escrever('apps/api/src/a.ts', "import { Banco } from '@educa/shared'\nimport { b } from './b.ts'\nexport const a = [new Banco(), b]\n")
    expect(dos(rodar(repo))).toEqual(['entrou especificador apps/api/src/a.ts relativo|apps/api/src/b|.ts'])
  })

  it('o pacote de outro nome no import, sem o mapa de pacote', () => {
    const repo = repositorio()
    repo.escrever('apps/api/src/a.ts', "import { Banco } from '@educa/core'\nexport const a = new Banco()\n")
    expect(dos(rodar(repo))).toEqual(['entrou especificador apps/api/src/a.ts pacote|@educa/core', 'saiu especificador apps/api/src/a.ts pacote|@educa/shared'].sort())
  })

  it('a exceção de uma string não cobre o especificador nem o nome exportado', () => {
    const repo = repositorio()
    repo.escrever('packages/shared/src/db.ts', 'export class Banco {}\nexport class Intruso {}\n')
    repo.escrever('apps/api/src/a.ts', "import { Banco } from '@educa/core'\nexport const a = new Banco()\n")
    const resultado = rodar(repo, [], [
      { arquivo: 'packages/shared', texto: 'Intruso', motivo: 'tentativa' },
      { arquivo: 'apps/api/src/a.ts', texto: 'pacote|@educa/core', motivo: 'tentativa' },
      { arquivo: 'apps/api/src/a.ts', texto: 'pacote|@educa/shared', motivo: 'tentativa' },
    ])
    expect(resultado.codigo).toBe(1)
    expect(resultado.divergencias).toHaveLength(3)
  })

  it('um arquivo novo na árvore: tudo o que ele tem entra', () => {
    const repo = repositorio()
    repo.escrever('apps/api/src/novo.ts', "export const n = 'novo'\n")
    expect(dos(rodar(repo))).toEqual(['entrou exportado apps/api n', 'entrou string apps/api/src/novo.ts novo'].sort())
  })
})

describe('conferir: o que a foto conta e o que não conta', () => {
  it('o nome exportado que passa de um pacote para outro é acusado', () => {
    const repo = repositorio({ 'packages/outro/src/o.ts': 'export const o = 1\n', 'packages/shared/src/s.ts': 'export const s = 1\n' })
    repo.escrever('packages/outro/src/o.ts', 'export const s = 1\n')
    repo.escrever('packages/shared/src/s.ts', 'export const o = 1\n')
    expect(dos(rodar(repo))).toEqual(['saiu exportado packages/outro o', 'entrou exportado packages/outro s', 'saiu exportado packages/shared s', 'entrou exportado packages/shared o'].sort())
  })

  it('a mesma string que passa de uma vez para duas é acusada', () => {
    const repo = repositorio({ 'apps/api/src/d.ts': "export const a = 'igual'\n" })
    repo.escrever('apps/api/src/d.ts', "export const a = 'igual'\nexport const b = 'igual'\nexport const c = 'igual'\n")
    expect(dos(rodar(repo))).toEqual(['entrou exportado apps/api b', 'entrou exportado apps/api c', 'entrou string apps/api/src/d.ts igual', 'entrou string apps/api/src/d.ts igual'].sort())
  })

  it('mais de 200 diferenças: o texto lista as primeiras e diz quantas faltam', () => {
    const muitas = (sufixo: string): string => Array.from({ length: 250 }, (_, i) => `export const v${String(i)} = '${sufixo}${String(i)}'`).join('\n')
    const repo = repositorio({ 'apps/api/src/m.ts': muitas('a') })
    repo.escrever('apps/api/src/m.ts', muitas('b'))
    const resultado = rodar(repo)
    expect(resultado.divergencias).toHaveLength(500)
    expect(resultado.texto.split('\n')).toHaveLength(202)
    expect(resultado.texto).toContain('… e mais 300')
  })

  it('o que não é código fica fora, e a raiz do repositório também', () => {
    const repo = repositorio({ 'apps/api/LEIAME.md': "'um'\n", 'apps/api/dados.json': '{ "a": "um" }\n', 'raiz.ts': "export const r = 'um'\n" })
    repo.escrever('apps/api/LEIAME.md', "'dois'\n")
    repo.escrever('apps/api/dados.json', '{ "a": "dois" }\n')
    repo.escrever('raiz.ts', "export const r = 'dois'\n")
    expect(rodar(repo)).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('o arquivo apagado do disco e ainda no índice: tudo o que ele tinha sai', () => {
    const repo = repositorio({ 'apps/api/src/p.ts': "export const p = 'adeus'\n" })
    rmSync(join(repo.raiz, 'apps/api/src/p.ts'))
    expect(dos(rodar(repo))).toEqual(['saiu exportado apps/api p', 'saiu string apps/api/src/p.ts adeus'].sort())
  })

  it('o método de classe e o nome que não é exportado mudam de nome sem ser diferença', () => {
    const repo = repositorio({ 'apps/api/src/m.ts': 'class Velha { criar() { return 1 } }\nfunction interna() { return new Velha() }\nexport const m = interna\n' })
    repo.escrever('apps/api/src/m.ts', 'class Nova { create() { return 1 } }\nfunction internal() { return new Nova() }\nexport const m = internal\n')
    expect(rodar(repo)).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('a chave de método e de acessor de um objeto literal, e a exportação por padrão e por desestruturação', () => {
    const repo = repositorio({ 'apps/api/src/o.ts': 'export const o = { metodo() { return 1 }, get leitor() { return 2 } }\nexport default class Padrao {}\nexport const { a, b: [c] } = { a: 1, b: [2] }\nexport * as todos from "./o2.ts"\nexport { x as y } from "./o2.ts"\n', 'apps/api/src/o2.ts': 'export const x = 1\n' })
    repo.escrever('apps/api/src/o.ts', 'export const o = { metodo2() { return 1 }, get leitor2() { return 2 } }\nexport default class Outro {}\nexport const { a2, b: [c2] } = { a2: 1, b: [2] }\nexport * as todos2 from "./o2.ts"\nexport { x as z } from "./o2.ts"\n')
    expect(dos(rodar(repo))).toEqual(
      [
        'saiu chave apps/api/src/o.ts metodo',
        'entrou chave apps/api/src/o.ts metodo2',
        'saiu chave apps/api/src/o.ts leitor',
        'entrou chave apps/api/src/o.ts leitor2',
        'saiu exportado apps/api a',
        'entrou exportado apps/api a2',
        'saiu exportado apps/api c',
        'entrou exportado apps/api c2',
        'saiu exportado apps/api todos',
        'entrou exportado apps/api todos2',
        'saiu exportado apps/api y',
        'entrou exportado apps/api z',
        'saiu chave apps/api/src/o.ts a',
        'entrou chave apps/api/src/o.ts a2',
      ].sort(),
    )
  })

  it('a chave numérica é chave: o número que a sustenta não conta como string', () => {
    const repo = repositorio({ 'apps/api/src/n.ts': "export const o = { 1: 'a' }\n" })
    repo.escrever('apps/api/src/n.ts', "export const o = { 2: 'a' }\n")
    expect(dos(rodar(repo))).toEqual(['saiu chave apps/api/src/n.ts 1', 'entrou chave apps/api/src/n.ts 2'].sort())
  })

  it('o buraco numa desestruturação exportada não é nome, e o outro elemento é', () => {
    const repo = repositorio({ 'apps/api/src/d2.ts': 'export const [, segundo] = [1, 2]\n' })
    repo.escrever('apps/api/src/d2.ts', 'export const [, terceiro] = [1, 2]\n')
    expect(dos(rodar(repo))).toEqual(['saiu exportado apps/api segundo', 'entrou exportado apps/api terceiro'].sort())
  })

  it('a classe exportada por padrão muda de nome sem ser diferença: o nome exportado é default', () => {
    const repo = repositorio({ 'apps/api/src/p.ts': 'export default class Padrao {}\n' })
    repo.escrever('apps/api/src/p.ts', 'export default class Outro {}\n')
    expect(rodar(repo)).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('a exportação por padrão de uma expressão é o nome default, e some se deixa de existir', () => {
    const repo = repositorio({ 'apps/api/src/e.ts': 'export default 1\n' })
    repo.escrever('apps/api/src/e.ts', 'export const outro = 1\n')
    expect(dos(rodar(repo))).toEqual(['saiu exportado apps/api default', 'entrou exportado apps/api outro'].sort())
  })

  it('o meio de um template com duas substituições, e o JSX reindentado', () => {
    const repo = repositorio({ 'apps/api/src/t.tsx': 'export const t = (x: string, y: string) => `a${x}b${y}c`\nexport const j = <p>Tela</p>\n' })
    repo.escrever('apps/api/src/t.tsx', 'export const t = (x: string, y: string) => `a${x}B${y}c`\nexport const j = (\n  <p>\n    Tela\n  </p>\n)\n')
    expect(dos(rodar(repo))).toEqual(['entrou template apps/api/src/t.tsx B', 'saiu template apps/api/src/t.tsx b'].sort())
  })

  it('o JSX só reindentado não é diferença', () => {
    const repo = repositorio({ 'apps/api/src/j.tsx': 'export const j = <p><b>Tela</b> toda aqui</p>\n' })
    repo.escrever('apps/api/src/j.tsx', 'export const j = (\n  <p>\n    <b>Tela</b>\n    toda\n    aqui\n  </p>\n)\n')
    expect(rodar(repo)).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('o título que não é texto não entra no caminho, e o expect com texto não é caso', () => {
    const repo = repositorio({ 'apps/api/src/c.test.ts': "describe(String(1), () => {\n  it('um', () => { expect('abc').toBe('abc') })\n})\n" })
    repo.escrever('apps/api/src/c.test.ts', "describe(String(1), () => {\n  it('um', () => { expect('abd').toBe('abc') })\n  it('dois', () => {})\n})\n")
    expect(dos(rodar(repo))).toEqual(['entrou caso apps/api/src/c.test.ts dois', 'entrou string apps/api/src/c.test.ts abd', 'saiu string apps/api/src/c.test.ts abc'].sort())
  })

  it('o título em template: o texto fixo é o do caso', () => {
    const repo = repositorio({ 'apps/api/src/c.test.ts': 'it(`a ${1} b`, () => {})\n' })
    repo.escrever('apps/api/src/c.test.ts', 'it(`a ${1} c`, () => {})\n')
    expect(dos(rodar(repo))).toEqual(['entrou caso apps/api/src/c.test.ts a ${} c', 'saiu caso apps/api/src/c.test.ts a ${} b'].sort())
  })
})

describe('conferir: verde quando', () => {
  it('a árvore é a do HEAD', () => {
    const resultado = rodar(repositorio())
    expect(resultado).toMatchObject({ codigo: 0, divergencias: [] })
    expect(resultado.texto).toMatch(/^conferir: verde\./)
  })

  it('o especificador e o nome exportado são os renomeados: símbolo, arquivo e pacote', () => {
    const repo = repositorio({
      'apps/api/src/b.test.ts': "import { vi } from 'vitest'\nvi.mock('./fila/x.ts')\nimport { x } from './fila/x.ts'\nit('usa', () => { expect(x).toBe(1) })\n",
      'apps/api/src/fila/x.ts': 'export const x = 1\n',
      'packages/shared/src/pasta/y.ts': "import { z } from '../z.ts'\nexport const y = z\n",
      'packages/shared/src/z.ts': 'export const z = 1\n',
    })
    // A onda aplicada à mão: o símbolo, o arquivo, a pasta e o pacote.
    repo.git('mv', 'apps/api/src/fila', 'apps/api/src/queue')
    repo.git('mv', 'packages/shared/src/z.ts', 'packages/shared/src/zeta.ts')
    repo.escrever('apps/api/src/b.test.ts', "import { vi } from 'vitest'\nvi.mock('./queue/x.ts')\nimport { x } from './queue/x.ts'\nit('usa', () => { expect(x).toBe(1) })\n")
    repo.escrever('packages/shared/src/pasta/y.ts', "import { z } from '../zeta.ts'\nexport const y = z\n")
    repo.escrever('packages/shared/src/db.ts', 'export class Database {}\n')
    repo.escrever('apps/api/src/a.ts', "import { Database } from '@educa/common'\nexport const a = new Database()\n")
    const resultado = rodar(repo, [
      { tipo: 'simbolo', de: 'Banco', para: 'Database', arquivo: 'packages/shared/src/db.ts' },
      { tipo: 'arquivo', de: 'packages/shared/src/z.ts', para: 'packages/shared/src/zeta.ts' },
      { tipo: 'pasta', de: 'apps/api/src/fila', para: 'apps/api/src/queue' },
      { tipo: 'pacote', de: '@educa/shared', para: '@educa/common' },
    ])
    expect(resultado.divergencias).toEqual([])
    expect(resultado.codigo).toBe(0)
  })

  it('o pacote com subcaminho: o subcaminho muda antes do nome', () => {
    const repo = repositorio({ 'apps/api/src/s.ts': "import { x } from '@educa/shared/armazem-s3'\nexport const s = x\n" })
    repo.escrever('apps/api/src/s.ts', "import { x } from '@educa/common/storage'\nexport const s = x\n")
    const resultado = rodar(repo, [
      { tipo: 'pacote', de: '@educa/shared/armazem-s3', para: '@educa/shared/storage' },
      { tipo: 'pacote', de: '@educa/shared', para: '@educa/common' },
    ])
    expect(resultado.divergencias.filter((d) => d.arquivo === 'apps/api/src/s.ts')).toEqual([])
  })

  it('a string mudada está declarada como exceção, nos dois lados', () => {
    const repo = repositorio({ 'apps/api/src/e.ts': "export const nome = 'ErroDeInvariante'\n" })
    repo.escrever('apps/api/src/e.ts', "export const nome = 'InvariantException'\n")
    const duas = [
      { arquivo: 'apps/api/src/e.ts', texto: 'ErroDeInvariante', motivo: 'o this.name acompanha a classe (adenda 1)' },
      { arquivo: 'apps/api/src/e.ts', texto: 'InvariantException', motivo: 'o this.name acompanha a classe (adenda 1)' },
    ]
    expect(rodar(repo, [], duas).codigo).toBe(0)
    expect(dos(rodar(repo, [], duas.slice(0, 1)))).toEqual(['entrou string apps/api/src/e.ts InvariantException'])
  })

  it('um arquivo de teste foi movido e tem os mesmos casos', () => {
    const repo = repositorio({ 'apps/api/src/velho.test.ts': "describe('a', () => {\n  it('um', () => {})\n})\n" })
    repo.git('mv', 'apps/api/src/velho.test.ts', 'apps/api/src/novo.test.ts')
    const resultado = rodar(repo, [{ tipo: 'arquivo', de: 'apps/api/src/velho.test.ts', para: 'apps/api/src/novo.test.ts' }])
    expect(resultado).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('o arquivo importador movido para outra profundidade: o import relativo muda de texto e o alvo é o mesmo', () => {
    const repo = repositorio({ 'apps/api/src/b.ts': 'export const b = 1\n', 'apps/api/src/c.ts': "import { b } from './b.ts'\nexport const c = b\n" })
    repo.escrever('apps/api/src/sub/c.ts', "import { b } from '../b.ts'\nexport const c = b\n")
    repo.git('rm', '-q', '-f', 'apps/api/src/c.ts')
    const resultado = rodar(repo, [{ tipo: 'arquivo', de: 'apps/api/src/c.ts', para: 'apps/api/src/sub/c.ts' }])
    expect(resultado).toMatchObject({ codigo: 0, divergencias: [] })
  })

  it('o arquivo de teste movido sem o mapa: os casos saem de um arquivo e entram em outro', () => {
    const repo = repositorio({ 'apps/api/src/velho.test.ts': "describe('a', () => {\n  it('um', () => {})\n})\n" })
    repo.git('mv', 'apps/api/src/velho.test.ts', 'apps/api/src/novo.test.ts')
    expect(dos(rodar(repo)).filter((linha) => linha.includes('caso'))).toEqual(['entrou caso apps/api/src/novo.test.ts a', 'entrou caso apps/api/src/novo.test.ts a › um', 'saiu caso apps/api/src/velho.test.ts a', 'saiu caso apps/api/src/velho.test.ts a › um'].sort())
  })

  it('o nome exportado muda de arquivo dentro do mesmo pacote: o conjunto do pacote é o mesmo', () => {
    const repo = repositorio({ 'packages/shared/src/outro.ts': 'export const o = 1\n' })
    repo.escrever('packages/shared/src/db.ts', 'export const o = 1\n')
    repo.escrever('packages/shared/src/outro.ts', 'export class Banco {}\n')
    expect(rodar(repo).divergencias).toEqual([])
  })

  it('tools/renomear/ fica fora da foto: uma string nova lá não conta', () => {
    const repo = repositorio({ 'tools/renomear/x.ts': "export const x = 'antes'\n" })
    repo.escrever('tools/renomear/x.ts', "export const x = 'depois'\n")
    expect(rodar(repo)).toMatchObject({ codigo: 0, divergencias: [] })
  })
})

describe('conferir: o alvo não existe', () => {
  it('a foto do HEAD vazia lança, e diz a pasta', () => {
    const repo = montarRepositorio({ 'LEIAME.md': 'sem código\n' })
    expect(() => rodar(repo)).toThrow(/a foto do HEAD não tem arquivo em apps\//)
  })

  it('a pasta da foto que o HEAD não tem lança, mesmo com as outras cheias', () => {
    const { 'infra/scripts/s.ts': _fora, ...semScripts } = BASE
    expect(() => rodar(montarRepositorio(semScripts))).toThrow(/não tem arquivo em infra\/scripts\//)
  })

  it('a raiz que não existe lança', () => {
    expect(() => conferir('/nao/existe/mesmo', CAMINHO_DO_MAPA)).toThrow(/não existe/)
  })

  it('o mapa que não existe lança', () => {
    expect(() => conferir(repositorio().raiz, 'tools/renomear/mapas/9.json')).toThrow(/ENOENT.*mapas\/9\.json/)
  })

  it('o mapa sem a linha do anexo lança, sem conferir', () => {
    const repo = repositorio()
    repo.escrever(CAMINHO_DO_MAPA, JSON.stringify({ entradas: [{ tipo: 'simbolo', de: 'Banco', para: 'Database' }] }))
    expect(() => conferir(repo.raiz, CAMINHO_DO_MAPA)).toThrow(/mapa inválido/)
  })
})

describe('conferir: a linha de comando', () => {
  const SCRIPT = join(import.meta.dirname, 'conferir.ts')
  const rodarComando = (repo: RepositorioDeTeste, ...argumentos: string[]) => spawnSync('node', [SCRIPT, ...argumentos], { cwd: repo.raiz, encoding: 'utf8' })

  it('sai 0 no verde, 1 no vermelho e 2 sem o --mapa ou com o alvo que falta', () => {
    const repo = repositorio()
    repo.escrever(CAMINHO_DO_MAPA, JSON.stringify({ entradas: [] }))
    const verde = rodarComando(repo, '--mapa', CAMINHO_DO_MAPA)
    expect([verde.status, verde.stdout]).toEqual([0, expect.stringMatching(/^conferir: verde/)])
    repo.escrever('apps/api/src/a.ts', "export const a = 'mudou'\n")
    const vermelho = rodarComando(repo, '--mapa', CAMINHO_DO_MAPA)
    expect([vermelho.status, vermelho.stdout]).toEqual([1, expect.stringMatching(/^conferir: VERMELHO/)])
    expect(rodarComando(repo).status).toBe(2)
    expect(rodarComando(repo, '--mapa', 'tools/renomear/mapas/9.json').status).toBe(2)
  })
})
