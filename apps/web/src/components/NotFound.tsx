import { Link } from 'wouter'
import { ROTAS } from '../paths'
import { useTituloDaTela } from '../document-title'

/**
 * Endereço que não existe, ou que não é do papel de quem está na sessão: diz o que fazer, sem código nem status (regra
 * 50, item 12). As duas coisas respondem igual, como na API (regra 10, item 6): a tela não confirma que o endereço da
 * coordenação existe para o professor que o digitou.
 *
 * O link começa por `~`, a raiz do wouter: dentro de uma área aninhada (`/professor`), `/` seria a raiz da área.
 */
export function ConteudoNaoEncontrado() {
  useTituloDaTela('Página não encontrada')
  return (
    <>
      <h1 className="text-xl font-semibold sm:text-2xl">Página não encontrada</h1>
      <p className="text-apoio">
        Confira o endereço digitado ou volte à{' '}
        <Link className="text-caramelo-texto underline" to={`~${ROTAS.inicio}`}>
          página inicial
        </Link>
        .
      </p>
    </>
  )
}

/** A mesma resposta sem sessão, fora da casca: a página inteira. */
export function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-3 bg-fundo px-4 py-6 text-tinta sm:px-6">
      <ConteudoNaoEncontrado />
    </main>
  )
}
