import { useContext, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { estaNoItem, type IconeDoItem, type ItemDaNavegacao } from '../areas/navigation'
import { ContextoDaGaveta } from './drawer-context'
import { Icone } from './ui/Icone'
import { Ladrilho } from './ui/Ladrilho'

/**
 * O lugar da lateral (`docs/interface.md` 11.1; D80): uma linha de 52 px de canto 12 e borda de 2, com o ícone numa caixa de
 * 36 e o rótulo em `t-rotulo`. O mesmo desenho serve ao link de navegação e ao botão "Sair", e é por isso que os dois têm
 * a mesma altura e a mesma largura (RF15; D59): a altura é de quem desenha o lugar, e não de quem o usa.
 *
 * - **Aceso** tem a borda `azul-borda`, o fundo `azul-claro` e o texto `azul-texto`, e o `aria-current` quando é link. A
 *   pista que não é cor é a borda, que no apagado é transparente: o peso do texto não distingue mais (os dois em 700), e o
 *   filete de antes saiu.
 * - **Apagado** tem a borda transparente, o texto `sutil` e, no hover, `fundo-suave` com `tinta`. O espaço da borda existe
 *   nos dois estados, e por isso acender não desloca nada.
 * - No **trilho** o lugar é um quadrado de 52 px com só o ícone, e o rótulo vai para o leitor de tela e para a dica.
 */
const FORMA_DO_LUGAR = 'group relative flex items-center rounded-controle border-2 text-left'
const LUGAR_ABERTO = 'min-h-13 w-full gap-3 px-2'
const LUGAR_NO_TRILHO = 'size-13 justify-center'
const LUGAR_ACESO = 'border-azul-borda bg-azul-claro text-azul-texto'
const LUGAR_APAGADO = 'border-transparent text-sutil hover:bg-fundo-suave hover:text-tinta'

/**
 * O lugar como botão, o do "Sair": a forma do lugar apagado (o hover só com o botão ligado) e o desligado em `inativo`.
 * Aberto ou no trilho, tem a mesma medida do link ao lado (RF15).
 */
export function classeDoBotaoDeLugar(trilho: boolean): string {
  return `${FORMA_DO_LUGAR} t-rotulo border-transparent text-sutil enabled:hover:bg-fundo-suave enabled:hover:text-tinta disabled:text-inativo ${trilho ? LUGAR_NO_TRILHO : LUGAR_ABERTO}`
}

/**
 * A dica do trilho: o rótulo que o ícone sozinho não diz, ao passar o mouse **e** ao chegar pelo teclado. Para o leitor
 * de tela o nome já está no próprio controle, e a dica é só visual. É uma caixa flutuante como o menu: face `fundo`, borda
 * de 2 px e degrau de 4 (`shadow-flutua`), e a face do oficial é só do botão oficial.
 */
export function Dica({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="t-apoio pointer-events-none absolute top-1/2 left-full z-20 ml-3 hidden -translate-y-1/2 rounded-controle bg-fundo px-3 py-1.5 whitespace-nowrap text-tinta shadow-flutua group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  )
}

/**
 * O ícone de um lugar, na caixa de 36 do lugar (D80): o ilustrado a 32 px, ou o do `lucide` dentro de um `Ladrilho` na
 * família do lugar. Sempre decoração: o rótulo está escrito ao lado, ou no nome do controle, e dizê-lo duas vezes seria
 * ruído (9.4, "ícone sempre com rótulo").
 */
export function IconeDoLugar({ icone }: { icone: IconeDoItem }) {
  if ('lugar' in icone) {
    return (
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center">
        <Icone nome={icone.lugar} tamanho={32} />
      </span>
    )
  }
  // O `lucide` num `Ladrilho` de 36, com o traço de 2,5 px da 9.4.
  const Desenho = icone.lucide
  return (
    <Ladrilho familia={icone.familia} tamanho={36}>
      <Desenho strokeWidth={2.5} />
    </Ladrilho>
  )
}

/**
 * Um item da navegação. O selecionado tem **o `aria-current` e a borda de 2 px**, além da cor (`docs/interface.md` 11.1): o
 * fundo `azul-claro` sozinho é pouco contra o branco de uma tela de Chromebook de entrada, e a borda `azul-borda` fica a 2 px
 * do que é apagado, que não a tem.
 *
 * Tocar num item fecha a gaveta, também quando o item é o da tela aberta e o endereço não muda.
 */
export function ItemDaLateral({ item, trilho }: { item: ItemDaNavegacao; trilho: boolean }) {
  const [caminho] = useLocation()
  const { fechar } = useContext(ContextoDaGaveta)
  const aqui = estaNoItem(caminho, item)
  return (
    <li>
      <Link
        to={item.caminho}
        onClick={fechar}
        aria-current={aqui ? 'page' : undefined}
        className={`${FORMA_DO_LUGAR} t-rotulo ${trilho ? LUGAR_NO_TRILHO : LUGAR_ABERTO} ${aqui ? LUGAR_ACESO : LUGAR_APAGADO}`}
      >
        <IconeDoLugar icone={item.icone} />
        {trilho ? (
          <>
            <span className="sr-only">{item.rotulo}</span>
            <Dica>{item.rotulo}</Dica>
          </>
        ) : (
          <span className="min-w-0 break-words">{item.rotulo}</span>
        )}
      </Link>
    </li>
  )
}

interface PropsDaListaDeItens {
  readonly itens: readonly ItemDaNavegacao[]
  /** O nome do grupo para o leitor de tela: `Seções` já é de quem tem os itens principais, e este não se confunde com ele. */
  readonly rotulo: string
  readonly trilho: boolean
}

/**
 * Os itens do pé da lateral — o rodapé fixo do aluno e os links do menu da pessoa —, numa navegação com nome próprio, para
 * `Seções` continuar sendo só os itens principais do papel. Sem item, não existe nem a região. Cada um é o mesmo
 * `ItemDaLateral`: as pistas do selecionado, 52 px de altura e, no trilho, o ícone com a dica.
 */
export function ListaDeItens({ itens, rotulo, trilho }: PropsDaListaDeItens) {
  if (itens.length === 0) return null
  return (
    <nav aria-label={rotulo}>
      <ul className={`flex flex-col gap-2 ${trilho ? 'items-center' : ''}`}>
        {itens.map((item) => (
          <ItemDaLateral key={item.caminho} item={item} trilho={trilho} />
        ))}
      </ul>
    </nav>
  )
}
