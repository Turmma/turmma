import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Marca } from './ui/Marca'

/**
 * A onça da marca chega por `import()`: ela não entra no primeiro carregamento da entrada (o peso é o pedaço `pecas-*`, que a
 * entrada não baixa antes da casca pintada). A caixa que a guarda já tem o tamanho dela, e por isso a página não pula quando
 * o desenho chega (`fallback` vazio).
 */
type PropsDaOnca = { readonly tamanho: 88 | 160; readonly animada?: boolean }

const OncaDaMarca = lazy<ComponentType<PropsDaOnca>>(() =>
  import('./ui/onca/OncaDaMarca')
    .then(({ OncaDaMarca: peca }) => ({ default: peca }))
    .catch(() => SEM_ONCA),
)

/**
 * O que a casca desenha quando o pedaço da onça não carrega (a rede da escola às 7h30): nada. A onça é enfeite, e a falha dela não
 * derruba a entrada, o convite, o segundo fator nem a página da turma, que usam esta casca e não têm fronteira de erro em volta.
 * As caixas de 160 e 88 px continuam no lugar, vazias, e a página não pula.
 */
function SemOnca(_: PropsDaOnca): null {
  return null
}
const SEM_ONCA = { default: SemOnca }

/**
 * A casca das telas de fora da sessão: entrada da equipe, endereço da escola, segundo fator, convite e página da turma
 * (`docs/interface.md` 11.3; D80 revista em 30/10/2026).
 *
 * **A partir de 1024 px a tela se divide**: à esquerda o painel em `papel`, com a borda de 2 px em `borda`, a marca no topo e a
 * onça da marca (9.7) de 160 px no centro, acenando; à direita o cartão do formulário, centrado. **Abaixo disso empilha**: o
 * painel vira uma faixa em `papel` só com a marca, a onça de 88 px, parada, vai sobre `fundo` acima do
 * formulário, e o formulário vem embaixo, em coluna única a partir de 360 px, com a largura presa em `max-w-md` para o
 * Chromebook de 1366 px não espalhar um formulário de dois campos pela tela inteira (regra 50, item 2a).
 *
 * - **Um `banner`, um `main` e o `h1` do título.** O `banner` é só a marca, com a pinta dela (`alt=""`: o nome "Turmma" já diz o
 *   que a imagem é). A onça fica **fora** dele.
 * - **A onça é a da marca, sem assinatura**: nenhum agente produziu nada na entrada, então ela não tem nome de função, selo
 *   "IA" nem nome acessível, e a `figure` é `aria-hidden` (`OncaDaMarca`; regra 70, item 4a). Nenhum texto novo (RF20 da X1)
 * - **Se o pedaço da onça não carregar, a página fica como está**, sem a onça (`SemOnca`): a casca não tem fronteira de erro, e uma
 *   figura de enfeite não derruba o formulário
 * - **O aceno é da marca**: a onça escondida pelo CSS (a de 160 px no celular) só gasta o aceno da marca, e a onça da introdução do
 *   papel, que vem depois sem recarregar a página, ainda acena (`movimento-da-onca.ts`)
 * - **Sem laço**: entra em 240 ms e acena uma vez, no computador; no celular fica parada. Os dois param com "reduzir
 *   movimento" (D59). A pinta grande e apagada do painel (X1, 14.0) saiu
 * - **A onça do painel fica no centro dele**, nos dois eixos (`inset-0 m-auto`, sem `transform`), na altura do centro do
 *   cartão, que também é centrado: os dois se leem como um par. Com 160 px ela cabe em qualquer painel de computador, abaixo
 *   da marca, que ocupa os 108 px de cima: por isso o painel não precisa de altura mínima
 * - **O painel é `papel`, e não `laranja-claro`**: a foto do tema claro mostrou que os pés da onça, que são do mesmo creme do
 *   `laranja-claro`, somem sobre ele: o pé direito desaparece e o esquerdo só se lê pela sombra do chão. Sobre o `papel` eles
 *   aparecem, sem cor nova e sem mexer na onça (11.3; D80 revista)
 * - **Nenhuma delas tem "Sair"**: não há sessão ainda
 */
export function CascaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo text-tinta lg:grid lg:grid-cols-2">
      <div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:border-r-2 lg:border-b-0">
        <header className="relative px-4 py-3 sm:px-6 lg:px-10 lg:py-10">
          <Marca />
        </header>
        <div data-onca-da-marca-grande="" className="pointer-events-none absolute inset-0 m-auto hidden size-40 select-none lg:block">
          <Suspense fallback={null}>
            <OncaDaMarca tamanho={160} />
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
