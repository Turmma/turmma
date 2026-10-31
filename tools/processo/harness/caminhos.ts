// A extração e a conferência de um caminho citado em texto, para `caminhos.test.ts` (RF24) e `receitas.test.ts` (RF32).
//
// A extração devolve o token cru (com `<...>`, `*` e a `/` final, sem repetir), e cada teste filtra o seu: a 16.0 confere papel,
// regra e guarda; a 21.0 confere a skill de receitas e o guia. Limites declarados: caminho escrito com espaço, ou partido em duas
// crases, não é extraído; o `./` solto no fim de uma frase leva o ponto junto (`./apps/x.ts.`) e vira falso vermelho (a saída é pôr o
// caminho entre crases); e o que o texto cita sem pasta da raiz (`components/dialogs.tsx`, `guardas/log-sem-dado-pessoal`, uma
// rota) não é conferido.
import { existsSync, globSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** As pastas da raiz que fazem de um token um caminho (Tech Spec §9). O resto não é conferido. */
export const PASTAS_DA_RAIZ = ['apps/', 'packages/', 'tools/', 'e2e/', 'infra/', 'docs/', '.claude/']

/** Placeholder: `<modulo>`, a reticência e `${x}`. A pasta antes dele é o que se confere. */
const PLACEHOLDER = /<[^>]*>|…|\$\{[^}]*\}/

/** Os tokens crus que o texto cita como caminho: entre crases, entre aspas ou começando por `./`, sem espaço dentro. */
export function extrairCaminhos(texto: string): string[] {
  const achados = [
    ...[...texto.matchAll(/`([^`\s]+)`/g)].map((achado) => achado[1] ?? ''),
    ...[...texto.matchAll(/(["'])([^"'`\s]+)\1/g)].map((achado) => achado[2] ?? ''),
    ...[...texto.matchAll(/(?<![\w./`'"-])(\.\/[^\s`'",;)\]]+)/g)].map((achado) => achado[1] ?? ''),
  ]
  return [...new Set(achados)]
}

/** O token começa, sem o `./`, por uma das pastas da raiz. */
export const ehCaminho = (token: string): boolean => {
  const semPonto = token.replace(/^\.\//, '')
  return PASTAS_DA_RAIZ.some((pasta) => semPonto.startsWith(pasta))
}

/** Se `caminho` é uma pasta que existe; `false` para o que falta ou não é pasta. */
export const ehPasta = (caminho: string): boolean => {
  try {
    return statSync(caminho).isDirectory()
  } catch {
    return false
  }
}

/** Uma frase se o caminho não existe sob `raiz`; `null` se existe. Sem o `:<linha>` e o `#<âncora>`. */
export function problemaDoCaminho(token: string, raiz: string): string | null {
  const caminho = token.replace(/^\.\//, '').replace(/#.*$/, '').replace(/:\d+(?:-\d+)?$/, '')
  const placeholder = PLACEHOLDER.exec(caminho)
  if (placeholder !== null) {
    const antes = caminho.slice(0, placeholder.index)
    const pasta = antes.endsWith('/') ? antes : dirname(antes)
    return ehPasta(join(raiz, pasta)) ? null : `a pasta ${pasta} não existe`
  }
  if (caminho.includes('*')) return globSync(caminho, { cwd: raiz }).length > 0 ? null : 'o padrão não casa com nenhum arquivo'
  return existsSync(join(raiz, caminho)) ? null : 'não existe'
}
