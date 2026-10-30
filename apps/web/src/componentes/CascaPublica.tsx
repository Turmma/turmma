import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Marca } from './ui/Marca'

/**
 * A onça e o cenário dela chegam por `import()`: nenhum dos dois entra no primeiro carregamento da entrada (o peso é o pedaço
 * `pecas-*`, que a entrada não baixa antes da casca pintada). As caixas que os guardam já têm o tamanho deles, e por isso a
 * página não pula quando o desenho chega (`fallback` vazio).
 */
type PropsDaOnca = { readonly tamanho: 88; readonly animada?: boolean }

const OncaDaMarca = lazy<ComponentType<PropsDaOnca>>(() =>
  import('./ui/onca/OncaDaMarca')
    .then(({ OncaDaMarca: peca }) => ({ default: peca }))
    .catch(() => SEM_ONCA),
)

const CenaDaOnca = lazy<ComponentType>(() =>
  import('./ui/onca/CenaDaOnca')
    .then(({ CenaDaOnca: peca }) => ({ default: peca }))
    .catch(() => SEM_ONCA),
)

/**
 * O que a casca desenha quando o pedaço da onça não carrega (a rede da escola às 7h30): nada. A onça é enfeite, e a falha dela não
 * derruba a entrada, o convite, o segundo fator nem a página da turma, que usam esta casca e não têm fronteira de erro em volta.
 * As caixas de 432 × 300 e de 88 px continuam no lugar, vazias, e a página não pula.
 */
function SemOnca(): null {
  return null
}
const SEM_ONCA = { default: SemOnca }

/**
 * A casca das telas de fora da sessão: entrada da equipe, endereço da escola, segundo fator, convite e página da turma
 * (`docs/interface.md` 11.3; D80 revista em 30/10/2026).
 *
 * **A partir de 1024 px a tela se divide**: à esquerda o painel em `papel`, com a borda de 2 px em `borda`, a marca no topo e, no
 * centro, o cenário da onça da marca (9.7, `CenaDaOnca`): um canto de sala de 432 × 300 px, com a onça de 240 px acenando sobre os
 * livros, e com 40 px de respiro dos dois lados também a 1024 px (o painel tem 510 px úteis ali, por causa da borda, e a caixa
 * cede os 2 px que faltam com `lg:max-w-[calc(100%-5rem)]`); à direita o cartão do formulário, centrado.
 * **Abaixo disso empilha**: o painel vira uma faixa em `papel` só com a marca, a onça de 88 px, parada e sem cenário, vai sobre
 * `fundo` acima do formulário, e o formulário vem embaixo, em coluna única a partir de 360 px, com a largura presa em `max-w-md`
 * para o Chromebook de 1366 px não espalhar um formulário de dois campos pela tela inteira (regra 50, item 2a).
 *
 * - **Um `banner`, um `main` e o `h1` do título.** O `banner` é só a marca, com a pinta dela (`alt=""`: o nome "Turmma" já diz o
 *   que a imagem é). A onça fica **fora** dele.
 * - **A onça é a da marca, sem assinatura**: nenhum agente produziu nada na entrada, então ela não tem nome de função, selo
 *   "IA" nem nome acessível, e a `figure` é `aria-hidden` (`OncaDaMarca`, `CenaDaOnca`; regra 70, item 4a). Nenhum texto novo (RF20
 *   da X1)
 * - **Se o pedaço do cenário ou o da onça não carregar, a página fica como está**, sem eles (`SemOnca`): a casca não tem fronteira
 *   de erro, e uma figura de enfeite não derruba o formulário
 * - **O aceno é da marca**: a onça escondida pelo CSS (a do cenário no celular) só gasta o aceno da marca, e a onça da introdução
 *   do papel, que vem depois sem recarregar a página, ainda acena (`movimento-da-onca.ts`)
 * - **Sem laço**: a onça entra em 240 ms e acena uma vez, no computador; o cenário não anima nada, e no celular a onça fica
 *   parada. A animação para com "reduzir movimento" (D59). A pinta grande e apagada do painel (X1, 14.0) saiu
 * - **O cenário fica no centro do painel**, nos dois eixos (`inset-0 m-auto`, sem `transform`), na altura do centro do cartão, que
 *   também é centrado: os dois se leem como um par. O painel tem altura mínima de 34rem para o cenário de 300 px, centrado, não
 *   encostar na marca, que ocupa os 108 px de cima, em janela baixa (1366 × 650)
 * - **O painel é `papel`, e não `laranja-claro`**: a foto do tema claro mostrou que os pés da onça, que são do mesmo creme do
 *   `laranja-claro`, somem sobre ele: o pé direito desaparece e o esquerdo só se lê pela sombra do chão. Sobre o `papel` eles
 *   aparecem, sem cor nova e sem mexer na onça (11.3; D80 revista)
 * - **Nenhuma delas tem "Sair"**: não há sessão ainda
 */
export function CascaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo text-tinta lg:grid lg:grid-cols-2">
      <div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:min-h-[34rem] lg:border-r-2 lg:border-b-0">
        <header className="relative px-4 py-3 sm:px-6 lg:px-10 lg:py-10">
          <Marca />
        </header>
        <div data-cena-da-onca-caixa="" className="pointer-events-none absolute inset-0 m-auto hidden h-75 w-108 max-w-full select-none lg:block lg:max-w-[calc(100%-5rem)]">
          <Suspense fallback={null}>
            <CenaDaOnca />
          </Suspense>
        </div>
      </div>
      <div data-onca-da-marca-pequena="" className="mx-auto mt-6 size-22 shrink-0 select-none lg:hidden">
        <Suspense fallback={null}>
          <OncaDaMarca tamanho={88} animada={false} />
        </Suspense>
      </div>
      <div className="flex justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-10 lg:py-12">
        <main data-cartao-publico="" className="flex w-full max-w-md flex-col gap-6 lg:rounded-cartao lg:border-2 lg:border-borda lg:bg-superficie lg:p-8">
          <h1 className="t-titulo break-words">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
