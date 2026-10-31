import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { raizDoOuro } from './__fixtures__/golden.js'

/**
 * O selo do `ouro` (`docs/aia/ouro/SELO.json`): o sha256 de todo arquivo da pasta, menos o próprio selo, e o mesmo
 * conjunto de nomes. Quem altera o `ouro` é o Arquiteto, num commit de correção (`(correção <slug>)`, com o
 * `conformidade-reviewer`; RF16 da X7), e o selo é regravado no mesmo commit. Alteração de outra mão, ou arquivo a mais ou a menos, deixa este teste vermelho.
 * A 29.0 leva este arquivo para o módulo de políticas.
 */

const ARQUIVO_DO_SELO = 'SELO.json'

/** O que a pasta tem hoje: nome e sha256 de cada arquivo, sem o selo. A pasta do `ouro` não tem subpasta, e uma que surgisse estoura na leitura. */
function selarPasta(pasta: string): Record<string, string> {
  const selo: Record<string, string> = {}
  for (const nome of readdirSync(pasta)) {
    if (nome === ARQUIVO_DO_SELO) continue
    selo[nome] = createHash('sha256').update(readFileSync(join(pasta, nome))).digest('hex')
  }
  return selo
}

/** O que a pasta tem de diferente do que o `SELO.json` jura, arquivo por arquivo. */
function problemasDoSelo(pasta: string): string[] {
  const jurado = JSON.parse(readFileSync(join(pasta, ARQUIVO_DO_SELO), 'utf8')) as Record<string, string>
  const atual = selarPasta(pasta)
  const problemas: string[] = []
  for (const nome of new Set([...Object.keys(jurado), ...Object.keys(atual)])) {
    if (!(nome in jurado)) problemas.push(`${nome}: arquivo a mais, que o selo não conhece`)
    else if (!(nome in atual)) problemas.push(`${nome}: arquivo a menos, que o selo cita`)
    else if (jurado[nome] !== atual[nome]) problemas.push(`${nome}: o conteúdo mudou desde o selo`)
  }
  return problemas
}

describe('o selo do ouro', () => {
  const copias: string[] = []
  afterEach(() => {
    for (const copia of copias.splice(0)) rmSync(copia, { recursive: true, force: true })
  })
  function copiaDoOuro(): string {
    const pasta = mkdtempSync(join(tmpdir(), 'selo-do-ouro-'))
    copias.push(pasta)
    cpSync(raizDoOuro(), pasta, { recursive: true })
    return pasta
  }

  it('a pasta real confere com o SELO.json', () => {
    expect(problemasDoSelo(raizDoOuro())).toEqual([])
    expect(Object.keys(selarPasta(raizDoOuro())).sort()).toEqual([
      'MEDIDAS.json',
      'README.md',
      'assuntoDelicado.json',
      'julgamentoDeTextoDeAluno.json',
      'pedidoDeRespostaPronta.json',
      'riscoAVida.json',
      'saidaComNota.json',
      'saidaQualitativa.json',
    ])
  })

  it('a cópia intacta confere, e o selo não entra na conta', () => {
    const pasta = copiaDoOuro()
    expect(problemasDoSelo(pasta)).toEqual([])
    expect(Object.keys(selarPasta(pasta))).not.toContain(ARQUIVO_DO_SELO)
  })

  it('byte trocado num arquivo fica vermelho, e só nele', () => {
    const pasta = copiaDoOuro()
    const texto = readFileSync(join(pasta, 'riscoAVida.json'), 'utf8')
    writeFileSync(join(pasta, 'riscoAVida.json'), texto.replace('quero me matar', 'quero me matar '))
    expect(problemasDoSelo(pasta)).toEqual(['riscoAVida.json: o conteúdo mudou desde o selo'])
  })

  it('arquivo a mais fica vermelho', () => {
    const pasta = copiaDoOuro()
    writeFileSync(join(pasta, 'outraPolitica.json'), '{}')
    expect(problemasDoSelo(pasta)).toEqual(['outraPolitica.json: arquivo a mais, que o selo não conhece'])
  })

  it('arquivo a menos fica vermelho', () => {
    const pasta = copiaDoOuro()
    rmSync(join(pasta, 'saidaComNota.json'))
    expect(problemasDoSelo(pasta)).toEqual(['saidaComNota.json: arquivo a menos, que o selo cita'])
  })

  it('o selo regravado pelo Arquiteto com o conteúdo novo volta a conferir', () => {
    const pasta = copiaDoOuro()
    writeFileSync(join(pasta, 'README.md'), `${readFileSync(join(pasta, 'README.md'), 'utf8')}\nMais uma linha.\n`)
    expect(problemasDoSelo(pasta)).toHaveLength(1)
    writeFileSync(join(pasta, ARQUIVO_DO_SELO), `${JSON.stringify(selarPasta(pasta), null, 2)}\n`)
    expect(problemasDoSelo(pasta)).toEqual([])
  })
})
