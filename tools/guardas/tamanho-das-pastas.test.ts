import { readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'

// A trava de tamanho de pasta (R56, RECORTE.md §3 item 7): pasta com mais de 25 arquivos de produção direto nela
// reprova, e a divisão por assunto (o *feature folder* do bulletproof-react) é o que a 97.0 fez em `areas/professor/` e
// `areas/coordenacao/`. Pasta grande é onde ninguém acha nada e onde dois assuntos se misturam sem ninguém ver.

/** O teto de arquivos de produção direto numa pasta. Teste, `.d.ts` e `__fixtures__` não contam. */
const LIMITE_DE_ARQUIVOS_POR_PASTA = 25

/** As raízes que a trava percorre, relativas à raiz do repositório. */
const RAIZES_DA_TRAVA: readonly string[] = ['apps/web/src', 'apps/api/src']

/** As pastas que passam do teto de propósito, com o motivo. Lista fechada: entrar nela é decisão, e não conserto. */
const EXCECOES_DA_TRAVA: readonly { pasta: string; motivo: string }[] = []

/** `.ts` e `.tsx` de produção: sem teste (`.test.`), sem declaração (`.d.ts`) e fora de uma pasta `__fixtures__`. */
function ehArquivoDeProducao(caminho: string): boolean {
  if (!/\.tsx?$/.test(caminho)) return false
  if (/\.d\.ts$/.test(caminho) || /\.test\.tsx?$/.test(caminho)) return false
  return !caminho.split('/').includes('__fixtures__')
}

interface PastaGrande {
  pasta: string
  quantidade: number
}

/** As pastas com mais arquivos de produção **direto nelas** (as subpastas contam por conta própria) que o teto. */
function pastasAcimaDoLimite(
  caminhos: readonly string[],
  excecoes: readonly { pasta: string }[] = EXCECOES_DA_TRAVA,
  limite = LIMITE_DE_ARQUIVOS_POR_PASTA,
): PastaGrande[] {
  const porPasta = new Map<string, number>()
  for (const caminho of caminhos.filter(ehArquivoDeProducao)) {
    const pasta = posix.dirname(caminho)
    porPasta.set(pasta, (porPasta.get(pasta) ?? 0) + 1)
  }
  return [...porPasta]
    .filter(([pasta, quantidade]) => quantidade > limite && !excecoes.some((excecao) => excecao.pasta === pasta))
    .map(([pasta, quantidade]) => ({ pasta, quantidade }))
    .sort((a, b) => a.pasta.localeCompare(b.pasta))
}

/** Todo arquivo sob as raízes, no disco (e não no índice do git: o arquivo movido e ainda não preparado já conta no lugar novo). */
function arquivosDasRaizes(raizes: readonly string[]): string[] {
  const dePasta = (relativo: string): string[] =>
    readdirSync(join(raizRepositorio, relativo), { withFileTypes: true }).flatMap((entrada) => {
      const filho = posix.join(relativo, entrada.name)
      return entrada.isDirectory() ? dePasta(filho) : [filho]
    })
  return raizes.flatMap(dePasta)
}

/** `n` arquivos de produção numa pasta: `<pasta>/a0.ts`, `<pasta>/a1.ts`… */
function arquivos(pasta: string, n: number, extensao = '.ts'): string[] {
  return Array.from({ length: n }, (_, i) => `${pasta}/a${String(i)}${extensao}`)
}

describe('trava: pasta com mais de 25 arquivos de produção', () => {
  it('26 arquivos de produção reprovam e nomeiam a pasta; 25 passam', () => {
    expect(pastasAcimaDoLimite(arquivos('apps/web/src/areas/x', 26))).toEqual([{ pasta: 'apps/web/src/areas/x', quantidade: 26 }])
    expect(pastasAcimaDoLimite(arquivos('apps/web/src/areas/x', 25))).toEqual([])
    expect(pastasAcimaDoLimite([...arquivos('apps/web/src/areas/x', 26, '.tsx'), ...arquivos('apps/web/src/areas/y', 3)])).toEqual([{ pasta: 'apps/web/src/areas/x', quantidade: 26 }])
  })

  it('teste, declaração e fixture não contam; o que não é .ts nem .tsx também não', () => {
    const pasta = 'apps/web/src/areas/x'
    const sombra = [
      ...arquivos(pasta, 10).map((caminho) => caminho.replace('.ts', '.test.ts')),
      ...arquivos(pasta, 10, '.tsx').map((caminho) => caminho.replace('.tsx', '.test.tsx')),
      ...arquivos(pasta, 10).map((caminho) => caminho.replace('.ts', '.d.ts')),
      ...arquivos(`${pasta}/__fixtures__`, 30),
      ...arquivos(pasta, 10).map((caminho) => caminho.replace('.ts', '.css')),
    ]
    // 25 de produção mais 50 que não contam: passa. Com um 26º de produção, reprova.
    expect(pastasAcimaDoLimite([...arquivos(pasta, 25), ...sombra])).toEqual([])
    expect(pastasAcimaDoLimite([...arquivos(pasta, 26), ...sombra])).toEqual([{ pasta, quantidade: 26 }])
    // A pasta `__fixtures__` é arquivo de teste, e não é nomeada nem sozinha.
    expect(pastasAcimaDoLimite(arquivos(`${pasta}/__fixtures__`, 30))).toEqual([])
  })

  it('conta o que está direto na pasta: 20 nela e 20 numa subpasta passam, porque a subpasta é uma pasta', () => {
    expect(pastasAcimaDoLimite([...arquivos('apps/web/src/areas/x', 20), ...arquivos('apps/web/src/areas/x/sub', 20)])).toEqual([])
    expect(pastasAcimaDoLimite([...arquivos('apps/web/src/areas/x', 20), ...arquivos('apps/web/src/areas/x/sub', 26)])).toEqual([{ pasta: 'apps/web/src/areas/x/sub', quantidade: 26 }])
  })

  it('a pasta da lista de exceções passa; a outra, com o mesmo tamanho, não', () => {
    const grandes = [...arquivos('apps/web/src/areas/x', 30), ...arquivos('apps/web/src/areas/y', 30)]
    expect(pastasAcimaDoLimite(grandes, [{ pasta: 'apps/web/src/areas/x' }])).toEqual([{ pasta: 'apps/web/src/areas/y', quantidade: 30 }])
  })

  it('várias pastas acima do teto saem em ordem de pasta, qualquer que seja a ordem em que os arquivos chegam', () => {
    const grandes = [...arquivos('apps/web/src/areas/y', 26), ...arquivos('apps/web/src/areas/x', 27)]
    expect(pastasAcimaDoLimite(grandes)).toEqual([
      { pasta: 'apps/web/src/areas/x', quantidade: 27 },
      { pasta: 'apps/web/src/areas/y', quantidade: 26 },
    ])
  })

  it('no repositório, nenhuma pasta das raízes da trava, web e API, passa de 25 arquivos de produção, e a conta enxerga as áreas e os recursos partidos', () => {
    const todos = arquivosDasRaizes(RAIZES_DA_TRAVA)
    // A conta não ficou vazia, e cada raiz da lista conta: sem a da API, os pontos de conferência dela somem e o caso reprova.
    expect(todos).toContain('apps/web/src/areas/professor/routes.tsx')
    expect(todos).toContain('apps/web/src/areas/professor/turmas/Turmas.tsx')
    expect(todos).toContain('apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx')
    expect(todos).toContain('apps/api/src/estrutura/turma/turma.controller.ts')
    expect(todos).toContain('apps/api/src/operacao/painel/painel.service.ts')
    expect(todos).toContain('apps/api/src/sala/salas/salas.controller.ts')
    expect(todos).toContain('apps/api/src/atividade/correcao/correcao.service.ts')
    expect(todos.filter(ehArquivoDeProducao).length).toBeGreaterThan(500)
    expect(pastasAcimaDoLimite(todos), 'divida a pasta por assunto, em subpastas com as telas, os hooks e o cliente de API dele (D81)').toEqual([])
    // Lista fechada: toda exceção tem o motivo escrito e ainda passa do teto. Exceção que a pasta já não precisa sai da lista.
    const acima = new Set(pastasAcimaDoLimite(todos, []).map((pasta) => pasta.pasta))
    expect(EXCECOES_DA_TRAVA.filter((excecao) => excecao.motivo.trim() === '' || !acima.has(excecao.pasta))).toEqual([])
  })
})
