import type { ComponentType } from 'react'
import { Aparencia } from '../components/Aparencia'
import { Page } from '../components/ui/Page'
import { usePageTitle } from '../document-title'

/**
 * A galeria das peças (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 10): uma tela só, fora da navegação, onde cada peça de
 * `components/` e de `components/ui/ai/` aparece nos seus estados. É nela que o Playwright prova as peças, nos projetos
 * `chromebook` e `celular` (`e2e/pecas-*.spec.ts`), antes de as telas existirem, e nos dois temas (`Aparencia`, no topo).
 *
 * **Uma seção por arquivo**, em `sections/<grupo>.tsx`, registradas por `import.meta.glob`: peça nova entra criando ou
 * acrescentando no arquivo do grupo dela, sem editar este, e duas tarefas que correm em paralelo não editam o mesmo
 * arquivo. Cada arquivo exporta, por padrão, o componente que desenha as seções do grupo.
 *
 * Não chama a API e não tem sessão: tudo aqui é dado inventado, escrito nos arquivos das seções (regra 20, item 17). O e2e
 * roda sobre o build de produção, e por isso a galeria está nele — num pedaço próprio (`galeria-*.js`), que só quem digita
 * o endereço baixa (`apps/web/chunk-names.ts`), e que só o build com `VITE_COM_GALERIA=1` leva (`src/routes.tsx`).
 */
const ARQUIVOS_DAS_SECOES = import.meta.glob<{ default: ComponentType }>('./sections/*.tsx', { eager: true })

/**
 * Em ordem de nome de arquivo, que é a ordem na página: a mesma em toda máquina e em toda corrida do e2e. A ordem de antes
 * da divisão (a do arquivo único) **não foi mantida**: o conteúdo de cada bloco é o mesmo, e a ordem passou a ser a dos nomes.
 */
const SECOES = Object.entries(ARQUIVOS_DAS_SECOES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([caminho, modulo]) => ({ caminho, Secoes: modulo.default }))

export default function Galeria() {
  usePageTitle('Galeria de peças')
  return (
    <main className="min-h-screen bg-fundo text-tinta">
      <Page comMargem titulo="Galeria de peças" objeto descricao="As peças do MVP de apresentação, com dado inventado. Não é uma tela do produto." largura="formulario">
        <div className="max-w-xs">
          <Aparencia />
        </div>
        {SECOES.map(({ caminho, Secoes }) => (
          <Secoes key={caminho} />
        ))}
      </Page>
    </main>
  )
}
