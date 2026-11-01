import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * O que `components/perigo-cheio.test.ts` usa para achar onde o `perigo` cheio é escrito: o botão `vermelho` que só existe
 * dentro de uma confirmação (RF5 da X1; `docs/interface.md` 10.2). Fica fora do teste para a regra de achar ser, ela
 * mesma, uma peça com mutação declarada.
 */

/**
 * O texto sem comentário e sem o que está entre aspas: "fundo cheio", numa frase ou numa explicação, não é o botão. Num
 * texto com `${ … }`, o que fica é o código de dentro dele: `className={`${buttonVariants({ cheio })}`}` é uso.
 */
export function codigoSemComentarioNemTexto(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:[^`\\]|\\.)*`/g, (modelo) => [...modelo.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(([, codigo = '']) => ` ${codigo} `).join(' '))
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
}

/** A tag `<Button …>` com uma prop `cheio` dentro: os `{ … }` das props podem ter `>` (uma seta) e um objeto dentro. */
const PROP_CHEIO_NO_BOTAO = /<Button\b(?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\bcheio\b/

/** O objeto de `buttonVariants({ … cheio … })`. */
const CHAVE_CHEIO_NAS_CLASSES = /\bbuttonVariants\(\s*\{[^}]*\bcheio\b/

/**
 * O arquivo escreve o `perigo` cheio? De três jeitos: pela constante `DANGER_SOLID_BUTTON_CLASSES`, pela prop `cheio` do
 * `<Button variante="perigo" cheio>`, ou pela chave do `buttonVariants({ variante: 'perigo', cheio: true })`. A palavra
 * solta não basta: `const [cheio, definirCheio] = useState(false)` é a sala que encheu (`pages/TurmaPublica.tsx`).
 */
export function usaOPerigoCheio(texto: string): boolean {
  const codigo = codigoSemComentarioNemTexto(texto)
  return /\bDANGER_SOLID_BUTTON_CLASSES\b/.test(codigo) || PROP_CHEIO_NO_BOTAO.test(codigo) || CHAVE_CHEIO_NAS_CLASSES.test(codigo)
}

/** Os arquivos de código da web, sem teste: o caminho de cada um a partir de `apps/web/src`, com `/`. */
export function arquivosDeCodigoDaWeb(raiz: string, pasta = raiz): string[] {
  const arquivos: string[] = []
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === '__fixtures__' || entrada.name === 'node_modules') continue
      arquivos.push(...arquivosDeCodigoDaWeb(raiz, caminho))
    } else if (/\.(?:ts|tsx)$/.test(entrada.name) && !/\.(?:test|spec)\.tsx?$/.test(entrada.name)) {
      arquivos.push(relative(raiz, caminho).replaceAll('\\', '/'))
    }
  }
  return arquivos.sort()
}

/** Os arquivos de código da web que escrevem o `perigo` cheio. */
export function arquivosQueUsamOPerigoCheio(raiz: string): string[] {
  return arquivosDeCodigoDaWeb(raiz).filter((arquivo) => usaOPerigoCheio(readFileSync(join(raiz, arquivo), 'utf8')))
}
