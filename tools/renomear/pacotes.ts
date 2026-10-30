import { posix } from 'node:path'
import type { Arvore, Movimento } from './arvore.ts'
import type { EntradaDoMapa } from './mapa.ts'
import { trocarEspecificadoresDoPacote } from './especificadores.ts'

/**
 * Passo 4 do `aplicar`: o pacote. O `name`, as dependências, o subcaminho de `exports` e os especificadores de módulo mudam;
 * o `package-lock.json` é do `npm install --package-lock-only`, que o `aplicar` roda depois de gravar. O `-w @educa/nucleo` dos
 * scripts, o `knip.json` e o resto do texto são travas, trocadas à mão.
 */

const ehPackageJson = (caminho: string): boolean => /(^|\/)package\.json$/.test(caminho) && !caminho.includes('node_modules/')

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** O nome do pacote de `@escopo/nome/sub` ou `nome/sub`. */
function nomeDoPacote(especificador: string): string {
  const partes = especificador.split('/')
  return partes.slice(0, especificador.startsWith('@') ? 2 : 1).join('/')
}

const subcaminhoDe = (especificador: string): string => especificador.slice(nomeDoPacote(especificador).length + 1)

function pacotesDaArvore(arvore: Arvore): Array<{ caminho: string; nome: string }> {
  return arvore.caminhos().flatMap((caminho) => {
    const texto = arvore.lerOuNada(caminho)
    if (!ehPackageJson(caminho) || texto === undefined) return []
    try {
      const nome = (JSON.parse(texto) as { name?: unknown }).name
      return typeof nome === 'string' ? [{ caminho, nome }] : []
    } catch {
      return []
    }
  })
}

/** O pacote existe: o nome está em um `package.json`, ou o subcaminho está nos `exports` dele. */
export function pacoteExiste(arvore: Arvore, de: string): boolean {
  const nome = nomeDoPacote(de)
  const sub = subcaminhoDe(de)
  return pacotesDaArvore(arvore).some((pacote) => {
    if (pacote.nome !== nome) return false
    return sub === '' || arvore.ler(pacote.caminho).includes(`"./${sub}"`)
  })
}

/** Troca o nome (`name` e chaves de dependência) ou o subcaminho de `exports`. Devolve `true` se mudou o nome de um pacote. */
export function renomearPacote(arvore: Arvore, entrada: EntradaDoMapa): boolean {
  const sub = subcaminhoDe(entrada.de)
  let mudouNome = false
  for (const pacote of pacotesDaArvore(arvore)) {
    if (sub !== '') {
      if (pacote.nome !== nomeDoPacote(entrada.de) && pacote.nome !== nomeDoPacote(entrada.para)) continue
      const chave = new RegExp(`"\\./${escapar(sub)}"(?=\\s*:)`, 'g')
      arvore.escrever(pacote.caminho, arvore.ler(pacote.caminho).replace(chave, `"./${subcaminhoDe(entrada.para)}"`))
    }
  }
  if (sub === '') {
    for (const caminho of arvore.caminhos().filter(ehPackageJson)) {
      const texto = arvore.lerOuNada(caminho) ?? ''
      // O nome do pacote, e a chave de dependência (`"@educa/nucleo": "0.0.0"`): o texto exato entre aspas, seguido de `:` ou valor de `name`.
      const novo = texto
        .replace(new RegExp(`("name"\\s*:\\s*)"${escapar(entrada.de)}"`), `$1"${entrada.para}"`)
        .replace(new RegExp(`"${escapar(entrada.de)}"(?=\\s*:)`, 'g'), `"${entrada.para}"`)
      if (novo !== texto) {
        arvore.escrever(caminho, novo)
        mudouNome = true
      }
    }
  }
  trocarEspecificadoresDoPacote(arvore, entrada.de, entrada.para)
  return mudouNome
}

/** Todas as entradas de pacote do mapa. O subcaminho antes do nome: `@educa/nucleo/armazem-s3` muda antes de `@educa/nucleo`, senão o primeiro some do segundo. Devolve `true` se algum nome mudou. */
export function renomearPacotes(arvore: Arvore, entradas: readonly EntradaDoMapa[]): boolean {
  const pacotes = entradas.filter((entrada) => entrada.tipo === 'pacote').sort((a, b) => b.de.length - a.de.length)
  return pacotes.map((entrada) => renomearPacote(arvore, entrada)).some(Boolean)
}

/** O caminho de `dist` que o `build` produz para um arquivo de `src`, nas três formas que os `exports` citam. */
function formasDeDist(arquivo: string): string[] {
  const sub = arquivo.replace(/^src\//, '').replace(/\.(?:tsx?|mts|cts)$/, '')
  return [`dist/${sub}.js`, `dist/${sub}.d.ts`, `dist/${sub}`]
}

/** Para cada `package.json`, os `exports` (e `main`/`types`) que citam o que mudou de lugar passam a citar o lugar novo. */
export function atualizarAlvosDoPacote(arvore: Arvore, movimento: Movimento): void {
  for (const caminho of arvore.caminhos().filter(ehPackageJson)) {
    const pasta = posix.dirname(caminho) === '.' ? '' : posix.dirname(caminho)
    const dentro = (arquivo: string) => (pasta === '' ? arquivo : arquivo.startsWith(`${pasta}/`) ? arquivo.slice(pasta.length + 1) : undefined)
    const antigo = dentro(movimento.de)
    const novo = dentro(movimento.para)
    if (antigo === undefined || novo === undefined || !arvore.lerOuNada(caminho)?.includes('./')) continue
    const pares: Array<[string, string]> = [[antigo, novo]]
    if (!movimento.pasta) pares.push(...formasDeDist(antigo).map((forma, i) => [forma, formasDeDist(novo)[i] ?? forma] as [string, string]))
    else pares.push([`dist/${antigo.replace(/^src\//, '')}`, `dist/${novo.replace(/^src\//, '')}`])
    let texto = arvore.ler(caminho)
    for (const [de, para] of pares) {
      texto = texto.replace(new RegExp(`"\\./${escapar(de)}(?=["/])`, 'g'), `"./${para}`)
    }
    arvore.escrever(caminho, texto)
  }
}
