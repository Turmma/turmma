import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MEDIA_MD, useMediaQuery } from './media-query'

export interface TableColumn<Linha> {
  readonly chave: string
  /** O cabeçalho da coluna, que no celular vira o rótulo de cada valor. */
  readonly titulo: string
  readonly celula: (linha: Linha) => ReactNode
  /** Número e data alinham à direita na tabela. */
  readonly alinhamento?: 'inicio' | 'fim'
}

interface TableProps<Linha> {
  /** O nome da tabela, para o leitor de tela: "O que a IA gerou e quem aprovou". */
  readonly rotulo: string
  /** A primeira coluna é a que identifica a linha: na tabela é o cabeçalho dela, e no celular, o título do item. */
  readonly colunas: readonly [TableColumn<Linha>, ...TableColumn<Linha>[]]
  readonly linhas: readonly Linha[]
  readonly chaveDaLinha: (linha: Linha) => string
}

/**
 * A tabela do produto, que **vira lista no celular** (regra 50, item 2a; `docs/interface.md` 10.2): a partir de 768 px é
 * uma tabela de verdade, com cabeçalho de coluna e de linha; abaixo disso, uma lista em que cada linha é um bloco, com o
 * título da coluna ao lado de cada valor. A 360 px ninguém rola uma tabela de seis colunas de lado para achar o estado.
 *
 * - **A pele (D80)**: moldura de canto 16 e borda de 2 px em `borda`, sem sombra e sem degrau (peça de leitura); o
 *   cabeçalho de 44 px em `t-selo`, e a linha de 64 px, separada da de cima por 2 px. No celular, cada linha é um cartão
 *   da mesma borda, com a primeira coluna em `t-cartao` e o nome das outras em `t-selo`. A tabela não ordena, de propósito.
 * - **A linha que abre** (X2, 5.0): a linha e o cartão são `relative`, e o link da primeira célula se estende por eles
 *   (`after:absolute after:inset-0`). A linha inteira passa a ser o alvo, e o que fica dentro dela e precisa do próprio
 *   clique (o menu da linha) ganha `relative` sem `z-index`: ele vem depois do link no documento e é pintado acima do `::after`, e sem
 *   `z-index` não cria contexto de empilhamento, de modo que a lista e o fundo do `Menu` (`fixed z-30` e `z-20`) ficam acima das linhas de baixo.
 * - **Uma estrutura de cada vez no documento**, escolhida pela largura (`useMediaQuery`): pôr as duas e esconder uma com CSS
 *   dobraria os nós de uma tabela longa no Chromebook, e os controles de dentro das células existiriam duas vezes.
 * - **Na tabela, o cabeçalho é acessível**: `caption`, `th` de coluna e a primeira célula como `th` de linha. Quando ela
 *   não cabe, **rola dentro do próprio contêiner**, que aí — e só aí — recebe foco, para rolar pelo teclado. A tabela
 *   que cabe não vira uma parada a mais no Tab.
 * - **Na lista**, cada valor tem o rótulo dele em texto (`dt` e `dd`): o que na tabela é posição, aqui é dito.
 *
 * A peça não pagina nem virtualiza: quem a usa entrega a página (regra 80, item 8). E não tem os quatro estados: vazio,
 * carregando e erro são da consulta de quem usa.
 */
export function Table<Linha>({ rotulo, colunas, linhas, chaveDaLinha }: TableProps<Linha>) {
  const larga = useMediaQuery(MEDIA_MD)
  const [primeira, ...outras] = colunas
  const regiao = useRef<HTMLDivElement>(null)
  // A tabela passa da largura do contêiner agora? Medido quando ele ou ela mudam de tamanho.
  const [sobra, definirSobra] = useState(false)
  useEffect(() => {
    const elemento = regiao.current
    if (elemento === null) return
    const medir = () => definirSobra(elemento.scrollWidth > elemento.clientWidth)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    if (elemento.firstElementChild !== null) observador.observe(elemento.firstElementChild)
    return () => observador.disconnect()
  }, [larga])

  if (!larga)
    return (
      <ul aria-label={rotulo} data-tabela="lista" className="flex min-w-0 flex-col gap-3">
        {linhas.map((linha) => (
          <li key={chaveDaLinha(linha)} className="relative min-w-0 rounded-cartao border-2 border-borda bg-superficie p-4">
            <div className="t-cartao min-w-0 break-words text-tinta">
              <span className="sr-only">{primeira.titulo}: </span>
              {primeira.celula(linha)}
            </div>
            <dl className="mt-3 flex min-w-0 flex-col gap-2">
              {outras.map((coluna) => (
                <div key={coluna.chave} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="t-selo text-sutil">{coluna.titulo}</dt>
                  <dd className="t-apoio min-w-0 break-words text-tinta">{coluna.celula(linha)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    )

  return (
    // Com sobra, a região recebe foco e nome: a tabela que rola de lado precisa ser rolável pelo teclado.
    <div ref={regiao} {...(sobra ? { role: 'region', 'aria-label': rotulo, tabIndex: 0 } : {})} data-tabela="tabela" className="min-w-0 overflow-x-auto rounded-cartao border-2 border-borda">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{rotulo}</caption>
        <thead>
          <tr className="h-11 border-b-2 border-borda">
            {colunas.map((coluna) => (
              <th key={coluna.chave} scope="col" className={`t-selo px-4 whitespace-nowrap text-sutil ${coluna.alinhamento === 'fim' ? 'text-right' : ''}`}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={chaveDaLinha(linha)} className="relative h-16 border-b-2 border-borda last:border-b-0">
              <th scope="row" className={`t-apoio px-4 py-3 text-tinta ${primeira.alinhamento === 'fim' ? 'text-right' : ''}`}>
                {primeira.celula(linha)}
              </th>
              {outras.map((coluna) => (
                <td key={coluna.chave} className={`t-apoio px-4 py-3 text-tinta ${coluna.alinhamento === 'fim' ? 'text-right tabular-nums' : ''}`}>
                  {coluna.celula(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
