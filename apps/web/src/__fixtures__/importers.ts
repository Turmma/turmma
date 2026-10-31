import { posix } from 'node:path'

/**
 * O que `components/ui/ai/avatar-so-nas-duas-pecas.test.ts` usa para dizer **quem importa** uma peça ou uma pasta: a
 * cadeia fechada da onça (`docs/interface.md` 9.7; Tech Spec da X1, 7b). Fica fora do teste para a regra de achar o
 * importador ser, ela mesma, uma peça com mutação declarada.
 *
 * Conta o que o navegador resolveria: `import … from`, `export … from`, `import '…'` e `import('…')`, com o tipo também
 * (`import type` carrega o módulo para o compilador, e a regra é de quem conhece quem). A web só importa por caminho
 * relativo, sem alias: o especificador é resolvido a partir da pasta do arquivo. Comentário não conta.
 */

export interface ArquivoDaWeb {
  /** O caminho a partir de `apps/web/src`, com `/` e a extensão: `components/ui/ai/AssinaturaIA.tsx`. */
  readonly nome: string
  readonly conteudo: string
}

/** O texto sem os comentários de bloco e de linha. O `//` de um endereço (`https://…`) não come o resto da linha. */
export function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const ESPECIFICADOR = /\b(?:from|import)\s*\(?\s*['"]([^'"\n]+)['"]/g

/** Os módulos que o arquivo importa, como estão escritos. */
export function especificadoresDe(conteudo: string): string[] {
  return [...semComentarios(conteudo).matchAll(ESPECIFICADOR)].map(([, especificador = '']) => especificador)
}

/**
 * Os arquivos de `arquivos` que importam `alvo`. O alvo é um arquivo sem extensão (`components/ui/ai/AvatarAgente`) ou uma
 * pasta, com a barra no fim (`components/ui/onca/`): o arquivo da pasta, e a pasta pelo `index`, contam.
 */
export function importadoresDe(arquivos: readonly ArquivoDaWeb[], alvo: string): string[] {
  const ehPasta = alvo.endsWith('/')
  return arquivos
    .filter(({ nome, conteudo }) =>
      especificadoresDe(conteudo)
        .map((especificador) => posix.normalize(posix.join(posix.dirname(nome), especificador)).replace(/\.(?:tsx?|jsx?)$/, ''))
        .some((resolvido) => (ehPasta ? resolvido === alvo.slice(0, -1) || resolvido.startsWith(alvo) : resolvido === alvo || resolvido === `${alvo}/index`)),
    )
    .map(({ nome }) => nome)
}
